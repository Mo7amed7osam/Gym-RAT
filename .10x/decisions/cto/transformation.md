# CTO — transformation
**[DISCOVERED]** Stack: Expo SDK 58.0.22, RN 0.88.1, React 19.3, Expo Router, Zustand 5 + persist, AsyncStorage, reanimated 4.7, react-native-svg, lucide icons, expo-haptics/audio/web-browser, Barlow Condensed. Optional Fastify + Postgres sync server in `server/`. Not a git repo (until baseline commit 2026-11-01). No tests. No EAS config.

## Verdict
- Build (not buy): no off-the-shelf app meets local-only + rotation + Arabic + owner's UI. Incremental migration, not rewrite: codebase is small, strict, clean, and the Sets Logging UI must be preserved.
- Media: static illustrations (RepDB free tier, exact matches) + embedded YouTube. Animation initiative cancelled by owner (ADR-004).
- Cloud: removed (ADR-001).
- Release target: private TestFlight; paid Apple Developer membership required (verified). Owner decision D5 pending.

## Strategic risks
- Scope (30+ feature areas) vs single-owner review bandwidth → strict phase gates.
- Illustration coverage gaps for exercises without exact RepDB match → resolved during program selection.
