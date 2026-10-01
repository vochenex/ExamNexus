# ExamNexus — System Status Report

**Report date:** 19 September 2026  
**Repository:** ExamNexus (`main`)  
**Audience:** Capstone / demo stakeholders, faculty advisers, development review  

---

## 1. Brief overview

**ExamNexus** is a campus-focused **intelligent assessment platform**. One system serves three roles:

| Role | Purpose |
|------|---------|
| **Students** | Enroll in subjects, take timed assessments under lockdown, view results and analytics |
| **Faculty** | Create and schedule exams/quizzes (manual, upload, or AI), grade, review integrity and performance |
| **Administrators** | Approve accounts, manage academic catalog and subjects, announcements, exam logs, exports |

**Core workflow:** join a class → create and schedule assessments → sit them under browser lockdown → review scores, analytics, and integrity records.

The product is deployed as a **web app** (Vite + React), backed by an **Express API** (local and Vercel), with data in **Supabase** (Auth + Postgres). Optional **Capacitor** shells package the same UI for Android/iOS; exam lockdown is designed for **desktop browsers**, not phones or the mobile app.

---

## 2. What the system does (by role)

### 2.1 Public & authentication

- Marketing homepage (product story, features, contact)
- Login / signup with school email
- Registration requires **admin approval** before dashboard access
- Forgot-password flow with admin-assisted temporary passwords
- Remember-me and saved accounts on the device
- Profile management (all roles)

### 2.2 Administrator

- Dashboard with campus overview counts and charts
- Approve / manage user accounts and roles
- Password-reset queue and temporary passwords
- Departments & courses catalog
- Create and assign subjects; section setup
- Platform announcements (campus-wide, teachers, or students)
- Read-only assessments overview
- Exam integrity logs (campus-wide)
- Data export tools

### 2.3 Faculty

- Subject dashboard and per-subject detail (roster, assessments)
- **Create assessments** — manual builder, question bank, or **Document / Prompt AI**
  - Upload PDF, Word (`.docx`), or PowerPoint (`.pptx`)
  - AI classifies questionnaire vs study material; converts or generates by count/format/difficulty
- Schedule windows, duration, formats, points, settings
- Edit published assessments; retake requests
- Grading and results review
- Per-assessment **integrity** timeline (tab switch, fullscreen exit, copy/paste, etc.)
- Analytics (scores, time-on-question, class views)
- Subject social / announcements hub
- Faculty data exports

### 2.4 Student

- Enroll via subject join codes
- List and open available assessments
- **Take assessment** (desktop): fullscreen lockdown, timer, local answer persistence
- Integrity rules: major strikes (tab hidden, fullscreen exit, Alt+Tab / overlay, multiple tabs) → auto-submit after 3; minor events logged only
- Offline-friendly answer queue until connection returns (no auto-submit solely for going offline)
- Results list and detailed review
- Subject social feed and platform announcements

---

## 3. Architecture (high level)

Full map, HTTPS routes, API key names, and a redraw prompt: `docs/SYSTEM_ARCHITECTURE.md`.

```
Browser / PWA / Capacitor app
        │
        ├─ React frontend (Vite)  →  Supabase Auth + Realtime/DB (client)
        │
        └─ Express API (backend/) →  Gemini (assessment AI), FCM/Web Push,
                                     document extract, privileged admin ops
                │
                └─ Supabase (service role where needed)
```

| Layer | Location | Responsibility |
|-------|----------|----------------|
| UI | `frontend/` | Pages, layouts, hooks, integrity lockdown UI |
| API | `backend/` | AI routes, password reset, push, uploads |
| Data | `database/` + Supabase | Tables, RPCs, RLS policies |
| Hosting | Vercel (`api/`) + optional LAN backend | Serverless API + static frontend |
| Native | `android/` · `ios/` (Capacitor) | APK / iOS shell around the same web UI |

---

## 4. Major external technologies

