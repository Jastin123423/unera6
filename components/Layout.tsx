import React, { useState, useEffect, useRef } from 'react';
import { User, Notification } from '../types';
import { NotificationDropdown } from './Notifications';

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
    { id: 'notifications', title: 'Notifications', icon: 'fas fa-bell', color: '#E41E3F' },
    { id: 'ads', title: 'Ad Dashboard', icon: 'fas fa-chart-line', color: '#10B981' },
  ];

  const bottomItems = [
    { id: 'settings', title: 'Settings & Privacy', icon: 'fas fa-cog' },
    { id: 'privacy', title: 'Privacy Policy', icon: 'fas fa-user-shield' },
    { id: 'help', title: 'Help & Support', icon: 'fas fa-question-circle' },
    { id: 'terms', title: 'Terms of Service', icon: 'fas fa-file-alt' },
  ];

  return (
    <div className="fixed inset-0 z-[200] bg-[#18191A] animate-slide-down flex flex-col font-sans overflow-hidden">
      <div className="h-14 px-4 flex items-center justify-between border-b border-[#3E4042] bg-[#242526] shadow-sm flex-shrink-0">
        <h2 className="text-[24px] font-bold text-[#E4E6EB]">Menu</h2>

        <div className="flex gap-2">
          <div
            onClick={onClose}
            className="w-9 h-9 bg-[#3A3B3C] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#4E4F50]"
          >
            <i className="fas fa-times text-[#E4E6EB] text-xl"></i>
          </div>
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
            <div className="flex flex-col">
              <span className="font-bold text-[#E4E6EB] text-lg">{currentUser.name}</span>
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
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
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
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
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

interface HeaderProps {
  onHomeClick: () => void;
  onProfileClick: (id: number) => void;
  onReelsClick: () => void;
  onMarketplaceClick: () => void;
  onGroupsClick: () => void;
  onAdsClick: () => void;
  currentUser: User | null;
  notifications: Notification[];
  users: User[];
  onLogout: () => void;
  onLoginClick: () => void;
  onMarkNotificationsRead: () => void;
  activeTab: string;
  onNavigate: (view: string) => void;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
}

export const Header: React.FC<HeaderProps> = ({
  onHomeClick,
  onProfileClick,
  onReelsClick,
  onMarketplaceClick,
  onGroupsClick,
  onAdsClick,
  currentUser,
  notifications,
  users,
  onLogout,
  onLoginClick,
  onMarkNotificationsRead,
  activeTab,
  onNavigate,
  setNotifications,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFullMenu, setShowFullMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const presenceTimer = useRef<number | null>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
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
        if (user.name.toLowerCase().includes(lowerQuery)) score += 10;
        return { user, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.user);

    setSearchResults(scoredUsers);
  };

  return (
    <>
      <style>{`
        @keyframes uneraEarthRotate {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        @keyframes uneraEarthGlow {
          0%, 100% {
            box-shadow:
              0 0 8px rgba(29, 138, 242, 0.35),
              0 0 16px rgba(24, 119, 242, 0.24),
              inset -6px -6px 10px rgba(0, 0, 0, 0.30),
              inset 5px 5px 8px rgba(255, 255, 255, 0.08);
          }
          50% {
            box-shadow:
              0 0 12px rgba(29, 138, 242, 0.5),
              0 0 22px rgba(24, 119, 242, 0.30),
              inset -7px -7px 12px rgba(0, 0, 0, 0.34),
              inset 6px 6px 10px rgba(255, 255, 255, 0.10);
          }
        }

        .unera-earth-scene {
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transform: rotate(-18deg);
        }

        .unera-earth-globe {
          width: 30px;
          height: 30px;
          position: relative;
          border-radius: 9999px;
          overflow: hidden;
          background:
            radial-gradient(circle at 32% 28%, rgba(128, 219, 255, 0.8) 0%, rgba(61, 174, 255, 0.28) 16%, transparent 30%),
            radial-gradient(circle at 48% 46%, #0d56c7 0%, #0a3ea4 44%, #062b7d 70%, #031d58 100%);
          border: 1px solid rgba(163, 227, 255, 0.55);
          animation: uneraEarthGlow 4s ease-in-out infinite;
        }

        .unera-earth-map {
          position: absolute;
          inset: -6% -20%;
          width: 248%;
          height: 112%;
          background-repeat: repeat-x;
          background-size: 50% 100%;
          background-position: 0 0;
          animation: uneraEarthRotate 9s linear infinite;
          opacity: 1;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 400'><defs><linearGradient id='g1' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%2377d7ff'/><stop offset='45%' stop-color='%231D8AF2'/><stop offset='100%' stop-color='%231877F2'/></linearGradient><linearGradient id='g2' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%2396e3ff'/><stop offset='100%' stop-color='%231D8AF2'/></linearGradient></defs><g fill='url(%23g1)'><path d='M48 150l28-34 40-15 29 7 20 23-4 27-24 20-37 7-27-9-10-26z'/><path d='M118 192l24-9 28 10 13 19-14 28-20 25-11 39-16 24-22-10-4-28 9-27 13-21-10-19z'/><path d='M204 84l26-18 37-3 31 8 22 17-8 28-23 10-24-3-28 8-28-8-16-18z'/><path d='M254 122l28-8 22 10 12 23 22 8 27 14 18 18-8 18-27 10-17 19-26 4-18-9 2-18-13-18 0-22z'/><path d='M340 196l18 8 21 18 5 21-12 20-18 7-18-4-10-18 3-20z'/><path d='M368 82l36-14 40 4 32 17 7 27-17 19-37 6-30 13-39-7-13-26 10-22z'/><path d='M434 134l24-8 25 8 17-4 27 15 14 24-5 28-15 21-24 6-12-12-11-18-26-10-9-20z'/><path d='M514 94l27-10 32 3 23 13 5 21-16 14-24 1-22 11-26-4-11-19 5-20z'/><path d='M572 127l18 7 23-4 27 8 11 16-6 13-28 3-24 10-17-10-6-19z'/><path d='M604 184l20 6 16 18-4 25-11 19-6 30-18 10-18-8-2-31 7-22 9-18z'/><path d='M693 257l18-5 12 12-2 17-13 11-14-5-4-15z'/></g><g fill='url(%23g2)' opacity='0.98'><path d='M204 84l26-18 37-3 31 8 22 17-8 28-23 10-24-3-28 8-28-8-16-18z'/><path d='M368 82l36-14 40 4 32 17 7 27-17 19-37 6-30 13-39-7-13-26 10-22z'/><path d='M514 94l27-10 32 3 23 13 5 21-16 14-24 1-22 11-26-4-11-19 5-20z'/></g></svg>");
          filter:
            drop-shadow(0 0 1px rgba(160, 235, 255, 0.5))
            drop-shadow(0 0 2px rgba(24, 119, 242, 0.22));
        }

        .unera-earth-lines {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background:
            linear-gradient(transparent 20%, rgba(110, 210, 255, 0.14) 22%, transparent 24%, transparent 46%, rgba(110, 210, 255, 0.10) 48%, transparent 50%, transparent 72%, rgba(110, 210, 255, 0.12) 74%, transparent 76%),
            linear-gradient(90deg, transparent 24%, rgba(110, 210, 255, 0.08) 26%, transparent 28%, transparent 48%, rgba(110, 210, 255, 0.06) 50%, transparent 52%, transparent 72%, rgba(110, 210, 255, 0.06) 74%, transparent 76%);
          opacity: 0.42;
          mix-blend-mode: screen;
          pointer-events: none;
        }

        .unera-earth-shade {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background:
            radial-gradient(circle at 30% 26%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.10) 18%, transparent 32%),
            radial-gradient(circle at 78% 58%, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.24) 26%, transparent 54%),
            linear-gradient(90deg, rgba(255,255,255,0.06) 0%, transparent 28%, transparent 65%, rgba(0,0,0,0.24) 100%);
          pointer-events: none;
        }

        .unera-earth-rim {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          box-shadow:
            inset 0 0 0 1px rgba(220, 248, 255, 0.24),
            0 0 8px rgba(77, 190, 255, 0.24);
          pointer-events: none;
        }

        @media (max-width: 639px) {
          .unera-earth-scene {
            width: 34px;
            height: 34px;
          }

          .unera-earth-globe {
            width: 34px;
            height: 34px;
          }

          .unera-earth-map {
            inset: -7% -24%;
            width: 258%;
            height: 114%;
          }
        }

        @media (min-width: 640px) {
          .unera-earth-scene {
            width: 34px;
            height: 34px;
          }

          .unera-earth-globe {
            width: 34px;
            height: 34px;
          }

          .unera-earth-map {
            inset: -5% -18%;
            width: 240%;
            height: 110%;
          }
        }
      `}</style>

      <div className="sticky top-0 z-50 bg-[#242526] shadow-sm h-14 flex items-center justify-between px-4 w-full border-b border-[#3E4042]">
        <div className="flex items-center gap-2">
          <div className="flex items-center cursor-pointer gap-2 mr-2" onClick={onHomeClick}>
            <span className="unera-earth-scene" aria-hidden="true">
              <span className="unera-earth-globe">
                <span className="unera-earth-map"></span>
                <span className="unera-earth-lines"></span>
                <span className="unera-earth-shade"></span>
                <span className="unera-earth-rim"></span>
              </span>
            </span>

            <h1 className="text-[24px] sm:text-[28px] font-bold bg-gradient-to-r from-[#1877F2] to-[#1D8AF2] text-transparent bg-clip-text tracking-tight">
              UNERA
            </h1>
          </div>
        </div>

        <div className="flex-1 max-w-[600px] h-full hidden md:flex items-center justify-center gap-1">
          <div
            onClick={onHomeClick}
            className={`flex-1 h-full flex items-center justify-center cursor-pointer border-b-[3px] ${
              activeTab === 'home'
                ? 'border-[#1877F2] text-[#1877F2]'
                : 'border-transparent text-[#B0B3B8] hover:bg-[#3A3B3C] rounded-lg'
            }`}
          >
            <i className="fas fa-home text-[24px]"></i>
          </div>

          <div
            onClick={onReelsClick}
            className={`flex-1 h-full flex items-center justify-center cursor-pointer border-b-[3px] ${
              activeTab === 'reels'
                ? 'border-[#1877F2] text-[#1877F2]'
                : 'border-transparent text-[#B0B3B8] hover:bg-[#3A3B3C] rounded-lg'
            }`}
          >
            <i className="fas fa-clapperboard text-[24px]"></i>
          </div>

          <div
            onClick={onMarketplaceClick}
            className={`flex-1 h-full flex items-center justify-center cursor-pointer border-b-[3px] ${
              activeTab === 'marketplace'
                ? 'border-[#1877F2] text-[#1877F2]'
                : 'border-transparent text-[#B0B3B8] hover:bg-[#3A3B3C] rounded-lg'
            }`}
          >
            <i className="fas fa-store text-[24px]"></i>
          </div>

          <div
            onClick={onGroupsClick}
            className={`flex-1 h-full flex items-center justify-center cursor-pointer border-b-[3px] ${
              activeTab === 'groups'
                ? 'border-[#1877F2] text-[#1877F2]'
                : 'border-transparent text-[#B0B3B8] hover:bg-[#3A3B3C] rounded-lg'
            }`}
          >
            <i className="fas fa-users text-[24px]"></i>
          </div>

          <div
            onClick={onAdsClick}
            className={`flex-1 h-full flex items-center justify-center cursor-pointer border-b-[3px] ${
              activeTab === 'ads'
                ? 'border-[#10B981] text-[#10B981]'
                : 'border-transparent text-[#B0B3B8] hover:bg-[#3A3B3C] rounded-lg'
            }`}
          >
            <i className="fas fa-chart-line text-[24px]"></i>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] cursor-pointer"
            onClick={() => setShowFullMenu(true)}
          >
            <i className="fas fa-bars text-[#E4E6EB] text-[18px]"></i>
          </div>

          <div className="relative mr-1 md:mr-2" ref={searchRef}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-[#B0B3B8]"></i>
            </div>

            <input
              type="text"
              className="bg-[#3A3B3C] text-[#E4E6EB] rounded-full py-2 pl-10 pr-4 w-[40px] md:w-[240px] focus:w-[240px] transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-[#1877F2] cursor-pointer md:cursor-text"
              placeholder="Search in UNERA"
              value={searchQuery}
              onChange={handleSearchChange}
            />

            {searchQuery && (
              <div className="absolute top-12 right-0 w-[280px] bg-[#242526] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-[#3E4042] z-50 p-2 max-h-[400px] overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer"
                      onClick={() => {
                        onProfileClick(user.id);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                    >
                      <img
                        src={user.profile_image_url}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#3E4042]"
                      />
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-semibold text-[15px] text-[#E4E6EB] truncate">
                          {user.name}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-[#B0B3B8] text-sm">No results found</div>
                )}
              </div>
            )}
          </div>

          {!currentUser ? (
            <button
              onClick={onLoginClick}
              className="bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold py-1.5 px-4 rounded-full transition-colors"
            >
              Log In
            </button>
          ) : (
            <>
              <div className="relative" ref={notifRef}>
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] cursor-pointer relative"
                  onClick={() => onNavigate('notifications')}
                >
                  <i className="fas fa-bell text-[#E4E6EB] text-lg"></i>

                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#E41E3F] text-white text-[11px] font-bold px-1.5 py-[1px] rounded-full min-w-[18px] text-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>

                {showNotifications && (
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
                )}
              </div>

              <div
                className="relative cursor-pointer"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                ref={profileRef}
              >
                <img
                  src={currentUser.profile_image_url}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover border border-[#3E4042]"
                />

                {showProfileMenu && (
                  <div className="absolute top-12 right-0 w-[300px] bg-[#242526] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-[#3E4042] z-50 p-2">
                    <div
                      className="flex items-center gap-3 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer mb-2"
                      onClick={() => onProfileClick(currentUser.id)}
                    >
                      <img
                        src={currentUser.profile_image_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <span className="font-semibold text-[17px] text-[#E4E6EB]">
                        {currentUser.name}
                      </span>
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
              </div>
            </>
          )}
        </div>
      </div>

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

interface SidebarProps {
  currentUser: User;
  onProfileClick: (id: number) => void;
  onReelsClick: () => void;
  onMarketplaceClick: () => void;
  onGroupsClick: () => void;
  onEventsClick: () => void;
  onAdsClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  onProfileClick,
  onReelsClick,
  onMarketplaceClick,
  onGroupsClick,
  onEventsClick,
  onAdsClick,
}) => {
  const items = [
    { id: 'friends', label: 'Friends', icon: 'fas fa-user-friends', color: '#1877F2' },
    { id: 'memories', label: 'Memories', icon: 'fas fa-history', color: '#1877F2' },
    { id: 'saved', label: 'Saved', icon: 'fas fa-bookmark', color: '#B250B3' },
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
