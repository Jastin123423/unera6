import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, Story } from '../types';

// ==================== HELPER FUNCTIONS ====================
const safeText = (v: any): string => String(v ?? '').trim();

const parseServerTime = (value?: string): number => {
  const s = String(value ?? '').trim();
  if (!s) return Date.now();

  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : Date.now();
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    const iso = s.replace(' ', 'T') + 'Z';
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : Date.now();
  }

  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Date.now();
};

const getDefaultProfilePicture = (name: string, userId: number): string => {
  const colors = ['1877F2', '45BD62', 'F3425F', 'F7B928', '9360F7'];
  const color = colors[Math.abs(userId) % colors.length];
  const initials = safeText(name).slice(0, 1).toUpperCase() || 'U';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    initials
  )}&background=${color}&color=fff&size=128&font-size=0.5&bold=true&rounded=true`;
};

const buildStoryUser = (story: any): User => {
  const id = Number(story.user?.id || story.user_id || story.userId || 0);
  const name = safeText(story.user?.name || story.author_name || story.user_name || story.userName || 'User');
  const username = safeText(
    story.user?.username || story.author_username || story.username || name.toLowerCase().replace(/\s+/g, '_') || 'user'
  );
  const profile = safeText(
    story.user?.profile_image_url ||
      story.author_image ||
      story.user_profile_image ||
      story.userProfileImage ||
      ''
  );

  return {
    id,
    name,
    username,
    email: story.user?.email || '',
    profile_image_url: profile || getDefaultProfilePicture(name, id),
    cover_image_url: story.user?.cover_image_url || '',
    followers: Array.isArray(story.user?.followers) ? story.user.followers : [],
    following: Array.isArray(story.user?.following) ? story.user.following : [],
    is_verified: !!(story.user?.is_verified || story.user_is_verified),
    role: story.user?.role || 'user',
    is_online: !!story.user?.is_online,
    location: story.user?.location || '',
    bio: story.user?.bio || '',
    created_at: story.user?.created_at || null,
  } as User;
};

const groupStoriesByUser = (stories: Story[]) => {
  const map = new Map<number, { user_id: number; user: User; stories: Story[]; latest_created_at: string }>();

  for (const story of stories || []) {
    const uid = Number((story as any).user_id || (story as any).userId || 0);
    if (!uid) continue;

    if (!map.has(uid)) {
      map.set(uid, {
        user_id: uid,
        user: buildStoryUser(story),
        stories: [],
        latest_created_at: (story as any).created_at || (story as any).createdAt || '',
      });
    }

    const group = map.get(uid)!;
    group.stories.push(story);

    const currentTime = parseServerTime((story as any).created_at || (story as any).createdAt);
    const latestTime = parseServerTime(group.latest_created_at);
    if (currentTime > latestTime) {
      group.latest_created_at = (story as any).created_at || (story as any).createdAt || '';
      group.user = buildStoryUser(story);
    }
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      stories: [...group.stories].sort(
        (a: any, b: any) =>
          parseServerTime(b.created_at || b.createdAt) - parseServerTime(a.created_at || a.createdAt)
      ),
    }))
    .sort((a, b) => parseServerTime(b.latest_created_at) - parseServerTime(a.latest_created_at));
};

// ==================== STORY VIEWER COMPONENT ====================
interface StoryViewerProps {
  story: Story;
  user: User;
  currentUser: User | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onReply?: (storyId: number, text: string) => void;
  onLike?: (storyId: number) => void;
  onReaction?: (storyId: number, emoji: string) => void;
  onFollow?: (userId: number) => void;
  isFollowing?: boolean;
  allStories: Story[];
  onFetchViewers?: (storyId: number) => Promise<any[]>;
  viewersCount?: number;
  onProfileClick: (userId: number) => void;
  muted?: boolean;
  onToggleMute?: () => void;
  onDeleteStory?: (storyId: number) => void;
  deleteLoading?: boolean;
}

const StoryViewer: React.FC<StoryViewerProps> = ({
  story,
  user,
  currentUser,
  onClose,
  onNext,
  onPrev,
  onReply,
  onLike,
  onReaction,
  onFollow,
  isFollowing = false,
  allStories,
  onFetchViewers,
  viewersCount = 0,
  onProfileClick,
  muted = false,
  onToggleMute,
  onDeleteStory,
  deleteLoading = false,
}) => {
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [liked, setLiked] = useState(false);
  const [userReaction, setUserReaction] = useState<string | null>(null);

  const progressIntervalRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const navLockRef = useRef(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const isOwner = currentUser?.id === user.id;

  const currentStoryIndex = useMemo(() => {
    return allStories.findIndex((s: any) => Number(s.id) === Number((story as any).id));
  }, [allStories, story]);

  const canNavigate = () => {
    const now = Date.now();
    if (now - navLockRef.current < 350) return false;
    navLockRef.current = now;
    return true;
  };

  const stopProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const startProgress = useCallback(() => {
    stopProgress();

    const isVideo = (story as any).type === 'video';
    if (isVideo && videoRef.current) {
      const video = videoRef.current;
      const tick = () => {
        if (!video.duration || !Number.isFinite(video.duration)) return;
        const next = Math.min(100, (video.currentTime / video.duration) * 100);
        setProgress(next);
        if (next >= 100 && canNavigate()) onNext();
      };
      progressIntervalRef.current = setInterval(() => {
        if (!paused) tick();
      }, 100);
      return;
    }

    progressIntervalRef.current = setInterval(() => {
      if (paused) return;

      setProgress((prev) => {
        if (prev >= 100) {
          stopProgress();
          if (canNavigate()) onNext();
          return 100;
        }
        return prev + 1;
      });
    }, 50);
  }, [story, paused, onNext]);

  useEffect(() => {
    setProgress(0);
    setPaused(false);
    setShowReactions(false);
    setShowReplyInput(false);
    stopProgress();
    startProgress();

    return () => stopProgress();
  }, [story.id, startProgress]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopProgress();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (paused) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [paused, story.id]);

  const handlePause = () => {
    setPaused((prev) => !prev);
  };

  const handleLike = () => {
    setLiked((prev) => !prev);
    onLike?.(Number((story as any).id));
  };

  const handleReaction = (emoji: string) => {
    setUserReaction(emoji);
    onReaction?.(Number((story as any).id), emoji);
    setShowReactions(false);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setUserReaction(null);
    }, 2000);
  };

  const handleReply = () => {
    if (!replyText.trim()) return;
    onReply?.(Number((story as any).id), replyText.trim());
    setReplyText('');
    setShowReplyInput(false);
  };

  const loadViewers = async () => {
    if (!onFetchViewers) return;
    if (!showViewers) {
      try {
        const data = await onFetchViewers(Number((story as any).id));
        setViewers(Array.isArray(data) ? data : []);
      } catch {
        setViewers([]);
      }
    }
    setShowViewers((prev) => !prev);
  };

  const handleDelete = () => {
    if (onDeleteStory && window.confirm('Delete this story?')) {
      onDeleteStory(Number((story as any).id));
      onClose();
    }
  };

  const mediaUrl = (story as any).media_url || (story as any).mediaUrl || '';
  const storyType = (story as any).type;
  const storyCaption = (story as any).caption || '';
  const storyText = (story as any).text_content || (story as any).textContent || '';
  const storyBg = (story as any).background_style || (story as any).backgroundStyle || 'linear-gradient(45deg, #1877F2, #0055FF)';
  const storyCreatedAt = (story as any).created_at || (story as any).createdAt;

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(dx) < 40 || Math.abs(dy) > 30) return;
    if (!canNavigate()) return;

    if (dx < 0) onNext();
    else onPrev();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-white text-2xl">
              <i className="fas fa-times"></i>
            </button>

            <div className="flex items-center gap-2">
              <img
                src={user.profile_image_url}
                className="w-10 h-10 rounded-full object-cover border-2 border-white"
                alt=""
              />
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-white font-bold text-sm cursor-pointer hover:underline"
                    onClick={() => onProfileClick(user.id)}
                  >
                    {user.name}
                  </span>
                  {user.is_verified && (
                    <i className="fas fa-check-circle text-[#1877F2] text-xs"></i>
                  )}
                </div>
                <span className="text-white/60 text-xs">
                  {storyCreatedAt ? new Date(storyCreatedAt).toLocaleTimeString() : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwner && onDeleteStory && (
              <button
                onClick={() => setShowMenu(true)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <i className="fas fa-ellipsis-h text-white text-sm"></i>
              </button>
            )}

            {onToggleMute && (
              <button
                onClick={onToggleMute}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <i className={`fas ${muted ? 'fa-volume-mute' : 'fa-volume-up'} text-white text-sm`}></i>
              </button>
            )}
          </div>
        </div>

        {/* Progress bars */}
        <div className="flex gap-1 mt-4">
          {allStories.map((s: any, idx) => {
            const isCurrent = Number(s.id) === Number((story as any).id);
            const isPast = currentStoryIndex > idx;
            const progressValue = isCurrent ? progress : isPast ? 100 : 0;

            return (
              <div
                key={s.id || idx}
                className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white rounded-full transition-all duration-100"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 flex items-center justify-center relative"
        onClick={handlePause}
      >
        {storyType === 'video' ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            className="max-w-full max-h-full object-contain"
            autoPlay
            muted={muted}
            playsInline
            loop={false}
            onEnded={() => {
              if (canNavigate()) onNext();
            }}
          />
        ) : storyType === 'text' ? (
          <div
            className="w-full h-full flex items-center justify-center p-8 text-center"
            style={{ background: storyBg }}
          >
            <p className="text-white text-3xl font-bold whitespace-pre-wrap">
              {storyText || 'Story'}
            </p>
          </div>
        ) : (
          <img
            src={mediaUrl}
            className="max-w-full max-h-full object-contain"
            alt=""
          />
        )}

        {/* Pause overlay */}
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <i className="fas fa-play text-white text-2xl ml-1"></i>
            </div>
          </div>
        )}

        {/* Reaction popup */}
        {userReaction && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-bounce">
            <span className="text-6xl drop-shadow-2xl">{userReaction}</span>
          </div>
        )}

        {/* Navigation arrows */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (canNavigate()) onPrev();
          }}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
        >
          <i className="fas fa-chevron-left text-white text-xl"></i>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (canNavigate()) onNext();
          }}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
        >
          <i className="fas fa-chevron-right text-white text-xl"></i>
        </button>
      </div>

      {/* Footer Actions */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/60 to-transparent">
        {!!storyCaption && (
          <p className="text-white text-sm mb-3 max-w-[70%]">{storyCaption}</p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Reaction button */}
            <div className="relative">
              <button
                onClick={() => setShowReactions((prev) => !prev)}
                className="flex flex-col items-center gap-1"
              >
                {userReaction ? (
                  <span className="text-3xl">{userReaction}</span>
                ) : (
                  <i className="far fa-smile text-white text-2xl"></i>
                )}
                <span className="text-white/70 text-xs">React</span>
              </button>

              {showReactions && (
                <div className="absolute bottom-full left-0 mb-2 bg-[#242526] rounded-2xl p-3 border border-white/10 shadow-2xl">
                  <div className="flex gap-2">
                    {['❤️', '😂', '😮', '😢', '😡', '👍', '🔥', '🎉'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        className="text-2xl hover:scale-125 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Like button */}
            <button onClick={handleLike} className="flex flex-col items-center gap-1">
              <i className={`${liked ? 'fas' : 'far'} fa-heart text-2xl ${liked ? 'text-red-500' : 'text-white'}`}></i>
              <span className="text-white/70 text-xs">Like</span>
            </button>

            {/* Reply button */}
            {!!onReply && (
              <button
                onClick={() => setShowReplyInput((prev) => !prev)}
                className="flex flex-col items-center gap-1"
              >
                <i className="far fa-comment text-white text-2xl"></i>
                <span className="text-white/70 text-xs">Reply</span>
              </button>
            )}

            {/* Viewers button */}
            {!!onFetchViewers && viewersCount > 0 && (
              <button onClick={loadViewers} className="flex flex-col items-center gap-1">
                <i className="far fa-eye text-white text-2xl"></i>
                <span className="text-white/70 text-xs">{viewersCount}</span>
              </button>
            )}

            {/* Follow button */}
            {!isOwner && !!onFollow && !isFollowing && (
              <button
                onClick={() => onFollow(user.id)}
                className="px-4 py-1.5 bg-[#1877F2] rounded-full text-white text-xs font-bold"
              >
                Follow
              </button>
            )}
          </div>
        </div>

        {/* Reply input */}
        {showReplyInput && !!onReply && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Send a reply..."
              className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-white text-sm outline-none focus:border-[#1877F2]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleReply();
              }}
            />
            <button
              onClick={handleReply}
              disabled={!replyText.trim()}
              className="px-4 py-2 bg-[#1877F2] rounded-full text-white text-sm font-bold disabled:opacity-50"
            >
              Send
            </button>
          </div>
        )}
      </div>

      {/* Viewers modal */}
      {showViewers && (
        <div
          className="fixed inset-0 z-[10000] bg-black/80 flex items-end justify-center"
          onClick={() => setShowViewers(false)}
        >
          <div
            className="w-full max-w-[450px] bg-[#121212] rounded-t-3xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#121212] p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Views</h3>
                <button onClick={() => setShowViewers(false)} className="text-white">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <p className="text-white/60 text-sm mt-1">{viewersCount} people viewed this story</p>
            </div>

            <div className="p-4 space-y-3">
              {viewers.map((viewer: any, idx: number) => {
                const vId = Number(viewer.id || viewer.user_id || idx);
                const vImg =
                  viewer.profile_image_url ||
                  viewer.profileImage ||
                  viewer.user?.profile_image_url ||
                  getDefaultProfilePicture(viewer.name || viewer.user?.name || 'U', vId);

                return (
                  <div key={vId} className="flex items-center gap-3">
                    <img
                      src={vImg}
                      className="w-10 h-10 rounded-full object-cover"
                      alt=""
                    />
                    <div className="flex-1">
                      <p className="text-white font-medium">{viewer.name || viewer.user?.name || 'User'}</p>
                      <p className="text-white/40 text-xs">@{viewer.username || viewer.user?.username || 'user'}</p>
                    </div>
                    <button
                      onClick={() => onProfileClick(vId)}
                      className="text-[#1877F2] text-sm font-bold"
                    >
                      View
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Menu modal for story owner */}
      {showMenu && (
        <div
          className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-w-[450px] mx-auto bg-[#121212] rounded-t-3xl p-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5"></div>

            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400"
            >
              <div className="w-11 h-11 rounded-full bg-red-500/15 flex items-center justify-center">
                <i className="fas fa-trash-alt"></i>
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Delete Story</p>
                <p className="text-red-300/60 text-xs">This cannot be undone</p>
              </div>
            </button>

            <button
              onClick={() => setShowMenu(false)}
              className="w-full mt-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/80 font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== MAIN STORY FEEDS COMPONENT ====================
interface StoryFeedsProps {
  initialStory: Story;
  stories: Story[];
  currentUser: User | null;
  onClose: () => void;
  onReply?: (storyId: number, text: string) => void;
  onLike?: (storyId: number) => void;
  onReaction?: (storyId: number, emoji: string) => void;
  onFollow?: (userId: number) => void;
  checkIsFollowing?: (userId: number) => boolean;
  followLoading?: { [key: number]: boolean };
  onFetchViewers?: (storyId: number) => Promise<any[]>;
  onProfileClick: (userId: number) => void;
  onDeleteStory?: (storyId: number) => void;
  deleteLoading?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
}

export const StoryFeeds: React.FC<StoryFeedsProps> = ({
  initialStory,
  stories,
  currentUser,
  onClose,
  onReply,
  onLike,
  onReaction,
  onFollow,
  checkIsFollowing,
  onFetchViewers,
  onProfileClick,
  onDeleteStory,
  deleteLoading = false,
  muted = false,
  onToggleMute = () => {},
}) => {
  const storyGroups = useMemo(() => groupStoriesByUser(stories || []), [stories]);

  const [userIndex, setUserIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const verticalTouchRef = useRef<{ x: number; y: number } | null>(null);
  const verticalNavLockRef = useRef(0);

  useEffect(() => {
    if (!storyGroups.length || !initialStory) return;

    let foundUserIndex = storyGroups.findIndex(
      (g) => Number(g.user_id) === Number((initialStory as any).user_id || (initialStory as any).userId)
    );
    if (foundUserIndex < 0) foundUserIndex = 0;

    const targetGroup = storyGroups[foundUserIndex];
    let foundStoryIndex = targetGroup?.stories?.findIndex(
      (s: any) => Number(s.id) === Number((initialStory as any).id)
    );
    if (foundStoryIndex < 0) foundStoryIndex = 0;

    setUserIndex(foundUserIndex);
    setStoryIndex(foundStoryIndex);
  }, [storyGroups, initialStory]);

  const activeGroup = storyGroups[userIndex] || null;
  const activeStory =
    activeGroup?.stories?.[storyIndex] ||
    storyGroups.find((g) => Number(g.user_id) === Number((initialStory as any).user_id || (initialStory as any).userId))
      ?.stories?.find((s: any) => Number(s.id) === Number((initialStory as any).id)) ||
    initialStory;

  const activeUser = activeGroup?.user || buildStoryUser(activeStory);

  const safeAllStories = activeGroup?.stories?.length ? activeGroup.stories : [activeStory];

  const canVerticalNavigate = () => {
    const now = Date.now();
    if (now - verticalNavLockRef.current < 450) return false;
    verticalNavLockRef.current = now;
    return true;
  };

  const goToNextStory = useCallback(() => {
    const group = storyGroups[userIndex];
    if (!group) {
      onClose();
      return;
    }

    const isLastStory = storyIndex >= group.stories.length - 1;
    if (!isLastStory) {
      setStoryIndex((prev) => prev + 1);
      return;
    }

    const isLastUser = userIndex >= storyGroups.length - 1;
    if (isLastUser) {
      onClose();
      return;
    }

    setUserIndex((prev) => prev + 1);
    setStoryIndex(0);
  }, [storyGroups, userIndex, storyIndex, onClose]);

  const goToPrevStory = useCallback(() => {
    const group = storyGroups[userIndex];
    if (!group) {
      onClose();
      return;
    }

    const isFirstStory = storyIndex <= 0;
    if (!isFirstStory) {
      setStoryIndex((prev) => prev - 1);
      return;
    }

    const isFirstUser = userIndex <= 0;
    if (isFirstUser) {
      onClose();
      return;
    }

    const prevUserIndex = userIndex - 1;
    const prevGroup = storyGroups[prevUserIndex];
    const lastStoryIndex = Math.max(0, (prevGroup?.stories?.length || 1) - 1);

    setUserIndex(prevUserIndex);
    setStoryIndex(lastStoryIndex);
  }, [storyGroups, userIndex, storyIndex, onClose]);

  const goToNextUser = useCallback(() => {
    if (!canVerticalNavigate()) return;
    if (userIndex >= storyGroups.length - 1) return;
    setUserIndex((prev) => prev + 1);
    setStoryIndex(0);
  }, [userIndex, storyGroups.length]);

  const goToPrevUser = useCallback(() => {
    if (!canVerticalNavigate()) return;
    if (userIndex <= 0) return;
    setUserIndex((prev) => prev - 1);
    setStoryIndex(0);
  }, [userIndex]);

  const handleVerticalTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    verticalTouchRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleVerticalTouchEnd = (e: React.TouchEvent) => {
    if (!verticalTouchRef.current) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - verticalTouchRef.current.x;
    const dy = t.clientY - verticalTouchRef.current.y;
    verticalTouchRef.current = null;

    if (Math.abs(dy) < 50 || Math.abs(dy) <= Math.abs(dx)) return;

    if (dy < 0) goToNextUser();
    else goToPrevUser();
  };

  if (!activeStory) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading story...</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-[#1877F2] rounded-full text-white text-sm font-bold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div onTouchStart={handleVerticalTouchStart} onTouchEnd={handleVerticalTouchEnd}>
      {/* user indicators */}
      {storyGroups.length > 1 && (
        <div className="fixed right-3 top-1/2 -translate-y-1/2 z-[10001] flex flex-col gap-2">
          {storyGroups.map((group, idx) => (
            <button
              key={group.user_id}
              onClick={() => {
                setUserIndex(idx);
                setStoryIndex(0);
              }}
              className={`w-2.5 rounded-full transition-all ${
                idx === userIndex ? 'h-8 bg-white' : 'h-2.5 bg-white/35'
              }`}
              aria-label={`Open ${group.user.name} stories`}
            />
          ))}
        </div>
      )}

      <StoryViewer
        story={activeStory}
        user={activeUser}
        currentUser={currentUser}
        onClose={onClose}
        onNext={goToNextStory}
        onPrev={goToPrevStory}
        onReply={onReply}
        onLike={onLike}
        onReaction={onReaction}
        onFollow={onFollow}
        isFollowing={!!checkIsFollowing?.(activeUser.id)}
        allStories={safeAllStories}
        onFetchViewers={onFetchViewers}
        viewersCount={Number((activeStory as any).views_count || (activeStory as any).views || 0)}
        onProfileClick={onProfileClick}
        muted={muted}
        onToggleMute={onToggleMute}
        onDeleteStory={onDeleteStory}
        deleteLoading={deleteLoading}
      />
    </div>
  );
};

export default StoryFeeds;
