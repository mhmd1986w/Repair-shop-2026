import { initializeApp, getApps, getApp } from 'firebase/app';
import { BUILT_IN_APP_DOMAIN } from '../utils/appDomain';
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
  deleteUser,
  type User
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  memoryLocalCache,
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer,
  getDocs, 
  deleteDoc, 
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

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function canUseFirestore(): boolean {
  return Boolean(isFirebaseAvailable && db && auth && auth.currentUser && auth.currentUser.uid);
}

let lastDispatchedUid: string | null = null;
let suppressAuthChangeDispatch = false;

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
        if (!suppressAuthChangeDispatch && user.uid !== lastDispatchedUid) {
          lastDispatchedUid = user.uid;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth-uid-changed', { detail: { uid: user.uid, user } }));
          }
        }
      } else {
        lastDispatchedUid = null;
      }
    });
  } catch (authErr) {
    console.warn("Firebase Auth initialization notice:", authErr);
  }

  // Initialize Firestore with memoryLocalCache (avoids IndexedDB multi-tab primary lease lock errors in iframe/PWA environments;
  // offline persistence is handled reliably by LocalStorageDB).
  try {
    db = initializeFirestore(app, {
      localCache: memoryLocalCache()
    }, databaseId);
  } catch (cacheErr) {
    console.warn("Firestore memoryLocalCache fallback to standard getFirestore:", cacheErr);
    db = getFirestore(app, databaseId);
  }
  isFirebaseAvailable = !!db;
  console.log("Firebase App and Firestore initialized successfully.");

  if (db) {
    (async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    })();
  }
} catch (error) {
  console.warn("Firebase app initialization notice:", error);
}

export { db, isFirebaseAvailable, auth };

export interface RegisterCenterProfile {
  centerName: string;
  centerLogo?: string;
  technicianName: string; // اسم المستخدم / المهندس المسؤول
  centerPhone: string;
  email: string;
  currency?: string;
  countryName?: string;
  countryCode?: string;
}

// Authentication helper functions
export async function loginWithEmail(email: string, pass: string): Promise<User | any> {
  const cleanEmail = email.trim().toLowerCase();
  localStorage.setItem('lastLoginEmail', cleanEmail);

  if (auth) {
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      const user = cred.user;

      // Sync user profile & center settings from Firestore to localStorage
      if (isFirebaseAvailable && db && user?.uid) {
        try {
          const settingsRef = doc(db, 'users', user.uid, 'app_settings', 'global_config');
          const snap = await getDoc(settingsRef);
          if (snap.exists()) {
            const data = snap.data();
            const s = data.settings || {};
            if (s.centerName) {
              localStorage.setItem('centerName', s.centerName);
              localStorage.setItem('lastRegisteredCenterName', s.centerName);
            }
            if (s.centerLogo) {
              localStorage.setItem('centerLogo', s.centerLogo);
              localStorage.setItem('lastRegisteredCenterLogo', s.centerLogo);
            }
            if (s.engineerName) localStorage.setItem('engineerName', s.engineerName);
            if (s.centerMobile) localStorage.setItem('centerMobile', s.centerMobile);
            if (s.currencyName) localStorage.setItem('currencyName', s.currencyName);
            if (s.countryName) localStorage.setItem('countryName', s.countryName);
            if (s.countryDialCode) localStorage.setItem('countryDialCode', s.countryDialCode);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('storage'));
            }
          }
        } catch (syncErr) {
          console.warn("Could not sync user settings on login:", syncErr);
        }
      }

      return user;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/operation-not-allowed' || code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
        try {
          const accounts = safeJsonParse<any[]>(localStorage.getItem('app_registered_accounts'), []);
          const matched = accounts.find((a: any) => a.email?.toLowerCase() === cleanEmail && a.password === pass);
          if (matched) {
            if (matched.centerName) {
              localStorage.setItem('centerName', matched.centerName);
              localStorage.setItem('lastRegisteredCenterName', matched.centerName);
            }
            if (matched.centerLogo) {
              localStorage.setItem('centerLogo', matched.centerLogo);
              localStorage.setItem('lastRegisteredCenterLogo', matched.centerLogo);
            }
            if (matched.technicianName || matched.displayName) {
              localStorage.setItem('engineerName', matched.technicianName || matched.displayName);
            }
            if (matched.centerPhone) localStorage.setItem('centerMobile', matched.centerPhone);
            return {
              uid: matched.uid,
              email: matched.email,
              displayName: matched.technicianName || matched.displayName || 'فني صيانة معتمد'
            };
          }
        } catch (localErr) {
          console.warn("Local account fallback lookup failed:", localErr);
        }
      }
      throw err;
    }
  }
  throw new Error("نظام المصادقة غير متاح حالياً");
}

