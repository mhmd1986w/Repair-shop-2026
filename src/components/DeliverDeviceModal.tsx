import React, { useState, useEffect, useRef } from 'react';
import {
  MaintenanceOrder,
  DeviceStatus,
  NotificationTemplate,
  CustomNotificationVariable,
} from '../types';
import {
  formatNotification,
  sanitizeCustomVariables,
} from '../lib/notifications';
import {
  CheckCircle2,
  User,
  HelpCircle,
  FileText,
  Award,
  Mic,
  MicOff,
  PlusCircle,
  Package,
  Tag,
  Plus,
  Trash2,
  Send,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface DeliveryConfirmPayload {
  recipientName: string;
  relationToCustomer: string;
  notes: string;
  statusUpdateText: string;
  estimatedCost: number;
  extraCost: number;
  extraCostReason: string;
  advancePayment: number;
  finalCost: number;
  updatedDiagnosis: string;
  waitingPartsDetails: string;
  customVariables: CustomNotificationVariable[];
  sendNotification: boolean;
  notificationChannel: 'whatsapp' | 'sms';
  notificationMessage: string;
}

interface DeliverDeviceModalProps {
  order: MaintenanceOrder;
  templates?: NotificationTemplate[];
  appUrl?: string;
  onConfirm: (payload: DeliveryConfirmPayload) => void;
  onClose: () => void;
}

export const DeliverDeviceModal: React.FC<DeliverDeviceModalProps> = ({
  order,
  templates = [],
  appUrl = '',
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const currencyName = order.currency || localStorage.getItem('currencyName') || 'دينار';

  const [recipientName, setRecipientName] = useState(order.customerName);
  const [relationMode, setRelationMode] = useState<'العميل نفسه' | 'أخ / أخت' | 'أب / أم' | 'أخرى'>('العميل نفسه');
  const [customRelation, setCustomRelation] = useState('');
  const [notes, setNotes] = useState('');
  const [statusUpdateText] = useState(order.statusUpdateText || '');
  const [diagnosis, setDiagnosis] = useState<string>(order.faultDescription || '');

  // Financial breakdown at delivery
  const initEstimated = Number(order.estimatedCost ?? 0);
  const initExtra = Number(order.extraCost ?? 0);
  const [estimatedCost, setEstimatedCost] = useState<number | ''>(initEstimated);
  const [extraCost, setExtraCost] = useState<number | ''>(initExtra || '');
  const [extraCostReason, setExtraCostReason] = useState(order.extraCostReason || '');
  const [advancePayment, setAdvancePayment] = useState<number | ''>(
    order.advancePayment ? Number(order.advancePayment) : ''
  );
  const [finalCost, setFinalCost] = useState<number | ''>(
    order.actualCost !== undefined ? order.actualCost : initEstimated + initExtra
  );
  const [isFinalManual, setIsFinalManual] = useState<boolean>(() => {
    if (order.actualCost === undefined) return false;
    return Number(order.actualCost) !== initEstimated + initExtra;
  });

  // Waiting parts status/note & Custom variables
  const [waitingPartsDetails, setWaitingPartsDetails] = useState(order.waitingPartsDetails || '');
  const [customVariables, setCustomVariables] = useState<CustomNotificationVariable[]>(
    () => order.customVariables?.map((v) => ({ ...v })) || []
  );
  const [newVarLabel, setNewVarLabel] = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  // Delivery Notification Message
  const [sendNotification, setSendNotification] = useState(true);
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isMsgManual, setIsMsgManual] = useState(false);

  const [isSubmitActive, setIsSubmitActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const numEstimated = estimatedCost === '' ? 0 : Math.max(0, Number(estimatedCost) || 0);
  const numExtra = extraCost === '' ? 0 : Math.max(0, Number(extraCost) || 0);
  const numAdvance = advancePayment === '' ? 0 : Math.max(0, Number(advancePayment) || 0);
  const numFinal =
    finalCost === '' ? numEstimated + numExtra : Math.max(0, Number(finalCost) || 0);
  const remainingToCollect = Math.max(0, numFinal - numAdvance);

  const resolvedRelation = relationMode === 'أخرى' ? customRelation.trim() : relationMode;

  useEffect(() => {
    if (!isFinalManual) {
      setFinalCost(numEstimated + numExtra);
    }
  }, [numEstimated, numExtra, isFinalManual]);

  const buildPreviewMessage = () => {
    const cleanVars = sanitizeCustomVariables(customVariables);
    const pendingVars =
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

    const previewOrder: MaintenanceOrder = {
      ...order,
      status: DeviceStatus.DELIVERED,
      faultDescription: diagnosis.trim() || order.faultDescription,
      estimatedCost: numEstimated,
      extraCost: numExtra,
      extraCostReason: extraCostReason.trim() || undefined,
      advancePayment: numAdvance,
      actualCost: numFinal,
      waitingPartsDetails: waitingPartsDetails.trim() || undefined,
      customVariables: pendingVars.length > 0 ? pendingVars : undefined,
      currency: currencyName,
      deliveryInfo: {
        recipientName: recipientName.trim() || order.customerName,
        relationToCustomer: resolvedRelation || 'العميل نفسه',
        deliveryDate: Date.now(),
        notes: notes.trim(),
      },
    };

    const tpl = templates.find((t) => t.statusTrigger === DeviceStatus.DELIVERED);
    if (tpl) {
      const formatted = formatNotification(tpl, previewOrder, appUrl, {
        statusNote: notes.trim(),
        includeDynamicExtras: true,
      });
      return channel === 'sms' ? formatted.sms : formatted.whatsapp;
    }

    const lines = [
      `مرحباً أ/ *${order.customerName}* 👋`,
      '',
      `تم تسليم جهازك *${order.deviceType} ${order.brandModel}* (رقم الطلب: \`${order.id}\`) بنجاح.`,
      `- *المستلم:* ${previewOrder.deliveryInfo?.recipientName} (${previewOrder.deliveryInfo?.relationToCustomer})`,
      `- *الإجمالي النهائي:* ${numFinal} ${currencyName}`,
    ];
    if (numExtra > 0) {
      lines.push(
        `- *الكلف الإضافية:* ${numExtra} ${currencyName}${extraCostReason.trim() ? ` (${extraCostReason.trim()})` : ''}`
      );
    }
    if (numAdvance > 0) {
      lines.push(`- *العربون:* ${numAdvance} ${currencyName} | *المتبقي المحصل:* ${remainingToCollect} ${currencyName}`);
    }
    if (waitingPartsDetails.trim()) {
      lines.push(`- *القطع:* ${waitingPartsDetails.trim()}`);
    }
    pendingVars.forEach((cv) => lines.push(`- *${cv.label}:* ${cv.value}`));
    return lines.join('\n');
  };

  useEffect(() => {
    if (!isMsgManual) {
      setNotificationMessage(buildPreviewMessage());
    }
  }, [
    isMsgManual,
    recipientName,
    resolvedRelation,
    notes,
    diagnosis,
    estimatedCost,
    extraCost,
    extraCostReason,
    advancePayment,
    finalCost,
    waitingPartsDetails,
    customVariables,
    newVarLabel,
    newVarValue,
    channel,
  ]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
    };
  }, []);

  const toggleListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(
        'عذراً، متصفحك أو جهازك الحالي لا يدعم ميزة التعرف على الصوت. يرجى استخدام متصفح يدعم هذه الخدمة مثل Google Chrome أو Safari.'
      );
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          let cleanedText = transcript.trim();
          if (cleanedText.endsWith('.')) cleanedText = cleanedText.slice(0, -1);
          setNotes((prev) => (prev ? `${prev} ${cleanedText}` : cleanedText));
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
    }
  };

  const handleAddCustomVar = () => {
    const lbl = newVarLabel.trim();
    const val = newVarValue.trim();
    if (!lbl || !val) return;
    setCustomVariables((prev) => [
      ...prev,
      { key: `var_${Date.now().toString(36).slice(-4)}`, label: lbl, value: val },
    ]);
    setNewVarLabel('');
    setNewVarValue('');
    setIsMsgManual(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() || !resolvedRelation) return;

    try {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch (e) {}

    const cleanVars = sanitizeCustomVariables(customVariables);
    const mergedVars =
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

    onConfirm({
      recipientName: recipientName.trim(),
      relationToCustomer: resolvedRelation,
      notes: notes.trim(),
      statusUpdateText: statusUpdateText.trim(),
      estimatedCost: numEstimated,
      extraCost: numExtra,
      extraCostReason: extraCostReason.trim(),
      advancePayment: numAdvance,
      finalCost: numFinal,
      updatedDiagnosis: diagnosis.trim(),
      waitingPartsDetails: waitingPartsDetails.trim(),
      customVariables: mergedVars,
      sendNotification,
      notificationChannel: channel,
      notificationMessage: notificationMessage.trim(),
    });
  };

  const handleQuickRelation = (rel: 'العميل نفسه' | 'أخ / أخت' | 'أب / أم' | 'أخرى') => {
    setRelationMode(rel);
    if (rel === 'العميل نفسه') {
      setRecipientName(order.customerName);
      setCustomRelation('');
    } else {
      setRecipientName('');
      if (rel !== 'أخرى') setCustomRelation('');
    }
    setIsMsgManual(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[70] flex items-start justify-center p-2 pt-1 sm:pt-2 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-150 mb-4">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 animate-bounce shrink-0" />
            <div>
              <h3 className="font-sans font-extrabold text-base sm:text-lg">
                تسليم الجهاز الفعلي وإغلاق الطلب
              </h3>
              <p className="text-emerald-100 text-xs font-sans mt-0.5">
                الطلب رقم: {order.id} | {order.deviceType} {order.brandModel}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[calc(88vh-90px)] overflow-y-auto">
          {/* Quick options for relationship */}
          <div className="space-y-2">
            <label className="block text-gray-700 font-sans font-bold text-xs">
              صلة القرابة للمستلم:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['العميل نفسه', 'أخ / أخت', 'أب / أم', 'أخرى'] as const).map((relation) => (
                <button
                  type="button"
                  key={relation}
                  onClick={() => handleQuickRelation(relation)}
                  className={`py-2 px-1 text-xs font-sans font-semibold rounded-xl border transition-all cursor-pointer ${
                    relationMode === relation
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-500 ring-2 ring-emerald-100'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {relation}
                </button>
              ))}
            </div>
          </div>

          {relationMode === 'أخرى' && (
            <div className="space-y-1 animate-in slide-in-from-top-2 duration-150">
              <label className="block text-gray-700 font-sans font-medium text-xs">
                اكتب صلة القرابة بالتفصيل:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="مثال: صديقه، سائق العائلة، إلخ..."
                  value={customRelation}
                  onChange={(e) => {
                    setCustomRelation(e.target.value);
                    setIsMsgManual(false);
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-sans text-gray-800"
                  required
                />
                <HelpCircle className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
            </div>
          )}

          {/* Recipient Name */}
          <div className="space-y-1.5">
            <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              اسم المستلم الفعلي للجهاز:
            </label>
            <input
              type="text"
              placeholder="اكتب اسم الشخص الذي استلم الجهاز كاملاً"
              value={recipientName}
              onChange={(e) => {
                setRecipientName(e.target.value);
                setIsMsgManual(false);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-sans text-gray-800 font-semibold"
              required
            />
          </div>

          {/* Financial breakdown */}
          <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200/80 space-y-3 text-amber-950 font-sans">
            <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
              <span className="font-extrabold text-xs flex items-center gap-1.5">
                <span>💰</span>
                <span>الأسعار والكلف الإضافية والتحصيل عند التسليم:</span>
              </span>
              <span className="text-[11px] font-mono font-bold bg-white px-2 py-0.5 rounded-lg border border-amber-200">
                {currencyName}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-amber-900">التكلفة الأساسية:</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={estimatedCost}
                  onChange={(e) => {
                    setEstimatedCost(e.target.value === '' ? '' : Number(e.target.value));
                    setIsMsgManual(false);
                  }}
                  className="w-full bg-white border border-amber-200 rounded-xl py-1.5 px-3 text-xs font-mono font-bold text-gray-900 text-left"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                  <PlusCircle className="w-3 h-3 text-amber-600" />
                  <span>الكلف الإضافية:</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={extraCost}
                  onChange={(e) => {
                    setExtraCost(e.target.value === '' ? '' : Number(e.target.value));
                    setIsMsgManual(false);
                  }}
                  placeholder="0"
                  className="w-full bg-white border border-amber-300 rounded-xl py-1.5 px-3 text-xs font-mono font-bold text-amber-900 text-left"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-bold text-amber-900">سبب الكلف الإضافية:</label>
                <input
                  type="text"
                  value={extraCostReason}
                  onChange={(e) => {
                    setExtraCostReason(e.target.value);
                    setIsMsgManual(false);
                  }}
                  placeholder="بيان الكلفة الإضافية إن وجدت..."
                  className="w-full bg-white border border-amber-200 rounded-xl py-1.5 px-3 text-xs font-sans text-gray-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-amber-900">العربون / المدفوع مسبقاً:</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={advancePayment}
                  onChange={(e) => {
                    setAdvancePayment(e.target.value === '' ? '' : Number(e.target.value));
                    setIsMsgManual(false);
                  }}
                  placeholder="0"
                  className="w-full bg-white border border-amber-200 rounded-xl py-1.5 px-3 text-xs font-mono font-bold text-teal-800 text-left"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-emerald-900">التكلفة النهائية:</label>
                  {isFinalManual && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsFinalManual(false);
                        setFinalCost(numEstimated + numExtra);
                        setIsMsgManual(false);
                      }}
                      className="text-[10px] text-teal-700 hover:underline font-bold cursor-pointer"
                    >
                      تلقائي
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={finalCost}
                  onChange={(e) => {
                    setIsFinalManual(true);
                    setFinalCost(e.target.value === '' ? '' : Number(e.target.value));
                    setIsMsgManual(false);
                  }}
                  className="w-full bg-white border border-emerald-400 rounded-xl py-1.5 px-3 text-xs font-mono font-black text-emerald-950 text-left"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
              <span className="bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-extrabold">
                الإجمالي النهائي: <span className="font-mono">{numFinal}</span> {currencyName}
              </span>
              <span className="bg-white border border-amber-300 text-amber-950 px-2.5 py-1 rounded-lg font-bold">
                المتبقي للتحصيل الآن: <span className="font-mono">{remainingToCollect}</span> {currencyName}
              </span>
            </div>
          </div>

          {/* Waiting Parts Note (if any or updated on handover) */}
          <div className="space-y-1.5">
            <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-sky-600" />
              حالة القطع / انتظار القطع (يحفظ في السجل):
            </label>
            <input
              type="text"
              value={waitingPartsDetails}
              onChange={(e) => {
                setWaitingPartsDetails(e.target.value);
                setIsMsgManual(false);
              }}
              placeholder="مثال: تم تركيب الشاشة الأصلية بنجاح (أو اتركه فارغاً)"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
            />
          </div>

          {/* Diagnosis confirmation */}
          <div className="space-y-1.5">
            <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              تأكيد التشخيص وتقرير الصيانة المنجزة:
            </label>
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => {
                setDiagnosis(e.target.value);
                setIsMsgManual(false);
              }}
              placeholder="وصف العطل أو الإصلاح الذي تم إنجازه..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-sans text-gray-800"
            />
          </div>

          {/* Custom Variables at Delivery */}
          <div className="bg-violet-50/40 p-3 rounded-2xl border border-violet-200/80 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-violet-900">
              <Tag className="w-3.5 h-3.5 text-violet-600" />
              <span>إضافة متغيرات جديدة للتسليم (تُرسل وتُحفظ بالسجل):</span>
            </div>

            {customVariables.map((cv, idx) => (
              <div
                key={`${cv.key}-${idx}`}
                className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-violet-200 text-xs"
              >
                <span className="font-bold text-violet-900 px-2">{cv.label}:</span>
                <span className="flex-1 text-gray-800">{cv.value}</span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomVariables((prev) => prev.filter((_, i) => i !== idx));
                    setIsMsgManual(false);
                  }}
                  className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
              <input
                type="text"
                value={newVarLabel}
                onChange={(e) => {
                  setNewVarLabel(e.target.value);
                  setIsMsgManual(false);
                }}
                placeholder="اسم المتغير (مثل: الضمان)"
                className="sm:col-span-4 bg-white border border-violet-200 rounded-xl py-1.5 px-2.5 text-xs"
              />
              <input
                type="text"
                value={newVarValue}
                onChange={(e) => {
                  setNewVarValue(e.target.value);
                  setIsMsgManual(false);
                }}
                placeholder="القيمة (مثل: 30 يوم)"
                className="sm:col-span-5 bg-white border border-violet-200 rounded-xl py-1.5 px-2.5 text-xs"
              />
              <button
                type="button"
                onClick={handleAddCustomVar}
                disabled={!newVarLabel.trim() || !newVarValue.trim()}
                className="sm:col-span-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs font-bold py-1.5 px-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة</span>
              </button>
            </div>
          </div>

          {/* Delivery Notes */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between">
              <span className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                ملاحظات التسليم أو ملخص الصيانة (اختياري):
              </span>
              <button
                type="button"
                onClick={toggleListening}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isListening
                    ? 'bg-red-100 text-red-600 animate-pulse'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-emerald-600'
                }`}
                title={isListening ? 'إيقاف التسجيل' : 'بدء التسجيل الصوتي'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </label>
            <textarea
              placeholder="مثال: تم تجربة الجهاز بالكامل أمام المستلم وتأكيد عمل الكاميرا والشاشة واللمس..."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setIsMsgManual(false);
              }}
              rows={2}
              className={`w-full bg-gray-50 border rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-sans text-gray-800 transition-colors ${
                isListening ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
              }`}
            />
          </div>

          {/* Delivery Message Preview & Channel */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-gray-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendNotification}
                  onChange={(e) => setSendNotification(e.target.checked)}
                  className="accent-emerald-600 w-4 h-4 rounded"
                />
                <Send className="w-3.5 h-3.5 text-emerald-600" />
                <span>إرسال إشعار تأكيد التسليم بالمتغيرات الجديدة</span>
              </label>

              {sendNotification && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setChannel('whatsapp');
                      setIsMsgManual(false);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer ${
                      channel === 'whatsapp'
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    واتساب
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChannel('sms');
                      setIsMsgManual(false);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer ${
                      channel === 'sms'
                        ? 'bg-indigo-600 text-white border-indigo-700'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMsgManual(false);
                      setNotificationMessage(buildPreviewMessage());
                    }}
                    className="p-1 bg-white border border-gray-200 rounded-lg text-teal-700 hover:bg-teal-50 cursor-pointer"
                    title="تحديث نص الرسالة"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {sendNotification && (
              <textarea
                rows={4}
                value={notificationMessage}
                onChange={(e) => {
                  setNotificationMessage(e.target.value);
                  setIsMsgManual(true);
                }}
                className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs font-sans text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                dir="rtl"
              />
            )}
          </div>

          {/* Digital confirmation */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-start gap-3">
            <input
              type="checkbox"
              id="confirm-sign"
              checked={isSubmitActive}
              onChange={(e) => setIsSubmitActive(e.target.checked)}
              className="w-4.5 h-4.5 accent-emerald-600 mt-0.5 rounded cursor-pointer"
            />
            <label
              htmlFor="confirm-sign"
              className="text-xs text-gray-600 leading-relaxed font-sans select-none cursor-pointer"
            >
              أقر أنا موظف المعرض بأنني قمت بمطابقة هوية المستلم وتسليمه الجهاز سليم بالكامل بعد معاينته وتجربته.
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button
              type="submit"
              disabled={!isSubmitActive || !recipientName.trim() || !resolvedRelation}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-sans font-bold py-3 rounded-2xl transition-colors text-sm shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Award className="w-4.5 h-4.5" />
              <span>تأكيد التسليم وحفظ السجل والرسالة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-sans font-medium rounded-2xl transition-colors text-sm cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default DeliverDeviceModal;
