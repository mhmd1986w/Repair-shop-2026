import * as XLSX from 'xlsx';

export interface SaveFileOptions {
  blob: Blob;
  fileName: string;
  mimeType: string;
  description?: string;
}

export interface SaveFileResult {
  success: boolean;
  method?: 'picker' | 'download' | 'dataurl' | 'share';
  url?: string;
  dataUrl?: string;
  textContent?: string;
  fileName: string;
  fileSizeFormatted?: string;
  error?: string;
  userCancelled?: boolean;
}

/**
 * Check if the current window is inside an iframe
 */
export function isRunningInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Format bytes into human-readable size (KB, MB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Synchronously encode UTF-8 text into a base64 data URL (safe for Arabic & Unicode).
 */
export function textToDataUrl(text: string, mimeType: string): string | undefined {
  try {
    if (text.length > 4 * 1024 * 1024) return undefined;
    const bytes = new TextEncoder().encode(text);
    return uint8ArrayToDataUrl(bytes, mimeType);
  } catch (err) {
    console.warn('textToDataUrl failed:', err);
    return undefined;
  }
}

/**
 * Synchronously encode a Uint8Array into a base64 data URL.
 */
export function uint8ArrayToDataUrl(bytes: Uint8Array, mimeType: string): string | undefined {
  try {
    if (bytes.byteLength > 6 * 1024 * 1024) return undefined;
    const chunkSize = 0x8000;
    const parts: string[] = [];
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const slice = bytes.subarray(i, i + chunkSize);
      parts.push(String.fromCharCode(...slice));
    }
    const base64 = btoa(parts.join(''));
    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    console.warn('uint8ArrayToDataUrl failed:', err);
    return undefined;
  }
}

/**
 * Converts XLSX WorkBook to a binary Blob + optional Data URL synchronously.
 */
export function excelWorkbookToBlobAndDataUrl(wb: XLSX.WorkBook): {
  blob: Blob;
  dataUrl?: string;
} {
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    const ws = XLSX.utils.json_to_sheet([{ 'حالة البيانات': 'لا توجد سجلات مطابقة' }]);
    XLSX.utils.book_append_sheet(wb, ws, 'البيانات');
  }

  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const bytes = new Uint8Array(wbout);
  const blob = new Blob([bytes], { type: mimeType });
  const dataUrl = uint8ArrayToDataUrl(bytes, mimeType);
  return { blob, dataUrl };
}

/**
 * Converts XLSX WorkBook to a binary Blob safely, ensuring no empty workbook crashes.
 */
export function excelWorkbookToBlob(wb: XLSX.WorkBook): Blob {
  return excelWorkbookToBlobAndDataUrl(wb).blob;
}

/**
 * Detect if the client is on mobile, tablet, Android, iOS, or inside a WebView / WebAPK
 */
export function isMobileOrWebView(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|wv|SamsungBrowser/i.test(ua);
  const isTouchDevice = (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) || ('ontouchstart' in window);
  const isSmallScreen = typeof window.innerWidth === 'number' && window.innerWidth <= 1024;
  return isMobileUA || (isTouchDevice && isSmallScreen);
}

/**
 * Trigger an anchor download synchronously within the active user gesture.
 */
export function triggerAnchorDownloadSync(href: string, fileName: string): boolean {
  try {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = href;
    a.download = fileName;
    a.setAttribute('download', fileName);
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      try {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
      } catch {}
    }, 1500);
    return true;
  } catch (err) {
    console.warn('triggerAnchorDownloadSync failed:', err);
    return false;
  }
}

/**
 * Synchronously saves and downloads a file directly from the current interface.
 * Does NOT await anything before calling `a.click()` so browser UserActivation
 * is preserved inside iframes, WebAPKs, Android Chrome, and desktop browsers.
 */
