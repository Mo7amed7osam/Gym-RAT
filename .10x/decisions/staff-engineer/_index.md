# Staff Engineer — Index
## Standards (observed + adopted)
- TypeScript strict, no `any`; `@/` path alias; `StyleSheet` + tokens (moving to `useStyles`).
- Selectors return stable references (no `useShallow` needed) — keep.
- Timestamp-based timers; never tick in the store — keep.
- Accessibility roles/labels on every control — keep.
- Expo APIs: consult versioned docs (v58) before use; never from memory.
- One concern per module; `domain/` has no RN imports.
## Active features
- [transformation](transformation.md)
- [phase4-analytics](phase4-analytics.md)
- [phase7-private-auth](phase7-private-auth.md) — Phase 7 private members platform (ADR-015, ADR-016)
