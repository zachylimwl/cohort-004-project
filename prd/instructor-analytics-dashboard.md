# Instructor Analytics Dashboard

## Problem Statement

Instructors currently have no way to understand how their courses are performing at a business or pedagogical level. The existing instructor interface only surfaces content management and a student roster — there is no view of revenue earned, enrollment trends over time, where students are dropping off, or how students are performing on quizzes. This makes it impossible for instructors to make data-driven decisions about pricing, content quality, or which lessons need improvement. Admins similarly have no way to view an individual instructor's performance data.

## Solution

A dedicated analytics page at `/instructor/analytics` that gives instructors a cross-course view of their key metrics: enrollment trends, revenue, course completions, and quiz pass rates — all filterable by date range and optionally scoped to a single course. A lesson drop-off funnel shows which lessons cause students to stop progressing. Admins get an equivalent view scoped to any instructor via `/admin/users/:userId/analytics`, accessible from the admin user management page.

## User Stories

1. As an instructor, I want to see total enrolled students across all my courses, so that I can understand my overall audience size.
2. As an instructor, I want to see total gross revenue across all my courses, so that I can track my earnings.
3. As an instructor, I want to see the total number of course completions across all my courses, so that I can gauge how many students are finishing what they start.
4. As an instructor, I want to see an overall quiz pass rate across all my courses, so that I can assess how well my students are grasping the material.
5. As an instructor, I want to filter all analytics by a date range, so that I can understand trends over specific time periods.
6. As an instructor, I want preset date ranges (Last 7 days, Last 30 days, Last 90 days, Last 12 months, All time), so that I can quickly switch between common reporting windows without manually entering dates.
7. As an instructor, I want to see a time-series chart of daily enrollments, so that I can identify when marketing efforts or course launches drive spikes in signups.
8. As an instructor, I want to see a time-series chart of daily revenue, so that I can understand when purchases are happening and spot revenue trends.
9. As an instructor, I want to see a time-series chart of daily course completions, so that I can track whether students are finishing courses over time.
10. As an instructor, I want to see a time-series chart of daily quiz pass rates, so that I can identify whether quiz difficulty or content quality is affecting student success over time.
11. As an instructor, I want to filter all charts and stat cards by a specific course, so that I can drill into the performance of a single course.
12. As an instructor, I want the default view to aggregate data across all my courses, so that I get a high-level overview when I first land on the analytics page.
13. As an instructor, I want to see a lesson drop-off funnel for a selected course, so that I can identify which specific lesson is causing the most students to stop progressing.
14. As an instructor, I want the drop-off funnel to show the percentage of enrolled students who completed each lesson in order, so that I can see exactly where the drop-off is steepest.
15. As an instructor, I want the funnel chart to only appear after I select a specific course, so that the cross-course view isn't cluttered by course-specific data.
16. As an instructor, I want stat cards at the top of the page to update when I change the date range or course selector, so that the summary numbers always match the charts below them.
17. As an admin, I want to view the analytics of any individual instructor, so that I can monitor instructor performance across the platform.
18. As an admin, I want to access an instructor's analytics by clicking a "View Analytics" link next to their name on the admin users page, so that I can navigate there without knowing the URL.
19. As an admin, I want the instructor analytics view to use the same layout and data as the instructor's own view, so that I'm seeing exactly what they see.
20. As an admin, I want the instructor analytics route to be separate from the instructor's own route, so that access control and routing remain clean and distinct.

## Implementation Decisions

### Routes
- New route `/instructor/analytics` — accessible by users with the instructor role; shows analytics scoped to the logged-in instructor's courses
- New route `/admin/users/:userId/analytics` — accessible by users with the admin role; shows the same analytics layout scoped to the specified instructor's courses
- The admin users page gains a "View Analytics" link next to each user who has the instructor role

### Page Layout
- **Stat cards row** (4 cards): Total Enrolled, Total Revenue, Total Completions, Overall Quiz Pass Rate
- **Controls row**: date range selector + course selector (both affect all charts and cards)
- **Time-series charts** (4 separate charts, each with its own Y-axis): Enrollments per day, Revenue per day, Completions per day, Quiz Pass Rate per day
- **Funnel chart**: Lesson drop-off — shown only when a specific course is selected; hidden with a prompt otherwise

### Date Range
- Granularity: daily (data bucketed by calendar day)
- Presets: Last 7 days, Last 30 days, Last 90 days, Last 12 months, All time
- The selected range filters all data queries uniformly

### Course Selector
- Default: "All Courses" (aggregates across all instructor's courses)
- When a course is selected: all metrics are scoped to that course, and the drop-off funnel appears

### Data Definitions
- **Total Enrolled**: count of enrollment records within the date range
- **Total Revenue**: `SUM(pricePaid)` from purchase records within the date range (gross revenue, no platform fee deducted)
- **Total Completions**: count of enrollment records where `completedAt` falls within the date range
- **Quiz Pass Rate**: `COUNT(passed = true) / COUNT(*)` across quiz attempts within the date range
- **Enrollments/day chart**: count of enrollments grouped by `enrolledAt` date
- **Revenue/day chart**: sum of `pricePaid` grouped by purchase `createdAt` date
- **Completions/day chart**: count of enrollments grouped by `completedAt` date
- **Quiz pass rate/day chart**: pass rate grouped by `quizAttempts.attemptedAt` date
- **Drop-off funnel**: for each lesson in a course (ordered by module position then lesson position), the percentage of enrolled students who have a `completed` status in `lessonProgress`

### Charting Library
- Recharts — to be installed as a new dependency
- LineChart for all four time-series charts
- BarChart (horizontal or vertical) for the lesson drop-off funnel

### Authorization
- `/instructor/analytics` uses the same role guard as existing instructor routes (instructor role required)
- `/admin/users/:userId/analytics` uses the same role guard as existing admin routes (admin role required)
- No cross-role access: instructors cannot view other instructors' analytics

### Data Services
- New query functions are needed for each of the five chart/card data shapes; these should be added to existing service files or a new analytics service
- All queries must accept an `instructorId` parameter so the same logic serves both the instructor and admin routes
- All queries must accept optional `startDate`, `endDate`, and `courseId` parameters for filtering

## Out of Scope

- Per-lesson analytics (video watch completion rates, average watch position)
- Student-level drill-down from the analytics page (the existing student roster on the course page handles this)
- Date-range filtering with custom date picker inputs (only presets are in scope)
- Revenue net of platform fees or payment processor fees
- Cohort-based completion rate (e.g., "of students who enrolled in January, X% completed")
- Quiz score distribution histograms (only pass rate is tracked; individual score distributions are out of scope)
- Email or export of analytics data
- Comparison between date ranges (e.g., "this month vs last month")
- Admin viewing a cross-instructor aggregate (admin analytics is always scoped to one instructor)
- Real-time or auto-refreshing data

## Further Notes

- All monetary values are stored in cents in the `purchases.pricePaid` column; the UI should display them as formatted currency (e.g., divide by 100 and format as USD)
- PPP (purchasing power parity) pricing is already handled at purchase time — `pricePaid` reflects the actual amount charged, so no special handling is needed for PPP in analytics
- Team/coupon purchases are recorded in the `purchases` table the same as individual purchases, so they are included in revenue figures automatically
- The drop-off funnel only reflects students who have interacted with `lessonProgress`; students who enrolled but never opened a lesson will not appear in the per-lesson percentages, which may make completion rates look higher than they truly are — consider noting this caveat in the UI
