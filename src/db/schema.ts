import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('student'), // 'student' | 'educator' | 'moderator' | 'admin'
  institution: text('institution').default('Global Open Academy'),
  isVerifiedEducator: boolean('is_verified_educator').default(false),
  restrictedAccessPass: boolean('restricted_access_pass').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Videos table
export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  videoUrl: text('video_url').notNull(),
  thumbnailUrl: text('thumbnail_url').notNull(),
  previewUrl: text('preview_url'),
  duration: text('duration').notNull().default('12:30'),
  durationSec: integer('duration_sec').notNull().default(750),
  category: text('category').notNull().default('Computer Science'),
  tags: text('tags').notNull().default('[]'), // JSON string array
  educatorId: text('educator_id').notNull(), // links to user uid
  educatorName: text('educator_name').notNull(),
  educatorAvatar: text('educator_avatar'),
  views: integer('views').default(0),
  likes: integer('likes').default(0),
  dislikes: integer('dislikes').default(0),
  accessLevel: text('access_level').notNull().default('public'), // 'public' | 'institutional' | 'sensitive_academic' | 'private'
  isEncrypted: boolean('is_encrypted').default(true),
  encryptionAlgorithm: text('encryption_algorithm').default('AES-256-GCM'),
  encryptionKeyId: text('encryption_key_id'),
  encryptionHash: text('encryption_hash'),
  isPeerReviewed: boolean('is_peer_reviewed').default(false),
  isApproved: boolean('is_approved').default(true),
  isRemoved: boolean('is_removed').default(false),
  flaggedCount: integer('flagged_count').default(0),
  isShort: boolean('is_short').default(false),
  videoData: text('video_data'), // Stores video binary/base64 payload directly in database
  mimeType: text('mime_type').default('video/mp4'),
  fileSize: integer('file_size').default(0),
  isSupabaseStored: boolean('is_supabase_stored').default(false),
  supabasePath: text('supabase_path'),
  supabaseBucket: text('supabase_bucket'),
  supabaseUrl: text('supabase_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Comments table
export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  videoId: integer('video_id').references(() => videos.id).notNull(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  userAvatar: text('user_avatar'),
  userRole: text('user_role').default('student'),
  content: text('content').notNull(),
  timestampSec: integer('timestamp_sec').default(0),
  likes: integer('likes').default(0),
  isPinned: boolean('is_pinned').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Reports table
export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  videoId: integer('video_id').references(() => videos.id).notNull(),
  videoTitle: text('video_title').notNull(),
  reportedByUserId: text('reported_by_user_id').notNull(),
  reportedByEmail: text('reported_by_email'),
  category: text('category').notNull(), // 'academic_dishonesty' | 'misleading_facts' | 'copyright_infringement' | 'inappropriate_content' | 'harassment' | 'guidelines_violation'
  details: text('details').notNull(),
  timestampMark: text('timestamp_mark'),
  status: text('status').notNull().default('pending'), // 'pending' | 'under_review' | 'resolved_action_taken' | 'dismissed'
  resolutionNotes: text('resolution_notes'),
  resolvedBy: text('resolved_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Notifications table
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('interaction'), // 'interaction' | 'system' | 'moderation' | 'upload'
  videoId: integer('video_id'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// User votes table
export const userVotes = pgTable('user_votes', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  videoId: integer('video_id').references(() => videos.id).notNull(),
  voteType: text('vote_type').notNull(), // 'like' | 'dislike'
  createdAt: timestamp('created_at').defaultNow(),
});

// Relationships
export const videosRelations = relations(videos, ({ many }) => ({
  comments: many(comments),
  reports: many(reports),
  votes: many(userVotes),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  video: one(videos, {
    fields: [comments.videoId],
    references: [videos.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  video: one(videos, {
    fields: [reports.videoId],
    references: [videos.id],
  }),
}));
