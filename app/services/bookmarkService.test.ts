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
  isLessonBookmarked,
  toggleBookmark,
  getBookmarkedLessonIds,
} from "./bookmarkService";

function seedModuleWithLessons(courseId: number, lessonCount = 2) {
  const mod = testDb
    .insert(schema.modules)
    .values({ courseId, title: "Module 1", position: 1 })
    .returning()
    .get();

  const lessons = [];
  for (let i = 0; i < lessonCount; i++) {
    const lesson = testDb
      .insert(schema.lessons)
      .values({ moduleId: mod.id, title: `Lesson ${i + 1}`, position: i + 1 })
      .returning()
      .get();
    lessons.push(lesson);
  }
  return { mod, lessons };
}

describe("bookmarkService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("toggleBookmark", () => {
    it("creates a bookmark and returns bookmarked: true", () => {
      const { lessons } = seedModuleWithLessons(base.course.id);
      const result = toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      expect(result).toEqual({ bookmarked: true });
    });

    it("removes an existing bookmark and returns bookmarked: false", () => {
      const { lessons } = seedModuleWithLessons(base.course.id);
      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      const result = toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      expect(result).toEqual({ bookmarked: false });
    });

    it("toggling twice leaves no bookmark", () => {
      const { lessons } = seedModuleWithLessons(base.course.id);
      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      expect(isLessonBookmarked({ userId: base.user.id, lessonId: lessons[0].id })).toBe(false);
    });

    it("bookmarks are independent per user", () => {
      const { lessons } = seedModuleWithLessons(base.course.id);
      const other = testDb
        .insert(schema.users)
        .values({ name: "Other", email: "other@example.com", role: schema.UserRole.Student })
        .returning()
        .get();

      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      expect(isLessonBookmarked({ userId: other.id, lessonId: lessons[0].id })).toBe(false);
    });
  });

  describe("isLessonBookmarked", () => {
    it("returns false when no bookmark exists", () => {
      const { lessons } = seedModuleWithLessons(base.course.id);
      expect(isLessonBookmarked({ userId: base.user.id, lessonId: lessons[0].id })).toBe(false);
    });

    it("returns true after bookmarking", () => {
      const { lessons } = seedModuleWithLessons(base.course.id);
      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      expect(isLessonBookmarked({ userId: base.user.id, lessonId: lessons[0].id })).toBe(true);
    });

    it("returns false after unbookmarking", () => {
      const { lessons } = seedModuleWithLessons(base.course.id);
      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      expect(isLessonBookmarked({ userId: base.user.id, lessonId: lessons[0].id })).toBe(false);
    });
  });

  describe("getBookmarkedLessonIds", () => {
    it("returns an empty array when no bookmarks exist", () => {
      seedModuleWithLessons(base.course.id);
      expect(getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id })).toEqual([]);
    });

    it("returns ids of bookmarked lessons in the course", () => {
      const { lessons } = seedModuleWithLessons(base.course.id, 3);
      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      toggleBookmark({ userId: base.user.id, lessonId: lessons[2].id });

      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });
      expect(ids).toHaveLength(2);
      expect(ids).toContain(lessons[0].id);
      expect(ids).toContain(lessons[2].id);
    });

    it("excludes lessons from other courses", () => {
      const { lessons: lessonsA } = seedModuleWithLessons(base.course.id);

      const courseB = testDb
        .insert(schema.courses)
        .values({
          title: "Course B",
          slug: "course-b",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();
      const { lessons: lessonsB } = seedModuleWithLessons(courseB.id);

      toggleBookmark({ userId: base.user.id, lessonId: lessonsA[0].id });
      toggleBookmark({ userId: base.user.id, lessonId: lessonsB[0].id });

      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });
      expect(ids).toEqual([lessonsA[0].id]);
    });

    it("excludes unbookmarked lessons after toggle off", () => {
      const { lessons } = seedModuleWithLessons(base.course.id, 2);
      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      toggleBookmark({ userId: base.user.id, lessonId: lessons[1].id });
      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id }); // remove

      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });
      expect(ids).toEqual([lessons[1].id]);
    });

    it("returns empty array for a course with no modules", () => {
      const empty = testDb
        .insert(schema.courses)
        .values({
          title: "Empty Course",
          slug: "empty-course",
          description: "No modules",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      expect(getBookmarkedLessonIds({ userId: base.user.id, courseId: empty.id })).toEqual([]);
    });
  });
});
