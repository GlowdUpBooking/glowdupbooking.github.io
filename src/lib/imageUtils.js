// src/lib/imageUtils.js
// Client-side image compression using the native Canvas API (no external deps).

const MAX_W = 1920;
const MAX_H = 1920;
const QUALITY = 0.82;          // JPEG quality — keeps portraits ~160–400 KB
const SKIP_BELOW = 200 * 1024; // Skip re-encoding if file is already < 200 KB

/**
 * Compress an image File to a JPEG at up to 1920×1920 px.
 *
 * - Files already under 200 KB are returned as-is.
 * - If the encoded output ends up larger than the original, the original is returned.
 * - On any error, the original file is returned (never silently drops the photo).
 *
 * @param {File} file - The image file to compress.
 * @param {{ maxWidth?: number, maxHeight?: number, quality?: number }} [opts]
 * @returns {Promise<File>}
 */
export async function compressImage(
  file,
  { maxWidth = MAX_W, maxHeight = MAX_H, quality = QUALITY } = {}
) {
  if (file.size <= SKIP_BELOW) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Scale down to fit inside maxWidth × maxHeight, preserving aspect ratio.
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          // No gain from compression — return the original.
          if (!blob || blob.size >= file.size) { resolve(file); return; }

          const stem = file.name.replace(/\.[^.]+$/, "") || "photo";
          resolve(new File([blob], `${stem}.jpg`, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback: upload the original
    };

    img.src = url;
  });
}
