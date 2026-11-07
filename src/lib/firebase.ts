import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  type User
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  writeBatch 
} from 'firebase/firestore';

import firebaseConfig from '../../firebase-applet-config.json';

// Use the imported configuration directly
// The database ID is also available in the config
const databaseId = firebaseConfig.firestoreDatabaseId;

let db: any = null;
let isFirebaseAvailable = false;
let app: any = null;
let auth: any = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  
  // Initialize Auth with browserLocalPersistence to avoid missing initial state in WebViews
  try {
    auth = getAuth(app);
    if (typeof window !== 'undefined') {
      setPersistence(auth, browserLocalPersistence).catch((pErr) => {
        console.warn("Could not set browserLocalPersistence:", pErr);
      });
    }
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Firebase Auth active user:", user.uid, user.email);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth-uid-changed', { detail: { uid: user.uid, user } }));
        }
      }
    });
  } catch (authErr) {
    console.warn("Firebase Auth initialization notice:", authErr);
  }

  // Initialize Firestore with persistent cache, fallback safely to default if cache or locks are unavailable
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    }, databaseId);
  } catch (cacheErr) {
    console.warn("Firestore persistent cache fallback to standard getFirestore:", cacheErr);
    db = getFirestore(app, databaseId);
  }
  isFirebaseAvailable = !!db;
  console.log("Firebase App and Firestore initialized successfully.");
} catch (error) {
  console.warn("Firebase app initialization notice:", error);
}

export { db, isFirebaseAvailable, auth };

// Authentication helper functions
export async function loginWithEmail(email: string, pass: string): Promise<User | any> {
  const cleanEmail = email.trim().toLowerCase();
  if (auth) {
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      return cred.user;
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        console.warn("Firebase Email provider not enabled on console yet, falling back to isolated user session.");
        // Check local registered accounts for this email/password
        const accountsJson = localStorage.getItem('app_registered_accounts');
        const accounts = accountsJson ? JSON.parse(accountsJson) : [];
        const matched = accounts.find((a: any) => a.email.toLowerCase() === cleanEmail && a.password === pass);
        if (matched) {
          return {
            uid: matched.uid,
            email: matched.email,
            displayName: matched.displayName
          };
        }
      }
      throw err;
    }
  }
  throw new Error("نظام المصادقة غير متاح حالياً");
}

export async function registerWithEmail(email: string, pass: string, displayName?: string): Promise<User | any> {
  const cleanEmail = email.trim().toLowerCase();
  
  if (auth) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      const user = cred.user;

      // Immediately initialize the isolated user record and default collections in Firestore
      if (isFirebaseAvailable && db && user?.uid) {
        try {
          const userProfileRef = doc(db, 'users', user.uid);
          await setDoc(userProfileRef, {
            userId: user.uid,
            email: cleanEmail,
            displayName: displayName || cleanEmail.split('@')[0] || 'فني صيانة معتمد',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            role: 'admin',
            isolatedDataReady: true
          }, { merge: true });

          const settingsRef = doc(db, 'users', user.uid, 'app_settings', 'global_config');
          await setDoc(settingsRef, {
            id: 'global_config',
            userId: user.uid,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            settings: {
              centerName: 'TECHNO',
              currencyName: 'ريال',
              barcodePrefix: 'TEC'
            }
          }, { merge: true });

          console.log("Successfully created isolated Firestore record for user:", user.uid);
        } catch (createErr) {
          console.warn("Notice during initial user profile document creation:", createErr);
        }
      }

      return user;
    } catch (err: any) {
      // If Firebase Console has not enabled the Email/Password switch yet, provide graceful local-cloud bridge
      if (err.code === 'auth/operation-not-allowed') {
        console.warn("Firebase Email provider is disabled in console. Generating deterministic isolated UID for user.");
        // Generate a deterministic UID based on email hash so data remains permanently isolated to this user
        let hash = 0;
        for (let i = 0; i < cleanEmail.length; i++) {
          hash = (hash << 5) - hash + cleanEmail.charCodeAt(i);
          hash |= 0;
        }
        const generatedUid = 'usr_' + Math.abs(hash).toString(36) + '_' + cleanEmail.replace(/[^a-z0-9]/g, '').slice(0, 8);
        
        // Save account locally to allow future logins with this password
        const accountsJson = localStorage.getItem('app_registered_accounts');
        const accounts = accountsJson ? JSON.parse(accountsJson) : [];
        const existingIdx = accounts.findIndex((a: any) => a.email.toLowerCase() === cleanEmail);
        const accountData = {
          uid: generatedUid,
          email: cleanEmail,
          password: pass,
          displayName: displayName || cleanEmail.split('@')[0] || 'فني صيانة معتمد',
          createdAt: Date.now()
        };
        if (existingIdx > -1) {
          accounts[existingIdx] = accountData;
        } else {
          accounts.push(accountData);
        }
        localStorage.setItem('app_registered_accounts', JSON.stringify(accounts));

        // Create initial settings backup for this isolated UID
        localStorage.setItem(`techno_device_uid`, generatedUid);

        return {
          uid: generatedUid,
          email: cleanEmail,
          displayName: accountData.displayName
        };
      }
      throw err;
    }
  }

  throw new Error("نظام المصادقة غير متاح حالياً");
}

