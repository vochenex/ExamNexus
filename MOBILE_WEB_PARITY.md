# Mobile app → website parity (phones, tablets, iPads)

ExamNexus mobile polish used to apply **only** inside the Capacitor APK (`html.en-native-app`).
Visiting the Vercel site on a phone/tablet still looked like the **first APK**: oversized type,
large cards/icons, weak chart expand / landscape behavior, and uneven edge padding.

As of this update, the same compact shell also runs on the **website** when:

- viewport width ≤ 1023px, **or**
- the device is detected as phone / tablet / iPad (including large iPad landscape)

via `html.en-mobile-shell` (`src/utils/mobileShell.js`).

---

## Full change list (mobile APK v1 → latest, now on mobile web too)

### Shell & navigation
1. Bottom **tab bar** on phones/tablets (Dashboard / Subjects / Assess / …).
2. Compact **top bar** (logo + theme + notifications) instead of oversized floating icons.
3. Safe-area / tab-bar padding so content is not hidden behind the nav.
4. Assessments blocked on phone/tablet/iPad/native (desktop/laptop only).
5. PWA install affordances on mobile web; native push on APK only.

### Density (icons, words, cards, fields)
6. Smaller base font and heading scale on compact shells.
7. Tighter page padding, card padding, gaps, and border radii.
8. Smaller buttons, inputs, selects, and page-header icons.
9. Profile: smaller avatar with **inset border** (no clipped ring), denser stats/fields.
10. Create Assessment: equal Manual / Upload / AI tabs; inputs fit with equal side padding.
11. Calendar: smaller day cells (no left-edge clipping from overflow).
12. Announcements / tables: empty states and cells no longer cut off on the right edge.

### Charts & scrolling
13. Expand chart → fullscreen / landscape modal (APK orientation lock; web uses
    Screen Orientation + fullscreen when the browser allows it).
14. Horizontal scroll works **on the bars and around them** (`touch-action: pan-x pan-y`
    on chart/table scroll areas — fixed the bug that forced `pan-y` only).
15. Wider expanded chart columns so labels can scroll instead of truncating only.

### Auth (tablet / phone)
16. Phone: single-column login form.
17. Tablet (≥768px): **split** logo | form, vertically centered (web + native tablet).

### Notifications & admin (backend + UI)
18. In-app bell includes subject announcements, assessments, comments, reactions,
    admin broadcasts, and account status (requires SQL: `database/notifications_expand_feed.sql`).
19. Push expanded beyond faculty announcements: admin broadcasts, assessments posted,
    comments, reactions, account approval (needs `FCM_SERVICE_ACCOUNT_JSON` on Vercel).
20. Student Results: visibility uses `allow_student_view === false` (null no longer hides results);
    correct answers respect teacher settings.

### AI create flow
21. Removed duplicate gray spinner; keep Gemini progress bar only.

---

## What you must do after deploy

1. **Redeploy Vercel** (frontend + backend) so `en-mobile-shell` ships.
2. On the phone, hard-refresh or clear site data once (service worker may cache the old shell).
3. Run `database/notifications_expand_feed.sql` in Supabase if not already applied.
4. Set `FCM_SERVICE_ACCOUNT_JSON` + `FCM_PROJECT_ID` on Vercel for real device push (APK/PWA).

Desktop/laptop browsers (≥1024px and not a mobile UA) keep the full desktop layout unchanged.
