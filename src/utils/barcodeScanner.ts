import * as ZXingRaw from 'html5-qrcode/third_party/zxing-js.umd';
import { extractScannedBarcodeId } from './barcode';

const ZXing: any =
  (ZXingRaw as any)?.BarcodeFormat
    ? ZXingRaw
    : (ZXingRaw as any)?.default?.BarcodeFormat
      ? (ZXingRaw as any).default
      : typeof globalThis !== 'undefined' && (globalThis as any).ZXing?.BarcodeFormat
        ? (globalThis as any).ZXing
        : (ZXingRaw as any)?.default || ZXingRaw;

const ZXING_FORMATS = [
  ZXing?.BarcodeFormat?.QR_CODE,
  ZXing?.BarcodeFormat?.CODE_128,
  ZXing?.BarcodeFormat?.CODE_39,
  ZXing?.BarcodeFormat?.CODE_93,
  ZXing?.BarcodeFormat?.EAN_13,
  ZXing?.BarcodeFormat?.EAN_8,
  ZXing?.BarcodeFormat?.UPC_A,
  ZXing?.BarcodeFormat?.UPC_E,
  ZXing?.BarcodeFormat?.ITF,
  ZXing?.BarcodeFormat?.CODABAR,
  ZXing?.BarcodeFormat?.DATA_MATRIX,
  ZXing?.BarcodeFormat?.PDF_417,
  ZXing?.BarcodeFormat?.AZTEC,
].filter((f) => f !== undefined);

const NATIVE_FORMAT_CANDIDATES = [
  'qr_code',
  'code_128',
  'code_39',
  'code_93',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'itf',
  'codabar',
  'data_matrix',
  'pdf417',
  'aztec',
];

let cachedNativeDetectorPromise: Promise<any | null> | null = null;

async function getNativeBarcodeDetector(): Promise<any | null> {
  if (cachedNativeDetectorPromise) return cachedNativeDetectorPromise;

  cachedNativeDetectorPromise = (async () => {
    try {
      const BD = typeof window !== 'undefined' ? (window as any).BarcodeDetector : null;
      if (!BD) return null;

      let formats = NATIVE_FORMAT_CANDIDATES;
      if (typeof BD.getSupportedFormats === 'function') {
        const supported: string[] = await BD.getSupportedFormats();
        const filtered = NATIVE_FORMAT_CANDIDATES.filter((f) => supported.includes(f));
        if (filtered.length === 0) return null;
        formats = filtered;
      }

      return new BD({ formats });
    } catch {
      return null;
    }
  })();

  return cachedNativeDetectorPromise;
}

const cachedReaders: Record<string, any> = {};

function getZxingReader(tryHarder: boolean, pureBarcode: boolean = false) {
  const key = `${tryHarder ? 'H' : 'S'}_${pureBarcode ? 'P' : 'N'}`;
  if (cachedReaders[key]) return cachedReaders[key];

  const hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS);
  hints.set(ZXing.DecodeHintType.TRY_HARDER, tryHarder);
  if (pureBarcode && ZXing.DecodeHintType.PURE_BARCODE !== undefined) {
    hints.set(ZXing.DecodeHintType.PURE_BARCODE, true);
  }

  const reader = new ZXing.MultiFormatReader(false, hints);
  reader.setHints(hints);
  cachedReaders[key] = reader;
  return reader;
}

function tryDecodeWithLuminance(
  luminanceSource: any,
  tryHarder: boolean,
  tryPure: boolean
): string | null {
  const reader = getZxingReader(tryHarder, false);

  try {
    const res = reader.decodeWithState(
      new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource))
    );
    if (res?.text) return String(res.text);
  } catch {
    // Continue to next binarizer
  }

  if (typeof ZXing.GlobalHistogramBinarizer === 'function') {
    try {
      const res = reader.decodeWithState(
        new ZXing.BinaryBitmap(new ZXing.GlobalHistogramBinarizer(luminanceSource))
      );
      if (res?.text) return String(res.text);
    } catch {
      // Continue
    }
  }

  if (tryPure) {
    const pureReader = getZxingReader(true, true);
    try {
      const res = pureReader.decodeWithState(
        new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource))
      );
      if (res?.text) return String(res.text);
    } catch {
      // Not pure
    }
  }

  return null;
}

