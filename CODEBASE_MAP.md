# ExamNexus codebase map

Quick locator while debugging. Local tip: amber **Debug · page file** badge shows the active page (`Ctrl+Shift+D`).

---

## Top level

| Path | Includes |
|---|---|
| `frontend/` | React UI — pages, layouts, components, styles, hooks, utils |
| `backend/` | Express API — routes, AI, password reset, push, uploads |
| `database/` | Supabase SQL — tables, RPCs, policies, one-off fixes |
| `api/` | Vercel serverless entry (`api/index.js` mounts backend) |
| `android/` · `ios/` | Capacitor native shells (APK / iPhone) |
| `public/` | Static web assets (icons, manifest, SW, downloads) |
| `scripts/` | Build / audit / APK / env helpers |
| `CODEBASE_MAP.md` | This file |

---

## `frontend/` — boot

| File | Key points |
|---|---|
| `main.jsx` | App boot, providers, PWA/native init |
| `App.jsx` | Route table — URL → page component |
| `App.css` | Legacy/app-level CSS leftovers |
| `index.css` | Global CSS variables, shells, shared UI |
| `supabaseClient.js` | Browser Supabase client |

---

## `frontend/pages/` — screens (`*Page.jsx`)

### `pages/public/`
| File | Key points |
|---|---|
| `HomePage.jsx` | Marketing home `/` — hero, about, team, contact |

### `pages/auth/`
| File | Key points |
|---|---|
| `AuthPage.jsx` | Login · signup · forgot password · send/update reset · remember-me · saved accounts |

### `pages/shared/`
| File | Key points |
|---|---|
| `ProfilePage.jsx` | Profile edit (student / faculty / admin) |
| `PlatformAnnouncementsPage.jsx` | Platform-wide announcements feed |

### `pages/Admin/`
| File | Key points |
|---|---|
| `AdminDashboardPage.jsx` | Admin overview / stats cards |
| `AdminAccountsPage.jsx` | Approve / manage accounts |
| `AdminPasswordResetsPage.jsx` | Forgot-password queue · set temp password · admin message |
| `AdminSubjectsPage.jsx` | Manage subjects |
| `AdminAssignedSubjectsPage.jsx` | Subject assignments |
| `AdminCatalogPage.jsx` | Departments & courses |
| `AdminAnnouncementsPage.jsx` | Admin announcements CRUD |
| `AdminAssessmentsPage.jsx` | Assessments overview |
| `AdminExamLogsPage.jsx` | Integrity / exam logs |
| `AdminExportsPage.jsx` | Data export tools |

### `pages/Faculty/`
| File | Key points |
|---|---|
| `FacultyDashboardPage.jsx` | Faculty home · subjects · create |
| `CreateAssessmentPage.jsx` | New exam/quiz · manual / upload / AI |
| `EditAssessmentPage.jsx` | Edit existing assessment |
| `FacultySubjectDetailsPage.jsx` | One subject · students · assessments |
| `FacultyAssessmentDetailsPage.jsx` | One assessment · scores · retakes · analytics |
| `FacultySubjectSocialPage.jsx` | Subject social / classmates side |
| `FacultyAnnouncementsHubPage.jsx` | Faculty announcements hub |
| `QuestionBankPage.jsx` | Saved question bank |

### `pages/Student/`
| File | Key points |
|---|---|
| `StudentDashboardPage.jsx` | Student home |
| `StudentSubjectsPage.jsx` | Enrolled subjects · join codes |
| `StudentSubjectDetailsPage.jsx` | One subject for student |
| `StudentSubjectSocialPage.jsx` | Subject social feed |
| `StudentAssessmentsPage.jsx` | Available assessments list |
| `TakeAssessmentPage.jsx` | Live take exam · lockdown · submit |
| `StudentResultsListPage.jsx` | Results list |
| `StudentResultDetailPage.jsx` | One result · review answers |

### `pages/_unused/`
Old unused screens (not in `App.jsx`): `Admin` · `Faculty` · `Student` · `StudenEnroll` · `StudentExams` · `TeacherAnalytics` — ignore unless recovering old flows.

---

## `frontend/layouts/`

