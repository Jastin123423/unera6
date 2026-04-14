import React, { useEffect, useMemo, useRef, useState } from "react";
import { Notification, User } from "../types";

interface Props {
  notifications: Notification[];
  users: User[];
  onBack?: () => void;
  onProfileClick: (id: number) => void;
  onOpenNotification?: (notification: Notification) => void;
  onMarkAllAsRead?: () => Promise<any> | void;
  onDeleteNotification?: (notificationId: number) => Promise<any> | void;
  simulateApi?: boolean;
  stickyHeader?: boolean;
}

const AVATAR_SIZE = 64;
const STACK_AVATAR_SIZE = 28;
const INITIAL_EARLIER_COUNT = 10;
const LOAD_MORE_COUNT = 10;

const safeText = (v: any, fallback = "") => (typeof v === "string" ? v : fallback);

const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const getNotificationTime = (n: Notification) => {
  const updated = n.updated_at ? new Date(n.updated_at).getTime() : NaN;
  if (Number.isFinite(updated)) return updated;
  const created = n.created_at ? new Date(n.created_at).getTime() : NaN;
  if (Number.isFinite(created)) return created;
  return 0;
};

const formatTimestamp = (iso?: string | null) => {
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

const toWords = (text: string, limit = 10) => {
  const clean = safeText(text).replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const words = clean.split(" ");
  if (words.length <= limit) return clean;
  return `${words.slice(0, limit).join(" ")}...`;
};

const parseActorsJson = (value: any): number[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((x) => safeNumber(x, 0)).filter((x) => x > 0);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((x) => {
            if (typeof x === "object" && x !== null) return safeNumber((x as any).id, 0);
            return safeNumber(x, 0);
          })
          .filter((x) => x > 0);
      }
    } catch {
      return [];
    }
  }

  return [];
};

const getStackActorIds = (n: Notification): number[] => {
  const ids = parseActorsJson(n.actors_json);
  const latestActorId = safeNumber(n.actor_id, 0);

  const ordered = [latestActorId, ...ids].filter((x) => x > 0);
  const deduped: number[] = [];

  ordered.forEach((id) => {
    if (!deduped.includes(id)) deduped.push(id);
  });

  return deduped.slice(0, 3);
};

const getReactionEmoji = (n: Notification) => {
  const type = safeText(n.type).toLowerCase();
  const reactionType = safeText((n as any).reaction_type).toLowerCase();
  const rawMessage = safeText(n.message).toLowerCase();

  const source = `${reactionType} ${rawMessage} ${type}`;

  if (source.includes("love") || source.includes("heart")) return "❤️";
  if (source.includes("haha") || source.includes("laugh")) return "😂";
  if (source.includes("wow")) return "😮";
  if (source.includes("sad")) return "😢";
  if (source.includes("angry")) return "😡";
  if (source.includes("fire")) return "🔥";
  if (source.includes("party")) return "🎉";
  if (source.includes("clap")) return "👏";
  if (source.includes("like") || source.includes("react") || source.includes("reaction")) return "👍";

  return "";
};

const getReactionEmojiCluster = (n: Notification): string[] => {
  const primary = getReactionEmoji(n);
  if (!primary) return [];

  const lower = `${safeText((n as any).reaction_type).toLowerCase()} ${safeText(n.message).toLowerCase()}`;

  if (lower.includes("love") && lower.includes("fire")) return ["❤️", "🔥", "👍"];
  if (lower.includes("love")) return ["❤️", "👍"];
  if (lower.includes("haha")) return ["😂", "👍"];
  if (lower.includes("fire")) return ["🔥", "👍"];
  if (lower.includes("wow")) return ["😮", "👍"];

  return [primary];
};

