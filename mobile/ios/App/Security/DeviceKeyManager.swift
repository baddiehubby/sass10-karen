import Foundation
import Security

enum DeviceKeyError: LocalizedError {
    case keychain(OSStatus)
    case secureEnclaveUnavailable
    case publicKeyUnavailable
    case invalidPublicKey
    case signingFailed

    var errorDescription: String? {
        switch self {
        case .keychain(let status): return "Keychain error (\(status))."
        case .secureEnclaveUnavailable: return "This device cannot create the required Secure Enclave key."
        case .publicKeyUnavailable: return "The device public key is unavailable."
        case .invalidPublicKey: return "The device public key has an unexpected format."
        case .signingFailed: return "The device proof could not be signed."
        }
    }
}

final class DeviceKeyManager {
    private let tag = Data("com.buddieai.shadow.device-signing.v1".utf8)

    func publicKeySPKI() throws -> String {
        let privateKey = try key()
        guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
            throw DeviceKeyError.publicKeyUnavailable
        }
        var exportError: Unmanaged<CFError>?
        guard let representation = SecKeyCopyExternalRepresentation(publicKey, &exportError) else {
            if let error = exportError?.takeRetainedValue() { throw error }
            throw DeviceKeyError.publicKeyUnavailable
        }
        let x963 = representation as Data
        do {
            return Base64URL.encode(try P256SubjectPublicKeyInfo.wrap(x963: x963))
        } catch {
            throw DeviceKeyError.invalidPublicKey
        }
    }

    func sign(_ message: String) throws -> String {
        let algorithm = SecKeyAlgorithm.ecdsaSignatureMessageX962SHA256
        let privateKey = try key()
        guard SecKeyIsAlgorithmSupported(privateKey, .sign, algorithm) else {
            throw DeviceKeyError.signingFailed
        }
        var error: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(
            privateKey,
            algorithm,
            Data(message.utf8) as CFData,
            &error
        ) as Data? else {
            if let error = error?.takeRetainedValue() {
                throw error
            }
            throw DeviceKeyError.signingFailed
        }
        return Base64URL.encode(signature)
    }

    func delete() throws {
        let status = SecItemDelete([
            kSecClass: kSecClassKey,
            kSecAttrApplicationTag: tag,
            kSecAttrKeyType: kSecAttrKeyTypeECSECPrimeRandom
        ] as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw DeviceKeyError.keychain(status)
        }
    }

    private func key() throws -> SecKey {
        let query: [CFString: Any] = [
            kSecClass: kSecClassKey,
            kSecAttrApplicationTag: tag,
            kSecAttrKeyType: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef: true
        ]
        var existing: CFTypeRef?
        let existingStatus = SecItemCopyMatching(query as CFDictionary, &existing)
        if existingStatus == errSecSuccess {
            guard let existing else { throw DeviceKeyError.publicKeyUnavailable }
            return (existing as! SecKey)
        }
        guard existingStatus == errSecItemNotFound else {
            throw DeviceKeyError.keychain(existingStatus)
        }

        var accessError: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .privateKeyUsage,
            &accessError
        ) else {
            if let error = accessError?.takeRetainedValue() {
                throw error
            }
            throw DeviceKeyError.secureEnclaveUnavailable
        }

        let attributes: [CFString: Any] = [
            kSecAttrKeyType: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits: 256,
            kSecAttrTokenID: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs: [
                kSecAttrIsPermanent: true,
                kSecAttrApplicationTag: tag,
                kSecAttrAccessControl: access
            ]
        ]
        var generationError: Unmanaged<CFError>?
        guard let generated = SecKeyCreateRandomKey(attributes as CFDictionary, &generationError) else {
            if let error = generationError?.takeRetainedValue() {
                throw error
            }
            throw DeviceKeyError.secureEnclaveUnavailable
        }
        return generated
    }
}
