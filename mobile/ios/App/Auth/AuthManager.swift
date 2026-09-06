import AuthenticationServices
import Foundation
import UIKit
import WidgetKit

@MainActor
final class AuthManager: ObservableObject {
    enum State: Equatable {
        case signedOut
        case connecting
        case active
        case offline
        case entitlementUnavailable
        case expired
    }

    @Published private(set) var state: State = .signedOut
    @Published private(set) var snapshot: CompanionSnapshot = CompanionSnapshotStore.load()
    @Published private(set) var message: String?
    @Published private(set) var reacting = false

    private let keys: DeviceKeyManager
    private let sessionStore: KeychainSessionStore
    private let webAuthentication: WebAuthenticationClient
    private let api: MobileAPIClient
    private var generation = 0
    private var refreshInFlight = false

    init(
        keys: DeviceKeyManager = DeviceKeyManager(),
        sessionStore: KeychainSessionStore = KeychainSessionStore(),
        webAuthentication: WebAuthenticationClient = WebAuthenticationClient()
    ) {
        self.keys = keys
        self.sessionStore = sessionStore
        self.webAuthentication = webAuthentication
        self.api = MobileAPIClient(keys: keys)

        guard let stored = try? sessionStore.load() else { return }
        if stored.refreshExpiresAt <= Self.nowMilliseconds {
            try? sessionStore.clear()
            snapshot.entitlement = .expired
            state = .expired
            persistSnapshot()
        } else {
            let withinGrace =
                snapshot.entitlement == .active &&
                snapshot.entitlementConfirmedAt.map {
                    Date().timeIntervalSince($0) <= Self.offlineGraceSeconds
                } == true
            snapshot.isOffline = true
            state = withinGrace ? .offline : .entitlementUnavailable
            CompanionSnapshotStore.save(snapshot)
        }
    }

    func signIn() async {
        generation += 1
        let requestGeneration = generation
        state = .connecting
        message = nil

        do {
            let verifier = try Base64URL.random(byteCount: 64)
            let stateValue = try Base64URL.random(byteCount: 32)
            let publicKey = try keys.publicKeySPKI()
            var components = URLComponents(string: "https://www.buddieai.com/mobile/connect")!
            components.queryItems = [
                URLQueryItem(name: "code_challenge", value: MobileProof.sha256Base64URL(verifier)),
                URLQueryItem(name: "state", value: stateValue),
                URLQueryItem(name: "device_key", value: publicKey),
                URLQueryItem(name: "platform", value: "ios"),
                URLQueryItem(name: "device_name", value: UIDevice.current.model),
                URLQueryItem(
                    name: "app_version",
                    value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
                )
            ]
            guard let connectURL = components.url else { throw MobileAPIError.invalidResponse }
            let callbackURL = try await webAuthentication.authenticate(at: connectURL)
            guard
                let callback = AuthCallback.parse(callbackURL),
                constantTimeEqual(callback.state, stateValue)
            else {
                throw MobileAPIError.unauthorized
            }
            let response = try await api.exchange(
                code: callback.code,
                verifier: verifier,
                state: callback.state
            )
            guard generation == requestGeneration else { return }
            try accept(response)
        } catch let error as ASWebAuthenticationSessionError
            where error.code == .canceledLogin
        {
            guard generation == requestGeneration else { return }
            state = .signedOut
        } catch {
            guard generation == requestGeneration else { return }
            handle(error)
        }
    }

    func refresh() async {
        guard !refreshInFlight, !reacting else { return }
        refreshInFlight = true
        defer { refreshInFlight = false }
        guard let stored = try? sessionStore.load() else {
            state = .signedOut
            return
        }
        guard stored.refreshExpiresAt > Self.nowMilliseconds else {
            expireSession()
            return
        }
        let requestGeneration = generation
        do {
            let response = try await api.refresh(stored.refreshToken)
            guard generation == requestGeneration else { return }
            try accept(response)
        } catch {
            guard generation == requestGeneration else { return }
            handle(error)
        }
    }

