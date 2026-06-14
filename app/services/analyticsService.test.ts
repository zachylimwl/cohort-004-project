import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

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
  getPlatformRevenueStats,
  getPlatformEnrollmentStats,
  getTopEarningCourse,
  getPlatformDailyRevenue,
  getPlatformMonthlyRevenue,
  getCourseBreakdown,
  getInstructorsWithCourses,
  fillDailyGaps,
  fillMonthlyGaps,
} from "./analyticsService";

beforeEach(() => {
  testDb = createTestDb();
  base = seedBaseData(testDb);
});

function createEnrollment(
  userId: number,
  courseId: number,
  enrolledAt: string,
  completedAt?: string
) {
  return testDb
    .insert(schema.enrollments)
    .values({ userId, courseId, enrolledAt, completedAt })
    .returning()
    .get();
}

function createPurchase(
  userId: number,
  courseId: number,
  pricePaid: number,
  createdAt: string
) {
  return testDb
    .insert(schema.purchases)
    .values({ userId, courseId, pricePaid, createdAt })
    .returning()
    .get();
}

function createModule(courseId: number, position = 1) {
  return testDb
    .insert(schema.modules)
    .values({ courseId, title: "Test Module", position })
    .returning()
    .get();
}

function createLesson(moduleId: number, position = 1) {
  return testDb
    .insert(schema.lessons)
    .values({ moduleId, title: "Test Lesson", position })
    .returning()
    .get();
}

function createQuiz(lessonId: number) {
  return testDb
    .insert(schema.quizzes)
    .values({ lessonId, title: "Test Quiz", passingScore: 0.7 })
    .returning()
    .get();
}

function createQuizAttempt(
  userId: number,
  quizId: number,
  passed: boolean,
  attemptedAt: string
) {
  return testDb
    .insert(schema.quizAttempts)
    .values({ userId, quizId, score: passed ? 1.0 : 0.0, passed, attemptedAt })
    .returning()
    .get();
}

describe("getEnrollmentStats", () => {
  it("returns 0 when no enrollments exist", () => {
    expect(getEnrollmentStats({ instructorId: base.instructor.id })).toBe(0);
  });

  it("counts enrollments for the instructor's courses", () => {
    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z");
    expect(getEnrollmentStats({ instructorId: base.instructor.id })).toBe(1);
  });

  it("does not count enrollments for other instructors' courses", () => {
    const other = testDb
      .insert(schema.users)
      .values({
        name: "Other",
        email: "other@example.com",
        role: schema.UserRole.Instructor,
      })
      .returning()
      .get();
    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z");
    expect(getEnrollmentStats({ instructorId: other.id })).toBe(0);
  });

  it("filters by startDate", () => {
    createEnrollment(base.user.id, base.course.id, "2024-01-15T00:00:00.000Z");
    expect(
      getEnrollmentStats({
        instructorId: base.instructor.id,
        startDate: "2024-02-01T00:00:00.000Z",
      })
    ).toBe(0);
    expect(
      getEnrollmentStats({
        instructorId: base.instructor.id,
        startDate: "2024-01-01T00:00:00.000Z",
      })
    ).toBe(1);
  });

  it("filters by endDate", () => {
    createEnrollment(base.user.id, base.course.id, "2024-03-01T00:00:00.000Z");
    expect(
      getEnrollmentStats({
        instructorId: base.instructor.id,
        endDate: "2024-02-01T00:00:00.000Z",
      })
    ).toBe(0);
    expect(
      getEnrollmentStats({
        instructorId: base.instructor.id,
        endDate: "2024-03-01T00:00:00.000Z",
      })
    ).toBe(1);
  });

  it("filters by courseId", () => {
    const otherCourse = testDb
      .insert(schema.courses)
      .values({
        title: "Other Course",
        slug: "other-course",
        description: "Another course",
        instructorId: base.instructor.id,
        categoryId: base.category.id,
        status: schema.CourseStatus.Published,
      })
      .returning()
      .get();
    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z");
    createEnrollment(base.user.id, otherCourse.id, "2024-01-01T00:00:00.000Z");
    expect(
      getEnrollmentStats({
        instructorId: base.instructor.id,
        courseId: base.course.id,
      })
    ).toBe(1);
  });
});

