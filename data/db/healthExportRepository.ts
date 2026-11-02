import type { Driver } from './driver';

/** One session written to Apple Health (schema v10). */
export interface HealthExportRow {
  sessionId: string;
  /** What was exported (start, end, pauses); a different value means the session was edited. */
  fingerprint: string;
  healthUuid: string;
  exportedAt: string;
}

export class HealthExportRepository {
  constructor(private readonly driver: Driver) {}

  loadAll(): HealthExportRow[] {
    return this.driver
      .all<{ session_id: string; fingerprint: string; health_uuid: string; exported_at: string }>(
        'SELECT session_id, fingerprint, health_uuid, exported_at FROM health_exports ORDER BY exported_at',
      )
      .map((row) => ({ sessionId: row.session_id, fingerprint: row.fingerprint, healthUuid: row.health_uuid, exportedAt: row.exported_at }));
  }

  put(row: HealthExportRow): void {
    this.driver.run(
      `INSERT INTO health_exports (session_id, fingerprint, health_uuid, exported_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (session_id) DO UPDATE SET fingerprint = excluded.fingerprint, health_uuid = excluded.health_uuid, exported_at = excluded.exported_at`,
      [row.sessionId, row.fingerprint, row.healthUuid, row.exportedAt],
    );
  }

  remove(sessionId: string): void {
    this.driver.run('DELETE FROM health_exports WHERE session_id = ?', [sessionId]);
  }
}
