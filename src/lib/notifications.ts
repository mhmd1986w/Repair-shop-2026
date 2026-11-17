import {
  MaintenanceOrder,
  DeviceStatus,
  NotificationTemplate,
  StatusHistorySnapshot,
  CustomNotificationVariable,
} from '../types';
import { formatCountryDateYmd } from '../utils/barcode';

export function getStatusArabicLabel(status: DeviceStatus | string): string {
  switch (status) {
    case DeviceStatus.RECEIVED:
      return 'تم الاستلام';
    case DeviceStatus.DIAGNOSING:
      return 'تحت الفحص والتشخيص';
    case DeviceStatus.REPAIRING:
      return 'تحت الإصلاح والصيانة';
    case DeviceStatus.PENDING:
      return 'قيد الانتظار / انتظار القطع';
    case DeviceStatus.READY:
      return 'جاهز للتسليم';
    case DeviceStatus.DELIVERED:
      return 'تم التسليم';
    case DeviceStatus.UNREPAIRABLE:
      return 'غير قابل للإصلاح';
    default:
      return String(status || '');
  }
}

export function getOrderFinancials(
  order: Partial<MaintenanceOrder>,
  fallbackCurrency?: string
): {
  estimatedCost: number;
  extraCost: number;
  totalCost: number;
  advancePayment: number;
  remainingCost: number;
  currency: string;
} {
  const defaultCurrency =
    fallbackCurrency ||
    order.currency ||
    (typeof window !== 'undefined' && localStorage.getItem('currencyName')) ||
    'دينار';
  const estimatedCost = Math.max(0, Number(order.estimatedCost) || 0);
  const extraCost = Math.max(0, Number(order.extraCost) || 0);
  const advancePayment = Math.max(0, Number(order.advancePayment) || 0);
  const hasActual =
    order.actualCost !== undefined &&
    order.actualCost !== null &&
    !isNaN(Number(order.actualCost));
  const totalCost = hasActual ? Math.max(0, Number(order.actualCost)) : estimatedCost + extraCost;
  const remainingCost = Math.max(0, totalCost - advancePayment);

  return {
    estimatedCost,
    extraCost,
    totalCost,
    advancePayment,
    remainingCost,
    currency: defaultCurrency,
  };
}

export function sanitizeCustomVariables(
  vars?: CustomNotificationVariable[]
): CustomNotificationVariable[] {
  if (!Array.isArray(vars)) return [];
  return vars
    .map((v) => ({
      key: String(v?.key || '').trim(),
      label: String(v?.label || v?.key || '').trim(),
      value: String(v?.value || '').trim(),
    }))
    .filter((v) => v.label.length > 0 && v.value.length > 0);
}

export function buildStatusHistorySnapshot(
  order: MaintenanceOrder,
  options?: {
    statusNote?: string;
    sentMessage?: string;
    notificationChannel?: 'whatsapp' | 'sms' | 'none';
    currency?: string;
  }
): StatusHistorySnapshot {
  const fin = getOrderFinancials(order, options?.currency);
  const cleanCustomVars = sanitizeCustomVariables(order.customVariables);

  const snapshot: StatusHistorySnapshot = {
    statusLabel: getStatusArabicLabel(order.status),
    faultDescription: order.faultDescription || '',
    estimatedCost: fin.estimatedCost,
    extraCost: fin.extraCost,
    totalCost: fin.totalCost,
    advancePayment: fin.advancePayment,
    remainingCost: fin.remainingCost,
    currency: fin.currency,
  };

  if (order.actualCost !== undefined && order.actualCost !== null && !isNaN(Number(order.actualCost))) {
    snapshot.actualCost = Number(order.actualCost);
  }
  if (order.extraCostReason?.trim()) {
    snapshot.extraCostReason = order.extraCostReason.trim();
  }
  if (order.waitingPartsDetails?.trim()) {
    snapshot.waitingPartsDetails = order.waitingPartsDetails.trim();
  }
  if (order.waitingPartsExpectedDate?.trim()) {
    snapshot.waitingPartsExpectedDate = order.waitingPartsExpectedDate.trim();
  }
  if (order.expectedDeliveryDate?.trim()) {
    snapshot.expectedDeliveryDate = order.expectedDeliveryDate.trim();
  }
  if (order.technician?.trim()) {
    snapshot.technician = order.technician.trim();
  }
  const combinedNote = options?.statusNote?.trim() || order.statusUpdateText?.trim();
  if (combinedNote) {
    snapshot.statusUpdateText = combinedNote;
  }
  if (order.deliveryInfo?.recipientName?.trim()) {
    snapshot.recipientName = order.deliveryInfo.recipientName.trim();
  }
  if (order.deliveryInfo?.relationToCustomer?.trim()) {
    snapshot.relationToCustomer = order.deliveryInfo.relationToCustomer.trim();
  }
  if (options?.sentMessage?.trim()) {
    snapshot.sentMessage = options.sentMessage.trim();
  }
  if (options?.notificationChannel) {
    snapshot.notificationChannel = options.notificationChannel;
  }
  if (cleanCustomVars.length > 0) {
    snapshot.customVariables = cleanCustomVars;
  }

  return snapshot;
}

