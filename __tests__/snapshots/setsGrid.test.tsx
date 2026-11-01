import { render } from '@testing-library/react-native';

import { ExerciseCard } from '@/components/ExerciseCard';
import { SetRow } from '@/components/SetRow';
import { seedExercises, seedPlans } from '@/data/db/seed';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, useWorkoutStore } from '@/store/useWorkoutStore';
import type { ExerciseSet } from '@/types/workout';

/**
 * Protected UI (spec §3): the sets grid, tiles and footer must not change
 * layout during the Phase 1 migration. These snapshots are the proof: the
 * theme migration (M5) must leave them byte-identical in the dark theme.
 */

const noop = () => {};

const baseSet = (overrides: Partial<ExerciseSet> = {}): ExerciseSet => ({
  id: 'set-1',
  setNumber: 1,
  type: 'working',
  targetReps: { min: 10, max: 12 },
  weightKg: null,
  reps: null,
  completed: false,
  completedAt: null,
  ...overrides,
});

describe('SetRow', () => {
  it('renders the active (next) row with previous values as placeholders', async () => {
    const tree = await render(
      <SetRow
        set={baseSet()}
        previous={baseSet({ weightKg: 57.5, reps: 12, completed: true })}
        isActive
        isLast={false}
        onCommit={noop}
        onComplete={noop}
        onUncomplete={noop}
        onToggleType={noop}
        onRemove={noop}
      />,
    );
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it('renders a logged row and a warm-up row', async () => {
    const logged = await render(
      <SetRow
        set={baseSet({ weightKg: 60, reps: 12, completed: true, completedAt: '2026-10-31T18:00:00.000Z' })}
        previous={null}
        isActive={false}
        isLast={false}
        onCommit={noop}
        onComplete={noop}
        onUncomplete={noop}
        onToggleType={noop}
        onRemove={noop}
      />,
    );
    expect(logged.toJSON()).toMatchSnapshot();
    const warmup = await render(
      <SetRow
        set={baseSet({ id: 'set-w', type: 'warmup' })}
        previous={null}
        isActive={false}
        isLast
        onCommit={noop}
        onComplete={noop}
        onUncomplete={noop}
        onToggleType={noop}
        onRemove={noop}
      />,
    );
    expect(warmup.toJSON()).toMatchSnapshot();
  });
});

describe('ExerciseCard', () => {
  beforeAll(() => {
    attachPersistence(null);
    useWorkoutStore.setState({
      previewDayIndex: null,
      persistenceError: null,
      ...seedExercises(seedPlans({ exercises: [], plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS })),
    });
  });

  it('renders header, stat tiles, sets grid and footer for the first exercise of a session', async () => {
    const result = useWorkoutStore.getState().startWorkout({ planId: 'pdf_ppl_ul_v5', dayIndex: 0 });
    if (!result.ok) throw new Error('expected session');
    const exercise = result.session.exercises[0];
    const tree = await render(<ExerciseCard sessionExercise={exercise} position={1} total={result.session.exercises.length} onOpenGuide={noop} />);
    expect(tree.toJSON()).toMatchSnapshot();
  });
});
