import { getLocales } from 'expo-localization';
import { I18n, type TranslateOptions } from 'i18n-js';
import { useCallback, useMemo } from 'react';
import { I18nManager } from 'react-native';

import { useWorkoutStore } from '@/store/useWorkoutStore';
import type { LanguageSetting } from '@/types/workout';

import { ar } from './ar';
import { en } from './en';

/**
 * UI strings. The language comes from settings (`system` follows the device);
 * `useT()` re-renders consumers when it changes. Layout direction (RTL) is a
 * native setting that only applies after the app restarts, see `applyLayoutDirection`.
 */

export type Locale = 'en' | 'ar';
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'ar'];

const i18n = new I18n({ en, ar });
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

export function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code === 'ar' ? 'ar' : 'en';
}

export function resolveLocale(setting: LanguageSetting): Locale {
  return setting === 'system' ? deviceLocale() : setting;
}

export const isRtlLocale = (locale: Locale): boolean => locale === 'ar';

/** BCP-47 tag for Intl formatting; Arabic keeps Western digits (decision D8). */
export function intlLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
}

let currentLocale: Locale = 'en';

/** The locale non-React code (date formatting) should use. */
export const getCurrentLocale = (): Locale => currentLocale;

export function setCurrentLocale(locale: Locale): void {
  currentLocale = locale;
  i18n.locale = locale;
}

export type TranslateKey = string;

export function translate(key: TranslateKey, options?: TranslateOptions): string {
  return i18n.t(key, options);
}

/** Current locale from settings; call inside components. */
export function useLocale(): Locale {
  const setting = useWorkoutStore((state) => state.settings.language);
  return useMemo(() => resolveLocale(setting), [setting]);
}

export function useT(): (key: TranslateKey, options?: TranslateOptions) => string {
  const locale = useLocale();
  return useCallback((key: TranslateKey, options?: TranslateOptions) => i18n.t(key, { ...options, locale }), [locale]);
}

/**
 * Applies the layout direction for the locale. React Native reads this at
 * startup, so a change takes effect after the next launch; returns whether a
 * restart is needed.
 */
export function applyLayoutDirection(locale: Locale): boolean {
  const rtl = isRtlLocale(locale);
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return rtl !== I18nManager.isRTL;
}
