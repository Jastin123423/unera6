// App.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Login, Register } from './components/Auth';
import { Header, Sidebar, RightSidebar } from './components/Layout';
import { CreatePost, Post, CommentsSheet, CreatePostModal, SuggestedProductsWidget } from './components/Feed';
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
} from './types';
import { INITIAL_USERS } from './constants';
import { rankFeed } from './utils/ranking';

/** ---------- Safety helpers (prevents blank-screen crashes) ---------- */
const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeString = (v: any, fallback = '') => (typeof v === 'string' ? v : fallback);

/**
 * Normalize raw D1 rows to UI-safe PostType shape.
 */
const normalizePost = (p: any): PostType => {
  const mediaType = p?.media_type ?? p?.mediaType ?? null;
  const mediaUrl = p?.media_url ?? p?.mediaUrl ?? null;

  return {
    ...p,
    id: safeNumber(p?.id),
    user_id: p?.user_id === null || p?.user_id === undefined ? null : safeNumber(p?.user_id),
    content: safeString(p?.content),
    media_url: mediaUrl,
    media_type: mediaType,

    reactions: safeArray(p?.reactions),
    comments: safeArray(p?.comments),

    shares: safeNumber(p?.shares),
    views: safeNumber(p?.views),

    visibility: p?.visibility ?? 'public',
    type:
      p?.type ??
      (mediaType
        ? String(mediaType).includes('image')
          ? 'image'
          : String(mediaType).includes('video')
          ? 'video'
          : 'post'
        : 'post'),
    created_at: p?.created_at ?? new Date().toISOString(),
  } as any;
};

/**
 * ✅ FIXED Normalize user:
 * - Accepts id OR user_id OR userId
 * - Prevents profile opening wrong user
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
  } as any;
};

/** ---------- API helper ---------- */
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  // If using JSON body, set content-type
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData) headers['Content-Type'] = (headers['Content-Type'] as string) || 'application/json';

  const response = await fetch(url, { ...options, headers });

  const contentType = response.headers.get('content-type') || '';
  let data: any;

  try {
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      } else {
        data = { error: text };
      }
    }
  } catch (e: any) {
    data = { error: e?.message || 'Failed to parse response' };
  }

  if (!response.ok) {
    const msg = data?.error || data?.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }

  return data;
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

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

