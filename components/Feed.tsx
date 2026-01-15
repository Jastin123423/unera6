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

  const createdAtLabel = p.created_at
    ? new Date(p.created_at).toLocaleString()
    : 'Recently';

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
            onClick={() => onOpenComments(Number(postId))} // ✅ force number
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
          } // ✅ force number
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
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [visibility, setVisibility] = useState('Public');
  const [location, setLocation] = useState<string>('');
  const [feeling, setFeeling] = useState<string>('');
  const [background, setBackground] = useState<string>('');
  const [taggedUsers, setTaggedUsers] = useState<number[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSticker, setShowSticker] = useState(false);

  const linkPreview = useMemo(() => getLinkPreview(text), [text]);

  const close = () => {
    setShowEmoji(false);
    setShowSticker(false);
    onClose();
  };

  const handlePost = () => {
    const trimmed = text.trim();
    const hasText = !!trimmed;
    const hasBg = !!background;
    const hasFile = !!file;
    if (!hasText && !hasBg && !hasFile) return;

    onCreatePost(trimmed, file, {
      type: file ? (file.type.startsWith('image') ? 'image' : 'video') : 'text',
      visibility,
      location: location || undefined,
      feeling: feeling || undefined,
      taggedUsers,
      background: background || undefined,
      linkPreview,
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={close} />
      <div className="relative z-10 w-[95%] max-w-[560px] bg-[#242526] border border-[#3E4042] rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-[#3E4042] flex items-center justify-between">
          <div className="font-extrabold text-[#E4E6EB] text-[18px]">
            Create post
          </div>
          <button
            className="w-9 h-9 rounded-full hover:bg-[#3A3B3C] text-[#B0B3B8]"
            onClick={close}
            aria-label="Close"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <img
              src={
                (currentUser as any).profile_image_url ||
                (currentUser as any).profileImage ||
                (currentUser as any).avatar ||
                'https://ui-avatars.com/api/?name=User'
              }
              alt=""
              className="w-10 h-10 rounded-full object-cover border border-[#3E4042]"
            />
            <div className="min-w-0">
              <div className="font-bold text-[#E4E6EB] truncate">
                {(currentUser as any).name || (currentUser as any).username || 'User'}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="bg-[#3A3B3C] text-[#E4E6EB] text-[13px] px-2 py-1 rounded-md border border-[#3E4042]"
                >
                  <option>Public</option>
                  <option>Friends</option>
                  <option>Only me</option>
                </select>
                {feeling ? (
                  <span className="text-[#B0B3B8] text-[13px]">
                    feeling <span className="text-[#E4E6EB]">{feeling}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {!!background && !file ? (
            <div
              className="rounded-xl overflow-hidden border border-[#3E4042] mb-3"
              style={{ background, backgroundSize: 'cover' }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full h-[220px] bg-transparent text-white placeholder:text-white/70 p-4 text-[20px] font-bold outline-none resize-none"
              />
            </div>
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full min-h-[120px] bg-[#242526] text-[#E4E6EB] placeholder:text-[#B0B3B8] text-[18px] outline-none resize-none"
            />
          )}

          {linkPreview && !file && !background && (
            <div className="border border-[#3E4042] rounded-xl overflow-hidden mb-3">
              <div
                className="cursor-pointer hover:opacity-95"
                onClick={() => window.open(linkPreview.url, '_blank')}
              >
                <img
                  src={linkPreview.image}
                  alt=""
                  className="w-full h-40 object-cover"
                />
              </div>
              <div className="p-3 bg-[#3A3B3C]">
                <div className="text-[#B0B3B8] text-xs uppercase font-bold mb-1">
                  {linkPreview.domain}
                </div>
                <div className="text-[#E4E6EB] font-bold text-[16px] line-clamp-1">
                  {linkPreview.title}
                </div>
                <div className="text-[#B0B3B8] text-[13px] line-clamp-2">
                  {linkPreview.description}
                </div>
              </div>
            </div>
          )}

          {file && (
            <div className="border border-[#3E4042] rounded-xl p-3 mb-3 bg-[#1E1F20]">
              <div className="flex items-center justify-between">
                <div className="text-[#E4E6EB] font-semibold truncate">
                  {file.name}
                </div>
                <button
                  className="text-[#B0B3B8] hover:text-white"
                  onClick={() => setFile(null)}
                >
                  Remove
                </button>
              </div>
              {file.type.startsWith('image') ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt=""
                  className="mt-3 w-full max-h-[340px] object-contain rounded-lg"
                />
              ) : file.type.startsWith('video') ? (
                <video
                  src={URL.createObjectURL(file)}
                  className="mt-3 w-full max-h-[340px] rounded-lg"
                  controls
                />
              ) : null}
            </div>
          )}

          <div className="border border-[#3E4042] rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between">
              <div className="text-[#E4E6EB] font-bold">Add to your post</div>
              <div className="flex items-center gap-2">
                <button
                  className="w-9 h-9 rounded-full hover:bg-[#3A3B3C] text-[#45BD62]"
                  title="Photo/Video"
                  onClick={() => document.getElementById('unera_post_file')?.click()}
                >
                  <i className="fas fa-images" />
                </button>
                <button
                  className="w-9 h-9 rounded-full hover:bg-[#3A3B3C] text-[#F7B928]"
                  title="Feeling"
                  onClick={() => setFeeling((v) => (v ? '' : FEELINGS[0]))}
                >
                  <i className="far fa-smile" />
                </button>
                <button
                  className="w-9 h-9 rounded-full hover:bg-[#3A3B3C] text-[#1877F2]"
                  title="Emoji"
                  onClick={() => {
                    setShowEmoji((v) => !v);
                    setShowSticker(false);
                  }}
                >
                  <i className="far fa-laugh" />
                </button>
                <button
                  className="w-9 h-9 rounded-full hover:bg-[#3A3B3C] text-[#F3425F]"
                  title="Sticker"
                  onClick={() => {
                    setShowSticker((v) => !v);
                    setShowEmoji(false);
                  }}
                >
                  <i className="fas fa-sticky-note" />
                </button>
              </div>
            </div>

            <input
              id="unera_post_file"
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                if (f) setBackground('');
              }}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <div className="flex items-center gap-2 w-full">
                <i className="fas fa-map-marker-alt text-[#B0B3B8]" />
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="flex-1 bg-[#3A3B3C] text-[#E4E6EB] text-[13px] px-2 py-2 rounded-md border border-[#3E4042]"
                >
                  <option value="">Add location (optional)</option>
                  {(LOCATIONS_DATA || []).slice(0, 250).map((l: any) => (
                    <option key={String(l?.id ?? l?.name)} value={String(l?.name ?? l)}>
                      {String(l?.name ?? l)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 w-full">
                <i className="fas fa-user-tag text-[#B0B3B8]" />
                <select
                  multiple
                  value={taggedUsers.map(String)}
                  onChange={(e) => {
                    const vals = Array.from(e.target.selectedOptions).map((o) =>
                      Number(o.value)
                    );
                    setTaggedUsers(vals.filter((n) => Number.isFinite(n)));
                  }}
                  className="flex-1 bg-[#3A3B3C] text-[#E4E6EB] text-[13px] px-2 py-2 rounded-md border border-[#3E4042]"
                >
                  {(users || []).slice(0, 150).map((u: any) => (
                    <option key={safeUserId(u)} value={String(safeUserId(u))}>
                      {u?.name || u?.username || `User ${safeUserId(u)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full mt-2">
                <div className="text-[#B0B3B8] text-[13px] font-semibold mb-2">
                  Background (text posts)
                </div>
                <div className="flex flex-wrap gap-2">
                  {BACKGROUNDS.map((bg) => {
                    const active = background === bg.value;
                    return (
                      <button
                        key={bg.id}
                        className={`w-10 h-10 rounded-lg border ${
                          active ? 'border-[#1877F2]' : 'border-[#3E4042]'
                        }`}
                        style={{
                          background: bg.value || '#3A3B3C',
                          backgroundSize: 'cover',
                        }}
                        onClick={() => {
                          setBackground(bg.value);
                          if (bg.value) setFile(null);
                        }}
                        title={bg.id}
                      />
                    );
                  })}
                  <button
                    className="px-3 h-10 rounded-lg border border-[#3E4042] text-[#B0B3B8] hover:bg-[#3A3B3C]"
                    onClick={() => setBackground('')}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {feeling && (
                <div className="w-full mt-2">
                  <div className="text-[#B0B3B8] text-[13px] font-semibold mb-2">
                    Feeling
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {FEELINGS.map((f) => (
                      <button
                        key={f}
                        className={`px-3 py-1.5 rounded-full border text-[13px] ${
                          feeling === f
                            ? 'border-[#1877F2] text-[#E4E6EB]'
                            : 'border-[#3E4042] text-[#B0B3B8]'
                        } hover:bg-[#3A3B3C]`}
                        onClick={() => setFeeling(f)}
                      >
                        {f}
                      </button>
                    ))}
                    <button
                      className="px-3 py-1.5 rounded-full border border-[#3E4042] text-[#B0B3B8] hover:bg-[#3A3B3C] text-[13px]"
                      onClick={() => setFeeling('')}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            {(showEmoji || showSticker) && (
              <div className="mt-3 border-t border-[#3E4042] pt-3">
                {showEmoji && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <EmojiPicker
                      onSelect={(emoji: any) => {
                        const val = String(emoji?.native ?? emoji ?? '');
                        if (!val) return;
                        setText((t) => `${t}${val}`);
                      }}
                    />
                  </div>
                )}
                {showSticker && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <StickerPicker
                      onSelect={(sticker: any) => {
                        const url = String(sticker?.url ?? sticker ?? '');
                        if (!url) return;
                        setText((t) => `${t}\n${url}`);
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-extrabold py-2.5 rounded-lg disabled:opacity-50"
            onClick={handlePost}
            disabled={!text.trim() && !file && !background}
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * =========================
 * COMMENTS SHEET (WORKING)
 * =========================
 */
export const CommentsSheet: React.FC<{
  post: PostType;
  currentUser: User;
  users: User[];
  onClose: () => void;
  onComment?: (postId: number, text: string) => void;
  onLikeComment?: (commentId: number) => void;
  getCommentAuthor?: (id: number) => User | undefined;
  onProfileClick?: (id: number) => void;
}> = ({
  post,
  currentUser,
  users,
  onClose,
  onComment,
  onLikeComment,
  getCommentAuthor,
  onProfileClick,
}) => {
  const p: any = post as any;
  const comments = Array.isArray(p.comments) ? p.comments : [];
  const [text, setText] = useState('');

  const postId = safePostId(p);

  const resolveAuthor = (uid: any) => {
    const id = Number(uid ?? 0);
    if (getCommentAuthor) return getCommentAuthor(id);
    return users?.find((u: any) => safeUserId(u) === id);
  };

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    if (onComment) onComment(postId, t);
    setText('');
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full md:w-[680px] md:max-w-[92vw] bg-[#242526] border border-[#3E4042] rounded-t-2xl md:rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#3E4042] flex items-center justify-between">
          <div className="font-extrabold text-[#E4E6EB] text-[18px]">
            Comments
          </div>
          <button
            className="w-9 h-9 rounded-full hover:bg-[#3A3B3C] text-[#B0B3B8]"
            onClick={onClose}
          >
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
          {comments.length === 0 && (
            <div className="text-[#B0B3B8] text-center py-8">
              No comments yet. Be the first!
            </div>
          )}

          {comments.map((c: any) => {
            const author = resolveAuthor(c?.user_id ?? c?.author_id ?? c?.userId);
            const name =
              (author as any)?.name ||
              (author as any)?.username ||
              c?.author_name ||
              'User';
            const avatar =
              (author as any)?.profile_image_url ||
              (author as any)?.profileImage ||
              (author as any)?.avatar ||
              'https://ui-avatars.com/api/?name=User';

            return (
              <div key={String(c?.id ?? Math.random())} className="flex gap-2">
                <img
                  src={avatar}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover border border-[#3E4042] cursor-pointer"
                  onClick={() =>
                    onProfileClick && author ? onProfileClick(safeUserId(author)) : undefined
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="bg-[#3A3B3C] border border-[#3E4042] rounded-2xl px-3 py-2">
                    <div className="text-[#E4E6EB] font-bold text-[13px] truncate">
                      {name}
                    </div>
                    <div className="text-[#E4E6EB] text-[14px] whitespace-pre-wrap break-words">
                      {String(c?.text ?? c?.content ?? '')}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-1 ml-2 text-[#B0B3B8] text-[12px]">
                    {c?.created_at ? (
                      <span>{new Date(c.created_at).toLocaleString()}</span>
                    ) : null}
                    {onLikeComment && c?.id != null ? (
                      <button
                        className="hover:underline"
                        onClick={() => onLikeComment(Number(c.id))}
                      >
                        Like
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-[#3E4042]">
          <div className="flex items-center gap-2">
            <img
              src={
                (currentUser as any).profile_image_url ||
                (currentUser as any).profileImage ||
                (currentUser as any).avatar ||
                'https://ui-avatars.com/api/?name=User'
              }
              alt=""
              className="w-9 h-9 rounded-full object-cover border border-[#3E4042]"
            />
            <div className="flex-1 flex items-center gap-2 bg-[#3A3B3C] border border-[#3E4042] rounded-full px-3 py-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 bg-transparent outline-none text-[#E4E6EB] placeholder:text-[#B0B3B8]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <button
                className="text-[#1877F2] font-extrabold px-2"
                onClick={submit}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * =========================
 * SUGGESTED PRODUCTS WIDGET (WORKING SIMPLE)
 * =========================
 */
export const SuggestedProductsWidget: React.FC<{
  products: Product[];
  currentUser: User;
  onViewProduct: (product: Product) => void;
  onSeeAll: () => void;
}> = ({ products, onViewProduct, onSeeAll }) => {
  if (!products || products.length === 0) return null;

  return (
    <div className="bg-[#242526] border border-[#3E4042] rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[#E4E6EB] font-extrabold">Suggested Products</div>
        <button className="text-[#1877F2] font-bold" onClick={onSeeAll}>
          See all
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {products.slice(0, 4).map((p: any) => (
          <div
            key={String(p?.id ?? p?.name)}
            className="border border-[#3E4042] rounded-xl overflow-hidden cursor-pointer hover:bg-[#3A3B3C]"
            onClick={() => onViewProduct(p)}
          >
            <img
              src={p?.image || p?.image_url || 'https://via.placeholder.com/400x300'}
              alt=""
              className="w-full h-28 object-cover"
            />
            <div className="p-2">
              <div className="text-[#E4E6EB] font-bold text-[13px] line-clamp-1">
                {p?.name || 'Product'}
              </div>
              {p?.price != null && (
                <div className="text-[#B0B3B8] text-[12px]">
                  {String(p.price)}
                </div>
              )}
            </div>
          </div>
        ))}
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
      comment_count: x.comment_count,
      background: x.background ?? null,
      feeling: x.feeling ?? null,
      location: x.location ?? null,
      link_preview: x.link_preview ?? x.linkPreview ?? null,
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

  // ✅ store as number | null ONLY (prevents "0"/string bugs)
  const [openCommentsFor, setOpenCommentsFor] = useState<number | null>(null);

  const fetchFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      if (currentUser?.id) {
        const data = await apiFetch(
          `/api/feeds?userId=${safeUserId(currentUser)}&limit=20`
        );
        setItems(normalizeFeed(data?.feed ?? data ?? []));
      } else {
        const data = await apiFetch(`/api/posts?limit=20`);
        setItems(normalizeFeed(data ?? []));
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load feed');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
    const id = setInterval(fetchFeed, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

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

    try {
      await apiFetch('/api/posts', {
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

      setShowCreate(false);
      await fetchFeed();
    } catch (e: any) {
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
      }).catch(async () => {
        // fallback
        await apiFetch(`/api/posts/${Number(postId)}/react`, {
          method: 'POST',
          body: JSON.stringify({ type }),
        });
      });

      await fetchFeed();
    } catch {
      await fetchFeed();
    }
  };

  const handleComment = async (postId: number, text: string) => {
    if (!currentUser) return alert('Login first');
    const pid = Number(postId);
    const t = String(text ?? '').trim();
    if (!t) return;

    try {
      await apiFetch('/api/post-comments', {
        method: 'POST',
        body: JSON.stringify({
          post_id: pid,
          user_id: safeUserId(currentUser),
          text: t,
        }),
      }).catch(async () => {
        // fallback
        await apiFetch(`/api/posts/${pid}/comments`, {
          method: 'POST',
          body: JSON.stringify({ text: t }),
        });
      });

      await fetchFeed();
    } catch (e: any) {
      alert(e?.message || 'Failed to comment');
    }
  };

  const handleShare = async (postId: number) => {
    const link = `https://unera.social/posts/${Number(postId)}`;
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

  // ✅ FIXED: allow 0, block only null/undefined
  const activeCommentPost = useMemo(() => {
    if (openCommentsFor == null) return null; // ✅ allows 0
    const target = Number(openCommentsFor);
    const found = items.find((it) => Number(it?.post?.id) === target);
    return found?.post || null;
  }, [openCommentsFor, items]);

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

      {!loading && !error && items.length === 0 && (
        <div className="text-[#B0B3B8] text-center py-10">No posts yet.</div>
      )}

      {items.map((it) => (
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
          // ✅ FIXED: force numeric id into state
          onOpenComments={(id) => setOpenCommentsFor(Number(id))}
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
          onClose={() => setOpenCommentsFor(null)}
          onComment={handleComment}
          onProfileClick={onProfileClick}
        />
      )}

      {activeCommentPost && !currentUser && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpenCommentsFor(null)}
          />
          <div className="bg-[#242526] border border-[#3E4042] rounded-xl p-6 z-10 text-center text-[#E4E6EB]">
            <p className="font-bold text-lg mb-2">Login required</p>
            <p className="text-[#B0B3B8]">Please login to view and write comments.</p>
            <button
              className="mt-4 bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold px-5 py-2 rounded-lg"
              onClick={() => setOpenCommentsFor(null)}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
