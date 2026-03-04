// components/Chat.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { User, Message } from "../types";
import { StickerPicker, EmojiPicker } from "./Pickers";
import { CallScreen } from "./CallScreen";

/* ============================================================
   ✅ Upload function for R2 (returns rich data)
============================================================ */
const uploadToR2 = async (file: File, folder = "chat"): Promise<any> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", file.name);
  formData.append("type", file.type);
  formData.append("folder", folder);
  formData.append("timestamp", Date.now().toString());

  const token = localStorage.getItem("unera_token");
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Upload failed: ${response.status}`);
  }

  const result = await response.json();
  if (!result?.url) throw new Error("No URL returned from upload");

  return {
    url: result.url,
    file_type: result.file_type || "other",
    mime_type: result.mime_type || result.contentType || file.type || "",
    filename: result.filename || file.name || "Attachment",
    size_bytes: result.size_bytes ?? file.size ?? null,
    metadata: result.metadata || {},
  };
};

/* ============================================================
   ✅ Helpers
============================================================ */
const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

// ✅ Safe duration formatter - FIX for "Infinity:NaN"
const safeDuration = (n: any): number => {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
};

const formatDuration = (seconds: number) => {
  const s = Math.max(0, Math.floor(safeDuration(seconds) || 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss < 10 ? "0" : ""}${ss}`;
};

const getFileIcon = (mime: string): string => {
  if (mime.startsWith("image/")) return "fas fa-image";
  if (mime.startsWith("video/")) return "fas fa-video";
  if (mime.startsWith("audio/")) return "fas fa-music";
  if (mime.startsWith("application/pdf")) return "fas fa-file-pdf";
  if (mime.includes("word")) return "fas fa-file-word";
  if (mime.includes("excel") || mime.includes("spreadsheet")) return "fas fa-file-excel";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "fas fa-file-powerpoint";
  if (mime.startsWith("text/")) return "fas fa-file-lines";
  return "fas fa-file";
};

const extractUrls = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

// ✅ Hide URL text from message bubble (professional)
const stripUrlsFromText = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return (text || "").replace(urlRegex, "").replace(/\s+/g, " ").trim();
};

const isGifUrl = (url: string) => {
  const u = (url || "").toLowerCase();
  if (!u) return false;

  if (u.split("?")[0].endsWith(".gif")) return true;
  if (u.includes("media.tenor.com") || u.includes("c.tenor.com")) return true;
  if (u.includes("i.giphy.com") || u.includes("media.giphy.com")) return true;
  if (u.includes("tenor.com/view/")) return true;
  if (u.includes("giphy.com/gifs/")) return true;

  return false;
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

// ✅ Message status helpers (supports different backend field names)
const isMsgSeen = (m: any): boolean => {
  return !!m?.read_at ||
    !!m?.seen_at ||
    m?.is_read === 1 ||
    m?.is_read === true ||
    m?.read === 1 ||
    m?.read === true;
};

const isMsgDelivered = (m: any): boolean => {
  return !!m?.delivered_at ||
    m?.is_delivered === 1 ||
    m?.is_delivered === true ||
    m?.delivered === 1 ||
    m?.delivered === true;
};

// ✅ WhatsApp-like ticks (FontAwesome)
const DeliveryTicks: React.FC<{ msg: any; mine: boolean }> = ({ msg, mine }) => {
  if (!mine) return null;

  const seen = isMsgSeen(msg);
  const delivered = isMsgDelivered(msg);

  // Seen => double blue
  if (seen) {
    return <i className="fas fa-check-double text-[11px]" style={{ color: "#1B74E4" }} />;
  }

  // Delivered => double grey (optional, only if backend provides it)
  if (delivered) {
    return <i className="fas fa-check-double text-[11px]" style={{ color: "#b0b3b8" }} />;
  }

  // Sent => single grey
  return <i className="fas fa-check text-[11px]" style={{ color: "#b0b3b8" }} />;
};

// ✅ Format last seen
const formatLastSeen = (iso: string) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "Offline";
  
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Last seen just now";
  if (diffMins < 60) return `Last seen ${diffMins} min ago`;
  if (diffHours < 24) return `Last seen ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return "Last seen yesterday";
  
  // Format as "Last seen Mar 04, 10:22"
  const day = d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `Last seen ${day}, ${time}`;
};

/* ============================================================
   ✅ REAL DOWNLOAD (forces file download, not just open)
   - Uses fetch -> blob -> ObjectURL -> <a download>
   - Falls back to simple <a download> / new tab if blocked by CORS
============================================================ */
const forceDownload = async (url: string, filename = "download") => {
  if (!url) return;

  const cleanName = (filename || "download").replace(/[\/\\?%*:|"<>]/g, "_");

  const clickAnchor = (href: string, name?: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = name || cleanName;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Best-case: fetch as blob (forces real download)
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error("fetch failed");

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    try {
      clickAnchor(blobUrl, cleanName);
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    }
    return;
  } catch {
    // Fallback 1: try direct anchor download (works if same-origin or proper headers)
    try {
      clickAnchor(url, cleanName);
      return;
    } catch {
      // Fallback 2: last resort open new tab
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
};

/* ============================================================
   ✅ URL Preview Component (NO horizontal overflow)
============================================================ */
const URLPreview: React.FC<{ url: string }> = ({ url }) => {
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      setLoading(true);
      try {
        const domain = new URL(url).hostname.replace("www.", "");
        setPreviewData({ domain, url });
      } catch {
        setPreviewData({ domain: url.substring(0, 30), url });
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [url]);

  if (loading) {
    return (
      <div className="mt-1 p-3 rounded-xl border border-[#3E4042] bg-[#262626] animate-pulse w-full max-w-full overflow-hidden">
        <div className="h-4 bg-[#3a3a3a] rounded w-3/4" />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 p-3 rounded-xl border border-[#3E4042] bg-[#262626] flex items-center gap-3 hover:bg-[#2f2f2f] transition-colors no-underline w-full max-w-full overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
    >
      <i className="fas fa-link text-xl text-[#1B74E4] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[#e4e6eb] font-medium truncate">{previewData?.domain || "Link"}</div>
        <div className="text-[#b0b3b8] text-xs truncate">{url}</div>
      </div>
      <i className="fas fa-external-link-alt text-[#b0b3b8] shrink-0" />
    </a>
  );
};

/* ============================================================
   ✅ GIF Preview (hide link; show only gif; WhatsApp-like size)
============================================================ */
const GIFPreview: React.FC<{
  url: string;
  onView: () => void;
  onHold: (evt: any) => void;
}> = ({ url, onView, onHold }) => {
  const u = (url || "").toLowerCase();

  const directGif =
    u.split("?")[0].endsWith(".gif") ||
    u.includes("media.tenor.com") ||
    u.includes("i.giphy.com") ||
    u.includes("media.giphy.com") ||
    u.includes("c.tenor.com");

  const isTenorPage = u.includes("tenor.com/view/");
  const isGiphyPage = u.includes("giphy.com/gifs/");

  const getEmbedUrl = () => {
    if (isTenorPage) {
      const match = url.match(/tenor\.com\/view\/([^\/]+)/);
      if (match) return `https://tenor.com/embed/${match[1]}`;
    }
    if (isGiphyPage) {
      const match = url.match(/giphy\.com\/gifs\/([^\/]+)/);
      if (match) return `https://giphy.com/embed/${match[1]}`;
    }
    return null;
  };

  const embedUrl = getEmbedUrl();
  const wrapCls =
    "mt-1 rounded-2xl overflow-hidden border border-[#3E4042] bg-[#262626] w-[220px] max-w-full";

  if (directGif) {
    return (
      <div
        className={wrapCls}
        onClick={(e) => {
          e.stopPropagation();
          onView();
        }}
        onTouchStart={onHold}
        onMouseDown={onHold}
      >
        <img src={url} alt="GIF" className="w-full h-[150px] object-cover" />
      </div>
    );
  }

  if (embedUrl) {
    return (
      <div className={wrapCls} onClick={(e) => e.stopPropagation()} onTouchStart={onHold} onMouseDown={onHold}>
        <iframe src={embedUrl} className="w-full h-[150px]" frameBorder="0" allowFullScreen title="GIF" />
      </div>
    );
  }

  return <URLPreview url={url} />;
};