export async function registerWithEmail(
  email: string, 
  pass: string, 
  profileData?: RegisterCenterProfile | string
): Promise<User | any> {
  const cleanEmail = email.trim().toLowerCase();
  
  // Normalize profile fields
  const isProfileObj = typeof profileData === 'object' && profileData !== null;
  const centerName = (isProfileObj ? profileData.centerName : '')?.trim() || 'مركز الصيانة';
  const centerLogo = (isProfileObj ? profileData.centerLogo : '') || '';
  const technicianName = (isProfileObj ? profileData.technicianName : (typeof profileData === 'string' ? profileData : ''))?.trim() || 'فني صيانة';
  const centerPhone = (isProfileObj ? profileData.centerPhone : '')?.trim() || '';
  const currencyName = (isProfileObj ? profileData.currency : '')?.trim() || 'دينار';
  const countryName = (isProfileObj ? profileData.countryName : '')?.trim() || '';
  const countryCode = (isProfileObj ? profileData.countryCode : '')?.trim() || '';

  // Save immediate local center branding
  localStorage.setItem('centerName', centerName);
  localStorage.setItem('engineerName', technicianName);
  localStorage.setItem('centerMobile', centerPhone);
  localStorage.setItem('centerEmail', cleanEmail);
  if (centerLogo) {
    localStorage.setItem('centerLogo', centerLogo);
    localStorage.setItem('lastRegisteredCenterLogo', centerLogo);
  }
  localStorage.setItem('currencyName', currencyName);
  localStorage.setItem('countryName', countryName);
  localStorage.setItem('countryDialCode', countryCode);
  localStorage.setItem('countryCode', countryCode);
  localStorage.setItem('lastRegisteredCenterName', centerName);
  localStorage.setItem('lastLoginEmail', cleanEmail);

  if (auth) {
    suppressAuthChangeDispatch = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      const user = cred.user;

      // Ensure clean isolated local collections for this brand new user
      localStorage.setItem(`db_${user.uid}_orders`, '[]');
      localStorage.setItem(`db_${user.uid}_notification_logs`, '[]');
      localStorage.setItem(`db_${user.uid}_customers`, '[]');

      // Initialize the isolated user record and default collections in Firestore
      if (isFirebaseAvailable && db && user?.uid) {
        try {
          const userProfileRef = doc(db, 'users', user.uid);
          await setDoc(userProfileRef, {
            userId: user.uid,
            email: cleanEmail,
            displayName: technicianName,
            centerName,
            centerLogo,
            centerMobile: centerPhone,
            currencyName,
            countryName,
            countryCode,
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
              centerName,
              centerLogo,
              engineerName: technicianName,
              centerMobile: centerPhone,
              centerEmail: cleanEmail,
              currencyName,
              countryName,
              countryDialCode: countryCode,
              barcodePrefix: 'TEC',
              websiteDomain: BUILT_IN_APP_DOMAIN
            }
          }, { merge: true });

          console.log("Successfully created isolated Firestore record for user:", user.uid);
        } catch (createErr) {
          console.warn("Notice during initial user profile document creation:", createErr);
        }
      }

      lastDispatchedUid = user.uid;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-uid-changed', { detail: { uid: user.uid, user } }));
      }
      return user;
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        try {
          const loginCred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
          const existingUser = loginCred.user;
          
          // Update profile and settings in Firestore if user provided new center details
          if (isFirebaseAvailable && db && existingUser?.uid) {
            try {
              const userProfileRef = doc(db, 'users', existingUser.uid);
              const updateData: any = {
                updatedAt: Date.now()
              };
              if (centerName && centerName !== 'مركز الصيانة') updateData.centerName = centerName;
              if (centerLogo) updateData.centerLogo = centerLogo;
              if (technicianName && technicianName !== 'فني صيانة') updateData.displayName = technicianName;
              if (centerPhone) updateData.centerMobile = centerPhone;
              if (currencyName) updateData.currencyName = currencyName;
              if (countryName) updateData.countryName = countryName;
              if (countryCode) updateData.countryCode = countryCode;

              await setDoc(userProfileRef, updateData, { merge: true });

              const settingsRef = doc(db, 'users', existingUser.uid, 'app_settings', 'global_config');
              const nestedSettings: Record<string, any> = {};
              if (centerName && centerName !== 'مركز الصيانة') nestedSettings.centerName = centerName;
              if (centerLogo) nestedSettings.centerLogo = centerLogo;
              if (technicianName && technicianName !== 'فني صيانة') nestedSettings.engineerName = technicianName;
              if (centerPhone) nestedSettings.centerMobile = centerPhone;
              if (currencyName) nestedSettings.currencyName = currencyName;
              if (countryName) nestedSettings.countryName = countryName;
              if (countryCode) nestedSettings.countryDialCode = countryCode;

              const settingsData: any = {
                updatedAt: Date.now()
              };
              if (Object.keys(nestedSettings).length > 0) {
                settingsData.settings = nestedSettings;
              }

              await setDoc(settingsRef, settingsData, { merge: true });
            } catch (syncErr) {
              console.warn("Failed to update existing user profile on auto login:", syncErr);
            }
          }
          return existingUser;
        } catch (loginErr: any) {
          const friendlyError = new Error('هذا البريد مسجل مسبقاً في النظام. يمكنك التبديل إلى "تسجيل الدخول بالبريد" أو إدخال كلمة المرور الصحيحة لحسابك.');
          (friendlyError as any).code = 'auth/email-already-in-use';
          throw friendlyError;
        }
      }

      // If Firebase Console has not enabled the Email/Password switch yet, provide graceful local-cloud bridge
      if (err.code === 'auth/operation-not-allowed') {
        console.warn("Firebase Email provider is disabled in console. Generating deterministic isolated UID for user.");
        let hash = 0;
        for (let i = 0; i < cleanEmail.length; i++) {
          hash = (hash << 5) - hash + cleanEmail.charCodeAt(i);
          hash |= 0;
        }
        const generatedUid = 'usr_' + Math.abs(hash).toString(36) + '_' + cleanEmail.replace(/[^a-z0-9]/g, '').slice(0, 8);
        
        // Ensure clean isolated local collections for this fallback UID
        localStorage.setItem(`db_${generatedUid}_orders`, '[]');
        localStorage.setItem(`db_${generatedUid}_notification_logs`, '[]');
        localStorage.setItem(`db_${generatedUid}_customers`, '[]');

        // Save account locally to allow future logins with this password
        const accounts = safeJsonParse<any[]>(localStorage.getItem('app_registered_accounts'), []);
        const existingIdx = accounts.findIndex((a: any) => a.email.toLowerCase() === cleanEmail);
        const accountData = {
          uid: generatedUid,
          email: cleanEmail,
          password: pass,
          displayName: technicianName,
          technicianName,
          centerName,
          centerLogo,
          centerPhone,
          currencyName,
          countryName,
          countryCode,
          createdAt: Date.now()
        };
        if (existingIdx > -1) {
          accounts[existingIdx] = accountData;
        } else {
          accounts.push(accountData);
        }
        localStorage.setItem('app_registered_accounts', JSON.stringify(accounts));
        localStorage.setItem(`techno_device_uid`, generatedUid);

        return {
          uid: generatedUid,
          email: cleanEmail,
          displayName: technicianName
        };
      }
      throw err;
    } finally {
      suppressAuthChangeDispatch = false;
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
    console.warn("Google sign-in notice in firebase.ts:", err?.code || err?.message);
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
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('isAppAuthenticated');
    sessionStorage.removeItem('appCurrentUser');
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('isAppAuthenticated');
    localStorage.removeItem('appCurrentUser');
    localStorage.removeItem('db_app_settings_backup');
  }
}

