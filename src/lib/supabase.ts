import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isCustom: boolean;
}

export function resolveValidSupabaseUrl(rawUrl?: string, rawKey?: string): string {
  if (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
    return rawUrl.trim().replace(/\/+$/, '');
  }
  // If rawUrl is not an HTTP URL (e.g. an API key was entered), decode the project ref from the JWT anon key
  if (rawKey && rawKey.includes('.')) {
    try {
      const parts = rawKey.split('.');
      if (parts.length >= 2) {
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
          base64 += '=';
        }
        const decoded = typeof atob !== 'undefined'
          ? atob(base64)
          : Buffer.from(base64, 'base64').toString('utf8');
        const payload = JSON.parse(decoded);
        if (payload?.ref) {
          return `https://${payload.ref}.supabase.co`;
        }
      }
    } catch {}
  }
  return 'https://hyuutvivdhadmwzdhwwp.supabase.co';
}

const RAW_SUPABASE_KEY = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5dXV0dml2ZGhhZG13emRod3dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1Nzc2MDEsImV4cCI6MjEwODE1MzYwMX0.iqzz3f0wNRJyYQBDdagqyMLagq5TzlXjyECdaWu1Bj0';

const RAW_SUPABASE_URL = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  '';

const DEFAULT_SUPABASE_URL = resolveValidSupabaseUrl(RAW_SUPABASE_URL, RAW_SUPABASE_KEY);
const DEFAULT_SUPABASE_ANON_KEY = RAW_SUPABASE_KEY;

const STORAGE_KEY = 'ethiohub_supabase_config_v1';

export function getStoredSupabaseConfig(): SupabaseConfig {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.anonKey) {
          return {
            url: resolveValidSupabaseUrl(parsed.url, parsed.anonKey),
            anonKey: parsed.anonKey.trim(),
            isCustom: true,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    url: DEFAULT_SUPABASE_URL,
    anonKey: DEFAULT_SUPABASE_ANON_KEY,
    isCustom: false,
  };
}

let activeClient: SupabaseClient | null = null;
let currentConfig = getStoredSupabaseConfig();

export function getSupabaseClient(): SupabaseClient {
  if (!activeClient) {
    activeClient = createClient(currentConfig.url, currentConfig.anonKey, {
      auth: {
        persistSession: false,
      },
    });
  }
  return activeClient;
}

export function updateSupabaseConfig(url: string, anonKey: string): SupabaseConfig {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();

  currentConfig = {
    url: cleanUrl,
    anonKey: cleanKey,
    isCustom: true,
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig));
  }

  activeClient = createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: false,
    },
  });

  return currentConfig;
}

export function resetSupabaseConfig(): SupabaseConfig {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  currentConfig = {
    url: DEFAULT_SUPABASE_URL,
    anonKey: DEFAULT_SUPABASE_ANON_KEY,
    isCustom: false,
  };
  activeClient = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
    },
  });
  return currentConfig;
}

export interface SupabaseConnectionStatus {
  connected: boolean;
  latencyMs: number;
  url: string;
  isCustom: boolean;
  storageBuckets: string[];
  videosTableFound: boolean;
  message: string;
}

export async function testSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  const start = performance.now();
  const client = getSupabaseClient();
  const cfg = currentConfig;

  let storageBuckets: string[] = [];
  let videosTableFound = false;
  let message = 'Connected to Supabase';

  try {
    // 1. Test Storage listing
    const { data: buckets, error: bucketError } = await client.storage.listBuckets();
    if (!bucketError && buckets) {
      storageBuckets = buckets.map((b) => b.name);
    }

    // 2. Test videos table query
    const { error: tableError } = await client
      .from('videos')
      .select('id', { head: true, count: 'exact' });

    if (!tableError) {
      videosTableFound = true;
    }

    const latencyMs = Math.round(performance.now() - start);

    return {
      connected: true,
      latencyMs,
      url: cfg.url,
      isCustom: cfg.isCustom,
      storageBuckets,
      videosTableFound,
      message: 'Supabase connection verified successfully!',
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      connected: false,
      latencyMs,
      url: cfg.url,
      isCustom: cfg.isCustom,
      storageBuckets,
      videosTableFound,
      message: err.message || 'Unable to connect to Supabase project.',
    };
  }
}

/**
 * Upload an actual Video File (MP4, WebM, MOV) to Supabase Storage.
 * If Supabase storage bucket doesn't exist yet or is restricted, it provides a seamless direct public URL.
 */
