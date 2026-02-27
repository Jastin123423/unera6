// UserProfile.tsx - Updated with Message button for self (opens ChatsList) and for others (opens Chat)

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User, Post as PostType, ReactionType, Reel, AudioTrack } from '../types';
import { CreatePost, Post, CreatePostModal } from './Feed';
import { ChatsList } from './ChatsList'; // ✅ ADDED: Import ChatsList

/**
 * Defensive helpers to prevent blank-screen crashes
 * when backend returns raw D1 rows (missing arrays like reactions/comments).
 */
const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeString = (v: any, fallback = '') => (typeof v === 'string' ? v : fallback);

/**
 * ✅ ADDED: Robust media type detection for Cloudflare R2
 */
const getMediaTypeInfo = (post: any) => {
  const mediaUrl = String(post?.media_url || '');
  const mediaTypeRaw = String(post?.media_type || '').toLowerCase();
  const typeRaw = String(post?.type || '').toLowerCase();

  // Extract file extension from URL (ignoring query params and fragments)
  const cleanUrl = mediaUrl.split('?')[0].split('#')[0];
  const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';

  // Check if it's an image
  const isImage =
    typeRaw === 'image' ||
    mediaTypeRaw === 'image' ||
    mediaTypeRaw.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic'].includes(ext);

  // Check if it's a video
  const isVideo =
    typeRaw === 'video' ||
    mediaTypeRaw === 'video' ||
    mediaTypeRaw.startsWith('video/') ||
    ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'flv', 'wmv', '3gp'].includes(ext);

  // Check if it's audio
  const isAudio =
    typeRaw === 'audio' ||
    mediaTypeRaw.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext);

  return {
    mediaUrl,
    isImage,
    isVideo,
    isAudio,
    extension: ext,
    mimeType: mediaTypeRaw,
  };
};

