// Reels.tsx - Complete updated file with full functionality
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { User, Reel, Comment, ReactionType } from '../types';
import { avatarFrom, formatRelativeTime, safeNumber, safeString, safeArray } from './Feed';

// ==================== ICON COMPONENTS ====================
const Play: React.FC<{ size?: number; color?: string; fill?: string }> = ({ 
  size = 24, 
  color = "#fff", 
  fill = "#fff" 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth="2">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
);

const Pause: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <rect x="6" y="4" width="4" height="16"></rect>
    <rect x="14" y="4" width="4" height="16"></rect>
  </svg>
);

const VolumeHigh: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
  </svg>
);

const VolumeMute: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <line x1="23" y1="9" x2="17" y2="15"></line>
    <line x1="17" y1="9" x2="23" y2="15"></line>
  </svg>
);

const Heart: React.FC<{ size?: number; color?: string; filled?: boolean }> = ({ 
  size = 28, 
  color = "#fff", 
  filled = false 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

const CommentIcon: React.FC<{ size?: number; color?: string }> = ({ size = 28, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

const ShareIcon: React.FC<{ size?: number; color?: string }> = ({ size = 28, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <circle cx="18" cy="5" r="3"></circle>
    <circle cx="6" cy="12" r="3"></circle>
    <circle cx="18" cy="19" r="3"></circle>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
  </svg>
);

const MoreHorizontal: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <circle cx="12" cy="12" r="1"></circle>
    <circle cx="19" cy="12" r="1"></circle>
    <circle cx="5" cy="12" r="1"></circle>
  </svg>
);

const MusicNote: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <path d="M9 18V5l12-2v13"></path>
    <circle cx="6" cy="18" r="3"></circle>
    <circle cx="18" cy="16" r="3"></circle>
  </svg>
);

// ==================== HELPER FUNCTIONS ====================
const formatCount = (count: number): string => {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
};

// ==================== REEL PLAYER COMPONENT ====================
interface ReelPlayerProps {
  reel: any;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onProfileClick: (userId: number) => void;
  onFollow?: (userId: number) => void;
  isFollowing?: boolean;
  currentUser: User | null;
  users?: User[];
  onOpenAudio?: (track: any) => void;
}

const ReelPlayer: React.FC<ReelPlayerProps> = ({
  reel,
  isActive,
  isMuted,
  onToggleMute,
  onLike,
  onComment,
  onShare,
  onProfileClick,
  onFollow,
  isFollowing = false,
  currentUser,
  users = [],
  onOpenAudio
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPauseOverlay, setShowPauseOverlay] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(safeNumber(reel.likes_count || reel.likes || 0, 0));
  const [commentCount] = useState(safeNumber(reel.comments_count || reel.comments || 0, 0));
  const [shareCount] = useState(safeNumber(reel.shares_count || reel.shares || 0, 0));
  const [showSoundIndicator, setShowSoundIndicator] = useState(true);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimer = useRef<any>(null);

  // Get author details
  const authorId = Number(reel.user_id || reel.userId || 0);
  const author = users.find(u => u.id === authorId) || {
    id: authorId,
    name: reel.author_name || reel.author || reel.username || 'User',
    username: reel.username || '',
    profile_image_url: reel.avatar || reel.profile_image_url
  };

  const authorName = author.name || author.username || 'User';
  const authorImage = avatarFrom(author);

  // Handle video playback when active tab changes
  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive) {
      videoRef.current.play().catch(() => {
        // Auto-play prevented, user will need to tap
        setIsPlaying(false);
      });
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  // Toggle play/pause
  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setShowPauseOverlay(true);
      setTimeout(() => setShowPauseOverlay(false), 500);
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Handle like with animation
  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    onLike();
  };

  // Handle double tap to like
  const handleDoubleTap = () => {
    if (!liked) {
      handleLike();
    }
  };

  // Handle long press for pause
  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setIsLongPressing(true);
      togglePlay();
    }, 300);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    if (isLongPressing) {
      setIsLongPressing(false);
    }
  };

  // Hide sound indicator after 3 seconds
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => setShowSoundIndicator(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  return (
    <div className="relative w-full h-full bg-black">
      {/* Video Player */}
      <video
        ref={videoRef}
        src={reel.video_url || reel.video}
        poster={reel.thumbnail_url || reel.thumbnail}
        loop
        playsInline
        muted={isMuted}
        className="w-full h-full object-cover"
        onClick={togglePlay}
        onDoubleClick={handleDoubleTap}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      />

      {/* Pause Overlay */}
      {showPauseOverlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
            <Pause size={32} />
          </div>
        </div>
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none" />

      {/* Top Bar - Back button and music info */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center">
            <i className="fas fa-chevron-left text-white text-xl"></i>
          </button>
          
          {reel.song_name && (
            <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full">
              <MusicNote size={16} color="#fff" />
              <span className="text-white text-sm font-medium max-w-[150px] truncate">
                {reel.song_name}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onToggleMute}
          className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center"
        >
          {isMuted ? <VolumeMute size={20} /> : <VolumeHigh size={20} />}
        </button>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-20 left-0 right-0 p-4 z-10">
        {/* Author and follow button */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onProfileClick(authorId)}
              className="flex items-center gap-2"
            >
              <img
                src={authorImage}
                alt={authorName}
                className="w-10 h-10 rounded-full border-2 border-white object-cover"
              />
              <span className="text-white font-bold text-[17px] drop-shadow-lg">
                {authorName}
              </span>
            </button>

            {currentUser && authorId !== currentUser.id && onFollow && (
              <button
                onClick={() => onFollow(authorId)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  isFollowing
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>

        {/* Caption */}
        {reel.caption && (
          <p className="text-white text-[15px] mb-3 drop-shadow-lg line-clamp-2">
            {reel.caption}
          </p>
        )}

        {/* Audio info if available */}
        {reel.audioUrl && (
          <div className="flex items-center gap-2 text-white/90 text-sm drop-shadow-lg">
            <MusicNote size={14} />
            <span className="truncate max-w-[200px]">
              {reel.song_name || 'Original Audio'} · {reel.author_name || authorName}
            </span>
          </div>
        )}
      </div>

      {/* Right Side Action Buttons */}
      <div className="absolute bottom-20 right-4 flex flex-col items-center gap-4 z-10">
        {/* Like */}
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1"
        >
          <div className={`w-12 h-12 rounded-full bg-black/30 flex items-center justify-center transition-transform ${liked ? 'scale-110' : ''}`}>
            <Heart
              size={28}
              color={liked ? '#f00' : '#fff'}
              filled={liked}
            />
          </div>
          <span className="text-white text-xs font-medium drop-shadow-lg">
            {formatCount(likeCount)}
          </span>
        </button>

        {/* Comment */}
        <button
          onClick={onComment}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center">
            <CommentIcon size={26} />
          </div>
          <span className="text-white text-xs font-medium drop-shadow-lg">
            {formatCount(commentCount)}
          </span>
        </button>

        {/* Share */}
        <button
          onClick={onShare}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center">
            <ShareIcon size={26} />
          </div>
          <span className="text-white text-xs font-medium drop-shadow-lg">
            {formatCount(shareCount)}
          </span>
        </button>

        {/* More Options */}
        <button className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center">
          <MoreHorizontal size={24} />
        </button>
      </div>

      {/* Sound Indicator */}
      {showSoundIndicator && isActive && (
        <div className="absolute top-20 right-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-xs z-10">
          {isMuted ? 'Tap to unmute' : 'Sound on'}
        </div>
      )}
    </div>
  );
};

// ==================== MAIN REELS COMPONENT ====================
interface ReelsProps {
  reels: any[];
  initialReelId?: number | string;
  currentUser: User | null;
  users?: User[];
  onClose: () => void;
  onProfileClick: (userId: number) => void;
  onLike?: (reelId: number | string) => void;
  onComment?: (reelId: number | string) => void;
  onShare?: (reelId: number | string) => void;
  onFollow?: (userId: number) => void;
  isFollowing?: (userId: number) => boolean;
  onOpenAudio?: (track: any) => void;
  onDelete?: (reelId: number | string) => void;
  onEdit?: (reelId: number | string, caption: string) => void;
}

export const Reels: React.FC<ReelsProps> = ({
  reels = [],
  initialReelId,
  currentUser,
  users = [],
  onClose,
  onProfileClick,
  onLike,
  onComment,
  onShare,
  onFollow,
  isFollowing,
  onOpenAudio,
  onDelete,
  onEdit
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [selectedReel, setSelectedReel] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isScrolling = useRef<boolean>(false);

  // Find initial index
  useEffect(() => {
    if (initialReelId && reels.length > 0) {
      const index = reels.findIndex(r => String(r.id) === String(initialReelId));
      if (index !== -1) {
        setCurrentIndex(index);
        
        // Scroll to the correct reel after render
        setTimeout(() => {
          if (containerRef.current) {
            const container = containerRef.current;
            container.scrollTo({
              top: index * window.innerHeight,
              behavior: 'instant' as any
            });
          }
        }, 100);
      }
    }
  }, [initialReelId, reels]);

  // Handle scroll to change current reel
  const handleScroll = useCallback(() => {
    if (!containerRef.current || isScrolling.current) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const windowHeight = window.innerHeight;
    const newIndex = Math.round(scrollTop / windowHeight);

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < reels.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, reels.length]);

  // Throttled scroll handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', onScroll);
    return () => container.removeEventListener('scroll', onScroll);
  }, [handleScroll]);

  // Handle touch for swipe to close
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    
    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStartY.current;
    
    // If swiping down at the first reel, allow pull-to-close
    if (currentIndex === 0 && diff > 50) {
      e.preventDefault();
      containerRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    
    containerRef.current.style.transform = '';
    
    const touchY = e.changedTouches[0].clientY;
    const diff = touchY - touchStartY.current;
    
    // Close if swiped down enough at the first reel
    if (currentIndex === 0 && diff > 100) {
      onClose();
    }
  };

  // Fetch comments for a reel
  const fetchComments = async (reelId: number | string) => {
    setIsLoadingComments(true);
    try {
      const token = localStorage.getItem('unera_token');
      const res = await fetch(`/api/reels/${reelId}/comments`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      setComments(Array.isArray(data) ? data : data?.comments || []);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      setComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  };

  // Handle comment submission
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedReel || !currentUser) return;

    const newComment = {
      id: `temp-${Date.now()}`,
      user_id: currentUser.id,
      text: commentText,
      created_at: new Date().toISOString(),
      user: currentUser
    };

    setComments(prev => [newComment, ...prev]);
    setCommentText('');

    try {
      await fetch(`/api/reels/${selectedReel.id}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('unera_token')}`
        },
        body: JSON.stringify({ text: commentText })
      });
    } catch (error) {
      console.error('Failed to post comment:', error);
    }
  };

  // Handle like
  const handleLike = (reelId: number | string) => {
    onLike?.(reelId);
  };

  // Handle comment open
  const handleComment = (reel: any) => {
    setSelectedReel(reel);
    fetchComments(reel.id);
    setShowComments(true);
  };

  // Handle share
  const handleShare = (reel: any) => {
    setSelectedReel(reel);
    setShowShareSheet(true);
  };

  // Handle follow
  const handleFollow = (userId: number) => {
    onFollow?.(userId);
  };

  // Check if following
  const checkIsFollowing = (userId: number): boolean => {
    return isFollowing ? isFollowing(userId) : false;
  };

  // Get current reel
  const currentReel = reels[currentIndex];

  // If no reels, show empty state
  if (reels.length === 0) {
    return (
      <div className="fixed inset-0 z-[1000] bg-black flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-video text-white/30 text-6xl mb-4"></i>
          <p className="text-white text-lg">No reels available</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-[#1877F2] text-white rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 z-[1000] bg-black overflow-y-auto snap-y snap-mandatory"
        style={{ scrollBehavior: 'smooth' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {reels.map((reel, index) => (
          <div
            key={reel.id}
            className="h-screen w-full snap-start snap-always relative"
          >
            <ReelPlayer
              reel={reel}
              isActive={index === currentIndex}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onLike={() => handleLike(reel.id)}
              onComment={() => handleComment(reel)}
              onShare={() => handleShare(reel)}
              onProfileClick={onProfileClick}
              onFollow={handleFollow}
              isFollowing={checkIsFollowing(Number(reel.user_id))}
              currentUser={currentUser}
              users={users}
              onOpenAudio={onOpenAudio}
            />
          </div>
        ))}
      </div>

      {/* Comments Modal */}
      {showComments && selectedReel && (
        <div className="fixed inset-0 z-[1100] bg-black/90 flex flex-col">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <button
              onClick={() => setShowComments(false)}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center"
            >
              <i className="fas fa-arrow-left text-white text-xl"></i>
            </button>
            <h3 className="text-white font-bold text-lg">Comments</h3>
            <div className="w-10" />
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingComments ? (
              <div className="flex justify-center py-8">
                <i className="fas fa-spinner fa-spin text-white text-2xl"></i>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/60">No comments yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment: any) => {
                  const commentAuthor = users.find(u => u.id === comment.user_id) || comment.user;
                  return (
                    <div key={comment.id} className="flex gap-3">
                      <img
                        src={avatarFrom(commentAuthor)}
                        className="w-8 h-8 rounded-full object-cover"
                        alt=""
                      />
                      <div className="flex-1">
                        <div className="bg-white/10 rounded-lg p-3">
                          <span className="text-white font-semibold text-sm block mb-1">
                            {commentAuthor?.name || 'User'}
                          </span>
                          <p className="text-white/90 text-sm">{comment.text}</p>
                        </div>
                        <span className="text-white/40 text-xs mt-1 block">
                          {formatRelativeTime(comment.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {currentUser && (
            <form onSubmit={handleCommentSubmit} className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 bg-white/10 rounded-full px-4 py-2 text-white outline-none focus:ring-2 focus:ring-[#1877F2]"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="px-4 py-2 bg-[#1877F2] text-white rounded-full font-semibold disabled:opacity-50"
                >
                  Post
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Share Sheet */}
      {showShareSheet && selectedReel && (
        <div className="fixed inset-0 z-[1100] bg-black/90 flex items-end">
          <div className="bg-[#242526] w-full rounded-t-2xl p-4">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-white/20 rounded-full"></div>
            </div>

            <h3 className="text-white font-bold text-lg mb-4">Share</h3>

            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg transition-colors">
                <i className="fab fa-whatsapp text-[#25D366] text-2xl"></i>
                <span className="text-white">Share to WhatsApp</span>
              </button>

              <button className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg transition-colors">
                <i className="fab fa-facebook text-[#1877F2] text-2xl"></i>
                <span className="text-white">Share to Facebook</span>
              </button>

              <button className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg transition-colors">
                <i className="fas fa-link text-[#B0B3B8] text-2xl"></i>
                <span className="text-white">Copy Link</span>
              </button>
            </div>

            <button
              onClick={() => setShowShareSheet(false)}
              className="w-full mt-4 py-3 bg-white/10 text-white rounded-lg font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Reels;
