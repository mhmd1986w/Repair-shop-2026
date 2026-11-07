import React, { useState, useEffect } from 'react';
import { Trash2, X, AlertTriangle, Check } from 'lucide-react';
import { dbService, LocalStorageDB } from '../lib/firebase';
import { isContactOrder } from '../types';

interface ClearDataModalProps {
  onClose: () => void;
  onClearAllOrders?: () => void;
  onClearLogs?: () => void;
  onClearNames?: (all: boolean) => void;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({ onClose, onClearAllOrders, onClearLogs, onClearNames }) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const [selSettings, setSelSettings] = useState(false);
  const [selContacts, setSelContacts] = useState(false);
  const [selOrders, setSelOrders] = useState(false);
  const [selLogs, setSelLogs] = useState(false);

  const [confirmStep, setConfirmStep] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleClearSelected = async () => {
    if (!selSettings && !selContacts && !selOrders && !selLogs) {
      alert('يرجى تحديد عنصر واحد على الأقل للمسح.');
      return;
    }
    setConfirmStep(true);
  };

  const executeClear = async () => {
    try {
      if (selOrders && onClearAllOrders) {
        onClearAllOrders();
      }

      if (selContacts && onClearNames) {
        // If we are also clearing orders, we might just wipe everything in the orders collection
        onClearNames(true);
      }

      if (selLogs && onClearLogs) {
        onClearLogs();
      }

      if (selSettings) {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && !key.startsWith('db_') && key !== 'centerName' && key !== 'centerMobile' && key !== 'notification_templates') {
            localStorage.removeItem(key);
          }
        }
      }

      // Fallback cleanup in case props were missing
      if (selOrders && selContacts) {
        localStorage.removeItem('db_orders');
      }

      if (selLogs) {
         localStorage.removeItem('db_notification_logs');
      }

      alert('تم مسح البيانات المحددة بنجاح. سيتم إعادة تحميل النظام.');
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء مسح البيانات.');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start pt-1 sm:pt-2 overflow-y-auto justify-center p-2 bg-transparent" dir="rtl">
      <div className="absolute inset-0 bg-transparent" onClick={onClose}></div>
      <div className="relative bg-white rounded-3xl w-full max-w-md overflow-hidden animate-in slide-in-from-top-2 duration-150 shadow-2xl border border-gray-200 mb-4">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-red-50/50">
          <h3 className="font-bold text-red-700 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            مسح البيانات المحددة
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!confirmStep ? (
            <div className="space-y-4">
              <div className="bg-red-50 text-red-800 text-[11px] p-3 rounded-xl flex items-start gap-2 font-medium leading-relaxed">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>تحذير: سيتم حذف البيانات المحددة بشكل نهائي من قاعدة البيانات. يرجى التأكد من أخذ نسخة احتياطية أولاً.</span>
              </div>

              <div className="space-y-3 pt-2">
                <div className="text-sm font-bold text-gray-700 px-1">حدد البيانات المراد مسحها:</div>
                
                <label className="flex items-center gap-3 p-3 border border-red-100 rounded-xl hover:bg-red-50 cursor-pointer transition-colors">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selSettings ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300 bg-white'}`}>
                    {selSettings && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="font-bold text-sm text-gray-700">إعدادات النظام والطباعة</div>
                  <input type="checkbox" className="hidden" checked={selSettings} onChange={(e) => setSelSettings(e.target.checked)} />
                </label>

                <label className="flex items-center gap-3 p-3 border border-red-100 rounded-xl hover:bg-red-50 cursor-pointer transition-colors">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selContacts ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300 bg-white'}`}>
                    {selContacts && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="font-bold text-sm text-gray-700">الأسماء وجهات الاتصال</div>
                  <input type="checkbox" className="hidden" checked={selContacts} onChange={(e) => setSelContacts(e.target.checked)} />
                </label>

                <label className="flex items-center gap-3 p-3 border border-red-100 rounded-xl hover:bg-red-50 cursor-pointer transition-colors">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selOrders ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300 bg-white'}`}>
                    {selOrders && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="font-bold text-sm text-gray-700">سجلات العملاء (طلبات الصيانة)</div>
                  <input type="checkbox" className="hidden" checked={selOrders} onChange={(e) => setSelOrders(e.target.checked)} />
                </label>

                <label className="flex items-center gap-3 p-3 border border-red-100 rounded-xl hover:bg-red-50 cursor-pointer transition-colors">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selLogs ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300 bg-white'}`}>
                    {selLogs && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="font-bold text-sm text-gray-700">سجلات الرسائل والإشعارات المرسلة</div>
                  <input type="checkbox" className="hidden" checked={selLogs} onChange={(e) => setSelLogs(e.target.checked)} />
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleClearSelected}
                  className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg shadow-red-500/30"
                >
                  <Trash2 className="w-4 h-4" />
                  متابعة المسح
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-red-50 border border-red-100 text-red-800 text-sm p-4 rounded-xl font-bold text-center leading-relaxed">
                هل أنت متأكد من مسح البيانات المحددة بشكل نهائي؟
                <br/>
                <span className="text-xs text-red-600 font-medium mt-1 block">حذف مباشر وسريع دون الحاجة لكلمة مرور أو اسم مستخدم.</span>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => { setConfirmStep(false); setConfirmText(''); }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-sm"
                >
                  تراجع
                </button>
                <button
                  onClick={executeClear}
                  className="flex-[2] py-3.5 font-bold rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg bg-red-600 hover:bg-red-700 text-white shadow-red-500/30 text-sm active:scale-[0.98] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  تأكيد الحذف النهائي الآن
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
