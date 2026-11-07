# دليل صلاحيات النظام والمصادقة الحيوية (React Native)

بما أن بيئة العمل الحالية هي تطبيق ويب (React SPA)، قمت بكتابة الكود المطلوب لبيئة **React Native** (وهي الأقرب لبيئتنا) والتي تتيح استخراج تطبيقات أصلية (Native) لنظامي Android و iOS.

## 1. إعدادات ملفات النظام الأصلية

### نظام Android (`android/app/src/main/AndroidManifest.xml`)
أضف الصلاحيات التالية داخل علامة `<manifest>`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- صلاحية الكاميرا -->
    <uses-permission android:name="android.permission.CAMERA" />
    
    <!-- صلاحية الميكروفون -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    
    <!-- صلاحيات التخزين (للإصدارات القديمة) -->
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <!-- صلاحيات التخزين للإصدارات الحديثة (Android 11+) -->
    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />
    
    <!-- صلاحية قراءة جهات الاتصال -->
    <uses-permission android:name="android.permission.READ_CONTACTS" />
    
    <!-- صلاحية إجراء مكالمات -->
    <uses-permission android:name="android.permission.CALL_PHONE" />
    
    <!-- صلاحية البصمة / المصادقة الحيوية -->
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />
    <uses-permission android:name="android.permission.USE_FINGERPRINT" />
    
    <!-- تحديد أن الكاميرا ميزة مطلوبة (اختياري) -->
    <uses-feature android:name="android.hardware.camera" android:required="false" />
</manifest>
```

### نظام iOS (`ios/YourProjectName/Info.plist`)
أضف المفاتيح التالية داخل `<dict>`:

```xml
<dict>
    <!-- صلاحية الكاميرا -->
    <key>NSCameraUsageDescription</key>
    <string>نحتاج للوصول إلى الكاميرا لمسح الباركود والتقاط صور الأجهزة.</string>
    
    <!-- صلاحية الميكروفون -->
    <key>NSMicrophoneUsageDescription</key>
    <string>نحتاج للوصول إلى الميكروفون لتسجيل الملاحظات الصوتية.</string>
    
    <!-- صلاحية مكتبة الصور (التخزين) -->
    <key>NSPhotoLibraryUsageDescription</key>
    <string>نحتاج للوصول إلى مكتبة الصور لحفظ واسترجاع صور الأجهزة.</string>
    
    <!-- صلاحية جهات الاتصال -->
    <key>NSContactsUsageDescription</key>
    <string>نحتاج للوصول إلى جهات الاتصال لحفظ معلومات الزبائن.</string>
    
    <!-- صلاحية البصمة (FaceID / TouchID) -->
    <key>NSFaceIDUsageDescription</key>
    <string>نحتاج لاستخدام FaceID للتحقق من هويتك وتأمين التطبيق.</string>
</dict>
```

---

## 2. كود طلب الصلاحيات والمصادقة بالبصمة (وقت التشغيل)

للوصول إلى هذه الصلاحيات، نستخدم المكتبات الرسمية والأكثر موثوقية:
1. `react-native-permissions` لطلب صلاحيات النظام.
2. `react-native-biometrics` أو `expo-local-authentication` للمصادقة الحيوية.

إليك الكود المكتوب بلغة TypeScript (React Native):

```tsx
import React, { useState } from 'react';
import { View, Text, Button, Platform, Alert } from 'react-native';
import { requestMultiple, PERMISSIONS, RESULTS } from 'react-native-permissions';
import ReactNativeBiometrics from 'react-native-biometrics';

