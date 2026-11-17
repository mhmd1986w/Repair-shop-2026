/**
 * Universal printing utility for web apps, Android Chrome, and WebAPK/PWA.
 * Guarantees:
 * 1. Synchronous window.print() directly inside the user click call stack when no pending <img> loads exist
 *    (prevents Chrome Android & WebView from dropping transient UserActivation).
 * 2. Top-level @page CSS rules (never invalidly nested inside @media print).
 * 3. Direct root-level #print-root portal avoiding iframe IPC failures.
 */

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
