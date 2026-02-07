import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Login, Register } from './components/Auth';
import { Header, Sidebar, RightSidebar } from './components/Layout';
import {
  CreatePost,
  Post,
  CommentsSheet,
  CreatePostModal,
  SuggestedProductsWidget,
  ShareBottomSheet,
} from './components/Feed';
import { StoryReel, CreateStoryModal, StoryViewerModal } from './components/Story';
import { UserProfile } from './components/UserProfile';
import { MarketplacePage, ProductDetailModal } from './components/Marketplace';
import { ReelsFeed, CreateReelModal } from './components/Reels';
import { ImageViewer, ProfessionalLoader } from './components/Common';
import {
  EventsPage,
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
} from './types';

/** ---------- Safety helpers ---------- */
const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeString = (v: any, fallback = '') => (typeof v === 'string' ? v : fallback);

/** ---------- Constants ---------- */
const DEFAULT_MUSIC_COVER = 'https://media.unera.social/task_01kftb3024ed7bm84gy6j485fh_1769336848_img_0.webp';
const LS_USER_KEY = 'user';

/** ===== ✅ ADDED: FB-LIKE STORY SEEN SYSTEM ===== */
const STORY_SEEN_KEY = 'unera_story_seen_v1';
const STORY_SEEN_LIMIT = 2500;

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
const FEED_RETURN_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes away => refresh
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

// Deterministic seeded RNG
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

// Avoid boring sequences: same author too often + mix types a bit
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

      // allow at most 1 consecutive repeat
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

    // if stuck, relax rule
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

/** ---------- ✅ FIXED: Name validation helper ---------- */
const isBadName = (v: any): boolean => {
  const s = String(v ?? '').trim();
  return !s || s.toLowerCase() === 'user' || s.toLowerCase() === 'un';
};

/** ---------- ✅ FIXED: Safe User Merge Helper with name protection ---------- */
const isHttpUrl = (v: any) =>
  typeof v === 'string' && (v.startsWith('https://') || v.startsWith('http://'));

const mergeUserSafe = (oldU: any, newU: any) => {
  const next = { ...oldU, ...newU };

  // ✅ keep old profile/cover if incoming is missing/empty
  if (!isHttpUrl(newU?.profile_image_url) && isHttpUrl(oldU?.profile_image_url)) {
    next.profile_image_url = oldU.profile_image_url;
  }
  if (!isHttpUrl(newU?.cover_image_url) && isHttpUrl(oldU?.cover_image_url)) {
    next.cover_image_url = oldU.cover_image_url;
  }

  // ✅ CRITICAL: Preserve followers/following arrays to prevent blinking
  if (!Array.isArray(newU?.followers) && Array.isArray(oldU?.followers)) {
    next.followers = oldU.followers;
  }
  if (!Array.isArray(newU?.following) && Array.isArray(oldU?.following)) {
    next.following = oldU.following;
  }

  // ✅ NEW: Never let partial "User" overwrite real name/username
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
 * ✅ UPDATED: Normalize raw D1 rows to UI-safe PostType shape with multi-media support
 * ✅ ADDED: Support for media_urls + media_types arrays
 * ✅ FIXED: created_at field normalization for MemoriesPage
 */
const normalizePost = (p: any): PostType => {
  // ✅ multi media support (new)
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

  // ✅ backward compatible single media
  const mediaType = p?.media_type ?? p?.mediaType ?? (mediaTypes[0] ?? null);
  const mediaUrl = p?.media_url ?? p?.mediaUrl ?? (mediaUrls[0] ?? null);

  const resolvedId = safeNumber(p?.id ?? p?.post_id ?? p?.postId ?? p?.postID);

  return {
    ...p,
    id: resolvedId,
    user_id: p?.user_id === null || p?.user_id === undefined ? null : safeNumber(p?.user_id),
    content: safeString(p?.content),

    // ✅ keep old fields (backward compatibility)
    media_url: mediaUrl,
    media_type: mediaType,

    // ✅ new fields (Feed.tsx will use these)
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
    
    // ✅ FIXED: Support both created_at and createdAt for MemoriesPage
    created_at: p?.created_at ?? p?.createdAt ?? new Date().toISOString(),
    
    // ✅ ADD THESE (very important) - Preserve reaction data
    my_reaction: p?.my_reaction ?? p?.myReaction ?? null,
    myReaction: p?.myReaction ?? p?.my_reaction ?? null,
    reactions_count: safeNumber(p?.reactions_count ?? p?.reactionsCount ?? p?.likesCount ?? 0),
    reactionsCount: safeNumber(p?.reactionsCount ?? p?.reactions_count ?? p?.likesCount ?? 0),
    likesCount: safeNumber(p?.likesCount ?? p?.reactions_count ?? p?.reactionsCount ?? 0),
  } as any;
};

/** ✅ UPDATED: Normalize event data with safe arrays ---------- */
const normalizeEvent = (e: any): Event => {
  const id = safeNumber(e?.id ?? e?.event_id ?? 0);

  // DB column is event_date
  const date = safeString(e?.date ?? e?.event_date ?? new Date().toISOString());

  const time =
    safeString(
      e?.time ?? e?.event_time ?? '',
      ''
    ) || (() => {
      const d = new Date(date);
      return Number.isFinite(d.getTime())
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
    })();

  const attendees =
    Array.isArray(e?.attendees) ? e.attendees :
    Array.isArray(e?.attendee_ids) ? e.attendee_ids :
    Array.isArray(e?.attendees_ids) ? e.attendees_ids :
    [];

  const interestedIds =
    Array.isArray(e?.interestedIds) ? e.interestedIds :
    Array.isArray(e?.interested_ids) ? e.interested_ids :
    Array.isArray(e?.interested) ? e.interested :
    [];

  return {
    ...e,
    id,
    title: safeString(e?.title, 'Untitled Event'),
    description: safeString(e?.description, ''),
    date,                          // UI field
    time,                          // UI field
    location: safeString(e?.location, ''),
    image: safeString(
      e?.image ?? e?.cover_url ?? '',
      'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1500&q=80'
    ),

    visibility: (safeString(e?.visibility, 'worldwide') as any),

    // DB columns are creator_*
    organizerId: safeNumber(e?.organizerId ?? e?.creator_id ?? 0),
    organizer_name: safeString(e?.organizer_name ?? e?.creator_name ?? ''),
    organizer_avatar: safeString(e?.organizer_avatar ?? e?.creator_avatar ?? ''),

    // ALWAYS arrays (prevents blank screens)
    attendees: safeArray(attendees).map(Number).filter(Number.isFinite),
    interestedIds: safeArray(interestedIds).map(Number).filter(Number.isFinite),

    created_at: safeString(e?.created_at ?? '', new Date().toISOString()),
  } as any;
};

/** ✅ UPDATED: Normalize story data with safe user merging ---------- */
const normalizeStory = (s: any, existingUser?: User): Story => {
  const resolvedId = safeNumber(s?.id ?? s?.story_id ?? 0);
  const userId = safeNumber(s?.user_id ?? s?.userId ?? 0);
  
  // ✅ CRITICAL: Use safe merge to prevent blinking
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
    user: storyUser, // ✅ Use safely merged user
    views: safeArray(s?.views),
  } as any;
};

/**
 * Normalize user data with UNERA-style profile pictures
 * ✅ FIXED: cover_image_url can be undefined, not empty string
 */
const normalizeUser = (u: any): User => {
  const resolvedId = safeNumber(u?.id ?? u?.user_id ?? u?.userId);
  
  // ✅ Use the incoming name/username if valid, otherwise fallback
  const incomingName = safeString(u?.name, '');
  const incomingUsername = safeString(u?.username, '');
  
  // Check if incoming names are bad (like "User", "user", empty)
  const hasValidIncomingName = !isBadName(incomingName);
  const hasValidIncomingUsername = !isBadName(incomingUsername);
  
  // Determine final names
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

  // ✅ FIXED: Don't default cover to empty string, keep undefined if missing
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
    cover_image_url: cover, // ✅ Can be undefined, not empty string
    is_verified: Boolean(u?.is_verified ?? u?.isVerified),
    role: u?.role ?? 'user',
    created_at: u?.created_at ?? u?.joined_date ?? u?.joinedDate ?? null,
  } as any;
};

/** ✅ UPDATED: Normalize reel data with trimmed audio support ---------- */
const normalizeReel = (r: any): Reel => {
  const resolvedId = safeNumber(r?.id ?? r?.reel_id ?? 0);
  const userId = safeNumber(r?.user_id ?? r?.userId ?? 0);
  
  // ✅ UPDATED: Use soundKey to determine trimmed audio, not start=0,end=0
  const soundKey = String(r?.sound_key ?? r?.soundKey ?? '');
  const isTrimmedAudio = soundKey.startsWith('trimmed:');
  
  // For backward compatibility, also check the old method
  const audioStart = safeNumber(r?.audio_start ?? r?.audioStart ?? 0);
  const audioEnd = safeNumber(r?.audio_end ?? r?.audioEnd ?? 0);
  const audioUrl = r?.audio_url ?? r?.audioUrl ?? '';
  const legacyIsTrimmed = audioStart === 0 && audioEnd === 0 && audioUrl !== '';

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
    comments: safeArray(r?.comments),
    created_at: r?.created_at ?? r?.createdAt ?? new Date().toISOString(),
    // ✅ Use soundKey to determine trimmed audio
    isTrimmedAudio: isTrimmedAudio || legacyIsTrimmed,
  } as any;
};

/** ✅ UPDATED: Normalize song data for UNERA Music with audio_fetch_url support ---------- */
const normalizeSong = (s: any): Song => {
  return {
    ...s,
    id: s?.id ?? s?.song_id ?? 0,
    title: s?.title ?? s?.name ?? 'Unknown',
    artist: s?.artist ?? s?.artist_name ?? '',
    audio_url: s?.audio_url ?? s?.url ?? s?.file_url ?? '',
    audio_fetch_url: s?.audio_fetch_url ?? '', // ✅ ADDED: For fetchable/proxy URLs
    cover_url: s?.cover_url ?? s?.cover ?? DEFAULT_MUSIC_COVER,
    duration: s?.duration ?? 0,
    playCount: s?.playCount ?? s?.plays ?? 0,
    artistId: s?.artistId ?? s?.artist_id ?? 0,
    type: s?.type ?? 'music',
  } as any;
};

