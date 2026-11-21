import { CustomerProfile, DeviceStatus, MaintenanceOrder, isContactOrder } from '../types';
import { extractScannedBarcodeId, formatCountryDateYmd, normalizeBarcodeValue } from './barcode';
import { buildTrackingUrl } from './appDomain';

export function normalizeCustomerPhone(phone?: string): string {
  if (!phone) return '';
  const converted = phone
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[^\d]/g, '');
  return converted;
}

export function normalizeCustomerNameKey(name?: string): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function phonesMatch(a?: string, b?: string): boolean {
  const na = normalizeCustomerPhone(a);
  const nb = normalizeCustomerPhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 8 && nb.length >= 8) {
    return na.slice(-9) === nb.slice(-9) || na.endsWith(nb) || nb.endsWith(na);
  }
  return false;
}

export function getCustomerMatchKey(name?: string, phone?: string): string {
  const normPhone = normalizeCustomerPhone(phone);
  if (normPhone.length >= 6) {
    return `p:${normPhone.length >= 9 ? normPhone.slice(-9) : normPhone}`;
  }
  const normName = normalizeCustomerNameKey(name);
  if (normName) {
    return `n:${normName}`;
  }
  return '';
}

function stableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(10).padStart(8, '0').slice(0, 8);
}

export function buildCustomerId(name: string, phone: string, existingIds: Set<string>): string {
  const normPhone = normalizeCustomerPhone(phone);
  const baseSlug = normPhone.length >= 6
    ? `cust_${normPhone.slice(-10)}`
    : `cust_${stableHash(normalizeCustomerNameKey(name) || String(Date.now()))}`;

  if (!existingIds.has(baseSlug)) return baseSlug;

  let i = 2;
  while (existingIds.has(`${baseSlug}_${i}`)) {
    i++;
  }
  return `${baseSlug}_${i}`;
}

/**
 * Generates a unique, QR Alphanumeric Mode-compatible customer code (e.g. CUS26110001).
 * Uses strictly uppercase A-Z and 0-9 (part of ISO/IEC 18004 Alphanumeric 45-char set),
 * encoding cleanly in Version 1 (21x21) QR matrices while guaranteeing uniqueness.
 */
export function generateUniqueCustomerBarcode(
  existingCodes: Set<string>,
  seedKey?: string,
  prefix: string = 'CUS'
): string {
  const cleanPrefix = (prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'CUS');
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (seedKey) {
    const deterministicDigits = stableHash(seedKey).slice(0, 6);
    const candidate = `${cleanPrefix}${yymm}${deterministicDigits}`.toUpperCase();
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }

  let seq = existingCodes.size + 1;
  for (let attempt = 0; attempt < 5000; attempt++) {
    const suffix = String(seq + attempt).padStart(4, '0');
    const candidate = `${cleanPrefix}${yymm}${suffix}`.toUpperCase();
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }

  return `${cleanPrefix}${Date.now().toString().slice(-8)}`.toUpperCase();
}

/**
 * Sanitizes custom scanned/entered customer QR codes to the strict QR Alphanumeric Mode
 * character set (0-9, A-Z, $%*+-./: without whitespace).
 */
export function sanitizeCustomCustomerBarcode(rawCode: string): string {
  const extracted = extractScannedBarcodeId(rawCode) || rawCode;
  return normalizeBarcodeValue(extracted)
    .toUpperCase()
    .replace(/[^0-9A-Z$%*+\-./:]/g, '');
}

/**
 * Reconciles persistent CustomerProfile records with all MaintenanceOrders and contact orders.
 * - Ensures every customer gets a persistent unique `customerBarcode`.
 * - Links every MaintenanceOrder (`customerId` + `customerBarcode`) to its owner customer.
 */