export function saveFileToDeviceSync(
  blob: Blob,
  fileName: string,
  mimeType: string,
  options?: {
    dataUrl?: string;
    textContent?: string;
  }
): SaveFileResult {
  const sizeFormatted = formatBytes(blob.size);
  let dataUrl = options?.dataUrl;

  if (!dataUrl && options?.textContent !== undefined) {
    dataUrl = textToDataUrl(options.textContent, mimeType);
  }

  try {
    const url = URL.createObjectURL(blob);

    // Keep object URL alive for 10 minutes so the user can re-download from the same UI
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }, 600000);

    const triggered = triggerAnchorDownloadSync(url, fileName);

    if (!triggered && dataUrl) {
      triggerAnchorDownloadSync(dataUrl, fileName);
    }

    return {
      success: true,
      method: triggered ? 'download' : dataUrl ? 'dataurl' : 'download',
      url,
      dataUrl,
      textContent: options?.textContent,
      fileName,
      fileSizeFormatted: sizeFormatted,
    };
  } catch (err: any) {
    console.error('Direct download failed:', err);
    if (dataUrl) {
      triggerAnchorDownloadSync(dataUrl, fileName);
      return {
        success: true,
        method: 'dataurl',
        dataUrl,
        textContent: options?.textContent,
        fileName,
        fileSizeFormatted: sizeFormatted,
      };
    }
    return {
      success: false,
      error: err?.message || 'فشل حفظ الملف على الجهاز',
      fileName,
      fileSizeFormatted: sizeFormatted,
      textContent: options?.textContent,
    };
  }
}

/**
 * Backwards-compatible wrapper around synchronous download trigger.
 * Runs synchronously up through `a.click()` before resolving.
 */
export function saveFileToDevice(
  blob: Blob,
  fileName: string,
  mimeType: string,
  _description: string = 'ملف بيانات',
  options?: {
    dataUrl?: string;
    textContent?: string;
  }
): Promise<SaveFileResult> {
  return Promise.resolve(saveFileToDeviceSync(blob, fileName, mimeType, options));
}

/**
 * Optional "Save As" picker when supported by the current context (top-level desktop Chrome/Edge).
 */
export async function saveFileWithPicker(
  blob: Blob,
  fileName: string,
  mimeType: string
): Promise<{ saved: boolean; cancelled?: boolean; error?: string }> {
  const anyWin = window as any;
  if (typeof anyWin.showSaveFilePicker !== 'function') {
    return { saved: false, error: 'غير مدعوم في هذا المتصفح' };
  }
  try {
    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
    const handle = await anyWin.showSaveFilePicker({
      suggestedName: fileName,
      types: ext
        ? [
            {
              description: fileName,
              accept: { [mimeType]: [ext] },
            },
          ]
        : undefined,
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { saved: true };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { saved: false, cancelled: true };
    }
    return { saved: false, error: err?.message || 'تعذر فتح نافذة اختيار المجلد في هذا العرض' };
  }
}

/**
 * Share or save file using Web Share API (works on Android / iOS / WebAPK directly from the same UI).
 * Handles Android Chrome restrictions on `application/json` and `text/vcard` by falling back to `text/plain`
 * or sharing text directly when needed.
 */
export async function shareFile(
  blob: Blob,
  fileName: string,
  mimeType: string,
  textContent?: string
): Promise<{ shared: boolean; reason?: string }> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return { shared: false, reason: 'المشاركة المباشرة غير مدعومة في هذا المتصفح' };
  }

  const candidateTypes = [mimeType];
  if (mimeType !== 'text/plain' && (mimeType.includes('json') || mimeType.includes('vcard') || mimeType.includes('csv'))) {
    candidateTypes.push('text/plain');
  }

  for (const type of candidateTypes) {
    try {
      const file = new File([blob], fileName, { type });
      const shareData: ShareData = {
        files: [file],
        title: fileName,
        text: `ملف النسخة الاحتياطية: ${fileName}`,
      };
      if (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })) {
        await navigator.share(shareData);
        return { shared: true };
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        return { shared: false, reason: 'تم إلغاء المشاركة' };
      }
      console.warn(`navigator.share failed for ${type}:`, e);
    }
  }

  // Fallback for text backups inside restricted WebViews where file sharing isn't permitted
  if (textContent && textContent.length <= 200000) {
    try {
      await navigator.share({
        title: fileName,
        text: textContent,
      });
      return { shared: true };
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        return { shared: false, reason: 'تم إلغاء المشاركة' };
      }
    }
  }

  return { shared: false, reason: 'المشاركة غير متاحة داخل هذا الإطار، يمكنك التنزيل المباشر أو نسخ المحتوى أدناه' };
}
