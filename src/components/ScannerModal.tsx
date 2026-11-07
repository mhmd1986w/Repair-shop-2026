import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

interface ScannerModalProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isComponentMounted = useRef(true);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    isComponentMounted.current = true;
    let html5QrCode: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        const readerElement = document.getElementById("reader");
        if (readerElement) {
          readerElement.innerHTML = ''; // Clear any existing video elements
        }
        
        html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            if (scannerRef.current && scannerRef.current.isScanning) {
              scannerRef.current.stop().then(() => {
                onScan(decodedText);
              }).catch((err) => {
                console.error("Failed to stop scanner", err);
                onScan(decodedText);
              });
            } else {
              onScan(decodedText);
            }
          },
          (errorMessage) => {
            // parse error, ignore
          }
        );
      } catch (err) {
        console.error("Failed to start scanner", err);
        if (isComponentMounted.current) {
          setError("تعذر فتح الكاميرا. الرجاء التحقق من الصلاحيات والتأكد من عدم استخدامها في تطبيق آخر.");
        }
      }
    };

    const timer = setTimeout(() => {
      if (isComponentMounted.current) {
        startScanner();
      }
    }, 150);

    return () => {
      isComponentMounted.current = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(console.error);
          } else {
            scannerRef.current.clear();
          }
        } catch(e) {
          console.error(e);
        }
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-transparent z-[9999] flex items-start pt-1 sm:pt-2 overflow-y-auto justify-center p-2">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-200 animate-in slide-in-from-top-2 duration-150 mb-4">
        <div className="bg-gray-900 px-4 py-3 flex justify-between items-center text-white">
          <h3 className="font-sans font-bold flex items-center gap-2">
            <Camera className="w-5 h-5" /> مسح الباركود
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 bg-black relative min-h-[300px] flex items-center justify-center">
          {error ? (
            <div className="text-rose-500 font-sans p-4 text-center text-sm font-bold bg-rose-500/10 rounded-xl">
              {error}
            </div>
          ) : (
            <div id="reader" className="w-full text-white [&>video]:w-full [&>video]:object-cover [&>video]:rounded-xl"></div>
          )}
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500 font-sans font-medium">
            قم بتوجيه الكاميرا نحو الباركود أو رمز QR
          </p>
        </div>
      </div>
    </div>
  );
};
