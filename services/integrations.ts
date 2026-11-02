import * as Notifications from 'expo-notifications';
import type { LiveActivity, LiveActivityFactory } from 'expo-widgets';
import { AppState, Platform } from 'react-native';

import { translate } from '@/i18n';
import { GymHealth } from '@/modules/gym-native';
import { useWorkoutStore, type WorkoutStore } from '@/store/useWorkoutStore';

import { HealthExporter, type HealthAdapter, type HealthLedger } from './healthExport';
import { healthLedger } from './healthLedger';
import { REST_NOTIFICATION_ID, RestAlertController, restAlertTime, type RestAlertAdapter } from './restAlerts';
import { WorkoutActivityController, workoutActivityProps, type ActivityText, type WorkoutActivityAdapter, type WorkoutActivityProps } from './workoutActivity';

/**
 * Wires the iOS side effects to the workout store (ADR-013): rest alert,
 * Live Activity and Apple Health export. Each follows the store; none can
 * block or fail a workout action. Attached once, after the store hydrates.
 */

const REST_SOUND = 'rest-complete.wav';

const restAlertAdapter: RestAlertAdapter = {
  async schedule(at, content) {
    const sound = useWorkoutStore.getState().settings.restSoundEnabled ? REST_SOUND : false;
    await Notifications.scheduleNotificationAsync({
      identifier: REST_NOTIFICATION_ID,
      content: { title: content.title, body: content.body, sound },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  },
  async cancel() {
    await Notifications.cancelScheduledNotificationAsync(REST_NOTIFICATION_ID);
    await Notifications.dismissNotificationAsync(REST_NOTIFICATION_ID).catch(() => undefined);
  },
};

function liveActivityAdapter(): WorkoutActivityAdapter {
  // Loaded on first use so the widget layout never runs outside iOS.
  const factory = () => require('@/widgets/WorkoutActivity').default as LiveActivityFactory<WorkoutActivityProps>;
  const wrap = (instance: LiveActivity<WorkoutActivityProps>) => ({
    update: (props: WorkoutActivityProps, staleDate?: Date) => instance.update(props, staleDate),
    end: () => instance.end('immediate'),
  });
  return {
    existing: () => factory().getInstances().map(wrap),
    start: (props, staleDate) => wrap(factory().start(props, 'gymrat://workout', staleDate)),
  };
}

function activityText(state: WorkoutStore): ActivityText {
  const names = new Map(state.exercises.map((exercise) => [exercise.id, exercise.name.en]));
  return {
    title: (session) => session.code || translate('ios.activity.workout'),
    exerciseName: (id) => names.get(id) ?? '',
    setOf: (n, total) => translate('ios.activity.setOf', { n, total }),
    done: translate('ios.activity.done'),
    labels: {
      rest: translate('ios.activity.rest'),
      restOver: translate('ios.activity.restOver'),
      paused: translate('ios.activity.paused'),
      workout: translate('ios.activity.workout'),
    },
  };
}

const activityProps = (state: WorkoutStore) =>
  state.settings.liveActivityEnabled ? workoutActivityProps(state.activeSession, state.restTimer, activityText(state)) : null;

export interface IntegrationDeps {
  restAlerts: RestAlertAdapter;
  activity: WorkoutActivityAdapter;
  /** Null when the Health module is missing (simulator without the module, web, tests). */
  health: HealthAdapter | null;
  ledger: HealthLedger;
  now?: () => number;
}

export interface IntegrationHandles {
  restAlerts: RestAlertController;
  activity: WorkoutActivityController;
  health: HealthExporter | null;
  /** Re-syncs everything (the app calls this when it returns to the foreground). */
  resync: () => void;
  detach: () => void;
}

/** Subscribes the three controllers to the workout store. Exported for tests. */
export function connectIntegrations(deps: IntegrationDeps): IntegrationHandles {
  const now = deps.now ?? Date.now;
  const restAlerts = new RestAlertController(deps.restAlerts, () => ({ title: translate('ios.restAlert.title'), body: translate('ios.restAlert.body') }));
  const activity = new WorkoutActivityController(deps.activity);
  const health = deps.health ? new HealthExporter(deps.health, deps.ledger) : null;

  const syncTimers = (state: WorkoutStore) => {
    void restAlerts.sync(restAlertTime(state.restTimer, state.settings.restNotificationsEnabled, now()));
    void activity.sync(activityProps(state));
  };
  const syncHealth = () => {
    if (!health || !useWorkoutStore.getState().settings.healthExportEnabled) return;
    void health.sync(() => {
      const { history, settings } = useWorkoutStore.getState();
      return settings.healthExportEnabled ? { history, since: settings.healthExportSince } : null;
    });
  };
  const resync = () => {
    syncTimers(useWorkoutStore.getState());
    syncHealth();
  };

  const initial = useWorkoutStore.getState();
  void activity.adopt(activityProps(initial));
  void restAlerts.sync(restAlertTime(initial.restTimer, initial.settings.restNotificationsEnabled, now()));
  syncHealth();

  const unsubscribe = useWorkoutStore.subscribe((state, prev) => {
    if (state.restTimer !== prev.restTimer || state.activeSession !== prev.activeSession || state.settings !== prev.settings || state.exercises !== prev.exercises) {
      syncTimers(state);
    }
    if (state.history !== prev.history || state.settings.healthExportEnabled !== prev.settings.healthExportEnabled) syncHealth();
  });
  return { restAlerts, activity, health, resync, detach: unsubscribe };
}

let attached = false;

export function attachIntegrations(): void {
  if (attached || Platform.OS !== 'ios') return;
  attached = true;

  // The in-app chime covers the foreground; only a backgrounded app shows the banner.
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const foreground = AppState.currentState === 'active';
      return { shouldShowBanner: !foreground, shouldShowList: !foreground, shouldPlaySound: !foreground, shouldSetBadge: false };
    },
  });

  const native = GymHealth;
  const handles = connectIntegrations({
    restAlerts: restAlertAdapter,
    activity: liveActivityAdapter(),
    health: native
      ? {
          status: () => native.authorizationStatus(),
          save: (workout) => native.saveWorkout(workout),
          remove: (sessionId) => native.deleteWorkout(sessionId),
        }
      : null,
    ledger: healthLedger,
  });
  AppState.addEventListener('change', (next) => {
    if (next === 'active') handles.resync();
  });
}
