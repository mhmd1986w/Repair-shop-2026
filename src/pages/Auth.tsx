import { useState, useEffect } from 'react';
import { Fingerprint, ShieldAlert, KeyRound } from 'lucide-react';
import { isBiometricsSupported, registerBiometrics, authenticateBiometrics } from '../utils/hardware';

interface AuthProps {
  onAuthenticated: () => void;
}

export function AuthScreen({ onAuthenticated }: AuthProps) {
  const [supported, setSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkSupport();
    setIsRegistered(localStorage.getItem('biometric_enabled') === 'true');
  }, []);

  const checkSupport = async () => {
    const isAvailable = await isBiometricsSupported();
    setSupported(isAvailable);
  };

  const handleRegister = async () => {
    setError('');
    try {
      const success = await registerBiometrics();
      if (success) {
        setIsRegistered(true);
        onAuthenticated();
      } else {
        setError('فشل في تسجيل البصمة، تأكد من إعداد القفل في جهازك.');
      }
    } catch (err: any) {
      if (err.message === 'IFRAME_POLICY') {
        setError('البصمة غير مدعومة أثناء المعاينة. انقر على "تخطي" الآن، أو افتح التطبيق في نافذة مستقلة لتجربتها.');
      } else {
        setError('حدث خطأ أثناء الاتصال بحساس البصمة.');
      }
    }
  };

  const handleLogin = async () => {
    setError('');
    try {
      const success = await authenticateBiometrics();
      if (success) {
        onAuthenticated();
      } else {
        setError('فشلت المصادقة. حاول مرة أخرى.');
      }
    } catch (err: any) {
      if (err.message === 'IFRAME_POLICY') {
        setError('المصادقة مقيدة في نافذة المعاينة. سيتم إدخالك تلقائياً (تخطي).');
        setTimeout(() => onAuthenticated(), 2000);
      } else {
        setError('حدث خطأ أثناء المصادقة.');
      }
    }
  };

  const handleBypass = () => {
    // For development/demo purposes
    onAuthenticated();
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center justify-center p-4 font-sans text-gray-900" dir="rtl">
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm max-w-sm w-full text-center flex flex-col items-center gap-4">
        
        <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center font-bold text-3xl text-white mb-2 shadow-md">
          RP
        </div>
        
        <div>
          <h1 className="text-xl font-bold leading-tight">RepairShop Pro</h1>
          <p className="text-xs text-gray-500 mt-1">نظام إدارة الصيانة الذكي</p>
        </div>

        <div className="w-full h-px bg-gray-100 my-2"></div>

        {!supported ? (
          <div className="text-center w-full">
            <ShieldAlert className="text-orange-500 mx-auto mb-3" size={40} />
            <p className="text-sm font-bold text-gray-800 mb-1">المصادقة الحيوية غير مدعومة</p>
            <p className="text-xs text-gray-500 mb-4">جهازك أو متصفحك لا يدعم قراءة البصمة / الوجه (WebAuthn).</p>
            <button 
              onClick={handleBypass}
              className="w-full bg-gray-800 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-gray-700 transition-colors"
            >
              الدخول كمسؤول (تخطي)
            </button>
          </div>
        ) : (
          <div className="text-center w-full flex flex-col items-center">
            <Fingerprint className="text-blue-600 mb-4" size={56} strokeWidth={1.5} />
            
            {isRegistered ? (
              <div className="w-full space-y-3">
                <p className="text-sm font-bold text-gray-800">مرحباً بعودتك</p>
                <p className="text-xs text-gray-500 mb-2">الرجاء التحقق من هويتك للمتابعة</p>
                <button 
                  onClick={handleLogin}
                  className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Fingerprint size={18} />
                  تسجيل الدخول بالبصمة / الوجه
                </button>
              </div>
            ) : (
              <div className="w-full space-y-3">
                <p className="text-sm font-bold text-gray-800">تأمين النظام</p>
                <p className="text-xs text-gray-500 mb-2">قم بربط بصمتك أو وجهك كمسؤول للنظام لحماية البيانات.</p>
                <button 
                  onClick={handleRegister}
                  className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <KeyRound size={18} />
                  تفعيل المصادقة الحيوية
                </button>
                <button 
                  onClick={handleBypass}
                  className="w-full bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                >
                  تخطي الإعداد الآن
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="w-full bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-100 mt-2">
            {error}
          </div>
        )}
      </div>
      
      <p className="text-[10px] text-gray-400 mt-8 text-center max-w-xs">
        هذا التطبيق يطلب صلاحيات حقيقية من النظام (Native OS Runtime Permissions) لضمان الخصوصية.
      </p>
    </div>
  );
}
