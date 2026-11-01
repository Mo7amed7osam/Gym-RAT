# QA — phase4-analytics

Report: `reviews/2026-11-02-phase4-qa-report.md`.

## Strategy
- Pure domain modules: exhaustive unit tests (periods, totals, trends, muscles, progression, calendar, body, goals, edit, replay).
- Persistence: node:sqlite with the real schema, migrations and repositories; failure injection on the persist adapter.
- Screens: React Native Testing Library against the real stores.
- Dates: `scripts/test-timezones.sh` reruns date-sensitive suites under six TZ values (Jest cannot switch TZ mid-run).
- Device: dedicated simulator, seeded DB, AXe taps, Arabic RTL; DB inspected after each flow.

## Quality gates for merge
Jest + timezone script green, tsc 0, lint clean, migration-merge test green with Phase 3's real DDL, simulator re-run of edit/delete PR recompute after the strength engine is registered.

## Results
213/213 tests, 6/6 time zones, 9 defects found and fixed, open items listed in the report.
