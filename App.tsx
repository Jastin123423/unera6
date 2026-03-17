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
  SponsoredPostCard,
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

// 📸 SEAMLESS IMAGE SYSTEM IMPORTS
import { imagePreloader } from './utils/imagePreloader';
import { useViewportPreloader } from './hooks/useViewportPreloader';
import '../styles/seamless-images.css';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartLine, 
  faPlus, 
  faBullhorn, 
  faChartBar 
} from '@fortawesome/free-solid-svg-icons';
import { TrendingUp } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
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

/** ---------- Video/Reel ID resolver for Facebook-like video playback ---------- */
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

/** ---------- Stable key generator for list items ---------- */
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
            <p className="font-bold text-red-400">Groups UI crashed</p>
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
 * Normalize raw D1 rows to UI-safe PostType shape with multi-media support
 * Parse meta field if it's a JSON string (critical for marketplace posts)
 */
const normalizePost = (p: any): PostType => {
  const mediaUrls =
    Array.isArray(p?.media_urls) ? p.media_urls :
    typeof p?.media_urls === "string" ? (() => { try { return JSON.parse(p.media_urls); } catch { return []; } })() :
    Array.isArray(p?.mediaUrls) ? p.mediaUrls :
    typeof p?.mediaUrls === "string" ? (() => { try { return JSON.parse(p.mediaUrls); } catch { return []; } })() :
    [];

  // 📸 NEW: Extract image versions from meta
  const imageVersions = p?.meta?.image_versions || [];
  
  // 📸 Create enhanced media URLs with versions if available
  const enhancedMediaUrls = imageVersions.length ? imageVersions : 
    mediaUrls.map(url => ({
      full: url,
      feed: url, // Fallback to same URL
      thumb: url  // Fallback to same URL
    }));

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
    
    // 📸 NEW: Add enhanced media URLs with versions
    enhanced_media_urls: enhancedMediaUrls,

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

    meta: parseJSON(p?.meta) || null,
  } as any;
};

/** Event normalization helpers from App.tsx 1 */
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

/** Normalize story data with backend field matching */
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
 * Normalize reel data with trimmed audio support and full comment structure
 */
const normalizeReel = (r: any): Reel => {
  const resolvedId = safeNumber(r?.id ?? r?.reel_id ?? 0);
  const userId = safeNumber(r?.user_id ?? r?.userId ?? 0);
  
  const soundKey = String(r?.sound_key ?? r?.soundKey ?? '');
  const isTrimmedAudio = soundKey.startsWith('trimmed:');
  
  const audioStart = safeNumber(r?.audio_start ?? r?.audioStart ?? 0);
  const audioEnd = safeNumber(r?.audio_end ?? r?.audioEnd ?? 0);
  const audioUrl = r?.audio_url ?? r?.audioUrl ?? '';
  const legacyIsTrimmed = audioStart === 0 && audioEnd === 0 && audioUrl !== '';

  // Find author from users if available (will be populated later)
  const author = r?.author || r?.author_name;

  return {
    ...r,
    id: resolvedId,
    userId: userId,
    videoUrl: r?.video_url ?? r?.videoUrl ?? '',
    caption: r?.caption ?? '',
    songName: r?.song_name ?? r?.songName ?? '',
    audioUrl: audioUrl,
    audioStart: isTrimmedAudio ? 0 : audioStart,
    audioEnd: isTrimmedAudio ? 0 : audioEnd,
    audioStartTime: isTrimmedAudio ? 0 : audioStart,
    audioEndTime: isTrimmedAudio ? 0 : audioEnd,
    visibility: r?.visibility ?? 'public',
    location: r?.location ?? '',
    views: safeNumber(r?.views ?? 0),
    shares: safeNumber(r?.shares ?? 0),
    songId: r?.song_id ?? r?.songId ?? null,
    soundKey: soundKey,
    reactions: safeArray(r?.reactions),
    comments: safeArray(r?.comments).map((c: any) => ({
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
    })),
    created_at: r?.created_at ?? r?.createdAt ?? new Date().toISOString(),
    isTrimmedAudio: isTrimmedAudio || legacyIsTrimmed,
    author: author,
    author_name: author,
    avatar: r?.avatar || r?.author_image,
    verified: r?.verified || false,
    thumbnail_url: r?.thumbnail_url || r?.cover_url,
    reactions_count: safeNumber(r?.reactions_count ?? r?.reactions?.length ?? 0),
    views_count: safeNumber(r?.views_count ?? r?.views ?? 0),
    comments_count: safeNumber(r?.comments_count ?? r?.comments?.length ?? 0),
  } as any;
};

