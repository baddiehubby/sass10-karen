package com.buddieai.shadow.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.KeyStore
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Encrypts every value with an Android Keystore non-exportable AES key.
 * Ciphertext is stored under noBackupFilesDir, never SharedPreferences.
 */
class KeystoreSecureStorage(context: Context) : SecureStorage {
    private val directory = File(context.noBackupFilesDir, DIRECTORY_NAME)
    private val lock = Any()

    override fun put(name: String, value: String) {
        synchronized(lock) {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
            val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
            val payload = ByteBuffer
                .allocate(1 + cipher.iv.size + encrypted.size)
                .put(FORMAT_VERSION)
                .put(cipher.iv)
                .put(encrypted)
                .array()

            directory.mkdirs()
            val target = fileFor(name)
            val temporary = File(directory, "${target.name}.tmp")
            FileOutputStream(temporary).use { output ->
                output.write(payload)
                output.fd.sync()
            }
            runCatching {
                Files.move(
                    temporary.toPath(),
                    target.toPath(),
                    StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING,
                )
            }.getOrElse {
                Files.move(temporary.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING)
            }
        }
    }

    override fun get(name: String): String? = synchronized(lock) {
        val file = fileFor(name)
        if (!file.isFile) return null

        runCatching {
            val payload = file.readBytes()
            require(payload.size > 1 + IV_SIZE_BYTES)
            require(payload[0] == FORMAT_VERSION)

            val iv = payload.copyOfRange(1, 1 + IV_SIZE_BYTES)
            val encrypted = payload.copyOfRange(1 + IV_SIZE_BYTES, payload.size)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, existingKey(), GCMParameterSpec(TAG_SIZE_BITS, iv))
            String(cipher.doFinal(encrypted), Charsets.UTF_8)
        }.getOrNull()
    }

    override fun remove(name: String) {
        synchronized(lock) {
            fileFor(name).delete()
        }
    }

    override fun clear() {
        synchronized(lock) {
            directory.listFiles()?.forEach(File::delete)
            keyStore().apply {
                if (containsAlias(KEY_ALIAS)) deleteEntry(KEY_ALIAS)
            }
        }
    }

    private fun fileFor(name: String): File {
        require(name.matches(SAFE_NAME)) { "Invalid secure-storage key" }
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(name.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        return File(directory, "$digest.bin")
    }

    private fun existingKey(): SecretKey {
        return keyStore().getKey(KEY_ALIAS, null) as? SecretKey
            ?: throw IllegalStateException("Secure-storage key is unavailable")
    }

    private fun getOrCreateKey(): SecretKey {
        runCatching { existingKey() }.getOrNull()?.let { return it }

        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
            .apply {
                init(
                    KeyGenParameterSpec.Builder(
                        KEY_ALIAS,
                        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                    )
                        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                        .setRandomizedEncryptionRequired(true)
                        .build(),
                )
            }
            .generateKey()
    }

    private fun keyStore(): KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val KEY_ALIAS = "buddie_mobile_secure_storage_v1"
        const val DIRECTORY_NAME = "secure"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_SIZE_BYTES = 12
        const val TAG_SIZE_BITS = 128
        val FORMAT_VERSION: Byte = 1
        val SAFE_NAME = Regex("[a-zA-Z0-9._-]{1,80}")
    }
}
