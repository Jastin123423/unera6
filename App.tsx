
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Login, Register } from './components/Auth';
import { Header, Sidebar, RightSidebar } from './components/Layout';
import {
  CreatePost,
  Post,
  CommentsSheet,
  CreatePostModal,
  ShareBottomSheet,
  PeopleYouMayKnowGrid,
  GroupsYouMayJoinCard,
  ReelFeedCard,
  FeedItem,
} from './components/Feed';
import { StoryReel, CreateStoryModal, StoryViewerModal } from './components/Story';
import { UserProfile } from './components/UserProfile';
import { MarketplacePage, ProductDetailModal } from './components/Marketplace';
import { ReelsFeed, CreateReelModal } from './components/Reels';
import { AllEvents } from "./components/AllEvents";
import { ImageViewer, ProfessionalLoader } from './components/Common';
import {
  BirthdaysPage,
  MemoriesPage,
  SettingsPage,
  SuggestedProfilesPage,
} from './components/MenuPages';
import { HelpSupportPage } from './components/HelpSupport';
import { CreateEventModal } from './components/Events';
import { BrandsPage } from './components/Brands';
import MusicSystem, { GlobalAudioPlayer } from './components/MusicSystem';
import { GroupsPage } from './components/Groups';
import { ToolsPage } from './components/Tools';
import { PrivacyPolicyPage } from './components/PrivacyPolicy';
import { TermsOfServicePage } from './components/TermsOfService';
import { ChatWindow } from './components/Chat';
import { ChatsList } from './components/ChatsList';
import { CallScreen } from './components/CallScreen';
import Recorder from './components/Recorder';
import { NotificationsPage } from './components/NotificationsPage';
import Dashboard from './components/Dashboard';
import AdCreator from './components/AdCreator';
import AdsManager from './components/AdsManager';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartLine, 
  faPlus, 
  faBullhorn, 
  faChartBar 
} from '@fortawesome/free-solid-svg-icons';
import { TrendingUp } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { buildImageUploadBundle } from './utils/imageCompression';
import {
  User,
  Post as PostType,
  Story,
  Reel,
  Notification,
  Event,
  Product,
  AudioTrack,
  ReactionType,
  Group,
  Brand,
  Song,
  AdCampaign,
} from './types';

// ============================================================================
// ✅ FEED IDENTITY HELPERS - HYBRID MIXED FEED SYSTEM
// ============================================================================

/**
 * Get feed item type for proper identification
 * Supports: post, reel, event, product, group_post, music, podcast, sponsored
 */
const getFeedItemType = (item: any): string => {
  if (!item || typeof item !== 'object') return 'post';
  
  const meta = item?.meta || {};
  
  // Sponsored/Ad items
  if (item?.source === 'sponsored' || 
      item?.item_type === 'sponsored' || 
      item?.type === 'sponsored' || 
      meta?.kind === 'ad') {
    return 'sponsored';
  }
  
  if (item?.source === 'product' || 
      item?.item_type === 'product' ||
      item?.type === 'marketplace' || 
      item?.type === 'product' ||
      item?.post_type === 'product' ||
      meta?.type === 'product' || 
      meta?.kind === 'product' ||
      !!item?.product_id ||
      !!meta?.marketplace?.id) {
    return 'product';
  }
  
  if (item?.source === 'event' || 
      item?.item_type === 'event' ||
      item?.type === 'event' ||
      item?.post_type === 'event' ||
      meta?.type === 'event' || 
      meta?.kind === 'event' ||
      !!item?.event_id ||
      !!meta?.event) {
    return 'event';
  }
  
  if (item?.source === 'group_post' || 
      item?.item_type === 'group_post' ||
      !!item?.group_id || 
      !!item?.group) {
    return 'group_post';
  }
  
  if (item?.source === 'reel' || 
      item?.item_type === 'reel' ||
      !!item?.reel_id) {
    return 'reel';
  }
  
  if (meta?.kind === 'music' || meta?.type === 'music') return 'music';
  if (meta?.kind === 'podcast' || meta?.type === 'podcast') return 'podcast';
  
  return 'post';
};

/**
 * Get feed item ID based on type - ALWAYS returns numeric ID
 * Supports hybrid feed items (post, reel, event, product, group_post, music, podcast, sponsored)
 */
const getFeedItemId = (item: any): number => {
  if (!item || typeof item !== 'object') return 0;

  const type = getFeedItemType(item);

  switch (type) {
    case 'product':
      return Number(item?.product_id ?? item?.meta?.marketplace?.id ?? item?.id ?? 0);
    case 'event':
      return Number(item?.event_id ?? item?.id ?? 0);
    case 'group_post':
      return Number(item?.post_id ?? item?.id ?? 0);
    case 'reel':
      return Number(item?.reel_id ?? item?.id ?? 0);
    case 'music':
      return Number(item?.song_id2 ?? item?.song_id ?? item?.id ?? 0);
    case 'podcast':
      return Number(item?.podcast_id ?? item?.id ?? 0);
    case 'sponsored':
      return Number(item?.id ?? 0);
    default:
      return Number(item?.id ?? 0);
  }
};

/**
 * Get feed key for mixed-feed identification (post:123, reel:456, etc.)
 */
const getFeedKey = (item: any): string => {
  if (!item) return "";

  // Handle string input (already a key)
  if (typeof item === "string") return item;

  // Handle object with feed_key
  if (item?.feed_key) return String(item.feed_key);

  // Generate feed_key from type and numeric ID
  const type = getFeedItemType(item);
  const id = getFeedItemId(item);

  return `${type}:${id}`;
};

/**
 * Safe item comparison using feed keys and numeric IDs
 */
const isSameFeedItem = (a: any, b: any): boolean => {
  if (!a || !b) return false;

  // First try by feed_key
  const aKey = getFeedKey(a);
  const bKey = getFeedKey(b);
  if (aKey && bKey) return aKey === bKey;

  // Fallback to type + numeric ID comparison
  const aType = getFeedItemType(a);
  const bType = getFeedItemType(b);
  const aId = getFeedItemId(a);
  const bId = getFeedItemId(b);

  return aType === bType && aId > 0 && bId > 0 && aId === bId;
};

/**
 * Optimistic reaction update for hybrid feed items
 * Uses identity string for matching instead of numeric ID only
 */
const applyOptimisticReaction = (
  p: any,
  targetIdentity: string,
  type: ReactionType,
  meId: number
) => {
  if (!p) return p;

  // Match by feed_key instead of numeric ID
  const same = getFeedKey(p) === targetIdentity;
  if (!same) return p;

  const prevMy = p?.my_reaction ?? p?.myReaction ?? null;
  const nextMy = prevMy === type ? null : type;

  const prevArr = safeArray<any>(p?.reactions);
  const withoutMe = prevArr.filter((r: any) => Number(r?.user_id) !== Number(meId));
  const nextArr = nextMy ? [...withoutMe, { user_id: meId, type: nextMy }] : withoutMe;

  const prevCount = safeNumber(
    p?.reactions_count,
    safeNumber(p?.reactionsCount, safeNumber(p?.likesCount, prevArr.length))
  );

  let nextCount = prevCount;

  if (!prevMy && nextMy) {
    nextCount = prevCount + 1;
  } else if (prevMy && !nextMy) {
    nextCount = Math.max(0, prevCount - 1);
  } else if (prevMy && nextMy) {
    nextCount = prevCount;
  }

  return {
    ...p,
    reactions: nextArr,
    my_reaction: nextMy,
    myReaction: nextMy,
    reactions_count: nextCount,
    reactionsCount: nextCount,
    likesCount: nextCount,
  };
};

/** ---------- Type for People You May Know suggestions ---------- */
type PeopleSuggestion = {
  id: number;
  username: string;
  name: string;
  profile_image_url: string | null;
  is_verified: boolean;
  role: string;
  mutual_count: number;
  is_following: boolean;
  score: number;
};

/** ---------- Type for Groups You May Join suggestions ---------- */
type GroupSuggestion = {
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
};

/** ---------- Safety helpers ---------- */
const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeString = (v: any, fallback = '') => (typeof v === 'string' ? v : String(v || ''));
const safeBoolean = (v: any, fallback = false) => (typeof v === 'boolean' ? v : !!v);

/** ✅ JSON parsing helper for meta fields */
const parseJSON = (v: any) => {
  if (!v) return null;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v;
};

