import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, CheckSquare, Square, FileSpreadsheet, FileJson, X, AlertTriangle, FileText, Check, CheckCircle2, RefreshCw, Share2, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbService, LocalStorageDB } from '../lib/firebase';
import { isContactOrder } from '../types';
import { saveFileToDevice, excelWorkbookToBlob, shareFile, isRunningInIframe, SaveFileResult } from '../utils/fileSaver';

interface NamesBackupModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const NamesBackupModal: React.FC<NamesBackupModalProps> = ({ onClose, onSuccess }) => {
  const [mode, setMode] = useState<'select' | 'export' | 'import' | 'import_preview'>('select');
  const [exportFormat, setExportFormat] = useState<'excel' | 'vcf' | 'json'>('excel');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [exportContacts, setExportContacts] = useState<{name: string, phone: string, selected: boolean}[]>([]);
  const [importContacts, setImportContacts] = useState<{name: string, phone: string, selected: boolean}[]>([]);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<SaveFileResult | null>(null);
  const [exportBlob, setExportBlob] = useState<{ blob: Blob; mime: string; name: string } | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const inIframe = isRunningInIframe();

  useEffect(() => {
    if (mode === 'export') {
      loadExportContacts();
    }
  }, [mode]);

  const loadExportContacts = async () => {
    const allOrders = await dbService.getOrders();
    const contactsMap = new Map();
    allOrders.forEach(order => {
      if (order.customerName && order.customerPhone) {
        contactsMap.set(order.customerPhone, {
          name: order.customerName,
          phone: order.customerPhone,
          selected: true
        });
      }
    });
    setExportContacts(Array.from(contactsMap.values()));
  };

