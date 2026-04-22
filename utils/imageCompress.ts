const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.75;

/** Vercel serverless body limit is 4.5MB. Keep raw file under this so base64 + JSON stays under limit. */
export const MAX_UPLOAD_FILE_BYTES = 3 * 1024 * 1024; // 3 MB

/** Max base64 length so JSON body stays under 4.5MB (base64 + wrapper). */
const MAX_BASE64_LENGTH = Math.floor((4.5 * 1024 * 1024 - 1024) * 3 / 4);

export const FILE_TOO_LARGE_MESSAGE =
  'File too large. Please use files under 3 MB (deployed version has a 4.5 MB request limit).';

function checkFileSize(file: File): void {
  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    throw new Error(FILE_TOO_LARGE_MESSAGE);
  }
}

/**
 * Compress image via Canvas. Returns base64 data URL.
 * Skips non-image files (e.g. PDF). Enforces max file size for deploy (e.g. Vercel 4.5MB body limit).
 */
export async function compressImage(
  file: File,
  options?: { maxDimension?: number; quality?: number }
): Promise<{ base64: string; mimeType: string }> {
  checkFileSize(file);

  const mime = file.type || '';
  if (mime === 'application/pdf') {
    const base64 = await fileToBase64(file);
    return { base64, mimeType: mime };
  }
  if (!mime.startsWith('image/')) {
    const base64 = await fileToBase64(file);
    return { base64, mimeType: mime || 'image/png' };
  }

  const largeFileThreshold = 1024 * 1024; // 1 MB
  const useStrongCompression = file.size > largeFileThreshold;
  const maxDim = options?.maxDimension ?? (useStrongCompression ? 1280 : MAX_DIMENSION);
  const quality = options?.quality ?? (useStrongCompression ? 0.65 : JPEG_QUALITY);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const outputMime = mime === 'image/png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(outputMime, outputMime === 'image/jpeg' ? quality : undefined);
      let base64 = dataUrl.split(',')[1] || '';
      if (base64.length > MAX_BASE64_LENGTH) {
        reject(new Error(FILE_TOO_LARGE_MESSAGE));
        return;
      }
      resolve({ base64, mimeType: outputMime });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
