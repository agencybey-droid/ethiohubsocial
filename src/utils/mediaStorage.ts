// Robust IndexedDB video blob storage to persist actual video files permanently in the browser
// This ensures uploaded videos NEVER expire or fail to play when navigating away and back.

const DB_NAME = 'EthioHubMediaDB';
const DB_VERSION = 1;
const STORE_NAME = 'video_blobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in non-browser environment'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event: any) => {
        resolve(event.target.result as IDBDatabase);
      };

      request.onerror = (event: any) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  return dbPromise;
}

// In-memory active object URLs cache to avoid multiple redundant createObjectURL calls
const activeObjectUrls = new Map<number | string, string>();

/**
 * Save an uploaded Video File / Blob permanently into IndexedDB
 */
export async function saveVideoBlob(id: number | string, blob: Blob): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ id, blob, updatedAt: Date.now() });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Revoke old active URL if any and cache new URL
    if (activeObjectUrls.has(id)) {
      try {
        URL.revokeObjectURL(activeObjectUrls.get(id)!);
      } catch {}
    }
    const freshUrl = URL.createObjectURL(blob);
    activeObjectUrls.set(id, freshUrl);
  } catch (err) {
    console.warn('Failed to save video to IndexedDB:', err);
  }
}

/**
 * Retrieve a stored video Blob from IndexedDB
 */
export async function getVideoBlob(id: number | string): Promise<Blob | null> {
  try {
    const db = await getDB();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(req.result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get video from IndexedDB:', err);
    return null;
  }
}

/**
 * Get a valid, playable URL for the video.
 * If the video is stored in IndexedDB, it creates or returns an active Object URL.
 * If not, it returns the provided fallback URL.
 */
export async function resolvePlayableVideoUrl(id: number | string, fallbackUrl: string): Promise<string> {
  // If we already have an active live object URL in memory, use it
  if (activeObjectUrls.has(id)) {
    return activeObjectUrls.get(id)!;
  }

  // Try fetching blob from IndexedDB
  const blob = await getVideoBlob(id);
  if (blob) {
    const newUrl = URL.createObjectURL(blob);
    activeObjectUrls.set(id, newUrl);
    return newUrl;
  }

  return fallbackUrl;
}

/**
 * Delete a stored video blob from IndexedDB
 */
export async function deleteVideoBlob(id: number | string): Promise<void> {
  try {
    if (activeObjectUrls.has(id)) {
      try {
        URL.revokeObjectURL(activeObjectUrls.get(id)!);
      } catch {}
      activeObjectUrls.delete(id);
    }

    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete video blob from IndexedDB:', err);
  }
}
