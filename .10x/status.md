# Gym RAT — Project Status

**Feature slug:** `transformation` (existing app → premium offline-first iOS workout tracker)
**Spec:** `specs/2026-11-01-gym-rat-transformation-design.md` (Master Plan v3)
**Admin dashboard split (2026-11-03):** `feature/admin-dashboard-split` (worktree `../Gym RAT-admin-split`, ADR-018), based on `main @ 866dd27` (tag `backup/main-before-admin-split`). New `admin/` app (Vercel-ready, not deployed); VPS API gains exact-origin CORS/CSRF (`ADMIN_ORIGIN`); old VPS dashboard removed; open redirect and Dockerfile `public/` fixed. Verified locally across two origins (36/36 browser checks). Not merged, not pushed, not deployed.

**Phase 7 (2026-11-02):** private members platform on `feature/phase7-private-auth @ 3fb949c` (worktree `../Gym RAT-phase7`, ADR-015/016). Implemented and verified; not merged. Report `reviews/2026-11-02-phase7-report.md`. IPA blocked on the owner accepting Apple's updated PLA.

**Current phase:** Integration complete — Phase 3 + Phase 4 merged into `main` at `e510460` (2026-11-02; ADR-012; report `reviews/2026-11-02-integration-report.md`). Phase 5 / TestFlight need explicit authorization. Phase 3 (Smart Training) authorized by owner 2026-11-02 and implemented (W1–W6, commits `644cd30`…`cd19cc9`; report `reviews/2026-11-02-phase3-report.md`, 168 tests). Phase 2 authorized 2026-11-01 and implemented (W1–W7, commits after `e2466f7`). Phase 1 authorized by owner ("start", 2026-11-01). ADR-001…009 Accepted (ADR-006: extracted program is an ordinary template; schema v3). **Phase 1 complete; Phase 2 implemented and simulator-verified 2026-11-01 (report: reviews/2026-11-01-phase2-report.md, 133 tests).** Simulator verification run 2026-11-01 (owner chose simulator over a physical iPhone): kill test 10/10, rotation advance/repeat, pause, Arabic RTL, theme, Reset All Data, reboot all passed; two defects found and fixed (Library search focus, dialog label truncation). Physical-device rows still pending. Awaiting (Appendix D checklist in reviews/2026-11-01-phase1-report.md) and independent review before Phase 2.

## Phase tracking

| 10x phase | State | Notes |
|---|---|---|
| 0 Brainstorm / spec | Done | Owner brief + independent review + Master Plan v3 |
| 1 Strategy | Done | `decisions/cto/`, `decisions/product-manager/` |
| 2 Design | Done (Proposed) | ADR-001…005; `decisions/architect/`, `decisions/staff-engineer/` |
| 3 Planning | Done for Phase 1 | M0–M8 in `decisions/engineering-manager/`, approach in `decisions/senior-engineer/` |
| 4 Implementation | Phase 1–4 done; Phase 3 + Phase 4 integrated (schema v9, one strength engine; ADR-012) | Phase 5 / TestFlight need explicit approval |
| 5 Verification | Partial | Jest 168/168; simulator: Phase 1/2 checklists + Phase 3 coach/chip/apply/PR toast; owner checklist in the Phase 3 report; physical iPhone never run |
| 6 Delivery | Not started | |

## Owner decisions still open (block or shape Phase 1)
- D3 Confirm owner-vs-tester interpretation (approved program ships as selectable template). Needed by M7.
- D5 **Membership confirmed by owner 2026-11-01** (paid, team 8TBB6SU34J found in Xcode). Bundle id still `com.gymrat.app` (assumption; register or change before TestFlight). EAS CLI on this Mac is logged in as a different person's account — owner must log in themselves before any EAS step.
- D6 Any real on-device data to preserve? Default: none.
- D4 Program questionnaire + illustration mapping. Needed before M4 completes.
- Defaults assumed unless overridden: D2 yes (RepDB metadata with attribution), D7 NORMAL, D8 full Arabic UI + Western digits for weights/reps, D9 leave OS backup, D10 drop web, D11 owner approves video list.