| File | Key points |
|---|---|
| `DashboardLayout.jsx` | Student/faculty sidebar shell · collapse · logout |
| `AdminLayout.jsx` | Admin sidebar shell |
| `ThemeContext.jsx` | Light/dark theme provider |
| `Calendar.css` | Calendar widget styles |

---

## `frontend/config/`

| File | Key points |
|---|---|
| `routeFileMap.js` | Route → page file map (debug badge) |
| `appConfig.js` | Small app config constants |

---

## `frontend/guards/`

| File | Key points |
|---|---|
| `ProtectedRoute.jsx` | Must be logged in (student/faculty) |

*(Admin gate also uses `components/AdminRouteGuard.jsx`.)*

---

## `frontend/contexts/`

| File | Key points |
|---|---|
| `AppModalContext.jsx` | Global confirm / alert / success modals |
| `AppSplashContext.jsx` | Branded splash / loading overlay |
| `AssessmentLockdownContext.jsx` | Exam lockdown UI state |
| `NavigationProgressContext.jsx` | Top progress bar · nav click lock |

---

## `frontend/hooks/`

| File | Key points |
|---|---|
| `useQuestionSections.js` | Multi-section question builder state |
| `useAssessmentIntegrity.js` | Focus / tab / integrity events while taking |
| `useQuestionTimeTracking.js` | Per-question time spent |
| `useRealtimeFetch.js` | Polling / realtime-ish refresh |
| `useSidebarCollapsed.js` | Desktop sidebar collapse preference |
| `useMobileNav.js` | When bottom tab bar replaces sidebar |
| `useProgressNavigate.js` | Navigate with progress bar |
| `usePageMeta.js` | Document title / meta |
| `usePageLoader.js` | Page loading helpers |
| `useInstallPrompt.js` | PWA install prompt state |
| `useBlockingAppSplash.js` | Block UI behind splash |
| `useHomeActiveSection.js` | Home page section spy |
| `useScrollReveal.js` | Scroll reveal animations |
| `useModalDismiss.js` | Esc / outside click dismiss |

---

## `frontend/styles/`

| File | Key points |
|---|---|
| `auth.css` | Auth card split layout · scroll · login/forgot |
| `home.css` | Marketing home · auth shell background |
| `motion.css` | Shared motion · sidebar collapse transitions |
| `native-app.css` | APK / mobile-shell density overrides |
| `nav-progress.css` | Top navigation progress bar |
| `splash.css` | Logo splash animation |

---

## `frontend/components/` (grouped)

### Core / chrome
`AppBootstrap` · `DevRouteFileIndicator` · `RouteFallback` · `WebOnlyHomeRoute` · `NavigationProgressOverlay` · `LogoSplashScreen` · `ThemeToggle` · `NotificationBell` · `BackButton` · `ProgressLink` · `SidebarNavLink` · `SidebarCollapseToggle` · `NativeAuthHeader` · `NativeBackBridge` · `RequiredSchoolIdGate` · `ExamNexusLogo` · `ExamNexusBrand` · `ProfileAvatar` · `AvatarLightbox` · `DefaultAvatarIcon`

### Auth / home subfolders
- `auth/` — `SignupFormFields` · `PendingApprovalModal`
- `home/` — header · footer · team · banner · illustrations · scroll reveal · bottom bar
- `mobile/` — `MobileTabBar` · `mobileNav` config
- `pwa/` — install button · chooser · iOS sheet · update prompt
- `admin/` — `AdminPageError` · `AdminBarChart` · table style helpers
- `ui/` — buttons · inputs · select · modal · skeleton · page header · progress button · etc.

### Assessment / teaching (keypoints)
AI generator · question builder · grading options · schedule · calendar · points · settings · bank picker · integrity panels · analytics charts · retake requests · lockdown modal · submission overlays · student cards · subject panels · export · announcements card

---

## `frontend/utils/` (grouped keypoints)

