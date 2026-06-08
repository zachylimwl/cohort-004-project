import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { formatPrice } from "~/lib/utils";
import {
  BarChart2,
  CheckCircle,
  DollarSign,
  GraduationCap,
  Users,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { DailyDataPoint, FunnelEntry } from "~/services/analyticsService";

export const DATE_RANGES = [
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "last90", label: "Last 90 days" },
  { value: "last12months", label: "Last 12 months" },
  { value: "alltime", label: "All time" },
] as const;

export type DateRange = (typeof DATE_RANGES)[number]["value"];

export function isDateRange(value: string): value is DateRange {
  return DATE_RANGES.some((r) => r.value === value);
}

export function computeDateRange(range: DateRange): {
  startDate?: string;
  endDate?: string;
} {
  if (range === "alltime") return {};
  const now = new Date();
  const end = now.toISOString();
  const start = new Date(now);
  if (range === "last7") start.setDate(start.getDate() - 7);
  else if (range === "last30") start.setDate(start.getDate() - 30);
  else if (range === "last90") start.setDate(start.getDate() - 90);
  else if (range === "last12months") start.setFullYear(start.getFullYear() - 1);
  return { startDate: start.toISOString(), endDate: end };
}

export type AnalyticsDashboardProps = {
  basePath: string;
  backLink: { to: string; label: string };
  totalEnrolled: number;
  totalRevenueCents: number;
  totalCompletions: number;
  quizPassRate: number;
  quizTotal: number;
  range: DateRange;
  courseId: number | null;
  courses: { id: number; title: string }[];
  dailyEnrollments: DailyDataPoint[];
  dailyRevenue: DailyDataPoint[];
  dailyCompletions: DailyDataPoint[];
  dailyQuizPassRates: DailyDataPoint[];
  dropOffFunnel: FunnelEntry[] | null;
};

function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  return isClient;
}

function formatDateTick(dateStr: string) {
  const [, month, day] = dateStr.split("-");
  return `${month}/${day}`;
}

type LineChartCardProps = {
  title: string;
  data: DailyDataPoint[];
  isClient: boolean;
  formatValue?: (v: number) => string;
  yAxisTickFormatter?: (v: number) => string;
  color?: string;
};

function LineChartCard({
  title,
  data,
  isClient,
  formatValue,
  yAxisTickFormatter,
  color = "hsl(var(--primary))",
}: LineChartCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!isClient ? (
          <div className="h-[200px] animate-pulse rounded bg-muted" />
        ) : data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No data for the selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={data}
              margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateTick}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={yAxisTickFormatter}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                formatter={(v) => {
                  const n = Number(v);
                  return [
                    formatValue ? formatValue(n) : n.toLocaleString(),
                    title,
                  ];
                }}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

type FunnelChartProps = {
  entries: FunnelEntry[];
  isClient: boolean;
};

function FunnelChart({ entries, isClient }: FunnelChartProps) {
  const chartData = entries.map((e) => ({
    name: e.title.length > 30 ? `${e.title.slice(0, 28)}…` : e.title,
    value: e.percentage,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Lesson Drop-off Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-xs text-muted-foreground">
          Percentage of enrolled students who completed each lesson. Students
          who never opened a lesson are excluded from per-lesson counts.
        </p>
        {!isClient ? (
          <div className="h-[300px] animate-pulse rounded bg-muted" />
        ) : entries.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No lesson progress data yet
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height={Math.max(200, entries.length * 36)}
          >
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="hsl(var(--border))"
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={180}
              />
              <Tooltip
                formatter={(v) => [`${Number(v)}%`, "Completion rate"]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={`hsl(${220 - i * (160 / Math.max(entries.length - 1, 1))}, 70%, 55%)`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsDashboard({
  basePath,
  backLink,
  totalEnrolled,
  totalRevenueCents,
  totalCompletions,
  quizPassRate,
  quizTotal,
  range,
  courseId,
  courses,
  dailyEnrollments,
  dailyRevenue,
  dailyCompletions,
  dailyQuizPassRates,
  dropOffFunnel,
}: AnalyticsDashboardProps) {
  const isClient = useIsClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  function handleRangeChange(value: string) {
    const params = new URLSearchParams(searchParams);
    params.set("range", value);
    navigate(`${basePath}?${params.toString()}`);
  }

  function handleCourseChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("courseId");
    } else {
      params.set("courseId", value);
    }
    navigate(`${basePath}?${params.toString()}`);
  }

  const selectedCourseTitle =
    courseId !== null
      ? (courses.find((c) => c.id === courseId)?.title ?? "Selected course")
      : null;

  const rangeLabel =
    DATE_RANGES.find((r) => r.value === range)?.label ?? "All time";

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to={backLink.to} className="hover:text-foreground">
          {backLink.label}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Performance overview across all courses
        </p>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
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

        <Select
          value={courseId !== null ? String(courseId) : "all"}
          onValueChange={handleCourseChange}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Total Enrolled
            </span>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totalEnrolled.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedCourseTitle
                ? `in ${selectedCourseTitle}`
                : "across all courses"}{" "}
              · {rangeLabel.toLowerCase()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </span>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totalRevenueCents === 0 ? "$0.00" : formatPrice(totalRevenueCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              gross revenue · {rangeLabel.toLowerCase()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Total Completions
            </span>
            <GraduationCap className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totalCompletions.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              courses completed · {rangeLabel.toLowerCase()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Quiz Pass Rate
            </span>
            <CheckCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {quizTotal > 0 ? `${Math.round(quizPassRate * 100)}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {quizTotal > 0
                ? `across ${quizTotal.toLocaleString()} attempts`
                : "no quiz attempts yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <LineChartCard
          title="Enrollments per Day"
          data={dailyEnrollments}
          isClient={isClient}
        />
        <LineChartCard
          title="Revenue per Day"
          data={dailyRevenue}
          isClient={isClient}
          formatValue={(v) => formatPrice(v)}
          yAxisTickFormatter={(v) => `$${(v / 100).toFixed(0)}`}
          color="hsl(142, 70%, 45%)"
        />
        <LineChartCard
          title="Completions per Day"
          data={dailyCompletions}
          isClient={isClient}
          color="hsl(262, 70%, 55%)"
        />
        <LineChartCard
          title="Quiz Pass Rate per Day"
          data={dailyQuizPassRates}
          isClient={isClient}
          formatValue={(v) => `${Math.round(v)}%`}
          yAxisTickFormatter={(v) => `${Math.round(v)}%`}
          color="hsl(38, 92%, 50%)"
        />
      </div>

      <div className="mt-8">
        {dropOffFunnel === null ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
              <BarChart2 className="size-5 shrink-0" />
              <p className="text-sm">
                Select a specific course above to see the lesson drop-off
                funnel.
              </p>
            </CardContent>
          </Card>
        ) : (
          <FunnelChart entries={dropOffFunnel} isClient={isClient} />
        )}
      </div>
    </div>
  );
}
