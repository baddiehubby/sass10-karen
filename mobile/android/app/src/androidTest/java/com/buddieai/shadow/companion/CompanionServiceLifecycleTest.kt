package com.buddieai.shadow.companion

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CompanionServiceLifecycleTest {
    @Test
    fun serviceFailsClosedWithoutAnAuthenticatedSession() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val preferences = CompanionPreferences(context)
        preferences.enabled = true
        preferences.state = CompanionState.STARTING

        CompanionService.start(context)
        Thread.sleep(750)

        assertFalse(preferences.enabled)
        assertEquals(CompanionState.OFF, preferences.state)
        CompanionService.stop(context)
    }
}
