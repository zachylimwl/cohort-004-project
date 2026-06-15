import { eq } from "drizzle-orm";
import { db } from "~/db";
import { streakActivities, streakStats } from "~/db/schema";

function getUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function recordStreakActivity(opts: { userId: number }): void {
  const today = getUtcDateString();

  const existing = db
    .select()
    .from(streakActivities)
    .where(eq(streakActivities.userId, opts.userId))
    .all()
    .find((r) => r.activityDate === today);

  if (existing) return;

  db.insert(streakActivities)
    .values({ userId: opts.userId, activityDate: today })
    .run();

  updateStreakStats({ userId: opts.userId, today });
}

function updateStreakStats(opts: { userId: number; today: string }): void {
  const stats = db
    .select()
    .from(streakStats)
    .where(eq(streakStats.userId, opts.userId))
    .get();

  const yesterday = subtractDays(opts.today, 1);

  if (!stats) {
    db.insert(streakStats)
      .values({
        userId: opts.userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: opts.today,
      })
      .run();
    return;
  }

  if (stats.lastActivityDate === opts.today) return;

  const newCurrent =
    stats.lastActivityDate === yesterday ? stats.currentStreak + 1 : 1;
  const newLongest = Math.max(stats.longestStreak, newCurrent);

  db.update(streakStats)
    .set({
      currentStreak: newCurrent,
      longestStreak: newLongest,
      lastActivityDate: opts.today,
    })
    .where(eq(streakStats.id, stats.id))
    .run();
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
}

export function getStreakData(userId: number): StreakData {
  const stats = db
    .select()
    .from(streakStats)
    .where(eq(streakStats.userId, userId))
    .get();

  if (!stats) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const today = getUtcDateString();
  const yesterday = subtractDays(today, 1);

  if (
    stats.lastActivityDate !== today &&
    stats.lastActivityDate !== yesterday
  ) {
    return { currentStreak: 0, longestStreak: stats.longestStreak };
  }

  return {
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
  };
}
