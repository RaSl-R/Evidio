/**
 * Image processing utilities for client-side compression and normalization.
 *
 * Requirements:
 * 1. Decode with createImageBitmap(file, { imageOrientation: 'from-image' })
 * 2. Scale so the longest edge is max 1600 px
 * 3. Encode to WebP 82% (with JPEG 82% fallback)
 * 4. Return Blob, file_name, mime_type, size_bytes
 * 5. Handle decode errors gracefully with Czech error message
 */

export interface ProcessedImage {
  blob: Blob;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}

export function calculateScaledDimensions(
  width: number,
  height: number,
  maxLongestEdge = 1600
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height) };
  }

  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxLongestEdge) {
    return { width, height };
  }

  const scale = maxLongestEdge / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Decodes an image file, scales it to max 1600px on the longest edge,
 * and encodes it as WebP 82% (or JPEG 82% fallback).
 */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  let bitmap: ImageBitmap;

  try {
    try {
      // Decode with orientation correction
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fallback if imageOrientation option is unsupported
      bitmap = await createImageBitmap(file);
    }
  } catch (err: any) {
    throw new Error(
      `Soubor „${file.name}“ se nepodařilo načíst jako obrázek: ${err?.message || 'Neplatný formát'}`
    );
  }

  try {
    const { width, height } = calculateScaledDimensions(bitmap.width, bitmap.height, 1600);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(`Nepodařilo se vytvořit kontext pro vykreslení obrázku „${file.name}“.`);
    }

    ctx.drawImage(bitmap, 0, 0, width, height);

    // Try WebP 82% first
    const getBlob = (mime: string, quality: number): Promise<Blob | null> => {
      return new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), mime, quality);
      });
    };

    let blob = await getBlob('image/webp', 0.82);
    let mimeType = 'image/webp';
    let ext = '.webp';

    // If WebP is not supported or was coerced to image/png, fallback to JPEG 82%
    if (!blob || blob.type !== 'image/webp') {
      blob = await getBlob('image/jpeg', 0.82);
      mimeType = 'image/jpeg';
      ext = '.jpg';
    }

    if (!blob) {
      throw new Error(`Nepodařilo se zkomprimovat obrázek „${file.name}“.`);
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const finalFileName = `${baseName || 'fotografie'}${ext}`;

    return {
      blob,
      file_name: finalFileName,
      mime_type: mimeType,
      size_bytes: blob.size,
    };
  } finally {
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }
  }
}
