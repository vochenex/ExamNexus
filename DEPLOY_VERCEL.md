# Deploy ExamNexus on Vercel

Yes — the **web app + AI backend** can run on Vercel. Users only need internet.

## What gets deployed

| Piece | On Vercel |
| --- | --- |
| React frontend | Static build (`dist/`) |
| Express API (AI, push, enrollment, password reset) | Serverless function at `/api` |

Supabase stays as your database/auth (unchanged).

## 1. Push your code

Commit and push to GitHub (`vochenex/ExamNexus`).

## 2. Create the Vercel project

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import this repo.
2. Framework preset: **Other** (or leave blank — `vercel.json` sets build output).
3. Root directory: `.` (repo root).
4. Deploy once (it may fail until env vars are set — that’s OK).

## 3. Environment variables (Vercel → Settings → Environment Variables)

Add these for **Production** (and Preview if you want):

### Frontend (build-time)

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | your anon key |
| `VITE_WEBSITE_URL` | `https://your-app.vercel.app` (or custom domain) |
| `VITE_API_BASE_URL` | `/api` (optional; production already defaults to `/api`) |

### Backend (runtime — same project)

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | same as above |
| `SUPABASE_ANON_KEY` | same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secret) |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase |
| `GEMINI_API_KEY` | Google AI Studio key |
| `GEMINI_MODEL` | `gemini-2.5-flash` (optional) |
| `FCM_SERVICE_ACCOUNT_JSON` | full Firebase service-account JSON as one line (optional, for push) |
| `FCM_PROJECT_ID` | Firebase project id (optional) |

Redeploy after saving env vars.

## 4. Verify

- Site: `https://your-app.vercel.app`
- API health: `https://your-app.vercel.app/api/health`  
  Expect `"assessmentAi": true` when Gemini is configured.

## 5. Android APK for public users

After Vercel is live, set in root `.env`:

```env
VITE_WEBSITE_URL=https://your-app.vercel.app
```

Then build a release APK that talks to Vercel (any network):

```bash
npm run cap:apk:prod
```

Install `releases/ExamNexus Android App.apk`.

For local Wi‑Fi testing only, keep using `npm run cap:apk` (LAN IP).

## Important notes

- **AI duration:** long Gemini runs need Vercel **Pro** (`maxDuration` up to 300s). Hobby is capped at ~10s and may time out on big generations.
- **Never** put `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` in the frontend env without the `VITE_` prefix only for public values — secrets stay server-side as listed above.
- Custom domain: add it in Vercel, then update `VITE_WEBSITE_URL` and rebuild the APK with `cap:apk:prod`.
