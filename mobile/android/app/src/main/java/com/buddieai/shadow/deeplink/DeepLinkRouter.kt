package com.buddieai.shadow.deeplink

import java.net.URI

/**
 * Parses only documented Buddie links and maps them to existing web surfaces.
 * No arbitrary URL supplied by a deep link is ever opened.
 */
object DeepLinkRouter {
    private const val WEB_HOST = "www.buddieai.com"

    enum class Destination(val webUrl: String) {
        OPEN("https://www.buddieai.com/pwa"),
        ORACLE("https://www.buddieai.com/dashboard/oracle"),
        SETTINGS("https://www.buddieai.com/dashboard/settings"),
        COMPANION("https://www.buddieai.com/pwa"),
    }

    fun parse(raw: String?): Destination? {
        if (raw.isNullOrBlank()) return null

        val uri = runCatching { URI(raw.trim()) }.getOrNull() ?: return null
        if (uri.userInfo != null || uri.fragment != null) return null

        return when (uri.scheme?.lowercase()) {
            "buddieai" -> parseCustomScheme(uri)
            "https" -> parseHttps(uri)
            else -> null
        }
    }

    private fun parseCustomScheme(uri: URI): Destination? {
        if (uri.port != -1 || !uri.path.orEmpty().trim('/').isEmpty()) return null
        return when (uri.host?.lowercase()) {
            "open" -> Destination.OPEN
            "oracle" -> Destination.ORACLE
            "settings" -> Destination.SETTINGS
            "companion" -> Destination.COMPANION
            else -> null
        }
    }

    private fun parseHttps(uri: URI): Destination? {
        if (!uri.host.equals(WEB_HOST, ignoreCase = true)) return null
        if (uri.port != -1 && uri.port != 443) return null

        return when (uri.path.trimEnd('/').ifEmpty { "/" }) {
            "/", "/pwa" -> Destination.OPEN
            "/dashboard/oracle" -> Destination.ORACLE
            "/dashboard/settings" -> Destination.SETTINGS
            else -> null
        }
    }
}
