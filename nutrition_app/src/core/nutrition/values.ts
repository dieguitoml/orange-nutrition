import { CORE_MACROS } from '../constants/nutrients';
import { NUTRIENT_IDS, type NutrientCompleteness, type NutrientId, type NutrientTotal, type NutrientTotals, type NutrientValue, type NutrientValues } from '../types/nutrients';

/** Constructors that keep the zero/known/missing distinction explicit. */
export const nv = {
  known: (amount: number): NutrientValue => (amount === 0 ? { status: 'zero', amount: 0 } : { status: 'known', amount }),
  zero: (): NutrientValue => ({ status: 'zero', amount: 0 }),
  estimated: (amount: number): NutrientValue => ({ status: 'estimated', amount }),
  missing: (): NutrientValue => ({ status: 'missing', amount: null }),
};

/** Returns the value for a nutrient, treating an absent key as missing. */
export function getValue(values: NutrientValues, id: NutrientId): NutrientValue {
  return values[id] ?? { status: 'missing', amount: null };
}

/** Numeric amount or null when missing. Never returns 0 for missing data. */
export function amountOrNull(values: NutrientValues, id: NutrientId): number | null {
  const v = values[id];
  return v && v.status !== 'missing' ? v.amount : null;
}

export function hasData(v: NutrientValue | undefined): v is Exclude<NutrientValue, { status: 'missing' }> {
  return !!v && v.status !== 'missing';
}

/** Multiplies every value by `factor`. Statuses are preserved; missing stays missing; zero stays zero. */
export function scaleValues(values: NutrientValues, factor: number): NutrientValues {
  if (!Number.isFinite(factor) || factor < 0) throw new RangeError(`Invalid scale factor: ${factor}`);
  const out: NutrientValues = {};
  for (const id of NUTRIENT_IDS) {
    const v = values[id];
    if (!v) continue;
    switch (v.status) {
      case 'missing':
        out[id] = v;
        break;
      case 'zero':
        out[id] = { status: 'zero', amount: 0 };
        break;
      default:
        out[id] = v.isLowerBound ? { status: v.status, amount: v.amount * factor, isLowerBound: true } : { status: v.status, amount: v.amount * factor };
    }
  }
  return out;
}

/** Drops explicit `missing` entries (sparse canonical form). */
export function compactValues(values: NutrientValues): NutrientValues {
  const out: NutrientValues = {};
  for (const id of NUTRIENT_IDS) {
    const v = values[id];
    if (v && v.status !== 'missing') out[id] = v;
  }
  return out;
}

export function computeCompleteness(values: NutrientValues): NutrientCompleteness {
  let known = 0;
  let zero = 0;
  let estimated = 0;
  const missingNutrients: NutrientId[] = [];
  for (const id of NUTRIENT_IDS) {
    const v = values[id];
    if (!v || v.status === 'missing') missingNutrients.push(id);
    else if (v.status === 'zero') zero++;
    else if (v.status === 'estimated') estimated++;
    else known++;
  }
  const totalTracked = NUTRIENT_IDS.length;
  return {
    totalTracked,
    known,
    zero,
    estimated,
    missing: missingNutrients.length,
    score: (totalTracked - missingNutrients.length) / totalTracked,
    hasCoreMacros: CORE_MACROS.every((id) => hasData(values[id])),
    missingNutrients,
  };
}

/** An all-empty totals object (0 contributors, amount 0, complete). */
export function emptyTotals(): NutrientTotals {
  const t = {} as NutrientTotals;
  for (const id of NUTRIENT_IDS) {
    t[id] = { amount: 0, isLowerBound: false, coverage: { contributors: 0, withData: 0, missing: 0, estimated: 0, ratio: 1, isComplete: true } };
  }
  return t;
}

/**
 * Converts aggregated totals back into NutrientValues (e.g. recipe per-100 g snapshot):
 * - no contributor had data → missing
 * - all zero, complete → zero
 * - any estimate or missing contributor → estimated (missing contributors also flag isLowerBound)
 */
export function totalsToValues(totals: NutrientTotals, factor = 1): NutrientValues {
  const out: NutrientValues = {};
  for (const id of NUTRIENT_IDS) {
    const t = totals[id];
    const c = t.coverage;
    if (c.contributors === 0 || c.withData === 0) continue; // missing
    const amount = t.amount * factor;
    if (amount === 0 && !t.isLowerBound && c.estimated === 0) {
      out[id] = { status: 'zero', amount: 0 };
    } else if (c.estimated > 0 || c.missing > 0 || t.isLowerBound) {
      out[id] = t.isLowerBound ? { status: 'estimated', amount, isLowerBound: true } : { status: 'estimated', amount };
    } else {
      out[id] = { status: 'known', amount };
    }
  }
  return out;
}

/** Scales every total amount (coverage unchanged). Used for per-serving and averages. */
export function scaleTotals(totals: NutrientTotals, factor: number): NutrientTotals {
  const out = {} as NutrientTotals;
  for (const id of NUTRIENT_IDS) {
    const t: NutrientTotal = totals[id];
    out[id] = { amount: t.amount * factor, isLowerBound: t.isLowerBound, coverage: { ...t.coverage } };
  }
  return out;
}
