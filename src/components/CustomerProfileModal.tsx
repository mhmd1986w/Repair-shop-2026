import React, { useState, useEffect, useMemo } from 'react';
import { MaintenanceOrder, DeviceStatus, NotificationTemplate, NotificationLog, AppUser, isContactOrder, MaintenancePhoto, CustomerProfile, StatusHistorySnapshot } from '../types';
import { 
  User, 
  Phone, 
  Package, 
  MessageSquare, 
  Calendar, 
  Clock, 
  Wrench, 
  CheckCircle2, 
  Printer, 
  X, 
  FileText, 
  PhoneCall, 
  AlertCircle, 
  Plus, 
  ShieldCheck, 
  Layers, 
  Smartphone,
  CreditCard,
  History,
  Check,
  Share2,
  Camera,
  QrCode,
  Copy,
  Edit3,
  RefreshCw,
  Download
} from 'lucide-react';
import { getWhatsAppLink, openWhatsAppDirectly, buildStatusHistorySnapshot, getOrderFinancials, getStatusArabicLabel } from '../lib/notifications';
import { PreNotificationModal } from './PreNotificationModal';
import { StatusSnapshotBadges } from './StatusSnapshotBadges';
import {
  getStoredLabelLayout,
  getLabelContainerStyles,
  getLabelElementMetrics,
  getSplitThermalLabelMetrics,
  FIXED_LABEL_PAPER_SIZE
} from '../utils/labelDesigner';
import { buildTrackingUrl, getEffectiveAppUrl } from '../utils/appDomain';
import {
  printHtmlViaIframe,
  printPureContent,
  downloadPrintableHtml,
  isEmbeddedIframe
} from '../lib/printUtils';
import { renderPrintableBarcodeSvg } from '../utils/barcode';
import { renderAlphanumericQrSvg } from '../utils/qrAlphanumeric';
import {
  buildCustomerQrPayload,
  buildOrderCustomerQrPayload,
  generateUniqueCustomerBarcode,
  normalizeCustomerNameKey,
  phonesMatch,
  sanitizeCustomCustomerBarcode,
} from '../utils/customerBarcode';

