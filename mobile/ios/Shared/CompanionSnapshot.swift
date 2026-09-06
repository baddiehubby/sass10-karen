import Foundation

enum ServerEntitlementState: String, Codable, CaseIterable {
    case signedOut
    case active
    case unavailable
    case expired
}

struct CompanionSnapshot: Codable, Equatable {
    static let appGroup = "group.com.buddieai.shadow"
    static let storageKey = "companion_snapshot_v1"

    var companionName: String
    var personality: String
    var mood: String
    var lastReaction: String?
    var entitlement: ServerEntitlementState
    var plan: String
    var status: String
    var updatedAt: Date
    var entitlementConfirmedAt: Date?
    var isOffline: Bool

    static let placeholder = CompanionSnapshot(
        companionName: "Buddie",
        personality: "calm",
        mood: "thinking",
        lastReaction: nil,
        entitlement: .signedOut,
        plan: "free",
        status: "signed_out",
        updatedAt: .distantPast,
        entitlementConfirmedAt: nil,
        isOffline: false
    )
}

enum CompanionSnapshotStore {
    static func load(defaults: UserDefaults? = UserDefaults(suiteName: CompanionSnapshot.appGroup)) -> CompanionSnapshot {
        guard
            let data = defaults?.data(forKey: CompanionSnapshot.storageKey),
            let snapshot = try? JSONDecoder().decode(CompanionSnapshot.self, from: data)
        else {
            return .placeholder
        }
        return snapshot
    }

    @discardableResult
    static func save(
        _ snapshot: CompanionSnapshot,
        defaults: UserDefaults? = UserDefaults(suiteName: CompanionSnapshot.appGroup)
    ) -> Bool {
        guard let data = try? JSONEncoder().encode(snapshot), let defaults else { return false }
        defaults.set(data, forKey: CompanionSnapshot.storageKey)
        return defaults.synchronize()
    }
}
