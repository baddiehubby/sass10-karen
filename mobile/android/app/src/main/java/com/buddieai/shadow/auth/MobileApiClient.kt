package com.buddieai.shadow.auth

import com.buddieai.shadow.security.DeviceKeyManager
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Base64

interface MobileSessionApi {
    fun exchange(code: String, verifier: String, state: String): NativeSession
    fun refresh(refreshToken: String): NativeSession
    fun logout(refreshToken: String)
}

class MobileApiClient(
    private val deviceKeys: DeviceKeyManager,
    private val endpoint: String = SESSION_ENDPOINT,
) : MobileSessionApi {
    override fun exchange(code: String, verifier: String, state: String): NativeSession {
        return executeSession(
            action = "exchange",
            credential = code,
            payload = JSONObject()
                .put("action", "exchange")
                .put("code", code)
                .put("verifier", verifier)
                .put("state", state),
        )
    }

    override fun refresh(refreshToken: String): NativeSession {
        return executeSession(
            action = "refresh",
            credential = refreshToken,
            payload = JSONObject()
                .put("action", "refresh")
                .put("refreshToken", refreshToken),
        )
    }

    override fun logout(refreshToken: String) {
        execute(
            action = "logout",
            credential = refreshToken,
            payload = JSONObject()
                .put("action", "logout")
                .put("refreshToken", refreshToken),
        )
    }

    private fun executeSession(
        action: String,
        credential: String,
        payload: JSONObject,
    ): NativeSession = parseSession(execute(action, credential, payload))

    private fun execute(action: String, credential: String, payload: JSONObject): JSONObject {
        val timestamp = System.currentTimeMillis()
        val nonce = deviceKeys.randomUrlSafe(24)
        val proofMessage = listOf(
            "buddie-mobile-proof-v1",
            action,
            sha256UrlSafe(credential),
            timestamp.toString(),
            nonce,
        ).joinToString("\n")

        payload
            .put("timestamp", timestamp)
            .put("nonce", nonce)
            .put("proof", deviceKeys.sign(proofMessage))

        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = CONNECT_TIMEOUT_MS
            readTimeout = READ_TIMEOUT_MS
            doOutput = true
            useCaches = false
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
        }

        try {
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use {
                it.write(payload.toString())
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                throw MobileApiException(
                    kind = when (status) {
                        401 -> MobileApiError.UNAUTHORIZED
                        403 -> MobileApiError.ENTITLEMENT
                        else -> MobileApiError.SERVER
                    },
                    message = "Mobile session request failed ($status)",
                )
            }
            return if (body.isBlank()) JSONObject() else JSONObject(body)
        } catch (error: MobileApiException) {
            throw error
        } catch (error: IOException) {
            throw MobileApiException(MobileApiError.OFFLINE, "Network unavailable", error)
        } catch (error: Exception) {
            throw MobileApiException(MobileApiError.SERVER, "Invalid server response", error)
        } finally {
            connection.disconnect()
        }
    }

    private fun parseSession(root: JSONObject): NativeSession {
        val entitlement = root.getJSONObject("entitlement")
        val companion = root.getJSONObject("companion")
        return NativeSession(
            refreshToken = root.getString("refreshToken"),
            refreshExpiresAt = root.getLong("refreshExpiresAt"),
            entitlement = NativeEntitlement(
                hasPaidAccess = entitlement.getBoolean("hasPaidAccess"),
                plan = entitlement.optString("plan", "free"),
                status = entitlement.optString("status", "unknown"),
            ),
            companionName = companion.optString("companionName", "Buddie"),
            personality = companion.optString("personality", "calm"),
        )
    }

    private fun sha256UrlSafe(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
    }

    private companion object {
        const val SESSION_ENDPOINT =
            "https://www.buddieai.com/api/licenses/widget-credential/mobile"
        const val CONNECT_TIMEOUT_MS = 10_000
        const val READ_TIMEOUT_MS = 15_000
    }
}

enum class MobileApiError {
    OFFLINE,
    UNAUTHORIZED,
    ENTITLEMENT,
    SERVER,
}

class MobileApiException(
    val kind: MobileApiError,
    message: String,
    cause: Throwable? = null,
) : Exception(message, cause)
