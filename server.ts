import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
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
  updateVideo,
  clearDemoPlaceholdersInDB,
  restoreDemoPlaceholdersInDB,
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
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Setup uploads directories for universal server-side video & thumbnail storage
const uploadsBaseDir = path.join(process.cwd(), 'uploads');
const uploadsVideosDir = path.join(uploadsBaseDir, 'videos');
const uploadsThumbnailsDir = path.join(uploadsBaseDir, 'thumbnails');

if (!fs.existsSync(uploadsVideosDir)) {
  fs.mkdirSync(uploadsVideosDir, { recursive: true });
}
if (!fs.existsSync(uploadsThumbnailsDir)) {
  fs.mkdirSync(uploadsThumbnailsDir, { recursive: true });
}

// Serve static uploads
app.use('/uploads', express.static(uploadsBaseDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'thumbnail') {
      cb(null, uploadsThumbnailsDir);
    } else {
      cb(null, uploadsVideosDir);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.fieldname === 'thumbnail' ? '.jpg' : '.mp4');
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    cb(null, `${file.fieldname}-${Date.now()}-${cleanName}${ext}`);
  },
});

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 }, // 250MB
});

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
    syncSupabaseVideosToCloudSQL().catch(() => {});
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
    syncSupabaseVideosToCloudSQL().catch(() => {});
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

