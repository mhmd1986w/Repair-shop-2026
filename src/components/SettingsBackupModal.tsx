import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, CheckSquare, Square, FileSpreadsheet, FileJson, X, AlertTriangle, Check, CheckCircle2, RefreshCw, Share2, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveFileToDevice, excelWorkbookToBlob, shareFile, isRunningInIframe, SaveFileResult } from '../utils/fileSaver';

interface SettingsBackupModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const SettingsBackupModal: React.FC<SettingsBackupModalProps> = ({ onClose, onSuccess }) => {
  const [mode, setMode] = useState<'select' | 'export' | 'import'>('select');
  const [exportFormat, setExportFormat] = useState<'json' | 'excel'>('json');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selCenterInfo, setSelCenterInfo] = useState(true);
  const [selSettings, setSelSettings] = useState(true);
  const [selTemplates, setSelTemplates] = useState(true);

  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<SaveFileResult | null>(null);
  const [exportBlob, setExportBlob] = useState<{ blob: Blob; mime: string; name: string } | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const inIframe = isRunningInIframe();

  const handleExport = async () => {
    setExportNotice(null);
    setExportResult(null);

    if (!selCenterInfo && !selSettings && !selTemplates) {
      setExportNotice('يرجى تحديد عنصر واحد على الأقل للتصدير.');
      return;
    }

    setIsExporting(true);

    try {
      const dataToExport: any = {};
      const dateStr = new Date().toISOString().split('T')[0];

      if (selSettings) {
        const settings: any = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !key.startsWith('db_') && key !== 'centerName' && key !== 'centerMobile' && key !== 'notification_templates') {
            settings[key] = localStorage.getItem(key);
          }
        }
        dataToExport.settings = settings;
      }
      
      if (selCenterInfo) {
        dataToExport.centerInfo = {
          centerName: localStorage.getItem('centerName') || '',
          centerMobile: localStorage.getItem('centerMobile') || ''
        };
      }

      if (selTemplates) {
        const tpls = localStorage.getItem('notification_templates');
        dataToExport.templates = tpls ? JSON.parse(tpls) : [];
      }

      if (exportFormat === 'json') {
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const fileName = `settings_backup_${dateStr}.json`;
        const mimeType = 'application/json';

        setExportBlob({ blob, mime: mimeType, name: fileName });

        const result = await saveFileToDevice(
          blob,
          fileName,
          mimeType,
          'إعدادات النظام وقوالب الرسائل (JSON)'
        );

        setIsExporting(false);

        if (result.userCancelled) {
          setExportNotice('تم إغلاق نافذة اختيار مكان الحفظ دون حفظ الملف.');
          return;
        }

        if (result.success) {
          setExportResult(result);
          onSuccess();
        } else {
          setExportNotice(result.error || 'حدث خطأ أثناء حفظ الملف.');
        }
      } else {
        const wb = XLSX.utils.book_new();
        
        if (selCenterInfo && dataToExport.centerInfo) {
          const ws = XLSX.utils.json_to_sheet([dataToExport.centerInfo]);
          XLSX.utils.book_append_sheet(wb, ws, "بيانات المركز");
        }
        
        if (selSettings && dataToExport.settings) {
          const ws = XLSX.utils.json_to_sheet(Object.entries(dataToExport.settings).map(([k, v]) => ({ 'المفتاح': k, 'القيمة': v })));
          XLSX.utils.book_append_sheet(wb, ws, "الاعدادات");
        }
        
        if (selTemplates && dataToExport.templates?.length) {
          const ws = XLSX.utils.json_to_sheet(dataToExport.templates);
          XLSX.utils.book_append_sheet(wb, ws, "قوالب الرسائل");
        }

        const blob = excelWorkbookToBlob(wb);
        const fileName = `settings_backup_${dateStr}.xlsx`;
        const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        setExportBlob({ blob, mime: mimeType, name: fileName });

        const result = await saveFileToDevice(
          blob,
          fileName,
          mimeType,
          'إعدادات النظام وقوالب الرسائل (Excel)'
        );

        setIsExporting(false);

        if (result.userCancelled) {
          setExportNotice('تم إغلاق نافذة اختيار مكان الحفظ دون حفظ الملف.');
          return;
        }

        if (result.success) {
          setExportResult(result);
          onSuccess();
        } else {
          setExportNotice(result.error || 'حدث خطأ أثناء حفظ الملف.');
        }
      }
    } catch (e: any) {
      console.error(e);
      setIsExporting(false);
      setExportNotice(e.message || 'حدث خطأ أثناء تصدير الإعدادات.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result;
        if (!content) return;
        
        let importedData: any = {};
        
        if (file.name.endsWith('.json')) {
          importedData = JSON.parse(content as string);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const data = new Uint8Array(content as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          
          importedData = {};
          
          if (wb.SheetNames.includes('الاعدادات')) {
            const arr: any[] = XLSX.utils.sheet_to_json(wb.Sheets['الاعدادات']);
            importedData.settings = {};
            arr.forEach(row => { 
              const key = row['المفتاح'] || row['Key'];
              const val = row['القيمة'] || row['Value'];
              if (key) importedData.settings[key] = val; 
            });
          }
          if (wb.SheetNames.includes('بيانات المركز') || wb.SheetNames.includes('معلومات المركز')) {
            const sName = wb.SheetNames.includes('بيانات المركز') ? 'بيانات المركز' : 'معلومات المركز';
            const arr: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sName]);
            if (arr.length > 0) importedData.centerInfo = arr[0];
          }
          if (wb.SheetNames.includes('قوالب الرسائل') || wb.SheetNames.includes('الرسائل')) {
            const sName = wb.SheetNames.includes('قوالب الرسائل') ? 'قوالب الرسائل' : 'الرسائل';
            importedData.templates = XLSX.utils.sheet_to_json(wb.Sheets[sName]);
          }
        } else {
          alert('صيغة الملف غير مدعومة');
          return;
        }

        if (selSettings && importedData.settings) {
          Object.entries(importedData.settings).forEach(([k, v]) => {
            localStorage.setItem(k, v as string);
          });
        }
        
        if (selCenterInfo && importedData.centerInfo) {
          if (importedData.centerInfo.centerName) localStorage.setItem('centerName', importedData.centerInfo.centerName);
          if (importedData.centerInfo.centerMobile) localStorage.setItem('centerMobile', importedData.centerInfo.centerMobile);
        }

        if (selTemplates && importedData.templates) {
          localStorage.setItem('notification_templates', JSON.stringify(importedData.templates));
        }

        alert('تم استيراد الإعدادات بنجاح! سيتم إعادة تحميل الصفحة.');
        onSuccess();
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء استيراد الملف.');
      }
    };

    if (file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const getTitle = () => {
    if (exportResult) return 'تم تصدير الإعدادات';
    if (mode === 'select') return 'تصدير / استيراد الإعدادات';
    if (mode === 'export') return 'تصدير الإعدادات';
    if (mode === 'import') return 'استيراد الإعدادات';
    return '';
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start pt-1 sm:pt-2 overflow-y-auto justify-center p-2 bg-transparent" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-in slide-in-from-top-2 duration-150 shadow-2xl border border-gray-200 mb-4">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            {getTitle()}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* SUCCESS EXPORT VIEW */}
          {exportResult ? (
            <div className="space-y-5 animate-in fade-in duration-200 text-right">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
              </div>

              <div className="text-center space-y-1">
                <h4 className="font-bold text-lg text-gray-800">
                  {exportResult.method === 'picker' 
                    ? 'تم حفظ ملف الإعدادات بنجاح! 🎉' 
                    : 'تم تجهيز ملف الإعدادات للتحميل! 💾'}
                </h4>
                <p className="text-xs text-gray-500 font-medium">
                  {exportResult.method === 'picker' 
                    ? 'تم تخزين الملف في المجلد الذي قمت بتحديده على ذاكرة جهازك.' 
                    : 'إذا لم تفتح نافذة المجلد تلقائياً، يمكنك الضغط على زر التنزيل المباشر أدناه:'}
                </p>
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

              {exportResult.url && (
                <div className="space-y-2">
                  <a
                    href={exportResult.url}
                    download={exportResult.fileName}
                    className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-teal-500/25 text-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>تنزيل الملف مباشرة وحفظه على الذاكرة 💾</span>
                  </a>

                  {exportBlob && (
                    <button
                      type="button"
                      onClick={() => shareFile(exportBlob.blob, exportBlob.name, exportBlob.mime)}
                      className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200/80 transition-colors flex justify-center items-center gap-2 text-xs"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>📲 حفظ في إدارة ملفات الهاتف / مشاركة</span>
                    </button>
                  )}
                </div>
              )}

              {inIframe && (
                <div className="bg-amber-50 border border-amber-200/80 p-3 rounded-2xl text-right text-xs text-amber-900 space-y-1 leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>تنبيه بيئة العرض (iFrame):</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    إذا كان متصفحك يمنع فتح نافذة اختيار المجلد تلقائياً، يمكنك فتح التطبيق في نافذة مستقلة كاملة:
                  </p>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-teal-700 font-bold text-xs hover:underline"
                  >
                    <span>افتح التطبيق في نافذة جديدة مستقلة</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setExportResult(null);
                    setMode('export');
                  }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                >
                  تصدير مرة أخرى
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-colors"
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
                <div className="p-3 bg-white rounded-xl shadow-sm"><Download className="w-6 h-6 text-teal-600" /></div>
                <div className="text-right">
                  <div className="font-bold text-lg">تصدير (Export)</div>
                  <div className="text-sm opacity-80 font-medium">حفظ إعدادات النظام في ملف واختيار مكان الحفظ</div>
                </div>
              </button>
              
              <button
                onClick={() => setMode('import')}
                className="w-full p-4 border-2 border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-2xl flex items-center gap-4 transition-colors"
              >
                <div className="p-3 bg-white rounded-xl shadow-sm"><Upload className="w-6 h-6 text-indigo-600" /></div>
                <div className="text-right">
                  <div className="font-bold text-lg">استيراد (Import)</div>
                  <div className="text-sm opacity-80 font-medium">استرجاع إعدادات النظام من ملف</div>
                </div>
              </button>
            </div>
          ) : mode === 'export' ? (
            <div className="space-y-4">
              <div className="text-xs font-bold text-gray-700 px-1">حدد البيانات المراد تصديرها:</div>
              <div className="space-y-2">
                <div 
                  onClick={() => setSelCenterInfo(!selCenterInfo)}
                  className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <span className="font-medium text-gray-700 text-xs">معلومات المركز (الاسم ورقم الهاتف)</span>
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${selCenterInfo ? 'bg-teal-500 text-white' : 'bg-gray-200 text-transparent'}`}>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </div>

                <div 
                  onClick={() => setSelSettings(!selSettings)}
                  className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <span className="font-medium text-gray-700 text-xs">إعدادات النظام العامة وتخصيص الملصقات</span>
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${selSettings ? 'bg-teal-500 text-white' : 'bg-gray-200 text-transparent'}`}>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </div>

                <div 
                  onClick={() => setSelTemplates(!selTemplates)}
                  className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <span className="font-medium text-gray-700 text-xs">قوالب ونصوص رسائل الإشعارات</span>
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${selTemplates ? 'bg-teal-500 text-white' : 'bg-gray-200 text-transparent'}`}>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </div>
              </div>

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
                    onClick={() => setExportFormat('json')}
                    className={`flex-1 p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all text-xs cursor-pointer ${
                      exportFormat === 'json'
                        ? 'border-teal-200 bg-teal-50 text-teal-700 ring-2 ring-teal-500/20'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <FileJson className="w-4 h-4" />
                    JSON
                  </button>
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
                    Excel
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-2 text-right">
                  💡 سيقوم النظام بطلب تحديد مكان الحفظ (Save As) على ذاكرة جهازك لتخزين الملف في المجلد الذي تفضله.
                </p>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setMode('select')}
                  disabled={isExporting}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-xs"
                >
                  رجوع
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex-[2] py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg shadow-teal-500/30 text-xs"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>تصدير المحدد</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 text-amber-800 text-[11px] p-3 rounded-xl flex items-start gap-2 font-medium leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>اختر ملف Excel أو JSON للبدء، سيتم تحديث إعدادات النظام مباشرة فور الاستيراد و إعادة تحميل الصفحة.</span>
              </div>
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
          )}
        </div>
      </div>
    </div>
  );
};
