// components/Chat.tsx
// Messenger-style full-screen chat window (mobile) with:
// ✅ Backend integration (conversations list + messages + send + mark-read)
// ✅ Long-press message actions popup:
//    - Other's message: Forward, Reply, Delete (for me)
//    - My message: Forward, Reply, Edit, Delete (for me), Delete for everyone
// ✅ Composer fixed for mobile: buttons always visible (safe-area + no overflow)

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { User, Message } from "../types";
import { StickerPicker, EmojiPicker } from "./Pickers";

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("unera_token");
  const headers: HeadersInit = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // TEMP (only if you still test with x-user-id):
  // const testId = (window as any).__currentUserId;
  // if (testId) headers["x-user-id"] = String(testId);

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
  onSendMessage?: (t: string, s?: string) => void; // optional external hook (kept)
};

type ActionModalState =
  | null
  | {
      msg: any;
      mine: boolean;
      x: number;
      y: number;
    };

export const ChatWindow: React.FC<ChatWindowProps> = ({ currentUser, recipient, onClose, onSendMessage }) => {
  const [inputText, setInputText] = useState("");
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number>(0);

  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);

  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);

  const [actionModal, setActionModal] = useState<ActionModalState>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);

  const scrollToBottom = (smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 240;
    if (nearBottom) messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  const markRead = useCallback(
    async (convId: number) => {
      if (!convId) return;
      try {
        await apiFetch("/api/messages/mark-read", {
          method: "POST",
          body: JSON.stringify({ conversation_id: convId }),
        });
      } catch {
        // ignore
      }
    },
    []
  );

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);

      const conversations = await apiFetch("/api/messages/conversations");
      const conv = Array.isArray(conversations)
        ? conversations.find((c: any) => safeNum(c?.other_user_id) === safeNum((recipient as any)?.id))
        : null;

      const cid = safeNum(conv?.id, 0);
      setConversationId(cid);

      if (cid) {
        const history = await apiFetch(`/api/messages/conversations/${cid}`);
        setMsgs(Array.isArray(history) ? history : []);
        markRead(cid);
      } else {
        setMsgs([]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [recipient?.id, markRead]);

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
    const out: Array<{ type: "day" | "msg"; key: string; day?: string; msg?: any }> = [];
    let lastDay = "";
    for (const m of normalized as any[]) {
      const d = parseDate(m?.created_at) || null;
      const dk = d ? dayKey(d) : "";
      if (dk && dk !== lastDay) {
        lastDay = dk;
        out.push({ type: "day", key: `day:${dk}`, day: formatDayLabel(d!) });
      }
      out.push({ type: "msg", key: `msg:${safeNum(m?.id)}:${Math.random().toString(16).slice(2)}`, msg: m });
    }
    return out;
  }, [normalized]);

  const buildForwardPayload = (m: any) => {
    // Forward as best-effort:
    // If has attachment_url, send attachment too; else forward text.
    const text = safeStr(m?.text_content);
    const attUrl = safeStr(m?.attachment_url);
    const attType = safeStr(m?.attachment_type);
    const attMeta = m?.attachment_metadata ?? null;

    if (attUrl) {
      return {
        recipient_id: (recipient as any)?.id,
        text_content: text ? `Forwarded: ${text}` : null,
        attachment_url: attUrl,
        attachment_type: attType || null,
        attachment_metadata: attMeta,
      };
    }
    return { recipient_id: (recipient as any)?.id, text_content: text ? `Forwarded: ${text}` : "Forwarded message" };
  };

  const send = async (payload: any) => {
    const data = await apiFetch("/api/messages/send", { method: "POST", body: JSON.stringify(payload) });
    // append optimistically
    setMsgs((prev) => [...prev, data]);
    // If conversation just created, refresh to get its id
    if (!conversationId) fetchHistory();
    return data;
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed && !replyTo && !editTarget) return;

    setShowEmoji(false);
    setShowStickers(false);

    try {
      // external hook (optional)
      onSendMessage?.(trimmed);

      // EDIT mode
      if (editTarget?.id) {
        const updated = await apiFetch(`/api/messages/${editTarget.id}`, {
          method: "PUT",
          body: JSON.stringify({ text_content: trimmed }),
        });

        // update local list
        const updatedMsg = updated?.message || null;
        if (updatedMsg?.id) {
          setMsgs((prev) => prev.map((m: any) => (safeNum(m?.id) === safeNum(updatedMsg.id) ? updatedMsg : m)));
        }
        setEditTarget(null);
        setInputText("");
        return;
      }

      // REPLY mode (uses parent_message_id)
      const payload: any = { recipient_id: (recipient as any)?.id, text_content: trimmed };
      if (replyTo?.id) payload.parent_message_id = replyTo.id;

      await send(payload);

      setInputText("");
      setReplyTo(null);
    } catch (e: any) {
      alert(e?.message || "Failed to send");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendText(inputText);
  };

  const canSend = inputText.trim().length > 0;

  // Long-press handling (touch + mouse)
  const startLongPress = (msg: any, mine: boolean, evt: any) => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);

    const { clientX, clientY } = (() => {
      const t = evt?.touches?.[0] || evt?.changedTouches?.[0];
      if (t) return { clientX: t.clientX, clientY: t.clientY };
      return { clientX: evt?.clientX ?? 0, clientY: evt?.clientY ?? 0 };
    })();

    longPressTimer.current = window.setTimeout(() => {
      setActionModal({ msg, mine, x: clientX, y: clientY });
      // haptics if available
      try {
        (navigator as any).vibrate?.(10);
      } catch {}
    }, 420);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const doDelete = async (m: any, deleteForEveryone: boolean) => {
    try {
      await apiFetch(`/api/messages/${safeNum(m?.id)}`, {
        method: "DELETE",
        body: JSON.stringify({ delete_for_everyone: deleteForEveryone }),
      });

      if (deleteForEveryone) {
        setMsgs((prev) => prev.filter((x: any) => safeNum(x?.id) !== safeNum(m?.id)));
      } else {
        // delete for me just hides; remove locally for instant UI
        setMsgs((prev) => prev.filter((x: any) => safeNum(x?.id) !== safeNum(m?.id)));
      }
    } catch (e: any) {
      alert(e?.message || "Failed to delete");
    }
  };

  const actionBtn = (
    icon: string,
    label: string,
    onClick: () => void,
    danger = false
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-3 py-3 rounded-xl",
        "hover:bg-[#2d2d2d] active:bg-[#333] transition-colors",
        danger ? "text-[#ff6b6b]" : "text-[#e4e6eb]",
      ].join(" ")}
    >
      <i className={`${icon} text-[18px]`} />
      <span className="text-[15px] font-medium">{label}</span>
    </button>
  );

  const closeActionModal = () => setActionModal(null);

  // Mobile composer sizing: keep visible
  // - add safe-area padding using inline style
  const safeAreaPaddingBottom = "max(env(safe-area-inset-bottom), 8px)";

  return (
    <div className="fixed inset-0 z-[200] bg-[#1e1e1e] flex flex-col font-sans">
      {/* Top header */}
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

      {/* Reply/Edit banner */}
      {(replyTo || editTarget) && (
        <div className="px-3 py-2 border-b border-[#333] bg-[#161616]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[12px] text-[#b0b3b8]">
                {editTarget ? "Editing message" : "Replying to"}
              </div>
              <div className="text-[13px] text-[#e4e6eb] truncate">
                {safeStr((editTarget || replyTo)?.text_content) || "…"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setReplyTo(null);
                setEditTarget(null);
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#2d2d2d]"
              aria-label="Cancel"
            >
              <i className="fas fa-xmark text-[#e4e6eb]" />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-3 py-3 bg-[#1e1e1e]"
        onClick={() => {
          // close pickers on tap on list
          setShowEmoji(false);
          setShowStickers(false);
        }}
      >
        {loading && msgs.length === 0 ? (
          <div className="text-center text-[#b0b3b8] text-sm py-6">Loading…</div>
        ) : null}

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
          const edited = !!msg?.edited_at;

          return (
            <div key={r.key} className={`w-full flex ${mine ? "justify-end" : "justify-start"} mb-1.5`}>
              <div className={`max-w-[82%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={[
                    "px-3 py-2 text-[16px] leading-snug",
                    "rounded-2xl",
                    "select-none",
                    mine ? "bg-[#1B74E4] text-white rounded-br-md" : "bg-[#3A3B3C] text-[#e4e6eb] rounded-bl-md",
                  ].join(" ")}
                  onTouchStart={(e) => startLongPress(msg, mine, e)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onMouseDown={(e) => startLongPress(msg, mine, e)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                >
                  {text || <span className="opacity-60">…</span>}
                </div>

                {(d || edited) && (
                  <div className="text-[11px] text-[#b0b3b8] mt-0.5 px-1 select-none">
                    {d ? formatTime(d) : ""}
                    {edited ? <span className="ml-2 opacity-80">(edited)</span> : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Emoji / Stickers panel */}
      {(showEmoji || showStickers) && (
        <div className="border-t border-[#333] bg-[#1e1e1e]">
          {showEmoji ? (
            <div className="p-2">
              <EmojiPicker
                onSelect={(emoji: string) => {
                  setInputText((p) => (p ? `${p}${emoji}` : emoji));
                }}
              />
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

      {/* Composer (mobile safe) */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[#333] bg-[#1e1e1e] px-2"
        style={{ paddingBottom: safeAreaPaddingBottom }}
      >
        <div className="py-2 flex items-end gap-2">
          {/* Left quick actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d] transition-colors"
              aria-label="Camera"
              onClick={() => alert("Camera upload (connect your media picker here)")}
            >
              <i className="fas fa-camera text-[18px] text-[#1B74E4]" />
            </button>

            <button
              type="button"
              className="px-2 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d] transition-colors"
              aria-label="GIF"
              onClick={() => alert("GIF picker (connect here)")}
            >
              <span className="text-[13px] font-bold text-[#1B74E4]">GIF</span>
            </button>

            <button
              type="button"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d] transition-colors"
              aria-label="Stickers"
              onClick={() => {
                setShowStickers((v) => !v);
                setShowEmoji(false);
              }}
            >
              <i className="fas fa-face-smile text-[18px] text-[#1B74E4]" />
            </button>
          </div>

          {/* Input */}
          <div className="flex-1 min-w-0 bg-[#2d2d2d] rounded-full px-3 py-2 flex items-center gap-2">
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={editTarget ? "Edit message" : "Message"}
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-[#e4e6eb] placeholder:text-[#b0b3b8]"
              onFocus={() => {
                // keep panels optional
              }}
            />

            <button
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3a3a3a] transition-colors shrink-0"
              aria-label="Emoji"
              onClick={() => {
                setShowEmoji((v) => !v);
                setShowStickers(false);
              }}
            >
              <i className="far fa-smile text-[18px] text-[#1B74E4]" />
            </button>

            <button
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3a3a3a] transition-colors shrink-0"
              aria-label="Voice"
              onClick={() => alert("Voice (connect recorder here)")}
            >
              <i className="fas fa-microphone text-[18px] text-[#1B74E4]" />
            </button>
          </div>

          {/* Right: Send or Like */}
          {canSend || editTarget ? (
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-[#1B74E4] flex items-center justify-center hover:bg-[#1A6ED8] transition-colors shrink-0"
              aria-label="Send"
            >
              <i className="fas fa-paper-plane text-[16px] text-white" />
            </button>
          ) : (
            <button
              type="button"
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#2d2d2d] transition-colors shrink-0"
              aria-label="Like"
              onClick={() => sendText("👍")}
            >
              <i className="fas fa-thumbs-up text-[20px] text-[#1B74E4]" />
            </button>
          )}
        </div>
      </form>

      {/* Action Modal (long-press popup) */}
      {actionModal && (
        <div
          className="fixed inset-0 z-[300]"
          onClick={closeActionModal}
          onTouchStart={closeActionModal}
          role="presentation"
        >
          {/* dim */}
          <div className="absolute inset-0 bg-black/50" />

          {/* sheet */}
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-0 w-full max-w-md bg-[#1e1e1e] border-t border-[#333] rounded-t-2xl p-3"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] text-[#b0b3b8] truncate pr-2">
                {actionModal.mine ? "Your message" : "Message"}
              </div>
              <button
                type="button"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d]"
                aria-label="Close"
                onClick={closeActionModal}
              >
                <i className="fas fa-xmark text-[#e4e6eb]" />
              </button>
            </div>

            <div className="bg-[#141414] border border-[#2b2b2b] rounded-2xl p-3 mb-3">
              <div className="text-[14px] text-[#e4e6eb] break-words">
                {safeStr(actionModal.msg?.text_content) || <span className="opacity-60">…</span>}
              </div>
            </div>

            <div className="space-y-1">
              {/* Forward */}
              {actionBtn("fas fa-share", "Forward", async () => {
                const m = actionModal.msg;
                closeActionModal();
                try {
                  await send(buildForwardPayload(m));
                } catch (e: any) {
                  alert(e?.message || "Failed to forward");
                }
              })}

              {/* Reply */}
              {actionBtn("fas fa-reply", "Reply", () => {
                const m = actionModal.msg;
                closeActionModal();
                setEditTarget(null);
                setReplyTo(m);
              })}

              {/* Edit (mine only) */}
              {actionModal.mine
                ? actionBtn("fas fa-pen", "Edit", () => {
                    const m = actionModal.msg;
                    closeActionModal();
                    setReplyTo(null);
                    setEditTarget(m);
                    setInputText(safeStr(m?.text_content));
                    // focus input best-effort
                    setTimeout(() => {
                      const el = document.querySelector<HTMLInputElement>('input[placeholder="Edit message"], input[placeholder="Message"]');
                      el?.focus?.();
                    }, 50);
                  })
                : null}

              {/* Delete for me */}
              {actionBtn("fas fa-trash", "Delete", async () => {
                const m = actionModal.msg;
                closeActionModal();
                await doDelete(m, false);
              }, true)}

              {/* Delete for everyone (mine only) */}
              {actionModal.mine
                ? actionBtn("fas fa-trash-can", "Delete for everyone", async () => {
                    const m = actionModal.msg;
                    closeActionModal();
                    await doDelete(m, true);
                  }, true)
                : null}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={closeActionModal}
                className="w-full py-3 rounded-xl bg-[#2d2d2d] text-[#e4e6eb] font-semibold hover:bg-[#333]"
              >
                Cancel
              </button>
            </div>

            {/* Safe-area bottom space */}
            <div style={{ height: "max(env(safe-area-inset-bottom), 8px)" }} />
          </div>
        </div>
      )}
    </div>
  );
};
