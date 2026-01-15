// Feed.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  Post as PostType,
  ReactionType,
  Product,
  LinkPreview,
  Brand,
  AudioTrack,
} from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { LOCATIONS_DATA, MARKETPLACE_COUNTRIES } from '../constants';
import { StickerPicker, EmojiPicker } from './Pickers';

/**
 * =========================
 * API HELPERS
 * =========================
 */
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('unera_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let msg = `API Error (${res.status})`;
    try {
      const j = await res.json();
      msg = j?.error || j?.message || msg;
    } catch {}
    throw new Error(msg);
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
};

// Optional upload helper: only works if you have an upload endpoint.
// If you don't have it yet, media posts will show a friendly error.
const uploadToR2IfAvailable = async (
  file: File
): Promise<{ url: string; media_type: 'image' | 'video' } | null> => {
  // Change this to your real upload endpoint if different
  const endpoint = '/api/uploads';

  const form = new FormData();
  form.append('file', file);

  try {
    const token = localStorage.getItem('unera_token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(endpoint, { method: 'POST', body: form, headers });
    if (!res.ok) return null;

    const data = await res.json();
    const url = data?.url || data?.media_url;
    if (!url) return null;

    return {
      url,
      media_type: file.type.startsWith('image') ? 'image' : 'video',
    };
  } catch {
    return null;
  }
};

/**
 * =========================
 * SMALL UI UTILITIES
 * =========================
 */
const getLinkPreview = (text: string): LinkPreview | null => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = text.match(urlRegex);
  if (!match?.[0]) return null;

  const url = match[0];
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    return null;
  }

  if (domain.includes('youtube')) {
    return {
      url,
      title: 'YouTube Video',
      description: 'Watch this video on YouTube.',
      image:
        'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80',
      domain: 'youtube.com',
    };
  }

  if (domain.includes('github')) {
    return {
      url,
      title: 'GitHub Repository',
      description: 'Open source project on GitHub.',
      image:
        'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?auto=format&fit=crop&w=800&q=80',
      domain: 'github.com',
    };
  }

  return {
    url,
    title: 'Website Link',
    description: `Link from ${domain}.`,
    image:
      'https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&w=800&q=80',
    domain,
  };
};

const BACKGROUNDS = [
  { id: 'none', value: '' },
  { id: 'red', value: 'linear-gradient(45deg, #FF0057, #E64C4C)' },
  { id: 'blue', value: 'linear-gradient(45deg, #00C6FF, #0072FF)' },
  { id: 'green', value: 'linear-gradient(45deg, #a8ff78, #78ffd6)' },
  { id: 'purple', value: 'linear-gradient(45deg, #e65c00, #F9D423)' },
  {
    id: 'heart',
    value:
      'url("https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=500&q=60")',
  },
  { id: 'dark', value: 'linear-gradient(to right, #434343 0%, black 100%)' },
  { id: 'fire', value: 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)' },
];

const FEELINGS = [
  'Happy',
  'Blessed',
  'Loved',
  'Sad',
  'Excited',
  'Thankful',
  'Crazy',
  'Tired',
  'Cool',
  'Relaxed',
];

const safeUserId = (u: any) => Number(u?.id ?? u?.user_id ?? 0);
const safePostId = (p: any) => Number(p?.id ?? 0);

/**
 * =========================
 * ✅ RELATIVE TIME (FB-like)
 * =========================
 * Under 1 minute: "Just now"
 * Under 1 hour: "Xmin"
 * Under 24 hours: "Xhrs"
 * Under 7 days: "Xdays"
 * Older: "MM/DD/YYYY"
 */
