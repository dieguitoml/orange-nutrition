import { NUTRIENTS } from '../constants/nutrients';
import type { NutrientId, NutrientTotal, NutrientValue } from '../types/nutrients';

/**
 * PRESENTATION-ONLY rounding helpers. Never feed their output back into calculations.
 */

export function roundTo(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

const UNIT_LABEL = { kcal: 'kcal', g: 'g', mg: 'mg', ug: 'µg' } as const;

export function unitLabel(id: NutrientId): string {
  return UNIT_LABEL[NUTRIENTS[id].unit];
}

/** "12.3 g", "≥ 40 mg", "—" (missing). */
export function formatNutrientValue(id: NutrientId, value: NutrientValue | undefined): string {
  if (!value || value.status === 'missing') return '—';
  const def = NUTRIENTS[id];
  const prefix = (value.status === 'known' || value.status === 'estimated') && value.isLowerBound ? '≥ ' : '';
  const est = value.status === 'estimated' ? '~' : '';
  return `${prefix}${est}${roundTo(value.amount, def.displayDecimals)} ${UNIT_LABEL[def.unit]}`;
}

export function formatNutrientTotal(id: NutrientId, total: NutrientTotal): string {
  if (total.coverage.contributors > 0 && total.coverage.withData === 0) return '—';
  const def = NUTRIENTS[id];
  return `${total.isLowerBound ? '≥ ' : ''}${roundTo(total.amount, def.displayDecimals)} ${UNIT_LABEL[def.unit]}`;
}

export function formatPercent(value: number, decimals = 0): string {
  return `${roundTo(value, decimals)}%`;
}
