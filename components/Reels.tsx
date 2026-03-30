import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { User, Reel, ReactionType } from '../types';
import { ReactionsSheet, ShareBottomSheet, topReactionEmojis, formatReactionText, reactionEmoji } from './Feed';

// ==================== MEDIA CACHE SYSTEM (MEMORY-SAFE) ====================
const mediaBlobCache = new Map<string, { blobUrl: string; timestamp: number }>();
const mediaWarmPromises = new Map<string, Promise<string>>();
const CACHE_MAX_SIZE = 10;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchAsBlobUrl(url: string, type: 'video' | 'audio' = 'audio'): Promise<string> {
  if (!url) throw new Error('Missing media URL');

  const cached = mediaBlobCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.blobUrl;
  }

  if (mediaWarmPromises.has(url)) {
    return mediaWarmPromises.get(url)!;
  }

  if (type === 'video') {
    mediaWarmPromises.set(url, Promise.resolve(url));
    setTimeout(() => mediaWarmPromises.delete(url), 1000);
    return url;
  }

  const p = fetch(url, {
    cache: 'force-cache',
    headers: { Accept: 'audio/mpeg,/*' },
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to fetch media: ${res.status}`);

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      if (mediaBlobCache.size >= CACHE_MAX_SIZE) {
        const oldestKey = Array.from(mediaBlobCache.entries()).sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        )[0][0];
        const oldest = mediaBlobCache.get(oldestKey);
        if (oldest) URL.revokeObjectURL(oldest.blobUrl);
        mediaBlobCache.delete(oldestKey);
      }

      mediaBlobCache.set(url, { blobUrl, timestamp: Date.now() });
      return blobUrl;
    })
    .finally(() => {
      mediaWarmPromises.delete(url);
    });

  mediaWarmPromises.set(url, p);
  return p;
}

// ==================== TYPES ====================
interface Sound {
  id: string | number;
  name: string;
  url: string;
  start?: number;
  end?: number;
  creator?: User;
  creationCount?: number;
  duration?: number;
  isOriginal?: boolean;
  playCount?: number;
  viewCount?: number;
  coverImage?: string;
  soundKey?: string;
  originalUrl?: string;
}

type NetworkLevel = 'low' | 'medium' | 'high';

type ReelVideoSources = {
  low?: string;
  medium?: string;
  hd?: string;
};

// ==================== HELPER: Get reel user ID ====================
const getReelUserId = (reel: any): number => {
  return Number(reel.userId ?? reel.user_id ?? 0);
};

// ==================== NETWORK / QUALITY HELPERS ====================
const getNetworkLevel = (): NetworkLevel => {
  const nav = navigator as any;
  const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;

  if (!conn) return 'medium';

  const effectiveType = String(conn.effectiveType || '').toLowerCase();
  const saveData = Boolean(conn.saveData);

  if (saveData) return 'low';
  if (effectiveType.includes('2g') || effectiveType === 'slow-2g') return 'low';
  if (effectiveType === '3g') return 'medium';
  return 'medium';
};

const getReelVideoSources = (reel: Reel): ReelVideoSources => ({
  low: (reel as any).video_url_low || (reel as any).videoUrlLow || '',
  medium:
    (reel as any).video_url_medium ||
    (reel as any).videoUrlMedium ||
    (reel as any).video_url ||
    (reel as any).videoUrl ||
    '',
  hd: (reel as any).video_url_hd || (reel as any).videoUrlHd || '',
});

const pickBestVideoUrl = (sources: ReelVideoSources, networkLevel: NetworkLevel): string => {
  if (networkLevel === 'low') {
    return sources.low || sources.medium || sources.hd || '';
  }
  return sources.medium || sources.low || sources.hd || '';
};

// ==================== REACTION EMOJIS ====================
const REACTION_EMOJIS = [
  '❤️', '🙏', '👍', '💪', '👀', '😊', '😍', '🤣', '😭', '😂', '😟', '🤑',
  '😝', '😋', '🤧', '😪', '👏', '🤘', '✌️', '🤛', '🤝', '🖕', '🖐', '🙆‍♂️',
  '🤦', '🤷‍♂️', '🫂',
];

// ==================== SPARK REACT ICON ====================
const SparkReactIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="reelSparkGrad" x1="12" y1="52" x2="52" y2="12">
        <stop offset="0%" stopColor="#FF7A45" />
        <stop offset="55%" stopColor="#FF5A6A" />
        <stop offset="100%" stopColor="#FF8A3D" />
      </linearGradient>
      <filter id="reelSparkGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <circle
      cx="32"
      cy="32"
      r="18"
      fill="url(#reelSparkGrad)"
      opacity="0.14"
    />
    <g
      stroke="url(#reelSparkGrad)"
      strokeWidth="5.2"
      strokeLinecap="round"
      filter="url(#reelSparkGlow)"
    >
      <line x1="32" y1="10" x2="32" y2="18" />
      <line x1="32" y1="46" x2="32" y2="54" />
      <line x1="10" y1="32" x2="18" y2="32" />
      <line x1="46" y1="32" x2="54" y2="32" />
      <line x1="17" y1="17" x2="22.8" y2="22.8" />
      <line x1="41.2" y1="41.2" x2="47" y2="47" />
      <line x1="47" y1="17" x2="41.2" y2="22.8" />
      <line x1="22.8" y1="41.2" x2="17" y2="47" />
    </g>
    <circle cx="32" cy="32" r="6.2" fill="url(#reelSparkGrad)" />
  </svg>
);

// ==================== DISCUSS SIGNAL ICON ====================
const DiscussSignalIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 28,
  color = '#1877F2',
}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <g
      fill="none"
      stroke={color}
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 20c0-5 4-9 9-9h18c7 0 13 6 13 13v6c0 7-6 13-13 13H30l-9 7v-7h-1c-6 0-10-4-10-10V20z" />
      <circle cx="27" cy="30" r="2.2" />
      <circle cx="33" cy="30" r="2.2" />
      <circle cx="39" cy="30" r="2.2" />
      <path d="M48 18c3 2 5 5 6 9" />
      <path d="M44 22c2 1 3 3 4 6" />
    </g>
  </svg>
);

// ==================== FORMAT HELPERS ====================
const formatViewCount = (num?: number): string => {
  const v = Number(num || 0);

  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(v);
};

const formatCount = (num: number): string => formatViewCount(num);

// Helper to get first reactor's name
const getFirstReactorName = (reactions: any[], users: User[]): string => {
  if (!reactions || reactions.length === 0) return 'Someone';
  
  const firstReaction = reactions[0];
  const userId = Number(firstReaction.userId ?? firstReaction.user_id);
  const user = users.find(u => Number(u.id) === userId);
  
  if (user?.name) return user.name;
  if (firstReaction.user?.name) return firstReaction.user.name;
  return 'Someone';
};

// ==================== UPDATED REEL REACTION BUTTON ====================
const ReelReactionButton: React.FC<{
  reelId: number;
  hasReacted: boolean;
  reactionCount: number;
  onReact: (reelId: number, type?: ReactionType) => void;
  isLoading?: boolean;
  currentUserReaction?: string | null;
}> = ({ reelId, hasReacted, reactionCount, onReact, isLoading = false, currentUserReaction }) => {
  const [showDock, setShowDock] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewEmoji, setPreviewEmoji] = useState<string>('👍');
  const timerRef = useRef<any>(null);
  const longPressTimerRef = useRef<any>(null);

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
  ] as const;

  const activeReaction = currentUserReaction
    ? reactionConfig.find((r) => r.type === currentUserReaction)
    : null;

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => setShowDock(true), 500);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => setShowDock(false), 250);
    setShowPreview(false);
  };

  const handleTouchStart = () => {
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
    if (hasReacted && currentUserReaction) {
      setIsAnimating(true);
      onReact(reelId, currentUserReaction as ReactionType);
      setTimeout(() => setIsAnimating(false), 300);
    } else {
      setShowDock(!showDock);
    }
  };

  const handleDockReact = (type: string) => {
    setIsAnimating(true);
    onReact(reelId, type as ReactionType);
    setShowDock(false);
    setShowPreview(false);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleEmojiHover = (emoji: string) => {
    if (showPreview) {
      setPreviewEmoji(emoji);
    }
  };

  return (
    <div
      className="relative"
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
          className="absolute -top-16 left-0 bg-[#242526] rounded-full shadow-2xl p-2 border border-[#3E4042] z-50 react-pop flex items-center"
        >
          <div className="flex gap-1 overflow-x-auto max-w-[320px] scrollbar-hide px-1 py-1">
            {reactionConfig.map((r) => (
              <div
                key={r.type}
                className="text-3xl react-hover cursor-pointer p-1 rounded-full hover:bg-[#3A3B3C] transition-colors flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDockReact(r.type);
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
        disabled={isLoading}
        className={`flex items-center justify-center gap-1 px-4 py-2.5 rounded-full bg-transparent border border-white/25 active:scale-95 transition-all ${
          isAnimating ? 'scale-110' : ''
        } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
      >
        {activeReaction ? (
          <>
            <span className="text-2xl">{activeReaction.icon}</span>
            <span className="text-white text-sm font-bold ml-1">{formatViewCount(reactionCount)}</span>
          </>
        ) : (
          <>
            <SparkReactIcon size={24} />
            <span className="text-white text-sm font-bold ml-1">{formatViewCount(reactionCount)}</span>
          </>
        )}
      </button>
    </div>
  );
};

