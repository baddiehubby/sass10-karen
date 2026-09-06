import ActivityKit
import Foundation

struct BuddyMoodAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var mood: String
        var companionName: String
        var updatedAt: Date
    }

    var companionName: String
    var startedAt: Date
}
