# Architect — phase5-ios
ADR-013. Components: `services/{restAlerts,workoutActivity,healthExport,healthLedger,permissions,integrations}.ts`, `widgets/WorkoutActivity.tsx`, `modules/gym-native` (Swift), `components/{WorkoutKeepAwake,ExerciseVideo}.tsx`.
Boundaries: services read the workout store, never write it (except Settings toggles). Health reads history only; ledger lives in SQLite v10. Live Activity props carry no weights/reps/body data. Integrations attach after hydrate in `app/_layout.tsx`.
Failure modes: native unavailable → null module → no-op; permission denied → no-op + Settings message; ActivityKit start failure → no retries until the workout ends; Health write failure → retried on next history change or foreground.
