import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeGeneratorProps {
  value: string;
  width?: number;
  height?: number;
  showText?: boolean;
  format?: string;
  className?: string;
  fontSize?: number;
}

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({ 
  value, 
  width = 2, 
  height = 50, 
  showText = true,
  format = 'CODE128',
  className = '',
  fontSize = 13
}) => {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && value) {
      try {
        JsBarcode(barcodeRef.current, value, {
          format: format || 'CODE128',
          width,
          height,
          displayValue: false, // Render crisp native text below to prevent blurry or squashed SVG text
          margin: 2,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (err) {
        // Fallback to CODE128 if the format is incompatible with the value (e.g. EAN13 requires numbers only)
        try {
          JsBarcode(barcodeRef.current, value, {
            format: 'CODE128',
            width,
            height,
            displayValue: false,
            margin: 2,
            background: '#ffffff',
            lineColor: '#000000',
          });
        } catch (fallbackErr) {
          console.error('Failed to generate barcode even with fallback CODE128', fallbackErr);
        }
      }
    }
  }, [value, width, height, format]);

  return (
    <div className={`flex flex-col items-center justify-center w-full ${className}`}>
      <svg ref={barcodeRef} className="w-full max-w-full h-auto block mx-auto"></svg>
      {showText && value && (
        <div 
          className="barcode-readable-text font-mono font-black text-black tracking-widest text-center mt-1 select-all leading-tight"
          style={{ 
            fontSize: `${Math.max(10, fontSize)}pt`, 
            letterSpacing: '2px',
            fontFamily: "'Courier New', Courier, monospace, sans-serif"
          }}
          dir="ltr"
        >
          {value}
        </div>
      )}
    </div>
  );
};
