# DevOps — transformation
**[DISCOVERED]** No CI, no `eas.json`, bundle id `com.gymrat.app`, empty entitlements, `supportsTablet: true`, `/ios` gitignored (prebuild output present locally; build succeeded), `.expo/` ignored.
## Plan
- M0: git baseline (done 2026-11-01). Optional GitHub Actions later: tsc + lint + jest on PR.
- M8: `eas.json` (development/preview/production), real bundle id/team (D5), `runtimeVersion` policy, `usesNonExemptEncryption: false`, `supportsTablet: false`, dev build on owner's iPhone.
- Phase 5: config plugins for expo-widgets, expo-notifications, healthkit, localization.
- Phase 6: production build → internal TestFlight group; rollback = previous build in TestFlight; DB migrations are forward-only with backup/restore on failure.
