import { NUTRIENT_DEFINITIONS } from '../constants/nutrients';
import type { MealType, ParsedIntent, RecommendationIntent } from '../types/domain';
import type { NutrientId } from '../types/nutrients';
import { normalizeText } from '../utils/text';

/**
 * Lightweight, deterministic keyword/regex intent parser for common requests such as
 * "suggest dinner", "high protein snack under 300 kcal", "something rich in iron",
 * "what can I make with chicken, rice and broccoli", "what should I eat to hit my macros".
 * It is NOT a conversational AI: unrecognized text falls back to a generic meal suggestion
 * with low confidence.
 */

const MEAL_WORDS: [RegExp, MealType][] = [
  [/\b(breakfast|brunch|morning)\b/, 'breakfast'],
  [/\b(lunch|midday|noon)\b/, 'lunch'],
  [/\b(dinner|supper|tonight|evening)\b/, 'dinner'],
  [/\b(snack|snacks|nibble|bite)\b/, 'snack'],
];

const MICRO_IDS = NUTRIENT_DEFINITIONS.filter((d) => d.category !== 'macronutrient');

function findMicronutrient(text: string): NutrientId | undefined {
  // longest alias first so "vitamin b12" wins over "b1"
  const aliases = MICRO_IDS.flatMap((d) => d.aliases.map((a) => ({ a: normalizeText(a), id: d.id }))).sort((x, y) => y.a.length - x.a.length);
  for (const { a, id } of aliases) {
    if (new RegExp(`(^| )${a}( |$)`).test(text)) return id;
  }
  return undefined;
}

export function parseIntent(input: string): ParsedIntent {
  const text = normalizeText(input);
  const rules: string[] = [];
  let intent: RecommendationIntent | undefined;
  let nutrientId: NutrientId | undefined;
  let mealType: MealType | undefined;
  let maxCalories: number | undefined;
  let maxPrepTimeMinutes: number | undefined;
  let ingredientTerms: string[] = [];
  let confidence = 0.4;

  for (const [re, mt] of MEAL_WORDS) {
    if (re.test(text)) {
      mealType = mt;
      rules.push(`meal:${mt}`);
      break;
    }
  }

  const cal = /\b(?:under|below|less than|max|maximum|up to|<)\s*(\d{2,4})\s*(?:kcal|cal|calories)?\b/.exec(text) ?? /\b(\d{2,4})\s*(?:kcal|cal|calories)\b/.exec(text);
  if (cal) {
    maxCalories = Number(cal[1]);
    rules.push('max_calories');
  }
  const time = /\b(\d{1,3})\s*(?:min|mins|minute|minutes)\b/.exec(text);
  if (time) {
    maxPrepTimeMinutes = Number(time[1]);
    rules.push('max_prep');
  } else if (/\b(quick|fast|easy|no cook|no cooking)\b/.test(text)) {
    maxPrepTimeMinutes = /no cook/.test(text) ? 5 : 15;
    rules.push('quick');
  }

  const micro = findMicronutrient(text);
  const wantsNutrient = /\b(rich|high|more|source|boost|increase|lots|plenty|good)\b/.test(text) || /\bfoods? (with|for)\b/.test(text);
  // Keep commas/ampersands for list splitting.
  const soft = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9%,&]+/g, ' ').replace(/\s+/g, ' ').trim();
  const ingredientMatch = /\b(?:with|using|use|have|got|from|leftover)\s+(?:some\s+|my\s+|the\s+)?(.+)$/.exec(soft);

  if (micro && (wantsNutrient || !/\bprotein|fiber|fibre\b/.test(text))) {
    intent = 'micronutrient';
    nutrientId = micro;
    confidence = 0.85;
    rules.push(`micronutrient:${micro}`);
  } else if (/\bprotein\b/.test(text)) {
    intent = 'high_protein';
    confidence = 0.85;
    rules.push('high_protein');
  } else if (/\b(fiber|fibre)\b/.test(text)) {
    intent = 'high_fiber';
    confidence = 0.85;
    rules.push('high_fiber');
  } else if (/\b(low cal|low calorie|low calories|light|lighter|diet|fewer calories|low energy)\b/.test(text) || (maxCalories !== undefined && !mealType)) {
    intent = 'low_calorie';
    confidence = 0.8;
    rules.push('low_calorie');
  } else if (/\b(remaining|left|rest of (my|the) day|hit my|reach my|my goals|my macros|my targets|fit my)\b/.test(text)) {
    intent = 'fit_remaining';
    confidence = 0.8;
    rules.push('fit_remaining');
  } else if (ingredientMatch && /\b(make|cook|prepare|using|use|have|got|leftover)\b/.test(text)) {
    intent = 'use_ingredients';
    confidence = 0.75;
    rules.push('use_ingredients');
  } else if (mealType || /\b(suggest|recommend|idea|ideas|what should i eat|what to eat|meal)\b/.test(text)) {
    intent = 'meal';
    confidence = mealType ? 0.75 : 0.55;
    rules.push('meal');
  }

  if (ingredientMatch && (intent === 'use_ingredients' || intent === 'meal')) {
    ingredientTerms = ingredientMatch[1]!
      .replace(/\b(\d+)\s*(min|mins|minutes|kcal|calories)\b/g, ' ')
      .split(/,| and | & | plus /)
      .map((s) => s.replace(/\b(for|in|at|under|tonight|today|dinner|lunch|breakfast|snack|please|some|a|an|the|my|i|what|can|make)\b/g, ' ').trim().replace(/\s+/g, ' '))
      .filter((s) => s.length >= 2);
    if (ingredientTerms.length && intent === 'meal') {
      intent = 'use_ingredients';
      rules.push('use_ingredients');
    }
  }

  if (!intent) {
    intent = 'meal';
    rules.push('fallback');
    confidence = 0.3;
  }

  return {
    request: {
      intent,
      ...(mealType ? { mealType } : {}),
      ...(nutrientId ? { nutrientId } : {}),
      ...(maxCalories !== undefined ? { maxCalories } : {}),
      ...(maxPrepTimeMinutes !== undefined ? { maxPrepTimeMinutes } : {}),
    },
    ingredientTerms,
    confidence,
    matchedRules: rules,
  };
}
