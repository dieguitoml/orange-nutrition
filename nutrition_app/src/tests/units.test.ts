import { describe, expect, it } from 'vitest';
import { convertNutrientMass, ConversionError, iuToCanonical, kcalToKj, kjToKcal, massToGrams, quantityToGrams, saltToSodiumMg, sodiumMgToSaltG } from '../core/utils/units';
import { formatNutrientValue, roundTo } from '../core/utils/format';

describe('unit conversions', () => {
  it('converts mass units exactly', () => {
    expect(massToGrams(1, 'kg')).toBe(1000);
    expect(massToGrams(1, 'oz')).toBeCloseTo(28.349523125, 9);
    expect(massToGrams(2, 'lb')).toBeCloseTo(907.18474, 6);
    expect(massToGrams(500, 'mg')).toBeCloseTo(0.5, 12);
  });

  it('converts nutrient mass units', () => {
    expect(convertNutrientMass(1, 'g', 'mg')).toBe(1000);
    expect(convertNutrientMass(0.12, 'g', 'mg')).toBeCloseTo(120, 9);
    expect(convertNutrientMass(2500, 'ug', 'mg')).toBeCloseTo(2.5, 9);
  });

  it('energy, salt and IU conversions follow explicit rules', () => {
    expect(kjToKcal(4.184)).toBeCloseTo(1, 12);
    expect(kcalToKj(100)).toBeCloseTo(418.4, 9);
    expect(saltToSodiumMg(1)).toBeCloseTo(400, 9);
    expect(sodiumMgToSaltG(400)).toBeCloseTo(1, 9);
    expect(iuToCanonical(400, 'vitaminD_ug')).toBeCloseTo(10, 9);
    expect(iuToCanonical(1000, 'vitaminA_retinol_ugRAE')).toBeCloseTo(300, 9);
  });

  it('resolves quantities to grams via servings, density and volume servings', () => {
    const food = { servings: [{ id: 's1', label: '1 cup', grams: 244, volumeMl: 236.5882365, isDefault: true }] };
    expect(quantityToGrams({ amount: 150, unit: 'g' }, food)).toBe(150);
    expect(quantityToGrams({ amount: 2, unit: 'serving', servingId: 's1' }, food)).toBe(488);
    expect(quantityToGrams({ amount: 1, unit: 'serving' }, food)).toBe(244); // default serving
    expect(quantityToGrams({ amount: 1, unit: 'cup' }, food)).toBeCloseTo(244, 9);
    expect(quantityToGrams({ amount: 100, unit: 'ml' }, { servings: [], densityGPerMl: 1.03 })).toBeCloseTo(103, 9);
  });

  it('refuses to guess impossible conversions', () => {
    expect(() => quantityToGrams({ amount: 1, unit: 'cup' }, { servings: [] })).toThrow(ConversionError);
    expect(() => quantityToGrams({ amount: 1, unit: 'serving', servingId: 'nope' }, { servings: [] })).toThrow(ConversionError);
    expect(() => quantityToGrams({ amount: -1, unit: 'g' }, { servings: [] })).toThrow(ConversionError);
  });

  it('rounds only for presentation', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(formatNutrientValue('protein', { status: 'known', amount: 12.345 })).toBe('12.3 g');
    expect(formatNutrientValue('iron', undefined)).toBe('—');
    expect(formatNutrientValue('iron', { status: 'estimated', amount: 2.04, isLowerBound: true })).toBe('≥ ~2 mg');
  });
});
