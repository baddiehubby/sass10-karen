package com.buddieai.shadow.auth

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class MobileDeviceProofTest {
    @Test
    fun `context is an explicit device proof purpose`() {
        assertEquals(
            MobileProofPurpose.CONTEXT,
            MobileProofPurpose.fromWireValue("context"),
        )
        val message = MobileDeviceProof.message(
            MobileProofPurpose.CONTEXT,
            "refresh-token",
            123L,
            "nonce",
        )
        assertTrue(message.startsWith("buddie-mobile-proof-v1\ncontext\n"))
        assertTrue(message.endsWith("\n123\nnonce"))
    }
}
