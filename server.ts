import express from 'express';
import { requireAuth, optionalAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  getOrCreateUser,
  getUserProfile,
  updateUserRole,
  getVideos,
  getShorts,
  getVideoById,
  incrementVideoViews,
  createVideo,
  voteVideo,
  getUserVote,
  getVideoComments,
  createComment,
  getReports,
  createReport,
  updateReportStatus,
  getNotifications,
  createNotification,
  markNotificationRead,
  deleteVideo,
  getAllVideosAdmin,
} from './src/db/queries.ts';

const app = express();
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'EduHub API', timestamp: new Date().toISOString() });
});

// Sync or fetch current user profile
app.post('/api/auth/sync', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { uid, email, displayName, avatarUrl, role } = req.body;
    const effectiveUid = req.user?.uid || uid;
    const effectiveEmail = req.user?.email || email;

    if (!effectiveUid || !effectiveEmail) {
      return res.status(400).json({ error: 'UID and email are required to sync profile' });
    }

    const user = await getOrCreateUser(
      effectiveUid,
      effectiveEmail,
      displayName || req.user?.name,
      avatarUrl || req.user?.picture,
      role
    );
    res.json(user);
  } catch (error: any) {
    console.error('Failed to sync user:', error);
    res.status(500).json({ error: error.message || 'Failed to sync user' });
  }
});

// Get user profile
app.get('/api/auth/me', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid || (req.query.uid as string);
    if (!uid) {
      return res.json({ user: null });
    }
    const profile = await getUserProfile(uid);
    res.json({ user: profile });
  } catch (error: any) {
    console.error('Failed to fetch profile:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch user profile' });
  }
});

// Update role / access pass (for testing granular admin & educator permissions)
app.patch('/api/auth/role', async (req, res) => {
  try {
    const { uid, role, restrictedPass } = req.body;
    if (!uid || !role) {
      return res.status(400).json({ error: 'UID and role are required' });
    }
    const updated = await updateUserRole(uid, role, restrictedPass);
    res.json(updated);
  } catch (error: any) {
    console.error('Failed to update role:', error);
    res.status(500).json({ error: error.message || 'Failed to update user role' });
  }
});

// List regular videos with filters
app.get('/api/videos', async (req, res) => {
  try {
    const { category, search, sort, accessLevel, isShort, isSupabaseStored } = req.query;
    const videosList = await getVideos({
      category: category as string,
      search: search as string,
      sort: sort as any,
      accessLevel: accessLevel as string,
      isShort: isShort !== undefined ? isShort === 'true' : false,
      isSupabaseStored: isSupabaseStored !== undefined ? isSupabaseStored === 'true' : undefined,
    });
    res.json(videosList);
  } catch (error: any) {
    console.error('Failed to load videos:', error);
    res.status(500).json({ error: error.message || 'Failed to load videos' });
  }
});

// Dedicated Shorts / Reels endpoint
app.get('/api/shorts', async (req, res) => {
  try {
    const list = await getShorts();
    res.json(list);
  } catch (error: any) {
    console.error('Failed to load shorts:', error);
    res.status(500).json({ error: error.message || 'Failed to load shorts' });
  }
});

// Get single video
app.get('/api/videos/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    const video = await getVideoById(id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Increment view count asynchronously
    incrementVideoViews(id);

    // If user is provided, check user's vote
    const userId = req.user?.uid || (req.query.userId as string);
    let userVote = null;
    if (userId) {
      userVote = await getUserVote(id, userId);
    }

    res.json({ video, userVote });
  } catch (error: any) {
    console.error('Failed to fetch video:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch video' });
  }
});

