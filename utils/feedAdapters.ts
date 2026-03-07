// utils/feedAdapters.ts

import type { Post as PostType, Event, Group } from "../types";

/**
 * Small safe helpers
 */
const safeNumber = (v: any, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const safeString = (v: any, fallback = ""): string => {
  return typeof v === "string" ? v : fallback;
};

const safeArray = <T = any>(v: any): T[] => {
  return Array.isArray(v) ? v : [];
};

const cleanUrl = (v: any): string => {
  const s = String(v ?? "").trim();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
};

const inferMediaType = (url: string): string => {
  const u = url.toLowerCase();
  if (u.includes(".mp4") || u.includes(".webm") || u.includes(".mov")) return "video";
  if (u.includes(".mp3") || u.includes(".wav") || u.includes(".m4a")) return "audio";
  return "image";
};

const normalizeMedia = (media_url?: any, media_urls?: any, media_types?: any) => {
  const single = cleanUrl(media_url);

  const urls = Array.isArray(media_urls)
    ? media_urls.map(cleanUrl).filter(Boolean)
    : typeof media_urls === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(media_urls);
            return Array.isArray(parsed) ? parsed.map(cleanUrl).filter(Boolean) : [];
          } catch {
            const one = cleanUrl(media_urls);
            return one ? [one] : [];
          }
        })()
      : [];

  const outUrls = urls.length ? urls : single ? [single] : [];

  const parsedTypes = Array.isArray(media_types)
    ? media_types.map((x) => String(x || "").trim()).filter(Boolean)
    : typeof media_types === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(media_types);
            return Array.isArray(parsed)
              ? parsed.map((x) => String(x || "").trim()).filter(Boolean)
              : [];
          } catch {
            const one = String(media_types || "").trim();
            return one ? [one] : [];
          }
        })()
      : [];

  const outTypes =
    parsedTypes.length === outUrls.length
      ? parsedTypes
      : outUrls.map(inferMediaType);

  return {
    media_url: single || outUrls[0] || null,
    media_urls: outUrls,
    media_types: outTypes,
    images: outUrls.filter((u, i) => (outTypes[i] || "image") === "image"),
  };
};

/**
 * Base feed item builder
 */
export const makeBaseFeedItem = (input: any): any => {
  const media = normalizeMedia(input?.media_url, input?.media_urls, input?.media_types);

  return {
    id: input?.id,
    feed_key: input?.feed_key || `${input?.source || input?.type || "post"}:${input?.id}`,
    source: input?.source || "post",
    item_type: input?.item_type || input?.source || "post",

    created_at: input?.created_at || new Date().toISOString(),

    post_id: input?.post_id ?? null,
    reel_id: input?.reel_id ?? null,
    song_id2: input?.song_id2 ?? null,
    podcast_id: input?.podcast_id ?? null,
    event_id: input?.event_id ?? null,
    group_post_id: input?.group_post_id ?? null,
    product_id2: input?.product_id2 ?? null,

    user_id: safeNumber(input?.user_id),
    username: safeString(input?.username),
    name: safeString(input?.name, "User"),
    profile_image_url: cleanUrl(input?.profile_image_url) || null,
    is_verified: !!input?.is_verified,
    role: safeString(input?.role, "user"),

    content: safeString(input?.content),
    visibility: safeString(input?.visibility, "public"),
    views: safeNumber(input?.views, 0),
    shares: safeNumber(input?.shares, 0),

    media_url: media.media_url,
    media_urls: media.media_urls,
    media_types: media.media_types,
    images: media.images,

    comments_count: safeNumber(input?.comments_count, 0),
    reactions_count: safeNumber(input?.reactions_count, 0),
    my_reaction: input?.my_reaction ?? null,
    myReaction: input?.myReaction ?? input?.my_reaction ?? null,

    reactor_name: safeString(input?.reactor_name),
    reactions_preview: safeArray(input?.reactions_preview),
    reactions_by_type: safeArray(input?.reactions_by_type),

    video_url: cleanUrl(input?.video_url) || null,
    caption: safeString(input?.caption),
    song_name: safeString(input?.song_name),
    audio_url: cleanUrl(input?.audio_url) || null,
    audio_start: safeNumber(input?.audio_start, 0),
    audio_end: safeNumber(input?.audio_end, 0),
    location: safeString(input?.location),
    sound_key: safeString(input?.sound_key),
    sound_id: input?.sound_id ?? null,

    song_title: safeString(input?.song_title),
    song_artist_name: safeString(input?.song_artist_name),
    song_album_name: safeString(input?.song_album_name),
    song_cover_image_url: cleanUrl(input?.song_cover_image_url) || null,
    song_duration_seconds: safeNumber(input?.song_duration_seconds, 0),
    song_genre: safeString(input?.song_genre),
    song_likes_count: safeNumber(input?.song_likes_count, 0),
    song_plays_count: safeNumber(input?.song_plays_count, 0),

    podcast_title: safeString(input?.podcast_title),
    podcast_description: safeString(input?.podcast_description),
    podcast_audio_url: cleanUrl(input?.podcast_audio_url) || null,
    podcast_cover_url: cleanUrl(input?.podcast_cover_url) || null,
    podcast_plays_count: safeNumber(input?.podcast_plays_count, 0),

    group_id: input?.group_id ?? null,
    group_name: safeString(input?.group_name),
    group_image: cleanUrl(input?.group_image) || null,

    type: input?.type ?? null,
    post_type: input?.post_type ?? null,
    kind: input?.kind ?? null,
    meta: input?.meta ?? null,
  };
};

