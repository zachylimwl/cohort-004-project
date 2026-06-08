# Plan: Instructor Analytics Dashboard

> Source PRD: `prd/instructor-analytics-dashboard.md`

## Architectural decisions

- **Routes**: `/instructor/analytics` (instructor role) and `/admin/users/:userId/analytics` (admin role); both use React Router loaders with role checks matching existing patterns
- **Schema**: No schema changes needed — all required data exists in `enrollments`, `purchases`, `lessonProgress`, and `quizAttempts`
- **Key models**: `enrollments.enrolledAt`, `enrollments.completedAt`, `purchases.pricePaid` (cents), `quizAttempts.passed` + `quizAttempts.attemptedAt`, `lessonProgress.status`
- **Analytics service**: New `analyticsService.ts` in `/app/services/`; all query functions accept `instructorId`, optional `startDate`/`endDate`, and optional `courseId` — same signatures serve both routes
- **Filters via URL search params**: Date range and course selection are encoded in the URL so filters are bookmarkable and work with React Router's loader pattern
- **Charting**: Recharts installed as a new dependency; LineChart for time-series, BarChart for the funnel
- **Authorization**: Mirrors existing pattern — instructor route checks `user.role === instructor`, admin route checks `user.role === admin`; no cross-role access

---

## Phase 1: Route scaffold + stat cards

**User stories**: 1, 2, 3, 4, 12

### What to build

A working `/instructor/analytics` page with four stat cards: Total Enrolled, Total Revenue, Total Completions, and Overall Quiz Pass Rate. Data defaults to all of the instructor's courses for all time. The page is protected by the instructor role guard. No filters yet — just a demoable page that shows real aggregated numbers.

Introduce `analyticsService.ts` with the four aggregate query functions (`getEnrollmentStats`, `getRevenueStats`, `getCompletionStats`, `getQuizPassRateStats`), each accepting `instructorId` plus optional `startDate`/`endDate`/`courseId` parameters (unused in this phase but needed from the start so later phases only add wiring, not new function signatures).

### Acceptance criteria

- [ ] `/instructor/analytics` renders without error when logged in as an instructor
- [ ] Non-instructors (students, admins) receive a 403 when accessing the route
- [ ] Total Enrolled card shows the correct count of enrollment records for the instructor's courses
- [ ] Total Revenue card shows the correct sum of `pricePaid` formatted as USD (divided by 100)
- [ ] Total Completions card shows the correct count of enrollments with a non-null `completedAt`
- [ ] Overall Quiz Pass Rate card shows the correct `passed=true / total` ratio across all quiz attempts for the instructor's courses
- [ ] Page is linked from the instructor nav (or sidebar) so it is reachable without typing the URL

---

## Phase 2: Filters (date range presets + course selector)

**User stories**: 5, 6, 11, 16

### What to build

A controls row below the page heading with two controls: a date range preset selector (Last 7 days, Last 30 days, Last 90 days, Last 12 months, All time) and a course selector (All Courses + each of the instructor's published courses). Both controls write their state into URL search params, which the loader reads to filter all four stat cards. Changing either control immediately updates all stat cards.

### Acceptance criteria

- [ ] Date range selector renders the five preset options; "All time" is the default
- [ ] Selecting a preset updates the URL search params and re-runs the loader
- [ ] All four stat cards reflect only data within the selected date range
- [ ] Course selector renders "All Courses" plus each of the instructor's courses
- [ ] Selecting a specific course scopes all four stat cards to that course
- [ ] Switching back to "All Courses" returns stat cards to the cross-course aggregate
- [ ] Both filters can be combined (e.g., "Last 30 days" + a specific course)
- [ ] Refreshing the page with filter params in the URL restores the same filter state

---

## Phase 3: Charts (time-series + lesson drop-off funnel)

**User stories**: 7, 8, 9, 10, 13, 14, 15

### What to build

Install Recharts. Add four time-series LineCharts (enrollments/day, revenue/day, completions/day, quiz pass rate/day) that respect the existing date range and course filters from Phase 2. Add the corresponding per-day query functions to `analyticsService.ts`.

Add a lesson drop-off funnel below the charts: a horizontal BarChart showing, for each lesson in the selected course (ordered by module then lesson position), the percentage of enrolled students who have a `completed` status in `lessonProgress`. The funnel is hidden when "All Courses" is selected, replaced by a prompt telling the instructor to select a course. Include a UI note about the caveat that students who never opened a lesson are excluded from per-lesson percentages.

### Acceptance criteria

- [ ] Recharts is installed and importable
- [ ] Enrollments/day LineChart renders with correct daily counts, filtered by date range and course
- [ ] Revenue/day LineChart renders with correct daily sums in USD, filtered by date range and course
- [ ] Completions/day LineChart renders with correct daily counts (by `completedAt`), filtered by date range and course
- [ ] Quiz Pass Rate/day LineChart renders with correct daily pass rates (by `attemptedAt`), filtered by date range and course
- [ ] All four charts update when date range or course selector changes
- [ ] Drop-off funnel is hidden when "All Courses" is selected; a prompt to select a course is shown instead
- [ ] Drop-off funnel appears when a specific course is selected, showing one bar per lesson in module/lesson position order
- [ ] Each bar shows the percentage of enrolled students with a `completed` lessonProgress record for that lesson
- [ ] A caveat note is displayed explaining that students who never opened a lesson are excluded

---

## Phase 4: Admin route + users page link

**User stories**: 17, 18, 19, 20

### What to build

A new route `/admin/users/:userId/analytics` that renders the same analytics layout as the instructor's own page, but scoped to the specified user's courses. The route is guarded by the admin role. The admin users page gains a "View Analytics" link next to each user who has the instructor role.

Reuse the analytics layout as a shared component so both routes compose it; the only difference is where `instructorId` comes from (session vs. URL param).

### Acceptance criteria

- [ ] `/admin/users/:userId/analytics` renders the same layout as `/instructor/analytics` scoped to the target instructor's courses
- [ ] Non-admins (instructors, students) receive a 403 when accessing the admin analytics route
- [ ] Admins cannot access `/instructor/analytics` (still 403 — that route remains instructor-only)
- [ ] The admin users page shows a "View Analytics" link next to each user with the instructor role
- [ ] Clicking "View Analytics" navigates to the correct `/admin/users/:userId/analytics` URL
- [ ] All filters (date range, course selector) and all charts work identically on the admin view
- [ ] Selecting a course on the admin view shows that instructor's lessons in the funnel
