// UserProfile.tsx - Complete production-ready version
// Fixed: Added named export alongside default export

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { 
  User, 
  Post as PostType, 
  ReactionType, 
  AudioTrack, 
  Group, 
  Brand 
} from '../types';

// ==================== TYPES ====================

export interface Reel {
  id: number;
  user_id: number;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  created_at?: string;
  user?: any;
  audio_url?: string;
  song_name?: string;
}

export interface Story {
  id: number;
  user_id: number;
  media_url: string;
  media_type: string;
  caption?: string;
  created_at?: string;
  expires_at?: string;
  views?: number;
  user?: any;
}

export interface UserProfileProps {
  user: User;
  currentUser: User | null;
  posts: PostType[];
  reels?: Reel[];
  stories?: Story[];
  photos?: any[];
  about?: any;
  followers?: User[];
  following?: User[];
  groups?: Group[];
  brands?: Brand[];
  users?: User[];
  onBack: () => void;
  onProfileClick: (id: number) => void;
  onFollow: (id: number) => void;
  onMessage: (id: number) => void;
  onReact: (postId: number, type: ReactionType) => void;
  onShare: (postId: number, newShareCount: number) => void;
  onDeletePost: (postId: number) => void;
  onEditPost: (postId: number, content: string) => void;
  onOpenComments: (postId: number) => void;
  onVideoClick: (post: PostType) => void;
  onPlayAudioTrack?: (track: AudioTrack) => void;
  onHashtagClick?: (tag: string) => void;
  onViewProductFromPost?: (productId: number) => void;
  onOpenGroup?: (groupId: number) => void;
  onOpenAudio?: (item: any) => void;
  onOpenReactions?: (postId: number) => void;
  onReelClick?: (reelId: number | string) => void;
  onStoryClick?: (storyId: number | string) => void;
  onCreatePost?: (content: string, files?: File[], meta?: any) => Promise<void>;
  onCreateReel?: () => void;
  onCreateStory?: () => void;
  onNavigateToReels?: () => void;
  onNavigateToCreateStory?: () => void;
  onNavigateToCreateEvent?: () => void;
}

interface MenuState {
  postId: number | null;
  isOpen: boolean;
}

// ==================== HELPER FUNCTIONS ====================

const safeArray = <T,>(arr: any): T[] => {
  return Array.isArray(arr) ? arr : [];
};

