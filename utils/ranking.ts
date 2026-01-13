
import { Post, User } from '../types';

/**
 * =======================================================
 * UNERA: FAIR, VIRAL, ANTI-MONOPOLY FEED ALGORITHM
 * =======================================================
 * This algorithm calculates a Dynamic Visibility Score (DVS) for each post
 * to create a feed that promotes growth, creator happiness, and discovery.
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
            viral: number;
            velocity: number;
            followerInfluence: number;
        };
        reason: string;
    };
}

const CONSTANTS = {
    WEIGHT_FRESHNESS: 1.0,
    WEIGHT_ENGAGEMENT: 1.5,
    WEIGHT_AFFINITY: 2.0,
    WEIGHT_INTEREST: 0.8,
    VAL_LIKE: 0.5,
    VAL_COMMENT: 2.0,
    VAL_REPOST: 3.0,
    VAL_SAVE: 4.0,
    VAL_WATCH_TIME_SCORE: 5.0,
    DECAY_LAMBDA: 0.05, 
    NEW_USER_BOOST_MULTIPLIER: 1.5,
    NEW_USER_DAYS_THRESHOLD: 30,
    SMALL_CREATOR_FOLLOWER_THRESHOLD: 1000,
    VIRAL_ENGAGEMENT_THRESHOLD: 50,
    VIRAL_MULTIPLIER: 1.3,
    VELOCITY_HOURS_THRESHOLD: 3,
    VELOCITY_ENGAGEMENT_THRESHOLD: 10,
    VELOCITY_MULTIPLIER: 1.4,
};

const calculatePostScore = (post: Post, viewer: User | null, author: User): ScoredPost['debug'] & { score: number } => {
    const now = Date.now();
    const postTime = post.created_at ? new Date(post.created_at).getTime() : now;
    const hoursSinceCreation = Math.max(0, (now - postTime) / (1000 * 60 * 60));

    const freshnessScore = Math.exp(-CONSTANTS.DECAY_LAMBDA * hoursSinceCreation);

    const rawEngagementValue = 
        (post.reactions.length * CONSTANTS.VAL_LIKE) + 
        (post.comments.length * CONSTANTS.VAL_COMMENT) + 
        (post.shares * CONSTANTS.VAL_REPOST) +
        ((post.views || 0) * (CONSTANTS.VAL_WATCH_TIME_SCORE / 100));

    let viralMultiplier = 1.0;
    if (rawEngagementValue > CONSTANTS.VIRAL_ENGAGEMENT_THRESHOLD) {
        viralMultiplier = CONSTANTS.VIRAL_MULTIPLIER;
    }

    let velocityMultiplier = 1.0;
    if (hoursSinceCreation < CONSTANTS.VELOCITY_HOURS_THRESHOLD && rawEngagementValue > CONSTANTS.VELOCITY_ENGAGEMENT_THRESHOLD) {
        velocityMultiplier = CONSTANTS.VELOCITY_MULTIPLIER;
    }
    const engagementScore = rawEngagementValue * viralMultiplier * velocityMultiplier;

    let affinityScore = 1.0;
    if (viewer && viewer.id !== author.id) {
        const isFollowing = viewer.following.includes(author.id);
        if (isFollowing && author.followers.includes(viewer.id)) {
            affinityScore = 2.0;
        } else if (isFollowing) {
            affinityScore = 1.5;
        }
    }

    let interestScore = 0;
    if (viewer?.interests && post.tags) {
        const matches = post.tags.filter(tag => viewer.interests?.includes(tag.toLowerCase())).length;
        interestScore = matches * 0.5;
    }

    const baseScore = 
        (freshnessScore * CONSTANTS.WEIGHT_FRESHNESS) +
        (engagementScore * CONSTANTS.WEIGHT_ENGAGEMENT) +
        (affinityScore * CONSTANTS.WEIGHT_AFFINITY) +
        (interestScore * CONSTANTS.WEIGHT_INTEREST);

    let creatorBoost = 1.0;
    const daysOnPlatform = author.created_at ? (now - new Date(author.created_at).getTime()) / (1000 * 60 * 60 * 24) : 999;
    if (daysOnPlatform < CONSTANTS.NEW_USER_DAYS_THRESHOLD) {
        creatorBoost = CONSTANTS.NEW_USER_BOOST_MULTIPLIER;
    }
    
    const followerInfluence = 1 / Math.log10(author.followers.length + 10);
    const finalCreatorBoost = creatorBoost * followerInfluence;
    
    const finalScore = baseScore * finalCreatorBoost + (Math.random() * 0.1);

    let reason = "Standard Rank.";
    if (creatorBoost > 1.0) reason = "New User Boost.";
    else if (viralMultiplier > 1.0) reason = "High Engagement (Viral).";
    else if (velocityMultiplier > 1.0) reason = "Trending (High Velocity).";
    else if (affinityScore > 1.5) reason = "Mutual Follow.";
    else if (affinityScore > 1.0) reason = "You Follow Them.";

    return {
        score: finalScore,
        baseScore: baseScore,
        finalScore: finalScore,
        freshness: freshnessScore,
        engagement: engagementScore,
        affinity: affinityScore,
        interest: interestScore,
        boosts: {
            newUser: creatorBoost,
            viral: viralMultiplier,
            velocity: velocityMultiplier,
            followerInfluence: followerInfluence,
        },
        reason: reason
    };
};

export const rankFeed = (posts: Post[], viewer: User | null, users: User[]): Post[] => {
    const userMap = new Map<number, User>();
    users.forEach(u => userMap.set(u.id, u));
    
    const authorSeenCount = new Map<number, number>();

    const scoredPosts: ScoredPost[] = posts
        .map(post => {
            const author = userMap.get(post.user_id);
            if (!author) return null;

            const { score, ...debugInfo } = calculatePostScore(post, viewer, author);
            return { post, score, debug: debugInfo };
        })
        .filter((p): p is ScoredPost => p !== null)
        .sort((a, b) => b.score - a.score)
        .map(sp => {
            const authorId = sp.post.user_id;
            const timesSeen = authorSeenCount.get(authorId) || 0;
            const diversityBoost = 1 / (1 + timesSeen);
            sp.score *= diversityBoost;
            sp.debug.reason += ` Diversity factor: ${diversityBoost.toFixed(2)}.`;
            authorSeenCount.set(authorId, timesSeen + 1);
            return sp;
        });

    scoredPosts.sort((a, b) => b.score - a.score);

    console.group("--- UNERA Feed Ranking ---");
    scoredPosts.slice(0, 5).forEach((sp, index) => {
        console.log(
            `#${index + 1}: Post ${sp.post.id} (Score: ${sp.score.toFixed(4)}) - Reason: ${sp.debug.reason}`,
            { postContent: (sp.post.content || "").substring(0, 50), debug: sp.debug }
        );
    });
    console.groupEnd();

    return scoredPosts.map(sp => sp.post);
};
