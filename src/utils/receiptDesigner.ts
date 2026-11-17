export type ReceiptElementId =
  | 'header_logo'
  | 'center_info'
  | 'invoice_badge'
  | 'customer_info'
  | 'device_info'
  | 'fault_info'
  | 'cost_info'
  | 'barcode_section'
  | 'qr_section'
  | 'terms_section'
  | 'footer_thanks';

export interface ReceiptElementConfig {
  id: ReceiptElementId;
  label: string;
  enabled: boolean;
  fontSize?: number; // pt or px
  height?: number; // for logo, barcode, QR in px
  width?: number; // width multiplier or px
  marginTop?: number; // spacing before (px)
  marginBottom?: number; // spacing after (px)
  bold?: boolean;
  textAlign?: 'center' | 'right' | 'left';
  customText?: string;
}

export interface ReceiptLayoutConfig {
  paperSize: '80mm' | '58mm' | 'A5' | 'A4';
  zoom: number; // 80 to 130 %
  lineSpacing: number; // 0.8 to 2.0
  padding: number; // 1 to 20 mm
  textAlign: 'center' | 'right' | 'left';
  fontFamily: string;
  elements: ReceiptElementConfig[];
}

export const DEFAULT_RECEIPT_ELEMENTS: ReceiptElementConfig[] = [
  {
    id: 'header_logo',
    label: 'شعار المركز (Logo)',
    enabled: true,
    height: 48,
    marginTop: 0,
    marginBottom: 4,
    textAlign: 'center'
  },
  {
    id: 'center_info',
    label: 'بيانات المركز (الاسم، المهندس، الهاتف)',
    enabled: true,
    fontSize: 13,
    bold: true,
    marginTop: 0,
    marginBottom: 6,
    textAlign: 'center'
  },
  {
    id: 'invoice_badge',
    label: 'ترويسة الفاتورة (رقم الطلب والتاريخ والوقت)',
    enabled: true,
    fontSize: 11,
    bold: true,
    marginTop: 2,
    marginBottom: 6,
    textAlign: 'center'
  },
  {
    id: 'customer_info',
    label: 'بيانات العميل (الاسم ورقم الهاتف)',
    enabled: true,
    fontSize: 11,
    bold: false,
    marginTop: 2,
    marginBottom: 4,
    textAlign: 'right'
  },
  {
    id: 'device_info',
    label: 'بيانات الجهاز (النوع، الموديل، السيريال)',
    enabled: true,
    fontSize: 11,
    bold: false,
    marginTop: 2,
    marginBottom: 4,
    textAlign: 'right'
  },
  {
    id: 'fault_info',
    label: 'العطل المشخص وملاحظات الفحص',
    enabled: true,
    fontSize: 10.5,
    bold: false,
    marginTop: 2,
    marginBottom: 6,
    textAlign: 'right'
  },
  {
    id: 'cost_info',
    label: 'التكلفة المالية والدفعة المقدمة والمتبقي',
    enabled: true,
    fontSize: 12,
    bold: true,
    marginTop: 4,
    marginBottom: 6,
    textAlign: 'right'
  },
  {
    id: 'barcode_section',
    label: 'باركود تتبع الفاتورة ورقم الطلب',
    enabled: true,
    height: 38,
    width: 1.3,
    fontSize: 11,
    marginTop: 4,
    marginBottom: 6,
    textAlign: 'center'
  },
  {
    id: 'qr_section',
    label: 'رمز QR لتتبع حالة الصيانة بالجوال',
    enabled: true,
    height: 52,
    marginTop: 4,
    marginBottom: 6,
    textAlign: 'center'
  },
  {
    id: 'terms_section',
    label: 'شروط وأحكام الصيانة والضمان',
    enabled: true,
    fontSize: 10,
    bold: false,
    marginTop: 6,
    marginBottom: 6,
    textAlign: 'center'
  },
  {
    id: 'footer_thanks',
    label: 'تذييل الإيصال (شكراً لثقتكم بنا)',
    enabled: true,
    fontSize: 10,
    bold: true,
    marginTop: 4,
    marginBottom: 2,
    textAlign: 'center'
  }
];

