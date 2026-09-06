package com.buddieai.shadow.deeplink

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class DeepLinkRouterTest {
    @Test
    fun `custom links map to documented destinations`() {
        assertEquals(DeepLinkRouter.Destination.OPEN, DeepLinkRouter.parse("buddieai://open"))
        assertEquals(DeepLinkRouter.Destination.ORACLE, DeepLinkRouter.parse("buddieai://oracle"))
        assertEquals(DeepLinkRouter.Destination.SETTINGS, DeepLinkRouter.parse("buddieai://settings"))
        assertEquals(DeepLinkRouter.Destination.COMPANION, DeepLinkRouter.parse("buddieai://companion"))
    }

    @Test
    fun `approved HTTPS links map to existing Buddie surfaces`() {
        assertEquals(
            DeepLinkRouter.Destination.ORACLE,
            DeepLinkRouter.parse("https://www.buddieai.com/dashboard/oracle"),
        )
        assertEquals(
            DeepLinkRouter.Destination.SETTINGS,
            DeepLinkRouter.parse("https://www.buddieai.com/dashboard/settings/"),
        )
        assertEquals(
            DeepLinkRouter.Destination.OPEN,
            DeepLinkRouter.parse("https://www.buddieai.com/pwa"),
        )
    }

    @Test
    fun `unknown schemes hosts ports and paths are rejected`() {
        assertNull(DeepLinkRouter.parse("http://www.buddieai.com/pwa"))
        assertNull(DeepLinkRouter.parse("https://buddieai.com/pwa"))
        assertNull(DeepLinkRouter.parse("https://evil.example/dashboard/oracle"))
        assertNull(DeepLinkRouter.parse("https://www.buddieai.com:444/dashboard/oracle"))
        assertNull(DeepLinkRouter.parse("https://www.buddieai.com/pricing"))
        assertNull(DeepLinkRouter.parse("buddieai://unknown"))
        assertNull(DeepLinkRouter.parse("buddieai://auth#code=secret"))
        assertNull(DeepLinkRouter.parse("buddieai://oracle/extra"))
    }

    @Test
    fun `userinfo fragments and malformed input are rejected`() {
        assertNull(DeepLinkRouter.parse("https://user@www.buddieai.com/pwa"))
        assertNull(DeepLinkRouter.parse("https://www.buddieai.com/pwa#fragment"))
        assertNull(DeepLinkRouter.parse("https://www.buddieai.com/pwa?next=oracle"))
        assertNull(DeepLinkRouter.parse("buddieai://oracle?next=settings"))
        assertNull(DeepLinkRouter.parse("buddieai://open?"))
        assertNull(DeepLinkRouter.parse("not a uri"))
        assertNull(DeepLinkRouter.parse(""))
        assertNull(DeepLinkRouter.parse(null))
    }
}
