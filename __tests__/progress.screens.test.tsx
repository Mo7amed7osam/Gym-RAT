import { fireEvent, render, screen } from '@testing-library/react-native';

import { seedExercises, seedPlans } from '@/data/db/seed';
import { EMPTY_PROGRESS } from '@/data/db/progressRepository';
import { replayHistory } from '@/domain/history/recompute';
import BodyScreen from '@/screens/analytics/BodyScreen';
import CalendarScreen from '@/screens/analytics/CalendarScreen';
import ExerciseProgressScreen from '@/screens/analytics/ExerciseProgressScreen';
import GoalsScreen from '@/screens/analytics/GoalsScreen';
import SessionDetailScreen from '@/screens/analytics/SessionDetailScreen';
import ProgressScreen from '@/screens/ProgressScreen';
import { useProgressStore } from '@/store/useProgressStore';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, useWorkoutStore } from '@/store/useWorkoutStore';
import { done, exercise, session } from '@/test/fixtures/sessions';

/** Phase 4 screens rendered against the real stores (no persistence attached). */

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));
const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), navigate: jest.fn(), canGoBack: () => true }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});

const daysAgo = (days: number, hour = 18) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

function seed() {
  const base = seedExercises(seedPlans({ exercises: [], plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS }));
  const benchId = base.exercises[0].id;
  const history = replayHistory(
    [
      session(daysAgo(20), [exercise(benchId, [done(60, 10), done(60, 9)])]),
      session(daysAgo(10), [exercise(benchId, [done(65, 8)])]),
      session(daysAgo(1), [exercise(benchId, [done(70, 8), done(70, 7)])], { notes: 'Felt good' }),
    ],
    0,
  );
  useWorkoutStore.setState({ previewDayIndex: null, persistenceError: null, ...base, settings: { ...DEFAULT_SETTINGS, onboardingComplete: true }, history });
  useProgressStore.getState().hydrate(EMPTY_PROGRESS);
  return { benchId, benchName: base.exercises[0].name.en, history };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

describe('ProgressScreen', () => {
  it('shows comparisons, trends, muscles, calendar, goals, body and recent workouts', async () => {
    const { benchName } = seed();
    await render(<ProgressScreen />);
    expect(screen.getByText('Progress')).toBeTruthy();
    expect(screen.getByText('Weekly volume')).toBeTruthy();
    expect(screen.getByText('Sets per muscle')).toBeTruthy();
    expect(screen.getByText('Recent workouts')).toBeTruthy();
    expect(screen.getAllByText(benchName).length).toBeGreaterThan(0);

    // 13 rolling weeks always contain all three seeded workouts, whatever today's date.
    await fireEvent.press(screen.getByText('3 months'));
    expect(screen.getByText('Compared with the same point in the previous 13 weeks')).toBeTruthy();
    expect(screen.getByLabelText(/^Workouts 3/)).toBeTruthy();
  });

  it('shows the empty state on a fresh install', async () => {
    seed();
    useWorkoutStore.setState({ history: [] });
    await render(<ProgressScreen />);
    expect(screen.getByText('Nothing to chart yet')).toBeTruthy();
  });
});

describe('SessionDetailScreen', () => {
  it('edits a set, saves, and recomputes the stored summary', async () => {
    const { history } = seed();
    const target = history[0];
    mockParams = { id: target.id };
    await render(<SessionDetailScreen />);
    expect(screen.getByText('Felt good')).toBeTruthy();

    await fireEvent.press(screen.getByText('Edit workout'));
    await fireEvent.changeText(screen.getByLabelText('Set 1 weight in kilograms'), '100');
    await fireEvent.press(screen.getByText('Save changes'));

    const saved = useWorkoutStore.getState().history.find((s) => s.id === target.id)!;
    expect(saved.exercises[0].sets[0].weightKg).toBe(100);
    expect(saved.summary!.totalVolumeKg).toBe(100 * 8 + 70 * 7);
    expect(screen.getByText('Edit workout')).toBeTruthy(); // back in review mode
  });

  it('refuses a completed set without reps and keeps the draft', async () => {
    const { history } = seed();
    mockParams = { id: history[0].id };
    await render(<SessionDetailScreen />);
    await fireEvent.press(screen.getByText('Edit workout'));
    await fireEvent.changeText(screen.getByLabelText('Set 1 reps'), '');
    await fireEvent.press(screen.getByText('Save changes'));
    expect(screen.getByText('Set 1: A completed set needs reps.')).toBeTruthy();
    expect(useWorkoutStore.getState().history[0]).toBe(history[0]);
  });

  it('shows not found for an unknown id', async () => {
    seed();
    mockParams = { id: 'nope' };
    await render(<SessionDetailScreen />);
    expect(screen.getByText('Workout not found')).toBeTruthy();
  });
});

describe('BodyScreen', () => {
  it('logs a body weight entry and rejects implausible values', async () => {
    seed();
    await render(<BodyScreen />);
    await fireEvent.changeText(screen.getByLabelText('Value in kg'), '٨٠٫٥');
    await fireEvent.press(screen.getByText('Save entry'));
    expect(useProgressStore.getState().bodyEntries).toEqual([expect.objectContaining({ kind: 'bodyweight', value: 80.5 })]);

    await fireEvent.changeText(screen.getByLabelText('Value in kg'), '900');
    await fireEvent.press(screen.getByText('Save entry'));
    expect(screen.getByText('Enter a value between 20 kg and 400 kg.')).toBeTruthy();
    expect(useProgressStore.getState().bodyEntries).toHaveLength(1);
  });
});

describe('GoalsScreen', () => {
  it('creates a weekly workouts goal and shows its progress', async () => {
    seed();
    await render(<GoalsScreen />);
    await fireEvent.press(screen.getByText('New goal'));
    await fireEvent.press(screen.getByText('Workouts a week'));
    await fireEvent.changeText(screen.getByLabelText('Target'), '4');
    await fireEvent.press(screen.getByText('Create goal'));
    expect(useProgressStore.getState().goals).toEqual([expect.objectContaining({ kind: 'weekly_sessions', targetValue: 4 })]);
    expect(screen.getByText('4 workouts a week')).toBeTruthy();
  });

  it('requires a body measurement before a body goal', async () => {
    seed();
    await render(<GoalsScreen />);
    await fireEvent.press(screen.getByText('New goal'));
    await fireEvent.press(screen.getAllByText('Body weight')[0]);
    await fireEvent.changeText(screen.getByLabelText('Target'), '75');
    await fireEvent.press(screen.getByText('Create goal'));
    expect(screen.getByText('Log a measurement first so progress has a starting point.')).toBeTruthy();
    expect(useProgressStore.getState().goals).toHaveLength(0);
  });
});

describe('ExerciseProgressScreen and CalendarScreen', () => {
  it('charts an exercise and lists its sessions', async () => {
    const { benchId, benchName } = seed();
    mockParams = { id: benchId };
    await render(<ExerciseProgressScreen />);
    expect(screen.getByText(benchName)).toBeTruthy();
    expect(screen.getByText('Sessions')).toBeTruthy();
    await fireEvent.press(screen.getByText('Top weight'));
    expect(screen.getAllByText('70 kg').length).toBeGreaterThan(0);
  });

  it('renders the month with the streak tile', async () => {
    seed();
    await render(<CalendarScreen />);
    expect(screen.getByText('Calendar')).toBeTruthy();
    expect(screen.getByText('Streak')).toBeTruthy();
  });
});