/**
 * ✅ UPDATED: Normalize product data for consistency - FIXED marketplace products issue
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
    // ✅ FIXED: Don't use DEFAULT_MUSIC_COVER for marketplace products
    images: imgs.length ? imgs : [], // Empty array instead of music cover
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

/** ---------- ✅ ADDED: Normalize groups to prevent crashes ---------- */
const normalizeGroup = (g: any): Group => {
  const id = safeNumber(g?.id ?? g?.group_id ?? g?.groupId);
  const name = safeString(g?.name, "Untitled Group");
  const description = safeString(g?.description, ""); // ✅ never null
  const type = String(g?.type || "public").toLowerCase() === "private" ? "private" : "public";

  return {
    ...g,
    id,
    admin_id: safeNumber(g?.admin_id ?? g?.adminId ?? 0),
    name,
    description,
    type,
    cover_image: safeString(g?.cover_image ?? g?.coverImage ?? ""),
    profile_image: safeString(g?.profile_image ?? g?.profileImage ?? ""),
    created_at: g?.created_at ?? new Date().toISOString(),
    // Ensure these arrays exist to prevent crashes in Groups.tsx
    members: safeArray(g?.members),
    posts: safeArray(g?.posts),
    events: safeArray(g?.events),
    member_posting_allowed: Boolean(g?.member_posting_allowed ?? true),
  } as any;
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

/** ✅ UPDATED: Optimistic reel reaction helper ---------- */
const applyOptimisticReelReaction = (r: any, reelId: number, type: ReactionType, meId: number) => {
  if (Number(r?.id) !== Number(reelId)) return r;

  const reactions = safeArray<any>(r?.reactions);
  const hasLiked = reactions.some((reaction: any) => 
    Number(reaction?.userId ?? reaction?.user_id) === Number(meId) && reaction?.type === type
  );

  let newReactions = [...reactions];
  
  if (hasLiked) {
    // Remove reaction
    newReactions = newReactions.filter((reaction: any) => 
      !(Number(reaction?.userId ?? reaction?.user_id) === Number(meId) && reaction?.type === type)
    );
  } else {
    // Add reaction
    newReactions.push({ userId: meId, user_id: meId, type });
  }

  return {
    ...r,
    reactions: newReactions,
    likesCount: newReactions.length,
    reactions_count: newReactions.length,
  };
};

// Fixed duplicate function - renamed
const isHttpUrl2 = (u: string) => u.startsWith('http://') || u.startsWith('https://');
const isBlobUrl = (u: string) => u.startsWith('blob:');
const isHttpsUrl = (u: string) => u.startsWith('https://');
const isAbsoluteUrl = (u: string) => isHttpsUrl(u) || isHttpUrl2(u) || isBlobUrl(u);

const ensureAbsoluteUrl = (u?: string | null): string => {
  if (!u) return '';
  if (isAbsoluteUrl(u)) return u;
  // If backend returns relative path like /uploads/audio.mp3, make it absolute
  return `${window.location.origin}${u.startsWith('/') ? '' : '/'}${u}`;
};

// ✅ Critical: Ensure audio URLs are fetchable for trimming
const toFetchableAudioUrl = (u?: string | null): string => {
  const url = ensureAbsoluteUrl(u);
  if (!url) return '';

  // Blob URLs are already fetchable
  if (isBlobUrl(url)) return url;

  // ✅ FIXED: Use isHttpUrl2 instead of isHttpUrl
  if (isHttpUrl2(url) && window.location.protocol === 'https:') {
    return url.replace('http://', 'https://');
  }

  // ✅ FIXED: Enable audio proxy for reliable trimming
  const USE_AUDIO_PROXY = true; // ✅ CHANGED: Now enabled since we have /api/proxy-audio

  if (USE_AUDIO_PROXY) {
    // Check if same origin to avoid CORS issues
    const isSameOrigin = (() => {
      try {
        return new URL(url).origin === window.location.origin;
      } catch {
        return false;
      }
    })();

    // If cross-origin, use proxy for media.unera.social
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

/** ✅ ADDED: Helper to convert remote audio to blob URL for reliable trimming */
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

/** ---------- API helper with audio proxy support ---------- */
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

/**
 * Fetch user's followers/following data
 */
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

/**
 * ✅ UPDATED: Upload file to Cloudflare R2 with audio support
 */
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

/** ✅ UPDATED: Helper to ensure R2 URL with trimmed audio support ---------- */
const ensureR2Url = async (input: any, folder: string, fallbackName: string) => {
  if (!input) return '';

  // already a real URL
  if (typeof input === 'string' && isAbsoluteUrl(input)) {
    return input;
  }

  // blob URL -> fetch -> upload to R2
  if (typeof input === 'string' && isBlobUrl(input)) {
    try {
      const res = await fetch(input);
      if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`);
      
      const blob = await res.blob();
      
      // ✅ Preserve audio type for trimmed audio
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

  // File -> upload to R2
  if (typeof File !== 'undefined' && input instanceof File) {
    // ✅ Preserve audio type for trimmed audio
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

  // Blob -> convert to File -> upload
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    // ✅ Preserve audio type for trimmed audio
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

/** ✅ ADDED: Type for ReelSound with trimmed audio support ---------- */
type ReelSound = {
  songName: string;
  audioUrl: string;
  audioStart?: number;
  audioEnd?: number;
  songId?: string | number;
  soundKey?: string;
  isTrimmedAudio?: boolean;
  originalUrl?: string; // ✅ ADDED: Store original URL for re-trimming
};

type View =
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
  | 'register';

/**
 * Normalize FEED rows returned by /api/feeds
 */
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

// Facebook-like feed merging utility
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
        // ✅ FIXED 5: Change (existing as Any) to (existing as any)
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

// Minimal fallback user for UI stability
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

// ===== MUSIC PLAYER API HELPERS =====
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

// record play (same fallback strategy you used in MusicSystem.tsx)
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

export default function App() {
  useLanguage();

  /** ---------- State ---------- */
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [profilePosts, setProfilePosts] = useState<PostType[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [chats, setChats] = useState<any[]>([]);

  // ✅ ADDED: UNERA Music songs state
  const [songs, setSongs] = useState<Song[]>([]);
  
  // ✅ ADDED: Reel sound state (TikTok style)
  const [selectedReelSound, setSelectedReelSound] = useState<ReelSound | null>(null);

  // ✅ ADDED: Story states - UPDATED: Using activeStoryId instead of activeStory
  const [activeStoryId, setActiveStoryId] = useState<number | null>(null);
  const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'reels' | 'marketplace' | 'groups'>('home');
  const [view, setView] = useState<View>('home');

  const [feedHydrated, setFeedHydrated] = useState(false);
  const [isFeedRefreshing, setIsFeedRefreshing] = useState(false);
  
  // ✅ ADDED: Authentication hydration state
  const [authHydrated, setAuthHydrated] = useState(false);

  const lastGoodPostsRef = useRef<PostType[]>([]);
  const stableFeedRef = useRef<PostType[]>([]);
  const scheduleSilentRefreshRef = useRef<any>(null);

  const [commentPostSnapshot, setCommentPostSnapshot] = useState<PostType | null>(null);

  const [loginError, setLoginError] = useState('');

  // ✅ ADDED: Refs for deduplication and stable access
  const usersRef = useRef<User[]>([]);
  const storiesInFlightRef = useRef(false);
  const reelsInFlightRef = useRef(false);
  const postsInFlightRef = useRef(false);
  const usersInFlightRef = useRef(false);
  const otherDataInFlightRef = useRef(false);

  /** ===== ✅ ADDED: Facebook-like Story Seen System State ===== */
  const [seenStoryIds, setSeenStoryIds] = useState<Set<number>>(() => new Set(readStorySeen()));
  const [storyMuted, setStoryMuted] = useState(true); // FB defaults muted

  /** ✅ ADDED: Helper to mark story as seen ---------- */
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

  /** ✅ ADDED: Facebook-like story ordering (unseen first, then newest) ---------- */
  const orderedStories = useMemo(() => {
    const list = safeArray(stories);

    // Unseen first
    const unseen = list.filter(s => !seenStoryIds.has(Number(s.id)));
    const seen = list.filter(s => seenStoryIds.has(Number(s.id)));

    // Newest first inside each bucket
    const byTimeDesc = (a: any, b: any) => String(b?.created_at || '').localeCompare(String(a?.created_at || ''));

    unseen.sort(byTimeDesc);
    seen.sort(byTimeDesc);

    return [...unseen, ...seen];
  }, [stories, seenStoryIds]);

  /** ✅ ADDED: Preload story media for instant opening ---------- */
  const preloadStoryMedia = useCallback((s: Story) => {
    const url = String(s?.media_url || '');
    if (!url) return;

    // Image preload
    if (s.type === 'image') {
      const img = new Image();
      img.src = url;
      return;
    }

    // Video preload (metadata is enough to feel instant)
    if (s.type === 'video') {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = url;
      return;
    }
  }, []);

  /** ✅ ADDED: Derived active story from activeStoryId ---------- */
  const activeStory = useMemo(() => {
    if (!activeStoryId) return null;
    return orderedStories.find(s => Number(s.id) === Number(activeStoryId)) || null;
  }, [activeStoryId, orderedStories]);

  /** ✅ ADDED: Helper to close story viewer ---------- */
  const closeStoryViewer = useCallback(() => {
    setActiveStoryId(null);
  }, []);

  /** ✅ ADDED: Auto-advance + next story logic (Facebook feel) ---------- */
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

  /** ✅ ADDED: Story reaction handler ---------- */
  const reactToStory = useCallback(async (storyId: number, reaction: string) => {
    if (!requireAuth('Reacting to stories')) return;
    if (!currentUser) return;

    try {
      // Optimistic update
      setStories(prev =>
        prev.map(story => {
          if (Number(story.id) !== Number(storyId)) return story;
          
          // Update views with reaction
          const updatedViews = story.views ? [...story.views] : [];
          const existingViewIndex = updatedViews.findIndex(v => 
            Number(v.user_id) === Number(currentUser.id)
          );
          
          if (existingViewIndex >= 0) {
            updatedViews[existingViewIndex] = {
              ...updatedViews[existingViewIndex],
              reaction: reaction as any
            };
          }
          
          return {
            ...story,
            views: updatedViews
          };
        })
      );

      await apiFetch(`/api/stories/${storyId}/react`, {
        method: 'POST',
        body: JSON.stringify({ 
          user_id: currentUser.id, 
          reaction: reaction 
        }),
      });

    } catch (error) {
      console.error('Failed to react to story:', error);
      // Revert optimistic update
      fetchStories().catch(() => {});
    }
  }, [currentUser, requireAuth, fetchStories]);

  /** ✅ ADDED: Fetch story viewers ---------- */
  const fetchStoryViewers = useCallback(async (storyId: number) => {
    try {
      const data = await apiFetch(`/api/stories/${storyId}/viewers`);
      const viewers = safeArray(data?.viewers ?? data);
      return viewers.map((viewer: any) => ({
        ...viewer,
        user: viewer.user ? normalizeUser(viewer.user) : undefined
      }));
    } catch (error) {
      console.error('Failed to fetch story viewers:', error);
      return [];
    }
  }, []);

  /** ✅ ADDED: Fetch story analytics ---------- */
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

  /** ✅ ADDED: View story callback ---------- */
  const viewStory = useCallback(async (storyId: number) => {
    if (!requireAuth('Viewing stories')) return;
    if (!currentUser) return;

    try {
      // Record view
      await apiFetch(`/api/stories/${storyId}/view`, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.id }),
      });

      // Refresh stories to update view counts
      fetchStories().catch(() => {});
    } catch (error) {
      console.error('Failed to record story view:', error);
    }
  }, [currentUser, requireAuth, fetchStories]);

  /** ✅ UPDATED: Open story viewer function ---------- */
  const openStoryViewer = useCallback((story: Story) => {
    const id = Number(story?.id);
    if (!id) return;

    // Open viewer
    setActiveStoryId(id);

    // Record view
    if (currentUser) {
      viewStory(id);
    }

    // Mark seen immediately
    markStorySeen(id);

    // Preload current + next for instant swipe
    preloadStoryMedia(story);
    const next = (() => {
      const idx = orderedStories.findIndex(x => Number(x.id) === id);
      return idx >= 0 ? orderedStories[idx + 1] : null;
    })();
    if (next) preloadStoryMedia(next);
  }, [currentUser, viewStory, markStorySeen, preloadStoryMedia, orderedStories]);

  /** ✅ ADDED: Handle story like function ---------- */
  const likeStory = useCallback(async (storyId: number) => {
    if (!requireAuth('Liking stories')) return;
    if (!currentUser) return;

    try {
      // Optimistic update
      setStories(prev =>
        prev.map(story => {
          if (Number(story.id) !== Number(storyId)) return story;
          
          return {
            ...story,
            liked_by_me: !story.liked_by_me
          };
        })
      );

      await apiFetch(`/api/stories/${storyId}/like`, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.id }),
      });

    } catch (error) {
      console.error('Failed to like story:', error);
      // Revert optimistic update
      fetchStories().catch(() => {});
    }
  }, [currentUser, requireAuth, fetchStories]);

  /** ✅ ADDED: Handle story reply function ---------- */
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

      // Show success toast
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

  /** ---------- ✅ FIXED: Keep refs in sync with state ---------- */
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  /** ---------- Auth gate ---------- */
  const requireAuth = useCallback(
    (actionName = 'This action') => {
      if (currentUser) return true;
      setLoginError(`${actionName} requires login.`);
      setView('login');
      return false;
    },
    [currentUser]
  );

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeReelId, setActiveReelId] = useState<number | null>(null);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showCreateReelModal, setShowCreateReelModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);

  const [activeSharePost, setActiveSharePost] = useState<any>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareInProgress, setShareInProgress] = useState(false);

  // Add state for follow loading to prevent double clicks
  const [followLoading, setFollowLoading] = useState<{ [key: number]: boolean }>({});

  // ✅ ADDED: Hashtag filtering state for Facebook-like feed filtering
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);

  // ===== MUSIC PLAYER (GLOBAL) STATE =====
  const [currentAudioTrack, setCurrentAudioTrack] = useState<AudioTrack | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // play history (for dashboard + next/previous)
  const [playHistory, setPlayHistory] = useState<AudioTrack[]>([]);

  // liked tracks in format "music:ID" or "podcast:ID"
  const [likedTracks, setLikedTracks] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('unera_liked_tracks') || '[]');
    } catch {
      return [];
    }
  });

  // plays map for current track UI (player can show total plays)
  const [trackPlays, setTrackPlays] = useState<Record<string, number>>({});

  // ✅ FIXED: User's total plays with per-user caching to prevent disappearance
  const [myTotalPlays, setMyTotalPlays] = useState<number>(() => {
    try {
      const rawUser = localStorage.getItem(LS_USER_KEY);
      let uid = 0;
      try { 
        const user = JSON.parse(rawUser || '{}');
        uid = Number(user?.id || 0); 
      } catch {}
      
      // Per-user cache key to prevent mix-ups between accounts
      const key = uid ? `unera_my_total_plays_${uid}` : 'unera_my_total_plays';
      const v = Number(localStorage.getItem(key) || 0);
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  });
  
  const [playsLoading, setPlaysLoading] = useState(false);

  // ✅ ADDED: Play count tracking ref
  const lastPlayedKeyRef = useRef<string>('');

  // Persist liked tracks and total plays
  useEffect(() => {
    localStorage.setItem('unera_liked_tracks', JSON.stringify(likedTracks));
  }, [likedTracks]);

  // ✅ FIXED: Persist total plays per user (not globally)
  useEffect(() => {
    if (!currentUser?.id) return;
    
    // Store per-user to prevent mix-ups
    const key = `unera_my_total_plays_${Number(currentUser.id)}`;
    localStorage.setItem(key, String(myTotalPlays));
    
    // Also keep legacy key for compatibility
    localStorage.setItem('unera_my_total_plays', String(myTotalPlays));
  }, [myTotalPlays, currentUser?.id]);

  /** ---------- ✅ ADDED: Helper to resolve track owner ---------- */
  const resolveTrackOwner = useCallback((track: any): User | null => {
    if (!track) return null;

    // try common fields
    const ownerId =
      safeNumber(track.user_id ?? track.owner_user_id ?? track.artist_user_id ?? track.creator_id ?? 0, 0);

    if (ownerId) {
      const found = users.find((u) => Number(u.id) === Number(ownerId));
      if (found) return found;
    }

    // fallback: if track has embedded owner fields
    if (track?.owner && (track.owner.id || track.owner.user_id)) {
      return normalizeUser(track.owner);
    }

    return null;
  }, [users]);

  /** ---------- ✅ FIXED: Fetch user total plays with proper caching ---------- */
  const fetchMyTotalPlays = useCallback(async (userId: number) => {
    if (!userId) return myTotalPlays;

    const cacheKey = `unera_my_total_plays_${userId}`;

    // ✅ Read cached value (per-user)
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
      // ✅ OPTION A (preferred): one endpoint that returns total plays for the user
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
        // ✅ OPTION B fallback: sum two endpoints
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

        // ✅ If both invalid -> keep cached value (don't wipe to 0!)
        setMyTotalPlays(cached);
        return cached;
      } catch {
        // ✅ Keep cached value on complete failure
        setMyTotalPlays(cached);
        return cached;
      }
    } finally {
      setPlaysLoading(false);
    }
  }, [myTotalPlays, apiFetch]);

  /** ---------- ✅ UPDATED: Fetch UNERA Music songs with BOTH raw and fetchable URLs ---------- */
  const fetchSongs = useCallback(async () => {
    try {
      const data = await apiFetch('/api/songs');
      const list = Array.isArray(data) ? data : (data?.songs ?? data?.data ?? []);
      
      // ✅ CRITICAL: Normalize songs with BOTH raw and fetchable audio URLs
      const normalized = list
        .map((song) => {
          const s = normalizeSong(song);
          const raw = ensureAbsoluteUrl(s.audio_url);          // raw absolute URL for D1 storage
          const fetchable = toFetchableAudioUrl(raw);          // fetchable/proxy for trimming

          return {
            ...s,
            audio_url: raw,                // ✅ keep raw for saving to backend
            audio_fetch_url: fetchable,    // ✅ use this for trimming/playback
          } as any;
        })
        .filter((x: any) => x.audio_url);
      
      setSongs(normalized);
    } catch (e) {
      console.error('Failed to fetch songs:', e);
      // ✅ FIXED: Don't clear existing songs on transient error
      // setSongs([]);
    }
  }, []);

  /** ✅ UPDATED: Fetch Stories with deduplication, seen tracking, and proper merging ---------- */
  const fetchStories = useCallback(async () => {
    if (storiesInFlightRef.current) return;
    storiesInFlightRef.current = true;
    
    try {
      const data = await apiFetch('/api/stories');
      const storiesList = safeArray(data?.stories ?? data);
      
      // snapshot users once
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

      // ✅ UPDATED: Keep local "truth" (liked_by_me / seen / any UI flags) on refetch
      setStories(prev => {
        const map = new Map<number, Story>();
        safeArray(prev).forEach(st => map.set(Number(st.id), st));

        return normalizedStories.map(ns => {
          const old = map.get(Number(ns.id));
          if (!old) return ns;

          return {
            ...ns,
            liked_by_me: ns.liked_by_me ?? old.liked_by_me, // keep local truth
            views: ns.views ?? old.views, // keep existing views
          };
        });
      });
      
      setUsers(Array.from(map.values()));
      
    } catch (error) {
      console.error('Failed to fetch stories:', error);
      // ✅ FIXED: Don't clear stories on transient error
      // setStories([]);
    } finally {
      storiesInFlightRef.current = false;
    }
  }, []);

  /** ---------- ✅ ADDED: Create Story Function ---------- */
  const createStory = useCallback(async (storyData: Partial<Story> & { media_file?: File; audio_file?: File }) => {
    if (!requireAuth('Creating stories')) return;
    if (!currentUser) return;

    try {
      let mediaUrl = storyData.media_url;
      let musicUrl = storyData.music_url;

      // Upload media file if provided
      if (storyData.media_file) {
        const uploadResult = await uploadToCloudflareR2(storyData.media_file, 'stories');
        mediaUrl = uploadResult.url;
      }

      // Upload audio file if provided
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

      // Add to stories list
      setStories(prev => [newStory, ...prev]);

      // Show success
      setLoginError('Story created successfully!');
      
    } catch (error: any) {
      console.error('Failed to create story:', error);
      setLoginError(error?.message || 'Failed to create story');
    }
  }, [currentUser, requireAuth]);

  // ✅ FIXED: Call fetchMyTotalPlays only after auth is hydrated
  useEffect(() => {
    if (!authHydrated) return; // ✅ Wait until session restore is finished

    if (currentUser?.id) {
      fetchMyTotalPlays(Number(currentUser.id)).catch(() => {});
    } else {
      // Only set to 0 after we're sure there's no user
      setMyTotalPlays(0);
    }
  }, [authHydrated, currentUser?.id, fetchMyTotalPlays]);

  /** ---------- ✅ CORE PLAYER ACTIONS ---------- */
  const onPlayTrack = useCallback((track: AudioTrack) => {
    // ✅ Ensure track has a valid cover, use default if not
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

    // store history (no duplicates back-to-back)
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
    // playHistory[0] is current-ish; next is index 1 (simple behavior)
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
    // "Previous" = go back to second item if exists (simple behavior)
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

  /** ---------- ✅ IMPLEMENT onStarted (the MOST IMPORTANT part) ---------- */
  const onStarted = useCallback(async (track: AudioTrack) => {
    try {
      setPlaysLoading(true);

      const userId = (currentUser as any)?.id ?? null;

      // ✅ Optimistic "my plays" - only if user is logged in
      if (userId) {
        setMyTotalPlays(p => p + 1);
        
        // ✅ Also update localStorage immediately for persistence
        const key = `unera_my_total_plays_${Number(userId)}`;
        const current = Number(localStorage.getItem(key) || '0');
        localStorage.setItem(key, String(current + 1));
      }

      const res = await recordPlay(track, userId);

      // backend might return plays_count / plays / etc
      const newPlays = Number(res?.plays_count ?? res?.plays ?? res?.count ?? 0);

      const key = `${track.type}:${String(track.id)}`;
      if (Number.isFinite(newPlays) && newPlays > 0) {
        setTrackPlays(prev => ({ ...prev, [key]: newPlays }));
      } else {
        // fallback: increment local track plays
        setTrackPlays(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
      }
    } catch (e) {
      // don't crash UI if play endpoint fails
      const key = `${track.type}:${String(track.id)}`;
      setTrackPlays(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    } finally {
      setPlaysLoading(false);
    }
  }, [currentUser]);

  /** ---------- ✅ LIKES SYNC HANDLER (used by MusicSystem) ---------- */
  const handleMusicSystemLikeSync = useCallback((key: string, liked: boolean) => {
    setLikedTracks(prev => {
      const has = prev.includes(key);
      if (liked && !has) return [...prev, key];
      if (!liked && has) return prev.filter(x => x !== key);
      return prev;
    });
  }, []);

  /** ---------- ✅ COMPUTE IS LIKED FOR GLOBAL AUDIO PLAYER ---------- */
  const isPlayerLiked = useMemo(() => {
    if (!currentAudioTrack) return false;
    return likedTracks.includes(`${currentAudioTrack.type}:${String(currentAudioTrack.id)}`);
  }, [currentAudioTrack, likedTracks]);

  /** ---------- ✅ ADDED: CREATE PRODUCT FUNCTION ---------- */
  const createProduct = useCallback(async (productData: any) => {
    if (!requireAuth("Creating products")) return;
    if (!currentUser) return;

    const payload = { ...productData, seller_id: currentUser.id };

    // ✅ optimistic insert (optional)
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

      const created = normalizeProduct(res?.product ?? res);
      setProducts(prev => {
        const filtered = safeArray(prev).filter((x: any) => Number(x.id) !== Number(tempId));
        return [created, ...filtered];
      });
    } catch (e: any) {
      // rollback optimistic on failure
      setProducts(prev => safeArray(prev).filter((x: any) => Number(x.id) !== Number(tempId)));
      setLoginError(e?.message || "Failed to create product");
    }
  }, [currentUser, requireAuth]);

  /** ---------- ADMIN ROLE GUARDS (PROFESSIONALLY FIXED) ---------- */
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
    setView('profile');
    window.scrollTo(0, 0);
  }, []);

  /** ---------- ✅ FIXED: Fetch users list with deduplication ---------- */
  const fetchUsersList = useCallback(async () => {
    if (usersInFlightRef.current) return;
    usersInFlightRef.current = true;
    
    try {
      const u = await apiFetch('/api/users').catch(() => []);
      const newUsers = safeArray(u).map(normalizeUser);
      
      // ✅ FIXED: Merge with existing users to prevent blinking
      setUsers(prev => {
        const map = new Map<number, User>();
        safeArray(prev).forEach(user => map.set(Number(user.id), user));
        
        newUsers.forEach(newUser => {
          const id = Number(newUser.id);
          if (!id) return;
          
          const existing = map.get(id);
          if (existing) {
            // Merge safely without overwriting good data
            map.set(id, normalizeUser(mergeUserSafe(existing, newUser)));
          } else {
            map.set(id, normalizeUser(newUser));
          }
        });
        
        return Array.from(map.values());
      });
    } catch {
      // ✅ FIXED: Don't clear users on transient error
      // setUsers([]);
    } finally {
      usersInFlightRef.current = false;
    }
  }, []);

  /** ---------- ✅ FIXED: Fetch reels with deduplication ---------- */
  const fetchReels = useCallback(async () => {
    if (reelsInFlightRef.current) return;
    reelsInFlightRef.current = true;
    
    try {
      const data = await apiFetch('/api/reels');
      const reelsList = safeArray(data?.reels ?? data);
      
      // ✅ CRITICAL: Normalize reels with fetchable audio URLs
      const normalizedReels = reelsList.map(reel => {
        const normalized = normalizeReel(reel);
        // Ensure audio URL is fetchable for trimming
        return {
          ...normalized,
          audioUrl: toFetchableAudioUrl(normalized.audioUrl),
        };
      });
      
      setReels(normalizedReels);
    } catch (error) {
      console.error('Failed to fetch reels:', error);
      // ✅ FIXED: Don't clear reels on transient error
      // setReels([]);
    } finally {
      reelsInFlightRef.current = false;
    }
  }, []);

  /** ✅ UPDATED: Generate sound key based on sound type ---------- */
  const generateSoundKey = useCallback((reelData: any, selectedReelSound: ReelSound | null): string => {
    // Use soundKey from reelData if provided
    if (reelData.soundKey) return reelData.soundKey;
    
    // Generate based on songId if available
    if (selectedReelSound?.songId) {
      return `song:${selectedReelSound.songId}`;
    }
    
    // ✅ For trimmed audio, generate unique key
    if (reelData.audioFile) {
      return `trimmed:${currentUser?.id || 'unknown'}:${Date.now()}`;
    }
    
    // Generate based on audioUrl if available
    if (selectedReelSound?.audioUrl) {
      return `original:${currentUser?.id || 'unknown'}:${Date.now()}`;
    }
    
    // Default fallback
    return 'original:none';
  }, [currentUser]);

  /** ✅ UPDATED: Create reel with physical audio trimming support ---------- */
  const createReel = useCallback(async (reelData: Partial<Reel> & { 
    videoFile?: File | Blob; 
    audioFile?: File | Blob;
    originalSoundId?: string | number;
  }) => {
    if (!requireAuth('Creating reels')) return;
    if (!currentUser) return;

    console.log("createReel input:", reelData);
    
    setIsFeedRefreshing(true);
    
    try {
      const videoFile = reelData.videoFile;
      const audioFile = reelData.audioFile;
      
      if (!videoFile) {
        throw new Error('Video was not uploaded. Please select a video [video file missing]');
      }

      // ✅ Upload video to R2
      const videoUrl = await ensureR2Url(
        videoFile,
        'reels',
        `reel-${Date.now()}.mp4`
      );

      // ✅ Handle audio file (could be trimmed or original)
      let audioUrl = null;
      if (audioFile) {
        // If audioFile exists, it's a trimmed or custom audio file
        audioUrl = await ensureR2Url(
          audioFile,
          'reel-audio',
          `audio-${Date.now()}.wav` // ✅ Changed to .wav for trimmed audio
        );
      } else if (reelData.audioUrl) {
        // ✅ Use the raw audio URL passed from CreateReelModal (which should be originalUrl)
        audioUrl = reelData.audioUrl;
      }

      // ✅ IMPORTANT: never post to backend without a real URL
      if (!videoUrl || !videoUrl.startsWith('http')) {
        throw new Error('Reel video upload failed (no valid R2 URL).');
      }

      // ✅ Determine if this is trimmed audio using soundKey (not start=0,end=0)
      const soundKey = generateSoundKey(reelData, selectedReelSound);
      const isTrimmedAudio = soundKey.startsWith('trimmed:');
      
      // ✅ For trimmed audio: audio_start=0, audio_end=0
      // ✅ For original sound: use provided start/end times
      const audioStart = isTrimmedAudio ? 0 : (reelData.audioStart || 0);
      const audioEnd = isTrimmedAudio ? 0 : (reelData.audioEnd || 0);
      
      // ✅ Use selectedReelSound if available, otherwise use reelData
      const soundPayload = selectedReelSound || {
        songName: reelData.songName || 'Original Sound',
        audioUrl: audioUrl || '',
        audioStart,
        audioEnd,
        songId: reelData.originalSoundId,
      };

      // ✅ UPDATED: Payload matches D1 table columns with trimmed audio support
      const payload = {
        user_id: currentUser.id,
        caption: reelData.caption || '',
        video_url: videoUrl,
        song_name: soundPayload.songName,
        audio_url: audioUrl, // ✅ This will be the trimmed audio URL or original URL
        audio_start: audioStart, // ✅ 0 for trimmed audio, original start time otherwise
        audio_end: audioEnd, // ✅ 0 for trimmed audio, original end time otherwise
        song_id: soundPayload.songId || null,
        sound_key: soundKey,
        visibility: reelData.visibility || 'public',
        location: reelData.location || '',
        views: 0,
        shares: 0,
      };
      
      console.log("Sending to API:", payload);
      
      const data = await apiFetch('/api/reels', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      const newReel = normalizeReel(data.reel || data);
      
      // Optimistically add to reels list
      setReels(prev => [newReel, ...safeArray(prev)]);
      
      // Refresh reels list
      fetchReels().catch(() => {});
      
      // Show success
      setLoginError('Reel posted successfully!');
      
      // Clear selected sound after successful creation
      setSelectedReelSound(null);
      
    } catch (error: any) {
      console.error('Failed to create reel:', error);
      setLoginError(error?.message || 'Failed to create reel');
    } finally {
      setIsFeedRefreshing(false);
      setShowCreateReelModal(false);
    }
  }, [currentUser, requireAuth, fetchReels, selectedReelSound, generateSoundKey]);

  /** ---------- ✅ ADDED: React to reel ---------- */
  const reactToReel = useCallback(async (reelId: number, type?: ReactionType) => {
    if (!requireAuth('Reacting to reels')) return;
    if (!currentUser) return;

    const reactionType = type || 'love';
    
    // Optimistic update
    setReels(prev => 
      safeArray(prev).map(reel => 
        reel.id === reelId 
          ? applyOptimisticReelReaction(reel, reelId, reactionType, currentUser.id)
          : reel
      )
    );

    try {
      await apiFetch(`/api/reels/${reelId}/react`, {
        method: 'POST',
        body: JSON.stringify({ type: reactionType, user_id: currentUser.id }),
      });
      
      // Refresh reels to get accurate data
      fetchReels().catch(() => {});
      
    } catch (error) {
      console.error('Failed to react to reel:', error);
      // Refresh reels to revert optimistic update
      fetchReels().catch(() => {});
    }
  }, [currentUser, requireAuth, fetchReels]);

  /** ---------- ✅ ADDED: Comment on reel ---------- */
  const commentOnReel = useCallback(async (reelId: number, text: string) => {
    if (!requireAuth('Commenting on reels')) return;
    if (!currentUser) return;

    try {
      await apiFetch(`/api/reels/${reelId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text, user_id: currentUser.id }),
      });
      
      // Refresh reels to get updated comments
      fetchReels().catch(() => {});
      
    } catch (error) {
      console.error('Failed to comment on reel:', error);
      setLoginError('Failed to post comment');
    }
  }, [currentUser, requireAuth, fetchReels]);

  /** ---------- ✅ ADDED: Share reel ---------- */
  const shareReel = useCallback(async (reelId: number, type: 'feed' | 'copy') => {
    if (!requireAuth('Sharing reels')) return;
    if (!currentUser) return;

    try {
      await apiFetch(`/api/reels/${reelId}/share`, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.id, destination: type }),
      });
      
      // Optimistic update - increment share count
      setReels(prev => 
        safeArray(prev).map(reel => 
          reel.id === reelId 
            ? { ...reel, shares: (reel.shares || 0) + 1 }
            : reel
        )
      );
      
      if (type === 'copy') {
        // Copy link to clipboard
        const reelLink = `${window.location.origin}/reels/${reelId}`;
        navigator.clipboard.writeText(reelLink).then(() => {
          setLoginError('Link copied to clipboard!');
        });
      }
      
    } catch (error) {
      console.error('Failed to share reel:', error);
      setLoginError('Failed to share');
    }
  }, [currentUser, requireAuth]);

  /** ✅ UPDATED: Use sound from reel with fetchable audio URLs and original URL storage ---------- */
  const useSoundFromReel = useCallback((soundFromReel: any) => {
    // ✅ Get the raw D1 audio_url (this is what's stored in database)
    const audioUrlRaw = soundFromReel?.audio_url ?? soundFromReel?.audioUrl ?? '';
    
    if (!audioUrlRaw) return;

    const songName = soundFromReel?.song_name ?? soundFromReel?.songName ?? 'Original Sound';
    const audioStart = safeNumber(soundFromReel?.audio_start ?? soundFromReel?.audioStart ?? 0);
    const audioEnd = safeNumber(soundFromReel?.audio_end ?? soundFromReel?.audioEnd ?? 0);
    const songId = soundFromReel?.song_id ?? soundFromReel?.songId ?? null;
    const soundKey = String(soundFromReel?.sound_key ?? soundFromReel?.soundKey ?? '');

    // Check if this is trimmed audio using soundKey
    const isTrimmedAudio = soundKey.startsWith('trimmed:');

    setSelectedReelSound({
      songName,
      // ✅ for trimming/fetching (use audio_fetch_url if available, otherwise generate fetchable URL)
      audioUrl: soundFromReel?.audio_fetch_url || toFetchableAudioUrl(audioUrlRaw),
      // ✅ Store the raw URL (originalUrl) for re-trimming
      originalUrl: audioUrlRaw,
      audioStart,
      audioEnd,
      songId,
      soundKey,
      isTrimmedAudio,
    });

    setShowCreateReelModal(true);
  }, []);

  /** ---------- ✅ FIXED: Fetch posts with deduplication ---------- */
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

          // ✅ FIXED: Merge authors into users list SAFELY
          setUsers((prev) => {
            const map = new Map<number, User>();
            safeArray(prev).forEach((u) => map.set(Number(u.id), normalizeUser(u)));

            rows.forEach((r) => {
              const author = authorFromFeedRow(r);
              if (!author?.id) return;
              
              const existing = map.get(author.id);
              if (existing) {
                // ✅ CRITICAL: Merge safely without overwriting good data
                map.set(author.id, normalizeUser(mergeUserSafe(existing, author)));
              } else {
                map.set(author.id, author);
              }
            });

            return Array.from(map.values());
          });

          const normalized = rows.map(normalizeFeedRowToPost);

          // unseen first + session shuffle + diversify
          const unseen = normalized.filter((p: any) => !seen.has(Number(p.id)));
          const seenOnes = normalized.filter((p: any) => seen.has(Number(p.id)));

          const ordered = diversifyFeed(
            [...seededShuffle(unseen, seed), ...seededShuffle(seenOnes, seed ^ 0xabcddcba)],
            seed
          );

          // remember "first screen"
          pushSeenIds(ordered.slice(0, 40).map((p: any) => Number(p.id)));

          setPosts((prev) => {
            const next = mergeFeed(prev, ordered);
            stableFeedRef.current = next;
            lastGoodPostsRef.current = next;
            return next;
          });

          if (!feedHydrated) setFeedHydrated(true);

          // keep comments stable
          if (activeCommentsPostId != null) {
            const found = ordered.find((p: any) => Number(p.id) === Number(activeCommentsPostId));
            if (found) setCommentPostSnapshot(found);
          }

          return;
        }

        // Guest feed fallback
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

        if (activeCommentsPostId != null) {
          const found = normalized.find((x: any) => Number(x.id) === Number(activeCommentsPostId));
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
    [activeCommentsPostId, feedHydrated]
  );

  /** ✅ Fetch profile posts with viewerId (latest only) ---------- */
  const fetchProfilePosts = useCallback(async (profileUserId: number) => {
    try {
      // ✅ ADDED: Always send viewerId when fetching profile posts
      const viewerId = currentUser?.id ? Number(currentUser.id) : 0;
      const data = await apiFetch(`/api/posts/by-user?userId=${profileUserId}&viewerId=${viewerId}&limit=50`);
      
      const list = safeArray<any>((data as any)?.posts ?? (data as any)?.results ?? data);
      const normalized = list.map(normalizePost);

      // Always latest-first (already ordered by API, but keep safe)
      normalized.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

      // ✅ UPDATED: Don't let a profile refetch overwrite local reaction truth
      setProfilePosts(prev => {
        // Merge with any local truth we already have
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
      // ✅ FIXED: Don't clear profile posts on transient error
      // setProfilePosts([]);
    }
  }, [currentUser, posts]);

  /** ---------- Fetch follow data for a user ---------- */
  const fetchUserFollowDataForUI = useCallback(async (userId: number) => {
    try {
      const followData = await fetchUserFollowData(userId);
      
      // Update the specific user in the users list
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

      // Also update currentUser if it's the logged in user
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

  /** ---------- Load follow data when viewing a profile ---------- */
  useEffect(() => {
    if (view !== 'profile' || !selectedUserId) return;
    
    fetchUserFollowDataForUI(Number(selectedUserId)).catch(() => {});
  }, [view, selectedUserId, fetchUserFollowDataForUI]);

  /** ---------- Load follow data for current user on login ---------- */
  useEffect(() => {
    if (!currentUser?.id) return;
    
    fetchUserFollowDataForUI(Number(currentUser.id)).catch(() => {});
  }, [currentUser?.id, fetchUserFollowDataForUI]);

  /** ---------- Silent refresh helper ---------- */
  const scheduleSilentRefresh = useCallback(() => {
    if (scheduleSilentRefreshRef.current) clearTimeout(scheduleSilentRefreshRef.current);
    scheduleSilentRefreshRef.current = setTimeout(() => {
      fetchPostsForHome(currentUser).catch(() => {});
      fetchReels().catch(() => {});
    }, 8000);
  }, [currentUser, fetchPostsForHome, fetchReels]);

// ================== EVENTS API INTEGRATIONS (FIXED) ====================
// ✅ Fix #2: ALWAYS normalize inside optimistic updates
// This prevents blank screens when some events use attendee_ids / interested_ids / cover_url / event_date etc.

const joinEvent = useCallback(async (eventId: number) => {
  if (!requireAuth('Joining events')) return;
  if (!currentUser) return;

  try {
    const res = await apiFetch(`/api/events/${eventId}/attend`, {
      method: 'POST',
      body: JSON.stringify({ user_id: currentUser.id }),
    });

    if (res?.success) {
      setEvents(prev =>
        safeArray(prev).map(ev => {
          const event = normalizeEvent(ev); // ✅ important

          if (Number(event.id) !== Number(eventId)) return event;

          const nextAttendees = [...safeArray(event.attendees), Number(currentUser.id)]
            .filter((v, i, a) => a.indexOf(v) === i);

          const nextInterested = safeArray(event.interestedIds).filter(
            id => Number(id) !== Number(currentUser.id)
          );

          return {
            ...event,
            attendees: nextAttendees,
            interestedIds: nextInterested,
          };
        })
      );
    }

    return res;
  } catch (error: any) {
    console.error('Failed to join event:', error);
    setLoginError(error?.message || 'Failed to join event');
    throw error;
  }
}, [currentUser, requireAuth]);

const markEventInterested = useCallback(async (eventId: number) => {
  if (!requireAuth('Marking event as interested')) return;
  if (!currentUser) return;

  try {
    const res = await apiFetch(`/api/events/${eventId}/interested`, {
      method: 'POST',
      body: JSON.stringify({ user_id: currentUser.id }),
    });

    if (res?.success) {
      setEvents(prev =>
        safeArray(prev).map(ev => {
          const event = normalizeEvent(ev); // ✅ important

          if (Number(event.id) !== Number(eventId)) return event;

          const nextInterested = [...safeArray(event.interestedIds), Number(currentUser.id)]
            .filter((v, i, a) => a.indexOf(v) === i);

          const nextAttendees = safeArray(event.attendees).filter(
            id => Number(id) !== Number(currentUser.id)
          );

          return {
            ...event,
            interestedIds: nextInterested,
            attendees: nextAttendees,
          };
        })
      );
    }

    return res;
  } catch (error: any) {
    console.error('Failed to mark event as interested:', error);
    setLoginError(error?.message || 'Failed to mark interest');
    throw error;
  }
}, [currentUser, requireAuth]);

const createEvent = useCallback(async (eventData: any) => {
  if (!requireAuth('Creating events')) return;
  if (!currentUser) return;

  try {
    const payload = {
      title: safeString(eventData?.title).trim(),
      description: safeString(eventData?.description).trim(),

      // ✅ Map UI date/time -> DB columns
      event_date: safeString(eventData?.event_date ?? eventData?.date),
      event_time: safeString(eventData?.event_time ?? eventData?.time),

      location: safeString(eventData?.location).trim(),
      visibility: safeString(eventData?.visibility, 'worldwide'),

      // ✅ Map UI image -> DB cover_url
      cover_url: safeString(eventData?.cover_url ?? eventData?.image),

      // ✅ creator fields (your backend uses creator_* in types)
      creator_id: Number(currentUser.id),
      creator_name: safeString(currentUser.name),
      creator_avatar: safeString(currentUser.profile_image_url),
    };

    const res = await apiFetch('/api/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    // ✅ normalize whatever backend returns
    const newEvent = normalizeEvent(res?.event ?? res);

    // ✅ store normalized always
    setEvents(prev => [newEvent, ...safeArray(prev).map(normalizeEvent)]);
    return newEvent;
  } catch (error: any) {
    console.error('Failed to create event:', error);
    setLoginError(error?.message || 'Failed to create event');
    throw error;
  }
}, [currentUser, requireAuth]);

  // ==================== GROUPS BACKEND INTEGRATIONS ====================

  /** ---------- ✅ FIXED: Fetch other data WITHOUT stories (stable dependency) ---------- */
  const fetchOtherData = useCallback(async () => {
    if (otherDataInFlightRef.current) return;
    otherDataInFlightRef.current = true;
    
    try {
      // ✅ FIXED: REMOVED stories from Promise.all - stories are fetched separately
      const [pr, g, b, e, c] = await Promise.all([
        apiFetch('/api/products').catch(() => []),
        apiFetch('/api/groups').catch(() => []),
        apiFetch('/api/brands').catch(() => []),
        // ✅ CRITICAL FIX: Always normalize events when loading
        apiFetch('/api/events').then(data => safeArray(data?.events ?? data).map(normalizeEvent)).catch(() => []),
        apiFetch('/api/chats').catch(() => []),
      ]);

      // ✅ FIXED: Handle different API response formats for products
      const prRaw = pr;
      const prList =
        Array.isArray(prRaw) ? prRaw :
        Array.isArray((prRaw as any)?.products) ? (prRaw as any).products :
        Array.isArray((prRaw as any)?.data) ? (prRaw as any).data :
        Array.isArray((prRaw as any)?.results) ? (prRaw as any).results :
        Array.isArray((prRaw as any)?.items) ? (prRaw as any).items :
        [];

      setProducts(prList.map(normalizeProduct));
      
      // ✅ FIXED: Handle new groups API response shape WITH NORMALIZATION
      const gRaw = g;
      const gList = Array.isArray(gRaw)
        ? gRaw
        : Array.isArray((gRaw as any)?.groups) ? (gRaw as any).groups
        : Array.isArray((gRaw as any)?.results) ? (gRaw as any).results
        : [];
      
      // ✅ CRITICAL: Normalize groups to prevent crashes
      setGroups(gList.map(normalizeGroup));
      
      setBrands(safeArray(b));
      
      // ✅ UPDATED: Normalize events (already normalized above)
      // e is already normalized from Promise.all
      setEvents(e);
      
      setChats(safeArray(c));
    } catch (error) {
      console.error('Failed to fetch other data:', error);
      // ✅ FIXED: Don't clear all data on transient error
    } finally {
      otherDataInFlightRef.current = false;
    }
  }, []); // ✅ FIXED: Empty dependency array - stable function

  /** ---------- ✅ 2) Fetch group posts with viewerId ---------- */
  const fetchGroupPosts = useCallback(async (groupId: number) => {
    try {
      const viewerId = currentUser?.id ? Number(currentUser.id) : 0;
      const res = await apiFetch(`/api/group-posts?group_id=${groupId}&viewerId=${viewerId}`);
      return safeArray((res as any)?.posts).map(normalizePost);
    } catch (error) {
      console.error('Failed to fetch group posts:', error);
      return [];
    }
  }, [currentUser]);

  /** ---------- ✅ 3) Implement real Group Like toggle ---------- */
  const toggleGroupPostLike = useCallback(async (postId: number) => {
    if (!requireAuth("Liking")) return;
    const meId = Number(currentUser!.id);

    try {
      const res = await apiFetch("/api/group-post-likes", {
        method: "POST",
        body: JSON.stringify({ user_id: meId, post_id: Number(postId) })
      });

      // backend returns { success, liked, likes_count }
      return {
        liked: !!(res as any)?.liked,
        likes_count: Number((res as any)?.likes_count || 0),
      };
    } catch (error) {
      console.error('Failed to toggle group post like:', error);
      return { liked: false, likes_count: 0 };
    }
  }, [currentUser, requireAuth]);

  /** ---------- ✅ 4) Implement Group Comments fetch + create ---------- */
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

  /** ---------- ✅ 5) Join/Leave group using new endpoints ---------- */
  const joinGroup = useCallback(async (groupId: number) => {
    if (!requireAuth("Joining groups")) return;
    const meId = Number(currentUser!.id);

    try {
      return await apiFetch("/api/group-members", {
        method: "POST",
        body: JSON.stringify({ group_id: Number(groupId), user_id: meId, role: "member" }),
      });
    } catch (error) {
      console.error('Failed to join group:', error);
      throw error;
    }
  }, [currentUser, requireAuth]);

  const leaveGroup = useCallback(async (groupId: number) => {
    if (!requireAuth("Leaving groups")) return;
    const meId = Number(currentUser!.id);

    try {
      return await apiFetch(`/api/group-members?group_id=${Number(groupId)}&user_id=${meId}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error('Failed to leave group:', error);
      throw error;
    }
  }, [currentUser, requireAuth]);

  /** ---------- ✅ 6) Create Group Post with media upload ---------- */
  const createGroupPost = useCallback(async (groupId: number, text: string, file?: File | null) => {
    if (!requireAuth("Posting")) return;
    const meId = Number(currentUser!.id);

    let media_url: string | null = null;
    if (file) {
      const up = await uploadToCloudflareR2(file, "group-posts");
      media_url = up.url;
    }

    try {
      return await apiFetch("/api/group-posts", {
        method: "POST",
        body: JSON.stringify({
          group_id: Number(groupId),
          user_id: meId,
          content: String(text || "").trim() || null,
          media_url,
        }),
      });
    } catch (error) {
      console.error('Failed to create group post:', error);
      throw error;
    }
  }, [currentUser, requireAuth]);

  /** ---------- ✅ 7) Create Group ---------- */
  const createGroup = useCallback(async (groupData: Partial<Group>) => {
    if (!requireAuth("Creating groups")) return;
    const meId = Number(currentUser!.id);

    try {
      const res = await apiFetch("/api/groups", {
        method: "POST",
        body: JSON.stringify({
          ...groupData,
          admin_id: meId,
          description: String(groupData.description || "").trim(), // ✅ Ensure string, never null
          created_at: new Date().toISOString(),
        }),
      });

      // Refresh groups list
      fetchOtherData().catch(() => {});
      return res;
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    }
  }, [currentUser, requireAuth, fetchOtherData]);

  /** ---------- ✅ 8) Delete Group ---------- */
  const deleteGroup = useCallback(async (groupId: number) => {
    if (!requireAdmin('Deleting groups')) return;

    try {
      await apiFetch(`/api/groups?id=${Number(groupId)}`, {
        method: "DELETE",
      });

      // Refresh groups list
      fetchOtherData().catch(() => {});
      return true;
    } catch (error) {
      console.error('Failed to delete group:', error);
      throw error;
    }
  }, [requireAdmin, fetchOtherData]);

  /** ---------- ✅ 9) Update Group Settings ---------- */
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

      // Refresh groups list
      fetchOtherData().catch(() => {});
      return res;
    } catch (error) {
      console.error('Failed to update group settings:', error);
      throw error;
    }
  }, [requireAuth, fetchOtherData]);

  /** ---------- ✅ 10) Fetch Group Details ---------- */
  const fetchGroupDetails = useCallback(async (groupId: number) => {
    try {
      const res = await apiFetch(`/api/groups?id=${Number(groupId)}`);
      return {
        group: normalizeGroup((res as any)?.group),
        members: safeArray((res as any)?.members),
      };
    } catch (error) {
      console.error('Failed to fetch group details:', error);
      return { group: null, members: [] };
    }
  }, []);

  /** ---------- ✅ 11) Invite to Group (Safe Implementation) ---------- */
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
      // Return success anyway for UI to continue
      return { success: true, message: "Invites sent" };
    }
  }, [currentUser, requireAuth]);

  /** ---------- ✅ 12) Delete Group Post ---------- */
  const deleteGroupPost = useCallback(async (groupId: number, postId: number) => {
    if (!requireAuth("Deleting group posts")) return;

    try {
      await apiFetch(`/api/group-posts?post_id=${Number(postId)}`, {
        method: "DELETE",
      });
      return true;
    } catch (error) {
      console.error('Failed to delete group post:', error);
      throw error;
    }
  }, [requireAuth]);

  /** ---------- ✅ 13) Remove Group Member ---------- */
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

  /** ---------- ✅ 14) Update Group Image ---------- */
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

  /** ✅ UPDATED: One fetch pipeline with stable dependencies ---------- */
  const fetchData = useCallback(
    async (viewer: User | null) => {
      await Promise.all([
        fetchUsersList(), 
        fetchPostsForHome(viewer), 
        fetchOtherData(), 
        fetchReels(),
        fetchSongs(), // ✅ ADDED: Fetch UNERA Music songs
        fetchStories(), // ✅ ADDED: Fetch stories
      ]);
    },
    [fetchUsersList, fetchPostsForHome, fetchOtherData, fetchReels, fetchSongs, fetchStories]
  );

  /** ✅ UPDATED: Restore session + initial load WITHOUT dependency chain ---------- */
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
        // ignore
      }

      if (!mounted) return;
      
      // Fetch all data in parallel
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ FIXED: Empty dependency array - runs once on mount

  /** ---------- Return detection (leave -> come back => new seed + refresh) ---------- */
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

  /** ---------- Smart Polling ---------- */
  useEffect(() => {
    if (activeCommentsPostId != null) return;
    if (document.visibilityState !== 'visible') return;

    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState !== 'visible') return;
      if (activeCommentsPostId != null) return;
      await fetchPostsForHome(currentUser).catch(() => {});
      await fetchReels().catch(() => {});
    };

    const t = setInterval(tick, 30000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [currentUser, fetchPostsForHome, fetchReels, activeCommentsPostId]);

  /** ---------- ADMIN API ACTIONS (ADDED) ---------- */
  const verifyUser = useCallback(
    async (userId: number) => {
      if (!requireAdmin('Verify user')) return;

      // optimistic toggle
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
        await fetchUsersList(); // rollback by refetch
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

      // optimistic remove
      setUsers((prev) => prev.filter((u: any) => Number(u.id) !== Number(userId)));

      try {
        await apiFetch('/api/admin/users/delete', {
          method: 'DELETE',
          body: JSON.stringify({ user_id: Number(userId) }),
        });

        await fetchUsersList();
        fetchPostsForHome(currentUser).catch(() => {});
      } catch (e: any) {
        await fetchUsersList(); // rollback
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

  /** ---------- ✅ ADDED: Hashtag filtering logic ---------- */
  const handleHashtagClick = useCallback((tag: string) => {
    const cleanedTag = tag.startsWith('#') ? tag.toLowerCase() : `#${tag.toLowerCase()}`;
    setActiveHashtag(cleanedTag);
    setView('home');
    window.scrollTo(0, 0);
  }, []);

  const clearHashtag = useCallback(() => {
    setActiveHashtag(null);
  }, []);

  // ✅ Filter posts based on active hashtag
  const filteredPosts = useMemo(() => {
    if (!activeHashtag) return posts;
    
    const tagWithoutHash = activeHashtag.replace('#', '').toLowerCase();
    return posts.filter((p: any) => {
      const content = String(p.content || '').toLowerCase();
      return content.includes(`#${tagWithoutHash}`) || content.includes(` ${tagWithoutHash} `);
    });
  }, [posts, activeHashtag]);

  /** ---------- Derived ---------- */
  const rankedPosts = useMemo(() => {
    const feedToRank = stableFeedRef.current.length > 0 ? stableFeedRef.current : 
                     activeHashtag ? filteredPosts : posts;
    return Array.isArray(feedToRank) ? feedToRank : [];
  }, [posts, filteredPosts, activeHashtag]);

  /** ✅ Updated activePost resolver to include profilePosts ---------- */
  const activePost = useMemo(() => {
    if (activeCommentsPostId == null) return null;

    if (commentPostSnapshot && Number((commentPostSnapshot as any)?.id) === Number(activeCommentsPostId)) {
      return commentPostSnapshot;
    }

    const source = view === 'profile' ? profilePosts : posts;
    return source.find((p: any) => Number(p.id) === Number(activeCommentsPostId)) || null;
  }, [posts, profilePosts, view, activeCommentsPostId, commentPostSnapshot]);

  const profileUser = useMemo(() => {
    if (selectedUserId) {
      return users.find((u) => Number(u.id) === Number(selectedUserId)) || null;
    }
    return currentUser || null;
  }, [selectedUserId, users, currentUser]);

  /** ---------- Handle user registration ---------- */
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

      // Add user to users list
      setUsers((prev) => {
        const arr = safeArray(prev);
        const exists = arr.some((x) => Number(x.id) === Number(normalized.id));
        if (exists) return arr.map((x) => (Number(x.id) === Number(normalized.id) ? normalized : x));
        return [normalized, ...arr];
      });

      // New session seed
      try {
        sessionStorage.removeItem(FEED_SESSION_KEY);
      } catch {}

      setView('home');
      await fetchPostsForHome(normalized);
      await fetchReels();

    } catch (error: any) {
      setLoginError(error?.message || 'Registration failed');
    }
  }, [fetchPostsForHome, fetchReels]);

  /** ---------- Login (PROFESSIONALLY FIXED) ---------- */
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

      // ✅ FIXED: Use finalUser consistently, don't setCurrentUser twice
      let finalUser = normalized;
      try {
        const fresh = await apiFetch(`/api/users?id=${normalized.id}`);
        finalUser = normalizeUser({ ...normalized, ...fresh });
      } catch {}

      setCurrentUser(finalUser);
      localStorage.setItem(LS_USER_KEY, JSON.stringify(finalUser));

      // new session seed
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
      setView('home');

      await fetchPostsForHome(finalUser);
      await fetchReels();
    } catch (error: any) {
      setLoginError(error?.message || 'Login failed');
    }
  };

  /** ✅ ADDED: Handle comment likes ---------- */
  const handleLikeComment = async (commentId: number) => {
    if (!currentUser) return;

    await fetch(`/api/comments/${commentId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id }),
    });
  };

  /** ✅ FIXED: Follow User with EXACT same API structure as original working code ---------- */
  const followUser = useCallback(
    async (targetUserId: number) => {
      if (!requireAuth('Following')) return;
      if (!currentUser) return;

      const meId = Number(currentUser.id);
      const targetId = Number(targetUserId);

      // ✅ backend blocks self-follow
      if (!targetId || targetId === meId) return;

      // ✅ TRUE follow state comes from my "following"
      const myFollowing = new Set<number>(safeArray<number>((currentUser as any).following));
      const isFollowingNow = myFollowing.has(targetId);

      // Set loading state to prevent double clicks
      setFollowLoading(prev => ({ ...prev, [targetId]: true }));

      // Save original state for potential rollback
      const originalUsers = [...users];
      const originalCurrentUser = { ...currentUser };

      // ---------- optimistic update ----------
      setUsers((prev) => {
        const arr = safeArray(prev).map(normalizeUser);

        return arr.map((u) => {
          const uid = Number(u.id);

          // update ME.following
          if (uid === meId) {
            const following = new Set<number>(safeArray<number>((u as any).following));
            if (isFollowingNow) following.delete(targetId);
            else following.add(targetId);
            return normalizeUser({ ...u, following: Array.from(following) });
          }

          // update TARGET.followers
          if (uid === targetId) {
            const followers = new Set<number>(safeArray<number>((u as any).followers));
            if (isFollowingNow) followers.delete(meId);
            else followers.add(meId);
            return normalizeUser({ ...u, followers: Array.from(followers) });
          }

          return u;
        });
      });

      // keep currentUser in sync + persist
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const following = new Set<number>(safeArray<number>((prev as any).following));
        if (isFollowingNow) following.delete(targetId);
        else following.add(targetId);
        const next = normalizeUser({ ...prev, following: Array.from(following) });
        localStorage.setItem(LS_USER_KEY, JSON.stringify(next));
        return next;
      });

      // ---------- API ----------
      try {
        if (isFollowingNow) {
          // ✅ EXACTLY as in original code: Unfollow
          await apiFetch(`/api/user-follows?follower_id=${meId}&following_id=${targetId}`, {
            method: 'DELETE',
          });
        } else {
          // ✅ EXACTLY as in original code: Follow
          await apiFetch('/api/user-follows', {
            method: 'POST',
            body: JSON.stringify({ follower_id: meId, following_id: targetId }),
          });
        }

        // ✅ Refresh follow data from server for consistency
        fetchUserFollowDataForUI(targetId).catch(() => {});
        fetchUserFollowDataForUI(meId).catch(() => {});

        scheduleSilentRefresh();
      } catch (e: any) {
        console.error('Follow toggle failed:', e);

        // ✅ rollback using original state
        setUsers(originalUsers);
        setCurrentUser(originalCurrentUser);
        localStorage.setItem(LS_USER_KEY, JSON.stringify(originalCurrentUser));
        
        // ✅ rollback using server truth
        fetchUserFollowDataForUI(targetId).catch(() => {});
        fetchUserFollowDataForUI(meId).catch(() => {});
        
        // Show error message
        setLoginError(`Failed to ${isFollowingNow ? 'unfollow' : 'follow'}: ${e.message || 'Unknown error'}`);
      } finally {
        // Clear loading state
        setFollowLoading(prev => ({ ...prev, [targetId]: false }));
      }
    },
    [requireAuth, currentUser, users, scheduleSilentRefresh, fetchUserFollowDataForUI]
  );

  /** ✅ SIMPLIFIED & RELIABLE: Check if current user is following a specific user ---------- */
  const checkIsFollowing = useCallback((targetUserId: number): boolean => {
    if (!currentUser || !targetUserId) return false;
    
    // Direct check of current user's following array
    const myFollowing = safeArray<number>((currentUser as any).following);
    return myFollowing.includes(Number(targetUserId));
  }, [currentUser]);

  const handleLogout = () => {
    localStorage.removeItem(LS_USER_KEY);
    localStorage.removeItem(STORY_SEEN_KEY);

    try {
      sessionStorage.removeItem(FEED_SESSION_KEY);
    } catch {}

    setCurrentUser(null);
    setSelectedUserId(null);
    setProfilePosts([]);
    setReels([]);
    setStories([]); // ✅ Clear stories on logout
    setActiveStoryId(null); // ✅ UPDATED: Clear active story ID
    setSeenStoryIds(new Set()); // ✅ Clear seen story IDs
    setStoryMuted(true); // ✅ Reset story muted state
    setActiveHashtag(null); // ✅ Clear hashtag filter on logout
    setLikedTracks([]); // ✅ Clear liked tracks on logout
    setMyTotalPlays(0); // ✅ Clear total plays on logout
    setPlayHistory([]); // ✅ Clear play history on logout
    setTrackPlays({}); // ✅ Clear track plays on logout
    setCurrentAudioTrack(null); // ✅ Clear current audio track
    setIsAudioPlaying(false); // ✅ Stop audio playback
    setSelectedReelSound(null); // ✅ Clear selected reel sound
    setSongs([]); // ✅ Clear songs on logout
    setView('home');
    fetchPostsForHome(null).catch(() => {});
    fetchReels().catch(() => {});
  };

  /** ---------- Navigation ---------- */
  const handleNavigate = (target: View) => {
    if (['settings', 'memories'].includes(target) && !currentUser) {
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

    setView(target);

    if (['home', 'reels', 'marketplace', 'groups'].includes(target)) {
      setActiveTab(target as any);
    }
    window.scrollTo(0, 0);
  };

  /** ✅ UPDATED: API actions - createPost with multi-file support ---------- */
  const createPost = useCallback(
    async (
      text: string,
      files: File[] | File | null, // ✅ Changed from File | null to File[] | File | null
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

      // ✅ Convert input to array
      const list: File[] = Array.isArray(files) ? files : (files ? [files] : []);

      let media_urls: string[] = [];
      let media_types: string[] = [];

      if (list.length) {
        try {
          const ups = await Promise.all(list.map((f) => uploadToCloudflareR2(f)));
          media_urls = ups.map((u) => u.url).filter(Boolean);
          media_types = ups.map((u) => u.type).filter(Boolean);
        } catch (error: any) {
          setLoginError(`Failed to upload files: ${error?.message || 'Upload error'}`);
          return;
        }
      }

      // backward compatibility (keep old fields too)
      const media_url = media_urls[0] ?? null;
      const media_type = media_types[0] ?? null;

      const payload: any = {
        user_id: currentUser!.id,
        content: trimmed,

        // ✅ keep single (backward compatible)
        media_url,
        media_type,

        // ✅ add multi
        media_urls: media_urls.length ? media_urls : undefined,
        media_types: media_types.length ? media_types : undefined,

        visibility: meta?.visibility ?? 'public',
        location: meta?.location,
        feeling: meta?.feeling,
        tagged_users: meta?.taggedUsers,
        background: meta?.background,
        link_preview: meta?.linkPreview,
        type: (() => {
          const t = media_type || media_types[0] || null;
          if (!t) return meta?.type || 'text';
          if (t.startsWith('image/')) return 'image';
          if (t.startsWith('video/')) return 'video';
          if (t.startsWith('audio/')) return 'audio';
          return meta?.type || 'text';
        })(),
      };

      const data = await apiFetch('/api/posts', { method: 'POST', body: JSON.stringify(payload) });

      const newPostRaw =
        data?.post ?? { ...payload, post_id: data?.post_id ?? data?.id ?? Date.now(), created_at: new Date().toISOString() };

      // ✅ ensure arrays exist immediately
      (newPostRaw as any).media_urls = (newPostRaw as any).media_urls || (media_urls.length ? media_urls : (media_url ? [media_url] : []));
      (newPostRaw as any).media_types = (newPostRaw as any).media_types || (media_types.length ? media_types : (media_type ? [media_type] : []));

      const normalized = normalizePost(newPostRaw);

      setPosts((prev) => {
        const next = [normalized, ...safeArray(prev)];
        lastGoodPostsRef.current = next;
        stableFeedRef.current = next;
        return next;
      });

      /** ✅ Keep profile posts updated when you create a post ---------- */
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

  /** ✅ FIXED: onReactPost with immediate my_reaction updates and commentPostSnapshot sync ---------- */
  const onReactPost = useCallback(
    async (postId: number, type: ReactionType) => {
      if (!requireAuth('Reacting')) return;
      const meId = Number(currentUser!.id);

      // ✅ Optimistic update (homepage)
      setPosts(prev => {
        const next = safeArray(prev).map(p => applyOptimisticReaction(p, postId, type, meId));
        lastGoodPostsRef.current = next;
        stableFeedRef.current = next;
        return next;
      });

      // ✅ Optimistic update (profile list in App state)
      setProfilePosts(prev => safeArray(prev).map(p => applyOptimisticReaction(p, postId, type, meId)));

      // ✅ Update commentPostSnapshot if it's the same post
      setCommentPostSnapshot(prev =>
        prev && Number(prev.id) === Number(postId)
          ? applyOptimisticReaction(prev, postId, type, meId)
          : prev
      );

      try {
        const data = await apiFetch(`/api/posts/${postId}/react`, {
          method: 'POST',
          body: JSON.stringify({ type, user_id: meId }),
        });

        if (data?.success && ('reactions_count' in data || 'my_reaction' in data)) {
          const serverMy = data.my_reaction ?? null;
          const serverCount = safeNumber(data.reactions_count, 0);

          const applyServerTruth = (p: any) => {
            if (Number(p?.id) !== Number(postId)) return p;

            const prevArr = safeArray<any>(p?.reactions);
            const withoutMe = prevArr.filter((r: any) => Number(r?.user_id) !== Number(meId));
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
          // ✅ Update commentPostSnapshot with server truth
          setCommentPostSnapshot(prev => (prev ? applyServerTruth(prev) : prev));
        }
      } catch {
        scheduleSilentRefresh();
      }
    },
    [currentUser, requireAuth, scheduleSilentRefresh]
  );

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

        /** ✅ Update profile posts when sharing ---------- */
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

  /** ✅ Updated onOpenComments to search in correct list ---------- */
  const onOpenComments = (postId: number) => {
    if (!requireAuth('Commenting')) return;

    const pid = Number(postId);
    setActiveCommentsPostId(pid);

    const source = view === 'profile' ? profilePosts : posts;
    const found = source.find((p: any) => Number(p.id) === pid) || null;
    setCommentPostSnapshot(found);
  };

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

      /** ✅ Keep profile posts updated when you delete ---------- */
      setProfilePosts((prev) => safeArray(prev).filter((x: any) => Number(x.id) !== Number(postId)));

      try {
        await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
      } catch {
        setPosts(prev);
        lastGoodPostsRef.current = prev;
        stableFeedRef.current = prev;
        
        /** ✅ Rollback profile posts on error ---------- */
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

      /** ✅ Keep profile posts updated when you edit ---------- */
      setProfilePosts((prev) =>
        safeArray(prev).map((x: any) => (Number(x.id) === Number(postId) ? normalizePost({ ...x, content: trimmed }) : x))
      );

      try {
        await apiFetch(`/api/posts/${postId}`, { method: 'PATCH', body: JSON.stringify({ content: trimmed }) });
      } catch {
        setPosts(prev);
        lastGoodPostsRef.current = prev;
        stableFeedRef.current = prev;
        
        /** ✅ Rollback profile posts on error ---------- */
        setProfilePosts(prevProfilePosts);
        if (view === 'profile' && selectedUserId) fetchProfilePosts(Number(selectedUserId)).catch(() => {});
      }
    },
    [requireAuth, posts, profilePosts, view, selectedUserId, fetchProfilePosts]
  );

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

  const updateProfileImage = useCallback(
    async (file: File) => {
      if (!requireAuth('Updating profile')) return;
      if (!currentUser) return;

      // ✅ ADDED: Validate file is an image
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

  const updateCoverImage = useCallback(
    async (file: File) => {
      if (!requireAuth('Updating profile')) return;
      if (!currentUser) return;

      // ✅ ADDED: Validate file is an image
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

  /** ---------- Helper function to get post author ---------- */
  const getPostAuthor = useCallback(
    (post: PostType) => {
      const author = users.find((u) => Number(u.id) === Number((post as any).user_id));
      if (author) return author;
      return createFallbackUser();
    },
    [users]
  );

  /** ---------- Handle create story from profile ---------- */
  const handleCreateStoryFromProfile = useCallback(() => {
    if (!requireAuth('Creating stories')) return;
    setShowCreateStoryModal(true);
  }, [requireAuth]);

  /** ---------- ✅ ADDED: Get all known posts for MemoriesPage ---------- */
  const allKnownPosts = useMemo(() => {
    const map = new Map<number, PostType>();
    [...safeArray(posts), ...safeArray(profilePosts)].forEach(p => {
      if (p?.id) {
        map.set(Number(p.id), p);
      }
    });
    return Array.from(map.values());
  }, [posts, profilePosts]);

  /** ✅ ADDED: Handle previous story navigation ---------- */
  const goPrevStory = useCallback(() => {
    setActiveStoryId(prevId => {
      if (!prevId) return null;
      const list = orderedStories;
      const idx = list.findIndex(s => Number(s.id) === Number(prevId));
      if (idx <= 0) return null;
      
      const prev = list[idx - 1];
      if (prev) {
        markStorySeen(Number(prev.id));
        if (currentUser) {
          viewStory(prev.id);
        }
        return Number(prev.id);
      }
      return null;
    });
  }, [orderedStories, markStorySeen, currentUser, viewStory]);

  /** ✅ ADDED: Handle story next navigation with all required logic ---------- */
  const handleStoryNext = useCallback(() => {
    if (!activeStoryId) return;
    
    const list = orderedStories;
    const idx = list.findIndex(s => Number(s.id) === Number(activeStoryId));
    
    // If at last story, close viewer
    if (idx >= list.length - 1) {
      closeStoryViewer();
      return;
    }
    
    // Move to next story
    const next = list[idx + 1];
    if (next) {
      setActiveStoryId(next.id);
      markStorySeen(next.id);
      if (currentUser) {
        viewStory(next.id);
      }
      preloadStoryMedia(next);
    }
  }, [activeStoryId, orderedStories, closeStoryViewer, markStorySeen, currentUser, viewStory, preloadStoryMedia]);

  /** ✅ ADDED: Handle story previous navigation ---------- */
  const handleStoryPrev = useCallback(() => {
    if (!activeStoryId) return;
    
    const list = orderedStories;
    const idx = list.findIndex(s => Number(s.id) === Number(activeStoryId));
    
    // If at first story, close viewer
    if (idx <= 0) {
      closeStoryViewer();
      return;
    }
    
    // Move to previous story
    const prev = list[idx - 1];
    if (prev) {
      setActiveStoryId(prev.id);
      markStorySeen(prev.id);
      if (currentUser) {
        viewStory(prev.id);
      }
      preloadStoryMedia(prev);
    }
  }, [activeStoryId, orderedStories, closeStoryViewer, markStorySeen, currentUser, viewStory, preloadStoryMedia]);

  /** ---------- Render ---------- */
  const isLoading = false;
  if (isLoading) return <ProfessionalLoader />;

  return (
    <div className="bg-[#18191A] min-h-screen flex flex-col font-sans">
      <Header
        onHomeClick={() => handleNavigate('home')}
        onProfileClick={(id: number) => openProfile(id)}
        onReelsClick={() => handleNavigate('reels')}
        onMarketplaceClick={() => handleNavigate('marketplace')}
        onGroupsClick={() => handleNavigate('groups')}
        currentUser={currentUser}
        notifications={notifications}
        users={users}
        onLogout={handleLogout}
        onLoginClick={() => setView('login')}
        onMarkNotificationsRead={() => {}}
        activeTab={activeTab}
        onNavigate={(v: any) => handleNavigate(v)}
      />

      <div className="flex justify-center w-full max-w-[1920px] mx-auto relative flex-1">
        {currentUser && (
          <div className="sticky top-14 h-[calc(100vh-56px)] z-20 hidden lg:block">
            <Sidebar
              currentUser={currentUser}
              onProfileClick={(id) => openProfile(id)}
              onReelsClick={() => handleNavigate('reels')}
              onMarketplaceClick={() => handleNavigate('marketplace')}
              onGroupsClick={() => handleNavigate('groups')}
            />
          </div>
        )}

        <div className="w-full lg:w-[740px] xl:w-[700px] min-h-screen">
          {view === 'home' && (
            <div className="w-full pt-4 md:px-8 pb-10">
              {/* ✅ ADDED: Hashtag filter chip */}
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

              {/* ✅ UPDATED: StoryReel with Facebook-like features */}
              <StoryReel
                stories={orderedStories} // ✅ Use ordered stories (unseen first)
                onProfileClick={(id) => openProfile(id)}
                onCreateStory={() => {
                  if (!requireAuth('Creating stories')) return;
                  setShowCreateStoryModal(true);
                }}
                onViewStory={openStoryViewer} // ✅ UPDATED: Use new helper
                currentUser={currentUser}
                onRequestLogin={() => setView('login')}
                // ✅ ADDED: Facebook-like story features
                onFollow={followUser}
                checkIsFollowing={checkIsFollowing}
                followLoading={followLoading}
              />

              {currentUser && (
                <CreatePost
                  currentUser={currentUser}
                  onProfileClick={(id) => openProfile(id)}
                  onClick={() => {
                    if (!requireAuth('Creating posts')) return;
                    setShowCreatePostModal(true);
                  }}
                />
              )}

              {currentUser && products.length > 0 && (
                <SuggestedProductsWidget
                  products={products}
                  currentUser={currentUser}
                  onViewProduct={setActiveProduct}
                  onSeeAll={() => handleNavigate('marketplace')}
                />
              )}

              {rankedPosts.length > 0 ? (
                rankedPosts.map((post) => {
                  const postAuthorId = Number((post as any).user_id);
                  const isFollowing = checkIsFollowing(postAuthorId);
                  
                  return (
                    <Post
                      key={(post as any).id || `${(post as any).user_id}-${(post as any).created_at}`}
                      post={post}
                      author={getPostAuthor(post)}
                      currentUser={currentUser}
                      users={users}
                      onProfileClick={(id) => openProfile(id)}
                      onReact={(postId: number, type: ReactionType) => onReactPost(postId, type)}
                      onShare={() => handleOpenShareSheet(post)}
                      onViewImage={setFullScreenImage}
                      onOpenComments={(postId: number) => onOpenComments(postId)}
                      onVideoClick={(p: any) => {
                        setActiveReelId(p.id);
                        setView('reels');
                      }}
                      // ✅ FIXED: Use onPlayTrack instead of setCurrentAudioTrack
                      onPlayAudioTrack={onPlayTrack}
                      groups={groups}
                      brands={brands}
                      chats={chats}
                      // ✅ ADDED: Pass onHashtagClick handler for hashtag filtering
                      onHashtagClick={handleHashtagClick}
                      // ✅ CORRECT: Pass follow status and handler
                      isFollowing={isFollowing}
                      onFollow={() => followUser(postAuthorId)}
                      followLoading={followLoading[postAuthorId] || false}
                    />
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
            </div>
          )}

          {view === 'reels' && (
            <ReelsFeed
              reels={reels}
              users={users}
              currentUser={currentUser}
              songs={songs} // ✅ ADDED: Pass UNERA Music songs
              selectedSound={selectedReelSound} // ✅ ADDED: Pass selected sound
              onPickSound={(sound: ReelSound | null) => setSelectedReelSound(sound)} // ✅ ADDED: Pass sound picker handler
              onProfileClick={(id) => openProfile(id)}
              onCreateReelClick={() => {
                if (!requireAuth('Creating reels')) return;
                setSelectedReelSound(null); // optional
                setShowCreateReelModal(true);
              }}
              onReact={reactToReel}
              onComment={commentOnReel}
              onShare={shareReel}
              onFollow={followUser}
              onUseSound={useSoundFromReel}
              checkIsFollowing={checkIsFollowing}
              followLoading={followLoading}
            />
          )}

          {view === 'marketplace' && (
            <MarketplacePage
              currentUser={currentUser}
              products={products}
              onNavigateHome={() => handleNavigate('home')}
              // ✅ UPDATED: Use createProduct function instead of requireAuth
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
                // ✅ UPDATED: Real group functions instead of requireAuth placeholders
                onCreateGroup={createGroup}
                onJoinGroup={joinGroup}
                onLeaveGroup={leaveGroup}
                onDeleteGroup={deleteGroup}
                onUpdateGroupImage={updateGroupImage}
                onPostToGroup={createGroupPost}
                onCreateGroupEvent={() => requireAuth('Creating events')}
                onInviteToGroup={inviteToGroup}
                onProfileClick={(id) => openProfile(id)}
                onLikePost={toggleGroupPostLike}
                onOpenComments={() => requireAuth('Commenting')}
                onSharePost={(post: any) => handleOpenShareSheet(post)}
                onDeleteGroupPost={deleteGroupPost}
                onRemoveMember={removeGroupMember}
                onUpdateGroupSettings={updateGroupSettings}
                // ✅ FIXED: Use onPlayTrack instead of setCurrentAudioTrack
                onPlayAudioTrack={onPlayTrack}
                onFollow={followUser}
                checkIsFollowing={checkIsFollowing}
                // ✅ ADDED: Pass the missing group props that GroupsPage uses
                fetchGroupPosts={fetchGroupPosts}
                fetchGroupDetails={fetchGroupDetails}
                fetchComments={fetchGroupPostComments}
                onComment={createGroupPostComment}
                initialGroupId={null}
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
                const pid = Number(id);
                setActiveCommentsPostId(pid);
                const source = view === 'profile' ? profilePosts : posts;
                const found = source.find((p: any) => Number(p.id) === pid) || null;
                setCommentPostSnapshot(found);
              }}
              onDeleteBrand={() => requireAuth('Deleting brands')}
              // ✅ FIXED: Use onPlayTrack instead of setCurrentAudioTrack
              onPlayAudioTrack={onPlayTrack}
              checkIsFollowing={checkIsFollowing}
              followLoading={followLoading}
            />
          )}

          {view === 'music' && (
            <MusicSystem
              currentUser={currentUser}
              // ✅ FIXED: Use onPlayTrack instead of setCurrentAudioTrack
              onPlayTrack={onPlayTrack}
              onProfileClick={(id) => openProfile(id)}
              likedTracks={likedTracks}
              onToggleLike={handleMusicSystemLikeSync}
              playHistory={playHistory}
              onFollow={followUser}
              checkIsFollowing={checkIsFollowing}
              // ✅ ADDED: Pass additional props for MusicSystem
              users={users}
              currentTrack={currentAudioTrack}
              isPlaying={isAudioPlaying}
              // ✅ FIXED: Pass myTotalPlays from App state (now persistent)
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
            <EventsPage
              events={events}
              currentUser={currentUser as any}
              onJoinEvent={joinEvent}
              onInterestedEvent={markEventInterested}
              onCreateEventClick={() => {
                if (!requireAuth('Creating events')) return;
                setShowCreateEventModal(true);
              }}
              onProfileClick={(id) => openProfile(id)}
              onFollow={followUser}
              checkIsFollowing={checkIsFollowing}
            />
          )}

          {view === 'birthdays' && (
            <BirthdaysPage
              currentUser={currentUser as any}
              users={users}
              onMessage={(id) => {
                if (!requireAuth('Messaging')) return;
                setActiveChatUser(users.find((u) => u.id === id) || null);
              }}
              onProfileClick={(id) => openProfile(id)}
              onFollow={followUser}
              checkIsFollowing={checkIsFollowing}
            />
          )}

          {view === 'memories' && currentUser && (
            <MemoriesPage
              currentUser={currentUser}
              // ✅ FIXED: Use allKnownPosts instead of just posts for better memory coverage
              posts={allKnownPosts}
              users={users}
              onProfileClick={(id: number) => openProfile(id)}
              // ✅ FIXED: Pass actual reaction handler instead of placeholder
              onReact={(postId: number, type: ReactionType) => onReactPost(postId, type)}
              onShare={(post: any) => handleOpenShareSheet(post)}
              onViewImage={setFullScreenImage}
              onOpenComments={(postId: number) => onOpenComments(postId)}
              // ✅ FIXED: Pass proper video click handler to navigate to reels
              onVideoClick={(p: any) => {
                setActiveReelId(p.id);
                setView('reels');
              }}
              // ✅ FIXED: Use onPlayTrack instead of setCurrentAudioTrack
              onPlayAudioTrack={onPlayTrack}
              // ✅ ADDED: Pass onHashtagClick handler for hashtag filtering
              onHashtagClick={handleHashtagClick}
              // ✅ ADDED: Pass follow system props
              onFollow={followUser}
              checkIsFollowing={checkIsFollowing}
              followLoading={followLoading}
              // ✅ ADDED: Pass groups, brands, chats if Post component needs them
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
                setActiveChatUser(users.find((u) => u.id === id) || null);
              }}
              onCreatePost={createPost as any}
              onUpdateProfileImage={updateProfileImage as any}
              onUpdateCoverImage={updateCoverImage as any}
              onUpdateUserDetails={updateUserDetails as any}
              onDeletePost={(postId: number) => deletePost(postId)}
              onEditPost={(postId: number, content: string) => editPost(postId, content)}
              getCommentAuthor={(id) => users.find((u) => u.id === id)}
              onViewImage={setFullScreenImage}
              onOpenComments={(postId) => onOpenComments(postId)}
              onVideoClick={(p) => {
                setActiveReelId((p as any).id);
                setView('reels');
              }}
              // ✅ FIXED: Use onPlayTrack instead of setCurrentAudioTrack
              onPlayAudioTrack={onPlayTrack}
              onCreateStoryClick={handleCreateStoryFromProfile}
              // ✅ PROFESSIONALLY FIXED: Pass admin handlers with correct prop types
              onVerifyUser={(id) => verifyUser(id)}
              onRestrictUser={(id, duration) => suspendUser(id, duration)}
              onDeleteUser={(id) => deleteUserAccount(id)}
              onMakeModerator={(id, make) => setModeratorRole(id, make ? 'moderator' : 'user')}
              // ✅ ADDED: Pass follow status to UserProfile
              isFollowing={checkIsFollowing(Number(profileUser.id))}
              followLoading={followLoading[Number(profileUser.id)] || false}
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

      {/* Modals / Overlays */}
      {activeProduct && (
        <ProductDetailModal
          product={activeProduct}
          currentUser={currentUser}
          onClose={() => setActiveProduct(null)}
          onMessage={(id) => {
            if (!requireAuth('Messaging')) return;
            setActiveChatUser(users.find((u) => u.id === id) || null);
            setView('home');
          }}
        />
      )}

      {showCreateEventModal && currentUser && (
        <CreateEventModal
          currentUser={currentUser}
          onClose={() => setShowCreateEventModal(false)}
          onCreate={createEvent}
        />
      )}

      {showCreatePostModal && currentUser && (
        <CreatePostModal
          currentUser={currentUser}
          users={users}
          onClose={() => setShowCreatePostModal(false)}
          // ✅ UPDATED: Accept File[] from Feed.tsx when it's updated
          onCreatePost={(text: string, files: File[] | File | null, meta?: any) => createPost(text, files as any, meta)}
        />
      )}

      {activePost && currentUser && (
        <CommentsSheet
          post={activePost}
          currentUser={currentUser}
          users={users}
          onClose={() => {
            setActiveCommentsPostId(null);
            setCommentPostSnapshot(null);
          }}
          onComment={() => {}}
          // ✅ ADDED: Pass onLikeComment handler
          onLikeComment={handleLikeComment}
          getCommentAuthor={(id) => users.find((u) => u.id === id)}
          onProfileClick={(id) => openProfile(id)}
          // ✅ ADDED: Pass onHashtagClick handler for comments
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

      {/* ✅ CREATE REEL MODAL WITH FIX 2 IMPLEMENTED */}
      {showCreateReelModal && currentUser && (
        <CreateReelModal
          currentUser={currentUser}
          onClose={() => {
            setShowCreateReelModal(false);
          }}
          onCreate={(reelData: any) => {
            // ✅ When creating a reel, use audio_fetch_url for trimming and audio_url for storage
            return createReel({
              ...reelData,
              // ✅ Use the fetchable URL for trimming (audio_fetch_url)
              audioUrl:
                reelData.audioUrl ||
                (selectedReelSound?.songId && songs.find(s => s.id === selectedReelSound.songId)?.audio_fetch_url) ||
                selectedReelSound?.audioUrl ||
                '',
              // ✅ Store the raw URL (originalUrl) for re-trimming
              originalSoundId: selectedReelSound?.songId,
              songName: reelData.songName || selectedReelSound?.songName || 'Original Sound',
              audioStart: reelData.audioStart ?? selectedReelSound?.audioStart ?? 0,
              audioEnd: reelData.audioEnd ?? selectedReelSound?.audioEnd ?? 0,
            });
          }}
          songs={songs}
          selectedSound={selectedReelSound}
          onPickSound={setSelectedReelSound}
          toBlobUrl={toBlobUrl}
        />
      )}

      {/* ✅ UPDATED: ACTIVE STORY VIEWER MODAL WITH FACEBOOK FEATURES */}
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
        />
      )}

      {/* ✅ CREATE STORY MODAL */}
      {showCreateStoryModal && currentUser && (
        <CreateStoryModal
          currentUser={currentUser}
          songs={songs}
          onClose={() => setShowCreateStoryModal(false)}
          onCreate={createStory}
        />
      )}

      {/* ✅ MOUNT THE GLOBAL AUDIO PLAYER ONCE */}
      {currentAudioTrack && (
        <GlobalAudioPlayer
          currentTrack={currentAudioTrack}
          isPlaying={isAudioPlaying}
          onTogglePlay={onTogglePlay}
          onNext={onNext}
          onPrevious={onPrevious}
          onClose={onClosePlayer}
          onDownload={(id) => {
            // optional download logic
            console.log('Download track:', id);
          }}
          onLike={(id, type) => {
            // Delegate to MusicSystem UI (or implement direct endpoints here)
            const k = `${type}:${String(id)}`;
            const nextLiked = !likedTracks.includes(k);
            handleMusicSystemLikeSync(k, nextLiked);
          }}
          onArtistClick={(uploaderId) => uploaderId && openProfile(uploaderId)}
          isLiked={isPlayerLiked}
          // ✅ ADDED: Pass owner info + total plays
          ownerUser={resolveTrackOwner(currentAudioTrack)}
          totalPlays={currentAudioTrack ? (trackPlays[`${currentAudioTrack.type}:${String(currentAudioTrack.id)}`] || 0) : 0}
          totalPlaysLoading={playsLoading}
          // ✅ ADDED: onStarted callback
          onStarted={onStarted}
        />
      )}

      {fullScreenImage && <ImageViewer imageUrl={fullScreenImage} onClose={() => setFullScreenImage(null)} />}
    </div>
  );
}