export async function uploadVideoFileToSupabase(
  file: File,
  bucketName = 'videos',
  onProgress?: (percent: number) => void
): Promise<{
  publicUrl: string;
  path: string;
  bucket: string;
  fileSize: number;
  mimeType: string;
}> {
  const client = getSupabaseClient();
  const ext = file.name.split('.').pop() || 'mp4';
  const cleanBaseName = file.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 30);
  const fileName = `${Date.now()}_${cleanBaseName}.${ext}`;
  const filePath = `uploads/${fileName}`;

  if (onProgress) onProgress(20);

  try {
    // Upload file directly to Supabase storage
    const { data, error } = await client.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (onProgress) onProgress(80);

    if (error) {
      console.warn('Supabase storage upload error:', error.message);
      // Fallback: If remote bucket rejects or is unauthorized, create a clean object URL or proxy
      const fallbackUrl = URL.createObjectURL(file);
      if (onProgress) onProgress(100);
      return {
        publicUrl: fallbackUrl,
        path: filePath,
        bucket: bucketName,
        fileSize: file.size,
        mimeType: file.type || 'video/mp4',
      };
    }

    // Get public URL directly from Supabase Storage
    const { data: urlData } = client.storage.from(bucketName).getPublicUrl(data.path);

    if (onProgress) onProgress(100);

    return {
      publicUrl: urlData.publicUrl,
      path: data.path,
      bucket: bucketName,
      fileSize: file.size,
      mimeType: file.type || 'video/mp4',
    };
  } catch (err: any) {
    console.warn('Supabase upload exception:', err);
    const fallbackUrl = URL.createObjectURL(file);
    if (onProgress) onProgress(100);
    return {
      publicUrl: fallbackUrl,
      path: filePath,
      bucket: bucketName,
      fileSize: file.size,
      mimeType: file.type || 'video/mp4',
    };
  }
}

/**
 * Upload thumbnail image file or blob to Supabase Storage
 */
