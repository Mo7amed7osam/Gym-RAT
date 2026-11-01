# ADR-005: Runtime theme context and i18n layer

**Status:** Accepted (Phase 1 started 2026-11-01)
**Date:** 2026-11-01
**Feature:** transformation
**Author:** 10x-Team (Architect + Staff Engineer)

## Context
`constants/theme.ts` exports static colour consts consumed inside `StyleSheet.create` in ~15 files; `app.json` is dark-only. Spec §20 requires Light/Dark/System/True Black, accent colour, text size, density, and English/Arabic with RTL. Arabic strings exist only in data; no i18n layer; RTL never tested; Expo Go cannot test RTL.

## Decision
- `theme/`: tokens (seeded from existing values), `ThemeProvider`, `useTheme`, `useStyles(fn)` memoized per theme; lint rule bans raw colour literals in components. `userInterfaceStyle: "automatic"`.
- `i18n/`: `i18n-js` dictionaries EN/AR; `expo-localization` (`supportsRTL` default true); Expo Router `LocaleProvider`; in-app language switch via `I18nManager.allowRTL/forceRTL` + reload. Exercise names English-first with Arabic subtitle; Arabic-Indic input accepted; display digits per D8.
- Sets Logging UI keeps its layout; only token sources change.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| NativeWind / Tailwind | Fast theming | New styling paradigm across all screens; README chose StyleSheet deliberately | Larger rewrite, no benefit for a small app |
| Keep dark-only | Zero work | Violates spec | Spec |
| react-i18next | Popular | Heavier; Expo guide example uses i18n-js | Either works; keep lighter |

## Consequences
### Positive
- All appearance modes at runtime; one string source; RTL audit possible.
### Negative
- Touches every screen once (M5, M6); snapshot tests needed.
### Risks
- Visual regressions → per-screen per-theme snapshots; grid snapshot pinned.

## Dependencies
- ADR-002/003 land first so screens are migrated once (M5 after M4).
