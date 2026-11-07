import type { DailyNutritionSummary, FrequentFood, LocalDate, MealEntry, NutrientTrendPoint, WeeklyNutritionSummary } from '../../core/types/domain';
import type { NutrientId } from '../../core/types/nutrients';
import {
  buildDailySummary,
  buildPeriodSummary,
  buildRangeSummaries,
  buildTrend,
  computeAdherence,
  coverageIndicators,
  groupByDate,
  mostFrequentFoods,
  type NutrientCoverageIndicator,
} from '../../core/nutrition/summaries';
import { addDays, assertLocalDate, compareLocalDates, dateRange, today, weekRange } from '../../core/utils/dates';
import { DataError } from '../../core/utils/errors';
import { goalsRepository, mealEntryRepository, preferencesRepository } from '../../data/repositories';

const MAX_RANGE_DAYS = 3660;

function checkRange(start: LocalDate, end: LocalDate) {
  assertLocalDate(start);
  assertLocalDate(end);
  if (compareLocalDates(start, end) > 0) throw new DataError('VALIDATION', 'start must be on or before end');
  if (dateRange(start, end).length > MAX_RANGE_DAYS) throw new DataError('VALIDATION', 'Range too large');
}

export async function getDailySummary(date: LocalDate = today()): Promise<DailyNutritionSummary> {
  assertLocalDate(date);
  const [entries, goals] = await Promise.all([mealEntryRepository.byDate(date), goalsRepository.forDate(date)]);
  return buildDailySummary(date, entries, goals);
}

/** One indexed range query + in-memory grouping (efficient for long histories). */
export async function getDailySummaries(start: LocalDate, end: LocalDate): Promise<DailyNutritionSummary[]> {
  checkRange(start, end);
  const [entries, goals] = await Promise.all([mealEntryRepository.byDateRange(start, end), goalsRepository.list()]);
  return buildRangeSummaries(dateRange(start, end), entries, goals);
}

/** Week containing `date`, using the user's weekStartsOn preference. Averages use logged days only. */
export async function getWeeklySummary(date: LocalDate = today()): Promise<WeeklyNutritionSummary> {
  assertLocalDate(date);
  const prefs = await preferencesRepository.get();
  const { start, end } = weekRange(date, prefs.weekStartsOn);
  return buildPeriodSummary(await getDailySummaries(start, end));
}

/** Rolling N-day period ending on `end` (inclusive). */
export async function getPeriodSummary(end: LocalDate = today(), days = 7): Promise<WeeklyNutritionSummary> {
  return buildPeriodSummary(await getDailySummaries(addDays(end, -(days - 1)), end));
}

export async function getNutrientTrend(nutrientId: NutrientId, start: LocalDate, end: LocalDate): Promise<NutrientTrendPoint[]> {
  return buildTrend(nutrientId, await getDailySummaries(start, end));
}

export async function getGoalAdherence(start: LocalDate, end: LocalDate): Promise<WeeklyNutritionSummary['adherence']> {
  return computeAdherence(await getDailySummaries(start, end));
}

export async function getMostFrequentFoods(start: LocalDate, end: LocalDate, limit = 10): Promise<FrequentFood[]> {
  checkRange(start, end);
  return mostFrequentFoods(await mealEntryRepository.byDateRange(start, end), limit);
}

/** Entries grouped by date, newest date first. */
export async function getMealHistory(start: LocalDate, end: LocalDate): Promise<{ date: LocalDate; entries: MealEntry[] }[]> {
  checkRange(start, end);
  const grouped = groupByDate(await mealEntryRepository.byDateRange(start, end));
  return [...grouped.entries()].sort((a, b) => compareLocalDates(b[0], a[0])).map(([date, entries]) => ({ date, entries }));
}

export async function getNutrientCoverage(start: LocalDate, end: LocalDate): Promise<NutrientCoverageIndicator[]> {
  return coverageIndicators(await getDailySummaries(start, end));
}
