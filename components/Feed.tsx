import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  User,
  Post as PostType,
  ReactionType,
  Product,
  LinkPreview,
  AudioTrack,
  Group,
  Brand,
} from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { LOCATIONS_DATA, MARKETPLACE_COUNTRIES } from '../constants';

/**
 * =========================
 * API HELPERS
 * =========================
 */
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData) headers['Content-Type'] = (headers['Content-Type'] as string) || 'application/json';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, { 
      ...options, 
      headers,
      signal: controller.signal 
    });

    const contentType = res.headers.get('content-type') || '';
    let data: any = null;

    try {
      if (contentType.includes('application/json')) data = await res.json();
      else {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      }
    } catch (e: any) {
      data = { error: e?.message || 'Failed to parse response' };
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * =========================
 * SMALL HELPERS
 * =========================
 */
const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeString = (v: any, fallback = '') => (typeof v === 'string' ? v : fallback);

const safeUserId = (u: any) => safeNumber(u?.id ?? u?.user_id ?? u?.userId, 0);
const safePostId = (p: any) => safeNumber(p?.id ?? p?.post_id ?? p?.postId, 0);

/**
 * =========================
 * ✅ FIXED: TIMEZONE-SAFE RELATIVE TIME FORMATTER
 * =========================
 */
const toDateSafe = (input: any): Date | null => {
  if (!input) return null;

  if (input instanceof Date && Number.isFinite(input.getTime())) return input;

  if (typeof input === 'number') {
    const ms = input < 1e12 ? input * 1000 : input;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  if (typeof input === 'string') {
    const s = input.trim();

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
      const iso = s.replace(' ', 'T') + 'Z';
      const d = new Date(iso);
      return Number.isFinite(d.getTime()) ? d : null;
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) {
      const d = new Date(s + 'Z');
      return Number.isFinite(d.getTime()) ? d : null;
    }

    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  return null;
};

export const formatRelativeTime = (dateInput: any): string => {
  const d = toDateSafe(dateInput);
  if (!d) return 'Just now';

  const now = Date.now();
  let diffMs = now - d.getTime();

  if (diffMs < 0) diffMs = 0;

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'Just now';

  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? '1 min' : `${min} mins`;

  const hrs = Math.floor(min / 60);
  if (hrs < 24) return hrs === 1 ? '1 hr' : `${hrs} hrs`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return days === 1 ? '1 day' : `${days} days`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return weeks === 1 ? '1 week' : `${weeks} weeks`;

  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month' : `${months} months`;

  const years = Math.floor(days / 365);
  return years === 1 ? '1 year' : `${years} years`;
};

/**
 * =========================
 * LINK PREVIEW
 * =========================
 */
const getLinkPreview = (text: string): LinkPreview | null => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = text.match(urlRegex);
  if (!match?.[0]) return null;

  const url = match[0];
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    return null;
  }

  if (domain.includes('youtube')) {
    return {
      url,
      title: 'YouTube Video',
      description: 'Watch this video on YouTube.',
      image:
        'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80',
      domain: 'youtube.com',
    };
  }

  if (domain.includes('github')) {
    return {
      url,
      title: 'GitHub Repository',
      description: 'Open source project on GitHub.',
      image:
        'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?auto=format&fit=crop&w=800&q=80',
      domain: 'github.com',
    };
  }

  return {
    url,
    title: 'Website Link',
    description: `Link from ${domain}.`,
    image:
      'https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&w=800&q=80',
    domain,
  };
};

const BACKGROUNDS = [
  { id: 'none', value: '' },
  { id: 'red', value: 'linear-gradient(45deg, #FF0057, #E64C4C)' },
  { id: 'blue', value: 'linear-gradient(45deg, #00C6FF, #0072FF)' },
  { id: 'green', value: 'linear-gradient(45deg, #a8ff78, #78ffd6)' },
  { id: 'purple', value: 'linear-gradient(45deg, #e65c00, #F9D423)' },
  {
    id: 'heart',
    value:
      'url("https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=500&q=60")',
  },
  { id: 'dark', value: 'linear-gradient(to right, #434343 0%, black 100%)' },
  { id: 'fire', value: 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)' },
];

const FEELINGS = [
  'Happy',
  'Blessed',
  'Loved',
  'Sad',
  'Excited',
  'Thankful',
  'Crazy',
  'Tired',
  'Cool',
  'Relaxed',
];

// ✅ UPDATED: Increased emojis to 25+ with most lovely emojis
const QUICK_EMOJIS = [
  '😀', '😂', '😍', '🥰', '😘', '😊', '😉', '😇', '🥳', '😎',
  '🤩', '😋', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
  '😐', '😑', '😶', '🙄', '😏', '😒', '😞', '😔', '😟', '😕',
  '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤',
  '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰',
  '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑',
  '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤',
  '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕',
  '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀',
  '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼',
  '😽', '🙀', '😿', '😾', '👋', '🤚', '🖐️', '✋', '🖖', '👌',
  '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕',
  '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌',
  '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵',
  '🦿', '🦶', '👣', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀',
  '👁️', '👅', '👄', '💋', '🩸', '💘', '💝', '💖', '💗', '💓',
  '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙',
  '💜', '🖤', '🤍', '🤎', '💯', '💢', '💥', '💫', '💦', '💨',
  '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤', '🔴', '🟠',
  '🟡', '🟢', '🔵', '🟣', '🟤', '⚫', '⚪', '🟥', '🟧', '🟨',
  '🟩', '🟦', '🟪', '🟫', '⬛', '⬜', '◼️', '◻️', '◾', '◽',
  '▪️', '▫️', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘',
  '🔳', '🔲', '🎵', '🎶', '🎼', '🎤', '🎧', '🎷', '🎸', '🎹',
  '🎺', '🎻', '🥁', '📱', '📲', '☎️', '📞', '📟', '📠', '🔋',
  '🔌', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '🖲️', '💽', '💾', '💿',
  '📀', '🎥', '🎞️', '📽️', '🎬', '📺', '📷', '📸', '📹', '📼',
  '🔍', '🔎', '🕯️', '💡', '🔦', '🏮', '📔', '📕', '📖', '📗',
  '📘', '📙', '📚', '📓', '📒', '📃', '📜', '📄', '📰', '🗞️',
  '📑', '🔖', '🏷️', '💰', '💴', '💵', '💶', '💷', '💸', '💳',
  '🧾', '💎', '⚖️', '🦯', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩',
  '⚙️', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️',
  '⚔️', '🛡️', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈',
  '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬',
  '🦠', '🧫', '🧪', '🌡️', '🧹', '🧺', '🧻', '🚽', '🚰', '🚿',
  '🛁', '🧼', '🪒', '🧽', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑',
  '🛋️', '🛏️', '🧸', '🖼️', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀',
  '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧',
  '💌', '📥', '📤', '📦', '🏷️', '📪', '📫', '📬', '📭', '📮',
  '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️',
  '🗓️', '📆', '📅', '🗑️', '📇', '📋', '📁', '📂', '🗂️', '🗄️',
  '📒', '📓', '📔', '📕', '📖', '📗', '📘', '📙', '📚', '📖',
  '🔖', '🧷', '🔗', '📎', '🖇️', '📏', '📐', '✂️', '🗃️', '🗳️',
  '🖋️', '🖊️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐',
  '🔒', '🔓'
];

/**
 * =========================
 * ✅ ENHANCED FACEBOOK-STYLE REACTION DOCK WITH 25+ EMOJIS
 * =========================
 */
// Add these styles to your global CSS or create a style tag
const reactionStyles = `
  @keyframes popFloat {
    0% { transform: translateY(6px) scale(0.9); opacity: 0; }
    60% { transform: translateY(-6px) scale(1.15); opacity: 1; }
    100% { transform: translateY(0px) scale(1); }
  }
  
  @keyframes wiggle {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-2deg); }
    75% { transform: rotate(2deg); }
  }
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  
  .react-pop { animation: popFloat 220ms ease-out; }
  .react-hover { transition: transform 120ms ease; }
  .react-hover:hover { 
    transform: translateY(-10px) scale(1.25); 
    animation: wiggle 300ms ease-in-out; 
  }
  
  .reaction-preview {
    animation: bounce 0.5s infinite alternate;
  }
`;

/**
 * =========================
 * ✅ ADDED: ExpandableRichText Component for Show More/Show Less
 * =========================
 */