export const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'received',
    name: 'تأكيد استلام جهاز',
    statusTrigger: DeviceStatus.RECEIVED,
    smsContent: 'مرحباً {customerName}، تم استلام جهازك {device} بنجاح للصيانة. رقم الطلب: {orderId}. التكلفة المتوقعة: {totalCost} {currency}. لتتبع حالة الجهاز: {trackingUrl}',
    whatsappContent: 'مرحباً أ/ *{customerName}* 👋\n\nتم استلام جهازك *{device}* بنجاح في مركز الصيانة الخاص بنا.\n\n*تفاصيل الطلب:*\n- **رقم الطلب:** `{orderId}`\n- **العطل المذكور:** {fault}\n- **التكلفة المتوقعة:** {totalCost} {currency}\n- **تاريخ التسليم المتوقع:** {expectedDate}\n\nيمكنك تتبع حالة الإصلاح مباشرة وفي أي وقت عبر هذا الرابط:\n{trackingUrl}\n\n⚠️ *ملاحظة:* في حال تجاوز المدة أكثر من 14 يوماً من تاريخ الإشعار، فإن المتجر ليس مسؤولاً عن فقدان الجهاز.\n\nشكراً لثقتك بنا! ✨'
  },
  {
    id: 'diagnosing',
    name: 'تحت الفحص والتشخيص',
    statusTrigger: DeviceStatus.DIAGNOSING,
    smsContent: 'عميلنا العزيز {customerName}، جهازك ذو الرقم {orderId} قيد التشخيص والفحص الآن لمعرفة العطل بدقة وسنقوم بإبلاغك بالتكلفة قريباً.',
    whatsappContent: 'مرحباً أ/ *{customerName}* 👋\n\nنود إعلامك بأن جهازك *{device}* (رقم الطلب: `{orderId}`) هو الآن *قيد التشخيص والفحص الدقيق* من قِبل المهندس المختص 🛠️.\n\nسنقوم بتحديثك بالتقرير الفني وتكلفة الإصلاح فور الانتهاء من الفحص.\n\nللتتبع المباشر: {trackingUrl}'
  },
  {
    id: 'repairing',
    name: 'بدء عملية الإصلاح',
    statusTrigger: DeviceStatus.REPAIRING,
    smsContent: 'مرحباً {customerName}، بدأنا في صيانة جهازك {device} (الطلب {orderId}). التكلفة المتوقعة: {cost} دينار.',
    whatsappContent: 'مرحباً أ/ *{customerName}* 👋\n\nتم البدء في *عملية الإصلاح والصيانة* لجهازك *{device}* (رقم الطلب: `{orderId}`) بنجاح ⚙️.\n\n*تفاصيل الصيانة:*\n- **التكلفة التقريبية:** {cost} دينار أردني\n- **المهندس المسؤول:** {technician}\n\nسنخبرك فور جهوزية الجهاز للتسليم.\n\nللتتبع: {trackingUrl}'
  },
  {
    id: 'pending',
    name: 'قيد الانتظار / انتظار القطع',
    statusTrigger: DeviceStatus.PENDING,
    smsContent: 'مرحباً {customerName}، جهازك {device} (رقم {orderId}) قيد الانتظار حالياً: {waitingParts}. التكلفة الإجمالية: {totalCost} {currency}. المتابعة: {trackingUrl}',
    whatsappContent: 'مرحباً أ/ *{customerName}* 👋\n\nنود إعلامك بأن جهازك *{device}* (رقم الطلب: `{orderId}`) هو الآن *قيد الانتظار ⏳*.\n\n*تفاصيل الانتظار والقطع:*\n- **حالة / تفاصيل القطع:** {waitingParts}\n- **التكلفة الأساسية:** {estimatedCost} {currency}\n- **الكلف الإضافية:** {extraCost} {currency} ({extraCostReason})\n- **الإجمالي الكلي:** {totalCost} {currency}\n- **تاريخ التسليم المتوقع:** {expectedDate}\n\nللتتبع المباشر: {trackingUrl}'
  },
  {
    id: 'ready',
    name: 'الجهاز جاهز للتسليم',
    statusTrigger: DeviceStatus.READY,
    smsContent: 'بشرى سارة {customerName}! جهازك {device} جاهز للاستلام الآن في المحل. رقم الطلب: {orderId}. التكلفة: {cost} دينار.',
    whatsappContent: 'بشرى سارة أ/ *{customerName}*! 🎉🥳\n\nيسعدنا إبلاغك بأن جهازك *{device}* (رقم الطلب: `{orderId}`) قد تم *إصلاحه بالكامل وهو جاهز للتسليم الآن*!\n\n*تفاصيل الاستلام:*\n- **التكلفة النهائية:** {cost} دينار أردني\n- **الضمان:** خاضع للضمان المعتمد للمتجر ✅\n\nيمكنك زيارة المعرض لاستلام جهازك في أي وقت خلال ساعات العمل الرسمية.\n\nرابط موقعنا ومتابعة الفاتورة: {trackingUrl}\n\n⚠️ *تنبيه هام:* في حال تجاوز المدة أكثر من 14 يوماً من تاريخ الإشعار بالجهوزية، فإن المتجر ليس مسؤولاً عن فقدان الجهاز.'
  },
  {
    id: 'delivered',
    name: 'تأكيد تسليم الجهاز',
    statusTrigger: DeviceStatus.DELIVERED,
    smsContent: 'مرحباً {customerName}، تم تسليم جهازك {device} بنجاح إلى المستلم {recipient}. المبلغ الإجمالي: {totalCost} {currency}. شكراً لتعاملك معنا.',
    whatsappContent: 'مرحباً أ/ *{customerName}* 👋\n\nتم بحمد الله *تسليم جهازك* *{device}* (رقم الطلب: `{orderId}`) بنجاح اليوم.\n\n*تفاصيل عملية التسليم:*\n- **اسم المستلم الفعلي:** {recipient}\n- **صلة القرابة:** {relation}\n- **التكلفة المدفوعة:** {cost} دينار أردني\n\nنشكرك جزيلاً لتعاملك معنا ونسعد دوماً بخدمتك! 🌹🌹'
  },
  {
    id: 'unrepairable',
    name: 'غير قابل للإصلاح',
    statusTrigger: DeviceStatus.UNREPAIRABLE,
    smsContent: 'نأسف {customerName}، جهازك {device} (رقم {orderId}) غير قابل للإصلاح بعد الفحص الفني. يرجى استلامه دون أي رسوم.',
    whatsappContent: 'مرحباً أ/ *{customerName}* 👋\n\nبعد الفحص الفني الدقيق والمكثف لجهازك *{device}* (رقم الطلب: `{orderId}`)، يؤسفنا إبلاغك بأنه *غير قابل للإصلاح* بسبب تلف القطع الرئيسية 😔.\n\nيرجى التفضل بزيارة المحل لاستلام جهازك في أي وقت يناسبك. لا توجد أي رسوم على الفحص.\n\nرابط تتبع التقرير: {trackingUrl}\n\n⚠️ *تنبيه هام:* في حال تجاوز المدة أكثر من 14 يوماً من تاريخ الإشعار، فإن المتجر ليس مسؤولاً عن فقدان الجهاز.\n\nنشكرك لتفهمك ونسعد بخدمتك دائماً.'
  },
  {
    id: 'reminder',
    name: 'تذكير بموعد التسليم',
    statusTrigger: 'reminder',
    smsContent: 'تذكير: عميلنا {customerName}، نود تذكيرك بموعد تسليم جهازك {device} غداً. نسعد بزيارتك.',
    whatsappContent: 'تذكير لطيف عميلنا العزيز أ/ *{customerName}* ⏰\n\nنود تذكيرك بموعد التسليم المتوقع لجهازك *{device}* (رقم الطلب: `{orderId}`) المقرر غداً بمشيئة الله.\n\nيسعدنا استقبالك في مركز الصيانة لاستلام الجهاز.\n\nللتفاصيل والتتبع: {trackingUrl}\n\n⚠️ *ملاحظة:* في حال تجاوز المدة أكثر من 14 يوماً من تاريخ الإشعار، فإن المتجر ليس مسؤولاً عن فقدان الجهاز.'
  },
  {
    id: 'overdue_48h',
    name: 'تأخير استلام جاهز لأكثر من 48 ساعة',
    statusTrigger: 'overdue_48h' as any,
    smsContent: 'عميلنا {customerName}، لقد تجاوز جهازك {device} الموعد المحدد لأكثر من 48 ساعة. يرجى التواصل معنا.',
    whatsappContent: 'عميلنا العزيز أ/ *{customerName}* ⚠️\n\nنود تنبيهك بأن جهازك *{device}* (رقم الطلب: `{orderId}`) قد تجاوز موعد التسليم المحدد لأكثر من 48 ساعة.\n\nيرجى التواصل معنا بأقرب وقت للاستلام.\n\nللتتبع: {trackingUrl}\n\n⚠️ *ملاحظة:* في حال تجاوز المدة أكثر من 14 يوماً من تاريخ الإشعار، فإن المتجر ليس مسؤولاً عن فقدان الجهاز.'
  }
];

