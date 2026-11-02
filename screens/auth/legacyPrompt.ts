import { probeLegacyData, type LegacyDataProbe } from '@/data/db/boot';
import type { AuthStorage } from '@/services/auth/storage';

/**
 * Decides whether to offer the legacy-data screen after sign-in (ADR-016):
 * once per account on this phone, only while the account has no sessions of
 * its own, and only when the pre-account file holds something worth keeping.
 * The probe is kept here so the screen can show the counts without re-reading.
 */
export const legacyPromptState: { probe: LegacyDataProbe | null } = { probe: null };

const flagKey = (userId: string) => `legacyPrompt:${userId}`;

export async function shouldOfferLegacyData(userId: string, accountSessionCount: number, storage: Pick<AuthStorage, 'getFlag' | 'setFlag'>): Promise<LegacyDataProbe | null> {
  if (accountSessionCount > 0) return null;
  if ((await storage.getFlag(flagKey(userId))) !== null) return null;
  const probe = await probeLegacyData();
  await storage.setFlag(flagKey(userId), new Date().toISOString());
  if (!probe.hasUserData) return null;
  legacyPromptState.probe = probe;
  return probe;
}
