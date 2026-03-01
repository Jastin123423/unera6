// components/Chat.tsx
// Messenger-style full-screen chat window with attachment support
// ✅ Photos, Videos, GIFs, Documents (PDF, DOC, XLS, etc.)
// ✅ R2 upload via media.unera.social/api/upload
// ✅ Attachment preview in messages
// ✅ Long-press actions for attachments

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { User, Message } from "../types";
import { StickerPicker, EmojiPicker } from "./Pickers";

// ✅ Upload function for R2
const uploadToR2 = async (file: File, folder = "chat"): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", file.name);
  formData.append("type", file.type);
  formData.append("folder", folder);
  formData.append("timestamp", Date.now().toString());

  const token = localStorage.getItem("unera_token");
  const response = await fetch("https://media.unera.social/api/upload", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Upload failed: ${response.status}`);
  }

  const result = await response.json();
  if (!result.url) throw new Error("No URL returned from upload");
  
  return result.url;
};

// ✅ Helper to get file icon based on mime type
const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith("image/")) return "fas fa-image";
  if (mimeType.startsWith("video/")) return "fas fa-video";
  if (mimeType.startsWith("audio/")) return "fas fa-music";
  if (mimeType.includes("pdf")) return "fas fa-file-pdf";
  if (mimeType.includes("word") || mimeType.includes("document")) return "fas fa-file-word";
  if (mimeType.includes("excel") || mimeType.includes("sheet")) return "fas fa-file-excel";
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "fas fa-file-powerpoint";
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return "fas fa-file-zipper";
  return "fas fa-file";
};

// ✅ Format file size
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

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

// ✅ Attachment Preview Component
const AttachmentPreview: React.FC<{ attachment: any; onView: () => void }> = ({ attachment, onView }) => {
  const url = attachment?.url || attachment?.attachment_url;
  const type = attachment?.type || attachment?.attachment_type;
  const name = attachment?.name || attachment?.filename || "Attachment";
  const size = attachment?.size || attachment?.file_size;

  if (!url) return null;

  // Image preview
  if (type?.startsWith("image/")) {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-[#3E4042] cursor-pointer" onClick={onView}>
        <img src={url} alt={name} className="max-w-full max-h-64 object-contain bg-black/20" />
      </div>
    );
  }

  // Video preview
  if (type?.startsWith("video/")) {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-[#3E4042] cursor-pointer relative" onClick={onView}>
        <video src={url} className="max-w-full max-h-64 object-contain bg-black/20" controls />
      </div>
    );
  }

  // Document/file preview
  return (
    <div 
      className="mt-2 p-3 rounded-lg border border-[#3E4042] bg-[#2d2d2d] flex items-center gap-3 cursor-pointer hover:bg-[#333] transition-colors"
      onClick={onView}
    >
      <i className={`${getFileIcon(type || "")} text-2xl text-[#1B74E4]`} />
      <div className="flex-1 min-w-0">
        <div className="text-[#e4e6eb] font-medium truncate">{name}</div>
        {size && <div className="text-[#b0b3b8] text-xs">{formatFileSize(size)}</div>}
      </div>
      <i className="fas fa-download text-[#b0b3b8]" />
    </div>
  );
};

