import sharp from "sharp";

type WatermarkOptions = {
  line1: string;
  line2: string;
};

export type CameraImageProcessingResult = {
  originalBuffer: Buffer;
  previewBuffer: Buffer;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildWatermarkSvg(width: number, height: number, options: WatermarkOptions) {
  const safeWidth = Math.max(width, 720);
  const safeHeight = Math.max(height, 720);

  const paddingX = Math.max(20, Math.round(safeWidth * 0.03));
  const paddingY = Math.max(18, Math.round(safeHeight * 0.026));
  const line1Size = Math.max(30, Math.round(safeWidth * 0.043));
  const line2Size = Math.max(20, Math.round(safeWidth * 0.028));
  const lineGap = Math.max(8, Math.round(safeWidth * 0.01));
  const boxHeight = paddingY * 2 + line1Size + line2Size + lineGap;
  const boxWidth = Math.round(safeWidth * 0.78);
  const boxY = safeHeight - boxHeight - paddingY;

  const line1Y = boxY + paddingY + line1Size;
  const line2Y = line1Y + lineGap + line2Size;

  const line1 = escapeXml(options.line1);
  const line2 = escapeXml(options.line2);

  return `
<svg width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wmFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.25)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.62)" />
    </linearGradient>
  </defs>
  <rect x="${paddingX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="${Math.round(
    paddingY * 0.8,
  )}" fill="url(#wmFade)" />
  <text x="${paddingX + paddingX}" y="${line1Y}" fill="rgba(255,255,255,0.98)" font-size="${line1Size}" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="0.4">${line1}</text>
  <text x="${paddingX + paddingX}" y="${line2Y}" fill="rgba(255,255,255,0.88)" font-size="${line2Size}" font-family="Arial, Helvetica, sans-serif" font-weight="500" letter-spacing="0.2">${line2}</text>
</svg>`;
}

export async function processCameraImage(
  sourceBuffer: Buffer,
  options: WatermarkOptions,
): Promise<CameraImageProcessingResult> {
  const meta = await sharp(sourceBuffer).rotate().metadata();
  const width = meta.width ?? 1200;
  const height = meta.height ?? 1600;

  const watermarkSvg = buildWatermarkSvg(width, height, options);
  const watermarkedOriginal = await sharp(sourceBuffer)
    .rotate()
    .composite([{ input: Buffer.from(watermarkSvg), top: 0, left: 0 }])
    .jpeg({ quality: 94, mozjpeg: true })
    .toBuffer();

  const previewMaxWidth = 1280;
  const watermarkedPreview = await sharp(watermarkedOriginal)
    .resize({ width: previewMaxWidth, withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();

  const outputMeta = await sharp(watermarkedOriginal).metadata();

  return {
    originalBuffer: watermarkedOriginal,
    previewBuffer: watermarkedPreview,
    mimeType: "image/jpeg",
    extension: "jpg",
    width: outputMeta.width ?? width,
    height: outputMeta.height ?? height,
  };
}
