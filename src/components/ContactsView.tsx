import React, { useState, useMemo, useEffect } from 'react';
import {
  MaintenanceOrder,
  DeviceStatus,
  AppUser,
  isContactOrder,
  CustomerProfile,
} from '../types';
import {
  Search,
  User,
  Phone,
  MessageSquare,
  PhoneCall,
  Plus,
  Trash2,
  X,
  AlertTriangle,
  QrCode,
  Printer,
  Copy,
  Check,
  Camera,
  RefreshCw,
} from 'lucide-react';
import { openWhatsAppDirectly } from '../lib/notifications';
import { QRCodeGenerator } from './QRCodeGenerator';
import { renderAlphanumericQrSvg } from '../utils/qrAlphanumeric';
import { printHtmlViaIframe } from '../lib/printUtils';
import {
  buildCustomerId,
  buildCustomerQrPayload,
  generateUniqueCustomerBarcode,
  normalizeCustomerNameKey,
  phonesMatch,
  sanitizeCustomCustomerBarcode,
} from '../utils/customerBarcode';

interface ContactsViewProps {
  customers?: CustomerProfile[];
  orders: MaintenanceOrder[];
  onSaveOrder?: (order: MaintenanceOrder) => Promise<void>;
  onDeleteOrder?: (id: string) => Promise<void>;
  onSaveCustomer?: (customer: CustomerProfile) => Promise<void>;
  onDeleteCustomer?: (customerId: string) => Promise<void>;
  onScanClick?: () => void;
  initialSearchTerm?: string;
  onClearInitialSearch?: () => void;
  currentUser: AppUser | null;
  onClearNames?: (clearAll: boolean) => void;
  onViewCustomer?: (name: string, phone?: string, customer?: CustomerProfile) => void;
}

