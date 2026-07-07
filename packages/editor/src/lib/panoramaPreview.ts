const MAX_PREVIEW_WIDTH = 4096;
const PREVIEW_JPEG_QUALITY = 0.85;

export async function panoramaPreviewUrl(blob: Blob): Promise<string> {
  try {
    const bitmap = await createImageBitmap(blob);
    if (bitmap.width <= MAX_PREVIEW_WIDTH) {
      bitmap.close();
      return URL.createObjectURL(blob);
    }
    const scale = MAX_PREVIEW_WIDTH / bitmap.width;
    const width = MAX_PREVIEW_WIDTH;
    const height = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return URL.createObjectURL(blob);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const preview = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: PREVIEW_JPEG_QUALITY,
    });
    return URL.createObjectURL(preview);
  } catch {
    return URL.createObjectURL(blob);
  }
}
