# ExamNexus codebase map (debug guide)

Use this file to find where things live. While the app is running locally, an amber **Debug · page file** badge also shows the exact page source for the current route (`Ctrl+Shift+D` toggles it).

## Top-level layout

| Folder | What it is |
|---|---|
| `frontend/` | React UI: pages, layouts, components, styles, hooks, utils |
| `backend/` | Express API: routes, AI, password reset, uploads |
| `database/` | Supabase SQL schemas / RPCs |
| `api/` | Vercel serverless entry that mounts the backend |
| `android/` / `ios/` | Capacitor native shells (APK / iPhone) |
| `scripts/` | Build / audit helpers |
| `public/` | Static web assets |

## Frontend (`frontend/`) — ordered

1. `main.jsx` — app boot
2. `App.jsx` — route table (URL → page)
3. `config/routeFileMap.js` — route → file map for the debug badge
4. `pages/` — one screen per file (`*Page.jsx`)
   - `public/` — marketing home
   - `auth/` — login, signup, forgot password
   - `shared/` — profile + platform announcements
   - `Admin/` — admin tools
   - `Faculty/` — teaching tools
   - `Student/` — student tools
   - `_unused/` — old unused screens (kept for reference)
5. `layouts/` — sidebar shells (`DashboardLayout`, `AdminLayout`)
6. `components/` — reusable UI pieces
7. `contexts/` — global React state
8. `hooks/` — shared hooks
9. `guards/` — auth route guards
10. `styles/` + `index.css` — CSS
11. `utils/` — client helpers / API wrappers

## Backend (`backend/`) — ordered

1. `server.js` — local API process
2. `createApp.js` — Express app wiring
3. `routes/` — HTTP endpoints (`password-reset`, `assessment-ai`, …)
4. `lib/` — providers / generators (Groq, Gemini, Supabase admin)
5. `middleware/` — Express middleware
6. `controllers/` — thicker handlers (if present)
7. `.env` — **local secrets only** (never commit)

## Database (`database/`)

- `password_reset_requests.sql` — full password-reset schema + RPCs
- `password_reset_user_reveal.sql` — additive update/check/reveal RPCs
- other `*.sql` — platform / policy fixes

## Native apps

APK and iPhone load the same `frontend/` build via Capacitor (`webDir: dist`). New UI features ship to mobile after `npm run cap:apk` / `cap:ios` (or your usual rebuild). They are not separate React codebases.
