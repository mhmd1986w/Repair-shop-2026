export type LabelElementId =
  | 'center_name'
  | 'center_mobile'
  | 'customer_name'
  | 'device_model'
  | 'order_date'
  | 'barcode'
  | 'qr_code'
  | 'custom_text';

export interface LabelElementConfig {
  id: LabelElementId;
  label: string;
  enabled: boolean;
  fontSize?: number; // pt
  height?: number; // for barcode/QR in px
  width?: number; // for barcode bar width multiplier
  marginTop?: number; // extra spacing before item (px)
  marginBottom?: number; // extra spacing after item (px)
  bold?: boolean;
  customContent?: string;
}

export interface LabelLayoutConfig {
  paperSize: string;
  lineSpacing: number; // overall spacing multiplier (0.5 to 3)
  padding: number; // padding in mm (0.5 to 5)
  textAlign: 'center' | 'right' | 'left';
  zoom: number; // scale percent (70 to 130)
  elements: LabelElementConfig[];
}

export const DEFAULT_LABEL_ELEMENTS: LabelElementConfig[] = [
  {
    id: 'center_name',
    label: 'اسم مركز الصيانة',
    enabled: true,
    fontSize: 13,
    bold: true,
    marginTop: 0,
    marginBottom: 0.5
  },
  {
    id: 'center_mobile',
    label: 'رقم هاتف المركز',
    enabled: true,
    fontSize: 10,
    bold: true,
    marginTop: 0,
    marginBottom: 1
  },
  {
    id: 'customer_name',
    label: 'اسم العميل',
    enabled: true,
    fontSize: 10,
    bold: true,
    marginTop: 0.5,
    marginBottom: 0.5
  },
  {
    id: 'device_model',
    label: 'نوع وموديل الجهاز',
    enabled: true,
    fontSize: 10,
    bold: true,
    marginTop: 0,
    marginBottom: 0.5
  },
  {
    id: 'order_date',
    label: 'تاريخ الاستلام',
    enabled: true,
    fontSize: 10,
    bold: false,
    marginTop: 0,
    marginBottom: 1
  },
  {
    id: 'barcode',
    label: 'الباركود ورقم الطلب',
    enabled: true,
    fontSize: 10,
    height: 26,
    width: 1.2,
    marginTop: 0.5,
    marginBottom: 1
  },
  {
    id: 'qr_code',
    label: 'رمز الاستجابة السريعة (QR)',
    enabled: false,
    fontSize: 10,
    height: 30,
    marginTop: 0.5,
    marginBottom: 1
  },
  {
    id: 'custom_text',
    label: 'نص إضافي مخصص',
    enabled: false,
    fontSize: 10,
    bold: false,
    marginTop: 0.5,
    marginBottom: 0,
    customContent: 'يرجى إبراز هذا الملصق عند الاستلام'
  }
];

export const FIXED_LABEL_PAPER_SIZE = '38x25';

export function getDefaultLabelLayout(): LabelLayoutConfig {
  return {
    paperSize: FIXED_LABEL_PAPER_SIZE,
    lineSpacing: 1.15,
    padding: 1.2,
    textAlign: 'center',
    zoom: 100,
    elements: JSON.parse(JSON.stringify(DEFAULT_LABEL_ELEMENTS))
  };
}

