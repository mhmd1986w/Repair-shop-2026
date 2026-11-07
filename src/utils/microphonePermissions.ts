// Utility to check, request, and manage microphone permissions for voice dictation

export interface MicPermissionResult {
  granted: boolean;
  state: 'granted' | 'denied' | 'prompt' | 'unsupported';
  error?: string;
}

export const isSpeechRecognitionSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
};

export const checkMicrophonePermission = async (): Promise<MicPermissionResult> => {
  if (typeof window === 'undefined' || !navigator) {
    return { granted: false, state: 'unsupported', error: 'بيئة غير مدعومة' };
  }

  // 1. Try Permissions API if available
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as any });
      const state = permissionStatus.state as 'granted' | 'denied' | 'prompt';
      return {
        granted: state === 'granted',
        state,
      };
    }
  } catch (err) {
    // Permissions API for 'microphone' might not be implemented in all browsers
  }

  // Fallback to checking localStorage cache
  const cached = localStorage.getItem('techno_mic_permission_granted');
  if (cached === 'true') {
    return { granted: true, state: 'granted' };
  }

  return { granted: false, state: 'prompt' };
};

export const requestMicrophonePermission = async (): Promise<MicPermissionResult> => {
  if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      granted: false,
      state: 'unsupported',
      error: 'متصفحك لا يدعم طلب صلاحيات المايكروفون. يرجى استخدام متصفح حديث مثل Chrome.'
    };
  }

  try {
    // Request an audio stream to trigger native browser permission prompt
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    });

    // Permission granted! Immediately stop all tracks to avoid keeping the mic on
    stream.getTracks().forEach(track => {
      try {
        track.stop();
      } catch (e) {
        // ignore
      }
    });

    localStorage.setItem('techno_mic_permission_granted', 'true');

    return {
      granted: true,
      state: 'granted'
    };
  } catch (err: any) {
    console.error('Microphone permission request error:', err);
    localStorage.removeItem('techno_mic_permission_granted');

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return {
        granted: false,
        state: 'denied',
        error: 'تم رفض إذن المايكروفون. يرجى الضغط على أيقونة القفل أو الإعدادات بجانب شريط العنوان في المتصفح وتفعيل "الميكروفون".'
      };
    }

    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return {
        granted: false,
        state: 'unsupported',
        error: 'لم يتم العثور على مايكروفون موصول بجهازك.'
      };
    }

    return {
      granted: false,
      state: 'denied',
      error: err.message || 'تعذر الحصول على صلاحية المايكروفون.'
    };
  }
};
