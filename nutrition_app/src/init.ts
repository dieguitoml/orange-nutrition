import { getDb } from './data/db';
import { seedDatabase, type SeedResult } from './data/seed';
import { purgeExpiredProductCache } from './services/barcode';
import { DataError } from './core/utils/errors';
import { toDataError } from './data/db/errors';

export interface InitializeResult {
  seed: SeedResult;
  purgedCacheEntries: number;
}

/**
 * Opens the database (running migrations), seeds the offline food catalog when needed and
 * purges expired barcode cache entries. Safe to call on every app start.
 */
export async function initializeApp(): Promise<InitializeResult> {
  try {
    await getDb().open();
  } catch (e) {
    const err = toDataError(e, 'Open database');
    throw err.code === 'DB' ? new DataError('UNAVAILABLE', `Local database unavailable: ${err.message}`, undefined, { cause: e }) : err;
  }
  const seed = await seedDatabase();
  const purgedCacheEntries = await purgeExpiredProductCache().catch(() => 0);
  return { seed, purgedCacheEntries };
}
