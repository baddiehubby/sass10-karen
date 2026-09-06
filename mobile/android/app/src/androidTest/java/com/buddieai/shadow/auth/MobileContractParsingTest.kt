package com.buddieai.shadow.auth

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.buddieai.shadow.security.DeviceKeyManager
import com.buddieai.shadow.security.KeystoreSecureStorage
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MobileContractParsingTest {
    @Test
    fun signInLinkIncludesAndroidAndSanitizedDeviceName() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val keys = DeviceKeyManager()
        val storage = KeystoreSecureStorage(context)
        storage.clear()
        keys.clear()

        val uri = NativeAuthRepository(storage, keys).createSignInUri()

        assertEquals("android", uri.getQueryParameter("platform"))
        assertNotNull(uri.getQueryParameter("device_name"))
        assertEquals(1, uri.getQueryParameters("device_name").size)
        assertNotNull(uri.getQueryParameter("app_version"))
        storage.clear()
        keys.clear()
    }

    @Test
    fun sessionPresenceAndReactionContractAreParsed() {
        val root = JSONObject(
            """
            {
              "refreshToken":"rotated",
              "refreshExpiresAt":9999999999999,
              "entitlement":{"hasPaidAccess":true,"plan":"pro","status":"active"},
              "companion":{"companionName":"Buddie","personality":"calm"},
              "presence":{"currentMood":"playful"},
              "reaction":{
                "text":"I am here.",
                "orbCue":"happy",
                "mood":"playful",
                "confidence":0.8,
                "confidenceBand":"high",
                "basis":"user_shared",
                "disclaimer":"Based only on what you shared."
              }
            }
            """.trimIndent(),
        )
        val parser = MobileApiClient(DeviceKeyManager())

        val session = parser.parseSession(root)
        val reaction = parser.parseReaction(root.getJSONObject("reaction"))

        assertEquals("playful", session.presenceMood)
        assertEquals("happy", reaction.orbCue)
        assertEquals("user_shared", reaction.basis)
    }
}
