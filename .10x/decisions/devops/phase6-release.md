# DevOps — phase6-release
- CNG verified reproducible: main checkout's ios/ had no hand customizations (diff vs fresh prebuild). Regenerated with prebuild --clean in the Phase 6 worktree; main checkout's ios/ left for after the merge (PID 30742 attached).
- expo-widgets bundle id and App Group pinned in app.json; expo-dev-client installed for the development profiles; expo-doctor 20/20.
- Release builds run plugins/withUnlicensedAssetGuard.js (ADR-014); eas.json preview + production set GYMRAT_STORE_BUILD=1.
- Owner gates before any cloud build: own Expo login (official flow, own terminal), project link (owner/projectId), App IDs com.gymrat.app + com.gymrat.app.ExpoWidgetsTarget with HealthKit + App Groups (group.com.gymrat.app) in the confirmed team. No paid/distributable build without owner approval; never submit without explicit approval.