/**
 * Event -> feed item
 */
export const makeEventFeedItem = (event: any, currentUserId?: number | null) => {
  const attendees = safeArray<number>(event?.attendees);
  const interestedIds = safeArray<number>(event?.interestedIds ?? event?.interested_ids);

  return makeBaseFeedItem({
    id: event?.id,
    feed_key: `event:${event?.id}`,
    source: "event",
    item_type: "event",

    created_at: event?.created_at || new Date().toISOString(),

    event_id: event?.id,
    user_id: event?.creator_id ?? event?.user_id,
    username: event?.creator_username || "",
    name: event?.creator_name || "User",
    profile_image_url: event?.creator_avatar || "",

    content: event?.title || "",
    visibility: "public",
    media_url: event?.cover_url || "",
    media_type: event?.cover_url ? "image" : null,
    media_urls: event?.cover_url ? [event.cover_url] : [],
    media_types: event?.cover_url ? ["image"] : [],

    comments_count: 0,
    reactions_count: 0,
    shares: safeNumber(event?.shares, 0),

    location: event?.location || "",

    type: "event",
    kind: "event",
    meta: {
      kind: "event",
      event_id: event?.id,
      event: {
        ...event,
        attendees,
        interestedIds,
        my_rsvp_status:
          event?.user_rsvp_status ||
          (currentUserId && attendees.includes(Number(currentUserId))
            ? "going"
            : currentUserId && interestedIds.includes(Number(currentUserId))
              ? "interested"
              : ""),
      },
    },

    event_date: event?.event_date,
    event_description: event?.description,
    attending_count: attendees.length,
    interested_count: interestedIds.length,
    my_rsvp_status: event?.user_rsvp_status || "",
  });
};

/**
 * Song/music -> feed item
 */
