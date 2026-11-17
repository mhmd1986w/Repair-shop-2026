import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { db } from '../db';
import { Camera, AlertCircle, ImagePlus, Search } from 'lucide-react';
import { extractScannedBarcodeId } from '../utils/barcode';
import { decodeCanvasBarcode, decodeImageFileBarcode, playScanSuccessFeedback } from '../utils/barcodeScanner';

export function Scanner() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const [manualCode, setManualCode] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasScannedRef = useRef(false);

  const handleDetected = async (decodedText: string) => {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;
    playScanSuccessFeedback();
    const cleanId = extractScannedBarcodeId(decodedText) || decodedText.trim();
    try {
      const ticket =
        (await db.tickets.get(cleanId)) ||
        (await db.tickets.get(decodedText.trim()));
      if (ticket) {
        navigate(`/ticket/${ticket.id}`);
      } else {
        hasScannedRef.current = false;
        setError(`لم يتم العثور على تذكرة بهذا الرمز: ${cleanId}`);
      }
    } catch (err) {
      console.error('DB error on scan', err);
      hasScannedRef.current = false;
      setError('حدث خطأ أثناء البحث في قاعدة البيانات');
    }
  };

  useEffect(() => {
    hasScannedRef.current = false;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timerId: number | null = null;
    const workCanvas = document.createElement('canvas');

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('المتصفح لا يدعم تشغيل الكاميرا.');
        return;
      }

      try {
        stream = await navigator.mediaDevices
          .getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          })
          .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        let tick = 0;
        const scanTick = async () => {
          if (cancelled || hasScannedRef.current) return;
          const v = videoRef.current;
          if (!v || v.readyState < 2 || !v.videoWidth || !v.videoHeight) {
            timerId = window.setTimeout(scanTick, 120);
            return;
          }

          tick++;
          const vw = v.videoWidth;
          const vh = v.videoHeight;
          const useCenterRoi = tick % 3 === 1;
          const sx = useCenterRoi ? Math.floor(vw * 0.05) : 0;
          const sy = useCenterRoi ? Math.floor(vh * 0.22) : 0;
          const sw = useCenterRoi ? Math.floor(vw * 0.9) : vw;
          const sh = useCenterRoi ? Math.floor(vh * 0.56) : vh;

          if (workCanvas.width !== sw) workCanvas.width = sw;
          if (workCanvas.height !== sh) workCanvas.height = sh;
          const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
            const res = await decodeCanvasBarcode(workCanvas, {
              try90DegRotation: tick % 3 === 0,
              tryHighContrast: tick % 4 === 0,
              tryInverted: tick % 5 === 0,
              tryStripBands: tick % 6 === 0,
              useNativeDetector: true,
            });
            if (res && !cancelled) {
              await handleDetected(res);
              return;
            }
          }

          if (!cancelled && !hasScannedRef.current) {
            timerId = window.setTimeout(scanTick, 85);
          }
        };

        timerId = window.setTimeout(scanTick, 160);
      } catch (err) {
        console.error('Camera start failed:', err);
        if (!cancelled) {
          setError('تعذر الوصول إلى الكاميرا. تأكد من منح الصلاحية.');
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [navigate, restartKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const res = await decodeImageFileBarcode(file);
    if (res) {
      await handleDetected(res);
    } else {
      setError('تعذر قراءة الباركود من هذه الصورة.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-black rounded-xl overflow-hidden relative" dir="rtl">
      <div className="absolute top-0 w-full p-4 z-10 bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-teal-400" />
          <h2 className="font-bold text-sm">وجّه الكاميرا نحو الباركود</h2>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <ImagePlus className="w-4 h-4" />
          <span>من صورة</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
      </div>

      <div className="flex-1 flex items-center justify-center bg-black relative">
        <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-contain" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[82%] h-[48%] border-2 border-teal-400/75 rounded-2xl flex items-center justify-center">
            <div className="w-[90%] h-[1.5px] bg-teal-400/70" />
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manualCode.trim()) handleDetected(manualCode);
        }}
        className="p-3 bg-gray-900 border-t border-gray-800 flex items-center gap-2"
      >
        <input
          type="text"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="أو أدخل رقم الباركود / امسح بـ USB..."
          dir="ltr"
          className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-xl px-3 py-2 text-xs font-mono"
        />
        <button type="submit" className="px-3.5 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold flex items-center gap-1">
          <Search className="w-3.5 h-3.5" />
          <span>بحث</span>
        </button>
      </form>

      {error && (
        <div className="absolute bottom-16 left-4 right-4 bg-red-600 text-white p-4 rounded-xl shadow-lg flex items-start gap-3">
          <AlertCircle className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-sm">تنبيه</h3>
            <p className="text-xs opacity-95">{error}</p>
          </div>
          <button
            onClick={() => {
              setError(null);
              setRestartKey((k) => k + 1);
            }}
            className="bg-white/20 px-3 py-1 rounded-lg text-xs font-bold"
          >
            إعادة
          </button>
        </div>
      )}
    </div>
  );
}