// Upload educational video with AES encryption metadata
app.post('/api/videos/upload', async (req, res) => {
  try {
    const {
      title,
      description,
      videoUrl,
      thumbnailUrl,
      previewUrl,
      duration,
      durationSec,
      category,
      tags,
      educatorId,
      educatorName,
      educatorAvatar,
      accessLevel,
      isEncrypted,
      encryptionAlgorithm,
      encryptionKeyId,
      encryptionHash,
      isPeerReviewed,
      isSupabaseStored,
      supabasePath,
      supabaseBucket,
      supabaseUrl,
      videoData,
      mimeType,
      fileSize,
    } = req.body;

    if (!title || !description || !videoUrl || !thumbnailUrl || !educatorId) {
      return res.status(400).json({ error: 'Missing required video fields' });
    }

    const video = await createVideo({
      title,
      description,
      videoUrl,
      thumbnailUrl,
      previewUrl: previewUrl || thumbnailUrl,
      duration: duration || '15:00',
      durationSec: durationSec || 900,
      category: category || 'Science & Technology',
      tags: typeof tags === 'string' ? tags : JSON.stringify(tags || []),
      educatorId,
      educatorName: educatorName || 'Verified Educator',
      educatorAvatar,
      accessLevel: accessLevel || 'public',
      isEncrypted: isEncrypted !== undefined ? isEncrypted : false,
      encryptionAlgorithm: encryptionAlgorithm || 'AES-256-GCM',
      encryptionKeyId: encryptionKeyId || `key_${Math.random().toString(36).substring(2, 9)}`,
      encryptionHash: encryptionHash || `sha256-${Math.random().toString(36).substring(2, 12)}`,
      isPeerReviewed: !!isPeerReviewed,
      isShort: req.body.isShort === true || (durationSec && durationSec <= 60),
      isSupabaseStored: isSupabaseStored === true,
      supabasePath: supabasePath || null,
      supabaseBucket: supabaseBucket || 'videos',
      supabaseUrl: supabaseUrl || null,
      videoData: videoData || null,
      mimeType: mimeType || 'video/mp4',
      fileSize: fileSize || 0,
    });

    // Create system notification for subscribers
    await createNotification({
      userId: educatorId,
      title: 'Video Published',
      message: `"${title}" has been published to the catalog.`,
      type: 'upload',
      videoId: video.id,
    });

    res.status(201).json(video);
  } catch (error: any) {
    console.error('Failed to upload video:', error);
    res.status(500).json({ error: error.message || 'Failed to publish video' });
  }
});

// Admin: Get all videos (including shorts and unapproved)
app.get('/api/admin/videos', async (req, res) => {
  try {
    const list = await getAllVideosAdmin();
    res.json(list);
  } catch (error: any) {
    console.error('Failed to load admin videos:', error);
    res.status(500).json({ error: error.message || 'Failed to load admin videos' });
  }
});

// Admin / Creator: Delete or remove video
app.delete('/api/videos/:id', async (req, res) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    if (isNaN(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }
    const removed = await deleteVideo(videoId);
    res.json({ success: true, removed });
  } catch (error: any) {
    console.error('Failed to delete video:', error);
    res.status(500).json({ error: error.message || 'Failed to delete video' });
  }
});

// Vote (like/dislike)
app.post('/api/videos/:id/vote', async (req, res) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    const { userId, voteType } = req.body;
    if (isNaN(videoId) || !userId || !voteType) {
      return res.status(400).json({ error: 'Video ID, userId, and voteType are required' });
    }

    const result = await voteVideo(videoId, userId, voteType);
    const updated = await getVideoById(videoId);
    res.json({ ...result, likes: updated?.likes, dislikes: updated?.dislikes });
  } catch (error: any) {
    console.error('Failed to record vote:', error);
    res.status(500).json({ error: error.message || 'Failed to record vote' });
  }
});

// Get comments
app.get('/api/videos/:id/comments', async (req, res) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    if (isNaN(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }
    const commentsList = await getVideoComments(videoId);
    res.json(commentsList);
  } catch (error: any) {
    console.error('Failed to load comments:', error);
    res.status(500).json({ error: error.message || 'Failed to load comments' });
  }
});

// Post comment
app.post('/api/videos/:id/comments', async (req, res) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    const { userId, userName, userAvatar, userRole, content, timestampSec, isPinned } = req.body;
    if (isNaN(videoId) || !userId || !content) {
      return res.status(400).json({ error: 'Video ID, userId, and content are required' });
    }

    const comment = await createComment({
      videoId,
      userId,
      userName: userName || 'Student',
      userAvatar,
      userRole: userRole || 'student',
      content,
      timestampSec: timestampSec || 0,
      isPinned: !!isPinned,
    });

    // Notify video educator
    const video = await getVideoById(videoId);
    if (video && video.educatorId !== userId) {
      await createNotification({
        userId: video.educatorId,
        title: 'New Academic Discussion',
        message: `${userName || 'A student'} commented on "${video.title}": "${content.slice(0, 60)}..."`,
        type: 'interaction',
        videoId: video.id,
      });
    }

    res.status(201).json(comment);
  } catch (error: any) {
    console.error('Failed to post comment:', error);
    res.status(500).json({ error: error.message || 'Failed to post comment' });
  }
});

