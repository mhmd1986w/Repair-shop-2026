import React, { useState, useEffect, useRef } from 'react';
import {
  ReceiptLayoutConfig,
  ReceiptElementConfig,
  ReceiptElementId,
  getStoredReceiptLayout,
  saveStoredReceiptLayout,
  reorderReceiptElements,
  getDefaultReceiptLayout,
  getReceiptPaperMetrics,
  getResponsiveReceiptFontSize,
  getReceiptAlignmentClass
} from '../utils/receiptDesigner';
import { BarcodeGenerator } from './BarcodeGenerator';
import { QRCodeGenerator } from './QRCodeGenerator';
import { buildTrackingUrl } from '../utils/appDomain';
import { generateBarcodeId, formatCountryDateTime24h } from '../utils/barcode';
import { buildOrderCustomerQrPayload } from '../utils/customerBarcode';
import { DeviceStatus, MaintenanceOrder } from '../types';
import {
  GripVertical,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Save,
  Check,
  Sliders,
  Maximize2,
  MoveVertical,
  FileText,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Image as ImageIcon,
  Store,
  Hash,
  User,
  Smartphone,
  AlertCircle,
  Coins,
  Barcode as BarcodeIcon,
  QrCode,
  ShieldCheck,
  Heart
} from 'lucide-react';

interface ReceiptDesignerProps {
  onLayoutChange?: (newLayout: ReceiptLayoutConfig) => void;
  mockOrder?: {
    customerName: string;
    customerPhone?: string;
    brandModel: string;
    deviceType?: string;
    faultDescription?: string;
    estimatedCost?: number;
    advancePayment?: number;
    id: string;
    createdAt?: string | number;
  };
}

