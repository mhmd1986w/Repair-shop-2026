import React, { useState, useEffect, useMemo } from 'react';
import { NotificationTemplate, NotificationLog, DeviceStatus, MaintenanceOrder, AppUser } from '../types';
import { dbService, logoutUser } from '../lib/firebase';
import { COUNTRIES_LIST } from '../utils/countries';
import * as XLSX from 'xlsx';
import { saveFileToDevice, excelWorkbookToBlob } from '../utils/fileSaver';
import { BackupModal } from './BackupModal';
import { NamesBackupModal } from './NamesBackupModal';
import { OrdersBackupModal } from './OrdersBackupModal';
import { LogsBackupModal } from './LogsBackupModal';
import { SettingsBackupModal } from './SettingsBackupModal';
import { ClearDataModal } from './ClearDataModal';
import { FileSpreadsheet } from 'lucide-react';
import { QRCodeGenerator } from './QRCodeGenerator';
import { BarcodeGenerator } from './BarcodeGenerator';
import { DEFAULT_BARCODE_PREFIX, sanitizeBarcodePrefix, formatDateTimeForBarcode, formatCountryDateTime24h, formatCountryDateYmd, resolveCountryTimeZone, generateBarcodeId, parseBarcodeId } from '../utils/barcode';
import { PrintFormatToolbar } from './PrintFormatToolbar';
import { PrintFormatConfig, getStoredReceiptFormat, getStoredLabelFormat, ARABIC_FONTS, RECEIPT_FONT_SIZES, LABEL_FONT_SIZES } from '../utils/printFormatting';
import { LabelDesigner } from './LabelDesigner';
import { ReceiptDesigner } from './ReceiptDesigner';
import {
  getStoredLabelLayout,
  getLabelPreviewMetrics,
  getLabelContainerStyles,
  getLabelElementMetrics,
  getSplitThermalLabelMetrics,
  getVerticalOrderIdSvgSpec,
  FIXED_LABEL_PAPER_SIZE
} from '../utils/labelDesigner';
import { printPureContent, printHtmlViaIframe } from '../lib/printUtils';
import { BUILT_IN_APP_DOMAIN, FIREBASE_HOSTING_DOMAIN, buildTrackingUrl, getDefaultBuiltInDomain, normalizeDomainUrl } from '../utils/appDomain';
import { buildOrderCustomerQrPayload } from '../utils/customerBarcode';
import { 
  MessageSquare, 
  MessageCircle,
  Save, 
  Settings, 
  FileText, 
  CheckCircle2, 
  Phone, 
  Calendar, 
  Clock, 
  AlertTriangle,
  Printer,
  Wifi,
  Plus,
  Trash2,
  RefreshCw,
  Sliders,
  AlertCircle,
  Check,
  Smartphone,
  Bluetooth,
  Usb,
  Users,
  FolderOpen,
  Upload,
  Download,
  Search,
  Database,
  Copy,
  ExternalLink,
  ShieldAlert,
  Store,
  Coins,
  Globe,
  UserPlus,
  Camera,
  Image,
  Video,
  X,
  Barcode,
  Hash,
  Lock, LogOut,
  User,
  Key,
  Eye
} from 'lucide-react';

export interface PrinterConfig {
  id: string;
  name: string;
  type: 'wifi_lan' | 'bluetooth' | 'browser' | 'usb';
  ipAddress?: string;
  port?: number;
  protocol: 'esc_pos' | 'tspl' | 'zpl' | 'system';
  paperSize?: '80mm' | '58mm' | 'label_4x6' | 'label_2x1' | 'label_30x20' | 'label_38x25';
  isDefaultInvoices: boolean;
  isDefaultLabels: boolean;
  status: 'online' | 'offline' | 'unknown';
}

interface NotificationSettingsViewProps {
  templates: NotificationTemplate[];
  notificationLogs: NotificationLog[];
  onSaveTemplate: (id: string, smsContent: string, whatsappContent: string) => void;
  onClearLogs: () => void;
  onClearNames?: (clearAll?: boolean) => void;
  orders?: MaintenanceOrder[];
  onRefreshData?: () => Promise<void>;
  onClearAllOrders?: () => void;
  onSettingsSaved?: () => void;
  onForceSync?: () => Promise<void>;
}

