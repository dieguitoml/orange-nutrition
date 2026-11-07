import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays, dateRange, daysBetween, isValidLocalDate, parseLocalDate, toLocalDate, weekRange } from '../core/utils/dates';

describe('local date handling', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses local calendar fields, not UTC (no late-evening date shift)', () => {
    // 23:30 local on Jan 31 must stay Jan 31 regardless of timezone
    const d = new Date(2026, 0, 31, 23, 30);
    expect(toLocalDate(d)).toBe('2026-01-31');
    const early = new Date(2026, 0, 1, 0, 5);
    expect(toLocalDate(early)).toBe('2026-01-01');
  });

  it('validates dates strictly', () => {
    expect(isValidLocalDate('2024-02-29')).toBe(true);
    expect(isValidLocalDate('2025-02-29')).toBe(false);
    expect(isValidLocalDate('2025-13-01')).toBe(false);
    expect(isValidLocalDate('2025-1-01')).toBe(false);
    expect(isValidLocalDate(20250101)).toBe(false);
  });

  it('does calendar arithmetic across month, year and DST boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    // DST transitions (EU: 2026-03-29, US: 2026-03-08 / 2026-11-01)
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-10-24', '2026-11-07')).toBe(14);
  });

  it('builds ranges and weeks', () => {
    expect(dateRange('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(dateRange('2026-03-02', '2026-03-01')).toEqual([]);
    expect(weekRange('2026-11-07', 1)).toEqual({ start: '2026-11-02', end: '2026-11-08' }); // Sat, Monday-start
    expect(weekRange('2026-11-07', 0)).toEqual({ start: '2026-11-01', end: '2026-11-07' }); // Sunday-start
  });

  it('parses to local midnight', () => {
    const d = parseLocalDate('2026-06-15');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 5, 15, 0]);
  });
});
