//Feed.tsx 
import React, { useEffect, useMemo, useRef, useState, useCallback, useContext } from 'react';
import {
  User,
  Post as PostType,
  ReactionType,
  Product,
  LinkPreview,
  AudioTrack,
  Group,
  Brand,
  Event,
} from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { LOCATIONS_DATA, MARKETPLACE_COUNTRIES } from '../constants';
import { MarketplaceContext } from '../App';
import { CreateEventModal, EventCard } from './Events';

/**
 * =========================
 * ✅ RSVP HELPER - MATCHES ALLEVENTS.TSX EXACTLY
 * =========================
 */
type RSVPStatus = "going" | "interested" | "not_going";

const rsvpEventDirect = async (args: {
  eventId: number;
  userId: number;
  newStatus: RSVPStatus;
  prevStatus?: "" | "going" | "interested";
}) => {
  const { eventId, userId, newStatus, prevStatus = "" } = args;

  const endpoint =
    newStatus === "going"
      ? "/api/attend"
      : newStatus === "interested"
        ? "/api/interested"
        : prevStatus === "interested"
          ? "/api/interested"
          : "/api/attend";

  const payloadStatus = { event_id: eventId, user_id: userId, status: newStatus };

  try {
    return await postJSON(endpoint, payloadStatus);
  } catch (e1: any) {
    const payloadAction = {
      event_id: eventId,
      user_id: userId,
      action: newStatus === "not_going" ? "remove" : "add",
    };
    try {
      return await postJSON(endpoint, payloadAction);
    } catch (e2: any) {
      throw new Error(e2?.message || e1?.message || "RSVP failed");
    }
  }
};

/**
 * =========================
 * ✅ HELPER: UNIFIED AVATAR GENERATION WITH PROPER INITIALS
 * =========================
 */
