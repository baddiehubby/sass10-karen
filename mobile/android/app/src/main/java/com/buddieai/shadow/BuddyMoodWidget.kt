package com.buddieai.shadow

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

/**
 * Minimal home-screen widget — orb tint reflects last synced mood from SharedPreferences.
 * Copy into your Bubblewrap TWA project with res/layout/buddy_mood_widget.xml.
 */
class BuddyMoodWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs = context.getSharedPreferences("buddy_presence", Context.MODE_PRIVATE)
        val mood = prefs.getString("currentMood", "neutral") ?: "neutral"
        val color = moodColor(mood)
        val layoutId = context.resources.getIdentifier("buddy_mood_widget", "layout", context.packageName)
        val orbId = context.resources.getIdentifier("orb_view", "id", context.packageName)
        if (layoutId == 0 || orbId == 0) return

        for (widgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, layoutId)
            views.setInt(orbId, "setBackgroundColor", color)
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }

    private fun moodColor(mood: String): Int = when (mood) {
        "happy" -> 0xFFF59E0B.toInt()
        "concerned" -> 0xFFEF4444.toInt()
        "thinking" -> 0xFF3B82F6.toInt()
        "excited" -> 0xFFEC4899.toInt()
        "sleepy" -> 0xFF6366F1.toInt()
        else -> 0xFF7C3AED.toInt()
    }
}
