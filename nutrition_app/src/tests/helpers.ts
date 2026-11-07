import { NutritionDB, setDb } from '../data/db';
import { computeCompleteness } from '../core/nutrition/values';
import type { Food } from '../core/types/domain';
import type { NutrientValues } from '../core/types/nutrients';

let n = 0;
/** Fresh, isolated IndexedDB (fake-indexeddb) installed as the shared db. */
export async function freshDb(): Promise<NutritionDB> {
  const db = new NutritionDB(`test_${Date.now()}_${n++}`);
  setDb(db);
  await db.open();
  return db;
}

export function makeFood(id: string, per100g: NutrientValues, extra: Partial<Food> = {}): Food {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id,
    name: extra.name ?? id,
    category: 'other',
    role: 'other',
    form: 'ready',
    source: { type: 'user', attribution: 'test', license: 'test' },
    nutrientsPer100g: per100g,
    completeness: computeCompleteness(per100g),
    servings: [],
    allergens: [],
    traces: [],
    dietaryFlags: [],
    allergenInfo: 'curated',
    aliases: [],
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

export const k = (amount: number) => ({ status: 'known' as const, amount });
export const z = () => ({ status: 'zero' as const, amount: 0 as const });
export const est = (amount: number) => ({ status: 'estimated' as const, amount });