export function getStoredLabelLayout(): LabelLayoutConfig {
  try {
    if (localStorage.getItem('lblPaperSize') !== FIXED_LABEL_PAPER_SIZE) {
      localStorage.setItem('lblPaperSize', FIXED_LABEL_PAPER_SIZE);
    }
  } catch {
    // ignore storage write failures
  }
  let saved: string | null = null;
  try {
    saved = localStorage.getItem('label_layout_config');
  } catch {
    saved = null;
  }
  if (saved) {
    try {
      const parsed: LabelLayoutConfig = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.elements)) {
        // Ensure all default elements exist in parsed config (in case new elements were added)
        const existingIds = new Set(parsed.elements.map(e => e.id));
        const missing = DEFAULT_LABEL_ELEMENTS.filter(d => !existingIds.has(d.id));
        if (missing.length > 0) {
          parsed.elements = [...parsed.elements, ...missing];
        }
        parsed.paperSize = FIXED_LABEL_PAPER_SIZE;
        parsed.elements = parsed.elements.map(el => ({
          ...el,
          fontSize: el.fontSize !== undefined ? Math.max(10, Math.min(99, el.fontSize)) : undefined,
          height: el.height !== undefined ? Math.max(10, Math.min(99, el.height)) : undefined,
        }));
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse label_layout_config', e);
    }
  }

  // Fallback to legacy individual keys
  const defaultLayout = getDefaultLabelLayout();
  const legacyLineSpacing = Number(localStorage.getItem('lblLineSpacing')) || 1.15;
  const legacyZoom = Number(localStorage.getItem('lblZoom')) || 100;

  defaultLayout.paperSize = FIXED_LABEL_PAPER_SIZE;
  defaultLayout.lineSpacing = legacyLineSpacing;
  defaultLayout.zoom = legacyZoom;

  // Sync element enabled and sizes from legacy keys
  defaultLayout.elements = defaultLayout.elements.map(el => {
    switch (el.id) {
      case 'center_name':
        return {
          ...el,
          enabled: localStorage.getItem('lblShowCenterName') !== 'false',
          fontSize: Math.max(10, Math.min(99, Number(localStorage.getItem('lblFontSizeCenterName')) || el.fontSize || 13))
        };
      case 'center_mobile':
        return {
          ...el,
          enabled: localStorage.getItem('lblShowMobile') !== 'false',
          fontSize: Math.max(10, Math.min(99, Number(localStorage.getItem('lblFontSizeMobile')) || el.fontSize || 10))
        };
      case 'customer_name':
        return {
          ...el,
          enabled: localStorage.getItem('lblShowCustomerName') !== 'false',
          fontSize: Math.max(10, Math.min(99, Number(localStorage.getItem('lblFontSizeCustomerName')) || el.fontSize || 10))
        };
      case 'device_model':
        return {
          ...el,
          enabled: localStorage.getItem('lblShowDeviceModel') !== 'false',
          fontSize: Math.max(10, Math.min(99, Number(localStorage.getItem('lblFontSizeDeviceModel')) || el.fontSize || 10))
        };
      case 'order_date':
        return {
          ...el,
          enabled: localStorage.getItem('lblShowDate') !== 'false',
          fontSize: Math.max(10, Math.min(99, Number(localStorage.getItem('lblFontSizeDate')) || el.fontSize || 10))
        };
      case 'barcode':
        return {
          ...el,
          enabled: localStorage.getItem('lblShowBarcode') !== 'false',
          height: Math.max(10, Math.min(99, Number(localStorage.getItem('lblBarcodeHeight')) || el.height || 26)),
          width: Number(localStorage.getItem('lblBarcodeWidth')) || el.width,
          fontSize: Math.max(10, Math.min(99, Number(localStorage.getItem('lblFontSizeBarcodeText')) || el.fontSize || 10))
        };
      case 'qr_code':
        return {
          ...el,
          enabled: localStorage.getItem('lblShowQR') === 'true'
        };
      case 'custom_text':
        return {
          ...el,
          enabled: Boolean(localStorage.getItem('lblCustomText')),
          customContent: localStorage.getItem('lblCustomText') || el.customContent
        };
      default:
        return el;
    }
  });

  return defaultLayout;
}

export function saveStoredLabelLayout(config: LabelLayoutConfig): void {
  const normalizedConfig: LabelLayoutConfig = {
    ...config,
    paperSize: FIXED_LABEL_PAPER_SIZE,
  };
  localStorage.setItem('label_layout_config', JSON.stringify(normalizedConfig));
  localStorage.setItem('lblPaperSize', FIXED_LABEL_PAPER_SIZE);
  localStorage.setItem('lblLineSpacing', String(normalizedConfig.lineSpacing));
  localStorage.setItem('lblZoom', String(normalizedConfig.zoom));

  // Sync to legacy keys so old code remains compatible
  config.elements.forEach(el => {
    switch (el.id) {
      case 'center_name':
        localStorage.setItem('lblShowCenterName', String(el.enabled));
        localStorage.setItem('lblFontSizeCenterName', String(el.fontSize));
        break;
      case 'center_mobile':
        localStorage.setItem('lblShowMobile', String(el.enabled));
        localStorage.setItem('lblFontSizeMobile', String(el.fontSize));
        break;
      case 'customer_name':
        localStorage.setItem('lblShowCustomerName', String(el.enabled));
        localStorage.setItem('lblFontSizeCustomerName', String(el.fontSize));
        break;
      case 'device_model':
        localStorage.setItem('lblShowDeviceModel', String(el.enabled));
        localStorage.setItem('lblFontSizeDeviceModel', String(el.fontSize));
        break;
      case 'order_date':
        localStorage.setItem('lblShowDate', String(el.enabled));
        localStorage.setItem('lblFontSizeDate', String(el.fontSize));
        break;
      case 'barcode':
        localStorage.setItem('lblShowBarcode', String(el.enabled));
        if (el.height) localStorage.setItem('lblBarcodeHeight', String(el.height));
        if (el.width) localStorage.setItem('lblBarcodeWidth', String(el.width));
        if (el.fontSize) localStorage.setItem('lblFontSizeBarcodeText', String(el.fontSize));
        break;
      case 'qr_code':
        localStorage.setItem('lblShowQR', String(el.enabled));
        break;
      case 'custom_text':
        if (el.enabled && el.customContent) {
          localStorage.setItem('lblCustomText', el.customContent);
        } else {
          localStorage.removeItem('lblCustomText');
        }
        break;
    }
  });

  window.dispatchEvent(new Event('storage'));
}

