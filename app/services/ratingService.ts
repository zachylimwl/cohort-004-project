import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings } from "~/db/schema";
import { isUserEnrolled } from "~/services/enrollmentService";

// ─── Rating Service ───
// Handles course star ratings (1–5). One rating per user per course (upsert).
// Only enrolled students may rate. Uses positional parameters (project convention).

export type CourseRatingStats = {
  average: number;
  count: number;
};

export function getUserRating(userId: number, courseId: number) {
  return db
    .select()
    .from(courseRatings)
    .where(
      and(
        eq(courseRatings.userId, userId),
        eq(courseRatings.courseId, courseId)
      )
    )
    .get();
}

export function upsertCourseRating(
  userId: number,
  courseId: number,
  rating: number
) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be an integer between 1 and 5");
  }

  if (!isUserEnrolled(userId, courseId)) {
    throw new Error("User is not enrolled in this course");
  }

  const existing = getUserRating(userId, courseId);

  if (existing) {
    return db
      .update(courseRatings)
      .set({ rating, updatedAt: new Date().toISOString() })
      .where(eq(courseRatings.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(courseRatings)
    .values({ userId, courseId, rating })
    .returning()
    .get();
}

export function getCourseRatingStats(courseId: number): CourseRatingStats {
  const result = db
    .select({
      average: sql<number>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  const count = result?.count ?? 0;
  const average = count > 0 ? Math.round((result!.average ?? 0) * 10) / 10 : 0;

  return { average, count };
}

export function getRatingStatsForCourses(
  courseIds: number[]
): Map<number, CourseRatingStats> {
  const stats = new Map<number, CourseRatingStats>();

  if (courseIds.length === 0) return stats;

  const rows = db
    .select({
      courseId: courseRatings.courseId,
      average: sql<number>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(inArray(courseRatings.courseId, courseIds))
    .groupBy(courseRatings.courseId)
    .all();

  for (const row of rows) {
    stats.set(row.courseId, {
      average: Math.round((row.average ?? 0) * 10) / 10,
      count: row.count,
    });
  }

  return stats;
}
