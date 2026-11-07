# Orange Nutrition

Personal, local-first nutrition tracking PWA for iPhone. Free to run: static hosting, all data stays on the device (IndexedDB).

| Folder | What |
|---|---|
| [`nutrition_app/`](nutrition_app/) | Backend data layer: types, IndexedDB, nutrition engine, USDA food catalog, Open Food Facts barcodes, recipes, history, recommendations, backup. See [`nutrition_app/docs/SERVICE_API.md`](nutrition_app/docs/SERVICE_API.md). |
| [`frontend/`](frontend/) | React + TypeScript PWA (Vite, Tailwind, Recharts, PWA). Imports the backend from `../nutrition_app/src` through a thin adapter. See [`frontend/README.md`](frontend/README.md). |

## Run locally

```bash
npm install                 # repo root: runtime deps for nutrition_app (dexie, zod)
cd frontend && npm install
npm run dev                 # http://127.0.0.1:5173/orange-nutrition/
```

Live app: https://irenegauna.github.io/orange-nutrition/ (deployed by `.github/workflows/deploy.yml`).
