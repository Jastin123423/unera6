// Layout.tsx
import React, { useState, useEffect, useRef } from 'react';
import { User, Notification } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { NotificationDropdown } from './Notifications';

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
    { id: 'marketplace', title: 'Marketplace', icon: 'fas fa-store', color: '#1877F2', desc: 'Buy and sell in your community.' },
    { id: 'events', title: 'Events', icon: 'fas fa-calendar-alt', color: '#F3425F', desc: 'Discover events near you.' },
    { id: 'profiles', title: 'Profiles', icon: 'fas fa-user-friends', color: '#1877F2', desc: 'See friends and profiles.' },
    { id: 'groups', title: 'Groups', icon: 'fas fa-users', color: '#1877F2', desc: 'Connect with people who share your interests.' },
    { id: 'brands', title: 'Brands', icon: 'fas fa-award', color: '#F7B928', desc: 'Discover and create business pages.' },
    { id: 'music', title: 'UNERA Music', icon: 'fas fa-music', color: '#0055FF', desc: 'Listen to music and podcasts.' },
    { id: 'tools', title: 'UNERA Tools', icon: 'fas fa-briefcase', color: '#2ABBA7', desc: 'PDF Tools, AI Chat, Image Tools.' },
    { id: 'reels', title: 'Reels', icon: 'fas fa-clapperboard', color: '#E41E3F', desc: 'Watch and create short videos.' },
    { id: 'birthdays', title: 'Birthdays', icon: 'fas fa-birthday-cake', color: '#F7B928', desc: 'See upcoming birthdays.' },
    { id: 'memories', title: 'Memories', icon: 'fas fa-history', color: '#1877F2', desc: 'Browse your old photos, videos and posts.' },
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
  currentUser: User | null;
  notifications: Notification[];
  users: User[];
  onLogout: () => void;
  onLoginClick: () => void;
  onMarkNotificationsRead: () => void;
  activeTab: string;
  onNavigate: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onHomeClick,
  onProfileClick,
  onReelsClick,
  onMarketplaceClick,
  onGroupsClick,
  currentUser,
  notifications,
  users,
  onLogout,
  onLoginClick,
  onMarkNotificationsRead,
  activeTab,
  onNavigate,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFullMenu, setShowFullMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setShowProfileMenu(false);
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSearchResults([]);
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

  // ✅ NEW icon (bigger than "U" and closer to UNERA)
  const uneraIconUrl =
    'https://pub-71f20b7e692d481a8486f90d3e574be7.r2.dev/task_01kj5y9gc6ey5rdbgt7qkymnvk_1771873623_img_0.webp';

  return (
    <>
      <div className="sticky top-0 z-50 bg-[#242526] shadow-sm h-14 flex items-center justify-between px-4 w-full border-b border-[#3E4042]">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center cursor-pointer mr-2"
            onClick={onHomeClick}
          >
            
        {/* ✅ Globe-style rotation + tighter spacing like "0UNERA" */}
<div className="relative flex items-center">
  <img
    src={uneraIconUrl}
    alt="UNERA"
    className="
      w-[44px] h-[44px]
      sm:w-[48px] sm:h-[48px]
      object-contain
      select-none
      -mr-[6px]
      [transform-style:preserve-3d]
      [animation:uneraGlobeSpin_2.8s_linear_infinite,uneraGlobeWobble_3.6s_ease-in-out_infinite]
    "
    draggable={false}
  />

  <h1 className="text-[24px] sm:text-[28px] font-bold bg-gradient-to-r from-[#1877F2] to-[#1D8AF2] text-transparent bg-clip-text tracking-tight">
    UNERA
  </h1>

  {/* ✅ Local keyframes (only affect this component) */}
  <style>{`
    @keyframes uneraGlobeSpin_2.8s {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    /* "Globe-like" feel: slight 3D tilt/wobble while spinning */
    @keyframes uneraGlobeWobble_3.6s {
      0%   { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); transform: rotate(0deg) rotateX(12deg) rotateY(-18deg); }
      50%  { filter: drop-shadow(0 2px 10px rgba(0,0,0,0.35)); transform: rotate(180deg) rotateX(-10deg) rotateY(18deg); }
      100% { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); transform: rotate(360deg) rotateX(12deg) rotateY(-18deg); }
    }
  `}</style>
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
              <div
                className="flex items-center justify-center w-10 h-10 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] cursor-pointer relative"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) onMarkNotificationsRead();
                }}
                ref={notifRef}
              >
                <i className="fas fa-bell text-[#E4E6EB] text-lg"></i>

                {showNotifications && (
                  <NotificationDropdown
                    notifications={notifications}
                    users={users}
                    onNotificationClick={(n) => {
                      setShowNotifications(false);
                      if (n.post_id) onNavigate(`post-${n.post_id}`);
                      else if (n.sender_id) onProfileClick(n.sender_id);
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
                      <span className="font-medium text-[15px] text-[#E4E6EB]">
                        Log Out
                      </span>
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  onProfileClick,
  onReelsClick,
  onMarketplaceClick,
  onGroupsClick,
  onEventsClick,
}) => {
  const items = [
    { id: 'friends', label: 'Friends', icon: 'fas fa-user-friends', color: '#1877F2' },
    { id: 'memories', label: 'Memories', icon: 'fas fa-history', color: '#1877F2' },
    { id: 'saved', label: 'Saved', icon: 'fas fa-bookmark', color: '#B250B3' },
    { id: 'groups', label: 'Groups', icon: 'fas fa-users', color: '#1877F2', onClick: onGroupsClick },
    { id: 'marketplace', label: 'Marketplace', icon: 'fas fa-store', color: '#1877F2', onClick: onMarketplaceClick },
    { id: 'reels', label: 'Reels', icon: 'fas fa-clapperboard', color: '#E41E3F', onClick: onReelsClick },
    { id: 'events', label: 'Events', icon: 'fas fa-calendar-alt', color: '#F3425F', onClick: onEventsClick },
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

export const RightSidebar: React.FC<{ contacts: User[]; onProfileClick: (id: number) => void }> = ({
  contacts,
  onProfileClick,
}) => {
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
              {user.is_online && (
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
