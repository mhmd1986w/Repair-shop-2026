import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MaintenanceOrder, DeviceStatus, NotificationTemplate, AppUser, isContactOrder, MaintenancePhoto, CustomerProfile, CustomNotificationVariable, StatusHistorySnapshot } from '../types';
import { QRCodeGenerator } from './QRCodeGenerator';
import { BarcodeGenerator } from './BarcodeGenerator';
import JsBarcode from 'jsbarcode';
import { LabelPrintView } from './LabelPrintView';
import { PreNotificationModal } from './PreNotificationModal';
import { CameraCaptureModal } from './CameraCaptureModal';
import { MaintenanceMediaGallery } from './MaintenanceMediaGallery';
import { StatusSnapshotBadges } from './StatusSnapshotBadges';
import { 
  Search, 
  Filter, 
  Plus, 
  Printer, 
  MessageSquare, 
  Wrench, 
  User, 
  Phone, 
  Calendar, 
  CreditCard, 
  FileText, 
  CheckCircle, 
  History, 
  CheckCircle2, 
  AlertTriangle,
  Send,
  Camera,
  Layers,
  Sparkles,
  Share2,
  Trash2,
  Mic,
  MicOff,
  RefreshCw,
  Wifi,
  ShieldAlert,
  Key,
  Lock,
  X,
  Check,
  Barcode,
  Sliders,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Package,
  Tag,
  PlusCircle
} from 'lucide-react';
import {
  DEFAULT_BARCODE_PREFIX,
  sanitizeBarcodePrefix,
  formatDateTimeForBarcode,
  formatCountryDateYmd,
  formatCountryDateTime24h,
  generateBarcodeId,
  parseBarcodeId,
  resolveBarcodeEncoding,
  extractScannedBarcodeId,
  renderPrintableBarcodeSvg
} from '../utils/barcode';
import { renderAlphanumericQrSvg } from '../utils/qrAlphanumeric';
import { buildOrderCustomerQrPayload, normalizeCustomerNameKey, phonesMatch } from '../utils/customerBarcode';
import { PrintFormatToolbar } from './PrintFormatToolbar';
import { PrintFormatConfig, getStoredReceiptFormat, getStoredLabelFormat, ARABIC_FONTS, RECEIPT_FONT_SIZES, LABEL_FONT_SIZES } from '../utils/printFormatting';
import {
  getStoredLabelLayout,
  LabelLayoutConfig,
  LabelElementConfig,
  reorderElements,
  saveStoredLabelLayout,
  getLabelPreviewMetrics,
  getLabelContainerStyles,
  getLabelElementMetrics,
  getSplitThermalLabelMetrics,
  getVerticalOrderIdSvgSpec,
  renderVerticalOrderIdSvg,
  FIXED_LABEL_PAPER_SIZE
} from '../utils/labelDesigner';
import { LabelDesigner } from './LabelDesigner';
import {
  getStoredReceiptLayout,
  ReceiptLayoutConfig,
  ReceiptElementConfig,
  getReceiptPaperMetrics,
  getResponsiveReceiptFontSize,
  getReceiptAlignmentClass
} from '../utils/receiptDesigner';
import { ReceiptDesigner } from './ReceiptDesigner';
import { formatNotification, getWhatsAppLink, openWhatsAppDirectly, getWhatsAppWebLink, getWhatsAppNativeLink, buildStatusHistorySnapshot, getOrderFinancials, getStatusArabicLabel, sanitizeCustomVariables } from '../lib/notifications';
import { printPureContent, printHtmlViaIframe } from '../lib/printUtils';
import { checkMicrophonePermission, requestMicrophonePermission } from '../utils/microphonePermissions';
import { buildTrackingUrl } from '../utils/appDomain';

