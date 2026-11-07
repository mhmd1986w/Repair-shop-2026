import React, { useRef, useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface LabelPrintViewProps {
  orderId: string;
  onClose: () => void;
}

export const LabelPrintView: React.FC<LabelPrintViewProps> = ({ orderId, onClose }) => {
  const [barcodeBase64, setBarcodeBase64] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, orderId, {
        width: 1.3,
        height: 28,
        displayValue: false,
        margin: 1,
        background: '#ffffff',
        lineColor: '#000000',
      });
      setBarcodeBase64(canvas.toDataURL('image/png'));
    } catch (e) {
      console.error(e);
    }
  }, [orderId]);

  const handlePrint = () => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const printWindow = iframe.contentWindow;
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>طباعة ملصق الجهاز</title>
          <style>
            @page {
              margin: 0;
              size: 50mm 30mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 0;
              width: 50mm;
              height: 30mm;
              max-width: 50mm;
              max-height: 30mm;
              overflow: hidden;
              box-sizing: border-box;
              display: flex;
              align-items: center;
              justify-content: center;
              background: white;
              font-family: 'Courier New', Courier, monospace;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .label-container {
              width: 50mm;
              height: 30mm;
              max-width: 50mm;
              max-height: 30mm;
              overflow: hidden;
              padding: 1.5mm 2mm;
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-evenly;
            }
            .barcode-img {
              max-height: 12mm;
              width: auto;
              max-width: 90%;
              image-rendering: pixelated;
              display: block;
              margin: 0 auto;
            }
            .serial-number {
              font-size: 8.5pt;
              font-weight: 900;
              margin-top: 1mm;
              letter-spacing: 0.5px;
              direction: ltr !important;
              font-family: 'Courier New', Courier, monospace !important;
              max-width: 95%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            ${barcodeBase64 ? '<img src="' + barcodeBase64 + '" class="barcode-img" />' : ''}
            <div class="serial-number">
              ${orderId}
            </div>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                setTimeout(() => { window.parent.document.body.removeChild(window.frameElement); }, 500);
              }, 100);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-transparent z-50 flex items-start justify-center p-2 pt-1 sm:pt-2 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-200 animate-in slide-in-from-top-2 duration-150 mb-4" dir="rtl">
        {/* Header */}
        <div className="bg-teal-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Printer className="w-5 h-5" />
            <h2 className="font-sans font-bold text-sm">طباعة ملصق مبسط للسيريال</h2>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-1.5 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview Area */}
        <div className="p-8 flex flex-col items-center justify-center bg-gray-50 border-b border-gray-100 min-h-[220px]">
          {/* Virtual Label Boundary (50x30 ratio roughly) */}
          <div 
            className="bg-white border-2 border-dashed border-gray-300  flex flex-col items-center justify-center rounded overflow-hidden"
            style={{ width: '250px', height: '150px' }}
          >
            <div className="flex flex-col items-center justify-center w-full">
              {barcodeBase64 && (
                <img src={barcodeBase64} alt="Barcode" className="w-auto max-h-[60px]" style={{ imageRendering: 'pixelated' }} />
              )}
              <div className="serial-number" style={{ fontSize: '32px', fontWeight: '900', marginTop: '10px', fontFamily: 'monospace', letterSpacing: '2px' }}>
                {orderId}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-4 font-sans text-center">معاينة للملصق (خط كبير وواضح - مقاس 50x30 مم)</p>
        </div>

        {/* Actions */}
        <div className="p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-sans font-bold rounded-xl text-xs transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-sans font-bold rounded-xl text-xs transition-colors  -600/20 flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الملصق الآن</span>
          </button>
        </div>
      </div>
    </div>
  );
};