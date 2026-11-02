/** Display helpers shared by the screens. */

import { getCurrentLocale, intlLocale } from '@/i18n';

const kgFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const dateLocale = () => intlLocale(getCurrentLocale());

/** Unit words in the UI language; numbers always use Western digits (decision D8). */
const UNITS = {
  en: { kg: 'kg', t: 't', min: 'min', h: 'h' },
  ar: { kg: 'كجم', t: 'طن', min: 'د', h: 'س' },
} as const;
const unit = (key: keyof (typeof UNITS)['en']) => UNITS[getCurrentLocale()][key];

/**
 * Hermes ignores both the `-u-nu-latn` extension and `numberingSystem` for
 * dates (seen on the iOS simulator), so Arabic-Indic digits are mapped back to
 * Western ones after formatting (decision D8).
 */
export function latinDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => String((d.charCodeAt(0) & 0xf) % 10));
}

/** Whole kilograms for totals ("9,600 kg"); a half step survives for loads ("102.5 kg"). */
export function formatKg(value: number): string {
  const rounded = Math.round(value * 2) / 2;
  return `${kgFormatter.format(rounded)} ${unit('kg')}`;
}

/** Short form for tight tiles: "8,925 kg" below 10 t, then "28.7 t". */
export function formatKgCompact(value: number): string {
  return value >= 10_000 ? `${(value / 1000).toFixed(1)} ${unit('t')}` : formatKg(value);
}

/** "1 h 12 min" for ≥ 1 h, otherwise "42 min" — "1:12" reads like a clock time. */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} ${unit('min')}`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours} ${unit('h')}` : `${hours} ${unit('h')} ${minutes % 60} ${unit('min')}`;
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
  return latinDigits(date.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' }));
}

/** "Sat 31 Oct" */
export function formatShortDate(iso: string): string {
  return latinDigits(new Date(iso).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }));
}

/** "6:12 PM" */
export function formatTime(iso: string): string {
  return latinDigits(new Date(iso).toLocaleTimeString(dateLocale(), { hour: 'numeric', minute: '2-digit' }));
}

/** "Sat" style weekday label for a calendar strip. */
export function formatWeekdayShort(date: Date): string {
  return latinDigits(date.toLocaleDateString(dateLocale(), { weekday: 'short' }));
}

/** Signed percentage change, or null when there's no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export { startOfWeek } from '@/lib/workoutMath';
