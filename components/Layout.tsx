// Layout.tsx
import React, { useState, useEffect, useRef } from 'react';
import { User, Notification } from '../types';
import { NotificationDropdown } from './Notifications';
import { useNavigate } from 'react-router-dom';

/* ============================================================
   GLOBAL ONLINE PRESENCE
============================================================ */
const sendHeartbeat = async (userId: number) => {
  const token = localStorage.getItem('unera_token');

  try {
    await fetch('/api/presence/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'x-user-id': String(userId),
      },
      body: JSON.stringify({ user_id: userId }),
    });
  } catch {
    // best effort
  }
};

interface MenuOverlayProps {
  currentUser: User | null;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onLogout: () => void;
}

export const MenuOverlay: React.FC<MenuOverlayProps> = ({
  currentUser,
  onClose,
  onNavigate,
  onLogout,
}) => {
  const navigate = useNavigate();

  const menuItems = [
    { id: 'marketplace', title: 'Marketplace', icon: 'fas fa-store', color: '#1877F2' },
    { id: 'events', title: 'Events', icon: 'fas fa-calendar-alt', color: '#F3425F' },
    { id: 'profiles', title: 'Profiles', icon: 'fas fa-user-friends', color: '#1877F2' },
    { id: 'groups', title: 'Groups', icon: 'fas fa-users', color: '#1877F2' },
    { id: 'music', title: 'UNERA Music', icon: 'fas fa-music', color: '#0055FF' },
    { id: 'tools', title: 'UNERA Tools', icon: 'fas fa-briefcase', color: '#2ABBA7' },
    { id: 'reels', title: 'Reels', icon: 'fas fa-clapperboard', color: '#E41E3F' },
    { id: 'birthdays', title: 'Birthdays', icon: 'fas fa-birthday-cake', color: '#F7B928' },
    { id: 'memories', title: 'Memories', icon: 'fas fa-history', color: '#1877F2' },
    { id: 'story-feed', title: 'Story Feed', icon: 'fas fa-layer-group', color: '#45BD62' },
    { id: 'notifications', title: 'Notifications', icon: 'fas fa-bell', color: '#E41E3F' },
    { id: 'ads', title: 'Ad Dashboard', icon: 'fas fa-chart-line', color: '#10B981' },
  ];

  const bottomItems = [
    { id: 'settings', title: 'Settings & Privacy', icon: 'fas fa-cog' },
    { 
      id: 'privacy', 
      title: 'Privacy Policy', 
      icon: 'fas fa-user-shield',
      route: '/privacy'
    },
    { id: 'help', title: 'Help & Support', icon: 'fas fa-question-circle' },
    { 
      id: 'terms', 
      title: 'Terms of Service', 
      icon: 'fas fa-file-alt',
      route: '/terms'
    },
  ];

  const handleMenuItemClick = (item: any) => {
    // If item has a route, navigate to it as a page
    if (item.route) {
      navigate(item.route);
      onClose();
      return;
    }
    
    // Otherwise use the existing navigation system
    onNavigate(item.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#18191A] animate-slide-down flex flex-col font-sans overflow-hidden">
      <div className="h-14 px-4 flex items-center justify-between border-b border-[#3E4042] bg-[#242526] shadow-sm flex-shrink-0">
        <h2 className="text-[24px] font-bold text-[#E4E6EB]">Menu</h2>

        <div
          onClick={onClose}
          className="w-9 h-9 bg-[#3A3B3C] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#4E4F50]"
        >
          <i className="fas fa-times text-[#E4E6EB] text-xl"></i>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-[#18191A]">
        {currentUser && (
          <div
            className="flex items-center gap-3 p-3 bg-[#242526] rounded-xl shadow-sm mb-4 cursor-pointer hover:bg-[#3A3B3C]"
            onClick={() => {
              onNavigate('profile');
              onClose();
            }}
          >
            <img
              src={currentUser.profile_image_url}
              alt={currentUser.name}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[#E4E6EB] text-lg truncate">{currentUser.name}</span>
              <span className="text-[#B0B3B8] text-sm">View your profile</span>
            </div>
          </div>
        )}

        <h3 className="text-[#E4E6EB] font-semibold text-[17px] mb-3 px-1">All shortcuts</h3>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className="bg-[#242526] rounded-xl p-4 shadow-sm flex flex-col gap-3 cursor-pointer hover:bg-[#3A3B3C] transition-colors"
              onClick={() => handleMenuItemClick(item)}
            >
              <i className={`${item.icon} text-[28px]`} style={{ color: item.color }}></i>
              <div>
                <h4 className="font-semibold text-[#E4E6EB] text-[16px] leading-tight mb-0.5">
                  {item.title}
                </h4>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[#3E4042] my-4"></div>

        <div className="flex flex-col gap-1">
          {bottomItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[#3A3B3C] cursor-pointer"
              onClick={() => handleMenuItemClick(item)}
            >
              <div className="flex items-center gap-3">
                <i className={`${item.icon} text-[#B0B3B8] text-xl w-6 text-center`}></i>
                <span className="text-[#E4E6EB] font-medium text-[16px]">{item.title}</span>
              </div>
              <i className="fas fa-chevron-right text-[#B0B3B8] text-sm"></i>
            </div>
          ))}

          <div
            className="flex items-center justify-between p-3 rounded-lg hover:bg-[#3A3B3C] cursor-pointer mt-2"
            onClick={onLogout}
          >
            <div className="flex items-center gap-3">
              <i className="fas fa-sign-out-alt text-[#E4E6EB] text-xl w-6 text-center"></i>
              <span className="text-[#E4E6EB] font-medium text-[16px]">Log Out</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== HEADER PROPS INTERFACE ====================
interface HeaderProps {
  onHomeClick: () => void;
  onProfileClick: (id: number) => void;
  onReelsClick: () => void;
  onMarketplaceClick: () => void;
  onGroupsClick: () => void;
  onAdsClick: () => void;
  onStoryFeedClick?: () => void;
  currentUser: User | null;
  notifications: Notification[];
  users: User[];
  onLogout: () => void;
  onLoginClick: () => void;
  onMarkNotificationsRead: () => void;
  activeTab: string;
  onNavigate: (view: string) => void;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  onOpenChatsList?: () => void;
  isChatsListOpen?: boolean;
  // ✅ ADDED: Badge counts for navigation items
  badgeCounts?: {
    home?: number;
    music?: number;
    messages?: number;
    reels?: number;
    notifications?: number;
    marketplace?: number;
  };
}

// ==================== HEADER COMPONENT ====================
export const Header: React.FC<HeaderProps> = ({
  onHomeClick,
  onProfileClick,
  onReelsClick,
  onMarketplaceClick,
  onGroupsClick,
  onAdsClick,
  onStoryFeedClick,
  currentUser,
  notifications,
  users,
  onLogout,
  onLoginClick,
  onMarkNotificationsRead,
  activeTab,
  onNavigate,
  setNotifications,
  onOpenChatsList,
  isChatsListOpen,
  badgeCounts, // ✅ ACCEPTED
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFullMenu, setShowFullMenu] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchOverlayRef = useRef<HTMLDivElement>(null);
  const presenceTimer = useRef<number | null>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // ✅ ADDED: Badge formatter helper
  const formatBadge = (value?: number) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return '';
    return n > 15 ? '15+' : String(n);
  };

  useEffect(() => {
    if (!currentUser) return;

    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications', {
          headers: {
            'x-user-id': String(currentUser.id),
          },
        });
        const data = await res.json();
        setNotifications(data);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);

    return () => clearInterval(interval);
  }, [currentUser, setNotifications]);

  useEffect(() => {
    const userId = Number(localStorage.getItem('unera_user_id') || 0);
    if (!userId || !currentUser) return;

    const heartbeat = () => sendHeartbeat(userId);

    heartbeat();

    presenceTimer.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        heartbeat();
      }
    }, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        heartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (presenceTimer.current) {
        clearInterval(presenceTimer.current);
        presenceTimer.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (searchOverlayRef.current && !searchOverlayRef.current.contains(event.target as Node)) {
        setShowSearchOverlay(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const scoredUsers = users
      .filter((u) => !currentUser || u.id !== currentUser.id)
      .map((user) => {
        let score = 0;
        if (String(user.name || '').toLowerCase().includes(lowerQuery)) score += 10;
        if (String((user as any).username || '').toLowerCase().includes(lowerQuery)) score += 7;
        return { user, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.user);

    setSearchResults(scoredUsers);
  };

  // Messages handler
  const goToMessages = () => {
    if (!currentUser) {
      onLoginClick();
      return;
    }
    setShowSearchOverlay(false);
    setSearchQuery('');
    setSearchResults([]);
    if (onOpenChatsList) {
      onOpenChatsList();
      return;
    }
    onNavigate('messages');
  };

  const goToMusic = () => {
    onNavigate('music');
  };

  const goToNotifications = () => {
    onNavigate('notifications');
    setShowNotifications(false);
  };

  const uneraBrand = (
    <div
      className="flex items-center gap-2 cursor-pointer select-none"
      onClick={onHomeClick}
      aria-label="UNERA"
    >
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1877F2] to-[#1D8AF2] flex items-center justify-center shadow-[0_0_14px_rgba(24,119,242,0.25)]">
        <i className="fas fa-globe-africa text-white text-[16px]"></i>
      </div>
      <span className="text-[24px] font-black bg-gradient-to-r from-[#1877F2] to-[#59A7FF] text-transparent bg-clip-text tracking-tight">
        UNERA
      </span>
    </div>
  );

  // ✅ UPDATED: navItems with badge counts from badgeCounts prop
  const navItems = [
    {
      id: 'home',
      icon: 'fas fa-home',
      label: 'Home',
      onClick: onHomeClick,
      active: activeTab === 'home',
      activeColor: '#1877F2',
      badge: Number(badgeCounts?.home || 0),
    },
    {
      id: 'music',
      icon: 'fas fa-music',
      label: 'Music',
      onClick: goToMusic,
      active: activeTab === 'music',
      activeColor: '#0055FF',
      badge: Number(badgeCounts?.music || 0),
    },
    {
      id: 'messages',
      icon: 'fab fa-facebook-messenger',
      label: 'Messages',
      onClick: goToMessages,
      active: activeTab === 'messages' || !!isChatsListOpen,
      activeColor: '#1877F2',
      badge: Number(badgeCounts?.messages || 0),
    },
    {
      id: 'reels',
      icon: 'fas fa-clapperboard',
      label: 'Reels',
      onClick: onReelsClick,
      active: activeTab === 'reels',
      activeColor: '#E41E3F',
      badge: Number(badgeCounts?.reels || 0),
    },
    {
      id: 'notifications',
      icon: 'fas fa-bell',
      label: 'Notifications',
      onClick: goToNotifications,
      active: activeTab === 'notifications',
      activeColor: '#E41E3F',
      badge: Number(badgeCounts?.notifications ?? unreadCount ?? 0),
    },
    {
      id: 'marketplace',
      icon: 'fas fa-store',
      label: 'Marketplace',
      onClick: onMarketplaceClick,
      active: activeTab === 'marketplace',
      activeColor: '#1877F2',
      badge: Number(badgeCounts?.marketplace || 0),
    },
  ];

  return (
    <>
      <div className="sticky top-0 z-50 bg-[#242526] border-b border-[#3E4042] shadow-sm">
        {/* ROW 1 */}
        <div className="h-14 px-3 sm:px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowFullMenu(true)}
              className="w-11 h-11 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] flex items-center justify-center transition-colors"
              aria-label="Menu"
            >
              <i className="fas fa-bars text-[20px]"></i>
            </button>

            <button
              onClick={() => setShowSearchOverlay(true)}
              className="w-11 h-11 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] flex items-center justify-center transition-colors"
              aria-label="Search"
            >
              <i className="fas fa-search text-[20px]"></i>
            </button>

            {currentUser ? (
              <button
                onClick={() => onNavigate('create')}
                className="w-11 h-11 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] flex items-center justify-center transition-colors"
                aria-label="Create"
              >
                <i className="fas fa-plus text-[22px]"></i>
              </button>
            ) : (
              <button
                onClick={onLoginClick}
                className="h-11 px-4 rounded-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold text-sm transition-colors"
              >
                Log In
              </button>
            )}
          </div>

          <div className="min-w-0 flex items-center justify-end">
            {uneraBrand}
          </div>
        </div>

        {/* ROW 2 */}
        <div className="h-14 px-1 sm:px-2 flex items-stretch justify-between border-t border-[#3E4042]">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`relative flex-1 h-full flex items-center justify-center transition-colors rounded-lg ${
                item.active ? '' : 'hover:bg-[#3A3B3C]'
              }`}
              aria-label={item.label}
            >
              <div
                className="flex items-center justify-center w-full h-full border-b-[3px]"
                style={{
                  borderBottomColor: item.active ? item.activeColor : 'transparent',
                  color: item.active ? item.activeColor : '#B0B3B8',
                }}
              >
                <i className={`${item.icon} text-[22px] sm:text-[24px]`}></i>
              </div>

              {/* ✅ UPDATED: Badge render with formatBadge helper */}
              {Number(item.badge || 0) > 0 && (
                <span className="absolute top-1.5 right-[18%] sm:right-[24%] bg-[#E41E3F] text-white text-[11px] font-bold px-1.5 py-[1px] rounded-full min-w-[18px] text-center leading-tight">
                  {formatBadge(item.badge)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH OVERLAY */}
      {showSearchOverlay && (
        <div className="fixed inset-0 z-[180] bg-black/60 backdrop-blur-sm">
          <div
            ref={searchOverlayRef}
            className="bg-[#242526] border-b border-[#3E4042] px-3 pt-3 pb-4 shadow-xl"
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowSearchOverlay(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="w-10 h-10 rounded-full bg-[#3A3B3C] text-[#E4E6EB] flex items-center justify-center"
              >
                <i className="fas fa-arrow-left"></i>
              </button>

              <div className="relative flex-1">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#B0B3B8]"></i>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search in UNERA"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-full py-3 pl-11 pr-11 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#B0B3B8] hover:text-[#E4E6EB]"
                  >
                    <i className="fas fa-times-circle"></i>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 text-xs text-[#B0B3B8] px-2">
              {searchQuery.trim()
                ? `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`
                : 'Search profiles on UNERA'}
            </div>

            {searchQuery.trim() && (
              <div className="mt-3 bg-[#18191A] rounded-2xl border border-[#3E4042] overflow-hidden max-h-[65vh] overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-3 hover:bg-[#242526] cursor-pointer border-b border-[#3E4042] last:border-0"
                      onClick={() => {
                        onProfileClick(user.id);
                        setShowSearchOverlay(false);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                    >
                      <img
                        src={user.profile_image_url}
                        alt={user.name}
                        className="w-11 h-11 rounded-full object-cover border border-[#3E4042]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[15px] text-[#E4E6EB] truncate">
                          {user.name}
                        </div>
                        {!!(user as any).username && (
                          <div className="text-[#B0B3B8] text-sm truncate">
                            @{(user as any).username}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-5 text-center text-[#B0B3B8] text-sm">No results found</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showNotifications && (
        <div ref={notifRef}>
          <NotificationDropdown
            notifications={notifications}
            users={users}
            onNotificationClick={(n) => {
              setShowNotifications(false);
              if ((n as any).post_id) onNavigate(`post-${(n as any).post_id}`);
              else if ((n as any).sender_id) onProfileClick((n as any).sender_id);
            }}
            onMarkAllRead={onMarkNotificationsRead}
          />
        </div>
      )}

      {currentUser && showProfileMenu && (
        <div
          ref={profileRef}
          className="fixed top-[58px] right-3 w-[300px] bg-[#242526] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-[#3E4042] z-[190] p-2"
        >
          <div
            className="flex items-center gap-3 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer mb-2"
            onClick={() => onProfileClick(currentUser.id)}
          >
            <img
              src={currentUser.profile_image_url}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
            <span className="font-semibold text-[17px] text-[#E4E6EB]">{currentUser.name}</span>
          </div>

          <div className="border-b border-[#3E4042] my-1"></div>

          <div
            className="flex items-center gap-3 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer"
            onClick={onLogout}
          >
            <div className="w-9 h-9 bg-[#3A3B3C] rounded-full flex items-center justify-center">
              <i className="fas fa-sign-out-alt text-[#E4E6EB]"></i>
            </div>
            <span className="font-medium text-[15px] text-[#E4E6EB]">Log Out</span>
          </div>
        </div>
      )}

      {showFullMenu && (
        <MenuOverlay
          currentUser={currentUser}
          onClose={() => setShowFullMenu(false)}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />
      )}
    </>
  );
};

// ==================== SIDEBAR COMPONENT ====================
interface SidebarProps {
  currentUser: User;
  onProfileClick: (id: number) => void;
  onReelsClick: () => void;
  onMarketplaceClick: () => void;
  onGroupsClick: () => void;
  onEventsClick: () => void;
  onAdsClick: () => void;
  onStoryFeedClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  onProfileClick,
  onReelsClick,
  onMarketplaceClick,
  onGroupsClick,
  onEventsClick,
  onAdsClick,
  onStoryFeedClick,
}) => {
  const items = [
    { id: 'friends', label: 'Friends', icon: 'fas fa-user-friends', color: '#1877F2' },
    { id: 'memories', label: 'Memories', icon: 'fas fa-history', color: '#1877F2' },
    { id: 'saved', label: 'Saved', icon: 'fas fa-bookmark', color: '#B250B3' },
    { id: 'story-feed', label: 'Story Feed', icon: 'fas fa-layer-group', color: '#45BD62', onClick: onStoryFeedClick },
    { id: 'groups', label: 'Groups', icon: 'fas fa-users', color: '#1877F2', onClick: onGroupsClick },
    { id: 'marketplace', label: 'Marketplace', icon: 'fas fa-store', color: '#1877F2', onClick: onMarketplaceClick },
    { id: 'reels', label: 'Reels', icon: 'fas fa-clapperboard', color: '#E41E3F', onClick: onReelsClick },
    { id: 'events', label: 'Events', icon: 'fas fa-calendar-alt', color: '#F3425F', onClick: onEventsClick },
    { id: 'ads', label: 'Ad Dashboard', icon: 'fas fa-chart-line', color: '#10B981', onClick: onAdsClick },
  ];

  return (
    <div className="w-[300px] h-full overflow-y-auto px-2 pt-4 bg-[#18191A] hidden lg:block scrollbar-hide">
      <div
        className="flex items-center gap-3 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors mb-2"
        onClick={() => onProfileClick(currentUser.id)}
      >
        <img src={currentUser.profile_image_url} alt="" className="w-9 h-9 rounded-full object-cover" />
        <span className="text-[#E4E6EB] font-semibold text-[15px]">{currentUser.name}</span>
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer mb-1"
          onClick={item.onClick}
        >
          <div className="w-9 h-9 flex items-center justify-center">
            <i className={`${item.icon} text-[22px]`} style={{ color: item.color }}></i>
          </div>
          <span className="text-[#E4E6EB] font-semibold text-[15px]">{item.label}</span>
        </div>
      ))}

      <div className="border-t border-[#3E4042] my-4 mx-2"></div>
      <div className="px-4 text-[#B0B3B8] text-[13px] leading-tight">
        <p>UNERA © 2025</p>
      </div>
    </div>
  );
};

// ==================== RIGHT SIDEBAR COMPONENT ====================
export const RightSidebar: React.FC<{
  contacts: User[];
  onProfileClick: (id: number) => void;
}> = ({ contacts, onProfileClick }) => {
  return (
    <div className="w-[280px] h-full overflow-y-auto pt-4 pr-2 bg-[#18191A] hidden xl:block scrollbar-hide">
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-[#B0B3B8] font-bold text-[17px]">Contacts</span>
      </div>

      <div className="space-y-1">
        {contacts.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-3 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors relative"
            onClick={() => onProfileClick(user.id)}
          >
            <div className="relative">
              <img
                src={user.profile_image_url}
                alt=""
                className="w-9 h-9 rounded-full object-cover border border-[#3E4042]"
              />
              {(user as any).is_online && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#31A24C] rounded-full border-2 border-[#18191A]"></div>
              )}
            </div>

            <span className="text-[#E4E6EB] font-semibold text-[15px]">{user.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
