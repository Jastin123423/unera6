import React, { useEffect, useMemo, useRef, useState } from "react";
import { Notification, User } from "../types";

interface Props {
  notifications: Notification[];
  users: User[];
  onBack?: () => void;
  onProfileClick: (id: number) => void;

  // ✅ open the actual thing the notification is about
  onOpenNotification?: (notification: Notification) => void;

  onMarkAllAsRead?: () => Promise<any> | void;
  onDeleteNotification?: (notificationId: number) => Promise<any> | void;

  simulateApi?: boolean;
  stickyHeader?: boolean;
}

const AVATAR_SIZE = 56;
const INITIAL_EARLIER_COUNT = 10; // can make 15
const LOAD_MORE_COUNT = 10;

const formatTimestamp = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const now = Date.now();
  const diff = now - d.getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const dayNum = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${month} ${dayNum} at ${hour12}:${minutes}${ampm}`;
};

const safeText = (v: any, fallback = "") => (typeof v === "string" ? v : fallback);

const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const getNotificationIcon = (n: Notification) => {
  const type = safeText((n as any).type).toLowerCase();
  const entityType = safeText((n as any).entity_type).toLowerCase();

  if (type.includes("like") || type.includes("reaction")) {
    return { icon: "fas fa-heart", bg: "#E91E63" };
  }

  if (type.includes("comment") || type.includes("reply")) {
    return { icon: "fas fa-comment", bg: "#1877F2" };
  }

  if (type.includes("follow")) {
    return { icon: "fas fa-user-plus", bg: "#42A5F5" };
  }

  if (type.includes("share")) {
    return { icon: "fas fa-share", bg: "#43A047" };
  }

  if (entityType === "group_post") {
    return { icon: "fas fa-users", bg: "#8E24AA" };
  }

  if (entityType === "product") {
    return { icon: "fas fa-shopping-bag", bg: "#FB8C00" };
  }

  if (entityType === "reel") {
    return { icon: "fas fa-play", bg: "#FF5252" };
  }

  return { icon: "fas fa-bell", bg: "#1877F2" };
};

export const NotificationsPage: React.FC<Props> = ({
  notifications,
  users,
  onBack,
  onProfileClick,
  onOpenNotification,
  onMarkAllAsRead,
  onDeleteNotification,
  simulateApi = false,
  stickyHeader = false,
}) => {
  useEffect(() => {
    const id = "np-roboto-font";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;800&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  const getUser = (id?: number) => users.find((u) => u.id === id);

  const [localNotifications, setLocalNotifications] = useState<Notification[]>(notifications || []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [earlierVisibleCount, setEarlierVisibleCount] = useState(INITIAL_EARLIER_COUNT);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const menuRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    setLocalNotifications(Array.isArray(notifications) ? notifications : []);
    setEarlierVisibleCount(INITIAL_EARLIER_COUNT);
  }, [notifications]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuOpenId == null) return;
      const el = menuRefs.current[menuOpenId];
      if (el && !el.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpenId]);

  const unreadCount = useMemo(
    () => localNotifications.filter((n) => !safeNumber((n as any).is_read, 0)).length,
    [localNotifications]
  );

  const sortedNotifications = useMemo(() => {
    return [...localNotifications].sort((a, b) => {
      const ta = new Date((a as any).created_at || 0).getTime();
      const tb = new Date((b as any).created_at || 0).getTime();
      if (tb !== ta) return tb - ta;
      return safeNumber((b as any).id, 0) - safeNumber((a as any).id, 0);
    });
  }, [localNotifications]);

  const { newNotifications, earlierNotifications } = useMemo(() => {
    const now = Date.now();
    const threshold = 48 * 60 * 60 * 1000;

    const newN: Notification[] = [];
    const earlierN: Notification[] = [];

    sortedNotifications.forEach((n) => {
      const created = new Date((n as any).created_at || 0).getTime();
      if (Number.isFinite(created) && now - created <= threshold) {
        newN.push(n);
      } else {
        earlierN.push(n);
      }
    });

    return { newNotifications: newN, earlierNotifications: earlierN };
  }, [sortedNotifications]);

  const visibleEarlierNotifications = useMemo(
    () => earlierNotifications.slice(0, earlierVisibleCount),
    [earlierNotifications, earlierVisibleCount]
  );

  const hasMoreEarlier = visibleEarlierNotifications.length < earlierNotifications.length;

  const showToast = (type: "error" | "success", text: string, ms = 3000) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), ms);
  };

  const handleMarkAllAsRead = async () => {
    if (isProcessing || unreadCount === 0) return;

    const snapshot = localNotifications.map((n) => ({ ...n }));
    setLocalNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        is_read: 1,
      }))
    );
    setIsProcessing(true);

    try {
      if (onMarkAllAsRead) {
        const result = onMarkAllAsRead();
        if (result && typeof (result as Promise<any>).then === "function") {
          await result;
        }
      } else if (simulateApi) {
        await new Promise((res) => setTimeout(res, 700));
      }

      showToast("success", "All notifications marked as read");
    } catch (err) {
      setLocalNotifications(snapshot);
      console.error("Mark all as read failed:", err);
      showToast("error", "Failed to mark all as read");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadMoreEarlier = () => {
    const currentScrollY = window.scrollY;
    setEarlierVisibleCount((prev) => prev + LOAD_MORE_COUNT);

    requestAnimationFrame(() => {
      window.scrollTo({ top: currentScrollY, behavior: "auto" });
    });
  };

  const handleDeleteNotification = async (notificationId: number) => {
    if (!notificationId || deletingId === notificationId) return;

    const snapshot = localNotifications;
    setDeletingId(notificationId);
    setMenuOpenId(null);

    setLocalNotifications((prev) => prev.filter((n) => safeNumber((n as any).id, 0) !== notificationId));

    try {
      if (onDeleteNotification) {
        const result = onDeleteNotification(notificationId);
        if (result && typeof (result as Promise<any>).then === "function") {
          await result;
        }
      } else if (simulateApi) {
        await new Promise((res) => setTimeout(res, 500));
      }

      showToast("success", "Notification deleted");
    } catch (err) {
      console.error("Delete notification failed:", err);
      setLocalNotifications(snapshot);
      showToast("error", "Failed to delete notification");
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenNotification = (n: Notification) => {
    if (onOpenNotification) {
      onOpenNotification(n);
      return;
    }

    const actorId = safeNumber((n as any).actor_id, 0);
    if (actorId) onProfileClick(actorId);
  };

  const renderRow = (n: Notification) => {
    const actor = getUser((n as any).actor_id);
    const actorName = safeText(actor?.name, "Someone");
    const message = safeText((n as any).message, "interacted with you");
    const avatar = safeText(
      actor?.profile_image_url,
      "https://via.placeholder.com/100?text=User"
    );
    const isUnread = !safeNumber((n as any).is_read, 0);
    const notificationId = safeNumber((n as any).id, 0);
    const iconMeta = getNotificationIcon(n);

    return (
      <div
        key={notificationId}
        className="transition-colors"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "10px 16px",
          background: isUnread ? "rgba(24,119,242,0.10)" : "transparent",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          fontFamily: "'Roboto', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
        }}
      >
        <div
          style={{ flexShrink: 0, position: "relative", cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            onProfileClick(actor?.id || 0);
          }}
        >
          <img
            src={avatar}
            alt={actorName}
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: "50%",
              objectFit: "cover",
              background: "#2A2D31",
              display: "block",
            }}
          />

          <div
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: iconMeta.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #121212",
              boxSizing: "border-box",
            }}
          >
            <i
              className={iconMeta.icon}
              style={{
                fontSize: 10,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleOpenNotification(n)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpenNotification(n);
              }
            }}
            style={{
              fontSize: 15,
              lineHeight: 1.3,
              color: "#F5F7FA",
              wordBreak: "break-word",
              cursor: "pointer",
            }}
          >
            <span
              onClick={(e) => {
                e.stopPropagation();
                onProfileClick(actor?.id || 0);
              }}
              style={{
                fontWeight: 700,
                cursor: "pointer",
                color: "#FFFFFF",
              }}
            >
              {actorName}
            </span>{" "}
            <span
              style={{
                fontWeight: 400,
                color: "#D0D7DE",
              }}
            >
              {message}
            </span>
          </div>

          <div
            style={{
              marginTop: 5,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 12.5,
                lineHeight: 1.2,
                color: isUnread ? "#4EA1FF" : "#8B98A5",
                fontWeight: isUnread ? 700 : 500,
              }}
            >
              {formatTimestamp((n as any).created_at)}
            </span>

            {isUnread && (
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#1877F2",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        </div>

        <div
          ref={(el) => {
            menuRefs.current[notificationId] = el;
          }}
          style={{
            position: "relative",
            flexShrink: 0,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId((prev) => (prev === notificationId ? null : notificationId));
            }}
            aria-label="Notification menu"
            style={{
              border: "none",
              background: "transparent",
              color: "#9AA4AF",
              cursor: "pointer",
              padding: 6,
              marginTop: 1,
              borderRadius: 999,
              width: 32,
              height: 32,
            }}
          >
            <i className="fas fa-ellipsis-h" style={{ fontSize: 16 }} />
          </button>

          {menuOpenId === notificationId && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 34,
                minWidth: 180,
                background: "#1B1E22",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                overflow: "hidden",
                zIndex: 100,
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteNotification(notificationId);
                }}
                disabled={deletingId === notificationId}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  border: "none",
                  background: "transparent",
                  color: "#FF6B6B",
                  cursor: deletingId === notificationId ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  textAlign: "left",
                  opacity: deletingId === notificationId ? 0.6 : 1,
                }}
              >
                <i className="fas fa-trash-alt" style={{ fontSize: 14 }} />
                <span>{deletingId === notificationId ? "Deleting..." : "Delete notification"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <section
      className="w-full max-w-3xl mx-auto"
      style={{
        background: "#121212",
        color: "#FFFFFF",
        minHeight: "100%",
        fontFamily: "'Roboto', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
      }}
    >
      <div
        className={stickyHeader ? "sticky top-0 z-10" : ""}
        style={{
          background: "rgba(18,18,18,0.96)",
          backdropFilter: stickyHeader ? "blur(10px)" : undefined,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px 12px",
          }}
        >
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back"
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: "none",
                background: "#23262B",
                color: "#FFFFFF",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <i className="fas fa-arrow-left" style={{ fontSize: 18 }} />
            </button>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 27,
                lineHeight: 1.1,
                fontWeight: 800,
                color: "#FFFFFF",
              }}
            >
              Notifications
            </h2>
          </div>

          <button
            onClick={handleMarkAllAsRead}
            disabled={isProcessing || unreadCount === 0}
            aria-label="Mark all as read"
            title="Mark all as read"
            style={{
              minWidth: 40,
              height: 40,
              borderRadius: 999,
              border: "none",
              background: "#23262B",
              color: "#FFFFFF",
              cursor: isProcessing || unreadCount === 0 ? "not-allowed" : "pointer",
              opacity: isProcessing || unreadCount === 0 ? 0.55 : 1,
              flexShrink: 0,
              padding: "0 12px",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            <i className="fas fa-check" style={{ fontSize: 15 }} />
          </button>
        </div>
      </div>

      <div>
        {newNotifications.length > 0 && (
          <div>
            <div
              style={{
                padding: "14px 16px 8px",
                fontSize: 17,
                fontWeight: 800,
                color: "#FFFFFF",
              }}
            >
              New
            </div>
            <div>{newNotifications.map(renderRow)}</div>
          </div>
        )}

        {visibleEarlierNotifications.length > 0 && (
          <div>
            <div
              style={{
                padding: "14px 16px 8px",
                fontSize: 17,
                fontWeight: 800,
                color: "#FFFFFF",
              }}
            >
              Earlier
            </div>
            <div>{visibleEarlierNotifications.map(renderRow)}</div>

            {hasMoreEarlier && (
              <div style={{ padding: "12px 16px 20px" }}>
                <button
                  onClick={handleLoadMoreEarlier}
                  style={{
                    width: "100%",
                    height: 44,
                    border: "none",
                    borderRadius: 12,
                    background: "#23262B",
                    color: "#FFFFFF",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  See previous notifications
                </button>
              </div>
            )}
          </div>
        )}

        {localNotifications.length === 0 && (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "#9AA4AF",
              fontSize: 15,
            }}
          >
            No notifications yet
          </div>
        )}
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 18,
            transform: "translateX(-50%)",
            background: toast.type === "error" ? "#B00020" : "#1E7E34",
            color: "#FFFFFF",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
            fontWeight: 500,
            boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
            zIndex: 9999,
          }}
        >
          {toast.text}
        </div>
      )}
    </section>
  );
};

export default NotificationsPage;
