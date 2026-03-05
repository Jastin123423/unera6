// UserProfile.tsx - Complete updated file with refetch approach
import React, { useEffect, useState, useRef, useMemo, useContext, useCallback } from 'react';
import { User, Post as PostType, ReactionType, Reel, AudioTrack, Product, Group, Brand } from '../types';
import { ChatsList } from './ChatsList';
import { MarketplaceContext } from '../App';

// Import from Feed.tsx
import {
  EventPost,
  PeopleYouMayKnowGrid,
  SuggestedProductsWidget,
  ShareBottomSheet,
  CommentsSheet,
  ReactionsSheet,
  GalleryViewer,
  CreatePost,
  CreatePostModal,
  avatarFrom,
  formatRelativeTime,
  getMediaTypeInfo,
  safeArray,
  safeNumber,
  safeString,
  safePostId,
  safeUserId,
  safeParseJsonArray,
  getMarketplaceProductId,
  getMarketplaceImages,
  getMarketplacePriceLine,
  normalizeEventFromFeed,
  Post
} from './Feed';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const safeArrayHelper = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumberHelper = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeStringHelper = (v: any, fallback = '') => (typeof v === 'string' ? v : fallback);
const safePostIdHelper = (p: any) => safeNumberHelper(p?.id ?? p?.post_id ?? p?.postId, 0);
const safeUserIdHelper = (u: any) => safeNumberHelper(u?.id ?? u?.user_id ?? u?.userId, 0);

