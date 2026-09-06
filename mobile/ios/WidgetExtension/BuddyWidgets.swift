import ActivityKit
import SwiftUI
import WidgetKit

@main
struct BuddyWidgetBundle: WidgetBundle {
    var body: some Widget {
        BuddyHomeWidget()
        BuddyLockWidget()
        BuddyLiveActivityWidget()
    }
}

private struct BuddyEntry: TimelineEntry {
    let date: Date
    let snapshot: CompanionSnapshot
}

private struct BuddyTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> BuddyEntry {
        BuddyEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (BuddyEntry) -> Void) {
        completion(BuddyEntry(date: Date(), snapshot: CompanionSnapshotStore.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BuddyEntry>) -> Void) {
        let entry = BuddyEntry(date: Date(), snapshot: CompanionSnapshotStore.load())
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
    }
}

private struct BuddyHomeWidget: Widget {
    let kind = "BuddyHomeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BuddyTimelineProvider()) { entry in
            HomeWidgetView(entry: entry)
                .widgetURL(URL(string: "buddieai://open"))
        }
        .configurationDisplayName("Buddie Companion")
        .description("See the last server-synced companion mood.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

private struct HomeWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: BuddyEntry

    var body: some View {
        widgetBackground {
            HStack(spacing: 12) {
                Circle()
                    .fill(moodColor(entry.snapshot.mood).gradient)
                    .frame(width: family == .systemSmall ? 46 : 58)
                    .overlay {
                        Image(systemName: "face.smiling")
                            .foregroundStyle(.white)
                    }
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.snapshot.companionName)
                        .font(.headline)
                        .lineLimit(1)
                    Text(entry.snapshot.mood.capitalized)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if family == .systemMedium {
                        Text(statusText(entry.snapshot))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }

    @ViewBuilder
    private func widgetBackground<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        if #available(iOS 17.0, *) {
            content()
                .containerBackground(.fill.tertiary, for: .widget)
        } else {
            content()
                .padding()
                .background(Color(uiColor: .secondarySystemBackground))
        }
    }
}

private struct BuddyLockWidget: Widget {
    let kind = "BuddyLockWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BuddyTimelineProvider()) { entry in
            LockWidgetView(entry: entry)
                .widgetURL(URL(string: "buddieai://open"))
        }
        .configurationDisplayName("Buddie at a Glance")
        .description("A compact Lock Screen companion status.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

private struct LockWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: BuddyEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            Gauge(value: moodGauge(entry.snapshot.mood)) {
                Image(systemName: "heart.fill")
            }
            .gaugeStyle(.accessoryCircular)
        case .accessoryInline:
            Label(
                "\(entry.snapshot.companionName): \(entry.snapshot.mood.capitalized)",
                systemImage: "heart.fill"
            )
        default:
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.snapshot.companionName).font(.headline)
                Text("\(entry.snapshot.mood.capitalized) · \(statusText(entry.snapshot))")
                    .font(.caption)
                    .lineLimit(1)
            }
        }
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

private func moodGauge(_ mood: String) -> Double {
    switch mood.lowercased() {
    case "happy", "excited": return 0.9
    case "thinking": return 0.65
    case "sleepy": return 0.4
    case "concerned": return 0.25
    default: return 0.5
    }
}

private func statusText(_ snapshot: CompanionSnapshot) -> String {
    if snapshot.isOffline { return "Offline · last synced" }
    switch snapshot.entitlement {
    case .active: return "Access confirmed"
    case .unavailable: return "Access unavailable"
    case .expired: return "Session expired"
    case .signedOut: return "Sign in to sync"
    }
}
