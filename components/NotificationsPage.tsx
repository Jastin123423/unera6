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
 * All sizes and spacing doubled compared to the previous iteration.
 * - Header title: 44px
 * - Actor name: 38px
 * - Notification message: 36px
 * - Timestamp: 30px
 * - Section headers: 28px
 * - Avatar: w-28 h-28 (~112px)
 * - Row padding doubled (py-4, px-8)
 * - Left unread bar doubled (border-l-8)
 */
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
  const getUser = (id:number)=>users.find(u=>u.id===id);

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
        className={`flex items-start gap-6 px-8 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2b2c2d] focus:outline-none transition-colors
          ${!n.is_read ? "border-l-8 border-[#1877F2] pl-[20px]" : "pl-8"}
        `}
      >
        {/* Avatar (doubled) */}
        <img
          src={actor?.profile_image_url}
          alt={actor?.name || "avatar"}
          className="w-28 h-28 rounded-full object-cover flex-shrink-0"
        />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="leading-tight truncate text-gray-900 dark:text-[#E4E6EB]">
            <button
              onClick={(e)=>{ e.stopPropagation(); onProfileClick(actor?.id || 0); }}
              className="font-extrabold hover:underline truncate"
              aria-label={`Open profile of ${actor?.name || "user"}`}
              style={{ fontSize: 38, fontWeight: 800 }}
            >
              {actor?.name || "Someone"}
            </button>

            {actor?.is_verified && (
              <i
                className="fas fa-check-circle ml-2 align-middle"
                style={{ color: "#1877F2", fontSize: 28, verticalAlign: "middle" }}
              />
            )}

            <span className="font-normal ml-4 align-middle" style={{ fontSize: 36 }}>
              {message}
            </span>
          </div>

          <div className="mt-2" style={{ fontSize: 30, color: "rgba(0,0,0,0.6)" }}>
            {formatTimestamp(n.created_at)}
          </div>
        </div>

        {/* menu (icon increased) */}
        <button
          onClick={(e)=>{ e.stopPropagation(); /* open menu handler */ }}
          aria-label="Notification menu"
          className="ml-4 flex-shrink-0"
        >
          <i className="fas fa-ellipsis-h" style={{ fontSize: 28, color: "rgba(0,0,0,0.45)" }} />
        </button>
      </div>
    );
  };

  return (
    <section className="w-full max-w-4xl mx-auto bg-transparent">
      {/* Header */}
      <div className={`${stickyHeader ? "sticky top-0" : ""} bg-white dark:bg-[#242526] px-8 py-6 border-b border-gray-200 dark:border-[#3E4042] flex items-center gap-6 z-10`}>
        {onBack && (
          <button
            onClick={onBack}
            className="p-3 rounded hover:bg-gray-100 dark:hover:bg-[#3A3B3C] focus:outline-none"
            aria-label="Back"
          >
            <i className="fas fa-arrow-left" style={{ fontSize: 28, color: "#333" }} />
          </button>
        )}

        <div className="flex-1 flex items-center gap-6">
          <h2 style={{ fontSize: 44, lineHeight: "48px", fontWeight: 800, color: "#E4E6EB" }}>
            Notifications
          </h2>

          {unreadCount > 0 && (
            <div className="inline-flex items-center justify-center bg-[#E53935] text-white font-semibold rounded-full px-4 py-1.5" style={{ fontSize: 18 }}>
              {unreadCount}
            </div>
          )}
        </div>

        <div className="flex items-center">
          <button
            onClick={handleMarkAllAsRead}
            disabled={isProcessing || unreadCount === 0}
            className="px-4 py-3 rounded hover:bg-gray-100 dark:hover:bg-[#3A3B3C] disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            aria-label="Mark all as read"
            title="Mark all as read"
            style={{ color: "rgba(0,0,0,0.65)" }}
          >
            <i className="fas fa-check-double mr-3" style={{ fontSize: 28 }} />
            <span style={{ fontSize: 30 }}>{isProcessing ? "Marking..." : "Mark all as read"}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="divide-y divide-gray-100 dark:divide-[#3E4042]">
        {newNotifications.length > 0 && (
          <div className="py-4">
            <div className="px-8 py-3" style={{ fontSize: 28, fontWeight: 800, color: "rgba(0,0,0,0.65)" }}>
              New
            </div>
            <div>
              {newNotifications.map(renderRow)}
            </div>
          </div>
        )}

        {earlierNotifications.length > 0 && (
          <div className="py-4">
            <div className="px-8 py-3" style={{ fontSize: 28, fontWeight: 800, color: "rgba(0,0,0,0.65)" }}>
              Earlier
            </div>
            <div>
              {earlierNotifications.map(renderRow)}
            </div>
          </div>
        )}

        {localNotifications.length === 0 && (
          <div className="p-12 text-center" style={{ fontSize: 30, color: "rgba(0,0,0,0.6)" }}>
            No notifications yet
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded shadow-lg ${toast.type === "error" ? "bg-[#B00020] text-white" : "bg-[#2E7D32] text-white"}`} style={{ fontSize: 18 }}>
          {toast.text}
        </div>
      )}
    </section>
  );
};
