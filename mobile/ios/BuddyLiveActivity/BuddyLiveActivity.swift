import ActivityKit
import SwiftUI
import WidgetKit

struct BuddyMoodAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var mood: String
        var companionName: String
    }

    var companionName: String
}

struct BuddyLiveActivityView: View {
    let context: ActivityViewContext<BuddyMoodAttributes>

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(moodColor(context.state.mood))
                .frame(width: 28, height: 28)
            VStack(alignment: .leading) {
                Text(context.attributes.companionName)
                    .font(.headline)
                Text("Feeling \(context.state.mood)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }

    func moodColor(_ mood: String) -> Color {
        switch mood {
        case "happy": return .orange
        case "concerned": return .red
        case "thinking": return .blue
        case "excited": return .pink
        case "sleepy": return .indigo
        default: return .purple
        }
    }
}

@main
struct BuddyLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        BuddyLiveActivityWidget()
    }
}

struct BuddyLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BuddyMoodAttributes.self) { context in
            BuddyLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Circle().fill(BuddyLiveActivityView(context: context).moodColor(context.state.mood))
                        .frame(width: 20, height: 20)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.mood.capitalized)
                }
            } compactLeading: {
                Circle().fill(Color.purple).frame(width: 12, height: 12)
            } compactTrailing: {
                Text(context.state.mood.prefix(1).uppercased())
            } minimal: {
                Circle().fill(Color.purple).frame(width: 10, height: 10)
            }
        }
    }
}
