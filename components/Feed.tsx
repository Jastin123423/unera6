// Feed.tsx – Fully optimized with React.memo, no duplicate exports

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useContext,
  memo,
} from 'react';
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
import { performPostAction } from '../postActionRegistry';
import { PostMenu } from './Post/PostMenu';
import { SponsoredPostCard } from './Ads/SponsoredPostCard';

// ==================== ICON COMPONENTS ====================
const Film: React.FC<{ size?: number; color?: string }> = ({
  size = 22,
  color = '#1877F2',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
    <line x1="7" y1="2" x2="7" y2="22"></line>
    <line x1="17" y1="2" x2="17" y2="22"></line>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <line x1="2" y1="7" x2="7" y2="7"></line>
    <line x1="2" y1="17" x2="7" y2="17"></line>
    <line x1="17" y1="17" x2="22" y2="17"></line>
  </svg>
);

const MoreHorizontal: React.FC<{ size?: number; color?: string }> = ({
  size = 26,
  color = '#b0b3b8',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="1"></circle>
    <circle cx="19" cy="12" r="1"></circle>
    <circle cx="5" cy="12" r="1"></circle>
  </svg>
);

const Play: React.FC<{
  size?: number;
  color?: string;
  fill?: string;
  style?: React.CSSProperties;
}> = ({ size = 36, color = '#fff', fill = '#fff', style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
);

const Eye: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = '#fff',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

const SparkReactIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="uneraSparkGrad" x1="12" y1="52" x2="52" y2="12">
        <stop offset="0%" stopColor="#FF7A45" />
        <stop offset="55%" stopColor="#FF5A6A" />
        <stop offset="100%" stopColor="#FF8A3D" />
      </linearGradient>
      <filter
        id="uneraSparkGlow"
        x="-40%"
        y="-40%"
        width="180%"
        height="180%"
      >
        <feGaussianBlur stdDeviation="2.2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <circle
      cx="32"
      cy="32"
      r="18"
      fill="url(#uneraSparkGrad)"
      opacity="0.14"
    />
    <g
      stroke="url(#uneraSparkGrad)"
      strokeWidth="5.2"
      strokeLinecap="round"
      filter="url(#uneraSparkGlow)"
    >
      <line x1="32" y1="10" x2="32" y2="18" />
      <line x1="32" y1="46" x2="32" y2="54" />
      <line x1="10" y1="32" x2="18" y2="32" />
      <line x1="46" y1="32" x2="54" y2="32" />
      <line x1="17" y1="17" x2="22.8" y2="22.8" />
      <line x1="41.2" y1="41.2" x2="47" y2="47" />
      <line x1="47" y1="17" x2="41.2" y2="22.8" />
      <line x1="22.8" y1="41.2" x2="17" y2="47" />
    </g>
    <circle cx="32" cy="32" r="6.2" fill="url(#uneraSparkGrad)" />
  </svg>
);

const DiscussSignalIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 28,
  color = '#1877F2',
}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <g
      fill="none"
      stroke={color}
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 20c0-5 4-9 9-9h18c7 0 13 6 13 13v6c0 7-6 13-13 13H30l-9 7v-7h-1c-6 0-10-4-10-10V20z" />
      <circle cx="27" cy="30" r="2.2" />
      <circle cx="33" cy="30" r="2.2" />
      <circle cx="39" cy="30" r="2.2" />
      <path d="M48 18c3 2 5 5 6 9" />
      <path d="M44 22c2 1 3 3 4 6" />
    </g>
  </svg>
);

