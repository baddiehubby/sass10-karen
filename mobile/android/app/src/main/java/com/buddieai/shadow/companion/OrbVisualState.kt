package com.buddieai.shadow.companion

import java.util.Locale

enum class OrbVisualState {
    IDLE,
    HAPPY,
    LISTENING,
    THINKING,
    EXCITED,
    CALM,
    SAD,
    PLAYFUL,
    MUSIC,
    OFFLINE,
    ERROR,
}

object OrbVisualStateMapper {
    fun fromMood(value: String?): OrbVisualState {
        val mood = value?.trim()?.lowercase(Locale.ROOT).orEmpty()
        return when {
            mood.isBlank() -> OrbVisualState.IDLE
            mood in setOf("happy", "joy", "joyful", "positive", "good") -> OrbVisualState.HAPPY
            mood in setOf("listening", "attentive") -> OrbVisualState.LISTENING
            mood in setOf("thinking", "thoughtful", "focused") -> OrbVisualState.THINKING
            mood in setOf("excited", "energized", "energetic") -> OrbVisualState.EXCITED
            mood in setOf("calm", "peaceful", "relaxed", "neutral") -> OrbVisualState.CALM
            mood in setOf("sad", "low", "upset", "lonely") -> OrbVisualState.SAD
            mood in setOf("playful", "silly", "curious") -> OrbVisualState.PLAYFUL
            mood in setOf("music", "musical", "dancing") -> OrbVisualState.MUSIC
            mood in setOf("offline", "disconnected") -> OrbVisualState.OFFLINE
            mood in setOf("error", "unavailable") -> OrbVisualState.ERROR
            else -> OrbVisualState.IDLE
        }
    }

    fun fromCue(cue: String?, fallbackMood: String?): OrbVisualState {
        val mappedCue = fromMood(cue)
        return if (mappedCue == OrbVisualState.IDLE) fromMood(fallbackMood) else mappedCue
    }
}