| Area | Tools |
|------|--------|
| UI | React 19, React Router, Tailwind CSS, Lucide icons |
| Backend | Node.js, Express, Multer (uploads) |
| Database / Auth | Supabase (Postgres, Auth, Realtime) |
| Assessment AI | Google Gemini (document + prompt keys); optional Groq for prompts |
| Document text | `pdf-parse`, Mammoth (`.docx`), JSZip (`.pptx`) |
| Push | Firebase Cloud Messaging (native), Web Push / VAPID (PWA) |
| Mobile shell | Capacitor (App, Status Bar, Push, Screen Orientation, etc.) |
| Deploy | Vite build, Vercel serverless entry |

**Exam integrity** is **not** a third-party proctoring product. It is custom logic on browser APIs (Fullscreen API, `visibilitychange`, blur/focus, keyboard, clipboard, `beforeunload`, multi-tab via `localStorage`).

---

## 5. Feature status summary

| Area | Status | Notes |
|------|--------|--------|
| Auth, approval, profiles | **Operational** | School-email signup + admin gate |
| Admin catalog / subjects / accounts | **Operational** | Core campus administration |
| Faculty create / edit / schedule | **Operational** | Manual + bank + AI paths |
| Document AI (PDF / DOCX / PPTX) | **Operational** | Classify + convert / generate; sensitive to Gemini free-tier quota |
| Prompt AI generation | **Operational** | Separate Gemini prompt key recommended |
| Student take exam + lockdown | **Operational** on desktop | Disabled / redirected on phone & mobile app |
| Integrity logging & faculty view | **Operational** | Major vs minor severity; 3-strike auto-submit |
| Grading & results | **Operational** | Auto + faculty review flows |
| Analytics | **Operational** | Class / student / question-time views |
| Announcements & subject social | **Operational** | Role-scoped delivery |
| Push notifications | **Operational** | Native FCM + web push where configured |
| PWA / Capacitor APK | **Operational** | Assessment lockdown remains desktop-web focused |
| Demo walkthrough assets | **Present** | `docs/DEMO_WALKTHROUGH_SCRIPT.md` + PDF download |

---

## 6. Known constraints & operational notes

1. **Gemini quota** — Free-tier limits are per model/key. Prefer `gemini-3.5-flash-lite` (or equivalent available Flash-Lite) with **two distinct** keys (`GEMINI_API_KEY` / `GEMINI_PROMPT_API_KEY`). Exhausted models surface a clear quota error rather than a hung progress bar.
2. **Upload size** — Document AI uploads capped near **4 MB** for Vercel body limits.
3. **Lockdown scope** — Fullscreen / tab-switch enforcement is for **desktop or laptop browsers**. Not for phone, tablet, or Capactor APK take flows.
4. **Integrity honesty** — No webcam / ID / room scanning. Monitoring is event logging + lockdown UI, not remote proctoring SaaS.
5. **Local vs hosted** — Local backend on port 5000 must match `VITE_API_BASE_URL`; Vercel uses the serverless `api/` mount with ~60s function limits (AI paths are tuned accordingly).

---

## 7. Recent development focus (AI document path)

Recent work concentrated on making Document AI reliable under Vercel time limits and free-tier Gemini quotas:

- Reuse extracted text after classify (avoid double upload/extract)
- Cap retries and fail fast on quota (429)
- PPTX text extraction via slide XML
- Progress UX (waiting crawl, clear stale 100% bar, scroll FAB)
- Model defaults aligned to available Flash-Lite IDs when older Flash models are retired or quota-exhausted

Some of those fixes may still be local / unpushed relative to `origin/main`; treat production Gemini env vars as part of go-live checklist.

---

## 8. How to run (quick reference)

| Task | Command / action |
|------|------------------|
| Frontend | `npm run dev` (repo root; Vite) |
| Backend | `npm start` in `backend/` (port **5000**) |
| Env | Root `.env` → `VITE_API_BASE_URL`; `backend/.env` → Supabase + Gemini (+ FCM/VAPID as needed) |
| Production | Vercel deploy; set the same secrets in project env |

---

## 9. Bottom line

ExamNexus is a **working end-to-end campus assessment system**: admin governance, faculty authoring (including AI-assisted documents), student lockdown exams, grading, analytics, and integrity audit trails. It is suitable for **demo and capstone presentation** on desktop, with AI features dependent on healthy Gemini quota and correct environment configuration.

---

*Generated for ExamNexus project documentation. Update this file when major modules ship or constraints change.*
