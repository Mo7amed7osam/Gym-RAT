import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  );
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

  it('stubs the poster out of store builds (rights unverified)', () => {
    const stub = readFileSync(join(root, 'assets/exercises/index.store.ts'), 'utf8');
    expect(stub).not.toMatch(/require\(|\.jpe?g/);

    const posterIndex = join(root, 'assets/exercises/index.ts');
    const other = join(root, 'components/WarmupRoutine.tsx');
    const context = {
      resolveRequest: (_c: unknown, moduleName: string) => ({ type: 'sourceFile', filePath: moduleName }),
    };
    for (const env of [{ EAS_BUILD_PROFILE: 'production' }, { GYMRAT_STORE_BUILD: '1' }] as Record<string, string>[]) {
      const resolve = storeResolver(env);
      expect(resolve).toBeDefined();
      expect(resolve!(context, posterIndex, 'ios')).toEqual({ type: 'sourceFile', filePath: join(root, 'assets/exercises/index.store.ts') });
      expect(resolve!(context, other, 'ios').filePath).toBe(other);
    }
    // Development and internal (preview) builds keep it.
    expect(storeResolver({ EAS_BUILD_PROFILE: 'preview' })).toBeFalsy();
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
