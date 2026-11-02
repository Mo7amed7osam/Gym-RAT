import { Directory, File, Paths } from 'expo-file-system';

/**
 * Photos the user attaches to custom exercises. They live in the app's
 * document directory (`exercise-media/`), so they survive relaunches and are
 * wiped by Reset All Data together with the database.
 */

const DIR_NAME = 'exercise-media';

/** Where custom photos live (may not exist yet). */
export function customMediaDirectoryUri(): string {
  return new Directory(Paths.document, DIR_NAME).uri;
}

function mediaDirectory(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create();
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

/** Removes every custom photo (Reset All Data). */
export async function deleteAllCustomExercisePhotos(): Promise<void> {
  try {
    const dir = new Directory(Paths.document, DIR_NAME);
    if (dir.exists) await dir.delete();
  } catch (error) {
    console.warn('[media] directory delete failed', error);
  }
}
