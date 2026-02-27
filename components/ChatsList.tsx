// components/ChatsList.tsx
// Messenger-style chat list (matches your screenshot: "Text and Photos" header, tabs row, "New message requests", list with avatars + preview + unread badges)

import React, { useEffect, useMemo, useState } from "react";
import { User } from "../types";

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("unera_token");
  const headers: HeadersInit = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) throw new Error("API Error");
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
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={(e) => {
          const img = e.currentTarget;
          img.onerror = null;
          img.src =
            "data:image/svg+xml;charset=utf-8," +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
                <rect width="100%" height="100%" fill="#E5E7EB"/>
                <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="${Math.max(
                  14,
                  Math.floor(size * 0.36)
                )}" font-family="Arial" fill="#111827">${initials}</text>
              </svg>`
            );
        }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-gray-200 flex items-center justify-center text-gray-800 font-semibold"
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

type ConversationRow = {
  id: number;
  // Who you chat with
  recipient_id: number;
  recipient_name?: string;
  recipient_profile_image_url?: string | null;

  // Preview
  last_message?: string | null;
  last_message_at?: string | null;

  // Unread
  unread_count?: number;
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

  const fetchConversations = async () => {
    try {
      setLoading(true);

      // Expecting /api/messages/conversations returns an array
      // If your backend returns different keys, adjust mapping below.
      const data = await apiFetch("/api/messages/conversations");

      const arr: ConversationRow[] = Array.isArray(data)
        ? data.map((c: any) => ({
            id: safeNum(c?.id),
            recipient_id: safeNum(c?.recipient_id),
            recipient_name: safeStr(c?.recipient_name || c?.name),
            recipient_profile_image_url: safeStr(c?.recipient_profile_image_url || c?.profile_image_url) || null,
            last_message: safeStr(c?.last_message || c?.last_text || c?.preview) || null,
            last_message_at: safeStr(c?.last_message_at || c?.updated_at || c?.created_at) || null,
            unread_count: safeNum(c?.unread_count, 0),
          }))
        : [];

      // Sort by latest
      arr.sort((a, b) => {
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return tb - ta;
      });

      setRows(arr);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const t = window.setInterval(fetchConversations, 8000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalUnread = useMemo(() => rows.reduce((sum, r) => sum + safeNum(r.unread_count, 0), 0), [rows]);

  const openRow = (r: ConversationRow) => {
    const recipient: User = {
      ...(recipient as any),
      id: r.recipient_id,
      name: r.recipient_name || "User",
      profile_image_url: r.recipient_profile_image_url || null,
    } as any;

    // Note: we only need id/name/avatar for ChatWindow
    onOpenChat(recipient);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-[#F0F2F5] font-sans">
      {/* Top: "Text and Photos" + Buy Data */}
      <div className="h-14 px-3 flex items-center justify-between bg-[#F0F2F5]">
        <div className="text-[22px] font-extrabold text-black">Text and Photos</div>
        <button
          type="button"
          className="h-9 px-3 rounded-xl bg-[#E4E6EB] text-black font-semibold flex items-center gap-2 active:opacity-90"
          onClick={() => alert("Buy Data")}
        >
          <i className="fas fa-broadcast-tower" />
          <span>Buy Data</span>
        </button>
      </div>

      {/* Tabs row (icons with red 15+ badges) */}
      <div className="px-2 pb-2">
        <div className="bg-[#F0F2F5] flex items-center justify-between">
          {[
            { icon: "fas fa-house", badge: "15+" },
            { icon: "fas fa-user-group", badge: "" },
            { icon: "fab fa-facebook-messenger", badge: "" }, // selected
            { icon: "fas fa-rectangle-list", badge: "15+" },
            { icon: "fas fa-truck-fast", badge: "15+" },
            { icon: "fas fa-store", badge: "" },
          ].map((t, idx) => {
            const active = idx === 2;
            return (
              <button
                key={idx}
                type="button"
                className={`relative w-[52px] h-[44px] rounded-xl flex items-center justify-center ${
                  active ? "bg-white" : "bg-transparent"
                }`}
                onClick={() => {}}
                aria-label="tab"
              >
                <i className={`${t.icon} text-[20px] ${active ? "text-[#1877F2]" : "text-gray-600"}`} />
                {t.badge ? (
                  <span className="absolute -top-1 right-1 bg-red-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                    {t.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-t-2xl h-[calc(100%-112px)] overflow-hidden shadow-[0_-1px_0_rgba(0,0,0,0.06)]">
        {/* Header: back + "Messages" + gear + search */}
        <div className="px-3 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100"
              onClick={() => {
                // If you want to close list, handle outside; for now do nothing.
              }}
              aria-label="Back"
            >
              <i className="fas fa-arrow-left text-[18px] text-black" />
            </button>
            <div className="text-[28px] font-extrabold text-black leading-none">Messages</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-10 h-10 rounded-full bg-[#E4E6EB] flex items-center justify-center active:opacity-90"
              aria-label="Settings"
              onClick={() => alert("Settings")}
            >
              <i className="fas fa-gear text-[18px] text-black" />
            </button>
            <button
              type="button"
              className="w-10 h-10 rounded-full bg-[#E4E6EB] flex items-center justify-center active:opacity-90"
              aria-label="Search"
              onClick={() => alert("Search")}
            >
              <i className="fas fa-magnifying-glass text-[18px] text-black" />
            </button>
          </div>
        </div>

        {/* "New message requests" row */}
        <button
          type="button"
          onClick={() => onOpenRequests?.()}
          className="w-full px-3 py-3 flex items-center gap-3 active:bg-gray-50"
        >
          <div className="relative w-10 h-10 rounded-full bg-[#E4E6EB] flex items-center justify-center">
            <i className="fas fa-comment-dots text-[18px] text-black" />
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">
              5
            </span>
          </div>

          <div className="flex-1 text-left">
            <div className="text-[16px] font-bold text-black">New message requests</div>
          </div>

          <i className="fas fa-chevron-right text-gray-400" />
        </button>

        <div className="h-[1px] bg-gray-200" />

        {/* List */}
        <div className="overflow-y-auto h-[calc(100%-118px)]">
          {loading && rows.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-6">Loading…</div>
          ) : null}

          {rows.map((r) => {
            const unread = safeNum(r.unread_count, 0);
            const name = r.recipient_name || "User";
            const preview = r.last_message ? r.last_message : " ";
            const time = r.last_message_at ? formatRelative(r.last_message_at) : "";

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => openRow(r)}
                className="w-full px-3 py-3 flex items-center gap-3 active:bg-gray-50"
              >
                <Avatar src={r.recipient_profile_image_url} name={name} size={52} />

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-[16px] truncate ${unread > 0 ? "font-extrabold text-black" : "font-semibold text-black"}`}>
                      {name}
                    </div>
                    <div className={`text-[13px] ${unread > 0 ? "text-[#1877F2] font-bold" : "text-gray-500"}`}>{time}</div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className={`text-[14px] truncate ${unread > 0 ? "text-black font-semibold" : "text-gray-600"}`}>
                      {unread > 0 ? `You: ${preview}` : preview}
                    </div>

                    {unread > 0 ? (
                      <div className="w-6 h-6 rounded-full bg-[#1877F2] flex items-center justify-center">
                        <span className="text-white text-[12px] font-extrabold">{unread > 9 ? "9+" : unread}</span>
                      </div>
                    ) : (
                      <div className="w-6 h-6 flex items-center justify-center">
                        {/* Seen check */}
                        <div className="w-5 h-5 rounded-full border border-[#1877F2] flex items-center justify-center">
                          <i className="fas fa-check text-[10px] text-[#1877F2]" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {!loading && rows.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-10">No conversations yet</div>
          ) : null}
        </div>
      </div>

      {/* Floating + button */}
      <button
        type="button"
        onClick={() => onNewChat?.()}
        className="fixed right-5 bottom-6 w-14 h-14 rounded-full bg-[#1877F2] shadow-lg flex items-center justify-center active:opacity-90"
        aria-label="New chat"
      >
        <i className="fas fa-plus text-white text-[22px]" />
      </button>
    </div>
  );
};
