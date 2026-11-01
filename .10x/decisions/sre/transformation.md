# SRE — transformation
## SLOs (app-level)
- Zero lost logged sets across kill tests (10/10).
- Crash-free workout sessions on tester devices; any crash during an active session = P0.
- Cold start < 1.5 s; 60 fps on history/library lists.
## Monitoring
- No telemetry by default (local-only). Option for Phase 6: opt-in crash reporting via EAS Insights/Sentry — owner decision; default off.
- In-app diagnostics screen (Settings → About): DB integrity result, schema version, last backup time, media coverage count.
## Runbook (owner)
- Data looks wrong → Settings → About → integrity check; restore last backup prompt.
- Migration halted → app shows non-destructive error; collect `migrations/backup-v*.db` via Finder (Files app sharing disabled by default; enable `UIFileSharingEnabled` only for debug builds).
- Reset All Data = last resort; documented in tester notes.