// ==================== HELPER FUNCTIONS ====================
const formatViewCount = (n?: number): string => {
  const v = Number(n || 0);
  if (v >= 1_000_000_000)
    return `${(v / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (v >= 1_000_000)
    return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(v);
};

type RSVPStatus = 'going' | 'interested' | 'not_going';

const rsvpEventDirect = async (args: {
  eventId: number;
  userId: number;
  newStatus: RSVPStatus;
  prevStatus?: '' | 'going' | 'interested';
}) => {
  const { eventId, userId, newStatus, prevStatus = '' } = args;
  const endpoint =
    newStatus === 'going'
      ? '/api/attend'
      : newStatus === 'interested'
      ? '/api/interested'
      : prevStatus === 'interested'
      ? '/api/interested'
      : '/api/attend';
  const payloadStatus = {
    event_id: eventId,
    user_id: userId,
    status: newStatus,
  };
  try {
    return await postJSON(endpoint, payloadStatus);
  } catch (e1: any) {
    const payloadAction = {
      event_id: eventId,
      user_id: userId,
      action: newStatus === 'not_going' ? 'remove' : 'add',
    };
    try {
      return await postJSON(endpoint, payloadAction);
    } catch (e2: any) {
      throw new Error(e2?.message || e1?.message || 'RSVP failed');
    }
  }
};

const avatarFrom = (u: any) => {
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
  const label =
    String(u?.name ?? '').trim() ||
    String(u?.username ?? '').trim() ||
    String(u?.author_name ?? '').trim() ||
    String(u?.author_username ?? '').trim() ||
    'User';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    label
  )}&background=1877F2&color=fff&bold=true`;
};

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('unera_token');
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData)
    headers['Content-Type'] =
      (headers['Content-Type'] as string) || 'application/json';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
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

const authHeaders = () => {
  const token = localStorage.getItem('unera_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

const postJSON = async (url: string, body: any) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body ?? {}),
  });

  const data = await safeJson(res);

  if (!res.ok || (data && data.success === false)) {
    throw new Error(data?.error || data?.message || `Request failed: ${url}`);
  }

  return data;
};

const normalizeFeedResponse = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.feed)) return data.feed;
  if (Array.isArray(data.posts)) return data.posts;
  if (data.data && Array.isArray(data.data.feed)) return data.data.feed;
  if (data.data && Array.isArray(data.data.posts)) return data.data.posts;
  if (Array.isArray(data.data)) return data.data;
  return [];
};

const unwrapFeedItem = (item: any): any => {
  if (!item) return null;
  if (item.type === 'post' && item.post) return item.post;
  if (item.type === 'event' && item.event) return item.event;
  if (item.type === 'product' && item.product) return item.product;
  if (item.type === 'marketplace' && item.marketplace) return item.marketplace;
  if (item.type === 'music' && item.music) return item.music;
  if (item.type === 'podcast' && item.podcast) return item.podcast;
  if (item.type === 'reel' && item.reel) return item.reel;
  if (item.data) return item.data;
  return item;
};

const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeString = (v: any, fallback = '') =>
  typeof v === 'string' ? v : fallback;
const safeStr = (v: any) => String(v ?? '').trim();
const safeUserId = (u: any) => safeNumber(u?.id ?? u?.user_id ?? u?.userId, 0);
const safePostId = (p: any) => safeNumber(p?.id ?? p?.post_id ?? p?.postId, 0);

const getPostTextPreview = (p: any, max = 140) => {
  const t = String(p?.content ?? p?.text ?? '').trim();
  if (!t) return '';
  return t.length > max ? t.slice(0, max).trim() + '…' : t;
};

