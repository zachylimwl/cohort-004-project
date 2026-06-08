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
      .values({ name: "Other", email: "other@example.com", role: schema.UserRole.Instructor })
      .returning()
      .get();
    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z");
    expect(getEnrollmentStats({ instructorId: other.id })).toBe(0);
  });

  it("filters by startDate", () => {
    createEnrollment(base.user.id, base.course.id, "2024-01-15T00:00:00.000Z");
    expect(
      getEnrollmentStats({ instructorId: base.instructor.id, startDate: "2024-02-01T00:00:00.000Z" })
    ).toBe(0);
    expect(
      getEnrollmentStats({ instructorId: base.instructor.id, startDate: "2024-01-01T00:00:00.000Z" })
    ).toBe(1);
  });

  it("filters by endDate", () => {
    createEnrollment(base.user.id, base.course.id, "2024-03-01T00:00:00.000Z");
    expect(
      getEnrollmentStats({ instructorId: base.instructor.id, endDate: "2024-02-01T00:00:00.000Z" })
    ).toBe(0);
    expect(
      getEnrollmentStats({ instructorId: base.instructor.id, endDate: "2024-03-01T00:00:00.000Z" })
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
      getEnrollmentStats({ instructorId: base.instructor.id, courseId: base.course.id })
    ).toBe(1);
  });
});

describe("getRevenueStats", () => {
  it("returns 0 when no purchases exist", () => {
    expect(getRevenueStats({ instructorId: base.instructor.id })).toBe(0);
  });

  it("sums pricePaid for the instructor's courses", () => {
    createPurchase(base.user.id, base.course.id, 2000, "2024-01-01T00:00:00.000Z");
    createPurchase(base.user.id, base.course.id, 3000, "2024-01-02T00:00:00.000Z");
    expect(getRevenueStats({ instructorId: base.instructor.id })).toBe(5000);
  });

  it("does not include purchases for other instructors", () => {
    const other = testDb
      .insert(schema.users)
      .values({ name: "Other", email: "other2@example.com", role: schema.UserRole.Instructor })
      .returning()
      .get();
    createPurchase(base.user.id, base.course.id, 5000, "2024-01-01T00:00:00.000Z");
    expect(getRevenueStats({ instructorId: other.id })).toBe(0);
  });

  it("filters by date range", () => {
    createPurchase(base.user.id, base.course.id, 2000, "2024-01-01T00:00:00.000Z");
    createPurchase(base.user.id, base.course.id, 3000, "2024-03-01T00:00:00.000Z");
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
    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z", "2024-02-01T00:00:00.000Z");
    expect(getCompletionStats({ instructorId: base.instructor.id })).toBe(1);
  });

  it("filters completions by date range on completedAt", () => {
    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z", "2024-01-15T00:00:00.000Z");
    expect(
      getCompletionStats({ instructorId: base.instructor.id, startDate: "2024-02-01T00:00:00.000Z" })
    ).toBe(0);
    expect(
      getCompletionStats({ instructorId: base.instructor.id, endDate: "2024-02-01T00:00:00.000Z" })
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
      .values({ name: "Other", email: "other3@example.com", role: schema.UserRole.Instructor })
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
    expect(getDailyEnrollments({ instructorId: base.instructor.id })).toEqual([]);
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
    createPurchase(base.user.id, base.course.id, 1000, "2024-01-15T08:00:00.000Z");
    createPurchase(base.user.id, base.course.id, 2000, "2024-01-15T20:00:00.000Z");
    createPurchase(base.user.id, base.course.id, 500, "2024-01-16T08:00:00.000Z");

    const rows = getDailyRevenue({ instructorId: base.instructor.id });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ date: "2024-01-15", value: 3000 });
    expect(rows[1]).toEqual({ date: "2024-01-16", value: 500 });
  });
});

describe("getDailyCompletions", () => {
  it("returns empty array when no completions", () => {
    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z");
    expect(getDailyCompletions({ instructorId: base.instructor.id })).toEqual([]);
  });

  it("groups completions by completedAt day", () => {
    createEnrollment(base.user.id, base.course.id, "2024-01-01T00:00:00.000Z", "2024-02-10T10:00:00.000Z");
    createEnrollment(base.user.id, base.course.id, "2024-01-02T00:00:00.000Z", "2024-02-10T18:00:00.000Z");

    const rows = getDailyCompletions({ instructorId: base.instructor.id });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ date: "2024-02-10", value: 2 });
  });
});

describe("getDailyQuizPassRates", () => {
  it("returns empty array when no attempts", () => {
    expect(getDailyQuizPassRates({ instructorId: base.instructor.id })).toEqual([]);
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
    createLessonProgress(base.user.id, lesson1.id, schema.LessonProgressStatus.Completed);

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
    createLessonProgress(base.user.id, lesson.id, schema.LessonProgressStatus.InProgress);

    const rows = getLessonDropOffFunnel({ courseId: base.course.id });
    expect(rows[0].completedCount).toBe(0);
    expect(rows[0].percentage).toBe(0);
  });
});
