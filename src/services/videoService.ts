// Resilient video service providing seamless dual-mode support:
// 1. Direct Cloud SQL & Express backend API (when running with full backend)
// 2. LocalStorage & Supabase fallback (when hosted statically e.g. Vercel without backend env vars)

import { uploadVideoFileToSupabase, insertVideoToSupabase } from '../lib/supabase.ts';
import {
  saveVideoBlob,
  getVideoBlob,
  resolvePlayableVideoUrl,
  deleteVideoBlob,
} from '../utils/mediaStorage.ts';

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
    educatorId: 'student-demo-uid',
    educatorName: 'Alex Rivers (Student)',
    educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
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
    educatorId: 'student-demo-uid',
    educatorName: 'Alex Rivers (Student)',
    educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
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
    educatorId: 'student-demo-uid',
    educatorName: 'Alex Rivers (Student)',
    educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
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
    educatorId: 'student-demo-uid',
    educatorName: 'Alex Rivers (Student)',
    educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
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
    educatorId: 'student-demo-uid',
    educatorName: 'Alex Rivers (Student)',
    educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
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
    educatorId: 'student-demo-uid',
    educatorName: 'Alex Rivers (Student)',
    educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
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
    educatorId: 'student-demo-uid',
    educatorName: 'Alex Rivers (Student)',
    educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
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
    educatorId: 'student-demo-uid',
    educatorName: 'Alex Rivers (Student)',
    educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
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
    educatorId: 'student-demo-uid',
    educatorName: 'Alex Rivers (Student)',
    educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
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
    educatorId: 'student-demo-uid',
    educatorName: 'Alex Rivers (Student)',
    educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
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

const REMOVED_IDS_KEY = 'ethiohub_removed_video_ids_v2';
const DEMO_PLACEHOLDER_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Read removed video IDs to ensure deleted placeholders NEVER return
export function getRemovedVideoIds(): Set<number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(REMOVED_IDS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

// Mark a video as permanently removed by admin
export function markVideoRemoved(id: number): void {
  if (typeof window === 'undefined') return;
  try {
    const ids = getRemovedVideoIds();
    ids.add(id);
    localStorage.setItem(REMOVED_IDS_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

// Clear all demo/placeholder videos so the user has a 100% clean custom catalog
export async function clearAllPlaceholders(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      const ids = getRemovedVideoIds();
      DEMO_PLACEHOLDER_IDS.forEach((id) => ids.add(id));
      localStorage.setItem(REMOVED_IDS_KEY, JSON.stringify(Array.from(ids)));
    } catch {}
  }
  try {
    await safeFetchJson('/api/admin/clear-demo-placeholders', { method: 'POST' });
  } catch {}
}

// Restore default demo videos if user wants them back
export async function restorePlaceholders(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      const ids = getRemovedVideoIds();
      DEMO_PLACEHOLDER_IDS.forEach((id) => ids.delete(id));
      localStorage.setItem(REMOVED_IDS_KEY, JSON.stringify(Array.from(ids)));
    } catch {}
  }
  try {
    await safeFetchJson('/api/admin/restore-demo-placeholders', { method: 'POST' });
  } catch {}
}

