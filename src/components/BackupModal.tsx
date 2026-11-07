import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, CheckSquare, Square, FileJson, FileSpreadsheet, X, AlertTriangle, CheckCircle2, RefreshCw, FolderDown, Share2, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbService, LocalStorageDB } from '../lib/firebase';
import { isContactOrder } from '../types';
import { saveFileToDevice, excelWorkbookToBlob, shareFile, isRunningInIframe, SaveFileResult } from '../utils/fileSaver';

interface BackupModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ onClose, onSuccess }) => {
  const [mode, setMode] = useState<'select' | 'export' | 'import'>('select');
  const [exportFormat, setExportFormat] = useState<'json' | 'excel'>('json');
  
  // Selections
  const [selSettings, setSelSettings] = useState(true);
  const [selCenterInfo, setSelCenterInfo] = useState(true);
  const [selContacts, setSelContacts] = useState(true); // الاسماء
  const [selOrders, setSelOrders] = useState(true); // العملاء/طلبات الصيانة
  const [selTemplates, setSelTemplates] = useState(true); // الرسائل
  const [selLogs, setSelLogs] = useState(true); // الاشعارات/الاشارات
  
  // Export status states
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<SaveFileResult | null>(null);
  const [exportBlob, setExportBlob] = useState<{ blob: Blob; mime: string; name: string } | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inIframe = isRunningInIframe();

  const toggleAll = (val: boolean) => {
    setSelSettings(val);
    setSelCenterInfo(val);
    setSelContacts(val);
    setSelOrders(val);
    setSelTemplates(val);
    setSelLogs(val);
  };