// Increment video views
app.post('/api/videos/:id/view', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!isNaN(id)) {
      await incrementVideoViews(id);
      const video = await getVideoById(id);
      return res.json({ success: true, views: video?.views || 1 });
    }
    res.json({ success: true, views: 1 });
  } catch (err: any) {
    res.json({ success: true });
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

    const cleanTitle = (title || '').trim();
    if (!cleanTitle) {
      return res.status(400).json({ error: 'Video title is required' });
    }

    const cleanDescription = (description || `Educational video: ${cleanTitle}`).trim();
    const cleanVideoUrl = (videoUrl || '').trim();
    if (!cleanVideoUrl && !req.body.videoData) {
      return res.status(400).json({ error: 'Valid video URL or video file is required' });
    }
    const cleanThumbUrl = (thumbnailUrl || previewUrl || '').trim() || 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800&auto=format&fit=crop&q=80';
    const cleanEducatorId = educatorId || 'student-demo-uid';

    const video = await createVideo({
      title: cleanTitle,
      description: cleanDescription,
      videoUrl: cleanVideoUrl,
      thumbnailUrl: cleanThumbUrl,
      previewUrl: previewUrl || cleanThumbUrl,
      duration: duration || '15:00',
      durationSec: durationSec || 900,
      category: category || 'Science & Technology',
      tags: typeof tags === 'string' ? tags : JSON.stringify(tags || []),
      educatorId: cleanEducatorId && cleanEducatorId !== 'admin-portal' ? cleanEducatorId : 'student-demo-uid',
      educatorName: (educatorName && educatorName !== 'Verified Educator' && educatorName !== 'Admin Team') ? educatorName : 'Alex Rivers (Student)',
      educatorAvatar: educatorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
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

    // If videoData base64 is provided in JSON payload, save to disk and configure streaming URL
    if (videoData) {
      try {
        const base64Data = videoData.replace(/^data:video\/[^;]+;base64,/, '');
        const targetPath = path.join(uploadsVideosDir, `video-${video.id}.mp4`);
        fs.writeFileSync(targetPath, Buffer.from(base64Data, 'base64'));
        const streamUrl = `/api/media/stream/${video.id}`;
        await updateVideo(video.id, { videoUrl: streamUrl });
        video.videoUrl = streamUrl;
      } catch (err) {
        console.warn('Could not write videoData to disk cache:', err);
      }
    }

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

// Multipart file upload endpoint (universal storage across all browsers and phones)
app.post('/api/videos/upload-file', uploadMiddleware.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]), async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const videoFile = files?.video?.[0];
    const thumbFile = files?.thumbnail?.[0];

    const {
      title,
      description,
      duration,
      durationSec,
      category,
      tags,
      educatorId,
      educatorName,
      educatorAvatar,
      accessLevel,
      isShort,
      isPeerReviewed,
      autoApprove,
    } = req.body;

    const cleanTitle = (title || (videoFile ? videoFile.originalname.replace(/\.[^/.]+$/, '') : '')).trim();
    if (!cleanTitle) {
      return res.status(400).json({ error: 'Video title is required' });
    }

    let mimeType = videoFile ? (videoFile.mimetype || 'video/mp4') : 'video/mp4';
    let fileSize = videoFile ? videoFile.size : 0;
    let videoData: string | null = null;

    if (videoFile && fileSize <= 50 * 1024 * 1024) {
      try {
        const fileBuf = fs.readFileSync(videoFile.path);
        videoData = fileBuf.toString('base64');
      } catch (e) {
        console.warn('Failed to read video buffer into base64:', e);
      }
    }

    let thumbnailUrl = req.body.thumbnailUrl || '';
    if (thumbFile) {
      thumbnailUrl = `/uploads/thumbnails/${thumbFile.filename}`;
    } else if (req.body.thumbnailData && req.body.thumbnailData.startsWith('data:image/')) {
      try {
        const thumbFilename = `thumb-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
        const thumbPath = path.join(uploadsThumbnailsDir, thumbFilename);
        const thumbBase64 = req.body.thumbnailData.replace(/^data:image\/[^;]+;base64,/, '');
        fs.writeFileSync(thumbPath, Buffer.from(thumbBase64, 'base64'));
        thumbnailUrl = `/uploads/thumbnails/${thumbFilename}`;
      } catch (e) {
        console.warn('Failed to write thumbnail frame:', e);
      }
    }

    if (!thumbnailUrl) {
      thumbnailUrl = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
    }

    const cleanDesc = (description || `Educational video lecture: ${cleanTitle}`).trim();
    const cleanDurationSec = durationSec ? parseInt(durationSec, 10) : 600;
    const isShortBool = isShort === 'true' || isShort === true || (cleanDurationSec <= 60);

    const videoUrl = videoFile 
      ? `/uploads/videos/${videoFile.filename}` 
      : ((req.body.videoUrl || '').trim());
    if (!videoUrl) {
      return res.status(400).json({ error: 'Video file or videoUrl is required' });
    }

    const video = await createVideo({
      title: cleanTitle,
      description: cleanDesc,
      videoUrl,
      thumbnailUrl,
      previewUrl: thumbnailUrl,
      duration: duration || '10:00',
      durationSec: cleanDurationSec,
      category: category || 'Science & Technology',
      tags: typeof tags === 'string' ? tags : JSON.stringify(tags || []),
      educatorId: (educatorId && educatorId !== 'admin-portal') ? educatorId : 'student-demo-uid',
      educatorName: (educatorName && educatorName !== 'Admin Team') ? educatorName : 'Alex Rivers (Student)',
      educatorAvatar: educatorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      accessLevel: accessLevel || 'public',
      isEncrypted: false,
      isPeerReviewed: isPeerReviewed === 'true' || isPeerReviewed === true,
      isShort: isShortBool,
      isApproved: autoApprove !== 'false' && autoApprove !== false,
      videoData: videoData || undefined,
      mimeType,
      fileSize,
    });

    if (videoFile) {
      const universalStreamUrl = `/api/media/stream/${video.id}`;
      const standardPath = path.join(uploadsVideosDir, `video-${video.id}.mp4`);
      try {
        fs.copyFileSync(videoFile.path, standardPath);
      } catch {}

      await updateVideo(video.id, {
        videoUrl: universalStreamUrl,
      });
      video.videoUrl = universalStreamUrl;
    }

    res.status(201).json(video);
  } catch (error: any) {
    console.error('Failed to upload video file via multipart:', error);
    res.status(500).json({ error: error.message || 'Failed to upload video file' });
  }
});

// Universal Video Streaming Endpoint with HTTP Range (206) support for all mobile and desktop browsers
app.get('/api/media/stream/:id', async (req, res) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    if (isNaN(videoId)) return res.status(400).send('Invalid video ID');

    const standardPath = path.join(uploadsVideosDir, `video-${videoId}.mp4`);

    if (!fs.existsSync(standardPath)) {
      const video = await getVideoById(videoId);
      if (!video) {
        return res.status(404).send('Video not found');
      }

      if (video.videoData) {
        try {
          const base64Data = video.videoData.replace(/^data:video\/[^;]+;base64,/, '');
          fs.writeFileSync(standardPath, Buffer.from(base64Data, 'base64'));
        } catch (e) {
          console.error('Failed to write reconstructed video to disk:', e);
          return res.status(500).send('Failed to reconstruct video on server');
        }
      } else if (video.videoUrl && !video.videoUrl.startsWith('blob:') && !video.videoUrl.includes('/api/media/stream/')) {
        return res.redirect(video.videoUrl);
      } else {
        return res.status(404).send('Video data not found on server');
      }
    }

    const stat = fs.statSync(standardPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const mimeType = 'video/mp4';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
        return;
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(standardPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType,
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      fs.createReadStream(standardPath).pipe(res);
    }
  } catch (err: any) {
    console.error('Error streaming video:', err);
    res.status(500).send('Error streaming video');
  }
});

// Admin: Mark demo placeholders as removed in database for all visitors
app.post('/api/admin/clear-demo-placeholders', async (req, res) => {
  try {
    const success = await clearDemoPlaceholdersInDB();
    res.json({ success, message: 'Demo placeholders cleared for all visitors.' });
  } catch (error: any) {
    console.error('Failed to clear demo placeholders:', error);
    res.status(500).json({ error: error.message || 'Failed to clear demo placeholders' });
  }
});

// Admin: Restore demo placeholders - disabled per user requirement
app.post('/api/admin/restore-demo-placeholders', async (req, res) => {
  res.json({ success: true, message: 'Demo placeholders are disabled.' });
});

// Sync locally uploaded videos to Cloud SQL so all visitors can see them
app.post('/api/videos/sync-local', async (req, res) => {
  try {
    const { videos: localList } = req.body;
    if (!Array.isArray(localList)) {
      return res.status(400).json({ error: 'Array of videos expected' });
    }

    const synced = [];
    for (const v of localList) {
      if (!v || !v.title || !v.videoUrl) continue;
      if (v.id && v.id <= 12) continue;
      if (v.videoUrl.includes('commondatastorage.googleapis.com') || v.videoUrl.includes('gtv-videos-bucket')) continue;

      const cleanTitle = v.title.trim();
      const existing = await getVideos({ search: cleanTitle });
      const found = existing.find((item) => item.title.toLowerCase() === cleanTitle.toLowerCase() || item.videoUrl === v.videoUrl);
      if (!found) {
        const created = await createVideo({
          title: cleanTitle,
          description: (v.description || `Educational video: ${cleanTitle}`).trim(),
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
          previewUrl: v.previewUrl || v.thumbnailUrl,
          duration: v.duration || '10:00',
          durationSec: v.durationSec || 600,
          category: v.category || 'Technology',
          tags: typeof v.tags === 'string' ? v.tags : JSON.stringify(v.tags || []),
          educatorId: 'student-demo-uid',
          educatorName: 'Alex Rivers (Student)',
          educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          accessLevel: 'public',
          isEncrypted: false,
          isPeerReviewed: true,
          isApproved: true,
          isRemoved: false,
          isShort: !!v.isShort,
          videoData: v.videoData || undefined,
          mimeType: v.mimeType || 'video/mp4',
          fileSize: v.fileSize || 0,
        });
        synced.push(created);
      }
    }

    res.json({ success: true, syncedCount: synced.length, synced });
  } catch (error: any) {
    console.error('Failed to sync local videos:', error);
    res.status(500).json({ error: error.message || 'Failed to sync local videos' });
  }
});

function resolveValidSupabaseUrl(rawUrl?: string, rawKey?: string): string {
  if (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
    return rawUrl.trim().replace(/\/+$/, '');
  }
  if (rawKey && rawKey.includes('.')) {
    try {
      const parts = rawKey.split('.');
      if (parts.length >= 2) {
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const decoded = Buffer.from(base64, 'base64').toString('utf8');
        const payload = JSON.parse(decoded);
        if (payload?.ref) return `https://${payload.ref}.supabase.co`;
      }
    } catch {}
  }
  return 'https://hyuutvivdhadmwzdhwwp.supabase.co';
}

