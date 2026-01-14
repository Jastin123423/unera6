
import { Post, User } from '../types';

/**
 * =======================================================
 * UNERA: SIMPLE "GROWTH" FEED ALGORITHM (EARLY-STAGE)
 * - Favors new + small creators so everyone can get seen
 * - Still rewards freshness + engagement
 * - Adds exploration slots (discover new creators)
 * - Enforces diversity rules (no monopoly)
 * =======================================================
 */

interface ScoredPost {
  post: Post;
  score: number;
  debug: {
    baseScore: number;
    finalScore: number;
    freshness: number;
    engagement: number;
    affinity: number;
    interest: number;
    boosts: {
      newUser: number;
      smallCreator: number;
      viral: number;
      velocity: number;
    };
    reason: string;
  };
}

const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Deterministic pseudo-random number from an integer seed (0..1)
 * So feed doesn't reshuffle wildly every render.
 */
const seededRand01 = (seed: number) => {
  // xorshift32-ish
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  // convert to [0,1)
  return ((x >>> 0) % 1_000_000) / 1_000_000;
};

const CONSTANTS = {
  // Main weights (keep it simple)
  WEIGHT_FRESHNESS: 1.2,
  WEIGHT_ENGAGEMENT: 1.1,
  WEIGHT_AFFINITY: 1.0,
  WEIGHT_INTEREST: 0.3,

  // Engagement values
  VAL_LIKE: 0.4,
  VAL_COMMENT: 2.0,
  VAL_REPOST: 3.0,
  // views are a weak signal early (avoid overpower)
  VAL_VIEW: 0.02,

  // Freshness decay (hours)
  DECAY_LAMBDA: 0.06,

  // New user boost
  NEW_USER_DAYS_THRESHOLD: 30,
  NEW_USER_BOOST_MULTIPLIER: 1.6,

  // Small creator boost tiers (EARLY-STAGE = strong)
  SMALL_CREATOR_FOLLOWERS_TIER1: 200,
  SMALL_CREATOR_FOLLOWERS_TIER2: 1000,
  SMALL_CREATOR_BOOST_TIER1: 2.2,
  SMALL_CREATOR_BOOST_TIER2: 1.6,

  // Viral + velocity
  VIRAL_ENGAGEMENT_THRESHOLD: 25,
  VIRAL_MULTIPLIER: 1.25,
  VELOCITY_HOURS_THRESHOLD: 3,
  VELOCITY_ENGAGEMENT_THRESHOLD: 8,
  VELOCITY_MULTIPLIER: 1.35,

  // Feed mixing / fairness rules
  TOP_WINDOW: 20,
  MAX_PER_AUTHOR_IN_TOP_WINDOW: 2,
  NO_BACK_TO_BACK_AUTHOR: true,

  // Exploration slots: % of the feed should be "discover"
  // (posts from authors the viewer does NOT follow)
  EXPLORE_RATIO: 0.2,
};

/**
 * Score a post for a viewer.
 * NOTE: assumes author exists.
 */
