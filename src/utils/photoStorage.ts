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

export const SUPPORTED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
  '.gif',
  '.avif',
  '.bmp',
] as const;

export type PhotoErrorCode =
  | 'not_image'
  | 'unsupported_format'
  | 'too_large'
  | 'decode_failed'
  | 'canvas_failed'
  | 'storage_failed';

export class PhotoProcessingError extends Error {
  readonly code: PhotoErrorCode;
  constructor(code: PhotoErrorCode, message?: string) {
    super(message || code);
    this.name = 'PhotoProcessingError';
    this.code = code;
  }
}

/**
 * Check if a file is an HEIC/HEIF photo.
 */
export function isHeicFile(file: File | Blob): boolean {
  if (!file) return false;
  if (file.type === 'image/heic' || file.type === 'image/heif') return true;
  if ('name' in file && typeof file.name === 'string') {
    const lower = file.name.toLowerCase();
    return lower.endsWith('.heic') || lower.endsWith('.heif');
  }
  return false;
}

/**
 * Robust image validation for Android Gallery and file pickers.
 * Accepts files if:
 * 1. MIME type is an image/* type, OR
 * 2. MIME is empty / generic octet-stream (common in Android SAF) AND filename has a supported image extension.
 * Rejects non-images (e.g. .txt, .pdf, audio/video).
 */
export function isValidImageFile(file: File | Blob): boolean {
  if (!file) return false;

  // 1. Valid image MIME
  if (file.type && file.type.startsWith('image/')) {
    return true;
  }

  // 2. Explicit non-image MIME -> reject immediately
  if (
    file.type &&
    file.type !== 'application/octet-stream' &&
    file.type !== 'binary/octet-stream' &&
    !file.type.startsWith('image/')
  ) {
    return false;
  }

  // 3. Android Gallery / SAF missing or generic MIME -> inspect extension
  if ('name' in file && typeof file.name === 'string' && file.name.trim().length > 0) {
    const lower = file.name.toLowerCase();
    return SUPPORTED_IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
  }

  return false;
}

/**
 * Resolve localized user-facing error message from photo error.
 */
export function getLocalizedPhotoErrorMessage(
  err: unknown,
  translations: {
    sdb_err_invalid_image: string;
    sdb_err_unsupported_format: string;
    sdb_err_photo_too_large: string;
    sdb_err_process_photo: string;
    sdb_err_save_photo: string;
  }
): string {
  if (err instanceof PhotoProcessingError) {
    switch (err.code) {
      case 'not_image':
        return translations.sdb_err_invalid_image;
      case 'unsupported_format':
        return translations.sdb_err_unsupported_format;
      case 'too_large':
        return translations.sdb_err_photo_too_large;
      case 'decode_failed':
      case 'canvas_failed':
        return translations.sdb_err_process_photo;
      case 'storage_failed':
        return translations.sdb_err_save_photo;
      default:
        return translations.sdb_err_process_photo;
    }
  }
  return translations.sdb_err_process_photo;
}

/**
 * Check if the first bytes of a Blob/File match an HEIF/HEIC container box.
 */
export async function isHeicBlobByHeader(file: File | Blob): Promise<boolean> {
  try {
    if (!file || typeof file.slice !== 'function' || file.size < 12) return false;
    const slice = file.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // bytes 4-7 must be 'ftyp' (0x66, 0x74, 0x79, 0x70)
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
      return ['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1', 'hevc'].includes(brand);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Convert HEIC / HEIF image blob to JPEG blob client-side using dynamic on-demand import.
 * This ensures normal JPEG/PNG/WebP uploads never incur bundle size or processing overhead.
 */
export async function convertHeicToJpegBlob(file: File | Blob): Promise<Blob> {
  // Test / Node environments without browser DOM
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    if ((file as any).__simulateConversionFailure) {
      throw new PhotoProcessingError(
        'unsupported_format',
        "We couldn't process this photo. Please try another photo."
      );
    }
    return new Blob(['mock-converted-jpeg-data'], { type: 'image/jpeg' });
  }

  try {
    const heic2anyModule = await import('heic2any');
    const heic2any = heic2anyModule.default || (heic2anyModule as any);
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });
    return Array.isArray(converted) ? converted[0] : converted;
  } catch (conversionErr) {
    console.warn('Client-side HEIC conversion failed:', conversionErr);
    throw new PhotoProcessingError(
      'unsupported_format',
      "We couldn't process this photo. Please try another photo."
    );
  }
}

/**
 * Safe object URL decode fallback with guaranteed revocation.
 */
function decodeViaImageElement(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return reject(new PhotoProcessingError('decode_failed', 'URL.createObjectURL not available'));
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new PhotoProcessingError('decode_failed', 'Failed to decode image'));
    };
    img.src = url;
  });
}

/**
 * Resize and compress an image client-side via HTML Canvas using binary/blob APIs.
 * Avoids giant Base64 strings from FileReader.readAsDataURL.
 * Downscales to approximately 1440px while preserving aspect ratio.
 */
