import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { User, Group, Event, Post as PostType, ReactionType } from '../types';
import { 
  Post, 
  CommentsSheet,
  formatRelativeTime,
  ReactionButton,
  ShareBottomSheet,
  RichText,
  getMediaTypeInfo,
  avatarFrom,
  topReactionEmojis
} from './Feed';
import { CreateEventModal } from './Events';

// ✅ Spark icon (React)
const SparkReactIcon: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="uneraSparkGrad" x1="12" y1="52" x2="52" y2="12">
        <stop offset="0%" stopColor="#FF7A45" />
        <stop offset="55%" stopColor="#FF5A6A" />
        <stop offset="100%" stopColor="#FF8A3D" />
      </linearGradient>
      <filter id="uneraSparkGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <circle cx="32" cy="32" r="18" fill="url(#uneraSparkGrad)" opacity="0.14" />
    <g stroke="url(#uneraSparkGrad)" strokeWidth="5.2" strokeLinecap="round" filter="url(#uneraSparkGlow)">
      <line x1="32" y1="10" x2="32" y2="18" />
      <line x1="32" y1="46" x2="32" y2="54" />
      <line x1="10" y1="32" x2="18" y2="32" />
      <line x1="46" y1="32" x2="54" y2="32" />
      <line x1="17" y1="17" x2="22.8" y2="22.8" />
      <line x1="41.2" y1="41.2" x2="47" y2="47" />
      <line x1="47" y1="17" x2="41.2" y2="22.8" />
      <line x1="22.8" y1="41.2" x2="17" y2="47" />
    </g>
    <circle cx="32" cy="32" r="6.2" fill="url(#uneraSparkGrad)" />
  </svg>
);

// ✅ Discuss icon
const DiscussSignalIcon: React.FC<{ size?: number; color?: string }> = ({ size = 26, color = "#1877F2" }) => (
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

const fmtCount = (n: number) => {
  const num = Number(n || 0);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(num % 1_000 === 0 ? 0 : 1) + "K";
  return String(num);
};

const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeString = (v: any, fallback = '') => (typeof v === 'string' ? v : String(v || ''));
const safeBoolean = (v: any, fallback = false) => (typeof v === 'boolean' ? v : !!v);

type GroupCategory = 'general' | 'recruitment' | 'buy_sell';

interface CategoryOption {
  id: GroupCategory;
  label: string;
  description: string;
  icon: string;
  previewIcon: string;
  color: string;
  features: string[];
}

const GROUP_CATEGORIES: CategoryOption[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Standard group for discussions and community',
    icon: 'fas fa-users',
    previewIcon: 'fas fa-comments',
    color: '#1877F2',
    features: ['Discussions', 'Media sharing', 'Member posts']
  },
  {
    id: 'recruitment',
    label: 'Recruitment',
    description: 'Find talent, job opportunities, and professional networking',
    icon: 'fas fa-briefcase',
    previewIcon: 'fas fa-user-plus',
    color: '#45BD62',
    features: ['Job postings', 'Talent search', 'Professional networking']
  },
  {
    id: 'buy_sell',
    label: 'Buy and Sell',
    description: 'Marketplace for buying, selling, and trading items',
    icon: 'fas fa-store',
    previewIcon: 'fas fa-tag',
    color: '#F7B928',
    features: ['Item listings', 'Price tags', 'Location filtering', 'Sold/Pending status']
  }
];

const CURRENCY_OPTIONS = [
  { code: 'TSh', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
];

type NormalizedMedia = { url: string; kind: 'image' | 'video' };

const getPostMediaList = (post: any): NormalizedMedia[] => {
  const out: NormalizedMedia[] = [];

  let mediaUrls: string[] = [];
  if (post?.media_urls) {
    if (Array.isArray(post.media_urls)) mediaUrls = post.media_urls;
    else if (typeof post.media_urls === 'string') {
      try { const parsed = JSON.parse(post.media_urls); mediaUrls = Array.isArray(parsed) ? parsed : []; } catch { mediaUrls = []; }
    }
  }

  let images: string[] = [];
  if (post?.images) {
    if (Array.isArray(post.images)) images = post.images;
    else if (typeof post.images === 'string') {
      try { const parsed = JSON.parse(post.images); images = Array.isArray(parsed) ? parsed : []; } catch { images = []; }
    }
  }

  const arrUrls: any[] = mediaUrls.length ? mediaUrls : images;
  for (const u of arrUrls) {
    const url = String(u || '').trim();
    if (!url) continue;
    out.push({ url, kind: 'image' });
  }

  const arrMedia: any[] = Array.isArray(post?.media) ? post.media : [];
  for (const m of arrMedia) {
    const url = String(m?.url || m?.media_url || '').trim();
    if (!url) continue;
    const type = String(m?.type || m?.media_type || '').toLowerCase();
    const clean = url.split('?')[0].split('#')[0];
    const ext = clean.split('.').pop()?.toLowerCase() || '';
    const isVideo = type.startsWith('video') || ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', '3gp'].includes(ext);
    out.push({ url, kind: isVideo ? 'video' : 'image' });
  }

  if (out.length === 0) {
    const single = String(post?.media_url || '').trim();
    if (single) {
      const mediaTypeRaw = String(post?.media_type || '').toLowerCase();
      const ext = single.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || '';
      const isVideo = mediaTypeRaw.startsWith('video') || ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', '3gp'].includes(ext);
      out.push({ url: single, kind: isVideo ? 'video' : 'image' });
    }
  }

  return out.filter((x) => x.url);
};

const ExpandableRichText: React.FC<{
  text: string;
  users?: User[];
  onProfileClick: (id: number) => void;
  onHashtagClick?: (tag: string) => void;
  maxWords?: number;
  fontSizePx?: number;
  onSeeMore?: () => void;
  forceExpanded?: boolean;
}> = ({ text = '', users = [], onProfileClick, onHashtagClick, maxWords = 25, fontSizePx = 21, onSeeMore, forceExpanded = false }) => {
  const [expanded, setExpanded] = useState(false);
  const safeText = safeString(text);
  const words = safeText.trim().split(/\s+/).filter(Boolean);
  const isLong = words.length > maxWords;
  const showAll = forceExpanded || expanded || !isLong;
  const shownText = showAll ? safeText : words.slice(0, maxWords).join(' ') + '…';
  return (
    <div style={{ fontSize: `${fontSizePx}px` }} className="text-[#E4E6EB] leading-relaxed whitespace-pre-wrap">
      <RichText text={shownText} users={users} onProfileClick={onProfileClick} onHashtagClick={onHashtagClick} />
      {isLong && !forceExpanded && (
        <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }} className="ml-2 font-bold text-[#1877F2] hover:underline">
          {expanded ? 'See less' : 'See more'}
        </button>
      )}
    </div>
  );
};

const MediaGrid: React.FC<{ media: { url: string; kind?: string }[]; onOpen: (url: string, index: number) => void; }> = ({ media = [], onOpen }) => {
  const total = media.length;
  const show = total <= 4 ? media : media.slice(0, 4);
  const extra = total - 4;

  const Tile = ({ url, index, className, showOverlay }: { url: string; index: number; className: string; showOverlay?: boolean }) => (
    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(url, index); }} className={`relative overflow-hidden ${className}`} style={{ borderRadius: 0 }}>
      <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      {showOverlay && extra > 0 && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <span className="text-white font-black text-3xl">+{extra}</span>
        </div>
      )}
    </button>
  );

  if (total === 0) return null;
  if (total === 1) {
    return (
      <div className="w-full bg-black">
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(show[0].url, 0); }} className="w-full block">
          <img src={show[0].url} alt="" loading="lazy" className="w-full h-auto max-h-[650px] object-contain" />
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
      <Tile url={show[3].url} index={3} className="h-[260px] w-full" showOverlay={extra > 0} />
    </div>
  );
};

