package com.buddieai.shadow.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.Base64

/**
 * Non-exportable P-256 signing key used to bind native credentials to this app install.
 */
class DeviceKeyManager {
    fun publicKeySpki(): String {
        val publicKey = getOrCreateKeyPair().certificate.publicKey.encoded
        return Base64.getUrlEncoder().withoutPadding().encodeToString(publicKey)
    }

    fun sign(message: String): String {
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(privateKey())
        signature.update(message.toByteArray(Charsets.UTF_8))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(signature.sign())
    }

    fun randomUrlSafe(byteCount: Int): String {
        val bytes = ByteArray(byteCount)
        SecureRandom().nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    fun clear() {
        keyStore().apply {
            if (containsAlias(KEY_ALIAS)) deleteEntry(KEY_ALIAS)
        }
    }

    private fun privateKey(): PrivateKey {
        return keyStore().getKey(KEY_ALIAS, null) as? PrivateKey
            ?: getOrCreateKeyPair().getKey() as PrivateKey
    }

    private fun getOrCreateKeyPair(): KeyStore.PrivateKeyEntry {
        val store = keyStore()
        (store.getEntry(KEY_ALIAS, null) as? KeyStore.PrivateKeyEntry)?.let { return it }

        KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, ANDROID_KEYSTORE)
            .apply {
                initialize(
                    KeyGenParameterSpec.Builder(
                        KEY_ALIAS,
                        KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY,
                    )
                        .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                        .setDigests(KeyProperties.DIGEST_SHA256)
                        .setUserAuthenticationRequired(false)
                        .build(),
                )
            }
            .generateKeyPair()

        return store.getEntry(KEY_ALIAS, null) as KeyStore.PrivateKeyEntry
    }

    private fun KeyStore.PrivateKeyEntry.getKey() = privateKey

    private fun keyStore(): KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val KEY_ALIAS = "buddie_mobile_device_signing_v1"
    }
}