    func react(to mood: String) async {
        guard !reacting, !refreshInFlight, state == .active || state == .offline else { return }
        guard let stored = try? sessionStore.load() else {
            state = .signedOut
            return
        }
        reacting = true
        defer { reacting = false }
        let requestGeneration = generation
        do {
            let reaction = try await api.react(to: mood, refreshToken: stored.refreshToken)
            guard generation == requestGeneration else { return }
            snapshot.mood = reaction.mood
            snapshot.lastReaction = reaction.text
            snapshot.isOffline = false
            message = reaction.text
            state = .active
            persistSnapshot()
        } catch {
            guard generation == requestGeneration else { return }
            handle(error)
        }
    }

    func logout() async {
        generation += 1
        let stored = try? sessionStore.load()
        let revocationRequest: URLRequest?
        if let token = stored?.refreshToken {
            revocationRequest = try? api.prepareLogout(token)
        } else {
            revocationRequest = nil
        }
        try? sessionStore.clear()
        try? keys.delete()
        snapshot = .placeholder
        state = .signedOut
        message = nil
        persistSnapshot()
        if let request = revocationRequest {
            try? await api.sendLogout(request)
        }
    }

    private func accept(_ response: MobileSessionResponse) throws {
        guard
            response.tokenType == "Device-Bound",
            response.refreshExpiresAt > Self.nowMilliseconds,
            response.entitlement.hasPaidAccess
        else {
            throw MobileAPIError.entitlementUnavailable
        }
        try sessionStore.save(StoredSession(
            refreshToken: response.refreshToken,
            refreshExpiresAt: response.refreshExpiresAt
        ))
        snapshot = CompanionSnapshot(
            companionName: response.companion.companionName,
            personality: response.companion.personality,
            mood: response.presence?.currentMood ?? snapshot.mood,
            lastReaction: snapshot.lastReaction,
            entitlement: .active,
            plan: response.entitlement.plan,
            status: response.entitlement.status,
            updatedAt: Date(),
            entitlementConfirmedAt: Date(),
            isOffline: false
        )
        state = .active
        message = nil
        persistSnapshot()
    }

    private func handle(_ error: Error) {
        message = (error as? LocalizedError)?.errorDescription ?? "Something went wrong."
        guard let apiError = error as? MobileAPIError else {
            state = (try? sessionStore.load()) == nil ? .signedOut : .entitlementUnavailable
            return
        }
        switch apiError {
        case .offline:
            snapshot.isOffline = true
            let withinGrace =
                snapshot.entitlement == .active &&
                snapshot.entitlementConfirmedAt.map {
                    Date().timeIntervalSince($0) <= Self.offlineGraceSeconds
                } == true
            if !withinGrace {
                snapshot.entitlement = .unavailable
            }
            state = withinGrace ? .offline : .entitlementUnavailable
            persistSnapshot()
        case .unauthorized:
            expireSession()
        case .entitlementUnavailable:
            snapshot.entitlement = .unavailable
            snapshot.isOffline = false
            state = .entitlementUnavailable
            persistSnapshot()
        default:
            if (try? sessionStore.load()) == nil {
                state = .signedOut
            } else {
                state = snapshot.entitlement == .active ? .active : .entitlementUnavailable
            }
        }
    }

    private func expireSession() {
        try? sessionStore.clear()
        snapshot.entitlement = .expired
        snapshot.isOffline = false
        state = .expired
        persistSnapshot()
    }

    private func persistSnapshot() {
        snapshot.updatedAt = Date()
        CompanionSnapshotStore.save(snapshot)
        WidgetCenter.shared.reloadAllTimelines()
    }

    private func constantTimeEqual(_ lhs: String, _ rhs: String) -> Bool {
        let left = Array(lhs.utf8)
        let right = Array(rhs.utf8)
        guard left.count == right.count else { return false }
        return zip(left, right).reduce(UInt8(0)) { $0 | ($1.0 ^ $1.1) } == 0
    }

    private static var nowMilliseconds: Int64 {
        Int64((Date().timeIntervalSince1970 * 1_000).rounded(.down))
    }

    private static let offlineGraceSeconds: TimeInterval = 24 * 60 * 60
}
