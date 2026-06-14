import { eq, and, gte, lte, isNotNull, sql, desc } from "drizzle-orm";
import { db } from "~/db";
import {
  enrollments,
  purchases,
  quizAttempts,
  quizzes,
  lessons,
  modules,
  courses,
  lessonProgress,
  LessonProgressStatus,
  users,
} from "~/db/schema";

export type DailyDataPoint = { date: string; value: number };

export type FunnelEntry = {
  lessonId: number;
  title: string;
  completedCount: number;
  percentage: number;
};

type AnalyticsFilter = {
  instructorId: number;
  startDate?: string;
  endDate?: string;
  courseId?: number;
};

export function getEnrollmentStats({
  instructorId,
  startDate,
  endDate,
  courseId,
}: AnalyticsFilter): number {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        courseId !== undefined ? eq(enrollments.courseId, courseId) : undefined,
        startDate !== undefined
          ? gte(enrollments.enrolledAt, startDate)
          : undefined,
        endDate !== undefined ? lte(enrollments.enrolledAt, endDate) : undefined
      )
    )
    .get();
  return result?.count ?? 0;
}

export function getRevenueStats({
  instructorId,
  startDate,
  endDate,
  courseId,
}: AnalyticsFilter): number {
  const result = db
    .select({
      totalCents: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        courseId !== undefined ? eq(purchases.courseId, courseId) : undefined,
        startDate !== undefined
          ? gte(purchases.createdAt, startDate)
          : undefined,
        endDate !== undefined ? lte(purchases.createdAt, endDate) : undefined
      )
    )
    .get();
  return result?.totalCents ?? 0;
}

export function getCompletionStats({
  instructorId,
  startDate,
  endDate,
  courseId,
}: AnalyticsFilter): number {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        isNotNull(enrollments.completedAt),
        courseId !== undefined ? eq(enrollments.courseId, courseId) : undefined,
        startDate !== undefined
          ? gte(enrollments.completedAt, startDate)
          : undefined,
        endDate !== undefined
          ? lte(enrollments.completedAt, endDate)
          : undefined
      )
    )
    .get();
  return result?.count ?? 0;
}

export function getQuizPassRateStats({
  instructorId,
  startDate,
  endDate,
  courseId,
}: AnalyticsFilter): { total: number; passed: number; rate: number } {
  const result = db
    .select({
      total: sql<number>`count(*)`,
      passed: sql<number>`sum(${quizAttempts.passed})`,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
    .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        courseId !== undefined ? eq(courses.id, courseId) : undefined,
        startDate !== undefined
          ? gte(quizAttempts.attemptedAt, startDate)
          : undefined,
        endDate !== undefined
          ? lte(quizAttempts.attemptedAt, endDate)
          : undefined
      )
    )
    .get();

  const total = result?.total ?? 0;
  const passed = result?.passed ?? 0;
  return { total, passed, rate: total > 0 ? passed / total : 0 };
}

export function getDailyEnrollments({
  instructorId,
  startDate,
  endDate,
  courseId,
}: AnalyticsFilter): DailyDataPoint[] {
  return db
    .select({
      date: sql<string>`date(${enrollments.enrolledAt})`,
      value: sql<number>`cast(count(*) as integer)`,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        courseId !== undefined ? eq(enrollments.courseId, courseId) : undefined,
        startDate !== undefined
          ? gte(enrollments.enrolledAt, startDate)
          : undefined,
        endDate !== undefined ? lte(enrollments.enrolledAt, endDate) : undefined
      )
    )
    .groupBy(sql`date(${enrollments.enrolledAt})`)
    .orderBy(sql`date(${enrollments.enrolledAt})`)
    .all();
}

export function getDailyRevenue({
  instructorId,
  startDate,
  endDate,
  courseId,
}: AnalyticsFilter): DailyDataPoint[] {
  return db
    .select({
      date: sql<string>`date(${purchases.createdAt})`,
      value: sql<number>`cast(coalesce(sum(${purchases.pricePaid}), 0) as integer)`,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        courseId !== undefined ? eq(purchases.courseId, courseId) : undefined,
        startDate !== undefined
          ? gte(purchases.createdAt, startDate)
          : undefined,
        endDate !== undefined ? lte(purchases.createdAt, endDate) : undefined
      )
    )
    .groupBy(sql`date(${purchases.createdAt})`)
    .orderBy(sql`date(${purchases.createdAt})`)
    .all();
}

export function getDailyCompletions({
  instructorId,
  startDate,
  endDate,
  courseId,
}: AnalyticsFilter): DailyDataPoint[] {
  return db
    .select({
      date: sql<string>`date(${enrollments.completedAt})`,
      value: sql<number>`cast(count(*) as integer)`,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        isNotNull(enrollments.completedAt),
        courseId !== undefined ? eq(enrollments.courseId, courseId) : undefined,
        startDate !== undefined
          ? gte(enrollments.completedAt, startDate)
          : undefined,
        endDate !== undefined
          ? lte(enrollments.completedAt, endDate)
          : undefined
      )
    )
    .groupBy(sql`date(${enrollments.completedAt})`)
    .orderBy(sql`date(${enrollments.completedAt})`)
    .all();
}

