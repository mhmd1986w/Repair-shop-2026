import React, { useState } from 'react';
import { 
  LabelLayoutConfig, 
  LabelElementConfig, 
  LabelElementId, 
  getStoredLabelLayout, 
  saveStoredLabelLayout, 
  reorderElements, 
  getDefaultLabelLayout,
  DEFAULT_LABEL_ELEMENTS 
} from '../utils/labelDesigner';
import { BarcodeGenerator } from './BarcodeGenerator';
import { QRCodeGenerator } from './QRCodeGenerator';
import { 
  GripVertical, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Type, 
  Maximize2, 
  Sliders, 
  Settings, 
  Check, 
  RotateCcw, 
  Save, 
  Store, 
  Phone, 
  User, 
  Smartphone, 
  Calendar, 
  Barcode as BarcodeIcon, 
  QrCode, 
  FileText,
  MoveVertical
} from 'lucide-react';

interface LabelDesignerProps {
  onLayoutChange?: (newLayout: LabelLayoutConfig) => void;
  mockOrder?: {
    customerName: string;
    brandModel: string;
    id: string;
    createdAt?: string;
  };
}

export const LabelDesigner: React.FC<LabelDesignerProps> = ({ onLayoutChange, mockOrder }) => {
  const [layout, setLayout] = useState<LabelLayoutConfig>(() => getStoredLabelLayout());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<LabelElementId | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Center info from storage for live preview
  const centerName = localStorage.getItem('centerName') || 'مركز تكنو للصيانة';
  const centerMobile = localStorage.getItem('centerMobile') || '05xxxxxxxx';
  const barcodeFormat = localStorage.getItem('lblBarcodeFormat') || 'CODE128';

  const orderData = mockOrder || {
    customerName: 'أحمد محمد عبد الله',
    brandModel: 'iPhone 14 Pro Max',
    id: 'TEC26112112',
    createdAt: new Date().toISOString()
  };

  const updateLayout = (newLayout: LabelLayoutConfig) => {
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

    const fromIdx = layout.elements.findIndex(el => el.id === sourceId);
    const toIdx = layout.elements.findIndex(el => el.id === targetId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const reordered = reorderElements(layout.elements, fromIdx, toIdx);
      const updated = { ...layout, elements: reordered };
      updateLayout(updated);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const reordered = reorderElements(layout.elements, index, index - 1);
    updateLayout({ ...layout, elements: reordered });
  };

  const handleMoveDown = (index: number) => {
    if (index >= layout.elements.length - 1) return;
    const reordered = reorderElements(layout.elements, index, index + 1);
    updateLayout({ ...layout, elements: reordered });
  };

  const handleToggleEnable = (id: LabelElementId, enabled?: boolean) => {
    const updatedElements = layout.elements.map(el => {
      if (el.id === id) {
        return { ...el, enabled: enabled !== undefined ? enabled : !el.enabled };
      }
      return el;
    });
    updateLayout({ ...layout, elements: updatedElements });
  };

  const handleUpdateElement = (id: LabelElementId, changes: Partial<LabelElementConfig>) => {
    const updatedElements = layout.elements.map(el => {
      if (el.id === id) {
        return { ...el, ...changes };
      }
      return el;
    });
    updateLayout({ ...layout, elements: updatedElements });
  };

  const handleResetDefaults = () => {
    if (window.confirm('هل ترغب حقاً في إعادة ضبط ترتيب وأحجام الملصق إلى الوضع الافتراضي القياسي؟')) {
      const def = getDefaultLabelLayout();
      updateLayout(def);
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
    }
  };

  const getElementIcon = (id: LabelElementId) => {
    switch (id) {
      case 'center_name': return <Store className="w-4 h-4 text-teal-600" />;
      case 'center_mobile': return <Phone className="w-4 h-4 text-teal-600" />;
      case 'customer_name': return <User className="w-4 h-4 text-teal-600" />;
      case 'device_model': return <Smartphone className="w-4 h-4 text-teal-600" />;
      case 'order_date': return <Calendar className="w-4 h-4 text-teal-600" />;
      case 'barcode': return <BarcodeIcon className="w-4 h-4 text-teal-600" />;
      case 'qr_code': return <QrCode className="w-4 h-4 text-teal-600" />;
      case 'custom_text': return <FileText className="w-4 h-4 text-teal-600" />;
    }
  };

  // Dimensions of preview
  const [pWidth, pHeight] = layout.paperSize.split('x').map(Number);
  const ratio = (pWidth && pHeight) ? pWidth / pHeight : 5 / 3;
  const previewWidthPx = 280;
  const previewHeightPx = Math.round(previewWidthPx / ratio);

  const activeElements = layout.elements.filter(el => el.enabled);
  const inactiveElements = layout.elements.filter(el => !el.enabled);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Controls: Paper Size, Barcode Format & Global Spacing */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 md:p-8 space-y-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="font-sans font-extrabold text-base text-gray-800 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-teal-600" />
              <span>مصمم وتنسيق ملصق الباركود الحراري التفاعلي</span>
            </h3>
            <p className="text-gray-400 text-xs mt-1">
              يمكنك إضافة أو إزالة أي عنصر، وتعديل حجمه وطوله، وضبط المسافات بين الأسطر، وتحريك العناصر بالماوس بالسحب والإفلات مباشرة!
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-xl text-xs font-bold transition-all border border-gray-200 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط قياسي</span>
          </button>
        </div>

        {/* Global Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Paper Size */}
          <div className="space-y-1.5 text-right">
            <label className="text-gray-700 font-bold text-xs flex items-center gap-1">
              <Settings className="w-3.5 h-3.5 text-teal-600" />
              <span>قياس ورق الملصق (الطول × العرض)</span>
            </label>
            <select
              value={layout.paperSize}
              onChange={(e) => updateLayout({ ...layout, paperSize: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-sans text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none font-bold text-right"
            >
              <option value="50x30">50mm × 30mm (القياس الشائع)</option>
              <option value="40x30">40mm × 30mm</option>
              <option value="40x20">40mm × 20mm</option>
              <option value="30x20">30mm × 20mm (صغير)</option>
              <option value="50x25">50mm × 25mm</option>
              <option value="60x40">60mm × 40mm (كبير)</option>
              <option value="80x50">80mm × 50mm</option>
              <option value="100x50">100mm × 50mm</option>
            </select>
          </div>

          {/* 2. Global Distance / Line Spacing */}
          <div className="space-y-1.5 text-right">
            <label className="text-gray-700 font-bold text-xs flex items-center justify-between">
              <span className="flex items-center gap-1">
                <MoveVertical className="w-3.5 h-3.5 text-teal-600" />
                <span>المسافة والتباعد العام بين المحتويات:</span>
              </span>
              <span className="font-mono text-teal-700 font-black">{layout.lineSpacing}x</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.6"
                max="2.4"
                step="0.1"
                value={layout.lineSpacing}
                onChange={(e) => updateLayout({ ...layout, lineSpacing: parseFloat(e.target.value) })}
                className="w-full accent-teal-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 font-mono">
              <button type="button" onClick={() => updateLayout({ ...layout, lineSpacing: 0.8 })} className="hover:text-teal-700">مدمج (0.8x)</button>
              <button type="button" onClick={() => updateLayout({ ...layout, lineSpacing: 1.15 })} className="hover:text-teal-700">متوازن (1.15x)</button>
              <button type="button" onClick={() => updateLayout({ ...layout, lineSpacing: 1.6 })} className="hover:text-teal-700">متباعد (1.6x)</button>
            </div>
          </div>

          {/* 3. Sticker Inner Margins (Padding) */}
          <div className="space-y-1.5 text-right">
            <label className="text-gray-700 font-bold text-xs flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Maximize2 className="w-3.5 h-3.5 text-teal-600" />
                <span>هوامش الملصق الداخلية (Padding):</span>
              </span>
              <span className="font-mono text-teal-700 font-black">{layout.padding}mm</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="4.0"
              step="0.5"
              value={layout.padding}
              onChange={(e) => updateLayout({ ...layout, padding: parseFloat(e.target.value) })}
              className="w-full accent-teal-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-400 font-mono">
              <span>0.5mm</span>
              <span>2.0mm</span>
              <span>4.0mm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Designer Grid: Left = Elements Editor, Right = Interactive Live Sticker Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Active Elements List (Add/Remove, Resize, Spacing, Reorder) */}
        <div className="lg:col-span-7 space-y-5 font-sans">
          
          {/* Active Elements on Sticker */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 md:p-8 space-y-4 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
                <h4 className="font-sans font-bold text-gray-900 text-sm">
                  محتويات الملصق الحالية ({activeElements.length})
                </h4>
              </div>
              <span className="text-[11px] text-gray-400 font-medium">
                اسحب بالماوس ⠿ لتغيير الترتيب
              </span>
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
                    onDrop={(e) => handleDrop(el.id, e)}
                    className={`rounded-2xl border transition-all duration-150 p-3.5 bg-white select-none ${
                      isDragged ? 'opacity-40 scale-[0.98] border-teal-400 shadow-md' : ''
                    } ${
                      isDragOver ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20' : 'border-gray-200/80 hover:border-teal-300'
                    } ${
                      isSelected ? 'ring-2 ring-teal-600/30 border-teal-500 bg-teal-50/10' : ''
                    }`}
                  >
                    {/* Header Row: Drag Handle, Icon, Title, Up/Down, Remove */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {/* Drag Handle with mouse */}
                        <div 
                          className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-gray-100 text-gray-400 hover:text-teal-700 rounded-lg transition-colors flex items-center justify-center shrink-0"
                          title="اسحب بالماوس لتحريك العنصر لأعلى أو لأسفل"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Order Number Badge */}
                        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-black font-mono flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>

                        {/* Icon & Name */}
                        <div className="flex items-center gap-2 truncate">
                          {getElementIcon(el.id)}
                          <span className="font-extrabold text-xs text-gray-800 truncate">
                            {el.label}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons: Move Up, Move Down, Quick Toggle Size Editor, Remove */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Move Up */}
                        <button
                          type="button"
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-teal-700 hover:bg-teal-50 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                          title="تحريك للأعلى"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Move Down */}
                        <button
                          type="button"
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === activeElements.length - 1}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-teal-700 hover:bg-teal-50 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                          title="تحريك للأسفل"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Select / Expand Controls */}
                        <button
                          type="button"
                          onClick={() => setSelectedId(isSelected ? null : el.id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                            isSelected 
                              ? 'bg-teal-600 text-white border-teal-600' 
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {isSelected ? 'إغلاق الخيارات' : 'تعديل الحجم والمسافة'}
                        </button>

                        {/* Remove from label */}
                        <button
                          type="button"
                          onClick={() => handleToggleEnable(el.id, false)}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="إزالة من الملصق"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Info & Expanded Controls */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-3 bg-gray-50/70 p-3 rounded-xl animate-in fade-in duration-150">
                        {/* 1. Size or Height controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Font Size (for text elements) */}
                          {el.id !== 'barcode' && el.id !== 'qr_code' && (
                            <div className="space-y-1">
                              <span className="text-[11px] font-bold text-gray-700 block">حجم الخط:</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateElement(el.id, { fontSize: Math.max(5, (el.fontSize || 8) - 0.5) })}
                                  className="w-7 h-7 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg font-bold text-xs flex items-center justify-center text-gray-700"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-xs text-teal-800 bg-white px-2 py-1 rounded-lg border border-gray-200 min-w-[50px] text-center">
                                  {el.fontSize} pt
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateElement(el.id, { fontSize: Math.min(22, (el.fontSize || 8) + 0.5) })}
                                  className="w-7 h-7 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg font-bold text-xs flex items-center justify-center text-gray-700"
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateElement(el.id, { bold: !el.bold })}
                                  className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors ${
                                    el.bold ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'
                                  }`}
                                >
                                  عريض (B)
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Barcode Height & Width */}
                          {el.id === 'barcode' && (
                            <>
                              <div className="space-y-1">
                                <span className="text-[11px] font-bold text-gray-700 block">طول/ارتفاع الباركود:</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min="18"
                                    max="60"
                                    step="2"
                                    value={el.height || 34}
                                    onChange={(e) => handleUpdateElement(el.id, { height: Number(e.target.value) })}
                                    className="w-full accent-teal-600 h-1.5 bg-gray-200 rounded-lg"
                                  />
                                  <span className="font-mono text-xs font-bold text-teal-700 min-w-[40px] text-left">{el.height || 34}px</span>
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
                                    className="w-full accent-teal-600 h-1.5 bg-gray-200 rounded-lg"
                                  />
                                  <span className="font-mono text-xs font-bold text-teal-700 min-w-[36px] text-left">{el.width || 1.3}x</span>
                                </div>
                              </div>
                            </>
                          )}

                          {/* QR Code Height */}
                          {el.id === 'qr_code' && (
                            <div className="space-y-1">
                              <span className="text-[11px] font-bold text-gray-700 block">حجم رمز الـ QR:</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min="25"
                                  max="70"
                                  step="3"
                                  value={el.height || 38}
                                  onChange={(e) => handleUpdateElement(el.id, { height: Number(e.target.value) })}
                                  className="w-full accent-teal-600 h-1.5 bg-gray-200 rounded-lg"
                                />
                                <span className="font-mono text-xs font-bold text-teal-700 min-w-[40px] text-left">{el.height || 38}px</span>
                              </div>
                            </div>
                          )}

                          {/* Custom Text Content */}
                          {el.id === 'custom_text' && (
                            <div className="col-span-full space-y-1">
                              <span className="text-[11px] font-bold text-gray-700 block">نص الملاحظة المخصصة:</span>
                              <input
                                type="text"
                                value={el.customContent || ''}
                                onChange={(e) => handleUpdateElement(el.id, { customContent: e.target.value })}
                                placeholder="مثال: يرجى إبراز الملصق عند الاستلام - كفالة ٣٠ يوماً"
                                className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-right"
                              />
                            </div>
                          )}

                          {/* Per-Element Vertical Margins */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-gray-700 block">المسافة قبل/بعد العنصر:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-500">أعلى:</span>
                              <input
                                type="number"
                                min="0"
                                max="15"
                                value={el.marginTop || 0}
                                onChange={(e) => handleUpdateElement(el.id, { marginTop: Math.max(0, Number(e.target.value)) })}
                                className="w-12 px-1.5 py-1 bg-white border border-gray-200 rounded text-center text-xs font-mono font-bold"
                              />
                              <span className="text-[10px] text-gray-500">أسفل:</span>
                              <input
                                type="number"
                                min="0"
                                max="15"
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

          {/* Inactive / Available Elements to Add */}
          {inactiveElements.length > 0 && (
            <div className="bg-gray-50/80 rounded-3xl border border-dashed border-gray-300 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-gray-700 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-teal-600" />
                  <span>عناصر إضافية متاحة للإضافة إلى الملصق:</span>
                </span>
                <span className="text-[10px] text-gray-400">انقر على أي عنصر لإضافته مباشرة</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {inactiveElements.map(el => (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => handleToggleEnable(el.id, true)}
                    className="flex items-center justify-between p-2.5 bg-white hover:bg-teal-50/60 border border-gray-200 hover:border-teal-300 rounded-xl transition-all text-right group"
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

          {/* Save confirmation toast */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {showSavedToast && (
                <span className="text-emerald-600 font-bold text-xs flex items-center gap-1 animate-in fade-in">
                  <Check className="w-4 h-4" />
                  تم حفظ تصميم الملصق بنجاح!
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                saveStoredLabelLayout(layout);
                setShowSavedToast(true);
                setTimeout(() => setShowSavedToast(false), 3000);
              }}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-sans font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>حفظ التصميم وتطبيقه للطباعة</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Interactive Sticker Canvas with Direct Mouse Dragging */}
        <div className="lg:col-span-5 flex flex-col items-center justify-start sticky top-6 font-sans">
          <div className="w-full max-w-sm space-y-3">
            
            {/* Header info */}
            <div className="bg-teal-50/80 border border-teal-100 p-3 rounded-2xl text-center space-y-1">
              <span className="text-[11px] font-bold text-teal-900 block">
                معاينة ملصق الباركود الحية المباشرة
              </span>
              <p className="text-[10px] text-teal-700 leading-normal">
                💡 يمكنك الإمساك بأي عنصر <span className="font-bold underline">بالماوس وسحبه مباشرة على الملصق</span> لتغيير موضعه وترتيبه!
              </p>
            </div>

            {/* Sticker Outer Wrapper with simulated roll edge */}
            <div className="relative mx-auto bg-gray-100 p-4 rounded-2xl border border-gray-200/80 flex flex-col items-center justify-center">
              {/* Paper Top Cut guide */}
              <div className="w-[280px] flex items-center justify-between text-gray-400 text-[9px] font-mono border-b border-dashed border-gray-300 pb-1 mb-2 select-none">
                <span>✂️ حد ورق الملصق الحراري</span>
                <span>{layout.paperSize}mm</span>
              </div>

              {/* The Actual Sticker */}
              <div
                className="bg-white border-2 border-dashed border-teal-500 rounded-md select-none text-center font-sans overflow-hidden relative shadow-sm transition-all"
                style={{
                  width: `${previewWidthPx}px`,
                  minHeight: `${previewHeightPx}px`,
                  padding: `${layout.padding * 3}px ${layout.padding * 2.5}px`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box'
                }}
              >
                {/* Render each enabled element in its custom order */}
                {activeElements.map((el, idx) => {
                  const isHovered = dragOverId === el.id;
                  const isBeingDragged = draggedId === el.id;

                  return (
                    <div
                      key={el.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(el.id, e)}
                      onDragOver={(e) => handleDragOver(el.id, e)}
                      onDrop={(e) => handleDrop(el.id, e)}
                      onClick={() => setSelectedId(selectedId === el.id ? null : el.id)}
                      className={`w-full transition-all cursor-grab active:cursor-grabbing relative group rounded py-0.5 px-1 border border-transparent hover:border-teal-400 hover:bg-teal-50/30 ${
                        isBeingDragged ? 'opacity-30' : ''
                      } ${isHovered ? 'border-teal-500 bg-teal-100/40' : ''}`}
                      style={{
                        marginTop: `${(el.marginTop || 0) * layout.lineSpacing}px`,
                        marginBottom: `${(el.marginBottom || 0) * layout.lineSpacing}px`
                      }}
                      title="اسحب بالماوس لتحريك هذا العنصر، أو انقر لتعديل حجمه"
                    >
                      {/* Hover drag badge */}
                      <span className="absolute top-0 right-1 opacity-0 group-hover:opacity-100 text-[8px] bg-teal-600 text-white px-1 rounded transition-opacity pointer-events-none">
                        ⠿ اسحب بالماوس
                      </span>

                      {/* Element specific preview rendering */}
                      {el.id === 'center_name' && (
                        <div
                          className="w-full truncate text-black font-black tracking-tight"
                          style={{
                            fontSize: `${Math.max(el.fontSize || 13, 12)}pt`,
                            fontWeight: 900,
                            lineHeight: 1.15
                          }}
                        >
                          {centerName}
                        </div>
                      )}

                      {el.id === 'center_mobile' && (
                        <div
                          className="w-full truncate text-black"
                          style={{
                            fontSize: `${el.fontSize}pt`,
                            fontWeight: el.bold ? 700 : 500,
                            lineHeight: layout.lineSpacing
                          }}
                        >
                          {centerMobile}
                        </div>
                      )}

                      {el.id === 'customer_name' && (
                        <div
                          className="w-full truncate text-black"
                          style={{
                            fontSize: `${el.fontSize}pt`,
                            fontWeight: el.bold ? 800 : 500,
                            lineHeight: layout.lineSpacing
                          }}
                        >
                          العميل: {orderData.customerName}
                        </div>
                      )}

                      {el.id === 'device_model' && (
                        <div
                          className="w-full truncate text-black"
                          style={{
                            fontSize: `${el.fontSize}pt`,
                            fontWeight: el.bold ? 800 : 500,
                            lineHeight: layout.lineSpacing
                          }}
                        >
                          الجهاز: {orderData.brandModel}
                        </div>
                      )}

                      {el.id === 'order_date' && (
                        <div
                          className="w-full truncate text-gray-600"
                          style={{
                            fontSize: `${el.fontSize}pt`,
                            fontWeight: el.bold ? 700 : 400,
                            lineHeight: layout.lineSpacing
                          }}
                        >
                          التاريخ: {new Date(orderData.createdAt || Date.now()).toLocaleDateString('ar-SA')}
                        </div>
                      )}

                      {el.id === 'barcode' && (
                        <div className="w-full flex flex-col items-center justify-center overflow-hidden py-0.5">
                          <BarcodeGenerator
                            value={orderData.id}
                            width={el.width || 1.3}
                            height={el.height || 34}
                            showText={true}
                            format={barcodeFormat}
                            fontSize={el.fontSize || 9}
                          />
                        </div>
                      )}

                      {el.id === 'qr_code' && (
                        <div className="w-full flex flex-col items-center justify-center py-0.5">
                          <QRCodeGenerator
                            value={`${window.location.origin}?track=${orderData.id}`}
                            size={el.height || 38}
                          />
                        </div>
                      )}

                      {el.id === 'custom_text' && (
                        <div
                          className="w-full text-center text-gray-800"
                          style={{
                            fontSize: `${el.fontSize}pt`,
                            fontWeight: el.bold ? 700 : 500,
                            lineHeight: layout.lineSpacing
                          }}
                        >
                          {el.customContent || 'يرجى إبراز هذا الملصق عند الاستلام'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom cut guide */}
              <div className="w-[280px] flex items-center justify-center text-gray-400 text-[8px] font-mono border-t border-dashed border-gray-300 pt-1 mt-2 select-none">
                <span>✂️ نهاية الملصق</span>
              </div>
            </div>

            {/* Quick Helper Tips */}
            <div className="bg-gray-50 border border-gray-200/60 p-3 rounded-2xl text-[10px] text-gray-500 space-y-1">
              <span className="font-bold text-gray-700 block">نصائح الطباعة:</span>
              <p>• سيتم إرسال هذا الترتيب المخصص وهذه الأحجام بدقة لطابعة الملصقات الحرارية.</p>
              <p>• الأبعاد المعروضة متطابقة مع حجم الورق المحدد ({layout.paperSize}mm).</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