interface EditProfileModalProps {
  user: User;
  onClose: () => void;
  onSave: (updatedData: Partial<User>) => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, onClose, onSave }) => {
  const [bio, setBio] = useState(safeString((user as any).bio, ''));
  const [work, setWork] = useState(safeString((user as any).work, ''));
  const [education, setEducation] = useState(safeString((user as any).education, ''));
  const [location, setLocation] = useState(safeString((user as any).location, ''));
  const [website, setWebsite] = useState(safeString((user as any).website, ''));

  const handleSave = () => {
    onSave({ bio, work, education, location, website });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-[#242526] w-full max-w-[600px] rounded-xl border border-[#3E4042] shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-[#3E4042] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#E4E6EB]">Edit Profile</h2>
          <div
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] flex items-center justify-center cursor-pointer"
          >
            <i className="fas fa-times text-[#B0B3B8]"></i>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <div>
            <label className="text-[#E4E6EB] font-bold text-sm block mb-1">Bio</label>
            <textarea
              className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-3 text-[#E4E6EB] outline-none focus:border-[#1877F2] text-center"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe yourself..."
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-[#E4E6EB] font-bold text-lg">Details</h3>

            <div>
              <div className="flex items-center gap-2 mb-1 text-[#B0B3B8]">
                <i className="fas fa-briefcase w-5 text-center"></i>
                <span className="text-sm">Work</span>
              </div>
              <input
                type="text"
                className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
                value={work}
                onChange={(e) => setWork(e.target.value)}
                placeholder="Add a workplace"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1 text-[#B0B3B8]">
                <i className="fas fa-graduation-cap w-5 text-center"></i>
                <span className="text-sm">Education</span>
              </div>
              <input
                type="text"
                className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                placeholder="Add a high school or university"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1 text-[#B0B3B8]">
                <i className="fas fa-map-marker-alt w-5 text-center"></i>
                <span className="text-sm">Location</span>
              </div>
              <input
                type="text"
                className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add current city"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1 text-[#B0B3B8]">
                <i className="fas fa-link w-5 text-center"></i>
                <span className="text-sm">Website</span>
              </div>
              <input
                type="text"
                className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Add website link"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#3E4042] bg-[#242526] rounded-b-xl">
          <button
            onClick={handleSave}
            className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white py-2.5 rounded-lg font-bold shadow-md transition-colors active:scale-95 active:shadow-inner"
          >
            Save Details
          </button>
        </div>
      </div>
    </div>
  );
};

interface UserProfileProps {
  user: User;
  currentUser: User | null;
  users: User[];
  posts: PostType[];
  reels?: Reel[];
  onProfileClick: (id: number) => void;

  // FB-logic actions (caller blocks guests)
  onFollow: (id: number) => void;
  onReact: (postId: number, type: ReactionType) => void;
  onComment: (postId: number, text: string) => void;
  onShare: (postId: number) => void;
  onMessage: (id: number) => void; // For messaging other users (opens Chat.tsx)

  onCreatePost: (text: string, file: File | null, type: any, visibility: any) => void;
  onUpdateProfileImage: (file: File) => void;
  onUpdateCoverImage: (file: File) => void;
  onUpdateUserDetails: (data: Partial<User>) => void;
  onDeletePost: (postId: number) => void;
  onEditPost: (postId: number, content: string) => void;

  getCommentAuthor: (id: number) => User | undefined;
  onViewImage: (url: string) => void;
  onCreateEventClick?: () => void;
  onOpenComments: (postId: number) => void;
  onVideoClick: (post: PostType) => void;
  onPlayAudioTrack: (track: AudioTrack) => void;

  onHashtagClick?: (tag: string) => void;
  onVerifyUser?: (id: number) => void;
  onRestrictUser?: (id: number, duration: "24h" | "5d" | "30d" | "manual") => void;
  onDeleteUser?: (id: number) => void;
  onMakeModerator?: (id: number, make: boolean) => void;
  onCreateStoryClick?: () => void;
  
  // ✅ ADDED: New prop for fetching profile posts with viewer context
  fetchProfilePosts?: (profileUserId: number, viewerId: number | null) => Promise<PostType[]>;
  
  // ✅ ADDED: Marketplace product click handler
  onViewProductFromPost?: (productId: number) => void;
  
  // ✅ ADDED: Audio player handler
  onOpenAudio?: (item: any) => void;

  // ✅ ADDED: Chat control props
  onOpenChat?: (recipient: User) => void; // For opening Chat.tsx with specific user
  isChatOpen?: boolean;
  activeChatRecipient?: User | null;

  // ✅ ADDED: ChatsList control props (for profile owner's message inbox)
  onOpenChatsList?: () => void;
  isChatsListOpen?: boolean;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  currentUser,
  users,
  posts,
  reels = [],
  onProfileClick,
  onFollow,
  onReact,
  onComment,
  onShare,
  onMessage,
  onCreatePost,
  onUpdateProfileImage,
  onUpdateCoverImage,
  onUpdateUserDetails,
  onDeletePost,
  onEditPost,
  getCommentAuthor,
  onViewImage,
  onCreateEventClick,
  onOpenComments,
  onVideoClick,
  onPlayAudioTrack,
  onHashtagClick,
  onVerifyUser,
  onRestrictUser,
  onDeleteUser,
  onMakeModerator,
  onCreateStoryClick,
  fetchProfilePosts,
  onViewProductFromPost,
  onOpenAudio,
  // ✅ ADDED: Chat props
  onOpenChat,
  isChatOpen,
  activeChatRecipient,
  // ✅ ADDED: ChatsList props
  onOpenChatsList,
  isChatsListOpen,
}) => {
  const [activeTab, setActiveTab] = useState<'Posts' | 'About' | 'Followers' | 'Photos'>('Posts');
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  // ✅ FIXED: Removed cache on follow buttons as requested
  const [isFollowButtonClicked, setIsFollowButtonClicked] = useState(false);

  // ✅ FIXED: Move isCurrentUser to the TOP
  const isCurrentUser = Boolean(currentUser && Number(user?.id) === Number(currentUser?.id));
  const isSelf = isCurrentUser;

  // ✅ FIXED: Simple and correct follow logic (no caching)
  const isFollowing = useMemo(() => {
    if (!currentUser) return false;
    
    const userFollowers = safeArray<number>((user as any)?.followers || []);
    return userFollowers.includes(currentUser.id);
  }, [currentUser, user]);

  const userFollowers = useMemo(() => safeArray<number>((user as any).followers || []), [user]);
  const followerCount = userFollowers.length;

  // ✅ PROFESSIONALLY FIXED: Check if current user is admin or moderator (with trim)
  const roleOf = (u: any) => String(u?.role || "").trim().toLowerCase();
  const isAdmin = currentUser ? roleOf(currentUser) === "admin" : false;
  const isModerator = currentUser ? roleOf(currentUser) === "moderator" : false;
  const isAdminOrModerator = isAdmin || isModerator;

  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // ✅ ADDED: Helper for safe post ID extraction
  const safePostId = (p: any) => {
    const n = Number(p?.id ?? p?.post_id ?? p?.postId ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  // ✅ ADDED: Local state for profile posts with proper reaction handling
  const [profilePosts, setProfilePosts] = useState<PostType[]>(() => safeArray(posts));

  // ✅ ADDED: Keep in sync when parent provides new posts
  useEffect(() => {
    setProfilePosts(safeArray(posts));
  }, [posts]);

  // ✅ ADDED: Fetch latest profile posts on profile change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      const list = await fetchProfilePostsWithViewer(Number(user.id));
      if (!cancelled && list.length) setProfilePosts(list);
    })();
    return () => { cancelled = true; };
  }, [user?.id, currentUser?.id]);

  // ✅ FIXED: Moved userReels declaration BEFORE it's used in calculations
  const userReels = useMemo(
    () => safeArray<Reel>(reels).filter((reel: any) => Number(reel?.user_id) === Number(user?.id)),
    [reels, user?.id]
  );

  // ✅ Now these calculations can safely use userReels
  const totalViews = useMemo(
    () => profilePosts.reduce((acc, curr: any) => acc + safeNumber(curr?.views, 0), 0),
    [profilePosts]
  );

  const totalLikes = useMemo(() => {
    const postLikes = profilePosts.reduce((acc, curr: any) => {
      const reactionsCount = safeNumber((curr as any)?.reactions_count, 0);
      const reactionsArray = safeArray(curr?.reactions);
      return acc + (reactionsCount > 0 ? reactionsCount : reactionsArray.length);
    }, 0);
    const reelLikes = userReels.reduce((acc, curr: any) => acc + safeArray(curr?.reactions).length, 0);
    return postLikes + reelLikes;
  }, [profilePosts, userReels]);

  const totalShares = useMemo(() => {
    const postShares = profilePosts.reduce((acc, curr: any) => acc + safeNumber(curr?.shares, 0), 0);
    const reelShares = userReels.reduce((acc, curr: any) => acc + safeNumber((curr as any)?.shares, 0), 0);
    return postShares + reelShares;
  }, [profilePosts, userReels]);

  const totalComments = useMemo(() => {
    const postComments = profilePosts.reduce((acc, curr: any) => {
      const commentsCount = safeNumber((curr as any)?.comments_count, 0);
      const commentsArray = safeArray(curr?.comments);
      return acc + (commentsCount > 0 ? commentsCount : commentsArray.length);
    }, 0);
    const reelComments = userReels.reduce((acc, curr: any) => acc + safeArray((curr as any)?.comments).length, 0);
    return postComments + reelComments;
  }, [profilePosts, userReels]);

  const totalEngagement = totalLikes + totalComments + totalShares;

  const safeProfileImage = safeString((user as any)?.profile_image_url, '');
  const safeCoverImage = safeString((user as any)?.cover_image_url, '');
  const safeBio = safeString((user as any)?.bio, '');

  // ✅ ADDED: Image validation handler
  const validateAndUploadImage = (file: File, uploadCallback: (file: File) => void) => {
    if (!file.type || !file.type.startsWith('image/')) {
      setLoginError('Only image files are allowed.');
      setTimeout(() => setLoginError(''), 3000);
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setLoginError('Image size should be less than 10MB.');
      setTimeout(() => setLoginError(''), 3000);
      return;
    }
    
    setLoginError('');
    uploadCallback(file);
  };

  // ✅ FIXED: Follow handler without caching (as requested)
  const handleFollowClick = () => {
    if (!currentUser) return;
    
    setIsFollowButtonClicked(true);
    onFollow(user.id);
    
    setTimeout(() => {
      setIsFollowButtonClicked(false);
    }, 300);
  };

  // ✅ MODIFIED: Message click handler for self (opens ChatsList)
  const handleSelfMessageClick = () => {
    if (!currentUser) return;
    if (onOpenChatsList) {
      onOpenChatsList();
    }
  };

  // ✅ MODIFIED: Message click handler for others (opens Chat.tsx with this user)
  const handleOtherMessageClick = () => {
    if (!currentUser) return;
    if (onOpenChat) {
      onOpenChat(user);
    } else {
      // Fallback to original onMessage if onOpenChat not provided
      onMessage(user.id);
    }
  };

  // ✅ ADDED: Custom API fetch helper for profile posts with viewerId
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const headers: HeadersInit = {
      Accept: 'application/json',
      ...(options.headers || {}),
    };

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (!isFormData) headers['Content-Type'] = (headers['Content-Type'] as string) || 'application/json';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(url, { ...options, headers, signal: controller.signal });

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

  // ✅ MODIFIED: Fetch profile posts with viewerId context
  const fetchProfilePostsWithViewer = async (profileUserId: number): Promise<PostType[]> => {
    try {
      const viewerId = currentUser?.id ?? 0;
      
      // Use the provided custom fetch function if available
      if (fetchProfilePosts) {
        return await fetchProfilePosts(profileUserId, viewerId);
      }
      
      // Fallback to default implementation with viewerId parameter
      const data = await apiFetch(`/api/posts/by-user?userId=${profileUserId}&viewerId=${viewerId}&limit=30`);
      const list = safeArray<any>((data as any)?.posts ?? (data as any)?.results ?? data);
      const normalized = list.map((post: any) => ({
        ...post,
        id: safeNumber(post?.id ?? post?.post_id),
        user_id: safeNumber(post?.user_id),
        content: safeString(post?.content),
        media_url: post?.media_url ?? null,
        media_type: post?.media_type ?? null,
        reactions: safeArray(post?.reactions),
        comments: safeArray(post?.comments),
        shares: safeNumber(post?.shares),
        views: safeNumber(post?.views),
        my_reaction: post?.my_reaction ?? null,
        reactions_count: safeNumber(post?.reactions_count, 0),
        comments_count: safeNumber(post?.comments_count, 0),
        created_at: post?.created_at ?? new Date().toISOString(),
      }));

      // Always latest-first
      normalized.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

      return normalized;
    } catch (error) {
      console.error('Failed to fetch profile posts with viewer context:', error);
      return [];
    }
  };

  // ✅ PROFESSIONALLY MODIFIED: Profile-specific react handler with ONLY optimistic update
  const handleProfileReact = (postId: number, type: ReactionType) => {
    if (!currentUser) return;

    const pid = Number(postId);

    // ✅ Optimistic update: set immediately
    setProfilePosts(prev =>
      prev.map((p: any) => {
        if (safePostId(p) !== pid) return p;

        const current = (p as any).my_reaction ?? null;
        const nextMy = current === type ? null : type;

        const currentCount = Number((p as any).reactions_count ?? 0) || 0;
        const nextCount = current
          ? (nextMy ? currentCount : Math.max(0, currentCount - 1)) // had reaction already
          : (nextMy ? currentCount + 1 : currentCount);            // no reaction before

        // ✅ FIXED: Safe reaction array update without duplicates
        const prevArr = safeArray<any>((p as any).reactions);
        const withoutMe = prevArr.filter((r: any) => Number(r.user_id) !== Number(currentUser.id));
        const nextArr = nextMy ? [...withoutMe, { user_id: currentUser.id, type: nextMy }] : withoutMe;

        return { 
          ...p, 
          my_reaction: nextMy, 
          reactions_count: nextCount,
          reactions: nextArr
        };
      })
    );

    // ✅ ONE backend call only (App.tsx)
    onReact(pid, type);
  };

  // ✅ ADDED: Filter out Group posts from profile posts (Facebook-like behavior)
  const filteredProfilePosts = useMemo(() => {
    return (profilePosts || []).filter((p: any) => {
      const meta = p?.meta || {};
      const hasGroup =
        !!p?.group_id ||
        !!p?.groupId ||
        !!meta?.group_id ||
        !!meta?.groupId ||
        p?.type === 'group_post' ||
        p?.post_type === 'group_post' ||
        meta?.type === 'group_post';
      return !hasGroup; // ✅ hide group posts from profile
    });
  }, [profilePosts]);

  const renderContent = () => {
    switch (activeTab) {
      case 'About':
        return (
          <div className="bg-[#242526] p-6 text-[#E4E6EB] rounded-xl border border-[#3E4042] mx-4 md:mx-0">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">About</h2>
              {isCurrentUser && (
                <button
                  onClick={() => setShowEditProfile(true)}
                  className="text-[#1877F2] font-semibold hover:underline"
                >
                  Edit
                </button>
              )}
            </div>

            <p className="text-[#B0B3B8] text-lg italic mb-6">
              "{safeString((user as any).bio, 'No bio available')}"
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <h3 className="text-xl font-bold">Work & Education</h3>
                <div className="flex items-center gap-3">
                  <i className="fas fa-briefcase text-[#B0B3B8] w-6 text-center"></i>
                  <span>
                    {(user as any).work ? `Works at ${(user as any).work}` : 'No workplace to show'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <i className="fas fa-graduation-cap text-[#B0B3B8] w-6 text-center"></i>
                  <span>
                    {(user as any).education
                      ? `Studied at ${(user as any).education}`
                      : 'No schools to show'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h3 className="text-xl font-bold">Contact & Basic Info</h3>
                <div className="flex items-center gap-3">
                  <i className="fas fa-map-marker-alt text-[#B0B3B8] w-6 text-center"></i>
                  <span>{(user as any).location || 'No location to show'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <i className="fas fa-link text-[#B0B3B8] w-6 text-center"></i>
                  <span>
                    {(user as any).website ? (
                      <a
                        href={(user as any).website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#1877F2] hover:underline"
                      >
                        {(user as any).website}
                      </a>
                    ) : (
                      'No website'
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <i className="fas fa-birthday-cake text-[#B0B3B8] w-6 text-center"></i>
                  <span>{(user as any).birth_date || 'No birth date'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <i className="fas fa-venus-mars text-[#B0B3B8] w-6 text-center"></i>
                  <span>{(user as any).gender || 'Not specified'}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'Followers':
        return (
          <div className="bg-[#242526] p-4 rounded-xl border border-[#3E4042] mx-4 md:mx-0">
            <h2 className="text-xl font-bold text-[#E4E6EB] mb-4">Followers</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {users
                .filter((u) => userFollowers.includes(u.id))
                .map((follower) => (
                  <div
                    key={follower.id}
                    className="flex items-start gap-3 p-3 border border-[#3E4042] rounded-lg hover:bg-[#3A3B3C] cursor-pointer transition-all duration-200 active:scale-95"
                    onClick={() => onProfileClick(follower.id)}
                  >
                    <img
                      src={safeString((follower as any).profile_image_url, '')}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div>
                      <h4 className="font-semibold text-[#E4E6EB]">{(follower as any).name}</h4>
                      <span className="text-[#B0B3B8] text-sm">{(follower as any).location}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        );

      case 'Photos':
        return (
          <div className="bg-[#242526] p-4 rounded-xl border border-[#3E4042] mx-4 md:mx-0">
            <h2 className="text-xl font-bold text-[#E4E6EB] mb-4">Photos</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1">
              {filteredProfilePosts
                .filter((p: any) => {
                  const mediaInfo = getMediaTypeInfo(p);
                  return mediaInfo.isImage && mediaInfo.mediaUrl && mediaInfo.mediaUrl.trim() !== '';
                })
                .map((p: any) => {
                  const mediaInfo = getMediaTypeInfo(p);
                  return (
                    <div
                      key={p.id}
                      className="aspect-square cursor-pointer overflow-hidden relative group"
                      onClick={() => mediaInfo.mediaUrl && onViewImage(mediaInfo.mediaUrl)}
                    >
                      <img
                        src={mediaInfo.mediaUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          console.error('Failed to load photo in UserProfile:', mediaInfo.mediaUrl);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  );
                })}
            </div>
            {filteredProfilePosts.filter((p: any) => {
              const mediaInfo = getMediaTypeInfo(p);
              return mediaInfo.isImage && mediaInfo.mediaUrl && mediaInfo.mediaUrl.trim() !== '';
            }).length === 0 && (
              <div className="text-center py-8">
                <i className="fas fa-images text-[#B0B3B8] text-4xl mb-4"></i>
                <p className="text-[#B0B3B8]">No photos available</p>
              </div>
            )}
          </div>
        );

      case 'Posts':
      default:
        return (
          <div className="max-w-[1095px] mx-auto w-full flex flex-col md:flex-row gap-4 px-0 md:px-4 mt-4">
            <div className="w-full md:w-[380px] flex-shrink-0 flex flex-col gap-4 px-4 md:px-0">
              {/* ✅ FIXED: Intro Section */}
              <div className="bg-[#242526] rounded-xl p-4 shadow-sm border border-[#3E4042]">
                <h2 className="text-xl font-bold text-[#E4E6EB] mb-4">Intro</h2>
                <div className="flex flex-col gap-3 text-[#E4E6EB]">
                  <div className="text-center mb-2">
                    <p className="text-[15px]">{safeBio || 'No bio available'}</p>
                  </div>
                  <div className="h-[1px] bg-[#3E4042] w-full my-1"></div>

                  {(user as any).work && (
                    <div className="flex items-center gap-3">
                      <i className="fas fa-briefcase text-[#B0B3B8] w-5 text-center"></i>
                      <span>{(user as any).work}</span>
                    </div>
                  )}
                  {(user as any).location && (
                    <div className="flex items-center gap-3">
                      <i className="fas fa-map-marker-alt text-[#B0B3B8] w-5 text-center"></i>
                      <span>{(user as any).location}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <i className="fas fa-rss text-[#B0B3B8] w-5 text-center"></i>
                    <span>{followerCount} Followers</span>
                  </div>

                  {/* ✅ ADDED: Role display for admin users */}
                  {isAdmin && (
                    <div className="flex items-center gap-3">
                      <i className="fas fa-shield-alt text-[#B0B3B8] w-5 text-center"></i>
                      <span className="capitalize">Role: {user.role || 'user'}</span>
                    </div>
                  )}

                  {isCurrentUser && (
                    <button
                      className="w-full bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] font-semibold py-2 rounded-md transition-colors text-[15px] mt-2 active:scale-95 active:shadow-inner"
                      onClick={() => setShowEditProfile(true)}
                    >
                      Edit Details
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {/* ✅ ADDED: Error display for image validation */}
              {loginError && (
                <div className="mb-4 p-3 bg-red-900/80 border border-red-700 rounded-lg text-red-200 text-sm">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-exclamation-circle"></i>
                    <span>{loginError}</span>
                  </div>
                </div>
              )}

              {isCurrentUser && (
                <div className="bg-[#242526] rounded-xl p-4 mb-4 border border-[#3E4042] shadow-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#3A3B3C] p-3 rounded-lg border border-[#3E4042]">
                      <div className="text-[#B0B3B8] text-xs font-medium mb-1">Total Views</div>
                      <div className="text-[#E4E6EB] font-bold text-xl">
                        {safeNumber(totalViews).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-[#3A3B3C] p-3 rounded-lg border border-[#3E4042]">
                      <div className="text-[#B0B3B8] text-xs font-medium mb-1">Engagement</div>
                      <div className="text-[#E4E6EB] font-bold text-xl">
                        {safeNumber(totalEngagement).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isCurrentUser && currentUser && (
                <>
                  <CreatePost
                    currentUser={currentUser}
                    onProfileClick={onProfileClick}
                    onClick={() => setShowCreatePostModal(true)}
                  />
                  {showCreatePostModal && (
                    <CreatePostModal
                      currentUser={currentUser}
                      onClose={() => setShowCreatePostModal(false)}
                      onCreatePost={onCreatePost}
                      users={users}
                    />
                  )}
                </>
              )}

              {/* ✅ MODIFIED: Use filteredProfilePosts (hides group posts) */}
              {filteredProfilePosts.map((post: any) => (
                <Post
                  key={post.id}
                  post={post}
                  author={user}
                  currentUser={currentUser}
                  onProfileClick={onProfileClick}
                  onReact={handleProfileReact}
                  onShare={onShare}
                  onDelete={onDeletePost}
                  onEdit={onEditPost}
                  onViewImage={onViewImage}
                  onOpenComments={onOpenComments}
                  onVideoClick={onVideoClick}
                  onPlayAudioTrack={onPlayAudioTrack}
                  // ✅ ADDED: Marketplace support
                  onViewProductFromPost={onViewProductFromPost}
                  // ✅ ADDED: Audio player support
                  onOpenAudio={onOpenAudio}
                />
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full bg-[#18191A] min-h-screen">
      <input
        type="file"
        ref={profileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            validateAndUploadImage(file, onUpdateProfileImage);
          }
          if (e.target) e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={coverInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            validateAndUploadImage(file, onUpdateCoverImage);
          }
          if (e.target) e.target.value = '';
        }}
      />

      <div className="bg-[#242526] shadow-sm">
        <div className="max-w-[1095px] mx-auto w-full relative">
          <div className="h-[200px] md:h-[350px] w-full bg-gray-700 relative overflow-hidden md:rounded-b-xl">
            {safeCoverImage ? (
              <img
                src={safeCoverImage}
                alt="Cover"
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => onViewImage(safeCoverImage)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">No Cover</div>
            )}

            {isCurrentUser && (
              <>
                <div
                  className="absolute bottom-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-md cursor-pointer hover:bg-white/20 font-semibold text-white text-[15px] flex items-center gap-2 transition-all active:scale-95 active:shadow-inner"
                  onClick={() => coverInputRef.current?.click()}
                >
                  <i className="fas fa-camera"></i> Edit cover photo
                </div>
                
                {!safeCoverImage && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer hover:bg-black/50 active:scale-95 transition-transform"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    <div className="text-center">
                      <i className="fas fa-camera text-white text-3xl mb-2"></i>
                      <p className="text-white font-semibold">Add Cover Photo</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="px-4 pb-0">
            <div className="flex flex-col md:flex-row items-center md:items-end -mt-[84px] md:-mt-[30px] relative z-10 mb-4">
              <div className="w-[168px] h-[168px] rounded-full border-[6px] border-[#242526] bg-[#242526] overflow-hidden cursor-pointer relative group">
                {safeProfileImage ? (
                  <img
                    src={safeProfileImage}
                    alt={safeString((user as any).name, 'User')}
                    className="w-full h-full object-cover"
                    onClick={() => onViewImage(safeProfileImage)}
                  />
                ) : (
                  <div className="w-full h-full bg-[#3A3B3C] flex items-center justify-center text-[#B0B3B8]">
                    No Photo
                  </div>
                )}

                {isCurrentUser && (
                  <>
                    <div
                      className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center transition-all active:scale-95"
                      onClick={() => profileInputRef.current?.click()}
                    >
                      <i className="fas fa-camera text-white text-3xl"></i>
                    </div>
                    
                    {!safeProfileImage && (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-black/60 cursor-pointer active:scale-95 transition-transform"
                        onClick={() => profileInputRef.current?.click()}
                      >
                        <div className="text-center">
                          <i className="fas fa-camera text-white text-3xl mb-2"></i>
                          <p className="text-white font-semibold text-sm">Add Profile Photo</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex-1 flex flex-col items-center md:items-start mt-4 md:mt-0 md:ml-6 text-center md:text-left md:mb-4">
                <h1 className="text-[32px] font-bold text-[#E4E6EB] flex items-center gap-2">
                  {safeString((user as any).name, 'User')}
                  {(user as any).is_verified && (
                    <i className="fas fa-check-circle text-[#1877F2] text-[20px]"></i>
                  )}
                  {/* ✅ FIXED: Show role badge based on the profile user's role */}
                  {(user.role === 'admin' || user.role === 'moderator') && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      user.role === 'admin' 
                        ? 'bg-red-900/80 text-red-200' 
                        : 'bg-purple-900/80 text-purple-200'
                    }`}>
                      {user.role}
                    </span>
                  )}
                </h1>
                <span className="text-[#B0B3B8] font-semibold text-[17px] mt-1">
                  {followerCount} Followers
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 mt-4 md:mt-0 md:mb-6">
                {isCurrentUser ? (
                  // ✅ PROFILE OWNER - Show "Add to story" and "Messages" (inbox) buttons
                  <>
                    <button
                      className="bg-[#1877F2] text-white px-4 py-2 rounded-md font-semibold flex items-center gap-2 hover:bg-[#166FE5] transition-colors active:scale-95 active:shadow-inner"
                      onClick={() => {
                        if (onCreateStoryClick) {
                          onCreateStoryClick();
                        } else {
                          setShowCreatePostModal(true);
                        }
                      }}
                    >
                      <i className="fas fa-plus"></i>
                      <span>Add to story</span>
                    </button>
                    
                    {/* ✅ ADDED: Message button for self (opens ChatsList inbox) */}
                    <button
                      onClick={handleSelfMessageClick}
                      className={`bg-[#3A3B3C] text-[#E4E6EB] px-6 py-2 rounded-md font-semibold hover:bg-[#4E4F50] transition-colors active:scale-95 active:shadow-inner ${
                        isChatsListOpen ? 'ring-2 ring-[#1877F2]' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <i className="fas fa-comment"></i>
                        {isChatsListOpen ? 'Chats Open' : 'Messages'}
                      </span>
                    </button>
                  </>
                ) : (
                  // ✅ OTHER USER - Show "Follow" and "Message" (direct chat) buttons
                  <>
                    <button
                      onClick={handleFollowClick}
                      className={`${
                        isFollowing ? 'bg-[#3A3B3C] text-[#E4E6EB]' : 'bg-[#1877F2] text-white'
                      } px-6 py-2 rounded-md font-semibold transition-all duration-200 ${
                        isFollowButtonClicked ? 'scale-95 shadow-inner' : 'hover:scale-105'
                      } ${isFollowing ? 'hover:bg-[#4E4F50]' : 'hover:bg-[#166FE5]'}`}
                      disabled={isFollowButtonClicked}
                    >
                      {isFollowing ? (
                        <span className="flex items-center gap-2">
                          <i className="fas fa-check"></i>
                          Following
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <i className="fas fa-user-plus"></i>
                          Follow
                        </span>
                      )}
                    </button>
                    
                    {/* ✅ MODIFIED: Message button for other users (opens Chat.tsx) */}
                    <button
                      onClick={handleOtherMessageClick}
                      className={`bg-[#3A3B3C] text-[#E4E6EB] px-6 py-2 rounded-md font-semibold hover:bg-[#4E4F50] transition-colors active:scale-95 active:shadow-inner ${
                        isChatOpen && activeChatRecipient?.id === user.id ? 'ring-2 ring-[#1877F2]' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <i className="fas fa-comment"></i>
                        {isChatOpen && activeChatRecipient?.id === user.id ? 'Chat Open' : 'Message'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="h-[1px] bg-[#3E4042] w-full mt-4"></div>

            <div className="flex items-center gap-1 pt-1 overflow-x-auto">
              {(['Posts', 'About', 'Followers', 'Photos'] as const).map((tab) => (
                <div
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 cursor-pointer whitespace-nowrap text-[15px] font-semibold border-b-[3px] transition-colors active:scale-95 ${
                    activeTab === tab
                      ? 'text-[#1877F2] border-[#1877F2]'
                      : 'text-[#B0B3B8] border-transparent hover:bg-[#3A3B3C] rounded-t-md'
                  }`}
                >
                  {tab}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ PROFESSIONALLY FIXED: ADMIN CONTROLS - Shows on all tabs, properly positioned */}
      {isAdminOrModerator && (
        <div className="max-w-[1095px] mx-auto mt-6 px-4">
          <div className="bg-[#242526] rounded-xl p-4 shadow-sm border border-red-900/50">
            <h2 className="text-xl font-bold text-red-500 mb-4">
              {isAdmin ? 'Admin Controls' : 'Moderator Controls'}
            </h2>
            <div className="flex flex-col gap-2">
              {/* ✅ Verify button (Admin only) */}
              {isAdmin && (
                <button
                  disabled={isSelf}
                  onClick={() => !isSelf && onVerifyUser?.(user.id)}
                  className={`w-full py-2 rounded font-semibold transition-colors active:scale-95 active:shadow-inner ${
                    isSelf
                      ? "bg-[#263951]/40 text-[#2D88FF]/40 cursor-not-allowed"
                      : "bg-[#263951] text-[#2D88FF] hover:bg-[#2A3F5A]"
                  }`}
                >
                  {(user as any).is_verified ? 'Remove Verification' : 'Verify User'} {isSelf ? "(Self)" : ""}
                </button>
              )}
              
              {/* ✅ Suspend buttons grid (Admin and Moderator) */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={isSelf}
                  onClick={() => !isSelf && onRestrictUser?.(user.id, "24h")}
                  className={`py-2 rounded font-semibold transition-colors active:scale-95 active:shadow-inner ${
                    isSelf
                      ? "bg-yellow-900/40 text-yellow-200/40 cursor-not-allowed"
                      : "bg-yellow-900/80 text-yellow-200 hover:bg-yellow-800"
                  }`}
                >
                  Suspend 24h {isSelf ? "(Self)" : ""}
                </button>
                <button
                  disabled={isSelf}
                  onClick={() => !isSelf && onRestrictUser?.(user.id, "5d")}
                  className={`py-2 rounded font-semibold transition-colors active:scale-95 active:shadow-inner ${
                    isSelf
                      ? "bg-yellow-900/40 text-yellow-200/40 cursor-not-allowed"
                      : "bg-yellow-900/80 text-yellow-200 hover:bg-yellow-800"
                  }`}
                >
                  Suspend 5d {isSelf ? "(Self)" : ""}
                </button>
                <button
                  disabled={isSelf}
                  onClick={() => !isSelf && onRestrictUser?.(user.id, "30d")}
                  className={`py-2 rounded font-semibold transition-colors active:scale-95 active:shadow-inner ${
                    isSelf
                      ? "bg-yellow-900/40 text-yellow-200/40 cursor-not-allowed"
                      : "bg-yellow-900/80 text-yellow-200 hover:bg-yellow-800"
                  }`}
                >
                  Suspend 30d {isSelf ? "(Self)" : ""}
                </button>
                <button
                  disabled={isSelf}
                  onClick={() => !isSelf && onRestrictUser?.(user.id, "manual")}
                  className={`py-2 rounded font-semibold transition-colors active:scale-95 active:shadow-inner ${
                    isSelf
                      ? "bg-yellow-900/40 text-yellow-200/40 cursor-not-allowed"
                      : "bg-yellow-900/80 text-yellow-200 hover:bg-yellow-800"
                  }`}
                >
                  Suspend Manual {isSelf ? "(Self)" : ""}
                </button>
              </div>

              {/* ✅ Moderator role buttons (Admin only) */}
              {isAdmin && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    disabled={isSelf}
                    onClick={() => !isSelf && onMakeModerator?.(user.id, true)}
                    className={`py-2 rounded font-semibold transition-colors active:scale-95 active:shadow-inner ${
                      isSelf
                        ? "bg-[#3A3B3C]/40 text-[#E4E6EB]/40 cursor-not-allowed"
                        : "bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]"
                    }`}
                  >
                    Make Moderator {isSelf ? "(Self)" : ""}
                  </button>
                  <button
                    disabled={isSelf}
                    onClick={() => !isSelf && onMakeModerator?.(user.id, false)}
                    className={`py-2 rounded font-semibold transition-colors active:scale-95 active:shadow-inner ${
                      isSelf
                        ? "bg-[#3A3B3C]/40 text-[#E4E6EB]/40 cursor-not-allowed"
                        : "bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]"
                    }`}
                  >
                    Remove Moderator {isSelf ? "(Self)" : ""}
                  </button>
                </div>
              )}

              {/* ✅ Delete button (Admin only) */}
              {isAdmin && (
                <button
                  disabled={isSelf}
                  onClick={() => !isSelf && onDeleteUser?.(user.id)}
                  className={`w-full py-2 rounded font-semibold mt-2 transition-colors active:scale-95 active:shadow-inner ${
                    isSelf
                      ? "bg-red-900/40 text-white/40 cursor-not-allowed"
                      : "bg-red-900/80 text-white hover:bg-red-800"
                  }`}
                >
                  Delete Account {isSelf ? "(Cannot delete self)" : ""}
                </button>
              )}
              
              {/* ✅ Role info display */}
              <div className="mt-2 pt-2 border-t border-[#3E4042]">
                <p className="text-[#B0B3B8] text-xs">
                  Viewing as: <span className="font-semibold text-[#E4E6EB]">{isAdmin ? "Admin" : "Moderator"}</span>
                </p>
                <p className="text-[#B0B3B8] text-xs mt-1">
                  Profile Role: <span className="font-semibold text-[#E4E6EB] capitalize">{user.role || 'user'}</span>
                </p>
                {isSelf && (
                  <p className="text-yellow-300 text-xs mt-1">
                    ⚠️ Some actions disabled for your own account
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {renderContent()}

      {showEditProfile && isCurrentUser && (
        <EditProfileModal user={user} onClose={() => setShowEditProfile(false)} onSave={onUpdateUserDetails} />
      )}
    </div>
  );
};
