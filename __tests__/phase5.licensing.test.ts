import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

describe('bundled media licensing', () => {
  it('ships no third-party warm-up posters (rights undocumented)', () => {
    expect(existsSync(join(root, 'assets/exercises'))).toBe(false);
    const images = filesUnder(join(root, 'assets')).filter((file) => /\.(jpe?g|png|webp)$/i.test(file));
    expect(images.filter((file) => /stretch|poster|hip_rehab/i.test(file))).toEqual([]);
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
