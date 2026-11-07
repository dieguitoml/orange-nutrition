/** End-to-end smoke run against an in-memory IndexedDB: npm run smoke */
import 'fake-indexeddb/auto';
import {
  initializeApp,
  searchFoods,
  addMealEntry,
  setMacroGoals,
  getDailySummary,
  recommendFromText,
  exportBackup,
  formatNutrientTotal,
  today,
} from '../src';

const date = today();
const init = await initializeApp();
console.log('seed:', init.seed);
await setMacroGoals({ calories: 2000, protein: 130, carbohydrate: 220, fat: 65, fiber: 30 });
const oats = (await searchFoods('oatmeal'))[0]!.food;
const banana = (await searchFoods('banana'))[0]!.food;
await addMealEntry({ date, mealType: 'breakfast', foodId: oats.id, quantity: { amount: 250, unit: 'g' } });
await addMealEntry({ date, mealType: 'breakfast', foodId: banana.id, quantity: { amount: 1, unit: 'serving' } });
const s = await getDailySummary(date);
console.log(`\n${date}: ${s.entryCount} entries`);
for (const id of ['energy', 'protein', 'fiber', 'vitaminC', 'iodine'] as const) console.log(`  ${id.padEnd(9)} ${formatNutrientTotal(id, s.totals[id])}  (coverage ${(s.totals[id].coverage.ratio * 100).toFixed(0)}%)`);
console.log(`  remaining kcal: ${s.remainingCalories?.toFixed(0)}`);
const r = await recommendFromText('high protein dinner');
console.log(`\n"high protein dinner" → intent ${r.parsed.request.intent} (${r.parsed.request.mealType})`);
for (const rec of r.recommendations.slice(0, 3)) console.log(`  ${rec.score.toFixed(0)}  ${rec.name}: ${rec.ingredients.map((i) => i.quantityLabel).join(' + ')} — ${rec.nutrition.energy.amount.toFixed(0)} kcal`);
const b = await exportBackup();
console.log('\nbackup counts:', b.counts);
