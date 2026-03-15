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
 * Tailored to match the screenshot spacing and typography:
 * - Header title ~22px
 * - Actor name bold and slightly larger (15-16px)
 * - "New" / "Earlier" headers bold
 * - Compact rows with tighter vertical spacing
 * - Unread indicator as a left blue bar
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

  // Local copy for optimistic updates
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
        className={`flex items-start gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2b2c2d] focus:outline-none transition-colors
          ${!n.is_read ? "border-l-4 border-[#1877F2] pl-[12px]" : "pl-4"}
        `}
      >
        {/* Avatar */}
        <img
          src={actor?.profile_image_url}
          alt={actor?.name || "avatar"}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="text-[15px] leading-tight truncate text-gray-900 dark:text-[#E4E6EB]">
            <button
              onClick={(e)=>{ e.stopPropagation(); onProfileClick(actor?.id || 0); }}
              className="font-bold text-inherit hover:underline truncate"
              aria-label={`Open profile of ${actor?.name || "user"}`}
            >
              {actor?.name || "Someone"}
            </button>

            {actor?.is_verified && (
              <i className="fas fa-check-circle text-[#1877F2] ml-1 text-[12px]"></i>
            )}

            <span className="font-normal">{" "}{message}</span>
          </div>

          <div className="text-[13px] text-gray-500 dark:text-[#B0B3B8] mt-1">
            {formatTimestamp(n.created_at)}
          </div>
        </div>

        {/* menu */}
        <button
          onClick={(e)=>{ e.stopPropagation(); /* open menu handler */ }}
          aria-label="Notification menu"
          className="text-gray-400 dark:text-[#B0B3B8] ml-2 flex-shrink-0"
        >
          <i className="fas fa-ellipsis-h"></i>
        </button>
      </div>
    );
  };

  return (
    <section className="w-full max-w-3xl mx-auto bg-transparent">
      {/* Header */}
      <div className={`${stickyHeader ? "sticky top-0" : ""} bg-white dark:bg-[#242526] px-4 py-3 border-b border-gray-200 dark:border-[#3E4042] flex items-center gap-3 z-10`}>
        {onBack && (
          <button
            onClick={onBack}
            className="text-gray-700 dark:text-[#E4E6EB] p-2 rounded hover:bg-gray-100 dark:hover:bg-[#3A3B3C] focus:outline-none"
            aria-label="Back"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
        )}

        <div className="flex-1 flex items-center gap-3">
          <h2 className="text-[#E4E6EB] dark:text-[#E4E6EB] font-bold text-[22px] leading-tight">Notifications</h2>

          {unreadCount > 0 && (
            <div className="inline-flex items-center justify-center bg-[#E53935] text-white text-[12px] font-semibold rounded-full px-2 py-0.5">
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
          >
            <i className="fas fa-check-double mr-2"></i>
            <span className="text-sm">{isProcessing ? "Marking..." : "Mark all as read"}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="divide-y divide-gray-100 dark:divide-[#3E4042]">
        {newNotifications.length > 0 && (
          <div className="py-2">
            <div className="px-4 py-2 text-gray-600 dark:text-[#B0B3B8] text-[14px] font-bold">New</div>
            <div className="space-y-0">
              {newNotifications.map(renderRow)}
            </div>
          </div>
        )}

        {earlierNotifications.length > 0 && (
          <div className="py-2">
            <div className="px-4 py-2 text-gray-600 dark:text-[#B0B3B8] text-[14px] font-bold">Earlier</div>
            <div className="space-y-0">
              {earlierNotifications.map(renderRow)}
            </div>
          </div>
        )}

        {localNotifications.length === 0 && (
          <div className="p-6 text-center text-gray-500 dark:text-[#B0B3B8]">
            No notifications yet
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded shadow-lg ${toast.type === "error" ? "bg-[#B00020] text-white" : "bg-[#2E7D32] text-white"}`}>
          {toast.text}
        </div>
      )}
    </section>
  );
};