// Configure Supabase server client for single shared 'videos' bucket library
const SUPABASE_RAW_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5dXV0dml2ZGhhZG13emRod3dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1Nzc2MDEsImV4cCI6MjEwODE1MzYwMX0.iqzz3f0wNRJyYQBDdagqyMLagq5TzlXjyECdaWu1Bj0';
const SUPABASE_URL = resolveValidSupabaseUrl(process.env.VITE_SUPABASE_URL, SUPABASE_RAW_KEY);
const SUPABASE_ANON_KEY = SUPABASE_RAW_KEY;
const supabaseServerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// Sync all videos uploaded to Supabase (from the single shared 'videos' storage bucket & database) into Cloud SQL
async function syncSupabaseVideosToCloudSQL(customBucket?: string): Promise<{ syncedCount: number; synced: any[] }> {
  const syncedVideos: any[] = [];
  try {
    // 1. Fetch videos from Supabase 'videos' database table
    try {
      const { data: dbRows, error: dbErr } = await supabaseServerClient
        .from('videos')
        .select('*');

      if (!dbErr && Array.isArray(dbRows)) {
        for (const row of dbRows) {
          const title = (row.title || 'Supabase Lecture').trim();
          const existing = await getVideos({ search: title });
          const match = existing.find(
            (v) =>
              v.title.toLowerCase() === title.toLowerCase() ||
              (v.supabasePath && v.supabasePath === row.supabase_path) ||
              (row.video_url && v.videoUrl === row.video_url)
          );

          if (!match) {
            let videoUrl = row.video_url;
            if (!videoUrl && row.supabase_path) {
              videoUrl = supabaseServerClient.storage
                .from('videos')
                .getPublicUrl(row.supabase_path).data.publicUrl;
            }
            if (!videoUrl) continue;

            const isShort = !!row.is_short || (row.duration_sec && row.duration_sec <= 60);
            const created = await createVideo({
              title,
              description: row.description || `Educational video lecture: ${title}`,
              videoUrl,
              thumbnailUrl: row.thumbnail_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
              previewUrl: row.preview_url || row.thumbnail_url,
              duration: row.duration || '10:00',
              durationSec: row.duration_sec || 600,
              category: row.category || 'Technology',
              tags: typeof row.tags === 'string' ? row.tags : JSON.stringify(row.tags || ['supabase']),
              educatorId: 'student-demo-uid',
              educatorName: 'Alex Rivers (Student)',
              educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
              accessLevel: row.access_level || 'public',
              isEncrypted: false,
              isShort,
              isApproved: true,
              isRemoved: false,
              isSupabaseStored: true,
              supabasePath: row.supabase_path || null,
              supabaseBucket: 'videos',
              supabaseUrl: videoUrl,
            });
            syncedVideos.push(created);
          }
        }
      }
    } catch (e) {
      console.warn('Supabase DB table sync note:', e);
    }

    // 2. Fetch directly from Supabase storage buckets (recursive multi-bucket scan)
    const candidateBuckets = Array.from(new Set([
      (customBucket || '').trim(),
      'videos', 'Videos', 'video', 'Video',
      'uploads', 'Uploads', 'media', 'Media', 'shorts', 'Shorts'
    ].filter(Boolean)));

    const videoExtRegex = /\.(mp4|webm|mov|m4v|mkv|avi|flv|wmv|ts|3gp)$/i;

    for (const bName of candidateBuckets) {
      const scannedFolders = new Set<string>();
      const folderQueue = [''];

      while (folderQueue.length > 0 && scannedFolders.size < 20) {
        const currentFolder = folderQueue.shift()!;
        if (scannedFolders.has(currentFolder)) continue;
        scannedFolders.add(currentFolder);

        try {
          const { data: items, error: listErr } = await supabaseServerClient.storage
            .from(bName)
            .list(currentFolder, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

          if (!listErr && Array.isArray(items)) {
            for (const item of items) {
              if (!item.name || item.name.startsWith('.')) continue;

              const itemPath = currentFolder ? `${currentFolder}/${item.name}` : item.name;

              // Check if folder
              const isFolder = item.id === null || item.metadata === null || (!item.name.includes('.') && !item.metadata?.mimetype);
              if (isFolder) {
                if (!scannedFolders.has(itemPath) && !folderQueue.includes(itemPath)) {
                  folderQueue.push(itemPath);
                }
                continue;
              }

              // Check if video file
              const isVideo = videoExtRegex.test(item.name) || item.metadata?.mimetype?.includes('video');
              if (!isVideo) continue;

              const { data: urlData } = supabaseServerClient.storage
                .from(bName)
                .getPublicUrl(itemPath);

              const cleanName = item.name
                .replace(/\.[^/.]+$/, '')
                .replace(/^\d+[_-]/, '')
                .replace(/[_-]/g, ' ')
                .trim();
              const displayTitle = cleanName ? (cleanName.charAt(0).toUpperCase() + cleanName.slice(1)) : 'Supabase Video';

              const existing = await getVideos({ search: displayTitle });
              const match = existing.find(
                (v) =>
                  v.title.toLowerCase() === displayTitle.toLowerCase() ||
                  (v.supabasePath && v.supabasePath === itemPath) ||
                  v.videoUrl === urlData.publicUrl
              );

              if (!match) {
                const isShort = /short|reel|vertical|tiktok/i.test(item.name) || (item.metadata?.size && item.metadata.size < 8 * 1024 * 1024 && /portrait|short/i.test(itemPath));
                const created = await createVideo({
                  title: displayTitle,
                  description: `Universal educational video: ${displayTitle}. Streamed directly from Supabase storage bucket '${bName}'.`,
                  videoUrl: urlData.publicUrl,
                  thumbnailUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
                  previewUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
                  duration: isShort ? '0:45' : '10:00',
                  durationSec: isShort ? 45 : 600,
                  category: 'Technology',
                  tags: JSON.stringify(['supabase', bName]),
                  educatorId: 'student-demo-uid',
                  educatorName: 'Alex Rivers (Student)',
                  educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
                  accessLevel: 'public',
                  isEncrypted: false,
                  isShort: !!isShort,
                  isApproved: true,
                  isRemoved: false,
                  isSupabaseStored: true,
                  supabasePath: itemPath,
                  supabaseBucket: bName,
                  supabaseUrl: urlData.publicUrl,
                });
                syncedVideos.push(created);
              }
            }
          }
        } catch (fErr) {
          console.warn(`Supabase folder scan warning (${bName}/${currentFolder}):`, fErr);
        }
      }
    }
  } catch (err: any) {
    console.warn('Supabase sync overall warning:', err.message);
  }
  return { syncedCount: syncedVideos.length, synced: syncedVideos };
}

// Trigger Supabase sync endpoint
app.post('/api/supabase/sync', async (req, res) => {
  try {
    const customBucket = req.body?.bucketName || req.query?.bucket;
    const result = await syncSupabaseVideosToCloudSQL(customBucket as string);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Failed to sync from Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to sync from Supabase' });
  }
});

// Supabase Connection & Bucket status endpoint with diagnostic checklist
app.get('/api/supabase/status', async (req, res) => {
  try {
    const { data: buckets, error: bErr } = await supabaseServerClient.storage.listBuckets();
    const { data: files } = await supabaseServerClient.storage.from('videos').list('', { limit: 100 });
    const { data: uploadsFiles } = await supabaseServerClient.storage.from('videos').list('uploads', { limit: 100 });

    const totalFiles = (files ? files.filter(f => f.name && !f.name.startsWith('.')).length : 0) +
                       (uploadsFiles ? uploadsFiles.filter(f => f.name && !f.name.startsWith('.')).length : 0);

    res.json({
      connected: !bErr,
      bucket: 'videos',
      url: SUPABASE_URL,
      projectRef: 'hyuutvivdhadmwzdhwwp',
      bucketsFound: buckets ? buckets.map(b => b.name) : [],
      filesInVideosBucket: totalFiles,
      singleLibraryMode: true,
    });
  } catch (e: any) {
    res.json({
      connected: false,
      bucket: 'videos',
      url: SUPABASE_URL,
      projectRef: 'hyuutvivdhadmwzdhwwp',
      error: e.message,
      singleLibraryMode: true,
    });
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

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduHub server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
