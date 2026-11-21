import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Camera,
  ImagePlus,
  Search,
  RefreshCw,
  Flashlight,
  Keyboard,
  UserCheck,
  UserPlus,
  Smartphone,
  Package,
  Copy,
  Check,
  Barcode as BarcodeIcon,
  Plus,
  Link2,
  ClipboardPaste,
  RotateCcw,
  Wrench,
  ZoomIn,
  QrCode,
} from 'lucide-react';
import { CustomerProfile, DeviceStatus, MaintenanceOrder } from '../types';
import { QRCodeGenerator } from './QRCodeGenerator';
import { extractScannedBarcodeId } from '../utils/barcode';
import {
  decodeCanvasBarcode,
  decodeImageFileBarcode,
  playScanSuccessFeedback,
} from '../utils/barcodeScanner';
import {
  buildCustomerQrPayload,
  resolveScannedBarcodeTarget,
  resolveScannedOrderId,
  ScannedBarcodeResolution,
} from '../utils/customerBarcode';

interface ScannerModalProps {
  onScan: (result: string) => void;
  onClose: () => void;
  customers?: CustomerProfile[];
  orders?: MaintenanceOrder[];
  onOpenCustomerProfile?: (customer: CustomerProfile) => void;
  onSelectOrder?: (order: MaintenanceOrder) => void;
  onNewOrderForCustomer?: (customer: CustomerProfile) => void;
  onAssignBarcodeToCustomer?: (customerId: string, barcode: string) => Promise<void> | void;
  onRegisterCustomerWithBarcode?: (name: string, phone: string, barcode: string) => Promise<CustomerProfile | void> | void;
}

type InputMode = 'camera' | 'image' | 'usb';

