import type { Allergen, DietaryFlag, Food, FoodCategory, FoodForm, FoodRole, FoodSearchResult, MealEntry, ServingDefinition } from '../../core/types/domain';
import type { NutrientValues } from '../../core/types/nutrients';
import { computeCompleteness } from '../../core/nutrition/values';
import { createId } from '../../core/utils/ids';
import { nowIso } from '../../core/utils/dates';
import { normalizeText, tokenize } from '../../core/utils/text';
import { DataError } from '../../core/utils/errors';
import { foodRepository, mealEntryRepository, preferencesRepository } from '../../data/repositories';

export interface FoodUsage {
  count: number;
  lastUsedAt: string;
}

/** Usage stats per food id from meal entries logged in the last `days` days. */
export async function getFoodUsageStats(days = 180): Promise<Map<string, FoodUsage>> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const entries = await mealEntryRepository.loggedSince(since);
  const map = new Map<string, FoodUsage>();
  for (const e of entries) {
    if (!e.foodId) continue;
    const u = map.get(e.foodId);
    if (!u) map.set(e.foodId, { count: 1, lastUsedAt: e.loggedAt });
    else {
      u.count++;
      if (e.loggedAt > u.lastUsedAt) u.lastUsedAt = e.loggedAt;
    }
  }
  return map;
}

export interface SearchFoodsOptions {
  limit?: number;
  category?: FoodCategory;
  includeArchived?: boolean;
}

/**
 * Searches local foods (offline). Digits-only queries also match barcodes.
 * Ranking: barcode > exact name > name prefix > all tokens > partial, boosted by favorites,
 * usage frequency and data completeness.
 */
export async function searchFoods(query: string, opts: SearchFoodsOptions = {}): Promise<FoodSearchResult[]> {
  const limit = opts.limit ?? 30;
  const q = normalizeText(query);
  if (!q) return [];
  const [prefs, usage] = await Promise.all([preferencesRepository.get(), getFoodUsageStats()]);
  const favorites = new Set(prefs.favoriteFoodIds);
  const results = new Map<string, FoodSearchResult>();

  const add = (food: Food, matchType: FoodSearchResult['matchType'], base: number) => {
    if (opts.category && food.category !== opts.category) return;
    const u = usage.get(food.id);
    const isFavorite = favorites.has(food.id);
    const score = base + (isFavorite ? 15 : 0) + Math.min(20, (u?.count ?? 0) * 2) + food.completeness.score * 5 - Math.min(10, food.name.length / 10);
    const prev = results.get(food.id);
    if (!prev || prev.score < score) {
      results.set(food.id, { food, score, matchType, isFavorite, useCount: u?.count ?? 0, ...(u ? { lastUsedAt: u.lastUsedAt } : {}) });
    }
  };

  if (/^\d{6,14}$/.test(q)) {
    const byBarcode = await foodRepository.findByBarcode(q);
    if (byBarcode) add(byBarcode, 'barcode', 1000);
  }

  const qTokens = tokenize(q);
  const candidates = await foodRepository.searchCandidates(q, { includeArchived: opts.includeArchived ?? false });
  for (const { food, allTokensMatch } of candidates) {
    const name = normalizeText(food.name);
    const aliases = food.aliases.map(normalizeText);
    if (name === q || aliases.includes(q)) add(food, 'exact', 500);
    else if (name.startsWith(q) || aliases.some((a) => a.startsWith(q))) add(food, 'prefix', 300);
    else if (allTokensMatch) add(food, 'tokens', 200 + (qTokens.length > 1 ? 20 : 0));
    else add(food, 'partial', 50);
  }

  let list = [...results.values()];
  // Only fall back to partial (some-token) matches when nothing matched every token.
  if (list.some((r) => r.matchType !== 'partial')) list = list.filter((r) => r.matchType !== 'partial');
  return list.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name)).slice(0, limit);
}

export const getFood = (id: string) => foodRepository.get(id);
export const getFoods = (ids: string[]) => foodRepository.getMany(ids);
export const listFoods = (opts?: Parameters<typeof foodRepository.list>[0]) => foodRepository.list(opts);
export const findFoodByBarcodeLocal = (barcode: string) => foodRepository.findByBarcode(barcode);

export interface CustomFoodInput {
  name: string;
  brand?: string;
  barcode?: string;
  category?: FoodCategory;
  role?: FoodRole;
  form?: FoodForm;
  /** Per 100 g. Only include nutrients you actually know; absent = missing. Use {status:'zero'} for declared zeros. */
  nutrientsPer100g: NutrientValues;
  servings?: Omit<ServingDefinition, 'id'>[];
  densityGPerMl?: number;
  allergens?: Allergen[];
  traces?: Allergen[];
  dietaryFlags?: DietaryFlag[];
  /** Set true only if the user confirmed the allergen list is complete. */
  allergenInfoConfirmed?: boolean;
  prepTimeMinutes?: number;
  aliases?: string[];
}

