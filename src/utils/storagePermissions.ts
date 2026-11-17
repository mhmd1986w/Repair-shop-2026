import { isRunningInIframe } from './fileSaver';

export interface AllFilesPermissionStatus {
  granted: boolean;
  source: 'android_native' | 'directory_picker' | 'persistent_storage' | 'browser_default';
  state: 'granted' | 'prompt' | 'denied' | 'unsupported';
  message: string;
  directoryName?: string;
}

interface NativeAndroidStorageBridge {
  isNativeAndroid?: () => boolean;
  hasAllFilesAccess?: () => boolean;
  requestAllFilesAccess?: () => boolean | void;
}

const STORAGE_DIR_GRANTED_KEY = 'techno_storage_directory_name';
const STORAGE_PERSIST_GRANTED_KEY = 'techno_storage_persist_granted';

function getAndroidBridge(): NativeAndroidStorageBridge | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.AndroidStorageBridge || w.AndroidBridge || null;
}

export function isNativeAndroidStorageBridgeAvailable(): boolean {
  const bridge = getAndroidBridge();
  return !!(
    bridge &&
    (typeof bridge.requestAllFilesAccess === 'function' ||
      typeof bridge.hasAllFilesAccess === 'function')
  );
}

export async function checkAllFilesAccessPermission(): Promise<AllFilesPermissionStatus> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      granted: false,
      source: 'browser_default',
      state: 'unsupported',
      message: 'البيئة الحالية لا تدعم فحص صلاحيات التخزين.'
    };
  }

  // 1. Native Android WebView bridge (MANAGE_EXTERNAL_STORAGE)
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.hasAllFilesAccess === 'function') {
    try {
      const granted = Boolean(bridge.hasAllFilesAccess());
      return {
        granted,
        source: 'android_native',
        state: granted ? 'granted' : 'prompt',
        message: granted
          ? 'صلاحية الوصول إلى جميع الملفات مفعّلة على جهاز Android.'
          : 'صلاحية الوصول إلى جميع الملفات غير مفعّلة بعد. اضغط لطلب الإذن من إعدادات Android.'
      };
    } catch (err) {
      console.warn('AndroidStorageBridge.hasAllFilesAccess failed:', err);
    }
  }

  // 2. Check File System Access / saved directory grant or Persistent Storage on Web/PWA
  const savedDirName = localStorage.getItem(STORAGE_DIR_GRANTED_KEY);
  let persisted = false;
  if (navigator.storage && typeof navigator.storage.persisted === 'function') {
    try {
      persisted = await navigator.storage.persisted();
    } catch {
      persisted = false;
    }
  }

  if (savedDirName) {
    return {
      granted: true,
      source: 'directory_picker',
      state: 'granted',
      directoryName: savedDirName,
      message: `تم منح صلاحية القراءة والكتابة لمجلد "${savedDirName}"${persisted ? ' مع تفعيل التخزين الدائم.' : '.'}`
    };
  }

  if (persisted || localStorage.getItem(STORAGE_PERSIST_GRANTED_KEY) === 'true') {
    return {
      granted: true,
      source: 'persistent_storage',
      state: 'granted',
      message: 'تم تفعيل التخزين الدائم في المتصفح لحفظ البيانات والنسخ الاحتياطية بأمان.'
    };
  }

  const supportsDirectoryPicker = typeof (window as any).showDirectoryPicker === 'function' && !isRunningInIframe();
  const supportsPersist = !!(navigator.storage && typeof navigator.storage.persist === 'function');

  if (!supportsDirectoryPicker && !supportsPersist) {
    return {
      granted: false,
      source: 'browser_default',
      state: 'unsupported',
      message: 'في متصفح الجوال/WebAPK يتم حفظ الملفات تلقائياً في مجلد التنزيلات (Downloads) عند التصدير.'
    };
  }

  return {
    granted: false,
    source: supportsDirectoryPicker ? 'directory_picker' : 'persistent_storage',
    state: 'prompt',
    message: 'لم يتم طلب صلاحية التخزين أو الوصول إلى المجلدات بعد.'
  };
}

