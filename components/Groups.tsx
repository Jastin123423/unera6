// Groups.tsx - Updated with professional three-dots menu

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';  // ✅ Added useCallback
import { User, Group, Event, Post as PostType, ReactionType } from '../types';
import { 
  Post, 
  CommentsSheet,
  formatRelativeTime,
  ReactionButton,
  ShareBottomSheet,
  RichText
} from './Feed';
import { CreateEventModal } from './Events';

// ✅ LOCAL IMPLEMENTATION: getPostMediaList
type NormalizedMedia = { url: string; kind: 'image' | 'video' };

const getPostMediaList = (post: any): NormalizedMedia[] => {
  const out: NormalizedMedia[] = [];

  // 1) arrays: media_urls, images
  const arrUrls: any[] = Array.isArray(post?.media_urls)
    ? post.media_urls
    : Array.isArray(post?.images)
      ? post.images
      : [];

  for (const u of arrUrls) {
    const url = String(u || '').trim();
    if (!url) continue;
    out.push({ url, kind: 'image' });
  }

  // 2) array of objects: media: [{url,type}]
  const arrMedia: any[] = Array.isArray(post?.media) ? post.media : [];
  for (const m of arrMedia) {
    const url = String(m?.url || m?.media_url || '').trim();
    if (!url) continue;

    const type = String(m?.type || m?.media_type || '').toLowerCase();
    const clean = url.split('?')[0].split('#')[0];
    const ext = clean.split('.').pop()?.toLowerCase() || '';

    const isVideo =
      type.startsWith('video') ||
      ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', '3gp'].includes(ext);

    out.push({ url, kind: isVideo ? 'video' : 'image' });
  }

  // 3) fallback to single media_url if present (only if no list)
  if (out.length === 0) {
    const single = String(post?.media_url || '').trim();
    if (single) {
      const mediaTypeRaw = String(post?.media_type || '').toLowerCase();
      const ext = single.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || '';
      
      const isVideo =
        mediaTypeRaw.startsWith('video') ||
        ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', '3gp'].includes(ext);
      
      if (isVideo) {
        out.push({ url: single, kind: 'video' });
      } else {
        out.push({ url: single, kind: 'image' });
      }
    }
  }

  // keep only valid
  return out.filter((x) => x.url);
};

// ✅ LOCAL IMPLEMENTATION: ExpandableRichText
const ExpandableRichText: React.FC<{
  text: string;
  users?: User[];
  onProfileClick: (id: number) => void;
  onHashtagClick?: (tag: string) => void;
  maxWords?: number;
  fontSizePx?: number;
  onSeeMore?: () => void;
  forceExpanded?: boolean;
}> = ({
  text,
  users,
  onProfileClick,
  onHashtagClick,
  maxWords = 25,
  fontSizePx = 21,
  onSeeMore,
  forceExpanded = false,
}) => {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  const isLong = words.length > maxWords;

  const shownText =
    forceExpanded || !isLong ? text : words.slice(0, maxWords).join(' ') + '…';

  return (
    <div style={{ fontSize: `${fontSizePx}px` }} className="text-[#E4E6EB] leading-relaxed">
      <RichText
        text={shownText}
        users={users}
        onProfileClick={onProfileClick}
        onHashtagClick={onHashtagClick}
      />

      {isLong && !forceExpanded && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSeeMore?.();
          }}
          className="ml-2 font-bold text-[#1877F2] hover:underline"
        >
          See more
        </button>
      )}
    </div>
  );
};

// ✅ LOCAL IMPLEMENTATION: MediaGrid
const MediaGrid: React.FC<{
  media: { url: string }[];
  onOpen: (url: string, index: number) => void;
}> = ({ media, onOpen }) => {
  const total = media.length;
  const show = total <= 4 ? media : media.slice(0, 4);
  const extra = total - 4;

  const Tile = ({
    url,
    index,
    className,
    showOverlay,
  }: {
    url: string;
    index: number;
    className: string;
    showOverlay?: boolean;
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(url, index);
      }}
      className={`relative overflow-hidden ${className}`}
      style={{ borderRadius: 0 }}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />

      {showOverlay && extra > 0 && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <span className="text-white font-black text-3xl">+{extra}</span>
        </div>
      )}
    </button>
  );

  if (total === 1) {
    return (
      <div className="w-full bg-black">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(show[0].url, 0);
          }}
          className="w-full block"
        >
          <img
            src={show[0].url}
            alt=""
            loading="lazy"
            className="w-full h-auto max-h-[650px] object-contain"
          />
        </button>
      </div>
    );
  }

  if (total === 2) {
    return (
      <div className="w-full grid grid-cols-2 gap-[2px] bg-black">
        <Tile url={show[0].url} index={0} className="h-[320px] w-full" />
        <Tile url={show[1].url} index={1} className="h-[320px] w-full" />
      </div>
    );
  }

  if (total === 3) {
    return (
      <div className="w-full grid grid-cols-2 gap-[2px] bg-black">
        <Tile url={show[0].url} index={0} className="h-[420px] w-full" />
        <div className="grid grid-rows-2 gap-[2px] h-[420px]">
          <Tile url={show[1].url} index={1} className="w-full h-full" />
          <Tile url={show[2].url} index={2} className="w-full h-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full grid grid-cols-2 gap-[2px] bg-black">
      <Tile url={show[0].url} index={0} className="h-[260px] w-full" />
      <Tile url={show[1].url} index={1} className="h-[260px] w-full" />
      <Tile url={show[2].url} index={2} className="h-[260px] w-full" />
      <Tile
        url={show[3].url}
        index={3}
        className="h-[260px] w-full"
        showOverlay={extra > 0}
      />
    </div>
  );
};

interface GroupSettingsModalProps {
  group: Group;
  onClose: () => void;
  onUpdate: (settings: Partial<Group>) => Promise<void>;
  isAdmin: boolean;
  onDeleteGroup: () => void;
}

