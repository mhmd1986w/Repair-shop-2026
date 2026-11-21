/**
 * Utility functions for generating and formatting order numbers / barcodes based on:
 * - 3-character customizable prefix (***)
 * - 2 digits for Year (yy)
 * - 2 digits for Month (mm)
 * - 2 digits for Day (dd)
 * - 2 digits for Hour (hh - 24-hour format)
 * - 2 digits for Minutes (mm)
 * Computed in the local timezone of the selected country.
 * Example: TEC2611151604
 */

import JsBarcode from 'jsbarcode';
import { isValidQrAlphanumeric, renderAlphanumericQrSvg, sanitizeQrAlphanumeric } from './qrAlphanumeric';

export const DEFAULT_BARCODE_PREFIX = 'TEC';

export interface CountryTimeZoneOptions {
  countryName?: string;
  countryDialCode?: string;
  timeZone?: string;
}

const COUNTRY_NAME_TO_TIMEZONE: Record<string, string> = {
  'الأردن': 'Asia/Amman',
  'الاردن': 'Asia/Amman',
  'jordan': 'Asia/Amman',
  'السعودية': 'Asia/Riyadh',
  'المملكة العربية السعودية': 'Asia/Riyadh',
  'saudi arabia': 'Asia/Riyadh',
  'الإمارات': 'Asia/Dubai',
  'الامارات': 'Asia/Dubai',
  'uae': 'Asia/Dubai',
  'united arab emirates': 'Asia/Dubai',
  'مصر': 'Africa/Cairo',
  'egypt': 'Africa/Cairo',
  'العراق': 'Asia/Baghdad',
  'iraq': 'Asia/Baghdad',
  'الكويت': 'Asia/Kuwait',
  'kuwait': 'Asia/Kuwait',
  'قطر': 'Asia/Qatar',
  'qatar': 'Asia/Qatar',
  'البحرين': 'Asia/Bahrain',
  'bahrain': 'Asia/Bahrain',
  'عُمان': 'Asia/Muscat',
  'عمان': 'Asia/Muscat',
  'oman': 'Asia/Muscat',
  'فلسطين': 'Asia/Hebron',
  'palestine': 'Asia/Hebron',
  'سوريا': 'Asia/Damascus',
  'syria': 'Asia/Damascus',
  'لبنان': 'Asia/Beirut',
  'lebanon': 'Asia/Beirut',
  'اليمن': 'Asia/Aden',
  'yemen': 'Asia/Aden',
  'ليبيا': 'Africa/Tripoli',
  'libya': 'Africa/Tripoli',
  'تونس': 'Africa/Tunis',
  'tunisia': 'Africa/Tunis',
  'الجزائر': 'Africa/Algiers',
  'algeria': 'Africa/Algiers',
  'المغرب': 'Africa/Casablanca',
  'morocco': 'Africa/Casablanca',
  'السودان': 'Africa/Khartoum',
  'sudan': 'Africa/Khartoum',
  'موريتانيا': 'Africa/Nouakchott',
  'mauritania': 'Africa/Nouakchott',
  'تركيا': 'Europe/Istanbul',
  'turkey': 'Europe/Istanbul',
  'الولايات المتحدة': 'America/New_York',
  'امريكا': 'America/New_York',
  'أمريكا': 'America/New_York',
  'united states': 'America/New_York',
  'usa': 'America/New_York',
  'المملكة المتحدة': 'Europe/London',
  'بريطانيا': 'Europe/London',
  'united kingdom': 'Europe/London',
  'uk': 'Europe/London',
  'كندا': 'America/Toronto',
  'canada': 'America/Toronto',
  'ألمانيا': 'Europe/Berlin',
  'المانيا': 'Europe/Berlin',
  'germany': 'Europe/Berlin',
  'فرنسا': 'Europe/Paris',
  'france': 'Europe/Paris',
  'إيطاليا': 'Europe/Rome',
  'ايطاليا': 'Europe/Rome',
  'italy': 'Europe/Rome',
  'إسبانيا': 'Europe/Madrid',
  'اسبانيا': 'Europe/Madrid',
  'spain': 'Europe/Madrid',
  'السويد': 'Europe/Stockholm',
  'sweden': 'Europe/Stockholm',
  'النرويج': 'Europe/Oslo',
  'norway': 'Europe/Oslo',
  'الدنمارك': 'Europe/Copenhagen',
  'denmark': 'Europe/Copenhagen',
  'هولندا': 'Europe/Amsterdam',
  'netherlands': 'Europe/Amsterdam',
  'بلجيكا': 'Europe/Brussels',
  'belgium': 'Europe/Brussels',
  'سويسرا': 'Europe/Zurich',
  'switzerland': 'Europe/Zurich',
  'النمسا': 'Europe/Vienna',
  'austria': 'Europe/Vienna',
  'أستراليا': 'Australia/Sydney',
  'استراليا': 'Australia/Sydney',
  'australia': 'Australia/Sydney',
  'ماليزيا': 'Asia/Kuala_Lumpur',
  'malaysia': 'Asia/Kuala_Lumpur',
  'إندونيسيا': 'Asia/Jakarta',
  'اندونيسيا': 'Asia/Jakarta',
  'indonesia': 'Asia/Jakarta',
  'الهند': 'Asia/Kolkata',
  'india': 'Asia/Kolkata',
  'باكستان': 'Asia/Karachi',
  'pakistan': 'Asia/Karachi',
};

