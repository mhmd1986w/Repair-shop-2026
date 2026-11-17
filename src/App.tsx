import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MaintenanceOrder, DeviceStatus, NotificationTemplate, NotificationLog, AppUser, CustomerProfile, StatusHistorySnapshot, isContactOrder } from './types';
import { 
  dbService, 
  LocalStorageDB, 
  auth, 
  loginWithEmail, 
  registerWithEmail, 
  loginWithGoogle, 
  logoutUser, 
  resetPasswordEmail, 
  deleteUserAccount,
  deleteCurrentLoggedInAccount,
  getCurrentUserId 
} from './lib/firebase';
import { DEFAULT_TEMPLATES, formatNotification, getWhatsAppLink, openWhatsAppDirectly, buildStatusHistorySnapshot } from './lib/notifications';
import { initializeLocalDatabase } from './lib/seed';

// Import Views
import DashboardView from './components/DashboardView';
import OrdersView from './components/OrdersView';
import NotificationSettingsView from './components/NotificationSettingsView';
import DeliverDeviceModal, { DeliveryConfirmPayload } from './components/DeliverDeviceModal';
import { ContactsView } from './components/ContactsView';
import { LogsView } from './components/LogsView';
import { ScannerModal } from "./components/ScannerModal";
import { CustomerProfileModal } from './components/CustomerProfileModal';
import { extractScannedBarcodeId } from './utils/barcode';
import {
  reconcileCustomersAndOrders,
  linkOrderWithCustomer,
  sanitizeCustomCustomerBarcode,
  buildCustomerId,
  normalizeCustomerNameKey,
  phonesMatch,
} from './utils/customerBarcode';

