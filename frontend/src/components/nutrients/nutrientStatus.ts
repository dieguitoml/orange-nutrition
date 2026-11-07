import type { NutrientCoverage, NutrientInfo } from '@/core/types'

/**
 * How the UI should *present* a nutrient's coverage. This is a display decision,
 * not nutrition math: every number here comes from the backend's NutrientCoverage.
 *
 * - 'no-data'    nothing logged today reports this nutrient — show no % at all
 * - 'incomplete' some foods report it, but too few to judge — hatched bar, no verdict
 * - 'low'        enough data, and recorded intake is below the Average Requirement (AR) level
 * - 'on-track'   at/near the reference (or within an upper limit)
 * - 'high'       above an upper limit (sodium, sugars, saturated fat)
 */
export type NutrientStatus = 'no-data' | 'incomplete' | 'low' | 'on-track' | 'high'

/**
 * Average Requirement (AR) as a fraction of the reference target.
 * Targets come from AESAN 2019 (Spain), which follows EFSA. EFSA defines the Population Reference
 * Intake as PRI = AR + 2·SD and, when the SD is unknown, assumes a 10% CV — so PRI ≈ 1.2 × AR and
 * AR ≈ 83% of the PRI (EFSA DRV summary report, 2017). At the AR about half of people meet their
 * requirement; at the PRI, ~97.5% do. Below this line we call intake "low".
 * Caveat: some AESAN values are Adequate Intakes (no AR exists), where "low" means "possibly
 * inadequate" — the UI copy stays cautious for that reason.
 */
export const AR_FRACTION = 1 / 1.2

/**
 * Share of the day's entries that must report a nutrient before we'll call it "low".
 * Not an official standard (judgment call): FAO (food composition guidelines) notes that treating missing values as zero
 * under-estimates intake by up to ~25% (fibre, EPIC), so we require most foods to report it.
 */
export const MIN_COMPLETENESS_FOR_LOW = 0.8

export function classifyNutrientStatus(c: NutrientCoverage, info: NutrientInfo): NutrientStatus {
  if (c.totalEntries === 0 || c.reportingEntries === 0) return 'no-data'
  const pct = c.percentOfTarget
  if (pct === null) return 'incomplete' // no reference value (e.g. cholesterol in the EU) → no verdict

  // Missing values can only ADD intake, never remove it. So reaching the reference (or
  // exceeding a limit) with partial data is already a confirmed verdict.
  if (info.isLimit) {
    if (pct > 100) return 'high'
    // Under a limit is fine — but only "confirmed" when most foods report it.
    return c.completeness >= MIN_COMPLETENESS_FOR_LOW ? 'on-track' : 'incomplete'
  }
  if (pct >= 100 * AR_FRACTION) return 'on-track' // between AR and UL, risk of inadequacy is low
  return c.completeness >= MIN_COMPLETENESS_FOR_LOW ? 'low' : 'incomplete'
}
