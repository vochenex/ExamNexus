# ExamNexus

ExamNexus is a web-based assessment and learning platform for schools. It supports **students**, **faculty**, and **administrators** with role-based dashboards for taking exams, creating assessments, grading, announcements, analytics, and platform administration.

## Features

| Role | Capabilities |
|------|----------------|
| **Student** | Enroll in subjects, take timed assessments, view results and analytics, subject social feeds |
| **Faculty** | Create and edit assessments, manage subject sections, grade submissions, view integrity alerts and exam analytics |
| **Admin** | Approve accounts, manage users and subjects, password resets, catalog, exports, platform-wide announcements and exam logs |

New student and faculty accounts use school email signup (`lastname.firstname@crmc.en.com`) and require **admin approval** before accessing the dashboard.

## Tech stack

- **Frontend:** React 19, Vite, React Router, Tailwind CSS, Supabase JS client
- **Backend:** Node.js, Express (port `5000`)
- **Database & auth:** Supabase (PostgreSQL + Row Level Security)

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- A [Supabase](https://supabase.com/) project
- npm (included with Node.js)

## Project structure

```
ExamNexus/
├── src/                 # React frontend (pages, components, guards, utils)
├── backend/             # Express API (password reset, analytics, enrollment helpers)
├── database/            # Supabase SQL migrations and one-off fixes (run in SQL Editor)
├── public/              # Static assets
├── .env.example         # Frontend environment template
└── backend/.env.example # Backend environment template
```

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/vochenex/ExamNexus.git
cd ExamNexus
npm install
cd backend && npm install && cd ..
```

### 2. Configure environment variables

**Frontend** — copy the template and fill in your Supabase project values:

```bash
cp .env.example .env
```

**Backend** — required for admin password reset and other privileged operations:

```bash
cp backend/.env.example backend/.env
```

| Variable | Location | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | `.env` | Supabase project URL (frontend) |
| `VITE_SUPABASE_ANON_KEY` | `.env` | Supabase anon/public key (frontend) |
| `VITE_API_BASE_URL` | `.env` | Optional; defaults to `http://localhost:5000` |
| `SUPABASE_URL` | `backend/.env` | Same project URL (backend) |
| `SUPABASE_ANON_KEY` | `backend/.env` | Anon key (backend) |
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/.env` | **Server only** — never use `VITE_` prefix |
| `AI_PROVIDER` | `backend/.env` | `ollama` (default) or `openai` |
| `OLLAMA_BASE_URL` | `backend/.env` | Local Ollama URL (default `http://localhost:11434`) |
| `OLLAMA_MODEL` | `backend/.env` | Installed Ollama model (e.g. `llama3`) |
| `OPENAI_API_KEY` | `backend/.env` | Only when `AI_PROVIDER=openai` |

Verify the backend loaded the service role key:

```bash
curl http://localhost:5000/health
```

A successful response includes `"passwordReset": true`.

### 3. Database setup (Supabase SQL Editor)

Run scripts in `database/` in your Supabase project. For a new deployment, apply the core scripts in this order:

1. `users_signup_policies.sql` — signup RLS, profile sync, account access checks
2. `admin_account_approvals.sql` — pending/approved account workflow
3. `admin_platform.sql` — admin tables, policies, and RPCs
4. `admin_platform_fixes.sql` — admin password reset and related fixes
5. Additional domain scripts as needed (subjects, exams, grading, notifications, etc.)

Other files in `database/` are incremental migrations or targeted fixes; run them when their feature is required or when upgrading an existing database.

**First admin account:**

1. Sign up at `/auth` with your email and password.
2. Run `database/create_admin_account.sql` (update the email in the script).
3. Or call `SELECT public.promote_user_to_admin('your@email.com');` after approvals SQL is applied.

### 4. Run the application

**Terminal 1 — frontend:**

```bash
npm run dev
```

Open the URL shown by Vite (typically `http://localhost:5173`).

**Terminal 2 — backend** (from project root or `backend/`):

```bash
npm run backend
```

Or:

```bash
cd backend
npm start
```

Keep this terminal open while using the app.

## Usage

### Authentication

- **Login:** `/auth` — any valid email for existing users (including admins with non-school emails).
- **Signup:** Students and faculty must use `lastname.firstname@crmc.en.com`. Pending users see an approval notice and cannot access dashboards until an admin approves them.
- **Password reset:** Faculty/students submit requests; admins complete resets from **Admin → Password Resets** (backend must be running with a valid service role key).

### Routes (overview)

| Path | Audience |
|------|----------|
| `/auth` | Login and signup |
| `/student/*` | Student dashboard, subjects, assessments, results |
| `/faculty/*` | Faculty dashboard, create/edit assessments, grading, announcements |
| `/admin/*` | Admin dashboard, accounts, subjects, catalog, exports, exam logs |

Route guards (`ProtectedRoute`, `AdminRouteGuard`) enforce authentication and account approval status before rendering dashboards.

### Production build

```bash
npm run build
npm run preview
```

Deploy the `dist/` folder to your static host. Point `VITE_API_BASE_URL` at your deployed backend if it is not on `localhost:5000`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `cd backend && npm start` | Start Express API |

## Security notes

- Never commit `.env` or `backend/.env`.
- Do not prefix the Supabase **service role** key with `VITE_`; it must only exist on the server.
- Review Supabase RLS policies in `database/` before exposing the project publicly.

## License

Private / educational use — see repository owner for licensing terms.
