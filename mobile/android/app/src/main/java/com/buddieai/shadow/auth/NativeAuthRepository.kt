package com.buddieai.shadow.auth

import android.net.Uri
import com.buddieai.shadow.security.DeviceKeyManager
import com.buddieai.shadow.security.SecureStorage
import java.security.MessageDigest
import java.util.Base64

class NativeAuthRepository(
    private val storage: SecureStorage,
    private val deviceKeys: DeviceKeyManager,
    private val api: MobileApiClient = MobileApiClient(deviceKeys),
) {
    fun createSignInUri(): Uri {
        val verifier = deviceKeys.randomUrlSafe(64)
        val state = deviceKeys.randomUrlSafe(32)
        storage.put(PENDING_VERIFIER, verifier)
        storage.put(PENDING_STATE, state)

        return Uri.parse(CONNECT_URL).buildUpon()
            .appendQueryParameter("code_challenge", sha256UrlSafe(verifier))
            .appendQueryParameter("state", state)
            .appendQueryParameter("device_key", deviceKeys.publicKeySpki())
            .build()
    }

    fun exchangeCallback(uri: Uri): NativeSession {
        require(uri.scheme == "buddieai" && uri.host == "auth") { "Invalid auth callback" }
        val fragment = uri.fragment ?: throw IllegalArgumentException("Missing auth callback")
        val fragmentUri = Uri.parse("https://callback.invalid/?$fragment")
        val code = fragmentUri.getQueryParameter("code")
            ?: throw IllegalArgumentException("Missing auth code")
        val returnedState = fragmentUri.getQueryParameter("state")
            ?: throw IllegalArgumentException("Missing auth state")
        val expectedState = storage.get(PENDING_STATE)
            ?: throw IllegalStateException("No sign-in is pending")
        val verifier = storage.get(PENDING_VERIFIER)
            ?: throw IllegalStateException("No sign-in is pending")
        require(returnedState == expectedState) { "Auth state mismatch" }

        return try {
            api.exchange(code, verifier, returnedState).also(::saveSession)
        } finally {
            storage.remove(PENDING_STATE)
            storage.remove(PENDING_VERIFIER)
        }
    }

    fun refresh(): NativeSession {
        val token = storage.get(REFRESH_TOKEN)
            ?: throw MobileApiException(MobileApiError.UNAUTHORIZED, "No native session")
        val expiresAt = storage.get(REFRESH_EXPIRES_AT)?.toLongOrNull() ?: 0L
        if (expiresAt <= System.currentTimeMillis()) {
            clearSession()
            throw MobileApiException(MobileApiError.UNAUTHORIZED, "Native session expired")
        }
        return api.refresh(token).also(::saveSession)
    }

    fun hasSession(): Boolean {
        val expiresAt = storage.get(REFRESH_EXPIRES_AT)?.toLongOrNull() ?: return false
        return storage.get(REFRESH_TOKEN) != null && expiresAt > System.currentTimeMillis()
    }

    fun clearSession() {
        storage.clear()
        deviceKeys.clear()
    }

    private fun saveSession(session: NativeSession) {
        storage.put(REFRESH_TOKEN, session.refreshToken)
        storage.put(REFRESH_EXPIRES_AT, session.refreshExpiresAt.toString())
    }

    private fun sha256UrlSafe(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
    }

    private companion object {
        const val CONNECT_URL = "https://www.buddieai.com/mobile/connect"
        const val REFRESH_TOKEN = "native_refresh_token"
        const val REFRESH_EXPIRES_AT = "native_refresh_expires_at"
        const val PENDING_VERIFIER = "native_pending_pkce_verifier"
        const val PENDING_STATE = "native_pending_auth_state"
    }
}
