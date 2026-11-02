import ExpoModulesCore
import HealthKit

/// Writes finished workouts to Apple Health. Write-only: the app never asks to
/// read Health data. Every workout carries the session id as
/// `HKMetadataKeyExternalUUID`, so a re-export replaces instead of duplicating.
public final class GymHealthModule: Module {
  private lazy var store = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("GymHealth")

    Function("isAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    /// Sharing status for workouts: notDetermined | denied | authorized | unavailable.
    Function("authorizationStatus") { () -> String in
      guard HKHealthStore.isHealthDataAvailable() else { return "unavailable" }
      return Self.describe(self.store.authorizationStatus(for: HKObjectType.workoutType()))
    }

    AsyncFunction("requestAuthorization") { () async throws -> String in
      guard HKHealthStore.isHealthDataAvailable() else { return "unavailable" }
      try await self.store.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [])
      return Self.describe(self.store.authorizationStatus(for: HKObjectType.workoutType()))
    }

    /// Replaces any workout this app saved for `input.sessionId`, then saves one.
    /// Returns the new workout UUID and how many old copies were removed.
    AsyncFunction("saveWorkout") { (input: WorkoutInput) async throws -> [String: Any] in
      guard HKHealthStore.isHealthDataAvailable() else { throw HealthUnavailableException() }
      let removed = try await self.deleteWorkouts(sessionId: input.sessionId)

      let start = Date(timeIntervalSince1970: input.startMs / 1000)
      let end = Date(timeIntervalSince1970: input.endMs / 1000)
      guard end > start else { throw InvalidWorkoutException() }

      let configuration = HKWorkoutConfiguration()
      configuration.activityType = .traditionalStrengthTraining
      configuration.locationType = .indoor
      let builder = HKWorkoutBuilder(healthStore: self.store, configuration: configuration, device: .local())

      try await builder.beginCollection(at: start)
      var events: [HKWorkoutEvent] = []
      for pause in input.pauses {
        let from = Date(timeIntervalSince1970: pause.fromMs / 1000)
        let to = Date(timeIntervalSince1970: pause.toMs / 1000)
        guard from >= start, to <= end, to > from else { continue }
        events.append(HKWorkoutEvent(type: .pause, dateInterval: DateInterval(start: from, duration: 0), metadata: nil))
        events.append(HKWorkoutEvent(type: .resume, dateInterval: DateInterval(start: to, duration: 0), metadata: nil))
      }
      if !events.isEmpty {
        try await builder.addWorkoutEvents(events)
      }
      try await builder.addMetadata([
        HKMetadataKeyExternalUUID: input.sessionId,
        HKMetadataKeyIndoorWorkout: true,
      ])
      try await builder.endCollection(at: end)
      guard let workout = try await builder.finishWorkout() else { throw InvalidWorkoutException() }
      return ["uuid": workout.uuid.uuidString, "replaced": removed]
    }

    /// Removes every workout this app saved for the session. Returns the count.
    AsyncFunction("deleteWorkout") { (sessionId: String) async throws -> Int in
      guard HKHealthStore.isHealthDataAvailable() else { return 0 }
      return try await self.deleteWorkouts(sessionId: sessionId)
    }
  }

  private func deleteWorkouts(sessionId: String) async throws -> Int {
    let predicate = HKQuery.predicateForObjects(withMetadataKey: HKMetadataKeyExternalUUID, allowedValues: [sessionId])
    return try await withCheckedThrowingContinuation { continuation in
      self.store.deleteObjects(of: HKObjectType.workoutType(), predicate: predicate) { _, count, error in
        if let error = error as? HKError, error.code == .errorNoData {
          continuation.resume(returning: 0)
        } else if let error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume(returning: count)
        }
      }
    }
  }

  private static func describe(_ status: HKAuthorizationStatus) -> String {
    switch status {
    case .sharingAuthorized: return "authorized"
    case .sharingDenied: return "denied"
    case .notDetermined: return "notDetermined"
    @unknown default: return "notDetermined"
    }
  }
}

struct PauseInput: Record {
  @Field var fromMs: Double = 0
  @Field var toMs: Double = 0
}

struct WorkoutInput: Record {
  @Field var sessionId: String = ""
  @Field var startMs: Double = 0
  @Field var endMs: Double = 0
  @Field var pauses: [PauseInput] = []
}

final class HealthUnavailableException: Exception {
  override var reason: String { "Health data is not available on this device" }
}

final class InvalidWorkoutException: Exception {
  override var reason: String { "The workout has no valid time range" }
}
