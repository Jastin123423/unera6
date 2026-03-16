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
 * Typography choices:
 * - Google Font: Roboto (loaded dynamically)
 * - Actor name: 25.5px, weight 800
 * - Notification message: 22px, weight 600
 * - Timestamp: 15px, weight 700, white in dark mode
 * - Section headers (New / Earlier): 28px, weight 800, subtle color
 * - Avatar: ~90px (AVATAR_SIZE)
 */

const AVATAR_SIZE = 90; // px

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
  // load Roboto from Google Fonts once
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
        className={`flex items-start gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2b2c2d] focus:outline-none transition-colors
          ${!n.is_read ? "border-l-4 border-[#1877F2] pl-[12px]" : "pl-4"}
        `}
        style={{ fontFamily: "'Roboto', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }}
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
                color: "var(--np-text, #111827)",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: "inherit"
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
                fontSize: 22,
                fontWeight: 600,
                marginLeft: 8,
                color: "var(--np-subtext, #374151)",
                lineHeight: 1.15,
                fontFamily: "inherit"
              }}
            >
              {message}
            </span>
          </div>

          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              marginTop: 8,
              // white timestamp for dark backgrounds, softer for light
              color: "var(--np-timestamp, rgba(255,255,255,0.9))",
              fontFamily: "inherit"
            }}
            className="dark:text-white text-gray-500"
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
          <i className="fas fa-ellipsis-h" style={{ fontSize: 20, color: "rgba(0,0,0,0.45)" }} />
        </button>
      </div>
    );
  };

  return (
    <section className="w-full max-w-3xl mx-auto bg-transparent" style={{ fontFamily: "'Roboto', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }}>
      {/* Header */}
      <div className={`${stickyHeader ? "sticky top-0" : ""} bg-white dark:bg-[#242526] px-4 py-4 border-b border-gray-200 dark:border-[#3E4042] flex items-center gap-3 z-10`}>
        {onBack && (
          <button
            onClick={onBack}
            className="text-gray-700 dark:text-[#E4E6EB] p-2 rounded hover:bg-gray-100 dark:hover:bg-[#3A3B3C] focus:outline-none"
            aria-label="Back"
            style={{ fontFamily: "inherit" }}
          >
            <i className="fas fa-arrow-left" style={{ fontSize: 22 }} />
          </button>
        )}

        <div className="flex-1 flex items-center gap-3">
          <h2
            style={{
              fontSize: 28, // slightly larger than actor name
              lineHeight: "32px",
              fontWeight: 800,
              color: "var(--np-header, #111827)",
              fontFamily: "inherit"
            }}
          >
            Notifications
          </h2>

          {unreadCount > 0 && (
            <div className="inline-flex items-center justify-center bg-[#E53935] text-white text-[13px] font-semibold rounded-full px-3 py-0.5">
              {unreadCount}
            </div>
          )}
        </div>

        <div className="flex items-center">
          <button
            onClick={handleMarkAllAsRead}
            disabled={isProcessing || unreadCount === 0}
            className="text-gray-600 dark:text-[#B0B3B8] px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-[#3A3B3C] disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            aria-label="Mark all as read"
            title="Mark all as read"
            style={{ fontFamily: "inherit" }}
          >
            <i className="fas fa-check-double mr-2" style={{ fontSize: 18 }} />
            <span style={{ fontSize: 15 }}>{isProcessing ? "Marking..." : "Mark all as read"}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="divide-y divide-gray-100 dark:divide-[#3E4042]">
        {newNotifications.length > 0 && (
          <div className="py-3">
            <div className="px-4 py-2" style={{ fontSize: 28, fontWeight: 800, color: "var(--np-section, #6B7280)", fontFamily: "inherit" }}>
              New
            </div>
            <div>
              {newNotifications.map(renderRow)}
            </div>
          </div>
        )}

        {earlierNotifications.length > 0 && (
          <div className="py-3">
            <div className="px-4 py-2" style={{ fontSize: 28, fontWeight: 800, color: "var(--np-section, #6B7280)", fontFamily: "inherit" }}>
              Earlier
            </div>
            <div>
              {earlierNotifications.map(renderRow)}
            </div>
          </div>
        )}

        {localNotifications.length === 0 && (
          <div className="p-6 text-center" style={{ fontSize: 15, color: "rgba(0,0,0,0.6)", fontFamily: "inherit" }}>
            No notifications yet
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded shadow-lg ${toast.type === "error" ? "bg-[#B00020] text-white" : "bg-[#2E7D32] text-white"}`}
          style={{ fontSize: 14, fontFamily: "inherit" }}
        >
          {toast.text}
        </div>
      )}
    </section>
  );
};