type ChatWindowProps = {
  currentUser: User;
  recipient: User;
  onClose: () => void;
  onSendMessage?: (t: string, s?: string) => void;
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
  const [uploading, setUploading] = useState(false);

  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);

  const [actionModal, setActionModal] = useState<ActionModalState>(null);
  const [viewingAttachment, setViewingAttachment] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);

  const currentUserId = safeNum(currentUser?.id);

  const scrollToBottom = (smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 240;
    if (nearBottom) messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  const markRead = useCallback(
    async (convId: number) => {
      if (!convId || !currentUserId) return;
      try {
        await apiFetch(
          "/api/messages/mark-read",
          {
            method: "POST",
            body: JSON.stringify({ 
              conversation_id: convId,
              user_id: currentUserId
            }),
          },
          currentUserId
        );
      } catch {
        // ignore
      }
    },
    [currentUserId]
  );

  const fetchHistory = useCallback(async () => {
    if (!currentUserId) return;
    
    try {
      setLoading(true);

      const conversations = await apiFetch("/api/messages/conversations", {}, currentUserId);
      const conv = Array.isArray(conversations)
        ? conversations.find((c: any) => safeNum(c?.other_user_id) === safeNum((recipient as any)?.id))
        : null;

      const cid = safeNum(conv?.id, 0);
      setConversationId(cid);

      if (cid) {
        const history = await apiFetch(`/api/messages/conversations/${cid}`, {}, currentUserId);
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
  }, [recipient?.id, markRead, currentUserId]);

  useEffect(() => {
    fetchHistory();

    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(fetchHistory, 5000);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [recipient?.id, currentUserId, fetchHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [recipient?.id]);

  useEffect(() => {
    scrollToBottom(true);
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

  // ✅ Handle file selection and upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentUserId) return;

    setUploading(true);
    setShowAttachmentMenu(false);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Upload to R2
        const url = await uploadToR2(file, "chat");
        
        // Send message with attachment
        const payload = {
          sender_id: currentUserId,
          recipient_id: (recipient as any)?.id,
          text_content: inputText.trim() || null,
          attachment: {
            url,
            type: file.type,
            name: file.name,
            size: file.size
          }
        };

        await send(payload);
        setInputText(""); // Clear text after sending
      }
    } catch (error: any) {
      alert(error?.message || "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const buildForwardPayload = (m: any) => {
    const text = safeStr(m?.text_content);
    const attachment = m?.attachment;

    const payload: any = {
      sender_id: currentUserId,
      recipient_id: (recipient as any)?.id,
    };

    if (attachment) {
      payload.attachment = attachment;
      payload.text_content = text ? `Forwarded: ${text}` : "Forwarded attachment";
    } else {
      payload.text_content = text ? `Forwarded: ${text}` : "Forwarded message";
    }

    return payload;
  };

  const send = async (payload: any) => {
    if (!currentUserId) throw new Error("User not authenticated");
    
    const fullPayload = {
      sender_id: currentUserId,
      ...payload
    };
    
    const data = await apiFetch(
      "/api/messages/send", 
      { 
        method: "POST", 
        body: JSON.stringify(fullPayload) 
      },
      currentUserId
    );
    
    setMsgs((prev) => [...prev, data]);
    if (!conversationId) fetchHistory();
    return data;
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed && !replyTo && !editTarget) return;

    setShowEmoji(false);
    setShowStickers(false);

    try {
      onSendMessage?.(trimmed);

      if (editTarget?.id) {
        const updated = await apiFetch(
          `/api/messages/${editTarget.id}`,
          {
            method: "PUT",
            body: JSON.stringify({ 
              text_content: trimmed,
              user_id: currentUserId
            }),
          },
          currentUserId
        );

        const updatedMsg = updated?.message || null;
        if (updatedMsg?.id) {
          setMsgs((prev) => prev.map((m: any) => (safeNum(m?.id) === safeNum(updatedMsg.id) ? updatedMsg : m)));
        }
        setEditTarget(null);
        setInputText("");
        return;
      }

      const payload: any = { 
        sender_id: currentUserId,
        recipient_id: (recipient as any)?.id, 
        text_content: trimmed 
      };
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

  const startLongPress = (msg: any, mine: boolean, evt: any) => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);

    const { clientX, clientY } = (() => {
      const t = evt?.touches?.[0] || evt?.changedTouches?.[0];
      if (t) return { clientX: t.clientX, clientY: t.clientY };
      return { clientX: evt?.clientX ?? 0, clientY: evt?.clientY ?? 0 };
    })();

    longPressTimer.current = window.setTimeout(() => {
      setActionModal({ msg, mine, x: clientX, y: clientY });
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
    if (!currentUserId) return;
    
    try {
      await apiFetch(
        `/api/messages/${safeNum(m?.id)}`,
        {
          method: "DELETE",
          body: JSON.stringify({ 
            delete_for_everyone: deleteForEveryone,
            user_id: currentUserId
          }),
        },
        currentUserId
      );

      setMsgs((prev) => prev.filter((x: any) => safeNum(x?.id) !== safeNum(m?.id)));
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

  const safeAreaPaddingBottom = "max(env(safe-area-inset-bottom), 8px)";

  return (
    <div className="fixed inset-0 z-[200] bg-[#1e1e1e] flex flex-col font-sans">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
        onChange={handleFileSelect}
      />

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
                {safeStr((editTarget || replyTo)?.text_content) || 
                 (replyTo?.attachment ? "📎 Attachment" : "…")}
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
          setShowEmoji(false);
          setShowStickers(false);
          setShowAttachmentMenu(false);
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
          const attachment = msg?.attachment;
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
                    attachment ? "pb-2" : "",
                  ].join(" ")}
                  onTouchStart={(e) => startLongPress(msg, mine, e)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onMouseDown={(e) => startLongPress(msg, mine, e)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                >
                  {text && <div className="break-words">{text}</div>}
                  
                  {/* Attachment preview */}
                  {attachment && (
                    <AttachmentPreview 
                      attachment={attachment} 
                      onView={() => setViewingAttachment(attachment)}
                    />
                  )}
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

        {/* Uploading indicator */}
        {uploading && (
          <div className="flex justify-start mb-1.5">
            <div className="bg-[#3A3B3C] text-[#e4e6eb] px-4 py-2 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-2">
                <i className="fas fa-spinner fa-spin" />
                <span>Uploading...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attachment Menu */}
      {showAttachmentMenu && (
        <div className="border-t border-[#333] bg-[#1e1e1e] p-2">
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "image/*";
                  fileInputRef.current.multiple = true;
                  fileInputRef.current.click();
                }
              }}
              className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-[#2d2d2d]"
            >
              <div className="w-12 h-12 rounded-full bg-[#2d2d2d] flex items-center justify-center">
                <i className="fas fa-image text-2xl text-[#1B74E4]" />
              </div>
              <span className="text-xs text-[#b0b3b8]">Photos</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "video/*";
                  fileInputRef.current.multiple = true;
                  fileInputRef.current.click();
                }
              }}
              className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-[#2d2d2d]"
            >
              <div className="w-12 h-12 rounded-full bg-[#2d2d2d] flex items-center justify-center">
                <i className="fas fa-video text-2xl text-[#1B74E4]" />
              </div>
              <span className="text-xs text-[#b0b3b8]">Video</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "audio/*";
                  fileInputRef.current.multiple = true;
                  fileInputRef.current.click();
                }
              }}
              className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-[#2d2d2d]"
            >
              <div className="w-12 h-12 rounded-full bg-[#2d2d2d] flex items-center justify-center">
                <i className="fas fa-music text-2xl text-[#1B74E4]" />
              </div>
              <span className="text-xs text-[#b0b3b8]">Audio</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip";
                  fileInputRef.current.multiple = true;
                  fileInputRef.current.click();
                }
              }}
              className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-[#2d2d2d]"
            >
              <div className="w-12 h-12 rounded-full bg-[#2d2d2d] flex items-center justify-center">
                <i className="fas fa-file text-2xl text-[#1B74E4]" />
              </div>
              <span className="text-xs text-[#b0b3b8]">Document</span>
            </button>
          </div>
        </div>
      )}

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
              aria-label="Add attachment"
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            >
              <i className="fas fa-plus-circle text-[22px] text-[#1B74E4]" />
            </button>

            <button
              type="button"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d] transition-colors"
              aria-label="Camera"
              onClick={() => alert("Camera capture (implement with getUserMedia)")}
            >
              <i className="fas fa-camera text-[18px] text-[#1B74E4]" />
            </button>

            <button
              type="button"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d] transition-colors"
              aria-label="Stickers"
              onClick={() => {
                setShowStickers((v) => !v);
                setShowEmoji(false);
                setShowAttachmentMenu(false);
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
                setShowAttachmentMenu(false);
              }}
            />

            <button
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3a3a3a] transition-colors shrink-0"
              aria-label="Emoji"
              onClick={() => {
                setShowEmoji((v) => !v);
                setShowStickers(false);
                setShowAttachmentMenu(false);
              }}
            >
              <i className="far fa-smile text-[18px] text-[#1B74E4]" />
            </button>

            <button
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3a3a3a] transition-colors shrink-0"
              aria-label="Voice"
              onClick={() => alert("Voice recording (implement with MediaRecorder)")}
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
              disabled={uploading}
            >
              <i className="fas fa-paper-plane text-[16px] text-white" />
            </button>
          ) : (
            <button
              type="button"
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#2d2d2d] transition-colors shrink-0"
              aria-label="Like"
              onClick={() => sendText("👍")}
              disabled={uploading}
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
          <div className="absolute inset-0 bg-black/50" />

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
                {safeStr(actionModal.msg?.text_content) || 
                 (actionModal.msg?.attachment ? "📎 Attachment" : "…")}
              </div>
            </div>

            <div className="space-y-1">
              {actionBtn("fas fa-share", "Forward", async () => {
                const m = actionModal.msg;
                closeActionModal();
                try {
                  await send(buildForwardPayload(m));
                } catch (e: any) {
                  alert(e?.message || "Failed to forward");
                }
              })}

              {actionBtn("fas fa-reply", "Reply", () => {
                const m = actionModal.msg;
                closeActionModal();
                setEditTarget(null);
                setReplyTo(m);
              })}

              {actionModal.mine && actionBtn("fas fa-pen", "Edit", () => {
                const m = actionModal.msg;
                closeActionModal();
                setReplyTo(null);
                setEditTarget(m);
                setInputText(safeStr(m?.text_content));
                setTimeout(() => {
                  const el = document.querySelector<HTMLInputElement>('input[placeholder="Edit message"], input[placeholder="Message"]');
                  el?.focus?.();
                }, 50);
              })}

              {actionBtn("fas fa-trash", "Delete", async () => {
                const m = actionModal.msg;
                closeActionModal();
                await doDelete(m, false);
              }, true)}

              {actionModal.mine && actionBtn("fas fa-trash-can", "Delete for everyone", async () => {
                const m = actionModal.msg;
                closeActionModal();
                await doDelete(m, true);
              }, true)}
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

            <div style={{ height: "max(env(safe-area-inset-bottom), 8px)" }} />
          </div>
        </div>
      )}

      {/* Attachment Viewer Modal */}
      {viewingAttachment && (
        <div
          className="fixed inset-0 z-[400] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewingAttachment(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 z-10"
            onClick={() => setViewingAttachment(null)}
          >
            <i className="fas fa-times text-white text-xl" />
          </button>

          {viewingAttachment.type?.startsWith("image/") ? (
            <img
              src={viewingAttachment.url}
              alt={viewingAttachment.name}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : viewingAttachment.type?.startsWith("video/") ? (
            <video
              src={viewingAttachment.url}
              controls
              autoPlay
              className="max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="bg-[#242526] rounded-xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center gap-4">
                <i className={`${getFileIcon(viewingAttachment.type || "")} text-6xl text-[#1B74E4]`} />
                <div className="text-center">
                  <div className="text-white font-semibold mb-1">{viewingAttachment.name}</div>
                  {viewingAttachment.size && (
                    <div className="text-[#b0b3b8] text-sm">{formatFileSize(viewingAttachment.size)}</div>
                  )}
                </div>
                <a
                  href={viewingAttachment.url}
                  download={viewingAttachment.name}
                  className="bg-[#1B74E4] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1A6ED8]"
                >
                  Download
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