export async function requestAllFilesAccessPermission(): Promise<AllFilesPermissionStatus> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      granted: false,
      source: 'browser_default',
      state: 'unsupported',
      message: 'البيئة الحالية لا تدعم طلب صلاحيات الملفات.'
    };
  }

  // 1. Native Android WebView bridge -> opens ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.requestAllFilesAccess === 'function') {
    try {
      bridge.requestAllFilesAccess();
      const grantedNow = typeof bridge.hasAllFilesAccess === 'function'
        ? Boolean(bridge.hasAllFilesAccess())
        : false;

      return {
        granted: grantedNow,
        source: 'android_native',
        state: grantedNow ? 'granted' : 'prompt',
        message: grantedNow
          ? 'تم تفعيل صلاحية الوصول إلى جميع الملفات بنجاح.'
          : 'تم فتح صفحة إعدادات Android لمنح صلاحية الوصول إلى جميع الملفات. يرجى تفعيل الخيار ثم العودة للتطبيق.'
      };
    } catch (err: any) {
      return {
        granted: false,
        source: 'android_native',
        state: 'denied',
        message: err?.message || 'تعذر فتح إعدادات صلاحية الملفات في Android.'
      };
    }
  }

  // 2. Request Persistent Storage for browser / PWA database & offline files
  let persisted = false;
  if (navigator.storage && typeof navigator.storage.persist === 'function') {
    try {
      persisted = await navigator.storage.persist();
      if (persisted) {
        localStorage.setItem(STORAGE_PERSIST_GRANTED_KEY, 'true');
      }
    } catch (err) {
      console.warn('navigator.storage.persist error:', err);
    }
  }

  // 3. Request File System Directory read/write access when supported outside iframe
  const showDirectoryPicker = (window as any).showDirectoryPicker;
  if (typeof showDirectoryPicker === 'function' && !isRunningInIframe()) {
    try {
      const dirHandle = await showDirectoryPicker({ mode: 'readwrite' });
      const dirName = dirHandle?.name || 'مجلد الجهاز';
      localStorage.setItem(STORAGE_DIR_GRANTED_KEY, dirName);
      return {
        granted: true,
        source: 'directory_picker',
        state: 'granted',
        directoryName: dirName,
        message: `تم منح صلاحية الوصول والكتابة في المجلد "${dirName}" بنجاح.`
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return {
          granted: persisted,
          source: persisted ? 'persistent_storage' : 'directory_picker',
          state: persisted ? 'granted' : 'prompt',
          message: persisted
            ? 'تم تفعيل التخزين الدائم للمتصفح، وتم إلغاء اختيار مجلد إضافي.'
            : 'تم إلغاء نافذة اختيار المجلد.'
        };
      }
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        return {
          granted: persisted,
          source: persisted ? 'persistent_storage' : 'directory_picker',
          state: persisted ? 'granted' : 'denied',
          message: persisted
            ? 'تم تفعيل التخزين الدائم للمتصفح بنجاح، لكن المتصفح قيّد اختيار المجلد المباشر.'
            : 'تم رفض صلاحية الوصول إلى المجلدات من المتصفح.'
        };
      }
    }
  }

  if (persisted) {
    return {
      granted: true,
      source: 'persistent_storage',
      state: 'granted',
      message: 'تم تفعيل التخزين الدائم للنظام بنجاح! سيتم حفظ النسخ الاحتياطية والملفات عبر مجلد التنزيلات بأمان.'
    };
  }

  return {
    granted: false,
    source: 'browser_default',
    state: isRunningInIframe() ? 'prompt' : 'denied',
    message: isRunningInIframe()
      ? 'إطار المعاينة الحالي قد يقيّد صلاحيات التخزين المتقدمة؛ افتح التطبيق مباشرة في نافذة مستقلة أو داخل تطبيق Android لمنح الصلاحية الكاملة.'
      : 'لم يمنح المتصفح صلاحية التخزين الدائم أو الوصول المباشر للمجلدات؛ سيستمر حفظ الملفات تلقائياً في مجلد التنزيلات (Downloads).'
  };
}
