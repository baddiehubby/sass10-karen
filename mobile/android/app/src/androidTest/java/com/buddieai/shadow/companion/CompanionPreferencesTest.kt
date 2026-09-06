package com.buddieai.shadow.companion

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CompanionPreferencesTest {
    @Test
    fun pauseAndMutePersistAcrossInstances() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val first = CompanionPreferences(context)
        first.clearCompanion()
        first.userPaused = true
        first.muted = true

        val restored = CompanionPreferences(context)
        assertTrue(restored.userPaused)
        assertTrue(restored.muted)

        restored.clearCompanion()
        assertFalse(CompanionPreferences(context).userPaused)
        CompanionPreferences(context).muted = false
    }
}