## Phase 1 milestone board (product Phase 1 = 10x Phase 4 iteration 1)

| M | Title | Status |
|---|---|---|
| M0 | Git + Jest harness + baseline tests | **Done** — 41 tests, 96% stmts / 99% lines on the 4 target modules; tsc/lint clean |
| M1 | Remove sync/server; persist v3 | **Done** |
| M2 | Remove cool-down + weightIncrementKg | **Done** |
| M3 | SQLite behind store facade + importer | **Done** (Jest proves commit-before-apply, boot/reset against a real SQLite file; simulator boot verified; physical tap-and-kill test pending owner, see reviews/2026-11-01-device-verification.md) |
| M4 | Plan/rotation + session reducer | **Done** (Starter content = draft pending D4) |
| M5 | Theme system | **Done** |
| M6 | Localization + RTL | **Done** (RTL verified on simulator) |
| M7 | Four tabs + onboarding | **Done** (onboarding verified on a fresh simulator install) |
| M8 | Reset All Data + eas.json + dev build | **Done** (simulator build verified; device-signed Release build: see reviews/2026-11-01-device-verification.md) |

## Quality baseline (measured 2026-11-01)
`npx tsc --noEmit` 0 errors · `npx expo lint` clean · `npx expo-doctor` 20/20 · local iOS build succeeded (`.expo/xcodebuild.log`) · no tests · never run on a physical device (README).

---
## Phase 4 — Progress & Analytics (parallel track, branch `feature/phase4-analytics`)
**Authorized:** owner brief 2026-11-02 (parallel with Phase 3 on another instance). Base `6319c60`. Worktree `../Gym RAT-phase4`.
**ADR:** 011 (renumbered at integration; was 010 on the branch). **Slug:** `phase4-analytics`.
| Task | Status |
|---|---|
| Design + plan (ADR-010, architect, staff, EM, senior) | Done |
| A1 analytics core | Done (`56c3842`) |
| A2 history edit + replay | Done (`56c3842`) |
| A3 progression + calendar | Done (`56c3842`) |
| A4 schema v7 + progress store | Done (`73f05eb`) |
| A5 body + goals | Done (`73f05eb`) |
| A6 Progress tab | Done (`42394fe`) |
| A7 sub-screens | Done (`42394fe`) |
| A8 verification | Done on the branch: Jest 223/223, 6 time zones, tsc 0, lint clean; simulator tap-through in Arabic RTL; QA + security reviews (`reviews/2026-11-02-phase4-*`) |
| Integration readiness | Handoff `specs/2026-11-02-phase4-phase3-integration-handoff.md`; integrated on `integration/phase3-phase4` (`reviews/2026-11-02-integration-report.md`) |

---
## Phase 5 — iOS Integrations (branch `feature/phase5-ios`, base `b90ece9`)
**Authorized:** owner brief 2026-11-02. ADR-013. Slug `phase5-ios`. **Merged into main 2026-11-02** (`--no-ff`, branch tip `ed724ed`; owner-requested). Phase 6 handoff: `specs/2026-11-02-phase6-handoff.md`.
| Item | Status |
|---|---|
| Licensing: Neila Rey poster removed | Done (`7723ab5`); **reversed by owner change**: restored for dev/internal builds, stubbed out of store builds (see report) |
| Native module, iOS config, schema v10 | Done (`b986c5f`) |
| Rest alerts, Live Activity, Health export, keep-awake, haptics, Settings | Done (`a6c26f2`) |
| YouTube player + verified ids (35/38) | Done (`55b8572`) |
| Verification | Jest 296/296, tsc 0, lint clean, simulator build + flows; report `reviews/2026-11-02-phase5-report.md` |
| Poster restored (dev/internal only, store-stubbed) | Done (`ed724ed`) |
| Merge + verification on main | Jest 297/297, 4 snapshots, tsc 0, lint clean, store export without poster |
| Physical iPhone | Not run |
Owner decisions open: backup inclusion (keep recommended), D11 video list, EAS login + App ID capabilities. Poster rights. Phase 6 / TestFlight not authorized.

