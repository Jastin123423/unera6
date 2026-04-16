// =========================
// USERS / BRANDS
// =========================
export interface User {
  id: number;
  username: string;

  // ✅ Make required because App.tsx uses currentUser.name a lot
  name: string;

  // Optional splits (some UIs/forms may use them)
  firstName?: string;
  lastName?: string;

  profile_image_url: string;
  cover_image_url?: string;

  bio?: string;
  work?: string;
  education?: string;
  location?: string;
  website?: string;

  is_online?: boolean;

  followers: number[];
  following: number[];

  email: string;

  // should not be sent to client (kept optional for type compatibility)
  password_hash?: string;

  birth_date?: string;
  gender?: string;
  nationality?: string;

  is_verified?: boolean;
  role?: 'admin' | 'moderator' | 'user';

  is_musician?: boolean;
  is_restricted?: boolean;
  restricted_until?: number;

  phone?: string;

  created_at?: string;
  interests?: string[];

  // ✅ Group posting restriction - allows admins to disable member posting
  posting_disabled?: boolean;

  // ✅ Optional aliases some endpoints might return
  user_id?: number;
  userId?: number;
  avatar_url?: string;
  profileImage?: string;
  coverImage?: string;
  isVerified?: boolean;
  joined_date?: string;
  joinedDate?: string;
}

export interface Brand {
  id: number;
  name: string;
  description: string;
  category: string;

  profile_image_url: string;
  cover_image_url: string;

  admin_id: number;
  owner_id?: number;           // ✅ For backend compatibility
  brand_user_id?: number;       // ✅ Points to users.id for follow operations
  followers: number[];

  location: string;
  website?: string;

  contact_email?: string;
  contact_phone?: string;

  is_verified?: boolean;
  created_at: string;

  // ✅ Optional aliases to tolerate mixed APIs
  brand_id?: number;
  profileImage?: string;
  coverImage?: string;
  adminId?: number;
  isVerified?: boolean;
  logo_url?: string;            // ✅ Backend uses this for profile image
}

// ============================================================================
// ✅ ADVERTISING SYSTEM FUNCTIONS
// ============================================================================

// Fetch user's ad campaigns
const fetchMyAds = useCallback(async () => {
  if (!currentUser) return;
  
  setAdsLoading(true);
  try {
    const response = await fetch('/api/ads/my', {
      headers: {
        'x-user-id': String(currentUser.id)
      }
    });
    const data = await response.json();
    
    // Transform backend ads to AdCampaign format
    const campaigns = (data.ads || []).map((ad: any) => ({
      id: ad.id,
      advertiser_id: ad.advertiser_id,
      post_id: ad.post_id,
      name: `Campaign #${ad.id}`,
      type: 'image' as const,
      mediaUrl: '',
      description: '',
      link: '',
      cta: 'Learn More' as const,
      location: 'Global',
      days: Math.ceil((new Date(ad.end_date).getTime() - new Date(ad.start_date).getTime()) / (1000 * 60 * 60 * 24)),
      createdAt: new Date(ad.created_at).getTime(),
      status: ad.status,
      analytics: {
        impressions: 0,
        clicks: 0,
        views: 0,
        spend: ad.budget || 0
      },
      start_date: ad.start_date,
      end_date: ad.end_date,
      budget: ad.budget
    }));
    
    setAdCampaigns(campaigns);
  } catch (error) {
    console.error('Failed to fetch ads:', error);
  } finally {
    setAdsLoading(false);
  }
}, [currentUser]);

// Create new ad campaign
const createAdCampaign = useCallback(async (
  postId: number,
  budget: number,
  days: number
) => {
  if (!requireAuth('Creating ads')) return false;
  if (!currentUser) return false;

  try {
    const response = await fetch('/api/ads/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': String(currentUser.id)
      },
      body: JSON.stringify({
        post_id: postId,
        budget,
        days
      })
    });

    const data = await response.json();

    if (data.success) {
      // Refresh ads list
      await fetchMyAds();
      
      // Show success message
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1877F2] text-white px-6 py-2 rounded-full font-bold shadow-lg animate-fade-in z-[300]';
      toast.innerText = 'Campaign created successfully!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to create campaign:', error);
    
    // Show error message
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-2 rounded-full font-bold shadow-lg animate-fade-in z-[300]';
    toast.innerText = 'Failed to create campaign';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
    
    return false;
  }
}, [currentUser, requireAuth, fetchMyAds]);

// Record ad impression
const recordAdImpression = useCallback(async (adId: number) => {
  if (!currentUser) return;
  
  try {
    await fetch('/api/ads/impression', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': String(currentUser.id)
      },
      body: JSON.stringify({ ad_id: adId })
    });
  } catch (error) {
    console.error('Failed to record impression:', error);
  }
}, [currentUser]);

