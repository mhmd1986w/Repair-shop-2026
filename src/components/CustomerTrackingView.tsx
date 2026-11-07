import React, { useState, useEffect, useRef } from 'react';
import { MaintenanceOrder, DeviceStatus, isContactOrder } from '../types';
import { dbService } from '../lib/firebase';
import { Search, MapPin, Calendar, CreditCard, Clock, Wrench, ShieldCheck, HelpCircle, Smartphone, Camera, CheckCircle2, History, Layers, Star, MessageSquareQuote, Mic, MicOff } from 'lucide-react';
import { QRCodeGenerator } from './QRCodeGenerator';

interface CustomerTrackingViewProps {
  initialOrderId?: string;
  onScanClick: () => void;
  scannedOrderId?: string | null;
  onClearScan?: () => void;
}

export const CustomerTrackingView: React.FC<CustomerTrackingViewProps> = ({ 
  initialOrderId = '', 
  onScanClick, 
  scannedOrderId,
  onClearScan
}) => {
  const [orderId, setOrderId] = useState(initialOrderId);
  const [order, setOrder] = useState<MaintenanceOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerHistory, setCustomerHistory] = useState<MaintenanceOrder[]>([]);
  const [deviceOrders, setDeviceOrders] = useState<MaintenanceOrder[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Review states
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Voice recognition states
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const currencyName = localStorage.getItem('currencyName') || 'دينار';

  // Auto search if initialOrderId or scannedOrderId is provided
  const triggerSearch = async (idToSearch: string) => {
    if (!idToSearch.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    setCustomerHistory([]); // Clear past history
    setDeviceOrders([]);
    try {
      const allOrders = await dbService.getOrders();
      const term = idToSearch.trim().toUpperCase();
      
      // Find orders matching the ID, phone, serial number, or customer name
      const cleanTerm = term.replace(/[\s-+]/g, '');
      const matched = allOrders.filter(
        (o: MaintenanceOrder) => 
          ((o.id.toUpperCase() === term || 
          (o.customerPhone && o.customerPhone.replace(/[\s-+]/g, '') === cleanTerm) ||
          (o.serialNumber && o.serialNumber.toUpperCase() === term) ||
          (o.customerName && o.customerName.toUpperCase().includes(term)))) &&
          !isContactOrder(o)
      );

      if (matched.length > 0) {
        // Sort matching orders so the latest one is active
        matched.sort((a, b) => b.createdAt - a.createdAt);
        const latestMatching = matched[0];
        setOrder(latestMatching);

        // Find all orders that share the same device serial number grouping
        const mainSerial = latestMatching.serialNumber?.trim();
        const devOrders = mainSerial
          ? allOrders.filter(
              (o: MaintenanceOrder) => 
                o.serialNumber?.trim().toUpperCase() === mainSerial.toUpperCase() &&
                !isContactOrder(o)
            ).sort((a, b) => b.createdAt - a.createdAt)
          : [latestMatching];

        setDeviceOrders(devOrders);

        // Fetch customer history (excluding current device orders to prevent duplication)
        const devOrderIds = new Set(devOrders.map(o => o.id));
        const history = allOrders.filter(
          (o: MaintenanceOrder) => 
            o.customerPhone === latestMatching.customerPhone && 
            !devOrderIds.has(o.id) &&
            !isContactOrder(o)
        );
        setCustomerHistory(history);
      } else {
        setOrder(null);
        setDeviceOrders([]);
        setError('عذراً، لم نتمكن من العثور على طلب صيانة أو جهاز بهذا الرقم. يرجى التأكد من كتابة الرقم بشكل صحيح.');
      }
    } catch (err) {
      console.error("Error searching orders:", err);
      setError('حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderId) {
      setOrderId(initialOrderId);
      triggerSearch(initialOrderId);
    }
  }, [initialOrderId]);

  useEffect(() => {
    if (scannedOrderId) {
      setOrderId(scannedOrderId);
      triggerSearch(scannedOrderId);
      if (onClearScan) onClearScan();
    }
  }, [scannedOrderId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerSearch(orderId);
  };

  const handleSubmitReview = async () => {
    if (!order || reviewRating === 0) return;
    
    setReviewSubmitting(true);
    try {
      const updatedOrder = {
        ...order,
        customerFeedback: {
          rating: reviewRating,
          comment: reviewComment.trim(),
          timestamp: Date.now()
        }
      };
      
      await dbService.saveOrder(updatedOrder);
      setOrder(updatedOrder);
      setReviewSuccess(true);
    } catch (err) {
      console.error('Failed to submit review:', err);
      alert('حدث خطأ أثناء إرسال التقييم. يرجى المحاولة لاحقاً.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleVoiceInput = () => {
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
          setOrderId(cleanedText);
          triggerSearch(cleanedText);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          alert("يرجى تفعيل صلاحية استخدام الميكروفون في المتصفح لتتمكن من تسجيل الصوت.");
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

  const getStatusInfo = (status: DeviceStatus) => {
    switch (status) {
      case DeviceStatus.RECEIVED:
        return { label: 'تم الاستلام', color: 'bg-blue-100 text-blue-800 border-blue-200', desc: 'تم استلام الجهاز وتسجيله في النظام بنجاح.' };
      case DeviceStatus.DIAGNOSING:
        return { label: 'تحت الفحص والتشخيص', color: 'bg-purple-100 text-purple-800 border-purple-200', desc: 'يقوم الفني حالياً بفحص الجهاز لتحديد العطل والمكونات المطلوبة.' };
      case DeviceStatus.REPAIRING:
        return { label: 'تحت الإصلاح والعمل', color: 'bg-amber-100 text-amber-800 border-amber-200', desc: 'جاري العمل على صيانة واستبدال الأجزاء التالفة في الجهاز.' };
      case DeviceStatus.READY:
        return { label: 'جاهز للاستلام 🎉', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', desc: 'تم الانتهاء من الصيانة وتجربة الجهاز بنجاح وهو بانتظار استلامك.' };
      case DeviceStatus.DELIVERED:
        return { label: 'تم التسليم بنجاح ✅', color: 'bg-gray-100 text-gray-800 border-gray-200', desc: 'تم تسليم الجهاز إليكم وإغلاق طلب الصيانة.' };
      case DeviceStatus.UNREPAIRABLE:
        return { label: 'غير قابل للإصلاح 😔', color: 'bg-rose-100 text-rose-800 border-rose-200', desc: 'نأسف، فبعد الفحص الدقيق تبين عدم جدوى الإصلاح أو عدم توفر القطع اللازمة.' };
      default:
        return { label: 'غير معروف', color: 'bg-gray-100 text-gray-800 border-gray-200', desc: '-' };
    }
  };

  const timelineSteps = [
    { status: DeviceStatus.RECEIVED, label: 'تم الاستلام', icon: Smartphone },
    { status: DeviceStatus.DIAGNOSING, label: 'تحت الفحص', icon: HelpCircle },
    { status: DeviceStatus.REPAIRING, label: 'تحت الإصلاح', icon: Wrench },
    { status: DeviceStatus.READY, label: 'جاهز للتسليم', icon: ShieldCheck },
    { status: DeviceStatus.DELIVERED, label: 'تم التسليم', icon: CheckCircle2 }
  ];

  const getStepState = (stepStatus: DeviceStatus, currentStatus: DeviceStatus) => {
    const statusOrder = [
      DeviceStatus.RECEIVED,
      DeviceStatus.DIAGNOSING,
      DeviceStatus.REPAIRING,
      DeviceStatus.READY,
      DeviceStatus.DELIVERED
    ];
    
    // If the order was unrepairable, replace ready/delivered logically
    if (currentStatus === DeviceStatus.UNREPAIRABLE) {
      if (stepStatus === DeviceStatus.READY || stepStatus === DeviceStatus.DELIVERED) {
        return 'unrepairable';
      }
    }

    const currentIndex = statusOrder.indexOf(currentStatus);
    const stepIndex = statusOrder.indexOf(stepStatus);

    if (stepIndex < 0) return 'inactive';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'inactive';
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8" dir="rtl">
      
      {/* Banner/Header */}
      <div className="text-center mb-10">
        <div className="inline-flex p-3 bg-teal-50 rounded-2xl mb-4 text-teal-600 border border-teal-100">
          <Smartphone className="w-10 h-10 animate-pulse" />
        </div>
        <h1 className="font-sans font-extrabold text-3xl text-gray-900 tracking-tight">بوابة تتبع صيانة الأجهزة</h1>
        <p className="text-gray-500 mt-2 font-sans text-base max-w-lg mx-auto">
          أدخل رقم طلب الصيانة المدون على الملصق أو امسح الرمز الشريطي (الباركود) لمعرفة حالة جهازك الآن.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 md:p-8 mb-8 shadow-xs">
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="أدخل رقم طلب الصيانة (مثال: TECHNO-1001)"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full bg-gray-50 text-gray-800 font-mono text-center md:text-right border border-gray-200 rounded-2xl px-5 py-4 pr-12 pl-14 text-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all uppercase placeholder:font-sans placeholder:text-gray-400 placeholder:text-base"
              required
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all cursor-pointer ${
                isListening 
                  ? 'bg-rose-100 text-rose-600 animate-pulse ring-2 ring-rose-400' 
                  : 'text-gray-400 hover:text-teal-600 hover:bg-teal-50'
              }`}
              title={isListening ? 'إيقاف الاستماع' : 'البحث والتحدث بالصوت'}
            >
              {isListening ? <MicOff className="w-5 h-5 text-rose-600" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-sans font-bold px-8 py-4 rounded-2xl transition-colors text-base disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Search className="w-5 h-5" />
              <span>{loading ? 'جاري البحث...' : 'بحث'}</span>
            </button>
            <button
              type="button"
              onClick={onScanClick}
              className="shrink-0 bg-gray-900 hover:bg-black text-white p-4 rounded-2xl transition-colors flex items-center justify-center cursor-pointer shadow-xs"
              title="مسح الباركود بالكاميرا"
            >
              <Camera className="w-6 h-6" />
            </button>
          </div>
        </form>

        {isListening && (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-sans font-bold flex items-center justify-center gap-2 animate-pulse">
            <Mic className="w-4 h-4 text-rose-600" />
            <span>● جاري الاستماع إلى صوتك الآن... تفضل بقول رقم الطلب أو الكود</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-sm font-sans flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Tracking Results Area */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 mt-4 font-sans font-medium">جاري جلب تفاصيل طلب الصيانة...</p>
        </div>
      )}

      {!loading && searched && order && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Main Stats Card */}
          <div className="bg-white rounded-3xl border border-gray-100  overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-6 md:p-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-teal-100 text-xs font-mono tracking-widest uppercase">رقم طلب الصيانة</span>
                <h2 className="text-2xl md:text-3xl font-mono font-extrabold mt-1">{order.id}</h2>
                <p className="text-emerald-100 text-sm mt-1 font-sans">
                  تاريخ التسجيل: {new Date(order.createdAt).toLocaleDateString('ar-SA')}
                </p>
              </div>
              
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                <span className="font-sans text-sm font-medium">الحالة الحالية:</span>
                <span className={`px-3 py-1 rounded-xl text-xs font-sans font-bold border ${getStatusInfo(order.status).color}`}>
                  {getStatusInfo(order.status).label}
                </span>
              </div>
            </div>

            <div className="p-6 md:p-8">
              {/* Detailed description of the current phase */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex items-start gap-3 mb-8">
                <div className="text-2xl mt-0.5">ℹ️</div>
                <div>
                  <h4 className="font-sans font-bold text-gray-800 text-base">ماذا تعني هذه الحالة لجهازك؟</h4>
                  <p className="text-gray-600 text-sm mt-1 leading-relaxed font-sans">
                    {getStatusInfo(order.status).desc}
                  </p>
                </div>
              </div>

              {/* Animated Progress Bar */}
              <h3 className="font-sans font-bold text-gray-800 text-lg mb-6">مخطط سير العمل والإصلاح</h3>
              <div className="relative mb-12 px-4 md:px-8">
                <div className="relative w-full max-w-3xl mx-auto">
                  {/* Connecting Line Background */}
                  <div className="absolute top-6 left-[10%] right-[10%] h-1.5 bg-gray-100 rounded-full z-0" />
                  
                  {/* Active Progress Line */}
                  <div 
                    className="absolute top-6 right-[10%] h-1.5 bg-gradient-to-l from-teal-500 to-emerald-500 rounded-full z-0 transition-all duration-1000 ease-out" 
                    style={{ 
                      width: `${
                        order.status === 'unrepairable' ? 80 : 
                        order.status === 'received' ? 0 : 
                        order.status === 'diagnosing' ? 20 : 
                        order.status === 'repairing' ? 40 : 
                        order.status === 'ready' ? 60 : 
                        order.status === 'delivered' ? 80 : 0
                      }%`,
                      left: 'auto',
                      background: order.status === 'unrepairable' ? '#f43f5e' : undefined
                    }} 
                  />
                  
                  {/* Steps */}
                  <div className="flex justify-between relative z-10 w-full">
                    {timelineSteps.map((step, index) => {
                      const StepIcon = step.icon;
                      const state = getStepState(step.status, order.status);
                      
                      let bgClass = 'bg-white text-gray-300 border-2 border-gray-200';
                      let textClass = 'text-gray-400';
                      let statusLabel = 'بانتظار البدء';
                      let Class = '';

                      if (state === 'completed') {
                        bgClass = 'bg-teal-500 text-white border-2 border-teal-500';
                        textClass = 'text-teal-700 font-bold';
                        statusLabel = 'اكتملت';
                        Class = ' -500/20';
                      } else if (state === 'active') {
                        bgClass = 'bg-emerald-600 text-white border-4 border-emerald-100 animate-pulse';
                        textClass = 'text-emerald-800 font-bold';
                        statusLabel = 'جاري العمل الآن';
                        Class = ' -600/30 scale-110';
                      } else if (state === 'unrepairable') {
                        bgClass = 'bg-rose-50 text-rose-300 border-2 border-rose-200';
                        textClass = 'text-rose-400 line-through';
                        statusLabel = 'ملغى';
                      }

                      return (
                        <div key={index} className="flex flex-col items-center text-center w-1/5 relative">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 z-10 ${bgClass} ${Class}`}>
                            <StepIcon className="w-5 h-5" />
                          </div>
                          <span className={`text-xs mt-3 font-sans font-semibold ${textClass}`}>
                            {step.label}
                          </span>
                          <span className="text-[9px] text-gray-400 mt-1 font-sans hidden sm:block">
                            {statusLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Order Info Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-100 pt-8">
                
                {/* Device Details */}
                <div className="space-y-4">
                  <h4 className="font-sans font-bold text-gray-800 border-r-4 border-teal-500 pr-2.5">تفاصيل العميل والجهاز</h4>
                  <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 space-y-3">
                    <div className="flex justify-between items-center text-sm font-sans">
                      <span className="text-gray-400">اسم صاحب الجهاز:</span>
                      <span className="text-gray-800 font-bold">{order.customerName}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-sans">
                      <span className="text-gray-400">نوع وموديل الجهاز:</span>
                      <span className="text-gray-800 font-semibold">{order.deviceType} {order.brandModel}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-sans">
                      <span className="text-gray-400">الرقم التسلسلي (S/N):</span>
                      <span className="text-gray-700 font-mono text-xs">{order.serialNumber || 'غير مسجل'}</span>
                    </div>
                    <div className="flex justify-between items-start text-sm font-sans border-t border-gray-100/50 pt-2.5">
                      <span className="text-gray-400 shrink-0">وصف المشكلة:</span>
                      <span className="text-gray-800 text-left md:text-right font-medium">{order.faultDescription}</span>
                    </div>
                  </div>
                </div>

                {/* Costs and Dates */}
                <div className="space-y-4">
                  <h4 className="font-sans font-bold text-gray-800 border-r-4 border-teal-500 pr-2.5">المالية والمواعيد</h4>
                  <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 space-y-3">
                    <div className="flex justify-between items-center text-sm font-sans">
                      <span className="text-gray-400 flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        موعد التسليم المتوقع:
                      </span>
                      <span className="text-gray-800 font-semibold">
                        {new Date(order.expectedDeliveryDate).toLocaleDateString('ar-SA')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-sans">
                      <span className="text-gray-400 flex items-center gap-1">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        التكلفة التقديرية:
                      </span>
                      <span className="text-gray-800 font-bold">{order.estimatedCost} {order.currency || currencyName}</span>
                    </div>
                    {order.actualCost !== undefined && (
                      <div className="flex justify-between items-center text-sm font-sans border-t border-gray-100/50 pt-2 bg-emerald-50/30 px-2 py-1 rounded-lg">
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          💰 التكلفة النهائية:
                        </span>
                        <span className="text-emerald-800 font-extrabold text-base">{order.actualCost} {order.currency || currencyName}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm font-sans">
                      <span className="text-gray-400 flex items-center gap-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        آخر تحديث للحالة:
                      </span>
                      <span className="text-gray-500 text-xs">
                        {new Date(order.updatedAt).toLocaleString('ar-SA')}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Delivery Receipt Info if Delivered */}
              {order.status === DeviceStatus.DELIVERED && order.deliveryInfo && (
                <div className="mt-8 bg-emerald-50/30 border border-emerald-100/80 rounded-2xl p-5 md:p-6 animate-in slide-in-from-bottom-5">
                  <h4 className="font-sans font-extrabold text-emerald-900 text-base mb-3 flex items-center gap-2">
                    <span>📦 بيانات تسليم الجهاز المسترجع</span>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded-full font-sans font-bold">مستلم ومغلق</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-sans text-emerald-900">
                    <div className="flex justify-between">
                      <span className="text-emerald-700">اسم المستلم الفعلي:</span>
                      <span className="font-bold">{order.deliveryInfo.recipientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700">صلة القرابة بصاحب الجهاز:</span>
                      <span className="font-bold">{order.deliveryInfo.relationToCustomer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700">تاريخ التسليم الفعلي:</span>
                      <span className="font-semibold">{new Date(order.deliveryInfo.deliveryDate).toLocaleString('ar-SA')}</span>
                    </div>
                    {order.deliveryInfo.notes && (
                      <div className="col-span-1 md:col-span-2 mt-2 bg-white/60 p-3 rounded-xl border border-emerald-100/50 text-xs">
                        <span className="font-bold text-emerald-800 block mb-1">ملاحظات عند التسليم:</span>
                        <span className="text-emerald-950 font-medium">{order.deliveryInfo.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Customer Review Section */}
              {order.status === DeviceStatus.DELIVERED && (
                <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-5 md:p-6  animate-in slide-in-from-bottom-5">
                  <h4 className="font-sans font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    <span>تقييم مستوى الخدمة</span>
                  </h4>
                  
                  {order.customerFeedback ? (
                    <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex gap-1" dir="ltr">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star} 
                              className={`w-5 h-5 ${star <= order.customerFeedback!.rating ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`} 
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono bg-white px-2 py-1 rounded border border-gray-100">
                          {new Date(order.customerFeedback.timestamp).toLocaleDateString('ar-SA')}
                        </span>
                      </div>
                      {order.customerFeedback.comment && (
                        <div className="bg-white p-3 rounded-lg border border-amber-100/50 text-xs text-gray-600 relative">
                          <MessageSquareQuote className="w-4 h-4 text-amber-200 absolute top-2 left-2 opacity-50" />
                          <p className="pr-6 leading-relaxed text-right font-medium">{order.customerFeedback.comment}</p>
                        </div>
                      )}
                      <p className="text-center text-xs font-bold text-amber-700 mt-3">شكراً لتقييمك! نتمنى لك تجربة سعيدة مع جهازك. 😊</p>
                    </div>
                  ) : reviewSuccess ? (
                    <div className="text-center p-6 bg-emerald-50 rounded-xl border border-emerald-100">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                      <p className="text-emerald-800 font-bold text-sm">تم إرسال تقييمك بنجاح!</p>
                      <p className="text-emerald-600 text-xs mt-1">شكراً لمشاركتك رأيك معنا لتطوير خدماتنا.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-gray-500 font-medium">كيف كانت تجربتك معنا؟ تقييمك يساعدنا على تحسين جودة خدماتنا.</p>
                      <div className="flex justify-center gap-2 my-2 flex-row-reverse">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setReviewRating(star)}
                            className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                          >
                            <Star 
                              className={`w-10 h-10 ${star <= reviewRating ? 'fill-amber-400 text-amber-400 drop-' : 'fill-gray-100 text-gray-200 hover:text-amber-200 hover:fill-amber-100'} transition-colors`} 
                            />
                          </button>
                        ))}
                      </div>
                      
                      {reviewRating > 0 && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-10 duration-300">
                          <textarea
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            placeholder="أضف تعليقاً إضافياً (اختياري)..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-sans focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none h-24 text-right"
                            dir="rtl"
                          ></textarea>
                          <button
                            onClick={handleSubmitReview}
                            disabled={reviewSubmitting}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl transition-colors text-xs flex justify-center items-center gap-2  -500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {reviewSubmitting ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                              <MessageSquareQuote className="w-4 h-4" />
                            )}
                            إرسال التقييم
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tracking Receipt QR Label section */}
              <div className="mt-8 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6 bg-gray-50/40 p-5 rounded-2xl">
                <div>
                  <h4 className="font-sans font-bold text-gray-800 text-sm">التتبع السريع عبر الهاتف الذكي</h4>
                  <p className="text-gray-500 text-xs mt-1 font-sans leading-relaxed max-w-sm">
                    امسح رمز الـ QR بالهاتف لفتح هذه الصفحة في أي وقت وتتبع جهازك مباشرة دون الحاجة للاتصال بنا أو تذكر الرمز.
                  </p>
                </div>
                <div className="shrink-0 flex gap-4 items-center">
                  <div className="text-center">
                    <QRCodeGenerator value={`${window.location.origin}?track=${order.id}`} size={90} />
                    <span className="text-[10px] font-mono text-gray-400 mt-1 block">رابط التتبع المباشر</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Device Repair History Card (Same Serial Number) */}
          {deviceOrders.length > 1 && (
            <div className="bg-white rounded-3xl border border-gray-100  p-6 md:p-8 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-2 mb-4 border-r-4 border-emerald-500 pr-2.5">
                <Layers className="w-5 h-5 text-emerald-600" />
                <h3 className="font-sans font-bold text-gray-800 text-lg">
                  سجل عمليات صيانة هذا الجهاز (نفس الرقم التسلسلي)
                </h3>
              </div>
              <p className="text-gray-500 text-xs font-sans mb-4 leading-relaxed">
                تمت صيانة هذا الجهاز لدينا أكثر من مرة وتحت نفس الرقم التسلسلي. اضغط على أي طلب صيانة أدناه لمراجعة حالته أو سجل تفاصيله في تلك الزيارة.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deviceOrders.map((devOrder) => {
                  const isActive = devOrder.id === order.id;
                  return (
                    <div 
                      key={devOrder.id}
                      onClick={() => {
                        if (!isActive) {
                          setOrderId(devOrder.id);
                          triggerSearch(devOrder.id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className={`group cursor-pointer rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between text-right border ${
                        isActive 
                          ? 'bg-emerald-50/50 border-emerald-500  -500/5' 
                          : 'bg-gray-50/60 hover:bg-emerald-50/20 border-gray-100 hover:border-emerald-200'
                      }`}
                      title={isActive ? "طلب الصيانة المعروض حالياً" : "اضغط لتتبع هذا الطلب من الزيارة السابقة"}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg transition-colors border ${
                              isActive 
                                ? 'bg-emerald-600 text-white border-emerald-600' 
                                : 'bg-white text-emerald-600 border-emerald-100 group-hover:bg-emerald-100/50'
                            }`}>
                              {devOrder.id}
                            </span>
                            {isActive && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-lg">
                                المعروض حالياً
                              </span>
                            )}
                          </div>
                          <h5 className="font-sans font-bold text-gray-800 text-xs mt-1.5">
                            جهاز {devOrder.deviceType} • {devOrder.brandModel}
                          </h5>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-sans font-bold border shrink-0 ${getStatusInfo(devOrder.status).color}`}>
                          {getStatusInfo(devOrder.status).label}
                        </span>
                      </div>

                      <p className="text-gray-500 text-[11px] font-sans line-clamp-2 mb-2.5">
                        العطل في هذه المرة: {devOrder.faultDescription}
                      </p>

                      <div className="flex justify-between items-center text-[10px] text-gray-400 font-sans border-t border-gray-100/60 pt-2 mt-auto">
                        <span>تاريخ التسجيل: {new Date(devOrder.createdAt).toLocaleDateString('ar-SA')}</span>
                        <span className="font-bold text-gray-700">التكلفة: {devOrder.actualCost !== undefined ? devOrder.actualCost : devOrder.estimatedCost} {devOrder.currency || currencyName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customer Repair History Card */}
          {customerHistory.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100  p-6 md:p-8 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-2 mb-4 border-r-4 border-teal-500 pr-2.5">
                <History className="w-5 h-5 text-teal-600" />
                <h3 className="font-sans font-bold text-gray-800 text-lg">
                  الأجهزة الأخرى المسجلة لهذا العميل ({order.customerName})
                </h3>
              </div>
              <p className="text-gray-500 text-xs font-sans mb-4 leading-relaxed">
                هذه قائمة بكافة طلبات الصيانة الأخرى المرتبطة برقم هاتف هذا العميل. يمكنك الضغط على أي جهاز لمراجعة تفاصيله وحالة إصلاحه مباشرة.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customerHistory.map((histOrder) => (
                  <div 
                    key={histOrder.id}
                    onClick={() => {
                      setOrderId(histOrder.id);
                      triggerSearch(histOrder.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="group cursor-pointer bg-gray-50/60 hover:bg-teal-50/40 border border-gray-100 hover:border-teal-100 rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between text-right"
                    title="اضغط لتتبع هذا الجهاز ومراجعة تفاصيله"
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-teal-600 bg-white border border-teal-100 px-2 py-0.5 rounded-lg group-hover:bg-teal-100/50 transition-colors">
                          {histOrder.id}
                        </span>
                        <h5 className="font-sans font-bold text-gray-800 text-xs mt-1.5">
                          جهاز {histOrder.deviceType} • {histOrder.brandModel}
                        </h5>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-sans font-bold border shrink-0 ${getStatusInfo(histOrder.status).color}`}>
                        {getStatusInfo(histOrder.status).label}
                      </span>
                    </div>

                    <p className="text-gray-500 text-[11px] font-sans line-clamp-2 mb-2.5">
                      العطل: {histOrder.faultDescription}
                    </p>

                    <div className="flex justify-between items-center text-[10px] text-gray-400 font-sans border-t border-gray-100/60 pt-2 mt-auto">
                      <span>تاريخ التسجيل: {new Date(histOrder.createdAt).toLocaleDateString('ar-SA')}</span>
                      <span className="font-bold text-gray-700">التكلفة: {histOrder.actualCost !== undefined ? histOrder.actualCost : histOrder.estimatedCost} {histOrder.currency || currencyName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Status History (Logs) */}
          <div className="bg-white rounded-3xl border border-gray-100  p-6 md:p-8">
            <h3 className="font-sans font-bold text-gray-800 text-lg mb-6 border-r-4 border-teal-500 pr-2.5">سجل التحديثات التفصيلي للمراحل</h3>
            
            <div className="space-y-6 relative before:absolute before:right-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
              {(order.statusHistory || []).map((history, idx) => {
                const statusMeta = getStatusInfo(history.status);
                return (
                  <div key={idx} className="relative pr-9 animate-in slide-in-from-right-3 duration-200" style={{ animationDelay: `${idx * 50}ms` }}>
                    {/* Circle marker on line */}
                    <div className="absolute right-1.5 top-1.5 w-4 h-4 rounded-full border-4 border-white bg-teal-500 ring-2 ring-teal-200" />
                    
                    <div className="bg-gray-50/60 rounded-2xl p-4 border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${statusMeta.color}`}>
                          {statusMeta.label}
                        </span>
                        <p className="text-gray-700 text-sm mt-2 font-sans font-medium">
                          {history.note}
                        </p>
                      </div>
                      
                      <div className="text-right sm:shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-gray-100/70 pt-2 sm:pt-0">
                        <span className="text-[10px] text-gray-400 font-sans">بواسطة: {history.updatedBy}</span>
                        <span className="text-[10px] text-gray-400 font-mono sm:mt-0.5">
                          {new Date(history.timestamp).toLocaleString('ar-SA')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {searched && !order && !loading && (
        <div className="bg-white rounded-3xl border border-gray-100  p-12 text-center animate-in slide-in-from-top-10 duration-200 mb-20">
          <div className="text-5xl mb-4">🔍❌</div>
          <h3 className="font-sans font-bold text-gray-800 text-xl">رقم الطلب غير مسجل!</h3>
          <p className="text-gray-500 text-sm mt-2 font-sans max-w-sm mx-auto">
            لم نتمكن من العثور على أي معلومات لطلب الصيانة ذو الرقم <strong className="font-mono text-teal-600 font-bold uppercase">{orderId}</strong>.
          </p>
          <p className="text-gray-400 text-xs mt-3 font-sans">
            يرجى مراجعة إيصال الصيانة أو الاتصال بالدعم الفني الخاص بالمعرض للتأكد من حالة طلبك.
          </p>
        </div>
      )}

    </div>
  );
};
export default CustomerTrackingView;