/* ============================================================
   ✅ WhatsApp-style Voice Note Player (MATCHES SCREENSHOT)
   - FIXED: Infinity/NaN issue with safeDuration
   - FIXED: Auto-stop other voice notes when playing
============================================================ */
const hashToWave = (key: string, count = 28) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    // Tall bars like screenshot
    const v = 18 + (h % 70); // 18..87
    out.push(v);
  }
  return out;
};

// Global audio manager to ensure only one voice note plays at a time
const audioManager = {
  currentAudio: null as HTMLAudioElement | null,
  currentKey: null as string | null,
  listeners: new Map<string, (isPlaying: boolean) => void>(),
  
  register(key: string, audio: HTMLAudioElement, onPlayStateChange: (isPlaying: boolean) => void) {
    this.listeners.set(key, onPlayStateChange);
    
    // Override play to stop others
    const originalPlay = audio.play;
    audio.play = function() {
      if (audioManager.currentAudio && audioManager.currentAudio !== audio) {
        audioManager.currentAudio.pause();
        audioManager.currentAudio.currentTime = 0;
        // Notify the previous audio that it's stopped
        if (audioManager.currentKey) {
          const listener = audioManager.listeners.get(audioManager.currentKey);
          listener?.(false);
        }
      }
      audioManager.currentAudio = audio;
      audioManager.currentKey = key;
      onPlayStateChange(true);
      return originalPlay.call(this);
    }.bind(audio);
    
    // Override pause
    const originalPause = audio.pause;
    audio.pause = function() {
      if (audioManager.currentAudio === audio) {
        audioManager.currentAudio = null;
        audioManager.currentKey = null;
        onPlayStateChange(false);
      }
      return originalPause.call(this);
    }.bind(audio);
  },
  
  unregister(key: string) {
    this.listeners.delete(key);
    if (this.currentKey === key) {
      this.currentAudio = null;
      this.currentKey = null;
    }
  }
};

const VoiceNoteWA: React.FC<{
  src: string;
  isMine?: boolean;
  durationHint?: number; // optional if backend provides duration
}> = ({ src, isMine = true, durationHint }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const keyRef = useRef<string>(`voice-${src}-${Math.random()}`);

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(safeDuration(durationHint));
  const [current, setCurrent] = useState(0);

  const wave = useMemo(() => hashToWave(src), [src]);

  const tick = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setCurrent(a.currentTime || 0);
    if (!a.paused) rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      audioManager.unregister(keyRef.current);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  const pct = safeDuration(duration) > 0 ? Math.min(1, Math.max(0, current / safeDuration(duration))) : 0;
  const activeBars = Math.floor(pct * wave.length);

  // Screenshot is blue outgoing bubble
  const bg = isMine ? "#1B74E4" : "#3A3B3C";
  const waveOff = "rgba(255,255,255,0.35)";
  const waveOn = "rgba(255,255,255,0.95)";

  return (
    <div className="w-full max-w-full" onClick={(e) => e.stopPropagation()}>
      <div
        className="flex items-center gap-3 px-3 py-2 rounded-2xl w-full"
        style={{ background: bg }}
      >
        {/* Play button circle */}
        <button
          type="button"
          onClick={toggle}
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.18)" }}
          aria-label={playing ? "Pause" : "Play"}
        >
          <i className={`fas ${playing ? "fa-pause" : "fa-play"} text-[16px]`} style={{ color: "#fff" }} />
        </button>

        {/* Waveform */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[2px] h-[24px]">
            {wave.map((h, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full"
                style={{
                  height: `${Math.min(24, Math.max(6, Math.round(h / 3.2)))}px`,
                  background: i <= activeBars ? waveOn : waveOff,
                  transition: "background 120ms linear",
                }}
              />
            ))}
          </div>
        </div>

        {/* Duration on right (like screenshot) */}
        <div className="text-[13px] font-semibold tabular-nums shrink-0 text-white">
          {formatDuration(safeDuration(duration))}
        </div>
      </div>

      <audio
        ref={(el) => {
          audioRef.current = el;
          if (el) {
            audioManager.register(keyRef.current, el, setPlaying);
          }
        }}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => {
          const a = audioRef.current;
          if (!a) return;
          setDuration(safeDuration(a.duration || durationHint || 0));
        }}
        onPlay={() => {
          setPlaying(true);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(tick);
        }}
        onPause={() => {
          setPlaying(false);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
          const a = audioRef.current;
          if (a) a.currentTime = 0;
        }}
      />
    </div>
  );
};

