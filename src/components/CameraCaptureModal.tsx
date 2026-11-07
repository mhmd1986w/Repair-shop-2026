import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  FlipHorizontal, 
  X, 
  Check, 
  RotateCcw, 
  Image as ImageIcon, 
  Upload, 
  AlertCircle, 
  Sparkles,
  Layers,
  FileText,
  User
} from 'lucide-react';
import { MaintenancePhoto } from '../types';

export const MAINTENANCE_STAGE_OPTIONS = [
  { value: 'fault_initial', label: 'توثيق العطل الأولي (عند الاستلام)' },
  { value: 'disassembly', label: 'أثناء فك الجهاز وفحص اللوحة' },
  { value: 'fault_close_up', label: 'صورة مقربة لمكان التلف / الاحتراق' },
  { value: 'parts_replacement', label: 'قطع الغيار المستبدلة والجديدة' },
  { value: 'soldering_repair', label: 'أثناء عملية الصيانة واللحام' },
  { value: 'testing_screen', label: 'فحص الشاشة والوظائف بعد التركيب' },
  { value: 'completed_ready', label: 'الجهاز بعد انتهاء الإصلاح والتنظيف' },
  { value: 'other', label: 'ملاحظة أو مرحلة صيانة أخرى' },
];

interface CameraCaptureModalProps {
  orderId?: string;
  customerName?: string;
  deviceModel?: string;
  defaultStage?: string;
  onPhotoCaptured: (photo: MaintenancePhoto) => void;
  onClose: () => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  orderId = '',
  customerName = '',
  deviceModel = '',
  defaultStage = 'fault_initial',
  onPhotoCaptured,
  onClose
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState(defaultStage);
  const [photoNote, setPhotoNote] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [technicianName, setTechnicianName] = useState(() => localStorage.getItem('engineerName') || 'م. محمد وليد');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Instant scroll to top
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Initialize camera stream
  const startCamera = async (mode: 'environment' | 'user') => {
    try {
      setCameraError(null);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // Check support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('المتصفح لا يدعم الوصول للكاميرا المباشرة، يمكنك استخدام خيار رفع الصورة من المعرض بالأسفل.');
        return;
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: any) {
      console.warn("Camera access failed or denied:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('تم رفض صلاحية الوصول للكاميرا. يرجى تفعيل الإذن من المتصفح أو رفع صورة مباشرة.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('لم يتم العثور على كاميرا في هذا الجهاز. يمكنك اختيار صورة من المعرض أو المستندات.');
      } else {
        setCameraError('تعذر تشغيل الكاميرا المباشرة. يمكنك التقاط أو رفع الصورة عبر زر "فتح كاميرا الهاتف / رفع ملف".');
      }
    }
  };

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  // Connect stream to video whenever videoRef becomes available
  useEffect(() => {
    if (videoRef.current && stream && !capturedDataUrl) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, capturedDataUrl]);

