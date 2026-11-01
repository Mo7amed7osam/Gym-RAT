/** Display helpers for the Progress screens (locale-aware, Western digits per D8). */

import { getCurrentLocale, intlLocale } from '@/i18n';

const locale = () => intlLocale(getCurrentLocale());

/** "November 2026" */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
}

/** "2 Nov" */
export function formatDayMonth(date: Date | number): string {
  return new Date(date).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

/** "2 Nov 2026" */
export function formatDayMonthYear(date: Date | number): string {
  return new Date(date).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Up to `digits` decimals, grouped: "1,250", "80.5". */
export function formatNumber(value: number, digits = 1): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
}

/** "+3", "−1.5", "0" — signed with a true minus sign. */
export function formatSigned(value: number, digits = 1): string {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : '−'}${formatNumber(Math.abs(rounded), digits)}`;
}

/** "45 min", "12 h". Hours past 10 drop the minutes. */
export function formatHoursMinutes(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours >= 10 || minutes % 60 === 0) return `${hours} h`;
  return `${hours} h ${minutes % 60} min`;
}

/** Weekday initials row for a calendar, starting at `first` (a local date). */
export function weekdayInitials(first: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);
    return d.toLocaleDateString(locale(), { weekday: 'narrow' });
  });
}

/** "HH:MM" in local time, 24 h (edit fields). */
export function toTimeInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Parses "18:05" / "6:5" (Arabic-Indic digits allowed) into hours and minutes; null when invalid. */
export function parseTimeInput(raw: string): { hours: number; minutes: number } | null {
  const ascii = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[.٫]/g, ':');
  const match = /^\s*(\d{1,2})\s*:\s*(\d{1,2})\s*$/.exec(ascii);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? { hours, minutes } : null;
}
