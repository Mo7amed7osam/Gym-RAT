/**
 * Builds a release-checklist performance database: 500 completed sessions
 * (about 3.5 years of 3 workouts a week) over the bundled plan, written
 * through the real schema, seed and repository code.
 *
 *   PERF_DB_OUT=/path/gymrat.db npx jest --testMatch '<rootDir>/scripts/perf/*.perf.ts'
 *
 * Copy the file into a simulator's Documents/SQLite/ (app not running) to
 * measure cold start and history screens. Never point it at real user data.
 */
import { existsSync, rmSync } from 'node:fs';

import { createNodeDriver } from '@/data/db/driver.node';
import { migrate } from '@/data/db/migrations';
import { WorkoutRepository } from '@/data/db/repository';
import { seedExercises, seedPlans } from '@/data/db/seed';
import { replayHistory } from '@/domain/history/recompute';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER } from '@/store/useWorkoutStore';
import type { ExerciseSet, WorkoutSession } from '@/types/workout';

const OUT = process.env.PERF_DB_OUT;
const SESSIONS = Number(process.env.PERF_SESSIONS ?? 500);

(OUT ? it : it.skip)(`writes ${SESSIONS} sessions to PERF_DB_OUT`, () => {
  if (existsSync(OUT!)) rmSync(OUT!);
  const driver = createNodeDriver(OUT!);
  driver.exec('PRAGMA journal_mode = DELETE');
  migrate(driver);
  const repo = new WorkoutRepository(driver);
  const empty = repo.loadAll({ restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });
  const seeded = seedExercises(seedPlans(empty));
  const plan = seeded.plans.find((item) => item.kind === 'active') ?? seeded.plans[0];
  const days = plan.days;

  const now = Date.now();
  const history: WorkoutSession[] = [];
  for (let i = 0; i < SESSIONS; i += 1) {
    const start = new Date(now - (SESSIONS - i) * (7 / 3) * 86_400_000);
    start.setHours(18, 0, 0, 0);
    const day = days[i % days.length];
    const progress = i / SESSIONS;
    history.push({
      id: `perf-${i}`,
      schemaVersion: 2,
      kind: 'plan',
      planId: plan.id,
      planDayId: day.id,
      title: day.title,
      code: day.code,
      focus: day.focus,
      status: 'completed',
      startedAt: start.toISOString(),
      finishedAt: new Date(start.getTime() + 55 * 60_000).toISOString(),
      endedAtOverride: null,
      pausedIntervals: [],
      exercises: day.exercises.map((prescription, e) => ({
        id: `perf-${i}-${e}`,
        exerciseId: prescription.exerciseId,
        prescription,
        sets: Array.from({ length: prescription.sets }, (_, s): ExerciseSet => ({
          id: `perf-${i}-${e}-${s}`,
          setNumber: s + 1,
          type: 'working',
          kind: 'normal',
          targetReps: prescription.reps,
          weightKg: Math.round((20 + e * 7.5 + progress * 40 + (i % 3)) * 2) / 2,
          reps: prescription.reps.max - (s % 3),
          rpe: null,
          rir: null,
          completed: true,
          completedAt: new Date(start.getTime() + (e * 10 + s * 3) * 60_000).toISOString(),
        })),
        skipped: false,
        notes: '',
        groupId: null,
        groupKind: null,
        recommendation: null,
      })) as WorkoutSession['exercises'],
      deferredIds: [],
      currentExerciseIndex: 0,
      warmupCompletedIds: [],
      notes: '',
      summary: null,
    } as WorkoutSession);
  }
  // Newest first, with summaries and PRs exactly as the app computes them.
  const replayed = replayHistory(history, 0);
  repo.replaceAll({ ...seeded, history: replayed, settings: { ...seeded.settings, onboardingComplete: true } });
  const count = driver.get<{ n: number }>('SELECT COUNT(*) AS n FROM sessions')!.n;
  expect(count).toBe(SESSIONS);
  driver.db.close();
});
