import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(__dirname, '..');

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [join(dir, entry.name)];
    return ['node_modules', 'ios', 'android', '.git', '.10x', '.expo', 'dist'].includes(entry.name) ? [] : filesUnder(join(dir, entry.name));
  });
}

function storeResolver(env: Record<string, string>) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    let config: { resolver: { resolveRequest?: (c: unknown, m: string, p: string | null) => { type: string; filePath?: string } } } | undefined;
    jest.isolateModules(() => {
      config = require('../metro.config.js');
    });
    return config!.resolver.resolveRequest;
  } finally {
    process.env = saved;
  }
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

  it('drops the poster from every release bundle (__DEV__ gate, folded by Metro before dependency collection)', () => {
    const source = readFileSync(join(root, 'assets/exercises/index.ts'), 'utf8');
    expect(source).toMatch(/= __DEV__\s*\?\s*\{ pre_workout_stretches: require\('\.\/stretches\/pre_workout_stretches\.jpg'\) \}\s*:\s*\{\}/);
    // The only require of the image is the gated one.
    const users = filesUnder(root)
      .filter((file) => !file.includes('node_modules') && !file.includes('/ios/') && !file.includes('/.10x/') && /\.(t|j)sx?$/.test(file))
      .filter((file) => readFileSync(file, 'utf8').includes('pre_workout_stretches.jpg'));
    expect(users.map((file) => file.slice(root.length + 1)).sort()).toEqual(['__tests__/phase5.licensing.test.ts', 'assets/exercises/index.ts']);
  });

  it('stubs the poster for every distributable EAS profile and the explicit flag', () => {
    const stub = readFileSync(join(root, 'assets/exercises/index.store.ts'), 'utf8');
    expect(stub).not.toMatch(/require\(|\.jpe?g/);

    const posterIndex = join(root, 'assets/exercises/index.ts');
    const other = join(root, 'components/WarmupRoutine.tsx');
    const context = {
      resolveRequest: (_c: unknown, moduleName: string) => ({ type: 'sourceFile', filePath: moduleName }),
    };
    const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
    const distributable = Object.keys(eas.build).filter((name) => !['development', 'development-device'].includes(name));
    expect(distributable.sort()).toEqual(['preview', 'production']);
    for (const env of [...distributable.map((name) => ({ EAS_BUILD_PROFILE: name })), { EAS_BUILD_PROFILE: 'some-new-profile' }, { GYMRAT_STORE_BUILD: '1' }] as Record<string, string>[]) {
      const resolve = storeResolver(env);
      expect(resolve).toBeDefined();
      expect(resolve!(context, posterIndex, 'ios')).toEqual({ type: 'sourceFile', filePath: join(root, 'assets/exercises/index.store.ts') });
      expect(resolve!(context, other, 'ios').filePath).toBe(other);
    }
    // Development builds keep it.
    expect(storeResolver({ EAS_BUILD_PROFILE: 'development' })).toBeFalsy();
    // Distributable profiles also set the explicit flag.
    for (const name of distributable) expect(eas.build[name].env).toMatchObject({ GYMRAT_STORE_BUILD: '1' });
  });

  it('fails Release Xcode builds whose product contains a listed asset', () => {
    const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
    expect(app.expo.plugins).toContain('./plugins/withUnlicensedAssetGuard');
    const list = readFileSync(join(root, 'assets/exercises/UNLICENSED.sha1'), 'utf8');
    const poster = readFileSync(join(root, 'assets/exercises/stretches/pre_workout_stretches.jpg'));
    expect(list).toContain(createHash('sha1').update(poster).digest('hex'));

    const script = join(root, 'scripts/release/check-unlicensed-assets.sh');
    const clean = mkdtempSync(join(tmpdir(), 'gymrat-clean-'));
    const dirty = mkdtempSync(join(tmpdir(), 'gymrat-dirty-'));
    try {
      writeFileSync(join(clean, 'icon.png'), Buffer.alloc(4096, 1));
      // Renamed copy, as `expo export` stores assets by hash without an extension.
      writeFileSync(join(dirty, '2ee0a045f486e62aaecc556739dbd0e8'), poster);
      expect(spawnSync('sh', [script, clean]).status).toBe(0);
      const result = spawnSync('sh', [script, dirty], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('pre_workout_stretches.jpg');
    } finally {
      rmSync(clean, { recursive: true, force: true });
      rmSync(dirty, { recursive: true, force: true });
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
