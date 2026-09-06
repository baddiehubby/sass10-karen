package com.buddieai.shadow.auth

import java.security.MessageDigest
import java.util.Base64

internal enum class MobileProofPurpose(val wireValue: String) {
    EXCHANGE("exchange"),
    REFRESH("refresh"),
    LOGOUT("logout"),
    CONTEXT("context"),
    ;

    companion object {
        fun fromWireValue(value: String): MobileProofPurpose =
            entries.firstOrNull { it.wireValue == value }
                ?: throw IllegalArgumentException("Unsupported mobile proof purpose")
    }
}

internal object MobileDeviceProof {
    fun message(
        purpose: MobileProofPurpose,
        credential: String,
        timestamp: Long,
        nonce: String,
    ): String = listOf(
        "buddie-mobile-proof-v1",
        purpose.wireValue,
        sha256UrlSafe(credential),
        timestamp.toString(),
        nonce,
    ).joinToString("\n")

    private fun sha256UrlSafe(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
    }
}
