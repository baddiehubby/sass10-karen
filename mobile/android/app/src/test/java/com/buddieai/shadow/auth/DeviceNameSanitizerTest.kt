package com.buddieai.shadow.auth

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DeviceNameSanitizerTest {
    @Test
    fun `device model is safe for display`() {
        assertEquals("Pixel 9 Pro", DeviceNameSanitizer.sanitize(" Pixel\t9 🔥 Pro\n"))
        assertEquals("Android device", DeviceNameSanitizer.sanitize("\u0000🔥"))
    }

    @Test
    fun `device model is bounded`() {
        assertTrue(DeviceNameSanitizer.sanitize("x".repeat(200)).length <= 80)
    }
}
