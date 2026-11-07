export const isContactOrder = (o: any) => {
  return o.deviceType === 'جهة اتصال' || 
         o.brandModel === 'مستورد من الهاتف' || 
         o.brandModel === 'مستورد من VCF' || 
         o.brandModel === 'مستورد من Excel' ||
         o.brandModel === 'مستورد من إكسل' ||
         o.faultDescription === 'جهة اتصال مستوردة';
};

export enum DeviceStatus {
  RECEIVED = 'received',         // تم الاستلام
  DIAGNOSING = 'diagnosing',     // تحت الفحص
  REPAIRING = 'repairing',       // تحت الإصلاح
  PENDING = 'pending',           // قيد الانتظار
  READY = 'ready',               // جاهز للتسليم
  DELIVERED = 'delivered',       // تم التسليم
  UNREPAIRABLE = 'unrepairable'  // غير قابل للإصلاح
}

export interface MaintenancePhoto {
  id: string;
  url: string;                   // base64 image representation
  stage: string;                 // e.g. 'fault', 'diagnosing', 'repairing', 'ready', 'delivered', 'parts'
  stageLabel: string;            // e.g. 'توثيق العطل الأولي', 'فحص المكونات', 'أثناء الإصلاح واللحام', 'الجهاز بعد الإصلاح'
  note?: string;                 // ملاحظة أو وصف توضيحي للصورة
  timestamp: number;             // وقت التقاط الصورة
  takenBy?: string;              // اسم الفني الذي قام بالتصوير
}

export interface StatusHistoryEntry {
  status: DeviceStatus;
  timestamp: number;
  note: string;
  updatedBy: string;
  photos?: MaintenancePhoto[];
}

export interface MaintenanceOrder {
  id: string;                    // رقم الطلب (مثلاً: Order-1001)
  customerName: string;          // اسم العميل
  customerPhone: string;         // رقم هاتف العميل
  deviceType: string;            // نوع الجهاز (هاتف، لابتوب، تابلت، إلخ)
  brandModel: string;            // الماركة والموديل (أيفون 13، ديل XPS)
  serialNumber: string;          // الرقم التسلسلي للجهاز
  faultDescription: string;      // وصف العطل
  estimatedCost: number;         // التكلفة المتوقعة
  actualCost?: number;           // التكلفة الفعلية (تحدد عند الانتهاء)
  currency?: string;             // العملة المحددة للطلب (مثل: USD, SAR, JOD, ... إلخ)
  expectedDeliveryDate: string;  // تاريخ التسليم المتوقع (YYYY-MM-DD)
  status: DeviceStatus;          // الحالة الحالية
  statusUpdateText?: string;     // نص تحديث الحالة (ينتقل مع تغير الحالة)
  notes: string;                 // ملاحظات إضافية
  technician: string;            // اسم الفني المسؤول
  createdAt: number;             // تاريخ الإنشاء
  updatedAt: number;             // تاريخ التعديل
  statusHistory: StatusHistoryEntry[];
  photos?: MaintenancePhoto[];   // صور توثيق الأعطال ومراحل الصيانة بالكاميرا
  
  // بيانات التسليم (تعبأ عند التسليم الفعلي)
  deliveryInfo?: {
    recipientName: string;       // اسم الشخص المستلم
    deliveryDate: number;        // تاريخ ووقت التسليم الفعلي
    recipientSignature?: string; // التوقيع الرقمي (عبارة عن رسم خطي أو نصي مخزن كـ base64)
    relationToCustomer: string;  // صلة القرابة (العميل نفسه، أخوه، صديقه، إلخ)
    notes?: string;              // ملاحظات التسليم
  };
  customerFeedback?: {           // تقييم العميل ورأيه (بعد الاستلام)
    rating: number;              // من 1 إلى 5
    comment?: string;            // تعليق مكتوب
    timestamp: number;           // وقت التقييم
  };
}

export interface NotificationTemplate {
  id: string;
  name: string;
  statusTrigger: DeviceStatus | 'reminder';
  smsContent: string;
  whatsappContent: string;
}

export interface NotificationLog {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  type: 'sms' | 'whatsapp';
  content: string;
  status: 'sent' | 'pending' | 'failed';
  timestamp: number;
  triggerEvent: string; // تم الاستلام، جاهز، تذكير بموعد، إلخ
}

export interface AppUser {
  id: string;
  username: string;
  password?: string;
  displayName: string;
  role: 'admin' | 'engineer' | 'viewer';
  permissions: {
    view_dashboard: boolean;
    view_orders: boolean;
    add_orders: boolean;
    edit_orders: boolean;
    delete_orders: boolean;
    access_settings: boolean;
  };
}


