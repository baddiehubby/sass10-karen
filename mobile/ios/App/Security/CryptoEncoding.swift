import CryptoKit
import Foundation
import Security

enum CryptoEncodingError: Error, Equatable {
    case randomGenerationFailed(OSStatus)
    case invalidP256PublicKey
}

enum Base64URL {
    static func encode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func random(byteCount: Int) throws -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else {
            throw CryptoEncodingError.randomGenerationFailed(status)
        }
        return encode(Data(bytes))
    }
}

enum MobileProof {
    static func sha256Base64URL(_ value: String) -> String {
        Base64URL.encode(Data(SHA256.hash(data: Data(value.utf8))))
    }

    static func message(
        purpose: String,
        credential: String,
        timestamp: Int64,
        nonce: String
    ) -> String {
        [
            "buddie-mobile-proof-v1",
            purpose,
            sha256Base64URL(credential),
            String(timestamp),
            nonce
        ].joined(separator: "\n")
    }
}

enum P256SubjectPublicKeyInfo {
    // id-ecPublicKey + prime256v1, followed by a BIT STRING containing X9.63 04 || X || Y.
    private static let header = Data([
        0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE,
        0x3D, 0x02, 0x01, 0x06, 0x08, 0x2A, 0x86, 0x48, 0xCE, 0x3D,
        0x03, 0x01, 0x07, 0x03, 0x42, 0x00
    ])

    static func wrap(x963: Data) throws -> Data {
        guard x963.count == 65, x963.first == 0x04 else {
            throw CryptoEncodingError.invalidP256PublicKey
        }
        return header + x963
    }
}
