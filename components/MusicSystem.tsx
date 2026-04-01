import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { Song, Episode, AudioTrack, User, ReactionType, Comment } from '../types';

/* =========================================================
   CONSTANTS & DEFAULTS
========================================================= */
const DEFAULT_MUSIC_COVER = 'https://media.unera.social/task_01kftb3024ed7bm84gy6j485fh_1769336848_img_0.webp';
const DEFAULT_PODCAST_COVER = 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';

/* =========================================================
   SPARK REACT ICON (same as Feed.tsx)
========================================================= */
const SparkReactIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="uneraSparkGrad" x1="12" y1="52" x2="52" y2="12">
        <stop offset="0%" stopColor="#FF7A45" />
        <stop offset="55%" stopColor="#FF5A6A" />
        <stop offset="100%" stopColor="#FF8A3D" />
      </linearGradient>
      <filter id="uneraSparkGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <circle cx="32" cy="32" r="18" fill="url(#uneraSparkGrad)" opacity="0.14" />
    <g stroke="url(#uneraSparkGrad)" strokeWidth="5.2" strokeLinecap="round" filter="url(#uneraSparkGlow)">
      <line x1="32" y1="10" x2="32" y2="18" />
      <line x1="32" y1="46" x2="32" y2="54" />
      <line x1="10" y1="32" x2="18" y2="32" />
      <line x1="46" y1="32" x2="54" y2="32" />
      <line x1="17" y1="17" x2="22.8" y2="22.8" />
      <line x1="41.2" y1="41.2" x2="47" y2="47" />
      <line x1="47" y1="17" x2="41.2" y2="22.8" />
      <line x1="22.8" y1="41.2" x2="17" y2="47" />
    </g>
    <circle cx="32" cy="32" r="6.2" fill="url(#uneraSparkGrad)" />
  </svg>
);

const DiscussSignalIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 28,
  color = '#1877F2',
}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <g fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 20c0-5 4-9 9-9h18c7 0 13 6 13 13v6c0 7-6 13-13 13H30l-9 7v-7h-1c-6 0-10-4-10-10V20z" />
      <circle cx="27" cy="30" r="2.2" />
      <circle cx="33" cy="30" r="2.2" />
      <circle cx="39" cy="30" r="2.2" />
      <path d="M48 18c3 2 5 5 6 9" />
      <path d="M44 22c2 1 3 3 4 6" />
    </g>
  </svg>
);

/* =========================================================
   HELPER COMPONENTS FOR MODERN FEED LAYOUT
========================================================= */

