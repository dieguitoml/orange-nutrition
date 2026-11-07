import type {
  DailyGoals,
  Food,
  FoodSnapshot,
  GoalProgress,
  MealEntry,
  MealType,
  NutrientTarget,
  Quantity,
  Recipe,
  RecipeNutrition,
} from '../types/domain';
import { MEAL_TYPES } from '../types/domain';
import { NUTRIENT_IDS, type NutrientId, type NutrientTotals, type NutrientValues } from '../types/nutrients';
import { DEFAULT_AROUND_TOLERANCE } from '../constants/referenceIntakes';
import { ConversionError, quantityToGrams } from '../utils/units';
import { emptyTotals, scaleTotals, scaleValues, totalsToValues } from './values';

/**
 * Pure, deterministic nutrition calculations. No rounding happens here.
 * Missing values are excluded from sums and tracked in coverage — never treated as zero.
 */

type Nutritional = Pick<Food, 'nutrientsPer100g' | 'servings' | 'densityGPerMl'> | FoodSnapshot;

/** Absolute nutrients for a gram amount of a food. */
export function nutrientsForGrams(food: Pick<Food, 'nutrientsPer100g'> | FoodSnapshot, grams: number): NutrientValues {
  if (!Number.isFinite(grams) || grams < 0) throw new ConversionError(`Invalid grams: ${grams}`);
  return scaleValues(food.nutrientsPer100g, grams / 100);
}

/** Absolute nutrients for any supported quantity (g, oz, cup, serving...). */
export function nutrientsForQuantity(food: Nutritional, quantity: Quantity): { grams: number; nutrients: NutrientValues } {
  const grams = quantityToGrams(quantity, food);
  return { grams, nutrients: nutrientsForGrams(food, grams) };
}

/** Absolute nutrients for `count` servings of a defined serving. */
export function nutrientsForServing(food: Nutritional, servingId: string, count = 1) {
  return nutrientsForQuantity(food, { amount: count, unit: 'serving', servingId });
}

export interface AggregationItem {
  nutrients: NutrientValues;
  /** Mass in grams; used to weight coverage. */
  grams: number;
}

/**
 * Sums items into totals with coverage.
 * Coverage ratio = grams of items with data / total grams (count-based when total grams is 0).
 */
export function sumNutrients(items: readonly AggregationItem[]): NutrientTotals {
  const totals = emptyTotals();
  if (items.length === 0) return totals;
  const totalGrams = items.reduce((s, i) => s + Math.max(0, i.grams), 0);
  for (const id of NUTRIENT_IDS) {
    let amount = 0;
    let withData = 0;
    let missing = 0;
    let estimated = 0;
    let gramsWithData = 0;
    let lowerBound = false;
    for (const item of items) {
      const v = item.nutrients[id];
      if (!v || v.status === 'missing') {
        missing++;
        continue;
      }
      withData++;
      gramsWithData += Math.max(0, item.grams);
      amount += v.amount;
      if (v.status === 'estimated') estimated++;
      if ((v.status === 'known' || v.status === 'estimated') && v.isLowerBound) lowerBound = true;
    }
    const ratio = totalGrams > 0 ? gramsWithData / totalGrams : withData / items.length;
    totals[id] = {
      amount,
      isLowerBound: missing > 0 || lowerBound,
      coverage: { contributors: items.length, withData, missing, estimated, ratio, isComplete: missing === 0 },
    };
  }
  return totals;
}

/** Totals for a list of meal entries (uses their frozen nutrient snapshots). */
export function entriesTotals(entries: readonly Pick<MealEntry, 'nutrients' | 'grams'>[]): NutrientTotals {
  return sumNutrients(entries.map((e) => ({ nutrients: e.nutrients, grams: e.grams })));
}

/** Totals per meal type plus overall. */
export function mealTotals(entries: readonly MealEntry[]): { total: NutrientTotals; byMeal: Record<MealType, { entryCount: number; totals: NutrientTotals }> } {
  const byMeal = {} as Record<MealType, { entryCount: number; totals: NutrientTotals }>;
  for (const mt of MEAL_TYPES) {
    const list = entries.filter((e) => e.mealType === mt);
    byMeal[mt] = { entryCount: list.length, totals: entriesTotals(list) };
  }
  return { total: entriesTotals(entries), byMeal };
}

/** Daily total for entries of a single date. */
export const dailyTotals = entriesTotals;

/**
 * Recipe totals. Ingredients use the live food when available, otherwise their snapshot.
 * Per-100 g uses cookedWeightGrams when provided, else the raw ingredient weight.
 */
