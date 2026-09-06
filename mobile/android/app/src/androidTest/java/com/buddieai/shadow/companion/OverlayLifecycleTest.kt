package com.buddieai.shadow.companion

import android.provider.Settings
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OverlayLifecycleTest {
    @Test
    fun orbTapAndCloseCallbacksAreExplicit() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        var taps = 0
        var closes = 0
        val orb = FloatingOrbView(
            context,
            onTap = { taps += 1 },
            onLongPress = {},
            onClose = { closes += 1 },
            onDrag = { _, _, _ -> },
        )

        orb.getChildAt(0).performClick()
        orb.getChildAt(1).performClick()

        assertEquals(1, taps)
        assertEquals(1, closes)
    }

    @Test
    fun overlayShowRespectsSystemPermissionAndRemoveIsImmediate() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val controller = OverlayController(context, CompanionPreferences(context))

        val shown = controller.show {}
        if (Settings.canDrawOverlays(context)) {
            assertTrue(shown)
            assertTrue(controller.isShowing)
            controller.remove()
            assertFalse(controller.isShowing)
        } else {
            assertFalse(shown)
            assertFalse(controller.isShowing)
        }
    }
}
