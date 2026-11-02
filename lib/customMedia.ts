import { Directory, File, Paths } from 'expo-file-system';

/**
 * Photos the user attaches to custom exercises. They live in the app's
 * document directory (`exercise-media/`), so they survive relaunches and are
 * wiped by Reset All Data together with the database.
 */

const DIR_NAME = 'exercise-media';

/**
 * Photos are stored per account (ADR-016): `exercise-media/<userId>/`.
 * The legacy folder `exercise-media/` (no account) is kept for photos
 * referenced by a claimed legacy database. Set by the database boot.
 */
let scopeUserId: string | null = null;

export function setCustomMediaScope(userId: string | null): void {
  scopeUserId = userId;
}

function scopedDirectory(userId: string | null): Directory {
  const root = new Directory(Paths.document, DIR_NAME);
  return userId ? new Directory(root, userId) : root;
}

/** Where custom photos live for the current account (may not exist yet). */
export function customMediaDirectoryUri(): string {
  return scopedDirectory(scopeUserId).uri;
}

function mediaDirectory(): Directory {
  const dir = scopedDirectory(scopeUserId);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Copies a picked image into the sandbox and returns the stored file URI. */
export async function saveCustomExercisePhoto(exerciseId: string, sourceUri: string): Promise<string> {
  const extension = sourceUri.split('?')[0].split('.').pop()?.toLowerCase();
  const safeExtension = extension && /^[a-z0-9]{1,5}$/.test(extension) ? extension : 'jpg';
  const target = new File(mediaDirectory(), `${exerciseId}-${Date.now()}.${safeExtension}`);
  await new File(sourceUri).copy(target);
  return target.uri;
}

/** Deletes one stored photo; missing files are ignored. */
export async function deleteCustomExercisePhoto(uri: string | null): Promise<void> {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) await file.delete();
  } catch (error) {
    console.warn('[media] delete failed', error);
  }
}

/** Removes every custom photo of one account (Reset All Data, Remove my data). `null` = the legacy folder's loose files only. */
export async function deleteAllCustomExercisePhotos(userId: string | null = scopeUserId): Promise<void> {
  try {
    const dir = scopedDirectory(userId);
    if (!dir.exists) return;
    if (userId) {
      await dir.delete();
      return;
    }
    // Legacy folder: other accounts' sub-folders live inside it, so delete files only.
    for (const entry of dir.list()) if (entry instanceof File) await entry.delete();
  } catch (error) {
    console.warn('[media] directory delete failed', error);
  }
}