export function getDailyQuizPassRates({
  instructorId,
  startDate,
  endDate,
  courseId,
}: AnalyticsFilter): DailyDataPoint[] {
  return db
    .select({
      date: sql<string>`date(${quizAttempts.attemptedAt})`,
      value: sql<number>`cast(sum(${quizAttempts.passed}) as real) / count(*) * 100`,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
    .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        courseId !== undefined ? eq(courses.id, courseId) : undefined,
        startDate !== undefined
          ? gte(quizAttempts.attemptedAt, startDate)
          : undefined,
        endDate !== undefined
          ? lte(quizAttempts.attemptedAt, endDate)
          : undefined
      )
    )
    .groupBy(sql`date(${quizAttempts.attemptedAt})`)
    .orderBy(sql`date(${quizAttempts.attemptedAt})`)
    .all();
}

type PlatformAnalyticsFilter = {
  startDate?: string;
  endDate?: string;
};

export function getPlatformRevenueStats({
  startDate,
  endDate,
}: PlatformAnalyticsFilter): number {
  const result = db
    .select({
      totalCents: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .where(
      and(
        startDate !== undefined
          ? gte(purchases.createdAt, startDate)
          : undefined,
        endDate !== undefined ? lte(purchases.createdAt, endDate) : undefined
      )
    )
    .get();
  return result?.totalCents ?? 0;
}

export function getPlatformEnrollmentStats({
  startDate,
  endDate,
}: PlatformAnalyticsFilter): number {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      and(
        startDate !== undefined
          ? gte(enrollments.enrolledAt, startDate)
          : undefined,
        endDate !== undefined ? lte(enrollments.enrolledAt, endDate) : undefined
      )
    )
    .get();
  return result?.count ?? 0;
}

export type TopEarningCourse = {
  courseId: number;
  title: string;
  revenueCents: number;
};

export function getTopEarningCourse({
  startDate,
  endDate,
}: PlatformAnalyticsFilter): TopEarningCourse | null {
  const result = db
    .select({
      courseId: courses.id,
      title: courses.title,
      revenueCents: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(
        startDate !== undefined
          ? gte(purchases.createdAt, startDate)
          : undefined,
        endDate !== undefined ? lte(purchases.createdAt, endDate) : undefined
      )
    )
    .groupBy(courses.id)
    .orderBy(desc(sql`sum(${purchases.pricePaid})`))
    .limit(1)
    .get();

  if (!result) return null;
  return result;
}

export function getPlatformDailyRevenue({
  startDate,
  endDate,
}: PlatformAnalyticsFilter): DailyDataPoint[] {
  return db
    .select({
      date: sql<string>`date(${purchases.createdAt})`,
      value: sql<number>`cast(coalesce(sum(${purchases.pricePaid}), 0) as integer)`,
    })
    .from(purchases)
    .where(
      and(
        startDate !== undefined
          ? gte(purchases.createdAt, startDate)
          : undefined,
        endDate !== undefined ? lte(purchases.createdAt, endDate) : undefined
      )
    )
    .groupBy(sql`date(${purchases.createdAt})`)
    .orderBy(sql`date(${purchases.createdAt})`)
    .all();
}

export function getPlatformMonthlyRevenue({
  startDate,
  endDate,
}: PlatformAnalyticsFilter): DailyDataPoint[] {
  return db
    .select({
      date: sql<string>`strftime('%Y-%m', ${purchases.createdAt})`,
      value: sql<number>`cast(coalesce(sum(${purchases.pricePaid}), 0) as integer)`,
    })
    .from(purchases)
    .where(
      and(
        startDate !== undefined
          ? gte(purchases.createdAt, startDate)
          : undefined,
        endDate !== undefined ? lte(purchases.createdAt, endDate) : undefined
      )
    )
    .groupBy(sql`strftime('%Y-%m', ${purchases.createdAt})`)
    .orderBy(sql`strftime('%Y-%m', ${purchases.createdAt})`)
    .all();
}

export function fillDailyGaps(
  data: DailyDataPoint[],
  startDate: string,
  endDate: string
): DailyDataPoint[] {
  const dataMap = new Map(data.map((d) => [d.date, d.value]));
  const result: DailyDataPoint[] = [];
  const current = new Date(startDate.slice(0, 10));
  const end = new Date(endDate.slice(0, 10));

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    result.push({ date: dateStr, value: dataMap.get(dateStr) ?? 0 });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

export function fillMonthlyGaps(
  data: DailyDataPoint[],
  startDate: string,
  endDate: string
): DailyDataPoint[] {
  const dataMap = new Map(data.map((d) => [d.date, d.value]));
  const result: DailyDataPoint[] = [];
  const current = new Date(startDate.slice(0, 10));
  current.setDate(1);
  const end = new Date(endDate.slice(0, 10));

  while (current <= end) {
    const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
    result.push({ date: monthStr, value: dataMap.get(monthStr) ?? 0 });
    current.setMonth(current.getMonth() + 1);
  }

  return result;
}

export function getLessonDropOffFunnel({
  courseId,
}: {
  courseId: number;
}): FunnelEntry[] {
  const enrolledResult = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .get();
  const totalEnrolled = enrolledResult?.count ?? 0;

  if (totalEnrolled === 0) return [];

  const rows = db
    .select({
      lessonId: lessons.id,
      title: lessons.title,
      completedCount: sql<number>`cast(count(${lessonProgress.id}) as integer)`,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .leftJoin(
      lessonProgress,
      and(
        eq(lessonProgress.lessonId, lessons.id),
        eq(lessonProgress.status, LessonProgressStatus.Completed)
      )
    )
    .where(eq(modules.courseId, courseId))
    .groupBy(lessons.id)
    .orderBy(modules.position, lessons.position)
    .all();

  return rows.map((row) => ({
    ...row,
    percentage: Math.round((row.completedCount / totalEnrolled) * 100),
  }));
}