export default function App() {
  useLanguage();

  /** ---------- State ---------- */
  const [users, setUsers] = useState<User[]>(INITIAL_USERS.map(normalizeUser));
  const [posts, setPosts] = useState<PostType[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'reels' | 'marketplace' | 'groups'>('home');
  const [view, setView] = useState<View>('home');
  const [isLoading, setIsLoading] = useState(true);
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

  /** ---------- Derived ---------- */
  const rankedPosts = useMemo(
    () => (Array.isArray(posts) ? rankFeed(posts, currentUser, users) : []),
    [posts, currentUser, users]
  );

  const activePost = useMemo(() => {
    if (!activeCommentsPostId) return null;
    return posts.find((p) => Number(p.id) === Number(activeCommentsPostId)) || null;
  }, [posts, activeCommentsPostId]);

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

  /** ---------- Fetch data ---------- */
  const fetchData = useCallback(async () => {
    try {
      const [p, s, r, pr, u, g, b, e] = await Promise.all([
        apiFetch('/api/posts').catch(() => []),
        apiFetch('/api/stories').catch(() => []),
        apiFetch('/api/reels').catch(() => []),
        apiFetch('/api/products').catch(() => []),
        apiFetch('/api/users').catch(() => INITIAL_USERS),
        apiFetch('/api/groups').catch(() => []),
        apiFetch('/api/brands').catch(() => []),
        apiFetch('/api/events').catch(() => []),
      ]);

      setPosts(safeArray(p).map(normalizePost));
      setStories(safeArray(s));
      setReels(safeArray(r));
      setProducts(safeArray(pr));

      const normalizedUsers = safeArray(u).map(normalizeUser);
      setUsers(normalizedUsers.length ? normalizedUsers : INITIAL_USERS.map(normalizeUser));

      setGroups(safeArray(g));
      setBrands(safeArray(b));
      setEvents(safeArray(e));
    } finally {
      setTimeout(() => setIsLoading(false), 600);
    }
  }, []);

  /** ---------- Poll feed for near real-time ---------- */
  useEffect(() => {
    const t = setInterval(() => {
      fetchData().catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [fetchData]);

  /** ---------- Restore session ---------- */
  useEffect(() => {
    const init = async () => {
      try {
        const raw = localStorage.getItem(LS_USER_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const normalized = normalizeUser(saved);
          if (normalized?.id) {
            setCurrentUser(normalized);
            setUsers((prev) => {
              const arr = Array.isArray(prev) ? prev : [];
              const exists = arr.some((x) => Number(x.id) === Number(normalized.id));
              if (exists) return arr.map((x) => (Number(x.id) === Number(normalized.id) ? normalized : x));
              return [normalized, ...arr];
            });
          }
        }
      } catch {
        // ignore
      }

      await fetchData();
    };

    init();
  }, [fetchData]);

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
        const arr = Array.isArray(prev) ? prev : [];
        const exists = arr.some((x) => Number(x.id) === Number(normalized.id));
        if (exists) return arr.map((x) => (Number(x.id) === Number(normalized.id) ? normalized : x));
        return [normalized, ...arr];
      });

      setSelectedUserId(Number(normalized.id));
      setView('profile');
    } catch (error: any) {
      setLoginError(error?.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(LS_USER_KEY);
    setCurrentUser(null);
    setSelectedUserId(null);
    setView('home');
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

      // Upload strategy:
      // - If file exists, convert to data URL (works without a separate upload endpoint).
      //   Later you can replace with R2 upload endpoint and store real URL.
      let media_url: string | null = null;
      let media_type: string | null = null;

      if (file) {
        media_url = await fileToDataUrl(file);
        media_type = file.type || null;
      }

      const payload: any = {
        user_id: currentUser!.id,
        content: trimmed,
        media_url,
        media_type,
        visibility: meta?.visibility ?? 'public',
        // optional extras (your backend can ignore safely)
        location: meta?.location,
        feeling: meta?.feeling,
        tagged_users: meta?.taggedUsers,
        background: meta?.background,
        link_preview: meta?.linkPreview,
      };

      const data = await apiFetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // backend may return {success:true, post: {...}} or {post_id: ...}
      const newPostRaw = data?.post ?? { ...payload, id: data?.post_id ?? Date.now(), created_at: new Date().toISOString() };
      const normalized = normalizePost(newPostRaw);

      setPosts((prev) => [normalized, ...safeArray(prev)]);
      setShowCreatePostModal(false);
    },
    [currentUser, requireAuth]
  );

  const onReactPost = useCallback(
    async (postId: number, type: ReactionType) => {
      if (!requireAuth('Reacting')) return;

      // optimistic update
      setPosts((prev) =>
        safeArray(prev).map((p: any) => {
          if (Number(p.id) !== Number(postId)) return p;
          const reactions = safeArray(p.reactions);
          const existing = reactions.find((r: any) => Number(r.user_id) === Number(currentUser!.id));

          // toggle same reaction off; otherwise set/replace
          let next = reactions.filter((r: any) => Number(r.user_id) !== Number(currentUser!.id));
          if (!existing || existing.type !== type) {
            next = [...next, { user_id: currentUser!.id, type }];
          }
          return normalizePost({ ...p, reactions: next });
        })
      );

      try {
        await apiFetch(`/api/posts/${postId}/react`, {
          method: 'POST',
          body: JSON.stringify({ type }),
        });
      } catch (e) {
        // rollback by refetching post list (safest)
        fetchData().catch(() => {});
      }
    },
    [currentUser, requireAuth, fetchData]
  );

  const onSharePost = useCallback(
    async (postId: number) => {
      if (!requireAuth('Sharing')) return;

      // optimistic
      setPosts((prev) =>
        safeArray(prev).map((p: any) => (Number(p.id) === Number(postId) ? normalizePost({ ...p, shares: safeNumber(p.shares) + 1 }) : p))
      );

      try {
        await apiFetch(`/api/posts/${postId}/share`, { method: 'POST' });
      } catch {
        fetchData().catch(() => {});
      }
    },
    [requireAuth, fetchData]
  );

  const onOpenComments = (postId: number) => {
    if (!requireAuth('Commenting')) return;
    setActiveCommentsPostId(postId);
  };

  const deletePost = useCallback(
    async (postId: number) => {
      if (!requireAuth('Deleting posts')) return;

      // optimistic remove
      const prevPosts = posts;
      setPosts((prev) => safeArray(prev).filter((p) => Number(p.id) !== Number(postId)));

      try {
        await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
      } catch {
        setPosts(prevPosts);
      }
    },
    [requireAuth, posts]
  );

  const editPost = useCallback(
    async (postId: number, content: string) => {
      if (!requireAuth('Editing posts')) return;

      const trimmed = (content || '').trim();
      if (!trimmed) return;

      // optimistic
      const prevPosts = posts;
      setPosts((prev) =>
        safeArray(prev).map((p: any) => (Number(p.id) === Number(postId) ? normalizePost({ ...p, content: trimmed }) : p))
      );

      try {
        await apiFetch(`/api/posts/${postId}`, {
          method: 'PATCH',
          body: JSON.stringify({ content: trimmed }),
        });
      } catch {
        setPosts(prevPosts);
      }
    },
    [requireAuth, posts]
  );

  const followUser = useCallback(
    async (targetUserId: number) => {
      if (!requireAuth('Following')) return;
      if (!currentUser) return;
      if (Number(targetUserId) === Number(currentUser.id)) return;

      // Your special follow logic: BOTH users gain/lose a follower.
      // We implement it purely from UI state; backend should be the source of truth.
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

      // also update currentUser object so profile buttons calculate correctly
      setCurrentUser((prev) => (prev ? normalizeUser({ ...prev }) : prev));

      try {
        await apiFetch(`/api/users/${targetUserId}/follow`, { method: 'POST' });
        // refresh to match backend truth
        fetchData().catch(() => {});
      } catch {
        fetchData().catch(() => {});
      }
    },
    [requireAuth, currentUser, fetchData]
  );

  const updateUserDetails = useCallback(
    async (data: Partial<User>) => {
      if (!requireAuth('Updating profile')) return;
      if (!currentUser) return;

      const payload: any = { ...data };

      const updated = await apiFetch(`/api/users/${currentUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      const normalized = normalizeUser(updated?.user ?? updated);
      setCurrentUser(normalized);

      localStorage.setItem(LS_USER_KEY, JSON.stringify(normalized));

      setUsers((prev) =>
        safeArray(prev).map((u) => (Number(u.id) === Number(normalized.id) ? normalized : u))
      );
    },
    [requireAuth, currentUser]
  );

  const updateProfileImage = useCallback(
    async (file: File) => {
      if (!requireAuth('Updating profile')) return;
      if (!currentUser) return;

      const url = await fileToDataUrl(file);
      await updateUserDetails({ profile_image_url: url } as any);
    },
    [requireAuth, currentUser, updateUserDetails]
  );

  const updateCoverImage = useCallback(
    async (file: File) => {
      if (!requireAuth('Updating profile')) return;
      if (!currentUser) return;

      const url = await fileToDataUrl(file);
      await updateUserDetails({ cover_image_url: url } as any);
    },
    [requireAuth, currentUser, updateUserDetails]
  );

  /** ---------- Render ---------- */
  if (isLoading) return <ProfessionalLoader />;

  const profileUser =
    (selectedUserId ? users.find((u) => Number(u.id) === Number(selectedUserId)) : null) ||
    currentUser ||
    users[0];

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

              {rankedPosts.length > 0 ? (
                rankedPosts.map((post) => (
                  <Post
                    key={post.id}
                    post={post}
                    author={
                      users.find((u) => Number(u.id) === Number((post as any).user_id)) ||
                      users[0] ||
                      INITIAL_USERS[0]
                    }
                    currentUser={currentUser}
                    onProfileClick={(id) => openProfile(id)}
                    onReact={(postId: number, type: ReactionType) => onReactPost(postId, type)}
                    onShare={(postId: number) => onSharePost(postId)}
                    onViewImage={setFullScreenImage}
                    onOpenComments={(postId: number) => onOpenComments(postId)}
                    onVideoClick={(p: any) => {
                      setActiveReelId(p.id);
                      setView('reels');
                    }}
                    onPlayAudioTrack={setCurrentAudioTrack}
                  />
                ))
              ) : (
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
              onShare={() => requireAuth('Sharing')}
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
              onSharePost={() => requireAuth('Sharing')}
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
              onShare={() => requireAuth('Sharing')}
              onOpenComments={(id: any) => {
                if (!requireAuth('Commenting')) return;
                setActiveCommentsPostId(Number(id));
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
              onShare={() => requireAuth('Sharing')}
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
              onShare={(postId: number) => onSharePost(postId)}
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
          onClose={() => setActiveCommentsPostId(null)}
          onComment={() => {}}
          onLikeComment={() => {}}
          getCommentAuthor={(id) => users.find((u) => u.id === id)}
          onProfileClick={(id) => openProfile(id)}
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
