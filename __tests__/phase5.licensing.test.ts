import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(__dirname, '..');

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [join(dir, entry.name)];
    return ['node_modules', 'ios', 'android', '.git', '.10x', '.expo', 'dist'].includes(entry.name) ? [] : filesUnder(join(dir, entry.name));
  });
}

describe('bundled media licensing', () => {
  it('keeps the Neila Rey poster as the only third-party image, unchanged', () => {
    const images = filesUnder(join(root, 'assets')).filter((file) => /\.(jpe?g|png|webp)$/i.test(file));
    expect(images.filter((file) => /stretch|poster|hip_rehab/i.test(file)).map((file) => file.slice(root.length + 1))).toEqual([
      'assets/exercises/stretches/pre_workout_stretches.jpg',
    ]);
    // "© Neila Rey" is printed on the artwork itself; the source keeps the credit too.
    expect(readFileSync(join(root, 'assets/exercises/index.ts'), 'utf8')).toContain('© Neila Rey');
  });

  it('bundles the poster in every build, Development and Release (owner decision, ADR-020)', () => {
    const source = readFileSync(join(root, 'assets/exercises/index.ts'), 'utf8');
    expect(source).toMatch(/STRETCH_POSTERS[^=]*= \{\s*pre_workout_stretches: require\('\.\/stretches\/pre_workout_stretches\.jpg'\),\s*\};/);
    expect(source).not.toContain('__DEV__');
    // No build-time swap or stub can drop it again.
    expect(readFileSync(join(root, 'metro.config.js'), 'utf8')).not.toMatch(/resolveRequest|GYMRAT_STORE_BUILD|index\.store/);
    expect(existsSync(join(root, 'assets/exercises/index.store.ts'))).toBe(false);
    const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
    for (const profile of Object.values(eas.build) as { env?: Record<string, string> }[]) expect(profile.env?.GYMRAT_STORE_BUILD).toBeUndefined();
    // The release guard no longer lists the poster.
    const poster = readFileSync(join(root, 'assets/exercises/stretches/pre_workout_stretches.jpg'));
    const list = readFileSync(join(root, 'assets/exercises/UNLICENSED.sha1'), 'utf8');
    expect(list).not.toContain(createHash('sha1').update(poster).digest('hex'));
    expect(list).not.toMatch(/^[0-9a-f]{40}\s+pre_workout_stretches/m);
  });

  it('keeps the Release guard working for any asset that is listed', () => {
    const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
    expect(app.expo.plugins).toContain('./plugins/withUnlicensedAssetGuard');
    const script = join(root, 'scripts/release/check-unlicensed-assets.sh');
    const work = mkdtempSync(join(tmpdir(), 'gymrat-guard-'));
    try {
      const clean = join(work, 'clean');
      const dirty = join(work, 'dirty');
      for (const dir of [clean, dirty]) mkdirSync(dir);
      const blocked = Buffer.alloc(4096, 7);
      writeFileSync(join(clean, 'icon.png'), Buffer.alloc(4096, 1));
      // Renamed copy, as `expo export` stores assets by hash without an extension.
      writeFileSync(join(dirty, '2ee0a045f486e62aaecc556739dbd0e8'), blocked);
      const list = join(work, 'UNLICENSED.sha1');
      writeFileSync(list, `${createHash('sha1').update(blocked).digest('hex')}  blocked_art.jpg  test fixture\n`);
      const env = { ...process.env, UNLICENSED_LIST: list };
      expect(spawnSync('sh', [script, clean], { env }).status).toBe(0);
      const result = spawnSync('sh', [script, dirty], { encoding: 'utf8', env });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('blocked_art.jpg');
      // The real list (poster removed) passes a directory that contains the poster.
      writeFileSync(join(clean, 'pre_workout_stretches.jpg'), readFileSync(join(root, 'assets/exercises/stretches/pre_workout_stretches.jpg')));
      expect(spawnSync('sh', [script, clean]).status).toBe(0);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });

  it('bundles only RepDB stills that the manifest records with a license', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'assets/exercise-media/manifest.json'), 'utf8'));
    const text = JSON.stringify(manifest);
    const stills = readdirSync(join(root, 'assets/exercise-media')).filter((file) => file.endsWith('.webp'));
    expect(stills.length).toBeGreaterThan(0);
    for (const file of stills) expect(text).toContain(file);
  });

  it('keeps the RepDB attribution in both languages', () => {
    const en = readFileSync(join(root, 'i18n/en.ts'), 'utf8');
    const ar = readFileSync(join(root, 'i18n/ar.ts'), 'utf8');
    expect(en).toContain('Exercise data by RepDB (repdb.co)');
    expect(ar).toContain('RepDB');
  });
});
