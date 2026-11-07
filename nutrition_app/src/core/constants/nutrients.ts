import type { NutrientDefinition, NutrientId } from '../types/nutrients';

type Def = Omit<NutrientDefinition, 'order'>;

const DEFS: Def[] = [
  // ----- Macronutrients -----
  { id: 'energy', name: 'Calories', shortName: 'kcal', category: 'macronutrient', unit: 'kcal', displayDecimals: 0, usdaNutrientIds: [1008], offKeys: ['energy-kcal'], aliases: ['calories', 'calorie', 'kcal', 'energy'] },
  { id: 'protein', name: 'Protein', shortName: 'Protein', category: 'macronutrient', unit: 'g', displayDecimals: 1, usdaNutrientIds: [1003], offKeys: ['proteins'], aliases: ['protein', 'proteins'] },
  { id: 'carbohydrate', name: 'Carbohydrates', shortName: 'Carbs', category: 'macronutrient', unit: 'g', displayDecimals: 1, usdaNutrientIds: [1005], offKeys: ['carbohydrates'], aliases: ['carbs', 'carbohydrate', 'carbohydrates'] },
  { id: 'fat', name: 'Fat', shortName: 'Fat', category: 'macronutrient', unit: 'g', displayDecimals: 1, usdaNutrientIds: [1004], offKeys: ['fat'], aliases: ['fat', 'fats', 'lipids'] },
  { id: 'fiber', name: 'Fiber', shortName: 'Fiber', category: 'macronutrient', unit: 'g', displayDecimals: 1, usdaNutrientIds: [1079], offKeys: ['fiber'], aliases: ['fiber', 'fibre'] },
  { id: 'sugar', name: 'Sugars', shortName: 'Sugar', category: 'macronutrient', unit: 'g', displayDecimals: 1, usdaNutrientIds: [2000], offKeys: ['sugars'], aliases: ['sugar', 'sugars'] },
  { id: 'saturatedFat', name: 'Saturated fat', shortName: 'Sat. fat', category: 'macronutrient', unit: 'g', displayDecimals: 1, usdaNutrientIds: [1258], offKeys: ['saturated-fat'], aliases: ['saturated fat', 'saturated'] },
  // ----- Minerals -----
  { id: 'calcium', name: 'Calcium', shortName: 'Ca', category: 'mineral', unit: 'mg', displayDecimals: 0, usdaNutrientIds: [1087], offKeys: ['calcium'], aliases: ['calcium'] },
  { id: 'iron', name: 'Iron', shortName: 'Fe', category: 'mineral', unit: 'mg', displayDecimals: 1, usdaNutrientIds: [1089], offKeys: ['iron'], aliases: ['iron'] },
  { id: 'magnesium', name: 'Magnesium', shortName: 'Mg', category: 'mineral', unit: 'mg', displayDecimals: 0, usdaNutrientIds: [1090], offKeys: ['magnesium'], aliases: ['magnesium'] },
  { id: 'phosphorus', name: 'Phosphorus', shortName: 'P', category: 'mineral', unit: 'mg', displayDecimals: 0, usdaNutrientIds: [1091], offKeys: ['phosphorus'], aliases: ['phosphorus'] },
  { id: 'potassium', name: 'Potassium', shortName: 'K', category: 'mineral', unit: 'mg', displayDecimals: 0, usdaNutrientIds: [1092], offKeys: ['potassium'], aliases: ['potassium'] },
  { id: 'sodium', name: 'Sodium', shortName: 'Na', category: 'mineral', unit: 'mg', displayDecimals: 0, usdaNutrientIds: [1093], offKeys: ['sodium'], aliases: ['sodium'] },
  { id: 'zinc', name: 'Zinc', shortName: 'Zn', category: 'mineral', unit: 'mg', displayDecimals: 1, usdaNutrientIds: [1095], offKeys: ['zinc'], aliases: ['zinc'] },
  { id: 'copper', name: 'Copper', shortName: 'Cu', category: 'mineral', unit: 'mg', displayDecimals: 2, usdaNutrientIds: [1098], offKeys: ['copper'], aliases: ['copper'] },
  { id: 'manganese', name: 'Manganese', shortName: 'Mn', category: 'mineral', unit: 'mg', displayDecimals: 2, usdaNutrientIds: [1101], offKeys: ['manganese'], aliases: ['manganese'] },
  { id: 'selenium', name: 'Selenium', shortName: 'Se', category: 'mineral', unit: 'ug', displayDecimals: 1, usdaNutrientIds: [1103], offKeys: ['selenium'], aliases: ['selenium'] },
  { id: 'iodine', name: 'Iodine', shortName: 'I', category: 'mineral', unit: 'ug', displayDecimals: 0, usdaNutrientIds: [1100], offKeys: ['iodine'], aliases: ['iodine'] },
  // ----- Vitamins -----
  { id: 'vitaminA', name: 'Vitamin A (RAE)', shortName: 'A', category: 'vitamin', unit: 'ug', displayDecimals: 0, usdaNutrientIds: [1106], offKeys: ['vitamin-a'], aliases: ['vitamin a', 'vit a', 'retinol'] },
  { id: 'thiamin', name: 'Vitamin B1 (Thiamin)', shortName: 'B1', category: 'vitamin', unit: 'mg', displayDecimals: 2, usdaNutrientIds: [1165], offKeys: ['vitamin-b1'], aliases: ['vitamin b1', 'b1', 'thiamin', 'thiamine'] },
  { id: 'riboflavin', name: 'Vitamin B2 (Riboflavin)', shortName: 'B2', category: 'vitamin', unit: 'mg', displayDecimals: 2, usdaNutrientIds: [1166], offKeys: ['vitamin-b2'], aliases: ['vitamin b2', 'b2', 'riboflavin'] },
  { id: 'niacin', name: 'Vitamin B3 (Niacin)', shortName: 'B3', category: 'vitamin', unit: 'mg', displayDecimals: 1, usdaNutrientIds: [1167], offKeys: ['vitamin-pp'], aliases: ['vitamin b3', 'b3', 'niacin'] },
  { id: 'pantothenicAcid', name: 'Vitamin B5 (Pantothenic acid)', shortName: 'B5', category: 'vitamin', unit: 'mg', displayDecimals: 2, usdaNutrientIds: [1170], offKeys: ['pantothenic-acid'], aliases: ['vitamin b5', 'b5', 'pantothenic acid', 'pantothenic'] },
  { id: 'vitaminB6', name: 'Vitamin B6', shortName: 'B6', category: 'vitamin', unit: 'mg', displayDecimals: 2, usdaNutrientIds: [1175], offKeys: ['vitamin-b6'], aliases: ['vitamin b6', 'b6', 'pyridoxine'] },
  { id: 'biotin', name: 'Vitamin B7 (Biotin)', shortName: 'B7', category: 'vitamin', unit: 'ug', displayDecimals: 1, usdaNutrientIds: [1176], offKeys: ['biotin'], aliases: ['vitamin b7', 'b7', 'biotin'] },
  { id: 'folate', name: 'Vitamin B9 (Folate, DFE)', shortName: 'B9', category: 'vitamin', unit: 'ug', displayDecimals: 0, usdaNutrientIds: [1190], offKeys: ['vitamin-b9', 'folates'], aliases: ['vitamin b9', 'b9', 'folate', 'folic acid'] },
  { id: 'vitaminB12', name: 'Vitamin B12', shortName: 'B12', category: 'vitamin', unit: 'ug', displayDecimals: 2, usdaNutrientIds: [1178], offKeys: ['vitamin-b12'], aliases: ['vitamin b12', 'b12', 'cobalamin'] },
  { id: 'vitaminC', name: 'Vitamin C', shortName: 'C', category: 'vitamin', unit: 'mg', displayDecimals: 1, usdaNutrientIds: [1162], offKeys: ['vitamin-c'], aliases: ['vitamin c', 'vit c', 'ascorbic acid'] },
  { id: 'vitaminD', name: 'Vitamin D', shortName: 'D', category: 'vitamin', unit: 'ug', displayDecimals: 1, usdaNutrientIds: [1114], offKeys: ['vitamin-d'], aliases: ['vitamin d', 'vit d'] },
  { id: 'vitaminE', name: 'Vitamin E (α-tocopherol)', shortName: 'E', category: 'vitamin', unit: 'mg', displayDecimals: 1, usdaNutrientIds: [1109], offKeys: ['vitamin-e'], aliases: ['vitamin e', 'vit e', 'tocopherol'] },
  { id: 'vitaminK', name: 'Vitamin K', shortName: 'K', category: 'vitamin', unit: 'ug', displayDecimals: 1, usdaNutrientIds: [1185], offKeys: ['vitamin-k'], aliases: ['vitamin k', 'vit k', 'phylloquinone'] },
];

/** All nutrient definitions in display order. */
export const NUTRIENT_DEFINITIONS: readonly NutrientDefinition[] = DEFS.map((d, i) => ({ ...d, order: i }));

/** Lookup by id. */
export const NUTRIENTS: Readonly<Record<NutrientId, NutrientDefinition>> = Object.fromEntries(
  NUTRIENT_DEFINITIONS.map((d) => [d.id, d]),
) as Record<NutrientId, NutrientDefinition>;

export function getNutrientDefinition(id: NutrientId): NutrientDefinition {
  return NUTRIENTS[id];
}

/** Nutrients that must be present for a food to be considered "macro complete". */
export const CORE_MACROS: readonly NutrientId[] = ['energy', 'protein', 'carbohydrate', 'fat'];
