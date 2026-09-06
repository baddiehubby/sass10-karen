import Foundation
import XCTest
@testable import Buddie

final class CryptoEncodingTests: XCTestCase {
    func testBase64URLHasNoPadding() {
        XCTAssertEqual(Base64URL.encode(Data([0xFB, 0xFF, 0xEF])), "-__v")
    }

    func testPKCEChallengeUsesSHA256Base64URL() {
        XCTAssertEqual(
            MobileProof.sha256Base64URL("abc"),
            "ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0"
        )
    }

    func testProofMessageMatchesBackendWireFormatExactly() {
        let message = MobileProof.message(
            purpose: "refresh",
            credential: "abc",
            timestamp: 1_725_000_000_123,
            nonce: "abcdefghijklmnop"
        )
        XCTAssertEqual(
            message,
            """
            buddie-mobile-proof-v1
            refresh
            ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0
            1725000000123
            abcdefghijklmnop
            """
        )
    }

    func testX963P256PointWrapsAsSPKI() throws {
        let x963 = Data([0x04] + Array(repeating: UInt8(0x11), count: 64))
        let spki = try P256SubjectPublicKeyInfo.wrap(x963: x963)
        XCTAssertEqual(spki.count, 91)
        XCTAssertEqual(spki.suffix(65), x963)
        XCTAssertEqual(Base64URL.encode(spki).count, 122)
    }

    func testSPKIRejectsCompressedPoint() {
        XCTAssertThrowsError(
            try P256SubjectPublicKeyInfo.wrap(
                x963: Data([0x02] + Array(repeating: UInt8(0x11), count: 32))
            )
        )
    }
}

final class DeepLinkRouterTests: XCTestCase {
    func testAllowsOnlyDocumentedDestinations() {
        XCTAssertEqual(DeepLinkRouter.parse(URL(string: "buddieai://open")!), .open)
        XCTAssertEqual(DeepLinkRouter.parse(URL(string: "buddieai://oracle")!), .oracle)
        XCTAssertEqual(
            DeepLinkRouter.parse(URL(string: "https://www.buddieai.com/dashboard/settings/")!),
            .settings
        )
    }

    func testRejectsParametersCredentialsPortsAndUnknownPaths() {
        [
            "buddieai://open?url=https://evil.example",
            "buddieai://user@open",
            "buddieai://open:123",
            "buddieai://open/path",
            "https://evil.example/pwa",
            "https://www.buddieai.com/dashboard/admin",
            "https://www.buddieai.com/pwa#fragment"
        ].forEach {
            XCTAssertNil(DeepLinkRouter.parse(URL(string: $0)!), $0)
        }
    }
}

final class AuthenticationStateTests: XCTestCase {
    func testAuthCallbackRequiresFragmentAndExactKeys() {
        let code = String(repeating: "c", count: 80)
        let state = String(repeating: "s", count: 43)
        XCTAssertEqual(
            AuthCallback.parse(URL(string: "buddieai://auth#code=\(code)&state=\(state)")!),
            AuthCallback(code: code, state: state)
        )
        XCTAssertNil(
            AuthCallback.parse(URL(string: "buddieai://auth?code=\(code)&state=\(state)")!)
        )
        XCTAssertNil(
            AuthCallback.parse(
                URL(string: "buddieai://auth#code=\(code)&state=\(state)&state=duplicate")!
            )
        )
    }

    func testEntitlementStateRoundTripsThroughSnapshot() throws {
        var snapshot = CompanionSnapshot.placeholder
        snapshot.entitlement = .unavailable
        snapshot.isOffline = true
        let encoded = try JSONEncoder().encode(snapshot)
        XCTAssertEqual(try JSONDecoder().decode(CompanionSnapshot.self, from: encoded), snapshot)
    }
}
