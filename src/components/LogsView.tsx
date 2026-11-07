import React, { useState, useEffect } from 'react';
import { Search, Calendar, Sliders, X, FileText, Smartphone, LayoutDashboard, Clock } from 'lucide-react';
import { NotificationLog } from '../types';

interface LogsViewProps {
  notificationLogs: NotificationLog[];
  onViewCustomer?: (name: string, phone?: string) => void;
}

export const LogsView: React.FC<LogsViewProps> = ({ notificationLogs, onViewCustomer }) => {
  const [logSearchName, setLogSearchName] = useState('');
  const [logSearchType, setLogSearchType] = useState<'all' | 'whatsapp' | 'sms'>('all');
  const [logSearchStartDate, setLogSearchStartDate] = useState('');
  const [logSearchEndDate, setLogSearchEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);

  useEffect(() => {
    if (selectedLog) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [selectedLog]);

  const filteredLogs = notificationLogs.filter(log => {
    if (logSearchName) {
      const term = logSearchName.toLowerCase().trim();
      const matchesName = log.customerName?.toLowerCase().includes(term);
      const matchesOrderId = log.orderId?.toLowerCase().includes(term);
      const matchesPhone = log.customerPhone?.includes(term);
      if (!matchesName && !matchesOrderId && !matchesPhone) {
        return false;
      }
    }
    if (logSearchType !== 'all') {
      if (log.type !== logSearchType) {
        return false;
      }
    }
    if (logSearchStartDate) {
      const startDate = new Date(logSearchStartDate);
      startDate.setHours(0, 0, 0, 0);
      const logDate = new Date(log.timestamp);
      if (logDate < startDate) {
        return false;
      }
    }
    if (logSearchEndDate) {
      const endDate = new Date(logSearchEndDate);
      endDate.setHours(23, 59, 59, 999);
      const logDate = new Date(log.timestamp);
      if (logDate > endDate) {
        return false;
      }
    }
    return true;
  });

  const hasActiveFilters = logSearchName || logSearchType !== 'all' || logSearchStartDate || logSearchEndDate;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-600/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <span className="bg-white/10 text-indigo-100 border border-white/10 text-[10px] font-sans font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              سجل المراسلات
            </span>
            <h3 className="font-sans font-extrabold text-2xl">الرسائل والإشعارات المرسلة</h3>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 shrink-0">
            <FileText className="w-8 h-8 text-indigo-300" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
        {notificationLogs.length > 0 && (
          <div className="p-6 bg-gray-50/50 border-b border-gray-100">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 text-gray-700">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span className="font-sans font-bold text-xs">البحث المتقدم والفلاتر</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-500">اسم العميل / رقم الطلب / الهاتف</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث بالاسم أو رقم الهاتف..."
                    value={logSearchName}
                    onChange={(e) => setLogSearchName(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs border border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-right font-sans transition-all"
                  />
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-500">نوع الإشعار</label>
                <select
                  value={logSearchType}
                  onChange={(e) => setLogSearchType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-right font-sans bg-white transition-all cursor-pointer"
                >
                  <option value="all">الكل (واتساب و SMS)</option>
                  <option value="whatsapp">واتساب فقط</option>
                  <option value="sms">SMS فقط</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-500">من تاريخ</label>
                <div className="relative">
                  <input
                    type="date"
                    value={logSearchStartDate}
                    onChange={(e) => setLogSearchStartDate(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs border border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-right font-sans font-mono transition-all cursor-pointer"
                  />
                  <Calendar className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-500">إلى تاريخ</label>
                <div className="relative">
                  <input
                    type="date"
                    value={logSearchEndDate}
                    onChange={(e) => setLogSearchEndDate(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs border border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-right font-sans font-mono transition-all cursor-pointer"
                  />
                  <Calendar className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex justify-between items-center mt-5 pt-5 border-t border-dashed border-gray-200">
                <span className="text-[11px] font-sans text-gray-500">
                  تم العثور على <strong className="text-indigo-600 font-mono text-xs">{filteredLogs.length}</strong> سجل يطابق الفلاتر من أصل <strong className="font-mono">{notificationLogs.length}</strong>
                </span>
                <button
                  onClick={() => {
                    setLogSearchName('');
                    setLogSearchType('all');
                    setLogSearchStartDate('');
                    setLogSearchEndDate('');
                  }}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-sans font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <X className="w-3 h-3 text-gray-500" />
                  <span>مسح الفلاتر</span>
                </button>
              </div>
            )}
          </div>
        )}

        {notificationLogs.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <span className="text-5xl block mb-3 opacity-50">📬</span>
            <p className="font-sans font-bold text-gray-700">سجل الإشعارات فارغ تماماً</p>
            <p className="font-sans text-xs text-gray-400 mt-1">عند إرسال إشعارات للعملاء ستظهر جميعها هنا بشكل منظم.</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <span className="text-5xl block mb-3 opacity-50">🔍</span>
            <p className="font-sans font-bold text-gray-700">لم يتم العثور على نتائج</p>
            <p className="font-sans text-xs text-gray-400 mt-1">لا توجد رسائل تتطابق مع بحثك الحالي، جرب تغيير الفلاتر.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-5 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedLog(log)}>
                <div className="flex flex-col sm:flex-row gap-4 sm:items-start justify-between text-right">
                  <div className="space-y-2 flex-grow min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md ${
                        log.type === 'whatsapp' 
                          ? 'bg-[#E7FDEE] text-[#054E25]' 
                          : 'bg-indigo-50 text-indigo-700'
                      }`}>
                        {log.type === 'whatsapp' ? <Smartphone className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        {log.type === 'whatsapp' ? 'واتساب' : 'SMS'}
                      </span>
                      {log.triggerEvent && (
                        <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                          <LayoutDashboard className="w-3 h-3" />
                          {log.triggerEvent}
                        </span>
                      )}
                      <span className="bg-gray-100 text-gray-500 font-mono text-[10px] font-medium px-2 py-1 rounded-md flex items-center gap-1 mr-auto sm:mr-0">
                        <Clock className="w-3 h-3" />
                        {new Date(log.timestamp).toLocaleString('ar-SA')}
                      </span>
                    </div>
                    
                    <div>
                      <div className="text-sm font-bold text-gray-800 font-sans flex items-center gap-1.5 flex-wrap">
                        <span className="text-gray-400 font-normal text-xs">إلى الزبون:</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewCustomer?.(log.customerName, log.customerPhone);
                          }}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer font-bold transition-colors"
                          title="عرض ملف وسجل العميل وتقارير الصيانة والرسائل"
                        >
                          {log.customerName}
                        </button>
                        {log.orderId && <span className="text-gray-400 font-mono text-xs">({log.orderId})</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 font-mono" dir="ltr">{log.customerPhone}</div>
                    </div>
                    
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed font-sans whitespace-pre-wrap mt-2 line-clamp-2">
                      {log.content}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-start pt-1 sm:pt-2 overflow-y-auto justify-center p-2 bg-transparent animate-in fade-in duration-200" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-3xl max-w-md w-full mb-4 border border-gray-100 overflow-hidden transform scale-100 transition-all text-right font-sans shadow-2xl shadow-indigo-500/10 animate-in slide-in-from-top-2 duration-150" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <h3 className="font-extrabold text-sm">تفاصيل الرسالة</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md ${
                  selectedLog.type === 'whatsapp' 
                    ? 'bg-[#E7FDEE] text-[#054E25]' 
                    : 'bg-indigo-50 text-indigo-700'
                }`}>
                  {selectedLog.type === 'whatsapp' ? <Smartphone className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                  {selectedLog.type === 'whatsapp' ? 'واتساب' : 'SMS'}
                </span>
                <span className="bg-gray-100 text-gray-500 font-mono text-[10px] font-medium px-2 py-1 rounded-md flex items-center gap-1 mr-auto">
                  <Clock className="w-3 h-3" />
                  {new Date(selectedLog.timestamp).toLocaleString('ar-SA')}
                </span>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">العميل</label>
                <div className="text-sm font-bold text-gray-800 flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLog(null);
                      onViewCustomer?.(selectedLog.customerName, selectedLog.customerPhone);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer font-bold inline-flex items-center gap-1"
                    title="فتح سجل الزبون الكامل، تقرير الصيانة والرسائل"
                  >
                    <span>{selectedLog.customerName}</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-sans">ملف وسجل الزبون ↗</span>
                  </button>
                  {selectedLog.orderId && <span className="text-gray-400 font-mono text-xs">({selectedLog.orderId})</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 font-mono" dir="ltr">{selectedLog.customerPhone}</div>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">نص الرسالة</label>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-800 leading-relaxed font-sans whitespace-pre-wrap">
                  {selectedLog.content}
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