function tryZxingCanvas(
  canvas: HTMLCanvasElement,
  tryHarder: boolean,
  options: { tryInverted?: boolean; tryPure?: boolean } = {}
): string | null {
  if (!canvas.width || !canvas.height || !ZXing?.HTMLCanvasElementLuminanceSource) return null;

  const lum = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
  const direct = tryDecodeWithLuminance(lum, tryHarder, Boolean(options.tryPure));
  if (direct) return direct;

  if (options.tryInverted && typeof lum.invert === 'function') {
    try {
      const invertedLum = lum.invert();
      const invHit = tryDecodeWithLuminance(invertedLum, tryHarder, false);
      if (invHit) return invHit;
    } catch {
      // ignore inversion failure
    }
  }

  return null;
}

function createRotatedCanvas(source: HTMLCanvasElement, degrees: 90 | 180 | 270): HTMLCanvasElement {
  const out = document.createElement('canvas');
  const ctx = out.getContext('2d');
  if (!ctx) return out;

  if (degrees === 180) {
    out.width = source.width;
    out.height = source.height;
    ctx.translate(out.width / 2, out.height / 2);
    ctx.rotate(Math.PI);
    ctx.drawImage(source, -source.width / 2, -source.height / 2);
  } else {
    out.width = source.height;
    out.height = source.width;
    ctx.translate(out.width / 2, out.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(source, -source.width / 2, -source.height / 2);
  }
  return out;
}

function createCropCanvas(
  source: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  pad: number = 24
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  const safeW = Math.max(1, Math.round(sw));
  const safeH = Math.max(1, Math.round(sh));
  out.width = safeW + pad * 2;
  out.height = safeH + pad * 2;
  const ctx = out.getContext('2d');
  if (!ctx) return out;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, sx, sy, safeW, safeH, pad, pad, safeW, safeH);
  return out;
}

function createHighContrastCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  if (!ctx) return out;

  ctx.drawImage(source, 0, 0);
  const imgData = ctx.getImageData(0, 0, out.width, out.height);
  const data = imgData.data;

  let minLum = 255;
  let maxLum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  const range = Math.max(30, maxLum - minLum);
  const scale = 255 / range;
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    const stretched = Math.max(0, Math.min(255, Math.round((lum - minLum) * scale)));
    const val = stretched < 95 ? 0 : stretched > 175 ? 255 : stretched;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return out;
}

function normalizeDecodedResult(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (
    /[\r\n]/.test(trimmed) ||
    /(?:اسم العميل|الاسم|رقم الموبايل|رقم الهاتف|الهاتف|العطل|تاريخ الاستلام|التكلفة|ملف الزبون)\s*[:：\-]/i.test(trimmed)
  ) {
    return trimmed;
  }
  return extractScannedBarcodeId(trimmed) || trimmed;
}

export interface DecodeCanvasOptions {
  try90DegRotation?: boolean;
  tryAllRotations?: boolean;
  tryHighContrast?: boolean;
  tryInverted?: boolean;
  tryStripBands?: boolean;
  tryPureBarcode?: boolean;
  useNativeDetector?: boolean;
}

export async function decodeCanvasBarcode(
  canvas: HTMLCanvasElement,
  options: DecodeCanvasOptions = {}
): Promise<string | null> {
  const {
    try90DegRotation = false,
    tryAllRotations = false,
    tryHighContrast = false,
    tryInverted = false,
    tryStripBands = false,
    tryPureBarcode = false,
    useNativeDetector = true,
  } = options;

  // 1. Hardware BarcodeDetector when browser supports requested formats
  if (useNativeDetector) {
    const detector = await getNativeBarcodeDetector();
    if (detector) {
      try {
        const detected = await detector.detect(canvas);
        if (detected && detected.length > 0) {
          const sorted = [...detected].sort((a, b) => {
            const areaA = (a.boundingBox?.width || 0) * (a.boundingBox?.height || 0);
            const areaB = (b.boundingBox?.width || 0) * (b.boundingBox?.height || 0);
            return areaB - areaA;
          });
          for (const item of sorted) {
            const cleaned = normalizeDecodedResult(item?.rawValue || '');
            if (cleaned) return cleaned;
          }
        }
      } catch {
        // Fall through cleanly to ZXing
      }
    }
  }

  // 2. Direct full-canvas ZXing TRY_HARDER
  const directHit = tryZxingCanvas(canvas, true, { tryInverted, tryPure: tryPureBarcode });
  if (directHit) {
    return normalizeDecodedResult(directHit);
  }

  // 3. Horizontal strip bands (helps dramatically when a small 1D barcode sits inside a busy receipt/photo)
  if (tryStripBands && canvas.height >= 120 && canvas.width >= 120) {
    const bands = [
      { sx: 0, sy: Math.round(canvas.height * 0.25), sw: canvas.width, sh: Math.round(canvas.height * 0.5) },
      { sx: 0, sy: 0, sw: canvas.width, sh: Math.round(canvas.height * 0.45) },
      { sx: 0, sy: Math.round(canvas.height * 0.52), sw: canvas.width, sh: Math.round(canvas.height * 0.48) },
    ];
    for (const band of bands) {
      const bandCanvas = createCropCanvas(canvas, band.sx, band.sy, band.sw, band.sh, 20);
      const hit = tryZxingCanvas(bandCanvas, true, { tryInverted, tryPure: false });
      if (hit) return normalizeDecodedResult(hit);
    }
  }

  // 4. Rotation passes
  const rotations: (90 | 180 | 270)[] = tryAllRotations
    ? [90, 270, 180]
    : try90DegRotation
      ? [90]
      : [];

  for (const deg of rotations) {
    const rotated = createRotatedCanvas(canvas, deg);
    const hit = tryZxingCanvas(rotated, true, { tryInverted, tryPure: tryPureBarcode });
    if (hit) return normalizeDecodedResult(hit);
  }

  // 5. Contrast-stretched pass (recovers faint thermal prints or glare)
  if (tryHighContrast) {
    const contrastCanvas = createHighContrastCanvas(canvas);
    const contrastHit = tryZxingCanvas(contrastCanvas, true, { tryInverted, tryPure: tryPureBarcode });
    if (contrastHit) return normalizeDecodedResult(contrastHit);

    if (try90DegRotation || tryAllRotations) {
      const rotContrast = createRotatedCanvas(contrastCanvas, 90);
      const rotContrastHit = tryZxingCanvas(rotContrast, true, { tryInverted: false, tryPure: false });
      if (rotContrastHit) return normalizeDecodedResult(rotContrastHit);
    }
  }

  return null;
}

