import React, { useMemo } from 'react';
import { getBarcodeQrSizeMm } from '../utils/barcode';
import {
  buildQrSvgPath,
  createAutoOrAlphanumericQr,
  isValidQrAlphanumeric,
  sanitizeQrAlphanumeric,
} from '../utils/qrAlphanumeric';

interface BarcodeGeneratorProps {
  value: string;
  qrContent?: string;
  width?: number;
  height?: number;
  showText?: boolean;
  showModeBadge?: boolean;
  format?: string;
  className?: string;
  fontSize?: number;
  maxWidthMm?: number;
  physicalHeightMm?: number;
  targetQrMm?: number;
  svgMargin?: number;
  textLetterSpacing?: string;
  textMarginTopMm?: number;
  marginModules?: number;
}

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
  value,
  qrContent,
  height = 50,
  showText = true,
  showModeBadge = false,
  className = '',
  fontSize = 13,
  maxWidthMm,
  physicalHeightMm,
  targetQrMm,
  textLetterSpacing = '1.2px',
  textMarginTopMm,
  marginModules = 1,
}) => {
  const qrSizeMm = useMemo(() => {
    return getBarcodeQrSizeMm({
      heightPx: height,
      heightMm: physicalHeightMm,
      maxWidthMm,
      targetQrMm,
    });
  }, [height, physicalHeightMm, maxWidthMm, targetQrMm]);

  const qrData = useMemo(() => {
    const richPayload = (qrContent || '').trim();

    try {
      let qr: ReturnType<typeof createAutoOrAlphanumericQr>;
      if (richPayload) {
        const upperRich = richPayload.toUpperCase();
        const useAlphaRich = isValidQrAlphanumeric(upperRich);
        qr = createAutoOrAlphanumericQr(
          useAlphaRich ? upperRich : richPayload,
          useAlphaRich ? 'alphanumeric' : 'auto',
          useAlphaRich ? 'M' : 'L'
        );
      } else {
        const normalized = String(value || '').trim().toUpperCase();
        const cleanAlpha = sanitizeQrAlphanumeric(normalized, false);
        const useAlpha = isValidQrAlphanumeric(cleanAlpha) && cleanAlpha.length > 0;
        const targetValue = useAlpha ? cleanAlpha : (normalized || 'TEC0000');
        qr = createAutoOrAlphanumericQr(
          targetValue,
          useAlpha ? 'alphanumeric' : 'auto',
          'M'
        );
      }

      const safeMarginModules = Math.max(0, marginModules);
      const totalModules = qr.size + safeMarginModules * 2;
      const pathData = buildQrSvgPath(qr.data, qr.size);
      return {
        totalModules,
        marginModules: safeMarginModules,
        pathData,
        encoded: qr.value,
        version: qr.version,
        mode: qr.mode,
      };
    } catch (err) {
      console.error('QR generation failed in BarcodeGenerator:', err);
      return null;
    }
  }, [value, qrContent, marginModules]);

  return (
    <div className={`inline-flex flex-col items-center justify-center max-w-full bg-white ${className}`}>
      {qrData && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${qrData.totalModules} ${qrData.totalModules}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label={`QR Code ${value || qrData.encoded}`}
          className="barcode-svg max-w-full block bg-white"
          style={{
            width: `${qrSizeMm}mm`,
            height: `${qrSizeMm}mm`,
            maxWidth: '100%',
          }}
        >
          <rect width={qrData.totalModules} height={qrData.totalModules} fill="#ffffff" />
          <g transform={`translate(${qrData.marginModules},${qrData.marginModules})`}>
            <path d={qrData.pathData} fill="#000000" />
          </g>
        </svg>
      )}
      {showText && value && (
        <div
          className={`barcode-readable-text font-mono font-black text-black text-center select-all leading-none ${textMarginTopMm === undefined ? 'mt-0.5' : ''}`}
          style={{
            fontSize: `${Math.max(10, Math.min(99, fontSize))}pt`,
            letterSpacing: textLetterSpacing,
            marginTop: textMarginTopMm !== undefined ? `${textMarginTopMm}mm` : undefined,
            fontFamily: "'Courier New', Courier, monospace, sans-serif",
          }}
          dir="ltr"
        >
          {value}
        </div>
      )}
      {showModeBadge && qrData && (
        <span className="mt-1 text-[9px] font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
          {qrData.mode === 'Alphanumeric'
            ? `Alphanumeric QR · V${qrData.version}`
            : `QR معلومات الزبون · V${qrData.version}`}
        </span>
      )}
    </div>
  );
};
