/**
 * Nutrient identifiers and value contracts.
 *
 * Canonical units (never change without a migration):
 *   energy → kcal; protein, carbohydrate, fat, fiber, sugar, saturatedFat → g;
 *   minerals → mg, except selenium & iodine → µg;
 *   vitaminA → µg RAE, vitaminD → µg, vitaminK → µg, biotin → µg, folate → µg DFE, vitaminB12 → µg,
 *   thiamin, riboflavin, niacin, pantothenicAcid, vitaminB6, vitaminC → mg, vitaminE → mg α-tocopherol.
 */

export const MACRONUTRIENT_IDS = [
  'energy',
  'protein',
  'carbohydrate',
  'fat',
  'fiber',
  'sugar',
  'saturatedFat',
] as const;

export const MINERAL_IDS = [
  'calcium',
  'iron',
  'magnesium',
  'phosphorus',
  'potassium',
  'sodium',
  'zinc',
  'copper',
  'manganese',
  'selenium',
  'iodine',
] as const;

export const VITAMIN_IDS = [
  'vitaminA',
  'thiamin', // B1
  'riboflavin', // B2
  'niacin', // B3
  'pantothenicAcid', // B5
  'vitaminB6',
  'biotin', // B7
  'folate', // B9
  'vitaminB12',
  'vitaminC',
  'vitaminD',
  'vitaminE',
  'vitaminK',
] as const;

/** Every nutrient tracked by the app, in display order. */
export const NUTRIENT_IDS = [...MACRONUTRIENT_IDS, ...MINERAL_IDS, ...VITAMIN_IDS] as const;

export type MacronutrientId = (typeof MACRONUTRIENT_IDS)[number];
export type MineralId = (typeof MINERAL_IDS)[number];
export type VitaminId = (typeof VITAMIN_IDS)[number];
export type NutrientId = (typeof NUTRIENT_IDS)[number];

export type NutrientCategory = 'macronutrient' | 'mineral' | 'vitamin';

/** Canonical storage units. `ug` = microgram (µg). */
export type NutrientUnit = 'kcal' | 'g' | 'mg' | 'ug';

/** Static metadata describing a tracked nutrient. Stored in the `nutrientDefinitions` table. */
export interface NutrientDefinition {
  id: NutrientId;
  /** Human-readable name, e.g. "Vitamin B12". */
  name: string;
  /** Short label, e.g. "B12". */
  shortName: string;
  category: NutrientCategory;
  /** Canonical unit in which every amount for this nutrient is stored. */
  unit: NutrientUnit;
  /** Suggested decimals for presentation only. Calculations are never rounded. */
  displayDecimals: number;
  /** Ordering for UI lists. */
  order: number;
  /** USDA FoodData Central nutrient ids (first match wins). */
  usdaNutrientIds: number[];
  /** Open Food Facts nutriment key (without the `_100g` suffix). */
  offKeys: string[];
  /** Extra words used by the intent parser, e.g. ["b12", "cobalamin"]. */
  aliases: string[];
}

/**
 * Status of a single nutrient value.
 * - `known`: measured/declared value (amount > 0, or 0 declared by a source that is not explicit about zero)
 * - `zero`: the source explicitly reports 0 (e.g. fiber in meat). Contributes 0 with full confidence.
 * - `estimated`: derived/imputed (e.g. sodium computed from salt, USDA imputed values, partial recipe totals)
 * - `missing`: no data. NEVER treated as zero.
 */
export type NutrientValueStatus = 'known' | 'zero' | 'estimated' | 'missing';

/** A nutrient amount in the nutrient's canonical unit, with its data status. */
export type NutrientValue =
  | { status: 'known'; amount: number; isLowerBound?: boolean }
  | { status: 'zero'; amount: 0 }
  | { status: 'estimated'; amount: number; isLowerBound?: boolean }
  | { status: 'missing'; amount: null };

/**
 * Sparse map of nutrient values. An ABSENT key means `missing` (identical to `{status:'missing'}`).
 * Values are either per 100 g (Food.nutrientsPer100g) or absolute (for a logged quantity) depending on context.
 */
export type NutrientValues = Partial<Record<NutrientId, NutrientValue>>;

/** How much of an aggregate is backed by data. Separate from the intake amount itself. */
export interface NutrientCoverage {
  /** Number of items (foods / ingredients / entries) aggregated. */
  contributors: number;
  /** Items with a known, zero or estimated value. */
  withData: number;
  /** Items with no data for this nutrient (excluded from `amount`). */
  missing: number;
  /** Items whose value is estimated. */
  estimated: number;
  /**
   * Fraction (0..1) of aggregated mass (grams) backed by data. 1 when nothing was aggregated.
   * Use this to show "coverage" indicators in the UI.
   */
  ratio: number;
  /** True when no contributor was missing data. */
  isComplete: boolean;
}

/** Aggregate of one nutrient across several items. */
export interface NutrientTotal {
  /** Sum of available values in canonical units. Unrounded. */
  amount: number;
  coverage: NutrientCoverage;
  /** True if missing/partial data means the real intake could be higher than `amount`. */
  isLowerBound: boolean;
}

/** Totals for every tracked nutrient (all keys present). */
export type NutrientTotals = Record<NutrientId, NutrientTotal>;

/** Summary of how complete a food's nutrient profile is. */
export interface NutrientCompleteness {
  totalTracked: number;
  known: number;
  zero: number;
  estimated: number;
  missing: number;
  /** (totalTracked - missing) / totalTracked, 0..1 */
  score: number;
  /** energy, protein, carbohydrate and fat all present. */
  hasCoreMacros: boolean;
  missingNutrients: NutrientId[];
}