const DIAL_CODE_TO_TIMEZONE: Record<string, string> = {
  '962': 'Asia/Amman',
  '966': 'Asia/Riyadh',
  '971': 'Asia/Dubai',
  '20': 'Africa/Cairo',
  '964': 'Asia/Baghdad',
  '965': 'Asia/Kuwait',
  '974': 'Asia/Qatar',
  '973': 'Asia/Bahrain',
  '968': 'Asia/Muscat',
  '970': 'Asia/Hebron',
  '972': 'Asia/Hebron',
  '963': 'Asia/Damascus',
  '961': 'Asia/Beirut',
  '967': 'Asia/Aden',
  '218': 'Africa/Tripoli',
  '216': 'Africa/Tunis',
  '213': 'Africa/Algiers',
  '212': 'Africa/Casablanca',
  '249': 'Africa/Khartoum',
  '222': 'Africa/Nouakchott',
  '90': 'Europe/Istanbul',
  '1': 'America/New_York',
  '44': 'Europe/London',
  '49': 'Europe/Berlin',
  '33': 'Europe/Paris',
  '39': 'Europe/Rome',
  '34': 'Europe/Madrid',
  '46': 'Europe/Stockholm',
  '47': 'Europe/Oslo',
  '45': 'Europe/Copenhagen',
  '31': 'Europe/Amsterdam',
  '32': 'Europe/Brussels',
  '41': 'Europe/Zurich',
  '43': 'Europe/Vienna',
  '61': 'Australia/Sydney',
  '60': 'Asia/Kuala_Lumpur',
  '62': 'Asia/Jakarta',
  '91': 'Asia/Kolkata',
  '92': 'Asia/Karachi',
};

function isValidIanaTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeCountryLookupKey(name: string): string {
  return name
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .toLowerCase();
}

/**
 * Resolves the IANA timezone identifier for the active or specified country.
 */