const formatRelativeTime = (dateInput: any): string => {
  if (!dateInput) return 'Recently';

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const t = d.getTime();
  if (!Number.isFinite(t)) return 'Recently';

  const now = Date.now();
  let diffMs = now - t;

  if (diffMs < 0) diffMs = 0;

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}min`;

  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}hrs`;

  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}days`;

  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

/**
 * =========================
 * RICH TEXT (hashtags + mentions)
 * =========================
 */
const RichText = ({
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
    <span className="leading-relaxed text-[#E4E6EB] whitespace-pre-wrap break-words">
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
                className="text-[#1877F2] font-semibold cursor-pointer hover:underline"
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
            <span key={index} className="text-[#1877F2] font-semibold">
              {part}
            </span>
          );
        }

        if (part.startsWith('#')) {
          return (
            <span
              key={index}
              className="text-[#1877F2] cursor-pointer hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onHashtagClick && onHashtagClick(part);
              }}
            >
              {part}
            </span>
          );
        }

        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

/**
 * =========================
 * REACTION BUTTON (FB style)
 * =========================
 */
export const ReactionButton: React.FC<{
  currentUserReactions: ReactionType | undefined;
  reactionCount: number;
  onReact: (type: ReactionType) => void;
  isGuest?: boolean;
}> = ({ currentUserReactions, reactionCount, onReact, isGuest }) => {
  const [showDock, setShowDock] = useState(false);
  const timerRef = useRef<any>(null);

  const handleMouseEnter = () => {
    if (isGuest) return;
    timerRef.current = setTimeout(() => setShowDock(true), 500);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => setShowDock(false), 250);
  };

  const handleClick = () => {
    if (isGuest) return alert('Please login to react.');
    onReact('like');
  };

  const reactionConfig = [
    { type: 'like', icon: '👍', color: '#1877F2' },
    { type: 'love', icon: '❤️', color: '#F3425F' },
    { type: 'haha', icon: '😆', color: '#F7B928' },
    { type: 'wow', icon: '😮', color: '#F7B928' },
    { type: 'sad', icon: '😢', color: '#F7B928' },
    { type: 'angry', icon: '😡', color: '#E41E3F' },
  ] as const;

  const activeReaction = currentUserReactions
    ? reactionConfig.find((r) => r.type === currentUserReactions)
    : null;

  return (
    <div
      className="flex-1 relative group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showDock && (
        <div className="absolute -top-12 left-0 bg-[#242526] rounded-full shadow-xl p-1.5 flex gap-2 animate-fade-in border border-[#3E4042] z-50">
          {reactionConfig.map((r) => (
            <div
              key={r.type}
              className="text-2xl hover:scale-125 transition-transform cursor-pointer hover:-translate-y-2 duration-200"
              onClick={(e) => {
                e.stopPropagation();
                onReact(r.type as ReactionType);
                setShowDock(false);
              }}
            >
              {r.icon}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleClick}
        className="w-full flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors active:scale-95"
      >
        {activeReaction ? (
          <>
            <span className="text-[20px]">{activeReaction.icon}</span>
            <span
              className="text-[17px] font-medium"
              style={{ color: activeReaction.color }}
            >
              {activeReaction.type}
            </span>
          </>
        ) : (
          <>
            <i className="far fa-thumbs-up text-[20px] text-[#B0B3B8]"></i>
            <span className="text-[17px] font-medium text-[#B0B3B8]">Like</span>
          </>
        )}
      </button>
    </div>
  );
};

/**
 * =========================
 * POST CARD
 * =========================
 */
export const Post: React.FC<{
  post: PostType;
  author: User | Brand;
  currentUser: User | null;
  users?: User[];
  onProfileClick: (id: number) => void;
  onReact: (id: number, type: ReactionType) => void;
  onShare: (id: number) => void;
  onDelete?: (id: number) => void;
  onViewImage: (url: string) => void;
  onOpenComments: (id: number) => void;
  onVideoClick: (p: PostType) => void;
  onPlayAudioTrack?: (t: AudioTrack) => void;
  onHashtagClick?: (tag: string) => void;
}> = ({
  post,
  author,
  currentUser,
  users,
  onProfileClick,
  onReact,
  onShare,
  onDelete,
  onViewImage,
  onOpenComments,
  onVideoClick,
  onPlayAudioTrack,
  onHashtagClick,
}) => {
  const p: any = post as any;
  const a: any = author as any;

  const reactions = Array.isArray(p.reactions) ? p.reactions : [];
  const comments = Array.isArray(p.comments) ? p.comments : [];
  const commentCount =
    typeof p.comment_count === 'number' ? p.comment_count : comments.length;

  const myReaction = currentUser
    ? reactions.find((r: any) => Number(r.user_id) === safeUserId(currentUser))
        ?.type
    : undefined;

  const createdAtLabel = formatRelativeTime(p.created_at);
  const postId = safePostId(p);

  return (
    <div className="bg-[#242526] rounded-xl shadow-sm mb-4 animate-fade-in border border-[#3E4042] overflow-hidden">
      <div className="p-3 md:p-4 flex items-center justify-between">
        <div
          className="flex items-center gap-2 flex-1 min-w-0"
          onClick={() => onProfileClick(safeUserId(a))}
        >
          <img
            src={
              a.profile_image_url ||
              a.profileImage ||
              a.avatar ||
              'https://ui-avatars.com/api/?name=User'
            }
            alt=""
            className="w-10 h-10 rounded-full object-cover cursor-pointer border border-[#3E4042]"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <h4 className="font-bold text-[#E4E6EB] text-[18.5px] cursor-pointer hover:underline truncate">
                {a.name || a.username || 'User'}
              </h4>
              {a.is_verified && (
                <i className="fas fa-check-circle text-[#1877F2] text-[13px]"></i>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[#B0B3B8] text-[13px]">
              <span>{createdAtLabel}</span>
              <span>•</span>
              <i className="fas fa-globe-americas text-[12px]"></i>
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
              {p.__pending && (
                <>
                  <span>•</span>
                  <span className="text-[#B0B3B8]">
                    <i className="fas fa-spinner fa-spin mr-1 text-[#1877F2]" />
                    posting…
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {onDelete &&
          currentUser &&
          safeUserId(currentUser) === Number(p.user_id ?? p.author_id ?? 0) && (
            <button
              className="w-9 h-9 hover:bg-[#3A3B3C] rounded-full flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(postId);
              }}
              title="Delete"
            >
              <i className="fas fa-trash text-[#B0B3B8]"></i>
            </button>
          )}
      </div>

      {p.content && (
        <div className="px-3 md:px-4 pb-2 text-[#E4E6EB] text-[17px]">
          <RichText
            text={p.content}
            users={users}
            onProfileClick={onProfileClick}
            onHashtagClick={onHashtagClick}
          />
        </div>
      )}

      {p.link_preview && !p.media_url && (
        <div
          className="mx-3 md:mx-4 mb-2 bg-[#242526] border border-[#3E4042] rounded-lg overflow-hidden cursor-pointer hover:bg-[#3A3B3C] transition-colors"
          onClick={() => window.open(p.link_preview.url, '_blank')}
        >
          <img
            src={p.link_preview.image}
            alt=""
            className="w-full h-48 object-cover"
          />
          <div className="p-3 bg-[#3A3B3C]">
            <div className="text-[#B0B3B8] text-xs uppercase font-bold mb-1">
              {p.link_preview.domain}
            </div>
            <div className="text-[#E4E6EB] font-bold text-[17px] mb-1 line-clamp-1">
              {p.link_preview.title}
            </div>
            <div className="text-[#B0B3B8] text-[14px] line-clamp-2">
              {p.link_preview.description}
            </div>
          </div>
        </div>
      )}

      {p.background && !p.media_url && (
        <div
          className="h-[300px] flex items-center justify-center p-8 text-center text-white font-bold text-2xl"
          style={{ background: p.background, backgroundSize: 'cover' }}
        >
          {p.content}
        </div>
      )}

      {p.media_url &&
        (p.media_type === 'image' || p.type === 'image') &&
        !p.background && (
          <div
            className="cursor-pointer bg-black"
            onClick={() => onViewImage(p.media_url)}
          >
            <img
              src={p.media_url}
              alt=""
              className="w-full h-auto max-h-[600px] object-contain"
            />
          </div>
        )}

      {p.media_url && (p.media_type === 'video' || p.type === 'video') && (
        <div
          className="cursor-pointer relative h-[500px]"
          onClick={() => onVideoClick(post)}
        >
          <video src={p.media_url} className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center">
            <i className="fas fa-play text-white text-4xl opacity-50"></i>
          </div>
        </div>
      )}

      <div className="px-3 md:px-4 py-2.5 flex items-center justify-between text-[#B0B3B8] text-[14px] border-t border-[#3E4042]">
        <div className="flex items-center gap-1.5">
          {reactions.length > 0 && (
            <span className="hover:underline">{reactions.length} Reactions</span>
          )}
        </div>
        <div className="flex gap-4">
          <span
            className="hover:underline cursor-pointer"
            onClick={() => onOpenComments(Number(postId))}
          >
            {commentCount} Comments
          </span>
        </div>
      </div>

      <div className="px-2 py-1 border-t border-[#3E4042] flex items-center justify-between">
        <ReactionButton
          currentUserReactions={myReaction}
          reactionCount={reactions.length}
          onReact={(type) => onReact(postId, type)}
          isGuest={!currentUser}
        />
        <button
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
          onClick={() =>
            currentUser ? onOpenComments(Number(postId)) : alert('Login first')
          }
        >
          <i className="far fa-comment-alt text-[20px]"></i>
          <span className="text-[17px] font-medium">Comment</span>
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
          onClick={() => onShare(postId)}
        >
          <i className="fas fa-share text-[20px]"></i>
          <span className="text-[17px] font-medium">Share</span>
        </button>
      </div>
    </div>
  );
};

/**
 * =========================
 * CREATE POST CARD
 * =========================
 */
export const CreatePost: React.FC<{
  currentUser: User;
  onProfileClick: (id: number) => void;
  onClick: () => void;
  onCreateEventClick?: () => void;
}> = ({ currentUser, onProfileClick, onClick, onCreateEventClick }) => (
  <div className="bg-[#242526] rounded-xl p-3 md:p-4 mb-4 shadow-sm border border-[#3E4042]">
    <div className="flex gap-2 mb-3">
      <img
        src={
          (currentUser as any).profile_image_url ||
          (currentUser as any).profileImage ||
          (currentUser as any).avatar ||
          'https://ui-avatars.com/api/?name=User'
        }
        alt=""
        className="w-10 h-10 rounded-full object-cover cursor-pointer border border-[#3E4042]"
        onClick={() => onProfileClick(safeUserId(currentUser))}
      />
      <div
        className="flex-1 bg-[#3A3B3C] rounded-full px-4 py-2 hover:bg-[#4E4F50] cursor-pointer flex items-center transition-colors"
        onClick={onClick}
      >
        <span className="text-[#B0B3B8] text-[17px] truncate">
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
        <i className="fas fa-video text-[#F3425F] text-[22px]"></i>
        <span className="text-[#B0B3B8] font-semibold text-[15px] hidden sm:block">
          Live Video
        </span>
      </div>

      <div
        className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors"
        onClick={onClick}
      >
        <i className="fas fa-images text-[#45BD62] text-[22px]"></i>
        <span className="text-[#B0B3B8] font-semibold text-[15px] hidden sm:block">
          Photo/Video
        </span>
      </div>

      <div
        className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors"
        onClick={onCreateEventClick}
      >
        <i className="fas fa-flag text-[#F7B928] text-[22px]"></i>
        <span className="text-[#B0B3B8] font-semibold text-[15px] hidden sm:block">
          Life Event
        </span>
      </div>
    </div>
  </div>
);


/**
 * =========================
 * CREATE POST MODAL (WORKING)
 * =========================
 */
export const CreatePostModal: React.FC<{
  currentUser: User;
  users: User[];
  onClose: () => void;
  onCreatePost: (
    text: string,
    file: File | null,
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
}> = ({ currentUser, users, onClose, onCreatePost }) => {
  const [view, setView] = useState<'main' | 'tag' | 'feeling' | 'location'>(
    'main'
  );
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [type, setType] = useState<'text' | 'image' | 'video'>('text');

  const [visibility] = useState<'Public' | 'Friends'>('Public');
  const [activeBackground, setActiveBackground] = useState('');
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);

  const [taggedUsers, setTaggedUsers] = useState<number[]>([]);
  const [feeling, setFeeling] = useState('');
  const [location, setLocation] = useState('');

  // Location search via backend: /api/locations/search
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState<any[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const searchTimeout = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLinkPreview(getLinkPreview(text));
  }, [text]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
    setType(f.type.startsWith('image') ? 'image' : 'video');
    setActiveBackground('');
    setView('main');
  };

  const handleLocationSearch = async (q: string) => {
    if (q.trim().length < 3) {
      setLocResults([]);
      return;
    }
    setLocLoading(true);
    try {
      const data = await apiFetch(
        `/api/locations/search?q=${encodeURIComponent(q)}`
      );
      setLocResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Location search failed', err);
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

  const canPost = !!text.trim() || !!file || !!activeBackground;

  const submit = () => {
    if (!canPost) return;

    onCreatePost(text, file, {
      type: file ? type : 'text',
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
      <i className={`${icon} text-[24px] w-8 text-center`} style={{ color }}></i>
      <span className="text-[#E4E6EB] text-[17px] font-medium">{label}</span>
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
          <h3 className="text-[#E4E6EB] text-lg font-bold">Tag People</h3>
          <button
            onClick={() => setView('main')}
            className="ml-auto text-[#1877F2] font-bold"
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
                    src={u.profile_image_url}
                    className="w-10 h-10 rounded-full object-cover"
                    alt=""
                  />
                  <span className="text-[#E4E6EB] font-semibold">{u.name}</span>
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
          <h3 className="text-[#E4E6EB] text-lg font-bold">
            How are you feeling?
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-2">
          {FEELINGS.map((f) => (
            <div
              key={f}
              className="p-3 bg-[#242526] rounded-lg text-center cursor-pointer hover:bg-[#3A3B3C] text-[#E4E6EB]"
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
          <h3 className="text-[#E4E6EB] text-lg font-bold">Search Location</h3>
        </div>

        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Where are you?"
              className="w-full bg-[#3A3B3C] rounded-xl p-4 pl-12 text-[#E4E6EB] outline-none focus:ring-2 focus:ring-[#1877F2] transition-all"
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
                    `${loc.city || ''}${
                      loc.country ? `, ${loc.country}` : ''
                    }`.trim();

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
                        <span className="text-[#E4E6EB] font-bold block truncate">
                          {title}
                        </span>
                        <span className="text-[#B0B3B8] text-xs block truncate">
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
                <p className="text-[#B0B3B8]">No matching locations found.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-[#B0B3B8] uppercase tracking-widest mb-2 px-1">
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
                    <span className="text-[#E4E6EB] font-semibold">
                      {loc.name}
                    </span>
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
          <h3 className="text-[#E4E6EB] text-[20px] font-medium">
            Create Post
          </h3>
        </div>
        <button
          onClick={submit}
          disabled={!canPost}
          className="text-[#E4E6EB] font-bold text-[17px] disabled:text-[#B0B3B8]"
        >
          POST
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <img
              src={(currentUser as any).profile_image_url}
              alt=""
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <div className="flex items-center gap-1 flex-wrap">
                <h4 className="font-bold text-[#E4E6EB] text-[17px]">
                  {(currentUser as any).name}
                </h4>
                {feeling && (
                  <span className="text-[#E4E6EB] text-[15px]">
                    {' '}
                    is feeling {feeling}
                  </span>
                )}
                {location && (
                  <span className="text-[#E4E6EB] text-[15px]">
                    {' '}
                    in {location.split(',')[0]}
                  </span>
                )}
                {taggedUsers.length > 0 && (
                  <span className="text-[#E4E6EB] text-[15px]">
                    {' '}
                    with {taggedUsers.length} others
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5">
                <div className="bg-[#3A3B3C] rounded-md px-2 py-1 inline-flex items-center gap-1 text-[13px] font-semibold text-[#E4E6EB] border border-[#3E4042]">
                  <i
                    className={`fas ${
                      visibility === 'Public'
                        ? 'fa-globe-americas'
                        : 'fa-user-friends'
                    } text-[12px]`}
                  ></i>
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
                  : 'text-[24px]'
              }`}
              placeholder="What's on your mind?"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={activeBackground ? 4 : 5}
            />
          </div>

          {linkPreview && !file && !activeBackground && (
            <div
              className="mb-4 bg-[#242526] border border-[#3E4042] rounded-lg overflow-hidden cursor-pointer hover:bg-[#3A3B3C] transition-colors"
              onClick={() => window.open(linkPreview.url, '_blank')}
            >
              <img
                src={linkPreview.image}
                alt="Preview"
                className="w-full h-48 object-cover"
              />
              <div className="p-3 bg-[#3A3B3C]">
                <div className="text-[#B0B3B8] text-xs uppercase font-bold mb-1">
                  {linkPreview.domain}
                </div>
                <div className="text-[#E4E6EB] font-bold text-[17px] mb-1 line-clamp-1">
                  {linkPreview.title}
                </div>
                <div className="text-[#B0B3B8] text-[14px] line-clamp-2">
                  {linkPreview.description}
                </div>
              </div>
            </div>
          )}

          {!preview && (
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
                    activeBackground === bg.value
                      ? 'border-white'
                      : 'border-transparent'
                  }`}
                  style={{ background: bg.value, backgroundSize: 'cover' }}
                  onClick={() => setActiveBackground(bg.value)}
                />
              ))}
            </div>
          )}

          {preview && (
            <div className="relative rounded-lg overflow-hidden border border-[#3E4042] mb-4">
              <div
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setType('text');
                }}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center cursor-pointer hover:bg-black/80 z-10"
              >
                <i className="fas fa-times text-white"></i>
              </div>

              {type === 'image' ? (
                <img
                  src={preview}
                  alt="preview"
                  className="w-full h-auto max-h-[400px] object-contain bg-black"
                />
              ) : (
                <video
                  src={preview}
                  controls
                  className="w-full h-auto max-h-[400px] bg-black"
                />
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[#3E4042]">
          <OptionsItem
            icon="fas fa-images"
            color="#45BD62"
            label="Photo/video"
            onClick={() => fileInputRef.current?.click()}
          />
          <OptionsItem
            icon="fas fa-camera"
            color="#45BD62"
            label="Camera"
            onClick={() => cameraInputRef.current?.click()}
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
        </div>
      </div>

      <div className="p-4 border-t border-[#3E4042]">
        <button
          onClick={submit}
          disabled={!canPost}
          className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold py-3 rounded-lg transition-colors disabled:bg-[#3A3B3C] text-lg shadow-sm"
        >
          POST
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,video/*"
        onChange={handleFileChange}
      />
      <input
        type="file"
        ref={cameraInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
      />
    </div>
  );
};

/**
 * =========================
 * COMMENTS SHEET (WORKING + REALTIME + CACHE + NO ANONYMOUS)
 * =========================
 */
export const CommentsSheet: React.FC<{
  post: PostType;
  currentUser: User;
  users: User[];
  onClose: () => void;

  // ✅ realtime helpers from Feed
  getCachedComments: (postId: number) => any[] | null;
  setCachedComments: (postId: number, comments: any[]) => void;
  onLocalCommentCountChange: (postId: number, newCount: number) => void;
}> = ({
  post,
  currentUser,
  users,
  onClose,
  getCachedComments,
  setCachedComments,
  onLocalCommentCountChange,
}) => {
  const p: any = post as any;
  const [text, setText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const postId = safePostId(p);

  // ✅ show cached immediately (no "loading" feel)
  useEffect(() => {
    const cached = getCachedComments(postId);
    if (cached && Array.isArray(cached)) {
      setComments(cached);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // ✅ fetch in background and refresh cache
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const data = await apiFetch(`/api/posts/${postId}/comments`);
        if (!alive) return;
        const arr = Array.isArray(data) ? data : data?.comments || [];
        setComments(arr);
        setCachedComments(postId, arr);
        onLocalCommentCountChange(postId, arr.length);
      } catch {
        if (!alive) return;
        const cached = getCachedComments(postId);
        setComments(cached && Array.isArray(cached) ? cached : []);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;

    const optimistic = {
      id: `tmp-${Date.now()}`,
      post_id: postId,
      user_id: safeUserId(currentUser), // ✅ prevents anonymous
      text: t,
      author_name: (currentUser as any).name || (currentUser as any).username || 'You',
      author_image:
        (currentUser as any).profile_image_url ||
        (currentUser as any).profileImage ||
        (currentUser as any).avatar ||
        'https://ui-avatars.com/api/?name=User',
      created_at: new Date().toISOString(),
      __pending: true,
    };

    setText('');

    // ✅ optimistic add + realtime count + cache
    setComments((prev) => {
      const next = [...prev, optimistic];
      setCachedComments(postId, next);
      onLocalCommentCountChange(postId, next.length);
      return next;
    });

    try {
      const data = await apiFetch(`/api/posts/${postId}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          text: t,
          user_id: safeUserId(currentUser), // ✅ send user_id
        }),
      });

      const serverComment = data?.comment;

      if (serverComment) {
        setComments((prev) => {
          const next = prev.map((c) => (c.id === optimistic.id ? serverComment : c));
          setCachedComments(postId, next);
          onLocalCommentCountChange(postId, next.length);
          return next;
        });
      } else {
        setComments((prev) => {
          const next = prev.map((c) =>
            c.id === optimistic.id ? { ...c, __pending: false } : c
          );
          setCachedComments(postId, next);
          onLocalCommentCountChange(postId, next.length);
          return next;
        });
      }

      // ✅ reconcile quietly (keeps perfect count/ordering)
      apiFetch(`/api/posts/${postId}/comments`)
        .then((fresh) => {
          const arr = Array.isArray(fresh) ? fresh : fresh?.comments || [];
          setComments(arr);
          setCachedComments(postId, arr);
          onLocalCommentCountChange(postId, arr.length);
        })
        .catch(() => {});
    } catch (err: any) {
      setComments((prev) => {
        const next = prev.filter((c) => c.id !== optimistic.id);
        setCachedComments(postId, next);
        onLocalCommentCountChange(postId, next.length);
        return next;
      });
      alert(err?.message || 'Failed to comment');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>

      <div className="bg-[#242526] w-full md:w-[600px] md:h-[80vh] z-20 animate-slide-up flex flex-col h-[70vh] shadow-2xl overflow-hidden border border-[#3E4042]">
        <div className="p-3 border-b border-[#3E4042] flex justify-between bg-[#242526]">
          <h3 className="font-bold text-[#E4E6EB]">Comments</h3>
          <i
            className="fas fa-times text-[#B0B3B8] cursor-pointer"
            onClick={onClose}
          ></i>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && comments.length === 0 ? (
            <div className="text-[#B0B3B8] text-center py-6">
              <i className="fas fa-spinner fa-spin mr-2"></i>Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-[#B0B3B8] text-center py-6">No comments yet.</div>
          ) : (
            comments.map((c) => (
              <div key={String(c.id)} className="flex gap-2">
                <img
                  src={c.author_image || 'https://ui-avatars.com/api/?name=User'}
                  className="w-8 h-8 rounded-full object-cover"
                  alt=""
                />
                <div className="bg-[#3A3B3C] px-4 py-2 rounded-2xl flex-1">
                  <p className="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
                    {c.author_name || 'Anonymous'}
                    <span className="text-[12px] font-normal text-[#B0B3B8]">
                      • {formatRelativeTime(c.created_at || c.createdAt || c.timestamp)}
                    </span>
                    {c.__pending && (
                      <span className="text-[11px] text-[#B0B3B8]">
                        <i className="fas fa-spinner fa-spin mr-1 text-[#1877F2]" />
                        sending…
                      </span>
                    )}
                  </p>
                  <p className="text-white text-[15px] whitespace-pre-wrap break-words">
                    {c.text}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <form className="p-3 border-t border-[#3E4042] flex gap-2" onSubmit={handleSubmit}>
          <input
            type="text"
            className="bg-[#3A3B3C] text-white flex-1 rounded-full px-4 py-2 outline-none"
            placeholder="Write a comment..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="text-[#1877F2] font-bold">
            Post
          </button>
        </form>
      </div>
    </div>
  );
};


/**
 * =========================
 * SUGGESTED PRODUCTS WIDGET
 * =========================
 */
export const SuggestedProductsWidget: React.FC<{
  products: Product[];
  currentUser: User;
  onViewProduct: (product: Product) => void;
  onSeeAll: () => void;
}> = ({ products, currentUser, onViewProduct, onSeeAll }) => {
  const suggested = (products || [])
    .filter((p: any) => p.seller_id !== safeUserId(currentUser))
    .slice(0, 4);

  if (suggested.length === 0) return null;

  return (
    <div className="bg-[#242526] rounded-xl p-4 mb-4 border border-[#3E4042] shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-[#E4E6EB] font-bold text-lg">Marketplace for you</h3>
        <button
          onClick={onSeeAll}
          className="text-[#1877F2] font-semibold text-[15px] hover:bg-[#3A3B3C] px-2 py-1 rounded transition-colors"
        >
          See all
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {suggested.map((product: any) => {
          const countryData = MARKETPLACE_COUNTRIES.find((c) =>
            String(product.address || '')
              .toLowerCase()
              .includes(c.name.toLowerCase())
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
                <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-black text-white">
                  {symbol}
                  {product.main_price}
                </div>
              </div>
              <h4 className="text-[#E4E6EB] text-sm font-semibold truncate px-0.5 leading-tight">
                {product.title}
              </h4>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * =========================
 * ✅ FULL FEED CONTAINER (API CONNECTED)
 * =========================
 */
type FeedItem = {
  post: any;
  author: any;
};

const normalizeFeed = (raw: any): FeedItem[] => {
  const arr = Array.isArray(raw) ? raw : raw?.items || raw?.results || raw?.posts || [];
  if (!Array.isArray(arr)) return [];

  return arr.map((x: any) => {
    const author =
      x.author ||
      x.user || {
        id: x.user_id,
        name: x.author_name || x.username || 'User',
        profile_image_url:
          x.author_profile_image_url || x.profile_image_url || x.profileImage,
        is_verified: x.is_verified,
      };

    const post = {
      ...x,
      id: x.id,
      user_id: x.user_id ?? x.author_id,
      content: x.content ?? '',
      created_at: x.created_at ?? x.timestamp,
      media_url: x.media_url ?? x.image_url ?? x.video_url ?? null,
      media_type: x.media_type ?? x.type ?? null,
      reactions: x.reactions ?? [],
      comments: x.comments ?? [],
      comment_count: typeof x.comment_count === 'number' ? x.comment_count : x.commentCount,
      background: x.background ?? null,
      feeling: x.feeling ?? null,
      location: x.location ?? null,
      link_preview: x.link_preview ?? x.linkPreview ?? null,
      shares: x.shares ?? 0,
      views: x.views ?? 0,
    };

    return { post, author };
  });
};

export default function Feed({
  currentUser,
  users = [],
  onProfileClick,
}: {
  currentUser: User | null;
  users?: User[];
  onProfileClick: (id: number) => void;
}) {
  try {
    useLanguage();
  } catch {}

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);

  // ✅ FIX: Store post snapshot for comments to prevent blank when feed refreshes
  const [openCommentsFor, setOpenCommentsFor] = useState<number | null>(null);
  const [commentPostSnapshot, setCommentPostSnapshot] = useState<any | null>(null);

  // ✅ comments cache (instant open after first)
  const commentsCacheRef = useRef<Map<number, any[]>>(new Map());

  // ✅ avoid loader flicker on polling + store last good feed
  const firstLoadRef = useRef(true);
  const lastGoodItemsRef = useRef<FeedItem[]>([]);
  const fetchSeqRef = useRef(0);

  // Optional: re-render time labels every minute (no refetch)
  const [, setTimeTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTimeTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const setCommentCountForPost = (postId: number, newCount: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (Number(it.post.id) !== Number(postId)) return it;
        return { ...it, post: { ...it.post, comment_count: Number(newCount) } };
      })
    );
  };

  // ✅ FIXED: Safe fetchFeed that prevents feed disappearance and blank comments
  const fetchFeed = async () => {
    const mySeq = ++fetchSeqRef.current;

    // ✅ only show loading on first load (prevents flicker)
    if (firstLoadRef.current) setLoading(true);
    setError(null);

    try {
      let data: any;

      if (currentUser?.id) {
        data = await apiFetch(`/api/feeds?userId=${safeUserId(currentUser)}&limit=20`);
        // feeds shape: { feed: [...] }
        data = data?.feed ?? data;
      } else {
        data = await apiFetch(`/api/posts?limit=20`);
      }

      // ✅ normalize
      const normalized = normalizeFeed(data ?? []);

      // ✅ ignore out-of-order responses (race condition fix)
      if (mySeq !== fetchSeqRef.current) return;

      // ✅ IMPORTANT: never blow away a good feed with empty results during polling
      if (normalized.length > 0) {
        setItems(normalized);
        lastGoodItemsRef.current = normalized;

        // ✅ if comments is open, refresh snapshot when possible (keeps it accurate)
        if (openCommentsFor != null) {
          const found = normalized.find((it) => Number(it.post.id) === Number(openCommentsFor));
          if (found?.post) setCommentPostSnapshot(found.post);
        }
      } else {
        // If it returns empty but we already have a feed, keep the old one.
        if (lastGoodItemsRef.current.length > 0) {
          setItems(lastGoodItemsRef.current);
        } else {
          setItems([]); // first load truly empty
        }
      }
    } catch (e: any) {
      // ✅ ignore out-of-order errors
      if (mySeq !== fetchSeqRef.current) return;

      setError(e?.message || 'Failed to load feed');

      // ✅ keep last good feed on background failures
      if (lastGoodItemsRef.current.length > 0) {
        setItems(lastGoodItemsRef.current);
      } else {
        setItems([]);
      }
    } finally {
      if (firstLoadRef.current) {
        setLoading(false);
        firstLoadRef.current = false;
      }
    }
  };

  // ✅ FIXED: Pause polling while comments is open
  useEffect(() => {
    fetchFeed();

    if (openCommentsFor != null) return; // ✅ pause polling while comments open

    const id = setInterval(fetchFeed, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, openCommentsFor]);

  const handleCreatePost = async (
    text: string,
    file: File | null,
    meta?: {
      type?: 'text' | 'image' | 'video';
      visibility?: string;
      location?: string;
      feeling?: string;
      taggedUsers?: number[];
      background?: string;
      linkPreview?: LinkPreview | null;
    }
  ) => {
    if (!currentUser) return alert('Login first');

    const hasText = !!text?.trim();
    const hasBg = !!meta?.background;
    const hasFile = !!file;

    if (!hasText && !hasBg && !hasFile) return;

    // Upload media if needed
    let media_url: string | null = null;
    let media_type: 'image' | 'video' | null = null;

    if (file) {
      const uploaded = await uploadToR2IfAvailable(file);
      if (!uploaded) {
        alert(
          'Image/video upload is not set yet. Create an upload API endpoint (R2) first, then media posts will work.'
        );
        return;
      }
      media_url = uploaded.url;
      media_type = uploaded.media_type;
    }

    // ✅ optimistic post (shows immediately)
    const optimisticId = `tmp-${Date.now()}`;
    const optimisticPost = {
      id: optimisticId,
      user_id: safeUserId(currentUser),
      content: text || '',
      created_at: new Date().toISOString(),
      media_url,
      media_type,
      background: meta?.background || null,
      feeling: meta?.feeling || null,
      location: meta?.location || null,
      visibility: meta?.visibility || 'Public',
      tagged_users: meta?.taggedUsers || [],
      link_preview: meta?.linkPreview || null,
      reactions: [],
      comments: [],
      comment_count: 0,
      shares: 0,
      views: 0,
      __pending: true,
    };

    const optimisticAuthor = {
      ...(currentUser as any),
      id: safeUserId(currentUser),
      name: (currentUser as any).name || (currentUser as any).username || 'User',
      profile_image_url:
        (currentUser as any).profile_image_url ||
        (currentUser as any).profileImage ||
        (currentUser as any).avatar ||
        'https://ui-avatars.com/api/?name=User',
    };

    setItems((prev) => [{ post: optimisticPost, author: optimisticAuthor }, ...prev]);
    setShowCreate(false);

    try {
      const result = await apiFetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          user_id: safeUserId(currentUser),
          content: text || '',
          media_url,
          media_type,
          background: meta?.background || null,
          feeling: meta?.feeling || null,
          location: meta?.location || null,
          visibility: meta?.visibility || 'Public',
          tagged_users: meta?.taggedUsers || [],
          link_preview: meta?.linkPreview || null,
        }),
      });

      const serverPost = result?.post ?? null;

      if (serverPost && serverPost.id != null) {
        setItems((prev) =>
          prev.map((it) =>
            String(it.post.id) === optimisticId
              ? { ...it, post: { ...it.post, ...serverPost, __pending: false } }
              : it
          )
        );
      } else {
        setItems((prev) =>
          prev.map((it) =>
            String(it.post.id) === optimisticId
              ? { ...it, post: { ...it.post, __pending: false } }
              : it
          )
        );
      }

      // reconcile once
      await fetchFeed();
    } catch (e: any) {
      setItems((prev) => prev.filter((it) => String(it.post.id) !== optimisticId));
      alert(e?.message || 'Failed to post');
    }
  };

  const handleReact = async (postId: number, type: ReactionType) => {
    if (!currentUser) return alert('Login first');

    try {
      await apiFetch('/api/post-reactions', {
        method: 'POST',
        body: JSON.stringify({
          post_id: Number(postId),
          user_id: safeUserId(currentUser),
          type,
        }),
      });
      await fetchFeed();
      return;
    } catch {
      // fallback path
    }

    try {
      await apiFetch(`/api/posts/${Number(postId)}/react`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: safeUserId(currentUser),
          type,
        }),
      });
      await fetchFeed();
    } catch {
      await fetchFeed();
    }
  };

  const handleShare = async (postId: number) => {
    const pid = Number(postId);

    // ✅ call backend share endpoint first
    try {
      await apiFetch(`/api/posts/${pid}/share`, { method: 'POST' });
    } catch {
      // even if backend fails, still allow copy
    }

    const link = `https://unera.social/posts/${pid}`;
    try {
      await navigator.clipboard.writeText(link);
      alert('Link copied');
    } catch {
      alert(link);
    }
  };

  const handleViewImage = (url: string) => {
    window.open(url, '_blank');
  };

  // ✅ FIXED: Stable activeCommentPost with snapshot support
  const activeCommentPost = useMemo(() => {
    if (openCommentsFor == null) return null;

    // ✅ Prefer snapshot (stable even if items refresh)
    if (commentPostSnapshot && Number(commentPostSnapshot?.id) === Number(openCommentsFor)) {
      return commentPostSnapshot;
    }

    // fallback: find from items
    const target = Number(openCommentsFor);
    const found = items.find((it) => Number(it?.post?.id) === target);
    return found?.post || null;
  }, [openCommentsFor, items, commentPostSnapshot]);

  // ✅ de-dup by id (prevents duplicates if optimistic + refresh overlaps)
  const dedupedItems = useMemo(() => {
    const seen = new Set<string>();
    const out: FeedItem[] = [];
    for (const it of items) {
      const id = String(it?.post?.id ?? '');
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(it);
    }
    return out;
  }, [items]);

  return (
    <div className="w-full">
      {currentUser ? (
        <CreatePost
          currentUser={currentUser}
          onProfileClick={onProfileClick}
          onClick={() => setShowCreate(true)}
        />
      ) : (
        <div className="bg-[#242526] rounded-xl p-4 mb-4 shadow-sm border border-[#3E4042] text-[#B0B3B8]">
          <div className="flex items-center justify-between">
            <span>Welcome to UNERA. Login to post, react and comment.</span>
            <i className="fas fa-lock"></i>
          </div>
        </div>
      )}

      {showCreate && currentUser && (
        <CreatePostModal
          currentUser={currentUser}
          users={users}
          onClose={() => setShowCreate(false)}
          onCreatePost={handleCreatePost}
        />
      )}

      {loading && (
        <div className="text-[#B0B3B8] text-center py-6">
          <i className="fas fa-spinner fa-spin mr-2"></i>Loading feed...
        </div>
      )}

      {error && (
        <div className="bg-[#242526] border border-[#3E4042] rounded-xl p-4 text-[#ffb4b4] mb-4">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button className="text-[#1877F2] font-bold" onClick={fetchFeed}>
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !error && dedupedItems.length === 0 && (
        <div className="text-[#B0B3B8] text-center py-10">No posts yet.</div>
      )}

      {dedupedItems.map((it) => (
        <Post
          key={String(it.post.id)}
          post={it.post}
          author={it.author}
          currentUser={currentUser}
          users={users}
          onProfileClick={onProfileClick}
          onReact={handleReact}
          onShare={handleShare}
          onViewImage={handleViewImage}
          onOpenComments={(id) => {
            const pid = Number(id);
            setOpenCommentsFor(pid);

            // ✅ snapshot the post NOW (prevents blank when feed refreshes)
            const found = items.find((it) => Number(it?.post?.id) === pid);
            setCommentPostSnapshot(found?.post ?? null);
          }}
          onVideoClick={(p) => {
            const url = (p as any)?.media_url;
            if (url) window.open(url, '_blank');
          }}
        />
      ))}

      {activeCommentPost && currentUser && (
        <CommentsSheet
          post={activeCommentPost}
          currentUser={currentUser}
          users={users}
          onClose={() => {
            setOpenCommentsFor(null);
            setCommentPostSnapshot(null);
          }}
          getCachedComments={(postId) => commentsCacheRef.current.get(postId) ?? null}
          setCachedComments={(postId, commentsArr) => {
            commentsCacheRef.current.set(postId, commentsArr);
          }}
          onLocalCommentCountChange={(postId, newCount) => {
            setCommentCountForPost(postId, newCount);
          }}
        />
      )}

      {activeCommentPost && !currentUser && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setOpenCommentsFor(null);
              setCommentPostSnapshot(null);
            }}
          />
          <div className="bg-[#242526] border border-[#3E4042] rounded-xl p-6 z-10 text-center text-[#E4E6EB]">
            <p className="font-bold text-lg mb-2">Login required</p>
            <p className="text-[#B0B3B8]">Please login to view and write comments.</p>
            <button
              className="mt-4 bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold px-5 py-2 rounded-lg"
              onClick={() => {
                setOpenCommentsFor(null);
                setCommentPostSnapshot(null);
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