export async function loginWithGoogle(): Promise<User> {
  if (!auth) throw new Error("نظام المصادقة غير متاح حالياً");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (err: any) {
    console.error("Google sign-in error in firebase.ts:", err);
    // Specific check for Android WebView / iframe storage blocking
    const msg = String(err?.message || '');
    const code = String(err?.code || '');
    if (
      code === 'auth/missing-initial-state' ||
      code === 'auth/popup-blocked' ||
      code === 'auth/popup-closed-by-user' ||
      msg.includes('missing initial state') ||
      msg.includes('sessionStorage')
    ) {
      throw new Error("متصفح تطبيق الهاتف يمنع النوافذ المنبثقة لـ Google. يرجى استخدام 'تسجيل الدخول بالبريد الإلكتروني' أدناه فهو يعمل مباشرة وبدون قيود، أو تفعيل حسابك من متصفح Chrome.");
    }
    throw err;
  }
}

export async function logoutUser(): Promise<void> {
  if (auth) {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn("Sign out notice:", e);
    }
  }
  sessionStorage.removeItem('isAppAuthenticated');
  sessionStorage.removeItem('appCurrentUser');
}

export async function resetPasswordEmail(email: string): Promise<void> {
  if (!auth) throw new Error("نظام المصادقة غير متاح حالياً");
  await sendPasswordResetEmail(auth, email.trim());
}

// Helper to determine the active user/device UID for strict data isolation
export function getCurrentUserId(): string {
  // 1. الأولوية القصوى لمعرف المستخدم الحالي من Firebase Auth حصرياً
  if (auth && auth.currentUser && auth.currentUser.uid) {
    return auth.currentUser.uid;
  }
  // 2. فحص ما إذا كان معرّف UID ممرراً من تطبيق Android عبر رابط الـ WebView (?uid=...)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const urlUid = urlParams.get('uid');
    if (urlUid) return urlUid;
  }
  // 3. فحص الجلسة المحلية النشطة
  const sessionUser = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('appCurrentUser') : null;
  if (sessionUser) {
    try {
      const parsed = JSON.parse(sessionUser);
      if (parsed.id) return parsed.id;
    } catch (_) {}
  }
  // 4. معرّف الجهاز المحلي
  let localDeviceId = typeof localStorage !== 'undefined' ? localStorage.getItem('techno_device_uid') : null;
  if (!localDeviceId) {
    localDeviceId = 'user_' + Math.random().toString(36).substring(2, 12);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('techno_device_uid', localDeviceId);
    }
  }
  return localDeviceId;
}

// User-isolated Firestore path helpers (Always scoped to the current user's UID)
export function getUserOrderDoc(orderId: string) {
  return doc(db, 'users', getCurrentUserId(), 'orders', orderId);
}

export function getUserOrdersCollection() {
  return collection(db, 'users', getCurrentUserId(), 'orders');
}