export function reorderElements(
  elements: LabelElementConfig[],
  fromIndex: number,
  toIndex: number
): LabelElementConfig[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= elements.length || toIndex >= elements.length) {
    return elements;
  }
  const result = [...elements];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

export const MM_TO_PX = 96 / 25.4;
export const PX_TO_MM = 25.4 / 96;

export function parseLabelPaperSize(paperSize?: string): { widthMm: number; heightMm: number } {
  const parts = (paperSize || FIXED_LABEL_PAPER_SIZE).split('x').map(Number);
  const widthMm = Number.isFinite(parts[0]) && parts[0] > 0 ? parts[0] : 38;
  const heightMm = Number.isFinite(parts[1]) && parts[1] > 0 ? parts[1] : 25;
  return { widthMm, heightMm };
}

export interface LabelPreviewMetrics {
  widthMm: number;
  heightMm: number;
  physicalWidthPx: number;
  physicalHeightPx: number;
  fitScale: number;
  scale: number;
  scaledWidthPx: number;
  scaledHeightPx: number;
}

export function getLabelPreviewMetrics(
  paperSize?: string,
  maxWidthPx: number = 280,
  maxHeightPx: number = 240,
  actualScale: boolean = false
): LabelPreviewMetrics {
  const { widthMm, heightMm } = parseLabelPaperSize(paperSize);
  const physicalWidthPx = widthMm * MM_TO_PX;
  const physicalHeightPx = heightMm * MM_TO_PX;
  const rawFit = Math.min(maxWidthPx / physicalWidthPx, maxHeightPx / physicalHeightPx);
  const fitScale = Number(Math.max(0.55, Math.min(2.6, rawFit)).toFixed(3));
  const scale = actualScale ? 1 : fitScale;
  return {
    widthMm,
    heightMm,
    physicalWidthPx,
    physicalHeightPx,
    fitScale,
    scale,
    scaledWidthPx: Math.round(physicalWidthPx * scale),
    scaledHeightPx: Math.round(physicalHeightPx * scale)
  };
}

export function getLabelFontFamilyCss(fontFamilyId?: string): string {
  const storedFont = typeof localStorage !== 'undefined' ? localStorage.getItem('lblFontFamily') : null;
  const id = (fontFamilyId || storedFont || 'Cairo').trim();
  switch (id) {
    case 'Tajawal':
      return "'Tajawal', system-ui, sans-serif";
    case 'IBM Plex Sans Arabic':
      return "'IBM Plex Sans Arabic', system-ui, sans-serif";
    case 'Almarai':
      return "'Almarai', system-ui, sans-serif";
    case 'Amiri':
      return "'Amiri', serif";
    case 'monospace':
      return "monospace, 'Courier New'";
    case 'Cairo':
    default:
      return "'Cairo', system-ui, sans-serif";
  }
}

export interface EffectiveLabelContainerStyles {
  widthMm: number;
  heightMm: number;
  paddingMm: number;
  innerWidthMm: number;
  lineSpacing: number;
  textAlign: 'center' | 'right' | 'left';
  alignItems: 'center' | 'flex-start' | 'flex-end';
  fontFamilyCss: string;
}

