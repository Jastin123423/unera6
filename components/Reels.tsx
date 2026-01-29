// Feed.tsx - Professionally Updated
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  User,
  Post as PostType,
  ReactionType,
  Comment,
  Group,
  Brand,
  AudioTrack,
  Product,
} from '../types';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  MoreVertical, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  X,
  Send,
  Image as ImageIcon,
  Video,
  Music,
  Link,
  MapPin,
  Smile,
  Users,
  Globe,
  Lock,
  User as UserIcon,
  ThumbsUp,
  Heart as HeartSolid,
  Share
} from 'lucide-react';

// ==================== TYPE DEFINITIONS ====================

interface FeedPostProps {
  post: PostType;
  author: User;
  currentUser: User | null;
  users: User[];
  onProfileClick: (id: number) => void;
  onReact: (postId: number, type: ReactionType) => void;
  onShare: (post: PostType) => void;
  onViewImage: (url: string) => void;
  onOpenComments: (postId: number) => void;
  onVideoClick: (post: PostType) => void;
  onPlayAudioTrack: (track: AudioTrack) => void;
  groups: Group[];
  brands: Brand[];
  chats: any[];
  onHashtagClick?: (tag: string) => void;
  onFollow: (userId: number) => void;
  isFollowing: boolean;
  followLoading: boolean;
}

interface CreatePostProps {
  currentUser: User;
  onProfileClick: (id: number) => void;
  onClick: () => void;
}

interface CreatePostModalProps {
  currentUser: User;
  users: User[];
  onClose: () => void;
  onCreatePost: (text: string, files: File[] | File | null, meta?: any) => void;
}

interface CommentsSheetProps {
  post: PostType;
  currentUser: User | null;
  users: User[];
  onClose: () => void;
  onComment: () => void;
  onLikeComment: (commentId: number) => void;
  getCommentAuthor: (id: number) => User | undefined;
  onProfileClick: (id: number) => void;
  onHashtagClick?: (tag: string) => void;
  onFollow: (userId: number) => void;
  checkIsFollowing: (userId: number) => boolean;
}

interface ShareBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  post: PostType;
  currentUser: User | null;
  users: User[];
  groups: Group[];
  brands: Brand[];
  chats: any[];
  onShareComplete: (destination: string, data?: any) => void;
  onFollow: (userId: number) => void;
  checkIsFollowing: (userId: number) => boolean;
}

// ==================== UTILITY FUNCTIONS ====================