export function reconcileCustomersAndOrders(
  existingCustomers: CustomerProfile[],
  orders: MaintenanceOrder[]
): {
  customers: CustomerProfile[];
  orders: MaintenanceOrder[];
  changedCustomers: CustomerProfile[];
  changedOrders: MaintenanceOrder[];
} {
  const customerList: CustomerProfile[] = [];
  const usedIds = new Set<string>();
  const usedBarcodes = new Set<string>();

  orders.forEach((o) => {
    if (o?.id) usedBarcodes.add(o.id.trim().toUpperCase());
  });

  const byId = new Map<string, CustomerProfile>();
  const byBarcode = new Map<string, CustomerProfile>();
  const byMatchKey = new Map<string, CustomerProfile>();

  // 1. Index existing CustomerProfile records safely
  for (const raw of existingCustomers || []) {
    if (!raw || !raw.id) continue;
    let barcode = sanitizeCustomCustomerBarcode(raw.customerBarcode || '');
    if (!barcode || usedBarcodes.has(barcode)) {
      barcode = generateUniqueCustomerBarcode(usedBarcodes, raw.phone || raw.name || raw.id);
    }
    usedIds.add(raw.id);
    usedBarcodes.add(barcode);

    const normalized: CustomerProfile = {
      ...raw,
      name: (raw.name || '').trim() || 'بدون اسم',
      phone: (raw.phone || '').trim(),
      customerBarcode: barcode,
      createdAt: raw.createdAt || Date.now(),
      updatedAt: raw.updatedAt || raw.createdAt || Date.now(),
    };
    customerList.push(normalized);
    byId.set(normalized.id, normalized);
    byBarcode.set(barcode, normalized);
    const key = getCustomerMatchKey(normalized.name, normalized.phone);
    if (key && !byMatchKey.has(key)) {
      byMatchKey.set(key, normalized);
    }
  }

  const changedCustomersMap = new Map<string, CustomerProfile>();
  const changedOrders: MaintenanceOrder[] = [];

  // 2. Find or create customer for every order (and legacy contact order)
  const findCustomerForOrder = (order: MaintenanceOrder): CustomerProfile | null => {
    if (order.customerId && byId.has(order.customerId)) {
      return byId.get(order.customerId)!;
    }
    if (order.customerBarcode) {
      const code = sanitizeCustomCustomerBarcode(order.customerBarcode);
      if (code && byBarcode.has(code)) {
        return byBarcode.get(code)!;
      }
    }
    const key = getCustomerMatchKey(order.customerName, order.customerPhone);
    if (key && byMatchKey.has(key)) {
      return byMatchKey.get(key)!;
    }
    if (order.customerPhone) {
      const phoneMatch = customerList.find((c) => phonesMatch(c.phone, order.customerPhone));
      if (phoneMatch) return phoneMatch;
    }
    return null;
  };

  // Sort orders oldest-first for customer creation ordering so earliest name/date stays clean,
  // while updating name/phone from latest real order if missing.
  const sortedOrdersForLinking = [...(orders || [])].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  for (const order of sortedOrdersForLinking) {
    if (!order || (!order.customerName?.trim() && !order.customerPhone?.trim())) continue;
    let customer = findCustomerForOrder(order);
    if (!customer) {
      const newId = buildCustomerId(order.customerName || '', order.customerPhone || '', usedIds);
      usedIds.add(newId);

      let preferredCode = order.customerBarcode ? sanitizeCustomCustomerBarcode(order.customerBarcode) : '';
      if (!preferredCode || usedBarcodes.has(preferredCode)) {
        preferredCode = generateUniqueCustomerBarcode(usedBarcodes, order.customerPhone || order.customerName || newId);
      }
      usedBarcodes.add(preferredCode);

      customer = {
        id: newId,
        name: (order.customerName || '').trim() || 'بدون اسم',
        phone: (order.customerPhone || '').trim(),
        customerBarcode: preferredCode,
        createdAt: order.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      customerList.push(customer);
      byId.set(customer.id, customer);
      byBarcode.set(customer.customerBarcode, customer);
      const key = getCustomerMatchKey(customer.name, customer.phone);
      if (key) byMatchKey.set(key, customer);
      changedCustomersMap.set(customer.id, customer);
    } else {
      // Backfill phone or proper name if customer had placeholder
      let mutated = false;
      if ((!customer.phone || customer.phone === 'غير مسجل') && order.customerPhone?.trim()) {
        customer = { ...customer, phone: order.customerPhone.trim(), updatedAt: Date.now() };
        mutated = true;
      }
      if ((!customer.name || customer.name === 'بدون اسم') && order.customerName?.trim()) {
        customer = { ...customer, name: order.customerName.trim(), updatedAt: Date.now() };
        mutated = true;
      }
      if (mutated) {
        const idx = customerList.findIndex((c) => c.id === customer!.id);
        if (idx >= 0) customerList[idx] = customer;
        byId.set(customer.id, customer);
        byBarcode.set(customer.customerBarcode, customer);
        changedCustomersMap.set(customer.id, customer);
      }
    }
  }

  // 3. Stamp customerId + customerBarcode on any order missing or out of sync
  const updatedOrders = (orders || []).map((order) => {
    if (!order) return order;
    const customer = findCustomerForOrder(order);
    if (!customer) return order;

    if (order.customerId !== customer.id || order.customerBarcode !== customer.customerBarcode) {
      const updated: MaintenanceOrder = {
        ...order,
        customerId: customer.id,
        customerBarcode: customer.customerBarcode,
      };
      changedOrders.push(updated);
      return updated;
    }
    return order;
  });

  // Sort customers by newest updated/created
  customerList.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

  return {
    customers: customerList,
    orders: updatedOrders,
    changedCustomers: Array.from(changedCustomersMap.values()),
    changedOrders,
  };
}

/**
 * Ensures an incoming/edited MaintenanceOrder is linked to its CustomerProfile (creating one if needed).
 */
export function linkOrderWithCustomer(
  order: MaintenanceOrder,
  existingCustomers: CustomerProfile[],
  allOrders: MaintenanceOrder[]
): {
  linkedOrder: MaintenanceOrder;
  customer: CustomerProfile;
  isNewCustomer: boolean;
} {
  const usedIds = new Set(existingCustomers.map((c) => c.id));
  const usedBarcodes = new Set<string>([
    ...existingCustomers.map((c) => (c.customerBarcode || '').toUpperCase()).filter(Boolean),
    ...allOrders.map((o) => (o.id || '').toUpperCase()).filter(Boolean),
  ]);

  let matched: CustomerProfile | undefined;
  if (order.customerId) {
    matched = existingCustomers.find((c) => c.id === order.customerId);
  }
  if (!matched && order.customerBarcode) {
    const code = sanitizeCustomCustomerBarcode(order.customerBarcode);
    matched = existingCustomers.find((c) => (c.customerBarcode || '').toUpperCase() === code);
  }
  if (!matched && order.customerPhone) {
    matched = existingCustomers.find((c) => phonesMatch(c.phone, order.customerPhone));
  }
  if (!matched && order.customerName) {
    const nameKey = normalizeCustomerNameKey(order.customerName);
    matched = existingCustomers.find((c) => normalizeCustomerNameKey(c.name) === nameKey);
  }

  if (matched) {
    const linkedOrder: MaintenanceOrder = {
      ...order,
      customerId: matched.id,
      customerBarcode: matched.customerBarcode,
    };
    return { linkedOrder, customer: matched, isNewCustomer: false };
  }

  const newId = buildCustomerId(order.customerName || '', order.customerPhone || '', usedIds);
  let barcode = order.customerBarcode ? sanitizeCustomCustomerBarcode(order.customerBarcode) : '';
  if (!barcode || usedBarcodes.has(barcode)) {
    barcode = generateUniqueCustomerBarcode(usedBarcodes, order.customerPhone || order.customerName || newId);
  }

  const newCustomer: CustomerProfile = {
    id: newId,
    name: (order.customerName || '').trim() || 'بدون اسم',
    phone: (order.customerPhone || '').trim(),
    customerBarcode: barcode,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const linkedOrder: MaintenanceOrder = {
    ...order,
    customerId: newCustomer.id,
    customerBarcode: newCustomer.customerBarcode,
  };

  return { linkedOrder, customer: newCustomer, isNewCustomer: true };
}

export type ScannedBarcodeMatchType =
  | 'customer_barcode'
  | 'order_barcode'
  | 'serial_number'
  | 'phone'
  | 'not_found';

export interface ScannedBarcodeResolution {
  rawCode: string;
  normalizedCode: string;
  matchType: ScannedBarcodeMatchType;
  customer: CustomerProfile | null;
  matchedOrder: MaintenanceOrder | null;
  customerOrders: MaintenanceOrder[];
}

export function resolveScannedBarcodeTarget(
  rawCode: string,
  customers: CustomerProfile[],
  orders: MaintenanceOrder[]
): ScannedBarcodeResolution {
  const normalizedCode = (extractScannedBarcodeId(rawCode) || rawCode.trim()).toUpperCase();
  const realOrders = (orders || []).filter((o) => o && !isContactOrder(o));

  const getOrdersForCustomer = (cust: CustomerProfile | null, fallbackOrder?: MaintenanceOrder | null): MaintenanceOrder[] => {
    if (!cust && !fallbackOrder) return [];
    return realOrders
      .filter((o) => {
        if (cust) {
          if (o.customerId && o.customerId === cust.id) return true;
          if (o.customerBarcode && cust.customerBarcode && o.customerBarcode.toUpperCase() === cust.customerBarcode.toUpperCase()) return true;
          if (cust.phone && phonesMatch(o.customerPhone, cust.phone)) return true;
          if (!cust.phone && normalizeCustomerNameKey(o.customerName) === normalizeCustomerNameKey(cust.name)) return true;
        }
        if (fallbackOrder && o.id === fallbackOrder.id) return true;
        return false;
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  };

  const findCustomerForOrder = (ord: MaintenanceOrder): CustomerProfile | null => {
    if (ord.customerId) {
      const byId = customers.find((c) => c.id === ord.customerId);
      if (byId) return byId;
    }
    if (ord.customerBarcode) {
      const byCode = customers.find((c) => (c.customerBarcode || '').toUpperCase() === ord.customerBarcode!.toUpperCase());
      if (byCode) return byCode;
    }
    if (ord.customerPhone) {
      const byPhone = customers.find((c) => phonesMatch(c.phone, ord.customerPhone));
      if (byPhone) return byPhone;
    }
    const nameKey = normalizeCustomerNameKey(ord.customerName);
    if (nameKey) {
      const byName = customers.find((c) => normalizeCustomerNameKey(c.name) === nameKey);
      if (byName) return byName;
    }
    return null;
  };

  if (!normalizedCode) {
    return {
      rawCode,
      normalizedCode: '',
      matchType: 'not_found',
      customer: null,
      matchedOrder: null,
      customerOrders: [],
    };
  }

  // 1. Exact Customer Barcode match
  const matchedCustomer = customers.find(
    (c) => (c.customerBarcode || '').trim().toUpperCase() === normalizedCode
  );
  if (matchedCustomer) {
    const custOrders = getOrdersForCustomer(matchedCustomer);
    const activeOrder = custOrders.find((o) => o.status !== 'delivered' && o.status !== 'unrepairable') || custOrders[0] || null;
    return {
      rawCode,
      normalizedCode,
      matchType: 'customer_barcode',
      customer: matchedCustomer,
      matchedOrder: activeOrder,
      customerOrders: custOrders,
    };
  }

  // 2. Exact Order ID or Device Barcode match
  const matchedOrder = realOrders.find(
    (o) =>
      (o.id || '').trim().toUpperCase() === normalizedCode ||
      (o.deviceBarcode && o.deviceBarcode.trim().toUpperCase() === normalizedCode)
  );
  if (matchedOrder) {
    const owner = findCustomerForOrder(matchedOrder);
    return {
      rawCode,
      normalizedCode,
      matchType: 'order_barcode',
      customer: owner,
      matchedOrder,
      customerOrders: getOrdersForCustomer(owner, matchedOrder),
    };
  }

  // 3. Exact Serial Number match
  const serialOrders = realOrders
    .filter((o) => o.serialNumber && o.serialNumber.trim().toUpperCase() === normalizedCode)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (serialOrders.length > 0) {
    const latestSerialOrder = serialOrders[0];
    const owner = findCustomerForOrder(latestSerialOrder);
    return {
      rawCode,
      normalizedCode,
      matchType: 'serial_number',
      customer: owner,
      matchedOrder: latestSerialOrder,
      customerOrders: getOrdersForCustomer(owner, latestSerialOrder),
    };
  }

  // 4. Phone number match (for numeric barcodes / phone queries)
  const cleanDigits = normalizeCustomerPhone(normalizedCode);
  if (cleanDigits.length >= 6) {
    const phoneCustomer = customers.find((c) => phonesMatch(c.phone, cleanDigits));
    if (phoneCustomer) {
      const custOrders = getOrdersForCustomer(phoneCustomer);
      return {
        rawCode,
        normalizedCode,
        matchType: 'phone',
        customer: phoneCustomer,
        matchedOrder: custOrders[0] || null,
        customerOrders: custOrders,
      };
    }
    const phoneOrder = realOrders.find((o) => phonesMatch(o.customerPhone, cleanDigits));
    if (phoneOrder) {
      const owner = findCustomerForOrder(phoneOrder);
      return {
        rawCode,
        normalizedCode,
        matchType: 'phone',
        customer: owner,
        matchedOrder: phoneOrder,
        customerOrders: getOrdersForCustomer(owner, phoneOrder),
      };
    }
  }

  return {
    rawCode,
    normalizedCode,
    matchType: 'not_found',
    customer: null,
    matchedOrder: null,
    customerOrders: [],
  };
}

export function formatOrderStatusAr(status: DeviceStatus | string): string {
  switch (status) {
    case DeviceStatus.RECEIVED:
    case 'received':
      return 'تم الاستلام';
    case DeviceStatus.DIAGNOSING:
    case 'diagnosing':
      return 'تحت الفحص';
    case DeviceStatus.REPAIRING:
    case 'repairing':
      return 'تحت الإصلاح';
    case DeviceStatus.PENDING:
    case 'pending':
      return 'قيد الانتظار';
    case DeviceStatus.READY:
    case 'ready':
      return 'جاهز للتسليم';
    case DeviceStatus.DELIVERED:
    case 'delivered':
      return 'تم التسليم';
    case DeviceStatus.UNREPAIRABLE:
    case 'unrepairable':
      return 'غير قابل للإصلاح';
    default:
      return String(status || 'غير محدد');
  }
}

function formatQrShortDate(timestamp?: number): string {
  if (!timestamp || isNaN(timestamp)) return '';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  } catch {
    return '';
  }
}

function readSafeStorage(key: string): string {
  try {
    return typeof localStorage !== 'undefined' ? (localStorage.getItem(key) || '').trim() : '';
  } catch {
    return '';
  }
}

export interface CustomerQrPayloadOptions {
  customer?: CustomerProfile | null;
  name?: string;
  phone?: string;
  customerBarcode?: string;
  notes?: string;
  createdAt?: number;
  orders?: MaintenanceOrder[];
  currencyName?: string;
  centerName?: string;
  maxLength?: number;
}

/**
 * Builds a complete, human-readable multi-line Arabic text payload for customer QR codes.
 * External cameras display complete customer profile, notes, totals, and device history,
 * while the in-app scanner deterministically extracts `كود الزبون` / `الهاتف`.
 */
export function buildCustomerQrPayload({
  customer,
  name,
  phone,
  customerBarcode,
  notes,
  createdAt,
  orders = [],
  currencyName,
  centerName,
  maxLength = 650,
}: CustomerQrPayloadOptions): string {
  const realOrders = (orders || [])
    .filter((o) => o && !isContactOrder(o))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const finalName = (customer?.name || name || realOrders[0]?.customerName || '').trim() || 'بدون اسم';
  const finalPhone = (customer?.phone || phone || realOrders[0]?.customerPhone || '').trim();
  const finalNotes = (customer?.notes || notes || '').trim();
  const regDate = formatQrShortDate(customer?.createdAt || createdAt);
  const resolvedCenter = (centerName || readSafeStorage('centerName')).trim();
  const resolvedCurrency = (currencyName || readSafeStorage('currencyName') || 'دينار').trim();
  const isCompact = maxLength <= 320;

  const lines: string[] = [];
  lines.push(resolvedCenter && !isCompact ? `ملف الزبون - ${resolvedCenter}` : 'ملف الزبون');
  lines.push(`الاسم: ${finalName}`);
  lines.push(`الهاتف: ${finalPhone || 'غير مسجل'}`);
  if (regDate && !isCompact) {
    lines.push(`تاريخ التسجيل: ${regDate}`);
  }
  if (finalNotes) {
    const cleanNote = finalNotes.replace(/\s+/g, ' ').slice(0, isCompact ? 45 : 90);
    lines.push(`ملاحظات: ${cleanNote}`);
  }

  if (realOrders.length > 0) {
    const inRepairCount = realOrders.filter(
      (o) => o.status !== DeviceStatus.DELIVERED && o.status !== DeviceStatus.UNREPAIRABLE
    ).length;
    const readyCount = realOrders.filter((o) => o.status === DeviceStatus.READY).length;
    const deliveredCount = realOrders.filter((o) => o.status === DeviceStatus.DELIVERED).length;

    const totalAmount = realOrders.reduce(
      (sum, o) => sum + Number(o.actualCost !== undefined ? o.actualCost : o.estimatedCost || 0),
      0
    );
    const totalPaid = realOrders.reduce((sum, o) => sum + Number(o.advancePayment || 0), 0);
    const remaining = Math.max(0, totalAmount - totalPaid);

    const statusSummaryParts = [`عدد الأجهزة: ${realOrders.length}`];
    if (inRepairCount > 0) statusSummaryParts.push(`قيد الصيانة: ${inRepairCount}`);
    if (readyCount > 0) statusSummaryParts.push(`جاهز: ${readyCount}`);
    if (deliveredCount > 0) statusSummaryParts.push(`مسلم: ${deliveredCount}`);
    lines.push(statusSummaryParts.join(' | '));

    if (totalAmount > 0 || totalPaid > 0) {
      lines.push(
        `الإجمالي: ${totalAmount} ${resolvedCurrency} | المدفوع: ${totalPaid} | المتبقي: ${remaining}`
      );
    }

    const baseText = lines.join('\n');
    const orderLines: string[] = [];
    let currentLen = baseText.length + '\nالأجهزة:'.length;
    let includedCount = 0;

    for (const o of realOrders) {
      const deviceTitle = [o.deviceType, o.brandModel].filter(Boolean).join(' ').trim() || 'جهاز';
      const statusAr = formatOrderStatusAr(o.status);
      const costVal = o.actualCost !== undefined ? o.actualCost : o.estimatedCost;
      const ordCurrency = o.currency || resolvedCurrency;
      const parts = [`- ${o.id}`, deviceTitle, statusAr];
      if (!isCompact && o.faultDescription?.trim()) {
        parts.push(`العطل: ${o.faultDescription.trim().replace(/\s+/g, ' ').slice(0, 42)}`);
      }
      if (costVal !== undefined && costVal !== null && Number(costVal) > 0) {
        parts.push(`${costVal} ${ordCurrency}`);
      }
      if (!isCompact && o.serialNumber?.trim()) {
        parts.push(`S/N: ${o.serialNumber.trim()}`);
      }
      if (!isCompact && o.createdAt) {
        const dStr = formatQrShortDate(o.createdAt);
        if (dStr) parts.push(dStr);
      }
      const line = parts.join(' | ');
      const reserveMore = realOrders.length > includedCount + 1 ? 26 : 0;
      if (currentLen + 1 + line.length + reserveMore > maxLength) {
        break;
      }
      orderLines.push(line);
      currentLen += 1 + line.length;
      includedCount++;
    }

    if (orderLines.length > 0) {
      lines.push('الأجهزة:');
      lines.push(...orderLines);
      if (realOrders.length > includedCount) {
        lines.push(`... +${realOrders.length - includedCount} أجهزة أخرى`);
      }
    }
  } else {
    lines.push('عدد الأجهزة: 0');
  }

  return lines.join('\n').slice(0, maxLength);
}

export interface OrderCustomerQrPayloadOptions {
  order: MaintenanceOrder;
  customer?: CustomerProfile | null;
  customerOrders?: MaintenanceOrder[];
  currencyName?: string;
  centerName?: string;
  centerMobile?: string;
  appUrl?: string;
  maxLength?: number;
}

/**
 * Builds a structured, ordered multi-line Arabic text payload for order QR codes
 * containing only these 5 fields in the exact requested sequence:
 * 1. customerName
 * 2. customerMobile
 * 3. fault
 * 4. receivedDate
 * 5. cost
 */
export function buildOrderCustomerQrPayload({
  order,
  customer,
  currencyName,
  maxLength = 520,
}: OrderCustomerQrPayloadOptions): string {
  const custName = (customer?.name || order.customerName || '').trim() || 'بدون اسم';
  const custMobile = (order.customerPhone || customer?.phone || '').trim() || 'غير مسجل';
  const rawFault = (order.faultDescription || '').trim().replace(/\s+/g, ' ') || 'غير محدد';
  const receivedDate = formatCountryDateYmd(order.createdAt || Date.now());
  const resolvedCurrency = (order.currency || currencyName || readSafeStorage('currencyName') || 'دينار').trim();
  const costVal = Number(order.actualCost !== undefined ? order.actualCost : (order.estimatedCost || 0));
  const costText = `${costVal} ${resolvedCurrency}`.trim();

  const lineCustomerName = `اسم العميل: ${custName}`;
  const lineCustomerMobile = `رقم الموبايل: ${custMobile}`;
  const lineReceivedDate = `تاريخ الاستلام: ${receivedDate}`;
  const lineCost = `التكلفة: ${costText}`;

  const fixedLinesLength =
    lineCustomerName.length +
    lineCustomerMobile.length +
    lineReceivedDate.length +
    lineCost.length +
    4; // newlines

  const faultPrefix = 'العطل: ';
  const maxFaultChars = Math.max(24, Math.min(120, maxLength - fixedLinesLength - faultPrefix.length - 1));
  const cleanFault =
    rawFault.length > maxFaultChars
      ? `${rawFault.slice(0, Math.max(12, maxFaultChars - 3)).trim()}...`
      : rawFault;
  const lineFault = `${faultPrefix}${cleanFault}`;

  return [
    lineCustomerName,
    lineCustomerMobile,
    lineFault,
    lineReceivedDate,
    lineCost,
  ].join('\n');
}

export interface ParsedOrderCustomerQrPayload {
  isStructured: boolean;
  explicitOrderId: string | null;
  embeddedOrderIds: string[];
  customerCode: string | null;
  customerName: string | null;
  customerPhone: string | null;
  fault: string | null;
  receivedDate: string | null;
  cost: number | null;
}

function normalizeArabicDigitsAndBidi(text: string): string {
  return (text || '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u200E\u200F\u202A-\u202E\uFEFF]/g, '')
    .trim();
}

function normalizeArabicTextForMatch(text?: string): string {
  if (!text) return '';
  return normalizeArabicDigitsAndBidi(text)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // diacritics + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeDateToYmd(raw?: string): string {
  if (!raw) return '';
  const cleaned = normalizeArabicDigitsAndBidi(raw);
  const ymd = cleaned.match(/(\d{4})[\/\-.\s](\d{1,2})[\/\-.\s](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  const dmy = cleaned.match(/(\d{1,2})[\/\-.\s](\d{1,2})[\/\-.\s](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return '';
}

function safeDecodeUriSegment(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

function extractUrlOrderParam(text: string): string | null {
  const cleaned = normalizeArabicDigitsAndBidi(text).replace(/[\r\n]/g, '').trim();
  if (!cleaned) return null;
  try {
    if (/^https?:\/\//i.test(cleaned) || /[?&](?:track|order|id|code)=/i.test(cleaned)) {
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
        return safeDecodeUriSegment(pathMatch[1]).trim().toUpperCase();
      }
    }
  } catch {
    // Fall through to regex
  }
  const queryFallback = cleaned.match(/[?&](?:track|order|id|code)=([^&#\s]+)/i);
  if (queryFallback?.[1]) {
    return safeDecodeUriSegment(queryFallback[1]).trim().toUpperCase();
  }
  return null;
}

export function parseOrderCustomerQrPayload(rawCode: string): ParsedOrderCustomerQrPayload {
  const normalized = normalizeArabicDigitsAndBidi(rawCode);
  const splitNormalized = normalized.replace(
    /\s+(?=(?:اسم العميل|اسم الزبون|الاسم|رقم الموبايل|موبايل العميل|الموبايل|رقم الهاتف|هاتف العميل|الهاتف|رقم الجوال|جوال العميل|الجوال|العطل|المشكلة|وصف العطل|تاريخ الاستلام|التاريخ|التكلفة|السعر|المبلغ|رقم الطلب|باركود الطلب|كود الزبون|رمز الزبون|الأجهزة|Order\s*ID|Customer\s*Code|Customer\s*Name|Phone|Mobile|Fault|Date|Cost)\s*[:：])/gi,
    '\n'
  );
  const lines = splitNormalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const hasLabeledField = /(?:اسم العميل|الاسم|رقم الموبايل|الموبايل|رقم الهاتف|الهاتف|الجوال|العطل|تاريخ الاستلام|التكلفة|رقم الطلب|باركود الطلب|كود الزبون|ملف الزبون|Order\s*ID|Customer\s*Code)\s*[:：\-]?/i.test(
    normalized
  );
  const isStructured = lines.length > 1 || hasLabeledField;

  let explicitOrderId: string | null = null;
  const embeddedOrderIds: string[] = [];
  let customerCode: string | null = null;
  let customerName: string | null = null;
  let customerPhone: string | null = null;
  let fault: string | null = null;
  let receivedDate: string | null = null;
  let cost: number | null = null;

  for (const line of lines) {
    const orderMatch = line.match(/^(?:رقم الطلب|باركود الطلب|Order(?:\s*ID)?)\s*[:：]\s*(.+)$/i);
    if (orderMatch?.[1]?.trim()) {
      explicitOrderId = orderMatch[1].trim().toUpperCase();
      continue;
    }

    const codeMatch = line.match(/^(?:كود الزبون|رمز الزبون|الكود|Customer\s*Code)\s*[:：]\s*(.+)$/i);
    if (codeMatch?.[1]?.trim()) {
      customerCode = codeMatch[1].trim().toUpperCase();
      continue;
    }

    const nameMatch = line.match(/^(?:اسم العميل|اسم الزبون|العميل|الزبون|الاسم|Customer\s*Name|Name)\s*[:：]\s*(.+)$/i);
    if (nameMatch?.[1]?.trim()) {
      const val = nameMatch[1].trim();
      if (val && val !== 'بدون اسم') customerName = val;
      continue;
    }

    const phoneMatch = line.match(/^(?:رقم الموبايل|موبايل العميل|الموبايل|رقم الهاتف|هاتف العميل|الهاتف|رقم الجوال|جوال العميل|الجوال|Phone|Mobile)\s*[:：]\s*(.+)$/i);
    if (phoneMatch?.[1]?.trim()) {
      const val = phoneMatch[1].trim();
      if (val && !val.includes('غير مسجل')) {
        const digits = normalizeCustomerPhone(val);
        if (digits.length >= 6) customerPhone = digits;
      }
      continue;
    }

    const faultMatch = line.match(/^(?:العطل|المشكلة|وصف العطل|Fault)\s*[:：]\s*(.+)$/i);
    if (faultMatch?.[1]?.trim()) {
      const val = faultMatch[1].trim();
      if (val && val !== 'غير محدد') fault = val;
      continue;
    }

    const dateMatch = line.match(/^(?:تاريخ الاستلام|التاريخ|Date)\s*[:：]\s*(.+)$/i);
    if (dateMatch?.[1]?.trim()) {
      const ymd = normalizeDateToYmd(dateMatch[1].trim());
      if (ymd) receivedDate = ymd;
      continue;
    }

    const costMatch = line.match(/^(?:التكلفة|السعر|المبلغ|Cost)\s*[:：]\s*(.+)$/i);
    if (costMatch?.[1]?.trim()) {
      const numMatch = costMatch[1].replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
      if (numMatch?.[1]) {
        const parsedNum = Number(numMatch[1]);
        if (!Number.isNaN(parsedNum)) cost = parsedNum;
      }
      continue;
    }

    // Customer profile QR device lines: "- TEC2611160001 | هاتف | ..."
    const bulletOrderMatch = line.match(/^[-•*]\s*([A-Z0-9][A-Z0-9\-_]{3,})\b/i);
    if (bulletOrderMatch?.[1]) {
      const candidate = bulletOrderMatch[1].trim().toUpperCase();
      if (!embeddedOrderIds.includes(candidate)) {
        embeddedOrderIds.push(candidate);
      }
    }
  }

  // Also capture any known order ID tokens anywhere in the text
  const knownTokenMatches = normalized.match(/\b(?:TEC|TCH|FIX|REP|SRV|DEV|WRK|MOB|ORD)[A-Z0-9\-]{4,}\b/gi);
  if (knownTokenMatches) {
    for (const token of knownTokenMatches) {
      const upper = token.trim().toUpperCase();
      if (!embeddedOrderIds.includes(upper)) {
        embeddedOrderIds.push(upper);
      }
    }
  }

  return {
    isStructured,
    explicitOrderId,
    embeddedOrderIds,
    customerCode,
    customerName,
    customerPhone,
    fault,
    receivedDate,
    cost,
  };
}

function pickPreferredOrder(candidates: MaintenanceOrder[]): MaintenanceOrder | null {
  if (!candidates || candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    const aActive = a.status !== DeviceStatus.DELIVERED && a.status !== DeviceStatus.UNREPAIRABLE ? 1 : 0;
    const bActive = b.status !== DeviceStatus.DELIVERED && b.status !== DeviceStatus.UNREPAIRABLE ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return sorted[0];
}

/**
 * Resolves any scanned QR/barcode payload back to the matching MaintenanceOrder in records.
 * Supports:
 * - Direct order ID / device barcode / tracking URL
 * - 5-field Arabic Order QR (اسم العميل / رقم الموبايل / العطل / تاريخ الاستلام / التكلفة)
 * - Customer Profile QR (ملف الزبون / الأجهزة / الهاتف / كود الزبون)
 * - Serial number / customer barcode / phone number
 */
export function resolveScannedOrderFromRecords(
  rawCode: string,
  orders: MaintenanceOrder[],
  customers: CustomerProfile[] = []
): MaintenanceOrder | null {
  const normalizedRaw = normalizeArabicDigitsAndBidi(rawCode);
  if (!normalizedRaw) return null;

  const realOrders = (orders || []).filter((o) => o && !isContactOrder(o));
  if (realOrders.length === 0) return null;

  const parsed = parseOrderCustomerQrPayload(normalizedRaw);
  const urlParam = extractUrlOrderParam(normalizedRaw);

  const findExactOrderById = (code?: string | null): MaintenanceOrder | null => {
    if (!code) return null;
    const upper = code.trim().toUpperCase();
    if (!upper) return null;
    return (
      realOrders.find(
        (o) =>
          (o.id || '').trim().toUpperCase() === upper ||
          (o.deviceBarcode && o.deviceBarcode.trim().toUpperCase() === upper)
      ) || null
    );
  };

  // 1. Direct Order ID / Device Barcode / URL param / Explicit QR Order ID
  const directCandidates = [
    parsed.explicitOrderId,
    urlParam,
    !parsed.isStructured ? normalizedRaw.toUpperCase() : null,
    !parsed.isStructured ? extractScannedBarcodeId(normalizedRaw) : null,
  ];
  for (const candidate of directCandidates) {
    const exact = findExactOrderById(candidate);
    if (exact) return exact;
  }

  // 2. Embedded Order IDs inside multi-line QR (e.g., Customer Profile QR "- TEC...")
  if (parsed.embeddedOrderIds.length > 0) {
    const matchedEmbedded = parsed.embeddedOrderIds
      .map((id) => findExactOrderById(id))
      .filter((o): o is MaintenanceOrder => Boolean(o));
    if (matchedEmbedded.length > 0) {
      return matchedEmbedded[0];
    }
  }

  // Also check if any existing order.id appears verbatim inside the scanned payload (supports any custom ID format)
  if (parsed.isStructured) {
    const upperPayload = normalizedRaw.toUpperCase();
    const containedOrders = realOrders.filter((o) => {
      const id = (o.id || '').trim().toUpperCase();
      if (id.length < 4) return false;
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[^A-Z0-9])${escaped}(?:$|[^A-Z0-9])`).test(upperPayload);
    });
    if (containedOrders.length > 0) {
      return pickPreferredOrder(containedOrders);
    }
  }

  // 3. Structured 5-field Order QR or Customer Profile QR matching against order records
  if (
    parsed.isStructured &&
    (parsed.customerName || parsed.customerPhone || parsed.fault || parsed.receivedDate || parsed.cost !== null || parsed.customerCode)
  ) {
    const parsedNameNorm = normalizeArabicTextForMatch(parsed.customerName || '');
    const parsedFaultRaw = (parsed.fault || '').replace(/\.{2,}$/, '').trim();
    const parsedFaultNorm = normalizeArabicTextForMatch(parsedFaultRaw);

    const matchedCustomer = (customers || []).find((c) => {
      if (parsed.customerCode && c.customerBarcode?.trim().toUpperCase() === parsed.customerCode) return true;
      if (parsed.customerPhone && phonesMatch(c.phone, parsed.customerPhone)) return true;
      if (parsedNameNorm && normalizeArabicTextForMatch(c.name) === parsedNameNorm) return true;
      return false;
    }) || null;

    let bestOrder: MaintenanceOrder | null = null;
    let bestScore = 0;

    for (const o of realOrders) {
      let score = 0;
      let hasIdentityMatch = false;
      let hasDateMatch = false;
      let hasFaultMatch = false;

      if (parsed.customerPhone) {
        if (o.customerPhone && phonesMatch(o.customerPhone, parsed.customerPhone)) {
          score += 45;
          hasIdentityMatch = true;
        } else if (o.customerPhone && normalizeCustomerPhone(o.customerPhone).length >= 6) {
          score -= 35;
        }
      }

      const orderNameNorm = normalizeArabicTextForMatch(o.customerName);
      if (parsedNameNorm) {
        if (orderNameNorm === parsedNameNorm) {
          score += 40;
          hasIdentityMatch = true;
        } else if (
          orderNameNorm &&
          (orderNameNorm.includes(parsedNameNorm) || parsedNameNorm.includes(orderNameNorm))
        ) {
          score += 22;
          hasIdentityMatch = true;
        } else if (
          !matchedCustomer ||
          (o.customerId !== matchedCustomer.id &&
            o.customerBarcode?.toUpperCase() !== matchedCustomer.customerBarcode?.toUpperCase())
        ) {
          score -= 25;
        }
      }

      if (matchedCustomer) {
        const linkedToCust =
          (o.customerId && o.customerId === matchedCustomer.id) ||
          (o.customerBarcode &&
            matchedCustomer.customerBarcode &&
            o.customerBarcode.toUpperCase() === matchedCustomer.customerBarcode.toUpperCase()) ||
          (matchedCustomer.phone && phonesMatch(o.customerPhone, matchedCustomer.phone));
        if (linkedToCust) {
          score += 20;
          hasIdentityMatch = true;
        }
      }

      if (parsed.receivedDate) {
        const orderCountryYmd = normalizeDateToYmd(formatCountryDateYmd(o.createdAt));
        const orderLocalYmd = normalizeDateToYmd(formatQrShortDate(o.createdAt));
        if (
          (orderCountryYmd && orderCountryYmd === parsed.receivedDate) ||
          (orderLocalYmd && orderLocalYmd === parsed.receivedDate)
        ) {
          score += 30;
          hasDateMatch = true;
        } else {
          score -= 10;
        }
      }

      if (parsedFaultNorm) {
        const orderFaultNorm = normalizeArabicTextForMatch(o.faultDescription);
        if (orderFaultNorm) {
          if (orderFaultNorm === parsedFaultNorm) {
            score += 30;
            hasFaultMatch = true;
          } else if (
            orderFaultNorm.startsWith(parsedFaultNorm) ||
            parsedFaultNorm.startsWith(orderFaultNorm)
          ) {
            score += 24;
            hasFaultMatch = true;
          } else if (
            parsedFaultNorm.length >= 4 &&
            (orderFaultNorm.includes(parsedFaultNorm) || parsedFaultNorm.includes(orderFaultNorm))
          ) {
            score += 15;
            hasFaultMatch = true;
          } else {
            score -= 8;
          }
        }
      }

      if (parsed.cost !== null) {
        const orderEffectiveCost = Number(
          o.actualCost !== undefined ? o.actualCost : (o.estimatedCost || 0)
        );
        const orderEstCost = Number(o.estimatedCost || 0);
        if (orderEffectiveCost === parsed.cost || orderEstCost === parsed.cost) {
          score += 15;
        } else {
          score -= 5;
        }
      }

      const validAnchor = hasIdentityMatch || (hasDateMatch && hasFaultMatch);
      if (!validAnchor || score <= 0) continue;

      if (!bestOrder || score > bestScore) {
        bestOrder = o;
        bestScore = score;
      } else if (score === bestScore) {
        const currentActive =
          o.status !== DeviceStatus.DELIVERED && o.status !== DeviceStatus.UNREPAIRABLE ? 1 : 0;
        const bestActive =
          bestOrder.status !== DeviceStatus.DELIVERED && bestOrder.status !== DeviceStatus.UNREPAIRABLE ? 1 : 0;
        if (
          currentActive > bestActive ||
          (currentActive === bestActive && (o.createdAt || 0) > (bestOrder.createdAt || 0))
        ) {
          bestOrder = o;
        }
      }
    }

    if (bestOrder) return bestOrder;
  }

  // 4. Exact Serial Number match
  const cleanSingleCode = (extractScannedBarcodeId(normalizedRaw) || normalizedRaw).toUpperCase();
  const serialMatches = realOrders.filter(
    (o) => o.serialNumber && o.serialNumber.trim().toUpperCase() === cleanSingleCode
  );
  if (serialMatches.length > 0) {
    return pickPreferredOrder(serialMatches);
  }

  // 5. Customer Barcode match -> return that customer's preferred order from records
  const custCodeCandidate = parsed.customerCode || cleanSingleCode;
  if (custCodeCandidate) {
    const matchedCustByCode = (customers || []).find(
      (c) => c.customerBarcode && c.customerBarcode.trim().toUpperCase() === custCodeCandidate
    );
    const byCustOrders = realOrders.filter((o) => {
      if (o.customerBarcode && o.customerBarcode.trim().toUpperCase() === custCodeCandidate) return true;
      if (matchedCustByCode) {
        if (o.customerId && o.customerId === matchedCustByCode.id) return true;
        if (matchedCustByCode.phone && phonesMatch(o.customerPhone, matchedCustByCode.phone)) return true;
        if (
          !matchedCustByCode.phone &&
          normalizeCustomerNameKey(o.customerName) === normalizeCustomerNameKey(matchedCustByCode.name)
        ) {
          return true;
        }
      }
      return false;
    });
    if (byCustOrders.length > 0) {
      return pickPreferredOrder(byCustOrders);
    }
  }

  // 6. Phone number match -> return preferred order from records
  const phoneDigits = parsed.customerPhone || normalizeCustomerPhone(cleanSingleCode);
  if (phoneDigits.length >= 6) {
    const phoneMatches = realOrders.filter((o) => phonesMatch(o.customerPhone, phoneDigits));
    if (phoneMatches.length > 0) {
      return pickPreferredOrder(phoneMatches);
    }
    const phoneCust = (customers || []).find((c) => phonesMatch(c.phone, phoneDigits));
    if (phoneCust) {
      const custPhoneOrders = realOrders.filter(
        (o) =>
          (o.customerId && o.customerId === phoneCust.id) ||
          (o.customerBarcode &&
            phoneCust.customerBarcode &&
            o.customerBarcode.toUpperCase() === phoneCust.customerBarcode.toUpperCase())
      );
      if (custPhoneOrders.length > 0) {
        return pickPreferredOrder(custPhoneOrders);
      }
    }
  }

  return null;
}

/**
 * Resolves any scanned QR/barcode payload strictly to an orderId string (nothing else).
 * Returns null if the scanned QR payload is structured customer/order text with no matching order record.
 */
export function resolveScannedOrderId(
  rawCode: string,
  orders: MaintenanceOrder[],
  customers: CustomerProfile[] = []
): string | null {
  const normalizedRaw = normalizeArabicDigitsAndBidi(rawCode);
  if (!normalizedRaw) return null;

  // 1. Always prefer resolving to an actual order record in the system
  const matchedOrder = resolveScannedOrderFromRecords(normalizedRaw, orders, customers);
  if (matchedOrder?.id) {
    return matchedOrder.id;
  }

  // 2. If not in local records, allow explicit order IDs from QR/URL/barcode
  const parsed = parseOrderCustomerQrPayload(normalizedRaw);
  if (parsed.explicitOrderId) return parsed.explicitOrderId;
  if (parsed.embeddedOrderIds.length > 0) return parsed.embeddedOrderIds[0];

  const urlOrder = extractUrlOrderParam(normalizedRaw);
  if (urlOrder) return urlOrder;

  // For structured multi-line Arabic QR codes with no matching record, do not leak raw text or phone
  if (parsed.isStructured) {
    return null;
  }

  // Plain single-line barcode / order ID typed or scanned directly
  const cleaned = extractScannedBarcodeId(normalizedRaw);
  if (!cleaned) return null;
  // Avoid returning pure phone numbers if we couldn't resolve them to any orderId
  if (/^\+?\d{7,}$/.test(cleaned) && (orders || []).length > 0) {
    return null;
  }
  return cleaned;
}


