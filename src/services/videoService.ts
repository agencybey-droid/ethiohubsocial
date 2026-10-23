// Resilient video service providing seamless dual-mode support:
// 1. Direct Cloud SQL & Express backend API (when running with full backend)
// 2. LocalStorage & Supabase fallback (when hosted statically e.g. Vercel without backend env vars)

import { uploadVideoFileToSupabase, insertVideoToSupabase } from '../lib/supabase.ts';

export interface VideoRecord {
  id: number;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  previewUrl?: string;
  duration: string;
  durationSec: number;
  category: string;
  tags?: string | string[];
  educatorId: string;
  educatorName: string;
  educatorAvatar?: string | null;
  views?: number;
  likes?: number;
  dislikes?: number;
  accessLevel?: string;
  isEncrypted?: boolean;
  encryptionAlgorithm?: string;
  encryptionKeyId?: string;
  encryptionHash?: string;
  isPeerReviewed?: boolean;
  isApproved?: boolean;
  isRemoved?: boolean;
  flaggedCount?: number;
  isShort?: boolean;
  videoData?: string | null;
  mimeType?: string;
  fileSize?: number;
  isSupabaseStored?: boolean;
  supabasePath?: string | null;
  supabaseBucket?: string | null;
  supabaseUrl?: string | null;
  createdAt?: string;
}

const LOCAL_VIDEOS_KEY = 'ethiohub_uploaded_videos_v2';
const LOCAL_REPORTS_KEY = 'ethiohub_reports_v2';

export const SEED_VIDEOS: VideoRecord[] = [
  {
    id: 5,
    title: 'Traditional Coffee Ceremony: Origin, Ritual & Chemistry of Roasting',
    description: 'Step-by-step masterclass covering green bean selection, artisanal pan-roasting kinetics, frankincense aroma pairing, and ceremonial pourings (Abol, Tona, Baraka).',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
    previewUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80',
    duration: '12:35',
    durationSec: 755,
    category: 'Culture',
    tags: '["Coffee", "Tradition", "Ceremony", "Culture"]',
    educatorId: 'edu-marcus-uid',
    educatorName: 'Bunna Stories',
    educatorAvatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
    views: 950000,
    likes: 61200,
    dislikes: 410,
    accessLevel: 'public',
    isEncrypted: true,
    isPeerReviewed: true,
    isApproved: true,
    isRemoved: false,
    isShort: false,
    createdAt: '2026-10-16T11:00:43.472Z',
  },
  {
    id: 6,
    title: 'Coronary Artery Bypass Graft (CABG): Clinical Surgery Protocol',
    description: 'Clinical cardiothoracic surgical demonstration. Demonstrates internal mammary artery harvest and saphenous vein grafting with sternotomy precautions.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&auto=format&fit=crop&q=80',
    previewUrl: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?w=800&auto=format&fit=crop&q=80',
    duration: '31:08',
    durationSec: 1868,
    category: 'Medical',
    tags: '["Cardiology", "Surgery", "Medical", "Clinical"]',
    educatorId: 'edu-marcus-uid',
    educatorName: 'Black Lion Hospital Clinical',
    educatorAvatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
    views: 521900,
    likes: 29800,
    dislikes: 190,
    accessLevel: 'sensitive_academic',
    isEncrypted: true,
    isPeerReviewed: true,
    isApproved: true,
    isRemoved: false,
    isShort: false,
    createdAt: '2026-10-16T11:00:43.472Z',
  },
  {
    id: 3,
    title: 'The Simien Mountains: Wildlife & Geology of the Roof of Africa',
    description: 'High-altitude ecology documentary tracking Gelada baboon communities and geological rift formation of the Ethiopian Highlands.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800&auto=format&fit=crop&q=80',
    previewUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
    duration: '15:20',
    durationSec: 920,
    category: 'Nature & Wildlife',
    tags: '["Nature", "Simien", "Wildlife", "Geology"]',
    educatorId: 'edu-eleanor-uid',
    educatorName: 'Wild Earth Docu',
    educatorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    views: 481000,
    likes: 29400,
    dislikes: 310,
    accessLevel: 'public',
    isEncrypted: true,
    isPeerReviewed: true,
    isApproved: true,
    isRemoved: false,
    isShort: false,
    createdAt: '2026-10-16T11:00:43.472Z',
  },
  {
    id: 4,
    title: 'Ethio-Jazz Origins: Scale Structures & Poly-Rhythms Explained',
    description: 'Music theory breakdown analyzing how Mulatu Astatke fused traditional 5-tone pentatonic modal scales with 12-tone jazz harmonies.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
    previewUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=800&auto=format&fit=crop&q=80',
    duration: '22:50',
    durationSec: 1370,
    category: 'Music & Arts',
    tags: '["EthioJazz", "Music Theory", "Jazz", "Culture"]',
    educatorId: 'edu-alan-uid',
    educatorName: 'Addis Sound Archive',
    educatorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    views: 724000,
    likes: 48900,
    dislikes: 350,
    accessLevel: 'public',
    isEncrypted: true,
    isPeerReviewed: true,
    isApproved: true,
    isRemoved: false,
    isShort: false,
    createdAt: '2026-10-16T11:00:43.472Z',
  },
  {
    id: 1,
    title: 'The Ancient Rock-Hewn Churches of Lalibela: Architectural Secrets',
    description: 'An in-depth historical exploration of how 11 monolithic medieval churches were carved directly downward from living volcanic rock in the 12th century.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80',
    previewUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    duration: '18:42',
    durationSec: 1122,
    category: 'History',
    tags: '["History", "Architecture", "Lalibela", "Documentary"]',
    educatorId: 'edu-eleanor-uid',
    educatorName: 'Heritage Expeditions',
    educatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    views: 642100,
    likes: 38400,
    dislikes: 420,
    accessLevel: 'public',
    isEncrypted: true,
    isPeerReviewed: true,
    isApproved: true,
    isRemoved: false,
    isShort: false,
    createdAt: '2026-10-16T11:00:43.472Z',
  },
  {
    id: 2,
    title: 'Deep Neural Networks: Backpropagation & Loss Optimization',
    description: 'Complete mathematical derivation of automatic differentiation, gradient flow dynamics, and loss landscape optimization in multi-layer perceptrons.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    previewUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
    duration: '24:15',
    durationSec: 1455,
    category: 'Technology',
    tags: '["AI", "Neural Networks", "Calculus", "Python"]',
    educatorId: 'edu-alan-uid',
    educatorName: 'CodeLab Africa',
    educatorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    views: 891200,
    likes: 52100,
    dislikes: 610,
    accessLevel: 'public',
    isEncrypted: true,
    isPeerReviewed: true,
    isApproved: true,
    isRemoved: false,
    isShort: false,
    createdAt: '2026-10-16T11:00:43.472Z',
  },
];