| Group | Files / focus |
|---|---|
| **Auth / session** | `authUser` · `authProfile` · `authSignup` · `authNotice` · `sessionLogout` · `sessionReset` · `savedAccounts` · `schoolEmail` · `schoolIdRules` · `avatar` · `passwordReset` |
| **Supabase / API** | `supabaseData` (big data layer) · `supabaseErrors` · `apiBase` · `adminData` |
| **Assessments** | `assessmentQuestions` · `assessmentTake` · `assessmentStatus` · `assessmentAi` · `assessmentReport` · `assessmentDuration` · `assessmentCategories` · `aiQuestionMapper` · `questionBank` · `questionGrading` · `questionSections` · `promptPreferences` |
| **Exams / integrity** | `examIntegrity` · `examAnalytics` · `facultyGrading` · `questionTimeAnalytics` |
| **Student** | `studentAnalytics` · `studentGradeStorage` · `studentSearch` · `gradeComputation` |
| **Subjects** | `sections` · `subjectDisplay` · `subjectClassAnalytics` · `academicOptions` · `yearLevels` |
| **Push / PWA / native** | `pushNotifications` · `pushDispatch` · `pwa` · `platform` · `nativeApp` · `nativeBack` · `nativeRoutes` · `mobileShell` · `iosInputZoom` |
| **UI helpers** | `themeButtons` · `themeInputs` · `themeColors` · `motion` · `pageMeta` · `exportCsv` · `choiceLabels` · `notificationRoutes` · `notificationDismissals` |

---

## `backend/`

| Path | Key points |
|---|---|
| `server.js` | Local API listen |
| `createApp.js` | Express app · mounts routes |
| `routes/passwordResetRoute.js` | Admin complete reset · stores temp password |
| `routes/assessmentAiRoute.js` | AI generate from prompt / document |
| `routes/analyticsRoute.js` | Analytics endpoints |
| `routes/pushRoute.js` | Push notification APIs |
| `routes/subjectsRoute.js` | Subject helpers |
| `routes/extract.js` · `generate.js` | Doc extract / generate helpers |
| `lib/aiProvider.js` | Groq + Gemini clients · retries |
| `lib/assessmentAiGenerator.js` | Question generation logic |
| `lib/documentExtractor.js` · `documentBlocks.js` | File → text for AI |
| `lib/supabaseAdmin.js` · `supabaseClient.js` | Service / user Supabase |
| `lib/pushSender.js` | Send push |
| `middleware/requireFaculty.js` · `verifyAccessToken.js` | Auth gates |
| `controllers/` | `auth` · `exam` · `analytics` controllers |
| `.env` | **Secrets — do not commit** |

---

## `database/` (grouped)

| Group | Examples / focus |
|---|---|
| **Password reset** | `password_reset_requests.sql` · `password_reset_user_reveal.sql` |
| **Users / signup / admin** | `users_signup_policies` · `admin_*` · `create_admin_account` · `fix_admin_login_*` |
| **Subjects / sections** | `subject_*` · `enroll_student` · `classmates_*` |
| **Exams / questions** | `question_*` · `assessment_category` · `exam_*` · `question_bank` |
| **Results / analytics** | `student_*` · `faculty_exam_analytics_*` · `faculty_save_scores_*` |
| **Integrity / retakes** | `exam_integrity_events` · `exam_retake_requests` · fix_* retake scripts |
| **Notifications / push** | `notifications_*` · `push_*` |
| **Announcements** | `admin_announcement_social` · `announcement_comment_edit` |
| **Cleanup / one-offs** | `cleanup_*` · `delete_user_*` · email/school update scripts |

---

## `api/` · `scripts/` · native

| Path | Key points |
|---|---|
| `api/index.js` | Vercel function → backend app |
| `scripts/check-import-casing.mjs` | Case-sensitive import guard |
| `scripts/audit-page-imports.mjs` | Page file presence audit |
| `scripts/audit-page-eslint.mjs` | Page eslint spot-check |
| `scripts/build-apk.ps1` · `cap` helpers | Android APK / Capacitor |
| `scripts/prepare-native-api-url.mjs` | Native API base URL |
| `android/` · `ios/` | Native project wrappers around `dist/` |

---

## Native note

APK and iPhone use the **same** `frontend/` build (`capacitor.config.json` → `webDir: dist`). Rebuild native apps after UI changes to ship them.