const safeNumber = (value: any, fallback: number = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const safeString = (value: any, fallback: string = ''): string => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const avatarFrom = (user: any): string => {
  if (!user) return 'https://ui-avatars.com/api/?name=User&background=1877F2&color=fff&bold=true';
  
  const img = String(
    user?.profile_image_url ||
    user?.profileImage ||
    user?.avatar ||
    user?.image ||
    user?.picture ||
    ''
  ).trim();

  if (img && img !== 'null' && img !== 'undefined') return img;

  const name = String(
    user?.name ||
    user?.username ||
    user?.full_name ||
    'User'
  ).trim();

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1877F2&color=fff&bold=true&size=128`;
};

const formatRelativeTime = (dateInput: any): string => {
  if (!dateInput) return 'Just now';

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Just now';

  const now = Date.now();
  const diffMs = Math.max(0, now - d.getTime());

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'Just now';

  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? '1 min' : `${min} mins`;

  const hrs = Math.floor(min / 60);
  if (hrs < 24) return hrs === 1 ? '1 hr' : `${hrs} hrs`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return days === 1 ? '1 day' : `${days} days`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return weeks === 1 ? '1 week' : `${weeks} weeks`;

  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month' : `${months} months`;

  const years = Math.floor(days / 365);
  return years === 1 ? '1 year' : `${years} years`;
};

const formatViewCount = (n?: number): string => {
  const v = safeNumber(n, 0);
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(v);
};

const normalizeReel = (reel: any): Reel => {
  return {
    id: safeNumber(reel?.id, 0),
    user_id: safeNumber(reel?.user_id, 0),
    video_url: safeString(reel?.video_url || reel?.video || reel?.media_url),
    thumbnail_url: safeString(reel?.thumbnail_url || reel?.thumbnail || reel?.cover_url),
    caption: safeString(reel?.caption || reel?.description),
    views: safeNumber(reel?.views_count || reel?.views || reel?.view_count, 0),
    likes: safeNumber(reel?.likes_count || reel?.likes, 0),
    comments: safeNumber(reel?.comments_count || reel?.comments, 0),
    shares: safeNumber(reel?.shares_count || reel?.shares, 0),
    created_at: safeString(reel?.created_at || reel?.createdAt),
    user: reel?.user || {},
    audio_url: safeString(reel?.audio_url || reel?.audioUrl),
    song_name: safeString(reel?.song_name || reel?.songName || reel?.song?.title)
  };
};

const normalizeStory = (story: any): Story => {
  return {
    id: safeNumber(story?.id, 0),
    user_id: safeNumber(story?.user_id, 0),
    media_url: safeString(story?.media_url || story?.image_url || story?.video_url),
    media_type: safeString(story?.media_type || story?.type || 'image'),
    caption: safeString(story?.caption || story?.text),
    created_at: safeString(story?.created_at || story?.createdAt),
    expires_at: safeString(story?.expires_at || story?.expiresAt),
    views: safeNumber(story?.views_count || story?.views, 0),
    user: story?.user || {}
  };
};

// ==================== ICON COMPONENTS ====================

const PlayIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const EyeIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const FilmIcon: React.FC<{ size?: number; color?: string }> = ({ size = 48, color = "#3A3B3C" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
    <line x1="7" y1="2" x2="7" y2="22" />
    <line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="7" x2="7" y2="7" />
    <line x1="2" y1="17" x2="7" y2="17" />
    <line x1="17" y1="17" x2="22" y2="17" />
    <line x1="17" y1="7" x2="22" y2="7" />
  </svg>
);

const StoryIcon: React.FC<{ size?: number; color?: string }> = ({ size = 48, color = "#3A3B3C" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="10 8 16 12 10 16 10 8" />
  </svg>
);

const MoreHorizontalIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = "#E4E6EB" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

// ==================== POST CARD COMPONENT (MINI VERSION) ====================

interface PostCardProps {
  post: PostType;
  author: User;
  currentUser: User | null;
  onProfileClick: (id: number) => void;
  onReact: (postId: number, type: ReactionType) => void;
  onShare: (postId: number, newShareCount: number) => void;
  onDelete?: (postId: number) => void;
  onEdit?: (post: PostType) => void;
  onOpenComments: (postId: number) => void;
  onVideoClick: (post: PostType) => void;
  onHashtagClick?: (tag: string) => void;
  showMenu?: boolean;
  onMenuToggle?: (postId: number | null) => void;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  author,
  currentUser,
  onProfileClick,
  onReact,
  onShare,
  onDelete,
  onEdit,
  onOpenComments,
  onVideoClick,
  onHashtagClick,
  showMenu = false,
  onMenuToggle
}) => {
  const [showShareSheet, setShowShareSheet] = useState(false);
  const isOwnPost = currentUser?.id === post.user_id;

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onMenuToggle) {
      onMenuToggle(showMenu ? null : post.id);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onEdit) {
      onEdit(post);
    }
    if (onMenuToggle) {
      onMenuToggle(null);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onDelete && window.confirm('Are you sure you want to delete this post?')) {
      onDelete(post.id);
    }
    if (onMenuToggle) {
      onMenuToggle(null);
    }
  };

  const mediaUrl = post.media_url || (post.media_urls && post.media_urls[0]);
  const hasMedia = !!mediaUrl;

  return (
    <div className="bg-[#242526] rounded-xl border border-[#3E4042] overflow-hidden mb-4">
      {/* Post Header */}
      <div className="p-4 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => onProfileClick(author.id)}
        >
          <img
            src={avatarFrom(author)}
            alt={author.name}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div>
            <h4 className="text-[#E4E6EB] font-semibold hover:underline">
              {author.name}
            </h4>
            <p className="text-[#B0B3B8] text-xs">
              {formatRelativeTime(post.created_at)}
            </p>
          </div>
        </div>

        {/* Three dots menu for own posts */}
        {isOwnPost && (
          <div className="relative">
            <button
              onClick={handleMenuClick}
              className="p-2 rounded-full hover:bg-[#3A3B3C] transition-colors"
              aria-label="Post options"
            >
              <MoreHorizontalIcon size={20} />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-[#242526] border border-[#3E4042] rounded-lg shadow-lg z-50">
                <button
                  onClick={handleEditClick}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-[#3A3B3C] text-left text-[#E4E6EB]"
                >
                  <i className="fas fa-edit text-[#1877F2] w-5"></i>
                  <span>Edit Post</span>
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-[#3A3B3C] text-left text-red-400"
                >
                  <i className="fas fa-trash w-5"></i>
                  <span>Delete Post</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post Content */}
      {post.content && (
        <div className="px-4 pb-3">
          <p className="text-[#E4E6EB] whitespace-pre-wrap break-words">
            {post.content}
          </p>
        </div>
      )}

      {/* Post Media */}
      {hasMedia && (
        <div 
          className="relative bg-black cursor-pointer"
          onClick={() => post.media_type?.includes('video') ? onVideoClick(post) : null}
        >
          {post.media_type?.includes('video') ? (
            <div className="relative">
              <video
                src={mediaUrl}
                className="w-full max-h-[500px] object-contain"
                preload="metadata"
                muted
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                  <PlayIcon size={30} />
                </div>
              </div>
            </div>
          ) : (
            <img
              src={mediaUrl}
              alt="Post content"
              className="w-full max-h-[500px] object-contain"
              loading="lazy"
            />
          )}
        </div>
      )}

      {/* Post Stats */}
      <div className="px-4 py-3 flex items-center justify-between text-[#B0B3B8] text-sm border-t border-[#3E4042]">
        <div className="flex items-center gap-2">
          {post.reactions_count > 0 && (
            <>
              <i className="fas fa-thumbs-up text-[#1877F2]"></i>
              <span>{post.reactions_count}</span>
            </>
          )}
        </div>
        <div className="flex gap-4">
          {post.comments_count > 0 && (
            <span>{post.comments_count} comments</span>
          )}
          {post.shares_count > 0 && (
            <span>{post.shares_count} shares</span>
          )}
        </div>
      </div>

      {/* Post Actions */}
      <div className="flex items-center justify-around py-1 border-t border-[#3E4042]">
        <button
          onClick={() => onReact(post.id, 'like')}
          className="flex-1 py-2 hover:bg-[#3A3B3C] rounded transition-colors"
        >
          <i className="fas fa-thumbs-up mr-2"></i>
          Like
        </button>
        <button
          onClick={() => onOpenComments(post.id)}
          className="flex-1 py-2 hover:bg-[#3A3B3C] rounded transition-colors"
        >
          <i className="fas fa-comment mr-2"></i>
          Comment
        </button>
        <button
          onClick={() => setShowShareSheet(true)}
          className="flex-1 py-2 hover:bg-[#3A3B3C] rounded transition-colors"
        >
          <i className="fas fa-share mr-2"></i>
          Share
        </button>
      </div>

      {/* Share Sheet Modal */}
      {showShareSheet && (
        <ShareSheet
          post={post}
          currentUser={currentUser}
          onClose={() => setShowShareSheet(false)}
          onShare={(destination) => {
            onShare(post.id, (post.shares_count || 0) + 1);
            setShowShareSheet(false);
          }}
        />
      )}
    </div>
  );
};

// ==================== SHARE SHEET COMPONENT ====================

interface ShareSheetProps {
  post: PostType;
  currentUser: User | null;
  onClose: () => void;
  onShare: (destination: string) => void;
}

const ShareSheet: React.FC<ShareSheetProps> = ({ post, currentUser, onClose, onShare }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (backdropRef.current && e.target === backdropRef.current) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const shareOptions = [
    { id: 'feed', icon: 'fa-newspaper', label: 'Share to Feed', color: '#1877F2' },
    { id: 'story', icon: 'fa-clock', label: 'Share to Story', color: '#F7B928' },
    { id: 'message', icon: 'fa-comment-dots', label: 'Send as Message', color: '#45BD62' },
    { id: 'whatsapp', icon: 'fa-whatsapp', label: 'Share on WhatsApp', color: '#25D366' },
    { id: 'copy', icon: 'fa-link', label: 'Copy Link', color: '#B0B3B8' },
  ];

  const handleShareClick = (option: typeof shareOptions[0]) => {
    if (option.id === 'copy') {
      navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
      alert('Link copied to clipboard!');
    } else {
      onShare(option.id);
    }
    onClose();
  };

  return (
    <>
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/60 z-[300]"
      />

      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-[301] bg-[#242526] rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col"
      >
        <div className="p-4 pb-2">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 bg-[#3E4042] rounded-full" />
          </div>

          <h3 className="text-[#E4E6EB] text-xl font-bold mb-4">Share Post</h3>

          <div className="space-y-1">
            {shareOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleShareClick(option)}
                className="w-full flex items-center gap-4 p-4 hover:bg-[#3A3B3C] rounded-xl transition-colors"
              >
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${option.color}20` }}
                >
                  <i className={`fas ${option.icon} text-2xl`} style={{ color: option.color }} />
                </div>
                <span className="text-[#E4E6EB] font-medium text-lg">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 pt-3 border-t border-[#3E4042] mt-2">
          <button
            onClick={onClose}
            className="w-full py-4 bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] font-semibold rounded-xl transition-colors text-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};

// ==================== EDIT POST MODAL ====================

interface EditPostModalProps {
  post: PostType;
  onSave: (postId: number, content: string) => void;
  onClose: () => void;
}

const EditPostModal: React.FC<EditPostModalProps> = ({ post, onSave, onClose }) => {
  const [content, setContent] = useState(post.content || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onSave(post.id, content);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#242526] rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-[#3E4042]">
          <h3 className="text-[#E4E6EB] text-xl font-bold">Edit Post</h3>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-[#3A3B3C] flex items-center justify-center"
          >
            <i className="fas fa-times text-[#B0B3B8] text-xl" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-[#3A3B3C] text-[#E4E6EB] rounded-lg p-4 min-h-[200px] outline-none focus:ring-2 focus:ring-[#1877F2] resize-none"
            placeholder="What's on your mind?"
            autoFocus
          />

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-[#3A3B3C] text-[#E4E6EB] rounded-lg font-semibold hover:bg-[#4E4F50] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim()}
              className="flex-1 py-3 bg-[#1877F2] text-white rounded-lg font-semibold hover:bg-[#166FE5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==================== CREATE POST MODAL (MINI) ====================

interface CreatePostModalProps {
  currentUser: User;
  users: User[];
  onClose: () => void;
  onCreatePost: (content: string, files?: File[], meta?: any) => Promise<void>;
  onCreateEventClick?: () => void;
  onOpenRecorder?: () => void;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({
  currentUser,
  users,
  onClose,
  onCreatePost,
  onCreateEventClick,
  onOpenRecorder
}) => {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      previews.forEach(URL.revokeObjectURL);
    };
  }, [previews]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setFiles(selectedFiles);
    const newPreviews = selectedFiles.map(f => URL.createObjectURL(f));
    setPreviews(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && files.length === 0) return;

    setIsSubmitting(true);
    try {
      await onCreatePost(content, files);
      onClose();
    } catch (error) {
      console.error('Failed to create post:', error);
      alert('Failed to create post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const options = [
    { icon: 'fa-image', label: 'Photo/Video', color: '#45BD62', onClick: () => fileInputRef.current?.click() },
    { icon: 'fa-camera', label: 'Reel', color: '#F3425F', onClick: onOpenRecorder },
    { icon: 'fa-calendar-alt', label: 'Event', color: '#F7B928', onClick: onCreateEventClick },
  ];

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#242526] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#3E4042]">
          <h3 className="text-[#E4E6EB] text-xl font-bold">Create Post</h3>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-[#3A3B3C] flex items-center justify-center"
          >
            <i className="fas fa-times text-[#B0B3B8] text-xl" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={avatarFrom(currentUser)}
                alt={currentUser.name}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <h4 className="text-[#E4E6EB] font-semibold">{currentUser.name}</h4>
                <div className="bg-[#3A3B3C] px-2 py-1 rounded-lg text-xs text-[#B0B3B8] inline-flex items-center gap-1">
                  <i className="fas fa-globe-americas" />
                  <span>Public</span>
                </div>
              </div>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-transparent text-[#E4E6EB] text-xl outline-none resize-none min-h-[120px] placeholder-[#B0B3B8]"
              placeholder={`What's on your mind, ${currentUser.name.split(' ')[0]}?`}
              autoFocus
            />

            {previews.length > 0 && (
              <div className="mt-4 relative">
                <button
                  onClick={() => {
                    setFiles([]);
                    setPreviews([]);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center z-10"
                >
                  <i className="fas fa-times text-white" />
                </button>
                <div className={`grid gap-1 ${previews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {previews.slice(0, 4).map((src, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden">
                      <img src={src} className="w-full h-full object-cover" alt="" />
                    </div>
                  ))}
                  {previews.length > 4 && (
                    <div className="aspect-square bg-[#3A3B3C] rounded-lg flex items-center justify-center">
                      <span className="text-[#E4E6EB] text-xl font-bold">+{previews.length - 4}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 p-3 border border-[#3E4042] rounded-lg">
              <p className="text-[#B0B3B8] text-sm mb-2">Add to your post</p>
              <div className="flex gap-2">
                {options.map((option, index) => (
                  <button
                    key={index}
                    onClick={option.onClick}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[#3A3B3C] rounded-lg transition-colors"
                  >
                    <i className={`fas ${option.icon} text-xl`} style={{ color: option.color }} />
                    <span className="text-[#E4E6EB] text-sm hidden sm:inline">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#3E4042]">
          <button
            onClick={handleSubmit}
            disabled={(!content.trim() && files.length === 0) || isSubmitting}
            className="w-full py-3 bg-[#1877F2] text-white rounded-lg font-semibold hover:bg-[#166FE5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <i className="fas fa-spinner fa-spin" />
            ) : (
              'Post'
            )}
          </button>
        </div>
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
};

// ==================== GALLERY VIEWER COMPONENT ====================

interface GalleryViewerProps {
  isOpen: boolean;
  urls: string[];
  startIndex: number;
  onClose: () => void;
  postId: number;
  currentUser: User | null;
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  myReaction?: ReactionType;
  onReact: (type: ReactionType) => void;
  onOpenComments: () => void;
  onShare: () => void;
  onOpenReactions?: () => void;
}

const GalleryViewer: React.FC<GalleryViewerProps> = ({
  isOpen,
  urls,
  startIndex,
  onClose,
  postId,
  currentUser,
  reactionCount,
  commentCount,
  shareCount,
  myReaction,
  onReact,
  onOpenComments,
  onShare,
  onOpenReactions
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  useEffect(() => {
    if (!isOpen) return;
    
    document.body.style.overflow = 'hidden';
    setCurrentIndex(startIndex);

    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const w = el.clientWidth || window.innerWidth;
      el.scrollTo({ left: startIndex * w, behavior: 'instant' as any });
    });

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, startIndex]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const width = el.clientWidth || window.innerWidth;
    const newIndex = Math.round(scrollLeft / width);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-black/40">
        <div className="text-white text-sm font-semibold">
          {currentIndex + 1}/{urls.length}
        </div>
        <button
          className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
          <i className="fas fa-times text-white text-lg" />
        </button>
      </div>

      {/* Images */}
      <div
        ref={scrollerRef}
        className="flex-1 w-full overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => e.stopPropagation()}
        onScroll={handleScroll}
      >
        {urls.map((url, i) => (
          <div
            key={url + i}
            className="min-w-full h-full snap-center flex items-center justify-center bg-black"
          >
            <img
              src={url}
              alt=""
              className="max-w-full max-h-full object-contain"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== MAIN USER PROFILE COMPONENT ====================

const UserProfileComponent: React.FC<UserProfileProps> = ({
  user,
  currentUser,
  posts = [],
  reels = [],
  stories = [],
  photos = [],
  about,
  followers = [],
  following = [],
  groups = [],
  brands = [],
  users = [],
  onBack,
  onProfileClick,
  onFollow,
  onMessage,
  onReact,
  onShare,
  onDeletePost,
  onEditPost,
  onOpenComments,
  onVideoClick,
  onPlayAudioTrack,
  onHashtagClick,
  onViewProductFromPost,
  onOpenGroup,
  onOpenAudio,
  onOpenReactions,
  onReelClick,
  onStoryClick,
  onCreatePost,
  onCreateReel,
  onCreateStory,
  onNavigateToReels,
  onNavigateToCreateStory,
  onNavigateToCreateEvent
}) => {
  const [activeTab, setActiveTab] = useState<'Posts' | 'Videos' | 'Stories' | 'Photos' | 'About' | 'Followers'>('Posts');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPost, setEditingPost] = useState<PostType | null>(null);
  const [openMenuPostId, setOpenMenuPostId] = useState<number | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Filter user's content
  const userPosts = useMemo(() => {
    return safeArray<PostType>(posts).filter(p => Number(p.user_id) === Number(user.id));
  }, [posts, user.id]);

  const userReels = useMemo(() => {
    return safeArray<any>(reels)
      .filter(r => Number(r.user_id) === Number(user.id))
      .map(normalizeReel);
  }, [reels, user.id]);

  const userStories = useMemo(() => {
    return safeArray<any>(stories)
      .filter(s => Number(s.user_id) === Number(user.id))
      .map(normalizeStory);
  }, [stories, user.id]);

  const userPhotosList = useMemo(() => {
    return safeArray<any>(photos).filter(p => Number(p.user_id) === Number(user.id));
  }, [photos, user.id]);

  const isOwnProfile = currentUser?.id === user.id;

  const handleEditPost = (post: PostType) => {
    setEditingPost(post);
    setShowEditModal(true);
    setOpenMenuPostId(null);
  };

  const handleSaveEdit = (postId: number, content: string) => {
    onEditPost(postId, content);
    setShowEditModal(false);
    setEditingPost(null);
  };

  const handleMenuToggle = (postId: number | null) => {
    setOpenMenuPostId(postId);
  };

  const handleCreatePost = async (content: string, files?: File[], meta?: any) => {
    if (onCreatePost) {
      await onCreatePost(content, files, meta);
    }
  };

  const openGallery = (urls: string[], index: number) => {
    setGalleryUrls(urls);
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  // ==================== RENDER FUNCTIONS ====================

  const renderEmptyState = (icon: React.ReactNode, title: string, action?: React.ReactNode) => (
    <div className="bg-[#242526] p-8 rounded-xl border border-[#3E4042] mx-4 md:mx-0 text-center">
      <div className="mb-4">{icon}</div>
      <p className="text-[#B0B3B8] text-lg mb-4">{title}</p>
      {action}
    </div>
  );

  const renderPosts = () => {
    if (userPosts.length === 0) {
      return renderEmptyState(
        <i className="fas fa-file-alt text-5xl text-[#3A3B3C]" />,
        'No posts yet',
        isOwnProfile && (
          <button
            onClick={() => setShowCreatePost(true)}
            className="px-6 py-2 bg-[#1877F2] text-white rounded-lg font-semibold hover:bg-[#166FE5] transition-colors"
          >
            Create your first post
          </button>
        )
      );
    }

    return (
      <div className="px-4 md:px-0 space-y-4">
        {userPosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            author={user}
            currentUser={currentUser}
            onProfileClick={onProfileClick}
            onReact={onReact}
            onShare={onShare}
            onDelete={isOwnProfile ? onDeletePost : undefined}
            onEdit={handleEditPost}
            onOpenComments={onOpenComments}
            onVideoClick={onVideoClick}
            onHashtagClick={onHashtagClick}
            showMenu={openMenuPostId === post.id}
            onMenuToggle={handleMenuToggle}
          />
        ))}
      </div>
    );
  };

  const renderVideos = () => {
    if (userReels.length === 0) {
      return renderEmptyState(
        <FilmIcon size={48} color="#3A3B3C" />,
        'No videos yet',
        isOwnProfile && (
          <button
            onClick={onCreateReel || onNavigateToReels || (() => {})}
            className="px-6 py-2 bg-[#1877F2] text-white rounded-lg font-semibold hover:bg-[#166FE5] transition-colors"
          >
            Create your first reel
          </button>
        )
      );
    }

    return (
      <div className="bg-[#242526] p-2 rounded-xl border border-[#3E4042] mx-4 md:mx-0">
        <div className="grid grid-cols-3 gap-[2px]">
          {userReels.map((reel) => (
            <div
              key={reel.id}
              className="aspect-[9/16] bg-black relative cursor-pointer group"
              onClick={() => onReelClick?.(reel.id)}
            >
              {reel.thumbnail_url ? (
                <img
                  src={reel.thumbnail_url}
                  alt={reel.caption || 'Reel thumbnail'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <video
                  src={reel.video_url}
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/30">
                  <PlayIcon size={18} />
                </div>
              </div>

              <div className="absolute bottom-2 left-2 text-white text-xs font-bold flex items-center gap-1 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded">
                <EyeIcon size={14} />
                <span>{formatViewCount(reel.views)}</span>
              </div>

              {reel.song_name && (
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-white text-xs flex items-center gap-1">
                  <i className="fas fa-music text-[10px]" />
                  <span className="max-w-[80px] truncate">{reel.song_name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStories = () => {
    if (userStories.length === 0) {
      return renderEmptyState(
        <StoryIcon size={48} color="#3A3B3C" />,
        'No stories yet',
        isOwnProfile && (
          <button
            onClick={onCreateStory || onNavigateToCreateStory || (() => {})}
            className="px-6 py-2 bg-[#1877F2] text-white rounded-lg font-semibold hover:bg-[#166FE5] transition-colors"
          >
            Create your first story
          </button>
        )
      );
    }

    return (
      <div className="bg-[#242526] p-2 rounded-xl border border-[#3E4042] mx-4 md:mx-0">
        <div className="grid grid-cols-3 gap-[2px]">
          {userStories.map((story) => {
            const isVideo = story.media_type.includes('video');

            return (
              <div
                key={story.id}
                className="aspect-[9/16] bg-black relative cursor-pointer group"
                onClick={() => onStoryClick?.(story.id)}
              >
                {isVideo ? (
                  <video
                    src={story.media_url}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={story.media_url}
                    alt={story.caption || 'Story'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {isVideo && (
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-white text-xs flex items-center gap-1">
                    <PlayIcon size={10} />
                    <span>Video</span>
                  </div>
                )}

                {story.caption && (
                  <div className="absolute bottom-2 left-2 right-2 text-white text-xs font-medium line-clamp-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded">
                    {story.caption}
                  </div>
                )}

                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded text-white text-xs">
                  {formatRelativeTime(story.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPhotos = () => {
    if (userPhotosList.length === 0) {
      return renderEmptyState(
        <i className="fas fa-images text-5xl text-[#3A3B3C]" />,
        'No photos yet'
      );
    }

    return (
      <div className="bg-[#242526] p-2 rounded-xl border border-[#3E4042] mx-4 md:mx-0">
        <div className="grid grid-cols-3 gap-[2px]">
          {userPhotosList.map((photo, index) => (
            <div
              key={photo.id}
              className="aspect-square bg-[#3A3B3C] relative cursor-pointer group"
              onClick={() => openGallery(
                userPhotosList.map(p => p.media_url || p.image_url).filter(Boolean),
                index
              )}
            >
              <img
                src={photo.media_url || photo.image_url}
                alt={photo.caption || 'Photo'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <i className="fas fa-search-plus text-white text-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAbout = () => {
    if (!about || Object.keys(about).length === 0) {
      return renderEmptyState(
        <i className="fas fa-info-circle text-5xl text-[#3A3B3C]" />,
        'No about information'
      );
    }

    return (
      <div className="bg-[#242526] p-6 rounded-xl border border-[#3E4042] mx-4 md:mx-0">
        <h3 className="text-[#E4E6EB] text-xl font-bold mb-4">About</h3>
        
        {about.bio && (
          <div className="mb-6">
            <p className="text-[#B0B3B8] text-sm mb-1">Bio</p>
            <p className="text-[#E4E6EB]">{about.bio}</p>
          </div>
        )}

        <div className="space-y-4">
          {about.work && (
            <div className="flex items-start gap-3">
              <i className="fas fa-briefcase text-[#B0B3B8] w-5 mt-1" />
              <div>
                <p className="text-[#B0B3B8] text-sm">Work</p>
                <p className="text-[#E4E6EB]">{about.work}</p>
              </div>
            </div>
          )}

          {about.education && (
            <div className="flex items-start gap-3">
              <i className="fas fa-graduation-cap text-[#B0B3B8] w-5 mt-1" />
              <div>
                <p className="text-[#B0B3B8] text-sm">Education</p>
                <p className="text-[#E4E6EB]">{about.education}</p>
              </div>
            </div>
          )}

          {about.location && (
            <div className="flex items-start gap-3">
              <i className="fas fa-map-marker-alt text-[#B0B3B8] w-5 mt-1" />
              <div>
                <p className="text-[#B0B3B8] text-sm">Location</p>
                <p className="text-[#E4E6EB]">{about.location}</p>
              </div>
            </div>
          )}

          {about.website && (
            <div className="flex items-start gap-3">
              <i className="fas fa-link text-[#B0B3B8] w-5 mt-1" />
              <div>
                <p className="text-[#B0B3B8] text-sm">Website</p>
                <a 
                  href={about.website.startsWith('http') ? about.website : `https://${about.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1877F2] hover:underline"
                >
                  {about.website}
                </a>
              </div>
            </div>
          )}

          {about.joined && (
            <div className="flex items-start gap-3">
              <i className="fas fa-calendar-alt text-[#B0B3B8] w-5 mt-1" />
              <div>
                <p className="text-[#B0B3B8] text-sm">Joined</p>
                <p className="text-[#E4E6EB]">{new Date(about.joined).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFollowers = () => {
    const combined = [...followers, ...following].filter(
      (v, i, a) => a.findIndex(t => t.id === v.id) === i
    );

    if (combined.length === 0) {
      return renderEmptyState(
        <i className="fas fa-users text-5xl text-[#3A3B3C]" />,
        'No connections yet'
      );
    }

    return (
      <div className="bg-[#242526] rounded-xl border border-[#3E4042] mx-4 md:mx-0 overflow-hidden">
        <div className="p-4 border-b border-[#3E4042]">
          <h3 className="text-[#E4E6EB] text-lg font-bold">Followers & Following</h3>
        </div>
        <div className="divide-y divide-[#3E4042] max-h-[600px] overflow-y-auto">
          {combined.map((person) => (
            <div
              key={person.id}
              className="flex items-center justify-between p-4 hover:bg-[#3A3B3C] cursor-pointer transition-colors"
              onClick={() => onProfileClick(person.id)}
            >
              <div className="flex items-center gap-3">
                <img
                  src={avatarFrom(person)}
                  alt={person.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <p className="text-[#E4E6EB] font-semibold">{person.name}</p>
                  <p className="text-[#B0B3B8] text-sm">@{person.username}</p>
                </div>
              </div>

              {currentUser && person.id !== currentUser.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFollow(person.id);
                  }}
                  className="px-4 py-1.5 bg-[#1877F2] text-white rounded-lg text-sm font-semibold hover:bg-[#166FE5] transition-colors"
                >
                  Follow
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ==================== MAIN RENDER ====================

  const tabs = ['Posts', 'Videos', 'Stories', 'Photos', 'About', 'Followers'] as const;

  return (
    <div className="min-h-screen bg-[#18191A] text-[#E4E6EB] font-sans">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#242526] border-b border-[#3E4042] px-4 py-3 flex items-center gap-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full hover:bg-[#3A3B3C] flex items-center justify-center transition-colors"
          aria-label="Go back"
        >
          <i className="fas fa-arrow-left text-xl" />
        </button>
        <h1 className="text-xl font-bold truncate">{user.name}</h1>
      </div>

      {/* Profile Header */}
      <div className="relative">
        {/* Cover Photo */}
        <div className="h-48 md:h-64 bg-gradient-to-r from-[#1877F2] to-[#166FE5] relative">
          {user.cover_photo && (
            <img
              src={user.cover_photo}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Profile Picture */}
          <div className="absolute -bottom-16 left-4 md:left-8">
            <div className="relative">
              <img
                src={avatarFrom(user)}
                alt={user.name}
                className="w-32 h-32 rounded-full border-4 border-[#242526] object-cover"
              />
              {user.is_verified && (
                <i className="fas fa-check-circle absolute bottom-2 right-2 text-[#1877F2] text-xl bg-[#242526] rounded-full" />
              )}
            </div>
          </div>
        </div>

        {/* Profile Actions */}
        <div className="pt-20 px-4 pb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{user.name}</h2>
            <p className="text-[#B0B3B8]">@{user.username}</p>
            {user.bio && <p className="mt-2 text-[#B0B3B8] max-w-2xl">{user.bio}</p>}
          </div>

          <div className="flex gap-2">
            {!isOwnProfile && currentUser && (
              <>
                <button
                  onClick={() => onFollow(user.id)}
                  className="px-6 py-2 bg-[#1877F2] text-white rounded-lg font-semibold hover:bg-[#166FE5] transition-colors"
                >
                  Follow
                </button>
                <button
                  onClick={() => onMessage(user.id)}
                  className="px-6 py-2 bg-[#3A3B3C] text-white rounded-lg font-semibold hover:bg-[#4E4F50] transition-colors"
                >
                  Message
                </button>
              </>
            )}
            {isOwnProfile && (
              <button
                onClick={() => setShowCreatePost(true)}
                className="px-6 py-2 bg-[#1877F2] text-white rounded-lg font-semibold hover:bg-[#166FE5] transition-colors"
              >
                <i className="fas fa-plus mr-2" />
                Create Post
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 px-4 py-3 border-t border-[#3E4042]">
          <div>
            <span className="font-bold">{userPosts.length}</span>
            <span className="text-[#B0B3B8] ml-1">posts</span>
          </div>
          <div>
            <span className="font-bold">{followers.length}</span>
            <span className="text-[#B0B3B8] ml-1">followers</span>
          </div>
          <div>
            <span className="font-bold">{following.length}</span>
            <span className="text-[#B0B3B8] ml-1">following</span>
          </div>
        </div>

        {/* Scrollable Tabs */}
        <div className="border-b border-[#3E4042]">
          <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide px-4">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-semibold text-[15px] transition-colors relative ${
                  activeTab === tab
                    ? 'text-[#1877F2]'
                    : 'text-[#B0B3B8] hover:text-[#E4E6EB]'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1877F2]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="py-4">
        {activeTab === 'Posts' && renderPosts()}
        {activeTab === 'Videos' && renderVideos()}
        {activeTab === 'Stories' && renderStories()}
        {activeTab === 'Photos' && renderPhotos()}
        {activeTab === 'About' && renderAbout()}
        {activeTab === 'Followers' && renderFollowers()}
      </div>

      {/* Modals */}
      {showCreatePost && (
        <CreatePostModal
          currentUser={currentUser!}
          users={users}
          onClose={() => setShowCreatePost(false)}
          onCreatePost={handleCreatePost}
          onCreateEventClick={onNavigateToCreateEvent || (() => {})}
          onOpenRecorder={onNavigateToReels || (() => {})}
        />
      )}

      {showEditModal && editingPost && (
        <EditPostModal
          post={editingPost}
          onSave={handleSaveEdit}
          onClose={() => {
            setShowEditModal(false);
            setEditingPost(null);
          }}
        />
      )}

      {/* Gallery Viewer */}
      {galleryOpen && (
        <GalleryViewer
          isOpen={galleryOpen}
          urls={galleryUrls}
          startIndex={galleryIndex}
          onClose={() => setGalleryOpen(false)}
          postId={0}
          currentUser={currentUser}
          reactionCount={0}
          commentCount={0}
          shareCount={0}
          onReact={() => {}}
          onOpenComments={() => {}}
          onShare={() => {}}
        />
      )}

      {/* CSS for hiding scrollbar */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

// ==================== EXPORTS ====================

// Export both as default and named export for compatibility
export const UserProfile = UserProfileComponent;
export default UserProfileComponent;