const calculatePostScore = (
  post: Post,
  viewer: User | null,
  author: User
): ScoredPost['debug'] & { score: number } => {
  const now = Date.now();
  const postTime = post.created_at ? new Date(post.created_at as any).getTime() : now;
  const hoursSinceCreation = Math.max(0, (now - postTime) / (1000 * 60 * 60));

  // 1) Freshness (0..1)
  const freshnessScore = Math.exp(-CONSTANTS.DECAY_LAMBDA * hoursSinceCreation);

  // 2) Engagement (use LOG scaling so it doesn't dominate)
  const reactionsCount = safeArray((post as any).reactions).length;
  const commentsCount = safeArray((post as any).comments).length;

  const rawEngagementValue =
    reactionsCount * CONSTANTS.VAL_LIKE +
    commentsCount * CONSTANTS.VAL_COMMENT +
    safeNumber((post as any).shares) * CONSTANTS.VAL_REPOST +
    safeNumber((post as any).views) * CONSTANTS.VAL_VIEW;

  let viralMultiplier = 1.0;
  if (rawEngagementValue >= CONSTANTS.VIRAL_ENGAGEMENT_THRESHOLD) {
    viralMultiplier = CONSTANTS.VIRAL_MULTIPLIER;
  }

  let velocityMultiplier = 1.0;
  if (
    hoursSinceCreation <= CONSTANTS.VELOCITY_HOURS_THRESHOLD &&
    rawEngagementValue >= CONSTANTS.VELOCITY_ENGAGEMENT_THRESHOLD
  ) {
    velocityMultiplier = CONSTANTS.VELOCITY_MULTIPLIER;
  }

  const scaledEngagement = Math.log1p(rawEngagementValue); // ✅ prevents monopoly by huge posts
  const engagementScore = scaledEngagement * viralMultiplier * velocityMultiplier;

  // 3) Affinity (simple + safe)
  let affinityScore = 1.0;
  if (viewer && safeNumber(viewer.id) && safeNumber(author.id) && viewer.id !== author.id) {
    const viewerFollowing = safeArray<number>((viewer as any).following);
    const authorFollowers = safeArray<number>((author as any).followers);
    const isFollowing = viewerFollowing.includes(author.id);
    const isMutual = isFollowing && authorFollowers.includes(viewer.id);

    if (isMutual) affinityScore = 1.6;
    else if (isFollowing) affinityScore = 1.25;
  }

  // 4) Interest (optional: tags overlap)
  let interestScore = 0;
  const viewerInterests = safeArray<string>((viewer as any)?.interests).map((x) => String(x).toLowerCase());
  const postTags = safeArray<string>((post as any)?.tags).map((x) => String(x).toLowerCase());
  if (viewerInterests.length && postTags.length) {
    const matches = postTags.filter((tag) => viewerInterests.includes(tag)).length;
    interestScore = matches * 0.5;
  }

  // Base score (combine normalized-ish factors)
  const baseScore =
    freshnessScore * CONSTANTS.WEIGHT_FRESHNESS +
    engagementScore * CONSTANTS.WEIGHT_ENGAGEMENT +
    affinityScore * CONSTANTS.WEIGHT_AFFINITY +
    interestScore * CONSTANTS.WEIGHT_INTEREST;

  // 5) Creator fairness boost (early-stage growth)
  const authorCreatedAt = (author as any).created_at ? new Date((author as any).created_at).getTime() : 0;
  const daysOnPlatform = authorCreatedAt ? (now - authorCreatedAt) / (1000 * 60 * 60 * 24) : 999;

  const newUserBoost =
    daysOnPlatform <= CONSTANTS.NEW_USER_DAYS_THRESHOLD ? CONSTANTS.NEW_USER_BOOST_MULTIPLIER : 1.0;

  const followerCount = safeArray<number>((author as any).followers).length;

  const smallCreatorBoost =
    followerCount < CONSTANTS.SMALL_CREATOR_FOLLOWERS_TIER1
      ? CONSTANTS.SMALL_CREATOR_BOOST_TIER1
      : followerCount < CONSTANTS.SMALL_CREATOR_FOLLOWERS_TIER2
      ? CONSTANTS.SMALL_CREATOR_BOOST_TIER2
      : 1.0;

  const finalBoost = newUserBoost * smallCreatorBoost;

  // 6) Tiny deterministic jitter to break ties (stable)
  const seed = safeNumber((post as any).id) * 997 + safeNumber((author as any).id) * 131;
  const jitter = seededRand01(seed) * 0.05;

  const finalScore = baseScore * finalBoost + jitter;

  let reason = 'Standard Rank.';
  if (newUserBoost > 1.0 && smallCreatorBoost > 1.0) reason = 'New + Small Creator Boost.';
  else if (newUserBoost > 1.0) reason = 'New User Boost.';
  else if (smallCreatorBoost > 1.0) reason = 'Small Creator Boost.';
  else if (velocityMultiplier > 1.0) reason = 'Trending (High Velocity).';
  else if (viralMultiplier > 1.0) reason = 'High Engagement (Viral).';
  else if (affinityScore > 1.25) reason = 'You Follow Them.';

  return {
    score: finalScore,
    baseScore,
    finalScore,
    freshness: freshnessScore,
    engagement: engagementScore,
    affinity: affinityScore,
    interest: interestScore,
    boosts: {
      newUser: newUserBoost,
      smallCreator: smallCreatorBoost,
      viral: viralMultiplier,
      velocity: velocityMultiplier,
    },
    reason,
  };
};

