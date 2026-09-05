package com.buddieai.shadow.companion

import android.content.Context

class CompanionPreferences(context: Context) {
    private val preferences = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)

    var state: CompanionState
        get() = runCatching {
            CompanionState.valueOf(
                preferences.getString(KEY_STATE, CompanionState.OFF.name) ?: CompanionState.OFF.name,
            )
        }.getOrDefault(CompanionState.ERROR)
        set(value) {
            preferences.edit().putString(KEY_STATE, value.name).apply()
        }

    var enabled: Boolean
        get() = preferences.getBoolean(KEY_ENABLED, false)
        set(value) {
            preferences.edit().putBoolean(KEY_ENABLED, value).apply()
        }

    var orbX: Int
        get() = preferences.getInt(KEY_ORB_X, DEFAULT_ORB_X)
        set(value) {
            preferences.edit().putInt(KEY_ORB_X, value).apply()
        }

    var orbY: Int
        get() = preferences.getInt(KEY_ORB_Y, DEFAULT_ORB_Y)
        set(value) {
            preferences.edit().putInt(KEY_ORB_Y, value).apply()
        }

    var entitlementConfirmedAt: Long
        get() = preferences.getLong(KEY_ENTITLEMENT_CONFIRMED_AT, 0L)
        set(value) {
            preferences.edit().putLong(KEY_ENTITLEMENT_CONFIRMED_AT, value).apply()
        }

    fun transition(event: CompanionEvent): CompanionState {
        return CompanionStateMachine.reduce(state, event).also { state = it }
    }

    fun clearCompanion() {
        preferences.edit()
            .putBoolean(KEY_ENABLED, false)
            .putString(KEY_STATE, CompanionState.OFF.name)
            .putLong(KEY_ENTITLEMENT_CONFIRMED_AT, 0L)
            .apply()
    }

    private companion object {
        const val FILE_NAME = "buddie_companion_state"
        const val KEY_STATE = "state"
        const val KEY_ENABLED = "enabled"
        const val KEY_ORB_X = "orb_x"
        const val KEY_ORB_Y = "orb_y"
        const val KEY_ENTITLEMENT_CONFIRMED_AT = "entitlement_confirmed_at"
        const val DEFAULT_ORB_X = 24
        const val DEFAULT_ORB_Y = 240
    }
}