// Submit report
app.post('/api/reports', async (req, res) => {
  try {
    const { videoId, videoTitle, reportedByUserId, reportedByEmail, category, details, timestampMark } = req.body;
    if (!videoId || !reportedByUserId || !category || !details) {
      return res.status(400).json({ error: 'Missing required report fields' });
    }

    const report = await createReport({
      videoId: Number(videoId),
      videoTitle: videoTitle || 'Educational Lecture',
      reportedByUserId,
      reportedByEmail,
      category,
      details,
      timestampMark,
    });

    // Create moderation alert for admin & mod roles
    await createNotification({
      userId: reportedByUserId,
      title: 'Report Received',
      message: `Your report regarding "${videoTitle}" has been logged and assigned to the Academic Moderation Board.`,
      type: 'moderation',
      videoId: Number(videoId),
    });

    res.status(201).json(report);
  } catch (error: any) {
    console.error('Failed to submit report:', error);
    res.status(500).json({ error: error.message || 'Failed to submit report' });
  }
});

// Get reports (for moderators & admins)
app.get('/api/reports', async (req, res) => {
  try {
    const { status } = req.query;
    const reportsList = await getReports(status as string);
    res.json(reportsList);
  } catch (error: any) {
    console.error('Failed to load reports:', error);
    res.status(500).json({ error: error.message || 'Failed to load reports' });
  }
});

// Update report status & resolution
app.patch('/api/reports/:id', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    const { status, resolutionNotes, resolvedBy, videoAction } = req.body;
    if (isNaN(reportId) || !status) {
      return res.status(400).json({ error: 'Report ID and status are required' });
    }

    const updated = await updateReportStatus(reportId, status, resolutionNotes, resolvedBy, videoAction);

    // Notify reporter if exists
    if (updated.reportedByUserId) {
      await createNotification({
        userId: updated.reportedByUserId,
        title: 'Report Resolution Update',
        message: `Report #${reportId} status updated to "${status}". Action: ${videoAction || 'Reviewed'}.`,
        type: 'moderation',
        videoId: updated.videoId,
      });
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Failed to update report:', error);
    res.status(500).json({ error: error.message || 'Failed to update report' });
  }
});

// Get notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.json([]);
    }
    const list = await getNotifications(userId);
    res.json(list);
  } catch (error: any) {
    console.error('Failed to load notifications:', error);
    res.status(500).json({ error: error.message || 'Failed to load notifications' });
  }
});

// Create notification (trigger real-time alert)
app.post('/api/notifications', async (req, res) => {
  try {
    const { userId, title, message, type, videoId } = req.body;
    if (!userId || !title || !message) {
      return res.status(400).json({ error: 'userId, title, and message are required' });
    }
    const created = await createNotification({ userId, title, message, type, videoId });
    res.status(201).json(created);
  } catch (error: any) {
    console.error('Failed to create notification:', error);
    res.status(500).json({ error: error.message || 'Failed to create notification' });
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!isNaN(id)) {
      await markNotificationRead(id);
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to mark notification read:', error);
    res.status(500).json({ error: error.message || 'Failed to mark read' });
  }
});

// Platform stats
app.get('/api/stats', async (req, res) => {
  try {
    const allVideos = await getVideos();
    const allReports = await getReports();
    const pendingReports = allReports.filter(r => r.status === 'pending');
    res.json({
      totalLectures: allVideos.length,
      peerReviewedCount: allVideos.filter(v => v.isPeerReviewed).length,
      encryptedStreamsCount: allVideos.filter(v => v.isEncrypted).length,
      totalViews: allVideos.reduce((acc, v) => acc + (v.views || 0), 0),
      openReportsCount: pendingReports.length,
      encryptionProtocol: 'AES-256-GCM Hardware-Accelerated',
    });
  } catch (error: any) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({ error: 'Failed to fetch platform stats' });
  }
});

import { fileURLToPath } from 'node:url';

export default app;

// Standalone start for production when executed directly
const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith('server.ts') || 
  process.argv[1].endsWith('server.js')
);

if (isDirectExecution) {
  const PORT = process.env.PORT || 3000;
  app.use(express.static('dist'));
  app.listen(PORT, () => {
    console.log(`EduHub server running on port ${PORT}`);
  });
}
