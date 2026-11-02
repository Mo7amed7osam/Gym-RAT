import { getLocales } from 'expo-localization';

import { intlLocale, isRtlLocale, resolveLocale, setCurrentLocale, translate } from '@/i18n';
import { ar } from '@/i18n/ar';
import { en } from '@/i18n/en';

jest.mock('expo-localization', () => ({ getLocales: jest.fn(() => [{ languageCode: 'en' }]) }));

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const placeholders = (text: string) => (text.match(/%\{\w+\}/g) ?? []).sort();

const enFlat = flatten(en as unknown as Tree);
const arFlat = flatten(ar as unknown as Tree);

// Arabic plurals use the extra CLDR categories (zero/two/few/many) on top of en's one/other.
const ARABIC_ONLY_PLURAL = /\.(zero|two|few|many)$/;
const isArabicPluralExtra = (key: string) => ARABIC_ONLY_PLURAL.test(key) && `${key.replace(ARABIC_ONLY_PLURAL, '')}.other` in enFlat;
// Singular/dual forms may spell the number out ("تمرينة واحدة", "تمرينتين") instead of %{count}.
const withoutCount = (list: string[]) => list.filter((p) => p !== '%{count}');

describe('dictionaries', () => {
  it('ar has exactly the keys en has', () => {
    expect(Object.keys(arFlat).filter((key) => !isArabicPluralExtra(key)).sort()).toEqual(Object.keys(enFlat).sort());
  });

  it('has no empty strings', () => {
    const empty = [...Object.entries(enFlat), ...Object.entries(arFlat)].filter(([, v]) => v.trim() === '').map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it('keeps the same interpolation placeholders in both languages', () => {
    const mismatched = Object.keys(enFlat).filter((key) => {
      const spelledOut = key.endsWith('.one');
      const a = spelledOut ? withoutCount(placeholders(enFlat[key])) : placeholders(enFlat[key]);
      const b = spelledOut ? withoutCount(placeholders(arFlat[key] ?? '')) : placeholders(arFlat[key] ?? '');
      return a.length !== b.length || a.some((p, i) => p !== b[i]);
    });
    expect(mismatched).toEqual([]);
  });

  it('translates most keys (untranslated copies are the exception, not the rule)', () => {
    const same = Object.keys(enFlat).filter((key) => enFlat[key] === arFlat[key]);
    expect(same.length).toBeLessThan(Object.keys(enFlat).length * 0.05);
  });
});

describe('locale resolution', () => {
  const mockLocales = getLocales as jest.Mock;

  it('follows the device for system, clamps unsupported languages to en', () => {
    mockLocales.mockReturnValueOnce([{ languageCode: 'ar' }]);
    expect(resolveLocale('system')).toBe('ar');
    mockLocales.mockReturnValueOnce([{ languageCode: 'fr' }]);
    expect(resolveLocale('system')).toBe('en');
    mockLocales.mockReturnValueOnce([]);
    expect(resolveLocale('system')).toBe('en');
  });

  it('explicit settings ignore the device', () => {
    mockLocales.mockReturnValue([{ languageCode: 'en' }]);
    expect(resolveLocale('ar')).toBe('ar');
    expect(resolveLocale('en')).toBe('en');
  });

  it('only Arabic is RTL and keeps Western digits for Intl (D8)', () => {
    expect(isRtlLocale('ar')).toBe(true);
    expect(isRtlLocale('en')).toBe(false);
    expect(intlLocale('ar')).toBe('ar-EG-u-nu-latn');
    expect(new Intl.NumberFormat(intlLocale('ar')).format(57.5)).toBe('57.5');
    expect(new Intl.NumberFormat(intlLocale('en')).format(1234)).toBe('1,234');
  });
});

describe('translate', () => {
  afterEach(() => setCurrentLocale('en'));

  it('switches dictionaries and interpolates', () => {
    setCurrentLocale('ar');
    expect(translate('tabs.today')).toBe(ar.tabs.today);
    expect(translate('library.count', { count: 7 })).toBe(ar.library.count.replace('%{count}', '7'));
    setCurrentLocale('en');
    expect(translate('library.count', { count: 7 })).toBe('7 exercises');
  });

  it('falls back to English for a key missing in Arabic without throwing', () => {
    setCurrentLocale('ar');
    expect(translate('not.a.real.key')).toContain('missing');
  });
});