  const handleExport = async () => {
    setExportNotice(null);
    setExportResult(null);
    setIsExporting(true);

    try {
      const dataToExport: any = {};
      
      const allOrders = await dbService.getOrders();
      const contactOrders = allOrders.filter(o => isContactOrder(o));
      const maintenanceOrders = allOrders.filter(o => !isContactOrder(o));
      
      if (selSettings) {
        // Collect all localStorage keys that are settings
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
      
      if (selContacts) {
        dataToExport.contacts = contactOrders;
      }
      
      if (selOrders) {
        dataToExport.orders = maintenanceOrders;
      }
      
      if (selTemplates) {
        const tpls = localStorage.getItem('notification_templates');
        dataToExport.templates = tpls ? JSON.parse(tpls) : [];
      }
      
      if (selLogs) {
        dataToExport.logs = await dbService.getNotificationLogs();
      }

      const dateStr = new Date().toISOString().split('T')[0];
      
      if (exportFormat === 'json') {
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const fileName = `backup_${dateStr}.json`;
        const mimeType = 'application/json';

        setExportBlob({ blob, mime: mimeType, name: fileName });

        const result = await saveFileToDevice(
          blob, 
          fileName, 
          mimeType, 
          'نسخة احتياطية لقاعدة البيانات (JSON)'
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
          setExportNotice(result.error || 'حدث خطأ أثناء محاولة حفظ الملف.');
        }
      } else {
        // Excel Export
        const wb = XLSX.utils.book_new();
        
        if (selSettings && dataToExport.settings) {
          const ws = XLSX.utils.json_to_sheet(Object.entries(dataToExport.settings).map(([k, v]) => ({ Key: k, Value: v })));
          XLSX.utils.book_append_sheet(wb, ws, "الاعدادات");
        }
        
        if (selCenterInfo && dataToExport.centerInfo) {
          const ws = XLSX.utils.json_to_sheet([dataToExport.centerInfo]);
          XLSX.utils.book_append_sheet(wb, ws, "معلومات المركز");
        }
        
        if (selContacts && dataToExport.contacts?.length) {
          const ws = XLSX.utils.json_to_sheet(dataToExport.contacts);
          XLSX.utils.book_append_sheet(wb, ws, "الاسماء");
        } else if (selContacts) {
          const ws = XLSX.utils.json_to_sheet([{ "الاسم": "لا توجد أسماء", "الهاتف": "" }]);
          XLSX.utils.book_append_sheet(wb, ws, "الاسماء");
        }
        
        if (selOrders && dataToExport.orders?.length) {
          const ws = XLSX.utils.json_to_sheet(dataToExport.orders);
          XLSX.utils.book_append_sheet(wb, ws, "العملاء");
        } else if (selOrders) {
          const ws = XLSX.utils.json_to_sheet([{ "رقم الطلب": "لا توجد طلبات", "العميل": "" }]);
          XLSX.utils.book_append_sheet(wb, ws, "العملاء");
        }
        
        if (selTemplates && dataToExport.templates?.length) {
          const ws = XLSX.utils.json_to_sheet(dataToExport.templates);
          XLSX.utils.book_append_sheet(wb, ws, "الرسائل");
        }
        
        if (selLogs && dataToExport.logs?.length) {
          const ws = XLSX.utils.json_to_sheet(dataToExport.logs);
          XLSX.utils.book_append_sheet(wb, ws, "الاشارات");
        }

        const blob = excelWorkbookToBlob(wb);
        const fileName = `backup_${dateStr}.xlsx`;
        const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        setExportBlob({ blob, mime: mimeType, name: fileName });

        const result = await saveFileToDevice(
          blob, 
          fileName, 
          mimeType, 
          'نسخة احتياطية لقاعدة البيانات (Excel)'
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
          setExportNotice(result.error || 'حدث خطأ أثناء محاولة حفظ الملف.');
        }
      }
    } catch (e: any) {
      console.error(e);
      setIsExporting(false);
      setExportNotice(e.message || 'حدث خطأ غير متوقع أثناء التصدير.');
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
            arr.forEach(row => { if (row.Key) importedData.settings[row.Key] = row.Value; });
          }
          if (wb.SheetNames.includes('معلومات المركز')) {
            const arr: any[] = XLSX.utils.sheet_to_json(wb.Sheets['معلومات المركز']);
            if (arr.length > 0) importedData.centerInfo = arr[0];
          }
          if (wb.SheetNames.includes('الاسماء')) {
            importedData.contacts = XLSX.utils.sheet_to_json(wb.Sheets['الاسماء']);
          }
          if (wb.SheetNames.includes('العملاء')) {
            importedData.orders = XLSX.utils.sheet_to_json(wb.Sheets['العملاء']);
          }
          if (wb.SheetNames.includes('الرسائل')) {
            importedData.templates = XLSX.utils.sheet_to_json(wb.Sheets['الرسائل']);
          }
          if (wb.SheetNames.includes('الاشارات')) {
            importedData.logs = XLSX.utils.sheet_to_json(wb.Sheets['الاشارات']);
          }
        } else {
          alert('صيغة الملف غير مدعومة');
          return;
        }
        
        // Apply imported data based on selections
        if (selSettings && importedData.settings) {
          Object.entries(importedData.settings).forEach(([k, v]) => {
            localStorage.setItem(k, v as string);
          });
        }
        
        if (selCenterInfo && importedData.centerInfo) {
          if (importedData.centerInfo.centerName) localStorage.setItem('centerName', importedData.centerInfo.centerName);
          if (importedData.centerInfo.centerMobile) localStorage.setItem('centerMobile', importedData.centerInfo.centerMobile);
        }
        
        const allOrders = await dbService.getOrders();
        let updatedOrders = [...allOrders];
        
        if (selContacts && importedData.contacts) {
          const newContacts = importedData.contacts;
          updatedOrders = [...updatedOrders.filter(o => !isContactOrder(o)), ...newContacts];
        }
        
        if (selOrders && importedData.orders) {
          const newOrders = importedData.orders;
          updatedOrders = [...updatedOrders.filter(o => isContactOrder(o)), ...newOrders];
        }
        
        if ((selContacts && importedData.contacts) || (selOrders && importedData.orders)) {
           LocalStorageDB.setCollection('orders', updatedOrders);
           updatedOrders.forEach(o => dbService.saveOrder(o));
        }
        
        if (selTemplates && importedData.templates) {
          localStorage.setItem('notification_templates', JSON.stringify(importedData.templates));
        }
        
        if (selLogs && importedData.logs) {
          LocalStorageDB.setCollection('notification_logs', importedData.logs);
          importedData.logs.forEach((l: any) => dbService.saveNotificationLog(l));
        }
        
        alert('تم الاستيراد بنجاح! سيتم إعادة تحميل النظام.');
        window.location.reload();
        
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء قراءة الملف.');
      }
    };
    
    if (file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const CheckboxRow = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (c: boolean) => void }) => (
    <div 
      className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={() => onChange(!checked)}
    >
      <span className="font-medium text-gray-700 text-sm">{label}</span>
      <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${checked ? 'bg-teal-500 text-white' : 'bg-gray-200 text-transparent'}`}>
        <CheckSquare className="w-4 h-4" />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-start pt-1 sm:pt-2 overflow-y-auto justify-center p-2 bg-transparent" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-in slide-in-from-top-2 duration-150 shadow-2xl border border-gray-200 mb-4">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            {exportResult 
              ? 'نتيجة تصدير النسخة الاحتياطية' 
              : mode === 'select' 
                ? 'النسخ الاحتياطي والاستعادة' 
                : (mode === 'export' ? 'تصدير البيانات' : 'استيراد البيانات')}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* 1. SUCCESS EXPORT VIEW */}
          {exportResult ? (
            <div className="space-y-5 animate-in fade-in duration-200 text-right">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
              </div>

              <div className="text-center space-y-1">
                <h4 className="font-bold text-lg text-gray-800">
                  {exportResult.method === 'picker' 
                    ? 'تم حفظ النسخة الاحتياطية على جهازك بنجاح! 🎉' 
                    : 'تم تجهيز ملف النسخة الاحتياطية بنجاح! 💾'}
                </h4>
                <p className="text-xs text-gray-500 font-medium">
                  {exportResult.method === 'picker' 
                    ? 'تم تخزين الملف في المجلد الذي اخترته على ذاكرة جهازك.' 
                    : 'إذا لم يبدأ التنزيل أو لم تفتح نافذة المجلد تلقائياً، يمكنك الضغط على الزر أدناه لحفظه مباشرة.'}
                </p>
              </div>

              {/* File Info Box */}
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
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">طريقة الحفظ:</span>
                  <span className="font-bold text-gray-700">
                    {exportResult.method === 'picker' ? '📁 اختيار مجلد مباشر (Save As)' : '📥 تنزيل مباشر لذاكرة الجهاز'}
                  </span>
                </div>
              </div>

              {/* Fallback direct download button */}
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

              {/* Notice for iframe */}
              {inIframe && (
                <div className="bg-amber-50 border border-amber-200/80 p-3 rounded-2xl text-right text-xs text-amber-900 space-y-1.5 leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>تنبيه بيئة العرض (iFrame):</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    إذا كان متصفحك يمنع ظهور نافذة اختيار المجلد تلقائياً بسبب إطار المعاينة، يمكنك فتح التطبيق في نافذة مستقلة كاملة:
                  </p>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-teal-700 font-bold text-xs hover:underline pt-0.5"
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
            /* 2. SELECT MODE VIEW */
            <div className="space-y-4">
              <button
                onClick={() => setMode('export')}
                className="w-full p-4 border-2 border-teal-100 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-2xl flex items-center gap-4 transition-colors"
              >
                <div className="p-3 bg-white rounded-xl shadow-sm"><Download className="w-6 h-6 text-teal-600" /></div>
                <div className="text-right">
                  <div className="font-bold text-lg">تصدير (Export)</div>
                  <div className="text-sm opacity-80 font-medium">حفظ بيانات النظام في ملف واختيار مكان الحفظ</div>
                </div>
              </button>
              
              <button
                onClick={() => setMode('import')}
                className="w-full p-4 border-2 border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-2xl flex items-center gap-4 transition-colors"
              >
                <div className="p-3 bg-white rounded-xl shadow-sm"><Upload className="w-6 h-6 text-indigo-600" /></div>
                <div className="text-right">
                  <div className="font-bold text-lg">استيراد (Import)</div>
                  <div className="text-sm opacity-80 font-medium">استرجاع البيانات من ملف سابق</div>
                </div>
              </button>
            </div>
          ) : (
            /* 3. EXPORT / IMPORT CONFIG VIEW */
            <div className="space-y-4">
              <div className="text-sm text-gray-500 mb-2 font-medium">
                {mode === 'export' ? 'اختر البيانات التي تريد تصديرها:' : 'اختر البيانات التي تريد استيرادها من الملف:'}
              </div>
              
              <div className="space-y-2 max-h-[38vh] overflow-y-auto pl-2 pr-1 custom-scrollbar">
                <CheckboxRow label="الاعدادات (Settings)" checked={selSettings} onChange={setSelSettings} />
                <CheckboxRow label="معلومات مركز الصيانة" checked={selCenterInfo} onChange={setSelCenterInfo} />
                <CheckboxRow label="الاسماء (Contacts)" checked={selContacts} onChange={setSelContacts} />
                <CheckboxRow label="العملاء (Orders)" checked={selOrders} onChange={setSelOrders} />
                <CheckboxRow label="الرسائل (Templates)" checked={selTemplates} onChange={setSelTemplates} />
                <CheckboxRow label="الاشارات (Logs)" checked={selLogs} onChange={setSelLogs} />
              </div>
              
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => toggleAll(true)} className="text-xs font-bold text-teal-600 hover:text-teal-800 cursor-pointer">تحديد الكل</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => toggleAll(false)} className="text-xs font-bold text-gray-500 hover:text-gray-700 cursor-pointer">إلغاء التحديد</button>
              </div>

              {exportNotice && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{exportNotice}</span>
                </div>
              )}

              {mode === 'export' && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="text-sm text-gray-500 mb-2 font-medium">صيغة الملف:</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setExportFormat('json')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all cursor-pointer ${exportFormat === 'json' ? 'bg-teal-50 border-teal-200 text-teal-700 ring-2 ring-teal-500/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      <FileJson className="w-5 h-5 text-teal-600" />
                      JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat('excel')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all cursor-pointer ${exportFormat === 'excel' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-500/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                      Excel
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2 text-right">
                    💡 سيقوم المتصفح بفتح نافذة اختيار مكان حفظ الملف على ذاكرة جهازك (Save As) لتحديد المجلد المطلوب مباشرة.
                  </p>
                </div>
              )}

              {mode === 'import' && (
                <div className="pt-2">
                  <div className="bg-amber-50 text-amber-800 text-[11px] p-3 rounded-xl flex items-start gap-2 mb-4 font-medium leading-relaxed">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>تنبيه: استيراد البيانات سيقوم بدمج أو استبدال البيانات الحالية للخيارات المحددة. يرجى أخذ نسخة احتياطية أولاً.</span>
                  </div>
                  <input 
                    type="file" 
                    accept=".json,.xlsx,.xls" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleImportFile}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setMode('select')}
                  disabled={isExporting}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-xs"
                >
                  رجوع
                </button>
                {mode === 'export' ? (
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex-[2] py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg shadow-teal-500/30 text-xs"
                  >
                    {isExporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري حفظ وتجهيز الملف...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>تصدير الآن</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg shadow-indigo-500/30 text-xs"
                  >
                    <Upload className="w-4 h-4" />
                    <span>اختيار ملف للاستيراد</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
