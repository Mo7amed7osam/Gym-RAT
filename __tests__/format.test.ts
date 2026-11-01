import {
  formatDuration,
  formatElapsed,
  formatKg,
  formatKgCompact,
  isSameDay,
  percentChange,
  startOfProgramWeek,
} from '@/lib/format';

describe('format helpers', () => {
  it('formats kilograms with grouping and rounding', () => {
    expect(formatKg(8925.4)).toBe('8,925 kg');
    expect(formatKgCompact(28_700)).toBe('28.7 t');
    expect(formatKgCompact(9_999)).toBe('9,999 kg');
  });

  it('formats durations and stopwatch times', () => {
    expect(formatDuration(42 * 60)).toBe('42 min');
    expect(formatDuration(60 * 60)).toBe('1 h');
    expect(formatDuration(72 * 60)).toBe('1 h 12 min');
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(23 * 60 + 14)).toBe('23:14');
    expect(formatElapsed(3600 + 5 * 60 + 9)).toBe('1:05:09');
  });

  it('computes percent change with no baseline as null', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
    expect(percentChange(50, 0)).toBeNull();
  });

  it('compares calendar days', () => {
    expect(isSameDay(new Date(2026, 9, 31, 1), new Date(2026, 9, 31, 23))).toBe(true);
    expect(isSameDay(new Date(2026, 9, 31), new Date(2026, 10, 1))).toBe(false);
  });

  it('finds the Saturday that starts the program week', () => {
    // 2026-11-04 is a Wednesday → week starts Saturday 2026-10-31.
    const start = startOfProgramWeek(new Date(2026, 10, 4, 15));
    expect(start.getDay()).toBe(6);
    expect(start.getDate()).toBe(31);
    expect(start.getHours()).toBe(0);
  });
});

describe('date formatting (en locale)', () => {
  it('formats long/short dates and times', () => {
    const { formatLongDate, formatShortDate, formatTime } = jest.requireActual<typeof import('@/lib/format')>('@/lib/format');
    expect(formatLongDate(new Date(2026, 9, 31))).toMatch(/Saturday/);
    expect(formatShortDate('2026-10-31T12:00:00.000Z')).toMatch(/Sat/);
    expect(formatTime('2026-10-31T12:00:00.000Z')).toMatch(/\d{1,2}:\d{2}/);
  });
});
