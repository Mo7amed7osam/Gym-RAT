# Security — transformation
## Threat model (light)
- Assets: workout history, body metrics, progress photos (sensitive), Health data.
- Threats: device loss (OS-level; no app lock by owner decision), WebView content injection via YouTube embed, malformed imported blob, third-party library supply chain.
## Controls
- Remove sync + bearer token code (M1) → no network credentials.
- WebView: load only `youtube.com/embed/<id>` with validated 11-char ids; no `javascriptEnabled` beyond player needs; no arbitrary URLs; Referer set per YouTube policy.
- Importer: validate shape with type guards; reject on failure without deleting original.
- Health: request only needed types; writes keyed by session id; handle denial.
- Photos: `FileSystem.documentDirectory` with app-private paths; excluded from any share/export (none exist).
- Dependencies: pin versions; `npx expo install`; review Nitro-based HealthKit before Phase 5.
- `NSAllowsArbitraryLoads` stays false (observed in Info.plist).
