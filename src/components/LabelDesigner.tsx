import React, { useState, useEffect, useRef } from 'react';
import { 
  LabelLayoutConfig, 
  LabelElementConfig, 
  LabelElementId, 
  getStoredLabelLayout, 
  saveStoredLabelLayout, 
  reorderElements, 
  getLabelPreviewMetrics,
  getLabelContainerStyles,
  getLabelElementMetrics,
  fitLabelLayoutToPaper,
  getSplitThermalLabelMetrics,
  getVerticalOrderIdSvgSpec,
  FIXED_LABEL_PAPER_SIZE
} from '../utils/labelDesigner';
import { BarcodeGenerator } from './BarcodeGenerator';
import { QRCodeGenerator } from './QRCodeGenerator';
import { buildTrackingUrl } from '../utils/appDomain';
import { generateBarcodeId } from '../utils/barcode';
import { buildOrderCustomerQrPayload } from '../utils/customerBarcode';
import { DeviceStatus, MaintenanceOrder } from '../types';

interface LabelDesignerProps {
  onLayoutChange?: (newLayout: LabelLayoutConfig) => void;
  mockOrder?: {
    customerName: string;
    customerPhone?: string;
    brandModel: string;
    id: string;
    faultDescription?: string;
    estimatedCost?: number;
    actualCost?: number;
    currency?: string;
    createdAt?: string | number;
  };
}

