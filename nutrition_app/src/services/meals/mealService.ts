import type { EntryOrigin, LocalDate, MealEntry, MealType, Quantity } from '../../core/types/domain';
import { MEAL_TYPES } from '../../core/types/domain';
import { nutrientsForQuantity, mealTotals } from '../../core/nutrition/calculations';
import { assertLocalDate, nowIso } from '../../core/utils/dates';
import { createId } from '../../core/utils/ids';
import { DataError } from '../../core/utils/errors';
import { getDb, guard } from '../../data/db';
import { foodRepository, mealEntryRepository } from '../../data/repositories';
import { snapshotOf } from './snapshot';

export interface AddFoodEntryInput {
  date: LocalDate;
  mealType: MealType;
  foodId: string;
  quantity: Quantity;
  note?: string;
  /** Defaults to now. */
  loggedAt?: string;
  /** e.g. 'barcode' when the food came from a scan (default 'manual'). */
  origin?: EntryOrigin;
  /** Attach a locally stored photo. */
  photoId?: string;
}

/** Logs a food. The food's current nutrition is frozen into the entry. */
export async function addMealEntry(input: AddFoodEntryInput): Promise<MealEntry> {
  assertLocalDate(input.date);
  const food = await foodRepository.getOrThrow(input.foodId);
  const snapshot = snapshotOf(food);
  const { grams, nutrients } = await guard('Add meal entry', async () => nutrientsForQuantity(snapshot, input.quantity));
  const now = nowIso();
  return mealEntryRepository.add({
    id: createId('meal'),
    date: input.date,
    mealType: input.mealType,
    kind: 'food',
    foodId: food.id,
    snapshot,
    quantity: input.quantity,
    grams,
    nutrients,
    ...(input.note ? { note: input.note } : {}),
    origin: input.origin ?? 'manual',
    ...(input.photoId ? { photoId: input.photoId } : {}),
    loggedAt: input.loggedAt ?? now,
    createdAt: now,
    updatedAt: now,
  });
}

export interface UpdateMealEntryInput {
  quantity?: Quantity;
  mealType?: MealType;
  date?: LocalDate;
  note?: string | null;
}

/** Edits an entry. Nutrition is recomputed from the entry's own snapshot (history stays stable). */
export async function updateMealEntry(id: string, patch: UpdateMealEntryInput): Promise<MealEntry> {
  if (patch.date) assertLocalDate(patch.date);
  const db = getDb();
  return guard('Update meal entry', () =>
    db.transaction('rw', db.mealEntries, async () => {
      const e = await mealEntryRepository.getOrThrow(id);
      const next: MealEntry = { ...e, updatedAt: nowIso() };
      if (patch.mealType) next.mealType = patch.mealType;
      if (patch.date) next.date = patch.date;
      if (patch.note === null) delete next.note;
      else if (patch.note !== undefined) next.note = patch.note;
      if (patch.quantity) {
        const r = nutrientsForQuantity(e.snapshot, patch.quantity);
        next.quantity = patch.quantity;
        next.grams = r.grams;
        next.nutrients = r.nutrients;
      }
      return mealEntryRepository.put(next);
    }),
  );
}

/** Deletes an entry; its photo is removed too when no other entry uses it. */
export async function deleteMealEntry(id: string): Promise<void> {
  const e = await mealEntryRepository.getOrThrow(id);
  const db = getDb();
  await guard('Delete meal entry', () =>
    db.transaction('rw', db.mealEntries, db.photos, async () => {
      await db.mealEntries.delete(id);
      if (e.photoId && (await db.mealEntries.where('photoId').equals(e.photoId).count()) === 0) await db.photos.delete(e.photoId);
    }),
  );
}

/** Duplicates one entry (same snapshot), optionally to another date/meal. */
export async function duplicateMealEntry(id: string, target: { date?: LocalDate; mealType?: MealType } = {}): Promise<MealEntry> {
  const e = await mealEntryRepository.getOrThrow(id);
  if (target.date) assertLocalDate(target.date);
  const now = nowIso();
  return mealEntryRepository.add({ ...structuredClone(e), id: createId('meal'), date: target.date ?? e.date, mealType: target.mealType ?? e.mealType, origin: 'copy', loggedAt: now, createdAt: now, updatedAt: now });
}

export interface CopyMealsInput {
  fromDate: LocalDate;
  toDate: LocalDate;
  /** Copy only this meal (default: whole day). */
  mealType?: MealType;
  /** Put copies into this meal (only valid with mealType). */
  toMealType?: MealType;
}

/** Copies entries between dates atomically. Returns the new entries. */
export async function copyMeals(input: CopyMealsInput): Promise<MealEntry[]> {
  assertLocalDate(input.fromDate);
  assertLocalDate(input.toDate);
  if (input.toMealType && !input.mealType) throw new DataError('VALIDATION', 'toMealType requires mealType');
  const source = input.mealType ? await mealEntryRepository.byDateAndMealType(input.fromDate, input.mealType) : await mealEntryRepository.byDate(input.fromDate);
  if (source.length === 0) return [];
  const base = Date.now();
  const copies = source.map((e, i) => {
    const ts = new Date(base + i).toISOString(); // preserves order
    return { ...structuredClone(e), id: createId('meal'), date: input.toDate, mealType: input.toMealType ?? e.mealType, origin: 'copy' as const, loggedAt: ts, createdAt: ts, updatedAt: ts };
  });
  return mealEntryRepository.bulkAdd(copies);
}

/** Entries for a day grouped by meal type (each group ordered by time). */
export async function getDailyMeals(date: LocalDate): Promise<Record<MealType, MealEntry[]>> {
  assertLocalDate(date);
  const entries = await mealEntryRepository.byDate(date);
  const out = Object.fromEntries(MEAL_TYPES.map((m) => [m, [] as MealEntry[]])) as Record<MealType, MealEntry[]>;
  for (const e of entries) out[e.mealType].push(e);
  return out;
}

export async function getMealsByCategory(date: LocalDate, mealType: MealType): Promise<MealEntry[]> {
  assertLocalDate(date);
  return mealEntryRepository.byDateAndMealType(date, mealType);
}

/** Totals for a day (overall + per meal). See history service for goal-aware summaries. */
export async function calculateDailyTotals(date: LocalDate) {
  assertLocalDate(date);
  return mealTotals(await mealEntryRepository.byDate(date));
}

export const getMealEntry = (id: string) => mealEntryRepository.get(id);