/** ✅ safeImages helper for marketplace product posts */
const safeImages = (imgs: any): string[] => {
  if (Array.isArray(imgs)) return imgs.filter(Boolean);
  if (typeof imgs === 'string') {
    try {
      const p = JSON.parse(imgs);
      return Array.isArray(p) ? p.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
};

/** ---------- Constants ---------- */
const DEFAULT_MUSIC_COVER = 'https://media.unera.social/task_01kftb3024ed7bm84gy6j485fh_1769336848_img_0.webp';
const DEFAULT_EVENT_COVER = 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1500&q=80';
const LS_USER_KEY = 'user';

/** ===== FB-LIKE STORY SEEN SYSTEM ===== */
const STORY_SEEN_KEY = 'unera_story_seen_v1';
const STORY_SEEN_LIMIT = 2500;

/** ===== CACHE CONSTANTS ===== */
const STORIES_CACHE_KEY = "unera_stories_cache_v1";
const STORIES_CACHE_TTL_MS = 60_000;
const STORY_VIEWERS_CACHE_KEY = "unera_story_viewers_";
const VIEWERS_TTL = 2 * 60_000;

/** ===== PYMK CONSTANTS ===== */
const PYMK_HIDDEN_KEY = "unera_pymk_hidden_v1";

/** ===== GROUPS YOU MAY JOIN CONSTANTS ===== */
const GROUPS_YOU_MAY_JOIN_HIDDEN_KEY = "unera_groups_you_may_join_hidden_v1";

/** ---------- Video/Reel ID resolver ---------- */
const resolveVideoId = (item: any): number | null => {
  if (!item) return null;
  
  const possibleIds = [
    item?.post_id,
    item?.postId,
    item?.reel_id,
    item?.reelId,
    item?.video_id,
    item?.videoId,
    item?.id,
  ];
  
  for (const id of possibleIds) {
    if (id === undefined || id === null) continue;
    const num = Number(id);
    if (Number.isFinite(num) && num > 0) return num;
  }
  
  return null;
};

/** ---------- Stable key generator ---------- */
const getStableItemKey = (item: any, prefix = 'item'): string => {
  const id = resolveVideoId(item);
  if (id) return `${prefix}-${id}`;
  
  const fallbackParts = [
    item?.user_id,
    item?.userId,
    item?.created_at,
    item?.createdAt,
    item?.media_url,
    item?.content?.substring(0, 20)
  ].filter(Boolean);
  
  return `${prefix}-${fallbackParts.join('-') || Math.random()}`;
};

const readStorySeen = (): number[] => {
  try {
    const raw = localStorage.getItem(STORY_SEEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
};

const writeStorySeen = (ids: number[]) => {
  try {
    const dedup = Array.from(new Set(ids.map(Number).filter(Number.isFinite))).slice(0, STORY_SEEN_LIMIT);
    localStorage.setItem(STORY_SEEN_KEY, JSON.stringify(dedup));
  } catch {}
};

/** Stories cache functions */
const readStoriesCache = () => {
  try {
    const raw = localStorage.getItem(STORIES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed?.stories)) return null;
    
    if (Date.now() - parsed.ts > STORIES_CACHE_TTL_MS) {
      localStorage.removeItem(STORIES_CACHE_KEY);
      return null;
    }
    
    return parsed as { ts: number; stories: any[] };
  } catch {
    return null;
  }
};

const writeStoriesCache = (stories: any[]) => {
  try {
    localStorage.setItem(STORIES_CACHE_KEY, JSON.stringify({ 
      ts: Date.now(), 
      stories: stories.map(s => normalizeStory(s)) 
    }));
  } catch {}
};

/** Viewers cache functions */
const readViewersCache = (storyId: number) => {
  try {
    const raw = localStorage.getItem(`${STORY_VIEWERS_CACHE_KEY}${storyId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.ts && Date.now() - parsed.ts > VIEWERS_TTL) {
      localStorage.removeItem(`${STORY_VIEWERS_CACHE_KEY}${storyId}`);
      return null;
    }
    return parsed.viewers as any[];
  } catch {
    return null;
  }
};

const writeViewersCache = (storyId: number, viewers: any[]) => {
  try {
    localStorage.setItem(`${STORY_VIEWERS_CACHE_KEY}${storyId}`, 
      JSON.stringify({ ts: Date.now(), viewers }));
  } catch {}
};

/** ---------- Error Boundary for Crash Protection ---------- */
class ErrorBoundary extends React.Component<{ children: any }, { error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  componentDidCatch(error: any, info: any) {
    console.error("UI crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-white">
          <div className="bg-[#242526] border border-[#3E4042] rounded-xl p-4">
            <p className="font-bold text-red-400">Component crashed</p>
            <p className="text-[#B0B3B8] text-sm mt-2">
              Open DevTools Console to see the exact error.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** ---------- Facebook-like feed session + seen cache ---------- */
const FEED_SESSION_KEY = 'unera_feed_session_seed';
const FEED_LAST_ACTIVE_KEY = 'unera_feed_last_active';
const FEED_SEEN_KEY = 'unera_feed_seen_ids';
const FEED_RETURN_THRESHOLD_MS = 3 * 60 * 1000;
const FEED_SEEN_LIMIT = 1500;

const nowMs = () => Date.now();

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const mulberry32 = (seed: number) => {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hashToSeed = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const getOrCreateSessionSeed = (userId?: number | null) => {
  try {
    const existing = sessionStorage.getItem(FEED_SESSION_KEY);
    if (existing) return Number(existing) || 1;

    const seedStr = `${userId ?? 'guest'}:${nowMs()}:${Math.random()}`;
    const seed = hashToSeed(seedStr);
    sessionStorage.setItem(FEED_SESSION_KEY, String(seed));
    return seed;
  } catch {
    return hashToSeed(`${userId ?? 'guest'}:${nowMs()}`);
  }
};

const seededShuffle = <T,>(arr: T[], seed: number) => {
  const a = arr.slice();
  const rnd = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const getSeenSet = () => {
  const ids = readJson<number[]>(FEED_SEEN_KEY, []);
  return new Set(ids.map(Number).filter(Number.isFinite));
};

const pushSeenIds = (ids: number[]) => {
  const existing = readJson<number[]>(FEED_SEEN_KEY, []);
  const merged = [...ids, ...existing].map(Number).filter(Number.isFinite);
  const dedup = Array.from(new Set(merged)).slice(0, FEED_SEEN_LIMIT);
  writeJson(FEED_SEEN_KEY, dedup);
};

const diversifyFeed = (posts: PostType[], seed: number) => {
  if (!Array.isArray(posts) || posts.length <= 2) return posts;

  const rnd = mulberry32(seed ^ 0x9e3779b9);
  const buckets = new Map<string, PostType[]>();

  const keyOf = (p: any) => {
    const uid = Number(p?.user_id ?? 0);
    const type = String(p?.type ?? 'post');
    return `u:${uid}|t:${type}`;
  };

  for (const p of posts) {
    const k = keyOf(p);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(p);
  }

  const keys = seededShuffle(Array.from(buckets.keys()), Math.floor(rnd() * 1e9));
  const out: PostType[] = [];
  let lastAuthor = -1;
  let repeats = 0;

  while (out.length < posts.length) {
    let progressed = false;

    for (const k of keys) {
      const b = buckets.get(k);
      if (!b || b.length === 0) continue;

      const candidate = b[0];
      const author = Number((candidate as any).user_id ?? -1);

      if (author === lastAuthor && repeats >= 1) continue;

      out.push(b.shift()!);
      progressed = true;

      if (author === lastAuthor) repeats++;
      else {
        lastAuthor = author;
        repeats = 0;
      }

      if (out.length >= posts.length) break;
    }

    if (!progressed) {
      for (const k of keys) {
        const b = buckets.get(k);
        if (b && b.length) {
          out.push(b.shift()!);
          if (out.length >= posts.length) break;
        }
      }
    }
  }

  return out;
};

/** Name validation helper */
const isBadName = (v: any): boolean => {
  const s = String(v ?? '').trim();
  return !s || s.toLowerCase() === 'user' || s.toLowerCase() === 'un';
};

/** Safe User Merge Helper with name protection */
const isHttpUrl = (v: any) =>
  typeof v === 'string' && (v.startsWith('https://') || v.startsWith('http://'));

const mergeUserSafe = (oldU: any, newU: any) => {
  const next = { ...oldU, ...newU };

  if (!isHttpUrl(newU?.profile_image_url) && isHttpUrl(oldU?.profile_image_url)) {
    next.profile_image_url = oldU.profile_image_url;
  }
  if (!isHttpUrl(newU?.cover_image_url) && isHttpUrl(oldU?.cover_image_url)) {
    next.cover_image_url = oldU.cover_image_url;
  }

  if (!Array.isArray(newU?.followers) && Array.isArray(oldU?.followers)) {
    next.followers = oldU.followers;
  }
  if (!Array.isArray(newU?.following) && Array.isArray(oldU?.following)) {
    next.following = oldU.following;
  }

  if (isBadName(newU?.name) && !isBadName(oldU?.name)) {
    next.name = oldU.name;
  }
  if (isBadName(newU?.username) && !isBadName(oldU?.username)) {
    next.username = oldU.username;
  }

  return next;
};

/** ---------- UNERA Professional Profile Picture Generator ---------- */
const COLORS = [
  '#1877F2',
  '#45BD62',
  '#F3425F',
  '#F7B928',
  '#9360F7',
  '#FF6B35',
  '#00B5AD',
  '#E41E3F',
  '#7B68EE',
  '#20B2AA',
  '#FF6347',
  '#9B59B6',
  '#1ABC9C',
  '#3498DB',
  '#E74C3C',
  '#2ECC71',
  '#F39C12',
  '#D35400',
];

const getUserColor = (identifier: string | number): string => {
  if (!identifier && identifier !== 0) return '#1877F2';
  const str = String(identifier);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
};

const generateInitials = (name: string): string => {
  if (!name || typeof name !== 'string' || name.trim().length === 0) return 'UN';
  const words = name.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 'UN';
  if (words.length === 1) {
    const w = words[0];
    if (w.length >= 2) return w.substring(0, 2).toUpperCase();
    return (w.charAt(0) + w.charAt(0)).toUpperCase();
  }
  return words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase();
};

const generateProfilePictureUrl = (name: string, identifier: string | number): string => {
  const initials = generateInitials(name);
  const backgroundColor = getUserColor(identifier).replace('#', '');
  const size = 128;
  const fontSize = 0.5;
  const textColor = 'FFFFFF';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    initials
  )}&background=${backgroundColor}&color=${textColor}&size=${size}&font-size=${fontSize}&bold=true&rounded=true&length=2`;
};

/**
 * Normalize raw D1 rows to UI-safe PostType shape
 */
const normalizePost = (p: any): PostType => {
  const mediaUrls =
    Array.isArray(p?.media_urls) ? p.media_urls :
    typeof p?.media_urls === "string" ? (() => { try { return JSON.parse(p.media_urls); } catch { return []; } })() :
    Array.isArray(p?.mediaUrls) ? p.mediaUrls :
    typeof p?.mediaUrls === "string" ? (() => { try { return JSON.parse(p.mediaUrls); } catch { return []; } })() :
    [];

  const mediaTypes =
    Array.isArray(p?.media_types) ? p.media_types :
    typeof p?.media_types === "string" ? (() => { try { return JSON.parse(p.media_types); } catch { return []; } })() :
    Array.isArray(p?.mediaTypes) ? p.mediaTypes :
    typeof p?.mediaTypes === "string" ? (() => { try { return JSON.parse(p.mediaTypes); } catch { return []; } })() :
    [];

  const mediaType = p?.media_type ?? p?.mediaType ?? (mediaTypes[0] ?? null);
  const mediaUrl = p?.media_url ?? p?.mediaUrl ?? (mediaUrls[0] ?? null);

  const resolvedId = safeNumber(p?.id ?? p?.post_id ?? p?.postId ?? p?.postID);

  // Handle event posts specifically
  if (p?.type === 'event' || p?.meta?.kind === 'event') {
    return {
      ...p,
      id: resolvedId,
      user_id: safeNumber(p?.user_id),
      content: safeString(p?.content),
      type: 'event',
      event_id: p?.event_id || p?.meta?.event_id,
      media_url: p?.meta?.event?.cover_url || mediaUrl,
      media_type: 'image',
      feed_key: p?.feed_key || `event:${resolvedId}`,
      meta: {
        kind: 'event',
        event_id: p?.event_id || p?.meta?.event_id,
        event: p?.meta?.event || {
          id: p?.event_id,
          title: p?.meta?.event?.title || p?.title,
          description: p?.meta?.event?.description || p?.description,
          date: p?.meta?.event?.date,
          time: p?.meta?.event?.time,
          location: p?.meta?.event?.location,
          cover_url: p?.meta?.event?.cover_url || mediaUrl,
          attendees: p?.meta?.event?.attendees || [],
          interested: p?.meta?.event?.interested || [],
        }
      }
    } as any;
  }

  return {
    ...p,
    id: resolvedId,
    user_id: p?.user_id === null || p?.user_id === undefined ? null : safeNumber(p?.user_id),
    content: safeString(p?.content),

    media_url: mediaUrl,
    media_type: mediaType,

    media_urls: mediaUrls.length ? mediaUrls : (mediaUrl ? [mediaUrl] : []),
    media_types: mediaTypes.length ? mediaTypes : (mediaType ? [mediaType] : []),

    reactions: safeArray(p?.reactions),
    comments: safeArray(p?.comments),
    shares: safeNumber(p?.shares),
    views: safeNumber(p?.views),
    visibility: p?.visibility ?? 'public',
    type:
      p?.type ??
      (() => {
        const t = mediaType || mediaTypes[0] || null;
        if (!t) return 'post';
        if (t.startsWith('image/')) return 'image';
        if (t.startsWith('video/')) return 'video';
        if (t.startsWith('audio/')) return 'audio';
        return 'post';
      })(),
    
    created_at: p?.created_at ?? p?.createdAt ?? new Date().toISOString(),
    
    my_reaction: p?.my_reaction ?? p?.myReaction ?? null,
    myReaction: p?.myReaction ?? p?.my_reaction ?? null,
    reactions_count: safeNumber(p?.reactions_count ?? p?.reactionsCount ?? p?.likesCount ?? 0),
    reactionsCount: safeNumber(p?.reactionsCount ?? p?.reactions_count ?? p?.likesCount ?? 0),
    likesCount: safeNumber(p?.likesCount ?? p?.reactions_count ?? p?.reactionsCount ?? 0),

    // ✅ IMPORTANT: Include feed_key for hybrid identification
    feed_key: p?.feed_key || `${p?.source || p?.item_type || p?.type || 'post'}:${resolvedId}`,

    meta: parseJSON(p?.meta) || null,
  } as any;
};

/** Event normalization helpers */
const toISO = (d: any) => {
  const dt = new Date(d);
  return Number.isFinite(dt.getTime()) ? dt.toISOString() : new Date().toISOString();
};

const toDateOnly = (d: any) => toISO(d).split('T')[0] || new Date().toISOString().slice(0, 10);

const toTimeHM = (d: any) => {
  const s = String(d ?? '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;

  const dt = new Date(d);
  if (!Number.isFinite(dt.getTime())) return '12:00';
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

/** Normalize event data */
const normalizeEvent = (e: any): Event => {
  const id = safeNumber(e?.id ?? e?.event_id ?? 0);

  const rawEventDate = e?.event_date ?? e?.date ?? e?.eventDate ?? new Date().toISOString();

  const date = toDateOnly(rawEventDate) || new Date().toISOString().slice(0, 10);
  const rawTime = e?.event_time ?? e?.time ?? e?.eventTime ?? '';
  const time = (rawTime ? toTimeHM(rawTime) : toTimeHM(rawEventDate)) || '12:00';

  const attendeesRaw =
    Array.isArray(e?.attendees) ? e.attendees :
    Array.isArray(e?.attendee_ids) ? e.attendee_ids :
    Array.isArray(e?.attendees_ids) ? e.attendees_ids :
    [];

  const interestedRaw =
    Array.isArray(e?.interestedIds) ? e.interestedIds :
    Array.isArray(e?.interested_ids) ? e.interested_ids :
    Array.isArray(e?.interested) ? e.interested :
    [];

  const cover =
    safeString(e?.image ?? e?.cover_url ?? e?.cover_image ?? e?.coverImage ?? e?.cover, '') || DEFAULT_EVENT_COVER;

  return {
    ...e,
    id,

    title: safeString(e?.title, 'Untitled Event'),
    description: safeString(e?.description, ''),
    location: safeString(e?.location, ''),

    date,
    time,

    image: cover,
    cover_url: cover,
    cover_image: cover,

    visibility: safeString(e?.visibility, 'worldwide') as any,

    organizerId: safeNumber(e?.organizerId ?? e?.creator_id ?? e?.user_id ?? 0),
    organizer_name: safeString(e?.organizer_name ?? e?.creator_name ?? ''),
    organizer_avatar: safeString(e?.organizer_avatar ?? e?.creator_avatar ?? ''),

    attendees: safeArray(attendeesRaw).map(Number).filter(Number.isFinite),
    interestedIds: safeArray(interestedRaw).map(Number).filter(Number.isFinite),

    event_date: toISO(rawEventDate),
    event_time: time,

    created_at: safeString(e?.created_at ?? e?.createdAt ?? '', new Date().toISOString()),
    
    group_id: e?.group_id ? safeNumber(e.group_id) : null,
    user_rsvp_status: e?.user_rsvp_status ?? null,
  } as any;
};

/** Normalize story data */
const normalizeStory = (s: any, existingUser?: User): Story => {
  const resolvedId = safeNumber(s?.id ?? s?.story_id ?? 0);
  const userId = safeNumber(s?.user_id ?? s?.userId ?? 0);
  
  let storyUser = s?.user;
  if (existingUser && storyUser) {
    storyUser = mergeUserSafe(existingUser, storyUser);
  }
  
  return {
    id: resolvedId,
    user_id: userId,
    type: (s?.type ?? 'image') as 'text' | 'image' | 'video',
    text_content: s?.text_content ?? s?.text ?? '',
    media_url: s?.media_url ?? s?.mediaUrl ?? '',
    background_style: s?.background_style ?? s?.backgroundStyle ?? '',
    music_url: s?.music_url ?? s?.musicUrl ?? '',
    music_title: s?.music_title ?? s?.musicTitle ?? '',
    created_at: s?.created_at ?? s?.createdAt ?? new Date().toISOString(),
    author_name: s?.author_name ?? s?.authorName ?? '',
    author_username: s?.author_username ?? s?.authorUsername ?? '',
    author_image: s?.author_image ?? s?.authorImage ?? '',
    username: s?.username ?? '',
    liked_by_me: Boolean(s?.liked_by_me ?? s?.likedByMe ?? false),
    user: storyUser,
    views: safeArray(s?.views),
    
    views_count: safeNumber(s?.views_count ?? s?.viewsCount, 0),
    reactions_count: safeNumber(s?.reactions_count ?? s?.reactionsCount, 0),
    my_reaction: s?.my_reaction ?? s?.myReaction ?? null,
    reaction_breakdown: s?.reaction_breakdown ?? {},
  } as any;
};

/**
 * Normalize user data with UNERA-style profile pictures
 */
const normalizeUser = (u: any): User => {
  const resolvedId = safeNumber(u?.id ?? u?.user_id ?? u?.userId);
  
  const incomingName = safeString(u?.name, '');
  const incomingUsername = safeString(u?.username, '');
  
  const hasValidIncomingName = !isBadName(incomingName);
  const hasValidIncomingUsername = !isBadName(incomingUsername);
  
  const userName = hasValidIncomingName ? incomingName : 
                   hasValidIncomingUsername ? incomingUsername : 
                   'User';

  const userUsername = hasValidIncomingUsername ? incomingUsername :
                       hasValidIncomingName ? userName.toLowerCase().replace(/\s+/g, '') :
                       'user';

  const colorIdentifier = resolvedId > 0 ? resolvedId : userName;

  const existingProfileImage = u?.profile_image_url ?? u?.avatar_url ?? u?.profileImage ?? '';
  let profileImageUrl = existingProfileImage;

  const shouldGenerateNewPicture =
    !profileImageUrl ||
    profileImageUrl.trim() === '' ||
    profileImageUrl.includes('ui-avatars.com/api/?name=User') ||
    profileImageUrl.includes('ui-avatars.com/api/?name=UNERA') ||
    profileImageUrl.includes('ui-avatars.com/api/?background=1877F2&color=fff') ||
    (profileImageUrl.includes('ui-avatars.com/api/?name=') && !profileImageUrl.includes('font-size=0.5'));

  if (shouldGenerateNewPicture) {
    profileImageUrl = generateProfilePictureUrl(userName, colorIdentifier);
  }

  const cover = typeof (u?.cover_image_url ?? u?.coverImage) === 'string'
    ? String(u?.cover_image_url ?? u?.coverImage).trim()
    : undefined;

  return {
    ...u,
    id: resolvedId,
    name: userName,
    username: userUsername,
    followers: safeArray<number>(u?.followers),
    following: safeArray<number>(u?.following),
    profile_image_url: profileImageUrl,
    cover_image_url: cover,
    is_verified: Boolean(u?.is_verified ?? u?.isVerified),
    role: u?.role ?? 'user',
    created_at: u?.created_at ?? u?.joined_date ?? u?.joinedDate ?? null,
  } as any;
};

/**
 * Normalize reel data
 */
const normalizeReel = (r: any): Reel => {
  const resolvedId = safeNumber(r?.id ?? r?.reel_id ?? 0);
  const userId = safeNumber(r?.user_id ?? r?.userId ?? 0);
  const soundKey = String(r?.sound_key ?? r?.soundKey ?? '');
  const isTrimmedAudio = soundKey.startsWith('trimmed:');
  const rawAudioStart = safeNumber(r?.audio_start ?? r?.audioStart ?? 0);
  const rawAudioEnd = safeNumber(r?.audio_end ?? r?.audioEnd ?? 0);
  const rawAudioUrl = safeString(r?.audio_url ?? r?.audioUrl ?? '');
  const audioStart = isTrimmedAudio ? 0 : rawAudioStart;
  const audioEnd = isTrimmedAudio ? 0 : rawAudioEnd;

  const videoLow = safeString(r?.video_url_low ?? r?.videoUrlLow ?? '');
  const videoMedium = safeString(r?.video_url_medium ?? r?.videoUrlMedium ?? r?.video_url ?? r?.videoUrl ?? '');
  const videoHd = safeString(r?.video_url_hd ?? r?.videoUrlHd ?? '');
  const videoMain = safeString(r?.video_url ?? r?.videoUrl ?? videoMedium ?? videoLow ?? '');

  const comments = safeArray(r?.comments).map((c: any) => ({
    ...c,
    id: safeNumber(c?.id ?? 0),
    reel_id: safeNumber(c?.reel_id ?? c?.reelId ?? resolvedId),
    user_id: safeNumber(c?.user_id ?? c?.userId ?? 0),
    parent_comment_id:
      c?.parent_comment_id == null && c?.parentId == null && c?.parent_id == null
        ? null
        : safeNumber(c?.parent_comment_id ?? c?.parentId ?? c?.parent_id ?? 0),
    text: String(c?.text ?? ''),
    image_url: c?.image_url ?? c?.imageUrl ?? '',
    created_at: c?.created_at ?? c?.createdAt ?? new Date().toISOString(),
  }));

  return {
    ...r,
    id: resolvedId,
    userId,
    user_id: userId,
    videoUrl: videoMain,
    video_url: videoMain,
    video_url_low: videoLow,
    video_url_medium: videoMedium,
    video_url_hd: videoHd,
    caption: safeString(r?.caption ?? ''),
    songName: safeString(r?.song_name ?? r?.songName ?? 'Original Sound'),
    song_name: safeString(r?.song_name ?? r?.songName ?? 'Original Sound'),
    audioUrl: rawAudioUrl,
    audio_url: rawAudioUrl,
    audioStart,
    audioEnd,
    audio_start: audioStart,
    audio_end: audioEnd,
    visibility: safeString(r?.visibility ?? 'public'),
    location: safeString(r?.location ?? ''),
    views: safeNumber(r?.views ?? r?.views_count ?? 0),
    shares: safeNumber(r?.shares ?? 0),
    songId: r?.song_id ?? r?.songId ?? null,
    soundKey,
    sound_key: soundKey,
    reactions: safeArray(r?.reactions),
    comments,
    created_at: r?.created_at ?? r?.createdAt ?? new Date().toISOString(),
    thumbnail_url: safeString(r?.thumbnail_url ?? r?.cover_url ?? ''),
    thumbnail: safeString(r?.thumbnail_url ?? r?.cover_url ?? ''),
    reactions_count: safeNumber(r?.reactions_count ?? safeArray(r?.reactions).length),
    comments_count: safeNumber(r?.comments_count ?? comments.length),
    author: r?.author || r?.author_name || '',
    author_name: r?.author_name || r?.author || '',
    avatar: r?.avatar || r?.avatar_url || r?.author_image || '',
    avatar_url: r?.avatar_url || r?.avatar || '',
    verified: !!(r?.verified || r?.is_verified),
    isTrimmedAudio,
    feed_key: `reel:${resolvedId}`,
  } as any;
};

/**
 * Normalize song data
 */
const normalizeSong = (s: any): Song => {
  return {
    ...s,
    id: s?.id ?? s?.song_id ?? 0,
    title: s?.title ?? s?.name ?? 'Unknown',
    artist: s?.artist ?? s?.artist_name ?? '',
    audio_url: s?.audio_url ?? s?.url ?? s?.file_url ?? '',
    audio_fetch_url: s?.audio_fetch_url ?? '',
    cover_url: s?.cover_url ?? s?.cover ?? DEFAULT_MUSIC_COVER,
    duration: s?.duration ?? 0,
    playCount: s?.playCount ?? s?.plays ?? 0,
    artistId: s?.artistId ?? s?.artist_id ?? 0,
    type: s?.type ?? 'music',
  } as any;
};

/**
 * Normalize product data
 */
const normalizeProduct = (p: any) => {
  let imgs: string[] = [];
  try {
    const parsed = typeof p?.images === "string" ? JSON.parse(p.images) : p.images;
    imgs = Array.isArray(parsed) ? parsed : [];
  } catch { imgs = []; }

  return {
    ...p,
    id: safeNumber(p?.id),
    seller_id: safeNumber(p?.seller_id),
    seller_name: safeString(p?.seller_name ?? p?.sellerName ?? "Seller"),
    seller_avatar: safeString(p?.seller_avatar ?? p?.sellerAvatar ?? ""),
    images: imgs.length ? imgs : [],
    main_price: safeNumber(p?.main_price),
    discount_price: p?.discount_price == null ? null : safeNumber(p?.discount_price),
    quantity: safeNumber(p?.quantity, 1),
    address: safeString(p?.address),
    title: safeString(p?.title),
    description: safeString(p?.description),
    category: safeString(p?.category),
    country: safeString(p?.country),
    phone_number: safeString(p?.phone_number ?? ""),
    created_at: p?.created_at ?? new Date().toISOString(),
  } as any;
};

// ============================================================================
// 🔧 Normalize groups
// ============================================================================
const normalizeGroup = (g: any): Group => {
  const id = safeNumber(g?.id ?? g?.group_id ?? g?.groupId);
  const name = safeString(g?.name, "Untitled Group");
  const description = safeString(g?.description, "");
  const type = String(g?.type || "public").toLowerCase() === "private" ? "private" : "public";
  
  const members =
    g?.members === undefined || g?.members === null
      ? undefined
      : safeArray(g.members).map(Number).filter(Number.isFinite);

  return {
    ...g,
    id,
    admin_id: safeNumber(g?.admin_id ?? g?.adminId ?? 0),
    name,
    description,
    type,
    category: (g?.category as any) || 'general',
    cover_image: safeString(g?.cover_image ?? g?.coverImage ?? ""),
    profile_image: safeString(g?.profile_image ?? g?.profileImage ?? ""),
    created_at: g?.created_at ?? new Date().toISOString(),
    members,
    posts: safeArray(g?.posts),
    events: safeArray(g?.events),
    member_posting_allowed: Boolean(g?.member_posting_allowed ?? true),
    members_count: safeNumber(g?.members_count ?? members?.length ?? 0),
    is_member: g?.is_member === true ? true : 
               g?.is_member === false ? false : 
               undefined,
  } as any;
};

/** ---------- Marketplace Context ---------- */
export const MarketplaceContext = React.createContext<{
  onViewProduct: (productId: number) => void;
  getProductData: (productId: number) => { 
    price: number; 
    location: string;
    currency?: string;
  } | null;
}>({
  onViewProduct: () => {},
  getProductData: () => null,
});

/** ✅ helper for JSON POST requests */
const postJSON = async (url: string, body: any) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}

  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}: ${url}`);
  }
  if (data?.success === false) {
    throw new Error(data?.error || `Request failed: ${url}`);
  }
  return data;
};

/** Optimistic reel reaction helper */
const applyOptimisticReelReaction = (r: any, reelId: number, type: ReactionType, meId: number) => {
  if (Number(r?.id) !== Number(reelId)) return r;

  const reactions = safeArray<any>(r?.reactions);
  const hasLiked = reactions.some((reaction: any) => 
    Number(reaction?.userId ?? reaction?.user_id) === Number(meId) && reaction?.type === type
  );

  let newReactions = [...reactions];
  
  if (hasLiked) {
    newReactions = newReactions.filter((reaction: any) => 
      !(Number(reaction?.userId ?? reaction?.user_id) === Number(meId) && reaction?.type === type)
    );
  } else {
    newReactions.push({ userId: meId, user_id: meId, type });
  }
  return {
    ...r,
    reactions: newReactions,
    likesCount: newReactions.length,
    reactions_count: newReactions.length,
  };
};

const isHttpUrl2 = (u: string) => u.startsWith('http://') || u.startsWith('https://');
const isBlobUrl = (u: string) => u.startsWith('blob:');
const isHttpsUrl = (u: string) => u.startsWith('https://');
const isAbsoluteUrl = (u: string) => isHttpsUrl(u) || isHttpUrl2(u) || isBlobUrl(u);

const ensureAbsoluteUrl = (u?: string | null): string => {
  if (!u) return '';
  if (isAbsoluteUrl(u)) return u;
  return `${window.location.origin}${u.startsWith('/') ? '' : '/'}${u}`;
};

const toFetchableAudioUrl = (u?: string | null): string => {
  const url = ensureAbsoluteUrl(u);
  if (!url) return '';

  if (isBlobUrl(url)) return url;

  if (isHttpUrl2(url) && window.location.protocol === 'https:') {
    return url.replace('http://', 'https://');
  }

  const USE_AUDIO_PROXY = true;

  if (USE_AUDIO_PROXY) {
    const isSameOrigin = (() => {
      try {
        return new URL(url).origin === window.location.origin;
      } catch {
        return false;
      }
    })();

    if (!isSameOrigin) {
      try {
        const host = new URL(url).hostname;
        if (host === 'media.unera.social') {
          return `/api/proxy-audio?url=${encodeURIComponent(url)}`;
        }
      } catch {}
    }
  }

  return url;
};

const toBlobUrl = async (remoteUrl: string): Promise<string> => {
  try {
    const fetchableUrl = toFetchableAudioUrl(remoteUrl);
    const res = await fetch(fetchableUrl);
    if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Failed to create blob URL:', error);
    throw new Error(`Could not load audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

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
    const res = await fetch(url, { ...options, headers, signal: controller.signal });

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

const fetchUserFollowData = async (userId: number): Promise<{ followers: number[], following: number[] }> => {
  try {
    const data = await apiFetch(`/api/user-follows/list?userId=${userId}`);
    return {
      followers: safeArray<number>(data?.followers),
      following: safeArray<number>(data?.following)
    };
  } catch (error) {
    console.error('Failed to fetch follow data:', error);
    return { followers: [], following: [] };
  }
};

const uploadToCloudflareR2 = async (file: File, folder = 'posts'): Promise<{ url: string; type: string; filename: string }> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    formData.append('type', file.type);
    formData.append('folder', folder);
    formData.append('timestamp', Date.now().toString());

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }

    const result = await response.json();
    if (!result.url) throw new Error('No URL returned from upload');

    return { url: result.url, type: file.type, filename: file.name };
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};

const ensureR2Url = async (input: any, folder: string, fallbackName: string) => {
  if (!input) return '';

  if (typeof input === 'string' && isAbsoluteUrl(input)) {
    return input;
  }

  if (typeof input === 'string' && isBlobUrl(input)) {
    try {
      const res = await fetch(input);
      if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`);
      
      const blob = await res.blob();
      
      const fileType = folder.includes('audio') ? blob.type || 'audio/wav' : 'application/octet-stream';
      const fileName = folder.includes('audio') ? 
        `audio-${Date.now()}.${fileType.split('/')[1] || 'wav'}` : 
        fallbackName;
      
      const file = new File([blob], fileName, { type: fileType });
      const up = await uploadToCloudflareR2(file, folder);
      return up.url;
    } catch (error) {
      console.error('Failed to process blob URL:', error);
      throw new Error('Failed to process audio file');
    }
  }

  if (typeof File !== 'undefined' && input instanceof File) {
    if (folder.includes('audio') && !input.type) {
      const fileType = 'audio/wav';
      const fileName = `audio-${Date.now()}.wav`;
      const newFile = new File([input], fileName, { type: fileType });
      const up = await uploadToCloudflareR2(newFile, folder);
      return up.url;
    }
    const up = await uploadToCloudflareR2(input, folder);
    return up.url;
  }

  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    const fileType = folder.includes('audio') ? input.type || 'audio/wav' : 'application/octet-stream';
    const fileName = folder.includes('audio') ? 
      `audio-${Date.now()}.${fileType.split('/')[1] || 'wav'}` : 
      fallbackName;
    
    const file = new File([input], fileName, { type: fileType });
    const up = await uploadToCloudflareR2(file, folder);
    return up.url;
  }

  return '';
};

type ReelSound = {
  songName: string;
  audioUrl: string;
  audioStart?: number;
  audioEnd?: number;
  songId?: string | number;
  soundKey?: string;
  isTrimmedAudio?: boolean;
  originalUrl?: string;
};
  type UseSoundPayload = {
  songName?: string;
  audioUrl?: string;
  originalUrl?: string;
  audioStart?: number;
  audioEnd?: number;
  songId?: string | number;
  soundKey?: string;
  isTrimmedAudio?: boolean;
};

export type View =
  | 'home'
  | 'reels'
  | 'marketplace'
  | 'groups'
  | 'brands'
  | 'music'
  | 'tools'
  | 'profiles'
  | 'events'
  | 'birthdays'
  | 'memories'
  | 'settings'
  | 'privacy'
  | 'terms'
  | 'help'
  | 'profile'
  | 'login'
  | 'register'
  | 'recorder'
  | 'notifications'
  | 'ads';

const normalizeFeedRowToPost = (row: any): PostType => {
  return normalizePost({
    ...row,
    user_id: safeNumber(row?.user_id),
    content: row?.content ?? '',
    created_at: row?.created_at,
    media_url: row?.media_url ?? null,
    media_type: row?.media_type ?? null,
    shares: row?.shares ?? 0,
    views: row?.views ?? 0,
    pool: row?.pool,
    follower_count: row?.follower_count,
  });
};

const authorFromFeedRow = (row: any): User => {
  const username = row?.username ?? 'user';
  const name = row?.username ?? 'User';

  return normalizeUser({
    id: row?.user_id,
    username,
    name,
    profile_image_url: row?.profile_image_url ?? '',
    is_verified: row?.is_verified ?? 0,
    role: row?.role ?? 'user',
    followers: [],
    following: [],
    created_at: row?.joined_date ?? row?.created_at ?? null,
  });
};

const mergeFeed = (prev: PostType[], incoming: PostType[]): PostType[] => {
  const map = new Map<number, PostType>();
  prev.forEach((p: any) => map.set(Number(p.id), p));

  incoming.forEach((p: any) => {
    const existing = map.get(Number(p.id));
    if (existing) {
      map.set(Number(p.id), {
        ...existing,
        ...p,
        reactions: (existing as any).reactions,
        shares: Math.max((existing as any).shares || 0, (p as any).shares || 0),
        comments_count: Math.max((existing as any).comments_count || 0, (p as any).comments_count || 0),
      } as any);
    } else {
      map.set(Number(p.id), p);
    }
  });

  const prevIds = new Set(prev.map((p: any) => Number(p.id)));
  const newOnes = incoming.filter((p: any) => !prevIds.has(Number(p.id)));

  return [...newOnes, ...prev.map((p: any) => map.get(Number(p.id))!).filter(Boolean)];
};

const createFallbackUser = (): User => {
  const fallbackName = 'User';
  const fallbackId = 0;
  return {
    id: fallbackId,
    username: 'user',
    name: fallbackName,
    email: '',
    profile_image_url: generateProfilePictureUrl(fallbackName, fallbackId),
    cover_image_url: '',
    followers: [],
    following: [],
    is_verified: false,
    role: 'user',
    is_online: false,
    location: '',
    bio: '',
    created_at: null,
  };
};

const authHeaders = () => {
  const token = localStorage.getItem('unera_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}

async function apiPost(endpoint: string, body?: any) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : '{}',
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.error || data?.message || `API ${res.status}`);
  return data?.data ?? data;
}

async function recordPlay(track: AudioTrack, userId: any) {
  const id = String(track.id);

  if (track.type === 'music') {
    try {
      return await apiPost(`/api/songs/${encodeURIComponent(id)}/play`, { user_id: userId ?? null });
    } catch {
      return await apiPost(`/api/song-plays`, { song_id: id, user_id: userId ?? null });
    }
  }

  if (track.type === 'podcast') {
    try {
      return await apiPost(`/api/podcasts/${encodeURIComponent(id)}/play`, { user_id: userId ?? null });
    } catch {
      return await apiPost(`/api/podcast-episode-plays`, { episode_id: id, user_id: userId ?? null });
    }
  }

  return null;
}

// ============================================================================
// ✅ REEL FEED INTEGRATION
// ============================================================================

const shuffleArray = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export default function App() {
  useLanguage();

  /** ---------- State ---------- */
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [pushedPosts, setPushedPosts] = useState<Record<number, boolean>>({});
  const [profilePosts, setProfilePosts] = useState<PostType[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [chats, setChats] = useState<any[]>([]);

  const [songs, setSongs] = useState<Song[]>([]);
  
  const [selectedReelSound, setSelectedReelSound] = useState<ReelSound | null>(null);

  const [activeStoryId, setActiveStoryId] = useState<number | null>(null);
  const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'reels' | 'marketplace' | 'groups'>('home');
  const [view, setView] = useState<View>('home');
  const [selectedReelId, setSelectedReelId] = useState<number | string | null>(null);

  // Navigation history state
  const [navigationHistory, setNavigationHistory] = useState<View[]>(['home']);

  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatsListOpen, setIsChatsListOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [pendingReelFile, setPendingReelFile] = useState<File | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reelVideoInputRef = useRef<HTMLInputElement>(null);

  // ===== NOTIFICATION & AD STATES =====
  const [notifications, setNotifications] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [showAdAnalytics, setShowAdAnalytics] = useState(false);
  const [adAnalyticsId, setAdAnalyticsId] = useState<number | null>(null);

  // AD DASHBOARD STATE
  const [adCampaigns, setAdCampaigns] = useState<any[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [activeAdTab, setActiveAdTab] = useState<'dashboard' | 'create' | 'ads' | 'analytics'>('dashboard');
  
  const [selectedPostForAd, setSelectedPostForAd] = useState<PostType | null>(null);

  // ============================================================================
  // ✅ REACTION LOCK STATE
  // ============================================================================
  const [reactingMap, setReactingMap] = useState<Record<string, boolean>>({});
  const setReacting = useCallback((identity: string, value: boolean) => {
    setReactingMap(prev => ({ ...prev, [identity]: value }));
  }, []);

  // ============================================================================
  // ✅ COMMENTS IDENTITY STATE
  // ============================================================================
  const [activeCommentsIdentity, setActiveCommentsIdentity] = useState<string | null>(null);
  const [commentPostSnapshot, setCommentPostSnapshot] = useState<PostType | null>(null);

  // ============================================================================
  // ✅ People You May Know - State declarations
  // ============================================================================
  const [peopleYouMayKnow, setPeopleYouMayKnow] = useState<PeopleSuggestion[]>([]);
  const [pymkLoading, setPymkLoading] = useState(false);
  const [pymkHydrated, setPymkHydrated] = useState(false);

  const [pymkHiddenIds, setPymkHiddenIds] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(PYMK_HIDDEN_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
    } catch {
      return [];
    }
  });

  // ============================================================================
  // ✅ Groups You May Join - State declarations
  // ============================================================================
  const [groupsYouMayJoin, setGroupsYouMayJoin] = useState<GroupSuggestion[]>([]);
  const [gymjLoading, setGymjLoading] = useState(false);
  const [gymjHydrated, setGymjHydrated] = useState(false);

  const [gymjHiddenIds, setGymjHiddenIds] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(GROUPS_YOU_MAY_JOIN_HIDDEN_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
    } catch {
      return [];
    }
  });

  const [feedHydrated, setFeedHydrated] = useState(false);
  const [isFeedRefreshing, setIsFeedRefreshing] = useState(false);
  
  const [authHydrated, setAuthHydrated] = useState(false);

  const lastGoodPostsRef = useRef<PostType[]>([]);
  const stableFeedRef = useRef<PostType[]>([]);
  const scheduleSilentRefreshRef = useRef<any>(null);

  const [loginError, setLoginError] = useState('');

  const unreadNotifications = notifications.filter(n => !n.is_read).length;

  const requireAuth = useCallback(
    (actionName = 'This action') => {
      if (currentUser) return true;
      setLoginError(`${actionName} requires login.`);
      setView('login');
      return false;
    },
    [currentUser]
  );

  const usersRef = useRef<User[]>([]);
  const storiesInFlightRef = useRef(false);
  const reelsInFlightRef = useRef(false);
  const postsInFlightRef = useRef(false);
  const usersInFlightRef = useRef(false);
  const otherDataInFlightRef = useRef(false);
  
  const reelsRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const [seenStoryIds, setSeenStoryIds] = useState<Set<number>>(() => new Set(readStorySeen()));
  const [storyMuted, setStoryMuted] = useState(true);

  const markStorySeen = useCallback((storyId: number) => {
    const id = Number(storyId);
    if (!id) return;

    setSeenStoryIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      writeStorySeen(Array.from(next));
      return next;
    });
  }, []);

  const orderedStories = useMemo(() => {
    const list = safeArray(stories);

    const scoreStory = (s: any) => {
      const isMine = currentUser && Number(s.user_id) === Number(currentUser.id);
      const unseen = !seenStoryIds.has(Number(s.id));
      
      const mineBoost = isMine ? 100 : 0;
      const unseenBoost = unseen ? 50 : 0;
      
      const t = new Date(s.created_at || 0).getTime() || 0;
      const recencyFactor = t / 1e13;
      
      const isFollowing = currentUser && safeArray<number>(currentUser.following).includes(Number(s.user_id));
      const followBoost = isFollowing ? 30 : 0;
      
      return mineBoost + unseenBoost + followBoost + recencyFactor;
    };

    return [...list].sort((a, b) => scoreStory(b) - scoreStory(a));
  }, [stories, seenStoryIds, currentUser]);

  const preloadStoryMedia = useCallback((s: Story) => {
    const url = String(s?.media_url || '');
    if (!url) return;

    if (s.type === 'image') {
      const img = new Image();
      img.src = url;
      return;
    }

    if (s.type === 'video') {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = url;
      return;
    }
  }, []);

  const activeStory = useMemo(() => {
    if (!activeStoryId) return null;
    return orderedStories.find(s => Number(s.id) === Number(activeStoryId)) || null;
  }, [activeStoryId, orderedStories]);

  const closeStoryViewer = useCallback(() => {
    setActiveStoryId(null);
  }, []);

  const getNextStory = useCallback((current: Story | null) => {
    if (!current) return null;
    const list = orderedStories;
    const idx = list.findIndex(s => Number(s.id) === Number(current.id));
    if (idx < 0) return null;
    return list[idx + 1] || null;
  }, [orderedStories]);

  const goNextStory = useCallback(() => {
    setActiveStoryId(prevId => {
      if (!prevId) return null;
      const currentStory = orderedStories.find(s => Number(s.id) === Number(prevId));
      if (!currentStory) return null;
      
      const next = getNextStory(currentStory);
      if (next) {
        markStorySeen(Number(next.id));
        return Number(next.id);
      }
      return null;
    });
  }, [getNextStory, markStorySeen, orderedStories]);

  const goPrevStory = useCallback(() => {
    setActiveStoryId(prevId => {
      if (!prevId) return null;
      const list = orderedStories;
      const idx = list.findIndex(s => Number(s.id) === Number(prevId));
      if (idx <= 0) return null;
      
      const prev = list[idx - 1];
      if (prev) {
        markStorySeen(Number(prev.id));
        return Number(prev.id);
      }
      return null;
    });
  }, [orderedStories, markStorySeen]);

  const handleStoryNext = useCallback(() => {
    if (!activeStoryId) return;
    
    const list = orderedStories;
    const idx = list.findIndex(s => Number(s.id) === Number(activeStoryId));
    
    if (idx >= list.length - 1) {
      closeStoryViewer();
      return;
    }
    
    const next = list[idx + 1];
    if (next) {
      setActiveStoryId(next.id);
      markStorySeen(next.id);
      preloadStoryMedia(next);
    }
  }, [activeStoryId, orderedStories, closeStoryViewer, markStorySeen, preloadStoryMedia]);

  const handleStoryPrev = useCallback(() => {
    if (!activeStoryId) return;
    
    const list = orderedStories;
    const idx = list.findIndex(s => Number(s.id) === Number(activeStoryId));
    
    if (idx <= 0) {
      closeStoryViewer();
      return;
    }
    
    const prev = list[idx - 1];
    if (prev) {
      setActiveStoryId(prev.id);
      markStorySeen(prev.id);
      preloadStoryMedia(prev);
    }
  }, [activeStoryId, orderedStories, closeStoryViewer, markStorySeen, preloadStoryMedia]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  
  const handleActiveReelConsumed = useCallback(() => {
    setSelectedReelId(null);
  }, []);
  
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activeEventId, setActiveEventId] = useState<number | null>(null);

  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showCreateReelModal, setShowCreateReelModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);

  const [activeSharePost, setActiveSharePost] = useState<any>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareInProgress, setShareInProgress] = useState(false);

  const [followLoading, setFollowLoading] = useState<{ [key: number]: boolean }>({});

  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);

  const [currentAudioTrack, setCurrentAudioTrack] = useState<AudioTrack | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [playHistory, setPlayHistory] = useState<AudioTrack[]>([]);
  const [likedTracks, setLikedTracks] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('unera_liked_tracks') || '[]');
    } catch {
      return [];
    }
  });
  const [trackPlays, setTrackPlays] = useState<Record<string, number>>({});
  const [myTotalPlays, setMyTotalPlays] = useState<number>(() => {
    try {
      const rawUser = localStorage.getItem(LS_USER_KEY);
      let uid = 0;
      try { 
        const user = JSON.parse(rawUser || '{}');
        uid = Number(user?.id || 0); 
      } catch {}
      
      const key = uid ? `unera_my_total_plays_${uid}` : 'unera_my_total_plays';
      const v = Number(localStorage.getItem(key) || 0);
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  });
  
  const [playsLoading, setPlaysLoading] = useState(false);

  const lastPlayedKeyRef = useRef<string>('');

  useEffect(() => {
    localStorage.setItem('unera_liked_tracks', JSON.stringify(likedTracks));
  }, [likedTracks]);

  useEffect(() => {
    if (!currentUser?.id) return;
    
    const key = `unera_my_total_plays_${Number(currentUser.id)}`;
    localStorage.setItem(key, String(myTotalPlays));
    
    localStorage.setItem('unera_my_total_plays', String(myTotalPlays));
  }, [myTotalPlays, currentUser?.id]);

  // Incoming call polling effect
  useEffect(() => {
    if (!currentUser?.id) return;

    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/ringtone.mp3');
      audioRef.current.loop = true;
    }

    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/calls/incoming?user_id=${currentUser.id}`);
        const call = res?.call;

        if (call?.id && call?.status === "ringing") {
          setIncomingCall(call);
          
          if (audioRef.current) {
            audioRef.current.play().catch(e => console.log('Ringtone play failed:', e));
          }
        }
      } catch (error) {
        console.debug('Call polling error:', error);
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [currentUser]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;

    try {
      const res = await fetch("/api/notifications", {
        headers: {
          "x-user-id": String(currentUser.id)
        }
      });

      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed loading notifications", err);
    }
  }, [currentUser]);

  // Mark notifications as read
  const markNotificationsRead = async () => {
    if (!currentUser) return;

    await fetch("/api/notifications/read", {
      method: "POST",
      headers: {
        "x-user-id": String(currentUser.id)
      }
    });
  };

  // Auto refresh notifications
  useEffect(() => {
    if (!currentUser) return;

    fetchNotifications();

    const interval = setInterval(fetchNotifications, 20000);

    return () => clearInterval(interval);
  }, [currentUser, fetchNotifications]);

  // Fetch ads
  const fetchAds = useCallback(async () => {
    try {
      const res = await fetch("/api/ads/feed");
      const data = await res.json();
      setAds(data.ads || []);
    } catch (err) {
      console.error("Ads fetch error", err);
    }
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const openAdAnalytics = (adId: number) => {
    setAdAnalyticsId(adId);
    setShowAdAnalytics(true);
  };

  const openChatWith = useCallback((userId: number) => {
    const recipient = users.find(u => Number(u.id) === Number(userId));
    if (recipient) {
      setActiveChatUser(recipient);
      setIsChatOpen(true);
    }
  }, [users]);

  // ============================================================================
  // ✅ PYMK Helpers
  // ============================================================================
  const persistPymkHidden = useCallback((ids: number[]) => {
    const dedup = Array.from(new Set(ids.map(Number).filter(Number.isFinite))).slice(0, 2000);
    setPymkHiddenIds(dedup);
    try {
      localStorage.setItem(PYMK_HIDDEN_KEY, JSON.stringify(dedup));
    } catch {}
  }, []);

  const hidePymkUser = useCallback((userId: number) => {
    const id = Number(userId);
    if (!id) return;

    setPeopleYouMayKnow(prev => prev.filter(u => Number(u.id) !== id));
    persistPymkHidden([id, ...pymkHiddenIds]);
  }, [persistPymkHidden, pymkHiddenIds]);

  // PYMK Fetch
  const fetchPeopleYouMayKnow = useCallback(async () => {
    if (!currentUser?.id) {
      setPeopleYouMayKnow([]);
      return;
    }

    if (!pymkHydrated) setPymkLoading(true);

    try {
      const data = await apiFetch(`/api/suggestions?user_id=${currentUser.id}&limit=20`);
      const raw = safeArray<any>(data?.suggestions ?? data);
      const hiddenSet = new Set(pymkHiddenIds.map(Number));

      const normalized: PeopleSuggestion[] = raw
        .map((u: any) => ({
          id: safeNumber(u?.id ?? u?.user_id),
          username: safeString(u?.username),
          name: safeString(u?.name || u?.username || "User"),
          profile_image_url: safeString(u?.profile_image_url || ""),
          is_verified: !!u?.is_verified,
          role: safeString(u?.role || "user"),
          mutual_count: safeNumber(u?.mutual_count, 0),
          is_following: !!u?.is_following,
          score: safeNumber(u?.score, 0),
        }))
        .filter((u: PeopleSuggestion) => u.id > 0)
        .filter((u: PeopleSuggestion) => !hiddenSet.has(Number(u.id)));

      setPeopleYouMayKnow(normalized);
      setPymkHydrated(true);
    } catch (error) {
      console.warn('Failed to fetch People You May Know:', error);
      setPeopleYouMayKnow([]);
    } finally {
      setPymkLoading(false);
    }
  }, [currentUser, pymkHiddenIds]);

  // PYMK Effect
  useEffect(() => {
    if (!currentUser?.id) return;
    fetchPeopleYouMayKnow();
  }, [currentUser?.id, pymkHiddenIds]);

  // ============================================================================
  // ✅ Groups You May Join - Helpers
  // ============================================================================
  const persistGymjHidden = useCallback((ids: number[]) => {
    const dedup = Array.from(new Set(ids.map(Number).filter(Number.isFinite))).slice(0, 2000);
    setGymjHiddenIds(dedup);
    try {
      localStorage.setItem(GROUPS_YOU_MAY_JOIN_HIDDEN_KEY, JSON.stringify(dedup));
    } catch {}
  }, []);

  const hideGroupSuggestion = useCallback((groupId: number) => {
    const id = Number(groupId);
    if (!id) return;

    setGroupsYouMayJoin(prev => prev.filter(g => Number(g.id) !== id));
    persistGymjHidden([id, ...gymjHiddenIds]);
  }, [persistGymjHidden, gymjHiddenIds]);

  // Groups You May Join - Fetch
  const fetchGroupsYouMayJoin = useCallback(async () => {
    if (!currentUser?.id) {
      setGroupsYouMayJoin([]);
      return;
    }

    if (!gymjHydrated) setGymjLoading(true);

    try {
      const data = await apiFetch(`/api/group-suggestions?user_id=${currentUser.id}&limit=12`);
      const raw = safeArray<any>(data?.groups ?? data);
      const hiddenSet = new Set(gymjHiddenIds.map(Number));

      const normalized: GroupSuggestion[] = raw
        .map((g: any) => ({
          id: safeNumber(g?.id),
          admin_id: safeNumber(g?.admin_id),
          name: safeString(g?.name, "Untitled Group"),
          description: safeString(g?.description),
          type: g?.type === "private" ? "private" : "public",
          cover_image: safeString(g?.cover_image),
          profile_image: safeString(g?.profile_image),
          created_at: safeString(g?.created_at),
          category: safeString(g?.category, "general"),
          members_count: safeNumber(g?.members_count, 0),
          mutual_count: safeNumber(g?.mutual_count, 0),
          is_member: !!g?.is_member,
          score: safeNumber(g?.score, 0),
        }))
        .filter((g: GroupSuggestion) => g.id > 0)
        .filter((g: GroupSuggestion) => !hiddenSet.has(Number(g.id)));

      setGroupsYouMayJoin(normalized);
      setGymjHydrated(true);
    } catch (error) {
      console.warn('Failed to fetch Groups You May Join:', error);
      setGroupsYouMayJoin([]);
    } finally {
      setGymjLoading(false);
    }
  }, [currentUser, gymjHiddenIds]);

  // Groups You May Join - Effect
  useEffect(() => {
    if (!currentUser?.id) return;
    fetchGroupsYouMayJoin();
  }, [currentUser?.id, gymjHiddenIds]);

  const resolveTrackOwner = useCallback((track: any): User | null => {
    if (!track) return null;

    const ownerId =
      safeNumber(track.user_id ?? track.owner_user_id ?? track.artist_user_id ?? track.creator_id ?? 0, 0);

    if (ownerId) {
      const found = users.find((u) => Number(u.id) === Number(ownerId));
      if (found) return found;
    }

    if (track?.owner && (track.owner.id || track.owner.user_id)) {
      return normalizeUser(track.owner);
    }

    return null;
  }, [users]);

  const fetchMyTotalPlays = useCallback(async (userId: number) => {
    if (!userId) return myTotalPlays;

    const cacheKey = `unera_my_total_plays_${userId}`;

    const cached = (() => {
      try {
        const v = Number(localStorage.getItem(cacheKey) || localStorage.getItem('unera_my_total_plays') || 0);
        return Number.isFinite(v) ? v : 0;
      } catch {
        return 0;
      }
    })();

    setPlaysLoading(true);
    try {
      const totalRes = await apiFetch(`/api/user-plays/total?userId=${userId}`);
      const total = safeNumber(totalRes?.total, NaN);

      if (Number.isFinite(total) && total > 0) {
        setMyTotalPlays(total);
        localStorage.setItem(cacheKey, String(total));
        return total;
      }

      throw new Error('Invalid total from API');
    } catch {
      try {
        const [s, p] = await Promise.all([
          apiFetch(`/api/song-plays/total?userId=${userId}`).catch(() => ({ total: NaN })),
          apiFetch(`/api/podcast-episode-plays/total?userId=${userId}`).catch(() => ({ total: NaN })),
        ]);
        
        const sTotal = safeNumber(s?.total, NaN);
        const pTotal = safeNumber(p?.total, NaN);

        if (Number.isFinite(sTotal) || Number.isFinite(pTotal)) {
          const total = (Number.isFinite(sTotal) ? sTotal : 0) + (Number.isFinite(pTotal) ? pTotal : 0);
          setMyTotalPlays(total);
          localStorage.setItem(cacheKey, String(total));
          return total;
        }

        setMyTotalPlays(cached);
        return cached;
      } catch {
        setMyTotalPlays(cached);
        return cached;
      }
    } finally {
      setPlaysLoading(false);
    }
  }, [myTotalPlays]);

  const fetchSongs = useCallback(async () => {
    try {
      const data = await apiFetch('/api/songs');
      const list = Array.isArray(data) ? data : (data?.songs ?? data?.data ?? []);
      
      const normalized = list
        .map((song) => {
          const s = normalizeSong(song);
          const raw = ensureAbsoluteUrl(s.audio_url);
          const fetchable = toFetchableAudioUrl(raw);

          return {
            ...s,
            audio_url: raw,
            audio_fetch_url: fetchable,
          } as any;
        })
        .filter((x: any) => x.audio_url);
      
      setSongs(normalized);
    } catch (e) {
      console.error('Failed to fetch songs:', e);
    }
  }, []);

  const fetchStories = useCallback(async () => {
    if (storiesInFlightRef.current) return;
    storiesInFlightRef.current = true;
    
    try {
      const cached = readStoriesCache();
      if (cached?.stories?.length) {
        const cachedList = cached.stories;
        setStories(prev => (prev.length ? prev : cachedList.map(s => normalizeStory(s))));
      }

      const viewerId = currentUser?.id || 0;
      const data = await apiFetch(`/api/stories?viewerId=${viewerId}`);
      const storiesList = safeArray(data?.stories ?? data);
      
      writeStoriesCache(storiesList);
      
      const prevUsers = usersRef.current;

      const map = new Map<number, User>();
      prevUsers.forEach(u => map.set(Number(u.id), u));

      const normalizedStories = storiesList.map((story: any) => {
        const uid = Number(story.user_id);
        const existing = map.get(uid);
        const st = normalizeStory(story, existing);

        if (st.user) {
          const incoming = normalizeUser(st.user);
          const cur = map.get(uid);
          map.set(uid, cur ? normalizeUser(mergeUserSafe(cur, incoming)) : incoming);
        }
        return st;
      });

      setStories(prev => {
        const map = new Map<number, Story>();
        safeArray(prev).forEach(st => map.set(Number(st.id), st));

        return normalizedStories.map(ns => {
          const old = map.get(Number(ns.id));
          if (!old) return ns;

          return {
            ...old,
            ...ns,
            liked_by_me: ns.liked_by_me ?? old.liked_by_me,
            my_reaction: ns.my_reaction ?? old.my_reaction,
            views_count: ns.views_count ?? old.views_count,
            reactions_count: ns.reactions_count ?? old.reactions_count,
          };
        });
      });
      
      setUsers(Array.from(map.values()));
      
    } catch (error) {
      console.error('Failed to fetch stories:', error);
    } finally {
      storiesInFlightRef.current = false;
    }
  }, [currentUser]);

  const fetchStoryViewers = useCallback(async (storyId: number) => {
    const cached = readViewersCache(storyId);
    if (cached) return cached;

    try {
      const data = await apiFetch(`/api/stories/${storyId}/viewers?limit=200`)
      const viewers = safeArray(data?.viewers ?? data);
      
      const formattedViewers = viewers.map((v: any) => ({
        id: v.id,
        story_id: v.story_id,
        user_id: v.user_id,
        viewed_at: v.viewed_at,
        reaction: v.reaction ?? null,
        user: normalizeUser({
          id: v.user_id,
          username: v.username,
          name: v.name,
          profile_image_url: v.profile_image_url,
          is_verified: v.is_verified,
          role: v.role,
        }),
      }));

      writeViewersCache(storyId, formattedViewers);
      return formattedViewers;
    } catch (error) {
      console.error('Failed to fetch story viewers:', error);
      return [];
    }
  }, []);

  const fetchStoryAnalytics = useCallback(async (storyId: number) => {
    try {
      const data = await apiFetch(`/api/stories/${storyId}/analytics`);
      return {
        total_views: safeNumber(data?.total_views, 0),
        unique_viewers: safeNumber(data?.unique_viewers, 0),
        views_with_reactions: safeNumber(data?.views_with_reactions, 0),
        reaction_breakdown: data?.reaction_breakdown || {},
        completion_rate: safeNumber(data?.completion_rate, 0),
        average_view_time: safeNumber(data?.average_view_time, 0),
      };
    } catch (error) {
      console.error('Failed to fetch story analytics:', error);
      return {
        total_views: 0,
        unique_viewers: 0,
        views_with_reactions: 0,
        reaction_breakdown: {},
        completion_rate: 0,
        average_view_time: 0,
      };
    }
  }, []);

  const viewStory = useCallback(async (storyId: number) => {
    if (!requireAuth('Viewing stories')) return;
    if (!currentUser) return;

    setStories(prev =>
      prev.map(story => {
        if (Number(story.id) !== Number(storyId)) return story;
        
        return {
          ...story,
          views_count: (story.views_count || 0) + 1,
        };
      })
    );

    try {
      const res = await apiFetch(`/api/stories/${storyId}/view`, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.id }),
      });

      if (res?.views_count !== undefined) {
        setStories(prev =>
          prev.map(story => {
            if (Number(story.id) !== Number(storyId)) return story;
            
            return {
              ...story,
              views_count: Number(res.views_count ?? story.views_count),
            };
          })
        );
      }
    } catch (error) {
      console.error('Failed to record story view:', error);
    }
  }, [currentUser, requireAuth]);

  const openStoryViewer = useCallback((story: Story) => {
    const id = Number(story?.id);
    if (!id) return;

    setActiveStoryId(id);

    if (currentUser) {
      viewStory(id);
    }

    markStorySeen(id);

    preloadStoryMedia(story);
    const next = (() => {
      const idx = orderedStories.findIndex(x => Number(x.id) === id);
      return idx >= 0 ? orderedStories[idx + 1] : null;
    })();
    if (next) preloadStoryMedia(next);
  }, [currentUser, viewStory, markStorySeen, preloadStoryMedia, orderedStories]);

  const likeStory = useCallback(async (storyId: number) => {
    if (!requireAuth('Liking stories')) return;
    if (!currentUser) return;

    setStories(prev =>
      prev.map(story => {
        if (Number(story.id) !== Number(storyId)) return story;
        
        const currentlyLiked = story.liked_by_me;
        
        return {
          ...story,
          liked_by_me: !currentlyLiked,
          my_reaction: !currentlyLiked ? 'like' : null,
          reactions_count: currentlyLiked 
            ? Math.max(0, (story.reactions_count || 0) - 1)
            : (story.reactions_count || 0) + 1,
        };
      })
    );

    try {
      const response = await apiFetch(`/api/stories/${storyId}/react`, {
        method: 'POST',
        body: JSON.stringify({ 
          user_id: currentUser.id, 
          reaction: 'like' 
        }),
      });

      if (response?.story) {
        const updatedStory = normalizeStory(response.story, currentUser);
        
        setStories(prev =>
          prev.map(story => {
            if (Number(story.id) !== Number(storyId)) return story;
            
            return {
              ...story,
              liked_by_me: updatedStory.my_reaction === 'like',
              my_reaction: updatedStory.my_reaction,
              reactions_count: updatedStory.reactions_count,
            };
          })
        );
      }

    } catch (error) {
      console.error('Failed to like story:', error);
    }
  }, [currentUser, requireAuth]);

  const reactToStory = useCallback(async (storyId: number, reaction: string) => {
    if (!requireAuth('Reacting to stories')) return;
    if (!currentUser) return;

    setStories(prev =>
      prev.map(story => {
        if (Number(story.id) !== Number(storyId)) return story;
        
        const currentReaction = story.my_reaction;
        const isSameReaction = currentReaction === reaction;
        
        return {
          ...story,
          my_reaction: isSameReaction ? null : reaction,
          reactions_count: isSameReaction 
            ? Math.max(0, (story.reactions_count || 0) - 1)
            : (story.reactions_count || 0) + 1,
          liked_by_me: isSameReaction ? false : true,
        };
      })
    );

    try {
      const response = await apiFetch(`/api/stories/${storyId}/react`, {
        method: 'POST',
        body: JSON.stringify({ 
          user_id: currentUser.id, 
          reaction: reaction 
        }),
      });

      if (response?.story) {
        const updatedStory = normalizeStory(response.story, currentUser);
        
        setStories(prev =>
          prev.map(story => {
            if (Number(story.id) !== Number(storyId)) return story;
            
            return {
              ...story,
              my_reaction: updatedStory.my_reaction,
              reactions_count: updatedStory.reactions_count,
              reaction_breakdown: updatedStory.reaction_breakdown || {},
              liked_by_me: Boolean(updatedStory.my_reaction),
            };
          })
        );
      }

    } catch (error) {
      console.error('Failed to react to story:', error);
    }
  }, [currentUser, requireAuth]);

  const replyToStory = useCallback(async (storyId: number, text: string) => {
    if (!requireAuth('Replying to stories')) return;
    if (!currentUser) return;

    try {
      await apiFetch(`/api/stories/${storyId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ 
          user_id: currentUser.id, 
          text: text 
        }),
      });

      const toast = document.createElement('div');
      toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1877F2] text-white px-6 py-2 rounded-full font-bold shadow-lg animate-fade-in z-[300]';
      toast.innerText = 'Reply sent!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);

    } catch (error) {
      console.error('Failed to reply to story:', error);
      setLoginError('Failed to send reply');
    }
  }, [currentUser, requireAuth]);

  const createStory = useCallback(async (storyData: Partial<Story> & { media_file?: File; audio_file?: File }) => {
    if (!requireAuth('Creating stories')) return;
    if (!currentUser) return;

    try {
      let mediaUrl = storyData.media_url;
      let musicUrl = storyData.music_url;

      if (storyData.media_file) {
        const uploadResult = await uploadToCloudflareR2(storyData.media_file, 'stories');
        mediaUrl = uploadResult.url;
      }

      if (storyData.audio_file) {
        const uploadResult = await uploadToCloudflareR2(storyData.audio_file, 'story-audio');
        musicUrl = uploadResult.url;
      }

      const payload = {
        user_id: currentUser.id,
        type: storyData.type || 'text',
        text_content: storyData.text_content || null,
        media_url: mediaUrl || null,
        background_style: storyData.background_style || null,
        music_url: musicUrl || null,
        music_title: storyData.music_title || null,
        created_at: new Date().toISOString(),
      };

      const data = await apiFetch('/api/stories', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const newStory = normalizeStory(data?.story ?? data, currentUser);
      newStory.user = currentUser;

      setStories(prev => [newStory, ...prev]);

      writeStoriesCache([newStory, ...stories]);

      setLoginError('Story created successfully!');
      
    } catch (error: any) {
      console.error('Failed to create story:', error);
      setLoginError(error?.message || 'Failed to create story');
    }
  }, [currentUser, requireAuth, stories]);

  useEffect(() => {
    if (!authHydrated) return;

    if (currentUser?.id) {
      fetchMyTotalPlays(Number(currentUser.id)).catch(() => {});
    } else {
      setMyTotalPlays(0);
    }
  }, [authHydrated, currentUser?.id, fetchMyTotalPlays]);

  const onPlayTrack = useCallback((track: AudioTrack) => {
    const trackWithCover = {
      ...track,
      cover: track.cover && 
             track.cover.trim() !== '' && 
             track.cover.startsWith('http')
             ? track.cover
             : DEFAULT_MUSIC_COVER
    };

    setCurrentAudioTrack(trackWithCover);
    setIsAudioPlaying(true);

    setPlayHistory(prev => {
      const last = prev[0];
      if (last && last.type === track.type && String(last.id) === String(track.id)) return prev;
      return [trackWithCover, ...prev].slice(0, 50);
    });
  }, []);

  const onTogglePlay = useCallback(() => {
    setIsAudioPlaying(p => !p);
  }, []);

  const onClosePlayer = useCallback(() => {
    setIsAudioPlaying(false);
    setCurrentAudioTrack(null);
  }, []);

  const onNext = useCallback(() => {
    setPlayHistory(prev => {
      if (prev.length < 2) return prev;
      const next = prev[1];
      const nextWithCover = {
        ...next,
        cover: next.cover && 
               next.cover.trim() !== '' && 
               next.cover.startsWith('http')
               ? next.cover
               : DEFAULT_MUSIC_COVER
      };
      setCurrentAudioTrack(nextWithCover);
      setIsAudioPlaying(true);
      return [nextWithCover, ...prev.filter((_, i) => i !== 1)].slice(0, 50);
    });
  }, []);

  const onPrevious = useCallback(() => {
    setPlayHistory(prev => {
      if (prev.length < 2) return prev;
      const prevTrack = prev[1];
      const prevTrackWithCover = {
        ...prevTrack,
        cover: prevTrack.cover && 
               prevTrack.cover.trim() !== '' && 
               prevTrack.cover.startsWith('http')
               ? prevTrack.cover
               : DEFAULT_MUSIC_COVER
      };
      setCurrentAudioTrack(prevTrackWithCover);
      setIsAudioPlaying(true);
      return [prevTrackWithCover, ...prev.filter((_, i) => i !== 1)].slice(0, 50);
    });
  }, []);

  const onStarted = useCallback(async (track: AudioTrack) => {
    try {
      setPlaysLoading(true);

      const userId = (currentUser as any)?.id ?? null;

      if (userId) {
        setMyTotalPlays(p => p + 1);
        
        const key = `unera_my_total_plays_${Number(userId)}`;
        const current = Number(localStorage.getItem(key) || '0');
        localStorage.setItem(key, String(current + 1));
      }

      const res = await recordPlay(track, userId);

      const newPlays = Number(res?.plays_count ?? res?.plays ?? res?.count ?? 0);

      const key = `${track.type}:${String(track.id)}`;
      if (Number.isFinite(newPlays) && newPlays > 0) {
        setTrackPlays(prev => ({ ...prev, [key]: newPlays }));
      } else {
        setTrackPlays(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
      }
    } catch (e) {
      const key = `${track.type}:${String(track.id)}`;
      setTrackPlays(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    } finally {
      setPlaysLoading(false);
    }
  }, [currentUser]);

  const handleMusicSystemLikeSync = useCallback((key: string, liked: boolean) => {
    setLikedTracks(prev => {
      const has = prev.includes(key);
      if (liked && !has) return [...prev, key];
      if (!liked && has) return prev.filter(x => x !== key);
      return prev;
    });
  }, []);

  const isPlayerLiked = useMemo(() => {
    if (!currentAudioTrack) return false;
    return likedTracks.includes(`${currentAudioTrack.type}:${String(currentAudioTrack.id)}`);
  }, [currentAudioTrack, likedTracks]);

  // Push More function
  const pushMore = async (postId: number) => {
    if (!requireAuth('Boosting posts')) return;
    if (!currentUser) return;

    try {
      const selectedPost = posts.find(p => p.id === postId);
      
      if (!selectedPost) {
        throw new Error('Post not found');
      }

      setSelectedPostForAd(selectedPost);
      
      navigateTo('ads');
      setActiveAdTab('create');
      
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1877F2] text-white px-6 py-2 rounded-full font-bold shadow-lg animate-fade-in z-[300]';
      toast.innerText = 'Opening ad creator...';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
      
    } catch (err) {
      console.error('Push more failed', err);
      
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-2 rounded-full font-bold shadow-lg animate-fade-in z-[300]';
      toast.innerText = 'Failed to open ad creator';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }
  };

  // Navigation function with history tracking
  const navigateTo = useCallback((target: View) => {
    setView(prevView => {
      if (prevView === target) return prevView;
      
      setNavigationHistory(prev => [...prev, prevView]);
      return target;
    });
    
    if (['home', 'reels', 'marketplace', 'groups', 'brands', 'music', 'events'].includes(target)) {
      setActiveTab(target as any);
    }
    window.scrollTo(0, 0);
  }, []);

  // Back navigation function
  const goBack = useCallback(() => {
    setNavigationHistory(prev => {
      if (prev.length === 0) {
        setView('home');
        setActiveTab('home');
        return ['home'];
      }
      
      const newHistory = [...prev];
      const previousView = newHistory.pop() as View;
      
      setView(previousView);
      if (['home', 'reels', 'marketplace', 'groups', 'brands', 'music', 'events'].includes(previousView)) {
        setActiveTab(previousView as any);
      }
      
      return newHistory;
    });
    
    window.scrollTo(0, 0);
  }, []);

  // ADVERTISING SYSTEM FUNCTIONS
  const fetchMyAds = useCallback(async () => {
    if (!currentUser) return;
    
    setAdsLoading(true);
    try {
      const response = await fetch('/api/ads/my', {
        headers: {
          'x-user-id': String(currentUser.id)
        }
      });
      const data = await response.json();
      
      const campaigns = (data.ads || []).map((ad: any) => ({
        id: ad.id,
        advertiser_id: ad.advertiser_id,
        post_id: ad.post_id,
        name: `Campaign #${ad.id}`,
        type: 'image' as const,
        mediaUrl: '',
        description: '',
        link: '',
        cta: 'Learn More' as const,
        location: 'Global',
        days: Math.ceil((new Date(ad.end_date).getTime() - new Date(ad.start_date).getTime()) / (1000 * 60 * 60 * 24)),
        createdAt: new Date(ad.created_at).getTime(),
        status: ad.status,
        analytics: {
          impressions: 0,
          clicks: 0,
          views: 0,
          spend: ad.budget || 0
        },
        start_date: ad.start_date,
        end_date: ad.end_date,
        budget: ad.budget
      }));
      
      setAdCampaigns(campaigns);
    } catch (error) {
      console.error('Failed to fetch ads:', error);
    } finally {
      setAdsLoading(false);
    }
  }, [currentUser]);

  // Create new ad campaign
  const createAdCampaign = useCallback(async (
    postId: number,
    campaignData: {
      name: string;
      link?: string;
      phone?: string;
      email?: string;
      cta: string;
      location: string;
      budget: number;
      days: number;
    }
  ) => {
    if (!requireAuth('Creating ads')) return false;
    if (!currentUser) return false;

    try {
      const response = await fetch('/api/ads/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(currentUser.id)
        },
        body: JSON.stringify({
          post_id: postId,
          ...campaignData
        })
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchMyAds();
        
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1877F2] text-white px-6 py-2 rounded-full font-bold shadow-lg animate-fade-in z-[300]';
        toast.innerText = 'Campaign created successfully!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to create campaign:', error);
      
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-2 rounded-full font-bold shadow-lg animate-fade-in z-[300]';
      toast.innerText = 'Failed to create campaign';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
      
      return false;
    }
  }, [currentUser, requireAuth, fetchMyAds]);

  // Pause campaign
  const pauseCampaign = useCallback(async (adId: number) => {
    if (!requireAuth('Pausing campaigns')) return false;
    if (!currentUser) return false;

    try {
      const response = await fetch(`/api/ads/${adId}/pause`, {
        method: 'POST',
        headers: {
          'x-user-id': String(currentUser.id)
        }
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchMyAds();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to pause campaign:', error);
      return false;
    }
  }, [currentUser, requireAuth, fetchMyAds]);

  // Resume campaign
  const resumeCampaign = useCallback(async (adId: number) => {
    if (!requireAuth('Resuming campaigns')) return false;
    if (!currentUser) return false;

    try {
      const response = await fetch(`/api/ads/${adId}/resume`, {
        method: 'POST',
        headers: {
          'x-user-id': String(currentUser.id)
        }
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchMyAds();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to resume campaign:', error);
      return false;
    }
  }, [currentUser, requireAuth, fetchMyAds]);

  // Delete campaign
  const deleteCampaign = useCallback(async (adId: number) => {
    if (!requireAuth('Deleting campaigns')) return false;
    if (!currentUser) return false;

    try {
      const response = await fetch(`/api/ads/${adId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': String(currentUser.id)
        }
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchMyAds();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      return false;
    }
  }, [currentUser, requireAuth, fetchMyAds]);

  // Helper to create marketplace posts
  const createMarketplacePost = useCallback(
    async (product: any) => {
      if (!currentUser) return;

      const images: string[] = safeImages(product.images);
      const media_url = images[0] || '';
      const media_type = media_url ? 'image' : null;

      const payload = {
        user_id: currentUser.id,
        
        content: product.title || '',
        visibility: 'public',
        
        type: "marketplace",
        post_type: "product",
        product_id: product.id,
        
        media_url,
        media_type,
        media_urls: images,
        media_types: images.map(() => 'image'),
        
        meta: {
          kind: "product",
          product_id: product.id,
          marketplace: {
            id: product.id,
            product_id: product.id,
            price: product.discount_price ?? product.main_price ?? null,
            currency: product.currency_symbol || 'TZS',
            location: product.address || '',
            title: product.title,
            images: images,
          }
        }
      };

      const created = await apiFetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const newPost = normalizePost(created?.post ?? created);
      
      setPosts(prev => [newPost, ...safeArray(prev)]);
      
      if (Number(currentUser.id) === Number(selectedUserId)) {
        setProfilePosts(prev => [newPost, ...safeArray(prev)]);
      }

      scheduleSilentRefresh();
      
      return newPost;
    },
    [currentUser, selectedUserId]
  );

  const createProduct = useCallback(async (productData: any) => {
    if (!requireAuth("Creating products")) return;
    if (!currentUser) return;

    const payload = { ...productData, seller_id: currentUser.id };

    const tempId = Date.now();
    const optimistic = normalizeProduct({
      ...payload,
      id: tempId,
      seller_name: currentUser.name,
      seller_avatar: currentUser.profile_image_url,
      seller_id: currentUser.id,
    });

    setProducts(prev => [optimistic, ...safeArray(prev)]);

    try {
      const res = await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const createdProduct = normalizeProduct(res?.product ?? res);
      
      setProducts(prev => {
        const filtered = safeArray(prev).filter((x: any) => Number(x.id) !== Number(tempId));
        return [createdProduct, ...filtered];
      });

      await createMarketplacePost(createdProduct);
      
      return createdProduct;
    } catch (e: any) {
      setProducts(prev => safeArray(prev).filter((x: any) => Number(x.id) !== Number(tempId)));
      setLoginError(e?.message || "Failed to create product");
      throw e;
    }
  }, [currentUser, requireAuth, createMarketplacePost]);

  const roleOf = (u: any) => String(u?.role || '').trim().toLowerCase();
  const isAdmin = (u: any) => roleOf(u) === 'admin';
  const isModerator = (u: any) => roleOf(u) === 'moderator';

  const requireAdmin = useCallback((action = 'This action') => {
    if (!requireAuth(action)) return false;
    if (!isAdmin(currentUser)) {
      setLoginError(`${action} requires admin.`);
      return false;
    }
    return true;
  }, [requireAuth, currentUser]);

  const requireModOrAdmin = useCallback((action = 'This action') => {
    if (!requireAuth(action)) return false;
    if (!(isAdmin(currentUser) || isModerator(currentUser))) {
      setLoginError(`${action} requires moderator or admin.`);
      return false;
    }
    return true;
  }, [requireAuth, currentUser]);

  const openProfile = useCallback((id: number) => {
    setSelectedUserId(Number(id));
    navigateTo('profile');
    window.scrollTo(0, 0);
  }, [navigateTo]);

  const handleOpenChat = useCallback((recipient: User) => {
    if (!requireAuth('Messaging')) return;
    
    if (isChatsListOpen) {
      setIsChatsListOpen(false);
    }
    
    if (activeChatUser?.id === recipient.id) {
      setIsChatOpen(prev => !prev);
    } else {
      setActiveChatUser(recipient);
      setIsChatOpen(true);
    }
  }, [activeChatUser?.id, requireAuth, isChatsListOpen]);

  const handleOpenChatsList = useCallback(() => {
    if (!requireAuth('Messages')) return;
    
    if (isChatOpen) {
      setIsChatOpen(false);
    }
    
    setIsChatsListOpen(prev => !prev);
  }, [requireAuth, isChatOpen]);

  const handleCloseChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  const handleCloseChatsList = useCallback(() => {
    setIsChatsListOpen(false);
  }, []);

  const handleSendMessage = useCallback(async (text: string, sticker?: string) => {
    if (!currentUser || !activeChatUser) return;
    
    try {
      await apiFetch('/api/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          recipient_id: activeChatUser.id,
          text_content: text,
          sticker: sticker
        }),
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [currentUser, activeChatUser]);

  const fetchUsersList = useCallback(async () => {
    if (usersInFlightRef.current) return;
    usersInFlightRef.current = true;
    
    try {
      const u = await apiFetch('/api/users').catch(() => []);
      const newUsers = safeArray(u).map(normalizeUser);
      
      setUsers(prev => {
        const map = new Map<number, User>();
        safeArray(prev).forEach(user => map.set(Number(user.id), user));
        
        newUsers.forEach(newUser => {
          const id = Number(newUser.id);
          if (!id) return;
          
          const existing = map.get(id);
          if (existing) {
            map.set(id, normalizeUser(mergeUserSafe(existing, newUser)));
          } else {
            map.set(id, normalizeUser(newUser));
          }
        });
        
        return Array.from(map.values());
      });
    } catch {
    } finally {
      usersInFlightRef.current = false;
    }
  }, []);

  // fetchReels
  const fetchReels = useCallback(async () => {
    if (reelsInFlightRef.current) return;
    reelsInFlightRef.current = true;
    const requestId = ++reelsRequestIdRef.current;
    
    try {
      const data = await apiFetch('/api/reels');
      const reelsList = safeArray(data?.reels ?? data);
      
      const normalizedReels = reelsList.map((reel: any) => {
        const normalized = normalizeReel(reel);
        const author = users.find((u) => Number(u.id) === Number(normalized.userId));
        return {
          ...normalized,
          author: author?.name || normalized.author || normalized.author_name || 'User',
          author_name: author?.name || normalized.author_name || normalized.author || 'User',
          avatar: author?.profile_image_url || normalized.avatar || '',
          avatar_url: author?.profile_image_url || normalized.avatar_url || normalized.avatar || '',
          verified: author?.is_verified || normalized.verified || false,
          audioUrl: toFetchableAudioUrl(normalized.audioUrl),
          audio_url: toFetchableAudioUrl(normalized.audio_url),
          videoUrl: normalized.video_url_medium || normalized.video_url || normalized.video_url_low || '',
          video_url: normalized.video_url_medium || normalized.video_url || normalized.video_url_low || '',
        };
      });
      
      if (!isMountedRef.current) return;
      if (requestId !== reelsRequestIdRef.current) return;
      
      setReels(normalizedReels);
    } catch (error) {
      console.error('Failed to fetch reels:', error);
      if (!isMountedRef.current) return;
      if (requestId !== reelsRequestIdRef.current) return;
      setReels([]);
    } finally {
      if (requestId === reelsRequestIdRef.current) {
        reelsInFlightRef.current = false;
      }
    }
  }, [users]);

const generateSoundKey = useCallback((reelData: any, selectedReelSound: ReelSound | null): string => {
  if (reelData.soundKey) return String(reelData.soundKey);

  if (reelData.audioFile && !reelData.originalSoundId && !(reelData as any).songId) {
    return `original:extracted:${Date.now()}`;
  }

  if (reelData.originalSoundId) {
    return `song:${reelData.originalSoundId}`;
  }

  if ((reelData as any).songId) {
    return `song:${(reelData as any).songId}`;
  }

  if (selectedReelSound?.soundKey) {
    return String(selectedReelSound.soundKey);
  }

  if (reelData.audioUrl) {
    return `audio:${reelData.audioUrl}`;
  }

  if (selectedReelSound?.audioUrl) {
    return `audio:${selectedReelSound.audioUrl}`;
  }

  return 'original:none';
}, []);


  const createReel = useCallback(async (
    reelData: Partial<Reel> & {
      videoFile?: File | Blob;
      thumbnailFile?: File | Blob;
      audioFile?: File | Blob;
      originalSoundId?: string | number;
    }
  ) => {
    if (!requireAuth('Creating reels')) return;
    if (!currentUser) return;

    console.log("createReel input:", reelData);
    setIsFeedRefreshing(true);

    try {
      const videoFile = reelData.videoFile;
      const thumbnailFile = reelData.thumbnailFile;
      const audioFile = reelData.audioFile;

      if (!videoFile) {
        throw new Error('Video is required');
      }

      let videoUrl = '';
      let videoUrlLow = '';
      let videoUrlMedium = '';
      let videoUrlHd = '';
      let thumbnailUrl = '';

      videoUrlMedium = await ensureR2Url(
        videoFile,
        'reels',
        `reel-${Date.now()}.mp4`
      );
      videoUrlLow = videoUrlMedium;
      videoUrl = videoUrlMedium;
      videoUrlHd = '';

      if (thumbnailFile) {
        thumbnailUrl = await ensureR2Url(
          thumbnailFile,
          'reels-thumbs',
          `reel-thumb-${Date.now()}.webp`
        );
      }

      if (!videoUrl || !videoUrl.startsWith('http')) {
        throw new Error('Video upload failed');
      }

      let audioUrl = null;
      if (audioFile) {
        audioUrl = await ensureR2Url(
          audioFile,
          'reel-audio',
          `audio-${Date.now()}.wav`
        );
      } else if (reelData.audioUrl) {
        audioUrl = reelData.audioUrl;
      }

const soundKey = generateSoundKey(reelData, selectedReelSound);
const isTrimmedAudio = soundKey.startsWith('trimmed:');

let audioStart = 0;
if (isTrimmedAudio) {
  audioStart = 0;
} else if (typeof reelData.audioStart === 'number') {
  audioStart = reelData.audioStart;
} else if (typeof selectedReelSound?.audioStart === 'number') {
  audioStart = selectedReelSound.audioStart;
}

let audioEnd = 0;
if (isTrimmedAudio) {
  audioEnd = 0;
} else if (typeof reelData.audioEnd === 'number') {
  audioEnd = reelData.audioEnd;
} else if (typeof selectedReelSound?.audioEnd === 'number') {
  audioEnd = selectedReelSound.audioEnd;
}

const soundName =
  reelData.songName ||
  selectedReelSound?.songName ||
  'Original Sound';

const finalAudioUrl =
  audioUrl ||
  (reelData.audioFile ? '' : (
    reelData.audioUrl ||
    selectedReelSound?.originalUrl ||
    selectedReelSound?.audioUrl ||
    ''
  ));

const finalSongId =
  reelData.originalSoundId ||
  selectedReelSound?.songId ||
  null;

const payload = {
  user_id: currentUser.id,
  caption: reelData.caption || '',
  video_url: videoUrl,
  video_url_low: videoUrlLow,
  video_url_medium: videoUrlMedium,
  video_url_hd: videoUrlHd,
  thumbnail_url: thumbnailUrl || '',
  song_name: soundName,
  audio_url: finalAudioUrl,
  audio_start: audioStart,
  audio_end: audioEnd,
  song_id: finalSongId,
  sound_key: soundKey,
  visibility: reelData.visibility || 'public',
  location: reelData.location || '',
  views: 0,
  shares: 0,
};

console.log('Sending to API:', payload);

const data = await apiFetch('/api/reels', {
  method: 'POST',
  body: JSON.stringify(payload),
});
      
    } catch (error) {
      console.error('Failed to react to reel:', error);
      fetchReels().catch(() => {});
    }
  }, [currentUser, requireAuth, fetchReels]);

  const commentOnReel = useCallback(async (
    reelId: number,
    payload: {
      text: string;
      parentId?: number | null;
      imageFile?: File | null;
    }
  ) => {
    if (!requireAuth('Commenting on reels')) return;
    if (!currentUser) return;
    
    if (!payload.text?.trim() && !payload.imageFile) {
      setLoginError('Comment cannot be empty');
      return;
    }

    try {
      let image_url = '';

      if (payload.imageFile) {
        image_url = await ensureR2Url(
          payload.imageFile,
          'reel-comments',
          `comment-${Date.now()}.jpg`
        );
      }

      const data = await apiFetch(`/api/reel-comments`, {
        method: 'POST',
        body: JSON.stringify({
          reel_id: reelId,
          user_id: currentUser.id,
          text: payload.text || '',
          parent_comment_id: payload.parentId ?? null,
          image_url: image_url || '',
        }),
      });

      const createdComment = {
        ...(data?.comment || {}),
        id: safeNumber(data?.comment?.id ?? 0),
        reel_id: safeNumber(data?.comment?.reel_id ?? reelId),
        user_id: safeNumber(data?.comment?.user_id ?? currentUser.id),
        parent_comment_id:
          data?.comment?.parent_comment_id == null
            ? null
            : safeNumber(data?.comment?.parent_comment_id ?? 0),
        text: String(data?.comment?.text ?? payload.text ?? ''),
        image_url: data?.comment?.image_url ?? image_url ?? '',
        created_at: data?.comment?.created_at ?? new Date().toISOString(),
      };

      setReels(prev =>
        safeArray(prev).map(reel =>
          reel.id === reelId
            ? {
                ...reel,
                comments: [createdComment, ...safeArray(reel.comments)],
                comments_count: safeNumber(reel.comments_count ?? reel.comments?.length ?? 0) + 1,
              }
            : reel
        )
      );
    } catch (error) {
      console.error('Failed to comment on reel:', error);
      setLoginError('Failed to post comment');
    }
  }, [currentUser, requireAuth]);

  const editCommentOnReel = useCallback(async (
    commentId: number,
    payload: {
      text?: string;
      imageFile?: File | null;
      image_url?: string;
    }
  ) => {
    if (!requireAuth('Editing comments')) return;
    if (!currentUser) return;

    try {
      let image_url = payload.image_url || '';

      if (payload.imageFile) {
        image_url = await ensureR2Url(
          payload.imageFile,
          'reel-comments',
          `comment-edit-${Date.now()}.jpg`
        );
      }

      const data = await apiFetch(`/api/reel-comments`, {
        method: 'PATCH',
        body: JSON.stringify({
          id: commentId,
          user_id: currentUser.id,
          text: payload.text ?? '',
          image_url,
        }),
      });

      const updated = data?.comment || {};

      setReels(prev =>
        safeArray(prev).map(reel => ({
          ...reel,
          comments: safeArray(reel.comments).map((comment: any) =>
            Number(comment.id) === Number(commentId)
              ? {
                  ...comment,
                  ...updated,
                  text: String(updated?.text ?? payload.text ?? comment.text ?? ''),
                  image_url: updated?.image_url ?? image_url ?? comment.image_url ?? '',
                }
              : comment
          ),
        }))
      );
    } catch (error) {
      console.error('Failed to edit comment:', error);
      setLoginError('Failed to edit comment');
    }
  }, [currentUser, requireAuth]);

  const deleteCommentOnReel = useCallback(async (commentId: number) => {
    if (!requireAuth('Deleting comments')) return;
    if (!currentUser) return;

    try {
      await apiFetch(`/api/reel-comments?id=${commentId}&user_id=${currentUser.id}`, {
        method: 'DELETE',
      });

      setReels(prev =>
        safeArray(prev).map(reel => {
          const before = safeArray(reel.comments);
          const filtered = before.filter((comment: any) => {
            const parentId = comment?.parent_comment_id ?? comment?.parentId ?? comment?.parent_id;
            return Number(comment.id) !== Number(commentId) &&
                   Number(parentId) !== Number(commentId);
          });

          const removedCount = before.length - filtered.length;

          return removedCount > 0
            ? {
                ...reel,
                comments: filtered,
                comments_count: Math.max(
                  0,
                  safeNumber(reel.comments_count ?? before.length) - removedCount
                ),
              }
            : reel;
        })
      );
    } catch (error) {
      console.error('Failed to delete comment:', error);
      setLoginError('Failed to delete comment');
    }
  }, [currentUser, requireAuth]);

  const editReel = useCallback(async (
    reelId: number,
    payload: {
      caption?: string;
      visibility?: string;
      location?: string;
      thumbnail_url?: string;
    }
  ) => {
    if (!requireAuth('Editing reels')) return;
    if (!currentUser) return;

    try {
      const data = await apiFetch(`/api/reels/${reelId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          user_id: currentUser.id,
          caption: payload.caption ?? '',
          visibility: payload.visibility ?? 'public',
          location: payload.location ?? '',
          thumbnail_url: payload.thumbnail_url ?? '',
        }),
      });

      const updated = normalizeReel(data?.reel || {});

      setReels(prev =>
        safeArray(prev).map(reel =>
          reel.id === reelId
            ? {
                ...reel,
                ...updated,
                author: reel.author,
                author_name: reel.author_name,
                avatar: reel.avatar,
                verified: reel.verified,
              }
            : reel
        )
      );
    } catch (error) {
      console.error('Failed to edit reel:', error);
      setLoginError('Failed to edit reel');
    }
  }, [currentUser, requireAuth]);

  const deleteReel = useCallback(async (reelId: number) => {
    if (!requireAuth('Deleting reels')) return;
    if (!currentUser) return;

    try {
      await apiFetch(`/api/reels/${reelId}?user_id=${currentUser.id}`, {
        method: 'DELETE',
      });

      setReels(prev => safeArray(prev).filter(reel => Number(reel.id) !== Number(reelId)));
    } catch (error) {
      console.error('Failed to delete reel:', error);
      setLoginError('Failed to delete reel');
    }
  }, [currentUser, requireAuth]);

  const shareReel = useCallback(async (reelId: number, type: 'feed' | 'copy') => {
    if (!requireAuth('Sharing reels')) return;
    if (!currentUser) return;

    try {
      await apiFetch(`/api/reels/${reelId}/share`, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.id, destination: type }),
      });
      
      setReels(prev => 
        safeArray(prev).map(reel => 
          reel.id === reelId 
            ? { ...reel, shares: (reel.shares || 0) + 1 }
            : reel
        )
      );
      
      if (type === 'copy') {
        const reelLink = `${window.location.origin}/reels/${reelId}`;
        try {
          await navigator.clipboard.writeText(reelLink);
          setLoginError('Link copied to clipboard!');
        } catch (err) {
          console.error('Clipboard copy failed:', err);
          setLoginError('Failed to copy link');
        }
      }
      
    } catch (error) {
      console.error('Failed to share reel:', error);
      setLoginError('Failed to share');
    }
  }, [currentUser, requireAuth]);

  const useSoundFromReel = useCallback((soundFromReel: any) => {
    const audioUrlRaw = soundFromReel?.audio_url ?? soundFromReel?.audioUrl ?? '';
    
    if (!audioUrlRaw) return;

    const songName = soundFromReel?.song_name ?? soundFromReel?.songName ?? 'Original Sound';
    const audioStart = safeNumber(soundFromReel?.audio_start ?? soundFromReel?.audioStart ?? 0);
    const audioEnd = safeNumber(soundFromReel?.audio_end ?? soundFromReel?.audioEnd ?? 0);
    const songId = soundFromReel?.song_id ?? soundFromReel?.songId ?? null;
    const soundKey = String(soundFromReel?.sound_key ?? soundFromReel?.soundKey ?? '');

    const isTrimmedAudio = soundKey.startsWith('trimmed:');

    setSelectedReelSound({
      songName,
      audioUrl: soundFromReel?.audio_fetch_url || toFetchableAudioUrl(audioUrlRaw),
      originalUrl: audioUrlRaw,
      audioStart,
      audioEnd,
      songId,
      soundKey,
      isTrimmedAudio,
    });

    setShowCreateReelModal(true);
  }, []);

  const fetchPostsForHome = useCallback(
    async (viewer: User | null) => {
      if (postsInFlightRef.current) return;
      postsInFlightRef.current = true;
      
      setIsFeedRefreshing(true);

      try {
        const seed = getOrCreateSessionSeed(viewer?.id ?? null);
        const seen = getSeenSet();

        if (viewer?.id) {
          const data = await apiFetch(`/api/feeds?userId=${viewer.id}&limit=50`);
          const rows = safeArray<any>(data?.feed);

          if (!rows.length) {
            if (lastGoodPostsRef.current.length) setPosts(lastGoodPostsRef.current);
            if (!feedHydrated) setFeedHydrated(true);
            return;
          }

          setUsers((prev) => {
            const map = new Map<number, User>();
            safeArray(prev).forEach((u) => map.set(Number(u.id), normalizeUser(u)));

            rows.forEach((r) => {
              const author = authorFromFeedRow(r);
              if (!author?.id) return;
              
              const existing = map.get(author.id);
              if (existing) {
                map.set(author.id, normalizeUser(mergeUserSafe(existing, author)));
              } else {
                map.set(author.id, author);
              }
            });

            return Array.from(map.values());
          });

          const normalized = rows.map(normalizeFeedRowToPost);

          const unseen = normalized.filter((p: any) => !seen.has(Number(p.id)));
          const seenOnes = normalized.filter((p: any) => seen.has(Number(p.id)));

          const ordered = diversifyFeed(
            [...seededShuffle(unseen, seed), ...seededShuffle(seenOnes, seed ^ 0xabcddcba)],
            seed
          );

          pushSeenIds(ordered.slice(0, 40).map((p: any) => Number(p.id)));

          setPosts((prev) => {
            const next = mergeFeed(prev, ordered);
            lastGoodPostsRef.current = next;
            stableFeedRef.current = next;
            return next;
          });

          if (!feedHydrated) setFeedHydrated(true);

          if (activeCommentsIdentity != null) {
            const found = ordered.find((p: any) => getFeedKey(p) === activeCommentsIdentity);
            if (found) setCommentPostSnapshot(found);
          }

          return;
        }

        const p = await apiFetch('/api/posts');
        const normalized = safeArray(p).map(normalizePost);

        if (normalized.length) {
          const unseen = normalized.filter((x: any) => !seen.has(Number(x.id)));
          const seenOnes = normalized.filter((x: any) => seen.has(Number(x.id)));

          const ordered = diversifyFeed(
            [...seededShuffle(unseen, seed), ...seededShuffle(seenOnes, seed ^ 0xabcddcba)],
            seed
          );

          pushSeenIds(ordered.slice(0, 40).map((x: any) => Number(x.id)));

          setPosts((prev) => {
            const next = mergeFeed(prev, ordered);
            stableFeedRef.current = next;
            lastGoodPostsRef.current = next;
            return next;
          });
        } else if (lastGoodPostsRef.current.length) {
          setPosts(lastGoodPostsRef.current);
        }

        if (!feedHydrated) setFeedHydrated(true);

        if (activeCommentsIdentity != null) {
          const found = normalized.find((x: any) => getFeedKey(x) === activeCommentsIdentity);
          if (found) setCommentPostSnapshot(found);
        }
      } catch {
        if (lastGoodPostsRef.current.length) setPosts(lastGoodPostsRef.current);
        if (!feedHydrated) setFeedHydrated(true);
      } finally {
        setIsFeedRefreshing(false);
        postsInFlightRef.current = false;
      }
    },
    [activeCommentsIdentity, feedHydrated]
  );

  const fetchProfilePosts = useCallback(async (profileUserId: number) => {
    try {
      const viewerId = currentUser?.id ? Number(currentUser.id) : 0;
      const data = await apiFetch(`/api/posts/by-user?userId=${profileUserId}&viewerId=${viewerId}&limit=50`);
      
      const list = safeArray<any>((data as any)?.posts ?? (data as any)?.results ?? data);
      const normalized = list.map(normalizePost);

      normalized.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

      setProfilePosts(prev => {
        const localTruth = [...safeArray(posts), ...safeArray(prev)];
        const map = new Map<number, any>();
        localTruth.forEach((p: any) => map.set(Number(p.id), p));

        return normalized.map((p: any) => {
          const local = map.get(Number(p.id));
          if (!local) return p;

          return {
            ...p,
            my_reaction: p.my_reaction ?? local.my_reaction ?? local.myReaction ?? null,
            myReaction: p.myReaction ?? p.my_reaction ?? local.my_reaction ?? local.myReaction ?? null,
            reactions: Array.isArray(p.reactions) && p.reactions.length ? p.reactions : safeArray(local.reactions),
            reactions_count: safeNumber(p.reactions_count, safeNumber(local.reactions_count, safeNumber(local.likesCount, 0))),
            reactionsCount: safeNumber(p.reactionsCount, safeNumber(local.reactionsCount, safeNumber(local.likesCount, 0))),
            likesCount: safeNumber(p.likesCount, safeNumber(local.likesCount, safeNumber(local.reactions_count, 0))),
          };
        });
      });
    } catch {
    }
  }, [currentUser, posts]);

  const fetchUserFollowDataForUI = useCallback(async (userId: number) => {
    try {
      const followData = await fetchUserFollowData(userId);
      
      setUsers(prev => {
        return prev.map(user => {
          if (Number(user.id) === Number(userId)) {
            return normalizeUser({
              ...user,
              followers: followData.followers,
              following: followData.following
            });
          }
          return user;
        });
      });

      if (currentUser && Number(currentUser.id) === Number(userId)) {
        const updatedCurrentUser = normalizeUser({
          ...currentUser,
          followers: followData.followers,
          following: followData.following
        });
        setCurrentUser(updatedCurrentUser);
        localStorage.setItem(LS_USER_KEY, JSON.stringify(updatedCurrentUser));
      }

      return followData;
    } catch (error) {
      console.error('Failed to fetch follow data for UI:', error);
      return { followers: [], following: [] };
    }
  }, [currentUser]);

  useEffect(() => {
    if (view !== 'profile' || !selectedUserId) return;
    
    fetchUserFollowDataForUI(Number(selectedUserId)).catch(() => {});
  }, [view, selectedUserId, fetchUserFollowDataForUI]);

  useEffect(() => {
    if (!currentUser?.id) return;
    
    fetchUserFollowDataForUI(Number(currentUser.id)).catch(() => {});
  }, [currentUser?.id, fetchUserFollowDataForUI]);

  const scheduleSilentRefresh = useCallback(() => {
    if (scheduleSilentRefreshRef.current) clearTimeout(scheduleSilentRefreshRef.current);
    scheduleSilentRefreshRef.current = setTimeout(() => {
      fetchPostsForHome(currentUser).catch(() => {});
      fetchReels().catch(() => {});
    }, 8000);
  }, [currentUser, fetchPostsForHome, fetchReels]);

  // Event Functions
  const fetchEvents = useCallback(async (): Promise<Event[]> => {
    try {
      const data = await apiFetch('/api/events');
      const list = safeArray(data?.events ?? data);
      return list.map(normalizeEvent);
    } catch (err) {
      console.error('❌ fetchEvents failed:', err);
      return [];
    }
  }, []);

  const onRSVPEvent = useCallback(
    async (eventId: number, status: "going" | "interested" | "not_going") => {
      if (!requireAuth("RSVP to events")) return;
      if (!currentUser) return;

      const meId = Number(currentUser.id);
      const id = Number(eventId);
      if (!id) return;

      setEvents(prev =>
        safeArray(prev).map(ev => {
          const e: any = normalizeEvent(ev);
          if (Number(e.id) !== id) return e;

          const attendees = new Set<number>(safeArray(e.attendees).map(Number));
          const interested = new Set<number>(safeArray(e.interestedIds ?? e.interested_ids).map(Number));

          if (status === "going") {
            attendees.add(meId);
            interested.delete(meId);
          } else if (status === "interested") {
            interested.add(meId);
            attendees.delete(meId);
          } else {
            attendees.delete(meId);
            interested.delete(meId);
          }

          return {
            ...e,
            attendees: Array.from(attendees),
            interestedIds: Array.from(interested),
            user_rsvp_status: status === "not_going" ? "" : status,
          };
        })
      );

      try {
        if (status === "going") {
          await postJSON("/api/attend", { 
            event_id: id, 
            user_id: meId, 
            action: "add" 
          });
          
          await postJSON("/api/interested", { 
            event_id: id, 
            user_id: meId, 
            action: "remove" 
          }).catch(() => {});
        } 
        else if (status === "interested") {
          await postJSON("/api/interested", { 
            event_id: id, 
            user_id: meId, 
            action: "add" 
          });
          
          await postJSON("/api/attend", { 
            event_id: id, 
            user_id: meId, 
            action: "remove" 
          }).catch(() => {});
        } 
        else if (status === "not_going") {
          await postJSON("/api/attend", { 
            event_id: id, 
            user_id: meId, 
            action: "remove" 
          }).catch(() => {});
          
          await postJSON("/api/interested", { 
            event_id: id, 
            user_id: meId, 
            action: "remove" 
          }).catch(() => {});
        }

        const fresh = await fetchEvents().catch(() => []);
        setEvents(fresh);

        return { success: true };
      } catch (err: any) {
        console.error('RSVP failed:', err);
        const fresh = await fetchEvents().catch(() => []);
        setEvents(fresh);
        throw err;
      }
    },
    [currentUser, requireAuth, fetchEvents]
  );

  const joinEvent = useCallback(async (eventId: number) => {
    return onRSVPEvent(eventId, 'going');
  }, [onRSVPEvent]);

  const markEventInterested = useCallback(async (eventId: number) => {
    return onRSVPEvent(eventId, 'interested');
  }, [onRSVPEvent]);

  const createEvent = useCallback(async (eventData: any) => {
    if (!requireAuth('Creating events')) return;
    if (!currentUser) return;

    const uiDate = safeString(eventData?.date ?? '', '');
    const uiTime = safeString(eventData?.time ?? '', '');
    const apiISO = safeString(eventData?.event_date ?? '', '');
    const apiTime = safeString(eventData?.event_time ?? '', '');

    const d = uiDate || toDateOnly(apiISO) || new Date().toISOString().slice(0, 10);
    const t = apiTime || uiTime || '12:00';
    const eventDateISO = new Date(`${d}T${t}:00`).toISOString();

    const cover =
      safeString(eventData?.cover_url ?? eventData?.image ?? eventData?.cover ?? eventData?.cover_image, '') || DEFAULT_EVENT_COVER;

    const payload = {
      title: safeString(eventData?.title).trim(),
      description: safeString(eventData?.description).trim(),
      event_date: eventDateISO,
      event_time: apiTime || uiTime || '12:00',
      location: safeString(eventData?.location).trim(),
      visibility: safeString(eventData?.visibility, 'worldwide'),
      cover_url: cover,
      image: cover,
      creator_id: Number(currentUser.id),
      creator_name: safeString(currentUser.name),
      creator_avatar: safeString(currentUser.profile_image_url),
      group_id: eventData?.group_id ? Number(eventData.group_id) : null,
    };

    const res = await apiFetch('/api/events', { method: 'POST', body: JSON.stringify(payload) });
    const newEvent = normalizeEvent(res?.event ?? res);
    
    setEvents((prev: any) => [newEvent, ...safeArray(prev)]);

    try {
      const eventPostPayload = {
        user_id: currentUser.id,
        content: `🎉 Check out my new event: ${newEvent.title}`,
        type: "event",
        event_id: newEvent.id,
        visibility: 'public',
        feed_key: `event:${newEvent.id}`,
        meta: {
          kind: "event",
          event_id: newEvent.id,
          event: {
            id: newEvent.id,
            title: newEvent.title,
            description: newEvent.description,
            date: newEvent.date,
            time: newEvent.time,
            location: newEvent.location,
            cover_url: newEvent.cover_url,
            attendees: newEvent.attendees || [],
            interested: newEvent.interestedIds || [],
          }
        }
      };

      const postRes = await apiFetch('/api/posts', { 
        method: 'POST', 
        body: JSON.stringify(eventPostPayload) 
      });
      
      const newPost = normalizePost(postRes?.post ?? postRes);
      
      setPosts(prev => {
        const next = [newPost, ...safeArray(prev)];
        lastGoodPostsRef.current = next;
        stableFeedRef.current = next;
        return next;
      });

      if (selectedUserId === currentUser.id) {
        setProfilePosts(prev => [newPost, ...safeArray(prev)]);
      }

      pushSeenIds([Number(newPost.id)]);
    } catch (error) {
      console.error('Failed to create event post:', error);
    }

    scheduleSilentRefresh();
    return newEvent;
  }, [currentUser, requireAuth, selectedUserId]);

  // Refresh group members helper
  const refreshGroupMembers = useCallback(async (groupId: number) => {
    try {
      const res = await apiFetch(`/api/group-members?group_id=${Number(groupId)}`);
      const members = safeArray(res?.members)
        .map((m: any) => Number(m.user_id ?? m))
        .filter(Number.isFinite);
      
      setGroups(prev => prev.map(g => {
        if (Number(g.id) !== Number(groupId)) return g;
        return { 
          ...g, 
          members, 
          members_count: members.length 
        };
      }));
    } catch (error) {
      console.error('Failed to refresh group members:', error);
    }
  }, []);

  // fetchOtherData
  const fetchOtherData = useCallback(async () => {
    if (otherDataInFlightRef.current) return;
    otherDataInFlightRef.current = true;
    
    try {
      const [pr, g, b, c] = await Promise.all([
        apiFetch('/api/products').catch(() => []),
        apiFetch('/api/groups').catch(() => []),
        apiFetch('/api/brands').catch(() => []),
        apiFetch('/api/chats').catch(() => []),
      ]);

      const prRaw = pr;
      const prList =
        Array.isArray(prRaw) ? prRaw :
        Array.isArray((prRaw as any)?.products) ? (prRaw as any).products :
        Array.isArray((prRaw as any)?.data) ? (prRaw as any).data :
        Array.isArray((prRaw as any)?.results) ? (prRaw as any).results :
        Array.isArray((prRaw as any)?.items) ? (prRaw as any).items :
        [];

      setProducts(prList.map(normalizeProduct));
      
      const gRaw = g;
      const gList = Array.isArray(gRaw)
        ? gRaw
        : Array.isArray((gRaw as any)?.groups) ? (gRaw as any).groups
        : Array.isArray((gRaw as any)?.results) ? (gRaw as any).results
        : [];
      
      setGroups(prev => {
        const byId = new Map(prev.map(g => [Number(g.id), g]));
        
        return gList.map((ng: any) => {
          const old = byId.get(Number(ng.id));
          
          const hasMembers = ng.members !== undefined && ng.members !== null && Array.isArray(ng.members);
          
          const members = hasMembers ? ng.members : old?.members;
          
          const members_count = hasMembers 
            ? ng.members.length 
            : safeNumber(ng.members_count ?? old?.members_count ?? old?.members?.length ?? 0);
          
          const is_member = ng.is_member === true ? true : 
                           ng.is_member === false ? false : 
                           old?.is_member;
          
          const category = ng.category || old?.category || 'general';
          
          return normalizeGroup({
            ...old,
            ...ng,
            members,
            members_count,
            is_member,
            category,
          });
        });
      });
      
      setBrands(safeArray(b));
      
      const eventsData = await fetchEvents().catch(() => []);
      setEvents(eventsData);
      
      setChats(safeArray(c));
    } catch (error) {
      console.error('Failed to fetch other data:', error);
    } finally {
      otherDataInFlightRef.current = false;
    }
  }, [fetchEvents]);

  const isGroupMember = useCallback((group: Group): boolean => {
    if (!currentUser) return false;
    
    const meId = Number(currentUser.id);
    
    if (group.admin_id === meId) return true;
    
    if (group.is_member === true) return true;
    if (group.is_member === false) return false;
    
    return Array.isArray(group.members) && group.members.includes(meId);
  }, [currentUser]);

  const fetchGroupPosts = useCallback(async (groupId: number) => {
    try {
      const viewerId = currentUser?.id ? Number(currentUser.id) : 0;
      const res = await apiFetch(`/api/group-posts?group_id=${groupId}&viewerId=${viewerId}`);
      
      const posts = safeArray((res as any)?.posts ?? res);
      return posts.map(normalizePost);
    } catch (error) {
      console.error('Failed to fetch group posts:', error);
      return [];
    }
  }, [currentUser]);

  const toggleGroupPostLike = useCallback(async (postId: number, type?: ReactionType) => {
    if (!requireAuth("Liking")) return { liked: false, likes_count: 0 };
    const meId = Number(currentUser!.id);
    const reactionType = type || 'like';

    try {
      const res = await apiFetch("/api/group-post-likes", {
        method: "POST",
        body: JSON.stringify({ 
          user_id: meId, 
          post_id: Number(postId),
          type: reactionType 
        })
      });

      return {
        liked: !!(res as any)?.liked,
        likes_count: Number((res as any)?.likes_count || 0),
      };
    } catch (error) {
      console.error('Failed to toggle group post like:', error);
      return { liked: false, likes_count: 0 };
    }
  }, [currentUser, requireAuth]);

  const fetchGroupPostComments = useCallback(async (postId: number) => {
    try {
      const res = await apiFetch(`/api/group-post-comments?post_id=${Number(postId)}`);
      return safeArray((res as any)?.comments);
    } catch (error) {
      console.error('Failed to fetch group comments:', error);
      return [];
    }
  }, []);

  const createGroupPostComment = useCallback(async (postId: number, text: string, parent_comment_id?: number | null) => {
    if (!requireAuth("Commenting")) return;
    const meId = Number(currentUser!.id);

    try {
      const res = await apiFetch("/api/group-post-comments", {
        method: "POST",
        body: JSON.stringify({
          user_id: meId,
          post_id: Number(postId),
          text: String(text || "").trim(),
          parent_comment_id: parent_comment_id ?? null,
        }),
      });

      return res;
    } catch (error) {
      console.error('Failed to create group comment:', error);
      throw error;
    }
  }, [currentUser, requireAuth]);

  const joinGroup = useCallback(async (groupId: number) => {
    if (!requireAuth("Joining groups")) return;
    if (!currentUser) return;

    const meId = Number(currentUser.id);

    setGroups(prev =>
      prev.map(g => {
        if (Number(g.id) !== Number(groupId)) return g;
        
        const currentMembers = Array.isArray(g.members) ? g.members : [];
        if (currentMembers.includes(meId)) return g;
        
        const nextMembers = [...currentMembers, meId];
        
        return {
          ...g,
          members: nextMembers,
          members_count: nextMembers.length,
          is_member: true,
        };
      })
    );

    try {
      const result = await apiFetch("/api/group-members", {
        method: "POST",
        body: JSON.stringify({ group_id: Number(groupId), user_id: meId, role: "member" }),
      });

      await refreshGroupMembers(groupId);
      
      return result;
    } catch (error) {
      console.error('Failed to join group:', error);
      setGroups(prev =>
        prev.map(g => {
          if (Number(g.id) !== Number(groupId)) return g;
          
          const currentMembers = Array.isArray(g.members) ? g.members : [];
          const nextMembers = currentMembers.filter(id => id !== meId);
          
          return {
            ...g,
            members: nextMembers,
            members_count: nextMembers.length,
            is_member: false,
          };
        })
      );
      setLoginError('Failed to join group');
      throw error;
    }
  }, [currentUser, requireAuth, refreshGroupMembers]);

  // Join from Groups You May Join
  const joinFromSuggestion = useCallback(async (groupId: number) => {
    const id = Number(groupId);
    if (!id) return;

    setGroupsYouMayJoin(prev =>
      prev.map(g => Number(g.id) === id ? { ...g, is_member: true } : g)
    );

    try {
      await joinGroup(id);
      setGroupsYouMayJoin(prev => prev.filter(g => Number(g.id) !== id));
    } catch (error) {
      console.error("Failed to join from suggestion:", error);
      setGroupsYouMayJoin(prev =>
        prev.map(g => Number(g.id) === id ? { ...g, is_member: false } : g)
      );
    }
  }, [joinGroup]);

  const leaveGroup = useCallback(async (groupId: number) => {
    if (!requireAuth("Leaving groups")) return;
    if (!currentUser) return;

    const meId = Number(currentUser.id);

    setGroups(prev =>
      prev.map(g => {
        if (Number(g.id) !== Number(groupId)) return g;
        
        const currentMembers = Array.isArray(g.members) ? g.members : [];
        const nextMembers = currentMembers.filter(id => id !== meId);
        
        return {
          ...g,
          members: nextMembers,
          members_count: nextMembers.length,
          is_member: false,
        };
      })
    );

    try {
      const result = await apiFetch(
        `/api/group-members?group_id=${Number(groupId)}&user_id=${meId}`,
        { method: "DELETE" }
      );

      await refreshGroupMembers(groupId);
      
      return result;
    } catch (error) {
      console.error('Failed to leave group:', error);
      setGroups(prev =>
        prev.map(g => {
          if (Number(g.id) !== Number(groupId)) return g;
          
          const currentMembers = Array.isArray(g.members) ? g.members : [];
          if (currentMembers.includes(meId)) return g;
          
          const nextMembers = [...currentMembers, meId];
          
          return {
            ...g,
            members: nextMembers,
            members_count: nextMembers.length,
            is_member: true,
          };
        })
      );
      setLoginError('Failed to leave group');
      throw error;
    }
  }, [currentUser, requireAuth, refreshGroupMembers]);

  const createGroupPost = useCallback(async (
    groupId: number, 
    text: string, 
    files?: File[] | File | null,
    metadata?: any
  ) => {
    if (!requireAuth("Posting")) return;
    const meId = Number(currentUser!.id);

    let media_url: string | null = null;
    let media_urls: string[] = [];
    let media_types: string[] = [];

    if (files) {
      const fileArray = Array.isArray(files) ? files : (files ? [files] : []);
      
      if (fileArray.length > 0) {
        try {
          const uploadPromises = fileArray.map(file => 
            uploadToCloudflareR2(file, "group-posts")
          );
          
          const uploadResults = await Promise.all(uploadPromises);
          
          media_urls = uploadResults.map(r => r.url);
          media_types = uploadResults.map(r => r.type);
          
          media_url = media_urls[0] || null;
        } catch (error) {
          console.error('Failed to upload files:', error);
          throw new Error('Failed to upload files');
        }
      }
    }

    try {
      const payload: any = {
        group_id: Number(groupId),
        user_id: meId,
        content: String(text || "").trim() || null,
        media_url,
      };
      
      if (media_urls.length > 0) {
        payload.media_urls = media_urls;
        payload.media_types = media_types;
      }

      if (metadata) {
        if (metadata.job_title) payload.job_title = metadata.job_title;
        if (metadata.company) payload.company = metadata.company;
        if (metadata.street) payload.street = metadata.street;
        if (metadata.district) payload.district = metadata.district;
        if (metadata.region) payload.region = metadata.region;
        if (metadata.country) payload.country = metadata.country;
        if (metadata.location) payload.location = metadata.location;
        if (metadata.salary) payload.salary = metadata.salary;
        if (metadata.job_type) payload.job_type = metadata.job_type;
        if (metadata.application_type) payload.application_type = metadata.application_type;
        if (metadata.application_value) payload.application_value = metadata.application_value;
        if (metadata.expiry_date) payload.expiry_date = metadata.expiry_date;

        if (metadata.price) payload.price = metadata.price;
        if (metadata.currency) payload.currency = metadata.currency;
        if (metadata.condition) payload.condition = metadata.condition;
        if (metadata.status) payload.status = metadata.status;

        if (metadata.artist) payload.artist = metadata.artist;
        if (metadata.series) payload.series = metadata.series;
        if (metadata.episode) payload.episode = metadata.episode;
        if (metadata.duration) payload.duration = metadata.duration;
      }

      console.log('Creating group post with payload:', payload);

      const result = await apiFetch("/api/group-posts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      
      return result;
    } catch (error) {
      console.error('Failed to create group post:', error);
      throw error;
    }
  }, [currentUser, requireAuth]);

  const createGroup = useCallback(async (groupData: Partial<Group>) => {
    if (!requireAuth("Creating groups")) return;
    const meId = Number(currentUser!.id);

    try {
      const res = await apiFetch("/api/groups", {
        method: "POST",
        body: JSON.stringify({
          ...groupData,
          admin_id: meId,
          description: String(groupData.description || "").trim(),
          created_at: new Date().toISOString(),
        }),
      });

      fetchOtherData().catch(() => {});
      return res;
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    }
  }, [currentUser, requireAuth, fetchOtherData]);

  const deleteGroup = useCallback(async (groupId: number) => {
    if (!requireAdmin('Deleting groups')) return;

    try {
      await apiFetch(`/api/groups?id=${Number(groupId)}`, {
        method: "DELETE",
      });

      fetchOtherData().catch(() => {});
      return true;
    } catch (error) {
      console.error('Failed to delete group:', error);
      throw error;
    }
  }, [requireAdmin, fetchOtherData]);

  const updateGroupSettings = useCallback(async (groupId: number, settings: Partial<Group>) => {
    if (!requireAuth("Updating group settings")) return;

    try {
      const res = await apiFetch(`/api/groups?id=${Number(groupId)}`, {
        method: "PUT",
        body: JSON.stringify({
          ...settings,
          description: settings.description ? String(settings.description).trim() : undefined,
        }),
      });

      fetchOtherData().catch(() => {});
      return res;
    } catch (error) {
      console.error('Failed to update group settings:', error);
      throw error;
    }
  }, [requireAuth, fetchOtherData]);

  const fetchGroupDetails = useCallback(async (groupId: number) => {
    try {
      const res = await apiFetch(`/api/groups?id=${Number(groupId)}`);
      return {
        group: normalizeGroup((res as any)?.group ?? res),
        members: safeArray((res as any)?.members),
      };
    } catch (error) {
      console.error('Failed to fetch group details:', error);
      return { group: null, members: [] };
    }
  }, []);

  const fetchGroupEvents = useCallback(async (groupId: number): Promise<Event[]> => {
    try {
      const data = await apiFetch(`/api/groups/${groupId}/events?viewerId=${currentUser?.id || 0}`);
      
      const events = safeArray(data?.events ?? data);
      return events.map(normalizeEvent);
    } catch (error) {
      console.error('Failed to fetch group events:', error);
      return [];
    }
  }, [currentUser]);

  const createGroupEvent = useCallback(async (groupId: number, eventData: Partial<Event>): Promise<Event> => {
    if (!requireAuth('Creating events')) throw new Error('Authentication required');
    if (!currentUser) throw new Error('User not authenticated');

    const title = String(eventData.title || "").trim();
    const description = String(eventData.description || "").trim();
    
    const event_date = eventData.start_time || eventData.event_date || eventData.date || new Date().toISOString();
    
    const location = String(eventData.location || "").trim();
    
    const cover_url = String(
      eventData.cover_url || 
      eventData.cover_image || 
      eventData.image || 
      DEFAULT_EVENT_COVER
    ).trim();

    if (!title) throw new Error('Event title is required');
    if (!event_date) throw new Error('Event date is required');

    const payload = {
      group_id: Number(groupId),
      creator_id: Number(currentUser.id),
      creator_name: currentUser.name,
      creator_avatar: currentUser.profile_image_url,
      title,
      description,
      event_date,
      location,
      cover_url,
      visibility: String(eventData.visibility || "worldwide"),
    };

    try {
      const data = await apiFetch(`/api/groups/${groupId}/events`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const newEvent = normalizeEvent(data?.event ?? data);
      
      setEvents(prev => [newEvent, ...safeArray(prev)]);
      
      return newEvent;
    } catch (error) {
      console.error('Failed to create group event:', error);
      throw error;
    }
  }, [currentUser, requireAuth]);

  const handleEventRSVP = useCallback(async (eventId: number, status: string): Promise<any> => {
    if (!requireAuth('RSVP to events')) return;
    if (!currentUser) return;

    let mappedStatus: "going" | "interested" | "not_going";
    
    if (status === 'going') {
      mappedStatus = 'going';
    } else if (status === 'interested') {
      mappedStatus = 'interested';
    } else {
      mappedStatus = 'not_going';
    }

    return onRSVPEvent(eventId, mappedStatus);
  }, [currentUser, requireAuth, onRSVPEvent]);

  const editGroupPost = useCallback(async (postId: number, content: string) => {
    if (!requireAuth('Editing group posts')) return;

    const meId = Number(currentUser!.id);
    const clean = String(content || '').trim();
    if (!clean) throw new Error('Content is empty');

    const res = await apiFetch(`/api/group-posts?post_id=${Number(postId)}`, {
      method: 'PUT',
      body: JSON.stringify({ 
        user_id: meId, 
        content: clean 
      }),
    });

    return res;
  }, [currentUser, requireAuth]);

  const deleteGroupPost = useCallback(async (groupId: number, postId: number) => {
    if (!requireAuth("Deleting group posts")) return;

    const meId = Number(currentUser!.id);

    try {
      await apiFetch(`/api/group-posts?post_id=${Number(postId)}&user_id=${meId}`, {
        method: "DELETE",
      });
      return true;
    } catch (error) {
      console.error('Failed to delete group post:', error);
      throw error;
    }
  }, [currentUser, requireAuth]);

  const removeGroupMember = useCallback(async (groupId: number, memberId: number) => {
    if (!requireAdmin('Removing group members')) return;

    try {
      await apiFetch(`/api/group-members?group_id=${Number(groupId)}&user_id=${Number(memberId)}`, {
        method: "DELETE",
      });
      return true;
    } catch (error) {
      console.error('Failed to remove group member:', error);
      throw error;
    }
  }, [requireAdmin]);

  const updateGroupImage = useCallback(async (groupId: number, type: 'cover' | 'profile', file: File) => {
    if (!requireAuth("Updating group image")) return;

    try {
      const uploadResult = await uploadToCloudflareR2(file, `group-${type}s`);
      const imageUrl = uploadResult.url;

      const field = type === 'cover' ? 'cover_image' : 'profile_image';
      await updateGroupSettings(groupId, { [field]: imageUrl } as any);
      return imageUrl;
    } catch (error) {
      console.error('Failed to update group image:', error);
      throw error;
    }
  }, [requireAuth, updateGroupSettings]);

  const handleLikeComment = useCallback(async (commentId: number): Promise<any> => {
    if (!requireAuth('Liking comments')) return;
    if (!currentUser) return;

    try {
      return await apiFetch(`/api/comments/${commentId}/like`, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.id }),
      });
    } catch (error) {
      console.error('Failed to like comment:', error);
      throw error;
    }
  }, [currentUser, requireAuth]);

  const inviteToGroup = useCallback(async (groupId: number, userIds: number[]) => {
    if (!requireAuth("Inviting to groups")) return;
    
    try {
      return await apiFetch("/api/group-invites", {
        method: "POST",
        body: JSON.stringify({
          group_id: Number(groupId),
          inviter_id: Number(currentUser!.id),
          invitee_ids: userIds,
        }),
      });
    } catch (error) {
      console.error('Failed to invite to group:', error);
      return { success: true, message: "Invites sent" };
    }
  }, [currentUser, requireAuth]);

  const fetchData = useCallback(
    async (viewer: User | null) => {
      await Promise.all([
        fetchUsersList(), 
        fetchPostsForHome(viewer), 
        fetchOtherData(), 
        fetchReels(),
        fetchSongs(),
        fetchStories(),
      ]);
    },
    [fetchUsersList, fetchPostsForHome, fetchOtherData, fetchReels, fetchSongs, fetchStories]
  );

  // Handle physical back button
  useEffect(() => {
    const handleBackButton = (e: PopStateEvent) => {
      e.preventDefault();
      goBack();
    };

    window.addEventListener('popstate', handleBackButton);
    
    window.history.pushState(null, '', window.location.pathname);

    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [goBack]);

  // Load ads
  useEffect(() => {
    if (currentUser) {
      fetchMyAds();
    } else {
      setAdCampaigns([]);
    }
  }, [currentUser, fetchMyAds]);

  // Initial data load
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      let viewer: User | null = null;

      try {
        const raw = localStorage.getItem(LS_USER_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const normalized = normalizeUser(saved);
          if (normalized?.id) {
            viewer = normalized;
            setCurrentUser(normalized);
            setSelectedUserId(Number(normalized.id));

            setUsers((prev) => {
              const arr = safeArray(prev);
              const exists = arr.some((x) => Number(x.id) === Number(normalized.id));
              if (exists) return arr.map((x) => (Number(x.id) === Number(normalized.id) ? normalized : x));
              return [normalized, ...arr];
            });
          }
        }
      } catch {
      }

      if (!mounted) return;
      
      await Promise.all([
        fetchUsersList(),
        fetchPostsForHome(viewer),
        fetchOtherData(),
        fetchReels(),
        fetchSongs(),
        fetchStories(),
      ]);
      
      if (!mounted) return;
      setAuthHydrated(true);
    };

    init();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Feed session management
  useEffect(() => {
    const markActive = () => {
      try {
        localStorage.setItem(FEED_LAST_ACTIVE_KEY, String(nowMs()));
      } catch {}
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        markActive();
        return;
      }

      const last = Number(localStorage.getItem(FEED_LAST_ACTIVE_KEY) || '0') || 0;
      const away = nowMs() - last;

      if (away > FEED_RETURN_THRESHOLD_MS) {
        try {
          sessionStorage.removeItem(FEED_SESSION_KEY);
        } catch {}
        fetchPostsForHome(currentUser).catch(() => {});
        fetchReels().catch(() => {});
      }
    };

    const events = ['click', 'scroll', 'keydown', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true } as any));
    document.addEventListener('visibilitychange', onVisibility);

    markActive();

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive as any));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [currentUser, fetchPostsForHome, fetchReels]);

  // Background refresh
  useEffect(() => {
    if (activeCommentsIdentity != null) return;
    if (document.visibilityState !== 'visible') return;

    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState !== 'visible') return;
      if (activeCommentsIdentity != null) return;
      await fetchPostsForHome(currentUser).catch(() => {});
      await fetchReels().catch(() => {});
    };

    const t = setInterval(tick, 30000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [currentUser, fetchPostsForHome, fetchReels, activeCommentsIdentity]);

  // Admin functions
  const verifyUser = useCallback(
    async (userId: number) => {
      if (!requireAdmin('Verify user')) return;

      setUsers((prev) =>
        prev.map((u: any) =>
          Number(u.id) === Number(userId) ? { ...u, is_verified: u.is_verified ? 0 : 1 } : u
        )
      );

      try {
        await apiFetch('/api/admin/users/verify', {
          method: 'POST',
          body: JSON.stringify({ user_id: Number(userId) }),
        });

        await fetchUsersList();
      } catch (e: any) {
        await fetchUsersList();
        setLoginError(e?.message || 'Verify failed');
      }
    },
    [requireAdmin, fetchUsersList]
  );

  const suspendUser = useCallback(
    async (userId: number, duration: '24h' | '5d' | '30d' | 'manual') => {
      if (!requireModOrAdmin('Suspend user')) return;

      try {
        await apiFetch('/api/admin/users/suspend', {
          method: 'POST',
          body: JSON.stringify({ user_id: Number(userId), duration }),
        });

        await fetchUsersList();
      } catch (e: any) {
        setLoginError(e?.message || 'Suspend failed');
      }
    },
    [requireModOrAdmin, fetchUsersList]
  );

  const deleteUserAccount = useCallback(
    async (userId: number) => {
      if (!requireAdmin('Delete account')) return;

      setUsers((prev) => prev.filter((u: any) => Number(u.id) !== Number(userId)));

      try {
        await apiFetch('/api/admin/users/delete', {
          method: 'DELETE',
          body: JSON.stringify({ user_id: Number(userId) }),
        });

        await fetchUsersList();
        fetchPostsForHome(currentUser).catch(() => {});
      } catch (e: any) {
        await fetchUsersList();
        setLoginError(e?.message || 'Delete failed');
      }
    },
    [requireAdmin, fetchUsersList, fetchPostsForHome, currentUser]
  );

  const setModeratorRole = useCallback(
    async (userId: number, role: 'moderator' | 'user') => {
      if (!requireAdmin('Change user role')) return;

      try {
        await apiFetch('/api/admin/users/role', {
          method: 'POST',
          body: JSON.stringify({ user_id: Number(userId), role }),
        });

        await fetchUsersList();
      } catch (e: any) {
        setLoginError(e?.message || 'Role change failed');
      }
    },
    [requireAdmin, fetchUsersList]
  );

  const handleHashtagClick = useCallback((tag: string) => {
    const cleanedTag = tag.startsWith('#') ? tag.toLowerCase() : `#${tag.toLowerCase()}`;
    setActiveHashtag(cleanedTag);
    navigateTo('home');
    window.scrollTo(0, 0);
  }, [navigateTo]);

  const clearHashtag = useCallback(() => {
    setActiveHashtag(null);
  }, []);

  const filteredPosts = useMemo(() => {
    if (!activeHashtag) return posts;
    
    const tagWithoutHash = activeHashtag.replace('#', '').toLowerCase();
    return posts.filter((p: any) => {
      const content = String(p.content || '').toLowerCase();
      return content.includes(`#${tagWithoutHash}`) || content.includes(` ${tagWithoutHash} `);
    });
  }, [posts, activeHashtag]);

  const rankedPosts = useMemo(() => {
    const feedToRank = stableFeedRef.current.length > 0 ? stableFeedRef.current : 
                     activeHashtag ? filteredPosts : posts;
    return Array.isArray(feedToRank) ? feedToRank : [];
  }, [posts, filteredPosts, activeHashtag]);

  // PYMK Insert Indices
  const peopleYouMayKnowInsertIndex1 = useMemo(() => {
    const total = safeArray(rankedPosts).length;

    if (total < 6) return -1;
    if (total <= 10) return total - 1;

    return 7;
  }, [rankedPosts]);

  const peopleYouMayKnowInsertIndex2 = useMemo(() => {
    const total = safeArray(rankedPosts).length;

    if (total < 22) return -1;

    return 21;
  }, [rankedPosts]);

  // Groups You May Join Insert Index
  const groupsYouMayJoinInsertIndex = useMemo(() => {
    const total = safeArray(rankedPosts).length;
    if (total < 4) return -1;
    return Math.min(3, total - 1);
  }, [rankedPosts]);

  // Transform feed items
  const feedItems = useMemo<FeedItem[]>(() => {
    const postItems = safeArray(rankedPosts).map(post => ({
      ...post,
      type: 'post' as const,
      id: post.id,
      created_at: post.created_at,
    }));

    const reelItems = safeArray(reels).map(reel => ({
      id: `reel-${reel.id}`,
      type: 'reel' as const,
      created_at: reel.created_at,
      reel: {
        id: reel.id,
        user_id: reel.userId || reel.user_id,
        author: reel.author || reel.author_name || 'User',
        avatar: reel.avatar || reel.author_image,
        verified: reel.verified || false,
        video: reel.videoUrl || reel.video_url,
        thumbnail: reel.thumbnail_url || reel.cover_url,
        caption: reel.caption,
        views: reel.views || reel.views_count || 0,
        likes: reel.likes || reel.reactions?.length || 0,
        comments: reel.comments?.length || 0,
        shares: reel.shares || 0,
        created_at: reel.created_at,
      }
    }));

    const adItems = safeArray(ads).map(ad => ({
      ...ad,
      type: 'sponsored' as const,
      id: `ad-${ad.id}`,
    }));

    // Combine posts and reels
    let combinedItems = [...postItems, ...reelItems];

    // Shuffle combined items using the same session seed as posts
    const seed = getOrCreateSessionSeed(currentUser?.id ?? null);
    combinedItems = seededShuffle(combinedItems, seed);

    // Insert ads every 5 items
    const merged: FeedItem[] = [];
    let adIndex = 0;

    for (let i = 0; i < combinedItems.length; i++) {
      merged.push(combinedItems[i]);

      if ((i + 1) % 5 === 0 && adIndex < adItems.length) {
        merged.push(adItems[adIndex]);
        adIndex++;
      }
    }

    while (adIndex < adItems.length) {
      merged.push(adItems[adIndex]);
      adIndex++;
    }

    return merged;
  }, [rankedPosts, reels, ads, currentUser]);

  const activePost = useMemo(() => {
    if (activeCommentsIdentity == null) return null;

    if (commentPostSnapshot && getFeedKey(commentPostSnapshot) === activeCommentsIdentity) {
      return commentPostSnapshot;
    }

    const source = view === 'profile' ? profilePosts : posts;
    return source.find((p: any) => getFeedKey(p) === activeCommentsIdentity) || null;
  }, [posts, profilePosts, view, activeCommentsIdentity, commentPostSnapshot]);

  const profileUser = useMemo(() => {
    if (selectedUserId) {
      return users.find((u) => Number(u.id) === Number(selectedUserId)) || null;
    }
    return currentUser || null;
  }, [selectedUserId, users, currentUser]);

  const handleRegister = useCallback(async (userData: any) => {
    try {
      setLoginError('');

      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Registration failed');
      if (!data?.user) throw new Error('Registration failed: user missing');

      const normalized = normalizeUser(data.user);
      if (!normalized?.id) throw new Error('Registration failed: invalid user id');

      localStorage.setItem(LS_USER_KEY, JSON.stringify(normalized));

      setCurrentUser(normalized);
      setSelectedUserId(Number(normalized.id));

      setUsers((prev) => {
        const arr = safeArray(prev);
        const exists = arr.some((x) => Number(x.id) === Number(normalized.id));
        if (exists) return arr.map((x) => (Number(x.id) === Number(normalized.id) ? normalized : x));
        return [normalized, ...arr];
      });

      try {
        sessionStorage.removeItem(FEED_SESSION_KEY);
      } catch {}

      navigateTo('home');
      await fetchPostsForHome(normalized);
      await fetchReels();

    } catch (error: any) {
      setLoginError(error?.message || 'Registration failed');
    }
  }, [fetchPostsForHome, fetchReels, navigateTo]);

  const handleLogin = async (email: string, password: string) => {
    try {
      setLoginError('');

      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Login failed');
      if (!data?.user) throw new Error('Login failed: user missing');

      const normalized = normalizeUser(data.user);
      if (!normalized?.id) throw new Error('Login failed: invalid user id');

      let finalUser = normalized;
      try {
        const fresh = await apiFetch(`/api/users?id=${normalized.id}`);
        finalUser = normalizeUser({ ...normalized, ...fresh });
      } catch {}

      setCurrentUser(finalUser);
      localStorage.setItem(LS_USER_KEY, JSON.stringify(finalUser));

      try {
        sessionStorage.removeItem(FEED_SESSION_KEY);
      } catch {}

      setUsers((prev) => {
        const arr = safeArray(prev);
        const exists = arr.some((x) => Number(x.id) === Number(finalUser.id));
        if (exists) return arr.map((x) => (Number(x.id) === Number(finalUser.id) ? finalUser : x));
        return [finalUser, ...arr];
      });

      setSelectedUserId(Number(finalUser.id));
      navigateTo('home');

      await fetchPostsForHome(finalUser);
      await fetchReels();
    } catch (error: any) {
      setLoginError(error?.message || 'Login failed');
    }
  };

  // followUser
  const followUser = useCallback(
    async (targetUserId: number) => {
      if (!requireAuth('Following')) return;
      if (!currentUser) return;

      const meId = Number(currentUser.id);
      const targetId = Number(targetUserId);

      if (!targetId || targetId === meId) return;

      const myFollowing = new Set<number>(safeArray<number>((currentUser as any).following));
      const isFollowingNow = myFollowing.has(targetId);

      setFollowLoading(prev => ({ ...prev, [targetId]: true }));

      const originalUsers = [...users];
      const originalCurrentUser = { ...currentUser };

      setUsers((prev) => {
        const arr = safeArray(prev).map(normalizeUser);

        return arr.map((u) => {
          const uid = Number(u.id);

          if (uid === meId) {
            const following = new Set<number>(safeArray<number>((u as any).following));
            if (isFollowingNow) following.delete(targetId);
            else following.add(targetId);
            return normalizeUser({ ...u, following: Array.from(following) });
          }

          if (uid === targetId) {
            const followers = new Set<number>(safeArray<number>((u as any).followers));
            if (isFollowingNow) followers.delete(meId);
            else followers.add(meId);
            return normalizeUser({ ...u, followers: Array.from(followers) });
          }

          return u;
        });
      });

      setCurrentUser((prev) => {
        if (!prev) return prev;
        const following = new Set<number>(safeArray<number>((prev as any).following));
        if (isFollowingNow) following.delete(targetId);
        else following.add(targetId);
        const next = normalizeUser({ ...prev, following: Array.from(following) });
        localStorage.setItem(LS_USER_KEY, JSON.stringify(next));
        return next;
      });

      try {
        if (isFollowingNow) {
          await apiFetch(`/api/user-follows?follower_id=${meId}&following_id=${targetId}`, {
            method: 'DELETE',
          });
        } else {
          await apiFetch('/api/user-follows', {
            method: 'POST',
            body: JSON.stringify({ follower_id: meId, following_id: targetId }),
          });
        }

        fetchUserFollowDataForUI(targetId).catch(() => {});
        fetchUserFollowDataForUI(meId).catch(() => {});

        scheduleSilentRefresh();
      } catch (e: any) {
        console.error('Follow toggle failed:', e);

        setUsers(originalUsers);
        setCurrentUser(originalCurrentUser);
        localStorage.setItem(LS_USER_KEY, JSON.stringify(originalCurrentUser));
        
        fetchUserFollowDataForUI(targetId).catch(() => {});
        fetchUserFollowDataForUI(meId).catch(() => {});
        
        setLoginError(`Failed to ${isFollowingNow ? 'unfollow' : 'follow'}: ${e.message || 'Unknown error'}`);
      } finally {
        setFollowLoading(prev => ({ ...prev, [targetId]: false }));
      }
    },
    [requireAuth, currentUser, users, scheduleSilentRefresh, fetchUserFollowDataForUI]
  );

  // followFromPymk
  const followFromPymk = useCallback(async (targetUserId: number) => {
    const id = Number(targetUserId);
    if (!id) return;

    setPeopleYouMayKnow(prev =>
      prev.map(u =>
        Number(u.id) === id ? { ...u, is_following: !u.is_following } : u
      )
    );

    try {
      await followUser(id);
    } catch (error) {
      console.error('Failed to follow from People You May Know:', error);
      setPeopleYouMayKnow(prev =>
        prev.map(u =>
          Number(u.id) === id ? { ...u, is_following: !u.is_following } : u
        )
      );
      fetchPeopleYouMayKnow().catch(() => {});
    }
  }, [followUser, fetchPeopleYouMayKnow]);

  const checkIsFollowing = useCallback((targetUserId: number): boolean => {
    if (!currentUser || !targetUserId) return false;
    
    const myFollowing = safeArray<number>((currentUser as any).following);
    return myFollowing.includes(Number(targetUserId));
  }, [currentUser]);

  const handleLogout = () => {
    localStorage.removeItem(LS_USER_KEY);
    localStorage.removeItem(STORY_SEEN_KEY);
    localStorage.removeItem(STORIES_CACHE_KEY);
    localStorage.removeItem(PYMK_HIDDEN_KEY);
    localStorage.removeItem(GROUPS_YOU_MAY_JOIN_HIDDEN_KEY);
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(STORY_VIEWERS_CACHE_KEY)) {
        localStorage.removeItem(key);
      }
    });

    try {
      sessionStorage.removeItem(FEED_SESSION_KEY);
    } catch {}

    setCurrentUser(null);
    setSelectedUserId(null);
    setProfilePosts([]);
    setReels([]);
    setStories([]);
    setActiveStoryId(null);
    setSeenStoryIds(new Set());
    setStoryMuted(true);
    setActiveHashtag(null);
    setLikedTracks([]);
    setMyTotalPlays(0);
    setPlayHistory([]);
    setTrackPlays({});
    setCurrentAudioTrack(null);
    setIsAudioPlaying(false);
    setSelectedReelSound(null);
    setSongs([]);
    setEvents([]);
    setActiveChatUser(null);
    setIsChatOpen(false);
    setIsChatsListOpen(false);
    setIncomingCall(null);
    setPeopleYouMayKnow([]);
    setPymkHiddenIds([]);
    setGroupsYouMayJoin([]);
    setGymjHiddenIds([]);
    setSelectedReelId(null);
    setNavigationHistory(['home']);
    setView('home');
    fetchPostsForHome(null).catch(() => {});
    fetchReels().catch(() => {});
  };

  // handleNavigate
  const handleNavigate = useCallback((target: View) => {
    if (['settings', 'memories', 'notifications', 'ads'].includes(target) && !currentUser) {
      setLoginError(`Please login to view ${target}.`);
      return setView('login');
    }

    if (target === 'profile') {
      if (!currentUser) {
        setLoginError('Please login to view your profile.');
        return setView('login');
      }
      openProfile(currentUser.id);
      return;
    }

    navigateTo(target);
  }, [currentUser, navigateTo, openProfile]);

  // ============================================================================
  // ✅ UPDATED CREATE POST - With image compression for thumb/feed/full URLs
  // ============================================================================
  const createPost = useCallback(
    async (
      text: string,
      files: File[] | File | null,
      meta?: {
        type?: 'text' | 'image' | 'video';
        visibility?: string;
        location?: string;
        feeling?: string;
        taggedUsers?: number[];
        background?: string;
        linkPreview?: any;
      }
    ) => {
      if (!requireAuth('Creating posts')) return;

      const trimmed = (text || '').trim();
      if (!trimmed && !files && !meta?.background) return;

      const list: File[] = Array.isArray(files) ? files : (files ? [files] : []);

      let media_urls: string[] = [];
      let media_types: string[] = [];
      let media_meta: any[] = [];
      let media_url: string | null = null;
      let media_type: string | null = null;

      try {
        // IMAGE POSTS -> compress in browser, upload bundled thumb/feed/full
        if (meta?.type === 'image' && list.length) {
          const uploadedItems = await Promise.all(
            list.map(async (file) => {
              const bundle = await buildImageUploadBundle(file);
              const form = new FormData();
              form.append('thumbnail', bundle.thumb);
              form.append('feed', bundle.feed);
              form.append('original', bundle.full);

              const data = await apiFetch('/api/upload', {
                method: 'POST',
                body: form,
              });

              const thumb = data?.uploaded?.thumbnail?.url || data?.media_urls?.thumb || '';
              const feed = data?.uploaded?.feed?.url || data?.media_urls?.feed || '';
              const full = data?.uploaded?.original?.url || data?.media_urls?.full || data?.url || '';

              if (!feed) {
                throw new Error('Image upload failed: missing feed URL');
              }

              return {
                thumb,
                feed,
                full: full || feed,
                type: 'image',
              };
            })
          );

          // Store plain feed URLs in media_urls for compatibility
          media_urls = uploadedItems.map((item) => item.feed).filter(Boolean);
          // Store rich objects separately in media_meta
          media_meta = uploadedItems.map((item) => ({
            thumb: item.thumb,
            feed: item.feed,
            full: item.full,
            type: 'image',
          }));
          media_types = uploadedItems.map(() => 'image');
          media_url = uploadedItems[0]?.feed || null;
          media_type = 'image';
        }
        // NON-IMAGE POSTS -> keep old upload flow
        else if (list.length) {
          const ups = await Promise.all(list.map((f) => uploadToCloudflareR2(f)));
          media_urls = ups.map((u) => u.url).filter(Boolean);
          media_types = ups.map((u) => u.type).filter(Boolean);
          media_url = media_urls[0] ?? null;
          media_type = media_types[0] ?? null;
        }
      } catch (error: any) {
        setLoginError(`Failed to upload files: ${error?.message || 'Upload error'}`);
        return;
      }

      const payload: any = {
        user_id: currentUser!.id,
        content: trimmed,
        media_url,
        media_type,
        media_urls: media_urls.length ? media_urls : undefined,
        media_types: media_types.length ? media_types : undefined,
        media_meta: media_meta.length ? media_meta : undefined,
        visibility: meta?.visibility ?? 'public',
        location: meta?.location,
        feeling: meta?.feeling,
        tagged_users: meta?.taggedUsers,
        background: meta?.background,
        link_preview: meta?.linkPreview,
        feed_key: `post:${Date.now()}`,
        type: (() => {
          const t = media_type || media_types[0] || null;
          if (!t) return meta?.type || 'text';
          if (typeof t === 'string' && t.startsWith('image')) return 'image';
          if (typeof t === 'string' && t.startsWith('video')) return 'video';
          if (typeof t === 'string' && t.startsWith('audio')) return 'audio';
          return meta?.type || 'text';
        })(),
      };

      const data = await apiFetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const newPostRaw = data?.post ?? {
        ...payload,
        post_id: data?.post_id ?? data?.id ?? Date.now(),
        created_at: new Date().toISOString(),
      };

      (newPostRaw as any).media_urls = (newPostRaw as any).media_urls || (media_urls.length ? media_urls : media_url ? [media_url] : []);
      (newPostRaw as any).media_types = (newPostRaw as any).media_types || (media_types.length ? media_types : media_type ? [media_type] : []);
      (newPostRaw as any).media_meta = (newPostRaw as any).media_meta || (media_meta.length ? media_meta : undefined);

      const normalized = normalizePost(newPostRaw);

      setPosts((prev) => {
        const next = [normalized, ...safeArray(prev)];
        lastGoodPostsRef.current = next;
        stableFeedRef.current = next;
        return next;
      });

      setProfilePosts((prev) => {
        if (!currentUser) return prev;
        const isMyProfile = Number(selectedUserId) === Number(currentUser.id);
        if (!isMyProfile) return prev;

        const next = [normalized, ...safeArray(prev)];
        return next;
      });

      pushSeenIds([Number((normalized as any).id)]);

      setShowCreatePostModal(false);
      scheduleSilentRefresh();
    },
    [currentUser, requireAuth, scheduleSilentRefresh, selectedUserId]
  );

  // Update user details
  const updateUserDetails = useCallback(
    async (data: Partial<User>) => {
      if (!requireAuth('Updating profile')) return;
      if (!currentUser) return;

      await apiFetch(`/api/users`, {
        method: 'PUT',
        body: JSON.stringify({ id: currentUser.id, ...data }),
      });

      const merged = normalizeUser({ ...currentUser, ...data });
      setCurrentUser(merged);
      localStorage.setItem(LS_USER_KEY, JSON.stringify(merged));

      setUsers((prev) => safeArray(prev).map((u) => (Number(u.id) === Number(merged.id) ? merged : u)));
    },
    [requireAuth, currentUser]
  );

  // Update profile image
  const updateProfileImage = useCallback(
    async (file: File) => {
      if (!requireAuth('Updating profile')) return;
      if (!currentUser) return;

      if (!file.type || !file.type.startsWith('image/')) {
        setLoginError('Only image files are allowed.');
        return;
      }

      try {
        const uploadResult = await uploadToCloudflareR2(file, 'profiles');
        await updateUserDetails({ profile_image_url: uploadResult.url } as any);
      } catch (error: any) {
        setLoginError(`Failed to upload profile image: ${error.message}`);
      }
    },
    [requireAuth, currentUser, updateUserDetails]
  );

  // Update cover image
  const updateCoverImage = useCallback(
    async (file: File) => {
      if (!requireAuth('Updating profile')) return;
      if (!currentUser) return;

      if (!file.type || !file.type.startsWith('image/')) {
        setLoginError('Only image files are allowed.');
        return;
      }

      try {
        const uploadResult = await uploadToCloudflareR2(file, 'covers');
        await updateUserDetails({ cover_image_url: uploadResult.url } as any);
      } catch (error: any) {
        setLoginError(`Failed to upload cover image: ${error.message}`);
      }
    },
    [requireAuth, currentUser, updateUserDetails]
  );

  // Get post author
  const getPostAuthor = useCallback(
    (post: PostType) => {
      const author = users.find((u) => Number(u.id) === Number((post as any).user_id));
      if (author) return author;
      return createFallbackUser();
    },
    [users]
  );

  // Create story from profile
  const handleCreateStoryFromProfile = useCallback(() => {
    if (!requireAuth('Creating stories')) return;
    setShowCreateStoryModal(true);
  }, [requireAuth]);

  // All known posts
  const allKnownPosts = useMemo(() => {
    const map = new Map<number, PostType>();
    [...safeArray(posts), ...safeArray(profilePosts)].forEach(p => {
      if (p?.id) {
        map.set(Number(p.id), p);
      }
    });
    return Array.from(map.values());
  }, [posts, profilePosts]);

  // Open product from post
  const openProductFromPost = useCallback(
    (productId: number) => {
      const p = (products || []).find((x: any) => Number(x.id) === Number(productId));
      if (!p) {
        navigateTo('marketplace');
        return;
      }
      navigateTo('marketplace');
      setActiveProduct(p);
    },
    [products, navigateTo]
  );

  const isLoading = false;
  if (isLoading) return <ProfessionalLoader />;

  // Get product data
  const getProductData = useCallback((productId: number) => {
    const product = products.find(p => Number(p.id) === Number(productId));
    if (!product) return null;
    return {
      price: product.discount_price ?? product.main_price,
      location: product.address || 'Marketplace',
      currency: product.currency_symbol || 'TZS'
    };
  }, [products]);

  // Handle video click
  const handleVideoClick = useCallback((item: any) => {
    const videoId = resolveVideoId(item);
    if (!videoId) {
      console.warn('Could not resolve video ID for item:', item);
      return;
    }
    
    setSelectedReelId(videoId);
    navigateTo('reels');
  }, [navigateTo]);

  // Handle photo click
  const handlePhotoClick = useCallback(() => {
    if (!requireAuth('Creating posts')) return;
    setShowCreatePostModal(true);
  }, [requireAuth]);

 const handleVideoClickFromCreate = useCallback(() => {
  if (!requireAuth('Creating videos')) return;
  reelVideoInputRef.current?.click();
}, [requireAuth]);

