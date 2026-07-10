# Deploy ExamNexus on Vercel

Yes — the **web app + AI backend** can run on Vercel. Users only need internet.

## What gets deployed

| Service | Path | Role |
| --- | --- | --- |
| `frontend` | `/` | Vite React app |
| `backend` | `/api/*` | Express (AI, push, enrollment, password reset) |

Defined in root `vercel.json` (`services` + `rewrites`).

## 1. Import the repo

1. Open [vercel.com/new](https://vercel.com/new)
2. Import **vochenex/ExamNexus**
3. Keep **Application Preset: Services**
4. If you see “vercel.json required”, click **Refresh** after this file is on `main`

## 2. Environment variables (expand that section before Deploy)

Add **all** of these (Production). Copy values from your local `.env` and `backend/.env`.

### Frontend (build-time — need `VITE_` prefix)

| Key | Where to copy from |
| --- | --- |
| `VITE_SUPABASE_URL` | root `.env` |
| `VITE_SUPABASE_ANON_KEY` | root `.env` |
| `VITE_WEBSITE_URL` | `https://examnexus.vercel.app` (or your final domain; you can update after first deploy) |
| `VITE_API_BASE_URL` | `/api` |

### Backend (runtime — no `VITE_` prefix)

| Key | Where to copy from |
| --- | --- |
| `SUPABASE_URL` | `backend/.env` (same URL as above) |
| `SUPABASE_ANON_KEY` | `backend/.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/.env` (secret) |
| `SUPABASE_JWT_SECRET` | `backend/.env` |
| `GEMINI_API_KEY` | `backend/.env` |
| `GEMINI_MODEL` | `gemini-2.5-flash` (optional) |

Optional push:

| Key | Value |
| --- | --- |
| `FCM_SERVICE_ACCOUNT_JSON` | full Firebase JSON as **one line** |
| `FCM_PROJECT_ID` | e.g. `examnexus-9d77a` |

## 3. Deploy

Click **Deploy**. When it finishes:

- Site: `https://<project>.vercel.app`
- Health: `https://<project>.vercel.app/api/health` → `"assessmentAi": true`

## 4. Public Android APK

```env
VITE_WEBSITE_URL=https://<project>.vercel.app
```

```bash
npm run cap:apk:prod
```

## Notes

- Long AI jobs work best on **Vercel Pro** (longer function timeouts). Hobby may time out on big generations.
- Never commit `.env` or Firebase JSON to GitHub.