const formatCompactNumber = (value: number | string | undefined) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${n}`;
};

const SectionTitle: React.FC<{ title: string; subtitle?: string; onMore?: () => void; }> = ({ title, subtitle, onMore }) => (
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="text-[28px] leading-none font-extrabold text-white">{title}</h2>
      {subtitle ? <p className="text-[#9CA3AF] text-sm mt-1">{subtitle}</p> : null}
    </div>
    <button onClick={onMore} className="text-[#00E5FF] font-semibold text-sm hover:opacity-80" type="button">
      More <i className="fas fa-angle-double-right ml-1"></i>
    </button>
  </div>
);

const QuickActionCircle: React.FC<{ icon: string; label: string; onClick?: () => void; }> = ({ icon, label, onClick }) => (
  <button type="button" onClick={onClick} className="flex flex-col items-center min-w-[74px] group">
    <div className="w-16 h-16 rounded-full bg-[#07E8F8] text-black flex items-center justify-center shadow-[0_0_18px_rgba(7,232,248,0.25)] group-hover:scale-105 transition-transform">
      <i className={`${icon} text-[26px]`}></i>
    </div>
    <span className="text-white text-sm mt-2 font-medium">{label}</span>
  </button>
);

const FeaturedBannerCard: React.FC<{ song: Song; artistName: string; onPlay: () => void; }> = ({ song, artistName, onPlay }) => (
  <div onClick={onPlay} className="relative h-[220px] rounded-2xl overflow-hidden cursor-pointer border border-white/10">
    <img src={song.cover || DEFAULT_MUSIC_COVER} alt={song.title} className="absolute inset-0 w-full h-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent"></div>
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
    <div className="relative z-10 h-full flex items-end justify-between p-4">
      <div className="max-w-[70%]">
        <p className="text-[#07E8F8] text-xs font-bold uppercase tracking-wider mb-2">Featured</p>
        <h3 className="text-white text-2xl font-extrabold leading-tight line-clamp-2">{song.title}</h3>
        <p className="text-white/80 mt-1 text-sm">{artistName}</p>
        <div className="mt-3 inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 text-xs text-white">
          <i className="fas fa-headphones"></i>
          <span>{formatCompactNumber((song.stats as any)?.plays)} plays</span>
        </div>
      </div>
      <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
        <i className="fas fa-play text-lg ml-1"></i>
      </div>
    </div>
  </div>
);

const MusicFeedCard: React.FC<{
  song: Song;
  isLiked: boolean;
  artistName: string;
  artistAvatar?: string | null;
  verified?: boolean;
  badge?: string;
  badgeColor?: string;
  onPlay: () => void;
  onLike: () => void;
  onArtistClick?: () => void;
}> = ({
  song,
  isLiked,
  artistName,
  artistAvatar,
  verified,
  badge,
  badgeColor = 'bg-black/60 text-white',
  onPlay,
  onLike,
  onArtistClick,
}) => (
  <div className="w-[160px] sm:w-[175px] flex-shrink-0 snap-start">
    <div onClick={onPlay} className="group cursor-pointer">
      <div className="relative rounded-xl overflow-hidden aspect-[1/1] bg-[#1A1A1A]">
        <img src={song.cover || DEFAULT_MUSIC_COVER} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {badge ? (
          <div className={`absolute top-2 left-2 text-[11px] px-2 py-1 rounded-full font-bold ${badgeColor}`}>
            {badge}
          </div>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLike();
          }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center"
        >
          <i className={`${isLiked ? 'fas text-[#FF4D8D]' : 'far text-white'} fa-heart text-sm`}></i>
        </button>
        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
          <div className="flex items-center justify-between text-white text-xs">
            <span className="inline-flex items-center gap-1">
              <i className="fas fa-headphones text-[10px]"></i>
              {formatCompactNumber((song.stats as any)?.plays)}
            </span>
            <span>{(song as any).duration || '3:00'}</span>
          </div>
        </div>
      </div>
      <div className="mt-2">
        <h3 className="text-white text-[15px] font-semibold leading-tight line-clamp-1">{song.title}</h3>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onArtistClick?.();
          }}
          className="mt-1 flex items-center gap-2 max-w-full text-left"
        >
          {artistAvatar ? (
            <img src={artistAvatar} alt={artistName} className="w-4 h-4 rounded-full object-cover" />
          ) : null}
          <span className="text-[#B8BCC7] text-sm truncate inline-flex items-center gap-1">
            {artistName}
            {verified ? <i className="fas fa-check-circle text-[#07E8F8] text-[10px]"></i> : null}
          </span>
        </button>
      </div>
    </div>
  </div>
);

const HorizontalMusicRow: React.FC<{
  title: string;
  subtitle?: string;
  songs: Song[];
  users: User[];
  isTrackLiked: (id: string | number, type: 'music' | 'podcast') => boolean;
  onPlaySong: (song: Song) => void;
  onLikeSong: (id: string) => void;
  onArtistClick: (id: number) => void;
  badgeBuilder?: (song: Song, index: number) => { text?: string; className?: string };
}> = ({
  title,
  subtitle,
  songs,
  users,
  isTrackLiked,
  onPlaySong,
  onLikeSong,
  onArtistClick,
  badgeBuilder,
}) => {
  if (!songs.length) return null;
  return (
    <div className="mb-8">
      <SectionTitle title={title} subtitle={subtitle} />
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
        {songs.map((song, index) => {
          const uploaderProfile = users.find((u) => u.id === song.uploaderId);
          const artistName = uploaderProfile?.name || uploaderProfile?.username || song.artist;
          const artistAvatar = (uploaderProfile as any)?.profileImage || (uploaderProfile as any)?.profile_image_url || null;
          const badge = badgeBuilder?.(song, index);
          return (
            <MusicFeedCard
              key={song.id}
              song={song}
              isLiked={isTrackLiked(String(song.id), 'music')}
              artistName={artistName}
              artistAvatar={artistAvatar}
              verified={Boolean((uploaderProfile as any)?.isVerified || (uploaderProfile as any)?.is_verified)}
              badge={badge?.text}
              badgeColor={badge?.className}
              onPlay={() => onPlaySong(song)}
              onLike={() => onLikeSong(String(song.id))}
              onArtistClick={() => song.uploaderId && onArtistClick(song.uploaderId)}
            />
          );
        })}
      </div>
    </div>
  );
};

/* =========================================================
   REACTION BUTTON COMPONENT (with Spark icon - same as Feed.tsx)
========================================================= */

const reactionEmoji = (t: string) => {
  switch (t) {
    case 'like': return '👍';
    case 'love': return '❤️';
    case 'haha': return '😂';
    case 'wow': return '😮';
    case 'sad': return '😢';
    case 'angry': return '😡';
    case 'fire': return '🔥';
    case 'party': return '🎉';
    case 'clap': return '👏';
    case 'star': return '⭐';
    default: return '👍';
  }
};

const ReactionButton: React.FC<{
  currentUserReactions: ReactionType | undefined;
  reactionCount: number;
  onReact: (type: ReactionType) => void;
  isGuest?: boolean;
}> = ({ currentUserReactions, reactionCount, onReact, isGuest }) => {
  const [showDock, setShowDock] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewEmoji, setPreviewEmoji] = useState<string>('👍');
  const timerRef = useRef<any>(null);
  const longPressTimerRef = useRef<any>(null);
  const dockRef = useRef<HTMLDivElement>(null);

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
              {reactionCount > 0 ? formatCompactNumber(reactionCount) : 'React'}
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center justify-center -mt-[1px]">
              <SparkReactIcon size={28} />
            </span>
            <span className="text-[19px] font-bold text-[#B0B3B8]">
              {reactionCount > 0 ? formatCompactNumber(reactionCount) : 'React'}
            </span>
          </>
        )}
      </button>
    </div>
  );
};

/* =========================================================
   COMMENTS SHEET MODAL
========================================================= */

const CommentsSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  track: AudioTrack;
  currentUser: User | null;
  users: User[];
  onProfileClick: (id: number) => void;
  onCommentAdded?: () => void;
}> = ({ isOpen, onClose, track, currentUser, users, onProfileClick, onCommentAdded }) => {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchComments = useCallback(async () => {
    if (!track?.id) return;
    setLoading(true);
    try {
      const endpoint = track.type === 'music'
        ? `/api/songs/${track.id}/comments`
        : `/api/podcasts/${track.id}/comments`;
      
      const res = await apiJson<any[]>(endpoint, { method: 'GET' });
      if (res.success) {
        setComments(res.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  }, [track]);

  useEffect(() => {
    if (isOpen && track?.id) {
      fetchComments();
    }
  }, [isOpen, track?.id, fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !currentUser || !track?.id) return;

    setSubmitting(true);
    try {
      const endpoint = track.type === 'music'
        ? `/api/songs/${track.id}/comment`
        : `/api/podcasts/${track.id}/comment`;
      
      const res = await apiJson<any>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.id, text: text.trim() }),
      });

      if (res.success) {
        setText('');
        fetchComments();
        onCommentAdded?.();
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatRelativeTime = (dateInput: any): string => {
    if (!dateInput) return 'Just now';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Just now';
    const now = Date.now();
    let diffMs = now - d.getTime();
    if (diffMs < 0) diffMs = 0;
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return 'Just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return min === 1 ? '1 min' : `${min} mins`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return hrs === 1 ? '1 hr' : `${hrs} hrs`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return days === 1 ? '1 day' : `${days} days`;
    return new Date(dateInput).toLocaleDateString();
  };

  if (!isOpen) return null;

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
          <div className="text-[#E4E6EB] font-bold text-[22px]">Discussions</div>
        </div>
        <button
          type="button"
          className="text-[#1877F2] font-bold text-[17px] hover:underline"
          onClick={onClose}
        >
          Done
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-3 mb-6 p-3 bg-[#3A3B3C] rounded-xl">
          <div className="w-12 h-12 rounded-lg overflow-hidden">
            <img src={track.cover || DEFAULT_MUSIC_COVER} className="w-full h-full object-cover" alt="" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[#E4E6EB] font-bold text-[17px] truncate">{track.title}</div>
            <div className="text-[#B0B3B8] text-[15px] truncate">{track.artist}</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <i className="fas fa-spinner fa-spin text-[#1877F2] text-2xl"></i>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-[#B0B3B8] text-[19px] mb-2">No discussions yet</div>
            <p className="text-[#B0B3B8] text-[15px]">Be the first to start a discussion!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment: any) => {
              const author = users.find((u) => u.id === comment.user_id) || comment.user;
              const authorName = author?.name || author?.username || 'User';
              const authorAvatar = author?.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=1877F2&color=fff`;
              
              return (
                <div key={comment.id} className="flex gap-3">
                  <img
                    src={authorAvatar}
                    className="w-9 h-9 rounded-full object-cover cursor-pointer flex-shrink-0"
                    alt=""
                    onClick={() => author?.id && onProfileClick(author.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[#E4E6EB] font-bold text-[18px] cursor-pointer hover:underline"
                        onClick={() => author?.id && onProfileClick(author.id)}
                      >
                        {authorName}
                      </span>
                      <span className="text-[#B0B3B8] text-[14px]">
                        • {formatRelativeTime(comment.created_at)}
                      </span>
                    </div>
                    <div className="text-[#E4E6EB] text-[19px] font-bold whitespace-pre-wrap break-words mb-2">
                      {comment.text}
                    </div>
                    <div className="flex items-center gap-4">
                      <button className="text-[15px] text-[#B0B3B8] hover:text-[#E4E6EB]">
                        Like
                      </button>
                      <button className="text-[15px] text-[#B0B3B8] hover:text-[#E4E6EB]">
                        Reply
                      </button>
                      {comment.likes_count > 0 && (
                        <span className="text-[15px] text-[#B0B3B8]">
                          {formatCompactNumber(comment.likes_count)} like{comment.likes_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[#3E4042] bg-[#242526] sticky bottom-0">
        <form className="flex gap-3 items-center" onSubmit={handleSubmit}>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              className="w-full bg-[#3A3B3C] text-white rounded-full px-5 py-3 outline-none focus:ring-2 focus:ring-[#1877F2] transition-all text-[17px]"
              placeholder="Write a comment..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!currentUser}
            />
          </div>
          <button
            type="submit"
            className="text-[#1877F2] font-bold text-[17px] disabled:text-[#B0B3B8] disabled:cursor-not-allowed px-4 py-2 min-w-[60px] transition-colors"
            disabled={!text.trim() || submitting || !currentUser}
          >
            {submitting ? <i className="fas fa-spinner fa-spin"></i> : 'Post'}
          </button>
        </form>
        {!currentUser && (
          <p className="text-[#B0B3B8] text-sm text-center mt-2">Please login to comment</p>
        )}
      </div>
    </div>
  );
};

/* =========================================================
   SHARE BOTTOM SHEET MODAL
========================================================= */

const ShareBottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  track: AudioTrack;
  currentUser: User | null;
  users?: User[];
  groups?: any[];
  onShareComplete?: (destination: string, data?: any) => void;
}> = ({ isOpen, onClose, track, currentUser, users = [], groups = [], onShareComplete }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleBackdropClick = (e: MouseEvent) => {
      if (backdropRef.current && e.target === backdropRef.current) closeSheet();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) closeSheet();
    };
    if (isOpen) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);
      document.body.style.overflow = 'hidden';
      document.addEventListener('click', handleBackdropClick);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('click', handleBackdropClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const closeSheet = () => {
    setIsAnimating(true);
    setTimeout(() => {
      onClose();
      setIsAnimating(false);
    }, 200);
  };

  const handleShareAction = async (destination: string) => {
    if (!currentUser) {
      alert('Please login to share.');
      return;
    }
    try {
      const endpoint = track.type === 'music'
        ? `/api/songs/${track.id}/share`
        : `/api/podcasts/${track.id}/share`;
      
      const response = await apiJson<any>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.id, destination }),
      });

      if (response.success) {
        if (onShareComplete) {
          onShareComplete(destination, { success: true, data: response });
        }
        alert(`Shared to ${destination}!`);
        closeSheet();
      }
    } catch (error: any) {
      console.error('Share failed:', error);
      alert(error?.message || 'Failed to share');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        ref={backdropRef}
        className={`fixed inset-0 bg-black/60 z-[300] transition-opacity duration-300 ${
          isAnimating ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 z-[301] bg-[#242526] rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col transition-transform duration-300 ease-out ${
          isAnimating ? 'translate-y-full' : 'translate-y-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 pb-2">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 bg-[#3E4042] rounded-full"></div>
          </div>
          
          <div className="flex items-start gap-3 mb-4 p-3 bg-[#3A3B3C] rounded-xl">
            <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
              <img src={track.cover || DEFAULT_MUSIC_COVER} alt={track.title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[#E4E6EB] font-semibold text-[15px]">{track.title}</span>
              </div>
              <p className="text-[#B0B3B8] text-[15px] line-clamp-2">{track.artist}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-1">
            <button
              onClick={() => handleShareAction('feed')}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#3A3B3C] active:bg-[#4E4F50] transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#1877F215] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <i className="fas fa-newspaper text-[#1877F2] text-lg"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#E4E6EB] font-medium text-[17px]">Share to UNERA Feed</div>
                <div className="text-[#B0B3B8] text-[13px] mt-0.5">Share to your profile feed</div>
              </div>
              <i className="fas fa-chevron-right text-[#B0B3B8] text-[15px]"></i>
            </button>

            <button
              onClick={() => handleShareAction('message')}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#3A3B3C] active:bg-[#4E4F50] transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#1877F215] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <i className="fas fa-comment-alt text-[#1877F2] text-lg"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#E4E6EB] font-medium text-[17px]">Send as a Message</div>
                <div className="text-[#B0B3B8] text-[13px] mt-0.5">Share via direct message</div>
              </div>
              <i className="fas fa-chevron-right text-[#B0B3B8] text-[15px]"></i>
            </button>

            <button
              onClick={() => {
                const text = `Check out this track on UNERA: ${track.title} by ${track.artist}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                closeSheet();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#3A3B3C] active:bg-[#4E4F50] transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#25D36615] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <i className="fab fa-whatsapp text-[#25D366] text-lg"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#E4E6EB] font-medium text-[17px]">Send via WhatsApp</div>
                <div className="text-[#B0B3B8] text-[13px] mt-0.5">Share to WhatsApp</div>
              </div>
            </button>

            <button
              onClick={() => {
                const url = `${window.location.origin}/music/${track.id}`;
                navigator.clipboard.writeText(url);
                alert('Link copied to clipboard!');
                closeSheet();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#3A3B3C] active:bg-[#4E4F50] transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#1877F215] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <i className="fas fa-link text-[#1877F2] text-lg"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#E4E6EB] font-medium text-[17px]">Copy Track Link</div>
                <div className="text-[#B0B3B8] text-[13px] mt-0.5">Copy link to clipboard</div>
              </div>
            </button>
          </div>
        </div>

        <div className="p-4 pt-3 border-t border-[#3E4042]">
          <button
            onClick={closeSheet}
            className="w-full py-3 bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] font-semibold rounded-xl transition-colors text-[17px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};

/* =========================================================
   API CLIENT (safe JSON parsing + auth + errors)
========================================================= */

type ApiResult<T> = { success: true; data: T } | { success: false; error: string; data?: any };

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('unera_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const safeParseJson = async (res: Response) => {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
};

async function apiJson<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    });

    const payload = await safeParseJson(res);

    if (!res.ok) {
      return { success: false, error: (payload?.error || payload?.message || `API Error: ${res.status}`) as string, data: payload };
    }

    const data = (payload?.data ?? payload) as T;
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
  }
}

async function apiForm<T>(endpoint: string, form: FormData, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(endpoint, {
      method: options.method || 'POST',
      ...options,
      body: form,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    });

    const payload = await safeParseJson(res);

    if (!res.ok) {
      return { success: false, error: (payload?.error || payload?.message || `API Error: ${res.status}`) as string, data: payload };
    }

    const data = (payload?.data ?? payload) as T;
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
  }
}

/* =========================================================
   MAPPERS (backend -> UI types)
========================================================= */

function mapSongFromApi(s: any): Song {
  const plays = Number(s.plays_count ?? s.plays ?? s.stats?.plays ?? 0);
  const likes = Number(s.likes_count ?? s.likes ?? s.stats?.likes ?? 0);
  
  let cover = s.cover_image_url || s.cover || DEFAULT_MUSIC_COVER;
  
  if (!cover || cover.trim() === '' || 
      cover.includes('ui-avatars.com') || 
      !cover.startsWith('http')) {
    cover = DEFAULT_MUSIC_COVER;
  }

  return {
    id: String(s.id),
    title: s.title || 'Untitled',
    artist: s.artist_name || s.artist || 'Unknown Artist',
    cover: cover,
    audioUrl: s.audio_url || s.audioUrl || '',
    duration: s.duration || s.duration_seconds || '3:00',
    uploaderId: Number(s.uploader_id ?? s.uploaderId ?? 0) || 0,
    uploadDate: s.created_at || s.uploadDate || new Date().toISOString(),
    genre: s.genre || '',
    album: s.album_name || s.album || 'Single',
    isVerified: Boolean(s.is_verified || s.isVerified),
    stats: {
      plays,
      likes,
      shares: Number(s.shares_count ?? s.shares ?? s.stats?.shares ?? 0),
      downloads: Number(s.downloads_count ?? s.downloads ?? s.stats?.downloads ?? 0),
      reelsUse: Number(s.reels_use_count ?? s.reelsUse ?? s.stats?.reelsUse ?? 0),
    },
  } as any;
}

function mapEpisodeFromApi(e: any): Episode {
  const plays = Number(e.plays_count ?? e.plays ?? e.stats?.plays ?? 0);
  const likes = Number(e.likes_count ?? e.likes ?? e.stats?.likes ?? 0);
  
  let thumbnail = e.cover_url || e.cover_image_url || e.thumbnail || DEFAULT_PODCAST_COVER;
  
  if (!thumbnail || thumbnail.trim() === '' || 
      thumbnail.includes('ui-avatars.com') || 
      !thumbnail.startsWith('http')) {
    thumbnail = DEFAULT_PODCAST_COVER;
  }

  return {
    id: String(e.id),
    title: e.title || 'Untitled',
    description: e.description || '',
    host: e.host || e.artist_name || 'Unknown Host',
    thumbnail: thumbnail,
    audioUrl: e.audio_url || e.audioUrl || '',
    duration: e.duration || e.duration_seconds || '45:00',
    uploaderId: Number(e.creator_id ?? e.uploader_id ?? e.uploaderId ?? 0) || 0,
    uploadDate: e.created_at || e.uploadDate || new Date().toISOString(),
    season: e.season || '',
    episode: e.episode || '',
    guests: e.guests || '',
    stats: {
      plays,
      likes,
      shares: Number(e.shares_count ?? e.shares ?? e.stats?.shares ?? 0),
      downloads: Number(e.downloads_count ?? e.downloads ?? e.stats?.downloads ?? 0),
      reelsUse: Number(e.reels_use_count ?? e.reelsUse ?? e.stats?.reelsUse ?? 0),
    },
  } as any;
}

/* =========================================================
   MODERN GLOBAL AUDIO PLAYER (Optimized for Mobile)
========================================================= */

interface GlobalAudioPlayerProps {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  onDownload: (id: string) => void;
  onLike: (id: string, type: 'music' | 'podcast') => void;
  onArtistClick?: (uploaderId: number) => void;
  isLiked: boolean;
  uploaderProfile?: User | null;
  ownerUser?: User | null;
  totalPlays?: number;
  totalPlaysLoading?: boolean;
  onStarted?: (track: AudioTrack) => void;
  reactionCount?: number;
  commentCount?: number;
  shareCount?: number;
  myReaction?: ReactionType;
  onReact?: (track: AudioTrack, type: ReactionType) => void;
  onOpenComments?: (track: AudioTrack) => void;
  onShare?: (track: AudioTrack) => void;
}

export const GlobalAudioPlayer: React.FC<GlobalAudioPlayerProps> = ({
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrevious,
  onClose,
  onDownload,
  onLike,
  onArtistClick,
  isLiked,
  uploaderProfile,
  ownerUser,
  totalPlays = 0,
  totalPlaysLoading = false,
  onStarted,
  reactionCount = 0,
  commentCount = 0,
  shareCount = 0,
  myReaction,
  onReact,
  onOpenComments,
  onShare,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastUrlRef = useRef<string | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const startedKeyRef = useRef<string>("");
  const [volume, setVolume] = useState(1);
  const [isRepeating, setIsRepeating] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [users] = useState<User[]>([]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    startedKeyRef.current = "";
  }, [currentTrack?.id, currentTrack?.type]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !currentTrack || !onStarted) return;

    const onPlaying = () => {
      const k = `${currentTrack.type}:${currentTrack.id}`;
      if (startedKeyRef.current === k) return;
      startedKeyRef.current = k;
      onStarted(currentTrack);
    };

    el.addEventListener("playing", onPlaying);
    return () => el.removeEventListener("playing", onPlaying);
  }, [currentTrack, onStarted]);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'metadata';
      audioRef.current.volume = volume;
    }

    const audio = audioRef.current;

    const setAudioData = () => {
      if (!isNaN(audio.duration)) setDuration(audio.duration);
    };
    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      if (isRepeating) {
        audio.currentTime = 0;
        audio.play();
      } else {
        onNext();
      }
    };
    const handleError = (e: Event) => console.warn('Audio playback warning:', e);

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    const managePlayback = async () => {
      if (!currentTrack?.url) {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        lastUrlRef.current = null;
        return;
      }

      if (lastUrlRef.current !== currentTrack.url) {
        audio.pause();
        audio.currentTime = 0;
        audio.src = currentTrack.url;
        lastUrlRef.current = currentTrack.url;
        audio.load();
        
        if (isPlaying) {
          try {
            if (playPromiseRef.current) {
              playPromiseRef.current.catch(() => {});
            }
            playPromiseRef.current = audio.play();
            await playPromiseRef.current;
          } catch (err: any) {
            console.warn('Auto-play prevented:', err?.name);
          }
        }
      } else {
        if (isPlaying && audio.paused) {
          try {
            if (playPromiseRef.current) {
              playPromiseRef.current.catch(() => {});
            }
            playPromiseRef.current = audio.play();
            await playPromiseRef.current;
          } catch (err: any) {
            console.warn('Play failed:', err);
          }
        } else if (!isPlaying && !audio.paused) {
          audio.pause();
        }
      }
    };

    managePlayback();

    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [currentTrack, isPlaying, onNext, isRepeating]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
    if (isPlaying) onTogglePlay();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
      lastUrlRef.current = null;
    }
    onClose();
  };

  const handleReact = (type: ReactionType) => {
    if (currentTrack && onReact) {
      onReact(currentTrack, type);
    }
  };

  const handleOpenComments = () => {
    if (currentTrack && onOpenComments) {
      onOpenComments(currentTrack);
      setShowComments(true);
    }
  };

  const handleShare = () => {
    if (currentTrack && onShare) {
      onShare(currentTrack);
      setShowShare(true);
    }
  };

  if (!currentTrack) return null;

  const displayUser = ownerUser || uploaderProfile;
  const profilePicture = displayUser 
    ? (displayUser as any).profileImage || (displayUser as any).profile_image_url 
    : null;
  const displayName = displayUser 
    ? displayUser.name || displayUser.username 
    : currentTrack.artist;
  const userRole = currentTrack.type === 'podcast' ? 'Host' : 'Artist';
  const trackCover = currentTrack.cover && 
                    currentTrack.cover.trim() !== '' && 
                    currentTrack.cover.startsWith('http')
                    ? currentTrack.cover
                    : DEFAULT_MUSIC_COVER;

  return (
    <>
      <div
        className={`fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#0A0A0A] to-[#1A1A1A] transition-all duration-500 z-[160] shadow-2xl border-t border-[#333] ${
          expanded ? 'h-full' : 'h-24'
        }`}
      >
        {expanded ? (
          // EXPANDED VIEW - Optimized for mobile with buttons at bottom
          <div className="flex flex-col h-full w-full relative overflow-hidden bg-gradient-to-b from-gray-900 to-black">
            {/* Background Gradient */}
            <div
              className="absolute inset-0 z-0 opacity-40 blur-3xl scale-150 pointer-events-none"
              style={{
                backgroundImage: `url(${trackCover})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            ></div>

            {/* Header - Close Button */}
            <div className="relative z-10 flex justify-between items-center p-4 pt-6 text-white">
              <button
                onClick={() => setExpanded(false)}
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
              >
                <i className="fas fa-chevron-down text-xl"></i>
              </button>

              <div className="flex flex-col items-center">
                <span className="text-xs font-medium text-gray-400">Now Playing</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-white max-w-[150px] truncate">{currentTrack.title}</span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLike(String(currentTrack.id), currentTrack.type);
                }}
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
              >
                <i className={`${isLiked ? 'fas text-[#F3425F]' : 'far'} fa-heart text-xl`}></i>
              </button>
            </div>

            {/* Rotating Album Art - Centered */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-2">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full animate-spin-slow" style={{
                  background: 'conic-gradient(from 0deg, #1877F2, #F3425F, #45BD62, #F7B928, #1877F2)',
                  filter: 'blur(8px)',
                  opacity: 0.3,
                }}></div>
                
                <div
                  className={`relative w-[220px] h-[220px] sm:w-[280px] sm:h-[280px] rounded-full border-[8px] sm:border-[12px] border-[#1A1A1A]/80 shadow-[0_0_80px_rgba(0,0,0,0.7)] overflow-hidden flex items-center justify-center ${
                    isPlaying ? 'animate-spin-slow' : ''
                  }`}
                  style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                >
                  <img 
                    src={trackCover} 
                    className="w-full h-full object-cover" 
                    alt="Album Art" 
                  />
                  
                  <div className="absolute w-10 h-10 bg-[#0A0A0A] rounded-full border-4 border-[#333] flex items-center justify-center">
                    <div className="w-3 h-3 bg-[#333] rounded-full"></div>
                  </div>
                </div>
                
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <button
                    onClick={onTogglePlay}
                    className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-white text-2xl ml-1`}></i>
                  </button>
                </div>
              </div>

              {/* Track Info - Compact */}
              <div className="text-center px-4 max-w-xl">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 line-clamp-2">{currentTrack.title}</h2>
                
                <div
                  className="flex items-center justify-center gap-2 cursor-pointer group mt-1"
                  onClick={() => currentTrack.uploaderId && onArtistClick && onArtistClick(currentTrack.uploaderId)}
                >
                  {profilePicture ? (
                    <img 
                      src={profilePicture} 
                      className="w-6 h-6 rounded-full border border-white/30 object-cover group-hover:scale-110 transition-transform" 
                      alt="Profile" 
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#1877F2] to-[#F3425F] flex items-center justify-center text-white text-xs font-bold">
                      {displayName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="text-left">
                    <div className="flex items-center gap-1">
                      <span className="text-white text-sm font-semibold">{displayName}</span>
                      {displayUser?.isVerified && (
                        <i className="fas fa-check-circle text-[#1877F2] text-xs"></i>
                      )}
                    </div>
                    <span className="text-[#B0B3B8] text-xs">{userRole}</span>
                  </div>
                </div>

                {totalPlays > 0 && (
                  <div className="mt-2">
                    <div className="inline-flex items-center gap-1 bg-[#1877F2]/20 px-3 py-1 rounded-full">
                      <i className="fas fa-headphones text-xs text-[#1877F2]"></i>
                      <span className="text-xs font-medium text-[#B0B3B8]">
                        {totalPlaysLoading ? '...' : `${totalPlays.toLocaleString()} plays`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar & Controls */}
            <div className="relative z-10 px-4 pb-2 bg-gradient-to-t from-black via-black/95 to-transparent">
              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-[#B0B3B8] mb-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 bg-gray-700/50 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
              </div>

              {/* Player Controls - Compact */}
              <div className="flex items-center justify-between px-2 mb-3">
                <button
                  onClick={() => setIsShuffling(!isShuffling)}
                  className={`text-lg ${isShuffling ? 'text-[#1877F2]' : 'text-[#B0B3B8] hover:text-white'}`}
                >
                  <i className="fas fa-random"></i>
                </button>

                <button onClick={onPrevious} className="text-xl text-white hover:text-[#1877F2]">
                  <i className="fas fa-step-backward"></i>
                </button>

                <button
                  onClick={onTogglePlay}
                  className="w-14 h-14 bg-gradient-to-r from-[#1877F2] to-[#2D8CFF] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(24,119,242,0.5)] hover:scale-105 transition-transform"
                >
                  <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play ml-0.5'} text-white text-xl`}></i>
                </button>

                <button onClick={onNext} className="text-xl text-white hover:text-[#1877F2]">
                  <i className="fas fa-step-forward"></i>
                </button>

                <button
                  onClick={() => setIsRepeating(!isRepeating)}
                  className={`text-lg ${isRepeating ? 'text-[#1877F2]' : 'text-[#B0B3B8] hover:text-white'}`}
                >
                  <i className="fas fa-redo"></i>
                </button>
              </div>

              {/* Volume & Stop - Compact */}
              <div className="flex items-center justify-between px-2 pb-2">
                <button
                  onClick={handleStop}
                  className="flex items-center gap-1 text-[#B0B3B8] hover:text-white"
                >
                  <i className="fas fa-stop text-sm"></i>
                  <span className="text-xs">Stop</span>
                </button>

                <div className="flex items-center gap-2">
                  <i className="fas fa-volume-down text-[#B0B3B8] text-sm"></i>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-24 h-1 bg-gray-700/50 rounded-lg appearance-none cursor-pointer"
                  />
                  <i className="fas fa-volume-up text-[#B0B3B8] text-sm"></i>
                </div>

                <button
                  onClick={() => onDownload(String(currentTrack.id))}
                  className="flex items-center gap-1 text-[#B0B3B8] hover:text-white"
                >
                  <i className="fas fa-download text-sm"></i>
                  <span className="text-xs">Download</span>
                </button>
              </div>
            </div>

            {/* REACT, DISCUSS, SHARE BUTTONS - Like Feed.tsx at bottom */}
            <div className="relative z-10 px-4 py-3 border-t border-white/10 bg-black/60 mt-auto">
              <div className="flex items-center justify-between max-w-md mx-auto">
                {/* React Button with Spark Icon */}
                <ReactionButton
                  currentUserReactions={myReaction}
                  reactionCount={reactionCount}
                  onReact={handleReact}
                  isGuest={!ownerUser && !uploaderProfile}
                />

                {/* Discuss Button */}
                <button
                  onClick={handleOpenComments}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded hover:bg-white/10 transition-colors group"
                >
                  <DiscussSignalIcon size={26} color="#1877F2" />
                  <span className="text-[17px] font-bold text-[#B0B3B8] group-hover:text-white">
                    {commentCount > 0 ? formatCompactNumber(commentCount) : 'Discuss'}
                  </span>
                </button>

                {/* Share Button */}
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded hover:bg-white/10 transition-colors group text-[#B0B3B8]"
                >
                  <i className="fas fa-share text-xl"></i>
                  <span className="text-[17px] font-bold">
                    {shareCount > 0 ? formatCompactNumber(shareCount) : 'Share'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          // MINI PLAYER - Modern Design
          <div className="flex items-center justify-between h-full px-4 bg-gradient-to-r from-[#0A0A0A] to-[#1A1A1A]">
            <div 
              className="flex items-center gap-3 flex-1 cursor-pointer overflow-hidden"
              onClick={() => setExpanded(true)}
            >
              <div className="relative">
                <div className={`w-12 h-12 rounded-full overflow-hidden border-2 border-[#333] ${isPlaying ? 'animate-spin-slow' : ''}`}>
                  <img 
                    src={trackCover} 
                    alt="Album Art" 
                    className="w-full h-full object-cover"
                  />
                </div>
                {isPlaying && (
                  <div className="absolute -inset-1 border border-[#1877F2]/30 rounded-full animate-ping"></div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-white font-semibold text-sm truncate">{currentTrack.title}</h4>
                <div className="flex items-center gap-1 mt-0.5">
                  {profilePicture ? (
                    <img 
                      src={profilePicture} 
                      className="w-3 h-3 rounded-full object-cover"
                      alt="Profile"
                    />
                  ) : null}
                  <span className="text-gray-400 text-xs truncate flex items-center gap-1">
                    {displayName}
                    {displayUser?.isVerified && (
                      <i className="fas fa-check-circle text-[8px] text-[#1877F2]"></i>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLike(String(currentTrack.id), currentTrack.type);
                }}
                className="text-base hover:scale-110 transition-transform"
              >
                <i className={`${isLiked ? 'fas text-[#F3425F]' : 'far'} fa-heart`}></i>
              </button>

              <button onClick={onPrevious} className="text-base text-gray-400 hover:text-white">
                <i className="fas fa-step-backward"></i>
              </button>

              <button
                onClick={onTogglePlay}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  isPlaying 
                    ? 'bg-gradient-to-r from-[#F3425F] to-[#FF6B9D]' 
                    : 'bg-gradient-to-r from-[#1877F2] to-[#2D8CFF]'
                }`}
              >
                <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play ml-0.5'} text-white text-sm`}></i>
              </button>

              <button onClick={onNext} className="text-base text-gray-400 hover:text-white">
                <i className="fas fa-step-forward"></i>
              </button>

              <button
                onClick={handleClose}
                className="text-base text-gray-400 hover:text-red-500"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>
        )}

        <style>{`
          @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin-slow {
            animation: spin-slow 20s linear infinite;
          }
          @keyframes ping {
            75%, 100% { transform: scale(1.2); opacity: 0; }
          }
          .animate-ping {
            animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
          }
        `}</style>
      </div>

      {/* Comments Sheet Modal */}
      {currentTrack && (
        <CommentsSheet
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          track={currentTrack}
          currentUser={ownerUser || uploaderProfile || null}
          users={users}
          onProfileClick={(id) => onArtistClick?.(id)}
        />
      )}

      {/* Share Bottom Sheet Modal */}
      {currentTrack && (
        <ShareBottomSheet
          isOpen={showShare}
          onClose={() => setShowShare(false)}
          track={currentTrack}
          currentUser={ownerUser || uploaderProfile || null}
          users={users}
          groups={[]}
        />
      )}
    </>
  );
};