interface MergedCustomerItem {
  id: string;
  profile: CustomerProfile | null;
  name: string;
  phone: string;
  customerBarcode: string;
  notes?: string;
  totalDevices: number;
  latestOrderDate: number;
  orders: MaintenanceOrder[];
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  customers = [],
  orders,
  onSaveOrder,
  onDeleteOrder,
  onSaveCustomer,
  onDeleteCustomer,
  onScanClick,
  initialSearchTerm,
  onClearInitialSearch,
  currentUser,
  onClearNames,
  onViewCustomer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
      if (onClearInitialSearch) {
        onClearInitialSearch();
      }
    }
  }, [initialSearchTerm, onClearInitialSearch]);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [addError, setAddError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  useEffect(() => {
    if (showAddModal) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      setNewBarcode(generateUniqueCustomerBarcode(usedBarcodesSet));
      setAddError('');
    }
  }, [showAddModal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build unified list combining CustomerProfile records and all associated MaintenanceOrders
  const mergedCustomers = useMemo(() => {
    const itemsMap = new Map<string, MergedCustomerItem>();
    const profileById = new Map<string, CustomerProfile>();
    const profileByBarcode = new Map<string, CustomerProfile>();

    customers.forEach((c) => {
      profileById.set(c.id, c);
      if (c.customerBarcode) {
        profileByBarcode.set(c.customerBarcode.toUpperCase(), c);
      }
      itemsMap.set(c.id, {
        id: c.id,
        profile: c,
        name: c.name,
        phone: c.phone,
        customerBarcode: c.customerBarcode,
        notes: c.notes,
        totalDevices: 0,
        latestOrderDate: c.updatedAt || c.createdAt || 0,
        orders: [],
      });
    });

    orders.forEach((order) => {
      let targetKey = '';
      if (order.customerId && itemsMap.has(order.customerId)) {
        targetKey = order.customerId;
      } else if (
        order.customerBarcode &&
        profileByBarcode.has(order.customerBarcode.toUpperCase())
      ) {
        targetKey = profileByBarcode.get(order.customerBarcode.toUpperCase())!.id;
      } else {
        const foundProfile = customers.find(
          (c) =>
            (c.phone && phonesMatch(c.phone, order.customerPhone)) ||
            (!c.phone &&
              normalizeCustomerNameKey(c.name) === normalizeCustomerNameKey(order.customerName))
        );
        if (foundProfile) {
          targetKey = foundProfile.id;
        }
      }

      if (!targetKey) {
        targetKey = (order.customerPhone || '').trim() || (order.customerName || '').trim();
        if (!targetKey) return;
        if (!itemsMap.has(targetKey)) {
          itemsMap.set(targetKey, {
            id: targetKey,
            profile: null,
            name: order.customerName || 'بدون اسم',
            phone: order.customerPhone || '',
            customerBarcode: order.customerBarcode || '',
            totalDevices: 0,
            latestOrderDate: order.createdAt || 0,
            orders: [],
          });
        }
      }

      const item = itemsMap.get(targetKey)!;
      if (!isContactOrder(order)) {
        item.totalDevices += 1;
      }
      item.orders.push(order);

      if ((order.createdAt || 0) > item.latestOrderDate) {
        item.latestOrderDate = order.createdAt;
      }
    });

    const q = searchTerm.trim().toLowerCase();
    return Array.from(itemsMap.values())
      .filter((c) => {
        if (!q) return true;
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q) ||
          c.orders.some((o) => (o.id || '').toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.latestOrderDate - a.latestOrderDate);
  }, [customers, orders, searchTerm]);

  const handleCopyBarcode = async (id: string, code: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore
    }
  };

  const handlePrintCustomerCard = (cust: MergedCustomerItem) => {
    const latestOrderId = cust.orders.find((o) => !isContactOrder(o))?.id || '';
    const centerName = localStorage.getItem('centerName') || 'مركز الصيانة الذكي';
    const centerMobile = localStorage.getItem('centerMobile') || '';
    const compactPayload = buildCustomerQrPayload({
      customer: cust.profile,
      name: cust.name,
      phone: cust.phone,
      customerBarcode: cust.customerBarcode,
      notes: cust.notes,
      orders: cust.orders,
      centerName,
      maxLength: 280,
    });
    const qrSvgHtml = renderAlphanumericQrSvg({
      value: compactPayload || latestOrderId || cust.phone || cust.name,
      mode: 'auto',
      physicalSizeMm: 14.5,
      marginModules: 1,
      errorCorrectionLevel: 'L',
    });

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>بطاقة QR الزبون - ${cust.name}</title>
          <style>
            @page { size: 38mm 25mm; margin: 0 !important; }
            * { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            html, body {
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
          </style>
        </head>
        <body>
          <div class="card">
            <div class="meta">
              <div class="center">${centerName}${centerMobile ? ` · ${centerMobile}` : ''}</div>
              <div class="cust">${cust.name}</div>
              ${cust.phone ? `<div class="phone">${cust.phone}</div>` : ''}
              <div class="tag">QR معلومات الزبون</div>
              ${latestOrderId ? `<div class="code">${latestOrderId}</div>` : ''}
            </div>
            <div class="qr-box">
              ${qrSvgHtml}
            </div>
          </div>
        </body>
      </html>
    `;
    printHtmlViaIframe(html);
  };

  const openWhatsApp = (phone: string) => {
    openWhatsAppDirectly(phone, 'مرحباً، شكراً لتعاملك مع مركز الصيانة.');
  };

  const handleAddCustomer = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      setAddError('يرجى إدخال اسم العميل ورقم الهاتف');
      return;
    }

    const sanitizedBarcode =
      sanitizeCustomCustomerBarcode(newBarcode) || generateUniqueCustomerBarcode(usedBarcodesSet);

    try {
      const existingIds = new Set(customers.map((c) => c.id));
      const newProfile: CustomerProfile = {
        id: buildCustomerId(newName.trim(), newPhone.trim(), existingIds),
        name: newName.trim(),
        phone: newPhone.trim(),
        customerBarcode: sanitizedBarcode,
        notes: newNotes.trim() || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (onSaveCustomer) {
        await onSaveCustomer(newProfile);
      } else if (onSaveOrder) {
        const newContactOrder: any = {
          id: `contact-${Date.now()}`,
          customerId: newProfile.id,
          customerBarcode: sanitizedBarcode,
          customerName: newProfile.name,
          customerPhone: newProfile.phone,
          deviceType: 'جهة اتصال',
          brandModel: 'مضاف يدوياً',
          faultDescription: 'جهة اتصال مضافة يدوياً',
          estimatedCost: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: DeviceStatus.DELIVERED,
          notes: newNotes.trim(),
          serialNumber: '',
          technician: '',
          statusHistory: [],
        };
        await onSaveOrder(newContactOrder);
      }

      setShowAddModal(false);
      setNewName('');
      setNewPhone('');
      setNewNotes('');
      setAddError('');
    } catch {
      setAddError('حدث خطأ أثناء إضافة العميل');
    }
  };

  const handleDeleteCustomerClick = async (cust: MergedCustomerItem) => {
    const confirmDelete = window.confirm(
      `هل أنت متأكد من مسح العميل ${cust.name} (${cust.phone || 'بدون هاتف'}) وكافة السجلات التابعة له نهائياً؟`
    );
    if (!confirmDelete) return;

    try {
      if (cust.profile && onDeleteCustomer) {
        await onDeleteCustomer(cust.profile.id);
      }
      if (onDeleteOrder) {
        for (const order of cust.orders) {
          await onDeleteOrder(order.id);
        }
      }
    } catch {
      alert('حدث خطأ أثناء مسح بيانات العميل');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-center gap-4 justify-between bg-white p-5 rounded-3xl border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100/50">
            <User className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-sans font-extrabold text-gray-900 flex items-center gap-2">
              <span>سجل الزبائن ورموز QR الشخصية</span>
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-lg font-bold font-mono tabular-nums">
                {mergedCustomers.length} زبون
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              إدارة سجل الزبائن ورموز QR الخاصة ببياناتهم وطلبات الصيانة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="ابحث بالاسم، الهاتف، أو رقم الطلب..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 pr-10 pl-10 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            <Search className="absolute right-3.5 top-2.5 text-gray-400 w-4 h-4" />
            {onScanClick && (
              <button
                type="button"
                onClick={onScanClick}
                className="absolute left-1.5 top-1.5 bg-gray-900 hover:bg-black text-white p-1.5 rounded-lg transition-colors cursor-pointer"
                title="مسح QR الزبون بالكاميرا أو USB لاستدعاء ملفه"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {onScanClick && (
            <button
              type="button"
              onClick={onScanClick}
              className="bg-gray-900 hover:bg-black text-white px-3 py-2.5 rounded-xl transition-colors shrink-0 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
              title="استدعاء ملف الزبون بمسح رمز QR"
            >
              <QrCode className="w-4 h-4 text-teal-400" />
              <span className="hidden lg:inline">استدعاء بـ QR</span>
            </button>
          )}

          {(!currentUser || currentUser.permissions.add_orders) && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2.5 rounded-xl transition-colors shrink-0 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
              title="إضافة زبون جديد وتوليد QR خاص به"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">إضافة زبون</span>
            </button>
          )}

          {onClearNames && (!currentUser || currentUser.permissions.delete_orders) && (
            <button
              type="button"
              onClick={() => {
                const wantsToClearAll = window.confirm(
                  'هل تريد مسح كافة العملاء بما في ذلك طلبات الصيانة نهائياً من النظام؟\n\n- اضغط "موافق" (OK) لمسح الجميع (تفريغ كامل).\n- اضغط "إلغاء" (Cancel) لمسح جهات الاتصال المستوردة فقط.'
                );

                if (wantsToClearAll) {
                  if (
                    window.confirm(
                      'تحذير نهائي: سيتم مسح كافة العملاء وطلبات الصيانة بشكل لا يمكن التراجع عنه. هل أنت متأكد؟'
                    )
                  ) {
                    onClearNames(true);
                  }
                } else {
                  if (window.confirm('هل أنت متأكد من مسح جهات الاتصال المستوردة فقط؟')) {
                    onClearNames(false);
                  }
                }
              }}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center gap-1 cursor-pointer"
              title="تفريغ كل جهات الاتصال"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[10px] font-sans font-bold hidden sm:inline">مسح الكل</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of customers */}
      {mergedCustomers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-16 text-center text-gray-400">
          <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-sans text-sm font-bold text-gray-700">لا يوجد زبائن مطابقين للبحث</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mergedCustomers.map((cust) => (
            <div
              key={cust.id}
              className="bg-white p-4 rounded-3xl border border-gray-100 hover:border-indigo-200 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      onClick={() => onViewCustomer?.(cust.name, cust.phone, cust.profile || undefined)}
                      className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-300 transition-all"
                      title="فتح سجل وتقرير الزبون"
                    >
                      {cust.name.substring(0, 1) || 'ع'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          onClick={() => onViewCustomer?.(cust.name, cust.phone, cust.profile || undefined)}
                          className="font-sans font-bold text-gray-900 hover:text-indigo-600 hover:underline cursor-pointer text-sm leading-tight transition-colors truncate"
                          title="فتح سجل الزبون وتقرير الصيانة والرسائل"
                        >
                          {cust.name || 'بدون اسم'}
                        </h3>
                        <span className="text-[10px] font-bold font-mono tabular-nums text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                          {cust.totalDevices} أجهزة
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-500 text-xs mt-1 font-mono tabular-nums">
                        <Phone className="w-3 h-3" />
                        <span dir="ltr">{cust.phone || 'غير مسجل'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomerClick(cust)}
                    className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                    title="حذف العميل وكافة سجلاته"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Customer Full Info QR Box (Order Number based) */}
                {(() => {
                  const latestOrderId = cust.orders.find((o) => !isContactOrder(o))?.id || '';
                  const copyVal = latestOrderId || cust.phone;
                  return (
                    <div className="mt-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => onViewCustomer?.(cust.name, cust.phone, cust.profile || undefined)}
                          className="p-1 bg-white rounded-xl border border-slate-200 hover:border-teal-400 transition-colors shrink-0 cursor-pointer"
                          title="اضغط لفتح الملف الشخصي للزبون"
                        >
                          <QRCodeGenerator
                            value={
                              buildCustomerQrPayload({
                                customer: cust.profile,
                                name: cust.name,
                                phone: cust.phone,
                                customerBarcode: cust.customerBarcode,
                                notes: cust.notes,
                                orders: cust.orders,
                                maxLength: 550,
                              }) || latestOrderId || cust.phone || cust.name
                            }
                            mode="auto"
                            compact
                            size={58}
                            marginModules={1}
                            errorCorrectionLevel="L"
                          />
                        </button>
                        <div className="min-w-0">
                          <span className="text-[9px] font-sans font-bold text-teal-800 block leading-none">
                            QR معلومات الزبون
                          </span>
                          <span
                            className="font-mono tabular-nums text-xs font-black text-gray-900 truncate block mt-1"
                            dir="ltr"
                          >
                            {latestOrderId || (cust.phone || 'بدون طلبات')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {copyVal && (
                          <button
                            type="button"
                            onClick={() => handleCopyBarcode(cust.id, copyVal)}
                            className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-teal-300 text-gray-600 hover:text-teal-700 cursor-pointer"
                            title={latestOrderId ? 'نسخ رقم الطلب' : 'نسخ رقم الهاتف'}
                          >
                            {copiedId === cust.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePrintCustomerCard(cust)}
                          className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-amber-300 text-gray-600 hover:text-amber-700 cursor-pointer"
                          title="طباعة ملصق QR الزبون"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                {cust.latestOrderDate > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-gray-50 flex justify-between items-center text-[10px] text-gray-400 font-sans">
                    <span>آخر نشاط:</span>
                    <span>
                      {!isNaN(new Date(cust.latestOrderDate).getTime())
                        ? new Date(cust.latestOrderDate).toLocaleDateString('ar-SA')
                        : 'غير محدد'}
                    </span>
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => onViewCustomer?.(cust.name, cust.phone, cust.profile || undefined)}
                    className="w-full flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 rounded-xl text-xs font-sans font-bold transition-colors cursor-pointer border border-indigo-100"
                    title="عرض سجل الزبون الكامل، بطاقة QR، تقرير الصيانة، والرسائل"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>ملف الزبون والـ QR والأجهزة</span>
                  </button>

                  {cust.phone && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openWhatsApp(cust.phone)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2 rounded-xl text-xs font-sans font-bold transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        مراسلة
                      </button>
                      <a
                        href={`tel:${cust.phone}`}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-sans font-bold transition-colors"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        اتصال
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-start pt-2 sm:pt-4 overflow-y-auto justify-center p-2 bg-black/40 backdrop-blur-xs"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden mb-4 border border-gray-200 shadow-2xl animate-in slide-in-from-top-2 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-indigo-50/70 px-6 py-4 flex justify-between items-center border-b border-indigo-100/70">
              <h3 className="font-sans font-extrabold text-indigo-900 text-sm">
                إضافة زبون جديد وإنشاء QR خاص به
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {addError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-sans font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div className="space-y-1.5 text-right">
                <label className="block text-gray-700 font-sans font-bold text-xs">اسم الزبون:</label>
                <input
                  type="text"
                  placeholder="مثال: أحمد محمد"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-right"
                />
              </div>

              <div className="space-y-1.5 text-right">
                <label className="block text-gray-700 font-sans font-bold text-xs">رقم الهاتف:</label>
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="مثال: 0791234567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-left"
                />
              </div>

              <div className="space-y-1.5 text-right">
                <label className="block text-gray-700 font-sans font-bold text-xs">ملاحظات (اختياري):</label>
                <input
                  type="text"
                  placeholder="ملاحظات عن العميل..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-right"
                />
              </div>

              <button
                type="button"
                onClick={handleAddCustomer}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-sans font-bold transition-all shadow-md mt-2 cursor-pointer"
              >
                حفظ الزبون
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactsView;
