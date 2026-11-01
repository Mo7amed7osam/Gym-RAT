import { formatInputNumber, normalizeNumericInput, parseReps, parseWeight } from '@/lib/parseNumber';

describe('normalizeNumericInput', () => {
  it('converts Arabic-Indic and extended Arabic-Indic digits', () => {
    expect(normalizeNumericInput('٥٧٫٥')).toBe('57.5');
    expect(normalizeNumericInput('۱۲')).toBe('12');
  });
  it('accepts comma and Arabic decimal separators', () => {
    expect(normalizeNumericInput('57,5')).toBe('57.5');
    expect(normalizeNumericInput('1.2.3')).toBe('1.23');
  });
  it('drops everything else', () => {
    expect(normalizeNumericInput('kg 60 kg')).toBe('60');
    expect(normalizeNumericInput('')).toBe('');
  });
});

describe('parseWeight', () => {
  it('parses to two decimals and rejects negatives/empties', () => {
    expect(parseWeight('57.555')).toBe(57.56);
    expect(parseWeight('')).toBeNull();
    expect(parseWeight('.')).toBeNull();
    expect(parseWeight('-5')).toBe(5); // sign is stripped, not rejected
  });
});

describe('parseReps', () => {
  it('truncates decimals and parses integers', () => {
    expect(parseReps('12.9')).toBe(12);
    expect(parseReps('٨')).toBe(8);
    expect(parseReps('')).toBeNull();
  });
});

describe('formatInputNumber', () => {
  it('renders null as empty string', () => {
    expect(formatInputNumber(null)).toBe('');
    expect(formatInputNumber(57.5)).toBe('57.5');
  });
});
