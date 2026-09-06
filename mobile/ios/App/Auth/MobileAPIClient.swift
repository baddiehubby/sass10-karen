import Foundation

enum MobileAPIError: LocalizedError, Equatable {
    case offline
    case unauthorized
    case entitlementUnavailable
    case server(Int)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .offline: return "You appear to be offline. Showing the last synced companion state."
        case .unauthorized: return "Your Buddie session has expired. Sign in again."
        case .entitlementUnavailable: return "The server could not confirm companion access."
        case .server(let status): return "Buddie is temporarily unavailable (\(status))."
        case .invalidResponse: return "Buddie returned an invalid response."
        }
    }
}

final class MobileAPIClient {
    private let endpoint = URL(string: "https://www.buddieai.com/api/licenses/widget-credential/mobile")!
    private let keys: DeviceKeyManager
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(keys: DeviceKeyManager, session: URLSession? = nil) {
        self.keys = keys
        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.timeoutIntervalForRequest = 15
            configuration.timeoutIntervalForResource = 30
            configuration.waitsForConnectivity = false
            configuration.httpCookieStorage = nil
            configuration.httpShouldSetCookies = false
            configuration.urlCache = nil
            self.session = URLSession(configuration: configuration)
        }
    }

    func exchange(code: String, verifier: String, state: String) async throws -> MobileSessionResponse {
        let proof = try makeProof(purpose: "exchange", credential: code)
        return try await execute(ExchangeRequest(
            action: "exchange",
            code: code,
            verifier: verifier,
            state: state,
            timestamp: proof.timestamp,
            nonce: proof.nonce,
            proof: proof.signature
        ))
    }

    func refresh(_ refreshToken: String) async throws -> MobileSessionResponse {
        let proof = try makeProof(purpose: "refresh", credential: refreshToken)
        return try await execute(TokenRequest(
            action: "refresh",
            refreshToken: refreshToken,
            timestamp: proof.timestamp,
            nonce: proof.nonce,
            proof: proof.signature
        ))
    }

    func react(to mood: String, refreshToken: String) async throws -> MobileReaction {
        let proof = try makeProof(purpose: "context", credential: refreshToken)
        let response: MobileReactionResponse = try await execute(ContextRequest(
            action: "context",
            refreshToken: refreshToken,
            context: .init(source: "explicit_mood", mood: mood),
            timestamp: proof.timestamp,
            nonce: proof.nonce,
            proof: proof.signature
        ))
        return response.reaction
    }

    func prepareLogout(_ refreshToken: String) throws -> URLRequest {
        let proof = try makeProof(purpose: "logout", credential: refreshToken)
        return try makeRequest(TokenRequest(
            action: "logout",
            refreshToken: refreshToken,
            timestamp: proof.timestamp,
            nonce: proof.nonce,
            proof: proof.signature
        ))
    }

    func sendLogout(_ request: URLRequest) async throws {
        _ = try await send(request)
    }

    private func makeProof(purpose: String, credential: String) throws
        -> (timestamp: Int64, nonce: String, signature: String)
    {
        let timestamp = Int64((Date().timeIntervalSince1970 * 1_000).rounded(.down))
        let nonce = try Base64URL.random(byteCount: 24)
        let message = MobileProof.message(
            purpose: purpose,
            credential: credential,
            timestamp: timestamp,
            nonce: nonce
        )
        return (timestamp, nonce, try keys.sign(message))
    }

    private func execute<Request: Encodable, Response: Decodable>(
        _ body: Request
    ) async throws -> Response {
        let data = try await send(body)
        guard let response = try? decoder.decode(Response.self, from: data) else {
            throw MobileAPIError.invalidResponse
        }
        return response
    }

    private func send<Request: Encodable>(_ body: Request) async throws -> Data {
        try await send(makeRequest(body))
    }

    private func makeRequest<Request: Encodable>(_ body: Request) throws -> URLRequest {
        var request = URLRequest(url: endpoint, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData)
        request.httpMethod = "POST"
        request.httpBody = try encoder.encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        return request
    }

    private func send(_ request: URLRequest) async throws -> Data {
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw MobileAPIError.invalidResponse
            }
            switch http.statusCode {
            case 200..<300: return data
            case 401: throw MobileAPIError.unauthorized
            case 403: throw MobileAPIError.entitlementUnavailable
            default: throw MobileAPIError.server(http.statusCode)
            }
        } catch let error as MobileAPIError {
            throw error
        } catch let error as URLError where [
            .notConnectedToInternet, .networkConnectionLost, .cannotConnectToHost,
            .cannotFindHost, .dnsLookupFailed, .timedOut
        ].contains(error.code) {
            throw MobileAPIError.offline
        } catch {
            throw MobileAPIError.invalidResponse
        }
    }
}

private struct ExchangeRequest: Encodable {
    let action: String
    let code: String
    let verifier: String
    let state: String
    let timestamp: Int64
    let nonce: String
    let proof: String
}

private struct TokenRequest: Encodable {
    let action: String
    let refreshToken: String
    let timestamp: Int64
    let nonce: String
    let proof: String
}

private struct ContextRequest: Encodable {
    struct Context: Encodable {
        let source: String
        let mood: String
    }

    let action: String
    let refreshToken: String
    let context: Context
    let timestamp: Int64
    let nonce: String
    let proof: String
}
