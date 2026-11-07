import type { Allergen, DietaryFlag, DietType, Food, UserPreferences } from '../types/domain';
import { normalizeText } from '../utils/text';

/**
 * HARD exclusion rules. A food failing any rule is removed from recommendations entirely —
 * never merely penalized. When metadata is unknown and the user has allergies/diets, the food is
 * excluded (fail-safe).
 */

export const DIET_EXCLUDED_FLAGS: Readonly<Record<DietType, readonly DietaryFlag[]>> = {
  vegan: ['meat', 'poultry', 'fish', 'shellfish', 'dairy', 'egg', 'honey'],
  vegetarian: ['meat', 'poultry', 'fish', 'shellfish'],
  pescatarian: ['meat', 'poultry'],
  gluten_free: ['gluten'],
  dairy_free: ['dairy'],
};

/** Allergens implied by a diet (e.g. gluten_free also excludes foods tagged with the gluten allergen). */
const DIET_EXCLUDED_ALLERGENS: Readonly<Partial<Record<DietType, readonly Allergen[]>>> = {
  vegan: ['milk', 'egg', 'fish', 'shellfish', 'molluscs'],
  vegetarian: ['fish', 'shellfish', 'molluscs'],
  gluten_free: ['gluten', 'wheat'],
  dairy_free: ['milk'],
};

/** Allergens that imply others (wheat allergy → foods containing gluten from wheat are flagged as wheat anyway). */
const ALLERGEN_IMPLIES: Readonly<Partial<Record<Allergen, readonly Allergen[]>>> = {
  gluten: ['wheat'],
  shellfish: ['molluscs'],
};

/**
 * Name keywords used as a safety net for manufacturer-declared (crowd-sourced) data.
 * Not applied to curated or user-confirmed foods to avoid false positives like "peanut butter" ↔ milk.
 */
export const ALLERGEN_KEYWORDS: Readonly<Record<Allergen, readonly string[]>> = {
  milk: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'whey', 'casein', 'kefir', 'ghee', 'lactose'],
  egg: ['egg', 'mayonnaise', 'mayo', 'meringue'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'sardine', 'mackerel', 'anchovy', 'trout', 'hake'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'langoustine'],
  molluscs: ['mussel', 'clam', 'oyster', 'squid', 'octopus', 'scallop', 'calamari'],
  tree_nuts: ['almond', 'walnut', 'cashew', 'pistachio', 'hazelnut', 'pecan', 'macadamia', 'brazil nut', 'praline', 'nutella'],
  peanuts: ['peanut'],
  wheat: ['wheat', 'bread', 'pasta', 'couscous', 'bulgur', 'flour', 'spaghetti', 'cracker', 'seitan', 'semolina'],
  gluten: ['wheat', 'barley', 'rye', 'bread', 'pasta', 'couscous', 'bulgur', 'flour', 'seitan', 'malt'],
  soy: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso'],
  sesame: ['sesame', 'tahini', 'hummus'],
  mustard: ['mustard'],
  celery: ['celery', 'celeriac'],
  lupin: ['lupin'],
  sulphites: ['sulphite', 'sulfite', 'wine'],
};

export interface FilterResult {
  allowed: boolean;
  reasons: string[];
}

function expandAllergies(allergies: readonly Allergen[]): Set<Allergen> {
  const s = new Set<Allergen>(allergies);
  for (const a of allergies) for (const b of ALLERGEN_IMPLIES[a] ?? []) s.add(b);
  return s;
}

const containsWord = (text: string, kw: string) => new RegExp(`(^| )${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(e?s)?( |$)`).test(text);

/** Evaluates a single food against the user's hard restrictions. */
export function checkFoodRestrictions(
  food: Pick<Food, 'id' | 'name' | 'aliases' | 'allergens' | 'traces' | 'dietaryFlags' | 'allergenInfo'>,
  prefs: Pick<UserPreferences, 'allergies' | 'diets' | 'dislikedFoodIds' | 'dislikedKeywords'>,
): FilterResult {
  const reasons: string[] = [];
  const allergies = expandAllergies(prefs.allergies);
  const text = normalizeText([food.name, ...food.aliases].join(' '));

  if ((allergies.size > 0 || prefs.diets.length > 0) && food.allergenInfo === 'unknown') {
    reasons.push('allergen/dietary information unknown');
  }
  for (const a of [...food.allergens, ...food.traces]) {
    if (allergies.has(a)) reasons.push(`contains or may contain ${a}`);
  }
  if (food.allergenInfo === 'declared') {
    for (const a of allergies) {
      if (ALLERGEN_KEYWORDS[a].some((kw) => containsWord(text, kw))) reasons.push(`name suggests ${a}`);
    }
  }
  for (const diet of prefs.diets) {
    for (const flag of DIET_EXCLUDED_FLAGS[diet]) if (food.dietaryFlags.includes(flag)) reasons.push(`not ${diet} (${flag})`);
    for (const a of DIET_EXCLUDED_ALLERGENS[diet] ?? []) if (food.allergens.includes(a)) reasons.push(`not ${diet} (${a})`);
  }
  if (prefs.dislikedFoodIds.includes(food.id)) reasons.push('disliked');
  for (const kw of prefs.dislikedKeywords) {
    const k = normalizeText(kw);
    if (k && containsWord(text, k)) reasons.push(`disliked (${kw})`);
  }
  return { allowed: reasons.length === 0, reasons: [...new Set(reasons)] };
}

/** Every component must pass. A missing component (deleted food) has unknown metadata. */
export function checkAllRestrictions(
  foods: readonly (Parameters<typeof checkFoodRestrictions>[0] | null)[],
  prefs: Parameters<typeof checkFoodRestrictions>[1],
): FilterResult {
  const reasons: string[] = [];
  for (const f of foods) {
    if (!f) {
      if (prefs.allergies.length || prefs.diets.length) reasons.push('an ingredient no longer exists; its allergen information is unknown');
      continue;
    }
    const r = checkFoodRestrictions(f, prefs);
    if (!r.allowed) reasons.push(...r.reasons.map((x) => `${f.name}: ${x}`));
  }
  return { allowed: reasons.length === 0, reasons };
}
