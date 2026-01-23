// components/Story.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Story, User } from "../types";

const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeString = (v: any, fallback = "") => (typeof v === "string" ? v : fallback);

const isVideo = (mimeOrUrl: string) => {
  const v = (mimeOrUrl || "").toLowerCase();
  return v.includes("video/") || v.endsWith(".mp4") || v.endsWith(".webm") || v.endsWith(".mov");
};

const isImage = (mimeOrUrl: string) => {
  const v = (mimeOrUrl || "").toLowerCase();
  return v.includes("image/") || v.endsWith(".png") || v.endsWith(".jpg") || v.endsWith(".jpeg") || v.endsWith(".webp");
};

const formatAge = (iso: any) => {
  try {
    const t = new Date(String(iso)).getTime();
    if (!Number.isFinite(t)) return "";
    const diff = Date.now() - t;
    const min = Math.floor(diff / 60000);
    if (min < 1) return "Just now";
    if (min < 60) return `${min}min`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}hr`;
    const d = Math.floor(hr / 24);
    return `${d}d`;
  } catch {
    return "";
  }
};

// Simple “24h expiry” filter (UI-safe)
const isExpired = (s: any) => {
  const created = new Date(String(s?.created_at ?? s?.createdAt ?? "")).getTime();
  if (!Number.isFinite(created)) return false;
  const diff = Date.now() - created;
  return diff > 24 * 60 * 60 * 1000;
};

type StoryReelProps = {
  stories: Story[];
  currentUser: User | null;
  onProfileClick: (id: number) => void;
  onCreateStory: () => void;
  onViewStory: (story: Story) => void;
  onRequestLogin: () => void;
};

export function StoryReel({
  stories,
  currentUser,
  onProfileClick,
  onCreateStory,
  onViewStory,
  onRequestLogin,
}: StoryReelProps) {
  const list = useMemo(() => {
    const raw = safeArray<Story>(stories).filter((s: any) => !isExpired(s));
    // newest first
    return raw.sort((a: any, b: any) => String(b?.created_at ?? "").localeCompare(String(a?.created_at ?? "")));
  }, [stories]);

  return (
    <div className="w-full">
      <div className="bg-[#242526] border border-[#3E4042] rounded-2xl p-3 md:p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-white font-semibold">Stories</div>
          <button
            className="text-[#1877F2] font-semibold hover:opacity-90"
            onClick={() => {
              if (!currentUser) return onRequestLogin();
              onCreateStory();
            }}
          >
            Create
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" as any }}>
          {/* Create Story Card */}
          <button
            className="min-w-[120px] w-[120px] h-[190px] rounded-2xl overflow-hidden bg-[#18191A] border border-[#3E4042] hover:opacity-95 transition"
            onClick={() => {
              if (!currentUser) return onRequestLogin();
              onCreateStory();
            }}
            aria-label="Create Story"
          >
            <div className="h-[120px] bg-gradient-to-b from-[#1877F2] to-[#0f5dc7] flex items-center justify-center">
              {currentUser?.profile_image_url ? (
                <img
                  src={currentUser.profile_image_url}
                  className="w-14 h-14 rounded-full border-2 border-white object-cover"
                  alt="me"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#3A3B3C]" />
              )}
            </div>
            <div className="h-[70px] flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-[#1877F2] text-white flex items-center justify-center -mt-6 border-4 border-[#18191A]">
                <i className="fas fa-plus text-sm" />
              </div>
              <div className="text-white text-sm font-semibold mt-2">Create story</div>
            </div>
          </button>

          {/* Story Cards */}
          {list.map((s: any) => {
            const sid = safeNumber(s?.id ?? s?.story_id ?? s?.storyId);
            const uid = safeNumber(s?.user_id ?? s?.userId ?? s?.author_id);
            const mediaUrl = safeString(s?.media_url ?? s?.mediaUrl ?? s?.url ?? "");
            const mediaType = safeString(s?.media_type ?? s?.mediaType ?? "");
            const username = safeString(s?.username ?? s?.user?.username ?? "user");
            const name = safeString(s?.name ?? s?.user?.name ?? username);

            const bg = mediaUrl ? `url(${mediaUrl})` : "none";
            const age = formatAge(s?.created_at ?? s?.createdAt);

            return (
              <button
                key={sid || `${uid}-${mediaUrl}-${s?.created_at ?? ""}`}
                className="min-w-[120px] w-[120px] h-[190px] rounded-2xl overflow-hidden bg-[#18191A] border border-[#3E4042] relative hover:opacity-95 transition"
                onClick={() => onViewStory(s)}
                aria-label={`Open story ${name}`}
              >
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: bg }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

                {/* top row */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                  <button
                    className="flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (uid) onProfileClick(uid);
                    }}
                    aria-label="Open profile"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#3A3B3C] border-2 border-[#1877F2] overflow-hidden">
                      {s?.profile_image_url ? (
                        <img src={s.profile_image_url} className="w-full h-full object-cover" alt="avatar" />
                      ) : null}
                    </div>
                  </button>

                  {!!age && <div className="text-white/90 text-xs font-semibold">{age}</div>}
                </div>

                {/* bottom name */}
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="text-white text-sm font-semibold leading-tight line-clamp-2">
                    {name}
                  </div>
                </div>

                {/* video indicator */}
                {(isVideo(mediaType) || isVideo(mediaUrl)) && (
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center">
                    <i className="fas fa-play text-white text-xs" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type StoryViewerModalProps = {
  story: Story;
  onClose: () => void;
  onProfileClick?: (id: number) => void;
};

export function StoryViewerModal({ story, onClose, onProfileClick }: StoryViewerModalProps) {
  const mediaUrl = safeString((story as any)?.media_url ?? (story as any)?.mediaUrl ?? (story as any)?.url ?? "");
  const mediaType = safeString((story as any)?.media_type ?? (story as any)?.mediaType ?? "");
  const uid = safeNumber((story as any)?.user_id ?? (story as any)?.userId ?? (story as any)?.author_id);
  const name = safeString((story as any)?.name ?? (story as any)?.username ?? "Story");

  const isVid = isVideo(mediaType) || isVideo(mediaUrl);
  const isImg = isImage(mediaType) || isImage(mediaUrl);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // auto play
    if (isVid && videoRef.current) {
      const v = videoRef.current;
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  }, [isVid, mediaUrl]);

  // ESC close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-[520px]">
        <div className="bg-[#242526] border border-[#3E4042] rounded-2xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#3E4042]">
            <button
              className="flex items-center gap-2 text-white"
              onClick={() => (uid && onProfileClick ? onProfileClick(uid) : null)}
            >
              <i className="fas fa-user-circle text-[#B0B3B8]" />
              <span className="font-semibold">{name}</span>
            </button>

            <button className="text-[#B0B3B8] hover:text-white" onClick={onClose} aria-label="Close story">
              <i className="fas fa-times" />
            </button>
          </div>

          <div className="bg-black flex items-center justify-center min-h-[520px]">
            {isVid ? (
              <video
                ref={videoRef}
                src={mediaUrl}
                className="w-full h-[520px] object-contain"
                controls
                playsInline
              />
            ) : isImg ? (
              <img src={mediaUrl} className="w-full h-[520px] object-contain" alt="story" />
            ) : (
              <div className="text-[#B0B3B8] p-10 text-center">Unsupported story media</div>
            )}
          </div>
        </div>
      </div>

      {/* click outside closes */}
      <button
        className="absolute inset-0 w-full h-full"
        style={{ background: "transparent" }}
        onClick={onClose}
        aria-label="Backdrop"
      />
    </div>
  );
}

type CreateStoryModalProps = {
  currentUser: User;
  onClose: () => void;
  onCreate: (payload: { text?: string; file?: File | null }) => void;
};

export function CreateStoryModal({ currentUser, onClose, onCreate }: CreateStoryModalProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-[520px] bg-[#242526] border border-[#3E4042] rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3E4042]">
          <div className="text-white font-semibold">Create Story</div>
          <button className="text-[#B0B3B8] hover:text-white" onClick={onClose}>
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <img
              src={currentUser.profile_image_url}
              className="w-10 h-10 rounded-full object-cover"
              alt="me"
            />
            <div>
              <div className="text-white font-semibold">{currentUser.name}</div>
              <div className="text-[#B0B3B8] text-xs">Visible for 24 hours</div>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Say something..."
            className="w-full min-h-[90px] bg-[#18191A] border border-[#3E4042] rounded-xl p-3 text-white outline-none"
          />

          <div className="mt-3">
            <label className="block text-[#B0B3B8] text-sm mb-2">Photo / Video</label>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-[#B0B3B8]"
            />
          </div>

          <div className="flex gap-2 justify-end mt-5">
            <button
              className="px-4 py-2 rounded-xl bg-[#3A3B3C] text-white hover:opacity-90"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-[#1877F2] text-white hover:opacity-90"
              onClick={() => onCreate({ text: text.trim(), file })}
            >
              Share to story
            </button>
          </div>
        </div>
      </div>

      {/* click outside closes */}
      <button
        className="absolute inset-0 w-full h-full"
        style={{ background: "transparent" }}
        onClick={onClose}
        aria-label="Backdrop"
      />
    </div>
  );
}
