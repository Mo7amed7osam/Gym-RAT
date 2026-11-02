import { act, renderHook } from '@testing-library/react-native';

import { createNodeDriver } from '@/data/db/driver.node';
import { HealthExportRepository } from '@/data/db/healthExportRepository';
import { MIGRATIONS, SCHEMA_VERSION, getUserVersion, migrate, verifySchema } from '@/data/db/migrations';
import { seedExercises, seedPlans } from '@/data/db/seed';
import { shouldKeepAwake } from '@/components/WorkoutKeepAwake';
import { HealthExporter, healthWorkout, planHealthExport, workoutFingerprint, type HealthAdapter, type HealthWorkout } from '@/services/healthExport';
import { connectIntegrations, type IntegrationHandles } from '@/services/integrations';
import { RestAlertController, restAlertTime, type RestAlertAdapter } from '@/services/restAlerts';
import { WorkoutActivityController, type ActivityHandle, type WorkoutActivityAdapter, type WorkoutActivityProps } from '@/services/workoutActivity';
import { deleteHistorySession, saveHistorySession } from '@/store/historyActions';
import { useRestTimerCountdown } from '@/store/useRestTimerCountdown';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, useWorkoutStore } from '@/store/useWorkoutStore';
import type { RestTimerState, WorkoutSession } from '@/types/workout';
import { done, exercise, local, session as completedSession } from '@/test/fixtures/sessions';

const T0 = new Date('2026-11-02T10:00:00.000Z').getTime();
const flush = async () => {
  for (let i = 0; i < 50; i++) await Promise.resolve();
};

// ─── Fakes ───────────────────────────────────────────────────────────────────

function fakeAlerts() {
  const log: string[] = [];
  const pending: number[] = [];
  const adapter: RestAlertAdapter = {
    schedule: async (at) => {
      log.push(`schedule:${at - T0}`);
      pending.push(at);
    },
    cancel: async () => {
      log.push('cancel');
      pending.length = 0;
    },
  };
  return { adapter, log, pending };
}

function fakeActivities(leftovers = 0) {
  const events: string[] = [];
  const shown: (WorkoutActivityProps | null)[] = [];
  let live = 0;
  const handle = (id: number): ActivityHandle => ({
    update: async (props) => {
      events.push(`update:${id}`);
      shown.push(props);
    },
    end: async () => {
      events.push(`end:${id}`);
      live -= 1;
    },
  });
  const existing = Array.from({ length: leftovers }, (_, i) => handle(100 + i));
  live = leftovers;
  const adapter: WorkoutActivityAdapter = {
    existing: () => existing,
    start: (props) => {
      live += 1;
      events.push('start');
      shown.push(props);
      return handle(live);
    },
  };
  return { adapter, events, shown, live: () => live };
}

function fakeHealth(status: ReturnType<HealthAdapter['status']> = 'authorized') {
  const store = new Map<string, HealthWorkout[]>(); // sessionId → copies in "Health"
  let failNext = false;
  const adapter: HealthAdapter = {
    status: () => status,
    save: async (workout) => {
      if (failNext) {
        failNext = false;
        throw new Error('Health is locked');
      }
      const replaced = store.get(workout.sessionId)?.length ?? 0;
      store.set(workout.sessionId, [workout]);
      return { uuid: `hk-${workout.sessionId}-${workout.startMs}`, replaced };
    },
    remove: async (sessionId) => {
      const count = store.get(sessionId)?.length ?? 0;
      store.delete(sessionId);
      return count;
    },
  };
  return { adapter, store, failOnce: () => (failNext = true) };
}

function ledger() {
  const driver = createNodeDriver();
  migrate(driver);
  return { driver, repo: new HealthExportRepository(driver) };
}

const timer = (partial: Partial<RestTimerState>): RestTimerState => ({ ...IDLE_REST_TIMER, ...partial });

// ─── Rest alerts ─────────────────────────────────────────────────────────────