export function formatNotification(
  template: NotificationTemplate,
  order: MaintenanceOrder,
  appUrl: string,
  extraOptions?: {
    statusNote?: string;
    includeDynamicExtras?: boolean;
  }
): { sms: string; whatsapp: string } {
  const originFallback = typeof window !== 'undefined' ? window.location.origin : '';
  const trackingUrl = `${appUrl || originFallback}?track=${order.id}`;
  const fin = getOrderFinancials(order);
  const currencyName = fin.currency;
  const centerName = (typeof window !== 'undefined' && localStorage.getItem('centerName')) || 'مركز الصيانة الذكي';
  const centerMobile = (typeof window !== 'undefined' && localStorage.getItem('centerMobile')) || '';
  const receivedDate = formatCountryDateYmd(order.createdAt || Date.now());
  const statusLabel = getStatusArabicLabel(order.status);
  const waitingPartsText = (order.waitingPartsDetails || '').trim() || 'لا يوجد انتظار قطع حالياً';
  const waitingPartsDateText = (order.waitingPartsExpectedDate || '').trim() || order.expectedDeliveryDate || '';
  const extraCostReasonText = (order.extraCostReason || '').trim() || 'لا يوجد';
  const statusNoteText = (extraOptions?.statusNote || order.statusUpdateText || '').trim();
  const cleanCustomVars = sanitizeCustomVariables(order.customVariables);

  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const replaceTokens = (rawText: string, isWhatsapp: boolean) => {
    let text = rawText
      .replace(/{customerName}/g, order.customerName)
      .replace(/{orderId}/g, order.id)
      .replace(/{device}/g, `${order.deviceType} ${order.brandModel}`)
      .replace(/{fault}/g, order.faultDescription)
      .replace(/{status}/g, statusLabel)
      .replace(/{statusNote}/g, statusNoteText)
      .replace(/{statusUpdate}/g, statusNoteText)
      .replace(/{receivedDate}/g, receivedDate)
      .replace(/{receiptDate}/g, receivedDate)
      .replace(/{receiveDate}/g, receivedDate)
      .replace(/{expectedDate}/g, order.expectedDeliveryDate || '')
      .replace(/{estimatedCost}/g, fin.estimatedCost.toString())
      .replace(/{extraCost}/g, fin.extraCost.toString())
      .replace(/{extraCostReason}/g, extraCostReasonText)
      .replace(/{actualCost}/g, fin.totalCost.toString())
      .replace(/{totalCost}/g, fin.totalCost.toString())
      .replace(/{cost}/g, fin.totalCost.toString())
      .replace(/{advancePayment}/g, fin.advancePayment.toString())
      .replace(/{paid}/g, fin.advancePayment.toString())
      .replace(/{remainingCost}/g, fin.remainingCost.toString())
      .replace(/{remaining}/g, fin.remainingCost.toString())
      .replace(/{currency}/g, currencyName)
      .replace(/{waitingParts}/g, waitingPartsText)
      .replace(/{partsDetails}/g, waitingPartsText)
      .replace(/{waitingPartsDate}/g, waitingPartsDateText)
      .replace(/{partsDate}/g, waitingPartsDateText)
      .replace(/{technician}/g, order.technician || 'فني الصيانة')
      .replace(/{trackingUrl}/g, trackingUrl)
      .replace(/{centerName}/g, centerName)
      .replace(/{centerMobile}/g, centerMobile)
      .replace(/{centerPhone}/g, centerMobile)
      .replace(/{recipient}/g, order.deliveryInfo?.recipientName || order.customerName)
      .replace(/{relation}/g, order.deliveryInfo?.relationToCustomer || 'العميل نفسه')
      .replace(/{date}/g, order.expectedDeliveryDate || '');

    // Replace user-defined custom variables inside template text if referenced as {key} or {label}
    cleanCustomVars.forEach((cv) => {
      if (cv.key) {
        text = text.replace(new RegExp(`\\{${escapeRegExp(cv.key)}\\}`, 'g'), cv.value);
      }
      if (cv.label && cv.label !== cv.key) {
        text = text.replace(new RegExp(`\\{${escapeRegExp(cv.label)}\\}`, 'g'), cv.value);
      }
    });

    text = text
      .replace(/دينار أردني/g, currencyName)
      .replace(/دينار/g, currencyName);

    // Automatically append any populated new variables (extraCost, waitingParts, advance/remaining, customVars, statusNote)
    // that were NOT already embedded in the raw template so nothing important is ever dropped!
    if (extraOptions?.includeDynamicExtras !== false) {
      const extraLines: string[] = [];

      const hasExtraCostToken = rawText.includes('{extraCost}');
      const hasWaitingPartsToken = rawText.includes('{waitingParts}') || rawText.includes('{partsDetails}');
      const hasAdvanceToken = rawText.includes('{advancePayment}') || rawText.includes('{paid}');
      const hasRemainingToken = rawText.includes('{remainingCost}') || rawText.includes('{remaining}');
      const hasTotalToken = rawText.includes('{totalCost}') || rawText.includes('{cost}') || rawText.includes('{actualCost}');
      const hasStatusNoteToken = rawText.includes('{statusNote}') || rawText.includes('{statusUpdate}');

      if (fin.extraCost > 0 && !hasExtraCostToken) {
        const reasonSuffix = order.extraCostReason?.trim() ? ` (${order.extraCostReason.trim()})` : '';
        extraLines.push(
          isWhatsapp
            ? `- *كلف إضافية:* ${fin.extraCost} ${currencyName}${reasonSuffix}`
            : `كلف إضافية: ${fin.extraCost} ${currencyName}${reasonSuffix}`
        );
        if (!hasTotalToken || !rawText.includes('{estimatedCost}')) {
          extraLines.push(
            isWhatsapp
              ? `- *التكلفة الأساسية:* ${fin.estimatedCost} ${currencyName} | *الإجمالي الكلي:* ${fin.totalCost} ${currencyName}`
              : `التكلفة الأساسية: ${fin.estimatedCost} ${currencyName} | الإجمالي: ${fin.totalCost} ${currencyName}`
          );
        }
      }

      if (fin.advancePayment > 0 && (!hasAdvanceToken || !hasRemainingToken)) {
        extraLines.push(
          isWhatsapp
            ? `- *الدفعة المقدمة (العربون):* ${fin.advancePayment} ${currencyName} | *المتبقي:* ${fin.remainingCost} ${currencyName}`
            : `العربون: ${fin.advancePayment} ${currencyName} | المتبقي: ${fin.remainingCost} ${currencyName}`
        );
      }

      if (order.waitingPartsDetails?.trim() && !hasWaitingPartsToken) {
        const dateSuffix = order.waitingPartsExpectedDate?.trim()
          ? ` (الموعد المتوقع: ${order.waitingPartsExpectedDate.trim()})`
          : '';
        extraLines.push(
          isWhatsapp
            ? `- *انتظار القطع:* ${order.waitingPartsDetails.trim()}${dateSuffix}`
            : `انتظار القطع: ${order.waitingPartsDetails.trim()}${dateSuffix}`
        );
      }

      cleanCustomVars.forEach((cv) => {
        const isUsed =
          (cv.key && rawText.includes(`{${cv.key}}`)) ||
          (cv.label && rawText.includes(`{${cv.label}}`));
        if (!isUsed) {
          extraLines.push(
            isWhatsapp ? `- *${cv.label}:* ${cv.value}` : `${cv.label}: ${cv.value}`
          );
        }
      });

      if (statusNoteText && !hasStatusNoteToken) {
        extraLines.push(
          isWhatsapp ? `- *ملاحظة التحديث:* ${statusNoteText}` : `ملاحظة: ${statusNoteText}`
        );
      }

      if (extraLines.length > 0) {
        text += isWhatsapp
          ? `\n\n📌 *تفاصيل ومتغيرات إضافية:*\n${extraLines.join('\n')}`
          : `\n${extraLines.join(' | ')}`;
      }
    }

    return text;
  };

  return {
    sms: replaceTokens(template.smsContent, false),
    whatsapp: replaceTokens(template.whatsappContent, true)
  };
}

