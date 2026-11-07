# Orange Nutrition — frontend (PWA)

A calm, private nutrition tracker built for iPhone and installable as a web app.
React 19 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui-style components (Radix + vaul) ·
Lucide · Recharts · TanStack Query · vite-plugin-pwa.

No accounts, no ads, no analytics, no server. All data stays on the device.

## Develop

```bash
npm install          # in the repo root: runtime deps used by ../nutrition_app (dexie, zod)
cd frontend && npm install
npm run dev        # http://127.0.0.1:5173/orange-nutrition/
npm run typecheck
npm run build      # outputs dist/ with service worker + manifest
npm run preview
npm run icons      # regenerate PWA icons from public/logo.svg
```

## Architecture

```
nutrition_app/              backend (Dexie/IndexedDB, USDA catalog, Open Food Facts, recipes,
                            history, recommendations, backup) — see nutrition_app/docs/SERVICE_API.md
frontend/src/
  core/types.ts             UI view-models (simpler shapes the screens render)
  core/services.ts          the service interface screens use
  core/references.ts        EU / Spanish reference intakes (EU RIs, EFSA, AESAN 2019)
  services/orangeBackend.ts adapter: implements core/services.ts with the backend (`@backend`)
  services/queries.ts       TanStack Query hooks used by all screens
  components/, screens/     UI
```

React components never do nutrition math: totals, serving scaling, coverage, adherence, recipe
nutrition and recommendations all come from the backend.

Notes
- On first run the adapter writes EU/AESAN targets into the backend's goals (the backend's own
  defaults are US FDA Daily Values). Users can pick an AESAN age/sex profile in Settings.
- The backend is written against the zod 3 API; it's served by zod 4's `zod/v3` compatibility layer
  (`vite.config.ts` and `tsconfig.json` alias `zod` → `zod/v3`).
- Theme and display name are UI-only preferences kept in localStorage; everything else lives in
  IndexedDB through the backend.

## Deploy to GitHub Pages

1. Push to a GitHub repo (default branch `main`).
2. Settings → Pages → Source: **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` (repo root) builds `frontend/` with `BASE_PATH=/<repo>/` and deploys.
   Routing uses `HashRouter`, so no 404 redirect trick is needed.

GitHub Pages serves over HTTPS, which is required for installation and camera access.

## Install on iPhone

1. Open the deployed URL in **Safari**.
2. Tap **Share**.
3. Select **Add to Home Screen**.
4. Enable **Open as Web App**.
5. Tap **Add**.

## Verification status

- `tsc -b` and `vite build` pass.
- Main flows were run end to end in headless Chrome with mobile emulation (375–1280 px,
  light and dark): logging, editing and deleting entries, custom-food validation, recipes,
  manual barcode lookup, the camera overlay (with a fake camera), assistant prompts with
  add-to-diary, nutrients, history, settings, and offline reload through the service worker.
- **Not yet tested on a physical iPhone.** Real-camera barcode scanning, safe-area insets
  and standalone-mode behaviour still need checking on a device.

## Notes

- Barcode scanning uses `@zxing/browser` because iOS Safari has no native `BarcodeDetector`.
  The flashlight button appears only when the camera reports torch support, which iOS Safari
  currently does not.
- The center button of the bottom navigation is "Add Food". The Recommendations tab is
  labelled "Ideas" so it fits at phone width; its accessible name is "Recommendations".
