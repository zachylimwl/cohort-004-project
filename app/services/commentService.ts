import { eq, and, isNull } from "drizzle-orm";
import { db } from "~/db";
import { lessonComments, users } from "~/db/schema";

export function getCommentsForLesson(lessonId: number) {
  return db
    .select({
      id: lessonComments.id,
      body: lessonComments.body,
      createdAt: lessonComments.createdAt,
      userId: lessonComments.userId,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .where(
      and(eq(lessonComments.lessonId, lessonId), isNull(lessonComments.deletedAt))
    )
    .orderBy(lessonComments.createdAt)
    .all();
}

export function createComment(lessonId: number, userId: number, body: string) {
  return db
    .insert(lessonComments)
    .values({ lessonId, userId, body })
    .returning()
    .get();
}

export function softDeleteComment(commentId: number) {
  return db
    .update(lessonComments)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}

export function getCommentById(commentId: number) {
  return db
    .select()
    .from(lessonComments)
    .where(eq(lessonComments.id, commentId))
    .get();
}