// UPDATED: New badge function with song, podcast, story, event support
const getNotificationBadge = (n: Notification) => {
  const type = safeText(n.type).toLowerCase();
  const entityType = safeText(n.entity_type || (n as any).target_type || "").toLowerCase();
  const reactionEmoji = getReactionEmoji(n);

  if (reactionEmoji) {
    return { kind: "emoji" as const, value: reactionEmoji, bg: "#1D1F24" };
  }

  if (type.includes("discuss") || type.includes("comment") || type.includes("reply")) {
    return { kind: "icon" as const, value: "fas fa-comment", bg: "#1877F2" };
  }

  if (type.includes("follow")) {
    return { kind: "icon" as const, value: "fas fa-user-plus", bg: "#42A5F5" };
  }

  if (type.includes("share")) {
    return { kind: "icon" as const, value: "fas fa-share", bg: "#43A047" };
  }

  if (type.includes("birthday")) {
    return { kind: "emoji" as const, value: "🎂", bg: "#1D1F24" };
  }

  if (entityType === "song") {
    return { kind: "icon" as const, value: "fas fa-music", bg: "#8B5CF6" };
  }

  if (entityType === "podcast") {
    return { kind: "icon" as const, value: "fas fa-microphone", bg: "#F59E0B" };
  }

  if (entityType === "story") {
    return { kind: "icon" as const, value: "fas fa-bolt", bg: "#EC4899" };
  }

  if (entityType === "event" || type === "event") {
    return { kind: "icon" as const, value: "fas fa-calendar-alt", bg: "#10B981" };
  }

  if (entityType === "group_post" || entityType === "group" || type.includes("group")) {
    return { kind: "icon" as const, value: "fas fa-users", bg: "#8E24AA" };
  }

  if (entityType === "product" || type.includes("product") || type.includes("marketplace")) {
    return { kind: "icon" as const, value: "fas fa-shopping-bag", bg: "#FB8C00" };
  }

  if (entityType === "reel") {
    return { kind: "icon" as const, value: "fas fa-play", bg: "#FF5252" };
  }

  return { kind: "icon" as const, value: "fas fa-bell", bg: "#1877F2" };
};

