package com.buddieai.shadow.auth

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.buddieai.shadow.security.DeviceKeyManager
import com.buddieai.shadow.security.KeystoreSecureStorage
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class NativeAuthLogoutTest {
    @Test
    fun logoutClearsEncryptedValuesAndDestroysDeviceBindingKey() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val storage = KeystoreSecureStorage(context)
        val keys = DeviceKeyManager()
        storage.clear()
        keys.clear()
        storage.put("test_session", "secret")
        val publicKeyBefore = keys.publicKeySpki()

        NativeAuthRepository(storage, keys).clearSession()

        assertNull(storage.get("test_session"))
        assertNotEquals(publicKeyBefore, keys.publicKeySpki())
        storage.clear()
        keys.clear()
    }

    @Test
    fun signedLogoutFailureStillClearsLocalSession() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val storage = KeystoreSecureStorage(context)
        val keys = DeviceKeyManager()
        storage.clear()
        keys.clear()
        storage.put("native_refresh_token", "refresh-secret")
        storage.put("native_refresh_expires_at", Long.MAX_VALUE.toString())
        val publicKeyBefore = keys.publicKeySpki()
        val api = FakeMobileSessionApi().apply {
            logoutError = MobileApiException(MobileApiError.OFFLINE, "offline")
        }

        try {
            NativeAuthRepository(storage, keys, api).logout()
            fail("Expected logout failure")
        } catch (_: MobileApiException) {
            // Local destruction is required even when revocation cannot reach the server.
        }

        assertNull(storage.get("native_refresh_token"))
        assertNotEquals(publicKeyBefore, keys.publicKeySpki())
        storage.clear()
        keys.clear()
    }

    @Test
    fun refreshResponseFromBeforeLogoutCannotRestoreSession() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val storage = KeystoreSecureStorage(context)
        val keys = DeviceKeyManager()
        storage.clear()
        keys.clear()
        storage.put("native_refresh_token", "old-refresh")
        storage.put("native_refresh_expires_at", Long.MAX_VALUE.toString())
        val api = FakeMobileSessionApi()
        val refreshEntered = CountDownLatch(1)
        val releaseRefresh = CountDownLatch(1)
        api.onRefresh = {
            refreshEntered.countDown()
            releaseRefresh.await(5, TimeUnit.SECONDS)
            session("stale-refresh")
        }
        val refreshRepository = NativeAuthRepository(storage, keys, api)
        val logoutRepository = NativeAuthRepository(storage, keys, api)
        val executor = Executors.newSingleThreadExecutor()

        val refresh = executor.submit<NativeSession> { refreshRepository.refresh() }
        check(refreshEntered.await(5, TimeUnit.SECONDS))
        logoutRepository.logout()
        releaseRefresh.countDown()
        refresh.get(5, TimeUnit.SECONDS)

        assertNull(storage.get("native_refresh_token"))
        executor.shutdownNow()
        storage.clear()
        keys.clear()
    }

    @Test
    fun unauthorizedRefreshClearsLocalSession() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val storage = KeystoreSecureStorage(context)
        val keys = DeviceKeyManager()
        storage.clear()
        keys.clear()
        storage.put("native_refresh_token", "revoked-refresh")
        storage.put("native_refresh_expires_at", Long.MAX_VALUE.toString())
        val api = FakeMobileSessionApi().apply {
            onRefresh = {
                throw MobileApiException(MobileApiError.UNAUTHORIZED, "revoked")
            }
        }

        try {
            NativeAuthRepository(storage, keys, api).refresh()
            fail("Expected unauthorized refresh")
        } catch (_: MobileApiException) {
            // Expected.
        }

        assertNull(storage.get("native_refresh_token"))
        storage.clear()
        keys.clear()
    }

    private fun session(refreshToken: String) = NativeSession(
        refreshToken = refreshToken,
        refreshExpiresAt = Long.MAX_VALUE,
        entitlement = NativeEntitlement(true, "pro", "active"),
        companionName = "Buddie",
        personality = "calm",
    )

    private class FakeMobileSessionApi : MobileSessionApi {
        var logoutError: MobileApiException? = null
        var onRefresh: (() -> NativeSession)? = null

        override fun exchange(code: String, verifier: String, state: String): NativeSession {
            error("Not used")
        }

        override fun refresh(refreshToken: String): NativeSession {
            return onRefresh?.invoke() ?: error("Not used")
        }

        override fun context(
            refreshToken: String,
            explicitMood: String?,
            sharedMedia: SharedMedia?,
        ): ContextResponse = error("Not used")

        override fun logout(refreshToken: String) {
            logoutError?.let { throw it }
        }
    }
}
