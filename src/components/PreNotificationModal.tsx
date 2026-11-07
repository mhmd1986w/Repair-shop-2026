import React, { useState, useEffect, useRef } from 'react';
import { MaintenanceOrder, DeviceStatus, NotificationTemplate, AppUser } from '../types';
import { formatNotification, getWhatsAppLink } from '../lib/notifications';
import { 
  MessageSquare, 
  Send, 
  X, 
  Wrench, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  DollarSign, 
  Calendar, 
  User, 
  FileText, 
  Mic, 
  MicOff, 
  RefreshCw, 
  History, 
  Check, 
  Smartphone, 
  ShieldCheck,
  Sparkles
} from 'lucide-react';

interface PreNotificationModalProps {
  order: MaintenanceOrder;
  targetStatus?: DeviceStatus;
  targetTemplateId?: string;
  templates: NotificationTemplate[];
  appUrl: string;
  currencyName: string;
  currentUser?: AppUser | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmAndSend: (
    updatedOrder: MaintenanceOrder,
    finalMessage: string,
    channel: 'whatsapp' | 'sms',
    shouldDispatch: boolean
  ) => void;
}

export const PreNotificationModal: React.FC<PreNotificationModalProps> = ({
  order,
  targetStatus,
  targetTemplateId,
  templates,
  appUrl,
  currencyName,
  currentUser,
  isOpen,
  onClose,
  onConfirmAndSend,
}) => {
  if (!isOpen) return null;

  // Immediately scroll to the top of the viewport when opened to save time
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Selected Maintenance & Diagnostic Status
  const [selectedStatus, setSelectedStatus] = useState<DeviceStatus>(
    targetStatus || order.status || DeviceStatus.RECEIVED
  );

  // Diagnosis & Inspection details
  const [faultDescription, setFaultDescription] = useState(order.faultDescription || '');
  const [statusUpdateText, setStatusUpdateText] = useState(order.statusUpdateText || '');
  const [statusNote, setStatusNote] = useState('');
  const [technician, setTechnician] = useState(order.technician || localStorage.getItem('engineerName') || 'م. محمد وليد');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(order.expectedDeliveryDate || '');

  // Pricing
  const [estimatedCost, setEstimatedCost] = useState<number | ''>(order.estimatedCost ?? 0);
  const [actualCost, setActualCost] = useState<number | ''>(
    order.actualCost !== undefined 
      ? order.actualCost 
      : (targetStatus === DeviceStatus.READY || order.status === DeviceStatus.READY ? order.estimatedCost : '')
  );

  // Notification Channel & Message
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    if (targetTemplateId) return targetTemplateId;
    const match = templates.find(t => t.statusTrigger === (targetStatus || order.status));
    return match ? match.id : (templates[0]?.id || 'received');
  });
  const [messageText, setMessageText] = useState('');
  const [isManualMessageEdited, setIsManualMessageEdited] = useState(false);

  // Voice dictation state
  const [listeningField, setListeningField] = useState<'fault' | 'update' | 'note' | null>(null);
  const recognitionRef = useRef<any>(null);

  // When selectedStatus changes, auto-set actualCost if ready
  useEffect(() => {
    if (selectedStatus === DeviceStatus.READY && (actualCost === '' || actualCost === 0)) {
      setActualCost(estimatedCost !== '' ? estimatedCost : order.estimatedCost);
    }
    // Update matching template if not manually locked
    const match = templates.find(t => t.statusTrigger === selectedStatus);
    if (match) {
      setSelectedTemplateId(match.id);
    }
  }, [selectedStatus]);

  // Compute mock order to generate dynamic template text
  const generateMessageFromCurrentState = (tplId?: string, currentStatus?: DeviceStatus) => {
    const statusToUse = currentStatus || selectedStatus;
    const templateIdToUse = tplId || selectedTemplateId;
    const template = templates.find(t => t.id === templateIdToUse) || templates.find(t => t.statusTrigger === statusToUse);

    const tempOrder: MaintenanceOrder = {
      ...order,
      status: statusToUse,
      faultDescription: faultDescription.trim() || order.faultDescription,
      statusUpdateText: statusUpdateText.trim(),
      estimatedCost: estimatedCost === '' ? 0 : Number(estimatedCost),
      actualCost: actualCost === '' ? undefined : Number(actualCost),
      technician: technician.trim() || order.technician,
      expectedDeliveryDate: expectedDeliveryDate || order.expectedDeliveryDate,
      currency: order.currency || currencyName,
    };

    if (template) {
      const formatted = formatNotification(template, tempOrder, appUrl);
      let text = channel === 'sms' ? formatted.sms : formatted.whatsapp;
      // If there is an inspection note and it's not already in the template, append it
      if (statusNote.trim()) {
        text += `\n\n📌 *ملاحظة الفحص والتشخيص:* ${statusNote.trim()}`;
      }
      return text;
    } else {
      // Fallback custom text
      const statusMap: Record<string, string> = {
        received: 'تم الاستلام',
        diagnosing: 'تحت الفحص والتشخيص',
        repairing: 'تحت الإصلاح والصيانة',
        pending: 'قيد الانتظار',
        ready: 'جاهز للتسليم',
        delivered: 'تم التسليم',
        unrepairable: 'تعذر الإصلاح',
      };
      const statusName = statusMap[statusToUse] || statusToUse;
      const costDisplay = actualCost !== '' ? actualCost : (estimatedCost !== '' ? estimatedCost : 0);
      return `مرحباً أ/ *${order.customerName}* 👋\n\nتحديث جديد بخصوص جهازك *${order.deviceType} ${order.brandModel}* (رقم الطلب: \`${order.id}\`):\n\n- *مرحلة الصيانة والفحص:* ${statusName}\n- *التشخيص ووصف العطل:* ${tempOrder.faultDescription}\n- *التكلفة:* ${costDisplay} ${currencyName}\n${statusNote.trim() ? `- *تقرير الفحص:* ${statusNote.trim()}\n` : ''}\nيمكنك متابعة حالة الجهاز عبر: ${appUrl}?track=${order.id}`;
    }
  };

  // Initial message generation
  useEffect(() => {
    if (!isManualMessageEdited) {
      const generated = generateMessageFromCurrentState();
      setMessageText(generated);
    }
  }, [selectedStatus, selectedTemplateId, estimatedCost, actualCost, faultDescription, statusNote, channel]);

  // Voice Dictation cleanup & handler
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  const handleToggleVoice = (field: 'fault' | 'update' | 'note') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("عذراً، متصفحك أو جهازك لا يدعم التعرف على الصوت. يُرجى استخدام متصفح حديث مثل Chrome.");
      return;
    }

    if (listeningField === field) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setListeningField(null);
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setListeningField(field);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          let text = transcript.trim();
          if (text.endsWith('.')) text = text.slice(0, -1);

          if (field === 'fault') {
            setFaultDescription(prev => prev ? `${prev} ${text}` : text);
          } else if (field === 'update') {
            setStatusUpdateText(prev => prev ? `${prev} ${text}` : text);
          } else if (field === 'note') {
            setStatusNote(prev => prev ? `${prev} ${text}` : text);
          }
        }
      };

      recognition.onerror = () => setListeningField(null);
      recognition.onend = () => setListeningField(null);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      setListeningField(null);
    }
  };

  const handleResetMessageToTemplate = () => {
    setIsManualMessageEdited(false);
    const generated = generateMessageFromCurrentState();
    setMessageText(generated);
  };

  const handleSaveAndSend = (shouldDispatchNotification: boolean) => {
    const defaultNotes: Record<DeviceStatus, string> = {
      [DeviceStatus.RECEIVED]: 'تم تحديث حالة مسار الصيانة: الاستلام',
      [DeviceStatus.DIAGNOSING]: 'تم نقل الجهاز لقسم الفحص والتشخيص الفني الدقيق',
      [DeviceStatus.REPAIRING]: 'تم البدء الفعلي في عملية الإصلاح واستبدال القطع',
      [DeviceStatus.PENDING]: 'تم وضع الجهاز قيد الانتظار لموافقة العميل أو القطع',
      [DeviceStatus.READY]: 'تم إنجاز الصيانة بنجاح والجهاز جاهز للتسليم',
      [DeviceStatus.UNREPAIRABLE]: 'تعذر إصلاح العطل لعدم توفر القطع أو تلف اللوحة',
      [DeviceStatus.DELIVERED]: 'تم تسليم الجهاز للعميل بالكامل',
    };

    const finalEstimated = estimatedCost === '' ? 0 : Number(estimatedCost);
    const finalActual = actualCost === '' ? undefined : Number(actualCost);
    const statusNoteText = statusNote.trim() || defaultNotes[selectedStatus];

    const updatedOrder: MaintenanceOrder = {
      ...order,
      status: selectedStatus,
      faultDescription: faultDescription.trim() || order.faultDescription,
      statusUpdateText: statusUpdateText.trim(),
      estimatedCost: finalEstimated,
      actualCost: finalActual,
      technician: technician.trim() || order.technician,
      expectedDeliveryDate: expectedDeliveryDate || order.expectedDeliveryDate,
      updatedAt: Date.now(),
      statusHistory: [
        ...(order.statusHistory || []),
        {
          status: selectedStatus,
          timestamp: Date.now(),
          note: `[مسار الصيانة: ${getStatusLabel(selectedStatus)}] - التشخيص: ${faultDescription.trim() || order.faultDescription} - التكلفة: ${finalActual !== undefined ? finalActual : finalEstimated} ${currencyName} - ${statusNoteText}`,
          updatedBy: currentUser?.displayName || 'فني الصيانة',
        },
      ],
    };

    onConfirmAndSend(updatedOrder, messageText, channel, shouldDispatchNotification);
  };

  function getStatusLabel(s: DeviceStatus) {
    switch (s) {
      case DeviceStatus.RECEIVED: return 'تم الاستلام';
      case DeviceStatus.DIAGNOSING: return 'تحت الفحص والتشخيص';
      case DeviceStatus.REPAIRING: return 'تحت الإصلاح';
      case DeviceStatus.PENDING: return 'قيد الانتظار';
      case DeviceStatus.READY: return 'جاهز للتسليم 🎉';
      case DeviceStatus.DELIVERED: return 'تم التسليم ✅';
      case DeviceStatus.UNREPAIRABLE: return 'غير قابل للإصلاح';
      default: return s;
    }
  }

  const statusOptions: { status: DeviceStatus; label: string; icon: string; color: string }[] = [
    { status: DeviceStatus.RECEIVED, label: 'تم الاستلام', icon: '📥', color: 'border-blue-300 text-blue-700 bg-blue-50/70' },
    { status: DeviceStatus.DIAGNOSING, label: 'تحت الفحص والتشخيص', icon: '🔍', color: 'border-purple-300 text-purple-700 bg-purple-50/70' },
    { status: DeviceStatus.REPAIRING, label: 'تحت الإصلاح والصيانة', icon: '🛠️', color: 'border-amber-300 text-amber-700 bg-amber-50/70' },
    { status: DeviceStatus.PENDING, label: 'قيد الانتظار', icon: '⏳', color: 'border-sky-300 text-sky-700 bg-sky-50/70' },
    { status: DeviceStatus.READY, label: 'جاهز للتسليم', icon: '🎉', color: 'border-emerald-300 text-emerald-700 bg-emerald-50/70' },
    { status: DeviceStatus.UNREPAIRABLE, label: 'غير قابل للإصلاح', icon: '⚠️', color: 'border-rose-300 text-rose-700 bg-rose-50/70' },
    { status: DeviceStatus.DELIVERED, label: 'تم التسليم', icon: '✅', color: 'border-gray-300 text-gray-700 bg-gray-50/70' },
  ];

  return (
    <div className="fixed inset-0 bg-transparent z-50 flex items-start justify-center p-2 pt-1 sm:pt-2 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-150 mb-4">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 px-6 py-4 text-white flex justify-between items-center relative shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-sans font-black text-base text-white">تعديل مسار الصيانة والإشعار قبل الإرسال</h3>
                <span className="font-mono bg-white/20 text-white text-[11px] font-bold px-2 py-0.5 rounded-lg border border-white/30">
                  {order.id}
                </span>
              </div>
              <p className="text-teal-100 text-xs font-sans mt-0.5 flex items-center gap-2">
                <span>العميل: <strong>{order.customerName}</strong> ({order.customerPhone})</span>
                <span>•</span>
                <span>الجهاز: <strong>{order.deviceType} {order.brandModel}</strong></span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[calc(88vh-130px)] overflow-y-auto">
          
          {/* Section 1: Maintenance & Diagnostic Path (مسار الصيانة والفحص) */}
          <div className="bg-gradient-to-br from-slate-50 to-gray-50/80 p-4 rounded-2xl border border-gray-200/80 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-teal-600" />
                <h4 className="font-sans font-extrabold text-gray-800 text-xs sm:text-sm">
                  1. مسار الصيانة ومرحلة الفحص الحالية:
                </h4>
              </div>
              <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                الحالة المحددة: {getStatusLabel(selectedStatus)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {statusOptions.map((opt) => {
                const isSelected = selectedStatus === opt.status;
                return (
                  <button
                    key={opt.status}
                    type="button"
                    onClick={() => {
                      setSelectedStatus(opt.status);
                      setIsManualMessageEdited(false);
                    }}
                    className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                      isSelected 
                        ? 'bg-teal-600 text-white border-teal-700 shadow-md scale-[1.02]' 
                        : 'bg-white hover:bg-gray-100/80 border-gray-200 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">{opt.icon}</span>
                      {isSelected ? (
                        <span className="w-4 h-4 rounded-full bg-white text-teal-700 flex items-center justify-center text-[10px] font-black">
                          ✓
                        </span>
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-gray-300"></div>
                      )}
                    </div>
                    <span className="font-sans font-bold text-[11px] leading-tight">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Diagnosis & Technical Notes (التشخيص ووصف الفحص) */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                <h4 className="font-sans font-extrabold text-gray-800 text-xs sm:text-sm">
                  2. التشخيص ووصف الفحص الفني:
                </h4>
              </div>
              <span className="text-[10px] text-gray-400">يمكن تعديل التشخيص وحفظه في سجل العميل</span>
            </div>

            <div className="space-y-3">
              {/* Fault & Diagnosis Description */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-gray-700 font-sans font-bold text-xs flex items-center gap-1">
                    <span>التشخيص الفني ووصف العطل الفعلي:</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleToggleVoice('fault')}
                    className={`text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1 font-bold transition-colors cursor-pointer ${
                      listeningField === 'fault'
                        ? 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse'
                        : 'bg-gray-100 text-gray-600 hover:bg-teal-50 hover:text-teal-700'
                    }`}
                    title="إملاء صوتي"
                  >
                    {listeningField === 'fault' ? <MicOff className="w-3 h-3 text-rose-600" /> : <Mic className="w-3 h-3 text-teal-600" />}
                    <span>{listeningField === 'fault' ? 'جاري الاستماع...' : 'إملاء صوتي'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={faultDescription}
                  onChange={(e) => setFaultDescription(e.target.value)}
                  placeholder="مثال: شاشة مكسورة وتحتاج إلى تغيير مع آي سي إضاءة..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                />
              </div>

              {/* Status Update / Inspection Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-gray-700 font-sans font-bold text-xs">
                      ملاحظة فحص خاصة بهذا الإشعار:
                    </label>
                    <button
                      type="button"
                      onClick={() => handleToggleVoice('note')}
                      className={`text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1 font-bold transition-colors cursor-pointer ${
                        listeningField === 'note'
                          ? 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse'
                          : 'bg-gray-100 text-gray-600 hover:bg-teal-50 hover:text-teal-700'
                      }`}
                    >
                      <Mic className="w-3 h-3" />
                      <span>صوتي</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="ملاحظة إضافية تضاف لنص الرسالة وسجل العميل..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-700 font-sans font-bold text-xs flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-teal-600" />
                    <span>الفني المسؤول عن الصيانة:</span>
                  </label>
                  <input
                    type="text"
                    value={technician}
                    onChange={(e) => setTechnician(e.target.value)}
                    placeholder="اسم الفني"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Quick Preset Diagnosis Snippets */}
              <div className="flex flex-wrap gap-1 items-center pt-1">
                <span className="text-[10px] text-gray-400 font-bold">عبارات سريعة للتشخيص:</span>
                {[
                  'تم الفحص والدوائر الإلكترونية سليمة',
                  'بانتظار وصول الشاشة الأصلية',
                  'تم تغيير البطارية وفحص الشحن بنجاح',
                  'الجهاز تم تنظيفه ومعالجة التلامس',
                  'تمت صيانة مدخل الشحن وتجربته'
                ].map((txt) => (
                  <button
                    key={txt}
                    type="button"
                    onClick={() => {
                      setStatusNote(txt);
                      setIsManualMessageEdited(false);
                    }}
                    className="text-[10px] bg-gray-100 hover:bg-teal-50 text-gray-600 hover:text-teal-700 px-2 py-0.5 rounded-md border border-gray-200/80 transition-colors cursor-pointer"
                  >
                    + {txt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Cost & Price Modification (تعديل السعر والتكلفة) */}
          <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-200/70 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h4 className="font-sans font-extrabold text-gray-800 text-xs sm:text-sm">
                  3. التكلفة والسعر المالي:
                </h4>
              </div>
              <span className="text-[11px] font-mono text-emerald-800 font-bold bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                العملة: {order.currency || currencyName}
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-gray-700 font-sans font-bold text-xs flex items-center justify-between">
                <span>التكلفة (المبلغ):</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={estimatedCost}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setEstimatedCost(val);
                    setActualCost(val);
                    setIsManualMessageEdited(false);
                  }}
                  placeholder="0"
                  className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 pl-16 text-left"
                  dir="ltr"
                />
                <span className="absolute left-3 top-2 text-[10px] font-bold text-gray-400 font-sans pointer-events-none">
                  {order.currency || currencyName}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Notification Review & Content Editor (نص الإشعار قبل الإرسال) */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/70 pb-2">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" />
                <h4 className="font-sans font-extrabold text-gray-800 text-xs sm:text-sm">
                  4. معاينة وتعديل نص الإشعار المرسل:
                </h4>
              </div>

              {/* Template selector & Reset button */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    setSelectedTemplateId(e.target.value);
                    setIsManualMessageEdited(false);
                  }}
                  className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-sans text-gray-700 focus:ring-1 focus:ring-teal-500"
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      قالب: {tpl.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleResetMessageToTemplate}
                  className="text-[10px] text-teal-700 bg-white hover:bg-teal-50 border border-teal-200 px-2 py-1 rounded-lg flex items-center gap-1 font-bold cursor-pointer"
                  title="إعادة توليد النص وفق القالب وحقول المسار والسعر والتشخيص أعلاه"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>تحديث النص</span>
                </button>
              </div>
            </div>

            {/* Channels: WhatsApp or SMS */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-gray-600">قناة الإرسال:</span>
              <label className="flex items-center gap-1.5 text-xs font-sans font-bold cursor-pointer text-emerald-800">
                <input
                  type="radio"
                  name="notif_channel"
                  value="whatsapp"
                  checked={channel === 'whatsapp'}
                  onChange={() => {
                    setChannel('whatsapp');
                    setIsManualMessageEdited(false);
                  }}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span>واتساب (WhatsApp)</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs font-sans font-bold cursor-pointer text-gray-700">
                <input
                  type="radio"
                  name="notif_channel"
                  value="sms"
                  checked={channel === 'sms'}
                  onChange={() => {
                    setChannel('sms');
                    setIsManualMessageEdited(false);
                  }}
                  className="text-teal-600 focus:ring-teal-500"
                />
                <span>رسالة نصية (SMS)</span>
              </label>
            </div>

            {/* Message Textarea */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] text-gray-500">
                <span>يمكنك تعديل أي كلمة أو إضافة تعليمات خاصة قبل الضغط على إرسال:</span>
                <span className="font-mono">{messageText.length} حرف</span>
              </div>
              <textarea
                rows={5}
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  setIsManualMessageEdited(true);
                }}
                className="w-full bg-white border border-gray-300 rounded-xl p-3 text-xs font-sans leading-relaxed text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y"
                dir="rtl"
              />
            </div>
          </div>

        </div>

        {/* Modal Footer / Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-gray-500 font-sans flex items-center gap-1.5 w-full sm:w-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>سيتم حفظ كافة التعديلات في سجل بطاقة صيانة العميل تلقائياً.</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-sans font-bold text-xs hover:bg-gray-100 transition-colors cursor-pointer"
            >
              إلغاء التراجع
            </button>

            <button
              type="button"
              onClick={() => handleSaveAndSend(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-sans font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="حفظ التعديلات في سجل الجهاز دون إرسال إشعار"
            >
              <span>حفظ في السجل فقط</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveAndSend(true)}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 duration-100 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>حفظ في السجل وإرسال الإشعار الآن</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
