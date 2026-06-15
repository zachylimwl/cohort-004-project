import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { recordStreakActivity, getStreakData } from "./streakService";

function setFakeDate(dateStr: string): void {
  vi.setSystemTime(new Date(dateStr + "T12:00:00Z"));
}

describe("streakService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("recordStreakActivity", () => {
    it("records a streak activity for today", () => {
      setFakeDate("2026-01-10");
      recordStreakActivity({ userId: base.user.id });

      const activities = testDb.select().from(schema.streakActivities).all();
      expect(activities).toHaveLength(1);
      expect(activities[0].activityDate).toBe("2026-01-10");
    });

    it("is idempotent — multiple completions in one day produce one row", () => {
      setFakeDate("2026-01-10");
      recordStreakActivity({ userId: base.user.id });
      recordStreakActivity({ userId: base.user.id });
      recordStreakActivity({ userId: base.user.id });

      const activities = testDb.select().from(schema.streakActivities).all();
      expect(activities).toHaveLength(1);
    });

    it("creates a streak_stats row on first activity", () => {
      setFakeDate("2026-01-10");
      recordStreakActivity({ userId: base.user.id });

      const stats = testDb.select().from(schema.streakStats).all();
      expect(stats).toHaveLength(1);
      expect(stats[0].currentStreak).toBe(1);
      expect(stats[0].longestStreak).toBe(1);
      expect(stats[0].lastActivityDate).toBe("2026-01-10");
    });
  });

  describe("streak increment on consecutive days", () => {
    it("increments streak on consecutive UTC days", () => {
      setFakeDate("2026-01-10");
      recordStreakActivity({ userId: base.user.id });

      setFakeDate("2026-01-11");
      recordStreakActivity({ userId: base.user.id });

      setFakeDate("2026-01-12");
      recordStreakActivity({ userId: base.user.id });

      const data = getStreakData(base.user.id);
      expect(data.currentStreak).toBe(3);
      expect(data.longestStreak).toBe(3);
    });
  });

  describe("streak reset on missed day", () => {
    it("resets current streak when a day is missed", () => {
      setFakeDate("2026-01-10");
      recordStreakActivity({ userId: base.user.id });

      setFakeDate("2026-01-11");
      recordStreakActivity({ userId: base.user.id });

      // skip 2026-01-12
      setFakeDate("2026-01-13");
      recordStreakActivity({ userId: base.user.id });

      const data = getStreakData(base.user.id);
      expect(data.currentStreak).toBe(1);
    });
  });

  describe("longest streak preservation", () => {
    it("preserves longest streak after a reset", () => {
      setFakeDate("2026-01-10");
      recordStreakActivity({ userId: base.user.id });
      setFakeDate("2026-01-11");
      recordStreakActivity({ userId: base.user.id });
      setFakeDate("2026-01-12");
      recordStreakActivity({ userId: base.user.id });

      // skip a day — reset
      setFakeDate("2026-01-14");
      recordStreakActivity({ userId: base.user.id });

      const data = getStreakData(base.user.id);
      expect(data.currentStreak).toBe(1);
      expect(data.longestStreak).toBe(3);
    });

    it("updates longest streak when current exceeds it", () => {
      setFakeDate("2026-01-10");
      recordStreakActivity({ userId: base.user.id });
      setFakeDate("2026-01-11");
      recordStreakActivity({ userId: base.user.id });

      // skip
      setFakeDate("2026-01-13");
      recordStreakActivity({ userId: base.user.id });
      setFakeDate("2026-01-14");
      recordStreakActivity({ userId: base.user.id });
      setFakeDate("2026-01-15");
      recordStreakActivity({ userId: base.user.id });

      const data = getStreakData(base.user.id);
      expect(data.currentStreak).toBe(3);
      expect(data.longestStreak).toBe(3);
    });
  });

  describe("getStreakData", () => {
    it("returns 0/0 for a user with no activity", () => {
      const data = getStreakData(base.user.id);
      expect(data.currentStreak).toBe(0);
      expect(data.longestStreak).toBe(0);
    });

    it("shows current streak when last activity was today", () => {
      setFakeDate("2026-01-10");
      recordStreakActivity({ userId: base.user.id });

      const data = getStreakData(base.user.id);
      expect(data.currentStreak).toBe(1);
    });

    it("shows current streak when last activity was yesterday", () => {
      setFakeDate("2026-01-10");
      recordStreakActivity({ userId: base.user.id });

      setFakeDate("2026-01-11");
      const data = getStreakData(base.user.id);
      expect(data.currentStreak).toBe(1);
    });

    it("returns 0 current streak if last activity was more than 1 day ago", () => {
      setFakeDate("2026-01-10");
      recordStreakActivity({ userId: base.user.id });
      setFakeDate("2026-01-11");
      recordStreakActivity({ userId: base.user.id });

      setFakeDate("2026-01-13");
      const data = getStreakData(base.user.id);
      expect(data.currentStreak).toBe(0);
      expect(data.longestStreak).toBe(2);
    });

    it("does not include streak data from other users", () => {
      const otherUser = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      setFakeDate("2026-01-10");
      recordStreakActivity({ userId: otherUser.id });

      const data = getStreakData(base.user.id);
      expect(data.currentStreak).toBe(0);
      expect(data.longestStreak).toBe(0);
    });
  });
});
