import ActivityKit
import SwiftUI
import WidgetKit

private struct BuddyLiveActivityView: View {
    let context: ActivityViewContext<BuddyMoodAttributes>

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(buddyMoodColor(context.state.mood))
                .frame(width: 32, height: 32)
                .overlay {
                    Image(systemName: "heart.fill")
                        .font(.caption)
                        .foregroundStyle(.white)
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(context.state.companionName).font(.headline)
                Text("Feeling \(context.state.mood)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding()
        .activityBackgroundTint(Color(uiColor: .secondarySystemBackground))
        .activitySystemActionForegroundColor(.primary)
        .widgetURL(URL(string: "buddieai://open"))
    }
}

struct BuddyLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BuddyMoodAttributes.self) { context in
            BuddyLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Circle().fill(buddyMoodColor(context.state.mood))
                        .frame(width: 20, height: 20)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.mood.capitalized)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("\(context.state.companionName) is with you")
                        .font(.caption)
                }
            } compactLeading: {
                Circle().fill(buddyMoodColor(context.state.mood)).frame(width: 12, height: 12)
            } compactTrailing: {
                Text(context.state.mood.prefix(1).uppercased())
            } minimal: {
                Circle().fill(buddyMoodColor(context.state.mood)).frame(width: 10, height: 10)
            }
            .widgetURL(URL(string: "buddieai://open"))
            .keylineTint(buddyMoodColor(context.state.mood))
        }
    }
}

private func buddyMoodColor(_ mood: String) -> Color {
    switch mood.lowercased() {
    case "happy": return .orange
    case "concerned": return .red
    case "thinking": return .blue
    case "excited": return .pink
    case "sleepy": return .indigo
    default: return .purple
    }
}
