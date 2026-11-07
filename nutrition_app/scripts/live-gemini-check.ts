/**
 * Live check against the real Gemini API (uses ~3 of the 5 free requests/minute):
 *   GEMINI_API_KEY=... npm run ai:check [path/to/food-photo.jpg]
 * The key is read from the environment only; nothing is stored or printed.
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { initializeApp, setAiApiKey, acceptAiPrivacyNotice, updateAiSettings, testAiConnection, chatWithAssistant, recognizeMealPhoto, setMacroGoals, addMealEntry, today } from '../src';

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('Set GEMINI_API_KEY');
  process.exit(1);
}
await initializeApp();
await setAiApiKey(key);
await acceptAiPrivacyNotice();
await updateAiSettings({ aiSuggestionsEnabled: true, photoRecognitionEnabled: true });
await setMacroGoals({ calories: 2000, protein: 120, carbohydrate: 230, fat: 65, fiber: 30 });
await addMealEntry({ date: today(), mealType: 'breakfast', foodId: 'usda_173905', quantity: { amount: 250, unit: 'g' } });

let t = Date.now();
console.log('connection:', await testAiConnection(), `${Date.now() - t} ms`);

t = Date.now();
const chat = await chatWithAssistant({ message: 'I had oatmeal for breakfast. What should I have for lunch to get more protein?' });
console.log(`\nchat (${Date.now() - t} ms, ${chat.model}):\n${chat.text}`);
for (const r of chat.recommendations) console.log(`  • ${r.name}: ${r.ingredients.map((i) => i.quantityLabel + ' ' + i.name).join(' + ')} → ${Math.round(r.nutrition.energy.amount)} kcal, ${Math.round(r.nutrition.protein.amount)} g protein`);
if (chat.rejected.length) console.log('  rejected:', chat.rejected);
console.log('  follow-ups:', chat.followUps);

const photo = process.argv[2];
if (photo) {
  t = Date.now();
  const r = await recognizeMealPhoto(readFileSync(photo).buffer as ArrayBuffer, { savePhoto: false });
  console.log(`\nphoto (${Date.now() - t} ms, ${r.model}): ${r.description}`);
  for (const i of r.items) console.log(`  • ${i.detected.name} ~${i.detected.estimatedGrams} g → ${i.matches[0]?.food.name ?? '(no match)'}`);
  console.log(`  total ≈ ${Math.round(r.totals.energy.amount)} kcal (from the USDA database)`);
}
