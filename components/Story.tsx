// Story.tsx - PROFESSIONAL FACEBOOK/WHATSAPP-LIKE STORIES
// Features:
// 1. Multi-story navigation within same user (like WhatsApp/FB)
// 2. Deduped unique viewers with proper reaction merging
// 3. Professional full-screen viewers modal for authors (blue button)
// 4. Media-ready progress timing (no skipping while loading)
// 5. Comprehensive analytics dashboard for authors
// 6. Preserves all existing APIs and logic

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// -------------------- TYPES --------------------
export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  profile_image_url: string;
  cover_image_url: string;
  followers: number[];
  following: number[];
  is_verified: boolean;
  role: 'user' | 'creator' | 'admin';
  is_online: boolean;
  location: string;
  bio: string;
  created_at: string | null;
}

export interface Song {
  id: number;
  title: string;
  artist_name: string;
  audio_url: string;
  cover_image_url: string;
  duration: number;
}

export interface StoryViewer {
  id: number;
  user_id: number;
  story_id: number;
  viewed_at: string;
  reaction?: 'like' | 'love' | 'wow' | 'haha' | 'sad' | 'angry' | null;
  user?: User;
}

export interface StoryAnalytics {
  total_views: number;
  unique_viewers: number;
  views_with_reactions: number;
  reaction_breakdown: Record<string, number>;
  completion_rate?: number;
  average_view_time?: number;
}

export interface StoryType {
  id: number;
  user_id: number;
  type: 'image' | 'video' | 'text';
  media_url: string | null;
  text_content: string | null;
  background_style: string | null;
  music_url: string | null;
  music_title: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  user?: User;
  views?: StoryViewer[];
  analytics?: StoryAnalytics;
  liked_by_me?: boolean;
}

export interface CreateStoryData {
  user_id: number;
  type: 'image' | 'video' | 'text';
  media_file?: File;
  media_url?: string;
  text_content?: string;
  background_style?: string;
  music_url?: string;
  music_title?: string;
  audio_file?: File;
}

// -------------------- HELPER FUNCTIONS --------------------
const formatStoryTime = (created_at?: string): string => {
  if (!created_at) return 'Just now';
  const t = new Date(created_at).getTime();
  if (!Number.isFinite(t)) return 'Just now';

  const diff = Date.now() - t;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}hrs`;
  return `${Math.floor(diff / 86_400_000)}days`;
};

const safeText = (v: any): string => String(v ?? '').trim();

const isPlaceholderName = (v: any): boolean => {
  const s = String(v ?? '').trim().toLowerCase();
  return !s || s === 'user' || s === 'unknown' || s === 'un';
};

const pickBestName = (...vals: any[]): string => {
  for (const v of vals) if (!isPlaceholderName(v)) return String(v);
  return 'User';
};

const pickBestImage = (...vals: any[]): string => {
  for (const v of vals) {
    const s = safeText(v);
    if (s && s !== 'null' && s !== 'undefined') return s;
  }
  return '';
};

const getDefaultProfilePicture = (name: string, userId: number): string => {
  const colors = ['1877F2', '45BD62', 'F3425F', 'F7B928', '9360F7'];
  const color = colors[Math.abs(userId) % colors.length];
  const initials = safeText(name).slice(0, 1).toUpperCase() || 'U';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    initials
  )}&background=${color}&color=fff&size=128&font-size=0.5&bold=true&rounded=true`;
};

const mergeUserSafe = (prev: User | undefined, patch: Partial<User> | undefined): User => {
  if (!prev && !patch) {
    return {
      id: 0,
      username: 'user',
      name: 'User',
      email: '',
      profile_image_url: getDefaultProfilePicture('User', 0),
      cover_image_url: '',
      followers: [],
      following: [],
      is_verified: false,
      role: 'user',
      is_online: false,
      location: '',
      bio: '',
      created_at: null,
    };
  }

  if (!prev && patch) {
    return {
      id: patch.id || 0,
      username: patch.username || 'user',
      name: patch.name || 'User',
      email: patch.email || '',
      profile_image_url:
        patch.profile_image_url || getDefaultProfilePicture(patch.name || 'User', patch.id || 0),
      cover_image_url: patch.cover_image_url || '',
      followers: Array.isArray(patch.followers) ? patch.followers : [],
      following: Array.isArray(patch.following) ? patch.following : [],
      is_verified: patch.is_verified || false,
      role: patch.role || 'user',
      is_online: patch.is_online || false,
      location: patch.location || '',
      bio: patch.bio || '',
      created_at: patch.created_at || null,
    };
  }

  if (prev && !patch) return prev;

  return {
    ...prev!,
    ...patch,
    id: patch?.id ?? prev!.id,
    username: patch?.username ?? prev!.username,
    name: patch?.name ?? prev!.name,
    followers: Array.isArray(patch?.followers) ? (patch as any).followers : prev!.followers,
    following: Array.isArray(patch?.following) ? (patch as any).following : prev!.following,
    profile_image_url:
      patch?.profile_image_url &&
      safeText(patch.profile_image_url) &&
      !patch.profile_image_url.includes('ui-avatars.com/api/?name=User') &&
      !patch.profile_image_url.includes('ui-avatars.com/api/?name=UN')
        ? patch.profile_image_url
        : prev!.profile_image_url,
  } as User;
};

const isVideoUrl = (url?: string): boolean => {
  const s = safeText(url).toLowerCase();
  return s.endsWith('.mp4') || s.endsWith('.webm') || s.endsWith('.mov') || s.includes('video');
};

const isBlob = (url?: string): boolean => safeText(url).startsWith('blob:');

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

const getReactionEmoji = (reaction?: string | null): string => {
  switch (reaction) {
    case 'like': return '👍';
    case 'love': return '❤️';
    case 'wow': return '😮';
    case 'haha': return '😂';
    case 'sad': return '😢';
    case 'angry': return '😠';
    default: return '👁️';
  }
};

const getReactionColor = (reaction?: string | null): string => {
  switch (reaction) {
    case 'like': return 'text-blue-400';
    case 'love': return 'text-red-400';
    case 'wow': return 'text-yellow-400';
    case 'haha': return 'text-yellow-500';
    case 'sad': return 'text-blue-300';
    case 'angry': return 'text-red-500';
    default: return 'text-white/60';
  }
};

