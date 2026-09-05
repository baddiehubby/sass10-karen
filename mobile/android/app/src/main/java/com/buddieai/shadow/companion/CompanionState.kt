package com.buddieai.shadow.companion

enum class CompanionState {
    OFF,
    PERMISSION_REQUIRED,
    STARTING,
    ACTIVE,
    PAUSED,
    OFFLINE,
    ENTITLEMENT_REQUIRED,
    ERROR,
}

sealed interface CompanionEvent {
    data class Enable(
        val entitled: Boolean,
        val permissionGranted: Boolean,
        val online: Boolean = true,
    ) : CompanionEvent

    data class PermissionResult(
        val granted: Boolean,
        val entitled: Boolean,
    ) : CompanionEvent

    data object ServiceStarted : CompanionEvent
    data object Disable : CompanionEvent
    data object Pause : CompanionEvent
    data object NetworkLost : CompanionEvent

    data class Resume(
        val entitled: Boolean,
        val permissionGranted: Boolean,
        val online: Boolean = true,
    ) : CompanionEvent

    data class NetworkRestored(
        val entitled: Boolean,
        val permissionGranted: Boolean,
    ) : CompanionEvent

    data class EntitlementChanged(val entitled: Boolean) : CompanionEvent
    data object PermissionRevoked : CompanionEvent
    data object Failed : CompanionEvent
    data object Logout : CompanionEvent
}

object CompanionStateMachine {
    fun reduce(current: CompanionState, event: CompanionEvent): CompanionState {
        return when (event) {
            is CompanionEvent.Enable ->
                targetFor(event.entitled, event.permissionGranted, event.online)

            is CompanionEvent.PermissionResult -> when {
                !event.entitled -> CompanionState.ENTITLEMENT_REQUIRED
                event.granted -> CompanionState.STARTING
                else -> CompanionState.PERMISSION_REQUIRED
            }

            CompanionEvent.ServiceStarted ->
                if (current == CompanionState.STARTING || current == CompanionState.OFFLINE) {
                    CompanionState.ACTIVE
                } else {
                    current
                }

            CompanionEvent.Disable,
            CompanionEvent.Logout,
            -> CompanionState.OFF

            CompanionEvent.Pause ->
                if (current == CompanionState.ACTIVE || current == CompanionState.OFFLINE) {
                    CompanionState.PAUSED
                } else {
                    current
                }

            CompanionEvent.NetworkLost ->
                if (current == CompanionState.ACTIVE || current == CompanionState.STARTING) {
                    CompanionState.OFFLINE
                } else {
                    current
                }

            is CompanionEvent.Resume ->
                targetFor(event.entitled, event.permissionGranted, event.online)

            is CompanionEvent.NetworkRestored ->
                targetFor(event.entitled, event.permissionGranted, online = true)

            is CompanionEvent.EntitlementChanged ->
                if (event.entitled) {
                    if (current == CompanionState.ENTITLEMENT_REQUIRED) CompanionState.OFF else current
                } else {
                    CompanionState.ENTITLEMENT_REQUIRED
                }

            CompanionEvent.PermissionRevoked -> CompanionState.PERMISSION_REQUIRED
            CompanionEvent.Failed -> CompanionState.ERROR
        }
    }

    private fun targetFor(
        entitled: Boolean,
        permissionGranted: Boolean,
        online: Boolean,
    ): CompanionState = when {
        !online -> CompanionState.OFFLINE
        !entitled -> CompanionState.ENTITLEMENT_REQUIRED
        !permissionGranted -> CompanionState.PERMISSION_REQUIRED
        else -> CompanionState.STARTING
    }
}
