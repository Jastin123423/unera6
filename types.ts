

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
}

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

  brand_id?: number;
  brand_name?: string;

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

  // Music
  music_url?: string;
  music_title?: string;

  // User info (either embedded user object or separate fields)
  user?: User;

  author_name?: string;
  author_username?: string;
  author_image?: string;
  username?: string;

  // ✅ make stable for UI
  liked_by_me: boolean;

  created_at: string;
  expires_at?: string;

  // ✅ keep consistent with your Reaction type
  reactions?: Reaction[];
  replies?: { user_id: number; text: string; created_at: string }[];

  duration?: number;
  seen?: boolean;
  views?: number;

  // ✅ aliases to tolerate different API shapes
  story_id?: number;
  userId?: number;

  text?: string;
  backgroundStyle?: string;

  mediaUrl?: string;

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
export interface Notification {
  id: number;
  user_id: number;
  sender_id: number;
  type:
    | 'like'
    | 'comment'
    | 'follow'
    | 'share'
    | 'birthday'
    | 'reaction'
    | 'event'
    | 'system'
    | 'mention';
  content: string;
  post_id?: number;
  reel_id?: number;
  created_at: string;
  is_read: boolean;

  // aliases
  createdAt?: string;
  isRead?: boolean;
}

// =========================
// MESSAGING
// =========================
export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;

  text_content?: string;

  attachment_url?: string;
  attachment_type?: 'image' | 'video' | 'gif' | 'document';

  created_at: string;
  parent_message_id?: number;

  // aliases
  conversationId?: number;
  senderId?: number;
  text?: string;
  createdAt?: string;
}

export interface Conversation {
  id: number;
  type: 'one_on_one' | 'group';

  created_at: string;
  last_message_at?: string;

  group_name?: string;
  group_avatar_url?: string;

  participants?: User[];

  // aliases
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

  // future-proof multi
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

  // aliases
  userId?: number;
  groupId?: number;
  mediaUrl?: string;
  mediaType?: string;
  createdAt?: string;
}

export interface Group {
  id: number;
  name: string;
  description: string;
  type: 'public' | 'private';

  profile_image: string;
  cover_image: string;

  admin_id: number;

  members: number[];
  posts: GroupPost[];

  created_at: string;

  events?: Event[];
  member_posting_allowed?: boolean;
  member_count?: number;

  // aliases
  group_id?: number;
  groupId?: number;
  adminId?: number;
  coverImage?: string;
  profileImage?: string;
  createdAt?: string;
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
