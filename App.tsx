

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Login, Register } from './components/Auth';
import { Header, Sidebar, RightSidebar } from './components/Layout';
import { 
  CreatePost, 
  Post, 
  CommentsSheet, 
  CreatePostModal, 
  SuggestedProductsWidget,
  ShareBottomSheet 
} from './components/Feed';
import { StoryReel, CreateStoryModal } from './components/Story';
import { UserProfile } from './components/UserProfile';
import { MarketplacePage, ProductDetailModal } from './components/Marketplace';
import { ReelsFeed, CreateReelModal } from './components/Reels';
import { ImageViewer, ProfessionalLoader } from './components/Common';
import { EventsPage, BirthdaysPage, MemoriesPage, SettingsPage, SuggestedProfilesPage } from './components/MenuPages';
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
} from './types';
import { INITIAL_USERS } from './constants';
import { rankFeed } from './utils/ranking'; // Import the ranking function

/** ---------- Safety helpers ---------- */
const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeString = (v: any, fallback = '') => (typeof v === 'string' ? v : fallback);

/**
 * Normalize raw D1 rows to UI-safe PostType shape.
 * ✅ accepts id OR post_id (and common variants)
 */
const normalizePost = (p: any): PostType => {
  const mediaType = p?.media_type ?? p?.mediaType ?? null;
  const mediaUrl = p?.media_url ?? p?.mediaUrl ?? null;

  const resolvedId = safeNumber(p?.id ?? p?.post_id ?? p?.postId ?? p?.postID);

  return {
    ...p,
    id: resolvedId,
    user_id: p?.user_id === null || p?.user_id === undefined ? null : safeNumber(p?.user_id),
    content: safeString(p?.content),
    media_url: mediaUrl,
    media_type: mediaType,

    reactions: safeArray(p?.reactions),
    comments: safeArray(p?.comments),

    shares: safeNumber(p?.shares),
    views: safeNumber(p?.views),

    visibility: p?.visibility ?? 'public',
    type: p?.type ?? (() => {
      if (!mediaType) return 'post';
      if (mediaType.startsWith('image/')) return 'image';
      if (mediaType.startsWith('video/')) return 'video';
      if (mediaType.startsWith('audio/')) return 'audio';
      return 'post';
    })(),
    created_at: p?.created_at ?? new Date().toISOString(),
  } as any;
};

/**
 * ✅ Normalize user:
 * - Accepts id OR user_id OR userId
 * - Prevents wrong profile opening
 */
const normalizeUser = (u: any): User => {
  const resolvedId = safeNumber(u?.id ?? u?.user_id ?? u?.userId);

  return {
    ...u,
    id: resolvedId,
    name: safeString(u?.name, safeString(u?.username, 'User')),
    username: safeString(u?.username, safeString(u?.name, 'user')),
    followers: safeArray<number>(u?.followers),
    following: safeArray<number>(u?.following),
    profile_image_url: u?.profile_image_url ?? u?.avatar_url ?? u?.profileImage ?? '',
    cover_image_url: u?.cover_image_url ?? u?.coverImage ?? '',
    is_verified: Boolean(u?.is_verified ?? u?.isVerified),
    role: u?.role ?? 'user',
    created_at: u?.created_at ?? u?.joined_date ?? u?.joinedDate ?? null,
  } as any;
};

/** ---------- API helper ---------- */
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData) headers['Content-Type'] = (headers['Content-Type'] as string) || 'application/json';

  // ✅ Add timeout to stop 6-minute hangs
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

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
 * ✅ FIXED: Upload file to Cloudflare R2 - returns both URL and MIME type
 */
