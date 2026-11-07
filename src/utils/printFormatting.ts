export interface PrintFormatConfig {
  fontFamily: string;
  fontSize: number; // in px or pt
  textAlign: 'right' | 'center' | 'left';
  verticalAlign: 'top' | 'center' | 'bottom';
  lineHeight: number; // multiplier like 1.0, 1.25, 1.5
  fontWeight: 'normal' | 'bold' | '900';
}

export const ARABIC_FONTS = [
  { id: 'Cairo', label: 'القاهرة (Cairo)', css: "'Cairo', system-ui, sans-serif" },
  { id: 'Tajawal', label: 'تجوال (Tajawal)', css: "'Tajawal', system-ui, sans-serif" },
  { id: 'IBM Plex Sans Arabic', label: 'آي بي إم (IBM Plex)', css: "'IBM Plex Sans Arabic', system-ui, sans-serif" },
  { id: 'Almarai', label: 'المراعي (Almarai)', css: "'Almarai', system-ui, sans-serif" },
  { id: 'Amiri', label: 'الأميري (Amiri)', css: "'Amiri', serif" },
  { id: 'monospace', label: 'أحادي (Monospace)', css: "monospace, 'Courier New'" }
];

export const LINE_HEIGHT_OPTIONS = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0];

export const RECEIPT_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18];
export const LABEL_FONT_SIZES = [6, 7, 8, 9, 10, 11, 12, 14];

export function getStoredReceiptFormat(): PrintFormatConfig {
  return {
    fontFamily: localStorage.getItem('rcptFontFamily') || 'Cairo',
    fontSize: Number(localStorage.getItem('rcptFontSize')) || 12,
    textAlign: 'center',
    verticalAlign: 'center',
    lineHeight: Number(localStorage.getItem('rcptLineHeight')) || 1.3,
    fontWeight: (localStorage.getItem('rcptFontWeight') as any) || 'normal'
  };
}

export function getStoredLabelFormat(): PrintFormatConfig {
  return {
    fontFamily: localStorage.getItem('lblFontFamily') || 'Cairo',
    fontSize: Number(localStorage.getItem('lblFontSize')) || 8,
    textAlign: 'center',
    verticalAlign: 'center',
    lineHeight: Number(localStorage.getItem('lblLineHeight')) || 1.15,
    fontWeight: (localStorage.getItem('lblFontWeight') as any) || 'bold'
  };
}