// Import Lucide Icons
import { 
  Wrench, 
  LayoutDashboard, 
  Smartphone, 
  MessageSquare, 
  Camera, 
  MapPin, 
  Bell, 
  Database,
  Wifi,
  WifiOff,
  Settings,
  Lock,
  User,
  Key,
  LogIn,
  LogOut,
  Star,
  CheckCircle,
  FileText,
  Mail,
  Phone,
  Eye,
  EyeOff,
  Mic,
  MicOff,
  CheckCircle2,
  Upload,
  Building2,
  Globe,
  Coins,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { RegisterCenterProfile } from './lib/firebase';
import { checkMicrophonePermission, requestMicrophonePermission } from './utils/microphonePermissions';

import { COUNTRIES_LIST } from './utils/countries';
import type { CountryConfig } from './utils/countries';
import { getEffectiveAppUrl } from './utils/appDomain';
export { COUNTRIES_LIST };
export type { CountryConfig };

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'completed' | 'notifications' | 'contacts' | 'logs'>('dashboard');
  
  // App state
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [scannedOrderId, setScannedOrderId] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [ordersSearchTerm, setOrdersSearchTerm] = useState<string>('');
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<string>('');
  const [openAddOrderModal, setOpenAddOrderModal] = useState<boolean>(false);
  const [prefillCustomerForAdd, setPrefillCustomerForAdd] = useState<{ name: string; phone: string } | null>(null);
  const loadSeqRef = React.useRef<number>(0);
  const isExplicitAuthRef = React.useRef<boolean>(false);
  const [deliveryOrder, setDeliveryOrder] = useState<MaintenanceOrder | null>(null);
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<{ name: string; phone?: string; customer?: CustomerProfile } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [centerName, setCenterName] = useState(() => {
    return (typeof localStorage !== 'undefined' && (localStorage.getItem('centerName') || localStorage.getItem('lastRegisteredCenterName'))) || 'TECHNO';
  });
  const [centerLogo, setCenterLogo] = useState(() => {
    return (typeof localStorage !== 'undefined' && (localStorage.getItem('centerLogo') || localStorage.getItem('lastRegisteredCenterLogo'))) || '';
  });

  // Authentication states - Strictly Firebase Auth
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const userJson = (typeof localStorage !== 'undefined' && localStorage.getItem('appCurrentUser')) || 
                       (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('appCurrentUser'));
      if (!userJson) return null;
      const parsed = JSON.parse(userJson);
      if (!parsed.permissions) {
        parsed.permissions = {
          view_dashboard: true,
          view_orders: true,
          add_orders: true,
          edit_orders: true,
          delete_orders: true,
          access_settings: true
        };
      }
      return parsed;
    } catch (_) {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const isAuthLocal = typeof localStorage !== 'undefined' && localStorage.getItem('isAppAuthenticated') === 'true';
    const isAuthSession = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('isAppAuthenticated') === 'true';
    const hasUser = (typeof localStorage !== 'undefined' && !!localStorage.getItem('appCurrentUser')) ||
                    (typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('appCurrentUser'));
    return (isAuthLocal || isAuthSession) && hasUser;
  });

  const [loginPassVal, setLoginPassVal] = useState('');
  const [loginEmailVal, setLoginEmailVal] = useState(() => {
    return (typeof localStorage !== 'undefined' && localStorage.getItem('lastLoginEmail')) || '';
  });

  // Registration profile fields (empty by default, without preset hints)
  const [regCenterName, setRegCenterName] = useState('');
  const [regTechnicianName, setRegTechnicianName] = useState('');
  const [regCenterMobile, setRegCenterMobile] = useState('');
  const [regCenterLogo, setRegCenterLogo] = useState('');
  const [regCurrency, setRegCurrency] = useState('');
  const [regCountry, setRegCountry] = useState('');
  const [regCountryCode, setRegCountryCode] = useState('');

  const handleCountryChange = (selectedCountryName: string) => {
    setRegCountry(selectedCountryName);
    const found = COUNTRIES_LIST.find(c => c.name === selectedCountryName);
    if (found) {
      setRegCurrency(found.currency);
      setRegCountryCode(found.dialCode);
    } else {
      setRegCurrency('');
      setRegCountryCode('');
    }
  };

  // Camera & File capture for registration logo
  const [isRegCameraOpen, setIsRegCameraOpen] = useState(false);
  const regVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const regStreamRef = React.useRef<MediaStream | null>(null);
  const regFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const stopRegCamera = () => {
    if (regStreamRef.current) {
      regStreamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch (_) {}
      });
      regStreamRef.current = null;
    }
    if (regVideoRef.current) {
      if (regVideoRef.current.srcObject) {
        const stream = regVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => {
          try { t.stop(); } catch (_) {}
        });
      }
      regVideoRef.current.srcObject = null;
    }
    setIsRegCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (regStreamRef.current) {
        regStreamRef.current.getTracks().forEach(t => {
          try { t.stop(); } catch (_) {}
        });
        regStreamRef.current = null;
      }
    };
  }, []);

  const startRegCamera = async () => {
    try {
      stopRegCamera();
      setIsRegCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 400 }, height: { ideal: 400 } }
      });
      regStreamRef.current = stream;
      if (regVideoRef.current) {
        regVideoRef.current.srcObject = stream;
        regVideoRef.current.play().catch(() => {});
      }
    } catch (e) {
      console.warn("Registration camera error:", e);
      alert("تعذر الوصول إلى الكاميرا. يرجى التأكد من تفعيل إذن الكاميرا في المتصفح.");
      setIsRegCameraOpen(false);
    }
  };

  const captureRegCameraPhoto = () => {
    if (!regVideoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(regVideoRef.current, 0, 0, 300, 300);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setRegCenterLogo(dataUrl);
      }
    } catch (e) {
      console.error(e);
    } finally {
      stopRegCamera();
    }
  };

  const handleRegFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 320;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setRegCenterLogo(compressed);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');
  const [authMode, setAuthMode] = useState<'firebase_login' | 'firebase_register'>('firebase_login');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Deletion modal states for previously registered Firebase emails
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [delEmailVal, setDelEmailVal] = useState('');
  const [delPassVal, setDelPassVal] = useState('');
  const [delLoading, setDelLoading] = useState(false);
  const [delMsg, setDelMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Microphone permission states for voice dictation
  const [micPermissionState, setMicPermissionState] = useState<'granted' | 'prompt' | 'denied' | 'unsupported'>('prompt');
  const [isActivatingMic, setIsActivatingMic] = useState(false);

  useEffect(() => {
    checkMicrophonePermission().then(res => {
      setMicPermissionState(res.state);
    });
  }, []);

  const handleActivateMicrophone = async () => {
    setIsActivatingMic(true);
    try {
      const res = await requestMicrophonePermission();
      setMicPermissionState(res.state);
      if (res.granted) {
        alert("✅ تم تفعيل صلاحية المايكروفون بنجاح! يمكنك الآن استخدام الإدخال الصوتي بالكامل في التطبيق.");
      } else if (res.error) {
        alert(res.error);
      }
    } finally {
      setIsActivatingMic(false);
    }
  };

  // Sync Firebase Auth user state
  useEffect(() => {
    if (auth) {
      const unsub = auth.onAuthStateChanged((fbUser: any) => {
        if (fbUser) {
          const appUser: AppUser = {
            id: fbUser.uid,
            username: fbUser.email || fbUser.displayName || 'user',
            email: fbUser.email || '',
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'فني صيانة معتمد',
            role: 'admin',
            permissions: {
              view_dashboard: true,
              view_orders: true,
              add_orders: true,
              edit_orders: true,
              delete_orders: true,
              access_settings: true
            }
          };
          localStorage.setItem('isAppAuthenticated', 'true');
          localStorage.setItem('appCurrentUser', JSON.stringify(appUser));
          sessionStorage.setItem('isAppAuthenticated', 'true');
          sessionStorage.setItem('appCurrentUser', JSON.stringify(appUser));
          setCurrentUser(appUser);
          setIsAuthenticated(true);
        }
      });
      return () => unsub();
    }
  }, []);

  // App URL for tracking links (uses built-in public domain or custom center domain)
  const [appUrl, setAppUrl] = useState<string>(() => getEffectiveAppUrl());

  // One-time automated local cleanup without triggering reload loops
  useEffect(() => {
    try {
      if (localStorage.getItem('printer_settings_cleared_v1') !== 'true') {
        const keysToRemove = [
          'maintenance_printers', 'allow_select_printer_on_print', 'lblPaperSize', 
          'lblShowCenterName', 'lblShowBarcode', 'lblShowQR', 'lblShowCustomerName', 
          'lblShowDeviceModel', 'lblShowDate', 'lblShowMobile', 'lblFontSizeCenterName', 
          'lblFontSizeMobile', 'lblFontSizeCustomerName', 'lblFontSizeDeviceModel', 
          'lblFontSizeDate', 'lblFontSizeCustomText', 'lblAlign', 'lblVerticalAlign', 
          'lblZoom', 'lblLineSpacing', 'rcptCenterNameText', 'rcptTermsText', 
          'rcptZoom', 'rcptShowQR', 'rcptSize'
        ];
        keysToRemove.forEach(k => localStorage.removeItem(k));
        localStorage.setItem('printer_settings_cleared_v1', 'true');
      }

      if (localStorage.getItem('removed_mock_data_v2') !== 'true') {
        localStorage.setItem('db_orders', '[]');
        localStorage.setItem('db_notification_logs', '[]');
        localStorage.setItem('removed_mock_data_v2', 'true');
      }

      if (localStorage.getItem('removed_mock_data_v1') !== 'true') {
        localStorage.setItem('removed_mock_data_v1', 'true');
      }

      if (localStorage.getItem('system_factory_reset_completed') !== 'true') {
        localStorage.removeItem('appUsersList');
        localStorage.setItem('system_factory_reset_completed', 'true');
      }
    } catch (e) {
      console.warn("Initial local cleanup notice:", e);
    }
  }, []);

  // 1. Initial mounting, database seeding, and routing
  useEffect(() => {
    // Seed local database if empty
    initializeLocalDatabase();

    // Seed users list if not present
    if (!localStorage.getItem('appUsersList')) {
      const defaultAdminUsername = (localStorage.getItem('appLoginUsername') || 'admin').trim();
      const defaultAdminPassword = (localStorage.getItem('appLoginPassword') || '1234').trim();
      const defaultUsers: AppUser[] = [
        {
          id: 'u1',
          username: defaultAdminUsername,
          password: defaultAdminPassword,
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
            delete_orders: true,
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
            delete_orders: true,
            access_settings: false
          }
        }
      ];
      localStorage.setItem('appUsersList', JSON.stringify(defaultUsers));
    }

    // Check internet connection
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleStorage = () => {
      setCenterName(localStorage.getItem('centerName') || 'TECHNO');
      setCenterLogo(localStorage.getItem('centerLogo') || '');
      setAppUrl(getEffectiveAppUrl());
      const isAuthLocal = typeof localStorage !== 'undefined' && localStorage.getItem('isAppAuthenticated') === 'true';
      const isAuthSession = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('isAppAuthenticated') === 'true';
      const isAuth = isAuthLocal || isAuthSession;
      setIsAuthenticated(isAuth);
      if (isAuth) {
        try {
          const userJson = (typeof localStorage !== 'undefined' && localStorage.getItem('appCurrentUser')) ||
                           (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('appCurrentUser'));
          if (userJson) {
            const parsed = JSON.parse(userJson);
            if (!parsed.permissions) {
              parsed.permissions = {
                view_dashboard: true,
                view_orders: true,
                add_orders: true,
                edit_orders: true,
                delete_orders: true,
                access_settings: true
              };
            }
            setCurrentUser(parsed);
          }
        } catch (_) {}
      } else {
        setCurrentUser(null);
      }
    };
    window.addEventListener('storage', handleStorage);

    // Deep linking: check if URL has ?track=ORD-XXXX or ?customer=CUS...
    const searchParams = new URLSearchParams(window.location.search);
    const customerQueryCode = searchParams.get('customer');
    const trackId = searchParams.get('track') || searchParams.get('tracking') || searchParams.get('id');
    if (trackId && !customerQueryCode) {
      setOrdersSearchTerm(trackId.toUpperCase());
      setActiveTab('orders');
    }

    // Load initial data
    loadAllData();

    // Automatic sync and save every 5 minutes (only when authenticated)
    const syncInterval = setInterval(async () => {
      if (!auth?.currentUser) return;
      console.log("Auto-syncing with cloud every 5 minutes..."); setIsSyncing(true);
      try {
        // Backup settings and configurations
        await dbService.syncAppSettingsBackup();

        // Sync database records
        const synced = await dbService.syncData();
        const reconciled = reconcileCustomersAndOrders(synced.customers || [], synced.orders || []);
        setCustomers(reconciled.customers);
        setOrders(reconciled.orders);
        if (reconciled.changedCustomers.length > 0) {
          dbService.saveCustomersBatch(reconciled.changedCustomers).catch(() => {});
        }
        if (reconciled.changedOrders.length > 0) {
          dbService.saveOrdersBatch(reconciled.changedOrders).catch(() => {});
        }
        setNotificationLogs(synced.logs); setLastSyncTime(new Date()); setIsSyncing(false);
      } catch (err) {
        console.warn("Auto-sync failed:", err); setIsSyncing(false);
      }
    }, 5 * 60 * 1000);

    const handleAuthChange = () => {
      if (isExplicitAuthRef.current) return;
      console.log("Active Auth UID updated, reloading isolated data...");
      loadAllData();
    };
    window.addEventListener('auth-uid-changed', handleAuthChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('auth-uid-changed', handleAuthChange);
      clearInterval(syncInterval);
    };
  }, []);

  const applyReconciliationAndPersist = async (
    rawCustomers: CustomerProfile[],
    rawOrders: MaintenanceOrder[]
  ) => {
    const reconciled = reconcileCustomersAndOrders(rawCustomers || [], rawOrders || []);
    setCustomers(reconciled.customers);
    setOrders(reconciled.orders);
    if (reconciled.changedCustomers.length > 0) {
      dbService.saveCustomersBatch(reconciled.changedCustomers).catch((err) =>
        console.warn("Background customer reconciliation save deferred:", err)
      );
    }
    if (reconciled.changedOrders.length > 0) {
      dbService.saveOrdersBatch(reconciled.changedOrders).catch((err) =>
        console.warn("Background order linking save deferred:", err)
      );
    }
    return reconciled;
  };

  const openCustomerProfile = (name: string, phone?: string, explicitCustomer?: CustomerProfile) => {
    const matched =
      explicitCustomer ||
      customers.find((c) => {
        if (phone && c.phone && phonesMatch(c.phone, phone)) return true;
        return normalizeCustomerNameKey(c.name) === normalizeCustomerNameKey(name);
      });
    setSelectedCustomerProfile({ name, phone, customer: matched });
  };

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await dbService.syncAppSettingsBackup();
      const synced = await dbService.syncData();
      await applyReconciliationAndPersist(synced.customers || [], synced.orders || []);
      setNotificationLogs(synced.logs);
      setLastSyncTime(new Date());
    } catch (err) {
      console.warn("Manual sync failed:", err);
      alert("فشلت عملية المزامنة. تأكد من اتصال الإنترنت.");
    } finally {
      setIsSyncing(false);
    }
  };

  const loadAllData = async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      // 0. Sync and restore comprehensive settings and configurations on startup
      try {
        await dbService.syncAppSettingsBackup();
      } catch (e) {
        console.warn("Initial app settings sync failed:", e);
      }

      if (seq !== loadSeqRef.current) return;

      // 1. Bidirectional sync & Load orders, customers, and logs on startup
      const synced = await dbService.syncData();
      if (seq !== loadSeqRef.current) return;
      const fetchedOrders = (synced && synced.orders) ? synced.orders : [];
      const fetchedCustomers = (synced && synced.customers) ? synced.customers : [];

      const reconciled = await applyReconciliationAndPersist(fetchedCustomers, fetchedOrders);

      // Deep link support for Customer Alphanumeric QR codes (?customer=CUS... or ?track=CUS...)
      if (typeof window !== 'undefined') {
        const sp = new URLSearchParams(window.location.search);
        const rawLookup = (sp.get('customer') || sp.get('track') || sp.get('tracking') || sp.get('id') || '').trim().toUpperCase();
        if (rawLookup) {
          const matchedCust = reconciled.customers.find(
            (c) => c.customerBarcode.trim().toUpperCase() === rawLookup
          );
          if (matchedCust) {
            setSelectedCustomerProfile({ name: matchedCust.name, phone: matchedCust.phone, customer: matchedCust });
          }
        }
      }

      // 2. Load templates (from localStorage if edited, otherwise default)
      const storedTemplates = localStorage.getItem('db_templates');
      if (storedTemplates) {
        try {
          let loaded = JSON.parse(storedTemplates);
          let needsUpdate = false;
          loaded = loaded.map((t: any) => {
            const defaultTpl = DEFAULT_TEMPLATES.find(d => d.id === t.id);
            if (defaultTpl && (t.id === 'received' || t.id === 'ready' || t.id === 'unrepairable' || t.id === 'reminder')) {
              const hasWarning = t.whatsappContent.includes('14') || t.whatsappContent.includes('١٤');
              if (!hasWarning) {
                needsUpdate = true;
                return {
                  ...t,
                  whatsappContent: defaultTpl.whatsappContent
                };
              }
            }
            return t;
          });
          
          // Merge missing defaults (e.g. new overdue_48h template)
          DEFAULT_TEMPLATES.forEach(defaultTpl => {
            if (!loaded.find((t: any) => t.id === defaultTpl.id)) {
              loaded.push(defaultTpl);
              needsUpdate = true;
            }
          });

          if (needsUpdate) {
            localStorage.setItem('db_templates', JSON.stringify(loaded));
          }
          setTemplates(loaded);
        } catch (e) {
          console.error("Error upgrading templates:", e);
          localStorage.setItem('db_templates', JSON.stringify(DEFAULT_TEMPLATES));
          setTemplates(DEFAULT_TEMPLATES);
        }
      } else {
        localStorage.setItem('db_templates', JSON.stringify(DEFAULT_TEMPLATES));
        setTemplates(DEFAULT_TEMPLATES);
      }

      // 3. Load logs
      const fetchedLogs = (synced && synced.logs) ? synced.logs : [];
      setNotificationLogs(fetchedLogs);
    } catch (error) {
      console.warn("Notice: Loading application data fallback active:", error);
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const handleForceSync = async () => {
    setLoading(true);
    try {
      // 1. Force upload of current local settings to cloud first (so local modifications are exported)
      await dbService.saveAppSettingsBackup();
      
      // 2. Sync orders, customers, and logs bidirectionally
      const synced = await dbService.syncData();
      await applyReconciliationAndPersist(synced.customers || [], synced.orders || []);
      setNotificationLogs(synced.logs); setLastSyncTime(new Date()); setIsSyncing(false);
      
      alert('✨ تم تصدير السجلات المحلية وتطبيق التعديلات والمزامنة بنجاح!');
    } catch (err) {
      console.warn("Force sync notice:", err);
      alert('⚠️ واجهنا مشكلة أثناء المزامنة مع السحابة، تم الحفظ محلياً مؤقتاً.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Action handlers
  const handleSaveOrder = async (updatedOrder: MaintenanceOrder) => {
    try {
      const { linkedOrder, customer, isNewCustomer } = linkOrderWithCustomer(updatedOrder, customers, orders);
      await dbService.saveOrder(linkedOrder);
      if (isNewCustomer || !customers.some(c => c.id === customer.id)) {
        await dbService.saveCustomer(customer);
      }
      const [freshOrders, freshCustomers] = await Promise.all([
        dbService.getOrders(),
        dbService.getCustomers(),
      ]);
      await applyReconciliationAndPersist(freshCustomers, freshOrders);
    } catch (err) {
      console.error("Failed to save order:", err);
    }
  };

  const handleSaveCustomer = async (customer: CustomerProfile) => {
    try {
      const now = Date.now();
      const cleanBarcode = sanitizeCustomCustomerBarcode(customer.customerBarcode) || customer.customerBarcode;
      const normalized: CustomerProfile = {
        ...customer,
        customerBarcode: cleanBarcode,
        createdAt: customer.createdAt || now,
        updatedAt: now,
      };
      await dbService.saveCustomer(normalized);

      const linkedOrdersToUpdate = orders
        .filter((o) => o.customerId === normalized.id && o.customerBarcode !== cleanBarcode)
        .map((o) => ({ ...o, customerBarcode: cleanBarcode }));
      if (linkedOrdersToUpdate.length > 0) {
        await dbService.saveOrdersBatch(linkedOrdersToUpdate);
      }

      const [freshCustomers, freshOrders] = await Promise.all([
        dbService.getCustomers(),
        dbService.getOrders(),
      ]);
      await applyReconciliationAndPersist(freshCustomers, freshOrders);
    } catch (err) {
      console.error("Failed to save customer:", err);
    }
  };

  const handleUpdateCustomerBarcode = async (
    customerId: string,
    rawNewBarcode: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const cleanCode = sanitizeCustomCustomerBarcode(rawNewBarcode);
    if (!cleanCode || cleanCode.length < 3) {
      return { ok: false, error: 'يجب أن يتكون الباركود من 3 خانات على الأقل (أحرف إنجليزية أو أرقام).' };
    }

    const duplicateCustomer = customers.find(
      (c) => c.id !== customerId && c.customerBarcode.trim().toUpperCase() === cleanCode
    );
    if (duplicateCustomer) {
      return { ok: false, error: `هذا الباركود مرتبط بالفعل بالزبون: ${duplicateCustomer.name}` };
    }

    const duplicateOrder = orders.find(
      (o) => !isContactOrder(o) && o.id.trim().toUpperCase() === cleanCode
    );
    if (duplicateOrder) {
      return { ok: false, error: `هذا الباركود مستخدم مسبقاً لطلب صيانة (${duplicateOrder.id}).` };
    }

    const target = customers.find((c) => c.id === customerId);
    if (!target) {
      return { ok: false, error: 'تعذر العثور على ملف الزبون لتحديث الباركود.' };
    }

    const updatedCustomer: CustomerProfile = {
      ...target,
      customerBarcode: cleanCode,
      updatedAt: Date.now(),
    };

    await dbService.saveCustomer(updatedCustomer);

    const ordersToUpdate = orders
      .filter(
        (o) =>
          o.customerId === customerId ||
          (o.customerBarcode && o.customerBarcode.trim().toUpperCase() === target.customerBarcode.trim().toUpperCase())
      )
      .map((o) => ({
        ...o,
        customerId,
        customerBarcode: cleanCode,
      }));
    if (ordersToUpdate.length > 0) {
      await dbService.saveOrdersBatch(ordersToUpdate);
    }

    const [freshCustomers, freshOrders] = await Promise.all([
      dbService.getCustomers(),
      dbService.getOrders(),
    ]);
    const reconciled = await applyReconciliationAndPersist(freshCustomers, freshOrders);
    const updatedProfile = reconciled.customers.find((c) => c.id === customerId) || updatedCustomer;
    setSelectedCustomerProfile((prev) =>
      prev && (prev.customer?.id === customerId || normalizeCustomerNameKey(prev.name) === normalizeCustomerNameKey(target.name))
        ? { ...prev, customer: updatedProfile }
        : prev
    );
    return { ok: true };
  };

  const handleAssignBarcodeToCustomer = async (customerId: string, rawBarcode: string) => {
    const res = await handleUpdateCustomerBarcode(customerId, rawBarcode);
    if (!res.ok) {
      throw new Error(res.error || 'تعذر ربط الباركود بالزبون المختار.');
    }
  };

  const handleRegisterCustomerWithBarcode = async (
    name: string,
    phone: string,
    rawBarcode: string
  ): Promise<CustomerProfile> => {
    const cleanCode = sanitizeCustomCustomerBarcode(rawBarcode);
    if (!cleanCode || cleanCode.length < 3) {
      throw new Error('رمز الباركود غير صالح (يجب أن يكون 3 خانات على الأقل).');
    }

    const duplicateCustomer = customers.find(
      (c) => c.customerBarcode.trim().toUpperCase() === cleanCode
    );
    if (duplicateCustomer) {
      throw new Error(`هذا الباركود مرتبط مسبقاً بالزبون: ${duplicateCustomer.name}`);
    }

    const duplicateOrder = orders.find(
      (o) => !isContactOrder(o) && o.id.trim().toUpperCase() === cleanCode
    );
    if (duplicateOrder) {
      throw new Error(`هذا الباركود مستخدم بالفعل في طلب صيانة (${duplicateOrder.id}).`);
    }

    const existingIds = new Set(customers.map((c) => c.id));
    const now = Date.now();
    const newCustomer: CustomerProfile = {
      id: buildCustomerId(name, phone, existingIds),
      name: name.trim(),
      phone: phone.trim(),
      customerBarcode: cleanCode,
      createdAt: now,
      updatedAt: now,
    };

    await dbService.saveCustomer(newCustomer);
    const [freshCustomers, freshOrders] = await Promise.all([
      dbService.getCustomers(),
      dbService.getOrders(),
    ]);
    const reconciled = await applyReconciliationAndPersist(freshCustomers, freshOrders);
    return reconciled.customers.find((c) => c.id === newCustomer.id) || newCustomer;
  };

  const handleDeleteCustomer = async (customerId: string) => {
    try {
      await dbService.deleteCustomer(customerId);
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      if (selectedCustomerProfile?.customer?.id === customerId) {
        setSelectedCustomerProfile(null);
      }
    } catch (err) {
      console.error("Failed to delete customer:", err);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await dbService.deleteOrder(orderId);
      const freshOrders = await dbService.getOrders();
      setOrders(freshOrders);
    } catch (err) {
      console.error("Failed to delete order:", err);
    }
  };

  const handleClearNames = async (clearAll: boolean = false) => {
    try {
      if (clearAll) {
        if (orders.length > 0) {
          await dbService.clearAllOrders(orders);
          setOrders([]);
        }
        if (customers.length > 0) {
          await dbService.clearAllCustomers(customers);
          setCustomers([]);
        }
        alert('تم مسح كافة جهات الاتصال وباركودات الزبائن وطلبات الصيانة بالكامل بنجاح.');
      } else {
        const namesToDelete = orders.filter(isContactOrder);
        
        if (namesToDelete.length > 0) {
          await dbService.clearAllOrders(namesToDelete);
          setOrders(prev => prev.filter(o => !isContactOrder(o)));
        }
        alert('تم مسح كافة الأسماء المستوردة بنجاح.');
      }
    } catch (err) {
      console.error("Failed to clear names:", err);
      alert('حدث خطأ أثناء مسح الأسماء.');
    }
  };

  const handleClearAllOrders = async () => {
    try {
      if (orders.length > 0) {
        await dbService.clearAllOrders(orders);
        setOrders([]);
      }
      alert('تم مسح كافة البيانات (سجلات الصيانة والعملاء) بنجاح.');
    } catch (err) {
      console.error("Failed to clear all orders:", err);
      alert('حدث خطأ أثناء مسح البيانات.');
    }
  };

  const handleSaveTemplate = (id: string, smsContent: string, whatsappContent: string) => {
    const updatedTemplates = templates.map(t => {
      if (t.id === id) {
        return { ...t, smsContent, whatsappContent };
      }
      return t;
    });
    setTemplates(updatedTemplates);
    localStorage.setItem('db_templates', JSON.stringify(updatedTemplates));
    dbService.saveAppSettingsBackup(); // Trigger immediate cloud/local backup of settings
  };

  const handleClearLogs = async () => {
    try {
      await dbService.clearAllLogs(notificationLogs);
      setNotificationLogs([]);
    } catch (err) {
      console.error("Failed to clear logs:", err);
    }
  };

  // Deliver order flow
  const handleTriggerDelivery = (order: MaintenanceOrder) => {
    setDeliveryOrder(order);
  };

  const handleConfirmDelivery = async (payload: DeliveryConfirmPayload) => {
    if (!deliveryOrder) return;

    const faultDescVal = payload.updatedDiagnosis?.trim() || deliveryOrder.faultDescription;
    const currencyVal = deliveryOrder.currency || localStorage.getItem('currencyName') || 'دينار';

    const baseUpdatedOrder: MaintenanceOrder = {
      ...deliveryOrder,
      status: DeviceStatus.DELIVERED,
      faultDescription: faultDescVal,
      estimatedCost: payload.estimatedCost,
      extraCost: payload.extraCost,
      extraCostReason: payload.extraCostReason || '',
      advancePayment: payload.advancePayment,
      actualCost: payload.finalCost,
      waitingPartsDetails: payload.waitingPartsDetails || '',
      customVariables: payload.customVariables || [],
      currency: currencyVal,
      statusUpdateText: (payload.statusUpdateText || payload.notes || '').trim(),
      updatedAt: Date.now(),
      deliveryInfo: {
        recipientName: payload.recipientName,
        deliveryDate: Date.now(),
        relationToCustomer: payload.relationToCustomer,
        notes: payload.notes
      }
    };

    const deliveryMsg = payload.sendNotification ? payload.notificationMessage : '';
    const snapshot = buildStatusHistorySnapshot(baseUpdatedOrder, {
      statusNote: payload.notes || `تم تسليم الجهاز إلى ${payload.recipientName}`,
      sentMessage: deliveryMsg || undefined,
      notificationChannel: payload.sendNotification ? payload.notificationChannel : 'none',
      currency: currencyVal,
    });

    const summaryParts = [
      `تم تسليم الجهاز بنجاح إلى المستلم: (${payload.recipientName}) بصفته (${payload.relationToCustomer})`,
      `الإجمالي المحصل: ${snapshot.totalCost} ${currencyVal}`,
    ];
    if (snapshot.extraCost > 0) {
      summaryParts.push(
        `كلف إضافية: ${snapshot.extraCost} ${currencyVal}${snapshot.extraCostReason ? ` (${snapshot.extraCostReason})` : ''}`
      );
    }
    if (snapshot.waitingPartsDetails) {
      summaryParts.push(`حالة القطع: ${snapshot.waitingPartsDetails}`);
    }
    summaryParts.push(`التشخيص: ${faultDescVal}`);

    const updatedOrder: MaintenanceOrder = {
      ...baseUpdatedOrder,
      statusHistory: [
        ...(deliveryOrder.statusHistory || []),
        {
          status: DeviceStatus.DELIVERED,
          timestamp: Date.now(),
          note: summaryParts.join(' - '),
          updatedBy: currentUser?.displayName || 'موظف الاستقبال',
          snapshot
        }
      ],
    };

    await handleSaveOrder(updatedOrder);
    setDeliveryOrder(null);

    if (payload.sendNotification && deliveryMsg) {
      if (payload.notificationChannel === 'whatsapp') {
        openWhatsAppDirectly(updatedOrder.customerPhone, deliveryMsg);
      } else {
        const cleanPhone = (updatedOrder.customerPhone || '').replace(/[\s()-]/g, '');
        if (cleanPhone) {
          window.open(`sms:${cleanPhone}?body=${encodeURIComponent(deliveryMsg)}`, '_blank');
        }
      }
      handleLogNotification(
        updatedOrder.id,
        updatedOrder.customerName,
        updatedOrder.customerPhone,
        payload.notificationChannel,
        deliveryMsg,
        'تأكيد تسليم الجهاز',
        snapshot
      );
    }
  };

  // Logging notifications
  const handleLogNotification = async (
    orderId: string,
    customerName: string,
    customerPhone: string,
    type: 'sms' | 'whatsapp',
    content: string,
    triggerEvent: string,
    variablesSnapshot?: StatusHistorySnapshot
  ) => {
    const newLog: NotificationLog = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderId,
      customerName,
      customerPhone,
      type,
      content,
      status: 'sent',
      timestamp: Date.now(),
      triggerEvent,
      ...(variablesSnapshot ? { variablesSnapshot } : {})
    };

    await dbService.saveNotificationLog(newLog);
    const freshLogs = await dbService.getNotificationLogs();
    setNotificationLogs(freshLogs);
  };

  // Handle reminder click from dashboard
  const handleSendWhatsAppReminder = (order: MaintenanceOrder) => {
    const tpl = templates.find(t => t.statusTrigger === 'reminder');
    if (!tpl) return;

    const msgs = formatNotification(tpl, order, appUrl);
    openWhatsAppDirectly(order.customerPhone, msgs.whatsapp);
    handleLogNotification(
      order.id,
      order.customerName,
      order.customerPhone,
      'whatsapp',
      msgs.whatsapp,
      'تذكير بموعد التسليم'
    );
  };


  // Automated Scheduling System for Overdue Orders (>48h)
  useEffect(() => {
    const interval = setInterval(async () => {
      const isAutoEnabled = localStorage.getItem('autoRemindersEnabled') === 'true';
      if (!isAutoEnabled) return;

      const now = Date.now();
      const overdue48h = orders.filter(order => {
        // Exclude delivered, unrepairable, ready, or non-repair items
        if (
          order.status === DeviceStatus.DELIVERED || 
          order.status === DeviceStatus.UNREPAIRABLE || 
          order.status === DeviceStatus.READY ||
          isContactOrder(order)
        ) {
          return false;
        }
        
        if (!order.expectedDeliveryDate) return false;
        
        const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(order.expectedDeliveryDate).trim());
        const expectedDate = ymdMatch
          ? new Date(Number(ymdMatch[1]), Number(ymdMatch[2]) - 1, Number(ymdMatch[3]), 23, 59, 59, 999)
          : new Date(order.expectedDeliveryDate);
        if (isNaN(expectedDate.getTime())) return false;
        if (!ymdMatch) {
          expectedDate.setHours(23, 59, 59, 999);
        }
        const overdueMs = now - expectedDate.getTime();
        
        // Check if more than 48 hours delayed
        return overdueMs > 48 * 60 * 60 * 1000; 
      });

      if (overdue48h.length > 0) {
        let sentAny = false;
        
        for (const order of overdue48h) {
          const hasLog = notificationLogs.some(log => log.orderId === order.id && log.triggerEvent === 'تأخير أكثر من 48 ساعة (مجدول)');
          
          if (!hasLog) {
            const tpl = templates.find(t => t.id === 'overdue_48h') || templates.find(t => (t.statusTrigger as string) === 'overdue_48h');
            
            if (tpl) {
              const msgs = formatNotification(tpl, order, appUrl);
              
              // We use handleLogNotification but since it's an automated background process, we directly save to not block UI
              const newLog = {
                id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                orderId: order.id,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                type: 'whatsapp',
                content: msgs.whatsapp,
                status: 'sent',
                timestamp: Date.now(),
                triggerEvent: 'تأخير أكثر من 48 ساعة (مجدول)'
              };
              
              await dbService.saveNotificationLog(newLog as any);
              sentAny = true;
            }
          }
        }
        
        if (sentAny) {
          const freshLogs = await dbService.getNotificationLogs();
          setNotificationLogs(freshLogs);
        }
      }
    }, 60000); // Check every 1 minute for demonstration (could be 15 mins)

    return () => clearInterval(interval);
  }, [orders, notificationLogs, templates, appUrl]);

  // Function to filter orders that have been in maintenance for more than 3 days without delivery
  const getOverdueMaintenanceOrders = () => {
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return (orders || []).filter(
      (order) => order && order.status !== DeviceStatus.DELIVERED && (now - (order.createdAt || now)) > threeDaysInMs
    );
  };

  // Search filter for orders
  const getFilteredOrders = (term: string) => {
    if (!term || !term.trim()) return orders || [];
    const t = term.toLowerCase().trim();
    return (orders || []).filter(o => 
      (o?.customerName && o.customerName.toLowerCase().includes(t)) ||
      (o?.customerPhone && o.customerPhone.includes(t)) ||
      (o?.id && o.id.toLowerCase().includes(t)) ||
      (o?.brandModel && o.brandModel.toLowerCase().includes(t)) ||
      (o?.notes && o.notes.toLowerCase().includes(t)) ||
      (o?.technician && o.technician.toLowerCase().includes(t))
    );
  };

  // Authentication Handlers
  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    setLoginError('');
    isExplicitAuthRef.current = true;
    try {
      const user = await loginWithGoogle();
      const appUser: AppUser = {
        id: user.uid,
        username: user.email || 'google_user',
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'فني معتمد',
        role: 'admin',
        permissions: {
          view_dashboard: true,
          view_orders: true,
          add_orders: true,
          edit_orders: true,
          delete_orders: true,
          access_settings: true
        }
      };
      localStorage.setItem('isAppAuthenticated', 'true');
      localStorage.setItem('appCurrentUser', JSON.stringify(appUser));
      sessionStorage.setItem('isAppAuthenticated', 'true');
      sessionStorage.setItem('appCurrentUser', JSON.stringify(appUser));
      setCurrentUser(appUser);
      setIsAuthenticated(true);
      await loadAllData();
    } catch (err: any) {
      console.warn("Google sign-in notice:", err?.code || err?.message);
      setLoginError(err.message || 'فشل تسجيل الدخول بحساب Google');
    } finally {
      isExplicitAuthRef.current = false;
      setIsAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = loginEmailVal.trim();
    const cleanPass = loginPassVal.trim();

    // Verification and validation of input fields before processing
    if (!cleanEmail) {
      setLoginError('يرجى إدخال البريد الإلكتروني');
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setLoginError('صيغة البريد الإلكتروني غير صالحة');
      return;
    }
    if (!cleanPass) {
      setLoginError('يرجى إدخال كلمة المرور');
      return;
    }
    if (cleanPass.length < 6) {
      setLoginError('يجب أن تتكون كلمة المرور من 6 خانات أو أحرف على الأقل');
      return;
    }

    if (authMode === 'firebase_register') {
      if (!regCenterName.trim()) {
        setLoginError('يرجى إدخال اسم مركز الصيانة');
        return;
      }
      if (!regTechnicianName.trim()) {
        setLoginError('يرجى إدخال اسم المهندس المسؤول / الفني');
        return;
      }
      if (!regCenterMobile.trim()) {
        setLoginError('يرجى إدخال رقم موبايل مركز الصيانة');
        return;
      }
      if (!regCountry.trim()) {
        setLoginError('يرجى اختيار اسم البلد من القائمة المنسدلة');
        return;
      }
    }

    setIsAuthLoading(true);
    setLoginError('');
    setResetSuccessMsg('');
    isExplicitAuthRef.current = true;
    try {
      let user;
      let activeDisplayName = 'فني صيانة معتمد';

      if (authMode === 'firebase_register') {
        const profilePayload: RegisterCenterProfile = {
          centerName: regCenterName.trim(),
          centerLogo: regCenterLogo || '',
          technicianName: regTechnicianName.trim(),
          centerPhone: regCenterMobile.trim(),
          email: cleanEmail,
          currency: regCurrency.trim() || 'دينار',
          countryName: regCountry.trim(),
          countryCode: regCountryCode.trim()
        };
        user = await registerWithEmail(cleanEmail, cleanPass, profilePayload);
        activeDisplayName = profilePayload.technicianName || 'فني صيانة';
        setCenterName(profilePayload.centerName);
        if (profilePayload.centerLogo) setCenterLogo(profilePayload.centerLogo);
      } else {
        user = await loginWithEmail(cleanEmail, cleanPass);
        activeDisplayName = user.displayName || localStorage.getItem('engineerName') || user.email?.split('@')[0] || 'فني صيانة معتمد';
        const savedCenter = localStorage.getItem('centerName') || localStorage.getItem('lastRegisteredCenterName');
        const savedLogo = localStorage.getItem('centerLogo') || localStorage.getItem('lastRegisteredCenterLogo');
        if (savedCenter) setCenterName(savedCenter);
        if (savedLogo) setCenterLogo(savedLogo);
      }

      const appUser: AppUser = {
        id: user.uid,
        username: user.email || cleanEmail || 'technician',
        email: user.email || cleanEmail,
        displayName: activeDisplayName,
        role: 'admin',
        permissions: {
          view_dashboard: true,
          view_orders: true,
          add_orders: true,
          edit_orders: true,
          delete_orders: true,
          access_settings: true
        }
      };
      localStorage.setItem('isAppAuthenticated', 'true');
      localStorage.setItem('appCurrentUser', JSON.stringify(appUser));
      sessionStorage.setItem('isAppAuthenticated', 'true');
      sessionStorage.setItem('appCurrentUser', JSON.stringify(appUser));
      setCurrentUser(appUser);
      setIsAuthenticated(true);

      // Clean load of isolated data for this specific user UID
      setOrders([]);
      setCustomers([]);
      setNotificationLogs([]);
      await loadAllData();
    } catch (err: any) {
      console.warn("Email auth notice:", err?.code || err?.message);
      const code = err?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setLoginError('مزود البريد الإلكتروني غير مفعّل في لوحة Firebase Console. يرجى تفعيل (Email/Password) في قسم Authentication > Sign-in method.');
      } else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setLoginError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else if (code === 'auth/too-many-requests') {
        setLoginError('تم تجاوز الحد المسموح من المحاولات، يرجى الانتظار قليلاً ثم المحاولة مرة أخرى');
      } else if (code === 'auth/email-already-in-use') {
        setLoginError('هذا البريد مسجل مسبقاً، يمكنك تسجيل الدخول به مباشرة بدلاً من إنشاء حساب جديد');
      } else if (code === 'auth/weak-password') {
        setLoginError('كلمة المرور ضعيفة، يجب أن تتكون من 6 خانات على الأقل');
      } else if (code === 'auth/invalid-email') {
        setLoginError('صيغة البريد الإلكتروني غير صحيحة');
      } else {
        setLoginError(err?.message || 'حدث خطأ أثناء المصادقة');
      }
    } finally {
      isExplicitAuthRef.current = false;
      setIsAuthLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!loginEmailVal.trim()) {
      setLoginError('يرجى كتابة بريدك الإلكتروني في الحقل أولاً لإرسال الرابط');
      return;
    }
    setIsAuthLoading(true);
    setLoginError('');
    setResetSuccessMsg('');
    try {
      await resetPasswordEmail(loginEmailVal);
      setResetSuccessMsg('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني بنجاح!');
    } catch (err: any) {
      setLoginError('تعذر إرسال الرابط: ' + (err.message || ''));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    localStorage.removeItem('isAppAuthenticated');
    localStorage.removeItem('appCurrentUser');
    localStorage.removeItem('db_app_settings_backup');
    sessionStorage.removeItem('isAppAuthenticated');
    sessionStorage.removeItem('appCurrentUser');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setOrders([]);
    setCustomers([]);
    setNotificationLogs([]);
  };

  const handleDeletePreviousAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = delEmailVal.trim().toLowerCase();
    const targetPass = delPassVal.trim();
    if (!targetEmail || !targetPass) {
      setDelMsg({ type: 'error', text: 'يرجى إدخال البريد الإلكتروني وكلمة المرور للحساب المراد حذفه' });
      return;
    }
    setDelLoading(true);
    setDelMsg(null);
    try {
      await deleteUserAccount(targetEmail, targetPass);
      setDelMsg({ 
        type: 'success', 
        text: '✓ تم حذف الحساب والبريد الإلكتروني من Firebase بنجاح! تم تحرير البريد بالكامل ويمكنك الآن تسجيله كحساب جديد.' 
      });
      setDelEmailVal('');
      setDelPassVal('');
      if (loginEmailVal.toLowerCase() === targetEmail) {
        setLoginEmailVal('');
      }
      setLoginError('');
    } catch (err: any) {
      console.warn("Delete account notice:", err?.code || err?.message);
      let errMsg = err?.message || 'فشل حذف الحساب';
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        errMsg = 'كلمة المرور غير صحيحة، يرجى كتابة كلمة مرور هذا الحساب لحذفه';
      } else if (err?.code === 'auth/user-not-found') {
        errMsg = 'هذا البريد غير موجود أو تم حذفه مسبقاً من Firebase';
      }
      setDelMsg({ type: 'error', text: errMsg });
    } finally {
      setDelLoading(false);
    }
  };

  const handleDeleteCurrentAccount = async () => {
    if (!window.confirm("تحذير أمان: هل أنت متأكد من رغبتك في حذف حسابك الحالي والبريد الإلكتروني من Firebase نهائياً؟\nسيتم مسح بيانات تسجيل الدخول بالكامل وتحرير هذا البريد.")) {
      return;
    }
    try {
      await deleteCurrentLoggedInAccount();
      localStorage.removeItem('isAppAuthenticated');
      localStorage.removeItem('appCurrentUser');
      localStorage.removeItem('db_app_settings_backup');
      sessionStorage.clear();
      setCurrentUser(null);
      setIsAuthenticated(false);
      setOrders([]);
      setCustomers([]);
      setNotificationLogs([]);
      alert("تم حذف حسابك والبريد الإلكتروني من Firebase بنجاح.");
    } catch (err: any) {
      console.warn("Delete current account notice:", err?.code || err?.message);
      alert("تعذر حذف الحساب: " + (err.message || 'حدث خطأ غير متوقع'));
    }
  };

  const userDisplayEmail = (
    currentUser?.email ||
    (currentUser?.username && currentUser.username.includes('@') ? currentUser.username : '') ||
    auth?.currentUser?.email ||
    (typeof localStorage !== 'undefined' ? (localStorage.getItem('centerEmail') || localStorage.getItem('lastLoginEmail')) : '') ||
    currentUser?.displayName ||
    'حساب الصيانة'
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col antialiased text-gray-800" dir="rtl">
      
      {/* Top Navbar Header */}
      {isAuthenticated && (
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 ">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center gap-2 text-xs font-sans order-2 sm:order-1">
            <button 
              onClick={handleManualSync}
              disabled={isSyncing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all font-bold ${
                isSyncing 
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                  : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              <svg className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21v-5h5" />
              </svg>
              {isSyncing ? 'جاري المزامنة...' : 'مزامنة السحابية'}
            </button>

            {/* Quick Microphone Permission Status Button in Header */}
            {micPermissionState !== 'granted' ? (
              <button
                type="button"
                onClick={handleActivateMicrophone}
                disabled={isActivatingMic}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold transition-all cursor-pointer shadow-xs"
                title="اضغط للسماح باستخدام المايكروفون لتفعيل الإدخال الصوتي"
              >
                <Mic className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span className="hidden sm:inline">تفعيل المايكروفون</span>
              </button>
            ) : (
              <span
                className="hidden md:flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-xl font-bold"
                title="المايكروفون مفعل وجاهز للإدخال الصوتي في كروت الصيانة"
              >
                <Mic className="w-3 h-3 text-emerald-600" />
                <span>إدخال صوتي مفعل</span>
              </span>
            )}

            {/* User Profile Badge & Logout (Full Email Display) */}
            <div className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100/90 border border-gray-200/80 px-2.5 py-1.5 rounded-xl transition-all">
              <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col text-right overflow-hidden min-w-0">
                <span 
                  className="font-mono font-bold text-gray-800 text-[11px] leading-tight truncate max-w-[170px] sm:max-w-[260px]"
                  title={userDisplayEmail}
                  dir="ltr"
                >
                  {userDisplayEmail}
                </span>
                {currentUser?.displayName && currentUser.displayName !== userDisplayEmail && (
                  <span className="hidden md:inline text-[9px] text-teal-700 font-sans truncate">
                    {currentUser.displayName}
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                title="تسجيل الخروج والتبديل"
                className="text-gray-400 hover:text-rose-600 p-1 rounded-lg hover:bg-white transition-all cursor-pointer shrink-0 mr-0.5"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex p-1 bg-gray-50 rounded-2xl border border-gray-100/60 overflow-x-auto max-w-full relative order-1 sm:order-2 mx-auto">
            {isAuthenticated && (!currentUser || !currentUser.permissions || currentUser.permissions.view_dashboard) && (
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  // Remove deep link if any on tab switch
                  if (window.location.search) {
                    window.history.pushState({}, '', window.location.origin);
                  }
                }}
                className={`relative px-4 py-2.5 rounded-xl text-xs font-sans font-extrabold transition-all flex items-center gap-2 whitespace-nowrap z-10 ${
                  activeTab === 'dashboard'
                    ? 'text-teal-800'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {activeTab === 'dashboard' && (
                  <motion.span
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-white rounded-xl  z-[-1]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <LayoutDashboard className="w-4 h-4" />
                لوحة التحكم
              </button>
            )}
            
            {isAuthenticated && (!currentUser || !currentUser.permissions || currentUser.permissions.view_orders) && (
              <button
                onClick={() => setActiveTab('orders')}
                className={`relative px-4 py-2.5 rounded-xl text-xs font-sans font-extrabold transition-all flex items-center gap-2 whitespace-nowrap z-10 ${
                  activeTab === 'orders'
                    ? 'text-teal-800'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {activeTab === 'orders' && (
                  <motion.span
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-white rounded-xl  z-[-1]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Wrench className="w-4 h-4" />
                طلبات الصيانة
              </button>
            )}

            {isAuthenticated && (!currentUser || !currentUser.permissions || currentUser.permissions.view_orders) && (
              <button
                onClick={() => setActiveTab('completed')}
                className={`relative px-4 py-2.5 rounded-xl text-xs font-sans font-extrabold transition-all flex items-center gap-2 whitespace-nowrap z-10 ${
                  activeTab === 'completed'
                    ? 'text-teal-800'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {activeTab === 'completed' && (
                  <motion.span
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-white rounded-xl  z-[-1]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <CheckCircle className="w-4 h-4" />
                الأجهزة المنجزة
              </button>
            )}
            


            {isAuthenticated && (!currentUser || !currentUser.permissions || currentUser.permissions.view_orders) && (
              <button
                onClick={() => setActiveTab('contacts')}
                className={`relative px-4 py-2.5 rounded-xl text-xs font-sans font-extrabold transition-all flex items-center gap-2 whitespace-nowrap z-10 ${
                  activeTab === 'contacts'
                    ? 'text-teal-800'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {activeTab === 'contacts' && (
                  <motion.span
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-white rounded-xl  z-[-1]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <User className="w-4 h-4 text-indigo-600" />
                الاسماء
              </button>
            )}

            {!isAuthenticated && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`relative px-4 py-2.5 rounded-xl text-xs font-sans font-extrabold transition-all flex items-center gap-2 whitespace-nowrap z-10 ${
                  activeTab === 'dashboard'
                    ? 'text-teal-800'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {activeTab === 'dashboard' && (
                  <motion.span
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-white rounded-xl  z-[-1]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Lock className="w-4 h-4 text-amber-500 animate-pulse" />
                تسجيل الدخول للموظفين
              </button>
            )}
            
            {isAuthenticated && (!currentUser || !currentUser.permissions || currentUser.permissions.access_settings) && (
              <>
              <button
                onClick={() => setActiveTab('logs')}
                className={`relative px-4 py-2.5 rounded-xl text-xs font-sans font-extrabold transition-all flex items-center gap-2 whitespace-nowrap z-10 ${
                  activeTab === 'logs'
                    ? 'text-teal-800'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {activeTab === 'logs' && (
                  <motion.span
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-white rounded-xl  z-[-1]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <FileText className="w-4 h-4" />
                الرسائل المرسلة
              </button>

              <button
                onClick={() => setActiveTab('notifications')}
                className={`relative px-4 py-2.5 rounded-xl text-xs font-sans font-extrabold transition-all flex items-center gap-2 whitespace-nowrap z-10 ${
                  activeTab === 'notifications'
                    ? 'text-teal-800'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                                

{activeTab === 'notifications' && (
                  <motion.span
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-white rounded-xl  z-[-1]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Settings className="w-4 h-4" />
                الاعدادات
              </button>
              </>
            )}
          </nav>



        </div>
      </header>
      )}

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 font-sans mt-4 font-bold text-sm">جاري تحميل البيانات السحابية بأمان...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {!isAuthenticated ? (
              <motion.div
                key="login-panel"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`w-full mx-auto my-8 bg-white rounded-3xl border border-gray-100 overflow-hidden text-right shadow-2xl transition-all duration-300 ${
                  authMode === 'firebase_register' ? 'max-w-xl' : 'max-w-md'
                }`}
                dir="rtl"
              >
                <div className="bg-gradient-to-r from-teal-700 to-teal-900 px-6 py-8 text-white text-center relative font-sans">
                  <div className="mx-auto w-16 h-16 bg-white/15 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md overflow-hidden border border-white/10">
                    {centerLogo ? (
                      <img
                        src={centerLogo}
                        alt={centerName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Wrench className="w-8 h-8 text-teal-100 animate-pulse" />
                    )}
                  </div>
                  <h3 className="font-extrabold text-xl tracking-tight">{centerName || 'مركز الصيانة الذكي'}</h3>
                </div>

                <div className="p-6 sm:p-8 space-y-5">


                  {/* Auth Mode Tabs: Login / Register */}
                  <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-sans font-bold">
                    <button
                      type="button"
                      onClick={() => { 
                        setAuthMode('firebase_login'); 
                        setLoginError(''); 
                        setResetSuccessMsg(''); 
                        stopRegCamera(); 
                        const savedEmail = (typeof localStorage !== 'undefined' && localStorage.getItem('lastLoginEmail')) || '';
                        setLoginEmailVal(savedEmail);
                        setLoginPassVal('');
                      }}
                      className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                        authMode === 'firebase_login' ? 'bg-white text-teal-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      تسجيل الدخول بالبريد
                    </button>
                    <button
                      type="button"
                      onClick={() => { 
                        setAuthMode('firebase_register'); 
                        setLoginError(''); 
                        setResetSuccessMsg(''); 
                        // Empty all fields without hints
                        setRegCenterName('');
                        setRegTechnicianName('');
                        setRegCenterMobile('');
                        setRegCenterLogo('');
                        setRegCurrency('');
                        setRegCountry('');
                        setRegCountryCode('');
                        setLoginEmailVal('');
                        setLoginPassVal('');
                      }}
                      className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                        authMode === 'firebase_register' ? 'bg-white text-teal-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      إنشاء حساب جديد
                    </button>
                  </div>

                  {/* Firebase Email & Password Form */}
                  <form onSubmit={handleEmailAuth} className="space-y-4">
                    {/* Full Maintenance Center Onboarding Fields for New Users */}
                    {authMode === 'firebase_register' && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        {/* 1. Center Logo with Upload and Camera */}
                        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80 space-y-3">
                          <label className="block text-gray-800 font-sans font-extrabold text-xs flex items-center gap-1.5 justify-end">
                            <ImageIcon className="w-4 h-4 text-teal-700" />
                            <span>شعار المركز</span>
                          </label>
                          <div className="flex flex-col sm:flex-row items-center gap-4">
                            {/* Logo Preview box */}
                            <div className="relative w-24 h-24 rounded-2xl bg-white border-2 border-dashed border-teal-300 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                              {regCenterLogo ? (
                                <>
                                  <img src={regCenterLogo} alt="Logo" className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => setRegCenterLogo('')}
                                    className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                                    title="حذف الشعار"
                                  >
                                    <Trash2 className="w-4 h-4 text-rose-300" />
                                  </button>
                                </>
                              ) : (
                                <div className="text-center p-2 text-gray-400">
                                  <ImageIcon className="w-7 h-7 mx-auto mb-1 opacity-50 text-teal-600" />
                                  <span className="text-[9px] font-bold block text-gray-400">شعار المركز</span>
                                </div>
                              )}
                            </div>

                            <div className="space-y-2 w-full text-right">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => regFileInputRef.current?.click()}
                                  className="px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                >
                                  <Upload className="w-3.5 h-3.5 text-teal-600" />
                                  <span>اختيار ملف صورة الشعار</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={isRegCameraOpen ? stopRegCamera : startRegCamera}
                                  className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
                                    isRegCameraOpen
                                      ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                      : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
                                  }`}
                                >
                                  <Camera className="w-3.5 h-3.5 text-teal-600" />
                                  <span>{isRegCameraOpen ? 'إيقاف الكاميرا' : 'التقاط صورة فورا بالكاميرا'}</span>
                                </button>
                              </div>
                              <p className="text-[10px] text-gray-500 leading-normal font-sans">
                                يدعم صيغ JPG, PNG. يتم ضغط الصورة تلقائياً لسرعة تحميل الفاتورة وتوفير مساحة التخزين.
                              </p>

                              {isRegCameraOpen && (
                                <div className="mt-2 bg-black rounded-xl p-2.5 flex flex-col items-center gap-2">
                                  <video ref={regVideoRef} autoPlay playsInline className="w-48 h-48 object-cover rounded-lg border-2 border-teal-500" />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={captureRegCameraPhoto}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                                    >
                                      التقاط الصورة الآن
                                    </button>
                                    <button
                                      type="button"
                                      onClick={stopRegCamera}
                                      className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                                    >
                                      إلغاء
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <input
                              type="file"
                              ref={regFileInputRef}
                              accept="image/*"
                              onChange={handleRegFileChange}
                              className="hidden"
                            />
                          </div>
                        </div>

                        {/* 2. Center Name */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1.5 justify-end">
                            <Building2 className="w-3.5 h-3.5 text-teal-600" />
                            <span>اسم المركز</span>
                          </label>
                          <input
                            type="text"
                            value={regCenterName}
                            onChange={(e) => setRegCenterName(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-sans text-right text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-bold"
                            required
                          />
                        </div>

                        {/* 3. Technician Name */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1.5 justify-end">
                            <User className="w-3.5 h-3.5 text-teal-600" />
                            <span>اسم المهندس</span>
                          </label>
                          <input
                            type="text"
                            value={regTechnicianName}
                            onChange={(e) => setRegTechnicianName(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-sans text-right text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-bold"
                            required
                          />
                        </div>

                        {/* 4. Center Mobile Phone */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1.5 justify-end">
                            <Phone className="w-3.5 h-3.5 text-teal-600" />
                            <span>رقم الموبايل</span>
                          </label>
                          <input
                            type="tel"
                            value={regCenterMobile}
                            onChange={(e) => setRegCenterMobile(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-center text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-bold"
                            dir="ltr"
                            required
                          />
                        </div>

                        {/* 5. Country Selection Dropdown (Currency & Dial Code automatically mapped & hidden) */}
                        <div className="space-y-1.5 text-right">
                          <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1.5 justify-end">
                            <Globe className="w-3.5 h-3.5 text-teal-600" />
                            <span>اسم البلد</span>
                          </label>
                          <select
                            value={regCountry}
                            onChange={(e) => handleCountryChange(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-sans text-right text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-bold cursor-pointer"
                            required
                          >
                            <option value="">-- اختر اسم البلد من القائمة --</option>
                            {COUNTRIES_LIST.map((country) => (
                              <option key={country.name} value={country.name}>
                                {country.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Email field (Shared for Login and Register) */}
                    <div className="space-y-1.5 text-right">
                      <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1.5 justify-end">
                        <Mail className="w-3.5 h-3.5 text-teal-600" />
                        <span>
                          {authMode === 'firebase_register'
                            ? 'البريد الإلكتروني للمركز (لحجز مساحة التخزين السحابي)'
                            : 'البريد الإلكتروني (Email)'}
                        </span>
                      </label>
                      <input
                        type="email"
                        value={loginEmailVal}
                        onChange={(e) => { setLoginEmailVal(e.target.value); setLoginError(''); setResetSuccessMsg(''); }}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-sans text-center text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-medium"
                        dir="ltr"
                        required
                      />
                    </div>

                    {/* Password field */}
                    <div className="space-y-1.5 text-right">
                      <div className="flex justify-between items-center">
                        {authMode === 'firebase_login' && (
                          <button
                            type="button"
                            onClick={handleResetPassword}
                            className="text-[11px] text-teal-700 hover:underline font-medium cursor-pointer"
                          >
                            نسيت كلمة المرور؟
                          </button>
                        )}
                        <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1.5 justify-end">
                          <Lock className="w-3.5 h-3.5 text-teal-600" />
                          <span>كلمة المرور (Password)</span>
                        </label>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={loginPassVal}
                          onChange={(e) => { 
                            setLoginPassVal(e.target.value); 
                            setLoginError(''); 
                          }}
                          autoComplete="current-password"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck="false"
                          dir="ltr"
                          className="w-full px-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-center text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-medium"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 left-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                          tabIndex={-1}
                          title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {resetSuccessMsg && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs font-sans text-center">
                        ✓ {resetSuccessMsg}
                      </div>
                    )}

                    {loginError && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl text-xs font-sans text-right space-y-2">
                        <div className="font-bold flex items-center gap-1.5 text-rose-700">
                          <span>⚠️ {loginError}</span>
                        </div>
                        {authMode === 'firebase_register' && (loginError.includes('مسجل مسبقاً') || loginError.includes('already-in-use')) && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setAuthMode('firebase_login');
                                setLoginError('');
                              }}
                              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                            >
                              <span>التبديل إلى تسجيل الدخول بهذا البريد فوراً ←</span>
                            </button>
                          </div>
                        )}
                        {loginError.includes('Firebase Console') && (
                          <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100 text-[11px] leading-relaxed text-gray-700 space-y-1">
                            <p className="font-bold text-teal-800">لتفعيل تسجيل الدخول الآن:</p>
                            <ol className="list-decimal list-inside space-y-0.5 text-gray-600">
                              <li>افتح لوحة <a href="https://console.firebase.google.com/project/gen-lang-client-0706732363/authentication/providers" target="_blank" rel="noreferrer" className="text-teal-700 underline font-bold">Firebase Console</a> لمشروعك.</li>
                              <li>اختر <strong>Email/Password</strong> وقم بتفعيله (Enable).</li>
                              <li>اضغط <strong>Save (حفظ)</strong>، ثم أعد المحاولة هنا فوراً.</li>
                            </ol>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isAuthLoading}
                      className="w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-sans font-bold py-3 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {isAuthLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4" />
                          <span>
                            {authMode === 'firebase_register' ? 'إنشاء حساب جديد وتفعيل مساحتي' : 'دخول بحساب البريد'}
                          </span>
                        </>
                      )}
                    </button>


                  </form>
                </div>
              </motion.div>
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <DashboardView
                      orders={orders}
                      notificationLogs={notificationLogs}
                      onNavigateToOrders={(tab = 'orders', status = 'all', searchTerm = '') => { 
                        setActiveTab(tab); 
                        setOrdersStatusFilter(status); 
                        if (searchTerm) {
                          setOrdersSearchTerm(searchTerm);
                        }
                      }}
                      onSendWhatsAppReminder={handleSendWhatsAppReminder}
                      overdueOrders={getOverdueMaintenanceOrders()}
                      onScanClick={() => setIsScannerOpen(true)}
                      onViewCustomer={(name, phone) => openCustomerProfile(name, phone)}
                      canAddOrder={currentUser?.permissions ? currentUser.permissions.add_orders : true}
                      onAddOrderClick={() => {
                        setPrefillCustomerForAdd(null);
                        setOrdersSearchTerm('');
                        setOrdersStatusFilter('all');
                        setOpenAddOrderModal(true);
                        setActiveTab('orders');
                      }}
                    />
                  </motion.div>
                )}

                {activeTab === 'orders' && (
                  <motion.div
                    key="orders"
                    initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <OrdersView
                      orders={orders}
                      customers={customers}
                      viewType="active"
                      templates={templates}
                      appUrl={appUrl}
                      onSaveOrder={handleSaveOrder}
                      onDeleteOrder={handleDeleteOrder}
                      onClearAllOrders={handleClearAllOrders}
                      onTriggerDelivery={handleTriggerDelivery}
                      onLogNotification={handleLogNotification}
                      onScanClick={() => setIsScannerOpen(true)}
                      initialSearchTerm={ordersSearchTerm}
                      onClearInitialSearch={() => setOrdersSearchTerm('')}
                      initialStatusFilter={ordersStatusFilter}
                      onClearInitialStatusFilter={() => setOrdersStatusFilter('')}
                      currentUser={currentUser}
                      onViewCustomer={(name, phone) => openCustomerProfile(name, phone)}
                      initialOpenAddModal={openAddOrderModal}
                      onClearInitialOpenAddModal={() => setOpenAddOrderModal(false)}
                      initialPrefillCustomer={prefillCustomerForAdd}
                      onClearInitialPrefillCustomer={() => setPrefillCustomerForAdd(null)}
                    />
                  </motion.div>
                )}

                {activeTab === 'completed' && (
                  <motion.div
                    key="completed"
                    initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <OrdersView
                      orders={orders}
                      customers={customers}
                      viewType="completed"
                      templates={templates}
                      appUrl={appUrl}
                      onSaveOrder={handleSaveOrder}
                      onDeleteOrder={handleDeleteOrder}
                      onClearAllOrders={handleClearAllOrders}
                      onTriggerDelivery={handleTriggerDelivery}
                      onLogNotification={handleLogNotification}
                      onScanClick={() => setIsScannerOpen(true)}
                      initialSearchTerm={ordersSearchTerm}
                      onClearInitialSearch={() => setOrdersSearchTerm('')}
                      initialStatusFilter={ordersStatusFilter}
                      onClearInitialStatusFilter={() => setOrdersStatusFilter('')}
                      currentUser={currentUser}
                      onViewCustomer={(name, phone) => openCustomerProfile(name, phone)}
                    />
                  </motion.div>
                )}



{activeTab === 'contacts' && (
                  <motion.div
                    key="contacts"
                    initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <ContactsView
                      customers={customers}
                      orders={orders}
                      onSaveOrder={handleSaveOrder}
                      onDeleteOrder={handleDeleteOrder}
                      onSaveCustomer={handleSaveCustomer}
                      onDeleteCustomer={handleDeleteCustomer}
                      onScanClick={() => setIsScannerOpen(true)}
                      currentUser={currentUser}
                      onClearNames={handleClearNames}
                      onViewCustomer={(name, phone, customer) => openCustomerProfile(name, phone, customer)}
                    />
                  </motion.div>
                )}
                {activeTab === 'logs' && (
                  <motion.div
                    key="logs"
                    initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <LogsView 
                      notificationLogs={notificationLogs}
                      onViewCustomer={(name, phone) => openCustomerProfile(name, phone)}
                    />
                  </motion.div>
                )}
                {activeTab === 'notifications' && (
                  <motion.div
                    key="notifications"
                    initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <NotificationSettingsView
                      templates={templates}
                      notificationLogs={notificationLogs}
                      onSaveTemplate={handleSaveTemplate}
                      onClearLogs={handleClearLogs}
                      onClearNames={handleClearNames}
                      orders={orders}
                      onClearAllOrders={handleClearAllOrders}
                      onSettingsSaved={() => {
                        const isAuthLocal = localStorage.getItem('isAppAuthenticated') === 'true';
                        const isAuthSession = sessionStorage.getItem('isAppAuthenticated') === 'true';
                        setIsAuthenticated(isAuthLocal || isAuthSession);

                        // Reload templates from localStorage to sync any auto-replacements
                        const storedTemplates = localStorage.getItem('db_templates');
                        if (storedTemplates) {
                          try {
                            setTemplates(JSON.parse(storedTemplates));
                          } catch (e) {
                            console.error("Error reloading templates in onSettingsSaved:", e);
                          }
                        }

                        dbService.saveAppSettingsBackup(); // Trigger immediate cloud/local backup of settings
                      }}
                      onRefreshData={async () => {
                        const [freshOrders, freshCustomers] = await Promise.all([
                          dbService.getOrders(),
                          dbService.getCustomers(),
                        ]);
                        await applyReconciliationAndPersist(freshCustomers, freshOrders);
                      }}
                      onForceSync={handleForceSync}
                    />
                  </motion.div>
                )}
              </>
            )}
          </AnimatePresence>
        )}

      {isScannerOpen && (
        <ScannerModal
          onClose={() => setIsScannerOpen(false)}
          customers={customers}
          orders={orders}
          onOpenCustomerProfile={(cust) => {
            setIsScannerOpen(false);
            openCustomerProfile(cust.name, cust.phone, cust);
          }}
          onSelectOrder={(foundOrder) => {
            setIsScannerOpen(false);
            const isCompleted =
              foundOrder.status === DeviceStatus.DELIVERED ||
              foundOrder.status === DeviceStatus.UNREPAIRABLE;
            setScannedOrderId(foundOrder.id);
            setOrdersSearchTerm(foundOrder.id);
            setActiveTab(isCompleted ? 'completed' : 'orders');
          }}
          onNewOrderForCustomer={(cust) => {
            setIsScannerOpen(false);
            setPrefillCustomerForAdd({ name: cust.name, phone: cust.phone });
            setOrdersSearchTerm('');
            setOrdersStatusFilter('all');
            setOpenAddOrderModal(true);
            setActiveTab('orders');
          }}
          onAssignBarcodeToCustomer={handleAssignBarcodeToCustomer}
          onRegisterCustomerWithBarcode={handleRegisterCustomerWithBarcode}
          onScan={(result) => {
            setIsScannerOpen(false);
            const scannedId = extractScannedBarcodeId(result);
            if (!scannedId) return;

            const matchedCustomer = customers.find(
              c =>
                c.customerBarcode.trim().toUpperCase() === scannedId ||
                phonesMatch(c.phone, scannedId)
            );
            if (matchedCustomer) {
              openCustomerProfile(matchedCustomer.name, matchedCustomer.phone, matchedCustomer);
              return;
            }

            const foundOrder = orders.find(
              o =>
                o.id.toUpperCase() === scannedId ||
                (o.serialNumber && o.serialNumber.toUpperCase() === scannedId) ||
                (o.deviceBarcode && o.deviceBarcode.toUpperCase() === scannedId) ||
                phonesMatch(o.customerPhone, scannedId)
            );

            setScannedOrderId(scannedId);
            if (foundOrder) {
              const isCompleted =
                foundOrder.status === DeviceStatus.DELIVERED ||
                foundOrder.status === DeviceStatus.UNREPAIRABLE;
              setOrdersSearchTerm(foundOrder.id);
              setActiveTab(isCompleted ? 'completed' : 'orders');
            } else {
              setOrdersSearchTerm(scannedId);
              setActiveTab('orders');
            }
          }}
        />
      )}
      </main>

      {/* Footer credits */}
      <footer className="bg-white border-t border-gray-100 py-6 text-center text-xs text-gray-400 font-sans mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span>&copy; {new Date().getFullYear()} نظام الصيانة الذكي. جميع الحقوق محفوظة لمتجر الصيانة الخاص بك.</span>
          <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
            <Database className="w-3.5 h-3.5 text-teal-600" />
            تخزين سحابي آمن بـ <strong>Firestore Database</strong>
          </span>
        </div>
      </footer>

      {/* Confirm Delivery Modal */}
      {deliveryOrder && (
        <DeliverDeviceModal
          order={deliveryOrder}
          templates={templates}
          appUrl={appUrl}
          onConfirm={handleConfirmDelivery}
          onClose={() => setDeliveryOrder(null)}
        />
      )}

      {/* Customer Full Profile, History & Reports Modal */}
      {selectedCustomerProfile && (
        <CustomerProfileModal
          customer={selectedCustomerProfile.customer}
          customers={customers}
          customerName={selectedCustomerProfile.name}
          customerPhone={selectedCustomerProfile.phone}
          orders={orders}
          notificationLogs={notificationLogs}
          templates={templates}
          appUrl={appUrl}
          currentUser={currentUser}
          onSaveOrder={handleSaveOrder}
          onUpdateCustomerBarcode={handleUpdateCustomerBarcode}
          onTriggerDelivery={(order) => setDeliveryOrder(order)}
          onLogNotification={handleLogNotification}
          onClose={() => setSelectedCustomerProfile(null)}
          onNavigateToOrder={(orderId) => {
            setSelectedCustomerProfile(null);
            setOrdersSearchTerm(orderId);
            setActiveTab('orders');
          }}
          onOpenNewOrderForCustomer={(name, phone) => {
            setSelectedCustomerProfile(null);
            setPrefillCustomerForAdd({ name, phone: phone || '' });
            setOrdersSearchTerm('');
            setOrdersStatusFilter('all');
            setOpenAddOrderModal(true);
            setActiveTab('orders');
          }}
        />
      )}

      {/* Delete Previous Account Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 text-right">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <span>حذف بريد أو حساب سابق من Firebase</span>
                <Trash2 className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-rose-50/70 p-3 rounded-2xl border border-rose-200/60 text-xs text-rose-900 leading-relaxed space-y-2">
              <p className="font-bold">خيارات حذف الإيميلات المسجلة في Firebase:</p>
              <div className="space-y-2 text-[11px]">
                <div>
                  <p className="mb-1">1. <strong>لوحة تحكم Firebase المباشرة (دون كلمة مرور وبضغطة واحدة):</strong></p>
                  <a
                    href="https://console.firebase.google.com/project/gen-lang-client-0706732363/authentication/users"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-xs text-[11px]"
                  >
                    <span>فتح قائمة مستخدمي Firebase Console وحذف أي إيميل فوراً ↗</span>
                  </a>
                </div>
                <div className="pt-1 border-t border-rose-200/60">
                  <p>2. <strong>أو الحذف المباشر من هنا بإدخال كلمة مرور الحساب:</strong></p>
                </div>
              </div>
            </div>

            <form onSubmit={handleDeletePreviousAccount} className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="block text-gray-700 font-bold text-xs">البريد الإلكتروني المراد حذفه:</label>
                <input
                  type="email"
                  value={delEmailVal}
                  onChange={(e) => setDelEmailVal(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-sans text-center text-xs focus:bg-white outline-none font-medium"
                  dir="ltr"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-gray-700 font-bold text-xs">كلمة مرور هذا الحساب:</label>
                <input
                  type="password"
                  value={delPassVal}
                  onChange={(e) => setDelPassVal(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono text-center text-xs focus:bg-white outline-none font-medium"
                  dir="ltr"
                  required
                />
              </div>

              {delMsg && (
                <div className={`p-2.5 rounded-xl text-xs font-sans text-center border ${
                  delMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {delMsg.text}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteAccountModal(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  disabled={delLoading}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {delLoading ? 'جاري الحذف...' : 'حذف الحساب نهائياً'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