describe("getRevenueStats", () => {
  it("returns 0 when no purchases exist", () => {
    expect(getRevenueStats({ instructorId: base.instructor.id })).toBe(0);
  });

  it("sums pricePaid for the instructor's courses", () => {
    createPurchase(
      base.user.id,
      base.course.id,
      2000,
      "2024-01-01T00:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      base.course.id,
      3000,
      "2024-01-02T00:00:00.000Z"
    );
    expect(getRevenueStats({ instructorId: base.instructor.id })).toBe(5000);
  });

  it("does not include purchases for other instructors", () => {
    const other = testDb
      .insert(schema.users)
      .values({
        name: "Other",
        email: "other2@example.com",
        role: schema.UserRole.Instructor,
      })
      .returning()
      .get();
    createPurchase(
      base.user.id,
      base.course.id,
      5000,
      "2024-01-01T00:00:00.000Z"
    );
    expect(getRevenueStats({ instructorId: other.id })).toBe(0);
  });

  it("filters by date range", () => {
    createPurchase(
      base.user.id,
      base.course.id,
      2000,
      "2024-01-01T00:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      base.course.id,
      3000,
      "2024-03-01T00:00:00.000Z"
    );
    expect(
      getRevenueStats({
        instructorId: base.instructor.id,
        startDate: "2024-02-01T00:00:00.000Z",
        endDate: "2024-04-01T00:00:00.000Z",
      })
    ).toBe(3000);
  });
});

describe("getCompletionStats", () => {
  it("returns 0 when no completions exist", () => {
    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z");
    expect(getCompletionStats({ instructorId: base.instructor.id })).toBe(0);
  });

  it("counts only enrollments with completedAt set", () => {
    createEnrollment(
      base.user.id,
      base.course.id,
      "2024-01-01T00:00:00.000Z",
      "2024-02-01T00:00:00.000Z"
    );
    expect(getCompletionStats({ instructorId: base.instructor.id })).toBe(1);
  });

  it("filters completions by date range on completedAt", () => {
    createEnrollment(
      base.user.id,
      base.course.id,
      "2024-01-01T00:00:00.000Z",
      "2024-01-15T00:00:00.000Z"
    );
    expect(
      getCompletionStats({
        instructorId: base.instructor.id,
        startDate: "2024-02-01T00:00:00.000Z",
      })
    ).toBe(0);
    expect(
      getCompletionStats({
        instructorId: base.instructor.id,
        endDate: "2024-02-01T00:00:00.000Z",
      })
    ).toBe(1);
  });
});

describe("getQuizPassRateStats", () => {
  it("returns zero stats when no attempts exist", () => {
    const stats = getQuizPassRateStats({ instructorId: base.instructor.id });
    expect(stats.total).toBe(0);
    expect(stats.passed).toBe(0);
    expect(stats.rate).toBe(0);
  });

  it("calculates pass rate from attempts", () => {
    const mod = createModule(base.course.id);
    const lesson = createLesson(mod.id);
    const quiz = createQuiz(lesson.id);
    createQuizAttempt(base.user.id, quiz.id, true, "2024-01-01T00:00:00.000Z");
    createQuizAttempt(base.user.id, quiz.id, false, "2024-01-02T00:00:00.000Z");

    const stats = getQuizPassRateStats({ instructorId: base.instructor.id });
    expect(stats.total).toBe(2);
    expect(stats.passed).toBe(1);
    expect(stats.rate).toBe(0.5);
  });

  it("does not include attempts for other instructors", () => {
    const other = testDb
      .insert(schema.users)
      .values({
        name: "Other",
        email: "other3@example.com",
        role: schema.UserRole.Instructor,
      })
      .returning()
      .get();
    const mod = createModule(base.course.id);
    const lesson = createLesson(mod.id);
    const quiz = createQuiz(lesson.id);
    createQuizAttempt(base.user.id, quiz.id, true, "2024-01-01T00:00:00.000Z");

    expect(getQuizPassRateStats({ instructorId: other.id }).total).toBe(0);
  });

  it("filters attempts by date range", () => {
    const mod = createModule(base.course.id);
    const lesson = createLesson(mod.id);
    const quiz = createQuiz(lesson.id);
    createQuizAttempt(base.user.id, quiz.id, true, "2024-01-01T00:00:00.000Z");
    createQuizAttempt(base.user.id, quiz.id, false, "2024-03-01T00:00:00.000Z");

    const stats = getQuizPassRateStats({
      instructorId: base.instructor.id,
      startDate: "2024-02-01T00:00:00.000Z",
    });
    expect(stats.total).toBe(1);
    expect(stats.passed).toBe(0);
  });
});

