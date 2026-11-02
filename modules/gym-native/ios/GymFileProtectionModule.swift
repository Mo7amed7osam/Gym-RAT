import ExpoModulesCore
import Foundation

/// Applies an iOS Data Protection class to files the app already created.
/// The entitlement in app.json only covers files created after it ships, so
/// databases from earlier builds are upgraded here at boot.
public final class GymFileProtectionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GymFileProtection")

    /// Sets the class on the directory (new files inherit it) and every file in it.
    /// Returns the paths it changed.
    Function("protectDirectory") { (path: String, level: String) throws -> [String] in
      let directory = URL(fileURLWithPath: Self.plainPath(path))
      let protection = try Self.protectionType(level)
      let manager = FileManager.default
      guard manager.fileExists(atPath: directory.path) else { return [] }
      var changed: [String] = []
      try manager.setAttributes([.protectionKey: protection], ofItemAtPath: directory.path)
      changed.append(directory.path)
      for name in try manager.contentsOfDirectory(atPath: directory.path) {
        let file = directory.appendingPathComponent(name).path
        try manager.setAttributes([.protectionKey: protection], ofItemAtPath: file)
        changed.append(file)
      }
      return changed
    }

    /// The class recorded for a path, or null when the file system reports none.
    Function("protectionOf") { (path: String) -> String? in
      let attributes = try? FileManager.default.attributesOfItem(atPath: Self.plainPath(path))
      guard let value = attributes?[.protectionKey] as? FileProtectionType else { return nil }
      switch value {
      case .complete: return "complete"
      case .completeUnlessOpen: return "completeUnlessOpen"
      case .completeUntilFirstUserAuthentication: return "completeUntilFirstUserAuthentication"
      case .none: return "none"
      default: return value.rawValue
      }
    }
  }

  private static func plainPath(_ path: String) -> String {
    if path.hasPrefix("file://"), let url = URL(string: path) { return url.path }
    return path
  }

  private static func protectionType(_ level: String) throws -> FileProtectionType {
    switch level {
    case "complete": return .complete
    case "completeUnlessOpen": return .completeUnlessOpen
    case "completeUntilFirstUserAuthentication": return .completeUntilFirstUserAuthentication
    default: throw UnknownProtectionException()
    }
  }
}

final class UnknownProtectionException: Exception {
  override var reason: String { "Unknown file protection level" }
}
