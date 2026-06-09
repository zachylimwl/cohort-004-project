import { useState, useEffect, useRef } from "react";
import { useFetcher, useNavigate } from "react-router";
import { Bell } from "lucide-react";
import { cn } from "~/lib/utils";
import type { notifications } from "~/db/schema";

type Notification = typeof notifications.$inferSelect;

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
}

function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell({
  notifications,
  unreadCount,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const markReadFetcher = useFetcher();
  const markAllFetcher = useFetcher();
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleNotificationClick(notification: Notification) {
    setOpen(false);
    if (!notification.isRead) {
      markReadFetcher.submit(
        { notificationId: notification.id },
        {
          method: "post",
          action: "/api/notifications/mark-read",
          encType: "application/json",
        }
      );
    }
    navigate(notification.linkUrl);
  }

  function handleMarkAllRead() {
    markAllFetcher.submit(
      {},
      { method: "post", action: "/api/notifications/mark-all-read" }
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-md p-1 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 ml-2 w-80 rounded-md border border-sidebar-border bg-sidebar shadow-lg z-50">
          <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-2">
            <span className="text-sm font-semibold text-sidebar-foreground">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-sidebar-foreground/50">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors hover:bg-sidebar-accent",
                    !notification.isRead && "bg-sidebar-accent/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-sidebar-foreground">
                          {notification.title}
                        </span>
                        {!notification.isRead && (
                          <span className="size-2 shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-sidebar-foreground/70 line-clamp-2">
                        {notification.message}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-sidebar-foreground/50">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
