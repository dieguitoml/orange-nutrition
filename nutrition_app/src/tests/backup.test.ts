import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, exportBackupJson, importBackup, validateBackup } from '../services/backup';
import { addMealEntry } from '../services/meals';
import { createCustomFood } from '../services/food';
import { createRecipe } from '../services/recipes';
import { setMacroGoals, setAllergies } from '../services/goals';
import { mealEntryRepository, foodRepository, preferencesRepository } from '../data/repositories';
import { seedDatabase } from '../data/seed';
import { getDb } from '../data/db';
import { freshDb, k } from './helpers';

async function populate() {
  await seedDatabase();
  const f = await createCustomFood({ name: 'Homemade granola', nutrientsPer100g: { energy: k(450), protein: k(10) } });
  await addMealEntry({ date: '2026-11-07', mealType: 'breakfast', foodId: f.id, quantity: { amount: 60, unit: 'g' } });
  await addMealEntry({ date: '2026-11-07', mealType: 'lunch', foodId: 'usda_173944', quantity: { amount: 120, unit: 'g' } });
  await createRecipe({ name: 'Bowl', servings: 1, ingredients: [{ foodId: f.id, quantity: { amount: 50, unit: 'g' } }] });
  await setMacroGoals({ calories: 2100, protein: 130 }, '2026-01-01');
  await setAllergies(['sesame']);
  return f;
}

describe('backup & restore', () => {
  beforeEach(async () => {
    await freshDb();
  });

  it('exports user data with counts and checksum (seed foods excluded by default)', async () => {
    await populate();
    const b = await exportBackup();
    expect(b.format).toBe('nutrition_app_backup');
    expect(b.counts).toMatchObject({ foods: 1, mealEntries: 2, recipes: 1, goals: 1, preferences: 1 });
    expect(validateBackup(b)).toMatchObject({ valid: true, errors: [], warnings: [] });
    const { json, filename } = await exportBackupJson();
    expect(filename).toMatch(/^nutrition-backup-.*\.json$/);
    expect(validateBackup(json).valid).toBe(true);
  });

  it('round-trips into an empty database', async () => {
    await populate();
    const { json } = await exportBackupJson();
    await freshDb();
    await seedDatabase();
    const res = await importBackup(json);
    expect(res.stats.mealEntries.inserted).toBe(2);
    expect(res.stats.foods.inserted).toBe(1);
    expect(await mealEntryRepository.byDate('2026-11-07')).toHaveLength(2);
    expect((await preferencesRepository.get()).allergies).toEqual(['sesame']);
  });

  it('rejects invalid backups with clear errors and leaves data untouched', async () => {
    await populate();
    const before = await getDb().mealEntries.count();
    expect(validateBackup('not json')).toMatchObject({ valid: false, errors: ['File is not valid JSON'] });
    expect(validateBackup({ format: 'other' }).valid).toBe(false);
    expect(validateBackup({ format: 'nutrition_app_backup', schemaVersion: 99 }).errors[0]).toMatch(/Unsupported/);

    const good = await exportBackup();
    const bad = structuredClone(good);
    bad.data.mealEntries[1]!.date = '2026-02-31';
    const v = validateBackup(bad);
    expect(v.valid).toBe(false);
    expect(v.errors.join('\n')).toMatch(/data\.mealEntries\.1\.date/);
    await expect(importBackup(bad, { mode: 'replace' })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(await getDb().mealEntries.count()).toBe(before);

    const dup = structuredClone(good);
    dup.data.mealEntries.push(dup.data.mealEntries[0]!);
    expect(validateBackup(dup).errors.join()).toMatch(/Duplicate meal entry/);
  });

  it('merge handles duplicates by strategy', async () => {
    await populate();
    const b = await exportBackup();
    const entry = b.data.mealEntries[0]!;
    // local edit is newer than the backup copy
    await getDb().mealEntries.put({ ...entry, note: 'local', updatedAt: '2099-01-01T00:00:00.000Z' });
    const r1 = await importBackup(b, { mode: 'merge', onDuplicate: 'newest' });
    expect(r1.stats.mealEntries).toMatchObject({ inserted: 0, skipped: 2 });
    expect((await mealEntryRepository.get(entry.id))?.note).toBe('local');
    const r2 = await importBackup(b, { mode: 'merge', onDuplicate: 'overwrite' });
    expect(r2.stats.mealEntries.updated).toBe(2);
    expect((await mealEntryRepository.get(entry.id))?.note).toBeUndefined();
  });

  it('replace mode restores exactly the backup, keeping seed foods', async () => {
    await populate();
    const b = await exportBackup();
    await createCustomFood({ name: 'Extra', nutrientsPer100g: { energy: k(1) } });
    await addMealEntry({ date: '2026-11-08', mealType: 'dinner', foodId: 'usda_173944', quantity: { amount: 100, unit: 'g' } });
    const res = await importBackup(b, { mode: 'replace' });
    expect(res.mode).toBe('replace');
    expect(await getDb().mealEntries.count()).toBe(2);
    expect((await foodRepository.list({ sourceType: 'user' })).map((f) => f.name)).toEqual(['Homemade granola']);
    expect(await foodRepository.get('usda_173944')).not.toBeNull();
  });

  it('warns on checksum mismatch but accepts valid data', async () => {
    await populate();
    const b = await exportBackup();
    b.data.mealEntries[0]!.note = 'edited by hand';
    const v = validateBackup(b);
    expect(v.valid).toBe(true);
    expect(v.warnings[0]).toMatch(/Checksum/);
  });
});
