import type { NutrientTarget } from '../types/domain';
import type { NutrientId } from '../types/nutrients';

/**
 * Reference daily values for adults and children ≥ 4 years, from the U.S. FDA "Daily Values"
 * used for Nutrition Facts labels (21 CFR 101.9(c), 2016 revision), based on a 2,000 kcal diet.
 *
 * These are GENERAL REFERENCE VALUES for informational display only. They are not personalized
 * recommendations and must not be used to infer deficiencies or give medical advice.
 * The user can override every value. Total sugars has no FDA Daily Value, so none is set.
 */
export const REFERENCE_DAILY_VALUES_SOURCE =
  'U.S. FDA Daily Values (21 CFR 101.9, 2016), 2,000 kcal reference diet — informational only';

export const REFERENCE_DAILY_VALUES: Readonly<Partial<Record<NutrientId, NutrientTarget>>> = {
  energy: { amount: 2000, direction: 'around', tolerance: 0.1, origin: 'reference' },
  protein: { amount: 50, direction: 'atLeast', origin: 'reference' },
  carbohydrate: { amount: 275, direction: 'around', tolerance: 0.1, origin: 'reference' },
  fat: { amount: 78, direction: 'around', tolerance: 0.1, origin: 'reference' },
  fiber: { amount: 28, direction: 'atLeast', origin: 'reference' },
  saturatedFat: { amount: 20, direction: 'atMost', origin: 'reference' },
  calcium: { amount: 1300, direction: 'atLeast', origin: 'reference' },
  iron: { amount: 18, direction: 'atLeast', origin: 'reference' },
  magnesium: { amount: 420, direction: 'atLeast', origin: 'reference' },
  phosphorus: { amount: 1250, direction: 'atLeast', origin: 'reference' },
  potassium: { amount: 4700, direction: 'atLeast', origin: 'reference' },
  sodium: { amount: 2300, direction: 'atMost', origin: 'reference' },
  zinc: { amount: 11, direction: 'atLeast', origin: 'reference' },
  copper: { amount: 0.9, direction: 'atLeast', origin: 'reference' },
  manganese: { amount: 2.3, direction: 'atLeast', origin: 'reference' },
  selenium: { amount: 55, direction: 'atLeast', origin: 'reference' },
  iodine: { amount: 150, direction: 'atLeast', origin: 'reference' },
  vitaminA: { amount: 900, direction: 'atLeast', origin: 'reference' },
  thiamin: { amount: 1.2, direction: 'atLeast', origin: 'reference' },
  riboflavin: { amount: 1.3, direction: 'atLeast', origin: 'reference' },
  niacin: { amount: 16, direction: 'atLeast', origin: 'reference' },
  pantothenicAcid: { amount: 5, direction: 'atLeast', origin: 'reference' },
  vitaminB6: { amount: 1.7, direction: 'atLeast', origin: 'reference' },
  biotin: { amount: 30, direction: 'atLeast', origin: 'reference' },
  folate: { amount: 400, direction: 'atLeast', origin: 'reference' },
  vitaminB12: { amount: 2.4, direction: 'atLeast', origin: 'reference' },
  vitaminC: { amount: 90, direction: 'atLeast', origin: 'reference' },
  vitaminD: { amount: 20, direction: 'atLeast', origin: 'reference' },
  vitaminE: { amount: 15, direction: 'atLeast', origin: 'reference' },
  vitaminK: { amount: 120, direction: 'atLeast', origin: 'reference' },
};

/** Default tolerance for `around` targets. */
export const DEFAULT_AROUND_TOLERANCE = 0.1;