export const SEED_SHORTS: VideoRecord[] = [
  {
    id: 7,
    title: 'How Ethiopian Coffee Ceremony Works in 45 Seconds ☕',
    description: 'Quick traditional roasting, frankincense aroma, and three ceremonial pourings explained.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    duration: '0:35',
    durationSec: 35,
    category: 'Culture',
    educatorId: 'creator-coffee',
    educatorName: 'Bunna Stories',
    educatorAvatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
    views: 34100,
    likes: 2190,
    dislikes: 12,
    isShort: true,
    isApproved: true,
    isRemoved: false,
    createdAt: '2026-10-17T10:00:00.000Z',
  },
  {
    id: 8,
    title: 'Lalibela Rock-Hewn Architectural Wonder (Reel)',
    description: 'Marvel at 800-year-old monolithic church carved from living volcanic rock.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
    duration: '0:30',
    durationSec: 30,
    category: 'History',
    educatorId: 'creator-heritage',
    educatorName: 'Heritage Expeditions',
    views: 18200,
    likes: 1420,
    dislikes: 9,
    isShort: true,
    isApproved: true,
    isRemoved: false,
    createdAt: '2026-10-18T10:00:00.000Z',
  },
  {
    id: 9,
    title: 'Simien Mountains Gelada Baboon Playtime (28s)',
    description: 'Endemic high-altitude wildlife in the Simien National Park roof of Africa.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=600&auto=format&fit=crop&q=80',
    duration: '0:28',
    durationSec: 28,
    category: 'Nature & Wildlife',
    educatorId: 'creator-wild',
    educatorName: 'Wild Earth Docu',
    views: 29500,
    likes: 2840,
    dislikes: 15,
    isShort: true,
    isApproved: true,
    isRemoved: false,
    createdAt: '2026-10-19T10:00:00.000Z',
  },
  {
    id: 10,
    title: 'Python One-Liner Matrix Vectorization (45s)',
    description: 'Speed up numpy matrix calculations by 100x using broadcasting tricks.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    duration: '0:45',
    durationSec: 45,
    category: 'Technology',
    educatorId: 'creator-code',
    educatorName: 'CodeLab Africa',
    views: 45100,
    likes: 4120,
    dislikes: 22,
    isShort: true,
    isApproved: true,
    isRemoved: false,
    createdAt: '2026-10-20T10:00:00.000Z',
  },
];

