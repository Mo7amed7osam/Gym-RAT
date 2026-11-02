import type { HealthLedger } from './healthExport';

/**
 * The open database's Health export ledger. Set by boot (and again after
 * Reset All Data reopens the file); read by the Health exporter.
 */
let current: HealthLedger | null = null;

export function setHealthLedger(ledger: HealthLedger | null): void {
  current = ledger;
}

export const healthLedger: HealthLedger = {
  loadAll: () => current?.loadAll() ?? [],
  put: (row) => {
    if (!current) throw new Error('database not open');
    current.put(row);
  },
  remove: (sessionId) => {
    if (!current) throw new Error('database not open');
    current.remove(sessionId);
  },
};
