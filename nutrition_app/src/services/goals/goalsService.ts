import type { Allergen, DailyGoals, DietType, LocalDate, NutrientTarget, UserPreferences } from '../../core/types/domain';
import type { NutrientId } from '../../core/types/nutrients';
import { MACRONUTRIENT_IDS } from '../../core/types/nutrients';
import { REFERENCE_DAILY_VALUES } from '../../core/constants/referenceIntakes';
import { assertLocalDate, nowIso, today } from '../../core/utils/dates';
import { createId } from '../../core/utils/ids';
import { goalsRepository, preferencesRepository } from '../../data/repositories';

/** Goals in effect for a date (default today). */
export const getGoals = (date: LocalDate = today()) => goalsRepository.forDate(date);
export const listGoalHistory = () => goalsRepository.list();

/**
 * Sets goals effective from a date (default today). Earlier days keep their previous goals,
 * so historical adherence is evaluated against the goals that applied at the time.
 */
export async function setGoals(targets: DailyGoals['targets'], effectiveFrom: LocalDate = today()): Promise<DailyGoals> {
  assertLocalDate(effectiveFrom);
  const now = nowIso();
  const existing = (await goalsRepository.list()).find((g) => g.effectiveFrom === effectiveFrom);
  return goalsRepository.put({ id: existing?.id ?? createId('goal'), effectiveFrom, targets, createdAt: existing?.createdAt ?? now, updatedAt: now });
}

export interface MacroGoalsInput {
  calories?: number;
  protein?: number;
  carbohydrate?: number;
  fat?: number;
  fiber?: number;
}

/** Updates macro targets on top of the current goals (new goal version from `effectiveFrom`). */
export async function setMacroGoals(input: MacroGoalsInput, effectiveFrom: LocalDate = today()): Promise<DailyGoals> {
  const current = (await goalsRepository.forDate(effectiveFrom))?.targets ?? {};
  const targets = { ...current };
  const set = (id: NutrientId, amount: number | undefined, direction: NutrientTarget['direction']) => {
    if (amount === undefined) return;
    if (amount > 0) targets[id] = { amount, direction, origin: 'user', ...(direction === 'around' ? { tolerance: 0.1 } : {}) };
    else delete targets[id];
  };
  set('energy', input.calories, 'around');
  set('protein', input.protein, 'atLeast');
  set('carbohydrate', input.carbohydrate, 'around');
  set('fat', input.fat, 'around');
  set('fiber', input.fiber, 'atLeast');
  return setGoals(targets, effectiveFrom);
}

/** Sets (or with null clears) one target. */
export async function setNutrientTarget(id: NutrientId, target: Omit<NutrientTarget, 'origin'> | null, effectiveFrom: LocalDate = today()): Promise<DailyGoals> {
  const targets = { ...((await goalsRepository.forDate(effectiveFrom))?.targets ?? {}) };
  if (target) targets[id] = { ...target, origin: 'user' };
  else delete targets[id];
  return setGoals(targets, effectiveFrom);
}

/**
 * Fills micronutrient targets the user has not set with general FDA reference values
 * (informational only; never personalized or medical).
 */
export async function applyReferenceMicronutrientTargets(effectiveFrom: LocalDate = today(), overwrite = false): Promise<DailyGoals> {
  const targets = { ...((await goalsRepository.forDate(effectiveFrom))?.targets ?? {}) };
  for (const [id, ref] of Object.entries(REFERENCE_DAILY_VALUES) as [NutrientId, NutrientTarget][]) {
    const isMacro = (MACRONUTRIENT_IDS as readonly string[]).includes(id) && id !== 'saturatedFat';
    if (isMacro) continue;
    if (overwrite || !targets[id]) targets[id] = { ...ref };
  }
  return setGoals(targets, effectiveFrom);
}

// ----- Preferences -----

export const getPreferences = () => preferencesRepository.get();

export async function updatePreferences(patch: Partial<Omit<UserPreferences, 'id' | 'updatedAt'>>): Promise<UserPreferences> {
  return preferencesRepository.update((p) => ({ ...p, ...patch }));
}

export const setDiets = (diets: DietType[]) => updatePreferences({ diets: [...new Set(diets)] });
export const setAllergies = (allergies: Allergen[]) => updatePreferences({ allergies: [...new Set(allergies)] });

export async function setDislikedFood(foodId: string, disliked: boolean): Promise<UserPreferences> {
  return preferencesRepository.update((p) => {
    const s = new Set(p.dislikedFoodIds);
    if (disliked) s.add(foodId);
    else s.delete(foodId);
    return { ...p, dislikedFoodIds: [...s] };
  });
}

export const setDislikedKeywords = (keywords: string[]) => updatePreferences({ dislikedKeywords: [...new Set(keywords.map((k) => k.trim()).filter(Boolean))] });
export const setAvailableIngredients = (foodIds: string[]) => updatePreferences({ availableIngredientIds: [...new Set(foodIds)] });