/**
 * Build a fair feed list with constraints:
 * - no back-to-back same author (optional)
 * - max N posts per author in the top window
 */
const applyDiversityConstraints = (
  scored: { post: Post; score: number }[],
  topWindow: number,
  maxPerAuthor: number,
  noBackToBack: boolean
) => {
  const result: { post: Post; score: number }[] = [];
  const authorCount = new Map<number, number>();

  const getAuthorId = (p: Post) => safeNumber((p as any).user_id);

  for (const item of scored) {
    const authorId = getAuthorId(item.post);
    const lastAuthorId = result.length ? getAuthorId(result[result.length - 1].post) : -1;

    const inTopWindow = result.length < topWindow;
    const seen = authorCount.get(authorId) || 0;

    if (inTopWindow) {
      if (seen >= maxPerAuthor) continue;
      if (noBackToBack && authorId === lastAuthorId) continue;
    } else {
      // outside top window, only enforce no-back-to-back (soft)
      if (noBackToBack && authorId === lastAuthorId) continue;
    }

    result.push(item);
    authorCount.set(authorId, seen + 1);
  }

  return result;
};

/**
 * Exploration mixing:
 * - Some slots are "explore": authors viewer doesn't follow
 * - Rest are "home": following + own posts
 */
const mixExploreSlots = (
  scored: { post: Post; score: number }[],
  viewer: User | null,
  exploreRatio: number
) => {
  if (!viewer) return scored; // guests: just ranked list

  const following = new Set<number>(safeArray<number>((viewer as any).following));
  const meId = safeNumber((viewer as any).id);

  const isFollowedOrSelf = (p: Post) => {
    const authorId = safeNumber((p as any).user_id);
    return authorId === meId || following.has(authorId);
  };

  const home = scored.filter((x) => isFollowedOrSelf(x.post));
  const explore = scored.filter((x) => !isFollowedOrSelf(x.post));

  if (!home.length) return scored; // nothing special
  if (!explore.length) return scored;

  const targetExplore = Math.max(1, Math.round(scored.length * exploreRatio));

  const out: { post: Post; score: number }[] = [];
  let hi = 0;
  let ei = 0;

  // Simple interleave: every N items drop an explore item
  const interval = Math.max(3, Math.floor(scored.length / targetExplore));

  while (out.length < scored.length && (hi < home.length || ei < explore.length)) {
    const shouldExplore = out.length > 0 && out.length % interval === 0 && ei < explore.length;

    if (shouldExplore) {
      out.push(explore[ei++]);
    } else if (hi < home.length) {
      out.push(home[hi++]);
    } else if (ei < explore.length) {
      out.push(explore[ei++]);
    } else {
      break;
    }
  }

  return out;
};

export const rankFeed = (posts: Post[], viewer: User | null, users: User[]): Post[] => {
  if (!Array.isArray(posts) || posts.length === 0) return [];

  // Map users for author lookup
  const userMap = new Map<number, User>();
  if (Array.isArray(users)) {
    users.forEach((u: any) => {
      const id = safeNumber(u?.id ?? u?.user_id ?? u?.userId);
      if (id) userMap.set(id, u);
    });
  }

  // Score posts
  const scored = posts
    .map((post) => {
      const authorId = safeNumber((post as any).user_id);
      const author = userMap.get(authorId);
      if (!author) return null;

      const debug = calculatePostScore(post, viewer, author);
      return { post, score: debug.score, debug };
    })
    .filter(Boolean) as ScoredPost[];

  // Sort by score (desc)
  scored.sort((a, b) => b.score - a.score);

  // Mix explore slots (discover new creators)
  const mixed = mixExploreSlots(
    scored.map((x) => ({ post: x.post, score: x.score })),
    viewer,
    CONSTANTS.EXPLORE_RATIO
  );

  // Enforce diversity constraints
  const constrained = applyDiversityConstraints(
    mixed,
    CONSTANTS.TOP_WINDOW,
    CONSTANTS.MAX_PER_AUTHOR_IN_TOP_WINDOW,
    CONSTANTS.NO_BACK_TO_BACK_AUTHOR
  );

  // Return posts
  return constrained.map((x) => x.post);
};
