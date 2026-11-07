# Orange Nutrition

Personal, local-first nutrition tracking PWA for iPhone. Free to run: static hosting, all data stays on the device (IndexedDB).

| Folder | What |
|---|---|
| [`nutrition_app/`](nutrition_app/) | Backend data layer: types, IndexedDB, nutrition engine, USDA food catalog, Open Food Facts barcodes, recipes, history, recommendations, backup. See [`nutrition_app/docs/SERVICE_API.md`](nutrition_app/docs/SERVICE_API.md). |
| `frontend/` | React + TypeScript PWA (to be added). Imports the backend from `../nutrition_app/src`. |
