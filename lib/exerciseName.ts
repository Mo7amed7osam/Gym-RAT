/**
 * Exercise names follow the UI language: the primary line is the name in the
 * current language, and cards and headers show the other language underneath
 * (gym-floor names are often used in both). Falls back to English when an
 * exercise has no Arabic name (custom exercises).
 */

import type { Locale } from '@/i18n';
import type { LocalizedText } from '@/types/workout';

export function localName(name: LocalizedText | null | undefined, locale: Locale, fallback = ''): string {
  if (!name) return fallback;
  return (name[locale] || name.en || fallback).trim();
}

/** The other language's name, or null when it is missing or the same. */
export function secondaryName(name: LocalizedText | null | undefined, locale: Locale): string | null {
  if (!name) return null;
  const other = (locale === 'ar' ? name.en : name.ar)?.trim();
  return other && other !== localName(name, locale) ? other : null;
}