export async function resetPasswordEmail(email: string): Promise<void> {
  if (!auth) throw new Error("نظام المصادقة غير متاح حالياً");
  await sendPasswordResetEmail(auth, email.trim());
}

async function deleteUserFirestoreData(uid: string): Promise<void> {
  if (!db || !isFirebaseAvailable || !uid) return;
  try {
    const subcollections = ['orders', 'customers', 'notification_logs', 'app_settings', 'profile'];
    for (const sub of subcollections) {
      try {
        const snap = await getDocs(collection(db, 'users', uid, sub));
        if (!snap.empty) {
          const docs = snap.docs;
          for (let i = 0; i < docs.length; i += 400) {
            const batch = writeBatch(db);
            docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        }
      } catch (subErr) {
        console.warn(`Could not delete subcollection ${sub}:`, subErr);
      }
    }
    await deleteDoc(doc(db, 'users', uid));
  } catch (e) {
    console.warn("Could not delete firestore docs before user deletion:", e);
  }
}

export async function deleteUserAccount(email: string, pass: string): Promise<void> {
  if (!auth) throw new Error("نظام المصادقة غير متاح حالياً");
  const cleanEmail = email.trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
  const user = cred.user;
  const uid = user.uid;

  // Clean Firestore documents and subcollections
  await deleteUserFirestoreData(uid);

  // Delete from Firebase Auth
  await deleteUser(user);

  // Clear local storage isolated keys
  localStorage.removeItem(`db_${uid}_orders`);
  localStorage.removeItem(`db_${uid}_customers`);
  localStorage.removeItem(`db_${uid}_notification_logs`);
  if (localStorage.getItem('lastLoginEmail')?.toLowerCase() === cleanEmail) {
    localStorage.removeItem('lastLoginEmail');
    localStorage.removeItem('lastRegisteredCenterLogo');
    localStorage.removeItem('lastRegisteredCenterName');
    localStorage.removeItem('centerEmail');
  }

  // Remove from app_registered_accounts
  try {
    const accounts = safeJsonParse<any[]>(localStorage.getItem('app_registered_accounts'), []);
    if (Array.isArray(accounts) && accounts.length > 0) {
      const filtered = accounts.filter((a: any) => a?.email?.toLowerCase() !== cleanEmail);
      localStorage.setItem('app_registered_accounts', JSON.stringify(filtered));
    }
  } catch (e) {}
}

export async function deleteCurrentLoggedInAccount(): Promise<void> {
  if (!auth || !auth.currentUser) throw new Error("لا يوجد مستخدم مسجل حالياً");
  const user = auth.currentUser;
  const uid = user.uid;
  const email = user.email?.toLowerCase();

  // Clean Firestore documents and subcollections
  await deleteUserFirestoreData(uid);

  await deleteUser(user);

  // Clean local keys
  localStorage.removeItem(`db_${uid}_orders`);
  localStorage.removeItem(`db_${uid}_customers`);
  localStorage.removeItem(`db_${uid}_notification_logs`);
  if (email && localStorage.getItem('lastLoginEmail')?.toLowerCase() === email) {
    localStorage.removeItem('lastLoginEmail');
    localStorage.removeItem('lastRegisteredCenterLogo');
    localStorage.removeItem('lastRegisteredCenterName');
    localStorage.removeItem('centerEmail');
  }
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
  // 3. فحص الجلسة المحلية النشطة (sessionStorage ثم localStorage لتطابق App.tsx)
  const storedUser =
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('appCurrentUser')) ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('appCurrentUser')) ||
    null;
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed && parsed.id) return String(parsed.id);
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