// ==================== REEL DISCUSS BUTTON ====================
const ReelDiscussButton: React.FC<{
  commentCount: number;
  onClick: () => void;
}> = ({ commentCount, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1 px-4 py-2.5 rounded-full bg-transparent border border-white/25 active:scale-95 transition-all"
    >
      <DiscussSignalIcon size={24} color="#1877F2" />
      <span className="text-white text-sm font-bold ml-1">{formatViewCount(commentCount)}</span>
    </button>
  );
};

// ==================== COMMENTS SHEET ====================
const ReelCommentsSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  comments: any[];
  users: User[];
  currentUser: User | null;
  onAddComment: (payload: {
    text: string;
    parentId?: number | null;
    imageFile?: File | null;
  }) => Promise<void> | void;
  onEditComment: (
    commentId: number,
    payload: {
      text?: string;
      imageFile?: File | null;
      image_url?: string;
    }
  ) => Promise<void> | void;
  onDeleteComment: (commentId: number) => Promise<void> | void;
}> = ({
  isOpen,
  onClose,
  comments,
  users,
  currentUser,
  onAddComment,
  onEditComment,
  onDeleteComment,
}) => {
  const COMMENT_EMOJIS = ['😀', '😂', '😍', '🔥', '👏', '❤️', '👍', '🎉', '😮', '😢', '🙌', '🥰'];

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [menuComment, setMenuComment] = useState<any | null>(null);
  const [editingComment, setEditingComment] = useState<any | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
  const [commentReactions, setCommentReactions] = useState<Record<number, string>>({});

  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTranslateY(0);
      setReplyTo(null);
      setSelectedImage(null);
      setImagePreview(null);
      setShowEmojiBar(false);
      setShowReactionPicker(null);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      clearTimeout(longPressTimerRef.current);
    };
  }, [imagePreview]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !sheetRef.current) return;
    const deltaY = e.touches[0].clientY - startYRef.current;
    if (deltaY > 0) setTranslateY(deltaY);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (translateY > 150) onClose();
    else setTranslateY(0);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmitComment = async () => {
    if (!text.trim() && !selectedImage) return;

    try {
      await Promise.resolve(
        onAddComment({
          text: text.trim(),
          parentId: replyTo?.id || null,
          imageFile: selectedImage,
        })
      );

      setText('');
      setReplyTo(null);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setSelectedImage(null);
      setImagePreview(null);
      setShowEmojiBar(false);
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const isOwnerComment = (comment: any) => {
    const commentUserId = Number(comment.userId ?? comment.user_id);
    return commentUserId === Number(currentUser?.id);
  };

  const beginLongPress = (comment: any) => {
    if (!isOwnerComment(comment)) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setMenuComment(comment);
    }, 450);
  };

  const cancelLongPress = () => {
    clearTimeout(longPressTimerRef.current);
  };

  const openEditComment = (comment: any) => {
    setMenuComment(null);
    setEditingComment(comment);
    setEditingText(comment.text || '');
  };

  const confirmDeleteComment = async (comment: any) => {
    setMenuComment(null);
    const ok = window.confirm('Delete this discussion?');
    if (!ok) return;

    try {
      await Promise.resolve(onDeleteComment(comment.id));
    } catch (e: any) {
      alert(e?.message || 'Failed to delete discussion');
    }
  };

  const saveEditedComment = async () => {
    if (!editingComment) return;

    try {
      await Promise.resolve(
        onEditComment(editingComment.id, {
          text: editingText,
        })
      );
      setEditingComment(null);
      setEditingText('');
    } catch (e: any) {
      alert(e?.message || 'Failed to edit discussion');
    }
  };

  const addReaction = (commentId: number, emoji: string) => {
    setCommentReactions((prev) => ({
      ...prev,
      [commentId]: emoji,
    }));
    setShowReactionPicker(null);
  };

  const insertEmoji = (emoji: string) => setText((prev) => prev + emoji);
  const insertEditEmoji = (emoji: string) => setEditingText((prev) => prev + emoji);

  const getReplies = (commentId: number | string) =>
    comments
      .filter(
        (c: any) =>
          Number(c.parentId ?? c.parent_comment_id ?? c.parent_id) === Number(commentId)
      )
      .sort((a: any, b: any) => {
        const ta = new Date(a.created_at || a.createdAt || 0).getTime();
        const tb = new Date(b.created_at || b.createdAt || 0).getTime();
        return ta - tb;
      });

  const getReplyPreviewText = (count: number) => {
    if (count <= 0) return '';
    if (count === 1) return 'View previous 1 reply';
    return `View previous ${count} replies`;
  };

  if (!isOpen) return null;

  const rootComments = comments.filter(
    (c: any) => !c.parentId && !c.parent_comment_id && !c.parent_id
  );

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/50 font-sans backdrop-blur-sm transition-opacity"
      style={{ opacity: 1 - translateY / 500 }}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 max-w-[450px] mx-auto h-[80vh] bg-[#121212] rounded-t-[40px] flex flex-col border-t border-white/10 shadow-2xl transition-transform duration-200 ease-out"
        style={{ transform: `translateY(${translateY}px)` }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="pt-3 pb-2 flex justify-center">
          <div className="w-12 h-1.5 bg-white/30 rounded-full"></div>
        </div>

        <div className="px-5 pb-5 border-b border-white/5 flex justify-between items-center bg-[#181818] rounded-t-[40px]">
          <span className="text-white font-black text-[13px] ml-4 uppercase tracking-[3px]">
            {comments.length} {replyTo ? 'Replies' : 'Discussions'}
          </span>
          {replyTo && (
            <button onClick={() => setReplyTo(null)} className="text-[#1877F2] text-xs font-bold">
              Back to all
            </button>
          )}
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white active:scale-90 transition-all"
          >
            <i className="fas fa-times text-xs"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {replyTo && (
            <div className="mb-2 p-4 rounded-[22px] bg-white/5 border border-white/10">
              <p className="text-[12px] uppercase tracking-[2px] text-[#1877F2] font-black mb-2">
                Reply thread
              </p>
              <p className="text-white/70 text-[16px] line-clamp-2">
                {replyTo.text || 'Image discussion'}
              </p>
            </div>
          )}

          {(replyTo ? [replyTo, ...getReplies(replyTo.id)] : rootComments).map((c: any) => {
            const author = users.find((u: any) => Number(u.id) === Number(c.userId ?? c.user_id));
            const replies = getReplies(c.id);
            const lastReply = replies.length ? replies[replies.length - 1] : null;
            const hiddenRepliesCount = replies.length > 1 ? replies.length - 1 : replies.length;
            const isReply = c.parentId || c.parent_comment_id || c.parent_id;
            const isOwner = isOwnerComment(c);

            return (
              <div key={c.id} className={`${isReply ? 'ml-10' : ''}`}>
                <div className="flex gap-4">
                  <img
                    src={author?.profile_image_url || author?.profileImage || 'https://via.placeholder.com/40'}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white/5 shrink-0"
                    alt=""
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-white font-black text-[22px] leading-none tracking-[-0.02em]">
                        {author?.name || 'User'}
                      </p>
                      {isOwner && (
                        <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded-full text-white/60">
                          You
                        </span>
                      )}
                    </div>

                    <div
                      onTouchStart={() => beginLongPress(c)}
                      onTouchEnd={cancelLongPress}
                      onTouchMove={cancelLongPress}
                      onMouseDown={() => beginLongPress(c)}
                      onMouseUp={cancelLongPress}
                      onMouseLeave={cancelLongPress}
                    >
                      {!!c.text && (
                        <p className="text-[#E4E6EB] text-[22px] leading-[1.28] font-medium whitespace-pre-wrap break-words">
                          {c.text}
                        </p>
                      )}

                      {(c.image_url || c.imageUrl) && (
                        <img
                          src={c.image_url || c.imageUrl}
                          alt=""
                          className="mt-3 max-w-[240px] rounded-[20px] border border-white/10 object-cover"
                        />
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-8">
                      <span className="text-[13px] font-semibold text-white/45">
                        {(() => {
                          const created = c.created_at || c.createdAt;
                          if (!created) return '';
                          const diff = Math.floor((Date.now() - new Date(created).getTime()) / 1000);
                          if (diff < 60) return 'now';
                          if (diff < 3600) return `${Math.floor(diff / 60)}m`;
                          if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
                          if (diff < 2592000) return `${Math.floor(diff / 86400)}d`;
                          return `${Math.floor(diff / 2592000)}mo`;
                        })()}
                      </span>

                      <div className="relative">
                        <button
                          onClick={() => setShowReactionPicker(showReactionPicker === c.id ? null : c.id)}
                          className="text-[13px] font-bold text-white/45 hover:text-white/70 transition-colors"
                        >
                          {commentReactions[c.id] ? (
                            <span className="text-xl">{commentReactions[c.id]}</span>
                          ) : (
                            'React'
                          )}
                        </button>

                        {showReactionPicker === c.id && (
                          <div className="absolute bottom-full left-0 mb-2 bg-[#242526] rounded-2xl p-3 border border-white/10 shadow-2xl z-50">
                            <div className="flex overflow-x-auto gap-2 max-w-[300px] scrollbar-hide pb-1">
                              {REACTION_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => addReaction(c.id, emoji)}
                                  className="text-2xl hover:scale-125 transition-transform flex-shrink-0"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setReplyTo(c)}
                        className="text-[13px] font-bold text-white/45 hover:text-white/70 transition-colors"
                      >
                        Reply
                      </button>
                    </div>

                    {!replyTo && replies.length > 0 && (
                      <div className="mt-5">
                        {hiddenRepliesCount > 0 && (
                          <button
                            onClick={() => setReplyTo(c)}
                            className="text-[#1877F2] font-black text-[16px] leading-none hover:opacity-80 transition-opacity"
                          >
                            {getReplyPreviewText(hiddenRepliesCount)}
                          </button>
                        )}

                        {lastReply && (
                          <div className="mt-4 ml-2">
                            <div className="flex gap-3">
                              <img
                                src={
                                  users.find(
                                    (u: any) => Number(u.id) === Number(lastReply.userId ?? lastReply.user_id)
                                  )?.profile_image_url ||
                                  users.find(
                                    (u: any) => Number(u.id) === Number(lastReply.userId ?? lastReply.user_id)
                                  )?.profileImage ||
                                  'https://via.placeholder.com/40'
                                }
                                className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                                alt=""
                              />

                              <div className="flex-1 min-w-0">
                                <p className="text-white font-black text-[22px] leading-none mb-2">
                                  {users.find(
                                    (u: any) => Number(u.id) === Number(lastReply.userId ?? lastReply.user_id)
                                  )?.name || 'User'}
                                </p>

                                {!!lastReply.text && (
                                  <p className="text-[#E4E6EB] text-[22px] leading-[1.28] font-medium whitespace-pre-wrap break-words">
                                    {lastReply.text}
                                  </p>
                                )}

                                {(lastReply.image_url || lastReply.imageUrl) && (
                                  <img
                                    src={lastReply.image_url || lastReply.imageUrl}
                                    alt=""
                                    className="mt-3 max-w-[220px] rounded-[18px] border border-white/10 object-cover"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 pb-10 border-t border-white/5 bg-[#0A0A0A]">
          {replyTo && (
            <div className="mb-3 flex items-center gap-2 bg-white/5 p-2 rounded-lg">
              <span className="text-xs text-white/60">Replying to</span>
              <span className="text-xs text-[#1877F2] font-bold">
                @{users.find((u) => Number(u.id) === Number(replyTo.userId ?? replyTo.user_id))?.name || 'User'}
              </span>
              <button onClick={() => setReplyTo(null)} className="ml-auto text-white/40 hover:text-white">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
          )}

          {imagePreview && (
            <div className="mb-3 relative inline-block">
              <img src={imagePreview} className="h-20 rounded-lg border border-white/10" alt="" />
              <button
                onClick={() => {
                  if (imagePreview) URL.revokeObjectURL(imagePreview);
                  setSelectedImage(null);
                  setImagePreview(null);
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
              >
                <i className="fas fa-times text-white text-xs"></i>
              </button>
            </div>
          )}

          {showEmojiBar && (
            <div className="mb-3 flex flex-wrap gap-2 bg-white/5 border border-white/10 rounded-2xl p-3">
              {COMMENT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="text-2xl leading-none active:scale-90 transition-transform hover:bg-white/10 p-1 rounded-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageSelect}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white"
            >
              <i className="fas fa-image"></i>
            </button>

            <button
              onClick={() => setShowEmojiBar((prev) => !prev)}
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-colors ${
                showEmojiBar
                  ? 'bg-[#1877F2]/15 border-[#1877F2]/40 text-[#1877F2]'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
              }`}
            >
              <i className="far fa-smile"></i>
            </button>

            <input
              ref={inputRef}
              className="flex-1 bg-white/5 border border-white/10 rounded-[24px] px-5 py-4 text-[17px] text-white outline-none focus:border-[#1877F2] focus:bg-white/10 transition-all"
              placeholder={replyTo ? 'Write a reply...' : 'Add to discussion...'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && (text.trim() || selectedImage)) {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />

            <button
              onClick={handleSubmitComment}
              className="bg-[#1877F2] text-white px-6 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-all disabled:opacity-50"
              disabled={!text.trim() && !selectedImage}
            >
              <i className="fas fa-paper-plane text-xs"></i>
            </button>
          </div>
        </div>
      </div>

      {menuComment && (
        <div
          className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm"
          onClick={() => setMenuComment(null)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-w-[450px] mx-auto bg-[#121212] rounded-t-[32px] border-t border-white/10 p-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5"></div>

            <button
              onClick={() => {
                setShowReactionPicker(menuComment.id);
                setMenuComment(null);
              }}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white"
            >
              <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white/80">
                <i className="fas fa-smile"></i>
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">React</p>
                <p className="text-white/50 text-xs">Add emoji reaction</p>
              </div>
            </button>

            <button
              onClick={() => {
                setReplyTo(menuComment);
                setMenuComment(null);
              }}
              className="w-full mt-3 flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white"
            >
              <div className="w-11 h-11 rounded-full bg-[#1877F2]/15 flex items-center justify-center text-[#1877F2]">
                <i className="fas fa-reply"></i>
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Reply</p>
                <p className="text-white/50 text-xs">Respond to this discussion</p>
              </div>
            </button>

            {isOwnerComment(menuComment) && (
              <>
                <button
                  onClick={() => openEditComment(menuComment)}
                  className="w-full mt-3 flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white"
                >
                  <div className="w-11 h-11 rounded-full bg-[#45BD62]/15 flex items-center justify-center text-[#45BD62]">
                    <i className="fas fa-pen"></i>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Edit</p>
                    <p className="text-white/50 text-xs">Change your message</p>
                  </div>
                </button>

                <button
                  onClick={() => confirmDeleteComment(menuComment)}
                  className="w-full mt-3 flex items-center gap-4 px-4 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400"
                >
                  <div className="w-11 h-11 rounded-full bg-red-500/15 flex items-center justify-center">
                    <i className="fas fa-trash-alt"></i>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Delete</p>
                    <p className="text-red-300/60 text-xs">Remove it permanently</p>
                  </div>
                </button>
              </>
            )}

            <button
              onClick={() => setMenuComment(null)}
              className="w-full mt-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/80 font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {editingComment && (
        <div className="fixed inset-0 z-[510] bg-black/70 backdrop-blur-sm flex items-end">
          <div className="w-full max-w-[450px] mx-auto bg-[#121212] rounded-t-[32px] border-t border-white/10 p-5 animate-slide-up">
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5"></div>

            <h3 className="text-white text-lg font-black mb-4">Edit Discussion</h3>

            <textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none text-[17px]"
              placeholder="Update discussion..."
            />

            <div className="mt-3 flex flex-wrap gap-2 bg-white/5 border border-white/10 rounded-2xl p-3">
              {COMMENT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEditEmoji(emoji)}
                  className="text-2xl leading-none active:scale-90 transition-transform hover:bg-white/10 p-1 rounded-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setEditingComment(null);
                  setEditingText('');
                }}
                className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white"
              >
                Cancel
              </button>
              <button
                onClick={saveEditedComment}
                className="flex-1 py-4 rounded-2xl bg-[#1877F2] text-white font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== SOUND DETAIL VIEW ====================
interface SoundDetailViewProps {
  sound: Sound;
  onClose: () => void;
  onReelClick: (id: number) => void;
}

export const SoundDetailView: React.FC<SoundDetailViewProps> = ({
  sound,
  onClose,
  onReelClick,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [soundReels, setSoundReels] = useState<Reel[]>([]);
  const [soundStats, setSoundStats] = useState({
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalUses: 0,
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<any>(null);
  const previewStopRef = useRef<any>(null);

  useEffect(() => {
    const fetchSoundReels = async () => {
      try {
        const soundKey = sound.soundKey || sound.id;
        const response = await fetch(`/api/reels/by-sound?sound_key=${encodeURIComponent(String(soundKey))}&limit=60`);
        const data = await response.json();

        if (data?.success && data.reels) {
          setSoundReels(data.reels);

          const stats = {
            totalViews: 0,
            totalLikes: 0,
            totalComments: 0,
            totalShares: 0,
            totalUses: data.reels.length,
          };

          data.reels.forEach((reel: Reel) => {
            stats.totalViews += reel.views || 0;
            stats.totalLikes += reel.reactions?.length || 0;
            stats.totalComments += reel.comments?.length || 0;
            stats.totalShares += reel.shares || 0;
          });

          setSoundStats(stats);
        }
      } catch (error) {
        console.error('Failed to fetch sound reels:', error);
        setSoundReels([]);
      }
    };

    fetchSoundReels();
  }, [sound.id, sound.soundKey]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (previewStopRef.current) clearTimeout(previewStopRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  const playSoundPreview = () => {
    if (!audioRef.current) return;

    if (previewStopRef.current) clearTimeout(previewStopRef.current);

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    audioRef.current.src = sound.url;
    audioRef.current.currentTime = sound.start || 0;
    audioRef.current.play().catch(() => {});
    setIsPlaying(true);

    const duration = (sound.end || sound.duration || 30) - (sound.start || 0);
    previewStopRef.current = setTimeout(() => {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = sound.start || 0;
      }
    }, Math.min(duration * 1000, 10000));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCount = (num: number): string => {
    if (!num && num !== 0) return '0';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black flex flex-col animate-fade-in font-sans pb-20 overflow-hidden">
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 bg-black/90 backdrop-blur-xl shrink-0">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          <i className="fas fa-chevron-left text-sm"></i>
        </button>
        <h3 className="font-black text-white text-[12px] uppercase tracking-[4px]">Sound Details</h3>
        <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
          <i className="fas fa-share-alt text-sm"></i>
        </button>
      </div>

      <div className="p-8 flex flex-col md:flex-row items-center gap-10 bg-gradient-to-b from-white/10 to-transparent shrink-0">
        <div className="relative group">
          <div
            onClick={playSoundPreview}
            className={`w-36 h-36 rounded-full bg-gradient-to-tr from-gray-950 via-gray-900 to-black shadow-[0_0_50px_rgba(0,0,0,0.9)] border-4 border-white/20 flex items-center justify-center ${isPlaying ? 'animate-spin-slow' : ''} cursor-pointer hover:scale-105 transition-transform`}
          >
            <div className="w-12 h-12 rounded-full bg-[#1877F2]/20 border border-white/10 flex items-center justify-center">
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-[#1877F2] text-2xl ml-1`}></i>
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
            <span className="text-white text-[10px] font-bold">
              {formatDuration(currentTime)} / {formatDuration(sound.duration || 30)}
            </span>
          </div>
        </div>

        <div className="flex-1 text-center md:text-left">
          <h2 className="text-3xl font-black text-white mb-2 leading-tight tracking-tighter">
            {sound.name}
          </h2>
          <div className="flex items-center gap-2 mb-1">
            {sound.creator?.profile_image_url && (
              <img src={sound.creator.profile_image_url} className="w-6 h-6 rounded-full object-cover" alt="" />
            )}
            <p className="text-[#1877F2] font-black text-sm uppercase tracking-widest">
              BY {sound.creator?.name || 'Original Sound'}
            </p>
          </div>
          <p className="text-[#B0B3B8] font-bold text-xs uppercase tracking-[4px] mb-8">
            {formatCount(soundStats.totalUses)} VIRAL CREATIONS • {formatCount(soundStats.totalViews)} VIEWS
          </p>

          <div className="flex">
            <button
              onClick={playSoundPreview}
              className={`w-full px-8 py-4 rounded-2xl font-black text-base border transition-all flex items-center justify-center gap-3 ${isPlaying ? 'bg-[#45BD62]/20 text-[#45BD62] border-[#45BD62]' : 'bg-white/10 text-white border-white/20'}`}
            >
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-sm`}></i>
              {isPlaying ? 'Playing...' : 'Preview'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 border-t border-white/5">
        <h4 className="text-white font-black text-sm uppercase tracking-widest mb-4">Sound Statistics</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">Total Uses</p>
            <p className="text-white text-2xl font-black mt-2">{formatCount(soundStats.totalUses)}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">Total Views</p>
            <p className="text-white text-2xl font-black mt-2">{formatCount(soundStats.totalViews)}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">Total Reactions</p>
            <p className="text-white text-2xl font-black mt-2">{formatCount(soundStats.totalLikes)}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">Duration</p>
            <p className="text-white text-2xl font-black mt-2">{formatDuration(sound.duration || 30)}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">Sound Type</p>
            <p className="text-white text-2xl font-black mt-2">
              {sound.isOriginal ? 'Original' : 'Shared'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-0.5 mt-4">
        <div className="px-8 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-white font-black text-sm uppercase tracking-widest">
                Videos ({formatCount(soundStats.totalUses)})
              </h4>
              <p className="text-white/40 text-xs mt-1">
                {soundStats.totalUses} videos using this sound • {formatCount(soundStats.totalViews)} total views
              </p>
            </div>
            <div className="text-right">
              <p className="text-[#45BD62] text-xs font-bold">
                {soundStats.totalUses > 0 ? formatCount(Math.floor(soundStats.totalViews / soundStats.totalUses)) : 0} avg views per video
              </p>
            </div>
          </div>
        </div>

        {soundReels.length > 0 ? (
          <div className="grid grid-cols-3 gap-0.5">
            {soundReels.map((reel: Reel) => (
              <ReelThumbnail
                key={reel.id}
                reel={reel}
                onClick={() => {
                  onClose();
                  onReelClick(reel.id);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <i className="fas fa-music text-4xl text-[#B0B3B8] mb-4"></i>
            <p className="text-white/60">Be the first to use this sound!</p>
            <p className="text-white/40 text-sm mt-2">No reels are using this sound yet.</p>
          </div>
        )}
      </div>
      <audio ref={audioRef} hidden />
    </div>
  );
};

// ==================== REEL THUMBNAIL COMPONENT ====================
const ReelThumbnail: React.FC<{
  reel: Reel;
  onClick: () => void;
}> = ({ reel, onClick }) => {
  const sources = getReelVideoSources(reel);
  const videoSrc =
    sources.low ||
    sources.medium ||
    sources.hd ||
    (reel as any).video_url ||
    (reel as any).videoUrl ||
    '';

  return (
    <div onClick={onClick} className="aspect-[9/16] bg-white/5 relative cursor-pointer group overflow-hidden">
      <video
        src={videoSrc}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
        muted
        playsInline
        preload="metadata"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-white text-[10px] font-black bg-black/40 px-2 py-1 rounded-lg backdrop-blur-md">
        <i className="fas fa-eye text-[8px]"></i>
        {formatViewCount(reel.views)}
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center">
          <i className="fas fa-play text-white text-xs"></i>
        </div>
      </div>
    </div>
  );
};

// ==================== REEL OWNER MENU ====================
const ReelOwnerMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ isOpen, onClose, onEdit, onDelete }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[920] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 max-w-[450px] mx-auto bg-[#121212] rounded-t-[34px] border-t border-white/10 p-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5"></div>

        <button
          onClick={onEdit}
          className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white"
        >
          <div className="w-11 h-11 rounded-full bg-[#1877F2]/15 flex items-center justify-center text-[#1877F2]">
            <i className="fas fa-pen"></i>
          </div>
          <div className="text-left">
            <p className="font-bold text-sm">Edit Reel</p>
            <p className="text-white/50 text-xs">Change caption, location, or visibility</p>
          </div>
        </button>

        <button
          onClick={onDelete}
          className="w-full mt-3 flex items-center gap-4 px-4 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400"
        >
          <div className="w-11 h-11 rounded-full bg-red-500/15 flex items-center justify-center">
            <i className="fas fa-trash-alt"></i>
          </div>
          <div className="text-left">
            <p className="font-bold text-sm">Delete Reel</p>
            <p className="text-red-300/60 text-xs">This cannot be undone</p>
          </div>
        </button>

        <button
          onClick={onClose}
          className="w-full mt-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/80 font-bold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ==================== EDIT REEL MODAL ====================
const EditReelModal: React.FC<{
  reel: Reel | null;
  caption: string;
  location: string;
  visibility: 'public' | 'followers' | 'private';
  saving: boolean;
  setCaption: (v: string) => void;
  setLocation: (v: string) => void;
  setVisibility: (v: 'public' | 'followers' | 'private') => void;
  onClose: () => void;
  onSave: () => void;
}> = ({
  reel,
  caption,
  location,
  visibility,
  saving,
  setCaption,
  setLocation,
  setVisibility,
  onClose,
  onSave,
}) => {
  if (!reel) return null;

  return (
    <div className="fixed inset-0 z-[930] bg-black/70 backdrop-blur-sm flex items-end">
      <div className="w-full max-w-[450px] mx-auto bg-[#121212] rounded-t-[34px] border-t border-white/10 p-6 animate-slide-up">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5"></div>

        <h3 className="text-white font-black text-lg mb-5">Edit Reel</h3>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none text-[17px]"
          placeholder="Update caption..."
        />

        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full mt-4 bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none text-[17px]"
          placeholder="Location"
        />

        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as 'public' | 'followers' | 'private')}
          className="w-full mt-4 bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none text-[17px]"
        >
          <option value="public">🌍 Public</option>
          <option value="followers">👥 Followers</option>
          <option value="private">🔒 Private</option>
        </select>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-4 rounded-2xl bg-[#1877F2] text-white font-bold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== REELS FEED ====================
interface ReelsFeedProps {
  reels: Reel[];
  users: User[];
  currentUser: User | null;
  onProfileClick: (id: number) => void;
  onReact: (reelId: number, type?: ReactionType) => void;
  onComment: (
    reelId: number,
    payload: {
      text: string;
      parentId?: number | null;
      imageFile?: File | null;
    }
  ) => Promise<void> | void;
  onEditComment: (
    commentId: number,
    payload: {
      text?: string;
      imageFile?: File | null;
      image_url?: string;
    }
  ) => Promise<void> | void;
  onDeleteComment: (commentId: number) => Promise<void> | void;
  onEditReel: (
    reelId: number,
    payload: {
      caption?: string;
      visibility?: string;
      location?: string;
      thumbnail_url?: string;
    }
  ) => Promise<void> | void;
  onDeleteReel: (reelId: number) => Promise<void> | void;
  onShare: (reelId: number, type: 'feed' | 'copy') => void;
  onFollow: (targetUserId: number) => void;
  checkIsFollowing: (targetUserId: number) => boolean;
  followLoading: { [key: number]: boolean };
  initialReelId?: number | null;
  onBack?: () => void;
  onVideoClick?: () => void;
}

export const ReelsFeed: React.FC<ReelsFeedProps> = ({
  reels,
  users,
  currentUser,
  onProfileClick,
  onReact,
  onComment,
  onEditComment,
  onDeleteComment,
  onEditReel,
  onDeleteReel,
  onShare,
  onFollow,
  checkIsFollowing,
  followLoading = {},
  initialReelId,
  onBack,
  onVideoClick,
}) => {
  // ==================== STATE ====================
  const [activeReelId, setActiveReelId] = useState<number | null>(
    initialReelId || reels[0]?.id || null
  );
  const [playingReelId, setPlayingReelId] = useState<number | null>(
    initialReelId || reels[0]?.id || null
  );
  const [showComments, setShowComments] = useState(false);
  const [selectedSoundData, setSelectedSoundData] = useState<Sound | null>(null);
  const [showReelMenu, setShowReelMenu] = useState(false);
  const [menuReelId, setMenuReelId] = useState<number | null>(null);
  const [editingReel, setEditingReel] = useState<Reel | null>(null);
  const [editingReelCaption, setEditingReelCaption] = useState('');
  const [editingReelLocation, setEditingReelLocation] = useState('');
  const [editingReelVisibility, setEditingReelVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [savingReelEdit, setSavingReelEdit] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
  const [reactingReelId, setReactingReelId] = useState<number | null>(null);
  const [reelProgress, setReelProgress] = useState<Record<number, number>>({});
  
  // New states for reactions sheet and share sheet
  const [showReactionsSheet, setShowReactionsSheet] = useState(false);
  const [selectedReelForReactions, setSelectedReelForReactions] = useState<Reel | null>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [selectedReelForShare, setSelectedReelForShare] = useState<Reel | null>(null);

  const [networkLevel, setNetworkLevel] = useState<NetworkLevel>(getNetworkLevel());
  const [resolvedVideoUrls, setResolvedVideoUrls] = useState<Record<number, string>>({});
  const [resolvedAudioUrls, setResolvedAudioUrls] = useState<Record<number, string>>({});
  const [videoErrors, setVideoErrors] = useState<Record<number, boolean>>({});

  // ==================== REFS ====================
  const pendingPlayTimeoutRef = useRef<any>(null);
  
  const viewedReelsRef = useRef<Set<number>>(new Set());
  const preloadLinksRef = useRef<Map<string, HTMLLinkElement>>(new Map());
  const bufferingTimeoutsRef = useRef<Record<number, any>>({});
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const globalAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioSyncCleanupRef = useRef<(() => void) | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const activeIdRef = useRef<number | null>(null);
  const userInteractedRef = useRef(false);
  const warmupTimerRef = useRef<any>(null);
  const playRequestRef = useRef(0);

  const activeIndex = useMemo(
    () => reels.findIndex((r) => r.id === activeReelId),
    [reels, activeReelId]
  );

  // ==================== HELPER FUNCTIONS ====================
  
  const truncateName = (name?: string, max = 9) => {
    const value = String(name || '');
    if (value.length <= max) return value;
    return value.slice(0, max) + '...';
  };

  const addPreloadLink = useCallback((href: string) => {
    if (!href || preloadLinksRef.current.has(href)) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = href;
    document.head.appendChild(link);
    preloadLinksRef.current.set(href, link);

    setTimeout(() => {
      const existing = preloadLinksRef.current.get(href);
      if (existing) {
        existing.remove();
        preloadLinksRef.current.delete(href);
      }
    }, 5000);
  }, []);

  // ==================== UPDATED resolveReelMedia ====================
  const resolveReelMedia = useCallback(
    async (reel: Reel) => {
      const id = reel.id;
      const audioUrl = reel.audioUrl || (reel as any).audio_url || '';
      try {
        const videoSources = getReelVideoSources(reel);
        const pickedVideoUrl = pickBestVideoUrl(videoSources, networkLevel);
        if (pickedVideoUrl && !resolvedVideoUrls[id]) {
          setResolvedVideoUrls((prev) => (prev[id] ? prev : { ...prev, [id]: pickedVideoUrl }));
        }
        if (audioUrl && !resolvedAudioUrls[id]) {
          const cachedAudio = mediaBlobCache.get(audioUrl);
          if (cachedAudio) {
            setResolvedAudioUrls((prev) => (prev[id] ? prev : { ...prev, [id]: cachedAudio.blobUrl }));
          } else {
            const blobUrl = await fetchAsBlobUrl(audioUrl, 'audio');
            setResolvedAudioUrls((prev) => (prev[id] ? prev : { ...prev, [id]: blobUrl }));
          }
        }
      } catch (err) {
        console.warn('Failed to resolve reel media', err);
      }
    },
    [networkLevel, resolvedVideoUrls, resolvedAudioUrls]
  );

  // ==================== UPDATED warmReelMedia ====================
  const warmReelMedia = useCallback(
    async (reel: Reel) => {
      try {
        const videoSources = getReelVideoSources(reel);
        const pickedVideoUrl = pickBestVideoUrl(videoSources, networkLevel);
        const audioUrl = reel.audioUrl || (reel as any).audio_url || '';
        if (pickedVideoUrl) {
          addPreloadLink(pickedVideoUrl);
        }
        if (audioUrl) {
          await fetchAsBlobUrl(audioUrl, 'audio');
        }
      } catch (err) {
        console.warn('Failed to warm reel media', err);
      }
    },
    [networkLevel, addPreloadLink]
  );

  const unloadFarVideos = useCallback(
    (activeId: number) => {
      const currentIndex = reels.findIndex((r) => r.id === activeId);
      if (currentIndex === -1) return;

      reels.forEach((reel, index) => {
        const video = videoRefs.current[reel.id];
        if (!video) return;

        const distance = Math.abs(index - currentIndex);
        if (distance > 2) {
          try {
            video.pause();
            video.muted = true;
            video.removeAttribute('src');
            video.load();
          } catch (err) {
            console.warn('Failed to unload video', err);
          }
        }
      });
    },
    [reels]
  );

  const waitUntilPlayable = useCallback((video: HTMLVideoElement) => {
    return new Promise<void>((resolve) => {
      if (video.readyState >= 3) {
        resolve();
        return;
      }

      const onCanPlay = () => {
        video.removeEventListener('canplay', onCanPlay);
        resolve();
      };

      video.addEventListener('canplay', onCanPlay, { once: true });
      setTimeout(resolve, 2500);
    });
  }, []);

  const incrementViewCount = useCallback(async (reelId: number) => {
    if (viewedReelsRef.current.has(reelId)) return;

    try {
      viewedReelsRef.current.add(reelId);

      const token = localStorage.getItem('unera_token');
      const response = await fetch(`/api/reels/${reelId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json();

      if (data.success && data.views_count !== undefined) {
        console.log(`View count updated for reel ${reelId}: ${data.views_count}`);
      }
    } catch (error) {
      console.error('Failed to increment view count:', error);
      viewedReelsRef.current.delete(reelId);
    }
  }, []);

  const stopAudio = useCallback(() => {
    Object.values(videoRefs.current).forEach((video) => {
      if (!video) return;
      try {
        video.pause();
      } catch {}
    });
  }, []);

  // ==================== SOUNDTRACK HELPERS ====================
  const stopSoundtrack = useCallback(() => {
    if (audioSyncCleanupRef.current) {
      audioSyncCleanupRef.current();
      audioSyncCleanupRef.current = null;
    }
    const audio = globalAudioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
    } catch {}
  }, []);

  const startSoundtrackForReel = useCallback(
    (id: number) => {
      if (audioSyncCleanupRef.current) {
        audioSyncCleanupRef.current();
        audioSyncCleanupRef.current = null;
      }
      const reel = reels.find((r) => r.id === id);
      const video = videoRefs.current[id];
      const audio = globalAudioRef.current;
      if (!reel || !video || !audio) return;
      if (!userInteractedRef.current) return;

      const soundtrackUrl = resolvedAudioUrls[id] || reel.audioUrl || (reel as any).audio_url || '';
      if (!soundtrackUrl) return;

      const start = Number(reel.audioStart || (reel as any).audio_start || 0);
      const end = Number(reel.audioEnd || (reel as any).audio_end || 0);

      try {
        video.muted = true;
        video.volume = 0;
      } catch {}

      if (audio.src !== soundtrackUrl) {
        audio.src = soundtrackUrl;
      }

      const syncAudio = () => {
        if (video.paused) {
          audio.pause();
          return;
        }
        const targetTime = video.currentTime + start;
        if (end > start && targetTime >= end) {
          try {
            video.currentTime = 0;
            audio.currentTime = start;
          } catch {}
          return;
        }
        if (Math.abs(audio.currentTime - targetTime) > 0.35) {
          try {
            audio.currentTime = targetTime;
          } catch {}
        }
        if (audio.paused) {
          audio.play().catch(() => {});
        }
      };

      video.addEventListener('timeupdate', syncAudio);
      audioSyncCleanupRef.current = () => {
        video.removeEventListener('timeupdate', syncAudio);
      };

      try {
        audio.currentTime = start;
        audio.play().catch(() => {});
      } catch {}
    },
    [reels, resolvedAudioUrls]
  );

  // ==================== UPDATED stopActivePlayback ====================
  const stopActivePlayback = useCallback(() => {
    if (pendingPlayTimeoutRef.current) {
      clearTimeout(pendingPlayTimeoutRef.current);
      pendingPlayTimeoutRef.current = null;
    }
    Object.values(videoRefs.current).forEach((video) => {
      if (!video) return;
      try {
        video.pause();
        video.muted = true;
        video.volume = 0;
      } catch {}
    });
    stopSoundtrack();
  }, [stopSoundtrack]);

  // ==================== UPDATED playOnly ====================
  const playOnly = useCallback(
    async (id: number) => {
      const requestId = ++playRequestRef.current;

      Object.entries(videoRefs.current).forEach(([key, video]) => {
        if (!video) return;
        const rid = Number(key);
        if (rid !== id) {
          try {
            video.pause();
            video.currentTime = 0;
            video.muted = true;
            video.volume = 0;
          } catch {}
        }
      });

      stopSoundtrack();

      const reel = reels.find((r) => r.id === id);
      const video = videoRefs.current[id];
      if (!video || !reel) return;

      setVideoErrors((prev) => ({ ...prev, [id]: false }));

      await resolveReelMedia(reel);
      if (playRequestRef.current !== requestId) return;

      const chosenUrl =
        resolvedVideoUrls[id] || pickBestVideoUrl(getReelVideoSources(reel), networkLevel);

      if (chosenUrl && video.getAttribute('src') !== chosenUrl) {
        video.src = chosenUrl;
        video.load();
      }

      unloadFarVideos(id);

      setActiveReelId(id);
      setPlayingReelId(id);
      activeIdRef.current = id;

      try {
        await waitUntilPlayable(video);
        if (playRequestRef.current !== requestId) return;

        const hasExternalSound = !!(reel.audioUrl || (reel as any).audio_url);

        if (hasExternalSound) {
          video.muted = true;
          video.volume = 0;
        } else if (userInteractedRef.current) {
          video.muted = false;
          video.volume = 1;
        } else {
          video.muted = true;
          video.volume = 0;
        }

        await video.play();

        if (hasExternalSound && userInteractedRef.current) {
          startSoundtrackForReel(id);
        }

        incrementViewCount(id);
      } catch (err) {
        console.warn('Autoplay/play failed', err);
      }
    },
    [
      reels,
      resolveReelMedia,
      resolvedVideoUrls,
      networkLevel,
      unloadFarVideos,
      waitUntilPlayable,
      incrementViewCount,
      stopSoundtrack,
      startSoundtrackForReel,
    ]
  );

  const scrollToReelByIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= reels.length) return;
      const nextReel = reels[index];
      if (!nextReel) return;

      if (pendingPlayTimeoutRef.current) {
        clearTimeout(pendingPlayTimeoutRef.current);
        pendingPlayTimeoutRef.current = null;
      }

      const el = document.querySelector(`[data-reel-id="${nextReel.id}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      setActiveReelId(nextReel.id);
      setPlayingReelId(nextReel.id);

      pendingPlayTimeoutRef.current = setTimeout(() => {
        playOnly(nextReel.id);
      }, 40);
    },
    [reels, playOnly]
  );

  const goToNextReel = useCallback(() => {
    if (activeIndex < reels.length - 1) {
      scrollToReelByIndex(activeIndex + 1);
    }
  }, [activeIndex, reels.length, scrollToReelByIndex]);

  const goToPreviousReel = useCallback(() => {
    if (activeIndex > 0) {
      scrollToReelByIndex(activeIndex - 1);
    }
  }, [activeIndex, scrollToReelByIndex]);

  const handleCameraClick = useCallback(() => {
    stopActivePlayback();
    if (onVideoClick) {
      onVideoClick();
    }
  }, [onVideoClick, stopActivePlayback]);

  // ==================== UPDATED handleVideoClick ====================
  const handleVideoClick = useCallback(
    (reelId: number) => {
      const video = videoRefs.current[reelId];
      if (!video) return;
      userInteractedRef.current = true;

      if (activeIdRef.current === reelId) {
        if (video.paused) {
          video.play().then(() => {
            const reel = reels.find((r) => r.id === reelId);
            const hasExternalSound = !!(reel?.audioUrl || (reel as any)?.audio_url);
            if (hasExternalSound) {
              video.muted = true;
              video.volume = 0;
              startSoundtrackForReel(reelId);
            } else {
              video.muted = false;
              video.volume = 1;
            }
          }).catch(() => {});
        } else {
          video.pause();
          stopSoundtrack();
        }
        return;
      }
      playOnly(reelId);
    },
    [playOnly, reels, startSoundtrackForReel, stopSoundtrack]
  );

  // ==================== New Handlers for Reactions Sheet and Share ====================
  const handleOpenReactions = useCallback((reel: Reel) => {
    setSelectedReelForReactions(reel);
    setShowReactionsSheet(true);
  }, []);

  const handleOpenShare = useCallback((reel: Reel) => {
    setSelectedReelForShare(reel);
    setShowShareSheet(true);
  }, []);

  const handleShareComplete = useCallback(async (destination: string, data?: any) => {
    if (data?.success && selectedReelForShare) {
      // Call parent share handler
      onShare(selectedReelForShare.id, 'feed');
    }
    setShowShareSheet(false);
    setSelectedReelForShare(null);
  }, [selectedReelForShare, onShare]);

  // ==================== EFFECTS ====================
  
  useEffect(() => {
    const nav = navigator as any;
    const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
    if (!conn?.addEventListener) return;

    const handleChange = () => {
      const next = getNetworkLevel();
      setNetworkLevel(next);
      setResolvedVideoUrls({});
    };

    conn.addEventListener('change', handleChange);
    return () => conn.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    return () => {
      preloadLinksRef.current.forEach((link) => link.remove());
      preloadLinksRef.current.clear();
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(bufferingTimeoutsRef.current).forEach((t) => {
        if (t) clearTimeout(t);
      });
    };
  }, []);

  // Improved warm preload
  useEffect(() => {
    if (!activeReelId || reels.length === 0) return;

    const currentIndex = reels.findIndex((r) => r.id === activeReelId);
    if (currentIndex === -1) return;

    if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);

    warmupTimerRef.current = setTimeout(() => {
      const targets = [
        reels[currentIndex],
        reels[currentIndex + 1],
        reels[currentIndex + 2],
        reels[currentIndex + 3],
        reels[currentIndex - 1],
      ].filter(Boolean) as Reel[];

      targets.forEach((targetReel) => {
        warmReelMedia(targetReel);
        resolveReelMedia(targetReel);
      });
    }, 80);

    return () => {
      if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);
    };
  }, [activeReelId, reels, warmReelMedia, resolveReelMedia]);

  useEffect(() => {
    if (!activeReelId) return;
    const reel = reels.find((r) => r.id === activeReelId);
    if (reel) resolveReelMedia(reel);
  }, [activeReelId, reels, resolveReelMedia]);

  useEffect(() => {
    activeIdRef.current = playingReelId;
  }, [playingReelId]);

  useEffect(() => {
    if (!initialReelId || reels.length === 0) return;

    const timer = setTimeout(() => {
      playOnly(initialReelId);
      const el = document.querySelector(`[data-reel-id="${initialReelId}"]`) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 100);

    return () => clearTimeout(timer);
  }, [initialReelId, reels, playOnly]);

  // ==================== UPDATED unlock effect ====================
  useEffect(() => {
    const unlock = () => {
      userInteractedRef.current = true;
      const id = activeIdRef.current ?? activeReelId;
      if (!id) return;
      const video = videoRefs.current[id];
      const reel = reels.find((r) => r.id === id);
      if (!video || !reel) return;

      const hasExternalSound = !!(reel.audioUrl || (reel as any).audio_url);

      if (hasExternalSound) {
        video.muted = true;
        video.volume = 0;
        if (video.paused) {
          video.play().catch(() => {});
        }
        startSoundtrackForReel(id);
      } else {
        video.muted = false;
        video.volume = 1;
        if (video.paused) {
          video.play().catch(() => {});
        }
      }
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [activeReelId, reels, startSoundtrackForReel]);

  useEffect(() => {
    const rootEl = scrollerRef.current;
    if (!rootEl) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        let best: { id: number; ratio: number } | null = null;

        entries.forEach((entry) => {
          const id = Number(entry.target.getAttribute('data-reel-id'));
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { id, ratio: entry.intersectionRatio };
          }
        });

        if (best && best.ratio > 0.6 && activeIdRef.current !== best.id) {
          playOnly(best.id);
        }
      },
      {
        root: rootEl,
        threshold: [0.4, 0.6, 0.8],
      }
    );

    const els = rootEl.querySelectorAll('[data-reel-id]');
    els.forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, [reels, playOnly]);

  // ==================== UPDATED pause when comments open ====================
  useEffect(() => {
    if (!showComments) return;
    const activeId = activeIdRef.current;
    if (activeId) {
      const video = videoRefs.current[activeId];
      if (video) {
        try {
          video.pause();
        } catch {}
      }
    }
    stopSoundtrack();
  }, [showComments, stopSoundtrack]);

  // ==================== UPDATED resume after comments close ====================
  useEffect(() => {
    if (showComments) return;
    const activeId = activeIdRef.current;
    if (!activeId) return;
    const video = videoRefs.current[activeId];
    const reel = reels.find((r) => r.id === activeId);
    if (!video || !reel) return;

    const hasExternalSound = !!(reel.audioUrl || (reel as any).audio_url);

    if (hasExternalSound) {
      video.muted = true;
      video.volume = 0;
    } else if (userInteractedRef.current) {
      video.muted = false;
      video.volume = 1;
    } else {
      video.muted = true;
      video.volume = 0;
    }

    video.play().then(() => {
      if (hasExternalSound && userInteractedRef.current) {
        startSoundtrackForReel(activeId);
      }
    }).catch(() => {});
  }, [showComments, reels, startSoundtrackForReel]);

  // ==================== UPDATED visibility change effect ====================
  useEffect(() => {
    const stopPlayback = () => {
      Object.values(videoRefs.current).forEach((video) => {
        if (!video) return;
        try {
          video.pause();
        } catch {}
      });
      stopSoundtrack();
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPlayback();
      } else if (!showComments && activeIdRef.current) {
        const id = activeIdRef.current;
        const video = videoRefs.current[id];
        const reel = reels.find((r) => r.id === id);
        if (video && reel) {
          const hasExternalSound = !!(reel.audioUrl || (reel as any)?.audio_url);
          if (hasExternalSound) {
            video.muted = true;
            video.volume = 0;
          } else if (userInteractedRef.current) {
            video.muted = false;
            video.volume = 1;
          } else {
            video.muted = true;
            video.volume = 0;
          }
          video.play().then(() => {
            if (hasExternalSound && userInteractedRef.current) {
              startSoundtrackForReel(id);
            }
          }).catch(() => {});
        }
      }
    };
    const handlePageHide = () => {
      stopPlayback();
    };
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showComments, reels, startSoundtrackForReel, stopSoundtrack]);

  useEffect(() => {
    if (selectedSoundData) {
      const activeId = activeIdRef.current;
      if (activeId) {
        const video = videoRefs.current[activeId];
        if (video) {
          try {
            video.pause();
          } catch {}
        }
      }
      stopSoundtrack();
    }
  }, [selectedSoundData, stopSoundtrack]);

  useEffect(() => {
    if (!showReelMenu && !editingReel) return;
    const activeId = activeIdRef.current;
    if (activeId) {
      const video = videoRefs.current[activeId];
      if (video) {
        try {
          video.pause();
        } catch {}
      }
    }
    stopSoundtrack();
  }, [showReelMenu, editingReel, stopSoundtrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopActivePlayback();
    };
  }, [stopActivePlayback]);

  // Before unload stop
  useEffect(() => {
    const handleBeforeUnload = () => {
      stopActivePlayback();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [stopActivePlayback]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showComments || selectedSoundData || showReelMenu || editingReel) return;

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        goToNextReel();
      }

      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goToPreviousReel();
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (activeReelId) handleVideoClick(activeReelId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showComments,
    selectedSoundData,
    showReelMenu,
    editingReel,
    goToNextReel,
    goToPreviousReel,
    activeReelId,
    handleVideoClick,
  ]);

  // ==================== HANDLERS ====================
  const extractSoundFromReel = useCallback(
    (reel: Reel): Sound => {
      const author = users.find((u: User) => Number(u.id) === getReelUserId(reel));
      const soundKey = (reel as any).soundKey || (reel as any).sound_key || 'original:none';
      const audioUrl = reel.audioUrl || (reel as any).audio_url || '';
      const songName = reel.songName || (reel as any).song_name || 'Original Sound';
      const audioStart = reel.audioStart || (reel as any).audio_start || 0;
      const audioEnd = reel.audioEnd || (reel as any).audio_end || 0;

      return {
        id: soundKey,
        name: songName,
        url: audioUrl,
        originalUrl: audioUrl,
        start: audioStart,
        end: audioEnd,
        creator: author,
        creationCount: 0,
        isOriginal: String(soundKey).startsWith('original:'),
        soundKey,
      };
    },
    [users]
  );

  const handleSoundClick = useCallback(
    (reel: Reel) => {
      const sound = extractSoundFromReel(reel);
      setSelectedSoundData(sound);
    },
    [extractSoundFromReel]
  );

  const openEditReel = useCallback(() => {
    const reel = reels.find((r) => Number(r.id) === Number(menuReelId));
    if (!reel) return;

    setEditingReel(reel);
    setEditingReelCaption(reel.caption || '');
    setEditingReelLocation((reel as any).location || '');
    setEditingReelVisibility(((reel as any).visibility || 'public') as 'public' | 'followers' | 'private');
    setShowReelMenu(false);
  }, [reels, menuReelId]);

  const handleSaveReelEdit = useCallback(async () => {
    if (!editingReel) return;

    try {
      setSavingReelEdit(true);
      await Promise.resolve(
        onEditReel(editingReel.id, {
          caption: editingReelCaption,
          location: editingReelLocation,
          visibility: editingReelVisibility,
        })
      );
      setEditingReel(null);
    } catch (e: any) {
      alert(e?.message || 'Failed to update reel');
    } finally {
      setSavingReelEdit(false);
    }
  }, [editingReel, editingReelCaption, editingReelLocation, editingReelVisibility, onEditReel]);

  const handleDeleteOwnedReel = useCallback(async () => {
    if (!menuReelId) return;

    const ok = window.confirm('Delete this reel?');
    if (!ok) return;

    try {
      await Promise.resolve(onDeleteReel(menuReelId));
      setShowReelMenu(false);
      setMenuReelId(null);
    } catch (e: any) {
      alert(e?.message || 'Failed to delete reel');
    }
  }, [menuReelId, onDeleteReel]);

  const handleReaction = useCallback((reelId: number, emoji: string) => {
    if (reactingReelId === reelId) return;
    setReactingReelId(reelId);
    onReact(reelId, emoji as any);
    setTimeout(() => setReactingReelId(null), 300);
    setShowReactionPicker(null);
  }, [onReact, reactingReelId]);

  const activeReel = reels.find((r) => Number(r.id) === Number(activeReelId));

  // ==================== RENDER ====================
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black overflow-hidden font-sans"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Hidden audio element for external soundtrack */}
      <audio ref={globalAudioRef} hidden preload="metadata" playsInline />

      <div
        className="absolute top-0 left-0 right-0 z-40 px-4 flex items-center justify-between bg-gradient-to-b from-black/85 to-transparent"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 8px)', height: '72px' }}
      >
        <button
          onClick={onBack || (() => window.history.back())}
          className="w-10 h-10 rounded-full bg-[#242526]/80 border border-white/10 flex items-center justify-center hover:bg-[#3A3B3C] transition-colors"
        >
          <i className="fas fa-arrow-left text-white text-sm" />
        </button>

        <div className="flex items-center gap-3">
          <h2 className="text-white text-[20px] font-black tracking-tight">Reels</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCameraClick}
            className="w-14 h-14 rounded-full bg-white/5 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-95 transition-all"
            aria-label="Create reel"
          >
            <i className="fas fa-camera text-white text-xl" />
          </button>

          <button
            className="min-w-[52px] h-12 px-4 rounded-full bg-transparent border border-white/25 flex items-center justify-center gap-2 text-white"
            title="Views"
          >
            <i className="fas fa-eye text-[14px]" />
            <span className="text-sm font-bold">{formatViewCount(activeReel?.views)}</span>
          </button>

          <button
            onClick={() => {
              const reel = reels.find((r) => Number(r.id) === Number(activeReelId));
              if (!reel) return;
              const ownerId = Number((reel as any).userId ?? (reel as any).user_id);
              if (ownerId !== Number(currentUser?.id)) return;
              setMenuReelId(reel.id);
              setShowReelMenu(true);
            }}
            className="w-12 h-12 rounded-full bg-transparent border border-white/25 flex items-center justify-center"
          >
            <i className="fas fa-ellipsis-h text-white text-base" />
          </button>
        </div>
      </div>

      <div className="w-full h-full">
        <div
          ref={scrollerRef}
          className="reel-video-shell w-full h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide bg-black"
        >
          {reels.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white p-8">
              <div className="w-24 h-24 rounded-full bg-[#1877F2]/10 flex items-center justify-center mb-6">
                <i className="fas fa-video text-3xl text-[#1877F2]"></i>
              </div>
              <h3 className="text-xl font-black mb-2">No Reels Yet</h3>
              <p className="text-[#B0B3B8] text-sm mb-8 text-center">No reels available right now.</p>
            </div>
          ) : (
            reels.map((reel: Reel, reelIndex) => {
              const author = users.find((u: User) => Number(u.id) === getReelUserId(reel));
              if (!author) return null;

              const isFollowing = checkIsFollowing(Number(author.id));
              const isLoadingFollow = !!followLoading[Number(author.id)];
              const hasReacted = reel.reactions?.some(
                (r) => Number(r.userId ?? r.user_id) === Number(currentUser?.id)
              );
              const isReacting = reactingReelId === reel.id;
              const currentUserReaction = reel.reactions?.find(
                (r) => Number(r.userId ?? r.user_id) === Number(currentUser?.id)
              )?.type;

              // Get first reactor's name for the reaction text
              const firstReactorName = getFirstReactorName(reel.reactions || [], users);

              const videoSources = getReelVideoSources(reel);
              const fallbackVideoUrl = pickBestVideoUrl(videoSources, networkLevel);
              const videoUrl = resolvedVideoUrls[reel.id] || fallbackVideoUrl;
              const isNearActive = Math.abs(reelIndex - activeIndex) <= 1;
              const showError = activeReelId === reel.id && videoErrors[reel.id];

              return (
                <div
                  key={reel.id}
                  id={`reel-${reel.id}`}
                  data-reel-id={reel.id}
                  onContextMenu={(e) => e.preventDefault()}
                  className="reel-container w-full h-[100dvh] snap-start relative bg-black overflow-hidden"
                >
                  <div className="reel-video-shell w-full h-full relative bg-black">
                    <video
                      ref={(el) => {
                        if (el) videoRefs.current[reel.id] = el;
                      }}
                      src={isNearActive ? videoUrl : undefined}
                      poster={(reel as any).thumbnail_url || (reel as any).thumbnail || ''}
                      preload={isNearActive ? 'auto' : 'metadata'}
                      playsInline
                      loop
                      controls={false}
                      disablePictureInPicture
                      controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                      style={{
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                      }}
                      muted={playingReelId !== reel.id}
                      draggable={false}
                      tabIndex={-1}
                      onContextMenu={(e) => e.preventDefault()}
                      onTimeUpdate={(e) => {
                        const video = e.currentTarget;
                        const duration = video.duration || 0;
                        const current = video.currentTime || 0;
                        const progress = duration > 0 ? Math.min(current / duration, 1) : 0;
                        setReelProgress((prev) => {
                          if (prev[reel.id] === progress) return prev;
                          return { ...prev, [reel.id]: progress };
                        });
                      }}
                      onLoadStart={() => {
                        if (bufferingTimeoutsRef.current[reel.id]) {
                          clearTimeout(bufferingTimeoutsRef.current[reel.id]);
                        }
                        setVideoErrors((prev) => ({ ...prev, [reel.id]: false }));
                      }}
                      onWaiting={() => {
                        if (bufferingTimeoutsRef.current[reel.id]) {
                          clearTimeout(bufferingTimeoutsRef.current[reel.id]);
                        }
                      }}
                      onStalled={() => {}}
                      onCanPlay={() => {}}
                      onCanPlayThrough={() => {}}
                      onPlaying={() => {}}
                      onSeeked={() => {}}
                      onError={() => {
                        setVideoErrors((prev) => ({ ...prev, [reel.id]: true }));
                      }}
                    />

                    <div
                      className="absolute inset-0 z-10"
                      onClick={() => handleVideoClick(reel.id)}
                      onContextMenu={(e) => e.preventDefault()}
                      onTouchStart={(e) => {
                        if (e.touches.length > 1) e.preventDefault();
                      }}
                    />

                    {showError && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/35 backdrop-blur-[2px]">
                        <div className="flex flex-col items-center gap-3 px-5 py-4 rounded-2xl bg-black/55 border border-white/10">
                          <i className="fas fa-exclamation-triangle text-yellow-400 text-xl"></i>
                          <p className="text-white text-sm font-bold">Video failed to load</p>
                          <button
                            onClick={() => playOnly(reel.id)}
                            className="px-4 py-2 rounded-xl bg-[#1877F2] text-white text-sm font-bold"
                          >
                            Retry
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="absolute left-0 right-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-20 pb-6 px-4 pointer-events-none">
                      <div className="mb-4 pointer-events-auto">
                        <div className="flex items-center gap-3 mb-2">
                          <img
                            src={author.profile_image_url || author.profileImage}
                            className="w-10 h-10 rounded-full border-2 border-white/30 object-cover cursor-pointer shrink-0"
                            alt=""
                            onClick={() => onProfileClick(author.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="text-white font-bold text-[22px] cursor-pointer hover:underline truncate"
                                onClick={() => onProfileClick(author.id)}
                              >
                                {truncateName(author.name, 9)}
                              </span>
                              {author.is_verified && (
                                <i className="fas fa-check-circle text-[#1877F2] text-xs shrink-0"></i>
                              )}
                              {currentUser?.id !== author.id && (
                                <button
                                  onClick={() => onFollow(author.id)}
                                  disabled={isLoadingFollow}
                                  className="ml-2 h-10 px-5 rounded-[12px] border border-white/35 text-white text-[15px] font-bold bg-transparent active:scale-95 transition-all shrink-0"
                                >
                                  {isLoadingFollow ? '...' : isFollowing ? 'Following' : 'Follow'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {!!reel.caption && (
                          <p className="text-white text-[22px] leading-snug line-clamp-2 mb-2">
                            {reel.caption}
                          </p>
                        )}

                        <div
                          className="flex items-center gap-2 text-white/90 text-[22px] cursor-pointer w-fit"
                          onClick={() => handleSoundClick(reel)}
                        >
                          <i className="fas fa-music text-[#1877F2]" />
                          <span className="font-semibold truncate max-w-[200px]">
                            {reel.songName || (reel as any).song_name || 'Original Sound'}
                          </span>
                        </div>
                      </div>

                      {/* Reaction count with emoji display - SHOWING ACTUAL NAME */}
                      {reel.reactions && reel.reactions.length > 0 && (
                        <div 
                          className="mt-2 px-2 cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto mb-3"
                          onClick={() => handleOpenReactions(reel)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-2">
                              {topReactionEmojis(reel.reactions, 2).map((emoji, i) => (
                                <span
                                  key={i}
                                  className="w-[24px] h-[24px] rounded-full bg-[#3A3B3C] border border-[#242526] flex items-center justify-center text-[16px]"
                                  style={{ zIndex: 10 - i }}
                                >
                                  {emoji}
                                </span>
                              ))}
                            </div>
                            <span className="text-white/70 text-sm font-medium">
                              {reel.reactions.length === 1 
                                ? `${formatCount(reel.reactions.length)} · ${firstReactorName}`
                                : `${formatCount(reel.reactions.length)} · ${firstReactorName} and ${formatCount(reel.reactions.length - 1)} other${reel.reactions.length - 1 !== 1 ? 's' : ''}`
                              }
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-around py-2 pointer-events-auto">
                        <ReelReactionButton
                          reelId={reel.id}
                          hasReacted={hasReacted || false}
                          reactionCount={reel.reactions?.length || 0}
                          currentUserReaction={currentUserReaction}
                          onReact={onReact}
                          isLoading={isReacting}
                        />

                        <ReelDiscussButton
                          commentCount={reel.comments?.length || 0}
                          onClick={() => {
                            setActiveReelId(reel.id);
                            setShowComments(true);
                          }}
                        />

                        <button
                          onClick={() => handleOpenShare(reel)}
                          className="flex items-center justify-center gap-1 px-4 py-2.5 rounded-full bg-transparent border border-white/25 active:scale-95 transition-all"
                        >
                          <i className="fas fa-share text-lg text-white" />
                          <span className="text-white text-sm font-bold ml-1">
                            {formatCount(reel.shares || 0)}
                          </span>
                        </button>
                      </div>

                      {/* Progress bar below action buttons */}
                      <div className="mt-2 px-1 pointer-events-none">
                        <div className="w-full h-[3px] bg-white/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-white rounded-full transition-[width] duration-100 ease-linear" 
                            style={{ width: `${(reelProgress[reel.id] || 0) * 100}%` }} 
                          />
                        </div>
                      </div>
                    </div>

                    {playingReelId === reel.id && videoRefs.current[reel.id]?.paused && (
                      <div
                        className="absolute inset-0 flex items-center justify-center cursor-pointer z-30"
                        onClick={() => handleVideoClick(reel.id)}
                      >
                        <div className="w-16 h-16 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
                          <i className="fas fa-play text-white text-2xl ml-1"></i>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {activeReelId && (
        <ReelCommentsSheet
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          comments={reels.find((r: any) => r.id === activeReelId)?.comments || []}
          users={users}
          currentUser={currentUser}
          onAddComment={(payload) => onComment(activeReelId, payload)}
          onEditComment={onEditComment}
          onDeleteComment={onDeleteComment}
        />
      )}

      {/* Reactions Sheet */}
      {selectedReelForReactions && (
        <ReactionsSheet
          isOpen={showReactionsSheet}
          onClose={() => {
            setShowReactionsSheet(false);
            setSelectedReelForReactions(null);
          }}
          post={selectedReelForReactions as any}
          onProfileClick={onProfileClick}
        />
      )}

      {/* Share Bottom Sheet */}
      {selectedReelForShare && (
        <ShareBottomSheet
          isOpen={showShareSheet}
          onClose={() => {
            setShowShareSheet(false);
            setSelectedReelForShare(null);
          }}
          post={{
            id: selectedReelForShare.id,
            author: users.find(u => u.id === getReelUserId(selectedReelForShare)),
            content: selectedReelForShare.caption,
            media_url: selectedReelForShare.thumbnail_url || selectedReelForShare.videoUrl,
            created_at: selectedReelForShare.created_at,
            source: 'reel',
            item_type: 'reel',
            reel_id: selectedReelForShare.id,
          }}
          currentUser={currentUser}
          users={users}
          groups={[]}
          brands={[]}
          chats={[]}
          onShareComplete={handleShareComplete}
        />
      )}

      {selectedSoundData && (
        <SoundDetailView
          sound={selectedSoundData}
          onClose={() => setSelectedSoundData(null)}
          onReelClick={(id) => {
            setSelectedSoundData(null);
            playOnly(id);
          }}
        />
      )}

      <ReelOwnerMenu
        isOpen={showReelMenu}
        onClose={() => {
          setShowReelMenu(false);
          setMenuReelId(null);
        }}
        onEdit={openEditReel}
        onDelete={handleDeleteOwnedReel}
      />

      <EditReelModal
        reel={editingReel}
        caption={editingReelCaption}
        location={editingReelLocation}
        visibility={editingReelVisibility}
        saving={savingReelEdit}
        setCaption={setEditingReelCaption}
        setLocation={setEditingReelLocation}
        setVisibility={setEditingReelVisibility}
        onClose={() => setEditingReel(null)}
        onSave={handleSaveReelEdit}
      />
    </div>
  );
};

// ==================== STYLES ====================
const styles = `
@keyframes slide-up {
  0% { transform: translateY(100%); }
  100% { transform: translateY(0); }
}
.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}

@keyframes fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin-slow {
  animation: spin-slow 20s linear infinite;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.reel-video-shell,
.reel-video-shell * {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.reel-video-shell video {
  pointer-events: none;
}

.reel-container {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
`;

if (typeof document !== 'undefined' && !document.getElementById('reels-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'reels-styles';
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

// ==================== EXPORTS ====================
export {
  fetchAsBlobUrl,
  formatViewCount,
  getNetworkLevel,
  getReelVideoSources,
  pickBestVideoUrl,
};

export type { Sound, NetworkLevel, ReelVideoSources };

export default ReelsFeed;