interface EditProfileModalProps {
  user: User;
  onClose: () => void;
  onSave: (updatedData: Partial<User>) => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, onClose, onSave }) => {
  const [bio, setBio] = useState(safeStringHelper((user as any).bio, ''));
  const [work, setWork] = useState(safeStringHelper((user as any).work, ''));
  const [education, setEducation] = useState(safeStringHelper((user as any).education, ''));
  const [location, setLocation] = useState(safeStringHelper((user as any).location, ''));
  const [website, setWebsite] = useState(safeStringHelper((user as any).website, ''));

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
  products?: Product[];
  groups?: Group[];
  brands?: Brand[];
  onProfileClick: (id: number) => void;

  // FB-logic actions (caller blocks guests)
  onFollow: (id: number) => void;
  onReact: (postId: number, type: ReactionType) => void;
  onComment: (postId: number, text: string) => void;
  onShare: (postId: number, newShareCount: number) => void;
  onMessage: (id: number) => void;

  onCreatePost: (text: string, files: File[], meta?: any) => void;
  onUpdateProfileImage: (file: File) => void;
  onUpdateCoverImage: (file: File) => void;
  onUpdateUserDetails: (data: Partial<User>) => void;
  onDeletePost: (postId: number) => void;
  onEditPost: (postId: number, content: string) => void;

  getCommentAuthor?: (id: number) => User | undefined;
  onViewImage: (url: string) => void;
  onCreateEventClick?: () => void;
  onOpenComments: (postId: number) => void;
  onVideoClick: (post: PostType) => void;
  onPlayAudioTrack?: (track: AudioTrack) => void;

  onHashtagClick?: (tag: string) => void;
  onVerifyUser?: (id: number) => void;
  onRestrictUser?: (id: number, duration: "24h" | "5d" | "30d" | "manual") => void;
  onDeleteUser?: (id: number) => void;
  onMakeModerator?: (id: number, make: boolean) => void;
  onCreateStoryClick?: () => void;
  
  fetchProfilePosts?: (profileUserId: number, viewerId: number | null) => Promise<PostType[]>;
  
  // Marketplace handlers
  onViewProduct?: (productId: number) => void;
  onViewProductFromPost?: (productId: number) => void;
  getProductData?: (productId: number) => any;
  
  // Audio player handler
  onOpenAudio?: (item: any) => void;

  // RSVP handler for events
  onRSVP?: (eventId: number, status: 'going' | 'interested' | 'not_going') => Promise<void>;

  // Chat control props
  onOpenChat?: (recipient: User) => void;
  isChatOpen?: boolean;
  activeChatRecipient?: User | null;

  // ChatsList control props
  onOpenChatsList?: () => void;
  isChatsListOpen?: boolean;

  // People suggestions
  peopleSuggestions?: any[];
}

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  currentUser,
  users,
  posts,
  reels = [],
  products = [],
  groups = [],
  brands = [],
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
  onViewProduct,
  onViewProductFromPost,
  getProductData,
  onOpenAudio,
  onRSVP,
  onOpenChat,
  isChatOpen,
  activeChatRecipient,
  onOpenChatsList,
  isChatsListOpen,
  peopleSuggestions = [],
}) => {
  // Get MarketplaceContext
  const marketplaceContext = useContext(MarketplaceContext);
  
  const [activeTab, setActiveTab] = useState<'Posts' | 'About' | 'Followers' | 'Photos'>('Posts');
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  
  const [isFollowButtonClicked, setIsFollowButtonClicked] = useState(false);

  // ========== MODAL STATES ==========
  const [showCommentsSheet, setShowCommentsSheet] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<any>(null);
  
  const [showReactionsSheet, setShowReactionsSheet] = useState(false);
  const [selectedPostForReactions, setSelectedPostForReactions] = useState<number | null>(null);
  
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [selectedPostForShare, setSelectedPostForShare] = useState<any>(null);
  
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const isCurrentUser = Boolean(currentUser && Number(user?.id) === Number(currentUser?.id));
  const isSelf = isCurrentUser;

  // Follow logic
  const isFollowing = useMemo(() => {
    if (!currentUser) return false;
    const userFollowers = safeArrayHelper<number>((user as any)?.followers || []);
    return userFollowers.includes(currentUser.id);
  }, [currentUser, user]);

  const userFollowers = useMemo(() => safeArrayHelper<number>((user as any).followers || []), [user]);
  const followerCount = userFollowers.length;

  // Role checks
  const roleOf = (u: any) => String(u?.role || "").trim().toLowerCase();
  const isAdmin = currentUser ? roleOf(currentUser) === "admin" : false;
  const isModerator = currentUser ? roleOf(currentUser) === "moderator" : false;
  const isAdminOrModerator = isAdmin || isModerator;

  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Local state for profile posts
  const [profilePosts, setProfilePosts] = useState<PostType[]>(() => safeArrayHelper(posts));

  // Keep in sync when parent provides new posts
  useEffect(() => {
    setProfilePosts(safeArrayHelper(posts));
  }, [posts]);

  // ========== API FETCH HELPER ==========
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('unera_token');
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, { 
        ...options, 
        headers,
        signal: controller.signal 
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;

      try {
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
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

  // ========== FETCH SINGLE POST FROM BACKEND ==========
  const fetchPostById = useCallback(async (postId: number): Promise<any | null> => {
    if (!postId) return null;
    
    try {
      const viewerId = currentUser?.id ?? 0;
      const url = `/api/posts/${postId}?viewerId=${viewerId}`;
      console.log('📡 Fetching single post:', url);
      
      const data = await apiFetch(url);
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch post:', error);
      return null;
    }
  }, [currentUser?.id]);

  // ========== REFRESH A SINGLE POST IN THE PROFILE ==========
  const refreshPost = useCallback(async (postId: number) => {
    console.log('🔄 Refreshing post:', postId);
    const updatedPost = await fetchPostById(postId);
    
    if (updatedPost) {
      setProfilePosts(prev => 
        prev.map(p => 
          safePostIdHelper(p) === postId 
            ? { 
                ...p, 
                ...updatedPost,
                comments_count: updatedPost.comments_count || 0,
                reactions_count: updatedPost.reactions_count || 0,
                shares: updatedPost.shares || 0
              } 
            : p
        )
      );
      console.log('✅ Post refreshed:', postId);
    }
  }, [fetchPostById]);

  // ========== FETCH PROFILE POSTS FROM BACKEND ==========
  const fetchProfilePostsFromBackend = async (profileUserId: number): Promise<PostType[]> => {
    if (!profileUserId) return [];
    
    setIsLoadingPosts(true);
    
    try {
      const viewerId = currentUser?.id ?? 0;
      
      const url = `/api/posts/by-user?userId=${profileUserId}&viewerId=${viewerId}&limit=50`;
      console.log('📡 Fetching profile posts from:', url);
      
      const data = await apiFetch(url);
      console.log('📥 Profile posts response:', data);
      
      let postsArray = [];
      if (Array.isArray(data)) {
        postsArray = data;
      } else if (data?.posts && Array.isArray(data.posts)) {
        postsArray = data.posts;
      } else if (data?.data && Array.isArray(data.data)) {
        postsArray = data.data;
      } else if (data?.results && Array.isArray(data.results)) {
        postsArray = data.results;
      }
      
      const normalized = postsArray.map((post: any) => ({
        ...post,
        id: safeNumberHelper(post?.id ?? post?.post_id),
        user_id: safeNumberHelper(post?.user_id),
        content: safeStringHelper(post?.content),
        media_url: post?.media_url ?? null,
        media_type: post?.media_type ?? null,
        media_urls: Array.isArray(post?.media_urls) ? post.media_urls : [],
        images: Array.isArray(post?.images) ? post.images : [],
        reactions: safeArrayHelper(post?.reactions),
        comments: safeArrayHelper(post?.comments),
        shares: safeNumberHelper(post?.shares),
        views: safeNumberHelper(post?.views),
        my_reaction: post?.my_reaction ?? null,
        reactions_count: safeNumberHelper(post?.reactions_count, 0),
        comments_count: safeNumberHelper(post?.comments_count, 0),
        created_at: post?.created_at ?? new Date().toISOString(),
        type: post?.type || post?.post_type || 'post',
        meta: post?.meta || {},
        product_id: post?.product_id,
        marketplace: post?.marketplace,
        event_id: post?.event_id,
        event: post?.event
      }));

      normalized.sort((a: any, b: any) => 
        String(b.created_at).localeCompare(String(a.created_at))
      );

      return normalized;
    } catch (error) {
      console.error('❌ Failed to fetch profile posts:', error);
      return [];
    } finally {
      setIsLoadingPosts(false);
    }
  };

  // ========== LOAD PROFILE POSTS ==========
  useEffect(() => {
    let cancelled = false;
    
    const loadProfilePosts = async () => {
      if (!user?.id) return;
      
      try {
        if (fetchProfilePosts) {
          const viewerId = currentUser?.id ?? null;
          const list = await fetchProfilePosts(Number(user.id), viewerId);
          if (!cancelled && list.length) {
            setProfilePosts(list);
          }
          return;
        }
        
        const list = await fetchProfilePostsFromBackend(Number(user.id));
        if (!cancelled) {
          setProfilePosts(list);
        }
      } catch (error) {
        console.error('Error loading profile posts:', error);
      }
    };
    
    loadProfilePosts();
    
    return () => { cancelled = true; };
  }, [user?.id, currentUser?.id]);

  // ========== MANUAL REFRESH FUNCTION ==========
  const refreshProfilePosts = async () => {
    if (!user?.id) return;
    
    const list = await fetchProfilePostsFromBackend(Number(user.id));
    setProfilePosts(list);
  };

  // User reels
  const userReels = useMemo(
    () => safeArrayHelper<Reel>(reels).filter((reel: any) => Number(reel?.user_id) === Number(user?.id)),
    [reels, user?.id]
  );

  // Stats calculations
  const totalViews = useMemo(
    () => profilePosts.reduce((acc, curr: any) => acc + safeNumberHelper(curr?.views, 0), 0),
    [profilePosts]
  );

  const totalLikes = useMemo(() => {
    const postLikes = profilePosts.reduce((acc, curr: any) => {
      const reactionsCount = safeNumberHelper((curr as any)?.reactions_count, 0);
      const reactionsArray = safeArrayHelper(curr?.reactions);
      return acc + (reactionsCount > 0 ? reactionsCount : reactionsArray.length);
    }, 0);
    const reelLikes = userReels.reduce((acc, curr: any) => acc + safeArrayHelper(curr?.reactions).length, 0);
    return postLikes + reelLikes;
  }, [profilePosts, userReels]);

  const totalShares = useMemo(() => {
    const postShares = profilePosts.reduce((acc, curr: any) => acc + safeNumberHelper(curr?.shares, 0), 0);
    const reelShares = userReels.reduce((acc, curr: any) => acc + safeNumberHelper((curr as any)?.shares, 0), 0);
    return postShares + reelShares;
  }, [profilePosts, userReels]);

  const totalComments = useMemo(() => {
    const postComments = profilePosts.reduce((acc, curr: any) => {
      const commentsCount = safeNumberHelper((curr as any)?.comments_count, 0);
      const commentsArray = safeArrayHelper(curr?.comments);
      return acc + (commentsCount > 0 ? commentsCount : commentsArray.length);
    }, 0);
    const reelComments = userReels.reduce((acc, curr: any) => acc + safeArrayHelper((curr as any)?.comments).length, 0);
    return postComments + reelComments;
  }, [profilePosts, userReels]);

  const totalEngagement = totalLikes + totalComments + totalShares;

  const safeProfileImage = safeStringHelper((user as any)?.profile_image_url, '');
  const safeCoverImage = safeStringHelper((user as any)?.cover_image_url, '');
  const safeBio = safeStringHelper((user as any)?.bio, '');

  // ==============================
  // ✅ Presence (Online / Last seen)
  // ==============================
  const toDate = (v: any): Date | null => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const onlineUntil = toDate((user as any)?.online_until || (user as any)?.onlineUntil);
  const lastSeenAt = toDate((user as any)?.last_seen_at || (user as any)?.lastSeenAt);

  const isOnline = useMemo(() => {
    if (!onlineUntil) return false;
    return onlineUntil.getTime() > Date.now();
  }, [onlineUntil]);

  const presenceLabel = useMemo(() => {
    if (isOnline) return "Online";
    if (lastSeenAt) return `Last seen ${formatRelativeTime(lastSeenAt.toISOString())}`;
    return "Offline";
  }, [isOnline, lastSeenAt]);

  // Image validation
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

  const handleFollowClick = () => {
    if (!currentUser) return;
    setIsFollowButtonClicked(true);
    onFollow(user.id);
    setTimeout(() => {
      setIsFollowButtonClicked(false);
    }, 300);
  };

  const handleSelfMessageClick = () => {
    if (!currentUser) return;
    if (onOpenChatsList) {
      onOpenChatsList();
    }
  };

  const handleOtherMessageClick = () => {
    if (!currentUser) return;
    if (onOpenChat) {
      onOpenChat(user);
    } else {
      onMessage(user.id);
    }
  };

  // ========== PROFILE-SPECIFIC REACT HANDLER WITH OPTIMISTIC UPDATE ==========
  const handleProfileReact = (postId: number, type: ReactionType) => {
    if (!currentUser) return;

    const pid = Number(postId);

    setProfilePosts(prev =>
      prev.map((p: any) => {
        if (safePostIdHelper(p) !== pid) return p;

        const current = (p as any).my_reaction ?? null;
        const nextMy = current === type ? null : type;

        const currentCount = Number((p as any).reactions_count ?? 0) || 0;
        const nextCount = current
          ? (nextMy ? currentCount : Math.max(0, currentCount - 1))
          : (nextMy ? currentCount + 1 : currentCount);

        const prevArr = safeArrayHelper<any>((p as any).reactions);
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

    onReact(pid, type);
  };

  // ========== SHARE HANDLER ==========
  const handleShareComplete = (destination: string, data?: any) => {
    if (selectedPostForShare && data?.success) {
      const newShares = data?.shares || 0;
      onShare(safePostIdHelper(selectedPostForShare), newShares);
      
      setProfilePosts(prev =>
        prev.map(p => 
          safePostIdHelper(p) === safePostIdHelper(selectedPostForShare)
            ? { ...p, shares: newShares }
            : p
        )
      );
    }
    setShowShareSheet(false);
    setSelectedPostForShare(null);
  };

  // ========== OPEN COMMENTS SHEET WITH REFRESH FUNCTION ==========
  const handleOpenComments = (postId: number) => {
    const post = profilePosts.find(p => safePostIdHelper(p) === postId);
    if (post) {
      console.log('📝 Opening comments for post:', postId);
      
      setSelectedPostForComments({
        ...post,
        onCommentAdded: () => {
          console.log('🔄 Comment added, refreshing post:', postId);
          refreshPost(postId);
        }
      });
      setShowCommentsSheet(true);
    } else {
      onOpenComments(postId);
    }
  };

  // ========== OPEN REACTIONS SHEET ==========
  const handleOpenReactions = (postId: number) => {
    setSelectedPostForReactions(postId);
    setShowReactionsSheet(true);
  };

  // ========== OPEN GALLERY ==========
  const openGallery = (urls: string[], index: number) => {
    setGalleryUrls(urls);
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  // ========== FILTER OUT GROUP POSTS ==========
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
      return !hasGroup;
    });
  }, [profilePosts]);

  // ========== DEBUG MARKETPLACE POSTS ==========
  useEffect(() => {
    const marketplacePosts = filteredProfilePosts.filter((p: any) => {
      const meta = p?.meta || {};
      return p?.type === "marketplace" ||
             p?.post_type === "product" ||
             p?.type === 'product' ||
             !!p?.product_id ||
             !!meta?.marketplace?.id ||
             !!meta?.product?.id;
    });
    
    if (marketplacePosts.length > 0) {
      console.log('📱 Marketplace posts found in profile:', marketplacePosts.length);
    }
  }, [filteredProfilePosts]);

  // ========== RENDER ABOUT TAB ==========
  const renderAbout = () => (
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
        "{safeStringHelper((user as any).bio, 'No bio available')}"
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

  // ========== RENDER FOLLOWERS TAB ==========
  const renderFollowers = () => (
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
                src={avatarFrom(follower)}
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

  // ========== RENDER PHOTOS TAB ==========
  const renderPhotos = () => {
    const photoPosts = filteredProfilePosts.filter((p: any) => {
      const mediaInfo = getMediaTypeInfo(p);
      return mediaInfo.isImage && mediaInfo.mediaUrl && mediaInfo.mediaUrl.trim() !== '';
    });

    return (
      <div className="bg-[#242526] p-4 rounded-xl border border-[#3E4042] mx-4 md:mx-0">
        <h2 className="text-xl font-bold text-[#E4E6EB] mb-4">Photos</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1">
          {photoPosts.map((p: any) => {
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
        {photoPosts.length === 0 && (
          <div className="text-center py-8">
            <i className="fas fa-images text-[#B0B3B8] text-4xl mb-4"></i>
            <p className="text-[#B0B3B8]">No photos available</p>
          </div>
        )}
      </div>
    );
  };

  // ========== RENDER POSTS TAB (MAIN FEED) ==========
  const renderPosts = () => (
    <div className="max-w-[1095px] mx-auto w-full flex flex-col md:flex-row gap-4 px-0 md:px-4 mt-4">
      {/* Left Sidebar - Intro */}
      <div className="w-full md:w-[380px] flex-shrink-0 flex flex-col gap-4 px-4 md:px-0">
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

        {/* Suggested Products Widget */}
        {!isCurrentUser && products.length > 0 && currentUser && (
          <SuggestedProductsWidget
            products={products}
            currentUser={currentUser}
            onViewProduct={(product) => onViewProduct?.(product.id)}
            onSeeAll={() => console.log('See all products')}
          />
        )}
      </div>

      {/* Main Content - Posts Feed */}
      <div className="flex-1 min-w-0">
        {/* Error display */}
        {loginError && (
          <div className="mb-4 p-3 bg-red-900/80 border border-red-700 rounded-lg text-red-200 text-sm">
            <div className="flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i>
              <span>{loginError}</span>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoadingPosts && (
          <div className="bg-[#242526] rounded-xl p-8 text-center border border-[#3E4042] mb-4">
            <div className="flex justify-center items-center gap-2">
              <i className="fas fa-spinner fa-spin text-[#1877F2] text-xl"></i>
              <span className="text-[#B0B3B8]">Loading posts...</span>
            </div>
          </div>
        )}

        {/* Stats for current user */}
        {isCurrentUser && !isLoadingPosts && (
          <div className="bg-[#242526] rounded-xl p-4 mb-4 border border-[#3E4042] shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#3A3B3C] p-3 rounded-lg border border-[#3E4042]">
                <div className="text-[#B0B3B8] text-xs font-medium mb-1">Total Views</div>
                <div className="text-[#E4E6EB] font-bold text-xl">
                  {safeNumberHelper(totalViews).toLocaleString()}
                </div>
              </div>
              <div className="bg-[#3A3B3C] p-3 rounded-lg border border-[#3E4042]">
                <div className="text-[#B0B3B8] text-xs font-medium mb-1">Engagement</div>
                <div className="text-[#E4E6EB] font-bold text-xl">
                  {safeNumberHelper(totalEngagement).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Post for current user */}
        {isCurrentUser && currentUser && (
          <>
            <CreatePost
              currentUser={currentUser}
              onProfileClick={onProfileClick}
              onClick={() => setShowCreatePostModal(true)}
              onCreateEventClick={onCreateEventClick || (() => {})}
            />
            {showCreatePostModal && (
              <CreatePostModal
                currentUser={currentUser}
                onClose={() => setShowCreatePostModal(false)}
                onCreatePost={onCreatePost}
                users={users}
                onCreateEventClick={onCreateEventClick}
              />
            )}
          </>
        )}

        {/* People You May Know */}
        {!isCurrentUser && peopleSuggestions.length > 0 && (
          <PeopleYouMayKnowGrid
            users={peopleSuggestions}
            onFollow={onFollow}
            currentUser={currentUser}
            onLoginClick={() => alert('Please login to follow users')}
            maxDisplay={6}
          />
        )}

        {/* Posts Feed */}
        {!isLoadingPosts && filteredProfilePosts.length > 0 ? (
          filteredProfilePosts.map((post: any) => {
            // Check if it's an event post
            const isEventPost =
              post?.item_type === "event" ||
              String(post?.feed_key || "").startsWith("event:") ||
              post?.source === "event" ||
              post?.type === 'event' ||
              post?.post_type === 'event' ||
              !!post?.event_id ||
              !!post?.meta?.event;

            if (isEventPost) {
              const event = normalizeEventFromFeed(post);
              return (
                <EventPost
                  key={post.id}
                  event={event}
                  author={user}
                  currentUser={currentUser}
                  users={users}
                  onProfileClick={onProfileClick}
                  onRSVP={onRSVP}
                  onFollow={onFollow}
                  isFollowing={isFollowing}
                  groups={groups}
                  brands={brands}
                  onEventClick={(eventId) => console.log('Event clicked:', eventId)}
                />
              );
            }

            // Regular post with ALL marketplace props
            return (
              <Post
                key={post.id}
                post={post}
                author={user}
                currentUser={currentUser}
                users={users}
                onProfileClick={onProfileClick}
                onReact={handleProfileReact}
                onShare={(id, newCount) => {
                  onShare(id, newCount);
                  setProfilePosts(prev =>
                    prev.map(p => safePostIdHelper(p) === id ? { ...p, shares: newCount } : p)
                  );
                }}
                onDelete={onDeletePost}
                onEdit={onEditPost}
                onViewImage={onViewImage}
                onOpenComments={handleOpenComments} // 👈 Now uses refresh approach
                onVideoClick={onVideoClick}
                onPlayAudioTrack={onPlayAudioTrack}
                onHashtagClick={onHashtagClick}
                onViewProductFromPost={onViewProductFromPost}
                onViewProduct={onViewProduct}
                getProductData={getProductData || marketplaceContext?.getProductData}
                onOpenAudio={onOpenAudio}
                onRSVP={onRSVP}
                groups={groups}
                brands={brands}
                isFollowing={isFollowing}
                onFollow={onFollow}
                onOpenReactions={handleOpenReactions}
              />
            );
          })
        ) : !isLoadingPosts && filteredProfilePosts.length === 0 && (
          <div className="bg-[#242526] rounded-xl p-8 text-center border border-[#3E4042]">
            <div className="text-[#B0B3B8] text-lg mb-2">No posts yet</div>
            <p className="text-[#B0B3B8] text-sm">
              {isCurrentUser ? "Create your first post!" : "This user hasn't posted anything yet."}
            </p>
            {isCurrentUser && (
              <button
                onClick={() => setShowCreatePostModal(true)}
                className="mt-4 bg-[#1877F2] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#166FE5] transition-colors"
              >
                Create Post
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full bg-[#18191A] min-h-screen">
      {/* File inputs for profile/cover images */}
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

      {/* ==============================
          ✅ FB-LIKE TOP PROFILE HEADER (UNERA COLORS, NO CONTAINERS)
         ============================== */}
      <div className="w-full">
        {/* Cover */}
        <div className="w-full relative">
          <div className="h-[210px] md:h-[340px] w-full bg-[#2A2D31] overflow-hidden">
            {safeCoverImage ? (
              <img
                src={safeCoverImage}
                alt="Cover"
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => onViewImage(safeCoverImage)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#B0B3B8]">
                No Cover
              </div>
            )}
          </div>

          {/* Cover edit (self only) */}
          {isCurrentUser && (
            <button
              onClick={() => coverInputRef.current?.click()}
              className="absolute right-3 bottom-3 bg-[#3A3B3C]/90 hover:bg-[#4E4F50] text-[#E4E6EB] px-3 py-2 rounded-full text-[13px] font-semibold flex items-center gap-2 backdrop-blur-md active:scale-95"
            >
              <i className="fas fa-camera text-[#B0B3B8]"></i>
              <span className="hidden sm:inline">Edit cover</span>
            </button>
          )}
        </div>

        {/* Top info area */}
        <div className="max-w-[1095px] mx-auto w-full px-4">
          {/* Avatar row (overlaps cover like FB) */}
          <div className="flex items-end justify-between gap-3 -mt-[64px] md:-mt-[56px]">
            {/* Left: avatar + name + stats */}
            <div className="flex items-end gap-4 min-w-0">
              {/* Avatar */}
              <div className="relative">
                <div className="w-[132px] h-[132px] md:w-[152px] md:h-[152px] rounded-full bg-[#18191A] p-[4px]">
                  <div className="w-full h-full rounded-full overflow-hidden bg-[#3A3B3C] cursor-pointer relative group">
                    {safeProfileImage ? (
                      <img
                        src={safeProfileImage}
                        alt={safeStringHelper((user as any).name, "User")}
                        className="w-full h-full object-cover"
                        onClick={() => onViewImage(safeProfileImage)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#B0B3B8]">
                        No Photo
                      </div>
                    )}

                    {/* Avatar edit overlay (self only) */}
                    {isCurrentUser && (
                      <div
                        onClick={() => profileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/35 hidden group-hover:flex items-center justify-center"
                      >
                        <i className="fas fa-camera text-white text-2xl"></i>
                      </div>
                    )}
                  </div>
                </div>

                {/* Online dot (FB-like) */}
                <div className="absolute right-2 bottom-3">
                  <div
                    className={`w-4 h-4 rounded-full border-[3px] border-[#18191A] ${
                      isOnline ? "bg-emerald-500" : "bg-[#65676B]"
                    }`}
                    title={presenceLabel}
                  />
                </div>
              </div>

              {/* Name + followers + presence */}
              <div className="pb-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[26px] md:text-[32px] font-extrabold text-[#E4E6EB] leading-tight truncate">
                    {safeStringHelper((user as any).name, "User")}
                  </h1>

                  {(user as any).is_verified && (
                    <i className="fas fa-check-circle text-[#2D88FF] text-[18px] md:text-[20px]"></i>
                  )}

                  {(user.role === "admin" || user.role === "moderator") && (
                    <span
                      className={`text-[11px] px-2 py-[2px] rounded-full font-bold ${
                        user.role === "admin"
                          ? "bg-red-900/70 text-red-100"
                          : "bg-purple-900/70 text-purple-100"
                      }`}
                    >
                      {user.role}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[#B0B3B8] mt-1 flex-wrap">
                  <span className="font-semibold text-[15px]">
                    {followerCount} Followers
                  </span>

                  <span className="text-[#3E4042]">•</span>

                  <span className="text-[14px]">
                    {filteredProfilePosts.length} posts
                  </span>
                </div>

                {/* Presence text line */}
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-[13px] font-semibold ${
                      isOnline ? "text-emerald-400" : "text-[#B0B3B8]"
                    }`}
                  >
                    {presenceLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: actions (FB-style) */}
            <div className="pb-2 flex items-center gap-2 flex-shrink-0">
              {isCurrentUser ? (
                <>
                  <button
                    className="bg-[#2D88FF] hover:bg-[#1B74E4] text-white px-4 py-2 rounded-lg font-bold text-[14px] flex items-center gap-2 active:scale-95"
                    onClick={() => {
                      if (onCreateStoryClick) onCreateStoryClick();
                      else setShowCreatePostModal(true);
                    }}
                  >
                    <i className="fas fa-plus"></i>
                    <span className="hidden sm:inline">Add to story</span>
                  </button>

                  <button
                    onClick={handleSelfMessageClick}
                    className={`bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] px-4 py-2 rounded-lg font-bold text-[14px] flex items-center gap-2 active:scale-95 ${
                      isChatsListOpen ? "ring-2 ring-[#2D88FF]" : ""
                    }`}
                  >
                    <i className="fas fa-comment"></i>
                    <span className="hidden sm:inline">
                      {isChatsListOpen ? "Chats Open" : "Messages"}
                    </span>
                  </button>
                </>
              ) : (
                <>
                  {/* Follow stays, but you said you don't have following list — so UI remains followers only */}
                  <button
                    onClick={handleFollowClick}
                    className={`px-4 py-2 rounded-lg font-bold text-[14px] flex items-center gap-2 active:scale-95 ${
                      isFollowing
                        ? "bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB]"
                        : "bg-[#2D88FF] hover:bg-[#1B74E4] text-white"
                    } ${isFollowButtonClicked ? "scale-95 shadow-inner" : ""}`}
                    disabled={isFollowButtonClicked}
                  >
                    {isFollowing ? (
                      <>
                        <i className="fas fa-check"></i>
                        <span className="hidden sm:inline">Following</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-user-plus"></i>
                        <span className="hidden sm:inline">Follow</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleOtherMessageClick}
                    className={`bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] px-4 py-2 rounded-lg font-bold text-[14px] flex items-center gap-2 active:scale-95 ${
                      isChatOpen && activeChatRecipient?.id === user.id
                        ? "ring-2 ring-[#2D88FF]"
                        : ""
                    }`}
                  >
                    <i className="fas fa-comment"></i>
                    <span className="hidden sm:inline">
                      {isChatOpen && activeChatRecipient?.id === user.id
                        ? "Chat Open"
                        : "Message"}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tabs row (keeps your tabs, but styled like FB top bar) */}
          <div className="mt-3 border-t border-[#3E4042]">
            <div className="flex items-center gap-2 overflow-x-auto">
              {(["Posts", "About", "Followers", "Photos"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-[15px] font-bold whitespace-nowrap border-b-[3px] transition-colors active:scale-95 ${
                    activeTab === tab
                      ? "text-[#2D88FF] border-[#2D88FF]"
                      : "text-[#B0B3B8] border-transparent hover:bg-[#242526] rounded-md"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Admin/Moderator Controls */}
      {isAdminOrModerator && (
        <div className="max-w-[1095px] mx-auto mt-6 px-4">
          <div className="bg-[#242526] rounded-xl p-4 shadow-sm border border-red-900/50">
            <h2 className="text-xl font-bold text-red-500 mb-4">
              {isAdmin ? 'Admin Controls' : 'Moderator Controls'}
            </h2>
            <div className="flex flex-col gap-2">
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

      {/* Render active tab */}
      {activeTab === 'About' && renderAbout()}
      {activeTab === 'Followers' && renderFollowers()}
      {activeTab === 'Photos' && renderPhotos()}
      {activeTab === 'Posts' && renderPosts()}

      {/* Edit Profile Modal */}
      {showEditProfile && isCurrentUser && (
        <EditProfileModal user={user} onClose={() => setShowEditProfile(false)} onSave={onUpdateUserDetails} />
      )}

      {/* ========== MODALS FROM FEEDS ========== */}

      {/* Comments Sheet */}
      {showCommentsSheet && selectedPostForComments && currentUser && (
        <CommentsSheet
          post={selectedPostForComments}
          currentUser={currentUser}
          users={users}
          onClose={() => {
            setShowCommentsSheet(false);
            setSelectedPostForComments(null);
          }}
          onComment={onComment}
          onCommentAdded={selectedPostForComments?.onCommentAdded} // 👈 Pass the refresh function
          getCommentAuthor={getCommentAuthor}
          onProfileClick={onProfileClick}
          onHashtagClick={onHashtagClick}
          onFollow={onFollow}
          checkIsFollowing={(id) => {
            if (!currentUser) return false;
            const userFollowers = safeArrayHelper<number>((users.find(u => u.id === id) as any)?.followers || []);
            return userFollowers.includes(currentUser.id);
          }}
          onViewProductFromPost={onViewProductFromPost}
          onOpenAudio={onOpenAudio}
        />
      )}

      {/* Reactions Sheet */}
      {showReactionsSheet && selectedPostForReactions && (
        <ReactionsSheet
          isOpen={showReactionsSheet}
          onClose={() => {
            setShowReactionsSheet(false);
            setSelectedPostForReactions(null);
          }}
          postId={selectedPostForReactions}
          onProfileClick={onProfileClick}
          onOpenComments={handleOpenComments}
        />
      )}

      {/* Share Bottom Sheet */}
      {showShareSheet && selectedPostForShare && (
        <ShareBottomSheet
          isOpen={showShareSheet}
          onClose={() => {
            setShowShareSheet(false);
            setSelectedPostForShare(null);
          }}
          post={selectedPostForShare}
          currentUser={currentUser}
          users={users}
          groups={groups}
          brands={brands}
          onShareComplete={handleShareComplete}
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
    </div>
  );
};