interface OrdersViewProps {
  orders: MaintenanceOrder[];
  customers?: CustomerProfile[];
  viewType?: 'active' | 'completed' | 'all';
  templates: NotificationTemplate[];
  appUrl: string;
  onSaveOrder: (order: MaintenanceOrder) => void;
  onDeleteOrder: (orderId: string) => void;
  onClearAllOrders: () => void;
  onTriggerDelivery: (order: MaintenanceOrder) => void;
  onLogNotification: (orderId: string, customerName: string, customerPhone: string, type: 'sms' | 'whatsapp', content: string, triggerEvent: string, variablesSnapshot?: StatusHistorySnapshot) => void;
  onScanClick: () => void;
  initialSearchTerm?: string;
  onClearInitialSearch?: () => void;
  initialStatusFilter?: string;
  onClearInitialStatusFilter?: () => void;
  currentUser?: AppUser | null;
  onViewCustomer?: (name: string, phone?: string) => void;
  initialOpenAddModal?: boolean;
  onClearInitialOpenAddModal?: () => void;
  initialPrefillCustomer?: { name: string; phone: string } | null;
  onClearInitialPrefillCustomer?: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  customers = [],
  viewType = 'all',
  templates,
  appUrl,
  onSaveOrder,
  onDeleteOrder,
  onClearAllOrders,
  onTriggerDelivery,
  onLogNotification,
  onScanClick,
  initialSearchTerm,
  onClearInitialSearch,
  initialStatusFilter,
  onClearInitialStatusFilter,
  currentUser,
  onViewCustomer,
  initialOpenAddModal,
  onClearInitialOpenAddModal,
  initialPrefillCustomer,
  onClearInitialPrefillCustomer
}) => {
  const canAdd = currentUser?.permissions ? currentUser.permissions.add_orders : true;
  const canEdit = currentUser?.permissions ? currentUser.permissions.edit_orders : true;
  const canDelete = true;

  const formatSafeDate = (d?: string | number) => {
    if (!d) return 'غير محدد';
    try {
      if (typeof d === 'string') {
        const ymdMatch = d.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (ymdMatch) {
          const dtLocal = new Date(Number(ymdMatch[1]), Number(ymdMatch[2]) - 1, Number(ymdMatch[3]), 12, 0, 0);
          return dtLocal.toLocaleDateString('ar-SA');
        }
      }
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return typeof d === 'string' ? d : 'غير محدد';
      return dt.toLocaleDateString('ar-SA');
    } catch (_) {
      return typeof d === 'string' ? d : 'غير محدد';
    }
  };

  const currencyName = localStorage.getItem('currencyName') || 'دينار';
  const getActiveCountrySettings = () => ({
    countryName: localStorage.getItem('countryName') || 'الأردن',
    countryDialCode: localStorage.getItem('countryDialCode') || '962',
  });
  const countryName = localStorage.getItem('countryName') || 'الأردن';
  const countryDialCode = localStorage.getItem('countryDialCode') || '962';

  // Custom receipt settings loaded dynamically from localStorage
  const rcptCenterNameText = localStorage.getItem('rcptCenterNameText') || '';
  const rcptTermsText = localStorage.getItem('rcptTermsText') || '١. يرجى الحفاظ على هذا الإيصال لتقديمه عند المطالبة باستلام الجهاز.\n٢. المتجر غير مسؤول عن الأجهزة التي لا يستلمها أصحابها بعد مرور ٣٠ يوماً من إبلاغهم بجاهزيتها.\n٣. يسري الضمان فقط على قطع الغيار المستبدلة والمبينة في الفاتورة لمدة ٣٠ يوماً من تاريخ الاستلام.';
  const rcptZoom = localStorage.getItem('rcptZoom') || '100';
  const rcptShowQR = localStorage.getItem('rcptShowQR') !== 'false';
  const rcptSize = localStorage.getItem('rcptSize') || '80mm';

  const getOrderQrContent = (order: MaintenanceOrder, maxLength: number = 520): string => {
    const matchedCustomer =
      customers.find(
        (c) =>
          (order.customerId && c.id === order.customerId) ||
          (order.customerBarcode &&
            c.customerBarcode &&
            c.customerBarcode.toUpperCase() === order.customerBarcode.toUpperCase()) ||
          (order.customerPhone && phonesMatch(c.phone, order.customerPhone)) ||
          (order.customerName &&
            normalizeCustomerNameKey(c.name) === normalizeCustomerNameKey(order.customerName))
      ) || null;
    const customerOrders = orders.filter((o) => {
      if (!o || isContactOrder(o)) return false;
      if (matchedCustomer) {
        if (o.customerId && o.customerId === matchedCustomer.id) return true;
        if (
          o.customerBarcode &&
          matchedCustomer.customerBarcode &&
          o.customerBarcode.toUpperCase() === matchedCustomer.customerBarcode.toUpperCase()
        ) {
          return true;
        }
        if (matchedCustomer.phone && phonesMatch(o.customerPhone, matchedCustomer.phone)) {
          return true;
        }
      }
      if (order.customerPhone && phonesMatch(o.customerPhone, order.customerPhone)) return true;
      return (
        Boolean(order.customerName) &&
        normalizeCustomerNameKey(o.customerName) === normalizeCustomerNameKey(order.customerName)
      );
    });
    return buildOrderCustomerQrPayload({
      order,
      customer: matchedCustomer,
      customerOrders,
      currencyName,
      centerName: localStorage.getItem('centerName') || 'مركز الصيانة الذكي',
      centerMobile: localStorage.getItem('centerMobile') || '',
      appUrl,
      maxLength: Math.max(520, maxLength),
    });
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');

  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
      setStatusFilter('all');
      setDeviceFilter('all');
      if (onClearInitialSearch) {
        onClearInitialSearch();
      }
    }
  }, [initialSearchTerm, onClearInitialSearch]);

  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
      if (onClearInitialStatusFilter) {
        onClearInitialStatusFilter();
      }
    }
  }, [initialStatusFilter, onClearInitialStatusFilter]);

  useEffect(() => {
    if (initialOpenAddModal) {
      if (canAdd) {
        handleOpenAddModal(initialPrefillCustomer || undefined);
      }
      if (onClearInitialOpenAddModal) {
        onClearInitialOpenAddModal();
      }
      if (onClearInitialPrefillCustomer) {
        onClearInitialPrefillCustomer();
      }
    }
  }, [initialOpenAddModal]);
  
  // Modals / Selection states
  const [selectedOrder, setSelectedOrder] = useState<MaintenanceOrder | null>(null);

  // Keep selectedOrder synced when orders update (e.g., delivery confirmation or cloud sync)
  useEffect(() => {
    setSelectedOrder((prev) => {
      if (!prev) return null;
      const fresh = orders.find((o) => o.id === prev.id);
      if (!fresh) return null;
      return fresh === prev ? prev : fresh;
    });
  }, [orders]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPrintLabel, setShowPrintLabel] = useState<MaintenanceOrder | null>(null);
  const [showSimplePrintLabel, setShowSimplePrintLabel] = useState<MaintenanceOrder | null>(null);
  const [showCustomerTicket, setShowCustomerTicket] = useState<MaintenanceOrder | null>(null);
  const [whatsappModal, setWhatsappModal] = useState<{ url: string; orderId: string; customerName: string; phone: string; text: string } | null>(null);
  const [preNotificationTarget, setPreNotificationTarget] = useState<{ order: MaintenanceOrder; targetStatus?: DeviceStatus; targetTemplateId?: string } | null>(null);
  const [cameraModalTarget, setCameraModalTarget] = useState<{ orderId?: string; customerName?: string; deviceModel?: string; defaultStage?: string; isForForm?: boolean } | null>(null);
  const [autoPrintOrder, setAutoPrintOrder] = useState<MaintenanceOrder | null>(null);

  // Deletion states (No password or username required)
  const [showDeleteAuthModal, setShowDeleteAuthModal] = useState(false);
  const [orderToDeleteId, setOrderToDeleteId] = useState<string | null>(null);
  const [copiedMsg, setCopiedMsg] = useState(false);

  useEffect(() => {
    if (autoPrintOrder) {
      const orderToPrint = autoPrintOrder;
      setShowCustomerTicket(orderToPrint);
      const timer = setTimeout(() => {
        handlePrintElement('customer-receipt-print-modal', 'طباعة إيصال الاستلام', () => {
          setTimeout(() => {
            handlePrintLabelThermal(orderToPrint);
            setAutoPrintOrder(null);
          }, 200);
        });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoPrintOrder]);

  useEffect(() => {
    if (showAddModal || preNotificationTarget || showCustomerTicket || whatsappModal || showPrintLabel || showSimplePrintLabel || showDeleteAuthModal || cameraModalTarget) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [showAddModal, preNotificationTarget, showCustomerTicket, whatsappModal, showPrintLabel, showSimplePrintLabel, showDeleteAuthModal, cameraModalTarget]);
  
  // Direct printing simulation states
  const [isDirectPrinting, setIsDirectPrinting] = useState(false);
  const [directPrintMessage, setDirectPrintMessage] = useState<string | null>(null);

  // Dynamic printer selection states
  const [availablePrinters, setAvailablePrinters] = useState<any[]>([]);
  const [selectedLabelPrinterId, setSelectedLabelPrinterId] = useState<string>('');
  const [selectedInvoicePrinterId, setSelectedInvoicePrinterId] = useState<string>('');

  // Label Customization States (stored in localStorage for persistence)
  const [lblShowCenterName, setLblShowCenterName] = useState<boolean>(() => {
    return localStorage.getItem('lblShowCenterName') !== 'false';
  });
  const [lblShowBarcode, setLblShowBarcode] = useState<boolean>(() => {
    return localStorage.getItem('lblShowBarcode') !== 'false';
  });
  const [lblShowQR, setLblShowQR] = useState<boolean>(() => {
    return localStorage.getItem('lblShowQR') === 'true'; // Defaults to false
  });
  const [lblShowCustomerName, setLblShowCustomerName] = useState<boolean>(() => {
    return localStorage.getItem('lblShowCustomerName') !== 'false';
  });
  const [lblShowDeviceModel, setLblShowDeviceModel] = useState<boolean>(() => {
    return localStorage.getItem('lblShowDeviceModel') !== 'false';
  });
  const [lblShowDate, setLblShowDate] = useState<boolean>(() => {
    return localStorage.getItem('lblShowDate') !== 'false';
  });
  const [lblShowMobile, setLblShowMobile] = useState<boolean>(() => {
    return localStorage.getItem('lblShowMobile') !== 'false';
  });
  const [lblBarcodeFormat, setLblBarcodeFormat] = useState<string>(() => {
    return localStorage.getItem('lblBarcodeFormat') || 'AUTO';
  });

  const clampPt = (val: string | null, fallback: number) => {
    const n = val ? Number(val) : fallback;
    if (!Number.isFinite(n)) return fallback;
    return Math.max(10, Math.min(99, n));
  };

  const [lblFontSizeCenterName, setLblFontSizeCenterName] = useState<number>(() => {
    return clampPt(localStorage.getItem('lblFontSizeCenterName'), 13);
  });
  const [lblFontSizeMobile, setLblFontSizeMobile] = useState<number>(() => {
    return clampPt(localStorage.getItem('lblFontSizeMobile'), 10);
  });
  const [lblFontSizeCustomerName, setLblFontSizeCustomerName] = useState<number>(() => {
    return clampPt(localStorage.getItem('lblFontSizeCustomerName'), 10);
  });
  const [lblFontSizeDeviceModel, setLblFontSizeDeviceModel] = useState<number>(() => {
    return clampPt(localStorage.getItem('lblFontSizeDeviceModel'), 10);
  });
  const [lblFontSizeDate, setLblFontSizeDate] = useState<number>(() => {
    return clampPt(localStorage.getItem('lblFontSizeDate'), 10);
  });
  const [lblFontSizeBarcodeText, setLblFontSizeBarcodeText] = useState<number>(() => {
    return clampPt(localStorage.getItem('lblFontSizeBarcodeText'), 10);
  });
  const [showLabelFontSizesControls, setShowLabelFontSizesControls] = useState<boolean>(false);
  const [lblPaperSize, setLblPaperSize] = useState<string>(() => FIXED_LABEL_PAPER_SIZE);
  const [lblLineSpacing, setLblLineSpacing] = useState<number>(() => {
    const saved = localStorage.getItem('lblLineSpacing');
    const parsed = saved ? Number(saved) : 1.15;
    return parsed > 0 ? parsed : 1.15;
  });

  // Printing format configurations (Fonts, Alignment, Spacing, Size, Weight)
  const [rcptFormat, setRcptFormat] = useState<PrintFormatConfig>(() => getStoredReceiptFormat());
  const [lblFormat, setLblFormat] = useState<PrintFormatConfig>(() => getStoredLabelFormat());

  const handleUpdateRcptFormat = (newCfg: PrintFormatConfig) => {
    setRcptFormat(newCfg);
    localStorage.setItem('rcptFontFamily', newCfg.fontFamily);
    localStorage.setItem('rcptFontSize', String(newCfg.fontSize));
    localStorage.setItem('rcptAlign', newCfg.textAlign);
    localStorage.setItem('rcptVerticalAlign', newCfg.verticalAlign);
    localStorage.setItem('rcptLineHeight', String(newCfg.lineHeight));
    localStorage.setItem('rcptFontWeight', newCfg.fontWeight);
    window.dispatchEvent(new Event('storage'));
  };

  const handleUpdateLblFormat = (newCfg: PrintFormatConfig) => {
    setLblFormat(newCfg);
    localStorage.setItem('lblFontFamily', newCfg.fontFamily);
    localStorage.setItem('lblFontSize', String(newCfg.fontSize));
    localStorage.setItem('lblAlign', newCfg.textAlign);
    localStorage.setItem('lblVerticalAlign', newCfg.verticalAlign);
    localStorage.setItem('lblLineHeight', String(newCfg.lineHeight));
    localStorage.setItem('lblFontWeight', newCfg.fontWeight);
    window.dispatchEvent(new Event('storage'));
  };

  const [showFullLabelDesignerInModal, setShowFullLabelDesignerInModal] = useState<boolean>(false);
  const [labelModalLayout, setLabelModalLayout] = useState<LabelLayoutConfig>(() => getStoredLabelLayout());
  const [draggedModalId, setDraggedModalId] = useState<string | null>(null);
  const [dragOverModalId, setDragOverModalId] = useState<string | null>(null);
  const [showFullReceiptDesignerInModal, setShowFullReceiptDesignerInModal] = useState<boolean>(false);
  const [receiptModalLayout, setReceiptModalLayout] = useState<ReceiptLayoutConfig>(() => getStoredReceiptLayout());

  useEffect(() => {
    const handleStorageChange = () => {
      setLabelModalLayout(getStoredLabelLayout());
      setReceiptModalLayout(getStoredReceiptLayout());
      setRcptFormat(getStoredReceiptFormat());
      setLblFormat(getStoredLabelFormat());
      setLblShowCenterName(localStorage.getItem('lblShowCenterName') !== 'false');
      setLblShowBarcode(localStorage.getItem('lblShowBarcode') !== 'false');
      setLblShowQR(localStorage.getItem('lblShowQR') === 'true');
      setLblShowCustomerName(localStorage.getItem('lblShowCustomerName') !== 'false');
      setLblShowDeviceModel(localStorage.getItem('lblShowDeviceModel') !== 'false');
      setLblShowDate(localStorage.getItem('lblShowDate') !== 'false');
      setLblShowMobile(localStorage.getItem('lblShowMobile') !== 'false');
      setLblBarcodeFormat(localStorage.getItem('lblBarcodeFormat') || 'AUTO');
      
      const fsCenter = localStorage.getItem('lblFontSizeCenterName');
      if (fsCenter) setLblFontSizeCenterName(clampPt(fsCenter, 13));
      const fsMob = localStorage.getItem('lblFontSizeMobile');
      if (fsMob) setLblFontSizeMobile(clampPt(fsMob, 10));
      const fsCust = localStorage.getItem('lblFontSizeCustomerName');
      if (fsCust) setLblFontSizeCustomerName(clampPt(fsCust, 10));
      const fsDevice = localStorage.getItem('lblFontSizeDeviceModel');
      if (fsDevice) setLblFontSizeDeviceModel(clampPt(fsDevice, 10));
      const fsDate = localStorage.getItem('lblFontSizeDate');
      if (fsDate) setLblFontSizeDate(clampPt(fsDate, 10));
      const fsBarcode = localStorage.getItem('lblFontSizeBarcodeText');
      if (fsBarcode) setLblFontSizeBarcodeText(clampPt(fsBarcode, 10));
      setLblPaperSize(FIXED_LABEL_PAPER_SIZE);
      const lineSpacing = localStorage.getItem('lblLineSpacing');
      if (lineSpacing && Number(lineSpacing) > 0) setLblLineSpacing(Number(lineSpacing));

      const savedPrinters = localStorage.getItem('maintenance_printers');
      if (savedPrinters) {
        try {
          const parsed = JSON.parse(savedPrinters);
          if (Array.isArray(parsed)) {
            setAvailablePrinters(parsed);
            
            const defLabel = parsed.find((p: any) => p.isDefaultLabels) || parsed[0];
            if (defLabel) {
              setSelectedLabelPrinterId(prev => prev || defLabel.id);
            }
            const defInvoice = parsed.find((p: any) => p.isDefaultInvoices) || parsed[0];
            if (defInvoice) {
              setSelectedInvoicePrinterId(prev => prev || defInvoice.id);
            }
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        const defaultPrinter = {
          id: 'p-default',
          name: 'طابعة النظام الافتراضية (عبر المتصفح)',
          type: 'browser',
          protocol: 'system',
          paperSize: '80mm',
          isDefaultInvoices: true,
          isDefaultLabels: true,
          status: 'online'
        };
        setAvailablePrinters([defaultPrinter]);
        setSelectedLabelPrinterId('p-default');
        setSelectedInvoicePrinterId('p-default');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Call once initially to synchronize states with latest local storage configuration
    handleStorageChange();
    


    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [showPrintLabel]);

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  })();

  // Helper to load default printers from localStorage
  const getDefaultPrinter = (forType: 'invoices' | 'labels') => {
    try {
      const saved = localStorage.getItem('maintenance_printers');
      if (saved) {
        const printersList = JSON.parse(saved);
        if (Array.isArray(printersList)) {
          const found = forType === 'invoices' 
            ? printersList.find((p: any) => p.isDefaultInvoices)
            : printersList.find((p: any) => p.isDefaultLabels);
          return found || printersList[0] || { name: 'طابعة النظام الافتراضية (عبر المتصفح)', type: 'browser' };
        }
      }
    } catch (e) {
      console.error(e);
    }
    return { name: 'طابعة النظام الافتراضية (عبر المتصفح)', type: 'browser' };
  };

  const makePrinterDefault = (printerId: string, forType: 'isDefaultInvoices' | 'isDefaultLabels') => {
    const saved = localStorage.getItem('maintenance_printers');
    let printersList: any[] = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) printersList = parsed;
      } catch (e) {
        console.warn("Invalid saved printers JSON, resetting to default:", e);
      }
    }
    const updated = (printersList.length ? printersList : [{
      id: 'p-default',
      name: 'طابعة النظام الافتراضية (عبر المتصفح)',
      type: 'browser',
      protocol: 'system',
      paperSize: '80mm',
      isDefaultInvoices: true,
      isDefaultLabels: true,
      status: 'online'
    }]).map((p: any) => ({
      ...p,
      [forType]: p.id === printerId
    }));
    
    // Ensure the printer is actually in the list, otherwise add it
    const exists = updated.some((p: any) => p.id === printerId);
    if (!exists && printerId === 'p-default') {
      updated.push({
        id: 'p-default',
        name: 'طابعة النظام الافتراضية (عبر المتصفح)',
        type: 'browser',
        protocol: 'system',
        paperSize: '80mm',
        isDefaultInvoices: forType === 'isDefaultInvoices',
        isDefaultLabels: forType === 'isDefaultLabels',
        status: 'online'
      });
    }

    localStorage.setItem('maintenance_printers', JSON.stringify(updated));
    setAvailablePrinters(updated);
    if (forType === 'isDefaultLabels') {
      setSelectedLabelPrinterId(printerId);
    } else {
      setSelectedInvoicePrinterId(printerId);
    }
    window.dispatchEvent(new Event('storage'));
  };

  const getSelectedLabelPrinter = () => {
    const found = availablePrinters.find(p => p.id === selectedLabelPrinterId);
    return found || getDefaultPrinter('labels');
  };

  const getSelectedInvoicePrinter = () => {
    const found = availablePrinters.find(p => p.id === selectedInvoicePrinterId);
    return found || getDefaultPrinter('invoices');
  };

  // Simulate direct wireless thermal print
  const handleDirectPrint = (printer: any, docType: string) => {
    setIsDirectPrinting(true);
    setDirectPrintMessage('جاري الاتصال بالطابعة اللاسلكية عبر الشبكة المحلية...');
    
    setTimeout(() => {
      setDirectPrintMessage(`✅ تم إرسال أمر الطباعة [${docType}] بنجاح إلى الطابعة [${printer.name}] بنجاح!`);
      setTimeout(() => {
        setIsDirectPrinting(false);
        setDirectPrintMessage(null);
      }, 3500);
    }, 1500);
  };

  const handlePrintElement = (elementId: string, title: string = 'طباعة', onComplete?: () => void) => {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn("عنصر الطباعة غير موجود:", elementId);
      if (onComplete) onComplete();
      return;
    }

    // Load receipt paper size custom settings
    const activeRcptSize = getStoredReceiptLayout().paperSize || localStorage.getItem('rcptSize') || '80mm';
    let pageSizeSpec = 'auto';
    let receiptWidth = '100%';
    let receiptPadding = '12px';

    if (activeRcptSize === '80mm') {
      pageSizeSpec = '80mm auto';
      receiptWidth = '80mm';
      receiptPadding = '8px';
    } else if (activeRcptSize === '58mm') {
      pageSizeSpec = '58mm auto';
      receiptWidth = '58mm';
      receiptPadding = '4px';
    } else if (activeRcptSize === 'A5') {
      pageSizeSpec = 'A5 portrait';
      receiptWidth = '148mm';
      receiptPadding = '16px';
    } else if (activeRcptSize === 'A4') {
      pageSizeSpec = 'A4 portrait';
      receiptWidth = '210mm';
      receiptPadding = '20px';
    }

    // Clone element to sanitize for clean print document
    const clone = element.cloneNode(true) as HTMLElement;

    // Remove any interactive UI elements, designers, and non-printable elements
    clone.querySelectorAll('.no-print, button, input, textarea, select').forEach(el => el.remove());

    // Clean up container styles so it behaves as pure printable page
    clone.style.boxShadow = 'none';
    clone.style.border = 'none';
    clone.style.borderRadius = '0';
    clone.style.width = receiptWidth;
    clone.style.maxWidth = receiptWidth;
    clone.style.padding = receiptPadding;
    clone.style.margin = '0 auto';
    clone.style.background = 'white';
    clone.style.color = 'black';
    clone.style.fontFamily = `${rcptFormat.fontFamily}, 'Cairo', 'Tajawal', sans-serif`;

    const sheetClone = clone.querySelector('#customer-receipt-sheet') as HTMLElement | null;
    if (sheetClone) {
      sheetClone.style.maxWidth = '100%';
      sheetClone.style.width = '100%';
      sheetClone.style.padding = '0';
      sheetClone.style.border = 'none';
      sheetClone.style.borderRadius = '0';
      sheetClone.style.background = 'white';
      sheetClone.style.boxShadow = 'none';
    }

    const pageStyle = `
      @page {
        size: ${pageSizeSpec};
        margin: 0 !important;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        color: black !important;
        font-family: ${rcptFormat.fontFamily}, 'Cairo', 'Tajawal', sans-serif !important;
      }
      #print-root {
        width: 100% !important;
        display: flex !important;
        justify-content: center !important;
        background: white !important;
      }
      .no-print {
        display: none !important;
      }
    `;

    printPureContent(clone.outerHTML, pageStyle, onComplete);
  };

  const handlePrintLabelThermal = (order: MaintenanceOrder) => {
    const mainCenterName = localStorage.getItem('centerName') || 'مركز تكنو للصيانة';
    const centerMobile = localStorage.getItem('centerMobile') || '05xxxxxxxx';

    const layoutConfig = getStoredLabelLayout();
    const effectiveLayout: LabelLayoutConfig = {
      ...layoutConfig,
      paperSize: FIXED_LABEL_PAPER_SIZE
    };
    const containerStyles = getLabelContainerStyles(effectiveLayout, lblFormat.fontFamily);
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
      const currentFormat = localStorage.getItem('lblBarcodeFormat') || lblBarcodeFormat || 'AUTO';
      barcodeSvgHtml = renderPrintableBarcodeSvg({
        code: order.id,
        qrContent: getOrderQrContent(order, 520),
        preferredFormat: currentFormat,
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
    const trackingUrl = buildTrackingUrl(order.id, appUrl);

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
          const txt = `العميل: ${order.customerName || ''}`;
          const fPt = hasQrSide ? splitMetrics.getVerticalInfoFontPt(txt) : fontPt;
          return `<div dir="auto" style="${baseItemStyle} font-size: ${fPt}pt !important; font-weight: ${el.bold ? 800 : 600} !important;">${txt}</div>`;
        }
        case 'device_model': {
          const txt = `الجهاز: ${order.brandModel || ''}`;
          const fPt = hasQrSide ? splitMetrics.getVerticalInfoFontPt(txt) : fontPt;
          return `<div dir="auto" style="${baseItemStyle} font-size: ${fPt}pt !important; font-weight: ${el.bold ? 800 : 600} !important;">${txt}</div>`;
        }
        case 'order_date': {
          const txt = `التاريخ: ${orderDate}`;
          const fPt = hasQrSide ? splitMetrics.getVerticalInfoFontPt(txt) : fontPt;
          return `<div dir="auto" style="${baseItemStyle} font-size: ${fPt}pt !important; font-weight: ${el.bold ? 700 : 400} !important;">${txt}</div>`;
        }
        case 'barcode': {
          if (hasQrSide) {
            return `<div class="barcode-number-readable" dir="ltr" style="margin: 0 !important; padding: 0 !important; height: 100% !important; display: flex !important; align-items: center !important; justify-content: center !important; flex: 0 0 auto !important; overflow: visible !important;">${renderVerticalOrderIdSvg(order.id, splitMetrics)}</div>`;
          }
          const codeFontPt = splitMetrics.getCodeFontPt(order.id, fontPt);
          return `<div class="barcode-number-readable" dir="ltr" style="${baseItemStyle} overflow: visible !important; text-overflow: clip !important; font-size: ${codeFontPt}pt !important; font-family: system-ui, -apple-system, 'Cairo', sans-serif !important; font-variant-numeric: tabular-nums !important; font-weight: 900 !important; letter-spacing: -0.2px !important; direction: ltr !important; line-height: 1 !important;">${order.id}</div>`;
        }
        case 'custom_text': {
          const txt = el.customContent || 'يرجى إبراز هذا الملصق عند الاستلام';
          const fPt = hasQrSide ? splitMetrics.getVerticalInfoFontPt(txt) : fontPt;
          if (hasQrSide) {
            return `<div class="custom-text" dir="auto" style="${baseItemStyle} font-size: ${fPt}pt !important; font-weight: ${el.bold ? 700 : 500} !important;">${txt}</div>`;
          }
          return `<div class="custom-text" style="margin-top: ${mTopMm}mm !important; margin-bottom: ${mBotMm}mm !important; padding: 0 !important; text-align: ${containerStyles.textAlign} !important; align-self: ${containerStyles.alignItems} !important; max-width: 100% !important; white-space: normal !important; word-break: break-word !important; box-sizing: border-box !important; line-height: ${effectiveLineSpacing} !important; font-size: ${fontPt}pt !important; font-weight: ${el.bold ? 700 : 500} !important;">${txt}</div>`;
        }
        default:
          return '';
      }
    }).filter(Boolean).join('\n');

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
    const leftQrHtml = leftQrBlocks.join('\n');

    const hasInfoHtml = Boolean(rightInfoElementsHtml.trim());
    const labelHtml = hasQrSide
      ? (hasInfoHtml
        ? `
      <div class="pure-thermal-label-outer" dir="rtl">
        <div class="thermal-info-col">
          ${rightInfoElementsHtml}
        </div>
        <div class="thermal-qr-col">
          ${leftQrHtml}
        </div>
      </div>
    `
        : `
      <div class="pure-thermal-label-outer pure-thermal-label-qr-only" dir="rtl">
        <div class="thermal-qr-col">
          ${leftQrHtml}
        </div>
      </div>
    `)
      : `
      <div class="pure-thermal-label-outer" dir="rtl">
        ${rightInfoElementsHtml}
      </div>
    `;

    const pageStyle = `
      @page {
        size: ${widthLabel} ${heightLabel};
        margin: 0 !important;
      }
      .pure-thermal-label-outer {
        width: ${widthLabel} !important;
        height: ${heightLabel} !important;
        max-width: ${widthLabel} !important;
        max-height: ${heightLabel} !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: ${hasQrSide ? 'row' : 'column'} !important;
        align-items: center !important;
        justify-content: ${hasQrSide && hasInfoHtml ? 'space-between' : 'center'} !important;
        gap: ${hasQrSide && hasInfoHtml ? `${colGapMm}mm` : '0'} !important;
        padding: ${effectivePaddingMm}mm !important;
        box-sizing: border-box !important;
        text-align: ${containerStyles.textAlign} !important;
        margin: 0 auto !important;
        background: white !important;
        color: black !important;
        font-family: ${containerStyles.fontFamilyCss} !important;
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
      .pure-thermal-label-outer svg {
        max-width: 100% !important;
        display: block !important;
      }
      .pure-thermal-label-outer * {
        box-sizing: border-box !important;
      }
    `;

    printPureContent(labelHtml, pageStyle);
  };
  
  // Form fields for adding/editing
  const [isEditing, setIsEditing] = useState(false);
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formDeviceType, setFormDeviceType] = useState('جوال');
  const [formBrandModel, setFormBrandModel] = useState('');
  const [formSerialNumber, setFormSerialNumber] = useState('');
  const [formFaultDescription, setFormFaultDescription] = useState('');
  const [formEstimatedCost, setFormEstimatedCost] = useState<number | ''>('');
  const [formExtraCost, setFormExtraCost] = useState<number | ''>('');
  const [formExtraCostReason, setFormExtraCostReason] = useState('');
  const [formAdvancePayment, setFormAdvancePayment] = useState<number | ''>('');
  const [formWaitingPartsDetails, setFormWaitingPartsDetails] = useState('');
  const [formWaitingPartsExpectedDate, setFormWaitingPartsExpectedDate] = useState('');
  const [formCustomVariables, setFormCustomVariables] = useState<CustomNotificationVariable[]>([]);
  const [newFormVarLabel, setNewFormVarLabel] = useState('');
  const [newFormVarValue, setNewFormVarValue] = useState('');
  const [formCurrency, setFormCurrency] = useState('');
  const [formExpectedDeliveryDate, setFormExpectedDeliveryDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatusUpdateText, setFormStatusUpdateText] = useState('');
  const [formTechnician, setFormTechnician] = useState('');
  const [formBarcodePrefix, setFormBarcodePrefix] = useState<string>(() => 
    sanitizeBarcodePrefix(localStorage.getItem('barcodePrefix') || 'TEC')
  );
  const [formBarcodeId, setFormBarcodeId] = useState<string>('');
  const [formPhotos, setFormPhotos] = useState<MaintenancePhoto[]>([]);
  const [formCustomerId, setFormCustomerId] = useState<string>('');
  const [formCustomerBarcode, setFormCustomerBarcode] = useState<string>('');

  // Unified customer autocomplete database combining persistent CustomerProfiles & order history
  const uniqueCustomers = useMemo(() => {
    const list: { id?: string; customerBarcode?: string; name: string; phone: string }[] = [];
    const seenKeys = new Set<string>();

    customers.forEach((c) => {
      const key = c.phone?.trim() || c.name?.trim();
      if (key) seenKeys.add(key);
      list.push({
        id: c.id,
        customerBarcode: c.customerBarcode,
        name: c.name,
        phone: c.phone,
      });
    });

    orders.forEach((o) => {
      const p = (o.customerPhone || '').trim();
      const n = (o.customerName || '').trim();
      const key = p || n;
      if (!key) return;
      const alreadyExists = list.some(
        (item) =>
          (p && phonesMatch(item.phone, p)) ||
          (!p && normalizeCustomerNameKey(item.name) === normalizeCustomerNameKey(n))
      );
      if (!alreadyExists && !seenKeys.has(key)) {
        seenKeys.add(key);
        list.push({
          id: o.customerId,
          customerBarcode: o.customerBarcode,
          name: n,
          phone: p,
        });
      }
    });

    return list;
  }, [customers, orders]);

  const matchedCustomerInForm = useMemo(() => {
    if (formCustomerId) {
      const byId = uniqueCustomers.find((c) => c.id === formCustomerId);
      if (byId) return byId;
    }
    if (formCustomerPhone.trim()) {
      const byPhone = uniqueCustomers.find((c) => phonesMatch(c.phone, formCustomerPhone));
      if (byPhone) return byPhone;
    }
    if (formCustomerName.trim()) {
      const nKey = normalizeCustomerNameKey(formCustomerName);
      const byName = uniqueCustomers.find((c) => normalizeCustomerNameKey(c.name) === nKey);
      if (byName) return byName;
    }
    return null;
  }, [uniqueCustomers, formCustomerId, formCustomerPhone, formCustomerName]);

  const [customerSuggestions, setCustomerSuggestions] = useState<{ id?: string; customerBarcode?: string; name: string; phone: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'name' | 'phone' | null>(null);

  const handleNameChange = (val: string) => {
    setFormCustomerName(val);
    setFormCustomerId('');
    setFormCustomerBarcode('');
    setActiveSuggestionField('name');
    if (!val.trim()) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const q = val.toLowerCase();
    const filtered = uniqueCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(val) ||
        (c.customerBarcode && c.customerBarcode.toLowerCase().includes(q))
    );
    setCustomerSuggestions(filtered);
    setShowSuggestions(true);
  };

  const handlePhoneChange = (val: string) => {
    setFormCustomerPhone(val);
    setFormCustomerId('');
    setFormCustomerBarcode('');
    setActiveSuggestionField('phone');
    if (!val.trim()) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const q = val.toLowerCase();
    const filtered = uniqueCustomers.filter(
      (c) =>
        c.phone.includes(val) ||
        c.name.toLowerCase().includes(q) ||
        (c.customerBarcode && c.customerBarcode.toLowerCase().includes(q))
    );
    setCustomerSuggestions(filtered);
    setShowSuggestions(true);
  };

  const selectSuggestion = (c: { id?: string; customerBarcode?: string; name: string; phone: string }) => {
    setFormCustomerName(c.name);
    setFormCustomerPhone(c.phone);
    setFormCustomerId(c.id || '');
    setFormCustomerBarcode(c.customerBarcode || '');
    setShowSuggestions(false);
    setCustomerSuggestions([]);
  };
  
  // Secondary status history logs form inside details
  const [statusNote, setStatusNote] = useState('');
  const [continuousUpdateText, setContinuousUpdateText] = useState('');

  useEffect(() => {
    setContinuousUpdateText(selectedOrder?.statusUpdateText || '');
  }, [selectedOrder?.id, selectedOrder?.statusUpdateText]);

  const handleContinuousUpdateBlur = () => {
    if (!selectedOrder || !canEdit) return;
    if (continuousUpdateText === selectedOrder.statusUpdateText) return;
    if (!continuousUpdateText && !selectedOrder.statusUpdateText) return;

    const updatedOrder = {
      ...selectedOrder,
      statusUpdateText: continuousUpdateText,
      updatedAt: Date.now()
    };
    onSaveOrder(updatedOrder);
    setSelectedOrder(updatedOrder);
  };

  // History of other orders for the currently selected customer
  const selectedCustomerHistory = selectedOrder 
    ? orders.filter(o => {
        if (o.id === selectedOrder.id || isContactOrder(o)) return false;
        if (selectedOrder.customerId && o.customerId && o.customerId === selectedOrder.customerId) return true;
        if (selectedOrder.customerPhone?.trim() && phonesMatch(o.customerPhone, selectedOrder.customerPhone)) return true;
        return false;
      })
    : [];

  // Voice Input for form fields
  const [listeningField, setListeningField] = useState<'customerName' | 'faultDescription' | 'notes' | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const handleVoiceInput = async (field: 'customerName' | 'faultDescription' | 'notes') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("عذراً، متصفحك أو جهازك الحالي لا يدعم ميزة التعرف على الصوت. يرجى استخدام متصفح يدعم هذه الخدمة مثل Google Chrome أو Safari.");
      return;
    }

    if (listeningField === field) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      setListeningField(null);
      return;
    } else if (listeningField !== null) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    }

    // Proactively verify/request mic permission before starting speech recognition
    try {
      const permCheck = await checkMicrophonePermission();
      if (!permCheck.granted) {
        const reqRes = await requestMicrophonePermission();
        if (!reqRes.granted) {
          alert(reqRes.error || "يرجى منح صلاحية استخدام المايكروفون في المتصفح لتتمكن من إدخال المعلومات بالصوت.");
          return;
        }
      }
    } catch (e) {
      console.warn("Microphone permission check error:", e);
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA'; // Arabic (Saudi Arabia)
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setListeningField(field);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          let cleanedText = transcript.trim();
          if (cleanedText.endsWith('.')) {
            cleanedText = cleanedText.slice(0, -1);
          }
          
          if (field === 'customerName') {
            setFormCustomerName(cleanedText);
          } else if (field === 'faultDescription') {
            setFormFaultDescription(cleanedText);
          } else if (field === 'notes') {
            setFormNotes(cleanedText);
          }
        }
      };

      recognition.onerror = async (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          setListeningField(null);
          return;
        }
        console.warn("Speech recognition notice:", event.error);
        if (event.error === 'not-allowed') {
          const reqRes = await requestMicrophonePermission();
          if (reqRes.granted) {
            alert("تم تفعيل صلاحية المايكروفون بنجاح! اضغط على زر المايكروفون مرة أخرى للبدء بالإملاء الصوتي.");
          } else {
            alert(reqRes.error || "يرجى تفعيل صلاحية استخدام الميكروفون في المتصفح لتتمكن من تسجيل الصوت.");
          }
        } else {
          alert("تعذر التعرف على الصوت بشكل دقيق. يرجى المحاولة مرة أخرى بصوت واضح وبطيء.");
        }
        setListeningField(null);
      };

      recognition.onend = () => {
        setListeningField(null);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.warn("Speech recognition creation failed:", error);
      setListeningField(null);
    }
  };

  // Auto generate ID: ***yymmddhhmm (3-char prefix + country local 24h timestamp)
  const generateNewId = (prefixToUse?: string) => {
    const rawPrefix = prefixToUse || formBarcodePrefix || localStorage.getItem('barcodePrefix') || 'TEC';
    const cleanPrefix = sanitizeBarcodePrefix(rawPrefix);
    const existingOrderIds = orders.map(o => o.id);
    return generateBarcodeId(cleanPrefix, existingOrderIds, new Date(), getActiveCountrySettings());
  };

  const handleOpenAddModal = (prefill?: { name: string; phone: string }) => {
    setIsEditing(false);
    const currentPrefix = sanitizeBarcodePrefix(localStorage.getItem('barcodePrefix') || 'TEC');
    setFormBarcodePrefix(currentPrefix);
    const activeTz = getActiveCountrySettings();
    const newId = generateBarcodeId(currentPrefix, orders.map(o => o.id), new Date(), activeTz);
    setFormBarcodeId(newId);

    setFormCustomerName(prefill?.name || '');
    setFormCustomerPhone(prefill?.phone || '');
    const matchedPrefill = prefill
      ? uniqueCustomers.find(
          (c) =>
            (prefill.phone && phonesMatch(c.phone, prefill.phone)) ||
            (prefill.name && normalizeCustomerNameKey(c.name) === normalizeCustomerNameKey(prefill.name))
        )
      : undefined;
    setFormCustomerId(matchedPrefill?.id || '');
    setFormCustomerBarcode(matchedPrefill?.customerBarcode || '');
    setFormDeviceType('جوال');
    setFormBrandModel('');
    setFormSerialNumber('');
    setFormFaultDescription('');
    setFormEstimatedCost('');
    setFormExtraCost('');
    setFormExtraCostReason('');
    setFormAdvancePayment('');
    setFormWaitingPartsDetails('');
    setFormWaitingPartsExpectedDate('');
    setFormCustomVariables([]);
    setNewFormVarLabel('');
    setNewFormVarValue('');
    setFormCurrency(localStorage.getItem('currencyName') || currencyName);
    
    // Set default expected date to 3 days from now in active country timezone
    const threeDaysOut = formatCountryDateYmd(Date.now() + 3 * 24 * 60 * 60 * 1000, activeTz);
    setFormExpectedDeliveryDate(threeDaysOut);
    
    setFormNotes(''); setFormStatusUpdateText('');
    setFormTechnician(localStorage.getItem('engineerName') || 'م. محمد وليد');
    setFormPhotos([]);
    setShowAddModal(true);
  };


  const handleOpenDuplicateModal = (order: MaintenanceOrder) => {
    setIsEditing(false); // New order, not editing the old one
    const currentPrefix = sanitizeBarcodePrefix(localStorage.getItem('barcodePrefix') || 'TEC');
    setFormBarcodePrefix(currentPrefix);
    const activeTz = getActiveCountrySettings();
    const newId = generateBarcodeId(currentPrefix, orders.map(o => o.id), new Date(), activeTz);
    setFormBarcodeId(newId);

    setFormCustomerName(order.customerName);
    setFormCustomerPhone(order.customerPhone);
    setFormCustomerId(order.customerId || '');
    setFormCustomerBarcode(order.customerBarcode || '');
    setFormDeviceType(order.deviceType);
    setFormBrandModel(order.brandModel);
    setFormSerialNumber(order.serialNumber);
    setFormFaultDescription(''); // Let them write new fault
    setFormEstimatedCost('');
    setFormExtraCost('');
    setFormExtraCostReason('');
    setFormAdvancePayment('');
    setFormWaitingPartsDetails('');
    setFormWaitingPartsExpectedDate('');
    setFormCustomVariables([]);
    setNewFormVarLabel('');
    setNewFormVarValue('');
    setFormCurrency(order.currency || localStorage.getItem('currencyName') || currencyName);
    
    // Set default expected date to 3 days from now in active country timezone
    const threeDaysOut = formatCountryDateYmd(Date.now() + 3 * 24 * 60 * 60 * 1000, activeTz);
    setFormExpectedDeliveryDate(threeDaysOut);
    
    setFormNotes(''); setFormStatusUpdateText('');
    setFormTechnician(localStorage.getItem('engineerName') || 'م. محمد وليد');
    setFormPhotos([]);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (order: MaintenanceOrder) => {
    setIsEditing(true);
    setFormBarcodeId(order.id);
    setFormBarcodePrefix(order.id.slice(0, 3));
    setFormCustomerName(order.customerName);
    setFormCustomerPhone(order.customerPhone);
    setFormCustomerId(order.customerId || '');
    setFormCustomerBarcode(order.customerBarcode || '');
    setFormDeviceType(order.deviceType);
    setFormBrandModel(order.brandModel);
    setFormSerialNumber(order.serialNumber);
    setFormFaultDescription(order.faultDescription);
    setFormEstimatedCost(order.estimatedCost === 0 ? '' : order.estimatedCost);
    setFormExtraCost(order.extraCost ? order.extraCost : '');
    setFormExtraCostReason(order.extraCostReason || '');
    setFormAdvancePayment(order.advancePayment ? order.advancePayment : '');
    setFormWaitingPartsDetails(order.waitingPartsDetails || '');
    setFormWaitingPartsExpectedDate(order.waitingPartsExpectedDate || '');
    setFormCustomVariables(order.customVariables ? order.customVariables.map(v => ({ ...v })) : []);
    setNewFormVarLabel('');
    setNewFormVarValue('');
    setFormCurrency(order.currency || currencyName);
    setFormExpectedDeliveryDate(order.expectedDeliveryDate);
    setFormNotes(order.notes); setFormStatusUpdateText(order.statusUpdateText || '');
    setFormTechnician(order.technician);
    setFormPhotos(order.photos || []);
    setShowAddModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim() || !formCustomerPhone.trim() || !formBrandModel.trim() || !formFaultDescription.trim()) return;

    const resolvedCustId = formCustomerId || matchedCustomerInForm?.id;
    const resolvedCustBarcode = formCustomerBarcode || matchedCustomerInForm?.customerBarcode;

    const baseCostVal = formEstimatedCost === '' ? 0 : Number(formEstimatedCost) || 0;
    const extraCostVal = formExtraCost === '' ? 0 : Number(formExtraCost) || 0;
    const advanceVal = formAdvancePayment === '' ? 0 : Number(formAdvancePayment) || 0;
    const mergedVars = sanitizeCustomVariables(
      newFormVarLabel.trim() && newFormVarValue.trim()
        ? [
            ...formCustomVariables,
            {
              key: `var_${formCustomVariables.length + 1}`,
              label: newFormVarLabel.trim(),
              value: newFormVarValue.trim(),
            },
          ]
        : formCustomVariables
    );
    const resolvedCurrency = formCurrency || currencyName;

    if (isEditing && selectedOrder) {
      // Edit existing
      const baseEdited: MaintenanceOrder = {
        ...selectedOrder,
        ...(resolvedCustId ? { customerId: resolvedCustId } : {}),
        ...(resolvedCustBarcode ? { customerBarcode: resolvedCustBarcode } : {}),
        customerName: formCustomerName.trim(),
        customerPhone: formCustomerPhone.trim(),
        deviceType: formDeviceType,
        brandModel: formBrandModel.trim(),
        serialNumber: formSerialNumber.trim(),
        faultDescription: formFaultDescription.trim(),
        estimatedCost: baseCostVal,
        extraCost: extraCostVal,
        extraCostReason: formExtraCostReason.trim(),
        advancePayment: advanceVal,
        waitingPartsDetails: formWaitingPartsDetails.trim(),
        waitingPartsExpectedDate: formWaitingPartsExpectedDate.trim(),
        customVariables: mergedVars,
        currency: resolvedCurrency,
        expectedDeliveryDate: formExpectedDeliveryDate,
        notes: formNotes.trim(),
        statusUpdateText: formStatusUpdateText.trim(),
        technician: formTechnician.trim(),
        photos: formPhotos,
        updatedAt: Date.now()
      };

      const editSnapshot = buildStatusHistorySnapshot(baseEdited, {
        statusNote: 'تم تحديث تفاصيل وبيانات الجهاز والأسعار والمتغيرات.',
        notificationChannel: 'none',
        currency: resolvedCurrency,
      });

      const updatedOrder: MaintenanceOrder = {
        ...baseEdited,
        statusHistory: [
          ...(selectedOrder.statusHistory || []),
          {
            status: selectedOrder.status,
            timestamp: Date.now(),
            note: 'تم تحديث تفاصيل وبيانات الجهاز والعميل بنجاح.',
            updatedBy: currentUser?.displayName || 'موظف الاستقبال',
            snapshot: editSnapshot,
          }
        ]
      };

      onSaveOrder(updatedOrder);
      setSelectedOrder(updatedOrder);
    } else {
      // Add new (Reception)
      const newId = formBarcodeId || generateNewId(formBarcodePrefix);
      const baseNewOrder: MaintenanceOrder = {
        id: newId,
        ...(resolvedCustId ? { customerId: resolvedCustId } : {}),
        ...(resolvedCustBarcode ? { customerBarcode: resolvedCustBarcode } : {}),
        customerName: formCustomerName.trim(),
        customerPhone: formCustomerPhone.trim(),
        deviceType: formDeviceType,
        brandModel: formBrandModel.trim(),
        serialNumber: formSerialNumber.trim(),
        faultDescription: formFaultDescription.trim(),
        estimatedCost: baseCostVal,
        extraCost: extraCostVal,
        extraCostReason: formExtraCostReason.trim(),
        advancePayment: advanceVal,
        waitingPartsDetails: formWaitingPartsDetails.trim(),
        waitingPartsExpectedDate: formWaitingPartsExpectedDate.trim(),
        customVariables: mergedVars,
        currency: resolvedCurrency,
        expectedDeliveryDate: formExpectedDeliveryDate,
        status: DeviceStatus.RECEIVED,
        notes: formNotes.trim(),
        statusUpdateText: formStatusUpdateText.trim(),
        technician: formTechnician.trim(),
        photos: formPhotos,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        statusHistory: []
      };

      const receptionSnapshot = buildStatusHistorySnapshot(baseNewOrder, {
        statusNote: 'تم استقبال الجهاز في المحل وتسجيل الطلب بنجاح.',
        notificationChannel: 'none',
        currency: resolvedCurrency,
      });

      const newOrder: MaintenanceOrder = {
        ...baseNewOrder,
        statusHistory: [
          {
            status: DeviceStatus.RECEIVED,
            timestamp: Date.now(),
            note: 'تم استقبال الجهاز في المحل وتسجيل الطلب بنجاح.',
            updatedBy: currentUser?.displayName || 'موظف الاستقبال',
            snapshot: receptionSnapshot,
          }
        ]
      };

      onSaveOrder(newOrder);
      
      // Open pre-send notification modal allowing review of path, diagnosis, price and message text
      setPreNotificationTarget({
        order: newOrder,
        targetStatus: DeviceStatus.RECEIVED,
        targetTemplateId: 'received'
      });
    }
    
    setShowAddModal(false);
  };

  const handleStatusChange = (newStatus: DeviceStatus) => {
    if (!selectedOrder) return;
    if (newStatus === selectedOrder.status) return;

    if (newStatus === DeviceStatus.DELIVERED) {
      // Handled via the delivery modal flow
      onTriggerDelivery(selectedOrder);
      return;
    }

    // Open pre-notification modal allowing editing of maintenance path, diagnosis, price and message before sending
    setPreNotificationTarget({
      order: selectedOrder,
      targetStatus: newStatus
    });
  };

  const handleDeleteClick = (orderId: string) => {
    setOrderToDeleteId(orderId);
    setShowDeleteAuthModal(true);
  };

  const sendCustomStatusUpdate = () => {
    if (!selectedOrder) return;
    setPreNotificationTarget({
      order: selectedOrder,
      targetStatus: selectedOrder.status
    });
  };

  const triggerDirectWhatsApp = (tplId: string) => {
    if (!selectedOrder) return;
    const tpl = templates.find(t => t.id === tplId);
    const targetStatus = (tpl && typeof tpl.statusTrigger === 'string' && tpl.statusTrigger !== 'reminder' && (tpl.statusTrigger as string) !== 'overdue_48h')
      ? (tpl.statusTrigger as DeviceStatus)
      : selectedOrder.status;

    setPreNotificationTarget({
      order: selectedOrder,
      targetStatus,
      targetTemplateId: tplId
    });
  };

  // Filters calculation
  const filteredOrders = orders.filter(order => {
    if (isContactOrder(order)) return false; // Exclude contacts from the maintenance list
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (order.customerName || '').toLowerCase().includes(q) ||
      (order.customerPhone || '').toLowerCase().includes(q) ||
      phonesMatch(order.customerPhone, searchTerm) ||
      (order.id || '').toLowerCase().includes(q) ||
      (order.brandModel || '').toLowerCase().includes(q) ||
      (order.serialNumber && order.serialNumber.toLowerCase().includes(q)) ||
      (order.customerBarcode && order.customerBarcode.toLowerCase().includes(q)) ||
      (order.deviceBarcode && order.deviceBarcode.toLowerCase().includes(q)) ||
      (order.customerId && order.customerId.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesDevice = deviceFilter === 'all' || order.deviceType === deviceFilter;

    let matchesViewType = true;
    if (viewType === 'active') {
      matchesViewType = order.status !== DeviceStatus.DELIVERED && order.status !== DeviceStatus.UNREPAIRABLE;
    } else if (viewType === 'completed') {
      matchesViewType = order.status === DeviceStatus.DELIVERED || order.status === DeviceStatus.UNREPAIRABLE;
    }

    return matchesSearch && matchesStatus && matchesDevice && matchesViewType;
  });

  // Extract unique device types for dropdown filters
  const uniqueDevices = Array.from(new Set(orders.filter(o => !isContactOrder(o)).map(o => o.deviceType)));

  const getStatusBadge = (status: DeviceStatus) => {
    switch (status) {
      case DeviceStatus.RECEIVED:
        return <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-sans font-bold rounded-xl">تم الاستلام</span>;
      case DeviceStatus.DIAGNOSING:
        return <span className="px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-800 text-xs font-sans font-bold rounded-xl">تحت الفحص</span>;
      case DeviceStatus.REPAIRING:
        return <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-sans font-bold rounded-xl">تحت الإصلاح</span>;
      case DeviceStatus.PENDING:
        return <span className="px-2.5 py-1 bg-sky-50 border border-sky-200 text-sky-800 text-xs font-sans font-bold rounded-xl">قيد الانتظار ⏳</span>;
      case DeviceStatus.READY:
        return <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-sans font-bold rounded-xl animate-bounce">جاهز للتسليم 🎉</span>;
      case DeviceStatus.DELIVERED:
        return <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 text-gray-500 text-xs font-sans font-bold rounded-xl">تم التسليم ✅</span>;
      case DeviceStatus.UNREPAIRABLE:
        return <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-sans font-bold rounded-xl">غير قابل للإصلاح</span>;
      default:
        return null;
    }
  };

  const renderDetailPanel = () => {
    return (
      <>
              {selectedOrder ? (
        <div className="bg-white rounded-3xl border border-gray-100  p-6 space-y-6 animate-in fade-in slide-in-from-top-4 duration-200">
          
          {/* Header Row: Order ID, customer, device and quick actions */}
          <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-teal-600 font-extrabold bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100">{selectedOrder.id}</span>
                {getStatusBadge(selectedOrder.status)}
              </div>
              <h3 className="font-sans text-gray-900 font-extrabold text-base md:text-lg mt-1 flex items-center gap-2 flex-wrap">
                <span>تفاصيل طلب الصيانة:</span>
                <button
                  type="button"
                  onClick={() => onViewCustomer?.(selectedOrder.customerName, selectedOrder.customerPhone)}
                  className="text-teal-700 hover:text-teal-900 hover:underline cursor-pointer transition-colors bg-teal-50/80 hover:bg-teal-100 px-2.5 py-0.5 rounded-xl border border-teal-200/60 inline-flex items-center gap-1.5"
                  title="عرض السجل الكامل للزبون، بطاقات الصيانة، والرسائل المرسلة"
                >
                  <span>{selectedOrder.customerName}</span>
                  <span className="text-[10px] font-sans bg-teal-600 text-white px-1.5 py-0.2 rounded-md">سجل الزبون</span>
                </button>
              </h3>
              <p className="text-xs text-gray-400 font-sans">
                جهاز {selectedOrder.deviceType} • <strong>{selectedOrder.brandModel}</strong>
              </p>
            </div>
            
            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setCameraModalTarget({
                    orderId: selectedOrder.id,
                    customerName: selectedOrder.customerName,
                    deviceModel: `${selectedOrder.deviceType} ${selectedOrder.brandModel}`,
                    defaultStage: selectedOrder.status === DeviceStatus.RECEIVED ? 'fault_initial' : 'disassembly'
                  });
                }}
                disabled={!canEdit}
                className="text-emerald-700 hover:text-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 rounded-xl text-xs font-sans font-bold transition-colors flex items-center gap-1 active:scale-95 duration-100 cursor-pointer"
                title="فتح الكاميرا لتوثيق حالة أو مرحلة صيانة الجهاز"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                <span>توثيق بالكاميرا ({selectedOrder.photos?.length || 0})</span>
              </button>
              <button
                onClick={() => {
                  if (selectedOrder) {
                    setPreNotificationTarget({
                      order: selectedOrder,
                      targetStatus: selectedOrder.status
                    });
                  }
                }}
                className="text-emerald-700 hover:text-emerald-900 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 rounded-xl text-xs font-sans font-bold transition-colors flex items-center gap-1 active:scale-95 duration-100 cursor-pointer"
                title="إرسال إشعار واتساب للعميل"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>إشعار واتساب</span>
              </button>
              <button
                onClick={() => handleOpenDuplicateModal(selectedOrder)}
                disabled={!canAdd}
                className="text-teal-600 hover:text-teal-800 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 bg-teal-50 hover:bg-teal-100 border border-teal-200/60 rounded-xl text-xs font-sans font-bold transition-colors flex items-center gap-1 active:scale-95 duration-100"
                title={!canAdd ? "عذراً، ليس لديك صلاحية لإضافة طلبات" : "تسجيل طلب صيانة جديد لنفس العميل والجهاز"}
              >
                <Plus className="w-3.5 h-3.5" />
                صيانة جديدة للجهاز
              </button>
              <button
                onClick={() => handleOpenEditModal(selectedOrder)}
                disabled={!canEdit}
                className="text-gray-600 hover:text-gray-950 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200/60 rounded-xl text-xs font-sans font-bold transition-colors flex items-center gap-1 active:scale-95 duration-100"
                title={!canEdit ? "عذراً، ليس لديك صلاحية لتعديل الطلب" : "تعديل بيانات العميل أو الجهاز"}
              >
                تعديل البيانات
              </button>
              <button
                onClick={() => setShowPrintLabel(selectedOrder)}
                className="text-gray-700 hover:text-gray-950 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200/60 rounded-xl text-xs transition-all flex items-center gap-1 font-sans font-bold active:scale-95 duration-100"
                title="طباعة ملصق الباركود الحراري للجهاز"
              >
                <Printer className="w-4 h-4 text-teal-600" />
                <span>ملصق</span>
              </button>
              <button
                onClick={() => setShowCustomerTicket(selectedOrder)}
                className="text-teal-700 hover:text-teal-900 px-3 py-2 bg-teal-50 hover:bg-teal-100 border border-teal-200/60 rounded-xl text-xs transition-all flex items-center gap-1 font-sans font-bold active:scale-95 duration-100"
                title="طباعة إيصال استلام الجهاز"
              >
                <FileText className="w-4 h-4" />
                <span>إيصال</span>
              </button>
              <button
                onClick={() => handleDeleteClick(selectedOrder.id)}
                className="text-rose-600 hover:text-rose-800 p-2.5 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all active:scale-95 duration-100"
                title="حذف طلب الصيانة نهائياً"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600 p-2 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-gray-200/40 mr-1"
                title="إغلاق لوحة التفاصيل"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3-Column Content Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            
            {/* Column 1: Core Maintenance Details Card & Real Delivery info */}
            <div className="space-y-4">
              <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100/80 space-y-3">
                <h4 className="font-sans font-extrabold text-gray-800 text-xs border-b border-gray-200/60 pb-2">📋 بيانات بطاقة الصيانة</h4>
                <div className="space-y-2 text-xs font-sans text-gray-600">
                  <div className="flex justify-between items-center">
                    <span>الهاتف:</span>
                    <strong className="text-gray-900 font-mono text-sm">{selectedOrder.customerPhone}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>الرقم التسلسلي (S/N):</span>
                    <strong className="text-gray-800 font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-gray-200/50">{selectedOrder.serialNumber || 'غير متوفر'}</strong>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                    <span>المشكلة/العطل:</span>
                    <strong className="text-gray-900 text-left bg-white px-2 py-0.5 rounded border border-gray-200/50 max-w-[180px] break-words">{selectedOrder.faultDescription}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>التكلفة الأساسية:</span>
                    <strong className="text-gray-950 font-bold">{selectedOrder.estimatedCost} {selectedOrder.currency || currencyName}</strong>
                  </div>
                  {(selectedOrder.extraCost || 0) > 0 && (
                    <div className="flex justify-between items-start gap-2 text-amber-900">
                      <span>الكلف الإضافية:</span>
                      <strong className="font-bold text-left">
                        {selectedOrder.extraCost} {selectedOrder.currency || currencyName}
                        {selectedOrder.extraCostReason ? ` (${selectedOrder.extraCostReason})` : ''}
                      </strong>
                    </div>
                  )}
                  {(selectedOrder.advancePayment || 0) > 0 && (
                    <div className="flex justify-between items-center text-teal-800">
                      <span>العربون المدفوع:</span>
                      <strong className="font-bold">{selectedOrder.advancePayment} {selectedOrder.currency || currencyName}</strong>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-100 pt-1.5 text-emerald-800 font-bold">
                    <span>التكلفة الإجمالية:</span>
                    <span className="text-emerald-700 font-extrabold">
                      {getOrderFinancials(selectedOrder, currencyName).totalCost} {selectedOrder.currency || currencyName}
                    </span>
                  </div>
                  {selectedOrder.waitingPartsDetails && (
                    <div className="flex justify-between items-start gap-2 text-sky-900 bg-sky-50 px-2 py-1.5 rounded-lg border border-sky-200">
                      <span className="shrink-0 font-bold">انتظار القطع:</span>
                      <strong className="text-left">
                        {selectedOrder.waitingPartsDetails}
                        {selectedOrder.waitingPartsExpectedDate ? ` (${selectedOrder.waitingPartsExpectedDate})` : ''}
                      </strong>
                    </div>
                  )}
                  {selectedOrder.customVariables && selectedOrder.customVariables.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {selectedOrder.customVariables.map((cv, idx) => (
                        <span key={`${cv.key}-${idx}`} className="text-[10px] bg-violet-50 text-violet-900 border border-violet-200 px-1.5 py-0.5 rounded-md font-bold">
                          {cv.label}: {cv.value}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span>الفني المسؤول:</span>
                    <strong className="text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200/50">{selectedOrder.technician}</strong>
                  </div>
                </div>
              </div>

              {/* Real Delivery summary info if DELIVERED */}
              {selectedOrder.status === DeviceStatus.DELIVERED && selectedOrder.deliveryInfo && (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-xs font-sans text-emerald-900 space-y-1.5 animate-in slide-in-from-top-2">
                  <h5 className="font-extrabold text-emerald-950 flex items-center gap-1 border-b border-emerald-200/60 pb-1.5">
                    <span>🎁 تم الاستلام الفعلي بنجاح</span>
                  </h5>
                  <p>المستلم: <strong>{selectedOrder.deliveryInfo.recipientName}</strong></p>
                  <p>صلة القرابة: <strong>{selectedOrder.deliveryInfo.relationToCustomer}</strong></p>
                  <p>تاريخ التسليم: <span className="font-mono">{new Date(selectedOrder.deliveryInfo.deliveryDate).toLocaleString('ar-SA')}</span></p>
                </div>
              )}
            </div>

            {/* Column 2: Status updates and Timeline */}
            <div className="space-y-4">
              <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100/80 space-y-3">
                <h4 className="font-sans font-extrabold text-gray-800 text-xs border-b border-gray-200/60 pb-2 flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5 text-teal-600" />
                  تحديث مرحلة الإصلاح وحالة الجهاز:
                </h4>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {Object.values(DeviceStatus).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      disabled={selectedOrder.status === status || !canEdit}
                      className={`py-2 px-1 text-[10px] md:text-xs font-sans font-bold rounded-xl border transition-all ${
                        selectedOrder.status === status
                          ? 'bg-teal-600 text-white border-teal-700 '
                          : 'bg-white hover:bg-gray-100 text-gray-750 border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed'
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
                  ))}
                </div>
              </div>

              {/* Status History Timeline */}
              {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                  <h4 className="font-sans font-extrabold text-gray-800 text-xs border-b border-gray-200/60 pb-2 flex items-center gap-1">
                    <History className="w-3.5 h-3.5 text-teal-600" />
                    سجل تتبع الحالات (Timeline):
                  </h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {selectedOrder.statusHistory.map((history, idx) => (
                      <div key={idx} className="relative pl-4 border-r-2 border-teal-100 pr-3">
                        <div className="absolute -right-[5px] top-1.5 w-2 h-2 rounded-full bg-teal-500 ring-2 ring-white"></div>
                        <div className="flex justify-between items-start mb-0.5">
                          <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded">
                            {getStatusArabicLabel(history.status)}
                          </span>
                          <span className="text-[9px] text-gray-400 font-mono">
                            {new Date(history.timestamp).toLocaleString('ar-SA')}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-600 leading-relaxed">{history.note}</p>
                        <StatusSnapshotBadges snapshot={history.snapshot} compact />
                        <p className="text-[9px] text-gray-400 mt-1">بواسطة: {history.updatedBy}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Column 3: Past devices history */}
            <div className="space-y-4">
              {/* Past Repair history inside the dashboard details panel */}
              <div className="bg-gray-50/55 p-4 rounded-2xl border border-gray-100/80 space-y-2">
                <h4 className="font-sans font-extrabold text-gray-800 text-xs border-b border-gray-200/60 pb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-teal-600" />
                  سجل الأجهزة السابقة للعميل ({selectedCustomerHistory.length}):
                </h4>
                
                {selectedCustomerHistory.length === 0 ? (
                  <p className="text-gray-400 text-[10px] bg-white p-2.5 rounded-xl text-center border border-gray-100/50">
                    هذا هو أول جهاز صيانة مسجل لهذا العميل في النظام.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {selectedCustomerHistory.map((pastOrder) => (
                      <div 
                        key={pastOrder.id}
                        onClick={() => {
                          setSelectedOrder(pastOrder);
                          setStatusNote(''); // Reset update note
                        }}
                        className="p-2 bg-white hover:bg-teal-50/40 border border-gray-100 hover:border-teal-100 rounded-xl transition-all cursor-pointer text-[10px] font-sans flex flex-col gap-0.5 text-right"
                        title="اضغط للذهاب وتفحص هذا الطلب"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-teal-600 bg-gray-50 px-1.5 py-0.5 rounded text-[9px]">
                            {pastOrder.id}
                          </span>
                          <span className="scale-90 origin-left">
                            {getStatusBadge(pastOrder.status)}
                          </span>
                        </div>
                        <div className="font-bold text-gray-800 text-[10px]">
                          جهاز {pastOrder.deviceType} • {pastOrder.brandModel}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Visual Maintenance & Fault Camera Documentation Section */}
          <div className="border-t border-gray-200 pt-5 mt-2 bg-gradient-to-b from-gray-50/50 to-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-2xs">
            <MaintenanceMediaGallery
              photos={selectedOrder.photos || []}
              orderId={selectedOrder.id}
              customerName={selectedOrder.customerName}
              customerPhone={selectedOrder.customerPhone}
              deviceModel={`${selectedOrder.deviceType} ${selectedOrder.brandModel}`}
              canEdit={canEdit}
              onAddPhotoClick={() => {
                setCameraModalTarget({
                  orderId: selectedOrder.id,
                  customerName: selectedOrder.customerName,
                  deviceModel: `${selectedOrder.deviceType} ${selectedOrder.brandModel}`,
                  defaultStage: selectedOrder.status === DeviceStatus.RECEIVED ? 'fault_initial' : 'disassembly'
                });
              }}
              onDeletePhoto={(photoId) => {
                const updatedPhotos = (selectedOrder.photos || []).filter(p => p.id !== photoId);
                const updatedOrder: MaintenanceOrder = {
                  ...selectedOrder,
                  photos: updatedPhotos,
                  updatedAt: Date.now()
                };
                onSaveOrder(updatedOrder);
                setSelectedOrder(updatedOrder);
              }}
            />
          </div>

        </div>
      ) : null}

      </>
    );
  };
  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Top action block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-100 ">
        <div>
          <h2 className="font-sans font-extrabold text-xl text-gray-800 flex items-center gap-2">
            <span>{viewType === 'completed' ? 'الأجهزة المكتملة' : 'الطلبات الحالية'}</span>
            <span className="px-2.5 py-0.5 bg-teal-50 text-teal-700 text-xs rounded-lg font-bold">
              {filteredOrders.length} طلب صيانة
            </span>
          </h2>
        </div>
      </div>



      {/* Complete Maintenance Details Panel & Controls (Moved to Top of Table) */}

      {/* Complete Maintenance Details Panel & Controls (Moved to Top of Table) */}
      <div className="hidden md:block">
        {renderDetailPanel()}
      </div>
    
      {/* Main filters and list container (Occupies full-width now!) */}
      <div className="space-y-4">
        
        {/* Filters card */}
        <div className="bg-white rounded-3xl border border-gray-100 p-4  flex flex-col md:flex-row gap-4 items-center">
          
          {/* Search Input */}
          <div className="relative w-full md:flex-1 flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="ابحث باسم العميل، الهاتف، الموديل أو رقم الطلب..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 pr-11 pl-12 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-gray-800"
              />
              <Search className="absolute right-4 top-3.5 text-gray-400 w-4 h-4" />
              <button
                type="button"
                onClick={onScanClick}
                className="absolute left-2 top-2 bg-gray-900 hover:bg-black text-white p-1.5 rounded-xl transition-colors "
                title="مسح الباركود بالكاميرا"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status dropdown filter */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 md:flex-initial bg-gray-50 border border-gray-200 rounded-2xl py-2.5 px-4 text-xs font-sans text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
            >
              <option value="all">كل حالات الأجهزة</option>
              {(viewType === 'all' || viewType === 'active') && (
                <>
                  <option value={DeviceStatus.RECEIVED}>تم الاستلام</option>
                  <option value={DeviceStatus.DIAGNOSING}>تحت الفحص</option>
                  <option value={DeviceStatus.REPAIRING}>تحت الإصلاح</option>
                  <option value={DeviceStatus.PENDING}>قيد الانتظار</option>
                  <option value={DeviceStatus.READY}>جاهز للتسليم</option>
                </>
              )}
              {(viewType === 'all' || viewType === 'completed') && (
                <>
                  <option value={DeviceStatus.DELIVERED}>تم التسليم بنجاح</option>
                  <option value={DeviceStatus.UNREPAIRABLE}>غير قابل للإصلاح</option>
                </>
              )}
            </select>

            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="flex-1 md:flex-initial bg-gray-50 border border-gray-200 rounded-2xl py-2.5 px-4 text-xs font-sans text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
            >
              <option value="all">كل أنواع الأجهزة</option>
              {uniqueDevices.map(device => (
                <option key={device} value={device}>{device}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Orders list card */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-16 text-center text-gray-400">
            <span className="text-4xl block mb-2">📦🔍</span>
            <p className="font-sans text-sm font-bold text-gray-700">لا توجد طلبات صيانة مطابقة للبحث!</p>
            <p className="font-sans text-xs text-gray-400 mt-1">امسح الفلاتر أو جرب كتابة معيار بحث مختلف.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden ">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 font-sans font-bold text-xs border-b border-gray-100">
                    <th className="py-4 px-6">رقم الطلب</th>
                    <th className="py-4 px-6">العميل</th>
                    <th className="py-4 px-6">الجهاز والموديل</th>
                    <th className="py-4 px-6">التكلفة المتوقعة</th>
                    <th className="py-4 px-6">موعد الاستلام</th>
                    <th className="py-4 px-6">الحالة</th>
                    <th className="py-4 px-6">المسؤول</th>
                    <th className="py-4 px-4 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-sans text-xs text-gray-700">
                  {filteredOrders.map((order) => (
                    <tr 
                      key={order.id} 
                      onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                      className={`cursor-pointer transition-colors ${
                        selectedOrder?.id === order.id ? 'bg-teal-50/50 hover:bg-teal-50' : 'hover:bg-gray-50/50'
                      }`}
                    >
                      <td className="py-4 px-6 font-mono font-extrabold text-teal-600">{order.id}</td>
                      <td className="py-4 px-6">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewCustomer?.(order.customerName, order.customerPhone);
                          }}
                          className="font-bold text-gray-950 hover:text-teal-700 hover:underline cursor-pointer transition-colors text-right block"
                          title="عرض ملف وسجل العميل وتقارير الصيانة والرسائل"
                        >
                          {order.customerName}
                        </button>
                        <div className="text-[10px] text-gray-400 mt-0.5 font-mono flex items-center gap-1.5 flex-wrap">
                          <span dir="ltr">{order.customerPhone}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-semibold">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md text-[10px] mr-1">
                          {order.deviceType}
                        </span>
                        {order.brandModel}
                      </td>
                      <td className="py-4 px-6 font-bold text-gray-800">
                        {getOrderFinancials(order, currencyName).totalCost} {order.currency || currencyName}
                      </td>
                      <td className="py-4 px-6 text-gray-500">
                        {formatSafeDate(order.expectedDeliveryDate)}
                      </td>
                      <td className="py-4 px-6">{getStatusBadge(order.status)}</td>
                      <td className="py-4 px-6 text-gray-400">{order.technician}</td>
                      <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(order.id)}
                          className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="حذف هذا الطلب نهائياً"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredOrders.map((order) => (
                <div 
                  key={order.id} 
                  onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                  className={`p-4 cursor-pointer transition-all duration-200 ${
                    selectedOrder?.id === order.id ? 'bg-teal-50/50 hover:bg-teal-50' : 'bg-white hover:bg-gray-50/50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2.5">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewCustomer?.(order.customerName, order.customerPhone);
                        }}
                        className="font-bold text-gray-900 hover:text-teal-700 hover:underline text-sm leading-tight cursor-pointer transition-colors text-right block mb-1.5"
                        title="عرض ملف وسجل العميل وتقارير الصيانة والرسائل"
                      >
                        {order.customerName}
                      </button>
                      <span className="font-mono font-extrabold text-teal-700 text-[11px] bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-lg inline-block">
                        {order.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(order.status)}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(order.id);
                        }}
                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="حذف هذا الطلب نهائياً"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-[11px] text-gray-500 mb-3 px-1">
                    <div className="font-mono flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                      {order.customerPhone}
                    </div>
                    <div className="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      {formatSafeDate(order.expectedDeliveryDate)}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 border border-gray-100/60 rounded-2xl p-3 flex justify-between items-center ">
                    <div className="flex flex-col gap-1">
                      <div className="text-[10px] text-gray-400 font-medium">الجهاز والموديل</div>
                      <div className="font-semibold text-gray-800 text-xs flex items-center gap-1.5 flex-wrap">
                        <span className="bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded-md text-[10px] ">
                          {order.deviceType}
                        </span>
                        <span>{order.brandModel}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end shrink-0 pl-1">
                      <div className="text-[10px] text-gray-400 font-medium">التكلفة</div>
                      <div className="font-bold text-teal-700 text-sm">
                        {getOrderFinancials(order, currencyName).totalCost} <span className="text-[10px] font-normal">{order.currency || currencyName}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Accordion Panel for Mobile */}
                  {selectedOrder?.id === order.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100 cursor-default" onClick={(e) => e.stopPropagation()}>
                      {renderDetailPanel()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showSimplePrintLabel && (
        <LabelPrintView
          orderId={showSimplePrintLabel.id}
          qrContent={getOrderQrContent(showSimplePrintLabel, 520)}
          onClose={() => setShowSimplePrintLabel(null)}
        />
      )}

      {/* 1. Print label/thermal barcode popup mockup */}
      {showPrintLabel && (() => {
        const [pWidth, pHeight] = FIXED_LABEL_PAPER_SIZE.split('x').map(Number);
        const wMm = `${pWidth || 38}mm`;
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center p-2 pt-1 sm:pt-2 overflow-y-auto">
          <div className={`bg-white rounded-3xl ${showFullLabelDesignerInModal ? 'max-w-4xl' : 'max-w-md'} w-full overflow-hidden shadow-2xl border border-gray-200 p-6 space-y-5 animate-in slide-in-from-top-2 duration-150 mb-4 text-right transition-all`} dir="rtl">
            <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="font-sans font-extrabold text-teal-900 text-base flex items-center gap-2 justify-start">
                  <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-teal-50 text-teal-600">
                    <Printer className="w-4 h-4" />
                  </span>
                  <span>معاينة وتنسيق ملصق الباركود</span>
                </h3>
                <p className="text-gray-400 text-[10px] font-sans mt-0.5">معاينة تفصيلية حية للمظهر النهائي للملصق مع إمكانية تحريك وتعديل المحتويات</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFullLabelDesignerInModal(!showFullLabelDesignerInModal)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                    showFullLabelDesignerInModal 
                      ? 'bg-teal-600 text-white border-teal-600' 
                      : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>{showFullLabelDesignerInModal ? 'معاينة الطباعة' : 'تخصيص الملصق 🎨'}</span>
                </button>
                <button 
                  onClick={() => {
                    setShowPrintLabel(null);
                    setIsDirectPrinting(false);
                    setDirectPrintMessage(null);
                    setShowFullLabelDesignerInModal(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold font-sans transition-colors p-1"
                >
                  إغلاق ×
                </button>
              </div>
            </div>

            {showFullLabelDesignerInModal ? (
              <div className="animate-in fade-in duration-200">
                <LabelDesigner 
                  mockOrder={{
                    id: showPrintLabel.id,
                    customerName: showPrintLabel.customerName,
                    customerPhone: showPrintLabel.customerPhone,
                    brandModel: showPrintLabel.brandModel,
                    faultDescription: showPrintLabel.faultDescription,
                    estimatedCost: showPrintLabel.estimatedCost,
                    actualCost: showPrintLabel.actualCost,
                    currency: showPrintLabel.currency,
                    createdAt: showPrintLabel.createdAt
                  }}
                  onLayoutChange={(newCfg) => setLabelModalLayout(newCfg)}
                />
              </div>
            ) : (
              <>
                {/* Print Preview Workspace */}
                <div className="p-5 bg-slate-50 border border-gray-200/80 rounded-2xl flex flex-col items-center justify-center space-y-3 relative overflow-hidden bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:12px_12px]">
                  <div className="w-full flex items-center justify-between text-[10px] text-slate-600 font-bold select-none">
                    <span>معاينة مطابقة للطباعة</span>
                    <span className="font-mono text-teal-800">{pWidth || 38}×{pHeight || 25}mm</span>
                  </div>
                  
                  {(() => {
                    const effectiveLayout: LabelLayoutConfig = {
                      ...labelModalLayout,
                      paperSize: FIXED_LABEL_PAPER_SIZE
                    };
                    const previewMetrics = getLabelPreviewMetrics(effectiveLayout.paperSize, 250, 200, false);
                    const containerStyles = getLabelContainerStyles(effectiveLayout, lblFormat.fontFamily);
                    const activeElements = effectiveLayout.elements.filter(el => el.enabled);
                    const splitMetrics = getSplitThermalLabelMetrics(effectiveLayout, containerStyles, activeElements);
                    const barcodeActiveEl = activeElements.find(el => el.id === 'barcode');
                    const qrActiveEl = activeElements.find(el => el.id === 'qr_code');
                    const infoElements = splitMetrics.hasQrSide
                      ? activeElements.filter(el => el.id !== 'qr_code')
                      : activeElements;
                    const centerNameText = localStorage.getItem('centerName') || 'مركز تكنو للصيانة';
                    const centerMobileText = localStorage.getItem('centerMobile') || '05xxxxxxxx';

                    const handleDragStart = (id: string, e: React.DragEvent) => {
                      e.dataTransfer.setData('text/plain', id);
                      setDraggedModalId(id);
                    };

                    const handleDragOver = (id: string, e: React.DragEvent) => {
                      e.preventDefault();
                      if (dragOverModalId !== id) {
                        setDragOverModalId(id);
                      }
                    };

                    const handleDrop = (targetId: string, e: React.DragEvent) => {
                      e.preventDefault();
                      const sourceId = e.dataTransfer.getData('text/plain') || draggedModalId;
                      if (!sourceId || sourceId === targetId) {
                        setDraggedModalId(null);
                        setDragOverModalId(null);
                        return;
                      }

                      const fromIdx = labelModalLayout.elements.findIndex(el => el.id === sourceId);
                      const toIdx = labelModalLayout.elements.findIndex(el => el.id === targetId);
                      if (fromIdx !== -1 && toIdx !== -1) {
                        const reordered = reorderElements(labelModalLayout.elements, fromIdx, toIdx);
                        const updated = { ...labelModalLayout, elements: reordered };
                        setLabelModalLayout(updated);
                        saveStoredLabelLayout(updated);
                      }
                      setDraggedModalId(null);
                      setDragOverModalId(null);
                    };

                    return (
                      <>
                        {/* Simulated Cut Line Top */}
                        <div className="w-full max-w-[260px] flex items-center justify-between text-slate-400 text-[8px] font-mono border-b border-dashed border-slate-300 pb-1 select-none">
                          <span>✂️ حد قطع الورق العلوي</span>
                          <span>×{previewMetrics.scale.toFixed(2)}</span>
                        </div>

                        {/* Scaled Physical Sticker Viewport */}
                        <div
                          className="relative mx-auto"
                          style={{
                            width: `${previewMetrics.scaledWidthPx}px`,
                            height: `${previewMetrics.scaledHeightPx}px`,
                            maxWidth: '100%'
                          }}
                        >
                          <div
                            dir="rtl"
                            className="bg-white ring-1 ring-gray-300 rounded-sm select-none overflow-hidden shadow-xs"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: `${containerStyles.widthMm}mm`,
                              height: `${containerStyles.heightMm}mm`,
                              maxWidth: `${containerStyles.widthMm}mm`,
                              maxHeight: `${containerStyles.heightMm}mm`,
                              padding: `${splitMetrics.effectivePaddingMm}mm`,
                              display: 'flex',
                              flexDirection: splitMetrics.hasQrSide ? 'row' : 'column',
                              alignItems: 'center',
                              justifyContent: splitMetrics.hasQrSide && infoElements.length > 0 ? 'space-between' : 'center',
                              gap: splitMetrics.hasQrSide && infoElements.length > 0 ? `${splitMetrics.colGapMm}mm` : '0',
                              boxSizing: 'border-box',
                              color: '#000000',
                              fontFamily: containerStyles.fontFamilyCss,
                              textAlign: containerStyles.textAlign,
                              transform: `scale(${previewMetrics.scale})`,
                              transformOrigin: 'top left'
                            }}
                            id="thermal-label-print-area"
                          >
                            {(!splitMetrics.hasQrSide || infoElements.length > 0) && (
                            <div
                              className={splitMetrics.hasQrSide ? 'flex-1 min-w-0 h-full flex flex-row items-center justify-center overflow-hidden' : 'w-full flex flex-col justify-center'}
                              style={{
                                alignItems: splitMetrics.hasQrSide ? 'center' : containerStyles.alignItems,
                                textAlign: splitMetrics.hasQrSide ? 'center' : containerStyles.textAlign,
                                gap: splitMetrics.hasQrSide ? `${splitMetrics.verticalColGapMm}mm` : undefined,
                              }}
                            >
                              {infoElements.map((el) => {
                                const isBeingDragged = draggedModalId === el.id;
                                const isOver = dragOverModalId === el.id;
                                const elMetrics = getLabelElementMetrics(el, effectiveLayout);
                                const baseFontPt = splitMetrics.compactFontPt ?? Math.min(elMetrics.fontSizePt, splitMetrics.isNarrowWidth ? 8 : 11);
                                const mTopMm = splitMetrics.isCompactHeight ? 0 : Math.min(elMetrics.marginTopMm, 0.4);
                                const mBotMm = splitMetrics.isCompactHeight ? 0.2 : Math.min(elMetrics.marginBottomMm, 0.5);
                                const orderDateStr = showPrintLabel.createdAt ? new Date(showPrintLabel.createdAt).toLocaleDateString('ar-SA') : new Date().toLocaleDateString('ar-SA');

                                return (
                                  <div
                                    key={el.id}
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(el.id, e)}
                                    onDragOver={(e) => handleDragOver(el.id, e)}
                                    onDragLeave={() => setDragOverModalId(prev => prev === el.id ? null : prev)}
                                    onDrop={(e) => handleDrop(el.id, e)}
                                    onDragEnd={() => {
                                      setDraggedModalId(null);
                                      setDragOverModalId(null);
                                    }}
                                    className={`${splitMetrics.hasQrSide ? (el.id === 'barcode' ? 'h-full flex items-center justify-center shrink-0' : 'max-h-full') : 'w-fit max-w-full'} cursor-grab active:cursor-grabbing ${
                                      isBeingDragged ? 'opacity-30' : ''
                                    } ${isOver ? 'outline outline-1 outline-teal-500 bg-teal-100/40' : 'hover:outline hover:outline-1 hover:outline-teal-400 hover:bg-teal-50/20'}`}
                                    style={splitMetrics.hasQrSide ? (el.id === 'barcode' ? {
                                      margin: 0,
                                      height: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      boxSizing: 'border-box',
                                    } : {
                                      writingMode: 'vertical-rl',
                                      textOrientation: 'mixed',
                                      margin: 0,
                                      textAlign: 'center',
                                      boxSizing: 'border-box',
                                    }) : {
                                      marginTop: `${mTopMm}mm`,
                                      marginBottom: `${mBotMm}mm`,
                                      textAlign: containerStyles.textAlign,
                                      alignSelf: containerStyles.alignItems,
                                      boxSizing: 'border-box'
                                    }}
                                    title="اسحب هذا العنصر بالماوس لتحريكه وتغيير موضعه"
                                  >
                                    {el.id === 'center_name' && (
                                      <div
                                        dir="auto"
                                        className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full truncate'} text-black font-black`}
                                        style={{
                                          fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalCenterNameFontPt(centerNameText) : splitMetrics.getCenterNameFontPt(centerNameText, baseFontPt)}pt`,
                                          fontWeight: 900,
                                          letterSpacing: splitMetrics.hasQrSide ? '0px' : '-0.25px',
                                          lineHeight: 1
                                        }}
                                      >
                                        {centerNameText}
                                      </div>
                                    )}

                                    {el.id === 'center_mobile' && (
                                      <div
                                        dir="ltr"
                                        className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden' : 'max-w-full whitespace-nowrap'} text-black tabular-nums`}
                                        style={{
                                          fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalMobileFontPt(centerMobileText) : splitMetrics.getCenterMobileFontPt(centerMobileText, baseFontPt)}pt`,
                                          fontWeight: splitMetrics.hasQrSide ? 900 : (el.bold ? 700 : 600),
                                          fontFamily: "system-ui, -apple-system, 'Cairo', sans-serif",
                                          letterSpacing: splitMetrics.hasQrSide ? '0px' : '-0.1px',
                                          lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing
                                        }}
                                      >
                                        {centerMobileText}
                                      </div>
                                    )}

                                    {el.id === 'customer_name' && (
                                      <div
                                        dir="auto"
                                        className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full truncate'} text-black`}
                                        style={{
                                          fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalInfoFontPt(`العميل: ${showPrintLabel.customerName}`) : baseFontPt}pt`,
                                          fontWeight: el.bold ? 800 : 600,
                                          lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing
                                        }}
                                      >
                                        العميل: {showPrintLabel.customerName}
                                      </div>
                                    )}

                                    {el.id === 'device_model' && (
                                      <div
                                        dir="auto"
                                        className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full truncate'} text-black`}
                                        style={{
                                          fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalInfoFontPt(`الجهاز: ${showPrintLabel.brandModel}`) : baseFontPt}pt`,
                                          fontWeight: el.bold ? 800 : 600,
                                          lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing
                                        }}
                                      >
                                        الجهاز: {showPrintLabel.brandModel}
                                      </div>
                                    )}

                                    {el.id === 'order_date' && (
                                      <div
                                        dir="auto"
                                        className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full truncate'} text-black`}
                                        style={{
                                          fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalInfoFontPt(`التاريخ: ${orderDateStr}`) : baseFontPt}pt`,
                                          fontWeight: el.bold ? 700 : 400,
                                          lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing
                                        }}
                                      >
                                        التاريخ: {orderDateStr}
                                      </div>
                                    )}

                                    {el.id === 'barcode' && (
                                      splitMetrics.hasQrSide ? (() => {
                                        const spec = getVerticalOrderIdSvgSpec(showPrintLabel.id, splitMetrics);
                                        return (
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width={`${spec.widthMm}mm`}
                                            height={`${spec.heightMm}mm`}
                                            viewBox={`0 0 ${spec.viewBoxWidth} ${spec.viewBoxHeight}`}
                                            style={{ width: `${spec.widthMm}mm`, height: `${spec.heightMm}mm`, display: 'block', flexShrink: 0, overflow: 'visible' }}
                                          >
                                            <text
                                              x={spec.cx}
                                              y={spec.cy}
                                              dy={spec.dyUnits}
                                              transform={`rotate(90 ${spec.cx} ${spec.cy})`}
                                              textAnchor="middle"
                                              textLength={spec.textLengthUnits}
                                              lengthAdjust={spec.textLengthUnits ? 'spacingAndGlyphs' : undefined}
                                              fill="#000000"
                                              fontFamily="system-ui, -apple-system, 'Cairo', Arial, sans-serif"
                                              fontSize={spec.fontSizeUnits}
                                              fontWeight={900}
                                              style={{ fontVariantNumeric: 'tabular-nums' }}
                                            >
                                              {spec.code}
                                            </text>
                                          </svg>
                                        );
                                      })() : (
                                        <div
                                          dir="ltr"
                                          className="max-w-full whitespace-nowrap font-black text-black tabular-nums"
                                          style={{
                                            fontSize: `${splitMetrics.getCodeFontPt(showPrintLabel.id, baseFontPt)}pt`,
                                            fontFamily: "system-ui, -apple-system, 'Cairo', sans-serif",
                                            fontVariantNumeric: 'tabular-nums',
                                            letterSpacing: '-0.2px',
                                            lineHeight: 1
                                          }}
                                        >
                                          {showPrintLabel.id}
                                        </div>
                                      )
                                    )}

                                    {el.id === 'custom_text' && (
                                      <div
                                        dir="auto"
                                        className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full break-words'} text-black`}
                                        style={{
                                          fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalInfoFontPt(el.customContent || localStorage.getItem('lblCustomText') || 'يرجى إبراز هذا الملصق عند الاستلام') : baseFontPt}pt`,
                                          fontWeight: el.bold ? 700 : 500,
                                          lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing,
                                          textAlign: splitMetrics.hasQrSide ? 'center' : containerStyles.textAlign
                                        }}
                                      >
                                        {el.customContent || localStorage.getItem('lblCustomText') || 'يرجى إبراز هذا الملصق عند الاستلام'}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            )}

                            {splitMetrics.hasQrSide && (
                              <div className="shrink-0 h-full flex flex-col items-center justify-center bg-white gap-0.5">
                                {barcodeActiveEl && (() => {
                                  const m = getLabelElementMetrics(barcodeActiveEl, effectiveLayout);
                                  return (
                                    <BarcodeGenerator
                                      value={showPrintLabel.id}
                                      qrContent={getOrderQrContent(showPrintLabel, 520)}
                                      width={barcodeActiveEl.width || 1.2}
                                      height={m.barcodeHeightPx}
                                      physicalHeightMm={m.barcodeHeightMm}
                                      targetQrMm={splitMetrics.splitQrSizeMm}
                                      showText={false}
                                      format={localStorage.getItem('lblBarcodeFormat') || 'AUTO'}
                                      maxWidthMm={splitMetrics.effectiveInnerWidthMm}
                                      marginModules={0}
                                    />
                                  );
                                })()}
                                {qrActiveEl && (() => {
                                  const m = getLabelElementMetrics(qrActiveEl, effectiveLayout);
                                  return (
                                    <QRCodeGenerator
                                      value={buildTrackingUrl(showPrintLabel.id, appUrl)}
                                      size={m.qrSizePx}
                                      compact={true}
                                      physicalSizeMm={splitMetrics.splitQrSizeMm || Math.max(m.qrSizeMm, 11)}
                                      marginModules={0}
                                    />
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Simulated Cut Line Bottom */}
                        <div className="w-full max-w-[260px] flex items-center justify-between text-slate-400 text-[8px] font-mono border-t border-dashed border-slate-300 pt-1 select-none">
                          <span>✂️ حد قطع الورق السفلي</span>
                          <span>{containerStyles.widthMm} × {containerStyles.heightMm} mm</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Quick Mouse Dragging & Reordering Toolbar */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-gray-100 text-right space-y-3 font-sans">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[11px] text-teal-950 flex items-center gap-1.5">
                      <span>⠿ تحريك وإعادة ترتيب محتويات الملصق:</span>
                    </span>
                    <span className="text-[9px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-bold">
                      اسحب بالماوس أو استخدم الأسهم
                    </span>
                  </div>

                  {/* Active elements list */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {labelModalLayout.elements.filter(e => e.enabled).map((el, idx, arr) => (
                      <div
                        key={el.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', el.id);
                          setDraggedModalId(el.id);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverModalId !== el.id) setDragOverModalId(el.id);
                        }}
                        onDragLeave={() => setDragOverModalId(prev => prev === el.id ? null : prev)}
                        onDrop={(e) => {
                          e.preventDefault();
                          const src = e.dataTransfer.getData('text/plain') || draggedModalId;
                          if (!src || src === el.id) {
                            setDraggedModalId(null);
                            setDragOverModalId(null);
                            return;
                          }
                          const fIdx = labelModalLayout.elements.findIndex(x => x.id === src);
                          const tIdx = labelModalLayout.elements.findIndex(x => x.id === el.id);
                          if (fIdx !== -1 && tIdx !== -1) {
                            const reordered = reorderElements(labelModalLayout.elements, fIdx, tIdx);
                            const updated = { ...labelModalLayout, elements: reordered };
                            setLabelModalLayout(updated);
                            saveStoredLabelLayout(updated);
                          }
                          setDraggedModalId(null);
                          setDragOverModalId(null);
                        }}
                        onDragEnd={() => {
                          setDraggedModalId(null);
                          setDragOverModalId(null);
                        }}
                        className={`flex items-center justify-between p-2 bg-white rounded-xl border transition-all text-xs ${
                          draggedModalId === el.id ? 'opacity-40' : 'border-gray-200 hover:border-teal-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-teal-700">
                            <GripVertical className="w-3.5 h-3.5" />
                          </span>
                          <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-600 text-[10px] font-mono font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-[11px] text-gray-800">{el.label}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Move up */}
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              const fromIndex = labelModalLayout.elements.findIndex(x => x.id === el.id);
                              const prevEl = arr[idx - 1];
                              const toIndex = labelModalLayout.elements.findIndex(x => x.id === prevEl.id);
                              const reordered = reorderElements(labelModalLayout.elements, fromIndex, toIndex);
                              const updated = { ...labelModalLayout, elements: reordered };
                              setLabelModalLayout(updated);
                              saveStoredLabelLayout(updated);
                            }}
                            className="p-1 rounded hover:bg-teal-50 text-gray-400 hover:text-teal-700 disabled:opacity-20"
                            title="تحريك لأعلى"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>

                          {/* Move down */}
                          <button
                            type="button"
                            disabled={idx === arr.length - 1}
                            onClick={() => {
                              const fromIndex = labelModalLayout.elements.findIndex(x => x.id === el.id);
                              const nextEl = arr[idx + 1];
                              const toIndex = labelModalLayout.elements.findIndex(x => x.id === nextEl.id);
                              const reordered = reorderElements(labelModalLayout.elements, fromIndex, toIndex);
                              const updated = { ...labelModalLayout, elements: reordered };
                              setLabelModalLayout(updated);
                              saveStoredLabelLayout(updated);
                            }}
                            className="p-1 rounded hover:bg-teal-50 text-gray-400 hover:text-teal-700 disabled:opacity-20"
                            title="تحريك لأسفل"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>

                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = {
                                ...labelModalLayout,
                                elements: labelModalLayout.elements.map(x => x.id === el.id ? { ...x, enabled: false } : x)
                              };
                              setLabelModalLayout(updated);
                              saveStoredLabelLayout(updated);
                            }}
                            className="p-1 rounded hover:bg-rose-50 text-rose-400 hover:text-rose-600 ml-0.5"
                            title="إزالة من الملصق"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add back inactive items */}
                  {labelModalLayout.elements.some(e => !e.enabled) && (
                    <div className="pt-2 border-t border-gray-200/60 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-gray-500 font-bold">إضافة عنصر:</span>
                      {labelModalLayout.elements.filter(e => !e.enabled).map(el => (
                        <button
                          key={el.id}
                          type="button"
                          onClick={() => {
                            const updated = {
                              ...labelModalLayout,
                              elements: labelModalLayout.elements.map(x => x.id === el.id ? { ...x, enabled: true } : x)
                            };
                            setLabelModalLayout(updated);
                            saveStoredLabelLayout(updated);
                          }}
                          className="px-2 py-0.5 bg-white hover:bg-teal-50 border border-gray-200 text-teal-800 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>{el.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Spacing control in modal */}
                  <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[10px]">
                    <span className="font-bold text-gray-700">المسافة بين المحتويات:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.7"
                        max="2.0"
                        step="0.1"
                        value={labelModalLayout.lineSpacing}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          const updated = { ...labelModalLayout, lineSpacing: val };
                          setLabelModalLayout(updated);
                          saveStoredLabelLayout(updated);
                        }}
                        className="w-24 accent-teal-600 h-1 bg-gray-200 rounded"
                      />
                      <span className="font-mono font-bold text-teal-700">{labelModalLayout.lineSpacing}x</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Active Printer Status info block */}
            {(() => {
              const isSelectEnabled = localStorage.getItem('allow_select_printer_on_print') !== 'false';
              const labelPrinter = getSelectedLabelPrinter();
              const currentDefaultId = availablePrinters.find(p => p.isDefaultLabels)?.id || 'p-default';
              const isDefault = labelPrinter.id === currentDefaultId;

              return (
                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-right text-[11px] font-sans space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-700 flex items-center gap-1">
                      <Printer className="w-3.5 h-3.5 text-teal-600" />
                      {isSelectEnabled ? 'اختر طابعة الباركود:' : 'طابعة الباركود النشطة:'}
                    </span>
                    <span className="text-[9px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-bold">
                      {labelPrinter.type === 'wifi_lan' ? 'واي فاي/شبكة' : labelPrinter.type === 'bluetooth' ? 'بلوتوث' : 'النظام'}
                    </span>
                  </div>

                  {isSelectEnabled ? (
                    <div className="space-y-1.5">
                      <select
                        value={selectedLabelPrinterId || 'p-default'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedLabelPrinterId(val);
                        }}
                        className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-right font-sans"
                      >
                        <option value="p-default">طابعة النظام الافتراضية (عبر المتصفح)</option>
                        {availablePrinters.filter(p => p.id !== 'p-default').map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>

                      {!isDefault && (
                        <button
                          type="button"
                          onClick={() => makePrinterDefault(selectedLabelPrinterId || 'p-default', 'isDefaultLabels')}
                          className="text-[9px] text-teal-700 font-extrabold hover:text-teal-800 flex items-center gap-1 justify-start font-sans cursor-pointer"
                        >
                          <span>📌 تعيين الطابعة المحددة كافتراضية للملصقات</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-500 font-semibold truncate">{labelPrinter.name}</div>
                  )}

                  {labelPrinter.type === 'wifi_lan' && (
                    <div className="font-mono text-[9px] text-gray-400" dir="ltr">{labelPrinter.ipAddress}:{labelPrinter.port}</div>
                  )}
                </div>
              );
            })()}

            {directPrintMessage && (
              <div className="bg-teal-50 border border-teal-100/70 p-2.5 rounded-xl text-xs text-teal-800 text-right font-sans animate-bounce">
                {directPrintMessage}
              </div>
            )}

            {isInIframe && (
              <div className="bg-amber-50 border border-amber-200/70 p-2.5 rounded-xl text-[9px] text-amber-800 text-right font-sans space-y-1 leading-relaxed no-print">
                <div className="font-bold flex items-center gap-1 text-amber-950">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>تنبيه بيئة المعاينة (iFrame):</span>
                </div>
                <p>
                  يمنع المتصفح نوافذ الطباعة داخل بيئة المعاينة. للطباعة الناجحة، افتح البرنامج في نافذة جديدة:
                </p>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-800 font-bold underline text-[9.5px] no-print"
                >
                  فتح في نافذة مستقلة للطباعة ↗
                </a>
              </div>
            )}

            {/* Modal footer print and close buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => showPrintLabel && handlePrintLabelThermal(showPrintLabel)}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-sans font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5  active:scale-[0.98] duration-150"
              >
                <Printer className="w-4 h-4" />
                <span>تأكيد وطباعة الملصق الآن</span>
              </button>
              <button
                onClick={() => {
                  setShowPrintLabel(null);
                  setIsDirectPrinting(false);
                  setDirectPrintMessage(null);
                }}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-sans font-semibold rounded-xl text-xs transition-colors"
              >
                إلغلاق
              </button>
            </div>
          </div>
        </div>
      )})()}

      {/* Customer Claim Ticket Modal */}
      {showCustomerTicket && (() => {
        const activePaperSize = receiptModalLayout.paperSize || rcptSize || '80mm';
        const paperMetrics = getReceiptPaperMetrics(activePaperSize);
        return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center p-2 pt-1 sm:pt-2 overflow-y-auto">
          <div 
            id="customer-receipt-print-modal" 
            className={`bg-white rounded-3xl ${showFullReceiptDesignerInModal ? 'max-w-4xl' : 'max-w-xl'} w-full overflow-x-hidden shadow-2xl border border-gray-200 p-3.5 sm:p-6 space-y-4 sm:space-y-5 text-center animate-in slide-in-from-top-2 duration-150 mb-4 transition-all`}
            style={{
              fontFamily: receiptModalLayout.fontFamily || rcptFormat.fontFamily,
              textAlign: 'center',
              lineHeight: receiptModalLayout.lineSpacing || rcptFormat.lineHeight,
              fontSize: `${rcptFormat.fontSize}px`,
              fontWeight: rcptFormat.fontWeight === '900' ? 900 : rcptFormat.fontWeight === 'bold' ? 700 : 400
            }}
          >
            {/* Modal Header */}
            <div className="border-b border-gray-100 pb-3 flex flex-wrap justify-between items-center gap-2 no-print">
              <div className="text-right">
                <span className="font-sans text-[10px] text-teal-600 font-extrabold tracking-wide block">طباعة إيصال استلام الصيانة</span>
                <div className="font-sans font-extrabold text-xs text-gray-600 mt-0.5 flex items-center gap-1.5">
                  <span>قياس الورق:</span>
                  <span className="text-teal-700 font-bold">
                    {activePaperSize === '80mm' ? 'حراري 80mm' : 
                     activePaperSize === '58mm' ? 'حراري 58mm' : 
                     activePaperSize === 'A5' ? 'ورق A5' : 
                     'ورق A4'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFullReceiptDesignerInModal(!showFullReceiptDesignerInModal)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    showFullReceiptDesignerInModal 
                      ? 'bg-teal-600 text-white border-teal-600' 
                      : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>{showFullReceiptDesignerInModal ? 'معاينة الطباعة' : 'تخصيص وترتيب الإيصال 🎨'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowCustomerTicket(null);
                    setShowFullReceiptDesignerInModal(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 font-sans font-bold bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-xl transition-colors text-xs whitespace-nowrap"
                >
                  إغلاق ×
                </button>
              </div>
            </div>

            {showFullReceiptDesignerInModal ? (
              <div className="animate-in fade-in duration-200 text-right no-print">
                <ReceiptDesigner
                  mockOrder={{
                    id: showCustomerTicket.id,
                    customerName: showCustomerTicket.customerName,
                    customerPhone: showCustomerTicket.customerPhone,
                    deviceType: showCustomerTicket.deviceType,
                    brandModel: showCustomerTicket.brandModel,
                    faultDescription: showCustomerTicket.faultDescription,
                    estimatedCost: showCustomerTicket.estimatedCost,
                    advancePayment: showCustomerTicket.advancePayment,
                    createdAt: showCustomerTicket.createdAt
                  }}
                  onLayoutChange={(newLayout) => setReceiptModalLayout(newLayout)}
                />
              </div>
            ) : (
              /* Printable Receipt Sheet - responsive & tight-fit boxes */
              <div
                id="customer-receipt-sheet"
                className="w-full max-w-full mx-auto bg-[#FAF9F6]/70 border border-gray-200/80 rounded-2xl flex flex-col gap-2 transition-all"
                style={{
                  maxWidth: `${paperMetrics.screenMaxWidthPx}px`,
                  padding: `clamp(10px, ${(receiptModalLayout.padding || 6) * 2}px, 24px)`,
                  lineHeight: receiptModalLayout.lineSpacing || rcptFormat.lineHeight
                }}
              >
                {receiptModalLayout.elements
                  .filter((el) => el.enabled)
                  .map((el) => {
                    const alignClass = getReceiptAlignmentClass(el.textAlign);
                    return (
                      <div
                        key={el.id}
                        style={{
                          marginTop: `${el.marginTop ?? 0}px`,
                          marginBottom: `${el.marginBottom ?? 0}px`,
                          textAlign: el.textAlign || 'center'
                        }}
                        className={`w-fit max-w-full min-w-0 ${alignClass} transition-all`}
                      >
                        {el.id === 'header_logo' && (
                          localStorage.getItem('centerLogo') ? (
                            <div className="inline-flex justify-center max-w-full py-0.5">
                              <img
                                src={localStorage.getItem('centerLogo') || ''}
                                alt="Logo"
                                style={{ height: `${el.height || 48}px`, maxHeight: '120px' }}
                                className="max-w-full object-contain rounded-xl border border-gray-100"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className="inline-flex justify-center py-0.5">
                              <div className="p-2 bg-teal-600 rounded-xl text-white inline-flex">
                                <Wrench className="w-5 h-5" />
                              </div>
                            </div>
                          )
                        )}

                        {el.id === 'center_info' && (
                          <div 
                            className="w-fit max-w-full min-w-0 space-y-0.5 leading-tight break-words [overflow-wrap:anywhere]"
                            style={{ 
                              fontSize: getResponsiveReceiptFontSize(el.fontSize, 13, activePaperSize),
                              fontWeight: el.bold ? 800 : 600,
                              textAlign: el.textAlign || 'center'
                            }}
                          >
                            <div className="font-sans font-extrabold text-gray-950 tracking-tight break-words">
                              {rcptCenterNameText || localStorage.getItem('centerName') || 'TECHNO'}
                            </div>
                            <div className="text-gray-500 text-[0.78em] font-sans break-words">
                              بإشراف المهندس: {localStorage.getItem('engineerName') || 'م. محمد وليد'}
                            </div>
                            <div className="text-gray-500 text-[0.75em] font-mono tabular-nums flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 break-all" dir="ltr">
                              <span>{localStorage.getItem('centerMobile') || '0776400465'}</span>
                              {localStorage.getItem('centerEmail') && (
                                <>
                                  <span aria-hidden="true">|</span>
                                  <span className="break-all">{localStorage.getItem('centerEmail')}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {el.id === 'invoice_badge' && (
                          <div 
                            className="inline-flex flex-col w-fit max-w-full min-w-0 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200/80 leading-tight break-words [overflow-wrap:anywhere]"
                            style={{
                              fontSize: getResponsiveReceiptFontSize(el.fontSize, 11, activePaperSize),
                              textAlign: el.textAlign || 'center'
                            }}
                          >
                            <span className="text-[0.82em] text-gray-500 block font-semibold">إيصال استلام جهاز للصيانة</span>
                            <span className="font-mono tabular-nums text-[1.15em] font-black text-teal-700 block tracking-wider break-all" dir="ltr">#{showCustomerTicket.id}</span>
                            <span className="font-mono tabular-nums text-[0.75em] font-bold text-gray-600" dir="ltr">
                              {formatCountryDateTime24h(showCustomerTicket.createdAt, getActiveCountrySettings())}
                            </span>
                          </div>
                        )}

                        {el.id === 'customer_info' && (
                          <div 
                            className="w-fit max-w-full min-w-0 space-y-1.5 bg-white px-3 py-2 rounded-xl border border-gray-200/80 text-right leading-tight"
                            style={{
                              fontSize: getResponsiveReceiptFontSize(el.fontSize, 11, activePaperSize),
                              fontWeight: el.bold ? 700 : undefined,
                              textAlign: el.textAlign || 'right'
                            }}
                          >
                            <h4 className="font-sans font-bold text-gray-900 text-[0.95em] border-b border-gray-100 pb-1 flex items-center justify-start gap-1.5">
                              <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span>بيانات العميل المستلم</span>
                            </h4>
                            <div className="space-y-1 text-[1em] font-sans text-gray-600">
                              <div className="flex flex-wrap justify-between items-baseline gap-x-2.5 gap-y-0.5">
                                <span className="text-gray-400 shrink-0">اسم العميل:</span>
                                <strong className="text-gray-900 font-extrabold min-w-0 break-words [overflow-wrap:anywhere]">{showCustomerTicket.customerName}</strong>
                              </div>
                              <div className="flex flex-wrap justify-between items-baseline gap-x-2.5 gap-y-0.5">
                                <span className="text-gray-400 shrink-0">رقم الجوال:</span>
                                <strong className="text-gray-900 font-mono tabular-nums font-extrabold min-w-0 break-all" dir="ltr">{showCustomerTicket.customerPhone}</strong>
                              </div>
                              <div className="flex flex-wrap justify-between items-baseline gap-x-2.5 gap-y-0.5">
                                <span className="text-gray-400 shrink-0">البلد والمفتاح:</span>
                                <strong className="text-gray-900 font-sans font-extrabold min-w-0 break-words">{countryName} ({countryDialCode}+)</strong>
                              </div>
                            </div>
                          </div>
                        )}

                        {el.id === 'device_info' && (
                          <div 
                            className="w-fit max-w-full min-w-0 space-y-1.5 bg-white px-3 py-2 rounded-xl border border-gray-200/80 text-right leading-tight"
                            style={{
                              fontSize: getResponsiveReceiptFontSize(el.fontSize, 11, activePaperSize),
                              fontWeight: el.bold ? 700 : undefined,
                              textAlign: el.textAlign || 'right'
                            }}
                          >
                            <h4 className="font-sans font-bold text-gray-900 text-[0.95em] border-b border-gray-100 pb-1 flex items-center justify-start gap-1.5">
                              <Wrench className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span>مواصفات الجهاز</span>
                            </h4>
                            <div className="space-y-1 text-[1em] font-sans text-gray-600">
                              <div className="flex flex-wrap justify-between items-baseline gap-x-2.5 gap-y-0.5">
                                <span className="text-gray-400 shrink-0">الجهاز والموديل:</span>
                                <strong className="text-gray-900 font-extrabold min-w-0 break-words [overflow-wrap:anywhere]">{showCustomerTicket.deviceType} • {showCustomerTicket.brandModel}</strong>
                              </div>
                              <div className="flex flex-wrap justify-between items-baseline gap-x-2.5 gap-y-0.5">
                                <span className="text-gray-400 shrink-0">الرقم التسلسلي:</span>
                                <strong className="text-gray-900 font-mono tabular-nums min-w-0 break-all" dir="ltr">{showCustomerTicket.serialNumber || 'غير متوفر'}</strong>
                              </div>
                            </div>
                          </div>
                        )}

                        {el.id === 'fault_info' && (
                          <div 
                            className="w-fit max-w-full min-w-0 bg-white px-3 py-2 rounded-xl border border-gray-200/80 space-y-1.5 text-right leading-tight"
                            style={{
                              fontSize: getResponsiveReceiptFontSize(el.fontSize, 10.5, activePaperSize),
                              fontWeight: el.bold ? 700 : undefined,
                              textAlign: el.textAlign || 'right'
                            }}
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[1em] font-sans">
                              <span className="text-gray-400 font-bold shrink-0">وصف العطل:</span>
                              <p className="text-gray-800 font-medium leading-snug min-w-0 break-words [overflow-wrap:anywhere]">{showCustomerTicket.faultDescription}</p>
                            </div>
                            {showCustomerTicket.notes && (
                              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[0.95em] font-sans border-t border-gray-100 pt-1">
                                <span className="text-gray-400 font-bold shrink-0">ملاحظات إضافية:</span>
                                <p className="text-gray-500 font-medium leading-snug min-w-0 break-words [overflow-wrap:anywhere]">{showCustomerTicket.notes}</p>
                              </div>
                            )}
                            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[0.95em] font-sans border-t border-gray-100 pt-1">
                              <span className="text-gray-400 font-bold shrink-0">موعد الاستلام المتوقع:</span>
                              <p className="text-teal-700 font-extrabold min-w-0 break-words">{formatSafeDate(showCustomerTicket.expectedDeliveryDate)} ({showCustomerTicket.technician || 'الفني المختص'})</p>
                            </div>
                          </div>
                        )}

                        {el.id === 'cost_info' && (
                          <div 
                            className="w-fit max-w-full min-w-0 bg-emerald-50/50 px-3 py-2 rounded-xl border border-emerald-200/70 space-y-1 text-right font-sans leading-tight"
                            style={{
                              fontSize: getResponsiveReceiptFontSize(el.fontSize, 12, activePaperSize),
                              fontWeight: el.bold ? 800 : undefined,
                              textAlign: el.textAlign || 'right'
                            }}
                          >
                            <div className="flex flex-wrap justify-between items-baseline text-[1em] gap-x-2.5 gap-y-0.5">
                              <span className="text-gray-500 font-bold shrink-0">التكلفة التقديرية:</span>
                              <strong className="text-gray-900 font-black tabular-nums text-[1.05em] break-words">{showCustomerTicket.estimatedCost || 0} {showCustomerTicket.currency || currencyName}</strong>
                            </div>
                            <div className="flex flex-wrap justify-between items-baseline text-[0.92em] gap-x-2.5 gap-y-0.5">
                              <span className="text-gray-500 font-bold shrink-0">الدفعة المقدمة:</span>
                              <strong className="text-emerald-700 font-extrabold tabular-nums break-words">{showCustomerTicket.advancePayment || 0} {showCustomerTicket.currency || currencyName}</strong>
                            </div>
                            <div className="flex flex-wrap justify-between items-baseline text-[1em] border-t border-emerald-200/60 pt-1 gap-x-2.5 gap-y-0.5">
                              <span className="text-teal-900 font-bold shrink-0">المتبقي عند الاستلام:</span>
                              <strong className="text-teal-800 font-black tabular-nums text-[1.05em] break-words">
                                {Math.max(0, (showCustomerTicket.estimatedCost || 0) - (showCustomerTicket.advancePayment || 0))} {showCustomerTicket.currency || currencyName}
                              </strong>
                            </div>
                          </div>
                        )}

                        {el.id === 'barcode_section' && (
                          <div 
                            className="inline-flex flex-col items-center justify-center w-fit max-w-full min-w-0 bg-white border border-teal-600/30 rounded-xl px-2.5 py-2 gap-1 text-center overflow-hidden"
                            style={{
                              textAlign: el.textAlign || 'center'
                            }}
                          >
                            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-gray-700">
                              <Barcode className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span>رمز QR تتبع الطلب</span>
                            </div>
                            <div className="max-w-full flex flex-col items-center justify-center overflow-hidden">
                              <BarcodeGenerator 
                                value={showCustomerTicket.id} 
                                qrContent={getOrderQrContent(showCustomerTicket, 550)}
                                width={el.width || 1.4} 
                                height={el.height ? Math.max(10, Math.min(99, el.height)) : 40} 
                                showText={true} 
                                showModeBadge={true}
                                format={localStorage.getItem('lblBarcodeFormat') || 'AUTO'} 
                                fontSize={Math.max(10, Math.min(99, el.fontSize || 11))} 
                                maxWidthMm={paperMetrics.maxBarcodeMm}
                              />
                            </div>
                            <p className="text-[9px] text-gray-400 font-sans text-center break-words max-w-full">
                              يرجى الاحتفاظ بهذا الوصل لتتبع الفاتورة واستلام الجهاز
                            </p>
                          </div>
                        )}

                        {el.id === 'qr_section' && (
                          <div 
                            className="inline-flex flex-col items-center justify-center w-fit max-w-full min-w-0 py-1.5 border-b border-dashed border-gray-200"
                            style={{
                              textAlign: el.textAlign || 'center'
                            }}
                          >
                            <div className="bg-white p-1.5 rounded-xl border border-gray-200 inline-flex flex-col items-center w-fit max-w-full">
                              <QRCodeGenerator value={buildTrackingUrl(showCustomerTicket.id, appUrl)} size={el.height ? Math.max(10, Math.min(99, el.height)) : 60} />
                            </div>
                            <span className="text-[9px] text-gray-400 mt-1 font-sans break-words max-w-full">امسح الكود لتتبع حالة جهازك مباشرة</span>
                          </div>
                        )}

                        {el.id === 'terms_section' && (
                          <div 
                            className="w-fit max-w-full min-w-0 bg-gray-50 rounded-xl px-2.5 py-2 border border-gray-200/80 text-gray-500 font-sans leading-snug space-y-0.5 break-words [overflow-wrap:anywhere]"
                            style={{
                              fontSize: getResponsiveReceiptFontSize(el.fontSize, 10, activePaperSize),
                              fontWeight: el.bold ? 700 : undefined,
                              textAlign: el.textAlign || 'center'
                            }}
                          >
                            <p className="font-bold text-gray-700 text-[1em]">شروط وأحكام الصيانة المعتمدة:</p>
                            {(rcptTermsText || '').split('\n').map((line: string, idx: number) => (
                              <p key={idx} className="text-[0.9em] break-words">{line}</p>
                            ))}
                          </div>
                        )}

                        {el.id === 'footer_thanks' && (
                          <div 
                            className="w-fit max-w-full min-w-0 px-2 pt-1 font-bold text-teal-800 font-sans leading-tight break-words [overflow-wrap:anywhere]"
                            style={{
                              fontSize: getResponsiveReceiptFontSize(el.fontSize, 10, activePaperSize),
                              fontWeight: el.bold ? 800 : 700,
                              textAlign: el.textAlign || 'center'
                            }}
                          >
                            شكراً لثقتكم بنا، ونتمنى لكم يوماً سعيداً!
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Active Invoice Printer status in modal */}
            {(() => {
              const isSelectEnabled = localStorage.getItem('allow_select_printer_on_print') !== 'false';
              const invoicePrinter = getSelectedInvoicePrinter();
              const currentDefaultId = availablePrinters.find(p => p.isDefaultInvoices)?.id || 'p-default';
              const isDefault = invoicePrinter.id === currentDefaultId;

              return (
                <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 text-right text-xs font-sans space-y-3 no-print">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-700 flex items-center gap-1">
                      <Printer className="w-3.5 h-3.5 text-teal-600" />
                      {isSelectEnabled ? 'اختر طابعة الفواتير والوصولات:' : 'طابعة الفواتير والوصولات الافتراضية:'}
                    </span>
                    <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-bold">
                      {invoicePrinter.type === 'wifi_lan' ? 'واي فاي/شبكة' : invoicePrinter.type === 'bluetooth' ? 'بلوتوث' : 'النظام'}
                    </span>
                  </div>

                  {isSelectEnabled ? (
                    <div className="space-y-1.5">
                      <select
                        value={selectedInvoicePrinterId || 'p-default'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedInvoicePrinterId(val);
                        }}
                        className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-right font-sans"
                      >
                        <option value="p-default">طابعة النظام الافتراضية (عبر المتصفح)</option>
                        {availablePrinters.filter(p => p.id !== 'p-default').map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>

                      {!isDefault && (
                        <button
                          type="button"
                          onClick={() => makePrinterDefault(selectedInvoicePrinterId || 'p-default', 'isDefaultInvoices')}
                          className="text-[10px] text-teal-700 font-extrabold hover:text-teal-800 flex items-center gap-1 justify-start font-sans cursor-pointer"
                        >
                          <span>📌 تعيين الطابعة المحددة كافتراضية للفواتير</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-600 font-semibold">{invoicePrinter.name}</div>
                  )}

                  {invoicePrinter.type === 'wifi_lan' && (
                    <div className="font-mono text-[10px] text-gray-400" dir="ltr">{invoicePrinter.ipAddress}:{invoicePrinter.port}</div>
                  )}
                </div>
              );
            })()}

            {directPrintMessage && (
              <div className="bg-teal-50 border border-teal-100/70 p-3 rounded-2xl text-xs text-teal-800 text-right font-sans animate-bounce no-print">
                {directPrintMessage}
              </div>
            )}

            {isInIframe && (
              <div className="bg-amber-50 border border-amber-200/70 p-3.5 rounded-2xl text-[10px] text-amber-800 text-right font-sans space-y-1.5 leading-relaxed no-print">
                <div className="font-bold flex items-center gap-1 text-amber-950">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>تنبيه بيئة المعاينة (iFrame):</span>
                </div>
                <p>
                  يمنع المتصفح نوافذ الطباعة داخل بيئة المعاينة. للطباعة الناجحة، افتح البرنامج في نافذة جديدة:
                </p>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition-colors no-print"
                >
                  فتح البرنامج في نافذة مستقلة للطباعة ↗
                </a>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap gap-2.5 pt-4 border-t border-gray-100 no-print">
              <button
                onClick={() => handlePrintElement('customer-receipt-print-modal', 'إيصال استلام الصيانة')}
                className="flex-1 min-w-[160px] bg-gray-800 hover:bg-gray-900 text-white font-sans font-bold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                طباعة عبر المتصفح
              </button>
              <button
                onClick={() => {
                  setShowCustomerTicket(null);
                  setIsDirectPrinting(false);
                  setDirectPrintMessage(null);
                }}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-sans font-semibold rounded-xl text-xs transition-colors whitespace-nowrap"
              >
                إغلاق النافذة
              </button>
            </div>

          </div>
        </div>
      )})()}

      {/* 2. Add / Edit Order Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-transparent z-40 flex items-start justify-center p-2 pt-1 sm:pt-2 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-150 mb-4">
            
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4.5 text-white flex justify-between items-center">
              <h3 className="font-sans font-extrabold text-base">
                {isEditing ? 'تعديل بيانات طلب صيانة' : 'تسجيل طلب صيانة جديد'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white/80 hover:text-white text-sm font-bold bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors"
              >
                إغلاق ×
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              
              {/* Order Number Section: ***yymmddhhmm (Editable 3-char prefix + Country local 24h time) */}
              <div className="bg-gradient-to-r from-teal-50 to-emerald-50/70 p-3.5 rounded-2xl border border-teal-200/80 text-right space-y-2.5 font-sans" dir="rtl">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-teal-900">
                    <Barcode className="w-4 h-4 text-teal-600" />
                    <span>رقم الطلب:</span>
                  </div>
                  <span dir="ltr" className="font-mono bg-teal-600 text-white font-black px-2.5 py-1 rounded-xl text-xs tracking-wider shadow-xs">
                    {isEditing ? (selectedOrder?.id || formBarcodeId) : formBarcodeId}
                  </span>
                </div>

                {!isEditing ? (
                  <div className="pt-1.5 border-t border-teal-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-gray-700">تعديل الأحرف (***):</span>
                      <input
                        type="text"
                        maxLength={3}
                        value={formBarcodePrefix}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
                          setFormBarcodePrefix(val);
                          setFormBarcodeId(
                            generateBarcodeId(val, orders.map(o => o.id), new Date(), getActiveCountrySettings())
                          );
                        }}
                        dir="ltr"
                        className="w-16 px-2 py-1 bg-white border border-teal-300 rounded-lg font-mono text-center font-black text-xs text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase"
                        placeholder="TEC"
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-teal-800/80">
                      <span dir="ltr" className="font-mono font-bold">***yymmddhhmm</span> · توقيت {getActiveCountrySettings().countryName} (24 ساعة)
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-teal-800 font-medium">
                    رقم الطلب مسجل مسبقاً لهذا الجهاز في النظام.
                  </div>
                )}
              </div>

              {/* Customer Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 relative">
                  <label className="block text-gray-700 font-sans font-bold text-xs flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-teal-600" />
                      اسم العميل:
                    </span>
                    {listeningField === 'customerName' && (
                      <span className="text-[10px] text-rose-500 animate-pulse font-bold flex items-center gap-0.5">
                        ● جاري الاستماع... تكلّم الآن
                      </span>
                    )}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      placeholder="عبد الله الحربي"
                      value={formCustomerName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onFocus={() => {
                        setActiveSuggestionField('name');
                        if (formCustomerName.trim()) {
                          const filtered = uniqueCustomers.filter(c => 
                            c.name.toLowerCase().includes(formCustomerName.toLowerCase()) ||
                            c.phone.includes(formCustomerName)
                          );
                          setCustomerSuggestions(filtered);
                          setShowSuggestions(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowSuggestions(false), 200);
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-11 pr-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-gray-800 font-medium font-sans text-right"
                      dir="rtl"
                    />
                    <button
                      type="button"
                      onClick={() => handleVoiceInput('customerName')}
                      className={`absolute left-2.5 p-1.5 rounded-lg transition-all flex items-center justify-center ${
                        listeningField === 'customerName' 
                          ? 'bg-rose-100 text-rose-600 animate-pulse' 
                          : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
                      }`}
                      title={listeningField === 'customerName' ? "إيقاف الاستماع" : "تسجيل الاسم بالصوت"}
                    >
                      {listeningField === 'customerName' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Suggestions list for Name */}
                  {showSuggestions && activeSuggestionField === 'name' && customerSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-50 font-sans" dir="rtl">
                      {customerSuggestions.map((c, index) => (
                        <div
                          key={index}
                          onMouseDown={() => selectSuggestion(c)}
                          className="px-4 py-2.5 hover:bg-teal-50/50 cursor-pointer transition-colors flex items-center justify-between text-xs gap-2"
                        >
                          <span className="font-bold text-gray-800 truncate">{c.name}</span>
                          <span className="font-mono text-gray-500 text-[11px] shrink-0" dir="ltr">
                            {c.phone}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 relative">
                  <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-teal-600" />
                    رقم الجوال:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="07xxxxxxxx"
                      value={formCustomerPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      onFocus={() => {
                        setActiveSuggestionField('phone');
                        if (formCustomerPhone.trim()) {
                          const q = formCustomerPhone.toLowerCase();
                          const filtered = uniqueCustomers.filter(c => 
                            c.phone.includes(formCustomerPhone) ||
                            c.name.toLowerCase().includes(q) ||
                            (c.customerBarcode && c.customerBarcode.toLowerCase().includes(q))
                          );
                          setCustomerSuggestions(filtered);
                          setShowSuggestions(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowSuggestions(false), 200);
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-gray-800 font-medium font-mono text-right"
                    />

                    {/* Suggestions list for Phone */}
                    {showSuggestions && activeSuggestionField === 'phone' && customerSuggestions.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-50 font-sans" dir="rtl">
                        {customerSuggestions.map((c, index) => (
                          <div
                            key={index}
                            onMouseDown={() => selectSuggestion(c)}
                            className="px-4 py-2.5 hover:bg-teal-50/50 cursor-pointer transition-colors flex items-center justify-between text-xs gap-2"
                          >
                            <span className="font-bold text-gray-800 truncate">{c.name}</span>
                            <span className="font-mono text-gray-500 text-[11px] shrink-0" dir="ltr">
                              {c.phone}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Device specifications */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1 space-y-1.5">
                  <label className="block text-gray-700 font-sans font-bold text-xs">نوع الجهاز:</label>
                  <select
                    value={formDeviceType}
                    onChange={(e) => setFormDeviceType(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white font-sans"
                  >
                    <option value="جوال">جوال</option>
                    <option value="لابتوب">لابتوب</option>
                    <option value="أيباد">أيباد/تابلت</option>
                    <option value="كمبيوتر مكتبي">كمبيوتر مكتبي</option>
                    <option value="بلايستيشن">بلايستيشن/كونسول</option>
                    <option value="سماعة">سماعة</option>
                    <option value="كفالة جهاز">كفالة جهاز</option>
                    <option value="أخرى">أجهزة أخرى</option>
                  </select>
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="block text-gray-700 font-sans font-bold text-xs">الماركة والموديل:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: iPhone 13 Pro"
                    value={formBrandModel}
                    onChange={(e) => setFormBrandModel(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-gray-800 font-medium"
                  />
                </div>
              </div>

              {/* Serial number */}
              <div className="space-y-1.5">
                <label className="block text-gray-700 font-sans font-bold text-xs">الرقم التسلسلي للجهاز (S/N):</label>
                <input
                  type="text"
                  placeholder="اختياري (مثال: C39XG18Q...)"
                  value={formSerialNumber}
                  onChange={(e) => setFormSerialNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white font-mono text-gray-800"
                />
              </div>

              {/* Fault Description */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-teal-600" />
                    وصف العطل بالتفصيل والشكوى:
                  </label>
                  <div className="flex items-center gap-2">
                    {listeningField === 'faultDescription' && (
                      <span className="text-[10px] text-rose-500 animate-pulse font-bold">
                        ● جاري الاستماع...
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleVoiceInput('faultDescription')}
                      className={`flex items-center gap-1 font-sans font-extrabold text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                        listeningField === 'faultDescription'
                          ? 'bg-rose-100 border-rose-200 text-rose-600 animate-pulse'
                          : 'bg-teal-50 border-teal-100 text-teal-600 hover:bg-teal-100'
                      }`}
                      title="تسجيل العطل بالصوت"
                    >
                      {listeningField === 'faultDescription' ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      {listeningField === 'faultDescription' ? 'إيقاف الاستماع' : 'إدخال بالصوت'}
                    </button>
                  </div>
                </div>
                <textarea
                  required
                  placeholder="اكتب تفاصيل العطل (مثال: الشاشة لا تعمل، منفذ الشاحن تالف، تلف ناتج عن الماء...)"
                  value={formFaultDescription}
                  onChange={(e) => setFormFaultDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-gray-800 font-sans leading-relaxed"
                />
              </div>

              {/* Fault & Device Photos Camera Documentation inside Modal */}
              <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/80 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-sans font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span>توثيق العطل ومظهر الجهاز بالكاميرا:</span>
                    <span className="text-[10px] bg-white border border-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      {formPhotos.length} صور
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCameraModalTarget({
                        orderId: isEditing ? selectedOrder?.id : formBarcodeId,
                        customerName: formCustomerName,
                        deviceModel: `${formDeviceType} ${formBrandModel}`,
                        defaultStage: 'fault_initial',
                        isForForm: true
                      });
                    }}
                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>التقاط صورة الآن</span>
                  </button>
                </div>

                {formPhotos.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                    {formPhotos.map((p, idx) => (
                      <div key={p.id || idx} className="relative group rounded-xl overflow-hidden border border-emerald-200 aspect-square bg-black shadow-xs">
                        <img src={p.url} alt={p.stageLabel} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] font-bold py-0.5 px-1 truncate text-center">
                          {p.stageLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFormPhotos(prev => prev.filter(item => item.id !== p.id))}
                          className="absolute top-1 left-1 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-lg opacity-90 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="حذف هذه الصورة"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Estimated financial and dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-teal-600" />
                    التكلفة التقديرية والعملة:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="200"
                      value={formEstimatedCost}
                      onChange={(e) => setFormEstimatedCost(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                      className="flex-grow bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-gray-800 font-bold font-mono"
                    />
                    <select
                      value={formCurrency}
                      onChange={(e) => setFormCurrency(e.target.value)}
                      className="w-28 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-gray-800 font-bold font-sans"
                    >
                      <option value="دينار">دينار</option>
                      <option value="ريال">ريال</option>
                      <option value="دولار">دولار (USD)</option>
                      <option value="يورو">يورو (EUR)</option>
                      <option value="درهم">درهم</option>
                      <option value="جنيه">جنيه</option>
                      <option value="ليرة">ليرة</option>
                      <option value="كرونة">كرونة</option>
                      {/* Dynamically include system default or custom-typed currency if not listed */}
                      {currencyName && !['دينار', 'ريال', 'دولار', 'يورو', 'درهم', 'جنيه', 'ليرة', 'كرونة'].includes(currencyName) && (
                        <option value={currencyName}>{currencyName}</option>
                      )}
                      {formCurrency && formCurrency !== currencyName && !['دينار', 'ريال', 'دولار', 'يورو', 'درهم', 'جنيه', 'ليرة', 'كرونة'].includes(formCurrency) && (
                        <option value={formCurrency}>{formCurrency}</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    تاريخ التسليم المتوقع:
                  </label>
                  <input
                    type="date"
                    required
                    value={formExpectedDeliveryDate}
                    onChange={(e) => setFormExpectedDeliveryDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-gray-800 font-semibold font-mono"
                  />
                </div>
              </div>

              {/* Additional Costs, Advance Payment, Waiting Parts & Custom Variables during Reception / Edit */}
              <div className="bg-amber-50/50 border border-amber-200/70 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-amber-200/50 pb-1.5">
                  <span className="font-sans font-extrabold text-xs text-amber-950 flex items-center gap-1.5">
                    <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>العربون، الكلف الإضافية، انتظار القطع ومتغيرات مخصصة (اختياري):</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700">الدفعة المقدمة (العربون):</label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      placeholder="0"
                      value={formAdvancePayment}
                      onChange={(e) => setFormAdvancePayment(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs font-mono font-bold text-teal-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-amber-900">كلف إضافية:</label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      placeholder="0"
                      value={formExtraCost}
                      onChange={(e) => setFormExtraCost(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-amber-300 rounded-xl py-2 px-3 text-xs font-mono font-bold text-amber-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700">سبب الكلفة الإضافية:</label>
                    <input
                      type="text"
                      placeholder="مثال: قطعة إضافية..."
                      value={formExtraCostReason}
                      onChange={(e) => setFormExtraCostReason(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs font-sans"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-sky-900 flex items-center gap-1">
                      <Package className="w-3 h-3 text-sky-600" />
                      <span>انتظار القطع (إن وجد):</span>
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: بانتظار شاشة أصلية..."
                      value={formWaitingPartsDetails}
                      onChange={(e) => setFormWaitingPartsDetails(e.target.value)}
                      className="w-full bg-white border border-sky-200 rounded-xl py-2 px-3 text-xs font-sans"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-sky-900">تاريخ وصول القطعة:</label>
                    <input
                      type="date"
                      value={formWaitingPartsExpectedDate}
                      onChange={(e) => setFormWaitingPartsExpectedDate(e.target.value)}
                      className="w-full bg-white border border-sky-200 rounded-xl py-2 px-2.5 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-1 border-t border-amber-200/40">
                  <label className="text-[11px] font-bold text-violet-900 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-violet-600" />
                    <span>إضافة متغير مخصص للرسالة والسجل:</span>
                  </label>
                  {formCustomVariables.map((cv, idx) => (
                    <div key={`${cv.key}-${idx}`} className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-violet-200 text-xs">
                      <span className="font-bold text-violet-900">{cv.label}:</span>
                      <span className="flex-1 text-gray-800">{cv.value}</span>
                      <button
                        type="button"
                        onClick={() => setFormCustomVariables(prev => prev.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
                    <input
                      type="text"
                      placeholder="اسم المتغير"
                      value={newFormVarLabel}
                      onChange={(e) => setNewFormVarLabel(e.target.value)}
                      className="sm:col-span-4 bg-white border border-violet-200 rounded-xl py-1.5 px-2.5 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="القيمة"
                      value={newFormVarValue}
                      onChange={(e) => setNewFormVarValue(e.target.value)}
                      className="sm:col-span-5 bg-white border border-violet-200 rounded-xl py-1.5 px-2.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newFormVarLabel.trim() || !newFormVarValue.trim()) return;
                        setFormCustomVariables(prev => [
                          ...prev,
                          { key: `var_${Date.now().toString(36).slice(-4)}`, label: newFormVarLabel.trim(), value: newFormVarValue.trim() }
                        ]);
                        setNewFormVarLabel('');
                        setNewFormVarValue('');
                      }}
                      disabled={!newFormVarLabel.trim() || !newFormVarValue.trim()}
                      className="sm:col-span-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold text-xs py-1.5 px-2.5 rounded-xl cursor-pointer"
                    >
                      + إضافة متغير
                    </button>
                  </div>
                </div>
              </div>

              {/* Technician and store notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-gray-700 font-sans font-bold text-xs">الفني المختص بالإصلاح:</label>
                  <select
                    value={formTechnician}
                    onChange={(e) => setFormTechnician(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white font-sans font-medium text-gray-800"
                  >
                    {Array.from(new Set(['م. محمد وليد', localStorage.getItem('engineerName') || '', formTechnician].filter(Boolean))).map(tech => (
                      <option key={tech} value={tech}>{tech}</option>
                    ))}
                  </select>
                </div>

                 <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-gray-700 font-sans font-bold text-xs">ملاحظات داخلية للمحل:</label>
                    <div className="flex items-center gap-1.5">
                      {listeningField === 'notes' && (
                        <span className="text-[10px] text-rose-500 animate-pulse font-bold">
                          ● جاري الاستماع...
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleVoiceInput('notes')}
                        className={`flex items-center gap-1 font-sans font-extrabold text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                          listeningField === 'notes'
                            ? 'bg-rose-100 border-rose-200 text-rose-600 animate-pulse'
                            : 'bg-teal-50 border-teal-100 text-teal-600 hover:bg-teal-100'
                        }`}
                        title="تسجيل الملاحظات بالصوت"
                      >
                        {listeningField === 'notes' ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                        {listeningField === 'notes' ? 'إيقاف' : 'إدخال بالصوت'}
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="مثال: يوجد خدوش سابقة على البودي..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white font-sans text-gray-800"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-sans font-bold py-3 rounded-2xl transition-all text-xs shadow-lg shadow-teal-600/15"
                >
                  {isEditing ? 'حفظ التعديلات' : 'تسجيل الجهاز وإرسال الإشعار'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-500 font-sans font-semibold rounded-2xl transition-colors text-xs"
                >
                  إلغاء
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {preNotificationTarget && (
        <PreNotificationModal
          isOpen={true}
          order={preNotificationTarget.order}
          targetStatus={preNotificationTarget.targetStatus}
          targetTemplateId={preNotificationTarget.targetTemplateId}
          templates={templates}
          appUrl={appUrl}
          currencyName={currencyName}
          currentUser={currentUser}
          onClose={() => setPreNotificationTarget(null)}
          onConfirmAndSend={(updatedOrder, finalMessage, channel, shouldDispatch) => {
            // 1. Persist the updated order and customer maintenance history
            onSaveOrder(updatedOrder);
            setSelectedOrder(updatedOrder);
            setPreNotificationTarget(null);

            // 2. Dispatch notification if requested
            if (shouldDispatch) {
              const latestSnapshot = updatedOrder.statusHistory?.[updatedOrder.statusHistory.length - 1]?.snapshot;
              if (channel === 'whatsapp') {
                const url = getWhatsAppLink(updatedOrder.customerPhone, finalMessage);
                openWhatsAppDirectly(updatedOrder.customerPhone, finalMessage);

                onLogNotification(
                  updatedOrder.id,
                  updatedOrder.customerName,
                  updatedOrder.customerPhone,
                  'whatsapp',
                  finalMessage,
                  `تحديث مسار الصيانة (${getStatusArabicLabel(updatedOrder.status)})`,
                  latestSnapshot
                );

                setWhatsappModal({
                  url,
                  orderId: updatedOrder.id,
                  customerName: updatedOrder.customerName,
                  phone: updatedOrder.customerPhone,
                  text: finalMessage
                });
              } else {
                onLogNotification(
                  updatedOrder.id,
                  updatedOrder.customerName,
                  updatedOrder.customerPhone,
                  'sms',
                  finalMessage,
                  `رسالة SMS مسار الصيانة (${getStatusArabicLabel(updatedOrder.status)})`,
                  latestSnapshot
                );
                window.open(`sms:${updatedOrder.customerPhone}?body=${encodeURIComponent(finalMessage)}`, '_blank');
              }
            }
          }}
        />
      )}

      {whatsappModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-start justify-center p-2 pt-4 sm:pt-8 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-150 mb-4" dir="rtl">
            
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 text-white text-center relative">
              <button 
                onClick={() => {
                  setWhatsappModal(null);
                  setCopiedMsg(false);
                }}
                className="absolute top-4 left-4 text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="mx-auto w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-2.5 shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-sans font-extrabold text-base">تم تسجيل وتحديث الطلب بنجاح! 🎉</h3>
              <p className="text-emerald-100 text-xs mt-0.5 font-mono">رقم الطلب: {whatsappModal.orderId}</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span>العميل: <strong className="text-gray-900">{whatsappModal.customerName}</strong></span>
                  <span className="font-mono text-emerald-700 font-bold" dir="ltr">{whatsappModal.phone}</span>
                </div>
                
                <p className="text-gray-600 text-xs font-sans text-right leading-relaxed">
                  تم فتح محادثة WhatsApp تلقائياً مع العميل. إذا لم يفتح التطبيق لديك بشكل مباشر، يمكنك الضغط على أحد الأزرار التالية:
                </p>
              </div>

              {/* Message text preview */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] text-gray-500">
                  <span className="font-bold">نص الرسالة الجاهزة للإرسال:</span>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(whatsappModal.text);
                      } catch (e) {
                        const ta = document.createElement('textarea');
                        ta.value = whatsappModal.text;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                      }
                      setCopiedMsg(true);
                      setTimeout(() => setCopiedMsg(false), 2500);
                    }}
                    className="text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedMsg ? '✓ تم النسخ بنجاح!' : '📋 نسخ نص الرسالة'}
                  </button>
                </div>
                <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-3 text-xs text-gray-800 font-sans whitespace-pre-line max-h-36 overflow-y-auto leading-relaxed select-all">
                  {whatsappModal.text}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-1">
                {/* Primary: Direct WhatsApp App */}
                <a
                  href={whatsappModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    openWhatsAppDirectly(whatsappModal.phone, whatsappModal.text);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold py-3.5 px-4 rounded-2xl transition-all text-xs text-center shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>فتح تطبيق WhatsApp وإرسال الرسالة الآن 📱</span>
                </a>

                {/* Secondary: WhatsApp Web for PC */}
                <a
                  href={getWhatsAppWebLink(whatsappModal.phone, whatsappModal.text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 font-sans font-bold py-2.5 px-4 rounded-2xl transition-all text-xs text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>فتح عبر WhatsApp Web (للكمبيوتر) 💻</span>
                </a>

                {/* Quick Print buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const ord = orders.find(o => o.id === whatsappModal.orderId) || selectedOrder;
                      if (ord) setShowCustomerTicket(ord);
                      setWhatsappModal(null);
                    }}
                    className="py-2.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-sans font-bold rounded-xl transition-colors text-xs text-center flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-teal-600" />
                    <span>طباعة إيصال العميل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const ord = orders.find(o => o.id === whatsappModal.orderId) || selectedOrder;
                      if (ord) handlePrintLabelThermal(ord);
                      setWhatsappModal(null);
                    }}
                    className="py-2.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-sans font-bold rounded-xl transition-colors text-xs text-center flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-teal-600" />
                    <span>طباعة ملصق الصيانة</span>
                  </button>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    setWhatsappModal(null);
                    setCopiedMsg(false);
                  }}
                  className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-500 font-sans font-semibold rounded-xl transition-colors text-xs text-center cursor-pointer mt-1"
                >
                  إغلاق ومتابعة العمل
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {showDeleteAuthModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-start justify-center p-2 pt-6 sm:pt-10 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-rose-200 animate-in fade-in slide-in-from-top-2 duration-150 mb-4" dir="rtl">
            
            <div className="bg-gradient-to-r from-rose-600 to-rose-700 px-6 py-5 text-white text-center relative">
              <button 
                onClick={() => {
                  setShowDeleteAuthModal(false);
                  setOrderToDeleteId(null);
                }}
                className="absolute top-4 left-4 text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="mx-auto w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-2.5 shadow-sm">
                <Trash2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-sans font-extrabold text-lg">تأكيد حذف طلب الصيانة</h3>
              <p className="text-rose-100 text-xs mt-1">حذف مباشر وسريع دون الحاجة لكلمة مرور أو اسم مستخدم</p>
            </div>

            <div className="p-6 space-y-4">
              {orderToDeleteId && (
                <div className="bg-rose-50/60 rounded-2xl p-4 border border-rose-100 space-y-2 text-right">
                  <div className="text-xs text-rose-900 font-bold flex items-center gap-1.5 justify-end">
                    <span>بيانات السجل المراد حذفه:</span>
                  </div>
                  {(() => {
                    const o = orders.find(ord => ord.id === orderToDeleteId);
                    if (!o) return null;
                    return (
                      <div className="text-xs text-gray-700 space-y-1.5 font-semibold bg-white p-3 rounded-xl border border-rose-100/60">
                        <div className="flex justify-between items-center"><span className="text-gray-400 font-sans font-normal">اسم العميل:</span> <strong className="text-gray-900">{o.customerName}</strong></div>
                        <div className="flex justify-between items-center"><span className="text-gray-400 font-sans font-normal">رقم الطلب:</span> <strong className="text-teal-700 font-mono">{o.id}</strong></div>
                        <div className="flex justify-between items-center"><span className="text-gray-400 font-sans font-normal">الجهاز والموديل:</span> <strong className="text-gray-800">{o.brandModel}</strong></div>
                        {o.faultDescription && (
                          <div className="flex justify-between items-start gap-2 pt-1 border-t border-gray-100">
                            <span className="text-gray-400 font-sans font-normal shrink-0">العطل:</span>
                            <span className="text-gray-700 font-medium text-left">{o.faultDescription}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 text-right space-y-1.5">
                <p className="text-xs font-bold text-amber-900 font-sans">
                  هل أنت متأكد من رغبتك في حذف هذا الطلب نهائياً؟
                </p>
                <p className="text-[11px] text-amber-700 font-sans leading-relaxed">
                  سيتم مسح هذا الطلب من قاعدة البيانات فوراً. لا يمكن التراجع عن هذا الإجراء بعد تنفيذه.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (orderToDeleteId) {
                      onDeleteOrder(orderToDeleteId);
                      setSelectedOrder(null);
                    }
                    setShowDeleteAuthModal(false);
                    setOrderToDeleteId(null);
                  }}
                  className="w-full bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-sans font-bold py-3.5 px-4 rounded-2xl transition-all text-sm text-center flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>نعم، حذف السجل نهائياً الآن</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteAuthModal(false);
                    setOrderToDeleteId(null);
                  }}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-sans font-semibold rounded-2xl transition-colors text-xs text-center cursor-pointer"
                >
                  إلغاء والتراجع
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal for Documenting Maintenance Stages & Faults */}
      {cameraModalTarget && (
        <CameraCaptureModal
          orderId={cameraModalTarget.orderId}
          customerName={cameraModalTarget.customerName}
          deviceModel={cameraModalTarget.deviceModel}
          defaultStage={cameraModalTarget.defaultStage}
          onPhotoCaptured={(newPhoto) => {
            if (cameraModalTarget.isForForm) {
              setFormPhotos(prev => [newPhoto, ...prev]);
            } else if (selectedOrder) {
              const updatedPhotos = [newPhoto, ...(selectedOrder.photos || [])];
              const updatedOrder: MaintenanceOrder = {
                ...selectedOrder,
                photos: updatedPhotos,
                updatedAt: Date.now()
              };
              onSaveOrder(updatedOrder);
              setSelectedOrder(updatedOrder);
            }
            setCameraModalTarget(null);
          }}
          onClose={() => setCameraModalTarget(null)}
        />
      )}

    </div>
  );
};
export default OrdersView;
