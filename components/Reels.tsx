import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { User, Reel, ReactionType, Comment, Song } from '../types';

// ==================== MEDIA CACHE SYSTEM (MEMORY-SAFE) ====================
// Layer 1: Limited in-memory blob URL cache (max 10 items)
const mediaBlobCache = new Map<string, { blobUrl: string, timestamp: number }>(); 
const mediaWarmPromises = new Map<string, Promise<string>>();
const CACHE_MAX_SIZE = 10;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchAsBlobUrl(url: string, type: 'video' | 'audio' = 'audio'): Promise<string> {
  if (!url) throw new Error("Missing media URL");

  // Check cache with TTL
  const cached = mediaBlobCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.blobUrl;
  }

  // Deduplicate concurrent fetches
  if (mediaWarmPromises.has(url)) {
    return mediaWarmPromises.get(url)!;
  }

  // For videos, prefer native browser cache (memory efficient)
  if (type === 'video') {
    mediaWarmPromises.set(url, Promise.resolve(url));
    setTimeout(() => mediaWarmPromises.delete(url), 1000);
    return url;
  }

  // Only audio gets blob URLs (smaller, need trimming)
  const p = fetch(url, { 
    cache: "force-cache",
    headers: { "Accept": "audio/mpeg,*/*" }
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to fetch media: ${res.status}`);
      
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      // Cleanup old cache entries
      if (mediaBlobCache.size >= CACHE_MAX_SIZE) {
        const oldestKey = Array.from(mediaBlobCache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        const oldest = mediaBlobCache.get(oldestKey);
        if (oldest) URL.revokeObjectURL(oldest.blobUrl);
        mediaBlobCache.delete(oldestKey);
      }
      
      mediaBlobCache.set(url, { blobUrl, timestamp: Date.now() });
      return blobUrl;
    })
    .finally(() => {
      mediaWarmPromises.delete(url);
    });

  mediaWarmPromises.set(url, p);
  return p;
}

// ==================== TYPES & INTERFACES ====================
type ReelSound = {
  songName: string;
  audioUrl: string;
  audioStart?: number;
  audioEnd?: number;
  songId?: string | number;
  soundKey?: string;
  originalUrl?: string;
};

interface Sound {
  id: string | number;
  name: string;
  url: string;
  start?: number;
  end?: number;
  creator?: User;
  creationCount?: number;
  duration?: number;
  isOriginal?: boolean;
  playCount?: number;
  viewCount?: number;
  coverImage?: string;
  soundKey?: string;
  originalUrl?: string;
}

// ==================== REACTION EMOJIS ====================
const REACTION_EMOJIS = ['❤️', '🙏', '👍', '💪', '👀', '😊', '😍', '🤣', '😭', '😂', '😟', '🤑', '😝', '😋', '🤧', '😪', '👏', '🤘', '✌️', '🤛', '🤝', '🖕', '🖐', '🙆‍♂️', '🤦', '🤷‍♂️', '🫂'];

// ==================== FORMAT VIEW COUNT HELPER ====================
const formatViewCount = (num?: number): string => {
  const v = Number(num || 0);
  
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(v);
};

// ==================== API HELPER ====================
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('unera_token');
  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, { 
      ...options, 
      headers,
      signal: controller.signal 
    });

    const contentType = res.headers.get('content-type') || '';
    let data: any = null;

    try {
      if (contentType.includes('application/json')) data = await res.json();
      else {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      }
    } catch (e: any) {
      data = { error: e?.message || 'Failed to parse response' };
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
  }
};

// ==================== HALF-SCREEN COMMENTS SHEET ====================
const ReelCommentsSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  comments: any[];
  users: User[];
  currentUser: User | null;
  onAddComment: (payload: {
    text: string;
    parentId?: number | null;
    imageFile?: File | null;
  }) => Promise<void> | void;
  onEditComment: (
    commentId: number,
    payload: {
      text?: string;
      imageFile?: File | null;
      image_url?: string;
    }
  ) => Promise<void> | void;
  onDeleteComment: (commentId: number) => Promise<void> | void;
}> = ({ 
  isOpen, 
  onClose, 
  comments, 
  users, 
  currentUser, 
  onAddComment,
  onEditComment,
  onDeleteComment 
}) => {
  const COMMENT_EMOJIS = ['😀', '😂', '😍', '🔥', '👏', '❤️', '👍', '🎉', '😮', '😢', '🙌', '🥰'];
  
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [menuComment, setMenuComment] = useState<any | null>(null);
  const [editingComment, setEditingComment] = useState<any | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
  const [commentReactions, setCommentReactions] = useState<Record<number, string>>({});
  
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTranslateY(0);
      setReplyTo(null);
      setSelectedImage(null);
      setImagePreview(null);
      setShowEmojiBar(false);
      setShowReactionPicker(null);
      // Don't auto-focus keyboard
    }
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !sheetRef.current) return;
    
    const deltaY = e.touches[0].clientY - startYRef.current;
    if (deltaY > 0) {
      setTranslateY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    if (translateY > 150) {
      onClose();
    } else {
      setTranslateY(0);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmitComment = async () => {
    if (!text.trim() && !selectedImage) return;
    
    try {
      await Promise.resolve(
        onAddComment({
          text: text.trim(),
          parentId: replyTo?.id || null,
          imageFile: selectedImage
        })
      );
      
      setText('');
      setReplyTo(null);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setSelectedImage(null);
      setImagePreview(null);
      setShowEmojiBar(false);
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const isOwnerComment = (comment: any) => {
    const commentUserId = Number(comment.userId ?? comment.user_id);
    return commentUserId === Number(currentUser?.id);
  };

  const beginLongPress = (comment: any) => {
    if (!isOwnerComment(comment)) return;
    
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setMenuComment(comment);
    }, 450);
  };

  const cancelLongPress = () => {
    clearTimeout(longPressTimerRef.current);
  };

  const openEditComment = (comment: any) => {
    setMenuComment(null);
    setEditingComment(comment);
    setEditingText(comment.text || '');
  };

  const confirmDeleteComment = async (comment: any) => {
    setMenuComment(null);
    const ok = window.confirm('Delete this discussion?');
    if (!ok) return;

    try {
      await Promise.resolve(onDeleteComment(comment.id));
    } catch (e: any) {
      alert(e?.message || 'Failed to delete discussion');
    }
  };

  const saveEditedComment = async () => {
    if (!editingComment) return;

    try {
      await Promise.resolve(
        onEditComment(editingComment.id, {
          text: editingText,
        })
      );
      setEditingComment(null);
      setEditingText('');
    } catch (e: any) {
      alert(e?.message || 'Failed to edit discussion');
    }
  };

  const addReaction = (commentId: number, emoji: string) => {
    setCommentReactions(prev => ({
      ...prev,
      [commentId]: emoji,
    }));
    setShowReactionPicker(null);
  };

  const insertEmoji = (emoji: string) => {
    setText(prev => prev + emoji);
  };

  const insertEditEmoji = (emoji: string) => {
    setEditingText(prev => prev + emoji);
  };

  // Helper functions for reply handling
  const getReplies = (commentId: number | string) =>
    comments
      .filter(
        (c: any) =>
          Number(c.parentId ?? c.parent_comment_id ?? c.parent_id) === Number(commentId)
      )
      .sort((a: any, b: any) => {
        const ta = new Date(a.created_at || a.createdAt || 0).getTime();
        const tb = new Date(b.created_at || b.createdAt || 0).getTime();
        return ta - tb;
      });

  const getReplyPreviewText = (count: number) => {
    if (count <= 0) return '';
    if (count === 1) return 'View previous 1 reply';
    return `View previous ${count} replies`;
  };

  if (!isOpen) return null;

  // Filter root comments (no parent)
  const rootComments = comments.filter(
    (c: any) => !c.parentId && !c.parent_comment_id && !c.parent_id
  );

  return (
    <div 
      className="fixed inset-0 z-[400] bg-black/50 font-sans backdrop-blur-sm transition-opacity"
      style={{ opacity: 1 - (translateY / 500) }}
      onClick={onClose}
    >
      <div 
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 max-w-[450px] mx-auto h-[80vh] bg-[#121212] rounded-t-[40px] flex flex-col border-t border-white/10 shadow-2xl transition-transform duration-200 ease-out"
        style={{ transform: `translateY(${translateY}px)` }}
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="pt-3 pb-2 flex justify-center">
          <div className="w-12 h-1.5 bg-white/30 rounded-full"></div>
        </div>
        
        <div className="px-5 pb-5 border-b border-white/5 flex justify-between items-center bg-[#181818] rounded-t-[40px]">
          <span className="text-white font-black text-[13px] ml-4 uppercase tracking-[3px]">
            {comments.length} {replyTo ? 'Replies' : 'Discussions'}
          </span>
          {replyTo && (
            <button 
              onClick={() => setReplyTo(null)}
              className="text-[#1877F2] text-xs font-bold"
            >
              Back to all
            </button>
          )}
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white active:scale-90 transition-all"
          >
            <i className="fas fa-times text-xs"></i>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Reply thread context */}
          {replyTo && (
            <div className="mb-2 p-4 rounded-[22px] bg-white/5 border border-white/10">
              <p className="text-[12px] uppercase tracking-[2px] text-[#1877F2] font-black mb-2">
                Reply thread
              </p>
              <p className="text-white/70 text-[16px] line-clamp-2">
                {replyTo.text || 'Image discussion'}
              </p>
            </div>
          )}

          {(replyTo ? [replyTo, ...getReplies(replyTo.id)] : rootComments).map((c: any) => {
            const author = users.find((u: any) => Number(u.id) === Number(c.userId ?? c.user_id));
            const replies = getReplies(c.id);
            const lastReply = replies.length ? replies[replies.length - 1] : null;
            const hiddenRepliesCount = replies.length > 1 ? replies.length - 1 : replies.length;
            const isReply = c.parentId || c.parent_comment_id || c.parent_id;
            const isOwner = isOwnerComment(c);

            return (
              <div key={c.id} className={`${isReply ? 'ml-10' : ''}`}>
                <div className="flex gap-4">
                  <img
                    src={author?.profile_image_url || author?.profileImage || 'https://via.placeholder.com/40'}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white/5 shrink-0"
                    alt=""
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-white font-black text-[22px] leading-none tracking-[-0.02em]">
                        {author?.name || 'User'}
                      </p>
                      {isOwner && (
                        <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded-full text-white/60">
                          You
                        </span>
                      )}
                    </div>

                    {/* Comment content with long-press handler */}
                    <div
                      onTouchStart={() => beginLongPress(c)}
                      onTouchEnd={cancelLongPress}
                      onTouchMove={cancelLongPress}
                      onMouseDown={() => beginLongPress(c)}
                      onMouseUp={cancelLongPress}
                      onMouseLeave={cancelLongPress}
                    >
                      {!!c.text && (
                        <p className="text-[#E4E6EB] text-[22px] leading-[1.28] font-medium whitespace-pre-wrap break-words">
                          {c.text}
                        </p>
                      )}

                      {/* Comment image */}
                      {(c.image_url || c.imageUrl) && (
                        <img
                          src={c.image_url || c.imageUrl}
                          alt=""
                          className="mt-3 max-w-[240px] rounded-[20px] border border-white/10 object-cover"
                        />
                      )}
                    </div>

                    {/* Action buttons - timestamp, react, reply */}
                    <div className="mt-3 flex items-center gap-8">
                      <span className="text-[13px] font-semibold text-white/45">
                        {(() => {
                          const created = c.created_at || c.createdAt;
                          if (!created) return '';
                          const diff = Math.floor((Date.now() - new Date(created).getTime()) / 1000);
                          if (diff < 60) return 'now';
                          if (diff < 3600) return `${Math.floor(diff / 60)}m`;
                          if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
                          if (diff < 2592000) return `${Math.floor(diff / 86400)}d`;
                          return `${Math.floor(diff / 2592000)}mo`;
                        })()}
                      </span>

                      {/* Reaction button with emoji picker - horizontal scroll */}
                      <div className="relative">
                        <button
                          onClick={() => setShowReactionPicker(showReactionPicker === c.id ? null : c.id)}
                          className="text-[13px] font-bold text-white/45 hover:text-white/70 transition-colors"
                        >
                          {commentReactions[c.id] ? (
                            <span className="text-xl">{commentReactions[c.id]}</span>
                          ) : (
                            'React'
                          )}
                        </button>

                        {showReactionPicker === c.id && (
                          <div className="absolute bottom-full left-0 mb-2 bg-[#242526] rounded-2xl p-3 border border-white/10 shadow-2xl z-50">
                            <div className="flex overflow-x-auto gap-2 max-w-[300px] scrollbar-hide pb-1">
                              {REACTION_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => addReaction(c.id, emoji)}
                                  className="text-2xl hover:scale-125 transition-transform flex-shrink-0"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setReplyTo(c)}
                        className="text-[13px] font-bold text-white/45 hover:text-white/70 transition-colors"
                      >
                        Reply
                      </button>
                    </div>

                    {/* Reply preview section */}
                    {!replyTo && replies.length > 0 && (
                      <div className="mt-5">
                        {hiddenRepliesCount > 0 && (
                          <button
                            onClick={() => setReplyTo(c)}
                            className="text-[#1877F2] font-black text-[16px] leading-none hover:opacity-80 transition-opacity"
                          >
                            {getReplyPreviewText(hiddenRepliesCount)}
                          </button>
                        )}

                        {lastReply && (
                          <div className="mt-4 ml-2">
                            <div className="flex gap-3">
                              <img
                                src={
                                  users.find((u: any) => Number(u.id) === Number(lastReply.userId ?? lastReply.user_id))
                                    ?.profile_image_url ||
                                  users.find((u: any) => Number(u.id) === Number(lastReply.userId ?? lastReply.user_id))
                                    ?.profileImage ||
                                  'https://via.placeholder.com/40'
                                }
                                className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                                alt=""
                              />

                              <div className="flex-1 min-w-0">
                                <p className="text-white font-black text-[22px] leading-none mb-2">
                                  {users.find((u: any) => Number(u.id) === Number(lastReply.userId ?? lastReply.user_id))?.name || 'User'}
                                </p>

                                {!!lastReply.text && (
                                  <p className="text-[#E4E6EB] text-[22px] leading-[1.28] font-medium whitespace-pre-wrap break-words">
                                    {lastReply.text}
                                  </p>
                                )}

                                {(lastReply.image_url || lastReply.imageUrl) && (
                                  <img
                                    src={lastReply.image_url || lastReply.imageUrl}
                                    alt=""
                                    className="mt-3 max-w-[220px] rounded-[18px] border border-white/10 object-cover"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Comment input area */}
        <div className="p-6 pb-10 border-t border-white/5 bg-[#0A0A0A]">
          {replyTo && (
            <div className="mb-3 flex items-center gap-2 bg-white/5 p-2 rounded-lg">
              <span className="text-xs text-white/60">Replying to</span>
              <span className="text-xs text-[#1877F2] font-bold">
                @{users.find(u => Number(u.id) === Number(replyTo.userId ?? replyTo.user_id))?.name || 'User'}
              </span>
              <button 
                onClick={() => setReplyTo(null)}
                className="ml-auto text-white/40 hover:text-white"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
          )}
          
          {imagePreview && (
            <div className="mb-3 relative inline-block">
              <img src={imagePreview} className="h-20 rounded-lg border border-white/10" alt="" />
              <button 
                onClick={() => {
                  if (imagePreview) URL.revokeObjectURL(imagePreview);
                  setSelectedImage(null);
                  setImagePreview(null);
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
              >
                <i className="fas fa-times text-white text-xs"></i>
              </button>
            </div>
          )}
          
          {/* Emoji bar */}
          {showEmojiBar && (
            <div className="mb-3 flex flex-wrap gap-2 bg-white/5 border border-white/10 rounded-2xl p-3">
              {COMMENT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="text-2xl leading-none active:scale-90 transition-transform hover:bg-white/10 p-1 rounded-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          
          <div className="flex gap-3">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageSelect}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white"
            >
              <i className="fas fa-image"></i>
            </button>

            <button
              onClick={() => setShowEmojiBar(prev => !prev)}
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-colors ${
                showEmojiBar
                  ? 'bg-[#1877F2]/15 border-[#1877F2]/40 text-[#1877F2]'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
              }`}
            >
              <i className="far fa-smile"></i>
            </button>

            <input
              ref={inputRef}
              className="flex-1 bg-white/5 border border-white/10 rounded-[24px] px-5 py-4 text-[17px] text-white outline-none focus:border-[#1877F2] focus:bg-white/10 transition-all"
              placeholder={replyTo ? "Write a reply..." : "Add to discussion..."}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && (text.trim() || selectedImage)) {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking input
            />

            <button
              onClick={handleSubmitComment}
              className="bg-[#1877F2] text-white px-6 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-all disabled:opacity-50"
              disabled={!text.trim() && !selectedImage}
            >
              <i className="fas fa-paper-plane text-xs"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Comment action menu */}
      {menuComment && (
        <div
          className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm"
          onClick={() => setMenuComment(null)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-w-[450px] mx-auto bg-[#121212] rounded-t-[32px] border-t border-white/10 p-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5"></div>

            {/* React button */}
            <button
              onClick={() => {
                setShowReactionPicker(menuComment.id);
                setMenuComment(null);
              }}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white"
            >
              <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white/80">
                <i className="fas fa-smile"></i>
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">React</p>
                <p className="text-white/50 text-xs">Add emoji reaction</p>
              </div>
            </button>

            <button
              onClick={() => {
                setReplyTo(menuComment);
                setMenuComment(null);
              }}
              className="w-full mt-3 flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white"
            >
              <div className="w-11 h-11 rounded-full bg-[#1877F2]/15 flex items-center justify-center text-[#1877F2]">
                <i className="fas fa-reply"></i>
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Reply</p>
                <p className="text-white/50 text-xs">Respond to this discussion</p>
              </div>
            </button>

            {isOwnerComment(menuComment) && (
              <>
                <button
                  onClick={() => openEditComment(menuComment)}
                  className="w-full mt-3 flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white"
                >
                  <div className="w-11 h-11 rounded-full bg-[#45BD62]/15 flex items-center justify-center text-[#45BD62]">
                    <i className="fas fa-pen"></i>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Edit</p>
                    <p className="text-white/50 text-xs">Change your message</p>
                  </div>
                </button>

                <button
                  onClick={() => confirmDeleteComment(menuComment)}
                  className="w-full mt-3 flex items-center gap-4 px-4 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400"
                >
                  <div className="w-11 h-11 rounded-full bg-red-500/15 flex items-center justify-center">
                    <i className="fas fa-trash-alt"></i>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Delete</p>
                    <p className="text-red-300/60 text-xs">Remove it permanently</p>
                  </div>
                </button>
              </>
            )}

            <button
              onClick={() => setMenuComment(null)}
              className="w-full mt-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/80 font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit comment modal */}
      {editingComment && (
        <div className="fixed inset-0 z-[510] bg-black/70 backdrop-blur-sm flex items-end">
          <div className="w-full max-w-[450px] mx-auto bg-[#121212] rounded-t-[32px] border-t border-white/10 p-5 animate-slide-up">
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5"></div>

            <h3 className="text-white text-lg font-black mb-4">Edit Discussion</h3>

            <textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none text-[17px]"
              placeholder="Update discussion..."
            />

            {/* Emoji bar for edit modal */}
            <div className="mt-3 flex flex-wrap gap-2 bg-white/5 border border-white/10 rounded-2xl p-3">
              {COMMENT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEditEmoji(emoji)}
                  className="text-2xl leading-none active:scale-90 transition-transform hover:bg-white/10 p-1 rounded-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setEditingComment(null);
                  setEditingText('');
                }}
                className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white"
              >
                Cancel
              </button>
              <button
                onClick={saveEditedComment}
                className="flex-1 py-4 rounded-2xl bg-[#1877F2] text-white font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== AUDIO TRIMMING UTILITIES ====================
async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch audio");
  return await res.arrayBuffer();
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;

  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // RIFF header
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // fmt chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits

  // data chunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave + PCM16
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = buffer.getChannelData(ch)[i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: "audio/wav" });
}

async function trimAudioUrlToWavBlob(audioUrl: string, startSec: number, endSec: number) {
  if (!audioUrl) throw new Error("Missing audioUrl");
  if (!(endSec > startSec)) throw new Error("Invalid trim range");

  const arrayBuffer = await fetchAsArrayBuffer(audioUrl);

  const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
  const ctx = new AudioCtx();
  const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));

  const sr = decoded.sampleRate;
  const startSample = Math.max(0, Math.floor(startSec * sr));
  const endSample = Math.min(decoded.length, Math.floor(endSec * sr));
  const frameCount = Math.max(0, endSample - startSample);

  if (frameCount <= 0) throw new Error("Trim produced empty audio");

  const trimmed = ctx.createBuffer(decoded.numberOfChannels, frameCount, sr);

  for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
    const channel = decoded.getChannelData(ch).slice(startSample, endSample);
    trimmed.copyToChannel(channel, ch, 0);
  }

  const wavBlob = audioBufferToWavBlob(trimmed);

  try { await ctx.close(); } catch {}
  return { blob: wavBlob, duration: frameCount / sr };
}