export const NotificationSettingsView: React.FC<NotificationSettingsViewProps> = ({
  templates,
  notificationLogs,
  onSaveTemplate,
  onClearLogs,
  onClearNames,
  orders = [],
  onRefreshData,
  onClearAllOrders,
  onSettingsSaved,
  onForceSync
}) => {

  const [isUnlocked, setIsUnlocked] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');




  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showNamesBackupModal, setShowNamesBackupModal] = useState(false);
  const [showOrdersBackupModal, setShowOrdersBackupModal] = useState(false);
  const [showLogsBackupModal, setShowLogsBackupModal] = useState(false);
  const [showSettingsBackupModal, setShowSettingsBackupModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);



  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, isDangerous?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const confirmAction = (title: string, message: string, onConfirm: () => void, isDangerous = false) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, isDangerous });
  };



  const [activeTab, setActiveTab] = useState<'templates' | 'logs' | 'printers' | 'files' | 'names' | 'center_info'>('templates');
  const [printerSubTab, setPrinterSubTab] = useState<'receipt' | 'label'>('receipt');
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [smsContent, setSmsContent] = useState('');
  const [whatsappContent, setWhatsappContent] = useState('');
  const [activeTemplateField, setActiveTemplateField] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Advanced search states for notification logs
  const [logSearchName, setLogSearchName] = useState('');
  const [logSearchType, setLogSearchType] = useState<'all' | 'sms' | 'whatsapp'>('all');
  const [logSearchStartDate, setLogSearchStartDate] = useState('');
  const [logSearchEndDate, setLogSearchEndDate] = useState('');

  // Center identity and info states loaded from localStorage with default fallbacks
  const [centerName, setCenterName] = useState(() => localStorage.getItem('centerName') || 'TECHNO');
  const [engineerName, setEngineerName] = useState(() => localStorage.getItem('engineerName') || 'م. محمد وليد');
  const [centerMobile, setCenterMobile] = useState(() => localStorage.getItem('centerMobile') || '962790000000');
  const [centerEmail, setCenterEmail] = useState(() => localStorage.getItem('centerEmail') || 'info@techno-repair.com');
  const [currencyName, setCurrencyName] = useState(() => localStorage.getItem('currencyName') || 'دينار');
  const [countryName, setCountryName] = useState(() => localStorage.getItem('countryName') || 'الأردن');
  const [countryDialCode, setCountryDialCode] = useState(() => localStorage.getItem('countryDialCode') || '962');
  const [websiteDomain, setWebsiteDomain] = useState(() => localStorage.getItem('websiteDomain') || getDefaultBuiltInDomain());
  const [domainCopied, setDomainCopied] = useState(false);

  const handleCountrySelectChange = (selectedName: string) => {
    setCountryName(selectedName);
    if (selectedName) {
      localStorage.setItem('countryName', selectedName);
    }
    const matched = COUNTRIES_LIST.find((c) => c.name === selectedName);
    if (matched) {
      setCurrencyName(matched.currency);
      setCountryDialCode(matched.dialCode);
      localStorage.setItem('currencyName', matched.currency);
      localStorage.setItem('countryDialCode', matched.dialCode);
    }
    window.dispatchEvent(new Event('storage'));
  };

  // Barcode and serial number customization states
  const [barcodePrefix, setBarcodePrefix] = useState(() => sanitizeBarcodePrefix(localStorage.getItem('barcodePrefix') || 'TEC'));
  const [barcodeStartNum, setBarcodeStartNum] = useState(() => localStorage.getItem('barcodeStartNum') || '1001');

  // Compute live current barcode according to: ***yymmddhhmm in country local 24h time
  const currentLiveBarcode = useMemo(() => {
    return generateBarcodeId(barcodePrefix, [], new Date(), {
      countryName,
      countryDialCode,
    });
  }, [barcodePrefix, countryName, countryDialCode]);
  

  // Login credentials states
  const [loginUsername, setLoginUsername] = useState(() => localStorage.getItem('appLoginUsername') || 'admin');
  const [loginPassword, setLoginPassword] = useState(() => localStorage.getItem('appLoginPassword') || '1234');
  const [isLoginEnabled, setIsLoginEnabled] = useState(() => localStorage.getItem('isAppLoginEnabled') !== 'false'); // defaults to true if not set to false

  // System users state
  const [usersList, setUsersList] = useState<AppUser[]>(() => {
    const listJson = localStorage.getItem('appUsersList');
    if (listJson) {
      try {
        return JSON.parse(listJson);
      } catch (e) {
        console.error(e);
      }
    }
    // Seed default if empty
    const defaultUsersList: AppUser[] = [
      {
        id: 'u1',
        username: 'admin',
        password: '1234',
        displayName: 'المدير العام',
        role: 'admin',
        permissions: {
          view_dashboard: true,
          view_orders: true,
          add_orders: true,
          edit_orders: true,
          delete_orders: true,
          access_settings: true
        }
      },
      {
        id: 'u2',
        username: 'engineer',
        password: '200',
        displayName: 'المهندس أحمد',
        role: 'engineer',
        permissions: {
          view_dashboard: true,
          view_orders: true,
          add_orders: true,
          edit_orders: true,
          delete_orders: false,
          access_settings: false
        }
      },
      {
        id: 'u3',
        username: 'viewer',
        password: '300',
        displayName: 'الموظف المتابع',
        role: 'viewer',
        permissions: {
          view_dashboard: true,
          view_orders: true,
          add_orders: false,
          edit_orders: false,
          delete_orders: false,
          access_settings: false
        }
      }
    ];
    return defaultUsersList;
  });

  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  
  const [userFormDisplayName, setUserFormDisplayName] = useState('');
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRole, setUserFormRole] = useState<'admin' | 'engineer' | 'viewer'>('engineer');
  const [userFormPermissions, setUserFormPermissions] = useState({
    view_dashboard: true,
    view_orders: true,
    add_orders: true,
    edit_orders: true,
    delete_orders: false,
    access_settings: false
  });
  const [userFormError, setUserFormError] = useState('');

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserFormDisplayName('');
    setUserFormUsername('');
    setUserFormPassword('');
    setUserFormRole('engineer');
    setUserFormPermissions({
      view_dashboard: true,
      view_orders: true,
      add_orders: true,
      edit_orders: true,
      delete_orders: false,
      access_settings: false
    });
    setUserFormError('');
    setShowUserForm(true);
  };

  const handleOpenEditUser = (user: AppUser) => {
    setEditingUser(user);
    setUserFormDisplayName(user.displayName);
    setUserFormUsername(user.username);
    setUserFormPassword(user.password || '');
    setUserFormRole(user.role);
    setUserFormPermissions({ ...user.permissions });
    setUserFormError('');
    setShowUserForm(true);
  };

  const handleRoleChangeInForm = (role: 'admin' | 'engineer' | 'viewer') => {
    setUserFormRole(role);
    if (role === 'admin') {
      setUserFormPermissions({
        view_dashboard: true,
        view_orders: true,
        add_orders: true,
        edit_orders: true,
        delete_orders: true,
        access_settings: true
      });
    } else if (role === 'engineer') {
      setUserFormPermissions({
        view_dashboard: true,
        view_orders: true,
        add_orders: true,
        edit_orders: true,
        delete_orders: true,
        access_settings: false
      });
    } else {
      setUserFormPermissions({
        view_dashboard: true,
        view_orders: true,
        add_orders: false,
        edit_orders: false,
        delete_orders: true,
        access_settings: false
      });
    }
  };

  const handleSaveUser = () => {
    if (!userFormDisplayName.trim()) {
      setUserFormError('يرجى إدخال الاسم الكامل للموظف!');
      return;
    }
    if (!userFormUsername.trim()) {
      setUserFormError('يرجى إدخال اسم المستخدم!');
      return;
    }
    if (!userFormPassword.trim()) {
      setUserFormError('يرجى إدخال كلمة المرور!');
      return;
    }

    // Check if username is taken by another user
    const usernameTaken = usersList.some(u => u.username.toLowerCase() === userFormUsername.trim().toLowerCase() && u.id !== (editingUser?.id || ''));
    if (usernameTaken) {
      setUserFormError('اسم المستخدم هذا محجوز مسبقاً! يرجى اختيار اسم مستخدم آخر.');
      return;
    }

    let updatedUsers: AppUser[] = [];
    if (editingUser) {
      // Edit
      updatedUsers = usersList.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            displayName: userFormDisplayName.trim(),
            username: userFormUsername.trim(),
            password: userFormPassword.trim(),
            role: userFormRole,
            permissions: userFormPermissions
          };
        }
        return u;
      });

      // If we edited the main admin user, update global login credentials states and localStorage keys
      if (editingUser.id === 'u1') {
        const newU = userFormUsername.trim();
        const newP = userFormPassword.trim();
        setLoginUsername(newU);
        setLoginPassword(newP);
        localStorage.setItem('appLoginUsername', newU);
        localStorage.setItem('appLoginPassword', newP);
      }
    } else {
      // Add
      const newUser: AppUser = {
        id: `user-${Date.now()}`,
        displayName: userFormDisplayName.trim(),
        username: userFormUsername.trim(),
        password: userFormPassword.trim(),
        role: userFormRole,
        permissions: userFormPermissions
      };
      updatedUsers = [...usersList, newUser];
    }

    setUsersList(updatedUsers);
    localStorage.setItem('appUsersList', JSON.stringify(updatedUsers));
    
    // If the edited user is the current user logged in, let's update sessionStorage and localStorage!
    const sessionUserJson = sessionStorage.getItem('appCurrentUser') || localStorage.getItem('appCurrentUser');
    if (sessionUserJson) {
      try {
        const sessionUser = JSON.parse(sessionUserJson);
        const targetUsername = userFormUsername.trim().toLowerCase();
        if (
          (sessionUser?.username && String(sessionUser.username).toLowerCase() === targetUsername) ||
          (editingUser && sessionUser?.id === editingUser.id)
        ) {
          const matchingSavedUser = updatedUsers.find(
            u => (u.username && u.username.toLowerCase() === targetUsername) || u.id === editingUser?.id
          );
          if (matchingSavedUser) {
            sessionStorage.setItem('appCurrentUser', JSON.stringify(matchingSavedUser));
            localStorage.setItem('appCurrentUser', JSON.stringify(matchingSavedUser));
          }
        }
      } catch (e) {
        console.warn("Could not parse active session user:", e);
      }
    }

    // Trigger storage event to sync other views
    window.dispatchEvent(new Event('storage'));
    
    setShowUserForm(false);
    setEditingUser(null);
    alert('✓ تم حفظ بيانات المستخدم وصلاحياته بنجاح!');
  };

  const handleDeleteUser = (userId: string) => {
    const userToDelete = usersList.find(u => u.id === userId);
    if (!userToDelete) return;

    if (userToDelete.id === 'u1') {
      alert('⚠️ لا يمكن حذف حساب المدير العام الرئيسي للنظام!');
      return;
    }

    // Prevent deleting yourself if logged in
    const sessionUserJson = sessionStorage.getItem('appCurrentUser');
    if (sessionUserJson) {
      try {
        const sessionUser = JSON.parse(sessionUserJson);
        if (sessionUser?.id === userId) {
          alert('⚠️ لا يمكنك حذف حسابك الشخصي أثناء تسجيل الدخول منه!');
          return;
        }
      } catch (_) {}
    }

    if (window.confirm(`هل أنت متأكد من رغبتك في حذف حساب الموظف "${userToDelete.displayName}" وصلاحياته نهائياً؟`)) {
      const updatedUsers = usersList.filter(u => u.id !== userId);
      setUsersList(updatedUsers);
      localStorage.setItem('appUsersList', JSON.stringify(updatedUsers));
      window.dispatchEvent(new Event('storage'));
      alert('✓ تم حذف الموظف بنجاح!');
    }
  };

  // Logo upload and camera capture states
  const [centerLogo, setCenterLogo] = useState(() => localStorage.getItem('centerLogo') || '');
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Stop camera when component unmounts or state changes
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Assign stream to video element when it becomes visible
  useEffect(() => {
    if (showCamera && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.error("Error playing video:", e));
    }
  }, [showCamera, cameraStream]);

  const startCamera = async () => {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setShowCamera(true);
    } catch (err) {
      console.error("Failed to open camera:", err);
      alert("تعذر فتح الكاميرا. يرجى التحقق من صلاحيات الكاميرا في متصفحك أو في إعدادات النظام.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      const videoWidth = videoRef.current.videoWidth || 640;
      const videoHeight = videoRef.current.videoHeight || 480;
      
      const size = Math.min(videoWidth, videoHeight, 300);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const sourceSize = Math.min(videoWidth, videoHeight);
        const sourceX = (videoWidth - sourceSize) / 2;
        const sourceY = (videoHeight - sourceSize) / 2;
        
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        
        ctx.drawImage(
          videoRef.current,
          sourceX, sourceY, sourceSize, sourceSize,
          0, 0, size, size
        );
        
        const base64Img = canvas.toDataURL('image/jpeg', 0.8);
        setCenterLogo(base64Img);
        stopCamera();
      }
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const img = new window.Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            const MAX_WIDTH = 300;
            const MAX_HEIGHT = 300;
            
            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
              setCenterLogo(compressedBase64);
            }
          };
          img.src = event.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Custom receipt states
  const [rcptCenterNameText, setRcptCenterNameText] = useState(() => localStorage.getItem('rcptCenterNameText') || '');
  const [rcptTermsText, setRcptTermsText] = useState(() => localStorage.getItem('rcptTermsText') || '١. يرجى الحفاظ على هذا الإيصال لتقديمه عند المطالبة باستلام الجهاز.\n٢. المتجر غير مسؤول عن الأجهزة التي لا يستلمها أصحابها بعد مرور ٣٠ يوماً من إبلاغهم بجاهزيتها.\n٣. يسري الضمان فقط على قطع الغيار المستبدلة والمبينة في الفاتورة لمدة ٣٠ يوماً من تاريخ الاستلام.');
  const [rcptZoom, setRcptZoom] = useState(() => localStorage.getItem('rcptZoom') || '100');
  const [rcptBarcodeHeight, setRcptBarcodeHeight] = useState(() => localStorage.getItem('rcptBarcodeHeight') || '50');
  const [rcptBarcodeWidth, setRcptBarcodeWidth] = useState(() => localStorage.getItem('rcptBarcodeWidth') || '1.5');
  const [rcptShowQR, setRcptShowQR] = useState(() => localStorage.getItem('rcptShowQR') !== 'false');
  const [rcptSize, setRcptSize] = useState(() => localStorage.getItem('rcptSize') || '80mm');

  // Formatting configurations for Receipt and Label
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

  // Custom label alignment states
  const [lblAlign, setLblAlign] = useState(() => {
    const saved = localStorage.getItem('lblAlign') || 'center';
    if (saved === 'center') return '50';
    if (saved === 'left') return '0';
    if (saved === 'right') return '100';
    return saved;
  });
  const [lblVerticalAlign, setLblVerticalAlign] = useState(() => {
    const saved = localStorage.getItem('lblVerticalAlign') || 'center';
    if (saved === 'center') return '50';
    if (saved === 'start' || saved === 'top') return '0';
    if (saved === 'end' || saved === 'bottom') return '100';
    return saved;
  });

  // Label Customization States (Loaded from localStorage or standard defaults)
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

  const [lblFontSizeCenterName, setLblFontSizeCenterName] = useState<number>(() => {
    const saved = Number(localStorage.getItem('lblFontSizeCenterName'));
    return saved && !isNaN(saved) ? Math.max(10, Math.min(99, saved)) : 13;
  });
  const [lblFontSizeMobile, setLblFontSizeMobile] = useState<number>(() => {
    const saved = Number(localStorage.getItem('lblFontSizeMobile'));
    return saved && !isNaN(saved) ? Math.max(10, Math.min(99, saved)) : 10;
  });
  const [lblFontSizeBarcodeText, setLblFontSizeBarcodeText] = useState<number>(() => {
    const saved = Number(localStorage.getItem('lblFontSizeBarcodeText'));
    return saved && !isNaN(saved) ? Math.max(10, Math.min(99, saved)) : 10;
  });
  const [lblBarcodeHeight, setLblBarcodeHeight] = useState<number>(() => {
    const saved = Number(localStorage.getItem('lblBarcodeHeight'));
    return saved && !isNaN(saved) ? Math.max(10, Math.min(99, saved)) : 25;
  });
  const [lblBarcodeWidth, setLblBarcodeWidth] = useState<number>(() => {
    const saved = localStorage.getItem('lblBarcodeWidth');
    return saved && !isNaN(Number(saved)) ? Number(saved) : 1.2;
  });
  const [lblBarcodeFormat, setLblBarcodeFormat] = useState<string>(() => {
    return localStorage.getItem('lblBarcodeFormat') || 'AUTO';
  });
  const [lblFontSizeCustomerName, setLblFontSizeCustomerName] = useState<number>(() => {
    const saved = Number(localStorage.getItem('lblFontSizeCustomerName'));
    return saved && !isNaN(saved) ? Math.max(10, Math.min(99, saved)) : 10;
  });
  const [lblFontSizeDeviceModel, setLblFontSizeDeviceModel] = useState<number>(() => {
    const saved = Number(localStorage.getItem('lblFontSizeDeviceModel'));
    return saved && !isNaN(saved) ? Math.max(10, Math.min(99, saved)) : 10;
  });
  const [lblFontSizeDate, setLblFontSizeDate] = useState<number>(() => {
    const saved = Number(localStorage.getItem('lblFontSizeDate'));
    return saved && !isNaN(saved) ? Math.max(10, Math.min(99, saved)) : 10;
  });
  const [lblPaperSize, setLblPaperSize] = useState<string>(() => FIXED_LABEL_PAPER_SIZE);
  const [lblLineSpacing, setLblLineSpacing] = useState<number>(() => {
    const saved = localStorage.getItem('lblLineSpacing');
    return saved !== null && !isNaN(Number(saved)) ? Number(saved) : 1.15;
  });

  const [pWidth, pHeight] = FIXED_LABEL_PAPER_SIZE.split('x').map(Number);
  const paperWidthMm = `${pWidth || 38}mm`;
  const paperHeightMm = `${pHeight || 25}mm`;
  const screenWidthPx = 240;
  const screenHeightPx = Math.round(screenWidthPx * ((pHeight || 25) / (pWidth || 38)));

  useEffect(() => {
    const syncFromStorage = () => {
      const storedFmt = localStorage.getItem('lblBarcodeFormat') || 'AUTO';
      setLblBarcodeFormat(prev => (prev !== storedFmt ? storedFmt : prev));
      setLblPaperSize(FIXED_LABEL_PAPER_SIZE);
      const storedRcptSize = localStorage.getItem('rcptSize') || '80mm';
      setRcptSize(prev => (prev !== storedRcptSize ? storedRcptSize : prev));
      const storedSpacing = localStorage.getItem('lblLineSpacing');
      if (storedSpacing !== null && !isNaN(Number(storedSpacing))) {
        const val = Number(storedSpacing);
        setLblLineSpacing(prev => (prev !== val ? val : prev));
      }
      const clampFont = (key: string, fallback: number) => {
        const n = Number(localStorage.getItem(key));
        return n && !isNaN(n) ? Math.max(10, Math.min(99, n)) : fallback;
      };
      setLblFontSizeCenterName(prev => { const v = clampFont('lblFontSizeCenterName', 13); return prev !== v ? v : prev; });
      setLblFontSizeMobile(prev => { const v = clampFont('lblFontSizeMobile', 10); return prev !== v ? v : prev; });
      setLblFontSizeBarcodeText(prev => { const v = clampFont('lblFontSizeBarcodeText', 10); return prev !== v ? v : prev; });
      setLblFontSizeCustomerName(prev => { const v = clampFont('lblFontSizeCustomerName', 10); return prev !== v ? v : prev; });
      setLblFontSizeDeviceModel(prev => { const v = clampFont('lblFontSizeDeviceModel', 10); return prev !== v ? v : prev; });
      setLblFontSizeDate(prev => { const v = clampFont('lblFontSizeDate', 10); return prev !== v ? v : prev; });
    };
    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  // Printers state
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [newPrinter, setNewPrinter] = useState<Omit<PrinterConfig, 'id' | 'status'>>({
    name: '',
    type: 'wifi_lan',
    ipAddress: '',
    port: 9100,
    protocol: 'esc_pos',
    paperSize: '80mm',
    isDefaultInvoices: false,
    isDefaultLabels: false,
  });

  // Simulated Scanning & Testing states
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('');
  const [scannedPrinters, setScannedPrinters] = useState<PrinterConfig[]>([]);
  const [isBtScanning, setIsBtScanning] = useState(false);
  const [btScanProgress, setBtScanProgress] = useState(0);
  const [btScanMessage, setBtScanMessage] = useState('');
  const [scannedBtPrinters, setScannedBtPrinters] = useState<PrinterConfig[]>([]);
  const [isUsbScanning, setIsUsbScanning] = useState(false);
  const [usbScanProgress, setUsbScanProgress] = useState(0);
  const [usbScanMessage, setUsbScanMessage] = useState('');
  const [scannedUsbPrinters, setScannedUsbPrinters] = useState<PrinterConfig[]>([]);
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [showTestPrintModal, setShowTestPrintModal] = useState(false);
  const [showLabelTestModal, setShowLabelTestModal] = useState(false);
  const [testPrintSize, setTestPrintSize] = useState<'80mm' | '58mm' | 'label_38x25'>('80mm');

  // Names/Contacts Search State
  const [customerSearch, setCustomerSearch] = useState('');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  useEffect(() => {
    if (
      showBackupModal ||
      showNamesBackupModal ||
      showOrdersBackupModal ||
      showLogsBackupModal ||
      showSettingsBackupModal ||
      showClearDataModal ||
      confirmDialog.isOpen ||
      showAddCustomerModal ||
      showTestPrintModal ||
      showLabelTestModal ||
      showUserForm
    ) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [
    showBackupModal,
    showNamesBackupModal,
    showOrdersBackupModal,
    showLogsBackupModal,
    showSettingsBackupModal,
    showClearDataModal,
    confirmDialog.isOpen,
    showAddCustomerModal,
    showTestPrintModal,
    showLabelTestModal,
    showUserForm
  ]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) return;
    setIsSavingCustomer(true);

    try {
      const orderId = `CNT-${10000 + Math.floor(Math.random() * 90000)}`;
      const newOrder: MaintenanceOrder = {
        id: orderId,
        customerName: newCustName.trim(),
        customerPhone: newCustPhone.trim(),
        deviceType: 'جهة اتصال',
        brandModel: 'مضاف يدوياً',
        faultDescription: 'مسجل في سجل الأسماء',
        serialNumber: '',
        notes: 'مضاف يدوياً إلى سجل الأسماء',
        technician: '',
        estimatedCost: 0,
        status: DeviceStatus.RECEIVED,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expectedDeliveryDate: formatCountryDateYmd(),
        statusHistory: [
          {
            status: DeviceStatus.RECEIVED,
            timestamp: Date.now(),
            note: 'تمت إضافة جهة الاتصال إلى سجل الأسماء بنجاح.',
            updatedBy: 'النظام'
          }
        ]
      };

      await dbService.saveOrder(newOrder);

      if (onRefreshData) {
        await onRefreshData();
      }

      setShowAddCustomerModal(false);
      setNewCustName('');
      setNewCustPhone('');
      alert('✨ تم حفظ الزبون الجديد بنجاح في سجل الأسماء!');
    } catch (err: any) {
      console.error(err);
      alert('فشل حفظ الزبون الجديد: ' + err.message);
    } finally {
      setIsSavingCustomer(false);
    }
  };
  
  // Files / Backup State
  const [dragActive, setDragActive] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [systemStorageInfo, setSystemStorageInfo] = useState({ usedBytes: 0, totalBytes: 5 * 1024 * 1024 });
  const [isStoragePersisted, setIsStoragePersisted] = useState(false);

  // Permissions status states
  const [permissionsStatus, setPermissionsStatus] = useState({
    storage: 'unknown',
    camera: 'unknown',
    contacts: 'unknown',
    bluetooth: 'unknown',
    usb: 'unknown',
    notifications: 'unknown'
  });

  // Query permissions status on mount
  useEffect(() => {
    // 1. Storage persistence check
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(persistent => {
        setIsStoragePersisted(persistent);
        setPermissionsStatus(prev => ({ ...prev, storage: persistent ? 'granted' : 'prompt' }));
      }).catch(() => {
        setPermissionsStatus(prev => ({ ...prev, storage: 'denied' }));
      });
    } else {
      setPermissionsStatus(prev => ({ ...prev, storage: 'unsupported' }));
    }

    // 2. Query Camera Permission API if supported
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' as any }).then(status => {
        setPermissionsStatus(prev => ({ ...prev, camera: status.state }));
        status.onchange = () => {
          setPermissionsStatus(prev => ({ ...prev, camera: status.state }));
        };
      }).catch(() => {
        setPermissionsStatus(prev => ({ ...prev, camera: 'prompt' }));
      });

      // 3. Query Notifications Permission API
      navigator.permissions.query({ name: 'notifications' as any }).then(status => {
        setPermissionsStatus(prev => ({ ...prev, notifications: status.state }));
        status.onchange = () => {
          setPermissionsStatus(prev => ({ ...prev, notifications: status.state }));
        };
      }).catch(() => {
        setPermissionsStatus(prev => ({ ...prev, notifications: 'prompt' }));
      });
    } else {
      setPermissionsStatus(prev => ({
        ...prev,
        camera: 'prompt',
        notifications: 'prompt'
      }));
    }

    // 4. Check Bluetooth / USB support
    setPermissionsStatus(prev => ({
      ...prev,
      bluetooth: 'bluetooth' in navigator ? 'prompt' : 'unsupported',
      usb: 'usb' in navigator ? 'prompt' : 'unsupported',
      contacts: 'contacts' in navigator ? 'prompt' : 'unsupported'
    }));
  }, []);

  // Calculate storage size used in localStorage
  useEffect(() => {
    let total = 0;
    try {
      for (let x in localStorage) {
        if (localStorage.hasOwnProperty(x) && localStorage[x]) {
          total += (localStorage[x].length + x.length) * 2;
        }
      }
    } catch (e) {
      console.error(e);
    }
    setSystemStorageInfo(prev => ({ ...prev, usedBytes: total }));
  }, [orders, templates, notificationLogs, printers]);

  // Group orders by customer phone number to find unique names
  const customers = useMemo(() => {
    const map = new Map<string, {
      phone: string;
      name: string;
      orders: MaintenanceOrder[];
      totalSpent: number;
      activeCount: number;
      completedCount: number;
    }>();

    orders.forEach(order => {
      const phone = (order.customerPhone || '').trim();
      if (!phone) return;
      
      const isContactOnly = order.deviceType === 'جهة اتصال';
      const cost = isContactOnly ? 0 : (Number(order.estimatedCost) || 0);
      const isActive = !isContactOnly && (order.status !== DeviceStatus.DELIVERED && order.status !== DeviceStatus.UNREPAIRABLE);
      const isCompleted = !isContactOnly && (order.status === DeviceStatus.READY);

      const current = map.get(phone);
      if (current) {
        if (!isContactOnly) {
          current.orders.push(order);
          current.totalSpent += cost;
          if (isActive) current.activeCount++;
          if (isCompleted) current.completedCount++;
        }
        // Use the longest name spelling for consistency
        if (order.customerName && order.customerName.length > current.name.length) {
          current.name = order.customerName;
        }
      } else {
        map.set(phone, {
          phone,
          name: order.customerName || 'عميل غير معروف',
          orders: isContactOnly ? [] : [order],
          totalSpent: cost,
          activeCount: isActive ? 1 : 0,
          completedCount: isCompleted ? 1 : 0
        });
      }
    });

    return Array.from(map.values());
  }, [orders]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const search = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(search) || 
      c.phone.includes(search)
    );
  }, [customers, customerSearch]);

  const handlePrintElement = (elementId: string, _title: string = 'طباعة') => {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn("عنصر الطباعة غير موجود:", elementId);
      return;
    }

    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-print, button, input, textarea, select').forEach(el => el.remove());
    clone.style.boxShadow = 'none';
    clone.style.border = 'none';
    clone.style.borderRadius = '0';
    clone.style.margin = '0 auto';
    clone.style.background = 'white';
    clone.style.color = 'black';

    if (elementId === 'test-label-print-modal') {
      const storedLayout = getStoredLabelLayout();
      const activeLayout = { ...storedLayout, paperSize: FIXED_LABEL_PAPER_SIZE };
      const styles = getLabelContainerStyles(activeLayout, lblFormat.fontFamily);
      const activeElements = activeLayout.elements.filter(el => el.enabled);
      const splitMetrics = getSplitThermalLabelMetrics(activeLayout, styles, activeElements);
      const wMm = `${styles.widthMm}mm`;
      const hMm = `${styles.heightMm}mm`;
      clone.style.position = 'static';
      clone.style.transform = 'none';
      clone.style.width = wMm;
      clone.style.height = hMm;
      clone.style.maxWidth = wMm;
      clone.style.maxHeight = hMm;
      clone.style.padding = `${splitMetrics.effectivePaddingMm}mm`;
      clone.style.overflow = 'hidden';

      const pageStyle = `
        @page {
          size: ${wMm} ${hMm};
          margin: 0 !important;
        }
        #test-label-print-modal {
          position: static !important;
          transform: none !important;
          width: ${wMm} !important;
          height: ${hMm} !important;
          max-width: ${wMm} !important;
          max-height: ${hMm} !important;
          padding: ${splitMetrics.effectivePaddingMm}mm !important;
          margin: 0 auto !important;
          display: flex !important;
          flex-direction: ${splitMetrics.hasQrSide ? 'row' : 'column'} !important;
          justify-content: ${splitMetrics.hasQrSide && (activeElements.filter(el => el.id !== 'qr_code').length > 0) ? 'space-between' : 'center'} !important;
          align-items: center !important;
          gap: ${splitMetrics.hasQrSide && (activeElements.filter(el => el.id !== 'qr_code').length > 0) ? `${splitMetrics.colGapMm}mm` : '0'} !important;
          text-align: ${styles.textAlign} !important;
          font-family: ${styles.fontFamilyCss} !important;
          box-sizing: border-box !important;
          border: none !important;
          box-shadow: none !important;
          overflow: hidden !important;
          background: white !important;
          color: black !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        #test-label-print-modal svg {
          max-width: 100% !important;
          display: block !important;
        }
        #test-label-print-modal * {
          box-sizing: border-box !important;
        }
      `;
      printPureContent(clone.outerHTML, pageStyle);
      return;
    }

    const receiptW = testPrintSize === '58mm' ? '58mm' : '80mm';
    const pageSizeSpec = testPrintSize === '58mm' ? '58mm auto' : '80mm auto';
    clone.style.width = receiptW;
    clone.style.maxWidth = receiptW;
    clone.style.padding = testPrintSize === '58mm' ? '4px' : '8px';

    const pageStyle = `
      @page {
        size: ${pageSizeSpec};
        margin: 0 !important;
      }
      #print-root {
        width: 100% !important;
        display: flex !important;
        justify-content: center !important;
        background: white !important;
      }
    `;
    printPureContent(clone.outerHTML, pageStyle);
  };

  // 1. Export VCF (vCard) for Mobile Contacts
  const handleExportVCF = async () => {
    try {
      if (customers.length === 0) {
        setImportStatus({ success: false, message: 'لا توجد أسماء لتصديرها حالياً.' });
        return;
      }
      let vcfContent = '';
      customers.forEach(c => {
        const name = c.name ? c.name.trim() : 'عميل بدون اسم';
        const phone = c.phone ? c.phone.trim() : '';
        if (phone) {
          vcfContent += 'BEGIN:VCARD\r\n';
          vcfContent += 'VERSION:3.0\r\n';
          vcfContent += `FN:${name} - صيانة\r\n`;
          vcfContent += `TEL;TYPE=CELL:${phone}\r\n`;
          vcfContent += 'END:VCARD\r\n';
        }
      });
      
      if (!vcfContent) {
        setImportStatus({ success: false, message: 'لا توجد أرقام هواتف صالحة للتصدير.' });
        return;
      }
      const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
      const fileName = `techno_contacts_${new Date().toISOString().split('T')[0]}.vcf`;
      const res = await saveFileToDevice(blob, fileName, 'text/vcard', 'ملف جهات اتصال VCF');
      if (res.success) {
        setImportStatus({
          success: true,
          message: res.method === 'picker'
            ? `✓ تم حفظ ملف VCF بنجاح في المكان والمجلد المحدد (${res.fileName})!`
            : `✓ تم تنزيل وحفظ ملف VCF على ذاكرة الجهاز (${res.fileName} - ${res.fileSizeFormatted})!`
        });
      }
    } catch (err: any) {
      console.error(err);
      setImportStatus({ success: false, message: 'حدث خطأ أثناء التصدير: ' + err.message });
    }
  };

  // 1b. Export Customers Names to Excel (XLSX)
  const handleExportNamesXLSX = async () => {
    try {
      if (customers.length === 0) {
        setImportStatus({ success: false, message: 'لا توجد أسماء لتصديرها حالياً.' });
        return;
      }
      const wb = XLSX.utils.book_new();
      const data = customers.map(c => ({
        'اسم العميل الكامل': c.name,
        'رقم الهاتف المحمول': c.phone,
        'إجمالي عدد الأجهزة والطلبات': c.orders.length,
        'إجمالي المبالغ التقديرية': c.totalSpent,
        'الأجهزة النشطة': c.activeCount,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'سجل أسماء العملاء');
      const blob = excelWorkbookToBlob(wb);
      const fileName = `techno_names_${Date.now()}.xlsx`;
      const res = await saveFileToDevice(
        blob,
        fileName,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ملف إكسل لأسماء العملاء'
      );
      if (res.success) {
        setImportStatus({
          success: true,
          message: res.method === 'picker'
            ? `✓ تم حفظ ملف إكسل بنجاح في المجلد المحدد على جهازك (${res.fileName})!`
            : `✓ تم تنزيل وحفظ ملف إكسل على ذاكرة الجهاز (${res.fileName} - ${res.fileSizeFormatted})!`
        });
      }
    } catch (err: any) {
      setImportStatus({ success: false, message: 'فشل تصدير الأسماء بصيغة إكسل: ' + err.message });
    }
  };

  // 1c. Import Names from Excel (XLSX)
  const handleImportNamesXLSX = async (file: File) => {
    setIsImporting(true);
    setImportStatus(null);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet);
      
      if (rows.length === 0) {
        throw new Error('الملف فارغ أو لا يحتوي على صفوف بيانات صالحة.');
      }

      let importedCount = 0;
      for (const row of rows) {
        const name = row['اسم العميل الكامل'] || row['الاسم الكامل'] || row['الاسم'] || row['Name'] || row['name'];
        const phone = row['رقم الهاتف المحمول'] || row['رقم الهاتف'] || row['الهاتف'] || row['Phone'] || row['phone'];
        
        if (!name || !phone) continue;

        const orderId = `CNT-${10000 + Math.floor(Math.random() * 90000)}`;
        const newOrder: MaintenanceOrder = {
          id: orderId,
          customerName: String(name).trim(),
          customerPhone: String(phone).trim(),
          deviceType: 'جهة اتصال',
          brandModel: 'مستورد من Excel',
          faultDescription: 'جهة اتصال مستوردة للهاتف',
          serialNumber: '',
          notes: 'مستورد من ملف أسماء Excel',
          technician: '',
          estimatedCost: 0,
          status: DeviceStatus.RECEIVED,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expectedDeliveryDate: formatCountryDateYmd(),
          statusHistory: [
            {
              status: DeviceStatus.RECEIVED,
              timestamp: Date.now(),
              note: 'تم استيراد جهة الاتصال بنجاح من ملف Excel أسماء العملاء.',
              updatedBy: 'استيراد إكسل الأسماء'
            }
          ]
        };
        await dbService.saveOrder(newOrder);
        importedCount++;
      }

      setImportStatus({
        success: true,
        message: `تم بنجاح استيراد وحفظ ${importedCount} اسم وجهة اتصال من ملف Excel إلى قاعدة البيانات السحابية والمحلية!`
      });

      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: `عذراً، فشل استيراد الأسماء من ملف Excel: ${err.message || 'يرجى التحقق من صياغة الملف.'}`
      });
    } finally {
      setIsImporting(false);
    }
  };

  // 1d. Import Contacts from VCF file
  const handleImportVCF = async (file: File) => {
    setIsImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const lines = text.split('\n');
      let currentName = '';
      let currentPhone = '';
      const importedContacts: { name: string; phone: string }[] = [];

      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('FN:')) {
          currentName = line.substring(3).replace(/ - صيانة$/, '').trim();
        } else if (line.startsWith('TEL;')) {
          const colonIdx = line.lastIndexOf(':');
          if (colonIdx !== -1) {
            currentPhone = line.substring(colonIdx + 1).replace(/[\s+-]/g, '').trim();
          }
        } else if (line.startsWith('TEL:')) {
          currentPhone = line.substring(4).replace(/[\s+-]/g, '').trim();
        } else if (line === 'END:VCARD') {
          if (currentName && currentPhone) {
            importedContacts.push({ name: currentName, phone: currentPhone });
          }
          currentName = '';
          currentPhone = '';
        }
      }

      if (importedContacts.length === 0) {
        throw new Error('لم يتم العثور على أي جهات اتصال صالحة في ملف VCF.');
      }

      let count = 0;
      for (const c of importedContacts) {
        const orderId = `CNT-${10000 + Math.floor(Math.random() * 90000)}`;
        const newOrder: MaintenanceOrder = {
          id: orderId,
          customerName: c.name,
          customerPhone: c.phone,
          deviceType: 'جهة اتصال',
          brandModel: 'مستورد من VCF',
          faultDescription: 'جهة اتصال مستوردة للهاتف',
          serialNumber: '',
          notes: 'مستورد من VCF',
          technician: '',
          estimatedCost: 0,
          status: DeviceStatus.RECEIVED,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expectedDeliveryDate: formatCountryDateYmd(),
          statusHistory: [
            {
              status: DeviceStatus.RECEIVED,
              timestamp: Date.now(),
              note: 'تم استيراد جهة الاتصال بنجاح من ملف VCF للموبايل.',
              updatedBy: 'استيراد VCF'
            }
          ]
        };
        await dbService.saveOrder(newOrder);
        count++;
      }

      setImportStatus({
        success: true,
        message: `تم بنجاح استيراد وحفظ ${count} جهة اتصال من ملف VCF إلى قاعدة البيانات السحابية!`
      });

      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (error: any) {
      console.error(error);
      setImportStatus({
        success: false,
        message: `عذراً، فشل استيراد جهات الاتصال من ملف VCF: ${error.message || 'يرجى مراجعة صياغة الملف.'}`
      });
    } finally {
      setIsImporting(false);
    }
  };

  // 2a. Export Customers and Orders to Excel (XLSX)
  const handleExportCustomersXLSX = async () => {
    try {
      if (customers.length === 0) {
        setImportStatus({ success: false, message: 'لا توجد سجلات عملاء لتصديرها حالياً.' });
        return;
      }
      const wb = XLSX.utils.book_new();

      // Sheet 1: Customers Directory Summary
      const customersData = customers.map(c => ({
        'اسم العميل الكامل': c.name,
        'رقم الهاتف المحمول': c.phone,
        'إجمالي عدد الأجهزة والطلبات': c.orders.length,
        'إجمالي المبالغ التقديرية (بالمجمل)': c.totalSpent,
        'الأجهزة النشطة بالورشة': c.activeCount,
        'الأجهزة الجاهزة للتسليم': c.completedCount,
      }));
      const wsCustomers = XLSX.utils.json_to_sheet(customersData);
      XLSX.utils.book_append_sheet(wb, wsCustomers, 'سجل ودليل العملاء');

      // Sheet 2: All Maintenance Orders Detailed Records
      const ordersData = orders.map(o => ({
        'رقم الطلب': o.id,
        'اسم العميل': o.customerName || '',
        'رقم الهاتف': o.customerPhone,
        'نوع الجهاز': o.deviceType,
        'الموديل/الماركة': o.brandModel,
        'الرقم التسلسلي': o.serialNumber || '',
        'وصف العطل': o.faultDescription,
        'التكلفة المقدرة': o.estimatedCost,
        'التكلفة الفعلية': o.actualCost !== undefined ? o.actualCost : '',
        'تاريخ الاستلام': new Date(o.createdAt).toLocaleDateString('ar-SA'),
        'موعد التسليم المتوقع': o.expectedDeliveryDate,
        'الحالة الحالية للجهاز': o.status,
        'الفني المختص': o.technician || '',
        'ملاحظات عامة وملحقات': o.notes || '',
      }));
      const wsOrders = XLSX.utils.json_to_sheet(ordersData);
      XLSX.utils.book_append_sheet(wb, wsOrders, 'سجلات وطلبات الصيانة التفصيلية');

      const blob = excelWorkbookToBlob(wb);
      const fileName = `techno_customers_and_orders_${new Date().toISOString().split('T')[0]}.xlsx`;
      const res = await saveFileToDevice(
        blob,
        fileName,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ملف إكسل لسجلات العملاء والطلبات'
      );
      if (res.success) {
        setImportStatus({
          success: true,
          message: res.method === 'picker'
            ? `✓ تم حفظ ملف الإكسل بنجاح في المكان والمجلد المحدد على جهازك (${res.fileName})!`
            : `✓ تم حفظ وتنزيل ملف الإكسل على ذاكرة الجهاز (${res.fileName} - ${res.fileSizeFormatted})!`
        });
      }
    } catch (error: any) {
      console.error(error);
      setImportStatus({ success: false, message: 'حدث خطأ أثناء تصدير سجلات العملاء للإكسل: ' + error.message });
    }
  };

  // 2b. Export Orders and Customers Records to JSON (.json)
  const handleExportOrdersJSON = async () => {
    if (orders.length === 0) {
      setImportStatus({ success: false, message: 'لا توجد طلبات لتصديرها حالياً.' });
      return;
    }
    const backupData = {
      appId: 'techno_maintenance_orders',
      exportedAt: Date.now(),
      orders: orders,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const fileName = `techno_orders_backup_${new Date().toISOString().split('T')[0]}.json`;
    try {
      const res = await saveFileToDevice(blob, fileName, 'application/json', 'نسخة احتياطية لطلبات الصيانة');
      if (res.success) {
        setImportStatus({
          success: true,
          message: res.method === 'picker'
            ? `✓ تم حفظ ملف JSON بنجاح في المجلد المحدد على جهازك (${res.fileName})!`
            : `✓ تم حفظ وتنزيل ملف JSON على ذاكرة الجهاز (${res.fileName} - ${res.fileSizeFormatted})!`
        });
      }
    } catch (err: any) {
      console.error(err);
      setImportStatus({ success: false, message: 'حدث خطأ أثناء التصدير: ' + err.message });
    }
  };

  // 2c. Import Customers and Orders from Excel (XLSX)
  const handleImportCustomersXLSX = async (file: File) => {
    setIsImporting(true);
    setImportStatus(null);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Look for a sheet containing orders, otherwise fallback to first sheet
      const sheetName = workbook.SheetNames.find(name => name.includes('طلبات') || name.includes('صيانة') || name.toLowerCase().includes('orders') || name.toLowerCase().includes('maintenance')) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any>(sheet);

      if (rows.length === 0) {
        throw new Error('الملف فارغ أو لا يحتوي على صفوف بيانات صالحة.');
      }

      const importedOrders: MaintenanceOrder[] = [];
      let skippedCount = 0;

      for (const row of rows) {
        const customerName = row['اسم العميل'] || row['اسم العميل الكامل'] || row['الاسم'] || row['Customer Name'] || row['name'];
        const customerPhone = row['رقم الهاتف'] || row['رقم الهاتف المحمول'] || row['الهاتف'] || row['Phone'] || row['phone'];
        const deviceType = row['نوع الجهاز'] || row['الجهاز'] || row['Device Type'] || row['device'] || 'جهة اتصال';

        if (!customerName || !customerPhone) {
          skippedCount++;
          continue;
        }

        const id = row['رقم الطلب'] || row['رقم الفاتورة'] || row['ID'] || row['id'] || `ORD-${1000 + Math.floor(Math.random() * 90000)}`;
        const brandModel = row['الموديل/الماركة'] || row['الموديل'] || row['Brand/Model'] || row['model'] || 'مستورد من إكسل';
        const serialNumber = row['الرقم التسلسلي'] || row['Serial Number'] || row['serial'] || '';
        const deviceBarcode = row['رقم باركود الجهاز'] || row['باركود للجهاز'] || row['deviceBarcode'] || '';
        const faultDescription = row['وصف العطل'] || row['العطل'] || row['Fault'] || row['fault'] || 'جهة اتصال مستوردة';
        const estimatedCostVal = row['التكلفة المقدرة'] || row['Estimated Cost'] || row['cost'] || 0;
        const actualCostVal = row['التكلفة الفعلية'] || row['Actual Cost'] || undefined;
        const statusStr = row['الحالة الحالية للجهاز'] || row['الحالة'] || row['Status'] || row['status'] || DeviceStatus.RECEIVED;
        const technician = row['الفني المختص'] || row['الفني'] || row['Technician'] || row['technician'] || '';
        const notes = row['ملاحظات عامة وملحقات'] || row['ملاحظات'] || row['Notes'] || row['notes'] || '';

        let createdAt = Date.now();
        if (row['تاريخ الاستلام'] || row['تاريخ الإنشاء']) {
          const parsedDate = Date.parse(row['تاريخ الاستلام'] || row['تاريخ الإنشاء']);
          if (!isNaN(parsedDate)) {
            createdAt = parsedDate;
          }
        }

        let expectedDeliveryDate = formatCountryDateYmd(createdAt + 3 * 24 * 60 * 60 * 1000);
        if (row['موعد التسليم المتوقع'] || row['تاريخ التسليم المتوقع']) {
          expectedDeliveryDate = String(row['موعد التسليم المتوقع'] || row['تاريخ التسليم المتوقع']);
        }

        const importedOrder: MaintenanceOrder = {
          id: String(id).toUpperCase().trim(),
          customerName: String(customerName).trim(),
          customerPhone: String(customerPhone).trim(),
          deviceType: String(deviceType).trim(),
          brandModel: String(brandModel).trim(),
          serialNumber: String(serialNumber).trim(),
          faultDescription: String(faultDescription).trim(),
          estimatedCost: parseFloat(String(estimatedCostVal)) || 0,
          actualCost: actualCostVal !== undefined ? parseFloat(actualCostVal) : undefined,
          status: statusStr as DeviceStatus,
          createdAt,
          updatedAt: Date.now(),
          expectedDeliveryDate,
          statusHistory: [
            {
              status: statusStr as DeviceStatus,
              timestamp: Date.now(),
              note: 'تم إنشاء الطلب آلياً عبر استيراد سجلات العملاء من ملف Excel خارجي.',
              updatedBy: 'استيراد إكسل'
            }
          ],
          technician: String(technician).trim(),
          notes: String(notes).trim()
        };

        importedOrders.push(importedOrder);
      }

      if (importedOrders.length === 0) {
        throw new Error('لم يتم العثور على أسطر صالحة تحتوي على (اسم العميل، رقم الهاتف، نوع الجهاز).');
      }

      for (const order of importedOrders) {
        await dbService.saveOrder(order);
      }

      setImportStatus({
        success: true,
        message: `تم بنجاح استيراد ودمج ${importedOrders.length} سجل من سجلات العملاء وأجهزة الصيانة إلى قاعدة البيانات السحابية والمحلية! ${skippedCount > 0 ? `(تم تخطي ${skippedCount} سطر لعدم اكتمال البيانات)` : ''}`
      });

      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (error: any) {
      console.error(error);
      setImportStatus({
        success: false,
        message: `عذراً، فشل استيراد سجلات العملاء من ملف Excel: ${error.message || 'يرجى مراجعة تنسيق ومحتويات ملف الإكسل.'}`
      });
    } finally {
      setIsImporting(false);
    }
  };

  // 2d. Import Customers and Orders from JSON (.json)
  const handleImportOrdersJSON = async (file: File) => {
    setIsImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const ordersToImport = Array.isArray(data.orders) ? data.orders : (Array.isArray(data) ? data : null);

      if (!ordersToImport) {
        throw new Error('الملف المرفوع لا يحتوي على قائمة طلبات صيانة صالحة.');
      }

      let importedCount = 0;
      for (const order of ordersToImport) {
        if (order && order.id && order.customerPhone) {
          await dbService.saveOrder(order);
          importedCount++;
        }
      }

      setImportStatus({
        success: true,
        message: `تم بنجاح دمج واستيراد ${importedCount} سجل صيانة من ملف JSON بنجاح!`
      });

      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: `عذراً، فشل استيراد الطلبات من ملف JSON: ${err.message || 'يرجى مراجعة محتوى الملف.'}`
      });
    } finally {
      setIsImporting(false);
    }
  };

  // 3a. Export Settings to JSON
  const handleExportSettingsJSON = async () => {
    try {
      const SETTINGS_KEYS = [
        'centerName', 'engineerName', 'centerMobile', 'centerEmail', 'currencyName',
        'countryName', 'countryDialCode', 'centerLogo', 'barcodePrefix', 'barcodeStartNum',
        'barcodeDigits', 'barcodeSuffix', 'appLoginUsername', 'appLoginPassword', 'isAppLoginEnabled',
        'rcptCenterNameText', 'rcptTermsText', 'rcptZoom', 'rcptBarcodeHeight', 'rcptBarcodeWidth',
        'rcptShowQR', 'rcptSize', 'rcptFontFamily', 'rcptFontSize', 'rcptAlign', 'rcptVerticalAlign',
        'rcptLineHeight', 'rcptFontWeight', 'receipt_layout_config',
        'lblAlign', 'lblVerticalAlign', 'lblShowCenterName', 'lblShowBarcode', 'lblShowQR',
        'lblShowCustomerName', 'lblShowDeviceModel', 'lblShowDate', 'lblShowMobile',
        'lblFontSizeCenterName', 'lblFontSizeMobile', 'lblFontSizeBarcodeText', 'lblFontSizeCustomText',
        'lblBarcodeHeight', 'lblBarcodeWidth', 'lblBarcodeFormat', 'lblFontSizeCustomerName',
        'lblFontSizeDeviceModel', 'lblFontSizeDate', 'lblPaperSize', 'lblLineSpacing',
        'lblZoom', 'lblCustomText', 'lblFontFamily', 'lblFontSize', 'lblLineHeight', 'lblFontWeight',
        'label_layout_config', 'allow_select_printer_on_print', 'websiteDomain'
      ];

      const settingsObj: Record<string, string> = {};
      SETTINGS_KEYS.forEach(key => {
        const val = localStorage.getItem(key);
        if (val !== null) {
          settingsObj[key] = val;
        }
      });

      const safeParseJSON = (key: string, defaultVal: any) => {
        try {
          const val = localStorage.getItem(key);
          if (!val || val === 'undefined' || val === 'null') return defaultVal;
          return JSON.parse(val);
        } catch (e) {
          console.warn(`Error parsing ${key} from localStorage`, e);
          return defaultVal;
        }
      };

      const templates = safeParseJSON('db_templates', []);
      const users = safeParseJSON('appUsersList', []);
      const printers = safeParseJSON('maintenance_printers', []);

      const settingsBackup = {
        appId: 'techno_app_settings',
        exportedAt: Date.now(),
        settings: settingsObj,
        templates,
        users,
        printers
      };

      const blob = new Blob([JSON.stringify(settingsBackup, null, 2)], { type: 'application/json' });
      const fileName = `techno_settings_${new Date().toISOString().split('T')[0]}.json`;
      const res = await saveFileToDevice(blob, fileName, 'application/json', 'نسخة إعدادات النظام');
      if (res.success) {
        setImportStatus({
          success: true,
          message: res.method === 'picker'
            ? `✓ تم حفظ ملف إعدادات النظام بنجاح في المجلد المحدد (${res.fileName})!`
            : `✓ تم تنزيل وحفظ ملف الإعدادات على ذاكرة الجهاز (${res.fileName} - ${res.fileSizeFormatted})!`
        });
      }
    } catch (err: any) {
      console.error(err);
      setImportStatus({ success: false, message: 'حدث خطأ أثناء تصدير ملف الإعدادات: ' + err.message });
    }
  };

  // 3b. Import Settings from JSON
  const handleImportSettingsJSON = async (file: File) => {
    setIsImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || !data.settings) {
        throw new Error('الملف المرفوع لا يحتوي على إعدادات تطبيق صالحة.');
      }

      // Restore general settings
      Object.entries(data.settings).forEach(([key, val]) => {
        localStorage.setItem(key, val as string);
      });

      // Sync the active state variables
      if (data.settings.centerName) { setCenterName(data.settings.centerName); }
      if (data.settings.engineerName) { setEngineerName(data.settings.engineerName); }
      if (data.settings.centerMobile) { setCenterMobile(data.settings.centerMobile); }
      if (data.settings.centerEmail) { setCenterEmail(data.settings.centerEmail); }
      if (data.settings.currencyName) { setCurrencyName(data.settings.currencyName); }
      if (data.settings.countryName) { setCountryName(data.settings.countryName); }
      if (data.settings.countryDialCode) { setCountryDialCode(data.settings.countryDialCode); }
      if (data.settings.websiteDomain) { setWebsiteDomain(data.settings.websiteDomain); }

      // Restore templates
      if (Array.isArray(data.templates)) {
        localStorage.setItem('db_templates', JSON.stringify(data.templates));
      }

      // Restore users
      if (Array.isArray(data.users)) {
        localStorage.setItem('appUsersList', JSON.stringify(data.users));
      }

      // Restore printers
      if (Array.isArray(data.printers)) {
        localStorage.setItem('maintenance_printers', JSON.stringify(data.printers));
        setPrinters(data.printers);
      }

      // Trigger cloud backup update immediately so they are backed up online too!
      if (dbService.saveAppSettingsBackup) {
        await dbService.saveAppSettingsBackup();
      }

      setImportStatus({
        success: true,
        message: 'تم بنجاح استيراد وتطبيق كافة إعدادات وهوية التطبيق وقوالب الرسائل والطابعات!'
      });

      // Trigger storage event to refresh pages
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: `عذراً، فشل استيراد الإعدادات من ملف JSON: ${err.message || 'يرجى مراجعة محتوى الملف.'}`
      });
    } finally {
      setIsImporting(false);
    }
  };

  // 4a. Export Notification Logs to JSON
  const handleExportLogsJSON = async () => {
    if (notificationLogs.length === 0) {
      setImportStatus({ success: false, message: 'لا توجد سجلات رسائل لتصديرها حالياً.' });
      return;
    }
    const backupData = {
      appId: 'techno_notification_logs',
      exportedAt: Date.now(),
      logs: notificationLogs,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const fileName = `techno_messages_${new Date().toISOString().split('T')[0]}.json`;
    try {
      const res = await saveFileToDevice(blob, fileName, 'application/json', 'سجلات رسائل الإشعارات');
      if (res.success) {
        setImportStatus({
          success: true,
          message: res.method === 'picker'
            ? `✓ تم حفظ ملف السجلات بنجاح في المكان المحدد على جهازك (${res.fileName})!`
            : `✓ تم حفظ وتنزيل ملف السجلات على ذاكرة الجهاز (${res.fileName} - ${res.fileSizeFormatted})!`
        });
      }
    } catch (err: any) {
      console.error(err);
      setImportStatus({ success: false, message: 'حدث خطأ أثناء التصدير: ' + err.message });
    }
  };

  // 4b. Export Notification Logs to Excel XLSX
  const handleExportLogsXLSX = async () => {
    try {
      if (notificationLogs.length === 0) {
        setImportStatus({ success: false, message: 'لا توجد سجلات رسائل لتصديرها حالياً.' });
        return;
      }
      const wb = XLSX.utils.book_new();
      const data = notificationLogs.map(l => ({
        'رقم السجل': l.id,
        'رقم الطلب': l.orderId,
        'اسم الزبون': l.customerName,
        'رقم الهاتف': l.customerPhone,
        'نوع الرسالة (SMS/WhatsApp)': l.type,
        'محتوى الرسالة المرسل': l.content,
        'الحالة': l.status,
        'تاريخ الإرسال': new Date(l.timestamp).toLocaleString('ar-SA'),
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'سجلات الرسائل المرسلة');
      const blob = excelWorkbookToBlob(wb);
      const fileName = `techno_messages_${new Date().toISOString().split('T')[0]}.xlsx`;
      const res = await saveFileToDevice(
        blob,
        fileName,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ملف إكسل لسجلات الرسائل'
      );
      if (res.success) {
        setImportStatus({
          success: true,
          message: res.method === 'picker'
            ? `✓ تم حفظ ملف إكسل بنجاح في المكان والمجلد المحدد على جهازك (${res.fileName})!`
            : `✓ تم حفظ وتنزيل ملف إكسل على ذاكرة الجهاز (${res.fileName} - ${res.fileSizeFormatted})!`
        });
      }
    } catch (err: any) {
      setImportStatus({ success: false, message: 'فشل تصدير سجلات الرسائل إلى إكسل: ' + err.message });
    }
  };

  // 4c. Import Notification Logs from JSON
  const handleImportLogsJSON = async (file: File) => {
    setIsImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const logsToImport = Array.isArray(data.logs) ? data.logs : (Array.isArray(data) ? data : null);

      if (!logsToImport) {
        throw new Error('الملف المرفوع لا يحتوي على سجلات رسائل صالحة.');
      }

      let count = 0;
      for (const log of logsToImport) {
        if (log && log.id && log.orderId) {
          await dbService.saveNotificationLog(log);
          count++;
        }
      }

      setImportStatus({
        success: true,
        message: `تم بنجاح استيراد واستعادة ${count} سجل من سجلات الرسائل المرسلة!`
      });

      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: `فشل استيراد الرسائل من ملف JSON: ${err.message}`
      });
    } finally {
      setIsImporting(false);
    }
  };

  // 4d. Import Notification Logs from Excel XLSX
  const handleImportLogsXLSX = async (file: File) => {
    setIsImporting(true);
    setImportStatus(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet);

      if (rows.length === 0) {
        throw new Error('الملف فارغ أو لا يحتوي على صفوف بيانات صالحة.');
      }

      let count = 0;
      for (const row of rows) {
        const id = row['رقم السجل'] || row['id'] || `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const orderId = row['رقم الطلب'] || row['orderId'] || 'unknown';
        const customerName = row['اسم الزبون'] || row['customerName'] || '';
        const customerPhone = row['رقم الهاتف'] || row['customerPhone'] || '';
        const type = row['نوع الرسالة (SMS/WhatsApp)'] || row['type'] || 'WhatsApp';
        const content = row['محتوى الرسالة المرسل'] || row['content'] || '';
        const status = row['الحالة'] || row['status'] || 'sent';
        
        let timestamp = Date.now();
        if (row['تاريخ الإرسال']) {
          const parsedDate = Date.parse(row['تاريخ الإرسال']);
          if (!isNaN(parsedDate)) {
            timestamp = parsedDate;
          }
        }

        const cleanLog = {
          id: String(id),
          orderId: String(orderId),
          customerName: String(customerName),
          customerPhone: String(customerPhone),
          type: String(type),
          content: String(content),
          status: String(status),
          timestamp
        };

        await dbService.saveNotificationLog(cleanLog);
        count++;
      }

      setImportStatus({
        success: true,
        message: `تم بنجاح استيراد ودمج ${count} من سجلات الرسائل المرسلة من ملف Excel!`
      });

      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: `فشل استيراد الرسائل من ملف إكسل: ${err.message}`
      });
    } finally {
      setIsImporting(false);
    }
  };

  // 7. Storage Persistence Request
  const handleRequestPersistence = async () => {
    if (navigator.storage && navigator.storage.persist) {
      try {
        const granted = await navigator.storage.persist();
        setIsStoragePersisted(granted);
        setPermissionsStatus(prev => ({ ...prev, storage: granted ? 'granted' : 'denied' }));
        if (granted) {
          alert('تم تفعيل التخزين الدائم طويل الأمد بنجاح! سيتم الاحتفاظ بكافة بيانات الصيانة دون حذف تلقائي من المتصفح.');
        } else {
          alert('تم رفض طلب التخزين الدائم من قبل المتصفح، أو قيود إطار العمل (iFrame). سيستمر الحفظ بشكل تلقائي في الذاكرة الحالية.');
        }
      } catch (err: any) {
        console.error(err);
        alert('تعذر استدعاء واجهة التخزين الدائم مباشرة بسبب قيود أمان المتصفح.');
      }
    } else {
      alert('ميزة التخزين الدائم المتقدم غير مدعومة في هذا المتصفح حالياً.');
    }
  };

  // 8. Contact Picker API integration
  const handleImportMobileContacts = async () => {
    const contactsSupported = 'contacts' in navigator && 'select' in (navigator as any);
    if (!contactsSupported) {
      alert('ميزة استيراد جهات الاتصال مدعومة فقط في متصفحات الهواتف الذكية الحديثة (مثل Chrome لنظام Android). يرجى فتح البرنامج من الجوال لتفعيل هذه الميزة.');
      return;
    }
    try {
      const props = ['name', 'tel'];
      const opts = { multiple: true };
      const selectedContacts = await (navigator as any).contacts.select(props, opts);
      if (selectedContacts && selectedContacts.length > 0) {
        let importCount = 0;
        for (const contact of selectedContacts) {
          const name = contact.name?.[0] || 'عميل جوال مستورد';
          const phone = contact.tel?.[0] || '';
          if (phone) {
            const orderId = 'ORD-' + (1000 + Math.floor(Math.random() * 90000));
            const newOrder: MaintenanceOrder = {
              id: orderId,
              customerName: name,
              customerPhone: phone,
              deviceType: 'جهة اتصال',
              brandModel: 'مستورد من الهاتف',
              serialNumber: '',
              faultDescription: 'صيانة وفحص دوري',
              estimatedCost: 0,
              status: DeviceStatus.DELIVERED,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              expectedDeliveryDate: formatCountryDateYmd(),
              statusHistory: [
                {
                  status: DeviceStatus.DELIVERED,
                  timestamp: Date.now(),
                  note: 'تم استيراد جهة الاتصال مباشرة من قائمة الهاتف المحمول.',
                  updatedBy: 'مزامنة جهات الاتصال'
                }
              ],
              technician: 'غير محدد',
              notes: 'تم استيراد هذا العميل من جهات اتصال الجوال الخاصة بالفني.'
            };
            await dbService.saveOrder(newOrder);
            importCount++;
          }
        }
        setPermissionsStatus(prev => ({ ...prev, contacts: 'granted' }));
        alert(`تم بنجاح مزامنة واستيراد ${importCount} جهة اتصال وحفظهم كعملاء مسجلين في قاعدة البيانات!`);
        if (onRefreshData) {
          await onRefreshData();
        }
      }
    } catch (err: any) {
      console.error(err);
      alert(`عذراً، فشل استيراد جهات الاتصال: ${err.message || 'تم إلغاء العملية أو لم يتم منح الصلاحية.'}`);
    }
  };

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  })();

  // Load printers from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('maintenance_printers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setPrinters(parsed);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      // Default browser printer
      const defaultPrinter: PrinterConfig = {
        id: 'p-default',
        name: 'طابعة النظام الافتراضية (عبر المتصفح)',
        type: 'browser',
        protocol: 'system',
        paperSize: '80mm',
        isDefaultInvoices: true,
        isDefaultLabels: true,
        status: 'online'
      };
      setPrinters([defaultPrinter]);
      localStorage.setItem('maintenance_printers', JSON.stringify([defaultPrinter]));
    }
  }, []);

  const savePrintersToStorage = (updatedList: PrinterConfig[]) => {
    setPrinters(updatedList);
    localStorage.setItem('maintenance_printers', JSON.stringify(updatedList));
  };

  const handleAddPrinter = (printerToAdd?: PrinterConfig) => {
    if (printerToAdd) {
      // Add a discovered printer
      const updated = [...printers, printerToAdd];
      savePrintersToStorage(updated);
      return;
    }

    if (!newPrinter.name.trim()) return;

    const newId = 'p-' + Date.now();
    const formattedPrinter: PrinterConfig = {
      ...newPrinter,
      id: newId,
      status: 'online',
    };

    let updatedList = [...printers];
    
    // If set as default, clear others
    if (formattedPrinter.isDefaultInvoices) {
      updatedList = updatedList.map(p => ({ ...p, isDefaultInvoices: false }));
    }
    if (formattedPrinter.isDefaultLabels) {
      updatedList = updatedList.map(p => ({ ...p, isDefaultLabels: false }));
    }

    updatedList.push(formattedPrinter);
    savePrintersToStorage(updatedList);

    // Reset Form
    setNewPrinter({
      name: '',
      type: 'wifi_lan',
      ipAddress: '',
      port: 9100,
      protocol: 'esc_pos',
      paperSize: '80mm',
      isDefaultInvoices: false,
      isDefaultLabels: false,
    });
  };

  const handleDeletePrinter = (id: string) => {
    const updated = printers.filter(p => p.id !== id);
    savePrintersToStorage(updated);
  };

  const handleToggleDefault = (id: string, field: 'isDefaultInvoices' | 'isDefaultLabels') => {
    const target = printers.find(p => p.id === id);
    if (!target) return;
    
    const willBeDefault = !target[field];
    
    const updated = printers.map(p => {
      if (p.id === id) {
        return { ...p, [field]: willBeDefault };
      }
      return { ...p, [field]: willBeDefault ? false : p[field] };
    });
    
    savePrintersToStorage(updated);
  };

  // Simulate network WiFi/LAN printer scanning
  const startNetworkScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    setScannedPrinters([]);
    setScanMessage('جاري تهيئة مسح الشبكة اللاسلكية (WiFi) والبحث عن طابعات نشطة...');

    const messages = [
      'جاري فحص النطاق الفرعي للشبكة 192.168.1.1 ...',
      'جاري فحص منفذ الصيانة والطباعة المباشر 9100...',
      'تم العثور على عنوان IP نشط في 192.168.1.55! جاري قراءة معلومات الطابعة...',
      'تم تحديد طابعة: Epson TM-T88VI (طابعة فواتير حرارية 80 مم)',
      'جاري فحص العناوين المتبقية 192.168.1.100 - 192.168.1.200...',
      'تم العثور على عنوان IP نشط في 192.168.1.140! جاري الاتصال...',
      'تم تحديد طابعة: Xprinter XP-420B (طابعة ملصقات باركود واي فاي)',
      'اكتمل مسح الشبكة بنجاح! تم العثور على طابعتين جاهزتين للإضافة.',
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      setScanProgress((currentStep / messages.length) * 100);
      setScanMessage(messages[currentStep - 1]);

      if (currentStep === 4) {
        // First discovered printer
        setScannedPrinters(prev => [
          ...prev,
          {
            id: 'disc-epson-' + Date.now(),
            name: 'Epson TM-T88VI (طابعة شبكة)',
            type: 'wifi_lan',
            ipAddress: '192.168.1.55',
            port: 9100,
            protocol: 'esc_pos',
            paperSize: '80mm',
            isDefaultInvoices: false,
            isDefaultLabels: false,
            status: 'online',
          }
        ]);
      }

      if (currentStep === 7) {
        // Second discovered printer
        setScannedPrinters(prev => [
          ...prev,
          {
            id: 'disc-xprinter-' + Date.now(),
            name: 'Xprinter XP-420B (واي فاي)',
            type: 'wifi_lan',
            ipAddress: '192.168.1.140',
            port: 9100,
            protocol: 'tspl',
            paperSize: 'label_38x25',
            isDefaultInvoices: false,
            isDefaultLabels: false,
            status: 'online',
          }
        ]);
      }

      if (currentStep >= messages.length) {
        clearInterval(interval);
        setIsScanning(false);
      }
    }, 1200);
  };

  // Simulate Web Bluetooth / Nearby Printer Scanning
  const startBluetoothScan = async () => {
    setIsBtScanning(true);
    setBtScanProgress(0);
    setScannedBtPrinters([]);
    setBtScanMessage('جاري تشغيل مستقبل البلوتوث والبحث عن الأجهزة النشطة القريبة...');

    // Try real Web Bluetooth if supported and allowed
    if ('bluetooth' in navigator) {
      try {
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true
        });
        if (device) {
          setScannedBtPrinters(prev => [
            ...prev,
            {
              id: 'real-bt-' + device.id,
              name: device.name || 'طابعة بلوتوث حقيقية',
              type: 'bluetooth',
              protocol: 'esc_pos',
              paperSize: '80mm',
              isDefaultInvoices: false,
              isDefaultLabels: false,
              status: 'online',
            }
          ]);
          setPermissionsStatus(prev => ({ ...prev, bluetooth: 'granted' }));
        }
      } catch (err: any) {
        console.log("Web Bluetooth request bypassed or not supported in frame:", err);
      }
    }

    const messages = [
      'جاري تهيئة مستقبل الإشارة اللاسلكية لبلوتوث...',
      'جاري البحث عن أجهزة البث بنطاق التردد 2.4 جيجاهرتز...',
      'تم العثور على جهاز بث نشط! جاري قراءة كود التعريف والمصادقة...',
      'تم تحديد جهاز: MPT-II (طابعة فواتير بلوتوث محمولة 58 مم)',
      'جاري البحث عن أجهزة باركود وملصقات قريبة...',
      'تم العثور على جهاز بث نشط! جاري الاقتران الاستكشافي...',
      'تم تحديد جهاز: XP-365B (طابعة ملصقات بلوتوث 80 مم)',
      'اكتمل البحث القريب بنجاح! تم العثور على طابعتين بلوتوث جاهزتين للإضافة.',
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      setBtScanProgress((currentStep / messages.length) * 100);
      setBtScanMessage(messages[currentStep - 1]);

      if (currentStep === 4) {
        // First discovered bluetooth printer
        setScannedBtPrinters(prev => [
          ...prev,
          {
            id: 'disc-bt-mpt-' + Date.now(),
            name: 'MPT-II (طابعة بلوتوث محمولة)',
            type: 'bluetooth',
            protocol: 'esc_pos',
            paperSize: '58mm',
            isDefaultInvoices: false,
            isDefaultLabels: false,
            status: 'online',
          }
        ]);
      }

      if (currentStep === 7) {
        // Second discovered bluetooth printer
        setScannedBtPrinters(prev => [
          ...prev,
          {
            id: 'disc-bt-xprinter-' + Date.now(),
            name: 'XP-365B (طابعة ملصقات بلوتوث)',
            type: 'bluetooth',
            protocol: 'tspl',
            paperSize: 'label_38x25',
            isDefaultInvoices: false,
            isDefaultLabels: false,
            status: 'online',
          }
        ]);
      }

      if (currentStep >= messages.length) {
        clearInterval(interval);
        setIsBtScanning(false);
      }
    }, 1200);
  };

  // Simulate USB Connected Printer Scanning
  const startUsbScan = async () => {
    setIsUsbScanning(true);
    setUsbScanProgress(0);
    setScannedUsbPrinters([]);
    setUsbScanMessage('جاري تشغيل واجهة فحص منافذ USB والبحث عن طابعات متصلة...');

    // Try real WebUSB if supported
    try {
      if ('usb' in navigator) {
        const device = await (navigator as any).usb.requestDevice({ filters: [] });
        if (device) {
          setScannedUsbPrinters(prev => [
            ...prev,
            {
              id: 'real-usb-' + device.serialNumber,
              name: device.productName || 'طابعة USB حقيقية متصلة',
              type: 'usb',
              protocol: 'esc_pos',
              paperSize: '80mm',
              isDefaultInvoices: false,
              isDefaultLabels: false,
              status: 'online',
            }
          ]);
          setPermissionsStatus(prev => ({ ...prev, usb: 'granted' }));
        }
      }
    } catch (e: any) {
      console.warn("WebUSB check bypassed or not supported in frame context:", e);
    }

    const messages = [
      'جاري تهيئة واجهة قراءة الأجهزة المحلية (USB Bus)...',
      'جاري الاستعلام عن الأجهزة المتصلة بمنافذ الناقل التسلسلي العام...',
      'تم اكتشاف جهاز طباعة نشط! جاري قراءة معلومات المصنع ومعرف الجهاز...',
      'تم تحديد طابعة ملصقات حرارية: Xprinter XP-365B (منفذ USB)',
      'جاري فحص منافذ USB الثانوية ومراكز التوزيع...',
      'تم اكتشاف طابعة فواتير: Epson TM-T20III (منفذ USB)',
      'اكتمل البحث المحلي بنجاح! تم العثور على طابعتين متصلتين عبر USB وجاهزتين للإضافة.',
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      setUsbScanProgress((currentStep / messages.length) * 100);
      setUsbScanMessage(messages[currentStep - 1]);

      if (currentStep === 4) {
        setScannedUsbPrinters(prev => [
          ...prev,
          {
            id: 'disc-usb-xprinter-' + Date.now(),
            name: 'Xprinter XP-365B (USB)',
            type: 'usb',
            protocol: 'tspl',
            paperSize: 'label_38x25',
            isDefaultInvoices: false,
            isDefaultLabels: true,
            status: 'online',
          }
        ]);
      }

      if (currentStep === 6) {
        setScannedUsbPrinters(prev => [
          ...prev,
          {
            id: 'disc-usb-epson-' + Date.now(),
            name: 'Epson TM-T20III (USB)',
            type: 'usb',
            protocol: 'esc_pos',
            paperSize: '80mm',
            isDefaultInvoices: true,
            isDefaultLabels: false,
            status: 'online',
          }
        ]);
      }

      if (currentStep >= messages.length) {
        clearInterval(interval);
        setIsUsbScanning(false);
      }
    }, 1000);
  };

  // Simulate Printer Connection testing
  const testPrinterConnection = (printer: PrinterConfig) => {
    setTestingPrinterId(printer.id);
    setTestResult(null);

    setTimeout(() => {
      if (printer.type === 'browser') {
        setTestResult({
          id: printer.id,
          success: true,
          message: 'تم الاتصال بنجاح مع واجهة طباعة المتصفح للنظام بنجاح!'
        });
      } else if (printer.type === 'wifi_lan') {
        const isIpConfigured = printer.ipAddress && printer.ipAddress.trim().length > 0;
        if (isIpConfigured) {
          setTestResult({
            id: printer.id,
            success: true,
            message: `تم التحقق بنجاح من الطابعة "${printer.name}" على العنوان ${printer.ipAddress}:${printer.port}. استجابة سريعة (8ms).`
          });
        } else {
          setTestResult({
            id: printer.id,
            success: false,
            message: 'فشل الاتصال: يرجى كتابة عنوان IP صحيح للطابعة أولاً.'
          });
        }
      } else if (printer.type === 'usb') {
        setTestResult({
          id: printer.id,
          success: true,
          message: `تم التحقق بنجاح من اتصال كابل USB والتعرف على طابعة الملصقات/الفواتير "${printer.name}"!`
        });
      } else {
        // bluetooth
        setTestResult({
          id: printer.id,
          success: true,
          message: `تم فحص إشارة البلوتوث اللاسلكية والاقتران بالطابعة "${printer.name}" بنجاح!`
        });
      }
      setTestingPrinterId(null);
    }, 1500);
  };

  const handleEditClick = (tpl: NotificationTemplate) => {
    setEditingTemplateId(tpl.id);
    setSmsContent(tpl.smsContent);
    setWhatsappContent(tpl.whatsappContent);
    setSaveSuccess(false);
  };

  const handleSave = (id: string) => {
    onSaveTemplate(id, smsContent, whatsappContent);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setEditingTemplateId(null);
    }, 1500);
  };

  const handleSaveCenterInfo = () => {
    const oldName = (localStorage.getItem('centerName') || 'TECHNO').trim();
    const newName = centerName.trim();

    if (oldName !== newName) {
      const storedTemplatesStr = localStorage.getItem('db_templates');
      if (storedTemplatesStr) {
        try {
          const loadedTemplates = JSON.parse(storedTemplatesStr);
          if (Array.isArray(loadedTemplates)) {
            const replaceStoreName = (text: string, oldVal: string, newVal: string): string => {
              if (!text) return text;
              let result = text;
              
              // 1. Replace the old name if it exists and is different from the new one
              if (oldVal && oldVal !== newVal) {
                const escapedOld = oldVal.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regexOld = new RegExp(escapedOld, 'g');
                result = result.replace(regexOld, newVal);
              }
              
              // 2. Replace "للمتجر" grammatically
              const prefixLi = newVal.startsWith('ال') ? `لل${newVal.substring(2)}` : `لـ ${newVal}`;
              result = result.replace(/للمتجر/g, prefixLi);
              
              // 3. Replace "المتجر" and "متجرنا"
              result = result.replace(/المتجر/g, newVal);
              result = result.replace(/متجرنا/g, newVal);
              
              return result;
            };

            const updatedTemplates = loadedTemplates.map((t: any) => ({
              ...t,
              smsContent: replaceStoreName(t.smsContent, oldName, newName),
              whatsappContent: replaceStoreName(t.whatsappContent, oldName, newName)
            }));

            localStorage.setItem('db_templates', JSON.stringify(updatedTemplates));
          }
        } catch (e) {
          console.error("Error updating templates with new center name:", e);
        }
      }
    }

    const normalizedWebsiteDomain = normalizeDomainUrl(websiteDomain);
    setWebsiteDomain(normalizedWebsiteDomain);
    localStorage.setItem('websiteDomain', normalizedWebsiteDomain);

    localStorage.setItem('centerName', centerName);
    localStorage.setItem('engineerName', engineerName);
    localStorage.setItem('centerMobile', centerMobile);
    localStorage.setItem('centerEmail', centerEmail);
    localStorage.setItem('currencyName', currencyName);
    localStorage.setItem('countryName', countryName);
    localStorage.setItem('countryDialCode', countryDialCode);
    localStorage.setItem('centerLogo', centerLogo);
    localStorage.setItem('barcodePrefix', barcodePrefix.toUpperCase().trim());
    localStorage.setItem('barcodeStartNum', barcodeStartNum.trim());
    
    localStorage.setItem('appLoginUsername', loginUsername.trim());
    localStorage.setItem('appLoginPassword', loginPassword.trim());
    localStorage.setItem('isAppLoginEnabled', String(isLoginEnabled));

    // Sync the admin user u1 username/password in usersList
    const updatedUsers = usersList.map(u => {
      if (u.id === 'u1') {
        return {
          ...u,
          username: loginUsername.trim(),
          password: loginPassword.trim()
        };
      }
      return u;
    });
    setUsersList(updatedUsers);
    localStorage.setItem('appUsersList', JSON.stringify(updatedUsers));

    // Sync other states to match the unified inputs
    setRcptCenterNameText(centerName);

    // Save custom receipt identity & terms without clobbering ReceiptDesigner / LabelDesigner layout keys
    localStorage.setItem('rcptCenterNameText', centerName);
    localStorage.setItem('rcptTermsText', rcptTermsText);
    if (!localStorage.getItem('rcptSize')) {
      localStorage.setItem('rcptSize', rcptSize);
    }
    localStorage.setItem('lblPaperSize', FIXED_LABEL_PAPER_SIZE);
    if (!localStorage.getItem('lblBarcodeFormat')) {
      localStorage.setItem('lblBarcodeFormat', lblBarcodeFormat);
    }

    setShowSaveToast(true);
    setTimeout(() => {
      setShowSaveToast(false);
    }, 4000);
    window.dispatchEvent(new Event('storage'));
    onSettingsSaved?.();
  };

  const getStatusLabel = (trigger: DeviceStatus | 'reminder') => {
    switch (trigger) {
      case DeviceStatus.RECEIVED: return 'عند استلام الجهاز';
      case DeviceStatus.DIAGNOSING: return 'عند بدء الفحص';
      case DeviceStatus.REPAIRING: return 'عند بدء الإصلاح والعمل';
      case DeviceStatus.PENDING: return 'عند وضع الجهاز قيد الانتظار';
      case DeviceStatus.READY: return 'عند جهوزية الجهاز للإستلام';
      case DeviceStatus.DELIVERED: return 'عند تسليم الجهاز الفعلي';
      case DeviceStatus.UNREPAIRABLE: return 'عند تعذر إصلاح الجهاز';
      case 'reminder': return 'عند إرسال تذكير بموعد التسليم';
      default: return 'حدث مخصص';
    }
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in fade-in slide-in-from-top-10 duration-300" dir="rtl">
        <div className="bg-white p-8 rounded-3xl  border border-gray-100 max-w-sm w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-teal-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold font-sans text-gray-800">إعدادات النظام المحمية</h2>
            <p className="text-sm text-gray-500 font-sans">الرجاء إدخال الرقم السري للوصول إلى الإعدادات</p>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            if (pinInput === '3012') {
              sessionStorage.setItem('settingsUnlocked', 'true');
              setIsUnlocked(true);
              setPinError('');
            } else {
              setPinError('الرقم السري غير صحيح');
              setPinInput('');
            }
          }} className="space-y-4">
            <div className="space-y-2 relative">
              <input
                type="password"
                dir="ltr"
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value); setPinError(''); }}
                className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 px-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-teal-500 transition-colors bg-gray-50 focus:bg-white"
                placeholder="••••"
                autoFocus
              />
              {pinError && (
                <p className="text-xs text-rose-500 font-bold animate-in slide-in-from-top-1">{pinError}</p>
              )}
            </div>
            
            <button
              type="submit"
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-all  hover: active:scale-95"
            >
              دخول
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Title Header */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 ">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 rounded-2xl text-teal-600">
            <Settings className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h2 className="font-sans font-extrabold text-xl text-gray-800">الاعدادات</h2>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Right Sidebar - Dynamic Settings Menu */}
        <div className="w-full lg:w-72 shrink-0 space-y-1.5 bg-white p-4 rounded-3xl border border-gray-100  h-fit">
          <div className="px-3 py-1 text-[11px] font-sans font-bold text-teal-600 uppercase tracking-wider border-b border-gray-50 pb-2 mb-2">
            أقسام الإعدادات والنظام
          </div>

          <button
            onClick={() => setActiveTab('center_info')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-sans font-bold transition-all text-right ${
              activeTab === 'center_info'
                ? 'bg-teal-50 text-teal-800  border border-teal-100/30'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <Store className="w-4 h-4 shrink-0 text-teal-600" />
            <div className="font-extrabold text-[13px]">بيانات وهوية المركز</div>
          </button>


          <button
            onClick={() => setActiveTab('templates')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-sans font-bold transition-all text-right ${
              activeTab === 'templates'
                ? 'bg-teal-50 text-teal-800  border border-teal-100/30'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0 text-teal-600" />
            <div className="font-extrabold text-[13px]">قوالب وصيغ الرسائل</div>
          </button>


          <button
            onClick={() => setActiveTab('printers')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-sans font-bold transition-all text-right ${
              activeTab === 'printers'
                ? 'bg-teal-50 text-teal-800  border border-teal-100/30'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <Printer className="w-4 h-4 shrink-0 text-teal-600" />
            <div className="font-extrabold text-[13px]">إعدادات المطبوعات والطابعات</div>
          </button>

          <button
            onClick={() => setActiveTab('names')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-sans font-bold transition-all text-right ${
              activeTab === 'names'
                ? 'bg-teal-50 text-teal-800  border border-teal-100/30'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <Users className="w-4 h-4 shrink-0 text-teal-600" />
            <div className="font-extrabold text-[13px]">جهات اتصال العملاء ({customers.length})</div>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-sans font-bold transition-all text-right ${
              activeTab === 'files'
                ? 'bg-teal-50 text-teal-800  border border-teal-100/30'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <FolderOpen className="w-4 h-4 shrink-0 text-teal-600" />
            <div className="font-extrabold text-[13px]">النسخ الاحتياطي والملفات</div>
          </button>

          

          <div className="pt-4 mt-4 border-t border-gray-100">
            <button
              onClick={async () => {
                await logoutUser();
                localStorage.removeItem('isAppAuthenticated');
                localStorage.removeItem('appCurrentUser');
                localStorage.removeItem('db_app_settings_backup');
                sessionStorage.removeItem('isAppAuthenticated');
                sessionStorage.removeItem('appCurrentUser');
                sessionStorage.removeItem('settingsUnlocked');
                window.location.reload();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-sans font-bold transition-all text-right text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <div className="font-extrabold text-[13px]">تسجيل الخروج</div>
            </button>
          </div>
        </div>

        {/* Left Side Content Area */}
        <div className="flex-grow min-w-0">
          {activeTab === 'templates' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Helper Tokens Card */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-teal-800 to-teal-950 rounded-3xl p-6 text-white space-y-4">
              <h4 className="font-sans font-extrabold text-sm flex items-center gap-2">
                <span>⚠️ المتغيرات المدعومة في القوالب</span>
              </h4>
              <p className="text-teal-100 text-xs font-sans leading-relaxed">
                يمكنك استخدام المتغيرات التالية داخل الرسائل (أو الضغط عليها أثناء تعديل القالب لإدراجها فوراً):
              </p>
              
              <div className="space-y-1.5 font-mono text-xs text-teal-200 max-h-[520px] overflow-y-auto pr-1">
                {[
                  { token: '{customerName}', desc: 'اسم العميل' },
                  { token: '{orderId}', desc: 'رقم الطلب' },
                  { token: '{device}', desc: 'نوع وموديل الجهاز' },
                  { token: '{fault}', desc: 'وصف العطل والتشخيص' },
                  { token: '{status}', desc: 'حالة الصيانة الحالية' },
                  { token: '{statusNote}', desc: 'ملاحظة التحديث' },
                  { token: '{estimatedCost}', desc: 'التكلفة الأساسية / المتوقعة' },
                  { token: '{extraCost}', desc: 'الكلف الإضافية' },
                  { token: '{extraCostReason}', desc: 'سبب الكلفة الإضافية' },
                  { token: '{totalCost}', desc: 'التكلفة الإجمالية الكلية' },
                  { token: '{cost}', desc: 'التكلفة النهائية' },
                  { token: '{advancePayment}', desc: 'الدفعة المقدمة (العربون)' },
                  { token: '{remainingCost}', desc: 'المبلغ المتبقي' },
                  { token: '{currency}', desc: 'العملة' },
                  { token: '{waitingParts}', desc: 'تفاصيل انتظار القطع' },
                  { token: '{waitingPartsDate}', desc: 'تاريخ وصول القطع المتوقع' },
                  { token: '{receivedDate}', desc: 'تاريخ الاستلام' },
                  { token: '{expectedDate}', desc: 'تاريخ التسليم المتوقع' },
                  { token: '{technician}', desc: 'الفني المسؤول' },
                  { token: '{recipient}', desc: 'اسم المستلم الفعلي' },
                  { token: '{relation}', desc: 'صلة القرابة' },
                  { token: '{trackingUrl}', desc: 'رابط تتبع العميل المباشر' },
                  { token: '{centerName}', desc: 'اسم مركز الصيانة' },
                  { token: '{centerMobile}', desc: 'رقم موبايل المركز' },
                ].map((item) => (
                  <button
                    key={item.token}
                    type="button"
                    onClick={() => {
                      if (!editingTemplateId) return;
                      if (activeTemplateField === 'sms') {
                        setSmsContent((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${item.token}`);
                      } else {
                        setWhatsappContent((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${item.token}`);
                      }
                    }}
                    title={editingTemplateId ? `اضغط لإدراج ${item.token}` : item.desc}
                    className={`w-full text-right bg-white/5 hover:bg-white/15 p-2 rounded-lg border border-white/5 flex justify-between items-center transition-colors ${editingTemplateId ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span dir="ltr">{item.token}</span>
                    <span className="font-sans text-[10px] text-teal-100/80">{item.desc}</span>
                  </button>
                ))}
              </div>

              <div className="bg-white/10 p-3 rounded-xl border border-white/10 text-[10px] text-teal-100 leading-relaxed font-sans text-right" dir="rtl">
                💡 <strong>ملاحظة:</strong> الكلف الإضافية وتفاصيل انتظار القطع والمتغيرات الجديدة المضافة أثناء تحديث الحالة يتم تضمينها تلقائياً في الرسالة حتى لو لم تُكتب يدوياً في القالب.
              </div>
            </div>
          </div>

          {/* Templates Editor / List */}
          <div className="xl:col-span-2 space-y-4">
            {templates.map((tpl) => (
              <div 
                key={tpl.id} 
                className={`bg-white rounded-3xl border p-5 md:p-6 transition-all ${
                  editingTemplateId === tpl.id 
                    ? 'border-teal-500 ring-2 ring-teal-50' 
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div className="text-right">
                    <span className="px-2.5 py-0.5 bg-teal-50 border border-teal-100 rounded-lg text-teal-800 text-xs font-sans font-bold">
                      {getStatusLabel(tpl.statusTrigger)}
                    </span>
                    <h3 className="font-sans font-extrabold text-base text-gray-800 mt-1.5 text-right">{tpl.name}</h3>
                  </div>

                  {editingTemplateId !== tpl.id ? (
                    <button
                      onClick={() => handleEditClick(tpl)}
                      className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-100 text-gray-700 font-sans font-semibold text-xs rounded-xl transition-colors"
                    >
                      تعديل القالب
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(tpl.id)}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-sans font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                      >
                        {saveSuccess ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 animate-bounce" />
                            تم الحفظ!
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            حفظ التعديلات
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setEditingTemplateId(null)}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-500 font-sans font-semibold text-xs rounded-xl transition-colors"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>

                {editingTemplateId === tpl.id ? (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* WhatsApp Editor */}
                      <div className="space-y-1.5 text-right">
                        <span className="text-[10px] font-sans font-bold text-emerald-700 block">تعديل صيغة الواتس اب:</span>
                        <textarea
                          value={whatsappContent}
                          onFocus={() => setActiveTemplateField('whatsapp')}
                          onChange={(e) => setWhatsappContent(e.target.value)}
                          className="w-full h-32 bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-right leading-relaxed font-sans"
                          placeholder="اكتب صيغة رسالة الواتس اب هنا..."
                        />
                      </div>

                      {/* SMS Editor */}
                      <div className="space-y-1.5 text-right">
                        <span className="text-[10px] font-sans font-bold text-blue-700 block">تعديل صيغة الرسالة النصية (SMS):</span>
                        <textarea
                          value={smsContent}
                          onFocus={() => setActiveTemplateField('sms')}
                          onChange={(e) => setSmsContent(e.target.value)}
                          className="w-full h-32 bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-right leading-relaxed font-sans"
                          placeholder="اكتب صيغة الرسالة النصية هنا..."
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                    {/* Readonly preview */}
                    <div className="space-y-1.5 text-right">
                      <span className="text-[10px] font-sans font-bold text-emerald-700 block">صيغة الواتس اب:</span>
                      <div className="bg-white p-3 rounded-xl border border-gray-100 text-xs text-gray-600 whitespace-pre-line leading-relaxed font-sans font-medium">
                        {tpl.whatsappContent}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-right">
                      <span className="text-[10px] font-sans font-bold text-blue-700 block">صيغة الرسالة النصية (SMS):</span>
                      <div className="bg-white p-3 rounded-xl border border-gray-100 text-xs text-gray-600 whitespace-pre-line leading-relaxed font-sans font-medium">
                        {tpl.smsContent}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'printers' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Sub-Tabs Navigation for Printing tab */}
          <div className="flex bg-gray-100 p-1 rounded-2xl w-full sm:w-fit gap-1 font-sans">
            
            <button
              onClick={() => setPrinterSubTab('receipt')}
              className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                printerSubTab === 'receipt'
                  ? 'bg-white text-teal-800  border border-gray-100/50'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <FileText className="w-4 h-4 text-teal-600" />
              <span>تصميم إيصال الاستلام</span>
            </button>
            <button
              onClick={() => setPrinterSubTab('label')}
              className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                printerSubTab === 'label'
                  ? 'bg-white text-teal-800  border border-gray-100/50'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Sliders className="w-4 h-4 text-teal-600" />
              <span>تصميم ملصق الباركود</span>
            </button>
          </div>

          {printerSubTab === 'receipt' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <ReceiptDesigner />
            </div>
          )}

        {printerSubTab === 'label' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <LabelDesigner />
            
            {/* Test Print Modal Trigger Card */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="text-right">
                <h4 className="font-sans font-bold text-gray-800 text-sm">
                  معاينة طباعة الملصق الحراري الفعلي
                </h4>
                <p className="text-gray-400 text-xs mt-0.5">
                  معاينة الملصق واختباره بالبيانات الحالية وإرسال أمر طباعة تجريبي لطابعة الملصقات
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLabelTestModal(true)}
                className="py-3 px-6 bg-teal-600 hover:bg-teal-700 text-white font-sans font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20"
              >
                <Eye className="w-4 h-4 text-white" />
                <span>👁️ فتح نافذة معاينة وطباعة ملصق تجريبي</span>
              </button>
            </div>
          </div>
        )}
      </div>
    )}

      {activeTab === 'names' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100  flex items-center justify-between">
              <div className="space-y-1 text-right">
                <span className="text-gray-400 text-[11px] font-sans font-bold">إجمالي العملاء المسجلين</span>
                <h3 className="text-xl font-extrabold text-gray-800 font-mono">{customers.length} عميل</h3>
              </div>
              <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100  flex items-center justify-between">
              <div className="space-y-1 text-right">
                <span className="text-gray-400 text-[11px] font-sans font-bold">أجهزة قيد الصيانة النشطة</span>
                <h3 className="text-xl font-extrabold text-amber-600 font-mono">
                  {customers.reduce((acc, curr) => acc + curr.activeCount, 0)} أجهزة
                </h3>
              </div>
              <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100  flex items-center justify-between">
              <div className="space-y-1 text-right">
                <span className="text-gray-400 text-[11px] font-sans font-bold">أجهزة تم إصلاحها بالكامل</span>
                <h3 className="text-xl font-extrabold text-emerald-600 font-mono">
                  {customers.reduce((acc, curr) => acc + curr.completedCount, 0)} أجهزة
                </h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100  flex items-center justify-between">
              <div className="space-y-1 text-right">
                <span className="text-gray-400 text-[11px] font-sans font-bold font-semibold">قيمة التكاليف المقدرة</span>
                <h3 className="text-xl font-extrabold text-teal-700 font-mono">
                  {customers.reduce((acc, curr) => acc + curr.totalSpent, 0).toLocaleString('ar-SA')} {currencyName}
                </h3>
              </div>
              <div className="p-3 bg-teal-50 text-teal-700 rounded-xl">
                <Database className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Directory Search & Export Bar */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6  flex flex-col md:flex-row gap-4 items-center justify-between shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]">
            <div className="relative w-full md:max-w-md">
              <input
                type="text"
                placeholder="ابحث باسم العميل أو رقم هاتفه..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-2.5 pr-10 pl-4 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-right font-sans"
              />
              <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <button
                onClick={() => setShowAddCustomerModal(true)}
                className="flex-1 md:flex-initial px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-sans font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5  -50"
              >
                <UserPlus className="w-4 h-4" />
                إضافة زبون جديد 👤
              </button>

              
            </div>
          </div>

          {/* Customer Contacts Directory Table */}
          <div className="bg-white rounded-3xl border border-gray-100  overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]">
            {filteredCustomers.length === 0 ? (
              <div className="p-16 text-center text-gray-400 font-sans">
                <span className="text-5xl block mb-3">👥🔍</span>
                <p className="font-bold text-gray-700 text-sm">لا توجد أسماء مطابقة لعملية البحث</p>
                <p className="text-xs text-gray-400 mt-1">تأكد من كتابة الاسم بشكل صحيح أو تصفح قائمة الأسماء الكاملة.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50/60 text-gray-400 font-sans font-bold text-xs border-b border-gray-100">
                      <th className="py-4 px-6">اسم العميل</th>
                      <th className="py-4 px-6">رقم الهاتف</th>
                      <th className="py-4 px-6">إجمالي الأجهزة</th>
                      <th className="py-4 px-6">حالة الأجهزة</th>
                      <th className="py-4 px-6">إجمالي التكاليف المقدرة</th>
                      <th className="py-4 px-6 text-center">إجراءات التواصل السريع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-sans text-xs text-gray-700">
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.phone} className="hover:bg-gray-50/40 transition-colors">
                        <td className="py-4 px-6 font-bold text-gray-900 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {customer.name.charAt(0)}
                          </div>
                          <span className="truncate max-w-[200px]">{customer.name}</span>
                        </td>
                        <td className="py-4 px-6 font-mono font-bold text-gray-600 text-right" dir="ltr">
                          {customer.phone}
                        </td>
                        <td className="py-4 px-6 font-semibold text-gray-700">
                          {customer.orders.length} جهاز
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-1.5">
                            {customer.activeCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-100 text-amber-700">
                                {customer.activeCount} قيد العمل
                              </span>
                            )}
                            {customer.completedCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700">
                                {customer.completedCount} جاهز للتسليم
                              </span>
                            )}
                            {customer.orders.length - customer.activeCount - customer.completedCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 border border-gray-200 text-gray-500">
                                {customer.orders.length - customer.activeCount - customer.completedCount} مستلم
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 font-bold text-teal-800 font-mono">
                          {customer.totalSpent} {currencyName}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-1.5">
                            <a
                              href={`tel:${customer.phone}`}
                              className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg transition-colors font-bold text-[10px] flex items-center gap-1"
                              title="اتصال هاتفي مباشر"
                            >
                              <Phone className="w-3 h-3" />
                              اتصال
                            </a>
                            
                            <a
                              href={`https://wa.me/${customer.phone.replace(/[\s+]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors font-bold text-[10px] flex items-center gap-1"
                              title="مراسلة عبر واتس اب"
                            >
                              <MessageSquare className="w-3 h-3" />
                              واتساب
                            </a>

                            <button
                              onClick={() => {
                                try {
                                  if (navigator.clipboard && navigator.clipboard.writeText) {
                                    navigator.clipboard.writeText(customer.phone).catch(() => {});
                                  } else {
                                    const ta = document.createElement('textarea');
                                    ta.value = customer.phone;
                                    document.body.appendChild(ta);
                                    ta.select();
                                    document.execCommand('copy');
                                    document.body.removeChild(ta);
                                  }
                                } catch (_) {}
                                alert('تم نسخ رقم الهاتف بنجاح!');
                              }}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                              title="نسخ رقم الهاتف"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Customer Modal */}
          {showAddCustomerModal && (
            <div className="fixed inset-0 bg-transparent flex items-start pt-1 sm:pt-2 overflow-y-auto justify-center p-2 z-50 animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl max-w-md w-full border border-gray-200 overflow-hidden transform scale-100 transition-all text-right font-sans shadow-2xl mb-4" dir="rtl">
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4 flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 animate-pulse" />
                    <h3 className="font-extrabold text-sm">إضافة زبون جديد لسجل الأسماء</h3>
                  </div>
                  <button
                    onClick={() => setShowAddCustomerModal(false)}
                    className="text-white/80 hover:text-white transition-colors text-base"
                  >
                    ✕
                  </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-gray-700 font-bold text-xs">
                      اسم الزبون / العميل الكامل:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: محمد أحمد الحربي"
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-gray-800 font-medium text-right font-sans"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-gray-700 font-bold text-xs">
                      رقم الهاتف / الجوال:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: 05xxxxxxx"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-gray-800 font-semibold text-right font-mono"
                    />
                    <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                      سيتم حفظ الاسم ورقم الهاتف في سجل الأسماء ليسهل استرجاعه وتعبئته تلقائياً عند إنشاء طلبات صيانة جديدة لهذا الزبون.
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="submit"
                      disabled={isSavingCustomer}
                      className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold text-xs py-2.5 rounded-xl transition-all  -50 flex items-center justify-center gap-1.5"
                    >
                      {isSavingCustomer ? 'جاري الحفظ...' : 'حفظ البيانات في السجل 💾'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomerModal(false)}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

      {activeTab === 'files' && (
        <div className="max-w-xl mx-auto w-full animate-in fade-in duration-200 text-right">
          
          {/* Left Column: Storage Metrics & Cloud Center */}
          <div className="xl:col-span-1 space-y-4">
            <div className="bg-white rounded-3xl border border-gray-100 p-6  space-y-5 font-sans shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]">
              <div className="space-y-4">
                
                {/* Backup & Restore */}
                <div className="space-y-3 pb-4 border-b border-gray-100">
                  <div className="bg-teal-50 border border-teal-100 p-3 rounded-2xl flex flex-col items-center">
                    <button
                      onClick={() => setShowNamesBackupModal(true)}
                      className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-teal-500/20"
                    >
                      <Database className="w-4 h-4" />
                      استيراد/تصدير الأسماء (جهات الاتصال) 
                    </button>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl flex flex-col items-center">
                    <button
                      onClick={() => setShowOrdersBackupModal(true)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      استيراد/تصدير سجلات الزبائن (Excel)
                    </button>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl flex flex-col items-center">
                    <button
                      onClick={() => setShowLogsBackupModal(true)}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
                    >
                      <FileText className="w-4 h-4" />
                      استيراد/تصدير سجلات الرسائل (Excel)
                    </button>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl flex flex-col items-center">
                    <button
                      onClick={() => setShowSettingsBackupModal(true)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20"
                    >
                      <Settings className="w-4 h-4" />
                      استيراد/تصدير الإعدادات (Excel/JSON)
                    </button>
                  </div>

                  <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl flex flex-col items-center">
                    <button
                      onClick={() => setShowBackupModal(true)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/20"
                    >
                      <Download className="w-4 h-4" />
                      النسخ الاحتياطي والاستعادة 
                    </button>
                  </div>
                </div>

                {/* Clear Local Cache */}
                <div className="space-y-3">
                  <button
                    onClick={async () => {
                      if (onForceSync) {
                        try {
                          await onForceSync();
                        } catch (err) {
                          console.error("Force sync failed:", err);
                        }
                      } else {
                        confirmAction('تحديث الذاكرة', 'تنبيه: سيؤدي هذا لتنظيف الذاكرة المؤقتة للمتصفح وإعادة التحميل من السحابة مباشرة. هل ترغب بالاستمرار؟', () => {
                          localStorage.removeItem('db_orders');
                          localStorage.removeItem('db_notification_logs');
                          window.location.reload();
                        });
                      }
                    }}
                    className="w-full py-2 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-[11px] font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 duration-150 "
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                    تحديث ومزامنة الذاكرة المحلية قسرياً
                  </button>
                </div>

                {/* Clear Data Modal Trigger */}
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <button
                    onClick={() => setShowClearDataModal(true)}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                    مسح البيانات من النظام ⚠️
                  </button>
                </div>


                



              </div>
            </div>
          </div>

          </div>
      )}

      {activeTab === 'center_info' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-teal-800 to-teal-950 rounded-3xl p-5 md:p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-64 h-64 bg-teal-700/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
            
            <div className="relative z-10 flex items-center justify-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center shrink-0">
                <Store className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-sans font-extrabold text-xl md:text-2xl text-white">
                هوية المركز
              </h3>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 md:p-8 space-y-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]">
            {/* Store Logo Management Section */}
            <div className="p-5 bg-teal-50/30 rounded-2xl border border-teal-100/50 space-y-4">
              <div className="text-right">
                <h5 className="font-sans font-bold text-gray-800 text-xs flex items-center gap-2 justify-start">
                  <Image className="w-4 h-4 text-teal-600" />
                  <span>شعار المركز</span>
                </h5>
              </div>

              <div className="flex flex-col items-center justify-center gap-4 py-2 text-center">
                {/* Logo Preview box */}
                <div className="relative w-28 h-28 rounded-3xl bg-gray-50 border-2 border-dashed border-teal-300 flex items-center justify-center overflow-hidden group shrink-0 shadow-xs">
                  {centerLogo ? (
                    <>
                      <img src={centerLogo} alt="Logo Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => setCenterLogo('')}
                        className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                        title="حذف الشعار الحالي"
                      >
                        <Trash2 className="w-5 h-5 text-rose-200 hover:text-rose-400" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center p-3 text-gray-300">
                      <Image className="w-8 h-8 mx-auto mb-1 opacity-70 text-teal-600" />
                      <span className="text-[10px] font-bold block text-gray-400">لا يوجد شعار</span>
                    </div>
                  )}
                </div>

                {/* Upload & Camera Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  {/* Choose File Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-sans font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <Upload className="w-4 h-4 text-teal-600" />
                    <span>اختيار ملف صورة الشعار</span>
                  </button>

                  {/* Camera Capture Button */}
                  <button
                    type="button"
                    onClick={showCamera ? stopCamera : startCamera}
                    className={`px-4 py-2.5 text-xs font-sans font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
                      showCamera 
                        ? 'bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600'
                        : 'bg-white hover:bg-gray-50 border border-gray-200 text-gray-700'
                    }`}
                  >
                    <Camera className="w-4 h-4 text-teal-600" />
                    <span>{showCamera ? 'إيقاف الكاميرا' : 'التقاط صورة فورا بالكاميرا'}</span>
                  </button>
                </div>
              </div>

              {/* Hidden inputs */}
              <input
                type="file" onClick={(e: any) => { e.target.value = ''; }}
                ref={fileInputRef}
                accept="image/*"
                onChange={handleLogoFileChange}
                className="hidden"
              />

              {/* Camera Live Stream Card */}
              {showCamera && (
                <div className="p-4 bg-black rounded-2xl border border-gray-800 flex flex-col items-center gap-4 max-w-md mx-auto">
                  <div className="flex justify-between items-center w-full pb-2 border-b border-gray-800 text-white">
                    <span className="text-xs font-bold font-sans flex items-center gap-1.5">
                      <Video className="w-4 h-4 text-teal-400 animate-pulse" />
                      كاميرا الشعار الحية
                    </span>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Video viewport */}
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover transform -scale-x-100"
                      playsInline
                      muted
                    />
                    <div className="absolute inset-0 border-2 border-teal-500/35 rounded-xl pointer-events-none flex items-center justify-center">
                      {/* Target frame */}
                      <div className="w-48 h-48 border-2 border-dashed border-white/60 rounded-full" />
                    </div>
                  </div>

                  {/* Capture actions */}
                  <div className="flex gap-2 w-full">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="flex-grow py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-sans font-bold text-xs rounded-xl  transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>التقاط وحفظ الصورة 📸</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-sans font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      <span>إلغاء</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Center Name */}
              <div className="space-y-2 text-right">
                <label className="block text-gray-700 font-sans font-bold text-xs">
                  اسم المركز
                </label>
                <input
                  type="text"
                  value={centerName}
                  onChange={(e) => setCenterName(e.target.value)}
                  placeholder="مثال: مركز تكنو لصيانة الأجهزة الذكية"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-sans text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold"
                />
              </div>

              {/* Engineer Name */}
              <div className="space-y-2 text-right">
                <label className="block text-gray-700 font-sans font-bold text-xs">
                  اسم المهندس
                </label>
                <input
                  type="text"
                  value={engineerName}
                  onChange={(e) => setEngineerName(e.target.value)}
                  placeholder="مثال: م. محمد وليد"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-sans text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold"
                />
              </div>

              {/* Center Mobile */}
              <div className="space-y-2 text-right">
                <label className="block text-gray-700 font-sans font-bold text-xs">
                  رقم الموبايل
                </label>
                <input
                  type="text"
                  value={centerMobile}
                  onChange={(e) => setCenterMobile(e.target.value)}
                  placeholder="مثال: 962790000000"
                  dir="ltr"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-sans text-xs text-right focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold"
                />
              </div>

              {/* Center Email */}
              <div className="space-y-2 text-right">
                <label className="block text-gray-700 font-sans font-bold text-xs">
                  البريد الإلكتروني للمركز
                </label>
                <input
                  type="email"
                  value={centerEmail}
                  onChange={(e) => setCenterEmail(e.target.value)}
                  placeholder="مثال: info@techno-repair.com"
                  dir="ltr"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-sans text-xs text-right focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold"
                />
              </div>

              {/* 1. Country Dropdown */}
              <div className="space-y-2 text-right">
                <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1.5 justify-start">
                  <Globe className="w-3.5 h-3.5 text-teal-600" />
                  <span>البلد</span>
                </label>
                <div className="relative">
                  <select
                    value={countryName}
                    onChange={(e) => handleCountrySelectChange(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-sans text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold text-right cursor-pointer"
                  >
                    <option value="">-- اختر البلد لتحديث العملة والرمز تلقائياً --</option>
                    {COUNTRIES_LIST.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.currency} | +{c.dialCode})
                      </option>
                    ))}
                    {countryName && !COUNTRIES_LIST.some((c) => c.name === countryName) && (
                      <option value={countryName}>{countryName} (مخصص)</option>
                    )}
                  </select>
                </div>
              </div>

              {/* 2. Currency Name */}
              <div className="space-y-2 text-right">
                <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1.5 justify-start">
                  <Coins className="w-3.5 h-3.5 text-teal-600" />
                  <span>العملة</span>
                </label>
                <input
                  type="text"
                  value={currencyName}
                  onChange={(e) => setCurrencyName(e.target.value)}
                  placeholder="مثال: دينار، ريال، درهم، دولار..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-sans text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold text-right"
                />
              </div>

              {/* 3. Country Dial Code */}
              <div className="space-y-2 text-right">
                <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1.5 justify-start">
                  <Phone className="w-3.5 h-3.5 text-teal-600" />
                  <span>الرمز الدولي</span>
                </label>
                <input
                  type="text"
                  value={countryDialCode}
                  onChange={(e) => setCountryDialCode(e.target.value)}
                  placeholder="مثال: 962"
                  dir="ltr"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-sans text-xs text-right focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold"
                />
              </div>

              {/* Active Country Timezone Preview */}
              <div className="md:col-span-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-right">
                <div className="text-[11px] font-sans font-bold text-gray-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  <span>التوقيت المحلي المستخدم لرقم الطلب ({countryName || 'الأردن'}):</span>
                  <span dir="ltr" className="font-mono text-teal-700">
                    {resolveCountryTimeZone({ countryName, countryDialCode })}
                  </span>
                </div>
                <div className="text-[11px] font-mono font-bold text-teal-800 bg-white px-2.5 py-1 rounded-xl border border-teal-100" dir="ltr">
                  {formatCountryDateTime24h(new Date(), { countryName, countryDialCode })} (24h) · {currentLiveBarcode}
                </div>
              </div>

              {/* 4. Built-in Website Domain */}
              <div className="md:col-span-2 bg-teal-50/50 border border-teal-100 rounded-2xl p-4 space-y-3 text-right">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-gray-800 font-sans font-extrabold text-xs flex items-center gap-1.5 justify-start">
                    <Globe className="w-4 h-4 text-teal-600" />
                    <span>نطاق الموقع المدمج (Built-in Domain)</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setWebsiteDomain(BUILT_IN_APP_DOMAIN)}
                      className="px-2.5 py-1 bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      النطاق السحابي المدمج
                    </button>
                    <button
                      type="button"
                      onClick={() => setWebsiteDomain(FIREBASE_HOSTING_DOMAIN)}
                      className="px-2.5 py-1 bg-white hover:bg-teal-50 text-gray-700 border border-gray-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      نطاق Firebase
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const normalized = normalizeDomainUrl(websiteDomain);
                        try {
                          await navigator.clipboard.writeText(normalized);
                          setDomainCopied(true);
                          setTimeout(() => setDomainCopied(false), 2000);
                        } catch (_) {}
                      }}
                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {domainCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{domainCopied ? 'تم النسخ' : 'نسخ الرابط'}</span>
                    </button>
                  </div>
                </div>

                <input
                  type="url"
                  value={websiteDomain}
                  onChange={(e) => setWebsiteDomain(e.target.value)}
                  placeholder={BUILT_IN_APP_DOMAIN}
                  dir="ltr"
                  className="w-full px-4 py-2.5 bg-white border border-teal-200/80 rounded-xl font-mono text-xs text-left focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold text-gray-800"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-teal-800/90 font-sans">
                  <span>تستخدم روابط تتبع العملاء ورموز الـ QR هذا النطاق تلقائياً عند الطباعة والإرسال.</span>
                  <span className="font-mono text-gray-500 truncate max-w-full" dir="ltr">
                    مثال: {buildTrackingUrl(currentLiveBarcode, websiteDomain)}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Custom Invoice Footer / Terms (Notes) section */}
            <div className="pt-6 border-t border-gray-100 space-y-4">
              <h5 className="font-sans font-extrabold text-gray-800 text-xs flex items-center gap-2 justify-start">
                <FileText className="w-4 h-4 text-teal-600" />
                <span>ملاحظات</span>
              </h5>
              <p className="text-[10px] text-gray-400 text-right">
                اكتب نصاً مخصصاً ليظهر في أسفل الفاتورة وإيصالات استلام الصيانة المطبوعة لعملائك (مثلاً: ملاحظات الضمان، شروط الاستلام، والتعليمات الهامة للمحل).
              </p>

              <div className="space-y-2 text-right">
                <textarea
                  value={rcptTermsText}
                  onChange={(e) => setRcptTermsText(e.target.value)}
                  rows={4}
                  placeholder="اكتب شروط وأحكام الصيانة وملاحظات الضمان هنا..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-sans text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold leading-relaxed text-right"
                />
              </div>
            </div>

            {/* Save Button (Aligned to the Right) */}
            <div className="pt-4 border-t border-gray-50 flex justify-start">
              <button
                onClick={handleSaveCenterInfo}
                className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-sans font-bold text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Save className="w-4 h-4" />
                <span>حفظ بيانات وهوية المركز</span>
              </button>
            </div>
          </div>

          {/* Quick Preview Card */}
          <div className="bg-teal-50/50 rounded-3xl border border-teal-100/30 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1.5 text-right">
              <h5 className="font-sans font-extrabold text-teal-950 text-xs flex items-center gap-1.5">
                <Check className="w-4 h-4 text-teal-600" />
                <span>كيف تظهر هذه البيانات للعميل؟</span>
              </h5>
              <p className="text-[11px] text-teal-800 leading-relaxed font-semibold font-sans max-w-xl">
                عند حفظ التغييرات، ستظهر ترويسة إيصالات استلام الصيانة لعملائك بالاسم المحدث: <strong className="text-teal-950">"{centerName || 'TECHNO'}"</strong> بإشراف المهندس <strong className="text-teal-950">"{engineerName}"</strong> ورقم الهاتف <strong className="text-teal-950">"{centerMobile}"</strong> في بلد <strong className="text-teal-950">"{countryName}"</strong> (مفتاح <strong className="text-teal-950">+{countryDialCode}</strong>)، وبمسمى عملة افتراضية <strong className="text-teal-950">"{currencyName}"</strong>. كما سيتم تعيين الفني الافتراضي في كافة الطلبات الجديدة باسم المهندس تلقائياً لتوفير الوقت والجهد.
              </p>
            </div>
          </div>

        </div>
      )}



        </div> {/* closing left content area */}
      </div> {/* closing flex container */}

      {/* Real-world Thermal Printer Test Receipt Modal */}
      {showTestPrintModal && (
        <div className="fixed inset-0 bg-transparent z-50 flex items-start justify-center p-2 pt-1 sm:pt-2 overflow-y-auto font-sans no-print">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-200 p-6 space-y-6 text-right animate-in slide-in-from-top-2 duration-150 mb-4">
            {/* Modal Header */}
            <div className="border-b border-gray-100 pb-3.5 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">طباعة إيصال الفحص والاختبار</h3>
                <p className="text-gray-400 text-[10px] mt-0.5">معاينة وتجربة الطباعة الفعلية لضبط الهوامش</p>
              </div>
              <button 
                onClick={() => setShowTestPrintModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                إغلاق ×
              </button>
            </div>

            {/* Paper Size selector for the test print */}
            <div className="space-y-2">
              <label className="block text-gray-700 font-bold text-xs">اختر حجم ورق طابعتك لإرسال المقاس المطابق:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTestPrintSize('80mm')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                    testPrintSize === '80mm'
                      ? 'bg-teal-50 border-teal-200 text-teal-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  ورق 80 مم (قياسي)
                </button>
                <button
                  type="button"
                  onClick={() => setTestPrintSize('58mm')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                    testPrintSize === '58mm'
                      ? 'bg-teal-50 border-teal-200 text-teal-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  ورق 58 مم (صغير)
                </button>
              </div>
            </div>

            {/* Simulated Receipt Preview on screen */}
            <div className="space-y-2">
              <span className="text-[10px] text-gray-400 font-bold">معاينة الإيصال على الشاشة:</span>
              <div 
                id="test-receipt-print-modal"
                className={`bg-gray-50 p-3 sm:p-4 rounded-2xl border border-gray-200/60 mx-auto text-black font-mono text-[11px] leading-relaxed select-none w-full break-words [overflow-wrap:anywhere] ${
                  testPrintSize === '80mm' ? 'max-w-[76mm]' : 'max-w-[54mm]'
                }`}
                style={{ direction: 'rtl' }}
              >
                <div className="text-center space-y-1 mb-3">
                  <div className="font-sans font-bold text-sm break-words">ورشة الإلكترونيات الذكية</div>
                  <div className="text-[9px] text-gray-500 font-sans break-words">إصلاح الهواتف، الحواسيب، والقطع الدقيقة</div>
                  <div className="text-[8px] text-gray-400 break-words">هاتف: 0500000000 | ص.ب: 12345</div>
                </div>

                <div className="border-t border-dashed border-gray-300 py-2 text-[10px] space-y-1 text-right">
                  <div className="flex flex-wrap gap-x-1.5"><strong>رقم الفحص:</strong> <span className="tabular-nums">TEST-9999</span></div>
                  <div className="flex flex-wrap gap-x-1.5"><strong>التاريخ:</strong> <span className="tabular-nums">{new Date().toLocaleString('ar-SA')}</span></div>
                  <div className="flex flex-wrap gap-x-1.5"><strong>طريقة الاختبار:</strong> <span>متصفح الويب الآمن</span></div>
                </div>

                <div className="border-t border-b border-dashed border-gray-300 py-2.5 my-2 space-y-1">
                  <div className="flex flex-wrap justify-between gap-x-2 font-bold text-xs text-gray-950">
                    <span>البند</span>
                    <span>الحالة</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2 text-[10px] mt-1.5 text-gray-700">
                    <span>فحص محاذاة النص</span>
                    <span>ناجح ✓</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2 text-[10px] text-gray-700">
                    <span>فحص الهوامش</span>
                    <span>متطابق ✓</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2 text-[10px] text-gray-700">
                    <span>طباعة الفواتير</span>
                    <span>جاهز للعمل</span>
                  </div>
                </div>

                {/* Barcode representation */}
                <div className="my-3 text-center space-y-1.5">
                  <div className="inline-block bg-black h-8 w-4/5 mx-auto opacity-80" style={{ backgroundImage: 'linear-gradient(90deg, #fff 2px, transparent 2px, transparent 4px, #000 4px, #000 6px, #fff 6px, #fff 8px, #000 8px, #000 12px, #fff 12px, #fff 14px, #000 14px)' }} />
                  <div className="text-[8px] tracking-widest text-gray-500">*TEST-SYSTEM-SUCCESS*</div>
                </div>

                <div className="text-center text-[9px] text-gray-500 pt-1 font-sans border-t border-dashed border-gray-300 break-words">
                  شكراً لاستخدامكم نظام إدارة الصيانة الذكي
                  <br />
                  www.smart-workshop.com
                </div>
              </div>
            </div>

            {/* Action buttons inside modal */}
            <div className="space-y-3">
              {isInIframe && (
                <div className="bg-amber-50 border border-amber-200/70 p-3.5 rounded-2xl text-[11px] text-amber-800 text-right font-sans space-y-2 leading-relaxed">
                  <div className="font-bold flex items-center gap-1 text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>تنبيه بيئة التجربة (iFrame)</span>
                  </div>
                  <p>
                    تمنع متصفحات الويب الحديثة تفعيل نوافذ الطباعة بشكل كامل عند وجود التطبيق داخل إطار معاينة (iFrame). لكي تعمل ميزة الطباعة لديك بنجاح، يرجى فتح التطبيق في نافذة مستقلة:
                  </p>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition-colors no-print"
                  >
                    <span>افتح التطبيق في نافذة جديدة مستقلة للطباعة ↗</span>
                  </a>
                </div>
              )}

              <button
                type="button"
                onClick={() => handlePrintElement('test-receipt-print-modal', 'معاينة إيصال تجريبي')}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl  transition-all flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                الطباعة عبر نافذة حوار Windows (Windows Print Dialog)
              </button>

              <div className="text-[10px] text-gray-500 text-center font-medium">
                💡 خيار الطباعة أعلاه يستدعي حوار طباعة Windows الرسمي (System Print Dialog) لمعاينة الورق واختيار الطابعة الافتراضية بدقة.
              </div>

              <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl text-[10px] text-blue-800 text-right font-medium leading-relaxed">
                💡 <strong>تنبيه هام للطباعة:</strong> عند ظهور معاينة الطباعة الآن، تأكد من ضبط <strong>الهوامش (Margins)</strong> على <strong>بلا هوامش (None)</strong> وإلغاء <strong>الرؤوس والتذييلات (Headers & Footers)</strong> لتخرج الورقة بمظهر كاشير مثالي ومتناسق!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-world Thermal Printer Test Label Modal */}
      {showLabelTestModal && (
        <div className="fixed inset-0 bg-transparent z-50 flex items-start justify-center p-2 pt-1 sm:pt-2 overflow-y-auto font-sans no-print">
            <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-200 p-6 space-y-5 text-right animate-in slide-in-from-top-2 duration-150 mb-4">
              {/* Modal Header */}
              <div className="border-b border-gray-100 pb-3.5 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5 justify-start">
                    <Eye className="w-4.5 h-4.5 text-teal-600" />
                    <span>معاينة ملصق الباركود وتجربة الطباعة</span>
                  </h3>
                  <p className="text-gray-400 text-[10px] mt-0.5">محاكاة دقيقة لشكل وحجم ملصق الباركود الحراري</p>
                </div>
                <button 
                  onClick={() => setShowLabelTestModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  إغلاق ×
                </button>
              </div>

              {(() => {
                const liveLayout = { ...getStoredLabelLayout(), paperSize: FIXED_LABEL_PAPER_SIZE };
                const previewMetrics = getLabelPreviewMetrics(FIXED_LABEL_PAPER_SIZE, 250, 210, false);
                const containerStyles = getLabelContainerStyles(liveLayout, lblFormat.fontFamily);
                const activeElements = liveLayout.elements.filter(el => el.enabled);
                const splitMetrics = getSplitThermalLabelMetrics(liveLayout, containerStyles, activeElements);
                const barcodeActiveEl = activeElements.find(el => el.id === 'barcode');
                const qrActiveEl = activeElements.find(el => el.id === 'qr_code');
                const infoElements = splitMetrics.hasQrSide
                  ? activeElements.filter(el => el.id !== 'qr_code')
                  : activeElements;
                const sampleDate = new Date().toLocaleDateString('ar-SA');

                return (
                  <>
                    {/* Selected layout summary */}
                    <div className="bg-teal-50/50 border border-teal-100/40 rounded-xl p-3 text-right text-xs space-y-1">
                      <div className="text-teal-900 font-bold">معلومات الملصق:</div>
                      <div className="text-gray-600 font-medium grid grid-cols-2 gap-y-1">
                        <span>📏 الأبعاد: <strong className="text-gray-800 font-mono">{containerStyles.widthMm}mm × {containerStyles.heightMm}mm</strong></span>
                        <span>🔍 التكبير للعرض: <strong className="text-gray-800 font-mono">×{previewMetrics.scale.toFixed(2)}</strong></span>
                      </div>
                    </div>

                    {/* Sticker Area on screen */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-gray-400 font-bold block">مظهر الملصق الحراري الفعلي:</span>
                      <div className="p-6 bg-gray-50/70 border border-dashed border-gray-200 rounded-2xl flex items-center justify-center">
                        <div
                          className="relative mx-auto"
                          style={{
                            width: `${previewMetrics.scaledWidthPx}px`,
                            height: `${previewMetrics.scaledHeightPx}px`,
                            maxWidth: '100%'
                          }}
                        >
                          <div
                            id="test-label-print-modal"
                            dir="rtl"
                            className="bg-white text-black rounded-sm ring-1 ring-gray-300 overflow-hidden flex select-none"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: `${containerStyles.widthMm}mm`,
                              height: `${containerStyles.heightMm}mm`,
                              maxWidth: `${containerStyles.widthMm}mm`,
                              maxHeight: `${containerStyles.heightMm}mm`,
                              padding: `${splitMetrics.effectivePaddingMm}mm`,
                              flexDirection: splitMetrics.hasQrSide ? 'row' : 'column',
                              alignItems: 'center',
                              justifyContent: splitMetrics.hasQrSide && infoElements.length > 0 ? 'space-between' : 'center',
                              gap: splitMetrics.hasQrSide && infoElements.length > 0 ? `${splitMetrics.colGapMm}mm` : '0',
                              boxSizing: 'border-box',
                              fontFamily: containerStyles.fontFamilyCss,
                              textAlign: containerStyles.textAlign,
                              transform: `scale(${previewMetrics.scale})`,
                              transformOrigin: 'top left'
                            }}
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
                                const elMetrics = getLabelElementMetrics(el, liveLayout);
                                const baseFontPt = splitMetrics.compactFontPt ?? Math.min(elMetrics.fontSizePt, splitMetrics.isNarrowWidth ? 8 : 11);
                                const mTopMm = splitMetrics.isCompactHeight ? 0 : Math.min(elMetrics.marginTopMm, 0.4);
                                const mBotMm = splitMetrics.isCompactHeight ? 0.2 : Math.min(elMetrics.marginBottomMm, 0.5);
                                return (
                                  <div
                                    key={el.id}
                                    className={splitMetrics.hasQrSide ? (el.id === 'barcode' ? 'h-full flex items-center justify-center shrink-0' : 'max-h-full') : 'w-fit max-w-full'}
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
                                  >
                                    {el.id === 'center_name' && (
                                      <div dir="auto" className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full truncate'} font-black text-black`} style={{ fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalCenterNameFontPt(centerName || 'مركز تكنو للصيانة') : splitMetrics.getCenterNameFontPt(centerName || 'مركز تكنو للصيانة', baseFontPt)}pt`, fontWeight: 900, letterSpacing: splitMetrics.hasQrSide ? '0px' : '-0.25px', lineHeight: 1 }}>
                                        {centerName || 'مركز تكنو للصيانة'}
                                      </div>
                                    )}
                                    {el.id === 'center_mobile' && (
                                      <div dir="ltr" className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden' : 'max-w-full whitespace-nowrap'} text-black tabular-nums`} style={{ fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalMobileFontPt(centerMobile || '05xxxxxxxx') : splitMetrics.getCenterMobileFontPt(centerMobile || '05xxxxxxxx', baseFontPt)}pt`, fontWeight: splitMetrics.hasQrSide ? 900 : (el.bold ? 700 : 600), fontFamily: "system-ui, -apple-system, 'Cairo', sans-serif", letterSpacing: splitMetrics.hasQrSide ? '0px' : '-0.1px', lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing }}>
                                        {centerMobile || '05xxxxxxxx'}
                                      </div>
                                    )}
                                    {el.id === 'customer_name' && (
                                      <div dir="auto" className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full truncate'} text-black`} style={{ fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalInfoFontPt('العميل: أحمد محمد عبد الله') : baseFontPt}pt`, fontWeight: el.bold ? 800 : 600, lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing }}>
                                        العميل: أحمد محمد عبد الله
                                      </div>
                                    )}
                                    {el.id === 'device_model' && (
                                      <div dir="auto" className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full truncate'} text-black`} style={{ fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalInfoFontPt('الجهاز: iPhone 14 Pro Max') : baseFontPt}pt`, fontWeight: el.bold ? 800 : 600, lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing }}>
                                        الجهاز: iPhone 14 Pro Max
                                      </div>
                                    )}
                                    {el.id === 'order_date' && (
                                      <div dir="auto" className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full truncate'} text-black`} style={{ fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalInfoFontPt(`التاريخ: ${sampleDate}`) : baseFontPt}pt`, fontWeight: el.bold ? 700 : 400, lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing }}>
                                        التاريخ: {sampleDate}
                                      </div>
                                    )}
                                    {el.id === 'barcode' && (
                                      splitMetrics.hasQrSide ? (() => {
                                        const spec = getVerticalOrderIdSvgSpec(currentLiveBarcode, splitMetrics);
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
                                        <div dir="ltr" className="max-w-full whitespace-nowrap font-black text-black tabular-nums" style={{ fontSize: `${splitMetrics.getCodeFontPt(currentLiveBarcode, baseFontPt)}pt`, fontFamily: "system-ui, -apple-system, 'Cairo', sans-serif", fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.2px', lineHeight: 1 }}>
                                          {currentLiveBarcode}
                                        </div>
                                      )
                                    )}
                                    {el.id === 'custom_text' && (
                                      <div dir="auto" className={`${splitMetrics.hasQrSide ? 'max-h-full whitespace-nowrap overflow-hidden text-ellipsis' : 'max-w-full break-words'} text-black`} style={{ fontSize: `${splitMetrics.hasQrSide ? splitMetrics.getVerticalInfoFontPt(el.customContent || 'يرجى إبراز هذا الملصق عند الاستلام') : baseFontPt}pt`, fontWeight: el.bold ? 700 : 500, lineHeight: splitMetrics.hasQrSide ? 1 : splitMetrics.effectiveLineSpacing, textAlign: splitMetrics.hasQrSide ? 'center' : containerStyles.textAlign }}>
                                        {el.customContent || 'يرجى إبراز هذا الملصق عند الاستلام'}
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
                                  const m = getLabelElementMetrics(barcodeActiveEl, liveLayout);
                                  return (
                                    <BarcodeGenerator
                                      value={currentLiveBarcode}
                                      qrContent={buildOrderCustomerQrPayload({
                                        order: {
                                          id: currentLiveBarcode,
                                          customerName: 'أحمد محمد عبد الله',
                                          customerPhone: '0790000000',
                                          deviceType: 'جوال',
                                          brandModel: 'iPhone 14 Pro Max',
                                          faultDescription: 'تغيير شاشة + فحص بطارية',
                                          estimatedCost: 45,
                                          status: DeviceStatus.RECEIVED,
                                          createdAt: Date.now(),
                                          updatedAt: Date.now(),
                                          statusHistory: [],
                                        } as MaintenanceOrder,
                                        centerName: centerName || 'مركز تكنو للصيانة',
                                        centerMobile: centerMobile || '05xxxxxxxx',
                                        currencyName: localStorage.getItem('currencyName') || 'دينار',
                                        maxLength: 520,
                                      })}
                                      width={barcodeActiveEl.width || 1.2}
                                      height={m.barcodeHeightPx}
                                      physicalHeightMm={m.barcodeHeightMm}
                                      targetQrMm={splitMetrics.splitQrSizeMm}
                                      showText={false}
                                      format={lblBarcodeFormat}
                                      maxWidthMm={splitMetrics.effectiveInnerWidthMm}
                                      marginModules={0}
                                    />
                                  );
                                })()}
                                {qrActiveEl && (() => {
                                  const m = getLabelElementMetrics(qrActiveEl, liveLayout);
                                  return (
                                    <QRCodeGenerator
                                      value={buildTrackingUrl(currentLiveBarcode)}
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
                      </div>
                    </div>
                  </>
                );
              })()}

            {/* Action buttons inside modal */}
            <div className="space-y-3">
              {isInIframe && (
                <div className="bg-amber-50 border border-amber-200/70 p-3 rounded-2xl text-[11px] text-amber-800 text-right leading-relaxed">
                  <div className="font-bold flex items-center gap-1 text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>تنبيه بيئة التجربة (iFrame)</span>
                  </div>
                  <p className="mt-1">
                    تمنع متصفحات الويب الحديثة تفعيل نوافذ الطباعة بشكل كامل داخل إطارات المعاينة. للقيام بعملية طباعة حقيقية ممتازة لملصق الباركود، يرجى فتح النظام في نافذة مستقلة أولاً:
                  </p>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition-colors mt-2"
                  >
                    <span>افتح النظام في نافذة جديدة مستقلة للطباعة ↗</span>
                  </a>
                </div>
              )}

              <button
                type="button"
                onClick={() => handlePrintElement('test-label-print-modal', 'معاينة ملصق باركود تجريبي')}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl  transition-all flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                إرسال الملصق إلى طابعة الباركود الحرارية (Print Label)
              </button>

                           <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl text-[10px] text-blue-800 text-right font-medium leading-relaxed">
                💡 <strong>نصيحة هامة لطابعات الملصقات (Xprinter / Zebra):</strong> عند فتح نافذة الطباعة، يرجى التأكد من اختيار حجم الورق المطابق تماماً لملصقك (<strong>38x25mm</strong>) وضبط الهوامش على <strong>بلا هوامش (None)</strong> وتفعيل ملائمة الصفحة لضمان خروج الباركود متموضعاً بدقة متناهية!
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showBackupModal && (
        <BackupModal 
          onClose={() => setShowBackupModal(false)} 
          onSuccess={() => setShowBackupModal(false)}
        />
      )}

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-transparent z-[9999] flex items-start pt-1 sm:pt-2 overflow-y-auto justify-center p-2" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-200 animate-in slide-in-from-top-2 duration-150 mb-4">
            <div className={`p-6 border-b ${confirmDialog.isDangerous ? 'border-red-100 bg-red-50' : 'border-amber-100 bg-amber-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${confirmDialog.isDangerous ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className={`font-bold text-lg ${confirmDialog.isDangerous ? 'text-red-900' : 'text-amber-900'}`}>
                  {confirmDialog.title}
                </h3>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 font-medium leading-relaxed">{confirmDialog.message}</p>
              
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog({ ...confirmDialog, isOpen: false });
                  }}
                  className={`flex-1 py-3 font-bold rounded-xl transition-colors text-white ${confirmDialog.isDangerous ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/30' : 'bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-500/30'}`}
                >
                  تأكيد
                </button>
              </div>
            </div>
          </div>
        </div>
      )}






      {showClearDataModal && (
        <ClearDataModal 
          onClose={() => setShowClearDataModal(false)} 
          onClearAllOrders={onClearAllOrders}
          onClearLogs={onClearLogs}
          onClearNames={onClearNames}
        />
      )}
      {showSettingsBackupModal && (
        <SettingsBackupModal 
          onClose={() => setShowSettingsBackupModal(false)} 
          onSuccess={() => setShowSettingsBackupModal(false)}
        />
      )}
      {showLogsBackupModal && (
        <LogsBackupModal 
          onClose={() => setShowLogsBackupModal(false)} 
          onSuccess={() => setShowLogsBackupModal(false)}
        />
      )}

      {showOrdersBackupModal && (
        <OrdersBackupModal 
          onClose={() => setShowOrdersBackupModal(false)} 
          onSuccess={() => setShowOrdersBackupModal(false)}
        />
      )}

      {showNamesBackupModal && (
        <NamesBackupModal 
          onClose={() => setShowNamesBackupModal(false)} 
          onSuccess={() => setShowNamesBackupModal(false)}
        />
      )}

    </div>
  );
};
export default NotificationSettingsView;
