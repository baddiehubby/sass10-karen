import SwiftUI

@main
struct BuddieApp: App {
    @StateObject private var auth = AuthManager()
    @StateObject private var notifications = NotificationManager()
    @StateObject private var liveActivity = LiveActivityManager()

    var body: some Scene {
        WindowGroup {
            CompanionView()
                .environmentObject(auth)
                .environmentObject(notifications)
                .environmentObject(liveActivity)
        }
    }
}

private struct CompanionView: View {
    @Environment(\.openURL) private var openURL
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var notifications: NotificationManager
    @EnvironmentObject private var liveActivity: LiveActivityManager

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    companionCard
                    if let message = auth.message {
                        Label(message, systemImage: "info.circle")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    accountActions
                    if auth.state == .active || auth.state == .offline {
                        companionActions
                    }
                }
                .padding()
            }
            .navigationTitle("Buddie")
            .refreshable { await auth.refresh() }
            .task {
                await notifications.refreshAuthorizationStatus()
                await auth.refresh()
            }
            .onOpenURL { url in
                guard let destination = DeepLinkRouter.parse(url) else { return }
                openURL(destination.webURL)
            }
            .onChange(of: auth.snapshot) { snapshot in
                Task { await liveActivity.update(snapshot: snapshot) }
            }
        }
    }

    private var companionCard: some View {
        VStack(spacing: 12) {
            Circle()
                .fill(moodColor(auth.snapshot.mood).gradient)
                .frame(width: 84, height: 84)
                .overlay {
                    Image(systemName: "face.smiling")
                        .font(.system(size: 34))
                        .foregroundStyle(.white)
                }
            Text(auth.snapshot.companionName)
                .font(.title2.bold())
            Text(auth.snapshot.mood.capitalized)
                .foregroundStyle(.secondary)
            Label(stateLabel, systemImage: stateIcon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(stateColor)
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 24))
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var accountActions: some View {
        switch auth.state {
        case .signedOut, .expired:
            Button {
                Task { await auth.signIn() }
            } label: {
                Label("Sign in securely", systemImage: "person.badge.key")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
        case .connecting:
            ProgressView("Connecting securely…")
                .frame(maxWidth: .infinity)
        case .active, .offline, .entitlementUnavailable:
            Button("Refresh from server") {
                Task { await auth.refresh() }
            }
            .buttonStyle(.bordered)
            Button("Sign out", role: .destructive) {
                Task { await auth.logout() }
            }
        }
    }

    private var companionActions: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Companion surfaces").font(.headline)
            Text("How are you feeling?")
                .font(.subheadline.weight(.semibold))
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 88))], spacing: 8) {
                ForEach(["calm", "happy", "excited", "sad", "tired", "playful"], id: \.self) { mood in
                    Button(mood.capitalized) {
                        Task { await auth.react(to: mood) }
                    }
                    .buttonStyle(.bordered)
                    .disabled(auth.reacting)
                }
            }
            Text("Your selection is sent to Buddie's shared intelligence. It is not a diagnosis.")
                .font(.caption)
                .foregroundStyle(.secondary)

            Button {
                openURL(DeepLinkDestination.oracle.webURL)
            } label: {
                Label("Open Oracle", systemImage: "sparkles")
            }

            if liveActivity.isRunning {
                Button("End Live Activity", role: .destructive) {
                    Task { await liveActivity.end() }
                }
            } else {
                Button {
                    liveActivity.start(snapshot: auth.snapshot)
                } label: {
                    Label("Start Live Activity", systemImage: "waveform.circle")
                }
            }

            if notifications.authorizationStatus == .authorized ||
                notifications.authorizationStatus == .provisional
            {
                Button("Schedule a local check-in") {
                    Task {
                        try? await notifications.scheduleLocalCheckIn(
                            companionName: auth.snapshot.companionName
                        )
                    }
                }
            } else {
                Button("Enable notifications") {
                    Task { await notifications.requestAuthorization() }
                }
            }

            if let error = liveActivity.errorMessage {
                Text(error).font(.footnote).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
    }

    private var stateLabel: String {
        switch auth.state {
        case .signedOut: return "Signed out"
        case .connecting: return "Connecting"
        case .active: return "Access confirmed by server"
        case .offline: return "Offline · last synced state"
        case .entitlementUnavailable: return "Access unavailable"
        case .expired: return "Session expired"
        }
    }

    private var stateIcon: String {
        switch auth.state {
        case .active: return "checkmark.seal.fill"
        case .offline: return "wifi.slash"
        case .connecting: return "arrow.triangle.2.circlepath"
        case .expired, .entitlementUnavailable: return "exclamationmark.triangle.fill"
        case .signedOut: return "person.crop.circle.badge.xmark"
        }
    }

    private var stateColor: Color {
        switch auth.state {
        case .active: return .green
        case .offline: return .orange
        case .expired, .entitlementUnavailable: return .red
        default: return .secondary
        }
    }

    private func moodColor(_ mood: String) -> Color {
        switch mood.lowercased() {
        case "happy": return .orange
        case "concerned": return .red
        case "thinking": return .blue
        case "excited": return .pink
        case "sleepy": return .indigo
        default: return .purple
        }
    }
}
