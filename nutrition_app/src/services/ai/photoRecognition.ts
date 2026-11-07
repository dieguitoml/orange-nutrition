import { z } from 'zod';
import type { DetectedFood, FoodSearchResult, LocalDate, MealEntry, MealType, PhotoRecognitionItem, PhotoRecognitionResult, Quantity } from '../../core/types/domain';
import { nutrientsForGrams, nutrientsForQuantity, sumNutrients } from '../../core/nutrition/calculations';
import { assertLocalDate, nowIso } from '../../core/utils/dates';
import { createId } from '../../core/utils/ids';
import { DataError } from '../../core/utils/errors';
import { getDb, guard } from '../../data/db';
import { foodRepository, mealEntryRepository } from '../../data/repositories';
import { bytesToBase64, GeminiError, type GeminiSchema } from '../../integrations/gemini/client';
import { searchFoods } from '../food/foodService';
import { snapshotOf } from '../meals/snapshot';
import { getAiClient, getAiSettings } from './settings';
import { MAX_PHOTO_BYTES, prepareImage, savePhoto, type PreparedImage } from './photos';

const SYSTEM = `You identify foods in meal photos for a personal nutrition tracking app.
For each distinct food or drink visible:
- "name": a short generic English name as it would appear in a food composition database, including the preparation when visible (e.g. "white rice, cooked", "chicken breast, grilled", "banana", "whole milk").
- "searchTerms": 1-3 simpler alternatives (e.g. ["rice", "white rice"]).
- "estimatedGrams": your best visual estimate of the edible weight in grams, using cues like plate size (~26 cm), cutlery and hands.
- "confidence": 0 to 1.
- "preparation": raw, cooked, grilled, fried, baked, boiled, roasted, steamed, dried, or unknown.
For a mixed dish that cannot be separated (e.g. lasagna), list it as one item and add its main components as searchTerms.
NEVER output calories or nutrient values. If the photo contains no food, set "isFood" to false and return an empty "items" array.`;

const SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    isFood: { type: 'BOOLEAN' },
    description: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          searchTerms: { type: 'ARRAY', items: { type: 'STRING' } },
          estimatedGrams: { type: 'NUMBER' },
          confidence: { type: 'NUMBER' },
          preparation: { type: 'STRING' },
        },
        required: ['name', 'searchTerms', 'estimatedGrams', 'confidence'],
      },
    },
  },
  required: ['isFood', 'description', 'items'],
};

const responseSchema = z.object({
  isFood: z.boolean(),
  description: z.string().max(500).catch(''),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        searchTerms: z.array(z.string().trim().min(1).max(80)).max(5).catch([]),
        estimatedGrams: z.number().finite().catch(100),
        confidence: z.number().finite().catch(0.5),
        preparation: z.string().max(40).optional().catch(undefined),
      }),
    )
    .max(15),
});

const COOKED = /\b(cooked|grilled|fried|baked|boiled|roasted|steamed|scrambled|broiled|sauteed|stewed)\b/;

/** Ranks local foods for one detected item. Prefers forms matching the visible preparation. */
export async function matchDetectedFood(d: DetectedFood, limit = 5): Promise<FoodSearchResult[]> {
  const merged = new Map<string, FoodSearchResult>();
  const queries = [d.name, ...d.searchTerms].filter((q, i, a) => a.indexOf(q) === i);
  for (const [qi, q] of queries.entries()) {
    for (const r of await searchFoods(q, { limit: 8 })) {
      const prep = `${d.preparation ?? ''} ${d.name}`.toLowerCase();
      let score = r.score - qi * 400; // matches on the primary name always beat fallback terms
      if (COOKED.test(prep)) score += r.food.form === 'cooked' ? 40 : r.food.form === 'raw' || r.food.form === 'dry' ? -60 : 0;
      else if (/\braw\b/.test(prep)) score += r.food.form === 'raw' || r.food.form === 'ready' ? 20 : -20;
      else if (r.food.form === 'dry' && !/\bdr(y|ied)\b/.test(prep)) score -= 60;
      const prev = merged.get(r.food.id);
      if (!prev || prev.score < score) merged.set(r.food.id, { ...r, score });
    }
  }
  let list = [...merged.values()];
  if (list.some((r) => r.matchType !== 'partial')) list = list.filter((r) => r.matchType !== 'partial');
  return list.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name)).slice(0, limit);
}

export interface RecognizeOptions {
  /** Optional user hint, e.g. "homemade, no sauce". */
  hint?: string;
  mealType?: MealType;
  /** Store the photo locally to attach to the logged entries (default true). */
  savePhoto?: boolean;
}

/**
 * Sends the photo to the AI provider, then maps every detected item to LOCAL foods.
 * Nothing is logged: show the result for confirmation, then call `logPhotoMeal`.
 * Errors: DataError('UNAVAILABLE') when AI is off/unconfigured or the provider fails
 * (details.code = GeminiErrorCode) — fall back to manual search.
 */