export function getLabelContainerStyles(layout: LabelLayoutConfig, fontFamilyId?: string): EffectiveLabelContainerStyles {
  const { widthMm, heightMm } = parseLabelPaperSize(layout.paperSize);
  const paddingMm = Number(Math.max(0.3, Math.min(5, Number(layout.padding ?? 1.5))).toFixed(2));
  const lineSpacing = Number(Math.max(0.7, Math.min(2.5, Number(layout.lineSpacing ?? 1.15))).toFixed(2));
  const textAlign = layout.textAlign || 'center';
  // In dir="rtl", flex-start aligns right and flex-end aligns left.
  const alignItems = textAlign === 'right' ? 'flex-start' : textAlign === 'left' ? 'flex-end' : 'center';
  const innerWidthMm = Math.max(12, Number((widthMm - paddingMm * 2).toFixed(2)));
  return {
    widthMm,
    heightMm,
    paddingMm,
    innerWidthMm,
    lineSpacing,
    textAlign,
    alignItems,
    fontFamilyCss: getLabelFontFamilyCss(fontFamilyId)
  };
}

export interface EffectiveLabelElementMetrics {
  fontSizePt: number;
  marginTopMm: number;
  marginBottomMm: number;
  barcodeHeightPx: number;
  barcodeHeightMm: number;
  qrSizePx: number;
  qrSizeMm: number;
}

export function getLabelElementMetrics(
  el: LabelElementConfig,
  layout: LabelLayoutConfig
): EffectiveLabelElementMetrics {
  const lineSpacing = Math.max(0.7, Math.min(2.5, Number(layout.lineSpacing ?? 1.15)));
  const defaultFontPt = el.id === 'center_name' ? 13 : 10;
  const fontSizePt = Math.round(Math.max(10, Math.min(99, el.fontSize ?? defaultFontPt)) * 2) / 2;
  const marginTopMm = Number(((el.marginTop || 0) * lineSpacing * PX_TO_MM).toFixed(3));
  const marginBottomMm = Number(((el.marginBottom || 0) * lineSpacing * PX_TO_MM).toFixed(3));
  const barcodeHeightPx = Math.round(Math.max(10, Math.min(99, el.height ?? 26)));
  const barcodeHeightMm = Number((barcodeHeightPx * PX_TO_MM).toFixed(2));
  const qrSizePx = Math.round(Math.max(10, Math.min(99, el.height ?? 30)));
  const qrSizeMm = Number((qrSizePx * PX_TO_MM).toFixed(2));
  return {
    fontSizePt,
    marginTopMm,
    marginBottomMm,
    barcodeHeightPx,
    barcodeHeightMm,
    qrSizePx,
    qrSizeMm
  };
}

export function fitLabelLayoutToPaper(layout: LabelLayoutConfig): LabelLayoutConfig {
  const { widthMm, heightMm } = parseLabelPaperSize(layout.paperSize);
  const isCompact = heightMm <= 25 || widthMm <= 35;
  const targetPadding = isCompact ? 0.5 : heightMm <= 35 ? 1.0 : 1.5;
  const targetBarcodeHeight = heightMm <= 20 ? 14 : heightMm <= 25 ? 18 : heightMm <= 35 ? 24 : 32;
  const targetQrSize = heightMm <= 20 ? 18 : heightMm <= 25 ? 24 : heightMm <= 35 ? 30 : 42;

  return {
    ...layout,
    padding: targetPadding,
    lineSpacing: isCompact ? 1.0 : 1.1,
    elements: layout.elements.map((el) => ({
      ...el,
      fontSize:
        el.fontSize !== undefined
          ? Math.max(10, Math.min(isCompact ? 11 : 14, el.id === 'center_name' && !isCompact ? 12 : 10))
          : el.fontSize,
      height:
        el.id === 'barcode'
          ? targetBarcodeHeight
          : el.id === 'qr_code'
            ? targetQrSize
            : el.height,
      marginTop: 0,
      marginBottom: isCompact ? 0 : 0.5
    }))
  };
}

