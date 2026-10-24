import { db } from './index.ts';
import { users, videos, comments, reports, notifications, userVotes } from './schema.ts';
import { desc, eq, and, sql, or, ilike, inArray } from 'drizzle-orm';

// --- Users ---
export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string,
  avatarUrl?: string,
  role: string = 'student'
) {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      // Update display name or avatar if provided
      if (displayName || avatarUrl) {
        const [updated] = await db.update(users)
          .set({
            displayName: displayName || existing[0].displayName,
            avatarUrl: avatarUrl || existing[0].avatarUrl,
          })
          .where(eq(users.uid, uid))
          .returning();
        return updated;
      }
      return existing[0];
    }

    const [created] = await db.insert(users)
      .values({
        uid,
        email,
        displayName: displayName || email.split('@')[0],
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`,
        role: role || (email.includes('admin') ? 'admin' : 'student'),
        institution: email.endsWith('.edu') ? 'Accredited University Partner' : 'Global Open Academy',
        isVerifiedEducator: role === 'educator',
        restrictedAccessPass: email.endsWith('.edu'),
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to retrieve or create user profile.', { cause: error });
  }
}

export async function getUserProfile(uid: string) {
  try {
    const user = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return user[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserProfile:', error);
    throw new Error('Failed to fetch user profile.', { cause: error });
  }
}

export async function updateUserRole(uid: string, role: string, restrictedPass?: boolean) {
  try {
    const [updated] = await db.update(users)
      .set({
        role,
        isVerifiedEducator: role === 'educator',
        ...(restrictedPass !== undefined ? { restrictedAccessPass: restrictedPass } : {}),
      })
      .where(eq(users.uid, uid))
      .returning();
    return updated;
  } catch (error) {
    console.error('Database query failed in updateUserRole:', error);
    throw new Error('Failed to update user role.', { cause: error });
  }
}

// --- Videos ---
export interface VideoFilters {
  category?: string;
  search?: string;
  sort?: 'trending' | 'top_rated' | 'newest' | 'most_viewed';
  accessLevel?: string;
  isShort?: boolean;
  isSupabaseStored?: boolean;
}

export async function getVideos(filters: VideoFilters = {}) {
  try {
    const conditions = [eq(videos.isRemoved, false)];

    if (filters.isShort !== undefined) {
      conditions.push(eq(videos.isShort, filters.isShort));
    }

    if (filters.isSupabaseStored !== undefined) {
      conditions.push(eq(videos.isSupabaseStored, filters.isSupabaseStored));
    }

    if (filters.category && filters.category !== 'All') {
      conditions.push(eq(videos.category, filters.category));
    }

    if (filters.accessLevel && filters.accessLevel !== 'all') {
      conditions.push(eq(videos.accessLevel, filters.accessLevel));
    }

    if (filters.search && filters.search.trim() !== '') {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(videos.title, term),
          ilike(videos.description, term),
          ilike(videos.educatorName, term),
          ilike(videos.category, term)
        )!
      );
    }

    let orderByClause = desc(videos.createdAt);
    if (filters.sort === 'top_rated') {
      orderByClause = desc(videos.likes);
    } else if (filters.sort === 'most_viewed' || filters.sort === 'trending') {
      orderByClause = desc(videos.views);
    }

    const results = await db.select()
      .from(videos)
      .where(and(...conditions))
      .orderBy(orderByClause);

    return results;
  } catch (error) {
    console.error('Database query failed in getVideos:', error);
    throw new Error('Failed to fetch video catalog.', { cause: error });
  }
}

export async function getShorts() {
  try {
    return await db.select()
      .from(videos)
      .where(and(eq(videos.isRemoved, false), eq(videos.isShort, true)))
      .orderBy(desc(videos.views));
  } catch (error) {
    console.error('Database query failed in getShorts:', error);
    return [];
  }
}

export async function getVideoById(id: number) {
  try {
    const list = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
    return list[0] || null;
  } catch (error) {
    console.error('Database query failed in getVideoById:', error);
    throw new Error('Failed to fetch video details.', { cause: error });
  }
}

export async function incrementVideoViews(id: number) {
  try {
    await db.update(videos)
      .set({ views: sql`${videos.views} + 1` })
      .where(eq(videos.id, id));
  } catch (error) {
    console.error('Database query failed in incrementVideoViews:', error);
  }
}

export async function createVideo(data: {
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  previewUrl?: string;
  duration: string;
  durationSec: number;
  category: string;
  tags?: string;
  educatorId: string;
  educatorName: string;
  educatorAvatar?: string;
  accessLevel: string;
  isEncrypted: boolean;
  encryptionAlgorithm?: string;
  encryptionKeyId?: string;
  encryptionHash?: string;
  isPeerReviewed?: boolean;
  isApproved?: boolean;
  isRemoved?: boolean;
  isShort?: boolean;
  isSupabaseStored?: boolean;
  supabasePath?: string;
  supabaseBucket?: string;
  supabaseUrl?: string;
  videoData?: string;
  mimeType?: string;
  fileSize?: number;
}) {
  try {
    const [inserted] = await db.insert(videos).values(data).returning();
    return inserted;
  } catch (error) {
    console.error('Database query failed in createVideo:', error);
    throw new Error('Failed to store video record in database.', { cause: error });
  }
}

export async function deleteVideo(id: number) {
  try {
    // Soft delete / remove video
    const [updated] = await db.update(videos)
      .set({ isRemoved: true })
      .where(eq(videos.id, id))
      .returning();
    return updated;
  } catch (error) {
    console.error('Database query failed in deleteVideo:', error);
    throw new Error('Failed to delete video record.', { cause: error });
  }
}

export async function updateVideo(id: number, data: Partial<typeof videos.$inferInsert>) {
  try {
    const [updated] = await db.update(videos)
      .set(data)
      .where(eq(videos.id, id))
      .returning();
    return updated;
  } catch (error) {
    console.error('Database query failed in updateVideo:', error);
    throw new Error('Failed to update video record.', { cause: error });
  }
}

export async function clearDemoPlaceholdersInDB() {
  try {
    const demoIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    await db.update(videos)
      .set({ isRemoved: true })
      .where(inArray(videos.id, demoIds));
    return true;
  } catch (error) {
    console.error('Database query failed in clearDemoPlaceholdersInDB:', error);
    return false;
  }
}

export async function restoreDemoPlaceholdersInDB() {
  try {
    const demoIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    await db.update(videos)
      .set({ isRemoved: false })
      .where(inArray(videos.id, demoIds));
    return true;
  } catch (error) {
    console.error('Database query failed in restoreDemoPlaceholdersInDB:', error);
    return false;
  }
}

export async function getAllVideosAdmin() {
  try {
    return await db.select().from(videos).orderBy(desc(videos.createdAt));
  } catch (error) {
    console.error('Database query failed in getAllVideosAdmin:', error);
    throw new Error('Failed to fetch videos for admin.', { cause: error });
  }
}

export async function voteVideo(videoId: number, userId: string, voteType: 'like' | 'dislike') {
  try {
    const existing = await db.select().from(userVotes)
      .where(and(eq(userVotes.videoId, videoId), eq(userVotes.userId, userId)))
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].voteType === voteType) {
        // Remove vote
        await db.delete(userVotes).where(eq(userVotes.id, existing[0].id));
        if (voteType === 'like') {
          await db.update(videos).set({ likes: sql`GREATEST(0, ${videos.likes} - 1)` }).where(eq(videos.id, videoId));
        } else {
          await db.update(videos).set({ dislikes: sql`GREATEST(0, ${videos.dislikes} - 1)` }).where(eq(videos.id, videoId));
        }
        return { action: 'removed', voteType: null };
      } else {
        // Flip vote
        await db.update(userVotes).set({ voteType }).where(eq(userVotes.id, existing[0].id));
        if (voteType === 'like') {
          await db.update(videos).set({
            likes: sql`${videos.likes} + 1`,
            dislikes: sql`GREATEST(0, ${videos.dislikes} - 1)`,
          }).where(eq(videos.id, videoId));
        } else {
          await db.update(videos).set({
            dislikes: sql`${videos.dislikes} + 1`,
            likes: sql`GREATEST(0, ${videos.likes} - 1)`,
          }).where(eq(videos.id, videoId));
        }
        return { action: 'switched', voteType };
      }
    } else {
      // New vote
      await db.insert(userVotes).values({ videoId, userId, voteType });
      if (voteType === 'like') {
        await db.update(videos).set({ likes: sql`${videos.likes} + 1` }).where(eq(videos.id, videoId));
      } else {
        await db.update(videos).set({ dislikes: sql`${videos.dislikes} + 1` }).where(eq(videos.id, videoId));
      }
      return { action: 'added', voteType };
    }
  } catch (error) {
    console.error('Database query failed in voteVideo:', error);
    throw new Error('Failed to record user vote.', { cause: error });
  }
}

export async function getUserVote(videoId: number, userId: string) {
  try {
    const existing = await db.select().from(userVotes)
      .where(and(eq(userVotes.videoId, videoId), eq(userVotes.userId, userId)))
      .limit(1);
    return existing[0]?.voteType || null;
  } catch (error) {
    console.error('Database query failed in getUserVote:', error);
    return null;
  }
}

// --- Comments ---
export async function getVideoComments(videoId: number) {
  try {
    return await db.select().from(comments)
      .where(eq(comments.videoId, videoId))
      .orderBy(desc(comments.isPinned), desc(comments.createdAt));
  } catch (error) {
    console.error('Database query failed in getVideoComments:', error);
    throw new Error('Failed to load lecture comments.', { cause: error });
  }
}

export async function createComment(data: {
  videoId: number;
  userId: string;
  userName: string;
  userAvatar?: string;
  userRole?: string;
  content: string;
  timestampSec?: number;
  isPinned?: boolean;
}) {
  try {
    const [inserted] = await db.insert(comments).values(data).returning();
    return inserted;
  } catch (error) {
    console.error('Database query failed in createComment:', error);
    throw new Error('Failed to post discussion comment.', { cause: error });
  }
}

// --- Reports & Moderation ---
export async function getReports(statusFilter?: string) {
  try {
    if (statusFilter && statusFilter !== 'all') {
      return await db.select().from(reports)
        .where(eq(reports.status, statusFilter))
        .orderBy(desc(reports.createdAt));
    }
    return await db.select().from(reports).orderBy(desc(reports.createdAt));
  } catch (error) {
    console.error('Database query failed in getReports:', error);
    throw new Error('Failed to fetch moderation reports queue.', { cause: error });
  }
}

export async function createReport(data: {
  videoId: number;
  videoTitle: string;
  reportedByUserId: string;
  reportedByEmail?: string;
  category: string;
  details: string;
  timestampMark?: string;
}) {
  try {
    const [inserted] = await db.insert(reports).values(data).returning();
    // Increment flagged count on video
    await db.update(videos)
      .set({ flaggedCount: sql`${videos.flaggedCount} + 1` })
      .where(eq(videos.id, data.videoId));
    return inserted;
  } catch (error) {
    console.error('Database query failed in createReport:', error);
    throw new Error('Failed to submit moderation report.', { cause: error });
  }
}

export async function updateReportStatus(
  reportId: number,
  status: string,
  resolutionNotes?: string,
  resolvedBy?: string,
  videoAction?: 'keep' | 'takedown' | 'restrict_institutional'
) {
  try {
    const [updated] = await db.update(reports)
      .set({
        status,
        resolutionNotes,
        resolvedBy,
      })
      .where(eq(reports.id, reportId))
      .returning();

    if (updated && videoAction) {
      if (videoAction === 'takedown') {
        await db.update(videos)
          .set({ isRemoved: true })
          .where(eq(videos.id, updated.videoId));
      } else if (videoAction === 'restrict_institutional') {
        await db.update(videos)
          .set({ accessLevel: 'institutional' })
          .where(eq(videos.id, updated.videoId));
      }
    }
    return updated;
  } catch (error) {
    console.error('Database query failed in updateReportStatus:', error);
    throw new Error('Failed to update report resolution.', { cause: error });
  }
}

// --- Notifications ---
export async function getNotifications(userId: string) {
  try {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
  } catch (error) {
    console.error('Database query failed in getNotifications:', error);
    throw new Error('Failed to fetch user notifications.', { cause: error });
  }
}

export async function createNotification(data: {
  userId: string;
  title: string;
  message: string;
  type?: string;
  videoId?: number;
}) {
  try {
    const [inserted] = await db.insert(notifications).values(data).returning();
    return inserted;
  } catch (error) {
    console.error('Database query failed in createNotification:', error);
  }
}

export async function markNotificationRead(id: number) {
  try {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  } catch (error) {
    console.error('Database query failed in markNotificationRead:', error);
  }
}
