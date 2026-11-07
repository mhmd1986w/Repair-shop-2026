/**
 * Utility functions for generating and formatting barcodes based on:
 * - 3-letter prefix (customizable and selectable by user)
 * - 2 digits for Year (YY)
 * - 2 digits for Month (MM)
 * - 2 digits for Hour (HH - 24-hour format)
 * - 2 digits for Minutes (mm)
 * Example: TEC26111604
 */

export const DEFAULT_BARCODE_PREFIX = 'TEC';

/**
 * Common 3-letter prefix options for quick user selection
 */
export const BARCODE_PREFIX_PRESETS = [
  { code: 'TEC', label: 'TEC (تكنو)' },
  { code: 'TCH', label: 'TCH (صيانة)' },
  { code: 'FIX', label: 'FIX (إصلاح)' },
  { code: 'REP', label: 'REP (تصليح)' },
  { code: 'SRV', label: 'SRV (خدمة)' },
  { code: 'DEV', label: 'DEV (جهاز)' },
  { code: 'WRK', label: 'WRK (ورشة)' },
  { code: 'MOB', label: 'MOB (موبايل)' },
];

/**
 * Cleans and normalizes a 3-letter prefix
 */
export function sanitizeBarcodePrefix(prefix?: string): string {
  if (!prefix) return DEFAULT_BARCODE_PREFIX;
  const cleaned = prefix
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
  return cleaned.length > 0 ? cleaned : DEFAULT_BARCODE_PREFIX;
}

/**
 * Formats a Date object into YYMMHHmm (2 digits year, 2 digits month, 2 digits hour 24h, 2 digits minute)
 */
export function formatDateTimeForBarcode(date: Date = new Date()): {
  year: string;
  month: string;
  hour: string;
  minute: string;
  combined: string;
} {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const combined = `${year}${month}${hour}${minute}`;

  return { year, month, hour, minute, combined };
}

/**
 * Generates an order barcode ID according to user requirements:
 * [3-letter prefix] + [YY] + [MM] + [HH] + [mm]
 * If collision occurs with an existing order in the same minute, appends seconds or unique counter suffix.
 */
export function generateBarcodeId(
  prefix?: string,
  existingIds: string[] = [],
  customDate: Date = new Date()
): string {
  const cleanPrefix = sanitizeBarcodePrefix(prefix);
  const { combined } = formatDateTimeForBarcode(customDate);
  const base = `${cleanPrefix}${combined}`;

  // If not collided, return base directly (e.g. TEC26111604)
  if (!existingIds.includes(base)) {
    return base;
  }

  // If collision exists in the same minute, append seconds (e.g. TEC2611160435)
  const ss = String(customDate.getSeconds()).padStart(2, '0');
  const withSeconds = `${base}${ss}`;
  if (!existingIds.includes(withSeconds)) {
    return withSeconds;
  }

  // Fallback sequential counter
  let counter = 1;
  while (existingIds.includes(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

/**
 * Deconstructs a barcode string to extract components for display/tooltips
 */
export function parseBarcodeId(barcode: string): {
  prefix: string;
  year: string;
  month: string;
  hour: string;
  minute: string;
  isValidDateTimeFormat: boolean;
} {
  if (!barcode || barcode.length < 11) {
    return {
      prefix: barcode ? barcode.slice(0, 3) : '',
      year: '',
      month: '',
      hour: '',
      minute: '',
      isValidDateTimeFormat: false
    };
  }

  const prefix = barcode.slice(0, 3);
  const yearDigits = barcode.slice(3, 5);
  const monthDigits = barcode.slice(5, 7);
  const hourDigits = barcode.slice(7, 9);
  const minuteDigits = barcode.slice(9, 11);

  const isValid = 
    /^\d{2}$/.test(yearDigits) &&
    /^\d{2}$/.test(monthDigits) &&
    /^\d{2}$/.test(hourDigits) &&
    /^\d{2}$/.test(minuteDigits);

  return {
    prefix,
    year: `20${yearDigits}`,
    month: monthDigits,
    hour: `${hourDigits}:00`,
    minute: minuteDigits,
    isValidDateTimeFormat: isValid
  };
}