export const LabelDesigner: React.FC<LabelDesignerProps> = ({ onLayoutChange, mockOrder }) => {
  const [layout, setLayout] = useState<LabelLayoutConfig>(() => getStoredLabelLayout());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<LabelElementId | null>(null);
  const [actualScalePreview, setActualScalePreview] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const stickerRef = useRef<HTMLDivElement>(null);

  // Active resizing state for live drag-to-resize on preview
  const [resizing, setResizing] = useState<{
    elementId: LabelElementId;
    startX: number;
    startY: number;
    initialSize: number;
    isDimension: boolean;
    corner: 'right' | 'left';
    scale: number;
  } | null>(null);

  // Center info from storage for live preview (aligned with thermal print fallback)
  const centerName = localStorage.getItem('centerName') || 'مركز تكنو للصيانة';
  const centerMobile = localStorage.getItem('centerMobile') || '05xxxxxxxx';
  const [barcodeFormat] = useState<string>(() => {
    return localStorage.getItem('lblBarcodeFormat') || 'AUTO';
  });

  const orderData = mockOrder || {
    customerName: 'أحمد محمد عبد الله',
    customerPhone: '0790000000',
    brandModel: 'iPhone 14 Pro Max',
    faultDescription: 'تغيير شاشة + فحص بطارية',
    estimatedCost: 45,
    id: generateBarcodeId(localStorage.getItem('barcodePrefix') || 'TEC'),
    createdAt: new Date().toISOString()
  };

  const layoutRef = useRef<LabelLayoutConfig>(layout);
  layoutRef.current = layout;

  const selectedEl = layout.elements.find(e => e.id === selectedId);

  // Measure whether content overflows exact physical print dimensions
  useEffect(() => {
    const checkOverflow = () => {
      const el = stickerRef.current;
      if (!el) return;
      const overflowing = el.scrollHeight > el.clientHeight + 1.5 || el.scrollWidth > el.clientWidth + 1.5;
      setIsOverflowing(overflowing);
    };
    const id = requestAnimationFrame(checkOverflow);
    const timer = setTimeout(checkOverflow, 180);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(timer);
    };
  }, [layout, barcodeFormat, centerName, centerMobile]);

  const updateLayout = (newLayout: LabelLayoutConfig) => {
    layoutRef.current = newLayout;
    setLayout(newLayout);
    saveStoredLabelLayout(newLayout);
    if (onLayoutChange) {
      onLayoutChange(newLayout);
    }
  };

  const handleDragStart = (id: string, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(id);
  };

  const handleDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = (targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
    if (!sourceId || sourceId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const current = layoutRef.current;
    const fromIdx = current.elements.findIndex(el => el.id === sourceId);
    const toIdx = current.elements.findIndex(el => el.id === targetId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const reordered = reorderElements(current.elements, fromIdx, toIdx);
      const updated = { ...current, elements: reordered };
      updateLayout(updated);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragLeave = (id: string) => {
    setDragOverId(prev => (prev === id ? null : prev));
  };

  const handleUpdateElement = (id: LabelElementId, changes: Partial<LabelElementConfig>) => {
    const current = layoutRef.current;
    const updatedElements = current.elements.map(el => {
      if (el.id === id) {
        return { ...el, ...changes };
      }
      return el;
    });
    updateLayout({ ...current, elements: updatedElements });
  };

  // Drag-to-resize listener for canvas
  useEffect(() => {
    if (!resizing) return;

    document.body.style.userSelect = 'none';

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX: number;
      let clientY: number;

      if ('touches' in e) {
        if (!e.touches || e.touches.length === 0) return;
        e.preventDefault();
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const deltaY = (clientY - resizing.startY) / (resizing.scale || 1);
      const deltaX = (clientX - resizing.startX) / (resizing.scale || 1);
      // Downward or outward drag increases size, upward or inward drag decreases size
      const outwardX = resizing.corner === 'right' ? deltaX : -deltaX;
      const delta = deltaY + outwardX * 0.5;

      if (resizing.isDimension) {
        // Height for barcode or QR code in px (10 to 99)
        const newHeight = Math.round(Math.max(10, Math.min(99, resizing.initialSize + delta)));
        handleUpdateElement(resizing.elementId, { height: newHeight });
      } else {
        // Font size in pt (10pt to 99pt): responsive drag scaling
        const deltaPt = Math.round((delta / 3) * 2) / 2;
        const newFontSize = Math.round(Math.max(10, Math.min(99, resizing.initialSize + deltaPt)) * 2) / 2;
        handleUpdateElement(resizing.elementId, { fontSize: newFontSize });
      }
    };

    const handlePointerUp = () => {
      document.body.style.userSelect = '';
      setResizing(null);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [resizing]);

  const startResizeDrag = (
    e: React.MouseEvent | React.TouchEvent,
    el: LabelElementConfig,
    corner: 'right' | 'left',
    currentScale: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if ('touches' in e && (!e.touches || e.touches.length === 0)) return;
    setSelectedId(el.id);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const isDimension = el.id === 'barcode' || el.id === 'qr_code';
    const initialSize = isDimension 
      ? Math.max(10, Math.min(99, el.height || (el.id === 'barcode' ? 26 : 30)))
      : Math.max(10, Math.min(99, el.fontSize || (el.id === 'center_name' ? 13 : 10)));

    setResizing({
      elementId: el.id,
      startX: clientX,
      startY: clientY,
      initialSize,
      isDimension,
      corner,
      scale: currentScale
    });
  };

  // Physical 1:1 metrics and screen scale
  const previewMetrics = getLabelPreviewMetrics(FIXED_LABEL_PAPER_SIZE, 280, 230, actualScalePreview);
  const containerStyles = getLabelContainerStyles({ ...layout, paperSize: FIXED_LABEL_PAPER_SIZE });

  const activeElements = layout.elements.filter(el => el.enabled);
  const splitMetrics = getSplitThermalLabelMetrics(layout, containerStyles, activeElements);
  const barcodeActiveEl = activeElements.find(el => el.id === 'barcode');
  const qrActiveEl = activeElements.find(el => el.id === 'qr_code');
  const infoElements = splitMetrics.hasQrSide
    ? activeElements.filter(el => el.id !== 'qr_code')
    : activeElements;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col items-center justify-start font-sans">
        <div className="w-full max-w-sm space-y-3">


            {/* Selected Element Quick Resize Bar (outside sticker so it never overlaps text) */}
            {selectedEl && selectedEl.enabled && (
              <div className="bg-teal-900 text-white text-[11px] font-bold px-3 py-2 rounded-2xl shadow-md flex items-center justify-between gap-2 select-none">
                <span className="truncate text-teal-100">{selectedEl.label}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedEl.id === 'barcode' || selectedEl.id === 'qr_code') {
                        handleUpdateElement(selectedEl.id, { height: Math.max(10, (selectedEl.height || 26) - 2) });
                      } else {
                        handleUpdateElement(selectedEl.id, { fontSize: Math.max(10, Math.min(99, (selectedEl.fontSize || 10) - 0.5)) });
                      }
                    }}
                    className="w-6 h-6 bg-teal-800 hover:bg-teal-700 rounded-lg flex items-center justify-center cursor-pointer text-white font-bold"
                    title="تصغير"
                  >
                    -
                  </button>
                  <span className="font-mono text-white min-w-[44px] text-center font-black tabular-nums">
                    {selectedEl.id === 'barcode' || selectedEl.id === 'qr_code'
                      ? `${Math.max(10, Math.min(99, selectedEl.height || 26))}px`
                      : `${Math.max(10, Math.min(99, selectedEl.fontSize || 10))}pt`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedEl.id === 'barcode' || selectedEl.id === 'qr_code') {
                        handleUpdateElement(selectedEl.id, { height: Math.min(99, (selectedEl.height || 26) + 2) });
                      } else {
                        handleUpdateElement(selectedEl.id, { fontSize: Math.min(99, Math.max(10, (selectedEl.fontSize || 10) + 0.5)) });
                      }
                    }}
                    className="w-6 h-6 bg-teal-800 hover:bg-teal-700 rounded-lg flex items-center justify-center cursor-pointer text-white font-bold"
                    title="تكبير"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Sticker Outer Wrapper with simulated roll edge */}
            <div className="relative mx-auto bg-gray-100 p-4 rounded-2xl border border-gray-200/80 flex flex-col items-center justify-center">
              {/* Paper Top Cut guide & Scale Toggle */}
              <div className="w-full flex items-center justify-between gap-2 text-gray-500 text-[9px] font-mono border-b border-dashed border-gray-300 pb-1.5 mb-2.5 select-none">
                <span>✂️ {containerStyles.widthMm}×{containerStyles.heightMm}mm</span>
                <button
                  type="button"
                  onClick={() => setActualScalePreview(v => !v)}
                  className="px-2 py-0.5 rounded-md bg-white border border-gray-200 hover:border-teal-400 text-[9px] font-sans font-bold text-teal-800 cursor-pointer tabular-nums"
                  title="التبديل بين التكبير المريح للتصميم والحجم الفعلي على الشاشة 1:1"
                >
                  {actualScalePreview ? 'مقاس الشاشة 1:1' : `مكبر للمعاينة ×${previewMetrics.scale.toFixed(2)}`}
                </button>
              </div>

              {/* Scaled Viewport Container matching exact physical aspect & print area */}
              <div
                className="relative mx-auto transition-all"
                style={{
                  width: `${previewMetrics.scaledWidthPx}px`,
                  height: `${previewMetrics.scaledHeightPx}px`,
                  maxWidth: '100%'
                }}
              >
                {/* The Exact Physical Sticker (scaled uniformly so font-pt, mm padding, barcode & QR match print 1:1) */}
                <div
                  ref={stickerRef}
                  dir="rtl"
                  className="bg-white outline outline-1 outline-dashed outline-teal-500 rounded-sm select-none overflow-hidden shadow-sm"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${containerStyles.widthMm}mm`,
                    height: `${containerStyles.heightMm}mm`,
                    maxWidth: `${containerStyles.widthMm}mm`,
                    maxHeight: `${containerStyles.heightMm}mm`,
                    padding: `${splitMetrics.effectivePaddingMm}mm`,
                    display: 'flex',
                    flexDirection: splitMetrics.hasQrSide ? 'row' : 'column',
                    alignItems: 'center',
                    justifyContent: splitMetrics.hasQrSide && infoElements.length > 0 ? 'space-between' : 'center',
                    gap: splitMetrics.hasQrSide && infoElements.length > 0 ? `${splitMetrics.colGapMm}mm` : '0',
                    boxSizing: 'border-box',
                    textAlign: containerStyles.textAlign,
                    fontFamily: containerStyles.fontFamilyCss,
                    color: '#000000',
                    transform: `scale(${previewMetrics.scale})`,
                    transformOrigin: 'top left'
                  }}
                >
                  {(!splitMetrics.hasQrSide || infoElements.length > 0) && (
                  <div
                    className={splitMetrics.hasQrSide ? 'flex-1 min-w-0 h-full flex flex-row items-center justify-center overflow-hidden' : 'w-full flex flex-col justify-center'}
                    style={{
                      alignItems: splitMetrics.hasQrSide ? 'center' : containerStyles.alignItems,
                      textAlign: splitMetrics.hasQrSide ? 'center' : containerStyles.textAlign,
                      gap: splitMetrics.hasQrSide ? `${splitMetrics.verticalColGapMm}mm` : undefined,
                    }}
                  >
                    {/* Render each enabled text/info element in its custom order on the right side */}
                    {infoElements.map((el) => {
                      const isHovered = dragOverId === el.id;
                      const isBeingDragged = draggedId === el.id;
                      const isSelected = selectedId === el.id;
                      const isCurrentlyResizing = resizing?.elementId === el.id;
                      const elMetrics = getLabelElementMetrics(el, layout);
                      const handleInverseScale = Number(Math.max(0.45, Math.min(1.4, 1 / previewMetrics.scale)).toFixed(2));
                      const baseFontPt = splitMetrics.compactFontPt ?? Math.min(elMetrics.fontSizePt, splitMetrics.isNarrowWidth ? 8 : 11);
                      const mTopMm = splitMetrics.isCompactHeight ? 0 : Math.min(elMetrics.marginTopMm, 0.4);
                      const mBotMm = splitMetrics.isCompactHeight ? 0.2 : Math.min(elMetrics.marginBottomMm, 0.5);
                      const orderDateStr = new Date(orderData.createdAt || Date.now()).toLocaleDateString('ar-SA');

                      return (
                        <div
                          key={el.id}
                          draggable={!resizing}
                          onDragStart={(e) => {
                            if (resizing) {
                              e.preventDefault();
                              return;
                            }
                            handleDragStart(el.id, e);
                          }}
                          onDragOver={(e) => handleDragOver(el.id, e)}
                          onDragLeave={() => handleDragLeave(el.id)}
                          onDrop={(e) => handleDrop(el.id, e)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setSelectedId(selectedId === el.id ? null : el.id)}
                          className={`${splitMetrics.hasQrSide ? (el.id === 'barcode' ? 'h-full flex items-center justify-center shrink-0' : 'max-h-full') : 'w-fit max-w-full'} relative group cursor-grab active:cursor-grabbing ${
                            isBeingDragged ? 'opacity-30' : ''
                          } ${isHovered ? 'bg-teal-100/40 outline outline-1 outline-teal-500' : ''} ${
                            isSelected
                              ? 'bg-teal-50/20 outline outline-1 outline-teal-600'
                              : 'hover:outline hover:outline-1 hover:outline-teal-400 hover:bg-teal-50/20'
                          }`}
                          style={splitMetrics.hasQrSide ? (el.id === 'barcode' ? {
                            margin: 0,
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                          } : {
                            writingMode: 'vertical-rl',
                            textOrientation: 'mixed',
                            margin: 0,
                            textAlign: 'center',
                            boxSizing: 'border-box',
                          }) : {
                            marginTop: `${mTopMm}mm`,
                            marginBottom: `${mBotMm}mm`,
                            textAlign: containerStyles.textAlign,
                            alignSelf: containerStyles.alignItems,
                            boxSizing: 'border-box'
                          }}
                          title="اسحب لتغيير الموضع، أو اسحب الزاوية لتكبير وتصغير الحجم"
                        >
                          {/* Corner Resize Handles (inversely scaled to keep crisp touch target) */}
                          {(isSelected || isHovered) && (
                            <>
                              <div
                                draggable={false}
                                onMouseDown={(e) => startResizeDrag(e, el, 'right', previewMetrics.scale)}
                                onTouchStart={(e) => startResizeDrag(e, el, 'right', previewMetrics.scale)}
                                style={{ transform: `scale(${handleInverseScale})` }}
                                className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow flex items-center justify-center cursor-nwse-resize z-20 select-none"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[8px] font-mono leading-none select-none">⤡</span>
                              </div>

                              <div
                                draggable={false}
                                onMouseDown={(e) => startResizeDrag(e, el, 'left', previewMetrics.scale)}
                                onTouchStart={(e) => startResizeDrag(e, el, 'left', previewMetrics.scale)}
                                style={{ transform: `scale(${handleInverseScale})` }}
                                className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow flex items-center justify-center cursor-nesw-resize z-20 select-none"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[8px] font-mono leading-none select-none">⤢</span>
                              </div>
                            </>
                          )}

                          {/* Active Resizing Indicator */}
                          {isCurrentlyResizing && (
                            <div className="absolute inset-0 bg-teal-600/15 outline outline-1 outline-teal-500 flex items-center justify-center z-30 pointer-events-none">
                              <span
                                style={{ transform: `scale(${handleInverseScale})` }}
                                className="bg-teal-950 text-white font-mono font-black text-[10px] px-2 py-0.5 rounded shadow border border-teal-400 whitespace-nowrap tabular-nums"
                              >
                                {el.id === 'barcode' ? `${elMetrics.barcodeHeightPx}px` : `${elMetrics.fontSizePt}pt`}
                              </span>
                            </div>
                          )}

                          {el.id === 'center_name' && (
                            <div
                              dir="auto"
                              className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full truncate'} text-black font-black`}
                              style={{
                                fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalCenterNameFontPt(centerName) : splitMetrics.getCenterNameFontPt(centerName, baseFontPt)}pt`,
                                fontWeight: 900,
                                letterSpacing: splitMetrics.hasQrSide ? '0px' : '-0.25px',
                                lineHeight: 1
                              }}
                            >
                              {centerName}
                            </div>
                          )}

                          {el.id === 'center_mobile' && (
                            <div
                              dir="ltr"
                              className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden' : 'max-w-full whitespace-nowrap'} text-black tabular-nums`}
                              style={{
                                fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalMobileFontPt(centerMobile) : splitMetrics.getCenterMobileFontPt(centerMobile, baseFontPt)}pt`,
                                fontWeight: splitMetrics.hasQrSide ? 900 : (el.bold ? 700 : 600),
                                fontFamily: "system-ui, -apple-system, 'Cairo', sans-serif",
                                letterSpacing: splitMetrics.hasQrSide ? '0px' : '-0.1px',
                                lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing
                              }}
                            >
                              {centerMobile}
                            </div>
                          )}

                          {el.id === 'customer_name' && (
                            <div
                              dir="auto"
                              className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full truncate'} text-black`}
                              style={{
                                fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalInfoFontPt(`العميل: ${orderData.customerName}`) : baseFontPt}pt`,
                                fontWeight: el.bold ? 800 : 600,
                                lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing
                              }}
                            >
                              العميل: {orderData.customerName}
                            </div>
                          )}

                          {el.id === 'device_model' && (
                            <div
                              dir="auto"
                              className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full truncate'} text-black`}
                              style={{
                                fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalInfoFontPt(`الجهاز: ${orderData.brandModel}`) : baseFontPt}pt`,
                                fontWeight: el.bold ? 800 : 600,
                                lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing
                              }}
                            >
                              الجهاز: {orderData.brandModel}
                            </div>
                          )}

                          {el.id === 'order_date' && (
                            <div
                              dir="auto"
                              className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full truncate'} text-black`}
                              style={{
                                fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalInfoFontPt(`التاريخ: ${orderDateStr}`) : baseFontPt}pt`,
                                fontWeight: el.bold ? 700 : 400,
                                lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing
                              }}
                            >
                              التاريخ: {orderDateStr}
                            </div>
                          )}

                          {el.id === 'barcode' && (
                            splitMetrics.hasQrSide ? (() => {
                              const spec = getVerticalOrderIdSvgSpec(orderData.id, splitMetrics);
                              return (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width={`${spec.widthMm}mm`}
                                  height={`${spec.heightMm}mm`}
                                  viewBox={`0 0 ${spec.viewBoxWidth} ${spec.viewBoxHeight}`}
                                  style={{ width: `${spec.widthMm}mm`, height: `${spec.heightMm}mm`, display: 'block', flexShrink: 0, overflow: 'visible' }}
                                >
                                  <text
                                    x={spec.cx}
                                    y={spec.cy}
                                    dy={spec.dyUnits}
                                    transform={`rotate(90 ${spec.cx} ${spec.cy})`}
                                    textAnchor="middle"
                                    textLength={spec.textLengthUnits}
                                    lengthAdjust={spec.textLengthUnits ? 'spacingAndGlyphs' : undefined}
                                    fill="#000000"
                                    fontFamily="system-ui, -apple-system, 'Cairo', Arial, sans-serif"
                                    fontSize={spec.fontSizeUnits}
                                    fontWeight={900}
                                    style={{ fontVariantNumeric: 'tabular-nums' }}
                                  >
                                    {spec.code}
                                  </text>
                                </svg>
                              );
                            })() : (
                              <div
                                dir="ltr"
                                className="max-w-full whitespace-nowrap font-black text-black tabular-nums"
                                style={{
                                  fontSize: `${splitMetrics.getCodeFontPt(orderData.id, baseFontPt)}pt`,
                                  fontFamily: "system-ui, -apple-system, 'Cairo', sans-serif",
                                  fontVariantNumeric: 'tabular-nums',
                                  letterSpacing: '-0.2px',
                                  lineHeight: 1
                                }}
                              >
                                {orderData.id}
                              </div>
                            )
                          )}

                          {el.id === 'custom_text' && (
                            <div
                              dir="auto"
                              className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full break-words'} text-black`}
                              style={{
                                fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalInfoFontPt(el.customContent || 'يرجى إبراز هذا الملصق عند الاستلام') : baseFontPt}pt`,
                                fontWeight: el.bold ? 700 : 500,
                                lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing,
                                textAlign: splitMetrics.hasQrSide ? 'center' : containerStyles.textAlign
                              }}
                            >
                              {el.customContent || 'يرجى إبراز هذا الملصق عند الاستلام'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  )}

                  {splitMetrics.hasQrSide && (
                    <div className="shrink-0 h-full flex flex-col items-center justify-center bg-white gap-0.5">
                      {barcodeActiveEl && (() => {
                        const m = getLabelElementMetrics(barcodeActiveEl, layout);
                        return (
                          <div
                            onClick={() => setSelectedId(selectedId === 'barcode' ? null : 'barcode')}
                            className={`cursor-pointer bg-white ${selectedId === 'barcode' ? 'outline outline-1 outline-teal-600' : ''}`}
                          >
                            <BarcodeGenerator
                              value={orderData.id}
                              qrContent={buildOrderCustomerQrPayload({
                                order: {
                                  id: orderData.id,
                                  customerName: orderData.customerName,
                                  customerPhone: orderData.customerPhone || '0790000000',
                                  deviceType: 'جوال',
                                  brandModel: orderData.brandModel,
                                  faultDescription: orderData.faultDescription || 'فحص وصيانة عامة',
                                  estimatedCost: orderData.estimatedCost ?? 45,
                                  actualCost: orderData.actualCost,
                                  currency: orderData.currency,
                                  status: DeviceStatus.RECEIVED,
                                  createdAt: orderData.createdAt ? new Date(orderData.createdAt).getTime() : Date.now(),
                                  updatedAt: Date.now(),
                                  statusHistory: [],
                                } as MaintenanceOrder,
                                centerName,
                                centerMobile,
                                currencyName: localStorage.getItem('currencyName') || 'دينار',
                                maxLength: 520,
                              })}
                              width={barcodeActiveEl.width || 1.2}
                              height={m.barcodeHeightPx}
                              physicalHeightMm={m.barcodeHeightMm}
                              targetQrMm={splitMetrics.splitQrSizeMm}
                              showText={false}
                              format={barcodeFormat}
                              maxWidthMm={splitMetrics.effectiveInnerWidthMm}
                              marginModules={0}
                            />
                          </div>
                        );
                      })()}
                      {qrActiveEl && (() => {
                        const m = getLabelElementMetrics(qrActiveEl, layout);
                        return (
                          <div
                            onClick={() => setSelectedId(selectedId === 'qr_code' ? null : 'qr_code')}
                            className={`cursor-pointer bg-white ${selectedId === 'qr_code' ? 'outline outline-1 outline-teal-600' : ''}`}
                          >
                            <QRCodeGenerator
                              value={buildTrackingUrl(orderData.id)}
                              size={m.qrSizePx}
                              compact={true}
                              physicalSizeMm={splitMetrics.splitQrSizeMm || Math.max(m.qrSizeMm, 11)}
                              marginModules={0}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Overflow Alert & 1-click Auto-Fit */}
              {isOverflowing && (
                <div className="w-full mt-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-right">
                  <span className="text-[10px] font-bold text-amber-800 leading-snug">
                    المحتوى يتجاوز ارتفاع الورق ({containerStyles.heightMm} مم) وقد يُقص في الطباعة.
                  </span>
                  <button
                    type="button"
                    onClick={() => updateLayout(fitLabelLayoutToPaper(layout))}
                    className="shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    ملائمة للمقاس
                  </button>
                </div>
              )}

              {/* Bottom cut guide */}
              <div className="w-full flex items-center justify-between text-gray-400 text-[8px] font-mono border-t border-dashed border-gray-300 pt-1.5 mt-2.5 select-none">
                <span>✂️ نهاية الملصق</span>
                <span>{containerStyles.widthMm} × {containerStyles.heightMm} mm</span>
              </div>
            </div>

            {/* Quick Helper Tips */}
            <div className="bg-gray-50 border border-gray-200/60 p-3 rounded-2xl text-[10px] text-gray-500 space-y-1">
              <span className="font-bold text-gray-700 block">ملاحظات الطباعة:</span>
              <p>• المعاينة داخل الإطار المتقطع مطابقة تماماً لمقاس الورق ({containerStyles.widthMm}×{containerStyles.heightMm} مم).</p>
              <p>• اضغط على أي عنصر لتعديله أو اسحب الزاوية لتكبيره وتصغيره.</p>
            </div>
        </div>
      </div>
    </div>
  );
};
