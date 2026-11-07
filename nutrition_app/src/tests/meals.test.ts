import { beforeEach, describe, expect, it } from 'vitest';
import { foodRepository } from '../data/repositories';
import { addMealEntry, copyMeals, deleteMealEntry, duplicateMealEntry, getDailyMeals, getMealsByCategory, updateMealEntry, calculateDailyTotals } from '../services/meals';
import { getRecentFoods, updateFood } from '../services/food';
import { setMacroGoals, setGoals, updatePreferences, applyReferenceMicronutrientTargets } from '../services/goals';
import { getDailySummary, getGoalAdherence, getMealHistory, getMostFrequentFoods, getNutrientCoverage, getNutrientTrend, getWeeklySummary } from '../services/history';
import { freshDb, k, makeFood, z } from './helpers';

const oats = makeFood('oats', { energy: k(379), protein: k(13.15), carbohydrate: k(67.7), fat: k(6.52), fiber: k(10.1), iron: k(4.25) }, { name: 'Oats', servings: [{ id: 'oats_cup', label: '1/2 cup', grams: 40.5, isDefault: true }] });
const milk = makeFood('milk', { energy: k(61), protein: k(3.15), carbohydrate: k(4.8), fat: k(3.25), fiber: z() }, { name: 'Milk', densityGPerMl: 1.03 });
const apple = makeFood('apple', { energy: k(52), protein: k(0.26), carbohydrate: k(13.81), fat: k(0.17), fiber: k(2.4) }, { name: 'Apple' });

