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
    { id: 'story-feed', title: 'Story Feed', icon: 'fas fa-layer-group', color: '#45BD62' },
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
}

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
              0 0 10px rgba(29, 138, 242, 0.4),
              0 0 20px rgba(24, 119, 242, 0.28),
              inset -8px -8px 12px rgba(0, 0, 0, 0.32),
              inset 6px 6px 10px rgba(255, 255, 255, 0.08);
          }
          50% {
            box-shadow:
              0 0 16px rgba(29, 138, 242, 0.55),
              0 0 28px rgba(24, 119, 242, 0.35),
              inset -9px -9px 14px rgba(0, 0, 0, 0.36),
              inset 7px 7px 12px rgba(255, 255, 255, 0.10);
          }
        }

        .unera-earth-scene {
          width: 38px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transform: rotate(-18deg);
        }

        .unera-earth-globe {
          width: 38px;
          height: 38px;
          position: relative;
          border-radius: 9999px;
          overflow: hidden;
          background:
            radial-gradient(circle at 32% 28%, rgba(128, 219, 255, 0.85) 0%, rgba(61, 174, 255, 0.32) 16%, transparent 30%),
            radial-gradient(circle at 48% 46%, #0d56c7 0%, #0a3ea4 44%, #062b7d 70%, #031d58 100%);
          border: 1.5px solid rgba(163, 227, 255, 0.6);
          animation: uneraEarthGlow 4s ease-in-out infinite;
        }

        .unera-earth-map {
          position: absolute;
          inset: -8% -28%;
          width: 280%;
          height: 116%;
          background-repeat: repeat-x;
          background-size: 50% 100%;
          background-position: 0 0;
          animation: uneraEarthRotate 12s linear infinite;
          opacity: 0.95;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 500'><defs><linearGradient id='g1' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%2388e0ff'/><stop offset='45%' stop-color='%232d9eff'/><stop offset='100%' stop-color='%231877F2'/></linearGradient><linearGradient id='g2' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23a0e8ff'/><stop offset='100%' stop-color='%232d9eff'/></linearGradient></defs><g fill='url(%23g1)'><path d='M68 180l32-38 48-18 36 9 26 28-5 32-30 24-44 8-32-10-12-30-5-5z'/><path d='M158 240l28-10 32 12 16 22-16 34-24 30-13 48-18 28-26-12-5-34 10-32 16-26-12-24z'/><path d='M264 110l32-22 46-4 38 10 28 22-10 34-28 12-30-4-34 10-34-10-20-22-4-12z'/><path d='M328 158l34-10 28 12 16 28 28 10 34 18 22 22-10 22-34 12-22 24-32 5-22-12 2-22-16-22-2-28z'/><path d='M440 252l22 10 26 22 6 26-15 24-22 9-22-5-12-22 4-24z'/><path d='M476 108l44-16 50 5 40 20 10 34-22 24-46 8-36 16-48-8-16-34 12-28-8-8z'/><path d='M562 172l30-10 30 10 22-5 34 18 18 30-6 34-18 26-30 8-15-15-14-22-32-12-10-24-4-8z'/><path d='M664 122l34-12 40 4 28 16 6 26-20 18-30 2-28 14-32-5-14-24 6-26-4-8z'/><path d='M738 162l22 8 28-5 34 10 14 20-8 16-34 4-30 12-22-12-8-24-4-8z'/><path d='M778 236l24 8 20 22-5 30-14 24-8 36-22 12-22-10-4-38 8-28 12-22-4-8z'/><path d='M892 328l22-6 16 16-4 22-16 14-18-6-5-18-8-12z'/><path d='M68 280l18-12 32 8 24 18-8 28-22 18-28 6-24-12-6-24z'/><path d='M158 340l24-8 28 14 12 22-10 26-18 22-28 8-20-12-6-28 8-24z'/><path d='M264 280l22-16 36-6 28 16-6 24-18 14-28 4-22-12-6-18z'/><path d='M346 360l18-10 24 8 18 18-10 24-16 12-22-4-12-18-4-18z'/></g><g fill='url(%23g2)' opacity='0.96'><path d='M264 110l32-22 46-4 38 10 28 22-10 34-28 12-30-4-34 10-34-10-20-22-4-12z'/><path d='M476 108l44-16 50 5 40 20 10 34-22 24-46 8-36 16-48-8-16-34 12-28-8-8z'/><path d='M664 122l34-12 40 4 28 16 6 26-20 18-30 2-28 14-32-5-14-24 6-26-4-8z'/></g></svg>");
          filter:
            drop-shadow(0 0 2px rgba(160, 235, 255, 0.6))
            drop-shadow(0 0 3px rgba(24, 119, 242, 0.28));
        }

        .unera-earth-lines {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background:
            linear-gradient(transparent 20%, rgba(110, 210, 255, 0.18) 22%, transparent 24%, transparent 46%, rgba(110, 210, 255, 0.14) 48%, transparent 50%, transparent 72%, rgba(110, 210, 255, 0.16) 74%, transparent 76%),
            linear-gradient(90deg, transparent 24%, rgba(110, 210, 255, 0.12) 26%, transparent 28%, transparent 48%, rgba(110, 210, 255, 0.10) 50%, transparent 52%, transparent 72%, rgba(110, 210, 255, 0.12) 74%, transparent 76%);
          opacity: 0.48;
          mix-blend-mode: screen;
          pointer-events: none;
        }

        .unera-earth-shade {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background:
            radial-gradient(circle at 28% 24%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.12) 18%, transparent 32%),
            radial-gradient(circle at 76% 56%, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0.28) 26%, transparent 54%),
            linear-gradient(90deg, rgba(255,255,255,0.08) 0%, transparent 28%, transparent 65%, rgba(0,0,0,0.28) 100%);
          pointer-events: none;
        }

        .unera-earth-rim {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          box-shadow:
            inset 0 0 0 1.5px rgba(220, 248, 255, 0.28),
            0 0 10px rgba(77, 190, 255, 0.28);
          pointer-events: none;
        }

        @media (max-width: 639px) {
          .unera-earth-scene {
            width: 42px;
            height: 42px;
          }

          .unera-earth-globe {
            width: 42px;
            height: 42px;
          }

          .unera-earth-map {
            inset: -10% -32%;
            width: 300%;
            height: 120%;
          }
        }

        @media (min-width: 640px) {
          .unera-earth-scene {
            width: 42px;
            height: 42px;
          }

          .unera-earth-globe {
            width: 42px;
            height: 42px;
          }

          .unera-earth-map {
            inset: -8% -26%;
            width: 260%;
            height: 116%;
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
            onClick={onStoryFeedClick || (() => onNavigate('story-feed'))}
            className={`flex-1 h-full flex items-center justify-center cursor-pointer border-b-[3px] ${
              activeTab === 'story-feed'
                ? 'border-[#45BD62] text-[#45BD62]'
                : 'border-transparent text-[#B0B3B8] hover:bg-[#3A3B3C] rounded-lg'
            }`}
          >
            <i className="fas fa-layer-group text-[24px]"></i>
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
