import Dexie, { type Table } from 'dexie';
import type { CachedProduct, DailyGoals, Food, MealEntry, Recipe, UserPreferences } from '../../core/types/domain';
import type { NutrientDefinition } from '../../core/types/nutrients';
import { DEFAULT_DB_NAME } from '../../core/constants/app';
import { SCHEMA_V1, SCHEMA_V2, upgradeToV2 } from '../migrations';

/** Stored food = Food + derived search tokens (internal, stripped before returning to callers). */
export interface FoodRecord extends Food {
  searchTokens: string[];
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

export class NutritionDB extends Dexie {
  foods!: Table<FoodRecord, string>;
  nutrientDefinitions!: Table<NutrientDefinition, string>;
  mealEntries!: Table<MealEntry, string>;
  recipes!: Table<Recipe, string>;
  goals!: Table<DailyGoals, string>;
  preferences!: Table<UserPreferences, string>;
  cachedProducts!: Table<CachedProduct, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name: string = DEFAULT_DB_NAME, options?: ConstructorParameters<typeof Dexie>[1]) {
    super(name, options);
    this.version(1).stores(SCHEMA_V1);
    this.version(2).stores(SCHEMA_V2).upgrade(upgradeToV2);
  }
}

let instance: NutritionDB | null = null;

/** Returns the shared database (opened lazily by Dexie on first use). */
export function getDb(): NutritionDB {
  instance ??= new NutritionDB();
  return instance;
}

/**
 * Replaces the shared database (tests, or a custom name). Closes the previous instance.
 */
export function setDb(db: NutritionDB): NutritionDB {
  if (instance && instance !== db) instance.close();
  instance = db;
  return db;
}

/** Closes and deletes the shared database. Irreversible. */
export async function deleteDatabase(): Promise<void> {
  const db = getDb();
  db.close();
  await db.delete();
  instance = null;
}

/**
 * Asks the browser to keep IndexedDB data under storage pressure.
 * iOS Safari: installed (home-screen) PWAs are not subject to the 7-day script-writable storage
 * cap that applies to Safari tabs, but calling persist() and keeping JSON backups is still advised.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* unsupported */
  }
  return false;
}

export async function getStorageEstimate(): Promise<{ usage: number | null; quota: number | null; persisted: boolean | null }> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : null;
      return { usage: e.usage ?? null, quota: e.quota ?? null, persisted };
    }
  } catch {
    /* unsupported */
  }
  return { usage: null, quota: null, persisted: null };
}
