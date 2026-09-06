import Foundation

struct MobileEntitlement: Codable, Equatable {
    let hasPaidAccess: Bool
    let plan: String
    let status: String
    let currentPeriodEnd: String?
    let subscriptionLabel: String?
}

struct MobileCompanion: Codable, Equatable {
    let companionName: String
    let personality: String
    let companionType: String
    let syncedAt: String
}

struct MobilePresence: Codable, Equatable {
    let currentMood: String
    let lastCheckIn: String
}

struct MobileSessionResponse: Codable, Equatable {
    let tokenType: String
    let refreshToken: String
    let refreshExpiresAt: Int64
    let entitlement: MobileEntitlement
    let companion: MobileCompanion
    let presence: MobilePresence?
}

struct MobileReaction: Codable, Equatable {
    let text: String
    let orbCue: String
    let mood: String
    let emotion: String
    let confidence: Double
    let confidenceBand: String
    let basis: String
    let source: String
    let timestamp: String
    let disclaimer: String
}

struct MobileReactionResponse: Codable, Equatable {
    let reaction: MobileReaction
}

struct AuthCallback: Equatable {
    let code: String
    let state: String

    static func parse(_ url: URL) -> AuthCallback? {
        guard
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            components.scheme?.lowercased() == "buddieai",
            components.host?.lowercased() == "auth",
            components.user == nil,
            components.password == nil,
            components.port == nil,
            components.path.isEmpty,
            components.query == nil,
            let fragment = components.fragment,
            let values = URLComponents(string: "https://callback.invalid/?\(fragment)")?.queryItems,
            values.count == 2,
            Set(values.map(\.name)) == Set(["code", "state"]),
            values.filter({ $0.name == "code" }).count == 1,
            values.filter({ $0.name == "state" }).count == 1,
            let code = values.first(where: { $0.name == "code" })?.value,
            let state = values.first(where: { $0.name == "state" })?.value,
            code.count >= 80,
            (32...128).contains(state.count)
        else {
            return nil
        }
        return AuthCallback(code: code, state: state)
    }
}