export async function recognizeMealPhoto(image: Blob | ArrayBuffer | PreparedImage, opts: RecognizeOptions = {}): Promise<PhotoRecognitionResult> {
  const client = await getAiClient('photo');
  const settings = await getAiSettings();
  const prepared = 'data' in (image as PreparedImage) && (image as PreparedImage).data instanceof ArrayBuffer ? (image as PreparedImage) : await prepareImage(image as Blob | ArrayBuffer);
  if (prepared.data.byteLength === 0) throw new DataError('VALIDATION', 'Empty image');
  if (prepared.data.byteLength > MAX_PHOTO_BYTES) throw new DataError('VALIDATION', 'Photo is too large');

  let raw: unknown;
  try {
    raw = await client.generateJson({
      system: SYSTEM,
      parts: [
        { text: `Identify the foods in this ${opts.mealType ?? 'meal'} photo.${opts.hint ? ` User note: ${opts.hint.slice(0, 300)}` : ''}` },
        { inline_data: { mime_type: prepared.mimeType, data: bytesToBase64(prepared.data) } },
      ],
      schema: SCHEMA,
      temperature: 0.1,
    });
  } catch (e) {
    if (e instanceof GeminiError) throw new DataError('UNAVAILABLE', e.message, { code: e.code }, { cause: e });
    throw e;
  }
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) throw new DataError('UNAVAILABLE', 'The AI answer could not be understood', { code: 'INVALID_RESPONSE' });

  const items: PhotoRecognitionItem[] = [];
  for (const it of parsed.data.isFood ? parsed.data.items : []) {
    const detected: DetectedFood = {
      name: it.name,
      searchTerms: it.searchTerms,
      estimatedGrams: Math.min(2000, Math.max(1, it.estimatedGrams)),
      confidence: Math.min(1, Math.max(0, it.confidence)),
      ...(it.preparation ? { preparation: it.preparation } : {}),
    };
    const matches = await matchDetectedFood(detected);
    const best = matches[0] ?? null;
    const grams = Math.round(detected.estimatedGrams);
    items.push({ id: createId('det'), detected, matches, selectedFoodId: best?.food.id ?? null, grams, nutrients: best ? nutrientsForGrams(best.food, grams) : {} });
  }

  const photo = opts.savePhoto === false ? null : await savePhoto(prepared);
  const matched = items.filter((i) => i.selectedFoodId);
  return {
    id: createId('rec_photo'),
    isFood: parsed.data.isFood,
    description: parsed.data.description,
    items,
    totals: sumNutrients(matched.map((i) => ({ grams: i.grams, nutrients: i.nutrients }))),
    unmatchedCount: items.length - matched.length,
    ...(photo ? { photoId: photo.id } : {}),
    provider: 'gemini',
    model: client.lastModel ?? settings.model,
    createdAt: nowIso(),
  };
}

export interface PhotoMealItemInput {
  foodId: string;
  /** Either grams or a full quantity (servings, oz, ...). */
  grams?: number;
  quantity?: Quantity;
}

export interface LogPhotoMealInput {
  date: LocalDate;
  mealType: MealType;
  items: PhotoMealItemInput[];
  photoId?: string;
  note?: string;
}

/** Logs the user-confirmed items atomically (origin 'photo_ai', photo attached). */
export async function logPhotoMeal(input: LogPhotoMealInput): Promise<MealEntry[]> {
  assertLocalDate(input.date);
  if (input.items.length === 0) throw new DataError('VALIDATION', 'Select at least one food');
  const foods = await foodRepository.getMany(input.items.map((i) => i.foodId));
  const base = Date.now();
  const entries: MealEntry[] = input.items.map((item, i) => {
    const food = foods.get(item.foodId);
    if (!food) throw new DataError('NOT_FOUND', `Food ${item.foodId} not found`);
    const quantity: Quantity = item.quantity ?? { amount: item.grams ?? 0, unit: 'g' };
    if (!(quantity.amount > 0)) throw new DataError('VALIDATION', `Quantity for ${food.name} must be > 0`);
    const snapshot = snapshotOf(food);
    let r: { grams: number; nutrients: MealEntry['nutrients'] };
    try {
      r = nutrientsForQuantity(snapshot, quantity);
    } catch (e) {
      throw new DataError('CONVERSION', `${food.name}: ${(e as Error).message}`);
    }
    const ts = new Date(base + i).toISOString();
    return {
      id: createId('meal'),
      date: input.date,
      mealType: input.mealType,
      kind: 'food',
      foodId: food.id,
      snapshot,
      quantity,
      grams: r.grams,
      nutrients: r.nutrients,
      ...(input.note ? { note: input.note } : {}),
      origin: 'photo_ai',
      ...(input.photoId ? { photoId: input.photoId } : {}),
      loggedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    };
  });
  const db = getDb();
  if (input.photoId && !(await db.photos.get(input.photoId))) throw new DataError('NOT_FOUND', 'Photo not found');
  return guard('Log photo meal', () => db.transaction('rw', db.mealEntries, () => mealEntryRepository.bulkAdd(entries)));
}