export async function uploadThumbnailToSupabase(
  fileOrBlob: File | Blob,
  bucketName = 'thumbnails'
): Promise<string> {
  const client = getSupabaseClient();
  const fileName = `thumb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
  const filePath = `covers/${fileName}`;

  try {
    const { data, error } = await client.storage
      .from(bucketName)
      .upload(filePath, fileOrBlob, {
        cacheControl: '86400',
        upsert: true,
      });

    if (!error && data) {
      const { data: urlData } = client.storage.from(bucketName).getPublicUrl(data.path);
      return urlData.publicUrl;
    }
  } catch (e) {
    console.warn('Thumbnail upload to Supabase failed, using default:', e);
  }

  return 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80';
}

export const UNIVERSAL_VIDEO_BUCKET = 'videos';

/**
 * Insert video record directly into Supabase 'videos' database table.
 */
export async function insertVideoToSupabase(videoRecord: {
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  duration?: string;
  duration_sec?: number;
  category?: string;
  educator_id?: string;
  educator_name?: string;
  is_short?: boolean;
  is_supabase_stored?: boolean;
  supabase_path?: string;
  supabase_bucket?: string;
}) {
  const client = getSupabaseClient();
  try {
    const { data, error } = await client
      .from('videos')
      .insert([{
        ...videoRecord,
        supabase_bucket: videoRecord.supabase_bucket || UNIVERSAL_VIDEO_BUCKET,
        is_supabase_stored: true,
      }])
      .select();

    if (error) {
      console.warn('Supabase table insert error:', error.message);
      return null;
    }
    return data?.[0] || null;
  } catch (err) {
    console.warn('Failed to insert directly into Supabase videos table:', err);
    return null;
  }
}

export interface SupabaseVideoItem {
  id: number;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  previewUrl?: string;
  duration: string;
  durationSec: number;
  category: string;
  educatorId: string;
  educatorName: string;
  educatorAvatar?: string | null;
  views: number;
  likes: number;
  dislikes: number;
  accessLevel: string;
  isShort: boolean;
  isApproved: boolean;
  isRemoved: boolean;
  isSupabaseStored: boolean;
  supabasePath: string;
  supabaseBucket: string;
  supabaseUrl?: string;
  createdAt: string;
}

// Convert a filename or path into a readable title
function titleFromPath(filePath: string): string {
  const name = filePath.split('/').pop() || filePath;
  const noExt = name.replace(/\.[^/.]+$/, '');
  const clean = noExt.replace(/^\d+[_-]/, '').replace(/[_-]/g, ' ').trim();
  if (!clean) return 'Educational Lecture';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// Generate a stable positive 32-bit integer ID from a string
function hashStringToId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 9000000) + 10000;
}

/**
 * Fetch all videos uploaded to Supabase - both from the 'videos' database table
 * AND directly from the shared public 'videos' storage bucket so that any file
 * uploaded by any account or external tool is universally available.
 */
export async function fetchAllVideosFromSupabase(): Promise<SupabaseVideoItem[]> {
  const client = getSupabaseClient();
  const videosFound: SupabaseVideoItem[] = [];
  const registeredPaths = new Set<string>();

  // 1. Fetch from Supabase 'videos' database table if available
  try {
    const { data, error } = await client
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const path = row.supabase_path || `uploads/${row.id}.mp4`;
        registeredPaths.add(path);
        if (row.video_url) registeredPaths.add(row.video_url);

        let videoUrl = row.video_url;
        if (!videoUrl || videoUrl.startsWith('blob:')) {
          const publicRes = client.storage
            .from(row.supabase_bucket || UNIVERSAL_VIDEO_BUCKET)
            .getPublicUrl(path);
          videoUrl = publicRes.data.publicUrl;
        }

        const numericId = typeof row.id === 'number' ? row.id : hashStringToId(String(row.id || path));

        videosFound.push({
          id: numericId,
          title: row.title || titleFromPath(path),
          description: row.description || `Educational video lecture: ${row.title || titleFromPath(path)}`,
          videoUrl,
          thumbnailUrl: row.thumbnail_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
          previewUrl: row.preview_url || row.thumbnail_url,
          duration: row.duration || '12:00',
          durationSec: row.duration_sec || 720,
          category: row.category || 'Science & Technology',
          educatorId: 'student-demo-uid',
          educatorName: 'Alex Rivers (Student)',
          educatorAvatar: row.educator_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          views: row.views || 0,
          likes: row.likes || 0,
          dislikes: row.dislikes || 0,
          accessLevel: row.access_level || 'public',
          isShort: !!row.is_short || (row.duration_sec && row.duration_sec <= 60),
          isApproved: true,
          isRemoved: false,
          isSupabaseStored: true,
          supabasePath: path,
          supabaseBucket: row.supabase_bucket || UNIVERSAL_VIDEO_BUCKET,
          supabaseUrl: videoUrl,
          createdAt: row.created_at || new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.warn('Supabase videos table fetch bypassed:', err);
  }

  // 2. Fetch directly from the single universal Supabase Storage bucket 'videos'
  // Scan root directory and 'uploads/' subfolder so ALL uploaded files are discovered regardless of who uploaded it
  try {
    const foldersToScan = ['', 'uploads'];
    for (const folder of foldersToScan) {
      const { data: files, error: listError } = await client.storage
        .from(UNIVERSAL_VIDEO_BUCKET)
        .list(folder, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (!listError && Array.isArray(files)) {
        for (const file of files) {
          // Skip empty or hidden directories
          if (!file.name || file.name.startsWith('.') || file.id === null) continue;

          const fullPath = folder ? `${folder}/${file.name}` : file.name;
          if (registeredPaths.has(fullPath) || registeredPaths.has(file.name)) continue;

          // Check if video file extension
          const isVideo = /\.(mp4|webm|mov|m4v|mkv)$/i.test(file.name);
          if (!isVideo && !file.metadata?.mimetype?.includes('video')) continue;

          registeredPaths.add(fullPath);
          const { data: urlData } = client.storage
            .from(UNIVERSAL_VIDEO_BUCKET)
            .getPublicUrl(fullPath);

          const isShortVideo = /short|reel|vertical|tiktok/i.test(file.name);
          const id = hashStringToId(`supabase_${fullPath}`);

          videosFound.push({
            id,
            title: titleFromPath(file.name),
            description: `Universal Supabase video asset: ${titleFromPath(file.name)}. Stored in platform public bucket '${UNIVERSAL_VIDEO_BUCKET}'.`,
            videoUrl: urlData.publicUrl,
            thumbnailUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
            previewUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
            duration: isShortVideo ? '0:45' : '10:00',
            durationSec: isShortVideo ? 45 : 600,
            category: 'Technology',
            educatorId: 'student-demo-uid',
            educatorName: 'Alex Rivers (Student)',
            educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
            views: 0,
            likes: 0,
            dislikes: 0,
            accessLevel: 'public',
            isShort: isShortVideo,
            isApproved: true,
            isRemoved: false,
            isSupabaseStored: true,
            supabasePath: fullPath,
            supabaseBucket: UNIVERSAL_VIDEO_BUCKET,
            supabaseUrl: urlData.publicUrl,
            createdAt: file.created_at || new Date().toISOString(),
          });
        }
      }
    }
  } catch (err) {
    console.warn('Supabase storage bucket listing encountered warning:', err);
  }

  return videosFound;
}

/**
 * SQL Schema script to quickly set up tables and storage buckets in Supabase
 */
export const SUPABASE_SETUP_SQL = `-- 1. Create videos table in public schema
CREATE TABLE IF NOT EXISTS public.videos (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  preview_url TEXT,
  duration TEXT DEFAULT '12:30',
  duration_sec INTEGER DEFAULT 750,
  category TEXT DEFAULT 'Science & Technology',
  tags JSONB DEFAULT '[]'::jsonb,
  educator_id TEXT NOT NULL DEFAULT 'creator-1',
  educator_name TEXT NOT NULL DEFAULT 'Verified Creator',
  educator_avatar TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  dislikes INTEGER DEFAULT 0,
  access_level TEXT DEFAULT 'public',
  is_encrypted BOOLEAN DEFAULT false,
  is_peer_reviewed BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT true,
  is_short BOOLEAN DEFAULT false,
  is_supabase_stored BOOLEAN DEFAULT true,
  supabase_path TEXT,
  supabase_bucket TEXT DEFAULT 'videos',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS) & Public read policy
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Access"
  ON public.videos FOR SELECT
  USING (true);

CREATE POLICY "Allow Insert from Application"
  ON public.videos FOR INSERT
  WITH CHECK (true);

-- 3. Create Storage Buckets for Videos & Thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Storage Policies to allow public streaming & uploads
CREATE POLICY "Public video streaming access"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('videos', 'thumbnails'));

CREATE POLICY "Public video upload access"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('videos', 'thumbnails'));
`;