export default function NativeFeaturesScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 1. دالة لطلب الصلاحيات المتعددة في وقت التشغيل
  const requestAllPermissions = async () => {
    try {
      const permissionsToRequest = Platform.select({
        android: [
          PERMISSIONS.ANDROID.CAMERA,
          PERMISSIONS.ANDROID.RECORD_AUDIO,
          PERMISSIONS.ANDROID.READ_CONTACTS,
          PERMISSIONS.ANDROID.CALL_PHONE,
          PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
        ],
        ios: [
          PERMISSIONS.IOS.CAMERA,
          PERMISSIONS.IOS.MICROPHONE,
          PERMISSIONS.IOS.CONTACTS,
          PERMISSIONS.IOS.PHOTO_LIBRARY,
        ],
      });

      if (!permissionsToRequest) return;

      const statuses = await requestMultiple(permissionsToRequest);
      
      // التحقق من حالة الصلاحيات
      const cameraStatus = statuses[Platform.OS === 'android' ? PERMISSIONS.ANDROID.CAMERA : PERMISSIONS.IOS.CAMERA];
      
      if (cameraStatus === RESULTS.GRANTED) {
        Alert.alert('نجاح', 'تم منح الصلاحيات بنجاح!');
      } else if (cameraStatus === RESULTS.DENIED) {
        Alert.alert('تنبيه', 'تم رفض بعض الصلاحيات، لن تعمل بعض الميزات.');
      } else if (cameraStatus === RESULTS.BLOCKED) {
        Alert.alert('تنبيه', 'تم حظر الصلاحيات. يرجى تفعيلها من إعدادات النظام.');
      }
      
      console.log('حالة الصلاحيات:', statuses);
    } catch (error) {
      console.error('خطأ في طلب الصلاحيات:', error);
    }
  };

  // 2. دالة التحقق من البصمة / الوجه (Biometric Authentication)
  const authenticateWithBiometrics = async () => {
    const rnBiometrics = new ReactNativeBiometrics();

    try {
      // التحقق مما إذا كان الجهاز يدعم البصمة أو التعرف على الوجه
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();

      if (available && biometryType === ReactNativeBiometrics.TouchID) {
        console.log('مستشعر البصمة متوفر');
      } else if (available && biometryType === ReactNativeBiometrics.FaceID) {
        console.log('FaceID متوفر');
      } else if (available && biometryType === ReactNativeBiometrics.Biometrics) {
        console.log('المصادقة الحيوية متوفرة (Android)');
      } else {
        Alert.alert('عذراً', 'جهازك لا يدعم المصادقة الحيوية أو لم يتم إعدادها.');
        return;
      }

      // إظهار نافذة التحقق للمستخدم
      const { success, error } = await rnBiometrics.simplePrompt({
        promptMessage: 'قم بتأكيد هويتك للوصول إلى النظام',
        cancelButtonText: 'إلغاء'
      });

      if (success) {
        setIsAuthenticated(true);
        Alert.alert('تم بنجاح', 'تم التحقق من هويتك.');
      } else {
        Alert.alert('فشل', 'فشلت عملية التحقق أو تم إلغاؤها.');
      }
    } catch (error) {
      console.error('خطأ في التحقق الحيوي:', error);
      Alert.alert('خطأ', 'حدث خطأ غير متوقع أثناء التحقق.');
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 20, marginBottom: 30, fontWeight: 'bold' }}>
        لوحة التحكم الأصلية (Native)
      </Text>
      
      <View style={{ marginBottom: 20, width: '100%' }}>
        <Button 
          title="طلب الصلاحيات (كاميرا، مايك، تخزين، جهات اتصال)" 
          onPress={requestAllPermissions} 
          color="#007bff"
        />
      </View>

      <View style={{ marginBottom: 20, width: '100%' }}>
        <Button 
          title="تسجيل الدخول بالبصمة / الوجه" 
          onPress={authenticateWithBiometrics} 
          color="#28a745"
        />
      </View>

      {isAuthenticated && (
        <Text style={{ color: 'green', marginTop: 20, fontWeight: 'bold' }}>
          أنت الآن مسجل الدخول وتملك صلاحية الوصول!
        </Text>
      )}
    </View>
  );
}
```

### تثبيت المكتبات المستخدمة:
لتعمل الأكواد أعلاه في مشروع React Native الخاص بك، ستحتاج لتنفيذ الأوامر التالية:

```bash
npm install react-native-permissions react-native-biometrics
```
*(مع إعداد ملف `Podfile` لنظام iOS وتشغيل `pod install`).*
