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

/**
 * Adjustments per request:
 * - Actor name: 25.5px, white, bold
 * - Notification message: 22px, semi-bold (kept)
 * - Timestamp: 15px, blue
 * - Section headers (New / Earlier): 27px (reduced by 1px), bold, styled
 * - Avatar: 89px (reduced by 1px)
 * - Uses Roboto Google font (loaded once)
 * - Designed for a dark background: primary text is white or light-gray so it is readable
 */

const AVATAR_SIZE = 89; // px (reduced by 1px as requested)

const formatTimestamp = (iso: string) => {
  const d = new Date(iso);
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const month = monthNames[d.getMonth()];
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${month} ${day} at ${hour12}:${minutes}${ampm}`;
};

export const NotificationsPage: React.FC<Props> = ({
  notifications,
  users,
  onBack,
  onProfileClick,
  onMarkAllAsRead,
  simulateApi = false,
  stickyHeader = false
}) => {
  // Load Roboto once
  useEffect(() => {
    const id = "np-roboto-font";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  const getUser = (id:number) => users.find(u => u.id === id);

  const [localNotifications, setLocalNotifications] = useState<Notification[]>(notifications);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    setLocalNotifications(notifications);
  }, [notifications]);

  const unreadCount = useMemo(
    () => localNotifications.filter(n => !n.is_read).length,
    [localNotifications]
  );

  const { newNotifications, earlierNotifications } = useMemo(() => {
    const now = Date.now();
    const threshold = 48 * 60 * 60 * 1000;
    const newN: Notification[] = [];
    const earlierN: Notification[] = [];
    localNotifications.forEach(n => {
      const created = new Date(n.created_at).getTime();
      if (now - created <= threshold) newN.push(n);
      else earlierN.push(n);
    });
    return { newNotifications: newN, earlierNotifications: earlierN };
  }, [localNotifications]);

  const showToast = (type: "error" | "success", text: string, ms = 3500) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), ms);
  };

  const handleMarkAllAsRead = async () => {
    if (isProcessing || unreadCount === 0) return;
    const snapshot = localNotifications.map(n => ({ ...n }));
    setLocalNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setIsProcessing(true);

    try {
      if (onMarkAllAsRead) {
        const result = onMarkAllAsRead();
        if (result && typeof (result as Promise<any>).then === "function") {
          await result as Promise<any>;
        }
      } else if (simulateApi) {
        await new Promise(res => setTimeout(res, 700));
      }
      setIsProcessing(false);
      showToast("success", "All notifications marked as read");
    } catch (err) {
      setLocalNotifications(snapshot);
      setIsProcessing(false);
      showToast("error", "Failed to mark all as read. Please try again.");
      console.error("Mark all as read failed:", err);
    }
  };

  const renderRow = (n: Notification) => {
    const actor = getUser(n.actor_id);
    const message = n.message || "interacted with you";

    return (
      <div
        key={n.id}
        role="button"
        tabIndex={0}
        onClick={() => onProfileClick(actor?.id || 0)}
        className={`flex items-start gap-4 px-4 py-3 cursor-pointer hover:bg-[#242526] focus:outline-none transition-colors`}
        style={{
          fontFamily: "'Roboto', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
          // unread left accent
          borderLeft: !n.is_read ? "4px solid #1877F2" : undefined,
          paddingLeft: !n.is_read ? 12 : undefined
        }}
      >
        {/* Avatar */}
        <img
          src={actor?.profile_image_url}
          alt={actor?.name || "avatar"}
          className="flex-shrink-0 rounded-full object-cover"
          style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
        />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onProfileClick(actor?.id || 0); }}
              className="truncate"
              aria-label={`Open profile of ${actor?.name || "user"}`}
              style={{
                fontSize: 25.5,
                fontWeight: 800,
                lineHeight: 1.05,
                color: "#FFFFFF", // names white and bold
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left"
              }}
            >
              {actor?.name || "Someone"}
            </button>

            {actor?.is_verified && (
              <i
                className="fas fa-check-circle"
                style={{ color: "#1877F2", fontSize: 18, marginLeft: 6 }}
                aria-hidden
              />
            )}

            <span
              className="truncate"
              style={{
                fontSize: 22,           // notification message size (kept)
                fontWeight: 600,        // semi-bold but not as heavy as name
                marginLeft: 8,
                color: "#E5E7EB",       // light gray for good contrast on dark background
                lineHeight: 1.15,
                fontFamily: "inherit"
              }}
            >
              {message}
            </span>
          </div>

          <div
            style={{
              fontSize: 15,           // timestamp 15px
              fontWeight: 700,        // bold
              marginTop: 8,
              color: "#1877F2",       // blue timestamp
              fontFamily: "inherit"
            }}
          >
            {formatTimestamp(n.created_at)}
          </div>
        </div>

        {/* menu */}
        <button
          onClick={(e) => { e.stopPropagation(); /* open menu handler */ }}
          aria-label="Notification menu"
          className="ml-3 flex-shrink-0"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          <i className="fas fa-ellipsis-h" style={{ fontSize: 20, color: "#9CA3AF" }} />
        </button>
      </div>
    );
  };

  return (
    <section
      className="w-full max-w-3xl mx-auto"
      style={{
        fontFamily: "'Roboto', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
        background: "transparent",
        color: "#FFFFFF" // default text white for dark background
      }}
    >
      {/* Header */}
      <div
        className={`${stickyHeader ? "sticky top-0" : ""} px-4 py-4 flex items-center gap-3 z-10`}
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "transparent"
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded hover:bg-[#242526] focus:outline-none"
            aria-label="Back"
            style={{ background: "transparent", border: "none", cursor: "pointer" }}
          >
            <i className="fas fa-arrow-left" style={{ fontSize: 22, color: "#FFFFFF" }} />
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <h2
            style={{
              fontSize: 28, // slightly larger than actor name
              lineHeight: "32px",
              fontWeight: 800,
              color: "#FFFFFF",
              margin: 0,
              fontFamily: "inherit"
            }}
          >
            Notifications
          </h2>

          {unreadCount > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#E53935",
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 999,
                padding: "4px 10px"
              }}
            >
              {unreadCount}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={handleMarkAllAsRead}
            disabled={isProcessing || unreadCount === 0}
            className="px-3 py-2 rounded flex items-center"
            aria-label="Mark all as read"
            title="Mark all as read"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#E5E7EB",
              cursor: isProcessing || unreadCount === 0 ? "not-allowed" : "pointer",
              opacity: isProcessing || unreadCount === 0 ? 0.5 : 1,
              fontFamily: "inherit"
            }}
          >
            <i className="fas fa-check-double mr-2" style={{ fontSize: 18, color: "#E5E7EB" }} />
            <span style={{ fontSize: 15 }}>{isProcessing ? "Marking..." : "Mark all as read"}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        {newNotifications.length > 0 && (
          <div style={{ paddingTop: 12, paddingBottom: 8 }}>
            <div style={{ padding: "8px 16px", fontSize: 27, fontWeight: 800, color: "#9CA3AF", marginBottom: 4 }}>
              New
            </div>
            <div>
              {newNotifications.map(renderRow)}
            </div>
          </div>
        )}

        {earlierNotifications.length > 0 && (
          <div style={{ paddingTop: 12, paddingBottom: 8 }}>
            <div style={{ padding: "8px 16px", fontSize: 27, fontWeight: 800, color: "#9CA3AF", marginBottom: 4 }}>
              Earlier
            </div>
            <div>
              {earlierNotifications.map(renderRow)}
            </div>
          </div>
        )}

        {localNotifications.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", fontSize: 15, color: "#9CA3AF" }}>
            No notifications yet
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 18,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "10px 16px",
            borderRadius: 8,
            boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
            background: toast.type === "error" ? "#B00020" : "#2E7D32",
            color: "#fff",
            fontSize: 14,
            fontFamily: "inherit"
          }}
        >
          {toast.text}
        </div>
      )}
    </section>
  );
};
