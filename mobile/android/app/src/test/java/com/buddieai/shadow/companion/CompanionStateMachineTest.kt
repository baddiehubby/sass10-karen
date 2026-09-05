package com.buddieai.shadow.companion

import kotlin.test.Test
import kotlin.test.assertEquals

class CompanionStateMachineTest {
    @Test
    fun `enable requires server entitlement before permission`() {
        assertEquals(
            CompanionState.ENTITLEMENT_REQUIRED,
            CompanionStateMachine.reduce(
                CompanionState.OFF,
                CompanionEvent.Enable(entitled = false, permissionGranted = false),
            ),
        )
    }

    @Test
    fun `entitled enable requests overlay permission`() {
        assertEquals(
            CompanionState.PERMISSION_REQUIRED,
            CompanionStateMachine.reduce(
                CompanionState.OFF,
                CompanionEvent.Enable(entitled = true, permissionGranted = false),
            ),
        )
    }

    @Test
    fun `granted permission moves through starting to active`() {
        val starting = CompanionStateMachine.reduce(
            CompanionState.PERMISSION_REQUIRED,
            CompanionEvent.PermissionResult(granted = true, entitled = true),
        )
        assertEquals(CompanionState.STARTING, starting)
        assertEquals(
            CompanionState.ACTIVE,
            CompanionStateMachine.reduce(starting, CompanionEvent.ServiceStarted),
        )
    }

    @Test
    fun `network loss and recovery are explicit`() {
        val offline = CompanionStateMachine.reduce(
            CompanionState.ACTIVE,
            CompanionEvent.NetworkLost,
        )
        assertEquals(CompanionState.OFFLINE, offline)
        assertEquals(
            CompanionState.STARTING,
            CompanionStateMachine.reduce(
                offline,
                CompanionEvent.NetworkRestored(
                    entitled = true,
                    permissionGranted = true,
                ),
            ),
        )
    }

    @Test
    fun `revocation logout and disable cleanly transition`() {
        assertEquals(
            CompanionState.PERMISSION_REQUIRED,
            CompanionStateMachine.reduce(CompanionState.ACTIVE, CompanionEvent.PermissionRevoked),
        )
        assertEquals(
            CompanionState.ENTITLEMENT_REQUIRED,
            CompanionStateMachine.reduce(
                CompanionState.ACTIVE,
                CompanionEvent.EntitlementChanged(false),
            ),
        )
        assertEquals(
            CompanionState.OFF,
            CompanionStateMachine.reduce(CompanionState.ACTIVE, CompanionEvent.Logout),
        )
        assertEquals(
            CompanionState.OFF,
            CompanionStateMachine.reduce(CompanionState.ERROR, CompanionEvent.Disable),
        )
    }
}
