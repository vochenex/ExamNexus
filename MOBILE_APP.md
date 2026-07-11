# ExamNexus Mobile App (iOS & Android)

There are two ways to ship ExamNexus as an app, both from the **same React code**:

1. **PWA (installable web app) — recommended starter.** Users open the site and tap **Install** / **Add to Home Screen**.
2. **Capacitor native app** — real `.apk` / `.ipa` with push notifications (needs Android Studio / Xcode).

## What's different on mobile

| Area | Computer / laptop website | Mobile app + phones/tablets/iPads (website **or** APK) |
|------|---------------------------|------------------------------------------------------|
| Layout density | Comfortable desktop spacing | **Compact shell** (`en-mobile-shell` / `en-native-app`) — smaller type, cards, icons |
| Navigation | Top header / left sidebar | **Bottom tab bar** + compact top bar |
| Charts | Inline + expand | Expand → landscape/fullscreen; **sideways scroll on the bars** |
| Taking an assessment | Allowed (fullscreen lockdown) | **Blocked everywhere** — desktop/laptop only |
| Announcements / notifications | In-app bell | In-app bell; **native push** on APK (FCM on Vercel for delivery) |
| Everything else | ✅ | ✅ same product features |

See [MOBILE_WEB_PARITY.md](./MOBILE_WEB_PARITY.md) for the full APK→website change list.

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

For a **public launch** (any network + AI), deploy the web/API to Vercel first — see [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) — then build the store/release APK with `npm run cap:apk:prod`.

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
npm run cap:apk        # build installable debug APK (no Android Studio UI)
npm run cap:icons      # regenerate Android launcher icon from public/icons/logo.svg
```

### App icon

The Android home-screen icon is generated from `public/icons/logo.svg` (ExamNexus logo on `#031d1f`).

```bash
npm run cap:icons
npm run cap:apk
```

Users must install/update the APK to see a new launcher icon.

### Configuration

| Setting | Where |
|---------|--------|
| `VITE_WEBSITE_URL` | root `.env` — public website URL |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | root `.env` — same as web |
| `VITE_API_BASE_URL` | root `.env` — backend used for push dispatch |
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/.env` |
| `FCM_SERVICE_ACCOUNT_PATH` | `backend/.env` — path to Firebase service account JSON (v1 API) |
| `FCM_PROJECT_ID` | `backend/.env` — optional if set in the JSON (`examnexus-9d77a`) |
| `FCM_SERVER_KEY` | `backend/.env` — legacy only (deprecated; new projects cannot use this) |
| `appId` / `appName` | `capacitor.config.json` (`com.examnexus.app`) |

### Push notifications (students)

When a faculty announcement (or other push event) is posted, the app:

1. Saves each native device token into Supabase `push_devices` (run `database/push_notification_devices.sql`, then `database/push_devices_multi_account.sql` if upgrading).
2. Calls backend push routes after create (`/push/announce`, `/push/broadcast`, `/push/notify-users`).
3. Backend looks up recipient user ids and sends an FCM push (HTTP v1 via service account).
4. The phone shows a **system banner** even when ExamNexus is closed or another app is open (needs internet + notification permission).

**Multi-account on one phone:** every Saved Account that has logged in on that device keeps its own `push_devices` row for the same FCM token. Logging into account B no longer steals push from account A. Removing a Saved Account stops push for that user on this device.

**Setup checklist**

1. Run `database/push_notification_devices.sql` (and `push_devices_multi_account.sql` on existing projects) in Supabase SQL Editor.
2. Create a Firebase project, enable Cloud Messaging, add Android (`com.examnexus.app`) and/or iOS apps.
3. Firebase → **Project settings** → **Service accounts** → **Generate new private key** → save as `backend/firebase-service-account.json`.
4. In `backend/.env` (local) / Vercel env (production):
   ```env
   FCM_SERVICE_ACCOUNT_JSON=...one-line JSON...
   FCM_PROJECT_ID=examnexus-9d77a
   ```
5. For Android: add `google-services.json` under `android/app/` after `cap add android`.
6. For iOS: enable Push capability in Xcode, upload APNs key to Firebase, sync pods.
7. Rebuild/sync: `npm run cap:sync` then `npm run cap:apk:prod` for a release APK.

Without a service account JSON (or legacy server key), tokens still register but sends are skipped (logged).

Website/PWA uses the **same product features** (announcements, lock sections, results review, mobile shell). OS push banners are **APK/native** only; the web app uses the in-app notification bell while open.

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
