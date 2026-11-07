import type { Transaction } from 'dexie';
import { tokenize } from '../../core/utils/text';

/**
 * Versioned IndexedDB schemas. NEVER edit a published version — add a new one with an upgrade.
 *
 * v1: initial tables.
 * v2: search tokens on foods (multi-entry index), compound [date+mealType] index on meal entries,
 *     `meta` table (seed version, app metadata). Upgrade backfills searchTokens for existing foods.
 */
export const SCHEMA_V1 = {
  foods: 'id, name, barcode, category, source.type, updatedAt',
  nutrientDefinitions: 'id, category',
  mealEntries: 'id, date, mealType, foodId, recipeId, loggedAt',
  recipes: 'id, name, updatedAt',
  goals: 'id, effectiveFrom',
  preferences: 'id',
  cachedProducts: 'barcode, expiresAt',
} as const;

export const SCHEMA_V2 = {
  ...SCHEMA_V1,
  foods: 'id, name, barcode, category, source.type, updatedAt, *searchTokens',
  mealEntries: 'id, date, mealType, [date+mealType], foodId, recipeId, loggedAt',
  meta: 'key',
} as const;

export const CURRENT_DB_VERSION = 2;

export function foodSearchTokens(food: { name: string; brand?: string; aliases?: string[] }): string[] {
  return tokenize([food.name, food.brand ?? '', ...(food.aliases ?? [])].join(' '));
}

export async function upgradeToV2(tx: Transaction): Promise<void> {
  await tx
    .table('foods')
    .toCollection()
    .modify((food: { name: string; brand?: string; aliases?: string[]; searchTokens?: string[] }) => {
      food.searchTokens = foodSearchTokens(food);
    });
}
