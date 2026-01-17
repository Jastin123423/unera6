


// App.tsx - PROFESSIONALLY FIXED VERSION (Unique Profile Colors & Proper Sizing)
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
import { rankFeed } from './utils/ranking';

/** ---------- Safety helpers ---------- */
const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeString = (v: any, fallback = '') => (typeof v === 'string' ? v : fallback);

/** ---------- UNERA Professional Profile Picture Generator ---------- */
const COLORS = [
  '#1877F2', // Facebook Blue
  '#45BD62', // Success Green
  '#F3425F', // Love Red
  '#F7B928', // Gold Yellow
  '#9360F7', // Purple
  '#FF6B35', // Orange
  '#00B5AD', // Teal
  '#E41E3F', // Crimson
  '#7B68EE', // Medium Slate Blue
  '#20B2AA', // Light Sea Green
  '#FF6347', // Tomato
  '#9B59B6', // Amethyst
  '#1ABC9C', // Turquoise
  '#3498DB', // Peter River
  '#E74C3C', // Alizarin
  '#2ECC71', // Emerald
  '#F39C12', // Sun Flower
  '#D35400', // Pumpkin
];

/**
 * Generate a consistent but unique color for a user based on their ID or name
 */
const getUserColor = (identifier: string | number): string => {
  if (!identifier && identifier !== 0) return '#1877F2'; // Default blue
  
  const str = String(identifier);
  let hash = 0;
  
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
};

/**
 * Generate initials from a name for UNERA profile pictures
 */
const generateInitials = (name: string): string => {
  if (!name || typeof name !== 'string' || name.trim().length === 0) return 'UN';
  
  // Remove extra spaces and split into words
  const words = name.trim().split(/\s+/).filter(word => word.length > 0);
  
  if (words.length === 0) return 'UN';
  
  if (words.length === 1) {
    // Single word: take first 2 letters or repeat first letter
    const word = words[0];
    if (word.length >= 2) {
      return word.substring(0, 2).toUpperCase();
    } else {
      return (word.charAt(0) + word.charAt(0)).toUpperCase();
    }
  }
  
  // Multiple words: take first letter of first two words
  const firstInitial = words[0].charAt(0).toUpperCase();
  const secondInitial = words[1].charAt(0).toUpperCase();
  return firstInitial + secondInitial;
};

/**
 * Generate UNERA-style profile picture URL with initials and unique color
 * Professional sizing: Smaller text (font-size=0.5) to fit circle properly
 */
