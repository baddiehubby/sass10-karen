package com.buddieai.shadow.auth

data class NativeEntitlement(
    val hasPaidAccess: Boolean,
    val plan: String,
    val status: String,
)

data class NativeSession(
    val refreshToken: String,
    val refreshExpiresAt: Long,
    val entitlement: NativeEntitlement,
    val companionName: String,
    val personality: String,
)