const GalleryViewer: React.FC<{
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
}> = ({ isOpen, urls, startIndex, onClose, postId, currentUser, reactionCount, commentCount, shareCount, myReaction, onReact, onOpenComments, onShare, onOpenReactions }) => {
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
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, startIndex]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const width = el.clientWidth || window.innerWidth;
    const newIndex = Math.round(scrollLeft / width);
    if (newIndex !== currentIndex) setCurrentIndex(newIndex);
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  const reactionEmoji = (t: string) => {
    switch (t) {
      case 'like': return '👍';
      case 'love': return '❤️';
      case 'haha': return '😂';
      case 'wow': return '😮';
      case 'sad': return '😢';
      case 'angry': return '😡';
      case 'fire': return '🔥';
      case 'party': return '🎉';
      default: return '👍';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col" onClick={(e) => e.stopPropagation()}>
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-black/40" onClick={(e) => e.stopPropagation()}>
        <div className="text-white text-sm font-semibold">{currentIndex + 1}/{urls.length}</div>
        <button className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center" onClick={onClose} aria-label="Close">
          <i className="fas fa-times text-white text-lg"></i>
        </button>
      </div>
      <div ref={scrollerRef} className="flex-1 w-full overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }} onClick={(e) => e.stopPropagation()} onScroll={handleScroll}>
        {urls.map((url, i) => (
          <div key={url + i} className="min-w-full h-full snap-center flex items-center justify-center bg-black">
            <img src={url} alt="" className="max-w-full max-h-full object-contain" draggable={false} onClick={(e) => e.stopPropagation()} />
          </div>
        ))}
      </div>
      <div className="bg-black/80 backdrop-blur-sm border-t border-white/10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
        {reactionCount > 0 && (
          <button onClick={(e) => { e.stopPropagation(); if (onOpenReactions) onOpenReactions(); }} className="w-full flex items-center justify-between px-2 py-2 hover:bg-[#3A3B3C] rounded-lg mb-2 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[18px]">{reactionEmoji("love")}</span>
                <span className="-ml-1 text-[18px]">{reactionEmoji("like")}</span>
              </div>
              <span className="text-[15px] text-[#B0B3B8] font-medium">{fmtCount(reactionCount)}</span>
            </div>
            <i className="fas fa-chevron-right text-[#B0B3B8] text-[12px]" />
          </button>
        )}
        <div className="flex items-center justify-between text-[#B0B3B8] text-sm mb-2 px-2">
          <div className="flex items-center gap-2">
            {reactionCount > 0 && (
              <span className="text-[#E4E6EB] font-bold cursor-pointer hover:underline flex items-center gap-2" onClick={onOpenReactions}>
                <div className="flex -space-x-2">
                  {Array.from(new Set([myReaction, 'like', 'love'])).filter(Boolean).slice(0, 2).map((t, i) => (
                    <span key={i} className="w-[22px] h-[22px] rounded-full bg-[#3A3B3C] border border-black flex items-center justify-center text-[14px]">
                      {reactionEmoji(t as string)}
                    </span>
                  ))}
                </div>
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <span className="hover:underline cursor-pointer" onClick={onOpenComments}>{formatCount(commentCount)} Discussions</span>
            {shareCount > 0 && (<span className="hover:underline cursor-pointer" onClick={onShare}>{formatCount(shareCount)} Shares</span>)}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <ReactionButton currentUserReactions={myReaction} reactionCount={reactionCount} onReact={onReact} isGuest={!currentUser} />
          <button className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors text-[#B0B3B8]" onClick={() => (currentUser ? onOpenComments() : alert("Login first"))}>
            <DiscussSignalIcon size={26} color="#1877F2" />
            <span className="text-[17px] font-medium">Discuss</span>
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors text-[#B0B3B8]" onClick={() => (currentUser ? onShare() : alert("Please login to share posts."))}>
            <i className="fas fa-share text-[20px]"></i>
            <span className="text-[17px] font-medium">Share</span>
          </button>
        </div>
      </div>
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

const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({ group, onClose, onUpdate, isAdmin, onDeleteGroup }) => {
  const [name, setName] = useState(group.name || '');
  const [desc, setDesc] = useState(group.description || '');
  const [postingAllowed, setPostingAllowed] = useState(group.member_posting_allowed ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onUpdate({ name: name.trim(), description: desc.trim(), member_posting_allowed: postingAllowed });
    } catch (error) { console.error('Failed to update group settings:', error); } finally { setSaving(false); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-[#1e1e1e] w-full max-w-[500px] rounded-xl border border-[#333] shadow-2xl flex flex-col animate-slide-up">
        <div className="p-4 border-b border-[#333] flex justify-between items-center">
          <h3 className="text-xl font-bold text-[#e4e6eb]">Group Settings</h3>
          <div onClick={onClose} className="w-8 h-8 rounded-full bg-[#2d2d2d] hover:bg-[#3a3a3a] flex items-center justify-center cursor-pointer transition-colors"><i className="fas fa-times text-[#b0b3b8]"></i></div>
        </div>
        <div className="p-4 space-y-4">
          <div><label className="block text-[#b0b3b8] text-sm font-bold mb-1">Group Name</label><input type="text" className="w-full bg-[#2d2d2d] border border-[#333] rounded-lg p-2.5 text-[#e4e6eb] outline-none" value={name} onChange={e => setName(e.target.value)} /></div>
          <div><label className="block text-[#b0b3b8] text-sm font-bold mb-1">Description</label><textarea className="w-full bg-[#2d2d2d] border border-[#333] rounded-lg p-2.5 text-[#e4e6eb] outline-none h-24 resize-none" value={desc} onChange={e => setDesc(e.target.value)} /></div>
          <div className="flex items-center justify-between p-3 bg-[#2d2d2d] rounded-lg border border-[#333]">
            <div><div className="text-[#e4e6eb] font-bold">Member Posting</div><div className="text-[#b0b3b8] text-xs">Allow members to post in the group</div></div>
            <div className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${postingAllowed ? 'bg-[#1877f2]' : 'bg-gray-600'}`} onClick={() => setPostingAllowed(!postingAllowed)}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${postingAllowed ? 'left-7' : 'left-1'}`}></div>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="w-full bg-[#1877f2] hover:bg-[#166fe5] text-white py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Saving...' : 'Save Changes'}</button>
          {isAdmin && (<div className="border-t border-red-500/20 pt-4 mt-4"><button onClick={onDeleteGroup} className="w-full bg-red-500/10 text-red-500 font-bold py-2.5 rounded-lg transition-all hover:bg-red-500 hover:text-white border border-red-500/20">Delete Community</button></div>)}
        </div>
      </div>
    </div>
  );
};

const GroupEventCard: React.FC<{
  event: Event;
  group: Group;
  currentUser: User | null;
  onRSVP?: (eventId: number, status: string) => Promise<any>;
  onProfileClick: (id: number) => void;
}> = ({ event, group, currentUser, onRSVP, onProfileClick }) => {
  const [rsvpStatus, setRsvpStatus] = useState<string>(event.user_rsvp_status || '');
  const [loading, setLoading] = useState(false);
  const eventDate = new Date(event.start_time || event.date || '');
  const formattedDate = eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleRSVP = async (status: string) => {
    if (!currentUser || !onRSVP) return;
    setLoading(true);
    try { await onRSVP(event.id, status); setRsvpStatus(status); } catch (error) { console.error('Failed to RSVP:', error); } finally { setLoading(false); }
  };

  return (
    <div className="bg-[#1e1e1e] rounded-xl border border-[#333] overflow-hidden hover:shadow-lg transition-all">
      {event.cover_image && (<div className="h-40 overflow-hidden"><img src={event.cover_image} alt={event.title} className="w-full h-full object-cover" /></div>)}
      <div className="p-4">
        <h4 className="text-[#e4e6eb] font-bold text-lg mb-2">{event.title}</h4>
        <p className="text-[#b0b3b8] text-sm mb-3 line-clamp-2">{event.description}</p>
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-[#b0b3b8] text-sm"><i className="fas fa-calendar text-[#1877f2] w-5"></i><span>{formattedDate}</span></div>
          {event.location && (<div className="flex items-center gap-2 text-[#b0b3b8] text-sm"><i className="fas fa-map-marker-alt text-[#1877f2] w-5"></i><span>{event.location}</span></div>)}
          <div className="flex items-center gap-2 text-[#b0b3b8] text-sm"><i className="fas fa-users text-[#1877f2] w-5"></i><span>{event.attendees?.length || 0} attending</span></div>
        </div>
        {currentUser && onRSVP && (
          <div className="flex gap-2">
            {rsvpStatus === 'going' ? (<button onClick={() => handleRSVP('not_going')} disabled={loading} className="flex-1 bg-[#45BD62] text-white px-3 py-2 rounded-lg font-bold text-sm hover:bg-[#3aa34f] transition-colors disabled:opacity-50"><i className="fas fa-check mr-2"></i>Going</button>) : (<><button onClick={() => handleRSVP('going')} disabled={loading} className="flex-1 bg-[#1877f2] text-white px-3 py-2 rounded-lg font-bold text-sm hover:bg-[#166fe5] transition-colors disabled:opacity-50">Going</button><button onClick={() => handleRSVP('interested')} disabled={loading} className="flex-1 bg-[#2d2d2d] text-[#e4e6eb] px-3 py-2 rounded-lg font-bold text-sm hover:bg-[#3a3a3a] transition-colors disabled:opacity-50">Interested</button></>)}
          </div>
        )}
      </div>
    </div>
  );
};

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
    const handleClickOutside = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleEdit = async () => {
    if (!onEdit || !editText.trim()) return;
    setIsSubmitting(true);
    try { await onEdit(post.id, editText.trim()); setIsEditing(false); onClose(); } catch (error) { console.error('Failed to edit post:', error); } finally { setIsSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (window.confirm('Are you sure you want to delete this post?')) { try { await onDelete(post.id); onClose(); } catch (error) { console.error('Failed to delete post:', error); } }
  };

  const handleReport = async () => {
    if (!onReport) return;
    try { await onReport(post.id); alert('Post reported to group admins'); onClose(); } catch (error) { console.error('Failed to report post:', error); }
  };

  if (isEditing) {
    return (
      <div className="absolute right-0 top-8 z-50 w-80 bg-[#1e1e1e] rounded-xl shadow-2xl border border-[#333] p-4" ref={menuRef}>
        <h4 className="text-[#e4e6eb] font-bold mb-3">Edit Post</h4>
        <textarea className="w-full bg-[#2d2d2d] border border-[#333] rounded-lg p-3 text-[#e4e6eb] resize-none h-24 outline-none" value={editText} onChange={(e) => setEditText(e.target.value)} />
        <div className="flex justify-end gap-2 mt-3"><button onClick={() => setIsEditing(false)} className="px-4 py-2 text-[#b0b3b8] hover:bg-[#2d2d2d] rounded-lg transition-colors">Cancel</button><button onClick={handleEdit} disabled={isSubmitting || !editText.trim()} className="px-4 py-2 bg-[#1877f2] text-white rounded-lg hover:bg-[#166fe5] transition-colors disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save'}</button></div>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-8 z-50 w-56 bg-[#1e1e1e] rounded-xl shadow-2xl border border-[#333] overflow-hidden" ref={menuRef}>
      <div className="py-1">
        {(isPostAuthor || isGroupAdmin) && (<>{onEdit && (<button onClick={() => setIsEditing(true)} className="w-full px-4 py-3 text-left hover:bg-[#2d2d2d] flex items-center gap-3 text-[#e4e6eb] transition-colors"><i className="fas fa-edit w-5 text-[#b0b3b8]"></i><span>Edit Post</span></button>)}{onDelete && (<button onClick={handleDelete} className="w-full px-4 py-3 text-left hover:bg-[#2d2d2d] flex items-center gap-3 text-[#f3425f] transition-colors"><i className="fas fa-trash w-5 text-[#f3425f]"></i><span>Delete Post</span></button>)}<div className="border-t border-[#333] my-1"></div></>)}
        {!isPostAuthor && onReport && (<button onClick={handleReport} className="w-full px-4 py-3 text-left hover:bg-[#2d2d2d] flex items-center gap-3 text-[#e4e6eb] transition-colors"><i className="fas fa-flag w-5 text-[#b0b3b8]"></i><span>Report Post</span></button>)}
        <button onClick={onClose} className="w-full px-4 py-3 text-left hover:bg-[#2d2d2d] flex items-center gap-3 text-[#b0b3b8] transition-colors"><i className="fas fa-times w-5"></i><span>Close</span></button>
      </div>
    </div>
  );
};

const RecruitmentPost: React.FC<any> = (props) => {
  const { post, author, currentUser, onApply, onProfileClick, users, onComment, onCommentAdded } = props;
  const [applied, setApplied] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [localReactionCount, setLocalReactionCount] = useState(0);
  const [localMyReaction, setLocalMyReaction] = useState<ReactionType | undefined>();
  const [commentCount, setCommentCount] = useState(() => {
    if (typeof post.comment_count === 'number') return post.comment_count;
    if (typeof (post as any).comments_count === 'number') return (post as any).comments_count;
    if (Array.isArray(post.comments)) return post.comments.length;
    return 0;
  });
  const [shareCount, setShareCount] = useState(0);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showReactionsSheet, setShowReactionsSheet] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const jobTitle = (post as any).job_title || 'Position';
  const company = (post as any).company || '';
  const location = (post as any).location || '';
  const salary = (post as any).salary || '';
  const jobType = (post as any).job_type || 'Full-time';
  const street = (post as any).street || '';
  const district = (post as any).district || '';
  const region = (post as any).region || '';
  const country = (post as any).country || '';
  const fullAddress = location || [street, district, region, country].filter(Boolean).join(', ');
  const applicationType = (post as any).application_type || null;
  const applicationValue = (post as any).application_value || '';
  const expiryDate = (post as any).expiry_date ? new Date((post as any).expiry_date) : null;
  const now = new Date();
  const isExpired = expiryDate ? expiryDate < now : false;

  const mediaList = useMemo(() => getPostMediaList(post), [post]);
  const imageMedia = mediaList.filter(m => m.kind === 'image');
  const videoMedia = mediaList.filter(m => m.kind === 'video');

  useEffect(() => {
    setLocalMyReaction((post as any).myReaction ?? (post as any).my_reaction ?? null);
    const likesCount = Number((post as any).likesCount ?? (post as any).reactionsCount ?? (post as any).reactions_count ?? 0);
    const reactionsArr = Array.isArray(post.reactions) ? post.reactions : null;
    setLocalReactionCount(likesCount > 0 ? likesCount : reactionsArr ? reactionsArr.length : 0);
    const newCommentCount = typeof post.comment_count === 'number' ? post.comment_count : typeof (post as any).comments_count === 'number' ? (post as any).comments_count : Array.isArray(post.comments) ? post.comments.length : 0;
    if (newCommentCount !== commentCount) setCommentCount(newCommentCount);
    setShareCount(Number(post.shares ?? post.shares_count ?? 0));
  }, [post.id, post]);

  const handleApply = async () => {
    if (!currentUser) { alert('Please login to apply'); return; }
    if (isExpired) { alert('This job posting has expired'); return; }
    if (applicationType === 'email' && applicationValue) { window.location.href = `mailto:${applicationValue}?subject=Application for ${jobTitle} at ${company}`; }
    else if (applicationType === 'link' && applicationValue) { window.open(applicationValue, '_blank', 'noopener,noreferrer'); }
    if (onApply) { try { await onApply(post.id); setApplied(true); } catch (error) { console.error('Failed to apply:', error); } }
  };

  const isPostAuthor = currentUser?.id === author.id;
  const canModerate = Boolean(isPostAuthor || props.isGroupAdmin || props.isPlatformAdmin);

  const handleLikeClick = async (type: ReactionType) => {
    if (!currentUser) return;
    const previousMyReaction = localMyReaction;
    const previousReactionCount = localReactionCount;
    let newMyReaction: ReactionType | null = type;
    let newReactionCount = previousReactionCount;
    if (!previousMyReaction) newReactionCount = previousReactionCount + 1;
    else if (previousMyReaction === type) { newMyReaction = null; newReactionCount = previousReactionCount - 1; }
    else newMyReaction = type;
    setLocalMyReaction(newMyReaction || undefined);
    setLocalReactionCount(newReactionCount);
    try { await props.onLikePost(post.id, type); } catch (error) { console.error('Failed to like post:', error); setLocalMyReaction(previousMyReaction); setLocalReactionCount(previousReactionCount); }
  };

  const handleShareComplete = (destination: string, data?: any) => {
    const nextShares = Number(data?.shares ?? data?.share_count ?? shareCount + 1);
    if (data?.success) { setShareCount(nextShares); props.onSharePost(post.id, nextShares); }
    setShowShareSheet(false);
  };

  const handleCommentAdded = () => { setCommentCount(prev => prev + 1); if (onCommentAdded) onCommentAdded(); };
  const openGallery = (urls: string[], index: number) => { setGalleryUrls(urls); setGalleryIndex(index); setGalleryOpen(true); };
  const reactionsArr = Array.isArray(post.reactions) ? post.reactions : null;
  const emojiList = useMemo(() => {
    if (Array.isArray(reactionsArr) && reactionsArr.length > 0) { const em = topReactionEmojis(reactionsArr, 2); return em.length ? em : ['👍']; }
    return localReactionCount > 0 ? ['👍'] : [];
  }, [reactionsArr, localReactionCount]);
  const formatCount = (count: number): string => { if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`; else if (count >= 1000) return `${(count / 1000).toFixed(1)}k`; return count.toString(); };
  const createdAtLabel = formatRelativeTime(post.created_at || post.createdAt || '');
  const formatExpiryDate = (date: Date) => date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const handleOpenComments = () => props.onOpenComments(post.id);

  return (
    <>
      <div className="bg-[#242526] rounded-xl shadow-sm mb-4 animate-fade-in border border-[#3E4042] overflow-hidden">
        <div className="p-3 md:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onClick={() => onProfileClick(author.id)}>
            <img src={avatarFrom(author)} alt="" className="w-10 h-10 rounded-full object-cover border border-[#3E4042]" />
            <div className="min-w-0">
              <div className="flex items-center gap-1 flex-wrap"><h4 className="font-bold text-[#E4E6EB] text-[18.5px] hover:underline truncate">{author.name || 'User'}</h4>{author.is_verified && (<i className="fas fa-check-circle text-[#1877F2] text-[13px]"></i>)}</div>
              <div className="flex items-center gap-1.5 text-[#B0B3B8] text-[13px]"><span>{createdAtLabel}</span><span>•</span><i className="fas fa-briefcase text-[12px]"></i><span>Recruitment</span></div>
            </div>
          </div>
          {(canModerate || props.onReportPost) && (
            <div className="relative">
              <button className="w-9 h-9 hover:bg-[#3A3B3C] rounded-full flex items-center justify-center transition-colors" onClick={(e) => { e.stopPropagation(); setShowActionsMenu(!showActionsMenu); }} aria-label="Post actions"><i className="fas fa-ellipsis-h text-[#B0B3B8] text-xl"></i></button>
              {showActionsMenu && (<PostActionsMenu post={post} currentUser={currentUser} isGroupAdmin={canModerate} isPostAuthor={isPostAuthor} onEdit={props.onEditPost} onDelete={props.onDeletePost} onReport={props.onReportPost} onClose={() => setShowActionsMenu(false)} />)}
            </div>
          )}
        </div>
        <div className="px-3 md:px-4 pb-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-[#45BD62]/10 rounded-full border border-[#45BD62]/20"><i className="fas fa-briefcase text-[#45BD62] text-xs"></i><span className="text-[#45BD62] text-xs font-bold">JOB POSTING</span></div>
          {isExpired && (<div className="inline-flex items-center gap-1 px-3 py-1 bg-[#F3425F]/10 rounded-full border border-[#F3425F]/20"><i className="fas fa-clock text-[#F3425F] text-xs"></i><span className="text-[#F3425F] text-xs font-bold">EXPIRED</span></div>)}
          {expiryDate && !isExpired && (<div className="inline-flex items-center gap-1 px-3 py-1 bg-[#F7B928]/10 rounded-full border border-[#F7B928]/20"><i className="fas fa-calendar-alt text-[#F7B928] text-xs"></i><span className="text-[#F7B928] text-xs">Expires {formatExpiryDate(expiryDate)}</span></div>)}
        </div>
        <div className="px-3 md:px-4 pb-3">
          <div className="bg-[#3A3B3C] rounded-lg p-5">
            <h2 className="text-[#E4E6EB] font-bold text-2xl mb-3">{jobTitle}</h2>
            {company && (<div className="flex items-center gap-2 text-[#B0B3B8] mb-3"><i className="fas fa-building text-sm w-5 text-[#45BD62]"></i><span className="text-base font-medium">{company}</span></div>)}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {fullAddress && (<div className="flex items-center gap-2 text-[#B0B3B8]"><i className="fas fa-map-marker-alt text-sm w-5 text-[#45BD62]"></i><span className="text-sm">{fullAddress}</span></div>)}
              {jobType && (<div className="flex items-center gap-2 text-[#B0B3B8]"><i className="fas fa-clock text-sm w-5 text-[#F7B928]"></i><span className="text-sm">{jobType}</span></div>)}
              {salary && (<div className="flex items-center gap-2 text-[#B0B3B8] col-span-2"><i className="fas fa-dollar-sign text-sm w-5 text-[#45BD62]"></i><span className="text-sm font-medium text-[#45BD62]">{salary}</span></div>)}
            </div>
            {post.content && (
              <div className="mb-4">
                <div className="text-[#E4E6EB] whitespace-pre-wrap" style={{ fontSize: '20px' }}>
                  {showFullDescription ? post.content : post.content.slice(0, 300)}
                  {post.content.length > 300 && (<button onClick={() => setShowFullDescription(!showFullDescription)} className="ml-2 text-[#1877F2] font-bold hover:underline">{showFullDescription ? 'See less' : 'See more'}</button>)}
                </div>
              </div>
            )}
            {imageMedia.length > 0 && (<div className="mb-4"><MediaGrid media={imageMedia} onOpen={(url, index) => { const urls = imageMedia.map(m => m.url); openGallery(urls, index); }} /></div>)}
            {videoMedia.length > 0 && (<div className="mb-4"><video src={videoMedia[0].url} className="w-full rounded-lg" controls playsInline /></div>)}
            {applicationType && applicationValue && !isExpired && (<button onClick={handleApply} disabled={applied} className="w-full bg-[#1B74E4] text-white py-3 rounded-lg font-bold text-lg hover:bg-[#1A6ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md">{applied ? (<span className="flex items-center justify-center gap-2"><i className="fas fa-check"></i>Applied</span>) : 'Apply Now'}</button>)}
            {isExpired && (<div className="w-full bg-[#F3425F]/10 text-[#F3425F] py-3 rounded-lg font-bold text-lg text-center border border-[#F3425F]/20">This job posting has expired</div>)}
            {!applicationType && !isExpired && (<div className="w-full bg-[#2d2d2d] text-[#B0B3B8] py-3 rounded-lg font-bold text-lg text-center border border-[#3E4042]">No application method provided</div>)}
          </div>
        </div>
        {(localReactionCount > 0 || commentCount > 0) && (
          <div className="px-3 md:px-4 py-2 flex items-center justify-between text-[#B0B3B8] text-[14px] border-t border-[#3E4042]">
            <button onClick={(e) => { e.stopPropagation(); setShowReactionsSheet(true); }} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              {localReactionCount > 0 && (<><div className="flex -space-x-2">{emojiList.slice(0, 2).map((e, i) => (<span key={i} className="w-[22px] h-[22px] rounded-full bg-[#3A3B3C] border border-[#242526] flex items-center justify-center text-[14px]" style={{ zIndex: 10 - i }}>{e}</span>))}</div><span className="text-[#E4E6EB] font-bold text-[16px]">{formatCount(localReactionCount)}</span></>)}
            </button>
            <div className="flex gap-4"><span className="hover:underline cursor-pointer" onClick={handleOpenComments}>{formatCount(commentCount)} Discussions</span>{shareCount > 0 && (<span className="hover:underline cursor-pointer" onClick={() => setShowShareSheet(true)}>{formatCount(shareCount)} Shares</span>)}</div>
          </div>
        )}
        <div className="px-2 py-1 border-t border-[#3E4042] flex items-center justify-between">
          <ReactionButton currentUserReactions={localMyReaction} reactionCount={localReactionCount} onReact={handleLikeClick} isGuest={!currentUser} />
          <button className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]" onClick={() => currentUser ? handleOpenComments() : alert('Login first')}><DiscussSignalIcon size={26} color="#1877F2" /><span className="text-[17px] font-medium">Discuss</span></button>
          <button className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]" onClick={() => { if (!currentUser) { alert('Please login to share posts.'); return; } setShowShareSheet(true); }}><i className="fas fa-share text-[20px]"></i><span className="text-[17px] font-medium">Share</span></button>
        </div>
      </div>
      <ShareBottomSheet isOpen={showShareSheet} onClose={() => setShowShareSheet(false)} post={post} currentUser={currentUser} users={users} onShareComplete={handleShareComplete} />
      <GalleryViewer isOpen={galleryOpen} urls={galleryUrls} startIndex={galleryIndex} onClose={() => setGalleryOpen(false)} postId={post.id} currentUser={currentUser} reactionCount={localReactionCount} commentCount={commentCount} shareCount={shareCount} myReaction={localMyReaction} onReact={handleLikeClick} onOpenComments={handleOpenComments} onShare={() => setShowShareSheet(true)} onOpenReactions={() => setShowReactionsSheet(true)} />
    </>
  );
};

const BuySellPost: React.FC<any> = (props) => {
  const { post, author, currentUser, onMessageSeller, onMakeOffer, onProfileClick, users, onComment, onCommentAdded } = props;
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerSent, setOfferSent] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [localReactionCount, setLocalReactionCount] = useState(0);
  const [localMyReaction, setLocalMyReaction] = useState<ReactionType | undefined>();
  const [commentCount, setCommentCount] = useState(() => {
    if (typeof post.comment_count === 'number') return post.comment_count;
    if (typeof (post as any).comments_count === 'number') return (post as any).comments_count;
    if (Array.isArray(post.comments)) return post.comments.length;
    return 0;
  });
  const [shareCount, setShareCount] = useState(0);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showReactionsSheet, setShowReactionsSheet] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const price = (post as any).price || '0';
  const currency = (post as any).currency || 'USD';
  const condition = (post as any).condition || 'Used - Good';
  const location = (post as any).location || '';
  const status = (post as any).status || 'available';

  const getCurrencySymbol = (currencyCode: string) => { const c = CURRENCY_OPTIONS.find(c => c.code === currencyCode); return c ? c.symbol : currencyCode; };
  const formattedPrice = `${getCurrencySymbol(currency)} ${price}`;
  const mediaList = useMemo(() => getPostMediaList(post), [post]);
  const imageMedia = mediaList.filter(m => m.kind === 'image');
  const videoMedia = mediaList.filter(m => m.kind === 'video');

  useEffect(() => {
    setLocalMyReaction((post as any).myReaction ?? (post as any).my_reaction ?? null);
    const likesCount = Number((post as any).likesCount ?? (post as any).reactionsCount ?? (post as any).reactions_count ?? 0);
    const reactionsArr = Array.isArray(post.reactions) ? post.reactions : null;
    setLocalReactionCount(likesCount > 0 ? likesCount : reactionsArr ? reactionsArr.length : 0);
    const newCommentCount = typeof post.comment_count === 'number' ? post.comment_count : typeof (post as any).comments_count === 'number' ? (post as any).comments_count : Array.isArray(post.comments) ? post.comments.length : 0;
    if (newCommentCount !== commentCount) setCommentCount(newCommentCount);
    setShareCount(Number(post.shares ?? post.shares_count ?? 0));
  }, [post.id, post]);

  const isPostAuthor = currentUser?.id === author.id;
  const canModerate = Boolean(isPostAuthor || props.isGroupAdmin || props.isPlatformAdmin);

  const handleMakeOffer = async () => {
    if (!currentUser) { alert('Please login to make an offer'); return; }
    if (!offerAmount || isNaN(Number(offerAmount))) { alert('Please enter a valid amount'); return; }
    if (onMakeOffer) { try { await onMakeOffer(post.id, Number(offerAmount)); setOfferSent(true); setShowOfferModal(false); } catch (error) { console.error('Failed to make offer:', error); } }
  };

  const handleMessage = () => { if (!currentUser) { alert('Please login to message seller'); return; } if (onMessageSeller) onMessageSeller(author.id); };

  const handleLikeClick = async (type: ReactionType) => {
    if (!currentUser) return;
    const previousMyReaction = localMyReaction;
    const previousReactionCount = localReactionCount;
    let newMyReaction: ReactionType | null = type;
    let newReactionCount = previousReactionCount;
    if (!previousMyReaction) newReactionCount = previousReactionCount + 1;
    else if (previousMyReaction === type) { newMyReaction = null; newReactionCount = previousReactionCount - 1; }
    else newMyReaction = type;
    setLocalMyReaction(newMyReaction || undefined);
    setLocalReactionCount(newReactionCount);
    try { await props.onLikePost(post.id, type); } catch (error) { console.error('Failed to like post:', error); setLocalMyReaction(previousMyReaction); setLocalReactionCount(previousReactionCount); }
  };

  const handleShareComplete = (destination: string, data?: any) => {
    const nextShares = Number(data?.shares ?? data?.share_count ?? shareCount + 1);
    if (data?.success) { setShareCount(nextShares); props.onSharePost(post.id, nextShares); }
    setShowShareSheet(false);
  };

  const handleCommentAdded = () => { setCommentCount(prev => prev + 1); if (onCommentAdded) onCommentAdded(); };
  const openGallery = (urls: string[], index: number) => { setGalleryUrls(urls); setGalleryIndex(index); setGalleryOpen(true); };
  const reactionsArr = Array.isArray(post.reactions) ? post.reactions : null;
  const emojiList = useMemo(() => {
    if (Array.isArray(reactionsArr) && reactionsArr.length > 0) { const em = topReactionEmojis(reactionsArr, 2); return em.length ? em : ['👍']; }
    return localReactionCount > 0 ? ['👍'] : [];
  }, [reactionsArr, localReactionCount]);
  const formatCount = (count: number): string => { if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`; else if (count >= 1000) return `${(count / 1000).toFixed(1)}k`; return count.toString(); };
  const createdAtLabel = formatRelativeTime(post.created_at || post.createdAt || '');
  const statusColors = { available: 'bg-[#45BD62]', pending: 'bg-[#F7B928]', sold: 'bg-[#F3425F]' };
  const handleOpenComments = () => props.onOpenComments(post.id);

  return (
    <>
      <div className="bg-[#242526] rounded-xl shadow-sm mb-4 animate-fade-in border border-[#3E4042] overflow-hidden">
        <div className="p-3 md:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onClick={() => onProfileClick(author.id)}>
            <img src={avatarFrom(author)} alt="" className="w-10 h-10 rounded-full object-cover border border-[#3E4042]" />
            <div className="min-w-0">
              <div className="flex items-center gap-1 flex-wrap"><h4 className="font-bold text-[#E4E6EB] text-[18.5px] hover:underline truncate">{author.name || 'User'}</h4>{author.is_verified && (<i className="fas fa-check-circle text-[#1877F2] text-[13px]"></i>)}</div>
              <div className="flex items-center gap-1.5 text-[#B0B3B8] text-[13px]"><span>{createdAtLabel}</span><span>•</span><i className="fas fa-store text-[12px]"></i><span>Marketplace</span></div>
            </div>
          </div>
          {(canModerate || props.onReportPost) && (
            <div className="relative">
              <button className="w-9 h-9 hover:bg-[#3A3B3C] rounded-full flex items-center justify-center transition-colors" onClick={(e) => { e.stopPropagation(); setShowActionsMenu(!showActionsMenu); }} aria-label="Post actions"><i className="fas fa-ellipsis-h text-[#B0B3B8] text-xl"></i></button>
              {showActionsMenu && (<PostActionsMenu post={post} currentUser={currentUser} isGroupAdmin={canModerate} isPostAuthor={isPostAuthor} onEdit={props.onEditPost} onDelete={props.onDeletePost} onReport={props.onReportPost} onClose={() => setShowActionsMenu(false)} />)}
            </div>
          )}
          <div className={`px-3 py-1 rounded-full ${statusColors[status as keyof typeof statusColors]} text-white text-xs font-bold uppercase`}>{status}</div>
        </div>
        <div className="px-3 md:px-4 pb-2"><span className="text-[#E4E6EB] font-black text-2xl">{formattedPrice}</span>{condition && (<span className="ml-2 text-[#B0B3B8] text-sm">• {condition}</span>)}</div>
        {location && (<div className="px-3 md:px-4 pb-2"><div className="flex items-center gap-1 text-[#B0B3B8]"><i className="fas fa-map-marker-alt text-xs text-[#F7B928]"></i><span className="text-xs">{location}</span></div></div>)}
        {imageMedia.length > 0 && (<MediaGrid media={imageMedia} onOpen={(url, index) => { const urls = imageMedia.map(m => m.url); openGallery(urls, index); }} />)}
        {videoMedia.length > 0 && (<div className="px-3 md:px-4 mb-3"><video src={videoMedia[0].url} className="w-full rounded-lg" controls playsInline /></div>)}
        {post.content && (<div className="px-3 md:px-4 py-3"><p className="text-[#E4E6EB] text-base whitespace-pre-wrap">{post.content}</p></div>)}
        {(localReactionCount > 0 || commentCount > 0) && (
          <div className="px-3 md:px-4 py-2 flex items-center justify-between text-[#B0B3B8] text-[14px] border-t border-[#3E4042]">
            <button onClick={(e) => { e.stopPropagation(); setShowReactionsSheet(true); }} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              {localReactionCount > 0 && (<><div className="flex -space-x-2">{emojiList.slice(0, 2).map((e, i) => (<span key={i} className="w-[22px] h-[22px] rounded-full bg-[#3A3B3C] border border-[#242526] flex items-center justify-center text-[14px]" style={{ zIndex: 10 - i }}>{e}</span>))}</div><span className="text-[#E4E6EB] font-bold text-[16px]">{formatCount(localReactionCount)}</span></>)}
            </button>
            <div className="flex gap-4"><span className="hover:underline cursor-pointer" onClick={handleOpenComments}>{formatCount(commentCount)} Discussions</span>{shareCount > 0 && (<span className="hover:underline cursor-pointer" onClick={() => setShowShareSheet(true)}>{formatCount(shareCount)} Shares</span>)}</div>
          </div>
        )}
        <div className="px-2 py-1 border-t border-[#3E4042] flex items-center justify-between">
          <ReactionButton currentUserReactions={localMyReaction} reactionCount={localReactionCount} onReact={handleLikeClick} isGuest={!currentUser} />
          <button className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]" onClick={() => currentUser ? handleOpenComments() : alert('Login first')}><DiscussSignalIcon size={26} color="#1877F2" /><span className="text-[17px] font-medium">Discuss</span></button>
          <button className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]" onClick={() => { if (!currentUser) { alert('Please login to share posts.'); return; } setShowShareSheet(true); }}><i className="fas fa-share text-[20px]"></i><span className="text-[17px] font-medium">Share</span></button>
        </div>
        <div className="px-2 py-3 border-t border-[#3E4042] grid grid-cols-2 gap-2">
          <button onClick={handleMessage} className="flex items-center justify-center gap-2 h-10 rounded-lg bg-[#1877F2] text-white font-bold hover:bg-[#166fe5] transition-colors"><i className="fas fa-comment"></i>Message</button>
          <button onClick={() => setShowOfferModal(true)} disabled={status !== 'available' || offerSent} className="flex items-center justify-center gap-2 h-10 rounded-lg bg-[#2d2d2d] text-[#E4E6EB] font-bold hover:bg-[#3a3a3a] transition-colors disabled:opacity-50"><i className="fas fa-tag"></i>{offerSent ? 'Offer Sent' : 'Make Offer'}</button>
        </div>
      </div>
      {showOfferModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1e1e1e] w-full max-w-[400px] rounded-xl border border-[#333] p-4">
            <h3 className="text-[#e4e6eb] font-bold text-lg mb-4">Make an Offer</h3>
            <div className="mb-4"><label className="block text-[#b0b3b8] text-sm mb-1">Your offer ({getCurrencySymbol(currency)})</label><input type="number" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} placeholder={`Enter amount (max ${formattedPrice})`} max={price} className="w-full bg-[#2d2d2d] border border-[#333] rounded-lg p-2.5 text-[#e4e6eb] outline-none" /></div>
            <div className="flex gap-2"><button onClick={() => setShowOfferModal(false)} className="flex-1 bg-[#2d2d2d] text-[#e4e6eb] py-2.5 rounded-lg font-bold hover:bg-[#3a3a3a] transition-colors">Cancel</button><button onClick={handleMakeOffer} disabled={!offerAmount} className="flex-1 bg-[#1877f2] text-white py-2.5 rounded-lg font-bold hover:bg-[#166fe5] transition-colors disabled:opacity-50">Send Offer</button></div>
          </div>
        </div>
      )}
      <ShareBottomSheet isOpen={showShareSheet} onClose={() => setShowShareSheet(false)} post={post} currentUser={currentUser} users={users} onShareComplete={handleShareComplete} />
      <GalleryViewer isOpen={galleryOpen} urls={galleryUrls} startIndex={galleryIndex} onClose={() => setGalleryOpen(false)} postId={post.id} currentUser={currentUser} reactionCount={localReactionCount} commentCount={commentCount} shareCount={shareCount} myReaction={localMyReaction} onReact={handleLikeClick} onOpenComments={handleOpenComments} onShare={() => setShowShareSheet(true)} onOpenReactions={() => setShowReactionsSheet(true)} />
    </>
  );
};

const GeneralGroupPost: React.FC<any> = ({
  post, author, currentUser, users = [], isGroupAdmin = false, isPlatformAdmin = false, onProfileClick, onLikePost, onOpenComments, onSharePost, onEditPost, onDeletePost, onReportPost, onViewImage, onVideoClick, onHashtagClick, onFollow, checkIsFollowing, onComment, onCommentAdded,
}) => {
  const p: any = post as any;
  const a: any = author as any;
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [commentCount, setCommentCount] = useState(() => {
    if (typeof p.comment_count === 'number') return p.comment_count;
    if (typeof p.comments_count === 'number') return p.comments_count;
    if (Array.isArray(p.comments)) return p.comments.length;
    return 0;
  });
  const [shareCount, setShareCount] = useState(() => Number(p.shares ?? p.shares_count ?? 0));
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showReactionsSheet, setShowReactionsSheet] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [localMyReaction, setLocalMyReaction] = useState<ReactionType | undefined>((p as any).myReaction ?? (p as any).my_reaction ?? null);
  const [localReactionCount, setLocalReactionCount] = useState(() => {
    const likesCount = Number((p as any).likesCount ?? (p as any).reactionsCount ?? (p as any).reactions_count ?? 0);
    const reactionsArr = Array.isArray(p.reactions) ? p.reactions : null;
    return likesCount > 0 ? likesCount : reactionsArr ? reactionsArr.length : 0;
  });

  useEffect(() => {
    setLocalMyReaction((p as any).myReaction ?? (p as any).my_reaction ?? null);
    const likesCount = Number((p as any).likesCount ?? (p as any).reactionsCount ?? (p as any).reactions_count ?? 0);
    const reactionsArr = Array.isArray(p.reactions) ? p.reactions : null;
    setLocalReactionCount(likesCount > 0 ? likesCount : reactionsArr ? reactionsArr.length : 0);
    const newCommentCount = typeof p.comment_count === 'number' ? p.comment_count : typeof p.comments_count === 'number' ? p.comments_count : Array.isArray(p.comments) ? p.comments.length : 0;
    if (newCommentCount !== commentCount) setCommentCount(newCommentCount);
  }, [p.id, (p as any).myReaction, (p as any).my_reaction, (p as any).likesCount, (p as any).reactionsCount, (p as any).reactions_count]);

  const reactionsArr = Array.isArray(p.reactions) ? p.reactions : null;
  const finalMyReaction = localMyReaction;
  const finalReactionCount = localReactionCount;
  const createdAtLabel = formatRelativeTime(p.created_at || p.createdAt || '');
  const postId = Number(p.id ?? p.post_id ?? 0);
  const isPostAuthor = currentUser?.id === author.id;
  const canModerate = Boolean(isPostAuthor || isGroupAdmin || isPlatformAdmin);
  const mediaList = useMemo(() => getPostMediaList(p), [p]);
  const imageMedia = mediaList.filter(m => m.kind === 'image');
  const videoMedia = mediaList.filter(m => m.kind === 'video');
  const emojiList = useMemo(() => {
    if (Array.isArray(reactionsArr) && reactionsArr.length > 0) { const em = topReactionEmojis(reactionsArr, 2); return em.length ? em : ['👍']; }
    return finalReactionCount > 0 ? ['👍'] : [];
  }, [reactionsArr, finalReactionCount]);
  const formatCount = (count: number): string => { if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`; else if (count >= 1000) return `${(count / 1000).toFixed(1)}k`; return count.toString(); };

  const handleLikeClick = async (type: ReactionType) => {
    if (!currentUser) return;
    const previousMyReaction = finalMyReaction;
    const previousReactionCount = finalReactionCount;
    let newMyReaction: ReactionType | null = type;
    let newReactionCount = previousReactionCount;
    if (!previousMyReaction) newReactionCount = previousReactionCount + 1;
    else if (previousMyReaction === type) { newMyReaction = null; newReactionCount = previousReactionCount - 1; }
    else newMyReaction = type;
    setLocalMyReaction(newMyReaction || undefined);
    setLocalReactionCount(newReactionCount);
    try { await onLikePost(postId, type); } catch (error) { console.error('Failed to like post:', error); setLocalMyReaction(previousMyReaction); setLocalReactionCount(previousReactionCount); }
  };

  const handleShareComplete = (destination: string, data?: any) => {
    const nextShares = Number(data?.shares ?? data?.share_count ?? shareCount + 1);
    if (data?.success) { setShareCount(nextShares); onSharePost(postId, nextShares); }
    setShowShareSheet(false);
  };

  const handleCommentAdded = () => { setCommentCount(prev => prev + 1); if (onCommentAdded) onCommentAdded(); };
  const handleSeeMore = () => onOpenComments(postId);
  const openGallery = (urls: string[], index: number) => { setGalleryUrls(urls); setGalleryIndex(index); setGalleryOpen(true); };
  const handleOpenComments = () => onOpenComments(postId);

  return (
    <>
      <div className="bg-[#242526] rounded-xl shadow-sm mb-4 animate-fade-in border border-[#3E4042] overflow-hidden">
        <div className="p-3 md:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onClick={() => onProfileClick(a.id)}>
            <img src={avatarFrom(a)} alt="" className="w-10 h-10 rounded-full object-cover border border-[#3E4042]" />
            <div className="min-w-0">
              <div className="flex items-center gap-1 flex-wrap"><h4 className="font-bold text-[#E4E6EB] text-[18.5px] hover:underline truncate">{a.name || 'User'}</h4>{a.is_verified && (<i className="fas fa-check-circle text-[#1877F2] text-[13px]"></i>)}</div>
              <div className="flex items-center gap-1.5 text-[#B0B3B8] text-[13px]"><span>{createdAtLabel}</span><span>•</span><i className="fas fa-users text-[12px]"></i><span>Group Post</span></div>
            </div>
          </div>
          {(canModerate || onReportPost) && (
            <div className="relative">
              <button className="w-9 h-9 hover:bg-[#3A3B3C] rounded-full flex items-center justify-center transition-colors" onClick={(e) => { e.stopPropagation(); setShowActionsMenu(!showActionsMenu); }} aria-label="Post actions"><i className="fas fa-ellipsis-h text-[#B0B3B8] text-xl"></i></button>
              {showActionsMenu && (<PostActionsMenu post={post} currentUser={currentUser} isGroupAdmin={canModerate} isPostAuthor={isPostAuthor} onEdit={onEditPost} onDelete={onDeletePost} onReport={onReportPost} onClose={() => setShowActionsMenu(false)} />)}
            </div>
          )}
        </div>
        {p.content && (<div className="px-3 md:px-4 pb-2"><ExpandableRichText text={String(p.content)} users={users} onProfileClick={onProfileClick} onHashtagClick={onHashtagClick} maxWords={25} fontSizePx={21} onSeeMore={handleSeeMore} /></div>)}
        {imageMedia.length > 0 && (<MediaGrid media={imageMedia.map((m) => ({ url: m.url }))} onOpen={(url, index) => { const urls = imageMedia.map((m) => m.url); openGallery(urls, index); }} />)}
        {videoMedia.length > 0 && (<div className="cursor-pointer relative h-[500px] bg-black" onClick={() => onVideoClick?.(post)}><video src={videoMedia[0].url} className="w-full h-full object-cover" preload="metadata" playsInline muted onError={(e) => { console.error('Failed to load video:', videoMedia[0].url); e.currentTarget.style.display = 'none'; }} /><div className="absolute inset-0 flex items-center justify-center"><i className="fas fa-play text-white text-4xl opacity-50"></i></div></div>)}
        {(finalReactionCount > 0 || commentCount > 0) && (
          <div className="px-3 md:px-4 py-2 flex items-center justify-between text-[#B0B3B8] text-[14px] border-t border-[#3E4042]">
            <button onClick={(e) => { e.stopPropagation(); setShowReactionsSheet(true); }} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              {finalReactionCount > 0 && (<><div className="flex -space-x-2">{emojiList.slice(0, 2).map((e, i) => (<span key={i} className="w-[22px] h-[22px] rounded-full bg-[#3A3B3C] border border-[#242526] flex items-center justify-center text-[14px]" style={{ zIndex: 10 - i }}>{e}</span>))}</div><span className="text-[#E4E6EB] font-bold text-[16px]">{formatCount(finalReactionCount)}</span></>)}
            </button>
            <div className="flex gap-4"><span className="hover:underline cursor-pointer" onClick={handleOpenComments}>{formatCount(commentCount)} Discussions</span>{shareCount > 0 && (<span className="hover:underline">{formatCount(shareCount)} Shares</span>)}</div>
          </div>
        )}
        <div className="px-2 py-1 border-t border-[#3E4042] flex items-center justify-between">
          <ReactionButton currentUserReactions={finalMyReaction} reactionCount={finalReactionCount} onReact={handleLikeClick} isGuest={!currentUser} />
          <button className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]" onClick={() => currentUser ? handleOpenComments() : alert('Login first')}><DiscussSignalIcon size={26} color="#1877F2" /><span className="text-[17px] font-medium">Discuss</span></button>
          <button className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]" onClick={() => { if (!currentUser) { alert('Please login to share posts.'); return; } setShowShareSheet(true); }}><i className="fas fa-share text-[20px]"></i><span className="text-[17px] font-medium">Share</span></button>
        </div>
      </div>
      <ShareBottomSheet isOpen={showShareSheet} onClose={() => setShowShareSheet(false)} post={p} currentUser={currentUser} users={users} onShareComplete={handleShareComplete} />
      <GalleryViewer isOpen={galleryOpen} urls={galleryUrls} startIndex={galleryIndex} onClose={() => setGalleryOpen(false)} postId={postId} currentUser={currentUser} reactionCount={finalReactionCount} commentCount={commentCount} shareCount={shareCount} myReaction={finalMyReaction} onReact={handleLikeClick} onOpenComments={handleOpenComments} onShare={() => setShowShareSheet(true)} onOpenReactions={() => setShowReactionsSheet(true)} />
    </>
  );
};

const GroupPost: React.FC<any> = (props) => {
  const { groupCategory = 'general' } = props;
  switch (groupCategory) {
    case 'recruitment': return <RecruitmentPost {...props} />;
    case 'buy_sell': return <BuySellPost {...props} />;
    default: return <GeneralGroupPost {...props} />;
  }
};

function normalizeGroup(raw: any): Group {
  const members = raw?.members === undefined || raw?.members === null ? undefined : (Array.isArray(raw.members) ? raw.members.map(Number).filter(Number.isFinite) : []);
  const posts = Array.isArray(raw?.posts) ? raw.posts : [];
  const events = Array.isArray(raw?.events) ? raw.events : [];
  return {
    ...raw,
    id: Number(raw?.id ?? raw?.groupId ?? 0),
    admin_id: Number(raw?.admin_id ?? raw?.adminId ?? 0),
    name: String(raw?.name ?? 'Untitled Group'),
    description: String(raw?.description ?? ''),
    type: (raw?.type === 'private' ? 'private' : 'public') as any,
    category: (raw?.category as GroupCategory) || 'general',
    cover_image: String(raw?.cover_image ?? raw?.coverImage ?? ''),
    profile_image: String(raw?.profile_image ?? raw?.profileImage ?? ''),
    created_at: raw?.created_at ?? new Date().toISOString(),
    member_posting_allowed: raw?.member_posting_allowed ?? true,
    members: members,
    posts,
    events,
    members_count: Number(raw?.members_count ?? (members ? members.length : 0)),
  } as Group;
}

function normalizePost(post: any): PostType {
  const mediaUrl = post?.media_url ?? post?.mediaUrl ?? null;
  const mediaType = post?.media_type ?? post?.mediaType ?? null;
  let mediaUrls: string[] = [];
  if (post?.media_urls) {
    if (Array.isArray(post.media_urls)) mediaUrls = post.media_urls;
    else if (typeof post.media_urls === 'string') { try { const parsed = JSON.parse(post.media_urls); mediaUrls = Array.isArray(parsed) ? parsed : []; } catch { mediaUrls = []; } }
  }
  let images: string[] = [];
  if (post?.images) {
    if (Array.isArray(post.images)) images = post.images;
    else if (typeof post.images === 'string') { try { const parsed = JSON.parse(post.images); images = Array.isArray(parsed) ? parsed : []; } catch { images = []; } }
  }
  let mediaTypes: string[] = [];
  if (post?.media_types) {
    if (Array.isArray(post.media_types)) mediaTypes = post.media_types;
    else if (typeof post.media_types === 'string') { try { const parsed = JSON.parse(post.media_types); mediaTypes = Array.isArray(parsed) ? parsed : []; } catch { mediaTypes = []; } }
  }
  const commentCount = typeof post?.comment_count === 'number' ? post.comment_count : typeof post?.comments_count === 'number' ? post.comments_count : Array.isArray(post?.comments) ? post.comments.length : 0;
  return {
    ...post,
    id: Number(post?.id ?? post?.post_id ?? 0),
    user_id: Number(post?.user_id ?? post?.authorId ?? 0),
    content: String(post?.content ?? post?.text ?? ''),
    media_url: mediaUrl,
    media_type: mediaType,
    media_urls: mediaUrls.length ? mediaUrls : images,
    images: mediaUrls.length ? mediaUrls : images,
    media_types: mediaTypes,
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
    comment_count: commentCount,
    comments_count: commentCount,
    price: post?.price,
    currency: post?.currency || 'USD',
    condition: post?.condition,
    location: post?.location,
    status: post?.status || 'available',
    job_title: post?.job_title,
    company: post?.company,
    salary: post?.salary,
    job_type: post?.job_type,
    street: post?.street,
    district: post?.district,
    region: post?.region,
    country: post?.country,
    application_type: post?.application_type,
    application_value: post?.application_value,
    expiry_date: post?.expiry_date,
  } as any;
}

function normalizeEvent(event: any): Event {
  const groupId = event?.group_id ?? event?.groupId ?? null;
  return {
    ...event,
    id: Number(event?.id ?? 0),
    title: String(event?.title ?? ''),
    description: String(event?.description ?? ''),
    start_time: event?.event_date ?? event?.start_time ?? event?.date ?? new Date().toISOString(),
    location: event?.location ?? null,
    cover_image: event?.cover_url ?? event?.cover_image ?? null,
    attendees: Array.isArray(event?.attendees) ? event.attendees : [],
    created_by: Number(event?.creator_id ?? event?.created_by ?? 0),
    group_id: groupId == null ? null : Number(groupId),
    created_at: event?.created_at ?? new Date().toISOString(),
    user_rsvp_status: event?.user_rsvp_status ?? null,
  } as any;
}

// Category Selection Modal Component
const CategorySelectionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelect: (category: GroupCategory) => void;
}> = ({ isOpen, onClose, onSelect }) => {
  const [selectedId, setSelectedId] = useState<GroupCategory | null>(null);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#1e1e1e] w-full max-w-[600px] rounded-xl border border-[#333] shadow-2xl overflow-hidden animate-slide-up">
        <div className="p-4 border-b border-[#333] flex justify-between items-center">
          <h3 className="text-xl font-bold text-[#e4e6eb]">Choose Group Category</h3>
          <div onClick={onClose} className="w-8 h-8 rounded-full bg-[#2d2d2d] flex items-center justify-center cursor-pointer hover:bg-[#3a3a3a] transition-colors"><i className="fas fa-times text-[#b0b3b8]"></i></div>
        </div>
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {GROUP_CATEGORIES.map((category) => (
            <button key={category.id} onClick={() => setSelectedId(category.id)} className={`w-full p-4 rounded-xl border-2 transition-all ${selectedId === category.id ? 'border-[#1877f2] bg-[#1877f2]/10' : 'border-[#333] hover:border-[#4a4a4a] bg-[#2d2d2d]'}`}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${category.color}20`, color: category.color }}><i className={category.icon}></i></div>
                <div className="flex-1 text-left">
                  <h4 className="text-[#e4e6eb] font-bold text-lg mb-1">{category.label}</h4>
                  <p className="text-[#b0b3b8] text-sm mb-2">{category.description}</p>
                  <div className="flex flex-wrap gap-2">{category.features.map((feature, i) => (<span key={i} className="px-2 py-1 bg-[#3a3a3a] rounded-full text-xs text-[#b0b3b8]">{feature}</span>))}</div>
                </div>
                {selectedId === category.id && (<div className="w-6 h-6 rounded-full bg-[#1877f2] flex items-center justify-center"><i className="fas fa-check text-white text-xs"></i></div>)}
              </div>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-[#333] flex gap-2">
          <button onClick={onClose} className="flex-1 bg-[#2d2d2d] text-[#e4e6eb] py-2.5 rounded-lg font-bold hover:bg-[#3a3a3a] transition-colors">Cancel</button>
          <button onClick={() => { if (selectedId) { onSelect(selectedId); onClose(); } }} disabled={!selectedId} className="flex-1 bg-[#1877f2] text-white py-2.5 rounded-lg font-bold hover:bg-[#166fe5] transition-colors disabled:opacity-50">Continue</button>
        </div>
      </div>
    </div>
  );
};

// Full Page Create Group Modal Component
const CreateGroupFullPageModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreate: (groupData: Partial<Group>) => Promise<void>;
  selectedCategory: GroupCategory | null;
}> = ({ isOpen, onClose, onCreate, selectedCategory }) => {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDesc('');
      setType('public');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!name.trim() || !selectedCategory) return;
    setLoading(true);
    try {
      await onCreate({
        name: name.trim(),
        description: desc.trim(),
        type,
        category: selectedCategory,
        profile_image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
        cover_image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1500&q=80',
      });
      onClose();
    } catch (error) { console.error('Failed to create group:', error); } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  const categoryInfo = GROUP_CATEGORIES.find(c => c.id === selectedCategory);

  return (
    <div className="fixed inset-0 z-[200] bg-[#121212] flex flex-col animate-fade-in font-sans">
      <div className="sticky top-0 z-10 bg-[#1e1e1e] border-b border-[#333]">
        <div className="max-w-[600px] mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#2d2d2d] transition-colors"><i className="fas fa-arrow-left text-[#e4e6eb] text-xl"></i></button>
          <h1 className="text-xl font-bold text-[#e4e6eb]">Create {categoryInfo?.label || ''} Group</h1>
          <button onClick={handleSubmit} disabled={loading || !name.trim()} className="px-4 py-2 bg-[#1877f2] text-white font-bold rounded-lg hover:bg-[#166fe5] transition-colors disabled:opacity-50">{loading ? 'Creating...' : 'Create'}</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[600px] mx-auto p-6 space-y-6">
          {categoryInfo && (
            <div className="bg-[#1e1e1e] rounded-xl p-4 border border-[#333]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${categoryInfo.color}20` }}><i className={categoryInfo.icon} style={{ color: categoryInfo.color, fontSize: '24px' }}></i></div>
                <div><div className="text-[#e4e6eb] font-bold text-lg">{categoryInfo.label}</div><div className="text-[#b0b3b8] text-sm">{categoryInfo.description}</div></div>
              </div>
            </div>
          )}
          <div><label className="block text-[#b0b3b8] text-sm font-bold mb-2">Group Name *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="What's the name of your community?" className="w-full bg-[#2d2d2d] border border-[#333] rounded-xl p-4 text-[#e4e6eb] text-lg outline-none focus:border-[#1877f2] transition-colors" autoFocus /></div>
          <div><label className="block text-[#b0b3b8] text-sm font-bold mb-2">Description</label><textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Tell people what this group is about..." rows={4} className="w-full bg-[#2d2d2d] border border-[#333] rounded-xl p-4 text-[#e4e6eb] text-base outline-none resize-none focus:border-[#1877f2] transition-colors" /></div>
          <div><label className="block text-[#b0b3b8] text-sm font-bold mb-2">Privacy</label><div className="grid grid-cols-2 gap-3"><button onClick={() => setType('public')} className={`p-4 rounded-xl border-2 transition-all text-left ${type === 'public' ? 'border-[#1877f2] bg-[#1877f2]/10' : 'border-[#333] bg-[#2d2d2d]'}`}><i className="fas fa-globe text-[#1877f2] text-xl mb-2"></i><div className="text-[#e4e6eb] font-bold">Public</div><div className="text-[#b0b3b8] text-xs">Anyone can see and join</div></button><button onClick={() => setType('private')} className={`p-4 rounded-xl border-2 transition-all text-left ${type === 'private' ? 'border-[#1877f2] bg-[#1877f2]/10' : 'border-[#333] bg-[#2d2d2d]'}`}><i className="fas fa-lock text-[#F7B928] text-xl mb-2"></i><div className="text-[#e4e6eb] font-bold">Private</div><div className="text-[#b0b3b8] text-xs">Members need approval</div></button></div></div>
          {categoryInfo && (<div className="bg-[#1e1e1e] rounded-xl p-4 border border-[#333]"><div className="text-[#b0b3b8] text-sm font-bold mb-3">What you can post:</div><div className="flex flex-wrap gap-2">{categoryInfo.features.map((feature, i) => (<span key={i} className="px-3 py-1.5 bg-[#2d2d2d] rounded-full text-[#e4e6eb] text-sm"><i className="fas fa-check text-[#45BD62] mr-2 text-xs"></i>{feature}</span>))}</div></div>)}
        </div>
      </div>
    </div>
  );
};