export function getDefaultReceiptLayout(): ReceiptLayoutConfig {
  return {
    paperSize: (localStorage.getItem('rcptSize') as any) || '80mm',
    zoom: Number(localStorage.getItem('rcptZoom')) || 100,
    lineSpacing: 1.2,
    padding: 6,
    textAlign: 'right',
    fontFamily: localStorage.getItem('rcptFontFamily') || 'Cairo',
    elements: JSON.parse(JSON.stringify(DEFAULT_RECEIPT_ELEMENTS))
  };
}

export function getStoredReceiptLayout(): ReceiptLayoutConfig {
  const saved = localStorage.getItem('receipt_layout_config');
  if (saved) {
    try {
      const parsed: ReceiptLayoutConfig = JSON.parse(saved);
      const existingIds = new Set(parsed.elements.map(e => e.id));
      const missing = DEFAULT_RECEIPT_ELEMENTS.filter(d => !existingIds.has(d.id));
      if (missing.length > 0) {
        parsed.elements = [...parsed.elements, ...missing];
      }
      parsed.elements = parsed.elements.map(el => ({
        ...el,
        fontSize: el.fontSize !== undefined ? Math.max(10, Math.min(99, el.fontSize)) : undefined,
        height: el.height !== undefined ? Math.max(10, Math.min(99, el.height)) : undefined,
      }));
      return parsed;
    } catch (e) {
      console.error('Failed to parse receipt_layout_config', e);
    }
  }

  return getDefaultReceiptLayout();
}

export function saveStoredReceiptLayout(config: ReceiptLayoutConfig): void {
  localStorage.setItem('receipt_layout_config', JSON.stringify(config));
  localStorage.setItem('rcptSize', config.paperSize);
  localStorage.setItem('rcptZoom', String(config.zoom));
  localStorage.setItem('rcptFontFamily', config.fontFamily);
  window.dispatchEvent(new Event('storage'));
}

export function reorderReceiptElements(
  elements: ReceiptElementConfig[],
  fromIndex: number,
  toIndex: number
): ReceiptElementConfig[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= elements.length || toIndex >= elements.length) {
    return elements;
  }
  const result = [...elements];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

export interface ReceiptPaperMetrics {
  printWidth: string;
  pageSize: string;
  screenMaxWidthPx: number;
  maxBarcodeMm: number;
}

export function getReceiptPaperMetrics(paperSize?: string): ReceiptPaperMetrics {
  switch (paperSize) {
    case '58mm':
      return {
        printWidth: '58mm',
        pageSize: '58mm auto',
        screenMaxWidthPx: 250,
        maxBarcodeMm: 50,
      };
    case 'A5':
      return {
        printWidth: '148mm',
        pageSize: 'A5 portrait',
        screenMaxWidthPx: 480,
        maxBarcodeMm: 90,
      };
    case 'A4':
      return {
        printWidth: '210mm',
        pageSize: 'A4 portrait',
        screenMaxWidthPx: 620,
        maxBarcodeMm: 100,
      };
    case '80mm':
    default:
      return {
        printWidth: '80mm',
        pageSize: '80mm auto',
        screenMaxWidthPx: 330,
        maxBarcodeMm: 72,
      };
  }
}

/**
 * Returns a responsive CSS font-size that honors the user's configured point size (10pt–99pt)
 * while automatically scaling down on narrow screens or compact 58mm paper so text never overflows.
 */
export function getResponsiveReceiptFontSize(
  fontSize: number | undefined,
  fallbackPt: number,
  paperSize?: string
): string {
  const pt = Math.max(10, Math.min(99, fontSize ?? fallbackPt));
  const vwCap = paperSize === '58mm'
    ? Math.max(5.5, Math.min(13, pt * 0.48))
    : Math.max(6.5, Math.min(16, pt * 0.55));
  return `min(${pt}pt, ${vwCap.toFixed(2)}vw)`;
}

/**
 * Aligns tight-fitting (w-fit max-w-full) receipt element boxes inside a vertical RTL flex column.
 */
export function getReceiptAlignmentClass(textAlign?: 'center' | 'right' | 'left'): string {
  if (textAlign === 'left') return 'self-end';
  if (textAlign === 'right') return 'self-start';
  return 'self-center';
}