const avatarFrom = (u: any) => {
  // Try all possible image field variations
  const img = String(
    u?.profile_image_url ??
    u?.profileImage ??
    u?.avatar ??
    u?.author_image ??
    u?.authorImage ??
    u?.image ??
    u?.picture ??
    ''
  ).trim();

  if (img && img !== 'null' && img !== 'undefined') return img;

  // Generate initials from name/username
  const label =
    String(u?.name ?? '').trim() ||
    String(u?.username ?? '').trim() ||
    String(u?.author_name ?? '').trim() ||
    String(u?.author_username ?? '').trim() ||
    'User';

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=1877F2&color=fff&bold=true`;
};

/**
 * =========================
 * API HELPERS
 * =========================
 */
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('unera_token');
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
 * ✅ authHeaders helper and safeJson function
 * =========================
 */
const authHeaders = () => {
  const token = localStorage.getItem("unera_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}

const postJSON = async (url: string, body: any) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body ?? {}),
  });

  const data = await safeJson(res);

  // your APIs sometimes return {success:false,...}
  if (!res.ok || (data && data.success === false)) {
    throw new Error(data?.error || data?.message || `Request failed: ${url}`);
  }

  return data;
};

/**
 * =========================
 * ✅ NORMALIZE FEED RESPONSE - SUPPORTS BOTH data.feed AND data.posts
 * =========================
 */
const normalizeFeedResponse = (data: any): any[] => {
  // Handle various response shapes:
  // - { feed: [...] }
  // - { posts: [...] }
  // - { data: { feed: [...] } }
  // - { data: { posts: [...] } }
  // - Direct array
  
  if (!data) return [];
  
  // Direct array
  if (Array.isArray(data)) return data;
  
  // { feed: [...] }
  if (Array.isArray(data.feed)) return data.feed;
  
  // { posts: [...] }
  if (Array.isArray(data.posts)) return data.posts;
  
  // { data: { feed: [...] } }
  if (data.data && Array.isArray(data.data.feed)) return data.data.feed;
  
  // { data: { posts: [...] } }
  if (data.data && Array.isArray(data.data.posts)) return data.data.posts;
  
  // { data: [...] }
  if (Array.isArray(data.data)) return data.data;
  
  return [];
};

/**
 * =========================
 * ✅ UNWRAP FEED ITEM - HANDLES WRAPPED ITEMS
 * =========================
 */
const unwrapFeedItem = (item: any): any => {
  if (!item) return null;
  
  // If item has a type wrapper, extract the actual content
  if (item.type === 'post' && item.post) return item.post;
  if (item.type === 'event' && item.event) return item.event;
  if (item.type === 'product' && item.product) return item.product;
  if (item.type === 'marketplace' && item.marketplace) return item.marketplace;
  if (item.type === 'music' && item.music) return item.music;
  if (item.type === 'podcast' && item.podcast) return item.podcast;
  
  // If item has a data wrapper
  if (item.data) return item.data;
  
  // Otherwise return the item itself
  return item;
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
const safeStr = (v: any) => String(v ?? '').trim();

const safeUserId = (u: any) => safeNumber(u?.id ?? u?.user_id ?? u?.userId, 0);
const safePostId = (p: any) => safeNumber(p?.id ?? p?.post_id ?? p?.postId, 0);

/**
 * =========================
 * ✅ HELPER: GET POST TEXT PREVIEW
 * =========================
 */
const getPostTextPreview = (p: any, max = 140) => {
  const t = String(p?.content ?? p?.text ?? '').trim();
  if (!t) return '';
  return t.length > max ? t.slice(0, max).trim() + '…' : t;
};

/**
 * =========================
 * MARKETPLACE HELPERS
 * =========================
 */
const safeJsonArray = (v: any): string[] => {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    if (s.startsWith("[")) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
      } catch {
        return [];
      }
    }
    return [s];
  }
  return [];
};

const getMarketplaceProductId = (p: any) => {
  const meta = p?.meta;
  const v =
    p?.product_id ??
    p?.productId ??
    meta?.product_id ??
    meta?.productId ??
    meta?.marketplace?.id ??
    meta?.product?.id;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const getMarketplaceImages = (p: any, productData?: any): string[] => {
  const pdImgs = safeJsonArray(productData?.images);
  if (pdImgs.length) return pdImgs;

  const mediaUrls = safeJsonArray(p?.media_urls);
  if (mediaUrls.length) return mediaUrls;

  const imgs = safeJsonArray(p?.images);
  if (imgs.length) return imgs;

  const single = typeof p?.media_url === "string" && p.media_url ? [p.media_url] : [];
  return single;
};

const getMarketplacePriceLine = (productData?: any) => {
  const priceRaw = productData?.price ?? productData?.main_price ?? null;
  const currency = productData?.currency || "TZS";
  const loc =
    (typeof productData?.location === "string" && productData.location.split(",")[0]) ||
    (typeof productData?.address === "string" && productData.address.split(",")[0]) ||
    "Marketplace";

  const priceNum = priceRaw != null ? Number(priceRaw) : NaN;
  const price = Number.isFinite(priceNum) ? priceNum.toFixed(0) : null;

  return { price, currency, loc };
};

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
 * ✅ REACTION EMOJI HELPERS FOR FACEBOOK-STYLE DISPLAY
 * =========================
 */
const reactionEmoji = (t: string) => {
  switch (t) {
    case 'like': return '👍';
    case 'love': return '❤️';
    case 'haha': return '😂';
    case 'wow': return '😮';
    case 'sad': return '😢';
    case 'angry': return '😡';
    case 'fire': return '🔥';
    case 'party': return '🎉';
    case 'clap': return '👏';
    case 'star': return '⭐';
    case 'thinking': return '🤔';
    case 'crying': return '😭';
    case 'heart_eyes': return '🥰';
    case 'kiss': return '😘';
    case 'sunglasses': return '😎';
    case 'rocket': return '🚀';
    case 'trophy': return '🏆';
    case 'crown': return '👑';
    case 'unicorn': return '🦄';
    case 'rainbow': return '🌈';
    case 'money': return '💰';
    case 'muscle': return '💪';
    case 'brain': return '🧠';
    case 'lightning': return '⚡';
    case 'gem': return '💎';
    default: return '👍';
  }
};

const topReactionEmojis = (reactionsArr: any[], max = 2) => {
  const counts = new Map<string, number>();
  for (const r of reactionsArr || []) {
    const type = String(r?.type || '').trim();
    if (!type) continue;
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([type]) => reactionEmoji(type));
};

/**
 * =========================
 * ✅ FORMAT COUNT FOR REACTIONS (2K, 1.2M, etc.)
 * =========================
 */
const fmtCount = (n: number) => {
  const num = Number(n || 0);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(num % 1_000 === 0 ? 0 : 1) + "K";
  return String(num);
};

/**
 * =========================
 * ✅ PROFESSIONAL FORMAT FOR REACTION TEXT
 * =========================
 */
const formatReactionText = (totalCount: number, reactorName: string): string => {
  if (totalCount === 0) return '';
  
  const formattedTotal = fmtCount(totalCount);
  
  if (totalCount === 1) {
    return `${formattedTotal} · ${reactorName}`;
  }
  
  // For 2+ reactions: "5 · Jastin Beda and 4 others"
  const othersCount = totalCount - 1;
  const formattedOthers = fmtCount(othersCount);
  
  return `${formattedTotal} · ${reactorName} and ${formattedOthers} other${othersCount !== 1 ? 's' : ''}`;
};

/**
 * =========================
 * ✅ STABLE HASH FOR CONSISTENT REACTOR NAME (NO FLICKER)
 * =========================
 */
const stableHash = (input: any) => {
  const s = String(input ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
};

/**
 * =========================
 * ✅ RESOLVE USER DISPLAY NAME SAFELY
 * =========================
 */
const resolveUserName = (reaction: any, users?: any[]) => {
  const uid = Number(
    reaction?.user_id ??
      reaction?.userId ??
      reaction?.user?.id ??
      reaction?.user?.user_id ??
      0
  );

  const user =
    (users || []).find((u) => Number(u?.id) === uid) ||
    reaction?.user ||
    null;

  const name = String(
    reaction?.name ??
      reaction?.user?.name ??
      user?.name ??
      user?.username ??
      reaction?.username ??
      ""
  ).trim();

  return name;
};

/**
 * =========================
 * ✅ PICK STABLE REACTOR NAME (NO Math.random)
 * =========================
 */
const pickStableReactorName = (
  postId: number | string,
  reactions: any[],
  users?: any[]
) => {
  if (!Array.isArray(reactions) || reactions.length === 0) return "";

  // stable index so it doesn't change every render
  const idx = stableHash(postId) % reactions.length;
  const r = reactions[idx] || reactions[0];

  const name = resolveUserName(r, users);
  return String(name || "").trim();
};

/**
 * =========================
 * ✅ ENHANCED LINK PREVIEW - FACEBOOK STYLE
 * =========================
 */
const getLinkPreview = async (text: string): Promise<LinkPreview | null> => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = text.match(urlRegex);
  if (!match?.[0]) return null;

  const url = match[0];
  let domain = '';
  try {
    domain = new URL(url).hostname.replace('www.', '');
  } catch {
    return null;
  }

  try {
    // Fetch real metadata from the URL
    const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
    const data = await response.json();
    
    if (data.success && data.data) {
      return {
        url,
        title: data.data.title || domain,
        description: data.data.description || `Visit ${domain} for more information.`,
        image: data.data.image || 'https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&w=800&q=80',
        domain: domain,
      };
    }
  } catch (error) {
    console.debug('Link preview fetch failed, using fallback');
  }

  // Fallback previews for common domains
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
    title: domain,
    description: `Visit ${domain} for more information.`,
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
  '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤'
];

/**
 * =========================
 * ✅ ENHANCED FACEBOOK-STYLE REACTION DOCK WITH 25+ EMOJIS
 * =========================
 */
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
 * ✅ GLOBAL STYLES FIX - Mount once only
 * =========================
 */
let reactionStyleMounted = false;

const ensureReactionStyles = () => {
  if (reactionStyleMounted) return;
  reactionStyleMounted = true;
  const styleTag = document.createElement('style');
  styleTag.textContent = reactionStyles;
  styleTag.setAttribute('data-reaction-styles', '1');
  document.head.appendChild(styleTag);
};

/**
 * =========================
 * ✅ NEW ICONS FOR REACT/DISCUSS UI
 * =========================
 */

// ✅ Spark icon (React) - orange/coral gradient like the screenshot
const SparkReactIcon: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="uneraSparkGrad" x1="12" y1="52" x2="52" y2="12">
        <stop offset="0%" stopColor="#FF7A45" />
        <stop offset="55%" stopColor="#FF5A6A" />
        <stop offset="100%" stopColor="#FF8A3D" />
      </linearGradient>
      <filter id="uneraSparkGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* soft glow */}
    <circle cx="32" cy="32" r="18" fill="url(#uneraSparkGrad)" opacity="0.14" />

    {/* spark rays */}
    <g stroke="url(#uneraSparkGrad)" strokeWidth="5.2" strokeLinecap="round" filter="url(#uneraSparkGlow)">
      <line x1="32" y1="10" x2="32" y2="18" />
      <line x1="32" y1="46" x2="32" y2="54" />
      <line x1="10" y1="32" x2="18" y2="32" />
      <line x1="46" y1="32" x2="54" y2="32" />

      <line x1="17" y1="17" x2="22.8" y2="22.8" />
      <line x1="41.2" y1="41.2" x2="47" y2="47" />
      <line x1="47" y1="17" x2="41.2" y2="22.8" />
      <line x1="22.8" y1="41.2" x2="17" y2="47" />
    </g>

    {/* center dot */}
    <circle cx="32" cy="32" r="6.2" fill="url(#uneraSparkGrad)" />
  </svg>
);

// ✅ Discuss icon - same "chat + signal" style, colored with UNERA blue
const DiscussSignalIcon: React.FC<{ size?: number; color?: string }> = ({ size = 26, color = "#1877F2" }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <g fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
      {/* bubble */}
      <path d="M14 20c0-5 4-9 9-9h18c7 0 13 6 13 13v6c0 7-6 13-13 13H30l-9 7v-7h-1c-6 0-10-4-10-10V20z" />
      {/* dots */}
      <circle cx="27" cy="30" r="2.2" />
      <circle cx="33" cy="30" r="2.2" />
      <circle cx="39" cy="30" r="2.2" />
      {/* signal arcs */}
      <path d="M48 18c3 2 5 5 6 9" />
      <path d="M44 22c2 1 3 3 4 6" />
    </g>
  </svg>
);

/**
 * =========================
 * ✅ GROUP POST HEADER - FACEBOOK STYLE WITH GROUP + USER OVERLAY
 * =========================
 */
const GroupPostHeader: React.FC<{
  post: any;
  group?: any;
  author?: any;
  onOpenGroup?: (groupId: number) => void;
  onOpenProfile?: (userId: number) => void;
  onOpenMenu?: () => void;
}> = ({ post, group, author, onOpenGroup, onOpenProfile, onOpenMenu }) => {
  const groupName = safeStr(group?.name || post?.group_name);
  const groupId = Number(group?.id || post?.group_id || 0);

  const userName = safeStr(author?.name || post?.name || post?.username);
  const userId = Number(author?.id || post?.user_id || 0);

  const groupImg =
    safeStr(group?.profile_image || group?.avatar || group?.image || post?.group_image) || "";
  const userImg =
    safeStr(author?.profile_image_url || author?.avatar || post?.profile_image_url) || "";

  const timeAgo = formatRelativeTime(post?.created_at);

  return (
    <div className="flex items-start justify-between px-3 pt-3">
      <div className="flex items-start gap-3 min-w-0">
        {/* Group avatar with user overlay - MAKE GROUP AVATAR CLICKABLE */}
        <button
          className="relative shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            if (groupId && onOpenGroup) onOpenGroup(groupId);
          }}
          title={groupName}
        >
          <div className="w-10 h-10 rounded-full bg-[#3A3B3C] overflow-hidden flex items-center justify-center border border-[#4E4F50]">
            {groupImg ? (
              <img src={groupImg} className="w-full h-full object-cover" />
            ) : (
              <i className="fas fa-users text-[#B0B3B8]" />
            )}
          </div>

          {/* Small overlay user avatar (like Facebook) */}
          <div className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full bg-[#3A3B3C] overflow-hidden border-2 border-[#242526] flex items-center justify-center">
            {userImg ? (
              <img src={userImg} className="w-full h-full object-cover" />
            ) : (
              <i className="fas fa-user text-[10px] text-[#B0B3B8]" />
            )}
          </div>
        </button>

        {/* Title + meta */}
        <div className="min-w-0">
          {/* Group name row - MAKE GROUP NAME CLICKABLE */}
          <button
            className="text-left font-extrabold text-[18px] leading-[1.1] text-[#E4E6EB] truncate hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              if (groupId && onOpenGroup) onOpenGroup(groupId);
            }}
          >
            {groupName || "Group"}
          </button>

          {/* User + time row */}
          <div className="flex items-center gap-2 text-[13px] text-[#B0B3B8] min-w-0">
            <button
              className="font-semibold text-[#B0B3B8] hover:underline truncate"
              onClick={(e) => {
                e.stopPropagation();
                if (userId && onOpenProfile) onOpenProfile(userId);
              }}
            >
              {userName || "User"}
            </button>

            <span>·</span>
            <span className="truncate">{timeAgo}</span>

            <span>·</span>
            <i className="fas fa-users text-[12px]" />
          </div>
        </div>
      </div>

      {/* Right menu */}
      <button
        className="w-9 h-9 rounded-full hover:bg-[#3A3B3C] flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          if (onOpenMenu) onOpenMenu();
        }}
      >
        <i className="fas fa-ellipsis-h text-[#B0B3B8]" />
      </button>
    </div>
  );
};

/**
 * =========================
 * ✅ UPDATED: ExpandableRichText Component for Show More/Show Less
 * =========================
 */
const ExpandableRichText: React.FC<{
  text: string;
  users?: User[];
  onProfileClick: (id: number) => void;
  onHashtagClick?: (tag: string) => void;
  maxWords?: number;
  fontSizePx?: number;
  forceExpanded?: boolean;
}> = ({
  text,
  users,
  onProfileClick,
  onHashtagClick,
  maxWords = 14, // Changed from 25 to 14 words
  fontSizePx = 21,
  forceExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  const isLong = words.length > maxWords;

  const showAll = forceExpanded || expanded || !isLong;
  const shownText = showAll ? text : words.slice(0, maxWords).join(' ') + '…';

  return (
    <div style={{ fontSize: `${fontSizePx}px` }} className="text-[#E4E6EB] leading-relaxed">
      <RichText
        text={shownText}
        users={users}
        onProfileClick={onProfileClick}
        onHashtagClick={onHashtagClick}
      />

      {isLong && !forceExpanded && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="ml-2 font-bold text-[#1877F2] hover:underline"
        >
          {expanded ? 'See less' : 'See more'}
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
 * ✅ UPDATED: FACEBOOK-STYLE REACTION BUTTON - NOW SHOWS "React" LABEL
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

  useEffect(() => {
    ensureReactionStyles();
  }, []);

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

  const handleClick = () => {
    if (isGuest) return alert('Please login to react.');
    if (currentUserReactions) {
      setIsAnimating(true);
      onReact(currentUserReactions);
      setTimeout(() => setIsAnimating(false), 300);
    } else {
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
      {showPreview && (
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-[#242526] rounded-full shadow-2xl p-3 border border-[#3E4042] z-50 reaction-preview">
          <div className="text-3xl">
            {previewEmoji}
          </div>
        </div>
      )}

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
            {/* keep emoji when reacted */}
            <span className="text-[20px] transition-transform duration-300">
              {activeReaction.icon}
            </span>

            {/* ✅ ALWAYS show label "React" (not Like/Love/etc), but keep active color */}
            <span
              className="text-[17px] font-medium transition-colors duration-300"
              style={{ color: activeReaction.color }}
            >
              React
            </span>
          </>
        ) : (
          <>
            {/* ✅ Spark-style icon + label React */}
            <span className="flex items-center justify-center -mt-[1px]">
              <SparkReactIcon size={26} />
            </span>
            <span className="text-[17px] font-medium text-[#B0B3B8]">React</span>
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

  const cleanUrl = mediaUrl.split('?')[0].split('#')[0];
  const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';

  const isImage =
    typeRaw === 'image' ||
    mediaTypeRaw === 'image' ||
    mediaTypeRaw.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic'].includes(ext);

  const isVideo =
    typeRaw === 'video' ||
    mediaTypeRaw === 'video' ||
    mediaTypeRaw.startsWith('video/') ||
    ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'flv', 'wmv', '3gp'].includes(ext);

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
 * ✅ getPostMediaList Helper for Multiple Images Support
 * =========================
 */
type NormalizedMedia = { url: string; kind: 'image' | 'video' };

const getPostMediaList = (post: any): NormalizedMedia[] => {
  const out: NormalizedMedia[] = [];

  const arrUrls: any[] = Array.isArray(post?.media_urls)
    ? post.media_urls
    : Array.isArray(post?.images)
      ? post.images
      : [];

  for (const u of arrUrls) {
    const url = String(u || '').trim();
    if (!url) continue;
    out.push({ url, kind: 'image' });
  }

  const arrMedia: any[] = Array.isArray(post?.media) ? post.media : [];
  for (const m of arrMedia) {
    const url = String(m?.url || m?.media_url || '').trim();
    if (!url) continue;

    const type = String(m?.type || m?.media_type || '').toLowerCase();
    const clean = url.split('?')[0].split('#')[0];
    const ext = clean.split('.').pop()?.toLowerCase() || '';

    const isVideo =
      type.startsWith('video') ||
      ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', '3gp'].includes(ext);

    out.push({ url, kind: isVideo ? 'video' : 'image' });
  }

  if (out.length === 0) {
    const single = String(post?.media_url || '').trim();
    if (single) {
      const info = getMediaTypeInfo(post);
      if (info.isVideo) out.push({ url: single, kind: 'video' });
      else if (info.isImage) out.push({ url: single, kind: 'image' });
    }
  }

  return out.filter((x) => x.url);
};

/**
 * =========================
 * ✅ FIXED: MediaGrid Component - Full Width with Gallery Support (KEEP AS IS)
 * =========================
 */
const MediaGrid: React.FC<{
  media: { url: string }[];
  onOpen: (url: string, index: number) => void;
}> = ({ media, onOpen }) => {
  const total = media.length;
  const show = total <= 4 ? media : media.slice(0, 4);
  const extra = total - 4;

  const Tile = ({
    url,
    index,
    className,
    showOverlay,
  }: {
    url: string;
    index: number;
    className: string;
    showOverlay?: boolean;
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(url, index);
      }}
      className={`relative overflow-hidden ${className}`}
      style={{ borderRadius: 0 }}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />

      {showOverlay && extra > 0 && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <span className="text-white font-black text-3xl">+{extra}</span>
        </div>
      )}
    </button>
  );

  if (total === 1) {
    return (
      <div className="w-full bg-black">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(show[0].url, 0);
          }}
          className="w-full block"
        >
          <img
            src={show[0].url}
            alt=""
            loading="lazy"
            className="w-full h-auto max-h-[650px] object-contain"
          />
        </button>
      </div>
    );
  }

  if (total === 2) {
    return (
      <div className="w-full grid grid-cols-2 gap-[2px] bg-black">
        <Tile url={show[0].url} index={0} className="h-[320px] w-full" />
        <Tile url={show[1].url} index={1} className="h-[320px] w-full" />
      </div>
    );
  }

  if (total === 3) {
    return (
      <div className="w-full grid grid-cols-2 gap-[2px] bg-black">
        <Tile url={show[0].url} index={0} className="h-[420px] w-full" />
        <div className="grid grid-rows-2 gap-[2px] h-[420px]">
          <Tile url={show[1].url} index={1} className="w-full h-full" />
          <Tile url={show[2].url} index={2} className="w-full h-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full grid grid-cols-2 gap-[2px] bg-black">
      <Tile url={show[0].url} index={0} className="h-[260px] w-full" />
      <Tile url={show[1].url} index={1} className="h-[260px] w-full" />
      <Tile url={show[2].url} index={2} className="h-[260px] w-full" />
      <Tile
        url={show[3].url}
        index={3}
        className="h-[260px] w-full"
        showOverlay={extra > 0}
      />
    </div>
  );
};

/**
 * =========================
 * ✅ REACTIONS SHEET - FACEBOOK STYLE WITH TABS
 * =========================
 */
export const ReactionsSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  postId: number;
  onProfileClick: (id: number) => void;
  onOpenComments?: (postId: number) => void;
}> = ({ isOpen, onClose, postId, onProfileClick, onOpenComments }) => {
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<string>("all");
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setItems([]);
    setCounts({});
    setActive("all");

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    (async () => {
      try {
        const data = await apiFetch(`/api/posts/${postId}/reactions?limit=500&offset=0`, {
          signal: abortRef.current?.signal as any,
        } as any);

        const arr = Array.isArray(data?.reactions) ? data.reactions : [];
        setItems(arr);

        const map: Record<string, number> = {};
        for (const r of arr) {
          const t = String(r?.type || "like").toLowerCase();
          map[t] = (map[t] || 0) + 1;
        }
        setCounts(map);
      } catch (e) {
        // ignore abort
      } finally {
        setLoading(false);
      }
    })();

    return () => abortRef.current?.abort();
  }, [isOpen, postId]);

  if (!isOpen) return null;

  const typesSorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  const filtered =
    active === "all" ? items : items.filter((x) => String(x?.type).toLowerCase() === active);

  const Tab = ({ t, label, count }: { t: string; label: React.ReactNode; count: number }) => (
    <button
      onClick={() => setActive(t)}
      className={`px-3 py-2 text-[15px] font-bold border-b-2 whitespace-nowrap ${
        active === t ? "text-[#1877F2] border-[#1877F2]" : "text-[#B0B3B8] border-transparent"
      }`}
    >
      {label} {count ? <span className="ml-1">{count}</span> : null}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[9999] bg-[#18191A] flex flex-col">
      {/* header */}
      <div className="p-4 border-b border-[#3E4042] flex items-center gap-3 bg-[#242526]">
        <button
          className="w-10 h-10 rounded-full hover:bg-[#3A3B3C] flex items-center justify-center"
          onClick={onClose}
          aria-label="Back"
        >
          <i className="fas fa-arrow-left text-[#E4E6EB] text-xl"></i>
        </button>
        <div className="text-[#E4E6EB] font-bold text-[18px]">People who reacted</div>
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[#3E4042] bg-[#242526] scrollbar-hide">
        <Tab t="all" label="All" count={items.length} />
        {typesSorted.map((t) => (
          <Tab
            key={t}
            t={t}
            label={<span className="text-[18px]">{reactionEmoji(t)}</span>}
            count={counts[t] || 0}
          />
        ))}
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-[#B0B3B8] text-center">Loading reactions...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-[#B0B3B8] text-center">No reactions yet.</div>
        ) : (
          <div className="p-2">
            {filtered.map((r, idx) => {
              const u = r?.user || {};
              const uid = Number(u?.id || r?.user_id || 0);
              const name = String(u?.name || u?.username || "User");
              const img = avatarFrom(u);

              return (
                <button
                  key={String(uid) + "-" + idx}
                  className="w-full flex items-center gap-3 p-3 hover:bg-[#3A3B3C] rounded-xl text-left"
                  onClick={() => uid && onProfileClick(uid)}
                >
                  <div className="relative">
                    <img src={img} className="w-12 h-12 rounded-full object-cover" alt="" />
                    <div className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-[#242526] border border-[#3E4042] flex items-center justify-center text-[14px]">
                      {reactionEmoji(String(r?.type))}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[#E4E6EB] font-bold truncate">{name}</div>
                    {u?.username ? (
                      <div className="text-[#B0B3B8] text-xs truncate">@{u.username}</div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Optional: Discussions button at bottom - CHANGED TEXT ONLY */}
      {onOpenComments && (
        <div className="p-4 border-t border-[#3E4042] bg-[#242526]">
          <button
            onClick={() => {
              onClose();
              onOpenComments(postId);
            }}
            className="w-full py-3 bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] font-bold rounded-lg transition-colors"
          >
            View Discussions  {/* ✅ CHANGED from "View Comments" to "View Discussions" */}
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * =========================
 * ✅ FIXED: GALLERY VIEWER WITH LIKE/COMMENT/SHARE AT THE BOTTOM
 * AND REACTIONS SHEET SUPPORT
 * =========================
 */
export const GalleryViewer: React.FC<{
  isOpen: boolean;
  urls: string[];
  startIndex: number;
  onClose: () => void;
  // Action props
  postId: number;
  currentUser: User | null;
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  myReaction?: ReactionType;
  onReact: (type: ReactionType) => void;
  onOpenComments: () => void;
  onShare: () => void;
  onOpenReactions?: () => void;
}> = ({ 
  isOpen, 
  urls, 
  startIndex, 
  onClose,
  postId,
  currentUser,
  reactionCount,
  commentCount,
  shareCount,
  myReaction,
  onReact,
  onOpenComments,
  onShare,
  onOpenReactions
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    setCurrentIndex(startIndex);

    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const w = el.clientWidth || window.innerWidth;
      el.scrollTo({ left: startIndex * w, behavior: 'instant' as any });
    });

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, startIndex]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const width = el.clientWidth || window.innerWidth;
    const newIndex = Math.round(scrollLeft / width);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white text-sm font-semibold">
          {currentIndex + 1}/{urls.length}
        </div>
        <button
          className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center"
          onClick={onClose}
          aria-label="Close"
        >
          <i className="fas fa-times text-white text-lg"></i>
        </button>
      </div>

      {/* Images */}
      <div
        ref={scrollerRef}
        className="flex-1 w-full overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => e.stopPropagation()}
        onScroll={handleScroll}
      >
        {urls.map((url, i) => (
          <div
            key={url + i}
            className="min-w-full h-full snap-center flex items-center justify-center bg-black"
          >
            <img
              src={url}
              alt=""
              className="max-w-full max-h-full object-contain"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>

      {/* Action Buttons - Fixed at bottom */}
      <div 
        className="bg-black/80 backdrop-blur-sm border-t border-white/10 px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Totals row */}
        <div className="flex items-center justify-between text-[#B0B3B8] text-sm mb-2 px-2">
          <div className="flex items-center gap-2">
            {reactionCount > 0 && (
              <span 
                className="text-[#E4E6EB] font-bold cursor-pointer hover:underline flex items-center gap-2"
                onClick={onOpenReactions}
              >
                <div className="flex -space-x-2">
                  {Array.from(new Set([myReaction, 'like', 'love']))
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((t, i) => (
                      <span
                        key={i}
                        className="w-[22px] h-[22px] rounded-full bg-[#3A3B3C] border border-black flex items-center justify-center text-[14px]"
                      >
                        {reactionEmoji(t as string)}
                      </span>
                    ))}
                </div>
                {fmtCount(reactionCount)}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <span 
              className="hover:underline cursor-pointer" 
              onClick={onOpenComments}
            >
              {formatCount(commentCount)} Discussions  {/* ✅ CHANGED from "Comments" to "Discussions" */}
            </span>
            {shareCount > 0 && (
              <span className="hover:underline cursor-pointer" onClick={onShare}>
                {formatCount(shareCount)} Shares
              </span>
            )}
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between">
          <ReactionButton
            currentUserReactions={myReaction}
            reactionCount={reactionCount}
            onReact={onReact}
            isGuest={!currentUser}
          />
          <button
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group"
            onClick={() => (currentUser ? onOpenComments() : alert("Login first"))}
          >
            <DiscussSignalIcon size={26} color="#1877F2" />
            <span className="text-[17px] font-medium text-[#B0B3B8] group-hover:text-[#E4E6EB]">
              Discuss
            </span>
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
            onClick={() => (currentUser ? onShare() : alert("Please login to share posts."))}
          >
            <i className="fas fa-share text-[20px]"></i>
            <span className="text-[17px] font-medium">Share</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * =========================
 * ✅ SHARE BOTTOM SHEET
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
        const nextShares = safeNumber(
          response?.shares ?? response?.share_count, 
          safeNumber(post.shares || 0, 0) + 1
        );
        
        onShareComplete(destination, { 
          success: true, 
          data: response,
          shares: nextShares
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

  const textPreview = getPostTextPreview(post, 100);
  const previewUrl = useMemo(() => {
    return (
      (Array.isArray(post?.media_urls) && post.media_urls[0]) ||
      (Array.isArray(post?.images) && post.images[0]) ||
      post?.media_url ||
      ''
    );
  }, [post]);

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
              src={avatarFrom(currentUser)}
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
            onClick={() => handleShareAction('group')}
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
                    src={group.image || avatarFrom(group)}
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
                    src={avatarFrom(user)}
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
              {previewUrl ? (
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                  <img 
                    src={previewUrl} 
                    alt="Post" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : textPreview ? (
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-[#1877F2]/10 flex items-center justify-center">
                  <i className="fas fa-file-alt text-[#1877F2] text-xl"></i>
                </div>
              ) : null}
              
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
                  {textPreview || 'Shared post'}
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
                          src={avatarFrom(user)}
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
 * ✅ PEOPLE YOU MAY KNOW - FACEBOOK STYLE FEED CARD
 * =========================
 */
interface PeopleSuggestion {
  id: number;
  username: string;
  name: string;
  profile_image_url: string | null;
  is_verified: boolean;
  role: string;
  mutual_count: number;
  is_following: boolean;
  score: number;
}

export const PeopleYouMayKnowGrid: React.FC<{
  users: PeopleSuggestion[];
  onFollow: (userId: number) => void;
  currentUser: User | null;
  isLoading?: boolean;
  onLoginClick?: () => void;
  title?: string;
  maxDisplay?: number;
}> = ({
  users = [],
  onFollow,
  currentUser,
  isLoading = false,
  onLoginClick,
  title = "People You May Know",
  maxDisplay = 6
}) => {
  const [followLoading, setFollowLoading] = useState<{ [key: number]: boolean }>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const displayUsers = users.slice(0, maxDisplay);

  // Check scroll position for arrows
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    checkScroll();
    el.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, displayUsers.length]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    
    const scrollAmount = 300;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const handleFollow = async (userId: number) => {
    setFollowLoading(prev => ({ ...prev, [userId]: true }));
    try {
      await onFollow(userId);
    } finally {
      setFollowLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="bg-[#242526] w-full p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[#E4E6EB] font-bold text-[17px]">{title}</h3>
          </div>
          <div className="flex gap-3 overflow-x-hidden py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-[140px] animate-pulse">
                <div className="w-20 h-20 mx-auto mb-2 bg-[#3A3B3C] rounded-full"></div>
                <div className="h-4 bg-[#3A3B3C] rounded w-24 mx-auto mb-1"></div>
                <div className="h-3 bg-[#3A3B3C] rounded w-16 mx-auto mb-3"></div>
                <div className="h-8 bg-[#3A3B3C] rounded-lg w-full"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
      </div>
    );
  }

  if (displayUsers.length === 0) return null;

  return (
    <div className="w-full">
      <div className="bg-[#242526] w-full p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[#E4E6EB] font-bold text-[17px]">{title}</h3>
          <div className="flex items-center gap-1">
            {canScrollLeft && (
              <button
                onClick={() => scroll('left')}
                className="w-8 h-8 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] flex items-center justify-center transition-colors"
                aria-label="Scroll left"
              >
                <i className="fas fa-chevron-left text-[#E4E6EB] text-sm"></i>
              </button>
            )}
            {canScrollRight && (
              <button
                onClick={() => scroll('right')}
                className="w-8 h-8 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] flex items-center justify-center transition-colors"
                aria-label="Scroll right"
              >
                <i className="fas fa-chevron-right text-[#E4E6EB] text-sm"></i>
              </button>
            )}
          </div>
        </div>

        {/* Horizontal scrollable grid */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {displayUsers.map((user) => (
            <div
              key={user.id}
              className="flex-shrink-0 w-[140px] bg-[#3A3B3C] rounded-lg p-3 hover:bg-[#4E4F50] transition-colors group"
            >
              {/* Profile Image */}
              <div className="relative w-20 h-20 mx-auto mb-2">
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#1877F2] group-hover:border-[#166FE5] transition-colors">
                  <img
                    src={user.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1877F2&color=fff&bold=true`}
                    alt={user.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1877F2&color=fff&bold=true`;
                    }}
                  />
                </div>
                {user.is_verified && (
                  <i className="fas fa-check-circle absolute bottom-0 right-0 text-[#1877F2] text-sm bg-[#242526] rounded-full p-0.5 border border-[#3A3B3C]"></i>
                )}
              </div>

              {/* Name */}
              <div className="text-center mb-1">
                <span className="text-[#E4E6EB] font-semibold text-[13px] truncate block">
                  {user.name}
                </span>
              </div>

              {/* Mutual count */}
              {user.mutual_count > 0 && (
                <div className="text-center mb-2">
                  <span className="text-[#B0B3B8] text-[11px]">
                    {user.mutual_count} mutual friend{user.mutual_count !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Follow Button */}
              {!currentUser ? (
                <button
                  onClick={onLoginClick}
                  className="w-full py-1.5 bg-[#1877F2] hover:bg-[#166FE5] text-white text-[12px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <i className="fas fa-sign-in-alt text-[10px]"></i>
                  <span>Sign in</span>
                </button>
              ) : (
                <button
                  onClick={() => handleFollow(user.id)}
                  disabled={followLoading[user.id]}
                  className={`w-full py-1.5 text-[12px] font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1 ${
                    user.is_following
                      ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                      : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                  } disabled:opacity-70 disabled:cursor-not-allowed`}
                >
                  {followLoading[user.id] ? (
                    <i className="fas fa-spinner fa-spin text-[10px]"></i>
                  ) : (
                    <>
                      <i className={`fas ${user.is_following ? 'fa-check' : 'fa-user-plus'} text-[10px]`}></i>
                      <span>{user.is_following ? 'Following' : 'Follow'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Facebook-style separator */}
      <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
    </div>
  );
};

/**
 * =========================
 * ✅ GROUPS YOU MAY JOIN - FACEBOOK STYLE FEED CARD
 * =========================
 */
interface GroupSuggestion {
  id: number;
  admin_id: number;
  name: string;
  description: string;
  type: "public" | "private";
  cover_image?: string;
  profile_image?: string;
  created_at?: string;
  category: string;
  members_count: number;
  mutual_count: number;
  is_member: boolean;
  score: number;
}

export const GroupsYouMayJoinCard: React.FC<{
  groups: GroupSuggestion[];
  onJoin: (groupId: number) => void;
  currentUser: User | null;
  isLoading?: boolean;
  onLoginClick?: () => void;
  onOpenGroup?: (groupId: number) => void;
  title?: string;
  maxDisplay?: number;
}> = ({
  groups = [],
  onJoin,
  currentUser,
  isLoading = false,
  onLoginClick,
  onOpenGroup,
  title = "Groups You May Join",
  maxDisplay = 6
}) => {
  const [joinLoading, setJoinLoading] = useState<{ [key: number]: boolean }>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const displayGroups = groups.slice(0, maxDisplay);

  // Check scroll position for arrows
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    checkScroll();
    el.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, displayGroups.length]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    
    const scrollAmount = 300;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const handleJoin = async (groupId: number) => {
    setJoinLoading(prev => ({ ...prev, [groupId]: true }));
    try {
      await onJoin(groupId);
    } finally {
      setJoinLoading(prev => ({ ...prev, [groupId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="bg-[#242526] w-full p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[#E4E6EB] font-bold text-[17px]">{title}</h3>
          </div>
          <div className="flex gap-3 overflow-x-hidden py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-[180px] animate-pulse">
                <div className="h-24 bg-[#3A3B3C] rounded-t-lg"></div>
                <div className="p-3 bg-[#3A3B3C]">
                  <div className="h-4 bg-[#4E4F50] rounded w-24 mb-2"></div>
                  <div className="h-3 bg-[#4E4F50] rounded w-16 mb-3"></div>
                  <div className="h-8 bg-[#4E4F50] rounded-lg w-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
      </div>
    );
  }

  if (displayGroups.length === 0) return null;

  return (
    <div className="w-full">
      <div className="bg-[#242526] w-full p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[#E4E6EB] font-bold text-[17px]">{title}</h3>
          <div className="flex items-center gap-1">
            {canScrollLeft && (
              <button
                onClick={() => scroll('left')}
                className="w-8 h-8 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] flex items-center justify-center transition-colors"
                aria-label="Scroll left"
              >
                <i className="fas fa-chevron-left text-[#E4E6EB] text-sm"></i>
              </button>
            )}
            {canScrollRight && (
              <button
                onClick={() => scroll('right')}
                className="w-8 h-8 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] flex items-center justify-center transition-colors"
                aria-label="Scroll right"
              >
                <i className="fas fa-chevron-right text-[#E4E6EB] text-sm"></i>
              </button>
            )}
          </div>
        </div>

        {/* Horizontal scrollable grid */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {displayGroups.map((group) => (
            <div
              key={group.id}
              className="flex-shrink-0 w-[180px] bg-[#3A3B3C] rounded-lg overflow-hidden hover:bg-[#4E4F50] transition-colors group"
            >
              {/* Cover Image */}
              <div 
                className="h-24 bg-[#4E4F50] cursor-pointer relative"
                onClick={() => onOpenGroup?.(group.id)}
              >
                {group.cover_image ? (
                  <img
                    src={group.cover_image}
                    alt={group.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1877F2] to-[#166FE5]">
                    <i className="fas fa-users text-white text-2xl opacity-50"></i>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-3">
                {/* Group Name and Profile Image */}
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className="w-10 h-10 rounded-full overflow-hidden bg-[#4E4F50] flex-shrink-0 cursor-pointer border-2 border-[#1877F2] group-hover:border-[#166FE5] transition-colors"
                    onClick={() => onOpenGroup?.(group.id)}
                  >
                    {group.profile_image ? (
                      <img
                        src={group.profile_image}
                        alt={group.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#3A3B3C]">
                        <i className="fas fa-users text-[#B0B3B8] text-sm"></i>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div 
                      className="text-[#E4E6EB] font-semibold text-[13px] truncate cursor-pointer hover:underline"
                      onClick={() => onOpenGroup?.(group.id)}
                    >
                      {group.name}
                    </div>
                    <div className="text-[#B0B3B8] text-[11px] truncate">
                      {group.category}
                    </div>
                  </div>
                </div>

                {/* Member stats */}
                <div className="text-[#B0B3B8] text-[11px] mb-2">
                  {group.members_count.toLocaleString()} members
                  {group.mutual_count > 0 && (
                    <span> · {group.mutual_count} mutual</span>
                  )}
                </div>

                {/* Join Button */}
                {!currentUser ? (
                  <button
                    onClick={onLoginClick}
                    className="w-full py-1.5 bg-[#1877F2] hover:bg-[#166FE5] text-white text-[12px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <i className="fas fa-sign-in-alt text-[10px]"></i>
                    <span>Sign in</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleJoin(group.id)}
                    disabled={joinLoading[group.id] || group.is_member}
                    className={`w-full py-1.5 text-[12px] font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1 ${
                      group.is_member
                        ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                        : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                    } disabled:opacity-70 disabled:cursor-not-allowed`}
                  >
                    {joinLoading[group.id] ? (
                      <i className="fas fa-spinner fa-spin text-[10px]"></i>
                    ) : (
                      <>
                        <i className={`fas ${group.is_member ? 'fa-check' : 'fa-user-plus'} text-[10px]`}></i>
                        <span>{group.is_member ? 'Joined' : 'Join Group'}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Facebook-style separator */}
      <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
    </div>
  );
};

// Add CSS for hiding scrollbar
const scrollbarHideStyles = `
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

// Inject styles if not already present
if (typeof document !== 'undefined') {
  const styleId = 'people-you-may-know-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = scrollbarHideStyles;
    document.head.appendChild(style);
  }
}

