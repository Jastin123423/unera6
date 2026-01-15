// App.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Login, Register } from './components/Auth';
import { Header, Sidebar, RightSidebar } from './components/Layout';
import {
  CreatePost,
  Post,
  CommentsSheet,
  CreatePostModal,
  SuggestedProductsWidget,
} from './components/Feed';
import { StoryReel, CreateStoryModal } from './components/Story';
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

import {
  User,
  Post as PostType,
  Product,
  Reel,
  AudioTrack,
} from './types';

/**
 * =========================
 * FORCE LOADER OFF (Option B)
 * =========================
 * Keep ProfessionalLoader in code, but never show it.
 */
const FORCE_LOADER_OFF_FOREVER = true;

/**
 * =========================
 * SMALL HELPERS
 * =========================
 */
const safeUserId = (u: any) => Number(u?.id ?? u?.user_id ?? 0);

const normalizeUser = (raw: any): User => {
  const u: any = raw || {};
  const id = Number(u.id ?? u.user_id ?? 0);

  return {
    ...u,
    id,
    name: u.name ?? u.username ?? 'User',
    username: u.username ?? u.name ?? 'user',
    profile_image_url:
      u.profile_image_url ||
      u.profileImage ||
      u.avatar ||
      'https://ui-avatars.com/api/?name=User',
  } as User;
};

const readStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed) return null;
    return normalizeUser(parsed);
  } catch {
    return null;
  }
};

const readToken = (): string | null => {
  try {
    return localStorage.getItem('unera_token');
  } catch {
    return null;
  }
};

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = readToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  let data: any = null;

  try {
    if (contentType.includes('application/json')) data = await res.json();
    else data = await res.text();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `API Error (${res.status})`;
    throw new Error(msg);
  }

  return data;
};

type Page =
  | 'home'
  | 'profile'
  | 'reels'
  | 'marketplace'
  | 'groups'
  | 'events'
  | 'birthdays'
  | 'memories'
  | 'brands'
  | 'tools'
  | 'settings'
  | 'support'
  | 'suggested_profiles';

