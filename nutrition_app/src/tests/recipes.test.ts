import { beforeEach, describe, expect, it } from 'vitest';
import { foodRepository } from '../data/repositories';
import { addIngredient, createRecipe, deleteRecipe, getRecipeNutrition, logRecipe, removeIngredient, updateIngredient, updateRecipe } from '../services/recipes';
import { getDailySummary } from '../services/history';
import { freshDb, k, makeFood, z } from './helpers';

const pasta = makeFood('pasta', { energy: k(158), protein: k(5.8), carbohydrate: k(30.9), fat: k(0.93), fiber: k(1.8), iron: k(1.28) }, { name: 'Pasta, cooked' });
const sauce = makeFood('sauce', { energy: k(50), protein: k(1.4), carbohydrate: k(8), fat: k(1.5), fiber: k(1.9) }, { name: 'Marinara' }); // no iron
const cheese = makeFood('cheese', { energy: k(392), protein: k(35.8), carbohydrate: k(3.2), fat: k(25.8), fiber: z(), iron: k(0.82) }, { name: 'Parmesan', servings: [{ id: 'tbsp', label: '1 tbsp', grams: 5 }] });

describe('recipe engine', () => {
  beforeEach(async () => {
    await freshDb();
    await foodRepository.bulkPut([pasta, sauce, cheese]);
  });

  it('creates recipes and computes totals / per serving with coverage', async () => {
    const r = await createRecipe({ name: 'Pasta marinara', servings: 2, ingredients: [{ foodId: 'pasta', quantity: { amount: 400, unit: 'g' } }, { foodId: 'sauce', quantity: { amount: 250, unit: 'g' } }] });
    const n = await getRecipeNutrition(r.id);
    expect(n.total.energy.amount).toBeCloseTo(632 + 125, 10);
    expect(n.perServing.protein.amount).toBeCloseTo((23.2 + 3.5) / 2, 10);
    expect(n.total.iron.isLowerBound).toBe(true);
    expect(n.total.iron.coverage.missing).toBe(1);
  });

  it('adds, updates and removes ingredients', async () => {
    let r = await createRecipe({ name: 'Pasta', servings: 1, ingredients: [{ foodId: 'pasta', quantity: { amount: 200, unit: 'g' } }] });
    r = await addIngredient(r.id, { foodId: 'cheese', quantity: { amount: 2, unit: 'serving', servingId: 'tbsp' } });
    expect(r.ingredients[1]?.grams).toBe(10);
    r = await updateIngredient(r.id, r.ingredients[1]!.id, { quantity: { amount: 20, unit: 'g' } });
    expect(r.ingredients[1]?.grams).toBe(20);
    r = await removeIngredient(r.id, r.ingredients[0]!.id);
    expect(r.ingredients.map((i) => i.foodId)).toEqual(['cheese']);
    r = await updateRecipe(r.id, { servings: 4, prepTimeMinutes: 10, cookedWeightGrams: null });
    expect(r.servings).toBe(4);
    await expect(removeIngredient(r.id, 'nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('logs a recipe as a meal entry with a stable snapshot', async () => {
    const r = await createRecipe({ name: 'Pasta marinara', servings: 2, ingredients: [{ foodId: 'pasta', quantity: { amount: 400, unit: 'g' } }, { foodId: 'sauce', quantity: { amount: 250, unit: 'g' } }] });
    const entry = await logRecipe(r.id, { date: '2026-11-07', mealType: 'dinner', servings: 1.5 });
    expect(entry.kind).toBe('recipe');
    expect(entry.grams).toBeCloseTo(325 * 1.5, 10);
    expect(entry.nutrients.energy?.amount).toBeCloseTo((757 / 2) * 1.5, 10);
    expect(entry.nutrients.iron).toMatchObject({ status: 'estimated', isLowerBound: true });
    await deleteRecipe(r.id);
    const s = await getDailySummary('2026-11-07');
    expect(s.totals.energy.amount).toBeCloseTo((757 / 2) * 1.5, 10); // history survives recipe deletion
  });

  it('survives deleted ingredient foods via snapshots', async () => {
    const r = await createRecipe({ name: 'Cheesy', servings: 1, ingredients: [{ foodId: 'cheese', quantity: { amount: 30, unit: 'g' } }] });
    await foodRepository.delete('cheese');
    const n = await getRecipeNutrition(r.id);
    expect(n.ingredientsUsingSnapshot).toHaveLength(1);
    expect(n.total.energy.amount).toBeCloseTo(117.6, 10);
  });

  it('refuses to log an empty recipe', async () => {
    const r = await createRecipe({ name: 'Empty', servings: 1 });
    await expect(logRecipe(r.id, { date: '2026-11-07', mealType: 'lunch' })).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