export function resolveCountryTimeZone(options?: CountryTimeZoneOptions): string {
  if (options?.timeZone && isValidIanaTimeZone(options.timeZone)) {
    return options.timeZone;
  }

  const storedCountryName =
    typeof window !== 'undefined' && typeof localStorage !== 'undefined'
      ? localStorage.getItem('countryName') || ''
      : '';
  const storedDialCode =
    typeof window !== 'undefined' && typeof localStorage !== 'undefined'
      ? localStorage.getItem('countryDialCode') || ''
      : '';

  const rawCountry = (options?.countryName ?? storedCountryName).trim();
  const rawDial = (options?.countryDialCode ?? storedDialCode)
    .replace(/[^\d]/g, '')
    .replace(/^0+/, '');

  if (rawCountry) {
    const direct = COUNTRY_NAME_TO_TIMEZONE[rawCountry] || COUNTRY_NAME_TO_TIMEZONE[rawCountry.toLowerCase()];
    if (direct && isValidIanaTimeZone(direct)) return direct;

    const normalized = normalizeCountryLookupKey(rawCountry);
    for (const [key, tz] of Object.entries(COUNTRY_NAME_TO_TIMEZONE)) {
      if (normalizeCountryLookupKey(key) === normalized && isValidIanaTimeZone(tz)) {
        return tz;
      }
    }
  }

  if (rawDial && DIAL_CODE_TO_TIMEZONE[rawDial] && isValidIanaTimeZone(DIAL_CODE_TO_TIMEZONE[rawDial])) {
    return DIAL_CODE_TO_TIMEZONE[rawDial];
  }

  // Default app country when nothing is configured yet is الأردن (+962)
  if (!rawCountry && !rawDial && isValidIanaTimeZone('Asia/Amman')) {
    return 'Asia/Amman';
  }

  try {
    const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (systemTz && isValidIanaTimeZone(systemTz)) {
      return systemTz;
    }
  } catch {
    // Ignore Intl errors
  }

  return 'Asia/Amman';
}

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
 * Cleans and normalizes a 3-character prefix (***)
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
 * Formats a Date object into yymmddhhmm (2 digits year, 2 digits month, 2 digits day,
 * 2 digits hour in 24-hour format [00-23], 2 digits minute) using the country's local timezone.
 */
export function formatDateTimeForBarcode(
  date: Date = new Date(),
  tzOptions?: CountryTimeZoneOptions
): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  timeZone: string;
  combined: string;
} {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const timeZone = resolveCountryTimeZone(tzOptions);

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      numberingSystem: 'latn',
    });

    const parts = formatter.formatToParts(safeDate);
    const getPart = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value || '';

    const year = getPart('year').slice(-2).padStart(2, '0');
    const month = getPart('month').padStart(2, '0');
    const day = getPart('day').padStart(2, '0');
    const rawHour = Number(getPart('hour'));
    const hour = String(Number.isFinite(rawHour) ? rawHour % 24 : 0).padStart(2, '0');
    const minute = getPart('minute').padStart(2, '0');
    const second = getPart('second').padStart(2, '0');
    const combined = `${year}${month}${day}${hour}${minute}`;

    if (/^\d{10}$/.test(combined)) {
      return { year, month, day, hour, minute, second, timeZone, combined };
    }
  } catch {
    // Fallback below if Intl fails in an unexpected environment
  }

  const year = String(safeDate.getFullYear()).slice(-2).padStart(2, '0');
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');
  const hour = String(safeDate.getHours() % 24).padStart(2, '0');
  const minute = String(safeDate.getMinutes()).padStart(2, '0');
  const second = String(safeDate.getSeconds()).padStart(2, '0');
  const combined = `${year}${month}${day}${hour}${minute}`;

  return { year, month, day, hour, minute, second, timeZone, combined };
}

/**
 * Formats a timestamp/Date as YYYY-MM-DD in the active country's local timezone.
 */
