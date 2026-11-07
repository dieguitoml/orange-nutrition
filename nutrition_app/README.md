# nutrition_app: local-first nutrition data layer

The backend for **Orange Nutrition**, a personal nutrition-tracking PWA for iPhone. It isn't a server. It's a TypeScript library bundled into the PWA, and it runs inside Safari:

- **Storage:** IndexedDB (Dexie), entirely on the device. No accounts, no auth, no hosted backend.
- **Offline:** 207 foods from **USDA FoodData Central (SR Legacy, public domain)** are bundled. Every feature except barcode lookup works without a network.
- **Barcodes:** Open Food Facts (free, ODbL), with caching, timeouts, rate limiting, and a manual-entry fallback.
- **AI (opt-in):** meal photo recognition and smart suggestions via Google Gemini, using the user's own free API key stored on the device. The AI never supplies nutrient values: everything is calculated from the database and confirmed by the user. With AI off, a rule-based engine runs instead.
- **Cost:** €0. Static hosting on GitHub Pages, no paid APIs, no keys.

Stack: TypeScript (strict), Dexie 4, Zod 3, Vitest (+ fake-indexeddb).

## Scripts

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest (110 tests)
npm run smoke       # end-to-end run on an in-memory DB
npm run seed:build  # regenerate src/data/seed/usdaFoods.json from the USDA CSV (downloads ~6 MB once)
```

## Layout

```
src/
  core/        types (frontend contract), constants, nutrition engine, recommendations, validation, utils
  data/        Dexie DB + migrations, repositories, seed catalog
  services/    food, barcode, meals, recipes, goals, history, recommendations, backup, ai (photos + Gemini)
  integrations/openFoodFacts/, integrations/gemini/
  tests/
scripts/       USDA seed builder (+ curated selection), smoke test
docs/SERVICE_API.md
```

Frontend integration: import from `src/index.ts` and call `initializeApp()` at startup. See **[docs/SERVICE_API.md](docs/SERVICE_API.md)**.

## Data integrity principles

- Missing nutrient data is never treated as zero. Every value is `known`, `zero`, `estimated` or `missing`, and aggregates report **coverage** separately from intake.
- No rounding during calculations, only in the `format*` display helpers.
- Meal entries freeze a nutrition snapshot, so history never changes when foods or recipes are edited.
- Calendar dates are local `YYYY-MM-DD` strings, computed without UTC conversion. Tests run in UTC+14 and UTC−11.
- Imports validate the whole backup before writing anything, in a single transaction.
- Allergies and diets are hard exclusions in recommendations.

## Data sources & licensing

- **USDA FoodData Central, SR Legacy (April 2018)**, U.S. Department of Agriculture, Agricultural Research Service. Public domain (CC0). The FDC id and original description are kept on each food (`food.source`). SR Legacy has no iodine or biotin data, so those nutrients stay *missing* for seed foods. Values the USDA marks as imputed or calculated from other foods are flagged `estimated`. Display names, categories, allergen tags and prep-time estimates are curated metadata in `scripts/usda-selection.ts`; no nutrient values are hand-entered.
- **Open Food Facts:** product data under the Open Database License. Attribution is required wherever it's shown.
- **Google Gemini API (optional):** free tier with the user's own key. Requests may be used by Google to improve its products; the app shows a privacy notice and requires consent first.
- **Reference daily values:** U.S. FDA Daily Values (21 CFR 101.9), for general information only. They aren't medical advice.
