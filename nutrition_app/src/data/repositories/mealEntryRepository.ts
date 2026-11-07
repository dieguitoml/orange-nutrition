import type { LocalDate, MealEntry, MealType } from '../../core/types/domain';
import { mealEntrySchema } from '../../core/validation/schemas';
import { DataError } from '../../core/utils/errors';
import { getDb, guard } from '../db';

const validate = (e: MealEntry): MealEntry => mealEntrySchema.parse(e) as MealEntry;
const byLoggedAt = (a: MealEntry, b: MealEntry) => a.loggedAt.localeCompare(b.loggedAt) || a.createdAt.localeCompare(b.createdAt);

export const mealEntryRepository = {
  async add(entry: MealEntry): Promise<MealEntry> {
    return guard('Add meal entry', async () => {
      const e = validate(entry);
      await getDb().mealEntries.add(e);
      return e;
    });
  },

  async bulkAdd(entries: MealEntry[]): Promise<MealEntry[]> {
    return guard('Add meal entries', async () => {
      const list = entries.map(validate);
      const db = getDb();
      await db.transaction('rw', db.mealEntries, () => db.mealEntries.bulkAdd(list));
      return list;
    });
  },

  async put(entry: MealEntry): Promise<MealEntry> {
    return guard('Save meal entry', async () => {
      const e = validate(entry);
      await getDb().mealEntries.put(e);
      return e;
    });
  },

  async get(id: string): Promise<MealEntry | null> {
    return guard('Get meal entry', async () => (await getDb().mealEntries.get(id)) ?? null);
  },

  async getOrThrow(id: string): Promise<MealEntry> {
    const e = await mealEntryRepository.get(id);
    if (!e) throw new DataError('NOT_FOUND', `Meal entry ${id} not found`);
    return e;
  },

  async delete(id: string): Promise<void> {
    return guard('Delete meal entry', () => getDb().mealEntries.delete(id));
  },

  async byDate(date: LocalDate): Promise<MealEntry[]> {
    return guard('Get meals by date', async () => (await getDb().mealEntries.where('date').equals(date).toArray()).sort(byLoggedAt));
  },

  async byDateAndMealType(date: LocalDate, mealType: MealType): Promise<MealEntry[]> {
    return guard('Get meals by category', async () => (await getDb().mealEntries.where('[date+mealType]').equals([date, mealType]).toArray()).sort(byLoggedAt));
  },

  /** Inclusive date range, sorted by date then time. */
  async byDateRange(start: LocalDate, end: LocalDate): Promise<MealEntry[]> {
    return guard('Get meals by date range', async () =>
      (await getDb().mealEntries.where('date').between(start, end, true, true).toArray()).sort((a, b) => a.date.localeCompare(b.date) || byLoggedAt(a, b)),
    );
  },

  async byMealType(mealType: MealType, limit = 200): Promise<MealEntry[]> {
    return guard('Get meals by type', async () => {
      const list = await getDb().mealEntries.where('mealType').equals(mealType).toArray();
      return list.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)).slice(0, limit);
    });
  },

  /** Most recent entries first, scanning the loggedAt index lazily. */
  async recent(limit = 50, filter?: (e: MealEntry) => boolean): Promise<MealEntry[]> {
    return guard('Get recent meals', async () => {
      const out: MealEntry[] = [];
      await getDb()
        .mealEntries.orderBy('loggedAt')
        .reverse()
        .until(() => out.length >= limit)
        .each((e) => {
          if (!filter || filter(e)) out.push(e);
        });
      return out;
    });
  },

  async loggedSince(isoTimestamp: string): Promise<MealEntry[]> {
    return guard('Get meals since', () => getDb().mealEntries.where('loggedAt').aboveOrEqual(isoTimestamp).toArray());
  },

  async all(): Promise<MealEntry[]> {
    return guard('List meal entries', () => getDb().mealEntries.toArray());
  },
};