export interface SplitThermalLabelMetrics {
  hasQrSide: boolean;
  isCompactHeight: boolean;
  isNarrowWidth: boolean;
  effectivePaddingMm: number;
  effectiveLineSpacing: number;
  effectiveInnerWidthMm: number;
  effectiveInnerHeightMm: number;
  colGapMm: number;
  qrTargetMm: number | undefined;
  splitQrSizeMm: number | undefined;
  compactFontPt: number | undefined;
  verticalColGapMm: number;
  verticalCodeColWidthMm: number;
  getCenterNameFontPt: (centerName: string, baseFontPt: number) => number;
  getCenterMobileFontPt: (mobile: string, baseFontPt: number) => number;
  getCodeFontPt: (code: string, baseFontPt: number) => number;
  getVerticalCenterNameFontPt: (centerName: string) => number;
  getVerticalMobileFontPt: (mobile: string) => number;
  getVerticalCodeFontPt: (code: string) => number;
  getVerticalInfoFontPt: (text: string) => number;
}

export function getSplitThermalLabelMetrics(
  layout: LabelLayoutConfig,
  containerStyles: EffectiveLabelContainerStyles,
  activeElements: LabelElementConfig[]
): SplitThermalLabelMetrics {
  const barcodeEl = activeElements.find((el) => el.id === 'barcode');
  const qrCodeEl = activeElements.find((el) => el.id === 'qr_code');
  const hasQrSide = Boolean(barcodeEl || qrCodeEl);
  const infoElementsCount = hasQrSide
    ? activeElements.filter((el) => el.id !== 'qr_code').length
    : activeElements.length;
  const hasInfoSide = infoElementsCount > 0;

  const isCompactHeight = containerStyles.heightMm <= 24;
  const isNarrowWidth = containerStyles.widthMm <= 36;
  const isMediumCompact = containerStyles.widthMm <= 42 || containerStyles.heightMm <= 26;
  const effectivePaddingMm = isCompactHeight
    ? Math.min(containerStyles.paddingMm, 0.18)
    : isMediumCompact
      ? Math.min(containerStyles.paddingMm, 0.2)
      : Math.min(containerStyles.paddingMm, 0.45);
  const effectiveLineSpacing = isCompactHeight
    ? Math.min(containerStyles.lineSpacing, 1.0)
    : Math.min(containerStyles.lineSpacing, 1.05);

  const effectiveInnerWidthMm = Math.max(
    12,
    Number((containerStyles.widthMm - effectivePaddingMm * 2).toFixed(2))
  );
  const effectiveInnerHeightMm = Math.max(
    10,
    Number((containerStyles.heightMm - effectivePaddingMm * 2).toFixed(2))
  );
  const colGapMm = hasQrSide && hasInfoSide ? (isNarrowWidth ? 0.3 : isMediumCompact ? 0.4 : 0.7) : 0;
  const maxWidthFraction = !hasInfoSide ? 0.99 : isNarrowWidth ? 0.65 : isMediumCompact ? 0.665 : 0.66;
  const qrTargetMm = hasQrSide
    ? Number(
        Math.max(
          11,
          Math.min(
            effectiveInnerHeightMm,
            effectiveInnerWidthMm * maxWidthFraction
          )
        ).toFixed(2)
      )
    : undefined;

  const splitQrSizeMm = barcodeEl && qrCodeEl && qrTargetMm
    ? Number(Math.max(9.5, Math.min(qrTargetMm, (effectiveInnerHeightMm - 0.5) / 2)).toFixed(2))
    : qrTargetMm;

  const textLinesCount = Math.max(1, infoElementsCount);
  const compactFontPt = (isCompactHeight || isNarrowWidth)
    ? (textLinesCount <= 3 ? 6.6 : textLinesCount === 4 ? 6.0 : 5.4)
    : isMediumCompact
      ? (textLinesCount <= 3 ? 7.2 : textLinesCount === 4 ? 6.4 : 5.6)
      : undefined;

  // Vertical-rl column sizing: fit all enabled columns inside remaining right-side width
  // and along full label height (effectiveInnerHeightMm)
  const availableInfoWidthMm = hasQrSide && qrTargetMm
    ? Math.max(8, effectiveInnerWidthMm - qrTargetMm - colGapMm)
    : effectiveInnerWidthMm;
  const verticalColGapMm = textLinesCount <= 3 ? 0.35 : 0.2;
  const usableColWidthPt = Math.max(
    12,
    ((availableInfoWidthMm - Math.max(0, textLinesCount - 1) * verticalColGapMm) / 0.352778)
  );
  // Height budget in pt along the vertical axis (~69.7pt for 24.6mm)
  const heightBudgetPt = effectiveInnerHeightMm / 0.352778;
  const colDensityScale = textLinesCount <= 3 ? 1 : 3 / textLinesCount;

  const fitLengthPt = (
    len: number,
    idealPt: number,
    minPt: number,
    charAspect = 0.62,
    heightFillRatio = 0.92
  ) => {
    const safeLen = Math.max(1, len);
    const maxForHeight = (heightBudgetPt * heightFillRatio) / (safeLen * charAspect);
    return Number(Math.max(minPt, Math.min(idealPt, maxForHeight)).toFixed(1));
  };

  const measureCodeWeightedLen = (code: string): number => {
    const clean = String(code || '').trim();
    if (!clean) return 1;
    let total = 0;
    for (const ch of clean) {
      if (/[A-Z]/.test(ch)) total += 1.06;
      else if (/[0-9]/.test(ch)) total += 1.0;
      else if (/[\-_./]/.test(ch)) total += 0.55;
      else total += 0.9;
    }
    return Math.max(1, total);
  };

  const widthBudgetPt = effectiveInnerWidthMm / 0.352778;
  const usableColWidthMm = usableColWidthPt * 0.352778;
  const verticalCodeColWidthMm = Number(
    Math.max(2.1, Math.min(3.2, usableColWidthMm * (textLinesCount <= 3 ? 0.275 : 0.9 / textLinesCount))).toFixed(2)
  );

  return {
    hasQrSide,
    isCompactHeight,
    isNarrowWidth,
    effectivePaddingMm,
    effectiveLineSpacing,
    effectiveInnerWidthMm,
    effectiveInnerHeightMm,
    colGapMm,
    qrTargetMm,
    splitQrSizeMm,
    compactFontPt,
    verticalColGapMm,
    verticalCodeColWidthMm,
    getCenterNameFontPt: (centerName: string, baseFontPt: number) => {
      const cleanName = String(centerName || '').trim();
      if (isNarrowWidth) {
        return cleanName.length <= 7 ? 8.8 : cleanName.length <= 11 ? 7.2 : 6.0;
      }
      if (isMediumCompact) {
        return cleanName.length <= 7 ? 9.4 : cleanName.length <= 12 ? 7.8 : 6.4;
      }
      return Math.max(baseFontPt + 1.5, 10.5);
    },
    getCenterMobileFontPt: (mobile: string, baseFontPt: number) => {
      const cleanMob = String(mobile || '').trim();
      if (isNarrowWidth) {
        return cleanMob.length <= 10 ? 6.0 : cleanMob.length <= 12 ? 5.4 : 4.8;
      }
      if (isMediumCompact) {
        return cleanMob.length <= 10 ? 6.6 : cleanMob.length <= 12 ? 5.8 : 5.2;
      }
      return Math.min(baseFontPt, cleanMob.length > 12 ? 7.5 : 8.8);
    },
    getCodeFontPt: (code: string, baseFontPt: number) => {
      const cleanCode = String(code || '').trim();
      const weightedLen = measureCodeWeightedLen(cleanCode);
      const maxForWidth = (widthBudgetPt * 0.9) / (weightedLen * 0.72);
      const baseCap = isNarrowWidth
        ? (cleanCode.length <= 11 ? 5.6 : cleanCode.length <= 13 ? 4.8 : 4.2)
        : isMediumCompact
          ? (cleanCode.length <= 11 ? 6.2 : cleanCode.length <= 13 ? 5.1 : 4.5)
          : Math.min(baseFontPt, 8.2);
      return Number(Math.max(3.6, Math.min(baseCap, maxForWidth)).toFixed(1));
    },
    getVerticalCenterNameFontPt: (centerName: string) => {
      const clean = String(centerName || '').trim();
      const maxWidthShare = usableColWidthPt * 0.43;
      const ideal = Math.min(maxWidthShare, 15.0 * colDensityScale);
      return fitLengthPt(clean.length, Math.max(7.0, ideal), 5.0, 0.72, 0.92);
    },
    getVerticalMobileFontPt: (mobile: string) => {
      const clean = String(mobile || '').trim();
      const maxWidthShare = usableColWidthPt * 0.31;
      const ideal = Math.min(maxWidthShare, 11.2 * colDensityScale);
      return fitLengthPt(clean.length, Math.max(5.5, ideal), 4.2, 0.68, 0.9);
    },
    getVerticalCodeFontPt: (code: string) => {
      const weightedLen = measureCodeWeightedLen(code);
      const maxWidthShare = usableColWidthPt * 0.275;
      const ideal = Math.min(maxWidthShare, 9.2 * colDensityScale);
      return fitLengthPt(weightedLen, Math.max(5.5, ideal), 3.8, 0.63, 0.97);
    },
    getVerticalInfoFontPt: (text: string) => {
      const clean = String(text || '').trim();
      const maxPerCol = (usableColWidthPt / textLinesCount) * 0.92;
      return fitLengthPt(clean.length, Math.min(maxPerCol, 7.8), 4.2, 0.6, 0.9);
    },
  };
}