export const makeSongFeedItem = (song: any) => {
  return makeBaseFeedItem({
    id: song?.id,
    feed_key: `song:${song?.id}`,
    source: "song",
    item_type: "song",

    created_at: song?.created_at || new Date().toISOString(),

    song_id2: song?.id,
    user_id: song?.uploader_id ?? song?.user_id,
    username: song?.username || "",
    name: song?.uploader_name || song?.artist_name || "Artist",
    profile_image_url: song?.uploader_avatar || "",

    content: song?.title || "",
    visibility: "public",

    media_url: song?.audio_fetch_url || song?.audio_url || "",
    media_type: (song?.audio_fetch_url || song?.audio_url) ? "audio/mpeg" : null,
    media_urls: song?.cover_image_url ? [song.cover_image_url] : [],
    media_types: song?.cover_image_url ? ["image"] : [],

    comments_count: 0,
    reactions_count: safeNumber(song?.likes_count ?? song?.song_likes_count, 0),

    audio_url: song?.audio_fetch_url || song?.audio_url || "",

    song_title: song?.title || "",
    song_artist_name: song?.artist_name || "",
    song_album_name: song?.album_name || "",
    song_cover_image_url: song?.cover_image_url || "",
    song_duration_seconds: safeNumber(song?.duration_seconds, 0),
    song_genre: song?.genre || "",
    song_likes_count: safeNumber(song?.likes_count ?? song?.song_likes_count, 0),
    song_plays_count: safeNumber(song?.plays_count ?? song?.song_plays_count, 0),

    type: "music",
    kind: "song",
    meta: {
      kind: "song",
      song_id: song?.id,
      song,
    },
  });
};

/**
 * Group post -> feed item
 */
export const makeGroupPostFeedItem = (groupPost: any, group?: Partial<Group> | null) => {
  return makeBaseFeedItem({
    ...groupPost,

    id: groupPost?.id,
    feed_key: `group_post:${groupPost?.id}`,
    source: "group_post",
    item_type: "group_post",

    group_post_id: groupPost?.id,
    user_id: groupPost?.user_id,

    content: groupPost?.content || "",
    visibility: groupPost?.visibility || "public",

    media_url: groupPost?.media_url || "",
    media_urls: safeArray(groupPost?.media_urls),
    media_types: safeArray(groupPost?.media_types),

    comments_count: safeNumber(groupPost?.comments_count, 0),
    reactions_count: safeNumber(groupPost?.reactions_count, 0),
    my_reaction: groupPost?.my_reaction ?? null,

    group_id: groupPost?.group_id ?? group?.id ?? null,
    group_name: groupPost?.group_name || group?.name || "Group",
    group_image: groupPost?.group_image || group?.profile_image || null,

    type: "group_post",
    kind: "group_post",
    meta: {
      kind: "group_post",
      group_post_id: groupPost?.id,
      group_id: groupPost?.group_id ?? group?.id ?? null,
    },
  });
};

/**
 * Product -> feed item
 * Useful if you ever need frontend-side product injection too
 */
export const makeProductFeedItem = (product: any, seller?: any) => {
  const images = safeArray(product?.images);

  return makeBaseFeedItem({
    id: product?.id,
    feed_key: `product:${product?.id}`,
    source: "product",
    item_type: "product",

    product_id2: product?.id,
    user_id: product?.seller_id,
    username: seller?.username || "",
    name: seller?.name || "Seller",
    profile_image_url: seller?.profile_image_url || "",

    content: product?.title || "",
    visibility: "public",

    media_urls: images,
    media_types: images.map(() => "image"),

    comments_count: 0,
    reactions_count: 0,

    type: "marketplace",
    post_type: "product",
    kind: "product",
    meta: {
      kind: "product",
      product_id: product?.id,
      marketplace: {
        id: product?.id,
        product_id: product?.id,
        title: product?.title || "",
        price: product?.discount_price ?? product?.main_price ?? null,
        currency: product?.currency_symbol || "TZS",
        location: product?.address || "",
        images,
      },
    },
  });
};

/**
 * Merge and deduplicate feed items
 */
export const mergeFeedItems = (...groups: any[][]) => {
  const map = new Map<string, any>();

  groups.flat().forEach((item) => {
    const key =
      item?.feed_key ||
      `${item?.source || item?.type || "post"}:${item?.id}`;
    if (!key) return;
    if (!map.has(key)) map.set(key, item);
  });

  return Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a?.created_at || 0).getTime();
    const tb = new Date(b?.created_at || 0).getTime();
    return tb - ta;
  });
};
