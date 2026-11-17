package com.repairshop.techno

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.webkit.JavascriptInterface
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * مساعد طلب صلاحية الوصول إلى جميع الملفات (All Files Access)
 * يدعم Android 11+ (MANAGE_EXTERNAL_STORAGE) والإصدارات الأقدم (READ/WRITE_EXTERNAL_STORAGE)
 * كما يوفر واجهة JavascriptInterface لربطه مع تطبيق الويب داخل WebView.
 */
object StoragePermissionHelper {

    const val REQUEST_CODE_STORAGE_PERMISSION = 1001

    /**
     * التحقق من وجود صلاحية الوصول إلى الملفات
     */
    fun hasAllFilesAccess(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            val readGranted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED

            val writeGranted = if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.Q) {
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }

            readGranted && writeGranted
        }
    }

    /**
     * إنشاء Intent آمن لفتح شاشة صلاحية الوصول إلى جميع الملفات على Android 11+
     */
    fun buildAllFilesAccessIntent(context: Context): Intent {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                data = Uri.parse("package:${context.packageName}")
            }
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
            }
        }
    }

    /**
     * طلب صلاحية الوصول إلى جميع الملفات مع معالجة آمنة لجميع إصدارات Android
     */
    fun requestAllFilesAccess(
        context: Context,
        requestCode: Int = REQUEST_CODE_STORAGE_PERMISSION
    ) {
        if (hasAllFilesAccess(context)) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                    data = Uri.parse("package:${context.packageName}")
                    if (context !is Activity) {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                }
                context.startActivity(intent)
            } catch (e: Exception) {
                try {
                    val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION).apply {
                        if (context !is Activity) {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                    }
                    context.startActivity(intent)
                } catch (_: Exception) {
                    val fallbackIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.parse("package:${context.packageName}")
                        if (context !is Activity) {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                    }
                    context.startActivity(fallbackIntent)
                }
            }
        } else if (context is Activity) {
            ActivityCompat.requestPermissions(
                context,
                arrayOf(
                    Manifest.permission.READ_EXTERNAL_STORAGE,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE
                ),
                requestCode
            )
        } else {
            val fallbackIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(fallbackIntent)
        }
    }

    /**
     * مُشغّل نتيجة ActivityResultLauncher للتحقق فور عودة المستخدم من إعدادات النظام
     */
    fun createAllFilesAccessLauncher(
        activity: ComponentActivity,
        onResult: (granted: Boolean) -> Unit
    ): ActivityResultLauncher<Intent> {
        return activity.registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) {
            onResult(hasAllFilesAccess(activity))
        }
    }

    /**
     * إطلاق نافذة طلب الصلاحية عبر ActivityResultLauncher على Android 11+
     */
    fun launchAllFilesAccess(
        activity: Activity,
        launcher: ActivityResultLauncher<Intent>,
        requestCode: Int = REQUEST_CODE_STORAGE_PERMISSION
    ) {
        if (hasAllFilesAccess(activity)) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                    data = Uri.parse("package:${activity.packageName}")
                }
                launcher.launch(intent)
            } catch (e: Exception) {
                val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                launcher.launch(intent)
            }
        } else {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(
                    Manifest.permission.READ_EXTERNAL_STORAGE,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE
                ),
                requestCode
            )
        }
    }
}

/**
 * جسر ربط لـ WebView لتمكين واجهة الويب من فحص وطلب صلاحية الوصول إلى جميع الملفات
 * الاستخدام داخل Activity:
 * webView.addJavascriptInterface(AndroidStorageBridge(this), "AndroidStorageBridge")
 */
class AndroidStorageBridge(private val activity: Activity) {

    @JavascriptInterface
    fun isNativeAndroid(): Boolean = true

    @JavascriptInterface
    fun hasAllFilesAccess(): Boolean {
        return StoragePermissionHelper.hasAllFilesAccess(activity)
    }

    @JavascriptInterface
    fun requestAllFilesAccess(): Boolean {
        activity.runOnUiThread {
            StoragePermissionHelper.requestAllFilesAccess(activity)
        }
        return StoragePermissionHelper.hasAllFilesAccess(activity)
    }
}
