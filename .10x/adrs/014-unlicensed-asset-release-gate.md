# ADR-014: Media without verified rights never reaches a distributable build

**Status:** Superseded by ADR-020 for the Neila Rey poster (2026-11-03, owner decision: the poster ships in every build). The guard script and build phase remain for other assets.
**Date:** 2026-11-02
**Feature:** phase6-release
**Author:** 10x-Team (Architect + DevOps + Security)

## Context
The owner wants the Neila Rey pre-workout stretching poster kept for development and internal local testing, but excluded from TestFlight, the App Store and any other externally distributed build (preview included) until redistribution rights are verified. The Phase 6 brief adds: exclusion must be fail-safe for every distributable profile, must not rely only on a remembered environment variable, must be proven on the compiled bundle and packaged assets, and distribution must stop if it cannot be proven.

The Phase 5 approach (a Metro resolver stub keyed on `EAS_BUILD_PROFILE=production` / `GYMRAT_STORE_BUILD`) failed the brief: a `preview` build and any local Release archive shipped the poster.

## Decision
Three independent layers; any one of them is enough to keep the poster out.

1. **Bundle mode (primary).** `assets/exercises/index.ts` requires the image only under `__DEV__`. Metro inlines `__DEV__` and constant-folds before collecting dependencies (`metro-transform-worker`), so every release bundle (any EAS profile, any local Release/Archive) has no reference to the image and never packages it. Only development bundles served by Metro include it.
2. **Profile/flag (secondary).** `metro.config.js` resolves the poster module to `index.store.ts` (no image) for every EAS profile except `development` / `development-device`, and whenever `GYMRAT_STORE_BUILD=1`; `eas.json` sets that flag on `preview` and `production`.
3. **Product check (stop).** The config plugin `plugins/withUnlicensedAssetGuard.js` adds a final build phase to the app target that runs `scripts/release/check-unlicensed-assets.sh` on every Release build and fails it if the product contains any file listed in `assets/exercises/UNLICENSED.sha1`, matched by SHA-1 (any name/extension) and by file name. The same script checks an `.ipa` or export directory by hand.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Env-var Metro stub only (Phase 5) | Small | Preview and local Archive builds shipped the poster; depends on an env var reaching Metro | Failed the brief |
| Remove the poster entirely | Simplest, no legal risk | Owner explicitly wants it for development/testing | Owner decision |
| Separate dev-only asset folder excluded via `assetBundlePatterns` | Declarative | Does not affect Metro `require()` bundling; easy to bypass | Not effective for required assets |
| EAS `eas-build-on-success` hook inspecting the artifact | Checks the real IPA | Artifact paths not documented for this SDK; runs after the binary exists; not run for local builds | Build-phase check covers local and EAS builds and fails earlier |

## Consequences
### Positive
- No Release build of any kind can contain the poster without three separate mechanisms failing.
- Adding another unlicensed asset is one line in `UNLICENSED.sha1` plus a `__DEV__` gate.
### Negative
- Internal testers on a Release/preview build never see the poster; only dev-client (Debug) builds do.
- The guard runs a full-product hash on every Release build (seconds).
### Risks
- If the build phase is removed from the plugin list, layers 1–2 still hold; `__tests__/phase5.licensing.test.ts` fails if the plugin is unregistered, the gate changes, or the list loses the poster hash.
- Not yet run on EAS (no EAS build authorized); the first EAS artifact must be checked with the script.

## Dependencies
- ADR-004 (static media), ADR-013 (Phase 5 config plugins).
- Owner: rights decision; when rights are documented, delete the hash line and the `__DEV__` gate in one reviewed commit.
