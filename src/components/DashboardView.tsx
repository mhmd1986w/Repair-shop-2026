import React from 'react';
import { MaintenanceOrder, DeviceStatus, NotificationLog, isContactOrder } from '../types';
import { 
  Wrench, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  MessageSquare, 
  TrendingUp, 
  PhoneCall, 
  Send, 
  Bell, 
  Sparkles, 
  UserCheck, 
  Search, 
  Mic, 
  MicOff, 
  Camera, 
  X 
} from 'lucide-react';
import { getWhatsAppLink } from '../lib/notifications';
import { checkMicrophonePermission, requestMicrophonePermission } from '../utils/microphonePermissions';

interface DashboardViewProps {
  orders: MaintenanceOrder[];
  notificationLogs: NotificationLog[];
  onNavigateToOrders: (tab?: 'orders' | 'completed', statusFilter?: string, searchTerm?: string) => void;
  onSendWhatsAppReminder: (order: MaintenanceOrder) => void;
  overdueOrders?: MaintenanceOrder[];
  onScanClick?: () => void;
  onViewCustomer?: (name: string, phone?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders: rawOrders,
  notificationLogs,
  onNavigateToOrders,
  onSendWhatsAppReminder,
  overdueOrders = [],
  onScanClick,
  onViewCustomer
}) => {
  const currencyName = localStorage.getItem('currencyName') || 'دينار';
  const centerName = localStorage.getItem('centerName') || 'TECHNO';
  
  // Exclude contact dummy orders from the dashboard stats, calendar and lists
  const orders = React.useMemo(() => {
    return rawOrders.filter(o => !isContactOrder(o));
  }, [rawOrders]);
  
  // Compute counts
  const totalOrders = orders.length;
  const underMaintenance = orders.filter(
    o => o.status === DeviceStatus.RECEIVED || 
         o.status === DeviceStatus.DIAGNOSING || 
         o.status === DeviceStatus.REPAIRING
  ).length;
  const readyForDelivery = orders.filter(o => o.status === DeviceStatus.READY).length;
  const delivered = orders.filter(o => o.status === DeviceStatus.DELIVERED).length;
  const unrepairable = orders.filter(o => o.status === DeviceStatus.UNREPAIRABLE).length;



  const getStatusLabel = (status: DeviceStatus) => {
    switch (status) {
      case DeviceStatus.RECEIVED: return "تم الاستلام";
      case DeviceStatus.DIAGNOSING: return "تحت الفحص";
      case DeviceStatus.REPAIRING: return "تحت الإصلاح";
      case DeviceStatus.PENDING: return "قيد الانتظار";
      case DeviceStatus.READY: return "جاهز للتسليم";
      case DeviceStatus.DELIVERED: return "تم التسليم";
      case DeviceStatus.UNREPAIRABLE: return "غير قابل للإصلاح";
      default: return status;
    }
  };

  const getStatusBadgeClass = (status: DeviceStatus) => {
    switch (status) {
      case DeviceStatus.RECEIVED:
        return "bg-blue-50 text-blue-700 border-blue-100";
      case DeviceStatus.DIAGNOSING:
        return "bg-purple-50 text-purple-700 border-purple-100";
      case DeviceStatus.REPAIRING:
        return "bg-amber-50 text-amber-700 border-amber-100";
      case DeviceStatus.PENDING:
        return "bg-sky-50 text-sky-700 border-sky-100";
      case DeviceStatus.READY:
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case DeviceStatus.DELIVERED:
        return "bg-gray-100 text-gray-700 border-gray-200";
      case DeviceStatus.UNREPAIRABLE:
        return "bg-rose-50 text-rose-700 border-rose-100";
      default:
        return "bg-gray-50 text-gray-700 border-gray-100";
    }
  };

  // Determine delivery reminders
  // Filter devices that are not yet delivered/unrepairable and whose expected delivery date is near
  // Near = expected delivery date is today or in the past (overdue), or tomorrow
  const getDeliveryReminders = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    return orders.filter(order => {
      if (order.status === DeviceStatus.DELIVERED || order.status === DeviceStatus.UNREPAIRABLE) {
        return false;
      }
      const expDate = order.expectedDeliveryDate;
      return expDate <= tomorrowStr; // Today, tomorrow, or overdue
    }).sort((a, b) => a.expectedDeliveryDate.localeCompare(b.expectedDeliveryDate));
  };

  const reminders = getDeliveryReminders();

  // Helper to render date alert level
  const getDateBadge = (dateStr: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (dateStr < todayStr) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-sans font-bold flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-rose-600 animate-pulse" />
          متأخر جداً!
        </span>
      );
    } else if (dateStr === todayStr) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-sans font-bold flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-600" />
          اليوم!
        </span>
      );
    } else {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-sans font-medium">
          غداً بمشيئة الله
        </span>
      );
    }
  };

  // Top Search Bar States
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isListening, setIsListening] = React.useState(false);
  const recognitionRef = React.useRef<any>(null);

  const handleVoiceSearch = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("عذراً، متصفحك أو جهازك الحالي لا يدعم ميزة التعرف على الصوت. يرجى استخدام متصفح يدعم هذه الخدمة مثل Google Chrome أو Safari.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    try {
      const permCheck = await checkMicrophonePermission();
      if (!permCheck.granted) {
        const reqRes = await requestMicrophonePermission();
        if (!reqRes.granted) {
          alert(reqRes.error || "يرجى تفعيل صلاحية استخدام الميكروفون في المتصفح لتتمكن من تسجيل الصوت.");
          return;
        }
      }
    } catch (e) {
      console.warn("Microphone permission check warning:", e);
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          let cleanedText = transcript.trim();
          if (cleanedText.endsWith('.')) {
            cleanedText = cleanedText.slice(0, -1);
          }
          setSearchTerm(cleanedText);
        }
      };

      recognition.onerror = async (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          const reqRes = await requestMicrophonePermission();
          if (reqRes.granted) {
            alert("تم تفعيل صلاحية المايكروفون بنجاح! اضغط على زر المايكروفون مرة أخرى للبحث بالصوت.");
          } else {
            alert(reqRes.error || "يرجى تفعيل صلاحية استخدام الميكروفون في المتصفح لتتمكن من تسجيل الصوت.");
          }
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
      setIsListening(false);
    }
  };

  const dashboardSearchResults = React.useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.trim().toLowerCase();
    const cleanTerm = term.replace(/[\s-+]/g, '');
    return orders.filter(o => 
      o.id.toLowerCase().includes(term) ||
      o.customerName.toLowerCase().includes(term) ||
      (o.customerPhone && o.customerPhone.replace(/[\s-+]/g, '').includes(cleanTerm)) ||
      (o.brandModel && o.brandModel.toLowerCase().includes(term)) ||
      (o.serialNumber && o.serialNumber.toLowerCase().includes(term))
    );
  }, [orders, searchTerm]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    if (dashboardSearchResults.length === 1) {
      onNavigateToOrders('orders', 'all', dashboardSearchResults[0].id);
    } else if (dashboardSearchResults.length > 0) {
      onNavigateToOrders('orders', 'all', searchTerm.trim());
    } else {
      onNavigateToOrders('orders', 'all', searchTerm.trim());
    }
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* 🔍 Top Search Bar in Dashboard (لوحة التحكم) */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-teal-50 rounded-2xl text-teal-600 border border-teal-100/60">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans font-extrabold text-gray-900 text-base">البحث والاستعلام السريع عن الأجهزة والعملاء</h3>
            </div>
          </div>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-xs text-gray-400 hover:text-gray-600 font-sans font-bold flex items-center gap-1 cursor-pointer bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-xl transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>مسح البحث</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="أدخل رقم طلب الصيانة (مثال: TECHNO-1001)، أو اسم العميل، أو الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 text-gray-800 font-sans text-right border border-gray-200 rounded-2xl px-5 py-4 pr-12 pl-14 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all placeholder:text-gray-400"
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <button
              type="button"
              onClick={handleVoiceSearch}
              className={`absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all cursor-pointer ${
                isListening 
                  ? 'bg-rose-100 text-rose-600 animate-pulse ring-2 ring-rose-400' 
                  : 'text-gray-400 hover:text-teal-600 hover:bg-teal-50'
              }`}
              title={isListening ? 'إيقاف الاستماع' : 'البحث بالصوت'}
            >
              {isListening ? <MicOff className="w-5 h-5 text-rose-600" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 md:flex-none bg-teal-600 hover:bg-teal-700 text-white font-sans font-bold px-8 py-4 rounded-2xl transition-all text-base flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
            >
              <Search className="w-5 h-5" />
              <span>بحث</span>
            </button>
            {onScanClick && (
              <button
                type="button"
                onClick={onScanClick}
                className="shrink-0 bg-gray-900 hover:bg-black text-white p-4 rounded-2xl transition-all flex items-center justify-center cursor-pointer shadow-xs active:scale-98"
                title="مسح الباركود بالكاميرا"
              >
                <Camera className="w-6 h-6" />
              </button>
            )}
          </div>
        </form>

        {isListening && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-700 font-sans font-bold flex items-center justify-center gap-2 animate-pulse">
            <Mic className="w-4 h-4 text-rose-600" />
            <span>● جاري الاستماع لصوتك الآن... تحدّث برقم الطلب أو اسم العميل</span>
          </div>
        )}

        {/* Live Search Results Card */}
        {searchTerm.trim() && (
          <div className="mt-5 pt-4 border-t border-gray-100 space-y-3">
            <div className="flex justify-between items-center text-xs font-sans">
              <span className="text-gray-600 font-extrabold flex items-center gap-1.5">
                <span>نتائج البحث المطابقة:</span>
                <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-mono font-bold">
                  {dashboardSearchResults.length}
                </span>
              </span>
              {dashboardSearchResults.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateToOrders('orders', 'all', searchTerm.trim())}
                  className="text-teal-700 hover:text-teal-900 font-bold underline cursor-pointer text-xs flex items-center gap-1"
                >
                  <span>عرض جميع النتائج في جدول طلبات الصيانة</span>
                  <span>←</span>
                </button>
              )}
            </div>

            {dashboardSearchResults.length === 0 ? (
              <div className="p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center text-gray-500 text-xs font-sans">
                🔍 لم يتم العثور على أي جهاز أو عميل يطابق &ldquo;<strong className="text-gray-800">{searchTerm}</strong>&rdquo;. يرجى التحقق من صحة رقم الباركود أو تجربة البحث بالصوت.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
                {dashboardSearchResults.slice(0, 9).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onNavigateToOrders('orders', 'all', item.id)}
                    className="p-3.5 bg-gray-50 hover:bg-teal-50/60 border border-gray-200/70 hover:border-teal-200 rounded-2xl transition-all cursor-pointer flex flex-col justify-between gap-2.5 text-right group shadow-xs hover:shadow-sm"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-mono text-xs font-black text-teal-800 bg-white px-2 py-0.5 rounded-lg border border-gray-200 shadow-2xs">
                        {item.id}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-teal-100 text-teal-900">
                        {item.status}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewCustomer?.(item.customerName, item.customerPhone);
                          }}
                          className="font-sans font-extrabold text-xs text-gray-900 hover:text-teal-700 hover:underline cursor-pointer transition-colors text-right"
                          title="عرض ملف وسجل العميل وتقارير الصيانة والرسائل"
                        >
                          {item.customerName}
                        </button>
                        <span className="text-[10px] text-teal-600 font-bold bg-teal-50 px-1.5 py-0.2 rounded" title="سجل العميل">
                          ملف العميل
                        </span>
                      </div>
                      <div className="font-sans text-[11px] text-gray-500 mt-0.5 truncate">
                        {item.deviceType} • {item.brandModel}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono border-t border-gray-200/50 pt-2 mt-0.5">
                      <span dir="ltr">{item.customerPhone}</span>
                      <span className="text-teal-700 font-sans font-extrabold flex items-center gap-0.5 group-hover:underline">
                        تفاصيل الجهاز ←
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>



      {/* Numerical Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Metric 1 */}
        <div 
          onClick={() => onNavigateToOrders('orders', 'all')}
          className="bg-white rounded-3xl border border-gray-100 p-5 md:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-teal-50/50 transition-colors"
        >
          <div className="space-y-1">
            <span className="text-gray-400 font-sans font-medium text-xs md:text-sm">أجهزة قيد الصيانة</span>
            <div className="font-mono text-2xl md:text-3xl font-extrabold text-gray-800">{underMaintenance}</div>
          </div>
          <div className="p-3 bg-teal-50 rounded-2xl text-teal-600 shrink-0">
            <Wrench className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div 
          onClick={() => onNavigateToOrders('orders', DeviceStatus.READY)}
          className="bg-white rounded-3xl border border-gray-100 p-5 md:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-emerald-50/50 transition-colors"
        >
          <div className="space-y-1">
            <span className="text-gray-400 font-sans font-medium text-xs md:text-sm">جاهز للتسليم 🥳</span>
            <div className="font-mono text-2xl md:text-3xl font-extrabold text-emerald-600">{readyForDelivery}</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div 
          onClick={() => onNavigateToOrders('completed', DeviceStatus.DELIVERED)}
          className="bg-white rounded-3xl border border-gray-100 p-5 md:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        >
          <div className="space-y-1">
            <span className="text-gray-400 font-sans font-medium text-xs md:text-sm">تم تسليمها للعميل</span>
            <div className="font-mono text-2xl md:text-3xl font-extrabold text-gray-800">{delivered}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-2xl text-gray-500 shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div 
          onClick={() => onNavigateToOrders('completed', DeviceStatus.UNREPAIRABLE)}
          className="bg-white rounded-3xl border border-gray-100 p-5 md:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-rose-50/50 transition-colors"
        >
          <div className="space-y-1">
            <span className="text-gray-400 font-sans font-medium text-xs md:text-sm">غير قابلة للإصلاح</span>
            <div className="font-mono text-2xl md:text-3xl font-extrabold text-rose-500">{unrepairable}</div>
          </div>
          <div className="p-3 bg-rose-50 rounded-2xl text-rose-500 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

      </div>

      


      {/* Overdue Maintenance Orders Alert */}
      {overdueOrders.length > 0 && (
        <div className="bg-rose-50/70 border border-rose-200/60 rounded-3xl p-5 md:p-6  space-y-4 animate-in slide-in-from-top-3 duration-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-rose-100/50 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-2xl shrink-0">
                <AlertCircle className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="font-sans font-extrabold text-rose-900 text-sm md:text-base">
                  تنبيه عاجل: أجهزة تجاوزت 3 أيام في الصيانة دون تسليم ({overdueOrders.length})
                </h3>
                <p className="text-rose-600/95 text-xs font-sans mt-0.5">
                  يرجى اتخاذ إجراء فوري (التواصل مع العميل، تسريع الصيانة، أو إرسال إشعار تذكير جاهزية) لتقليل زمن الانتظار وتجنب تكدس الأجهزة.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[320px] overflow-y-auto pr-1">
            {overdueOrders.map((order) => {
              const daysInMaintenance = Math.floor((Date.now() - order.createdAt) / (1000 * 60 * 60 * 24));
              return (
                <div 
                  key={order.id}
                  className="bg-white border border-rose-100/50 rounded-2xl p-4  hover:border-rose-300 transition-all flex flex-col justify-between gap-3 text-right"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] font-extrabold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">
                        {order.id}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg border text-[9px] font-sans font-bold bg-rose-50 border-rose-100 text-rose-700">
                        {daysInMaintenance === 3 ? 'منذ ٣ أيام' : `منذ ${daysInMaintenance} أيام`}
                      </span>
                    </div>

                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => onViewCustomer?.(order.customerName, order.customerPhone)}
                        className="font-sans font-bold text-gray-900 hover:text-rose-700 hover:underline text-xs truncate cursor-pointer text-right block w-full transition-colors"
                        title="عرض ملف وسجل العميل وتقارير الصيانة والرسائل"
                      >
                        {order.customerName}
                      </button>
                      <p className="text-[10px] text-gray-400 font-sans mt-0.5">
                        الجهاز: <strong className="text-gray-700">{order.deviceType} {order.brandModel}</strong>
                      </p>
                    </div>

                    <div className="flex justify-between items-center text-[10px] bg-gray-50 p-2 rounded-xl border border-gray-100">
                      <span className="text-gray-400 font-sans">الفني: <strong className="text-gray-600">{order.technician || 'غير محدد'}</strong></span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-sans font-bold ${getStatusBadgeClass(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-gray-50 pt-2 flex gap-1.5">
                    <button
                      onClick={() => onSendWhatsAppReminder(order)}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-[10px] rounded-xl transition-all  flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      إرسال تذكير سريع
                    </button>
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="px-2.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-150 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                      title="اتصال هاتفي مباشر"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reminders Section */}
      <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-sans font-extrabold text-gray-800 text-lg border-r-4 border-teal-500 pr-2.5">
              تذكير مواعيد تسليم الأجهزة القريبة ({reminders.length})
            </h3>
            <span className="text-xs font-sans text-gray-400">تنبيهات مجدولة للعملاء</span>
          </div>

          {reminders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
              <span className="text-4xl block mb-3">📅☕</span>
              <p className="font-sans text-sm font-bold text-gray-700">لا توجد أجهزة مستحقة للتسليم اليوم أو غداً!</p>
              <p className="font-sans text-xs text-gray-400 mt-1">جميع أجهزتك تسير حسب الخطة أو مواعيد تسليمها أبعد.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
              {reminders.map((order) => (
                <div 
                  key={order.id} 
                  className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5  hover:border-teal-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-bottom-3 duration-200"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-extrabold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-100">
                        {order.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => onViewCustomer?.(order.customerName, order.customerPhone)}
                        className="font-sans text-gray-800 hover:text-teal-700 hover:underline font-extrabold text-sm cursor-pointer transition-colors"
                        title="عرض ملف وسجل العميل وتقارير الصيانة والرسائل"
                      >
                        {order.customerName}
                      </button>
                      {getDateBadge(order.expectedDeliveryDate)}
                    </div>
                    
                    <div className="text-xs text-gray-500 font-sans flex items-center gap-1">
                      <span className="font-semibold text-gray-700 bg-gray-50 px-2 py-0.5 rounded-md">
                        {order.deviceType} {order.brandModel}
                      </span>
                      <span>•</span>
                      <span>تاريخ التسليم المتوقع: <strong>{new Date(order.expectedDeliveryDate).toLocaleDateString('ar-SA')}</strong></span>
                    </div>

                    <div className="text-xs text-gray-400 font-sans flex items-center gap-1.5 pt-1">
                      <span>الفني: <strong className="text-gray-600">{order.technician}</strong></span>
                      <span>•</span>
                      <span>الحالة الحالية: 
                        <span className="text-teal-600 font-bold mr-1">
                          {order.status === DeviceStatus.READY ? 'جاهز للتسليم' : 'تحت العمل'}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto shrink-0 flex gap-2">
                    <button
                      onClick={() => onSendWhatsAppReminder(order)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5  -600/15"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      إرسال تذكير بالواتس اب
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

            </div>
  );
};

export default DashboardView;