const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  group,
  onClose,
  onUpdate,
  isAdmin,
  onDeleteGroup,
}) => {
  const [name, setName] = useState(group.name || '');
  const [desc, setDesc] = useState(group.description || '');
  const [postingAllowed, setPostingAllowed] = useState(group.member_posting_allowed ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onUpdate({ name: name.trim(), description: desc.trim(), member_posting_allowed: postingAllowed });
    } catch (error) {
      console.error('Failed to update group settings:', error);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-[#1e1e1e] w-full max-w-[500px] rounded-xl border border-[#333] shadow-2xl flex flex-col animate-slide-up">
        <div className="p-4 border-b border-[#333] flex justify-between items-center">
          <h3 className="text-xl font-bold text-[#e4e6eb]">Group Settings</h3>
          <div
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#2d2d2d] hover:bg-[#3a3a3a] flex items-center justify-center cursor-pointer transition-colors"
          >
            <i className="fas fa-times text-[#b0b3b8]"></i>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[#b0b3b8] text-sm font-bold mb-1">Group Name</label>
            <input
              type="text"
              className="w-full bg-[#2d2d2d] border border-[#333] rounded-lg p-2.5 text-[#e4e6eb] outline-none"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[#b0b3b8] text-sm font-bold mb-1">Description</label>
            <textarea
              className="w-full bg-[#2d2d2d] border border-[#333] rounded-lg p-2.5 text-[#e4e6eb] outline-none h-24 resize-none"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-[#2d2d2d] rounded-lg border border-[#333]">
            <div>
              <div className="text-[#e4e6eb] font-bold">Member Posting</div>
              <div className="text-[#b0b3b8] text-xs">Allow members to post in the group</div>
            </div>
            <div
              className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${postingAllowed ? 'bg-[#1877f2]' : 'bg-gray-600'}`}
              onClick={() => setPostingAllowed(!postingAllowed)}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${postingAllowed ? 'left-7' : 'left-1'}`}
              ></div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full bg-[#1877f2] hover:bg-[#166fe5] text-white py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {isAdmin && (
            <div className="border-t border-red-500/20 pt-4 mt-4">
              <button
                onClick={onDeleteGroup}
                className="w-full bg-red-500/10 text-red-500 font-bold py-2.5 rounded-lg transition-all hover:bg-red-500 hover:text-white border border-red-500/20"
              >
                Delete Community
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Group Event Card Component - ✅ Fixed date handling to prevent crashes
 */
const GroupEventCard: React.FC<{
  event: Event;
  group: Group;
  currentUser: User | null;
  onRSVP?: (eventId: number, status: string) => Promise<any>;
  onProfileClick: (id: number) => void;
}> = ({ event, group, currentUser, onRSVP, onProfileClick }) => {
  const [rsvpStatus, setRsvpStatus] = useState<string>(event.user_rsvp_status || '');
  const [loading, setLoading] = useState(false);

  // ✅ Safe date handling to prevent crashes from invalid dates
  const rawDate = event.start_time || (event as any).date || '';
  const eventDate = rawDate ? new Date(rawDate) : null;
  
  const formattedDate = eventDate && !Number.isNaN(eventDate.getTime())
    ? eventDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    : 'Date TBD';

  const handleRSVP = async (status: string) => {
    if (!currentUser || !onRSVP) return;
    setLoading(true);
    try {
      await onRSVP(event.id, status);
      setRsvpStatus(status);
    } catch (error) {
      console.error('Failed to RSVP:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1e1e1e] rounded-xl border border-[#333] overflow-hidden hover:shadow-lg transition-all">
      {event.cover_image && (
        <div className="h-40 overflow-hidden">
          <img 
            src={event.cover_image} 
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-4">
        <h4 className="text-[#e4e6eb] font-bold text-lg mb-2">{event.title}</h4>
        <p className="text-[#b0b3b8] text-sm mb-3 line-clamp-2">{event.description}</p>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-[#b0b3b8] text-sm">
            <i className="fas fa-calendar text-[#1877f2] w-5"></i>
            <span>{formattedDate}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-[#b0b3b8] text-sm">
              <i className="fas fa-map-marker-alt text-[#1877f2] w-5"></i>
              <span>{event.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[#b0b3b8] text-sm">
            <i className="fas fa-users text-[#1877f2] w-5"></i>
            <span>{event.attendees?.length || 0} attending</span>
          </div>
        </div>

        {currentUser && onRSVP && (
          <div className="flex gap-2">
            {rsvpStatus === 'going' ? (
              <button
                onClick={() => handleRSVP('not_going')}
                disabled={loading}
                className="flex-1 bg-[#45BD62] text-white px-3 py-2 rounded-lg font-bold text-sm hover:bg-[#3aa34f] transition-colors disabled:opacity-50"
              >
                <i className="fas fa-check mr-2"></i>Going
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleRSVP('going')}
                  disabled={loading}
                  className="flex-1 bg-[#1877f2] text-white px-3 py-2 rounded-lg font-bold text-sm hover:bg-[#166fe5] transition-colors disabled:opacity-50"
                >
                  Going
                </button>
                <button
                  onClick={() => handleRSVP('interested')}
                  disabled={loading}
                  className="flex-1 bg-[#2d2d2d] text-[#e4e6eb] px-3 py-2 rounded-lg font-bold text-sm hover:bg-[#3a3a3a] transition-colors disabled:opacity-50"
                >
                  Interested
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Post Actions Menu Component
const PostActionsMenu: React.FC<{
  post: PostType;
  currentUser: User | null;
  isGroupAdmin: boolean;
  isPostAuthor: boolean;
  onEdit?: (postId: number, content: string) => Promise<any>;
  onDelete?: (postId: number) => Promise<any>;
  onReport?: (postId: number) => Promise<any>;
  onClose: () => void;
}> = ({ post, currentUser, isGroupAdmin, isPostAuthor, onEdit, onDelete, onReport, onClose }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(post.content || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleEdit = async () => {
    if (!onEdit || !editText.trim()) return;
    setIsSubmitting(true);
    try {
      await onEdit(post.id, editText.trim());
      setIsEditing(false);
      onClose();
    } catch (error) {
      console.error('Failed to edit post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await onDelete(post.id);
        onClose();
      } catch (error) {
        console.error('Failed to delete post:', error);
      }
    }
  };

  const handleReport = async () => {
    if (!onReport) return;
    try {
      await onReport(post.id);
      alert('Post reported to group admins');
      onClose();
    } catch (error) {
      console.error('Failed to report post:', error);
    }
  };

  if (isEditing) {
    return (
      <div className="absolute right-0 top-8 z-50 w-80 bg-[#1e1e1e] rounded-xl shadow-2xl border border-[#333] p-4" ref={menuRef}>
        <h4 className="text-[#e4e6eb] font-bold mb-3">Edit Post</h4>
        <textarea
          className="w-full bg-[#2d2d2d] border border-[#333] rounded-lg p-3 text-[#e4e6eb] resize-none h-24 outline-none"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 text-[#b0b3b8] hover:bg-[#2d2d2d] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleEdit}
            disabled={isSubmitting || !editText.trim()}
            className="px-4 py-2 bg-[#1877f2] text-white rounded-lg hover:bg-[#166fe5] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-8 z-50 w-56 bg-[#1e1e1e] rounded-xl shadow-2xl border border-[#333] overflow-hidden" ref={menuRef}>
      <div className="py-1">
        {(isPostAuthor || isGroupAdmin) && (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="w-full px-4 py-3 text-left hover:bg-[#2d2d2d] flex items-center gap-3 text-[#e4e6eb] transition-colors"
            >
              <i className="fas fa-edit w-5 text-[#b0b3b8]"></i>
              <span>Edit Post</span>
            </button>
            <button
              onClick={handleDelete}
              className="w-full px-4 py-3 text-left hover:bg-[#2d2d2d] flex items-center gap-3 text-[#f3425f] transition-colors"
            >
              <i className="fas fa-trash w-5 text-[#f3425f]"></i>
              <span>Delete Post</span>
            </button>
            <div className="border-t border-[#333] my-1"></div>
          </>
        )}
        
        {!isPostAuthor && (
          <button
            onClick={handleReport}
            className="w-full px-4 py-3 text-left hover:bg-[#2d2d2d] flex items-center gap-3 text-[#e4e6eb] transition-colors"
          >
            <i className="fas fa-flag w-5 text-[#b0b3b8]"></i>
            <span>Report Post</span>
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full px-4 py-3 text-left hover:bg-[#2d2d2d] flex items-center gap-3 text-[#b0b3b8] transition-colors"
        >
          <i className="fas fa-times w-5"></i>
          <span>Close</span>
        </button>
      </div>
    </div>
  );
};

/**
 * GroupPost Component with Three-Dots Menu
 */
const GroupPost: React.FC<{
  post: PostType;
  author: User;
  currentUser: User | null;
  users: User[];
  isGroupAdmin?: boolean;
  isPlatformAdmin?: boolean;  // ✅ Added platform admin prop
  onProfileClick: (id: number) => void;
  onLikePost: (postId: number, type?: ReactionType) => Promise<any>;
  onOpenComments: (postId: number) => void;
  onSharePost: (postId: number, newShareCount: number) => void;
  onEditPost?: (postId: number, content: string) => Promise<any>;
  onDeletePost?: (postId: number) => Promise<any>;
  onReportPost?: (postId: number) => Promise<any>;
  onViewImage?: (url: string) => void;
  onVideoClick?: (post: PostType) => void;
  onHashtagClick?: (tag: string) => void;
  onFollow?: (userId: number) => Promise<any>;
  checkIsFollowing?: (userId: number) => boolean;
}> = ({
  post,
  author,
  currentUser,
  users,
  isGroupAdmin = false,
  isPlatformAdmin = false,  // ✅ Added with default false
  onProfileClick,
  onLikePost,
  onOpenComments,
  onSharePost,
  onEditPost,
  onDeletePost,
  onReportPost,
  onViewImage,
  onVideoClick,
  onHashtagClick,
  onFollow,
  checkIsFollowing,
}) => {
  const p: any = post as any;
  const a: any = author as any;

  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [commentCount, setCommentCount] = useState(() => {
    if (typeof p.comment_count === 'number') return p.comment_count;
    if (Array.isArray(p.comments)) return p.comments.length;
    return 0;
  });

  const [shareCount, setShareCount] = useState(() => {
    return Number(p.shares ?? p.shares_count ?? 0);
  });

  const [showShareSheet, setShowShareSheet] = useState(false);

  const myReaction = (p as any).myReaction ?? (p as any).my_reaction ?? null;
  const likesCount = Number(
    (p as any).likesCount ?? 
    (p as any).reactionsCount ?? 
    (p as any).reactions_count ?? 
    0
  );

  const reactionsArr = Array.isArray(p.reactions) ? p.reactions : null;
  
  const finalMyReaction: ReactionType | undefined =
    myReaction ||
    (currentUser && reactionsArr
      ? (reactionsArr.find((r: any) => Number(r.user_id) === currentUser.id)?.type as ReactionType)
      : undefined);

  const finalReactionCount =
    likesCount > 0
      ? likesCount
      : reactionsArr
        ? reactionsArr.length
        : 0;

  const createdAtLabel = formatRelativeTime(p.created_at);
  const postId = Number(p.id ?? p.post_id ?? 0);

  const isPostAuthor = currentUser?.id === author.id;
  
  // ✅ Updated canModerate logic to include platform admin
  const canModerate = Boolean(isPostAuthor || isGroupAdmin || isPlatformAdmin);

  // Get media list for multiple images
  const mediaList = useMemo(() => {
    const list = getPostMediaList(p);
    return list.filter((x) => x.kind === 'image');
  }, [p]);

  // Check for video
  const mediaUrl = String(p?.media_url || '');
  const mediaTypeRaw = String(p?.media_type || '').toLowerCase();
  const typeRaw = String(p?.type || '').toLowerCase();
  const ext = mediaUrl.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || '';
  
  const isVideo =
    typeRaw === 'video' ||
    mediaTypeRaw === 'video' ||
    mediaTypeRaw.startsWith('video/') ||
    ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'flv', 'wmv', '3gp'].includes(ext);

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const handleLikeClick = async (type: ReactionType) => {
    if (!currentUser) return;
    try {
      await onLikePost(postId, type);
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const handleShareComplete = (destination: string, data?: any) => {
    const nextShares = Number(data?.shares ?? data?.share_count ?? shareCount + 1);
    if (data?.success) {
      setShareCount(nextShares);
      onSharePost(postId, nextShares);
    }
    setShowShareSheet(false);
  };

  const handleSeeMore = () => {
    onOpenComments(postId);
  };

  return (
    <>
      <div className="bg-[#242526] rounded-xl shadow-sm mb-4 animate-fade-in border border-[#3E4042] overflow-hidden">
        <div className="p-3 md:p-4 flex items-center justify-between">
          <div
            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
            onClick={() => onProfileClick(a.id)}
          >
            <img
              src={a.profile_image_url || 'https://ui-avatars.com/api/?name=User'}
              alt=""
              className="w-10 h-10 rounded-full object-cover border border-[#3E4042]"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <h4 className="font-bold text-[#E4E6EB] text-[18.5px] hover:underline truncate">
                  {a.name || 'User'}
                </h4>
                {a.is_verified && (
                  <i className="fas fa-check-circle text-[#1877F2] text-[13px]"></i>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[#B0B3B8] text-[13px]">
                <span>{createdAtLabel}</span>
                <span>•</span>
                <i className="fas fa-users text-[12px]"></i>
                <span>Group Post</span>
              </div>
            </div>
          </div>

          {/* Three-dots menu button - only show if user can moderate */}
          {(canModerate || onReportPost) && (
            <div className="relative">
              <button
                className="w-9 h-9 hover:bg-[#3A3B3C] rounded-full flex items-center justify-center transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActionsMenu(!showActionsMenu);
                }}
                aria-label="Post actions"
              >
                <i className="fas fa-ellipsis-h text-[#B0B3B8] text-xl"></i>
              </button>

              {showActionsMenu && (
                <PostActionsMenu
                  post={post}
                  currentUser={currentUser}
                  // ✅ Pass combined admin status
                  isGroupAdmin={canModerate}
                  isPostAuthor={isPostAuthor}
                  onEdit={onEditPost}
                  onDelete={onDeletePost}
                  onReport={onReportPost}
                  onClose={() => setShowActionsMenu(false)}
                />
              )}
            </div>
          )}
        </div>

        {p.content && (
          <div className="px-3 md:px-4 pb-2">
            <ExpandableRichText
              text={String(p.content)}
              users={users}
              onProfileClick={onProfileClick}
              onHashtagClick={onHashtagClick}
              maxWords={25}
              fontSizePx={21}
              onSeeMore={handleSeeMore}
            />
          </div>
        )}

        {mediaList.length > 0 && (
          <MediaGrid
            media={mediaList.map((m) => ({ url: m.url }))}
            onOpen={(url, index) => onViewImage?.(url)}
          />
        )}

        {mediaList.length === 0 && mediaUrl && !isVideo && (
          <div
            className="cursor-pointer bg-black"
            onClick={() => onViewImage?.(mediaUrl)}
          >
            <img
              src={mediaUrl}
              alt=""
              className="w-full h-auto max-h-[600px] object-contain"
              loading="lazy"
              onError={(e) => {
                console.error('Failed to load image:', mediaUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        {isVideo && mediaUrl && (
          <div
            className="cursor-pointer relative h-[500px] bg-black"
            onClick={() => onVideoClick?.(post)}
          >
            <video
              src={mediaUrl}
              className="w-full h-full object-cover"
              preload="metadata"
              playsInline
              muted
              onError={(e) => {
                console.error('Failed to load video:', mediaUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="fas fa-play text-white text-4xl opacity-50"></i>
            </div>
          </div>
        )}

        <div className="px-3 md:px-4 py-2.5 flex items-center justify-between text-[#B0B3B8] text-[14px] border-t border-[#3E4042]">
          <div className="flex items-center gap-1.5">
            {finalReactionCount > 0 && (
              <span className="hover:underline">{formatCount(finalReactionCount)} Reactions</span>
            )}
          </div>
          <div className="flex gap-4">
            <span
              className="hover:underline cursor-pointer"
              onClick={() => onOpenComments(postId)}
            >
              {formatCount(commentCount)} Comments
            </span>
            {shareCount > 0 && (
              <span className="hover:underline">
                {formatCount(shareCount)} Shares
              </span>
            )}
          </div>
        </div>

        <div className="px-2 py-1 border-t border-[#3E4042] flex items-center justify-between">
          <ReactionButton
            currentUserReactions={finalMyReaction}
            reactionCount={finalReactionCount}
            onReact={handleLikeClick}
            isGuest={!currentUser}
          />
          <button
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
            onClick={() => currentUser ? onOpenComments(postId) : alert('Login first')}
          >
            <i className="far fa-comment-alt text-[20px]"></i>
            <span className="text-[17px] font-medium">Comment</span>
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
            onClick={() => {
              if (!currentUser) {
                alert('Please login to share posts.');
                return;
              }
              setShowShareSheet(true);
            }}
          >
            <i className="fas fa-share text-[20px]"></i>
            <span className="text-[17px] font-medium">Share</span>
          </button>
        </div>
      </div>

      <ShareBottomSheet
        isOpen={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        post={p}
        currentUser={currentUser}
        users={users}
        onShareComplete={handleShareComplete}
      />
    </>
  );
};

interface GroupsPageProps {
  currentUser: User | null;
  groups: Group[];
  users: User[];

  // Group management functions
  onCreateGroup: (group: Partial<Group>) => Promise<any>;
  onJoinGroup: (groupId: number) => Promise<any>;
  onLeaveGroup: (groupId: number) => Promise<any>;
  onDeleteGroup: (groupId: number) => Promise<any>;

  // Group content functions
  onUpdateGroupImage: (groupId: number, type: 'cover' | 'profile', file: File) => Promise<any>;
  onPostToGroup: (groupId: number, content: string, file?: File | null) => Promise<any>;
  onCreateGroupEvent: (groupId: number, event: Partial<Event>) => Promise<any>;
  onInviteToGroup: (groupId: number, userIds: number[]) => Promise<any>;

  // Interaction functions
  onProfileClick: (id: number) => void;
  onLikePost: (postId: number, type?: ReactionType) => Promise<{ liked: boolean; likes_count: number }>;
  onSharePost: (postId: number, newShareCount: number) => void;
  onDeleteGroupPost: (groupId: number, postId: number) => Promise<any>;
  onEditGroupPost?: (postId: number, content: string) => Promise<any>;
  onReportGroupPost?: (postId: number) => Promise<any>;
  onRemoveMember: (groupId: number, memberId: number) => Promise<any>;
  onUpdateGroupSettings: (groupId: number, settings: Partial<Group>) => Promise<any>;

  // Event RSVP function
  onEventRSVP?: (eventId: number, status: string) => Promise<any>;

  // Optional functions
  fetchGroupPosts?: (groupId: number) => Promise<any[]>;
  fetchGroupDetails?: (groupId: number) => Promise<{ group: Group; members: any[]; events?: Event[] }>;
  fetchGroupEvents?: (groupId: number) => Promise<Event[]>;
  fetchComments?: (postId: number) => Promise<any[]>;
  onComment?: (postId: number, text: string, parent_comment_id?: number | null) => Promise<any>;
  onLikeComment?: (commentId: number) => Promise<any>;

  // Other props
  initialGroupId?: string | null;
  onPlayAudioTrack?: (track: any) => void;
  onFollow?: (userId: number) => Promise<any>;
  checkIsFollowing?: (userId: number) => boolean;
  onHashtagClick?: (tag: string) => void;
  onViewImage?: (url: string) => void;
  onVideoClick?: (post: PostType) => void;
}

export const GroupsPage: React.FC<GroupsPageProps> = ({
  currentUser,
  groups,
  users,
  onCreateGroup,
  onJoinGroup,
  onLeaveGroup,
  onDeleteGroup,
  onUpdateGroupImage,
  onPostToGroup,
  onCreateGroupEvent,
  onInviteToGroup,
  onProfileClick,
  onLikePost,
  onSharePost,
  onDeleteGroupPost,
  onEditGroupPost,
  onReportGroupPost,
  onRemoveMember,
  onUpdateGroupSettings,
  onEventRSVP,
  fetchGroupPosts,
  fetchGroupDetails,
  fetchGroupEvents,
  fetchComments,
  onComment,
  onLikeComment,
  initialGroupId,
  onPlayAudioTrack,
  onFollow,
  checkIsFollowing,
  onHashtagClick,
  onViewImage,
  onVideoClick,
}) => {
  const [view, setView] = useState<'feed' | 'detail'>('feed');
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [groupTab, setGroupTab] = useState<'Discussion' | 'Events' | 'Members' | 'About'>('Discussion');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGroupPostModal, setShowGroupPostModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);

  // Full Post View state
  const [showPostView, setShowPostView] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostType | null>(null);
  const [selectedPostAuthor, setSelectedPostAuthor] = useState<User | null>(null);

  // Events state
  const [groupEvents, setGroupEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Facebook-like tabs for groups feed
  const [fbTab, setFbTab] = useState<'Your groups' | 'Posts' | 'Discover' | 'Invites'>('Your groups');
  const [sortOpen, setSortOpen] = useState(false);
  const [sortMode, setSortMode] = useState<'Most visited' | 'Recently active' | 'Alphabetical'>('Most visited');
  
  // Pinned groups state
  const [pinnedGroups, setPinnedGroups] = useState<Set<number>>(new Set());

  // Group posts state
  const [groupPosts, setGroupPosts] = useState<PostType[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const groupCoverInputRef = useRef<HTMLInputElement>(null);
  const groupProfileInputRef = useRef<HTMLInputElement>(null);
  const postFileInputRef = useRef<HTMLInputElement>(null);

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupType, setNewGroupType] = useState<'public' | 'private'>('public');

  const [postContent, setPostContent] = useState('');
  const [postFile, setPostFile] = useState<File | null>(null);

  // normalize ALL groups so missing arrays never crash UI
  const safeGroups = useMemo(() => (groups || []).map(normalizeGroup), [groups]);

  useEffect(() => {
    if (!initialGroupId) return;
    const gid = parseInt(initialGroupId, 10);
    if (Number.isNaN(gid)) return;

    const group = safeGroups.find(g => g.id === gid);
    if (group) {
      setActiveGroupId(group.id);
      setView('detail');
      setGroupTab('Discussion');
    }
  }, [initialGroupId, safeGroups]);

  const activeGroup = useMemo(
    () => safeGroups.find(g => g.id === activeGroupId) || null,
    [safeGroups, activeGroupId]
  );

  // Load group posts when active group changes - ✅ Fixed dependency
  const loadGroupPosts = useCallback(async () => {
    if (!activeGroup || !fetchGroupPosts) return;
    
    setLoadingPosts(true);
    try {
      const posts = await fetchGroupPosts(activeGroup.id);
      setGroupPosts(posts.map(normalizePost));
    } catch (error) {
      console.error('Failed to load group posts:', error);
      setGroupPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, [activeGroup, fetchGroupPosts]);

  // ✅ Updated useEffect with proper dependencies
  useEffect(() => {
    loadGroupPosts();
  }, [loadGroupPosts]);

  // Load group events when active group changes and Events tab is selected
  const loadGroupEvents = useCallback(async () => {
    if (!activeGroup || !fetchGroupEvents) return;
    
    setLoadingEvents(true);
    try {
      const events = await fetchGroupEvents(activeGroup.id);
      setGroupEvents(events.map(normalizeEvent));
    } catch (error) {
      console.error('Failed to load group events:', error);
      setGroupEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [activeGroup, fetchGroupEvents]);

  useEffect(() => {
    if (activeGroup && groupTab === 'Events' && fetchGroupEvents) {
      loadGroupEvents();
    }
  }, [activeGroup, groupTab, fetchGroupEvents, loadGroupEvents]);

  useEffect(() => {
    if (!showGroupPostModal) {
      setPostContent('');
      setPostFile(null);
    }
  }, [showGroupPostModal]);

  // Load pinned groups from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('pinnedGroups');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setPinnedGroups(new Set(parsed));
        }
      } catch (e) {
        console.error('Failed to load pinned groups:', e);
      }
    }
  }, []);

  // Save pinned groups to localStorage when they change
  useEffect(() => {
    if (pinnedGroups.size > 0 || localStorage.getItem('pinnedGroups')) {
      localStorage.setItem('pinnedGroups', JSON.stringify(Array.from(pinnedGroups)));
    }
  }, [pinnedGroups]);

  const handleGroupClick = (group: Group) => {
    setActiveGroupId(group.id);
    setView('detail');
    setGroupTab('Discussion');
    window.scrollTo(0, 0);
  };

  const handleCreateSubmit = async () => {
    if (!newGroupName.trim()) return;

    try {
      await onCreateGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        type: newGroupType,
        profile_image: `https://ui-avatars.com/api/?name=${encodeURIComponent(newGroupName)}&background=random`,
        cover_image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1500&q=80',
      });

      setShowCreateModal(false);
      setNewGroupName('');
      setNewGroupDesc('');
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  const handlePostSubmit = async () => {
    if (!activeGroup) return;
    if (!postContent.trim() && !postFile) return;

    try {
      await onPostToGroup(activeGroup.id, postContent.trim(), postFile);
      setShowGroupPostModal(false);
      setPostContent('');
      setPostFile(null);
      
      // Reload posts
      if (fetchGroupPosts) {
        loadGroupPosts();
      }
    } catch (error) {
      console.error('Failed to create group post:', error);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'profile') => {
    if (e.target.files && e.target.files[0] && activeGroup) {
      try {
        await onUpdateGroupImage(activeGroup.id, type, e.target.files[0]);
      } catch (error) {
        console.error('Failed to update group image:', error);
      }
    }
  };

  const handleCreateEvent = async (eventData: Partial<Event>) => {
    if (!activeGroup || !currentUser) return;
    
    try {
      await onCreateGroupEvent(activeGroup.id, {
        ...eventData,
        created_by: currentUser.id,
        group_id: activeGroup.id
      });
      
      setShowEventModal(false);
      
      if (groupTab === 'Events' && fetchGroupEvents) {
        await loadGroupEvents();
      }
    } catch (error) {
      console.error('Failed to create event:', error);
      throw error;
    }
  };

  const handleEventRSVP = async (eventId: number, status: string) => {
    if (!onEventRSVP) return;
    
    try {
      await onEventRSVP(eventId, status);
      
      setGroupEvents(prev => prev.map(event => {
        if (event.id === eventId) {
          return { 
            ...event, 
            user_rsvp_status: status,
            attendees: status === 'going' 
              ? [...(event.attendees || []), currentUser?.id]
              : (event.attendees || []).filter(id => id !== currentUser?.id)
          } as any;
        }
        return event;
      }));
    } catch (error) {
      console.error('Failed to RSVP to event:', error);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  const togglePinGroup = (groupId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const computeVisits = (g: Group) => {
    return Number((g as any)?.visits ?? ((g.posts?.length ?? 0) * 5 + (g.members?.length ?? 0)));
  };

  const computeLastActive = (g: Group) => {
    const fromField = Number((g as any)?.lastActiveAt ?? 0);
    if (fromField) return fromField;

    const newest = (g.posts ?? [])
      .map((p: any) => new Date(p?.created_at ?? 0).getTime())
      .filter((t: number) => Number.isFinite(t))
      .sort((a: number, b: number) => b - a)[0];

    return newest || 0;
  };

  const formatNewPostsText = (g: Group) => {
    const count = Number((g as any)?.newPostsCount ?? 0);
    if (count > 25) return '25+ new posts';
    if (count > 0) return `${count} new posts`;

    const updated = String((g as any)?.updatedAt ?? '').trim();
    return updated ? updated : 'Updated recently';
  };

  const hasNewPosts = (g: Group) => Number((g as any)?.newPostsCount ?? 0) > 0;

  const handleLikePost = async (postId: number, type?: ReactionType) => {
    if (!currentUser) return;
    
    try {
      const result = await onLikePost(postId, type);
      
      setGroupPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            my_reaction: result.liked ? (type || 'like') : null,
            reactions_count: result.likes_count,
          } as any;
        }
        return post;
      }));

      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost(prev => prev ? {
          ...prev,
          my_reaction: result.liked ? (type || 'like') : null,
          reactions_count: result.likes_count,
        } as any : null);
      }
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const handleJoinGroup = async () => {
    if (!activeGroup || !currentUser) return;
    
    try {
      await onJoinGroup(activeGroup.id);
      if (fetchGroupDetails) {
        const details = await fetchGroupDetails(activeGroup.id);
      }
    } catch (error) {
      console.error('Failed to join group:', error);
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeGroup || !currentUser) return;
    
    try {
      await onLeaveGroup(activeGroup.id);
      if (fetchGroupDetails) {
        const details = await fetchGroupDetails(activeGroup.id);
      }
    } catch (error) {
      console.error('Failed to leave group:', error);
    }
  };

  const handleOpenComments = (postId: number) => {
    const post = groupPosts.find(p => p.id === postId);
    if (!post) return;

    const author = users.find(u => u.id === post.user_id);
    if (!author) return;

    setSelectedPost(post);
    setSelectedPostAuthor(author);
    setShowPostView(true);
  };

  const handleSharePost = async (postId: number, newShareCount: number) => {
    try {
      await onSharePost(postId, newShareCount);
      
      setGroupPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return { ...post, shares: newShareCount } as any;
        }
        return post;
      }));

      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost(prev => prev ? { ...prev, shares: newShareCount } as any : null);
      }
    } catch (error) {
      console.error('Failed to share post:', error);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!activeGroup) return;
    
    try {
      await onDeleteGroupPost(activeGroup.id, postId);
      setGroupPosts(prev => prev.filter(post => post.id !== postId));
      
      if (selectedPost && selectedPost.id === postId) {
        setShowPostView(false);
        setSelectedPost(null);
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  };

  const handleEditPost = async (postId: number, content: string) => {
    if (!onEditGroupPost) return;
    
    try {
      await onEditGroupPost(postId, content);
      
      // Update local state
      setGroupPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return { ...post, content } as any;
        }
        return post;
      }));

      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost(prev => prev ? { ...prev, content } as any : null);
      }
    } catch (error) {
      console.error('Failed to edit post:', error);
      throw error;
    }
  };

  const handleReportPost = async (postId: number) => {
    if (!onReportGroupPost) return;
    
    try {
      await onReportGroupPost(postId);
    } catch (error) {
      console.error('Failed to report post:', error);
      throw error;
    }
  };

  // FEED VIEW (Facebook-style with dark theme)
  if (view === 'feed' || !activeGroup) {
    return (
      <>
        <div className="w-full bg-[#121212] min-h-screen font-sans pb-24">
          {/* Top header with dark theme - unchanged */}
          <div className="sticky top-0 z-[50] bg-[#1e1e1e] border-b border-[#333]">
            {/* ... (same as before) */}
          </div>

          {/* Content */}
          <div className="max-w-[900px] mx-auto">
            {/* ... (same as before) */}
          </div>

          {/* Create Group modal - unchanged */}
          {/* Sort Bottom Sheet - unchanged */}
        </div>

        {/* Full Post View */}
        {showPostView && selectedPost && selectedPostAuthor && currentUser && (
          <CommentsSheet
            post={selectedPost}
            currentUser={currentUser}
            users={users}
            onClose={() => {
              setShowPostView(false);
              setSelectedPost(null);
              setSelectedPostAuthor(null);
            }}
            onComment={onComment}
            onLikeComment={onLikeComment}
            onProfileClick={onProfileClick}
            onHashtagClick={onHashtagClick}
            onFollow={onFollow}
            checkIsFollowing={checkIsFollowing}
          />
        )}
      </>
    );
  }

  // DETAIL VIEW
  const isMember = currentUser
    ? (activeGroup.members ?? []).includes(currentUser.id) || activeGroup.admin_id === currentUser.id
    : false;

  const isGroupAdmin = currentUser && activeGroup.admin_id === currentUser.id;
  const canManage = Boolean(isGroupAdmin || isAdmin);
  const canPost = canManage || (activeGroup.member_posting_allowed ?? true);

  const createdDate =
    activeGroup.created_at && !Number.isNaN(new Date(activeGroup.created_at as any).getTime())
      ? new Date(activeGroup.created_at as any)
      : null;

  return (
    <>
      <div className="w-full bg-[#121212] min-h-screen pb-10">
        {/* Header with cover image - unchanged */}
        <div className="bg-[#1e1e1e] border-b border-[#333] shadow-sm mb-4 animate-fade-in">
          {/* ... (same as before) */}
        </div>

        <div className="max-w-[700px] mx-auto px-0 md:px-4">
          {/* Discussion Tab */}
          {groupTab === 'Discussion' && (
            <div className="animate-fade-in">
              {isMember && canPost && (
                <div
                  className="bg-[#1e1e1e] rounded-xl p-3 mb-4 border border-[#333] shadow-sm flex gap-3 items-center cursor-pointer mx-2 md:mx-0 transition-colors hover:bg-[#2d2d2d]"
                  onClick={() => setShowGroupPostModal(true)}
                >
                  <img src={currentUser?.profile_image_url} className="w-10 h-10 rounded-full bg-[#2d2d2d] object-cover" alt="" />
                  <div className="flex-1 bg-[#2d2d2d] transition-colors rounded-full px-4 py-2.5">
                    <span className="text-[#b0b3b8] text-[17px]">Post something in {activeGroup.name}...</span>
                  </div>
                  <div className="text-[#45BD62] hover:bg-[#2d2d2d] p-2 rounded-full transition-colors">
                    <i className="fas fa-images text-xl"></i>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {activeGroup.type === 'private' && !isMember ? (
                  <div className="bg-[#1e1e1e] rounded-xl p-12 text-center border border-[#333] mx-4 md:mx-0 shadow-sm">
                    <div className="w-16 h-16 bg-[#2d2d2d] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#333]">
                      <i className="fas fa-lock text-[#b0b3b8] text-2xl"></i>
                    </div>
                    <h3 className="text-[#e4e6eb] font-bold text-xl mb-2">This Group is Private</h3>
                    <p className="text-[#b0b3b8] mb-8 max-w-xs mx-auto">Only members of this community can see the discussions and members.</p>
                    <button
                      onClick={handleJoinGroup}
                      className="bg-[#1877f2] text-white px-10 py-2.5 rounded-lg font-black shadow-lg hover:bg-[#166fe5] transition-all active:scale-95"
                    >
                      Join Group
                    </button>
                  </div>
                ) : groupPosts.length > 0 ? (
                  groupPosts.map((post) => {
                    const author = users.find(u => u.id === post.user_id) || {
                      id: post.user_id || 0,
                      username: 'unknown',
                      name: 'Unknown User',
                      profile_image_url: 'https://ui-avatars.com/api/?name=User&background=random',
                      followers: [],
                      following: [],
                      email: '',
                      is_verified: false,
                      role: 'user',
                      is_online: false,
                      location: '',
                      bio: '',
                      created_at: null,
                    };
                    
                    return (
                      <GroupPost
                        key={post.id}
                        post={post}
                        author={author}
                        currentUser={currentUser}
                        users={users}
                        isGroupAdmin={isGroupAdmin}
                        isPlatformAdmin={isAdmin}  // ✅ Pass platform admin status
                        onProfileClick={onProfileClick}
                        onLikePost={handleLikePost}
                        onOpenComments={handleOpenComments}
                        onSharePost={handleSharePost}
                        onEditPost={onEditGroupPost ? handleEditPost : undefined}
                        onDeletePost={(postId) => handleDeletePost(postId)}  // ✅ Fixed: passes postId correctly
                        onReportPost={onReportGroupPost ? handleReportPost : undefined}
                        onViewImage={onViewImage}
                        onVideoClick={onVideoClick}
                        onHashtagClick={onHashtagClick}
                        onFollow={onFollow}
                        checkIsFollowing={checkIsFollowing}
                      />
                    );
                  })
                ) : loadingPosts ? (
                  <div className="bg-[#1e1e1e] rounded-xl p-16 text-center border border-[#333] mx-4 md:mx-0 shadow-sm">
                    <div className="w-16 h-16 bg-[#2d2d2d] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#333]">
                      <i className="fas fa-spinner fa-spin text-[#b0b3b8] text-2xl"></i>
                    </div>
                    <h3 className="text-[#e4e6eb] font-bold text-lg mb-1">Loading posts...</h3>
                  </div>
                ) : (
                  <div className="bg-[#1e1e1e] rounded-xl p-16 text-center border border-[#333] mx-4 md:mx-0 shadow-sm">
                    <div className="w-16 h-16 bg-[#2d2d2d] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#333]">
                      <i className="fas fa-comments text-[#b0b3b8] text-2xl"></i>
                    </div>
                    <h3 className="text-[#e4e6eb] font-bold text-lg mb-1">No posts yet</h3>
                    <p className="text-[#b0b3b8] text-sm">Be the first to start a conversation in this group!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Events Tab - unchanged */}
          {groupTab === 'Events' && (
            <div className="animate-fade-in">
              {/* ... (same as before) */}
            </div>
          )}

          {/* About Tab - unchanged */}
          {groupTab === 'About' && (
            <div className="bg-[#1e1e1e] rounded-xl p-8 border border-[#333] mx-4 md:mx-0 shadow-sm animate-fade-in">
              {/* ... (same as before) */}
            </div>
          )}

          {/* Members Tab - unchanged */}
          {groupTab === 'Members' && (
            <div className="bg-[#1e1e1e] rounded-xl border border-[#333] mx-4 md:mx-0 overflow-hidden shadow-sm animate-fade-in">
              {/* ... (same as before) */}
            </div>
          )}
        </div>

        {/* Create Post Modal - unchanged */}
        {showGroupPostModal && (
          <div className="fixed inset-0 z-[150] bg-[#121212] flex flex-col animate-slide-up font-sans">
            {/* ... (same as before) */}
          </div>
        )}

        {/* Settings Modal - unchanged */}
        {showSettingsModal && activeGroup && (
          <GroupSettingsModal
            group={activeGroup}
            onClose={() => setShowSettingsModal(false)}
            onUpdate={settings => onUpdateGroupSettings(activeGroup.id, settings)}
            isAdmin={Boolean(isAdmin)}
            onDeleteGroup={() => {
              onDeleteGroup(activeGroup.id);
              setShowSettingsModal(false);
              setView('feed');
            }}
          />
        )}

        {/* Create Event Modal - ✅ Now works with groupId/groupName props */}
        {showEventModal && currentUser && activeGroup && (
          <CreateEventModal
            currentUser={currentUser}
            onClose={() => setShowEventModal(false)}
            onCreate={(eventData) => handleCreateEvent(eventData)}
            groupId={activeGroup.id}
            groupName={activeGroup.name}
          />
        )}
      </div>

      {/* Full Post View for Groups */}
      {showPostView && selectedPost && selectedPostAuthor && currentUser && (
        <CommentsSheet
          post={selectedPost}
          currentUser={currentUser}
          users={users}
          onClose={() => {
            setShowPostView(false);
            setSelectedPost(null);
            setSelectedPostAuthor(null);
          }}
          onComment={onComment}
          onLikeComment={onLikeComment}
          onProfileClick={onProfileClick}
          onHashtagClick={onHashtagClick}
          onFollow={onFollow}
          checkIsFollowing={checkIsFollowing}
        />
      )}
    </>
  );
};

// Helper functions
function normalizeGroup(raw: any): Group {
  const members = Array.isArray(raw?.members) ? raw.members : [];
  const posts = Array.isArray(raw?.posts) ? raw.posts : [];
  const events = Array.isArray(raw?.events) ? raw.events : [];

  return {
    ...raw,
    id: Number(raw?.id ?? raw?.groupId ?? 0),
    admin_id: Number(raw?.admin_id ?? raw?.adminId ?? 0),
    name: String(raw?.name ?? 'Untitled Group'),
    description: String(raw?.description ?? ''),
    type: (raw?.type === 'private' ? 'private' : 'public') as any,
    cover_image: String(raw?.cover_image ?? raw?.coverImage ?? ''),
    profile_image: String(raw?.profile_image ?? raw?.profileImage ?? ''),
    created_at: raw?.created_at ?? new Date().toISOString(),
    member_posting_allowed: raw?.member_posting_allowed ?? true,
    members,
    posts,
    events,
    members_count: Number(raw?.members_count ?? members.length),
  } as Group;
}

function normalizePost(post: any): PostType {
  const mediaUrl = post?.media_url ?? post?.mediaUrl ?? null;
  const mediaType = post?.media_type ?? post?.mediaType ?? null;

  return {
    ...post,
    id: Number(post?.id ?? post?.post_id ?? 0),
    user_id: Number(post?.user_id ?? post?.authorId ?? 0),
    content: String(post?.content ?? post?.text ?? ''),
    media_url: mediaUrl,
    media_type: mediaType,
    type: post?.type ?? (mediaUrl ? (mediaType?.startsWith('image/') ? 'image' : 'video') : 'text'),
    reactions: Array.isArray(post?.reactions) ? post.reactions : [],
    comments: Array.isArray(post?.comments) ? post.comments : [],
    shares: Number(post?.shares ?? 0),
    views: Number(post?.views ?? 0),
    created_at: post?.created_at ?? new Date().toISOString(),
    visibility: 'public',
    groupId: post?.groupId ? Number(post.groupId) : null,
    my_reaction: post?.my_reaction ?? null,
    reactions_count: Number(post?.reactions_count ?? post?.likesCount ?? 0),
  } as any;
}

function normalizeEvent(event: any): Event {
  return {
    ...event,
    id: Number(event?.id ?? 0),
    title: String(event?.title ?? ''),
    description: String(event?.description ?? ''),
    start_time: event?.start_time ?? event?.date ?? new Date().toISOString(),
    end_time: event?.end_time ?? null,
    location: event?.location ?? null,
    cover_image: event?.cover_image ?? null,
    attendees: Array.isArray(event?.attendees) ? event.attendees : [],
    created_by: Number(event?.created_by ?? 0),
    group_id: event?.group_id ? Number(event.groupId) : null,
    created_at: event?.created_at ?? new Date().toISOString(),
    user_rsvp_status: event?.user_rsvp_status ?? null,
  };
}
