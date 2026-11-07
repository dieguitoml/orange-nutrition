import type { Food, MealType, ParsedIntent, Recommendation, RecommendationRequest } from '../../core/types/domain';
import { generateRecommendations, type RecipeCandidateInput } from '../../core/recommendations/engine';
import { parseIntent } from '../../core/recommendations/intentParser';
import { calculateRecipeNutrition, entriesTotals } from '../../core/nutrition/calculations';
import { today } from '../../core/utils/dates';
import { DataError } from '../../core/utils/errors';
import { foodRepository, goalsRepository, mealEntryRepository, preferencesRepository, recipeRepository } from '../../data/repositories';
import { searchFoods } from '../food/foodService';

/** Default meal type from the local hour (used when the request does not specify one). */
export function mealTypeForHour(hour: number): MealType {
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 17) return 'snack';
  if (hour < 22) return 'dinner';
  return 'snack';
}

/**
 * Structured recommendations using today's intake, goals, preferences, saved recipes and
 * available ingredients. All nutrition is computed from stored food data.
 */
export async function recommend(request: RecommendationRequest, now: Date = new Date()): Promise<Recommendation[]> {
  if (request.intent === 'micronutrient' && !request.nutrientId) throw new DataError('VALIDATION', 'nutrientId is required for micronutrient recommendations');
  const date = request.date ?? today();
  const [foods, recipes, prefs, goals, entries] = await Promise.all([
    foodRepository.list(),
    recipeRepository.list(),
    preferencesRepository.get(),
    goalsRepository.forDate(date),
    mealEntryRepository.byDate(date),
  ]);
  const foodMap = new Map(foods.map((f) => [f.id, f]));
  // Recipes may reference archived foods; fetch them too.
  const missingIds = recipes.flatMap((r) => r.ingredients.map((i) => i.foodId)).filter((id) => !foodMap.has(id));
  if (missingIds.length) for (const [id, f] of await foodRepository.getMany(missingIds)) foodMap.set(id, f);

  const recipeInputs: RecipeCandidateInput[] = [];
  for (const recipe of recipes) {
    try {
      recipeInputs.push({ recipe, nutrition: calculateRecipeNutrition(recipe, foodMap), ingredientFoods: recipe.ingredients.map((i) => foodMap.get(i.foodId) ?? null) });
    } catch {
      /* skip recipes whose quantities cannot be resolved */
    }
  }

  return generateRecommendations({
    request: { ...request, date, mealType: request.mealType ?? mealTypeForHour(now.getHours()) },
    foods,
    recipes: recipeInputs,
    preferences: prefs,
    goals,
    todayTotals: entriesTotals(entries),
    eatenTodayFoodIds: new Set(entries.map((e) => e.foodId).filter((x): x is string => !!x)),
  });
}

export interface TextRecommendationResult {
  parsed: ParsedIntent;
  /** Foods matched from ingredient words in the text. */
  matchedIngredients: Food[];
  /** Ingredient words that matched nothing. */
  unmatchedTerms: string[];
  recommendations: Recommendation[];
}

/**
 * Natural-language entry point: "high protein dinner under 600 kcal", "what can I make with eggs and spinach".
 * Uses the rule-based parser (not a chatbot); check `parsed.confidence` to decide whether to confirm with the user.
 */
export async function recommendFromText(text: string, opts: { limit?: number; date?: string; now?: Date } = {}): Promise<TextRecommendationResult> {
  const parsed = parseIntent(text);
  const matchedIngredients: Food[] = [];
  const unmatchedTerms: string[] = [];
  for (const term of parsed.ingredientTerms) {
    const hits = await searchFoods(term, { limit: 5 });
    // prefer ready/cooked forms
    const best = hits.find((h) => h.food.form === 'cooked' || h.food.form === 'ready') ?? hits[0];
    if (best && best.matchType !== 'partial') matchedIngredients.push(best.food);
    else unmatchedTerms.push(term);
  }
  const request: RecommendationRequest = {
    ...parsed.request,
    ...(opts.limit ? { limit: opts.limit } : {}),
    ...(opts.date ? { date: opts.date } : {}),
    ...(matchedIngredients.length ? { ingredientIds: matchedIngredients.map((f) => f.id) } : {}),
  };
  if (request.intent === 'use_ingredients' && !request.ingredientIds) {
    const prefs = await preferencesRepository.get();
    if (prefs.availableIngredientIds.length === 0) request.intent = 'meal';
  }
  return { parsed, matchedIngredients, unmatchedTerms, recommendations: await recommend(request, opts.now) };
}

export { parseIntent };
