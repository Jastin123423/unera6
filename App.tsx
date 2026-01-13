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
} from './types';
import { INITIAL_USERS } from './constants';
import { rankFeed } from './utils/ranking';

/**
 * API helpers
 * - Uses relative URLs like /api/posts for Cloudflare Pages Functions: functions/api/posts.ts
 * - Always attempts to parse JSON even if server returns text/html by mistake
 */
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
  let data: any = null;

  try {
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      // Some backends mistakenly return JSON with text/plain
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
  | 'register'
  | 'forgot_password'; // reserved if you add it back later

export default function App() {
  const { t } = useLanguage();

  // Data
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  // UI/Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'reels' | 'marketplace' | 'groups'>('home');
  const [view, setView] = useState<View>('home');
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState('');

  // Selection state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeReelId, setActiveReelId] = useState<number | null>(null);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
  const [activeChatUser, setActiveChatUser] = useState<User | null>(null); // kept for future
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [activeStory, setActiveStory] = useState<Story | null>(null); // kept for future
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  // Modals
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);
  const [showCreateReelModal, setShowCreateReelModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);

  // Audio
  const [currentAudioTrack, setCurrentAudioTrack] = useState<AudioTrack | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  /**
   * Facebook logic:
   * - Guests can browse EVERYTHING (home, profiles, groups, brands, marketplace, reels, etc)
   * - Guests cannot perform actions: like, comment, share, follow, join, create, post, message, etc.
   * - On any blocked action -> redirect to login (or open login view), keeping their browsing intact.
   */
  const requireAuth = useCallback(
    (actionName = 'This action') => {
      if (currentUser) return true;
      // Optional: you can set a nicer UI message somewhere.
      setLoginError(`${actionName} requires login.`);
      setView('login');
      return false;
    },
    [currentUser]
  );

  const rankedPosts = useMemo(
    () => (Array.isArray(posts) ? rankFeed(posts, currentUser, users) : []),
    [posts, currentUser, users]
  );

  // Avoid crashes in CommentsSheet (never use ! on find result)
  const activePost = useMemo(() => {
    if (!activeCommentsPostId) return null;
    return posts.find((p) => p.id === activeCommentsPostId) || null;
  }, [posts, activeCommentsPostId]);

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

      setPosts(Array.isArray(p) ? p : []);
      setStories(Array.isArray(s) ? s : []);
      setReels(Array.isArray(r) ? r : []);
      setProducts(Array.isArray(pr) ? pr : []);
      setUsers(Array.isArray(u) ? u : INITIAL_USERS);
      setGroups(Array.isArray(g) ? g : []);
      setBrands(Array.isArray(b) ? b : []);
      setEvents(Array.isArray(e) ? e : []);
    } finally {
      // keep your smooth loader behavior
      setTimeout(() => setIsLoading(false), 1200);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('unera_token');
      if (token) {
        try {
          const userData = await apiFetch('/api/users/me');
          if (userData && userData.id) setCurrentUser(userData);
        } catch {
          localStorage.removeItem('unera_token');
        }
      }
      await fetchData();
    };
    initAuth();
  }, [fetchData]);

  // Auth handlers
  const handleLogin = async (email: string, pass: string) => {
    try {
      const data = await apiFetch('/api/users/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass }),
      });
      if (data?.token) localStorage.setItem('unera_token', data.token);
      setCurrentUser(data?.user || null);
      setLoginError('');
      setView('home');
    } catch (error: any) {
      setLoginError(error?.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('unera_token');
    setCurrentUser(null);
    setView('home'); // FB-like: logout returns to browsing
  };

  const handleNavigate = (target: View) => {
    // Guest can browse all pages; only block user-specific "settings/memories" like FB.
    if (['settings', 'memories'].includes(target) && !currentUser) {
      setLoginError(`Please login to view ${target}.`);
      return setView('login');
    }

    if (target === 'profile') {
      // profile without id -> go to own profile if logged in, else login
      if (!currentUser) {
        setLoginError('Please login to view your profile.');
        return setView('login');
      }
      setSelectedUserId(currentUser.id);
      setView('profile');
    } else {
      setView(target);
    }

    if (['home', 'reels', 'marketplace', 'groups'].includes(target)) {
      setActiveTab(target as any);
    }
    window.scrollTo(0, 0);
  };

  // Action stubs (wire your real APIs later)
  const onReactPost = async () => {
    if (!requireAuth('Reacting')) return;
    // TODO: call /api/post-reactions (or your endpoint)
  };

  const onSharePost = async () => {
    if (!requireAuth('Sharing')) return;
    // TODO
  };

  const onOpenComments = (postId: number) => {
    // Viewing comments is allowed (guest can read), but your CommentsSheet currently requires currentUser.
    // Facebook allows reading comments too, but you designed CommentsSheet needing currentUser.
    // So: if guest tries to open comments, take them to login (as requested: can't like/comment).
    if (!currentUser) return requireAuth('Commenting');
    setActiveCommentsPostId(postId);
  };

  const onCreatePostClick = () => {
    if (!requireAuth('Creating posts')) return;
    setShowCreatePostModal(true);
  };

  const onCreateStoryClick = () => {
    if (!requireAuth('Creating stories')) return;
    setShowCreateStoryModal(true);
  };

  const onCreateReelClick = () => {
    if (!requireAuth('Creating reels')) return;
    setShowCreateReelModal(true);
  };

  const onCreateEventClick = () => {
    if (!requireAuth('Creating events')) return;
    setShowCreateEventModal(true);
  };

  // Optional: allow guest to view profile pages by clicking user
  const openProfile = (id: number) => {
    setSelectedUserId(id);
    setView('profile');
    window.scrollTo(0, 0);
  };

  if (isLoading) return <ProfessionalLoader />;

  return (
    <div className="bg-[#18191A] min-h-screen flex flex-col font-sans">
      <Header
        onHomeClick={() => handleNavigate('home')}
        onProfileClick={(id) => {
          // Header profile click should open that profile even for guests
          openProfile(id);
        }}
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
        {/* Facebook-like: sidebar is visible only when logged in (you can change if you want) */}
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
                onCreateStory={onCreateStoryClick}
                onViewStory={(s) => setActiveStory(s)}
                currentUser={currentUser}
                onRequestLogin={() => setView('login')}
              />

              {/* Guest can browse, but cannot create */}
              {currentUser && (
                <CreatePost
                  currentUser={currentUser}
                  onProfileClick={(id) => openProfile(id)}
                  onClick={() => onCreatePostClick()}
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
                    author={users.find((u) => u.id === post.user_id) || INITIAL_USERS[0]}
                    currentUser={currentUser}
                    onProfileClick={(id) => openProfile(id)}
                    onReact={onReactPost}
                    onShare={onSharePost}
                    onViewImage={setFullScreenImage}
                    onOpenComments={onOpenComments}
                    onVideoClick={(p) => {
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
              onCreateReelClick={onCreateReelClick}
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
                // Some components pass postId here; keep flexible
                if (!currentUser) return requireAuth('Commenting');
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
              onCreateEventClick={onCreateEventClick}
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
              user={users.find((u) => u.id === selectedUserId) || INITIAL_USERS[0]}
              currentUser={currentUser}
              users={users}
              posts={posts}
              onProfileClick={(id) => openProfile(id)}
              onFollow={() => requireAuth('Following')}
              onReact={() => requireAuth('Reacting')}
              onComment={() => requireAuth('Commenting')}
              onShare={() => requireAuth('Sharing')}
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
              onOpenComments={(id) => onOpenComments(id)}
              onVideoClick={() => {}}
              onPlayAudioTrack={setCurrentAudioTrack}
            />
          )}

          {view === 'login' && (
            <Login
              onLogin={handleLogin}
              onNavigateToRegister={() => setView('register')}
              onNavigateToForgotPassword={() => setView('forgot_password')}
              onClose={() => setView('home')}
              error={loginError}
            />
          )}

          {view === 'register' && (
            <Register onRegister={() => {}} onBackToLogin={() => setView('login')} />
          )}

          {/* If you add ForgotPassword component again, wire it here */}
          {view === 'forgot_password' && (
            <div className="p-6 text-[#E4E6EB]">
              <div className="bg-[#242526] rounded-xl p-5">
                <h2 className="text-lg font-semibold mb-2">{t('Forgot Password')}</h2>
                <p className="text-[#B0B3B8]">
                  You haven’t connected password reset UI here yet. For now, please login or create a new
                  account.
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    className="px-4 py-2 rounded-lg bg-[#3A3B3C] text-white"
                    onClick={() => setView('login')}
                  >
                    Back to Login
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-[#2D88FF] text-white"
                    onClick={() => setView('register')}
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </div>
          )}
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
        <CreateEventModal
          currentUser={currentUser}
          onClose={() => setShowCreateEventModal(false)}
          onCreate={() => {}}
        />
      )}

      {showCreatePostModal && currentUser && (
        <CreatePostModal
          currentUser={currentUser}
          users={users}
          onClose={() => setShowCreatePostModal(false)}
          onCreatePost={() => {}}
        />
      )}

      {/* Comments: only when logged in, and only if activePost exists */}
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
          onDownload={() => {
            // downloading can be allowed for guests if you want; keep it open
          }}
          onLike={() => requireAuth('Liking')}
          isLiked={false}
        />
      )}

      {fullScreenImage && <ImageViewer imageUrl={fullScreenImage} onClose={() => setFullScreenImage(null)} />}

      {/* Create Story / Reel modals can be added back when you wire their components */}
      {showCreateStoryModal && currentUser && (
        <CreateStoryModal
          currentUser={currentUser}
          onClose={() => setShowCreateStoryModal(false)}
          onCreate={() => {}}
        />
      )}

      {showCreateReelModal && currentUser && (
        <CreateReelModal
          currentUser={currentUser}
          onClose={() => setShowCreateReelModal(false)}
          onCreate={() => {}}
        />
      )}
    </div>
  );
}