export async function processAndCompressImage(
  file: File | Blob,
  maxDimension = 1440,
  quality = 0.82
): Promise<{ dataUrl: string; mimeType: string; width: number; height: number }> {
  // Reject non-image files
  if (!isValidImageFile(file)) {
    throw new PhotoProcessingError('not_image', 'Selected file is not an image');
  }

  // Safety upper limit: 35 MB
  const MAX_FILE_SIZE_BYTES = 35 * 1024 * 1024;
  if (file.size && file.size > MAX_FILE_SIZE_BYTES) {
    throw new PhotoProcessingError('too_large', 'Photo is too large to process');
  }

  // Fallback for Node/test environments without browser DOM
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof document.createElement !== 'function') {
    if (isHeicFile(file) && ((file as any).__simulateConversionFailure || (file as any).__simulateUnsupportedHeic)) {
      throw new PhotoProcessingError('unsupported_format', "We couldn't process this photo. Please try another photo.");
    }
    const mockW = (file as any).__mockWidth || 400;
    const mockH = (file as any).__mockHeight || 300;
    let finalW = mockW;
    let finalH = mockH;
    if (finalW > maxDimension || finalH > maxDimension) {
      if (finalW > finalH) {
        finalH = Math.round((finalH * maxDimension) / finalW);
        finalW = maxDimension;
      } else {
        finalW = Math.round((finalW * maxDimension) / finalH);
        finalH = maxDimension;
      }
    }
    return {
      dataUrl: 'data:image/jpeg;base64,mockImageBytes',
      mimeType: 'image/jpeg',
      width: finalW,
      height: finalH,
    };
  }

  // 1. Attempt native browser decoding via createImageBitmap
  let source: ImageBitmap | HTMLImageElement | null = null;
  let isBitmap = false;

  if (typeof createImageBitmap === 'function') {
    try {
      source = await createImageBitmap(file, { imageOrientation: 'from-image' });
      isBitmap = true;
    } catch {
      try {
        source = await createImageBitmap(file);
        isBitmap = true;
      } catch (err) {
        console.warn('createImageBitmap failed, falling back to object URL:', err);
      }
    }
  }

  // Fallback to URL.createObjectURL + HTMLImageElement
  if (!source) {
    try {
      source = await decodeViaImageElement(file);
      isBitmap = false;
    } catch {
      // Native decoding failed; proceed to check HEIC conversion
    }
  }

  // 2. If native decoding failed, check if image is HEIC/HEIF and convert client-side
  if (!source) {
    const isHeic = isHeicFile(file) || (await isHeicBlobByHeader(file));
    if (isHeic) {
      console.info('Native HEIC decoding not supported by browser. Converting client-side...');
      try {
        const convertedBlob = await convertHeicToJpegBlob(file);
        if (typeof createImageBitmap === 'function') {
          try {
            source = await createImageBitmap(convertedBlob, { imageOrientation: 'from-image' });
            isBitmap = true;
          } catch {
            source = await createImageBitmap(convertedBlob);
            isBitmap = true;
          }
        }
        if (!source) {
          source = await decodeViaImageElement(convertedBlob);
          isBitmap = false;
        }
      } catch (convErr) {
        console.warn('Client-side HEIC conversion failed:', convErr);
        throw new PhotoProcessingError(
          'unsupported_format',
          "We couldn't process this photo. Please try another photo."
        );
      }
    }
  }

  // 3. If decoding still failed after all strategies, fail gracefully
  if (!source) {
    throw new PhotoProcessingError('decode_failed', 'Failed to decode image');
  }

  try {
    let width = source.width;
    let height = source.height;

    if (width <= 0 || height <= 0) {
      throw new PhotoProcessingError('decode_failed', 'Invalid image dimensions');
    }

    // Preserve aspect ratio
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
      throw new PhotoProcessingError('canvas_failed', 'Could not get canvas 2d context');
    }

    ctx.drawImage(source, 0, 0, width, height);
    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

    return {
      dataUrl: compressedDataUrl,
      mimeType: 'image/jpeg',
      width,
      height,
    };
  } finally {
    if (isBitmap && source && 'close' in source && typeof source.close === 'function') {
      source.close();
    }
  }
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
  } catch (err: any) {
    console.warn('Could not persist photo to IndexedDB, cached in-memory only:', err);
    if (err?.name === 'QuotaExceededError') {
      throw new PhotoProcessingError('storage_failed', 'Storage quota exceeded');
    }
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
          | Array<{ blocks: Array<{ foodPhoto?: { id: string }; foodPhotos?: Array<{ id: string }> }> }>
          | Record<string, { blocks: Array<{ foodPhoto?: { id: string }; foodPhotos?: Array<{ id: string }> }> }>;
        historySnapshots?: Record<string, { blocks: Array<{ foodPhoto?: { id: string }; foodPhotos?: Array<{ id: string }> }> }>;
      };
    }>;
  },
  verifications?: Record<string, { entries: Array<{ foodPhoto?: { id: string }; foodPhotos?: Array<{ id: string }>; plannedSnapshot?: { foodPhoto?: { id: string }; foodPhotos?: Array<{ id: string }> } }> }>
): boolean {
  if (!photoId) return false;

  if (store?.profiles) {
    for (const profile of store.profiles) {
      if (profile?.diet?.days) {
        const dayList = Array.isArray(profile.diet.days) ? profile.diet.days : Object.values(profile.diet.days);
        for (const day of dayList) {
          if (day?.blocks?.some(b => b.foodPhoto?.id === photoId || b.foodPhotos?.some(p => p.id === photoId))) {
            return true;
          }
        }
      }
      if (profile?.diet?.historySnapshots) {
        for (const snap of Object.values(profile.diet.historySnapshots)) {
          if (snap?.blocks?.some(b => b.foodPhoto?.id === photoId || b.foodPhotos?.some(p => p.id === photoId))) {
            return true;
          }
        }
      }
    }
  }

  if (verifications) {
    for (const dailyVerif of Object.values(verifications)) {
      if (
        dailyVerif?.entries?.some(
          e =>
            e.foodPhoto?.id === photoId ||
            e.foodPhotos?.some(p => p.id === photoId) ||
            e.plannedSnapshot?.foodPhoto?.id === photoId ||
            e.plannedSnapshot?.foodPhotos?.some(p => p.id === photoId)
        )
      ) {
        return true;
      }
    }
  }

  return false;
}
