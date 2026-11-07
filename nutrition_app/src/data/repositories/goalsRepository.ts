import type { DailyGoals, LocalDate } from '../../core/types/domain';
import { dailyGoalsSchema } from '../../core/validation/schemas';
import { getDb, guard } from '../db';

export const goalsRepository = {
  /** Saves goals; replaces any goals with the same effectiveFrom date. */
  async put(goals: DailyGoals): Promise<DailyGoals> {
    return guard('Save goals', async () => {
      const g = dailyGoalsSchema.parse(goals) as DailyGoals;
      const db = getDb();
      await db.transaction('rw', db.goals, async () => {
        await db.goals.where('effectiveFrom').equals(g.effectiveFrom).and((x) => x.id !== g.id).delete();
        await db.goals.put(g);
      });
      return g;
    });
  },
  /** Goals in effect on `date` (latest effectiveFrom ≤ date), or null. */
  async forDate(date: LocalDate): Promise<DailyGoals | null> {
    return guard('Get goals', async () => (await getDb().goals.where('effectiveFrom').belowOrEqual(date).last()) ?? null);
  },
  async list(): Promise<DailyGoals[]> {
    return guard('List goals', () => getDb().goals.orderBy('effectiveFrom').toArray());
  },
  async delete(id: string): Promise<void> {
    return guard('Delete goals', () => getDb().goals.delete(id));
  },
};