export function getUserLogDoc(logId: string) {
  return doc(db, 'users', getCurrentUserId(), 'notification_logs', logId);
}

export function getUserLogsCollection() {
  return collection(db, 'users', getCurrentUserId(), 'notification_logs');
}

export function getUserSettingsDoc(settingId = 'global_config') {
  return doc(db, 'users', getCurrentUserId(), 'app_settings', settingId);
}

export function getUserProfileDoc(profileId = 'info') {
  return doc(db, 'users', getCurrentUserId(), 'profile', profileId);
}

// LocalStorage Fallback helper class in case Firebase is slow or fails
export class LocalStorageDB {
  static getCollection(collectionName: string): any[] {
    const uid = getCurrentUserId();
    const data = localStorage.getItem(`db_${uid}_${collectionName}`) || localStorage.getItem(`db_${collectionName}`);
    return data ? JSON.parse(data) : [];
  }

  static setCollection(collectionName: string, data: any[]) {
    const uid = getCurrentUserId();
    localStorage.setItem(`db_${uid}_${collectionName}`, JSON.stringify(data));
    localStorage.setItem(`db_${collectionName}`, JSON.stringify(data));
  }

  static getDoc(collectionName: string, docId: string): any | null {
    const list = this.getCollection(collectionName);
    return list.find(item => item.id === docId) || null;
  }

  static setDoc(collectionName: string, docId: string, data: any) {
    const list = this.getCollection(collectionName);
    const index = list.findIndex(item => item.id === docId);
    const updatedData = { ...data, id: docId };
    
    if (index > -1) {
      list[index] = updatedData;
    } else {
      list.push(updatedData);
    }
    this.setCollection(collectionName, list);
  }

  static deleteDoc(collectionName: string, docId: string) {
    const list = this.getCollection(collectionName);
    const filtered = list.filter(item => item.id !== docId);
    this.setCollection(collectionName, filtered);
  }
}

