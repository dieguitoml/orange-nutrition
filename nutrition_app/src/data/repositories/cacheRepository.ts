import type { CachedProduct } from '../../core/types/domain';
import { getDb, guard } from '../db';

export const cacheRepository = {
  async get(barcode: string): Promise<CachedProduct | null> {
    return guard('Read product cache', async () => (await getDb().cachedProducts.get(barcode)) ?? null);
  },
  async put(entry: CachedProduct): Promise<void> {
    return guard('Write product cache', async () => {
      await getDb().cachedProducts.put(entry);
    });
  },
  async delete(barcode: string): Promise<void> {
    return guard('Delete cached product', () => getDb().cachedProducts.delete(barcode));
  },
  /** Removes expired entries; returns how many were deleted. */
  async purgeExpired(nowIsoTs = new Date().toISOString()): Promise<number> {
    return guard('Purge product cache', () => getDb().cachedProducts.where('expiresAt').below(nowIsoTs).delete());
  },
  async all(): Promise<CachedProduct[]> {
    return guard('List cached products', () => getDb().cachedProducts.toArray());
  },
};
