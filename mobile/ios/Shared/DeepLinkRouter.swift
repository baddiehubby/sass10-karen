import Foundation

enum DeepLinkDestination: String, Equatable {
    case open
    case oracle
    case settings
    case companion

    var webURL: URL {
        switch self {
        case .open, .companion:
            return URL(string: "https://www.buddieai.com/pwa")!
        case .oracle:
            return URL(string: "https://www.buddieai.com/dashboard/oracle")!
        case .settings:
            return URL(string: "https://www.buddieai.com/dashboard/settings")!
        }
    }
}

enum DeepLinkRouter {
    static func parse(_ url: URL) -> DeepLinkDestination? {
        guard
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            components.user == nil,
            components.password == nil,
            components.query == nil,
            components.fragment == nil
        else {
            return nil
        }

        switch components.scheme?.lowercased() {
        case "buddieai":
            guard components.port == nil, components.path.isEmpty else { return nil }
            return destination(for: components.host?.lowercased())
        case "https":
            guard
                components.host?.lowercased() == "www.buddieai.com",
                components.port == nil || components.port == 443
            else {
                return nil
            }
            switch normalizedPath(components.path) {
            case "/", "/pwa": return .open
            case "/dashboard/oracle": return .oracle
            case "/dashboard/settings": return .settings
            default: return nil
            }
        default:
            return nil
        }
    }

    private static func destination(for host: String?) -> DeepLinkDestination? {
        switch host {
        case "open": return .open
        case "oracle": return .oracle
        case "settings": return .settings
        case "companion": return .companion
        default: return nil
        }
    }

    private static func normalizedPath(_ path: String) -> String {
        guard path.count > 1, path.hasSuffix("/") else { return path.isEmpty ? "/" : path }
        return String(path.dropLast())
    }
}
