const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

/** Normalise Arabic-Indic digits and decimal separators ("٥٧٫٥", "57,5") to "57.5". */
export function normalizeNumericInput(raw: string): string {
  let out = '';
  for (const char of raw) {
    const code = char.charCodeAt(0);
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) out += String(code - ARABIC_INDIC_ZERO);
    else if (code >= EXTENDED_ARABIC_INDIC_ZERO && code <= EXTENDED_ARABIC_INDIC_ZERO + 9)
      out += String(code - EXTENDED_ARABIC_INDIC_ZERO);
    else if (char === ',' || char === '٫') out += '.';
    else if ((char >= '0' && char <= '9') || char === '.') out += char;
  }
  // Keep only the first decimal point.
  const [whole, ...fraction] = out.split('.');
  return fraction.length > 0 ? `${whole}.${fraction.join('')}` : whole;
}

/** Parsed value, or null for empty / invalid input. */
export function parseWeight(raw: string): number | null {
  const normalized = normalizeNumericInput(raw);
  if (normalized === '' || normalized === '.') return null;
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
}

export function parseReps(raw: string): number | null {
  const normalized = normalizeNumericInput(raw).split('.')[0];
  if (normalized === '') return null;
  const value = Number.parseInt(normalized, 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function formatInputNumber(value: number | null): string {
  return value === null ? '' : String(value);
}