function sanitizeFirestoreDocId(rawId: string): string {
  const cleaned = String(rawId || '').trim().replace(/\//g, '_');
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return `doc_${Date.now()}`;
  }
  return cleaned.slice(0, 200);
}

// User-isolated Firestore path helpers (Always scoped to the current user's UID)
export function getUserOrderDoc(orderId: string) {
  return doc(db, 'users', getCurrentUserId(), 'orders', sanitizeFirestoreDocId(orderId));
}

export function getUserOrdersCollection() {
  return collection(db, 'users', getCurrentUserId(), 'orders');
}

export function getUserCustomerDoc(customerId: string) {
  return doc(db, 'users', getCurrentUserId(), 'customers', sanitizeFirestoreDocId(customerId));
}

export function getUserCustomersCollection() {
  return collection(db, 'users', getCurrentUserId(), 'customers');
}

export function getUserLogDoc(logId: string) {
  return doc(db, 'users', getCurrentUserId(), 'notification_logs', sanitizeFirestoreDocId(logId));
}

export function getUserLogsCollection() {
  return collection(db, 'users', getCurrentUserId(), 'notification_logs');
}

export function getUserSettingsDoc(settingId = 'global_config') {
  return doc(db, 'users', getCurrentUserId(), 'app_settings', sanitizeFirestoreDocId(settingId));
}

