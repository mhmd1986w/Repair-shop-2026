/**
 * Universal printing utility for web apps, Android Chrome, and WebAPK/PWA.
 * Guarantees:
 * 1. Synchronous window.print() directly inside the user click call stack when no pending <img> loads exist
 *    (prevents Chrome Android & WebView from dropping transient UserActivation).
 * 2. Top-level @page CSS rules (never invalidly nested inside @media print).
 * 3. Direct root-level #print-root portal avoiding iframe IPC failures.
 */

import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { saveFileToDeviceSync, uint8ArrayToDataUrl } from '../utils/fileSaver';

let activeCleanupTimer: ReturnType<typeof setTimeout> | null = null;
let activeAfterPrintHandler: (() => void) | null = null;

export interface PrintDispatchResult {
  triggered: boolean;
  synchronous: boolean;
  inIframe: boolean;
}

export function isEmbeddedIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function downloadPrintableHtml(filename: string, fullHtml: string): void {
  try {
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1500);
  } catch (err) {
    console.warn('downloadPrintableHtml failed:', err);
  }
}

export interface DownloadPdfOptions {
  filename: string;
  contentHtml: string;
  pageStyle: string;
  widthMm?: number;
  heightMm?: number;
  kind?: 'label' | 'receipt' | 'sticker' | 'report';
}

function parsePageDimensionsFromCss(pageStyle: string): { widthMm?: number; heightMm?: number } {
  const match = pageStyle.match(/@page\s*\{[^}]*size\s*:\s*([0-9.]+)\s*mm(?:\s+([0-9.]+)\s*mm)?/i);
  if (!match) return {};
  const widthMm = Number(match[1]);
  const heightMm = match[2] ? Number(match[2]) : undefined;
  return {
    widthMm: Number.isFinite(widthMm) && widthMm > 0 ? widthMm : undefined,
    heightMm: heightMm && Number.isFinite(heightMm) && heightMm > 0 ? heightMm : undefined,
  };
}

let cachedArabicFontEmbedCssPromise: Promise<string> | null = null;

/**
 * Fetches and base64-inlines Cairo Arabic font CSS cleanly without touching
 * cross-origin `document.styleSheets[i].cssRules` (which triggers SecurityError in html-to-image).
 * Silently resolves to '' when offline or blocked.
 */
