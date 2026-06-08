import { Link } from "react-router";
import type { Route } from "./+types/instructor.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getEnrollmentStats,
  getRevenueStats,
  getCompletionStats,
  getQuizPassRateStats,
  getDailyEnrollments,
  getDailyRevenue,
  getDailyCompletions,
  getDailyQuizPassRates,
  getLessonDropOffFunnel,
} from "~/services/analyticsService";
import { getCoursesByInstructor } from "~/services/courseService";
import { Button } from "~/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";
import {
  AnalyticsDashboard,
  isDateRange,
  computeDateRange,
  type DateRange,
} from "~/components/analytics-dashboard";

export function meta() {
  return [
    { title: "Analytics — Cadence" },
    { name: "description", content: "Instructor analytics dashboard" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (!user || user.role !== UserRole.Instructor) {
    throw data("Only instructors can access this page.", { status: 403 });
  }

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range") ?? "alltime";
  const range: DateRange = isDateRange(rangeParam) ? rangeParam : "alltime";
  const courseIdParam = url.searchParams.get("courseId");
  const courseId = courseIdParam ? parseInt(courseIdParam, 10) : undefined;

  const { startDate, endDate } = computeDateRange(range);
  const filter = { instructorId: currentUserId, startDate, endDate, courseId };

  const instructorCourses = getCoursesByInstructor(currentUserId);
  const totalEnrolled = getEnrollmentStats(filter);
  const totalRevenueCents = getRevenueStats(filter);
  const totalCompletions = getCompletionStats(filter);
  const quizStats = getQuizPassRateStats(filter);
  const dailyEnrollments = getDailyEnrollments(filter);
  const dailyRevenue = getDailyRevenue(filter);
  const dailyCompletions = getDailyCompletions(filter);
  const dailyQuizPassRates = getDailyQuizPassRates(filter);
  const dropOffFunnel =
    courseId !== undefined ? getLessonDropOffFunnel({ courseId }) : null;

  return {
    totalEnrolled,
    totalRevenueCents,
    totalCompletions,
    quizPassRate: quizStats.rate,
    quizTotal: quizStats.total,
    range,
    courseId: courseId ?? null,
    courses: instructorCourses.map((c) => ({ id: c.id, title: c.title })),
    dailyEnrollments,
    dailyRevenue,
    dailyCompletions,
    dailyQuizPassRates,
    dropOffFunnel,
  };
}

export default function InstructorAnalytics({
  loaderData,
}: Route.ComponentProps) {
  return (
    <AnalyticsDashboard
      {...loaderData}
      basePath="/instructor/analytics"
      backLink={{ to: "/instructor", label: "My Courses" }}
    />
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message =
        typeof error.data === "string"
          ? error.data
          : "You don't have permission to access this page.";
    } else {
      title = `Error ${error.status}`;
      message =
        typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/instructor">
            <Button variant="outline">My Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
