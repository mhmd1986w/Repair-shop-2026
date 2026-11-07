import * as XLSX from 'xlsx';

export interface SaveFileOptions {
  blob: Blob;
  fileName: string;
  mimeType: string;
  description?: string;
}

export interface SaveFileResult {
  success: boolean;
  method?: 'picker' | 'download' | 'share';
  url?: string;
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
  } catch (e) {
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
 * Converts XLSX WorkBook to a binary Blob safely, ensuring no empty workbook crashes
 */
export function excelWorkbookToBlob(wb: XLSX.WorkBook): Blob {
  // Ensure workbook has at least one sheet
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    const ws = XLSX.utils.json_to_sheet([{ "حالة البيانات": "لا توجد سجلات مطابقة" }]);
    XLSX.utils.book_append_sheet(wb, ws, "البيانات");
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

/**
 * Robustly saves a file to the user's device memory/disk.
 * 1. Attempts File System Access API (window.showSaveFilePicker) to let user choose folder/path on device.
 * 2. If unsupported or restricted by iframe/security policies, falls back to direct browser download.
 * 3. Keeps Object URL alive and returns it so UI can also provide a direct clickable download button.
 */
export async function saveFileToDevice(
  blob: Blob,
  fileName: string,
  mimeType: string,
  description: string = 'ملف بيانات'
): Promise<SaveFileResult> {
  const sizeFormatted = formatBytes(blob.size);

  // 1. Try File System Access API (Native "Save As" / اختيار مكان الحفظ dialog)
  if (typeof (window as any).showSaveFilePicker === 'function') {
    try {
      const ext = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: description,
          accept: {
            [mimeType || 'application/octet-stream']: ext ? [ext] : []
          }
        }]
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      return {
        success: true,
        method: 'picker',
        fileName,
        fileSizeFormatted: sizeFormatted
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User closed or cancelled the picker dialog
        return {
          success: false,
          userCancelled: true,
          fileName,
          fileSizeFormatted: sizeFormatted
        };
      }
      console.warn('showSaveFilePicker threw or is blocked by iframe policy. Falling back to direct download:', err);
    }
  }

  // 2. Direct browser download fallback with DOM attachment and persistent Blob URL
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.setAttribute('download', fileName);
    document.body.appendChild(a);

    // Simulate user click
    a.click();

    // Clean up anchor tag, keep blob URL alive for 5 minutes for direct download button
    setTimeout(() => {
      try {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
      } catch (e) {}
    }, 1000);

    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    }, 300000); // 5 minutes

    return {
      success: true,
      method: 'download',
      url,
      fileName,
      fileSizeFormatted: sizeFormatted
    };
  } catch (err: any) {
    console.error('Direct download fallback failed:', err);
    return {
      success: false,
      error: err.message || 'فشل حفظ الملف على الجهاز',
      fileName,
      fileSizeFormatted: sizeFormatted
    };
  }
}

/**
 * Share file using Web Share API (especially on Android / iOS mobile devices to save to files/storage)
 */
export async function shareFile(blob: Blob, fileName: string, mimeType: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
    try {
      const file = new File([blob], fileName, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName,
          text: `ملف النسخة الاحتياطية: ${fileName}`
        });
        return true;
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('navigator.share failed:', e);
      }
    }
  }
  return false;
}
