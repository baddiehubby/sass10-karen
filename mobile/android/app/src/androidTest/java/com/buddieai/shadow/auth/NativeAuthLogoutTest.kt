package com.buddieai.shadow.auth

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.buddieai.shadow.security.DeviceKeyManager
import com.buddieai.shadow.security.KeystoreSecureStorage
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

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
}
