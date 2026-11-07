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
    fontSize: 7,
    bold: true,
    marginTop: 0,
    marginBottom: 1
  },
  {
    id: 'customer_name',
    label: 'اسم العميل',
    enabled: true,
    fontSize: 7.5,
    bold: true,
    marginTop: 0.5,
    marginBottom: 0.5
  },
  {
    id: 'device_model',
    label: 'نوع وموديل الجهاز',
    enabled: true,
    fontSize: 7.5,
    bold: true,
    marginTop: 0,
    marginBottom: 0.5
  },
  {
    id: 'order_date',
    label: 'تاريخ الاستلام',
    enabled: true,
    fontSize: 6.5,
    bold: false,
    marginTop: 0,
    marginBottom: 1
  },
  {
    id: 'barcode',
    label: 'الباركود ورقم الطلب',
    enabled: true,
    fontSize: 8,
    height: 26,
    width: 1.2,
    marginTop: 0.5,
    marginBottom: 1
  },
  {
    id: 'qr_code',
    label: 'رمز الاستجابة السريعة (QR)',
    enabled: false,
    fontSize: 7,
    height: 30,
    marginTop: 0.5,
    marginBottom: 1
  },
  {
    id: 'custom_text',
    label: 'نص إضافي مخصص',
    enabled: false,
    fontSize: 6.5,
    bold: false,
    marginTop: 0.5,
    marginBottom: 0,
    customContent: 'يرجى إبراز هذا الملصق عند الاستلام'
  }
];

export function getDefaultLabelLayout(): LabelLayoutConfig {
  return {
    paperSize: '50x30',
    lineSpacing: 1.15,
    padding: 1.5,
    textAlign: 'center',
    zoom: 100,
    elements: JSON.parse(JSON.stringify(DEFAULT_LABEL_ELEMENTS))
  };
}

export function getStoredLabelLayout(): LabelLayoutConfig {
  const saved = localStorage.getItem('label_layout_config');
  if (saved) {
    try {
      const parsed: LabelLayoutConfig = JSON.parse(saved);
      // Ensure all default elements exist in parsed config (in case new elements were added)
      const existingIds = new Set(parsed.elements.map(e => e.id));
      const missing = DEFAULT_LABEL_ELEMENTS.filter(d => !existingIds.has(d.id));
      if (missing.length > 0) {
        parsed.elements = [...parsed.elements, ...missing];
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse label_layout_config', e);
    }
  }

  // Fallback to legacy individual keys
  const defaultLayout = getDefaultLabelLayout();
  const legacyPaperSize = localStorage.getItem('lblPaperSize') || '50x30';
  const legacyLineSpacing = Number(localStorage.getItem('lblLineSpacing')) || 1.15;
  const legacyZoom = Number(localStorage.getItem('lblZoom')) || 100;

  defaultLayout.paperSize = legacyPaperSize;
  defaultLayout.lineSpacing = legacyLineSpacing;
  defaultLayout.zoom = legacyZoom;

  // Sync element enabled and sizes from legacy keys
  defaultLayout.elements = defaultLayout.elements.map(el => {
    switch (el.id) {
      case 'center_name':
        return {
          ...el,
          enabled: localStorage.getItem('lblShowCenterName') !== 'false',
          fontSize: Number(localStorage.getItem('lblFontSizeCenterName')) || el.fontSize
        };
      case 'center_mobile':
        return {
          ...el,
          enabled: localStorage.getItem('lblShowMobile') !== 'false',
          fontSize: Number(localStorage.getItem('lblFontSizeMobile')) || el.fontSize
        };
      case 'customer_name':
        return {
          ...el,
          enabled: localStorage.getItem('lblShowCustomerName') !== 'false',
          fontSize: Number(localStorage.getItem('lblFontSizeCustomerName')) || el.fontSize
        };
      case 'device_model':
        return {
          ...el,
          enabled: localStorage.getItem('lblShowDeviceModel') !== 'false',
          fontSize: Number(localStorage.getItem('lblFontSizeDeviceModel')) || el.fontSize
        };
      case 'order_date':
        return {
          ...el,
          enabled: localStorage.getItem('lblShowDate') !== 'false',
          fontSize: Number(localStorage.getItem('lblFontSizeDate')) || el.fontSize
        };
      case 'barcode':
        return {
          ...el,
          enabled: localStorage.getItem('lblShowBarcode') !== 'false',
          height: Number(localStorage.getItem('lblBarcodeHeight')) || el.height,
          width: Number(localStorage.getItem('lblBarcodeWidth')) || el.width,
          fontSize: Number(localStorage.getItem('lblFontSizeBarcodeText')) || el.fontSize
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
  localStorage.setItem('label_layout_config', JSON.stringify(config));
  localStorage.setItem('lblPaperSize', config.paperSize);
  localStorage.setItem('lblLineSpacing', String(config.lineSpacing));
  localStorage.setItem('lblZoom', String(config.zoom));

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
