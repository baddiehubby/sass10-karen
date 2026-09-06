package com.buddieai.shadow.auth

object DeviceNameSanitizer {
    private const val MAX_LENGTH = 64
    private val unsafe = Regex("[^\\p{L}\\p{N} ._()\\-]")
    private val whitespace = Regex("\\s+")

    fun sanitize(model: String?): String {
        val cleaned = model.orEmpty()
            .replace(whitespace, " ")
            .replace(unsafe, "")
            .replace(whitespace, " ")
            .trim()
            .take(MAX_LENGTH)
            .trim()
        return cleaned.ifBlank { "Android device" }
    }
}
