import { describe, expect, it } from 'vitest';
import {
  averageTotals,
  calculateRecipeNutrition,
  computeCompleteness,
  evaluateTarget,
  goalPercentages,
  goalProgress,
  nutrientsForQuantity,
  nutrientsForServing,
  remainingCalories,
  remainingMacros,
  scaleValues,
  sumNutrients,
  totalsToValues,
} from '../core/nutrition';
import type { DailyGoals, Recipe } from '../core/types/domain';
import { est, k, makeFood, z } from './helpers';

const chicken = makeFood('chicken', { energy: k(120), protein: k(22.5), carbohydrate: z(), fat: k(2.62), fiber: z(), iron: k(0.37) }, {
  servings: [{ id: 'c1', label: '1 breast', grams: 174, isDefault: true }],
});
const rice = makeFood('rice', { energy: k(130), protein: k(2.69), carbohydrate: k(28.17), fat: k(0.28), fiber: k(0.4) }); // iron missing
const oil = makeFood('oil', { energy: k(884), fat: k(100), protein: z(), carbohydrate: z() });

describe('nutrients per quantity / serving', () => {
  it('scales linearly without rounding', () => {
    const { grams, nutrients } = nutrientsForQuantity(chicken, { amount: 150, unit: 'g' });
    expect(grams).toBe(150);
    expect(nutrients.energy).toEqual({ status: 'known', amount: 180 });
    expect(nutrients.protein?.amount).toBeCloseTo(33.75, 12);
    expect(nutrients.fat?.amount).toBeCloseTo(3.93, 12);
  });

  it('keeps zero as zero and missing as missing', () => {
    const { nutrients } = nutrientsForQuantity(rice, { amount: 200, unit: 'g' });
    expect(nutrients.iron).toBeUndefined();
    const c = nutrientsForQuantity(chicken, { amount: 200, unit: 'g' }).nutrients;
    expect(c.carbohydrate).toEqual({ status: 'zero', amount: 0 });
  });

  it('supports servings and imperial units', () => {
    expect(nutrientsForServing(chicken, 'c1', 1).nutrients.energy?.amount).toBeCloseTo(208.8, 10);
    expect(nutrientsForQuantity(chicken, { amount: 4, unit: 'oz' }).grams).toBeCloseTo(113.3980925, 9);
  });

  it('rejects negative scale factors', () => {
    expect(() => scaleValues(chicken.nutrientsPer100g, -1)).toThrow();
  });
});

describe('aggregation with missing data', () => {
  it('never treats missing as zero and reports coverage', () => {
    const totals = sumNutrients([
      { grams: 150, nutrients: nutrientsForQuantity(chicken, { amount: 150, unit: 'g' }).nutrients },
      { grams: 200, nutrients: nutrientsForQuantity(rice, { amount: 200, unit: 'g' }).nutrients },
    ]);
    expect(totals.energy.amount).toBeCloseTo(180 + 260, 10);
    expect(totals.energy.coverage).toMatchObject({ contributors: 2, withData: 2, missing: 0, ratio: 1, isComplete: true });
    expect(totals.energy.isLowerBound).toBe(false);
    // iron: only chicken has data
    expect(totals.iron.amount).toBeCloseTo(0.555, 10);
    expect(totals.iron.coverage).toMatchObject({ withData: 1, missing: 1, isComplete: false });
    expect(totals.iron.coverage.ratio).toBeCloseTo(150 / 350, 12);
    expect(totals.iron.isLowerBound).toBe(true);
    // vitamin C: no data at all → amount 0 but coverage 0 (UI must show "no data", not 0)
    expect(totals.vitaminC.coverage.withData).toBe(0);
    expect(totals.vitaminC.coverage.ratio).toBe(0);
  });

  it('distinguishes estimated values', () => {
    const t = sumNutrients([{ grams: 100, nutrients: { sodium: est(400) } }, { grams: 100, nutrients: { sodium: k(100) } }]);
    expect(t.sodium.amount).toBe(500);
    expect(t.sodium.coverage.estimated).toBe(1);
    expect(totalsToValues(t).sodium?.status).toBe('estimated');
  });

  it('empty aggregation is complete zero', () => {
    const t = sumNutrients([]);
    expect(t.energy.amount).toBe(0);
    expect(t.energy.coverage.isComplete).toBe(true);
  });

  it('computes completeness metadata', () => {
    const c = computeCompleteness(rice.nutrientsPer100g);
    expect(c.hasCoreMacros).toBe(true);
    expect(c.missingNutrients).toContain('iron');
    expect(c.known).toBe(5);
    const c2 = computeCompleteness({ energy: k(1) });
    expect(c2.hasCoreMacros).toBe(false);
  });
});

