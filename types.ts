// types.ts — FULL UPDATED (App.tsx + Feed.tsx + Groups + Reels compatible)

// =========================
// USERS / BRANDS
// =========================
export interface User {
  id: number;
  username: string;
  name?: string;
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
}

export interface Comment {
  id: number;
  user_id: number;

  post_id?: number;
  group_post_id?: number;
  reel_id?: number; // ✅ ADDED: reels comments compatibility

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
// POSTS (✅ UPDATED FOR MULTI-IMAGE / MULTI-MEDIA + REACTION SYNC FIELDS)
// =========================
export interface Post {
  id: number;
  user_id: number | null;

  content?: string;

  // ✅ backward compatible single media
  media_url?: string | null;
  media_type?: string | null;

  // ✅ NEW: multi-media arrays (used by Feed.tsx + App.tsx normalizePost)
  media_urls?: string[];
  media_types?: string[];

  created_at: string;

  reactions: Reaction[];
  comments: Comment[];

  // ✅ counts + “my reaction” fields used by App.tsx optimistic updates
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

  // NOTE: App.tsx sometimes uses 'public' lowercase from backend.
  // Keep both forms compatible.
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
}

// =========================
// STORIES
// =========================
export interface Story {
  id: number;
  user_id: number;
  media_url?: string;
  user?: User;
  created_at: string;
  expires_at: string;

  type?: 'text' | 'image';
  text_content?: string;
  background_style?: string;

  music_url?: string;
  music_title?: string;

  reactions?: { user_id: number }[];
  replies?: { user_id: number; text: string; created_at: string }[];
}

// =========================
// REELS (✅ UPDATED TO MATCH App.tsx normalizeReel + ReelsFeed props)
// =========================
export interface Reel {
  id: number;

  // ✅ App.tsx uses userId in normalized reels
  userId: number;

  // ✅ Normalized camelCase fields used by Reels UI
  videoUrl: string;
  caption: string;

  songName?: string;
  audioUrl?: string;
  audioStart?: number;
  audioEnd?: number;

  // ✅ Keep arrays optional (some endpoints may omit)
  reactions?: Array<{ userId?: number; user_id?: number; type: ReactionType }>;
  comments?: Comment[];

  shares?: number;
  views?: number;

  created_at: string;

  effect_name?: string;
  is_compressed?: boolean;

  // Optional counts (App may set these during optimistic updates)
  likesCount?: number;
  reactions_count?: number;

  // Joined data (optional)
  author_name?: string;
  author_image?: string;

  // ✅ OPTIONAL: raw backend aliases for compatibility if some components still use snake_case
  // (Try to use normalized fields everywhere, but this prevents TS errors while migrating)
  user_id?: number;
  video_url?: string;
  song_name?: string;
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
}

export interface Conversation {
  id: number;
  type: 'one_on_one' | 'group';
  created_at: string;
  last_message_at?: string;

  group_name?: string;
  group_avatar_url?: string;

  participants?: User[];
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
  creator_id: number;
  title: string;
  description: string;
  event_date: string;
  location: string;
  cover_url: string;
  attendees: number[];
  interested_ids: number[];
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

  // (Optional future-proof)
  media_urls?: string[];
  media_types?: string[];

  background?: string;

  reactions: Reaction[];
  comments: Comment[];

  shares: number;
  created_at: string;

  // Joined data
  author_name?: string;
  author_image?: string;

  // Optional counts
  reactions_count?: number;
  my_reaction?: ReactionType | null;
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
  uploader_id: number;
  title: string;
  artist_name: string;
  album_name?: string;
  cover_image_url: string;
  audio_url: string;
  duration_seconds?: number;
  genre?: string;
  created_at: string;
  stats?: Stats;
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
