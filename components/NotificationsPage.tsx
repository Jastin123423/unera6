import React, { useEffect, useMemo, useState } from "react";
import { Notification, User } from "../types";

interface Props {
  notifications: Notification[];
  users: User[];
  onBack?: () => void;
  onProfileClick: (id: number) => void;
  onMarkAllAsRead?: () => Promise<any> | void;
  simulateApi?: boolean;
  stickyHeader?: boolean;
}

const AVATAR_SIZE = 56;
const INITIAL_EARLIER_COUNT = 10; // change to 15 if you want
const LOAD_MORE_COUNT = 10;

const formatTimestamp = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${month} ${day} at ${hour12}:${minutes}${ampm}`;
};

const safeText = (v: any, fallback = "") => (typeof v === "string" ? v : fallback);

export const NotificationsPage: React.FC<Props> = ({
  notifications,
  users,
  onBack,
  onProfileClick,
  onMarkAllAsRead,
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

  useEffect(() => {
    setLocalNotifications(Array.isArray(notifications) ? notifications : []);
    setEarlierVisibleCount(INITIAL_EARLIER_COUNT);
  }, [notifications]);

  const unreadCount = useMemo(
    () => localNotifications.filter((n) => !n.is_read).length,
    [localNotifications]
  );

  const sortedNotifications = useMemo(() => {
    return [...localNotifications].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });
  }, [localNotifications]);

  const { newNotifications, earlierNotifications } = useMemo(() => {
    const now = Date.now();
    const threshold = 48 * 60 * 60 * 1000;

    const newN: Notification[] = [];
    const earlierN: Notification[] = [];

    sortedNotifications.forEach((n) => {
      const created = new Date(n.created_at || 0).getTime();
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
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
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
    setEarlierVisibleCount((prev) => prev + LOAD_MORE_COUNT);
  };

  const renderRow = (n: Notification) => {
    const actor = getUser(n.actor_id);
    const actorName = safeText(actor?.name, "Someone");
    const message = safeText(n.message, "interacted with you");
    const avatar = safeText(
      actor?.profile_image_url,
      "https://via.placeholder.com/100?text=User"
    );

    return (
      <div
        key={n.id}
        role="button"
        tabIndex={0}
        onClick={() => onProfileClick(actor?.id || 0)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onProfileClick(actor?.id || 0);
          }
        }}
        className="cursor-pointer transition-colors"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "10px 16px",
          background: !n.is_read ? "#E7F3FF" : "transparent",
          borderBottom: "1px solid rgba(0,0,0,0.04)",
          fontFamily: "'Roboto', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
        }}
      >
        <div style={{ flexShrink: 0, position: "relative" }}>
          <img
            src={avatar}
            alt={actorName}
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: "50%",
              objectFit: "cover",
              background: "#E4E6EB",
              display: "block",
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.28,
              color: "#050505",
              wordBreak: "break-word",
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
              }}
            >
              {actorName}
            </span>{" "}
            <span style={{ fontWeight: 400 }}>{message}</span>
          </div>

          <div
            style={{
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 13,
                lineHeight: 1.2,
                color: !n.is_read ? "#1877F2" : "#65676B",
                fontWeight: !n.is_read ? 600 : 400,
              }}
            >
              {formatTimestamp(n.created_at)}
            </span>

            {!n.is_read && (
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#1877F2",
                  display: "inline-block",
                }}
              />
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          aria-label="Notification menu"
          style={{
            border: "none",
            background: "transparent",
            color: "#65676B",
            cursor: "pointer",
            padding: 4,
            marginTop: 2,
            flexShrink: 0,
          }}
        >
          <i className="fas fa-ellipsis-h" style={{ fontSize: 18 }} />
        </button>
      </div>
    );
  };

  return (
    <section
      className="w-full max-w-3xl mx-auto"
      style={{
        background: "#FFFFFF",
        color: "#050505",
        minHeight: "100%",
        fontFamily: "'Roboto', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
      }}
    >
      <div
        className={stickyHeader ? "sticky top-0 z-10" : ""}
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid #E4E6EB",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px 10px",
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
                background: "#E4E6EB",
                color: "#050505",
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
                fontSize: 32,
                lineHeight: 1.1,
                fontWeight: 800,
                color: "#050505",
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
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "none",
              background: "#E4E6EB",
              color: "#050505",
              cursor: isProcessing || unreadCount === 0 ? "not-allowed" : "pointer",
              opacity: isProcessing || unreadCount === 0 ? 0.55 : 1,
              flexShrink: 0,
            }}
          >
            <i className="fas fa-check" style={{ fontSize: 18 }} />
          </button>
        </div>
      </div>

      <div>
        {newNotifications.length > 0 && (
          <div>
            <div
              style={{
                padding: "14px 16px 8px",
                fontSize: 16,
                fontWeight: 700,
                color: "#050505",
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
                fontSize: 16,
                fontWeight: 700,
                color: "#050505",
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
                    borderRadius: 10,
                    background: "#E4E6EB",
                    color: "#050505",
                    fontSize: 16,
                    fontWeight: 600,
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
              padding: "28px 16px",
              textAlign: "center",
              color: "#65676B",
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
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
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
