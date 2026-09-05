package com.buddieai.shadow.security

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class KeystoreSecureStorageTest {
    private lateinit var storage: KeystoreSecureStorage

    @Before
    fun setUp() {
        storage = KeystoreSecureStorage(ApplicationProvider.getApplicationContext())
        storage.clear()
    }

    @After
    fun tearDown() {
        storage.clear()
    }

    @Test
    fun saveReadDeleteAndClearAreEncryptedStorageOperations() {
        storage.put("refresh_token", "sensitive-value")
        storage.put("expires_at", "12345")

        assertEquals("sensitive-value", storage.get("refresh_token"))
        storage.remove("refresh_token")
        assertNull(storage.get("refresh_token"))

        storage.clear()
        assertNull(storage.get("expires_at"))
    }
}