function createLessonProgress(
  userId: number,
  lessonId: number,
  status: schema.LessonProgressStatus
) {
  return testDb
    .insert(schema.lessonProgress)
    .values({ userId, lessonId, status })
    .returning()
    .get();
}

describe("getDailyEnrollments", () => {
  it("returns empty array when no enrollments", () => {
    expect(getDailyEnrollments({ instructorId: base.instructor.id })).toEqual(
      []
    );
  });

  it("groups enrollments by calendar day", () => {
    createEnrollment(base.user.id, base.course.id, "2024-01-15T08:00:00.000Z");
    createEnrollment(base.user.id, base.course.id, "2024-01-15T20:00:00.000Z");
    createEnrollment(base.user.id, base.course.id, "2024-01-16T08:00:00.000Z");

    const rows = getDailyEnrollments({ instructorId: base.instructor.id });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ date: "2024-01-15", value: 2 });
    expect(rows[1]).toEqual({ date: "2024-01-16", value: 1 });
  });

  it("filters by date range", () => {
    createEnrollment(base.user.id, base.course.id, "2024-01-10T00:00:00.000Z");
    createEnrollment(base.user.id, base.course.id, "2024-02-10T00:00:00.000Z");

    const rows = getDailyEnrollments({
      instructorId: base.instructor.id,
      startDate: "2024-02-01T00:00:00.000Z",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2024-02-10");
  });
});

describe("getDailyRevenue", () => {
  it("returns empty array when no purchases", () => {
    expect(getDailyRevenue({ instructorId: base.instructor.id })).toEqual([]);
  });

  it("groups revenue by calendar day", () => {
    createPurchase(
      base.user.id,
      base.course.id,
      1000,
      "2024-01-15T08:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      base.course.id,
      2000,
      "2024-01-15T20:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      base.course.id,
      500,
      "2024-01-16T08:00:00.000Z"
    );

    const rows = getDailyRevenue({ instructorId: base.instructor.id });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ date: "2024-01-15", value: 3000 });
    expect(rows[1]).toEqual({ date: "2024-01-16", value: 500 });
  });
});

describe("getDailyCompletions", () => {
  it("returns empty array when no completions", () => {
    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z");
    expect(getDailyCompletions({ instructorId: base.instructor.id })).toEqual(
      []
    );
  });

  it("groups completions by completedAt day", () => {
    createEnrollment(
      base.user.id,
      base.course.id,
      "2024-01-01T00:00:00.000Z",
      "2024-02-10T10:00:00.000Z"
    );
    createEnrollment(
      base.user.id,
      base.course.id,
      "2024-01-02T00:00:00.000Z",
      "2024-02-10T18:00:00.000Z"
    );

    const rows = getDailyCompletions({ instructorId: base.instructor.id });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ date: "2024-02-10", value: 2 });
  });
});

