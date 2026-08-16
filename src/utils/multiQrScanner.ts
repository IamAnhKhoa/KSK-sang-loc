import { Html5Qrcode } from 'html5-qrcode';
import { 
  MultiFormatReader, 
  RGBLuminanceSource, 
  BinaryBitmap, 
  HybridBinarizer, 
  GlobalHistogramBinarizer 
} from '@zxing/library';
import jsQR from 'jsqr';

/**
 * Multi-Engine Ultra-Sensitive QR Decoder for Vietnamese CCCD (2021 small QR format)
 * Combines Html5Qrcode, jsQR, and ZXing with top-right quadrant 2.5x zoom and contrast enhancement.
 */
export async function decodeQrFromFile(file: File): Promise<string | null> {
  const tempId = 'temp-qr-canvas-' + Date.now();
  let tempElement = document.getElementById(tempId);
  if (!tempElement) {
    tempElement = document.createElement('div');
    tempElement.id = tempId;
    tempElement.style.display = 'none';
    document.body.appendChild(tempElement);
  }

  // 1. Try Html5Qrcode scanFile first
  try {
    const html5QrCode = new Html5Qrcode(tempId);
    const decoded = await html5QrCode.scanFile(file, /* showImage= */ false);
    html5QrCode.clear();
    if (decoded && decoded.trim().length > 0) {
      return decoded.trim();
    }
  } catch (e) {
    // Continue to multi-tile canvas decoder
  }

  // 2. Load image onto canvas for top-right CCCD tile slicing + jsQR + ZXing binarization
  try {
    const image = await loadImageFromFile(file);
    const result = await scanImageWithMultiEngine(image);
    if (result) return result;
  } catch (err) {
    console.error('Canvas Multi-engine Decode Error:', err);
  }

  return null;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function scanImageWithMultiEngine(image: HTMLImageElement): Promise<string | null> {
  const zxingReader = new MultiFormatReader();
  const angles = [0, 90, 270, 180];

  for (const angle of angles) {
    const rotatedCanvas = angle === 0 ? null : createRotatedCanvas(image, angle);
    const sourceW = rotatedCanvas ? rotatedCanvas.width : image.width;
    const sourceH = rotatedCanvas ? rotatedCanvas.height : image.height;

    // Region tiles tailored for phone photos of CCCD cards held in hands or on tables:
    const tiles = [
      // 1. Full Image
      { x: 0, y: 0, w: sourceW, h: sourceH },
      // 2. Top 70%
      { x: 0, y: 0, w: sourceW, h: Math.floor(sourceH * 0.70) },
      // 3. Center-Top Quadrant
      { x: Math.floor(sourceW * 0.20), y: 0, w: Math.floor(sourceW * 0.75), h: Math.floor(sourceH * 0.60) },
      // 4. Center-Right Quadrant
      { x: Math.floor(sourceW * 0.35), y: Math.floor(sourceH * 0.05), w: Math.floor(sourceW * 0.60), h: Math.floor(sourceH * 0.50) },
      // 5. Center 80%
      { x: Math.floor(sourceW * 0.10), y: Math.floor(sourceH * 0.10), w: Math.floor(sourceW * 0.80), h: Math.floor(sourceH * 0.80) },
      // 6. Top-Right Corner
      { x: Math.floor(sourceW * 0.50), y: 0, w: Math.floor(sourceW * 0.50), h: Math.floor(sourceH * 0.50) },
    ];

    const targetMaxEdges = [1200, 1800];

    for (const maxEdge of targetMaxEdges) {
      for (const t of tiles) {
        if (t.w <= 0 || t.h <= 0) continue;

        const scale = Math.min(3.0, maxEdge / Math.max(t.w, t.h));
        const targetW = Math.max(300, Math.floor(t.w * scale));
        const targetH = Math.max(300, Math.floor(t.h * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (rotatedCanvas) {
          ctx.drawImage(rotatedCanvas, t.x, t.y, t.w, t.h, 0, 0, targetW, targetH);
        } else {
          ctx.drawImage(image, t.x, t.y, t.w, t.h, 0, 0, targetW, targetH);
        }

        let imageData = ctx.getImageData(0, 0, targetW, targetH);

        // Engine A: jsQR on raw colored image
        const jsQrCode = jsQR(imageData.data, targetW, targetH, { inversionAttempts: 'attemptBoth' });
        if (jsQrCode && jsQrCode.data && jsQrCode.data.trim().length > 0) {
          return jsQrCode.data.trim();
        }

        // Engine B: ZXing HybridBinarizer & GlobalHistogramBinarizer
        const zxingResult = decodeCanvasWithZXing(ctx, targetW, targetH, zxingReader);
        if (zxingResult) return zxingResult;

        // Engine C: Multi-threshold contrast binarization (115, 140, 90)
        const thresholds = [115, 140, 90];
        for (const thresh of thresholds) {
          const copyData = ctx.getImageData(0, 0, targetW, targetH);
          enhanceContrastCustom(copyData.data, thresh);

          const jsQrBinarized = jsQR(copyData.data, targetW, targetH, { inversionAttempts: 'attemptBoth' });
          if (jsQrBinarized && jsQrBinarized.data && jsQrBinarized.data.trim().length > 0) {
            return jsQrBinarized.data.trim();
          }
        }
      }
    }
  }

  return null;
}

function createRotatedCanvas(image: HTMLImageElement, degrees: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const rad = (degrees * Math.PI) / 180;

  if (degrees === 90 || degrees === 270) {
    canvas.width = image.height;
    canvas.height = image.width;
  } else {
    canvas.width = image.width;
    canvas.height = image.height;
  }

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  return canvas;
}

function decodeCanvasWithZXing(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  reader: MultiFormatReader
): string | null {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const luminanceSource = new RGBLuminanceSource(
      new Uint8ClampedArray(imageData.data.buffer),
      width,
      height
    );

    try {
      const bitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
      const res = reader.decode(bitmap);
      if (res && res.getText()) return res.getText();
    } catch (e) {}

    try {
      const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(luminanceSource));
      const res = reader.decode(bitmap);
      if (res && res.getText()) return res.getText();
    } catch (e) {}
  } catch (err) {}

  return null;
}

function enhanceContrastCustom(data: Uint8ClampedArray, threshold: number) {
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    const val = avg > threshold ? 255 : 0;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
}