  const handleExport = async () => {
    setExportNotice(null);
    setExportResult(null);

    const contactsToExport = exportContacts.filter(c => c.selected);
    if (contactsToExport.length === 0) {
      setExportNotice('يرجى تحديد جهة اتصال واحدة على الأقل للتصدير.');
      return;
    }

    setIsExporting(true);

    try {
      const dateStr = new Date().toISOString().split('T')[0];

      if (exportFormat === 'vcf') {
        let vcfContent = '';
        contactsToExport.forEach(contact => {
          vcfContent += `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${contact.name}\r\nTEL;TYPE=CELL:${contact.phone}\r\nEND:VCARD\r\n`;
        });
        
        const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
        const fileName = `contacts_${dateStr}.vcf`;
        const mimeType = 'text/vcard';

        setExportBlob({ blob, mime: mimeType, name: fileName });

        const result = await saveFileToDevice(
          blob,
          fileName,
          mimeType,
          'جهات الاتصال (VCF)'
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
      } else if (exportFormat === 'json') {
        const jsonContent = JSON.stringify(contactsToExport, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const fileName = `contacts_${dateStr}.json`;
        const mimeType = 'application/json';

        setExportBlob({ blob, mime: mimeType, name: fileName });

        const result = await saveFileToDevice(
          blob,
          fileName,
          mimeType,
          'جهات الاتصال (JSON)'
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
        const ws = XLSX.utils.json_to_sheet(contactsToExport.map(c => ({ 'الاسم': c.name, 'رقم الهاتف': c.phone })));
        XLSX.utils.book_append_sheet(wb, ws, "الاسماء");

        const blob = excelWorkbookToBlob(wb);
        const fileName = `contacts_${dateStr}.xlsx`;
        const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        setExportBlob({ blob, mime: mimeType, name: fileName });

        const result = await saveFileToDevice(
          blob,
          fileName,
          mimeType,
          'جهات الاتصال (Excel)'
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
      setExportNotice(e.message || 'حدث خطأ أثناء تصدير جهات الاتصال.');
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
        
        let importedContacts: any[] = [];
        
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content as string);
          const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.contacts) ? parsed.contacts : []);
          list.forEach((r: any) => {
            const name = r.name || r.customerName || r['الاسم'] || r['اسم'] || '';
            const phone = r.phone || r.customerPhone || r['الهاتف'] || r['رقم الهاتف'] || '';
            if (name || phone) {
              importedContacts.push({
                name: String(name || phone),
                phone: String(phone),
                selected: true
              });
            }
          });
        } else if (file.name.endsWith('.vcf')) {
          const text = content as string;
          const vcards = text.split('BEGIN:VCARD');
          
          vcards.forEach(card => {
            if (!card.trim()) return;
            let name = '';
            let phone = '';
            
            const lines = card.split(/\r\n|\r|\n/);
            lines.forEach(line => {
              if (line.startsWith('FN:') || line.startsWith('FN;')) {
                name = line.substring(line.indexOf(':') + 1).trim();
              }
              if (line.startsWith('TEL:') || line.startsWith('TEL;')) {
                phone = line.substring(line.indexOf(':') + 1).trim();
              }
            });
            
            if (name || phone) {
              importedContacts.push({
                name: name || phone,
                phone: phone,
                selected: true
              });
            }
          });
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const data = new Uint8Array(content as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const sheetName = wb.SheetNames.includes('الاسماء') ? 'الاسماء' : wb.SheetNames[0];
          const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
          
          rows.forEach(r => {
            const name = r.Name || r['الاسم'] || r['اسم'] || '';
            const phone = r.Phone || r['الهاتف'] || r['رقم الهاتف'] || r['موبايل'] || '';
            if (name || phone) {
              importedContacts.push({
                name: String(name || phone),
                phone: String(phone),
                selected: true
              });
            }
          });
        } else {
          alert('صيغة الملف غير مدعومة');
          return;
        }
        
        if (importedContacts.length === 0) {
          alert('لم يتم العثور على جهات اتصال صالحة في الملف.');
          return;
        }

        setImportContacts(importedContacts);
        setMode('import_preview');
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء قراءة الملف.');
      }
    };
    
    if (file.name.endsWith('.vcf') || file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handleConfirmImport = async () => {
    try {
      const selectedToImport = importContacts.filter(c => c.selected);
      if (selectedToImport.length === 0) {
        alert('يرجى تحديد جهة اتصال واحدة على الأقل للاستيراد.');
        return;
      }

      const allOrders = await dbService.getOrders();
      
      const newOrdersList = [...allOrders];
      selectedToImport.forEach(contact => {
        const dummyOrder: any = {
          id: `CON-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          customerName: contact.name,
          customerPhone: contact.phone,
          deviceType: 'جهة اتصال',
          brandModel: 'مستورد من ملف',
          serialNumber: '',
          faultDescription: 'جهة اتصال مستوردة',
          estimatedCost: 0,
          status: 'received',
          expectedDeliveryDate: '',
          technician: '',
          notes: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          statusHistory: []
        };
        newOrdersList.push(dummyOrder);
        dbService.saveOrder(dummyOrder);
      });

      LocalStorageDB.setCollection('orders', newOrdersList);

      alert(`تم استيراد ${selectedToImport.length} جهة اتصال بنجاح!`);
      onSuccess();
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ الأسماء.');
    }
  };

  const toggleExportContact = (phone: string) => {
    setExportContacts(exportContacts.map(c => c.phone === phone ? { ...c, selected: !c.selected } : c));
  };

  const toggleImportContact = (idx: number) => {
    setImportContacts(importContacts.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c));
  };

  const getTitle = () => {
    if (exportResult) return 'تم تصدير الأسماء';
    if (mode === 'select') return 'تصدير / استيراد الأسماء';
    if (mode === 'export') return 'تصدير الأسماء';
    if (mode === 'import') return 'استيراد الأسماء';
    if (mode === 'import_preview') return 'معاينة وتأكيد الاستيراد';
    return '';
  };

  const ContactList = ({ contacts, onToggle, onToggleAll, isImport = false }: { contacts: any[], onToggle: (key: any) => void, onToggleAll: (sel: boolean) => void, isImport?: boolean }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center px-1 text-xs">
        <span className="text-gray-500 font-medium">عدد الأسماء: {contacts.length}</span>
        <div className="flex gap-2">
          <button onClick={() => onToggleAll(true)} className="text-teal-600 font-bold hover:underline">تحديد الكل</button>
          <span className="text-gray-300">|</span>
          <button onClick={() => onToggleAll(false)} className="text-gray-500 font-bold hover:underline">إلغاء الكل</button>
        </div>
      </div>
      
      <div className="border border-gray-100 rounded-2xl max-h-[40vh] overflow-y-auto divide-y divide-gray-50 custom-scrollbar p-1">
        {contacts.map((contact, idx) => (
          <div 
            key={isImport ? idx : contact.phone} 
            onClick={() => onToggle(isImport ? idx : contact.phone)}
            className="flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors"
          >
            <div className="flex flex-col text-right">
              <span className="font-bold text-gray-800 text-xs">{contact.name}</span>
              <span className="text-[10px] text-gray-400 font-mono">{contact.phone}</span>
            </div>
            <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${contact.selected ? 'bg-teal-500 text-white' : 'bg-gray-200 text-transparent'}`}>
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

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
                    ? 'تم حفظ ملف الأسماء بنجاح! 🎉' 
                    : 'تم تجهيز ملف الأسماء للتحميل! 💾'}
                </h4>
                <p className="text-xs text-gray-500 font-medium">
                  {exportResult.method === 'picker' 
                    ? 'تم حفظ الملف في المجلد الذي قمت باختياره على جهازك.' 
                    : 'إذا لم تفتح نافذة المجلد تلقائياً، يمكنك الضغط على زر التنزيل أدناه:'}
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
                  <div className="text-sm opacity-80 font-medium">حفظ الأسماء في ملف واختيار مكان الحفظ</div>
                </div>
              </button>
              
              <button
                onClick={() => setMode('import')}
                className="w-full p-4 border-2 border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-2xl flex items-center gap-4 transition-colors"
              >
                <div className="p-3 bg-white rounded-xl shadow-sm"><Upload className="w-6 h-6 text-indigo-600" /></div>
                <div className="text-right">
                  <div className="font-bold text-lg">استيراد (Import)</div>
                  <div className="text-sm opacity-80 font-medium">استرجاع الأسماء من ملف</div>
                </div>
              </button>
            </div>
          ) : mode === 'export' ? (
            <div className="space-y-4">
              <ContactList 
                contacts={exportContacts} 
                onToggle={toggleExportContact} 
                onToggleAll={(sel) => setExportContacts(exportContacts.map(c => ({...c, selected: sel})))} 
              />

              {exportNotice && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{exportNotice}</span>
                </div>
              )}
              
              <div className="pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-2 font-medium">صيغة الملف:</div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportFormat('excel')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all text-xs cursor-pointer ${exportFormat === 'excel' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-500/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('vcf')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all text-xs cursor-pointer ${exportFormat === 'vcf' ? 'bg-teal-50 border-teal-200 text-teal-700 ring-2 ring-teal-500/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <FileText className="w-4 h-4" />
                    VCF
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('json')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all text-xs cursor-pointer ${exportFormat === 'json' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-2 ring-indigo-500/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <FileJson className="w-4 h-4" />
                    JSON
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
                      <span>تصدير المحدد ({exportContacts.filter(c => c.selected).length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : mode === 'import' ? (
            <div className="space-y-4">
              <div className="bg-amber-50 text-amber-800 text-[11px] p-3 rounded-xl flex items-start gap-2 font-medium leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>اختر ملف Excel أو VCF أو JSON للبدء، سيتم عرض قائمة بالأسماء لتختار منها قبل الاستيراد النهائي.</span>
              </div>
              <input 
                type="file" 
                accept=".vcf,.xlsx,.xls,.json" 
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
              <ContactList 
                contacts={importContacts} 
                onToggle={toggleImportContact} 
                onToggleAll={(sel) => setImportContacts(importContacts.map(c => ({...c, selected: sel})))} 
                isImport={true}
              />
              
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
                  استيراد المحدد ({importContacts.filter(c => c.selected).length})
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
