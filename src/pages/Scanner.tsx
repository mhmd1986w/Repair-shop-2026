import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { db } from '../db';
import { Camera, AlertCircle } from 'lucide-react';

export function Scanner() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // We run this inside useEffect to only instantiate when mounted
    let scanner: Html5QrcodeScanner;

    const onScanSuccess = async (decodedText: string, decodedResult: any) => {
      // Clear scanner to avoid multiple reads
      if (scanner) {
        scanner.clear().catch(console.error);
      }
      
      try {
        // Check if this text is a valid ticket ID
        const ticket = await db.tickets.get(decodedText);
        if (ticket) {
          navigate(`/ticket/${ticket.id}`);
        } else {
          setError(`لم يتم العثور على تذكرة بهذا الرمز: ${decodedText}`);
          // Restart scanner after short delay if needed, but for now let's just let them click back
        }
      } catch (err) {
        console.error("DB error on scan", err);
        setError("حدث خطأ أثناء البحث في قاعدة البيانات");
      }
    };

    const onScanFailure = (error: any) => {
      // Typically just noise as it continuously scans empty frames
      // console.warn(`Code scan error = ${error}`);
    };

    // Initialize scanner
    // id "reader" matches the div below
    scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      /* verbose= */ false
    );
    
    scanner.render(onScanSuccess, onScanFailure);

    // Cleanup function
    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [navigate]);

  return (
    <div className="flex flex-col h-full bg-black rounded-xl overflow-hidden relative">
      {/* Header overlay */}
      <div className="absolute top-0 w-full p-4 z-10 bg-gradient-to-b from-black/70 to-transparent flex items-center justify-center text-white">
        <Camera className="mr-2" />
        <h2 className="font-bold">وجّه الكاميرا نحو الباركود</h2>
      </div>

      <div className="flex-1 flex flex-col justify-center bg-black">
        <div id="reader" className="w-full text-white" />
      </div>

      {error && (
        <div className="absolute bottom-4 left-4 right-4 bg-red-500 text-white p-4 rounded-xl shadow-lg flex items-start gap-3">
          <AlertCircle className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold">خطأ</h3>
            <p className="text-sm opacity-90">{error}</p>
          </div>
          <button 
            onClick={() => {
              setError(null);
              // Simple reload to reset scanner without complex state management for this MVP
              window.location.reload(); 
            }}
            className="bg-white/20 px-3 py-1 rounded-lg text-sm"
          >
            إعادة
          </button>
        </div>
      )}
    </div>
  );
}
