import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { Song, Episode, AudioTrack, User } from '../types';
import { DiscussSignalIcon, SparkReactIcon } from './Feed';

/* =========================================================
   CONSTANTS & DEFAULTS
========================================================= */
const DEFAULT_MUSIC_COVER = 'https://media.unera.social/task_01kftb3024ed7bm84gy6j485fh_1769336848_img_0.webp';
const DEFAULT_PODCAST_COVER = 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';

/* =========================================================
   HELPER FUNCTIONS
========================================================= */

const formatCompactNumber = (value: number | string | undefined) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${n}`;
};

const formatReactionCount = (count: number): string => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
};

/* =========================================================
   API CLIENT
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
   REACTION, COMMENT, SHARE API FUNCTIONS
========================================================= */

async function reactToSong(songId: string, userId: number, type: string): Promise<ApiResult<any>> {
  return apiJson(`/api/songs/${songId}/react`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, type: type }),
  });
}

async function reactToPodcast(episodeId: string, userId: number, type: string): Promise<ApiResult<any>> {
  return apiJson(`/api/podcasts/${episodeId}/react`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, type: type }),
  });
}

async function getComments(itemId: string, type: 'music' | 'podcast'): Promise<ApiResult<any[]>> {
  const endpoint = type === 'music' 
    ? `/api/songs/${itemId}/comments`
    : `/api/podcasts/${itemId}/comments`;
  return apiJson(endpoint, { method: 'GET' });
}

async function addComment(itemId: string, type: 'music' | 'podcast', userId: number, text: string): Promise<ApiResult<any>> {
  const endpoint = type === 'music'
    ? `/api/songs/${itemId}/comment`
    : `/api/podcasts/${itemId}/comment`;
  return apiJson(endpoint, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, text: text }),
  });
}

async function shareSong(songId: string, userId: number, destination: string): Promise<ApiResult<any>> {
  return apiJson(`/api/songs/${songId}/share`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, destination: destination }),
  });
}

async function sharePodcast(episodeId: string, userId: number, destination: string): Promise<ApiResult<any>> {
  return apiJson(`/api/podcasts/${episodeId}/share`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, destination: destination }),
  });
}

/* =========================================================
   MAPPERS
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
    type: 'music',
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
    type: 'podcast',
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
   REACTION BUTTON COMPONENT (Icon only, like Feed.tsx)
========================================================= */

const MusicReactionButton: React.FC<{
  hasReacted: boolean;
  reactionCount: number;
  onReact: () => void;
  isLoading?: boolean;
}> = ({ hasReacted, reactionCount, onReact, isLoading = false }) => {
  const [showDock, setShowDock] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewEmoji, setPreviewEmoji] = useState<string>('👍');
  const timerRef = useRef<any>(null);
  const longPressTimerRef = useRef<any>(null);

  const reactionConfig = [
    { type: 'like', icon: '👍', color: '#1877F2' },
    { type: 'love', icon: '❤️', color: '#F3425F' },
    { type: 'haha', icon: '😂', color: '#F7B928' },
    { type: 'wow', icon: '😮', color: '#F7B928' },
    { type: 'sad', icon: '😢', color: '#F7B928' },
    { type: 'angry', icon: '😡', color: '#E41E3F' },
    { type: 'fire', icon: '🔥', color: '#FF6B35' },
    { type: 'party', icon: '🎉', color: '#9C27B0' },
    { type: 'clap', icon: '👏', color: '#4CAF50' },
    { type: 'star', icon: '⭐', color: '#FFD700' },
  ];

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
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    setTimeout(() => setShowPreview(false), 300);
  };

  const handleClick = () => {
    if (hasReacted) {
      setIsAnimating(true);
      onReact();
      setTimeout(() => setIsAnimating(false), 300);
    } else {
      setShowDock(!showDock);
    }
  };

  const handleDockReact = (type: any) => {
    setIsAnimating(true);
    onReact();
    setShowDock(false);
    setShowPreview(false);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleEmojiHover = (emoji: string) => {
    if (showPreview) setPreviewEmoji(emoji);
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
        <div className="absolute -top-16 left-0 bg-[#242526] rounded-full shadow-2xl p-2 border border-[#3E4042] z-50 react-pop flex items-center">
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
                title={r.type}
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
        className={`flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-all ${
          isAnimating ? 'scale-110' : ''
        } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
      >
        <SparkReactIcon size={24} />
        <span className="text-white text-sm font-bold">{formatReactionCount(reactionCount)}</span>
      </button>
    </div>
  );
};

/* =========================================================
   DISCUSS BUTTON COMPONENT (Icon only, like Feed.tsx)
========================================================= */

const MusicDiscussButton: React.FC<{
  commentCount: number;
  onClick: () => void;
}> = ({ commentCount, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-all"
    >
      <DiscussSignalIcon size={24} color="#1877F2" />
      <span className="text-white text-sm font-bold">{formatReactionCount(commentCount)}</span>
    </button>
  );
};

/* =========================================================
   SHARE BUTTON COMPONENT
========================================================= */

const MusicShareButton: React.FC<{
  shareCount: number;
  onClick: () => void;
}> = ({ shareCount, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-all"
    >
      <i className="fas fa-share-alt text-white text-lg"></i>
      <span className="text-white text-sm font-bold">{formatReactionCount(shareCount)}</span>
    </button>
  );
};

/* =========================================================
   COMMENTS SHEET (SIMPLIFIED)
========================================================= */

const MusicCommentsSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  item: Song | Episode | null;
  currentUser: User | null;
  onCommentAdded: () => void;
}> = ({ isOpen, onClose, item, currentUser, onCommentAdded }) => {
  const [text, setText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      fetchComments();
    }
  }, [isOpen, item]);

  const fetchComments = async () => {
    if (!item) return;
    setLoading(true);
    try {
      const type = (item as any).type === 'podcast' ? 'podcast' : 'music';
      const result = await getComments(String(item.id), type);
      if (result.success) {
        setComments(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!text.trim() || !currentUser || !item) return;
    
    const type = (item as any).type === 'podcast' ? 'podcast' : 'music';
    const userId = (currentUser as any).id;
    
    try {
      const result = await addComment(String(item.id), type, userId, text.trim());
      if (result.success) {
        setText('');
        fetchComments();
        onCommentAdded();
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#242526] rounded-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#3E4042] flex justify-between items-center">
          <h3 className="text-white font-bold text-lg">Discussions</h3>
          <button onClick={onClose} className="text-[#B0B3B8] hover:text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-[#B0B3B8] py-8">Loading discussions...</div>
          ) : comments.length === 0 ? (
            <div className="text-center text-[#B0B3B8] py-8">No discussions yet. Be the first to comment!</div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment: any) => (
                <div key={comment.id} className="flex gap-3">
                  <img
                    src={comment.user?.profile_image_url || `https://ui-avatars.com/api/?name=${comment.user?.name || 'U'}&background=1877F2&color=fff`}
                    className="w-8 h-8 rounded-full object-cover"
                    alt=""
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{comment.user?.name || 'User'}</span>
                      <span className="text-[#B0B3B8] text-xs">{new Date(comment.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[#E4E6EB] text-sm mt-1">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {currentUser && (
          <div className="p-4 border-t border-[#3E4042]">
            <div className="flex gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 bg-[#3A3B3C] text-white rounded-full px-4 py-2 outline-none focus:ring-1 focus:ring-[#1877F2]"
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <button
                onClick={handleSubmit}
                disabled={!text.trim()}
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-2 rounded-full font-bold disabled:opacity-50"
              >
                Post
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================================================
   SHARE BOTTOM SHEET (SIMPLIFIED)
========================================================= */

const MusicShareSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  item: any;
  currentUser: User | null;
  onShareComplete: () => void;
}> = ({ isOpen, onClose, item, currentUser, onShareComplete }) => {
  const [sharing, setSharing] = useState(false);

  const handleShare = async (destination: string) => {
    if (!currentUser || !item) return;
    setSharing(true);
    
    const type = item.type === 'podcast' ? 'podcast' : 'song';
    const userId = (currentUser as any).id;
    
    try {
      let result;
      if (type === 'song') {
        result = await shareSong(String(item.id), userId, destination);
      } else {
        result = await sharePodcast(String(item.id), userId, destination);
      }
      
      if (result.success) {
        onShareComplete();
        onClose();
      }
    } catch (error) {
      console.error('Failed to share:', error);
    } finally {
      setSharing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] bg-black/80 flex items-end" onClick={onClose}>
      <div className="bg-[#242526] w-full rounded-t-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#3E4042] text-center">
          <div className="w-12 h-1 bg-[#3E4042] rounded-full mx-auto mb-2"></div>
          <h3 className="text-white font-bold text-lg">Share</h3>
        </div>
        
        <div className="p-4 space-y-2">
          <button
            onClick={() => handleShare('feed')}
            disabled={sharing}
            className="w-full flex items-center gap-3 p-3 hover:bg-[#3A3B3C] rounded-lg transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-[#1877F2]/20 flex items-center justify-center">
              <i className="fas fa-newspaper text-[#1877F2]"></i>
            </div>
            <span className="text-white font-medium">Share to Feed</span>
          </button>
          
          <button
            onClick={() => {
              const url = `${window.location.origin}/music/${item.id}`;
              navigator.clipboard.writeText(url);
              alert('Link copied to clipboard!');
              onClose();
            }}
            className="w-full flex items-center gap-3 p-3 hover:bg-[#3A3B3C] rounded-lg transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-[#45BD62]/20 flex items-center justify-center">
              <i className="fas fa-link text-[#45BD62]"></i>
            </div>
            <span className="text-white font-medium">Copy Link</span>
          </button>
        </div>
        
        <div className="p-4 border-t border-[#3E4042]">
          <button
            onClick={onClose}
            className="w-full py-3 bg-[#3A3B3C] hover:bg-[#4E4F50] text-white font-bold rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   MAIN MUSIC SYSTEM COMPONENT
========================================================= */

interface MusicSystemProps {
  currentUser: User | null;
  onPlayTrack: (track: AudioTrack) => void;
  onProfileClick?: (id: number) => void;
  likedTracks: string[];
  onToggleLike: (key: string, liked: boolean) => void;
  playHistory: AudioTrack[];
  onFollow: (userId: number) => Promise<void>;
  checkIsFollowing: (userId: number) => boolean;
  users?: User[];
  currentTrack?: AudioTrack | null;
  isPlaying?: boolean;
  myTotalPlays?: number;
  playsLoading?: boolean;
}

const MusicSystem: React.FC<MusicSystemProps> = ({ 
  currentUser, 
  onPlayTrack, 
  onProfileClick, 
  likedTracks: initialLikedTracks, 
  onToggleLike,
  playHistory,
  onFollow,
  checkIsFollowing,
  users = [],
  currentTrack,
  isPlaying,
  myTotalPlays = 0,
  playsLoading = false
}) => {
  const [view, setView] = useState<'music' | 'podcasts' | 'dashboard' | 'artist'>('music');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);

  const [songs, setSongs] = useState<Song[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [likedTracks, setLikedTracks] = useState<string[]>(initialLikedTracks);
  const [downloads, setDownloads] = useState<string[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Reaction, Comment, Share States
  const [showComments, setShowComments] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Song | Episode | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareItem, setShareItem] = useState<any>(null);
  const [reactingItemId, setReactingItemId] = useState<string | null>(null);
  
  // Track reaction counts per item
  const [itemReactions, setItemReactions] = useState<Record<string, { count: number; userReaction: string | null }>>({});
  const [itemComments, setItemComments] = useState<Record<string, number>>({});
  const [itemShares, setItemShares] = useState<Record<string, number>>({});

  const isAdmin = (currentUser as any)?.role === 'admin';

  useEffect(() => {
    setLikedTracks(initialLikedTracks || []);
  }, [initialLikedTracks]);

  const fetchMyLikes = useCallback(async () => {
    if (!currentUser) return;

    const userId = String((currentUser as any).id);

    try {
      const [songLikesRes, episodeLikesRes] = await Promise.all([
        apiJson<any[]>(`/api/song-likes?userId=${encodeURIComponent(userId)}`),
        apiJson<any[]>(`/api/podcast-episode-likes?userId=${encodeURIComponent(userId)}`),
      ]);

      const songIds = songLikesRes.success ? (songLikesRes.data || []).map((x: any) => String(x.song_id ?? x.id)) : [];
      const epIds   = episodeLikesRes.success ? (episodeLikesRes.data || []).map((x: any) => String(x.episode_id ?? x.id)) : [];

      const newLikedTracks = [
        ...songIds.map((id: string) => `music:${id}`),
        ...epIds.map((id: string) => `podcast:${id}`),
      ];
      
      setLikedTracks(newLikedTracks);
      
      const currentKeys = new Set(newLikedTracks);
      const prevKeys = new Set(initialLikedTracks);
      
      if (newLikedTracks.length !== initialLikedTracks.length || 
          !newLikedTracks.every(k => initialLikedTracks.includes(k))) {
        newLikedTracks.forEach(key => {
          onToggleLike(key, true);
        });
      }
    } catch (error) {
      console.error('Failed to fetch likes:', error);
    }
  }, [currentUser, onToggleLike, initialLikedTracks]);

  useEffect(() => {
    fetchMyLikes();
  }, [fetchMyLikes]);

  const isTrackLiked = useCallback((id: string | number, type: 'music' | 'podcast'): boolean => {
    return likedTracks.includes(`${type}:${String(id)}`);
  }, [likedTracks]);

  // Handle React
  const handleReact = useCallback(async (item: Song | Episode) => {
    if (!currentUser) {
      alert('Please login to react');
      return;
    }

    const type = (item as any).type === 'podcast' ? 'podcast' : 'music';
    const itemId = String(item.id);
    const key = `${itemId}`;
    
    if (reactingItemId === key) return;
    setReactingItemId(key);

    const currentReaction = itemReactions[itemId]?.userReaction || null;
    const newReaction = currentReaction ? null : 'like';
    
    // Optimistic update
    setItemReactions(prev => ({
      ...prev,
      [itemId]: {
        count: prev[itemId]?.count || 0,
        userReaction: newReaction,
      }
    }));

    try {
      let result;
      if (type === 'music') {
        result = await reactToSong(itemId, (currentUser as any).id, 'like');
      } else {
        result = await reactToPodcast(itemId, (currentUser as any).id, 'like');
      }
      
      if (result.success) {
        const newCount = result.data?.reactions_count || (itemReactions[itemId]?.count || 0);
        setItemReactions(prev => ({
          ...prev,
          [itemId]: {
            count: newCount,
            userReaction: newReaction,
          }
        }));
      } else {
        // Rollback
        setItemReactions(prev => ({
          ...prev,
          [itemId]: {
            count: prev[itemId]?.count || 0,
            userReaction: currentReaction,
          }
        }));
      }
    } catch (error) {
      console.error('Failed to react:', error);
      setItemReactions(prev => ({
        ...prev,
        [itemId]: {
          count: prev[itemId]?.count || 0,
          userReaction: currentReaction,
        }
      }));
    } finally {
      setReactingItemId(null);
    }
  }, [currentUser, itemReactions, reactingItemId]);

  // Handle Comment
  const handleComment = useCallback((item: Song | Episode) => {
    if (!currentUser) {
      alert('Please login to comment');
      return;
    }
    setSelectedItem(item);
    setShowComments(true);
  }, [currentUser]);

  const handleCommentAdded = useCallback(() => {
    if (selectedItem) {
      setItemComments(prev => ({
        ...prev,
        [String(selectedItem.id)]: (prev[String(selectedItem.id)] || 0) + 1
      }));
    }
  }, [selectedItem]);

  // Handle Share
  const handleShare = useCallback((item: Song | Episode) => {
    if (!currentUser) {
      alert('Please login to share');
      return;
    }
    setShareItem({
      id: item.id,
      title: item.title,
      artist: (item as any).artist || (item as Episode).host,
      type: (item as any).type || 'music',
    });
    setShareSheetOpen(true);
  }, [currentUser]);

  const handleShareComplete = useCallback(() => {
    if (shareItem) {
      setItemShares(prev => ({
        ...prev,
        [String(shareItem.id)]: (prev[String(shareItem.id)] || 0) + 1
      }));
    }
  }, [shareItem]);

  // Fetch initial data
  const fetchSongs = useCallback(async () => {
    setLoadingSongs(true);
    setError(null);
    const res = await apiJson<any[]>('/api/songs', { method: 'GET' });
    if (!res.success) {
      setError(res.error);
      setLoadingSongs(false);
      return;
    }
    const arr = Array.isArray(res.data) ? res.data : (res.data as any)?.results || [];
    const mappedSongs = arr.map(mapSongFromApi);
    setSongs(mappedSongs);
    
    // Initialize reaction counts
    const reactionMap: Record<string, { count: number; userReaction: string | null }> = {};
    const commentMap: Record<string, number> = {};
    const shareMap: Record<string, number> = {};
    
    mappedSongs.forEach(song => {
      reactionMap[String(song.id)] = {
        count: (song.stats as any)?.likes || 0,
        userReaction: null,
      };
      commentMap[String(song.id)] = 0;
      shareMap[String(song.id)] = (song.stats as any)?.shares || 0;
    });
    
    setItemReactions(reactionMap);
    setItemComments(commentMap);
    setItemShares(shareMap);
    setLoadingSongs(false);
  }, []);

  const fetchPodcasts = useCallback(async () => {
    setLoadingEpisodes(true);
    setError(null);
    const res = await apiJson<any[]>('/api/podcasts', { method: 'GET' });
    if (!res.success) {
      setError(res.error);
      setLoadingEpisodes(false);
      return;
    }
    const arr = Array.isArray(res.data) ? res.data : (res.data as any)?.results || [];
    const mappedEpisodes = arr.map(mapEpisodeFromApi);
    setEpisodes(mappedEpisodes);
    
    // Initialize reaction counts for episodes
    const reactionMap = { ...itemReactions };
    mappedEpisodes.forEach(ep => {
      reactionMap[String(ep.id)] = {
        count: (ep.stats as any)?.likes || 0,
        userReaction: null,
      };
    });
    setItemReactions(reactionMap);
    setLoadingEpisodes(false);
  }, [itemReactions]);

  useEffect(() => {
    fetchSongs();
    fetchPodcasts();
  }, [fetchSongs, fetchPodcasts]);

  const handlePlayTrackFromSong = useCallback((song: Song) => {
    const uploaderProfile = users.find((u) => u.id === song.uploaderId);
    const artistName = uploaderProfile?.name || uploaderProfile?.username || song.artist;
    
    const audioTrack: AudioTrack = {
      id: String(song.id),
      title: song.title,
      artist: artistName,
      duration: typeof song.duration === 'string'
        ? (() => {
            const parts = song.duration.split(':');
            const mm = Number(parts[0] || 0);
            const ss = Number(parts[1] || 0);
            return mm * 60 + ss || 180;
          })()
        : (song.duration as any) || 180,
      url: song.audioUrl || '',
      uploaderId: song.uploaderId || 1,
      cover: song.cover || DEFAULT_MUSIC_COVER,
      type: 'music',
      isVerified: Boolean((uploaderProfile as any)?.isVerified),
      likesCount: Number((song.stats as any)?.likes || 0),
    } as any;

    onPlayTrack(audioTrack);
  }, [users, onPlayTrack]);

  const handlePlayTrackFromEpisode = useCallback((episode: Episode) => {
    const uploaderProfile = users.find((u) => u.id === episode.uploaderId);
    const hostName = uploaderProfile?.name || uploaderProfile?.username || episode.host || 'Unknown Host';
    
    const audioTrack: AudioTrack = {
      id: String(episode.id),
      title: episode.title,
      artist: hostName,
      duration: typeof episode.duration === 'string'
        ? (() => {
            const parts = episode.duration.split(':');
            const mm = Number(parts[0] || 0);
            const ss = Number(parts[1] || 0);
            return mm * 60 + ss || 1800;
          })()
        : (episode.duration as any) || 1800,
      url: episode.audioUrl || '',
      uploaderId: episode.uploaderId || 1,
      cover: (episode as any).thumbnail || DEFAULT_PODCAST_COVER,
      type: 'podcast',
      isVerified: Boolean((uploaderProfile as any)?.isVerified),
      likesCount: Number((episode.stats as any)?.likes || 0),
    } as any;

    onPlayTrack(audioTrack);
  }, [users, onPlayTrack]);

  const handleArtistClick = (uploaderId: number) => {
    if (onProfileClick) onProfileClick(uploaderId);
    else {
      setSelectedArtistId(uploaderId);
      setView('artist');
    }
  };

  const deleteSong = async (id: string) => {
    if (!currentUser || !isAdmin) return;
    if (!confirm('Delete this song?')) return;

    const res = await apiJson<any>(`/api/songs?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.success) {
      alert(res.error || 'Failed to delete');
      return;
    }
    setSongs((prev) => prev.filter((s) => String(s.id) !== id));
  };

  const deleteEpisode = async (id: string) => {
    if (!currentUser || !isAdmin) return;
    if (!confirm('Delete this episode?')) return;

    const res = await apiJson<any>(`/api/podcasts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.success) {
      alert(res.error || 'Failed to delete');
      return;
    }
    setEpisodes((prev) => prev.filter((e) => String(e.id) !== id));
  };

  const handleDownload = (id: string) => {
    if (!currentUser) return;
    if (!downloads.includes(id)) {
      setDownloads((prev) => [...prev, id]);
    }
  };

  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  }, [songs, searchQuery]);

  const filteredEpisodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return episodes;
    return episodes.filter((e) => e.title.toLowerCase().includes(q) || (e.host || '').toLowerCase().includes(q));
  }, [episodes, searchQuery]);

  const featuredSongs = useMemo(() => {
    return [...songs]
      .sort((a, b) => ((b.stats as any)?.plays || 0) - ((a.stats as any)?.plays || 0))
      .slice(0, 5);
  }, [songs]);

  const heroSong = featuredSongs[heroIndex] || songs[0] || null;

  useEffect(() => {
    if (featuredSongs.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % featuredSongs.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [featuredSongs.length]);

  const dashboardStats = useMemo(() => {
    const totalPlays =
      songs.reduce((sum, s) => sum + (Number((s.stats as any)?.plays) || 0), 0) +
      episodes.reduce((sum, e) => sum + (Number((e.stats as any)?.plays) || 0), 0);

    const totalLikesReceived =
      songs.reduce((sum, s) => sum + (Number((s.stats as any)?.likes) || 0), 0) +
      episodes.reduce((sum, e) => sum + (Number((e.stats as any)?.likes) || 0), 0);

    const myId = Number((currentUser as any)?.id || 0);

    const userSongs = songs.filter((s) => Number(s.uploaderId) === myId);
    const userEpisodes = episodes.filter((e) => Number(e.uploaderId) === myId);

    const userPlays =
      userSongs.reduce((sum, s) => sum + (Number((s.stats as any)?.plays) || 0), 0) +
      userEpisodes.reduce((sum, e) => sum + (Number((e.stats as any)?.plays) || 0), 0);

    const userLikesReceived =
      userSongs.reduce((sum, s) => sum + (Number((s.stats as any)?.likes) || 0), 0) +
      userEpisodes.reduce((sum, e) => sum + (Number((e.stats as any)?.likes) || 0), 0);

    return {
      totalPlays,
      totalTracks: songs.length + episodes.length,
      totalLikesReceived,
      userSongs: userSongs.length,
      userEpisodes: userEpisodes.length,
      userUploads: userSongs.length + userEpisodes.length,
      userPlays,
      userLikesReceived,
      myLikesCount: likedTracks.length,
      myTotalPlays: myTotalPlays || 0,
    };
  }, [songs, episodes, currentUser, likedTracks, myTotalPlays]);

  const selectedArtistUser: User | null = useMemo(() => {
    if (!selectedArtistId) return null;

    const found = users.find((u) => u.id === selectedArtistId);
    if (found) return found;

    const artistName = songs.find((s) => s.uploaderId === selectedArtistId)?.artist || 'Artist';

    return {
      id: selectedArtistId,
      name: artistName,
      profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(artistName)}&background=random`,
      coverImage: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?ixlib=rb-1.2.1&auto=format&fit=crop&w=1500&q=80',
      followers: [],
      following: [],
      isOnline: false,
      isVerified: false,
      role: 'user',
    } as any;
  }, [selectedArtistId, users, songs]);

  const showLoading = (view === 'music' && loadingSongs) || (view === 'podcasts' && loadingEpisodes);

  // Render a music card with action buttons
  const renderMusicCard = (song: Song, index?: number) => {
    const uploaderProfile = users.find((u) => u.id === song.uploaderId);
    const artistName = uploaderProfile?.name || uploaderProfile?.username || song.artist;
    const artistAvatar = (uploaderProfile as any)?.profileImage || (uploaderProfile as any)?.profile_image_url || null;
    const isLiked = isTrackLiked(String(song.id), 'music');
    const reactionData = itemReactions[String(song.id)] || { count: (song.stats as any)?.likes || 0, userReaction: null };
    const commentCount = itemComments[String(song.id)] || 0;
    const shareCount = itemShares[String(song.id)] || (song.stats as any)?.shares || 0;

    return (
      <div className="w-[160px] sm:w-[175px] flex-shrink-0 snap-start">
        <div className="group cursor-pointer">
          <div className="relative rounded-xl overflow-hidden aspect-[1/1] bg-[#1A1A1A]">
            <img src={song.cover || DEFAULT_MUSIC_COVER} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReact(song);
              }}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center"
            >
              <i className={`${reactionData.userReaction ? 'fas' : 'far'} text-white fa-heart text-sm`}></i>
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
                song.uploaderId && handleArtistClick(song.uploaderId);
              }}
              className="mt-1 flex items-center gap-2 max-w-full text-left"
            >
              {artistAvatar ? (
                <img src={artistAvatar} alt={artistName} className="w-4 h-4 rounded-full object-cover" />
              ) : null}
              <span className="text-[#B8BCC7] text-sm truncate inline-flex items-center gap-1">
                {artistName}
                {uploaderProfile?.isVerified ? <i className="fas fa-check-circle text-[#07E8F8] text-[10px]"></i> : null}
              </span>
            </button>
            
            {/* Action Buttons - React, Discuss, Share */}
            <div className="flex items-center justify-between mt-3 gap-1">
              <MusicReactionButton
                hasReacted={!!reactionData.userReaction}
                reactionCount={reactionData.count}
                onReact={() => handleReact(song)}
                isLoading={reactingItemId === String(song.id)}
              />
              <MusicDiscussButton
                commentCount={commentCount}
                onClick={() => handleComment(song)}
              />
              <MusicShareButton
                shareCount={shareCount}
                onClick={() => handleShare(song)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans">
      {/* Navigation Tabs */}
      <div className="sticky top-14 bg-[#0A0A0A]/95 backdrop-blur-md z-30 px-4 py-4 border-b border-[#222] flex gap-6 overflow-x-auto scrollbar-hide">
        <button onClick={() => setView('music')} className={`cursor-pointer font-bold text-sm whitespace-nowrap ${view === 'music' ? 'text-[#07E8F8]' : 'text-gray-400 hover:text-white'}`}>
          MUSIC
        </button>
        <button onClick={() => setView('podcasts')} className={`cursor-pointer font-bold text-sm whitespace-nowrap ${view === 'podcasts' ? 'text-[#07E8F8]' : 'text-gray-400 hover:text-white'}`}>
          PODCASTS
        </button>

        {currentUser && (
          <button onClick={() => setView('dashboard')} className={`cursor-pointer font-bold text-sm whitespace-nowrap ${view === 'dashboard' ? 'text-[#07E8F8]' : 'text-gray-400 hover:text-white'}`}>
            DASHBOARD
          </button>
        )}

        {selectedArtistId && (
          <button onClick={() => setView('artist')} className={`cursor-pointer font-bold text-sm whitespace-nowrap ${view === 'artist' ? 'text-[#07E8F8]' : 'text-gray-400 hover:text-white'}`}>
            ARTIST
          </button>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl mb-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <i className="fas fa-triangle-exclamation"></i>
                <span className="text-sm font-semibold">{error}</span>
              </div>
              <button onClick={() => { fetchSongs(); fetchPodcasts(); }} className="text-sm font-bold text-[#07E8F8] hover:underline">
                Retry
              </button>
            </div>
          </div>
        )}

        {showLoading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-[#07E8F8] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* MUSIC VIEW */}
        {view === 'music' && !showLoading && (
          <div className="space-y-8">
            {/* Hero Banner */}
            <div className="rounded-[28px] bg-gradient-to-b from-[#0B0B0F] to-[#121217] border border-white/5 p-4 sm:p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                    UNERA Music
                  </h1>
                  <p className="text-[#A8AFBC] mt-1 text-sm sm:text-base">
                    Discover trending sounds, creators and fresh vibes
                  </p>
                </div>
                {currentUser && (
                  <button onClick={() => setView('dashboard')} className="shrink-0 px-4 py-2 rounded-full bg-[#07E8F8] text-black font-bold text-sm hover:opacity-90">
                    Studio
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search songs, artists..."
                  className="w-full bg-[#1A1D24] text-white px-4 py-3 pl-11 rounded-2xl border border-[#2B313D] focus:border-[#07E8F8] focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#8D96A8]"></i>
              </div>

              {/* Hero Banner */}
              {heroSong && (
                <div className="mb-5 relative h-[220px] rounded-2xl overflow-hidden cursor-pointer border border-white/10" onClick={() => handlePlayTrackFromSong(heroSong)}>
                  <img src={heroSong.cover || DEFAULT_MUSIC_COVER} alt={heroSong.title} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent"></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                  <div className="relative z-10 h-full flex items-end justify-between p-4">
                    <div className="max-w-[70%]">
                      <p className="text-[#07E8F8] text-xs font-bold uppercase tracking-wider mb-2">Featured</p>
                      <h3 className="text-white text-2xl font-extrabold leading-tight line-clamp-2">{heroSong.title}</h3>
                      <p className="text-white/80 mt-1 text-sm">{users.find((u) => u.id === heroSong.uploaderId)?.name || heroSong.artist}</p>
                      <div className="mt-3 inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 text-xs text-white">
                        <i className="fas fa-headphones"></i>
                        <span>{formatCompactNumber((heroSong.stats as any)?.plays)} plays</span>
                      </div>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                      <i className="fas fa-play text-lg ml-1"></i>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                <button onClick={() => setSearchQuery('')} className="flex flex-col items-center min-w-[74px] group">
                  <div className="w-16 h-16 rounded-full bg-[#07E8F8] text-black flex items-center justify-center shadow-[0_0_18px_rgba(7,232,248,0.25)] group-hover:scale-105 transition-transform">
                    <i className="fas fa-chart-bar text-[26px]"></i>
                  </div>
                  <span className="text-white text-sm mt-2 font-medium">Charts</span>
                </button>
                <button onClick={() => setView('artist')} className="flex flex-col items-center min-w-[74px] group">
                  <div className="w-16 h-16 rounded-full bg-[#07E8F8] text-black flex items-center justify-center shadow-[0_0_18px_rgba(7,232,248,0.25)] group-hover:scale-105 transition-transform">
                    <i className="fas fa-user-music text-[26px]"></i>
                  </div>
                  <span className="text-white text-sm mt-2 font-medium">Artists</span>
                </button>
                <button className="flex flex-col items-center min-w-[74px] group">
                  <div className="w-16 h-16 rounded-full bg-[#07E8F8] text-black flex items-center justify-center shadow-[0_0_18px_rgba(7,232,248,0.25)] group-hover:scale-105 transition-transform">
                    <i className="fas fa-list-music text-[26px]"></i>
                  </div>
                  <span className="text-white text-sm mt-2 font-medium">Playlists</span>
                </button>
                <button onClick={() => setView('podcasts')} className="flex flex-col items-center min-w-[74px] group">
                  <div className="w-16 h-16 rounded-full bg-[#07E8F8] text-black flex items-center justify-center shadow-[0_0_18px_rgba(7,232,248,0.25)] group-hover:scale-105 transition-transform">
                    <i className="fas fa-podcast text-[26px]"></i>
                  </div>
                  <span className="text-white text-sm mt-2 font-medium">Podcasts</span>
                </button>
              </div>

              {/* Genre Chips */}
              <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
                {['Bongo Fleva', 'Amapiano', 'Afrobeats', 'Hip Hop', 'RnB', 'Gospel'].map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setSearchQuery(genre)}
                    className="px-4 py-1.5 rounded-full bg-[#1A1D24] text-[#B8BCC7] text-sm hover:bg-[#07E8F8] hover:text-black transition-colors whitespace-nowrap"
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            {/* Horizontal feed sections */}
            {!searchQuery ? (
              <>
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-[28px] leading-none font-extrabold text-white">Ngoma Za Moto</h2>
                      <p className="text-[#9CA3AF] text-sm mt-1">Most streamed right now</p>
                    </div>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                    {featuredSongs.map((song, idx) => renderMusicCard(song, idx))}
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-[28px] leading-none font-extrabold text-white">Handpicked User Gems</h2>
                      <p className="text-[#9CA3AF] text-sm mt-1">Loved by listeners</p>
                    </div>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                    {songs.slice(0, 10).map((song) => renderMusicCard(song))}
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-[28px] leading-none font-extrabold text-white">Best Picks</h2>
                      <p className="text-[#9CA3AF] text-sm mt-1">Strong plays and likes</p>
                    </div>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                    {songs.slice(0, 10).map((song) => renderMusicCard(song))}
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-[28px] leading-none font-extrabold text-white">Fresh Vibes Only</h2>
                      <p className="text-[#9CA3AF] text-sm mt-1">New uploads from creators</p>
                    </div>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                    {songs.slice(0, 10).map((song) => renderMusicCard(song))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl bg-[#111318] border border-white/5 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-[28px] leading-none font-extrabold text-white">Search Results ({filteredSongs.length})</h2>
                    <p className="text-[#9CA3AF] text-sm mt-1">Matched songs</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredSongs.length > 0 ? (
                    filteredSongs.map((song) => {
                      const uploaderProfile = users.find((u) => u.id === song.uploaderId);
                      const artistName = uploaderProfile?.name || uploaderProfile?.username || song.artist;
                      const artistAvatar = (uploaderProfile as any)?.profileImage || (uploaderProfile as any)?.profile_image_url || null;
                      const isLiked = isTrackLiked(String(song.id), 'music');
                      const reactionData = itemReactions[String(song.id)] || { count: (song.stats as any)?.likes || 0, userReaction: null };
                      const commentCount = itemComments[String(song.id)] || 0;
                      const shareCount = itemShares[String(song.id)] || (song.stats as any)?.shares || 0;

                      return (
                        <div key={song.id} className="w-full">
                          <div className="group cursor-pointer">
                            <div className="relative rounded-xl overflow-hidden aspect-[1/1] bg-[#1A1A1A]">
                              <img src={song.cover || DEFAULT_MUSIC_COVER} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReact(song);
                                }}
                                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center"
                              >
                                <i className={`${reactionData.userReaction ? 'fas' : 'far'} text-white fa-heart text-sm`}></i>
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
                                  song.uploaderId && handleArtistClick(song.uploaderId);
                                }}
                                className="mt-1 flex items-center gap-2 max-w-full text-left"
                              >
                                {artistAvatar ? (
                                  <img src={artistAvatar} alt={artistName} className="w-4 h-4 rounded-full object-cover" />
                                ) : null}
                                <span className="text-[#B8BCC7] text-sm truncate inline-flex items-center gap-1">
                                  {artistName}
                                  {uploaderProfile?.isVerified ? <i className="fas fa-check-circle text-[#07E8F8] text-[10px]"></i> : null}
                                </span>
                              </button>
                              
                              <div className="flex items-center justify-between mt-3 gap-1">
                                <MusicReactionButton
                                  hasReacted={!!reactionData.userReaction}
                                  reactionCount={reactionData.count}
                                  onReact={() => handleReact(song)}
                                  isLoading={reactingItemId === String(song.id)}
                                />
                                <MusicDiscussButton
                                  commentCount={commentCount}
                                  onClick={() => handleComment(song)}
                                />
                                <MusicShareButton
                                  shareCount={shareCount}
                                  onClick={() => handleShare(song)}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full text-center py-10">
                      <i className="fas fa-magnifying-glass text-4xl text-[#677083] mb-3"></i>
                      <p className="text-[#B8BCC7] text-lg">No songs found</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PODCAST VIEW - similar structure with action buttons */}
        {view === 'podcasts' && !showLoading && (
          <div className="space-y-8">
            <div className="bg-[#242526] rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Podcasts & Episodes ({filteredEpisodes.length})</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEpisodes.length > 0 ? (
                  filteredEpisodes.map((episode) => {
                    const isCurrentTrack = currentTrack && currentTrack.type === 'podcast' && String(currentTrack.id) === String(episode.id);
                    const isLiked = isTrackLiked(String(episode.id), 'podcast');
                    const uploaderProfile = users.find((u) => u.id === episode.uploaderId);
                    const profilePicture = uploaderProfile ? (uploaderProfile as any).profileImage || (uploaderProfile as any).profile_image_url : null;
                    const hostName = uploaderProfile?.name || uploaderProfile?.username || episode.host || 'Host';
                    const reactionData = itemReactions[String(episode.id)] || { count: (episode.stats as any)?.likes || 0, userReaction: null };
                    const commentCount = itemComments[String(episode.id)] || 0;
                    const shareCount = itemShares[String(episode.id)] || (episode.stats as any)?.shares || 0;

                    return (
                      <div
                        key={episode.id}
                        className={`bg-[#3A3B3C] rounded-xl overflow-hidden hover:bg-[#4E4F50] transition-colors cursor-pointer group ${
                          isCurrentTrack ? 'border-2 border-[#07E8F8]' : ''
                        }`}
                        onClick={() => handlePlayTrackFromEpisode(episode)}
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="relative w-16 h-16 flex-shrink-0">
                              <img 
                                src={episode.thumbnail || DEFAULT_PODCAST_COVER} 
                                alt={episode.title} 
                                className="w-full h-full object-cover rounded-lg" 
                              />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <i className="fas fa-play text-white"></i>
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-white line-clamp-2">{episode.title}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                {profilePicture ? (
                                  <img 
                                    src={profilePicture} 
                                    className="w-4 h-4 rounded-full object-cover border border-white/20"
                                    alt="Profile"
                                  />
                                ) : null}
                                <p 
                                  className="text-[#B0B3B8] text-sm flex items-center gap-1 cursor-pointer hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (episode.uploaderId) handleArtistClick(episode.uploaderId);
                                  }}
                                >
                                  {hostName}
                                  {uploaderProfile?.isVerified && <i className="fas fa-check-circle text-[#07E8F8] text-xs"></i>}
                                  <span className="text-xs text-gray-500 ml-1">(Host)</span>
                                </p>
                              </div>

                              <div className="flex items-center justify-between mt-3">
                                <span className="text-[#B0B3B8] text-xs">{(episode as any).duration || '45:00'}</span>

                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReact(episode);
                                    }}
                                    className="text-lg hover:scale-110 transition-transform flex items-center gap-1"
                                    title="Like"
                                  >
                                    <i className={`${reactionData.userReaction ? 'fas' : 'far'} text-white fa-heart`}></i>
                                    <span className="text-xs text-[#B0B3B8]">{reactionData.count}</span>
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleComment(episode);
                                    }}
                                    className="text-lg hover:scale-110 transition-transform flex items-center gap-1"
                                    title="Discuss"
                                  >
                                    <i className="far fa-comment text-white"></i>
                                    <span className="text-xs text-[#B0B3B8]">{commentCount}</span>
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleShare(episode);
                                    }}
                                    className="text-lg hover:scale-110 transition-transform flex items-center gap-1"
                                    title="Share"
                                  >
                                    <i className="fas fa-share-alt text-white"></i>
                                    <span className="text-xs text-[#B0B3B8]">{shareCount}</span>
                                  </button>

                                  {isAdmin && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteEpisode(String(episode.id));
                                      }}
                                      className="text-red-500 hover:text-red-400"
                                      title="Delete"
                                    >
                                      <i className="fas fa-trash"></i>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {(episode as any).description && <p className="text-[#B0B3B8] text-sm mt-3 line-clamp-2">{(episode as any).description}</p>}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-3 text-center py-12">
                    <i className="fas fa-podcast text-5xl text-[#B0B3B8] mb-4"></i>
                    <p className="text-[#B0B3B8] text-lg">No podcasts found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DASHBOARD VIEW (simplified - keep existing) */}
        {view === 'dashboard' && currentUser && !showLoading && (
          <div className="space-y-8">
            <div className="bg-[#242526] rounded-2xl p-6">
              <div className="flex flex-col items-center justify-center mb-10 mt-4 text-center">
                <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-white to-gray-400 text-transparent bg-clip-text">Creator Studio</h2>
                <p className="text-[#888] mb-6 max-w-2xl">Upload your music, podcasts, and albums. Monitor your performance.</p>

                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-gradient-to-r from-[#1877F2] to-[#0062E3] px-10 py-4 rounded-full font-bold flex items-center gap-3 hover:scale-105 transition-transform shadow-[0_4px_20px_rgba(24,119,242,0.5)] text-lg"
                >
                  <i className="fas fa-cloud-upload-alt text-2xl"></i> Upload New Content
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-[#333]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#B0B3B8] text-sm">Likes on Your Content</p>
                      <p className="text-2xl font-bold text-white">{dashboardStats.userLikesReceived.toLocaleString()}</p>
                    </div>
                    <i className="fas fa-heart text-[#FF4D8D] text-xl"></i>
                  </div>
                  <p className="text-[#888] text-xs mt-2">Likes your content received</p>
                </div>

                <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-[#333]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#B0B3B8] text-sm">Your Uploads</p>
                      <p className="text-2xl font-bold text-white">{dashboardStats.userUploads}</p>
                    </div>
                    <i className="fas fa-upload text-[#45BD62] text-xl"></i>
                  </div>
                  <p className="text-[#888] text-xs mt-2">{dashboardStats.userSongs} songs + {dashboardStats.userEpisodes} podcasts</p>
                </div>

                <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-[#333]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#B0B3B8] text-sm">My Total Plays</p>
                      <p className="text-2xl font-bold text-white">{myTotalPlays.toLocaleString()}</p>
                    </div>
                    <i className="fas fa-play-circle text-[#07E8F8] text-xl"></i>
                  </div>
                  <p className="text-[#888] text-xs mt-2">Plays you've made across UNERA</p>
                </div>
              </div>

              <div className="bg-[#1E1E1E] rounded-2xl border border-[#333] overflow-hidden">
                <div className="p-6 border-b border-[#333]">
                  <h3 className="text-xl font-bold text-white">Your Catalog</h3>
                  <p className="text-[#888] text-sm">Manage your uploaded content</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#252525] text-[#888] text-xs uppercase font-bold">
                      <tr>
                        <th className="p-4">Content</th>
                        <th className="p-4">Type</th>
                        <th className="p-4 text-right">Plays</th>
                        <th className="p-4 text-right">Likes</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#333]">
                      {[...songs.filter((s) => s.uploaderId === (currentUser as any).id), ...episodes.filter((e) => e.uploaderId === (currentUser as any).id)].map((item: any) => (
                        <tr key={item.id} className="hover:bg-[#2A2A2A]">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img src={item.cover || item.thumbnail || DEFAULT_MUSIC_COVER} className="w-10 h-10 rounded object-cover" alt="" />
                              <div>
                                <div className="font-bold text-white text-sm">{item.title}</div>
                                <div className="text-xs text-[#888]">{item.artist || item.host}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs ${item.host ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {item.host ? 'Podcast' : 'Music'}
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-sm">{(item.stats as any)?.plays || 0}</td>
                          <td className="p-4 text-right font-bold text-sm">{(item.stats as any)?.likes || 0}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => (item.host ? deleteEpisode(String(item.id)) : deleteSong(String(item.id)))}
                              className="text-red-500 hover:text-red-400 p-2"
                              title="Delete"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </td>
                        </tr>
                      ))}

                      {songs.filter((s) => s.uploaderId === (currentUser as any).id).length === 0 && episodes.filter((e) => e.uploaderId === (currentUser as any).id).length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-[#666]">
                            <div className="mb-3">
                              <i className="fas fa-music text-4xl opacity-50"></i>
                            </div>
                            <p className="text-lg">No uploads yet.</p>
                            <p className="text-sm">Start by clicking "Upload New Content" above.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-8 bg-[#1E1E1E] rounded-2xl border border-[#333] p-6">
                <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {playHistory.slice(0, 5).map((track, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 hover:bg-[#2A2A2A] rounded-lg">
                      <img src={track.cover || DEFAULT_MUSIC_COVER} className="w-10 h-10 rounded object-cover" alt="" />
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">{track.title}</div>
                        <div className="text-xs text-[#888]">{track.artist}</div>
                      </div>
                      <div className="text-xs text-[#888]">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                  {playHistory.length === 0 && (
                    <div className="text-center py-4 text-[#666]">
                      <i className="fas fa-history text-2xl mb-2"></i>
                      <p>No recent plays</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ARTIST VIEW */}
        {view === 'artist' && selectedArtistUser && !showLoading && (
          <div className="space-y-8">
            <div className="bg-[#242526] rounded-2xl overflow-hidden">
              <div className="h-48 relative">
                <img src={(selectedArtistUser as any).coverImage || (selectedArtistUser as any).profileImage} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] to-transparent"></div>

                <div className="absolute bottom-4 left-4 flex items-end gap-4">
                  <img src={(selectedArtistUser as any).profileImage} className="w-20 h-20 rounded-full border-4 border-[#0A0A0A] shadow-xl object-cover" alt="" />
                  <div className="mb-2">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                      {selectedArtistUser.name}
                      {(selectedArtistUser as any).isVerified && <i className="fas fa-check-circle text-[#07E8F8] text-sm"></i>}
                    </h1>
                    <p className="text-[#CCC] text-sm">{((selectedArtistUser as any).followers?.length || 0)} Followers</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-white mb-4">Popular Releases</h2>
                  <div className="space-y-2">
                    {songs
                      .filter((s) => s.uploaderId === selectedArtistUser.id)
                      .slice(0, 5)
                      .map((song) => {
                        const reactionData = itemReactions[String(song.id)] || { count: (song.stats as any)?.likes || 0, userReaction: null };
                        const commentCount = itemComments[String(song.id)] || 0;
                        const shareCount = itemShares[String(song.id)] || (song.stats as any)?.shares || 0;

                        return (
                          <div
                            key={song.id}
                            className="flex items-center gap-4 p-3 hover:bg-[#3A3B3C] rounded-xl cursor-pointer transition-colors group"
                            onClick={() => handlePlayTrackFromSong(song)}
                          >
                            <img src={song.cover || DEFAULT_MUSIC_COVER} className="w-12 h-12 rounded object-cover" alt="" />
                            <div className="flex-1">
                              <div className="font-bold text-white text-sm">{song.title}</div>
                              <div className="text-xs text-[#888]">{(song.stats as any)?.plays || 0} plays</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <MusicReactionButton
                                hasReacted={!!reactionData.userReaction}
                                reactionCount={reactionData.count}
                                onReact={() => handleReact(song)}
                                isLoading={reactingItemId === String(song.id)}
                              />
                              <MusicDiscussButton
                                commentCount={commentCount}
                                onClick={() => handleComment(song)}
                              />
                              <MusicShareButton
                                shareCount={shareCount}
                                onClick={() => handleShare(song)}
                              />
                            </div>
                          </div>
                        );
                      })}

                    {songs.filter((s) => s.uploaderId === selectedArtistUser.id).length === 0 && <p className="text-[#666] text-center py-4">No tracks available from this artist.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && currentUser && (
        <AudioUploadModal
          currentUser={currentUser}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => {
            fetchSongs();
            fetchPodcasts();
          }}
        />
      )}

      {/* Comments Sheet */}
      <MusicCommentsSheet
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        item={selectedItem}
        currentUser={currentUser}
        onCommentAdded={handleCommentAdded}
      />

      {/* Share Sheet */}
      <MusicShareSheet
        isOpen={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        item={shareItem}
        currentUser={currentUser}
        onShareComplete={handleShareComplete}
      />
    </div>
  );
};

export default MusicSystem;
