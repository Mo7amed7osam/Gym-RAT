import { createNodeDriver } from '@/data/db/driver.node';
import { MIGRATIONS, SCHEMA_VERSION, getUserVersion, migrate, verifySchema } from '@/data/db/migrations';

describe('migrations', () => {
  it('creates the schema on a fresh database without a backup', () => {
    const driver = createNodeDriver();
    const backup = jest.fn();
    const result = migrate(driver, { backup });
    expect(result).toEqual({ from: 0, to: SCHEMA_VERSION, applied: MIGRATIONS.map((m) => m.version) });
    expect(backup).not.toHaveBeenCalled();
    expect(getUserVersion(driver)).toBe(SCHEMA_VERSION);
    expect(() => verifySchema(driver)).not.toThrow();
    expect(migrate(driver)).toEqual({ from: SCHEMA_VERSION, to: SCHEMA_VERSION, applied: [] });
  });

  it('backs up before migrating an existing database and maps legacy sessions onto PDF plan days', () => {
    const driver = createNodeDriver();
    // Build a v1 database with one legacy session row.
    driver.transaction(() => {
      MIGRATIONS[0].up(driver);
      driver.exec('PRAGMA user_version = 1');
    });
    driver.run(
      `INSERT INTO sessions (id, routine_id, weekday, title_json, code, focus, status, started_at, finished_at, updated_at)
       VALUES ('s1', 'leg_a', 'monday', '{"en":"Leg","ar":"x"}', 'Leg A', 'strength', 'completed', '2026-10-24T18:00:00.000Z', '2026-10-24T19:00:00.000Z', '2026-10-24T19:00:00.000Z')`,
    );
    driver.run(
      `INSERT INTO session_exercises (id, session_id, position, exercise_id, prescription_json) VALUES ('e1', 's1', 0, 'leg_press', '{}')`,
    );
    driver.run(
      `INSERT INTO sets (id, session_exercise_id, set_number, type, target_min, target_max, completed) VALUES ('x1', 'e1', 1, 'working', 10, 12, 1)`,
    );
    const backup = jest.fn();
    const result = migrate(driver, { backup });
    expect(backup).toHaveBeenCalledWith(1);
    // Child rows survive the sessions table rebuild and foreign keys are back on.
    expect(driver.get('SELECT COUNT(*) AS n FROM session_exercises')).toEqual({ n: 1 });
    expect(driver.get('SELECT COUNT(*) AS n FROM sets')).toEqual({ n: 1 });
    expect(driver.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    expect(result).toEqual({ from: 1, to: SCHEMA_VERSION, applied: [2] });
    const row = driver.get<{ plan_id: string; plan_day_id: string; kind: string; notes: string; paused_intervals_json: string }>(
      'SELECT plan_id, plan_day_id, kind, notes, paused_intervals_json FROM sessions WHERE id = ?',
      ['s1'],
    );
    expect(row).toEqual({ plan_id: 'pdf_ppl_ul_v5', plan_day_id: 'pdf_ppl_ul_v5:leg_a', kind: 'plan', notes: '', paused_intervals_json: '[]' });
    expect(driver.all("SELECT name FROM pragma_table_info('sessions') WHERE name IN ('routine_id', 'weekday')")).toEqual([]);
  });

  it('leaves the previous version intact when a step throws', () => {
    const driver = createNodeDriver();
    migrate(driver);
    const failing = { version: SCHEMA_VERSION + 1, up: () => driver.exec('CREATE TABLE half (x); SELECT nope FROM missing;') };
    const run = () =>
      driver.transaction(() => {
        failing.up();
        driver.exec(`PRAGMA user_version = ${failing.version}`);
      });
    expect(run).toThrow();
    expect(getUserVersion(driver)).toBe(SCHEMA_VERSION);
    expect(driver.get("SELECT name FROM sqlite_master WHERE name = 'half'")).toBeNull();
  });

  it('verifySchema rejects a missing table or wrong version', () => {
    const driver = createNodeDriver();
    migrate(driver);
    driver.exec('DROP TABLE kv');
    expect(() => verifySchema(driver)).toThrow(/missing table "kv"/);
    const other = createNodeDriver();
    migrate(other);
    other.exec('PRAGMA user_version = 99');
    expect(() => verifySchema(other)).toThrow(/version 99/);
  });
});
