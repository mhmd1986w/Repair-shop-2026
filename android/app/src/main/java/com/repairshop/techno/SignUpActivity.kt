package com.repairshop.techno

import android.content.Intent
import android.os.Bundle
import android.util.Patterns
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseAuthWeakPasswordException
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.repairshop.techno.model.UserProfile

/**
 * شاشة إنشاء حساب جديد (SignUpActivity)
 * تقوم بربط الحقول، التحقق من صحة البيانات المدخلة،
 * إنشاء المستخدم في Firebase Authentication،
 * ثم حفظ وثيقة الملف الشخصي في Cloud Firestore باستخدام UID كمفتاح أساسي.
 */
class SignUpActivity : AppCompatActivity() {

    // عناصر واجهة المستخدم (UI Views)
    private lateinit var tilFullName: TextInputLayout
    private lateinit var etFullName: TextInputEditText

    private lateinit var tilPhoneNumber: TextInputLayout
    private lateinit var etPhoneNumber: TextInputEditText

    private lateinit var tilEmail: TextInputLayout
    private lateinit var etEmail: TextInputEditText

    private lateinit var tilPassword: TextInputLayout
    private lateinit var etPassword: TextInputEditText

    private lateinit var tilConfirmPassword: TextInputLayout
    private lateinit var etConfirmPassword: TextInputEditText

    private lateinit var btnSignUp: MaterialButton
    private lateinit var progressBar: ProgressBar
    private lateinit var tvGoToLogin: TextView

