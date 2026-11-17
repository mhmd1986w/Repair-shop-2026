import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Share2,
  Copy,
  Check,
  FolderOpen,
  FileText,
  ChevronDown,
  ChevronUp,
  Smartphone,
} from 'lucide-react';
import {
  SaveFileResult,
  shareFile,
  saveFileWithPicker,
  isRunningInIframe,
} from '../utils/fileSaver';

interface BackupExportResultViewProps {
  result: SaveFileResult;
  blobInfo: { blob: Blob; mime: string; name: string } | null;
  title?: string;
  onExportAgain: () => void;
  onClose: () => void;
}

export const BackupExportResultView: React.FC<BackupExportResultViewProps> = ({
  result,
  blobInfo,
  title = 'تم تجهيز ملف النسخة الاحتياطية بنجاح! 💾',
  onExportAgain,
  onClose,
}) => {
  const [actionMessage, setActionMessage] = useState<{ type: 'ok' | 'warn'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTextPreview, setShowTextPreview] = useState(false);

  const canUsePicker =
    typeof window !== 'undefined' &&
    typeof (window as any).showSaveFilePicker === 'function' &&
    !isRunningInIframe();

  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleShare = async () => {
    if (!blobInfo) return;
    setActionMessage(null);
    const res = await shareFile(blobInfo.blob, blobInfo.name, blobInfo.mime, result.textContent);
    if (res.shared) {
      setActionMessage({ type: 'ok', text: 'تم فتح قائمة الحفظ والمشاركة في جهازك بنجاح ✓' });
    } else if (res.reason) {
      setActionMessage({ type: 'warn', text: res.reason });
    }
  };

  const handleSaveAsPicker = async () => {
    if (!blobInfo) return;
    setActionMessage(null);
    const res = await saveFileWithPicker(blobInfo.blob, blobInfo.name, blobInfo.mime);
    if (res.saved) {
      setActionMessage({ type: 'ok', text: 'تم حفظ الملف في المجلد الذي اخترته بنجاح ✓' });
    } else if (!res.cancelled && res.error) {
      setActionMessage({ type: 'warn', text: res.error });
    }
  };

  const handleCopyText = async () => {
    if (!result.textContent) return;
    try {
      await navigator.clipboard.writeText(result.textContent);
      setCopied(true);
      setActionMessage({ type: 'ok', text: 'تم نسخ محتوى النسخة الاحتياطية إلى الحافظة ✓' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = result.textContent;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setActionMessage({ type: 'ok', text: 'تم نسخ محتوى النسخة الاحتياطية إلى الحافظة ✓' });
        setTimeout(() => setCopied(false), 2500);
      } catch {
        setActionMessage({
          type: 'warn',
          text: 'تعذر النسخ التلقائي — افتح معاينة المحتوى بالأسفل وحدده للنسخ يدوياً.',
        });
        setShowTextPreview(true);
      }
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 text-right">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
      </div>

      <div className="text-center space-y-1">
        <h4 className="font-bold text-base text-gray-800">{title}</h4>
        <p className="text-xs text-gray-500 font-medium leading-relaxed">
          تم بدء حفظ الملف من نفس الواجهة. في حال لم يظهر في التنزيلات تلقائياً، استخدم أزرار الحفظ المباشر أدناه:
        </p>
      </div>

      {/* File Info Box */}
      <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-1.5 text-xs font-sans">
        <div className="flex justify-between items-center gap-2">
          <span className="text-gray-500 shrink-0">اسم الملف:</span>
          <span className="font-mono font-bold text-gray-800 dir-ltr text-left truncate">
            {result.fileName}
          </span>
        </div>
        {result.fileSizeFormatted && (
          <div className="flex justify-between items-center">
            <span className="text-gray-500">حجم الملف:</span>
            <span className="font-bold text-teal-700">{result.fileSizeFormatted}</span>
          </div>
        )}
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-bold border ${
            actionMessage.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Direct same-interface save buttons */}
      <div className="space-y-2">
        {result.url && (
          <a
            href={result.url}
            download={result.fileName}
            rel="noopener noreferrer"
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-teal-500/20 text-xs"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل وحفظ الملف مباشرة على الجهاز</span>
          </a>
        )}

        {result.dataUrl && (
          <a
            href={result.dataUrl}
            download={result.fileName}
            rel="noopener noreferrer"
            className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-200 transition-colors flex justify-center items-center gap-2 text-xs"
          >
            <Smartphone className="w-4 h-4" />
            <span>حفظ بديل مباشر (متوافق مع التطبيقات والهاتف)</span>
          </a>
        )}

        {canUsePicker && blobInfo && (
          <button
            type="button"
            onClick={handleSaveAsPicker}
            className="w-full py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold rounded-xl border border-sky-200 transition-colors flex justify-center items-center gap-2 text-xs"
          >
            <FolderOpen className="w-4 h-4" />
            <span>اختيار مجلد الحفظ (Save As)</span>
          </button>
        )}

        {canShare && blobInfo && (
          <button
            type="button"
            onClick={handleShare}
            className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200/80 transition-colors flex justify-center items-center gap-2 text-xs"
          >
            <Share2 className="w-4 h-4" />
            <span>حفظ في إدارة ملفات الهاتف / مشاركة</span>
          </button>
        )}

        {result.textContent !== undefined && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors flex justify-center items-center gap-1.5 text-xs"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'تم النسخ ✓' : 'نسخ البيانات'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTextPreview((v) => !v)}
              className="py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors flex justify-center items-center gap-1.5 text-xs"
            >
              <FileText className="w-4 h-4" />
              <span>معاينة المحتوى</span>
              {showTextPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {showTextPreview && result.textContent !== undefined && (
        <div className="space-y-1.5">
          <textarea
            readOnly
            value={result.textContent}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full h-36 p-2.5 rounded-xl border border-gray-200 bg-gray-50 font-mono text-[10px] text-gray-700 dir-ltr text-left focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <p className="text-[10px] text-gray-400">
            يمكنك تحديد النص أعلاه ونسخه وحفظه في ملف بصيغة {result.fileName.split('.').pop()?.toUpperCase()}.
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onExportAgain}
          className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
        >
          تصدير مرة أخرى
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
        >
          تم الانتهاء
        </button>
      </div>
    </div>
  );
};