export const ReceiptDesigner: React.FC<ReceiptDesignerProps> = ({ onLayoutChange, mockOrder }) => {
  const [layout, setLayout] = useState<ReceiptLayoutConfig>(() => getStoredReceiptLayout());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<ReceiptElementId | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Active resizing state for live drag-to-resize on preview
  const [resizing, setResizing] = useState<{
    elementId: ReceiptElementId;
    startX: number;
    startY: number;
    initialSize: number;
    isDimension: boolean;
    corner: 'right' | 'left';
  } | null>(null);
  const [sizeDraft, setSizeDraft] = useState<string>('');
  const [barcodeFormat, setBarcodeFormat] = useState<string>(() => localStorage.getItem('lblBarcodeFormat') || 'AUTO');

  // Center info from storage for live preview
  const centerName = localStorage.getItem('centerName') || 'مركز تكنو للصيانة';
  const centerMobile = localStorage.getItem('centerMobile') || '0776400465';
  const centerEmail = localStorage.getItem('centerEmail') || 'mhmd1986w@gmail.com';
  const engineerName = localStorage.getItem('engineerName') || 'م. محمد وليد';
  const centerLogo = localStorage.getItem('centerLogo') || '';
  const currencyName = localStorage.getItem('currencyName') || 'دينار';
  const rcptTermsText = localStorage.getItem('rcptTermsText') || 
    '١. يرجى الحفاظ على هذا الإيصال لتقديمه عند المطالبة باستلام الجهاز.\n٢. المتجر غير مسؤول عن الأجهزة التي لا يستلمها أصحابها بعد مرور ٣٠ يوماً.\n٣. يسري الضمان فقط على قطع الغيار المستبدلة لمدة ٣٠ يوماً من تاريخ الاستلام.';

  const orderData = mockOrder || {
    customerName: 'محمود المجالي',
    customerPhone: '0792110912',
    deviceType: 'لابتوب',
    brandModel: 'لينوفو ميني',
    faultDescription: 'شاشة مكسورة + بحاجة تنظيف وصيانة مروحة',
    estimatedCost: 35,
    advancePayment: 10,
    id: generateBarcodeId(localStorage.getItem('barcodePrefix') || 'TEC'),
    createdAt: new Date().toISOString()
  };

  const layoutRef = useRef<ReceiptLayoutConfig>(layout);
  layoutRef.current = layout;

  const selectedEl = layout.elements.find(e => e.id === selectedId);
  const selectedElFontSize = selectedEl
    ? Math.max(10, Math.min(99, selectedEl.fontSize || (selectedEl.id === 'center_info' ? 13 : 11)))
    : 11;

  useEffect(() => {
    setSizeDraft(String(selectedElFontSize));
  }, [selectedId, selectedElFontSize]);

  useEffect(() => {
    const syncBarcodeFormat = () => {
      const next = localStorage.getItem('lblBarcodeFormat') || 'AUTO';
      setBarcodeFormat(prev => (prev !== next ? next : prev));
    };
    window.addEventListener('storage', syncBarcodeFormat);
    return () => window.removeEventListener('storage', syncBarcodeFormat);
  }, []);

  const updateLayout = (newLayout: ReceiptLayoutConfig) => {
    layoutRef.current = newLayout;
    setLayout(newLayout);
    saveStoredReceiptLayout(newLayout);
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
      const reordered = reorderReceiptElements(current.elements, fromIdx, toIdx);
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

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const current = layoutRef.current;
    const reordered = reorderReceiptElements(current.elements, index, index - 1);
    updateLayout({ ...current, elements: reordered });
  };

  const handleMoveDown = (index: number) => {
    const current = layoutRef.current;
    if (index >= current.elements.length - 1) return;
    const reordered = reorderReceiptElements(current.elements, index, index + 1);
    updateLayout({ ...current, elements: reordered });
  };

  const handleToggleEnable = (id: ReceiptElementId, enabled?: boolean) => {
    const current = layoutRef.current;
    const updatedElements = current.elements.map(el => {
      if (el.id === id) {
        return { ...el, enabled: enabled !== undefined ? enabled : !el.enabled };
      }
      return el;
    });
    updateLayout({ ...current, elements: updatedElements });
  };

  const handleUpdateElement = (id: ReceiptElementId, changes: Partial<ReceiptElementConfig>) => {
    const current = layoutRef.current;
    const updatedElements = current.elements.map(el => {
      if (el.id === id) {
        return { ...el, ...changes };
      }
      return el;
    });
    updateLayout({ ...current, elements: updatedElements });
  };

  // Drag-to-resize listener for receipt canvas
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

      const deltaY = clientY - resizing.startY;
      const deltaX = clientX - resizing.startX;
      // Downward or outward drag increases size, upward or inward decreases size
      const outwardX = resizing.corner === 'right' ? deltaX : -deltaX;
      const delta = deltaY + outwardX * 0.5;

      if (resizing.isDimension) {
        // Height for logo, barcode, or QR in px (10 to 99)
        const newHeight = Math.round(Math.max(10, Math.min(99, resizing.initialSize + delta)));
        handleUpdateElement(resizing.elementId, { height: newHeight });
      } else {
        // Font size in pt (10pt to 99pt)
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

  const startResizeDrag = (e: React.MouseEvent | React.TouchEvent, el: ReceiptElementConfig, corner: 'right' | 'left') => {
    e.stopPropagation();
    e.preventDefault();
    if ('touches' in e && (!e.touches || e.touches.length === 0)) return;
    setSelectedId(el.id);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const isDimension = el.id === 'header_logo' || el.id === 'barcode_section' || el.id === 'qr_section';
    const initialSize = isDimension 
      ? Math.max(10, Math.min(99, el.height || (el.id === 'header_logo' ? 48 : el.id === 'barcode_section' ? 36 : 52)))
      : Math.max(10, Math.min(99, el.fontSize || (el.id === 'center_info' ? 13 : el.id === 'invoice_badge' ? 11 : 10.5)));

    setResizing({
      elementId: el.id,
      startX: clientX,
      startY: clientY,
      initialSize,
      isDimension,
      corner
    });
  };

  const handleResetDefaults = () => {
    if (window.confirm('هل ترغب في إعادة ضبط ترتيب وأحجام عناصر إيصال الاستلام إلى الوضع الافتراضي القياسي؟')) {
      const def = getDefaultReceiptLayout();
      updateLayout(def);
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
    }
  };

  const getElementIcon = (id: ReceiptElementId) => {
    switch (id) {
      case 'header_logo': return <ImageIcon className="w-4 h-4 text-teal-600" />;
      case 'center_info': return <Store className="w-4 h-4 text-teal-600" />;
      case 'invoice_badge': return <Hash className="w-4 h-4 text-teal-600" />;
      case 'customer_info': return <User className="w-4 h-4 text-teal-600" />;
      case 'device_info': return <Smartphone className="w-4 h-4 text-teal-600" />;
      case 'fault_info': return <AlertCircle className="w-4 h-4 text-teal-600" />;
      case 'cost_info': return <Coins className="w-4 h-4 text-teal-600" />;
      case 'barcode_section': return <BarcodeIcon className="w-4 h-4 text-teal-600" />;
      case 'qr_section': return <QrCode className="w-4 h-4 text-teal-600" />;
      case 'terms_section': return <ShieldCheck className="w-4 h-4 text-teal-600" />;
      case 'footer_thanks': return <Heart className="w-4 h-4 text-teal-600" />;
    }
  };

  const activeElements = layout.elements.filter(el => el.enabled);
  const inactiveElements = layout.elements.filter(el => !el.enabled);

  const paperMetrics = getReceiptPaperMetrics(layout.paperSize);

  // Render receipt content element
  const renderPreviewElement = (el: ReceiptElementConfig) => {
    switch (el.id) {
      case 'header_logo':
        return centerLogo ? (
          <div className="inline-flex justify-center max-w-full py-0.5">
            <img
              src={centerLogo}
              alt="Logo"
              style={{ height: `${el.height || 48}px`, maxHeight: '100px' }}
              className="max-w-full object-contain rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="text-center py-0.5 px-1 text-gray-400 text-xs font-semibold">
            [شعار المركز]
          </div>
        );

      case 'center_info':
        return (
          <div
            className="w-fit max-w-full min-w-0 space-y-0.5 leading-tight break-words [overflow-wrap:anywhere]"
            style={{
              fontSize: getResponsiveReceiptFontSize(el.fontSize, 13, layout.paperSize),
              fontWeight: el.bold ? 800 : 600,
              textAlign: el.textAlign || 'center'
            }}
          >
            <div className="text-gray-950 font-extrabold tracking-tight break-words">{centerName}</div>
            <div className="text-[0.78em] text-gray-500 font-sans font-medium break-words">
              بإشراف المهندس: {engineerName}
            </div>
            <div className="text-[0.75em] text-gray-500 font-mono tabular-nums flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 break-all" dir="ltr">
              <span>{centerMobile}</span>
              {centerEmail && (
                <>
                  <span aria-hidden="true">|</span>
                  <span className="break-all">{centerEmail}</span>
                </>
              )}
            </div>
          </div>
        );

      case 'invoice_badge':
        return (
          <div
            className="w-fit max-w-full min-w-0 bg-gray-50 border border-gray-200/80 rounded-xl py-1 px-2.5 leading-tight break-words [overflow-wrap:anywhere]"
            style={{
              fontSize: getResponsiveReceiptFontSize(el.fontSize, 11, layout.paperSize),
              textAlign: el.textAlign || 'center'
            }}
          >
            <div className="text-[0.82em] text-gray-500 font-semibold">إيصال استلام جهاز للصيانة</div>
            <div className="font-mono tabular-nums font-black text-teal-800 text-[1.15em] tracking-wider break-all" dir="ltr">
              #{orderData.id}
            </div>
            <div className="text-[0.75em] text-gray-500 font-mono tabular-nums" dir="ltr">
              {formatCountryDateTime24h(orderData.createdAt || Date.now())}
            </div>
          </div>
        );

      case 'customer_info':
        return (
          <div
            className="w-fit max-w-full min-w-0 space-y-1 py-0.5 border-b border-dashed border-gray-200 leading-tight"
            style={{
              fontSize: getResponsiveReceiptFontSize(el.fontSize, 11, layout.paperSize),
              fontWeight: el.bold ? 700 : 500,
              textAlign: el.textAlign || 'right'
            }}
          >
            <div className="flex flex-wrap justify-between items-baseline text-[1em] gap-x-2.5 gap-y-0.5">
              <span className="text-gray-500 font-semibold shrink-0">اسم العميل:</span>
              <span className="font-bold text-gray-900 min-w-0 break-words [overflow-wrap:anywhere]">{orderData.customerName}</span>
            </div>
            {orderData.customerPhone && (
              <div className="flex flex-wrap justify-between items-baseline text-[1em] gap-x-2.5 gap-y-0.5">
                <span className="text-gray-500 font-semibold shrink-0">رقم الهاتف:</span>
                <span className="font-mono tabular-nums text-gray-800 min-w-0 break-all" dir="ltr">{orderData.customerPhone}</span>
              </div>
            )}
          </div>
        );

      case 'device_info':
        return (
          <div
            className="w-fit max-w-full min-w-0 space-y-1 py-0.5 border-b border-dashed border-gray-200 leading-tight"
            style={{
              fontSize: getResponsiveReceiptFontSize(el.fontSize, 11, layout.paperSize),
              fontWeight: el.bold ? 700 : 500,
              textAlign: el.textAlign || 'right'
            }}
          >
            <div className="flex flex-wrap justify-between items-baseline text-[1em] gap-x-2.5 gap-y-0.5">
              <span className="text-gray-500 font-semibold shrink-0">الجهاز والموديل:</span>
              <span className="font-bold text-gray-900 min-w-0 break-words [overflow-wrap:anywhere]">{orderData.deviceType} - {orderData.brandModel}</span>
            </div>
          </div>
        );

      case 'fault_info':
        return (
          <div
            className="w-fit max-w-full min-w-0 space-y-1 py-0.5 border-b border-dashed border-gray-200 leading-tight"
            style={{
              fontSize: getResponsiveReceiptFontSize(el.fontSize, 10.5, layout.paperSize),
              textAlign: el.textAlign || 'right'
            }}
          >
            <div className="text-gray-500 font-semibold text-[0.9em]">العطل الموصوف:</div>
            <div className="w-fit max-w-full text-gray-900 font-medium text-[1em] bg-gray-50/80 px-2 py-0.5 rounded-lg border border-gray-200/70 break-words [overflow-wrap:anywhere]">
              {orderData.faultDescription}
            </div>
          </div>
        );

      case 'cost_info': {
        const remaining = Math.max(0, (orderData.estimatedCost || 0) - (orderData.advancePayment || 0));
        return (
          <div
            className="w-fit max-w-full min-w-0 space-y-1 py-1 border-b border-dashed border-gray-200 leading-tight"
            style={{
              fontSize: getResponsiveReceiptFontSize(el.fontSize, 12, layout.paperSize),
              textAlign: el.textAlign || 'right'
            }}
          >
            <div className="flex flex-wrap justify-between items-baseline text-[1em] gap-x-2.5 gap-y-0.5">
              <span className="text-gray-500 font-bold shrink-0">التكلفة التقديرية:</span>
              <span className="font-black text-teal-800 font-mono tabular-nums break-words">
                {orderData.estimatedCost} {currencyName}
              </span>
            </div>
            {orderData.advancePayment ? (
              <>
                <div className="flex flex-wrap justify-between items-baseline text-[0.9em] gap-x-2.5 gap-y-0.5">
                  <span className="text-gray-500 shrink-0">الدفعة المقدمة:</span>
                  <span className="font-mono tabular-nums text-emerald-700 break-words">{orderData.advancePayment} {currencyName}</span>
                </div>
                <div className="flex flex-wrap justify-between items-baseline text-[0.9em] font-bold gap-x-2.5 gap-y-0.5">
                  <span className="text-gray-600 shrink-0">المتبقي عند الاستلام:</span>
                  <span className="font-mono tabular-nums text-rose-700 break-words">{remaining} {currencyName}</span>
                </div>
              </>
            ) : null}
          </div>
        );
      }

      case 'barcode_section':
        return (
          <div
            className="inline-flex flex-col items-center justify-center w-fit max-w-full min-w-0 py-1 border-b border-dashed border-gray-200 overflow-hidden"
            style={{ textAlign: el.textAlign || 'center' }}
          >
            <div className="inline-flex flex-col items-center max-w-full bg-white px-1 py-0.5 rounded-lg overflow-hidden">
              <BarcodeGenerator
                value={orderData.id}
                qrContent={buildOrderCustomerQrPayload({
                  order: {
                    id: orderData.id,
                    customerName: orderData.customerName,
                    customerPhone: orderData.customerPhone || '',
                    deviceType: orderData.deviceType || 'لابتوب',
                    brandModel: orderData.brandModel,
                    faultDescription: orderData.faultDescription || 'فحص وصيانة عامة',
                    estimatedCost: orderData.estimatedCost ?? 35,
                    advancePayment: orderData.advancePayment,
                    status: DeviceStatus.RECEIVED,
                    createdAt: orderData.createdAt ? new Date(orderData.createdAt).getTime() : Date.now(),
                    updatedAt: Date.now(),
                    statusHistory: [],
                  } as MaintenanceOrder,
                  centerName,
                  centerMobile,
                  currencyName,
                  maxLength: 550,
                })}
                width={el.width || 1.3}
                height={el.height || 36}
                showText={true}
                showModeBadge={true}
                format={barcodeFormat}
                fontSize={Math.max(10, Math.min(99, el.fontSize || 10))}
                maxWidthMm={paperMetrics.maxBarcodeMm}
              />
            </div>
            <span className="text-[9px] text-gray-400 font-mono tabular-nums mt-0.5 break-all" dir="ltr">
              #{orderData.id}
            </span>
          </div>
        );

      case 'qr_section':
        return (
          <div
            className="inline-flex flex-col items-center justify-center w-fit max-w-full min-w-0 py-1 border-b border-dashed border-gray-200"
            style={{ textAlign: el.textAlign || 'center' }}
          >
            <div className="p-1 bg-white rounded-lg border border-gray-200 shadow-2xs w-fit max-w-full">
              <QRCodeGenerator
                value={buildTrackingUrl(orderData.id)}
                size={el.height || 52}
              />
            </div>
            <span className="text-[8.5px] text-gray-400 mt-1 break-words max-w-full">
              امسح الكود لتتبع حالة صيانة جهازك فوراً
            </span>
          </div>
        );

      case 'terms_section':
        return (
          <div
            className="w-fit max-w-full min-w-0 py-1 space-y-0.5 text-gray-600 leading-snug font-sans break-words [overflow-wrap:anywhere]"
            style={{
              fontSize: getResponsiveReceiptFontSize(el.fontSize, 10, layout.paperSize),
              textAlign: el.textAlign || 'center'
            }}
          >
            <div className="font-bold text-gray-800 text-[1em]">شروط وأحكام الصيانة والضمان:</div>
            {rcptTermsText.split('\n').map((line, i) => (
              <p key={i} className="text-[0.9em] text-gray-500 break-words">{line}</p>
            ))}
          </div>
        );

      case 'footer_thanks':
        return (
          <div
            className="w-fit max-w-full min-w-0 py-0.5 text-gray-700 font-bold leading-tight break-words [overflow-wrap:anywhere]"
            style={{
              fontSize: getResponsiveReceiptFontSize(el.fontSize, 10, layout.paperSize),
              textAlign: el.textAlign || 'center'
            }}
          >
            شكراً لثقتكم بنا • نسعد بخدمتكم دائماً
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Main Designer Grid: Left = Elements Reorder & Sizing, Right = Live Interactive Receipt */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Active Elements List (Drag & Drop, Resize, Margins) */}
        <div className="lg:col-span-7 space-y-5 font-sans min-w-0">
          
          <div className="bg-white rounded-3xl border border-gray-100 p-4 sm:p-6 md:p-8 space-y-4 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h4 className="font-sans font-bold text-gray-900 text-sm shrink-0">
                  محتويات وأقسام الإيصال الحالية ({activeElements.length})
                </h4>

                {/* Dropdown with receipt paper sizes */}
                <div className="flex items-center gap-1.5 bg-gray-50 hover:bg-teal-50/50 border border-gray-200 hover:border-teal-400 rounded-xl px-2.5 py-1 transition-all max-w-full">
                  <span className="text-[10px] text-gray-500 font-bold whitespace-nowrap">قياس الورق:</span>
                  <select
                    value={layout.paperSize}
                    onChange={(e) => {
                      updateLayout({ ...layout, paperSize: e.target.value as any });
                      localStorage.setItem('rcptSize', e.target.value);
                    }}
                    className="bg-transparent font-sans text-xs font-black text-teal-800 outline-none cursor-pointer py-0.5 text-right max-w-full"
                  >
                    <option value="80mm">طابعة حرارية 80mm (القياسي الشائع)</option>
                    <option value="58mm">طابعة حرارية 58mm (مصغر للموبايل)</option>
                    <option value="A5">ورق A5 (نصف صفحة مكتبية)</option>
                    <option value="A4">ورق A4 (صفحة قياسية رسمية)</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-gray-400 font-medium hidden md:inline">
                  اسحب بالماوس ⠿ لتغيير الترتيب والمكان
                </span>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700 font-bold transition-colors cursor-pointer"
                  title="إعادة ضبط ترتيب وأحجام عناصر إيصال الاستلام للافتراضي"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>إعادة ضبط</span>
                </button>
              </div>
            </div>

            {/* Elements list with drag and drop */}
            <div className="space-y-3">
              {activeElements.map((el, idx) => {
                const isSelected = selectedId === el.id;
                const isDragged = draggedId === el.id;
                const isDragOver = dragOverId === el.id;

                return (
                  <div
                    key={el.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(el.id, e)}
                    onDragOver={(e) => handleDragOver(el.id, e)}
                    onDragLeave={() => handleDragLeave(el.id)}
                    onDrop={(e) => handleDrop(el.id, e)}
                    onDragEnd={handleDragEnd}
                    className={`rounded-2xl border transition-all duration-150 p-3 sm:p-3.5 bg-white select-none ${
                      isDragged ? 'opacity-40 scale-[0.98] border-teal-400 shadow-md' : ''
                    } ${
                      isDragOver ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20' : 'border-gray-200/80 hover:border-teal-300'
                    } ${
                      isSelected ? 'ring-2 ring-teal-600/30 border-teal-500 bg-teal-50/10' : ''
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Drag Handle */}
                        <div 
                          className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-gray-100 text-gray-400 hover:text-teal-700 rounded-lg transition-colors flex items-center justify-center shrink-0"
                          title="اسحب لتغيير موضع وترتيب هذا القسم"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Order Number Badge */}
                        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-black font-mono flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>

                        {/* Icon & Label */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0">{getElementIcon(el.id)}</span>
                          <span className="font-extrabold text-xs text-gray-800 truncate">
                            {el.label}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons: Up, Down, Size/Style Toggle, Delete */}
                      <div className="flex items-center gap-1 shrink-0 mr-auto sm:mr-0">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-teal-700 hover:bg-teal-50 disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
                          title="تحريك للأعلى"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === activeElements.length - 1}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-teal-700 hover:bg-teal-50 disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
                          title="تحريك للأسفل"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Expand Size and Position Controls */}
                        <button
                          type="button"
                          onClick={() => setSelectedId(isSelected ? null : el.id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                            isSelected 
                              ? 'bg-teal-600 text-white border-teal-600' 
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {isSelected ? 'إغلاق الخيارات' : 'تعديل الحجم والمسافة'}
                        </button>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => handleToggleEnable(el.id, false)}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="إخفاء من الإيصال"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Controls for Size, Height, Margins, and Alignment */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-3 bg-gray-50/70 p-3 rounded-xl animate-in fade-in duration-150">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Font Size controls (10pt to 99pt) */}
                          {el.id !== 'header_logo' && el.id !== 'barcode_section' && el.id !== 'qr_section' && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-gray-700">حجم الخط (10 - 99 pt):</span>
                                <span className="font-mono font-black text-xs text-teal-700">{Math.max(10, Math.min(99, el.fontSize || 11))} pt</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateElement(el.id, { fontSize: Math.max(10, Math.min(99, (el.fontSize || 11) - 0.5)) })}
                                  className="w-7 h-7 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg font-bold text-xs flex items-center justify-center text-gray-700 cursor-pointer"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={10}
                                  max={99}
                                  step={0.5}
                                  value={sizeDraft}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    setSizeDraft(raw);
                                    const val = parseFloat(raw);
                                    if (!isNaN(val) && val >= 10 && val <= 99) {
                                      handleUpdateElement(el.id, { fontSize: Math.round(val * 2) / 2 });
                                    }
                                  }}
                                  onBlur={() => {
                                    const val = parseFloat(sizeDraft);
                                    const clamped = isNaN(val)
                                      ? Math.max(10, Math.min(99, el.fontSize || 11))
                                      : Math.round(Math.max(10, Math.min(99, val)) * 2) / 2;
                                    setSizeDraft(String(clamped));
                                    handleUpdateElement(el.id, { fontSize: clamped });
                                  }}
                                  className="w-16 font-mono font-black text-xs text-teal-800 bg-white px-2 py-1 rounded-lg border border-gray-200 text-center focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateElement(el.id, { fontSize: Math.min(99, Math.max(10, (el.fontSize || 11) + 0.5)) })}
                                  className="w-7 h-7 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg font-bold text-xs flex items-center justify-center text-gray-700 cursor-pointer"
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateElement(el.id, { bold: !el.bold })}
                                  className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                    el.bold ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'
                                  }`}
                                >
                                  عريض (B)
                                </button>
                              </div>
                              <input
                                type="range"
                                min="10"
                                max="99"
                                step="0.5"
                                value={Math.max(10, Math.min(99, el.fontSize || 11))}
                                onChange={(e) => handleUpdateElement(el.id, { fontSize: parseFloat(e.target.value) })}
                                className="w-full accent-teal-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                              />
                            </div>
                          )}

                          {/* Logo Height */}
                          {el.id === 'header_logo' && (
                            <div className="space-y-1">
                              <span className="text-[11px] font-bold text-gray-700 block">ارتفاع شعار المركز (10 - 99):</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min="10"
                                  max="99"
                                  step="1"
                                  value={Math.max(10, Math.min(99, el.height || 48))}
                                  onChange={(e) => handleUpdateElement(el.id, { height: Number(e.target.value) })}
                                  className="w-full accent-teal-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                                />
                                <span className="font-mono text-xs font-bold text-teal-700 min-w-[40px] text-left">{Math.max(10, Math.min(99, el.height || 48))}px</span>
                              </div>
                            </div>
                          )}

                          {/* Barcode Sizing */}
                          {el.id === 'barcode_section' && (
                            <>
                              <div className="space-y-1">
                                <span className="text-[11px] font-bold text-gray-700 block">ارتفاع الباركود (10 - 99):</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min="10"
                                    max="99"
                                    step="1"
                                    value={Math.max(10, Math.min(99, el.height || 38))}
                                    onChange={(e) => handleUpdateElement(el.id, { height: Number(e.target.value) })}
                                    className="w-full accent-teal-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                                  />
                                  <span className="font-mono text-xs font-bold text-teal-700 min-w-[40px] text-left">{Math.max(10, Math.min(99, el.height || 38))}px</span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[11px] font-bold text-gray-700 block">حجم خط رقم الباركود (10 - 99 pt):</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min="10"
                                    max="99"
                                    step="0.5"
                                    value={Math.max(10, Math.min(99, el.fontSize || 10))}
                                    onChange={(e) => handleUpdateElement(el.id, { fontSize: parseFloat(e.target.value) })}
                                    className="w-full accent-teal-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                                  />
                                  <span className="font-mono text-xs font-bold text-teal-700 min-w-[42px] text-left">{Math.max(10, Math.min(99, el.fontSize || 10))}pt</span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[11px] font-bold text-gray-700 block">عرض خطوط الباركود:</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min="0.9"
                                    max="2.0"
                                    step="0.1"
                                    value={el.width || 1.3}
                                    onChange={(e) => handleUpdateElement(el.id, { width: parseFloat(e.target.value) })}
                                    className="w-full accent-teal-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                                  />
                                  <span className="font-mono text-xs font-bold text-teal-700 min-w-[36px] text-left">{el.width || 1.3}x</span>
                                </div>
                              </div>
                            </>
                          )}

                          {/* QR Code Height */}
                          {el.id === 'qr_section' && (
                            <div className="space-y-1">
                              <span className="text-[11px] font-bold text-gray-700 block">حجم رمز الـ QR (10 - 99):</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min="10"
                                  max="99"
                                  step="1"
                                  value={Math.max(10, Math.min(99, el.height || 52))}
                                  onChange={(e) => handleUpdateElement(el.id, { height: Number(e.target.value) })}
                                  className="w-full accent-teal-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                                />
                                <span className="font-mono text-xs font-bold text-teal-700 min-w-[40px] text-left">{Math.max(10, Math.min(99, el.height || 52))}px</span>
                              </div>
                            </div>
                          )}

                          {/* Alignment */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-gray-700 block">المحاذاة الأفقية:</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateElement(el.id, { textAlign: 'right' })}
                                className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 cursor-pointer ${
                                  (el.textAlign || 'right') === 'right' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'
                                }`}
                              >
                                <AlignRight className="w-3.5 h-3.5" />
                                <span>يمين</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateElement(el.id, { textAlign: 'center' })}
                                className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 cursor-pointer ${
                                  el.textAlign === 'center' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'
                                }`}
                              >
                                <AlignCenter className="w-3.5 h-3.5" />
                                <span>وسط</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateElement(el.id, { textAlign: 'left' })}
                                className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 cursor-pointer ${
                                  el.textAlign === 'left' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'
                                }`}
                              >
                                <AlignLeft className="w-3.5 h-3.5" />
                                <span>يسار</span>
                              </button>
                            </div>
                          </div>

                          {/* Vertical Spacing / Margins */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-gray-700 block">المسافة قبل / بعد (الهامش):</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-500">أعلى:</span>
                              <input
                                type="number"
                                min="0"
                                max="25"
                                value={el.marginTop || 0}
                                onChange={(e) => handleUpdateElement(el.id, { marginTop: Math.max(0, Number(e.target.value)) })}
                                className="w-12 px-1.5 py-1 bg-white border border-gray-200 rounded text-center text-xs font-mono font-bold"
                              />
                              <span className="text-[10px] text-gray-500">أسفل:</span>
                              <input
                                type="number"
                                min="0"
                                max="25"
                                value={el.marginBottom || 0}
                                onChange={(e) => handleUpdateElement(el.id, { marginBottom: Math.max(0, Number(e.target.value)) })}
                                className="w-12 px-1.5 py-1 bg-white border border-gray-200 rounded text-center text-xs font-mono font-bold"
                              />
                              <span className="text-[10px] text-gray-400">px</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inactive / Available Elements to Re-add */}
          {inactiveElements.length > 0 && (
            <div className="bg-gray-50/80 rounded-3xl border border-dashed border-gray-300 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-gray-700 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-teal-600" />
                  <span>أقسام إضافية يمكنك إضافتها للإيصال:</span>
                </span>
                <span className="text-[10px] text-gray-400">انقر لإعادة القسم للإيصال فوراً</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {inactiveElements.map(el => (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => handleToggleEnable(el.id, true)}
                    className="flex items-center justify-between p-2.5 bg-white hover:bg-teal-50/60 border border-gray-200 hover:border-teal-300 rounded-xl transition-all text-right group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {getElementIcon(el.id)}
                      <span className="text-xs font-bold text-gray-800">{el.label}</span>
                    </div>
                    <span className="text-[11px] font-bold text-teal-600 group-hover:translate-x-[-2px] transition-transform">
                      + إضافة
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Save Status and Action */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {showSavedToast && (
                <span className="text-emerald-600 font-bold text-xs flex items-center gap-1 animate-in fade-in">
                  <Check className="w-4 h-4" />
                  تم حفظ تصميم إيصال الاستلام بنجاح!
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                saveStoredReceiptLayout(layout);
                setShowSavedToast(true);
                setTimeout(() => setShowSavedToast(false), 3000);
              }}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-sans font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>حفظ التصميم وتطبيقه للطباعة</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Interactive Receipt Canvas with Direct Mouse & Touch Dragging */}
        <div className="lg:col-span-5 flex flex-col items-center justify-start lg:sticky lg:top-6 font-sans min-w-0 w-full">
          <div className="w-full max-w-full space-y-3 flex flex-col items-center">
            
            <div className="w-full max-w-md bg-teal-50/80 border border-teal-100 p-3 rounded-2xl text-center space-y-1">
              <span className="text-[11px] font-bold text-teal-900 block">
                معاينة فورية تفاعلية لإيصال الاستلام
              </span>
              <p className="text-[10px] text-teal-700 leading-normal">
                💡 يمكنك الإمساك بأي عنصر بالماوس لتغيير موضعه، أو <span className="font-bold underline">سحب زاوية الصندوق (⤡) لتكبيره وتصغيره بالسحب والإفلات مباشرة</span>!
              </p>
            </div>

            {/* Faux Thermal Paper Container */}
            <div className="relative mx-auto bg-gray-100 p-2.5 sm:p-4 rounded-2xl border border-gray-200/80 flex flex-col items-center justify-center w-full max-w-full overflow-x-auto">
              {/* Paper Top Cut Guide */}
              <div
                className="w-full max-w-full flex items-center justify-between text-gray-400 text-[9px] font-mono border-b border-dashed border-gray-300 pb-1 mb-2 select-none"
                style={{ maxWidth: `${paperMetrics.screenMaxWidthPx}px` }}
              >
                <span>✂️ حد ورق الفاتورة الحرارية</span>
                <span>{layout.paperSize}</span>
              </div>

              {/* The Actual Receipt Sheet */}
              <div
                className="bg-[#FAF9F6] text-gray-800 border border-gray-300 rounded-t-sm select-none font-sans overflow-visible relative shadow-sm transition-all w-full max-w-full flex flex-col mx-auto"
                style={{
                  maxWidth: `${paperMetrics.screenMaxWidthPx}px`,
                  zoom: layout.zoom !== 100 ? layout.zoom / 100 : undefined,
                  padding: `clamp(8px, ${layout.padding * 2}px, 24px)`,
                  lineHeight: layout.lineSpacing
                }}
              >
                {/* Active Receipt Elements rendered in user's drag-and-drop order */}
                {activeElements.map((el) => {
                  const isHovered = dragOverId === el.id;
                  const isBeingDragged = draggedId === el.id;
                  const isSelected = selectedId === el.id;
                  const isCurrentlyResizing = resizing?.elementId === el.id;
                  const alignClass = getReceiptAlignmentClass(el.textAlign);

                  const isDimension = el.id === 'header_logo' || el.id === 'barcode_section' || el.id === 'qr_section';
                  const currentDisplaySize = isDimension 
                    ? `${Math.max(10, Math.min(99, el.height || (el.id === 'header_logo' ? 48 : el.id === 'barcode_section' ? 36 : 52)))}px`
                    : `${Math.max(10, Math.min(99, el.fontSize || 11))}pt`;

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
                      onClick={() => setSelectedId(isSelected ? null : el.id)}
                      className={`w-fit max-w-full min-w-0 ${alignClass} transition-all relative group rounded-md py-0.5 px-1 ${
                        isBeingDragged ? 'opacity-30' : ''
                      } ${isHovered ? 'border-teal-500 bg-teal-100/40 ring-1 ring-teal-400' : ''} ${
                        isSelected 
                          ? 'border-2 border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/15 shadow-xs' 
                          : 'border border-transparent hover:border-teal-400 hover:bg-teal-50/20'
                      }`}
                      style={{
                        marginTop: `${(el.marginTop || 0) * layout.lineSpacing}px`,
                        marginBottom: `${(el.marginBottom || 0) * layout.lineSpacing}px`
                      }}
                      title="اسحب لتغيير الموضع، أو اسحب الزاوية لتكبير وتصغير الصندوق"
                    >
                      {/* Floating Mini Toolbar when Selected */}
                      {isSelected && (
                        <div
                          className="absolute -top-7 left-1/2 -translate-x-1/2 bg-teal-900 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center flex-wrap justify-center gap-1.5 z-30 pointer-events-auto max-w-[calc(100vw-2.5rem)] whitespace-nowrap animate-in fade-in zoom-in-95 duration-100 select-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-teal-200">الحجم:</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (isDimension) {
                                handleUpdateElement(el.id, { height: Math.max(10, (el.height || 40) - 4) });
                              } else {
                                handleUpdateElement(el.id, { fontSize: Math.max(10, Math.min(99, (el.fontSize || 11) - 0.5)) });
                              }
                            }}
                            className="w-4 h-4 bg-teal-800 hover:bg-teal-700 rounded flex items-center justify-center cursor-pointer text-white font-bold"
                            title="تصغير"
                          >
                            -
                          </button>
                          <span className="font-mono text-white min-w-[32px] text-center font-black">
                            {currentDisplaySize}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (isDimension) {
                                handleUpdateElement(el.id, { height: Math.min(99, (el.height || 40) + 4) });
                              } else {
                                handleUpdateElement(el.id, { fontSize: Math.min(99, Math.max(10, (el.fontSize || 11) + 0.5)) });
                              }
                            }}
                            className="w-4 h-4 bg-teal-800 hover:bg-teal-700 rounded flex items-center justify-center cursor-pointer text-white font-bold"
                            title="تكبير"
                          >
                            +
                          </button>
                          <span className="text-[8px] text-teal-300 border-r border-teal-700 pr-1 mr-0.5">
                            ⤡ اسحب الزاوية لتكبير/تصغير
                          </span>
                        </div>
                      )}

                      {/* Corner Resize Handles */}
                      {(isSelected || isHovered) && (
                        <>
                          <div
                            draggable={false}
                            onMouseDown={(e) => startResizeDrag(e, el, 'right')}
                            onTouchStart={(e) => startResizeDrag(e, el, 'right')}
                            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-md flex items-center justify-center cursor-nwse-resize z-20 transition-transform hover:scale-125 select-none"
                            title="اسحب بالماوس أو اللمس لتكبير وتصغير هذا الصندوق"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[9px] font-mono leading-none select-none">⤡</span>
                          </div>

                          <div
                            draggable={false}
                            onMouseDown={(e) => startResizeDrag(e, el, 'left')}
                            onTouchStart={(e) => startResizeDrag(e, el, 'left')}
                            className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-md flex items-center justify-center cursor-nesw-resize z-20 transition-transform hover:scale-125 select-none"
                            title="اسحب بالماوس أو اللمس لتكبير وتصغير هذا الصندوق"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[9px] font-mono leading-none select-none">⤢</span>
                          </div>
                        </>
                      )}

                      {/* Active Resizing Overlay Badge */}
                      {isCurrentlyResizing && (
                        <div className="absolute inset-0 bg-teal-600/15 border-2 border-teal-500 rounded flex items-center justify-center z-30 pointer-events-none">
                          <span className="bg-teal-950 text-white font-mono font-black text-xs px-2.5 py-1 rounded-lg shadow-xl animate-pulse flex items-center gap-1.5 border border-teal-400">
                            <span>📐 الحجم الحالي:</span>
                            <span className="text-amber-300">
                              {currentDisplaySize}
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Drag overlay indicator */}
                      <span className="absolute top-0 right-1 opacity-0 group-hover:opacity-100 text-[8px] bg-teal-600 text-white px-1 rounded transition-opacity pointer-events-none z-10">
                        ⠿ اسحب لتغيير الموضع
                      </span>

                      {/* Render Element */}
                      {renderPreviewElement(el)}
                    </div>
                  );
                })}

                {/* Faux Tear Strip Bottom Edge */}
                <div className="h-2 bg-gradient-to-t from-gray-200/50 to-transparent flex overflow-hidden mt-4">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} className="w-4 h-4 bg-white rotate-45 transform origin-top-left -translate-y-2 shrink-0 border border-gray-100" />
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
