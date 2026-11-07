import type { Food } from '../../core/types/domain';
import { computeCompleteness, compactValues } from '../../core/nutrition/values';
import { foodSchema } from '../../core/validation/schemas';
import { DataError } from '../../core/utils/errors';
import { nowIso } from '../../core/utils/dates';
import { tokenize } from '../../core/utils/text';
import { getDb, guard, type FoodRecord } from '../db';
import { foodSearchTokens } from '../migrations';

/** Validates a food, normalizes derived fields and adds search tokens. */
export function toFoodRecord(food: Food): FoodRecord {
  const nutrientsPer100g = compactValues(food.nutrientsPer100g);
  const parsed = foodSchema.parse({ ...food, nutrientsPer100g, completeness: computeCompleteness(nutrientsPer100g) }) as Food;
  return { ...parsed, searchTokens: foodSearchTokens(parsed) };
}

export function fromFoodRecord(record: FoodRecord): Food {
  const { searchTokens: _ignored, ...food } = record;
  return food;
}

export const foodRepository = {
  async create(food: Food): Promise<Food> {
    return guard('Create food', async () => {
      const rec = toFoodRecord(food);
      await getDb().foods.add(rec);
      return fromFoodRecord(rec);
    });
  },

  /** Insert or replace. */
  async put(food: Food): Promise<Food> {
    return guard('Save food', async () => {
      const rec = toFoodRecord(food);
      await getDb().foods.put(rec);
      return fromFoodRecord(rec);
    });
  },

  async bulkPut(foods: Food[]): Promise<number> {
    return guard('Save foods', async () => {
      const recs = foods.map(toFoodRecord);
      await getDb().foods.bulkPut(recs);
      return recs.length;
    });
  },

  async get(id: string): Promise<Food | null> {
    return guard('Get food', async () => {
      const rec = await getDb().foods.get(id);
      return rec ? fromFoodRecord(rec) : null;
    });
  },

  async getOrThrow(id: string): Promise<Food> {
    const f = await foodRepository.get(id);
    if (!f) throw new DataError('NOT_FOUND', `Food ${id} not found`);
    return f;
  },

  async getMany(ids: string[]): Promise<Map<string, Food>> {
    return guard('Get foods', async () => {
      const recs = await getDb().foods.bulkGet([...new Set(ids)]);
      const map = new Map<string, Food>();
      for (const r of recs) if (r) map.set(r.id, fromFoodRecord(r));
      return map;
    });
  },

  async update(id: string, patch: Partial<Omit<Food, 'id' | 'createdAt' | 'completeness'>>): Promise<Food> {
    return guard('Update food', async () => {
      const db = getDb();
      return db.transaction('rw', db.foods, async () => {
        const existing = await db.foods.get(id);
        if (!existing) throw new DataError('NOT_FOUND', `Food ${id} not found`);
        const rec = toFoodRecord({ ...fromFoodRecord(existing), ...patch, id, createdAt: existing.createdAt, updatedAt: nowIso() } as Food);
        await db.foods.put(rec);
        return fromFoodRecord(rec);
      });
    });
  },

  /** Hard delete. Meal history is unaffected (entries keep snapshots). */
  async delete(id: string): Promise<void> {
    return guard('Delete food', async () => {
      await getDb().foods.delete(id);
    });
  },

  async findByBarcode(barcode: string): Promise<Food | null> {
    return guard('Find food by barcode', async () => {
      const recs = await getDb().foods.where('barcode').equals(barcode).toArray();
      // Prefer user-edited foods over cached OFF copies.
      recs.sort((a, b) => (a.source.type === 'user' ? -1 : 0) - (b.source.type === 'user' ? -1 : 0) || b.updatedAt.localeCompare(a.updatedAt));
      return recs[0] ? fromFoodRecord(recs[0]) : null;
    });
  },

  /**
   * Token-prefix search over name/brand/aliases using the multi-entry `searchTokens` index.
   * Returns candidates with a flag telling whether ALL query tokens matched.
   */
  async searchCandidates(query: string, opts: { includeArchived?: boolean; limit?: number } = {}): Promise<{ food: Food; allTokensMatch: boolean }[]> {
    return guard('Search foods', async () => {
      const tokens = tokenize(query);
      if (tokens.length === 0) return [];
      const db = getDb();
      const recs = await db.foods.where('searchTokens').startsWithAnyOf(tokens).distinct().limit(opts.limit ?? 500).toArray();
      return recs
        .filter((r) => opts.includeArchived || !r.isArchived)
        .map((r) => ({
          food: fromFoodRecord(r),
          allTokensMatch: tokens.every((t) => r.searchTokens.some((st) => st.startsWith(t))),
        }));
    });
  },

  async list(opts: { includeArchived?: boolean; sourceType?: Food['source']['type'] } = {}): Promise<Food[]> {
    return guard('List foods', async () => {
      const db = getDb();
      const coll = opts.sourceType ? db.foods.where('source.type').equals(opts.sourceType) : db.foods.toCollection();
      const recs = await coll.toArray();
      return recs.filter((r) => opts.includeArchived || !r.isArchived).map(fromFoodRecord);
    });
  },

  async count(): Promise<number> {
    return guard('Count foods', () => getDb().foods.count());
  },
};
