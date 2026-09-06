import Foundation
import UserNotifications

@MainActor
final class NotificationManager: ObservableObject {
    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined

    func refreshAuthorizationStatus() async {
        authorizationStatus = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    func requestAuthorization() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        )
        await refreshAuthorizationStatus()
    }

    func scheduleLocalCheckIn(companionName: String) async throws {
        let content = UNMutableNotificationContent()
        content.title = "\(companionName) is here"
        content.body = "Open Buddie when you are ready for a check-in."
        content.sound = .default
        content.userInfo = ["destination": "buddieai://open"]

        let request = UNNotificationRequest(
            identifier: "buddie-local-check-in",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)
        )
        try await UNUserNotificationCenter.current().add(request)
    }
}