interface CustomerProfileModalProps {
  customer?: CustomerProfile | null;
  customers?: CustomerProfile[];
  customerName: string;
  customerPhone?: string;
  orders: MaintenanceOrder[];
  notificationLogs: NotificationLog[];
  templates?: NotificationTemplate[];
  appUrl?: string;
  currentUser?: AppUser | null;
  onSaveOrder?: (order: MaintenanceOrder) => void;
  onUpdateCustomerBarcode?: (customerId: string, newBarcode: string) => Promise<{ ok: boolean; error?: string }>;
  onTriggerDelivery?: (order: MaintenanceOrder) => void;
  onLogNotification?: (orderId: string, customerName: string, customerPhone: string, type: 'sms' | 'whatsapp', content: string, triggerEvent: string, variablesSnapshot?: StatusHistorySnapshot) => void;
  onClose: () => void;
  onNavigateToOrder?: (orderId: string) => void;
  onOpenNewOrderForCustomer?: (customerName: string, customerPhone: string) => void;
}

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
  customer: propCustomer = null,
  customers = [],
  customerName,
  customerPhone = '',
  orders,
  notificationLogs,
  templates,
  appUrl,
  currentUser,
  onSaveOrder,
  onUpdateCustomerBarcode,
  onTriggerDelivery,
  onLogNotification,
  onClose,
  onNavigateToOrder,
  onOpenNewOrderForCustomer
}) => {
  const [activeTab, setActiveTab] = useState<'devices' | 'messages' | 'summary'>('devices');
  const [selectedGalleryPhoto, setSelectedGalleryPhoto] = useState<MaintenancePhoto | null>(null);
  const [copiedCustomerBarcode, setCopiedCustomerBarcode] = useState(false);
  const [isEditingBarcode, setIsEditingBarcode] = useState(false);
  const [barcodeDraft, setBarcodeDraft] = useState('');
  const [barcodeError, setBarcodeError] = useState('');
  const [savingBarcode, setSavingBarcode] = useState(false);
  const [printPreviewDoc, setPrintPreviewDoc] = useState<{
    title: string;
    subtitle: string;
    filename: string;
    contentHtml: string;
    pageStyle: string;
    fullHtml: string;
    kind: 'label' | 'receipt' | 'sticker' | 'report';
    previewMinHeightPx: number;
  } | null>(null);
  const currencyName = localStorage.getItem('currencyName') || 'دينار';
  const centerName = localStorage.getItem('centerName') || 'مركز الصيانة الذكي';

  // Instant scroll to top when modal opens
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Resolve matching CustomerProfile from customers list or order links
  const resolvedCustomer = useMemo(() => {
    if (propCustomer) {
      const live = customers.find((c) => c.id === propCustomer.id);
      return live || propCustomer;
    }
    if (customerPhone) {
      const byPhone = customers.find((c) => phonesMatch(c.phone, customerPhone));
      if (byPhone) return byPhone;
    }
    const nameKey = normalizeCustomerNameKey(customerName);
    if (nameKey) {
      const byName = customers.find((c) => normalizeCustomerNameKey(c.name) === nameKey);
      if (byName) return byName;
    }
    return null;
  }, [propCustomer, customers, customerPhone, customerName]);

  // Clean strings for fuzzy & exact matching
  const cleanPhone = (resolvedCustomer?.phone || customerPhone || '').replace(/[\s-+]/g, '');
  const cleanName = (resolvedCustomer?.name || customerName || '').trim().toLowerCase();

  // Find all maintenance orders for this customer
  const customerOrders = useMemo(() => {
    return orders.filter(o => {
      if (isContactOrder(o)) return false;
      if (resolvedCustomer) {
        if (o.customerId && o.customerId === resolvedCustomer.id) return true;
        if (o.customerBarcode && o.customerBarcode.toUpperCase() === resolvedCustomer.customerBarcode.toUpperCase()) return true;
      }
      const orderPhone = (o.customerPhone || '').replace(/[\s-+]/g, '');
      const orderName = (o.customerName || '').trim().toLowerCase();

      if (cleanPhone && orderPhone && (orderPhone === cleanPhone || orderPhone.includes(cleanPhone) || cleanPhone.includes(orderPhone))) {
        return true;
      }
      if (cleanName && orderName && (orderName === cleanName || orderName.includes(cleanName) || cleanName.includes(orderName))) {
        return true;
      }
      return false;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [orders, cleanPhone, cleanName, resolvedCustomer]);

  // Derive most accurate display phone, name, and persistent customerBarcode
  const displayPhone = resolvedCustomer?.phone || customerOrders[0]?.customerPhone || customerPhone || 'غير مسجل';
  const displayName = resolvedCustomer?.name || customerOrders[0]?.customerName || customerName || 'بدون اسم';
  const displayCustomerBarcode = resolvedCustomer?.customerBarcode || customerOrders[0]?.customerBarcode || '';

  const usedBarcodesSet = useMemo(() => {
    const s = new Set<string>();
    customers.forEach((c) => {
      if (c.customerBarcode) s.add(c.customerBarcode.toUpperCase());
    });
    orders.forEach((o) => {
      if (o.id) s.add(o.id.toUpperCase());
    });
    return s;
  }, [customers, orders]);

  const customerQrPayload = useMemo(
    () =>
      buildCustomerQrPayload({
        customer: resolvedCustomer,
        name: displayName,
        phone: displayPhone === 'غير مسجل' ? '' : displayPhone,
        customerBarcode: displayCustomerBarcode,
        orders: customerOrders,
        currencyName,
        centerName,
        maxLength: 650,
      }),
    [resolvedCustomer, displayName, displayPhone, displayCustomerBarcode, customerOrders, currencyName, centerName]
  );

  const compactCustomerQrPayload = useMemo(
    () =>
      buildCustomerQrPayload({
        customer: resolvedCustomer,
        name: displayName,
        phone: displayPhone === 'غير مسجل' ? '' : displayPhone,
        customerBarcode: displayCustomerBarcode,
        orders: customerOrders,
        currencyName,
        centerName,
        maxLength: 280,
      }),
    [resolvedCustomer, displayName, displayPhone, displayCustomerBarcode, customerOrders, currencyName, centerName]
  );

  const handleCopyCustomerBarcode = async () => {
    if (!displayCustomerBarcode) return;
    try {
      await navigator.clipboard.writeText(displayCustomerBarcode);
      setCopiedCustomerBarcode(true);
      setTimeout(() => setCopiedCustomerBarcode(false), 1600);
    } catch {
      // ignore
    }
  };

  const handlePrintCustomerBarcodeSticker = () => {
    const primaryOrderId = customerOrders[0]?.id || '';
    const qrValue = compactCustomerQrPayload || primaryOrderId;
    if (!qrValue) return;
    const centerMobile = localStorage.getItem('centerMobile') || '';
    const qrSvgHtml = renderAlphanumericQrSvg({
      value: qrValue,
      mode: 'auto',
      physicalSizeMm: 14.5,
      marginModules: 1,
      errorCorrectionLevel: 'L',
    });
    const stickerStyle = `
      @page { size: 38mm 25mm; margin: 0 !important; }
      * { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body {
        width: 38mm !important;
        height: 25mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        background: #ffffff !important;
        font-family: 'Cairo', system-ui, sans-serif !important;
        color: #000000 !important;
      }
      .card {
        width: 38mm;
        height: 25mm;
        padding: 1.2mm 1.4mm;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 1.1mm;
        margin: 0 auto;
        background: #ffffff;
      }
      .qr-box {
        flex: 0 0 14.8mm;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #fff;
      }
      .meta {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        text-align: right;
        gap: 0.45mm;
      }
      .center { font-size: 5.8pt; font-weight: 900; line-height: 1.1; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-bottom: 0.25mm solid #e5e7eb; padding-bottom: 0.3mm; }
      .cust { font-size: 7.2pt; font-weight: 900; line-height: 1.1; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .phone { font-size: 6pt; font-family: system-ui, -apple-system, 'Cairo', sans-serif; font-variant-numeric: tabular-nums; font-weight: 700; direction: ltr; text-align: right; white-space: nowrap; }
      .tag { font-size: 5pt; font-weight: 800; color: #374151; white-space: nowrap; }
      .code { font-size: 5.8pt; font-family: 'Courier New', monospace; font-weight: 900; letter-spacing: 0.1px; direction: ltr; text-align: right; white-space: nowrap; }
    `;
    const bodyContent = `
      <div class="card">
        <div class="meta">
          <div class="center">${centerName}${centerMobile ? ` · ${centerMobile}` : ''}</div>
          <div class="cust">${displayName}</div>
          ${displayPhone && displayPhone !== 'غير مسجل' ? `<div class="phone">${displayPhone}</div>` : ''}
          <div class="tag">QR معلومات الزبون</div>
          ${primaryOrderId ? `<div class="code">${primaryOrderId}</div>` : ''}
        </div>
        <div class="qr-box">
          ${qrSvgHtml}
        </div>
      </div>
    `;
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>بطاقة QR الزبون - ${displayName}</title>
          <style>${stickerStyle}</style>
        </head>
        <body>${bodyContent}</body>
      </html>
    `;
    printPureContent(bodyContent, stickerStyle);
    setPrintPreviewDoc({
      title: 'ملصق QR الزبون (38×25 مم)',
      subtitle: primaryOrderId ? `${displayName} · ${primaryOrderId}` : displayName,
      filename: `customer-qr-${primaryOrderId || 'profile'}.html`,
      contentHtml: bodyContent,
      pageStyle: stickerStyle,
      fullHtml: html,
      kind: 'sticker',
      previewMinHeightPx: 190,
    });
  };

  const handleSaveEditedBarcode = async () => {
    if (!resolvedCustomer || !onUpdateCustomerBarcode) return;
    const sanitized = sanitizeCustomCustomerBarcode(barcodeDraft);
    if (!sanitized) {
      setBarcodeError('أدخل رمز باركود صالح بالأحرف الإنجليزية أو الأرقام');
      return;
    }
    setSavingBarcode(true);
    setBarcodeError('');
    try {
      const res = await onUpdateCustomerBarcode(resolvedCustomer.id, sanitized);
      if (!res.ok) {
        setBarcodeError(res.error || 'هذا الباركود مستخدم مسبقاً');
      } else {
        setIsEditingBarcode(false);
        setStatusUpdateSuccess(`تم تحديث وربط باركود الزبون بنجاح: ${sanitized}`);
        setTimeout(() => setStatusUpdateSuccess(null), 4000);
      }
    } finally {
      setSavingBarcode(false);
    }
  };

  // Find all notification logs sent to this customer
  const customerLogs = useMemo(() => {
    return notificationLogs.filter(log => {
      const logPhone = (log.customerPhone || '').replace(/[\s-+]/g, '');
      const logName = (log.customerName || '').trim().toLowerCase();

      if (cleanPhone && logPhone && (logPhone === cleanPhone || logPhone.includes(cleanPhone) || cleanPhone.includes(logPhone))) {
        return true;
      }
      if (cleanName && logName && (logName === cleanName || logName.includes(cleanName) || cleanName.includes(logName))) {
        return true;
      }
      return false;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [notificationLogs, cleanPhone, cleanName]);

  // Metrics computation
  const totalOrdersCount = customerOrders.length;
  const inMaintenanceCount = customerOrders.filter(
    o => o.status === DeviceStatus.RECEIVED || o.status === DeviceStatus.DIAGNOSING || o.status === DeviceStatus.REPAIRING
  ).length;
  const readyCount = customerOrders.filter(o => o.status === DeviceStatus.READY).length;
  const deliveredCount = customerOrders.filter(o => o.status === DeviceStatus.DELIVERED).length;
  const unrepairableCount = customerOrders.filter(o => o.status === DeviceStatus.UNREPAIRABLE).length;

  const totalCostSum = customerOrders.reduce((sum, o) => {
    const cost = o.actualCost !== undefined ? Number(o.actualCost) : Number(o.estimatedCost || 0);
    return sum + (isNaN(cost) ? 0 : cost);
  }, 0);

  const getStatusBadge = (status: DeviceStatus) => {
    switch (status) {
      case DeviceStatus.RECEIVED:
        return <span className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-sans font-bold rounded-lg">تم الاستلام</span>;
      case DeviceStatus.DIAGNOSING:
        return <span className="px-2.5 py-0.5 bg-purple-50 border border-purple-200 text-purple-800 text-[11px] font-sans font-bold rounded-lg">تحت الفحص</span>;
      case DeviceStatus.REPAIRING:
        return <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-sans font-bold rounded-lg">تحت الإصلاح</span>;
      case DeviceStatus.PENDING:
        return <span className="px-2.5 py-0.5 bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-sans font-bold rounded-lg">قيد الانتظار ⏳</span>;
      case DeviceStatus.READY:
        return <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-sans font-bold rounded-lg">جاهز للتسليم 🎉</span>;
      case DeviceStatus.DELIVERED:
        return <span className="px-2.5 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 text-[11px] font-sans font-bold rounded-lg">تم التسليم ✅</span>;
      case DeviceStatus.UNREPAIRABLE:
        return <span className="px-2.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-sans font-bold rounded-lg">غير قابل للإصلاح</span>;
      default:
        return <span className="px-2.5 py-0.5 bg-gray-50 border border-gray-200 text-gray-600 text-[11px] font-sans font-bold rounded-lg">{status}</span>;
    }
  };

  // Active/selected device for status updating
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Determine current active order for status update
  const currentDevice = useMemo(() => {
    if (customerOrders.length === 0) return null;
    if (selectedDeviceId) {
      const found = customerOrders.find(o => o.id === selectedDeviceId);
      if (found) return found;
    }
    // Default to the first order that is not delivered, or the most recent order
    const inProgress = customerOrders.find(o => o.status !== DeviceStatus.DELIVERED);
    return inProgress || customerOrders[0];
  }, [customerOrders, selectedDeviceId]);

  // Pre-notification modal state for editing/dispatching notification
  const [preNotificationTarget, setPreNotificationTarget] = useState<{
    order: MaintenanceOrder;
    targetStatus: DeviceStatus;
  } | null>(null);

  // Status update success message banner
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState<string | null>(null);

  const handleStatusChange = (newStatus: DeviceStatus) => {
    if (!currentDevice) return;
    if (newStatus === currentDevice.status) return;

    if (newStatus === DeviceStatus.DELIVERED) {
      if (onTriggerDelivery) {
        onTriggerDelivery(currentDevice);
        onClose();
        return;
      }
    }

    if (templates && templates.length > 0) {
      setPreNotificationTarget({
        order: currentDevice,
        targetStatus: newStatus
      });
    } else {
      const updatedBase: MaintenanceOrder = {
        ...currentDevice,
        status: newStatus,
        updatedAt: Date.now()
      };
      const snapshot = buildStatusHistorySnapshot(updatedBase, {
        statusNote: `تم تغيير مرحلة الجهاز إلى (${getStatusArabicLabel(newStatus)}) عبر ملف العميل`,
        notificationChannel: 'none'
      });
      const historyEntry = {
        status: newStatus,
        note: `تم تغيير مرحلة الجهاز إلى (${getStatusArabicLabel(newStatus)}) عبر ملف العميل`,
        timestamp: Date.now(),
        updatedBy: currentUser?.displayName || 'المهندس',
        snapshot
      };
      const updated: MaintenanceOrder = {
        ...updatedBase,
        statusHistory: [...(currentDevice.statusHistory || []), historyEntry],
      };
      if (onSaveOrder) {
        onSaveOrder(updated);
      }
      setStatusUpdateSuccess(`تم تحديث مرحلة الجهاز إلى: ${getStatusArabicLabel(newStatus)}`);
      setTimeout(() => setStatusUpdateSuccess(null), 4000);
    }
  };

  const handlePrintCustomerReport = () => {
    const customerQrSvg = customerQrPayload
      ? renderAlphanumericQrSvg({
          value: customerQrPayload,
          mode: 'auto',
          sizePx: 88,
          marginModules: 2,
          errorCorrectionLevel: 'L',
        })
      : '';
    const reportHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>تقرير الصيانة الشامل للعميل - ${displayName}</title>
          <style>
            body { font-family: 'Cairo', system-ui, sans-serif; margin: 20px; direction: rtl; color: #111; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 16px; }
            .center-name { font-size: 20px; font-weight: bold; color: #0d9488; }
            .customer-info { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #f8fafc; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
            .stats { display: flex; gap: 12px; margin-bottom: 20px; }
            .stat-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; background: #fff; }
            .stat-val { font-size: 18px; font-weight: bold; color: #0f766e; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right; }
            th { background: #f1f5f9; font-weight: bold; }
            .badge { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; display: inline-block; }
            .timeline { margin-top: 6px; font-size: 10px; color: #64748b; }
            @media print {
              button { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="center-name">${centerName}</div>
            <div style="font-size: 14px; color: #64748b; margin-top: 4px;">تقرير سجل الصيانة الشامل والأجهزة المسجلة للزبون</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">تاريخ استخراج التقرير: ${new Date().toLocaleString('ar-SA')}</div>
          </div>

          <div class="customer-info">
            <div style="flex: 1; display: flex; flex-wrap: wrap; gap: 12px 24px;">
              <div><strong>اسم الزبون:</strong> ${displayName}</div>
              <div><strong>رقم الهاتف:</strong> <span dir="ltr">${displayPhone}</span></div>
              ${customerOrders[0]?.id ? `<div><strong>آخر رقم طلب:</strong> <span dir="ltr" style="font-family: monospace; font-weight: bold;">${customerOrders[0].id}</span></div>` : ''}
              <div><strong>إجمالي الأجهزة:</strong> ${totalOrdersCount} جهاز</div>
              <div><strong>إجمالي المبالغ:</strong> ${totalCostSum} ${currencyName}</div>
            </div>
            ${customerQrSvg ? `<div style="background:#fff;padding:4px;border:1px solid #cbd5e1;border-radius:6px;text-align:center;">${customerQrSvg}</div>` : ''}
          </div>

          <div class="stats">
            <div class="stat-box"><div>قيد الصيانة</div><div class="stat-val">${inMaintenanceCount}</div></div>
            <div class="stat-box"><div>جاهز للتسليم</div><div class="stat-val">${readyCount}</div></div>
            <div class="stat-box"><div>تم تسليمها</div><div class="stat-val">${deliveredCount}</div></div>
            <div class="stat-box"><div>غير قابلة للإصلاح</div><div class="stat-val">${unrepairableCount}</div></div>
          </div>

          <h3 style="margin-top: 20px; border-right: 4px solid #0d9488; padding-right: 8px;">سجل تفاصيل أجهزة الزبون وبطاقات الصيانة</h3>
          <table>
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>نوع وموديل الجهاز</th>
                <th>الرقم التسلسلي S/N</th>
                <th>الحالة</th>
                <th>تاريخ الاستلام</th>
                <th>التشخيص والعطل</th>
                <th>التكلفة</th>
              </tr>
            </thead>
            <tbody>
              ${customerOrders.map(o => `
                <tr>
                  <td style="font-family: monospace; font-weight: bold;">${o.id}</td>
                  <td><strong>${o.deviceType}</strong> - ${o.brandModel}</td>
                  <td style="font-family: monospace;">${o.serialNumber || '-'}</td>
                  <td>${o.status}</td>
                  <td>${new Date(o.createdAt).toLocaleDateString('ar-SA')}</td>
                  <td>${o.faultDescription || '-'}</td>
                  <td style="font-weight: bold;">${o.actualCost !== undefined ? o.actualCost : o.estimatedCost} ${o.currency || currencyName}</td>
                </tr>
                ${o.photos && o.photos.length > 0 ? `
                <tr>
                  <td colspan="7" style="background: #f8fafc; padding: 8px;">
                    <strong style="font-size: 11px; color: #0f766e;">📸 صور توثيق الأعطال ومراحل الصيانة بالكاميرا (${o.photos.length} صور):</strong>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
                      ${o.photos.map(p => `
                        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px; background: white; text-align: center;">
                          <img src="${p.url}" style="width: 75px; height: 55px; object-fit: cover; border-radius: 4px; display: block;" />
                          <div style="font-size: 9px; color: #475569; margin-top: 2px; max-width: 75px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.stageLabel}</div>
                        </div>
                      `).join('')}
                    </div>
                  </td>
                </tr>
                ` : ''}
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 12px;">
            تم إصدار هذا التقرير آلياً عبر نظام إدارة الصيانة الذكي لمركز: ${centerName}
          </div>
        </body>
      </html>
    `;

    printHtmlViaIframe(reportHtml);
  };

  const handlePrintThermalLabel = (order: MaintenanceOrder) => {
    const mainCenterName = localStorage.getItem('centerName') || 'مركز تكنو للصيانة';
    const centerMobile = localStorage.getItem('centerMobile') || '05xxxxxxxx';
    const effectiveAppUrl = appUrl || getEffectiveAppUrl();

    const layoutConfig = getStoredLabelLayout();
    const effectiveLayout = {
      ...layoutConfig,
      paperSize: FIXED_LABEL_PAPER_SIZE
    };
    const containerStyles = getLabelContainerStyles(effectiveLayout);
    const widthLabel = `${containerStyles.widthMm}mm`;
    const heightLabel = `${containerStyles.heightMm}mm`;

    const activeElements = effectiveLayout.elements.filter(el => el.enabled);
    const barcodeEl = activeElements.find(el => el.id === 'barcode');
    const qrCodeEl = activeElements.find(el => el.id === 'qr_code');
    const splitMetrics = getSplitThermalLabelMetrics(effectiveLayout, containerStyles, activeElements);
    const {
      hasQrSide,
      isCompactHeight,
      isNarrowWidth,
      effectivePaddingMm,
      effectiveLineSpacing,
      effectiveInnerWidthMm,
      colGapMm,
      splitQrSizeMm,
      compactFontPt,
    } = splitMetrics;

    let barcodeSvgHtml = '';
    if (barcodeEl) {
      const barcodeMetrics = getLabelElementMetrics(barcodeEl, effectiveLayout);
      const preferredFormat = localStorage.getItem('lblBarcodeFormat') || 'AUTO';
      const orderQrContent = buildOrderCustomerQrPayload({
        order,
        customer: resolvedCustomer,
        customerOrders,
        currencyName,
        centerName: mainCenterName,
        centerMobile,
        appUrl: effectiveAppUrl,
        maxLength: 520,
      });
      barcodeSvgHtml = renderPrintableBarcodeSvg({
        code: order.id,
        qrContent: orderQrContent,
        preferredFormat,
        baseWidth: barcodeEl.width || 1.3,
        heightPx: barcodeMetrics.barcodeHeightPx,
        heightMm: barcodeMetrics.barcodeHeightMm,
        maxWidthMm: effectiveInnerWidthMm,
        targetQrMm: splitQrSizeMm,
        quietZonePx: 10,
        marginModules: 0,
      });
    }

    const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('ar-SA') : new Date().toLocaleDateString('ar-SA');
    const trackingUrl = buildTrackingUrl(order.id, effectiveAppUrl);

    const rightInfoElementsHtml = activeElements.map(el => {
      const m = getLabelElementMetrics(el, effectiveLayout);
      const fontPt = compactFontPt ?? Math.min(m.fontSizePt, isNarrowWidth ? 8 : 11);
      const mTopMm = isCompactHeight ? 0 : Math.min(m.marginTopMm, 0.4);
      const mBotMm = isCompactHeight ? 0.2 : Math.min(m.marginBottomMm, 0.5);
      const baseItemStyle = hasQrSide
        ? `writing-mode: vertical-rl !important; text-orientation: mixed !important; margin: 0 !important; padding: 0 !important; max-height: 100% !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; box-sizing: border-box !important; text-align: center !important; line-height: 1 !important;`
        : `margin-top: ${mTopMm}mm !important; margin-bottom: ${mBotMm}mm !important; padding: 0 !important; text-align: ${containerStyles.textAlign} !important; align-self: ${containerStyles.alignItems} !important; max-width: 100% !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; box-sizing: border-box !important; line-height: ${effectiveLineSpacing} !important;`;

      switch (el.id) {
        case 'center_name': {
          const centerFontPt = hasQrSide
            ? splitMetrics.getVerticalCenterNameFontPt(mainCenterName)
            : splitMetrics.getCenterNameFontPt(mainCenterName, fontPt);
          return `<div class="center-name" dir="auto" style="${baseItemStyle} font-size: ${centerFontPt}pt !important; font-weight: 900 !important; letter-spacing: ${hasQrSide ? '0px' : '-0.25px'} !important; line-height: 1 !important;">${mainCenterName}</div>`;
        }
        case 'center_mobile': {
          const cleanMob = String(centerMobile || '').trim();
          const mobileFontPt = hasQrSide
            ? splitMetrics.getVerticalMobileFontPt(cleanMob)
            : splitMetrics.getCenterMobileFontPt(cleanMob, fontPt);
          return `<div class="center-mobile" dir="ltr" style="${baseItemStyle} text-overflow: clip !important; font-family: system-ui, -apple-system, 'Cairo', sans-serif !important; font-variant-numeric: tabular-nums !important; font-size: ${mobileFontPt}pt !important; font-weight: ${hasQrSide ? 900 : (el.bold ? 700 : 600)} !important; letter-spacing: ${hasQrSide ? '0px' : '-0.1px'} !important; direction: ltr !important;">${cleanMob}</div>`;
        }
        case 'customer_name': {
          const txt = `العميل: ${order.customerName}`;
          const fPt = hasQrSide ? splitMetrics.getVerticalInfoFontPt(txt) : fontPt;
          return `<div class="customer-name" dir="auto" style="${baseItemStyle} font-size: ${fPt}pt !important; font-weight: ${el.bold ? 800 : 600} !important;">${txt}</div>`;
        }
        case 'device_model': {
          const txt = `الجهاز: ${order.brandModel}`;
          const fPt = hasQrSide ? splitMetrics.getVerticalInfoFontPt(txt) : fontPt;
          return `<div class="device-model" dir="auto" style="${baseItemStyle} font-size: ${fPt}pt !important; font-weight: ${el.bold ? 800 : 600} !important;">${txt}</div>`;
        }
        case 'order_date': {
          const txt = `التاريخ: ${orderDate}`;
          const fPt = hasQrSide ? splitMetrics.getVerticalInfoFontPt(txt) : fontPt;
          return `<div class="order-date" dir="auto" style="${baseItemStyle} font-size: ${fPt}pt !important; font-weight: ${el.bold ? 700 : 400} !important;">${txt}</div>`;
        }
        case 'barcode': {
          const codeFontPt = hasQrSide
            ? splitMetrics.getVerticalCodeFontPt(order.id)
            : splitMetrics.getCodeFontPt(order.id, fontPt);
          return `<div class="barcode-code-text" dir="ltr" style="${baseItemStyle} text-overflow: clip !important; font-size: ${codeFontPt}pt !important; font-family: system-ui, -apple-system, 'Cairo', sans-serif !important; font-variant-numeric: tabular-nums !important; font-weight: 900 !important; letter-spacing: ${hasQrSide ? '0px' : '-0.2px'} !important; direction: ltr !important; line-height: 1 !important;">${order.id}</div>`;
        }
        case 'custom_text': {
          const txt = el.customContent || 'يرجى إبراز هذا الملصق عند الاستلام';
          const fPt = hasQrSide ? splitMetrics.getVerticalInfoFontPt(txt) : fontPt;
          if (hasQrSide) {
            return `<div dir="auto" style="${baseItemStyle} font-size: ${fPt}pt !important; font-weight: ${el.bold ? 700 : 500} !important;">${txt}</div>`;
          }
          return `<div style="margin-top: ${mTopMm}mm !important; margin-bottom: ${mBotMm}mm !important; padding: 0 !important; text-align: ${containerStyles.textAlign} !important; align-self: ${containerStyles.alignItems} !important; max-width: 100% !important; white-space: normal !important; word-break: break-word !important; box-sizing: border-box !important; line-height: ${effectiveLineSpacing} !important; font-size: ${fontPt}pt !important; font-weight: ${el.bold ? 700 : 500} !important;">${txt}</div>`;
        }
        default:
          return '';
      }
    }).filter(Boolean).join('');

    const leftQrBlocks: string[] = [];
    if (barcodeSvgHtml) {
      leftQrBlocks.push(`<div class="barcode-qr-wrap" style="display: flex !important; align-items: center !important; justify-content: center !important; background: #ffffff !important;">${barcodeSvgHtml}</div>`);
    }
    if (qrCodeEl) {
      const m = getLabelElementMetrics(qrCodeEl, effectiveLayout);
      const inlineQrSvg = renderAlphanumericQrSvg({
        value: trackingUrl,
        mode: 'auto',
        physicalSizeMm: splitQrSizeMm || Math.max(m.qrSizeMm, 11),
        marginModules: 0,
        errorCorrectionLevel: 'M',
      });
      leftQrBlocks.push(`<div class="qr-container" style="display: flex !important; align-items: center !important; justify-content: center !important; background: #ffffff !important;">${inlineQrSvg}</div>`);
    }
    const leftQrHtml = leftQrBlocks.join('');

    const hasInfoHtml = Boolean(rightInfoElementsHtml.trim());
    const contentHtml = hasQrSide
      ? (hasInfoHtml
        ? `
      <div class="thermal-label-container thermal-label-split" dir="rtl">
        <div class="thermal-info-col">
          ${rightInfoElementsHtml}
        </div>
        <div class="thermal-qr-col">
          ${leftQrHtml}
        </div>
      </div>
    `
        : `
      <div class="thermal-label-container thermal-label-split" dir="rtl">
        <div class="thermal-qr-col">
          ${leftQrHtml}
        </div>
      </div>
    `)
      : `
      <div class="thermal-label-container" dir="rtl">
        ${rightInfoElementsHtml}
      </div>
    `;

    const labelStyle = `
      @page {
        size: ${widthLabel} ${heightLabel};
        margin: 0 !important;
      }
      * {
        box-sizing: border-box !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .thermal-label-container {
        width: ${widthLabel} !important;
        height: ${heightLabel} !important;
        max-width: ${widthLabel} !important;
        max-height: ${heightLabel} !important;
        box-sizing: border-box !important;
        padding: ${effectivePaddingMm}mm !important;
        margin: 0 auto !important;
        background: #ffffff !important;
        color: #000000 !important;
        display: flex !important;
        flex-direction: ${hasQrSide ? 'row' : 'column'} !important;
        justify-content: ${hasQrSide && hasInfoHtml ? 'space-between' : 'center'} !important;
        align-items: center !important;
        gap: ${hasQrSide && hasInfoHtml ? `${colGapMm}mm` : '0'} !important;
        font-family: ${containerStyles.fontFamilyCss} !important;
        overflow: hidden !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .thermal-info-col {
        flex: 1 1 0% !important;
        min-width: 0 !important;
        height: 100% !important;
        display: flex !important;
        flex-direction: ${hasQrSide ? 'row' : 'column'} !important;
        justify-content: center !important;
        align-items: ${hasQrSide ? 'center' : containerStyles.alignItems} !important;
        gap: ${hasQrSide ? `${splitMetrics.verticalColGapMm}mm` : '0'} !important;
        text-align: ${hasQrSide ? 'center' : containerStyles.textAlign} !important;
        overflow: hidden !important;
      }
      .thermal-qr-col {
        flex: 0 0 auto !important;
        height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 0.25mm !important;
        background: #ffffff !important;
      }
      .thermal-label-container svg {
        max-width: 100% !important;
        display: block !important;
      }
    `;

    const fullHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>ملصق صيانة - ${order.id}</title>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" />
          <style>
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100%;
              font-family: ${containerStyles.fontFamilyCss};
            }
            ${labelStyle}
          </style>
        </head>
        <body>
          ${contentHtml}
        </body>
      </html>
    `;

    // Dispatch synchronous print immediately inside click handler
    printPureContent(contentHtml, labelStyle);

    // Also open visual preview sheet so mobile/iframe preview users see instant confirmation and can re-print or download
    setPrintPreviewDoc({
      title: `ملصق الباركود الحراري (${widthLabel} × ${heightLabel})`,
      subtitle: `طلب ${order.id} · ${order.brandModel}`,
      filename: `label-${order.id}.html`,
      contentHtml,
      pageStyle: labelStyle,
      fullHtml,
      kind: 'label',
      previewMinHeightPx: 210,
    });
  };

  const handlePrintCustomerReceipt = (order: MaintenanceOrder) => {
    const mainCenterName = localStorage.getItem('centerName') || 'TECHNO';
    const centerMobile = localStorage.getItem('centerMobile') || '962790000000';
    const centerLogo = localStorage.getItem('centerLogo') || '';
    const engineerName = localStorage.getItem('engineerName') || 'م. محمد وليد';
    const countryName = localStorage.getItem('countryName') || 'الأردن';
    const countryDialCode = localStorage.getItem('countryDialCode') || '962';
    const rcptTermsText = localStorage.getItem('rcptTermsText') || `1. المحل غير مسؤول عن فقدان أو تلف البيانات المحفوظة في ذاكرة الجهاز. يرجى أخذ نسخة احتياطية.\n2. يحق للمحل التصرف في الجهاز وإلغاء مسؤوليته عنه في حال عدم استلامه بعد مرور 14 يوماً من تاريخ الإشعار بالجهوزية.\n3. لا يتم تسليم الجهاز إلا بإبراز هذا الإيصال أو إثبات الهوية الأصلي المسجل.`;
    const rcptSize = localStorage.getItem('rcptSize') || '80mm';
    const effectiveAppUrl = appUrl || getEffectiveAppUrl();

    const preferredFormat = localStorage.getItem('lblBarcodeFormat') || 'AUTO';
    const rcptMaxMm = rcptSize === '58mm' ? 50 : 72;
    const receiptOrderQrContent = buildOrderCustomerQrPayload({
      order,
      customer: resolvedCustomer,
      customerOrders,
      currencyName,
      centerName: mainCenterName,
      centerMobile,
      appUrl: effectiveAppUrl,
      maxLength: 550,
    });
    const barcodeSvgHtml = renderPrintableBarcodeSvg({
      code: order.id,
      qrContent: receiptOrderQrContent,
      preferredFormat,
      baseWidth: 1.5,
      heightMm: 10,
      maxWidthMm: rcptMaxMm,
      quietZonePx: 10,
    });

    const trackingQrSvg = renderAlphanumericQrSvg({
      value: buildTrackingUrl(order.id, effectiveAppUrl),
      mode: 'auto',
      sizePx: 64,
      marginModules: 2,
      errorCorrectionLevel: 'M',
    });
    const createdDateFormatted = order.createdAt ? new Date(order.createdAt).toLocaleDateString('ar-SA') : new Date().toLocaleDateString('ar-SA');
    const expectedDateFormatted = order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString('ar-SA') : 'غير محدد';
    const costDisplay = order.actualCost !== undefined ? order.actualCost : order.estimatedCost;

    const receiptWidth = rcptSize === '58mm' ? '58mm' : (rcptSize === 'A4' ? '210mm' : (rcptSize === 'A5' ? '148mm' : '80mm'));
    const pageSizeSpec = rcptSize === '58mm' ? '58mm auto' : (rcptSize === 'A4' ? 'A4 portrait' : (rcptSize === 'A5' ? 'A5 portrait' : '80mm auto'));

    const receiptStyle = `
      @page {
        size: ${pageSizeSpec};
        margin: 4mm !important;
      }
      * {
        box-sizing: border-box !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .receipt-sheet {
        font-family: 'Cairo', system-ui, -apple-system, sans-serif;
        margin: 0 auto;
        padding: 6px;
        width: 100%;
        max-width: ${receiptWidth};
        background: #ffffff;
        color: #111;
        direction: rtl;
        text-align: center;
        font-size: clamp(9.5px, 3.2vw, 11.5px);
        line-height: 1.4;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .header {
        border-bottom: 2px dashed #0f766e;
        padding-bottom: 8px;
        margin-bottom: 10px;
      }
      .logo { max-height: 50px; max-width: 100%; margin: 0 auto 4px auto; object-fit: contain; display: block; }
      .store-title { font-size: clamp(13px, 4.5vw, 16px); font-weight: 900; color: #0f766e; overflow-wrap: anywhere; }
      .store-sub { font-size: 10px; color: #4b5563; overflow-wrap: anywhere; }
      .badge-title {
        display: inline-block;
        width: fit-content;
        max-width: 100%;
        background: #f0fdfa;
        color: #0f766e;
        border: 1px solid #99f6e4;
        font-weight: 800;
        font-size: clamp(10px, 3.3vw, 12px);
        padding: 3px 10px;
        border-radius: 9999px;
        margin: 6px auto 0 auto;
      }
      .barcode-box { margin: 8px 0; max-width: 100%; overflow: hidden; }
      .qr-box-svg { width: 64px; height: 64px; max-width: 100%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #fff; }
      .info-list {
        width: 100%;
        margin: 8px 0;
        font-size: clamp(9.5px, 3.1vw, 11px);
        text-align: right;
      }
      .info-row {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 2px 8px;
        padding: 4px 2px;
        border-bottom: 1px dotted #e5e7eb;
      }
      .info-label {
        color: #6b7280;
        font-weight: 600;
        flex-shrink: 0;
      }
      .info-val {
        font-weight: 700;
        color: #111827;
        min-width: 0;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .cost-highlight {
        display: inline-block;
        width: fit-content;
        max-width: 100%;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        padding: 5px 12px;
        border-radius: 8px;
        font-size: clamp(11px, 3.5vw, 13px);
        font-weight: 900;
        color: #15803d;
        margin: 8px auto;
      }
      .qr-row {
        margin: 8px 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .terms-box {
        display: inline-block;
        width: 100%;
        max-width: 100%;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 6px 8px;
        font-size: 9pt;
        color: #4b5563;
        text-align: right;
        line-height: 1.4;
        margin: 10px auto 0 auto;
        overflow-wrap: anywhere;
      }
      .footer {
        margin-top: 10px;
        font-size: 9pt;
        color: #6b7280;
        border-top: 1px dashed #d1d5db;
        padding-top: 6px;
      }
    `;

    const contentHtml = `
      <div class="receipt-sheet" dir="rtl">
        <div class="header">
          ${centerLogo ? `<img src="${centerLogo}" class="logo" alt="logo" />` : ''}
          <div class="store-title">${mainCenterName}</div>
          <div class="store-sub">بإشراف: ${engineerName} • جوال: <span dir="ltr">${centerMobile}</span></div>
          <div class="store-sub">${countryName} (${countryDialCode}+)</div>
          <div class="badge-title">إيصال استلام جهاز للصيانة</div>
        </div>

        <div class="barcode-box" style="background: #ffffff; display: flex; flex-direction: column; align-items: center;">
          ${barcodeSvgHtml || ''}
          <div style="font-family: 'Courier New', Courier, monospace; font-size: 11pt; font-weight: 900; letter-spacing: 0.8px; margin-top: 1mm;" dir="ltr">${order.id}</div>
        </div>

        <div class="info-list">
          <div class="info-row">
            <span class="info-label">اسم الزبون:</span>
            <span class="info-val">${order.customerName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">رقم الهاتف:</span>
            <span class="info-val" dir="ltr">${order.customerPhone}</span>
          </div>
          <div class="info-row">
            <span class="info-label">الجهاز والموديل:</span>
            <span class="info-val">${order.deviceType} • ${order.brandModel}</span>
          </div>
          ${order.serialNumber ? `
          <div class="info-row">
            <span class="info-label">الرقم التسلسلي S/N:</span>
            <span class="info-val" style="font-family: monospace;" dir="ltr">${order.serialNumber}</span>
          </div>` : ''}
          <div class="info-row">
            <span class="info-label">العطل / المشكلة:</span>
            <span class="info-val">${order.faultDescription || 'فحص وصيانة عامة'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">تاريخ الاستلام:</span>
            <span class="info-val">${createdDateFormatted}</span>
          </div>
          <div class="info-row">
            <span class="info-label">موعد التسليم المتوقع:</span>
            <span class="info-val">${expectedDateFormatted}</span>
          </div>
          <div class="info-row">
            <span class="info-label">الفني المسؤول:</span>
            <span class="info-val">${order.technician || engineerName}</span>
          </div>
        </div>

        <div class="cost-highlight">
          التكلفة التقديرية: ${costDisplay} ${order.currency || currencyName}
        </div>

        <div class="qr-row">
          <div class="qr-box-svg">${trackingQrSvg}</div>
          <div style="font-size: 9px; color: #6b7280; text-align: right; max-width: 150px;">
            امسح رمز QR لمتابعة حالة الجهاز ومرحلة الصيانة مباشرة عبر الإنترنت
          </div>
        </div>

        <div class="terms-box">
          <strong>شروط وأحكام الصيانة المعتمدة:</strong><br/>
          ${rcptTermsText.split('\n').map(l => `<div>• ${l}</div>`).join('')}
        </div>

        <div class="footer">
          شكراً لثقتكم بنا • يرجى إبراز هذا الإيصال عند الاستلام
        </div>
      </div>
    `;

    const fullHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>إيصال استلام صيانة - ${order.id}</title>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" />
          <style>
            html, body { margin: 0; padding: 8px; background: #ffffff; }
            ${receiptStyle}
          </style>
        </head>
        <body>
          ${contentHtml}
        </body>
      </html>
    `;

    // Dispatch synchronous print immediately inside click handler
    printPureContent(contentHtml, receiptStyle);

    // Also open visual preview sheet so mobile/iframe preview users see instant confirmation and can re-print or download
    setPrintPreviewDoc({
      title: `إيصال استلام الصيانة (${rcptSize})`,
      subtitle: `طلب ${order.id} · ${order.customerName}`,
      filename: `receipt-${order.id}.html`,
      contentHtml,
      pageStyle: receiptStyle,
      fullHtml,
      kind: 'receipt',
      previewMinHeightPx: 430,
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center p-2 pt-1 sm:pt-2 overflow-y-auto bg-transparent animate-in fade-in duration-150 font-sans"
      dir="rtl"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-gray-200 overflow-hidden mb-4 animate-in slide-in-from-top-2 duration-150 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 p-5 sm:p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white font-extrabold text-xl shadow-inner border border-white/20 shrink-0">
                {displayName.charAt(0) || 'ع'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">
                    {displayName}
                  </h2>
                </div>
                
                <div className="flex items-center gap-3 mt-1 text-teal-100 text-xs font-mono flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-teal-200" />
                    <span dir="ltr">{displayPhone}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Contact & Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              {displayPhone && displayPhone !== 'غير مسجل' && (
                <>
                  <a
                    href={getWhatsAppLink(displayPhone, `مرحباً أستاذ ${displayName}، نتواصل معك من مركز ${centerName}.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>واتساب</span>
                  </a>

                  <a
                    href={`tel:${displayPhone}`}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-white/15 transition-all"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>اتصال</span>
                  </a>
                </>
              )}

              {onOpenNewOrderForCustomer && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenNewOrderForCustomer(displayName, displayPhone);
                    onClose();
                  }}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="استلام جهاز جديد لهذا العميل"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>طلب صيانة جديد</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Device Status & Repair Stage Updater + Relocated Customer Alphanumeric QR */}
        <div className="bg-gradient-to-b from-teal-50/70 to-white border-b border-teal-100 p-3.5 sm:px-6 space-y-2.5">
          {statusUpdateSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-between animate-in fade-in">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{statusUpdateSuccess}</span>
              </span>
              <button
                type="button"
                onClick={() => setStatusUpdateSuccess(null)}
                className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {customerOrders.length === 0 && (
            <div className="py-1 text-center w-full text-xs text-gray-500 font-medium">
              لا توجد أجهزة مسجلة لهذا العميل حالياً.
            </div>
          )}

          {customerOrders.length > 0 && (
            <>

              {/* Quick Print Action Buttons: زر ملصق وزر إيصال مكان الخط البرتقالي */}
              {currentDevice && (
                <div className="flex items-center gap-2.5 pt-1 pb-1">
                  <button
                    type="button"
                    onClick={() => handlePrintThermalLabel(currentDevice)}
                    className="flex-1 py-2.5 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-sans font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 active:scale-95 duration-100 cursor-pointer"
                    title="طباعة ملصق الباركود الحراري للجهاز"
                  >
                    <Printer className="w-4 h-4" />
                    <span>ملصق</span>
                    <span className="text-[10px] font-mono opacity-80 font-normal">({currentDevice.id})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintCustomerReceipt(currentDevice)}
                    className="flex-1 py-2.5 px-3 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-sans font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 active:scale-95 duration-100 cursor-pointer"
                    title="طباعة إيصال استلام الصيانة للجهاز"
                  >
                    <FileText className="w-4 h-4" />
                    <span>إيصال</span>
                    <span className="text-[10px] font-mono opacity-80 font-normal">({currentDevice.id})</span>
                  </button>
                </div>
              )}

              {/* Multi-device selector tabs if customer has 2 or more devices */}
              {customerOrders.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                  <span className="text-[10px] text-gray-400 font-bold shrink-0">اختر الجهاز المراد تحديثه:</span>
                  {customerOrders.map(ord => {
                    const isSelected = currentDevice?.id === ord.id;
                    return (
                      <button
                        key={ord.id}
                        type="button"
                        onClick={() => setSelectedDeviceId(ord.id)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all shrink-0 flex items-center gap-1.5 border cursor-pointer ${
                          isSelected
                            ? 'bg-teal-700 text-white border-teal-800 shadow-xs ring-1 ring-teal-500'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <Smartphone className="w-3 h-3" />
                        <span>{ord.brandModel}</span>
                        <span className="text-[9px] font-mono opacity-80">({ord.id})</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* The 7 Status Change Buttons */}
              {currentDevice && (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 pt-1">
                  {Object.values(DeviceStatus).map((status) => {
                    const isCurrent = currentDevice.status === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleStatusChange(status)}
                        disabled={isCurrent}
                        className={`py-2 px-1 text-[10px] sm:text-xs font-sans font-bold rounded-xl border transition-all text-center flex items-center justify-center gap-1 ${
                          isCurrent
                            ? 'bg-teal-600 text-white border-teal-700 shadow-sm ring-2 ring-teal-200 cursor-default'
                            : 'bg-white hover:bg-teal-50 text-gray-800 border-gray-200/90 hover:border-teal-300 active:scale-95 duration-100 cursor-pointer'
                        }`}
                      >
                        {status === DeviceStatus.RECEIVED && 'تم الاستلام'}
                        {status === DeviceStatus.DIAGNOSING && 'تحت الفحص'}
                        {status === DeviceStatus.REPAIRING && 'تحت الإصلاح'}
                        {status === DeviceStatus.PENDING && 'قيد الانتظار ⏳'}
                        {status === DeviceStatus.READY && 'جاهز للتسليم 🎉'}
                        {status === DeviceStatus.DELIVERED && 'تسليم العميل ✅'}
                        {status === DeviceStatus.UNREPAIRABLE && 'تعذر الإصلاح'}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Statistical Summary Ribbon */}
        <div className="bg-teal-50/60 border-b border-teal-100/70 p-3 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          <div className="p-2.5 bg-white rounded-2xl border border-teal-100/60 shadow-2xs">
            <span className="text-[10px] text-gray-500 font-bold block">إجمالي الأجهزة</span>
            <span className="text-base font-extrabold text-teal-800 font-mono mt-0.5 block">{totalOrdersCount}</span>
          </div>

          <div className="p-2.5 bg-white rounded-2xl border border-teal-100/60 shadow-2xs">
            <span className="text-[10px] text-gray-500 font-bold block">أجهزة قيد الصيانة</span>
            <span className="text-base font-extrabold text-amber-600 font-mono mt-0.5 block">{inMaintenanceCount}</span>
          </div>

          <div className="p-2.5 bg-white rounded-2xl border border-teal-100/60 shadow-2xs">
            <span className="text-[10px] text-gray-500 font-bold block">تم تسليمها بنجاح</span>
            <span className="text-base font-extrabold text-emerald-600 font-mono mt-0.5 block">{deliveredCount}</span>
          </div>

          <div className="p-2.5 bg-white rounded-2xl border border-teal-100/60 shadow-2xs">
            <span className="text-[10px] text-gray-500 font-bold block">إجمالي المبالغ</span>
            <span className="text-base font-extrabold text-teal-900 font-mono mt-0.5 block">
              {totalCostSum} <small className="text-[10px] font-sans font-bold">{currencyName}</small>
            </span>
          </div>
        </div>

        {/* Modal Tabs Navigation */}
        <div className="flex border-b border-gray-200 px-4 sm:px-6 bg-gray-50/80 gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className={`py-2.5 px-4 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'devices'
                ? 'bg-white text-teal-800 border-t-2 border-teal-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Smartphone className="w-4 h-4 text-teal-600" />
            <span>سجل الأجهزة وبطاقات الصيانة ({customerOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`py-2.5 px-4 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'messages'
                ? 'bg-white text-teal-800 border-t-2 border-teal-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <span>الرسائل والإشعارات المرسلة ({customerLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={handlePrintCustomerReport}
            className="mr-auto my-auto px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl border border-teal-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="طباعة تقرير الصيانة الشامل للعميل"
          >
            <Printer className="w-3.5 h-3.5 text-teal-700" />
            <span>طباعة التقرير الشامل</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 max-h-[480px] overflow-y-auto space-y-4">
          
          {/* TAB 1: Devices and Maintenance Reports */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              {customerOrders.length === 0 ? (
                <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Smartphone className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="font-bold text-gray-600 text-sm">لا توجد بطاقات صيانة مسجلة لهذا الزبون حالياً.</p>
                  <p className="text-xs text-gray-400 mt-1">يمكنك الضغط على زر &ldquo;طلب صيانة جديد&rdquo; بالأعلى لفتح بطاقة صيانة فحص جديدة.</p>
                </div>
              ) : (
                customerOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 hover:border-teal-300 transition-all shadow-xs space-y-3.5"
                  >
                    {/* Device Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs font-black text-teal-800 bg-teal-50 border border-teal-200/70 px-2.5 py-1 rounded-lg">
                          {order.id}
                        </span>
                        <h4 className="font-extrabold text-gray-900 text-sm">
                          {order.deviceType} • {order.brandModel}
                        </h4>
                        {getStatusBadge(order.status)}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(order.createdAt).toLocaleDateString('ar-SA')}</span>
                      </div>
                    </div>

                    {/* Detailed Specifications Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                      {order.serialNumber && (
                        <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="text-gray-400 text-[10px] block font-bold">الرقم التسلسلي (S/N):</span>
                          <span className="font-mono font-bold text-gray-800 mt-0.5 block truncate">{order.serialNumber}</span>
                        </div>
                      )}

                      <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-gray-400 text-[10px] block font-bold">التكلفة والرسوم:</span>
                        <span className="font-mono font-extrabold text-teal-800 mt-0.5 block">
                          {getOrderFinancials(order, currencyName).totalCost} {order.currency || currencyName}
                        </span>
                        {(order.extraCost || 0) > 0 && (
                          <span className="text-[10px] text-amber-800 font-bold block mt-0.5">
                            + كلفة إضافية: {order.extraCost} {order.currency || currencyName}
                            {order.extraCostReason ? ` (${order.extraCostReason})` : ''}
                          </span>
                        )}
                      </div>

                      {order.waitingPartsDetails && (
                        <div className="p-2.5 bg-sky-50 rounded-xl border border-sky-200">
                          <span className="text-sky-700 text-[10px] block font-bold">انتظار القطع:</span>
                          <span className="font-bold text-sky-900 mt-0.5 block text-[11px]">
                            {order.waitingPartsDetails}
                            {order.waitingPartsExpectedDate ? ` (${order.waitingPartsExpectedDate})` : ''}
                          </span>
                        </div>
                      )}

                      {order.expectedDeliveryDate && (
                        <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="text-gray-400 text-[10px] block font-bold">موعد التسليم المتوقع:</span>
                          <span className="font-mono font-bold text-gray-800 mt-0.5 block">{order.expectedDeliveryDate}</span>
                        </div>
                      )}

                      {order.technician && (
                        <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="text-gray-400 text-[10px] block font-bold">الفني المسؤول:</span>
                          <span className="font-bold text-gray-800 mt-0.5 block">{order.technician}</span>
                        </div>
                      )}
                    </div>

                    {/* Fault Description & Diagnosis */}
                    <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl text-xs space-y-1">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-amber-700" />
                        <span>وصف العطل والتشخيص الفني:</span>
                      </div>
                      <p className="text-gray-700 leading-relaxed font-sans pr-5">
                        {order.faultDescription || 'لم يتم تسجيل وصف للعطل'}
                      </p>
                    </div>

                    {/* Status Update Note if present */}
                    {order.statusUpdateText && (
                      <div className="p-3 bg-teal-50/60 border border-teal-100 rounded-xl text-xs space-y-1">
                        <div className="font-bold text-teal-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                          <span>آخر تحديث لحالة الجهاز:</span>
                        </div>
                        <p className="text-gray-700 leading-relaxed font-sans pr-5">
                          {order.statusUpdateText}
                        </p>
                      </div>
                    )}

                    {/* Maintenance Stages History (Timeline) */}
                    {order.statusHistory && order.statusHistory.length > 0 && (
                      <div className="space-y-1.5 border-t border-gray-100 pt-3">
                        <span className="text-[10px] font-extrabold text-gray-500 flex items-center gap-1">
                          <History className="w-3.5 h-3.5 text-teal-600" />
                          <span>سجل مراحل وتاريخ الصيانة ({order.statusHistory.length} تحديثات):</span>
                        </span>
                        
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {order.statusHistory.map((step, sIdx) => (
                            <div key={sIdx} className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-100 text-[11px] space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="font-bold text-gray-800 ml-1.5">{getStatusArabicLabel(step.status)}:</span>
                                  <span className="text-gray-600">{step.note}</span>
                                </div>
                                <span className="text-[9px] text-gray-400 font-mono shrink-0">
                                  {new Date(step.timestamp).toLocaleDateString('ar-SA')}
                                </span>
                              </div>
                              <StatusSnapshotBadges snapshot={step.snapshot} compact />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Documented Photos Gallery for this device */}
                    {order.photos && order.photos.length > 0 && (
                      <div className="space-y-2 border-t border-gray-100 pt-3">
                        <span className="text-[10px] font-extrabold text-gray-700 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-teal-600" />
                          <span>صور توثيق الأعطال ومراحل الصيانة بالكاميرا ({order.photos.length} صور):</span>
                        </span>
                        
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {order.photos.map((photo) => (
                            <div 
                              key={photo.id}
                              onClick={() => setSelectedGalleryPhoto(photo)}
                              className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-black shadow-2xs cursor-pointer hover:shadow-md transition-all"
                              title="اضغط لتكبير ومعاينة الصورة"
                            >
                              <img src={photo.url} alt={photo.stageLabel} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              <span className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs text-white text-[8px] font-bold py-0.5 px-1 truncate text-center">
                                {photo.stageLabel}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: Sent Messages & Notification Logs */}
          {activeTab === 'messages' && (
            <div className="space-y-3">
              {customerLogs.length === 0 ? (
                <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <MessageSquare className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="font-bold text-gray-600 text-sm">لا توجد رسائل أو إشعارات مسجلة لهذا الزبون حتى الآن.</p>
                  <p className="text-xs text-gray-400 mt-1">يتم أرشفة أي رسالة واتساب أو SMS تلقائياً هنا عند إرسالها للعميل.</p>
                </div>
              ) : (
                customerLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 bg-white rounded-2xl border border-gray-200/80 hover:border-emerald-200 transition-all shadow-2xs space-y-2 text-right"
                  >
                    <div className="flex justify-between items-center gap-2 flex-wrap border-b border-gray-50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          log.type === 'whatsapp'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                        }`}>
                          {log.type === 'whatsapp' ? 'واتساب' : 'SMS'}
                        </span>

                        {log.orderId && (
                          <span className="font-mono text-[10px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                            {log.orderId}
                          </span>
                        )}

                        <span className="text-xs font-bold text-gray-800">
                          {log.triggerEvent || 'إشعار صيانة'}
                        </span>
                      </div>

                      <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(log.timestamp).toLocaleString('ar-SA')}</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-gray-50/70 rounded-xl text-xs text-gray-700 leading-relaxed font-sans whitespace-pre-wrap">
                      {log.content}
                    </div>
                    <StatusSnapshotBadges snapshot={log.variablesSnapshot} compact hideMessagePreview />
                  </div>
                ))
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200/80 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-gray-500 font-sans">
            مركز الصيانة: <strong>{centerName}</strong> • {customerOrders.length} طلب صيانة مسجل
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePrintCustomerReport}
              className="flex-1 sm:flex-none px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة تقرير الزبون</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>

      {/* Photo Lightbox Popup */}
      {selectedGalleryPhoto && (
        <div 
          className="fixed inset-0 z-60 flex items-start justify-center p-2 pt-1 sm:pt-2 overflow-y-auto bg-transparent animate-in fade-in duration-150 font-sans"
          dir="rtl"
          onClick={() => setSelectedGalleryPhoto(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden mb-4 animate-in slide-in-from-top-2 duration-150 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-teal-700 to-emerald-800 p-4 text-white flex justify-between items-center">
              <div>
                <h4 className="font-extrabold text-sm">{selectedGalleryPhoto.stageLabel}</h4>
                <p className="text-[10px] text-teal-100 font-mono mt-0.5">
                  {new Date(selectedGalleryPhoto.timestamp).toLocaleString('ar-SA')}
                  {selectedGalleryPhoto.takenBy ? ` • الفني: ${selectedGalleryPhoto.takenBy}` : ''}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedGalleryPhoto(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-black flex items-center justify-center max-h-[60vh] overflow-hidden">
              <img 
                src={selectedGalleryPhoto.url} 
                alt={selectedGalleryPhoto.stageLabel} 
                className="max-h-[60vh] w-auto object-contain mx-auto"
              />
            </div>

            {selectedGalleryPhoto.note && (
              <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-800">
                <span className="font-bold text-gray-500 block text-[10px] mb-0.5">ملاحظة التوثيق:</span>
                {selectedGalleryPhoto.note}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pre-Notification Modal for status updates and sending WhatsApp/SMS */}
      {preNotificationTarget && templates && (
        <PreNotificationModal
          isOpen={true}
          order={preNotificationTarget.order}
          targetStatus={preNotificationTarget.targetStatus}
          templates={templates}
          appUrl={appUrl || getEffectiveAppUrl()}
          currencyName={currencyName}
          currentUser={currentUser}
          onClose={() => setPreNotificationTarget(null)}
          onConfirmAndSend={(updatedOrder, finalMessage, channel, shouldDispatch) => {
            if (onSaveOrder) {
              onSaveOrder(updatedOrder);
            }
            setPreNotificationTarget(null);
            setStatusUpdateSuccess(`✓ تم تحديث مرحلة الجهاز إلى: ${updatedOrder.status}`);
            setTimeout(() => setStatusUpdateSuccess(null), 4000);

            if (shouldDispatch) {
              if (channel === 'whatsapp') {
                openWhatsAppDirectly(updatedOrder.customerPhone, finalMessage);
              } else if (channel === 'sms') {
                const cleanPhone = (updatedOrder.customerPhone || '').replace(/[\s()-]/g, '');
                if (cleanPhone) {
                  window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(finalMessage)}`;
                }
              }

              if (onLogNotification) {
                const latestSnapshot = updatedOrder.statusHistory?.[updatedOrder.statusHistory.length - 1]?.snapshot;
                onLogNotification(
                  updatedOrder.id,
                  updatedOrder.customerName,
                  updatedOrder.customerPhone,
                  channel,
                  finalMessage,
                  `تحديث الحالة: ${getStatusArabicLabel(updatedOrder.status)}`,
                  latestSnapshot
                );
              }
            }
          }}
        />
      )}

      {/* Quick Print Preview & Download Modal */}
      {printPreviewDoc && (
        <div
          className="fixed inset-0 z-70 flex items-start justify-center p-2 pt-3 sm:pt-6 overflow-y-auto bg-black/50 backdrop-blur-xs animate-in fade-in duration-150 font-sans"
          dir="rtl"
          onClick={() => setPrintPreviewDoc(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden mb-4 animate-in slide-in-from-top-2 duration-150 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-teal-700 to-emerald-800 p-4 text-white flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm truncate">{printPreviewDoc.title}</h3>
                <p className="text-[11px] text-teal-100 font-mono truncate mt-0.5" dir="ltr">
                  {printPreviewDoc.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrintPreviewDoc(null)}
                className="p-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl transition-colors cursor-pointer shrink-0"
                title="إغلاق المعاينة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isEmbeddedIframe() && (
              <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-[11px] text-amber-900 font-bold leading-relaxed">
                تم تجهيز {printPreviewDoc.kind === 'receipt' ? 'الإيصال' : 'الملصق'} وإرسال أمر الطباعة. إذا حظر متصفح المعاينة المدمج فتح الطابعة تلقائياً، استخدم زر <span className="underline">تنزيل نسخة للطباعة</span> أو افتح التطبيق في متصفح مستقل.
              </div>
            )}

            <div className="p-4 bg-slate-100 flex items-center justify-center">
              <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-inner overflow-hidden">
                <iframe
                  title={printPreviewDoc.title}
                  srcDoc={printPreviewDoc.fullHtml}
                  className="w-full border-0 bg-white"
                  style={{ height: `${printPreviewDoc.previewMinHeightPx}px` }}
                />
              </div>
            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => printPureContent(printPreviewDoc.contentHtml, printPreviewDoc.pageStyle)}
                className="flex-1 min-w-[130px] py-2.5 px-3 bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الآن</span>
              </button>
              <button
                type="button"
                onClick={() => downloadPrintableHtml(printPreviewDoc.filename, printPreviewDoc.fullHtml)}
                className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="حفظ الملف لطباعته من المتصفح أو تطبيق الطباعة"
              >
                <Download className="w-4 h-4" />
                <span>تنزيل HTML</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintPreviewDoc(null)}
                className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};
export default CustomerProfileModal;