describe('rest alerts', () => {
  it('schedules only for a running, unannounced timer far enough ahead, and only when enabled', () => {
    const running = timer({ status: 'running', endsAt: T0 + 90_000, durationMs: 90_000 });
    expect(restAlertTime(running, true, T0)).toBe(T0 + 90_000);
    expect(restAlertTime(running, false, T0)).toBeNull();
    expect(restAlertTime({ ...running, elapsedAt: T0 }, true, T0)).toBeNull();
    expect(restAlertTime(running, true, T0 + 89_500)).toBeNull(); // the in-app chime handles the last second
    expect(restAlertTime(timer({ status: 'paused', pausedRemainingMs: 30_000 }), true, T0)).toBeNull();
    expect(restAlertTime(IDLE_REST_TIMER, true, T0)).toBeNull();
  });

  it('cancels before every reschedule and ends with exactly one pending alert', async () => {
    const { adapter, log, pending } = fakeAlerts();
    const controller = new RestAlertController(adapter, () => ({ title: 't', body: 'b' }));
    void controller.sync(T0 + 60_000);
    void controller.sync(T0 + 60_000); // unchanged: no work
    void controller.sync(null); // paused
    void controller.sync(T0 + 75_000); // resumed +15 s
    await controller.sync(T0 + 75_000);
    expect(log).toEqual(['cancel', 'schedule:60000', 'cancel', 'cancel', 'schedule:75000']);
    expect(pending).toEqual([T0 + 75_000]);
  });

  it('survives adapter failures', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new RestAlertController({ schedule: async () => Promise.reject(new Error('denied')), cancel: async () => {} }, () => ({ title: '', body: '' }));
    await expect(controller.sync(T0 + 60_000)).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

// ─── Late chime ──────────────────────────────────────────────────────────────

describe('rest countdown after the app was suspended', () => {
  beforeEach(() => {
    attachPersistence(null);
    jest.useFakeTimers();
    jest.setSystemTime(T0);
  });
  afterEach(() => jest.useRealTimers());

  it('chimes when rest ends on screen', async () => {
    useWorkoutStore.setState({ restTimer: timer({ status: 'running', endsAt: T0 + 5_000, durationMs: 5_000 }) });
    const onElapsed = jest.fn();
    await renderHook(() => useRestTimerCountdown(onElapsed));
    await act(async () => jest.advanceTimersByTime(5_300));
    expect(onElapsed).toHaveBeenCalledTimes(1);
    expect(useWorkoutStore.getState().restTimer.elapsedAt).not.toBeNull();
  });

  it('marks long-finished rest as elapsed without a second, late alert', async () => {
    useWorkoutStore.setState({ restTimer: timer({ status: 'running', endsAt: T0 - 60_000, durationMs: 90_000 }) });
    const onElapsed = jest.fn();
    await renderHook(() => useRestTimerCountdown(onElapsed));
    await act(async () => jest.advanceTimersByTime(300));
    expect(onElapsed).not.toHaveBeenCalled();
    expect(useWorkoutStore.getState().restTimer.elapsedAt).not.toBeNull();
  });
});

// ─── Live Activity ───────────────────────────────────────────────────────────

describe('Live Activity controller', () => {
  const props = (exercise: string, extra: Partial<WorkoutActivityProps> = {}): WorkoutActivityProps => ({
    title: 'Push A',
    exercise,
    detail: 'Set 1 of 3',
    activeStart: T0,
    pausedAt: null,
    restStart: null,
    restEnd: null,
    restLeftSeconds: null,
    labels: { rest: 'Rest', restOver: 'Rest over', paused: 'Paused', workout: 'Workout' },
    ...extra,
  });

  it('starts once, updates only on change, ends on finish', async () => {
    const fake = fakeActivities();
    const controller = new WorkoutActivityController(fake.adapter);
    await controller.sync(props('Bench'));
    await controller.sync(props('Bench'));
    await controller.sync(props('Bench', { restStart: T0, restEnd: T0 + 90_000 }));
    await controller.sync(null);
    await controller.sync(null);
    expect(fake.events).toEqual(['start', 'update:1', 'end:1']);
    expect(fake.live()).toBe(0);
  });

  it('adopts one activity left by a killed process and ends the extras', async () => {
    const fake = fakeActivities(2);
    const controller = new WorkoutActivityController(fake.adapter);
    await controller.adopt(props('Squat'));
    expect(fake.events).toEqual(['end:101', 'update:100']);
    expect(controller.active).toBe(true);
  });

  it('ends a leftover activity when no workout survived the restart', async () => {
    const fake = fakeActivities(1);
    const controller = new WorkoutActivityController(fake.adapter);
    await controller.adopt(null);
    expect(fake.events).toEqual(['end:100']);
    expect(controller.active).toBe(false);
  });

  it('treats an unsupported device as no activity', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new WorkoutActivityController({
      existing: () => {
        throw new Error('ActivityKit unavailable');
      },
      start: () => {
        throw new Error('Live Activities disabled');
      },
    });
    await controller.adopt(props('Bench'));
    await controller.sync(props('Row'));
    expect(controller.active).toBe(false);
    warn.mockRestore();
  });
});

// ─── Apple Health ────────────────────────────────────────────────────────────

describe('Apple Health export', () => {
  const since = local(2026, 10, 1, 0).toISOString();
  const a = completedSession(local(2026, 10, 10), [exercise('bench', [done(80, 8)])], { id: 'a' });
  const b = completedSession(local(2026, 10, 12), [exercise('squat', [done(100, 5)])], {
    id: 'b',
    pausedIntervals: [{ from: local(2026, 10, 12, 18, 10).toISOString(), to: local(2026, 10, 12, 18, 20).toISOString() }],
  });
  const before = completedSession(local(2026, 9, 20), [exercise('bench', [done(70, 8)])], { id: 'before' });

  it('exports start, end and closed pauses only', () => {
    expect(healthWorkout(b)).toEqual({
      sessionId: 'b',
      startMs: local(2026, 10, 12).getTime(),
      endMs: local(2026, 10, 12, 19).getTime(),
      pauses: [{ fromMs: local(2026, 10, 12, 18, 10).getTime(), toMs: local(2026, 10, 12, 18, 20).getTime() }],
    });
    expect(healthWorkout({ ...a, status: 'in_progress', finishedAt: null })).toBeNull();
    expect(healthWorkout({ ...a, endedAtOverride: a.startedAt })).toBeNull();
  });

  it('plans saves for new and edited sessions and deletes for removed ones', () => {
    const fp = workoutFingerprint(healthWorkout(a)!);
    const rows = [
      { sessionId: 'a', fingerprint: fp, healthUuid: 'x', exportedAt: since },
      { sessionId: 'gone', fingerprint: 'f', healthUuid: 'y', exportedAt: since },
    ];
    const plan = planHealthExport([before, a, b], rows, since);
    expect(plan.save.map((w) => w.sessionId)).toEqual(['b']); // `before` predates enabling
    expect(plan.remove).toEqual(['gone']);
    expect(planHealthExport([before, a, b], [], null).save).toEqual([]); // never enabled
  });

  it('writes each session once, rewrites an edit in place and deletes with the session', async () => {
    const health = fakeHealth();
    const { repo } = ledger();
    const exporter = new HealthExporter(health.adapter, repo, () => new Date(T0));
    expect(await exporter.sync(() => ({ history: [a, b], since }))).toEqual({ saved: 2, removed: 0, failed: 0 });
    expect(await exporter.sync(() => ({ history: [a, b], since }))).toEqual({ saved: 0, removed: 0, failed: 0 });

    const edited = { ...a, endedAtOverride: local(2026, 10, 10, 19, 30).toISOString() };
    expect(await exporter.sync(() => ({ history: [edited, b], since }))).toEqual({ saved: 1, removed: 0, failed: 0 });
    expect(health.store.get('a')).toHaveLength(1);
    expect(health.store.get('a')![0].endMs).toBe(local(2026, 10, 10, 19, 30).getTime());

    expect(await exporter.sync(() => ({ history: [edited], since }))).toEqual({ saved: 0, removed: 1, failed: 0 });
    expect([...health.store.keys()]).toEqual(['a']);
    expect(repo.loadAll().map((row) => row.sessionId)).toEqual(['a']);
  });

  it('keeps a session that was moved before the enable date', async () => {
    const health = fakeHealth();
    const { repo } = ledger();
    const exporter = new HealthExporter(health.adapter, repo);
    await exporter.sync(() => ({ history: [a], since }));
    const movedEarlier = { ...a, startedAt: local(2026, 9, 25).toISOString(), finishedAt: local(2026, 9, 25, 19).toISOString() };
    expect(await exporter.sync(() => ({ history: [movedEarlier], since }))).toEqual({ saved: 1, removed: 0, failed: 0 });
    expect(health.store.get('a')).toHaveLength(1);
  });

  it('retries a failed write on the next run without duplicating', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const health = fakeHealth();
    const { repo } = ledger();
    const exporter = new HealthExporter(health.adapter, repo);
    health.failOnce();
    expect(await exporter.sync(() => ({ history: [a], since }))).toEqual({ saved: 0, removed: 0, failed: 1 });
    expect(repo.loadAll()).toEqual([]);
    expect(await exporter.sync(() => ({ history: [a], since }))).toEqual({ saved: 1, removed: 0, failed: 0 });
    expect(health.store.get('a')).toHaveLength(1);
    warn.mockRestore();
  });

  it('does nothing without permission or when the queued run was switched off', async () => {
    for (const status of ['notDetermined', 'denied', 'unavailable'] as const) {
      const health = fakeHealth(status);
      const exporter = new HealthExporter(health.adapter, ledger().repo);
      expect(await exporter.sync(() => ({ history: [a], since }))).toEqual({ saved: 0, removed: 0, failed: 0 });
      expect(health.store.size).toBe(0);
    }
    const health = fakeHealth();
    const { repo } = ledger();
    const exporter = new HealthExporter(health.adapter, repo);
    await exporter.sync(() => ({ history: [a], since }));
    expect(await exporter.sync(() => null)).toEqual({ saved: 0, removed: 0, failed: 0 });
    expect(health.store.get('a')).toHaveLength(1); // turning export off never deletes from Health
  });

  it('folds requests made during a run into one follow-up with the newest history', async () => {
    const health = fakeHealth();
    const { repo } = ledger();
    const exporter = new HealthExporter(health.adapter, repo);
    const first = exporter.sync(() => ({ history: [a], since }));
    void exporter.sync(() => ({ history: [a], since }));
    void exporter.sync(() => ({ history: [a, b], since }));
    await first;
    await flush();
    await flush();
    expect([...health.store.keys()].sort()).toEqual(['a', 'b']);
  });
});

describe('schema v10 (Health ledger)', () => {
  it('adds health_exports to a v9 database without touching existing rows', () => {
    const driver = createNodeDriver();
    migrate(driver, { steps: MIGRATIONS.filter((step) => step.version <= 9) });
    driver.run("INSERT INTO kv (key, value) VALUES ('probe', '1')");
    expect(getUserVersion(driver)).toBe(9);
    expect(migrate(driver)).toEqual({ from: 9, to: SCHEMA_VERSION, applied: [10] });
    expect(() => verifySchema(driver)).not.toThrow();
    expect(driver.get<{ value: string }>("SELECT value FROM kv WHERE key = 'probe'")?.value).toBe('1');
    const repo = new HealthExportRepository(driver);
    repo.put({ sessionId: 's', fingerprint: '1', healthUuid: 'u1', exportedAt: 'x' });
    repo.put({ sessionId: 's', fingerprint: '2', healthUuid: 'u2', exportedAt: 'y' });
    expect(repo.loadAll()).toEqual([{ sessionId: 's', fingerprint: '2', healthUuid: 'u2', exportedAt: 'y' }]);
  });
});

// ─── Keep awake ──────────────────────────────────────────────────────────────

describe('keep awake', () => {
  it('holds the screen on only while lifting, never paused or in Low Power Mode', () => {
    expect(shouldKeepAwake(true, false, false)).toBe(true);
    expect(shouldKeepAwake(true, true, false)).toBe(false);
    expect(shouldKeepAwake(true, false, true)).toBe(false);
    expect(shouldKeepAwake(false, false, false)).toBe(false);
  });
});

// ─── Store wiring: the real workout lifecycle drives all three ───────────────

describe('integrations follow the workout lifecycle', () => {
  const empty = () => ({ exercises: [], plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });
  let handles: IntegrationHandles | null = null;

  beforeEach(() => {
    attachPersistence(null);
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(T0);
    useWorkoutStore.setState({ previewDayIndex: null, persistenceError: null, ...seedExercises(seedPlans(empty())) });
  });
  afterEach(() => {
    handles?.detach();
    handles = null;
    jest.useRealTimers();
  });

  function connect(settings: Partial<typeof DEFAULT_SETTINGS> = {}) {
    useWorkoutStore.getState().updateSettings({ restNotificationsEnabled: true, healthExportEnabled: true, healthExportSince: new Date(T0 - 1000).toISOString(), ...settings });
    const alerts = fakeAlerts();
    const activities = fakeActivities();
    const health = fakeHealth();
    const { repo } = ledger();
    handles = connectIntegrations({ restAlerts: alerts.adapter, activity: activities.adapter, health: health.adapter, ledger: repo, now: () => Date.now() });
    return { alerts, activities, health, repo };
  }

  const firstOpenSet = () => {
    const s = useWorkoutStore.getState().activeSession!;
    const ex = s.exercises[s.currentExerciseIndex];
    return { ex, set: ex.sets.find((item) => !item.completed)! };
  };

  it('start → set → rest → pause → resume → finish → edit → delete', async () => {
    const { alerts, activities, health } = connect();
    const store = useWorkoutStore.getState();
    const started = store.startWorkout();
    if (!started.ok) throw new Error(started.reason);
    await flush();
    expect(activities.events).toEqual(['start']);
    expect(activities.shown[0]).toMatchObject({ title: started.session.code, detail: 'Set 1 of 3', restEnd: null });
    // Privacy: nothing about weights, reps or the body reaches the Lock Screen.
    expect(JSON.stringify(activities.shown[0])).not.toMatch(/kg|weight|reps/i);

    const { ex, set } = firstOpenSet();
    store.completeSet(ex.id, set.id, { weightKg: 60, reps: 10 });
    await flush();
    const rest = useWorkoutStore.getState().restTimer;
    expect(rest.status).toBe('running');
    expect(alerts.pending).toEqual([rest.endsAt]);
    expect(activities.shown.at(-1)).toMatchObject({ restEnd: rest.endsAt, detail: 'Set 2 of 3' });

    store.pauseRestTimer();
    await flush();
    expect(alerts.pending).toEqual([]);
    expect(activities.shown.at(-1)).toMatchObject({ restEnd: null, restLeftSeconds: expect.any(Number) });

    jest.setSystemTime(T0 + 20_000);
    store.resumeRestTimer();
    store.adjustRestTimer(15);
    await flush();
    expect(alerts.pending).toEqual([useWorkoutStore.getState().restTimer.endsAt]);

    store.skipRestTimer();
    store.pauseWorkout();
    await flush();
    expect(alerts.pending).toEqual([]);
    expect(activities.shown.at(-1)!.pausedAt).toBe(T0 + 20_000);
    jest.setSystemTime(T0 + 80_000);
    store.resumeWorkout();
    await flush();
    expect(activities.shown.at(-1)).toMatchObject({ pausedAt: null, activeStart: T0 + 60_000 });

    jest.setSystemTime(T0 + 45 * 60_000);
    const finished = store.finishWorkout('advance')!;
    await flush();
    expect(activities.events.at(-1)).toBe('end:1');
    expect(activities.live()).toBe(0);
    expect(health.store.get(finished.id)).toHaveLength(1);
    expect(health.store.get(finished.id)![0].pauses).toEqual([{ fromMs: T0 + 20_000, toMs: T0 + 80_000 }]);

    const edited: WorkoutSession = { ...useWorkoutStore.getState().history[0], endedAtOverride: new Date(T0 + 50 * 60_000).toISOString() };
    expect(saveHistorySession(edited, T0 + 60 * 60_000).ok).toBe(true);
    await flush();
    expect(health.store.get(finished.id)).toHaveLength(1);
    expect(health.store.get(finished.id)![0].endMs).toBe(T0 + 50 * 60_000);

    expect(deleteHistorySession(finished.id)).toBe(true);
    await flush();
    expect(health.store.has(finished.id)).toBe(false);
  });

  it('a discarded workout ends the activity and never reaches Health', async () => {
    const { activities, health } = connect();
    useWorkoutStore.getState().startWorkout();
    useWorkoutStore.getState().cancelWorkout();
    await flush();
    expect(activities.events).toEqual(['start', 'end:1']);
    expect(health.store.size).toBe(0);
  });

  it('respects the switches: no alerts, no activity, no Health writes', async () => {
    const { alerts, activities, health } = connect({ restNotificationsEnabled: false, liveActivityEnabled: false, healthExportEnabled: false });
    const store = useWorkoutStore.getState();
    store.startWorkout();
    const { ex, set } = firstOpenSet();
    store.completeSet(ex.id, set.id, { weightKg: 60, reps: 10 });
    jest.setSystemTime(T0 + 30 * 60_000);
    store.finishWorkout('advance');
    await flush();
    expect(alerts.log.filter((entry) => entry.startsWith('schedule'))).toEqual([]);
    expect(activities.events).toEqual([]);
    expect(health.store.size).toBe(0);
  });

  it('turning the Live Activity off mid-workout ends it; on again restarts it', async () => {
    const { activities } = connect();
    useWorkoutStore.getState().startWorkout();
    useWorkoutStore.getState().updateSettings({ liveActivityEnabled: false });
    useWorkoutStore.getState().updateSettings({ liveActivityEnabled: true });
    await flush();
    expect(activities.events).toEqual(['start', 'end:1', 'start']);
  });
});
