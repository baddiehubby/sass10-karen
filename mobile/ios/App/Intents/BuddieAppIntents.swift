import AppIntents

struct OpenOracleIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Buddie Oracle"
    static let description = IntentDescription("Opens the signed-in Oracle experience.")

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(DeepLinkDestination.oracle.webURL))
    }
}

struct OpenCompanionIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Buddie Companion"
    static let description = IntentDescription("Opens your Buddie companion.")

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(DeepLinkDestination.companion.webURL))
    }
}

struct BuddieAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenOracleIntent(),
            phrases: ["Open Oracle in \(.applicationName)"],
            shortTitle: "Open Oracle",
            systemImageName: "sparkles"
        )
        AppShortcut(
            intent: OpenCompanionIntent(),
            phrases: ["Open my companion in \(.applicationName)"],
            shortTitle: "Open Companion",
            systemImageName: "heart.circle"
        )
    }
}
