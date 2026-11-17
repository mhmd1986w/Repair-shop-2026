import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  Upload,
  FileSpreadsheet,
  FileJson,
  X,
  AlertTriangle,
  Check,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbService, LocalStorageDB } from '../lib/firebase';
import {
  saveFileToDeviceSync,
  excelWorkbookToBlobAndDataUrl,
  shareFile,
  SaveFileResult,
} from '../utils/fileSaver';

interface LogsBackupModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const LogsBackupModal: React.FC<LogsBackupModalProps> = ({ onClose }) => {
  const [mode, setMode] = useState<'select' | 'export' | 'import' | 'import_preview'>('select');
  const [exportFormat, setExportFormat] = useState<'excel' | 'json'>('excel');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exportLogs, setExportLogs] = useState<any[]>(() =>
    LocalStorageDB.getCollection('notification_logs').map((l) => ({ ...l, selected: true }))
  );
  const [importLogs, setImportLogs] = useState<any[]>([]);

  // Export & import states
  const [exportResult, setExportResult] = useState<SaveFileResult | null>(null);
  const [exportBlob, setExportBlob] = useState<{ blob: Blob; mime: string; name: string } | null>(
    null
  );
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<{ type: 'error' | 'ok'; text: string } | null>(
    null
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    if (mode === 'export') {
      loadExportLogs();
    }
  }, [mode]);

  const loadExportLogs = async () => {
    const allLogs = await dbService.getNotificationLogs();
    const selectableLogs = allLogs.map((l) => ({
      ...l,
      selected: true,
    }));
    setExportLogs(selectableLogs);
  };

  const handleExport = () => {
    setExportNotice(null);
    setExportResult(null);

    const logsToExport = exportLogs
      .filter((l) => l.selected)
      .map(({ selected, ...clean }) => clean);

    if (logsToExport.length === 0) {
      setExportNotice('يرجى تحديد إشعار واحد على الأقل للتصدير.');
      return;
    }

    try {
      const dateStr = new Date().toISOString().split('T')[0];

      if (exportFormat === 'json') {
        const jsonContent = JSON.stringify(logsToExport, null, 2);
        const mimeType = 'application/json';
        const blob = new Blob([jsonContent], { type: mimeType });
        const fileName = `notification_logs_${dateStr}.json`;

        setExportBlob({ blob, mime: mimeType, name: fileName });

        const result = saveFileToDeviceSync(blob, fileName, mimeType, {
          textContent: jsonContent,
        });

        if (result.success) {
          setExportResult(result);
        } else {
          setExportNotice(result.error || 'حدث خطأ أثناء حفظ الملف.');
        }
      } else {
        const exportData = logsToExport.map((l) => ({
          'رقم الإشعار': l.id,
          'رقم الطلب': l.orderId,
          'اسم العميل': l.customerName,
          'رقم الهاتف': l.customerPhone,
          'وسيلة الإرسال': l.type === 'whatsapp' ? 'واتساب' : 'رسالة نصية',
          'الحالة':
            l.status === 'sent'
              ? 'تم الإرسال'
              : l.status === 'failed'
              ? 'فشل الإرسال'
              : 'قيد الانتظار',
          'الحدث (سبب الإرسال)': l.triggerEvent || 'غير محدد',
          'نص الرسالة': l.content || '',
          'تاريخ ووقت الإرسال': l.timestamp ? new Date(l.timestamp).toLocaleString('ar-SA') : '',
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);

        ws['!cols'] = [
          { wch: 18 },
          { wch: 15 },
          { wch: 20 },
          { wch: 15 },
          { wch: 15 },
          { wch: 15 },
          { wch: 25 },
          { wch: 50 },
          { wch: 20 },
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'سجلات الإشعارات');

        const { blob, dataUrl } = excelWorkbookToBlobAndDataUrl(wb);
        const fileName = `notification_logs_${dateStr}.xlsx`;
        const mimeType =
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        setExportBlob({ blob, mime: mimeType, name: fileName });

        const result = saveFileToDeviceSync(blob, fileName, mimeType, { dataUrl });

        if (result.success) {
          setExportResult(result);
        } else {
          setExportNotice(result.error || 'حدث خطأ أثناء حفظ الملف.');
        }
      }
    } catch (e: any) {
      console.error(e);
      setExportNotice(e.message || 'حدث خطأ أثناء تصدير سجلات الإشعارات.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportNotice(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result;
        if (!content) return;

        let importedData: any[] = [];

        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content as string);
          importedData = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.logs)
            ? parsed.logs
            : [];
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const data = new Uint8Array(content as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const sheetName = wb.SheetNames.includes('سجلات الإشعارات')
            ? 'سجلات الإشعارات'
            : wb.SheetNames[0];
          importedData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
        } else {
          setImportNotice({
            type: 'error',
            text: 'صيغة الملف غير مدعومة. يرجى اختيار ملف Excel أو JSON.',
          });
          return;
        }

        const mappedLogs = importedData
          .map((row: any, idx: number) => ({
            id: row['رقم الإشعار'] || row.id || `LOG-${Date.now()}-${idx}`,
            orderId: row['رقم الطلب'] || row.orderId || '',
            customerName: row['اسم العميل'] || row.customerName || '',
            customerPhone: row['رقم الهاتف'] || row.customerPhone || '',
            type:
              row['وسيلة الإرسال'] === 'واتساب' || row.type === 'whatsapp' ? 'whatsapp' : 'sms',
            status:
              row['الحالة'] === 'تم الإرسال' || row.status === 'sent'
                ? 'sent'
                : row['الحالة'] === 'فشل الإرسال' || row.status === 'failed'
                ? 'failed'
                : 'pending',
            triggerEvent: row['الحدث (سبب الإرسال)'] || row.triggerEvent || 'مستورد',
            content: row['نص الرسالة'] || row.content || '',
            timestamp: row.timestamp || Date.now(),
            selected: true,
          }))
          .filter((l) => l.customerName || l.customerPhone || l.content);

        if (mappedLogs.length === 0) {
          setImportNotice({
            type: 'error',
            text: 'لم يتم العثور على سجلات صالحة في الملف.',
          });
          return;
        }

        setImportLogs(mappedLogs);
        setMode('import_preview');
      } catch (err) {
        console.error(err);
        setImportNotice({ type: 'error', text: 'حدث خطأ أثناء قراءة ملف السجلات.' });
      }
    };

    if (file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handleConfirmImport = async () => {
    setImportNotice(null);
    try {
      const selectedToImport = importLogs.filter((l) => l.selected);
      if (selectedToImport.length === 0) {
        setImportNotice({ type: 'error', text: 'يرجى تحديد سجل واحد على الأقل للاستيراد.' });
        return;
      }

      const allLogs = await dbService.getNotificationLogs();
      const cleanSelected = selectedToImport.map(({ selected, ...clean }) => clean);
      const newLogsList = [...allLogs, ...cleanSelected];

      LocalStorageDB.setCollection('notification_logs', newLogsList);
      await Promise.all(cleanSelected.map((newL) => dbService.saveNotificationLog(newL)));

      setImportNotice({
        type: 'ok',
        text: `تم استيراد ${cleanSelected.length} إشعار بنجاح! جاري تحديث الواجهة...`,
      });
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      console.error(err);
      setImportNotice({ type: 'error', text: 'حدث خطأ أثناء حفظ السجلات المستوردة.' });
    }
  };

  const toggleExportLog = (id: string) => {
    setExportLogs(exportLogs.map((l) => (l.id === id ? { ...l, selected: !l.selected } : l)));
  };

  const toggleImportLog = (id: string) => {
    setImportLogs(importLogs.map((l) => (l.id === id ? { ...l, selected: !l.selected } : l)));
  };

  const getTitle = () => {
    if (exportResult) return 'تم تصدير سجلات الرسائل';
    if (mode === 'select') return 'تصدير / استيراد سجلات الرسائل';
    if (mode === 'export') return 'تصدير سجلات الرسائل';
    if (mode === 'import') return 'استيراد سجلات الرسائل';
    if (mode === 'import_preview') return 'معاينة وتأكيد الاستيراد';
    return '';
  };

  const LogList = ({
    logs,
    onToggle,
    onToggleAll,
  }: {
    logs: any[];
    onToggle: (id: string) => void;
    onToggleAll: (sel: boolean) => void;
  }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center px-1 text-xs">
        <span className="text-gray-500 font-medium">عدد السجلات: {logs.length}</span>
        <div className="flex gap-2">
          <button
            onClick={() => onToggleAll(true)}
            className="text-teal-600 font-bold hover:underline"
          >
            تحديد الكل
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => onToggleAll(false)}
            className="text-gray-500 font-bold hover:underline"
          >
            إلغاء الكل
          </button>
        </div>
      </div>

      <div className="border border-gray-100 rounded-2xl max-h-[40vh] overflow-y-auto divide-y divide-gray-50 custom-scrollbar p-1">
        {logs.map((log) => (
          <div
            key={log.id}
            onClick={() => onToggle(log.id)}
            className="flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors"
          >
            <div className="flex flex-col text-right">
              <span className="font-bold text-gray-800 text-xs">
                {log.customerName} - {log.triggerEvent}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {log.customerPhone} | {log.type}
              </span>
            </div>
            <div
              className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                log.selected ? 'bg-teal-500 text-white' : 'bg-gray-200 text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start pt-1 sm:pt-2 overflow-y-auto justify-center p-2 bg-transparent"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-in slide-in-from-top-2 duration-150 shadow-2xl border border-gray-200 mb-4">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">{getTitle()}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {exportResult ? (
            <div className="space-y-5 animate-in fade-in duration-200 text-right">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="font-bold text-lg text-gray-800">تم تجهيز وحفظ ملف سجلات الإشعارات بنجاح! 💾</h4>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2 text-xs font-sans">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">اسم الملف:</span>
                  <span className="font-mono font-bold text-gray-800 dir-ltr text-left">{exportResult.fileName}</span>
                </div>
                {exportResult.fileSizeFormatted && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">حجم الملف:</span>
                    <span className="font-bold text-teal-700">{exportResult.fileSizeFormatted}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {(exportResult.url || exportResult.dataUrl) && (
                  <a
                    href={exportResult.url || exportResult.dataUrl}
                    download={exportResult.fileName}
                    className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-teal-500/25 text-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>تنزيل الملف مباشرة وحفظه على الذاكرة 💾</span>
                  </a>
                )}
                {exportBlob && (
                  <button
                    type="button"
                    onClick={() => shareFile(exportBlob.blob, exportBlob.name, exportBlob.mime, exportResult.textContent)}
                    className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200/80 transition-colors flex justify-center items-center gap-2 text-xs"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>📲 حفظ في إدارة ملفات الهاتف / مشاركة</span>
                  </button>
                )}
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setExportResult(null);
                    setMode('export');
                  }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                >
                  تصدير نسخة أخرى
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
          ) : mode === 'select' ? (
            <div className="space-y-4">
              <button
                onClick={() => setMode('export')}
                className="w-full p-4 border-2 border-teal-100 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-2xl flex items-center gap-4 transition-colors"
              >
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <Download className="w-6 h-6 text-teal-600" />
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">تصدير (Export)</div>
                  <div className="text-sm opacity-80 font-medium">
                    حفظ سجلات الإشعارات مباشرة من نفس الواجهة
                  </div>
                </div>
              </button>

              <button
                onClick={() => setMode('import')}
                className="w-full p-4 border-2 border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-2xl flex items-center gap-4 transition-colors"
              >
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <Upload className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">استيراد (Import)</div>
                  <div className="text-sm opacity-80 font-medium">
                    استرجاع سجلات الإشعارات من ملف Excel أو JSON
                  </div>
                </div>
              </button>
            </div>
          ) : mode === 'export' ? (
            <div className="space-y-4">
              <LogList
                logs={exportLogs}
                onToggle={toggleExportLog}
                onToggleAll={(sel) =>
                  setExportLogs(exportLogs.map((l) => ({ ...l, selected: sel })))
                }
              />

              {exportNotice && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{exportNotice}</span>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-2 font-medium">صيغة الملف:</div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setExportFormat('excel')}
                    className={`flex-1 p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all text-xs cursor-pointer ${
                      exportFormat === 'excel'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('json')}
                    className={`flex-1 p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all text-xs cursor-pointer ${
                      exportFormat === 'json'
                        ? 'border-teal-200 bg-teal-50 text-teal-700 ring-2 ring-teal-500/20'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <FileJson className="w-4 h-4" />
                    JSON (.json)
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setMode('select')}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-xs"
                >
                  رجوع
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex-[2] py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg shadow-teal-500/30 text-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير وحفظ المحدد ({exportLogs.filter((l) => l.selected).length})</span>
                </button>
              </div>
            </div>
          ) : mode === 'import' ? (
            <div className="space-y-4">
              <div className="bg-amber-50 text-amber-800 text-[11px] p-3 rounded-xl flex items-start gap-2 font-medium leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  اختر ملف Excel أو JSON للبدء، سيتم عرض قائمة بسجلات الرسائل لتختار منها قبل الاستيراد النهائي.
                </span>
              </div>
              {importNotice && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold ${
                    importNotice.type === 'ok'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {importNotice.text}
                </div>
              )}
              <input
                type="file"
                accept=".xlsx,.xls,.json"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImportFile}
              />

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setMode('select')}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-xs"
                >
                  رجوع
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg shadow-indigo-500/30 text-xs"
                >
                  <Upload className="w-4 h-4" />
                  اختيار ملف
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <LogList
                logs={importLogs}
                onToggle={toggleImportLog}
                onToggleAll={(sel) =>
                  setImportLogs(importLogs.map((l) => ({ ...l, selected: sel })))
                }
              />

              {importNotice && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold ${
                    importNotice.type === 'ok'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {importNotice.text}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setMode('import')}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-xs"
                >
                  رجوع
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg shadow-indigo-500/30 text-xs"
                >
                  <Upload className="w-4 h-4" />
                  استيراد المحدد ({importLogs.filter((l) => l.selected).length})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
