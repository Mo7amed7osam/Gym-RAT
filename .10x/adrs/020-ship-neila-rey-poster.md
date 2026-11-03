# ADR-020: The Neila Rey warm-up poster ships in every build

**Status:** Accepted (owner decision)
**Date:** 2026-11-03
**Feature:** testflight-release
**Supersedes:** ADR-014 (for the Neila Rey poster only; the guard mechanism stays)

## Context
ADR-014 kept the Neila Rey pre-workout stretching poster (`assets/exercises/stretches/pre_workout_stretches.jpg`, "© Neila Rey" printed on the artwork) out of every Release build because its redistribution rights were unverified. On 2026-11-03 the owner decided the poster must remain in Gym RAT in Development **and** Release builds, including TestFlight, with unchanged placement and quality.

## Decision
- `assets/exercises/index.ts` requires the poster unconditionally (the `__DEV__` gate is removed).
- `metro.config.js` no longer swaps the module for a stub; `assets/exercises/index.store.ts` is deleted; `eas.json` no longer sets `GYMRAT_STORE_BUILD`.
- The poster's hash is removed from `assets/exercises/UNLICENSED.sha1`. The list, `scripts/release/check-unlicensed-assets.sh` and the `withUnlicensedAssetGuard` Release build phase stay in place for any future asset.
- `__tests__/phase5.licensing.test.ts` now asserts the poster is bundled in every build and that the guard still blocks a listed asset.

## Licensing status — unresolved
Owner approval to include the poster is **not** evidence of a licence. No written permission, licence text or terms of use from Neila Rey has been recorded in this repository. Distributing the poster through TestFlight or the App Store therefore carries copyright risk (App Store guideline 5.2.1 intellectual property; a takedown or rejection is possible). The owner accepts this risk. If permission is obtained, store it under `assets/exercises/LICENSES/` and reference it here.

## Consequences
- Release, TestFlight and App Store builds contain the poster; testers see the same warm-up screen as development builds.
- The Release guard passes with the poster present; it would still fail on any hash added to `UNLICENSED.sha1`.
- Reverting is one gate in `index.ts` plus one line back in `UNLICENSED.sha1`.