export function formatCountryDateYmd(
  dateInput: Date | number | string = new Date(),
  tzOptions?: CountryTimeZoneOptions
): string {
  const safeDate =
    dateInput instanceof Date
      ? dateInput
      : new Date(dateInput || Date.now());
  const validDate = Number.isNaN(safeDate.getTime()) ? new Date() : safeDate;
  const timeZone = resolveCountryTimeZone(tzOptions);

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      numberingSystem: 'latn',
    });
    const parts = formatter.formatToParts(validDate);
    const getPart = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value || '';
    const y = getPart('year');
    const m = getPart('month').padStart(2, '0');
    const d = getPart('day').padStart(2, '0');
    if (y && m && d) {
      return `${y}-${m}-${d}`;
    }
  } catch {
    // Fallback below
  }

  const y = validDate.getFullYear();
  const m = String(validDate.getMonth() + 1).padStart(2, '0');
  const d = String(validDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats a timestamp/Date as "YYYY-MM-DD · HH:mm" (24-hour) in the active country's local timezone.
 */
export function formatCountryDateTime24h(
  dateInput: Date | number | string = new Date(),
  tzOptions?: CountryTimeZoneOptions
): string {
  const safeDate =
    dateInput instanceof Date
      ? dateInput
      : new Date(dateInput || Date.now());
  const validDate = Number.isNaN(safeDate.getTime()) ? new Date() : safeDate;
  const ymd = formatCountryDateYmd(validDate, tzOptions);
  const { hour, minute } = formatDateTimeForBarcode(validDate, tzOptions);
  return `${ymd} - ${hour}:${minute}`;
}

/**
 * Generates an order ID according to format: ***yymmddhhmm
 * [3-char prefix] + [yy] + [mm] + [dd] + [hh (24h)] + [mm]
 * Using the selected country's local timezone.
 * If collision occurs with an existing order in the same minute, appends seconds or unique counter suffix.
 */
export function generateBarcodeId(
  prefix?: string,
  existingIds: string[] = [],
  customDate: Date = new Date(),
  tzOptions?: CountryTimeZoneOptions
): string {
  const cleanPrefix = sanitizeBarcodePrefix(prefix);
  const { combined, second } = formatDateTimeForBarcode(customDate, tzOptions);
  const base = `${cleanPrefix}${combined}`;

  // If not collided, return base directly (e.g. TEC2611151604)
  if (!existingIds.includes(base)) {
    return base;
  }

  // If collision exists in the same minute, append seconds (e.g. TEC261115160435)
  const withSeconds = `${base}${second}`;
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
 * Deconstructs a barcode string to extract components for display/tooltips.
 * Supports new ***yymmddhhmm (13+ chars) as well as legacy ***yymmhhmm (11 chars).
 */
export function parseBarcodeId(barcode: string): {
  prefix: string;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  isValidDateTimeFormat: boolean;
} {
  if (!barcode || barcode.length < 11) {
    return {
      prefix: barcode ? barcode.slice(0, 3) : '',
      year: '',
      month: '',
      day: '',
      hour: '',
      minute: '',
      isValidDateTimeFormat: false
    };
  }

  const prefix = barcode.slice(0, 3);
  const tail = barcode.slice(3);

  // New ***yymmddhhmm format (10 digits after 3-char prefix)
  if (/^\d{10}/.test(tail)) {
    const yearDigits = tail.slice(0, 2);
    const monthDigits = tail.slice(2, 4);
    const dayDigits = tail.slice(4, 6);
    const hourDigits = tail.slice(6, 8);
    const minuteDigits = tail.slice(8, 10);

    return {
      prefix,
      year: `20${yearDigits}`,
      month: monthDigits,
      day: dayDigits,
      hour: `${hourDigits}:00`,
      minute: minuteDigits,
      isValidDateTimeFormat: true
    };
  }

  // Legacy ***yymmhhmm format (8 digits after 3-char prefix)
  if (/^\d{8}$/.test(tail)) {
    const yearDigits = tail.slice(0, 2);
    const monthDigits = tail.slice(2, 4);
    const hourDigits = tail.slice(4, 6);
    const minuteDigits = tail.slice(6, 8);

    return {
      prefix,
      year: `20${yearDigits}`,
      month: monthDigits,
      day: '',
      hour: `${hourDigits}:00`,
      minute: minuteDigits,
      isValidDateTimeFormat: true
    };
  }

  return {
    prefix,
    year: '',
    month: '',
    day: '',
    hour: '',
    minute: '',
    isValidDateTimeFormat: false
  };
}

export const BARCODE_FORMAT_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'AUTO', label: 'تلقائي مناسب للكود (موصى به)', description: 'يختار التشفير الأمثل تلقائياً حسب الأحرف والأرقام في الكود' },
  { value: 'CODE128', label: 'Code 128 (ذكي للحروف والأرقام)', description: 'الأكثر دقة وكثافة للأكواد المختلطة مثل TEC2611151632' },
  { value: 'CODE128C', label: 'Code 128C (أرقام زوجية عالية الكثافة)', description: 'مخصص للأرقام الزوجية فقط بضغط مضاعف' },
  { value: 'CODE39', label: 'Code 39 (أحرف كبيرة وأرقام)', description: 'تشفير تقليدي للأحرف الكبيرة والأرقام وبعض الرموز' },
  { value: 'EAN13', label: 'EAN-13 (13 رقم قياسي)', description: 'مخصص لأكواد المنتجات المكونة من 13 رقماً صحيحاً' },
  { value: 'EAN8', label: 'EAN-8 (8 أرقام قياسي)', description: 'مخصص لأكواد المنتجات القصيرة من 8 أرقام صحيحة' },
  { value: 'ITF', label: 'ITF / Interleaved 2 of 5 (أرقام زوجية)', description: 'مخصص للأرقام ذات الطول الزوجي' },
];