// Helper to safely parse JSON responses without throwing Unexpected token 'T'
export async function safeFetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          data: null,
          error: data?.error || `Server responded with HTTP ${res.status}`,
        };
      }
      return { ok: true, status: res.status, data };
    } else {
      const text = await res.text();
      return {
        ok: res.ok,
        status: res.status,
        data: null,
        error: res.ok
          ? undefined
          : res.status === 404
          ? 'API route not found (404)'
          : text.slice(0, 120) || `HTTP ${res.status}`,
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err.message || 'Network request failed',
    };
  }
}

// Read local user uploads from browser storage
export function getLocalVideos(): VideoRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_VIDEOS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Save video to local storage
export function saveLocalVideo(video: VideoRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalVideos();
    const updated = [video, ...existing.filter((v) => v.id !== video.id)];
    localStorage.setItem(LOCAL_VIDEOS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save video to localStorage:', e);
  }
}

// Delete video from local storage
export function deleteLocalVideo(videoId: number): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalVideos();
    const updated = existing.filter((v) => v.id !== videoId);
    localStorage.setItem(LOCAL_VIDEOS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

/**
 * Fetch all catalog videos with category & search filtering, seamlessly
 * merging server data and local storage uploads with fallback support.
 */
export async function getCatalogVideos(params: {
  category?: string;
  search?: string;
  sort?: string;
}): Promise<VideoRecord[]> {
  const query = new URLSearchParams();
  if (params.sort) query.set('sort', params.sort);
  if (params.category && params.category !== 'All') query.set('category', params.category);
  if (params.search && params.search.trim()) query.set('search', params.search.trim());

  const localUploads = getLocalVideos().filter((v) => !v.isShort && !v.isRemoved);
  const result = await safeFetchJson<VideoRecord[]>(`/api/videos?${query.toString()}`);

  let baseList: VideoRecord[] = [];
  if (result.ok && Array.isArray(result.data)) {
    baseList = result.data;
  } else {
    // Fallback to rich seed list if backend is offline or static Vercel deployment
    baseList = [...SEED_VIDEOS];
    if (params.category && params.category !== 'All') {
      baseList = baseList.filter((v) => v.category === params.category);
    }
    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase();
      baseList = baseList.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.educatorName.toLowerCase().includes(q)
      );
    }
  }

  // Merge local uploads on top (avoiding duplicate IDs)
  const existingIds = new Set(baseList.map((v) => v.id));
  const filteredLocal = localUploads.filter((v) => {
    if (existingIds.has(v.id)) return false;
    if (params.category && params.category !== 'All' && v.category !== params.category) return false;
    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase();
      return (
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.educatorName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return [...filteredLocal, ...baseList];
}

/**
 * Fetch shorts reels catalog with local storage merge and fallback
 */
export async function getShortsCatalog(): Promise<VideoRecord[]> {
  const localShorts = getLocalVideos().filter((v) => v.isShort && !v.isRemoved);
  const result = await safeFetchJson<VideoRecord[]>('/api/shorts');

  let baseList: VideoRecord[] = [];
  if (result.ok && Array.isArray(result.data)) {
    baseList = result.data;
  } else {
    baseList = [...SEED_SHORTS];
  }

  const existingIds = new Set(baseList.map((v) => v.id));
  const filteredLocal = localShorts.filter((v) => !existingIds.has(v.id));

  return [...filteredLocal, ...baseList];
}

/**
 * Fetch all videos for Admin Management (including shorts and all categories)
 */
export async function getAdminVideosCatalog(): Promise<VideoRecord[]> {
  const localVideos = getLocalVideos();
  const result = await safeFetchJson<VideoRecord[]>('/api/admin/videos');

  let baseList: VideoRecord[] = [];
  if (result.ok && Array.isArray(result.data)) {
    baseList = result.data;
  } else {
    baseList = [...SEED_VIDEOS, ...SEED_SHORTS];
  }

  const existingIds = new Set(baseList.map((v) => v.id));
  const filteredLocal = localVideos.filter((v) => !existingIds.has(v.id));

  return [...filteredLocal, ...baseList];
}

/**
 * Unified publish/upload function that tries backend first, and automatically
 * falls back to Supabase + local persistence if backend responds with 404/offline.
 */
export async function publishVideo(payload: {
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  previewUrl?: string;
  duration?: string;
  durationSec?: number;
  category: string;
  tags?: string[] | string;
  educatorId: string;
  educatorName: string;
  educatorAvatar?: string | null;
  accessLevel?: string;
  isEncrypted?: boolean;
  encryptionAlgorithm?: string;
  encryptionKeyId?: string;
  encryptionHash?: string;
  isPeerReviewed?: boolean;
  isShort?: boolean;
  isApproved?: boolean;
  isSupabaseStored?: boolean;
  supabasePath?: string | null;
  supabaseBucket?: string | null;
  supabaseUrl?: string | null;
  videoData?: string | null;
  mimeType?: string;
  fileSize?: number;
}): Promise<{ success: boolean; video: VideoRecord; mode: 'server' | 'local' }> {
  const cleanPayload = {
    ...payload,
    title: payload.title.trim(),
    description: (payload.description || `Educational video lecture: ${payload.title}`).trim(),
    videoUrl: payload.videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: payload.thumbnailUrl || payload.previewUrl || 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800',
    previewUrl: payload.previewUrl || payload.thumbnailUrl,
    duration: payload.duration || '15:00',
    durationSec: payload.durationSec || 900,
    category: payload.category || 'Science & Technology',
    educatorId: payload.educatorId || 'admin-portal',
    educatorName: payload.educatorName || 'Verified Educator',
    accessLevel: payload.accessLevel || 'public',
    isApproved: payload.isApproved !== undefined ? payload.isApproved : true,
  };

  // 1. Try sending to Express / Cloud SQL backend
  const res = await safeFetchJson<VideoRecord>('/api/videos/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanPayload),
  });

  if (res.ok && res.data) {
    saveLocalVideo(res.data);
    return { success: true, video: res.data, mode: 'server' };
  }

  // 2. If backend returns 404 (e.g. running statically on Vercel) or server error,
  // save into LocalStorage & optionally Supabase directly
  const localVideo: VideoRecord = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    title: cleanPayload.title,
    description: cleanPayload.description,
    videoUrl: cleanPayload.videoUrl,
    thumbnailUrl: cleanPayload.thumbnailUrl,
    previewUrl: cleanPayload.previewUrl,
    duration: cleanPayload.duration,
    durationSec: cleanPayload.durationSec,
    category: cleanPayload.category,
    tags: typeof cleanPayload.tags === 'string' ? cleanPayload.tags : JSON.stringify(cleanPayload.tags || []),
    educatorId: cleanPayload.educatorId,
    educatorName: cleanPayload.educatorName,
    educatorAvatar: cleanPayload.educatorAvatar || null,
    views: 0,
    likes: 0,
    dislikes: 0,
    accessLevel: cleanPayload.accessLevel,
    isEncrypted: !!cleanPayload.isEncrypted,
    encryptionAlgorithm: cleanPayload.encryptionAlgorithm || 'AES-256-GCM',
    encryptionKeyId: cleanPayload.encryptionKeyId,
    encryptionHash: cleanPayload.encryptionHash,
    isPeerReviewed: !!cleanPayload.isPeerReviewed,
    isApproved: cleanPayload.isApproved,
    isRemoved: false,
    isShort: !!cleanPayload.isShort,
    isSupabaseStored: !!cleanPayload.isSupabaseStored,
    supabasePath: cleanPayload.supabasePath || null,
    supabaseBucket: cleanPayload.supabaseBucket || null,
    supabaseUrl: cleanPayload.supabaseUrl || null,
    createdAt: new Date().toISOString(),
  };

  // Save to browser storage
  saveLocalVideo(localVideo);

  // Optional: Also attempt Supabase insert if Supabase client is configured
  try {
    await insertVideoToSupabase({
      title: localVideo.title,
      description: localVideo.description,
      video_url: localVideo.videoUrl,
      thumbnail_url: localVideo.thumbnailUrl,
      duration: localVideo.duration,
      duration_sec: localVideo.durationSec,
      category: localVideo.category,
      educator_id: localVideo.educatorId,
      educator_name: localVideo.educatorName,
      is_short: localVideo.isShort,
      is_supabase_stored: localVideo.isSupabaseStored,
      supabase_path: localVideo.supabasePath || undefined,
      supabase_bucket: localVideo.supabaseBucket || undefined,
    });
  } catch {
    // Supabase optional fallback
  }

  return { success: true, video: localVideo, mode: 'local' };
}

/**
 * Remove / Delete Video with dual mode
 */
export async function removeVideoItem(videoId: number): Promise<boolean> {
  deleteLocalVideo(videoId);
  try {
    const res = await safeFetchJson(`/api/videos/${videoId}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return true;
  }
}