const ExpandableRichText: React.FC<{
  text: string;
  users?: User[];
  onProfileClick: (id: number) => void;
  onHashtagClick?: (tag: string) => void;
  maxWords?: number;
  fontSizePx?: number;
}> = ({ text, users, onProfileClick, onHashtagClick, maxWords = 25, fontSizePx = 21 }) => {
  const [expanded, setExpanded] = useState(false);

  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  const isLong = words.length > maxWords;

  const shownText = !isLong
    ? text
    : expanded
      ? text
      : words.slice(0, maxWords).join(' ') + '…';

  return (
    <div style={{ fontSize: `${fontSizePx}px` }} className="text-[#E4E6EB] leading-relaxed">
      <RichText
        text={shownText}
        users={users}
        onProfileClick={onProfileClick}
        onHashtagClick={onHashtagClick}
      />

      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="ml-2 font-bold text-[#1877F2] hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

/**
 * =========================
 * RICH TEXT (hashtags + mentions)
 * =========================
 */
export const RichText = ({
  text,
  users,
  onProfileClick,
  onHashtagClick,
}: {
  text: string;
  users?: User[];
  onProfileClick: (id: number) => void;
  onHashtagClick?: (tag: string) => void;
}) => {
  if (!text) return null;
  const parts = text.split(/(#[a-zA-Z0-9_]+|@\w+(?:\s\w+)?)/g);

  return (
    <span className="leading-relaxed text-[#E4E6EB] whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          const name = part.substring(1).trim().toLowerCase();
          const user = users?.find((u: any) => {
            const un = String(u?.username ?? '').toLowerCase();
            const nm = String(u?.name ?? '').toLowerCase();
            return un === name || nm === name;
          });

          if (user) {
            return (
              <span
                key={index}
                className="text-[#1877F2] font-semibold cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onProfileClick(safeUserId(user));
                }}
              >
                {part}
              </span>
            );
          }

          return (
            <span key={index} className="text-[#1877F2] font-semibold">
              {part}
            </span>
          );
        }

        if (part.startsWith('#')) {
          return (
            <span
              key={index}
              className="text-[#1877F2] cursor-pointer hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onHashtagClick && onHashtagClick(part);
              }}
            >
              {part}
            </span>
          );
        }

        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

/**
 * =========================
 * ✅ UPDATED: FACEBOOK-STYLE REACTION BUTTON - CLICK SHOWS EMOJIS WITHOUT AUTO-ADDING FIRST
 * =========================
 */
export const ReactionButton: React.FC<{
  currentUserReactions: ReactionType | undefined;
  reactionCount: number;
  onReact: (type: ReactionType) => void;
  isGuest?: boolean;
}> = ({ currentUserReactions, reactionCount, onReact, isGuest }) => {
  const [showDock, setShowDock] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewEmoji, setPreviewEmoji] = useState<string>('👍');
  const timerRef = useRef<any>(null);
  const longPressTimerRef = useRef<any>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  // Add styles on mount
  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.textContent = reactionStyles;
    document.head.appendChild(styleTag);
    
    return () => {
      document.head.removeChild(styleTag);
    };
  }, []);

  // Enhanced reaction config with 25+ emojis
  const reactionConfig = [
    { type: 'like', icon: '👍', color: '#1877F2', label: 'Like' },
    { type: 'love', icon: '❤️', color: '#F3425F', label: 'Love' },
    { type: 'haha', icon: '😂', color: '#F7B928', label: 'Haha' },
    { type: 'wow', icon: '😮', color: '#F7B928', label: 'Wow' },
    { type: 'sad', icon: '😢', color: '#F7B928', label: 'Sad' },
    { type: 'angry', icon: '😡', color: '#E41E3F', label: 'Angry' },
    { type: 'fire', icon: '🔥', color: '#FF6B35', label: 'Fire' },
    { type: 'party', icon: '🎉', color: '#9C27B0', label: 'Party' },
    { type: 'clap', icon: '👏', color: '#4CAF50', label: 'Clap' },
    { type: 'star', icon: '⭐', color: '#FFD700', label: 'Star' },
    { type: 'thinking', icon: '🤔', color: '#607D8B', label: 'Thinking' },
    { type: 'crying', icon: '😭', color: '#2196F3', label: 'Crying' },
    { type: 'heart_eyes', icon: '🥰', color: '#E91E63', label: 'Heart Eyes' },
    { type: 'kiss', icon: '😘', color: '#FF4081', label: 'Kiss' },
    { type: 'sunglasses', icon: '😎', color: '#00BCD4', label: 'Cool' },
    { type: 'rocket', icon: '🚀', color: '#3F51B5', label: 'Rocket' },
    { type: 'trophy', icon: '🏆', color: '#FF9800', label: 'Trophy' },
    { type: 'crown', icon: '👑', color: '#FFC107', label: 'Crown' },
    { type: 'unicorn', icon: '🦄', color: '#E040FB', label: 'Unicorn' },
    { type: 'rainbow', icon: '🌈', color: '#00E676', label: 'Rainbow' },
    { type: 'money', icon: '💰', color: '#4CAF50', label: 'Money' },
    { type: 'muscle', icon: '💪', color: '#FF5722', label: 'Muscle' },
    { type: 'brain', icon: '🧠', color: '#9C27B0', label: 'Brain' },
    { type: 'lightning', icon: '⚡', color: '#FFEB3B', label: 'Lightning' },
    { type: 'gem', icon: '💎', color: '#00BCD4', label: 'Gem' },
  ] as const;

  const handleMouseEnter = () => {
    if (isGuest) return;
    timerRef.current = setTimeout(() => setShowDock(true), 500);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => setShowDock(false), 250);
    setShowPreview(false);
  };

  // Handle long press on mobile
  const handleTouchStart = () => {
    if (isGuest) return;
    longPressTimerRef.current = setTimeout(() => {
      setShowDock(true);
      setShowPreview(true);
      setPreviewEmoji('👍');
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    setTimeout(() => setShowPreview(false), 300);
  };

  // ✅ UPDATED: Click only shows emojis, doesn't auto-add first one
  const handleClick = () => {
    if (isGuest) return alert('Please login to react.');
    if (currentUserReactions) {
      // If already reacted, clicking removes reaction
      setIsAnimating(true);
      onReact(currentUserReactions); // This will toggle off the current reaction
      setTimeout(() => setIsAnimating(false), 300);
    } else {
      // If not reacted, show emoji dock
      setShowDock(!showDock);
    }
  };

  const handleDockReact = (type: ReactionType) => {
    setIsAnimating(true);
    onReact(type);
    setShowDock(false);
    setShowPreview(false);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleEmojiHover = (emoji: string) => {
    if (showPreview) {
      setPreviewEmoji(emoji);
    }
  };

  const activeReaction = currentUserReactions
    ? reactionConfig.find((r) => r.type === currentUserReactions)
    : null;

  return (
    <div
      className="flex-1 relative group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Preview emoji on long press */}
      {showPreview && (
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-[#242526] rounded-full shadow-2xl p-3 border border-[#3E4042] z-50 reaction-preview">
          <div className="text-3xl">
            {previewEmoji}
          </div>
        </div>
      )}

      {/* Enhanced reaction dock with 25+ emojis */}
      {showDock && (
        <div 
          ref={dockRef}
          className="absolute -top-16 left-0 bg-[#242526] rounded-full shadow-2xl p-2 border border-[#3E4042] z-50 react-pop flex items-center"
        >
          <div className="flex gap-1 overflow-x-auto max-w-[320px] scrollbar-hide px-1 py-1">
            {reactionConfig.map((r) => (
              <div
                key={r.type}
                className="text-2xl react-hover cursor-pointer p-1 rounded-full hover:bg-[#3A3B3C] transition-colors flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDockReact(r.type as ReactionType);
                }}
                onMouseEnter={() => handleEmojiHover(r.icon)}
                title={r.label}
              >
                {r.icon}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`w-full flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-all duration-200 active:scale-95 ${
          isAnimating ? 'scale-110' : ''
        }`}
      >
        {activeReaction ? (
          <>
            <span className="text-[20px] transition-transform duration-300">
              {activeReaction.icon}
            </span>
            <span
              className="text-[17px] font-medium capitalize transition-colors duration-300"
              style={{ color: activeReaction.color }}
            >
              {activeReaction.label}
            </span>
          </>
        ) : (
          <>
            <i className="far fa-thumbs-up text-[20px] text-[#B0B3B8]"></i>
            <span className="text-[17px] font-medium text-[#B0B3B8]">Like</span>
          </>
        )}
      </button>
    </div>
  );
};

/**
 * =========================
 * ROBUST MEDIA TYPE DETECTION FOR CLOUDFLARE R2
 * =========================
 */
const getMediaTypeInfo = (post: any) => {
  const mediaUrl = String(post?.media_url || '');
  const mediaTypeRaw = String(post?.media_type || '').toLowerCase();
  const typeRaw = String(post?.type || '').toLowerCase();

  // Extract file extension from URL
  const cleanUrl = mediaUrl.split('?')[0].split('#')[0];
  const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';

  // Check if it's an image
  const isImage =
    typeRaw === 'image' ||
    mediaTypeRaw === 'image' ||
    mediaTypeRaw.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic'].includes(ext);

  // Check if it's a video
  const isVideo =
    typeRaw === 'video' ||
    mediaTypeRaw === 'video' ||
    mediaTypeRaw.startsWith('video/') ||
    ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'flv', 'wmv', '3gp'].includes(ext);

  // Check if it's audio
  const isAudio =
    typeRaw === 'audio' ||
    mediaTypeRaw.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext);

  return {
    mediaUrl,
    isImage,
    isVideo,
    isAudio,
    extension: ext,
    mimeType: mediaTypeRaw,
  };
};

/**
 * =========================
 * ✅ UPDATED: SHARE BOTTOM SHEET WITH REAL SHARE COUNT
 * =========================
 */
export const ShareBottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  post: any;
  currentUser: User | null;
  users?: User[];
  groups?: Group[];
  brands?: Brand[];
  chats?: any[];
  onShareComplete?: (destination: string, data?: any) => void;
}> = ({ isOpen, onClose, post, currentUser, users = [], groups = [], brands = [], chats = [], onShareComplete }) => {
  const [activeFlow, setActiveFlow] = useState<'sheet' | 'feed' | 'groups' | 'messages'>('sheet');
  const [isAnimating, setIsAnimating] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleBackdropClick = (e: MouseEvent) => {
      if (backdropRef.current && e.target === backdropRef.current) {
        closeSheet();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeSheet();
      }
    };

    if (isOpen) {
      setActiveFlow('sheet');
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);
      document.body.style.overflow = 'hidden';
      document.addEventListener('click', handleBackdropClick);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('click', handleBackdropClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const closeSheet = () => {
    setIsAnimating(true);
    setTimeout(() => {
      onClose();
      setActiveFlow('sheet');
      setIsAnimating(false);
    }, 200);
  };

  const handleShareAction = async (destination: string) => {
    if (!currentUser) {
      alert('Please login to share.');
      return;
    }

    try {
      const payload = {
        post_id: post.id,
        user_id: currentUser.id,
        destination,
        shared_at: new Date().toISOString(),
      };

      const response = await apiFetch('/api/posts/share', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (onShareComplete) {
        onShareComplete(destination, { 
          success: true, 
          data: response,
          shares: response?.shares || response?.share_count || (post.shares || 0) + 1
        });
      }

      closeSheet();
    } catch (error: any) {
      console.error('Share failed:', error);
      if (onShareComplete) {
        onShareComplete(destination, { 
          success: false, 
          error: error.message 
        });
      }
    }
  };

  if (!isOpen) return null;

  if (activeFlow === 'feed' && currentUser) {
    return (
      <div className="fixed inset-0 z-[500] bg-[#18191A] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-[#3E4042]">
          <div className="flex items-center gap-4">
            <i
              className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
              onClick={() => setActiveFlow('sheet')}
            ></i>
            <h3 className="text-[#E4E6EB] text-[20px] font-medium">Share to UNERA Feed</h3>
          </div>
          <button
            onClick={() => handleShareAction('feed')}
            className="text-[#1877F2] font-bold text-[17px]"
          >
            POST
          </button>
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-center gap-3 mb-4">
            <img
              src={currentUser.profile_image_url || 'https://ui-avatars.com/api/?name=User'}
              alt=""
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <div className="text-[#E4E6EB] font-bold">{currentUser.name}</div>
              <select className="bg-[#3A3B3C] text-[#E4E6EB] text-sm px-3 py-1 rounded-lg mt-1">
                <option>🌍 Public</option>
                <option>👥 Friends</option>
                <option>🔒 Only me</option>
              </select>
            </div>
          </div>
          <textarea
            className="w-full bg-transparent text-[#E4E6EB] placeholder-[#B0B3B8] text-[20px] outline-none resize-none min-h-[200px]"
            placeholder="Write something..."
          />
        </div>
      </div>
    );
  }

  if (activeFlow === 'groups' && currentUser) {
    return (
      <div className="fixed inset-0 z-[500] bg-[#18191A] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-[#3E4042]">
          <div className="flex items-center gap-4">
            <i
              className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
              onClick={() => setActiveFlow('sheet')}
            ></i>
            <h3 className="text-[#E4E6EB] text-[20px] font-medium">Share to Groups & Brands</h3>
          </div>
          <button
            onClick={() => handleShareAction('groups')}
            className="text-[#1877F2] font-bold text-[17px]"
          >
            SHARE
          </button>
        </div>
        <div className="p-4 border-b border-[#3E4042]">
          <div className="text-[#B0B3B8] text-sm mb-2">Share with up to 10 groups you're in</div>
          <input
            type="text"
            placeholder="Search groups..."
            className="w-full bg-[#3A3B3C] text-[#E4E6EB] px-4 py-2 rounded-lg"
          />
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="text-center py-10">
              <i className="fas fa-users text-4xl text-[#3A3B3C] mb-3"></i>
              <div className="text-[#E4E6EB]">No groups available</div>
            </div>
          ) : (
            groups.slice(0, 5).map((group) => (
              <div key={group.id} className="flex items-center justify-between p-3 hover:bg-[#3A3B3C] rounded-lg mb-2">
                <div className="flex items-center gap-3">
                  <img
                    src={group.image || 'https://ui-avatars.com/api/?name=Group'}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <div className="text-[#E4E6EB] font-medium">{group.name}</div>
                    <div className="text-[#B0B3B8] text-xs">{group.members_count} members</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleShareAction('group')}
                  className="px-4 py-1 bg-[#1877F2] text-white rounded-lg text-sm"
                >
                  Share
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (activeFlow === 'messages' && currentUser) {
    return (
      <div className="fixed inset-0 z-[500] bg-[#18191A] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-[#3E4042]">
          <div className="flex items-center gap-4">
            <i
              className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
              onClick={() => setActiveFlow('sheet')}
            ></i>
            <h3 className="text-[#E4E6EB] text-[20px] font-medium">Share to Messages</h3>
          </div>
        </div>
        <div className="p-4 border-b border-[#3E4042]">
          <textarea
            className="w-full bg-[#3A3B3C] text-[#E4E6EB] rounded-xl p-3 min-h-[80px]"
            placeholder="Write a message..."
          />
        </div>
        <div className="p-4 border-b border-[#3E4042]">
          <input
            type="text"
            placeholder="Search friends..."
            className="w-full bg-[#3A3B3C] text-[#E4E6EB] px-4 py-2 rounded-lg"
          />
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          {users
            .filter(u => u.id !== currentUser.id)
            .slice(0, 10)
            .map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 hover:bg-[#3A3B3C] rounded-lg mb-2">
                <div className="flex items-center gap-3">
                  <img
                    src={user.profile_image_url || 'https://ui-avatars.com/api/?name=User'}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <div className="text-[#E4E6EB] font-medium">{user.name}</div>
                    <div className="text-[#B0B3B8] text-xs">@{user.username}</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleShareAction('message')}
                  className="px-4 py-1 bg-[#1877F2] text-white rounded-lg text-sm"
                >
                  Send
                </button>
              </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={backdropRef}
        className={`fixed inset-0 bg-black/60 z-[300] transition-opacity duration-300 ${
          isAnimating ? 'opacity-0' : 'opacity-100'
        }`}
      />

      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 z-[301] bg-[#242526] rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col transition-transform duration-300 ease-out ${
          isAnimating ? 'translate-y-full' : 'translate-y-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 pb-2">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 bg-[#3E4042] rounded-full"></div>
          </div>

          {post && (
            <div className="flex items-start gap-3 mb-4 p-3 bg-[#3A3B3C] rounded-xl">
              {post.media_url && (
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                  <img 
                    src={post.media_url} 
                    alt="Post" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[#E4E6EB] font-semibold text-sm">
                    {post.author?.name || 'Original Author'}
                  </span>
                  <span className="text-[#B0B3B8] text-xs">•</span>
                  <span className="text-[#B0B3B8] text-xs">
                    {formatRelativeTime(post.created_at)}
                  </span>
                </div>
                <p className="text-[#B0B3B8] text-sm line-clamp-2">
                  {post.content?.substring(0, 100) || 'Shared post'}
                  {post.content?.length > 100 ? '...' : ''}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-1">
            <button
              onClick={() => {
                if (!currentUser) {
                  alert('Please login to share to feed');
                  return;
                }
                setActiveFlow('feed');
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#3A3B3C] active:bg-[#4E4F50] transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#1877F215] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <i className="fas fa-newspaper text-[#1877F2] text-lg"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#E4E6EB] font-medium text-[15px]">
                  Share to UNERA Feed
                </div>
                <div className="text-[#B0B3B8] text-xs mt-0.5">
                  Share to your profile feed
                </div>
              </div>
              <i className="fas fa-chevron-right text-[#B0B3B8] text-sm"></i>
            </button>

            <button
              onClick={() => {
                if (!currentUser) {
                  alert('Please login to share to groups/brands');
                  return;
                }
                setActiveFlow('groups');
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#3A3B3C] active:bg-[#4E4F50] transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#45BD6215] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <i className="fas fa-users text-[#45BD62] text-lg"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#E4E6EB] font-medium text-[15px]">
                  Share to Groups & Brands
                </div>
                <div className="text-[#B0B3B8] text-xs mt-0.5">
                  Share with up to 10 groups/brands
                </div>
              </div>
              <i className="fas fa-chevron-right text-[#B0B3B8] text-sm"></i>
            </button>

            <button
              onClick={() => {
                if (!currentUser) {
                  alert('Please login to send messages');
                  return;
                }
                setActiveFlow('messages');
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#3A3B3C] active:bg-[#4E4F50] transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#1877F215] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <i className="fas fa-comment-alt text-[#1877F2] text-lg"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#E4E6EB] font-medium text-[15px]">
                  Send as a Message
                </div>
                <div className="text-[#B0B3B8] text-xs mt-0.5">
                  Share via direct message
                </div>
              </div>
              <i className="fas fa-chevron-right text-[#B0B3B8] text-sm"></i>
            </button>

            <button
              onClick={() => {
                const text = `Check out this post on UNERA: ${window.location.origin}/post/${post.id}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                closeSheet();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#3A3B3C] active:bg-[#4E4F50] transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#25D36615] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <i className="fab fa-whatsapp text-[#25D366] text-lg"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#E4E6EB] font-medium text-[15px]">
                  Send via WhatsApp
                </div>
                <div className="text-[#B0B3B8] text-xs mt-0.5">
                  Share to WhatsApp
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                const url = `${window.location.origin}/post/${post.id}`;
                navigator.clipboard.writeText(url);
                alert('Link copied to clipboard!');
                closeSheet();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#3A3B3C] active:bg-[#4E4F50] transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#1877F215] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <i className="fas fa-link text-[#1877F2] text-lg"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#E4E6EB] font-medium text-[15px]">
                  Copy Post Link
                </div>
                <div className="text-[#B0B3B8] text-xs mt-0.5">
                  Copy link to clipboard
                </div>
              </div>
            </button>
          </div>

          {currentUser && users.length > 0 && (
            <div className="mt-6">
              <div className="text-[#B0B3B8] text-xs font-semibold uppercase tracking-wider mb-3 px-1">
                Share with recent contacts
              </div>
              <div className="flex gap-3">
                {users
                  .filter(u => u.id !== currentUser.id)
                  .slice(0, 3)
                  .map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setActiveFlow('messages');
                      }}
                      className="flex flex-col items-center gap-2"
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#1877F2] p-0.5">
                        <img
                          src={user.profile_image_url || 'https://ui-avatars.com/api/?name=User'}
                          alt={user.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <span className="text-[#E4E6EB] text-xs font-medium max-w-[60px] truncate">
                        {user.name.split(' ')[0]}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 pt-3 border-t border-[#3E4042]">
          <button
            onClick={closeSheet}
            className="w-full py-3 bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] font-semibold rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};

/**
 * =========================
 * ✅ UPDATED: POST CARD WITH ENHANCED REACTIONS & API FORMAT SUPPORT
 * =========================
 */
export const Post: React.FC<{
  post: PostType;
  author: User | any;
  currentUser: User | null;
  users?: User[];
  onProfileClick: (id: number) => void;
  onReact: (id: number, type: ReactionType) => void;
  onShare: (id: number, newShareCount: number) => void;
  onDelete?: (id: number) => void;
  onViewImage: (url: string) => void;
  onOpenComments: (id: number) => void;
  onVideoClick: (p: PostType) => void;
  onPlayAudioTrack?: (t: AudioTrack) => void;
  onHashtagClick?: (tag: string) => void;
  groups?: Group[];
  brands?: Brand[];
  chats?: any[];
}> = ({
  post,
  author,
  currentUser,
  users = [],
  onProfileClick,
  onReact,
  onShare,
  onDelete,
  onViewImage,
  onOpenComments,
  onVideoClick,
  onPlayAudioTrack,
  onHashtagClick,
  groups = [],
  brands = [],
  chats = [],
}) => {
  const p: any = post as any;
  const a: any = author as any;

  // ✅ ENHANCED REACTION LOGIC WITH DUAL API SUPPORT
  // Support both myReaction/my_reaction and likesCount/reactionsCount
  const myReaction = (p as any).myReaction ?? (p as any).my_reaction ?? null;
  const likesCount = Number(
    (p as any).likesCount ?? 
    (p as any).reactionsCount ?? 
    (p as any).reactions_count ?? 
    0
  );

  const reactionsArr = Array.isArray(p.reactions) ? p.reactions : null;
  
  // Final calculation with priority: explicit fields > reactions array
  const finalMyReaction: ReactionType | undefined =
    myReaction ||
    (currentUser && reactionsArr
      ? (reactionsArr.find((r: any) => Number(r.user_id) === safeUserId(currentUser))?.type as ReactionType)
      : undefined);

  const finalReactionCount =
    likesCount > 0
      ? likesCount
      : reactionsArr
        ? reactionsArr.length
        : 0;
  
  // ✅ INSTANT COMMENT COUNT UPDATES
  const [commentCount, setCommentCount] = useState(() => {
    if (typeof p.comment_count === 'number') return p.comment_count;
    if (Array.isArray(p.comments)) return p.comments.length;
    return 0;
  });

  // ✅ INSTANT SHARE COUNT
  const [shareCount, setShareCount] = useState(() => {
    return safeNumber(p.shares ?? p.shares_count, 0);
  });

  const [showShareSheet, setShowShareSheet] = useState(false);

  const createdAtLabel = formatRelativeTime(p.created_at);
  const postId = safePostId(p);

  const mediaInfo = getMediaTypeInfo(p);

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  // ✅ Sync counts with post updates
  useEffect(() => {
    const newCommentCount = typeof p.comment_count === 'number' 
      ? p.comment_count 
      : Array.isArray(p.comments) 
        ? p.comments.length 
        : 0;
    
    if (newCommentCount !== commentCount) {
      setCommentCount(newCommentCount);
    }

    const newShareCount = safeNumber(p.shares ?? p.shares_count, 0);
    if (newShareCount !== shareCount) {
      setShareCount(newShareCount);
    }
  }, [p.comment_count, p.comments, p.shares, p.shares_count, commentCount, shareCount]);

  const handleShareComplete = (destination: string, data?: any) => {
    if (data?.success && typeof data.shares === 'number') {
      setShareCount(data.shares);
      onShare(postId, data.shares);
    }
    setShowShareSheet(false);
  };

  return (
    <>
      <div className="bg-[#242526] rounded-xl shadow-sm mb-4 animate-fade-in border border-[#3E4042] overflow-hidden">
        <div className="p-3 md:p-4 flex items-center justify-between">
          <div
            className="flex items-center gap-2 flex-1 min-w-0"
            onClick={() => onProfileClick(safeUserId(a))}
          >
            <img
              src={
                a.profile_image_url ||
                a.profileImage ||
                a.avatar ||
                'https://ui-avatars.com/api/?name=User'
              }
              alt=""
              className="w-10 h-10 rounded-full object-cover cursor-pointer border border-[#3E4042]"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <h4 className="font-bold text-[#E4E6EB] text-[18.5px] cursor-pointer hover:underline truncate">
                  {a.name || a.username || 'User'}
                </h4>
                {a.is_verified && (
                  <i className="fas fa-check-circle text-[#1877F2] text-[13px]"></i>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[#B0B3B8] text-[13px]">
                <span>{createdAtLabel}</span>
                <span>•</span>
                <i className="fas fa-globe-americas text-[12px]"></i>
                {p.location && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[160px]">
                      {String(p.location).split(',')[0]}
                    </span>
                  </>
                )}
                {p.feeling && (
                  <>
                    <span>•</span>
                    <span>feeling {p.feeling}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {onDelete &&
            currentUser &&
            safeUserId(currentUser) === Number(p.user_id ?? p.author_id ?? 0) && (
              <button
                className="w-9 h-9 hover:bg-[#3A3B3C] rounded-full flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(postId);
                }}
                title="Delete"
              >
                <i className="fas fa-trash text-[#B0B3B8]"></i>
              </button>
            )}
        </div>

        {/* ✅ UPDATED: Use ExpandableRichText for post description */}
        {p.content && (
          <div className="px-3 md:px-4 pb-2">
            <ExpandableRichText
              text={String(p.content)}
              users={users}
              onProfileClick={onProfileClick}
              onHashtagClick={onHashtagClick}
              maxWords={25}
              fontSizePx={21}
            />
          </div>
        )}

        {p.link_preview && !mediaInfo.mediaUrl && (
          <div
            className="mx-3 md:mx-4 mb-2 bg-[#242526] border border-[#3E4042] rounded-lg overflow-hidden cursor-pointer hover:bg-[#3A3B3C] transition-colors"
            onClick={() => window.open(p.link_preview.url, '_blank')}
          >
            <img
              src={p.link_preview.image}
              alt=""
              className="w-full h-48 object-cover"
            />
            <div className="p-3 bg-[#3A3B3C]">
              <div className="text-[#B0B3B8] text-xs uppercase font-bold mb-1">
                {p.link_preview.domain}
              </div>
              <div className="text-[#E4E6EB] font-bold text-[17px] mb-1 line-clamp-1">
                {p.link_preview.title}
              </div>
              <div className="text-[#B0B3B8] text-[14px] line-clamp-2">
                {p.link_preview.description}
              </div>
            </div>
          </div>
        )}

        {p.background && !mediaInfo.mediaUrl && (
          <div
            className="h-[300px] flex items-center justify-center p-8 text-center text-white font-bold text-2xl"
            style={{ background: p.background, backgroundSize: 'cover' }}
          >
            {p.content}
          </div>
        )}

        {mediaInfo.mediaUrl && mediaInfo.isImage && !p.background && (
          <div
            className="cursor-pointer bg-black"
            onClick={() => onViewImage(mediaInfo.mediaUrl)}
          >
            <img
              src={mediaInfo.mediaUrl}
              alt=""
              className="w-full h-auto max-h-[600px] object-contain"
              loading="lazy"
              onError={(e) => {
                console.error('Failed to load image:', mediaInfo.mediaUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        {mediaInfo.mediaUrl && mediaInfo.isVideo && (
          <div
            className="cursor-pointer relative h-[500px] bg-black"
            onClick={() => onVideoClick(post)}
          >
            <video
              src={mediaInfo.mediaUrl}
              className="w-full h-full object-cover"
              preload="metadata"
              playsInline
              muted
              onError={(e) => {
                console.error('Failed to load video:', mediaInfo.mediaUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="fas fa-play text-white text-4xl opacity-50"></i>
            </div>
          </div>
        )}

        {mediaInfo.mediaUrl && mediaInfo.isAudio && onPlayAudioTrack && (
          <div className="mx-3 md:mx-4 my-3 p-4 bg-[#3A3B3C] rounded-lg border border-[#3E4042]">
            <div className="flex items-center gap-3">
              <i className="fas fa-music text-[#1877F2] text-2xl"></i>
              <div className="flex-1">
                <div className="text-[#E4E6EB] font-bold">Audio Track</div>
                <div className="text-[#B0B3B8] text-sm">
                  {p.content || 'Listen to audio'}
                </div>
              </div>
              <button
                onClick={() => onPlayAudioTrack({
                  id: postId,
                  title: p.content || 'Audio',
                  artist: a.name || 'Unknown',
                  url: mediaInfo.mediaUrl,
                  duration: 0,
                  coverImage: a.profile_image_url,
                })}
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
              >
                <i className="fas fa-play mr-1"></i> Play
              </button>
            </div>
          </div>
        )}

        <div className="px-3 md:px-4 py-2.5 flex items-center justify-between text-[#B0B3B8] text-[14px] border-t border-[#3E4042]">
          <div className="flex items-center gap-1.5">
            {/* ✅ UPDATED: Use finalReactionCount with dual API support */}
            {finalReactionCount > 0 && (
              <span className="hover:underline">{formatCount(finalReactionCount)} Reactions</span>
            )}
          </div>
          <div className="flex gap-4">
            {/* ✅ INSTANT COMMENT COUNT BOTH PLACES */}
            <span
              className="hover:underline cursor-pointer"
              onClick={() => onOpenComments(Number(postId))}
            >
              {formatCount(commentCount)} Comments
            </span>
            {shareCount > 0 && (
              <span className="hover:underline">
                {formatCount(shareCount)} Shares
              </span>
            )}
          </div>
        </div>

        <div className="px-2 py-1 border-t border-[#3E4042] flex items-center justify-between">
          {/* ✅ UPDATED: Enhanced ReactionButton with 25+ emojis & long-press */}
          <ReactionButton
            currentUserReactions={finalMyReaction}
            reactionCount={finalReactionCount}
            onReact={(type) => onReact(postId, type)}
            isGuest={!currentUser}
          />
          <button
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
            onClick={() => (currentUser ? onOpenComments(Number(postId)) : alert('Login first'))}
          >
            <i className="far fa-comment-alt text-[20px]"></i>
            <span className="text-[17px] font-medium">Comment</span>
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
            onClick={() => {
              if (!currentUser) {
                alert('Please login to share posts.');
                return;
              }
              setShowShareSheet(true);
            }}
          >
            <i className="fas fa-share text-[20px]"></i>
            <span className="text-[17px] font-medium">Share</span>
          </button>
        </div>
      </div>

      <ShareBottomSheet
        isOpen={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        post={p}
        currentUser={currentUser}
        users={users}
        groups={groups}
        brands={brands}
        chats={chats}
        onShareComplete={handleShareComplete}
      />
    </>
  );
};

/**
 * =========================
 * CREATE POST CARD
 * =========================
 */
export const CreatePost: React.FC<{
  currentUser: User;
  onProfileClick: (id: number) => void;
  onClick: () => void;
  onCreateEventClick?: () => void;
}> = ({ currentUser, onProfileClick, onClick, onCreateEventClick }) => (
  <div className="bg-[#242526] rounded-xl p-3 md:p-4 mb-4 shadow-sm border border-[#3E4042]">
    <div className="flex gap-2 mb-3">
      <img
        src={
          (currentUser as any).profile_image_url ||
          (currentUser as any).profileImage ||
          (currentUser as any).avatar ||
          'https://ui-avatars.com/api/?name=User'
        }
        alt=""
        className="w-10 h-10 rounded-full object-cover cursor-pointer border border-[#3E4042]"
        onClick={() => onProfileClick(safeUserId(currentUser))}
      />
      <div
        className="flex-1 bg-[#3A3B3C] rounded-full px-4 py-2 hover:bg-[#4E4F50] cursor-pointer flex items-center transition-colors"
        onClick={onClick}
      >
        <span className="text-[#B0B3B8] text-[17px] truncate">
          What's on your mind, {String((currentUser as any).name || '').split(' ')[0] || 'there'}?
        </span>
      </div>
    </div>

    <div className="border-t border-[#3E4042] pt-2 flex justify-between">
      <div
        className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors"
        onClick={onClick}
      >
        <i className="fas fa-video text-[#F3425F] text-[22px]"></i>
        <span className="text-[#B0B3B8] font-semibold text-[15px] hidden sm:block">Live Video</span>
      </div>

      <div
        className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors"
        onClick={onClick}
      >
        <i className="fas fa-images text-[#45BD62] text-[22px]"></i>
        <span className="text-[#B0B3B8] font-semibold text-[15px] hidden sm:block">Photo/Video</span>
      </div>

      <div
        className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors"
        onClick={onCreateEventClick}
      >
        <i className="fas fa-flag text-[#F7B928] text-[22px]"></i>
        <span className="text-[#B0B3B8] font-semibold text-[15px] hidden sm:block">Life Event</span>
      </div>
    </div>
  </div>
);

/**
 * =========================
 * CREATE POST MODAL
 * =========================
 */
export const CreatePostModal: React.FC<{
  currentUser: User;
  users: User[];
  onClose: () => void;
  onCreatePost: (
    text: string,
    file: File | null,
    meta?: {
      type?: 'text' | 'image' | 'video';
      visibility?: string;
      location?: string;
      feeling?: string;
      taggedUsers?: number[];
      background?: string;
      linkPreview?: LinkPreview | null;
    }
  ) => void;
  onCreateEventClick?: () => void;
}> = ({ currentUser, users, onClose, onCreatePost }) => {
  const [view, setView] = useState<'main' | 'tag' | 'feeling' | 'location'>('main');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [type, setType] = useState<'text' | 'image' | 'video'>('text');

  const [visibility] = useState<'Public' | 'Friends'>('Public');
  const [activeBackground, setActiveBackground] = useState('');
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);

  const [taggedUsers, setTaggedUsers] = useState<number[]>([]);
  const [feeling, setFeeling] = useState('');
  const [location, setLocation] = useState('');

  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState<any[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const searchTimeout = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLinkPreview(getLinkPreview(text));
  }, [text]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
    setType(f.type.startsWith('image') ? 'image' : 'video');
    setActiveBackground('');
    setView('main');
  };

  const handleLocationSearch = async (q: string) => {
    if (q.trim().length < 3) {
      setLocResults([]);
      return;
    }
    setLocLoading(true);
    try {
      const data = await apiFetch(`/api/locations/search?q=${encodeURIComponent(q)}`);
      setLocResults(Array.isArray(data) ? data : []);
    } catch {
      setLocResults([]);
    } finally {
      setLocLoading(false);
    }
  };

  const onLocQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => handleLocationSearch(val), 450);
  };

  const canPost = !!text.trim() || !!file || !!activeBackground;

  const submit = () => {
    if (!canPost) return;

    onCreatePost(text, file, {
      type: file ? type : 'text',
      visibility,
      location: location || undefined,
      feeling: feeling || undefined,
      taggedUsers: taggedUsers.length ? taggedUsers : undefined,
      background: activeBackground || undefined,
      linkPreview: linkPreview || null,
    });

    onClose();
  };

  const OptionsItem = ({
    icon,
    color,
    label,
    onClick,
  }: {
    icon: string;
    color: string;
    label: string;
    onClick?: () => void;
  }) => (
    <div
      className="flex items-center gap-3 p-3 hover:bg-[#3A3B3C] active:bg-[#3A3B3C] cursor-pointer transition-colors"
      onClick={onClick}
    >
      <i className={`${icon} text-[24px] w-8 text-center`} style={{ color }}></i>
      <span className="text-[#E4E6EB] text-[17px] font-medium">{label}</span>
    </div>
  );

  if (view === 'tag') {
    return (
      <div className="fixed inset-0 z-[200] bg-[#18191A] flex flex-col animate-slide-up font-sans">
        <div className="flex items-center p-4 border-b border-[#3E4042] gap-4">
          <i
            className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
            onClick={() => setView('main')}
          ></i>
          <h3 className="text-[#E4E6EB] text-lg font-bold">Tag People</h3>
          <button
            onClick={() => setView('main')}
            className="ml-auto text-[#1877F2] font-bold"
          >
            Done
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {users
            .filter((u: any) => safeUserId(u) !== safeUserId(currentUser))
            .map((u: any) => (
              <div
                key={safeUserId(u)}
                className="flex items-center justify-between p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer"
                onClick={() =>
                  setTaggedUsers((prev) =>
                    prev.includes(safeUserId(u))
                      ? prev.filter((uid) => uid !== safeUserId(u))
                      : [...prev, safeUserId(u)]
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <img
                    src={
                      u.profile_image_url ||
                      u.profileImage ||
                      u.avatar ||
                      'https://ui-avatars.com/api/?name=User'
                    }
                    className="w-10 h-10 rounded-full object-cover"
                    alt=""
                  />
                  <span className="text-[#E4E6EB] font-semibold">{u.name || u.username || 'User'}</span>
                </div>
                {taggedUsers.includes(safeUserId(u)) && (
                  <i className="fas fa-check-circle text-[#1877F2] text-xl"></i>
                )}
              </div>
            ))}
        </div>
      </div>
    );
  }

  if (view === 'feeling') {
    return (
      <div className="fixed inset-0 z-[200] bg-[#18191A] flex flex-col animate-slide-up font-sans">
        <div className="flex items-center p-4 border-b border-[#3E4042] gap-4">
          <i
            className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
            onClick={() => setView('main')}
          ></i>
          <h3 className="text-[#E4E6EB] text-lg font-bold">How are you feeling?</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-2">
          {FEELINGS.map((f) => (
            <div
              key={f}
              className="p-3 bg-[#242526] rounded-lg text-center cursor-pointer hover:bg-[#3A3B3C] text-[#E4E6EB]"
              onClick={() => {
                setFeeling(f);
                setView('main');
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'location') {
    return (
      <div className="fixed inset-0 z-[200] bg-[#18191A] flex flex-col animate-slide-up font-sans">
        <div className="flex items-center p-4 border-b border-[#3E4042] gap-4">
          <i
            className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
            onClick={() => setView('main')}
          ></i>
          <h3 className="text-[#E4E6EB] text-lg font-bold">Search Location</h3>
        </div>

        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Where are you?"
              className="w-full bg-[#3A3B3C] rounded-xl p-4 pl-12 text-[#E4E6EB] outline-none focus:ring-2 focus:ring-[#1877F2] transition-all"
              autoFocus
              value={locQuery}
              onChange={onLocQueryChange}
            />
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#B0B3B8]"></i>
            {locLoading && (
              <i className="fas fa-spinner fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-[#1877F2]"></i>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {locResults.length > 0 ? (
              <div className="flex flex-col gap-2">
                {locResults.map((loc, i) => {
                  const display =
                    loc.display_name ||
                    loc.name ||
                    loc.label ||
                    `${loc.city || ''}${loc.country ? `, ${loc.country}` : ''}`.trim();

                  const title = (display || '').split(',')[0] || 'Location';

                  return (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-4 hover:bg-[#3A3B3C] rounded-xl cursor-pointer border border-[#3E4042]/30 transition-colors group"
                      onClick={() => {
                        setLocation(display);
                        setView('main');
                      }}
                    >
                      <div className="w-12 h-12 bg-[#3A3B3C] rounded-xl flex items-center justify-center group-hover:bg-[#1877F2] transition-colors">
                        <i className="fas fa-location-dot text-[#E4E6EB]"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[#E4E6EB] font-bold block truncate">{title}</span>
                        <span className="text-[#B0B3B8] text-xs block truncate">{display}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : locQuery.length >= 3 && !locLoading ? (
              <div className="text-center py-10">
                <i className="fas fa-map-marked-alt text-4xl text-[#3A3B3C] mb-4"></i>
                <p className="text-[#B0B3B8]">No matching locations found.</p>
            </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-[#B0B3B8] uppercase tracking-widest mb-2 px-1">
                  Nearby Suggestions
                </p>
                {LOCATIONS_DATA.slice(0, 6).map((loc) => (
                  <div
                    key={loc.name}
                    className="flex items-center gap-4 p-3 hover:bg-[#3A3B3C] rounded-xl cursor-pointer transition-colors"
                    onClick={() => {
                      setLocation(loc.name);
                      setView('main');
                    }}
                  >
                    <div className="w-10 h-10 bg-[#3A3B3C] rounded-full flex items-center justify-center text-xl">
                      {loc.flag}
                    </div>
                    <span className="text-[#E4E6EB] font-semibold">{loc.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#18191A] flex flex-col animate-slide-up font-sans">
      <div className="flex items-center justify-between p-4 border-b border-[#3E4042]">
        <div className="flex items-center gap-4">
          <i
            className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
            onClick={onClose}
          ></i>
          <h3 className="text-[#E4E6EB] text-[20px] font-medium">Create Post</h3>
        </div>
        <button
          onClick={submit}
          disabled={!canPost}
          className="text-[#E4E6EB] font-bold text-[17px] disabled:text-[#B0B3B8]"
        >
          POST
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <img
              src={
                (currentUser as any).profile_image_url ||
                (currentUser as any).profileImage ||
                (currentUser as any).avatar ||
                'https://ui-avatars.com/api/?name=User'
              }
              alt=""
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <div className="flex items-center gap-1 flex-wrap">
                <h4 className="font-bold text-[#E4E6EB] text-[17px]">
                  {(currentUser as any).name || (currentUser as any).username || 'User'}
                </h4>
                {feeling && <span className="text-[#E4E6EB] text-[15px]"> is feeling {feeling}</span>}
                {location && <span className="text-[#E4E6EB] text-[15px]"> in {location.split(',')[0]}</span>}
                {taggedUsers.length > 0 && (
                  <span className="text-[#E4E6EB] text-[15px]"> with {taggedUsers.length} others</span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5">
                <div className="bg-[#3A3B3C] rounded-md px-2 py-1 inline-flex items-center gap-1 text-[13px] font-semibold text-[#E4E6EB] border border-[#3E4042]">
                  <i className="fas fa-globe-americas text-[12px]"></i>
                  <span>{visibility}</span>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`relative min-h-[150px] mb-4 transition-all ${
              activeBackground ? 'flex items-center justify-center p-8 rounded-lg text-center min-h-[300px]' : ''
            }`}
            style={{ background: activeBackground, backgroundSize: 'cover' }}
          >
            <textarea
              className={`w-full bg-transparent outline-none text-[#E4E6EB] placeholder-[#B0B3B8] resize-none ${
                activeBackground
                  ? 'text-center font-bold text-3xl drop-shadow-md placeholder-white/70'
                  : 'text-[24px]'
              }`}
              placeholder="What's on your mind?"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={activeBackground ? 4 : 5}
            />
          </div>

          {linkPreview && !file && !activeBackground && (
            <div
              className="mb-4 bg-[#242526] border border-[#3E4042] rounded-lg overflow-hidden cursor-pointer hover:bg-[#3A3B3C] transition-colors"
              onClick={() => window.open(linkPreview.url, '_blank')}
            >
              <img src={linkPreview.image} alt="Preview" className="w-full h-48 object-cover" />
              <div className="p-3 bg-[#3A3B3C]">
                <div className="text-[#B0B3B8] text-xs uppercase font-bold mb-1">{linkPreview.domain}</div>
                <div className="text-[#E4E6EB] font-bold text-[17px] mb-1 line-clamp-1">{linkPreview.title}</div>
                <div className="text-[#B0B3B8] text-[14px] line-clamp-2">{linkPreview.description}</div>
              </div>
            </div>
          )}

          {!preview && (
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
              <div
                className={`w-8 h-8 rounded-lg cursor-pointer border-2 bg-[#3A3B3C] flex items-center justify-center flex-shrink-0 ${
                  !activeBackground ? 'border-white' : 'border-[#3E4042]'
                }`}
                onClick={() => setActiveBackground('')}
              >
                <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
                  <i className="fas fa-font text-black text-xs"></i>
                </div>
              </div>

              {BACKGROUNDS.filter((b) => b.id !== 'none').map((bg) => (
                <div
                  key={bg.id}
                  className={`w-8 h-8 rounded-lg cursor-pointer border-2 flex-shrink-0 ${
                    activeBackground === bg.value ? 'border-white' : 'border-transparent'
                  }`}
                  style={{ background: bg.value, backgroundSize: 'cover' }}
                  onClick={() => setActiveBackground(bg.value)}
                />
              ))}
            </div>
          )}

          {preview && (
            <div className="relative rounded-lg overflow-hidden border border-[#3E4042] mb-4">
              <div
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setType('text');
                }}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center cursor-pointer hover:bg-black/80 z-10"
              >
                <i className="fas fa-times text-white"></i>
              </div>

              {type === 'image' ? (
                <img src={preview} alt="preview" className="w-full h-auto max-h-[400px] object-contain bg-black" />
              ) : (
                <video src={preview} controls className="w-full h-auto max-h-[400px] bg-black" />
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[#3E4042]">
          <OptionsItem icon="fas fa-images" color="#45BD62" label="Photo/video" onClick={() => fileInputRef.current?.click()} />
          <OptionsItem icon="fas fa-camera" color="#45BD62" label="Camera" onClick={() => cameraInputRef.current?.click()} />
          <OptionsItem icon="fas fa-user-tag" color="#1877F2" label="Tag people" onClick={() => setView('tag')} />
          <OptionsItem icon="far fa-smile" color="#F7B928" label="Feeling/activity" onClick={() => setView('feeling')} />
          <OptionsItem icon="fas fa-map-marker-alt" color="#F02849" label="Check in" onClick={() => setView('location')} />
        </div>
      </div>

      <div className="p-4 border-t border-[#3E4042]">
        <button
          onClick={submit}
          disabled={!canPost}
          className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold py-3 rounded-lg transition-colors disabled:bg-[#3A3B3C] text-lg shadow-sm"
        >
          POST
        </button>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
      <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
    </div>
  );
};

// Global comments cache
const commentsCache = new Map<number, { 
  data: any[], 
  timestamp: number,
  postId: number 
}>();

/**
 * =========================
 * ✅ FIXED: COMMENTS SHEET WITH PROPER REPLY ALIGNMENT AND FACEBOOK-LIKE BEHAVIOR
 * =========================
 */
export const CommentsSheet: React.FC<{
  post: PostType;
  currentUser: User;
  users: User[];
  onClose: () => void;
  onComment?: (postId: number, text: string) => void;
  onLikeComment?: (commentId: number) => void;
  getCommentAuthor?: (id: number) => User | undefined;
  onProfileClick: (id: number) => void;
  // ✅ ADDED: onHashtagClick prop for B)
  onHashtagClick?: (tag: string) => void;
}> = ({ post, currentUser, users, onClose, onComment, onLikeComment, getCommentAuthor, onProfileClick, onHashtagClick }) => {
  const p: any = post as any;
  const postId = safePostId(p);
  
  const [text, setText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const resolveAuthor = (c: any) => {
    const uid = Number(c?.user_id ?? c?.userId ?? c?.author_id ?? c?.authorId ?? 0);

    const u =
      (Number.isFinite(uid) ? users.find((x: any) => Number(x?.id) === uid) : null) ||
      (getCommentAuthor ? getCommentAuthor(uid) : null) ||
      null;

    const name =
      String(c?.author_name ?? c?.authorName ?? '').trim() ||
      String(u?.name ?? '').trim() ||
      String(u?.username ?? '').trim() ||
      'User';

    const image =
      String(c?.author_image ?? c?.authorImage ?? '').trim() ||
      String(u?.profile_image_url ?? '').trim() ||
      String(u?.profileImage ?? '').trim() ||
      String(u?.avatar ?? '').trim() ||
      'https://ui-avatars.com/api/?name=User';

    return { uid, name, image };
  };

  // ✅ FIXED: Helper to get clean reply name with proper username fallback
  const getReplyLabel = (comment: any) => {
    const a = resolveAuthor(comment);
    const uid = a.uid;
    
    // ✅ FIXED: Find user in users list to get username
    const user = users.find((x: any) => Number(x?.id) === uid);
    const username = String(
      comment?.author_username ?? 
      user?.username ?? 
      comment?.username ?? 
      ''
    ).trim();
    
    const display = username ? `@${username}` : a.name; // e.g. "@JohnBeda" or "John Beda"
    return { ...a, username, display };
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  // ✅ Optimistic comment like
  const handleLikeComment = async (comment: any) => {
    if (!currentUser) return;

    const optimisticLiked = !comment.liked_by_me;
    const optimisticCount = comment.liked_by_me 
      ? Math.max(0, (comment.likes_count || 0) - 1)
      : (comment.likes_count || 0) + 1;

    setComments(prev => prev.map(c => 
      c.id === comment.id 
        ? { 
            ...c, 
            liked_by_me: optimisticLiked,
            likes_count: optimisticCount 
          } 
        : c
    ));

    if (onLikeComment) {
      onLikeComment(comment.id);
    }

    try {
      // ✅ UPDATED: Use apiFetch instead of direct fetch
      await apiFetch(`/api/comments/${comment.id}/like`, {
        method: 'POST',
        body: JSON.stringify({ user_id: safeUserId(currentUser) }),
      });
    } catch (error) {
      console.error('Failed to like comment:', error);
      // Revert optimistic update
      setComments(prev => prev.map(c => 
        c.id === comment.id 
          ? { 
              ...c, 
              liked_by_me: !optimisticLiked,
              likes_count: comment.likes_count || 0 
            } 
          : c
      ));
    }
  };

  // Silent background fetch for comments
  const fetchCommentsSilently = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      // ✅ UPDATED: Send viewerId when fetching comments
      const viewerId = safeUserId(currentUser);
      const data = await apiFetch(`/api/posts/${postId}/comments?viewerId=${viewerId}`);
      const arr = Array.isArray(data) ? data : data?.comments || [];
      const sorted = sortComments(arr);
      
      if (arr.length > 0) {
        setComments(sorted);
        commentsCache.set(postId, { 
          data: arr, 
          timestamp: Date.now(),
          postId 
        });
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      console.debug('Silent comment fetch failed:', error);
    }
  };

  // Initialize comments when sheet opens
  useEffect(() => {
    const initializeComments = async () => {
      // Show cached comments immediately
      const cached = commentsCache.get(postId);
      if (cached) {
        const sorted = sortComments(cached.data);
        setComments(sorted);
      }
      
      // Also check if post has inline comments
      const postComments = Array.isArray(p.comments) ? p.comments : [];
      if (postComments.length > 0 && (!cached || postComments.length > cached.data.length)) {
        const sorted = sortComments(postComments);
        setComments(sorted);
        commentsCache.set(postId, { 
          data: postComments, 
          timestamp: Date.now(),
          postId 
        });
      }
      
      // Silent background fetch
      fetchCommentsSilently();
    };

    initializeComments();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [postId, p.comments]);

  // ✅ FIXED: CORRECT sortComments function that handles string IDs properly
  const idKey = (v: any) => String(v ?? '').trim();

  const sortComments = (list: any[]) => {
    const root = list.filter((c) => !c.parent_comment_id);
    
    const repliesByParent = new Map<string, any[]>();
    
    list.forEach((c) => {
      const pid = idKey(c.parent_comment_id);
      if (!pid) return;
      
      if (!repliesByParent.has(pid)) repliesByParent.set(pid, []);
      repliesByParent.get(pid)!.push(c);
    });
    
    // optional: keep oldest-first (Facebook)
    repliesByParent.forEach((arr) => {
      arr.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    });
    
    const sorted: any[] = [];
    root.forEach((comment) => {
      const cid = idKey(comment.id);
      sorted.push(comment);
      const replies = repliesByParent.get(cid) || [];
      sorted.push(...replies);
    });
    
    return sorted;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;

    // ✅ ADDED: Auto-prefix the reply text like Facebook: `@JohnBeda: ...`
    const replyDisplay = replyTo?._reply_author?.display; // e.g. "@JohnBeda"
    const prefix = replyDisplay ? `${replyDisplay}: ` : '';
    const finalText = replyTo && !t.startsWith(prefix) ? prefix + t : t;

    const optimisticComment = {
      id: `tmp-${Date.now()}`,
      post_id: postId,
      user_id: safeUserId(currentUser),
      text: finalText, // ✅ Use finalText instead of t
      parent_comment_id: replyTo?.id || null,
      created_at: new Date().toISOString(),
      replies_count: 0,
      likes_count: 0,
      liked_by_me: false,
    };

    setText('');
    setReplyTo(null);
    setShowEmojiPicker(false); // ✅ Close emoji picker when submitting

    // IMMEDIATE optimistic update
    setComments(prev => {
      const next = [...prev, optimisticComment];
      const allComments = commentsCache.get(postId)?.data || [];
      commentsCache.set(postId, { 
        data: [...allComments, optimisticComment], 
        timestamp: Date.now(),
        postId 
      });
      return sortComments(next);
    });

    if (onComment) {
      onComment(postId, finalText); // ✅ Use finalText instead of t
    }

    // Silent background POST
    try {
      await apiFetch(`/api/posts/${postId}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          text: finalText, // ✅ Use finalText instead of t
          user_id: safeUserId(currentUser),
          parent_comment_id: replyTo?.id || null,
        }),
      });

      fetchCommentsSilently();
    } catch (err: any) {
      console.error('Failed to post comment:', err);
    }
  };

  const addEmoji = (emoji: string) => {
    setText(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // Refresh comments when sheet is focused
  useEffect(() => {
    const handleFocus = () => {
      const cached = commentsCache.get(postId);
      if (cached && (Date.now() - cached.timestamp > 30000)) {
        fetchCommentsSilently();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [postId]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>

      <div className="bg-[#242526] w-full md:w-[600px] md:h-[80vh] z-20 animate-slide-up flex flex-col h-[70vh] shadow-2xl overflow-hidden border border-[#3E4042]">
        <div className="p-3 border-b border-[#3E4042] flex justify-between items-center bg-[#242526]">
          <h3 className="font-bold text-[#E4E6EB]">
            Comments ({formatCount(comments.length)})
          </h3>
          <i className="fas fa-times text-[#B0B3B8] cursor-pointer text-xl" onClick={onClose}></i>
        </div>

        {/* Reply indicator */}
        {replyTo && (
          <div className="p-3 bg-[#3A3B3C] border-b border-[#3E4042] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[#B0B3B8] text-sm">Replying to</span>
              {/* ✅ UPDATED: Show real name instead of "User" */}
              <span className="text-[#1877F2] font-medium">
                {replyTo?._reply_author?.display || replyTo?._reply_author?.name || 'User'}
              </span>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="text-[#B0B3B8] hover:text-[#E4E6EB]"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        {/* ✅ UPDATED: Emoji picker with 200+ emojis */}
        {showEmojiPicker && (
          <div className="border-b border-[#3E4042] p-2 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 flex-wrap max-h-[120px] overflow-y-auto">
              {QUICK_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => addEmoji(emoji)}
                  className="text-2xl hover:scale-125 transition-transform p-1"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length === 0 ? (
            <div className="text-[#B0B3B8] text-center py-6">
              No comments yet.
              <p className="text-sm mt-2">Be the first to comment!</p>
            </div>
          ) : (
            comments.map((c) => {
              const a = resolveAuthor(c);
              const isReply = !!c.parent_comment_id;
              
              return (
                <div 
                  key={String(c.id)} 
                  className={`flex gap-2 animate-fade-in ${isReply ? 'ml-12 relative' : ''}`}
                >
                  {/* ✅ ADDED: Thread line for replies */}
                  {isReply && (
                    <div className="absolute -left-6 top-0 bottom-0 w-[2px] bg-[#3E4042] rounded-full" />
                  )}
                  
                  <img
                    src={a.image}
                    className="w-8 h-8 rounded-full object-cover cursor-pointer flex-shrink-0"
                    alt=""
                    onClick={() => a.uid && onProfileClick(a.uid)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`bg-[#3A3B3C] px-4 py-2 rounded-2xl ${isReply ? 'max-w-[92%]' : ''}`}>
                      <p className="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
                        <span
                          className="cursor-pointer hover:underline truncate max-w-[150px]"
                          onClick={() => a.uid && onProfileClick(a.uid)}
                          title={a.name}
                        >
                          {a.name}
                        </span>
                        <span className="text-[12px] font-normal text-[#B0B3B8]">
                          • {formatRelativeTime(c.created_at || c.createdAt || c.timestamp)}
                        </span>
                      </p>
                      {/* ✅ UPDATED: Use RichText component for mentions and hashtags */}
                      <div className="text-white text-[15px] whitespace-pre-wrap break-words mt-1">
                        <RichText
                          text={String(c.text || '')}
                          users={users}
                          onProfileClick={onProfileClick}
                          onHashtagClick={onHashtagClick}
                        />
                      </div>
                    </div>
                    
                    {/* Comment actions */}
                    <div className="flex items-center gap-4 mt-1 px-1">
                      <button
                        onClick={() => handleLikeComment(c)}
                        className={`text-xs ${c.liked_by_me ? 'text-[#1877F2] font-bold' : 'text-[#B0B3B8]'}`}
                      >
                        {c.liked_by_me ? 'Liked' : 'Like'}
                      </button>
                      <button
                        onClick={() => {
                          // ✅ UPDATED: Store author info when tapping Reply
                          const target = getReplyLabel(c);
                          setReplyTo({
                            ...c,
                            _reply_author: target, // store resolved author
                          });
                          inputRef.current?.focus();
                          setShowEmojiPicker(false); // Close emoji picker when replying
                        }}
                        className="text-xs text-[#B0B3B8] hover:text-[#E4E6EB]"
                      >
                        Reply
                      </button>
                      {c.likes_count > 0 && (
                        <span className="text-xs text-[#B0B3B8]">
                          {formatCount(c.likes_count)} like{c.likes_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form className="p-3 border-t border-[#3E4042] flex gap-2 items-center" onSubmit={handleSubmit}>
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-[#B0B3B8] hover:text-[#E4E6EB] text-xl p-2"
          >
            😀
          </button>
          <input
            ref={inputRef}
            type="text"
            className="bg-[#3A3B3C] text-white flex-1 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-[#1877F2] transition-all"
            placeholder={replyTo ? `Reply to ${replyTo?._reply_author?.display || replyTo?._reply_author?.name || 'user'}...` : "Write a comment..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <button 
            type="submit" 
            className="text-[#1877F2] font-bold disabled:text-[#B0B3B8] disabled:cursor-not-allowed px-3"
            disabled={!text.trim()}
          >
            Post
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * =========================
 * SUGGESTED PRODUCTS WIDGET
 * =========================
 */
export const SuggestedProductsWidget: React.FC<{
  products: Product[];
  currentUser: User;
  onViewProduct: (product: Product) => void;
  onSeeAll: () => void;
}> = ({ products, currentUser, onViewProduct, onSeeAll }) => {
  const suggested = (products || [])
    .filter((p: any) => p.seller_id !== safeUserId(currentUser))
    .slice(0, 4);

  if (suggested.length === 0) return null;

  return (
    <div className="bg-[#242526] rounded-xl p-4 mb-4 border border-[#3E4042] shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-[#E4E6EB] font-bold text-lg">Marketplace for you</h3>
        <button
          onClick={onSeeAll}
          className="text-[#1877F2] font-semibold text-[15px] hover:bg-[#3A3B3C] px-2 py-1 rounded transition-colors"
        >
          See all
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {suggested.map((product: any) => {
          const countryData = MARKETPLACE_COUNTRIES.find((c) =>
            String(product.address || '').toLowerCase().includes(c.name.toLowerCase())
          );
          const symbol = countryData ? countryData.symbol : '$';

          return (
            <div
              key={String(product.id)}
              className="cursor-pointer group"
              onClick={() => onViewProduct(product)}
            >
              <div className="aspect-square rounded-lg overflow-hidden relative mb-1.5 shadow-sm border border-[#3E4042]">
                <img
                  src={product.images?.[0]}
                  alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-black text-white">
                  {symbol}
                  {product.main_price}
                </div>
              </div>
              <h4 className="text-[#E4E6EB] text-sm font-semibold truncate px-0.5 leading-tight">
                {product.title}
              </h4>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Export all components
export { getMediaTypeInfo };