/**
 * Normalizes a raw order ID / barcode string into printable ASCII compatible with 1D barcodes.
 */
export function normalizeBarcodeValue(rawCode: string): string {
  if (!rawCode) return '';
  const convertedDigits = rawCode
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u200E\u200F\u202A-\u202E\uFEFF]/g, '')
    .trim();

  // Keep standard printable ASCII characters (0x20 - 0x7E)
  const asciiOnly = convertedDigits.replace(/[^\x20-\x7E]/g, '').trim();
  if (asciiOnly) return asciiOnly;

  // Deterministic ASCII fallback if input had only non-ASCII characters
  let hash = 0;
  for (let i = 0; i < convertedDigits.length; i++) {
    hash = (hash * 31 + convertedDigits.charCodeAt(i)) >>> 0;
  }
  return convertedDigits ? `TEC${String(hash).slice(0, 8).padStart(6, '0')}` : 'TEC0000';
}

function hasValidGs1CheckDigit(digits: string, oddWeight: number, evenWeight: number): boolean {
  if (!/^\d+$/.test(digits) || digits.length < 2) return false;
  let sum = 0;
  for (let i = 0; i < digits.length - 1; i++) {
    const num = Number(digits[i]);
    sum += num * (i % 2 === 0 ? oddWeight : evenWeight);
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === Number(digits[digits.length - 1]);
}

/**
 * Checks whether a normalized barcode value is strictly valid for a given JsBarcode symbology
 * without altering or truncating the code.
 */
export function isBarcodeFormatCompatible(value: string, format: string): boolean {
  if (!value || !format) return false;
  const fmt = format.toUpperCase();

  switch (fmt) {
    case 'CODE128':
      return /^[\x00-\x7F]+$/.test(value);
    case 'CODE128A':
      return /^[\x00-\x5F]+$/.test(value);
    case 'CODE128B':
      return /^[\x20-\x7E]+$/.test(value);
    case 'CODE128C':
      return /^\d+$/.test(value) && value.length >= 2 && value.length % 2 === 0;
    case 'CODE39':
      return /^[0-9A-Z\-. $/+%]+$/.test(value);
    case 'EAN13':
      return /^\d{13}$/.test(value) && hasValidGs1CheckDigit(value, 1, 3);
    case 'EAN8':
      return /^\d{8}$/.test(value) && hasValidGs1CheckDigit(value, 3, 1);
    case 'UPC':
      return /^\d{12}$/.test(value) && hasValidGs1CheckDigit(value, 3, 1);
    case 'ITF14':
      return /^\d{14}$/.test(value) && hasValidGs1CheckDigit(value, 3, 1);
    case 'ITF':
      return /^\d+$/.test(value) && value.length >= 2 && value.length % 2 === 0;
    case 'MSI':
    case 'MSI10':
    case 'MSI11':
    case 'MSI1010':
    case 'MSI1110':
      return /^\d+$/.test(value);
    case 'CODABAR':
      return /^[0-9\-$:/.+]+$/.test(value);
    default:
      return false;
  }
}

/**
 * Automatically selects the optimal 1D barcode encoding for a given normalized code value.
 */
export function getAutoBarcodeFormat(value: string): string {
  if (!value) return 'CODE128';

  if (isBarcodeFormatCompatible(value, 'EAN13')) return 'EAN13';
  if (isBarcodeFormatCompatible(value, 'EAN8')) return 'EAN8';
  if (isBarcodeFormatCompatible(value, 'UPC')) return 'UPC';
  if (isBarcodeFormatCompatible(value, 'CODE128C')) return 'CODE128C';

  // CODE128 (Auto) seamlessly combines Set B (letters/symbols) and Set C (double-density digit pairs)
  // which is optimal for repair order codes like TEC26112132.
  return 'CODE128';
}

/**
 * Resolves both the normalized value and the most appropriate barcode encoding format.
 * If preferredFormat is 'AUTO', empty, or incompatible with the code, picks the best encoding automatically.
 */
export function resolveBarcodeEncoding(
  rawCode: string,
  preferredFormat?: string
): { value: string; format: string; isAutoSelected: boolean } {
  const normalized = normalizeBarcodeValue(rawCode);
  const safeValue = normalized || 'TEC0000';
  const cleanedPref = (preferredFormat || '').trim().toUpperCase();

  if (
    cleanedPref &&
    cleanedPref !== 'AUTO' &&
    isBarcodeFormatCompatible(safeValue, cleanedPref)
  ) {
    return {
      value: safeValue,
      format: cleanedPref,
      isAutoSelected: false,
    };
  }

  return {
    value: safeValue,
    format: getAutoBarcodeFormat(safeValue),
    isAutoSelected: true,
  };
}

/**
 * Computes an adaptive narrow-bar width so longer codes never overflow narrow thermal labels.
 */
export function getAdaptiveBarWidth(
  value: string,
  format: string,
  baseWidth: number = 1.3,
  maxLabelWidthMm?: number
): number {
  const safeBase = Math.max(1.0, baseWidth || 1.3);
  if (!maxLabelWidthMm || !value) return safeBase;

  const fmt = format.toUpperCase();
  // Estimate total modules required by the symbology (bars + 20 modules of 10X quiet zone)
  let estimatedModules = value.length * 11 + 55;
  if (fmt === 'CODE39') {
    estimatedModules = (value.length + 2) * 16 + 40;
  } else if (fmt === 'CODE128C') {
    estimatedModules = Math.ceil(value.length / 2) * 11 + 55;
  } else if (fmt === 'CODE128') {
    const digitRuns: string[] = value.match(/\d{4,}/g) || [];
    const digitPairs = digitRuns.reduce<number>(
      (acc, run) => acc + Math.floor(run.length / 2),
      0
    );
    const compressedChars = digitPairs * 2;
    const singleChars = value.length - compressedChars;
    estimatedModules = (singleChars + digitPairs) * 11 + 66;
  } else if (fmt === 'ITF' || fmt === 'ITF14') {
    estimatedModules = value.length * 9 + 38;
  } else if (fmt === 'EAN13' || fmt === 'UPC') {
    estimatedModules = 133;
  } else if (fmt === 'EAN8') {
    estimatedModules = 101;
  }

  const usableWidthPx = Math.max(96, maxLabelWidthMm * 3.7795);
  const maxFittingWidth = usableWidthPx / Math.max(40, estimatedModules);
  return Number(Math.max(0.85, Math.min(safeBase, maxFittingWidth)).toFixed(2));
}

export function getBarcodePhysicalWidthMm(
  totalModules: number,
  baseWidth: number = 1.3,
  maxWidthMm?: number
): number {
  const safeModules = Math.max(40, totalModules);
  // Target module width between 0.25mm (compact thermal) and 0.44mm (wide receipt)
  const scaledModuleMm = Math.max(0.24, Math.min(0.44, (baseWidth || 1.3) * 0.2646));
  const idealWidthMm = safeModules * scaledModuleMm;
  if (!maxWidthMm || maxWidthMm <= 0) {
    return Number(idealWidthMm.toFixed(2));
  }
  // On compact labels (<= 60mm), utilize at least 92% of printable width when dense codes need maximum bar clarity
  const minComfortWidthMm = maxWidthMm <= 60 ? maxWidthMm * 0.92 : Math.min(maxWidthMm, 52);
  const targetMm = Math.min(maxWidthMm, Math.max(idealWidthMm, minComfortWidthMm));
  return Number(Math.max(16, targetMm).toFixed(2));
}

/**
 * Normalizes raw text returned by camera/USB barcode scanners or QR tracking URLs
 * into a clean uppercase ASCII order/barcode ID.
 */
export function extractScannedBarcodeId(rawText: string): string {
  if (!rawText) return '';
  const withNormalizedDigits = rawText
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u200E\u200F\u202A-\u202E\uFEFF]/g, '')
    .trim();

  if (!withNormalizedDigits) return '';

  // Parse multi-line structured customer/order QR payloads before stripping newlines
  if (/[\r\n]/.test(withNormalizedDigits) || /(?:رقم الطلب|كود الزبون|الكود|الهاتف|رقم الهاتف|الجوال|رقم الجوال|الموبايل|رقم الموبايل|موبايل العميل|هاتف العميل)\s*[:：]/.test(withNormalizedDigits)) {
    const orderMatch = withNormalizedDigits.match(/(?:^|\r?\n)\s*(?:رقم الطلب|باركود الطلب|Order(?:\s*ID)?)\s*[:：]\s*([^\r\n]+)/i);
    if (orderMatch?.[1]?.trim()) {
      return orderMatch[1].trim().toUpperCase();
    }

    const custCodeMatch = withNormalizedDigits.match(/(?:^|\r?\n)\s*(?:كود الزبون|رمز الزبون|الكود|Customer\s*Code)\s*[:：]\s*([^\r\n]+)/i);
    if (custCodeMatch?.[1]?.trim()) {
      return custCodeMatch[1].trim().toUpperCase();
    }

    const knownIdMatch = withNormalizedDigits.match(/\b(?:TEC|TCH|FIX|REP|SRV|DEV|WRK|MOB|CUS)\d{4,}(?:-\d+)?\b/i);
    if (knownIdMatch?.[0]) {
      return knownIdMatch[0].trim().toUpperCase();
    }

    const phoneMatch = withNormalizedDigits.match(/(?:^|\r?\n)\s*(?:الهاتف|رقم الهاتف|هاتف العميل|الجوال|رقم الجوال|جوال العميل|الموبايل|رقم الموبايل|موبايل العميل|Phone|Mobile)\s*[:：]\s*([^\r\n]+)/i);
    if (phoneMatch?.[1]?.trim() && !phoneMatch[1].includes('غير مسجل')) {
      const digits = phoneMatch[1].replace(/[^\d+]/g, '');
      if (digits.length >= 6) return digits;
    }

    const nameMatch = withNormalizedDigits.match(/(?:^|\r?\n)\s*(?:اسم العميل|العميل|الاسم|Customer\s*Name|Name)\s*[:：]\s*([^\r\n]+)/i);
    if (nameMatch?.[1]?.trim() && !nameMatch[1].includes('بدون اسم')) {
      return nameMatch[1].trim().toUpperCase();
    }
  }

  const cleaned = withNormalizedDigits.replace(/[\r\n]/g, '').trim();
  if (!cleaned) return '';

  const safeDecodeUri = (val: string): string => {
    try {
      return decodeURIComponent(val);
    } catch {
      return val;
    }
  };

  // Handle QR tracking URLs like https://domain/?track=TEC26112112 or /track/TEC26112112
  try {
    if (/^https?:\/\//i.test(cleaned) || cleaned.includes('track=')) {
      const url = new URL(cleaned.startsWith('http') ? cleaned : `https://example.com/${cleaned.replace(/^\/+/, '')}`);
      const paramId =
        url.searchParams.get('track') ||
        url.searchParams.get('order') ||
        url.searchParams.get('id') ||
        url.searchParams.get('code');
      if (paramId && paramId.trim()) {
        return paramId.trim().toUpperCase();
      }
      const pathMatch = url.pathname.match(/\/(?:track|ticket|order)\/([^/?#]+)/i);
      if (pathMatch?.[1]) {
        return safeDecodeUri(pathMatch[1]).trim().toUpperCase();
      }
    }
  } catch {
    // Fall through to regex extraction
  }

  const queryFallback = cleaned.match(/[?&](?:track|order|id|code)=([^&#\s]+)/i);
  if (queryFallback?.[1]) {
    return safeDecodeUri(queryFallback[1]).trim().toUpperCase();
  }

  return cleaned.toUpperCase();
}

export interface PrintableBarcodeOptions {
  code: string;
  qrContent?: string;
  preferredFormat?: string;
  baseWidth?: number;
  heightPx?: number;
  heightMm?: number;
  maxWidthMm?: number;
  targetQrMm?: number;
  displayValue?: boolean;
  fontSize?: number;
  quietZonePx?: number;
  marginModules?: number;
}

export function getBarcodeQrSizeMm({
  heightPx = 28,
  heightMm,
  maxWidthMm,
  targetQrMm,
}: {
  heightPx?: number;
  heightMm?: number;
  maxWidthMm?: number;
  targetQrMm?: number;
}): number {
  const maxAllowedMm = maxWidthMm ? Math.max(11, Number((maxWidthMm * 0.99).toFixed(2))) : 36;
  if (typeof targetQrMm === 'number' && Number.isFinite(targetQrMm) && targetQrMm > 0) {
    return Number(Math.max(9.5, Math.min(maxAllowedMm, targetQrMm)).toFixed(2));
  }
  const baseMm = heightMm ?? Number((Math.max(16, heightPx) * 25.4 / 96).toFixed(2));
  return Number(Math.max(11, Math.min(maxAllowedMm, baseMm * 2.0)).toFixed(2));
}

/**
 * Generates an infinitely crisp inline vector SVG QR Code.
 * When `qrContent` contains rich Arabic customer details, encodes UTF-8 with ECC 'L'
 * so the matrix stays clean and scannable on compact thermal labels.
 */
export function renderPrintableBarcodeSvg({
  code,
  qrContent,
  heightPx = 28,
  heightMm,
  maxWidthMm,
  targetQrMm,
  marginModules = 1,
}: PrintableBarcodeOptions): string {
  try {
    const richPayload = (qrContent || '').trim();
    const qrMm = getBarcodeQrSizeMm({ heightPx, heightMm, maxWidthMm, targetQrMm });

    if (richPayload) {
      const upperRich = richPayload.toUpperCase();
      const useAlphaRich = isValidQrAlphanumeric(upperRich);
      return renderAlphanumericQrSvg({
        value: useAlphaRich ? upperRich : richPayload,
        mode: useAlphaRich ? 'alphanumeric' : 'auto',
        physicalSizeMm: qrMm,
        marginModules,
        errorCorrectionLevel: useAlphaRich ? 'M' : 'L',
      });
    }

    const normalized = String(code || '').trim().toUpperCase();
    const cleanAlpha = sanitizeQrAlphanumeric(normalized, false);
    const useAlpha = isValidQrAlphanumeric(cleanAlpha) && cleanAlpha.length > 0;
    const targetValue = useAlpha ? cleanAlpha : (normalized || 'TEC0000');

    return renderAlphanumericQrSvg({
      value: targetValue,
      mode: useAlpha ? 'alphanumeric' : 'auto',
      physicalSizeMm: qrMm,
      marginModules,
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('SVG QR barcode generation error', err);
    return '';
  }
}

/**
 * Renders a razor-sharp high-DPI barcode PNG with 10X horizontal quiet zones
 * as an image fallback when SVG markup is not suitable.
 */
export function renderPrintableBarcodeDataUrl({
  code,
  preferredFormat = 'AUTO',
  baseWidth = 1.3,
  heightPx = 28,
  maxWidthMm,
  displayValue = false,
  fontSize = 14,
  quietZonePx = 10
}: PrintableBarcodeOptions): string {
  try {
    const canvas = document.createElement('canvas');
    const resolved = resolveBarcodeEncoding(code, preferredFormat);
    const barWidth = getAdaptiveBarWidth(resolved.value, resolved.format, baseWidth, maxWidthMm);
    const scale = 3;
    const scaledWidth = Math.max(3, Math.round(barWidth * scale));
    const scaledHeight = Math.round(Math.max(18, heightPx) * scale);
    const horizontalMargin = Math.max(scaledWidth * 10, Math.round(quietZonePx * scale));

    const draw = (fmt: string) => {
      JsBarcode(canvas, resolved.value, {
        format: fmt,
        width: scaledWidth,
        height: scaledHeight,
        displayValue,
        font: 'monospace',
        fontSize: Math.round(fontSize * scale),
        textMargin: 3 * scale,
        marginTop: 2,
        marginBottom: 2,
        marginLeft: horizontalMargin,
        marginRight: horizontalMargin,
        background: '#ffffff',
        lineColor: '#000000',
      });
    };

    try {
      draw(resolved.format);
    } catch {
      draw('CODE128');
    }

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('Barcode generation error', err);
    return '';
  }
}


