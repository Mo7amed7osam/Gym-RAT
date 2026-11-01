# DevOps — transformation
**[DISCOVERED]** No CI, no `eas.json`, bundle id `com.gymrat.app`, empty entitlements, `supportsTablet: true`, `/ios` gitignored (prebuild output present locally; build succeeded), `.expo/` ignored.
## Plan
- M0: git baseline (done 2026-11-01). Optional GitHub Actions later: tsc + lint + jest on PR.
- M8: `eas.json` (development/preview/production), real bundle id/team (D5), `runtimeVersion` policy, `usesNonExemptEncryption: false`, `supportsTablet: false`, dev build on owner's iPhone.
- Phase 5: config plugins for expo-widgets, expo-notifications, healthkit, localization.
- Phase 6: production build → internal TestFlight group; rollback = previous build in TestFlight; DB migrations are forward-only with backup/restore on failure.

## M8 (2026-11-01)
`eas.json` profiles: `development` (dev client, simulator), `development-device` (dev client, device — needs D5), `preview` (internal distribution), `production` (store, auto-increment build number). `runtimeVersion` policy `appVersion`. `usesNonExemptEncryption: false` set so TestFlight does not stall on compliance. CNG: `ios/` regenerated with `npx expo prebuild --platform ios` whenever config plugins change (done for expo-sqlite, userInterfaceStyle, expo-localization). No EAS login/project id yet (`eas init` needs the owner's Expo account) — blocker list in status.md.

## 2026-11-01 — Device signing (D5 partially resolved)
- Apple team `8TBB6SU34J` ("Mohammed Hosam", paid Individual) set via `ios.appleTeamId`; prebuild writes `DEVELOPMENT_TEAM`. Development certificate + wildcard team profile on this Mac sign offline; no Apple login prompt needed for local device builds.
- Device builds use the **Release** configuration signed with the development certificate (embedded bundle, no Metro); the project has no `expo-dev-client`. First build succeeded; install blocked until Developer Mode is enabled on the iPhone. Details and checklist: `reviews/2026-11-01-device-verification.md`.
- EAS CLI on this Mac is logged in as a different person's account; not used. Owner logs in with their own account before any EAS/TestFlight step. Bundle id `com.gymrat.app` kept as an assumption until App Store Connect registration.
