## Mål

Instrumentera nyckelevents enligt Steg 5 och flytta `page_view` till TanStack Routers `onResolved`-subscribe så att alla navigeringar fångas (inklusive `router.navigate`, replace, back/forward).

## Events som läggs till / justeras

| Event | Var | Trigger |
|---|---|---|
| `page_view` | `src/router.tsx` (+ ta bort useEffect i `__root.tsx`) | `router.subscribe("onResolved", …)` — dedupa per path (behåll befintlig logik) |
| `signup_started` | `src/routes/auth.tsx` | När formuläret submittas i `mode === "signup"` (före supabase-call) |
| `signup_completed` | redan klart (`trackOnce`) | — |
| `plan_created` | `src/routes/_authenticated/exam.new.tsx` | I `onSuccess` bredvid befintligt `exam_created` (behåll `exam_created` för bakåtkomp.) |
| `study_session_started` | `src/components/ExamView.tsx` | När `ExercisesDialog` öppnas för en task (setExercise(...)-callsite) |
| `task_completed` | redan klart | — |

## Teknisk detalj

**`page_view` via router:**

`src/lib/analytics.ts` exporterar redan `trackPageView(path)` med in-memory dedupe. Vi:
1. Tar bort `useEffect(trackPageView)` i `src/routes/__root.tsx` (och `useLocation`-importen om oanvänd).
2. I `src/router.tsx`, efter `createRouter(...)`:
   ```ts
   router.subscribe("onResolved", ({ toLocation }) => {
     trackPageView(toLocation.pathname + toLocation.search);
   });
   ```
   Dedupe per path finns redan i `trackPageView` (`lastTrackedPath`).

**`signup_started`:** i `handleSubmit` innan `supabase.auth.signUp`, kalla `track("signup_started", { method: "email" })`.

**`plan_created`:** i `create` mutation `onSuccess`, lägg till `track("plan_created", { exam_id: res.id, subject, grade: grade || null })` bredvid `exam_created`.

**`study_session_started`:** i `ExamView.tsx` där en task öppnar `ExercisesDialog` (setExercise-anropet), kalla `track("study_session_started", { task_id, exam_id })`. Dedupas ej — varje öppning räknas.

## Filer som ändras

- `src/lib/analytics.ts` — inga nya API:er behövs (`trackPageView` finns redan).
- `src/router.tsx` — lägg till `router.subscribe("onResolved", …)`.
- `src/routes/__root.tsx` — ta bort useEffect + trackPageView-anrop.
- `src/routes/auth.tsx` — `signup_started` i submit.
- `src/routes/_authenticated/exam.new.tsx` — `plan_created` bredvid `exam_created`.
- `src/components/ExamView.tsx` — `study_session_started` vid dialog-öppning.

Övriga befintliga events (`exam_created`, `task_completed`, `exercise_started`, `answer_graded`, `lesson_opened`, `podcast_played`, `share_link_opened`, `return_visit`) lämnas orörda.
