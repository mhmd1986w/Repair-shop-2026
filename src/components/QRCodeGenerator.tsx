import React, { useMemo } from 'react';
import {
  buildQrSvgPath,
  createAutoOrAlphanumericQr,
} from '../utils/qrAlphanumeric';

interface QRCodeProps {
  value: string;
  size?: number;
  compact?: boolean;
  physicalSizeMm?: number;
  mode?: 'auto' | 'alphanumeric';
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  marginModules?: number;
  showModeBadge?: boolean;
}

export const QRCodeGenerator: React.FC<QRCodeProps> = ({
  value,
  size = 120,
  compact = false,
  physicalSizeMm,
  mode = 'auto',
  errorCorrectionLevel = 'M',
  marginModules = 2,
  showModeBadge = false,
}) => {
  const pixelSize = Math.max(40, Math.round(size));

  const qrData = useMemo(() => {
    try {
      const matrix = createAutoOrAlphanumericQr(value, mode, errorCorrectionLevel);
      const path = buildQrSvgPath(matrix.data, matrix.size);
      const totalModules = matrix.size + marginModules * 2;
      return {
        ...matrix,
        path,
        totalModules,
      };
    } catch {
      return null;
    }
  }, [value, mode, errorCorrectionLevel, marginModules]);

  if (!qrData) return null;

  const svgStyle: React.CSSProperties = physicalSizeMm
    ? {
        width: `${physicalSizeMm}mm`,
        height: `${physicalSizeMm}mm`,
        display: 'block',
        margin: '0 auto',
      }
    : {
        width: `${pixelSize}px`,
        height: `${pixelSize}px`,
        display: 'block',
        margin: '0 auto',
      };

  const svgElement = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${qrData.totalModules} ${qrData.totalModules}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR ${qrData.value}`}
      style={svgStyle}
      className={compact ? undefined : 'rounded-lg'}
    >
      <rect width={qrData.totalModules} height={qrData.totalModules} fill="#ffffff" />
      <g transform={`translate(${marginModules},${marginModules})`}>
        <path d={qrData.path} fill="#000000" />
      </g>
    </svg>
  );

  if (compact) {
    return svgElement;
  }

  return (
    <div className="inline-flex flex-col items-center justify-center bg-white p-3 rounded-2xl border border-slate-200/80 shadow-[0_6px_20px_-4px_rgba(15,23,42,0.12),0_2px_6px_-1px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5 gap-1.5">
      {svgElement}
      {showModeBadge && (
        <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
          {qrData.mode === 'Alphanumeric'
            ? `Alphanumeric QR · V${qrData.version}`
            : `QR · V${qrData.version}`}
        </span>
      )}
    </div>
  );
};
