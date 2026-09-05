package com.buddieai.shadow.security

/**
 * Storage boundary for mobile credentials and other sensitive session material.
 * Implementations must never persist plaintext values.
 */
interface SecureStorage {
    fun put(name: String, value: String)
    fun get(name: String): String?
    fun remove(name: String)
    fun clear()
}
