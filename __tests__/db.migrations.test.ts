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

  // The backup hook fires only for from > 0 with pending steps; it becomes testable once schema v2 exists (M4).

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
