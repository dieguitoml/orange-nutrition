import type { DailyGoals, DailyNutritionSummary, FrequentFood, LocalDate, MealEntry, NutrientTrendPoint, WeeklyNutritionSummary } from '../types/domain';
import { MEAL_TYPES } from '../types/domain';
import type { NutrientId } from '../types/nutrients';
import { NUTRIENT_IDS } from '../types/nutrients';
import { averageTotals, goalProgress, mealTotals, remainingCalories } from './calculations';

/** Pure aggregation helpers for history/analytics (no I/O). */

/** Goals in effect on a date given goals sorted ascending by effectiveFrom. */
export function goalsForDate(sortedGoals: readonly DailyGoals[], date: LocalDate): DailyGoals | null {
  let found: DailyGoals | null = null;
  for (const g of sortedGoals) {
    if (g.effectiveFrom <= date) found = g;
    else break;
  }
  return found;
}

export function buildDailySummary(date: LocalDate, entries: readonly MealEntry[], goals: DailyGoals | null): DailyNutritionSummary {
  const { total, byMeal } = mealTotals(entries.filter((e) => e.date === date));
  return {
    date,
    entryCount: MEAL_TYPES.reduce((s, m) => s + byMeal[m].entryCount, 0),
    totals: total,
    byMeal: Object.fromEntries(MEAL_TYPES.map((m) => [m, { mealType: m, ...byMeal[m] }])) as DailyNutritionSummary['byMeal'],
    goals,
    progress: goalProgress(total, goals),
    remainingCalories: remainingCalories(total, goals),
  };
}

/** Groups entries by date in a single pass. */
export function groupByDate(entries: readonly MealEntry[]): Map<LocalDate, MealEntry[]> {
  const map = new Map<LocalDate, MealEntry[]>();
  for (const e of entries) {
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }
  return map;
}

export function buildRangeSummaries(dates: readonly LocalDate[], entries: readonly MealEntry[], sortedGoals: readonly DailyGoals[]): DailyNutritionSummary[] {
  const byDate = groupByDate(entries);
  return dates.map((d) => buildDailySummary(d, byDate.get(d) ?? [], goalsForDate(sortedGoals, d)));
}

/** Adherence over LOGGED days only. */
export function computeAdherence(days: readonly DailyNutritionSummary[]): WeeklyNutritionSummary['adherence'] {
  const out: WeeklyNutritionSummary['adherence'] = {};
  for (const day of days) {
    if (day.entryCount === 0) continue;
    for (const [id, p] of Object.entries(day.progress)) {
      const a = (out[id as NutrientId] ??= { daysMet: 0, daysEvaluated: 0, ratio: 0 });
      a.daysEvaluated++;
      if (p.status === 'met') a.daysMet++;
    }
  }
  for (const a of Object.values(out)) a.ratio = a.daysEvaluated ? a.daysMet / a.daysEvaluated : 0;
  return out;
}

export function buildPeriodSummary(days: DailyNutritionSummary[]): WeeklyNutritionSummary {
  const logged = days.filter((d) => d.entryCount > 0);
  return {
    startDate: days[0]?.date ?? '',
    endDate: days[days.length - 1]?.date ?? '',
    loggedDays: logged.length,
    averages: averageTotals(logged.map((d) => d.totals)),
    days,
    adherence: computeAdherence(days),
  };
}

export function buildTrend(nutrientId: NutrientId, days: readonly DailyNutritionSummary[]): NutrientTrendPoint[] {
  return days.map((d) => {
    const logged = d.entryCount > 0;
    const t = d.totals[nutrientId];
    return {
      date: d.date,
      logged,
      amount: logged ? t.amount : null,
      coverageRatio: logged ? t.coverage.ratio : null,
      target: d.goals?.targets[nutrientId]?.amount ?? null,
    };
  });
}

export function mostFrequentFoods(entries: readonly MealEntry[], limit = 10): FrequentFood[] {
  const map = new Map<string, FrequentFood>();
  for (const e of entries) {
    const key = e.foodId ? `food:${e.foodId}` : e.recipeId ? `recipe:${e.recipeId}` : `name:${e.snapshot.name}`;
    const f = map.get(key);
    if (f) {
      f.count++;
      f.totalGrams += e.grams;
      if (e.loggedAt > f.lastLoggedAt) {
        f.lastLoggedAt = e.loggedAt;
        f.name = e.snapshot.name;
      }
    } else {
      map.set(key, { key, ...(e.foodId ? { foodId: e.foodId } : {}), ...(e.recipeId ? { recipeId: e.recipeId } : {}), name: e.snapshot.name, count: 1, totalGrams: e.grams, lastLoggedAt: e.loggedAt });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.lastLoggedAt.localeCompare(a.lastLoggedAt)).slice(0, limit);
}

export interface NutrientCoverageIndicator {
  nutrientId: NutrientId;
  /** Mean coverage ratio over logged days (0..1). */
  averageCoverage: number;
  /** Days on which every entry had data for this nutrient. */
  completeDays: number;
  loggedDays: number;
  level: 'good' | 'partial' | 'poor' | 'none';
}

/** How reliable each nutrient's intake numbers are over a period (data coverage, not intake). */
export function coverageIndicators(days: readonly DailyNutritionSummary[]): NutrientCoverageIndicator[] {
  const logged = days.filter((d) => d.entryCount > 0);
  return NUTRIENT_IDS.map((id) => {
    if (logged.length === 0) return { nutrientId: id, averageCoverage: 0, completeDays: 0, loggedDays: 0, level: 'none' as const };
    const avg = logged.reduce((s, d) => s + d.totals[id].coverage.ratio, 0) / logged.length;
    const completeDays = logged.filter((d) => d.totals[id].coverage.isComplete).length;
    const level = avg >= 0.9 ? 'good' : avg >= 0.6 ? 'partial' : avg > 0 ? 'poor' : 'none';
    return { nutrientId: id, averageCoverage: avg, completeDays, loggedDays: logged.length, level };
  });
}