// UPDATED: New message builder with full content type support
const buildNotificationMessageParts = (n: Notification) => {
  const type = safeText(n.type).toLowerCase();
  const entityType = safeText(n.entity_type || (n as any).target_type || "").toLowerCase();
  const rawMessage = safeText(n.message || "").trim();
  const actorsCount = Math.max(1, safeNumber((n as any).actors_count, 1));
  const othersCount = Math.max(0, actorsCount - 1);
  const reactionType = safeText((n as any).reaction_type).toLowerCase();
  const othersText = othersCount > 0 ? ` and ${othersCount} others` : "";

  const targetLabel = 
    entityType === "post" ? "your post" :
    entityType === "reel" ? "your reel" :
    entityType === "story" ? "your story" :
    entityType === "song" ? "your song" :
    entityType === "podcast" ? "your podcast" :
    entityType === "product" ? "your product" :
    entityType === "group_post" ? "your group post" :
    entityType === "event" ? "your event" :
    entityType === "comment" ? "your Discuss" :
    entityType === "group" ? "your group" :
    entityType === "profile" ? "you" :
    "your content";

  const reactionVerb = (() => {
    const source = `${reactionType} ${rawMessage}`.toLowerCase();
    if (source.includes("love")) return "loved";
    if (source.includes("haha") || source.includes("laugh")) return "laughed at";
    if (source.includes("wow")) return "were amazed by";
    if (source.includes("sad")) return "felt sad about";
    if (source.includes("angry")) return "felt angry about";
    if (source.includes("fire")) return "fired up";
    if (source.includes("party")) return "celebrated";
    if (source.includes("clap")) return "applauded";
    if (source.includes("star")) return "starred";
    if (source.includes("heart-eyes") || source.includes("heart_eyes")) return "reacted heart-eyes to";
    if (source.includes("rocket")) return "rocketed";
    if (source.includes("trophy")) return "awarded";
    if (source.includes("crown")) return "crowned";
    return "reacted to";
  })();

  if (type === "react" || type === "reaction" || type === "like") {
    return {
      middle: `${othersText} ${reactionVerb} ${targetLabel}`.trim(),
      cta: "See reactions.",
    };
  }

  if (type === "discuss" || type === "comment") {
    return {
      middle: `${othersText} discussed ${targetLabel}`.trim(),
      cta: othersCount > 0 ? "Join their Discuss." : "Join the Discuss.",
    };
  }

  if (type === "reply") {
    return {
      middle: `${othersText} replied in Discuss`.trim(),
      cta: "Join the conversation.",
    };
  }

  if (type === "share") {
    return {
      middle: `${othersText} shared ${targetLabel}`.trim(),
      cta: "View shares.",
    };
  }

  if (type === "follow") {
    return {
      middle: `${othersText} followed you`.trim(),
      cta: "Keep creating great content.",
    };
  }

  if (type === "birthday") {
    return {
      middle: rawMessage || "has a birthday today",
      cta: "Wish them now.",
    };
  }

  if (type === "event") {
    const lower = rawMessage.toLowerCase();
    if (lower.includes("is going to your event")) {
      return {
        middle: `${othersText} is going to your event`.trim(),
        cta: "View event.",
      };
    }
    if (lower.includes("is interested in your event")) {
      return {
        middle: `${othersText} is interested in your event`.trim(),
        cta: "View event.",
      };
    }
    return {
      middle: rawMessage || "interacted with your event",
      cta: "View details.",
    };
  }

  if (type === "group_request") {
    const lower = rawMessage.toLowerCase();
    if (lower.includes("joined your group")) {
      return {
        middle: `${othersText} joined your group`.trim(),
        cta: "Open group.",
      };
    }
    return {
      middle: rawMessage || "requested to join your group",
      cta: "Review request.",
    };
  }

  if (type === "group_invite") {
    return {
      middle: rawMessage || "invited you to a group",
      cta: "View invitation.",
    };
  }

  if (type === "group_approved") {
    return {
      middle: rawMessage || "approved your group request",
      cta: "Open group.",
    };
  }

  if (type === "group_declined") {
    return {
      middle: rawMessage || "declined your group request",
      cta: "See details.",
    };
  }

  if (type === "group_post") {
    return {
      middle: rawMessage || "posted in your group",
      cta: "Join the Discuss.",
    };
  }

  if (type === "mention") {
    return {
      middle: `${othersText} mentioned you`.trim(),
      cta: "See mention.",
    };
  }

  if (type === "tag") {
    return {
      middle: `${othersText} tagged you`.trim(),
      cta: "Open now.",
    };
  }

  if (type === "product_interest" || type === "marketplace") {
    return {
      middle: rawMessage || `showed interest in ${targetLabel}`,
      cta: "View details.",
    };
  }

  if (
    type === "system" ||
    type === "admin" ||
    type === "security" ||
    type === "warning" ||
    type === "info"
  ) {
    return {
      middle: rawMessage || "sent you an update",
      cta: "",
    };
  }

  return {
    middle: rawMessage || "interacted with you",
    cta: "",
  };
};

// NEW: Helper functions for target routing
const getNotificationTargetType = (n: Notification) => 
  safeText((n as any).target_type || n.entity_type || "").toLowerCase();

const getNotificationTargetId = (n: Notification) => 
  safeNumber((n as any).target_id ?? (n as any).entity_id, 0);

