/**
 * =========================
 * ✅ PEOPLE YOU MAY KNOW
 * =========================
 */
interface PeopleSuggestion {
  id: number;
  username: string;
  name: string;
  profile_image_url: string | null;
  is_verified: boolean;
  role: string;
  mutual_count: number;
  is_following: boolean;
  score: number;
}

export const PeopleYouMayKnowGrid = memo(
  ({
    users = [],
    onFollow,
    currentUser,
    isLoading = false,
    onLoginClick,
    onProfileClick,
    title = 'People You May Know',
    maxDisplay = 8,
  }: {
    users: PeopleSuggestion[];
    onFollow: (userId: number) => void;
    currentUser: User | null;
    isLoading?: boolean;
    onLoginClick?: () => void;
    onProfileClick?: (userId: number) => void;
    title?: string;
    maxDisplay?: number;
  }) => {
    const [followLoading, setFollowLoading] = useState<{ [key: number]: boolean }>({});
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const displayUsers = users.slice(0, maxDisplay);

    const checkScroll = useCallback(() => {
      const el = scrollRef.current;
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 0);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
    }, []);

    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      checkScroll();
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }, [checkScroll, displayUsers.length]);

    const scroll = (direction: 'left' | 'right') => {
      const el = scrollRef.current;
      if (!el) return;
      const scrollAmount = 350;
      el.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    };

    const handleFollow = async (userId: number) => {
      setFollowLoading((prev) => ({ ...prev, [userId]: true }));
      try {
        await onFollow(userId);
      } finally {
        setFollowLoading((prev) => ({ ...prev, [userId]: false }));
      }
    };

    const handleProfileClick = (userId: number) => {
      if (onProfileClick) onProfileClick(userId);
    };

    if (isLoading) {
      return (
        <div className="w-full">
          <div className="bg-[#242526] w-full p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[#E4E6EB] font-bold text-[20px]">{title}</h3>
            </div>
            <div className="flex gap-4 overflow-x-hidden py-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-shrink-0 w-[180px] animate-pulse">
                  <div className="w-24 h-24 mx-auto mb-3 bg-[#3A3B3C] rounded-full"></div>
                  <div className="h-5 bg-[#3A3B3C] rounded w-32 mx-auto mb-2"></div>
                  <div className="h-4 bg-[#3A3B3C] rounded w-20 mx-auto mb-4"></div>
                  <div className="h-10 bg-[#3A3B3C] rounded-lg w-full"></div>
                </div>
              ))}
            </div>
          </div>
          <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
        </div>
      );
    }

    if (displayUsers.length === 0) return null;

    return (
      <div className="w-full">
        <div className="bg-[#242526] w-full p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[#E4E6EB] font-bold text-[20px]">{title}</h3>
            <div className="flex items-center gap-2">
              {canScrollLeft && (
                <button
                  onClick={() => scroll('left')}
                  className="w-9 h-9 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] flex items-center justify-center transition-colors"
                >
                  <i className="fas fa-chevron-left text-[#E4E6EB] text-base"></i>
                </button>
              )}
              {canScrollRight && (
                <button
                  onClick={() => scroll('right')}
                  className="w-9 h-9 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] flex items-center justify-center transition-colors"
                >
                  <i className="fas fa-chevron-right text-[#E4E6EB] text-base"></i>
                </button>
              )}
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {displayUsers.map((user) => (
              <div
                key={user.id}
                className="flex-shrink-0 w-[180px] bg-[#3A3B3C] rounded-xl p-4 hover:bg-[#4E4F50] transition-colors group"
              >
                <div
                  className="relative w-24 h-24 mx-auto mb-3 cursor-pointer"
                  onClick={() => handleProfileClick(user.id)}
                >
                  <div className="w-full h-full rounded-full overflow-hidden border-3 border-[#1877F2] group-hover:border-[#166FE5] transition-colors">
                    <img
                      src={
                        user.profile_image_url ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          user.name
                        )}&background=1877F2&color=fff&bold=true&size=128`
                      }
                      alt={user.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          user.name
                        )}&background=1877F2&color=fff&bold=true&size=128`;
                      }}
                    />
                  </div>
                  {user.is_verified && (
                    <i className="fas fa-check-circle absolute bottom-1 right-1 text-[#1877F2] text-base bg-[#242526] rounded-full p-0.5 border border-[#3A3B3C]"></i>
                  )}
                </div>

                <div className="text-center mb-2">
                  <button
                    type="button"
                    onClick={() => handleProfileClick(user.id)}
                    className="text-[#E4E6EB] font-bold text-[17px] truncate block w-full hover:underline"
                  >
                    {user.name}
                  </button>
                  {user.role && (
                    <div className="text-[#B0B3B8] text-[13px] mt-1">{user.role}</div>
                  )}
                </div>

                {user.mutual_count > 0 && (
                  <div className="text-center mb-3">
                    <span className="text-[#B0B3B8] text-[13px]">
                      {user.mutual_count} mutual friend
                      {user.mutual_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {!currentUser ? (
                  <button
                    onClick={onLoginClick}
                    className="w-full py-2.5 bg-[#1877F2] hover:bg-[#166FE5] text-white text-[15px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <i className="fas fa-sign-in-alt text-[13px]"></i>
                    <span>Sign in</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleFollow(user.id)}
                    disabled={followLoading[user.id]}
                    className={`w-full py-2.5 text-[15px] font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-1 ${
                      user.is_following
                        ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                        : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                    } disabled:opacity-70 disabled:cursor-not-allowed`}
                  >
                    {followLoading[user.id] ? (
                      <i className="fas fa-spinner fa-spin text-[13px]"></i>
                    ) : (
                      <>
                        <i
                          className={`fas ${
                            user.is_following ? 'fa-check' : 'fa-user-plus'
                          } text-[13px]`}
                        ></i>
                        <span>{user.is_following ? 'Following' : 'Follow'}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.users === next.users &&
      prev.currentUser?.id === next.currentUser?.id &&
      prev.isLoading === next.isLoading
    );
  }
);

/**
 * =========================
 * ✅ REEL PREVIEW CARD
 * =========================
 */
export type ReelFeedData = {
  id: number | string;
  user_id: number | string;
  author: string;
  avatar?: string;
  verified?: boolean;
  video: string;
  thumbnail?: string;
  caption?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  created_at?: string;
  audioUrl?: string;
  audioStart?: number;
  audioEnd?: number;
  songName?: string;
  songId?: string | number;
  soundKey?: string;
};

const formatReelCount = (n?: number): string => {
  const v = Number(n || 0);
  if (v >= 1_000_000_000)
    return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (v >= 1_000_000)
    return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(v);
};

const getReelAuthorName = (reel: any): string => {
  return (
    reel?.author_name ||
    reel?.full_name ||
    reel?.username ||
    reel?.user_name ||
    reel?.name ||
    (reel?.user &&
      (reel.user.full_name || reel.user.username || reel.user.name)) ||
    (reel?.author &&
      (typeof reel.author === 'string'
        ? reel.author
        : reel.author.full_name || reel.author.username || reel.author.name)) ||
    'User'
  );
};

export const normalizeReelFromFeed = (item: any): ReelFeedData => {
  const reelData = item?.reel || item;
  return {
    id: reelData?.id || item?.id || 0,
    user_id: reelData?.user_id ?? reelData?.userId ?? item?.user_id ?? 0,
    author: getReelAuthorName(reelData) || getReelAuthorName(item),
    avatar:
      reelData?.avatar ||
      reelData?.profile_image_url ||
      reelData?.user?.profile_image_url ||
      item?.avatar ||
      '',
    verified: Boolean(reelData?.verified || reelData?.is_verified || false),
    views: Number(
      reelData?.views_count ??
        reelData?.view_count ??
        reelData?.views ??
        reelData?.total_views ??
        item?.views_count ??
        item?.views ??
        0
    ),
    likes: Number(
      reelData?.likes_count ?? reelData?.likes ?? reelData?.reactions_count ?? 0
    ),
    comments: Number(reelData?.comments_count ?? reelData?.comments ?? 0),
    shares: Number(reelData?.shares_count ?? reelData?.shares ?? 0),
    video:
      reelData?.video_url || reelData?.video || reelData?.media_url || item?.video_url || '',
    thumbnail: reelData?.thumbnail_url || reelData?.thumbnail || reelData?.cover_url || '',
    caption: reelData?.caption || reelData?.description || '',
    created_at: reelData?.created_at || reelData?.createdAt || item?.created_at || '',
    audioUrl: reelData?.audio_url || reelData?.audioUrl || reelData?.song?.audio_url,
    audioStart: Number(reelData?.audio_start || reelData?.audioStart || 0),
    audioEnd: Number(reelData?.audio_end || reelData?.audioEnd || 0),
    songName: reelData?.song_name || reelData?.songName || reelData?.song?.title,
    songId: reelData?.song_id || reelData?.songId || reelData?.song?.id,
    soundKey: reelData?.sound_key || reelData?.soundKey || `reel:${reelData?.id || 0}`,
  };
};

export const isReelPost = (item: any): boolean => {
  return (
    item?.type === 'reel' ||
    item?.post_type === 'reel' ||
    item?.kind === 'reel' ||
    item?.feed_type === 'reel' ||
    item?.item_type === 'reel' ||
    item?.is_reel === true ||
    item?.format === 'reel' ||
    (item?.video && (item?.audio_url || item?.song_name))
  );
};

export const ReelFeedCard = memo(
  ({
    reel,
    onOpen,
    onOpenMenu,
    onProfileClick,
  }: {
    reel: ReelFeedData;
    onOpen?: (reelId: number | string) => void;
    onOpenMenu?: (reel: ReelFeedData) => void;
    onProfileClick?: (userId: number | string) => void;
  }) => {
    const openReel = () => {
      onOpen?.(reel.id);
    };
    const handleProfileClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onProfileClick?.(reel.user_id);
    };

    return (
      <div
        className="w-full"
        style={{
          background: '#1c1e21',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 10,
          padding: '12px 0 14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 14px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Film size={22} color="#1877f2" />
            <span style={{ fontSize: 24, fontWeight: 700, color: '#e4e6eb' }}>
              Reels
            </span>
          </div>
          <PostMenu
            item={{
              id: reel.id,
              user_id: reel.user_id,
              type: 'reel',
              content: reel.caption,
              caption: reel.caption,
              author: reel.author,
            }}
            currentUser={{ id: Number(localStorage.getItem('user_id')) }}
            onShare={(item) => {
              console.log('Share reel:', item);
            }}
          />
        </div>
        <div
          onClick={openReel}
          style={{
            position: 'relative',
            width: 'calc(100% - 28px)',
            margin: '0 14px',
            aspectRatio: '9 / 16',
            maxHeight: '75vh',
            borderRadius: 24,
            overflow: 'hidden',
            background: '#111',
            cursor: 'pointer',
          }}
        >
          {reel.thumbnail ? (
            <img
              src={reel.thumbnail}
              alt={reel.caption || 'Reel preview'}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                objectFit: 'cover',
              }}
            />
          ) : (
            <video
              src={reel.video}
              muted
              playsInline
              preload="metadata"
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                objectFit: 'cover',
              }}
            />
          )}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.10), rgba(0,0,0,0.25))',
            }}
          />

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: 74,
                height: 74,
                borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.95)',
                background: 'rgba(255,255,255,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Play size={36} fill="#fff" color="#fff" style={{ marginLeft: 4 }} />
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              left: 14,
              right: 14,
              bottom: 12,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: '#fff',
                  fontSize: 17,
                  fontWeight: 700,
                  marginBottom: 6,
                  textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }}
              >
                {reel.author}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 700,
                  textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }}
              >
                <Eye size={20} />
                <span>{formatReelCount(reel.views)}</span>
              </div>
            </div>

            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '2px solid #fff',
                background: '#1877f2',
                flexShrink: 0,
              }}
            >
              {reel.avatar ? (
                <img
                  src={reel.avatar}
                  alt={reel.author}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                >
                  {(reel.author || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {reel.songName && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                padding: '4px 8px',
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <i
                className="fas fa-music"
                style={{ color: '#1877F2', fontSize: 12 }}
              ></i>
              <span
                style={{
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 'bold',
                  maxWidth: 80,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {reel.songName}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  },
  reelCardPropsEqual
);

/**
 * =========================
 * ✅ GROUPS YOU MAY JOIN
 * =========================
 */
interface GroupSuggestion {
  id: number;
  admin_id: number;
  name: string;
  description: string;
  type: 'public' | 'private';
  cover_image?: string;
  profile_image?: string;
  created_at?: string;
  category: string;
  members_count: number;
  mutual_count: number;
  is_member: boolean;
  score: number;
}

export const GroupsYouMayJoinCard = memo(
  ({
    groups = [],
    onJoin,
    currentUser,
    isLoading = false,
    onLoginClick,
    onOpenGroup,
    onProfileClick,
    title = 'Groups You May Join',
    maxDisplay = 8,
  }: {
    groups: GroupSuggestion[];
    onJoin: (groupId: number) => void;
    currentUser: User | null;
    isLoading?: boolean;
    onLoginClick?: () => void;
    onOpenGroup?: (groupId: number) => void;
    onProfileClick?: (userId: number) => void;
    title?: string;
    maxDisplay?: number;
  }) => {
    const [joinLoading, setJoinLoading] = useState<{ [key: number]: boolean }>({});
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const displayGroups = groups.slice(0, maxDisplay);

    const checkScroll = useCallback(() => {
      const el = scrollRef.current;
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 0);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
    }, []);

    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      checkScroll();
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }, [checkScroll, displayGroups.length]);

    const scroll = (direction: 'left' | 'right') => {
      const el = scrollRef.current;
      if (!el) return;
      const scrollAmount = 400;
      el.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    };

    const handleJoin = async (groupId: number) => {
      setJoinLoading((prev) => ({ ...prev, [groupId]: true }));
      try {
        await onJoin(groupId);
      } finally {
        setJoinLoading((prev) => ({ ...prev, [groupId]: false }));
      }
    };

    const handleGroupClick = (groupId: number) => {
      if (onOpenGroup) onOpenGroup(groupId);
    };
    const handleAdminClick = (adminId: number) => {
      if (onProfileClick) onProfileClick(adminId);
    };

    if (isLoading) {
      return (
        <div className="w-full">
          <div className="bg-[#242526] w-full p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[#E4E6EB] font-bold text-[20px]">{title}</h3>
            </div>
            <div className="flex gap-4 overflow-x-hidden py-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-shrink-0 w-[240px] animate-pulse">
                  <div className="h-32 bg-[#3A3B3C] rounded-t-lg"></div>
                  <div className="p-4 bg-[#3A3B3C]">
                    <div className="h-5 bg-[#4E4F50] rounded w-32 mb-3"></div>
                    <div className="h-4 bg-[#4E4F50] rounded w-20 mb-4"></div>
                    <div className="h-10 bg-[#4E4F50] rounded-lg w-full"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
        </div>
      );
    }

    if (displayGroups.length === 0) return null;

    return (
      <div className="w-full">
        <div className="bg-[#242526] w-full p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[#E4E6EB] font-bold text-[20px]">{title}</h3>
            <div className="flex items-center gap-2">
              {canScrollLeft && (
                <button
                  onClick={() => scroll('left')}
                  className="w-9 h-9 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] flex items-center justify-center transition-colors"
                >
                  <i className="fas fa-chevron-left text-[#E4E6EB] text-base"></i>
                </button>
              )}
              {canScrollRight && (
                <button
                  onClick={() => scroll('right')}
                  className="w-9 h-9 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] flex items-center justify-center transition-colors"
                >
                  <i className="fas fa-chevron-right text-[#E4E6EB] text-base"></i>
                </button>
              )}
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {displayGroups.map((group) => (
              <div
                key={group.id}
                className="flex-shrink-0 w-[240px] bg-[#3A3B3C] rounded-xl overflow-hidden hover:bg-[#4E4F50] transition-colors group"
              >
                <div
                  className="h-32 bg-[#4E4F50] cursor-pointer relative"
                  onClick={() => handleGroupClick(group.id)}
                >
                  {group.cover_image ? (
                    <img
                      src={group.cover_image}
                      alt={group.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1877F2] to-[#166FE5]">
                      <i className="fas fa-users text-white text-3xl opacity-50"></i>
                    </div>
                  )}

                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full text-white text-[13px] font-semibold">
                    {group.type === 'public' ? '🌍 Public' : '🔒 Private'}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-12 h-12 rounded-full overflow-hidden bg-[#4E4F50] flex-shrink-0 cursor-pointer border-3 border-[#1877F2] group-hover:border-[#166FE5] transition-colors"
                      onClick={() => handleGroupClick(group.id)}
                    >
                      {group.profile_image ? (
                        <img
                          src={group.profile_image}
                          alt={group.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#3A3B3C]">
                          <i className="fas fa-users text-[#B0B3B8] text-base"></i>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleGroupClick(group.id)}
                        className="text-[#E4E6EB] font-bold text-[17px] truncate w-full text-left hover:underline"
                      >
                        {group.name}
                      </button>
                      <div className="text-[#B0B3B8] text-[13px] truncate">
                        {group.category}
                      </div>
                    </div>
                  </div>

                  <div className="text-[#B0B3B8] text-[13px] mb-3">
                    <i className="fas fa-users mr-1"></i>
                    {group.members_count.toLocaleString()} members
                    {group.mutual_count > 0 && (
                      <span className="ml-1">· {group.mutual_count} mutual</span>
                    )}
                  </div>

                  {onProfileClick && (
                    <div className="text-[#B0B3B8] text-[13px] mb-3">
                      Admin:{' '}
                      <button
                        type="button"
                        onClick={() => handleAdminClick(group.admin_id)}
                        className="text-[#E4E6EB] hover:underline font-medium text-[13px]"
                      >
                        View Admin
                      </button>
                    </div>
                  )}

                  {group.description && (
                    <div className="text-[#B0B3B8] text-[13px] mb-3 line-clamp-2">
                      {group.description}
                    </div>
                  )}

                  {!currentUser ? (
                    <button
                      onClick={onLoginClick}
                      className="w-full py-2.5 bg-[#1877F2] hover:bg-[#166FE5] text-white text-[15px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <i className="fas fa-sign-in-alt text-[13px]"></i>
                      <span>Sign in</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleJoin(group.id)}
                      disabled={joinLoading[group.id] || group.is_member}
                      className={`w-full py-2.5 text-[15px] font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-1 ${
                        group.is_member
                          ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                          : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                      } disabled:opacity-70 disabled:cursor-not-allowed`}
                    >
                      {joinLoading[group.id] ? (
                        <i className="fas fa-spinner fa-spin text-[13px]"></i>
                      ) : (
                        <>
                          <i
                            className={`fas ${
                              group.is_member ? 'fa-check' : 'fa-user-plus'
                            } text-[13px]`}
                          ></i>
                          <span>{group.is_member ? 'Joined' : 'Join Group'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.groups === next.groups &&
      prev.currentUser?.id === next.currentUser?.id &&
      prev.isLoading === next.isLoading
    );
  }
);

// Add CSS for hiding scrollbar
const scrollbarHideStyles = `
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
`;

if (typeof document !== 'undefined') {
  const styleId = 'people-you-may-know-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = scrollbarHideStyles;
    document.head.appendChild(style);
  }
}

// ==================== EVENT HELPERS ====================
const safeParseJsonArray = (v: any): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string') {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) return arr.filter(Boolean).map(String);
    } catch {}
  }
  return [];
};

const getEventCover = (item: any, meta?: any) => {
  const urls = safeParseJsonArray(item?.media_urls);
  if (urls.length > 0) return urls[0];
  if (item?.media_url) return item.media_url;
  if (meta?.cover_url) return meta.cover_url;
  if (meta?.image) return meta.image;
  if (meta?.cover) return meta.cover;
  return '';
};

const normalizeEventFromFeed = (item: any) => {
  const metaRaw = item?.meta || {};
  let meta: any = metaRaw;
  if (typeof metaRaw === 'string') {
    try {
      meta = JSON.parse(metaRaw);
    } catch {
      meta = {};
    }
  }
  const cover = getEventCover(item, meta);
  const id = Number(item?.event_id ?? item?.id ?? meta?.event_id ?? 0);
  return {
    id,
    title: String(item?.content ?? meta?.title ?? 'Event'),
    description: String(item?.event_description ?? meta?.description ?? ''),
    cover_url: String(cover || ''),
    location: String(item?.location ?? meta?.location ?? ''),
    event_date: String(item?.event_date ?? meta?.event_date ?? meta?.start_time ?? ''),
    created_at: String(item?.created_at ?? meta?.created_at ?? ''),
    attendees_count: Number(item?.attending_count ?? meta?.attending_count ?? 0),
    interested_count: Number(item?.interested_count ?? meta?.interested_count ?? 0),
    user_rsvp_status: String(item?.my_rsvp_status ?? meta?.my_rsvp_status ?? ''),
    creator_id: Number(item?.user_id ?? meta?.creator_id ?? 0),
    creator: {
      id: Number(item?.user_id ?? meta?.creator_id ?? 0),
      name: String(item?.name ?? meta?.creator_name ?? 'Event Organizer'),
      username: String(item?.username ?? meta?.creator_username ?? ''),
      profile_image_url: String(item?.profile_image_url ?? meta?.creator_image ?? ''),
    },
  };
};

/**
 * =========================
 * ✅ EVENT POST
 * =========================
 */
export const EventPost = memo(
  ({
    event,
    author,
    currentUser,
    users = [],
    onProfileClick,
    onRSVP,
    onFollow,
    isFollowing = false,
    followLoading = false,
    onReact,
    onShare,
    onOpenComments,
    groups = [],
    brands = [],
    chats = [],
    onEventClick,
  }: {
    event: any;
    author?: any;
    currentUser: User | null;
    users?: User[];
    onProfileClick: (id: number) => void;
    onRSVP?: (eventId: number, status: 'going' | 'interested' | 'not_going') => Promise<any>;
    onFollow?: (id: number) => void;
    isFollowing?: boolean;
    followLoading?: boolean;
    onReact?: (id: number, type: ReactionType) => void;
    onShare?: (id: number, newShareCount: number) => void;
    onOpenComments?: (id: number) => void;
    groups?: Group[];
    brands?: Brand[];
    chats?: any[];
    onEventClick?: (eventId: number) => void;
  }) => {
    const [rsvpStatus, setRsvpStatus] = useState(event.user_rsvp_status || '');
    const [attendeesCount, setAttendeesCount] = useState(
      event.attendees_count || 0
    );
    const [interestedCount, setInterestedCount] = useState(
      event.interested_count || 0
    );
    const [loading, setLoading] = useState(false);
    const [showShareSheet, setShowShareSheet] = useState(false);

    const creator =
      author ||
      users?.find((u) => Number(u.id) === Number(event.creator_id)) ||
      event.creator || {
        id: event.creator_id,
        name: 'Event Organizer',
        username: '',
        profile_image_url: null,
      };

    const dateObj = event.event_date ? toDateSafe(event.event_date) : null;
    const nowLocal = new Date();
    const isPast = !!dateObj && dateObj < nowLocal;

    const formatEventDate = () => {
      if (!dateObj) return 'Date TBD';
      if (dateObj.toDateString() === nowLocal.toDateString()) return 'Today';
      const tomorrow = new Date(nowLocal);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (dateObj.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    };

    const formatEventTime = () => {
      if (!dateObj) return '';
      return dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const handleRSVPClick = async (target: 'going' | 'interested') => {
      if (!currentUser) {
        alert('Please login to RSVP');
        return;
      }
      if (!event.id) return;

      setLoading(true);

      const prevStatus = rsvpStatus;
      const nextStatus: '' | 'going' | 'interested' =
        prevStatus === target ? '' : target;

      const prevAtt = attendeesCount;
      const prevInt = interestedCount;

      let nextAtt = prevAtt;
      let nextInt = prevInt;

      if (target === 'going') {
        if (prevStatus === 'going') nextAtt = Math.max(0, prevAtt - 1);
        else if (prevStatus === 'interested') {
          nextAtt = prevAtt + 1;
          nextInt = Math.max(0, prevInt - 1);
        } else nextAtt = prevAtt + 1;
      } else {
        if (prevStatus === 'interested') nextInt = Math.max(0, prevInt - 1);
        else if (prevStatus === 'going') {
          nextInt = prevInt + 1;
          nextAtt = Math.max(0, prevAtt - 1);
        } else nextInt = prevInt + 1;
      }

      setRsvpStatus(nextStatus);
      setAttendeesCount(nextAtt);
      setInterestedCount(nextInt);

      try {
        let res;
        if (onRSVP) {
          await onRSVP(event.id, (nextStatus || 'not_going') as any);
          res = { success: true };
        } else {
          res = await rsvpEventDirect({
            eventId: event.id,
            userId: safeUserId(currentUser),
            newStatus: (nextStatus || 'not_going') as any,
            prevStatus: prevStatus as any,
          });
        }

        if (res?.success) {
          if (res.attending_count !== undefined) {
            setAttendeesCount(Number(res.attending_count));
          }
          if (res.interested_count !== undefined) {
            setInterestedCount(Number(res.interested_count));
          }
          if (res.my_status !== undefined) {
            setRsvpStatus(res.my_status);
          }
        }
      } catch (error) {
        setRsvpStatus(prevStatus);
        setAttendeesCount(prevAtt);
        setInterestedCount(prevInt);
        console.error('RSVP failed:', error);
        alert('Failed to RSVP. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    const handleFollowClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (onFollow && creator?.id) onFollow(safeUserId(creator));
    };

    const getReactionEndpoint = () =>
      event.id ? `/api/events/${event.id}/react` : null;

    const handleReact = async (type: ReactionType) => {
      if (!currentUser || !event.id || !onReact) return;
      const endpoint = getReactionEndpoint();
      if (!endpoint) return;
      try {
        await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({ user_id: currentUser.id, type: type }),
        });
        onReact(event.id, type);
      } catch (error) {
        console.error('Failed to react to event:', error);
      }
    };

    const handleShare = () => {
      if (!currentUser) alert('Please login to share');
      else setShowShareSheet(true);
    };

    const handleShareComplete = (destination: string, data?: any) => {
      if (onShare && data?.success && event.id) {
        const newShares = data?.shares || 0;
        onShare(event.id, newShares);
      }
      setShowShareSheet(false);
    };

    const handleOpenComments = () => {
      if (onOpenComments && event.id) onOpenComments(event.id);
    };

    const handleCardClick = () => {
      if (onEventClick && event.id) onEventClick(event.id);
    };

    return (
      <>
        <div className="w-full">
          <div
            className="bg-[#242526] w-full overflow-hidden cursor-pointer"
            onClick={handleCardClick}
          >
            <div
              className="p-3 md:p-4 flex items-center justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  creator?.id && onProfileClick(Number(creator.id));
                }}
              >
                <img
                  src={avatarFrom(creator)}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover border border-[#3E4042]"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <h4 className="font-bold text-[#E4E6EB] text-[20px] truncate">
                      {creator?.name || creator?.username || 'User'}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#B0B3B8] text-[15px]">
                    <span>{formatRelativeTime(event.created_at)}</span>
                    <span>•</span>
                    <i className="fas fa-globe-americas text-[14px]"></i>
                    <span>• created an event</span>
                  </div>
                </div>
              </div>

              {onFollow && currentUser && creator?.id && safeUserId(creator) !== safeUserId(currentUser) && (
                <button
                  onClick={handleFollowClick}
                  disabled={followLoading}
                  className={`px-3 py-1.5 text-[15px] font-bold rounded-lg transition-all duration-200 ml-2 ${
                    isFollowing
                      ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                      : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                  } ${followLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {followLoading ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : isFollowing ? (
                    'Following'
                  ) : (
                    'Follow'
                  )}
                </button>
              )}
            </div>

            <div className="pb-4" onClick={(e) => e.stopPropagation()}>
              <div className="border border-[#3E4042] rounded-2xl overflow-hidden bg-[#18191A]">
                {event.cover_url ? (
                  <div className="h-48 bg-[#18191A] overflow-hidden relative">
                    <img
                      src={event.cover_url}
                      alt={event.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          const fallback = document.createElement('div');
                          fallback.className =
                            'h-48 bg-[#1f2a37] flex items-center justify-center';
                          fallback.innerHTML =
                            '<i class="fas fa-calendar text-white/30 text-5xl"></i>';
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                    {dateObj && (
                      <div className="absolute top-3 left-3 bg-[#242526]/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-[#4E4F50]">
                        <div className="text-[#B0B3B8] text-[13px] font-black">
                          {dateObj
                            .toLocaleDateString('en-US', { month: 'short' })
                            .toUpperCase()}
                        </div>
                        <div className="text-[#E4E6EB] text-[22px] font-black leading-tight">
                          {dateObj.getDate()}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-32 bg-[#1f2a37] flex items-center justify-center relative">
                    <i className="fas fa-calendar text-white/30 text-5xl"></i>
                    {dateObj && (
                      <div className="absolute top-3 left-3 bg-[#242526]/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-[#4E4F50]">
                        <div className="text-[#B0B3B8] text-[13px] font-black">
                          {dateObj
                            .toLocaleDateString('en-US', { month: 'short' })
                            .toUpperCase()}
                        </div>
                        <div className="text-[#E4E6EB] text-[22px] font-black leading-tight">
                          {dateObj.getDate()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-4">
                  <div className="text-[#E4E6EB] font-black text-[22px] line-clamp-2">
                    {event.title}
                  </div>

                  {event.description && (
                    <div className="text-[#B0B3B8] text-[16px] mt-1 line-clamp-2">
                      {event.description}
                    </div>
                  )}

                  <div className="mt-3 space-y-2">
                    {event.event_date && (
                      <div className="flex items-center gap-2 text-[#B0B3B8] text-[15px]">
                        <i
                          className={`fas fa-calendar-alt ${
                            isPast ? 'text-[#B0B3B8]' : 'text-[#1877F2]'
                          } w-4`}
                        ></i>
                        <span>
                          {formatEventDate()} at {formatEventTime()}
                        </span>
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-center gap-2 text-[#B0B3B8] text-[15px]">
                        <i className="fas fa-map-marker-alt text-[#F02849] w-4"></i>
                        <span className="line-clamp-1">{event.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[#B0B3B8] text-[15px]">
                      <i className="fas fa-users text-[#45BD62] w-4"></i>
                      <span>
                        {attendeesCount} attending • {interestedCount} interested
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      disabled={loading || isPast}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRSVPClick('going');
                      }}
                      className={`flex-1 h-11 rounded-lg font-bold transition-colors text-[15px] ${
                        isPast ? 'opacity-50 cursor-not-allowed' : ''
                      } ${
                        rsvpStatus === 'going'
                          ? 'bg-[#45BD62] text-white'
                          : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                      } disabled:opacity-60`}
                    >
                      {loading && rsvpStatus === 'going' ? (
                        <i className="fas fa-spinner fa-spin"></i>
                      ) : rsvpStatus === 'going' ? (
                        '✓ Going'
                      ) : (
                        'Going'
                      )}
                    </button>

                    <button
                      disabled={loading || isPast}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRSVPClick('interested');
                      }}
                      className={`flex-1 h-11 rounded-lg font-bold transition-colors text-[15px] ${
                        isPast ? 'opacity-50 cursor-not-allowed' : ''
                      } ${
                        rsvpStatus === 'interested'
                          ? 'bg-[#F7B928] text-black'
                          : 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                      } disabled:opacity-60`}
                    >
                      {loading && rsvpStatus === 'interested' ? (
                        <i className="fas fa-spinner fa-spin"></i>
                      ) : rsvpStatus === 'interested' ? (
                        '✓ Interested'
                      ) : (
                        'Interested'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="px-2 py-1 border-t border-white/10 flex items-center justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-1">
                <ReactionButton
                  currentUserReactions={undefined}
                  reactionCount={0}
                  onReact={handleReact}
                  isGuest={!currentUser}
                />
              </div>
              <button
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group"
                onClick={handleOpenComments}
              >
                <DiscussSignalIcon size={28} color="#1877F2" />
                <span className="text-[19px] font-bold text-[#B0B3B8] group-hover:text-[#E4E6EB]">
                  Discuss
                </span>
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
                onClick={handleShare}
              >
                <i className="fas fa-share text-[22px]"></i>
                <span className="text-[19px] font-bold">Share</span>
              </button>
            </div>
          </div>

          <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
        </div>

        {event && (
          <ShareBottomSheet
            isOpen={showShareSheet}
            onClose={() => setShowShareSheet(false)}
            post={{
              id: event.id,
              author: creator,
              content: event.title,
              description: event.description,
              media_url: event.cover_url,
              created_at: event.created_at,
              source: 'event',
              item_type: 'event',
              event_id: event.id,
            }}
            currentUser={currentUser}
            users={users}
            groups={groups}
            brands={brands}
            chats={chats}
            onShareComplete={handleShareComplete}
          />
        )}
      </>
    );
  },
  eventPostPropsEqual
);

/**
 * =========================
 * ✅ EVENT FEED CARD
 * =========================
 */
type FeedEventItem = {
  id: number;
  feed_key: string;
  item_type: 'event';
  event_id: number;
  user_id: number;
  name: string;
  username: string;
  profile_image_url: string | null;
  created_at: string;
  content: string;
  event_date?: string;
  event_description?: string;
  location?: string;
  media_url?: string | null;
  attending_count?: number;
  interested_count?: number;
  my_rsvp_status?: '' | 'going' | 'interested';
};

export const EventFeedCard = memo(
  ({
    item,
    currentUser,
    onProfileClick,
    onUpdateItem,
    onRSVPEvent,
    onEventClick,
  }: {
    item: FeedEventItem;
    currentUser: { id: number } | null;
    onProfileClick: (id: number) => void;
    onUpdateItem: (patch: Partial<FeedEventItem>) => void;
    onRSVPEvent?: (eventId: number, status: 'going' | 'interested' | 'not_going') => Promise<any>;
    onEventClick?: (eventId: number) => void;
  }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const whenText = useMemo(() => {
      const d = item.event_date ? new Date(item.event_date) : null;
      if (!d || isNaN(d.getTime())) return '';
      return d.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }, [item.event_date]);

    const dateObj = item.event_date ? toDateSafe(item.event_date) : null;
    const nowLocal = new Date();
    const isPast = !!dateObj && dateObj < nowLocal;

    const rsvp = async (target: 'going' | 'interested') => {
      if (!currentUser) {
        alert('Please login to RSVP');
        return;
      }
      setLoading(true);
      setError(null);

      const eventId = item.event_id || item.id;
      const prevStatus = (item.my_rsvp_status || '') as '' | 'going' | 'interested';
      const nextStatus: '' | 'going' | 'interested' =
        prevStatus === target ? '' : target;

      const prevAtt = Number(item.attending_count ?? 0);
      const prevInt = Number(item.interested_count ?? 0);

      let nextAtt = prevAtt;
      let nextInt = prevInt;

      if (target === 'going') {
        if (prevStatus === 'going') nextAtt = Math.max(0, prevAtt - 1);
        else if (prevStatus === 'interested') {
          nextAtt = prevAtt + 1;
          nextInt = Math.max(0, prevInt - 1);
        } else nextAtt = prevAtt + 1;
      } else {
        if (prevStatus === 'interested') nextInt = Math.max(0, prevInt - 1);
        else if (prevStatus === 'going') {
          nextInt = prevInt + 1;
          nextAtt = Math.max(0, prevAtt - 1);
        } else nextInt = prevInt + 1;
      }

      onUpdateItem({
        my_rsvp_status: nextStatus as any,
        attending_count: nextAtt,
        interested_count: nextInt,
      });

      try {
        let res;
        if (onRSVPEvent) {
          await onRSVPEvent(eventId, (nextStatus || 'not_going') as any);
          res = { success: true };
        } else {
          res = await rsvpEventDirect({
            eventId,
            userId: currentUser.id,
            newStatus: (nextStatus || 'not_going') as any,
            prevStatus,
          });
        }

        if (res?.success) {
          const patch: Partial<FeedEventItem> = {};
          if (res.my_status !== undefined) patch.my_rsvp_status = res.my_status;
          if (res.attending_count !== undefined)
            patch.attending_count = Number(res.attending_count);
          if (res.interested_count !== undefined)
            patch.interested_count = Number(res.interested_count);
          onUpdateItem(patch);
        }
      } catch (e: any) {
        onUpdateItem({
          my_rsvp_status: prevStatus as any,
          attending_count: prevAtt,
          interested_count: prevInt,
        });
        setError(e?.message || 'Failed to RSVP. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    const my = item.my_rsvp_status || '';
    const attending = Number(item.attending_count ?? 0);
    const interested = Number(item.interested_count ?? 0);

    const handleCardClick = () => {
      if (onEventClick) {
        const eventId = item.event_id || item.id;
        onEventClick(eventId);
      }
    };

    return (
      <div className="w-full cursor-pointer" onClick={handleCardClick}>
        <div className="bg-[#242526] rounded-xl overflow-hidden border border-[#3E4042]">
          <div
            className="flex items-center gap-3 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={item.profile_image_url || 'https://via.placeholder.com/40'}
              className="w-10 h-10 rounded-full object-cover cursor-pointer border border-[#3E4042]"
              alt=""
              onClick={(e) => {
                e.stopPropagation();
                onProfileClick(item.user_id);
              }}
            />
            <div className="min-w-0">
              <div className="text-[#E4E6EB] font-bold text-[20px] truncate">
                {item.name}
              </div>
              <div className="text-[#B0B3B8] text-[15px]">
                {formatRelativeTime(item.created_at)} • created an event
              </div>
            </div>
          </div>

          {item.media_url ? (
            <div className="w-full h-56 bg-black overflow-hidden relative">
              <img
                src={item.media_url}
                className="w-full h-full object-cover"
                alt=""
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className =
                      'w-full h-56 bg-[#1B1C1D] flex items-center justify-center';
                    fallback.innerHTML =
                      '<i class="fas fa-calendar text-[#1877F2] text-4xl opacity-60"></i>';
                    parent.appendChild(fallback);
                  }
                }}
              />
              {dateObj && (
                <div className="absolute top-3 left-3 bg-[#242526]/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-[#4E4F50]">
                  <div className="text-[#B0B3B8] text-[13px] font-black">
                    {dateObj
                      .toLocaleDateString('en-US', { month: 'short' })
                      .toUpperCase()}
                  </div>
                  <div className="text-[#E4E6EB] text-[22px] font-black leading-tight">
                    {dateObj.getDate()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-40 bg-[#1B1C1D] flex items-center justify-center relative">
              <i className="fas fa-calendar text-[#1877F2] text-4xl opacity-60"></i>
              {dateObj && (
                <div className="absolute top-3 left-3 bg-[#242526]/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-[#4E4F50]">
                  <div className="text-[#B0B3B8] text-[13px] font-black">
                    {dateObj
                      .toLocaleDateString('en-US', { month: 'short' })
                      .toUpperCase()}
                  </div>
                  <div className="text-[#E4E6EB] text-[22px] font-black leading-tight">
                    {dateObj.getDate()}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[#E4E6EB] font-black text-[22px] leading-tight">
              {item.content}
            </div>

            {item.event_description ? (
              <div className="text-[#B0B3B8] text-[16px] mt-2 line-clamp-2">
                {item.event_description}
              </div>
            ) : null}

            <div className="mt-3 space-y-2 text-[#B0B3B8] text-[15px]">
              {whenText ? (
                <div className="flex items-center gap-2">
                  <i
                    className={`fas fa-clock ${
                      isPast ? 'text-[#B0B3B8]' : 'text-[#1877F2]'
                    } w-5`}
                  ></i>
                  <span>{whenText}</span>
                </div>
              ) : null}

              {item.location ? (
                <div className="flex items-center gap-2">
                  <i className="fas fa-map-marker-alt text-[#F02849] w-5"></i>
                  <span className="line-clamp-1">{item.location}</span>
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <i className="fas fa-users text-[#45BD62] w-5"></i>
                <span>
                  {attending} attending • {interested} interested
                </span>
              </div>
            </div>

            {error && (
              <div className="mt-2 text-[15px] text-red-500 bg-red-500/10 p-2 rounded-lg">
                {error}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                disabled={loading || isPast}
                onClick={(e) => {
                  e.stopPropagation();
                  rsvp('going');
                }}
                className={`flex-1 py-2.5 rounded-lg font-bold text-[15px] disabled:opacity-60 transition-colors ${
                  isPast ? 'opacity-50 cursor-not-allowed' : ''
                } ${
                  my === 'going'
                    ? 'bg-[#45BD62] text-white hover:bg-[#3da855]'
                    : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                }`}
              >
                {loading && my === 'going' ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : my === 'going' ? (
                  '✓ Going'
                ) : (
                  'Going'
                )}
              </button>

              <button
                disabled={loading || isPast}
                onClick={(e) => {
                  e.stopPropagation();
                  rsvp('interested');
                }}
                className={`flex-1 py-2.5 rounded-lg font-bold text-[15px] disabled:opacity-60 transition-colors ${
                  isPast ? 'opacity-50 cursor-not-allowed' : ''
                } ${
                  my === 'interested'
                    ? 'bg-[#F7B928] text-black hover:bg-[#e5aa24]'
                    : 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                }`}
              >
                {loading && my === 'interested' ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : my === 'interested' ? (
                  '✓ Interested'
                ) : (
                  'Interested'
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.item.id === next.item.id &&
      prev.item.my_rsvp_status === next.item.my_rsvp_status &&
      prev.item.attending_count === next.item.attending_count &&
      prev.item.interested_count === next.item.interested_count
    );
  }
);

/**
 * =========================
 * ✅ REACTION BUTTON
 * =========================
 */
export const ReactionButton = memo(
  ({
    currentUserReactions,
    reactionCount,
    onReact,
    isGuest,
  }: {
    currentUserReactions: ReactionType | undefined;
    reactionCount: number;
    onReact: (type: ReactionType) => void;
    isGuest?: boolean;
  }) => {
    const [showDock, setShowDock] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewEmoji, setPreviewEmoji] = useState<string>('👍');
    const timerRef = useRef<any>(null);
    const longPressTimerRef = useRef<any>(null);
    const dockRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      ensureReactionStyles();
    }, []);

    const reactionConfig = [
      { type: 'like', icon: '👍', color: '#1877F2', label: 'Like' },
      { type: 'love', icon: '❤️', color: '#F3425F', label: 'Love' },
      { type: 'haha', icon: '😂', color: '#F7B928', label: 'Haha' },
      { type: 'wow', icon: '😮', color: '#F7B928', label: 'Wow' },
      { type: 'sad', icon: '😢', color: '#F7B928', label: 'Sad' },
      { type: 'angry', icon: '😡', color: '#E41E3F', label: 'Angry' },
      { type: 'fire', icon: '🔥', color: '#FF6B35', label: 'Fire' },
      { type: 'party', icon: '🎉', color: '#9C27B0', label: 'Party' },
      { type: 'clap', icon: '👏', color: '#4CAF50', label: 'Clap' },
      { type: 'star', icon: '⭐', color: '#FFD700', label: 'Star' },
      { type: 'thinking', icon: '🤔', color: '#607D8B', label: 'Thinking' },
      { type: 'crying', icon: '😭', color: '#2196F3', label: 'Crying' },
      { type: 'heart_eyes', icon: '🥰', color: '#E91E63', label: 'Heart Eyes' },
      { type: 'kiss', icon: '😘', color: '#FF4081', label: 'Kiss' },
      { type: 'sunglasses', icon: '😎', color: '#00BCD4', label: 'Cool' },
      { type: 'rocket', icon: '🚀', color: '#3F51B5', label: 'Rocket' },
      { type: 'trophy', icon: '🏆', color: '#FF9800', label: 'Trophy' },
      { type: 'crown', icon: '👑', color: '#FFC107', label: 'Crown' },
      { type: 'unicorn', icon: '🦄', color: '#E040FB', label: 'Unicorn' },
      { type: 'rainbow', icon: '🌈', color: '#00E676', label: 'Rainbow' },
      { type: 'money', icon: '💰', color: '#4CAF50', label: 'Money' },
      { type: 'muscle', icon: '💪', color: '#FF5722', label: 'Muscle' },
      { type: 'brain', icon: '🧠', color: '#9C27B0', label: 'Brain' },
      { type: 'lightning', icon: '⚡', color: '#FFEB3B', label: 'Lightning' },
      { type: 'gem', icon: '💎', color: '#00BCD4', label: 'Gem' },
    ] as const;

    const handleMouseEnter = () => {
      if (isGuest) return;
      timerRef.current = setTimeout(() => setShowDock(true), 500);
    };

    const handleMouseLeave = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setTimeout(() => setShowDock(false), 250);
      setShowPreview(false);
    };

    const handleTouchStart = () => {
      if (isGuest) return;
      longPressTimerRef.current = setTimeout(() => {
        setShowDock(true);
        setShowPreview(true);
        setPreviewEmoji('👍');
      }, 600);
    };

    const handleTouchEnd = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      setTimeout(() => setShowPreview(false), 300);
    };

    const handleClick = () => {
      if (isGuest) return alert('Please login to react.');
      if (currentUserReactions) {
        setIsAnimating(true);
        onReact(currentUserReactions);
        setTimeout(() => setIsAnimating(false), 300);
      } else {
        setShowDock(!showDock);
      }
    };

    const handleDockReact = (type: ReactionType) => {
      setIsAnimating(true);
      onReact(type);
      setShowDock(false);
      setShowPreview(false);
      setTimeout(() => setIsAnimating(false), 300);
    };

    const handleEmojiHover = (emoji: string) => {
      if (showPreview) {
        setPreviewEmoji(emoji);
      }
    };

    const activeReaction = currentUserReactions
      ? reactionConfig.find((r) => r.type === currentUserReactions)
      : null;

    return (
      <div
        className="flex-1 relative group"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {showPreview && (
          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-[#242526] rounded-full shadow-2xl p-3 border border-[#3E4042] z-50 reaction-preview">
            <div className="text-4xl">{previewEmoji}</div>
          </div>
        )}

        {showDock && (
          <div
            ref={dockRef}
            className="absolute -top-16 left-0 bg-[#242526] rounded-full shadow-2xl p-2 border border-[#3E4042] z-50 react-pop flex items-center"
          >
            <div className="flex gap-1 overflow-x-auto max-w-[320px] scrollbar-hide px-1 py-1">
              {reactionConfig.map((r) => (
                <div
                  key={r.type}
                  className="text-3xl react-hover cursor-pointer p-1 rounded-full hover:bg-[#3A3B3C] transition-colors flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDockReact(r.type as ReactionType);
                  }}
                  onMouseEnter={() => handleEmojiHover(r.icon)}
                  title={r.label}
                >
                  {r.icon}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`w-full flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-all duration-200 active:scale-95 ${
            isAnimating ? 'scale-110' : ''
          }`}
        >
          {activeReaction ? (
            <>
              <span className="text-[22px] transition-transform duration-300">
                {activeReaction.icon}
              </span>
              <span
                className="text-[19px] font-bold transition-colors duration-300"
                style={{ color: activeReaction.color }}
              >
                React
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center justify-center -mt-[1px]">
                <SparkReactIcon size={28} />
              </span>
              <span className="text-[19px] font-bold text-[#B0B3B8]">React</span>
            </>
          )}
        </button>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.currentUserReactions === next.currentUserReactions &&
      prev.reactionCount === next.reactionCount &&
      prev.isGuest === next.isGuest
    );
  }
);
// ==================== MEDIA HELPERS ====================
const getMediaTypeInfo = (post: any) => {
  const mediaUrl = String(post?.media_url || '');
  const mediaTypeRaw = String(post?.media_type || '').toLowerCase();
  const typeRaw = String(post?.type || '').toLowerCase();

  const cleanUrl = mediaUrl.split('?')[0].split('#')[0];
  const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';

  const isImage =
    typeRaw === 'image' ||
    mediaTypeRaw === 'image' ||
    mediaTypeRaw.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic'].includes(
      ext
    );

  const isVideo =
    typeRaw === 'video' ||
    mediaTypeRaw === 'video' ||
    mediaTypeRaw.startsWith('video/') ||
    ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'flv', 'wmv', '3gp'].includes(ext);

  const isAudio =
    typeRaw === 'audio' ||
    mediaTypeRaw.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext);

  return {
    mediaUrl,
    isImage,
    isVideo,
    isAudio,
    extension: ext,
    mimeType: mediaTypeRaw,
  };
};

type NormalizedMedia = {
  url: string;
  kind: 'image' | 'video';
  width?: number;
  height?: number;
};

const getPostMediaList = (post: any): NormalizedMedia[] => {
  const out: NormalizedMedia[] = [];

  const arrUrls: any[] = Array.isArray(post?.media_urls)
    ? post.media_urls
    : Array.isArray(post?.images)
    ? post.images
    : [];

  for (const u of arrUrls) {
    const url = String(u || '').trim();
    if (!url) continue;
    out.push({
      url,
      kind: 'image',
      width: typeof u === 'object' ? u?.width : undefined,
      height: typeof u === 'object' ? u?.height : undefined,
    });
  }

  const arrMedia: any[] = Array.isArray(post?.media) ? post.media : [];
  for (const m of arrMedia) {
    const url = String(m?.url || m?.media_url || '').trim();
    if (!url) continue;

    const type = String(m?.type || m?.media_type || '').toLowerCase();
    const clean = url.split('?')[0].split('#')[0];
    const ext = clean.split('.').pop()?.toLowerCase() || '';

    const isVideo =
      type.startsWith('video') ||
      ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', '3gp'].includes(ext);

    out.push({
      url,
      kind: isVideo ? 'video' : 'image',
      width: m?.width,
      height: m?.height,
    });
  }

  if (out.length === 0) {
    const single = String(post?.media_url || '').trim();
    if (single) {
      const info = getMediaTypeInfo(post);
      if (info.isVideo) out.push({ url: single, kind: 'video' });
      else if (info.isImage) out.push({ url: single, kind: 'image' });
    }
  }

  return out.filter((x) => x.url);
};

type MediaOrientation = 'portrait' | 'landscape' | 'square';

const getOrientation = (item: {
  width?: number;
  height?: number;
}): MediaOrientation => {
  const w = Number(item?.width || 0);
  const h = Number(item?.height || 0);

  if (!w || !h) return 'square';

  const ratio = w / h;

  if (ratio > 1.15) return 'landscape';
  if (ratio < 0.87) return 'portrait';
  return 'square';
};

const classifyOrientations = (
  media: { width?: number; height?: number }[]
): MediaOrientation[] => media.map(getOrientation);

// ==================== MEDIA GRID (internal) ====================
const MediaGrid = memo(
  ({ media, onOpen }: { media: { url: string }[]; onOpen: (url: string, index: number) => void }) => {
    const total = Array.isArray(media) ? media.length : 0;

    const [measuredMedia, setMeasuredMedia] = useState(media);

    useEffect(() => {
      let cancelled = false;

      const run = async () => {
        const next = await Promise.all(
          media.map(
            (item) =>
              new Promise<{ url: string; width?: number; height?: number }>(
                (resolve) => {
                  if (item.width && item.height) {
                    resolve(item);
                    return;
                  }

                  const img = new Image();
                  img.onload = () => {
                    resolve({
                      ...item,
                      width: img.naturalWidth,
                      height: img.naturalHeight,
                    });
                  };
                  img.onerror = () => resolve(item);
                  img.src = item.url;
                }
              )
          )
        );

        if (!cancelled) {
          setMeasuredMedia(next);
        }
      };

      run();

      return () => {
        cancelled = true;
      };
    }, [media]);

    const visible =
      total <= 4
        ? measuredMedia
        : total === 5
        ? measuredMedia.slice(0, 5)
        : measuredMedia.slice(0, 6);

    const extra =
      total <= 5 ? 0 : total === 6 ? 0 : total - 6;

    const orientations = classifyOrientations(visible);

    const Tile = ({
      url,
      index,
      className,
      showOverlay = false,
    }: {
      url: string;
      index: number;
      className: string;
      showOverlay?: boolean;
    }) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(url, index);
        }}
        className={`relative overflow-hidden ${className}`}
        style={{ borderRadius: 0 }}
      >
        <img
          src={url}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />

        {showOverlay && extra > 0 && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
            <span className="text-white font-bold text-[34px] leading-none">
              +{extra}
            </span>
          </div>
        )}
      </button>
    );

    if (total === 0) return null;

    if (total === 1) {
      return (
        <div className="w-full bg-black">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(visible[0].url, 0);
            }}
            className="w-full block"
          >
            <img
              src={visible[0].url}
              alt=""
              loading="lazy"
              className="w-full h-auto max-h-[650px] object-contain"
            />
          </button>
        </div>
      );
    }

    if (total === 2) {
      return (
        <div className="w-full grid grid-cols-2 gap-[2px] bg-black">
          <Tile url={visible[0].url} index={0} className="h-[320px] w-full" />
          <Tile url={visible[1].url} index={1} className="h-[320px] w-full" />
        </div>
      );
    }

    if (total === 3) {
      return (
        <div className="w-full grid grid-cols-2 gap-[2px] bg-black">
          <Tile url={visible[0].url} index={0} className="h-[420px] w-full" />
          <div className="grid grid-rows-2 gap-[2px] h-[420px]">
            <Tile url={visible[1].url} index={1} className="w-full h-full" />
            <Tile url={visible[2].url} index={2} className="w-full h-full" />
          </div>
        </div>
      );
    }

    if (total === 4) {
      return (
        <div className="w-full grid grid-cols-2 gap-[2px] bg-black">
          <Tile url={visible[0].url} index={0} className="h-[260px] w-full" />
          <Tile url={visible[1].url} index={1} className="h-[260px] w-full" />
          <Tile url={visible[2].url} index={2} className="h-[260px] w-full" />
          <Tile url={visible[3].url} index={3} className="h-[260px] w-full" />
        </div>
      );
    }

    if (total === 5) {
      return (
        <div className="w-full bg-black">
          <div className="grid grid-cols-2 gap-[2px] mb-[2px]">
            <Tile url={visible[0].url} index={0} className="h-[250px] w-full" />
            <Tile url={visible[1].url} index={1} className="h-[250px] w-full" />
          </div>

          <div className="grid grid-cols-3 gap-[2px]">
            <Tile url={visible[2].url} index={2} className="h-[170px] w-full" />
            <Tile url={visible[3].url} index={3} className="h-[170px] w-full" />
            <Tile
              url={visible[4].url}
              index={4}
              className="h-[170px] w-full"
              showOverlay={extra > 0}
            />
          </div>
        </div>
      );
    }

    // Smart 6-image layout based on orientation
    if (total >= 6) {
      const first = orientations[0];
      const second = orientations[1];
      const third = orientations[2];

      const topPortraitPair = first === 'portrait' && second === 'portrait';
      const firstLandscape = first === 'landscape' || second === 'landscape';
      const tallLeft = third === 'portrait';

      // Layout A: Tall left + 3 stacked right - Best when 3rd image is portrait
      if (tallLeft) {
        return (
          <div className="w-full bg-black">
            <div className="grid grid-cols-2 gap-[2px] mb-[2px]">
              <Tile url={visible[0].url} index={0} className="h-[250px] w-full" />
              <Tile url={visible[1].url} index={1} className="h-[250px] w-full" />
            </div>

            <div className="grid grid-cols-2 gap-[2px]">
              <Tile url={visible[2].url} index={2} className="h-[340px] w-full" />
              <div className="grid grid-rows-3 gap-[2px] h-[340px]">
                <Tile url={visible[3].url} index={3} className="w-full h-full" />
                <Tile url={visible[4].url} index={4} className="w-full h-full" />
                <Tile
                  url={visible[5].url}
                  index={5}
                  className="w-full h-full"
                  showOverlay={extra > 0}
                />
              </div>
            </div>
          </div>
        );
      }

      // Layout B: 2 top large + 4 bottom squares - Better for landscapes/squares
      if (firstLandscape || !topPortraitPair) {
        return (
          <div className="w-full bg-black">
            <div className="grid grid-cols-2 gap-[2px] mb-[2px]">
              <Tile url={visible[0].url} index={0} className="h-[230px] w-full" />
              <Tile url={visible[1].url} index={1} className="h-[230px] w-full" />
            </div>

            <div className="grid grid-cols-2 gap-[2px]">
              <Tile url={visible[2].url} index={2} className="h-[170px] w-full" />
              <Tile url={visible[3].url} index={3} className="h-[170px] w-full" />
              <Tile url={visible[4].url} index={4} className="h-[170px] w-full" />
              <Tile
                url={visible[5].url}
                index={5}
                className="h-[170px] w-full"
                showOverlay={extra > 0}
              />
            </div>
          </div>
        );
      }

      // Layout C: 1 big left + 2 stacked right on top, then 3 bottom tiles
      // Good for portrait-heavy first image
      return (
        <div className="w-full bg-black">
          <div className="grid grid-cols-2 gap-[2px] mb-[2px]">
            <Tile url={visible[0].url} index={0} className="h-[320px] w-full" />
            <div className="grid grid-rows-2 gap-[2px] h-[320px]">
              <Tile url={visible[1].url} index={1} className="w-full h-full" />
              <Tile url={visible[2].url} index={2} className="w-full h-full" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-[2px]">
            <Tile url={visible[3].url} index={3} className="h-[150px] w-full" />
            <Tile url={visible[4].url} index={4} className="h-[150px] w-full" />
            <Tile
              url={visible[5].url}
              index={5}
              className="h-[150px] w-full"
              showOverlay={extra > 0}
            />
          </div>
        </div>
      );
    }

    // Fallback for any other case (should not reach here)
    return (
      <div className="w-full grid grid-cols-3 gap-[2px] bg-black">
        <Tile url={visible[0].url} index={0} className="h-[180px] w-full" />
        <Tile url={visible[1].url} index={1} className="h-[180px] w-full" />
        <Tile url={visible[2].url} index={2} className="h-[180px] w-full" />
        <Tile url={visible[3].url} index={3} className="h-[180px] w-full" />
        <Tile url={visible[4].url} index={4} className="h-[180px] w-full" />
        <Tile
          url={visible[5].url}
          index={5}
          className="h-[180px] w-full"
          showOverlay={extra > 0}
        />
      </div>
    );
  },
  (prev, next) => prev.media === next.media
);

// ==================== GROUP POST HEADER (internal) ====================
const GroupPostHeader = memo(
  ({
    post,
    group,
    author,
    onOpenGroup,
    onOpenProfile,
    onOpenMenu,
  }: {
    post: any;
    group?: any;
    author?: any;
    onOpenGroup?: (groupId: number) => void;
    onOpenProfile?: (userId: number) => void;
    onOpenMenu?: () => void;
  }) => {
    const groupName = safeStr(group?.name || post?.group_name);
    const groupId = Number(group?.id || post?.group_id || 0);
    const userName = safeStr(author?.name || post?.name || post?.username);
    const userId = Number(author?.id || post?.user_id || 0);
    const groupImg =
      safeStr(
        group?.profile_image || group?.avatar || group?.image || post?.group_image
      ) || '';
    const userImg =
      safeStr(author?.profile_image_url || author?.avatar || post?.profile_image_url) ||
      '';
    const timeAgo = formatRelativeTime(post?.created_at);

    return (
      <div className="flex items-start justify-between px-3 pt-3">
        <div className="flex items-start gap-3 min-w-0">
          <button
            className="relative shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              if (groupId && onOpenGroup) onOpenGroup(groupId);
            }}
            title={groupName}
          >
            <div className="w-10 h-10 rounded-full bg-[#3A3B3C] overflow-hidden flex items-center justify-center border border-[#4E4F50]">
              {groupImg ? (
                <img src={groupImg} className="w-full h-full object-cover" />
              ) : (
                <i className="fas fa-users text-[#B0B3B8]" />
              )}
            </div>

            <div className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full bg-[#3A3B3C] overflow-hidden border-2 border-[#242526] flex items-center justify-center">
              {userImg ? (
                <img src={userImg} className="w-full h-full object-cover" />
              ) : (
                <i className="fas fa-user text-[10px] text-[#B0B3B8]" />
              )}
            </div>
          </button>

          <div className="min-w-0">
            <button
              className="text-left font-extrabold text-[20px] leading-[1.1] text-[#E4E6EB] truncate hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                if (groupId && onOpenGroup) onOpenGroup(groupId);
              }}
            >
              {groupName || 'Group'}
            </button>

            <div className="flex items-center gap-2 text-[15px] text-[#B0B3B8] min-w-0">
              <button
                className="font-semibold text-[15px] text-[#B0B3B8] hover:underline truncate"
                onClick={(e) => {
                  e.stopPropagation();
                  if (userId && onOpenProfile) onOpenProfile(userId);
                }}
              >
                {userName || 'User'}
              </button>

              <span>·</span>
              <span className="truncate">{timeAgo}</span>

              <span>·</span>
              <i className="fas fa-users text-[14px]" />
            </div>
          </div>
        </div>

        {/* Right menu - Will be handled by PostMenu component */}
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.post?.id === next.post?.id &&
      prev.group?.id === next.group?.id &&
      prev.author?.id === next.author?.id
    );
  }
);

// ==================== EXPANDABLE RICH TEXT (internal) ====================
const ExpandableRichText = memo(
  ({
    text,
    users,
    onProfileClick,
    onHashtagClick,
    maxWords = 14,
    fontSizePx = 23,
    forceExpanded = false,
  }: {
    text: string;
    users?: User[];
    onProfileClick: (id: number) => void;
    onHashtagClick?: (tag: string) => void;
    maxWords?: number;
    fontSizePx?: number;
    forceExpanded?: boolean;
  }) => {
    const [expanded, setExpanded] = useState(false);

    const words = (text || '').trim().split(/\s+/).filter(Boolean);
    const isLong = words.length > maxWords;

    const showAll = forceExpanded || expanded || !isLong;
    const shownText = showAll
      ? text
      : words.slice(0, maxWords).join(' ') + '…';

    return (
      <div
        style={{ fontSize: `${fontSizePx}px` }}
        className="text-[#E4E6EB] leading-relaxed"
      >
        <RichText
          text={shownText}
          users={users}
          onProfileClick={onProfileClick}
          onHashtagClick={onHashtagClick}
        />

        {isLong && !forceExpanded && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="ml-2 font-bold text-[#1877F2] hover:underline text-[16px]"
          >
            {expanded ? 'See less' : 'See more'}
          </button>
        )}
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.text === next.text &&
      prev.forceExpanded === next.forceExpanded &&
      prev.users === next.users
    );
  }
);

// ==================== RICH TEXT (exported) ====================
export const RichText = ({
  text,
  users,
  onProfileClick,
  onHashtagClick,
}: {
  text: string;
  users?: User[];
  onProfileClick: (id: number) => void;
  onHashtagClick?: (tag: string) => void;
}) => {
  if (!text) return null;
  const parts = text.split(/(#[a-zA-Z0-9_]+|@\w+(?:\s\w+)?)/g);

  return (
    <span className="leading-relaxed text-[#E4E6EB] whitespace-pre-wrap break-words text-[23px]">
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          const name = part.substring(1).trim().toLowerCase();
          const user = users?.find((u: any) => {
            const un = String(u?.username ?? '').toLowerCase();
            const nm = String(u?.name ?? '').toLowerCase();
            return un === name || nm === name;
          });

          if (user) {
            return (
              <span
                key={index}
                className="text-[#1877F2] font-semibold cursor-pointer hover:underline text-[23px]"
                onClick={(e) => {
                  e.stopPropagation();
                  onProfileClick(safeUserId(user));
                }}
              >
                {part}
              </span>
            );
          }

          return (
            <span
              key={index}
              className="text-[#1877F2] font-semibold text-[23px]"
            >
              {part}
            </span>
          );
        }

        if (part.startsWith('#')) {
          return (
            <span
              key={index}
              className="text-[#1877F2] cursor-pointer hover:underline text-[23px]"
              onClick={(e) => {
                e.stopPropagation();
                onHashtagClick && onHashtagClick(part);
              }}
            >
              {part}
            </span>
          );
        }

        return <span key={index} className="text-[23px]">{part}</span>;
      })}
    </span>
  );
};

/**
 * =========================
 * ✅ SPONSORED POST CARD
 * =========================
 */
export const SponsoredPostCard = memo(
  ({
    ad,
    currentUser,
    onProfileClick,
    onReact,
    onShare,
    onOpenComments,
    isActive = true,
  }: {
    ad: any;
    currentUser: User | null;
    onProfileClick?: (id: number) => void;
    onReact?: (id: number, type: ReactionType) => void;
    onShare?: (id: number, newShareCount: number) => void;
    onOpenComments?: (post: any) => void;
    isActive?: boolean;
  }) => {
    const [imageError, setImageError] = useState(false);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [showReactionsSheet, setShowReactionsSheet] = useState(false);

    // Record impression when active
    useEffect(() => {
      if (!isActive || !currentUser) return;
      
      fetch("/api/ads/impression", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(currentUser.id),
        },
        body: JSON.stringify({ ad_id: ad.id }),
      }).catch(err => console.error('Failed to record impression:', err));
    }, [ad.id, currentUser, isActive]);

    // Handle click
    const handleClick = () => {
      if (isActive && currentUser) {
        fetch("/api/ads/click", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(currentUser.id),
          },
          body: JSON.stringify({ ad_id: ad.id }),
        }).catch(err => console.error('Failed to record click:', err));
      }

      if (ad.destination_url || ad.cta_url) {
        window.open(ad.destination_url || ad.cta_url, '_blank', 'noopener,noreferrer');
      }
    };

    // Get media URL
    const mediaUrl = !imageError ? 
      (ad.media_url || (ad.media_urls && ad.media_urls[0]) || null) : null;

    // Get advertiser name
    const advertiserName = ad.name || ad.advertiser_name || ad.sponsor_name || 'Sponsored';

    // Get profile image
    const profileImage = avatarFrom({
      profile_image_url: ad.profile_image_url || ad.sponsor_image,
      name: advertiserName,
    });

    // Get original post metrics
    const originalReactionCount = Number(
      ad.original_reactions_count || ad.reactions_count || ad.likes || 0
    );
    
    const originalCommentCount = Number(
      ad.original_comments_count || ad.comments_count || ad.comments?.length || 0
    );
    
    const originalShareCount = Number(
      ad.original_shares_count || ad.shares_count || ad.shares || 0
    );

    const handleReactClick = (type: ReactionType) => {
      if (!currentUser) {
        alert('Please login to react.');
        return;
      }
      onReact?.(ad.id, type);
    };

    const handleShareComplete = (destination: string, data?: any) => {
      const nextShares = safeNumber(data?.shares ?? data?.share_count, NaN);
      if (data?.success && Number.isFinite(nextShares)) {
        onShare?.(ad.id, nextShares);
      }
      setShowShareSheet(false);
    };

    return (
      <>
        <div className="w-full">
          <div className="bg-[#242526] w-full overflow-hidden">
            {/* HEADER */}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <img
                  src={profileImage}
                  className="w-10 h-10 rounded-full object-cover border border-[#3E4042] cursor-pointer"
                  alt={advertiserName}
                  onClick={() => onProfileClick?.(ad.user_id || ad.advertiser_id)}
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(advertiserName)}&background=1877F2&color=fff`;
                  }}
                />

                <div>
                  <div
                    className="font-bold text-[#E4E6EB] text-[20px] cursor-pointer hover:underline flex items-center gap-2"
                    onClick={() => onProfileClick?.(ad.user_id || ad.advertiser_id)}
                  >
                    {advertiserName}
                    {ad.is_verified && (
                      <i className="fas fa-check-circle text-[#1877F2] text-[15px]"></i>
                    )}
                    {/* SPONSORED BADGE - ONLY WHEN ACTIVE */}
                    {isActive && (
                      <span className="bg-[#F7B928] text-black text-[12px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <i className="fas fa-ad text-[10px]"></i>
                        Sponsored
                      </span>
                    )}
                  </div>

                  <div className="flex items-center text-[15px] text-[#B0B3B8]">
                    <span>{formatRelativeTime(ad.created_at)}</span>
                    <span>•</span>
                    <i className="fas fa-globe-americas text-[14px]"></i>
                  </div>
                </div>
              </div>
            </div>

            {/* TITLE */}
            {ad.headline && (
              <div className="px-3 pb-1">
                <h3 className="text-[#E4E6EB] font-bold text-[22px]">
                  {ad.headline}
                </h3>
              </div>
            )}

            {/* DESCRIPTION */}
            {ad.description && (
              <div className="px-3 pb-3 text-[#B0B3B8] text-[17px]">
                {ad.description}
              </div>
            )}

            {/* MEDIA */}
            {mediaUrl && (
              <div 
                onClick={isActive ? handleClick : undefined}
                className={`w-full bg-black ${isActive ? 'cursor-pointer' : ''}`}
              >
                <img
                  src={mediaUrl}
                  alt={ad.headline || 'Sponsored'}
                  className="w-full max-h-[500px] object-cover"
                  loading="lazy"
                  onError={() => setImageError(true)}
                />
              </div>
            )}

            {/* CTA BUTTON - Only when active */}
            {isActive && (ad.destination_url || ad.cta_url) && (
              <div className="px-3 py-2">
                <button
                  onClick={handleClick}
                  className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold py-3 rounded-lg transition-colors text-[17px]"
                >
                  {ad.cta_text || 'Learn More'}
                </button>
              </div>
            )}

            {/* ENGAGEMENT METRICS */}
            <div className="px-3 md:px-4 py-2.5 flex items-center justify-between text-[#B0B3B8] text-[16px] border-t border-[#3E4042]">
              <div className="flex items-center gap-2">
                {originalReactionCount > 0 && (
                  <div
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setShowReactionsSheet(true)}
                  >
                    <div className="flex -space-x-2">
                      <span className="w-[24px] h-[24px] rounded-full bg-[#3A3B3C] border border-[#242526] flex items-center justify-center text-[16px]">
                        👍
                      </span>
                    </div>
                    <span className="text-[17px] text-[#E4E6EB] font-bold">
                      {fmtCount(originalReactionCount)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                {originalCommentCount > 0 && (
                  <span
                    className="hover:underline cursor-pointer text-[16px]"
                    onClick={() => onOpenComments?.(ad)}
                  >
                    {fmtCount(originalCommentCount)} Discussions
                  </span>
                )}
                {originalShareCount > 0 && (
                  <span className="hover:underline text-[16px]">
                    {fmtCount(originalShareCount)} Shares
                  </span>
                )}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="px-2 py-1 border-t border-white/10 flex items-center justify-between">
              <ReactionButton
                currentUserReactions={ad.my_reaction}
                reactionCount={originalReactionCount}
                onReact={handleReactClick}
                isGuest={!currentUser}
              />
              
              <button
                type="button"
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
                onClick={() => onOpenComments?.(ad)}
              >
                <DiscussSignalIcon size={28} color="#1877F2" />
                <span className="text-[19px] font-bold text-[#B0B3B8] group-hover:text-[#E4E6EB]">
                  Discuss
                </span>
              </button>
              
              <button
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
                onClick={() => {
                  if (!currentUser) {
                    alert('Please login to share posts.');
                    return;
                  }
                  setShowShareSheet(true);
                }}
              >
                <i className="fas fa-share text-[22px]"></i>
                <span className="text-[19px] font-bold">Share</span>
              </button>
            </div>
          </div>

          <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
        </div>

        <ShareBottomSheet
          isOpen={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          post={{
            ...ad,
            source: isActive ? 'sponsored' : 'post',
            item_type: isActive ? 'sponsored' : 'post',
          }}
          currentUser={currentUser}
          users={[]}
          groups={[]}
          brands={[]}
          chats={[]}
          onShareComplete={handleShareComplete}
        />

        <ReactionsSheet
          isOpen={showReactionsSheet}
          onClose={() => setShowReactionsSheet(false)}
          postId={ad.id}
          onProfileClick={(id) => onProfileClick?.(id)}
          onOpenComments={() => onOpenComments?.(ad)}
        />
      </>
    );
  },
  (prev, next) => {
    return (
      prev.ad?.id === next.ad?.id &&
      prev.currentUser?.id === next.currentUser?.id &&
      prev.isActive === next.isActive
    );
  }
);
/**
 * =========================
 * ✅ MAIN POST COMPONENT
 * =========================
 */
export const Post = memo(
  ({
    post,
    author,
    currentUser,
    users = [],
    onProfileClick,
    onReact,
    onShare,
    onDelete,
    onEdit,
    onViewImage,
    onOpenComments,
    onVideoClick,
    onPlayAudioTrack,
    onHashtagClick,
    onViewProductFromPost,
    onOpenGroup,
    onOpenAudio,
    onRSVP,
    groups = [],
    brands = [],
    chats = [],
    isFollowing = false,
    onFollow,
    followLoading = false,
    onEventClick,
    onOpenReactions,
    onReport,
    onHide,
    pushButton,
  }: {
    post: PostType;
    author: User | any;
    currentUser: User | null;
    users?: User[];
    onProfileClick: (id: number) => void;
    onReact: (post: PostType, type: ReactionType) => void;
    onShare: (id: number, newShareCount: number) => void;
    onDelete?: (id: number) => void;
    onEdit?: (id: number, content: string) => void;
    onViewImage: (url: string) => void;
    onOpenComments: (post: PostType) => void;
    onVideoClick: (p: PostType) => void;
    onPlayAudioTrack?: (t: AudioTrack) => void;
    onHashtagClick?: (tag: string) => void;
    onViewProductFromPost?: (productId: number) => void;
    onOpenGroup?: (groupId: number) => void;
    onOpenAudio?: (item: any) => void;
    onRSVP?: (eventId: number, status: 'going' | 'interested' | 'not_going') => Promise<void>;
    groups?: Group[];
    brands?: Brand[];
    chats?: any[];
    isFollowing?: boolean;
    onFollow?: (id: number) => void;
    followLoading?: boolean;
    onEventClick?: (eventId: number) => void;
    onOpenReactions?: (postId: number) => void;
    onReport?: (postId: number, reason?: string) => void;
    onHide?: (postId: number) => void;
    pushButton?: React.ReactNode;
  }) => {
    const { onViewProduct, getProductData } = useContext(MarketplaceContext);
    const p: any = post as any;
    const a: any = author as any;
    const meta: any = p?.meta || {};

    const isMarketplace =
      p?.type === 'marketplace' ||
      p?.post_type === 'product' ||
      p?.type === 'product' ||
      p?.kind === 'product' ||
      meta?.type === 'product' ||
      meta?.kind === 'product' ||
      !!p?.product_id ||
      !!p?.meta?.marketplace?.id;

    const isEventPost =
      p?.item_type === 'event' ||
      String(p?.feed_key || '').startsWith('event:') ||
      p?.source === 'event' ||
      p?.type === 'event' ||
      p?.post_type === 'event' ||
      meta?.type === 'event' ||
      meta?.kind === 'event' ||
      !!p?.event_id ||
      !!meta?.event;

    if (isEventPost) {
      const event = normalizeEventFromFeed(p);
      return (
        <EventPost
          event={event}
          author={a}
          currentUser={currentUser}
          users={users}
          onProfileClick={onProfileClick}
          onRSVP={onRSVP}
          onFollow={onFollow}
          isFollowing={isFollowing}
          followLoading={followLoading}
          onReact={(id, type) => onReact(post, type)}
          onShare={onShare}
          onOpenComments={(id) => onOpenComments(post)}
          groups={groups}
          brands={brands}
          chats={chats}
          onEventClick={onEventClick}
        />
      );
    }

    const productId = isMarketplace ? getMarketplaceProductId(p) : null;
    const productData = productId ? getProductData?.(productId) : null;

    const mpImages = isMarketplace ? getMarketplaceImages(p, productData) : [];
    const { price, currency, loc } = isMarketplace
      ? getMarketplacePriceLine(productData)
      : { price: null, currency: 'TZS', loc: 'Marketplace' };

    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [showReactionsSheet, setShowReactionsSheet] = useState(false);
    const [showShareSheet, setShowShareSheet] = useState(false);

    const isMusic = meta?.kind === 'music' || meta?.type === 'music';
    const isPodcast = meta?.kind === 'podcast' || meta?.type === 'podcast';
    const song = meta?.song;
    const podcast = meta?.podcast;

    const isGroupPost = !!(p?.group_id || p?.group);
    const groupId = Number(
      p?.group_id || p?.groupId || meta?.group_id || meta?.groupId || 0
    );
    const groupName =
      p?.group_name || p?.groupName || meta?.group_name || meta?.groupName || '';
    const group = p?.group || groups?.find((g) => g.id === groupId);

    const myReaction = p.myReaction ?? p.my_reaction ?? null;
    const likesCount = Number(
      p.likesCount ?? p.reactionsCount ?? p.reactions_count ?? 0
    );
    const reactionsArr: any[] = Array.isArray(p.reactions)
      ? p.reactions
      : Array.isArray(p.reactions_preview)
      ? p.reactions_preview
      : [];

    const reactorNameFromApi = String(p.reactor_name ?? p.reactorName ?? '').trim();

    const finalMyReaction: ReactionType | undefined =
      myReaction ||
      (currentUser && reactionsArr.length
        ? (reactionsArr.find(
            (r: any) => Number(r.user_id) === safeUserId(currentUser)
          )?.type as ReactionType)
        : undefined);

    const finalReactionCount = likesCount > 0 ? likesCount : reactionsArr.length;

    const [commentCount, setCommentCount] = useState(() => {
      if (typeof p.comments_count === 'number') return p.comments_count;
      if (Array.isArray(p.comments)) return p.comments.length;
      return 0;
    });

    const [shareCount, setShareCount] = useState(() =>
      safeNumber(p.shares ?? p.shares_count, 0)
    );

    const createdAtLabel = formatRelativeTime(p.created_at);
    const postId = safePostId(p);

    const mediaInfo = getMediaTypeInfo(p);
    const mediaList = useMemo(() => getPostMediaList(p), [p]);
    const imageMedia = mediaList.filter((m) => m.kind === 'image');
    const videoMedia = mediaList.filter((m) => m.kind === 'video');

    const formatCount = (count: number): string => {
      if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
      if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
      return count.toString();
    };

    const emojiList = useMemo(() => {
      if (reactionsArr.length > 0) {
        const em = topReactionEmojis(reactionsArr, 2);
        return em.length ? em : ['👍'];
      }
      return finalReactionCount > 0 ? ['👍'] : [];
    }, [reactionsArr, finalReactionCount]);

    const reactorName = useMemo(() => {
      if (!finalReactionCount) return '';
      if (reactionsArr.length) {
        const name = pickStableReactorName(postId, reactionsArr, users);
        return String(name || '').trim();
      }
      return reactorNameFromApi;
    }, [postId, finalReactionCount, reactionsArr, users, reactorNameFromApi]);

    const reactionText = useMemo(() => {
      if (!finalReactionCount || !reactorName) return '';
      return formatReactionText(finalReactionCount, reactorName);
    }, [finalReactionCount, reactorName]);

    useEffect(() => {
      const newCommentCount =
        typeof p.comments_count === 'number'
          ? p.comments_count
          : Array.isArray(p.comments)
          ? p.comments.length
          : 0;
      if (newCommentCount !== commentCount) {
        setCommentCount(newCommentCount);
      }

      const newShareCount = safeNumber(p.shares ?? p.shares_count, 0);
      if (newShareCount !== shareCount) {
        setShareCount(newShareCount);
      }
    }, [p.comments_count, p.comments, p.shares, p.shares_count]);

    const handleShareComplete = (destination: string, data?: any) => {
      const nextShares = safeNumber(data?.shares ?? data?.share_count, NaN);
      if (data?.success && Number.isFinite(nextShares)) {
        setShareCount(nextShares);
        onShare(postId, nextShares);
      }
      setShowShareSheet(false);
    };

    const handleFollowClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (onFollow && a.id) onFollow(safeUserId(a));
    };

    const getReactionEndpoint = (item: any) => {
      if (item.source === 'group_post' || item.item_type === 'group_post')
        return `/api/groups/${item.group_id}/posts/${item.id}/react`;
      else if (item.source === 'product' || item.item_type === 'product')
        return `/api/products/${item.product_id || item.id}/react`;
      else if (item.source === 'reel' || item.item_type === 'reel')
        return `/api/reels/${item.reel_id || item.id}/react`;
      else if (item.source === 'song' || item.item_type === 'song')
        return `/api/songs/${item.song_id2 || item.id}/react`;
      else if (item.source === 'podcast' || item.item_type === 'podcast')
        return `/api/podcasts/${item.podcast_id || item.id}/react`;
      else return `/api/posts/${item.id}/react`;
    };

    const handleReactClick = async (type: ReactionType) => {
      if (!currentUser) {
        alert('Please login to react.');
        return;
      }
      const endpoint = getReactionEndpoint(p);
      try {
        await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({ user_id: currentUser.id, type: type }),
        });
        onReact(post, type);
      } catch (error) {
        console.error('Failed to react:', error);
      }
    };

    const openGallery = (urls: string[], index: number) => {
      setGalleryUrls(urls);
      setGalleryIndex(index);
      setGalleryOpen(true);
    };

    const handleOpenComments = (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (currentUser) {
        onOpenComments(post);
      } else {
        alert('Please login to comment');
      }
    };

    return (
      <>
        <div className="w-full relative">
          <div className="bg-[#242526] w-full overflow-hidden">
            {isGroupPost ? (
              <GroupPostHeader
                post={p}
                group={group}
                author={a}
                onOpenGroup={(id) => onOpenGroup?.(id)}
                onOpenProfile={(id) => onProfileClick(id)}
              />
            ) : (
              <div className="p-3 md:p-4 flex items-center justify-between">
                <div
                  className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                  onClick={() => onProfileClick(safeUserId(a))}
                >
                  <img
                    src={avatarFrom(a)}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-[#3E4042]"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <h4 className="font-bold text-[#E4E6EB] text-[20px] cursor-pointer hover:underline truncate">
                        {a.name || a.username || 'User'}
                      </h4>
                      {a.is_verified && (
                        <i className="fas fa-check-circle text-[#1877F2] text-[15px]"></i>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[#B0B3B8] text-[15px]">
                      <span>{createdAtLabel}</span>
                      <span>•</span>
                      <i className="fas fa-globe-americas text-[14px]"></i>
                      {p.location && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[160px]">
                            {String(p.location).split(',')[0]}
                          </span>
                        </>
                      )}
                      {p.feeling && (
                        <>
                          <span>•</span>
                          <span>feeling {p.feeling}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {onFollow && currentUser && safeUserId(a) !== safeUserId(currentUser) && (
                  <button
                    onClick={handleFollowClick}
                    disabled={followLoading}
                    className={`px-3 py-1.5 text-[15px] font-bold rounded-lg transition-all duration-200 ml-2 ${
                      isFollowing
                        ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                        : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                    } ${followLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {followLoading ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : isFollowing ? (
                      'Following'
                    ) : (
                      'Follow'
                    )}
                  </button>
                )}

                <PostMenu
                  item={{
                    id: postId,
                    user_id: safeUserId(a),
                    type: isMarketplace
                      ? 'product'
                      : isGroupPost
                      ? 'group_post'
                      : 'post',
                    content: p.content,
                    caption: p.caption,
                    group_id: groupId,
                  }}
                  currentUser={currentUser}
                  onShare={(item) => setShowShareSheet(true)}
                />
              </div>
            )}

            {isMarketplace && (
              <div className="px-4 pb-2 flex items-center gap-2 text-[#E4E6EB]">
                <span className="text-[#1877F2] font-bold text-[15px] bg-[#1877F2]/10 px-2 py-1 rounded-full">
                  Marketplace
                </span>
                {loc && (
                  <div className="flex items-center gap-1 text-[#B0B3B8]">
                    <i className="fas fa-map-marker-alt text-[14px] text-[#F02849]"></i>
                    <span className="text-[15px]">{loc}</span>
                  </div>
                )}
              </div>
            )}

            {p.content && !isMarketplace && (
              <div className="px-3 md:px-4 pb-2">
                <ExpandableRichText
                  text={String(p.content)}
                  users={users}
                  onProfileClick={onProfileClick}
                  onHashtagClick={onHashtagClick}
                  maxWords={14}
                  fontSizePx={23}
                />
              </div>
            )}

            {(isMusic || isPodcast) && (
              <div className="mx-3 md:mx-4 mb-3 bg-[#18191A] border border-[#3E4042] rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <img
                    src={
                      (isMusic ? song?.cover_image_url : podcast?.cover_image_url) ||
                      ''
                    }
                    className="w-14 h-14 rounded-xl object-cover bg-[#242526]"
                    alt=""
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="text-white font-bold text-[17px] truncate">
                      {(isMusic ? song?.title : podcast?.title) || 'Untitled'}
                    </div>
                    <div className="text-[#B0B3B8] text-[14px] truncate">
                      {isMusic ? song?.artist_name : podcast?.description}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAudio?.(isMusic ? song : podcast);
                    }}
                    className="bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold px-4 py-2 rounded-xl text-[15px]"
                  >
                    Play
                  </button>
                </div>
              </div>
            )}

            {p.link_preview && !mediaInfo.mediaUrl && !isMarketplace && (
              <div
                className="mx-3 md:mx-4 mb-2 bg-[#242526] border border-[#3E4042] overflow-hidden cursor-pointer hover:bg-[#3A3B3C] transition-colors rounded-lg"
                onClick={() =>
                  window.open(p.link_preview.url, '_blank', 'noopener noreferrer')
                }
              >
                {p.link_preview.image && (
                  <div className="w-full h-48 bg-[#3A3B3C] overflow-hidden">
                    <img
                      src={p.link_preview.image}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="p-4 bg-[#3A3B3C]">
                  <div className="text-[#B0B3B8] text-[13px] uppercase font-bold mb-1">
                    {p.link_preview.domain}
                  </div>
                  <div className="text-[#E4E6EB] font-bold text-[19px] mb-1 line-clamp-2">
                    {p.link_preview.title}
                  </div>
                  <div className="text-[#B0B3B8] text-[16px] line-clamp-3">
                    {p.link_preview.description}
                  </div>
                </div>
              </div>
            )}

            {p.background && !mediaInfo.mediaUrl && !isMarketplace && (
              <div
                className="h-[300px] flex items-center justify-center p-8 text-center text-white font-bold text-2xl"
                style={{ background: p.background, backgroundSize: 'cover' }}
              >
                {p.content}
              </div>
            )}

            {isMarketplace ? (
              <>
                {mpImages.length > 0 && (
                  <div className="w-full">
                    <div className="w-full bg-black">
                      <MediaGrid
                        media={mpImages.map((url) => ({ url }))}
                        onOpen={(url, index) => {
                          openGallery(mpImages, index);
                        }}
                      />
                    </div>
                  </div>
                )}

                {price && (
                  <div className="px-4 py-2 flex items-center justify-between border-t border-[#3E4042] mt-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[#E4E6EB] text-[19px] font-bold">
                        {currency}
                      </span>
                      <span className="text-[#E4E6EB] text-[22px] font-bold">
                        {price}
                      </span>
                    </div>

                    <button
                      className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-1.5 rounded-full font-bold text-[15px] transition-colors shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (productId) onViewProduct?.(productId);
                      }}
                    >
                      View product
                    </button>
                  </div>
                )}

                <div className="px-3 md:px-4 py-2.5 flex items-center justify-between text-[#B0B3B8] text-[16px] border-t border-[#3E4042]">
                  <div className="flex items-center gap-2">
                    {finalReactionCount > 0 && (
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenReactions) {
                            onOpenReactions(postId);
                          } else {
                            setShowReactionsSheet(true);
                          }
                        }}
                      >
                        <div className="flex -space-x-2">
                          {emojiList.slice(0, 2).map((e, i) => (
                            <span
                              key={i}
                              className="w-[24px] h-[24px] rounded-full bg-[#3A3B3C] border border-[#242526] flex items-center justify-center text-[16px]"
                              style={{ zIndex: 10 - i }}
                            >
                              {e}
                            </span>
                          ))}
                        </div>

                        {reactionText && (
                          <span className="text-[17px] text-[#E4E6EB] font-bold">
                            {reactionText}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <span
                      className="hover:underline cursor-pointer text-[16px]"
                      onClick={() => handleOpenComments()}
                    >
                      {formatCount(commentCount)} Discussions
                    </span>
                    {shareCount > 0 && (
                      <span className="hover:underline text-[16px]">
                        {formatCount(shareCount)} Shares
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-2 py-1 border-t border-white/10 flex items-center justify-between">
                  <ReactionButton
                    currentUserReactions={finalMyReaction}
                    reactionCount={finalReactionCount}
                    onReact={handleReactClick}
                    isGuest={!currentUser}
                  />
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenComments(e);
                    }}
                  >
                    <DiscussSignalIcon size={28} color="#1877F2" />
                    <span className="text-[19px] font-bold text-[#B0B3B8] group-hover:text-[#E4E6EB]">
                      Discuss
                    </span>
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
                    onClick={() => {
                      if (!currentUser) {
                        alert('Please login to share posts.');
                        return;
                      }
                      setShowShareSheet(true);
                    }}
                  >
                    <i className="fas fa-share text-[22px]"></i>
                    <span className="text-[19px] font-bold">Share</span>
                  </button>
                  {pushButton && <div className="ml-2">{pushButton}</div>}
                </div>
              </>
            ) : (
              <>
                {!p.background && imageMedia.length > 0 && (
                  <MediaGrid
                    media={imageMedia.map((m) => ({ url: m.url }))}
                    onOpen={(url, index) => {
                      const urls = imageMedia.map((m) => m.url);
                      openGallery(urls, index);
                    }}
                  />
                )}

                {!p.background && videoMedia.length > 0 && (
                  <div
                    className="cursor-pointer relative h-[500px] bg-black"
                    onClick={() => onVideoClick(post)}
                  >
                    <video
                      src={videoMedia[0].url}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      playsInline
                      muted
                      onError={(e) => {
                        console.error('Failed to load video:', videoMedia[0].url);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <i className="fas fa-play text-white text-4xl opacity-50"></i>
                    </div>
                  </div>
                )}

                {!p.background && mediaInfo.mediaUrl && mediaInfo.isAudio && onPlayAudioTrack && (
                  <div className="my-3">
                    {(() => {
                      const cover =
                        (p as any).song_cover_image_url ||
                        imageMedia?.[0]?.url ||
                        a.profile_image_url;

                      const titleText = p.content || 'Audio';
                      const artistText =
                        (p as any).song_artist_name || a.name || 'Unknown';

                      return (
                        <div className="rounded-lg overflow-hidden border border-[#3E4042] bg-[#3A3B3C]">
                          {cover ? (
                            <div className="relative">
                              <img
                                src={cover}
                                alt="Cover"
                                className="w-full h-[260px] md:h-[320px] object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  const img = e.currentTarget as HTMLImageElement;
                                  if (
                                    a.profile_image_url &&
                                    img.src !== a.profile_image_url
                                  ) {
                                    img.src = a.profile_image_url;
                                  }
                                }}
                              />

                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                              <div className="absolute left-3 right-3 bottom-3">
                                <div className="p-3 rounded-lg bg-[#2F3031]/90 border border-[#3E4042] backdrop-blur-sm">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#2F3031] flex-shrink-0">
                                      <img
                                        src={cover}
                                        alt="Mini cover"
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="text-[#E4E6EB] font-bold text-[17px]">
                                        Audio Track
                                      </div>
                                      <div className="text-[#B0B3B8] text-[15px] truncate">
                                        {titleText}
                                      </div>
                                      <div className="text-[#B0B3B8] text-[14px] truncate">
                                        {artistText}
                                      </div>
                                    </div>

                                    <button
                                      onClick={() =>
                                        onPlayAudioTrack!({
                                          id: postId,
                                          title: titleText,
                                          artist: artistText,
                                          url: mediaInfo.mediaUrl,
                                          duration: 0,
                                          coverImage: cover || a.profile_image_url,
                                        })
                                      }
                                      className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-2 rounded-lg font-bold text-[15px] transition-colors flex-shrink-0"
                                    >
                                      <i className="fas fa-play mr-1"></i> Play
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-[#3A3B3C]">
                              <div className="flex items-center gap-3">
                                <i className="fas fa-music text-[#1877F2] text-2xl"></i>
                                <div className="flex-1">
                                  <div className="text-[#E4E6EB] font-bold text-[17px]">
                                    Audio Track
                                  </div>
                                  <div className="text-[#B0B3B8] text-[15px]">
                                    {p.content || 'Listen to audio'}
                                  </div>
                                </div>
                                <button
                                  onClick={() =>
                                    onPlayAudioTrack!({
                                      id: postId,
                                      title: titleText,
                                      artist: artistText,
                                      url: mediaInfo.mediaUrl,
                                      duration: 0,
                                      coverImage: a.profile_image_url,
                                    })
                                  }
                                  className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-2 rounded-lg font-bold text-[15px] transition-colors"
                                >
                                  <i className="fas fa-play mr-1"></i> Play
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="px-3 md:px-4 py-2.5 flex items-center justify-between text-[#B0B3B8] text-[16px] border-t border-[#3E4042]">
                  <div className="flex items-center gap-2">
                    {finalReactionCount > 0 && (
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenReactions) {
                            onOpenReactions(postId);
                          } else {
                            setShowReactionsSheet(true);
                          }
                        }}
                      >
                        <div className="flex -space-x-2">
                          {emojiList.slice(0, 2).map((e, i) => (
                            <span
                              key={i}
                              className="w-[24px] h-[24px] rounded-full bg-[#3A3B3C] border border-[#242526] flex items-center justify-center text-[16px]"
                              style={{ zIndex: 10 - i }}
                            >
                              {e}
                            </span>
                          ))}
                        </div>

                        {reactionText && (
                          <span className="text-[17px] text-[#E4E6EB] font-bold">
                            {reactionText}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <span
                      className="hover:underline cursor-pointer text-[16px]"
                      onClick={() => handleOpenComments()}
                    >
                      {formatCount(commentCount)} Discussions
                    </span>
                    {shareCount > 0 && (
                      <span className="hover:underline text-[16px]">
                        {formatCount(shareCount)} Shares
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-2 py-1 border-t border-white/10 flex items-center justify-between">
                  <ReactionButton
                    currentUserReactions={finalMyReaction}
                    reactionCount={finalReactionCount}
                    onReact={handleReactClick}
                    isGuest={!currentUser}
                  />
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenComments(e);
                    }}
                  >
                    <DiscussSignalIcon size={28} color="#1877F2" />
                    <span className="text-[19px] font-bold text-[#B0B3B8] group-hover:text-[#E4E6EB]">
                      Discuss
                    </span>
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
                    onClick={() => {
                      if (!currentUser) {
                        alert('Please login to share posts.');
                        return;
                      }
                      setShowShareSheet(true);
                    }}
                  >
                    <i className="fas fa-share text-[22px]"></i>
                    <span className="text-[19px] font-bold">Share</span>
                  </button>
                  {pushButton && <div className="ml-2">{pushButton}</div>}
                </div>
              </>
            )}
          </div>

          <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
        </div>

        <ShareBottomSheet
          isOpen={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          post={{
            ...p,
            source: isMarketplace ? 'product' : isGroupPost ? 'group_post' : 'post',
            item_type: isMarketplace ? 'product' : isGroupPost ? 'group_post' : 'post',
            product_id: productId,
            group_id: groupId,
          }}
          currentUser={currentUser}
          users={users}
          groups={groups}
          brands={brands}
          chats={chats}
          onShareComplete={handleShareComplete}
        />

        <ReactionsSheet
          isOpen={showReactionsSheet}
          onClose={() => setShowReactionsSheet(false)}
          postId={postId}
          onProfileClick={onProfileClick}
          onOpenComments={() => onOpenComments(post)}
        />

        <GalleryViewer
          isOpen={galleryOpen}
          urls={galleryUrls}
          startIndex={galleryIndex}
          onClose={() => setGalleryOpen(false)}
          postId={postId}
          currentUser={currentUser}
          reactionCount={finalReactionCount}
          commentCount={commentCount}
          shareCount={shareCount}
          myReaction={finalMyReaction}
          onReact={(type) => onReact(post, type)}
          onOpenComments={() => handleOpenComments()}
          onShare={() => setShowShareSheet(true)}
          onOpenReactions={() => {
            if (onOpenReactions) {
              onOpenReactions(postId);
            } else {
              setShowReactionsSheet(true);
            }
          }}
        />
      </>
    );
  },
  postPropsEqual
);

/**
 * =========================
 * ✅ CREATE POST CARD
 * =========================
 */
export const CreatePost: React.FC<{
  currentUser: User;
  onProfileClick: (id: number) => void;
  onClick: () => void;
  onPhotoClick: () => void;
  onVideoClick: () => void;
  onCreateEventClick: () => void;
}> = ({ currentUser, onProfileClick, onClick, onPhotoClick, onVideoClick, onCreateEventClick }) => (
  <div className="w-full">
    <div className="bg-[#242526] w-full p-3 md:p-4">
      <div className="flex gap-2 mb-3">
        <img
          src={avatarFrom(currentUser)}
          alt=""
          className="w-10 h-10 rounded-full object-cover cursor-pointer border border-[#3E4042]"
          onClick={() => onProfileClick(safeUserId(currentUser))}
        />
        <div
          className="flex-1 bg-[#3A3B3C] rounded-full px-4 py-2 hover:bg-[#4E4F50] cursor-pointer flex items-center transition-colors"
          onClick={onClick}
        >
          <span className="text-[#B0B3B8] text-[19px] truncate">
            What's on your mind,{' '}
            {String((currentUser as any).name || '').split(' ')[0] || 'there'}?
          </span>
        </div>
      </div>

      <div className="border-t border-[#3E4042] pt-2 flex justify-between">
        <div
          className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors"
          onClick={onClick}
        >
          <i className="fas fa-video text-[#F3425F] text-[24px]"></i>
          <span className="text-[#B0B3B8] font-bold text-[17px] hidden sm:block">
            Live Video
          </span>
        </div>

        <div
          className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors"
          onClick={onPhotoClick}
        >
          <i className="fas fa-image text-[#45BD62] text-[24px]"></i>
          <span className="text-[#B0B3B8] font-bold text-[17px] hidden sm:block">
            Photo
          </span>
        </div>

        <div
          className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors"
          onClick={onVideoClick}
        >
          <i className="fas fa-camera text-[#F3425F] text-[24px]"></i>
          <span className="text-[#B0B3B8] font-bold text-[17px] hidden sm:block">
            Video
          </span>
        </div>

        <div
          className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors"
          onClick={onCreateEventClick}
        >
          <i className="fas fa-calendar-alt text-[#F7B928] text-[24px]"></i>
          <span className="text-[#B0B3B8] font-bold text-[17px] hidden sm:block">
            Create Event
          </span>
        </div>
      </div>
    </div>

    <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
  </div>
);

/**
 * =========================
 * ✅ CREATE POST MODAL
 * =========================
 */
export const CreatePostModal = memo(
  ({
    currentUser,
    users,
    onClose,
    onCreatePost,
    onCreateEventClick,
    onOpenRecorder,
  }: {
    currentUser: User;
    users: User[];
    onClose: () => void;
    onCreatePost: (
      text: string,
      files: File[],
      meta?: {
        type?: 'text' | 'image' | 'video';
        visibility?: string;
        location?: string;
        feeling?: string;
        taggedUsers?: number[];
        background?: string;
        linkPreview?: LinkPreview | null;
      }
    ) => void;
    onCreateEventClick?: () => void;
    onOpenRecorder?: () => void;
  }) => {
    const [view, setView] = useState<'main' | 'tag' | 'feeling' | 'location'>('main');
    const [text, setText] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [type, setType] = useState<'text' | 'image' | 'video'>('text');
    const [visibility] = useState<'Public' | 'Friends'>('Public');
    const [activeBackground, setActiveBackground] = useState('');
    const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
    const [isFetchingPreview, setIsFetchingPreview] = useState(false);
    const [taggedUsers, setTaggedUsers] = useState<number[]>([]);
    const [feeling, setFeeling] = useState('');
    const [location, setLocation] = useState('');
    const [locQuery, setLocQuery] = useState('');
    const [locResults, setLocResults] = useState<any[]>([]);
    const [locLoading, setLocLoading] = useState(false);
    const searchTimeout = useRef<any>(null);
    const previewTimeout = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (previewTimeout.current) {
        clearTimeout(previewTimeout.current);
      }

      if (files.length > 0 || activeBackground) {
        setLinkPreview(null);
        return;
      }

      previewTimeout.current = setTimeout(async () => {
        setIsFetchingPreview(true);
        try {
          const preview = await getLinkPreview(text);
          setLinkPreview(preview);
        } catch (error) {
          console.debug('Failed to fetch link preview');
          setLinkPreview(null);
        } finally {
          setIsFetchingPreview(false);
        }
      }, 800);

      return () => {
        if (previewTimeout.current) {
          clearTimeout(previewTimeout.current);
        }
      };
    }, [text, files, activeBackground]);

    useEffect(() => {
      return () => {
        previews.forEach((p) => URL.revokeObjectURL(p));
      };
    }, [previews]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(e.target.files || []);
      if (list.length === 0) return;

      const images = list.filter((f) => f.type.startsWith('image/'));
      const videos = list.filter((f) => f.type.startsWith('video/'));

      if (videos.length > 0) {
        const v = videos[0];
        setFiles([v]);
        setPreviews([URL.createObjectURL(v)]);
        setType('video');
      } else {
        setFiles(images.slice(0, 9));
        setPreviews(images.slice(0, 9).map((f) => URL.createObjectURL(f)));
        setType('image');
      }

      setActiveBackground('');
      setLinkPreview(null);
      setView('main');

      if (e.target) {
        e.target.value = '';
      }
    };

    const handleLocationSearch = async (q: string) => {
      if (q.trim().length < 3) {
        setLocResults([]);
        return;
      }
      setLocLoading(true);
      try {
        const data = await apiFetch(`/api/locations/search?q=${encodeURIComponent(q)}`);
        setLocResults(Array.isArray(data) ? data : []);
      } catch {
        setLocResults([]);
      } finally {
        setLocLoading(false);
      }
    };

    const onLocQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocQuery(val);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => handleLocationSearch(val), 450);
    };

    const canPost = !!text.trim() || files.length > 0 || !!activeBackground;

    const submit = () => {
      if (!canPost) return;
      onCreatePost(text, files, {
        type: files.length ? type : 'text',
        visibility,
        location: location || undefined,
        feeling: feeling || undefined,
        taggedUsers: taggedUsers.length ? taggedUsers : undefined,
        background: activeBackground || undefined,
        linkPreview: linkPreview || null,
      });
      onClose();
    };

    const OptionsItem = ({
      icon,
      color,
      label,
      onClick,
    }: {
      icon: string;
      color: string;
      label: string;
      onClick?: () => void;
    }) => (
      <div
        className="flex items-center gap-3 p-3 hover:bg-[#3A3B3C] active:bg-[#3A3B3C] cursor-pointer transition-colors"
        onClick={onClick}
      >
        <i className={`${icon} text-[26px] w-8 text-center`} style={{ color }}></i>
        <span className="text-[#E4E6EB] text-[19px] font-bold">{label}</span>
      </div>
    );

    if (view === 'tag') {
      return (
        <div className="fixed inset-0 z-[200] bg-[#18191A] flex flex-col animate-slide-up font-sans">
          <div className="flex items-center p-4 border-b border-[#3E4042] gap-4">
            <i
              className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
              onClick={() => setView('main')}
            ></i>
            <h3 className="text-[#E4E6EB] text-[21px] font-bold">Tag People</h3>
            <button
              onClick={() => setView('main')}
              className="ml-auto text-[#1877F2] font-bold text-[17px]"
            >
              Done
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {users
              .filter((u: any) => safeUserId(u) !== safeUserId(currentUser))
              .map((u: any) => (
                <div
                  key={safeUserId(u)}
                  className="flex items-center justify-between p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer"
                  onClick={() =>
                    setTaggedUsers((prev) =>
                      prev.includes(safeUserId(u))
                        ? prev.filter((uid) => uid !== safeUserId(u))
                        : [...prev, safeUserId(u)]
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={avatarFrom(u)}
                      className="w-10 h-10 rounded-full object-cover"
                      alt=""
                    />
                    <span className="text-[#E4E6EB] font-bold text-[17px]">
                      {u.name || u.username || 'User'}
                    </span>
                  </div>
                  {taggedUsers.includes(safeUserId(u)) && (
                    <i className="fas fa-check-circle text-[#1877F2] text-xl"></i>
                  )}
                </div>
              ))}
          </div>
        </div>
      );
    }

    if (view === 'feeling') {
      return (
        <div className="fixed inset-0 z-[200] bg-[#18191A] flex flex-col animate-slide-up font-sans">
          <div className="flex items-center p-4 border-b border-[#3E4042] gap-4">
            <i
              className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
              onClick={() => setView('main')}
            ></i>
            <h3 className="text-[#E4E6EB] text-[21px] font-bold">How are you feeling?</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-2">
            {FEELINGS.map((f) => (
              <div
                key={f}
                className="p-3 bg-[#242526] rounded-lg text-center cursor-pointer hover:bg-[#3A3B3C] text-[#E4E6EB] text-[17px]"
                onClick={() => {
                  setFeeling(f);
                  setView('main');
                }}
              >
                {f}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (view === 'location') {
      return (
        <div className="fixed inset-0 z-[200] bg-[#18191A] flex flex-col animate-slide-up font-sans">
          <div className="flex items-center p-4 border-b border-[#3E4042] gap-4">
            <i
              className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
              onClick={() => setView('main')}
            ></i>
            <h3 className="text-[#E4E6EB] text-[21px] font-bold">Search Location</h3>
          </div>

          <div className="p-4 flex-1 flex flex-col overflow-hidden">
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Where are you?"
                className="w-full bg-[#3A3B3C] rounded-xl p-4 pl-12 text-[#E4E6EB] outline-none focus:ring-2 focus:ring-[#1877F2] transition-all text-[17px]"
                autoFocus
                value={locQuery}
                onChange={onLocQueryChange}
              />
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#B0B3B8]"></i>
              {locLoading && (
                <i className="fas fa-spinner fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-[#1877F2]"></i>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {locResults.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {locResults.map((loc, i) => {
                    const display =
                      loc.display_name ||
                      loc.name ||
                      loc.label ||
                      `${loc.city || ''}${loc.country ? `, ${loc.country}` : ''}`.trim();

                    const title = (display || '').split(',')[0] || 'Location';

                    return (
                      <div
                        key={i}
                        className="flex items-center gap-4 p-4 hover:bg-[#3A3B3C] rounded-xl cursor-pointer border border-[#3E4042]/30 transition-colors group"
                        onClick={() => {
                          setLocation(display);
                          setView('main');
                        }}
                      >
                        <div className="w-12 h-12 bg-[#3A3B3C] rounded-xl flex items-center justify-center group-hover:bg-[#1877F2] transition-colors">
                          <i className="fas fa-location-dot text-[#E4E6EB]"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[#E4E6EB] font-bold block truncate text-[17px]">
                            {title}
                          </span>
                          <span className="text-[#B0B3B8] text-[14px] block truncate">
                            {display}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : locQuery.length >= 3 && !locLoading ? (
                <div className="text-center py-10">
                  <i className="fas fa-map-marked-alt text-4xl text-[#3A3B3C] mb-4"></i>
                  <p className="text-[#B0B3B8] text-[17px]">No matching locations found.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-[14px] font-bold text-[#B0B3B8] uppercase tracking-widest mb-2 px-1">
                    Nearby Suggestions
                  </p>
                  {LOCATIONS_DATA.slice(0, 6).map((loc) => (
                    <div
                      key={loc.name}
                      className="flex items-center gap-4 p-3 hover:bg-[#3A3B3C] rounded-xl cursor-pointer transition-colors"
                      onClick={() => {
                        setLocation(loc.name);
                        setView('main');
                      }}
                    >
                      <div className="w-10 h-10 bg-[#3A3B3C] rounded-full flex items-center justify-center text-xl">
                        {loc.flag}
                      </div>
                      <span className="text-[#E4E6EB] font-bold text-[17px]">{loc.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-[200] bg-[#18191A] flex flex-col animate-slide-up font-sans">
        <div className="flex items-center justify-between p-4 border-b border-[#3E4042]">
          <div className="flex items-center gap-4">
            <i
              className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
              onClick={onClose}
            ></i>
            <h3 className="text-[#E4E6EB] text-[22px] font-bold">Create Post</h3>
          </div>
          <button
            onClick={submit}
            disabled={!canPost}
            className="text-[#E4E6EB] font-bold text-[19px] disabled:text-[#B0B3B8]"
          >
            POST
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={avatarFrom(currentUser)}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <div className="flex items-center gap-1 flex-wrap">
                  <h4 className="font-bold text-[#E4E6EB] text-[19px]">
                    {(currentUser as any).name || (currentUser as any).username || 'User'}
                  </h4>
                  {feeling && (
                    <span className="text-[#E4E6EB] text-[17px]"> is feeling {feeling}</span>
                  )}
                  {location && (
                    <span className="text-[#E4E6EB] text-[17px]">
                      {' '}
                      in {location.split(',')[0]}
                    </span>
                  )}
                  {taggedUsers.length > 0 && (
                    <span className="text-[#E4E6EB] text-[17px]">
                      {' '}
                      with {taggedUsers.length} others
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <div className="bg-[#3A3B3C] rounded-md px-2 py-1 inline-flex items-center gap-1 text-[15px] font-bold text-[#E4E6EB] border border-[#3E4042]">
                    <i className="fas fa-globe-americas text-[14px]"></i>
                    <span>{visibility}</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`relative min-h-[150px] mb-4 transition-all ${
                activeBackground
                  ? 'flex items-center justify-center p-8 rounded-lg text-center min-h-[300px]'
                  : ''
              }`}
              style={{ background: activeBackground, backgroundSize: 'cover' }}
            >
              <textarea
                className={`w-full bg-transparent outline-none text-[#E4E6EB] placeholder-[#B0B3B8] resize-none ${
                  activeBackground
                    ? 'text-center font-bold text-3xl drop-shadow-md placeholder-white/70'
                    : 'text-[26px]'
                }`}
                placeholder="What's on your mind?"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={activeBackground ? 4 : 5}
              />
            </div>

            {isFetchingPreview && (
              <div className="mb-4 p-4 bg-[#242526] border border-[#3E4042] rounded-lg flex items-center justify-center">
                <i className="fas fa-spinner fa-spin text-[#1877F2] mr-2"></i>
                <span className="text-[#B0B3B8] text-[17px]">Loading link preview...</span>
              </div>
            )}

            {linkPreview && files.length === 0 && !activeBackground && (
              <div
                className="mb-4 bg-[#242526] border border-[#3E4042] rounded-lg overflow-hidden cursor-pointer hover:bg-[#3A3B3C] transition-colors"
                onClick={() =>
                  window.open(linkPreview.url, '_blank', 'noopener noreferrer')
                }
              >
                {linkPreview.image && (
                  <img
                    src={linkPreview.image}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-3 bg-[#3A3B3C]">
                  <div className="text-[#B0B3B8] text-[13px] uppercase font-bold mb-1">
                    {linkPreview.domain}
                  </div>
                  <div className="text-[#E4E6EB] font-bold text-[19px] mb-1 line-clamp-1">
                    {linkPreview.title}
                  </div>
                  <div className="text-[#B0B3B8] text-[16px] line-clamp-2">
                    {linkPreview.description}
                  </div>
                </div>
              </div>
            )}

            {previews.length > 0 && (
              <div className="relative rounded-lg overflow-hidden border border-[#3E4042] mb-4">
                <div
                  onClick={() => {
                    setFiles([]);
                    setPreviews([]);
                    setType('text');
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center cursor-pointer hover:bg-black/80 z-10"
                >
                  <i className="fas fa-times text-white"></i>
                </div>

                {type === 'video' ? (
                  <video
                    src={previews[0]}
                    controls
                    className="w-full h-auto max-h-[400px] bg-black"
                  />
                ) : (
                  <div
                    className={`grid ${
                      previews.length === 1 ? 'grid-cols-1' : 'grid-cols-3'
                    } gap-1 bg-black`}
                  >
                    {previews.slice(0, 9).map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        className={`${
                          previews.length === 1
                            ? 'w-full h-auto max-h-[400px] object-contain'
                            : 'w-full h-28 object-cover'
                        }`}
                        alt=""
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {previews.length === 0 && (
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                <div
                  className={`w-8 h-8 rounded-lg cursor-pointer border-2 bg-[#3A3B3C] flex items-center justify-center flex-shrink-0 ${
                    !activeBackground ? 'border-white' : 'border-[#3E4042]'
                  }`}
                  onClick={() => setActiveBackground('')}
                >
                  <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
                    <i className="fas fa-font text-black text-xs"></i>
                  </div>
                </div>

                {BACKGROUNDS.filter((b) => b.id !== 'none').map((bg) => (
                  <div
                    key={bg.id}
                    className={`w-8 h-8 rounded-lg cursor-pointer border-2 flex-shrink-0 ${
                      activeBackground === bg.value ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ background: bg.value, backgroundSize: 'cover' }}
                    onClick={() => setActiveBackground(bg.value)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#3E4042]">
            <OptionsItem
              icon="fas fa-image"
              color="#45BD62"
              label="Photo"
              onClick={() => fileInputRef.current?.click()}
            />

            <OptionsItem
              icon="fas fa-camera"
              color="#F3425F"
              label="Video"
              onClick={() => {
                onClose();
                if (onOpenRecorder) onOpenRecorder();
              }}
            />

            <OptionsItem
              icon="fas fa-user-tag"
              color="#1877F2"
              label="Tag people"
              onClick={() => setView('tag')}
            />
            <OptionsItem
              icon="far fa-smile"
              color="#F7B928"
              label="Feeling/activity"
              onClick={() => setView('feeling')}
            />
            <OptionsItem
              icon="fas fa-map-marker-alt"
              color="#F02849"
              label="Check in"
              onClick={() => setView('location')}
            />
            <div
              className="flex items-center gap-3 p-3 hover:bg-[#3A3B3C] active:bg-[#3A3B3C] cursor-pointer transition-colors border-t border-[#3E4042]/50 mt-2"
              onClick={() => {
                onClose();
                if (onCreateEventClick) onCreateEventClick();
              }}
            >
              <i
                className="fas fa-calendar-alt text-[26px] w-8 text-center"
                style={{ color: '#F7B928' }}
              ></i>
              <span className="text-[#E4E6EB] text-[19px] font-bold">Create Event</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#3E4042]">
          <button
            onClick={submit}
            disabled={!canPost}
            className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold py-3 rounded-lg transition-colors disabled:bg-[#3A3B3C] text-[19px] shadow-sm"
          >
            POST
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
        />
      </div>
    );
  },
  (prev, next) => {
    return prev.currentUser?.id === next.currentUser?.id;
  }
);

// ==================== COMMENTS CACHE ====================
const commentsCache = new Map<number, { data: any[]; timestamp: number; postId: number }>();

/**
 * =========================
 * ✅ COMMENTS SHEET - FIXED VERSION (PRESERVES FULL POST CARD SHAPE)
 * =========================
 */
export const CommentsSheet = memo(
  ({
    post,
    currentUser,
    users,
    onClose,
    onComment,
    onCommentAdded,
    onLikeComment,
    getCommentAuthor,
    onProfileClick,
    onHashtagClick,
    onFollow,
    checkIsFollowing,
    onViewProductFromPost,
    onOpenAudio,
    // Additional props to preserve full card shape
    onReact,
    onShare,
    onVideoClick,
    groups = [],
    brands = [],
    chats = [],
    onOpenGroup,
    onRSVP,
    onEventClick,
    onOpenReactions,
  }: {
    post: PostType;
    currentUser: User;
    users: User[];
    onClose: () => void;
    onComment?: (postId: number, text: string) => void;
    onCommentAdded?: () => void;
    onLikeComment?: (commentId: number) => void;
    getCommentAuthor?: (id: number) => User | undefined;
    onProfileClick: (id: number) => void;
    onHashtagClick?: (tag: string) => void;
    onFollow?: (id: number) => void;
    checkIsFollowing?: (id: number) => boolean;
    onViewProductFromPost?: (productId: number) => void;
    onOpenAudio?: (item: any) => void;
    // New props for preserving full card shape
    onReact: (post: PostType, type: ReactionType) => void;
    onShare: (id: number, newShareCount: number) => void;
    onVideoClick: (post: PostType) => void;
    groups?: Group[];
    brands?: Brand[];
    chats?: any[];
    onOpenGroup?: (groupId: number) => void;
    onRSVP?: (eventId: number, status: 'going' | 'interested' | 'not_going') => Promise<void>;
    onEventClick?: (eventId: number) => void;
    onOpenReactions?: (postId: number) => void;
  }) => {
    const p: any = post as any;
    const postId = safePostId(p);

    const discussionsTopRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [text, setText] = useState('');
    const [comments, setComments] = useState<any[]>([]);
    const [replyTo, setReplyTo] = useState<any | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});

    const getCommentEndpoint = () => {
      const viewerId = safeUserId(currentUser);

      if (p.source === 'event' || p.item_type === 'event') {
        const eventId = p.event_id || p.id;
        return `/api/events/${eventId}/comments?viewerId=${viewerId}`;
      } else if (p.source === 'group_post' || p.item_type === 'group_post') {
        const groupId = p.group_id;
        const postId = p.id;
        return `/api/groups/${groupId}/posts/${postId}/comments?viewerId=${viewerId}`;
      } else if (p.source === 'product' || p.item_type === 'product') {
        const productId = p.product_id || p.id;
        return `/api/products/${productId}/reviews?viewerId=${viewerId}`;
      } else if (p.source === 'reel' || p.item_type === 'reel') {
        const reelId = p.reel_id || p.id;
        return `/api/reels/${reelId}/comments?viewerId=${viewerId}`;
      } else if (p.source === 'song' || p.item_type === 'song') {
        const songId = p.song_id2 || p.id;
        return `/api/songs/${songId}/comments?viewerId=${viewerId}`;
      } else if (p.source === 'podcast' || p.item_type === 'podcast') {
        const podcastId = p.podcast_id || p.id;
        return `/api/podcasts/${podcastId}/comments?viewerId=${viewerId}`;
      } else {
        return `/api/posts/${p.id}/comments?viewerId=${viewerId}`;
      }
    };

    const getAddCommentEndpoint = () => {
      if (p.source === 'event' || p.item_type === 'event') {
        const eventId = p.event_id || p.id;
        return `/api/events/${eventId}/comment`;
      } else if (p.source === 'group_post' || p.item_type === 'group_post') {
        const groupId = p.group_id;
        const postId = p.id;
        return `/api/groups/${groupId}/posts/${postId}/comment`;
      } else if (p.source === 'product' || p.item_type === 'product') {
        const productId = p.product_id || p.id;
        return `/api/products/${productId}/review`;
      } else if (p.source === 'reel' || p.item_type === 'reel') {
        const reelId = p.reel_id || p.id;
        return `/api/reels/${reelId}/comment`;
      } else if (p.source === 'song' || p.item_type === 'song') {
        const songId = p.song_id2 || p.id;
        return `/api/songs/${songId}/comment`;
      } else if (p.source === 'podcast' || p.item_type === 'podcast') {
        const podcastId = p.podcast_id || p.id;
        return `/api/podcasts/${podcastId}/comment`;
      } else {
        return `/api/posts/${p.id}/comment`;
      }
    };

    const getReplyEndpoint = (commentId: number) => {
      if (p.source === 'event' || p.item_type === 'event') {
        return `/api/event-comments/${commentId}/reply`;
      } else if (p.source === 'group_post' || p.item_type === 'group_post') {
        return `/api/group-post-comments/${commentId}/reply`;
      } else if (p.source === 'product' || p.item_type === 'product') {
        return `/api/product-reviews/${commentId}/reply`;
      } else if (p.source === 'reel' || p.item_type === 'reel') {
        return `/api/reel-comments/${commentId}/reply`;
      } else if (p.source === 'song' || p.item_type === 'song') {
        return `/api/song-comments/${commentId}/reply`;
      } else if (p.source === 'podcast' || p.item_type === 'podcast') {
        return `/api/podcast-comments/${commentId}/reply`;
      } else {
        return `/api/comments/${commentId}/reply`;
      }
    };

    const getLikeEndpoint = (commentId: number) => {
      if (p.source === 'event' || p.item_type === 'event') {
        return `/api/event-comments/${commentId}/like`;
      } else if (p.source === 'group_post' || p.item_type === 'group_post') {
        return `/api/group-post-comments/${commentId}/like`;
      } else if (p.source === 'product' || p.item_type === 'product') {
        return `/api/product-reviews/${commentId}/like`;
      } else if (p.source === 'reel' || p.item_type === 'reel') {
        return `/api/reel-comments/${commentId}/like`;
      } else if (p.source === 'song' || p.item_type === 'song') {
        return `/api/song-comments/${commentId}/like`;
      } else if (p.source === 'podcast' || p.item_type === 'podcast') {
        return `/api/podcast-comments/${commentId}/like`;
      } else {
        return `/api/comments/${commentId}/like`;
      }
    };

    useEffect(() => {
      const t = setTimeout(() => {
        discussionsTopRef.current?.scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });
      }, 0);
      return () => clearTimeout(t);
    }, [postId]);

    const resolveAuthor = (c: any) => {
      const uid = Number(
        c?.user_id ?? c?.userId ?? c?.author_id ?? c?.authorId ?? 0
      );

      const u =
        (Number.isFinite(uid) ? users.find((x: any) => Number(x?.id) === uid) : null) ||
        (getCommentAuthor ? getCommentAuthor(uid) : null) ||
        null;

      const name =
        String(c?.author_name ?? c?.authorName ?? '').trim() ||
        String(u?.name ?? '').trim() ||
        String(u?.username ?? '').trim() ||
        'User';

      const image = avatarFrom({
        profile_image_url: c?.author_image ?? c?.authorImage ?? u?.profile_image_url,
        name,
        username: u?.username ?? c?.author_username ?? c?.username,
      });

      return { uid, name, image };
    };

    const getReplyLabel = (comment: any) => {
      const a = resolveAuthor(comment);
      const uid = a.uid;

      const user = users.find((x: any) => Number(x?.id) === uid);
      const username = String(
        comment?.author_username ?? user?.username ?? comment?.username ?? ''
      ).trim();

      const display = username ? `@${username}` : a.name;
      return { ...a, username, display };
    };

    const formatCount = (count: number): string => {
      if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
      if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
      return count.toString();
    };

    const handleLikeComment = async (comment: any) => {
      if (!currentUser) return;

      const optimisticLiked = !comment.liked_by_me;
      const optimisticCount = comment.liked_by_me
        ? Math.max(0, (comment.likes_count || 0) - 1)
        : (comment.likes_count || 0) + 1;

      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id
            ? { ...c, liked_by_me: optimisticLiked, likes_count: optimisticCount }
            : c
        )
      );

      if (onLikeComment) {
        onLikeComment(comment.id);
      }

      try {
        const endpoint = getLikeEndpoint(comment.id);
        await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({ user_id: safeUserId(currentUser) }),
        });
      } catch (error) {
        console.error('Failed to like comment:', error);
        setComments((prev) =>
          prev.map((c) =>
            c.id === comment.id
              ? { ...c, liked_by_me: !optimisticLiked, likes_count: comment.likes_count || 0 }
              : c
          )
        );
      }
    };

    const handleFollowClick = (e: React.MouseEvent, userId: number) => {
      e.stopPropagation();
      e.preventDefault();
      if (onFollow && userId && userId !== safeUserId(currentUser)) {
        onFollow(userId);
      }
    };

    const fetchCommentsSilently = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        const endpoint = getCommentEndpoint();
        const data = await apiFetch(endpoint);
        const arr = Array.isArray(data) ? data : data?.comments || [];

        if (arr.length > 0) {
          setComments(arr);
          commentsCache.set(postId, {
            data: arr,
            timestamp: Date.now(),
            postId,
          });
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return;
        }
        console.debug('Silent comment fetch failed:', error);
      }
    };

    useEffect(() => {
      const initializeComments = async () => {
        const cached = commentsCache.get(postId);
        if (cached) {
          setComments(cached.data);
        }

        const postComments = Array.isArray(p.comments) ? p.comments : [];
        if (postComments.length > 0 && (!cached || postComments.length > cached.data.length)) {
          setComments(postComments);
          commentsCache.set(postId, {
            data: postComments,
            timestamp: Date.now(),
            postId,
          });
        }

        fetchCommentsSilently();
      };

      initializeComments();

      return () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, [postId, p.comments]);

    const idKey = (v: any) => String(v ?? '').trim();

    const buildThreads = (list: any[]) => {
      const roots = list.filter((c) => !c.parent_comment_id);

      const repliesByParent = new Map<string, any[]>();

      list.forEach((c) => {
        const pid = idKey(c.parent_comment_id);
        if (!pid) return;

        if (!repliesByParent.has(pid)) repliesByParent.set(pid, []);
        repliesByParent.get(pid)!.push(c);
      });

      repliesByParent.forEach((arr) => {
        arr.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      });

      return roots.map((root) => ({
        root,
        replies: repliesByParent.get(idKey(root.id)) || [],
      }));
    };

    const toggleThread = (rootId: any, open: boolean) => {
      const key = String(rootId);
      setExpandedThreads((prev) => ({ ...prev, [key]: open }));
    };

    const threads = useMemo(() => buildThreads(comments), [comments]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const t = text.trim();
      if (!t) return;

      const replyDisplay = replyTo?._reply_author?.display;
      const prefix = replyDisplay ? `${replyDisplay} ` : '';
      const finalText = replyTo && !t.startsWith(prefix) ? prefix + t : t;

      const optimisticComment = {
        id: `tmp-${Date.now()}`,
        post_id: postId,
        user_id: safeUserId(currentUser),
        text: finalText,
        parent_comment_id: replyTo?.id || null,
        created_at: new Date().toISOString(),
        replies_count: 0,
        likes_count: 0,
        liked_by_me: false,
      };

      setText('');
      setReplyTo(null);
      setShowEmojiPicker(false);

      setComments((prev) => {
        const next = [...prev, optimisticComment];
        const allComments = commentsCache.get(postId)?.data || [];
        commentsCache.set(postId, {
          data: [...allComments, optimisticComment],
          timestamp: Date.now(),
          postId,
        });
        return next;
      });

      if (onComment) {
        onComment(postId, finalText);
      }

      try {
        let endpoint = '';

        if (replyTo) {
          endpoint = getReplyEndpoint(replyTo.id);
        } else {
          endpoint = getAddCommentEndpoint();
        }

        await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            text: finalText,
            user_id: safeUserId(currentUser),
            parent_comment_id: replyTo?.id || null,
          }),
        });

        if (onCommentAdded) {
          onCommentAdded();
        }

        fetchCommentsSilently();
      } catch (err: any) {
        console.error('Failed to post comment:', err);
      }
    };

    const addEmoji = (emoji: string) => {
      setText((prev) => prev + emoji);
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    };

    useEffect(() => {
      const handleFocus = () => {
        const cached = commentsCache.get(postId);
        if (cached && Date.now() - cached.timestamp > 30000) {
          fetchCommentsSilently();
        }
      };

      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    }, [postId]);

    const renderOneComment = (comment: any, isReply: boolean = false) => {
      const a = resolveAuthor(comment);
      const isCurrentUserComment = a.uid === safeUserId(currentUser);
      const isFollowing = checkIsFollowing ? checkIsFollowing(a.uid) : false;

      return (
        <div className={`flex gap-3 ${isReply ? 'mt-3' : ''}`}>
          <img
            src={a.image}
            className="w-9 h-9 rounded-full object-cover cursor-pointer flex-shrink-0"
            alt=""
            onClick={() => a.uid && onProfileClick(a.uid)}
          />

          <div className="flex-1 min-w-0">
            <div className="mb-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[#E4E6EB] font-bold text-[18px] cursor-pointer hover:underline"
                    onClick={() => a.uid && onProfileClick(a.uid)}
                  >
                    {a.name}
                  </span>
                  <span className="text-[#B0B3B8] text-[14px]">
                    •{' '}
                    {formatRelativeTime(
                      comment.created_at || comment.createdAt || comment.timestamp
                    )}
                  </span>
                </div>

                {onFollow && currentUser && a.uid && !isCurrentUserComment && (
                  <button
                    onClick={(e) => handleFollowClick(e, a.uid)}
                    className={`px-2 py-0.5 text-[14px] font-bold rounded-lg transition-all duration-200 ml-2 ${
                      isFollowing
                        ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                        : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            </div>

            <div className="text-[#E4E6EB] text-[19px] font-bold whitespace-pre-wrap break-words mb-2">
              <RichText
                text={String(comment.text || '')}
                users={users}
                onProfileClick={onProfileClick}
                onHashtagClick={onHashtagClick}
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => handleLikeComment(comment)}
                className={`text-[15px] ${
                  comment.liked_by_me
                    ? 'text-[#1877F2] font-bold'
                    : 'text-[#B0B3B8] hover:text-[#E4E6EB]'
                }`}
              >
                {comment.liked_by_me ? 'Liked' : 'Like'}
              </button>
              <button
                onClick={() => {
                  const target = getReplyLabel(comment);
                  setReplyTo({
                    ...comment,
                    _reply_author: target,
                  });
                  inputRef.current?.focus();
                  setShowEmojiPicker(false);
                }}
                className="text-[15px] text-[#B0B3B8] hover:text-[#E4E6EB]"
              >
                Reply
              </button>
              {comment.likes_count > 0 && (
                <span className="text-[15px] text-[#B0B3B8]">
                  {formatCount(comment.likes_count)} like
                  {comment.likes_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="fixed inset-0 z-[500] bg-[#18191A] flex flex-col">
        <div className="p-4 border-b border-[#3E4042] flex items-center justify-between bg-[#242526] sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-10 h-10 rounded-full hover:bg-[#3A3B3C] flex items-center justify-center transition-colors"
              onClick={onClose}
              aria-label="Back"
            >
              <i className="fas fa-arrow-left text-[#E4E6EB] text-xl"></i>
            </button>
            <div className="text-[#E4E6EB] font-bold text-[22px]">Post</div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-[#B0B3B8] text-[16px]">
              {formatCount(comments.length)} discussions
            </div>
            <button
              type="button"
              className="text-[#1877F2] font-bold text-[17px] hover:underline"
              onClick={onClose}
            >
              See less
            </button>
          </div>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scroll-smooth">
          {/* FULL POST CARD - REUSING THE SAME Post COMPONENT TO PRESERVE ALL CARD SHAPE */}
          <div className="border-b border-[#3E4042]">
            <Post
              post={post}
              author={p.author || {
                name: p.name,
                username: p.username,
                profile_image_url: p.profile_image_url,
                id: p.user_id || p.author_id,
              }}
              currentUser={currentUser}
              users={users}
              onProfileClick={onProfileClick}
              onReact={onReact}
              onShare={onShare}
              onViewImage={(url) => {}}
              onOpenComments={() => {}}
              onVideoClick={onVideoClick}
              onPlayAudioTrack={onOpenAudio}
              onHashtagClick={onHashtagClick}
              onViewProductFromPost={onViewProductFromPost}
              onOpenGroup={onOpenGroup}
              onOpenAudio={onOpenAudio}
              onRSVP={onRSVP}
              groups={groups}
              brands={brands}
              chats={chats}
              onFollow={onFollow}
              onEventClick={onEventClick}
              onOpenReactions={onOpenReactions}
            />
          </div>

          <div className="p-4">
            <div ref={discussionsTopRef} />

            {replyTo && (
              <div className="mb-4 p-3 bg-[#3A3B3C] rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[#B0B3B8] text-[15px]">Replying to</span>
                  <span className="text-[#1877F2] font-bold text-[15px]">
                    {replyTo?._reply_author?.display || replyTo?._reply_author?.name || 'User'}
                  </span>
                </div>
                <button
                  onClick={() => setReplyTo(null)}
                  className="text-[#B0B3B8] hover:text-[#E4E6EB] text-lg"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}

            {showEmojiPicker && (
              <div className="mb-4 p-3 border border-[#3E4042] rounded-lg">
                <div className="flex gap-2 flex-wrap max-h-[120px] overflow-y-auto">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => addEmoji(emoji)}
                      className="text-2xl hover:scale-125 transition-transform p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {comments.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-[#B0B3B8] text-[19px] mb-2">No discussions yet</div>
                <p className="text-[#B0B3B8] text-[15px]">Be the first to start a discussion!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {threads.map(({ root, replies }) => {
                  const rootId = String(root.id);
                  const isExpanded = !!expandedThreads[rootId];
                  const MAX_PREVIEW = 1;
                  const hiddenCount = Math.max(0, replies.length - MAX_PREVIEW);
                  const visibleReplies = isExpanded ? replies : replies.slice(-MAX_PREVIEW);

                  return (
                    <div key={rootId} className="space-y-2">
                      {renderOneComment(root, false)}

                      {!isExpanded && hiddenCount > 0 && (
                        <button
                          type="button"
                          className="ml-12 text-[#1877F2] font-bold text-[16px] hover:underline"
                          onClick={() => toggleThread(rootId, true)}
                        >
                          View previous {hiddenCount} repl
                          {hiddenCount === 1 ? 'y' : 'ies'}
                        </button>
                      )}

                      {visibleReplies.map((reply) => (
                        <div key={String(reply.id)} className="ml-12 relative">
                          <div className="absolute -left-6 top-0 bottom-0 w-[2px] bg-[#3E4042] rounded-full" />
                          {renderOneComment(reply, true)}
                        </div>
                      ))}

                      {isExpanded && replies.length > MAX_PREVIEW && (
                        <button
                          type="button"
                          className="ml-12 text-[#B0B3B8] text-[15px] hover:text-[#E4E6EB]"
                          onClick={() => toggleThread(rootId, false)}
                        >
                          Hide replies
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[#3E4042] bg-[#242526] sticky bottom-0">
          <form className="flex gap-3 items-center" onSubmit={handleSubmit}>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-[#B0B3B8] hover:text-[#E4E6EB] text-2xl p-1 transition-colors"
            >
              😀
            </button>
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                className="w-full bg-[#3A3B3C] text-white rounded-full px-5 py-3 outline-none focus:ring-2 focus:ring-[#1877F2] transition-all text-[17px]"
                placeholder={
                  replyTo
                    ? `Reply to ${replyTo?._reply_author?.display || replyTo?._reply_author?.name || 'user'}...`
                    : 'Write a comment...'
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="text-[#1877F2] font-bold text-[17px] disabled:text-[#B0B3B8] disabled:cursor-not-allowed px-4 py-2 min-w-[60px] transition-colors"
              disabled={!text.trim()}
            >
              Post
            </button>
          </form>
        </div>
      </div>
    );
  },
  (prev, next) => prev.post?.id === next.post?.id && prev.currentUser?.id === next.currentUser?.id
);

/**
 * =========================
 * ✅ SUGGESTED PRODUCTS WIDGET
 * =========================
 */
export const SuggestedProductsWidget = memo(
  ({
    products,
    currentUser,
    onViewProduct,
    onSeeAll,
  }: {
    products: Product[];
    currentUser: User;
    onViewProduct: (product: Product) => void;
    onSeeAll: () => void;
  }) => {
    const suggested = (products || [])
      .filter((p: any) => p.seller_id !== safeUserId(currentUser))
      .slice(0, 4);

    if (suggested.length === 0) return null;

    return (
      <div className="w-full">
        <div className="bg-[#242526] w-full p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[#E4E6EB] font-bold text-[21px]">Marketplace for you</h3>
            <button
              onClick={onSeeAll}
              className="text-[#1877F2] font-bold text-[17px] hover:bg-[#3A3B3C] px-2 py-1 rounded transition-colors"
            >
              See all
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {suggested.map((product: any) => {
              const countryData = MARKETPLACE_COUNTRIES.find((c) =>
                String(product.address || '').toLowerCase().includes(c.name.toLowerCase())
              );
              const symbol = countryData ? countryData.symbol : '$';

              return (
                <div
                  key={String(product.id)}
                  className="cursor-pointer group"
                  onClick={() => onViewProduct(product)}
                >
                  <div className="aspect-square rounded-lg overflow-hidden relative mb-1.5 shadow-sm border border-[#3E4042]">
                    <img
                      src={product.images?.[0]}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[13px] font-bold text-white">
                      {symbol}
                      {product.main_price}
                    </div>
                  </div>
                  <h4 className="text-[#E4E6EB] text-[15px] font-bold truncate px-0.5 leading-tight">
                    {product.title}
                  </h4>
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
      </div>
    );
  },
  (prev, next) => {
    return prev.products === next.products && prev.currentUser?.id === next.currentUser?.id;
  }
);

// ==================== EXPORTED HELPERS ====================
export {
  getMediaTypeInfo,
  getMarketplaceImages,
  getMarketplacePriceLine,
  normalizeEventFromFeed,
  topReactionEmojis,
  safeArray,
  safeNumber,
  safeString,
  safePostId,
  safeUserId,
  avatarFrom,
  formatReelCount,
  getReelAuthorName,
};

/**
 * =========================
 * ✅ FEED PROPS INTERFACE
 * =========================
 */
interface FeedProps {
  feedItems: any[];
  currentUser: User | null;
  users: User[];
  onProfileClick: (id: number) => void;
  onReact: (post: PostType, type: ReactionType) => void;
  onShare: (id: number, newShareCount: number) => void;
  onOpenComments: (post: PostType) => void;
  onViewImage: (url: string) => void;
  onVideoClick: (post: PostType) => void;
  onPlayAudioTrack?: (track: AudioTrack) => void;
  onHashtagClick?: (tag: string) => void;
  onFollow?: (id: number) => void;
  followLoading?: { [key: number]: boolean };
  checkIsFollowing?: (id: number) => boolean;
  groups?: Group[];
  brands?: Brand[];
  chats?: any[];
  onViewProductFromPost?: (productId: number) => void;
  onRSVPEvent?: (eventId: number, status: 'going' | 'interested' | 'not_going') => Promise<void>;
  getPostAuthor?: (post: PostType) => User;
  
  // Push More button props
  onPushMore?: (postId: number) => void;
  pushedPosts?: Record<number, boolean>;
  
  // Reel props
  onOpenReel?: (reelId: number | string) => void;
  onOpenReelMenu?: (reel: any) => void;
  
  // People You May Know props
  peopleYouMayKnow?: any[];
  peopleYouMayKnowInsertIndex1?: number;
  peopleYouMayKnowInsertIndex2?: number;
  onFollowFromPymk?: (id: number) => void;
  pymkLoading?: boolean;
  
  // Groups You May Join props
  groupsYouMayJoin?: any[];
  groupsYouMayJoinInsertIndex?: number;
  onJoinGroupSuggestion?: (groupId: number) => void;
  gymjLoading?: boolean;
  onOpenGroup?: (groupId: number) => void;
  
  // Login
  onLoginClick?: () => void;
}

/**
 * =========================
 * ✅ MAIN FEED COMPONENT
 * =========================
 */
export const Feed = memo(({
  feedItems,
  currentUser,
  users,
  onProfileClick,
  onReact,
  onShare,
  onOpenComments,
  onViewImage,
  onVideoClick,
  onPlayAudioTrack,
  onHashtagClick,
  onFollow,
  followLoading = {},
  checkIsFollowing,
  groups = [],
  brands = [],
  chats = [],
  onViewProductFromPost,
  onRSVPEvent,
  getPostAuthor,
  onPushMore,
  pushedPosts = {},
  onOpenReel,
  onOpenReelMenu,
  peopleYouMayKnow = [],
  peopleYouMayKnowInsertIndex1 = -1,
  peopleYouMayKnowInsertIndex2 = -1,
  onFollowFromPymk,
  pymkLoading = false,
  groupsYouMayJoin = [],
  groupsYouMayJoinInsertIndex = -1,
  onJoinGroupSuggestion,
  gymjLoading = false,
  onOpenGroup,
  onLoginClick,
}: FeedProps) => {
  
  const getStableItemKey = (item: any, prefix: string) => {
    return `${prefix}-${item.id}-${item.feed_key || ''}`;
  };

  return (
    <div className="space-y-2">
      {feedItems.map((item, idx) => {
        // Check if it's a sponsored post
        if (item.type === 'sponsored' || item.ad_type || item.is_sponsored) {
          const isActive = item.campaign_status === 'active' || 
                         (item.end_date && new Date(item.end_date) > new Date());
          
          return (
            <SponsoredPostCard
              key={`sponsored-${item.id}`}
              ad={item}
              currentUser={currentUser}
              onProfileClick={onProfileClick}
              onReact={(id, type) => onReact(item, type)}
              onShare={onShare}
              onOpenComments={(post) => onOpenComments(post)}
              isActive={isActive}
            />
          );
        }

        // Handle reel cards
        if (item.type === 'reel') {
          return (
            <ReelFeedCard
              key={`reel-${item.id}`}
              reel={item.reel || item}
              onOpen={(reelId) => onOpenReel?.(reelId)}
              onOpenMenu={(reel) => onOpenReelMenu?.(reel)}
              onProfileClick={(userId) => onProfileClick(Number(userId))}
            />
          );
        }

        // Handle regular posts
        const postAuthorId = Number((item as any).user_id);
        const isFollowing = checkIsFollowing?.(postAuthorId) || false;
        
        const isPostOwner = currentUser && Number(currentUser.id) === postAuthorId;
        const isAdminUser = currentUser && currentUser.role === 'admin';
        const showPushButton = (isPostOwner || isAdminUser) && onPushMore;

        const showFirstPymk = peopleYouMayKnow && 
          peopleYouMayKnow.length > 0 &&
          peopleYouMayKnowInsertIndex1 >= 0 &&
          idx === peopleYouMayKnowInsertIndex1;

        const showSecondPymk = peopleYouMayKnow && 
          peopleYouMayKnow.length > 0 &&
          peopleYouMayKnowInsertIndex2 >= 0 &&
          idx === peopleYouMayKnowInsertIndex2;

        const showGroupsYouMayJoin = groupsYouMayJoin && 
          groupsYouMayJoin.length > 0 &&
          groupsYouMayJoinInsertIndex >= 0 &&
          idx === groupsYouMayJoinInsertIndex;

        return (
          <React.Fragment key={getStableItemKey(item, 'post')}>
            <Post
              post={item as PostType}
              author={getPostAuthor?.(item as PostType) || item.author || item}
              currentUser={currentUser}
              users={users}
              onProfileClick={onProfileClick}
              onReact={onReact}
              onShare={onShare}
              onViewImage={onViewImage}
              onOpenComments={onOpenComments}
              onVideoClick={onVideoClick}
              onPlayAudioTrack={onPlayAudioTrack}
              groups={groups}
              brands={brands}
              chats={chats}
              onHashtagClick={onHashtagClick}
              isFollowing={isFollowing}
              onFollow={() => onFollow?.(postAuthorId)}
              followLoading={followLoading?.[postAuthorId] || false}
              onViewProductFromPost={onViewProductFromPost}
              onRSVP={onRSVPEvent}
              pushButton={showPushButton ? (
                <button
                  onClick={() => onPushMore?.(item.id)}
                  disabled={pushedPosts?.[item.id]}
                  className={`px-3 py-1 rounded-md text-sm font-semibold ml-2 ${
                    pushedPosts?.[item.id]
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                >
                  {pushedPosts?.[item.id] ? 'Pushed' : 'Push More'}
                </button>
              ) : undefined}
            />

            {showFirstPymk && (
              <PeopleYouMayKnowGrid
                users={peopleYouMayKnow}
                onFollow={(id: number) => onFollowFromPymk?.(id)}
                currentUser={currentUser}
                isLoading={pymkLoading}
                onLoginClick={onLoginClick}
                onProfileClick={onProfileClick}
                title="People You May Know"
                maxDisplay={8}
              />
            )}

            {showSecondPymk && (
              <PeopleYouMayKnowGrid
                users={peopleYouMayKnow}
                onFollow={(id: number) => onFollowFromPymk?.(id)}
                currentUser={currentUser}
                isLoading={pymkLoading}
                onLoginClick={onLoginClick}
                onProfileClick={onProfileClick}
                title="More People You May Know"
                maxDisplay={8}
              />
            )}

            {showGroupsYouMayJoin && (
              <GroupsYouMayJoinCard
                groups={groupsYouMayJoin}
                currentUser={currentUser}
                isLoading={gymjLoading}
                onJoin={(groupId: number) => onJoinGroupSuggestion?.(groupId)}
                onLoginClick={onLoginClick}
                onOpenGroup={(groupId: number) => onOpenGroup?.(groupId)}
                onProfileClick={onProfileClick}
                title="Groups You May Join"
                maxDisplay={8}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}, (prev, next) => {
  return prev.feedItems === next.feedItems && 
         prev.currentUser?.id === next.currentUser?.id;
});

// ==================== ADDITIONAL EXPORTS ====================
export default Feed;

export type { FeedProps, PeopleSuggestion, GroupSuggestion, ReelFeedData, FeedEventItem };

export {
  formatRelativeTime,
  reactionEmoji,
  fmtCount,
  formatReactionText,
  formatViewCount,
  getPostTextPreview,
  toDateSafe,
  safeJsonArray,
  getMarketplaceProductId,
  getPostMediaList,
  getOrientation,
  classifyOrientations,
};

export { BACKGROUNDS, FEELINGS, QUICK_EMOJIS };

export const getPostType = (post: any): string => {
  if (post?.type === 'sponsored' || post?.ad_type) return 'sponsored';
  if (post?.type === 'reel' || post?.item_type === 'reel') return 'reel';
  if (post?.type === 'event' || post?.item_type === 'event') return 'event';
  if (post?.type === 'product' || post?.marketplace) return 'product';
  if (post?.group_id || post?.group) return 'group_post';
  return 'post';
};

export const isVideoPost = (post: any): boolean => {
  const mediaInfo = getMediaTypeInfo(post);
  return mediaInfo.isVideo || (post?.media_type === 'video');
};

export const isImagePost = (post: any): boolean => {
  const mediaInfo = getMediaTypeInfo(post);
  return mediaInfo.isImage || (post?.media_type === 'image');
};

export const isAudioPost = (post: any): boolean => {
  const mediaInfo = getMediaTypeInfo(post);
  return mediaInfo.isAudio || (post?.media_type === 'audio');
};

// CSS injection
const injectGlobalStyles = () => {
  if (typeof document === 'undefined') return;
  
  const styleId = 'feed-global-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes slide-up {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      
      .animate-slide-up {
        animation: slide-up 0.3s ease-out;
      }
      
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #3A3B3C;
        border-radius: 10px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #B0B3B8;
        border-radius: 10px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #E4E6EB;
      }
      
      .line-clamp-1 {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      
      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      
      .line-clamp-3 {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  }
};

if (typeof window !== 'undefined') {
  injectGlobalStyles();
}

export const FEED_VERSION = '2.0.0';
export const LAST_UPDATED = '2024-03-25';
