package com.repairshop.techno.model

import androidx.annotation.Keep

@Keep
data class UserProfile(
    val userId: String = "",
    val displayName: String = "",
    val phoneNumber: String = "",
    val email: String = "",
    val role: String = "admin",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val isolatedDataReady: Boolean = true
) {
    fun toMap(): Map<String, Any> {
        return mapOf(
            "userId" to userId,
            "displayName" to displayName,
            "phoneNumber" to phoneNumber,
            "email" to email,
            "role" to role,
            "createdAt" to createdAt,
            "updatedAt" to updatedAt,
            "isolatedDataReady" to isolatedDataReady
        )
    }
}
