/**
 * Local-First Photo Storage Engine (IndexedDB + In-Memory Cache) — Super Diet-Ability
 *
 * Implements:
 * - Local-first persistence in IndexedDB (strictly outside localStorage to prevent quota exhaustion).
 * - Client-side image resizing and compression (max dimension ~1280px, quality 0.82 JPEG).
 * - Synchronous and asynchronous read APIs with in-memory caching for instant UI render.
 * - Safe fallback for Node/headless test environments without browser IndexedDB.
 * - Orphan cleanup and deletion helpers.
 */

export interface FoodPhotoMetadata {
  id: string;
  createdAt: string;
  mimeType?: string;
}

export interface StoredPhotoRecord {
  id: string;
  dataUrl: string;
  mimeType: string;
  createdAt: string;
  width: number;
  height: number;
}

const DB_NAME = 'resume-ability-photos-db';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

// In-memory cache for synchronous instant thumbnail lookups
const photoMemoryCache = new Map<string, string>();

/**
 * Open or upgrade the IndexedDB database.
 */
function openPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Resize and compress an image client-side via HTML Canvas.
 * Caps maximum dimension to 1280px while preserving aspect ratio.
 */
export async function processAndCompressImage(
  file: File | Blob,
  maxDimension = 1280,
  quality = 0.82
): Promise<{ dataUrl: string; mimeType: string; width: number; height: number }> {
  // Reject non-image files
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image');
  }

  // Fallback for Node/test environments
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      dataUrl: 'data:image/jpeg;base64,mockImageBytes',
      mimeType: 'image/jpeg',
      width: 400,
      height: 300,
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width <= 0 || height <= 0) {
          return reject(new Error('Invalid image dimensions'));
        }

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          // Fallback to raw data url if 2d context unavailable
          return resolve({
            dataUrl: rawDataUrl,
            mimeType: file.type || 'image/jpeg',
            width,
            height,
          });
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        resolve({
          dataUrl: compressedDataUrl,
          mimeType: 'image/jpeg',
          width,
          height,
        });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Save a new food photo from a user-selected File or Blob.
 * Stores compressed image in IndexedDB and updates memory cache.
 */
export async function saveFoodPhoto(file: File | Blob): Promise<FoodPhotoMetadata> {
  const { dataUrl, mimeType, width, height } = await processAndCompressImage(file);
  const id = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();

  const record: StoredPhotoRecord = {
    id,
    dataUrl,
    mimeType,
    createdAt,
    width,
    height,
  };

  // Update in-memory cache immediately
  photoMemoryCache.set(id, dataUrl);

  // Persist to IndexedDB if available
  try {
    const db = await openPhotoDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not persist photo to IndexedDB, cached in-memory only:', err);
  }

  return { id, createdAt, mimeType };
}

/**
 * Synchronous read from in-memory cache (for instant rendering in card loops).
 */
export function getPhotoDataUrlSync(id: string): string | null {
  return photoMemoryCache.get(id) ?? null;
}

/**
 * Retrieve a stored photo by ID, checking in-memory cache first, then IndexedDB.
 */
export async function getFoodPhoto(id: string): Promise<StoredPhotoRecord | null> {
  const cachedUrl = photoMemoryCache.get(id);

  try {
    const db = await openPhotoDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        const result = req.result as StoredPhotoRecord | undefined;
        if (result?.dataUrl) {
          photoMemoryCache.set(id, result.dataUrl);
          resolve(result);
        } else if (cachedUrl) {
          resolve({
            id,
            dataUrl: cachedUrl,
            mimeType: 'image/jpeg',
            createdAt: new Date().toISOString(),
            width: 400,
            height: 300,
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        resolve(cachedUrl ? {
          id,
          dataUrl: cachedUrl,
          mimeType: 'image/jpeg',
          createdAt: new Date().toISOString(),
          width: 400,
          height: 300,
        } : null);
      };
    });
  } catch {
    if (cachedUrl) {
      return {
        id,
        dataUrl: cachedUrl,
        mimeType: 'image/jpeg',
        createdAt: new Date().toISOString(),
        width: 400,
        height: 300,
      };
    }
    return null;
  }
}

/**
 * Delete a photo attachment from IndexedDB and memory cache.
 */
export async function deleteFoodPhoto(id: string): Promise<void> {
  photoMemoryCache.delete(id);

  try {
    const db = await openPhotoDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}

/**
 * Preload photos into memory cache for a list of photo IDs.
 */
export async function preloadPhotos(ids: string[]): Promise<void> {
  const missing = ids.filter(id => Boolean(id) && !photoMemoryCache.has(id));
  if (missing.length === 0) return;

  try {
    const db = await openPhotoDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      let pending = missing.length;
      for (const id of missing) {
        const req = store.get(id);
        req.onsuccess = () => {
          const result = req.result as StoredPhotoRecord | undefined;
          if (result?.dataUrl) {
            photoMemoryCache.set(id, result.dataUrl);
          }
          pending--;
          if (pending === 0) resolve();
        };
        req.onerror = () => {
          pending--;
          if (pending === 0) resolve();
        };
      }
    });
  } catch {
    // ignore
  }
}

/**
 * Delete any photos in IndexedDB that are not in the set of active photo IDs.
 */
export async function cleanupOrphanPhotos(activePhotoIds: Set<string>): Promise<number> {
  try {
    const db = await openPhotoDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();

      req.onsuccess = () => {
        const keys = (req.result as string[]) || [];
        let deleted = 0;
        for (const key of keys) {
          if (!activePhotoIds.has(key)) {
            store.delete(key);
            photoMemoryCache.delete(key);
            deleted++;
          }
        }
        resolve(deleted);
      };
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * Check if a photo ID is referenced by any block in the given diet store profiles or verifications.
 */
export function isPhotoReferenced(
  photoId: string,
  store?: {
    profiles?: Array<{
      diet: {
        days:
          | Array<{ blocks: Array<{ foodPhoto?: { id: string } }> }>
          | Record<string, { blocks: Array<{ foodPhoto?: { id: string } }> }>;
        historySnapshots?: Record<string, { blocks: Array<{ foodPhoto?: { id: string } }> }>;
      };
    }>;
  },
  verifications?: Record<string, { entries: Array<{ plannedSnapshot?: { foodPhoto?: { id: string } } }> }>
): boolean {
  if (!photoId) return false;

  if (store?.profiles) {
    for (const profile of store.profiles) {
      if (profile?.diet?.days) {
        const dayList = Array.isArray(profile.diet.days) ? profile.diet.days : Object.values(profile.diet.days);
        for (const day of dayList) {
          if (day?.blocks?.some(b => b.foodPhoto?.id === photoId)) {
            return true;
          }
        }
      }
      if (profile?.diet?.historySnapshots) {
        for (const snap of Object.values(profile.diet.historySnapshots)) {
          if (snap?.blocks?.some(b => b.foodPhoto?.id === photoId)) {
            return true;
          }
        }
      }
    }
  }

  if (verifications) {
    for (const dailyVerif of Object.values(verifications)) {
      if (dailyVerif?.entries?.some(e => e.plannedSnapshot?.foodPhoto?.id === photoId)) {
        return true;
      }
    }
  }

  return false;
}