export function getUserProfileDoc(profileId = 'info') {
  return doc(db, 'users', getCurrentUserId(), 'profile', sanitizeFirestoreDocId(profileId));
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || raw === 'undefined' || raw === 'null') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// LocalStorage Fallback helper class in case Firebase is slow or fails (Strict User Isolation)
export class LocalStorageDB {
  static getCollection(collectionName: string): any[] {
    const uid = getCurrentUserId();
    const userKey = `db_${uid}_${collectionName}`;
    const userSpecificData = localStorage.getItem(userKey);
    if (userSpecificData !== null) {
      const parsed = safeJsonParse<any>(userSpecificData, []);
      return Array.isArray(parsed) ? parsed : [];
    }
    // Only if user is NOT authenticated (pure guest before signing in) do we check legacy db_
    const isAuth = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('isAppAuthenticated') === 'true') ||
                   (typeof localStorage !== 'undefined' && localStorage.getItem('isAppAuthenticated') === 'true');
    if (!isAuth) {
      const fallback = localStorage.getItem(`db_${collectionName}`);
      const parsedFallback = safeJsonParse<any>(fallback, []);
      return Array.isArray(parsedFallback) ? parsedFallback : [];
    }
    // Authenticated user always begins with their own isolated data array
    return [];
  }

  static setCollection(collectionName: string, data: any[]) {
    const uid = getCurrentUserId();
    localStorage.setItem(`db_${uid}_${collectionName}`, JSON.stringify(data));
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

  async getCustomers(): Promise<any[]> {
    return LocalStorageDB.getCollection('customers');
  },

  async saveCustomer(customer: any): Promise<void> {
    const cleanCustomer = JSON.parse(JSON.stringify(customer));
    LocalStorageDB.setDoc('customers', customer.id, cleanCustomer);

    if (canUseFirestore()) {
      try {
        await Promise.race([
          setDoc(getUserCustomerDoc(customer.id), cleanCustomer),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          try { handleFirestoreError(err, OperationType.WRITE, `users/${getCurrentUserId()}/customers/${customer.id}`); } catch (_) {}
        } else {
          console.warn("Firestore customer save timed out or failed, local copy remains safe:", err);
        }
      }
    }
  },

  async saveCustomersBatch(customers: any[]): Promise<void> {
    if (!customers || customers.length === 0) return;
    customers.forEach((cust) => {
      if (!cust?.id) return;
      const cleanCust = JSON.parse(JSON.stringify(cust));
      LocalStorageDB.setDoc('customers', cust.id, cleanCust);
    });

    if (canUseFirestore()) {
      try {
        for (let i = 0; i < customers.length; i += 400) {
          const chunk = customers.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((cust) => {
            if (!cust?.id) return;
            batch.set(getUserCustomerDoc(cust.id), JSON.parse(JSON.stringify(cust)));
          });
          await batch.commit();
        }
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          try { handleFirestoreError(err, OperationType.WRITE, `users/${getCurrentUserId()}/customers`); } catch (_) {}
        } else {
          console.warn("Firestore batch customers save deferred:", err);
        }
      }
    }
  },

  async deleteCustomer(customerId: string): Promise<void> {
    LocalStorageDB.deleteDoc('customers', customerId);
    if (canUseFirestore()) {
      try {
        await Promise.race([
          deleteDoc(getUserCustomerDoc(customerId)),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          try { handleFirestoreError(err, OperationType.DELETE, `users/${getCurrentUserId()}/customers/${customerId}`); } catch (_) {}
        } else {
          console.warn("Firestore customer delete timed out or failed:", err);
        }
      }
    }
  },

  async clearAllCustomers(customers: any[]): Promise<void> {
    const currentCustomers = LocalStorageDB.getCollection('customers');
    const idsToDelete = new Set(customers.map((c) => c.id));
    LocalStorageDB.setCollection('customers', currentCustomers.filter((c: any) => !idsToDelete.has(c.id)));

    if (canUseFirestore()) {
      try {
        for (let i = 0; i < customers.length; i += 400) {
          const chunk = customers.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((c) => batch.delete(getUserCustomerDoc(c.id)));
          await batch.commit();
        }
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          try { handleFirestoreError(err, OperationType.DELETE, `users/${getCurrentUserId()}/customers`); } catch (_) {}
        } else {
          console.warn("Firestore clear customers failed:", err);
        }
      }
    }
  },

  async saveOrder(order: any): Promise<void> {
    const cleanOrder = JSON.parse(JSON.stringify(order)); // strip any undefined fields
    // Always write to LocalStorage first for instant UI response and local consistency
    LocalStorageDB.setDoc('orders', order.id, cleanOrder);
    
    if (canUseFirestore()) {
      try {
        // Try saving to Firestore with a 1.5-second timeout so it never blocks the user
        await Promise.race([
          setDoc(getUserOrderDoc(order.id), cleanOrder),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          try { handleFirestoreError(err, OperationType.WRITE, `users/${getCurrentUserId()}/orders/${order.id}`); } catch (_) {}
        } else {
          console.warn("Firestore save timed out or failed, local copy remains safe:", err);
        }
      }
    }
  },

  async saveOrdersBatch(orders: any[]): Promise<void> {
    if (!orders || orders.length === 0) return;
    orders.forEach((order) => {
      if (!order?.id) return;
      LocalStorageDB.setDoc('orders', order.id, JSON.parse(JSON.stringify(order)));
    });

    if (canUseFirestore()) {
      try {
        for (let i = 0; i < orders.length; i += 400) {
          const chunk = orders.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((order) => {
            if (!order?.id) return;
            batch.set(getUserOrderDoc(order.id), JSON.parse(JSON.stringify(order)));
          });
          await batch.commit();
        }
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          try { handleFirestoreError(err, OperationType.WRITE, `users/${getCurrentUserId()}/orders`); } catch (_) {}
        } else {
          console.warn("Firestore batch orders save deferred:", err);
        }
      }
    }
  },

  async deleteOrder(orderId: string): Promise<void> {
    // Immediate local update
    LocalStorageDB.deleteDoc('orders', orderId);
    
    if (canUseFirestore()) {
      try {
        // Non-blocking async Firestore delete with timeout
        await Promise.race([
          deleteDoc(getUserOrderDoc(orderId)),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          try { handleFirestoreError(err, OperationType.DELETE, `users/${getCurrentUserId()}/orders/${orderId}`); } catch (_) {}
        } else {
          console.warn("Firestore delete timed out or failed, local copy remains updated:", err);
        }
      }
    }
  },

  async clearAllOrders(orders: any[]): Promise<void> {
    // Immediate local update
    const currentOrders = LocalStorageDB.getCollection('orders');
    const idsToDelete = new Set(orders.map(o => o.id));
    LocalStorageDB.setCollection('orders', currentOrders.filter((o: any) => !idsToDelete.has(o.id)));
    
    if (canUseFirestore()) {
      try {
        for (let i = 0; i < orders.length; i += 500) {
          const chunk = orders.slice(i, i + 500);
          const batch = writeBatch(db);
          chunk.forEach(order => {
            batch.delete(getUserOrderDoc(order.id));
          });
          await batch.commit();
        }
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          try { handleFirestoreError(err, OperationType.DELETE, `users/${getCurrentUserId()}/orders`); } catch (_) {}
        } else {
          console.warn("Firestore clear orders failed:", err);
        }
      }
    }
  },

  async clearAllLogs(logs: any[]): Promise<void> {
    // Immediate local update
    const currentLogs = LocalStorageDB.getCollection('notification_logs');
    const idsToDelete = new Set(logs.map(l => l.id));
    LocalStorageDB.setCollection('notification_logs', currentLogs.filter((l: any) => !idsToDelete.has(l.id)));
    
    if (canUseFirestore()) {
      try {
        for (let i = 0; i < logs.length; i += 500) {
          const chunk = logs.slice(i, i + 500);
          const batch = writeBatch(db);
          chunk.forEach(log => {
            batch.delete(getUserLogDoc(log.id));
          });
          await batch.commit();
        }
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          try { handleFirestoreError(err, OperationType.DELETE, `users/${getCurrentUserId()}/notification_logs`); } catch (_) {}
        } else {
          console.warn("Firestore clear logs failed:", err);
        }
      }
    }
  },

  async getOrderById(orderId: string): Promise<any | null> {
    if (canUseFirestore()) {
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
        return LocalStorageDB.getDoc('orders', orderId);
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          try { handleFirestoreError(err, OperationType.GET, `users/${getCurrentUserId()}/orders/${orderId}`); } catch (_) {}
        } else {
          console.warn("Firestore single order read failed or timed out, falling back to LocalStorage:", err);
        }
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
    
    if (canUseFirestore()) {
      try {
        await Promise.race([
          setDoc(getUserLogDoc(log.id), cleanLog),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          try { handleFirestoreError(err, OperationType.WRITE, `users/${getCurrentUserId()}/notification_logs/${log.id}`); } catch (_) {}
        } else {
          console.warn("Firestore notification log save timed out or failed, local log remains updated:", err);
        }
      }
    }
  },

  async deleteNotificationLog(logId: string): Promise<void> {
    LocalStorageDB.deleteDoc('notification_logs', logId);
    
    if (canUseFirestore()) {
      try {
        await Promise.race([
          deleteDoc(getUserLogDoc(logId)),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          try { handleFirestoreError(err, OperationType.DELETE, `users/${getCurrentUserId()}/notification_logs/${logId}`); } catch (_) {}
        } else {
          console.warn("Firestore notification log delete timed out or failed:", err);
        }
      }
    }
  },

  async syncData(): Promise<{ orders: any[], logs: any[], customers: any[] }> {
    const localOrders = LocalStorageDB.getCollection('orders');
    const localLogs = LocalStorageDB.getCollection('notification_logs');
    const localCustomers = LocalStorageDB.getCollection('customers');

    if (!canUseFirestore()) {
      return {
        orders: localOrders,
        logs: localLogs,
        customers: localCustomers
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
          logs: localLogs,
          customers: localCustomers
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
              batch.set(getUserOrderDoc(order.id), JSON.parse(JSON.stringify(order)));
            });
            await batch.commit();
          }
        } catch (e: any) {
          if (e?.code === 'permission-denied' || String(e?.message).includes('Missing or insufficient permissions')) {
            try { handleFirestoreError(e, OperationType.WRITE, `users/${getCurrentUserId()}/orders`); } catch (_) {}
          } else {
            console.warn("Notice: Batch order upload during sync deferred:", e);
          }
        }
      }

      const finalOrders = Array.from(mergedOrdersMap.values());
      finalOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      LocalStorageDB.setCollection('orders', finalOrders);

      // 2. Sync customers subcollection bidirectionally
      let finalCustomers = localCustomers;
      try {
        const querySnapshotCustomers = await Promise.race([
          getDocs(getUserCustomersCollection()),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000))
        ]);

        if (querySnapshotCustomers) {
          const remoteCustomers: any[] = [];
          querySnapshotCustomers.forEach((docSnap) => {
            remoteCustomers.push({ id: docSnap.id, ...docSnap.data() });
          });

          const mergedCustomersMap = new Map<string, any>();
          remoteCustomers.forEach((c) => mergedCustomersMap.set(c.id, c));

          const customersToUpload: any[] = [];
          for (const localCust of localCustomers) {
            if (!localCust || !localCust.id) continue;
            const remoteCust = mergedCustomersMap.get(localCust.id);
            if (!remoteCust) {
              customersToUpload.push(localCust);
              mergedCustomersMap.set(localCust.id, localCust);
            } else {
              const localUpdated = localCust.updatedAt || localCust.createdAt || 0;
              const remoteUpdated = remoteCust.updatedAt || remoteCust.createdAt || 0;
              if (localUpdated > remoteUpdated) {
                customersToUpload.push(localCust);
                mergedCustomersMap.set(localCust.id, localCust);
              }
            }
          }

          if (customersToUpload.length > 0) {
            try {
              for (let i = 0; i < customersToUpload.length; i += 400) {
                const chunk = customersToUpload.slice(i, i + 400);
                const batch = writeBatch(db);
                chunk.forEach((cust) => {
                  batch.set(getUserCustomerDoc(cust.id), JSON.parse(JSON.stringify(cust)));
                });
                await batch.commit();
              }
            } catch (e) {
              console.warn("Notice: Batch customer upload during sync deferred:", e);
            }
          }

          finalCustomers = Array.from(mergedCustomersMap.values());
          finalCustomers.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
          LocalStorageDB.setCollection('customers', finalCustomers);
        }
      } catch (custErr) {
        console.warn("Notice: Customers sync deferred:", custErr);
      }

      // 3. Sync notification logs with safe non-throwing timeout from user-isolated subcollection
      const querySnapshotLogs = await Promise.race([
        getDocs(getUserLogsCollection()),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000))
      ]);

      if (!querySnapshotLogs) {
        console.warn("Firestore logs query timed out. Retaining local logs.");
        return { orders: finalOrders, logs: localLogs, customers: finalCustomers };
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
              batch.set(getUserLogDoc(log.id), JSON.parse(JSON.stringify(log)));
            });
            await batch.commit();
          }
        } catch (e: any) {
          if (e?.code === 'permission-denied' || String(e?.message).includes('Missing or insufficient permissions')) {
            try { handleFirestoreError(e, OperationType.WRITE, `users/${getCurrentUserId()}/notification_logs`); } catch (_) {}
          } else {
            console.warn("Notice: Batch log upload during sync deferred:", e);
          }
        }
      }

      const finalLogs = Array.from(mergedLogsMap.values());
      finalLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      LocalStorageDB.setCollection('notification_logs', finalLogs);

      return { orders: finalOrders, logs: finalLogs, customers: finalCustomers };
    } catch (err: any) {
      if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
        try { handleFirestoreError(err, OperationType.LIST, `users/${getCurrentUserId()}`); } catch (_) {}
      } else {
        console.warn("Notice: Bidirectional sync fallback active:", err);
      }
      return {
        orders: LocalStorageDB.getCollection('orders'),
        logs: LocalStorageDB.getCollection('notification_logs'),
        customers: LocalStorageDB.getCollection('customers')
      };
    }
  },

  async saveAppSettingsBackup(): Promise<void> {
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

    try {
      const settingsObj: Record<string, string> = {};
      SETTINGS_KEYS.forEach(key => {
        const val = localStorage.getItem(key);
        if (val !== null) {
          settingsObj[key] = val;
        }
      });

      const templates = safeJsonParse<any[]>(localStorage.getItem('db_templates'), []);
      const users = safeJsonParse<any[]>(localStorage.getItem('appUsersList'), []);
      const printers = safeJsonParse<any[]>(localStorage.getItem('maintenance_printers'), []);

      const backupPayload = {
        id: 'global_config',
        settings: settingsObj,
        templates,
        users,
        printers,
        updatedAt: Date.now()
      };

      const uid = getCurrentUserId();
      // Save backup payload in user-scoped localStorage key to avoid cross-account overwrites
      localStorage.setItem(`db_${uid}_app_settings_backup`, JSON.stringify(backupPayload));
      localStorage.setItem('db_app_settings_backup', JSON.stringify(backupPayload));
      console.log("Local backup saved successfully.");

      // Cloud save to user-isolated Firestore document
      if (canUseFirestore()) {
        await Promise.race([
          setDoc(getUserSettingsDoc('global_config'), backupPayload),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
        ]);
        console.log("Cloud backup saved successfully to Firestore under user subcollection.");
      }
    } catch (err: any) {
      if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
        try { handleFirestoreError(err, OperationType.WRITE, `users/${getCurrentUserId()}/app_settings/global_config`); } catch (_) {}
      } else {
        console.warn("Failed to save app settings backup:", err);
      }
    }
  },

  async syncAppSettingsBackup(): Promise<void> {
    if (!canUseFirestore()) {
      console.log("Firebase auth not active, skipping cloud settings sync.");
      return;
    }

    const uid = getCurrentUserId();
    const userBackupKey = `db_${uid}_app_settings_backup`;

    try {
      const docRef = getUserSettingsDoc('global_config');
      const docSnap = await Promise.race([
        getDoc(docRef),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);

      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        const localBackupStr = localStorage.getItem(userBackupKey);
        const localBackup = safeJsonParse<any>(localBackupStr, null);

        const remoteUpdatedAt = remoteData.updatedAt || 0;
        const localUpdatedAt = localBackup?.updatedAt || 0;

        // Bidirectional sync: if remote is newer or this account has no local backup yet, restore from cloud
        if (remoteUpdatedAt > localUpdatedAt || !localBackup) {
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

          localStorage.setItem(userBackupKey, JSON.stringify(remoteData));
          localStorage.setItem('db_app_settings_backup', JSON.stringify(remoteData));
          
          // Dispatch storage event so all components and views update automatically
          window.dispatchEvent(new Event('storage'));
        } else if (localUpdatedAt > remoteUpdatedAt) {
          console.log("Local settings are newer, uploading to cloud backup...");
          await this.saveAppSettingsBackup();
        }
      } else {
        console.log("No cloud backup found, creating initial cloud backup...");
        await this.saveAppSettingsBackup();
      }
    } catch (err: any) {
      if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
        try { handleFirestoreError(err, OperationType.GET, `users/${uid}/app_settings/global_config`); } catch (_) {}
      } else {
        console.warn("Failed to sync app settings with cloud:", err);
      }
    }
  }
};