// unified data access layer to seamlessly switch between Firestore and LocalStorage
export const dbService = {
  async getOrders(): Promise<any[]> {
    return LocalStorageDB.getCollection('orders');
  },

  async saveOrder(order: any): Promise<void> {
    const cleanOrder = JSON.parse(JSON.stringify(order)); // strip any undefined fields
    // Always write to LocalStorage first for instant UI response and local consistency
    LocalStorageDB.setDoc('orders', order.id, cleanOrder);
    
    if (isFirebaseAvailable && db) {
      try {
        // Try saving to Firestore with a 1.5-second timeout so it never blocks the user
        await Promise.race([
          setDoc(getUserOrderDoc(order.id), cleanOrder),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);
      } catch (err) {
        console.warn("Firestore save timed out or failed, local copy remains safe:", err);
      }
    }
  },

  async deleteOrder(orderId: string): Promise<void> {
    // Immediate local update
    LocalStorageDB.deleteDoc('orders', orderId);
    
    if (isFirebaseAvailable && db) {
      try {
        // Non-blocking async Firestore delete with timeout
        await Promise.race([
          deleteDoc(getUserOrderDoc(orderId)),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);
      } catch (err) {
        console.warn("Firestore delete timed out or failed, local copy remains updated:", err);
      }
    }
  },

  async clearAllOrders(orders: any[]): Promise<void> {
    // Immediate local update
    const currentOrders = LocalStorageDB.getCollection('orders');
    const idsToDelete = new Set(orders.map(o => o.id));
    LocalStorageDB.setCollection('orders', currentOrders.filter((o: any) => !idsToDelete.has(o.id)));
    
    if (isFirebaseAvailable && db) {
      try {
        for (let i = 0; i < orders.length; i += 500) {
          const chunk = orders.slice(i, i + 500);
          const batch = writeBatch(db);
          chunk.forEach(order => {
            batch.delete(getUserOrderDoc(order.id));
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn("Firestore clear orders failed:", err);
      }
    }
  },

  async clearAllLogs(logs: any[]): Promise<void> {
    // Immediate local update
    const currentLogs = LocalStorageDB.getCollection('notification_logs');
    const idsToDelete = new Set(logs.map(l => l.id));
    LocalStorageDB.setCollection('notification_logs', currentLogs.filter((l: any) => !idsToDelete.has(l.id)));
    
    if (isFirebaseAvailable && db) {
      try {
        for (let i = 0; i < logs.length; i += 500) {
          const chunk = logs.slice(i, i + 500);
          const batch = writeBatch(db);
          chunk.forEach(log => {
            batch.delete(getUserLogDoc(log.id));
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn("Firestore clear logs failed:", err);
      }
    }
  },

  async getOrderById(orderId: string): Promise<any | null> {
    if (isFirebaseAvailable && db) {
      try {
        const docRef = getUserOrderDoc(orderId);
        const docSnap = await Promise.race([
          getDoc(docRef),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);
        if (docSnap.exists()) {
          const order = { id: docSnap.id, ...docSnap.data() };
          // Sync to local storage
          LocalStorageDB.setDoc('orders', orderId, order);
          return order;
        }
        return null;
      } catch (err) {
        console.warn("Firestore single order read failed or timed out, falling back to LocalStorage:", err);
        return LocalStorageDB.getDoc('orders', orderId);
      }
    } else {
      return LocalStorageDB.getDoc('orders', orderId);
    }
  },

  // Notification logs
  async getNotificationLogs(): Promise<any[]> {
    return LocalStorageDB.getCollection('notification_logs');
  },

  async saveNotificationLog(log: any): Promise<void> {
    const cleanLog = JSON.parse(JSON.stringify(log));
    LocalStorageDB.setDoc('notification_logs', log.id, cleanLog);
    
    if (isFirebaseAvailable && db) {
      try {
        await Promise.race([
          setDoc(getUserLogDoc(log.id), cleanLog),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);
      } catch (err) {
        console.warn("Firestore notification log save timed out or failed, local log remains updated:", err);
      }
    }
  },

  async deleteNotificationLog(logId: string): Promise<void> {
    LocalStorageDB.deleteDoc('notification_logs', logId);
    
    if (isFirebaseAvailable && db) {
      try {
        await Promise.race([
          deleteDoc(getUserLogDoc(logId)),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);
      } catch (err) {
        console.warn("Firestore notification log delete timed out or failed:", err);
      }
    }
  },

  async syncData(): Promise<{ orders: any[], logs: any[] }> {
    const localOrders = LocalStorageDB.getCollection('orders');
    const localLogs = LocalStorageDB.getCollection('notification_logs');

    if (!isFirebaseAvailable || !db) {
      return {
        orders: localOrders,
        logs: localLogs
      };
    }

    try {
      // 1. Sync orders with a safe non-throwing timeout helper from user-isolated subcollection
      const querySnapshotOrders = await Promise.race([
        getDocs(getUserOrdersCollection()),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000))
      ]);

      if (!querySnapshotOrders) {
        console.warn("Firestore orders query timed out after 6s. Operating seamlessly on local storage.");
        return {
          orders: localOrders,
          logs: localLogs
        };
      }

      const remoteOrders: any[] = [];
      querySnapshotOrders.forEach((docSnap) => {
        remoteOrders.push({ id: docSnap.id, ...docSnap.data() });
      });

      const mergedOrdersMap = new Map<string, any>();
      remoteOrders.forEach(o => mergedOrdersMap.set(o.id, o));

      // Collect local updates to upload
      const ordersToUpload: any[] = [];
      for (const localOrder of localOrders) {
        if (!localOrder || !localOrder.id) continue;
        const remoteOrder = mergedOrdersMap.get(localOrder.id);
        if (!remoteOrder) {
          ordersToUpload.push(localOrder);
          mergedOrdersMap.set(localOrder.id, localOrder);
        } else {
          const localUpdated = localOrder.updatedAt || localOrder.createdAt || 0;
          const remoteUpdated = remoteOrder.updatedAt || remoteOrder.createdAt || 0;
          if (localUpdated > remoteUpdated) {
            ordersToUpload.push(localOrder);
            mergedOrdersMap.set(localOrder.id, localOrder);
          }
        }
      }

      // Batch upload local updates in efficient chunks to user-isolated collection
      if (ordersToUpload.length > 0) {
        try {
          for (let i = 0; i < ordersToUpload.length; i += 400) {
            const chunk = ordersToUpload.slice(i, i + 400);
            const batch = writeBatch(db);
            chunk.forEach(order => {
              batch.set(getUserOrderDoc(order.id), order);
            });
            await batch.commit();
          }
        } catch (e) {
          console.warn("Notice: Batch order upload during sync deferred:", e);
        }
      }

      const finalOrders = Array.from(mergedOrdersMap.values());
      finalOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      LocalStorageDB.setCollection('orders', finalOrders);

      // 2. Sync notification logs with safe non-throwing timeout from user-isolated subcollection
      const querySnapshotLogs = await Promise.race([
        getDocs(getUserLogsCollection()),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000))
      ]);

      if (!querySnapshotLogs) {
        console.warn("Firestore logs query timed out. Retaining local logs.");
        return { orders: finalOrders, logs: localLogs };
      }

      const remoteLogs: any[] = [];
      querySnapshotLogs.forEach((docSnap) => {
        remoteLogs.push({ id: docSnap.id, ...docSnap.data() });
      });

      const mergedLogsMap = new Map<string, any>();
      remoteLogs.forEach(l => mergedLogsMap.set(l.id, l));

      const logsToUpload: any[] = [];
      for (const localLog of localLogs) {
        if (!localLog || !localLog.id) continue;
        const remoteLog = mergedLogsMap.get(localLog.id);
        if (!remoteLog) {
          logsToUpload.push(localLog);
          mergedLogsMap.set(localLog.id, localLog);
        }
      }

      if (logsToUpload.length > 0) {
        try {
          for (let i = 0; i < logsToUpload.length; i += 400) {
            const chunk = logsToUpload.slice(i, i + 400);
            const batch = writeBatch(db);
            chunk.forEach(log => {
              batch.set(getUserLogDoc(log.id), log);
            });
            await batch.commit();
          }
        } catch (e) {
          console.warn("Notice: Batch log upload during sync deferred:", e);
        }
      }

      const finalLogs = Array.from(mergedLogsMap.values());
      finalLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      LocalStorageDB.setCollection('notification_logs', finalLogs);

      return { orders: finalOrders, logs: finalLogs };
    } catch (err) {
      console.warn("Notice: Bidirectional sync fallback active:", err);
      return {
        orders: LocalStorageDB.getCollection('orders'),
        logs: LocalStorageDB.getCollection('notification_logs')
      };
    }
  },

  async saveAppSettingsBackup(): Promise<void> {
    const SETTINGS_KEYS = [
      'centerName', 'engineerName', 'centerMobile', 'centerEmail', 'currencyName',
      'countryName', 'countryDialCode', 'centerLogo', 'barcodePrefix', 'barcodeStartNum',
      'barcodeDigits', 'barcodeSuffix', 'appLoginUsername', 'appLoginPassword', 'isAppLoginEnabled',
      'rcptCenterNameText', 'rcptTermsText', 'rcptZoom', 'rcptBarcodeHeight', 'rcptBarcodeWidth',
      'rcptShowQR', 'rcptSize', 'lblAlign', 'lblVerticalAlign', 'lblShowCenterName',
      'lblShowBarcode', 'lblShowCustomerName', 'lblShowDeviceModel', 'lblShowDate',
      'lblShowMobile', 'lblFontSizeCenterName', 'lblFontSizeMobile', 'lblFontSizeBarcodeText',
      'lblBarcodeHeight', 'lblBarcodeWidth', 'lblFontSizeCustomerName', 'lblFontSizeDeviceModel', 'lblFontSizeDate',
      'lblPaperSize', 'lblLineSpacing'
    ];

    try {
      const settingsObj: Record<string, string> = {};
      SETTINGS_KEYS.forEach(key => {
        const val = localStorage.getItem(key);
        if (val !== null) {
          settingsObj[key] = val;
        }
      });

      const templates = JSON.parse(localStorage.getItem('db_templates') || '[]');
      const users = JSON.parse(localStorage.getItem('appUsersList') || '[]');
      const printers = JSON.parse(localStorage.getItem('maintenance_printers') || '[]');

      const backupPayload = {
        id: 'global_config',
        settings: settingsObj,
        templates,
        users,
        printers,
        updatedAt: Date.now()
      };

      // Save backup payload in localStorage to fulfill local save mandate
      localStorage.setItem('db_app_settings_backup', JSON.stringify(backupPayload));
      console.log("Local backup saved successfully.");

      // Cloud save to user-isolated Firestore document
      if (isFirebaseAvailable && db) {
        await Promise.race([
          setDoc(getUserSettingsDoc('global_config'), backupPayload),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
        ]);
        console.log("Cloud backup saved successfully to Firestore under user subcollection.");
      }
    } catch (err) {
      console.warn("Failed to save app settings backup:", err);
    }
  },

  async syncAppSettingsBackup(): Promise<void> {
    if (!isFirebaseAvailable || !db) {
      console.log("Firebase is not available, skipping cloud settings sync.");
      return;
    }

    const SETTINGS_KEYS = [
      'centerName', 'engineerName', 'centerMobile', 'centerEmail', 'currencyName',
      'countryName', 'countryDialCode', 'centerLogo', 'barcodePrefix', 'barcodeStartNum',
      'barcodeDigits', 'barcodeSuffix', 'appLoginUsername', 'appLoginPassword', 'isAppLoginEnabled',
      'rcptCenterNameText', 'rcptTermsText', 'rcptZoom', 'rcptBarcodeHeight', 'rcptBarcodeWidth',
      'rcptShowQR', 'rcptSize', 'lblAlign', 'lblVerticalAlign', 'lblShowCenterName',
      'lblShowBarcode', 'lblShowCustomerName', 'lblShowDeviceModel', 'lblShowDate',
      'lblShowMobile', 'lblFontSizeCenterName', 'lblFontSizeMobile', 'lblFontSizeBarcodeText',
      'lblBarcodeHeight', 'lblBarcodeWidth', 'lblFontSizeCustomerName', 'lblFontSizeDeviceModel', 'lblFontSizeDate',
      'lblPaperSize', 'lblLineSpacing'
    ];

    try {
      const docRef = getUserSettingsDoc('global_config');
      const docSnap = await Promise.race([
        getDoc(docRef),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);

      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        const localBackupStr = localStorage.getItem('db_app_settings_backup');
        const localBackup = localBackupStr ? JSON.parse(localBackupStr) : null;

        const remoteUpdatedAt = remoteData.updatedAt || 0;
        const localUpdatedAt = localBackup?.updatedAt || 0;

        // Bidirectional sync: if remote is newer, restore it locally. Otherwise, upload newer local changes to cloud.
        if (remoteUpdatedAt > localUpdatedAt) {
          console.log("Restoring settings from newer cloud backup...");
          
          if (remoteData.settings) {
            Object.entries(remoteData.settings).forEach(([key, val]) => {
              localStorage.setItem(key, val as string);
            });
          }

          if (remoteData.templates) {
            localStorage.setItem('db_templates', JSON.stringify(remoteData.templates));
          }
          if (remoteData.users) {
            localStorage.setItem('appUsersList', JSON.stringify(remoteData.users));
          }
          if (remoteData.printers) {
            localStorage.setItem('maintenance_printers', JSON.stringify(remoteData.printers));
          }

          localStorage.setItem('db_app_settings_backup', JSON.stringify(remoteData));
          
          // Dispatch storage event so all components and views update automatically
          window.dispatchEvent(new Event('storage'));
        } else if (localUpdatedAt > remoteUpdatedAt || !localBackup) {
          console.log("Local settings are newer, uploading to cloud backup...");
          await this.saveAppSettingsBackup();
        }
      } else {
        console.log("No cloud backup found, creating initial cloud backup...");
        await this.saveAppSettingsBackup();
      }
    } catch (err) {
      console.warn("Failed to sync app settings with cloud:", err);
    }
  }
};
