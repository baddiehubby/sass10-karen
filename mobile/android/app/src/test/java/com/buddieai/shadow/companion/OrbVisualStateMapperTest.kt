package com.buddieai.shadow.companion

import kotlin.test.Test
import kotlin.test.assertEquals

class OrbVisualStateMapperTest {
    @Test
    fun `known moods map coherently`() {
        assertEquals(OrbVisualState.HAPPY, OrbVisualStateMapper.fromMood("joyful"))
        assertEquals(OrbVisualState.THINKING, OrbVisualStateMapper.fromMood(" focused "))
        assertEquals(OrbVisualState.MUSIC, OrbVisualStateMapper.fromMood("dancing"))
        assertEquals(OrbVisualState.OFFLINE, OrbVisualStateMapper.fromMood("disconnected"))
    }

    @Test
    fun `unknown and missing moods remain idle`() {
        assertEquals(OrbVisualState.IDLE, OrbVisualStateMapper.fromMood(null))
        assertEquals(OrbVisualState.IDLE, OrbVisualStateMapper.fromMood("unexpected"))
    }

    @Test
    fun `orb cue wins with mood fallback`() {
        assertEquals(OrbVisualState.EXCITED, OrbVisualStateMapper.fromCue("excited", "sad"))
        assertEquals(OrbVisualState.SAD, OrbVisualStateMapper.fromCue("unknown", "sad"))
    }
}
