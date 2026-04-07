
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// -------------------- ADDED: Import ranking utility --------------------
import { rankStoriesForReel } from '../utils/ranking';
import { apiFetch, avatarFrom, formatRelativeTime, RichText } from './Feed';

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
  expires_at?: string | null;
  is_active?: boolean;
  user?: User;
  views?: StoryViewer[];
  analytics?: StoryAnalytics;
  liked_by_me?: boolean;
  
  views_count?: number;
  reactions_count?: number;
  my_reaction?: string | null;
  reaction_breakdown?: Record<string, number>;
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

const formatStoryTime = (created_at?: string): string => {
  const t = parseServerTime(created_at);
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

const getReactionName = (reaction?: string | null): string => {
  switch (reaction) {
    case 'like': return 'Like';
    case 'love': return 'Love';
    case 'wow': return 'Wow';
    case 'haha': return 'Haha';
    case 'sad': return 'Sad';
    case 'angry': return 'Angry';
    default: return 'Viewed';
  }
};

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

    const prevHasReaction = !!prev.reaction;
    const nextHasReaction = !!v.reaction;

    if (!prevHasReaction && nextHasReaction) {
      map.set(uid, v);
    } else {
      const a = parseServerTime(prev.viewed_at);
      const b = parseServerTime(v.viewed_at);
      if (b > a) map.set(uid, v);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    parseServerTime(b.viewed_at) - parseServerTime(a.viewed_at)
  );
};

// ==================== ICONS ====================
const SparkReactIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="storySparkGrad" x1="12" y1="52" x2="52" y2="12">
        <stop offset="0%" stopColor="#FF7A45" />
        <stop offset="55%" stopColor="#FF5A6A" />
        <stop offset="100%" stopColor="#FF8A3D" />
      </linearGradient>
      <filter id="storySparkGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <circle cx="32" cy="32" r="18" fill="url(#storySparkGrad)" opacity="0.14" />
    <g stroke="url(#storySparkGrad)" strokeWidth="5.2" strokeLinecap="round" filter="url(#storySparkGlow)">
      <line x1="32" y1="10" x2="32" y2="18" />
      <line x1="32" y1="46" x2="32" y2="54" />
      <line x1="10" y1="32" x2="18" y2="32" />
      <line x1="46" y1="32" x2="54" y2="32" />
      <line x1="17" y1="17" x2="22.8" y2="22.8" />
      <line x1="41.2" y1="41.2" x2="47" y2="47" />
      <line x1="47" y1="17" x2="41.2" y2="22.8" />
      <line x1="22.8" y1="41.2" x2="17" y2="47" />
    </g>
    <circle cx="32" cy="32" r="6.2" fill="url(#storySparkGrad)" />
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

const reactionEmoji = (t: string) => {
  switch (t) {
    case 'like': return '👍';
    case 'love': return '❤️';
    case 'haha': return '😂';
    case 'wow': return '😮';
    case 'sad': return '😢';
    case 'angry': return '😡';
    default: return '👍';
  }
};

const fmtCount = (n: number) => {
  const num = Number(n || 0);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(num % 1_000 === 0 ? 0 : 1) + 'K';
  return String(num);
};

// ==================== STORY COMMENTS SHEET ====================
interface StoryCommentsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  storyId: number;
  currentUser: User | null;
  users: User[];
  onProfileClick: (id: number) => void;
  onHashtagClick?: (tag: string) => void;
  onFollow?: (id: number) => void;
  checkIsFollowing?: (id: number) => boolean;
  followLoading?: { [key: number]: boolean };
}

