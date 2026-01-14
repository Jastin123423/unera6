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
 * This is the #1 fix when enabling posts.ts causes blank screen.
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

    // Critical: ensure arrays exist
    reactions: safeArray(p?.reactions),
    comments: safeArray(p?.comments),

    // Critical: ensure numbers exist
    shares: safeNumber(p?.shares),
    views: safeNumber(p?.views),

    // Optional shape fields many UIs rely on
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
 * Normalize user so followers/following arrays exist (prevents crashes in UserProfile and others)
 */
const normalizeUser = (u: any): User => {
  return {
    ...u,
    id: safeNumber(u?.id),
    name: safeString(u?.name, safeString(u?.username, 'User')),
    followers: safeArray<number>(u?.followers),
    following: safeArray<number>(u?.following),
    profile_image_url: u?.profile_image_url ?? u?.avatar_url ?? '',
    cover_image_url: u?.cover_image_url ?? '',
  } as any;
};

/** ---------- API helper ---------- */
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('unera_token');

  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

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

export default function App() {
  const { t } = useLanguage();

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
    return posts.find((p) => p.id === activeCommentsPostId) || null;
  }, [posts, activeCommentsPostId]);

  /** ---------- Facebook logic: guests can browse, but cannot interact ---------- */
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
    setSelectedUserId(id);
    setView('profile');
    window.scrollTo(0, 0);
  }, []);

  /** ---------- Data fetching (normalized to prevent crashes) ---------- */
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

      // Normalize EVERYTHING that can crash the UI
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
      setTimeout(() => setIsLoading(false), 1200);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('unera_token');
      if (token) {
        try {
          const me = await apiFetch('/api/users/me');
          if (me && me.id) setCurrentUser(normalizeUser(me));
        } catch {
          localStorage.removeItem('unera_token');
        }
      }
      await fetchData();
    };
    init();
  }, [fetchData]);

  /** ---------- Auth ---------- */
  const handleLogin = async (email: string, pass: string) => {
    try {
      const data = await apiFetch('/api/users/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass }),
      });

      if (data?.token) localStorage.setItem('unera_token', data.token);

      const normalized = data?.user ? normalizeUser(data.user) : null;
      setCurrentUser(normalized);
      setLoginError('');
      setView('home');
    } catch (error: any) {
      setLoginError(error?.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('unera_token');
    setCurrentUser(null);
    setView('home'); // FB-like browsing after logout
  };

  /** ---------- Navigation ---------- */
  const handleNavigate = (target: View) => {
    // Guests can browse most pages; protect user-private pages
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

  /** ---------- Interaction stubs (blocked for guests) ---------- */
  const onReactPost = async (postId: number, type: ReactionType) => {
    if (!requireAuth('Reacting')) return;
    // TODO: call reaction API
  };

  const onSharePost = async (postId: number) => {
    if (!requireAuth('Sharing')) return;
    // TODO
  };

  const onOpenComments = (postId: number) => {
    // In your UI, commenting is a restricted action; so login required
    if (!requireAuth('Commenting')) return;
    setActiveCommentsPostId(postId);
  };

  /** ---------- Render ---------- */
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

              {rankedPosts.length > 0 ? (
                rankedPosts.map((post) => (
                  <Post
                    key={post.id}
                    post={post}
                    author={users.find((u) => u.id === (post as any).user_id) || users[0] || INITIAL_USERS[0]}
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
              onFollow={() => requireAuth('Following')}
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
              onFollow={() => requireAuth('Following')}
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

          {view === 'profile' && selectedUserId && (
            <UserProfile
              user={users.find((u) => u.id === selectedUserId) || INITIAL_USERS.map(normalizeUser)[0]}
              currentUser={currentUser}
              users={users}
              posts={posts}
              reels={reels}
              onProfileClick={(id) => openProfile(id)}
              onFollow={() => requireAuth('Following')}
              onReact={(postId, type) => onReactPost(postId, type)}
              onComment={() => requireAuth('Commenting')}
              onShare={(postId) => onSharePost(postId)}
              onMessage={(id) => {
                if (!requireAuth('Messaging')) return;
                setActiveChatUser(users.find((u) => u.id === id) || null);
              }}
              onCreatePost={() => requireAuth('Creating posts')}
              onUpdateProfileImage={() => requireAuth('Updating profile')}
              onUpdateCoverImage={() => requireAuth('Updating profile')}
              onUpdateUserDetails={() => requireAuth('Updating profile')}
              onDeletePost={() => requireAuth('Deleting posts')}
              onEditPost={() => requireAuth('Editing posts')}
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
          onCreatePost={() => {}}
        />
      )}

      {activePost && currentUser && (
        <CommentsSheet
          post={activePost}
          currentUser={currentUser}
          users={users}
          onClose={() => setActiveCommentsPostId(null)}
          onComment={() => requireAuth('Commenting')}
          onLikeComment={() => requireAuth('Liking')}
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