// Record ad click
const recordAdClick = useCallback(async (adId: number) => {
  if (!currentUser) return;
  
  try {
    await fetch('/api/ads/click', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': String(currentUser.id)
      },
      body: JSON.stringify({ ad_id: adId })
    });
  } catch (error) {
    console.error('Failed to record click:', error);
  }
}, [currentUser]);

// Pause campaign
const pauseCampaign = useCallback(async (adId: number) => {
  if (!requireAuth('Pausing campaigns')) return false;
  if (!currentUser) return false;

  try {
    const response = await fetch(`/api/ads/${adId}/pause`, {
      method: 'POST',
      headers: {
        'x-user-id': String(currentUser.id)
      }
    });

    const data = await response.json();
    
    if (data.success) {
      await fetchMyAds();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to pause campaign:', error);
    return false;
  }
}, [currentUser, requireAuth, fetchMyAds]);

// Resume campaign
const resumeCampaign = useCallback(async (adId: number) => {
  if (!requireAuth('Resuming campaigns')) return false;
  if (!currentUser) return false;

  try {
    const response = await fetch(`/api/ads/${adId}/resume`, {
      method: 'POST',
      headers: {
        'x-user-id': String(currentUser.id)
      }
    });

    const data = await response.json();
    
    if (data.success) {
      await fetchMyAds();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to resume campaign:', error);
    return false;
  }
}, [currentUser, requireAuth, fetchMyAds]);

// Delete campaign
const deleteCampaign = useCallback(async (adId: number) => {
  if (!requireAuth('Deleting campaigns')) return false;
  if (!currentUser) return false;

  try {
    const response = await fetch(`/api/ads/${adId}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': String(currentUser.id)
      }
    });

    const data = await response.json();
    
    if (data.success) {
      await fetchMyAds();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to delete campaign:', error);
    return false;
  }
}, [currentUser, requireAuth, fetchMyAds]);


// =========================
// REACTIONS
// =========================
export type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

export interface Reaction {
  user_id: number;
  type: ReactionType;

  // Optional aliases (some endpoints may return these)
  userId?: number;
}

// =========================
// COMMENTS
// =========================
export interface CommentReply {
  id: number;
  user_id: number;
  comment_id: number;
  text: string;
  created_at: string;
  likes: number;
  has_liked?: boolean;

  author_name?: string;
  author_image?: string;

  // aliases
  userId?: number;
  commentId?: number;
  createdAt?: string;
}

export interface Comment {
  id: number;
  user_id: number;

  post_id?: number;
  group_post_id?: number;
  reel_id?: number;
  story_id?: number;

  text: string;
  created_at: string;

  likes: number;
  has_liked?: boolean;

  attachment_url?: string;
  sticker_url?: string;

  replies?: CommentReply[];

  // Joined/derived author data
  author_name?: string;
  author_image?: string;

  // aliases
  userId?: number;
  postId?: number;
  groupPostId?: number;
  reelId?: number;
  storyId?: number;
  createdAt?: string;
}

// =========================
// LINK PREVIEW
// =========================
export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
  domain: string;
}

// =========================
// POSTS (Multi-media + reaction sync fields)
// =========================
export interface Post {
  id: number;
  user_id: number | null;
  brand_id?: number | null;      // ✅ ADDED: For brand posts

  content?: string;

  // backward compatible single media
  media_url?: string | null;
  media_type?: string | null;

  // ✅ multi-media arrays (used by normalizePost)
  media_urls?: string[];
  media_types?: string[];

  created_at: string;

  reactions: Reaction[];
  comments: Comment[];

  // counts + "my reaction" fields used by optimistic updates
  reactions_count?: number;
  reactionsCount?: number;
  likesCount?: number;

  my_reaction?: ReactionType | null;
  myReaction?: ReactionType | null;

  shares: number;
  views?: number;

  category?: string;
  tags?: string[];

  type: 'text' | 'image' | 'video' | 'event' | 'product' | 'audio' | 'post';

  // backend can return lowercase variants
  visibility: 'Public' | 'Friends' | 'Only Me' | 'public' | 'friends' | 'only_me';

  location?: string;
  feeling?: string;
  tagged_users?: number[];

  event_id?: number;
  event?: Event;

  product_id?: number;
  product?: Product;

  audio_track?: AudioTrack;

  background?: string;

  shared_post_id?: number;
  link_preview?: LinkPreview;

  group_id?: number;
  group_name?: string;

  brand_name?: string;           // ✅ For display

  // Joined data from backend
  author_name?: string;
  author_image?: string;

  // aliases
  post_id?: number;
  postId?: number;
  userId?: number;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaUrls?: string[];
  mediaTypes?: string[];
  createdAt?: string;
}

// =========================
// STORIES (✅ matches normalizeStory + Story UI)
// =========================
export interface Story {
  id: number;
  user_id: number;

  type: 'text' | 'image' | 'video';

  // Text stories
  text_content?: string;
  background_style?: string;

  // Media stories
  media_url?: string;

  // ✅ bundled media support
  media_urls?: string[];
  media_types?: string[];
  media_meta?: Array<{
    thumb?: string;
    feed?: string;
    full?: string;
    type?: string;
  }>;

  // Music
  music_url?: string;
  music_title?: string;

  // User info
  user?: User;

  author_name?: string;
  author_username?: string;
  author_image?: string;
  username?: string;

  liked_by_me: boolean;

  created_at: string;
  expires_at?: string;

  reactions?: Reaction[];
  replies?: { user_id: number; text: string; created_at: string }[];

  duration?: number;
  seen?: boolean;
  views?: number;

  // extra story stats used in UI
  views_count?: number;
  reactions_count?: number;
  my_reaction?: ReactionType | null;
  reaction_breakdown?: Record<string, number>;
  is_active?: boolean;

  // aliases
  story_id?: number;
  userId?: number;

  text?: string;
  backgroundStyle?: string;

  mediaUrl?: string;
  mediaUrls?: string[];
  mediaTypes?: string[];
  mediaMeta?: Array<{
    thumb?: string;
    feed?: string;
    full?: string;
    type?: string;
  }>;

  musicUrl?: string;
  musicTitle?: string;

  createdAt?: string;
  expiresAt?: string;

  likedByMe?: boolean;
}

// =========================
// REELS (matches App.tsx normalizeReel + ReelsFeed props)
// =========================
export interface Reel {
  id: number;

  // App.tsx uses userId in normalized reels
  userId: number;

  // Normalized camelCase fields used by Reels UI
  videoUrl: string;
  caption: string;

  songName?: string;
  audioUrl?: string;
  audioStart?: number;
  audioEnd?: number;

  // reactions/comments
  reactions?: Array<{ userId?: number; user_id?: number; type: ReactionType }>;
  comments?: Comment[];

  shares?: number;
  views?: number;

  created_at: string;

  effect_name?: string;
  is_compressed?: boolean;

  likesCount?: number;
  reactions_count?: number;

  author_name?: string;
  author_image?: string;

  // raw backend aliases
  user_id?: number;
  video_url?: string;
  song_name?: string;
  audio_url?: string;
  audio_start?: number;
  audio_end?: number;
  createdAt?: string;

  // trimmed audio support
  soundKey?: string;
  isTrimmedAudio?: boolean;
  audioStartTime?: number;
  audioEndTime?: number;

  // alias
  sound_key?: string;
}

// =========================
// NOTIFICATIONS
// =========================

export type NotificationType =
  | "like"
  | "react"
  | "reaction"
  | "comment"
  | "reply"
  | "follow"
  | "share"
  | "mention"
  | "tag"
  | "birthday"
  | "event"
  | "system"
  | "friend_request"
  | "friend_accept"
  | "group_invite"
  | "group_request"
  | "group_approved"
  | "group_declined"
  | "group_post"
  | "group_comment"
  | "group_reply"
  | "reel_like"
  | "reel_comment"
  | "story_reaction"
  | "story_reply"
  | "marketplace"
  | "product_like"
  | "product_comment"
  | "product_interest"
  | "order"
  | "payment"
  | "security"
  | "admin"
  | "warning"
  | "info";

export type NotificationEntityType =
  | "post"
  | "comment"
  | "reply"
  | "reel"
  | "story"
  | "product"
  | "group"
  | "group_post"
  | "group_comment"
  | "event"
  | "profile"
  | "page"
  | "message"
  | "order"
  | "payment"
  | "system"
  | "";

export interface NotificationActorRef {
  id: number;
  name?: string;
  username?: string;
  profile_image_url?: string;
  is_verified?: boolean;
}

export interface Notification {
  id: number;

  // who receives it / who triggered it
  recipient_id: number;
  actor_id: number;

  // main action
  type: NotificationType;

  // what object the notification is about
  entity_type?: NotificationEntityType | null;
  entity_id?: string | number | null;

  // optional relationship targets
  parent_id?: string | number | null;
  group_key?: string | null;

  // display / aggregation
  message?: string | null;
  actors_json?: string | null;
  actors_count?: number | null;

  // state / dates
  is_read: number | boolean;
  created_at: string;
  updated_at?: string | null;

  // optional enriched frontend fields
  actor?: NotificationActorRef | null;
  actors?: NotificationActorRef[];

  // convenience aliases for older parts of app
  createdAt?: string;
  updatedAt?: string;
  isRead?: boolean;

  // legacy compatibility aliases
  user_id?: number;        // old alias for recipient_id
  sender_id?: number;      // old alias for actor_id
  content?: string;        // old alias for message

  // direct entity shortcuts for older code
  post_id?: number;
  reel_id?: number;
  product_id?: string | number;
  comment_id?: string | number;
  group_id?: string | number;
  event_id?: string | number;
  profile_id?: number;

  // optional UI helpers
  image_url?: string | null;
  thumbnail_url?: string | null;
  link?: string | null;
  metadata?: Record<string, any> | null;
}
// =========================
// MESSAGING (FULLY COMPATIBLE WITH Chat.tsx)
// =========================

export type AttachmentFileType =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'gif'
  | 'other';

export interface MessageAttachment {
  id?: number;

  // Main URL
  url?: string;
  attachment_url?: string;

  // File classification
  file_type?: AttachmentFileType;
  attachment_type?: AttachmentFileType;

  // Mime & metadata
  mime_type?: string;
  type?: string;

  filename?: string;
  name?: string;

  size_bytes?: number;
  size?: number;
  file_size?: number;

  metadata?: Record<string, any>;

  created_at?: string;

  // Aliases
  attachmentUrl?: string;
  fileType?: AttachmentFileType;
  mimeType?: string;
  createdAt?: string;
}

export interface Message {
  id: number;

  conversation_id: number;
  sender_id: number;

  // Text
  text_content?: string | null;

  // Multi-attachment support (NEW)
  attachments?: MessageAttachment[];

  // Legacy single attachment support (backward compatible)
  attachment_url?: string;
  attachment_type?: AttachmentFileType;

  // Threading
  parent_message_id?: number | null;

  // Timestamps
  created_at: string;
  edited_at?: string | null;

  // Soft delete (optional future support)
  deleted_for_everyone?: boolean;
  deleted_for?: number[];

  // Aliases (tolerate mixed API responses)
  conversationId?: number;
  senderId?: number;

  text?: string;
  content?: string;

  parentMessageId?: number;

  createdAt?: string;
  editedAt?: string;

  attachmentUrl?: string;
  attachmentType?: AttachmentFileType;
}

export interface Conversation {
  id: number;

  type: 'one_on_one' | 'group';

  created_at: string;
  last_message_at?: string;

  // For 1:1 chats
  other_user_id?: number;
  other_user?: User;

  // Group chats
  group_name?: string;
  group_avatar_url?: string;

  participants?: User[];

  unread_count?: number;

  // Aliases
  createdAt?: string;
  lastMessageAt?: string;
  groupName?: string;
  groupAvatarUrl?: string;
}

// =========================
// SEARCH
// =========================
export interface SearchResult {
  user: User;
  score: number;
}

// =========================
// EVENTS
// =========================
export interface Event {
  id: number;

  title: string;
  description: string;

  // UI-safe fields (what normalizeEvent creates)
  date: string; // ISO string
  time?: string;
  location: string;
  image?: string;

  organizerId: number;
  organizer_name?: string;
  organizer_avatar?: string;

  attendees: number[];
  interestedIds: number[];

  visibility: 'worldwide' | 'targeted';
  created_at: string;

  // DB / API raw aliases
  event_date?: string;
  event_time?: string;
  cover_url?: string;

  creator_id?: number;
  creator_name?: string;
  creator_avatar?: string;

  attendee_ids?: number[];
  interested_ids?: number[];

  // Brand event support
  brand_id?: number;            // ✅ For brand events

  // UI-only state
  isAttending?: boolean;
  isInterested?: boolean;
  isLoading?: boolean;
}

// =========================
// LOCATIONS
// =========================
export interface LocationData {
  name: string;
  flag: string;
}

// =========================
// MARKETPLACE
// =========================
export interface Product {
  id: number;
  title: string;
  category: string;
  description: string;
  country: string;
  address: string;

  main_price: number;
  discount_price?: number | null;

  quantity: number;
  phone_number: string;

  images: string[];

  seller_id: number;
  seller_name: string;
  seller_avatar: string;

  created_at: string;

  status: 'active' | 'sold' | 'inactive';

  share_id: string;
  views: number;

  ratings: number[];
  comments: Comment[];

  // aliases
  sellerId?: number;
  sellerName?: string;
  sellerAvatar?: string;
  createdAt?: string;
}

// =========================
// GROUPS
// =========================

export interface GroupPost {
  id: number;
  user_id: number;
  group_id: number;
  content: string;
  media_url?: string;
  media_type?: string;
  media_urls?: string[];
  media_types?: string[];
  background?: string;
  reactions: Reaction[];
  comments: Comment[];
  shares: number;
  created_at: string;
  author_name?: string;
  author_image?: string;
  reactions_count?: number;
  my_reaction?: ReactionType | null;
  userId?: number;
  groupId?: number;
  mediaUrl?: string;
  mediaType?: string;
  createdAt?: string;
  
  // Category-specific fields
  price?: number;
  currency?: string;
  condition?: string;
  location?: string;
  status?: 'available' | 'pending' | 'sold';
  job_title?: string;
  company?: string;
  salary?: string;
  job_type?: string;
  street?: string;
  district?: string;
  region?: string;
  country?: string;
  application_type?: string;
  application_value?: string;
  expiry_date?: string;
}

export interface Group {
  id: number;
  name: string;
  description: string;
  type: 'public' | 'private';
  category: 'general' | 'recruitment' | 'buy_sell';
  profile_image: string;
  cover_image: string;
  admin_id: number;
  members: number[];
  posts: GroupPost[];
  created_at: string;
  events?: Event[];
  member_posting_allowed?: boolean;
  member_posting_allowed?: boolean;
  members_count?: number;
  is_member?: boolean;
  newPostsCount?: number;
  updatedAt?: string;
  
  // Aliases for API compatibility
  group_id?: number;
  groupId?: number;
  adminId?: number;
  coverImage?: string;
  profileImage?: string;
  createdAt?: string;
}

export interface GroupInvite {
  id: number;
  group_id: number;
  inviter_id: number;
  invitee_id: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
  group?: Group;
  inviter?: User;
  invitee?: User;
}

export interface GroupMember {
  group_id: number;
  user_id: number;
  role: 'admin' | 'member';
  joined_at: string;
  posting_disabled?: boolean;
}

export interface GroupSuggestion {
  id: number;
  admin_id: number;
  name: string;
  description: string;
  type: 'public' | 'private';
  cover_image?: string;
  profile_image?: string;
  created_at?: string;
  category: string;
  members_count: number;
  mutual_count: number;
  is_member: boolean;
  score: number;
}

// =========================
// MUSIC / PODCASTS
// =========================
export interface Stats {
  plays: number;
  downloads: number;
  shares: number;
  likes: number;
  reels_use: number;
}

export interface Song {
  id: number;
  title: string;
  artist: string;

  // raw (stored) + fetchable/proxy (trim/play)
  audio_url: string;
  audio_fetch_url?: string;

  cover_url?: string;
  duration?: number;

  playCount?: number;
  artistId?: number;

  // aliases
  song_id?: number;
  name?: string;
  url?: string;
  file_url?: string;

  uploader_id?: number;
  artist_name?: string;
  cover_image_url?: string;
  duration_seconds?: number;

  type?: 'music' | 'podcast';
  created_at?: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  cover: string;
  year: string;
  songs: string[];
}

export interface Podcast {
  id: number;
  creator_id: number;
  title: string;
  host: string;
  cover_url: string;
  description: string;
  category: string;
  followers: number;
  created_at: string;

  // aliases
  createdAt?: string;
}

export interface Episode {
  id: number;
  podcast_id: number;
  uploader_id: number;

  title: string;
  description: string;

  created_at: string;
  duration_seconds: number;

  audio_url: string;
  cover_image_url: string;

  stats?: Stats;
  host?: string;

  // aliases
  createdAt?: string;
}

export interface AudioTrack {
  id: string | number;
  url: string;
  title: string;
  artist: string;
  cover: string;
  type: 'music' | 'podcast';

  uploader_id?: number;
  is_verified?: boolean;
}

// =========================
// Reel Sound Support (App.tsx uses this)
// =========================
export type ReelSound = {
  songName: string;
  audioUrl: string;
  audioStart?: number;
  audioEnd?: number;
  songId?: string | number;
  soundKey?: string;
  isTrimmedAudio?: boolean;
  originalUrl?: string;
};

// =========================
// View union (App.tsx)
// =========================
export type View =
  | 'home'
  | 'reels'
  | 'marketplace'
  | 'groups'
  | 'brands'
  | 'music'
  | 'tools'
  | 'profiles'
  | 'events'
  | 'birthdays'
  | 'memories'
  | 'settings'
  | 'privacy'
  | 'terms'
  | 'help'
  | 'profile'
  | 'login'
  | 'register';
