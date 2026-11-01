/** Display helpers shared by the screens. */

const kgFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatKg(value: number): string {
  return `${kgFormatter.format(Math.round(value))} kg`;
}

/** Short form for tight tiles: "8,925 kg" below 10 t, then "28.7 t". */
export function formatKgCompact(value: number): string {
  return value >= 10_000 ? `${(value / 1000).toFixed(1)} t` : formatKg(value);
}

/** "1 h 12 min" for ≥ 1 h, otherwise "42 min" — "1:12" reads like a clock time. */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
}

/** "23:14" / "1:05:09" stopwatch. */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mmss = `${String(minutes).padStart(hours > 0 ? 2 : 1, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

/** "Saturday, 31 October" */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "Sat 31 Oct" */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "6:12 PM" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Signed percentage change, or null when there's no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Start of the program week (Saturday 00:00) containing `date`. */
export function startOfProgramWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
  return start;
}
