import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MaintenanceOrder, DeviceStatus, NotificationTemplate, NotificationLog, AppUser, isContactOrder } from './types';
import { 
  dbService, 
  LocalStorageDB, 
  auth, 
  loginWithEmail, 
  registerWithEmail, 
  loginWithGoogle, 
  logoutUser, 
  resetPasswordEmail, 
  getCurrentUserId 
} from './lib/firebase';
import { DEFAULT_TEMPLATES, formatNotification, getWhatsAppLink, openWhatsAppDirectly } from './lib/notifications';
import { initializeLocalDatabase } from './lib/seed';

// Import Views
import DashboardView from './components/DashboardView';
import OrdersView from './components/OrdersView';
import NotificationSettingsView from './components/NotificationSettingsView';
import DeliverDeviceModal from './components/DeliverDeviceModal';
import { ContactsView } from './components/ContactsView';
import { LogsView } from './components/LogsView';
import { ScannerModal } from "./components/ScannerModal";
import { CustomerProfileModal } from './components/CustomerProfileModal';

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
  Eye,
  EyeOff,
  Mic,
  MicOff,
  CheckCircle2
} from 'lucide-react';
import { checkMicrophonePermission, requestMicrophonePermission } from './utils/microphonePermissions';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'completed' | 'notifications' | 'contacts' | 'logs'>('dashboard');
  
  // App state
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [scannedOrderId, setScannedOrderId] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [ordersSearchTerm, setOrdersSearchTerm] = useState<string>('');
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<string>('');
  const [deliveryOrder, setDeliveryOrder] = useState<MaintenanceOrder | null>(null);
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<{ name: string; phone?: string } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [centerName, setCenterName] = useState(() => localStorage.getItem('centerName') || 'TECHNO');
  const [centerLogo, setCenterLogo] = useState(() => localStorage.getItem('centerLogo') || '');

  // Authentication states - Strictly Firebase Auth
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const userJson = (typeof localStorage !== 'undefined' && localStorage.getItem('appCurrentUser')) || 
                     (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('appCurrentUser'));
    return userJson ? JSON.parse(userJson) : null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const isAuthLocal = typeof localStorage !== 'undefined' && localStorage.getItem('isAppAuthenticated') === 'true';
    const isAuthSession = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('isAppAuthenticated') === 'true';
    const hasUser = (typeof localStorage !== 'undefined' && !!localStorage.getItem('appCurrentUser')) ||
                    (typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('appCurrentUser'));
    return (isAuthLocal || isAuthSession) && hasUser;
  });

  const [loginPassVal, setLoginPassVal] = useState('');
  const [loginEmailVal, setLoginEmailVal] = useState('');
  const [registerNameVal, setRegisterNameVal] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');
  const [authMode, setAuthMode] = useState<'firebase_login' | 'firebase_register'>('firebase_login');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

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

  // App URL for tracking links
  const appUrl = window.location.origin;

  // One-time automated system factory reset to clear out all records across LocalStorage & Firestore
  useEffect(() => {
    const doFactoryReset = async () => {
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
        console.log("Printer settings cleared.");
        window.location.reload();
        return;
      }

      if (localStorage.getItem('removed_mock_data_v2') !== 'true') {
         console.log("Forcing complete wipe of local orders and logs...");
         localStorage.setItem('db_orders', '[]');
         localStorage.setItem('db_notification_logs', '[]');
         localStorage.setItem('removed_mock_data_v2', 'true');
         window.location.reload();
         return;
      }

      if (localStorage.getItem('removed_mock_data_v1') !== 'true') {
         console.log("Removing experimental mock data...");
         try {
           const mockOrderIds = ['ORD-1001', 'ORD-1002', 'ORD-1003', 'ORD-1004'];
           for (const id of mockOrderIds) {
             await dbService.deleteOrder(id);
           }
           const mockLogIds = ['NOT-1001', 'NOT-1002', 'NOT-1003'];
           for (const id of mockLogIds) {
             await dbService.deleteNotificationLog(id);
           }
           
           localStorage.setItem('removed_mock_data_v1', 'true');
           console.log("Experimental data removed. Reloading...");
           window.location.reload();
           return;
         } catch(e) {
           console.error("Failed to remove mock data:", e);
           localStorage.setItem('removed_mock_data_v1', 'true');
         }
      }

      if (localStorage.getItem('system_factory_reset_completed') !== 'true') {
         console.log("Performing automated initial factory reset...");
         try {
           const currentOrders = await dbService.getOrders();
           if (currentOrders.length > 0) {
              await dbService.clearAllOrders(currentOrders);
           }
           const currentLogs = await dbService.getNotificationLogs();
           if (currentLogs.length > 0) {
              await dbService.clearAllLogs(currentLogs);
           }
           
           // Clear specific localStorage keys
           localStorage.removeItem('db_orders');
           localStorage.removeItem('db_notification_logs');
           localStorage.removeItem('appUsersList');
           
           // Mark as done so it doesn't loop
           localStorage.setItem('system_factory_reset_completed', 'true');
           console.log("Factory reset successful. Reloading...");
           window.location.reload();
           return;
         } catch(e) {
           console.error("Factory reset failed:", e);
           // Still mark as done to prevent infinite loops on error
           localStorage.setItem('system_factory_reset_completed', 'true');
         }
      }
    };
    doFactoryReset();
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
      const isAuth = sessionStorage.getItem('isAppAuthenticated') === 'true';
      setIsAuthenticated(isAuth);
      if (isAuth) {
        const userJson = sessionStorage.getItem('appCurrentUser');
        setCurrentUser(userJson ? JSON.parse(userJson) : null);
      } else {
        setCurrentUser(null);
      }
    };
    window.addEventListener('storage', handleStorage);

    // Deep linking: check if URL has ?track=ORD-XXXX
    const searchParams = new URLSearchParams(window.location.search);
    const trackId = searchParams.get('track');
    if (trackId) {
      setOrdersSearchTerm(trackId.toUpperCase());
      setActiveTab('orders');
    }

    // Load initial data
    loadAllData();

    // Automatic sync and save every 5 minutes
    const syncInterval = setInterval(async () => {
      console.log("Auto-syncing with cloud every 5 minutes..."); setIsSyncing(true);
      try {
        // Backup settings and configurations
        await dbService.syncAppSettingsBackup();

        // Sync database records
        const synced = await dbService.syncData();
        setOrders(synced.orders);
        setNotificationLogs(synced.logs); setLastSyncTime(new Date()); setIsSyncing(false);
      } catch (err) {
        console.warn("Auto-sync failed:", err); setIsSyncing(false);
      }
    }, 5 * 60 * 1000);

    const handleAuthChange = () => {
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
  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await dbService.syncAppSettingsBackup();
      const synced = await dbService.syncData();
      setOrders(synced.orders);
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
    setLoading(true);
    try {
      // 0. Sync and restore comprehensive settings and configurations on startup
      try {
        await dbService.syncAppSettingsBackup();
      } catch (e) {
        console.warn("Initial app settings sync failed:", e);
      }

      // 1. Bidirectional sync & Load orders and logs on startup
      const synced = await dbService.syncData();
      let fetchedOrders = synced.orders;

      setOrders(fetchedOrders);

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
      let fetchedLogs = synced.logs;
      setNotificationLogs(fetchedLogs);
    } catch (error) {
      console.warn("Notice: Loading application data fallback active:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleForceSync = async () => {
    setLoading(true);
    try {
      // 1. Force upload of current local settings to cloud first (so local modifications are exported)
      await dbService.saveAppSettingsBackup();
      
      // 2. Sync orders and logs bidirectionally
      const synced = await dbService.syncData();
      setOrders(synced.orders);
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
      await dbService.saveOrder(updatedOrder);
      // Reload orders to reflect changes
      const freshOrders = await dbService.getOrders();
      setOrders(freshOrders);
    } catch (err) {
      console.error("Failed to save order:", err);
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
        alert('تم مسح كافة جهات الاتصال وطلبات الصيانة بالكامل بنجاح.');
      } else {
        const namesToDelete = orders.filter(isContactOrder);
        
        if (namesToDelete.length > 0) {
          await dbService.clearAllOrders(namesToDelete);
          setOrders(orders.filter(o => !isContactOrder(o)));
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

  const handleConfirmDelivery = async (
    recipientName: string,
    relationToCustomer: string,
    notes: string,
    statusUpdateText: string,
    finalCost?: number,
    updatedDiagnosis?: string
  ) => {
    if (!deliveryOrder) return;

    const actualCostVal = finalCost !== undefined && !isNaN(finalCost) ? finalCost : (deliveryOrder.actualCost ?? deliveryOrder.estimatedCost);
    const faultDescVal = updatedDiagnosis?.trim() || deliveryOrder.faultDescription;

    const updatedOrder: MaintenanceOrder = {
      ...deliveryOrder,
      status: DeviceStatus.DELIVERED,
      faultDescription: faultDescVal,
      actualCost: actualCostVal,
      statusUpdateText: (statusUpdateText || '').trim(),
      updatedAt: Date.now(),
      statusHistory: [
        ...(deliveryOrder.statusHistory || []),
        {
          status: DeviceStatus.DELIVERED,
          timestamp: Date.now(),
          note: `تم تسليم الجهاز بنجاح إلى المستلم: (${recipientName}) بصفته (${relationToCustomer}) - التكلفة المحصلة: ${actualCostVal} - التشخيص: ${faultDescVal}.`,
          updatedBy: 'موظف الاستقبال'
        }
      ],
      deliveryInfo: {
        recipientName,
        deliveryDate: Date.now(),
        relationToCustomer,
        notes
      }
    };

    await handleSaveOrder(updatedOrder);
    setDeliveryOrder(null);

    // Auto trigger WhatsApp delivery receipt message!
    const tpl = templates.find(t => t.statusTrigger === DeviceStatus.DELIVERED);
    if (tpl) {
      const msgs = formatNotification(tpl, updatedOrder, appUrl);
      openWhatsAppDirectly(updatedOrder.customerPhone, msgs.whatsapp);
      handleLogNotification(
        updatedOrder.id,
        updatedOrder.customerName,
        updatedOrder.customerPhone,
        'whatsapp',
        msgs.whatsapp,
        tpl.name
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
    triggerEvent: string
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
      triggerEvent
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
          order.deviceType === 'جهة اتصال' ||
          order.brandModel.includes('مستورد')
        ) {
          return false;
        }
        
        if (!order.expectedDeliveryDate) return false;
        
        const expectedDate = new Date(order.expectedDeliveryDate);
        // Set to end of the expected delivery day
        expectedDate.setHours(23, 59, 59, 999);
        const overdueMs = now - expectedDate.getTime();
        
        // Check if more than 48 hours delayed
        return overdueMs > 48 * 60 * 60 * 1000; 
      });

      if (overdue48h.length > 0) {
        let sentAny = false;
        
        for (const order of overdue48h) {
          const hasLog = notificationLogs.some(log => log.orderId === order.id && log.triggerEvent === 'تأخير أكثر من 48 ساعة (مجدول)');
          
          if (!hasLog) {
            const tpl = templates.find(t => t.id === 'overdue_48h') || templates.find(t => t.statusTrigger === 'overdue_48h');
            
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
    return orders.filter(
      (order) => order.status !== DeviceStatus.DELIVERED && (now - order.createdAt) > threeDaysInMs
    );
  };

  // Search filter for orders
  const getFilteredOrders = (term: string) => {
    if (!term.trim()) return orders;
    const t = term.toLowerCase().trim();
    return orders.filter(o => 
      o.customerName.toLowerCase().includes(t) ||
      o.customerPhone.includes(t) ||
      o.id.toLowerCase().includes(t) ||
      o.brandModel.toLowerCase().includes(t) ||
      (o.notes && o.notes.toLowerCase().includes(t)) ||
      (o.technician && o.technician.toLowerCase().includes(t))
    );
  };

  // Authentication Handlers
  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    setLoginError('');
    try {
      const user = await loginWithGoogle();
      const appUser: AppUser = {
        id: user.uid,
        username: user.email || 'google_user',
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
      sessionStorage.setItem('isAppAuthenticated', 'true');
      sessionStorage.setItem('appCurrentUser', JSON.stringify(appUser));
      setCurrentUser(appUser);
      setIsAuthenticated(true);
      await loadAllData();
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      setLoginError(err.message || 'فشل تسجيل الدخول بحساب Google');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmailVal.trim() || !loginPassVal.trim()) {
      setLoginError('يرجى ملء البريد الإلكتروني وكلمة المرور');
      return;
    }
    setIsAuthLoading(true);
    setLoginError('');
    setResetSuccessMsg('');
    try {
      let user;
      if (authMode === 'firebase_register') {
        user = await registerWithEmail(loginEmailVal, loginPassVal, registerNameVal.trim());
      } else {
        user = await loginWithEmail(loginEmailVal, loginPassVal);
      }
      const appUser: AppUser = {
        id: user.uid,
        username: user.email || 'technician',
        displayName: registerNameVal.trim() || user.displayName || user.email?.split('@')[0] || 'فني صيانة معتمد',
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
      console.error("Email auth error:", err);
      const code = err.code || '';
      if (code === 'auth/operation-not-allowed') {
        setLoginError('مزود البريد الإلكتروني غير مفعّل في لوحة Firebase Console. يرجى تفعيل (Email/Password) في قسم Authentication > Sign-in method.');
      } else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setLoginError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else if (code === 'auth/email-already-in-use') {
        setLoginError('هذا البريد مسجل مسبقاً، يمكنك تسجيل الدخول به مباشرة بدلاً من إنشاء حساب جديد');
      } else if (code === 'auth/weak-password') {
        setLoginError('كلمة المرور ضعيفة، يجب أن تتكون من 6 خانات على الأقل');
      } else if (code === 'auth/invalid-email') {
        setLoginError('صيغة البريد الإلكتروني غير صحيحة');
      } else {
        setLoginError(err.message || 'حدث خطأ أثناء المصادقة');
      }
    } finally {
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
    sessionStorage.removeItem('isAppAuthenticated');
    sessionStorage.removeItem('appCurrentUser');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setOrders([]);
    setNotificationLogs([]);
  };

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

            {/* User Profile Badge & Logout */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200/80 px-2.5 py-1 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-[10px]">
                {currentUser?.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
              </div>
              <div className="hidden sm:flex flex-col text-right">
                <span className="font-bold text-gray-800 text-[11px] leading-tight">
                  {currentUser?.displayName || currentUser?.username}
                </span>
                <span className="text-[9px] text-teal-700 font-mono tracking-tight" title={getCurrentUserId()}>
                  UID: {getCurrentUserId().slice(0, 10)}...
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="تسجيل الخروج والتبديل"
                className="text-gray-400 hover:text-rose-600 p-1 rounded-lg hover:bg-white transition-all cursor-pointer ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex p-1 bg-gray-50 rounded-2xl border border-gray-100/60 overflow-x-auto max-w-full relative order-1 sm:order-2 mx-auto">
            {isAuthenticated && (!currentUser || currentUser.permissions.view_dashboard) && (
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
            
            {isAuthenticated && (!currentUser || currentUser.permissions.view_orders) && (
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

            {isAuthenticated && (!currentUser || currentUser.permissions.view_orders) && (
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
            


            {isAuthenticated && (!currentUser || currentUser.permissions.view_orders) && (
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
            
            {isAuthenticated && (!currentUser || currentUser.permissions.access_settings) && (
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
                className="max-w-md w-full mx-auto my-12 bg-white rounded-3xl border border-gray-100  overflow-hidden text-right"
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
                      <Wrench className="w-8 h-8 text-teal-150 animate-pulse" />
                    )}
                  </div>
                  <h3 className="font-extrabold text-xl tracking-tight">{centerName || 'مركز الصيانة الذكي'}</h3>
                  <p className="text-teal-100 text-xs mt-1.5 leading-relaxed font-medium">
                    تسجيل الدخول السحابي الموحد - بياناتك معزولة بأمان عبر معرّف UID الخاص بك
                  </p>
                </div>

                <div className="p-6 sm:p-8 space-y-5">
                  {/* Google Fast Sign-In Button */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isAuthLoading}
                    className="w-full bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 border border-gray-300 font-sans font-bold py-3.5 px-4 rounded-2xl transition-all text-xs flex items-center justify-center gap-3 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>الدخول السريع عبر Google</span>
                  </button>

                  <div className="relative flex items-center justify-center my-3">
                    <div className="border-t border-gray-200 w-full"></div>
                    <span className="bg-white px-3 text-[11px] text-gray-400 font-sans font-medium whitespace-nowrap">
                      أو بواسطة البريد الإلكتروني
                    </span>
                    <div className="border-t border-gray-200 w-full"></div>
                  </div>

                  {/* Auth Mode Tabs: Login / Register */}
                  <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-sans font-bold">
                    <button
                      type="button"
                      onClick={() => { setAuthMode('firebase_login'); setLoginError(''); setResetSuccessMsg(''); }}
                      className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                        authMode === 'firebase_login' ? 'bg-white text-teal-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      تسجيل الدخول بالبريد
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthMode('firebase_register'); setLoginError(''); setResetSuccessMsg(''); }}
                      className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                        authMode === 'firebase_register' ? 'bg-white text-teal-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      إنشاء حساب جديد
                    </button>
                  </div>

                  {/* Firebase Email & Password Form */}
                  <form onSubmit={handleEmailAuth} className="space-y-4">
                    {/* Full Name field (Only in register mode) */}
                    {authMode === 'firebase_register' && (
                      <div className="space-y-1.5 text-right">
                        <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1.5 justify-end">
                          <User className="w-3.5 h-3.5 text-teal-600" />
                          <span>الاسم الكامل / اسم الفني أو المحل</span>
                        </label>
                        <input
                          type="text"
                          placeholder="مثال: أحمد محمد (فني الصيانة)"
                          value={registerNameVal}
                          onChange={(e) => setRegisterNameVal(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-sans text-right text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-medium"
                          required
                        />
                      </div>
                    )}

                    {/* Email field */}
                    <div className="space-y-1.5 text-right">
                      <label className="block text-gray-700 font-sans font-bold text-xs flex items-center gap-1.5 justify-end">
                        <Mail className="w-3.5 h-3.5 text-teal-600" />
                        <span>البريد الإلكتروني (Email)</span>
                      </label>
                      <input
                        type="email"
                        placeholder="name@example.com"
                        value={loginEmailVal}
                        onChange={(e) => { setLoginEmailVal(e.target.value); setLoginError(''); setResetSuccessMsg(''); }}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-sans text-center text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-medium"
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
                          placeholder="لا تقل عن 6 أحرف"
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

                  {/* Microphone Permission Pre-Activation Before Opening The App */}
                  <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-4 text-right space-y-2.5 mt-4 font-sans shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Mic className="w-4 h-4 text-emerald-700" />
                        <span className="font-bold text-xs text-emerald-950">
                          صلاحية المايكروفون للإدخال الصوتي
                        </span>
                      </div>
                      {micPermissionState === 'granted' ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> مفعل
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                          بانتظار الإذن
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed font-medium">
                      فعّل المايكروفون الآن قبل فتح التطبيق لتتمكن من إملاء أسماء الزبائن، تفاصيل الأعطال، والملاحظات بالصوت مباشرة دون الحاجة للكتابة اليدوية.
                    </p>
                    {micPermissionState !== 'granted' ? (
                      <button
                        type="button"
                        onClick={handleActivateMicrophone}
                        disabled={isActivatingMic}
                        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {isActivatingMic ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Mic className="w-4 h-4" />
                        )}
                        <span>السماح باستخدام المايكروفون الآن</span>
                      </button>
                    ) : (
                      <div className="text-[11px] text-emerald-800 font-bold flex items-center gap-1.5 justify-center py-2 bg-white/90 rounded-xl border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>المايكروفون مفعل وجاهز للإدخال الصوتي فور فتح التطبيق</span>
                      </div>
                    )}
                  </div>
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
                      onViewCustomer={(name, phone) => setSelectedCustomerProfile({ name, phone })}
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
                      onViewCustomer={(name, phone) => setSelectedCustomerProfile({ name, phone })}
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
                      onViewCustomer={(name, phone) => setSelectedCustomerProfile({ name, phone })}
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
                      orders={orders}
                      onSaveOrder={handleSaveOrder}
                      onDeleteOrder={handleDeleteOrder}
                      currentUser={currentUser}
                      onClearNames={handleClearNames}
                      onViewCustomer={(name, phone) => setSelectedCustomerProfile({ name, phone })}
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
                      onViewCustomer={(name, phone) => setSelectedCustomerProfile({ name, phone })}
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
                        setIsAuthenticated(sessionStorage.getItem('isAppAuthenticated') === 'true');

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
                        const freshOrders = await dbService.getOrders();
                        setOrders(freshOrders);
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
          onScan={(result) => {
            setIsScannerOpen(false);
            const scannedId = result.trim().toUpperCase();
            const foundOrder = orders.find(o => o.id.toUpperCase() === scannedId);
            
            if (foundOrder && foundOrder.customerPhone) {
              // Go directly to the customer's record in OrdersView
              setOrdersSearchTerm(foundOrder.customerPhone);
              setActiveTab('orders');
            } else {
              setScannedOrderId(scannedId);
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
          onConfirm={handleConfirmDelivery}
          onClose={() => setDeliveryOrder(null)}
        />
      )}

      {/* Customer Full Profile, History & Reports Modal */}
      {selectedCustomerProfile && (
        <CustomerProfileModal
          customerName={selectedCustomerProfile.name}
          customerPhone={selectedCustomerProfile.phone}
          orders={orders}
          notificationLogs={notificationLogs}
          templates={templates}
          appUrl={appUrl}
          currentUser={currentUser}
          onSaveOrder={handleSaveOrder}
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
            setOrdersSearchTerm(phone || name);
            setActiveTab('orders');
          }}
        />
      )}

    </div>
  );
}
