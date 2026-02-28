// components/Chat.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { User, Message } from "../types";
import { StickerPicker, EmojiPicker } from "./Pickers";

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("unera_token");
  const headers: HeadersInit = { "Content-Type": "application/json", ...(options.headers || {}) };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  // TEMP: if you are not verifying JWT yet, you can pass user id for now (remove once auth is real)
  // headers["x-user-id"] = String((window as any).__currentUserId || "");

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) throw new Error("API Error");
  return res.json();
};

const safeStr = (v: any) => (typeof v === "string" ? v : "");
const safeNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const parseDate = (v: any) => {
  const s = safeStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const formatDayLabel = (d: Date) =>
  d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });

const formatTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const Avatar: React.FC<{ src?: string | null; name?: string; size?: number; className?: string }> = ({
  src,
  name = "",
  size = 40,
  className = "",
}) => {
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
        className={`rounded-full object-cover ${className}`}
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
                  Math.floor(size * 0.38)
                )}" font-family="Arial" fill="#E4E6EB">${initials}</text>
              </svg>`
            );
        }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-[#3A3B3C] flex items-center justify-center text-[#E4E6EB] font-semibold ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(14, Math.floor(size * 0.38)) }}
      aria-label={name}
      title={name}
    >
      {initials}
    </div>
  );
};

type ChatWindowProps = {
  currentUser: User;
  recipient: User;
  onClose: () => void;
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ currentUser, recipient, onClose }) => {
  const [inputText, setInputText] = useState("");
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number>(0);

  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  const scrollToBottom = (smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 240;
    if (nearBottom) messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  const markRead = async (convId: number) => {
    if (!convId) return;
    try {
      await apiFetch("/api/messages/mark-read", {
        method: "POST",
        body: JSON.stringify({ conversation_id: convId }),
      });
    } catch {
      // ignore
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);

      const conversations = await apiFetch("/api/messages/conversations");
      const conv = Array.isArray(conversations)
        ? conversations.find((c: any) => safeNum(c?.other_user_id) === safeNum(recipient?.id))
        : null;

      const cid = safeNum(conv?.id, 0);
      setConversationId(cid);

      if (cid) {
        const history = await apiFetch(`/api/messages/conversations/${cid}`);
        setMsgs(Array.isArray(history) ? history : []);
        // mark as read in background
        markRead(cid);
      } else {
        setMsgs([]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(fetchHistory, 5000);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipient?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipient?.id]);

  useEffect(() => {
    scrollToBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs.length]);

  const normalized = useMemo(() => {
    const arr = Array.isArray(msgs) ? [...msgs] : [];
    arr.sort((a: any, b: any) => {
      const da = parseDate(a?.created_at);
      const db = parseDate(b?.created_at);
      if (da && db) return da.getTime() - db.getTime();
      return safeNum(a?.id) - safeNum(b?.id);
    });
    return arr;
  }, [msgs]);

  const rows = useMemo(() => {
    const out: Array<{ type: "day" | "msg"; key: string; day?: string; msg?: Message }> = [];
    let lastDay = "";
    for (const m of normalized) {
      const d = parseDate((m as any)?.created_at) || null;
      const dk = d ? dayKey(d) : "";
      if (dk && dk !== lastDay) {
        lastDay = dk;
        out.push({ type: "day", key: `day:${dk}`, day: formatDayLabel(d!) });
      }
      out.push({ type: "msg", key: `msg:${safeNum((m as any)?.id)}:${Math.random().toString(16).slice(2)}`, msg: m });
    }
    return out;
  }, [normalized]);

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setShowEmoji(false);
    setShowStickers(false);

    try {
      const data = await apiFetch("/api/messages/send", {
        method: "POST",
        body: JSON.stringify({ recipient_id: recipient.id, text_content: trimmed }),
      });

      // data is the inserted message row
      setMsgs((prev) => [...prev, data]);
      setInputText("");

      // If conversation was newly created, refresh to get conversation id + receipts
      if (!conversationId) fetchHistory();
    } catch {
      alert("Failed to send");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendText(inputText);
  };

  const canSend = inputText.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[200] bg-[#1e1e1e] flex flex-col font-sans">
      <div className="h-14 px-3 flex items-center justify-between border-b border-[#333] bg-[#1e1e1e]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d] transition-colors"
            aria-label="Back"
          >
            <i className="fas fa-arrow-left text-[18px] text-[#e4e6eb]" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <Avatar src={(recipient as any)?.profile_image_url} name={(recipient as any)?.name} size={36} />
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-[#e4e6eb] truncate">{safeStr((recipient as any)?.name)}</div>
              <div className="text-[12px] text-[#b0b3b8] truncate">Active now</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d]" aria-label="Call">
            <i className="fas fa-phone text-[18px] text-[#1B74E4]" />
          </button>
          <button type="button" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d]" aria-label="Video">
            <i className="fas fa-video text-[18px] text-[#1B74E4]" />
          </button>
          <button type="button" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d]" aria-label="Info">
            <i className="fas fa-circle-info text-[18px] text-[#1B74E4]" />
          </button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 bg-[#1e1e1e]">
        {loading && msgs.length === 0 ? <div className="text-center text-[#b0b3b8] text-sm py-6">Loading…</div> : null}

        {rows.map((r) => {
          if (r.type === "day") {
            return (
              <div key={r.key} className="flex items-center justify-center my-3">
                <div className="text-[12px] text-[#b0b3b8] bg-[#2d2d2d] px-3 py-1 rounded-full">{r.day}</div>
              </div>
            );
          }

          const msg = r.msg as any;
          const mine = safeNum(msg?.sender_id) === safeNum((currentUser as any)?.id);
          const text = safeStr(msg?.text_content);
          const d = parseDate(msg?.created_at);

          return (
            <div key={r.key} className={`w-full flex ${mine ? "justify-end" : "justify-start"} mb-1.5`}>
              <div className={`max-w-[78%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={[
                    "px-3 py-2 text-[16px] leading-snug",
                    "rounded-2xl",
                    mine ? "bg-[#1B74E4] text-white rounded-br-md" : "bg-[#3A3B3C] text-[#e4e6eb] rounded-bl-md",
                  ].join(" ")}
                >
                  {text || <span className="opacity-60">…</span>}
                </div>

                {d ? <div className="text-[11px] text-[#b0b3b8] mt-0.5 px-1 select-none">{formatTime(d)}</div> : null}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {(showEmoji || showStickers) && (
        <div className="border-t border-[#333] bg-[#1e1e1e]">
          {showEmoji ? (
            <div className="p-2">
              <EmojiPicker onSelect={(emoji: string) => setInputText((p) => (p ? `${p}${emoji}` : emoji))} />
            </div>
          ) : null}

          {showStickers ? (
            <div className="p-2">
              <StickerPicker
                onSelect={(stickerText: string) => {
                  sendText(stickerText);
                }}
              />
            </div>
          ) : null}
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-[#333] bg-[#1e1e1e] px-2 py-2">
        <div className="flex items-end gap-2">
          <div className="flex items-center gap-1">
            <button type="button" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d]" aria-label="Camera">
              <i className="fas fa-camera text-[18px] text-[#1B74E4]" />
            </button>

            <button type="button" className="px-2 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d]" aria-label="GIF">
              <span className="text-[13px] font-bold text-[#1B74E4]">GIF</span>
            </button>

            <button
              type="button"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d]"
              aria-label="Stickers"
              onClick={() => {
                setShowStickers((v) => !v);
                setShowEmoji(false);
              }}
            >
              <i className="fas fa-face-smile text-[18px] text-[#1B74E4]" />
            </button>
          </div>

          <div className="flex-1 bg-[#2d2d2d] rounded-full px-3 py-2 flex items-center gap-2">
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Message"
              className="flex-1 bg-transparent outline-none text-[15px] text-[#e4e6eb] placeholder:text-[#b0b3b8]"
            />

            <button
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3a3a3a]"
              aria-label="Emoji"
              onClick={() => {
                setShowEmoji((v) => !v);
                setShowStickers(false);
              }}
            >
              <i className="far fa-smile text-[18px] text-[#1B74E4]" />
            </button>

            <button type="button" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3a3a3a]" aria-label="Voice">
              <i className="fas fa-microphone text-[18px] text-[#1B74E4]" />
            </button>
          </div>

          {canSend ? (
            <button type="submit" className="w-10 h-10 rounded-full bg-[#1B74E4] flex items-center justify-center hover:bg-[#1A6ED8]" aria-label="Send">
              <i className="fas fa-paper-plane text-[16px] text-white" />
            </button>
          ) : (
            <button type="button" className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#2d2d2d]" aria-label="Like" onClick={() => sendText("👍")}>
              <i className="fas fa-thumbs-up text-[20px] text-[#1B74E4]" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
