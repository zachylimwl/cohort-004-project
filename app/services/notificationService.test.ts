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
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "./notificationService";

describe("notificationService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("createNotification", () => {
    it("creates a notification with all fields", () => {
      const notification = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "New Enrollment",
        "Test User enrolled in Test Course",
        "/instructor/1/students"
      );

      expect(notification).toBeDefined();
      expect(notification.recipientUserId).toBe(base.instructor.id);
      expect(notification.type).toBe(schema.NotificationType.Enrollment);
      expect(notification.title).toBe("New Enrollment");
      expect(notification.message).toBe("Test User enrolled in Test Course");
      expect(notification.linkUrl).toBe("/instructor/1/students");
      expect(notification.isRead).toBe(false);
      expect(notification.createdAt).toBeDefined();
    });

    it("defaults isRead to false", () => {
      const notification = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "New Enrollment",
        "Someone enrolled",
        "/instructor/1/students"
      );

      expect(notification.isRead).toBe(false);
    });
  });

  describe("getNotifications", () => {
    it("returns notifications for a user ordered newest first", () => {
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "First",
        "First message",
        "/link1"
      );
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "Second",
        "Second message",
        "/link2"
      );

      const results = getNotifications(base.instructor.id, 10, 0);
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Second");
      expect(results[1].title).toBe("First");
    });

    it("respects limit", () => {
      for (let i = 0; i < 5; i++) {
        createNotification(
          base.instructor.id,
          schema.NotificationType.Enrollment,
          `Notification ${i}`,
          `Message ${i}`,
          "/link"
        );
      }

      const results = getNotifications(base.instructor.id, 3, 0);
      expect(results).toHaveLength(3);
    });

    it("respects offset", () => {
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "First",
        "First",
        "/link"
      );
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "Second",
        "Second",
        "/link"
      );
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "Third",
        "Third",
        "/link"
      );

      const results = getNotifications(base.instructor.id, 10, 1);
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Second");
    });

    it("returns empty array when user has no notifications", () => {
      expect(getNotifications(base.instructor.id, 10, 0)).toHaveLength(0);
    });

    it("does not return notifications belonging to another user", () => {
      createNotification(
        base.user.id,
        schema.NotificationType.Enrollment,
        "For student",
        "Message",
        "/link"
      );

      expect(getNotifications(base.instructor.id, 10, 0)).toHaveLength(0);
    });
  });

  describe("getUnreadCount", () => {
    it("returns the count of unread notifications", () => {
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "One",
        "Message",
        "/link"
      );
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "Two",
        "Message",
        "/link"
      );

      expect(getUnreadCount(base.instructor.id)).toBe(2);
    });

    it("returns 0 when all notifications are read", () => {
      const n = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "One",
        "Message",
        "/link"
      );
      markAsRead(n.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("returns 0 when there are no notifications", () => {
      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("does not count another user's unread notifications", () => {
      createNotification(
        base.user.id,
        schema.NotificationType.Enrollment,
        "For student",
        "Message",
        "/link"
      );

      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });
  });

  describe("markAsRead", () => {
    it("marks a single notification as read", () => {
      const notification = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "New Enrollment",
        "Message",
        "/link"
      );
      expect(notification.isRead).toBe(false);

      const updated = markAsRead(notification.id);
      expect(updated).toBeDefined();
      expect(updated!.isRead).toBe(true);
    });

    it("does not affect other notifications", () => {
      const n1 = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "One",
        "Message",
        "/link"
      );
      const n2 = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "Two",
        "Message",
        "/link"
      );

      markAsRead(n1.id);

      const remaining = getUnreadCount(base.instructor.id);
      expect(remaining).toBe(1);

      const n2Notifications = getNotifications(base.instructor.id, 10, 0);
      const n2Updated = n2Notifications.find((n) => n.id === n2.id);
      expect(n2Updated!.isRead).toBe(false);
    });
  });

  describe("markAllAsRead", () => {
    it("marks all notifications for a user as read", () => {
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "One",
        "Message",
        "/link"
      );
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "Two",
        "Message",
        "/link"
      );

      markAllAsRead(base.instructor.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("does not mark another user's notifications as read", () => {
      createNotification(
        base.user.id,
        schema.NotificationType.Enrollment,
        "For student",
        "Message",
        "/link"
      );

      markAllAsRead(base.instructor.id);

      expect(getUnreadCount(base.user.id)).toBe(1);
    });
  });
});