// Clean and normalize phone numbers for international WhatsApp messaging
export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Convert Arabic-Indic numbers (٠١٢٣٤٥٦٧٨٩) to standard English numbers (0123456789)
  let cleanPhone = phone.toString();
  const arabicNums = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  for (let i = 0; i < 10; i++) {
    cleanPhone = cleanPhone.replace(arabicNums[i], i.toString());
  }

  // Remove non-digit characters (spaces, dashes, parens, plus, dots, commas)
  cleanPhone = cleanPhone.replace(/[\s\-\(\)\+\.,\/]/g, '');

  // Strip leading double zeroes (e.g. 00962... -> 962...)
  while (cleanPhone.startsWith('00')) {
    cleanPhone = cleanPhone.substring(2);
  }

  const rawDialCode = (typeof window !== 'undefined' && localStorage.getItem('countryDialCode')) || '962';
  const countryDialCode = rawDialCode.replace(/[\s\-\(\)\+\.,\/]/g, '').replace(/^0+/, '') || '962';

  if (cleanPhone.startsWith(countryDialCode)) {
    // If number starts with country dial code AND immediately has a local zero (e.g. 962 0 79xxxxxxx), remove the zero!
    const afterCode = cleanPhone.substring(countryDialCode.length);
    if (afterCode.startsWith('0')) {
      cleanPhone = countryDialCode + afterCode.substring(1);
    }
  } else if (cleanPhone.startsWith('0')) {
    // Local mobile starting with 0 (e.g. 0791234567) -> replace leading 0 with country dial code
    cleanPhone = countryDialCode + cleanPhone.substring(1);
  } else if (cleanPhone.length >= 7 && cleanPhone.length <= 10) {
    // Local mobile without leading 0 (e.g. 791234567) -> prepend country dial code
    cleanPhone = countryDialCode + cleanPhone;
  }

  return cleanPhone;
}