export interface VerticalOrderIdSvgSpec {
  code: string;
  widthMm: number;
  heightMm: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
  cx: number;
  cy: number;
  fontSizeUnits: number;
  dyUnits: number;
  textLengthUnits?: number;
}

/**
 * Computes exact SVG dimensions so the vertical orderId fills the full inner height
 * of the label column (aligned top-to-bottom with the QR code) without ever overflowing.
 */
export function getVerticalOrderIdSvgSpec(
  code: string,
  splitMetrics: SplitThermalLabelMetrics
): VerticalOrderIdSvgSpec {
  const cleanCode = String(code || '').trim();
  const heightMm = splitMetrics.effectiveInnerHeightMm;
  const maxColWidthMm = splitMetrics.verticalCodeColWidthMm;
  const fontPt = splitMetrics.getVerticalCodeFontPt(cleanCode);
  const fontMm = fontPt * 0.352778;
  // Cap height of bold uppercase/digits is ~0.72em; keep column snug around glyph thickness
  const widthMm = Number(
    Math.max(2.0, Math.min(maxColWidthMm, Math.max(fontMm * 0.92, maxColWidthMm * 0.88))).toFixed(2)
  );

  // Use 10 viewBox units per mm for crisp vector precision
  const viewBoxWidth = Number((widthMm * 10).toFixed(2));
  const viewBoxHeight = Number((heightMm * 10).toFixed(2));
  const cx = Number((viewBoxWidth / 2).toFixed(2));
  const cy = Number((viewBoxHeight / 2).toFixed(2));

  // Ensure glyph cap height fits cleanly inside the column width (leaving tiny side clearance)
  const maxFontUnitsForCol = (viewBoxWidth * 0.96) / 0.72;
  const fontSizeUnits = Number(Math.min(fontMm * 10, maxFontUnitsForCol).toFixed(2));
  const dyUnits = Number((fontSizeUnits * 0.355).toFixed(2));

  // Fill 98% of the column height edge-to-edge without ever overflowing for standard/long IDs
  const targetFillUnits = Number((viewBoxHeight * 0.98).toFixed(2));
  const shouldFitToFullHeight = cleanCode.length >= 8;

  return {
    code: cleanCode,
    widthMm,
    heightMm,
    viewBoxWidth,
    viewBoxHeight,
    cx,
    cy,
    fontSizeUnits,
    dyUnits,
    textLengthUnits: shouldFitToFullHeight ? targetFillUnits : undefined,
  };
}

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderVerticalOrderIdSvg(
  code: string,
  splitMetrics: SplitThermalLabelMetrics
): string {
  const spec = getVerticalOrderIdSvgSpec(code, splitMetrics);
  const textLenAttrs = spec.textLengthUnits
    ? ` textLength="${spec.textLengthUnits}" lengthAdjust="spacingAndGlyphs"`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.widthMm}mm" height="${spec.heightMm}mm" viewBox="0 0 ${spec.viewBoxWidth} ${spec.viewBoxHeight}" style="width: ${spec.widthMm}mm !important; height: ${spec.heightMm}mm !important; display: block !important; flex-shrink: 0 !important; overflow: visible !important;"><text x="${spec.cx}" y="${spec.cy}" dy="${spec.dyUnits}" transform="rotate(90 ${spec.cx} ${spec.cy})" text-anchor="middle"${textLenAttrs} fill="#000000" font-family="system-ui, -apple-system, 'Cairo', Arial, sans-serif" font-size="${spec.fontSizeUnits}" font-weight="900" style="font-variant-numeric: tabular-nums;">${escapeXmlText(spec.code)}</text></svg>`;
}