export default function App() {
  // ✅ loader forced off forever
  const [isLoading] = useState(false);

  // Auth state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(() => readStoredUser());

  // Global data caches (lightweight)
  const [users, setUsers] = useState<User[]>(() => (currentUser ? [currentUser] : []));
  const [selectedUserId, setSelectedUserId] = useState<number | null>(
    currentUser ? safeUserId(currentUser) : null
  );

  // Navigation
  const [page, setPage] = useState<Page>('home');

  // Modals / viewers
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

  // Reels / Audio
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);
  const [activeTrack, setActiveTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Marketplace
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  // Stories
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);

  // Events
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);

  /**
   * =========================
   * SESSION BOOTSTRAP
   * =========================
   * Ensures user stays logged in (localStorage based).
   */
  useEffect(() => {
    const stored = readStoredUser();
    if (stored) {
      setCurrentUser(stored);
      setSelectedUserId(safeUserId(stored));
      setUsers((prev) => {
        const map = new Map<number, User>();
        (prev || []).forEach((u) => map.set(safeUserId(u), normalizeUser(u)));
        map.set(safeUserId(stored), stored);
        return Array.from(map.values());
      });
    }
  }, []);

  /**
   * =========================
   * OPTIONAL: Refresh "me" from backend
   * (safe, will not break if endpoint missing)
   * =========================
   */
  const refreshMe = useCallback(async () => {
    if (!currentUser) return;
    try {
      // If you have /api/users/me, this keeps profile accurate.
      const me = await apiFetch('/api/users/me');
      if (me) {
        const normalized = normalizeUser(me?.user ?? me);
        setCurrentUser(normalized);
        localStorage.setItem('user', JSON.stringify(normalized));
        setUsers((prev) => {
          const map = new Map<number, User>();
          (prev || []).forEach((u) => map.set(safeUserId(u), normalizeUser(u)));
          map.set(safeUserId(normalized), normalized);
          return Array.from(map.values());
        });
      }
    } catch {
      // ignore (endpoint may not exist yet)
    }
  }, [currentUser]);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  /**
   * =========================
   * AUTH HANDLERS
   * =========================
   */
  const handleLoginSuccess = useCallback((payload: any) => {
    // payload expected: { user, token? } OR { user: {...}, session: {...} }
    const u = normalizeUser(payload?.user ?? payload);
    setCurrentUser(u);
    setSelectedUserId(safeUserId(u));
    setPage('home');

    try {
      localStorage.setItem('user', JSON.stringify(u));
      const token = payload?.token || payload?.access_token || payload?.session?.token || null;
      if (token) localStorage.setItem('unera_token', String(token));
    } catch {}

    setUsers((prev) => {
      const map = new Map<number, User>();
      (prev || []).forEach((x) => map.set(safeUserId(x), normalizeUser(x)));
      map.set(safeUserId(u), u);
      return Array.from(map.values());
    });
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setSelectedUserId(null);
    setUsers([]);
    setPage('home');
    setAuthMode('login');

    try {
      localStorage.removeItem('user');
      localStorage.removeItem('unera_token');
    } catch {}
  }, []);

  /**
   * =========================
   * NAV + PROFILE
   * =========================
   */
  const handleProfileClick = useCallback(
    (id: number) => {
      const uid = Number(id);
      if (!Number.isFinite(uid) || uid <= 0) return;
      setSelectedUserId(uid);
      setPage('profile');
    },
    [setSelectedUserId, setPage]
  );

  /**
   * =========================
   * VIEW IMAGE
   * =========================
   */
  const onViewImage = useCallback((url: string) => {
    if (!url) return;
    setViewImageUrl(url);
  }, []);

  /**
   * =========================
   * AUDIO
   * =========================
   */
  const onPlayAudioTrack = useCallback((t: AudioTrack) => {
    setActiveTrack(t);
    setIsPlaying(true);
  }, []);

  const onTogglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const onClosePlayer = useCallback(() => {
    setIsPlaying(false);
    setActiveTrack(null);
  }, []);

  const onNextTrack = useCallback(() => {
    // If you have a real playlist, wire it here.
    // Keeping safe no-op to prevent crashes.
  }, []);

  const onPrevTrack = useCallback(() => {
    // no-op safe
  }, []);

  /**
   * =========================
   * RENDER GUARDS
   * =========================
   */
  if (!FORCE_LOADER_OFF_FOREVER && isLoading) {
    return <ProfessionalLoader />;
  }

  const isAuthed = !!currentUser;

  /**
   * =========================
   * AUTH SCREENS (when logged out)
   * =========================
   */
  if (!isAuthed) {
    return authMode === 'login' ? (
      <Login
        onSwitchToRegister={() => setAuthMode('register')}
        onLoginSuccess={handleLoginSuccess}
      />
    ) : (
      <Register
        onSwitchToLogin={() => setAuthMode('login')}
        onRegisterSuccess={(payload: any) => {
          // You can either auto-login here, or go to login screen.
          // We'll auto-login if backend returns user.
          if (payload?.user || payload?.id) {
            handleLoginSuccess(payload);
          } else {
            setAuthMode('login');
          }
        }}
      />
    );
  }

  /**
   * =========================
   * MAIN APP LAYOUT
   * =========================
   */
  return (
    <div className="min-h-screen bg-[#18191A] text-white">
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        onNavigate={(key: string) => {
          // Header nav mapping (safe)
          if (key === 'home') setPage('home');
          if (key === 'profile') {
            setSelectedUserId(safeUserId(currentUser));
            setPage('profile');
          }
          if (key === 'reels') setPage('reels');
          if (key === 'marketplace') setPage('marketplace');
          if (key === 'groups') setPage('groups');
          if (key === 'settings') setPage('settings');
        }}
      />

      <div className="max-w-[1400px] mx-auto px-2 md:px-4 flex gap-4">
        <Sidebar
          currentUser={currentUser}
          activePage={page}
          onNavigate={(p: any) => {
            setPage(p as Page);
            if (p === 'profile') setSelectedUserId(safeUserId(currentUser));
          }}
        />

        <main className="flex-1 py-4 min-w-0">
          {page === 'home' && (
            <>
              <StoryReel
                currentUser={currentUser}
                users={users}
                onCreateStory={() => setIsCreateStoryOpen(true)}
                onProfileClick={handleProfileClick}
              />

              {/* ✅ Feed handles its own fetching + stable comments */}
              <div className="mt-4">
                {/* Feed default export is the API-connected feed container in your Feed.tsx */}
                {/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
                {React.createElement(require('./components/Feed').default, {
                  currentUser,
                  users,
                  onProfileClick: handleProfileClick,
                })}
              </div>
            </>
          )}

          {page === 'profile' && selectedUserId != null && (
            <UserProfile
              currentUser={currentUser}
              users={users}
              userId={selectedUserId}
              onBack={() => setPage('home')}
              onProfileClick={handleProfileClick}
              onViewImage={onViewImage}
              onPlayAudioTrack={onPlayAudioTrack}
              onUsersUpdate={(nextUsers: User[]) => {
                setUsers((prev) => {
                  const map = new Map<number, User>();
                  (prev || []).forEach((u) => map.set(safeUserId(u), normalizeUser(u)));
                  (nextUsers || []).forEach((u) => map.set(safeUserId(u), normalizeUser(u)));
                  return Array.from(map.values());
                });
              }}
              onMeUpdate={(partial: Partial<User>) => {
                if (!currentUser) return;
                const merged = normalizeUser({ ...currentUser, ...partial });
                setCurrentUser(merged);
                localStorage.setItem('user', JSON.stringify(merged));
                setUsers((prev) => {
                  const map = new Map<number, User>();
                  (prev || []).forEach((u) => map.set(safeUserId(u), normalizeUser(u)));
                  map.set(safeUserId(merged), merged);
                  return Array.from(map.values());
                });
              }}
            />
          )}

          {page === 'reels' && (
            <ReelsFeed
              currentUser={currentUser}
              users={users}
              onProfileClick={handleProfileClick}
              onCreateReel={() => setIsCreateReelOpen(true)}
              onPlayAudioTrack={onPlayAudioTrack}
            />
          )}

          {page === 'marketplace' && (
            <MarketplacePage
              currentUser={currentUser}
              users={users}
              onProfileClick={handleProfileClick}
              onViewProduct={(p: Product) => setActiveProduct(p)}
              onViewImage={onViewImage}
            />
          )}

          {page === 'groups' && (
            <GroupsPage
              currentUser={currentUser}
              users={users}
              onProfileClick={handleProfileClick}
              onViewImage={onViewImage}
              onPlayAudioTrack={onPlayAudioTrack}
            />
          )}

          {page === 'events' && (
            <EventsPage
              currentUser={currentUser}
              users={users}
              onCreateEvent={() => setIsCreateEventOpen(true)}
              onProfileClick={handleProfileClick}
            />
          )}

          {page === 'birthdays' && (
            <BirthdaysPage currentUser={currentUser} users={users} />
          )}

          {page === 'memories' && (
            <MemoriesPage currentUser={currentUser} users={users} />
          )}

          {page === 'brands' && (
            <BrandsPage currentUser={currentUser} users={users} onProfileClick={handleProfileClick} />
          )}

          {page === 'tools' && <ToolsPage currentUser={currentUser} />}

          {page === 'settings' && (
            <SettingsPage currentUser={currentUser} onLogout={handleLogout} />
          )}

          {page === 'support' && <HelpSupportPage currentUser={currentUser} />}

          {page === 'suggested_profiles' && (
            <SuggestedProfilesPage currentUser={currentUser} users={users} onProfileClick={handleProfileClick} />
          )}
        </main>

        <RightSidebar
          currentUser={currentUser}
          users={users}
          onProfileClick={handleProfileClick}
          onCreateEvent={() => setIsCreateEventOpen(true)}
          onNavigate={(p: any) => setPage(p as Page)}
        />
      </div>

      {/* =========================
          MODALS / OVERLAYS
         ========================= */}
      {viewImageUrl && (
        <ImageViewer url={viewImageUrl} onClose={() => setViewImageUrl(null)} />
      )}

      {activeProduct && (
        <ProductDetailModal
          product={activeProduct}
          currentUser={currentUser}
          users={users}
          onClose={() => setActiveProduct(null)}
          onProfileClick={handleProfileClick}
          onViewImage={onViewImage}
        />
      )}

      {isCreateReelOpen && (
        <CreateReelModal
          currentUser={currentUser}
          users={users}
          onClose={() => setIsCreateReelOpen(false)}
          onCreated={() => {
            setIsCreateReelOpen(false);
            // ReelsFeed should refetch internally if needed
          }}
        />
      )}

      {isCreateStoryOpen && (
        <CreateStoryModal
          currentUser={currentUser}
          users={users}
          onClose={() => setIsCreateStoryOpen(false)}
          onCreated={() => {
            setIsCreateStoryOpen(false);
            // StoryReel should refetch internally if needed
          }}
        />
      )}

      {isCreateEventOpen && (
        <CreateEventModal
          currentUser={currentUser}
          onClose={() => setIsCreateEventOpen(false)}
          onCreated={() => setIsCreateEventOpen(false)}
        />
      )}

      {/* Global Audio Player */}
      <GlobalAudioPlayer
        currentTrack={activeTrack}
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay}
        onNext={onNextTrack}
        onPrevious={onPrevTrack}
        onClose={onClosePlayer}
        onDownload={(id: string) => {
          // keep safe
          alert('Download coming soon');
        }}
        onLike={(id: string) => {
          // keep safe
          alert('Liked');
        }}
        uploaderProfile={null}
        isLiked={false}
      />

      {/* Music System full page modal/section if you use it */}
      {/* You can open MusicSystem from Tools or its own page if needed */}
      <div className="hidden">
        <MusicSystem
          currentUser={currentUser}
          onProfileClick={handleProfileClick}
          onPlayAudioTrack={onPlayAudioTrack}
        />
      </div>
    </div>
  );
}