async function getSafeArabicFontEmbedCss(): Promise<string> {
  if (cachedArabicFontEmbedCssPromise) return cachedArabicFontEmbedCssPromise;

  cachedArabicFontEmbedCssPromise = (async () => {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? window.setTimeout(() => controller.abort(), 1800) : null;
      const cssUrl =
        'https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap';
      const res = await fetch(cssUrl, {
        mode: 'cors',
        signal: controller?.signal,
      });
      if (timer !== null) window.clearTimeout(timer);
      if (!res.ok) return '';
      let cssText = await res.text();

      const urls = Array.from(new Set(cssText.match(/https:\/\/fonts\.gstatic\.com\/[^)"']+/g) || []));
      if (urls.length === 0) return '';

      await Promise.all(
        urls.map(async (fontUrl) => {
          try {
            const fontRes = await fetch(fontUrl, { mode: 'cors' });
            if (!fontRes.ok) return;
            const buf = await fontRes.arrayBuffer();
            const mime = fontUrl.endsWith('.woff2')
              ? 'font/woff2'
              : fontUrl.endsWith('.woff')
                ? 'font/woff'
                : 'font/ttf';
            const dataUrl = uint8ArrayToDataUrl(new Uint8Array(buf), mime);
            if (dataUrl) {
              cssText = cssText.split(fontUrl).join(dataUrl);
            }
          } catch {
            // Skip individual font face on error
          }
        })
      );

      // Only return rules whose URLs were successfully inlined to data: URIs
      return cssText.includes('data:font/') ? cssText : '';
    } catch {
      return '';
    }
  })();

  return cachedArabicFontEmbedCssPromise;
}

function loadImageElement(src: string, timeoutMs: number = 1500): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = (val: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    const timer = window.setTimeout(() => done(null), timeoutMs);
    img.onload = () => {
      window.clearTimeout(timer);
      done(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      done(null);
    };
    img.src = src;
  });
}

async function renderDomFallbackCanvasDataUrl(
  targetEl: HTMLElement,
  widthPx: number,
  heightPx: number,
  scale: number
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(widthPx * scale));
  canvas.height = Math.max(1, Math.round(heightPx * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const rootRect = targetEl.getBoundingClientRect();
  const safeRootW = rootRect.width || widthPx || 1;
  const safeRootH = rootRect.height || heightPx || 1;
  const sx = canvas.width / safeRootW;
  const sy = canvas.height / safeRootH;

  // 1. Draw all inline <svg> elements (QR codes + rotated vector orderId) at crisp vector scale
  const svgs = Array.from(targetEl.querySelectorAll('svg'));
  for (const svg of svgs) {
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const cloned = svg.cloneNode(true) as SVGSVGElement;
    if (!cloned.getAttribute('xmlns')) {
      cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    const drawW = Math.max(1, Math.round(rect.width * sx));
    const drawH = Math.max(1, Math.round(rect.height * sy));
    cloned.setAttribute('width', String(drawW));
    cloned.setAttribute('height', String(drawH));
    const xml = new XMLSerializer().serializeToString(cloned);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const img = await loadImageElement(svgUrl, 1500);
      if (img) {
        ctx.drawImage(
          img,
          (rect.left - rootRect.left) * sx,
          (rect.top - rootRect.top) * sy,
          drawW,
          drawH
        );
      }
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  // 2. Draw any raster <img> elements (e.g. center logo)
  const imgs = Array.from(targetEl.querySelectorAll('img'));
  for (const imgEl of imgs) {
    const rect = imgEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || !imgEl.complete || imgEl.naturalWidth === 0) continue;
    try {
      ctx.drawImage(
        imgEl,
        (rect.left - rootRect.left) * sx,
        (rect.top - rootRect.top) * sy,
        rect.width * sx,
        rect.height * sy
      );
    } catch {
      // Ignore cross-origin image draw errors
    }
  }

  // 3. Draw visible non-SVG text nodes at their computed rects (supports vertical-rl columns)
  const walker = document.createTreeWalker(targetEl, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = (node.textContent || '').trim();
    const parentEl = node.parentElement;
    if (text && parentEl && !parentEl.closest('svg')) {
      const cs = window.getComputedStyle(parentEl);
      const rect = parentEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none') {
        const fontSizePx = (parseFloat(cs.fontSize) || 12) * Math.min(sx, sy);
        const fontWeight = cs.fontWeight || '700';
        const fontFamily = cs.fontFamily || "'Cairo', sans-serif";
        const isVertical = (cs.writingMode || '').includes('vertical');

        ctx.save();
        ctx.fillStyle = cs.color || '#000000';
        ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const cx = ((rect.left - rootRect.left) + rect.width / 2) * sx;
        const cy = ((rect.top - rootRect.top) + rect.height / 2) * sy;

        if (isVertical) {
          ctx.translate(cx, cy);
          ctx.rotate(Math.PI / 2);
          ctx.fillText(text, 0, 0, rect.height * sy * 0.98);
        } else {
          ctx.fillText(text, cx, cy, rect.width * sx * 0.98);
        }
        ctx.restore();
      }
    }
    node = walker.nextNode();
  }

  return canvas.toDataURL('image/png');
}

/**
 * Renders printable HTML/SVG content at high DPI into an exact-millimeter PDF
 * and downloads it directly as a `.pdf` file.
 */
export async function downloadPrintablePdf(options: DownloadPdfOptions): Promise<boolean> {
  const {
    filename,
    contentHtml,
    pageStyle,
    kind = 'label',
  } = options;

  const pdfFilename = /\.pdf$/i.test(filename)
    ? filename
    : `${filename.replace(/\.html?$/i, '') || 'document'}.pdf`;

  const parsedDims = parsePageDimensionsFromCss(pageStyle);
  const widthMm = options.widthMm ?? parsedDims.widthMm ?? (kind === 'receipt' ? 80 : 38);
  const explicitHeightMm = options.heightMm ?? parsedDims.heightMm ?? (kind === 'label' || kind === 'sticker' ? 25 : undefined);

  const MM_TO_PX = 96 / 25.4;
  const { printRules } = normalizePrintPageStyle(pageStyle);

  // Scope rules cleanly to our isolated offscreen host so nothing leaks to the active page
  const scopedCss = printRules
    .replace(/body\.app-printing-active\s*>\s*#print-root/gi, '#pdf-render-host')
    .replace(/(^|[}\n;])\s*(?:html\s*,\s*body|body\s*,\s*html|html|body)\s*(?=\{)/gi, '$1 #pdf-render-host ');

  const host = document.createElement('div');
  host.id = 'pdf-render-host';
  host.setAttribute('dir', 'rtl');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.zIndex = '-1';
  host.style.pointerEvents = 'none';
  host.style.background = '#ffffff';
  host.style.color = '#000000';
  host.style.margin = '0';
  host.style.padding = '0';
  host.style.width = `${widthMm}mm`;
  if (explicitHeightMm) {
    host.style.height = `${explicitHeightMm}mm`;
    host.style.overflow = 'hidden';
  }

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    #pdf-render-host, #pdf-render-host * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    ${scopedCss}
  `;

  const contentWrap = document.createElement('div');
  contentWrap.style.width = `${widthMm}mm`;
  if (explicitHeightMm) {
    contentWrap.style.height = `${explicitHeightMm}mm`;
  }
  contentWrap.style.background = '#ffffff';
  contentWrap.style.margin = '0';
  contentWrap.style.padding = '0';
  contentWrap.innerHTML = contentHtml;

  host.appendChild(styleTag);
  host.appendChild(contentWrap);
  document.body.appendChild(host);

  try {
    // Wait briefly for web fonts and embedded images to finish rendering
    if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
      await Promise.race([
        (document as any).fonts.ready.catch(() => {}),
        new Promise((r) => setTimeout(r, 600)),
      ]);
    }

    const pendingImgs = Array.from(contentWrap.querySelectorAll('img')).filter(
      (img) => !(img.complete && img.naturalWidth > 0)
    );
    if (pendingImgs.length > 0) {
      await Promise.race([
        Promise.all(
          pendingImgs.map(
            (img) =>
              new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              })
          )
        ),
        new Promise((r) => setTimeout(r, 1000)),
      ]);
    }

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const targetEl =
      (contentWrap.querySelector('.thermal-label-container, .card, .receipt-sheet') as HTMLElement | null) ||
      contentWrap;

    const rect = targetEl.getBoundingClientRect();
    const captureWidthPx = Math.max(1, Math.round(rect.width || widthMm * MM_TO_PX));
    const captureHeightPx = Math.max(
      1,
      Math.round(
        explicitHeightMm
          ? rect.height || explicitHeightMm * MM_TO_PX
          : targetEl.scrollHeight || rect.height || widthMm * MM_TO_PX
      )
    );

    const finalHeightMm = explicitHeightMm
      ? explicitHeightMm
      : Math.max(25, Number(((captureHeightPx / captureWidthPx) * widthMm).toFixed(2)));

    const pixelRatio = widthMm <= 50 ? 5 : 3;
    const fontEmbedCSS = await getSafeArabicFontEmbedCss();

    let pngDataUrl = '';
    try {
      pngDataUrl = await toPng(targetEl, {
        pixelRatio,
        width: captureWidthPx,
        height: captureHeightPx,
        backgroundColor: '#ffffff',
        cacheBust: false,
        skipFonts: !fontEmbedCSS,
        fontEmbedCSS,
      });
    } catch (firstErr) {
      console.warn('toPng with embedded font CSS failed, retrying with skipFonts:', firstErr);
      try {
        pngDataUrl = await toPng(targetEl, {
          pixelRatio,
          width: captureWidthPx,
          height: captureHeightPx,
          backgroundColor: '#ffffff',
          cacheBust: false,
          skipFonts: true,
          fontEmbedCSS: '',
        });
      } catch (secondErr) {
        console.warn('toPng fallback failed, switching to 2D canvas renderer:', secondErr);
        pngDataUrl = await renderDomFallbackCanvasDataUrl(
          targetEl,
          captureWidthPx,
          captureHeightPx,
          pixelRatio
        );
      }
    }

    if (!pngDataUrl || !pngDataUrl.startsWith('data:image/')) {
      pngDataUrl = await renderDomFallbackCanvasDataUrl(
        targetEl,
        captureWidthPx,
        captureHeightPx,
        pixelRatio
      );
    }

    const pdf = new jsPDF({
      orientation: widthMm >= finalHeightMm ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [widthMm, finalHeightMm],
      compress: true,
    });

    pdf.addImage(pngDataUrl, 'PNG', 0, 0, widthMm, finalHeightMm, undefined, 'FAST');

    const arrayBuffer = pdf.output('arraybuffer');
    const bytes = new Uint8Array(arrayBuffer);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const dataUrl = uint8ArrayToDataUrl(bytes, 'application/pdf');

    const res = saveFileToDeviceSync(blob, pdfFilename, 'application/pdf', { dataUrl });
    return res.success;
  } catch (err) {
    console.error('downloadPrintablePdf failed:', err);
    return false;
  } finally {
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }
}

function findMatchingBrace(source: string, openBraceIndex: number): number {
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Splits a CSS stylesheet into:
 * - topLevelRules: @page, @font-face, @import statements that must live outside @media print
 * - printRules: rules scoped inside @media print (with any inner @media print unwrapped)
 */
export function normalizePrintPageStyle(rawStyle: string): {
  topLevelRules: string;
  printRules: string;
} {
  if (!rawStyle || !rawStyle.trim()) {
    return { topLevelRules: '', printRules: '' };
  }

  const topLevelParts: string[] = [];
  const printParts: string[] = [];

  let cursor = 0;
  const len = rawStyle.length;

  while (cursor < len) {
    const atPageIdx = rawStyle.indexOf('@page', cursor);
    const atMediaIdx = rawStyle.indexOf('@media', cursor);

    let nextIdx = -1;
    let kind: 'page' | 'media' | null = null;

    if (atPageIdx !== -1 && (atMediaIdx === -1 || atPageIdx < atMediaIdx)) {
      nextIdx = atPageIdx;
      kind = 'page';
    } else if (atMediaIdx !== -1) {
      nextIdx = atMediaIdx;
      kind = 'media';
    }

    if (nextIdx === -1 || !kind) {
      printParts.push(rawStyle.slice(cursor));
      break;
    }

    if (nextIdx > cursor) {
      printParts.push(rawStyle.slice(cursor, nextIdx));
    }

    const braceStart = rawStyle.indexOf('{', nextIdx);
    if (braceStart === -1) {
      printParts.push(rawStyle.slice(nextIdx));
      break;
    }

    const braceEnd = findMatchingBrace(rawStyle, braceStart);
    if (braceEnd === -1) {
      printParts.push(rawStyle.slice(nextIdx));
      break;
    }

    if (kind === 'page') {
      topLevelParts.push(rawStyle.slice(nextIdx, braceEnd + 1));
    } else {
      const prelude = rawStyle.slice(nextIdx, braceStart).trim().toLowerCase();
      if (prelude.includes('print')) {
        // Unwrap @media print { ... } and recursively normalize any @page inside it
        const inner = normalizePrintPageStyle(rawStyle.slice(braceStart + 1, braceEnd));
        if (inner.topLevelRules) topLevelParts.push(inner.topLevelRules);
        if (inner.printRules) printParts.push(inner.printRules);
      } else {
        printParts.push(rawStyle.slice(nextIdx, braceEnd + 1));
      }
    }

    cursor = braceEnd + 1;
  }

  // Scope standalone html/body selectors inside printRules to body.app-printing-active > #print-root
  const scopedPrintRules = printParts
    .join('\n')
    .replace(
      /(^|[}\n;])\s*(?:html\s*,\s*body|body\s*,\s*html|html|body)\s*(?=\{)/gi,
      '$1 body.app-printing-active > #print-root '
    );

  return {
    topLevelRules: topLevelParts.join('\n'),
    printRules: scopedPrintRules,
  };
}

export function printPureContent(
  contentHtml: string,
  pageStyle: string,
  onComplete?: () => void
): PrintDispatchResult {
  const inIframe = isEmbeddedIframe();

  try {
    // Clear any leftover cleanup handler/timer from a previous print call
    if (activeCleanupTimer !== null) {
      clearTimeout(activeCleanupTimer);
      activeCleanupTimer = null;
    }
    if (activeAfterPrintHandler) {
      window.removeEventListener('afterprint', activeAfterPrintHandler);
      activeAfterPrintHandler = null;
    }

    // 1. Ensure Google fonts link exists
    if (!document.getElementById('arabic-print-fonts')) {
      const fontLink = document.createElement('link');
      fontLink.id = 'arabic-print-fonts';
      fontLink.rel = 'stylesheet';
      fontLink.crossOrigin = 'anonymous';
      fontLink.href =
        'https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&family=Amiri:wght@400;700&family=Cairo:wght@400;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Tajawal:wght@400;500;700;800;900&display=swap';
      document.head.appendChild(fontLink);
    }

    // 2. Ensure #print-root exists directly on document.body (outside #root)
    let printRoot = document.getElementById('print-root');
    if (!printRoot) {
      printRoot = document.createElement('div');
      printRoot.id = 'print-root';
      document.body.appendChild(printRoot);
    }

    // 3. Ensure global print styles exist
    let globalStyle = document.getElementById('print-portal-style');
    if (!globalStyle) {
      globalStyle = document.createElement('style');
      globalStyle.id = 'print-portal-style';
      document.head.appendChild(globalStyle);
    }

    const { topLevelRules, printRules } = normalizePrintPageStyle(pageStyle);

    // Put @page at top level (valid CSS) and keep print-specific rules inside @media print
    globalStyle.innerHTML = `
      ${topLevelRules}
      #print-root {
        display: none;
      }
      @media screen {
        #print-root {
          display: none !important;
        }
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          color: black !important;
          overflow: visible !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body.app-printing-active > *:not(#print-root) {
          display: none !important;
        }
        body.app-printing-active > #print-root {
          display: block !important;
          position: static !important;
          width: 100% !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          color: black !important;
          visibility: visible !important;
          overflow: visible !important;
        }
        body.app-printing-active > #print-root * {
          visibility: visible !important;
        }
        ${printRules}
      }
    `;

    // 4. Inject content & activate printing mode
    printRoot.innerHTML = contentHtml;
    document.body.classList.add('app-printing-active');

    // Force synchronous layout flush before printing
    void printRoot.offsetHeight;

    // 5. Cleanup handler
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (activeCleanupTimer !== null) {
        clearTimeout(activeCleanupTimer);
        activeCleanupTimer = null;
      }
      if (activeAfterPrintHandler === cleanup) {
        window.removeEventListener('afterprint', cleanup);
        activeAfterPrintHandler = null;
      }
      document.body.classList.remove('app-printing-active');
      if (printRoot) printRoot.innerHTML = '';
      if (onComplete) onComplete();
    };

    activeAfterPrintHandler = cleanup;
    window.addEventListener('afterprint', cleanup, { once: true });

    const invokeNativePrint = (): boolean => {
      try {
        window.focus?.();
        window.print();
        activeCleanupTimer = setTimeout(cleanup, 15000);
        return true;
      } catch (e) {
        console.warn('Direct window.print() failed:', e);
        cleanup();
        return false;
      }
    };

    // Check only remote images not yet loaded (inline SVG & data: URI images require zero network wait!)
    const images = Array.from(printRoot.querySelectorAll('img'));
    const pendingImages = images.filter(img => {
      const src = img.getAttribute('src') || '';
      if (src.startsWith('data:') || src.startsWith('blob:')) return false;
      return !(img.complete && img.naturalWidth !== 0);
    });

    if (pendingImages.length === 0) {
      // CRITICAL for Chrome Android & WebView: run synchronously within the click gesture!
      const triggered = invokeNativePrint();
      return { triggered, synchronous: true, inIframe };
    }

    // If external/unloaded images exist (e.g. center logo or photos), wait briefly (max 450ms)
    const imagePromises = pendingImages.map(
      img =>
        new Promise<void>(res => {
          img.onload = () => res();
          img.onerror = () => res();
          setTimeout(res, 450);
        })
    );

    Promise.all(imagePromises).then(() => {
      invokeNativePrint();
    });

    return { triggered: true, synchronous: false, inIframe };
  } catch (err) {
    console.error('printPureContent error:', err);
    try {
      window.print();
      return { triggered: true, synchronous: true, inIframe };
    } catch {
      if (onComplete) onComplete();
      return { triggered: false, synchronous: true, inIframe };
    }
  }
}

/**
 * Parses full HTML documents and prints them via printPureContent on the main window.
 */
export function printHtmlViaIframe(fullHtml: string, onComplete?: () => void): PrintDispatchResult {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(fullHtml, 'text/html');

    const styles = Array.from(doc.querySelectorAll('style'))
      .map(s => s.innerHTML)
      .join('\n');

    const bodyContent = doc.body ? doc.body.innerHTML : fullHtml;
    return printPureContent(bodyContent, styles, onComplete);
  } catch (err) {
    console.error('printHtmlViaIframe fallback error:', err);
    try {
      window.print();
      return { triggered: true, synchronous: true, inIframe: isEmbeddedIframe() };
    } catch {
      if (onComplete) onComplete();
      return { triggered: false, synchronous: true, inIframe: isEmbeddedIframe() };
    }
  }
}