export const ScannerModal: React.FC<ScannerModalProps> = ({
  onScan,
  onClose,
  customers,
  orders,
  onOpenCustomerProfile,
  onSelectOrder,
  onNewOrderForCustomer,
  onAssignBarcodeToCustomer,
  onRegisterCustomerWithBarcode,
}) => {
  const enableResolution = Boolean(customers || orders);

  const [inputMode, setInputMode] = useState<InputMode>('camera');
  const [error, setError] = useState<string | null>(null);
  const [scanHint, setScanHint] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [cameras, setCameras] = useState<{ deviceId: string; label: string }[]>([]);
  const [activeCameraIdx, setActiveCameraIdx] = useState<number>(0);
  const [restartCounter, setRestartCounter] = useState<number>(0);
  const [isScanningFile, setIsScanningFile] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoomVal, setZoomVal] = useState<number>(1);

  const [resolution, setResolution] = useState<ScannedBarcodeResolution | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [autoOpenCustomerProfile, setAutoOpenCustomerProfile] = useState<boolean>(() => {
    try {
      return localStorage.getItem('scanner_auto_open_customer_qr') !== 'false';
    } catch {
      return true;
    }
  });
  const autoOpenRef = useRef(autoOpenCustomerProfile);
  autoOpenRef.current = autoOpenCustomerProfile;

  // Unmatched barcode linking states
  const [linkMode, setLinkMode] = useState<'none' | 'existing' | 'new'>('none');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [selectedLinkCustomerId, setSelectedLinkCustomerId] = useState('');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const hasLockedRef = useRef(false);
  const lastUnmatchedRef = useRef<{ raw: string; at: number }>({ raw: '', at: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usbInputRef = useRef<HTMLInputElement>(null);

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const customersRef = useRef(customers);
  customersRef.current = customers;

  const stopCameraStream = useCallback(() => {
    if (loopTimerRef.current !== null) {
      window.clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
    setZoomRange(null);
  }, []);

  const handleDetectedCode = useCallback(
    (decodedText: string) => {
      if (hasLockedRef.current) return;
      const rawText = (decodedText || '').trim();
      if (!rawText) return;

      const resolvedOrderId = resolveScannedOrderId(
        rawText,
        ordersRef.current || [],
        customersRef.current || []
      );

      if (!resolvedOrderId) {
        const now = Date.now();
        if (
          lastUnmatchedRef.current.raw !== rawText ||
          now - lastUnmatchedRef.current.at > 1500
        ) {
          lastUnmatchedRef.current = { raw: rawText, at: now };
          setScanHint('لم يتم العثور على رقم طلب مطابق لهذا الرمز في السجلات.');
        }
        return;
      }

      hasLockedRef.current = true;
      setScanHint(null);
      playScanSuccessFeedback();
      stopCameraStream();
      onScanRef.current(resolvedOrderId);
    },
    [stopCameraStream]
  );

  // Re-evaluate resolution dynamically if customers or orders update while card is open
  useEffect(() => {
    if (!resolution || !enableResolution) return;
    const updated = resolveScannedBarcodeTarget(
      resolution.normalizedCode,
      customers || [],
      orders || []
    );
    setResolution(updated);
  }, [customers, orders]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForNextScan = useCallback(() => {
    hasLockedRef.current = false;
    setResolution(null);
    setScanHint(null);
    setLinkMode('none');
    setManualCode('');
    if (inputMode === 'camera') {
      setRestartCounter((c) => c + 1);
    } else if (inputMode === 'usb') {
      setTimeout(() => usbInputRef.current?.focus(), 60);
    }
  }, [inputMode]);

  // Camera live stream & high-resolution decoding loop
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    isMountedRef.current = true;

    if (inputMode !== 'camera' || resolution) {
      stopCameraStream();
      return;
    }

    hasLockedRef.current = false;
    let cancelled = false;

    const getCanvas = (w: number, h: number): HTMLCanvasElement => {
      if (!workCanvasRef.current) {
        workCanvasRef.current = document.createElement('canvas');
      }
      const c = workCanvasRef.current;
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      return c;
    };

    const startCameraAndLoop = async () => {
      stopCameraStream();
      setError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMountedRef.current) {
          setError('المتصفح لا يدعم الوصول المباشر للكاميرا. يمكنك استخدام تبويب "من صورة" أو "قارئ USB".');
        }
        return;
      }

      try {
        const selectedCamera = cameras[activeCameraIdx];
        const constraintAttempts: MediaStreamConstraints[] = selectedCamera?.deviceId
          ? [
              {
                video: {
                  deviceId: { exact: selectedCamera.deviceId },
                  width: { ideal: 1920 },
                  height: { ideal: 1080 },
                },
                audio: false,
              },
              { video: { deviceId: { exact: selectedCamera.deviceId } }, audio: false },
            ]
          : [
              {
                video: {
                  facingMode: { ideal: 'environment' },
                  width: { ideal: 1920 },
                  height: { ideal: 1080 },
                },
                audio: false,
              },
              {
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
              },
              { video: true, audio: false },
            ];

        let stream: MediaStream | null = null;
        let lastErr: unknown = null;
        for (const constraints of constraintAttempts) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (stream) break;
          } catch (err) {
            lastErr = err;
          }
        }

        if (!stream) {
          throw lastErr || new Error('No camera stream available');
        }

        if (cancelled || !isMountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const videoEl = videoRef.current;
        if (!videoEl) return;

        videoEl.srcObject = stream;
        await videoEl.play().catch(() => {});

        const track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
          try {
            const caps: any = track.getCapabilities();
            if (caps?.torch) setTorchSupported(true);
            if (caps?.zoom && typeof caps.zoom.min === 'number' && typeof caps.zoom.max === 'number') {
              setZoomRange({
                min: caps.zoom.min,
                max: Math.min(caps.zoom.max, 4),
                step: caps.zoom.step || 0.1,
              });
              setZoomVal(caps.zoom.min || 1);
            }
            if (Array.isArray(caps?.focusMode) && caps.focusMode.includes('continuous')) {
              await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }).catch(() => {});
            }
          } catch {
            // ignore unsupported hardware capabilities
          }
        }

        if (navigator.mediaDevices.enumerateDevices) {
          navigator.mediaDevices
            .enumerateDevices()
            .then((devices) => {
              if (cancelled || !isMountedRef.current) return;
              const videoInputs = devices
                .filter((d) => d.kind === 'videoinput')
                .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `كاميرا ${i + 1}` }));
              if (videoInputs.length > 0) {
                setCameras((prev) => (prev.length === 0 ? videoInputs : prev));
              }
            })
            .catch(() => {});
        }

        let tick = 0;
        const runDecodeTick = async () => {
          if (cancelled || !isMountedRef.current || hasLockedRef.current) return;
          const v = videoRef.current;
          if (!v || v.readyState < 2 || v.videoWidth === 0 || v.videoHeight === 0) {
            loopTimerRef.current = window.setTimeout(runDecodeTick, 120);
            return;
          }

          tick++;
          const vw = v.videoWidth;
          const vh = v.videoHeight;

          // Cycle between centered 1D strip, wider box, and full frame so both horizontal 1D & QR decode cleanly
          const useCenterStrip = tick % 3 === 1;
          const sx = useCenterStrip ? Math.floor(vw * 0.05) : 0;
          const sy = useCenterStrip ? Math.floor(vh * 0.22) : 0;
          const sw = useCenterStrip ? Math.floor(vw * 0.9) : vw;
          const sh = useCenterStrip ? Math.floor(vh * 0.56) : vh;

          const canvas = getCanvas(sw, sh);
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
            const result = await decodeCanvasBarcode(canvas, {
              try90DegRotation: tick % 3 === 0,
              tryHighContrast: tick % 4 === 0,
              tryInverted: tick % 5 === 0,
              tryStripBands: tick % 6 === 0,
              useNativeDetector: true,
            });
            if (result && !cancelled && !hasLockedRef.current) {
              handleDetectedCode(result);
              if (hasLockedRef.current) return;
            }
          }

          if (!cancelled && isMountedRef.current && !hasLockedRef.current) {
            loopTimerRef.current = window.setTimeout(runDecodeTick, 85);
          }
        };

        loopTimerRef.current = window.setTimeout(runDecodeTick, 160);
      } catch (err) {
        console.error('Failed to start scanner camera', err);
        if (!cancelled && isMountedRef.current) {
          setError('تعذر تشغيل الكاميرا. تأكد من منح صلاحية الكاميرا أو استخدم تبويب "من صورة" أو "قارئ USB".');
        }
      }
    };

    const initTimer = window.setTimeout(() => {
      if (!cancelled && isMountedRef.current) {
        startCameraAndLoop();
      }
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(initTimer);
      stopCameraStream();
    };
  }, [activeCameraIdx, restartCounter, inputMode, resolution, stopCameraStream, handleDetectedCode]);

  // Global USB / Bluetooth HID scanner keystroke capture + Clipboard image Ctrl+V paste
  useEffect(() => {
    let hidBuffer = '';
    let lastKeyTime = 0;
    let flushTimer: number | null = null;

    const flushHidBuffer = () => {
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer);
        flushTimer = null;
      }
      const scanned = hidBuffer.trim();
      hidBuffer = '';
      if (scanned.length >= 4) {
        handleDetectedCode(scanned);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      const activeTag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      const now = Date.now();
      if (now - lastKeyTime > 220 && !flushTimer) {
        hidBuffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter' && hidBuffer.length >= 4) {
        e.preventDefault();
        // Multi-line structured QR payloads over USB HID send Enter between lines
        const looksStructured = /[:：]/.test(hidBuffer) && !/^https?:\/\//i.test(hidBuffer.trim());
        if (looksStructured) {
          hidBuffer += '\n';
          if (flushTimer !== null) window.clearTimeout(flushTimer);
          flushTimer = window.setTimeout(flushHidBuffer, 180);
        } else {
          flushHidBuffer();
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        hidBuffer += e.key;
        if (flushTimer !== null) {
          window.clearTimeout(flushTimer);
          flushTimer = window.setTimeout(flushHidBuffer, 180);
        }
      }
    };

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            await processImageBlob(blob);
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    return () => {
      if (flushTimer !== null) window.clearTimeout(flushTimer);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, [handleDetectedCode, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const processImageBlob = async (blob: Blob) => {
    setScanHint(null);
    setIsScanningFile(true);
    try {
      stopCameraStream();
      const decoded = await decodeImageFileBarcode(blob);
      if (decoded) {
        handleDetectedCode(decoded);
        if (hasLockedRef.current) return;
        if (inputMode === 'camera') setRestartCounter((c) => c + 1);
        return;
      }
      setScanHint('تعذر قراءة الباركود من هذه الصورة. تأكد من وضوح الخطوط ووجود فراغ أبيض حول الأطراف ثم أعد المحاولة.');
      if (inputMode === 'camera') setRestartCounter((c) => c + 1);
    } catch (err) {
      console.error('Image scan error:', err);
      setScanHint('تعذر تحليل الصورة. جرب صورة أخرى أكثر وضوحاً.');
      if (inputMode === 'camera') setRestartCounter((c) => c + 1);
    } finally {
      if (isMountedRef.current) setIsScanningFile(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await processImageBlob(file);
  };

  const handlePasteFromClipboardButton = async () => {
    try {
      if (!navigator.clipboard?.read) {
        setScanHint('يمكنك لصق الصورة مباشرة بالضغط على Ctrl+V.');
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find((t) => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          await processImageBlob(blob);
          return;
        }
      }
      setScanHint('لا توجد صورة منسوخة في الحافظة حالياً.');
    } catch {
      setScanHint('اضغط Ctrl+V مباشرة للصق لقطة الباركود، أو اختر ملف صورة.');
    }
  };

  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch {
      setScanHint('الإضاءة الخلفية غير مدعومة على هذه الكاميرا.');
    }
  };

  const handleZoomChange = async (newZoom: number) => {
    setZoomVal(newZoom);
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: newZoom } as any] });
    } catch {
      // ignore unsupported zoom constraint
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawInput = manualCode.trim();
    if (!rawInput) {
      setScanHint('يرجى إدخال أو مسح رقم طلب صحيح.');
      return;
    }
    handleDetectedCode(rawInput);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // ignore
    }
  };

  const filteredCustomersForLink = useMemo(() => {
    const list = customers || [];
    const q = customerSearchQuery.trim().toLowerCase();
    if (!q) return list.slice(0, 20);
    return list
      .filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.phone || '').includes(q) ||
          (c.customerBarcode || '').toLowerCase().includes(q)
      )
      .slice(0, 25);
  }, [customers, customerSearchQuery]);

  const handleLinkToExistingCustomer = async () => {
    if (!resolution?.normalizedCode || !selectedLinkCustomerId || !onAssignBarcodeToCustomer) return;
    setIsLinking(true);
    setScanHint(null);
    try {
      await onAssignBarcodeToCustomer(selectedLinkCustomerId, resolution.normalizedCode);
      setLinkMode('none');
    } catch (err: any) {
      setScanHint(err?.message || 'تعذر ربط الباركود بالزبون المختار.');
    } finally {
      setIsLinking(false);
    }
  };

  const handleRegisterNewCustomerWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolution?.normalizedCode || !newCustName.trim() || !onRegisterCustomerWithBarcode) return;
    setIsLinking(true);
    setScanHint(null);
    try {
      await onRegisterCustomerWithBarcode(
        newCustName.trim(),
        newCustPhone.trim(),
        resolution.normalizedCode
      );
      setLinkMode('none');
    } catch (err: any) {
      setScanHint(err?.message || 'تعذر حفظ الزبون وربطه بالباركود.');
    } finally {
      setIsLinking(false);
    }
  };

  const getStatusLabel = (status: DeviceStatus) => {
    switch (status) {
      case DeviceStatus.RECEIVED: return 'تم الاستلام';
      case DeviceStatus.DIAGNOSING: return 'تحت الفحص';
      case DeviceStatus.REPAIRING: return 'تحت الإصلاح';
      case DeviceStatus.PENDING: return 'قيد الانتظار';
      case DeviceStatus.READY: return 'جاهز للتسليم';
      case DeviceStatus.DELIVERED: return 'تم التسليم';
      case DeviceStatus.UNREPAIRABLE: return 'غير قابل للإصلاح';
      default: return status;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/55 backdrop-blur-xs z-[9999] flex items-start pt-2 sm:pt-5 overflow-y-auto justify-center p-2"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-200 animate-in slide-in-from-top-2 duration-150 mb-4"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="bg-gray-900 px-4 py-3 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="font-sans font-bold text-sm leading-tight">قارئ QR لرقم الطلب</h3>
              <p className="text-[10px] text-gray-400 font-sans">مسح QR لإدخال رقم الطلب مباشرة · كاميرا · صورة · USB</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {inputMode === 'camera' && !resolution && torchSupported && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                  torchOn ? 'bg-amber-400 text-gray-950' : 'hover:bg-white/10 text-amber-300'
                }`}
                title="تشغيل/إطفاء الفلاش"
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}
            {inputMode === 'camera' && !resolution && cameras.length > 1 && (
              <button
                type="button"
                onClick={() => setActiveCameraIdx((prev) => (prev + 1) % cameras.length)}
                className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-teal-300 cursor-pointer"
                title="تبديل الكاميرا"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Switcher Tabs (only when scanning, hidden while viewing locked result) */}
        {!resolution && (
          <>
            <div className="grid grid-cols-3 gap-1.5 p-2.5 bg-gray-100 border-b border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setInputMode('camera');
                  setScanHint(null);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  inputMode === 'camera'
                    ? 'bg-white text-teal-800 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:bg-white/60'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>الكاميرا</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputMode('image');
                  setScanHint(null);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  inputMode === 'image'
                    ? 'bg-white text-teal-800 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:bg-white/60'
                }`}
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>صورة / لصق</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputMode('usb');
                  setScanHint(null);
                  setTimeout(() => usbInputRef.current?.focus(), 60);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  inputMode === 'usb'
                    ? 'bg-white text-teal-800 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:bg-white/60'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>USB / يدوي</span>
              </button>
            </div>
          </>
        )}

        {/* Body Area */}
        {resolution ? (
          <div className="p-4 sm:p-5 bg-white space-y-4">
            {/* Decoded Barcode Header */}
            <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-gray-500 block">
                  {resolution.matchType === 'customer_barcode'
                    ? 'تم التعرف على QR معلومات الزبون'
                    : resolution.matchType === 'order_barcode'
                      ? 'تم التعرف على باركود طلب الصيانة'
                      : resolution.matchType === 'serial_number'
                        ? 'تم التعرف على الرقم التسلسلي للجهاز'
                        : resolution.matchType === 'phone'
                          ? 'تم التعرف برقم الهاتف'
                          : 'تم مسح الرمز'}
                </span>
                <div className="font-mono tabular-nums font-black text-base text-gray-900 truncate" dir="ltr">
                  {resolution.normalizedCode}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyCode(resolution.normalizedCode)}
                  className="p-2 rounded-xl bg-white border border-gray-200 hover:border-teal-300 text-gray-600 hover:text-teal-700 transition-colors cursor-pointer"
                  title="نسخ الكود"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={resetForNextScan}
                  className="px-3 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>مسح آخر</span>
                </button>
              </div>
            </div>

            {/* Matched Customer Card */}
            {resolution.customer && (
              <div className="p-4 rounded-2xl border border-teal-200 bg-teal-50/50 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1 bg-white rounded-xl border border-teal-200 shrink-0">
                      <QRCodeGenerator
                        value={
                          buildCustomerQrPayload({
                            customer: resolution.customer,
                            orders: resolution.customerOrders,
                            maxLength: 550,
                          }) || resolution.matchedOrder?.id || resolution.customer.phone || resolution.customer.name
                        }
                        mode="auto"
                        compact
                        size={56}
                        marginModules={1}
                        errorCorrectionLevel="L"
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-gray-900 truncate">
                        {resolution.customer.name}
                      </h4>
                      <div className="text-xs text-gray-600 font-mono tabular-nums flex items-center gap-2 mt-0.5 flex-wrap">
                        <span dir="ltr">{resolution.customer.phone || 'بدون هاتف'}</span>
                        {resolution.matchedOrder?.id && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="text-teal-800 font-bold" dir="ltr">
                              {resolution.matchedOrder.id}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <span className="text-[10px] font-bold text-teal-700 block">الأجهزة المسجلة</span>
                    <span className="font-mono tabular-nums font-black text-base text-teal-900">
                      {resolution.customerOrders.length}
                    </span>
                  </div>
                </div>

                {/* Matched Order Highlight if Order/Serial */}
                {resolution.matchedOrder && (
                  <div className="p-3 bg-white rounded-xl border border-teal-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-gray-900 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-teal-600" />
                        <span>{resolution.matchedOrder.deviceType} · {resolution.matchedOrder.brandModel}</span>
                      </span>
                      <span className="font-mono text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                        {resolution.matchedOrder.id}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span className="truncate max-w-[65%]">{resolution.matchedOrder.faultDescription}</span>
                      <span className="font-bold text-gray-700">{getStatusLabel(resolution.matchedOrder.status)}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {onOpenCustomerProfile && (
                    <button
                      type="button"
                      onClick={() => onOpenCustomerProfile(resolution.customer!)}
                      className="py-2.5 px-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>فتح ملف الزبون وأجهزته</span>
                    </button>
                  )}

                  {resolution.matchedOrder && onSelectOrder ? (
                    <button
                      type="button"
                      onClick={() => onSelectOrder(resolution.matchedOrder!)}
                      className="py-2.5 px-3 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Wrench className="w-4 h-4 text-teal-700" />
                      <span>فتح طلب الصيانة ({resolution.matchedOrder.id})</span>
                    </button>
                  ) : (
                    onNewOrderForCustomer && (
                      <button
                        type="button"
                        onClick={() => onNewOrderForCustomer(resolution.customer!)}
                        className="py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>طلب صيانة جديد للزبون</span>
                      </button>
                    )
                  )}
                </div>

                {resolution.matchedOrder && onNewOrderForCustomer && (
                  <button
                    type="button"
                    onClick={() => onNewOrderForCustomer(resolution.customer!)}
                    className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>تسجيل جهاز جديد لنفس الزبون</span>
                  </button>
                )}
              </div>
            )}

            {/* Matched Order WITHOUT Customer record (edge safety) */}
            {!resolution.customer && resolution.matchedOrder && (
              <div className="p-4 rounded-2xl border border-teal-200 bg-teal-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">{resolution.matchedOrder.customerName}</h4>
                    <p className="text-xs text-gray-600 font-mono">{resolution.matchedOrder.customerPhone}</p>
                  </div>
                  <span className="font-mono text-xs font-bold text-teal-800">{resolution.matchedOrder.id}</span>
                </div>
                {onSelectOrder && (
                  <button
                    type="button"
                    onClick={() => onSelectOrder(resolution.matchedOrder!)}
                    className="w-full py-2.5 px-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    فتح تفاصيل الطلب
                  </button>
                )}
              </div>
            )}

            {/* Unregistered Barcode -> Instant Linking Workflow */}
            {resolution.matchType === 'not_found' && (
              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-3">
                <div className="text-xs text-amber-900 font-bold">
                  هذا الباركود غير مرتبط بأي زبون أو طلب صيانة حتى الآن.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {onAssignBarcodeToCustomer && (customers?.length || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setLinkMode(linkMode === 'existing' ? 'none' : 'existing')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer transition-colors ${
                        linkMode === 'existing'
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-white text-teal-800 border-teal-200 hover:bg-teal-50'
                      }`}
                    >
                      <Link2 className="w-4 h-4" />
                      <span>ربط بزبون حالي</span>
                    </button>
                  )}

                  {onRegisterCustomerWithBarcode && (
                    <button
                      type="button"
                      onClick={() => setLinkMode(linkMode === 'new' ? 'none' : 'new')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer transition-colors ${
                        linkMode === 'new'
                          ? 'bg-indigo-700 text-white border-indigo-700'
                          : 'bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-50'
                      }`}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>تسجيل زبون جديد</span>
                    </button>
                  )}
                </div>

                {linkMode === 'existing' && (
                  <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2.5">
                    <input
                      type="text"
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      placeholder="ابحث باسم الزبون أو رقمه..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {filteredCustomersForLink.map((c) => {
                        const isChosen = selectedLinkCustomerId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedLinkCustomerId(c.id)}
                            className={`w-full text-right p-2 rounded-lg text-xs flex items-center justify-between border cursor-pointer transition-colors ${
                              isChosen
                                ? 'bg-teal-50 border-teal-400 text-teal-900 font-bold'
                                : 'bg-gray-50/70 border-gray-100 hover:bg-gray-100'
                            }`}
                          >
                            <span>{c.name}</span>
                            <span className="font-mono text-[11px] text-gray-500" dir="ltr">
                              {c.phone || 'بدون هاتف'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      disabled={!selectedLinkCustomerId || isLinking}
                      onClick={handleLinkToExistingCustomer}
                      className="w-full py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      {isLinking ? 'جاري الربط...' : 'تأكيد ربط الباركود بالزبون المختار'}
                    </button>
                  </div>
                )}

                {linkMode === 'new' && (
                  <form onSubmit={handleRegisterNewCustomerWithCode} className="p-3 bg-white rounded-xl border border-gray-200 space-y-2.5">
                    <input
                      type="text"
                      required
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      placeholder="اسم الزبون الكامل *"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="tel"
                      dir="ltr"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      placeholder="رقم الهاتف"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-left focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={isLinking || !newCustName.trim()}
                      className="w-full py-2 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      {isLinking ? 'جاري الحفظ...' : `حفظ الزبون وربطه بـ ${resolution.normalizedCode}`}
                    </button>
                  </form>
                )}

                <button
                  type="button"
                  onClick={() => onScanRef.current(resolution.normalizedCode)}
                  className="w-full py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5 text-gray-500" />
                  <span>بحث في الطلبات بهذا الرمز على أي حال</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Camera Mode */}
            {inputMode === 'camera' && (
              <div className="p-3 bg-black relative min-h-[270px] flex flex-col items-center justify-center overflow-hidden">
                {error ? (
                  <div className="text-rose-200 font-sans p-4 text-center text-xs font-bold bg-rose-950/70 border border-rose-500/30 rounded-2xl leading-relaxed space-y-2.5">
                    <p>{error}</p>
                    <button
                      type="button"
                      onClick={() => setRestartCounter((c) => c + 1)}
                      className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      إعادة تشغيل الكاميرا
                    </button>
                  </div>
                ) : (
                  <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden flex items-center justify-center">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="w-[86%] h-[54%] border-2 border-teal-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.34)] relative flex items-center justify-center">
                        <div className="w-[92%] h-[1.5px] bg-teal-400/70" />
                        <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-4 border-r-4 border-teal-300 rounded-tr-xl" />
                        <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-4 border-l-4 border-teal-300 rounded-tl-xl" />
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-4 border-r-4 border-teal-300 rounded-br-xl" />
                        <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-4 border-l-4 border-teal-300 rounded-bl-xl" />
                      </div>
                    </div>
                  </div>
                )}

                {zoomRange && zoomRange.max > zoomRange.min && !error && (
                  <div className="w-full px-3 pt-2.5 flex items-center gap-2 text-white text-[11px]">
                    <ZoomIn className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <input
                      type="range"
                      min={zoomRange.min}
                      max={zoomRange.max}
                      step={zoomRange.step}
                      value={zoomVal}
                      onChange={(e) => handleZoomChange(Number(e.target.value))}
                      className="flex-1 accent-teal-400 cursor-pointer"
                    />
                    <span className="font-mono tabular-nums w-8 text-left">{zoomVal.toFixed(1)}x</span>
                  </div>
                )}

                {cameras.length > 1 && !error && (
                  <div className="w-full px-2 pt-2">
                    <select
                      value={activeCameraIdx}
                      onChange={(e) => setActiveCameraIdx(Number(e.target.value))}
                      className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-xl px-3 py-1.5 text-[11px] font-sans focus:outline-none"
                    >
                      {cameras.map((cam, idx) => (
                        <option key={cam.deviceId || idx} value={idx}>
                          {cam.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Image Upload / Drop / Paste Mode */}
            {inputMode === 'image' && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDraggingFile(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) await processImageBlob(file);
                }}
                className={`p-6 bg-gray-50 min-h-[250px] flex flex-col items-center justify-center text-center gap-3 border-2 border-dashed m-3 rounded-2xl transition-colors ${
                  isDraggingFile ? 'border-teal-500 bg-teal-50' : 'border-gray-300'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <ImagePlus className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-gray-800">
                    {isScanningFile ? 'جاري تحليل الباركود في الصورة...' : 'اسحب صورة الباركود هنا أو اخترها من جهازك'}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    يدعم Code128 · Code39 · EAN · QR · صور الشاشة واللصق السريع (Ctrl+V)
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <button
                    type="button"
                    disabled={isScanningFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ImagePlus className="w-4 h-4" />
                    <span>اختيار ملف صورة</span>
                  </button>
                  <button
                    type="button"
                    disabled={isScanningFile}
                    onClick={handlePasteFromClipboardButton}
                    className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ClipboardPaste className="w-4 h-4 text-teal-700" />
                    <span>لصق صورة من الحافظة</span>
                  </button>
                </div>
              </div>
            )}

            {/* USB / Manual Scanner Mode */}
            {inputMode === 'usb' && (
              <div className="p-6 bg-gray-50 min-h-[250px] flex flex-col items-center justify-center text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <Keyboard className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-gray-900">قارئ الباركود السلكي (USB / Bluetooth)</h4>
                  <p className="text-xs text-gray-500 max-w-sm">
                    وجّه جهاز السكانر مباشرة نحو بطاقة الزبون أو ملصق الجهاز — سيتم التعرف على الكود فوراً
                  </p>
                </div>
                <form onSubmit={handleManualSubmit} className="w-full max-w-sm flex items-center gap-2">
                  <input
                    ref={usbInputRef}
                    type="text"
                    value={manualCode}
                    onChange={(e) => {
                      setManualCode(e.target.value);
                      if (scanHint) setScanHint(null);
                    }}
                    placeholder="امسح بـ USB أو اكتب الكود واضغط Enter"
                    dir="ltr"
                    className="flex-1 bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Search className="w-4 h-4" />
                    <span>قراءة</span>
                  </button>
                </form>
              </div>
            )}

            {/* Shared Footer Quick Controls */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-3">
              {scanHint && (
                <div className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
                  {scanHint}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {inputMode !== 'usb' && (
                <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => {
                      setManualCode(e.target.value);
                      if (scanHint) setScanHint(null);
                    }}
                    placeholder="أو اكتب / امسح بـ USB رقم الطلب أو الهاتف..."
                    dir="ltr"
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>بحث</span>
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