export function calculateRecipeNutrition(
  recipe: Pick<Recipe, 'id' | 'servings' | 'ingredients' | 'cookedWeightGrams'>,
  foodsById: ReadonlyMap<string, Pick<Food, 'nutrientsPer100g' | 'servings' | 'densityGPerMl'>> = new Map(),
): RecipeNutrition {
  if (!(recipe.servings > 0)) throw new RangeError('Recipe servings must be > 0');
  const ingredientsUsingSnapshot: string[] = [];
  const items: AggregationItem[] = recipe.ingredients.map((ing) => {
    const live = foodsById.get(ing.foodId);
    if (!live) ingredientsUsingSnapshot.push(ing.id);
    const source = live ?? ing.snapshot;
    const grams = quantityToGrams(ing.quantity, source);
    return { grams, nutrients: nutrientsForGrams(source, grams) };
  });
  const rawGrams = items.reduce((s, i) => s + i.grams, 0);
  const totalGrams = recipe.cookedWeightGrams && recipe.cookedWeightGrams > 0 ? recipe.cookedWeightGrams : rawGrams;
  const total = sumNutrients(items);
  return {
    recipeId: recipe.id,
    totalGrams,
    servings: recipe.servings,
    gramsPerServing: totalGrams / recipe.servings,
    total,
    perServing: scaleTotals(total, 1 / recipe.servings),
    per100g: totalGrams > 0 ? totalsToValues(total, 100 / totalGrams) : {},
    ingredientsUsingSnapshot,
  };
}

/** Recipe total nutrition only. */
export const recipeTotals = (recipe: Parameters<typeof calculateRecipeNutrition>[0], foods?: Parameters<typeof calculateRecipeNutrition>[1]) =>
  calculateRecipeNutrition(recipe, foods).total;

/** Recipe nutrition per serving only. */
export const recipePerServing = (recipe: Parameters<typeof calculateRecipeNutrition>[0], foods?: Parameters<typeof calculateRecipeNutrition>[1]) =>
  calculateRecipeNutrition(recipe, foods).perServing;

/**
 * Averages over the given days. Pass only LOGGED days: unlogged days are unknown, not zero.
 * Coverage counters are summed; ratio is the mean of daily ratios.
 */
export function averageTotals(days: readonly NutrientTotals[]): NutrientTotals {
  const out = emptyTotals();
  if (days.length === 0) return out;
  for (const id of NUTRIENT_IDS) {
    let amount = 0;
    let contributors = 0;
    let withData = 0;
    let missing = 0;
    let estimated = 0;
    let ratio = 0;
    let lower = false;
    for (const d of days) {
      const t = d[id];
      amount += t.amount;
      contributors += t.coverage.contributors;
      withData += t.coverage.withData;
      missing += t.coverage.missing;
      estimated += t.coverage.estimated;
      ratio += t.coverage.ratio;
      lower ||= t.isLowerBound;
    }
    out[id] = {
      amount: amount / days.length,
      isLowerBound: lower,
      coverage: { contributors, withData, missing, estimated, ratio: ratio / days.length, isComplete: missing === 0 },
    };
  }
  return out;
}

/** Evaluates whether an amount meets a target. */
export function evaluateTarget(consumed: number, target: NutrientTarget): GoalProgress['status'] {
  switch (target.direction) {
    case 'atLeast':
      return consumed >= target.amount ? 'met' : 'under';
    case 'atMost':
      return consumed <= target.amount ? 'met' : 'over';
    case 'around': {
      const tol = target.tolerance ?? DEFAULT_AROUND_TOLERANCE;
      if (consumed < target.amount * (1 - tol)) return 'under';
      if (consumed > target.amount * (1 + tol)) return 'over';
      return 'met';
    }
  }
}

/** Progress for every nutrient with a target. */
export function goalProgress(totals: NutrientTotals, goals: Pick<DailyGoals, 'targets'> | null): Partial<Record<NutrientId, GoalProgress>> {
  const out: Partial<Record<NutrientId, GoalProgress>> = {};
  if (!goals) return out;
  for (const id of NUTRIENT_IDS) {
    const target = goals.targets[id];
    if (!target || !(target.amount > 0)) continue;
    const t = totals[id];
    out[id] = {
      nutrientId: id,
      target,
      consumed: t.amount,
      remaining: target.amount - t.amount,
      percent: (t.amount / target.amount) * 100,
      status: evaluateTarget(t.amount, target),
      isLowerBound: t.isLowerBound,
    };
  }
  return out;
}

/** Remaining amount for each targeted nutrient (target − consumed; negative when exceeded). */
export function remainingNutrients(totals: NutrientTotals, goals: Pick<DailyGoals, 'targets'> | null): Partial<Record<NutrientId, number>> {
  const out: Partial<Record<NutrientId, number>> = {};
  for (const [id, p] of Object.entries(goalProgress(totals, goals))) out[id as NutrientId] = p.remaining;
  return out;
}

export function remainingCalories(totals: NutrientTotals, goals: Pick<DailyGoals, 'targets'> | null): number | null {
  const t = goals?.targets.energy;
  return t ? t.amount - totals.energy.amount : null;
}

/** Remaining protein / carbohydrate / fat / fiber. */
export function remainingMacros(totals: NutrientTotals, goals: Pick<DailyGoals, 'targets'> | null) {
  const r = remainingNutrients(totals, goals);
  return { protein: r.protein ?? null, carbohydrate: r.carbohydrate ?? null, fat: r.fat ?? null, fiber: r.fiber ?? null };
}

/** consumed / target × 100 for every targeted nutrient (unrounded). */
export function goalPercentages(totals: NutrientTotals, goals: Pick<DailyGoals, 'targets'> | null): Partial<Record<NutrientId, number>> {
  const out: Partial<Record<NutrientId, number>> = {};
  for (const [id, p] of Object.entries(goalProgress(totals, goals))) out[id as NutrientId] = p.percent;
  return out;
}
