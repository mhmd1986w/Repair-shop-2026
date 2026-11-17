import React, { useState, useEffect, useRef } from 'react';
import {
  MaintenanceOrder,
  DeviceStatus,
  NotificationTemplate,
  AppUser,
  CustomNotificationVariable,
} from '../types';
import {
  formatNotification,
  buildStatusHistorySnapshot,
  getStatusArabicLabel,
  sanitizeCustomVariables,
} from '../lib/notifications';
import {
  MessageSquare,
  Send,
  X,
  Wrench,
  DollarSign,
  Calendar,
  User,
  FileText,
  Mic,
  MicOff,
  RefreshCw,
  ShieldCheck,
  Package,
  Plus,
  Trash2,
  Tag,
  PlusCircle,
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
  useEffect(() => {
    if (isOpen) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [isOpen]);

  const effectiveCurrency = order.currency || currencyName || 'دينار';

  // Selected Maintenance & Diagnostic Status
  const [selectedStatus, setSelectedStatus] = useState<DeviceStatus>(
    targetStatus || order.status || DeviceStatus.RECEIVED
  );

  // Diagnosis & Inspection details
  const [faultDescription, setFaultDescription] = useState(order.faultDescription || '');
  const [statusUpdateText, setStatusUpdateText] = useState(order.statusUpdateText || '');
  const [statusNote, setStatusNote] = useState('');
  const [technician, setTechnician] = useState(
    order.technician || localStorage.getItem('engineerName') || 'م. محمد وليد'
  );
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(order.expectedDeliveryDate || '');

  // Financial breakdown: base/estimated, extra cost + reason, advance payment, actual/total
  const initialEstimated = Number(order.estimatedCost ?? 0);
  const initialExtra = Number(order.extraCost ?? 0);
  const [estimatedCost, setEstimatedCost] = useState<number | ''>(initialEstimated);
  const [extraCost, setExtraCost] = useState<number | ''>(initialExtra || '');
  const [extraCostReason, setExtraCostReason] = useState(order.extraCostReason || '');
  const [advancePayment, setAdvancePayment] = useState<number | ''>(
    order.advancePayment ? Number(order.advancePayment) : ''
  );
  const [actualCost, setActualCost] = useState<number | ''>(
    order.actualCost !== undefined
      ? order.actualCost
      : targetStatus === DeviceStatus.READY || order.status === DeviceStatus.READY || initialExtra > 0
      ? initialEstimated + initialExtra
      : ''
  );
  const [isActualCostManual, setIsActualCostManual] = useState<boolean>(() => {
    if (order.actualCost === undefined) return false;
    return Number(order.actualCost) !== initialEstimated + initialExtra;
  });

  // Waiting for parts
  const [waitingPartsDetails, setWaitingPartsDetails] = useState(order.waitingPartsDetails || '');
  const [waitingPartsExpectedDate, setWaitingPartsExpectedDate] = useState(
    order.waitingPartsExpectedDate || ''
  );

  // Custom dynamic variables
  const [customVariables, setCustomVariables] = useState<CustomNotificationVariable[]>(
    () => order.customVariables?.map((v) => ({ ...v })) || []
  );
  const [newVarLabel, setNewVarLabel] = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  // Notification Channel & Message
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    if (targetTemplateId) return targetTemplateId;
    const match = templates.find((t) => t.statusTrigger === (targetStatus || order.status));
    return match ? match.id : templates[0]?.id || 'received';
  });
  const [messageText, setMessageText] = useState('');
  const [isManualMessageEdited, setIsManualMessageEdited] = useState(false);

  // Voice dictation state
  const [listeningField, setListeningField] = useState<'fault' | 'update' | 'note' | null>(null);
  const recognitionRef = useRef<any>(null);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);

  const numericEstimated = estimatedCost === '' ? 0 : Math.max(0, Number(estimatedCost) || 0);
  const numericExtra = extraCost === '' ? 0 : Math.max(0, Number(extraCost) || 0);
  const numericAdvance = advancePayment === '' ? 0 : Math.max(0, Number(advancePayment) || 0);
  const computedSum = numericEstimated + numericExtra;
  const effectiveTotal =
    actualCost !== '' && !isNaN(Number(actualCost))
      ? Math.max(0, Number(actualCost))
      : computedSum;
  const remainingCost = Math.max(0, effectiveTotal - numericAdvance);

  // Keep actualCost synced when not manually overridden
  useEffect(() => {
    if (!isActualCostManual) {
      if (
        selectedStatus === DeviceStatus.READY ||
        selectedStatus === DeviceStatus.DELIVERED ||
        numericExtra > 0 ||
        order.actualCost !== undefined
      ) {
        setActualCost(computedSum);
      } else {
        setActualCost('');
      }
    }
  }, [selectedStatus, numericEstimated, numericExtra, isActualCostManual]);

  // Update matching template when status changes
  useEffect(() => {
    const match = templates.find((t) => t.statusTrigger === selectedStatus);
    if (match) {
      setSelectedTemplateId(match.id);
    }
  }, [selectedStatus, templates]);

  const buildDraftOrder = (statusToUse?: DeviceStatus): MaintenanceOrder => {
    const cleanVars = sanitizeCustomVariables(customVariables);
    const pendingDraft =
      newVarLabel.trim() && newVarValue.trim()
        ? [
            ...cleanVars,
            {
              key: `var_${cleanVars.length + 1}`,
              label: newVarLabel.trim(),
              value: newVarValue.trim(),
            },
          ]
        : cleanVars;

    const draft: MaintenanceOrder = {
      ...order,
      status: statusToUse || selectedStatus,
      faultDescription: faultDescription.trim() || order.faultDescription,
      statusUpdateText: statusUpdateText.trim() || statusNote.trim(),
      estimatedCost: numericEstimated,
      extraCost: numericExtra,
      extraCostReason: extraCostReason.trim() || undefined,
      advancePayment: numericAdvance,
      actualCost:
        actualCost !== '' && !isNaN(Number(actualCost))
          ? Number(actualCost)
          : numericExtra > 0
          ? computedSum
          : undefined,
      waitingPartsDetails: waitingPartsDetails.trim() || undefined,
      waitingPartsExpectedDate: waitingPartsExpectedDate.trim() || undefined,
      customVariables: pendingDraft.length > 0 ? pendingDraft : undefined,
      technician: technician.trim() || order.technician,
      expectedDeliveryDate: expectedDeliveryDate || order.expectedDeliveryDate,
      currency: effectiveCurrency,
    };
    return draft;
  };

  // Generate dynamic template text from current state
  const generateMessageFromCurrentState = (tplId?: string, currentStatus?: DeviceStatus) => {
    const statusToUse = currentStatus || selectedStatus;
    const templateIdToUse = tplId || selectedTemplateId;
    const template =
      templates.find((t) => t.id === templateIdToUse) ||
      templates.find((t) => t.statusTrigger === statusToUse);

    const tempOrder = buildDraftOrder(statusToUse);

    if (template) {
      const formatted = formatNotification(template, tempOrder, appUrl, {
        statusNote: statusNote.trim(),
        includeDynamicExtras: true,
      });
      return channel === 'sms' ? formatted.sms : formatted.whatsapp;
    }

    const statusName = getStatusArabicLabel(statusToUse);
    const lines = [
      `مرحباً أ/ *${order.customerName}* 👋`,
      '',
      `تحديث جديد بخصوص جهازك *${order.deviceType} ${order.brandModel}* (رقم الطلب: \`${order.id}\`):`,
      `- *مرحلة الصيانة:* ${statusName}`,
      `- *التشخيص ووصف العطل:* ${tempOrder.faultDescription}`,
      `- *التكلفة الأساسية:* ${numericEstimated} ${effectiveCurrency}`,
    ];
    if (numericExtra > 0) {
      lines.push(
        `- *الكلف الإضافية:* ${numericExtra} ${effectiveCurrency}${extraCostReason.trim() ? ` (${extraCostReason.trim()})` : ''}`
      );
    }
    lines.push(`- *التكلفة الإجمالية:* ${effectiveTotal} ${effectiveCurrency}`);
    if (numericAdvance > 0) {
      lines.push(`- *العربون المدفوع:* ${numericAdvance} ${effectiveCurrency} | *المتبقي:* ${remainingCost} ${effectiveCurrency}`);
    }
    if (waitingPartsDetails.trim()) {
      lines.push(
        `- *انتظار القطع:* ${waitingPartsDetails.trim()}${waitingPartsExpectedDate ? ` (الموعد المتوقع: ${waitingPartsExpectedDate})` : ''}`
      );
    }
    if (statusNote.trim()) {
      lines.push(`- *ملاحظة التحديث:* ${statusNote.trim()}`);
    }
    (tempOrder.customVariables || []).forEach((cv) => {
      lines.push(`- *${cv.label}:* ${cv.value}`);
    });
    lines.push('', `يمكنك متابعة حالة الجهاز عبر: ${appUrl}?track=${order.id}`);
    return lines.join('\n');
  };

  useEffect(() => {
    if (isOpen && !isManualMessageEdited) {
      setMessageText(generateMessageFromCurrentState());
    }
  }, [
    isOpen,
    isManualMessageEdited,
    selectedStatus,
    selectedTemplateId,
    estimatedCost,
    extraCost,
    extraCostReason,
    advancePayment,
    actualCost,
    waitingPartsDetails,
    waitingPartsExpectedDate,
    customVariables,
    newVarLabel,
    newVarValue,
    faultDescription,
    statusUpdateText,
    statusNote,
    technician,
    expectedDeliveryDate,
    channel,
  ]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleToggleVoice = (field: 'fault' | 'update' | 'note') => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('عذراً، متصفحك أو جهازك لا يدعم التعرف على الصوت. يُرجى استخدام متصفح حديث مثل Chrome.');
      return;
    }

    if (listeningField === field) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setListeningField(null);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
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
          if (field === 'fault') setFaultDescription((prev) => (prev ? `${prev} ${text}` : text));
          else if (field === 'update') setStatusUpdateText((prev) => (prev ? `${prev} ${text}` : text));
          else if (field === 'note') setStatusNote((prev) => (prev ? `${prev} ${text}` : text));
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

  const handleAddCustomVariable = () => {
    const lbl = newVarLabel.trim();
    const val = newVarValue.trim();
    if (!lbl || !val) return;
    const key = `var_${Date.now().toString(36).slice(-4)}`;
    setCustomVariables((prev) => [...prev, { key, label: lbl, value: val }]);
    setNewVarLabel('');
    setNewVarValue('');
    setIsManualMessageEdited(false);
  };

  const handleRemoveCustomVariable = (index: number) => {
    setCustomVariables((prev) => prev.filter((_, i) => i !== index));
    setIsManualMessageEdited(false);
  };

  const insertTokenIntoMessage = (token: string, displayValue?: string) => {
    const el = messageTextareaRef.current;
    const snippet = displayValue ? `${displayValue}` : token;
    if (el) {
      const start = el.selectionStart ?? messageText.length;
      const end = el.selectionEnd ?? messageText.length;
      const updated = messageText.slice(0, start) + snippet + messageText.slice(end);
      setMessageText(updated);
      setIsManualMessageEdited(true);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + snippet.length, start + snippet.length);
      }, 0);
    } else {
      setMessageText((prev) => `${prev}\n${snippet}`);
      setIsManualMessageEdited(true);
    }
  };

  const handleResetMessageToTemplate = () => {
    setIsManualMessageEdited(false);
    setMessageText(generateMessageFromCurrentState());
  };

  const handleSaveAndSend = (shouldDispatchNotification: boolean) => {
    const defaultNotes: Record<DeviceStatus, string> = {
      [DeviceStatus.RECEIVED]: 'تم تحديث حالة مسار الصيانة: الاستلام',
      [DeviceStatus.DIAGNOSING]: 'تم نقل الجهاز لقسم الفحص والتشخيص الفني الدقيق',
      [DeviceStatus.REPAIRING]: 'تم البدء الفعلي في عملية الإصلاح واستبدال القطع',
      [DeviceStatus.PENDING]: 'تم وضع الجهاز قيد الانتظار لموافقة العميل أو توفر القطع',
      [DeviceStatus.READY]: 'تم إنجاز الصيانة بنجاح والجهاز جاهز للتسليم',
      [DeviceStatus.UNREPAIRABLE]: 'تعذر إصلاح العطل لعدم توفر القطع أو تلف اللوحة',
      [DeviceStatus.DELIVERED]: 'تم تسليم الجهاز للعميل بالكامل',
    };

    const draftOrder = buildDraftOrder(selectedStatus);
    const statusNoteText = statusNote.trim() || defaultNotes[selectedStatus];

    // Remove undefined top-level keys cleanly while keeping explicit values
    const updatedOrder: MaintenanceOrder = {
      ...order,
      status: selectedStatus,
      faultDescription: draftOrder.faultDescription,
      statusUpdateText: statusUpdateText.trim() || statusNote.trim(),
      estimatedCost: numericEstimated,
      extraCost: numericExtra,
      extraCostReason: extraCostReason.trim(),
      advancePayment: numericAdvance,
      ...(draftOrder.actualCost !== undefined ? { actualCost: draftOrder.actualCost } : {}),
      waitingPartsDetails: waitingPartsDetails.trim(),
      waitingPartsExpectedDate: waitingPartsExpectedDate.trim(),
      customVariables: draftOrder.customVariables || [],
      technician: draftOrder.technician,
      expectedDeliveryDate: draftOrder.expectedDeliveryDate,
      currency: effectiveCurrency,
      updatedAt: Date.now(),
    };

    const snapshot = buildStatusHistorySnapshot(updatedOrder, {
      statusNote: statusNoteText,
      sentMessage: messageText,
      notificationChannel: shouldDispatchNotification ? channel : 'none',
      currency: effectiveCurrency,
    });

    const summaryParts = [
      `[مسار الصيانة: ${getStatusArabicLabel(selectedStatus)}]`,
      `التشخيص: ${updatedOrder.faultDescription}`,
      `الإجمالي: ${snapshot.totalCost} ${effectiveCurrency}`,
    ];
    if (snapshot.extraCost > 0) {
      summaryParts.push(
        `كلف إضافية: ${snapshot.extraCost} ${effectiveCurrency}${snapshot.extraCostReason ? ` (${snapshot.extraCostReason})` : ''}`
      );
    }
    if (snapshot.waitingPartsDetails) {
      summaryParts.push(`انتظار القطع: ${snapshot.waitingPartsDetails}`);
    }
    summaryParts.push(statusNoteText);

    updatedOrder.statusHistory = [
      ...(order.statusHistory || []),
      {
        status: selectedStatus,
        timestamp: Date.now(),
        note: summaryParts.join(' - '),
        updatedBy: currentUser?.displayName || 'فني الصيانة',
        snapshot,
      },
    ];

    onConfirmAndSend(updatedOrder, messageText, channel, shouldDispatchNotification);
  };

  const statusOptions: { status: DeviceStatus; label: string; icon: string }[] = [
    { status: DeviceStatus.RECEIVED, label: 'تم الاستلام', icon: '📥' },
    { status: DeviceStatus.DIAGNOSING, label: 'تحت الفحص والتشخيص', icon: '🔍' },
    { status: DeviceStatus.REPAIRING, label: 'تحت الإصلاح والصيانة', icon: '🛠️' },
    { status: DeviceStatus.PENDING, label: 'انتظار القطع / قيد الانتظار', icon: '⏳' },
    { status: DeviceStatus.READY, label: 'جاهز للتسليم', icon: '🎉' },
    { status: DeviceStatus.UNREPAIRABLE, label: 'غير قابل للإصلاح', icon: '⚠️' },
    { status: DeviceStatus.DELIVERED, label: 'تم التسليم', icon: '✅' },
  ];

  const isWaitingPartsHighlighted =
    selectedStatus === DeviceStatus.PENDING || Boolean(waitingPartsDetails.trim());

  return (
    <div
      className="fixed inset-0 bg-black/35 backdrop-blur-xs z-[60] flex items-start justify-center p-2 pt-1 sm:pt-3 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-150 mb-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 px-6 py-4 text-white flex justify-between items-center relative shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-sans font-black text-base text-white">
                  تعديل مسار الصيانة والمتغيرات والإشعار
                </h3>
                <span className="font-mono bg-white/20 text-white text-[11px] font-bold px-2 py-0.5 rounded-lg border border-white/30">
                  {order.id}
                </span>
              </div>
              <p className="text-teal-100 text-xs font-sans mt-0.5 flex items-center gap-2 flex-wrap">
                <span>
                  العميل: <strong>{order.customerName}</strong> ({order.customerPhone})
                </span>
                <span>•</span>
                <span>
                  الجهاز: <strong>{order.deviceType} {order.brandModel}</strong>
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[calc(88vh-130px)] overflow-y-auto">
          {/* Section 1: Status Selector */}
          <div className="bg-gradient-to-br from-slate-50 to-gray-50/80 p-4 rounded-2xl border border-gray-200/80 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-teal-600" />
                <h4 className="font-sans font-extrabold text-gray-800 text-xs sm:text-sm">
                  1. مسار الصيانة ومرحلة الفحص الحالية:
                </h4>
              </div>
              <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                {getStatusArabicLabel(selectedStatus)}
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
                        <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />
                      )}
                    </div>
                    <span className="font-sans font-bold text-[11px] leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Diagnosis, Waiting for Parts & Notes */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                <h4 className="font-sans font-extrabold text-gray-800 text-xs sm:text-sm">
                  2. التشخيص وانتظار القطع والملاحظات:
                </h4>
              </div>
              <span className="text-[10px] text-gray-400">يتم حفظ نسخة كاملة من هذه البيانات في السجل</span>
            </div>

            <div className="space-y-3">
              {/* Fault & Diagnosis */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-gray-700 font-sans font-bold text-xs">
                    التشخيص الفني ووصف العطل الفعلي:
                  </label>
                  <button
                    type="button"
                    onClick={() => handleToggleVoice('fault')}
                    className={`text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1 font-bold transition-colors cursor-pointer ${
                      listeningField === 'fault'
                        ? 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse'
                        : 'bg-gray-100 text-gray-600 hover:bg-teal-50 hover:text-teal-700'
                    }`}
                  >
                    {listeningField === 'fault' ? (
                      <MicOff className="w-3 h-3 text-rose-600" />
                    ) : (
                      <Mic className="w-3 h-3 text-teal-600" />
                    )}
                    <span>{listeningField === 'fault' ? 'جاري الاستماع...' : 'إملاء صوتي'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={faultDescription}
                  onChange={(e) => {
                    setFaultDescription(e.target.value);
                    setIsManualMessageEdited(false);
                  }}
                  placeholder="مثال: شاشة مكسورة وتحتاج إلى تغيير مع آي سي إضاءة..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                />
              </div>

              {/* Waiting for Parts Box */}
              <div
                className={`p-3 rounded-xl border space-y-2 transition-colors ${
                  isWaitingPartsHighlighted
                    ? 'bg-sky-50/80 border-sky-300'
                    : 'bg-gray-50/70 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sky-900 font-sans font-extrabold text-xs flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-sky-600" />
                    <span>انتظار القطع (القطع المطلوبة وحالتها):</span>
                  </label>
                  {waitingPartsDetails && (
                    <button
                      type="button"
                      onClick={() => {
                        setWaitingPartsDetails('');
                        setWaitingPartsExpectedDate('');
                        setIsManualMessageEdited(false);
                      }}
                      className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                    >
                      مسح انتظار القطع
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={waitingPartsDetails}
                    onChange={(e) => {
                      setWaitingPartsDetails(e.target.value);
                      setIsManualMessageEdited(false);
                    }}
                    placeholder="مثال: بانتظار شاشة أصلية من المورد..."
                    className="sm:col-span-2 bg-white border border-sky-200 rounded-xl py-2 px-3 text-xs font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <input
                    type="date"
                    value={waitingPartsExpectedDate}
                    onChange={(e) => {
                      setWaitingPartsExpectedDate(e.target.value);
                      setIsManualMessageEdited(false);
                    }}
                    title="الموعد المتوقع لوصول القطع"
                    className="bg-white border border-sky-200 rounded-xl py-2 px-2.5 text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] text-sky-700 font-bold">خيارات سريعة:</span>
                  {[
                    'بانتظار وصول شاشة أصلية',
                    'بانتظار بطارية جديدة',
                    'بانتظار آي سي / قطعة من المورد',
                    'بانتظار موافقة العميل على التكلفة',
                  ].map((partTxt) => (
                    <button
                      key={partTxt}
                      type="button"
                      onClick={() => {
                        setWaitingPartsDetails(partTxt);
                        setIsManualMessageEdited(false);
                      }}
                      className="text-[10px] bg-white hover:bg-sky-100 text-sky-800 px-2 py-0.5 rounded-md border border-sky-200 transition-colors cursor-pointer"
                    >
                      + {partTxt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Note, Technician, Expected Delivery Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-gray-700 font-sans font-bold text-xs">
                      ملاحظة لهذا التحديث:
                    </label>
                    <button
                      type="button"
                      onClick={() => handleToggleVoice('note')}
                      className={`text-[10px] px-1.5 py-0.5 rounded-lg flex items-center gap-1 font-bold transition-colors cursor-pointer ${
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
                    onChange={(e) => {
                      setStatusNote(e.target.value);
                      setIsManualMessageEdited(false);
                    }}
                    placeholder="ملاحظة تضاف للرسالة والسجل..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-700 font-sans font-bold text-xs flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-teal-600" />
                    <span>الفني المسؤول:</span>
                  </label>
                  <input
                    type="text"
                    value={technician}
                    onChange={(e) => {
                      setTechnician(e.target.value);
                      setIsManualMessageEdited(false);
                    }}
                    placeholder="اسم الفني"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-700 font-sans font-bold text-xs flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>التسليم المتوقع:</span>
                  </label>
                  <input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) => {
                      setExpectedDeliveryDate(e.target.value);
                      setIsManualMessageEdited(false);
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Financial Breakdown (Prices & Extra Costs) */}
          <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-200/80 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h4 className="font-sans font-extrabold text-gray-800 text-xs sm:text-sm">
                  3. الأسعار والكلف الإضافية والدفعات:
                </h4>
              </div>
              <span className="text-[11px] font-mono text-emerald-800 font-bold bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                العملة: {effectiveCurrency}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Base / Estimated Cost */}
              <div className="space-y-1">
                <label className="text-gray-700 font-sans font-bold text-xs">
                  التكلفة الأساسية / المتوقعة ({effectiveCurrency}):
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={estimatedCost}
                  onChange={(e) => {
                    setEstimatedCost(e.target.value === '' ? '' : Number(e.target.value));
                    setIsManualMessageEdited(false);
                  }}
                  placeholder="0"
                  className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left"
                  dir="ltr"
                />
              </div>

              {/* Extra Cost */}
              <div className="space-y-1">
                <label className="text-amber-900 font-sans font-bold text-xs flex items-center gap-1">
                  <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>الكلف الإضافية ({effectiveCurrency}):</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={extraCost}
                  onChange={(e) => {
                    setExtraCost(e.target.value === '' ? '' : Number(e.target.value));
                    setIsManualMessageEdited(false);
                  }}
                  placeholder="0"
                  className="w-full bg-white border border-amber-300 rounded-xl py-2 px-3 text-xs font-mono font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-left"
                  dir="ltr"
                />
              </div>

              {/* Extra Cost Reason */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-gray-700 font-sans font-bold text-xs">
                  بيان / سبب الكلفة الإضافية:
                </label>
                <input
                  type="text"
                  value={extraCostReason}
                  onChange={(e) => {
                    setExtraCostReason(e.target.value);
                    setIsManualMessageEdited(false);
                  }}
                  placeholder="مثال: استبدال فلات شحن إضافي، صيانة بورد، شحن قطعة سريعة..."
                  className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Advance Payment */}
              <div className="space-y-1">
                <label className="text-gray-700 font-sans font-bold text-xs">
                  الدفعة المقدمة / العربون ({effectiveCurrency}):
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={advancePayment}
                  onChange={(e) => {
                    setAdvancePayment(e.target.value === '' ? '' : Number(e.target.value));
                    setIsManualMessageEdited(false);
                  }}
                  placeholder="0"
                  className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs font-mono font-bold text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 text-left"
                  dir="ltr"
                />
              </div>

              {/* Final / Actual Total Cost */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-emerald-900 font-sans font-bold text-xs">
                    الإجمالي الكلي / السعر النهائي ({effectiveCurrency}):
                  </label>
                  {isActualCostManual && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActualCostManual(false);
                        setActualCost(computedSum);
                        setIsManualMessageEdited(false);
                      }}
                      className="text-[10px] text-teal-700 hover:underline font-bold cursor-pointer"
                    >
                      إعادة الحساب تلقائياً
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={actualCost === '' ? computedSum : actualCost}
                  onChange={(e) => {
                    setIsActualCostManual(true);
                    setActualCost(e.target.value === '' ? '' : Number(e.target.value));
                    setIsManualMessageEdited(false);
                  }}
                  className="w-full bg-white border border-emerald-300 rounded-xl py-2 px-3 text-xs font-mono font-black text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Live Financial Summary Ribbon */}
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-sans">
              <span className="bg-white px-2.5 py-1 rounded-lg border border-emerald-200 text-gray-700 font-bold">
                الأساسي: <strong className="font-mono">{numericEstimated}</strong>
              </span>
              {numericExtra > 0 && (
                <span className="bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-300 text-amber-950 font-bold">
                  + إضافية: <strong className="font-mono">{numericExtra}</strong>
                </span>
              )}
              <span className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-extrabold">
                = الإجمالي: <strong className="font-mono">{effectiveTotal}</strong> {effectiveCurrency}
              </span>
              {numericAdvance > 0 && (
                <span className="bg-teal-100 text-teal-900 px-2.5 py-1 rounded-lg border border-teal-200 font-bold">
                  المتبقي: <strong className="font-mono">{remainingCost}</strong> {effectiveCurrency}
                </span>
              )}
            </div>
          </div>

          {/* Section 4: Custom New Variables */}
          <div className="bg-violet-50/40 p-4 rounded-2xl border border-violet-200/80 space-y-2.5">
            <div className="flex items-center justify-between border-b border-violet-100 pb-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-violet-600" />
                <h4 className="font-sans font-extrabold text-gray-800 text-xs sm:text-sm">
                  4. متغيرات جديدة مخصصة (تُرسل بالرسالة وتُحفظ بالسجل):
                </h4>
              </div>
            </div>

            {customVariables.length > 0 && (
              <div className="space-y-1.5">
                {customVariables.map((cv, idx) => (
                  <div
                    key={`${cv.key}-${idx}`}
                    className="flex items-center gap-2 bg-white p-2 rounded-xl border border-violet-200 text-xs"
                  >
                    <input
                      type="text"
                      value={cv.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomVariables((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, label: val } : item))
                        );
                        setIsManualMessageEdited(false);
                      }}
                      placeholder="اسم المتغير"
                      className="w-1/3 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-violet-900"
                    />
                    <input
                      type="text"
                      value={cv.value}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomVariables((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, value: val } : item))
                        );
                        setIsManualMessageEdited(false);
                      }}
                      placeholder="القيمة"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomVariable(idx)}
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="حذف المتغير"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <input
                type="text"
                value={newVarLabel}
                onChange={(e) => {
                  setNewVarLabel(e.target.value);
                  setIsManualMessageEdited(false);
                }}
                placeholder="اسم المتغير (مثل: مدة الضمان)"
                className="sm:col-span-4 bg-white border border-violet-200 rounded-xl py-1.5 px-3 text-xs font-sans text-gray-800"
              />
              <input
                type="text"
                value={newVarValue}
                onChange={(e) => {
                  setNewVarValue(e.target.value);
                  setIsManualMessageEdited(false);
                }}
                placeholder="القيمة (مثل: 3 أشهر / قطعة أصلية)"
                className="sm:col-span-5 bg-white border border-violet-200 rounded-xl py-1.5 px-3 text-xs font-sans text-gray-800"
              />
              <button
                type="button"
                onClick={handleAddCustomVariable}
                disabled={!newVarLabel.trim() || !newVarValue.trim()}
                className="sm:col-span-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-45 text-white font-bold text-xs py-1.5 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة متغير</span>
              </button>
            </div>
          </div>

          {/* Section 5: Notification Review & Variable Chips */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/70 pb-2">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" />
                <h4 className="font-sans font-extrabold text-gray-800 text-xs sm:text-sm">
                  5. معاينة وتعديل نص الإشعار المرسل:
                </h4>
              </div>

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
                  title="إعادة توليد النص وفق القالب وجميع المتغيرات أعلاه"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>تحديث النص</span>
                </button>
              </div>
            </div>

            {/* Channel selector */}
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

            {/* Quick Insert Variable Value Buttons */}
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-[10px] text-gray-500 font-bold">إدراج سريع بالرسالة:</span>
              {[
                { label: 'التكلفة الأساسية', val: `التكلفة الأساسية: ${numericEstimated} ${effectiveCurrency}` },
                {
                  label: 'الكلف الإضافية',
                  val: `كلف إضافية: ${numericExtra} ${effectiveCurrency}${extraCostReason ? ` (${extraCostReason})` : ''}`,
                },
                { label: 'الإجمالي', val: `الإجمالي: ${effectiveTotal} ${effectiveCurrency}` },
                { label: 'المتبقي', val: `المتبقي: ${remainingCost} ${effectiveCurrency}` },
                ...(waitingPartsDetails.trim()
                  ? [{ label: 'انتظار القطع', val: `انتظار القطع: ${waitingPartsDetails.trim()}` }]
                  : []),
                ...sanitizeCustomVariables(customVariables).map((cv) => ({
                  label: cv.label,
                  val: `${cv.label}: ${cv.value}`,
                })),
              ].map((item, idx) => (
                <button
                  key={`${item.label}-${idx}`}
                  type="button"
                  onClick={() => insertTokenIntoMessage('', item.val)}
                  className="text-[10px] bg-white hover:bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-md font-bold cursor-pointer transition-colors"
                >
                  + {item.label}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] text-gray-500">
                <span>يمكنك تعديل نص الرسالة بحرية قبل الإرسال:</span>
                <span className="font-mono">{messageText.length} حرف</span>
              </div>
              <textarea
                ref={messageTextareaRef}
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

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-gray-500 font-sans flex items-center gap-1.5 w-full sm:w-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>سيتم حفظ نسخة من الأسعار والكلف والانتظار والمتغيرات في السجل تلقائياً.</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-sans font-bold text-xs hover:bg-gray-100 transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={() => handleSaveAndSend(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-sans font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
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
