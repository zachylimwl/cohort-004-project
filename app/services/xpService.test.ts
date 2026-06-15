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

import { awardLessonXp, awardQuizXp, getTotalXp } from "./xpService";

function createLesson(courseId: number): {
  moduleId: number;
  lessonId: number;
} {
  const mod = testDb
    .insert(schema.modules)
    .values({ courseId, title: "Module", position: 1 })
    .returning()
    .get();
  const lesson = testDb
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title: "Lesson", position: 1 })
    .returning()
    .get();
  return { moduleId: mod.id, lessonId: lesson.id };
}

function createQuiz(lessonId: number): number {
  const quiz = testDb
    .insert(schema.quizzes)
    .values({ lessonId, title: "Quiz", passingScore: 0.7 })
    .returning()
    .get();
  return quiz.id;
}

describe("xpService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("awardLessonXp", () => {
    it("awards 10 XP for completing a lesson", () => {
      const { lessonId } = createLesson(base.course.id);

      const awarded = awardLessonXp({ userId: base.user.id, lessonId });

      expect(awarded).toBe(true);
      expect(getTotalXp(base.user.id)).toBe(10);
    });

    it("does not award XP for the same lesson twice", () => {
      const { lessonId } = createLesson(base.course.id);

      awardLessonXp({ userId: base.user.id, lessonId });
      const secondAward = awardLessonXp({ userId: base.user.id, lessonId });

      expect(secondAward).toBe(false);
      expect(getTotalXp(base.user.id)).toBe(10);
    });

    it("awards XP for different lessons independently", () => {
      const l1 = createLesson(base.course.id);
      const l2 = createLesson(base.course.id);

      awardLessonXp({ userId: base.user.id, lessonId: l1.lessonId });
      awardLessonXp({ userId: base.user.id, lessonId: l2.lessonId });

      expect(getTotalXp(base.user.id)).toBe(20);
    });
  });

  describe("awardQuizXp", () => {
    it("awards 5 XP for passing a quiz", () => {
      const { lessonId } = createLesson(base.course.id);
      const quizId = createQuiz(lessonId);

      const awarded = awardQuizXp({ userId: base.user.id, quizId });

      expect(awarded).toBe(true);
      expect(getTotalXp(base.user.id)).toBe(5);
    });

    it("does not award XP for the same quiz twice", () => {
      const { lessonId } = createLesson(base.course.id);
      const quizId = createQuiz(lessonId);

      awardQuizXp({ userId: base.user.id, quizId });
      const secondAward = awardQuizXp({ userId: base.user.id, quizId });

      expect(secondAward).toBe(false);
      expect(getTotalXp(base.user.id)).toBe(5);
    });
  });

  describe("getTotalXp", () => {
    it("returns 0 for a user with no XP events", () => {
      expect(getTotalXp(base.user.id)).toBe(0);
    });

    it("sums XP from both lessons and quizzes", () => {
      const { lessonId } = createLesson(base.course.id);
      const quizId = createQuiz(lessonId);

      awardLessonXp({ userId: base.user.id, lessonId });
      awardQuizXp({ userId: base.user.id, quizId });

      expect(getTotalXp(base.user.id)).toBe(15);
    });

    it("does not include XP from other users", () => {
      const otherUser = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();
      const { lessonId } = createLesson(base.course.id);

      awardLessonXp({ userId: otherUser.id, lessonId });

      expect(getTotalXp(base.user.id)).toBe(0);
    });
  });
});