// DEDUPE VIEWERS: Unique + merge reactions + sort by most recent
const dedupeViewers = (arr: StoryViewer[]): StoryViewer[] => {
  const map = new Map<number, StoryViewer>();

  for (const v of arr || []) {
    const uid = Number(v.user?.id ?? v.user_id ?? 0);
    if (!uid) continue;

    const prev = map.get(uid);
    if (!prev) {
      map.set(uid, v);
      continue;
    }

    // Keep whichever has a reaction, or the most recent viewed_at
    const prevHasReaction = !!prev.reaction;
    const nextHasReaction = !!v.reaction;

    if (!prevHasReaction && nextHasReaction) {
      map.set(uid, v);
    } else {
      const a = new Date(prev.viewed_at || 0).getTime();
      const b = new Date(v.viewed_at || 0).getTime();
      if (b > a) map.set(uid, v);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    String(b.viewed_at || '').localeCompare(String(a.viewed_at || ''))
  );
};

// -------------------- STORY VIEWER COMPONENT --------------------
interface StoryViewerProps {
  story: StoryType;
  user: User;
  currentUser: User | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onReply?: (storyId: number, text: string) => void;
  onLike?: (storyId: number) => void;
  onReaction?: (storyId: number, reaction: string) => void;
  
  // Follow system
  onFollow?: (userId: number) => void;
  isFollowing?: boolean;
  
  // Multi-story support
  allStories?: StoryType[];
  
  // Viewers system
  onFetchViewers?: (storyId: number) => Promise<StoryViewer[]>;
  viewersCount?: number;
  
  // Analytics (for author)
  onFetchAnalytics?: (storyId: number) => Promise<StoryAnalytics>;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({
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
  isFollowing,
  allStories = [],
  onFetchViewers,
  viewersCount,
  onFetchAnalytics,
}) => {
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [storyDurationMs, setStoryDurationMs] = useState<number>(5000);
  
  // CRITICAL: Media ready state to prevent skipping
  const [mediaReady, setMediaReady] = useState(false);
  
  // Viewers system
  const [showViewers, setShowViewers] = useState(false);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [viewersError, setViewersError] = useState('');
  
  // Analytics (for author)
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState<StoryAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  
  // Reactions
  const [showReactions, setShowReactions] = useState(false);
  const [userReaction, setUserReaction] = useState<string | null>(
    story.views?.find(v => v.user_id === currentUser?.id)?.reaction || null
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Determine if current user is the author
  const isAuthor = currentUser && currentUser.id === user.id;

  // Freeze list & author for no flicker
  const frozenUserStoriesRef = useRef<StoryType[]>([]);
  const didAdvanceRef = useRef(false);
  const frozenAuthorRef = useRef<{ name: string; image: string; id: number }>({
    name: 'User',
    image: '',
    id: Number(story.user_id) || 0,
  });

  useEffect(() => {
    const bestName = pickBestName(
      (story as any)?.user?.name,
      (story as any)?.author_name,
      (story as any)?.author_username,
      (user as any)?.name
    );

    const bestImage = pickBestImage(
      (story as any)?.user?.profile_image_url,
      (story as any)?.author_image,
      (user as any)?.profile_image_url
    );

    const id = Number((story as any)?.user?.id ?? story.user_id ?? (user as any)?.id ?? 0);

    frozenAuthorRef.current = {
      id,
      name: bestName,
      image: bestImage || getDefaultProfilePicture(bestName, id),
    };
  }, [story.id]);

  useEffect(() => {
    const list = allStories
      .filter((s) => Number(s.user_id) === Number(story.user_id))
      .slice()
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

    frozenUserStoriesRef.current = list;
    didAdvanceRef.current = false;
    setProgress(0);
    setMediaReady(false); // Reset media ready state
  }, [story.id, story.user_id]);

  const userStories = frozenUserStoriesRef.current;
  const currentIndex = userStories.findIndex((s) => Number(s.id) === Number(story.id));

  const currentStoryState = allStories.find((s) => Number(s.id) === Number(story.id)) || story;
  const hasLiked = Boolean(currentUser && (currentStoryState as any)?.liked_by_me);

  const storyIsText = story.type === 'text';
  const storyIsVideo = story.type === 'video' || (!storyIsText && isVideoUrl(story.media_url));
  const storyIsImage = !storyIsText && !storyIsVideo;

  useEffect(() => {
    if (storyIsVideo) {
      setStoryDurationMs(7000);
    } else {
      setStoryDurationMs(5000);
    }
  }, [story.id]);

  // PROGRESS TIMER: Only starts when media is ready
  useEffect(() => {
    if (!mediaReady) return; // Don't start timer until media is ready

    setProgress(0);
    didAdvanceRef.current = false;

    const tickMs = 50;
    const duration = clamp(storyDurationMs || 5000, 1000, 30_000);

    const timer = setInterval(() => {
      if (isPaused) return;

      setProgress((prev) => {
        if (prev >= 100) return 100;

        const increment = 100 / (duration / tickMs);
        const next = Math.min(100, prev + increment);

        if (next >= 100 && !didAdvanceRef.current) {
          didAdvanceRef.current = true;
          clearInterval(timer);
          onNext?.();
        }
        return next;
      });
    }, tickMs);

    return () => clearInterval(timer);
  }, [story.id, isPaused, onNext, storyDurationMs, mediaReady]);

  // Music
  useEffect(() => {
    if (story.music_url && !isBlob(story.music_url)) {
      audioRef.current = new Audio(story.music_url);
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(() => {});
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [story.id, story.music_url]);

  // Pause/play video
  useEffect(() => {
    if (!storyIsVideo) return;
    const v = videoRef.current;
    if (!v) return;

    if (isPaused) {
      v.pause();
    } else {
      v.play().catch(() => {});
    }
  }, [isPaused, storyIsVideo]);

  const handleSendReply = () => {
    if (replyText.trim() && onReply && !isAuthor) {
      onReply(story.id, replyText.trim());
      setReplyText('');
      setIsPaused(false);

      const toast = document.createElement('div');
      toast.className =
        'fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1877F2] text-white px-6 py-2 rounded-full font-bold shadow-lg animate-fade-in z-[300]';
      toast.innerText = 'Reply sent!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }
  };

  const handleLike = () => {
    if (onLike && !isAuthor) {
      onLike(story.id);
      if (!hasLiked) {
        setShowHeartAnim(true);
        setTimeout(() => setShowHeartAnim(false), 800);
      }
    }
  };

  const handleReaction = (reaction: string) => {
    if (onReaction && !isAuthor) {
      onReaction(story.id, reaction);
      setUserReaction(reaction);
      setShowReactions(false);
    }
  };

  const openViewers = async () => {
    if (!onFetchViewers) return;
    setShowViewers(true);
    setLoadingViewers(true);
    setViewersError('');
    try {
      const data = await onFetchViewers(story.id);
      const list = Array.isArray(data) ? data : [];
      setViewers(dedupeViewers(list));
    } catch (e: any) {
      setViewersError(e?.message || 'Failed to load viewers');
      setViewers([]);
    } finally {
      setLoadingViewers(false);
    }
  };

  const openAnalytics = async () => {
    if (!onFetchAnalytics || !isAuthor) return;
    setShowAnalytics(true);
    setLoadingAnalytics(true);
    try {
      const data = await onFetchAnalytics(story.id);
      setAnalytics(data);
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const frozenAuthor = frozenAuthorRef.current;
  const totalViews = viewersCount || story.analytics?.total_views || 0;
  const uniqueViewers = story.analytics?.unique_viewers || viewers.length || 0;

  return (
    <div className="fixed inset-0 z-[250] bg-black flex items-center justify-center animate-fade-in">
      <div
        className="absolute inset-0 opacity-30 bg-cover bg-center blur-3xl"
        style={{
          backgroundImage: story.media_url ? `url(${story.media_url})` : undefined,
          background: !story.media_url ? (story as any).background_style : undefined,
        }}
      />

      <div
        className="absolute top-4 right-4 z-[300] cursor-pointer w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <i className="fas fa-times text-[#E4E6EB] text-2xl"></i>
      </div>

      <div className="relative w-full max-w-[420px] h-full sm:h-[92vh] bg-black sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 p-3 z-30 flex gap-1.5">
          {userStories.map((_, i) => (
            <div key={i} className="h-1 bg-white/20 flex-1 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-75 ease-linear"
                style={{
                  width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-4 left-0 right-0 p-4 z-30 flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <img
              src={frozenAuthor.image}
              alt={frozenAuthor.name}
              className="w-12 h-12 rounded-full border-2 border-[#1877F2] object-cover shadow-lg"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-[17px] drop-shadow-md">
                  {frozenAuthor.name}
                </span>
                {currentUser &&
                  frozenAuthor.id > 0 &&
                  frozenAuthor.id !== currentUser.id &&
                  onFollow && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFollow(frozenAuthor.id);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        isFollowing ? 'bg-[#3A3B3C] text-white' : 'bg-[#1877F2] text-white'
                      } hover:opacity-90 transition-all active:scale-95 border-none`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
              </div>
              <span className="text-white/70 text-[12px] drop-shadow-md">
                {formatStoryTime((story as any).created_at)}
              </span>
            </div>
          </div>

          {/* Author-only buttons */}
          {isAuthor ? (
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openAnalytics();
                }}
                className="flex items-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] transition-all px-3 py-2 rounded-full shadow-lg"
              >
                <i className="fas fa-chart-line text-white/90"></i>
                <span className="text-white font-bold text-xs">
                  {totalViews}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openViewers();
                }}
                className="flex items-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] transition-all px-4 py-2 rounded-full shadow-lg"
              >
                <i className="fas fa-eye text-white/90"></i>
                <span className="text-white font-black text-xs">
                  {uniqueViewers}
                </span>
              </button>
            </div>
          ) : (
            // Non-author view
            <div className="flex gap-2">
              {onFetchViewers && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openViewers();
                  }}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/15 transition-all px-3 py-2 rounded-full border border-white/10"
                >
                  <i className="fas fa-eye text-white/80"></i>
                  <span className="text-white font-bold text-xs">
                    {Number.isFinite(Number(viewersCount)) ? viewersCount : ''}
                  </span>
                </button>
              )}
              {userReaction && (
                <button
                  onClick={() => setShowReactions(!showReactions)}
                  className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/15 rounded-full text-xl"
                >
                  {getReactionEmoji(userReaction)}
                </button>
              )}
            </div>
          )}
        </div>

        {story.music_title && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 flex items-center gap-2 animate-bounce">
            <i className="fas fa-music text-xs text-white"></i>
            <span className="text-white text-xs font-bold whitespace-nowrap">{story.music_title}</span>
          </div>
        )}

        {/* Tap zones */}
        <div
          className="absolute inset-y-0 left-0 w-1/4 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onPrev?.();
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-1/4 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onNext?.();
          }}
        />

        {/* Content */}
        <div
          className="flex-1 flex items-center justify-center bg-[#111] relative"
          onDoubleClick={isAuthor ? undefined : handleLike}
        >
          {storyIsText ? (
            <div
              className="w-full h-full flex items-center justify-center p-10 text-center"
              style={{ background: (story as any).background_style }}
            >
              <span className="text-white font-bold text-4xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] whitespace-pre-wrap">
                {(story as any).text_content}
              </span>
            </div>
          ) : story.media_url && !isBlob(story.media_url) ? (
            storyIsVideo ? (
              <video
                ref={videoRef}
                src={story.media_url}
                className="w-full h-full object-cover"
                playsInline
                autoPlay
                muted={false}
                controls={false}
                onCanPlay={() => setMediaReady(true)}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  const ms = Number.isFinite(v.duration) ? v.duration * 1000 : 7000;
                  setStoryDurationMs(clamp(ms, 5000, 15000));
                  setMediaReady(true);
                  v.play().catch(() => {});
                }}
                onEnded={() => {
                  onNext?.();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaused((p) => !p);
                }}
              />
            ) : (
              <img 
                src={story.media_url} 
                alt="Story" 
                className="w-full h-full object-cover"
                onLoad={() => setMediaReady(true)}
                onError={() => setMediaReady(true)}
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500">
              <span className="text-white font-bold text-2xl">Story Content</span>
            </div>
          )}

          {showHeartAnim && (
            <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
              <i className="fas fa-heart text-white text-9xl drop-shadow-lg animate-pop-heart"></i>
            </div>
          )}

          {/* Loading indicator when media not ready */}
          {!mediaReady && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
            </div>
          )}

          {/* Reaction selector */}
          {showReactions && !isAuthor && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-lg rounded-full p-2 flex gap-2 z-50 border border-white/10">
              {['like', 'love', 'wow', 'haha', 'sad', 'angry'].map((reaction) => (
                <button
                  key={reaction}
                  onClick={() => handleReaction(reaction)}
                  className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-2xl transition-transform hover:scale-125 active:scale-110"
                >
                  {getReactionEmoji(reaction)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom actions - DIFFERENT FOR AUTHOR VS VIEWER */}
        {!isAuthor ? (
          // VIEWER VIEW: Show reply and like buttons
          <div className="absolute bottom-0 left-0 right-0 p-4 z-20 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent pt-12">
            <div className="flex-1 flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-5 py-3.5 focus-within:bg-white/20 transition-all shadow-xl">
              <input
                ref={inputRef}
                type="text"
                placeholder="Send a message..."
                className="bg-transparent text-white placeholder-white/60 outline-none w-full text-[16px]"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setIsPaused(true)}
                onBlur={() => {
                  if (!replyText) setIsPaused(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
              />
              {replyText.trim() && (
                <button
                  onClick={handleSendReply}
                  className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center shadow-lg transition-transform active:scale-90"
                >
                  <i className="fas fa-location-arrow text-white text-sm -rotate-45 ml-[-2px] mt-[-1px]"></i>
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowReactions(!showReactions)}
                className="w-12 h-12 flex items-center justify-center cursor-pointer active:scale-125 transition-transform"
              >
                <i className="fas fa-smile text-white/80 text-2xl"></i>
              </button>
              <button
                onClick={handleLike}
                className="w-12 h-12 flex items-center justify-center cursor-pointer active:scale-125 transition-transform"
              >
                <i
                  className={`fas fa-heart ${
                    hasLiked ? 'text-[#F3425F]' : 'text-white/80'
                  } text-3xl drop-shadow-lg`}
                ></i>
              </button>
            </div>
          </div>
        ) : (
          // AUTHOR VIEW: Show analytics summary
          <div className="absolute bottom-0 left-0 right-0 p-4 z-20 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent pt-12">
            <div className="flex-1">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 text-center border border-white/10">
                  <div className="text-white font-black text-lg">{totalViews}</div>
                  <div className="text-white/60 text-xs">Total Views</div>
                </div>
                <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 text-center border border-white/10">
                  <div className="text-white font-black text-lg">{uniqueViewers}</div>
                  <div className="text-white/60 text-xs">Unique Viewers</div>
                </div>
                <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 text-center border border-white/10">
                  <div className="text-white font-black text-lg">
                    {story.analytics?.views_with_reactions || 0}
                  </div>
                  <div className="text-white/60 text-xs">Reactions</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PROFESSIONAL FULL-SCREEN VIEWERS MODAL (for authors) */}
        {showViewers && (
          <div className="absolute inset-0 z-[500] bg-black/70 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setShowViewers(false)} />

            <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-8">
              <div className="w-full max-w-[560px] bg-[#18191A] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-eye text-[#1877F2]"></i>
                    <h3 className="text-white font-black text-[16px]">Story Viewers</h3>
                    <span className="text-white/60 text-xs font-bold">({viewers.length})</span>
                  </div>

                  <button
                    onClick={() => setShowViewers(false)}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center"
                  >
                    <i className="fas fa-times text-white/80"></i>
                  </button>
                </div>

                {loadingViewers ? (
                  <div className="py-10 flex items-center justify-center text-white/70">
                    <i className="fas fa-spinner fa-spin mr-2"></i> Loading viewers...
                  </div>
                ) : viewersError ? (
                  <div className="py-10 text-center text-red-300 font-bold">{viewersError}</div>
                ) : viewers.length === 0 ? (
                  <div className="py-10 text-center text-white/60 font-bold">No viewers yet</div>
                ) : (
                  <div className="max-h-[70vh] overflow-y-auto p-2">
                    {viewers.map((v) => {
                      const id = Number(v?.user?.id || v?.user_id || 0);
                      const name = pickBestName(v?.user?.name, v?.user?.username, `User ${id || ''}`);
                      const img = v?.user?.profile_image_url || getDefaultProfilePicture(name, id);

                      return (
                        <div
                          key={`${id}-${v.viewed_at}`}
                          className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer"
                          onClick={() => id && onProfileClick?.(id)}
                        >
                          <img src={img} className="w-12 h-12 rounded-full object-cover border border-white/10" alt="" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-black truncate">{name}</p>
                            <p className="text-white/60 text-xs font-bold">{formatStoryTime(v.viewed_at)}</p>
                          </div>

                          <div className={`text-2xl ${getReactionColor(v.reaction)}`}>
                            {getReactionEmoji(v.reaction)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="p-4 border-t border-white/10 flex justify-end">
                  <button
                    onClick={() => setShowViewers(false)}
                    className="px-6 py-2 rounded-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-black"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Bottom Sheet */}
        {showAnalytics && isAuthor && (
          <div
            className="absolute inset-0 z-[400] bg-black/60 flex items-end"
            onClick={() => setShowAnalytics(false)}
          >
            <div
              className="w-full bg-[#18191A] rounded-t-3xl border-t border-white/10 p-4 pb-6 max-h-[80%] overflow-hidden animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <i className="fas fa-chart-line text-[#1877F2]"></i>
                  <h3 className="text-white font-black text-[18px]">Story Analytics</h3>
                </div>
                <button
                  onClick={() => setShowAnalytics(false)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center"
                >
                  <i className="fas fa-times text-white/80"></i>
                </button>
              </div>

              {loadingAnalytics ? (
                <div className="py-10 flex items-center justify-center text-white/70">
                  <i className="fas fa-spinner fa-spin mr-2"></i> Loading analytics...
                </div>
              ) : analytics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#242526] rounded-xl p-4">
                      <div className="text-white font-black text-2xl">{analytics.total_views}</div>
                      <div className="text-white/60 text-sm">Total Views</div>
                    </div>
                    <div className="bg-[#242526] rounded-xl p-4">
                      <div className="text-white font-black text-2xl">{analytics.unique_viewers}</div>
                      <div className="text-white/60 text-sm">Unique Viewers</div>
                    </div>
                    <div className="bg-[#242526] rounded-xl p-4">
                      <div className="text-white font-black text-2xl">
                        {analytics.views_with_reactions}
                      </div>
                      <div className="text-white/60 text-sm">Reactions</div>
                    </div>
                    <div className="bg-[#242526] rounded-xl p-4">
                      <div className="text-white font-black text-2xl">
                        {analytics.completion_rate ? `${analytics.completion_rate}%` : 'N/A'}
                      </div>
                      <div className="text-white/60 text-sm">Completion Rate</div>
                    </div>
                  </div>

                  {analytics.reaction_breakdown && Object.keys(analytics.reaction_breakdown).length > 0 && (
                    <div className="bg-[#242526] rounded-xl p-4">
                      <h4 className="text-white font-bold mb-3">Reactions Breakdown</h4>
                      <div className="space-y-2">
                        {Object.entries(analytics.reaction_breakdown).map(([reaction, count]) => (
                          <div key={reaction} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-xl ${getReactionColor(reaction)}`}>
                                {getReactionEmoji(reaction)}
                              </span>
                              <span className="text-white capitalize">{reaction}</span>
                            </div>
                            <span className="text-white font-bold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-10 text-center text-white/60 font-bold">
                  No analytics data available
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// -------------------- STORY REEL COMPONENT --------------------
interface StoryReelProps {
  stories: StoryType[];
  onProfileClick: (id: number) => void;
  onCreateStory?: () => void;
  onViewStory: (story: StoryType) => void;
  currentUser: User | null;
  onRequestLogin: () => void;
  
  // Follow system props
  onFollow?: (userId: number) => void;
  checkIsFollowing?: (userId: number) => boolean;
  followLoading?: { [key: number]: boolean };
}

export const StoryReel: React.FC<StoryReelProps> = ({
  stories,
  onProfileClick,
  onCreateStory,
  onViewStory,
  currentUser,
  onRequestLogin,
  onFollow,
  checkIsFollowing,
  followLoading,
}) => {
  const toTime = (d: any) => {
    const t = new Date(String(d ?? '')).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  const sortedStories = useMemo(() => 
    [...stories].sort((a, b) => toTime(b.created_at) - toTime(a.created_at)), 
    [stories]
  );

  const uniqueUserStories: StoryType[] = useMemo(() => {
    return Array.from(new Map<number, StoryType>(sortedStories.map((s) => [s.user_id, s])).values());
  }, [sortedStories]);

  const userStoryCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of sortedStories) m.set(Number(s.user_id), (m.get(Number(s.user_id)) || 0) + 1);
    return m;
  }, [sortedStories]);

  const renderCountDots = (count: number) => {
    const maxDots = 5;
    const dots = Math.min(count, maxDots);
    const extra = count - maxDots;

    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: dots }).map((_, i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/80" />
        ))}
        {extra > 0 && <span className="text-white/80 text-[10px] font-black ml-1">+{extra}</span>}
      </div>
    );
  };

  return (
    <div className="w-full flex gap-2.5 mb-6 overflow-x-auto pb-2 scrollbar-hide">
      {/* Create Story */}
      <div
        className="min-w-[110px] sm:min-w-[140px] h-[210px] sm:h-[250px] bg-[#242526] rounded-2xl shadow-md overflow-hidden cursor-pointer relative group flex-shrink-0 border border-[#3E4042]"
        onClick={() => (currentUser ? onCreateStory?.() : onRequestLogin())}
      >
        <img
          src={
            currentUser?.profile_image_url ||
            getDefaultProfilePicture(currentUser?.name || 'User', currentUser?.id || 0)
          }
          alt="Create"
          className="h-[75%] w-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80"
        />
        <div className="absolute bottom-0 w-full h-[25%] bg-[#242526] flex flex-col items-center justify-end pb-3">
          <div className="absolute -top-5 w-10 h-10 bg-[#1877F2] rounded-full flex items-center justify-center border-4 border-[#242526] text-white shadow-lg">
            <i className="fas fa-plus text-lg"></i>
          </div>
          <span className="text-xs font-bold text-[#E4E6EB] mt-4">Create Story</span>
        </div>
      </div>

      {uniqueUserStories.map((story) => {
        const bestName = pickBestName(
          story.user?.name,
          (story as any).author_name,
          (story as any).author_username,
          (story as any).username
        );

        const bestUsername = pickBestName(
          story.user?.username,
          (story as any).author_username,
          (story as any).username,
          bestName.toLowerCase().replace(/\s+/g, '_')
        );

        const authorImage =
          pickBestImage(story.user?.profile_image_url, (story as any).author_image) ||
          getDefaultProfilePicture(bestName, story.user_id);

        const storyUser = story.user || {
          id: story.user_id,
          name: bestName,
          username: bestUsername,
          profile_image_url: authorImage,
        };

        const author = mergeUserSafe(storyUser as any, story.user || {});
        const isMe = !!currentUser && Number(currentUser.id) === Number(author.id);
        const isFollowing = author.id && checkIsFollowing ? checkIsFollowing(Number(author.id)) : false;
        const isLoading = author.id && followLoading ? followLoading[Number(author.id)] : false;

        const count = userStoryCounts.get(Number(story.user_id)) || 1;
        const isText = story.type === 'text';
        const isVid = story.type === 'video' || (!isText && isVideoUrl(story.media_url));

        return (
          <div
            key={story.id}
            className="min-w-[110px] sm:min-w-[140px] h-[210px] sm:h-[250px] relative rounded-2xl overflow-hidden cursor-pointer flex-shrink-0 group shadow-lg border border-white/10"
            onClick={() => onViewStory(story)}
          >
            {isText ? (
              <div
                className="absolute w-full h-full flex items-center justify-center p-3 text-center"
                style={{ background: (story as any).background_style }}
              >
                <span className="text-white font-bold text-[10px] line-clamp-4 leading-tight">
                  {(story as any).text_content}
                </span>
              </div>
            ) : story.media_url && !isBlob(story.media_url) ? (
              isVid ? (
                <div className="absolute w-full h-full">
                  <video
                    src={story.media_url}
                    className="absolute w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    muted
                    playsInline
                  />
                  <div className="absolute bottom-0 right-0 m-3 bg-black/40 border border-white/10 rounded-full px-2 py-1 text-white text-[10px] font-black flex items-center gap-1">
                    <i className="fas fa-play text-[9px]"></i> Video
                  </div>
                </div>
              ) : (
                <img
                  src={story.media_url}
                  alt="Story"
                  className="absolute w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
              )
            ) : (
              <div className="absolute w-full h-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">Story</span>
              </div>
            )}

            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>

            <div
              className="absolute top-3 left-3 w-9 h-9 rounded-full border-4 border-[#1877F2] overflow-hidden z-10 shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                onProfileClick(story.user_id);
              }}
            >
              <img src={author.profile_image_url} alt="" className="w-full h-full object-cover" />
            </div>

            {/* Follow button */}
            {currentUser && !isMe && author.id > 0 && onFollow && (
              <div
                className="absolute top-3 right-3 z-20"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onFollow(Number(author.id));
                }}
              >
                <button
                  disabled={isLoading}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs border ${
                    isFollowing ? 'bg-[#3A3B3C] border-[#4E4F50]' : 'bg-[#1877F2] border-[#1877F2]'
                  } ${isLoading ? 'opacity-60' : 'hover:opacity-90'}`}
                >
                  {isLoading ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : isFollowing ? (
                    <i className="fas fa-check"></i>
                  ) : (
                    <i className="fas fa-plus"></i>
                  )}
                </button>
              </div>
            )}

            {/* Story count dots */}
            <div className="absolute bottom-10 left-3 z-20">{renderCountDots(count)}</div>

            <p className="absolute bottom-3 left-3 text-white font-bold text-xs drop-shadow-md truncate w-[85%]">
              {author.name}
            </p>
          </div>
        );
      })}
    </div>
  );
};

// -------------------- CREATE STORY MODAL --------------------
const STORY_COLORS = [
  'linear-gradient(45deg, #1877F2, #0055FF)',
  'linear-gradient(45deg, #F3425F, #E41E3F)',
  'linear-gradient(45deg, #45BD62, #31A24C)',
  'linear-gradient(45deg, #F7B928, #E3A300)',
  'linear-gradient(45deg, #A033FF, #7B1FA2)',
  'linear-gradient(45deg, #FF7E5F, #FEB47B)',
  'linear-gradient(45deg, #00C6FF, #0072FF)',
  'linear-gradient(45deg, #2193b0, #6dd5ed)',
  'linear-gradient(45deg, #ee9ca7, #ffdde1)',
  'linear-gradient(45deg, #42275a, #734b6d)',
  'linear-gradient(45deg, #BDC3C7, #2C3E50)',
  'linear-gradient(45deg, #000000, #434343)',
];

interface CreateStoryModalProps {
  currentUser: User;
  songs: Song[];
  onClose: () => void;
  onCreate: (story: CreateStoryData) => void;
}

type MediaPick = { file: File; url: string; kind: 'image' | 'video' };

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  currentUser,
  songs,
  onClose,
  onCreate,
}) => {
  const [mode, setMode] = useState<'text' | 'media'>('media');
  const [text, setText] = useState('');
  const [background, setBackground] = useState(STORY_COLORS[0]);
  const [picks, setPicks] = useState<MediaPick[]>([]);
  const [activePick, setActivePick] = useState(0);
  const [selectedMusic, setSelectedMusic] = useState<{
    url: string;
    title: string;
    artist: string;
    cover?: string;
  } | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const canShare = (mode === 'text' && !!text.trim()) || (mode === 'media' && picks.length > 0);

  const cleanupPickUrls = useCallback((arr: MediaPick[]) => {
    for (const p of arr) if (p.url && p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
  }, []);

  const handleCreate = () => {
    if (!canShare) return;

    if (mode === 'text') {
      onCreate({
        user_id: currentUser.id,
        type: 'text',
        text_content: text,
        background_style: background,
        music_url: selectedMusic?.url,
        music_title: selectedMusic ? `${selectedMusic.title} - ${selectedMusic.artist}` : undefined,
        audio_file: audioFile || undefined,
      });
      onClose();
      return;
    }

    // Create one story per pick
    picks.forEach((p, idx) => {
      onCreate({
        user_id: currentUser.id,
        type: p.kind === 'video' ? 'video' : 'image',
        media_file: p.file,
        music_url: selectedMusic?.url,
        music_title: selectedMusic ? `${selectedMusic.title} - ${selectedMusic.artist}` : undefined,
        audio_file: audioFile || undefined,
      });
    });

    onClose();
  };

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: MediaPick[] = [];

    Array.from(files).forEach((file) => {
      const kind: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
      const url = URL.createObjectURL(file);
      newItems.push({ file, url, kind });
    });

    setPicks((prev) => {
      const merged = [...prev, ...newItems];
      return merged.slice(0, 30);
    });
    setMode('media');
    setActivePick((prev) => (picks.length === 0 ? 0 : prev));
  };

  const removePick = (index: number) => {
    setPicks((prev) => {
      const next = prev.slice();
      const removed = next.splice(index, 1);
      cleanupPickUrls(removed);
      return next;
    });
    setActivePick((i) => Math.max(0, Math.min(i, picks.length - 2)));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.currentTarget.value = '';
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setSelectedMusic({
        url: URL.createObjectURL(file),
        title: file.name.split('.')[0],
        artist: 'Local Upload',
      });
      setShowMusicPicker(false);
      e.currentTarget.value = '';
    }
  };

  useEffect(() => {
    return () => {
      cleanupPickUrls(picks);
      if (selectedMusic?.url && selectedMusic.url.startsWith('blob:')) URL.revokeObjectURL(selectedMusic.url);
    };
  }, [picks, selectedMusic?.url, cleanupPickUrls]);

  const active = picks[activePick];

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col font-sans animate-fade-in text-white overflow-hidden">
      <div className="flex justify-between items-center p-4 bg-black/60 backdrop-blur-lg absolute top-0 w-full z-40 border-b border-white/5">
        <button
          onClick={onClose}
          className="text-white font-bold text-sm bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition-all"
        >
          Discard
        </button>
        <h3 className="font-black text-[18px]">Create Story</h3>
        <button
          onClick={handleCreate}
          disabled={!canShare}
          className="bg-[#1877F2] text-white px-6 py-2 rounded-full font-black text-sm disabled:opacity-50 disabled:bg-gray-600 transition-all"
        >
          Share
        </button>
      </div>

      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden mt-16 mb-24"
        style={{ background: mode === 'text' ? background : '#000' }}
      >
        {mode === 'text' ? (
          <textarea
            autoFocus
            placeholder="Start typing..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="bg-transparent text-white text-4xl font-bold text-center w-full max-w-lg outline-none resize-none placeholder-white/40 px-10 h-[40vh] flex items-center justify-center"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center bg-[#000]"
            onClick={() => picks.length === 0 && fileInputRef.current?.click()}
          >
            {picks.length > 0 && active ? (
              <div className="relative w-full h-full">
                {active.kind === 'video' ? (
                  <video
                    src={active.url}
                    className="w-full h-full object-contain bg-black"
                    playsInline
                    controls
                  />
                ) : (
                  <img src={active.url} className="w-full h-full object-contain" alt="" />
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removePick(activePick);
                  }}
                  className="absolute top-4 left-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/35 border border-white/10 backdrop-blur-md px-3 py-2 rounded-full flex items-center gap-1.5">
                  {picks.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePick(i);
                      }}
                      className={`w-2 h-2 rounded-full ${i === activePick ? 'bg-white' : 'bg-white/40'}`}
                      aria-label={`Story ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center cursor-pointer group">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white/20 transition-all">
                  <i className="fas fa-photo-video text-3xl text-white"></i>
                </div>
                <p className="font-black text-xl text-white">Select Photos / Videos</p>
                <p className="text-white/60 text-sm mt-2">
                  Choose multiple items like Facebook stories
                </p>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*,video/*"
              multiple
              onChange={handleFileChange}
            />
          </div>
        )}

        {selectedMusic && (
          <div className="absolute top-20 z-30 bg-white/10 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/20 flex items-center gap-3 shadow-2xl animate-pulse">
            <div className="w-10 h-10 bg-[#1877F2] rounded-lg flex items-center justify-center">
              <i className="fas fa-music text-white"></i>
            </div>
            <div>
              <p className="text-xs font-black text-white leading-tight">{selectedMusic.title}</p>
              <p className="text-[10px] text-white/70">{selectedMusic.artist}</p>
            </div>
            <i
              className="fas fa-times-circle text-white/50 cursor-pointer hover:text-white"
              onClick={() => {
                if (selectedMusic.url.startsWith('blob:')) URL.revokeObjectURL(selectedMusic.url);
                setSelectedMusic(null);
                setAudioFile(null);
              }}
            ></i>
          </div>
        )}

        {mode === 'media' && picks.length > 1 && (
          <div className="absolute bottom-16 left-0 right-0 px-4">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {picks.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setActivePick(i)}
                  className={`relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border ${
                    i === activePick ? 'border-[#1877F2]' : 'border-white/10'
                  }`}
                >
                  {p.kind === 'video' ? (
                    <video src={p.url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={p.url} className="w-full h-full object-cover" alt="" />
                  )}
                  {p.kind === 'video' && (
                    <div className="absolute bottom-1 right-1 bg-black/50 rounded-full w-6 h-6 flex items-center justify-center">
                      <i className="fas fa-play text-white text-[10px]"></i>
                    </div>
                  )}
                </button>
              ))}

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 flex-shrink-0 flex items-center justify-center"
              >
                <i className="fas fa-plus text-white"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 w-full bg-black/80 backdrop-blur-2xl border-t border-white/10 z-40 p-4 pb-8 flex flex-col gap-4">
        {mode === 'text' && (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-2 py-1">
            {STORY_COLORS.map((col, idx) => (
              <div
                key={idx}
                onClick={() => setBackground(col)}
                className={`w-10 h-10 rounded-full flex-shrink-0 cursor-pointer border-2 transition-transform hover:scale-110 ${
                  background === col
                    ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                    : 'border-transparent'
                }`}
                style={{ background: col }}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between px-2">
          <div className="flex gap-2 bg-white/5 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setMode('text')}
              className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
                mode === 'text' ? 'bg-[#1877F2] text-white shadow-lg' : 'text-white/60'
              }`}
            >
              <i className="fas fa-font"></i> Text
            </button>
            <button
              onClick={() => setMode('media')}
              className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
                mode === 'media' ? 'bg-[#1877F2] text-white shadow-lg' : 'text-white/60'
              }`}
            >
              <i className="fas fa-photo-video"></i> Media
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-white/10 text-white/80 hover:bg-white/20"
              title="Add photos/videos"
            >
              <i className="fas fa-plus text-lg"></i>
            </button>

            <button
              onClick={() => setShowMusicPicker(true)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                selectedMusic
                  ? 'bg-[#45BD62] text-white shadow-[0_0_15px_rgba(69,189,98,0.4)]'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              <i className="fas fa-music text-lg"></i>
            </button>
          </div>
        </div>
      </div>

      {showMusicPicker && (
        <div className="fixed inset-0 z-[250] bg-[#18191A] animate-slide-up flex flex-col font-sans">
          <div className="p-4 border-b border-[#3E4042] flex justify-between items-center bg-[#242526]">
            <button onClick={() => setShowMusicPicker(false)} className="text-[#B0B3B8] font-bold">
              <i className="fas fa-chevron-down mr-2"></i>Close
            </button>
            <h3 className="font-bold text-white">Add Music</h3>
            <div className="w-10"></div>
          </div>

          <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
            <div
              onClick={() => audioInputRef.current?.click()}
              className="p-4 bg-[#263951] rounded-xl flex items-center gap-4 cursor-pointer hover:bg-[#2A3F5A] transition-all border border-[#2D88FF]/20"
            >
              <div className="w-12 h-12 bg-[#1877F2] rounded-full flex items-center justify-center shadow-lg">
                <i className="fas fa-cloud-upload-alt text-white"></i>
              </div>
              <div>
                <p className="text-white font-bold">Upload Music</p>
                <p className="text-[#B0B3B8] text-xs">Choose a file from your device</p>
              </div>
            </div>

            <input
              type="file"
              ref={audioInputRef}
              className="hidden"
              accept="audio/*"
              onChange={handleAudioUpload}
            />

            <div className="h-px bg-[#3E4042] my-2"></div>
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest px-1">
              UNERA Music Trends
            </p>

            <div className="flex flex-col gap-2">
              {songs.map((song) => (
                <div
                  key={song.id}
                  onClick={() => {
                    setSelectedMusic({
                      url: song.audio_url,
                      title: song.title,
                      artist: song.artist_name,
                      cover: song.cover_image_url,
                    });
                    setAudioFile(null);
                    setShowMusicPicker(false);
                  }}
                  className="p-3 bg-[#242526] hover:bg-[#3A3B3C] rounded-xl flex items-center gap-4 cursor-pointer transition-all border border-transparent hover:border-[#1877F2]/30"
                >
                  <img src={song.cover_image_url} className="w-14 h-14 rounded-lg object-cover shadow-md" alt="" />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-white font-bold truncate">{song.title}</p>
                    <p className="text-[#B0B3B8] text-sm truncate">{song.artist_name}</p>
                  </div>
                  <i className="fas fa-play-circle text-2xl text-[#1877F2]"></i>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------- ADVANCED STORY VIEWER MODAL WITH MULTI-STORY NAVIGATION --------------------
interface StoryViewerModalProps {
  story: StoryType;
  onClose: () => void;
  onProfileClick: (id: number) => void;
  currentUser?: User | null;
  onFollow?: (userId: number) => void;
  checkIsFollowing?: (userId: number) => boolean;
  followLoading?: { [key: number]: boolean };
  allStories?: StoryType[];
  onFetchViewers?: (storyId: number) => Promise<StoryViewer[]>;
  onFetchAnalytics?: (storyId: number) => Promise<StoryAnalytics>;
  viewersCount?: number;
  onReply?: (storyId: number, text: string) => void;
  onLike?: (storyId: number) => void;
  onReaction?: (storyId: number, reaction: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = (props) => {
  const {
    story,
    onClose,
    onProfileClick,
    currentUser,
    onFollow,
    checkIsFollowing,
    followLoading,
    allStories = [],
    onFetchViewers,
    onFetchAnalytics,
    viewersCount,
    onReply,
    onLike,
    onReaction,
  } = props;

  const user: User = mergeUserSafe(story.user, {
    id: story.user_id,
    name: pickBestName(
      (story as any)?.user?.name,
      (story as any)?.author_name,
      (story as any)?.author_username,
      'User'
    ),
    username: pickBestName((story as any)?.user?.username, (story as any)?.author_username, 'user'),
    email: '',
    profile_image_url:
      pickBestImage((story as any)?.user?.profile_image_url, (story as any)?.author_image) ||
      getDefaultProfilePicture('User', story.user_id),
    cover_image_url: '',
    followers: Array.isArray(story.user?.followers) ? story.user!.followers : [],
    following: Array.isArray(story.user?.following) ? story.user!.following : [],
    is_verified: false,
    role: 'user',
    is_online: false,
    location: '',
    bio: '',
    created_at: null,
  });

  // Build list of this author's stories (oldest -> newest)
  const userStories = useMemo(() => {
    const list = (allStories?.length ? allStories : [story])
      .filter(s => Number(s.user_id) === Number(story.user_id))
      .slice()
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

    // fallback if empty
    return list.length ? list : [story];
  }, [allStories, story.id, story.user_id]);

  const [activeIndex, setActiveIndex] = useState(() => {
    const idx = userStories.findIndex(s => Number(s.id) === Number(story.id));
    return idx >= 0 ? idx : 0;
  });

  // When a new "story" is opened from reel, sync index
  useEffect(() => {
    const idx = userStories.findIndex(s => Number(s.id) === Number(story.id));
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [story.id, userStories]);

  const activeStory = userStories[activeIndex] || story;

  const handleNext = () => {
    const next = activeIndex + 1;
    if (next < userStories.length) {
      setActiveIndex(next);
      return;
    }
    // finished this user's stories => close
    onClose();
  };

  const handlePrev = () => {
    const prev = activeIndex - 1;
    if (prev >= 0) {
      setActiveIndex(prev);
      return;
    }
    onClose();
  };

  const handleReply = (storyId: number, text: string) => onReply?.(storyId, text);
  const handleLike = (storyId: number) => onLike?.(storyId);
  const handleReaction = (storyId: number, reaction: string) => onReaction?.(storyId, reaction);

  const isFollowing = user.id && checkIsFollowing ? checkIsFollowing(Number(user.id)) : false;

  return (
    <StoryViewer
      story={activeStory}
      user={user}
      currentUser={currentUser || null}
      onClose={onClose}
      onNext={handleNext}
      onPrev={handlePrev}
      onReply={handleReply}
      onLike={handleLike}
      onReaction={handleReaction}
      onFollow={onFollow}
      isFollowing={isFollowing}
      allStories={userStories}
      onFetchViewers={onFetchViewers}
      onFetchAnalytics={onFetchAnalytics}
      viewersCount={viewersCount}
    />
  );
};