const uploadToCloudflareR2 = async (file: File): Promise<{url: string, type: string, filename: string}> => {
  try {
    // Create FormData with the file
    const formData = new FormData();
    formData.append('file', file);
    
    // Add metadata - IMPORTANT for proper file handling
    formData.append('filename', file.name);
    formData.append('type', file.type);
    formData.append('folder', 'posts');
    formData.append('timestamp', Date.now().toString());
    
    // Call the upload API endpoint
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.url) {
      throw new Error('No URL returned from upload');
    }
    
    // ✅ Return URL AND the original MIME type
    return {
      url: result.url,
      type: file.type, // Keep original MIME type
      filename: file.name
    };
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
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

const LS_USER_KEY = 'user';

/**
 * ✅ Normalize FEED rows returned by /api/feeds
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
  return normalizeUser({
    id: row?.user_id,
    username: row?.username ?? 'user',
    name: row?.username ?? 'User',
    profile_image_url: row?.profile_image_url ?? '',
    is_verified: row?.is_verified ?? 0,
    role: row?.role ?? 'user',
    followers: [],
    following: [],
    created_at: row?.joined_date ?? row?.created_at ?? null,
  });
};

// ✅ Facebook-like feed merging utility
const mergeFeed = (prev: PostType[], incoming: PostType[]): PostType[] => {
  const map = new Map<number, PostType>();
  
  // Add all previous posts
  prev.forEach(p => map.set(Number(p.id), p));
  
  // Update with incoming data, preserving user interactions
  incoming.forEach(p => {
    const existing = map.get(Number(p.id));
    if (existing) {
      // Keep user's reactions, shares, comments from existing post
      map.set(Number(p.id), { 
        ...existing, 
        ...p,
        reactions: existing.reactions, // Keep user's reactions
        shares: Math.max(existing.shares || 0, p.shares || 0), // Keep higher share count
        comments_count: Math.max(existing.comments_count || 0, p.comments_count || 0) // Keep higher comment count
      });
    } else {
      map.set(Number(p.id), p);
    }
  });

  // Keep old order, only add truly new items to the top
  const prevIds = new Set(prev.map(p => Number(p.id)));
  const newOnes = incoming.filter(p => !prevIds.has(Number(p.id)));
  
  return [...newOnes, ...prev.map(p => map.get(Number(p.id))!).filter(Boolean)];
};

export default function App() {
  useLanguage();

  /** ---------- State ---------- */
  const [users, setUsers] = useState<User[]>(INITIAL_USERS.map(normalizeUser));
  const [posts, setPosts] = useState<PostType[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [chats, setChats] = useState<any[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'reels' | 'marketplace' | 'groups'>('home');
  const [view, setView] = useState<View>('home');

  // ✅ FACEBOOK-LIKE IMPROVEMENTS - Feed freezing per session
  const feedSessionSeedRef = useRef<number>(Math.floor(Math.random() * 1_000_000));
  const [feedHydrated, setFeedHydrated] = useState(false);
  const [isFeedRefreshing, setIsFeedRefreshing] = useState(false); // internal only
  const [pendingPosts, setPendingPosts] = useState<PostType[]>([]);
  const [showNewPostsPill, setShowNewPostsPill] = useState(false);

  // ✅ Keep last good posts so polling can't wipe feed to empty
  const lastGoodPostsRef = useRef<PostType[]>([]);
  // ✅ Snapshot for comments so CommentsSheet never goes blank if feed refreshes
  const [commentPostSnapshot, setCommentPostSnapshot] = useState<PostType | null>(null);
  // ✅ Schedule silent refresh after interactions
  const scheduleSilentRefreshRef = useRef<any>(null);
  // ✅ Stable feed reference for merging
  const stableFeedRef = useRef<PostType[]>([]);
  // ✅ Ranked posts reference for stable ordering
  const rankedPostsRef = useRef<PostType[]>([]);

  const [loginError, setLoginError] = useState('');

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeReelId, setActiveReelId] = useState<number | null>(null);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);
  const [showCreateReelModal, setShowCreateReelModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);

  const [currentAudioTrack, setCurrentAudioTrack] = useState<AudioTrack | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Share states
  const [activeSharePost, setActiveSharePost] = useState<any>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareInProgress, setShareInProgress] = useState(false);

  /** ---------- Apply ranking with session seed ---------- */
  const applyAndRank = useCallback((basePosts: PostType[]) => {
    if (!basePosts.length) {
      rankedPostsRef.current = [];
      return;
    }
    
    try {
      const ranked = rankFeed(
        basePosts,
        currentUser,
        users,
        feedSessionSeedRef.current
      ) as PostType[];
      
      rankedPostsRef.current = ranked;
    } catch (error) {
      console.error('Ranking failed:', error);
      // Fallback to original order
      rankedPostsRef.current = [...basePosts];
    }
  }, [currentUser, users]);

  /** ---------- Facebook-like improvements ---------- */
  const scheduleSilentRefresh = useCallback(() => {
    if (scheduleSilentRefreshRef.current) clearTimeout(scheduleSilentRefreshRef.current);
    scheduleSilentRefreshRef.current = setTimeout(() => {
      fetchPostsForHome(currentUser).catch(() => {});
    }, 8000); // Refresh 8 seconds after interaction
  }, [currentUser]);

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

  const openProfile = useCallback((id: number) => {
    setSelectedUserId(Number(id));
    setView('profile');
    window.scrollTo(0, 0);
  }, []);

  /**
   * ✅ Fetch users list
   */
  const fetchUsersList = useCallback(async () => {
    try {
      const u = await apiFetch('/api/users').catch(() => []);
      const arr = safeArray(u).map(normalizeUser);
      if (arr.length) setUsers(arr);
      else setUsers(INITIAL_USERS.map(normalizeUser));
    } catch {
      setUsers(INITIAL_USERS.map(normalizeUser));
    }
  }, []);

  /**
   * ✅ Fetch posts for homepage - FACEBOOK-LIKE IMPROVEMENTS
   * ✅ Never show loading, never replace feed with empty
   * ✅ New posts go to pendingPosts, not main feed
   */
  const fetchPostsForHome = useCallback(
    async (viewer: User | null, isSilentRefresh: boolean = false) => {
      // ✅ Internal refresh flag (not shown to user)
      if (!isSilentRefresh) {
        setIsFeedRefreshing(true);
      }
      
      try {
        if (viewer?.id) {
          const data = await apiFetch(`/api/feeds?userId=${viewer.id}&limit=50`);
          const rows = safeArray<any>(data?.feed);

          // ✅ If feed API returns empty, keep last good posts (prevents disappear)
          if (!rows.length) {
            if (lastGoodPostsRef.current.length) {
              setPosts(lastGoodPostsRef.current);
            }
            return;
          }

          // Merge authors into users list
          setUsers((prev) => {
            const map = new Map<number, User>();
            safeArray(prev).forEach((u) => map.set(Number(u.id), normalizeUser(u)));

            rows.forEach((r) => {
              const author = authorFromFeedRow(r);
              if (!author?.id) return;
              if (!map.has(author.id)) map.set(author.id, author);
              else {
                const existing = map.get(author.id)!;
                map.set(author.id, normalizeUser({ ...existing, ...author }));
              }
            });

            return Array.from(map.values());
          });

          const normalized = rows.map(normalizeFeedRowToPost);
          
          if (!feedHydrated) {
            // ✅ Initial feed load - apply ranking and set as current
            setPosts(normalized);
            lastGoodPostsRef.current = normalized;
            stableFeedRef.current = normalized;
            applyAndRank(normalized);
            setFeedHydrated(true);
          } else {
            // ✅ Polling update - compare and add new posts to pending
            const currentIds = new Set(lastGoodPostsRef.current.map(p => Number(p.id)));
            const incomingNew = normalized.filter(p => !currentIds.has(Number(p.id)));

            if (incomingNew.length > 0) {
              // Add new posts to pending posts, deduplicate
              setPendingPosts(prev => {
                const map = new Map<number, PostType>();
                // Add incoming new posts first (most recent)
                [...incomingNew, ...prev].forEach(p => map.set(Number(p.id), p));
                return Array.from(map.values());
              });
              
              // Show new posts notification pill
              if (!isSilentRefresh) {
                setShowNewPostsPill(true);
              }
            }
            
            // ✅ Update existing posts with fresh data (silently)
            setPosts(prev => {
              const next = mergeFeed(prev, normalized);
              lastGoodPostsRef.current = next;
              stableFeedRef.current = next;
              return next;
            });
          }

          // ✅ keep snapshot updated if comments open
          if (activeCommentsPostId != null) {
            const found = normalized.find((p) => Number(p.id) === Number(activeCommentsPostId));
            if (found) setCommentPostSnapshot(found);
          }
          return;
        }

        // Guest feed fallback
        const p = await apiFetch('/api/posts');
        const normalized = safeArray(p).map(normalizePost);

        if (!feedHydrated) {
          // ✅ Initial load for guests
          if (normalized.length) {
            setPosts(normalized);
            lastGoodPostsRef.current = normalized;
            stableFeedRef.current = normalized;
            applyAndRank(normalized);
            setFeedHydrated(true);
          }
        } else {
          // ✅ Polling for guests
          const currentIds = new Set(lastGoodPostsRef.current.map(p => Number(p.id)));
          const incomingNew = normalized.filter(p => !currentIds.has(Number(p.id)));

          if (incomingNew.length > 0) {
            setPendingPosts(prev => {
              const map = new Map<number, PostType>();
              [...incomingNew, ...prev].forEach(p => map.set(Number(p.id), p));
              return Array.from(map.values());
            });
            
            if (!isSilentRefresh) {
              setShowNewPostsPill(true);
            }
          }
          
          setPosts(prev => {
            const next = mergeFeed(prev, normalized);
            lastGoodPostsRef.current = next;
            stableFeedRef.current = next;
            return next;
          });
        }

        if (activeCommentsPostId != null) {
          const found = normalized.find((x) => Number(x.id) === Number(activeCommentsPostId));
          if (found) setCommentPostSnapshot(found);
        }
      } catch {
        // ✅ Keep last good feed on error
        if (lastGoodPostsRef.current.length) {
          setPosts(lastGoodPostsRef.current);
        }
      } finally {
        // ✅ Clear internal refresh flag
        if (!isSilentRefresh) {
          setIsFeedRefreshing(false);
        }
      }
    },
    [activeCommentsPostId, feedHydrated, applyAndRank]
  );

  /**
   * ✅ Fetch other data
   */
  const fetchOtherData = useCallback(async () => {
    const [s, r, pr, g, b, e, c] = await Promise.all([
      apiFetch('/api/stories').catch(() => []),
      apiFetch('/api/reels').catch(() => []),
      apiFetch('/api/products').catch(() => []),
      apiFetch('/api/groups').catch(() => []),
      apiFetch('/api/brands').catch(() => []),
      apiFetch('/api/events').catch(() => []),
      apiFetch('/api/chats').catch(() => []),
    ]);

    setStories(safeArray(s));
    setReels(safeArray(r));
    setProducts(safeArray(pr));
    setGroups(safeArray(g));
    setBrands(safeArray(b));
    setEvents(safeArray(e));
    setChats(safeArray(c));
  }, []);

  /**
   * ✅ One fetch pipeline
   */
  const fetchData = useCallback(
    async (viewer: User | null) => {
      await Promise.all([fetchUsersList(), fetchPostsForHome(viewer), fetchOtherData()]);
    },
    [fetchUsersList, fetchPostsForHome, fetchOtherData]
  );

  /** ---------- Restore session + initial load ---------- */
  useEffect(() => {
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

      await fetchData(viewer);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  /** ---------- Smart Polling (Facebook-style) ---------- */
  useEffect(() => {
    // ✅ Pause polling while comments are open (prevents blank/disappear while reading)
    if (activeCommentsPostId != null) return;
    
    // ✅ Don't poll if tab is hidden
    if (document.visibilityState !== "visible") return;

    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState !== "visible") return;
      if (activeCommentsPostId != null) return;
      
      // ✅ Use silent refresh for polling - no UI indicators
      await fetchPostsForHome(currentUser, true).catch(() => {});
    };

    const t = setInterval(tick, 30000); // ✅ slower like FB (30s)
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [currentUser, fetchPostsForHome, activeCommentsPostId]);

  /** ---------- Handle "New Posts" button click ---------- */
  const handleLoadNewPosts = useCallback(() => {
    if (pendingPosts.length === 0) {
      setShowNewPostsPill(false);
      return;
    }

    // Merge pending posts with current posts (deduplicate)
    const merged = [...pendingPosts, ...lastGoodPostsRef.current];
    const map = new Map<number, PostType>();
    merged.forEach(p => map.set(Number(p.id), p));
    const next = Array.from(map.values());

    // Update all references
    setPosts(next);
    lastGoodPostsRef.current = next;
    stableFeedRef.current = next;
    
    // Apply ranking to the new combined feed
    applyAndRank(next);
    
    // Clear pending posts and hide pill
    setPendingPosts([]);
    setShowNewPostsPill(false);
  }, [pendingPosts, applyAndRank]);

  /** ---------- Derived ---------- */
  const rankedPosts = useMemo(() => {
    // ✅ Use ranked posts reference for stable ordering (no reshuffling on every render)
    return rankedPostsRef.current.length > 0 ? rankedPostsRef.current : posts;
  }, [posts]); // Still depends on posts to trigger re-render when posts change

  const activePost = useMemo(() => {
    // ✅ FIX: allow id=0 and prevent falsy bug
    if (activeCommentsPostId == null) return null;

    // ✅ Prefer snapshot (stable even if posts refresh)
    if (commentPostSnapshot && Number((commentPostSnapshot as any)?.id) === Number(activeCommentsPostId)) {
      return commentPostSnapshot;
    }

    return posts.find((p) => Number(p.id) === Number(activeCommentsPostId)) || null;
  }, [posts, activeCommentsPostId, commentPostSnapshot]);

  /** ---------- Login ---------- */
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

      localStorage.setItem(LS_USER_KEY, JSON.stringify(normalized));

      setCurrentUser(normalized);

      setUsers((prev) => {
        const arr = safeArray(prev);
        const exists = arr.some((x) => Number(x.id) === Number(normalized.id));
        if (exists) return arr.map((x) => (Number(x.id) === Number(normalized.id) ? normalized : x));
        return [normalized, ...arr];
      });

      setSelectedUserId(Number(normalized.id));
      setView('home');

      // ✅ Clear old feed and start fresh on login
      setFeedHydrated(false);
      setPendingPosts([]);
      setShowNewPostsPill(false);
      rankedPostsRef.current = [];
      await fetchPostsForHome(normalized);
    } catch (error: any) {
      setLoginError(error?.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(LS_USER_KEY);
    setCurrentUser(null);
    setSelectedUserId(null);
    setView('home');
    
    // ✅ Clear feed state on logout
    setFeedHydrated(false);
    setPendingPosts([]);
    setShowNewPostsPill(false);
    rankedPostsRef.current = [];
    
    fetchPostsForHome(null).catch(() => {});
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

  /** ---------- API actions ---------- */
  const createPost = useCallback(
    async (
      text: string,
      file: File | null,
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
      if (!trimmed && !file && !meta?.background) return;

      let media_url: string | null = null;
      let media_type: string | null = null;

      // ✅ FIXED: Upload file to Cloudflare R2 if exists
      if (file) {
        try {
          const uploadResult = await uploadToCloudflareR2(file);
          media_url = uploadResult.url;
          media_type = uploadResult.type; // ✅ Preserve full MIME type like "image/jpeg"
        } catch (error: any) {
          setLoginError(`Failed to upload file: ${error.message}`);
          return;
        }
      }

      const payload: any = {
        user_id: currentUser!.id,
        content: trimmed,
        media_url,
        media_type, // ✅ Now contains full MIME type
        visibility: meta?.visibility ?? 'public',
        location: meta?.location,
        feeling: meta?.feeling,
        tagged_users: meta?.taggedUsers,
        background: meta?.background,
        link_preview: meta?.linkPreview,
        type: (() => {
          if (!media_type) return meta?.type || 'text';
          if (media_type.startsWith('image/')) return 'image';
          if (media_type.startsWith('video/')) return 'video';
          if (media_type.startsWith('audio/')) return 'audio';
          return meta?.type || 'text';
        })()
      };

      const data = await apiFetch('/api/posts', { method: 'POST', body: JSON.stringify(payload) });

      // backend may return {success:true, post: {...}} or {post_id: ...}
      const newPostRaw =
        data?.post ?? { ...payload, post_id: data?.post_id ?? data?.id ?? Date.now(), created_at: new Date().toISOString() };

      const normalized = normalizePost(newPostRaw);

      // ✅ Optimistic update - post appears immediately
      setPosts((prev) => {
        const next = [normalized, ...safeArray(prev)];
        lastGoodPostsRef.current = next;
        stableFeedRef.current = next;
        applyAndRank(next); // ✅ Re-rank with new post included
        return next;
      });

      setShowCreatePostModal(false);

      // ✅ Schedule silent refresh instead of immediate fetch
      scheduleSilentRefresh();
    },
    [currentUser, requireAuth, scheduleSilentRefresh, applyAndRank]
  );

  const onReactPost = useCallback(
    async (postId: number, type: ReactionType) => {
      if (!requireAuth('Reacting')) return;

      // ✅ Optimistic update - reaction appears immediately
      setPosts((prev) => {
        const next = safeArray(prev).map((p: any) => {
          if (Number(p.id) !== Number(postId)) return p;

          const reactions = safeArray(p.reactions);
          const mine = reactions.find((r: any) => Number(r.user_id) === Number(currentUser!.id));
          let nextReactions = reactions.filter((r: any) => Number(r.user_id) !== Number(currentUser!.id));

          if (!mine || mine.type !== type) nextReactions = [...nextReactions, { user_id: currentUser!.id, type }];

          return normalizePost({ ...p, reactions: nextReactions });
        });

        lastGoodPostsRef.current = next;
        stableFeedRef.current = next;
        // ✅ Don't re-rank on reaction - keep feed order stable
        return next;
      });

      try {
        await apiFetch(`/api/posts/${postId}/react`, { method: 'POST', body: JSON.stringify({ type }) });
      } catch {
        // ✅ Schedule silent refresh instead of immediate fetch
        scheduleSilentRefresh();
      }
    },
    [currentUser, requireAuth, scheduleSilentRefresh]
  );

  const onSharePost = useCallback(
    async (postId: number) => {
      if (!requireAuth('Sharing')) return;

      // ✅ Optimistic update - share count updates immediately
      setPosts((prev) => {
        const next = safeArray(prev).map((p: any) =>
          Number(p.id) === Number(postId) ? normalizePost({ ...p, shares: safeNumber(p.shares) + 1 }) : p
        );
        lastGoodPostsRef.current = next;
        stableFeedRef.current = next;
        // ✅ Don't re-rank on share - keep feed order stable
        return next;
      });

      try {
        await apiFetch(`/api/posts/${postId}/share`, { method: 'POST' });
      } catch {
        // ✅ Schedule silent refresh instead of immediate fetch
        scheduleSilentRefresh();
      }
    },
    [requireAuth, scheduleSilentRefresh]
  );

  // Handle share action from Post component
  const handleOpenShareSheet = useCallback((post: any) => {
    if (!currentUser) {
      setLoginError('Please login to share posts.');
      setView('login');
      return;
    }
    setActiveSharePost(post);
    setShowShareSheet(true);
  }, [currentUser]);

  // Handle share completion
  const handleShareComplete = useCallback(async (destination: string, data?: any) => {
    if (data?.success && activeSharePost) {
      // Update post share count optimistically
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

      // Call API to record share
      try {
        await apiFetch(`/api/posts/${activeSharePost.id}/share`, { 
          method: 'POST',
          body: JSON.stringify({ destination })
        });
      } catch (error) {
        console.error('Failed to record share:', error);
      }
    }

    setShareInProgress(false);
    setActiveSharePost(null);
    setShowShareSheet(false);
    
    // ✅ Schedule silent refresh instead of immediate fetch
    scheduleSilentRefresh();
  }, [activeSharePost, scheduleSilentRefresh]);

  const onOpenComments = (postId: number) => {
    if (!requireAuth('Commenting')) return;

    const pid = Number(postId);
    setActiveCommentsPostId(pid);

    // ✅ snapshot immediately to prevent blank if posts refresh
    const found = posts.find((p) => Number(p.id) === pid) || null;
    setCommentPostSnapshot(found);
  };

  const deletePost = useCallback(
    async (postId: number) => {
      if (!requireAuth('Deleting posts')) return;

      const prev = posts;
      setPosts((p) => {
        const next = safeArray(p).filter((x) => Number(x.id) !== Number(postId));
        lastGoodPostsRef.current = next;
        stableFeedRef.current = next;
        applyAndRank(next); // ✅ Re-rank after deletion
        return next;
      });

      try {
        await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
      } catch {
        setPosts(prev);
        lastGoodPostsRef.current = prev;
        stableFeedRef.current = prev;
        applyAndRank(prev); // ✅ Restore ranking if deletion fails
      }
    },
    [requireAuth, posts, applyAndRank]
  );

  const editPost = useCallback(
    async (postId: number, content: string) => {
      if (!requireAuth('Editing posts')) return;
      const trimmed = (content || '').trim();
      if (!trimmed) return;

      const prev = posts;
      setPosts((p) => {
        const next = safeArray(p).map((x: any) =>
          Number(x.id) === Number(postId) ? normalizePost({ ...x, content: trimmed }) : x
        );
        lastGoodPostsRef.current = next;
        stableFeedRef.current = next;
        // ✅ Don't re-rank on edit - keep feed order stable
        return next;
      });

      try {
        await apiFetch(`/api/posts/${postId}`, { method: 'PATCH', body: JSON.stringify({ content: trimmed }) });
      } catch {
        setPosts(prev);
        lastGoodPostsRef.current = prev;
        stableFeedRef.current = prev;
      }
    },
    [requireAuth, posts]
  );

  const followUser = useCallback(
    async (targetUserId: number) => {
      if (!requireAuth('Following')) return;
      if (!currentUser) return;
      if (Number(targetUserId) === Number(currentUser.id)) return;

      setUsers((prev) => {
        const arr = safeArray(prev).map(normalizeUser);
        const me = arr.find((u) => Number(u.id) === Number(currentUser.id));
        const target = arr.find((u) => Number(u.id) === Number(targetUserId));
        if (!me || !target) return arr;

        const meFollowers = new Set<number>(safeArray<number>((me as any).followers));
        const targetFollowers = new Set<number>(safeArray<number>((target as any).followers));

        const isFollowingNow = meFollowers.has(targetUserId) && targetFollowers.has(currentUser.id);

        if (isFollowingNow) {
          meFollowers.delete(targetUserId);
          targetFollowers.delete(currentUser.id);
        } else {
          meFollowers.add(targetUserId);
          targetFollowers.add(currentUser.id);
        }

        return arr.map((u) => {
          if (Number(u.id) === Number(me.id)) return normalizeUser({ ...u, followers: Array.from(meFollowers) });
          if (Number(u.id) === Number(target.id)) return normalizeUser({ ...u, followers: Array.from(targetFollowers) });
          return u;
        });
      });

      try {
        await apiFetch('/api/user-follows', {
          method: 'POST',
          body: JSON.stringify({ follower_id: currentUser.id, following_id: targetUserId }),
        }).catch(async () => {
          await apiFetch(`/api/user-follows?follower_id=${currentUser.id}&following_id=${targetUserId}`, {
            method: 'DELETE',
          });
        });

        // ✅ Schedule silent refresh instead of immediate fetch
        scheduleSilentRefresh();
      } catch {
        // ✅ Schedule silent refresh instead of immediate fetch
        scheduleSilentRefresh();
      }
    },
    [requireAuth, currentUser, scheduleSilentRefresh]
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

      try {
        const uploadResult = await uploadToCloudflareR2(file);
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

      try {
        const uploadResult = await uploadToCloudflareR2(file);
        await updateUserDetails({ cover_image_url: uploadResult.url } as any);
      } catch (error: any) {
        setLoginError(`Failed to upload cover image: ${error.message}`);
      }
    },
    [requireAuth, currentUser, updateUserDetails]
  );

  /** ---------- Render ---------- */
  const profileUser =
    (selectedUserId ? users.find((u) => Number(u.id) === Number(selectedUserId)) : null) || currentUser || users[0];

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
              <StoryReel
                stories={stories}
                onProfileClick={(id) => openProfile(id)}
                onCreateStory={() => {
                  if (!requireAuth('Creating stories')) return;
                  setShowCreateStoryModal(true);
                }}
                onViewStory={(s) => setActiveStory(s)}
                currentUser={currentUser}
                onRequestLogin={() => setView('login')}
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

              {/* ✅ FACEBOOK-STYLE "NEW POSTS" BUTTON */}
              {showNewPostsPill && pendingPosts.length > 0 && (
                <div className="sticky top-14 z-10 flex justify-center mb-3">
                  <button
                    className="px-4 py-2 rounded-full bg-[#1877F2] text-white font-bold shadow hover:bg-[#166FE5] active:bg-[#1460D0] transition-colors"
                    onClick={handleLoadNewPosts}
                  >
                    New posts ({pendingPosts.length})
                  </button>
                </div>
              )}

              {/* ✅ FACEBOOK-LIKE FEED DISPLAY: No loading states, never empty while fetching */}
              {rankedPosts.length > 0 ? (
                rankedPosts.map((post) => (
                  <Post
                    // ✅ fallback key prevents blank feed when id is missing/0
                    key={(post as any).id || `${(post as any).user_id}-${(post as any).created_at}`}
                    post={post}
                    author={
                      users.find((u) => Number(u.id) === Number((post as any).user_id)) ||
                      users[0] ||
                      INITIAL_USERS[0]
                    }
                    currentUser={currentUser}
                    users={users}
                    onProfileClick={(id) => openProfile(id)}
                    onReact={(postId: number, type: ReactionType) => onReactPost(postId, type)}
                    onShare={(postId: number) => handleOpenShareSheet(post)}
                    onViewImage={setFullScreenImage}
                    onOpenComments={(postId: number) => onOpenComments(postId)}
                    onVideoClick={(p: any) => {
                      setActiveReelId(p.id);
                      setView('reels');
                    }}
                    onPlayAudioTrack={setCurrentAudioTrack}
                    groups={groups}
                    brands={brands}
                    chats={chats}
                  />
                ))
              ) : !feedHydrated ? (
                // ✅ Show nothing or skeleton during first fetch (NOT loading text)
                <div className="text-center py-20 text-[#B0B3B8]">
                  {/* Facebook shows nothing during initial load */}
                </div>
              ) : (
                // ✅ Only show "No posts" after feed is hydrated and truly empty
                <div className="text-center py-20 text-[#B0B3B8]">
                  <p>No posts available.</p>
                </div>
              )}
            </div>
          )}

          {view === 'reels' && (
            <ReelsFeed
              reels={reels}
              users={users}
              currentUser={currentUser}
              onProfileClick={(id) => openProfile(id)}
              onCreateReelClick={() => {
                if (!requireAuth('Creating reels')) return;
                setShowCreateReelModal(true);
              }}
              onReact={() => requireAuth('Reacting')}
              onComment={() => requireAuth('Commenting')}
              onShare={(post: any) => handleOpenShareSheet(post)}
              onFollow={(id: number) => followUser(id)}
              getCommentAuthor={(id) => users.find((u) => u.id === id)}
              initialReelId={activeReelId}
            />
          )}

          {view === 'marketplace' && (
            <MarketplacePage
              currentUser={currentUser}
              products={products}
              onNavigateHome={() => handleNavigate('home')}
              onCreateProduct={() => requireAuth('Creating products')}
              onViewProduct={setActiveProduct}
            />
          )}

          {view === 'groups' && (
            <GroupsPage
              currentUser={currentUser}
              groups={groups}
              users={users}
              onCreateGroup={() => requireAuth('Creating groups')}
              onJoinGroup={() => requireAuth('Joining groups')}
              onLeaveGroup={() => requireAuth('Leaving groups')}
              onDeleteGroup={() => requireAuth('Deleting groups')}
              onUpdateGroupImage={() => requireAuth('Updating groups')}
              onPostToGroup={() => requireAuth('Posting')}
              onCreateGroupEvent={() => requireAuth('Creating events')}
              onInviteToGroup={() => requireAuth('Inviting')}
              onProfileClick={(id) => openProfile(id)}
              onLikePost={() => requireAuth('Liking')}
              onOpenComments={() => requireAuth('Commenting')}
              onSharePost={(post: any) => handleOpenShareSheet(post)}
              onDeleteGroupPost={() => requireAuth('Deleting posts')}
              onRemoveMember={() => requireAuth('Removing members')}
              onUpdateGroupSettings={() => requireAuth('Updating settings')}
              onPlayAudioTrack={setCurrentAudioTrack}
            />
          )}

          {view === 'brands' && (
            <BrandsPage
              currentUser={currentUser}
              brands={brands}
              posts={posts}
              users={users}
              onCreateBrand={() => requireAuth('Creating brands')}
              onFollowBrand={() => requireAuth('Following')}
              onProfileClick={(id) => openProfile(id)}
              onPostAsBrand={() => requireAuth('Posting')}
              onReact={() => requireAuth('Reacting')}
              onShare={(post: any) => handleOpenShareSheet(post)}
              onOpenComments={(id: any) => {
                if (!requireAuth('Commenting')) return;
                const pid = Number(id);
                setActiveCommentsPostId(pid);
                const found = posts.find((p) => Number(p.id) === pid) || null;
                setCommentPostSnapshot(found);
              }}
              onDeleteBrand={() => requireAuth('Deleting brands')}
              onPlayAudioTrack={setCurrentAudioTrack}
            />
          )}

          {view === 'music' && (
            <MusicSystem
              currentUser={currentUser}
              onPlayTrack={setCurrentAudioTrack}
              onProfileClick={(id) => openProfile(id)}
              likedTracks={[]}
              onToggleLike={() => requireAuth('Liking')}
              playHistory={[]}
            />
          )}

          {view === 'tools' && <ToolsPage />}

          {view === 'profiles' && (
            <SuggestedProfilesPage
              currentUser={currentUser as any}
              users={users}
              onFollow={(id: number) => followUser(id)}
              onProfileClick={(id) => openProfile(id)}
            />
          )}

          {view === 'events' && (
            <EventsPage
              events={events}
              currentUser={currentUser as any}
              onJoinEvent={() => requireAuth('Joining events')}
              onCreateEventClick={() => {
                if (!requireAuth('Creating events')) return;
                setShowCreateEventModal(true);
              }}
              onProfileClick={(id) => openProfile(id)}
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
            />
          )}

          {view === 'memories' && currentUser && (
            <MemoriesPage
              currentUser={currentUser}
              posts={posts}
              users={users}
              onProfileClick={(id) => openProfile(id)}
              onReact={() => requireAuth('Reacting')}
              onShare={(post: any) => handleOpenShareSheet(post)}
              onViewImage={setFullScreenImage}
              onOpenComments={(id) => onOpenComments(id)}
              onVideoClick={() => {}}
              onPlayAudioTrack={setCurrentAudioTrack}
            />
          )}

          {view === 'settings' && currentUser && (
            <SettingsPage currentUser={currentUser} onUpdateUser={() => requireAuth('Updating settings')} />
          )}

          {view === 'privacy' && <PrivacyPolicyPage onNavigateHome={() => setView('home')} />}
          {view === 'terms' && <TermsOfServicePage onNavigateHome={() => setView('home')} />}
          {view === 'help' && <HelpSupportPage onNavigateHome={() => setView('home')} />}

          {view === 'profile' && selectedUserId && profileUser && (
            <UserProfile
              user={profileUser}
              currentUser={currentUser}
              users={users}
              posts={posts}
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
              onPlayAudioTrack={setCurrentAudioTrack}
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

          {view === 'register' && <Register onRegister={() => {}} onBackToLogin={() => setView('login')} />}
        </div>

        {currentUser && (
          <div className="sticky top-14 h-[calc(100vh-56px)] z-20 hidden xl:block pl-4">
            <RightSidebar
              contacts={users.filter((u) => u.id !== currentUser.id)}
              onProfileClick={(id) => openProfile(id)}
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
        <CreateEventModal currentUser={currentUser} onClose={() => setShowCreateEventModal(false)} onCreate={() => {}} />
      )}

      {showCreatePostModal && currentUser && (
        <CreatePostModal
          currentUser={currentUser}
          users={users}
          onClose={() => setShowCreatePostModal(false)}
          onCreatePost={(text: string, file: File | null, meta?: any) => createPost(text, file, meta)}
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
          onLikeComment={() => {}}
          getCommentAuthor={(id) => users.find((u) => u.id === id)}
          onProfileClick={(id) => openProfile(id)}
        />
      )}

      {/* Share Bottom Sheet */}
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
        />
      )}

      {currentAudioTrack && (
        <GlobalAudioPlayer
          currentTrack={currentAudioTrack}
          isPlaying={isAudioPlaying}
          onTogglePlay={() => setIsAudioPlaying(!isAudioPlaying)}
          onNext={() => {}}
          onPrevious={() => {}}
          onClose={() => setCurrentAudioTrack(null)}
          onDownload={() => {}}
          onLike={() => requireAuth('Liking')}
          isLiked={false}
        />
      )}

      {fullScreenImage && <ImageViewer imageUrl={fullScreenImage} onClose={() => setFullScreenImage(null)} />}

      {showCreateStoryModal && currentUser && (
        <CreateStoryModal currentUser={currentUser} onClose={() => setShowCreateStoryModal(false)} onCreate={() => {}} />
      )}

      {showCreateReelModal && currentUser && (
        <CreateReelModal currentUser={currentUser} onClose={() => setShowCreateReelModal(false)} onCreate={() => {}} />
      )}
    </div>
  );
}