const generateProfilePictureUrl = (name: string, identifier: string | number): string => {
  const initials = generateInitials(name);
  const backgroundColor = getUserColor(identifier).replace('#', '');
  
  // Professional settings:
  // - font-size=0.5: Text is 50% of image size (fits perfectly in circle)
  // - bold=true: Makes text more readable
  // - size=128: Optimal size for web (64px displayed at 2x for retina)
  // - rounded=true: Perfect circle
  // - length=2: Exactly 2 characters
  // - color=FFFFFF: White text for contrast
  // - background: Unique color based on user
  const size = 128; // Base size (will be displayed at 64px in CSS)
  const fontSize = 0.5; // 50% of image size - Professional sizing
  const textColor = 'FFFFFF'; // White
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${backgroundColor}&color=${textColor}&size=${size}&font-size=${fontSize}&bold=true&rounded=true&length=2`;
};

/**
 * Normalize raw D1 rows to UI-safe PostType shape.
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
 * Normalize user data with UNERA-style profile pictures
 */
const normalizeUser = (u: any): User => {
  const resolvedId = safeNumber(u?.id ?? u?.user_id ?? u?.userId);
  const userName = safeString(u?.name, safeString(u?.username, 'User'));
  const userUsername = safeString(u?.username, safeString(u?.name, 'user'));
  
  // Use user ID for consistent color generation (or fallback to name)
  const colorIdentifier = resolvedId > 0 ? resolvedId : userName;
  
  // If profile image is empty or default, generate UNERA-style initials picture
  const existingProfileImage = u?.profile_image_url ?? u?.avatar_url ?? u?.profileImage ?? '';
  let profileImageUrl = existingProfileImage;
  
  // Check if we should generate a new profile picture
  const shouldGenerateNewPicture = 
    !profileImageUrl || 
    profileImageUrl.trim() === '' ||
    profileImageUrl.includes('ui-avatars.com/api/?name=User') ||
    profileImageUrl.includes('ui-avatars.com/api/?name=UNERA') ||
    profileImageUrl.includes('ui-avatars.com/api/?background=1877F2&color=fff') ||
    profileImageUrl.includes('ui-avatars.com/api/?name=') && !profileImageUrl.includes('font-size=0.5');
  
  if (shouldGenerateNewPicture) {
    profileImageUrl = generateProfilePictureUrl(userName, colorIdentifier);
  }

  return {
    ...u,
    id: resolvedId,
    name: userName,
    username: userUsername,
    followers: safeArray<number>(u?.followers),
    following: safeArray<number>(u?.following),
    profile_image_url: profileImageUrl,
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
 * Upload file to Cloudflare R2
 */
const uploadToCloudflareR2 = async (file: File): Promise<{url: string, type: string, filename: string}> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    formData.append('type', file.type);
    formData.append('folder', 'posts');
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
    
    if (!result.url) {
      throw new Error('No URL returned from upload');
    }
    
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
    username: username,
    name: name,
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
  
  prev.forEach(p => map.set(Number(p.id), p));
  
  incoming.forEach(p => {
    const existing = map.get(Number(p.id));
    if (existing) {
      map.set(Number(p.id), { 
        ...existing, 
        ...p,
        reactions: existing.reactions,
        shares: Math.max(existing.shares || 0, p.shares || 0),
        comments_count: Math.max(existing.comments_count || 0, p.comments_count || 0)
      });
    } else {
      map.set(Number(p.id), p);
    }
  });

  const prevIds = new Set(prev.map(p => Number(p.id)));
  const newOnes = incoming.filter(p => !prevIds.has(Number(p.id)));
  
  return [...newOnes, ...prev.map(p => map.get(Number(p.id))!).filter(Boolean)];
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
    created_at: null
  };
};

export default function App() {
  useLanguage();

  /** ---------- State ---------- */
  const [users, setUsers] = useState<User[]>([]);
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

  // Facebook-like improvements
  const [feedHydrated, setFeedHydrated] = useState(false);
  const [isFeedRefreshing, setIsFeedRefreshing] = useState(false);

  // Refs for stable data
  const lastGoodPostsRef = useRef<PostType[]>([]);
  const [commentPostSnapshot, setCommentPostSnapshot] = useState<PostType | null>(null);
  const scheduleSilentRefreshRef = useRef<any>(null);
  const stableFeedRef = useRef<PostType[]>([]);

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

  const [activeSharePost, setActiveSharePost] = useState<any>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareInProgress, setShareInProgress] = useState(false);

  /** ---------- Facebook-like improvements ---------- */
  const scheduleSilentRefresh = useCallback(() => {
    if (scheduleSilentRefreshRef.current) clearTimeout(scheduleSilentRefreshRef.current);
    scheduleSilentRefreshRef.current = setTimeout(() => {
      fetchPostsForHome(currentUser).catch(() => {});
    }, 8000);
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
   * Fetch users list - NO FAKE DATA
   */
  const fetchUsersList = useCallback(async () => {
    try {
      const u = await apiFetch('/api/users').catch(() => []);
      const arr = safeArray(u).map(normalizeUser);
      setUsers(arr);
    } catch {
      setUsers([]);
    }
  }, []);

  /**
   * Fetch posts for homepage - Facebook-like improvements
   */
  const fetchPostsForHome = useCallback(
    async (viewer: User | null) => {
      setIsFeedRefreshing(true);
      
      try {
        if (viewer?.id) {
          const data = await apiFetch(`/api/feeds?userId=${viewer.id}&limit=50`);
          const rows = safeArray<any>(data?.feed);

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
          
          setPosts(prev => {
            const next = mergeFeed(prev, normalized);
            stableFeedRef.current = next;
            lastGoodPostsRef.current = next;
            return next;
          });

          if (!feedHydrated) {
            setFeedHydrated(true);
          }

          if (activeCommentsPostId != null) {
            const found = normalized.find((p) => Number(p.id) === Number(activeCommentsPostId));
            if (found) setCommentPostSnapshot(found);
          }
          return;
        }

        // Guest feed fallback
        const p = await apiFetch('/api/posts');
        const normalized = safeArray(p).map(normalizePost);

        if (normalized.length) {
          setPosts(prev => {
            const next = mergeFeed(prev, normalized);
            lastGoodPostsRef.current = next;
            return next;
          });
        } else if (lastGoodPostsRef.current.length) {
          setPosts(lastGoodPostsRef.current);
        }

        if (activeCommentsPostId != null) {
          const found = normalized.find((x) => Number(x.id) === Number(activeCommentsPostId));
          if (found) setCommentPostSnapshot(found);
        }
      } catch {
        if (lastGoodPostsRef.current.length) {
          setPosts(lastGoodPostsRef.current);
        }
      } finally {
        setIsFeedRefreshing(false);
      }
    },
    [activeCommentsPostId, feedHydrated]
  );

  /**
   * Fetch other data
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
   * One fetch pipeline
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

  /** ---------- Smart Polling ---------- */
  useEffect(() => {
    if (activeCommentsPostId != null) return;
    if (document.visibilityState !== "visible") return;

    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState !== "visible") return;
      if (activeCommentsPostId != null) return;
      
      await fetchPostsForHome(currentUser).catch(() => {});
    };

    const t = setInterval(tick, 30000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [currentUser, fetchPostsForHome, activeCommentsPostId]);

  /** ---------- Derived ---------- */
  const rankedPosts = useMemo(() => {
    const feedToRank = stableFeedRef.current.length > 0 ? stableFeedRef.current : posts;
    return Array.isArray(feedToRank) ? feedToRank : [];
  }, [posts]);

  const activePost = useMemo(() => {
    if (activeCommentsPostId == null) return null;

    if (commentPostSnapshot && Number((commentPostSnapshot as any)?.id) === Number(activeCommentsPostId)) {
      return commentPostSnapshot;
    }

    return posts.find((p) => Number(p.id) === Number(activeCommentsPostId)) || null;
  }, [posts, activeCommentsPostId, commentPostSnapshot]);

  const profileUser = useMemo(() => {
    if (selectedUserId) {
      return users.find((u) => Number(u.id) === Number(selectedUserId)) || null;
    }
    return currentUser || null;
  }, [selectedUserId, users, currentUser]);

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

      if (file) {
        try {
          const uploadResult = await uploadToCloudflareR2(file);
          media_url = uploadResult.url;
          media_type = uploadResult.type;
        } catch (error: any) {
          setLoginError(`Failed to upload file: ${error.message}`);
          return;
        }
      }

      const payload: any = {
        user_id: currentUser!.id,
        content: trimmed,
        media_url,
        media_type,
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

      const newPostRaw =
        data?.post ?? { ...payload, post_id: data?.post_id ?? data?.id ?? Date.now(), created_at: new Date().toISOString() };

      const normalized = normalizePost(newPostRaw);

      setPosts((prev) => {
        const next = [normalized, ...safeArray(prev)];
        lastGoodPostsRef.current = next;
        stableFeedRef.current = next;
        return next;
      });

      setShowCreatePostModal(false);
      scheduleSilentRefresh();
    },
    [currentUser, requireAuth, scheduleSilentRefresh]
  );

  const onReactPost = useCallback(
    async (postId: number, type: ReactionType) => {
      if (!requireAuth('Reacting')) return;

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
        return next;
      });

      try {
        await apiFetch(`/api/posts/${postId}/react`, { method: 'POST', body: JSON.stringify({ type }) });
      } catch {
        scheduleSilentRefresh();
      }
    },
    [currentUser, requireAuth, scheduleSilentRefresh]
  );

  const onSharePost = useCallback(
    async (postId: number) => {
      if (!requireAuth('Sharing')) return;

      setPosts((prev) => {
        const next = safeArray(prev).map((p: any) =>
          Number(p.id) === Number(postId) ? normalizePost({ ...p, shares: safeNumber(p.shares) + 1 }) : p
        );
        lastGoodPostsRef.current = next;
        stableFeedRef.current = next;
        return next;
      });

      try {
        await apiFetch(`/api/posts/${postId}/share`, { method: 'POST' });
      } catch {
        scheduleSilentRefresh();
      }
    },
    [requireAuth, scheduleSilentRefresh]
  );

  const handleOpenShareSheet = useCallback((post: any) => {
    if (!currentUser) {
      setLoginError('Please login to share posts.');
      setView('login');
      return;
    }
    setActiveSharePost(post);
    setShowShareSheet(true);
  }, [currentUser]);

  const handleShareComplete = useCallback(async (destination: string, data?: any) => {
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
    scheduleSilentRefresh();
  }, [activeSharePost, scheduleSilentRefresh]);

  const onOpenComments = (postId: number) => {
    if (!requireAuth('Commenting')) return;

    const pid = Number(postId);
    setActiveCommentsPostId(pid);

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
        return next;
      });

      try {
        await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
      } catch {
        setPosts(prev);
        lastGoodPostsRef.current = prev;
        stableFeedRef.current = prev;
      }
    },
    [requireAuth, posts]
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

        scheduleSilentRefresh();
      } catch {
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

  /** ---------- Helper function to get post author ---------- */
  const getPostAuthor = useCallback((post: PostType) => {
    const author = users.find((u) => Number(u.id) === Number((post as any).user_id));
    
    if (author) return author;
    
    // Fallback for posts without matching user
    return createFallbackUser();
  }, [users]);

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

              {/* Facebook-like feed display */}
              {rankedPosts.length > 0 ? (
                rankedPosts.map((post) => (
                  <Post
                    key={(post as any).id || `${(post as any).user_id}-${(post as any).created_at}`}
                    post={post}
                    author={getPostAuthor(post)}
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
                // Show nothing during first fetch
                <div className="text-center py-20 text-[#B0B3B8]"></div>
              ) : (
                // Only show "No posts" after feed is hydrated and truly empty
                <div className="text-center py-20 text-[#B0B3B8]">
                  <p>No posts available.</p>
                  {!currentUser && (
                    <p className="mt-2 text-sm">Sign in to see posts from your network.</p>
                  )}
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

          {view === 'profile' && profileUser && (
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
