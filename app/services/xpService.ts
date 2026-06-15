import { eq, and, sql } from "drizzle-orm";
import { db } from "~/db";
import { xpEvents, XpSourceType } from "~/db/schema";

export function awardLessonXp(opts: {
  userId: number;
  lessonId: number;
}): boolean {
  const existing = db
    .select()
    .from(xpEvents)
    .where(
      and(
        eq(xpEvents.userId, opts.userId),
        eq(xpEvents.sourceType, XpSourceType.LessonCompletion),
        eq(xpEvents.sourceId, opts.lessonId)
      )
    )
    .get();

  if (existing) return false;

  db.insert(xpEvents)
    .values({
      userId: opts.userId,
      amount: 10,
      sourceType: XpSourceType.LessonCompletion,
      sourceId: opts.lessonId,
    })
    .run();

  return true;
}

export function awardQuizXp(opts: { userId: number; quizId: number }): boolean {
  const existing = db
    .select()
    .from(xpEvents)
    .where(
      and(
        eq(xpEvents.userId, opts.userId),
        eq(xpEvents.sourceType, XpSourceType.QuizPass),
        eq(xpEvents.sourceId, opts.quizId)
      )
    )
    .get();

  if (existing) return false;

  db.insert(xpEvents)
    .values({
      userId: opts.userId,
      amount: 5,
      sourceType: XpSourceType.QuizPass,
      sourceId: opts.quizId,
    })
    .run();

  return true;
}

export function getTotalXp(userId: number): number {
  const result = db
    .select({ total: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
    .from(xpEvents)
    .where(eq(xpEvents.userId, userId))
    .get();

  return result?.total ?? 0;
}
