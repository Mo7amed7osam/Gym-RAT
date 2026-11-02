# Simulator log excerpts (GymRAT-Phase6, iPhone 16 Pro, iOS 26.3, Release build, 2026-11-02)

## Rest alert BEFORE fix: delivered 14:07:55.2, deleted 0.57 s later (app still alive in background)
```
2026-11-02 14:07:55.071 Df SpringBoard[69163:52fbd3] [com.apple.UserNotifications:DataStore] [com.gymrat.app] Saving notification 0DFB-A060: YES [ hasAlertContent: YES, shouldPresentAlert: Y
2026-11-02 14:07:55.522 Df SpringBoard[69163:52fbd3] [com.apple.usernotificationsd:NotificationsPipeline] [delete, [id=0DFB-A060, time=2026-11-02 12:07:55, bundle=com.gymrat.app], Time elaps
2026-11-02 14:07:55.526 Df SpringBoard[69163:52ffd4] [com.apple.UserNotifications:DataStore] [com.gymrat.app] Saving notification 0DFB-A060: YES [ hasAlertContent: YES, shouldPresentAlert: Y
2026-11-02 14:07:55.599 Df SpringBoard[69163:52fdeb] [com.apple.usernotificationsd:Spotlight] Finished index: added=[com.gymrat.app:rest-complete], deleted=[], success=true
2026-11-02 14:07:55.774 Df SpringBoard[69163:53001b] [com.apple.usernotificationsd:NotificationsPipeline] [delete, [id=0DFB-A060, time=2026-11-02 12:07:55, bundle=com.gymrat.app], Time elaps
2026-11-02 14:07:55.775 Df SpringBoard[69163:53001b] [com.apple.usernotificationsd:NotificationsPipeline] [delete, [id=0DFB-A060, time=2026-11-02 12:07:55, bundle=com.gymrat.app], Time elaps
```

## Rest alert AFTER fix (build 3): saved 14:15:04, nothing deleted
```
2026-11-02 14:15:04.074 Df SpringBoard[69163:536f21] [com.apple.UserNotifications:DataStore] [com.gymrat.app] Saving notification 0DFB-A060: YES [ hasAlertContent: YES, shouldPresentAlert: Y
2026-11-02 14:15:04.126 Df SpringBoard[69163:5372e4] [com.apple.usernotificationsd:Spotlight] Finished index: added=[com.gymrat.app:rest-complete], deleted=[], success=true
2026-11-02 14:15:04.192 Df SpringBoard[69163:536d58] [com.apple.UserNotifications:DataStore] [com.gymrat.app] Saving notification 0DFB-A060: YES [ hasAlertContent: YES, shouldPresentAlert: Y
```

## Live Activity 9B876198: one activity across kill/relaunch; dismissed on finish (14:11)
```
2026-11-02 14:11:12.878 Df chronod[69240:531873] [com.apple.activitykit:outputClient] Activity dismissed: 9B876198-F56C-4131-8788-225E346E2AD6
2026-11-02 14:11:12.879 Df SpringBoard[69163:532f05] [com.apple.activitykit:outputClient] Activity dismissed: 9B876198-F56C-4131-8788-225E346E2AD6
2026-11-02 14:11:12.881 Df SpringBoard[69163:5326ba] [com.apple.activitykit:outputClient] Sending activity changes: ["9B876198-F56C-4131-8788-225E346E2AD6": ActivityKit.SubscribedActivity(id
2026-11-02 14:11:12.881 Df chronod[69240:5309cc] [com.apple.activitykit:outputClient] Sending activity changes: ["9B876198-F56C-4131-8788-225E346E2AD6": ActivityKit.SubscribedActivity(identi
2026-11-02 14:11:12.884 Df SpringBoard[69163:532f04] [com.apple.activitykit:alert] Activity 9B876198-F56C-4131-8788-225E346E2AD6 has been dismissed, deleting any buffered alert
```