    // مراجع خدمات Firebase السحابية
    private lateinit var auth: FirebaseAuth
    private lateinit var firestore: FirebaseFirestore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_signup)

        // 1. تهيئة مراجع Firebase
        auth = FirebaseAuth.getInstance()
        firestore = FirebaseFirestore.getInstance()

        // 2. ربط عناصر الواجهة البرمجية (View Binding)
        initViews()

        // 3. إعداد مستمعات الأحداث (Listeners)
        btnSignUp.setOnClickListener {
            handleSignUp()
        }

        tvGoToLogin.setOnClickListener {
            finish() // العودة لشاشة تسجيل الدخول السابقة
        }
    }

    /**
     * ربط متغيرات الكود بعناصر XML المعرفة في activity_signup.xml
     */
    private fun initViews() {
        tilFullName = findViewById(R.id.tilFullName)
        etFullName = findViewById(R.id.etFullName)

        tilPhoneNumber = findViewById(R.id.tilPhoneNumber)
        etPhoneNumber = findViewById(R.id.etPhoneNumber)

        tilEmail = findViewById(R.id.tilEmail)
        etEmail = findViewById(R.id.etEmail)

        tilPassword = findViewById(R.id.tilPassword)
        etPassword = findViewById(R.id.etPassword)

        tilConfirmPassword = findViewById(R.id.tilConfirmPassword)
        etConfirmPassword = findViewById(R.id.etConfirmPassword)

        btnSignUp = findViewById(R.id.btnSignUp)
        progressBar = findViewById(R.id.progressBar)
        tvGoToLogin = findViewById(R.id.tvGoToLogin)
    }

    /**
     * قراءة النصوص المدخلة، والتحقق من عدم فراغها وصحة صيغتها قبل المعالجة
     */
    private fun handleSignUp() {
        // مسح الأخطاء السابقة
        clearErrors()

        // قراءة النصوص المدخلة
        val fullName = etFullName.text?.toString()?.trim().orEmpty()
        val phoneNumber = etPhoneNumber.text?.toString()?.trim().orEmpty()
        val email = etEmail.text?.toString()?.trim().orEmpty()
        val password = etPassword.text?.toString().orEmpty()
        val confirmPassword = etConfirmPassword.text?.toString().orEmpty()

        // التحقق من الحقول
        var isValid = true

        if (fullName.isEmpty()) {
            tilFullName.error = "يرجى إدخال الاسم الكامل أو اسم المركز"
            isValid = false
        }

        if (phoneNumber.isEmpty()) {
            tilPhoneNumber.error = "يرجى إدخال رقم الهاتف"
            isValid = false
        } else if (phoneNumber.length < 8) {
            tilPhoneNumber.error = "رقم الهاتف غير مكتمل، يرجى التأكد من الرقم"
            isValid = false
        }

        if (email.isEmpty()) {
            tilEmail.error = "يرجى إدخال البريد الإلكتروني"
            isValid = false
        } else if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            tilEmail.error = "صيغة البريد الإلكتروني غير صحيحة"
            isValid = false
        }

        if (password.isEmpty()) {
            tilPassword.error = "يرجى إدخال كلمة المرور"
            isValid = false
        } else if (password.length < 6) {
            tilPassword.error = "يجب أن لا تقل كلمة المرور عن 6 خانات"
            isValid = false
        }

        if (confirmPassword.isEmpty()) {
            tilConfirmPassword.error = "يرجى تأكيد كلمة المرور"
            isValid = false
        } else if (password != confirmPassword) {
            tilConfirmPassword.error = "كلمات المرور غير متطابقة"
            isValid = false
        }

        if (!isValid) return

        // بدء عملية إنشاء الحساب السحابي
        executeFirebaseRegistration(fullName, phoneNumber, email, password)
    }

    /**
     * تنفيذ التخزين السحابي:
     * 1. إنشاء الحساب في FirebaseAuth
     * 2. حفظ وثيقة الملف الشخصي في Cloud Firestore باستخدام UID كمفتاح أساسي
     */
    private fun executeFirebaseRegistration(
        fullName: String,
        phoneNumber: String,
        email: String,
        password: String
    ) {
        setLoadingState(true)

        auth.createUserWithEmailAndPassword(email, password)
            .addOnSuccessListener { authResult ->
                val user = authResult.user
                if (user != null) {
                    // حفظ بيانات الملف الشخصي في Cloud Firestore
                    saveUserProfileToFirestore(user, fullName, phoneNumber, email)
                } else {
                    setLoadingState(false)
                    Toast.makeText(this, "تعذر استلام بيانات المستخدم من Firebase", Toast.LENGTH_LONG).show()
                }
            }
            .addOnFailureListener { exception ->
                setLoadingState(false)
                val errorMessage = when (exception) {
                    is FirebaseAuthUserCollisionException -> "هذا البريد مسجل مسبقاً، يرجى تسجيل الدخول بدلاً من ذلك"
                    is FirebaseAuthWeakPasswordException -> "كلمة المرور ضعيفة جداً"
                    else -> exception.localizedMessage ?: "حدث خطأ أثناء إنشاء الحساب"
                }
                Toast.makeText(this, errorMessage, Toast.LENGTH_LONG).show()
            }
    }

    /**
     * حفظ وثيقة الملف الشخصي في مجموعة users/{userId} في Firestore
     */
    private fun saveUserProfileToFirestore(
        user: FirebaseUser,
        fullName: String,
        phoneNumber: String,
        email: String
    ) {
        val userId = user.uid

        // بناء كائن الملف الشخصي
        val profile = UserProfile(
            userId = userId,
            displayName = fullName,
            phoneNumber = phoneNumber,
            email = email,
            role = "admin",
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis(),
            isolatedDataReady = true
        )

        // حفظ الوثيقة في Firestore باستخدام userId كمفتاح أساسي (Document ID)
        val userDocRef = firestore.collection("users").document(userId)

        userDocRef.set(profile.toMap(), SetOptions.merge())
            .addOnSuccessListener {
                // إنشاء إعدادات المركز الافتراضية في مجلد المستخدم المنعزل
                initializeDefaultSettings(userId)

                setLoadingState(false)
                Toast.makeText(this, "تم إنشاء الحساب وحفظ البيانات في السحابة بنجاح! مرحباً بك", Toast.LENGTH_SHORT).show()

                // الانتقال إلى الشاشة الرئيسية للتطبيق
                val intent = Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                }
                startActivity(intent)
                finish()
            }
            .addOnFailureListener { error ->
                setLoadingState(false)
                Toast.makeText(
                    this,
                    "تم إنشاء الحساب ولكن تعذر حفظ الملف في Firestore: ${error.localizedMessage}",
                    Toast.LENGTH_LONG
                ).show()

                // على الرغم من حدوث خطأ جزئي في Firestore، نتيح للمستخدم الدخول
                val intent = Intent(this, MainActivity::class.java)
                startActivity(intent)
                finish()
            }
    }

    /**
     * تهيئة الإعدادات الافتراضية للنظام في المسار users/{userId}/app_settings/global_config
     */
    private fun initializeDefaultSettings(userId: String) {
        val settingsData = hashMapOf(
            "id" to "global_config",
            "userId" to userId,
            "createdAt" to System.currentTimeMillis(),
            "updatedAt" to System.currentTimeMillis(),
            "settings" to hashMapOf(
                "centerName" to "TECHNO",
                "currencyName" to "ريال",
                "barcodePrefix" to "TEC"
            )
        )

        firestore.collection("users")
            .document(userId)
            .collection("app_settings")
            .document("global_config")
            .set(settingsData, SetOptions.merge())
            .addOnFailureListener {
                // خطأ ثانوي في التهيئة لا يعيق عمل المستخدم
            }
    }

    /**
     * مسح أي رسائل أخطاء سابقة من حقول الإدخال
     */
    private fun clearErrors() {
        tilFullName.error = null
        tilPhoneNumber.error = null
        tilEmail.error = null
        tilPassword.error = null
        tilConfirmPassword.error = null
    }

    /**
     * إدارة حالة التحميل وإيقاف الأزرار لمنع التكرار
     */
    private fun setLoadingState(isLoading: Boolean) {
        progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        btnSignUp.isEnabled = !isLoading
        etFullName.isEnabled = !isLoading
        etPhoneNumber.isEnabled = !isLoading
        etEmail.isEnabled = !isLoading
        etPassword.isEnabled = !isLoading
        etConfirmPassword.isEnabled = !isLoading
    }
}