export async function decodeImageFileBarcode(file: Blob): Promise<string | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to load image'));
      el.src = objectUrl;
    });

    const natW = img.naturalWidth || img.width || 1;
    const natH = img.naturalHeight || img.height || 1;
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(natW, natH));
    const drawW = Math.max(1, Math.round(natW * scale));
    const drawH = Math.max(1, Math.round(natH * scale));
    const pad = 36;

    const canvas = document.createElement('canvas');
    canvas.width = drawW + pad * 2;
    canvas.height = drawH + pad * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, pad, pad, drawW, drawH);

    // Primary full-resolution multi-orientation + strip-band + contrast + inverted pass
    const primary = await decodeCanvasBarcode(canvas, {
      tryAllRotations: true,
      tryHighContrast: true,
      tryInverted: true,
      tryStripBands: true,
      tryPureBarcode: true,
      useNativeDetector: true,
    });
    if (primary) return primary;

    // Upscale tiny cropped barcode screenshots (e.g. width < 420px) with crisp pixel preservation
    if (Math.max(natW, natH) < 420) {
      const upScale = 2;
      const upCanvas = document.createElement('canvas');
      upCanvas.width = natW * upScale + pad * 2;
      upCanvas.height = natH * upScale + pad * 2;
      const uCtx = upCanvas.getContext('2d');
      if (uCtx) {
        uCtx.fillStyle = '#ffffff';
        uCtx.fillRect(0, 0, upCanvas.width, upCanvas.height);
        uCtx.imageSmoothingEnabled = false;
        uCtx.drawImage(img, pad, pad, natW * upScale, natH * upScale);
        const upHit = await decodeCanvasBarcode(upCanvas, {
          tryAllRotations: true,
          tryHighContrast: true,
          tryInverted: true,
          tryPureBarcode: true,
          useNativeDetector: false,
        });
        if (upHit) return upHit;
      }
    }

    // Downsample very large noisy camera photos (> 900px wide) to ~750px wide
    if (drawW > 900) {
      const downCanvas = document.createElement('canvas');
      const downW = 750;
      const downH = Math.max(1, Math.round((drawH / drawW) * downW));
      downCanvas.width = downW + pad * 2;
      downCanvas.height = downH + pad * 2;
      const dCtx = downCanvas.getContext('2d');
      if (dCtx) {
        dCtx.fillStyle = '#ffffff';
        dCtx.fillRect(0, 0, downCanvas.width, downCanvas.height);
        dCtx.drawImage(img, pad, pad, downW, downH);
        const downHit = await decodeCanvasBarcode(downCanvas, {
          tryAllRotations: true,
          tryHighContrast: true,
          tryInverted: true,
          tryStripBands: true,
          useNativeDetector: false,
        });
        if (downHit) return downHit;
      }
    }

    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function playScanSuccessFeedback(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(70);
    }
  } catch {
    // ignore vibrate failures
  }

  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1320, ctx.currentTime);
    osc.frequency.setValueAtTime(1760, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 220);
  } catch {
    // ignore audio failures
  }
}
