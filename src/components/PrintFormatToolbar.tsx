import React from 'react';
import { 
  AlignRight, 
  AlignCenter, 
  AlignLeft, 
  AlignVerticalJustifyStart, 
  AlignVerticalJustifyCenter, 
  AlignVerticalJustifyEnd,
  Type,
  Bold,
  FoldVertical
} from 'lucide-react';
import { ARABIC_FONTS, PrintFormatConfig } from '../utils/printFormatting';

interface PrintFormatToolbarProps {
  title: string;
  config: PrintFormatConfig;
  onChange: (newConfig: PrintFormatConfig) => void;
  availableSizes?: number[];
  compact?: boolean;
}

export const PrintFormatToolbar: React.FC<PrintFormatToolbarProps> = ({
  title,
  config,
  onChange,
  availableSizes = [8, 9, 10, 11, 12, 13, 14, 16],
  compact = false
}) => {
  const update = (partial: Partial<PrintFormatConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 p-4 space-y-3.5 text-right font-sans shadow-xs" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700 font-bold">
            <Type className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-xs text-gray-800">{title}</h4>
            <span className="text-[10px] text-gray-400 font-medium">تعديل فوري للخط والمحاذاة وتباعد الأسطر</span>
          </div>
        </div>

        {/* Quick Reset to Standard */}
        <button
          type="button"
          onClick={() => {
            update({
              fontFamily: 'Cairo',
              textAlign: 'center',
              verticalAlign: 'center',
              lineHeight: 1.25,
              fontWeight: 'bold',
              fontSize: availableSizes[Math.floor(availableSizes.length / 2)] || 10
            });
          }}
          className="text-[10px] text-gray-400 hover:text-teal-700 font-bold transition-colors cursor-pointer"
        >
          إعادة ضبط قياسي
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* 1. نوع الخط (Font Family) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
            <Type className="w-3 h-3 text-teal-600" />
            <span>نوع الخط (Font):</span>
          </label>
          <div className="grid grid-cols-3 gap-1">
            {ARABIC_FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => update({ fontFamily: f.id })}
                className={`py-1.5 px-1 rounded-lg text-[10px] font-bold truncate transition-all border cursor-pointer ${
                  config.fontFamily === f.id
                    ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-teal-50 hover:text-teal-800'
                }`}
                style={{ fontFamily: f.css }}
                title={f.label}
              >
                {f.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* 2. المحاذاة الأفقية (Horizontal Alignment) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
            <AlignRight className="w-3 h-3 text-teal-600" />
            <span>المحاذاة الأفقية:</span>
          </label>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => update({ textAlign: 'right' })}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                config.textAlign === 'right'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-teal-50'
              }`}
              title="محاذاة لليمين"
            >
              <AlignRight className="w-3.5 h-3.5" />
              <span className="text-[10px]">يمين</span>
            </button>
            <button
              type="button"
              onClick={() => update({ textAlign: 'center' })}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                config.textAlign === 'center'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-teal-50'
              }`}
              title="توسيط أفقي"
            >
              <AlignCenter className="w-3.5 h-3.5" />
              <span className="text-[10px]">وسط</span>
            </button>
            <button
              type="button"
              onClick={() => update({ textAlign: 'left' })}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                config.textAlign === 'left'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-teal-50'
              }`}
              title="محاذاة لليسار"
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span className="text-[10px]">يسار</span>
            </button>
          </div>
        </div>

        {/* 3. المحاذاة الرأسية (Vertical Alignment) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
            <AlignVerticalJustifyCenter className="w-3 h-3 text-teal-600" />
            <span>المحاذاة الرأسية:</span>
          </label>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => update({ verticalAlign: 'top' })}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                config.verticalAlign === 'top'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-teal-50'
              }`}
              title="محاذاة لأعلى"
            >
              <AlignVerticalJustifyStart className="w-3.5 h-3.5" />
              <span className="text-[10px]">أعلى</span>
            </button>
            <button
              type="button"
              onClick={() => update({ verticalAlign: 'center' })}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                config.verticalAlign === 'center'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-teal-50'
              }`}
              title="توسيط رأسي"
            >
              <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />
              <span className="text-[10px]">وسط</span>
            </button>
            <button
              type="button"
              onClick={() => update({ verticalAlign: 'bottom' })}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                config.verticalAlign === 'bottom'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-teal-50'
              }`}
              title="محاذاة لأسفل"
            >
              <AlignVerticalJustifyEnd className="w-3.5 h-3.5" />
              <span className="text-[10px]">أسفل</span>
            </button>
          </div>
        </div>

        {/* 4. تباعد الأسطر (Line Spacing / Line Height) */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px] font-bold text-gray-700">
            <span className="flex items-center gap-1">
              <FoldVertical className="w-3 h-3 text-teal-600" />
              <span>تباعد الأسطر:</span>
            </span>
            <span className="font-mono text-teal-700 text-[10px] font-bold">{config.lineHeight}x</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => update({ lineHeight: Math.max(0.9, Number((config.lineHeight - 0.1).toFixed(2))) })}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="تقليل تباعد الأسطر"
            >
              -
            </button>
            <div className="flex-1 grid grid-cols-4 gap-1">
              {[1.0, 1.25, 1.5, 1.8].map((lh) => (
                <button
                  key={lh}
                  type="button"
                  onClick={() => update({ lineHeight: lh })}
                  className={`py-1 rounded-md text-[9.5px] font-mono font-bold transition-all border cursor-pointer ${
                    Math.abs(config.lineHeight - lh) < 0.08
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-teal-50'
                  }`}
                >
                  {lh}x
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => update({ lineHeight: Math.min(2.5, Number((config.lineHeight + 0.1).toFixed(2))) })}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="زيادة تباعد الأسطر"
            >
              +
            </button>
          </div>
        </div>

        {/* 5. حجم الخط (Font Size) */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px] font-bold text-gray-700">
            <span className="flex items-center gap-1">
              <Type className="w-3 h-3 text-teal-600" />
              <span>حجم الخط:</span>
            </span>
            <span className="font-mono text-teal-700 text-[10px] font-bold">{config.fontSize} pt</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => update({ fontSize: Math.max(6, config.fontSize - 1) })}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="تصغير الخط"
            >
              A-
            </button>
            <div className="flex-1 flex gap-1 overflow-x-auto py-0.5">
              {availableSizes.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => update({ fontSize: sz })}
                  className={`flex-1 py-1 px-1 rounded-md text-[9.5px] font-mono font-bold transition-all border shrink-0 cursor-pointer ${
                    config.fontSize === sz
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-teal-50'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => update({ fontSize: Math.min(24, config.fontSize + 1) })}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="تكبير الخط"
            >
              A+
            </button>
          </div>
        </div>

        {/* 6. سماكة الخط ونمطه (Font Weight) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
            <Bold className="w-3 h-3 text-teal-600" />
            <span>سماكة الخط (Style):</span>
          </label>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => update({ fontWeight: 'normal' })}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-normal transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                config.fontWeight === 'normal'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs font-bold'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-teal-50'
              }`}
            >
              عادي (Normal)
            </button>
            <button
              type="button"
              onClick={() => update({ fontWeight: 'bold' })}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                config.fontWeight === 'bold'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-teal-50'
              }`}
            >
              <Bold className="w-3 h-3" />
              <span>عريض (Bold)</span>
            </button>
            <button
              type="button"
              onClick={() => update({ fontWeight: '900' })}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-black transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                config.fontWeight === '900'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-teal-50'
              }`}
            >
              عريض جداً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
