# Senior Engineer — transformation: implementation approach per milestone
- **M0:** `jest-expo` preset; tests colocated in `__tests__/`. Trap: `expo-crypto` `randomUUID` in store — mock in tests.
- **M1:** Delete files; remove `useSyncQueue` import in `app/_layout.tsx:49`; persist `version: 3`, `migrate` drops `syncQueue`; keep `merge` deep-merging settings. Trap: `SettingsScreen` imports `isSyncConfigured`.
- **M2:** Remove `STAGES` cooldown entry and the `stage === 'cooldown'` branches; `WarmupRoutine` keeps `cooldown` variant code deleted or retained only for stretch data reuse (prefer delete; keep `data/warmupData.ts` routines). Remove `WARMUP_COOLDOWN_SECONDS` → warm-up estimate only.
- **M3:** `src/data/db/schema.sql` + `migrations/`; `openDatabaseSync` if verified else `openDatabaseAsync` at boot before splash hide (hook into `useStoreHydrated`). Repository functions sync. Keep Zustand action signatures identical so `ExerciseCard`/`SetRow` compile unchanged. Importer runs once on first open after migration. Trap: `expo-sqlite` in Jest — use `better-sqlite3` with the same SQL strings; keep SQL in `.sql`/const files shared by both.
- **M4:** Reducer first with tests, then wire. Map `routineId` → reference plan day ids in the importer. Today hero reads `plans.next_day_index`. Week strip → calendar query. Replace Saturday constants with `settings.week_start`.
- **M5:** `useStyles((t) => StyleSheet.create({...}))` memoized by theme id; migrate files mechanically; add lint rule for hex/rgba literals in `src/`.
- **M6:** Extract strings file-by-file; `LocaleProvider`; language switch triggers `Updates.reloadAsync` (dev build). RTL review per screen; numerals policy D8.
- **M7:** Tabs + placeholders; onboarding routes under `app/onboarding/`; flag in settings table.
- **M8:** Reset = close DB, delete file, clear settings, clear sandbox media dir, navigate to onboarding. `eas.json` profiles; `runtimeVersion: { policy: 'appVersion' }` or fingerprint per docs.