/** Creates a user food (also used as the manual-entry fallback for unknown barcodes). */
export async function createCustomFood(input: CustomFoodInput): Promise<Food> {
  const now = nowIso();
  const id = createId('food');
  const food: Food = {
    id,
    name: input.name.trim(),
    ...(input.brand ? { brand: input.brand.trim() } : {}),
    ...(input.barcode ? { barcode: input.barcode.trim() } : {}),
    category: input.category ?? 'other',
    role: input.role ?? 'other',
    form: input.form ?? 'ready',
    source: { type: 'user', attribution: 'Entered by user', license: 'Personal data' },
    nutrientsPer100g: input.nutrientsPer100g,
    completeness: computeCompleteness(input.nutrientsPer100g),
    servings: (input.servings ?? []).map((s, i) => ({ ...s, id: `${id}_s${i}` })),
    ...(input.densityGPerMl ? { densityGPerMl: input.densityGPerMl } : {}),
    allergens: input.allergens ?? [],
    traces: input.traces ?? [],
    dietaryFlags: input.dietaryFlags ?? [],
    allergenInfo: input.allergenInfoConfirmed ? 'user' : 'unknown',
    ...(input.prepTimeMinutes !== undefined ? { prepTimeMinutes: input.prepTimeMinutes } : {}),
    aliases: input.aliases ?? [],
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
  return foodRepository.create(food);
}

/** Edits a food. Seed/OFF foods are copied into a user food instead of being modified in place. */
export async function updateFood(id: string, patch: Partial<CustomFoodInput>): Promise<Food> {
  const existing = await foodRepository.getOrThrow(id);
  const { servings, allergenInfoConfirmed, ...rest } = patch;
  const next: Partial<Food> = {
    ...rest,
    ...(servings ? { servings: servings.map((s, i) => ({ ...s, id: `${id}_s${i}_${Date.now()}` })) } : {}),
    ...(allergenInfoConfirmed !== undefined ? { allergenInfo: allergenInfoConfirmed ? 'user' : 'unknown' } : {}),
  };
  if (existing.source.type !== 'user') {
    return createCustomFood({
      ...existing,
      ...patch,
      name: patch.name ?? `${existing.name} (custom)`,
      servings: patch.servings ?? existing.servings.map(({ id: _id, ...s }) => s),
      ...(existing.barcode && !patch.barcode ? { barcode: existing.barcode } : {}),
    } as CustomFoodInput);
  }
  return foodRepository.update(id, next);
}

/** Deletes a user food, or archives a seed/OFF food. History is preserved by snapshots. */
export async function deleteFood(id: string): Promise<void> {
  const food = await foodRepository.getOrThrow(id);
  if (food.source.type === 'user') await foodRepository.delete(id);
  else await foodRepository.update(id, { isArchived: true });
  await preferencesRepository.update((p) => ({ ...p, favoriteFoodIds: p.favoriteFoodIds.filter((f) => f !== id) }));
}

export async function setFoodFavorite(foodId: string, favorite: boolean): Promise<string[]> {
  if (favorite && !(await foodRepository.get(foodId))) throw new DataError('NOT_FOUND', `Food ${foodId} not found`);
  const prefs = await preferencesRepository.update((p) => {
    const set = new Set(p.favoriteFoodIds);
    if (favorite) set.add(foodId);
    else set.delete(foodId);
    return { ...p, favoriteFoodIds: [...set] };
  });
  return prefs.favoriteFoodIds;
}

export async function getFavoriteFoods(): Promise<Food[]> {
  const prefs = await preferencesRepository.get();
  const map = await foodRepository.getMany(prefs.favoriteFoodIds);
  return prefs.favoriteFoodIds.map((id) => map.get(id)).filter((f): f is Food => !!f);
}

export interface RecentFood {
  food: Food | null;
  /** Snapshot from the latest entry (always present, even if the food was deleted). */
  lastEntry: MealEntry;
}

/** Distinct recently logged foods, most recent first. */
export async function getRecentFoods(limit = 20): Promise<RecentFood[]> {
  const seen = new Set<string>();
  const entries = await mealEntryRepository.recent(limit, (e) => {
    if (e.kind !== 'food' || !e.foodId || seen.has(e.foodId)) return false;
    seen.add(e.foodId);
    return true;
  });
  const foods = await foodRepository.getMany(entries.map((e) => e.foodId!));
  return entries.map((e) => ({ food: foods.get(e.foodId!) ?? null, lastEntry: e }));
}