describe("getDailyQuizPassRates", () => {
  it("returns empty array when no attempts", () => {
    expect(getDailyQuizPassRates({ instructorId: base.instructor.id })).toEqual(
      []
    );
  });

  it("computes pass rate (0-100) per day", () => {
    const mod = createModule(base.course.id);
    const lesson = createLesson(mod.id);
    const quiz = createQuiz(lesson.id);
    createQuizAttempt(base.user.id, quiz.id, true, "2024-01-15T08:00:00.000Z");
    createQuizAttempt(base.user.id, quiz.id, false, "2024-01-15T20:00:00.000Z");

    const rows = getDailyQuizPassRates({ instructorId: base.instructor.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2024-01-15");
    expect(rows[0].value).toBeCloseTo(50);
  });
});

describe("getLessonDropOffFunnel", () => {
  it("returns empty array when no enrollments", () => {
    const mod = createModule(base.course.id);
    createLesson(mod.id);
    expect(getLessonDropOffFunnel({ courseId: base.course.id })).toEqual([]);
  });

  it("returns ordered lessons with completion percentages", () => {
    const mod = createModule(base.course.id, 1);
    const lesson1 = createLesson(mod.id, 1);
    const lesson2 = createLesson(mod.id, 2);

    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z");
    createLessonProgress(
      base.user.id,
      lesson1.id,
      schema.LessonProgressStatus.Completed
    );

    const rows = getLessonDropOffFunnel({ courseId: base.course.id });
    expect(rows).toHaveLength(2);
    expect(rows[0].lessonId).toBe(lesson1.id);
    expect(rows[0].completedCount).toBe(1);
    expect(rows[0].percentage).toBe(100);
    expect(rows[1].lessonId).toBe(lesson2.id);
    expect(rows[1].completedCount).toBe(0);
    expect(rows[1].percentage).toBe(0);
  });

  it("excludes non-completed lesson progress records", () => {
    const mod = createModule(base.course.id, 1);
    const lesson = createLesson(mod.id, 1);

    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z");
    createLessonProgress(
      base.user.id,
      lesson.id,
      schema.LessonProgressStatus.InProgress
    );

    const rows = getLessonDropOffFunnel({ courseId: base.course.id });
    expect(rows[0].completedCount).toBe(0);
    expect(rows[0].percentage).toBe(0);
  });
});

describe("getPlatformRevenueStats", () => {
  it("returns 0 when no purchases exist", () => {
    expect(getPlatformRevenueStats({})).toBe(0);
  });

  it("sums revenue across all instructors", () => {
    const otherInstructor = testDb
      .insert(schema.users)
      .values({
        name: "Other Instructor",
        email: "other-inst@example.com",
        role: schema.UserRole.Instructor,
      })
      .returning()
      .get();
    const otherCourse = testDb
      .insert(schema.courses)
      .values({
        title: "Other Course",
        slug: "other-course",
        description: "Another course",
        instructorId: otherInstructor.id,
        categoryId: base.category.id,
        status: schema.CourseStatus.Published,
      })
      .returning()
      .get();

    createPurchase(
      base.user.id,
      base.course.id,
      2000,
      "2024-01-01T00:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      otherCourse.id,
      3000,
      "2024-01-02T00:00:00.000Z"
    );

    expect(getPlatformRevenueStats({})).toBe(5000);
  });

  it("filters by date range", () => {
    createPurchase(
      base.user.id,
      base.course.id,
      2000,
      "2024-01-01T00:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      base.course.id,
      3000,
      "2024-03-01T00:00:00.000Z"
    );

    expect(
      getPlatformRevenueStats({
        startDate: "2024-02-01T00:00:00.000Z",
        endDate: "2024-04-01T00:00:00.000Z",
      })
    ).toBe(3000);
  });
});

describe("getPlatformEnrollmentStats", () => {
  it("returns 0 when no enrollments exist", () => {
    expect(getPlatformEnrollmentStats({})).toBe(0);
  });

  it("counts enrollments across all courses", () => {
    const otherInstructor = testDb
      .insert(schema.users)
      .values({
        name: "Other Instructor",
        email: "other-inst2@example.com",
        role: schema.UserRole.Instructor,
      })
      .returning()
      .get();
    const otherCourse = testDb
      .insert(schema.courses)
      .values({
        title: "Other Course 2",
        slug: "other-course-2",
        description: "Another course",
        instructorId: otherInstructor.id,
        categoryId: base.category.id,
        status: schema.CourseStatus.Published,
      })
      .returning()
      .get();

    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z");
    createEnrollment(base.user.id, otherCourse.id, "2024-01-02T00:00:00.000Z");

    expect(getPlatformEnrollmentStats({})).toBe(2);
  });

  it("filters by date range", () => {
    createEnrollment(base.user.id, base.course.id, "2024-01-15T00:00:00.000Z");
    createEnrollment(base.user.id, base.course.id, "2024-03-15T00:00:00.000Z");

    expect(
      getPlatformEnrollmentStats({ startDate: "2024-02-01T00:00:00.000Z" })
    ).toBe(1);
  });
});

describe("getTopEarningCourse", () => {
  it("returns null when no purchases exist", () => {
    expect(getTopEarningCourse({})).toBeNull();
  });

  it("returns the course with the highest revenue", () => {
    const otherInstructor = testDb
      .insert(schema.users)
      .values({
        name: "Other Instructor",
        email: "other-inst3@example.com",
        role: schema.UserRole.Instructor,
      })
      .returning()
      .get();
    const highRevenueCourse = testDb
      .insert(schema.courses)
      .values({
        title: "High Revenue Course",
        slug: "high-revenue",
        description: "Big earner",
        instructorId: otherInstructor.id,
        categoryId: base.category.id,
        status: schema.CourseStatus.Published,
      })
      .returning()
      .get();

    createPurchase(
      base.user.id,
      base.course.id,
      1000,
      "2024-01-01T00:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      highRevenueCourse.id,
      5000,
      "2024-01-01T00:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      highRevenueCourse.id,
      3000,
      "2024-01-02T00:00:00.000Z"
    );

    const top = getTopEarningCourse({});
    expect(top).not.toBeNull();
    expect(top!.courseId).toBe(highRevenueCourse.id);
    expect(top!.title).toBe("High Revenue Course");
    expect(top!.revenueCents).toBe(8000);
  });

  it("filters by date range", () => {
    createPurchase(
      base.user.id,
      base.course.id,
      5000,
      "2024-01-01T00:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      base.course.id,
      1000,
      "2024-03-01T00:00:00.000Z"
    );

    const top = getTopEarningCourse({
      startDate: "2024-02-01T00:00:00.000Z",
      endDate: "2024-04-01T00:00:00.000Z",
    });
    expect(top).not.toBeNull();
    expect(top!.revenueCents).toBe(1000);
  });
});

describe("getPlatformDailyRevenue", () => {
  it("returns empty array when no purchases", () => {
    expect(getPlatformDailyRevenue({})).toEqual([]);
  });

  it("groups revenue by calendar day across all instructors", () => {
    const otherInstructor = testDb
      .insert(schema.users)
      .values({
        name: "Other Instructor",
        email: "daily-rev-inst@example.com",
        role: schema.UserRole.Instructor,
      })
      .returning()
      .get();
    const otherCourse = testDb
      .insert(schema.courses)
      .values({
        title: "Other Course",
        slug: "daily-rev-course",
        description: "Another course",
        instructorId: otherInstructor.id,
        categoryId: base.category.id,
        status: schema.CourseStatus.Published,
      })
      .returning()
      .get();

    createPurchase(
      base.user.id,
      base.course.id,
      1000,
      "2024-01-15T08:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      otherCourse.id,
      2000,
      "2024-01-15T20:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      base.course.id,
      500,
      "2024-01-16T08:00:00.000Z"
    );

    const rows = getPlatformDailyRevenue({});
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ date: "2024-01-15", value: 3000 });
    expect(rows[1]).toEqual({ date: "2024-01-16", value: 500 });
  });

  it("filters by date range", () => {
    createPurchase(
      base.user.id,
      base.course.id,
      1000,
      "2024-01-10T00:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      base.course.id,
      2000,
      "2024-03-10T00:00:00.000Z"
    );

    const rows = getPlatformDailyRevenue({
      startDate: "2024-02-01T00:00:00.000Z",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ date: "2024-03-10", value: 2000 });
  });
});