const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const formatCount = (num: number): string => {
  if (!num && num !== 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
  return `${Math.floor(diffDays / 365)}y`;
};

// ==================== REACTION BUTTON COMPONENT ====================

const ReactionButton: React.FC<{
  type: ReactionType;
  count: number;
  active: boolean;
  onClick: () => void;
}> = ({ type, count, active, onClick }) => {
  const icons = {
    love: '❤️',
    like: '👍',
    haha: '😂',
    wow: '😮',
    sad: '😢',
    angry: '😡',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
        active
          ? 'bg-red-50 text-red-600 border border-red-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      <span className="text-lg">{icons[type]}</span>
      <span className="text-sm font-medium">{formatCount(count)}</span>
    </button>
  );
};

// ==================== MEDIA GALLERY COMPONENT ====================

const MediaGallery: React.FC<{
  mediaUrls: string[];
  mediaTypes: string[];
  onViewImage: (url: string) => void;
  onVideoClick: (post: PostType) => void;
  post: PostType;
}> = ({ mediaUrls, mediaTypes, onViewImage, onVideoClick, post }) => {
  if (!mediaUrls.length) return null;

  const handleMediaClick = (index: number) => {
    const type = mediaTypes[index];
    const url = mediaUrls[index];

    if (type?.startsWith('video/')) {
      onVideoClick({ ...post, media_url: url, media_type: type });
    } else if (type?.startsWith('image/')) {
      onViewImage(url);
    } else if (!type && url.match(/\.(mp4|mov|avi|wmv|flv|mkv|webm)$/i)) {
      onVideoClick({ ...post, media_url: url, media_type: 'video/mp4' });
    } else if (!type && url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
      onViewImage(url);
    }
  };

  const getGridClass = () => {
    switch (mediaUrls.length) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-2';
      case 3: return 'grid-cols-2';
      case 4: return 'grid-cols-2';
      default: return 'grid-cols-2';
    }
  };

  const renderMediaItem = (url: string, index: number) => {
    const type = mediaTypes[index] || '';
    const isVideo = type.startsWith('video/') || url.match(/\.(mp4|mov|avi|wmv|flv|mkv|webm)$/i);
    const isImage = !isVideo && (type.startsWith('image/') || url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i));

    return (
      <div
        key={index}
        className={`relative overflow-hidden rounded-lg cursor-pointer transition-transform hover:scale-[1.02] ${
          mediaUrls.length === 1 ? 'h-96' : 'h-48'
        }`}
        onClick={() => handleMediaClick(index)}
      >
        {isVideo ? (
          <>
            <video
              src={url}
              className="w-full h-full object-cover"
              muted
              loop
              playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center">
                <Play className="w-6 h-6 text-black ml-1" />
              </div>
            </div>
            <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
              <Play className="w-3 h-3 inline mr-1" />
              Video
            </div>
          </>
        ) : isImage ? (
          <img
            src={url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="text-center p-4">
              <Link className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Media Preview</p>
            </div>
          </div>
        )}

        {mediaUrls.length > 4 && index === 3 && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">
              +{mediaUrls.length - 3}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`grid ${getGridClass()} gap-2 mt-3`}>
      {mediaUrls.slice(0, 4).map(renderMediaItem)}
    </div>
  );
};

// ==================== POST COMPONENT ====================

export const Post: React.FC<FeedPostProps> = ({
  post,
  author,
  currentUser,
  users,
  onProfileClick,
  onReact,
  onShare,
  onViewImage,
  onOpenComments,
  onVideoClick,
  onPlayAudioTrack,
  groups,
  brands,
  chats,
  onHashtagClick,
  onFollow,
  isFollowing,
  followLoading = false,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Extract post data safely
  const postId = safeNumber(post?.id);
  const userId = safeNumber(author?.id);
  const content = post?.content || '';
  const createdAt = post?.created_at || new Date().toISOString();
  
  // Handle multi-media arrays
  const mediaUrls = Array.isArray(post?.media_urls) ? post.media_urls : 
                   (post?.media_url ? [post.media_url] : []);
  const mediaTypes = Array.isArray(post?.media_types) ? post.media_types : 
                    (post?.media_type ? [post.media_type] : []);

  // Get reaction data
  const reactions = safeArray<any>(post?.reactions);
  const comments = safeArray<any>(post?.comments);
  const shares = safeNumber(post?.shares);
  
  // Get reaction counts (multiple field support)
  const reactionsCount = safeNumber(
    post?.reactions_count || post?.reactionsCount || post?.likesCount || reactions.length
  );
  const myReaction = post?.my_reaction || post?.myReaction || null;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleReaction = (type: ReactionType) => {
    if (!currentUser) {
      // Optionally trigger login
      return;
    }
    onReact(postId, type);
    setShowReactions(false);
  };

  const handleShare = () => {
    onShare(post);
  };

  const handleHashtagClick = (tag: string) => {
    if (onHashtagClick) {
      onHashtagClick(tag);
    }
  };

  const handleAudioPlay = () => {
    if (post.media_type?.startsWith('audio/') || post.type === 'audio') {
      const audioTrack: AudioTrack = {
        id: postId,
        title: content.substring(0, 50) || 'Audio Post',
        artist: author.name,
        url: post.media_url || mediaUrls[0] || '',
        type: 'music',
        cover: author.profile_image_url,
        duration: 0,
      };
      onPlayAudioTrack(audioTrack);
    }
  };

  // Parse content for hashtags and mentions
  const renderContent = (text: string) => {
    const parts = text.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <span
            key={index}
            className="text-[#1877F2] hover:underline cursor-pointer font-medium"
            onClick={() => handleHashtagClick(part)}
          >
            {part}
          </span>
        );
      }
      if (part.startsWith('@')) {
          const username = part.substring(1);
          const mentionedUser = users.find(u => 
            u.username?.toLowerCase() === username.toLowerCase() || 
            u.name?.toLowerCase().includes(username.toLowerCase())
          );
          
          return (
            <span
              key={index}
              className="text-[#1877F2] hover:underline cursor-pointer font-medium"
              onClick={() => mentionedUser && onProfileClick(mentionedUser.id)}
            >
              {part}
            </span>
          );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const reactionCounts = reactions.reduce((acc, reaction) => {
    acc[reaction.type] = (acc[reaction.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topReactions = Object.entries(reactionCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([type]) => type as ReactionType);

  return (
    <div className="bg-[#242526] rounded-2xl shadow-xl mb-4 overflow-hidden border border-[#3E4042]">
      {/* Post Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={author.profile_image_url}
              alt={author.name}
              className="w-10 h-10 rounded-full object-cover border-2 border-[#3E4042] cursor-pointer"
              onClick={() => onProfileClick(userId)}
            />
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className="font-bold text-[#E4E6EB] hover:underline cursor-pointer"
                  onClick={() => onProfileClick(userId)}
                >
                  {author.name}
                </h3>
                {author.is_verified && (
                  <span className="text-[#1877F2]" title="Verified">
                    ✓
                  </span>
                )}
                {currentUser && currentUser.id !== userId && !isFollowing && (
                  <button
                    onClick={() => onFollow(userId)}
                    disabled={followLoading}
                    className="ml-2 bg-[#1877F2] text-white text-xs font-bold px-3 py-1 rounded-md hover:bg-[#166FE5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {followLoading ? 'Following...' : 'Follow'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-[#B0B3B8] text-sm">
                <span>{formatTime(createdAt)}</span>
                <span>•</span>
                {post.visibility === 'public' && (
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Public
                  </span>
                )}
                {post.visibility === 'friends' && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Friends
                  </span>
                )}
                {post.visibility === 'private' && (
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Private
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 hover:bg-[#3A3B3C] rounded-full transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-[#B0B3B8]" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-[#3A3B3C] rounded-lg shadow-2xl border border-[#4E4F50] py-2 z-50">
                {currentUser?.id === userId && (
                  <>
                    <button className="w-full text-left px-4 py-2 text-[#E4E6EB] hover:bg-[#4E4F50] text-sm">
                      Edit Post
                    </button>
                    <button className="w-full text-left px-4 py-2 text-[#E4E6EB] hover:bg-[#4E4F50] text-sm">
                      Delete Post
                    </button>
                    <div className="h-px bg-[#4E4F50] my-2"></div>
                  </>
                )}
                <button className="w-full text-left px-4 py-2 text-[#E4E6EB] hover:bg-[#4E4F50] text-sm">
                  Save Post
                </button>
                <button className="w-full text-left px-4 py-2 text-[#E4E6EB] hover:bg-[#4E4F50] text-sm">
                  Turn on notifications
                </button>
                <button className="w-full text-left px-4 py-2 text-red-400 hover:bg-[#4E4F50] text-sm">
                  Report
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div className="px-4 pb-3">
        <div className="text-[#E4E6EB] whitespace-pre-wrap leading-relaxed">
          {renderContent(content)}
        </div>

        {/* Media Gallery */}
        {mediaUrls.length > 0 && (
          <MediaGallery
            mediaUrls={mediaUrls}
            mediaTypes={mediaTypes}
            onViewImage={onViewImage}
            onVideoClick={onVideoClick}
            post={post}
          />
        )}

        {/* Link Preview (if any) */}
        {post.link_preview && (
          <div className="mt-3 border border-[#3E4042] rounded-lg overflow-hidden">
            <img
              src={post.link_preview.image || ''}
              alt=""
              className="w-full h-48 object-cover"
            />
            <div className="p-3 bg-[#3A3B3C]">
              <p className="text-xs text-[#B0B3B8] uppercase font-bold">
                {post.link_preview.site_name || 'Link'}
              </p>
              <h4 className="text-[#E4E6EB] font-semibold mt-1">
                {post.link_preview.title}
              </h4>
              <p className="text-[#B0B3B8] text-sm mt-1 line-clamp-2">
                {post.link_preview.description}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Post Stats */}
      <div className="px-4 pt-3 border-t border-[#3E4042]">
        <div className="flex items-center justify-between text-[#B0B3B8] text-sm">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {topReactions.map((type, index) => (
                <div
                  key={type}
                  className="w-6 h-6 rounded-full bg-[#3A3B3C] border border-[#242526] flex items-center justify-center"
                  style={{ zIndex: 3 - index }}
                >
                  {type === 'love' && '❤️'}
                  {type === 'like' && '👍'}
                  {type === 'haha' && '😂'}
                  {type === 'wow' && '😮'}
                  {type === 'sad' && '😢'}
                  {type === 'angry' && '😡'}
                </div>
              ))}
            </div>
            <span>{formatCount(reactionsCount)}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>{formatCount(comments.length)} comments</span>
            <span>{formatCount(shares)} shares</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2 border-t border-[#3E4042]">
        <div className="flex justify-between">
          <div className="relative flex-1">
            <button
              onClick={() => setShowReactions(!showReactions)}
              className={`flex items-center justify-center gap-2 flex-1 py-2.5 rounded-lg transition-colors ${
                myReaction
                  ? 'text-[#F3425F] hover:bg-[#3A3B3C]'
                  : 'text-[#B0B3B8] hover:bg-[#3A3B3C]'
              }`}
            >
              {myReaction === 'love' ? (
                <HeartSolid className="w-5 h-5 fill-current" />
              ) : (
                <ThumbsUp className="w-5 h-5" />
              )}
              <span className="font-semibold">
                {myReaction === 'love' ? 'Loved' : 
                 myReaction === 'like' ? 'Liked' : 
                 myReaction ? myReaction.charAt(0).toUpperCase() + myReaction.slice(1) : 'Like'}
              </span>
            </button>

            {showReactions && (
              <div className="absolute bottom-full left-0 mb-2 bg-[#3A3B3C] rounded-full shadow-2xl border border-[#4E4F50] p-2 flex gap-1">
                {(['love', 'like', 'haha', 'wow', 'sad', 'angry'] as ReactionType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleReaction(type)}
                    className="w-10 h-10 rounded-full hover:bg-[#4E4F50] flex items-center justify-center text-2xl transition-transform hover:scale-110"
                  >
                    {type === 'love' && '❤️'}
                    {type === 'like' && '👍'}
                    {type === 'haha' && '😂'}
                    {type === 'wow' && '😮'}
                    {type === 'sad' && '😢'}
                    {type === 'angry' && '😡'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => onOpenComments(postId)}
            className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-lg text-[#B0B3B8] hover:bg-[#3A3B3C] transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="font-semibold">Comment</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-lg text-[#B0B3B8] hover:bg-[#3A3B3C] transition-colors"
          >
            <Share className="w-5 h-5" />
            <span className="font-semibold">Share</span>
          </button>
        </div>
      </div>

      {/* Quick Comment Input */}
      <div className="px-4 py-3 border-t border-[#3E4042]">
        <div className="flex items-center gap-3">
          <img
            src={currentUser?.profile_image_url}
            alt=""
            className="w-8 h-8 rounded-full object-cover"
          />
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Write a comment..."
              className="w-full bg-[#3A3B3C] border-none rounded-full px-4 py-2.5 text-[#E4E6EB] placeholder-[#B0B3B8] focus:outline-none focus:ring-1 focus:ring-[#1877F2]"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && commentText.trim()) {
                  setIsSubmittingComment(true);
                  // Simulate API call
                  setTimeout(() => {
                    setCommentText('');
                    setIsSubmittingComment(false);
                  }, 500);
                }
              }}
            />
            <button
              onClick={() => {
                if (commentText.trim()) {
                  setIsSubmittingComment(true);
                  // Simulate API call
                  setTimeout(() => {
                    setCommentText('');
                    setIsSubmittingComment(false);
                  }, 500);
                }
              }}
              disabled={isSubmittingComment || !commentText.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#1877F2] hover:text-[#166FE5] disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== CREATE POST COMPONENT ====================

export const CreatePost: React.FC<CreatePostProps> = ({
  currentUser,
  onProfileClick,
  onClick,
}) => {
  return (
    <div className="bg-[#242526] rounded-2xl shadow-xl mb-4 overflow-hidden border border-[#3E4042]">
      <div className="p-4">
        <div className="flex items-center gap-3">
          <img
            src={currentUser.profile_image_url}
            alt={currentUser.name}
            className="w-10 h-10 rounded-full object-cover border-2 border-[#3E4042] cursor-pointer"
            onClick={() => onProfileClick(currentUser.id)}
          />
          <button
            onClick={onClick}
            className="flex-1 bg-[#3A3B3C] hover:bg-[#4E4F50] text-left px-4 py-3 rounded-full text-[#B0B3B8] transition-colors"
          >
            What's on your mind, {currentUser.name.split(' ')[0]}?
          </button>
        </div>

        <div className="flex justify-between mt-4 pt-3 border-t border-[#3E4042]">
          <button className="flex items-center gap-2 flex-1 justify-center py-2 rounded-lg text-[#B0B3B8] hover:bg-[#3A3B3C] transition-colors">
            <Video className="w-5 h-5 text-red-500" />
            <span className="font-semibold">Live video</span>
          </button>
          <button className="flex items-center gap-2 flex-1 justify-center py-2 rounded-lg text-[#B0B3B8] hover:bg-[#3A3B3C] transition-colors">
            <ImageIcon className="w-5 h-5 text-green-500" />
            <span className="font-semibold">Photo/video</span>
          </button>
          <button className="flex items-center gap-2 flex-1 justify-center py-2 rounded-lg text-[#B0B3B8] hover:bg-[#3A3B3C] transition-colors">
            <Smile className="w-5 h-5 text-yellow-500" />
            <span className="font-semibold">Feeling/activity</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== CREATE POST MODAL ====================

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  currentUser,
  users,
  onClose,
  onCreatePost,
}) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'private'>('public');
  const [feeling, setFeeling] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [taggedUsers, setTaggedUsers] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );
    
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!text.trim() && files.length === 0) return;

    setIsSubmitting(true);
    
    try {
      await onCreatePost(
        text,
        files.length > 0 ? files : null,
        {
          visibility: privacy,
          location: location || undefined,
          feeling: feeling || undefined,
          taggedUsers: taggedUsers.length > 0 ? taggedUsers : undefined,
        }
      );
      
      // Reset form
      setText('');
      setFiles([]);
      setPrivacy('public');
      setFeeling('');
      setLocation('');
      setTaggedUsers([]);
      
      onClose();
    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[#242526] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-[#3E4042]">
        {/* Header */}
        <div className="p-4 border-b border-[#3E4042] flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#E4E6EB]">Create Post</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#3A3B3C] rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-[#B0B3B8]" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            <img
              src={currentUser.profile_image_url}
              alt={currentUser.name}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <h3 className="font-bold text-[#E4E6EB]">{currentUser.name}</h3>
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value as any)}
                className="text-sm text-[#B0B3B8] bg-transparent border-none focus:outline-none"
              >
                <option value="public" className="bg-[#242526]">
                  <Globe className="w-3 h-3 inline mr-2" />
                  Public
                </option>
                <option value="friends" className="bg-[#242526]">
                  <Users className="w-3 h-3 inline mr-2" />
                  Friends
                </option>
                <option value="private" className="bg-[#242526]">
                  <Lock className="w-3 h-3 inline mr-2" />
                  Only me
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Text Input */}
        <div className="flex-1 overflow-y-auto px-4">
          <textarea
            placeholder={`What's on your mind, ${currentUser.name.split(' ')[0]}?`}
            className="w-full h-40 bg-transparent border-none text-[#E4E6EB] text-lg placeholder-[#B0B3B8] resize-none focus:outline-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {/* File Previews */}
          {files.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {files.map((file, index) => (
                <div key={index} className="relative rounded-lg overflow-hidden">
                  {file.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt=""
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <video
                      src={URL.createObjectURL(file)}
                      className="w-full h-48 object-cover"
                      muted
                    />
                  )}
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Options */}
        <div className="p-4 border-t border-[#3E4042]">
          <div className="bg-[#3A3B3C] rounded-lg p-4">
            <p className="text-[#E4E6EB] font-semibold mb-2">Add to your post</p>
            <div className="flex gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-[#B0B3B8] hover:text-[#E4E6EB] transition-colors"
              >
                <ImageIcon className="w-5 h-5" />
                <span>Photo/Video</span>
              </button>
              <button className="flex items-center gap-2 text-[#B0B3B8] hover:text-[#E4E6EB] transition-colors">
                <UserIcon className="w-5 h-5" />
                <span>Tag people</span>
              </button>
              <button className="flex items-center gap-2 text-[#B0B3B8] hover:text-[#E4E6EB] transition-colors">
                <Smile className="w-5 h-5" />
                <span>Feeling</span>
              </button>
              <button className="flex items-center gap-2 text-[#B0B3B8] hover:text-[#E4E6EB] transition-colors">
                <MapPin className="w-5 h-5" />
                <span>Location</span>
              </button>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            accept="image/*,video/*"
            onChange={handleFileSelect}
          />
        </div>

        {/* Submit Button */}
        <div className="p-4 border-t border-[#3E4042]">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (!text.trim() && files.length === 0)}
            className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== COMMENTS SHEET ====================

export const CommentsSheet: React.FC<CommentsSheetProps> = ({
  post,
  currentUser,
  users,
  onClose,
  onComment,
  onLikeComment,
  getCommentAuthor,
  onProfileClick,
  onHashtagClick,
  onFollow,
  checkIsFollowing,
}) => {
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comments, setComments] = useState<Comment[]>(safeArray(post.comments));

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !currentUser) return;

    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      const newComment: Comment = {
        id: Date.now(),
        user_id: currentUser.id,
        text: commentText,
        created_at: new Date().toISOString(),
        likes: [],
        replies: [],
      };
      
      setComments(prev => [newComment, ...prev]);
      setCommentText('');
      setIsSubmitting(false);
      onComment();
    }, 500);
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('#') && onHashtagClick) {
        return (
          <span
            key={index}
            className="text-[#1877F2] hover:underline cursor-pointer font-medium"
            onClick={() => onHashtagClick(part)}
          >
            {part}
          </span>
        );
      }
      if (part.startsWith('@')) {
        const username = part.substring(1);
        const mentionedUser = users.find(u => 
          u.username?.toLowerCase() === username.toLowerCase() || 
          u.name?.toLowerCase().includes(username.toLowerCase())
        );
        
        return (
          <span
            key={index}
            className="text-[#1877F2] hover:underline cursor-pointer font-medium"
            onClick={() => mentionedUser && onProfileClick(mentionedUser.id)}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col">
      {/* Header */}
      <div className="bg-[#242526] border-b border-[#3E4042] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#E4E6EB]">Comments</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#3A3B3C] rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-[#B0B3B8]" />
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto bg-[#18191A]">
        {comments.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-[#B0B3B8] mx-auto mb-4" />
            <p className="text-[#B0B3B8]">No comments yet</p>
            <p className="text-[#B0B3B8] text-sm mt-1">Be the first to comment!</p>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {comments.map((comment) => {
              const author = getCommentAuthor(comment.user_id);
              if (!author) return null;

              return (
                <div key={comment.id} className="flex gap-3">
                  <img
                    src={author.profile_image_url}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover cursor-pointer"
                    onClick={() => onProfileClick(author.id)}
                  />
                  <div className="flex-1">
                    <div className="bg-[#3A3B3C] rounded-2xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <h4
                          className="font-bold text-[#E4E6EB] text-sm cursor-pointer hover:underline"
                          onClick={() => onProfileClick(author.id)}
                        >
                          {author.name}
                        </h4>
                        <span className="text-[#B0B3B8] text-xs">
                          {formatTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-[#E4E6EB] text-sm">
                        {renderContent(comment.text)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 mt-2 ml-3">
                      <button
                        onClick={() => onLikeComment(comment.id)}
                        className="text-[#B0B3B8] hover:text-[#E4E6EB] text-xs font-semibold"
                      >
                        Like
                      </button>
                      <button className="text-[#B0B3B8] hover:text-[#E4E6EB] text-xs font-semibold">
                        Reply
                      </button>
                      <span className="text-[#B0B3B8] text-xs">
                        {formatCount(comment.likes?.length || 0)} likes
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comment Input */}
      <div className="bg-[#242526] border-t border-[#3E4042] p-4">
        <div className="flex items-center gap-3">
          <img
            src={currentUser?.profile_image_url}
            alt=""
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Write a comment..."
              className="w-full bg-[#3A3B3C] border-none rounded-full px-4 py-3 text-[#E4E6EB] placeholder-[#B0B3B8] focus:outline-none focus:ring-1 focus:ring-[#1877F2]"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && commentText.trim() && !isSubmitting) {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
            />
            <button
              onClick={handleSubmitComment}
              disabled={isSubmitting || !commentText.trim() || !currentUser}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#1877F2] hover:text-[#166FE5] disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== SHARE BOTTOM SHEET ====================

export const ShareBottomSheet: React.FC<ShareBottomSheetProps> = ({
  isOpen,
  onClose,
  post,
  currentUser,
  users,
  groups,
  brands,
  chats,
  onShareComplete,
  onFollow,
  checkIsFollowing,
}) => {
  const [selectedDestination, setSelectedDestination] = useState<string>('');
  const [shareMessage, setShareMessage] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  if (!isOpen) return null;

  const handleShare = async (destination: string) => {
    setIsSharing(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onShareComplete(destination, { success: true });
      onClose();
    } catch (error) {
      console.error('Share failed:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const destinations = [
    { id: 'feed', icon: '📝', label: 'Share to Feed', color: 'text-blue-500' },
    { id: 'story', icon: '📖', label: 'Share to Story', color: 'text-purple-500' },
    { id: 'messenger', icon: '💬', label: 'Send in Messenger', color: 'text-blue-400' },
    { id: 'groups', icon: '👥', label: 'Share to Groups', color: 'text-green-500', count: groups.length },
    { id: 'copy', icon: '🔗', label: 'Copy Link', color: 'text-gray-500' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end">
      <div className="w-full bg-[#242526] rounded-t-2xl max-h-[80vh] overflow-hidden flex flex-col border border-[#3E4042]">
        {/* Header */}
        <div className="p-4 border-b border-[#3E4042] flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#E4E6EB]">Share</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#3A3B3C] rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-[#B0B3B8]" />
          </button>
        </div>

        {/* Share Options */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Quick Share Options */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {destinations.map((dest) => (
              <button
                key={dest.id}
                onClick={() => handleShare(dest.id)}
                disabled={isSharing}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#3A3B3C] transition-colors disabled:opacity-50"
              >
                <span className="text-2xl">{dest.icon}</span>
                <span className="text-xs text-[#E4E6EB] text-center font-medium">
                  {dest.label}
                </span>
                {dest.count !== undefined && (
                  <span className="text-xs text-[#B0B3B8]">
                    {dest.count} groups
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Groups List */}
          {groups.length > 0 && (
            <div className="mb-6">
              <h3 className="text-[#E4E6EB] font-semibold mb-3">Your Groups</h3>
              <div className="space-y-2">
                {groups.slice(0, 5).map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleShare(`group:${group.id}`)}
                    disabled={isSharing}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#3A3B3C] transition-colors disabled:opacity-50"
                  >
                    <img
                      src={group.profile_image || group.cover_image}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div className="text-left flex-1">
                      <p className="text-[#E4E6EB] font-medium">{group.name}</p>
                      <p className="text-[#B0B3B8] text-sm">
                        {group.members?.length || 0} members
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Friends List */}
          {users.length > 0 && (
            <div>
              <h3 className="text-[#E4E6EB] font-semibold mb-3">Share with Friends</h3>
              <div className="space-y-2">
                {users.slice(0, 5).map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleShare(`user:${user.id}`)}
                    disabled={isSharing}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#3A3B3C] transition-colors disabled:opacity-50"
                  >
                    <img
                      src={user.profile_image_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="text-left flex-1">
                      <p className="text-[#E4E6EB] font-medium">{user.name}</p>
                      <div className="flex items-center gap-2">
                        {checkIsFollowing(user.id) ? (
                          <span className="text-xs text-[#45BD62]">Following</span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onFollow(user.id);
                            }}
                            className="text-xs text-[#1877F2] hover:underline"
                          >
                            Follow
                          </button>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Custom Message */}
        <div className="p-4 border-t border-[#3E4042]">
          <textarea
            placeholder="Add a message (optional)"
            className="w-full bg-[#3A3B3C] border-none rounded-xl px-4 py-3 text-[#E4E6EB] placeholder-[#B0B3B8] resize-none focus:outline-none focus:ring-1 focus:ring-[#1877F2]"
            rows={2}
            value={shareMessage}
            onChange={(e) => setShareMessage(e.target.value)}
          />
          <button
            onClick={() => handleShare('feed')}
            disabled={isSharing}
            className="w-full mt-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {isSharing ? 'Sharing...' : 'Share Now'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== SUGGESTED PRODUCTS WIDGET ====================

interface SuggestedProductsWidgetProps {
  products: Product[];
  currentUser: User | null;
  onViewProduct: (product: Product) => void;
  onSeeAll: () => void;
}

export const SuggestedProductsWidget: React.FC<SuggestedProductsWidgetProps> = ({
  products,
  currentUser,
  onViewProduct,
  onSeeAll,
}) => {
  const suggestedProducts = products.slice(0, 3);

  if (suggestedProducts.length === 0) return null;

  return (
    <div className="bg-[#242526] rounded-2xl shadow-xl mb-4 overflow-hidden border border-[#3E4042]">
      <div className="p-4 border-b border-[#3E4042]">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#E4E6EB]">Suggested Products</h3>
          <button
            onClick={onSeeAll}
            className="text-[#1877F2] text-sm font-semibold hover:underline"
          >
            See All
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 gap-4">
          {suggestedProducts.map((product) => {
            const images = Array.isArray(product.images) ? product.images : [];
            const mainImage = images[0] || '';

            return (
              <div
                key={product.id}
                className="flex gap-3 p-3 rounded-lg hover:bg-[#3A3B3C] transition-colors cursor-pointer"
                onClick={() => onViewProduct(product)}
              >
                <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                  {mainImage ? (
                    <img
                      src={mainImage}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-[#E4E6EB] truncate">
                    {product.title}
                  </h4>
                  <p className="text-[#B0B3B8] text-sm line-clamp-2">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#E4E6EB]">
                        ${product.main_price}
                      </span>
                      {product.discount_price && (
                        <span className="text-sm text-[#B0B3B8] line-through">
                          ${product.discount_price}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#45BD62] font-semibold">
                      In stock
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ==================== STYLES ====================

const styles = `
.line-clamp-1 { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
.line-clamp-2 { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.line-clamp-3 { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.line-clamp-4 { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
.scrollbar-hide::-webkit-scrollbar { display: none; }
`;

// Add styles to document
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

export default {
  Post,
  CreatePost,
  CreatePostModal,
  CommentsSheet,
  ShareBottomSheet,
  SuggestedProductsWidget,
  MediaGallery,
  ReactionButton,
  formatCount,
  formatTime,
};