/**
 * =========================
 * ✅ EVENT DETECTION AND NORMALIZATION WITH COVER IMAGE FIX
 * =========================
 */
const safeParseJsonArray = (v: any): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string') {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) return arr.filter(Boolean).map(String);
    } catch {}
  }
  return [];
};

const getEventCover = (item: any, meta?: any) => {
  // Check media_urls first (JSON array)
  const urls = safeParseJsonArray(item?.media_urls);
  if (urls.length > 0) return urls[0];
  
  // Check single media_url
  if (item?.media_url) return item.media_url;
  
  // Check meta for cover_url
  if (meta?.cover_url) return meta.cover_url;
  
  // Check meta for image/cover in various formats
  if (meta?.image) return meta.image;
  if (meta?.cover) return meta.cover;
  
  return '';
};

/**
 * =========================
 * ✅ FIXED: normalizeEventFromFeed - Maps API response to EventPost props
 * =========================
 */
const normalizeEventFromFeed = (item: any) => {
  const metaRaw = item?.meta || {};
  let meta: any = metaRaw;
  
  if (typeof metaRaw === "string") {
    try { meta = JSON.parse(metaRaw); } catch { meta = {}; }
  }

  const cover = getEventCover(item, meta);

  // ✅ api/feeds event fields:
  // title -> item.content
  // description -> item.event_description
  // date -> item.event_date (your DB column is event_date)
  const id = Number(item?.event_id ?? item?.id ?? meta?.event_id ?? 0);

  return {
    id,
    title: String(item?.content ?? meta?.title ?? "Event"),
    description: String(item?.event_description ?? meta?.description ?? ""),
    cover_url: String(cover || ""),
    location: String(item?.location ?? meta?.location ?? ""),
    event_date: String(item?.event_date ?? meta?.event_date ?? meta?.start_time ?? ""),
    created_at: String(item?.created_at ?? meta?.created_at ?? ""),
    // counts from feeds (what you added in feeds.ts)
    attendees_count: Number(item?.attending_count ?? meta?.attending_count ?? 0),
    interested_count: Number(item?.interested_count ?? meta?.interested_count ?? 0),
    // rsvp status from feeds
    user_rsvp_status: String(item?.my_rsvp_status ?? meta?.my_rsvp_status ?? ""),
    creator_id: Number(item?.user_id ?? meta?.creator_id ?? 0),
    // Creator info
    creator: {
      id: Number(item?.user_id ?? meta?.creator_id ?? 0),
      name: String(item?.name ?? meta?.creator_name ?? "Event Organizer"),
      username: String(item?.username ?? meta?.creator_username ?? ""),
      profile_image_url: String(item?.profile_image_url ?? meta?.creator_image ?? "")
    }
  };
};