describe('meal logging services', () => {
  beforeEach(async () => {
    await freshDb();
    await foodRepository.bulkPut([oats, milk, apple]);
  });

  it('adds entries with frozen nutrition snapshots', async () => {
    const e = await addMealEntry({ date: '2026-11-07', mealType: 'breakfast', foodId: 'oats', quantity: { amount: 1, unit: 'serving', servingId: 'oats_cup' } });
    expect(e.grams).toBeCloseTo(40.5, 10);
    expect(e.nutrients.energy?.amount).toBeCloseTo(379 * 0.405, 10);
    // editing the food later does not change history
    await foodRepository.update('oats', { nutrientsPer100g: { energy: k(999) } });
    const s = await getDailySummary('2026-11-07');
    expect(s.totals.energy.amount).toBeCloseTo(379 * 0.405, 10);
  });

  it('volume units use density', async () => {
    const e = await addMealEntry({ date: '2026-11-07', mealType: 'breakfast', foodId: 'milk', quantity: { amount: 250, unit: 'ml' } });
    expect(e.grams).toBeCloseTo(257.5, 10);
  });

  it('rejects invalid dates and unknown foods', async () => {
    await expect(addMealEntry({ date: '2026-02-30', mealType: 'lunch', foodId: 'apple', quantity: { amount: 1, unit: 'g' } })).rejects.toThrow();
    await expect(addMealEntry({ date: '2026-02-03', mealType: 'lunch', foodId: 'nope', quantity: { amount: 1, unit: 'g' } })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(addMealEntry({ date: '2026-02-03', mealType: 'lunch', foodId: 'apple', quantity: { amount: 1, unit: 'cup' } })).rejects.toMatchObject({ code: 'CONVERSION' });
  });

  it('edits, duplicates, copies and deletes entries', async () => {
    const e = await addMealEntry({ date: '2026-11-07', mealType: 'breakfast', foodId: 'apple', quantity: { amount: 100, unit: 'g' } });
    const edited = await updateMealEntry(e.id, { quantity: { amount: 200, unit: 'g' }, mealType: 'snack', note: 'big apple' });
    expect(edited.nutrients.energy?.amount).toBe(104);
    expect(edited.mealType).toBe('snack');
    const dup = await duplicateMealEntry(e.id, { mealType: 'lunch' });
    expect(dup.id).not.toBe(e.id);
    await addMealEntry({ date: '2026-11-07', mealType: 'breakfast', foodId: 'oats', quantity: { amount: 50, unit: 'g' } });
    const copied = await copyMeals({ fromDate: '2026-11-07', toDate: '2026-11-08' });
    expect(copied).toHaveLength(3);
    const lunchOnly = await copyMeals({ fromDate: '2026-11-07', toDate: '2026-11-09', mealType: 'lunch', toMealType: 'dinner' });
    expect(lunchOnly.map((x) => x.mealType)).toEqual(['dinner']);
    const day = await getDailyMeals('2026-11-08');
    expect(day.snack).toHaveLength(1);
    expect(day.lunch).toHaveLength(1);
    expect(day.breakfast).toHaveLength(1);
    expect(await getMealsByCategory('2026-11-09', 'dinner')).toHaveLength(1);
    await deleteMealEntry(e.id);
    expect((await getDailyMeals('2026-11-07')).snack).toHaveLength(0);
    await expect(deleteMealEntry(e.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const totals = await calculateDailyTotals('2026-11-08');
    expect(totals.byMeal.breakfast.entryCount).toBe(1);
  });

  it('lists distinct recent foods, newest first', async () => {
    await addMealEntry({ date: '2026-11-06', mealType: 'lunch', foodId: 'apple', quantity: { amount: 100, unit: 'g' }, loggedAt: '2026-11-06T12:00:00.000Z' });
    await addMealEntry({ date: '2026-11-07', mealType: 'breakfast', foodId: 'oats', quantity: { amount: 50, unit: 'g' }, loggedAt: '2026-11-07T08:00:00.000Z' });
    await addMealEntry({ date: '2026-11-07', mealType: 'snack', foodId: 'apple', quantity: { amount: 100, unit: 'g' }, loggedAt: '2026-11-07T16:00:00.000Z' });
    const recent = await getRecentFoods(10);
    expect(recent.map((r) => r.lastEntry.foodId)).toEqual(['apple', 'oats']);
  });

  it('editing a seed/OFF food creates a custom copy', async () => {
    await foodRepository.put(makeFood('usda_x', { energy: k(10) }, { name: 'Seed food', source: { type: 'usda_sr_legacy', attribution: 'USDA', license: 'CC0' } }));
    const copy = await updateFood('usda_x', { nutrientsPer100g: { energy: k(20) } });
    expect(copy.id).not.toBe('usda_x');
    expect(copy.source.type).toBe('user');
    expect((await foodRepository.get('usda_x'))?.nutrientsPer100g.energy?.amount).toBe(10);
  });
});

describe('history & analytics', () => {
  beforeEach(async () => {
    await freshDb();
    await foodRepository.bulkPut([oats, milk, apple]);
  });

  it('daily summary with goals and remaining', async () => {
    await setMacroGoals({ calories: 2000, protein: 120, carbohydrate: 250, fat: 60, fiber: 30 }, '2026-01-01');
    await addMealEntry({ date: '2026-11-07', mealType: 'breakfast', foodId: 'oats', quantity: { amount: 100, unit: 'g' } });
    const s = await getDailySummary('2026-11-07');
    expect(s.remainingCalories).toBeCloseTo(1621, 10);
    expect(s.progress.protein?.remaining).toBeCloseTo(120 - 13.15, 10);
    expect(s.progress.fiber?.percent).toBeCloseTo((10.1 / 30) * 100, 10);
    expect(s.byMeal.breakfast.entryCount).toBe(1);
    expect(s.byMeal.dinner.entryCount).toBe(0);
  });

  it('weekly averages exclude unlogged days and track adherence & coverage', async () => {
    await updatePreferences({ weekStartsOn: 1 });
    await setGoals({ energy: { amount: 500, direction: 'atMost', origin: 'user' } }, '2026-11-01');
    await addMealEntry({ date: '2026-11-02', mealType: 'lunch', foodId: 'apple', quantity: { amount: 200, unit: 'g' } }); // 104 kcal
    await addMealEntry({ date: '2026-11-04', mealType: 'lunch', foodId: 'oats', quantity: { amount: 200, unit: 'g' } }); // 758 kcal
    const w = await getWeeklySummary('2026-11-07');
    expect(w.startDate).toBe('2026-11-02');
    expect(w.endDate).toBe('2026-11-08');
    expect(w.days).toHaveLength(7);
    expect(w.loggedDays).toBe(2);
    expect(w.averages.energy.amount).toBeCloseTo((104 + 758) / 2, 10);
    expect(w.adherence.energy).toEqual({ daysMet: 1, daysEvaluated: 2, ratio: 0.5 });
    const trend = await getNutrientTrend('energy', '2026-11-02', '2026-11-04');
    expect(trend.map((p) => p.amount)).toEqual([104, null, 758]);
    expect(trend[0]?.target).toBe(500);
    const cov = await getNutrientCoverage('2026-11-02', '2026-11-08');
    expect(cov.find((c) => c.nutrientId === 'energy')?.level).toBe('good');
    expect(cov.find((c) => c.nutrientId === 'iron')?.averageCoverage).toBeCloseTo(0.5, 10); // apple lacks iron
    expect((await getGoalAdherence('2026-11-02', '2026-11-08')).energy?.daysMet).toBe(1);
  });

  it('frequent foods and meal history', async () => {
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-03']) await addMealEntry({ date: d, mealType: 'snack', foodId: 'apple', quantity: { amount: 150, unit: 'g' } });
    await addMealEntry({ date: '2026-11-03', mealType: 'breakfast', foodId: 'oats', quantity: { amount: 50, unit: 'g' } });
    const top = await getMostFrequentFoods('2026-11-01', '2026-11-30');
    expect(top[0]).toMatchObject({ foodId: 'apple', count: 3, totalGrams: 450 });
    const hist = await getMealHistory('2026-11-01', '2026-11-03');
    expect(hist.map((h) => h.date)).toEqual(['2026-11-03', '2026-11-02', '2026-11-01']);
    await expect(getMealHistory('2026-11-05', '2026-11-01')).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('reference micronutrient targets fill only unset targets', async () => {
    await setMacroGoals({ calories: 1800 }, '2026-01-01');
    const g = await applyReferenceMicronutrientTargets('2026-01-01');
    expect(g.targets.energy?.amount).toBe(1800);
    expect(g.targets.iron).toMatchObject({ amount: 18, origin: 'reference' });
    expect(g.targets.sugar).toBeUndefined();
  });
});
