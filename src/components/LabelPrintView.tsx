import React, { useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { printPureContent } from '../lib/printUtils';
import { renderPrintableBarcodeSvg } from '../utils/barcode';
import { FIXED_LABEL_PAPER_SIZE, getLabelPreviewMetrics } from '../utils/labelDesigner';
import { BarcodeGenerator } from './BarcodeGenerator';

interface LabelPrintViewProps {
  orderId: string;
  qrContent?: string;
  onClose: () => void;
}

export const LabelPrintView: React.FC<LabelPrintViewProps> = ({ orderId, qrContent, onClose }) => {
  const previewMetrics = getLabelPreviewMetrics(FIXED_LABEL_PAPER_SIZE, 250, 180, false);
  const preferredFormat = localStorage.getItem('lblBarcodeFormat') || 'AUTO';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handlePrint = () => {
    const barcodeSvgHtml = renderPrintableBarcodeSvg({
      code: orderId,
      qrContent,
      preferredFormat,
      baseWidth: 1.4,
      heightMm: 10,
      maxWidthMm: 34,
      targetQrMm: 14,
      quietZonePx: 10,
    });

    const labelHtml = `
      <div class="label-container" dir="rtl">
        ${barcodeSvgHtml}
        <div class="serial-number">${orderId}</div>
      </div>
    `;

    const pageStyle = `
      @page {
        margin: 0 !important;
        size: 38mm 25mm;
      }
      .label-container {
        width: 38mm !important;
        height: 25mm !important;
        max-width: 38mm !important;
        max-height: 25mm !important;
        overflow: hidden !important;
        padding: 1.2mm 1.5mm !important;
        margin: 0 auto !important;
        text-align: center !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: space-evenly !important;
        background: white !important;
        color: black !important;
        box-sizing: border-box !important;
      }
      .serial-number {
        font-size: 8.5pt !important;
        font-weight: 900 !important;
        margin-top: 0.6mm !important;
        letter-spacing: 0.2px !important;
        direction: ltr !important;
        font-family: 'Courier New', Courier, monospace !important;
        max-width: 96% !important;
        overflow: hidden !important;
        text-overflow: clip !important;
        white-space: nowrap !important;
      }
    `;

    printPureContent(labelHtml, pageStyle);
  };

  return (
    <div className="fixed inset-0 bg-transparent z-50 flex items-start justify-center p-2 pt-1 sm:pt-2 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-200 animate-in slide-in-from-top-2 duration-150 mb-4" dir="rtl">
        {/* Header */}
        <div className="bg-teal-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Printer className="w-5 h-5" />
            <h2 className="font-sans font-bold text-sm">طباعة ملصق QR للسيريال</h2>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-1.5 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview Area */}
        <div className="p-8 flex flex-col items-center justify-center bg-gray-50 border-b border-gray-100 min-h-[220px]">
          <div
            className="relative mx-auto"
            style={{
              width: `${previewMetrics.scaledWidthPx}px`,
              height: `${previewMetrics.scaledHeightPx}px`,
              maxWidth: '100%'
            }}
          >
            <div
              dir="rtl"
              className="bg-white border-2 border-dashed border-gray-300 flex flex-col items-center justify-evenly rounded overflow-hidden"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '38mm',
                height: '25mm',
                maxWidth: '38mm',
                maxHeight: '25mm',
                padding: '1.2mm 1.5mm',
                boxSizing: 'border-box',
                textAlign: 'center',
                transform: `scale(${previewMetrics.scale})`,
                transformOrigin: 'top left'
              }}
            >
              <BarcodeGenerator
                value={orderId}
                qrContent={qrContent}
                width={1.4}
                physicalHeightMm={10}
                maxWidthMm={34}
                targetQrMm={14}
                svgMargin={10}
                showText={true}
                showModeBadge={true}
                fontSize={8.5}
                textLetterSpacing="0.2px"
                textMarginTopMm={0.6}
                format={preferredFormat}
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-4 font-sans text-center">معاينة مطابقة للطباعة - مقاس 38×25 مم (×{previewMetrics.scale.toFixed(2)})</p>
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
            className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-sans font-bold rounded-xl text-xs transition-colors shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الملصق الآن</span>
          </button>
        </div>
      </div>
    </div>
  );
};