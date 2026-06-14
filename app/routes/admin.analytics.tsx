import { Link, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/admin.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getPlatformRevenueStats,
  getPlatformEnrollmentStats,
  getTopEarningCourse,
  getPlatformDailyRevenue,
  getPlatformMonthlyRevenue,
  fillDailyGaps,
  fillMonthlyGaps,
} from "~/services/analyticsService";
import {
  isDateRange,
  computeDateRange,
  DATE_RANGES,
  type DateRange,
  LineChartCard,
  useIsClient,
} from "~/components/analytics-dashboard";
import { formatPrice } from "~/lib/utils";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  AlertTriangle,
  BarChart2,
  DollarSign,
  Trophy,
  Users,
} from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatMonthTick(dateStr: string) {
  const [year, month] = dateStr.split("-");
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year.slice(2)}`;
}

export function meta() {
  return [
    { title: "Platform Analytics — Cadence" },
    { name: "description", content: "Platform-wide analytics dashboard" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const currentUser = getUserById(currentUserId);

  if (!currentUser || currentUser.role !== UserRole.Admin) {
    throw data("Only admins can access this page.", { status: 403 });
  }

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range") ?? "last30";
  const range: DateRange = isDateRange(rangeParam) ? rangeParam : "last30";

  const { startDate, endDate } = computeDateRange(range);
  const filter = { startDate, endDate };

  const totalRevenueCents = getPlatformRevenueStats(filter);
  const totalEnrollments = getPlatformEnrollmentStats(filter);
  const topEarningCourse = getTopEarningCourse(filter);

  const useMonthly = range === "last12months" || range === "alltime";
  const rawRevenue = useMonthly
    ? getPlatformMonthlyRevenue(filter)
    : getPlatformDailyRevenue(filter);

  let revenueTimeSeries = rawRevenue;
  if (startDate && endDate) {
    revenueTimeSeries = useMonthly
      ? fillMonthlyGaps(rawRevenue, startDate, endDate)
      : fillDailyGaps(rawRevenue, startDate, endDate);
  } else if (rawRevenue.length > 0) {
    const first = rawRevenue[0].date;
    const last = rawRevenue[rawRevenue.length - 1].date;
    revenueTimeSeries = useMonthly
      ? fillMonthlyGaps(rawRevenue, first, last)
      : fillDailyGaps(rawRevenue, first, last);
  }

  return {
    totalRevenueCents,
    totalEnrollments,
    topEarningCourse,
    revenueTimeSeries,
    useMonthly,
    range,
  };
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <div className="mb-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-2 h-5 w-80" />
      </div>
      <Skeleton className="mb-8 h-9 w-96" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="mt-2 h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-8">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminAnalytics({ loaderData }: Route.ComponentProps) {
  const {
    totalRevenueCents,
    totalEnrollments,
    topEarningCourse,
    revenueTimeSeries,
    useMonthly,
    range,
  } = loaderData;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isClient = useIsClient();

  const hasData = totalRevenueCents > 0 || totalEnrollments > 0;
  const rangeLabel =
    DATE_RANGES.find((r) => r.value === range)?.label ?? "All time";

  function handleRangeChange(value: string) {
    const params = new URLSearchParams(searchParams);
    params.set("range", value);
    navigate(`/admin/analytics?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Platform Analytics</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Platform Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Revenue and enrollment overview across all courses
        </p>
      </div>

      <div className="mb-8">
        <Select value={range} onValueChange={handleRangeChange}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <BarChart2 className="mb-3 size-10 text-muted-foreground/50" />
            <p className="text-lg font-medium">No data yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Revenue and enrollment data will appear here once courses have
              purchases and enrollments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </span>
                <DollarSign className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {totalRevenueCents === 0
                    ? "$0.00"
                    : formatPrice(totalRevenueCents)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  gross revenue · {rangeLabel.toLowerCase()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Enrollments
                </span>
                <Users className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {totalEnrollments.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  across all courses · {rangeLabel.toLowerCase()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Top Earning Course
                </span>
                <Trophy className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {topEarningCourse ? (
                  <>
                    <p className="truncate text-2xl font-bold">
                      {formatPrice(topEarningCourse.revenueCents)}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {topEarningCourse.title}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold">—</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      no purchases yet
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <LineChartCard
              title="Revenue Over Time"
              data={revenueTimeSeries}
              isClient={isClient}
              formatValue={(v) => formatPrice(v)}
              yAxisTickFormatter={(v) => `$${(v / 100).toFixed(0)}`}
              xAxisTickFormatter={useMonthly ? formatMonthTick : undefined}
              color="hsl(142, 70%, 45%)"
            />
          </div>
        </>
      )}
    </div>
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
          : "Only admins can access this page.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