describe("getPlatformMonthlyRevenue", () => {
  it("returns empty array when no purchases", () => {
    expect(getPlatformMonthlyRevenue({})).toEqual([]);
  });

  it("groups revenue by month across all instructors", () => {
    createPurchase(
      base.user.id,
      base.course.id,
      1000,
      "2024-01-10T00:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      base.course.id,
      2000,
      "2024-01-20T00:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      base.course.id,
      500,
      "2024-03-05T00:00:00.000Z"
    );

    const rows = getPlatformMonthlyRevenue({});
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ date: "2024-01", value: 3000 });
    expect(rows[1]).toEqual({ date: "2024-03", value: 500 });
  });

  it("filters by date range", () => {
    createPurchase(
      base.user.id,
      base.course.id,
      1000,
      "2024-01-10T00:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      base.course.id,
      2000,
      "2024-06-10T00:00:00.000Z"
    );

    const rows = getPlatformMonthlyRevenue({
      startDate: "2024-04-01T00:00:00.000Z",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ date: "2024-06", value: 2000 });
  });
});

describe("fillDailyGaps", () => {
  it("fills missing days with zero values", () => {
    const data = [
      { date: "2024-01-01", value: 100 },
      { date: "2024-01-03", value: 200 },
    ];
    const result = fillDailyGaps(
      data,
      "2024-01-01T00:00:00.000Z",
      "2024-01-04T00:00:00.000Z"
    );
    expect(result).toEqual([
      { date: "2024-01-01", value: 100 },
      { date: "2024-01-02", value: 0 },
      { date: "2024-01-03", value: 200 },
      { date: "2024-01-04", value: 0 },
    ]);
  });

  it("returns all zeros for empty data", () => {
    const result = fillDailyGaps(
      [],
      "2024-01-01T00:00:00.000Z",
      "2024-01-03T00:00:00.000Z"
    );
    expect(result).toHaveLength(3);
    expect(result.every((d) => d.value === 0)).toBe(true);
  });
});

