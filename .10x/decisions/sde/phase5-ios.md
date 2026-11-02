# SDE — phase5-ios (built)
Commits on `feature/phase5-ios` from `b90ece9`: 7723ab5 poster removal · b986c5f native module/config/schema v10 · a6c26f2 integrations + Settings · 55b8572 YouTube · (docs commit).
New settings (defaults merge through `mergeSettings`): keepScreenAwake true, restNotificationsEnabled false, liveActivityEnabled true, healthExportEnabled false, healthExportSince null.
Rest countdown fix: a countdown noticed > 2 s late (app suspended) marks elapsed without the in-app chime (notification already fired).
Tech debt: Live Activity direction follows system locale; `expo-battery` low-power is always false on simulator; AXe simulator taps need `--tap-style physical`.
