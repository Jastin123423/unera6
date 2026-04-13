import React, { useEffect, useMemo, useRef, useState } from "react";
import { Notification, User } from "../types";

interface Props {
  notifications: Notification[];
  users: User[];

  onBack?: () => void;
  onProfileClick: (id: number) => void;

  // 🔥 NEW: content navigation
  onOpenEntity?: (n: Notification) => void;

  onMarkAllAsRead?: () => Promise<any> | void;
}

const AVATAR_SIZE = 56;
const INITIAL_COUNT = 10;
const LOAD_MORE = 10;

export const NotificationsPage: React.FC<Props> = ({
  notifications,
  users,
  onBack,
  onProfileClick,
  onOpenEntity,
  onMarkAllAsRead,
}) => {

  const getUser = (id: number) => users.find(u => u.id === id);

  const [items, setItems] = useState<Notification[]>(notifications);
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(notifications);
  }, [notifications]);

  /* =========================
     SPLIT NEW / EARLIER
  ========================= */
  const { newItems, earlierItems } = useMemo(() => {
    const now = Date.now();
    const threshold = 48 * 60 * 60 * 1000;

    const n: Notification[] = [];
    const e: Notification[] = [];

    items.forEach(i => {
      const t = new Date(i.created_at).getTime();
      if (now - t <= threshold) n.push(i);
      else e.push(i);
    });

    return { newItems: n, earlierItems: e };
  }, [items]);

  const visibleEarlier = earlierItems.slice(0, visibleCount);

  /* =========================
     DELETE
  ========================= */
  const deleteNotification = async (id: number) => {
    // optimistic UI
    setItems(prev => prev.filter(n => n.id !== id));

    try {
      await fetch(`/api/notifications?id=${id}`, {
        method: "DELETE",
        headers: {
          "x-user-id": String(localStorage.getItem("user_id") || "")
        }
      });
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  /* =========================
     LOAD MORE (NO JUMP)
  ========================= */
  const handleLoadMore = () => {
    const scrollY = window.scrollY;

    setVisibleCount(prev => prev + LOAD_MORE);

    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  };

  /* =========================
     CLICK HANDLERS
  ========================= */
  const handleContentClick = (n: Notification) => {
    if (onOpenEntity) {
      onOpenEntity(n);
    }
  };

  /* =========================
     ROW
  ========================= */
  const renderRow = (n: Notification) => {
    const user = getUser(n.actor_id);

    return (
      <div
        key={n.id}
        style={{
          display: "flex",
          gap: 12,
          padding: "10px 16px",
          cursor: "pointer",
          background: !n.is_read ? "rgba(24,119,242,0.12)" : "transparent",
          borderBottom: "1px solid rgba(255,255,255,0.05)"
        }}
      >
        {/* AVATAR */}
        <img
          src={user?.profile_image_url}
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: "50%",
            objectFit: "cover"
          }}
          onClick={(e) => {
            e.stopPropagation();
            onProfileClick(user?.id || 0);
          }}
        />

        {/* TEXT */}
        <div style={{ flex: 1 }} onClick={() => handleContentClick(n)}>
          <div style={{ fontSize: 15, color: "#fff" }}>
            <span
              style={{ fontWeight: 700 }}
              onClick={(e) => {
                e.stopPropagation();
                onProfileClick(user?.id || 0);
              }}
            >
              {user?.name || "Someone"}
            </span>{" "}
            <span style={{ color: "#ccc" }}>
              {n.message}
            </span>
          </div>

          <div style={{ fontSize: 13, color: "#1877F2", marginTop: 4 }}>
            {new Date(n.created_at).toLocaleString()}
          </div>
        </div>

        {/* MENU */}
        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId(prev => prev === n.id ? null : n.id);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#aaa",
              cursor: "pointer"
            }}
          >
            ⋯
          </button>

          {menuOpenId === n.id && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 24,
                background: "#1c1c1c",
                borderRadius: 8,
                padding: 6,
                minWidth: 140,
                boxShadow: "0 8px 20px rgba(0,0,0,0.4)"
              }}
            >
              <div
                onClick={() => deleteNotification(n.id)}
                style={{
                  padding: "8px 10px",
                  cursor: "pointer",
                  color: "#ff4d4f"
                }}
              >
                Delete notification
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={listRef}
      style={{
        background: "#0f0f0f",
        color: "#fff",
        minHeight: "100vh"
      }}
    >
      {/* HEADER */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: 16,
        borderBottom: "1px solid rgba(255,255,255,0.08)"
      }}>
        {onBack && (
          <button onClick={onBack} style={{ marginRight: 10 }}>
            ←
          </button>
        )}

        <h2 style={{ fontSize: 24, fontWeight: 800 }}>Notifications</h2>
      </div>

      {/* NEW */}
      {newItems.length > 0 && (
        <>
          <div style={{ padding: "12px 16px", fontWeight: 700 }}>New</div>
          {newItems.map(renderRow)}
        </>
      )}

      {/* EARLIER */}
      {visibleEarlier.length > 0 && (
        <>
          <div style={{ padding: "12px 16px", fontWeight: 700 }}>
            Earlier
          </div>

          {visibleEarlier.map(renderRow)}

          {visibleEarlier.length < earlierItems.length && (
            <div style={{ padding: 16 }}>
              <button
                onClick={handleLoadMore}
                style={{
                  width: "100%",
                  padding: 12,
                  background: "#2a2a2a",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff"
                }}
              >
                See previous notifications
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