/** Normalize song data for UNERA Music with audio_fetch_url support */
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
 * Normalize product data for consistency
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
// 🔧 FIXED: Normalize groups with optional members and is_member support
// ============================================================================
/** Normalize groups to prevent crashes and handle membership correctly */
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

/** ---------- ✅ ADDED: Marketplace Context for Post.tsx ---------- */
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

/** ---------- Optimistic reaction helper ---------- */
const applyOptimisticReaction = (p: any, postId: number, type: ReactionType, meId: number) => {
  if (Number(p?.id) !== Number(postId)) return p;

  const prevMy = p?.my_reaction ?? p?.myReaction ?? null;
  const nextMy = prevMy === type ? null : type;

  const prevArr = safeArray<any>(p?.reactions);
  const withoutMe = prevArr.filter((r: any) => Number(r?.user_id) !== Number(meId));
  const nextArr = nextMy ? [...withoutMe, { user_id: meId, type: nextMy }] : withoutMe;

  const prevCount =
    safeNumber(p?.reactions_count, safeNumber(p?.reactionsCount, safeNumber(p?.likesCount, prevArr.length)));

  const nextCount =
    prevMy
      ? (nextMy ? prevCount : Math.max(0, prevCount - 1))
      : (nextMy ? prevCount + 1 : prevCount);

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

// 📸 UPDATED: uploadToCloudflareR2 with 3 image sizes support
const uploadToCloudflareR2 = async (file: File, folder = 'posts'): Promise<{ 
  url: string; 
  type: string; 
  filename: string;
  thumb?: string;
  feed?: string;
  full?: string;
}> => {
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
    
    // 📸 Handle the new response format with multiple URLs
    if (result.media_type === 'image' && result.media_urls) {
      const urls = JSON.parse(result.media_urls);
      return { 
        url: urls.full, // For backward compatibility
        thumb: urls.thumb,
        feed: urls.feed,
        full: urls.full,
        type: file.type, 
        filename: file.name 
      };
    }
    
    // Fallback for non-image uploads
    return { 
      url: result.url, 
      type: file.type, 
      filename: file.name 
    };
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

// 2️⃣ ADD 'ads' TO VIEW TYPE
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
// ✅ REEL FEED INTEGRATION - ENHANCED WITH FULL COMMENT SUPPORT
// ============================================================================

/**
 * Shuffle array using Fisher-Yates algorithm for reel rotation on refresh
 */
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

  // 🔥 NEW: Navigation history state
  const [navigationHistory, setNavigationHistory] = useState<View[]>(['home']);

  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatsListOpen, setIsChatsListOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ===== NOTIFICATION & AD STATES =====
  const [notifications, setNotifications] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [showAdAnalytics, setShowAdAnalytics] = useState(false);
  const [adAnalyticsId, setAdAnalyticsId] = useState<number | null>(null);

  // 3️⃣ ADD AD DASHBOARD STATE
  const [adCampaigns, setAdCampaigns] = useState<any[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [activeAdTab, setActiveAdTab] = useState<'dashboard' | 'create' | 'ads' | 'analytics'>('dashboard');
  
  // 📝 NEW STATE FOR SELECTED POST
  const [selectedPostForAd, setSelectedPostForAd] = useState<PostType | null>(null);

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

  const [commentPostSnapshot, setCommentPostSnapshot] = useState<PostType | null>(null);

  const [loginError, setLoginError] = useState('');

  // Add this after your other useMemo calculations
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

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  
  const handleActiveReelConsumed = useCallback(() => {
    setSelectedReelId(null);
  }, []);
  
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
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
