import { MaintenanceOrder, DeviceStatus, NotificationTemplate } from '../types';

export const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'received',
    name: 'تأكيد استلام جهاز',
    statusTrigger: DeviceStatus.RECEIVED,
    smsContent: 'مرحباً {customerName}، تم استلام جهازك {device} بنجاح للصيانة. رقم الطلب: {orderId}. لتتبع حالة الجهاز: {trackingUrl}',
    whatsappContent: 'مرحباً أ/ *{customerName}* 👋\n\nتم استلام جهازك *{device}* بنجاح في مركز الصيانة الخاص بنا.\n\n*تفاصيل الطلب:*\n- **رقم الطلب:** `{orderId}`\n- **العطل المذكور:** {fault}\n- **تاريخ التسليم المتوقع:** {expectedDate}\n\nيمكنك تتبع حالة الإصلاح مباشرة وفي أي وقت عبر هذا الرابط:\n{trackingUrl}\n\n⚠️ *ملاحظة:* في حال تجاوز المدة أكثر من 14 يوماً من تاريخ الإشعار، فإن المتجر ليس مسؤولاً عن فقدان الجهاز.\n\nشكراً لثقتك بنا! ✨'
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
    smsContent: 'مرحباً {customerName}، تم تسليم جهازك {device} بنجاح إلى المستلم {recipient}. شكراً لتعاملك معنا.',
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
  appUrl: string
): { sms: string; whatsapp: string } {
  const trackingUrl = `${appUrl || window.location.origin}?track=${order.id}`;
  const currencyName = (typeof window !== 'undefined' && localStorage.getItem('currencyName')) || 'دينار';
  const centerName = (typeof window !== 'undefined' && localStorage.getItem('centerName')) || 'مركز الصيانة الذكي';
  
  const replaceTokens = (text: string) => {
    return text
      .replace(/{customerName}/g, order.customerName)
      .replace(/{orderId}/g, order.id)
      .replace(/{device}/g, `${order.deviceType} ${order.brandModel}`)
      .replace(/{fault}/g, order.faultDescription)
      .replace(/{expectedDate}/g, order.expectedDeliveryDate)
      .replace(/{cost}/g, (order.actualCost || order.estimatedCost || 0).toString())
      .replace(/{technician}/g, order.technician || 'فني الصيانة')
      .replace(/{trackingUrl}/g, trackingUrl)
      .replace(/{centerName}/g, centerName)
      .replace(/{recipient}/g, order.deliveryInfo?.recipientName || order.customerName)
      .replace(/{relation}/g, order.deliveryInfo?.relationToCustomer || 'العميل نفسه')
      .replace(/{date}/g, order.expectedDeliveryDate)
      .replace(/دينار أردني/g, currencyName)
      .replace(/دينار/g, currencyName);
  };

  return {
    sms: replaceTokens(template.smsContent),
    whatsapp: replaceTokens(template.whatsappContent)
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
