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
    val presenceMood: String? = null,
)

data class SharedMedia(
    val title: String? = null,
    val text: String? = null,
)

data class ContextReaction(
    val text: String,
    val orbCue: String,
    val mood: String,
    val confidence: Double,
    val confidenceBand: String,
    val basis: String,
    val disclaimer: String,
)

data class ContextResponse(
    val reaction: ContextReaction,
)