/**
 * =========================
 * ✅ ORIGINAL EVENT POST COMPONENT - REVERTED TO ORIGINAL STATE (NO REACTION FEATURES)
 * =========================
 */
export const EventPost: React.FC<{
  event: any;
  author?: any;
  currentUser: User | null;
  users?: User[];
  onProfileClick: (id: number) => void;
  onRSVP?: (eventId: number, status: 'going' | 'interested' | 'not_going') => Promise<any>;
  onFollow?: (id: number) => void;
  isFollowing?: boolean;
  followLoading?: boolean;
  onReact?: (id: number, type: ReactionType) => void;
  onShare?: (id: number, newShareCount: number) => void;
  onOpenComments?: (id: number) => void;
  groups?: Group[];
  brands?: Brand[];
  chats?: any[];
  onEventClick?: (eventId: number) => void;
}> = ({ 
  event, 
  author, 
  currentUser, 
  users = [], 
  onProfileClick, 
  onRSVP,
  onFollow,
  isFollowing = false,
  followLoading = false,
  onReact,
  onShare,
  onOpenComments,
  groups = [],
  brands = [],
  chats = [],
  onEventClick,
}) => {
  const [rsvpStatus, setRsvpStatus] = useState(event.user_rsvp_status || '');
  const [attendeesCount, setAttendeesCount] = useState(event.attendees_count || 0);
  const [interestedCount, setInterestedCount] = useState(event.interested_count || 0);
  const [loading, setLoading] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  
  const creator = author || users?.find(u => Number(u.id) === Number(event.creator_id)) || event.creator || {
    id: event.creator_id,
    name: "Event Organizer",
    username: "",
    profile_image_url: null,
  };
  
  const dateObj = event.event_date ? toDateSafe(event.event_date) : null;
  const nowLocal = new Date();
  const isPast = !!dateObj && dateObj < nowLocal;
  
  const formatEventDate = () => {
    if (!dateObj) return "Date TBD";
    if (dateObj.toDateString() === nowLocal.toDateString()) return "Today";
    
    const tomorrow = new Date(nowLocal);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateObj.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    
    return dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatEventTime = () => {
    if (!dateObj) return "";
    return dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  /**
   * ✅ FIXED: RSVP handler that matches AllEvents.tsx exactly
   */
  const handleRSVPClick = async (target: 'going' | 'interested') => {
    if (!currentUser) {
      alert('Please login to RSVP');
      return;
    }
    if (!event.id) return;

    setLoading(true);

    const prevStatus = rsvpStatus;
    const nextStatus: "" | "going" | "interested" = prevStatus === target ? "" : target;

    const prevAtt = attendeesCount;
    const prevInt = interestedCount;

    let nextAtt = prevAtt;
    let nextInt = prevInt;

    if (target === "going") {
      if (prevStatus === "going") nextAtt = Math.max(0, prevAtt - 1);
      else if (prevStatus === "interested") {
        nextAtt = prevAtt + 1;
        nextInt = Math.max(0, prevInt - 1);
      } else nextAtt = prevAtt + 1;
    } else {
      if (prevStatus === "interested") nextInt = Math.max(0, prevInt - 1);
      else if (prevStatus === "going") {
        nextInt = prevInt + 1;
        nextAtt = Math.max(0, prevAtt - 1);
      } else nextInt = prevInt + 1;
    }

    // Optimistic UI update
    setRsvpStatus(nextStatus);
    setAttendeesCount(nextAtt);
    setInterestedCount(nextInt);

    try {
      let res;
      if (onRSVP) {
        await onRSVP(event.id, (nextStatus || 'not_going') as any);
        res = { success: true };
      } else {
        res = await rsvpEventDirect({
          eventId: event.id,
          userId: safeUserId(currentUser),
          newStatus: (nextStatus || "not_going") as any,
          prevStatus: prevStatus as any,
        });
      }

      // Overwrite with backend truth if available
      if (res?.success) {
        if (res.attending_count !== undefined) {
          setAttendeesCount(Number(res.attending_count));
        }
        if (res.interested_count !== undefined) {
          setInterestedCount(Number(res.interested_count));
        }
        if (res.my_status !== undefined) {
          setRsvpStatus(res.my_status);
        }
      }
    } catch (error) {
      // Rollback on failure
      setRsvpStatus(prevStatus);
      setAttendeesCount(prevAtt);
      setInterestedCount(prevInt);
      console.error('RSVP failed:', error);
      alert('Failed to RSVP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onFollow && creator?.id) {
      onFollow(safeUserId(creator));
    }
  };

  const handleReact = (type: ReactionType) => {
    if (onReact && event.id) {
      onReact(event.id, type);
    }
  };

  const handleShare = () => {
    if (!currentUser) {
      alert('Please login to share');
      return;
    }
    setShowShareSheet(true);
  };

  const handleShareComplete = (destination: string, data?: any) => {
    if (onShare && data?.success && event.id) {
      const newShares = data?.shares || 0;
      onShare(event.id, newShares);
    }
    setShowShareSheet(false);
  };

  const handleOpenComments = () => {
    if (onOpenComments && event.id) {
      onOpenComments(event.id);
    }
  };

  // Handle card click to open preview modal
  const handleCardClick = () => {
    if (onEventClick && event.id) {
      onEventClick(event.id);
    }
  };

  return (
    <>
      <div className="w-full">
        <div 
          className="bg-[#242526] w-full overflow-hidden cursor-pointer"
          onClick={handleCardClick}
        >
          {/* Header */}
          <div className="p-3 md:p-4 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
            <div
              className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                creator?.id && onProfileClick(Number(creator.id));
              }}
            >
              <img
                src={avatarFrom(creator)}
                alt=""
                className="w-10 h-10 rounded-full object-cover border border-[#3E4042]"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <h4 className="font-bold text-[#E4E6EB] text-[18.5px] truncate">
                    {creator?.name || creator?.username || 'User'}
                  </h4>
                </div>
                <div className="flex items-center gap-1.5 text-[#B0B3B8] text-[13px]">
                  <span>{formatRelativeTime(event.created_at)}</span>
                  <span>•</span>
                  <i className="fas fa-globe-americas text-[12px]"></i>
                  <span>• created an event</span>
                </div>
              </div>
            </div>

            {onFollow && currentUser && creator?.id && safeUserId(creator) !== safeUserId(currentUser) && (
              <button
                onClick={handleFollowClick}
                disabled={followLoading}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 ml-2 ${
                  isFollowing 
                    ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]' 
                    : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                } ${followLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {followLoading ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : isFollowing ? (
                  'Following'
                ) : (
                  'Follow'
                )}
              </button>
            )}
          </div>

          {/* EVENT BODY - FIXED: Image now shows on top */}
          <div className="pb-4" onClick={(e) => e.stopPropagation()}>
            <div className="border border-[#3E4042] rounded-2xl overflow-hidden bg-[#18191A]">
              {/* Cover Image */}
              {event.cover_url ? (
                <div className="h-48 bg-[#18191A] overflow-hidden relative">
                  <img
                    src={event.cover_url}
                    alt={event.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        const fallback = document.createElement('div');
                        fallback.className = 'h-48 bg-[#1f2a37] flex items-center justify-center';
                        fallback.innerHTML = '<i class="fas fa-calendar text-white/30 text-5xl"></i>';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                  {/* Date Badge */}
                  {dateObj && (
                    <div className="absolute top-3 left-3 bg-[#242526]/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-[#4E4F50]">
                      <div className="text-[#B0B3B8] text-[11px] font-black">
                        {dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                      </div>
                      <div className="text-[#E4E6EB] text-[20px] font-black leading-tight">
                        {dateObj.getDate()}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-32 bg-[#1f2a37] flex items-center justify-center relative">
                  <i className="fas fa-calendar text-white/30 text-5xl"></i>
                  {dateObj && (
                    <div className="absolute top-3 left-3 bg-[#242526]/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-[#4E4F50]">
                      <div className="text-[#B0B3B8] text-[11px] font-black">
                        {dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                      </div>
                      <div className="text-[#E4E6EB] text-[20px] font-black leading-tight">
                        {dateObj.getDate()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Details */}
              <div className="p-4">
                <div className="text-[#E4E6EB] font-black text-[20px] line-clamp-2">
                  {event.title}
                </div>

                {event.description && (
                  <div className="text-[#B0B3B8] text-[14px] mt-1 line-clamp-2">
                    {event.description}
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  {event.event_date && (
                    <div className="flex items-center gap-2 text-[#B0B3B8] text-[13px]">
                      <i className={`fas fa-calendar-alt ${isPast ? "text-[#B0B3B8]" : "text-[#1877F2]"} w-4`}></i>
                      <span>
                        {formatEventDate()} at {formatEventTime()}
                      </span>
                    </div>
                  )}
                  {event.location && (
                    <div className="flex items-center gap-2 text-[#B0B3B8] text-[13px]">
                      <i className="fas fa-map-marker-alt text-[#F02849] w-4"></i>
                      <span className="line-clamp-1">{event.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[#B0B3B8] text-[13px]">
                    <i className="fas fa-users text-[#45BD62] w-4"></i>
                    <span>{attendeesCount} attending • {interestedCount} interested</span>
                  </div>
                </div>

                {/* RSVP Buttons - Matches AllEvents.tsx exactly */}
                <div className="mt-4 flex gap-2">
                  <button
                    disabled={loading || isPast}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleRSVPClick('going'); 
                    }}
                    className={`flex-1 h-11 rounded-lg font-bold transition-colors ${
                      isPast ? "opacity-50 cursor-not-allowed" : ""
                    } ${
                      rsvpStatus === 'going'
                        ? 'bg-[#45BD62] text-white'
                        : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                    } disabled:opacity-60`}
                  >
                    {loading && rsvpStatus === 'going' ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      rsvpStatus === 'going' ? '✓ Going' : 'Going'
                    )}
                  </button>

                  <button
                    disabled={loading || isPast}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleRSVPClick('interested'); 
                    }}
                    className={`flex-1 h-11 rounded-lg font-bold transition-colors ${
                      isPast ? "opacity-50 cursor-not-allowed" : ""
                    } ${
                      rsvpStatus === 'interested'
                        ? 'bg-[#F7B928] text-black'
                        : 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                    } disabled:opacity-60`}
                  >
                    {loading && rsvpStatus === 'interested' ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      rsvpStatus === 'interested' ? '✓ Interested' : 'Interested'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action row - ORIGINAL EVENT ACTION ROW (NO REACTION SUMMARY) */}
          <div className="px-2 py-1 border-t border-white/10 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
            {/* Like/React Button */}
            <div className="flex-1">
              <ReactionButton
                currentUserReactions={undefined}
                reactionCount={0}
                onReact={handleReact}
                isGuest={!currentUser}
              />
            </div>
            
            {/* Comment Button - UPDATED TO DISCUSS */}
            <button
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group"
              onClick={handleOpenComments}
            >
              <DiscussSignalIcon size={26} color="#1877F2" />
              <span className="text-[17px] font-medium text-[#B0B3B8] group-hover:text-[#E4E6EB]">
                Discuss
              </span>
            </button>
            
            {/* Share Button */}
            <button
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
              onClick={handleShare}
            >
              <i className="fas fa-share text-[20px]"></i>
              <span className="text-[17px] font-medium">Share</span>
            </button>
          </div>
        </div>

        <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
      </div>

      {/* Share Bottom Sheet */}
      {event && (
        <ShareBottomSheet
          isOpen={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          post={{
            id: event.id,
            author: creator,
            content: event.title,
            description: event.description,
            media_url: event.cover_url,
            created_at: event.created_at
          }}
          currentUser={currentUser}
          users={users}
          groups={groups}
          brands={brands}
          chats={chats}
          onShareComplete={handleShareComplete}
        />
      )}
    </>
  );
};

/**
 * =========================
 * ✅ UPDATED: EVENT FEED CARD COMPONENT - ORIGINAL VERSION (NO REACTION FEATURES)
 * =========================
 */
type FeedEventItem = {
  id: number;
  feed_key: string;
  item_type: "event";
  event_id: number;

  user_id: number;
  name: string;
  username: string;
  profile_image_url: string | null;
  created_at: string;

  content: string; // title
  event_date?: string; // from api/feeds
  event_description?: string;
  location?: string;

  media_url?: string | null; // cover
  attending_count?: number;
  interested_count?: number;
  my_rsvp_status?: "" | "going" | "interested";
};

export const EventFeedCard: React.FC<{
  item: FeedEventItem;
  currentUser: { id: number } | null;
  onProfileClick: (id: number) => void;
  onUpdateItem: (patch: Partial<FeedEventItem>) => void;
  onRSVPEvent?: (eventId: number, status: "going" | "interested" | "not_going") => Promise<any>;
  onEventClick?: (eventId: number) => void;
}> = ({ item, currentUser, onProfileClick, onUpdateItem, onRSVPEvent, onEventClick }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const whenText = useMemo(() => {
    const d = item.event_date ? new Date(item.event_date) : null;
    if (!d || isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, { 
      weekday: "short", 
      month: "short", 
      day: "numeric", 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  }, [item.event_date]);

  const dateObj = item.event_date ? toDateSafe(item.event_date) : null;
  const nowLocal = new Date();
  const isPast = !!dateObj && dateObj < nowLocal;

  /**
   * ✅ FIXED: RSVP function now matches AllEvents.tsx logic
   */
  const rsvp = async (target: "going" | "interested") => {
    if (!currentUser) {
      alert("Please login to RSVP");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    const eventId = item.event_id || item.id;
    const prevStatus = (item.my_rsvp_status || '') as '' | 'going' | 'interested';
    const nextStatus: '' | 'going' | 'interested' = prevStatus === target ? '' : target;

    // Save previous counts for rollback
    const prevAtt = Number(item.attending_count ?? 0);
    const prevInt = Number(item.interested_count ?? 0);

    let nextAtt = prevAtt;
    let nextInt = prevInt;

    if (target === "going") {
      if (prevStatus === "going") nextAtt = Math.max(0, prevAtt - 1);
      else if (prevStatus === "interested") {
        nextAtt = prevAtt + 1;
        nextInt = Math.max(0, prevInt - 1);
      } else nextAtt = prevAtt + 1;
    } else {
      if (prevStatus === "interested") nextInt = Math.max(0, prevInt - 1);
      else if (prevStatus === "going") {
        nextInt = prevInt + 1;
        nextAtt = Math.max(0, prevAtt - 1);
      } else nextInt = prevInt + 1;
    }

    // Optimistic UI update
    onUpdateItem({ 
      my_rsvp_status: nextStatus as any,
      attending_count: nextAtt,
      interested_count: nextInt
    });
    
    try {
      let res;
      if (onRSVPEvent) {
        await onRSVPEvent(eventId, (nextStatus || 'not_going') as any);
        res = { success: true };
      } else {
        res = await rsvpEventDirect({
          eventId,
          userId: currentUser.id,
          newStatus: (nextStatus || "not_going") as any,
          prevStatus,
        });
      }

      // ✅ IMPORTANT: overwrite from backend truth if available
      if (res?.success) {
        const patch: Partial<FeedEventItem> = {};
        if (res.my_status !== undefined) {
          patch.my_rsvp_status = res.my_status;
        }
        if (res.attending_count !== undefined) {
          patch.attending_count = Number(res.attending_count);
        }
        if (res.interested_count !== undefined) {
          patch.interested_count = Number(res.interested_count);
        }
        onUpdateItem(patch);
      }
    } catch (e: any) {
      // rollback counts/status
      onUpdateItem({
        my_rsvp_status: prevStatus as any,
        attending_count: prevAtt,
        interested_count: prevInt,
      });
      setError(e?.message || "Failed to RSVP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const my = item.my_rsvp_status || "";
  const attending = Number(item.attending_count ?? 0);
  const interested = Number(item.interested_count ?? 0);

  // Handle card click to open preview modal
  const handleCardClick = () => {
    if (onEventClick) {
      const eventId = item.event_id || item.id;
      onEventClick(eventId);
    }
  };

  return (
    <div 
      className="w-full cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="bg-[#242526] rounded-xl overflow-hidden border border-[#3E4042]">
        {/* Header */}
        <div className="flex items-center gap-3 p-3" onClick={(e) => e.stopPropagation()}>
          <img
            src={item.profile_image_url || "https://via.placeholder.com/40"}
            className="w-10 h-10 rounded-full object-cover cursor-pointer border border-[#3E4042]"
            alt=""
            onClick={(e) => {
              e.stopPropagation();
              onProfileClick(item.user_id);
            }}
          />
          <div className="min-w-0">
            <div className="text-[#E4E6EB] font-bold truncate">{item.name}</div>
            <div className="text-[#B0B3B8] text-xs">
              {formatRelativeTime(item.created_at)} • created an event
            </div>
          </div>
        </div>

        {/* Cover image */}
        {item.media_url ? (
          <div className="w-full h-56 bg-black overflow-hidden relative">
            <img 
              src={item.media_url} 
              className="w-full h-full object-cover" 
              alt="" 
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const fallback = document.createElement('div');
                  fallback.className = 'w-full h-56 bg-[#1B1C1D] flex items-center justify-center';
                  fallback.innerHTML = '<i class="fas fa-calendar text-[#1877F2] text-4xl opacity-60"></i>';
                  parent.appendChild(fallback);
                }
              }}
            />
            {/* Date Badge */}
            {dateObj && (
              <div className="absolute top-3 left-3 bg-[#242526]/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-[#4E4F50]">
                <div className="text-[#B0B3B8] text-[11px] font-black">
                  {dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                </div>
                <div className="text-[#E4E6EB] text-[20px] font-black leading-tight">
                  {dateObj.getDate()}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-40 bg-[#1B1C1D] flex items-center justify-center relative">
            <i className="fas fa-calendar text-[#1877F2] text-4xl opacity-60"></i>
            {dateObj && (
              <div className="absolute top-3 left-3 bg-[#242526]/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-[#4E4F50]">
                <div className="text-[#B0B3B8] text-[11px] font-black">
                  {dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                </div>
                <div className="text-[#E4E6EB] text-[20px] font-black leading-tight">
                  {dateObj.getDate()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4" onClick={(e) => e.stopPropagation()}>
          <div className="text-[#E4E6EB] font-black text-xl leading-tight">
            {item.content}
          </div>

          {item.event_description ? (
            <div className="text-[#B0B3B8] text-sm mt-2 line-clamp-2">
              {item.event_description}
            </div>
          ) : null}

          <div className="mt-3 space-y-2 text-[#B0B3B8] text-sm">
            {whenText ? (
              <div className="flex items-center gap-2">
                <i className={`fas fa-clock ${isPast ? "text-[#B0B3B8]" : "text-[#1877F2]"} w-5`}></i>
                <span>{whenText}</span>
              </div>
            ) : null}

            {item.location ? (
              <div className="flex items-center gap-2">
                <i className="fas fa-map-marker-alt text-[#F02849] w-5"></i>
                <span className="line-clamp-1">{item.location}</span>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <i className="fas fa-users text-[#45BD62] w-5"></i>
              <span>{attending} attending • {interested} interested</span>
            </div>
          </div>

          {/* Error message if any */}
          {error && (
            <div className="mt-2 text-sm text-red-500 bg-red-500/10 p-2 rounded-lg">
              {error}
            </div>
          )}

          {/* RSVP Buttons - Matches AllEvents.tsx */}
          <div className="mt-4 flex gap-2">
            <button
              disabled={loading || isPast}
              onClick={(e) => {
                e.stopPropagation();
                rsvp("going");
              }}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm disabled:opacity-60 transition-colors ${
                isPast ? "opacity-50 cursor-not-allowed" : ""
              } ${
                my === "going"
                  ? "bg-[#45BD62] text-white hover:bg-[#3da855]"
                  : "bg-[#1877F2] text-white hover:bg-[#166FE5]"
              }`}
            >
              {loading && my === "going" ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                my === "going" ? "✓ Going" : "Going"
              )}
            </button>

            <button
              disabled={loading || isPast}
              onClick={(e) => {
                e.stopPropagation();
                rsvp("interested");
              }}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm disabled:opacity-60 transition-colors ${
                isPast ? "opacity-50 cursor-not-allowed" : ""
              } ${
                my === "interested"
                  ? "bg-[#F7B928] text-black hover:bg-[#e5aa24]"
                  : "bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]"
              }`}
            >
              {loading && my === "interested" ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                my === "interested" ? "✓ Interested" : "Interested"
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Facebook-style separator */}
      <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
    </div>
  );
};

/**
 * =========================
 * ✅ ACTIVE COMMENTS STATE WITH LOCKED SNAPSHOT
 * =========================
 */
// This should be declared in the parent component that uses the Post component
// Example:
// const [activeComments, setActiveComments] = useState<null | { feedKey: string; snapshot: any }>(null);
//
// const openComments = (item: any) => {
//   const feedKey = String(item.feed_key ?? `${item.source}:${item.id}`);
//   const snapshot = typeof structuredClone === "function" 
//     ? structuredClone(item) 
//     : JSON.parse(JSON.stringify(item));
//   setActiveComments({ feedKey, snapshot });
// };

/**
 * =========================
 * ✅ FIXED: POST CARD WITH UNIFIED AVATAR AND PROPER MEDIA HANDLING
 * AND PROFESSIONAL REACTION TEXT FORMATTING
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
  onOpenComments: (id: number) => void; // This now expects just the postId
  onVideoClick: (p: PostType) => void;
  onPlayAudioTrack?: (t: AudioTrack) => void;
  onHashtagClick?: (tag: string) => void;
  onViewProductFromPost?: (productId: number) => void;
  onOpenGroup?: (groupId: number) => void;
  onOpenAudio?: (item: any) => void;
  onRSVP?: (eventId: number, status: 'going' | 'interested' | 'not_going') => Promise<void>;
  groups?: Group[];
  brands?: Brand[];
  chats?: any[];
  isFollowing?: boolean;
  onFollow?: (id: number) => void;
  followLoading?: boolean;
  onEventClick?: (eventId: number) => void;
  onOpenReactions?: (postId: number) => void;
  onEdit?: (postId: number, content: string) => void;
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
  onViewProductFromPost,
  onOpenGroup,
  onOpenAudio,
  onRSVP,
  groups = [],
  brands = [],
  chats = [],
  isFollowing = false,
  onFollow,
  followLoading = false,
  onEventClick,
  onOpenReactions,
  onEdit,
}) => {
  const { onViewProduct, getProductData } = useContext(MarketplaceContext);
  
  const p: any = post as any;
  const a: any = author as any;

  // ========== MARKETPLACE DETECTION ==========
  const meta: any = p?.meta || {};
  
  const isMarketplace =
    p?.type === "marketplace" ||
    p?.post_type === "product" ||
    p?.type === 'product' ||
    p?.kind === 'product' ||
    meta?.type === 'product' ||
    meta?.kind === 'product' ||
    !!p?.product_id ||
    !!p?.meta?.marketplace?.id;

  // ========== EVENT DETECTION ==========
  const isEventPost =
    p?.item_type === "event" ||
    String(p?.feed_key || "").startsWith("event:") ||
    p?.source === "event" ||
    p?.type === 'event' ||
    p?.post_type === 'event' ||
    meta?.type === 'event' ||
    meta?.kind === 'event' ||
    !!p?.event_id ||
    !!meta?.event;

  // If it's an event post, render the EventPost component
  if (isEventPost) {
    const event = normalizeEventFromFeed(p);
    return (
      <EventPost
        event={event}
        author={a}
        currentUser={currentUser}
        users={users}
        onProfileClick={onProfileClick}
        onRSVP={onRSVP}
        onFollow={onFollow}
        isFollowing={isFollowing}
        followLoading={followLoading}
        onReact={onReact}
        onShare={onShare}
        onOpenComments={onOpenComments}
        groups={groups}
        brands={brands}
        chats={chats}
        onEventClick={onEventClick}
      />
    );
  }

  const productId = isMarketplace ? getMarketplaceProductId(p) : null;
  const productData = productId ? getProductData?.(productId) : null;

  const mpImages = isMarketplace ? getMarketplaceImages(p, productData) : [];
  const { price, currency, loc } = isMarketplace ? getMarketplacePriceLine(productData) : { price: null, currency: "TZS", loc: "Marketplace" };

  // Gallery state for multi-image swiping
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Reactions sheet state
  const [showReactionsSheet, setShowReactionsSheet] = useState(false);

  // Music/Podcast detection
  const isMusic = meta?.kind === 'music' || meta?.type === 'music';
  const isPodcast = meta?.kind === 'podcast' || meta?.type === 'podcast';
  const song = meta?.song;
  const podcast = meta?.podcast;

  // Group detection
  const isGroupPost = !!(p?.group_id || p?.group);
  const groupId = Number(p?.group_id || p?.groupId || meta?.group_id || meta?.groupId || 0);
  const groupName = p?.group_name || p?.groupName || meta?.group_name || meta?.groupName || '';
  const group = p?.group || groups?.find(g => g.id === groupId);

  // ========== REACTION DATA WITH FALLBACKS ==========
  const myReaction = p.myReaction ?? p.my_reaction ?? null;

  // Count from various possible fields
  const likesCount = Number(p.likesCount ?? p.reactionsCount ?? p.reactions_count ?? 0);

  // IMPORTANT: never make it null; fallback to preview list if available
  const reactionsArr: any[] = Array.isArray(p.reactions)
    ? p.reactions
    : Array.isArray(p.reactions_preview)
      ? p.reactions_preview
      : [];

  // Optional name provided by backend
  const reactorNameFromApi = String(
    p.reactor_name ?? p.reactorName ?? ""
  ).trim();

  // Final values used in the component
  const finalMyReaction: ReactionType | undefined =
    myReaction ||
    (currentUser && reactionsArr.length
      ? (reactionsArr.find((r: any) => Number(r.user_id) === safeUserId(currentUser))?.type as ReactionType)
      : undefined);

  const finalReactionCount =
    likesCount > 0 ? likesCount : reactionsArr.length;
  
  // ========== COMMENT COUNT STATE ==========
  const [commentCount, setCommentCount] = useState(() => {
    // Try to get from post.comments_count first (API)
    if (typeof p.comments_count === 'number') {
      console.log('📊 Post initial comment count from API:', p.id, p.comments_count);
      return p.comments_count;
    }
    // Fallback to comments array length
    if (Array.isArray(p.comments)) {
      console.log('📊 Post initial comment count from array:', p.id, p.comments.length);
      return p.comments.length;
    }
    console.log('📊 Post initial comment count default 0:', p.id);
    return 0;
  });

  const [shareCount, setShareCount] = useState(() => {
    return safeNumber(p.shares ?? p.shares_count, 0);
  });

  const [showShareSheet, setShowShareSheet] = useState(false);

  const createdAtLabel = formatRelativeTime(p.created_at);
  const postId = safePostId(p);

  const mediaInfo = getMediaTypeInfo(p);

  const mediaList = useMemo(() => {
    return getPostMediaList(p);
  }, [p]);

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  // Facebook-style reaction emojis
  const emojiList = useMemo(() => {
    if (reactionsArr.length > 0) {
      const em = topReactionEmojis(reactionsArr, 2);
      return em.length ? em : ['👍'];
    }
    return finalReactionCount > 0 ? ['👍'] : [];
  }, [reactionsArr, finalReactionCount]);

  // STABLE REACTOR NAME WITH BACKEND FALLBACK
  const reactorName = useMemo(() => {
    if (!finalReactionCount) return "";

    // If we have an array (best), resolve name from it
    if (reactionsArr.length) {
      const name = pickStableReactorName(postId, reactionsArr, users);
      return String(name || "").trim();
    }

    // If no array (common case), use backend-provided name
    return reactorNameFromApi;
  }, [postId, finalReactionCount, reactionsArr, users, reactorNameFromApi]);

  // PROFESSIONAL REACTION TEXT
  const reactionText = useMemo(() => {
    if (!finalReactionCount || !reactorName) return '';
    return formatReactionText(finalReactionCount, reactorName);
  }, [finalReactionCount, reactorName]);

  useEffect(() => {
    const newCommentCount = typeof p.comments_count === 'number' 
      ? p.comments_count 
      : Array.isArray(p.comments) 
        ? p.comments.length 
        : 0;
    
    if (newCommentCount !== commentCount) {
      console.log('📊 Syncing comment count from props:', p.id, newCommentCount);
      setCommentCount(newCommentCount);
    }

    const newShareCount = safeNumber(p.shares ?? p.shares_count, 0);
    if (newShareCount !== shareCount) {
      setShareCount(newShareCount);
    }
  }, [p.comments_count, p.comments, p.shares, p.shares_count]);

  // ========== FETCH UPDATED POST DATA ==========
  const fetchUpdatedPost = useCallback(async () => {
    try {
      const viewerId = currentUser?.id ?? 0;
      const url = `/api/posts/${postId}?viewerId=${viewerId}`;
      console.log('📡 Fetching updated post:', url);
      
      const token = localStorage.getItem('unera_token');
      const headers: HeadersInit = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      };

      const res = await fetch(url, { headers });
      const data = await res.json();
      
      if (data) {
        console.log('📥 Received updated post data:', data);
        
        // Update comment count
        if (typeof data.comments_count === 'number') {
          console.log('📊 Updating comment count from', commentCount, 'to', data.comments_count);
          setCommentCount(data.comments_count);
        }
        
        // Update share count if available
        if (typeof data.shares === 'number') {
          setShareCount(data.shares);
        }
        
        // Update reaction count if needed
        // You could also update other post data here
      }
    } catch (error) {
      console.error('❌ Failed to fetch updated post:', error);
    }
  }, [postId, currentUser?.id, commentCount]);

  const handleShareComplete = (destination: string, data?: any) => {
    const nextShares = safeNumber(data?.shares ?? data?.share_count, NaN);
    
    if (data?.success && Number.isFinite(nextShares)) {
      setShareCount(nextShares);
      onShare(postId, nextShares);
    }
    setShowShareSheet(false);
  };

  const handleFollowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onFollow && a.id) {
      onFollow(safeUserId(a));
    }
  };

  const openGallery = (urls: string[], index: number) => {
    setGalleryUrls(urls);
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  // Split media by type for rendering
  const imageMedia = mediaList.filter(m => m.kind === 'image');
  const videoMedia = mediaList.filter(m => m.kind === 'video');

  // ========== OPEN COMMENTS WITH PROPER EVENT HANDLING ==========
  const handleOpenComments = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation(); // ✅ CRITICAL: never trigger PostCard onClick
    }
    
    if (currentUser) {
      // Just pass the postId to the parent - the parent will handle the locked snapshot
      onOpenComments(postId);
    } else {
      alert('Please login to comment');
    }
  };

  // ========== REGULAR POST RENDERING ==========
  return (
    <>
      {/* Unified post wrapper */}
      <div className="w-full">
        <div className="bg-[#242526] w-full overflow-hidden">
          {/* ===== POST HEADER - Use GroupPostHeader for group posts ===== */}
          {isGroupPost ? (
            <GroupPostHeader
              post={p}
              group={group}
              author={a}
              onOpenGroup={(id) => onOpenGroup?.(id)}
              onOpenProfile={(id) => onProfileClick(id)}
              onOpenMenu={() => console.log('Open menu')}
            />
          ) : (
            <div className="p-3 md:p-4 flex items-center justify-between">
              <div
                className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                onClick={() => onProfileClick(safeUserId(a))}
              >
                <img
                  src={avatarFrom(a)}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover border border-[#3E4042]"
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

              {onFollow && currentUser && safeUserId(a) !== safeUserId(currentUser) && (
                <button
                  onClick={handleFollowClick}
                  disabled={followLoading}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 ml-2 ${
                    isFollowing 
                      ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]' 
                      : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                  } ${followLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {followLoading ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : isFollowing ? (
                    'Following'
                  ) : (
                    'Follow'
                  )}
                </button>
              )}

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
          )}

          {/* ===== MARKETPLACE TOP LINE ===== */}
          {isMarketplace && (
            <div className="px-4 pb-2 flex items-center gap-2 text-[#E4E6EB]">
              <span className="text-[#1877F2] font-semibold text-sm bg-[#1877F2]/10 px-2 py-1 rounded-full">
                Marketplace
              </span>
              {loc && (
                <div className="flex items-center gap-1 text-[#B0B3B8]">
                  <i className="fas fa-map-marker-alt text-[12px] text-[#F02849]"></i>
                  <span className="text-sm">{loc}</span>
                </div>
              )}
            </div>
          )}

          {/* ===== POST CONTENT - Now uses ExpandableRichText with 14 word limit ===== */}
          {p.content && !isMarketplace && (
            <div className="px-3 md:px-4 pb-2">
              <ExpandableRichText
                text={String(p.content)}
                users={users}
                onProfileClick={onProfileClick}
                onHashtagClick={onHashtagClick}
                maxWords={14} // Changed from 25 to 14 words
                fontSizePx={21}
              />
            </div>
          )}

          {/* ===== MUSIC/PODCAST CARD ===== */}
          {(isMusic || isPodcast) && (
            <div className="mx-3 md:mx-4 mb-3 bg-[#18191A] border border-[#3E4042] rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <img
                  src={(isMusic ? song?.cover_image_url : podcast?.cover_image_url) || ''}
                  className="w-14 h-14 rounded-xl object-cover bg-[#242526]"
                  alt=""
                />
                <div className="flex-1 overflow-hidden">
                  <div className="text-white font-bold truncate">
                    {(isMusic ? song?.title : podcast?.title) || 'Untitled'}
                  </div>
                  <div className="text-[#B0B3B8] text-xs truncate">
                    {isMusic ? song?.artist_name : podcast?.description}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAudio?.(isMusic ? song : podcast);
                  }}
                  className="bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold px-4 py-2 rounded-xl"
                >
                  Play
                </button>
              </div>
            </div>
          )}

          {/* ===== LINK PREVIEW ===== */}
          {p.link_preview && !mediaInfo.mediaUrl && !isMarketplace && (
            <div
              className="mx-3 md:mx-4 mb-2 bg-[#242526] border border-[#3E4042] overflow-hidden cursor-pointer hover:bg-[#3A3B3C] transition-colors rounded-lg"
              onClick={() => window.open(p.link_preview.url, '_blank', 'noopener noreferrer')}
            >
              {p.link_preview.image && (
                <div className="w-full h-48 bg-[#3A3B3C] overflow-hidden">
                  <img
                    src={p.link_preview.image}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="p-4 bg-[#3A3B3C]">
                <div className="text-[#B0B3B8] text-xs uppercase font-bold mb-1">
                  {p.link_preview.domain}
                </div>
                <div className="text-[#E4E6EB] font-bold text-[17px] mb-1 line-clamp-2">
                  {p.link_preview.title}
                </div>
                <div className="text-[#B0B3B8] text-[14px] line-clamp-3">
                  {p.link_preview.description}
                </div>
              </div>
            </div>
          )}

          {/* ===== BACKGROUND POST ===== */}
          {p.background && !mediaInfo.mediaUrl && !isMarketplace && (
            <div
              className="h-[300px] flex items-center justify-center p-8 text-center text-white font-bold text-2xl"
              style={{ background: p.background, backgroundSize: 'cover' }}
            >
              {p.content}
            </div>
          )}

          {/* ===== MEDIA RENDERING ===== */}
          {isMarketplace ? (
            mpImages.length > 0 ? (
              <div className="w-full">
                <div className="w-full bg-black">
                  <MediaGrid
                    media={mpImages.map(url => ({ url }))}
                    onOpen={(url, index) => {
                      openGallery(mpImages, index);
                    }}
                  />
                </div>
              </div>
            ) : null
          ) : (
            <>
              {/* Images Grid */}
              {!p.background && imageMedia.length > 0 && (
                <MediaGrid
                  media={imageMedia.map((m) => ({ url: m.url }))}
                  onOpen={(url, index) => {
                    const urls = imageMedia.map((m) => m.url);
                    openGallery(urls, index);
                  }}
                />
              )}

              {/* Video */}
              {!p.background && videoMedia.length > 0 && (
                <div
                  className="cursor-pointer relative h-[500px] bg-black"
                  onClick={() => onVideoClick(post)}
                >
                  <video
                    src={videoMedia[0].url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                    playsInline
                    muted
                    onError={(e) => {
                      console.error('Failed to load video:', videoMedia[0].url);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-play text-white text-4xl opacity-50"></i>
                  </div>
                </div>
              )}
              
              {/* Audio */}
              {!p.background && mediaInfo.mediaUrl && mediaInfo.isAudio && onPlayAudioTrack && (
                <div className="my-3">
                  {(() => {
                    const cover =
                      (p as any).song_cover_image_url ||
                      (imageMedia?.[0]?.url) ||
                      a.profile_image_url;

                    const titleText = p.content || 'Audio';
                    const artistText =
                      (p as any).song_artist_name || a.name || 'Unknown';

                    return (
                      <div className="rounded-lg overflow-hidden border border-[#3E4042] bg-[#3A3B3C]">
                        {cover ? (
                          <div className="relative">
                            <img
                              src={cover}
                              alt="Cover"
                              className="w-full h-[260px] md:h-[320px] object-cover"
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                if (a.profile_image_url && img.src !== a.profile_image_url) {
                                  img.src = a.profile_image_url;
                                }
                              }}
                            />

                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                            <div className="absolute left-3 right-3 bottom-3">
                              <div className="p-3 rounded-lg bg-[#2F3031]/90 border border-[#3E4042] backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#2F3031] flex-shrink-0">
                                    <img
                                      src={cover}
                                      alt="Mini cover"
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="text-[#E4E6EB] font-bold">Audio Track</div>
                                    <div className="text-[#B0B3B8] text-sm truncate">
                                      {titleText}
                                    </div>
                                    <div className="text-[#B0B3B8] text-xs truncate">
                                      {artistText}
                                    </div>
                                  </div>

                                  <button
                                    onClick={() =>
                                      onPlayAudioTrack!({
                                        id: postId,
                                        title: titleText,
                                        artist: artistText,
                                        url: mediaInfo.mediaUrl,
                                        duration: 0,
                                        coverImage: cover || a.profile_image_url,
                                      })
                                    }
                                    className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors flex-shrink-0"
                                  >
                                    <i className="fas fa-play mr-1"></i> Play
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-[#3A3B3C]">
                            <div className="flex items-center gap-3">
                              <i className="fas fa-music text-[#1877F2] text-2xl"></i>
                              <div className="flex-1">
                                <div className="text-[#E4E6EB] font-bold">Audio Track</div>
                                <div className="text-[#B0B3B8] text-sm">
                                  {p.content || 'Listen to audio'}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  onPlayAudioTrack!({
                                    id: postId,
                                    title: titleText,
                                    artist: artistText,
                                    url: mediaInfo.mediaUrl,
                                    duration: 0,
                                    coverImage: a.profile_image_url,
                                  })
                                }
                                className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                              >
                                <i className="fas fa-play mr-1"></i> Play
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {/* ===== MARKETPLACE PRICE AND BUTTON FOOTER ===== */}
          {isMarketplace && price && (
            <div className="px-4 py-2 flex items-center justify-between border-t border-[#3E4042] mt-1">
              <div className="flex items-center gap-1">
                <span className="text-[#E4E6EB] text-lg font-bold">{currency}</span>
                <span className="text-[#E4E6EB] text-xl font-bold">{price}</span>
              </div>

              <button
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-1.5 rounded-full font-semibold text-sm transition-colors shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (productId) onViewProduct?.(productId);
                }}
              >
                View product
              </button>
            </div>
          )}

          {/* ===== PROFESSIONAL REACTION SUMMARY WITH FORMATTED TEXT ===== */}
          <div className="px-3 md:px-4 py-2.5 flex items-center justify-between text-[#B0B3B8] text-[14px] border-t border-[#3E4042]">
            <div className="flex items-center gap-2">
              {finalReactionCount > 0 && (
                <div
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenReactions) {
                      onOpenReactions(postId);
                    } else {
                      setShowReactionsSheet(true);
                    }
                  }}
                >
                  {/* Reaction emojis - shows top 2 emojis stacked */}
                  <div className="flex -space-x-2">
                    {emojiList.slice(0, 2).map((e, i) => (
                      <span
                        key={i}
                        className="w-[22px] h-[22px] rounded-full bg-[#3A3B3C] border border-[#242526] flex items-center justify-center text-[14px]"
                        style={{ zIndex: 10 - i }}
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                  
                  {/* PROFESSIONAL REACTION TEXT - e.g., "5 · Jastin Beda and 4 others" */}
                  {reactionText && (
                    <span className="text-[15px] text-[#E4E6EB] font-medium">
                      {reactionText}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Comments and Shares counts - CHANGED TEXT ONLY */}
            <div className="flex gap-4">
              <span
                className="hover:underline cursor-pointer"
                onClick={() => handleOpenComments()}
              >
                {formatCount(commentCount)} Discussions  {/* ✅ CHANGED from "Comments" to "Discussions" */}
              </span>
              {shareCount > 0 && (
                <span className="hover:underline">
                  {formatCount(shareCount)} Shares
                </span>
              )}
            </div>
          </div>

          {/* ===== ACTION BUTTONS ===== */}
          <div className="px-2 py-1 border-t border-white/10 flex items-center justify-between">
            <ReactionButton
              currentUserReactions={finalMyReaction}
              reactionCount={finalReactionCount}
              onReact={(type) => onReact(postId, type)}
              isGuest={!currentUser}
            />
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation(); // ✅ CRITICAL: never trigger PostCard onClick
                handleOpenComments(e);
              }}
            >
              <DiscussSignalIcon size={26} color="#1877F2" />
              <span className="text-[17px] font-medium text-[#B0B3B8] group-hover:text-[#E4E6EB]">
                Discuss
              </span>
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

        {/* Facebook-like separator band */}
        <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
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

      {/* Reactions Sheet */}
      <ReactionsSheet
        isOpen={showReactionsSheet}
        onClose={() => setShowReactionsSheet(false)}
        postId={postId}
        onProfileClick={onProfileClick}
        onOpenComments={onOpenComments}
      />

      {/* Gallery Viewer for multi-image swiping - WITH ACTIONS AND REACTIONS SHEET SUPPORT */}
      <GalleryViewer
        isOpen={galleryOpen}
        urls={galleryUrls}
        startIndex={galleryIndex}
        onClose={() => setGalleryOpen(false)}
        postId={postId}
        currentUser={currentUser}
        reactionCount={finalReactionCount}
        commentCount={commentCount}
        shareCount={shareCount}
        myReaction={finalMyReaction}
        onReact={(type) => onReact(postId, type)}
        onOpenComments={() => handleOpenComments()}
        onShare={() => setShowShareSheet(true)}
        onOpenReactions={() => {
          if (onOpenReactions) {
            onOpenReactions(postId);
          } else {
            setShowReactionsSheet(true);
          }
        }}
      />
    </>
  );
};

// Helper function for safeArrayHelper
const safeArrayHelper = <T,>(arr: any): T[] => {
  if (Array.isArray(arr)) return arr;
  return [];
};

/**
 * =========================
 * CREATE POST CARD - WITH CREATE EVENT BUTTON
 * =========================
 */
export const CreatePost: React.FC<{
  currentUser: User;
  onProfileClick: (id: number) => void;
  onClick: () => void;
  onCreateEventClick: () => void;
}> = ({ currentUser, onProfileClick, onClick, onCreateEventClick }) => (
  <div className="w-full">
    <div className="bg-[#242526] w-full p-3 md:p-4">
      <div className="flex gap-2 mb-3">
        <img
          src={avatarFrom(currentUser)}
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
          <i className="fas fa-calendar-alt text-[#F7B928] text-[22px]"></i>
          <span className="text-[#B0B3B8] font-semibold text-[15px] hidden sm:block">Create Event</span>
        </div>
      </div>
    </div>
    
    <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
  </div>
);

/**
 * =========================
 * ✅ UPDATED: CREATE POST MODAL WITH ENHANCED LINK PREVIEW
 * =========================
 */
export const CreatePostModal: React.FC<{
  currentUser: User;
  users: User[];
  onClose: () => void;
  onCreatePost: (
    text: string,
    files: File[],
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
}> = ({ currentUser, users, onClose, onCreatePost, onCreateEventClick }) => {
  const [view, setView] = useState<'main' | 'tag' | 'feeling' | 'location'>('main');
  const [text, setText] = useState('');
  
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [type, setType] = useState<'text' | 'image' | 'video'>('text');

  const [visibility] = useState<'Public' | 'Friends'>('Public');
  const [activeBackground, setActiveBackground] = useState('');
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);

  const [taggedUsers, setTaggedUsers] = useState<number[]>([]);
  const [feeling, setFeeling] = useState('');
  const [location, setLocation] = useState('');

  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState<any[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const searchTimeout = useRef<any>(null);
  const previewTimeout = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (previewTimeout.current) {
      clearTimeout(previewTimeout.current);
    }

    if (files.length > 0 || activeBackground) {
      setLinkPreview(null);
      return;
    }

    previewTimeout.current = setTimeout(async () => {
      setIsFetchingPreview(true);
      try {
        const preview = await getLinkPreview(text);
        setLinkPreview(preview);
      } catch (error) {
        console.debug('Failed to fetch link preview');
        setLinkPreview(null);
      } finally {
        setIsFetchingPreview(false);
      }
    }, 800);

    return () => {
      if (previewTimeout.current) {
        clearTimeout(previewTimeout.current);
      }
    };
  }, [text, files, activeBackground]);

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p));
    };
  }, [previews]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    if (list.length === 0) return;

    const images = list.filter((f) => f.type.startsWith('image/'));
    const videos = list.filter((f) => f.type.startsWith('video/'));

    if (videos.length > 0) {
      const v = videos[0];
      setFiles([v]);
      setPreviews([URL.createObjectURL(v)]);
      setType('video');
    } else {
      setFiles(images.slice(0, 9));
      setPreviews(images.slice(0, 9).map((f) => URL.createObjectURL(f)));
      setType('image');
    }

    setActiveBackground('');
    setLinkPreview(null);
    setView('main');

    if (e.target) {
      e.target.value = '';
    }
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

  const canPost = !!text.trim() || files.length > 0 || !!activeBackground;

  const submit = () => {
    if (!canPost) return;

    onCreatePost(text, files, {
      type: files.length ? type : 'text',
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
                    src={avatarFrom(u)}
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
              src={avatarFrom(currentUser)}
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

          {isFetchingPreview && (
            <div className="mb-4 p-4 bg-[#242526] border border-[#3E4042] rounded-lg flex items-center justify-center">
              <i className="fas fa-spinner fa-spin text-[#1877F2] mr-2"></i>
              <span className="text-[#B0B3B8]">Loading link preview...</span>
            </div>
          )}

          {linkPreview && files.length === 0 && !activeBackground && (
            <div
              className="mb-4 bg-[#242526] border border-[#3E4042] rounded-lg overflow-hidden cursor-pointer hover:bg-[#3A3B3C] transition-colors"
              onClick={() => window.open(linkPreview.url, '_blank', 'noopener noreferrer')}
            >
              {linkPreview.image && (
                <img src={linkPreview.image} alt="Preview" className="w-full h-48 object-cover" />
              )}
              <div className="p-3 bg-[#3A3B3C]">
                <div className="text-[#B0B3B8] text-xs uppercase font-bold mb-1">{linkPreview.domain}</div>
                <div className="text-[#E4E6EB] font-bold text-[17px] mb-1 line-clamp-1">{linkPreview.title}</div>
                <div className="text-[#B0B3B8] text-[14px] line-clamp-2">{linkPreview.description}</div>
              </div>
            </div>
          )}

          {previews.length > 0 && (
            <div className="relative rounded-lg overflow-hidden border border-[#3E4042] mb-4">
              <div
                onClick={() => {
                  setFiles([]);
                  setPreviews([]);
                  setType('text');
                }}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center cursor-pointer hover:bg-black/80 z-10"
              >
                <i className="fas fa-times text-white"></i>
              </div>

              {type === 'video' ? (
                <video src={previews[0]} controls className="w-full h-auto max-h-[400px] bg-black" />
              ) : (
                <div className={`grid ${previews.length === 1 ? 'grid-cols-1' : 'grid-cols-3'} gap-1 bg-black`}>
                  {previews.slice(0, 9).map((src, i) => (
                    <img 
                      key={i} 
                      src={src} 
                      className={`${previews.length === 1 ? 'w-full h-auto max-h-[400px] object-contain' : 'w-full h-28 object-cover'}`} 
                      alt="" 
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {previews.length === 0 && (
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
        </div>

        <div className="border-t border-[#3E4042]">
          <OptionsItem icon="fas fa-images" color="#45BD62" label="Photo/video" onClick={() => fileInputRef.current?.click()} />
          <OptionsItem icon="fas fa-camera" color="#45BD62" label="Camera" onClick={() => cameraInputRef.current?.click()} />
          <OptionsItem icon="fas fa-user-tag" color="#1877F2" label="Tag people" onClick={() => setView('tag')} />
          <OptionsItem icon="far fa-smile" color="#F7B928" label="Feeling/activity" onClick={() => setView('feeling')} />
          <OptionsItem icon="fas fa-map-marker-alt" color="#F02849" label="Check in" onClick={() => setView('location')} />
          {/* Create Event option in modal footer */}
          <div
            className="flex items-center gap-3 p-3 hover:bg-[#3A3B3C] active:bg-[#3A3B3C] cursor-pointer transition-colors border-t border-[#3E4042]/50 mt-2"
            onClick={() => {
              onClose();
              if (onCreateEventClick) onCreateEventClick();
            }}
          >
            <i className="fas fa-calendar-alt text-[24px] w-8 text-center" style={{ color: '#F7B928' }}></i>
            <span className="text-[#E4E6EB] text-[17px] font-medium">Create Event</span>
          </div>
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

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,video/*" 
        multiple
        onChange={handleFileChange} 
      />
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
 * ✅ UPDATED: FULL POST VIEW WITH THREADED COMMENTS
 * ✅ SHOW ONLY 1 REPLY WHEN COLLAPSED + "VIEW PREVIOUS X REPLIES" BUTTON
 * ✅ AUTO-SCROLL TO DISCUSSIONS + KEYBOARD HIDDEN UNTIL TAP
 * =========================
 */
export const CommentsSheet: React.FC<{
  post: PostType;
  currentUser: User;
  users: User[];
  onClose: () => void;
  onComment?: (postId: number, text: string) => void;
  onCommentAdded?: () => void;
  onLikeComment?: (commentId: number) => void;
  getCommentAuthor?: (id: number) => User | undefined;
  onProfileClick: (id: number) => void;
  onHashtagClick?: (tag: string) => void;
  onFollow?: (id: number) => void;
  checkIsFollowing?: (id: number) => boolean;
  onViewProductFromPost?: (productId: number) => void;
  onOpenAudio?: (item: any) => void;
}> = ({ 
  post, 
  currentUser, 
  users, 
  onClose, 
  onComment, 
  onCommentAdded,
  onLikeComment, 
  getCommentAuthor, 
  onProfileClick, 
  onHashtagClick,
  onFollow,
  checkIsFollowing,
  onViewProductFromPost,
  onOpenAudio
}) => {
  const { onViewProduct, getProductData } = useContext(MarketplaceContext);
  
  const p: any = post as any;
  const postId = safePostId(p);
  
  // ========== REFS ==========
  const discussionsTopRef = useRef<HTMLDivElement>(null); // ✅ Anchor for scrolling to discussions
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // ========== STATE ==========
  const [text, setText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});

  // ========== AUTO-SCROLL TO DISCUSSIONS ON MOUNT ==========
  useEffect(() => {
    // ✅ When opening CommentsSheet from "Discuss", jump directly to the discussions list
    // without focusing the input (so keyboard stays hidden).
    const t = setTimeout(() => {
      discussionsTopRef.current?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    }, 0);

    return () => clearTimeout(t);
  }, [postId]);

  // ========== MARKETPLACE DETECTION ==========
  const meta: any = p?.meta || {};
  
  const isMarketplace =
    p?.type === "marketplace" ||
    p?.post_type === "product" ||
    p?.type === 'product' ||
    p?.kind === 'product' ||
    meta?.type === 'product' ||
    meta?.kind === 'product' ||
    !!p?.product_id ||
    !!p?.meta?.marketplace?.id;

  const productId = isMarketplace ? getMarketplaceProductId(p) : null;
  const productData = productId ? getProductData?.(productId) : null;

  const mpImages = isMarketplace ? getMarketplaceImages(p, productData) : [];
  const { price, currency, loc } = isMarketplace ? getMarketplacePriceLine(productData) : { price: null, currency: "TZS", loc: "Marketplace" };

  // Music/Podcast detection
  const isMusic = meta?.kind === 'music' || meta?.type === 'music';
  const isPodcast = meta?.kind === 'podcast' || meta?.type === 'podcast';
  const song = meta?.song;
  const podcast = meta?.podcast;

  const mediaInfo = getMediaTypeInfo(p);
  const mediaList = useMemo(() => getPostMediaList(p), [p]);
  const imageMedia = mediaList.filter(m => m.kind === 'image');
  const videoMedia = mediaList.filter(m => m.kind === 'video');

  const textPreview = getPostTextPreview(p, 140);
  
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

    const image = avatarFrom({
      profile_image_url: c?.author_image ?? c?.authorImage ?? u?.profile_image_url,
      name,
      username: u?.username ?? c?.author_username ?? c?.username,
    });

    return { uid, name, image };
  };

  const getReplyLabel = (comment: any) => {
    const a = resolveAuthor(comment);
    const uid = a.uid;
    
    const user = users.find((x: any) => Number(x?.id) === uid);
    const username = String(
      comment?.author_username ?? 
      user?.username ?? 
      comment?.username ?? 
      ''
    ).trim();
    
    const display = username ? `@${username}` : a.name;
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
      await apiFetch(`/api/comments/${comment.id}/like`, {
        method: 'POST',
        body: JSON.stringify({ user_id: safeUserId(currentUser) }),
      });
    } catch (error) {
      console.error('Failed to like comment:', error);
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

  const handleFollowClick = (e: React.MouseEvent, userId: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (onFollow && userId && userId !== safeUserId(currentUser)) {
      onFollow(userId);
    }
  };

  const fetchCommentsSilently = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      const viewerId = safeUserId(currentUser);
      const data = await apiFetch(`/api/posts/${postId}/comments?viewerId=${viewerId}`);
      const arr = Array.isArray(data) ? data : data?.comments || [];
      
      if (arr.length > 0) {
        setComments(arr);
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

  useEffect(() => {
    const initializeComments = async () => {
      const cached = commentsCache.get(postId);
      if (cached) {
        setComments(cached.data);
      }
      
      const postComments = Array.isArray(p.comments) ? p.comments : [];
      if (postComments.length > 0 && (!cached || postComments.length > cached.data.length)) {
        setComments(postComments);
        commentsCache.set(postId, { 
          data: postComments, 
          timestamp: Date.now(),
          postId 
        });
      }
      
      fetchCommentsSilently();
    };

    initializeComments();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [postId, p.comments]);

  const idKey = (v: any) => String(v ?? '').trim();

  /**
   * =========================
   * ✅ Build comment threads (root + replies)
   * =========================
   */
  const buildThreads = (list: any[]) => {
    const roots = list.filter(c => !c.parent_comment_id);
    
    const repliesByParent = new Map<string, any[]>();
    
    list.forEach(c => {
      const pid = idKey(c.parent_comment_id);
      if (!pid) return;
      
      if (!repliesByParent.has(pid)) repliesByParent.set(pid, []);
      repliesByParent.get(pid)!.push(c);
    });
    
    // Sort replies oldest first
    repliesByParent.forEach(arr => {
      arr.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    });
    
    return roots.map(root => ({
      root,
      replies: repliesByParent.get(idKey(root.id)) || [],
    }));
  };

  const toggleThread = (rootId: any, open: boolean) => {
    const key = String(rootId);
    setExpandedThreads(prev => ({ ...prev, [key]: open }));
  };

  const threads = useMemo(() => buildThreads(comments), [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;

    const replyDisplay = replyTo?._reply_author?.display;
    const prefix = replyDisplay ? `${replyDisplay} ` : '';
    const finalText = replyTo && !t.startsWith(prefix) ? prefix + t : t;

    const optimisticComment = {
      id: `tmp-${Date.now()}`,
      post_id: postId,
      user_id: safeUserId(currentUser),
      text: finalText,
      parent_comment_id: replyTo?.id || null,
      created_at: new Date().toISOString(),
      replies_count: 0,
      likes_count: 0,
      liked_by_me: false,
    };

    setText('');
    setReplyTo(null);
    setShowEmojiPicker(false);

    setComments(prev => {
      const next = [...prev, optimisticComment];
      const allComments = commentsCache.get(postId)?.data || [];
      commentsCache.set(postId, { 
        data: [...allComments, optimisticComment], 
        timestamp: Date.now(),
        postId 
      });
      return next;
    });

    if (onComment) {
      onComment(postId, finalText);
    }

    try {
      await apiFetch(`/api/posts/${postId}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          text: finalText,
          user_id: safeUserId(currentUser),
          parent_comment_id: replyTo?.id || null,
        }),
      });

      // 👇 CRITICAL: Call onCommentAdded to refresh the post in the feed
      if (onCommentAdded) {
        console.log('🔄 Calling onCommentAdded to refresh post:', postId);
        onCommentAdded();
      }

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

  const postAuthor = p.author || {
    name: p.name,
    username: p.username,
    profile_image_url: p.profile_image_url,
    id: p.user_id || p.author_id
  };

  /**
   * =========================
   * ✅ Render one comment (used for both root and replies)
   * =========================
   */
  const renderOneComment = (comment: any, isReply: boolean = false) => {
    const a = resolveAuthor(comment);
    const isCurrentUserComment = a.uid === safeUserId(currentUser);
    const isFollowing = checkIsFollowing ? checkIsFollowing(a.uid) : false;
    
    return (
      <div className={`flex gap-3 ${isReply ? 'mt-3' : ''}`}>
        <img
          src={a.image}
          className="w-9 h-9 rounded-full object-cover cursor-pointer flex-shrink-0"
          alt=""
          onClick={() => a.uid && onProfileClick(a.uid)}
        />
        
        <div className="flex-1 min-w-0">
          <div className="mb-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[#E4E6EB] font-bold text-[15px] cursor-pointer hover:underline"
                  onClick={() => a.uid && onProfileClick(a.uid)}
                >
                  {a.name}
                </span>
                <span className="text-[#B0B3B8] text-[12px]">
                  • {formatRelativeTime(comment.created_at || comment.createdAt || comment.timestamp)}
                </span>
              </div>
              
              {onFollow && currentUser && a.uid && !isCurrentUserComment && (
                <button
                  onClick={(e) => handleFollowClick(e, a.uid)}
                  className={`px-2 py-0.5 text-xs font-semibold rounded-lg transition-all duration-200 ml-2 ${
                    isFollowing 
                      ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]' 
                      : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          </div>
          
          <div className="text-[#E4E6EB] text-[18px] font-bold whitespace-pre-wrap break-words mb-2">
            <RichText
              text={String(comment.text || '')}
              users={users}
              onProfileClick={onProfileClick}
              onHashtagClick={onHashtagClick}
            />
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleLikeComment(comment)}
              className={`text-[13px] ${comment.liked_by_me ? 'text-[#1877F2] font-semibold' : 'text-[#B0B3B8] hover:text-[#E4E6EB]'}`}
            >
              {comment.liked_by_me ? 'Liked' : 'Like'}
            </button>
            <button
              onClick={() => {
                const target = getReplyLabel(comment);
                setReplyTo({
                  ...comment,
                  _reply_author: target,
                });
                inputRef.current?.focus();
                setShowEmojiPicker(false);
              }}
              className="text-[13px] text-[#B0B3B8] hover:text-[#E4E6EB]"
            >
              Reply
            </button>
            {comment.likes_count > 0 && (
              <span className="text-[13px] text-[#B0B3B8]">
                {formatCount(comment.likes_count)} like{comment.likes_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[500] bg-[#18191A] flex flex-col">
      <div className="p-4 border-b border-[#3E4042] flex items-center justify-between bg-[#242526] sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="w-10 h-10 rounded-full hover:bg-[#3A3B3C] flex items-center justify-center transition-colors"
            onClick={onClose}
            aria-label="Back"
          >
            <i className="fas fa-arrow-left text-[#E4E6EB] text-xl"></i>
          </button>
          <div className="text-[#E4E6EB] font-bold text-[20px]">Post</div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-[#B0B3B8] text-[14px]">
            {formatCount(comments.length)} discussions  {/* ✅ CHANGED from "comments" to "discussions" */}
          </div>
          <button
            type="button"
            className="text-[#1877F2] font-bold text-[15px] hover:underline"
            onClick={onClose}
          >
            See less
          </button>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scroll-smooth"
      >
        <div className="p-4 border-b border-[#3E4042]">
          <div className="flex items-center gap-3 mb-4">
            <img
              src={avatarFrom(postAuthor)}
              className="w-12 h-12 rounded-full object-cover border border-[#3E4042] cursor-pointer"
              alt=""
              onClick={() => postAuthor?.id && onProfileClick(postAuthor.id)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[#E4E6EB] font-bold text-[17px] truncate cursor-pointer hover:underline"
                    onClick={() => postAuthor?.id && onProfileClick(postAuthor.id)}>
                    {postAuthor?.name || postAuthor?.username || 'User'}
                  </div>
                  <div className="text-[#B0B3B8] text-[13px] flex items-center gap-2">
                    <span>{formatRelativeTime(p.created_at)}</span>
                    <span>•</span>
                    <i className="fas fa-globe-americas text-[12px]"></i>
                  </div>
                </div>
                
                {onFollow && currentUser && postAuthor?.id && safeUserId(postAuthor) !== safeUserId(currentUser) && (
                  <button
                    onClick={(e) => handleFollowClick(e, safeUserId(postAuthor))}
                    className={`px-3 py-1 text-sm font-semibold rounded-lg transition-all duration-200 ${
                      checkIsFollowing && checkIsFollowing(safeUserId(postAuthor))
                        ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]' 
                        : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                    }`}
                  >
                    {checkIsFollowing && checkIsFollowing(safeUserId(postAuthor)) ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ===== TEXT PREVIEW ===== */}
          {!p.background && textPreview && (
            <div className="mb-4">
              <ExpandableRichText
                text={String(p.content)}
                users={users}
                onProfileClick={onProfileClick}
                onHashtagClick={onHashtagClick}
                fontSizePx={21}
                forceExpanded={true}
              />
            </div>
          )}

          {/* ===== BACKGROUND POST TEXT ===== */}
          {p.background && textPreview && (
            <div
              className="mb-4 -mx-4 h-[320px] flex items-center justify-center p-8 text-center text-white font-bold text-2xl"
              style={{ background: p.background, backgroundSize: 'cover' }}
            >
              {textPreview}
            </div>
          )}

          {/* ===== MARKETPLACE MEDIA IN COMMENTS SHEET ===== */}
          {isMarketplace && mpImages.length > 0 && (
            <div className="mb-4 -mx-4">
              <div className="w-full bg-black">
                <MediaGrid
                  media={mpImages.map(url => ({ url }))}
                  onOpen={(url, index) => {
                    console.log('Open marketplace image:', url, index);
                  }}
                />
              </div>
            </div>
          )}

          {isMarketplace && price && (
            <div className="mb-4 px-4 py-2 flex items-center justify-between bg-[#242526] border border-[#3E4042] rounded-lg">
              <div className="flex items-center gap-1">
                <span className="text-[#E4E6EB] text-lg font-bold">{currency}</span>
                <span className="text-[#E4E6EB] text-xl font-bold">{price}</span>
              </div>

              <button
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-1.5 rounded-full font-semibold text-sm transition-colors shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (productId && onViewProductFromPost) onViewProductFromPost(productId);
                  else if (productId) onViewProduct?.(productId);
                }}
              >
                View product
              </button>
            </div>
          )}

          {/* ===== MUSIC/PODCAST IN COMMENTS SHEET ===== */}
          {(isMusic || isPodcast) && (
            <div className="mb-4 bg-[#18191A] border border-[#3E4042] rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <img
                  src={(isMusic ? song?.cover_image_url : podcast?.cover_image_url) || ''}
                  className="w-14 h-14 rounded-xl object-cover bg-[#242526]"
                  alt=""
                />
                <div className="flex-1 overflow-hidden">
                  <div className="text-white font-bold truncate">
                    {(isMusic ? song?.title : podcast?.title) || 'Untitled'}
                  </div>
                  <div className="text-[#B0B3B8] text-xs truncate">
                    {isMusic ? song?.artist_name : podcast?.description}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAudio?.(isMusic ? song : podcast);
                  }}
                  className="bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold px-4 py-2 rounded-xl"
                >
                  Play
                </button>
              </div>
            </div>
          )}

          {/* ===== LINK PREVIEW IN COMMENTS SHEET ===== */}
          {p.link_preview && !mediaInfo.mediaUrl && !isMarketplace && (
            <div
              className="mb-4 bg-[#242526] border border-[#3E4042] overflow-hidden cursor-pointer hover:bg-[#3A3B3C] transition-colors rounded-lg"
              onClick={() => window.open(p.link_preview.url, '_blank', 'noopener noreferrer')}
            >
              {p.link_preview.image && (
                <div className="w-full h-48 bg-[#3A3B3C] overflow-hidden">
                  <img
                    src={p.link_preview.image}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="p-4 bg-[#3A3B3C]">
                <div className="text-[#B0B3B8] text-xs uppercase font-bold mb-1">
                  {p.link_preview.domain}
                </div>
                <div className="text-[#E4E6EB] font-bold text-[17px] mb-1 line-clamp-2">
                  {p.link_preview.title}
                </div>
                <div className="text-[#B0B3B8] text-[14px] line-clamp-3">
                  {p.link_preview.description}
                </div>
              </div>
            </div>
          )}

          {/* ===== IMAGES IN COMMENTS SHEET ===== */}
          {!isMarketplace && imageMedia.length > 0 && (
            <div className="mb-4 -mx-4">
              {imageMedia.length > 1 ? (
                <MediaGrid
                  media={imageMedia.map(m => ({ url: m.url }))}
                  onOpen={(url, index) => {
                    console.log('Open image:', url, index);
                  }}
                />
              ) : (
                <div className="w-full bg-black">
                  <img
                    src={imageMedia[0].url}
                    alt=""
                    className="w-full h-auto max-h-[70vh] object-contain"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          )}

          {/* ===== VIDEO IN COMMENTS SHEET ===== */}
          {!isMarketplace && videoMedia.length > 0 && (
            <div className="mb-4 -mx-4 w-full bg-black">
              <video
                src={videoMedia[0].url}
                controls
                playsInline
                className="w-full h-auto max-h-[70vh] object-contain bg-black"
              />
            </div>
          )}

          {/* ===== AUDIO IN COMMENTS SHEET ===== */}
          {!isMarketplace && mediaInfo.mediaUrl && mediaInfo.isAudio && (
            <div className="mb-4 p-4 bg-[#242526] border border-[#3E4042] rounded-xl">
              <div className="text-[#E4E6EB] font-bold mb-3">Audio Track</div>
              <audio controls className="w-full">
                <source src={mediaInfo.mediaUrl} />
              </audio>
            </div>
          )}

          <div className="flex items-center justify-between text-[#B0B3B8] text-[14px] pt-3 border-t border-[#3E4042]">
            <div className="flex items-center gap-2">
              {!!p.reactions_count && <span>{formatCount(Number(p.reactions_count))} reactions</span>}
            </div>
            <div className="flex items-center gap-4">
              <span>{formatCount(comments.length)} discussions</span>  {/* ✅ CHANGED from "comments" to "discussions" */}
              {!!p.shares && <span>{formatCount(Number(p.shares))} shares</span>}
            </div>
          </div>
        </div>

        <div className="p-4">
          {/* ✅ Jump target: opening from Discuss lands here, not the post description */}
          <div ref={discussionsTopRef} />

          {replyTo && (
            <div className="mb-4 p-3 bg-[#3A3B3C] rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[#B0B3B8] text-sm">Replying to</span>
                <span className="text-[#1877F2] font-medium">
                  {replyTo?._reply_author?.display || replyTo?._reply_author?.name || 'User'}
                </span>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="text-[#B0B3B8] hover:text-[#E4E6EB] text-lg"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          )}

          {showEmojiPicker && (
            <div className="mb-4 p-3 border border-[#3E4042] rounded-lg">
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

          {comments.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-[#B0B3B8] text-lg mb-2">No discussions yet</div>  {/* ✅ CHANGED from "No comments yet" */}
              <p className="text-[#B0B3B8] text-sm">Be the first to start a discussion!</p>  {/* ✅ CHANGED message */}
            </div>
          ) : (
            <div className="space-y-6">
              {threads.map(({ root, replies }) => {
                const rootId = String(root.id);
                const isExpanded = !!expandedThreads[rootId];
                const MAX_PREVIEW = 1;
                const hiddenCount = Math.max(0, replies.length - MAX_PREVIEW);
                const visibleReplies = isExpanded ? replies : replies.slice(-MAX_PREVIEW);

                return (
                  <div key={rootId} className="space-y-2">
                    {/* Root comment */}
                    {renderOneComment(root, false)}

                    {/* "View previous X replies" button */}
                    {!isExpanded && hiddenCount > 0 && (
                      <button
                        type="button"
                        className="ml-12 text-[#1877F2] font-bold text-[14px] hover:underline"
                        onClick={() => toggleThread(rootId, true)}
                      >
                        View previous {hiddenCount} repl{hiddenCount === 1 ? "y" : "ies"}
                      </button>
                    )}

                    {/* Replies */}
                    {visibleReplies.map(reply => (
                      <div key={String(reply.id)} className="ml-12 relative">
                        {/* Vertical line connecting replies */}
                        <div className="absolute -left-6 top-0 bottom-0 w-[2px] bg-[#3E4042] rounded-full" />
                        {renderOneComment(reply, true)}
                      </div>
                    ))}

                    {/* "Hide replies" button */}
                    {isExpanded && replies.length > MAX_PREVIEW && (
                      <button
                        type="button"
                        className="ml-12 text-[#B0B3B8] text-[13px] hover:text-[#E4E6EB]"
                        onClick={() => toggleThread(rootId, false)}
                      >
                        Hide replies
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-[#3E4042] bg-[#242526] sticky bottom-0">
        <form className="flex gap-3 items-center" onSubmit={handleSubmit}>
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-[#B0B3B8] hover:text-[#E4E6EB] text-2xl p-1 transition-colors"
          >
            😀
          </button>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              className="w-full bg-[#3A3B3C] text-white rounded-full px-5 py-3 outline-none focus:ring-2 focus:ring-[#1877F2] transition-all text-[15px]"
              placeholder={replyTo ? `Reply to ${replyTo?._reply_author?.display || replyTo?._reply_author?.name || 'user'}...` : "Write a comment..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              // ✅ autoFocus removed - keyboard won't pop automatically
            />
          </div>
          <button 
            type="submit" 
            className="text-[#1877F2] font-bold text-[15px] disabled:text-[#B0B3B8] disabled:cursor-not-allowed px-4 py-2 min-w-[60px] transition-colors"
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
    <div className="w-full">
      <div className="bg-[#242526] w-full p-4">
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
      
      <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
    </div>
  );
};

// Export all components
export { getMediaTypeInfo,
  getMarketplaceImages,
  getMarketplacePriceLine,
  normalizeEventFromFeed,
  topReactionEmojis,
  safeArray,
  safeNumber,
  safeString,
  safePostId,
  safeUserId,
  avatarFrom };
