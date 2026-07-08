# ExamNexus Mobile App (iOS & Android)

There are two ways to ship ExamNexus as an app, both from the **same React code**:

1. **PWA (installable web app) — recommended starter.** Users open the site and tap **Install** / **Add to Home Screen**.
2. **Capacitor native app** — real `.apk` / `.ipa` with push notifications (needs Android Studio / Xcode).

## What's different on mobile

| Area | Computer / laptop website | Mobile app + phones/tablets/iPads |
|------|---------------------------|----------------------------------|
| Navigation | Top header / left sidebar | **Bottom tab bar** + "More" sheet |
| Taking an assessment | Allowed (fullscreen lockdown) | **Blocked everywhere** — desktop/laptop only |
| Announcements / notifications | In-app bell | In-app bell **+ native push** to the phone |
| Everything else | ✅ | ✅ identical |

### Desktop-only assessments (important)

Students **cannot** take assessments on:

- the ExamNexus **mobile app**
- a **phone browser**
- a **tablet / iPad** (any orientation)

Opening the website on those devices still shows a block screen. Assessments require a **computer or laptop** browser (`viewport ≥ 1024px` and not a mobile/tablet UA), so integrity lockdown can run properly.

---

## PWA install

See the PWA section below; ship with normal `npm run build` over HTTPS.

---

## Capacitor native app

Same React app wrapped with [Capacitor](https://capacitorjs.com/).

### One-time setup

```bash
npm install
npm run build
npm run cap:add:android    # needs Android Studio + JDK 17
npm run cap:add:ios        # macOS + Xcode + CocoaPods only
```

### Daily workflow

```bash
npm run cap:android    # build web, sync, open Android Studio
npm run cap:ios        # build web, sync, open Xcode
npm run cap:sync       # rebuild web + copy into native projects
```

### Configuration

| Setting | Where |
|---------|--------|
| `VITE_WEBSITE_URL` | root `.env` — public website URL |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | root `.env` — same as web |
| `VITE_API_BASE_URL` | root `.env` — backend used for push dispatch |
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/.env` |
| `FCM_SERVER_KEY` | `backend/.env` — Firebase Cloud Messaging key for push delivery |
| `appId` / `appName` | `capacitor.config.json` (`com.examnexus.app`) |

### Push notifications (students)

When a faculty announcement is posted, the app:

1. Saves each native device token into Supabase `push_devices` (run `database/push_notification_devices.sql`).
2. Calls backend `POST /push/announce` after create.
3. Backend looks up enrolled students for that subject/section and sends an FCM push.

**Setup checklist**

1. Run `database/push_notification_devices.sql` in Supabase SQL Editor.
2. Create a Firebase project, enable Cloud Messaging, add Android (`com.examnexus.app`) and/or iOS apps.
3. Put the FCM server key in `backend/.env` as `FCM_SERVER_KEY=...`.
4. For Android: add `google-services.json` under `android/app/` after `cap add android`.
5. For iOS: enable Push capability in Xcode, upload APNs key to Firebase, sync pods.
6. Rebuild/sync: `npm run cap:sync`.

Without `FCM_SERVER_KEY`, tokens still register but sends are skipped (logged).

### Key files

| File | Purpose |
|------|---------|
| `capacitor.config.json` | Native id/name + push plugin options |
| `src/utils/platform.js` | `isNativeApp()`, `canTakeAssessmentOnThisDevice()` |
| `src/utils/nativeApp.js` | Status bar, back button, push init |
| `src/utils/pushNotifications.js` | Capacitor PushNotifications + token upsert |
| `database/push_notification_devices.sql` | `push_devices` table + RPCs |
| `backend/routes/pushRoute.js` | `/push/announce`, `/push/notify-users` |
| `backend/lib/pushSender.js` | FCM send helpers |
| `src/components/mobile/MobileTabBar.jsx` | Bottom tab bar |
| `src/hooks/useMobileNav.js` | When bottom nav replaces the sidebar |

### How assessment blocking works

- `StudentAssessmentCard` — warns and blocks on non-desktop devices (including the app).
- `TakeAssessment` — hard gate; never mounts the exam UI on phone/tablet/iPad/native.
- `NotificationBell` — assessment links on those devices go to `/student/assessments` with a warning instead of opening the exam.

---

## PWA install (the downloadable web app)

Nothing separate to build — ships with `npm run build` over **HTTPS**.

How users install:
- **Android (Chrome):** Install prompt / menu → *Install app*
- **Desktop (Chrome/Edge):** address-bar install icon or in-app download icon
- **iPhone/iPad (Safari):** Share → Add to Home Screen

| File | Purpose |
|------|---------|
| `public/manifest.webmanifest` | App name, icons, standalone display |
| `public/sw.js` | Service worker |
| `public/icons/*` | App icons |
| `src/utils/pwa.js` | Registers the service worker (prod web only) |
| `src/hooks/useInstallPrompt.js` | Shared install state |
| `src/components/pwa/InstallIconButton.jsx` | Header install icon |

Notes:
- The service worker never caches Supabase/API calls.
- After deploy, bump `CACHE_VERSION` / build stamp in `sw.js` so clients refresh.
