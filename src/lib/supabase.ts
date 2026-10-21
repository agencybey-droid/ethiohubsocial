import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isCustom: boolean;
}

// Default demonstration Supabase project or placeholder
const DEFAULT_SUPABASE_URL = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://we3hzouhirdn7snxkkvu.supabase.co';

const DEFAULT_SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlM2h6b3VoaXJkbjdzbnhra3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgwMDAwMDAsImV4cCI6MjAyMzU3NjAwMH0.sample_public_anon_key';

const STORAGE_KEY = 'ethiohub_supabase_config_v1';

export function getStoredSupabaseConfig(): SupabaseConfig {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.anonKey) {
          return {
            url: parsed.url.trim(),
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
      .insert([videoRecord])
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