const safeJsonArray = (v: any): string[] => {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return [];
    if (s.startsWith('[')) {
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
  const single = typeof p?.media_url === 'string' && p.media_url ? [p.media_url] : [];
  return single;
};

const getMarketplacePriceLine = (productData?: any) => {
  const priceRaw = productData?.price ?? productData?.main_price ?? null;
  const currency = productData?.currency || 'TZS';
  const loc =
    (typeof productData?.location === 'string' &&
      productData.location.split(',')[0]) ||
    (typeof productData?.address === 'string' &&
      productData.address.split(',')[0]) ||
    'Marketplace';
  const priceNum = priceRaw != null ? Number(priceRaw) : NaN;
  const price = Number.isFinite(priceNum) ? priceNum.toFixed(0) : null;
  return { price, currency, loc };
};

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

const reactionEmoji = (t: string) => {
  switch (t) {
    case 'like':
      return '👍';
    case 'love':
      return '❤️';
    case 'haha':
      return '😂';
    case 'wow':
      return '😮';
    case 'sad':
      return '😢';
    case 'angry':
      return '😡';
    case 'fire':
      return '🔥';
    case 'party':
      return '🎉';
    case 'clap':
      return '👏';
    case 'star':
      return '⭐';
    case 'thinking':
      return '🤔';
    case 'crying':
      return '😭';
    case 'heart_eyes':
      return '🥰';
    case 'kiss':
      return '😘';
    case 'sunglasses':
      return '😎';
    case 'rocket':
      return '🚀';
    case 'trophy':
      return '🏆';
    case 'crown':
      return '👑';
    case 'unicorn':
      return '🦄';
    case 'rainbow':
      return '🌈';
    case 'money':
      return '💰';
    case 'muscle':
      return '💪';
    case 'brain':
      return '🧠';
    case 'lightning':
      return '⚡';
    case 'gem':
      return '💎';
    default:
      return '👍';
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

const fmtCount = (n: number) => {
  const num = Number(n || 0);
  if (num >= 1_000_000)
    return (num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (num >= 1_000)
    return (num / 1_000).toFixed(num % 1_000 === 0 ? 0 : 1) + 'K';
  return String(num);
};

const formatReactionText = (totalCount: number, reactorName: string): string => {
  if (totalCount === 0) return '';
  const formattedTotal = fmtCount(totalCount);
  if (totalCount === 1) {
    return `${formattedTotal} · ${reactorName}`;
  }
  const othersCount = totalCount - 1;
  const formattedOthers = fmtCount(othersCount);
  return `${formattedTotal} · ${reactorName} and ${formattedOthers} other${
    othersCount !== 1 ? 's' : ''
  }`;
};

const stableHash = (input: any) => {
  const s = String(input ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
};

const resolveUserName = (reaction: any, users?: any[]) => {
  const uid = Number(
    reaction?.user_id ??
      reaction?.userId ??
      reaction?.user?.id ??
      reaction?.user?.user_id ??
      0
  );
  const user =
    (users || []).find((u) => Number(u?.id) === uid) || reaction?.user || null;
  const name = String(
    reaction?.name ??
      reaction?.user?.name ??
      user?.name ??
      user?.username ??
      reaction?.username ??
      ''
  ).trim();
  return name;
};

const pickStableReactorName = (
  postId: number | string,
  reactions: any[],
  users?: any[]
) => {
  if (!Array.isArray(reactions) || reactions.length === 0) return '';
  const idx = stableHash(postId) % reactions.length;
  const r = reactions[idx] || reactions[0];
  const name = resolveUserName(r, users);
  return String(name || '').trim();
};

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
    const response = await fetch(
      `/api/link-preview?url=${encodeURIComponent(url)}`
    );
    const data = await response.json();
    if (data.success && data.data) {
      return {
        url,
        title: data.data.title || domain,
        description:
          data.data.description ||
          `Visit ${domain} for more information.`,
        image:
          data.data.image ||
          'https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&w=800&q=80',
        domain: domain,
      };
    }
  } catch (error) {
    console.debug('Link preview fetch failed, using fallback');
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
  '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤',
];

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

let reactionStyleMounted = false;

const ensureReactionStyles = () => {
  if (reactionStyleMounted) return;
  reactionStyleMounted = true;
  const styleTag = document.createElement('style');
  styleTag.textContent = reactionStyles;
  styleTag.setAttribute('data-reaction-styles', '1');
  document.head.appendChild(styleTag);
};

// ==================== CUSTOM COMPARISON FUNCTIONS ====================
const postPropsEqual = (prev: any, next: any) => {
  return (
    prev.post?.id === next.post?.id &&
    prev.post?.reactions_count === next.post?.reactions_count &&
    prev.post?.comments_count === next.post?.comments_count &&
    prev.post?.shares === next.post?.shares &&
    prev.myReaction === next.myReaction &&
    prev.isFollowing === next.isFollowing &&
    prev.followLoading === next.followLoading
  );
};

const eventPostPropsEqual = (prev: any, next: any) => {
  return (
    prev.event?.id === next.event?.id &&
    prev.event?.attendees_count === next.event?.attendees_count &&
    prev.event?.interested_count === next.event?.interested_count &&
    prev.event?.user_rsvp_status === next.event?.user_rsvp_status
  );
};

const reelCardPropsEqual = (prev: any, next: any) => {
  return (
    prev.reel?.id === next.reel?.id &&
    prev.reel?.views === next.reel?.views &&
    prev.reel?.likes === next.reel?.likes &&
    prev.reel?.comments === next.reel?.comments
  );
};

// ==================== EXPORTED COMPONENTS (Memoized) ====================

/**
 * =========================
 * ✅ REACTIONS SHEET
 * =========================
 */
export const ReactionsSheet = memo(
  ({
    isOpen,
    onClose,
    postId,
    onProfileClick,
    onOpenComments,
  }: {
    isOpen: boolean;
    onClose: () => void;
    postId: number;
    onProfileClick: (id: number) => void;
    onOpenComments?: (postId: number) => void;
  }) => {
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState<string>('all');
    const [items, setItems] = useState<any[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
      if (!isOpen) return;
      setLoading(true);
      setItems([]);
      setCounts({});
      setActive('all');
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      (async () => {
        try {
          const data = await apiFetch(
            `/api/posts/${postId}/reactions?limit=500&offset=0`,
            {
              signal: abortRef.current?.signal as any,
            } as any
          );
          const arr = Array.isArray(data?.reactions) ? data.reactions : [];
          setItems(arr);
          const map: Record<string, number> = {};
          for (const r of arr) {
            const t = String(r?.type || 'like').toLowerCase();
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
      active === 'all'
        ? items
        : items.filter((x) => String(x?.type).toLowerCase() === active);

    const Tab = ({
      t,
      label,
      count,
    }: {
      t: string;
      label: React.ReactNode;
      count: number;
    }) => (
      <button
        onClick={() => setActive(t)}
        className={`px-3 py-2 text-[17px] font-bold border-b-2 whitespace-nowrap ${
          active === t
            ? 'text-[#1877F2] border-[#1877F2]'
            : 'text-[#B0B3B8] border-transparent'
        }`}
      >
        {label} {count ? <span className="ml-1">{count}</span> : null}
      </button>
    );

    return (
      <div className="fixed inset-0 z-[9999] bg-[#18191A] flex flex-col">
        <div className="p-4 border-b border-[#3E4042] flex items-center gap-3 bg-[#242526]">
          <button
            className="w-10 h-10 rounded-full hover:bg-[#3A3B3C] flex items-center justify-center"
            onClick={onClose}
            aria-label="Back"
          >
            <i className="fas fa-arrow-left text-[#E4E6EB] text-xl"></i>
          </button>
          <div className="text-[#E4E6EB] font-bold text-[20px]">
            People who reacted
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto border-b border-[#3E4042] bg-[#242526] scrollbar-hide">
          <Tab t="all" label="All" count={items.length} />
          {typesSorted.map((t) => (
            <Tab
              key={t}
              t={t}
              label={<span className="text-[20px]">{reactionEmoji(t)}</span>}
              count={counts[t] || 0}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-[#B0B3B8] text-center text-[17px]">
              Loading reactions...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-[#B0B3B8] text-center text-[17px]">
              No reactions yet.
            </div>
          ) : (
            <div className="p-2">
              {filtered.map((r, idx) => {
                const u = r?.user || {};
                const uid = Number(u?.id || r?.user_id || 0);
                const name = String(u?.name || u?.username || 'User');
                const img = avatarFrom(u);
                return (
                  <button
                    key={String(uid) + '-' + idx}
                    className="w-full flex items-center gap-3 p-3 hover:bg-[#3A3B3C] rounded-xl text-left"
                    onClick={() => uid && onProfileClick(uid)}
                  >
                    <div className="relative">
                      <img
                        src={img}
                        className="w-12 h-12 rounded-full object-cover"
                        alt=""
                      />
                      <div className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-[#242526] border border-[#3E4042] flex items-center justify-center text-[16px]">
                        {reactionEmoji(String(r?.type))}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[#E4E6EB] font-bold text-[17px] truncate">
                        {name}
                      </div>
                      {u?.username ? (
                        <div className="text-[#B0B3B8] text-[14px] truncate">
                          @{u.username}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {onOpenComments && (
          <div className="p-4 border-t border-[#3E4042] bg-[#242526]">
            <button
              onClick={() => {
                onClose();
                onOpenComments(postId);
              }}
              className="w-full py-3 bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] font-bold rounded-lg transition-colors text-[17px]"
            >
              View Discussions
            </button>
          </div>
        )}
      </div>
    );
  },
  (prev, next) => {
    return prev.isOpen === next.isOpen && prev.postId === next.postId;
  }
);

/**
 * =========================
 * ✅ GALLERY VIEWER
 * =========================
 */
export const GalleryViewer = memo(
  ({
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
    onOpenReactions,
  }: {
    isOpen: boolean;
    urls: string[];
    startIndex: number;
    onClose: () => void;
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
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-black/40"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-white text-[17px] font-semibold">
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

        <div
          className="bg-black/80 backdrop-blur-sm border-t border-white/10 px-4 py-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-[#B0B3B8] text-[15px] mb-2 px-2">
            <div className="flex items-center gap-2">
              {reactionCount > 0 && (
                <span
                  className="text-[#E4E6EB] font-bold cursor-pointer hover:underline flex items-center gap-2 text-[15px]"
                  onClick={onOpenReactions}
                >
                  <div className="flex -space-x-2">
                    {Array.from(new Set([myReaction, 'like', 'love']))
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((t, i) => (
                        <span
                          key={i}
                          className="w-[24px] h-[24px] rounded-full bg-[#3A3B3C] border border-black flex items-center justify-center text-[16px]"
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
                className="hover:underline cursor-pointer text-[15px]"
                onClick={onOpenComments}
              >
                {formatCount(commentCount)} Discussions
              </span>
              {shareCount > 0 && (
                <span
                  className="hover:underline cursor-pointer text-[15px]"
                  onClick={onShare}
                >
                  {formatCount(shareCount)} Shares
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <ReactionButton
              currentUserReactions={myReaction}
              reactionCount={reactionCount}
              onReact={(type) => onReact(type)}
              isGuest={!currentUser}
            />
            <button
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group"
              onClick={() => (currentUser ? onOpenComments() : alert('Login first'))}
            >
              <DiscussSignalIcon size={28} color="#1877F2" />
              <span className="text-[19px] font-bold text-[#B0B3B8] group-hover:text-[#E4E6EB]">
                Discuss
              </span>
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
              onClick={() =>
                currentUser ? onShare() : alert('Please login to share posts.')
              }
            >
              <i className="fas fa-share text-[22px]"></i>
              <span className="text-[19px] font-bold">Share</span>
            </button>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.isOpen === next.isOpen &&
      prev.urls === next.urls &&
      prev.startIndex === next.startIndex &&
      prev.reactionCount === next.reactionCount &&
      prev.commentCount === next.commentCount &&
      prev.shareCount === next.shareCount &&
      prev.myReaction === next.myReaction
    );
  }
);
