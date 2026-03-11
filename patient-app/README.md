# NeuroEase Patient App

Progressive Web App for patients (MCI or early-stage dementia). Login is email-link only (no password). Patients view and complete reminders. Built with React and Vite.

## Running the app

```bash
cd patient-app
npm install
npm run dev
```

Dev server: **http://localhost:5175** (patient app only; caregiver dashboard uses 5173).

## Backend API

The dev server proxies `/api` to `http://localhost:5001`. The backend must be running for API calls to work. To use a different API origin, set `VITE_API_BASE` in a `.env` file.

## Routes

| Path         | Purpose              |
|-------------|----------------------|
| `/login`    | Login (email link)    |
| `/activate`| Activate (invite link)|
| `/`         | Home                  |
| `/reminders`| Reminders list       |

## PWA (installability)

The app is a Progressive Web App: it has a web app manifest (`public/manifest.webmanifest`) with `name`, `short_name`, icons (192×192 and 512×512), `start_url`, and `display: standalone`. A minimal service worker (`public/sw.js`) is registered in production so the app can be installed via “Add to Home Screen” / “Install app” on supported browsers.

Icons are generated from `public/favicon.svg` with `npm run generate-icons` (requires `sharp`). To verify installability: run `npm run build && npm run preview`, open the preview URL on a device (or use Chrome DevTools device mode), and use the browser’s install prompt. The installed app opens in standalone and shows the patient app (login or home).

## Structure

- `src/App.jsx` – Route definitions
- `src/components/Layout.jsx` – Shell (header + main) for authenticated views
- `src/pages/` – Login, Activate, Home, Reminders
