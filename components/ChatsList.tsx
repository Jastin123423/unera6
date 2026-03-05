// components/ChatsList.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { User } from "../types";

const safeStr = (v: any) => (typeof v === "string" ? v : "");
const safeNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const apiFetch = async (url: string, options: RequestInit = {}, userId?: number) => {
  const token = localStorage.getItem("unera_token");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;
  // TEMP while backend uses header auth
  if (userId) headers["x-user-id"] = String(userId);

  const res = await fetch(url, { ...options, headers });

  // IMPORTANT: prevent “blank app” from uncaught JSON parse errors
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // If server returns HTML, show it in error to debug quickly
    throw new Error(`Non-JSON response (${res.status}). First 80 chars: ${text.slice(0, 80)}`);
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `API Error (${res.status})`);
  }

  return data;
};

const formatRelative = (v: any) => {
  const s = safeStr(v);
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";

  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
};

const Avatar: React.FC<{ src?: string | null; name?: string; size?: number }> = ({ src, name = "", size = 52 }) => {
  const url = safeStr(src);
  const initials =
    (safeStr(name)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "U").slice(0, 2);

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="rounded-full object-cover border border-[#3E4042]"
        style={{ width: size, height: size }}
        onError={(e) => {
          const img = e.currentTarget;
          img.onerror = null;
          img.src =
            "data:image/svg+xml;charset=utf-8," +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
                <rect width="100%" height="100%" fill="#3A3B3C"/>
                <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="${Math.max(
                  14,
                  Math.floor(size * 0.36)
                )}" font-family="Arial" fill="#E4E6EB">${initials}</text>
              </svg>`
            );
        }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-[#3A3B3C] flex items-center justify-center text-[#E4E6EB] font-semibold border border-[#4E4F50]"
      style={{ width: size, height: size, fontSize: Math.max(14, Math.floor(size * 0.36)) }}
      aria-label={name}
      title={name}
    >
      {initials}
    </div>
  );
};

type ConversationRow = {
  id: number;
  other_user_id: number;
  other_name: string;
  other_profile_image_url: string | null;
  last_text_preview: string;
  last_message_at: string | null;
  unread_count: number;
};

type ChatsListProps = {
  currentUser: User;
  onOpenChat: (recipient: User) => void;
  onClose?: () => void;
  onOpenRequests?: () => void;
  onNewChat?: () => void;
  // Navigation handlers
  onOpenHome?: () => void;
  onOpenMarketplace?: () => void;
  // Notification counts
  feedNotificationCount?: number;
  messageNotificationCount?: number;
};

export const ChatsList: React.FC<ChatsListProps> = ({ 
  currentUser, 
  onOpenChat, 
  onClose, 
  onOpenRequests, 
  onNewChat,
  onOpenHome,
  onOpenMarketplace,
  feedNotificationCount = 0,
  messageNotificationCount = 0
}) => {
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string>("");

  const currentUserId = safeNum((currentUser as any)?.id, 0);

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return;
    try {
      setErrorText("");
      setLoading(true);

      const data = await apiFetch("/api/messages/conversations", {}, currentUserId);

      const arr: ConversationRow[] = Array.isArray(data)
        ? data.map((c: any) => ({
            id: safeNum(c?.id, 0),
            other_user_id: safeNum(c?.other_user_id, 0),
            other_name: safeStr(c?.other_name || "User"),
            other_profile_image_url: safeStr(c?.other_profile_image_url) || null,
            last_text_preview: safeStr(c?.last_text_preview || ""),
            last_message_at: safeStr(c?.last_message_at || c?.last_message_at || null),
            unread_count: safeNum(c?.unread_count, 0),
          }))
        : [];

      // sort newest first
      arr.sort((a, b) => {
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return tb - ta;
      });

      setRows(arr);
    } catch (e: any) {
      console.error("ChatsList fetchConversations error:", e?.message || e);
      setErrorText(e?.message || "Failed to load conversations");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchConversations();
    const t = window.setInterval(fetchConversations, 5000);
    return () => window.clearInterval(t);
  }, [fetchConversations]);

  const totalUnread = useMemo(() => rows.reduce((sum, r) => sum + safeNum(r.unread_count, 0), 0), [rows]);

  const openRow = (r: ConversationRow) => {
    // IMPORTANT: Don’t create fake full User objects (it can crash other places).
    const recipient = {
      id: r.other_user_id,
      name: r.other_name,
      profile_image_url: r.other_profile_image_url,
      profile_image_url: r.other_profile_image_url, // keep both keys for compatibility if your app uses either
      profile_image_url_: r.other_profile_image_url,
    } as any as User;

    onOpenChat(recipient);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-[#18191A] font-sans">
      {/* Top bar - REMOVED Buy Data button, only showing title */}
      <div className="h-14 px-3 flex items-center bg-[#242526] border-b border-[#3E4042]">
        <div className="text-[22px] font-extrabold text-[#E4E6EB]">Messages</div>
      </div>

      {/* Main card */}
      <div className="bg-[#242526] h-[calc(100%-56px)] overflow-hidden">
        {/* Header with back button only */}
        <div className="px-3 pt-3 pb-2 flex items-center border-b border-[#3E4042]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#3A3B3C] transition-colors"
              onClick={() => {
                // Call onClose to go back to previous page (homepage)
                if (onClose) {
                  onClose();
                } else {
                  // Fallback: try to navigate back in history
                  window.history.back();
                }
              }}
              aria-label="Back"
            >
              <i className="fas fa-arrow-left text-[18px] text-[#E4E6EB]" />
            </button>
            <div className="text-[28px] font-extrabold text-[#E4E6EB] leading-none">Chats</div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-64px)] bg-[#242526]">
          {errorText ? (
            <div className="px-3 py-3 text-[#ff6b6b] text-sm border-b border-[#3E4042]">
              {errorText}
            </div>
          ) : null}

          {loading && rows.length === 0 ? (
            <div className="text-center text-[#B0B3B8] text-sm py-8">
              <i className="fas fa-spinner fa-spin text-2xl mb-2" />
              <p>Loading conversations...</p>
            </div>
          ) : null}

          {rows.map((r) => {
            const unread = safeNum(r.unread_count, 0);
            const name = r.other_name || "User";
            const preview = r.last_text_preview || "No messages yet";
            const time = r.last_message_at ? formatRelative(r.last_message_at) : "";

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => openRow(r)}
                className="w-full px-3 py-3 flex items-center gap-3 hover:bg-[#3A3B3C] transition-colors"
              >
                <Avatar src={r.other_profile_image_url} name={name} size={52} />

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-[16px] truncate ${unread > 0 ? "font-extrabold text-[#E4E6EB]" : "font-semibold text-[#E4E6EB]"}`}>
                      {name}
                    </div>
                    <div className={`text-[13px] ${unread > 0 ? "text-[#1877F2] font-bold" : "text-[#B0B3B8]"}`}>{time}</div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className={`text-[14px] truncate ${unread > 0 ? "text-[#E4E6EB] font-semibold" : "text-[#B0B3B8]"}`}>
                      {preview}
                    </div>

                    {unread > 0 ? (
                      <div className="w-6 h-6 rounded-full bg-[#1877F2] flex items-center justify-center border border-[#242526]">
                        <span className="text-white text-[12px] font-extrabold">{unread > 9 ? "9+" : unread}</span>
                      </div>
                    ) : (
                      <div className="w-6 h-6" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {!loading && rows.length === 0 && !errorText ? (
            <div className="text-center text-[#B0B3B8] text-sm py-10">
              <i className="fas fa-comment-slash text-3xl mb-2 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-xs mt-1">Start chatting with someone!</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* REMOVED: Floating + button completely */}

      {/* Optional requests button (if you wire it later) */}
      {onOpenRequests ? (
        <button
          type="button"
          onClick={() => onOpenRequests()}
          className="hidden"
          aria-label="Requests"
        />
      ) : null}
    </div>
  );
};
