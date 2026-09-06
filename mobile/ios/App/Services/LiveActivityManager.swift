import ActivityKit
import Foundation

@MainActor
final class LiveActivityManager: ObservableObject {
    @Published private(set) var isRunning = false
    @Published private(set) var errorMessage: String?

    init() {
        isRunning = !Activity<BuddyMoodAttributes>.activities.isEmpty
    }

    /// Called only from an explicit user action in the host app.
    func start(snapshot: CompanionSnapshot) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            errorMessage = "Live Activities are disabled in system settings."
            return
        }
        guard Activity<BuddyMoodAttributes>.activities.isEmpty else {
            isRunning = true
            return
        }
        do {
            _ = try Activity.request(
                attributes: BuddyMoodAttributes(
                    companionName: snapshot.companionName,
                    startedAt: Date()
                ),
                contentState: BuddyMoodAttributes.ContentState(
                    mood: snapshot.mood,
                    companionName: snapshot.companionName,
                    updatedAt: Date()
                ),
                pushType: nil
            )
            isRunning = true
            errorMessage = nil
        } catch {
            errorMessage = "The Live Activity could not be started."
        }
    }

    func update(snapshot: CompanionSnapshot) async {
        let state = BuddyMoodAttributes.ContentState(
            mood: snapshot.mood,
            companionName: snapshot.companionName,
            updatedAt: Date()
        )
        for activity in Activity<BuddyMoodAttributes>.activities {
            await activity.update(using: state)
        }
        isRunning = !Activity<BuddyMoodAttributes>.activities.isEmpty
    }

    func end() async {
        for activity in Activity<BuddyMoodAttributes>.activities {
            await activity.end(using: activity.contentState, dismissalPolicy: .default)
        }
        isRunning = false
    }
}
