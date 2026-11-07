import React, { useState, useEffect, useRef } from 'react';
import { MaintenanceOrder, DeviceStatus } from '../types';
import { CheckCircle2, User, HelpCircle, FileText, Award, Mic, MicOff } from 'lucide-react';
import confetti from 'canvas-confetti';

interface DeliverDeviceModalProps {
  order: MaintenanceOrder;
  onConfirm: (
    recipientName: string,
    relationToCustomer: string,
    notes: string,
    statusUpdateText: string,
    finalCost?: number,
    updatedDiagnosis?: string
  ) => void;
  onClose: () => void;
}

export const DeliverDeviceModal: React.FC<DeliverDeviceModalProps> = ({ order, onConfirm, onClose }) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const [recipientName, setRecipientName] = useState(order.customerName);
  const [relationToCustomer, setRelationToCustomer] = useState('العميل نفسه');
  const [notes, setNotes] = useState('');
  const [statusUpdateText, setStatusUpdateText] = useState(order.statusUpdateText || '');
  const [finalCost, setFinalCost] = useState<number | ''>(order.actualCost !== undefined ? order.actualCost : order.estimatedCost);
  const [diagnosis, setDiagnosis] = useState<string>(order.faultDescription || '');
  const [isSubmitActive, setIsSubmitActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const currencyName = localStorage.getItem('currencyName') || 'دينار';

  const toggleListening = () => {
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

      recognition.onstart = () => setIsListening(true);
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          let cleanedText = transcript.trim();
          if (cleanedText.endsWith('.')) cleanedText = cleanedText.slice(0, -1);
          setNotes(prev => prev ? `${prev} ${cleanedText}` : cleanedText);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          alert("يرجى تفعيل صلاحية استخدام الميكروفون في المتصفح لتتمكن من تسجيل الصوت.");
        } else if (event.error === 'no-speech') {
          // ignore
        } else {
          alert("تعذر التعرف على الصوت بشكل دقيق. يرجى المحاولة مرة أخرى بصوت واضح وبطيء.");
        }
        setIsListening(false);
      };

      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() || !relationToCustomer.trim()) return;
    
    // Play celebratory confetti upon successful handover!
    try {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (e) {
      console.error("Confetti launch failed:", e);
    }
    
    const costToPass = finalCost === '' ? undefined : Number(finalCost);
    onConfirm(recipientName.trim(), relationToCustomer.trim(), notes.trim(), statusUpdateText.trim(), costToPass, diagnosis.trim());
  };

  const handleQuickRelation = (rel: string) => {
    setRelationToCustomer(rel);
    if (rel === 'العميل نفسه') {
      setRecipientName(order.customerName);
    } else {
      setRecipientName('');
    }
  };

  return (
    <div className="fixed inset-0 bg-transparent z-50 flex items-start justify-center p-2 pt-1 sm:pt-2 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-150 mb-4">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 animate-bounce" />
            <div>
              <h3 className="font-sans font-extrabold text-lg">تسليم الجهاز الفعلي وإغلاق الطلب</h3>
              <p className="text-emerald-100 text-xs font-sans mt-0.5">الطلب رقم: {order.id} | {order.deviceType} {order.brandModel}</p>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-gray-600 text-sm font-sans leading-relaxed">
            يرجى ملء بيانات تسليم الجهاز وتأكيد اسم المستلم الفعلي لحفظها في سجل المعرض بدقة وحماية حقوق المتجر.
          </p>

          {/* Quick options for relationship */}
          <div className="space-y-2">
            <label className="block text-gray-700 font-sans font-bold text-xs">صلة القرابة للمستلم:</label>
            <div className="grid grid-cols-4 gap-2">
              {['العميل نفسه', 'أخ / أخت', 'أب / أم', 'أخرى'].map((relation) => (
                <button
                  type="button"
                  key={relation}
                  onClick={() => handleQuickRelation(relation)}
                  className={`py-2 px-1 text-xs font-sans font-semibold rounded-xl border transition-all ${
                    relationToCustomer === relation
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-500 ring-2 ring-emerald-100'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {relation}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient Relation Manual Input (if Other) */}
          {relationToCustomer === 'أخرى' && (
            <div className="space-y-1 animate-in slide-in-from-top-2 duration-150">
              <label className="block text-gray-700 font-sans font-medium text-xs">اكتب صلة القرابة بالتفصيل:</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="مثال: صديقه، سائق العائلة، إلخ..."
                  value={relationToCustomer === 'أخرى' ? '' : relationToCustomer}
                  onChange={(e) => setRelationToCustomer(e.target.value)}
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
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-sans text-gray-800 font-semibold"
              required
            />
          </div>

          {/* Financial summary reminder & price edit */}
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200/80 space-y-2 text-amber-900 font-sans">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl">💰</span>
                <div>
                  <span className="block font-bold text-xs text-amber-900">تأكيد / تعديل التكلفة النهائية للتحصيل:</span>
                  <span className="text-[11px] text-amber-700">يمكنك تعديل السعر النهائي قبل التسليم وحفظه في السجل</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.5"
                value={finalCost}
                onChange={(e) => setFinalCost(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-white border border-amber-300 rounded-xl py-2 px-3 text-sm font-mono font-bold text-amber-950 focus:ring-2 focus:ring-amber-500 outline-none text-left"
                dir="ltr"
              />
              <span className="font-bold text-xs shrink-0 text-amber-800">{order.currency || currencyName}</span>
            </div>
          </div>

          {/* Diagnosis & Fault confirmation / update */}
          <div className="space-y-1.5">
            <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              تأكيد التشخيص وتقرير الصيانة المنجزة:
            </label>
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="وصف العطل أو الإصلاح الذي تم إنجازه..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-sans text-gray-800"
            />
          </div>



          <div className="space-y-1.5">
            <label className="flex items-center justify-between">
              <span className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                ملاحظات التسليم أو ملخص الصيانة (اختياري):
              </span>
              <button
                type="button"
                onClick={toggleListening}
                className={`p-1.5 rounded-full transition-colors ${
                  isListening 
                    ? 'bg-red-100 text-red-600 animate-pulse' 
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-emerald-600'
                }`}
                title={isListening ? "إيقاف التسجيل" : "بدء التسجيل الصوتي"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </label>
            <textarea
              placeholder="مثال: تم تجربة الجهاز بالكامل أمام المستلم وتأكيد عمل الكاميرا والشاشة واللمس..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`w-full bg-gray-50 border rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-sans text-gray-800 transition-colors ${
                isListening ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
              }`}
            />
          </div>

          {/* Simple digital signature verification (check) */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-start gap-3">
            <input
              type="checkbox"
              id="confirm-sign"
              checked={isSubmitActive}
              onChange={(e) => setIsSubmitActive(e.target.checked)}
              className="w-4.5 h-4.5 accent-emerald-600 mt-0.5 rounded cursor-pointer"
            />
            <label htmlFor="confirm-sign" className="text-xs text-gray-600 leading-relaxed font-sans select-none cursor-pointer">
              أقر أنا موظف المعرض بأنني قمت بمطابقة هوية المستلم وتسليمه الجهاز سليم بالكامل بعد معاينته وتجربته.
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-3 border-t border-gray-100">
            <button
              type="submit"
              disabled={!isSubmitActive || !recipientName.trim()}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-sans font-bold py-3 rounded-2xl transition-colors text-sm  -600/10 flex items-center justify-center gap-1.5"
            >
              <Award className="w-4.5 h-4.5" />
              تأكيد التسليم وحفظ الاسم
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-sans font-medium rounded-2xl transition-colors text-sm"
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
