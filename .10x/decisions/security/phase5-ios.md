# Security — phase5-ios
See `reviews/2026-11-02-phase5-report.md` §Permissions and privacy. Permissions: notifications (alert+sound, no badge), HealthKit share for workouts only (no read). No push entitlement, no network except YouTube when the user taps play. Owner decision pending: iCloud/device backup inclusion (left default).


## 2026-11-02 — Neila Rey poster (owner change)
Owner directed the poster restored for development and internal testing only. Rights to redistribute are still unverified, so `metro.config.js` resolves `assets/exercises/index.ts` to `index.store.ts` (no image) when `EAS_BUILD_PROFILE=production` or `GYMRAT_STORE_BUILD=1`. Verified by `expo export` (store/production bundles contain no JPEG) and `__tests__/phase5.licensing.test.ts`. Residual risk: a local Xcode archive built without `GYMRAT_STORE_BUILD=1` would include it — Phase 6 release checklist must use the production profile.
