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
  if (userId) headers["x-user-id"] = String(userId);

  const res = await fetch(url, { ...options, headers });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
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
  onOpenHome?: () => void;
  onOpenMarketplace?: () => void;
  feedNotificationCount?: number;
  messageNotificationCount?: number;
};

// Scrollbar hide styles
const scrollbarHideStyles = `
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

if (typeof document !== 'undefined') {
  const styleId = 'chatslist-scrollbar-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = scrollbarHideStyles;
    document.head.appendChild(style);
  }
}

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
  const [following, setFollowing] = useState<User[]>([]);
  
  // New message modal state
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newMessageQuery, setNewMessageQuery] = useState('');

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

  const fetchFollowing = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const data = await apiFetch("/api/messages/following", {}, currentUserId);
      const users: User[] = Array.isArray(data)
        ? data.map((u: any) => ({
            id: safeNum(u?.id, 0),
            name: safeStr(u?.name || "User"),
            profile_image_url: safeStr(u?.profile_image_url) || safeStr(u?.profile_image_url_) || null,
            profile_image_url_: safeStr(u?.profile_image_url) || safeStr(u?.profile_image_url_) || null,
            is_online: safeNum(u?.is_online, 0) === 1,
            last_seen: u?.last_seen ? safeStr(u.last_seen) : null,
          }))
        : [];
      setFollowing(users);
    } catch (e) {
      console.error("Failed to fetch following:", e);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchConversations();
    fetchFollowing();
    const t = window.setInterval(fetchConversations, 5000);
    return () => window.clearInterval(t);
  }, [fetchConversations, fetchFollowing]);

  const totalUnread = useMemo(() => rows.reduce((sum, r) => sum + safeNum(r.unread_count, 0), 0), [rows]);

  // Filtered following for search
  const filteredFollowing = useMemo(() => {
    const q = safeStr(newMessageQuery).trim().toLowerCase();
    if (!q) return following;
    return following.filter((u: any) => 
      safeStr(u?.name).toLowerCase().includes(q)
    );
  }, [following, newMessageQuery]);

  const openRow = (r: ConversationRow) => {
    const recipient = {
      id: r.other_user_id,
      name: r.other_name,
      profile_image_url: r.other_profile_image_url,
      profile_image_url_: r.other_profile_image_url,
    } as any as User;

    onOpenChat(recipient);
  };

  return (
    // 🔥 FIX 1: Back to fixed inset-0 overlay mode
    <div className="fixed inset-0 z-[150] bg-[#18191A] font-sans flex flex-col">
      
      {/* 🔥 FIX 2: Removed min-h-0, kept flex-1 */}
      <div className="bg-[#242526] flex-1 flex flex-col overflow-hidden">
        
        {/* Sticky header */}
        <div className="sticky top-0 z-20 px-3 pt-3 pb-2 flex items-center border-b border-[#3E4042] bg-[#242526]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#3A3B3C] transition-colors"
              onClick={() => {
                if (onClose) onClose();
              }}
              aria-label="Back"
            >
              <i className="fas fa-arrow-left text-[18px] text-[#E4E6EB]" />
            </button>
            <div className="text-[28px] font-extrabold text-[#E4E6EB] leading-none">Chats</div>
          </div>
        </div>

        {/* Top horizontal users (Facebook style) */}
        <div className="px-3 py-3 border-b border-[#3E4042] bg-[#242526]">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide">
            {/* Your note (self) */}
            <div className="flex flex-col items-center min-w-[60px]">
              <div className="relative">
                <Avatar 
                  src={currentUser.profile_image_url} 
                  name={currentUser.name} 
                  size={52} 
                />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#31A24C] rounded-full border-2 border-[#242526]" />
              </div>
              <span className="text-[12px] text-[#E4E6EB] mt-1 truncate w-[60px] text-center">
                You
              </span>
            </div>

            {/* Following users */}
            {following.map((u) => (
              <div 
                key={u.id} 
                onClick={() => onOpenChat(u)} 
                className="flex flex-col items-center min-w-[60px] cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="relative">
                  <Avatar 
                    src={u.profile_image_url} 
                    name={u.name} 
                    size={52} 
                  />
                  {(u as any).is_online && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#31A24C] rounded-full border-2 border-[#242526]" />
                  )}
                </div>
                <span className="text-[12px] text-[#E4E6EB] mt-1 truncate w-[60px] text-center">
                  {u.name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Message Requests section */}
        {onOpenRequests && (
          <div 
            className="mx-3 my-2 p-3 bg-[#3A3B3C] rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#4E4F50] transition-colors"
            onClick={onOpenRequests}
          >
            <div className="flex items-center gap-2">
              <i className="fas fa-user-clock text-[#E4E6EB]" />
              <span className="text-[#E4E6EB] font-semibold">Message requests</span>
            </div>
            <span className="text-[#1877F2] font-bold text-sm">9+</span>
          </div>
        )}

        {/* Scrollable conversation area */}
        <div className="flex-1 overflow-y-auto bg-[#242526]">
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

      {/* 🔥 FIX 3: Fixed plus button with higher z-index */}
      {onNewChat !== undefined && (
        <button
          onClick={() => setShowNewMessage(true)}
          className="fixed bottom-6 right-6 z-[160] w-14 h-14 rounded-full bg-[#1877F2] text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 hover:bg-[#166FE5]"
          aria-label="New chat"
        >
          <i className="fas fa-plus text-xl" />
        </button>
      )}

      {/* 🔥 FIX 4: Fixed New Message modal with higher z-index */}
      {showNewMessage && (
        <div className="fixed inset-0 z-[170] bg-[#242526] flex flex-col">
          {/* Sticky header with search */}
          <div className="sticky top-0 z-10 bg-[#242526] border-b border-[#3E4042] px-3 py-3">
            <div className="flex items-center gap-3 mb-3">
              <button
                type="button"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#3A3B3C] transition-colors"
                onClick={() => {
                  setShowNewMessage(false);
                  setNewMessageQuery('');
                }}
                aria-label="Back"
              >
                <i className="fas fa-arrow-left text-[18px] text-[#E4E6EB]" />
              </button>
              <div className="text-[22px] font-extrabold text-[#E4E6EB] leading-none">
                New message
              </div>
            </div>
            
            {/* Search input */}
            <div className="relative">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#B0B3B8]"></i>
              <input
                type="text"
                value={newMessageQuery}
                onChange={(e) => setNewMessageQuery(e.target.value)}
                placeholder="Type a name"
                className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-full py-3 pl-11 pr-4 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
              />
            </div>
          </div>

          {/* Scrollable user list */}
          <div className="flex-1 overflow-y-auto">
            {filteredFollowing.map((u: any) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setShowNewMessage(false);
                  setNewMessageQuery('');
                  onOpenChat(u);
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#3A3B3C] transition-colors text-left"
              >
                <Avatar src={u.profile_image_url} name={u.name} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="text-[#E4E6EB] font-semibold text-[17px] truncate">
                    {u.name}
                  </div>
                </div>
              </button>
            ))}
            
            {filteredFollowing.length === 0 && (
              <div className="text-center text-[#B0B3B8] text-sm py-10">
                No people found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