/* ============================================================
   ✅ Attachment Preview
============================================================ */
const AttachmentPreview: React.FC<{ attachment: any; onView: () => void; isMine?: boolean }> = ({
  attachment,
  onView,
  isMine,
}) => {
  const url = attachment?.url || attachment?.attachment_url || attachment?.attachmentUrl;
  const mime = attachment?.mime_type || attachment?.mimeType || attachment?.type || attachment?.attachment_type || "";
  const fileType = attachment?.file_type || attachment?.fileType || attachment?.attachment_type || attachment?.attachmentType || "";

  const name = attachment?.filename || attachment?.name || "Attachment";
  const size = attachment?.size_bytes ?? attachment?.size ?? attachment?.file_size;

  if (!url) return null;

  const isImage =
    fileType === "image" || String(mime).startsWith("image/");

  const isVideo =
    fileType === "video" || String(mime).startsWith("video/");

  // ✅ IMPORTANT: strong audio detection (fixes your issue)
  const isAudio =
    fileType === "audio" ||
    fileType === "voice" ||
    String(mime).startsWith("audio/") ||
    String(mime).includes("opus") ||
    String(url).toLowerCase().includes(".webm") ||
    String(url).toLowerCase().includes(".m4a") ||
    String(url).toLowerCase().includes(".mp3") ||
    String(url).toLowerCase().includes(".aac");

  if (isImage) {
    return (
      <div
        className="rounded-xl overflow-hidden border border-[#3E4042] cursor-pointer hover:opacity-90 transition-opacity w-full max-w-full"
        onClick={onView}
      >
        <img src={url} alt={name} className="w-full max-h-[400px] object-contain bg-black/20" />
      </div>
    );
  }

  if (isVideo) {
    return (
      <div
        className="rounded-xl overflow-hidden border border-[#3E4042] cursor-pointer relative w-full max-w-full"
        onClick={onView}
      >
        <video src={url} className="w-full max-h-[400px] object-contain bg-black/20" controls />
      </div>
    );
  }

  if (isAudio) {
    // ✅ WhatsApp-style voice note (screenshot)
    return <VoiceNoteWA src={url} isMine={isMine} />;
  }

  return (
    <div
      className={[
        "p-4 rounded-xl border bg-[#262626] flex items-center gap-3 cursor-pointer hover:bg-[#2f2f2f] transition-colors w-full max-w-full overflow-hidden",
        isMine ? "border-[#1B74E4]/30" : "border-[#3E4042]",
      ].join(" ")}
      onClick={onView}
      style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
    >
      <i className={`${getFileIcon(mime || "")} text-3xl text-[#1B74E4] shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="text-[#e4e6eb] font-medium truncate">{name}</div>
        {size ? <div className="text-[#b0b3b8] text-xs">{formatFileSize(size)}</div> : null}
      </div>
      <i className="fas fa-download text-[#b0b3b8] shrink-0" />
    </div>
  );
};

/* ============================================================
   ✅ Avatar
============================================================ */
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

/* ============================================================
   ✅ GIF Panel
============================================================ */
const QUICK_GIFS: Array<{ title: string; url: string }> = [
  { title: "Love", url: "https://media.tenor.com/5tQq5R6kB6YAAAAC/love-hearts.gif" },
  { title: "Kiss", url: "https://media.tenor.com/2b8y0xKx2j0AAAAC/kiss-love.gif" },
  { title: "Hug", url: "https://media.tenor.com/0Qy2Z4nC7yEAAAAC/hug.gif" },
  { title: "Flowers", url: "https://media.tenor.com/HX1k6yJwTQkAAAAC/flowers-rose.gif" },
  { title: "Rose", url: "https://media.tenor.com/2q4m8Qj0pGkAAAAC/rose.gif" },
  { title: "Birthday", url: "https://media.tenor.com/9u1bQ0nPZfEAAAAC/happy-birthday.gif" },
  { title: "Cake", url: "https://media.tenor.com/Q9y6jB4yG2QAAAAC/birthday-cake.gif" },
  { title: "Clap", url: "https://media.tenor.com/6Y5bRr7x0ZgAAAAC/clap-applause.gif" },
  { title: "Hype", url: "https://media.tenor.com/5F3p8Gv6k9AAAAAC/hype-excited.gif" },
  { title: "Fire", url: "https://media.tenor.com/0fQm8q2x2qkAAAAC/fire-lit.gif" },
  { title: "Sad", url: "https://media.tenor.com/eJ2s8a4mYt0AAAAC/crying-sad.gif" },
  { title: "Sorry", url: "https://media.tenor.com/3j5cN3j9h8AAAAAC/sorry.gif" },
  { title: "LOL", url: "https://media.tenor.com/2roX3uxz_68AAAAC/lol-laugh.gif" },
  { title: "Wow", url: "https://media.tenor.com/3k9VQqvK9xgAAAAC/wow-amazed.gif" },
  { title: "Yes", url: "https://media.tenor.com/7j4fB4bDgqQAAAAC/yes-nod.gif" },
  { title: "No", url: "https://media.tenor.com/9tQyE0wQmQ8AAAAC/no-nope.gif" },
];

const GifPanel: React.FC<{ onSelect: (url: string) => void }> = ({ onSelect }) => {
  return (
    <div className="p-3">
      <div className="text-[12px] text-[#b0b3b8] mb-2">GIFs</div>
      <div className="grid grid-cols-3 gap-2">
        {QUICK_GIFS.map((g) => (
          <button
            key={g.url}
            type="button"
            className="rounded-xl overflow-hidden border border-[#333] bg-[#262626] hover:opacity-90 transition-opacity"
            onClick={() => onSelect(g.url)}
          >
            <img src={g.url} alt={g.title} className="w-full h-[86px] object-cover" />
          </button>
        ))}
      </div>
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
      mine: boolean;
      msg: any;
      kind: "message" | "attachment" | "gif";
      attachment?: any;
      gifUrl?: string;
      x: number;
      y: number;
    };

/* ============================================================
   ✅ Main ChatWindow
============================================================ */
export const ChatWindow: React.FC<ChatWindowProps> = ({ currentUser, recipient, onClose, onSendMessage }) => {
  const [inputText, setInputText] = useState("");
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [conversationId, setConversationId] = useState<number>(0);
  const [viewingAttachment, setViewingAttachment] = useState<any>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showGifs, setShowGifs] = useState(false);

  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);

  const [actionModal, setActionModal] = useState<ActionModalState>(null);

  // ✅ Presence/Online status
  const [recipientOnline, setRecipientOnline] = useState(false);
  const [recipientLastSeen, setRecipientLastSeen] = useState<string>("");

  // ==============================
  // CALL STATES
  // ==============================
  const [callOpen, setCallOpen] = useState(false);
  const [callMode, setCallMode] = useState<"voice" | "video">("voice");
  const [callPhase, setCallPhase] = useState<
    "outgoing" | "incoming" | "connecting" | "active" | "ended"
  >("ended");

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordingWave, setRecordingWave] = useState<number[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const waveIntervalRef = useRef<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUserId = safeNum((currentUser as any)?.id);

  const normalizeMsg = (msg: any) => ({
    ...msg,
    attachments: Array.isArray(msg?.attachments) ? msg.attachments : [],
  });

  // ✅ Preserve existing message references when same (prevents players from resetting)
  const mergeByIdPreserveRefs = useCallback((prev: any[], incoming: any[]) => {
    const map = new Map<number, any>();
    for (const m of prev) map.set(safeNum(m?.id), m);

    for (const raw of incoming) {
      const m = normalizeMsg(raw);
      const id = safeNum(m?.id);
      const old = map.get(id);

      const same =
        old &&
        safeStr(old?.text_content) === safeStr(m?.text_content) &&
        safeStr(old?.edited_at) === safeStr(m?.edited_at) &&
        safeStr(old?.created_at) === safeStr(m?.created_at) &&
        JSON.stringify(old?.attachments || []) === JSON.stringify(m?.attachments || []);

      map.set(id, same ? old : m);
    }

    return Array.from(map.values()).sort((a: any, b: any) => {
      const da = parseDate(a?.created_at);
      const db = parseDate(b?.created_at);
      if (da && db) return da.getTime() - db.getTime();
      return safeNum(a?.id) - safeNum(b?.id);
    });
  }, []);

  const pickBestAudioMime = () => {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/mpeg"];
    for (const c of candidates) {
      // @ts-ignore
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
    }
    return "";
  };

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
              user_id: currentUserId,
            }),
          },
          currentUserId
        );
      } catch {}
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
        const incoming = Array.isArray(history) ? history : [];
        setMsgs((prev) => mergeByIdPreserveRefs(prev, incoming));
        markRead(cid);
      } else {
        setMsgs([]);
      }

      // ✅ Auto-scroll to bottom after messages load
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [recipient?.id, markRead, currentUserId, mergeByIdPreserveRefs]);

  // ✅ Heartbeat for current user presence
  const heartbeat = useCallback(async () => {
    if (!currentUserId) return;
    try {
      await apiFetch(
        "/api/presence/heartbeat",
        { method: "POST", body: JSON.stringify({ user_id: currentUserId }) },
        currentUserId
      );
    } catch {}
  }, [currentUserId]);

  // ✅ Fetch recipient presence status
  const fetchRecipientPresence = useCallback(async () => {
    const rid = safeNum((recipient as any)?.id);
    if (!rid || !currentUserId) return;

    try {
      const s = await apiFetch(`/api/presence/status?user_id=${rid}`, {}, currentUserId);
      setRecipientOnline(!!s?.online);
      setRecipientLastSeen(s?.last_seen_at || "");
    } catch {}
  }, [recipient, currentUserId]);

  useEffect(() => {
    fetchHistory();

    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchHistory();
    }, 5000);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [recipient?.id, currentUserId, fetchHistory]);

  // ✅ Presence timers
  useEffect(() => {
    // Immediately ping + fetch
    heartbeat();
    fetchRecipientPresence();

    // Heartbeat every 15s
    const hb = window.setInterval(() => {
      if (document.visibilityState === "visible") heartbeat();
    }, 15000);

    // Refresh recipient presence every 8s
    const pr = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchRecipientPresence();
    }, 8000);

    // Also ping when tab becomes visible
    const onVis = () => {
      if (document.visibilityState === "visible") {
        heartbeat();
        fetchRecipientPresence();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearInterval(hb);
      window.clearInterval(pr);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [heartbeat, fetchRecipientPresence]);

  // Cleanup voice recording on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      if (waveIntervalRef.current) window.clearInterval(waveIntervalRef.current);
      try {
        mediaRecorderRef.current?.stop();
        audioContextRef.current?.close();
        sourceRef.current?.disconnect();
      } catch {}
      try {
        recordStreamRef.current?.getTracks?.().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  // ✅ Auto-scroll when chat opens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [recipient?.id]);

  useEffect(() => {
    scrollToBottom(true);
  }, [msgs.length]);

  const normalized = useMemo(() => {
    const arr = Array.isArray(msgs) ? [...msgs] : [];
    arr.sort((a: any, b: any) => {
      const da = parseDate((a as any)?.created_at);
      const db = parseDate((b as any)?.created_at);
      if (da && db) return da.getTime() - db.getTime();
      return safeNum((a as any)?.id) - safeNum((b as any)?.id);
    });
    return arr;
  }, [msgs]);

  const msgById = useMemo(() => {
    const map = new Map<number, any>();
    for (const m of normalized as any[]) map.set(safeNum((m as any)?.id), m);
    return map;
  }, [normalized]);

  // ✅ stable keys only
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
      out.push({ type: "msg", key: `msg:${safeNum(m?.id)}`, msg: m });
    }
    return out;
  }, [normalized]);

  /* ============================================================
     ✅ Long press unified (message / gif / attachment)
  ============================================================ */
  const cancelLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const startLongPressAny = (args: {
    msg: any;
    mine: boolean;
    kind: "message" | "attachment" | "gif";
    attachment?: any;
    gifUrl?: string;
    evt: any;
  }) => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);

    const { evt, msg, mine, kind, attachment, gifUrl } = args;

    const { clientX, clientY } = (() => {
      const t = evt?.touches?.[0] || evt?.changedTouches?.[0];
      if (t) return { clientX: t.clientX, clientY: t.clientY };
      return { clientX: evt?.clientX ?? 0, clientY: evt?.clientY ?? 0 };
    })();

    longPressTimer.current = window.setTimeout(() => {
      setActionModal({ msg, mine, kind, attachment, gifUrl, x: clientX, y: clientY });
      try {
        (navigator as any).vibrate?.(10);
      } catch {}
    }, 420);
  };

  /* ============================================================
     ✅ Voice record
  ============================================================ */
  const startVoiceNote = async () => {
    if (uploading) return;

    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        alert("Voice recording not supported on this device/browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;

      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      if (waveIntervalRef.current) window.clearInterval(waveIntervalRef.current);
      waveIntervalRef.current = window.setInterval(() => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = Array.from(dataArray.slice(0, 20)).reduce((a, b) => a + b, 0) / 20;
          const normalizedWave = Math.min(100, Math.max(20, average));
          setRecordingWave((prev) => [...prev.slice(-15), normalizedWave]);
        }
      }, 100);

      recordChunksRef.current = [];
      const mimeType = pickBestAudioMime();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };

      mr.onstop = async () => {
        try {
          if (waveIntervalRef.current) {
            window.clearInterval(waveIntervalRef.current);
            waveIntervalRef.current = null;
          }
          setRecordingWave([]);

          recordStreamRef.current?.getTracks?.().forEach((t) => t.stop());
          audioContextRef.current?.close();
          sourceRef.current?.disconnect();
          recordStreamRef.current = null;
          audioContextRef.current = null;
          analyserRef.current = null;
          sourceRef.current = null;

          const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || "audio/webm" });
          recordChunksRef.current = [];

          const ext =
            (mr.mimeType || "").includes("mp4") ? "m4a" : (mr.mimeType || "").includes("mpeg") ? "mp3" : "webm";

          const filename = `voice-${Date.now()}.${ext}`;
          const file = new File([blob], filename, { type: mr.mimeType || "audio/webm" });

          setUploading(true);

          const up = await uploadToR2(file, "chat");

          await send({
            recipient_id: (recipient as any)?.id,
            text_content: null,
            attachments: [
              {
                url: up.url,
                file_type: up.file_type || "audio",
                mime_type: up.mime_type || file.type,
                filename: up.filename || filename,
                size_bytes: up.size_bytes ?? file.size,
                metadata: up.metadata || {},
              },
            ],
          });

          setRecordSeconds(0);
        } catch (e: any) {
          alert(e?.message || "Failed to send voice note");
        } finally {
          setUploading(false);
        }
      };

      mr.start(250);
      setRecording(true);
      setRecordSeconds(0);

      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (e: any) {
      alert(e?.message || "Microphone permission denied");
      try {
        recordStreamRef.current?.getTracks?.().forEach((t) => t.stop());
        audioContextRef.current?.close();
      } catch {}
      recordStreamRef.current = null;
      audioContextRef.current = null;
    }
  };

  const stopVoiceNote = async (cancel = false) => {
    try {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;

      if (waveIntervalRef.current) {
        window.clearInterval(waveIntervalRef.current);
        waveIntervalRef.current = null;
      }
      setRecordingWave([]);

      setRecording(false);

      if (cancel) recordChunksRef.current = [];

      const mr = mediaRecorderRef.current;
      mediaRecorderRef.current = null;

      if (mr && mr.state !== "inactive") {
        mr.stop();
      } else {
        recordStreamRef.current?.getTracks?.().forEach((t) => t.stop());
        audioContextRef.current?.close();
        sourceRef.current?.disconnect();
        recordStreamRef.current = null;
        audioContextRef.current = null;
        analyserRef.current = null;
        sourceRef.current = null;
      }
    } catch {}
  };

  // ==============================
  // CALL FUNCTIONS
  // ==============================
  const startVoiceCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);

      setCallMode("voice");
      setCallPhase("connecting");
      setCallOpen(true);

      // Here you would initiate WebRTC connection and signaling
      // For now, we'll just show the UI
      setTimeout(() => {
        setCallPhase("active");
      }, 2000);
    } catch (err) {
      console.error("Voice call failed", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const startVideoCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      setLocalStream(stream);

      setCallMode("video");
      setCallPhase("connecting");
      setCallOpen(true);

      // Here you would initiate WebRTC connection and signaling
      // For now, we'll just show the UI
      setTimeout(() => {
        setCallPhase("active");
      }, 2000);
    } catch (err) {
      console.error("Video call failed", err);
      alert("Could not access camera/microphone. Please check permissions.");
    }
  };

  const endCall = () => {
    setCallPhase("ended");
    setCallOpen(false);

    try {
      localStream?.getTracks().forEach((t) => t.stop());
    } catch {}

    setLocalStream(null);
    setRemoteStream(null);
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !micOn;
      });
    }
    setMicOn(!micOn);
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !camOn;
      });
    }
    setCamOn(!camOn);
  };

  const toggleSpeaker = () => {
    setSpeakerOn(!speakerOn);
    // Speaker toggle would require audio output device change
    // This is more complex and browser-dependent
  };

  /* ============================================================
     ✅ Sending
  ============================================================ */
  const send = async (payload: any) => {
    if (!currentUserId) throw new Error("User not authenticated");

    const fullPayload = {
      sender_id: currentUserId,
      ...payload,
    };

    const data = await apiFetch(
      "/api/messages/send",
      {
        method: "POST",
        body: JSON.stringify(fullPayload),
      },
      currentUserId
    );

    const msg = data?.message
      ? {
          ...data.message,
          attachments: Array.isArray(data.attachments) ? data.attachments : [],
        }
      : data;

    setMsgs((prev) => mergeByIdPreserveRefs(prev, [msg]));
    if (!conversationId) fetchHistory();
    return msg;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentUserId) return;

    setUploading(true);
    setShowAttachmentMenu(false);

    try {
      const uploaded: any[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const up = await uploadToR2(file, "chat");
        uploaded.push(up);
      }

      const payload: any = {
        recipient_id: (recipient as any)?.id,
        text_content: inputText.trim() || null,
        attachments: uploaded.map((u) => ({
          url: u.url,
          file_type: u.file_type,
          mime_type: u.mime_type,
          filename: u.filename,
          size_bytes: u.size_bytes,
          metadata: u.metadata || {},
        })),
      };

      await send(payload);
      setInputText("");
    } catch (error: any) {
      alert(error?.message || "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed && !replyTo && !editTarget) return;

    setShowEmoji(false);
    setShowStickers(false);
    setShowGifs(false);

    try {
      onSendMessage?.(trimmed);

      // EDIT
      if (editTarget?.id) {
        const updated = await apiFetch(
          `/api/messages/${editTarget.id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              text_content: trimmed,
              user_id: currentUserId,
            }),
          },
          currentUserId
        );

        const updatedMsg = updated?.message || null;
        if (updatedMsg?.id) {
          setMsgs((prev) => mergeByIdPreserveRefs(prev, [updatedMsg]));
        }
        setEditTarget(null);
        setInputText("");
        return;
      }

      // REPLY
      const payload: any = {
        sender_id: currentUserId,
        recipient_id: (recipient as any)?.id,
        text_content: trimmed,
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

  /* ============================================================
     ✅ Delete
  ============================================================ */
  const doDelete = async (m: any, deleteForEveryone: boolean) => {
    if (!currentUserId) return;

    try {
      await apiFetch(
        `/api/messages/${safeNum(m?.id)}`,
        {
          method: "DELETE",
          body: JSON.stringify({
            delete_for_everyone: deleteForEveryone,
            user_id: currentUserId,
          }),
        },
        currentUserId
      );

      setMsgs((prev) => prev.filter((x: any) => safeNum(x?.id) !== safeNum(m?.id)));
    } catch (e: any) {
      alert(e?.message || "Failed to delete");
    }
  };

  const actionBtn = (icon: string, label: string, onClick: () => void, danger = false) => (
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
    <div className="fixed inset-0 z-[200] bg-[#1e1e1e] flex flex-col font-sans overflow-x-hidden">
      {/* ✅ anti horizontal scroll + long link breaking */}
      <style>{`
        html, body { overflow-x: hidden; }
        .msgText, .msgText a { overflow-wrap: anywhere; word-break: break-word; }
      `}</style>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
        onChange={handleFileSelect}
      />

      {/* Header */}
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
              <div className="text-[12px] text-[#b0b3b8] truncate flex items-center">
                {recipientOnline ? (
                  <>
                    Online
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 ml-2 animate-pulse" />
                  </>
                ) : (
                  recipientLastSeen ? formatLastSeen(recipientLastSeen) : "Offline"
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d]"
            aria-label="Voice Call"
            onClick={startVoiceCall}
          >
            <i className="fas fa-phone text-[18px] text-[#1B74E4]" />
          </button>
          <button
            type="button"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d]"
            aria-label="Video Call"
            onClick={startVideoCall}
          >
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
              <div className="text-[12px] text-[#b0b3b8]">{editTarget ? "Editing message" : "Replying to"}</div>
              <div className="text-[13px] text-[#e4e6eb] truncate">{safeStr((editTarget || replyTo)?.text_content) || "…"}</div>
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

      {/* Uploading indicator */}
      {uploading && (
        <div className="px-3 py-2 bg-[#1B74E4]/20 border-b border-[#333]">
          <div className="flex items-center gap-2 text-[#1B74E4]">
            <i className="fas fa-spinner fa-spin" />
            <span className="text-sm">Uploading...</span>
          </div>
        </div>
      )}

      {/* Recording indicator */}
      {recording && (
        <div className="px-3 py-3 border-b border-[#333] bg-[#161616]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <i className="fas fa-circle text-[#ff4d4d] text-[8px] animate-pulse" />
                <span className="text-[#e4e6eb] text-sm font-medium">{recordSeconds}s</span>
              </div>
              <div className="flex items-center gap-[2px] h-6">
                {recordingWave.map((height, i) => (
                  <div
                    key={i}
                    className="w-[3px] bg-[#1B74E4] rounded-full transition-all duration-75"
                    style={{ height: `${height / 2}px` }}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => stopVoiceNote(true)}
              className="px-3 py-1 rounded-full bg-[#2d2d2d] text-[#ff6b6b] text-sm font-medium hover:bg-[#3a3a3a] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-2 sm:px-3 py-3 bg-[#1e1e1e]"
        onClick={() => {
          setShowEmoji(false);
          setShowStickers(false);
          setShowAttachmentMenu(false);
          setShowGifs(false);
        }}
      >
        {loading && msgs.length === 0 ? (
          <div className="text-center text-[#b0b3b8] text-sm py-6">Loading…</div>
        ) : null}

        {rows.map((r, index) => {
          if (r.type === "day") {
            return (
              <div key={r.key} className="flex items-center justify-center my-2">
                <div className="text-[12px] text-[#b0b3b8] bg-[#2d2d2d] px-3 py-1 rounded-full">{r.day}</div>
              </div>
            );
          }

          const msg = r.msg as any;
          const mine = safeNum(msg?.sender_id) === safeNum((currentUser as any)?.id);

          const rawText = safeStr(msg?.text_content);
          const urls = extractUrls(rawText);
          const gifUrls = urls.filter((u) => isGifUrl(u));
          const otherUrls = urls.filter((u) => !gifUrls.includes(u));

          const text = stripUrlsFromText(rawText);

          const d = parseDate(msg?.created_at);
          const edited = !!msg?.edited_at;
          const attachments = Array.isArray(msg?.attachments) ? msg.attachments : [];

          const parentId = safeNum(msg?.parent_message_id, 0);
          const parent = parentId ? msgById.get(parentId) : null;

          const prevRow = rows[index - 1];
          const nextRow = rows[index + 1];
          const prevMsg = prevRow?.type === "msg" ? (prevRow as any).msg : null;
          const nextMsg = nextRow?.type === "msg" ? (nextRow as any).msg : null;

          const sameAsPrev = !!prevMsg && safeNum(prevMsg?.sender_id) === safeNum(msg?.sender_id);
          const sameAsNext = !!nextMsg && safeNum(nextMsg?.sender_id) === safeNum(msg?.sender_id);

          const rowMb = sameAsNext ? "mb-[1px]" : "mb-[6px]";

          const bubbleRadius = mine
            ? [
                "rounded-tl-2xl rounded-bl-2xl",
                sameAsPrev ? "rounded-tr-md" : "rounded-tr-2xl",
                sameAsNext ? "rounded-br-md" : "rounded-br-2xl",
              ].join(" ")
            : [
                "rounded-tr-2xl rounded-br-2xl",
                sameAsPrev ? "rounded-tl-md" : "rounded-tl-2xl",
                sameAsNext ? "rounded-bl-md" : "rounded-bl-2xl",
              ].join(" ");

          return (
            <div key={r.key} className={`w-full flex ${mine ? "justify-end" : "justify-start"} ${rowMb}`}>
              <div className={`max-w-[85%] sm:max-w-[75%] md:max-w-[65%] flex flex-col ${mine ? "items-end" : "items-start"} min-w-0`}>
                {/* Bubble (long press) */}
                {(text || parent || d || edited) && (
                  <div
                    className={[
                      "px-3 py-2 text-[15px] sm:text-[16px] leading-[1.25] break-words overflow-hidden",
                      "select-none",
                      mine ? "bg-[#1B74E4] text-white" : "bg-[#3A3B3C] text-[#e4e6eb]",
                      bubbleRadius,
                    ].join(" ")}
                    onTouchStart={(e) => startLongPressAny({ msg, mine, kind: "message", evt: e })}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onMouseDown={(e) => startLongPressAny({ msg, mine, kind: "message", evt: e })}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                  >
                    {parent && (
                      <div
                        className={`mb-2 px-2 py-1.5 rounded-lg border-l-4 ${
                          mine ? "bg-white/15 border-white/60" : "bg-black/20 border-[#1B74E4]"
                        }`}
                      >
                        <div className={`text-[11px] font-semibold ${mine ? "text-white/90" : "text-[#e4e6eb]"}`}>Reply</div>
                        <div className={`text-[12px] truncate max-w-[200px] ${mine ? "text-white/85" : "text-[#b0b3b8]"}`}>
                          {safeStr(parent?.text_content) ||
                            (Array.isArray(parent?.attachments) && parent.attachments.length ? "📎 Attachment" : "…")}
                        </div>
                      </div>
                    )}

                    {text && <div className="whitespace-pre-wrap msgText">{text}</div>}

                    {/* ✅ Updated footer with WhatsApp ticks */}
                    {d && (
                      <div className="flex justify-end items-center gap-1 mt-1">
                        <span className={`text-[10px] ${mine ? "text-white/70" : "text-[#b0b3b8]"}`}>
                          {formatTime(d)}
                          {edited ? <span className="ml-1 opacity-80">(edited)</span> : null}
                        </span>

                        {/* ✅ WhatsApp style ticks */}
                        <DeliveryTicks msg={msg} mine={mine} />
                      </div>
                    )}
                  </div>
                )}

                {/* GIF previews */}
                {gifUrls.length > 0 &&
                  gifUrls.map((url, idx) => (
                    <GIFPreview
                      key={`gif:${url}:${idx}`}
                      url={url}
                      onView={() => window.open(url, "_blank")}
                      onHold={(e) => startLongPressAny({ msg, mine, kind: "gif", gifUrl: url, evt: e })}
                    />
                  ))}

                {/* Other URL previews */}
                {otherUrls.length > 0 && otherUrls.map((url, idx) => <URLPreview key={`url:${url}:${idx}`} url={url} />)}

                {/* Attachments */}
                {attachments.length > 0 && (
                  <div className="mt-[4px] space-y-1 w-full max-w-full">
                    {attachments.map((a: any) => (
                      <div
                        key={`att:${safeNum(a?.id) || 0}:${safeStr(a?.url || a?.attachment_url)}`}
                        onTouchStart={(e) => startLongPressAny({ msg, mine, kind: "attachment", attachment: a, evt: e })}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                        onMouseDown={(e) => startLongPressAny({ msg, mine, kind: "attachment", attachment: a, evt: e })}
                        onMouseUp={cancelLongPress}
                        onMouseLeave={cancelLongPress}
                      >
                        <AttachmentPreview attachment={a} onView={() => setViewingAttachment(a)} isMine={mine} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Attachment menu */}
      {showAttachmentMenu && (
        <div className="border-t border-[#333] bg-[#1e1e1e] p-3">
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "image/*";
                  fileInputRef.current.multiple = true;
                  fileInputRef.current.click();
                }
              }}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#2d2d2d] transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#1B74E4]/20 flex items-center justify-center">
                <i className="fas fa-image text-2xl text-[#1B74E4]" />
              </div>
              <span className="text-xs text-[#b0b3b8]">Photos</span>
            </button>

            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "video/*";
                  fileInputRef.current.multiple = true;
                  fileInputRef.current.click();
                }
              }}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#2d2d2d] transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#1B74E4]/20 flex items-center justify-center">
                <i className="fas fa-video text-2xl text-[#1B74E4]" />
              </div>
              <span className="text-xs text-[#b0b3b8]">Videos</span>
            </button>

            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "audio/*";
                  fileInputRef.current.multiple = true;
                  fileInputRef.current.click();
                }
              }}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#2d2d2d] transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#1B74E4]/20 flex items-center justify-center">
                <i className="fas fa-music text-2xl text-[#1B74E4]" />
              </div>
              <span className="text-xs text-[#b0b3b8]">Audio</span>
            </button>

            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";
                  fileInputRef.current.multiple = true;
                  fileInputRef.current.click();
                }
              }}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#2d2d2d] transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#1B74E4]/20 flex items-center justify-center">
                <i className="fas fa-file text-2xl text-[#1B74E4]" />
              </div>
              <span className="text-xs text-[#b0b3b8]">Documents</span>
            </button>
          </div>
        </div>
      )}

      {/* Emoji / Stickers / GIF panel */}
      {(showEmoji || showStickers || showGifs) && (
        <div className="border-t border-[#333] bg-[#1e1e1e]">
          {showEmoji && (
            <div className="p-2">
              <EmojiPicker
                onSelect={(emoji: string) => {
                  setInputText((p) => (p ? `${p}${emoji}` : emoji));
                }}
              />
            </div>
          )}

          {showStickers && (
            <div className="p-2">
              <StickerPicker
                onSelect={(stickerText: string) => {
                  sendText(stickerText);
                }}
              />
            </div>
          )}

          {showGifs && (
            <GifPanel
              onSelect={(gifUrl) => {
                sendText(gifUrl);
              }}
            />
          )}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSubmit} className="border-t border-[#333] bg-[#1e1e1e] px-2" style={{ paddingBottom: safeAreaPaddingBottom }}>
        <div className="py-2 flex items-end gap-2">
          {/* Left actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d] transition-colors"
              aria-label="Attach"
              onClick={() => {
                setShowAttachmentMenu(!showAttachmentMenu);
                setShowEmoji(false);
                setShowStickers(false);
                setShowGifs(false);
              }}
            >
              <i className="fas fa-plus text-[18px] text-[#1B74E4]" />
            </button>

            <button
              type="button"
              className="px-2 h-9 rounded-full flex items-center justify-center hover:bg-[#2d2d2d] transition-colors"
              aria-label="GIF"
              onClick={() => {
                setShowGifs((v) => !v);
                setShowEmoji(false);
                setShowStickers(false);
                setShowAttachmentMenu(false);
              }}
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
                setShowAttachmentMenu(false);
                setShowGifs(false);
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
              disabled={uploading || recording}
            />

            <button
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3a3a3a] transition-colors shrink-0"
              aria-label="Emoji"
              onClick={() => {
                setShowEmoji((v) => !v);
                setShowStickers(false);
                setShowAttachmentMenu(false);
                setShowGifs(false);
              }}
            >
              <i className="far fa-smile text-[18px] text-[#1B74E4]" />
            </button>

            <button
              type="button"
              className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3a3a3a] transition-colors shrink-0 ${
                recording ? "text-[#ff4d4d]" : ""
              }`}
              aria-label="Voice"
              onClick={() => {
                if (recording) stopVoiceNote(false);
                else startVoiceNote();
              }}
              disabled={uploading}
            >
              <i className={`fas ${recording ? "fa-stop" : "fa-microphone"} text-[18px] text-[#1B74E4]`} />
            </button>
          </div>

          {/* Send or Like */}
          {canSend || editTarget ? (
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-[#1B74E4] flex items-center justify-center hover:bg-[#1A6ED8] transition-colors shrink-0"
              aria-label="Send"
              disabled={uploading || recording}
            >
              <i className="fas fa-paper-plane text-[16px] text-white" />
            </button>
          ) : (
            <button
              type="button"
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#2d2d2d] transition-colors shrink-0"
              aria-label="Like"
              onClick={() => sendText("👍")}
              disabled={uploading || recording}
            >
              <i className="fas fa-thumbs-up text-[20px] text-[#1B74E4]" />
            </button>
          )}
        </div>
      </form>

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-[300]" onClick={closeActionModal} onTouchStart={closeActionModal} role="presentation">
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
              <div className="text-[14px] text-[#e4e6eb] break-words" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
                {(() => {
                  if (actionModal.kind === "gif") return "🖼️ GIF";
                  if (actionModal.kind === "attachment") return "📎 Attachment";
                  return safeStr(actionModal.msg?.text_content) || "…";
                })()}
              </div>
            </div>

            <div className="space-y-1">
              {/* Reply */}
              {actionBtn("fas fa-reply", "Reply", () => {
                const m = actionModal.msg;
                closeActionModal();
                setEditTarget(null);
                setReplyTo(m);
              })}

              {/* ✅ Download (REAL) */}
              {actionModal.kind !== "message" &&
                actionBtn("fas fa-download", "Download", async () => {
                  const url =
                    actionModal.kind === "gif"
                      ? safeStr(actionModal.gifUrl)
                      : safeStr(actionModal.attachment?.url || actionModal.attachment?.attachment_url);

                  const name =
                    actionModal.kind === "attachment"
                      ? safeStr(actionModal.attachment?.filename || actionModal.attachment?.name || "download")
                      : "gif.gif";

                  closeActionModal();
                  if (url) await forceDownload(url, name);
                })}

              {/* Edit */}
              {actionModal.mine && actionModal.kind === "message"
                ? actionBtn("fas fa-pen", "Edit", () => {
                    const m = actionModal.msg;
                    closeActionModal();
                    setReplyTo(null);
                    setEditTarget(m);
                    setInputText(safeStr(m?.text_content) || "");
                    setTimeout(() => {
                      const el = document.querySelector<HTMLInputElement>(
                        'input[placeholder="Edit message"], input[placeholder="Message"]'
                      );
                      el?.focus?.();
                    }, 50);
                  })
                : null}

              {/* Delete */}
              {actionBtn("fas fa-trash", "Delete", async () => {
                const m = actionModal.msg;
                closeActionModal();
                await doDelete(m, false);
              }, true)}

              {/* Delete for everyone */}
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

            <div style={{ height: "max(env(safe-area-inset-bottom), 8px)" }} />
          </div>
        </div>
      )}

      {/* Attachment Viewer Modal */}
      {viewingAttachment && (
        <div className="fixed inset-0 z-[400] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewingAttachment(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
            <button
              onClick={() => setViewingAttachment(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80"
            >
              <i className="fas fa-times text-white text-xl" />
            </button>

            {(() => {
              const att = viewingAttachment;
              const url = att?.url || att?.attachment_url;
              const mime = att?.mime_type || att?.type || att?.attachment_type || "";
              const fileType = att?.file_type || "";
              const name = att?.filename || att?.name || "Attachment";
              const size = att?.size_bytes ?? att?.size ?? att?.file_size;

              const isImg = fileType === "image" || String(mime).startsWith("image/");
              const isVid = fileType === "video" || String(mime).startsWith("video/");
              const isAud = fileType === "audio" || String(mime).startsWith("audio/");

              if (isImg) return <img src={url} alt={name} className="max-w-full max-h-[90vh] object-contain" />;

              if (isVid) {
                return (
                  <video src={url} controls autoPlay className="max-w-full max-h-[90vh]">
                    <source src={url} type={mime} />
                    Your browser does not support the video tag.
                  </video>
                );
              }

              if (isAud) {
                return (
                  <div className="bg-[#242526] rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <i className="fas fa-microphone text-3xl text-[#1B74E4]" />
                        <div className="min-w-0">
                          <div className="text-white font-semibold truncate">{name}</div>
                          {size ? <div className="text-[#b0b3b8] text-sm">{formatFileSize(size)}</div> : null}
                        </div>
                      </div>

                      <VoiceNoteWA src={url} isMine={false} />

                      <button
                        type="button"
                        onClick={() => forceDownload(url, name)}
                        className="bg-[#1B74E4] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1A6ED8] text-center"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="bg-[#242526] rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <i className={`${getFileIcon(mime)} text-3xl text-[#1B74E4]`} />
                      <div className="min-w-0">
                        <div className="text-white font-semibold truncate">{name}</div>
                        {size ? <div className="text-[#b0b3b8] text-sm">{formatFileSize(size)}</div> : null}
                      </div>
                    </div>

                    {mime.startsWith("text/") || mime === "application/pdf" ? (
                      <iframe src={url} className="w-full h-[60vh] rounded-lg" title={name} />
                    ) : null}

                    <button
                      type="button"
                      onClick={() => forceDownload(url, name)}
                      className="bg-[#1B74E4] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1A6ED8] text-center"
                    >
                      Download
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Call Screen */}
      <CallScreen
        open={callOpen}
        mode={callMode}
        phase={callPhase}
        peerName={recipient?.name || "User"}
        peerAvatar={recipient?.profile_image_url || null}
        localStream={localStream}
        remoteStream={remoteStream}
        micOn={micOn}
        camOn={camOn}
        speakerOn={speakerOn}
        onHangup={endCall}
        onToggleMic={toggleMic}
        onToggleCam={toggleCamera}
        onToggleSpeaker={toggleSpeaker}
      />
    </div>
  );
};

// Add both named and default exports
export { ChatWindow };
export default ChatWindow;
