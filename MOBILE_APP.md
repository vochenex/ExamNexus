# ExamNexus Mobile App (iOS & Android)

There are two ways to ship ExamNexus as an app, both from the **same React code**:

1. **PWA (installable web app) — recommended, no app store, no emulators.**
   Users just open the site and tap **Install** (Android/desktop) or **Add to
   Home Screen** (iOS). It launches fullscreen with its own icon like a native app.
2. **Capacitor native app** — a real `.apk`/`.ipa` for the app stores (needs
   Android Studio / Xcode). See the Capacitor sections below.

## PWA install (the "downloadable" version)

Nothing to build separately — the PWA ships with your normal `npm run build`
and works once the site is served over **HTTPS** (localhost also works for testing).

How users install it:
- **Android (Chrome):** an **Install ExamNexus** prompt appears; or menu → *Install app*.
- **Desktop (Chrome/Edge):** install icon in the address bar, or the in-app pill.
- **iPhone/iPad (Safari):** **Share → Add to Home Screen** (the app shows a guide).

PWA files:
| File | Purpose |
|------|---------|
| `public/manifest.webmanifest` | App name, icons, colors, standalone display |
| `public/sw.js` | Service worker — makes it installable + offline-resilient |
| `public/icons/*` | App icons (192, 512, maskable, apple-touch) |
| `src/utils/pwa.js` | Registers the service worker (prod web only) |
| `src/hooks/useInstallPrompt.js` | Shared PWA install state (captures the install event) |
| `src/components/pwa/InstallIconButton.jsx` | Header install icon (beside theme toggle) + tooltip |
| `src/components/pwa/IosInstallSheet.jsx` | iOS "Add to Home Screen" instructions sheet |
| `public/icons/logo.svg` | Website logo (same as `ExamNexusLogo.jsx`) — source for all icons |
| `scripts/gen-pwa-icons.mjs` | Regenerate icons: `node scripts/gen-pwa-icons.mjs` |

Notes:
- The service worker never caches Supabase/API calls, so live data and logins
  always hit the network.
- After deploying changes, bump `CACHE_VERSION` in `public/sw.js` to refresh clients.

---

## Capacitor native app

The native app is the **same React app** wrapped with [Capacitor](https://capacitorjs.com/).
It reuses 100% of the website's code, theme, and features — no separate codebase.

## What's different in the app vs. the website

| Area | Website | Mobile app |
|------|---------|------------|
| Navigation | Top header (home) / left sidebar (dashboards) | **Bottom tab bar** with a "More" sheet |
| Taking an assessment | In-app, with fullscreen integrity lockdown | **Not allowed** — tapping "Take Assessment" opens the exam on the website in the system browser |
| Everything else (auth, dashboards, subjects, results, analytics, admin, faculty tools) | ✅ | ✅ identical |

Assessments are website-only on purpose: the exam integrity features (fullscreen
lockdown, tab-switch detection) require a real browser and can't be enforced inside a
webview.

## One-time setup

```bash
npm install                 # installs Capacitor + all deps
npm run build               # produces dist/
npm run cap:add:android     # creates the native android/ project (needs Android Studio)
npm run cap:add:ios         # creates the native ios/ project (needs Xcode, macOS only)
```

Requirements:
- **Android:** Android Studio + JDK 17
- **iOS:** macOS + Xcode + CocoaPods

## Daily workflow

```bash
npm run cap:android    # build web, sync, open Android Studio → Run on device/emulator
npm run cap:ios        # build web, sync, open Xcode → Run on simulator/device
npm run cap:sync       # just rebuild web + copy into native projects
```

## Configuration

- **Website URL for the assessment redirect:** set `VITE_WEBSITE_URL` in `.env`
  (defaults to `https://examnexus.app`). See `src/config/appConfig.js`.
- **App identity:** `capacitor.config.json` (`appId`: `com.examnexus.app`, `appName`: `ExamNexus`).
- **Supabase:** the app talks to the same Supabase backend as the website via the same
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

## Key implementation files

| File | Purpose |
|------|---------|
| `capacitor.config.json` | Native app config (id, name, status bar) |
| `src/utils/platform.js` | `isNativeApp()`, `openOnWebsite()` |
| `src/utils/nativeApp.js` | Native init (status bar, Android back button) |
| `src/config/appConfig.js` | `WEBSITE_URL` + `websiteUrl(path)` |
| `src/hooks/useMobileNav.js` | True in the app + on small screens |
| `src/components/mobile/MobileTabBar.jsx` | Dashboard/admin bottom tab bar + More sheet |
| `src/components/mobile/mobileNav.js` | Per-role tab items |
| `src/components/home/HomeBottomBar.jsx` | Homepage bottom bar |

## How the "Take Assessment" redirect works

- `StudentAssessmentCard` — in the app, the button shows a confirm dialog, then opens
  `<WEBSITE_URL>/student/take-assessment/<id>` in the system browser.
- `TakeAssessment` page — if reached any other way (notification, deep link) in the app,
  it redirects to the website and never mounts the exam experience.
