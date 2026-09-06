import Foundation
import Security

struct StoredSession: Codable, Equatable {
    let refreshToken: String
    let refreshExpiresAt: Int64
}

enum KeychainSessionError: Error {
    case encoding
    case keychain(OSStatus)
    case invalidData
}

final class KeychainSessionStore {
    private let service = "com.buddieai.shadow.mobile-session"
    private let account = "device-bound-refresh-v1"

    func load() throws -> StoredSession? {
        var result: CFTypeRef?
        let status = SecItemCopyMatching(baseQuery(returnsData: true) as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw KeychainSessionError.keychain(status) }
        guard
            let data = result as? Data,
            let session = try? JSONDecoder().decode(StoredSession.self, from: data)
        else {
            throw KeychainSessionError.invalidData
        }
        return session
    }

    func save(_ session: StoredSession) throws {
        guard let data = try? JSONEncoder().encode(session) else {
            throw KeychainSessionError.encoding
        }
        let add: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecAttrAccessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecValueData: data
        ]
        let status = SecItemAdd(add as CFDictionary, nil)
        if status == errSecDuplicateItem {
            let updateStatus = SecItemUpdate(
                baseQuery(returnsData: false) as CFDictionary,
                [kSecValueData: data] as CFDictionary
            )
            guard updateStatus == errSecSuccess else {
                throw KeychainSessionError.keychain(updateStatus)
            }
        } else if status != errSecSuccess {
            throw KeychainSessionError.keychain(status)
        }
    }

    func clear() throws {
        let status = SecItemDelete(baseQuery(returnsData: false) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainSessionError.keychain(status)
        }
    }

    private func baseQuery(returnsData: Bool) -> [CFString: Any] {
        var query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account
        ]
        if returnsData {
            query[kSecReturnData] = true
            query[kSecMatchLimit] = kSecMatchLimitOne
        }
        return query
    }
}