describe("fillMonthlyGaps", () => {
  it("fills missing months with zero values", () => {
    const data = [
      { date: "2024-01", value: 1000 },
      { date: "2024-03", value: 2000 },
    ];
    const result = fillMonthlyGaps(
      data,
      "2024-01-01T00:00:00.000Z",
      "2024-04-01T00:00:00.000Z"
    );
    expect(result).toEqual([
      { date: "2024-01", value: 1000 },
      { date: "2024-02", value: 0 },
      { date: "2024-03", value: 2000 },
      { date: "2024-04", value: 0 },
    ]);
  });

  it("returns all zeros for empty data", () => {
    const result = fillMonthlyGaps(
      [],
      "2024-01-01T00:00:00.000Z",
      "2024-03-15T00:00:00.000Z"
    );
    expect(result).toHaveLength(3);
    expect(result.every((d) => d.value === 0)).toBe(true);
  });
});

function createRating(userId: number, courseId: number, rating: number) {
  return testDb
    .insert(schema.courseRatings)
    .values({ userId, courseId, rating })
    .returning()
    .get();
}

describe("getCourseBreakdown", () => {
  it("returns all courses with zero metrics when no purchases or enrollments", () => {
    const rows = getCourseBreakdown({});
    expect(rows).toHaveLength(1);
    expect(rows[0].courseId).toBe(base.course.id);
    expect(rows[0].title).toBe("Test Course");
    expect(rows[0].instructorName).toBe("Test Instructor");
    expect(rows[0].revenueCents).toBe(0);
    expect(rows[0].sales).toBe(0);
    expect(rows[0].enrollments).toBe(0);
    expect(rows[0].averageRating).toBeNull();
  });

  it("aggregates revenue, sales, enrollments, and ratings per course", () => {
    createPurchase(
      base.user.id,
      base.course.id,
      2000,
      "2024-01-01T00:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      base.course.id,
      3000,
      "2024-01-02T00:00:00.000Z"
    );
    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z");
    createRating(base.user.id, base.course.id, 4);

    const rows = getCourseBreakdown({});
    expect(rows).toHaveLength(1);
    expect(rows[0].revenueCents).toBe(5000);
    expect(rows[0].sales).toBe(2);
    expect(rows[0].enrollments).toBe(1);
    expect(rows[0].averageRating).toBe(4);
  });

  it("filters revenue and enrollments by date range", () => {
    createPurchase(
      base.user.id,
      base.course.id,
      2000,
      "2024-01-01T00:00:00.000Z"
    );
    createPurchase(
      base.user.id,
      base.course.id,
      3000,
      "2024-03-01T00:00:00.000Z"
    );
    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z");
    createEnrollment(base.user.id, base.course.id, "2024-03-01T00:00:00.000Z");

    const rows = getCourseBreakdown({
      startDate: "2024-02-01T00:00:00.000Z",
      endDate: "2024-04-01T00:00:00.000Z",
    });
    expect(rows[0].revenueCents).toBe(3000);
    expect(rows[0].sales).toBe(1);
    expect(rows[0].enrollments).toBe(1);
  });

  it("filters by instructorId", () => {
    const otherInstructor = testDb
      .insert(schema.users)
      .values({
        name: "Other Instructor",
        email: "breakdown-inst@example.com",
        role: schema.UserRole.Instructor,
      })
      .returning()
      .get();
    testDb
      .insert(schema.courses)
      .values({
        title: "Other Course",
        slug: "breakdown-other",
        description: "Another course",
        instructorId: otherInstructor.id,
        categoryId: base.category.id,
        status: schema.CourseStatus.Published,
      })
      .returning()
      .get();

    const all = getCourseBreakdown({});
    expect(all).toHaveLength(2);

    const filtered = getCourseBreakdown({
      instructorId: base.instructor.id,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].instructorName).toBe("Test Instructor");
  });

  it("includes list price from the course", () => {
    const rows = getCourseBreakdown({});
    expect(rows[0].listPriceCents).toBe(base.course.price);
  });

  it("computes average rating across multiple ratings", () => {
    const user2 = testDb
      .insert(schema.users)
      .values({
        name: "User 2",
        email: "user2-rating@example.com",
        role: schema.UserRole.Student,
      })
      .returning()
      .get();
    createRating(base.user.id, base.course.id, 5);
    createRating(user2.id, base.course.id, 3);

    const rows = getCourseBreakdown({});
    expect(rows[0].averageRating).toBe(4);
  });
});

describe("getInstructorsWithCourses", () => {
  it("returns instructors who have at least one course", () => {
    const result = getInstructorsWithCourses();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(base.instructor.id);
    expect(result[0].name).toBe("Test Instructor");
  });

  it("excludes instructors with no courses", () => {
    testDb
      .insert(schema.users)
      .values({
        name: "No Courses Instructor",
        email: "no-courses@example.com",
        role: schema.UserRole.Instructor,
      })
      .returning()
      .get();

    const result = getInstructorsWithCourses();
    expect(result).toHaveLength(1);
  });

  it("does not duplicate instructors with multiple courses", () => {
    testDb
      .insert(schema.courses)
      .values({
        title: "Second Course",
        slug: "second-course",
        description: "Another",
        instructorId: base.instructor.id,
        categoryId: base.category.id,
        status: schema.CourseStatus.Published,
      })
      .returning()
      .get();

    const result = getInstructorsWithCourses();
    expect(result).toHaveLength(1);
  });
});
