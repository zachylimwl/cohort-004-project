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

// Import after mock so the modules pick up our test db
import {
  getUserRating,
  upsertCourseRating,
  getCourseRatingStats,
  getRatingStatsForCourses,
} from "./ratingService";
import { enrollUser } from "./enrollmentService";

describe("ratingService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    // Most tests need the base user enrolled, since rating requires enrollment.
    enrollUser(base.user.id, base.course.id, false, false);
  });

  describe("upsertCourseRating", () => {
    it("inserts a new rating for an enrolled user", () => {
      const rating = upsertCourseRating(base.user.id, base.course.id, 4);

      expect(rating).toBeDefined();
      expect(rating.userId).toBe(base.user.id);
      expect(rating.courseId).toBe(base.course.id);
      expect(rating.rating).toBe(4);
    });

    it("rejects a rating from a user who is not enrolled", () => {
      const other = testDb
        .insert(schema.users)
        .values({
          name: "Not Enrolled",
          email: "notenrolled@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      expect(() =>
        upsertCourseRating(other.id, base.course.id, 5)
      ).toThrowError("User is not enrolled in this course");
    });

    it("updates the existing rating instead of duplicating (upsert)", () => {
      const first = upsertCourseRating(base.user.id, base.course.id, 3);
      const second = upsertCourseRating(base.user.id, base.course.id, 5);

      expect(second.id).toBe(first.id);
      expect(second.rating).toBe(5);

      // Only one row exists for this user/course
      const stats = getCourseRatingStats(base.course.id);
      expect(stats.count).toBe(1);
      expect(stats.average).toBe(5);
    });

    it("rejects a rating below 1", () => {
      expect(() =>
        upsertCourseRating(base.user.id, base.course.id, 0)
      ).toThrowError("Rating must be an integer between 1 and 5");
    });

    it("rejects a rating above 5", () => {
      expect(() =>
        upsertCourseRating(base.user.id, base.course.id, 6)
      ).toThrowError("Rating must be an integer between 1 and 5");
    });

    it("rejects a non-integer rating", () => {
      expect(() =>
        upsertCourseRating(base.user.id, base.course.id, 3.5)
      ).toThrowError("Rating must be an integer between 1 and 5");
    });
  });

  describe("getUserRating", () => {
    it("returns the user's rating when it exists", () => {
      upsertCourseRating(base.user.id, base.course.id, 4);

      const found = getUserRating(base.user.id, base.course.id);
      expect(found).toBeDefined();
      expect(found!.rating).toBe(4);
    });

    it("returns undefined when the user has not rated", () => {
      expect(getUserRating(base.user.id, base.course.id)).toBeUndefined();
    });
  });

  describe("getCourseRatingStats", () => {
    it("computes the average and count across users", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({
          name: "Student Two",
          email: "student2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();
      enrollUser(student2.id, base.course.id, false, false);

      upsertCourseRating(base.user.id, base.course.id, 4);
      upsertCourseRating(student2.id, base.course.id, 5);

      const stats = getCourseRatingStats(base.course.id);
      expect(stats.count).toBe(2);
      expect(stats.average).toBe(4.5);
    });

    it("rounds the average to one decimal place", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({
          name: "Student Two",
          email: "student2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();
      const student3 = testDb
        .insert(schema.users)
        .values({
          name: "Student Three",
          email: "student3@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();
      enrollUser(student2.id, base.course.id, false, false);
      enrollUser(student3.id, base.course.id, false, false);

      // 4, 4, 5 → 4.333... → 4.3
      upsertCourseRating(base.user.id, base.course.id, 4);
      upsertCourseRating(student2.id, base.course.id, 4);
      upsertCourseRating(student3.id, base.course.id, 5);

      expect(getCourseRatingStats(base.course.id).average).toBe(4.3);
    });

    it("returns zeros when the course has no ratings", () => {
      const stats = getCourseRatingStats(base.course.id);
      expect(stats).toEqual({ average: 0, count: 0 });
    });
  });

  describe("getRatingStatsForCourses", () => {
    it("returns a map of stats keyed by course id", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();
      enrollUser(base.user.id, course2.id, false, false);

      upsertCourseRating(base.user.id, base.course.id, 3);
      upsertCourseRating(base.user.id, course2.id, 5);

      const map = getRatingStatsForCourses([base.course.id, course2.id]);
      expect(map.get(base.course.id)).toEqual({ average: 3, count: 1 });
      expect(map.get(course2.id)).toEqual({ average: 5, count: 1 });
    });

    it("omits courses with no ratings", () => {
      const map = getRatingStatsForCourses([base.course.id]);
      expect(map.has(base.course.id)).toBe(false);
    });

    it("returns an empty map for an empty input", () => {
      expect(getRatingStatsForCourses([]).size).toBe(0);
    });
  });
});