export const StoryCommentsSheet: React.FC<StoryCommentsSheetProps> = ({
  isOpen,
  onClose,
  storyId,
  currentUser,
  users,
  onProfileClick,
  onHashtagClick,
  onFollow,
  checkIsFollowing,
  followLoading = {},
}) => {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    if (!storyId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/stories/${storyId}/comments?limit=100`);
      const commentsList = Array.isArray(data?.comments) ? data.comments : [];
      setComments(commentsList);
    } catch (error) {
      console.error('Failed to fetch story comments:', error);
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    if (isOpen && storyId) {
      fetchComments();
    }
  }, [isOpen, storyId, fetchComments]);

  const resolveAuthor = (comment: any) => {
    const uid = Number(comment?.user_id ?? comment?.userId ?? 0);
    const user = users.find(u => Number(u.id) === uid);
    const name = comment?.author_name || user?.name || user?.username || 'User';
    const image = comment?.author_image || user?.profile_image_url || avatarFrom(user || { name });
    return { uid, name, image };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !currentUser || !storyId) return;

    setSubmitting(true);
    const parentId = replyTo?.id || null;
    const finalText = text.trim();

    const optimisticComment = {
      id: `tmp-${Date.now()}`,
      story_id: storyId,
      user_id: currentUser.id,
      text: finalText,
      parent_comment_id: parentId,
      created_at: new Date().toISOString(),
      likes_count: 0,
      liked_by_me: false,
      replies_count: 0,
    };

    setComments(prev => [optimisticComment, ...prev]);
    setText('');
    setReplyTo(null);

    try {
      const data = await apiFetch(`/api/stories/${storyId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          text: finalText,
          user_id: currentUser.id,
          parent_comment_id: parentId,
        }),
      });
      
      const newComment = data?.comment || optimisticComment;
      setComments(prev => prev.map(c => c.id === optimisticComment.id ? newComment : c));
    } catch (error) {
      console.error('Failed to post comment:', error);
      setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#F3425F] text-white px-6 py-2 rounded-full font-bold shadow-lg animate-fade-in z-[300]';
      toast.innerText = 'Failed to post comment';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: number) => {
    if (!currentUser) return;

    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        const liked = !c.liked_by_me;
        return {
          ...c,
          liked_by_me: liked,
          likes_count: liked ? (c.likes_count || 0) + 1 : Math.max(0, (c.likes_count || 0) - 1),
        };
      }
      return c;
    }));

    try {
      await apiFetch(`/api/stories/comments/${commentId}/like`, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.id }),
      });
    } catch (error) {
      console.error('Failed to like comment:', error);
      fetchComments();
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!currentUser) return;

    setComments(prev => prev.filter(c => c.id !== commentId && c.parent_comment_id !== commentId));

    try {
      await apiFetch(`/api/stories/comments/${commentId}`, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: currentUser.id }),
      });
    } catch (error) {
      console.error('Failed to delete comment:', error);
      fetchComments();
    }
  };

  const buildThreads = (list: any[]) => {
    const roots = list.filter(c => !c.parent_comment_id);
    const repliesByParent = new Map<number, any[]>();
    
    list.forEach(c => {
      if (c.parent_comment_id) {
        if (!repliesByParent.has(c.parent_comment_id)) repliesByParent.set(c.parent_comment_id, []);
        repliesByParent.get(c.parent_comment_id)!.push(c);
      }
    });
    
    repliesByParent.forEach(arr => {
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    
    roots.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return roots.map(root => ({
      root,
      replies: repliesByParent.get(root.id) || [],
    }));
  };

  const threads = useMemo(() => buildThreads(comments), [comments]);

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  const toggleThread = (rootId: number, open: boolean) => {
    setExpandedThreads(prev => ({ ...prev, [String(rootId)]: open }));
  };

  const renderComment = (comment: any, isReply: boolean = false, depth: number = 0) => {
    const author = resolveAuthor(comment);
    const isAuthor = currentUser && Number(author.uid) === Number(currentUser.id);
    const isFollowing = author.uid && checkIsFollowing ? checkIsFollowing(author.uid) : false;
    const MAX_DEPTH = 3;
    const actualDepth = Math.min(depth, MAX_DEPTH);
    
    return (
      <div key={comment.id} className={`flex gap-3 ${isReply ? 'mt-3' : ''}`} style={{ marginLeft: isReply ? `${actualDepth * 24}px` : 0 }}>
        <img
          src={author.image}
          className="w-9 h-9 rounded-full object-cover cursor-pointer flex-shrink-0"
          alt=""
          onClick={() => author.uid && onProfileClick(author.uid)}
        />
        <div className="flex-1 min-w-0">
          <div className="bg-[#3A3B3C] rounded-2xl px-3 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[#E4E6EB] font-bold text-[14px] cursor-pointer hover:underline"
                onClick={() => author.uid && onProfileClick(author.uid)}
              >
                {author.name}
              </span>
              <span className="text-[#B0B3B8] text-[11px]">
                {formatRelativeTime(comment.created_at)}
              </span>
            </div>
            <div className="text-[#E4E6EB] text-[15px] mt-1 break-words">
              <RichText
                text={String(comment.text || '')}
                users={users}
                onProfileClick={onProfileClick}
                onHashtagClick={onHashtagClick}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-1 ml-2">
            <button
              onClick={() => handleLikeComment(comment.id)}
              className={`text-[12px] ${comment.liked_by_me ? 'text-[#1877F2] font-bold' : 'text-[#B0B3B8] hover:text-[#E4E6EB]'}`}
            >
              {comment.liked_by_me ? 'Liked' : 'Like'}
            </button>
            <button
              onClick={() => {
                setReplyTo(comment);
                inputRef.current?.focus();
              }}
              className="text-[12px] text-[#B0B3B8] hover:text-[#E4E6EB]"
            >
              Reply
            </button>
            {isAuthor && (
              <button
                onClick={() => handleDeleteComment(comment.id)}
                className="text-[12px] text-[#B0B3B8] hover:text-[#F3425F]"
              >
                Delete
              </button>
            )}
            {comment.likes_count > 0 && (
              <span className="text-[12px] text-[#B0B3B8]">
                {formatCount(comment.likes_count)} {comment.likes_count === 1 ? 'like' : 'likes'}
              </span>
            )}
          </div>
        </div>
      </div>
    );
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
          <div className="text-[#E4E6EB] font-bold text-[20px]">Story Comments</div>
        </div>
        <div className="text-[#B0B3B8] text-[14px]">
          {formatCount(comments.length)} comments
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-10 text-[#B0B3B8]">
            <i className="fas fa-spinner fa-spin text-2xl"></i>
            <p className="mt-2">Loading comments...</p>
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-[#B0B3B8] text-[17px] mb-2">No comments yet</div>
            <p className="text-[#B0B3B8] text-[14px]">Be the first to comment on this story!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {threads.map(({ root, replies }) => {
              const rootId = root.id;
              const isExpanded = !!expandedThreads[String(rootId)];
              const MAX_PREVIEW = 2;
              const hiddenCount = Math.max(0, replies.length - MAX_PREVIEW);
              const visibleReplies = isExpanded ? replies : replies.slice(-MAX_PREVIEW);
              
              return (
                <div key={rootId} className="space-y-2">
                  {renderComment(root, false, 0)}
                  
                  {!isExpanded && hiddenCount > 0 && (
                    <button
                      type="button"
                      className="ml-12 text-[#1877F2] font-bold text-[13px] hover:underline"
                      onClick={() => toggleThread(rootId, true)}
                    >
                      View {hiddenCount} more repl{hiddenCount === 1 ? 'y' : 'ies'}
                    </button>
                  )}
                  
                  {visibleReplies.map((reply, idx) => (
                    <div key={reply.id}>
                      {renderComment(reply, true, 1)}
                    </div>
                  ))}
                  
                  {isExpanded && replies.length > MAX_PREVIEW && (
                    <button
                      type="button"
                      className="ml-12 text-[#B0B3B8] text-[12px] hover:text-[#E4E6EB]"
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

      {replyTo && (
        <div className="mx-4 mb-2 p-2 bg-[#3A3B3C] rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#B0B3B8] text-[13px]">Replying to</span>
            <span className="text-[#1877F2] font-bold text-[13px]">
              {resolveAuthor(replyTo).name}
            </span>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-[#B0B3B8] hover:text-[#E4E6EB]">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <div className="p-4 border-t border-[#3E4042] bg-[#242526] sticky bottom-0">
        <form className="flex gap-3 items-center" onSubmit={handleSubmit}>
          <img
            src={avatarFrom(currentUser)}
            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
            alt=""
          />
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              className="w-full bg-[#3A3B3C] text-white rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1877F2] transition-all text-[15px]"
              placeholder={replyTo ? `Reply to ${resolveAuthor(replyTo).name}...` : "Write a comment..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="text-[#1877F2] font-bold text-[15px] disabled:text-[#B0B3B8] disabled:cursor-not-allowed px-3 py-2"
            disabled={!text.trim() || submitting}
          >
            {submitting ? <i className="fas fa-spinner fa-spin"></i> : 'Post'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ==================== STORY VIEWER COMPONENT ====================
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
  onShare?: (storyId: number) => void;
  onComment?: (storyId: number) => void;
  onFetchReactions?: (storyId: number) => Promise<{ reactions: any[]; counts: Record<string, number> }>;
  
  onFollow?: (userId: number) => void;
  isFollowing?: boolean;
  
  allStories?: StoryType[];
  
  onFetchViewers?: (storyId: number) => Promise<StoryViewer[]>;
  viewersCount?: number;
  
  onProfileClick?: (id: number) => void;
  
  muted?: boolean;
  onToggleMute?: () => void;
  
  onDeleteStory?: (storyId: number) => Promise<void> | void;
  deleteLoading?: boolean;
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
  onShare,
  onComment,
  onFetchReactions,
  onFollow,
  isFollowing,
  allStories = [],
  onFetchViewers,
  viewersCount,
  onProfileClick,
  muted = true,
  onToggleMute,
  onDeleteStory,
  deleteLoading = false,
}) => {
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [storyDurationMs, setStoryDurationMs] = useState<number>(5000);
  
  const [mediaReady, setMediaReady] = useState(false);
  
  const [showViewers, setShowViewers] = useState(false);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [viewersError, setViewersError] = useState('');
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingStory, setDeletingStory] = useState(false);
  
  const [showReactions, setShowReactions] = useState(false);
  const [userReaction, setUserReaction] = useState<string | null>(
    story.my_reaction ?? story.views?.find(v => v.user_id === currentUser?.id)?.reaction ?? null
  );
  
  const [reactionCount, setReactionCount] = useState<number>(story.reactions_count || 0);
  const [commentCount, setCommentCount] = useState<number>(0);
  const [shareCount, setShareCount] = useState<number>(0);
  const [reactionList, setReactionList] = useState<any[]>([]);
  const [loadingReactions, setLoadingReactions] = useState(false);

  const lastMediaUrlRef = useRef<string | null>(null);
  const cachedViewsCountRef = useRef<number>(0);
  
  const isNavigatingRef = useRef(false);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const navLockRef = useRef(0);
  const pointerDownRef = useRef<{ x: number; y: number; t: number } | null>(null);
  
  const lastNavAtRef = useRef(0);
  
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pausedByHoldRef = useRef(false);
  const pauseWasAlreadyOnRef = useRef(false);
  
  const viewersResumeRef = useRef<'resume' | 'keepPaused'>('resume');

  const progressIntervalRef = useRef<number | null>(null);

  const preloadReadyRef = useRef<Map<string, boolean>>(new Map());

  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isAuthor = currentUser && currentUser.id === user.id;

  const frozenUserStoriesRef = useRef<StoryType[]>([]);
  const didAdvanceRef = useRef(false);
  const frozenAuthorRef = useRef<{ name: string; image: string; id: number }>({
    name: 'User',
    image: '',
    id: Number(story.user_id) || 0,
  });

  const fetchReactions = useCallback(async () => {
    if (!onFetchReactions) return;
    
    setLoadingReactions(true);
    try {
      const data = await onFetchReactions(story.id);
      setReactionList(data.reactions || []);
      setReactionCount(data.counts?.total || Object.values(data.counts || {}).reduce((a: number, b: number) => a + b, 0) || story.reactions_count || 0);
    } catch (error) {
      console.error('Failed to fetch reactions:', error);
    } finally {
      setLoadingReactions(false);
    }
  }, [story.id, onFetchReactions, story.reactions_count]);

  useEffect(() => {
    fetchReactions();
  }, [story.id, fetchReactions]);

  const topReactionEmojis = useMemo(() => {
    if (!reactionList.length) return [];
    
    const counts = new Map<string, number>();
    for (const r of reactionList) {
      const type = String(r?.type || '').trim();
      if (!type) continue;
      counts.set(type, (counts.get(type) || 0) + 1);
    }
    
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([type]) => reactionEmoji(type));
  }, [reactionList]);

  const getReactorName = useMemo(() => {
    if (!reactionList.length) return '';
    const firstReaction = reactionList[0];
    const name = firstReaction?.user?.name || firstReaction?.name || '';
    return name;
  }, [reactionList]);

  const reactionText = useMemo(() => {
    if (reactionCount === 0) return '';
    if (reactionCount === 1) {
      return `${fmtCount(reactionCount)} · ${getReactorName}`;
    }
    const othersCount = reactionCount - 1;
    return `${fmtCount(reactionCount)} · ${getReactorName} and ${fmtCount(othersCount)} other${othersCount !== 1 ? 's' : ''}`;
  }, [reactionCount, getReactorName]);

  const lockNav = () => {
    const now = Date.now();
    if (now - navLockRef.current < 450) return false;
    navLockRef.current = now;
    return true;
  };

  const isInteractiveTarget = (el: EventTarget | null) => {
    const node = el as HTMLElement | null;
    if (!node) return false;
    return !!node.closest('button,a,input,textarea,select,[role="button"],[data-no-nav="true"]');
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isInteractiveTarget(e.target)) return;

    pointerDownRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    pauseWasAlreadyOnRef.current = isPaused;

    holdTimerRef.current = setTimeout(() => {
      pausedByHoldRef.current = true;
      setIsPaused(true);
    }, 220);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const start = pointerDownRef.current;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    const DRAG_CANCEL = 12;
    if (Math.abs(dx) > DRAG_CANCEL || Math.abs(dy) > DRAG_CANCEL) {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = pointerDownRef.current;
    pointerDownRef.current = null;

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (pausedByHoldRef.current) {
      pausedByHoldRef.current = false;
      if (!pauseWasAlreadyOnRef.current) setIsPaused(false);
    }

    if (!start) return;
    if (isInteractiveTarget(e.target)) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dt = Date.now() - start.t;

    const SWIPE_X = 40;
    const SWIPE_Y = 30;
    if (Math.abs(dx) > SWIPE_X && Math.abs(dy) < SWIPE_Y) {
      if (dx < 0) safeNavigate('next');
      else safeNavigate('prev');
      return;
    }

    const TAP_MOVE = 12;
    const TAP_TIME = 350;
    if (Math.abs(dx) <= TAP_MOVE && Math.abs(dy) <= TAP_MOVE && dt <= TAP_TIME) {
      const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - box.left;
      const ratio = x / box.width;

      if (ratio < 0.35) safeNavigate('prev');
      else if (ratio > 0.65) safeNavigate('next');
      else setIsPaused(p => !p);
    }
  };

  const handlePointerCancel = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (pausedByHoldRef.current) {
      pausedByHoldRef.current = false;
      if (!pauseWasAlreadyOnRef.current) setIsPaused(false);
    }
    pointerDownRef.current = null;
  };

  const closeViewers = () => {
    setShowViewers(false);
    if (viewersResumeRef.current === 'resume') setIsPaused(false);
  };

  const openViewers = async () => {
    if (!onFetchViewers) return;

    const wasPaused = isPaused;
    setIsPaused(true);

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
      viewersResumeRef.current = wasPaused ? 'keepPaused' : 'resume';
    }
  };

  useEffect(() => {
    const totalViews = story.views_count || viewersCount || story.analytics?.total_views || 0;
    if (totalViews > 0) {
      cachedViewsCountRef.current = totalViews;
    }
  }, [story.id, story.views_count, viewersCount, story.analytics?.total_views]);

  useEffect(() => {
    if (story.media_url && !isBlob(story.media_url)) {
      lastMediaUrlRef.current = story.media_url;
    }
  }, [story.id, story.media_url]);

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const safeNavigate = (direction: 'next' | 'prev') => {
    const now = Date.now();

    if (now - lastNavAtRef.current < 650) return;
    lastNavAtRef.current = now;

    if (isNavigatingRef.current) return;
    if (!lockNav()) return;
    
    didAdvanceRef.current = true;
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    isNavigatingRef.current = true;

    if (direction === 'next' && onNext) onNext();
    else if (direction === 'prev' && onPrev) onPrev();

    navigationTimeoutRef.current = setTimeout(() => {
      isNavigatingRef.current = false;
    }, 300);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target === inputRef.current) return;
      
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          safeNavigate('next');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          safeNavigate('prev');
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          onToggleMute?.();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          setIsPaused(p => !p);
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          if (!isAuthor) setShowReactions(p => !p);
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (isAuthor && onDeleteStory) {
            setShowDeleteConfirm(true);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrev, onClose, onToggleMute, isAuthor, onDeleteStory]);

  useEffect(() => {
    const r = story.my_reaction ?? story.views?.find(v => Number(v.user_id) === Number(currentUser?.id))?.reaction ?? null;
    setUserReaction(r);
  }, [story.id, currentUser?.id, story.views, story.my_reaction]);

  useEffect(() => {
    if (story.type === 'text') {
      setMediaReady(true);
      return;
    }

    const url = story.media_url || '';
    if (!url || isBlob(url)) {
      setMediaReady(true);
      return;
    }

    if (preloadReadyRef.current.get(url)) {
      setMediaReady(true);
      return;
    }

    if (!isVideoUrl(url)) {
      const img = new Image();
      img.src = url;

      const done = () => {
        preloadReadyRef.current.set(url, true);
        setMediaReady(true);
      };

      if (img.complete) {
        done();
        return;
      }

      img.onload = done;
      img.onerror = done;
      return;
    }
  }, [story.id, story.type, story.media_url]);

  useEffect(() => {
    if (story.type === 'video' || isVideoUrl(story.media_url)) {
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        setMediaReady(true);
      }
    }
  }, [story.type, story.media_url]);

  useEffect(() => {
    const userStories = frozenUserStoriesRef.current;
    const currentIndex = userStories.findIndex((s) => Number(s.id) === Number(story.id));

    const preload = async (url: string) => {
      if (!url || isBlob(url)) return;
      if (preloadReadyRef.current.get(url)) return;

      if (isVideoUrl(url)) {
        const v = document.createElement('video');
        v.preload = 'auto';
        v.src = url;

        const mark = () => preloadReadyRef.current.set(url, true);
        v.addEventListener('loadedmetadata', mark, { once: true });
        v.addEventListener('canplay', mark, { once: true });
        v.load();
      } else {
        const img = new Image();
        img.src = url;
        try {
          if (img.decode) await img.decode();
        } catch {}
        preloadReadyRef.current.set(url, true);
      }
    };

    if (currentIndex >= 0) {
      const next1 = userStories[currentIndex + 1]?.media_url;
      const next2 = userStories[currentIndex + 2]?.media_url;
      if (next1) preload(next1);
      if (next2) preload(next2);
    }
  }, [story.id]);

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
  }, [story.id, user]);

  const sameIdList = (a: StoryType[], b: StoryType[]) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (Number(a[i]?.id) !== Number(b[i]?.id)) return false;
    }
    return true;
  };

  useEffect(() => {
    const nextList = (allStories || [])
      .filter((s) => Number(s.user_id) === Number(story.user_id))
      .slice()
      .sort((a, b) => parseServerTime(b.created_at) - parseServerTime(a.created_at));

    const prevList = frozenUserStoriesRef.current;

    if (!sameIdList(prevList, nextList)) {
      frozenUserStoriesRef.current = nextList.length ? nextList : [story];
    }

    didAdvanceRef.current = false;
    setProgress(0);
    
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setMediaReady(story.type === 'text');
  }, [story.id, story.user_id, allStories]);

  const userStories = frozenUserStoriesRef.current;
  const currentIndex = userStories.findIndex((s) => Number(s.id) === Number(story.id));

  const storyIsText = story.type === 'text';
  const storyIsVideo = story.type === 'video' || (!storyIsText && isVideoUrl(story.media_url));
  const storyIsImage = !storyIsText && !storyIsVideo;

  const totalViews = story.views_count || viewersCount || story.analytics?.total_views || cachedViewsCountRef.current;

  useEffect(() => {
    if (storyIsVideo) {
      setStoryDurationMs(7000);
    } else {
      setStoryDurationMs(5000);
    }
  }, [story.id, storyIsVideo]);

  useEffect(() => {
    if (!mediaReady) return;

    setProgress(0);
    didAdvanceRef.current = false;

    const tickMs = 50;
    const duration = clamp(storyDurationMs || 5000, 1000, 30_000);

    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    const timer = window.setInterval(() => {
      if (isPaused) return;

      setProgress((prev) => {
        if (prev >= 100) return 100;

        const increment = 100 / (duration / tickMs);
        const next = Math.min(100, prev + increment);

        if (next >= 100 && !didAdvanceRef.current) {
          didAdvanceRef.current = true;

          if (progressIntervalRef.current) {
            window.clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }

          safeNavigate('next');
        }
        return next;
      });
    }, tickMs);

    progressIntervalRef.current = timer;

    return () => {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [story.id, isPaused, storyDurationMs, mediaReady]);

  useEffect(() => {
    if (story.music_url && !isBlob(story.music_url)) {
      audioRef.current = new Audio(story.music_url);
      audioRef.current.volume = muted ? 0 : 0.5;
      audioRef.current.play().catch(() => {});
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [story.id, story.music_url, muted]);

  useEffect(() => {
    if (!storyIsVideo) return;
    const v = videoRef.current;
    if (!v) return;

    if (isPaused) {
      v.pause();
    } else {
      const forceMuteVideo = !!(story.music_url && !isBlob(story.music_url));
      v.muted = forceMuteVideo ? true : muted;
      v.play().catch(() => {});
    }
  }, [isPaused, storyIsVideo, muted, story.music_url]);

  const handleShare = () => {
    if (onShare) {
      onShare(story.id);
      setShareCount(prev => prev + 1);
      setIsPaused(false);
      
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1877F2] text-white px-6 py-2 rounded-full font-bold shadow-lg animate-fade-in z-[300]';
      toast.innerText = 'Story shared!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }
  };

  const handleComment = () => {
    if (onComment) {
      onComment(story.id);
      setIsPaused(false);
    }
  };

  const handleReactionClick = () => {
    if (!isAuthor) {
      setShowReactions(!showReactions);
    }
  };

  const handleReaction = async (reaction: string) => {
    if (!onReaction || isAuthor) return;

    const wasPaused = isPaused;
    setIsPaused(true);

    const previousReaction = userReaction;
    const previousCount = reactionCount;
    
    if (previousReaction === reaction) {
      setUserReaction(null);
      setReactionCount(prev => Math.max(0, prev - 1));
    } else {
      setUserReaction(reaction);
      if (!previousReaction) {
        setReactionCount(prev => prev + 1);
      }
    }
    
    setShowReactions(false);

    try {
      const maybePromise = onReaction(story.id, reaction);
      if (maybePromise && typeof (maybePromise as any).then === 'function') {
        await (maybePromise as any);
      } else {
        await new Promise(r => setTimeout(r, 250));
      }
      await fetchReactions();
    } catch (error) {
      setUserReaction(previousReaction);
      setReactionCount(previousCount);
      console.error('Failed to react:', error);
    } finally {
      if (!wasPaused) setIsPaused(false);
    }
  };

  const handleDeleteStory = async () => {
    if (!onDeleteStory || !isAuthor) return;
    
    setDeletingStory(true);
    try {
      await onDeleteStory(story.id);
      setShowDeleteConfirm(false);
      setTimeout(() => onClose(), 300);
    } catch (error) {
      console.error('Failed to delete story:', error);
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#F3425F] text-white px-6 py-2 rounded-full font-bold shadow-lg animate-fade-in z-[300]';
      toast.innerText = 'Failed to delete story';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    } finally {
      setDeletingStory(false);
    }
  };

  const frozenAuthor = frozenAuthorRef.current;
  const uniqueViewers = story.analytics?.unique_viewers || viewers.length || 0;

  const activeReaction = userReaction ? {
    emoji: reactionEmoji(userReaction),
    color: userReaction === 'like' ? '#1877F2' : userReaction === 'love' ? '#F3425F' : '#F7B928'
  } : null;

  return (
    <div className="fixed inset-0 z-[250] bg-black flex items-center justify-center animate-fade-in">
      <div
        className="absolute inset-0 opacity-30 bg-cover bg-center blur-3xl"
        style={{
          backgroundImage: story.media_url ? `url(${story.media_url})` : undefined,
          background: !story.media_url ? (story as any).background_style : undefined,
        }}
      />

      <button
        className="absolute top-4 right-4 z-[300] cursor-pointer w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close story viewer"
      >
        <i className="fas fa-times text-[#E4E6EB] text-2xl"></i>
      </button>

      <div
        className="relative w-full max-w-[420px] h-full sm:h-[92vh] bg-black sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <button
          type="button"
          aria-label="Previous story"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-[120] w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 active:bg-white/20 backdrop-blur-md flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            safeNavigate('prev');
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <i className="fas fa-chevron-left text-white/90"></i>
        </button>

        <button
          type="button"
          aria-label="Next story"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-[120] w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 active:bg-white/20 backdrop-blur-md flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            safeNavigate('next');
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <i className="fas fa-chevron-right text-white/90"></i>
        </button>

        <div className="absolute top-0 left-0 right-0 p-3 z-30 flex gap-1.5">
          {userStories.map((_, i) => (
            <div key={i} className="h-1 bg-white/20 flex-1 rounded-full overflow-hidden">
              <div
                className={`h-full bg-white transition-all duration-75 ease-linear ${
                  !mediaReady && i === currentIndex ? 'animate-pulse' : ''
                }`}
                style={{
                  width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        <div 
          className="absolute top-4 left-0 right-0 p-4 z-30 flex items-center justify-between mt-2" 
          data-no-nav="true"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onProfileClick?.(frozenAuthor.id);
              }}
              className="flex items-center gap-3 hover:opacity-90 transition-opacity"
            >
              <img
                src={frozenAuthor.image}
                alt={frozenAuthor.name}
                className="w-12 h-12 rounded-full border-2 border-[#1877F2] object-cover shadow-lg"
              />
              <div className="flex flex-col items-start">
                <span className="text-white font-bold text-[17px] drop-shadow-md">
                  {frozenAuthor.name}
                </span>
                <span className="text-white/70 text-[12px] drop-shadow-md">
                  {formatStoryTime((story as any).created_at)}
                </span>
              </div>
            </button>
            
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

          {isAuthor ? (
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openViewers();
                }}
                className="flex items-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] transition-all px-4 py-2 rounded-full shadow-lg"
                aria-label="View viewers"
              >
                <i className="fas fa-eye text-white/90"></i>
                <span className="text-white font-black text-xs">
                  {uniqueViewers > 0 ? uniqueViewers : cachedViewsCountRef.current || 0}
                </span>
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="flex items-center gap-2 bg-[#F3425F] hover:bg-[#E41E3F] transition-all px-3 py-2 rounded-full shadow-lg"
                aria-label="Delete story"
                disabled={deleteLoading || deletingStory}
              >
                <i className={`fas ${deletingStory ? 'fa-spinner fa-spin' : 'fa-trash'} text-white/90`}></i>
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              {onToggleMute && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMute();
                  }}
                  className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/15 rounded-full"
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  <i className={`fas ${muted ? 'fa-volume-mute' : 'fa-volume-up'} text-white/80`}></i>
                </button>
              )}
              {onFetchViewers && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openViewers();
                  }}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/15 transition-all px-3 py-2 rounded-full border border-white/10"
                  aria-label="View viewers"
                >
                  <i className="fas fa-eye text-white/80"></i>
                  <span className="text-white font-bold text-xs">
                    {Number.isFinite(Number(viewersCount)) ? viewersCount : ''}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 bg-[#111] relative">
          <div
            className="absolute inset-0 z-[5]"
            onDoubleClick={isAuthor ? undefined : () => handleReaction('like')}
          />

          <div className="absolute inset-0 z-[10] flex items-center justify-center">
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
                  className="w-full h-full object-cover z-10"
                  playsInline
                  autoPlay
                  preload="auto"
                  muted={!!(story.music_url && !isBlob(story.music_url)) ? true : muted}
                  controls={false}
                  onCanPlay={() => setMediaReady(true)}
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    const ms = Number.isFinite(v.duration) ? v.duration * 1000 : 7000;
                    setStoryDurationMs(clamp(ms, 5000, 15000));
                    setMediaReady(true);
                    const forceMuteVideo = !!(story.music_url && !isBlob(story.music_url));
                    v.muted = forceMuteVideo ? true : muted;
                    v.play().catch(() => {});
                  }}
                  onEnded={() => {
                    safeNavigate('next');
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPaused((p) => !p);
                  }}
                  onError={(e) => {
                    console.error('Video playback failed:', e);
                    setMediaReady(true);
                  }}
                />
              ) : (
                <div className="absolute inset-0 z-10">
                  <div
                    className="absolute inset-0 blur-3xl scale-110 opacity-40"
                    style={{
                      backgroundImage: `url(${story.media_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                  <img
                    src={story.media_url}
                    alt="Story"
                    className="relative w-full h-full object-contain"
                    loading="eager"
                    decoding="async"
                    onLoad={() => setMediaReady(true)}
                    onError={() => setMediaReady(true)}
                  />
                </div>
              )
            ) : (
              <div 
                className="w-full h-full flex items-center justify-center p-10 text-center bg-gradient-to-br from-purple-600 to-blue-500 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaused(p => !p);
                }}
              >
                <span className="text-white font-bold text-3xl whitespace-pre-wrap">
                  {(story as any).text_content || 'Story'}
                </span>
              </div>
            )}
          </div>

          {showHeartAnim && (
            <div className="absolute inset-0 flex items-center justify-center z-[40] pointer-events-none">
              <i className="fas fa-heart text-white text-9xl drop-shadow-lg animate-pop-heart"></i>
            </div>
          )}

          {storyIsVideo && isPaused && (
            <div className="absolute inset-0 flex items-center justify-center z-[30] pointer-events-none">
              <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
                <i className="fas fa-pause text-white text-3xl"></i>
              </div>
            </div>
          )}

          {showReactions && !isAuthor && (
            <div
              className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-lg rounded-full p-2 flex gap-2 z-[200] border border-white/10 pointer-events-auto"
              data-no-nav="true"
            >
              {['like', 'love', 'wow', 'haha', 'sad', 'angry'].map((reaction) => (
                <button
                  key={reaction}
                  onClick={() => handleReaction(reaction)}
                  className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-2xl transition-transform hover:scale-125 active:scale-110"
                  aria-label={`React with ${reaction}`}
                  data-no-nav="true"
                >
                  {reactionEmoji(reaction)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Horizontal Bottom Actions - React, Discuss, Share */}
        <div 
          className="absolute bottom-0 left-0 right-0 p-3 z-20 bg-gradient-to-t from-black/80 to-transparent pt-10"
          data-no-nav="true"
        >
          {/* Reaction row with counts */}
          {reactionCount > 0 && (
            <div 
              className="flex items-center justify-between px-2 mb-2 cursor-pointer"
              onClick={() => {
                // Open reactions sheet
                console.log('Open reactions sheet');
              }}
            >
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {topReactionEmojis.slice(0, 2).map((emoji, i) => (
                    <span
                      key={i}
                      className="w-[22px] h-[22px] rounded-full bg-[#3A3B3C] border border-black flex items-center justify-center text-[14px]"
                      style={{ zIndex: 10 - i }}
                    >
                      {emoji}
                    </span>
                  ))}
                </div>
                {reactionText && (
                  <span className="text-[15px] text-white font-bold">
                    {reactionText}
                  </span>
                )}
              </div>
              <div className="flex gap-3 text-white/60 text-[13px]">
                <span className="hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); handleComment(); }}>
                  {fmtCount(commentCount)} Discussions
                </span>
                {shareCount > 0 && (
                  <span className="hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); handleShare(); }}>
                    {fmtCount(shareCount)} Shares
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Three horizontal buttons */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleReactionClick}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-white/10 transition-all duration-200 active:scale-95"
            >
              {activeReaction ? (
                <>
                  <span className="text-[22px] transition-transform duration-300">
                    {activeReaction.emoji}
                  </span>
                  <span
                    className="text-[17px] font-bold transition-colors duration-300"
                    style={{ color: activeReaction.color }}
                  >
                    React
                  </span>
                </>
              ) : (
                <>
                  <SparkReactIcon size={26} />
                  <span className="text-[17px] font-bold text-white/80">React</span>
                </>
              )}
            </button>

            <button
              onClick={handleComment}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-white/10 transition-all duration-200 active:scale-95"
            >
              <DiscussSignalIcon size={26} color="#1877F2" />
              <span className="text-[17px] font-bold text-white/80">Discuss</span>
            </button>

            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-white/10 transition-all duration-200 active:scale-95"
            >
              <i className="fas fa-share text-[20px] text-white/80"></i>
              <span className="text-[17px] font-bold text-white/80">Share</span>
            </button>
          </div>
        </div>

        {/* Viewers Modal */}
        {showViewers && (
          <div className="absolute inset-0 z-[500] bg-black/70 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={closeViewers} />

            <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-8">
              <div className="w-full max-w-[560px] bg-[#18191A] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-eye text-[#1877F2]"></i>
                    <h3 className="text-white font-black text-[16px]">Story Viewers</h3>
                    <span className="text-white/60 text-xs font-bold">({viewers.length})</span>
                  </div>

                  <button
                    onClick={closeViewers}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center"
                    aria-label="Close viewers modal"
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
                      
                      const reaction =
                        (v as any)?.reaction ??
                        (v as any)?.reaction_type ??
                        (v as any)?.my_reaction ??
                        v.reaction ??
                        null;

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

                          <div className="flex flex-col items-end gap-1">
                            <div className={`text-2xl ${getReactionColor(reaction)}`}>
                              {getReactionEmoji(reaction)}
                            </div>
                            {reaction && (
                              <span className="text-white/60 text-[10px] font-bold">
                                {getReactionName(reaction)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="p-4 border-t border-white/10 flex justify-end">
                  <button
                    onClick={closeViewers}
                    className="px-6 py-2 rounded-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-black"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-[500] bg-black/70 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setShowDeleteConfirm(false)} />

            <div className="relative w-full h-full flex items-center justify-center p-4">
              <div className="w-full max-w-[400px] bg-[#18191A] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-trash text-[#F3425F]"></i>
                    <h3 className="text-white font-black text-[16px]">Delete Story</h3>
                  </div>

                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center"
                    aria-label="Cancel delete"
                    disabled={deletingStory}
                  >
                    <i className="fas fa-times text-white/80"></i>
                  </button>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-16 h-16 bg-[#F3425F]/20 rounded-full flex items-center justify-center">
                      <i className="fas fa-trash text-[#F3425F] text-2xl"></i>
                    </div>
                  </div>
                  
                  <p className="text-white font-bold text-center text-lg mb-2">
                    Delete this story?
                  </p>
                  
                  <p className="text-white/60 text-center text-sm mb-6">
                    This story will be permanently deleted. This action cannot be undone.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold transition-all"
                      disabled={deletingStory}
                    >
                      Cancel
                    </button>
                    
                    <button
                      onClick={handleDeleteStory}
                      className="flex-1 py-3 rounded-xl bg-[#F3425F] hover:bg-[#E41E3F] text-white font-bold transition-all flex items-center justify-center gap-2"
                      disabled={deletingStory}
                    >
                      {deletingStory ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          Deleting...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-trash"></i>
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== STORY REEL COMPONENT ====================
interface StoryReelProps {
  stories: StoryType[];
  onProfileClick: (id: number) => void;
  onCreateStory?: () => void;
  onViewStory: (story: StoryType) => void;
  currentUser: User | null;
  onRequestLogin: () => void;
  
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
  const toTime = (d: any) => parseServerTime(d);

  const sortedStories = useMemo(() => 
    [...stories].sort((a, b) => toTime(b.created_at) - toTime(a.created_at)), 
    [stories]
  );

  const uniqueUserStories: StoryType[] = useMemo(() => {
    const ranked = rankStoriesForReel(stories, currentUser) || [];
    return ranked.slice().sort((a, b) => toTime(b.created_at) - toTime(a.created_at));
  }, [stories, currentUser?.id, (currentUser as any)?.following]);

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
      <div
        className="min-w-[110px] sm:min-w-[140px] h-[210px] sm:h-[250px] bg-[#242526] rounded-2xl shadow-md overflow-hidden cursor-pointer relative group flex-shrink-0 border border-[#3E4042]"
        onClick={() => (currentUser ? onCreateStory?.() : onRequestLogin())}
        aria-label="Create new story"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            currentUser ? onCreateStory?.() : onRequestLogin();
          }
        }}
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
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onViewStory(story);
              }
            }}
            aria-label={`View ${author.name}'s story`}
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

            <button
              className="absolute top-3 left-3 w-9 h-9 rounded-full border-4 border-[#1877F2] overflow-hidden z-10 shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                onProfileClick(story.user_id);
              }}
              aria-label={`Go to ${author.name}'s profile`}
            >
              <img src={author.profile_image_url} alt="" className="w-full h-full object-cover" />
            </button>

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
                  aria-label={isFollowing ? `Unfollow ${author.name}` : `Follow ${author.name}`}
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

// ==================== CREATE STORY MODAL ====================
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

    setPicks(prev => {
      const merged = [...prev, ...newItems].slice(0, 30);
      if (prev.length === 0) setActivePick(0);
      return merged;
    });
    setMode('media');
  };

  const removePick = (index: number) => {
    setPicks(prev => {
      const next = prev.slice();
      const removed = next.splice(index, 1);
      cleanupPickUrls(removed);
      
      const newLength = next.length;
      setActivePick(current => {
        if (newLength === 0) return 0;
        if (current >= newLength) return newLength - 1;
        if (current > index) return current - 1;
        return current;
      });
      
      return next;
    });
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
      if (selectedMusic?.url && selectedMusic.url.startsWith('blob:')) {
        URL.revokeObjectURL(selectedMusic.url);
      }
    };
  }, [picks, selectedMusic?.url, audioFile, cleanupPickUrls]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && canShare) handleCreate();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, canShare, handleCreate]);

  const active = picks[activePick];

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col font-sans animate-fade-in text-white overflow-hidden">
      <div className="flex justify-between items-center p-4 bg-black/60 backdrop-blur-lg absolute top-0 w-full z-40 border-b border-white/5">
        <button
          onClick={onClose}
          className="text-white font-bold text-sm bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition-all"
          aria-label="Discard and close"
        >
          Discard
        </button>
        <h3 className="font-black text-[18px]">Create Story</h3>
        <button
          onClick={handleCreate}
          disabled={!canShare}
          className="bg-[#1877F2] text-white px-6 py-2 rounded-full font-black text-sm disabled:opacity-50 disabled:bg-gray-600 transition-all"
          aria-label="Share story"
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
            aria-label="Story text"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center bg-[#000]"
            onClick={() => picks.length === 0 && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && picks.length === 0) {
                fileInputRef.current?.click();
              }
            }}
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
                  aria-label="Remove media"
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
              aria-label="Select media files"
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
            <button
              onClick={() => {
                if (selectedMusic.url.startsWith('blob:')) URL.revokeObjectURL(selectedMusic.url);
                setSelectedMusic(null);
                setAudioFile(null);
              }}
              className="text-white/50 hover:text-white"
              aria-label="Remove music"
            >
              <i className="fas fa-times-circle"></i>
            </button>
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
                  aria-label={`Select story ${i + 1}`}
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
                aria-label="Add more media"
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
              <button
                key={idx}
                onClick={() => setBackground(col)}
                className={`w-10 h-10 rounded-full flex-shrink-0 cursor-pointer border-2 transition-transform hover:scale-110 ${
                  background === col
                    ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                    : 'border-transparent'
                }`}
                style={{ background: col }}
                aria-label={`Background color ${idx + 1}`}
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
              aria-label="Text story mode"
            >
              <i className="fas fa-font"></i> Text
            </button>
            <button
              onClick={() => setMode('media')}
              className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
                mode === 'media' ? 'bg-[#1877F2] text-white shadow-lg' : 'text-white/60'
              }`}
              aria-label="Media story mode"
            >
              <i className="fas fa-photo-video"></i> Media
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-white/10 text-white/80 hover:bg-white/20"
              title="Add photos/videos"
              aria-label="Add media"
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
              aria-label="Add music"
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
            <button
              onClick={() => audioInputRef.current?.click()}
              className="p-4 bg-[#263951] rounded-xl flex items-center gap-4 cursor-pointer hover:bg-[#2A3F5A] transition-all border border-[#2D88FF]/20"
              aria-label="Upload music"
            >
              <div className="w-12 h-12 bg-[#1877F2] rounded-full flex items-center justify-center shadow-lg">
                <i className="fas fa-cloud-upload-alt text-white"></i>
              </div>
              <div>
                <p className="text-white font-bold">Upload Music</p>
                <p className="text-[#B0B3B8] text-xs">Choose a file from your device</p>
              </div>
            </button>

            <input
              type="file"
              ref={audioInputRef}
              className="hidden"
              accept="audio/*"
              onChange={handleAudioUpload}
              aria-label="Select audio file"
            />

            <div className="h-px bg-[#3E4042] my-2"></div>
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest px-1">
              UNERA Music Trends
            </p>

            <div className="flex flex-col gap-2">
              {songs.map((song) => (
                <button
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
                  aria-label={`Select ${song.title} by ${song.artist_name}`}
                >
                  <img src={song.cover_image_url} className="w-14 h-14 rounded-lg object-cover shadow-md" alt="" />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-white font-bold truncate">{song.title}</p>
                    <p className="text-[#B0B3B8] text-sm truncate">{song.artist_name}</p>
                  </div>
                  <i className="fas fa-play-circle text-2xl text-[#1877F2]"></i>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== STORY VIEWER MODAL ====================
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
  onFetchReactions?: (storyId: number) => Promise<{ reactions: any[]; counts: Record<string, number> }>;
  viewersCount?: number;
  onReply?: (storyId: number, text: string) => void;
  onLike?: (storyId: number) => void;
  onReaction?: (storyId: number, reaction: string) => void;
  onShare?: (storyId: number) => void;
  onComment?: (storyId: number) => void;
  muted?: boolean;
  onToggleMute?: () => void;
  onDeleteStory?: (storyId: number) => Promise<void> | void;
  deleteLoading?: boolean;
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
    onFetchReactions,
    viewersCount,
    onReply,
    onLike,
    onReaction,
    onShare,
    onComment,
    muted = true,
    onToggleMute,
    onDeleteStory,
    deleteLoading = false,
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

  const userStories = useMemo(() => {
    const list = (allStories?.length ? allStories : [story])
      .filter(s => Number(s.user_id) === Number(story.user_id))
      .slice()
      .sort((a, b) => parseServerTime(b.created_at) - parseServerTime(a.created_at));

    return list.length ? list : [story];
  }, [allStories, story.id, story.user_id]);

  const [activeIndex, setActiveIndex] = useState(() => {
    const idx = userStories.findIndex(s => Number(s.id) === Number(story.id));
    return idx >= 0 ? idx : 0;
  });

  const lastOpenedIdRef = useRef<number>(Number(story.id));

  useEffect(() => {
    const openedId = Number(story.id);
    if (openedId === lastOpenedIdRef.current) return;

    lastOpenedIdRef.current = openedId;
    const idx = userStories.findIndex(s => Number(s.id) === openedId);
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [story.id]);

  const activeStory = userStories[activeIndex] || story;

  const handleNext = () => {
    const next = activeIndex + 1;
    if (next < userStories.length) {
      setActiveIndex(next);
      return;
    }
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
  const handleShare = (storyId: number) => onShare?.(storyId);
  const handleComment = (storyId: number) => onComment?.(storyId);

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
      onShare={handleShare}
      onComment={handleComment}
      onFetchReactions={onFetchReactions}
      onFollow={onFollow}
      isFollowing={isFollowing}
      allStories={userStories}
      onFetchViewers={onFetchViewers}
      viewersCount={viewersCount}
      onProfileClick={onProfileClick}
      muted={muted}
      onToggleMute={onToggleMute}
      onDeleteStory={onDeleteStory}
      deleteLoading={deleteLoading}
    />
  );
};