// ==================== AUDIO FOCUS MANAGER ====================
const useAudioFocus = () => {
  const stopAllAudio = useCallback(() => {
    document.querySelectorAll('audio').forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (error) {
        console.warn('Failed to stop audio:', error);
      }
    });
    
    document.querySelectorAll('video').forEach(video => {
      try {
        video.pause();
        video.muted = true;
      } catch (error) {
        console.warn('Failed to stop video:', error);
      }
    });
  }, []);

  return { stopAllAudio };
};

// ==================== ENHANCED AUDIO TRIMMER ====================
const AudioTrimmer: React.FC<{ 
  url: string, 
  onClose: () => void, 
  onConfirm: (start: number, end: number, trimmedFile?: File) => void,
  initialStart: number,
  initialEnd: number,
  soundId?: string | number;
  soundName?: string;
  onMountStopAll?: () => void;
  onStopVideo?: () => void;
}> = ({ url, onClose, onConfirm, initialStart, initialEnd, soundId, soundName, onMountStopAll, onStopVideo }) => {
  const { stopAllAudio } = useAudioFocus();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd > 0 ? initialEnd : Math.min(60, initialStart + 15));
  const [duration, setDuration] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activeThumb, setActiveThumb] = useState<'start' | 'end'>('start');
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);
  const [trimStatus, setTrimStatus] = useState<'idle' | 'trimming' | 'success' | 'error'>('idle');
  const [trimError, setTrimError] = useState<string>('');
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const trimAudioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<any>(null);
  
  const MIN_WINDOW = 1;
  const MAX_WINDOW = 60;

  useEffect(() => {
    onStopVideo?.();
    onMountStopAll?.();
    stopAllAudio();
    
    if (trimAudioRef.current) {
      trimAudioRef.current.src = url;
      trimAudioRef.current.currentTime = start;
    }
    
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (trimAudioRef.current) {
        trimAudioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    const handleTimeUpdate = () => {
      if (!isPlaying) return;
      
      setCurrentTime(trimAudioRef.current?.currentTime || 0);
      
      if (trimAudioRef.current && (trimAudioRef.current.currentTime < start || trimAudioRef.current.currentTime >= end)) {
        trimAudioRef.current.currentTime = start;
      }
    };

    const audio = trimAudioRef.current;
    if (audio) {
      audio.addEventListener('timeupdate', handleTimeUpdate);
      return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, [isPlaying, start, end]);

  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        if (trimAudioRef.current) {
          setCurrentTime(trimAudioRef.current.currentTime);
        }
      }, 100);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    }
    
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying]);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      setDuration(d);
      if (initialEnd === 0 || initialEnd > d) {
        const newEnd = Math.min(d, start + 15);
        setEnd(newEnd);
      }
    }
  };

  const togglePlay = () => {
    if (!trimAudioRef.current) return;

    stopAllAudio();

    if (isPlaying) {
      trimAudioRef.current.pause();
      setIsPlaying(false);
    } else {
      trimAudioRef.current.currentTime = start;
      trimAudioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleStartChange = (value: number) => {
    const newStart = Math.min(value, end - MIN_WINDOW);
    setStart(newStart);
    if (trimAudioRef.current) {
      trimAudioRef.current.currentTime = newStart;
    }
  };

  const handleEndChange = (value: number) => {
    const newEnd = Math.max(value, start + MIN_WINDOW);
    setEnd(Math.min(newEnd, start + MAX_WINDOW));
    if (trimAudioRef.current) {
      trimAudioRef.current.currentTime = newEnd;
    }
  };

  const handleTrackInteraction = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
    const clickTime = clickPercent * duration;

    const distStart = Math.abs(clickTime - start);
    const distEnd = Math.abs(clickTime - end);
    setActiveThumb(distStart < distEnd ? 'start' : 'end');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleConfirm = async () => {
    setIsTrimming(true);
    setTrimStatus('trimming');
    setTrimProgress(0);
    setTrimError('');
    
    try {
      for (let i = 0; i <= 90; i += 10) {
        setTrimProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const { blob, duration: trimDuration } = await trimAudioUrlToWavBlob(url, start, end);
      
      setTrimProgress(95);
      
      const trimmedFile = new File([blob], `trimmed-${Date.now()}.wav`, { 
        type: "audio/wav" 
      });
      
      setTrimProgress(100);
      setTrimStatus('success');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onConfirm(start, end, trimmedFile);
      
    } catch (error: any) {
      console.error('Audio trimming failed:', error);
      setTrimStatus('error');
      setTrimError(error?.message || 'Failed to trim audio');
      setIsTrimming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[800] bg-black/98 flex flex-col justify-end animate-fade-in font-sans">
      <style>{`
        .precision-slider {
          pointer-events: none;
          appearance: none;
          background: transparent;
          width: 100%;
          position: absolute;
          left: 0;
          z-index: 40;
        }
        .precision-slider::-webkit-slider-thumb {
          pointer-events: auto;
          appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          border: 4px solid currentColor;
        }
        .slider-active { z-index: 50; }
        .slider-blue::-webkit-slider-thumb { color: #1877F2; }
        .slider-red::-webkit-slider-thumb { color: #F3425F; }
      `}</style>

      {(isTrimming || trimStatus === 'trimming' || trimStatus === 'error') && (
        <div className="absolute inset-0 z-[900] bg-black/95 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-gradient-to-b from-[#1A1A1A] to-[#0A0A0A] rounded-3xl p-8 max-w-sm w-full border border-white/10 shadow-2xl">
            <div className="flex flex-col items-center justify-center gap-6">
              {trimStatus === 'trimming' ? (
                <>
                  <div className="w-24 h-24 relative">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth="8"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#1877F2"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${trimProgress * 2.83} 283`}
                        strokeDashoffset="0"
                        className="transition-all duration-300 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
                        <i className="fas fa-scissors text-2xl text-[#1877F2] animate-pulse"></i>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2">Trimming Audio</h3>
                    <p className="text-[#B0B3B8] text-sm">
                      Creating trimmed audio file ({Math.round(trimProgress)}%)
                    </p>
                    <div className="w-full bg-white/10 rounded-full h-2 mt-4 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#1877F2] to-[#2D8CFF] rounded-full transition-all duration-300"
                        style={{ width: `${trimProgress}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : trimStatus === 'error' ? (
                <>
                  <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                    <i className="fas fa-exclamation-triangle text-3xl text-red-500"></i>
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2">Trimming Failed</h3>
                    <p className="text-[#B0B3B8] text-sm mb-6">{trimError || 'Failed to trim audio'}</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setTrimStatus('idle');
                          setTrimError('');
                          setIsTrimming(false);
                        }}
                        className="flex-1 bg-gradient-to-r from-[#1877F2] to-[#2D8CFF] text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={onClose}
                        className="flex-1 bg-white/10 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#121212] w-full rounded-t-[40px] p-8 pb-14 border-t border-white/10 animate-slide-up shadow-2xl relative">
        <div className="flex justify-between items-center mb-10">
          <button 
            onClick={onClose} 
            disabled={isTrimming}
            className="text-[#B0B3B8] font-black uppercase text-[10px] tracking-widest px-4 py-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="text-center">
            <h3 className="font-black text-white uppercase tracking-[4px] text-xs">Precision Sync</h3>
            <p className="text-[9px] text-[#1877F2] font-black mt-1 uppercase tracking-tighter">Trim & Export Audio</p>
            {soundName && (
              <p className="text-[8px] text-white/60 font-bold mt-0.5 uppercase tracking-tight truncate max-w-[200px]">
                {soundName}
              </p>
            )}
          </div>
          <button 
            onClick={handleConfirm} 
            disabled={isTrimming || trimStatus === 'trimming'}
            className="text-[#1877F2] font-black uppercase text-[10px] tracking-widest px-4 py-2 disabled:opacity-50"
          >
            {isTrimming ? 'Processing...' : 'Done'}
          </button>
        </div>

        <div className="flex items-center justify-center gap-4 mb-8">
          <button 
            onClick={togglePlay}
            disabled={isTrimming}
            className="w-16 h-16 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-white text-xl`}></i>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-white text-sm font-bold">
              {formatDuration(currentTime - start)}
            </span>
            <span className="text-white/40 text-[9px] uppercase tracking-widest">Current</span>
          </div>
        </div>

        <div 
          ref={containerRef}
          onMouseDown={(e) => !isTrimming && handleTrackInteraction(e.clientX)}
          onTouchStart={(e) => !isTrimming && handleTrackInteraction(e.touches[0].clientX)}
          className="relative h-28 w-full bg-white/5 rounded-3xl overflow-hidden px-8 border border-white/5 shadow-inner flex flex-col justify-center"
        >
          <div className="absolute inset-0 flex items-center gap-[2px] opacity-10 px-8 pointer-events-none">
            {Array.from({ length: 100 }).map((_, i) => (
              <div key={i} className="flex-1 bg-white rounded-full" style={{ height: `${15 + Math.random() * 70}%` }} />
            ))}
          </div>

          <div 
            className="absolute h-16 bg-[#1877F2]/10 border-x-2 border-white/30 pointer-events-none transition-all duration-75 z-10" 
            style={{ left: `${(start / duration) * 100}%`, width: `${((end - start) / duration) * 100}%` }} 
          />

          <div className="relative w-full h-1 flex items-center bg-white/10 rounded-full">
            <input 
              type="range" 
              min="0" 
              max={duration} 
              step="0.1" 
              value={start} 
              onMouseDown={() => { if (!isTrimming) { setIsDragging(true); setActiveThumb('start'); } }}
              onMouseUp={() => setIsDragging(false)}
              onChange={(e) => !isTrimming && handleStartChange(parseFloat(e.target.value))}
              className={`precision-slider slider-blue ${activeThumb === 'start' ? 'slider-active' : ''}`}
              disabled={isTrimming}
            />
            <input 
              type="range" 
              min="0" 
              max={duration} 
              step="0.1" 
              value={end} 
              onMouseDown={() => { if (!isTrimming) { setIsDragging(true); setActiveThumb('end'); } }}
              onMouseUp={() => setIsDragging(false)}
              onChange={(e) => !isTrimming && handleEndChange(parseFloat(e.target.value))}
              className={`precision-slider slider-red ${activeThumb === 'end' ? 'slider-active' : ''}`}
              disabled={isTrimming}
            />
          </div>
        </div>

        <div className="flex justify-center gap-4 mt-8">
          <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex flex-col items-center">
            <span className="text-[8px] font-black text-[#1877F2] uppercase tracking-widest">In</span>
            <p className="text-white text-xs font-black">{start.toFixed(1)}s</p>
          </div>
          <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex flex-col items-center">
            <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Out</span>
            <p className="text-white text-xs font-black">{end.toFixed(1)}s</p>
          </div>
          <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex flex-col items-center">
            <span className="text-[8px] font-black text-[#45BD62] uppercase tracking-widest">Length</span>
            <p className="text-white text-xs font-black">{(end - start).toFixed(1)}s</p>
          </div>
        </div>

        <div className="mt-10 text-center">
          <p className="text-white/50 text-xs mb-2">
            <i className="fas fa-info-circle text-[#1877F2] mr-2"></i>
            Trimmed audio will be exported as a new file
          </p>
          <p className="text-white/30 text-[10px]">
            Original: {formatDuration(duration)} → Trimmed: {formatDuration(end - start)}
          </p>
        </div>

        <audio 
          ref={audioRef} 
          src={url} 
          hidden 
          onLoadedMetadata={handleLoadedMetadata}
        />
        <audio 
          ref={trimAudioRef} 
          src={url} 
          hidden 
        />
      </div>
    </div>
  );
};

// ==================== ENHANCED CREATE REEL MODAL ====================
export const CreateReelModal: React.FC<{ 
  currentUser: User, 
  onClose: () => void, 
  onCreate: (data: Partial<Reel> & { 
    videoFile: File;
    audioFile?: File | Blob;
    originalSoundId?: string | number;
    soundKey?: string;
    songId?: string | number;
    visibility?: string;
    location?: string;
  }) => Promise<void> | void,
  initialSound?: Sound | null,
  songs: Song[];
  selectedSound?: ReelSound | null;
  onPickSound?: (sound: ReelSound | null) => void;
  toBlobUrl?: (url: string) => Promise<string>;
}> = ({ currentUser, onClose, onCreate, initialSound, songs, selectedSound, onPickSound, toBlobUrl }) => {
  const { stopAllAudio } = useAudioFocus();
  
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<Sound | null>(initialSound || null);
  const [audioStart, setAudioStart] = useState(initialSound?.start || selectedSound?.audioStart || 0);
  const [audioEnd, setAudioEnd] = useState(initialSound?.end || selectedSound?.audioEnd || 0);
  const [isMusicPickerOpen, setIsMusicPickerOpen] = useState(false);
  const [isTrimmerOpen, setIsTrimmerOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isStudioPlaying, setIsStudioPlaying] = useState(false);
  const [musicSearch, setMusicSearch] = useState('');
  const [selectedSoundId, setSelectedSoundId] = useState<string | number | null>(initialSound?.id || selectedSound?.songId || null);
  const [previewSound, setPreviewSound] = useState<Sound | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [availableSongs, setAvailableSongs] = useState<Song[]>(songs || []);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [popularSounds, setPopularSounds] = useState<Sound[]>([]);
  const [loadingPopularSounds, setLoadingPopularSounds] = useState(false);
  
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'processing' | 'success' | 'error'>('uploading');
  const [uploadError, setUploadError] = useState<string>('');
  
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [trimmedAudioFile, setTrimmedAudioFile] = useState<File | null>(null);
  const [isTrimmedAudio, setIsTrimmedAudio] = useState(false);
  
  const [visibility, setVisibility] = useState<string>('public');
  const [location, setLocation] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const audioUploadRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const generateSoundKey = useCallback((sound: Sound | ReelSound | null): string => {
    if (!sound) return 'original:none';
    
    if ('songId' in sound && sound.songId) {
      return `song:${sound.songId}`;
    }
    
    if ('soundKey' in sound && sound.soundKey) {
      return sound.soundKey;
    }
    
    if (selectedSoundId) {
      return `original:${selectedSoundId}`;
    }
    
    return 'original:none';
  }, [selectedSoundId]);

  useEffect(() => {
    if (selectedSound) {
      const sound: Sound = {
        id: selectedSound.songId || `selected-${Date.now()}`,
        name: selectedSound.songName,
        url: selectedSound.audioUrl,
        start: selectedSound.audioStart,
        end: selectedSound.audioEnd,
        creator: currentUser,
        isOriginal: true,
        soundKey: selectedSound.soundKey || generateSoundKey(selectedSound),
        originalUrl: selectedSound.originalUrl
      };
      setSelectedAudio(sound);
      setSelectedSoundId(sound.id);
      setAudioStart(selectedSound.audioStart || 0);
      setAudioEnd(selectedSound.audioEnd || 0);
      
      if (!mediaPreview) {
        setIsStudioPlaying(true);
      }
    }
  }, [selectedSound, currentUser, generateSoundKey]);

  useEffect(() => {
    if (mediaPreview && selectedAudio && audioRef.current && videoRef.current) {
      const audio = audioRef.current;
      const video = videoRef.current;

      if (isStudioPlaying && !isTrimmerOpen) {
        const syncAudio = () => {
          if (!audio || !video) return;
          
          const expectedAudioTime = video.currentTime + audioStart;
          
          if (audioEnd > 0 && expectedAudioTime >= audioEnd) {
            video.currentTime = 0;
            audio.currentTime = audioStart;
            return;
          }
          
          if (Math.abs(audio.currentTime - expectedAudioTime) > 0.5) {
            audio.currentTime = expectedAudioTime;
          }
        };

        video.addEventListener('timeupdate', syncAudio);
        if (video.paused) video.play().catch(() => {});
        if (audio.paused) audio.play().catch(() => {});

        return () => {
          video.removeEventListener('timeupdate', syncAudio);
        };
      } else {
        video.pause();
        audio.pause();
      }
    }
  }, [mediaPreview, selectedAudio, audioStart, audioEnd, isStudioPlaying, isTrimmerOpen]);

  useEffect(() => {
    if (previewSound && previewAudioRef.current && isPreviewPlaying) {
      const audio = previewAudioRef.current;
      audio.src = previewSound.url;
      audio.currentTime = previewSound.start || 0;
      audio.play().catch(() => {});
      
      const stopAfterDuration = () => {
        setTimeout(() => {
          setIsPreviewPlaying(false);
        }, Math.min(10000, (previewSound.duration || 30) * 1000));
      };
      
      stopAfterDuration();
      
      return () => {
        audio.pause();
      };
    }
  }, [previewSound, isPreviewPlaying]);

  const handleSoundPreview = (sound: Sound) => {
    stopAllAudio();
    
    if (previewSound?.id === sound.id && isPreviewPlaying) {
      setIsPreviewPlaying(false);
      setPreviewSound(null);
    } else {
      setPreviewSound(sound);
      setIsPreviewPlaying(true);
    }
  };

  const handleSoundSelect = (sound: Sound) => {
    stopAllAudio();
    setSelectedAudio(sound);
    setSelectedSoundId(sound.id);
    setAudioStart(sound.start || 0);
    setAudioEnd(sound.end || sound.duration || 60);
    setIsMusicPickerOpen(false);
    
    if (onPickSound) {
      onPickSound({
        songName: sound.name,
        audioUrl: sound.url,
        originalUrl: sound.originalUrl || sound.url,
        audioStart: sound.start || 0,
        audioEnd: sound.end || sound.duration || 60,
        songId: sound.id,
        soundKey: sound.soundKey || generateSoundKey(sound)
      });
    }
    
    setIsStudioPlaying(true);
    setIsTrimmerOpen(true);
  };

  const handleUpload = async () => {
    if (!selectedVideoFile) {
      setUploadStatus('error');
      setUploadError('Please select a video file');
      return;
    }
    
    if (!selectedVideoFile.type.startsWith('video/')) {
      setUploadStatus('error');
      setUploadError('Please select a valid video file');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('uploading');
    setUploadError('');
    
    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Your video is still uploading. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);
    
    try {
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const soundKey = generateSoundKey(selectedAudio);
      
      await Promise.resolve(onCreate({
        caption: caption.trim(),
        songName: selectedAudio?.name || 'Original Sound',
        audioUrl: selectedAudio?.originalUrl || selectedAudio?.url,
        audioStart: trimmedAudioFile ? 0 : audioStart,
        audioEnd: trimmedAudioFile ? 0 : audioEnd,
        videoFile: selectedVideoFile,
        audioFile: trimmedAudioFile || selectedAudioFile || undefined,
        originalSoundId: selectedSoundId || undefined,
        soundKey,
        songId: selectedSoundId || undefined,
        visibility,
        location,
      }));
      
      setUploadProgress(100);
      setUploadStatus('processing');
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setUploadStatus('success');
      
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (error: any) {
      console.error('Failed to create reel:', error);
      setUploadStatus('error');
      setUploadError(error?.message || 'Upload failed. Please try again.');
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('video/')) {
      setUploadStatus('error');
      setUploadError('Please select a valid video file (MP4, MOV, etc.)');
      return;
    }
    
    setSelectedVideoFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setIsStudioPlaying(true);
  };

  const handleTrimConfirm = (start: number, end: number, trimmedFile?: File) => {
    setAudioStart(start);
    setAudioEnd(end);
    
    if (trimmedFile) {
      setTrimmedAudioFile(trimmedFile);
      setIsTrimmedAudio(true);
      
      const trimmedAudioUrl = URL.createObjectURL(trimmedFile);
      if (selectedAudio) {
        setSelectedAudio({
          ...selectedAudio,
          url: trimmedAudioUrl,
          start: 0,
          end: end - start
        });
      }
    }
    
    setIsTrimmerOpen(false);
    setIsStudioPlaying(true);
  };

  const handleStopVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsStudioPlaying(false);
  };

  return (
    <>
      {(isUploading || uploadStatus === 'success' || uploadStatus === 'error') && (
        <UploadLoader 
          uploadProgress={uploadProgress}
          uploadStatus={uploadStatus}
          errorMessage={uploadError}
        />
      )}
      
      <div className="fixed inset-0 z-[500] bg-black flex flex-col font-sans animate-fade-in text-white overflow-hidden">
        {isCameraOpen && (
          <CameraStudio 
            selectedSound={selectedAudio || undefined}
            onCapture={(blob) => { 
              const file = new File([blob], `reel-${Date.now()}.mp4`, { type: blob.type || 'video/mp4' });
              setSelectedVideoFile(file);
              setMediaPreview(URL.createObjectURL(blob));
              setIsCameraOpen(false); 
              setIsStudioPlaying(true);
            }} 
            onClose={() => setIsCameraOpen(false)} 
          />
        )}
        
        <div className="absolute inset-0 z-0 bg-[#050505] flex items-center justify-center">
          {mediaPreview ? (
            <div className="relative w-full h-full" onClick={() => !isTrimmerOpen && setIsStudioPlaying(!isStudioPlaying)}>
              <video 
                ref={videoRef} 
                src={mediaPreview} 
                className="w-full h-full object-cover opacity-80" 
                loop 
                muted={!!selectedAudio} 
                playsInline 
              />
              {!isStudioPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 shadow-2xl">
                    <i className="fas fa-play text-white text-3xl ml-1"></i>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-12 max-w-[320px] animate-fade-in">
              <div className="w-24 h-24 bg-white/5 rounded-[40px] flex items-center justify-center mb-8 border border-white/10 mx-auto shadow-2xl">
                <i className="fas fa-clapperboard text-4xl text-[#1877F2] animate-pulse"></i>
              </div>
              <h2 className="text-3xl font-black mb-3 tracking-tighter uppercase leading-none">Studio</h2>
              <p className="text-white/50 text-[14px] font-medium leading-relaxed">Choose your production style to share with the community.</p>
            </div>
          )}
          {selectedAudio && <audio ref={audioRef} src={selectedAudio.url} hidden />}
          {previewSound && <audio ref={previewAudioRef} hidden />}
        </div>

        <div className="relative z-20 h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/90 to-transparent pt-2">
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center border border-white/10 active:scale-90 transition-transform">
            <i className="fas fa-times text-lg"></i>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-[5px] text-[#1877F2]">UNERA PRO</span>
            {selectedAudio && (
              <span className="text-[8px] text-white/60 font-bold uppercase tracking-tight truncate max-w-[150px]">
                {isTrimmedAudio ? 'Trimmed: ' : 'Sound: '}{selectedAudio.name}
              </span>
            )}
          </div>
          <button 
            onClick={handleUpload} 
            disabled={!selectedVideoFile || isUploading} 
            className="bg-[#1877F2] text-white px-7 py-2.5 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Uploading...
              </span>
            ) : 'Publish'}
          </button>
        </div>

        {mediaPreview && (
          <div className="absolute right-6 top-[25%] z-20 flex flex-col gap-6">
            <button onClick={() => {
              stopAllAudio();
              setIsMusicPickerOpen(true);
            }} className="flex flex-col items-center gap-2">
              <div className={`w-14 h-14 rounded-3xl flex items-center justify-center backdrop-blur-2xl transition-all border-2 ${selectedAudio ? 'bg-[#1877F2] border-blue-400 shadow-[0_0_20px_rgba(24,119,242,0.4)]' : 'bg-black/40 border-white/10'}`}>
                <i className="fas fa-music text-xl"></i>
              </div>
              <span className="text-[10px] font-black uppercase text-white/70 tracking-widest">Sound</span>
            </button>
            {selectedAudio && (
              <button onClick={() => {
                stopAllAudio();
                handleStopVideo();
                setIsTrimmerOpen(true);
              }} className="flex flex-col items-center gap-2 animate-fade-in">
                <div className="w-14 h-14 rounded-3xl bg-black/40 border-2 border-white/10 flex items-center justify-center backdrop-blur-2xl">
                  <i className="fas fa-scissors text-xl"></i>
                </div>
                <span className="text-[10px] font-black uppercase text-white/70 tracking-widest">Trim</span>
              </button>
            )}
            <button onClick={() => {
              stopAllAudio();
              setMediaPreview(null);
              setSelectedVideoFile(null);
              setSelectedAudio(null);
              setSelectedAudioFile(null);
              setTrimmedAudioFile(null);
              setIsTrimmedAudio(false);
              setSelectedSoundId(null);
              if (onPickSound) onPickSound(null);
            }} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-3xl bg-red-600/20 border-2 border-red-600/30 text-red-500 flex items-center justify-center backdrop-blur-2xl">
                <i className="fas fa-trash-alt text-xl"></i>
              </div>
              <span className="text-[10px] font-black uppercase text-red-500/70 tracking-widest">Discard</span>
            </button>
          </div>
        )}

        {!mediaPreview && (
          <div className="flex-1 flex flex-col items-center justify-center px-10 gap-8 z-10 animate-fade-in">
            <button 
              onClick={() => setIsCameraOpen(true)}
              className="w-full max-w-[340px] bg-[#1877F2] rounded-[40px] p-10 flex flex-col items-center justify-center cursor-pointer shadow-[0_20px_60px_rgba(24,119,242,0.4)] active:scale-95 transition-all group overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
              <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center mb-6 shadow-2xl group-hover:scale-110 transition-transform">
                <i className="fas fa-video text-white text-4xl"></i>
              </div>
              <p className="font-black uppercase text-lg tracking-[5px] text-white">Record Live</p>
              <p className="text-white/60 text-[11px] font-bold mt-2 uppercase tracking-[2px]">Filters + Enhanced Audio</p>
            </button>

            <div className="flex items-center gap-6 w-full max-w-[340px]">
              <div className="h-[1px] bg-white/10 flex-1"></div>
              <span className="text-[11px] font-black text-white/20 uppercase tracking-widest">OR</span>
              <div className="h-[1px] bg-white/10 flex-1"></div>
            </div>

            <input 
              type="file" 
              id="video-input-mobile" 
              ref={videoInputRef}
              className="hidden" 
              accept="video/*" 
              onChange={handleFileSelect} 
            />
            <label 
              htmlFor="video-input-mobile" 
              className="w-full max-w-[340px] bg-white/5 border border-white/10 rounded-[32px] py-8 flex items-center justify-center gap-5 cursor-pointer active:scale-95 transition-all hover:bg-white/10 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-[#1877F2]/20 transition-colors">
                <i className="fas fa-cloud-upload-alt text-2xl text-[#B0B3B8] group-hover:text-[#1877F2]"></i>
              </div>
              <p className="font-black uppercase text-sm tracking-[3px] text-[#E4E6EB]">Upload from phone</p>
            </label>
          </div>
        )}

        {mediaPreview && (
          <div className="mt-auto relative z-20 p-8 bg-gradient-to-t from-black via-black/80 to-transparent pb-16">
            <div className="mb-6 flex gap-4">
              <select 
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 text-white outline-none text-sm"
              >
                <option value="public">🌍 Public</option>
                <option value="followers">👥 Followers Only</option>
                <option value="private">🔒 Private</option>
              </select>
              
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="📍 Add location"
                className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 text-white outline-none placeholder-white/30 text-sm"
              />
            </div>
            
            <textarea 
              className="w-full bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 text-[18px] outline-none h-40 resize-none font-medium leading-relaxed shadow-inner text-white placeholder-white/20"
              placeholder="Add a caption to your viral moment..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
            />
          </div>
        )}

        {isTrimmerOpen && selectedAudio && (
          <AudioTrimmer 
            url={selectedAudio.url} 
            onClose={() => {
              setIsTrimmerOpen(false);
              setIsStudioPlaying(true);
            }} 
            onConfirm={handleTrimConfirm} 
            initialStart={audioStart} 
            initialEnd={audioEnd}
            soundId={selectedSoundId || undefined}
            soundName={selectedAudio.name}
            onMountStopAll={stopAllAudio}
            onStopVideo={handleStopVideo}
          />
        )}

        {isMusicPickerOpen && (
          <MusicPicker
            songs={availableSongs}
            popularSounds={popularSounds}
            loadingSongs={loadingSongs}
            loadingPopularSounds={loadingPopularSounds}
            musicSearch={musicSearch}
            setMusicSearch={setMusicSearch}
            onSoundSelect={handleSoundSelect}
            onSoundPreview={handleSoundPreview}
            previewSound={previewSound}
            isPreviewPlaying={isPreviewPlaying}
            selectedSoundId={selectedSoundId}
            audioUploadRef={audioUploadRef}
            onAudioUpload={(file) => {
              const url = URL.createObjectURL(file);
              const newSound: Sound = {
                id: `upload-${Date.now()}`,
                name: file.name.split('.')[0],
                url,
                duration: 0,
                isOriginal: true,
                creator: currentUser,
                soundKey: `original:upload-${Date.now()}`,
                originalUrl: url
              };
              setSelectedAudio(newSound);
              setSelectedSoundId(newSound.id);
              setAudioStart(0);
              setAudioEnd(60);
              setIsMusicPickerOpen(false);
              setIsTrimmerOpen(true);
              handleStopVideo();
            }}
            onClose={() => setIsMusicPickerOpen(false)}
          />
        )}
      </div>
    </>
  );
};

// ==================== SOUND DETAIL VIEW ====================
interface SoundDetailViewProps {
  sound: Sound;
  onClose: () => void;
  onUseSound: (sound: Sound) => void;
  onReelClick: (id: number) => void;
}

export const SoundDetailView: React.FC<SoundDetailViewProps> = ({ 
  sound, 
  onClose, 
  onUseSound, 
  onReelClick
}) => {
  const { stopAllAudio } = useAudioFocus();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [soundReels, setSoundReels] = useState<Reel[]>([]);
  const [loadingReels, setLoadingReels] = useState(true);
  const [soundStats, setSoundStats] = useState({
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalUses: 0
  });
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const fetchSoundReels = async () => {
      setLoadingReels(true);
      try {
        const soundKey = sound.soundKey || sound.id;
        const response = await fetch(`/api/reels/by-sound?sound_key=${encodeURIComponent(String(soundKey))}&limit=60`);
        const data = await response.json();
        
        if (data?.success && data.reels) {
          setSoundReels(data.reels);
          
          const stats = {
            totalViews: 0,
            totalLikes: 0,
            totalComments: 0,
            totalShares: 0,
            totalUses: data.reels.length
          };

          data.reels.forEach((reel: Reel) => {
            stats.totalViews += reel.views || 0;
            stats.totalLikes += reel.reactions?.length || 0;
            stats.totalComments += reel.comments?.length || 0;
            stats.totalShares += reel.shares || 0;
          });

          setSoundStats(stats);
        }
      } catch (error) {
        console.error('Failed to fetch sound reels:', error);
        setSoundReels([]);
      } finally {
        setLoadingReels(false);
      }
    };

    fetchSoundReels();
  }, [sound.id, sound.soundKey]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying]);

  const playSoundPreview = () => {
    if (audioRef.current) {
      stopAllAudio();
      
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.src = sound.url;
        audioRef.current.currentTime = sound.start || 0;
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
        
        const duration = (sound.end || sound.duration || 30) - (sound.start || 0);
        setTimeout(() => {
          setIsPlaying(false);
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = sound.start || 0;
          }
        }, Math.min(duration * 1000, 10000));
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCount = (num: number): string => {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black flex flex-col animate-fade-in font-sans pb-20 overflow-hidden">
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 bg-black/90 backdrop-blur-xl shrink-0">
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-90 transition-transform">
          <i className="fas fa-chevron-left text-sm"></i>
        </button>
        <h3 className="font-black text-white text-[12px] uppercase tracking-[4px]">Sound Details</h3>
        <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
          <i className="fas fa-share-alt text-sm"></i>
        </button>
      </div>
      
      <div className="p-8 flex flex-col md:flex-row items-center gap-10 bg-gradient-to-b from-white/10 to-transparent shrink-0">
        <div className="relative group">
          <div 
            onClick={playSoundPreview}
            className={`w-36 h-36 rounded-full bg-gradient-to-tr from-gray-950 via-gray-900 to-black shadow-[0_0_50px_rgba(0,0,0,0.9)] border-4 border-white/20 flex items-center justify-center ${isPlaying ? 'animate-spin-slow' : ''} cursor-pointer hover:scale-105 transition-transform`}
          >
            <div className="w-12 h-12 rounded-full bg-[#1877F2]/20 border border-white/10 flex items-center justify-center">
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-[#1877F2] text-2xl ml-1`}></i>
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
            <span className="text-white text-[10px] font-bold">
              {formatDuration(currentTime)} / {formatDuration(sound.duration || 30)}
            </span>
          </div>
        </div>

        <div className="flex-1 text-center md:text-left">
          <h2 className="text-3xl font-black text-white mb-2 leading-tight tracking-tighter">
            {sound.name}
          </h2>
          <div className="flex items-center gap-2 mb-1">
            {sound.creator?.profile_image_url && (
              <img src={sound.creator.profile_image_url} className="w-6 h-6 rounded-full object-cover" alt="" />
            )}
            <p className="text-[#1877F2] font-black text-sm uppercase tracking-widest">
              BY {sound.creator?.name || 'Original Sound'}
            </p>
          </div>
          <p className="text-[#B0B3B8] font-bold text-xs uppercase tracking-[4px] mb-8">
            {formatCount(soundStats.totalUses)} VIRAL CREATIONS • {formatCount(soundStats.totalViews)} VIEWS
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => onUseSound(sound)} 
              className="bg-[#1877F2] text-white px-12 py-4 rounded-2xl font-black text-base shadow-2xl shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-3 flex-1"
            >
              <i className="fas fa-clapperboard text-sm"></i> Use this sound
            </button>
            
            <button 
              onClick={playSoundPreview}
              className={`px-8 py-4 rounded-2xl font-black text-base border transition-all flex items-center justify-center gap-3 ${isPlaying ? 'bg-[#45BD62]/20 text-[#45BD62] border-[#45BD62]' : 'bg-white/10 text-white border-white/20'}`}
            >
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-sm`}></i>
              {isPlaying ? 'Playing...' : 'Preview'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 border-t border-white/5">
        <h4 className="text-white font-black text-sm uppercase tracking-widest mb-4">Sound Statistics</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">Total Uses</p>
            <p className="text-white text-2xl font-black mt-2">{formatCount(soundStats.totalUses)}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">Total Views</p>
            <p className="text-white text-2xl font-black mt-2">{formatCount(soundStats.totalViews)}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">Total Reactions</p>
            <p className="text-white text-2xl font-black mt-2">{formatCount(soundStats.totalLikes)}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">Duration</p>
            <p className="text-white text-2xl font-black mt-2">{formatDuration(sound.duration || 30)}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">Sound Type</p>
            <p className="text-white text-2xl font-black mt-2">
              {sound.isOriginal ? 'Original' : 'Shared'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-0.5 mt-4">
        <div className="px-8 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-white font-black text-sm uppercase tracking-widest">
                Videos ({formatCount(soundStats.totalUses)})
              </h4>
              <p className="text-white/40 text-xs mt-1">
                {soundStats.totalUses} videos using this sound • {formatCount(soundStats.totalViews)} total views
              </p>
            </div>
            <div className="text-right">
              <p className="text-[#45BD62] text-xs font-bold">
                {soundStats.totalUses > 0 ? formatCount(soundStats.totalViews / soundStats.totalUses) : 0} avg views per video
              </p>
            </div>
          </div>
        </div>
        
        {loadingReels ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : soundReels.length > 0 ? (
          <div className="grid grid-cols-3 gap-0.5">
            {soundReels.map((reel: Reel) => (
              <ReelThumbnail 
                key={reel.id} 
                reel={reel} 
                onClick={() => {
                  onClose();
                  onReelClick(reel.id);
                }} 
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <i className="fas fa-music text-4xl text-[#B0B3B8] mb-4"></i>
            <p className="text-white/60">Be the first to use this sound!</p>
            <button 
              onClick={() => onUseSound(sound)} 
              className="mt-4 bg-[#1877F2] text-white px-6 py-3 rounded-xl font-bold"
            >
              Create First Reel
            </button>
          </div>
        )}
      </div>
      <audio ref={audioRef} hidden />
    </div>
  );
};

// ==================== REEL THUMBNAIL COMPONENT ====================
const ReelThumbnail: React.FC<{
  reel: Reel;
  onClick: () => void;
}> = ({ reel, onClick }) => {
  return (
    <div 
      onClick={onClick} 
      className="aspect-[9/16] bg-white/5 relative cursor-pointer group overflow-hidden"
    >
      <video 
        src={reel.videoUrl || (reel as any).video_url} 
        className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
        muted 
        playsInline 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-white text-[10px] font-black bg-black/40 px-2 py-1 rounded-lg backdrop-blur-md">
        <i className="fas fa-eye text-[8px]"></i> 
        {formatViewCount(reel.views)} 
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center">
          <i className="fas fa-play text-white text-xs"></i>
        </div>
      </div>
    </div>
  );
};

// ==================== SOUND PICKER COMPONENT ====================
interface MusicPickerProps {
  songs: Song[];
  popularSounds: Sound[];
  loadingSongs: boolean;
  loadingPopularSounds: boolean;
  musicSearch: string;
  setMusicSearch: (search: string) => void;
  onSoundSelect: (sound: Sound) => void;
  onSoundPreview: (sound: Sound) => void;
  previewSound: Sound | null;
  isPreviewPlaying: boolean;
  selectedSoundId: string | number | null;
  audioUploadRef: React.RefObject<HTMLInputElement>;
  onAudioUpload: (file: File) => void;
  onClose: () => void;
}

const MusicPicker: React.FC<MusicPickerProps> = ({
  songs,
  popularSounds,
  loadingSongs,
  loadingPopularSounds,
  musicSearch,
  setMusicSearch,
  onSoundSelect,
  onSoundPreview,
  previewSound,
  isPreviewPlaying,
  selectedSoundId,
  audioUploadRef,
  onAudioUpload,
  onClose
}) => {
  const availableSounds = useMemo(() => {
    const sounds: Sound[] = [];
    
    songs.forEach(song => {
      sounds.push({
        id: `song:${song.id}`,
        name: song.title,
        url: song.audio_url,
        originalUrl: song.audio_url,
        creator: { 
          id: song.artistId,
          name: song.artist,
          profile_image_url: song.cover_url
        },
        creationCount: 0,
        duration: song.duration,
        playCount: song.playCount || 0,
        coverImage: song.cover_url,
        isOriginal: false,
        soundKey: `song:${song.id}`
      });
    });

    if (popularSounds.length > 0) {
      popularSounds.forEach(sound => {
        if (!sounds.find(s => s.id === sound.id)) {
          sounds.push({
            ...sound,
            creationCount: 0
          });
        }
      });
    }

    return sounds.sort((a, b) => (b.creationCount || 0) - (a.creationCount || 0));
  }, [songs, popularSounds]);

  const filteredSounds = useMemo(() => {
    if (!musicSearch.trim()) return availableSounds;
    return availableSounds.filter(s => 
      s.name.toLowerCase().includes(musicSearch.toLowerCase()) || 
      s.creator?.name?.toLowerCase().includes(musicSearch.toLowerCase())
    );
  }, [musicSearch, availableSounds]);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      onAudioUpload(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[700] bg-[#0A0A0A] flex flex-col animate-slide-up">
      <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-[#121212] shrink-0">
        <button onClick={onClose} className="text-[#B0B3B8] font-black uppercase text-[11px] tracking-widest px-4 py-2 rounded-xl hover:bg-white/5 transition-all">Cancel</button>
        <h3 className="font-black text-white uppercase tracking-[6px] text-[12px]">UNERA Sounds</h3>
        <div className="w-20"></div>
      </div>
      
      <div className="p-6 bg-[#121212] shrink-0">
        <div className="relative">
          <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-white/20"></i>
          <input 
            type="text"
            className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 pl-12 text-white outline-none focus:ring-2 focus:ring-[#1877F2]/50 font-medium transition-all text-[17px]"
            placeholder="Search UNERA Sounds..."
            value={musicSearch}
            onChange={(e) => setMusicSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div 
          onClick={() => audioUploadRef.current?.click()}
          className="bg-gradient-to-br from-[#1877F2]/30 to-[#1877F2]/10 border border-[#1877F2]/40 p-8 rounded-[32px] flex items-center gap-6 cursor-pointer hover:from-[#1877F2]/40 transition-all active:scale-95 shadow-2xl"
        >
          <div className="w-16 h-16 bg-[#1877F2] rounded-2xl flex items-center justify-center shadow-2xl">
            <i className="fas fa-plus text-white text-3xl"></i>
          </div>
          <div>
            <p className="font-black text-white text-xl">Upload Custom Sound</p>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">From your device storage</p>
          </div>
          <input 
            type="file" 
            ref={audioUploadRef} 
            className="hidden" 
            accept="audio/*" 
            onChange={handleAudioUpload} 
          />
        </div>

        <div className="h-[1px] bg-white/5 my-6"></div>

        {loadingPopularSounds ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h4 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                <i className="fas fa-fire text-[#F3425F]"></i>
                Trending Sounds
              </h4>
              <div className="space-y-4">
                {popularSounds.slice(0, 5).map(sound => (
                  <SoundItem 
                    key={sound.id} 
                    sound={sound} 
                    onSelect={onSoundSelect}
                    onPreview={onSoundPreview}
                    isSelected={selectedSoundId === sound.id}
                    isPreviewing={previewSound?.id === sound.id && isPreviewPlaying}
                  />
                ))}
              </div>
            </div>

            <div className="h-[1px] bg-white/5 my-6"></div>

            <div>
              <h4 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                <i className="fas fa-music text-[#1877F2]"></i>
                UNERA Music ({loadingSongs ? 'Loading...' : filteredSounds.length})
              </h4>
              {loadingSongs ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredSounds.length > 0 ? (
                <div className="space-y-4">
                  {filteredSounds.map(sound => (
                    <SoundItem 
                      key={sound.id} 
                      sound={sound} 
                      onSelect={onSoundSelect}
                      onPreview={onSoundPreview}
                      isSelected={selectedSoundId === sound.id}
                      isPreviewing={previewSound?.id === sound.id && isPreviewPlaying}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <i className="fas fa-music text-4xl text-[#B0B3B8] mb-4"></i>
                  <p className="text-white/60">No sounds found</p>
                  {musicSearch && <p className="text-white/40 text-sm mt-2">Try a different search term</p>}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ==================== SOUND ITEM COMPONENT ====================
const SoundItem: React.FC<{
  sound: Sound;
  onSelect: (sound: Sound) => void;
  onPreview: (sound: Sound) => void;
  isSelected: boolean;
  isPreviewing?: boolean;
}> = ({ sound, onSelect, onPreview, isSelected, isPreviewing }) => {
  const [isHovering, setIsHovering] = useState(false);
  
  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPreview(sound);
  };

  return (
    <div 
      onClick={() => onSelect(sound)} 
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`bg-white/5 p-5 rounded-[24px] flex items-center gap-5 active:scale-95 transition-all border-2 ${isSelected ? 'border-[#1877F2] bg-[#1877F2]/10' : 'border-transparent hover:border-white/10'} group`}
    >
      <div className="relative w-16 h-16 shrink-0">
        {sound.coverImage || sound.creator?.profile_image_url ? (
          <img 
            src={sound.coverImage || sound.creator?.profile_image_url} 
            className="w-full h-full rounded-2xl object-cover shadow-2xl" 
            alt="" 
          />
        ) : (
          <div className="w-full h-full rounded-2xl bg-gradient-to-br from-[#1877F2] to-[#F3425F] flex items-center justify-center shadow-2xl">
            <i className="fas fa-music text-white text-2xl"></i>
          </div>
        )}
        {(isHovering || isPreviewing) && (
          <button 
            onClick={handlePreview}
            className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl transition-opacity"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <i className={`fas ${isPreviewing ? 'fa-pause' : 'fa-play'} text-white text-lg ml-1`}></i>
            </div>
          </button>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-lg truncate text-white">{sound.name}</p>
        <p className="text-white/40 text-[11px] font-bold truncate tracking-widest uppercase mt-0.5">
          {sound.creator?.name || 'Original Sound'}
        </p>
        <div className="flex items-center gap-3 mt-1">
          {sound.creationCount !== undefined && sound.creationCount > 0 && (
            <span className="text-[#45BD62] text-[10px] font-bold uppercase tracking-widest">
              {formatViewCount(sound.creationCount)} uses
            </span>
          )}
          {sound.playCount !== undefined && sound.playCount > 0 && (
            <span className="text-white/60 text-[10px] font-medium">
              {formatViewCount(sound.playCount)} plays
            </span>
          )}
        </div>
      </div>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-inner ${isSelected ? 'bg-[#1877F2] text-white border-[#1877F2]' : 'bg-white/5 text-[#1877F2] border-white/5'}`}>
        <i className={`fas ${isSelected ? 'fa-check' : 'fa-plus'}`}></i>
      </div>
    </div>
  );
};

// ==================== UPLOAD LOADER ====================
const UploadLoader: React.FC<{ 
  uploadProgress: number; 
  uploadStatus: 'uploading' | 'processing' | 'success' | 'error';
  errorMessage?: string;
}> = ({ uploadProgress, uploadStatus, errorMessage }) => {
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    if (uploadStatus === 'success') {
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
    if (uploadStatus === 'error') {
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadStatus]);
  
  if (!visible) return null;
  
  const getStatusText = () => {
    switch(uploadStatus) {
      case 'uploading': return 'Uploading your reel...';
      case 'processing': return 'Processing video...';
      case 'success': return 'Posted successfully!';
      case 'error': return 'Upload failed';
      default: return 'Uploading...';
    }
  };
  
  const getIcon = () => {
    switch(uploadStatus) {
      case 'uploading': return 'fas fa-cloud-upload-alt animate-pulse';
      case 'processing': return 'fas fa-cog fa-spin';
      case 'success': return 'fas fa-check-circle';
      case 'error': return 'fas fa-exclamation-circle';
      default: return 'fas fa-cloud-upload-alt';
    }
  };
  
  const getColor = () => {
    switch(uploadStatus) {
      case 'uploading': return '#1877F2';
      case 'processing': return '#F7B928';
      case 'success': return '#45BD62';
      case 'error': return '#F3425F';
      default: return '#1877F2';
    }
  };

  const getProgressColor = () => {
    switch(uploadStatus) {
      case 'uploading': return 'from-[#1877F2] to-[#2D8CFF]';
      case 'processing': return 'from-[#F7B928] to-[#FFD166]';
      case 'success': return 'from-[#45BD62] to-[#6BE685]';
      case 'error': return 'from-[#F3425F] to-[#FF6B9D]';
      default: return 'from-[#1877F2] to-[#2D8CFF]';
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-[#1A1A1A] to-[#0A0A0A] rounded-3xl p-8 max-w-sm w-full border border-white/10 shadow-2xl animate-scale-in">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="w-32 h-32 relative">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={getColor()}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${uploadStatus === 'success' ? 283 : (uploadProgress * 2.83)} 283`}
                strokeDashoffset="0"
                className="transition-all duration-500 ease-out"
              />
            </svg>
            
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-20 h-20 rounded-full bg-black/50 flex items-center justify-center ${
                uploadStatus === 'success' ? 'animate-pulse' : ''
              }`} style={{
                boxShadow: `0 0 30px ${getColor()}40`
              }}>
                <i className={`${getIcon()} text-2xl`} style={{ color: getColor() }}></i>
              </div>
            </div>
            
            {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
              <div className="absolute inset-[-8px] rounded-full border-2 border-dashed animate-spin-slow" 
                   style={{ borderColor: `${getColor()}40` }}></div>
            )}
          </div>
          
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-2 animate-fade-in">{getStatusText()}</h3>
            <p className="text-[#B0B3B8] text-sm">
              {uploadStatus === 'uploading' && 'Please wait while we upload your video...'}
              {uploadStatus === 'processing' && 'Applying effects and optimizing quality...'}
              {uploadStatus === 'success' && 'Your reel is now live on UNERA!'}
              {uploadStatus === 'error' && errorMessage || 'Please try again'}
            </p>
            
            {uploadStatus === 'uploading' && (
              <div className="space-y-3 mt-4">
                <p className="text-white font-bold text-lg animate-pulse">{Math.round(uploadProgress)}%</p>
                
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${getProgressColor()} rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-xs text-[#B0B3B8]">
                  <span>Uploading</span>
                  <span>≈ {uploadProgress < 50 ? '30s' : '15s'}</span>
                </div>
              </div>
            )}
            
            {uploadStatus === 'error' && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-gradient-to-r from-[#1877F2] to-[#2D8CFF] text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity active:scale-95"
                >
                  <i className="fas fa-redo mr-2"></i> Try Again
                </button>
              </div>
            )}
            
            {uploadStatus === 'success' && (
              <div className="mt-6 flex items-center justify-center gap-2 text-[#45BD62] animate-bounce">
                <i className="fas fa-check-circle text-xl"></i>
                <span className="font-bold">Ready to view!</span>
              </div>
            )}
          </div>
          
          {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
            <div className="text-xs text-white/50 text-center mt-4 px-4 py-2 bg-white/5 rounded-lg">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              Please don't close this window or navigate away
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes scale-in {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
      `}</style>
    </div>
  );
};

// ==================== PROFESSIONAL BEAUTY FILTERS ====================
const EFFECTS = [
  { id: 'none', name: 'Original', filter: 'none' },
  { id: 'beautify', name: 'Glamour', filter: 'brightness(1.1) contrast(1.05) saturate(1.2)' },
  { id: 'soft', name: 'Soft Glow', filter: 'brightness(1.05) blur(0.4px) contrast(0.95)' },
  { id: 'vintage', name: 'Vintage', filter: 'sepia(0.3) contrast(0.9) brightness(0.9)' },
  { id: 'noir', name: 'Noir', filter: 'grayscale(1) contrast(1.2)' },
];

// ==================== ENHANCED CAMERA STUDIO WITH SOUND SYNC ====================
const CameraStudio: React.FC<{ 
  onCapture: (blob: Blob) => void, 
  onClose: () => void,
  selectedSound?: Sound;
  onSoundSync?: (audioUrl: string, startTime: number) => void;
}> = ({ onCapture, onClose, selectedSound, onSoundSync }) => {
  const { stopAllAudio } = useAudioFocus();
  
  const [isRecording, setIsRecording] = useState(false);
  const [activeEffect, setActiveEffect] = useState(EFFECTS[0]);
  const [amplifierLevel, setAmplifierLevel] = useState(2.0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [soundSyncOffset, setSoundSyncOffset] = useState(0);
  const [soundStartTime, setSoundStartTime] = useState<number>(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const soundRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const soundTimerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopAllAudio();
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
      if (soundTimerRef.current) clearInterval(soundTimerRef.current);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [facingMode]);

  useEffect(() => {
    if (selectedSound?.url && soundRef.current) {
      soundRef.current.src = selectedSound.url;
      soundRef.current.currentTime = selectedSound.start || 0;
      setSoundStartTime(selectedSound.start || 0);
      
      if (isRecording && !isSoundPlaying) {
        playSound();
      }
    }
    
    return () => {
      if (soundRef.current) {
        soundRef.current.pause();
        setIsSoundPlaying(false);
      }
    };
  }, [selectedSound, isRecording]);

  const playSound = () => {
    if (soundRef.current && selectedSound?.url) {
      stopAllAudio();
      const startTime = selectedSound.start || 0;
      soundRef.current.currentTime = startTime;
      soundRef.current.play().catch(() => {});
      setIsSoundPlaying(true);
      setSoundSyncOffset(0);
      
      if (soundTimerRef.current) clearInterval(soundTimerRef.current);
      soundTimerRef.current = setInterval(() => {
        if (soundRef.current) {
          setSoundSyncOffset(soundRef.current.currentTime - startTime);
        }
      }, 100);
    }
  };

  const stopSound = () => {
    if (soundRef.current) {
      soundRef.current.pause();
      setIsSoundPlaying(false);
      if (soundTimerRef.current) clearInterval(soundTimerRef.current);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support video recording.");
      }

      const rawStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: false
        } 
      });
      
      streamRef.current = rawStream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      const source = audioContextRef.current.createMediaStreamSource(rawStream);
      const gainNode = audioContextRef.current.createGain();
      const destination = audioContextRef.current.createMediaStreamDestination();
      
      gainNode.gain.value = amplifierLevel;
      source.connect(gainNode);
      gainNode.connect(destination);

      if (videoRef.current) {
        videoRef.current.srcObject = rawStream;
        videoRef.current.onloadedmetadata = () => {
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            processVideo();
          }
        };
      }

      const canvasStream = (canvasRef.current as any).captureStream(30);
      
      const finalStream = new MediaStream([
        canvasStream.getVideoTracks()[0],
        destination.stream.getAudioTracks()[0]
      ]);
      
      processedStreamRef.current = finalStream;

    } catch (err: any) {
      console.error("Camera access failed", err);
      let msg = "Camera access denied.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('Permission')) {
        msg = "Please allow Camera and Microphone access in your browser settings to record live videos.";
      }
      setCameraError(msg);
    }
  };

  const processVideo = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && videoRef.current && canvasRef.current) {
      ctx.filter = activeEffect.filter;
      if (facingMode === 'user') {
        ctx.save();
        ctx.translate(canvasRef.current.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      if (facingMode === 'user') {
        ctx.restore();
      }
      requestRef.current = requestAnimationFrame(processVideo);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    stopSound();
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      stopSound();
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      const stream = processedStreamRef.current;
      
      if (!stream || !(stream instanceof MediaStream) || !stream.active) {
        alert("Preparing camera... Please try again in a second.");
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : MediaRecorder.isTypeSupported('video/webm') 
          ? 'video/webm' 
          : 'video/mp4';

      try {
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          onCapture(blob);
        };

        recorder.start(100); 
        setIsRecording(true);
        setRecordingTime(0);
        
        if (selectedSound?.url) {
          playSound();
        }
        
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      } catch (err) {
        console.error("Recording start failed", err);
        alert("Recording error. Try refreshing or using a different browser.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black flex flex-col font-sans overflow-hidden animate-fade-in">
      {selectedSound && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-30 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
          <div className="flex items-center gap-2">
            <i className="fas fa-music text-[#1877F2] text-sm"></i>
            <span className="text-white text-xs font-bold truncate max-w-[200px]">
              Using: {selectedSound.name}
            </span>
            {isRecording && isSoundPlaying && (
              <div className="flex items-center gap-1 ml-2">
                {[1, 2, 3].map((i) => (
                  <div 
                    key={i}
                    className="w-1 h-4 bg-[#1877F2] rounded-full animate-equalizer"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            )}
          </div>
          {isRecording && isSoundPlaying && (
            <div className="text-[#1877F2] text-[9px] font-bold mt-1 text-center">
              {soundSyncOffset.toFixed(1)}s
            </div>
          )}
        </div>
      )}
      
      <div className="relative flex-1 bg-[#050505] flex items-center justify-center">
        <canvas ref={canvasRef} className="hidden" />
        
        {cameraError ? (
          <div className="p-8 text-center max-w-sm">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-video-slash text-red-500 text-3xl"></i>
            </div>
            <h3 className="text-white font-black text-xl mb-3 uppercase tracking-tight">Camera Restricted</h3>
            <p className="text-white/60 text-sm mb-10 leading-relaxed">{cameraError}</p>
            <div className="flex flex-col gap-3">
              <button onClick={startCamera} className="bg-[#1877F2] text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all">
                Try Again
              </button>
              <button onClick={onClose} className="bg-white/5 text-white px-8 py-4 rounded-2xl font-black text-sm active:scale-95 transition-all border border-white/10">
                Go Back
              </button>
            </div>
          </div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-full object-cover transition-all duration-300"
            style={{ filter: activeEffect.filter, transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />
        )}
        
        {!cameraError && (
          <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
            <div className="p-6 flex justify-between items-start pointer-events-auto">
              <button onClick={onClose} className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 active:scale-90 transition-transform">
                <i className="fas fa-times text-lg"></i>
              </button>
              {isRecording && (
                <div className="bg-red-600/80 backdrop-blur-md px-4 py-1.5 rounded-full flex items-center gap-2 border border-white/20 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-white"></div>
                  <span className="text-white text-sm font-black tracking-widest">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
                </div>
              )}
              <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 active:scale-90 transition-transform">
                <i className="fas fa-sync-alt text-lg"></i>
              </button>
            </div>

            <div className="mt-auto mb-36 ml-auto p-4 flex flex-col gap-6 pointer-events-auto">
              <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setAmplifierLevel(prev => prev >= 4.0 ? 1.0 : prev + 1.0)}>
                <div className={`w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-md flex items-center justify-center border transition-all ${amplifierLevel > 1.0 ? 'text-[#1877F2] border-[#1877F2] shadow-[0_0_15px_rgba(24,119,242,0.3)]' : 'text-white border-white/10'}`}>
                  <i className="fas fa-microphone-alt text-lg"></i>
                </div>
                <span className="text-[9px] font-black text-white uppercase tracking-widest">{amplifierLevel === 1.0 ? 'Voice' : `${Math.round(amplifierLevel * 100)}%`}</span>
              </div>
              
              {selectedSound && (
                <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => {
                  if (isSoundPlaying) {
                    stopSound();
                  } else {
                    playSound();
                  }
                }}>
                  <div className={`w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-md flex items-center justify-center border transition-all ${isSoundPlaying ? 'text-[#45BD62] border-[#45BD62] shadow-[0_0_15px_rgba(69,189,98,0.3)]' : 'text-white border-white/10'}`}>
                    <i className={`fas ${isSoundPlaying ? 'fa-pause' : 'fa-play'} text-lg`}></i>
                  </div>
                  <span className="text-[9px] font-black text-white uppercase tracking-widest">Sound</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {!cameraError && (
          <>
            <div className="absolute bottom-32 left-0 right-0 z-20 flex gap-4 overflow-x-auto px-6 scrollbar-hide py-2 pointer-events-auto">
              {EFFECTS.map(effect => (
                <button 
                  key={effect.id}
                  onClick={() => setActiveEffect(effect)}
                  className={`flex-shrink-0 flex flex-col items-center gap-2 transition-all ${activeEffect.id === effect.id ? 'scale-110' : 'opacity-40 scale-90'}`}
                >
                  <div className="w-14 h-14 rounded-full border-2 border-white overflow-hidden bg-gray-900 shadow-2xl">
                    <div className="w-full h-full" style={{ background: 'linear-gradient(45deg, #1877F2, #F3425F)', filter: effect.filter }}></div>
                  </div>
                  <span className="text-[10px] font-black text-white uppercase tracking-tighter whitespace-nowrap">{effect.name}</span>
                </button>
              ))}
            </div>

            <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-12 px-8 z-30 pointer-events-auto">
              <button className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center text-white border border-white/10 active:scale-90 transition-transform">
                <i className="fas fa-bolt text-sm"></i>
              </button>
              
              <div 
                onClick={toggleRecording}
                className="w-24 h-24 rounded-full border-4 border-white flex items-center justify-center cursor-pointer active:scale-95 transition-all bg-white/5 backdrop-blur-sm relative"
              >
                {isRecording ? (
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-14 h-14 bg-red-600 rounded-xl animate-pulse opacity-40"></div>
                    <div className="w-10 h-10 rounded-xl bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.8)] border border-white/20"></div>
                  </div>
                ) : (
                  <div className="w-18 h-18 rounded-full bg-red-600 shadow-[0_0_25px_rgba(220,38,38,0.5)] border-2 border-white/30"></div>
                )}
              </div>

              <button className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center text-white border border-white/10 active:scale-90 transition-transform">
                <i className="fas fa-magic text-sm"></i>
              </button>
            </div>
          </>
        )}
      </div>
      <audio ref={soundRef} hidden />
    </div>
  );
};

// ==================== SERVICE WORKER REGISTRATION ====================
export const registerServiceWorker = () => {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    });
  }
};

// ==================== REEL OWNER MENU ====================
const ReelOwnerMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ isOpen, onClose, onEdit, onDelete }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[920] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 max-w-[450px] mx-auto bg-[#121212] rounded-t-[34px] border-t border-white/10 p-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5"></div>

        <button
          onClick={onEdit}
          className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white"
        >
          <div className="w-11 h-11 rounded-full bg-[#1877F2]/15 flex items-center justify-center text-[#1877F2]">
            <i className="fas fa-pen"></i>
          </div>
          <div className="text-left">
            <p className="font-bold text-sm">Edit Reel</p>
            <p className="text-white/50 text-xs">Change caption, location, or visibility</p>
          </div>
        </button>

        <button
          onClick={onDelete}
          className="w-full mt-3 flex items-center gap-4 px-4 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400"
        >
          <div className="w-11 h-11 rounded-full bg-red-500/15 flex items-center justify-center">
            <i className="fas fa-trash-alt"></i>
          </div>
          <div className="text-left">
            <p className="font-bold text-sm">Delete Reel</p>
            <p className="text-red-300/60 text-xs">This cannot be undone</p>
          </div>
        </button>

        <button
          onClick={onClose}
          className="w-full mt-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/80 font-bold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ==================== EDIT REEL MODAL ====================
const EditReelModal: React.FC<{
  reel: Reel | null;
  caption: string;
  location: string;
  visibility: 'public' | 'followers' | 'private';
  saving: boolean;
  setCaption: (v: string) => void;
  setLocation: (v: string) => void;
  setVisibility: (v: 'public' | 'followers' | 'private') => void;
  onClose: () => void;
  onSave: () => void;
}> = ({
  reel,
  caption,
  location,
  visibility,
  saving,
  setCaption,
  setLocation,
  setVisibility,
  onClose,
  onSave,
}) => {
  if (!reel) return null;

  return (
    <div className="fixed inset-0 z-[930] bg-black/70 backdrop-blur-sm flex items-end">
      <div className="w-full max-w-[450px] mx-auto bg-[#121212] rounded-t-[34px] border-t border-white/10 p-6 animate-slide-up">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5"></div>

        <h3 className="text-white font-black text-lg mb-5">Edit Reel</h3>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none text-[17px]"
          placeholder="Update caption..."
        />

        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full mt-4 bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none text-[17px]"
          placeholder="Location"
        />

        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as 'public' | 'followers' | 'private')}
          className="w-full mt-4 bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none text-[17px]"
        >
          <option value="public">🌍 Public</option>
          <option value="followers">👥 Followers</option>
          <option value="private">🔒 Private</option>
        </select>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-4 rounded-2xl bg-[#1877F2] text-white font-bold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== ENHANCED REELS FEED - TIKTOK-STYLE FULLSCREEN ====================
interface ReelsFeedProps {
  reels: Reel[];
  users: User[];
  currentUser: User | null;
  songs: Song[];
  selectedSound: ReelSound | null;
  onPickSound: (s: ReelSound | null) => void;
  onProfileClick: (id: number) => void;
  onCreateReelClick: () => void;
  onReact: (reelId: number, type?: ReactionType) => void;
  onComment: (
    reelId: number,
    payload: {
      text: string;
      parentId?: number | null;
      imageFile?: File | null;
    }
  ) => Promise<void> | void;
  onEditComment: (
    commentId: number,
    payload: {
      text?: string;
      imageFile?: File | null;
      image_url?: string;
    }
  ) => Promise<void> | void;
  onDeleteComment: (commentId: number) => Promise<void> | void;
  onEditReel: (
    reelId: number,
    payload: {
      caption?: string;
      visibility?: string;
      location?: string;
      thumbnail_url?: string;
    }
  ) => Promise<void> | void;
  onDeleteReel: (reelId: number) => Promise<void> | void;
  onShare: (reelId: number, type: 'feed' | 'copy') => void;
  onFollow: (targetUserId: number) => void;
  onUseSound: (sound: any) => void;
  checkIsFollowing: (targetUserId: number) => boolean;
  followLoading: { [key: number]: boolean };
  initialReelId?: number | null;
  onBack?: () => void;
}

export const ReelsFeed: React.FC<ReelsFeedProps> = ({ 
  reels, 
  users, 
  currentUser, 
  songs,
  selectedSound,
  onPickSound,
  onProfileClick, 
  onCreateReelClick, 
  onReact, 
  onComment, 
  onEditComment,
  onDeleteComment,
  onEditReel,
  onDeleteReel,
  onShare, 
  onFollow, 
  onUseSound, 
  checkIsFollowing,
  followLoading = {},
  initialReelId,
  onBack,
}) => {
  // ==================== STATE ====================
  const [activeReelId, setActiveReelId] = useState<number | null>(
    initialReelId || (reels[0]?.id || null)
  );
  const [playingReelId, setPlayingReelId] = useState<number | null>(
    initialReelId || (reels[0]?.id || null)
  ); 
  const [showComments, setShowComments] = useState(false);
  const [selectedSoundData, setSelectedSoundData] = useState<Sound | null>(null);
  const [showReelMenu, setShowReelMenu] = useState(false);
  const [menuReelId, setMenuReelId] = useState<number | null>(null);
  const [editingReel, setEditingReel] = useState<Reel | null>(null);
  const [editingReelCaption, setEditingReelCaption] = useState('');
  const [editingReelLocation, setEditingReelLocation] = useState('');
  const [editingReelVisibility, setEditingReelVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [savingReelEdit, setSavingReelEdit] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
  
  // TikTok loading states
  const [resolvedVideoUrls, setResolvedVideoUrls] = useState<Record<number, string>>({});
  const [resolvedAudioUrls, setResolvedAudioUrls] = useState<Record<number, string>>({});
  
  // State for tracking viewed reels to prevent duplicate view counting
  const viewedReelsRef = useRef<Set<number>>(new Set());
  
  // ==================== REFS ====================
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const activeIdRef = useRef<number | null>(null);
  const userInteractedRef = useRef(false);
  const globalAudioRef = useRef<HTMLAudioElement | null>(null);
  const warmupTimerRef = useRef<any>(null);
  const audioSyncCleanupRef = useRef<(() => void) | null>(null);

  // Memoize active index for performance
  const activeIndex = useMemo(
    () => reels.findIndex(r => r.id === activeReelId),
    [reels, activeReelId]
  );

  // ==================== MEDIA RESOLUTION (NOW TRULY AWAITABLE) ====================
  const resolveReelMedia = useCallback(async (reel: Reel) => {
    const id = reel.id;
    const videoUrl = reel.videoUrl || (reel as any).video_url || '';
    const audioUrl = reel.audioUrl || (reel as any).audio_url || '';

    try {
      // Resolve video URL (videos use native browser cache for memory efficiency)
      if (videoUrl && !resolvedVideoUrls[id]) {
        // For videos, we don't create blob URLs - let browser cache handle it
        setResolvedVideoUrls(prev => prev[id] ? prev : { ...prev, [id]: videoUrl });
      }

      // Resolve audio URL (only audio gets blob URLs for trimming)
      if (audioUrl && !resolvedAudioUrls[id]) {
        const cachedAudio = mediaBlobCache.get(audioUrl);
        if (cachedAudio) {
          setResolvedAudioUrls(prev => ({ ...prev, [id]: cachedAudio.blobUrl }));
        } else {
          // Actually await this for audio
          const blobUrl = await fetchAsBlobUrl(audioUrl, 'audio');
          setResolvedAudioUrls(prev => prev[id] ? prev : { ...prev, [id]: blobUrl });
        }
      }
    } catch (err) {
      console.warn("Failed to resolve reel media", err);
    }
  }, [resolvedVideoUrls, resolvedAudioUrls]);

  // ==================== WARM NEARBY REELS ====================
  // TikTok-style: preload current + next 2 + previous
  const warmReelMedia = useCallback(async (reel: Reel) => {
    try {
      const videoUrl = reel.videoUrl || (reel as any).video_url;
      const audioUrl = reel.audioUrl || (reel as any).audio_url;

      // For videos, just trigger browser preload (no blob conversion)
      if (videoUrl) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'video';
        link.href = videoUrl;
        document.head.appendChild(link);
        setTimeout(() => link.remove(), 5000);
      }
      
      // For audio, we need blob URLs for trimming
      if (audioUrl) {
        await fetchAsBlobUrl(audioUrl, 'audio');
      }
    } catch (err) {
      console.warn("Failed to warm reel media", err);
    }
  }, []);

  // Preload nearby reels when active reel changes
  useEffect(() => {
    if (!activeReelId || reels.length === 0) return;

    const currentIndex = reels.findIndex(r => r.id === activeReelId);
    if (currentIndex === -1) return;

    // Clear any pending warmup
    if (warmupTimerRef.current) {
      clearTimeout(warmupTimerRef.current);
    }

    // Warm nearby reels with slight delay to prioritize current
    warmupTimerRef.current = setTimeout(() => {
      const targets = [
        reels[currentIndex],     // current
        reels[currentIndex + 1], // next
        reels[currentIndex + 2], // next + 1
        reels[currentIndex - 1], // previous
      ].filter(Boolean) as Reel[];

      targets.forEach((reel) => {
        warmReelMedia(reel);
        resolveReelMedia(reel); // Also resolve URLs for rendering
      });
    }, 300);

    return () => {
      if (warmupTimerRef.current) {
        clearTimeout(warmupTimerRef.current);
      }
    };
  }, [activeReelId, reels, warmReelMedia, resolveReelMedia]);

  // Resolve current reel media immediately
  useEffect(() => {
    if (!activeReelId) return;
    const reel = reels.find(r => r.id === activeReelId);
    if (reel) {
      resolveReelMedia(reel);
    }
  }, [activeReelId, reels, resolveReelMedia]);

  // Also resolve next reels
  useEffect(() => {
    if (!activeReelId || activeIndex === -1) return;

    [reels[activeIndex + 1], reels[activeIndex + 2]]
      .filter(Boolean)
      .forEach((r) => resolveReelMedia(r as Reel));
  }, [activeReelId, activeIndex, reels, resolveReelMedia]);

  // ==================== PLAYBACK CONTROL ====================
  useEffect(() => {
    activeIdRef.current = playingReelId;
  }, [playingReelId]);

  // Wait until video is playable
  const waitUntilPlayable = useCallback((video: HTMLVideoElement) => {
    return new Promise<void>((resolve) => {
      if (video.readyState >= 3) { // HAVE_FUTURE_DATA or more
        resolve();
        return;
      }

      const onCanPlay = () => {
        video.removeEventListener('canplay', onCanPlay);
        resolve();
      };

      video.addEventListener('canplay', onCanPlay, { once: true });
      
      // Fallback timeout
      setTimeout(resolve, 2000);
    });
  }, []);

  // ✅ Function to increment view count via API
  const incrementViewCount = useCallback(async (reelId: number) => {
    // Prevent duplicate view counting for the same reel
    if (viewedReelsRef.current.has(reelId)) return;
    
    try {
      // Mark as viewed immediately to prevent multiple calls
      viewedReelsRef.current.add(reelId);
      
      // Call API to increment view count
      const token = localStorage.getItem('unera_token');
      const response = await fetch(`/api/reels/${reelId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      
      const data = await response.json();
      
      if (data.success && data.views_count !== undefined) {
        console.log(`View count updated for reel ${reelId}: ${data.views_count}`);
      }
    } catch (error) {
      console.error('Failed to increment view count:', error);
      // Remove from viewed set so we can try again later
      viewedReelsRef.current.delete(reelId);
    }
  }, []);

  // Start audio for a reel with proper cleanup
  const startAudioForReel = useCallback((id: number) => {
    // Clean up previous audio sync
    if (audioSyncCleanupRef.current) {
      audioSyncCleanupRef.current();
      audioSyncCleanupRef.current = null;
    }

    const reel = reels.find(r => r.id === id);
    const video = videoRefs.current[id];
    const audio = globalAudioRef.current;

    if (!reel || !video || !audio) return;
    if (video.paused) return;
    if (!userInteractedRef.current) return;

    const originalAudioUrl = reel.audioUrl || (reel as any).audio_url;
    const url = resolvedAudioUrls[id] || originalAudioUrl;
    
    if (!url) return;

    if (audio.src !== url) {
      audio.src = url;
    }

    const start = reel.audioStart || (reel as any).audio_start || 0;
    const end = reel.audioEnd || (reel as any).audio_end || Infinity;

    // Sync audio with video position
    const syncAudio = () => {
      if (video.paused || !userInteractedRef.current) return;
      
      const expectedTime = video.currentTime + start;
      
      if (expectedTime >= end) {
        video.currentTime = 0;
        audio.currentTime = start;
      } else if (Math.abs(audio.currentTime - expectedTime) > 0.3) {
        audio.currentTime = expectedTime;
      }

      if (audio.paused) {
        audio.play().catch(() => {});
      }
    };

    video.addEventListener('timeupdate', syncAudio);
    
    // Store cleanup function
    audioSyncCleanupRef.current = () => {
      video.removeEventListener('timeupdate', syncAudio);
    };

    audio.currentTime = start;
    audio.play().catch(() => {});

  }, [reels, resolvedAudioUrls]);

  // Stop audio with cleanup
  const stopAudio = useCallback(() => {
    if (audioSyncCleanupRef.current) {
      audioSyncCleanupRef.current();
      audioSyncCleanupRef.current = null;
    }
    const audio = globalAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  // CLEAN PLAY ONLY CONTROLLER - ONE FUNCTION TO RULE THEM ALL
  const playOnly = useCallback(async (id: number) => {
    // Stop all other videos
    Object.entries(videoRefs.current).forEach(([key, video]) => {
      if (!video) return;
      const rid = Number(key);

      if (rid !== id) {
        video.pause();
        video.currentTime = 0;
        video.muted = true;
      }
    });

    // Stop global audio with cleanup
    stopAudio();

    const reel = reels.find(r => r.id === id);
    const video = videoRefs.current[id];
    if (!video || !reel) return;

    // Ensure media is resolved - NOW TRULY AWAITS
    await resolveReelMedia(reel);

    setActiveReelId(id);
    setPlayingReelId(id);

    // Mute until user interaction
    video.muted = !userInteractedRef.current;

    try {
      await waitUntilPlayable(video);
      await video.play();

      if (userInteractedRef.current) {
        startAudioForReel(id);
      }
      
      // ✅ Increment view count when reel starts playing
      incrementViewCount(id);

    } catch (err) {
      console.warn("Autoplay/play failed", err);
    }
  }, [stopAudio, startAudioForReel, incrementViewCount, reels, resolveReelMedia, waitUntilPlayable]);

  // ✅ Scroll to and play initial reel from feed
  useEffect(() => {
    if (!initialReelId || reels.length === 0) return;
    
    const timer = setTimeout(() => {
      playOnly(initialReelId);
      
      const el = document.querySelector(`[data-reel-id="${initialReelId}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
      
      // Increment view count for initial reel
      incrementViewCount(initialReelId);
    }, 100);

    return () => clearTimeout(timer);
  }, [initialReelId, reels, playOnly, incrementViewCount]);

  // Mark user interaction for audio autoplay - UNLOCK AUDIO ON FIRST TAP
  useEffect(() => {
    const unlock = () => {
      userInteractedRef.current = true;

      const id = activeIdRef.current;
      if (!id) return;

      const video = videoRefs.current[id];
      if (video) {
        video.muted = false;
        if (video.paused) {
          video.play().catch(() => {});
        }
      }

      startAudioForReel(id);
    };

    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });

    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, [startAudioForReel]);

  // Cleanup audio sync on unmount
  useEffect(() => {
    return () => {
      if (audioSyncCleanupRef.current) {
        audioSyncCleanupRef.current();
      }
    };
  }, []);

  // INTERSECTION OBSERVER - ONLY CALLS playOnly()
  useEffect(() => {
    const rootEl = scrollerRef.current;
    if (!rootEl) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        let best: { id: number; ratio: number } | null = null;

        entries.forEach(entry => {
          const id = Number(entry.target.getAttribute("data-reel-id"));
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { id, ratio: entry.intersectionRatio };
          }
        });

        if (best && best.ratio > 0.6) {
          // Avoid repeated calls if already active
          if (activeIdRef.current !== best.id) {
            playOnly(best.id);
          }
        }
      },
      {
        root: rootEl,
        threshold: [0.4, 0.6, 0.8]
      }
    );

    const els = rootEl.querySelectorAll('[data-reel-id]');
    els.forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, [reels, playOnly]);

  const extractSoundFromReel = useCallback((reel: Reel): Sound => {
    const author = users.find((u: User) => Number(u.id) === Number(reel.userId));
    const soundKey = (reel as any).soundKey || (reel as any).sound_key || 'original:none';
    
    const audioUrl = reel.audioUrl || (reel as any).audio_url || '';
    const songName = reel.songName || (reel as any).song_name || 'Original Sound';
    const audioStart = reel.audioStart || (reel as any).audio_start || 0;
    const audioEnd = reel.audioEnd || (reel as any).audio_end || 0;
    const songId = reel.songId || (reel as any).song_id || null;
    
    return {
      id: soundKey,
      name: songName,
      url: audioUrl,
      originalUrl: audioUrl,
      start: audioStart,
      end: audioEnd,
      creator: author,
      creationCount: 0,
      isOriginal: soundKey.startsWith('original:'),
      soundKey: soundKey
    };
  }, [users]);

  const handleSoundClick = useCallback(async (reel: Reel) => {
    const sound = extractSoundFromReel(reel);
    setSelectedSoundData(sound);
  }, [extractSoundFromReel]);

  const handleVideoClick = useCallback((reelId: number) => {
    const video = videoRefs.current[reelId];
    if (!video) return;

    // If tapping current reel -> toggle pause/play
    if (activeIdRef.current === reelId) {
      if (video.paused) {
        video.play().catch(() => {});
        if (userInteractedRef.current) {
          startAudioForReel(reelId);
        }
      } else {
        video.pause();
        stopAudio();
      }
      return;
    }

    // If tapping different reel -> playOnly
    playOnly(reelId);
  }, [playOnly, startAudioForReel, stopAudio]);

  const formatCount = (num: number): string => {
    return formatViewCount(num);
  };

  // Handle reel owner menu
  const openEditReel = useCallback(() => {
    const reel = reels.find(r => Number(r.id) === Number(menuReelId));
    if (!reel) return;

    setEditingReel(reel);
    setEditingReelCaption(reel.caption || '');
    setEditingReelLocation((reel as any).location || '');
    setEditingReelVisibility(((reel as any).visibility || 'public') as 'public' | 'followers' | 'private');
    setShowReelMenu(false);
  }, [reels, menuReelId]);

  const handleSaveReelEdit = useCallback(async () => {
    if (!editingReel) return;

    try {
      setSavingReelEdit(true);

      await Promise.resolve(
        onEditReel(editingReel.id, {
          caption: editingReelCaption,
          location: editingReelLocation,
          visibility: editingReelVisibility,
        })
      );

      setEditingReel(null);
    } catch (e: any) {
      alert(e?.message || 'Failed to update reel');
    } finally {
      setSavingReelEdit(false);
    }
  }, [editingReel, editingReelCaption, editingReelLocation, editingReelVisibility, onEditReel]);

  const handleDeleteOwnedReel = useCallback(async () => {
    if (!menuReelId) return;

    const ok = window.confirm('Delete this reel?');
    if (!ok) return;

    try {
      await Promise.resolve(onDeleteReel(menuReelId));
      setShowReelMenu(false);
      setMenuReelId(null);
    } catch (e: any) {
      alert(e?.message || 'Failed to delete reel');
    }
  }, [menuReelId, onDeleteReel]);

  const handleReaction = (reelId: number, emoji: string) => {
    onReact(reelId, emoji as any);
    setShowReactionPicker(null);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black overflow-hidden font-sans"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Single global audio element */}
      <audio ref={globalAudioRef} hidden playsInline />

      {/* Top bar with back button - floating overlay */}
      <div
        className="absolute top-0 left-0 right-0 z-30 px-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent pointer-events-none"
        style={{ paddingTop: "max(env(safe-area-inset-top), 8px)", height: "64px" }}
      >
        <button
          onClick={onBack || (() => window.history.back())}
          className="w-10 h-10 rounded-full bg-[#242526]/80 border border-white/10 flex items-center justify-center hover:bg-[#3A3B3C] transition-colors pointer-events-auto"
        >
          <i className="fas fa-arrow-left text-white text-sm" />
        </button>

        <div className="text-white font-black text-[12px] tracking-widest uppercase pointer-events-auto">
          Reels
        </div>

        <button
          onClick={() => {
            const reel = reels.find(r => Number(r.id) === Number(activeReelId));
            if (!reel) return;

            const ownerId = Number((reel as any).userId ?? (reel as any).user_id);
            if (ownerId !== Number(currentUser?.id)) return;

            setMenuReelId(reel.id);
            setShowReelMenu(true);
          }}
          className="w-10 h-10 rounded-full bg-[#242526]/80 border border-white/10 flex items-center justify-center pointer-events-auto"
        >
          <i className="fas fa-ellipsis-h text-white text-sm" />
        </button>
      </div>

      {/* TikTok-style fullscreen feed */}
      <div className="w-full h-full">
        <div
          ref={scrollerRef}
          className="reel-video-shell w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide bg-black"
        >
          {reels.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white p-8">
              <div className="w-24 h-24 rounded-full bg-[#1877F2]/10 flex items-center justify-center mb-6">
                <i className="fas fa-video text-3xl text-[#1877F2]"></i>
              </div>
              <h3 className="text-xl font-black mb-2">No Reels Yet</h3>
              <p className="text-[#B0B3B8] text-sm mb-8 text-center">
                Be the first to create a viral moment!
              </p>
            </div>
          ) : (
            reels.map((reel: Reel, reelIndex) => {
              const author = users.find((u: User) => Number(u.id) === Number(reel.userId));
              if (!author) return null;
              
              const isFollowing = checkIsFollowing(Number(author.id));
              const isLoadingFollow = !!followLoading[Number(author.id)];
              
              const hasReacted = reel.reactions?.some(r => 
                Number(r.userId ?? r.user_id) === Number(currentUser?.id)
              );

              const sound = extractSoundFromReel(reel);
              const originalVideoUrl = reel.videoUrl || (reel as any).video_url || '';
              const videoUrl = resolvedVideoUrls[reel.id] || originalVideoUrl;
              
              // Determine if this reel is near the active one for preload strategy
              const isNearActive = Math.abs(reelIndex - activeIndex) <= 1;

              return (
                <div
                  key={reel.id}
                  id={`reel-${reel.id}`}
                  data-reel-id={reel.id}
                  onContextMenu={(e) => e.preventDefault()}
                  className="reel-container w-full h-[100dvh] snap-start relative bg-black overflow-hidden"
                >
                  {/* TikTok-style fullscreen video container with overlay for touch */}
                  <div className="reel-video-shell w-full h-full relative bg-black">
                    {/* Video element - non-interactive */}
                    <video
                      ref={el => { if (el) videoRefs.current[reel.id] = el; }}
                      src={videoUrl}
                      poster={(reel as any).thumbnail_url || (reel as any).thumbnail || ''}
                      preload={isNearActive ? "auto" : "metadata"}
                      playsInline
                      loop
                      controls={false}
                      disablePictureInPicture
                      controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                      style={{
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none'
                      }}
                      muted={playingReelId !== reel.id || !userInteractedRef.current}
                      draggable={false}
                      tabIndex={-1}
                      onContextMenu={(e) => e.preventDefault()}
                    />

                    {/* Touch overlay - handles all user interactions */}
                    <div
                      className="absolute inset-0 z-10"
                      onClick={() => handleVideoClick(reel.id)}
                      onContextMenu={(e) => e.preventDefault()}
                      onTouchStart={(e) => {
                        // Prevent multi-touch gestures
                        if (e.touches.length > 1) {
                          e.preventDefault();
                        }
                      }}
                    />

                    {/* BOTTOM ACTION BAR - React, Discuss, Share at the bottom */}
                    <div className="absolute left-0 right-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-20 pb-6 px-4 pointer-events-none">
                      {/* Profile and caption section - pointer-events-auto for buttons */}
                      <div className="mb-4 pointer-events-auto">
                        <div className="flex items-center gap-3 mb-2">
                          <img 
                            src={author.profile_image_url || author.profileImage} 
                            className="w-10 h-10 rounded-full border-2 border-white/30 object-cover cursor-pointer" 
                            alt="" 
                            onClick={() => onProfileClick(author.id)} 
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span 
                                className="text-white font-bold text-[22px] cursor-pointer hover:underline" 
                                onClick={() => onProfileClick(author.id)}
                              >
                                {author.name}
                              </span>
                              {author.is_verified && (
                                <i className="fas fa-check-circle text-[#1877F2] text-xs"></i>
                              )}
                            </div>
                            
                            {/* Follow button */}
                            {currentUser?.id !== author.id && (
                              <button 
                                onClick={() => onFollow(author.id)} 
                                disabled={isLoadingFollow}
                                className="mt-1 text-xs font-bold text-white bg-white/20 px-3 py-0.5 rounded-full"
                              >
                                {isLoadingFollow ? '...' : (isFollowing ? 'Following' : 'Follow')}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Caption */}
                        {!!reel.caption && (
                          <p className="text-white text-[22px] leading-snug line-clamp-2 mb-2">
                            {reel.caption}
                          </p>
                        )}

                        {/* Sound info */}
                        <div 
                          className="flex items-center gap-2 text-white/90 text-[22px] cursor-pointer w-fit"
                          onClick={() => handleSoundClick(reel)}
                        >
                          <i className="fas fa-music text-[#1877F2]" />
                          <span className="font-semibold truncate max-w-[200px]">
                            {reel.songName || (reel as any).song_name || 'Original Sound'}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons - horizontal layout at bottom */}
                      <div className="flex items-center justify-around py-2 pointer-events-auto">
                        {/* React button with reaction picker */}
                        <div className="relative">
                          <button 
                            onClick={() => setShowReactionPicker(showReactionPicker === reel.id ? null : reel.id)}
                            className="flex items-center gap-2 px-6 py-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 active:scale-95 transition-all"
                          >
                            <i className={`fas fa-smile text-lg ${hasReacted ? "text-[#1877F2]" : "text-white"}`} />
                            <span className="text-white text-sm font-bold">{formatCount(reel.reactions?.length || 0)}</span>
                          </button>

                          {showReactionPicker === reel.id && (
                            <div className="absolute bottom-full left-0 mb-2 bg-[#242526] rounded-2xl p-3 border border-white/10 shadow-2xl z-50">
                              <div className="flex overflow-x-auto gap-2 max-w-[300px] scrollbar-hide pb-1">
                                {REACTION_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleReaction(reel.id, emoji)}
                                    className="text-2xl hover:scale-125 transition-transform flex-shrink-0"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Discuss button */}
                        <button 
                          onClick={() => {
                            setActiveReelId(reel.id);
                            setShowComments(true);
                          }}
                          className="flex items-center gap-2 px-6 py-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 active:scale-95 transition-all"
                        >
                          <i className="fas fa-comment text-lg text-white" />
                          <span className="text-white text-sm font-bold">{formatCount(reel.comments?.length || 0)}</span>
                        </button>

                        {/* Share button */}
                        <button 
                          onClick={() => onShare(reel.id, "feed")}
                          className="flex items-center gap-2 px-6 py-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 active:scale-95 transition-all"
                        >
                          <i className="fas fa-share text-lg text-white" />
                          <span className="text-white text-sm font-bold">{formatCount(reel.shares || 0)}</span>
                        </button>
                      </div>
                    </div>

                    {/* View count overlay */}
                    <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20">
                      <div className="flex items-center gap-2 text-white text-xs font-bold">
                        <i className="fas fa-eye text-[#1877F2]"></i>
                        <span>{formatViewCount(reel.views)}</span>
                      </div>
                    </div>

                    {/* Small play icon overlay when paused */}
                    {playingReelId === reel.id && videoRefs.current[reel.id]?.paused && (
                      <div 
                        className="absolute inset-0 flex items-center justify-center cursor-pointer z-30"
                        onClick={() => handleVideoClick(reel.id)}
                      >
                        <div className="w-16 h-16 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
                          <i className="fas fa-play text-white text-2xl ml-1"></i>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {activeReelId && (
        <ReelCommentsSheet 
          isOpen={showComments} 
          onClose={() => setShowComments(false)} 
          comments={reels.find((r: any) => r.id === activeReelId)?.comments || []} 
          users={users} 
          currentUser={currentUser} 
          onAddComment={(payload) => onComment(activeReelId, payload)}
          onEditComment={onEditComment}
          onDeleteComment={onDeleteComment}
        />
      )}
      
      {/* Sound Detail View Modal */}
      {selectedSoundData && (
        <SoundDetailView
          sound={selectedSoundData}
          onClose={() => setSelectedSoundData(null)}
          onUseSound={(sound) => {
            onUseSound(sound);
            setSelectedSoundData(null);
          }}
          onReelClick={(id) => {
            setSelectedSoundData(null);
            playOnly(id);
          }}
        />
      )}

      {/* Reel Owner Menu */}
      <ReelOwnerMenu
        isOpen={showReelMenu}
        onClose={() => {
          setShowReelMenu(false);
          setMenuReelId(null);
        }}
        onEdit={openEditReel}
        onDelete={handleDeleteOwnedReel}
      />

      {/* Edit Reel Modal */}
      <EditReelModal
        reel={editingReel}
        caption={editingReelCaption}
        location={editingReelLocation}
        visibility={editingReelVisibility}
        saving={savingReelEdit}
        setCaption={setEditingReelCaption}
        setLocation={setEditingReelLocation}
        setVisibility={setEditingReelVisibility}
        onClose={() => setEditingReel(null)}
        onSave={handleSaveReelEdit}
      />
    </div>
  );
};

// ==================== STYLES (DEDUPLICATED) ====================
const styles = `
@keyframes slide-up {
  0% { transform: translateY(100%); }
  100% { transform: translateY(0); }
}
.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}

@keyframes fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

@keyframes scale-in {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.animate-scale-in {
  animation: scale-in 0.3s ease-out;
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin-slow {
  animation: spin-slow 20s linear infinite;
}

@keyframes equalizer {
  0%, 100% { height: 4px; }
  50% { height: 16px; }
}
.animate-equalizer {
  animation: equalizer 0.5s ease-in-out infinite;
}

/* Hide scrollbar */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Reel video shell - prevent long-press menu */
.reel-video-shell,
.reel-video-shell * {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.reel-video-shell video {
  pointer-events: none;
}

/* Prevent context menu on the entire reel container */
.reel-container {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
`;

// Add styles to document with deduplication
if (typeof document !== 'undefined' && !document.getElementById('reels-styles')) {
  const styleSheet = document.createElement("style");
  styleSheet.id = 'reels-styles';
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

// ==================== EXPORTS ====================
// Export utilities and hooks
export {
  trimAudioUrlToWavBlob,
  fetchAsBlobUrl,
  useAudioFocus,
  formatViewCount
};

// Export types
export type { 
  ReelSound, 
  Sound 
};

// Export main component as default
export default ReelsFeed;
