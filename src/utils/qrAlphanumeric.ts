import QRCode from 'qrcode';

/**
 * ISO/IEC 18004 QR Code Alphanumeric Mode (Mode Indicator 0010)
 * Allowed 45-character set: 0-9, A-Z (uppercase), space, $, %, *, +, -, ., /, :
 * Packs 2 characters into 11 bits (5.5 bits/char), producing compact Version 1 (21x21) codes
 * that scan reliably at small sizes and low DPI thermal printers.
 */
export const QR_ALPHANUMERIC_REGEX = /^[0-9A-Z $%*+\-./:]+$/;
export const QR_ALPHANUMERIC_CODE_REGEX = /^[0-9A-Z$%*+\-./:]+$/;

export function sanitizeQrAlphanumeric(rawValue: string, allowSpaces: boolean = false): string {
  if (!rawValue) return '';
  const digitsNormalized = rawValue
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u200E\u200F\u202A-\u202E\uFEFF\r\n\t]/g, '')
    .toUpperCase();

  const pattern = allowSpaces ? /[^0-9A-Z $%*+\-./:]/g : /[^0-9A-Z$%*+\-./:]/g;
  return digitsNormalized.replace(pattern, '').trim();
}

export function isValidQrAlphanumeric(value: string): boolean {
  return Boolean(value) && QR_ALPHANUMERIC_REGEX.test(value);
}

export interface AlphanumericQrMatrixResult {
  value: string;
  size: number;
  version: number;
  mode: 'Alphanumeric';
  data: Uint8Array;
}

export function createAlphanumericQrMatrix(
  rawValue: string,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'
): AlphanumericQrMatrixResult {
  const cleanValue = sanitizeQrAlphanumeric(rawValue, false) || 'CUS0000';
  // Version 1 Alphanumeric fits 20 chars at M and up to 25 chars at L
  const effectiveLevel: 'L' | 'M' | 'Q' | 'H' =
    cleanValue.length > 20 && cleanValue.length <= 25 && errorCorrectionLevel === 'M'
      ? 'L'
      : errorCorrectionLevel;

  const qr = QRCode.create([{ data: cleanValue, mode: 'alphanumeric' }], {
    errorCorrectionLevel: effectiveLevel,
  });

  return {
    value: cleanValue,
    size: qr.modules.size,
    version: qr.version,
    mode: 'Alphanumeric',
    data: qr.modules.data,
  };
}

export function createAutoOrAlphanumericQr(
  rawValue: string,
  mode: 'auto' | 'alphanumeric' = 'alphanumeric',
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'
): { value: string; size: number; version: number; data: Uint8Array; mode: 'Alphanumeric' | 'Auto' } {
  const safeVal = (rawValue || 'CUS0000').trim();
  if (mode === 'alphanumeric' || isValidQrAlphanumeric(safeVal)) {
    return createAlphanumericQrMatrix(safeVal, errorCorrectionLevel);
  }
  const qr = QRCode.create(safeVal, { errorCorrectionLevel });
  return {
    value: safeVal,
    size: qr.modules.size,
    version: qr.version,
    data: qr.modules.data,
    mode: 'Auto',
  };
}

export function buildQrSvgPath(data: Uint8Array, moduleCount: number): string {
  let path = '';
  for (let r = 0; r < moduleCount; r++) {
    let runStart = -1;
    for (let c = 0; c <= moduleCount; c++) {
      const isDark = c < moduleCount ? Boolean(data[r * moduleCount + c]) : false;
      if (isDark && runStart === -1) {
        runStart = c;
      } else if (!isDark && runStart !== -1) {
        const len = c - runStart;
        path += `M${runStart},${r}h${len}v1h-${len}z`;
        runStart = -1;
      }
    }
  }
  return path;
}

export interface PrintableQrOptions {
  value: string;
  mode?: 'auto' | 'alphanumeric';
  sizePx?: number;
  physicalSizeMm?: number;
  marginModules?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  darkColor?: string;
  lightColor?: string;
}

/**
 * Generates an offline, razor-sharp inline vector SVG QR code (default: Alphanumeric Mode)
 * using merged horizontal path runs so thermal & desktop printers never render hairline seams.
 */
export function renderAlphanumericQrSvg({
  value,
  mode = 'alphanumeric',
  sizePx = 120,
  physicalSizeMm,
  marginModules = 2,
  errorCorrectionLevel = 'M',
  darkColor = '#000000',
  lightColor = '#ffffff',
}: PrintableQrOptions): string {
  try {
    const qr = createAutoOrAlphanumericQr(value, mode, errorCorrectionLevel);
    const totalModules = qr.size + marginModules * 2;
    const rawPath = buildQrSvgPath(qr.data, qr.size);

    const sizeStyle = physicalSizeMm
      ? `width: ${physicalSizeMm}mm !important; height: ${physicalSizeMm}mm !important; display: block !important; margin: 0 auto !important; background: ${lightColor} !important;`
      : `width: ${Math.max(40, Math.round(sizePx))}px; height: ${Math.max(40, Math.round(sizePx))}px; display: block; margin: 0 auto; background: ${lightColor};`;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" shape-rendering="crispEdges" role="img" aria-label="QR Code ${qr.value}" style="${sizeStyle}"><rect width="${totalModules}" height="${totalModules}" fill="${lightColor}"/><g transform="translate(${marginModules},${marginModules})"><path d="${rawPath}" fill="${darkColor}"/></g></svg>`;
  } catch (err) {
    console.error('QR Alphanumeric SVG generation failed:', err);
    return '';
  }
}