// Increment video views persistently
export async function recordVideoView(videoId: number, currentViews: number = 0): Promise<number> {
  let newViews = currentViews + 1;

  if (typeof window !== 'undefined') {
    try {
      const localVideos = getLocalVideos();
      let found = false;
      const updated = localVideos.map((v) => {
        if (v.id === videoId) {
          found = true;
          const nextV = (v.views || currentViews || 0) + 1;
          newViews = nextV;
          return { ...v, views: nextV };
        }
        return v;
      });

      if (!found) {
        // Override views for seed item locally
        const seed = [...SEED_VIDEOS, ...SEED_SHORTS].find((v) => v.id === videoId);
        if (seed) {
          const nextV = (seed.views || currentViews || 0) + 1;
          newViews = nextV;
          updated.push({ ...seed, views: nextV });
        }
      }

      localStorage.setItem(LOCAL_VIDEOS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to update views in storage:', e);
    }
  }

  // Also sync with server if online
  try {
    const res = await safeFetchJson<{ success: boolean; views?: number }>(`/api/videos/${videoId}/view`, {
      method: 'POST',
    });
    if (res.ok && res.data && typeof res.data.views === 'number') {
      newViews = res.data.views;
    }
  } catch {}

  return newViews;
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

// Helper to convert Blob to base64 data string for database syncing
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

let syncInProgress = false;
let hasSynced = false;

/**
 * Automatically sync any videos stored locally in the browser into Cloud SQL PostgreSQL,
 * ensuring they are immediately available to all visitors across every device, phone, and browser.
 */
export async function syncLocalVideosToServer(): Promise<void> {
  if (typeof window === 'undefined' || syncInProgress || hasSynced) return;
  syncInProgress = true;
  try {
    const localVideos = getLocalVideos();
    if (!localVideos.length) {
      hasSynced = true;
      return;
    }

    // Normalise any local videos to Alex Rivers (Student)
    let needsLocalUpdate = false;
    const normalizedLocal = localVideos.map((v) => {
      if (v.educatorName !== 'Alex Rivers (Student)' || !v.educatorAvatar) {
        needsLocalUpdate = true;
        return {
          ...v,
          educatorName: 'Alex Rivers (Student)',
          educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          educatorId: 'student-demo-uid',
        };
      }
      return v;
    });

    if (needsLocalUpdate) {
      localStorage.setItem(LOCAL_VIDEOS_KEY, JSON.stringify(normalizedLocal));
    }

    const itemsToSync = [];
    for (const v of normalizedLocal) {
      let videoData: string | undefined;
      try {
        const blob = await getVideoBlob(v.id);
        if (blob) {
          videoData = await blobToBase64(blob);
        }
      } catch {}

      itemsToSync.push({
        id: v.id,
        title: v.title,
        description: v.description,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        previewUrl: v.previewUrl,
        duration: v.duration,
        durationSec: v.durationSec,
        category: v.category,
        tags: v.tags,
        educatorId: 'student-demo-uid',
        educatorName: 'Alex Rivers (Student)',
        educatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        isShort: !!v.isShort,
        isPeerReviewed: !!v.isPeerReviewed,
        isApproved: true,
        videoData,
      });
    }

    if (itemsToSync.length > 0) {
      await fetch('/api/videos/sync-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: itemsToSync }),
      });
    }
    hasSynced = true;
  } catch (err) {
    console.warn('Sync local videos to server encountered error:', err);
  } finally {
    syncInProgress = false;
  }
}

// Determines if a video should be kept in catalogs:
// Videos created by Alex Rivers (Student) are protected and displayed everywhere!
function shouldKeepVideo(v: VideoRecord, removedIds: Set<number>): boolean {
  if (v.isRemoved) return false;
  if (v.educatorName?.includes('Alex Rivers') || v.educatorId === 'student-demo-uid') {
    return true;
  }
  return !removedIds.has(v.id);
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
  syncLocalVideosToServer().catch(() => {});
  const removedIds = getRemovedVideoIds();
  const query = new URLSearchParams();
  if (params.sort) query.set('sort', params.sort);
  if (params.category && params.category !== 'All') query.set('category', params.category);
  if (params.search && params.search.trim()) query.set('search', params.search.trim());

  const localUploads = getLocalVideos().filter((v) => !v.isShort && shouldKeepVideo(v, removedIds));
  const result = await safeFetchJson<VideoRecord[]>(`/api/videos?${query.toString()}`);

  let baseList: VideoRecord[] = [];
  if (result.ok && Array.isArray(result.data)) {
    baseList = result.data.filter((v) => shouldKeepVideo(v, removedIds));
  } else {
    // Fallback to rich seed list if backend is offline or static Vercel deployment
    baseList = SEED_VIDEOS.filter((v) => shouldKeepVideo(v, removedIds));
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

  return [...filteredLocal, ...baseList].filter((v) => shouldKeepVideo(v, removedIds));
}

/**
 * Fetch shorts reels catalog with local storage merge and fallback
 */
export async function getShortsCatalog(): Promise<VideoRecord[]> {
  syncLocalVideosToServer().catch(() => {});
  const removedIds = getRemovedVideoIds();
  const localShorts = getLocalVideos().filter((v) => v.isShort && shouldKeepVideo(v, removedIds));
  const result = await safeFetchJson<VideoRecord[]>('/api/shorts');

  let baseList: VideoRecord[] = [];
  if (result.ok && Array.isArray(result.data)) {
    baseList = result.data.filter((v) => shouldKeepVideo(v, removedIds));
  } else {
    baseList = SEED_SHORTS.filter((v) => shouldKeepVideo(v, removedIds));
  }

  const existingIds = new Set(baseList.map((v) => v.id));
  const filteredLocal = localShorts.filter((v) => !existingIds.has(v.id));

  return [...filteredLocal, ...baseList].filter((v) => shouldKeepVideo(v, removedIds));
}

/**
 * Fetch all videos for Admin Management (including shorts and all categories)
 */
export async function getAdminVideosCatalog(): Promise<VideoRecord[]> {
  syncLocalVideosToServer().catch(() => {});
  const removedIds = getRemovedVideoIds();
  const localVideos = getLocalVideos().filter((v) => shouldKeepVideo(v, removedIds));
  const result = await safeFetchJson<VideoRecord[]>('/api/admin/videos');

  let baseList: VideoRecord[] = [];
  if (result.ok && Array.isArray(result.data)) {
    baseList = result.data.filter((v) => shouldKeepVideo(v, removedIds));
  } else {
    baseList = [...SEED_VIDEOS, ...SEED_SHORTS].filter((v) => shouldKeepVideo(v, removedIds));
  }

  const existingIds = new Set(baseList.map((v) => v.id));
  const filteredLocal = localVideos.filter((v) => !existingIds.has(v.id));

  return [...filteredLocal, ...baseList].filter((v) => shouldKeepVideo(v, removedIds));
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
  videoFile?: Blob | File;
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
    educatorId: payload.educatorId && payload.educatorId !== 'admin-portal' ? payload.educatorId : 'student-demo-uid',
    educatorName: 'Alex Rivers (Student)',
    educatorAvatar: payload.educatorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    accessLevel: payload.accessLevel || 'public',
    isApproved: payload.isApproved !== undefined ? payload.isApproved : true,
  };

  // 1. If an actual video file is provided, upload directly via multipart FormData
  // to ensure universal availability across ALL browsers and mobile devices!
  if (payload.videoFile) {
    try {
      const formData = new FormData();
      formData.append('video', payload.videoFile);
      if (cleanPayload.thumbnailUrl && cleanPayload.thumbnailUrl.startsWith('data:image/')) {
        formData.append('thumbnailData', cleanPayload.thumbnailUrl);
      } else {
        formData.append('thumbnailUrl', cleanPayload.thumbnailUrl);
      }
      formData.append('title', cleanPayload.title);
      formData.append('description', cleanPayload.description);
      formData.append('duration', cleanPayload.duration);
      formData.append('durationSec', cleanPayload.durationSec.toString());
      formData.append('category', cleanPayload.category);
      formData.append('tags', typeof cleanPayload.tags === 'string' ? cleanPayload.tags : JSON.stringify(cleanPayload.tags || []));
      formData.append('educatorId', cleanPayload.educatorId);
      formData.append('educatorName', cleanPayload.educatorName);
      formData.append('accessLevel', cleanPayload.accessLevel);
      formData.append('isShort', cleanPayload.isShort ? 'true' : 'false');
      formData.append('isPeerReviewed', cleanPayload.isPeerReviewed ? 'true' : 'false');
      formData.append('autoApprove', cleanPayload.isApproved ? 'true' : 'false');

      const uploadRes = await fetch('/api/videos/upload-file', {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const serverVideo = await uploadRes.json();
        if (serverVideo && serverVideo.id) {
          await saveVideoBlob(serverVideo.id, payload.videoFile);
          saveLocalVideo(serverVideo);
          return { success: true, video: serverVideo, mode: 'server' };
        }
      }
    } catch (err) {
      console.warn('Direct server multipart upload failed, attempting JSON fallback:', err);
    }
  }

  // 2. Try sending JSON to Express / Cloud SQL backend
  const res = await safeFetchJson<VideoRecord>('/api/videos/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanPayload),
  });

  if (res.ok && res.data) {
    if (payload.videoFile) {
      await saveVideoBlob(res.data.id, payload.videoFile);
    }
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

  if (payload.videoFile) {
    await saveVideoBlob(localVideo.id, payload.videoFile);
  }

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
 * Remove / Delete Video with dual mode and persistent blob cleanup
 */
export async function removeVideoItem(videoId: number): Promise<boolean> {
  markVideoRemoved(videoId);
  deleteLocalVideo(videoId);
  try {
    await deleteVideoBlob(videoId);
  } catch {}
  try {
    const res = await safeFetchJson(`/api/videos/${videoId}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return true;
  }
}
