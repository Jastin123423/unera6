// components/ChatsList.tsx
// Messenger-style chat list with UNERA dark theme colors

import React, { useEffect, useMemo, useState } from "react";
import { User } from "../types";

const apiFetch = async (url: string, options: RequestInit = {}, userId?: number) => {
  const token = localStorage.getItem("unera_token");
  const headers: HeadersInit = { 
    "Content-Type": "application/json", 
    ...(options.headers || {}) 
  };
  
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (userId) headers["x-user-id"] = String(userId);

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let msg = "API Error";
    try {
      const j = await res.json();
      msg = j?.error || j?.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
};

const safeStr = (v: any) => (typeof v === "string" ? v : "");
const safeNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const Avatar: React.FC<{ src?: string | null; name?: string; size?: number }> = ({ src, name = "", size = 52 }) => {
  const url = safeStr(src);
  const initials =
    (safeStr(name)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "U"
    ).slice(0, 2);

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

// Format message preview with attachment indicator
const formatMessagePreview = (message: string | null, hasAttachments: boolean): string => {
  if (hasAttachments) {
    return "📎 Attachment";
  }
  if (!message) return "";
  
  // Truncate long messages
  if (message.length > 50) {
    return message.substring(0, 50) + "...";
  }
  return message;
};

type ConversationRow = {
  id: number;
  // Who you chat with
  other_user_id: number;
  other_user_name?: string;
  other_user_profile_image_url?: string | null;

  // Last message details
  last_message_id?: number;
  last_message_text?: string | null;
  last_message_created_at?: string | null;
  last_message_sender_id?: number;
  last_message_has_attachments?: boolean;

  // Unread
  unread_count?: number;
  
  // Raw conversation data
  raw: any;
};

type ChatsListProps = {
  currentUser: User;
  // Called when you tap a chat row
  onOpenChat: (recipient: User) => void;

  // Optional: to open "New message requests"
  onOpenRequests?: () => void;

  // Optional: create new chat / search
  onNewChat?: () => void;
};

export const ChatsList: React.FC<ChatsListProps> = ({ currentUser, onOpenChat, onOpenRequests, onNewChat }) => {
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

  const currentUserId = safeNum(currentUser?.id);

  const fetchConversations = async () => {
    if (!currentUserId) return;
    
    try {
      setLoading(true);

      // Fetch conversations from API with user ID in headers
      const data = await apiFetch("/api/messages/conversations", {}, currentUserId);

      console.log("Conversations data:", data); // Debug log

      const arr: ConversationRow[] = Array.isArray(data)
        ? data.map((c: any) => {
            // Handle different possible response structures
            const lastMessage = c.last_message || {};
            
            return {
              id: safeNum(c?.id || c?.conversation_id),
              // Other user details - check various possible field names
              other_user_id: safeNum(c?.other_user_id || c?.recipient_id || c?.user_id),
              other_user_name: safeStr(c?.other_user_name || c?.recipient_name || c?.name || c?.user_name || "User"),
              other_user_profile_image_url: safeStr(c?.other_user_profile_image_url || c?.recipient_profile_image_url || c?.profile_image_url || c?.avatar) || null,
              
              // Last message details
              last_message_id: safeNum(lastMessage?.id || c?.last_message_id),
              last_message_text: safeStr(lastMessage?.text_content || c?.last_message_text || c?.last_message || c?.preview),
              last_message_created_at: safeStr(lastMessage?.created_at || c?.last_message_at || c?.updated_at || c?.created_at),
              last_message_sender_id: safeNum(lastMessage?.sender_id || c?.last_message_sender_id),
              last_message_has_attachments: !!(lastMessage?.attachments?.length > 0 || c?.has_attachments || c?.has_media),
              
              // Unread count
              unread_count: safeNum(c?.unread_count || c?.unread, 0),
              
              // Keep raw data
              raw: c,
            };
          })
        : [];

      // Sort by latest message
      arr.sort((a, b) => {
        const ta = a.last_message_created_at ? new Date(a.last_message_created_at).getTime() : 0;
        const tb = b.last_message_created_at ? new Date(b.last_message_created_at).getTime() : 0;
        return tb - ta;
      });

      console.log("Processed conversations:", arr); // Debug log
      setRows(arr);
      
      // Count message requests - you might want to fetch this from a separate endpoint
      // For now, we'll set it to 0 or implement based on your API
      setRequestCount(0);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const t = window.setInterval(fetchConversations, 5000); // Poll every 5 seconds
    return () => window.clearInterval(t);
  }, [currentUserId]); // Add currentUserId as dependency

  const totalUnread = useMemo(() => rows.reduce((sum, r) => sum + safeNum(r.unread_count, 0), 0), [rows]);

  const openRow = (r: ConversationRow) => {
    const recipient: User = {
      id: r.other_user_id,
      name: r.other_user_name || "User",
      profile_image_url: r.other_user_profile_image_url || null,
      // Add any other required User fields with defaults
      email: "",
      phone: "",
      role: "user",
      is_active: true,
      created_at: new Date().toISOString(),
    };
    onOpenChat(recipient);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-[#18191A] font-sans">
      {/* Top: "Text and Photos" + Buy Data */}
      <div className="h-14 px-3 flex items-center justify-between bg-[#242526] border-b border-[#3E4042]">
        <div className="text-[22px] font-extrabold text-[#E4E6EB]">Text and Photos</div>
        <button
          type="button"
          className="h-9 px-3 rounded-xl bg-[#3A3B3C] text-[#E4E6EB] font-semibold flex items-center gap-2 active:opacity-90 hover:bg-[#4E4F50] transition-colors"
          onClick={() => alert("Buy Data")}
        >
          <i className="fas fa-broadcast-tower text-[#B0B3B8]" />
          <span>Buy Data</span>
        </button>
      </div>

      {/* Tabs row (icons with badges) */}
      <div className="px-2 pb-2 bg-[#242526]">
        <div className="flex items-center justify-between">
          {[
            { icon: "fas fa-house", badge: totalUnread > 0 ? `${Math.min(totalUnread, 15)}+` : "" },
            { icon: "fas fa-user-group", badge: "" },
            { icon: "fab fa-facebook-messenger", badge: "", active: true },
            { icon: "fas fa-rectangle-list", badge: "" },
            { icon: "fas fa-truck-fast", badge: "" },
            { icon: "fas fa-store", badge: "" },
          ].map((t, idx) => {
            const active = t.active || idx === 2;
            return (
              <button
                key={idx}
                type="button"
                className={`relative w-[52px] h-[44px] rounded-xl flex items-center justify-center transition-colors ${
                  active ? "bg-[#3A3B3C]" : "bg-transparent hover:bg-[#3A3B3C]"
                }`}
                onClick={() => {}}
                aria-label="tab"
              >
                <i className={`${t.icon} text-[20px] ${active ? "text-[#1877F2]" : "text-[#B0B3B8]"}`} />
                {t.badge && (
                  <span className="absolute -top-1 right-1 bg-[#F3425F] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full border border-[#242526]">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main card */}
      <div className="bg-[#242526] rounded-t-2xl h-[calc(100%-112px)] overflow-hidden border-t border-[#3E4042] shadow-[0_-1px_0_rgba(0,0,0,0.2)]">
        {/* Header: back + "Messages" + gear + search */}
        <div className="px-3 pt-3 pb-2 flex items-center justify-between border-b border-[#3E4042]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#3A3B3C] transition-colors"
              onClick={() => {
                // If you want to close list, handle outside; for now do nothing.
              }}
              aria-label="Back"
            >
              <i className="fas fa-arrow-left text-[18px] text-[#E4E6EB]" />
            </button>
            <div className="text-[28px] font-extrabold text-[#E4E6EB] leading-none">Messages</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-10 h-10 rounded-full bg-[#3A3B3C] flex items-center justify-center hover:bg-[#4E4F50] transition-colors"
              aria-label="Settings"
              onClick={() => alert("Settings")}
            >
              <i className="fas fa-gear text-[18px] text-[#E4E6EB]" />
            </button>
            <button
              type="button"
              className="w-10 h-10 rounded-full bg-[#3A3B3C] flex items-center justify-center hover:bg-[#4E4F50] transition-colors"
              aria-label="Search"
              onClick={() => alert("Search")}
            >
              <i className="fas fa-magnifying-glass text-[18px] text-[#E4E6EB]" />
            </button>
          </div>
        </div>

        {/* "New message requests" row */}
        {requestCount > 0 && (
          <button
            type="button"
            onClick={() => onOpenRequests?.()}
            className="w-full px-3 py-3 flex items-center gap-3 hover:bg-[#3A3B3C] transition-colors border-b border-[#3E4042]"
          >
            <div className="relative w-10 h-10 rounded-full bg-[#3A3B3C] flex items-center justify-center">
              <i className="fas fa-comment-dots text-[18px] text-[#E4E6EB]" />
              <span className="absolute -top-1 -right-1 bg-[#F3425F] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full border border-[#242526]">
                {requestCount > 9 ? "9+" : requestCount}
              </span>
            </div>

            <div className="flex-1 text-left">
              <div className="text-[16px] font-bold text-[#E4E6EB]">New message requests</div>
            </div>

            <i className="fas fa-chevron-right text-[#B0B3B8]" />
          </button>
        )}

        {/* List */}
        <div className="overflow-y-auto h-[calc(100%-118px)] bg-[#242526]">
          {loading && rows.length === 0 ? (
            <div className="text-center text-[#B0B3B8] text-sm py-6">
              <i className="fas fa-spinner fa-spin text-2xl mb-2" />
              <p>Loading conversations...</p>
            </div>
          ) : null}

          {rows.map((r) => {
            const unread = safeNum(r.unread_count, 0);
            const name = r.other_user_name || "User";
            
            // Format the message preview
            const preview = r.last_message_text 
              ? formatMessagePreview(r.last_message_text, r.last_message_has_attachments)
              : r.last_message_has_attachments 
                ? "📎 Attachment" 
                : "No messages yet";
            
            // Check if the last message was sent by current user
            const isLastMessageFromMe = r.last_message_sender_id === currentUserId;
            const fromMePrefix = isLastMessageFromMe ? "You: " : "";
            
            const time = r.last_message_created_at ? formatRelative(r.last_message_created_at) : "";

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => openRow(r)}
                className="w-full px-3 py-3 flex items-center gap-3 hover:bg-[#3A3B3C] transition-colors"
              >
                <Avatar src={r.other_user_profile_image_url} name={name} size={52} />

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-[16px] truncate ${unread > 0 ? "font-extrabold text-[#E4E6EB]" : "font-semibold text-[#E4E6EB]"}`}>
                      {name}
                    </div>
                    <div className={`text-[13px] ${unread > 0 ? "text-[#1877F2] font-bold" : "text-[#B0B3B8]"}`}>{time}</div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className={`text-[14px] truncate ${unread > 0 ? "text-[#E4E6EB] font-semibold" : "text-[#B0B3B8]"}`}>
                      {unread > 0 ? `${fromMePrefix}${preview}` : `${fromMePrefix}${preview}`}
                    </div>

                    {unread > 0 ? (
                      <div className="w-6 h-6 rounded-full bg-[#1877F2] flex items-center justify-center border border-[#242526]">
                        <span className="text-white text-[12px] font-extrabold">{unread > 9 ? "9+" : unread}</span>
                      </div>
                    ) : isLastMessageFromMe ? (
                      <div className="w-6 h-6 flex items-center justify-center">
                        {/* Seen/Delivered indicator - you can enhance this based on read receipts */}
                        <div className="w-5 h-5 rounded-full border border-[#1877F2] flex items-center justify-center bg-[#242526]">
                          <i className="fas fa-check text-[10px] text-[#1877F2]" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-6 h-6" /> // Empty spacer
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {!loading && rows.length === 0 ? (
            <div className="text-center text-[#B0B3B8] text-sm py-10">
              <i className="fas fa-comment-slash text-3xl mb-2 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-xs mt-1">Start chatting with someone!</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Floating + button */}
      <button
        type="button"
        onClick={() => onNewChat?.()}
        className="fixed right-5 bottom-6 w-14 h-14 rounded-full bg-[#1877F2] shadow-lg flex items-center justify-center hover:bg-[#166FE5] transition-colors active:scale-95"
        aria-label="New chat"
      >
        <i className="fas fa-plus text-white text-[22px]" />
      </button>
    </div>
  );
}; e
