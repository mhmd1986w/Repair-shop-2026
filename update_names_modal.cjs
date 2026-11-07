const fs = require('fs');

const content = `import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, CheckSquare, Square, FileSpreadsheet, X, AlertTriangle, FileText, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbService, LocalStorageDB } from '../lib/firebase';
import { isContactOrder } from '../types';

interface NamesBackupModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const NamesBackupModal: React.FC<NamesBackupModalProps> = ({ onClose, onSuccess }) => {
  const [mode, setMode] = useState<'select' | 'export' | 'import' | 'import_preview'>('select');
  const [exportFormat, setExportFormat] = useState<'vcf' | 'excel'>('excel');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [exportContacts, setExportContacts] = useState<{name: string, phone: string, selected: boolean}[]>([]);
  const [importContacts, setImportContacts] = useState<{name: string, phone: string, selected: boolean}[]>([]);

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
    try {
      const contactsToExport = exportContacts.filter(c => c.selected);
      
      if (contactsToExport.length === 0) {
        alert('يرجى تحديد جهة اتصال واحدة على الأقل للتصدير.');
        return;
      }

      if (exportFormat === 'vcf') {
        let vcfContent = '';
        contactsToExport.forEach(contact => {
          vcfContent += \`BEGIN:VCARD\\nVERSION:3.0\\nFN:\${contact.name}\\nTEL:\${contact.phone}\\nEND:VCARD\\n\`;
        });
        
        const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`contacts_\${new Date().toISOString().split('T')[0]}.vcf\`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(contactsToExport.map(c => ({ Name: c.name, Phone: c.phone })));
        XLSX.utils.book_append_sheet(wb, ws, "الاسماء");
        XLSX.writeFile(wb, \`contacts_\${new Date().toISOString().split('T')[0]}.xlsx\`);
      }
      
      onSuccess();
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء تصدير جهات الاتصال.');
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
        
        if (file.name.endsWith('.vcf')) {
          const text = content as string;
          const cards = text.split('BEGIN:VCARD');
          cards.forEach(card => {
            if (!card.trim()) return;
            const nameMatch = card.match(/FN:(.+)/);
            const phoneMatch = card.match(/TEL.*:(.+)/);
            if (nameMatch && phoneMatch) {
              importedContacts.push({
                name: nameMatch[1].trim(),
                phone: phoneMatch[1].trim(),
                selected: true
              });
            }
          });
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const data = new Uint8Array(content as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          if (wb.SheetNames.includes('الاسماء')) {
             const rawData: any[] = XLSX.utils.sheet_to_json(wb.Sheets['الاسماء']);
             importedContacts = rawData.map(row => ({
               name: row.name || row.Name || row['الاسم'] || row['اسم العميل'],
               phone: row.phone || row.Phone || row['رقم الهاتف'] || row['الجوال'],
               selected: true
             })).filter(c => c.name && c.phone);
          } else if (wb.SheetNames.length > 0) {
             const rawData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
             importedContacts = rawData.map(row => ({
               name: row.name || row.Name || row['الاسم'] || row['اسم العميل'],
               phone: row.phone || row.Phone || row['رقم الهاتف'] || row['الجوال'],
               selected: true
             })).filter(c => c.name && c.phone);
          }
        } else {
          alert('صيغة الملف غير مدعومة');
          return;
        }
        
        if (importedContacts.length === 0) {
          alert('لم يتم العثور على جهات اتصال صحيحة في الملف.');
          return;
        }
        
        setImportContacts(importedContacts);
        setMode('import_preview');
        
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء قراءة الملف.');
      }
    };
    
    if (file.name.endsWith('.vcf')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handleConfirmImport = async () => {
    try {
      const contactsToImport = importContacts.filter(c => c.selected);
      
      if (contactsToImport.length === 0) {
        alert('يرجى تحديد جهة اتصال واحدة على الأقل للاستيراد.');
        return;
      }
      
      const allOrders = await dbService.getOrders();
      let updatedOrders = [...allOrders];
      
      const newContactOrders = contactsToImport.map((contact, idx) => ({
          id: \`CUST-\${Date.now()}-\${idx}\`,
          customerName: contact.name,
          customerPhone: contact.phone,
          deviceType: 'جهة اتصال',
          brandModel: 'مستورد',
          faultDescription: 'جهة اتصال مستوردة',
          status: 'delivered',
          totalCost: 0,
          paidAmount: 0,
          remainingAmount: 0,
          expectedDeliveryDate: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
      }));

      updatedOrders = [...updatedOrders, ...newContactOrders];
      LocalStorageDB.setCollection('orders', updatedOrders);
      newContactOrders.forEach(o => dbService.saveOrder(o));
      
      alert(\`تم استيراد \${contactsToImport.length} جهة اتصال بنجاح! سيتم إعادة تحميل النظام.\`);
      window.location.reload();
    } catch (e) {
       console.error(e);
       alert('حدث خطأ أثناء الاستيراد.');
    }
  };
  
  const toggleExportContact = (index: number) => {
    const newContacts = [...exportContacts];
    newContacts[index].selected = !newContacts[index].selected;
    setExportContacts(newContacts);
  };
  
  const toggleImportContact = (index: number) => {
    const newContacts = [...importContacts];
    newContacts[index].selected = !newContacts[index].selected;
    setImportContacts(newContacts);
  };

  const getTitle = () => {
    if (mode === 'select') return 'تصدير / استيراد الأسماء';
    if (mode === 'export') return 'تصدير الأسماء';
    if (mode === 'import') return 'استيراد الأسماء';
    if (mode === 'import_preview') return 'تأكيد استيراد الأسماء';
    return '';
  };

  const ContactList = ({ contacts, onToggle, onToggleAll }: { contacts: any[], onToggle: (idx: number) => void, onToggleAll: (sel: boolean) => void }) => {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-sm font-bold text-gray-700">الأسماء المتوفرة ({contacts.length})</span>
          <div className="flex gap-2">
            <button onClick={() => onToggleAll(true)} className="text-[10px] text-teal-600 font-bold hover:underline">تحديد الكل</button>
            <span className="text-gray-300">|</span>
            <button onClick={() => onToggleAll(false)} className="text-[10px] text-gray-500 font-bold hover:underline">إلغاء التحديد</button>
          </div>
        </div>
        <div className="border border-gray-100 rounded-2xl overflow-hidden max-h-[35vh] overflow-y-auto custom-scrollbar bg-gray-50/50">
          {contacts.map((contact, idx) => (
            <div 
              key={idx} 
              onClick={() => onToggle(idx)}
              className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-white cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={\`w-5 h-5 rounded border flex items-center justify-center transition-colors \${contact.selected ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-300 bg-white'}\`}>
                  {contact.selected && <Check className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-800">{contact.name}</div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">{contact.phone}</div>
                </div>
              </div>
            </div>
          ))}
          {contacts.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">لا توجد أسماء متاحة.</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            {getTitle()}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {mode === 'select' && (
            <div className="space-y-4">
              <button
                onClick={() => setMode('export')}
                className="w-full p-4 border-2 border-teal-100 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-2xl flex items-center gap-4 transition-colors"
              >
                <div className="p-3 bg-white rounded-xl shadow-sm"><Download className="w-6 h-6 text-teal-600" /></div>
                <div className="text-right">
                  <div className="font-bold text-lg">تصدير (Export)</div>
                  <div className="text-sm opacity-80 font-medium">حفظ الأسماء في ملف</div>
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
          )}

          {mode === 'export' && (
            <div className="space-y-4">
              <ContactList 
                contacts={exportContacts} 
                onToggle={toggleExportContact} 
                onToggleAll={(sel) => setExportContacts(exportContacts.map(c => ({...c, selected: sel})))} 
              />
              
              <div className="pt-4 border-t border-gray-100">
                <div className="text-sm text-gray-500 mb-3 font-medium">صيغة الملف:</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setExportFormat('excel')}
                    className={\`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all \${exportFormat === 'excel' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-500/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}\`}
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    Excel
                  </button>
                  <button
                    onClick={() => setExportFormat('vcf')}
                    className={\`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all \${exportFormat === 'vcf' ? 'bg-teal-50 border-teal-200 text-teal-700 ring-2 ring-teal-500/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}\`}
                  >
                    <FileText className="w-5 h-5" />
                    VCF (vCard)
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setMode('select')}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  رجوع
                </button>
                <button
                  onClick={handleExport}
                  className="flex-[2] py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg shadow-teal-500/30"
                >
                  <Download className="w-4 h-4" />
                  تصدير المحدد ({exportContacts.filter(c => c.selected).length})
                </button>
              </div>
            </div>
          )}

          {mode === 'import' && (
            <div className="space-y-4">
              <div className="bg-amber-50 text-amber-800 text-[11px] p-3 rounded-xl flex items-start gap-2 font-medium leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>اختر ملف Excel أو VCF للبدء، سيتم عرض قائمة بالأسماء لتختار منها قبل الاستيراد النهائي.</span>
              </div>
              <input 
                type="file" 
                accept=".vcf,.xlsx,.xls" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImportFile}
              />
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setMode('select')}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  رجوع
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg shadow-indigo-500/30"
                >
                  <Upload className="w-4 h-4" />
                  اختيار ملف
                </button>
              </div>
            </div>
          )}

          {mode === 'import_preview' && (
            <div className="space-y-4">
              <ContactList 
                contacts={importContacts} 
                onToggle={toggleImportContact} 
                onToggleAll={(sel) => setImportContacts(importContacts.map(c => ({...c, selected: sel})))} 
              />
              
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setMode('import')}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  رجوع
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg shadow-indigo-500/30"
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
`
fs.writeFileSync('src/components/NamesBackupModal.tsx', content);