const handleReelVideoSelected = useCallback(
  (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }

    setPendingReelFile(file);
    setView('recorder');
  },
  []
);
    const openReelRecorderFromReels = useCallback((sound?: UseSoundPayload) => {
  if (sound) {
    setSelectedReelSound({
      songName: sound.songName || 'Original Sound',
      audioUrl: sound.audioUrl || '',
      originalUrl: sound.originalUrl || sound.audioUrl || '',
      audioStart: sound.audioStart || 0,
      audioEnd: sound.audioEnd || 0,
      songId: sound.songId,
      soundKey:
        sound.soundKey ||
        (sound.songId ? `song:${sound.songId}` : `original:${Date.now()}`),
      isTrimmedAudio: !!sound.isTrimmedAudio,
    });
  } else {
    setSelectedReelSound(null);
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';

  input.onchange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingReelFile(file);
    setView('recorder');
  };

  input.click();
}, []);

  // Event Detail Modal
  const EventDetailModal = useCallback(({ eventId, onClose }: { eventId: number; onClose: () => void }) => {
    const event = events.find(e => e.id === eventId);
    
    if (!event) return null;
    
    return (
      <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-[#242526] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="relative h-64">
            <img 
              src={event.cover_url || DEFAULT_EVENT_COVER} 
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80"
            >
              <i className="fas fa-times text-white"></i>
            </button>
          </div>
          <div className="p-6">
            <h2 className="text-2xl font-black text-white mb-2">{event.title}</h2>
            <p className="text-[#B0B3B8] mb-4">{event.description}</p>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-[#B0B3B8]">
                <i className="fas fa-calendar-alt w-5 text-[#1877F2]"></i>
                <span>{new Date(event.event_date).toLocaleDateString()} at {event.time}</span>
              </div>
              {event.location && (
                <div className="flex items-center gap-3 text-[#B0B3B8]">
                  <i className="fas fa-map-marker-alt w-5 text-[#F02849]"></i>
                  <span>{event.location}</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  onRSVPEvent(event.id, event.user_rsvp_status === 'going' ? 'not_going' : 'going');
                  onClose();
                }}
                className={`flex-1 py-3 rounded-lg font-bold ${
                  event.user_rsvp_status === 'going'
                    ? 'bg-[#45BD62] text-white'
                    : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                }`}
              >
                {event.user_rsvp_status === 'going' ? '✓ Going' : 'Going'}
              </button>
              <button
                onClick={() => {
                  onRSVPEvent(event.id, event.user_rsvp_status === 'interested' ? 'not_going' : 'interested');
                  onClose();
                }}
                className={`flex-1 py-3 rounded-lg font-bold ${
                  event.user_rsvp_status === 'interested'
                    ? 'bg-[#F7B928] text-black'
                    : 'bg-[#3A3B3C] text-white hover:bg-[#4E4F50]'
                }`}
              >
                {event.user_rsvp_status === 'interested' ? '✓ Interested' : 'Interested'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }, [events, onRSVPEvent]);

  // ============================================================================
  // ✅ HYBRID REACT HANDLER - Supports both numeric ID and full object
  // ============================================================================
  const reactToFeedItem = useCallback(async (item: any, type: ReactionType) => {
    if (!requireAuth('Reacting')) return;
    if (!currentUser || !item) return;

    // Get identity and ID safely
    let identity = '';
    let itemId = 0;
    let itemType = 'post';
    
    try {
      identity = getFeedKey(item);
      itemId = getFeedItemId(item);
      itemType = getFeedItemType(item);
    } catch (error) {
      console.error('Failed to get feed identity:', error);
      // Fallback to treating as post with ID
      if (typeof item === 'number') {
        itemId = item;
        identity = `post:${item}`;
      } else if (item?.id) {
        itemId = Number(item.id);
        identity = `post:${itemId}`;
      } else {
        return;
      }
      itemType = 'post';
    }
    
    const meId = currentUser.id;

    // Prevent multiple taps
    if (reactingMap[identity]) return;

    // Get current item from appropriate source
    const sourceList = view === 'profile' ? profilePosts : posts;
    const previousItem = safeArray(sourceList).find((p: any) => {
      try {
        return getFeedKey(p) === identity;
      } catch {
        return Number(p?.id) === itemId;
      }
    }) || item;
    
    if (!previousItem) return;

    // Helper to replace item by identity or ID
    const replaceItem = (list: any[], replacement: any) => 
      safeArray(list).map(p => {
        try {
          if (getFeedKey(p) === identity) return replacement;
        } catch {
          if (Number(p?.id) === itemId) return replacement;
        }
        return p;
      });

    // Set reacting lock
    setReacting(identity, true);

    // Apply optimistic update
    const optimisticItem = applyOptimisticReaction(previousItem, identity, type, meId);
    setPosts(prev => replaceItem(prev, optimisticItem));
    setProfilePosts(prev => replaceItem(prev, optimisticItem));
    
    if (activeCommentsIdentity === identity) {
      setCommentPostSnapshot(optimisticItem);
    }

    try {
      let endpoint = '';
      switch (itemType) {
        case 'event':
          endpoint = `/api/events/${itemId}/react`;
          break;
        case 'group_post':
          endpoint = `/api/groups/${item.group_id}/posts/${itemId}/react`;
          break;
        case 'product':
          endpoint = `/api/products/${itemId}/react`;
          break;
        case 'reel':
          endpoint = `/api/reels/${itemId}/react`;
          break;
        case 'music':
          endpoint = `/api/songs/${itemId}/react`;
          break;
        case 'podcast':
          endpoint = `/api/podcasts/${itemId}/react`;
          break;
        default:
          endpoint = `/api/posts/${itemId}/react`;
      }

      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ type, user_id: meId }),
      });

      if (data?.success && ('reactions_count' in data || 'my_reaction' in data)) {
        const serverMy = data.my_reaction ?? null;
        const serverCount = safeNumber(data.reactions_count, 0);

        const applyServerTruth = (p: any) => {
          try {
            if (getFeedKey(p) !== identity) return p;
          } catch {
            if (Number(p?.id) !== itemId) return p;
          }

          const prevArr = safeArray<any>(p?.reactions);
          const withoutMe = prevArr.filter((r: any) => Number(r?.user_id) !== meId);
          const nextArr = serverMy ? [...withoutMe, { user_id: meId, type: serverMy }] : withoutMe;

          return {
            ...p,
            reactions: nextArr,
            my_reaction: serverMy,
            myReaction: serverMy,
            reactions_count: serverCount,
            reactionsCount: serverCount,
            likesCount: serverCount,
          };
        };

        setPosts(prev => safeArray(prev).map(applyServerTruth));
        setProfilePosts(prev => safeArray(prev).map(applyServerTruth));
        setCommentPostSnapshot(prev => prev ? applyServerTruth(prev) : prev);
      }
    } catch (error) {
      console.error('Failed to react:', error);
      // Restore previous state on failure
      setPosts(prev => replaceItem(prev, previousItem));
      setProfilePosts(prev => replaceItem(prev, previousItem));
      setCommentPostSnapshot(prev => prev && getFeedKey(prev) === identity ? previousItem : prev);
    } finally {
      setReacting(identity, false);
    }
  }, [currentUser, requireAuth, reactingMap, view, posts, profilePosts, activeCommentsIdentity, setReacting]);

  // ============================================================================
  // ✅ HYBRID COMMENT HANDLERS
  // ============================================================================
  
  const fetchComments = useCallback(async (item: any) => {
    if (!requireAuth('Viewing comments')) return [];
    if (!item) return [];
    
    let type = 'post';
    let id = 0;
    
    try {
      type = getFeedItemType(item);
      id = getFeedItemId(item);
    } catch {
      type = 'post';
      id = Number(item?.id ?? 0);
    }
    
    try {
      let endpoint = '';
      switch (type) {
        case 'event':
          endpoint = `/api/events/${id}/comments?viewerId=${currentUser?.id || 0}`;
          break;
        case 'group_post':
          endpoint = `/api/groups/${item.group_id}/posts/${id}/comments?viewerId=${currentUser?.id || 0}`;
          break;
        case 'product':
          endpoint = `/api/products/${id}/reviews?viewerId=${currentUser?.id || 0}`;
          break;
        case 'reel':
          endpoint = `/api/reels/${id}/comments?viewerId=${currentUser?.id || 0}`;
          break;
        case 'music':
          endpoint = `/api/songs/${id}/comments?viewerId=${currentUser?.id || 0}`;
          break;
        case 'podcast':
          endpoint = `/api/podcasts/${id}/comments?viewerId=${currentUser?.id || 0}`;
          break;
        default:
          endpoint = `/api/posts/${id}/comments?viewerId=${currentUser?.id || 0}`;
      }
      
      const data = await apiFetch(endpoint);
      return safeArray(data?.comments ?? data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      return [];
    }
  }, [currentUser, requireAuth]);

  const handleOpenComments = useCallback((item: any) => {
    if (!requireAuth('Viewing comments')) return;
    if (!item) return;
    
    let identity = '';
    try {
      identity = getFeedKey(item);
    } catch {
      identity = `post:${item?.id}`;
    }
    
    setActiveCommentsIdentity(identity);
    
    const source = view === 'profile' ? profilePosts : posts;
    let found = null;
    
    try {
      found = source.find((p: any) => getFeedKey(p) === identity) || null;
    } catch {
      found = source.find((p: any) => Number(p?.id) === Number(item?.id)) || null;
    }
    
    setCommentPostSnapshot(found || item);
  }, [requireAuth, view, posts, profilePosts]);

  const handleCloseComments = useCallback(() => {
    setActiveCommentsIdentity(null);
    setCommentPostSnapshot(null);
  }, []);

  const createComment = useCallback(async (
    item: any,
    text: string,
    parentCommentId: number | null = null,
    imageFile?: File | null
  ) => {
    if (!requireAuth('Commenting')) return null;
    if (!currentUser) return null;
    if (!text?.trim() && !imageFile) {
      setLoginError('Comment cannot be empty');
      return null;
    }

    let identity = '';
    let type = 'post';
    let id = 0;
    
    try {
      identity = getFeedKey(item);
      type = getFeedItemType(item);
      id = getFeedItemId(item);
    } catch {
      identity = `post:${item?.id}`;
      type = 'post';
      id = Number(item?.id ?? 0);
    }

    try {
      let image_url = '';

      if (imageFile) {
        image_url = await ensureR2Url(
          imageFile,
          'comments',
          `comment-${Date.now()}.jpg`
        );
      }

      let endpoint = '';
      let payload: any = {};

      switch (type) {
        case 'event':
          endpoint = `/api/events/${id}/comment`;
          payload = {
            user_id: currentUser.id,
            text: text || '',
            parent_comment_id: parentCommentId ?? null,
            image_url: image_url || '',
          };
          break;
        case 'group_post':
          endpoint = `/api/groups/${item.group_id}/posts/${id}/comment`;
          payload = {
            user_id: currentUser.id,
            text: text || '',
            parent_comment_id: parentCommentId ?? null,
            image_url: image_url || '',
          };
          break;
        case 'product':
          endpoint = `/api/products/${id}/review`;
          payload = {
            user_id: currentUser.id,
            rating: null,
            text: text || '',
            parent_comment_id: parentCommentId ?? null,
            image_url: image_url || '',
          };
          break;
        case 'reel':
          endpoint = `/api/reels/${id}/comment`;
          payload = {
            user_id: currentUser.id,
            text: text || '',
            parent_comment_id: parentCommentId ?? null,
            image_url: image_url || '',
          };
          break;
        default:
          endpoint = `/api/posts/${id}/comment`;
          payload = {
            user_id: currentUser.id,
            text: text || '',
            parent_comment_id: parentCommentId ?? null,
            image_url: image_url || '',
          };
      }

      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const newComment: any = {
        id: safeNumber(data?.comment?.id ?? 0),
        user_id: currentUser.id,
        parent_comment_id: parentCommentId ?? null,
        text: text || '',
        image_url: image_url || '',
        created_at: data?.comment?.created_at ?? new Date().toISOString(),
        user: {
          id: currentUser.id,
          name: currentUser.name,
          username: currentUser.username,
          profile_image_url: currentUser.profile_image_url,
          is_verified: currentUser.is_verified,
        },
        likes_count: 0,
        liked_by_me: false,
        replies: [],
        replies_count: 0,
      };

      // Add type-specific ID field
      switch (type) {
        case 'event':
          newComment.event_id = id;
          break;
        case 'product':
          newComment.product_id = id;
          break;
        case 'reel':
          newComment.reel_id = id;
          break;
        default:
          newComment.post_id = id;
      }

      // Update posts state with new comment using identity
      const updatePostsWithComment = (postsList: any[]) => {
        return postsList.map(post => {
          try {
            if (getFeedKey(post) !== identity) return post;
          } catch {
            if (Number(post?.id) !== id) return post;
          }
          
          const existingComments = safeArray((post as any).comments);
          return {
            ...post,
            comments: [newComment, ...existingComments],
            comments_count: safeNumber((post as any).comments_count) + 1,
          };
        });
      };

      setPosts(prev => updatePostsWithComment(safeArray(prev)));
      
      if (view === 'profile' && selectedUserId) {
        setProfilePosts(prev => updatePostsWithComment(safeArray(prev)));
      }

      if (activeCommentsIdentity === identity && commentPostSnapshot) {
        setCommentPostSnapshot(prev => {
          if (!prev) return prev;
          const existingComments = safeArray((prev as any).comments);
          return {
            ...prev,
            comments: [newComment, ...existingComments],
            comments_count: safeNumber((prev as any).comments_count) + 1,
          } as any;
        });
      }

      return newComment;
    } catch (error) {
      console.error('Failed to create comment:', error);
      setLoginError('Failed to post comment');
      return null;
    }
  }, [currentUser, requireAuth, view, selectedUserId, activeCommentsIdentity, commentPostSnapshot]);

  const editComment = useCallback(async (
    commentId: number,
    text: string,
    imageFile?: File | null,
    existingImageUrl?: string
  ) => {
    if (!requireAuth('Editing comments')) return null;
    if (!currentUser) return null;

    try {
      let image_url = existingImageUrl || '';

      if (imageFile) {
        image_url = await ensureR2Url(
          imageFile,
          'comments',
          `comment-edit-${Date.now()}.jpg`
        );
      }

      const data = await apiFetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          user_id: currentUser.id,
          text: text || '',
          image_url,
        }),
      });

      const updatedComment = data?.comment || {};

      const updateCommentInPosts = (postsList: any[]) => {
        return postsList.map(post => ({
          ...post,
          comments: safeArray(post.comments).map((comment: any) => {
            if (Number(comment.id) !== Number(commentId)) return comment;
            return {
              ...comment,
              text: updatedComment.text ?? text ?? comment.text,
              image_url: updatedComment.image_url ?? image_url ?? comment.image_url,
            };
          }),
        }));
      };

      setPosts(prev => updateCommentInPosts(safeArray(prev)));
      
      if (view === 'profile') {
        setProfilePosts(prev => updateCommentInPosts(safeArray(prev)));
      }

      if (activeCommentsIdentity && commentPostSnapshot) {
        setCommentPostSnapshot(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            comments: safeArray((prev as any).comments).map((comment: any) => {
              if (Number(comment.id) !== Number(commentId)) return comment;
              return {
                ...comment,
                text: updatedComment.text ?? text ?? comment.text,
                image_url: updatedComment.image_url ?? image_url ?? comment.image_url,
              };
            }),
          } as any;
        });
      }

      return updatedComment;
    } catch (error) {
      console.error('Failed to edit comment:', error);
      setLoginError('Failed to edit comment');
      return null;
    }
  }, [currentUser, requireAuth, view, activeCommentsIdentity, commentPostSnapshot]);

  const deleteComment = useCallback(async (commentId: number) => {
    if (!requireAuth('Deleting comments')) return false;
    if (!currentUser) return false;

    try {
      await apiFetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: currentUser.id }),
      });

      const removeCommentFromPosts = (postsList: any[]) => {
        return postsList.map(post => {
          const before = safeArray(post.comments);
          
          const filtered = before.filter((comment: any) => {
            const commentIdNum = Number(comment.id);
            const parentId = Number(comment.parent_comment_id);
            return commentIdNum !== Number(commentId) && parentId !== Number(commentId);
          });
          
          const removedCount = before.length - filtered.length;
          
          if (removedCount === 0) return post;
          
          return {
            ...post,
            comments: filtered,
            comments_count: Math.max(0, safeNumber(post.comments_count) - removedCount),
          };
        });
      };

      setPosts(prev => removeCommentFromPosts(safeArray(prev)));
      
      if (view === 'profile') {
        setProfilePosts(prev => removeCommentFromPosts(safeArray(prev)));
      }

      if (activeCommentsIdentity && commentPostSnapshot) {
        setCommentPostSnapshot(prev => {
          if (!prev) return prev;
          const before = safeArray((prev as any).comments);
          const filtered = before.filter((comment: any) => {
            const commentIdNum = Number(comment.id);
            const parentId = Number(comment.parent_comment_id);
            return commentIdNum !== Number(commentId) && parentId !== Number(commentId);
          });
          
          return {
            ...prev,
            comments: filtered,
            comments_count: filtered.length,
          } as any;
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to delete comment:', error);
      setLoginError('Failed to delete comment');
      return false;
    }
  }, [currentUser, requireAuth, view, activeCommentsIdentity, commentPostSnapshot]);

  const likeComment = useCallback(async (commentId: number) => {
    if (!requireAuth('Liking comments')) return null;
    if (!currentUser) return null;

    const updateCommentLike = (comment: any) => {
      const currentlyLiked = comment.liked_by_me;
      return {
        ...comment,
        liked_by_me: !currentlyLiked,
        likes_count: currentlyLiked 
          ? Math.max(0, (comment.likes_count || 0) - 1)
          : (comment.likes_count || 0) + 1,
      };
    };

    const updateLikesInPosts = (postsList: any[]) => {
      return postsList.map(post => ({
        ...post,
        comments: safeArray(post.comments).map((comment: any) => {
          if (Number(comment.id) !== Number(commentId)) return comment;
          return updateCommentLike(comment);
        }),
      }));
    };

    setPosts(prev => updateLikesInPosts(safeArray(prev)));
    
    if (view === 'profile') {
      setProfilePosts(prev => updateLikesInPosts(safeArray(prev)));
    }

    if (activeCommentsIdentity && commentPostSnapshot) {
      setCommentPostSnapshot(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          comments: safeArray((prev as any).comments).map((comment: any) => {
            if (Number(comment.id) !== Number(commentId)) return comment;
            return updateCommentLike(comment);
          }),
        } as any;
      });
    }

    try {
      const data = await apiFetch(`/api/comments/${commentId}/like`, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.id }),
      });
      
      return data;
    } catch (error) {
      console.error('Failed to like comment:', error);
      if (commentPostSnapshot) {
        refreshComments(commentPostSnapshot).catch(() => {});
      }
      return null;
    }
  }, [currentUser, requireAuth, view, activeCommentsIdentity, commentPostSnapshot]);

  const fetchCommentReplies = useCallback(async (commentId: number) => {
    if (!requireAuth('Viewing replies')) return [];
    
    try {
      const data = await apiFetch(`/api/comments/${commentId}/replies`);
      return safeArray(data?.replies ?? data);
    } catch (error) {
      console.error('Failed to fetch replies:', error);
      return [];
    }
  }, [requireAuth]);

  const getCommentAuthor = useCallback((userId: number) => {
    return users.find(u => Number(u.id) === Number(userId)) || null;
  }, [users]);

  const refreshComments = useCallback(async (item: any) => {
    if (!item) return [];
    
    let identity = '';
    let id = 0;
    
    try {
      identity = getFeedKey(item);
      id = getFeedItemId(item);
    } catch {
      identity = `post:${item?.id}`;
      id = Number(item?.id ?? 0);
    }
    
    const freshComments = await fetchComments(item);
    
    const updateCommentsInPosts = (postsList: any[]) => {
      return postsList.map(post => {
        try {
          if (getFeedKey(post) !== identity) return post;
        } catch {
          if (Number(post?.id) !== id) return post;
        }
        return {
          ...post,
          comments: freshComments,
          comments_count: freshComments.length,
        };
      });
    };
    
    setPosts(prev => updateCommentsInPosts(safeArray(prev)));
    
    if (view === 'profile') {
      setProfilePosts(prev => updateCommentsInPosts(safeArray(prev)));
    }
    
    if (activeCommentsIdentity === identity && commentPostSnapshot) {
      setCommentPostSnapshot(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          comments: freshComments,
          comments_count: freshComments.length,
        } as any;
      });
    }
    
    return freshComments;
  }, [fetchComments, view, activeCommentsIdentity, commentPostSnapshot]);

  // ============================================================================
  // ✅ ORIGINAL FUNCTIONS (Preserved)
  // ============================================================================

  const onReactPost = useCallback((postId: number, type: ReactionType) => {
    const post = posts.find(p => p.id === postId) || profilePosts.find(p => p.id === postId);
    if (post) {
      reactToFeedItem(post, type);
    }
  }, [posts, profilePosts, reactToFeedItem]);

  const handleOpenShareSheet = useCallback(
    (post: any) => {
      if (!currentUser) {
        setLoginError('Please login to share posts.');
        setView('login');
        return;
      }
      setActiveSharePost(post);
      setShowShareSheet(true);
    },
    [currentUser]
  );

  const handleShareComplete = useCallback(
    async (destination: string, data?: any) => {
      if (data?.success && activeSharePost) {
        setPosts((prev) => {
          const next = safeArray(prev).map((p: any) =>
            Number(p.id) === Number(activeSharePost.id)
              ? normalizePost({ ...p, shares: safeNumber(p.shares) + 1 })
              : p
          );
          lastGoodPostsRef.current = next;
          stableFeedRef.current = next;
          return next;
        });

        setProfilePosts((prev) => {
          return safeArray(prev).map((p: any) =>
            Number(p.id) === Number(activeSharePost.id)
              ? normalizePost({ ...p, shares: safeNumber(p.shares) + 1 })
              : p
          );
        });

        try {
          await apiFetch(`/api/posts/${activeSharePost.id}/share`, {
            method: 'POST',
            body: JSON.stringify({ destination }),
          });
        } catch (error) {
          console.error('Failed to record share:', error);
        }
      }

      setShareInProgress(false);
      setActiveSharePost(null);
      setShowShareSheet(false);
      scheduleSilentRefresh();
    },
    [activeSharePost, scheduleSilentRefresh]
  );

  const deletePost = useCallback(
    async (postId: number) => {
      if (!requireAuth('Deleting posts')) return;

      const prev = posts;
      const prevProfilePosts = profilePosts;
      
      setPosts((p) => {
        const next = safeArray(p).filter((x: any) => Number(x.id) !== Number(postId));
        lastGoodPostsRef.current = next;
        stableFeedRef.current = next;
        return next;
      });

      setProfilePosts((prev) => safeArray(prev).filter((x: any) => Number(x.id) !== Number(postId)));

      try {
        await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
      } catch {
        setPosts(prev);
        lastGoodPostsRef.current = prev;
        stableFeedRef.current = prev;
        
        setProfilePosts(prevProfilePosts);
        if (view === 'profile' && selectedUserId) fetchProfilePosts(Number(selectedUserId)).catch(() => {});
      }
    },
    [requireAuth, posts, profilePosts, view, selectedUserId, fetchProfilePosts]
  );

  const editPost = useCallback(
    async (postId: number, content: string) => {
      if (!requireAuth('Editing posts')) return;
      const trimmed = (content || '').trim();
      if (!trimmed) return;

      const prev = posts;
      const prevProfilePosts = profilePosts;
      
      setPosts((p) => {
        const next = safeArray(p).map((x: any) =>
          Number(x.id) === Number(postId) ? normalizePost({ ...x, content: trimmed }) : x
        );
        lastGoodPostsRef.current = next;
        stableFeedRef.current = next;
        return next;
      });

      setProfilePosts((prev) =>
        safeArray(prev).map((x: any) => (Number(x.id) === Number(postId) ? normalizePost({ ...x, content: trimmed }) : x))
      );

      try {
        await apiFetch(`/api/posts/${postId}`, { method: 'PATCH', body: JSON.stringify({ content: trimmed }) });
      } catch {
        setPosts(prev);
        lastGoodPostsRef.current = prev;
        stableFeedRef.current = prev;
        
        setProfilePosts(prevProfilePosts);
        if (view === 'profile' && selectedUserId) fetchProfilePosts(Number(selectedUserId)).catch(() => {});
      }
    },
    [requireAuth, posts, profilePosts, view, selectedUserId, fetchProfilePosts]
  );

  // ============================================================================
  // ✅ RENDER
  // ============================================================================
  return (
    <div className="bg-[#18191A] min-h-screen flex flex-col font-sans">
      <Header
        onHomeClick={() => handleNavigate('home')}
        onProfileClick={(id: number) => openProfile(id)}
        onReelsClick={() => navigateTo('reels')}
        onMarketplaceClick={() => navigateTo('marketplace')}
        onGroupsClick={() => navigateTo('groups')}
        onAdsClick={() => {
          if (!currentUser) {
            setLoginError('Please login to access ads dashboard.');
            setView('login');
            return;
          }
          navigateTo('ads');
          setActiveAdTab('dashboard');
        }}
        currentUser={currentUser}
        notifications={notifications}
        users={users}
        onLogout={handleLogout}
        onLoginClick={() => setView('login')}
        onMarkNotificationsRead={() => {}}
        activeTab={activeTab}
        onNavigate={(v: any) => handleNavigate(v)}
        unreadNotifications={unreadNotifications}
        onNotificationClick={() => {
          navigateTo('notifications');
          markNotificationsRead();
        }}
        showBackButton={view !== 'home'}
        onBack={goBack}
        currentView={view}
      />

      <div className="flex justify-center w-full max-w-[1920px] mx-auto relative flex-1">
        {currentUser && (
          <div className="sticky top-14 h-[calc(100vh-56px)] z-20 hidden lg:block">
            <Sidebar
              currentUser={currentUser}
              onProfileClick={(id) => openProfile(id)}
              onReelsClick={() => navigateTo('reels')}
              onMarketplaceClick={() => navigateTo('marketplace')}
              onGroupsClick={() => navigateTo('groups')}
            />
          </div>
        )}

        <div className="w-full lg:w-[740px] xl:w-[700px] min-h-screen">
          <input
    ref={reelVideoInputRef}
    type="file"
    accept="video/*"
    className="hidden"
    onChange={handleReelVideoSelected}
  />
          {view === 'home' && (
            <div className="w-full pt-4 md:px-8 pb-10">
              {activeHashtag && (
                <div className="mb-3 px-4">
                  <div className="inline-flex items-center gap-2 bg-[#242526] border border-[#3E4042] rounded-full px-3 py-1">
                    <span className="text-[#1877F2] font-semibold">{activeHashtag}</span>
                    <button 
                      onClick={clearHashtag} 
                      className="text-[#B0B3B8] hover:text-white ml-1"
                    >
                      <i className="fas fa-times" />
                    </button>
                  </div>
                  <p className="text-[#B0B3B8] text-xs mt-1">
                    Showing posts with {activeHashtag}
                  </p>
                </div>
              )}

              <StoryReel
                stories={orderedStories}
                onProfileClick={(id) => openProfile(id)}
                onCreateStory={() => {
                  if (!requireAuth('Creating stories')) return;
                  setShowCreateStoryModal(true);
                }}
                onViewStory={openStoryViewer}
                currentUser={currentUser}
                onRequestLogin={() => setView('login')}
                onFollow={followUser}
                checkIsFollowing={checkIsFollowing}
                followLoading={followLoading}
                onFetchViewers={fetchStoryViewers}
                onReaction={reactToStory}
                onReply={replyToStory}
                onToggleMute={() => setStoryMuted(!storyMuted)}
                muted={storyMuted}
              />

              {currentUser && (
                <CreatePost
                  currentUser={currentUser}
                  onProfileClick={(id) => openProfile(id)}
                  onClick={() => {
                    if (!requireAuth('Creating posts')) return;
                    setShowCreatePostModal(true);
                  }}
                  onPhotoClick={handlePhotoClick}
                  onVideoClick={handleVideoClickFromCreate}
                  onCreateEventClick={() => {
                    if (!requireAuth('Creating events')) return;
                    setShowCreateEventModal(true);
                  }}
                />
              )}

              <div className="space-y-2">
                <MarketplaceContext.Provider value={{
                  onViewProduct: (productId) => {
                    const product = products.find(p => Number(p.id) === Number(productId));
                    if (product) {
                      navigateTo('marketplace');
                      setActiveProduct(product);
                    }
                  },
                  getProductData
                }}>
                  {feedItems.length > 0 ? (
                    feedItems.map((item, idx) => {
                      if (item.type === 'sponsored' || item.ad_type || item.is_sponsored) {
                        const isActive = item.campaign_status === 'active' || 
                                         (item.end_date && new Date(item.end_date) > new Date());
                        
                        return (
                          <SponsoredPostCard
                            key={item.id}
                            ad={item}
                            currentUser={currentUser}
                            onProfileClick={openProfile}
                            onReact={(ad, type) => reactToFeedItem(ad, type)}
                            onShare={(postId, newShareCount) => {
                              console.log('Share:', postId, newShareCount);
                            }}
                            onOpenComments={(ad) => handleOpenComments(ad)}
                            isActive={isActive}
                          />
                        );
                      }

                      if (item.type === 'reel') {
                        return (
                          <ReelFeedCard
                            key={item.id}
                            reel={item.reel}
                            onOpen={(reelId) => {
                              setSelectedReelId(reelId);
                              navigateTo('reels');
                            }}
                            onOpenMenu={(reel) => {
                              // Handle menu options
                            }}
                            onProfileClick={(userId) => {
                              openProfile(Number(userId));
                            }}
                          />
                        );
                      }

                      const postAuthorId = Number((item as any).user_id);
                      const isFollowing = checkIsFollowing(postAuthorId);
                      const isPostOwner = currentUser && Number(currentUser.id) === postAuthorId;
                      const isAdminUser = currentUser && currentUser.role === 'admin';
                      const showPushButton = isPostOwner || isAdminUser;

                      const showFirstPymk = currentUser &&
                        peopleYouMayKnow.length > 0 &&
                        peopleYouMayKnowInsertIndex1 >= 0 &&
                        idx === peopleYouMayKnowInsertIndex1;

                      const showSecondPymk = currentUser &&
                        peopleYouMayKnow.length > 0 &&
                        peopleYouMayKnowInsertIndex2 >= 0 &&
                        idx === peopleYouMayKnowInsertIndex2;

                      const showGroupsYouMayJoin = currentUser &&
                        groupsYouMayJoin.length > 0 &&
                        groupsYouMayJoinInsertIndex >= 0 &&
                        idx === groupsYouMayJoinInsertIndex;

                      return (
                        <React.Fragment key={getStableItemKey(item, 'post')}>
                          <Post
                            post={item as PostType}
                            author={getPostAuthor(item as PostType)}
                            currentUser={currentUser}
                            users={users}
                            onProfileClick={openProfile}
                            onReact={(post, type) => reactToFeedItem(post, type)}
                            onShare={(postId, newShareCount) => {
                              console.log('Share:', postId, newShareCount);
                            }}
                            onViewImage={setFullScreenImage}
                            onOpenComments={(post) => handleOpenComments(post)}
                            onVideoClick={handleVideoClick}
                            onPlayAudioTrack={onPlayTrack}
                            groups={groups}
                            brands={brands}
                            chats={chats}
                            onHashtagClick={handleHashtagClick}
                            isFollowing={isFollowing}
                            onFollow={() => followUser(postAuthorId)}
                            followLoading={followLoading[postAuthorId] || false}
                            onViewProductFromPost={openProductFromPost}
                            onRSVPEvent={onRSVPEvent}
                            pushButton={showPushButton ? (
                              <button
                                onClick={() => pushMore(item.id)}
                                disabled={pushedPosts[item.id]}
                                className={`px-3 py-1 rounded-md text-sm font-semibold ml-2 ${
                                  pushedPosts[item.id]
                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                }`}
                              >
                                {pushedPosts[item.id] ? 'Pushed' : 'Push More'}
                              </button>
                            ) : undefined}
                          />

                          {showFirstPymk && (
                            <div className="relative">
                              <PeopleYouMayKnowGrid
                                users={peopleYouMayKnow}
                                onFollow={(id: number) => followFromPymk(id)}
                                currentUser={currentUser}
                                isLoading={pymkLoading && peopleYouMayKnow.length === 0}
                                onLoginClick={() => setView('login')}
                                onProfileClick={openProfile}
                                title="People You May Know"
                                maxDisplay={8}
                              />
                              
                              {peopleYouMayKnow[0] && (
                                <button
                                  onClick={() => hidePymkUser(peopleYouMayKnow[0].id)}
                                  className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] flex items-center justify-center"
                                  aria-label="Hide suggestions"
                                >
                                  <i className="fas fa-times text-sm" />
                                </button>
                              )}
                            </div>
                          )}

                          {showSecondPymk && (
                            <div className="relative">
                              <PeopleYouMayKnowGrid
                                users={peopleYouMayKnow}
                                onFollow={(id: number) => followFromPymk(id)}
                                currentUser={currentUser}
                                isLoading={pymkLoading && peopleYouMayKnow.length === 0}
                                onLoginClick={() => setView('login')}
                                onProfileClick={openProfile}
                                title="More People You May Know"
                                maxDisplay={8}
                              />
                              
                              {peopleYouMayKnow[0] && (
                                <button
                                  onClick={() => hidePymkUser(peopleYouMayKnow[0].id)}
                                  className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] flex items-center justify-center"
                                  aria-label="Hide suggestions"
                                >
                                  <i className="fas fa-times text-sm" />
                                </button>
                              )}
                            </div>
                          )}

                          {showGroupsYouMayJoin && (
                            <GroupsYouMayJoinCard
                              groups={groupsYouMayJoin}
                              currentUser={currentUser}
                              isLoading={gymjLoading && groupsYouMayJoin.length === 0}
                              onJoin={(groupId: number) => joinFromSuggestion(groupId)}
                              onLoginClick={() => setView('login')}
                              onOpenGroup={(groupId: number) => {
                                navigateTo('groups');
                              }}
                              onProfileClick={openProfile}
                              title="Groups You May Join"
                              maxDisplay={8}
                            />
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : !feedHydrated ? (
                    <div className="text-center py-20 text-[#B0B3B8]"></div>
                  ) : activeHashtag ? (
                    <div className="text-center py-20 text-[#B0B3B8]">
                      <p>No posts found with {activeHashtag}.</p>
                      <button 
                        onClick={clearHashtag}
                        className="mt-4 px-4 py-2 bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors"
                      >
                        Clear filter
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-[#B0B3B8]">
                      <p>No posts available.</p>
                      {!currentUser && <p className="mt-2 text-sm">Sign in to see posts from your network.</p>}
                    </div>
                  )}
                </MarketplaceContext.Provider>
              </div>
            </div>
          )}

          {/* ReelsFeed render */}

         {view === 'reels' && (
  <ReelsFeed
    reels={safeArray(reels)}
    users={safeArray(users)}
    currentUser={currentUser}
    onProfileClick={(id) => openProfile(id)}
    onReact={reactToReel}
    onComment={commentOnReel}
    onEditComment={editCommentOnReel}
    onDeleteComment={deleteCommentOnReel}
    onEditReel={editReel}
    onDeleteReel={deleteReel}
    onShare={shareReel}
    onFollow={followUser}
    checkIsFollowing={checkIsFollowing}
    followLoading={followLoading}
    initialReelId={typeof selectedReelId === 'number' ? selectedReelId : null}
    onBack={goBack}
    onVideoClick={openReelRecorderFromReels}
  />
)}
          {view === 'marketplace' && (
            <MarketplacePage
              currentUser={currentUser}
              products={products}
              onNavigateHome={() => handleNavigate('home')}
              onCreateProduct={createProduct}
              onViewProduct={setActiveProduct}
            />
          )}

          {view === 'groups' && (
            <ErrorBoundary>
              <GroupsPage
                currentUser={currentUser}
                groups={groups}
                users={users}
                onCreateGroup={createGroup}
                onJoinGroup={joinGroup}
                onLeaveGroup={leaveGroup}
                onDeleteGroup={deleteGroup}
                onUpdateGroupImage={updateGroupImage}
                onPostToGroup={createGroupPost}
                onCreateGroupEvent={createGroupEvent}
                onInviteToGroup={inviteToGroup}
                onProfileClick={openProfile}
                onLikePost={toggleGroupPostLike}
                onSharePost={(postId: number, newShareCount: number) => {
                  setPosts(prev => prev.map(p => 
                    p.id === postId ? { ...p, shares: newShareCount } as any : p
                  ));
                }}
                onDeleteGroupPost={deleteGroupPost}
                onEditGroupPost={editGroupPost}
                onRemoveMember={removeGroupMember}
                onUpdateGroupSettings={updateGroupSettings}
                onEventRSVP={handleEventRSVP}
                fetchGroupPosts={fetchGroupPosts}
                fetchGroupDetails={fetchGroupDetails}
                fetchGroupEvents={fetchGroupEvents}
                fetchComments={fetchGroupPostComments}
                onComment={createGroupPostComment}
                onLikeComment={handleLikeComment}
                onPlayAudioTrack={onPlayTrack}
                onFollow={followUser}
                checkIsFollowing={checkIsFollowing}
                onHashtagClick={handleHashtagClick}
                onViewImage={setFullScreenImage}
                onVideoClick={handleVideoClick}
                initialGroupId={null}
                onApplyToJob={async (postId: number, applicationData?: any) => {
                  console.log('Apply to job:', postId, applicationData);
                }}
                onMessageSeller={(userId: number) => {
                  const recipient = users.find(u => u.id === userId);
                  if (recipient) {
                    handleOpenChat(recipient);
                  }
                }}
                onMakeOffer={async (postId: number, amount: number) => {
                  console.log('Make offer:', postId, amount);
                }}
                onPlayVideo={(postId: number, url: string) => {
                  console.log('Play video:', postId, url);
                }}
              />
            </ErrorBoundary>
          )}

          {view === 'brands' && (
            <BrandsPage
              currentUser={currentUser}
              brands={brands}
              posts={posts}
              users={users}
              onCreateBrand={() => requireAuth('Creating brands')}
              onFollowBrand={(id: number) => followUser(id)}
              onProfileClick={(id) => openProfile(id)}
              onPostAsBrand={() => requireAuth('Posting')}
              onReact={() => requireAuth('Reacting')}
              onShare={(post: any) => handleOpenShareSheet(post)}
              onOpenComments={(id: any) => {
                if (!requireAuth('Commenting')) return;
                const post = posts.find(p => p.id === id);
                if (post) handleOpenComments(post);
              }}
              onDeleteBrand={() => requireAuth('Deleting brands')}
              onPlayAudioTrack={onPlayTrack}
              checkIsFollowing={checkIsFollowing}
              followLoading={followLoading}
            />
          )}

          {view === 'music' && (
            <MusicSystem
              currentUser={currentUser}
              onPlayTrack={onPlayTrack}
              onProfileClick={(id) => openProfile(id)}
              likedTracks={likedTracks}
              onToggleLike={handleMusicSystemLikeSync}
              playHistory={playHistory}
              onFollow={followUser}
              checkIsFollowing={checkIsFollowing}
              users={users}
              currentTrack={currentAudioTrack}
              isPlaying={isAudioPlaying}
              myTotalPlays={currentUser?.id ? myTotalPlays : 0}
              playsLoading={playsLoading}
            />
          )}

          {view === 'tools' && <ToolsPage />}

          {view === 'profiles' && (
            <SuggestedProfilesPage
              currentUser={currentUser as any}
              users={users}
              onFollow={(id: number) => followUser(id)}
              onProfileClick={(id) => openProfile(id)}
              checkIsFollowing={checkIsFollowing}
              followLoading={followLoading}
            />
          )}

          {view === 'events' && (
            <ErrorBoundary>
              <AllEvents
                currentUser={currentUser ?? null}
                users={users}
                onProfileClick={(id) => openProfile(id)}
                onEventClick={(eventId) => {
                  setActiveEventId(eventId);
                }}
                onCreateEventClick={() => {
                  if (!requireAuth('Creating events')) return;
                  setShowCreateEventModal(true);
                }}
              />
            </ErrorBoundary>
          )}

          {view === 'birthdays' && (
            <BirthdaysPage
              currentUser={currentUser as any}
              users={users}
              onMessage={(id) => {
                if (!requireAuth('Messaging')) return;
                setActiveChatUser(users.find((u) => u.id === id) || null);
                setIsChatOpen(true);
              }}
              onProfileClick={(id) => openProfile(id)}
              onFollow={followUser}
              checkIsFollowing={checkIsFollowing}
            />
          )}

          {view === 'memories' && currentUser && (
            <MemoriesPage
              currentUser={currentUser}
              posts={allKnownPosts}
              users={users}
              onProfileClick={(id: number) => openProfile(id)}
              onReact={(postId: number, type: ReactionType) => onReactPost(postId, type)}
              onShare={(post: any) => handleOpenShareSheet(post)}
              onViewImage={setFullScreenImage}
              onOpenComments={(postId: number) => {
                const post = posts.find(p => p.id === postId);
                if (post) handleOpenComments(post);
              }}
              onVideoClick={handleVideoClick}
              onPlayAudioTrack={onPlayTrack}
              onHashtagClick={handleHashtagClick}
              onFollow={followUser}
              checkIsFollowing={checkIsFollowing}
              followLoading={followLoading}
              groups={groups}
              brands={brands}
              chats={chats}
            />
          )}

          {view === 'settings' && currentUser && (
            <SettingsPage currentUser={currentUser} onUpdateUser={() => requireAuth('Updating settings')} />
          )}

          {view === 'privacy' && <PrivacyPolicyPage onNavigateHome={() => setView('home')} />}
          {view === 'terms' && <TermsOfServicePage onNavigateHome={() => setView('home')} />}
          {view === 'help' && <HelpSupportPage onNavigateHome={() => setView('home')} />}

          {view === 'profile' && profileUser && (
            <UserProfile
              user={profileUser}
              currentUser={currentUser}
              users={users}
              posts={profilePosts}
              reels={reels}
              onProfileClick={(id) => openProfile(id)}
              onFollow={(id: number) => followUser(id)}
              onReact={(postId: number, type: ReactionType) => onReactPost(postId, type)}
              onComment={() => requireAuth('Commenting')}
              onShare={(post: any) => handleOpenShareSheet(post)}
              onMessage={(id) => {
                if (!requireAuth('Messaging')) return;
                const recipient = users.find((u) => u.id === id);
                if (recipient) {
                  handleOpenChat(recipient);
                }
              }}
              onCreatePost={createPost as any}
              onUpdateProfileImage={updateProfileImage as any}
              onUpdateCoverImage={updateCoverImage as any}
              onUpdateUserDetails={updateUserDetails as any}
              onDeletePost={(postId: number) => deletePost(postId)}
              onEditPost={(postId: number, content: string) => editPost(postId, content)}
              getCommentAuthor={(id) => users.find((u) => u.id === id)}
              onViewImage={setFullScreenImage}
              onOpenComments={(postId) => {
                const post = posts.find(p => p.id === postId) || profilePosts.find(p => p.id === postId);
                if (post) handleOpenComments(post);
              }}
              onVideoClick={handleVideoClick}
              onPlayAudioTrack={onPlayTrack}
              onCreateStoryClick={handleCreateStoryFromProfile}
              onVerifyUser={(id) => verifyUser(id)}
              onRestrictUser={(id, duration) => suspendUser(id, duration)}
              onDeleteUser={(id) => deleteUserAccount(id)}
              onMakeModerator={(id, make) => setModeratorRole(id, make ? 'moderator' : 'user')}
              isFollowing={checkIsFollowing(Number(profileUser.id))}
              followLoading={followLoading[Number(profileUser.id)] || false}
              onOpenChat={handleOpenChat}
              isChatOpen={isChatOpen}
              activeChatRecipient={activeChatUser}
              onOpenChatsList={handleOpenChatsList}
              isChatsListOpen={isChatsListOpen}
            />
          )}

          {view === 'login' && (
            <Login
              onLogin={handleLogin}
              onNavigateToRegister={() => setView('register')}
              onNavigateToForgotPassword={() => setView('login')}
              onClose={() => setView('home')}
              error={loginError}
            />
          )}

          {view === 'register' && (
            <Register 
              onRegister={handleRegister} 
              onBackToLogin={() => setView('login')} 
              error={loginError}
            />
          )}

           {view === 'recorder' && (
  <Recorder
    currentUser={currentUser}
    selectedSound={selectedReelSound}
    sounds={songs.map((song: any) => ({
      id: song.id,
      name: song.title || song.name || 'Song',
      url: song.audio_fetch_url || song.audio_url || song.url || '',
      originalUrl: song.audio_fetch_url || song.audio_url || song.url || '',
      duration: song.duration || 30,
      start: 0,
      end: song.duration || 30,
      coverImage: song.cover_url || song.cover || '',
      creatorName: song.artist || '',
      creatorImage: song.artist_image || song.cover_url || '',
      playCount: song.playCount || song.plays || 0,
      creationCount: song.creationCount || song.uses || 0,
      soundKey: `song:${song.id}`,
    }))}
    onSelectSound={setSelectedReelSound}
    initialVideoFile={pendingReelFile}
    startInPreview={!!pendingReelFile}
    onBack={() => {
      setPendingReelFile(null);
      setSelectedReelSound(null);
      setView('reels');
    }}
    onSubmit={async (reelData) => {
      await createReel({
        ...reelData,
        audioUrl:
          reelData.audioUrl ||
          (selectedReelSound?.songId &&
            songs.find((s: any) => s.id === selectedReelSound.songId)?.audio_fetch_url) ||
          selectedReelSound?.originalUrl ||
          selectedReelSound?.audioUrl ||
          '',
        originalSoundId: reelData.originalSoundId ?? selectedReelSound?.songId,
        songName: reelData.songName || selectedReelSound?.songName || 'Original Sound',
        audioStart: reelData.audioStart ?? selectedReelSound?.audioStart ?? 0,
        audioEnd: reelData.audioEnd ?? selectedReelSound?.audioEnd ?? 0,
        soundKey: reelData.soundKey || selectedReelSound?.soundKey || 'original:none',
      });

      setPendingReelFile(null);
      setSelectedReelSound(null);
      setView('reels');
    }}
  />
)}
          {view === 'notifications' && (
            <NotificationsPage
              notifications={notifications}
              users={users}
              onBack={() => navigateTo('home')}
              onProfileClick={(id)=>openProfile(id)}
            />
          )}

          {view === 'ads' && currentUser && (
            <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
              <div className="flex gap-2 mb-6 border-b border-[#3E4042] pb-2 overflow-x-auto">
                <button
                  onClick={() => setActiveAdTab('dashboard')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                    activeAdTab === 'dashboard'
                      ? 'bg-[#1877F2] text-white'
                      : 'text-[#B0B3B8] hover:bg-[#3A3B3C]'
                  }`}
                >
                  <FontAwesomeIcon icon={faChartLine} className="w-4 h-4" />
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveAdTab('create')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                    activeAdTab === 'create'
                      ? 'bg-[#1877F2] text-white'
                      : 'text-[#B0B3B8] hover:bg-[#3A3B3C]'
                  }`}
                >
                  <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                  Create Campaign
                </button>
                <button
                  onClick={() => setActiveAdTab('ads')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                    activeAdTab === 'ads'
                      ? 'bg-[#1877F2] text-white'
                      : 'text-[#B0B3B8] hover:bg-[#3A3B3C]'
                  }`}
                >
                  <FontAwesomeIcon icon={faBullhorn} className="w-4 h-4" />
                  My Campaigns
                </button>
                <button
                  onClick={() => setActiveAdTab('analytics')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                    activeAdTab === 'analytics'
                      ? 'bg-[#1877F2] text-white'
                      : 'text-[#B0B3B8] hover:bg-[#3A3B3C]'
                  }`}
                >
                  <FontAwesomeIcon icon={faChartBar} className="w-4 h-4" />
                  Analytics
                </button>
              </div>

              {activeAdTab === 'dashboard' && (
                <Dashboard campaigns={adCampaigns} loading={adsLoading} />
              )}
              
              {activeAdTab === 'create' && (
                <AdCreator 
                  onSuccess={() => {
                    setActiveAdTab('ads');
                    fetchMyAds();
                    if (selectedPostForAd) {
                      setPushedPosts(prev => ({
                        ...prev,
                        [selectedPostForAd.id]: true
                      }));
                    }
                    setSelectedPostForAd(null);
                  }}
                  onBack={() => {
                    setActiveAdTab('dashboard');
                    setSelectedPostForAd(null);
                  }}
                  userPosts={posts.filter(p => Number(p.user_id) === Number(currentUser?.id))}
                  onCreateCampaign={createAdCampaign}
                  currentUser={currentUser}
                  initialPost={selectedPostForAd}
                />
              )}
              
              {activeAdTab === 'ads' && (
                <AdsManager 
                  campaigns={adCampaigns} 
                  onUpdate={fetchMyAds}
                  onPause={pauseCampaign}
                  onResume={resumeCampaign}
                  onDelete={deleteCampaign}
                  loading={adsLoading}
                />
              )}
              
              {activeAdTab === 'analytics' && (
                <Dashboard campaigns={adCampaigns} loading={adsLoading} />
              )}
            </div>
          )}
        </div>

        {currentUser && (
          <div className="sticky top-14 h-[calc(100vh-56px)] z-20 hidden xl:block pl-4">
            <RightSidebar
              contacts={users.filter((u) => u.id !== currentUser.id)}
              onProfileClick={(id) => openProfile(id)}
              onFollow={followUser}
              checkIsFollowing={checkIsFollowing}
              followLoading={followLoading}
            />
          </div>
        )}
      </div>

      {view !== 'home' && (
        <button
          onClick={goBack}
          className="fixed bottom-6 left-6 z-50 w-14 h-14 bg-[#1877F2] rounded-full shadow-lg flex items-center justify-center hover:bg-[#166FE5] transition-colors md:hidden"
          aria-label="Go back"
        >
          <i className="fas fa-arrow-left text-white text-2xl"></i>
        </button>
      )}

      {activeProduct && (
        <ProductDetailModal
          product={activeProduct}
          currentUser={currentUser}
          onClose={() => setActiveProduct(null)}
          onMessage={(id) => {
            if (!requireAuth('Messaging')) return;
            const recipient = users.find((u) => u.id === id);
            if (recipient) {
              handleOpenChat(recipient);
            }
          }}
        />
      )}

      {activeEventId && (
        <EventDetailModal
          eventId={activeEventId}
          onClose={() => setActiveEventId(null)}
        />
      )}

      {showCreateEventModal && currentUser && (
        <CreateEventModal
          currentUser={currentUser}
          onClose={() => setShowCreateEventModal(false)}
          onCreate={async (eventData) => {
            try {
              const newEvent = await createEvent(eventData);
              setShowCreateEventModal(false);
            } catch (error) {
              console.error('Failed to create event:', error);
            }
          }}
        />
      )}

      {showCreatePostModal && currentUser && (
  <CreatePostModal
    currentUser={currentUser}
    users={users}
    onClose={() => setShowCreatePostModal(false)}
    onCreatePost={(text: string, files: File[] | File | null, meta?: any) => createPost(text, files as any, meta)}
    onCreateEventClick={() => {
      setShowCreatePostModal(false);
      setShowCreateEventModal(true);
    }}
    onVideoClick={handleVideoClickFromCreate}
  />
)}

      {showRecorder && currentUser && (
        <Recorder
          currentUser={currentUser}
          selectedSound={selectedReelSound}
          sounds={songs.map((song: any) => ({
            id: song.id,
            name: song.title || song.name || 'Song',
            url: song.audio_fetch_url || song.audio_url || song.url || '',
            originalUrl: song.audio_fetch_url || song.audio_url || song.url || '',
            duration: song.duration || 30,
            start: 0,
            end: song.duration || 30,
            coverImage: song.cover_url || song.cover || '',
            creatorName: song.artist || '',
            creatorImage: song.artist_image || song.cover_url || '',
            playCount: song.playCount || song.plays || 0,
            creationCount: song.creationCount || song.uses || 0,
            soundKey: `song:${song.id}`,
          }))}
          onSelectSound={setSelectedReelSound}
          onBack={() => setShowRecorder(false)}
          onSubmit={async (reelData) => {
            await createReel({
              ...reelData,
              audioUrl:
                reelData.audioUrl ||
                (selectedReelSound?.songId &&
                  songs.find((s: any) => s.id === selectedReelSound.songId)?.audio_fetch_url) ||
                selectedReelSound?.audioUrl ||
                '',
              originalSoundId: reelData.originalSoundId ?? selectedReelSound?.songId,
              songName: reelData.songName || selectedReelSound?.songName || 'Original Sound',
              audioStart: reelData.audioStart ?? selectedReelSound?.audioStart ?? 0,
              audioEnd: reelData.audioEnd ?? selectedReelSound?.audioEnd ?? 0,
            });

            setShowRecorder(false);
          }}
        />
      )}

      {activePost && currentUser && (
        <CommentsSheet
          post={activePost}
          currentUser={currentUser}
          users={users}
          onClose={() => {
            setActiveCommentsIdentity(null);
            setCommentPostSnapshot(null);
          }}
          onComment={createGroupPostComment}
          onLikeComment={handleLikeComment}
          getCommentAuthor={(id) => users.find((u) => u.id === id)}
          onProfileClick={(id) => openProfile(id)}
          onHashtagClick={handleHashtagClick}
          onFollow={followUser}
          checkIsFollowing={checkIsFollowing}
        />
      )}

      {activeSharePost && (
        <ShareBottomSheet
          isOpen={showShareSheet}
          onClose={() => {
            setShowShareSheet(false);
            setActiveSharePost(null);
          }}
          post={activeSharePost}
          currentUser={currentUser}
          users={users}
          groups={groups}
          brands={brands}
          chats={chats}
          onShareComplete={handleShareComplete}
          onFollow={followUser}
          checkIsFollowing={checkIsFollowing}
        />
      )}

      {activeStoryId && activeStory && (
        <StoryViewerModal
          story={activeStory}
          onClose={closeStoryViewer}
          onProfileClick={(id) => {
            closeStoryViewer();
            openProfile(id);
          }}
          currentUser={currentUser}
          onFollow={followUser}
          checkIsFollowing={checkIsFollowing}
          followLoading={followLoading}
          allStories={orderedStories}
          onFetchViewers={fetchStoryViewers}
          onFetchAnalytics={fetchStoryAnalytics}
          onReply={replyToStory}
          onLike={likeStory}
          onReaction={reactToStory}
          onNext={handleStoryNext}
          onPrev={handleStoryPrev}
          muted={storyMuted}
          onToggleMute={() => setStoryMuted(!storyMuted)}
        />
      )}

      {showCreateStoryModal && currentUser && (
        <CreateStoryModal
          currentUser={currentUser}
          songs={songs}
          onClose={() => setShowCreateStoryModal(false)}
          onCreate={createStory}
        />
      )}

      {currentAudioTrack && (
        <GlobalAudioPlayer
          currentTrack={currentAudioTrack}
          isPlaying={isAudioPlaying}
          onTogglePlay={onTogglePlay}
          onNext={onNext}
          onPrevious={onPrevious}
          onClose={onClosePlayer}
          onDownload={(id) => {
            console.log('Download track:', id);
          }}
          onLike={(id, type) => {
            const k = `${type}:${String(id)}`;
            const nextLiked = !likedTracks.includes(k);
            handleMusicSystemLikeSync(k, nextLiked);
          }}
          onArtistClick={(uploaderId) => uploaderId && openProfile(uploaderId)}
          isLiked={isPlayerLiked}
          ownerUser={resolveTrackOwner(currentAudioTrack)}
          totalPlays={currentAudioTrack ? (trackPlays[`${currentAudioTrack.type}:${String(currentAudioTrack.id)}`] || 0) : 0}
          totalPlaysLoading={playsLoading}
          onStarted={onStarted}
        />
      )}

      {fullScreenImage && <ImageViewer imageUrl={fullScreenImage} onClose={() => setFullScreenImage(null)} />}

      {incomingCall && currentUser && (
        <CallScreen
          open={true}
          mode={incomingCall.call_type === "video" ? "video" : "voice"}
          phase="incoming"
          peerName={incomingCall.caller_name || "User"}
          peerAvatar={incomingCall.caller_avatar || null}
          micOn={true}
          camOn={true}
          speakerOn={true}
          onAccept={() => {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
            openChatWith(incomingCall.caller_id);
            setIncomingCall(null);
          }}
          onDecline={() => {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
            apiFetch(
              "/api/calls/signal",
              {
                method: "POST",
                body: JSON.stringify({
                  call_id: incomingCall.id,
                  to_user_id: incomingCall.caller_id,
                  type: "decline",
                }),
              },
            ).catch(err => console.error('Failed to decline call:', err));
            setIncomingCall(null);
          }}
          onHangup={() => {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
            setIncomingCall(null);
          }}
          onToggleMic={() => {}}
          onToggleCam={() => {}}
          onToggleSpeaker={() => {}}
        />
      )}

      {isChatOpen && activeChatUser && currentUser && (
        <ChatWindow
          currentUser={currentUser}
          recipient={activeChatUser}
          onClose={handleCloseChat}
          onSendMessage={handleSendMessage}
        />
      )}

      {isChatsListOpen && currentUser && (
        <ChatsList
          currentUser={currentUser}
          onOpenChat={handleOpenChat}
          onOpenRequests={() => {
            console.log('Open message requests');
          }}
          onNewChat={() => {
            console.log('Create new chat');
          }}
        />
      )}

      {showAdAnalytics && adAnalyticsId && (
        <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4">
          <div className="bg-[#242526] rounded-xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Ad Analytics</h2>
              <button
                onClick={() => setShowAdAnalytics(false)}
                className="text-[#B0B3B8] hover:text-white"
              >
                <i className="fas fa-times" />
              </button>
            </div>
            <p className="text-[#B0B3B8]">Analytics for ad #{adAnalyticsId}</p>
          </div>
        </div>
      )}
    </div>
  );
}
 
