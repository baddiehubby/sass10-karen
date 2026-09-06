package com.buddieai.shadow.companion

import kotlin.test.Test
import kotlin.test.assertEquals

class OverlayGeometryTest {
    @Test
    fun `initial coordinates are clamped inside inset window area`() {
        val area = OverlayArea(left = 12, top = 40, right = 1080, bottom = 2200)

        assertEquals(
            OverlayPosition(x = 984, y = 2104),
            OverlayGeometry.clamp(x = 4000, y = 4000, orbSize = 96, area = area),
        )
        assertEquals(
            OverlayPosition(x = 12, y = 40),
            OverlayGeometry.clamp(x = -20, y = -30, orbSize = 96, area = area),
        )
    }

    @Test
    fun `small display area keeps overlay at usable origin`() {
        val area = OverlayArea(left = 8, top = 16, right = 60, bottom = 72)

        assertEquals(
            OverlayPosition(x = 8, y = 16),
            OverlayGeometry.clamp(x = 40, y = 50, orbSize = 96, area = area),
        )
    }
}