---
## Phase 6 — Release readiness (branch `release/phase6`, base `a51141c`)
**Authorized:** owner brief 2026-11-02. ADR-014. Slug `phase6-release`. Not merged. Report: `reviews/2026-11-02-phase6-release-readiness.md`.
| Item | Status |
|---|---|
| Native config reproducible, prebuild, expo-doctor 20/20 | Done (`823bfb8`) |
| Poster fail-safe exclusion (ADR-014) | Done (`823bfb8`); EAS artifact check pending |
| D8 digits/units, e1RM unification, records formatting, grouping | Done (`b15b457`, `a2228b0`, `895dd5b`) |
| Photo file protection, rest-alert dismissal defect | Done (`d2790d8`, `1f86723`) |
| Release simulator build + lifecycle | Done (4 builds; Live Activity visuals unverified) |
| Physical iPhone | Not run |
| TestFlight | **NO-GO** — see report blockers |

**2026-11-02 — Phase 6 merged into main** (`4a65663`, `--no-ff`, `release/phase6` kept); main re-verified (Jest 308/308, tsc, lint, doctor 20/20, Release simulator build) and its `ios/` regenerated. Final release fixes on `release/phase6-fixes` (not merged): YouTube link compliance, starter "(draft)" removed, media audit (25/38), RPE/RIR entry, Dynamic Type chrome cap, giant-set multi-select, UI-language exercise names, Arabic plurals/terminology, VoiceOver context labels. Report: `reviews/2026-11-02-phase6-final-fixes.md`. TestFlight still NO-GO.

**2026-11-02 — `release/phase6-fixes` merged into main** (owner-approved, `--no-ff` merge `4df003c`; branch kept; pre-merge main tagged `backup/main-before-phase6-fixes` = `4a65663`). Verified on merged main: Jest 36 suites / 318 tests, 4/4 protected snapshots, tsc 0, lint clean, expo-doctor 20/20, Release simulator build (poster check passed in-build and by hand), production and preview `expo export` contain no poster, a 500-session pre-fix database upgraded with the starter renamed and plans/rotation/history unchanged. TestFlight NO-GO; no EAS command run.

---
## Phase 7 — Private members platform (branch `feature/phase7-private-auth`, base `4a65663`)
**Authorized:** owner brief 2026-11-02 (execute without stopping). ADR-015, ADR-016. Slug `phase7-private-auth`. Not merged. Report: `reviews/2026-11-02-phase7-report.md`.
| Item | Status |
|---|---|
| App: login / forgot / legacy claim, session manager, lease, per-account SQLite, Settings account | Done (`603d946`, `3fb949c`) |
| Server: schema + migration, auth API, admin API, TOTP, rate limits, audit | Done (`64f4b3c`) |
| Admin dashboard + public pages + Docker/Caddy/backups | Done (`e39542a`) |
| Tests | Jest 345/345 (+37), Vitest 30/30, tsc ×2, lint ×2, doctor 20/20, Next build |
| Release simulator build / unsigned archive | Done |
| Signed archive / IPA | Blocked: Apple PLA must be accepted by the owner (`release-artifacts/archive-signed.log`) |
| Physical iPhone | Not run |

**2026-11-03 — Phase 7 + Egyptian Arabic integrated into main** (`7079715`, `--no-ff` of `integration/phase7-l10n`; pre-merge main tagged `backup/main-before-phase7-integration` = `7d34a49`; `feature/phase7-private-auth`, `l10n/egyptian-arabic` kept). Owner decisions applied: device backup kept, email-only invitations over configurable SMTP (ADR-017). Verified on main: app Jest 41 suites / 360 tests, 4 protected snapshots, tsc, lint, expo-doctor 20/20, server Vitest 35/35 + tsc + eslint, Release simulator build (poster check passed). Not deployed; no invitations sent; no EAS; no TestFlight.
