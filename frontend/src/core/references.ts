/**
 * European / Spanish reference intakes (static reference data, no user data).
 *
 * Frontend-owned: the backend's own REFERENCE_DAILY_VALUES are US FDA values, so the adapter writes
 * these EU/AESAN targets into the backend's goals on first run (origin: 'reference').
 *
 * Sources
 * - Vitamins & minerals: AESAN Scientific Committee (2019), "Ingestas Nutricionales de Referencia
 *   (INR) para la población española", Rev Comité Científico AESAN 29:43-68; tables republished in
 *   Rev Esp Salud Pública 2022;96:e202203034. Built on EFSA DRVs (mix of PRIs and AIs).
 * - Sodium limit: EFSA NDA (2019) — 2.0 g/day is a safe and adequate intake for adults (= 5 g salt).
 *   AESAN's 1,500 mg sodium INR is an *adequate* intake, not an upper limit, so it's not used here.
 * - Sugars & saturated fat: EFSA sets no numeric upper level ("as low as possible", 2010 & 2022);
 *   we use the EU labelling Reference Intakes, Reg. (EU) 1169/2011 Annex XIII Part B
 *   (total sugars 90 g, saturates 20 g).
 * - Cholesterol: no EU/EFSA reference value, and the backend does not track it.
 * - Energy & macros: EU Reference Intakes for an average adult (Annex XIII Part B): 2,000 kcal,
 *   protein 50 g, carbohydrate 260 g, fat 70 g. Fibre: EFSA (2010) Adequate Intake of 25 g/day.
 */
import type { Macros, Micronutrients } from './types'

export type ReferenceProfileId =
  | 'woman-20-49'
  | 'woman-50-59'
  | 'woman-60-69'
  | 'woman-70plus'
  | 'man-20-49'
  | 'man-50-59'
  | 'man-60-69'
  | 'man-70plus'
  | 'pregnancy'
  | 'lactation'

export interface ReferenceProfile {
  id: ReferenceProfileId
  label: string
  micros: Micronutrients
}

/** Limits that apply to all adults (EFSA / EU labelling — see header). */
const LIMITS: Micronutrients = { sodium: 2000, sugar: 90, saturatedFat: 20 }

const woman: Micronutrients = {
  vitaminA: 650, thiamin: 1.1, riboflavin: 1.2, niacin: 14, pantothenicAcid: 5, vitaminB6: 1.3, biotin: 30, folate: 330,
  vitaminB12: 2.4, vitaminC: 75, vitaminD: 12.5, vitaminE: 11, vitaminK: 70,
  calcium: 950, phosphorus: 700, iron: 18, magnesium: 300, potassium: 3500, selenium: 55, zinc: 8,
  copper: 1.1, manganese: 3, iodine: 150,
  ...LIMITS,
}
const man: Micronutrients = {
  vitaminA: 750, thiamin: 1.2, riboflavin: 1.5, niacin: 17, pantothenicAcid: 5, vitaminB6: 1.7, biotin: 30, folate: 330,
  vitaminB12: 2.4, vitaminC: 75, vitaminD: 12.5, vitaminE: 13, vitaminK: 70,
  calcium: 950, phosphorus: 700, iron: 9.1, magnesium: 350, potassium: 3500, selenium: 70, zinc: 11,
  copper: 1.3, manganese: 3, iodine: 150,
  ...LIMITS,
}

export const REFERENCE_PROFILES: ReferenceProfile[] = [
  { id: 'woman-20-49', label: 'Woman, 20–49', micros: woman },
  { id: 'woman-50-59', label: 'Woman, 50–59', micros: { ...woman, iron: 15 } },
  { id: 'woman-60-69', label: 'Woman, 60–69', micros: { ...woman, thiamin: 1.0, vitaminB6: 1.5, vitaminK: 90, calcium: 1000, iron: 9, magnesium: 280, copper: 1.2 } },
  { id: 'woman-70plus', label: 'Woman, 70+', micros: { ...woman, thiamin: 1.0, vitaminB6: 1.5, vitaminK: 90, vitaminD: 15, calcium: 1000, iron: 9, magnesium: 280, zinc: 7, copper: 1.2 } },
  { id: 'man-20-49', label: 'Man, 20–49', micros: man },
  { id: 'man-50-59', label: 'Man, 50–59', micros: { ...man, vitaminK: 80 } },
  { id: 'man-60-69', label: 'Man, 60–69', micros: { ...man, niacin: 16, vitaminK: 80, calcium: 1000 } },
  { id: 'man-70plus', label: 'Man, 70+', micros: { ...man, niacin: 16, riboflavin: 1.4, vitaminK: 80, vitaminD: 15, calcium: 1000, selenium: 60 } },
  { id: 'pregnancy', label: 'Pregnancy', micros: { ...woman, vitaminA: 800, thiamin: 1.4, riboflavin: 1.5, niacin: 17, vitaminB6: 1.9, folate: 500, vitaminB12: 2.6, vitaminC: 85, vitaminD: 15, vitaminE: 12, calcium: 1000, phosphorus: 800, iron: 27, selenium: 60, zinc: 10, pantothenicAcid: 6, biotin: 35, copper: 1.2, iodine: 200 } },
  { id: 'lactation', label: 'Breastfeeding', micros: { ...woman, vitaminA: 1300, thiamin: 1.4, riboflavin: 1.7, niacin: 18, vitaminB6: 2.0, folate: 500, vitaminB12: 2.8, vitaminC: 120, vitaminD: 15, vitaminE: 15, calcium: 1000, phosphorus: 800, iron: 15, potassium: 3900, selenium: 70, zinc: 12, pantothenicAcid: 7, biotin: 35, copper: 1.5, iodine: 200 } },
]

export const DEFAULT_REFERENCE_PROFILE: ReferenceProfileId = 'woman-20-49'

/** EU Reference Intakes for an average adult (Reg. 1169/2011 Annex XIII B) + EFSA fibre AI. */
export const EU_MACRO_REFERENCE: Macros = { calories: 2000, protein: 50, carbs: 260, fat: 70, fiber: 25 }

export const referenceProfile = (id: ReferenceProfileId) => REFERENCE_PROFILES.find((p) => p.id === id)!