describe('recipes', () => {
  const now = '2026-01-01T00:00:00.000Z';
  const snap = (f: typeof chicken) => ({ name: f.name, sourceType: f.source.type, nutrientsPer100g: f.nutrientsPer100g, servings: f.servings });
  const recipe: Recipe = {
    id: 'r1',
    name: 'Chicken & rice',
    servings: 2,
    ingredients: [
      { id: 'i1', foodId: 'chicken', quantity: { amount: 300, unit: 'g' }, grams: 300, snapshot: snap(chicken) },
      { id: 'i2', foodId: 'rice', quantity: { amount: 400, unit: 'g' }, grams: 400, snapshot: snap(rice) },
      { id: 'i3', foodId: 'oil', quantity: { amount: 10, unit: 'g' }, grams: 10, snapshot: snap(oil) },
    ],
    mealTypes: [],
    instructions: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  const foods = new Map([chicken, rice, oil].map((f) => [f.id, f]));

  it('computes totals, per serving and per 100 g', () => {
    const n = calculateRecipeNutrition(recipe, foods);
    expect(n.totalGrams).toBe(710);
    expect(n.total.energy.amount).toBeCloseTo(360 + 520 + 88.4, 10);
    expect(n.perServing.energy.amount).toBeCloseTo((360 + 520 + 88.4) / 2, 10);
    expect(n.gramsPerServing).toBe(355);
    expect(n.per100g.energy?.amount).toBeCloseTo(((360 + 520 + 88.4) * 100) / 710, 10);
    expect(n.per100g.energy?.status).toBe('known');
    // iron missing for rice & oil → lower bound estimate
    expect(n.per100g.iron).toMatchObject({ status: 'estimated', isLowerBound: true });
    expect(n.per100g.vitaminC).toBeUndefined();
    expect(n.ingredientsUsingSnapshot).toEqual([]);
  });

  it('uses cooked weight for per-100 g when provided', () => {
    const n = calculateRecipeNutrition({ ...recipe, cookedWeightGrams: 600 }, foods);
    expect(n.per100g.energy?.amount).toBeCloseTo(((360 + 520 + 88.4) * 100) / 600, 10);
    expect(n.total.energy.amount).toBeCloseTo(968.4, 10); // totals unchanged
  });

  it('falls back to snapshots for deleted foods', () => {
    const n = calculateRecipeNutrition(recipe, new Map([[chicken.id, chicken]]));
    expect(n.ingredientsUsingSnapshot).toEqual(['i2', 'i3']);
    expect(n.total.energy.amount).toBeCloseTo(968.4, 10);
  });

  it('rejects zero servings', () => {
    expect(() => calculateRecipeNutrition({ ...recipe, servings: 0 }, foods)).toThrow();
  });
});

describe('goals', () => {
  const goals: Pick<DailyGoals, 'targets'> = {
    targets: {
      energy: { amount: 2000, direction: 'around', tolerance: 0.1, origin: 'user' },
      protein: { amount: 150, direction: 'atLeast', origin: 'user' },
      carbohydrate: { amount: 200, direction: 'around', origin: 'user' },
      fat: { amount: 70, direction: 'around', origin: 'user' },
      sodium: { amount: 2300, direction: 'atMost', origin: 'reference' },
      iron: { amount: 18, direction: 'atLeast', origin: 'reference' },
    },
  };
  const totals = sumNutrients([
    { grams: 300, nutrients: nutrientsForQuantity(chicken, { amount: 300, unit: 'g' }).nutrients },
    { grams: 200, nutrients: nutrientsForQuantity(rice, { amount: 200, unit: 'g' }).nutrients },
  ]);

  it('computes remaining calories and macros', () => {
    expect(remainingCalories(totals, goals)).toBeCloseTo(2000 - 620, 10);
    const m = remainingMacros(totals, goals);
    expect(m.protein).toBeCloseTo(150 - 67.5 - 5.38, 10);
    expect(m.fiber).toBeNull();
    expect(remainingCalories(totals, null)).toBeNull();
  });

  it('computes percentages and statuses', () => {
    const pct = goalPercentages(totals, goals);
    expect(pct.energy).toBeCloseTo(31, 10);
    const p = goalProgress(totals, goals);
    expect(p.energy?.status).toBe('under');
    expect(p.sodium?.status).toBe('met');
    expect(p.iron?.isLowerBound).toBe(true);
  });

  it('evaluates target directions', () => {
    expect(evaluateTarget(1900, { amount: 2000, direction: 'around', origin: 'user' })).toBe('met');
    expect(evaluateTarget(2300, { amount: 2000, direction: 'around', origin: 'user' })).toBe('over');
    expect(evaluateTarget(10, { amount: 20, direction: 'atMost', origin: 'user' })).toBe('met');
    expect(evaluateTarget(25, { amount: 20, direction: 'atMost', origin: 'user' })).toBe('over');
  });

  it('averages only provided (logged) days', () => {
    const a = averageTotals([totals, sumNutrients([{ grams: 100, nutrients: { energy: k(380) } }])]);
    expect(a.energy.amount).toBeCloseTo(500, 10);
  });
});
