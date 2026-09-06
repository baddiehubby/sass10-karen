import AuthenticationServices
import UIKit

enum WebAuthenticationError: LocalizedError {
    case couldNotStart
    case missingCallback

    var errorDescription: String? {
        switch self {
        case .couldNotStart: return "The secure sign-in session could not start."
        case .missingCallback: return "Sign-in did not return a valid callback."
        }
    }
}

@MainActor
final class WebAuthenticationClient: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var authenticationSession: ASWebAuthenticationSession?

    func authenticate(at url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: "buddieai"
            ) { [weak self] callbackURL, error in
                self?.authenticationSession = nil
                if let error {
                    continuation.resume(throwing: error)
                } else if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(throwing: WebAuthenticationError.missingCallback)
                }
            }
            session.presentationContextProvider = self
            // Keep the normal Safari-authenticated web identity available for
            // Oracle/PWA handoff while never exposing its HTTP-only cookie to
            // the native app.
            session.prefersEphemeralWebBrowserSession = false
            authenticationSession = session
            guard session.start() else {
                authenticationSession = nil
                continuation.resume(throwing: WebAuthenticationError.couldNotStart)
                return
            }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}