  // Toggle front / rear camera
  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Compress image data helper using canvas
  const compressImageDataUrl = (sourceImgOrCanvas: CanvasImageSource, width: number, height: number): string => {
    const maxDimension = 1024;
    let targetWidth = width;
    let targetHeight = height;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        targetWidth = maxDimension;
        targetHeight = Math.round((height * maxDimension) / width);
      } else {
        targetHeight = maxDimension;
        targetWidth = Math.round((width * maxDimension) / height);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(sourceImgOrCanvas, 0, 0, targetWidth, targetHeight);
      return canvas.toDataURL('image/jpeg', 0.8);
    }
    return '';
  };

  // Capture frame from live video
  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const vWidth = video.videoWidth || 640;
      const vHeight = video.videoHeight || 480;

      const compressed = compressImageDataUrl(video, vWidth, vHeight);
      if (compressed) {
        setCapturedDataUrl(compressed);
      }
    } catch (e) {
      console.error("Snapshot failed:", e);
    } finally {
      setIsCapturing(false);
    }
  };

  // Handle file or native phone camera upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        const compressed = compressImageDataUrl(img, img.width, img.height);
        setCapturedDataUrl(compressed || rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedDataUrl(null);
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  };

  // Confirm and save photo
  const handleConfirmSave = () => {
    if (!capturedDataUrl) return;

    const stageObj = MAINTENANCE_STAGE_OPTIONS.find(s => s.value === selectedStage);
    const stageLabel = stageObj ? stageObj.label : 'توثيق صيانة';

    const newPhoto: MaintenancePhoto = {
      id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      url: capturedDataUrl,
      stage: selectedStage,
      stageLabel,
      note: photoNote.trim(),
      timestamp: Date.now(),
      takenBy: technicianName.trim()
    };

    onPhotoCaptured(newPhoto);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center p-2 pt-1 sm:pt-2 overflow-y-auto bg-transparent animate-in fade-in duration-150 font-sans"
      dir="rtl"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden mb-4 animate-in slide-in-from-top-2 duration-150 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 p-5 text-white flex justify-between items-center relative">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 backdrop-blur-md rounded-xl text-teal-200">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">
                توثيق الأعطال ومراحل الصيانة بالكاميرا
              </h3>
              <p className="text-[11px] text-teal-100/90 font-sans mt-0.5">
                {orderId ? `طلب رقم: ${orderId}` : 'التقاط وحفظ صور فحص وإصلاح الجهاز'}
                {deviceModel ? ` • ${deviceModel}` : ''}
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Viewfinder or Preview Area */}
          <div className="relative w-full aspect-4/3 bg-black rounded-2xl overflow-hidden border border-gray-200 shadow-inner flex items-center justify-center">
            {capturedDataUrl ? (
              // Frozen captured photo preview
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <img 
                  src={capturedDataUrl} 
                  alt="توثيق الصيانة" 
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-3 right-3 bg-emerald-600/90 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-md">
                  <Check className="w-3.5 h-3.5" />
                  <span>تم التقاط الصورة</span>
                </div>
              </div>
            ) : cameraError ? (
              // Camera error or fallback prompt
              <div className="p-6 text-center text-gray-300 space-y-3">
                <AlertCircle className="w-10 h-10 mx-auto text-amber-400 opacity-80" />
                <p className="text-xs text-gray-200 font-sans leading-relaxed">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Upload className="w-4 h-4" />
                  <span>التقاط عبر كاميرا الهاتف أو رفع صورة</span>
                </button>
              </div>
            ) : (
              // Live camera stream
              <div className="relative w-full h-full">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Overlaid camera guidelines */}
                <div className="absolute inset-4 border border-white/30 rounded-xl pointer-events-none border-dashed flex items-center justify-center">
                  <div className="w-6 h-6 border-t-2 border-l-2 border-white/60 absolute top-0 left-0 rounded-tl"></div>
                  <div className="w-6 h-6 border-t-2 border-r-2 border-white/60 absolute top-0 right-0 rounded-tr"></div>
                  <div className="w-6 h-6 border-b-2 border-l-2 border-white/60 absolute bottom-0 left-0 rounded-bl"></div>
                  <div className="w-6 h-6 border-b-2 border-r-2 border-white/60 absolute bottom-0 right-0 rounded-br"></div>
                </div>

                {/* Switch camera button */}
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="absolute top-3 left-3 p-2.5 bg-black/50 hover:bg-black/70 backdrop-blur-md text-white rounded-xl transition-all cursor-pointer shadow-md"
                  title="تبديل الكاميرا (أمامية / خلفية)"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Action buttons under viewfinder */}
          <div className="flex items-center justify-between gap-2">
            {!capturedDataUrl ? (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="رفع صورة من الجهاز أو كاميرا النظام"
                >
                  <ImageIcon className="w-4 h-4 text-gray-500" />
                  <span>معرض الصور / ملف</span>
                </button>

                <button
                  type="button"
                  onClick={handleCaptureSnapshot}
                  disabled={isCapturing || !!cameraError}
                  className="flex-1 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-700/20 active:scale-98 transition-all cursor-pointer"
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-white ring-4 ring-white/30 animate-pulse"></div>
                  <span>التقاط الصورة الآن (Snapshot)</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-gray-500" />
                  <span>إعادة الالتقاط</span>
                </button>

                <div className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-3 py-2 rounded-xl flex-1 text-center border border-emerald-100">
                  ✓ تم تجهيز الصورة بنجاح! حدد المرحلة وأضف ملاحظتك بالأسفل
                </div>
              </div>
            )}

            {/* Hidden native file input */}
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              capture="environment"
              onChange={handleFileChange}
              className="hidden" 
            />
          </div>

          {/* Form details: Stage, caption note, technician */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            {/* Stage Selector */}
            <div className="space-y-1.5">
              <label className="block text-gray-700 font-bold text-xs flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-600" />
                <span>مرحلة الصيانة / تصنيف التوثيق:</span>
              </label>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
              >
                {MAINTENANCE_STAGE_OPTIONS.map((st) => (
                  <option key={st.value} value={st.value}>{st.label}</option>
                ))}
              </select>
            </div>

            {/* Caption / Note */}
            <div className="space-y-1.5">
              <label className="block text-gray-700 font-bold text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                <span>ملاحظة أو وصف توضيحي على الصورة (اختياري):</span>
              </label>
              <textarea
                value={photoNote}
                onChange={(e) => setPhotoNote(e.target.value)}
                rows={2}
                placeholder="مثال: أثر كسر في زاوية الشاشة، أو فحص الميكروسكوب يوضح حرق في آي سي الإمداد..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white resize-none"
              />
            </div>

            {/* Technician */}
            <div className="space-y-1.5">
              <label className="block text-gray-700 font-bold text-xs flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-600" />
                <span>اسم الفني الموثّق:</span>
              </label>
              <input
                type="text"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="اسم الفني أو المهندس"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Confirm & Save Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={!capturedDataUrl}
              onClick={handleConfirmSave}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-2xl transition-all shadow-lg shadow-emerald-700/15 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>حفظ وتثبيت صورة التوثيق في سجل الجهاز</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