const NotificationStackedAvatars: React.FC<{
  notification: Notification;
  users: User[];
  onProfileClick: (id: number) => void;
}> = ({ notification, users, onProfileClick }) => {
  const actorIds = getStackActorIds(notification);
  const totalCount = Math.max(1, safeNumber(notification.actors_count, 1));

  const actors = actorIds
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean) as User[];

  if (actors.length <= 1 && totalCount <= 1) return null;

  const extra = Math.max(0, totalCount - actors.length);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginTop: 8,
      }}
    >
      {actors.map((user, index) => (
        <button
          key={user.id}
          onClick={(e) => {
            e.stopPropagation();
            onProfileClick(user.id);
          }}
          aria-label={user.name || `User ${user.id}`}
          title={user.name || ""}
          style={{
            width: STACK_AVATAR_SIZE,
            height: STACK_AVATAR_SIZE,
            borderRadius: "50%",
            overflow: "hidden",
            border: "2px solid #121212",
            marginLeft: index === 0 ? 0 : -9,
            padding: 0,
            background: "#2A2D31",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.28)",
          }}
        >
          <img
            src={safeText(user.profile_image_url, "https://via.placeholder.com/100?text=User")}
            alt={user.name || "User"}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </button>
      ))}

      {extra > 0 && (
        <div
          style={{
            marginLeft: actors.length > 0 ? -9 : 0,
            minWidth: 30,
            height: STACK_AVATAR_SIZE,
            borderRadius: 999,
            padding: "0 8px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#232B36",
            border: "2px solid #121212",
            color: "#C9D1D9",
            fontSize: 11,
            fontWeight: 800,
            boxShadow: "0 4px 12px rgba(0,0,0,0.28)",
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
};

const NotificationReactionCluster: React.FC<{ notification: Notification }> = ({ notification }) => {
  const emojis = getReactionEmojiCluster(notification);
  if (emojis.length === 0) return null;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: "3px 6px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.05)",
      }}
    >
      {emojis.slice(0, 3).map((emoji, i) => (
        <span key={`${emoji}-${i}`} style={{ fontSize: 13, lineHeight: 1 }}>
          {emoji}
        </span>
      ))}
    </div>
  );
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
    () => localNotifications.filter((n) => !safeNumber(n.is_read, 0)).length,
    [localNotifications]
  );

  const sortedNotifications = useMemo(() => {
    return [...localNotifications].sort((a, b) => {
      const ta = getNotificationTime(a);
      const tb = getNotificationTime(b);
      if (tb !== ta) return tb - ta;
      return safeNumber(b.id, 0) - safeNumber(a.id, 0);
    });
  }, [localNotifications]);

  const { newNotifications, earlierNotifications } = useMemo(() => {
    const now = Date.now();
    const threshold = 48 * 60 * 60 * 1000;

    const newN: Notification[] = [];
    const earlierN: Notification[] = [];

    sortedNotifications.forEach((n) => {
      const t = getNotificationTime(n);
      if (Number.isFinite(t) && now - t <= threshold) newN.push(n);
      else earlierN.push(n);
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
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
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
    setLocalNotifications((prev) => prev.filter((n) => safeNumber(n.id, 0) !== notificationId));

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

  // UPDATED: New open handler with target_type + target_id routing
  const handleOpenNotification = (n: Notification) => {
    if (onOpenNotification) {
      onOpenNotification(n);
      return;
    }

    const targetType = getNotificationTargetType(n);
    const targetId = getNotificationTargetId(n);

    if (targetType && targetId) {
      // local fallback only if parent didn't pass routing handler
      // since this component itself cannot open feed/reel/story/song/etc
      // fallback to actor profile when no parent routing exists
      const actorId = safeNumber(n.actor_id, 0);
      if (actorId) onProfileClick(actorId);
      return;
    }

    const actorId = safeNumber(n.actor_id, 0);
    if (actorId) onProfileClick(actorId);
  };

  const renderRow = (n: Notification) => {
    const actor = getUser(n.actor_id);
    const actorName = safeText(actor?.name, "Someone");
    const avatar = safeText(actor?.profile_image_url, "https://via.placeholder.com/100?text=User");
    const isUnread = !safeNumber(n.is_read, 0);
    const notificationId = safeNumber(n.id, 0);
    const badge = getNotificationBadge(n);
    const displayTime = safeText(n.updated_at) || safeText(n.created_at);
    const previewText = toWords(
      safeText((n as any).preview_text || (n as any).content_preview || (n as any).preview_title || ""),
      10
    );
    // NEW: Preview image support
    const previewImage = safeText((n as any).preview_image || "");
    const messageParts = buildNotificationMessageParts(n);
    const hasStack = getStackActorIds(n).length > 1 || safeNumber(n.actors_count, 1) > 1;

    return (
      <div
        key={notificationId}
        className="transition-colors"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "14px 16px",
          background: isUnread ? "linear-gradient(90deg, rgba(24,119,242,0.13) 0%, rgba(24,119,242,0.05) 42%, rgba(0,0,0,0) 100%)" : "transparent",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          borderLeft: isUnread ? "3px solid rgba(78,161,255,0.9)" : "3px solid transparent",
          fontFamily: "'Roboto', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
          transform: "translateZ(0)",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            position: "relative",
            cursor: "pointer",
            filter: isUnread ? "drop-shadow(0 4px 14px rgba(24,119,242,0.12))" : "none",
          }}
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
              boxShadow: "0 6px 18px rgba(0,0,0,0.24)",
            }}
          />

          <div
            style={{
              position: "absolute",
              right: -3,
              bottom: -3,
              minWidth: 24,
              height: 24,
              borderRadius: "50%",
              background: badge.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #121212",
              boxSizing: "border-box",
              padding: badge.kind === "emoji" ? "0 5px" : 0,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            {badge.kind === "emoji" ? (
              <span style={{ fontSize: 12, lineHeight: 1 }}>{badge.value}</span>
            ) : (
              <i
                className={badge.value}
                style={{
                  fontSize: 10,
                  color: "#FFFFFF",
                  lineHeight: 1,
                }}
              />
            )}
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
              fontSize: 16.5,
              lineHeight: 1.34,
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
                fontWeight: 800,
                cursor: "pointer",
                color: "#FFFFFF",
                letterSpacing: "-0.01em",
              }}
            >
              {actorName}
            </span>

            {safeNumber(n.actors_count, 1) > 1 && (
              <span
                style={{
                  fontWeight: 800,
                  color: "#FFFFFF",
                }}
              >
                {messageParts.middle.startsWith(" and") ? "" : ""}
              </span>
            )}

            <span
              style={{
                fontWeight: 500,
                color: "#E3E8EF",
              }}
            >
              {" "}
              {messageParts.middle}
            </span>

            {messageParts.cta && (
              <span
                style={{
                  fontWeight: 800,
                  color: "#63AEFF",
                }}
              >
                {" "}
                {messageParts.cta}
              </span>
            )}
          </div>

          {hasStack && (
            <NotificationStackedAvatars
              notification={n}
              users={users}
              onProfileClick={onProfileClick}
            />
          )}

          {/* UPDATED: Preview block with image support */}
          {(previewText || previewImage) && (
            <div
              onClick={() => handleOpenNotification(n)}
              style={{
                marginTop: 9,
                display: "flex",
                alignItems: "center",
                gap: 10,
                maxWidth: "100%",
                background: "rgba(255,255,255,0.045)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 14,
                padding: "10px 12px",
                color: "#AAB6C2",
                fontSize: 13.5,
                lineHeight: 1.35,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                backdropFilter: "blur(8px)",
                cursor: "pointer",
              }}
            >
              {previewImage && (
                <img
                  src={previewImage}
                  alt="preview"
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 10,
                    objectFit: "cover",
                    flexShrink: 0,
                    background: "#1B1E22",
                  }}
                />
              )}
              {previewText && (
                <div style={{ minWidth: 0 }}>
                  <span style={{ marginRight: 6, color: "#778394" }}>“</span>
                  <span>{previewText}</span>
                  <span style={{ marginLeft: 2, color: "#778394" }}>”</span>
                </div>
              )}
            </div>
          )}

          <div
            style={{
              marginTop: previewText || previewImage ? 9 : hasStack ? 9 : 7,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 13,
                lineHeight: 1.2,
                color: isUnread ? "#69B2FF" : "#8B98A5",
                fontWeight: isUnread ? 700 : 500,
              }}
            >
              {formatTimestamp(displayTime)}
            </span>

            <NotificationReactionCluster notification={n} />

            {isUnread && (
              <span
                aria-hidden
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: "#1877F2",
                  display: "inline-block",
                  flexShrink: 0,
                  boxShadow: "0 0 0 4px rgba(24,119,242,0.12)",
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
              background: "rgba(255,255,255,0.03)",
              color: "#9AA4AF",
              cursor: "pointer",
              padding: 0,
              marginTop: 2,
              borderRadius: 999,
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
            }}
          >
            <i className="fas fa-ellipsis-h" style={{ fontSize: 15 }} />
          </button>

          {menuOpenId === notificationId && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 38,
                minWidth: 190,
                background: "rgba(27,30,34,0.98)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                boxShadow: "0 14px 36px rgba(0,0,0,0.42)",
                overflow: "hidden",
                zIndex: 100,
                backdropFilter: "blur(14px)",
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
                  padding: "13px 14px",
                  border: "none",
                  background: "transparent",
                  color: "#FF7878",
                  cursor: deletingId === notificationId ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 700,
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

  const newCount = newNotifications.length;
  const earlierCount = earlierNotifications.length;

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
          background: "rgba(18,18,18,0.88)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          boxShadow: stickyHeader ? "0 10px 26px rgba(0,0,0,0.18)" : "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 16px 13px",
          }}
        >
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,0.06)",
                color: "#FFFFFF",
                cursor: "pointer",
                flexShrink: 0,
                boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
              }}
            >
              <i className="fas fa-arrow-left" style={{ fontSize: 18 }} />
            </button>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 29,
                lineHeight: 1.05,
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: "-0.02em",
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
              minWidth: 42,
              height: 42,
              borderRadius: 999,
              border: "none",
              background: "rgba(255,255,255,0.06)",
              color: "#FFFFFF",
              cursor: isProcessing || unreadCount === 0 ? "not-allowed" : "pointer",
              opacity: isProcessing || unreadCount === 0 ? 0.55 : 1,
              flexShrink: 0,
              padding: "0 13px",
              fontWeight: 800,
              fontSize: 13,
              boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
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
                padding: "16px 16px 8px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#FFFFFF",
                }}
              >
                New
              </div>
              <div
                style={{
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "rgba(24,119,242,0.16)",
                  color: "#7CC0FF",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {newCount}
              </div>
            </div>
            <div>{newNotifications.map(renderRow)}</div>
          </div>
        )}

        {visibleEarlierNotifications.length > 0 && (
          <div>
            <div
              style={{
                padding: "16px 16px 8px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#FFFFFF",
                }}
              >
                Earlier
              </div>
              <div
                style={{
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.06)",
                  color: "#A8B3BF",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {earlierCount}
              </div>
            </div>

            <div>{visibleEarlierNotifications.map(renderRow)}</div>

            {hasMoreEarlier && (
              <div style={{ padding: "14px 16px 22px" }}>
                <button
                  onClick={handleLoadMoreEarlier}
                  style={{
                    width: "100%",
                    height: 48,
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.04)",
                    color: "#FFFFFF",
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: "pointer",
                    backdropFilter: "blur(10px)",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.14)",
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
              padding: "40px 16px",
              textAlign: "center",
              color: "#9AA4AF",
              fontSize: 16,
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
            borderRadius: 12,
            padding: "11px 15px",
            fontSize: 14,
            fontWeight: 600,
            boxShadow: "0 10px 26px rgba(0,0,0,0.3)",
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