// Function to generate direct official WhatsApp API link (avoids intermediate wa.me landing roadblocks)
export function getWhatsAppLink(phone: string, text: string): string {
  const clean = cleanPhoneNumber(phone);
  const encodedText = encodeURIComponent(text || '');
  if (!clean) {
    return `https://api.whatsapp.com/send?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?phone=${clean}&text=${encodedText}`;
}

// Function for WhatsApp Web specifically (ideal for desktop PC browsers)
export function getWhatsAppWebLink(phone: string, text: string): string {
  const clean = cleanPhoneNumber(phone);
  const encodedText = encodeURIComponent(text || '');
  if (!clean) {
    return `https://web.whatsapp.com/send?text=${encodedText}`;
  }
  return `https://web.whatsapp.com/send?phone=${clean}&text=${encodedText}`;
}

// Function for native WhatsApp mobile protocol
export function getWhatsAppNativeLink(phone: string, text: string): string {
  const clean = cleanPhoneNumber(phone);
  const encodedText = encodeURIComponent(text || '');
  if (!clean) {
    return `whatsapp://send?text=${encodedText}`;
  }
  return `whatsapp://send?phone=${clean}&text=${encodedText}`;
}

// Open WhatsApp smoothly without popup blockers interrupting the flow
export function openWhatsAppDirectly(phone: string, text: string): void {
  if (typeof window === 'undefined') return;

  const clean = cleanPhoneNumber(phone);
  const encodedText = encodeURIComponent(text || '');
  const apiUrl = `https://api.whatsapp.com/send?phone=${clean}&text=${encodedText}`;
  const nativeUrl = `whatsapp://send?phone=${clean}&text=${encodedText}`;

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  try {
    if (isMobile) {
      // In Android WebAPK / Mobile Chrome, clicking an invisible <a> tag or navigating triggers WhatsApp intent natively
      const link = document.createElement('a');
      link.href = apiUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
        } catch (e) {}
      }, 800);
    } else {
      window.open(apiUrl, '_blank', 'noopener,noreferrer');
    }
  } catch (err) {
    console.warn("Direct link opening fallback triggered:", err);
    try {
      window.open(apiUrl, '_blank');
    } catch (e) {
      window.location.href = apiUrl;
    }
  }
}
