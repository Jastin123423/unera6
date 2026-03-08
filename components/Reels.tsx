// components/Reels/ReelsFeed.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Reel, User, Song } from '../types';

type ReelSound = {
  songName: string;
  audioUrl: string;
  audioStart?: number;
  audioEnd?: number;
  songId?: string | number;
  soundKey?: string;
  isTrimmedAudio?: boolean;
  originalUrl?: string;
};

interface ReelsFeedProps {
  reels: Reel[];
  users: User[];
  currentUser: User | null;
  songs: Song[];
  selectedSound: ReelSound | null;
  onPickSound: (sound: ReelSound | null) => void;
  onProfileClick: (userId: number) => void;
  onCreateReelClick: () => void;
  onReact: (reelId: number, type?: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry') => void;
  onComment: (reelId: number, text: string) => void;
  onShare: (reelId: number, type: 'feed' | 'copy') => void;
  onFollow: (userId: number) => void;
  onUseSound: (sound: any) => void;
  checkIsFollowing: (userId: number) => boolean;
  followLoading: Record<number, boolean>;
  initialReelId?: number | string | null;
  onBack?: () => void;
}

const formatCount = (num?: number): string => {
  const n = Number(num || 0);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(n);
};

const formatTime = (seconds: number): string => {
  const s = Number.isFinite(seconds) ? seconds : 0;
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

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
  onShare,
  onFollow,
  onUseSound,
  checkIsFollowing,
  followLoading,
  initialReelId,
  onBack,
}) => {
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showSoundInfo, setShowSoundInfo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [sharesCount, setSharesCount] = useState(0);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const reelItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const didInitialJumpRef = useRef(false);

  // Get author from users list
  const getAuthor = useCallback((reel: Reel) => {
    const authorId = reel.userId || reel.user_id;
    const found = users.find((u) => Number(u.id) === Number(authorId));
    
    if (found) return found;
    
    // Fallback author
    return {
      id: authorId,
      name: reel.author || reel.author_name || 'User',
      username: 'user',
      profile_image_url: reel.avatar || '',
      is_verified: reel.verified || false,
    } as User;
  }, [users]);

  // Find requested reel from initialReelId
  useEffect(() => {
    if (!reels.length || initialReelId == null) return;

    const targetIndex = reels.findIndex(
      (r) => Number(r.id) === Number(initialReelId)
    );

    if (targetIndex >= 0) {
      setActiveReelIndex(targetIndex);
    }
  }, [initialReelId, reels]);

  // Scroll to selected reel once elements exist
  useEffect(() => {
    if (!reels.length) return;
    if (didInitialJumpRef.current) return;

    let targetIndex = 0;
    if (initialReelId != null) {
      const found = reels.findIndex((r) => Number(r.id) === Number(initialReelId));
      if (found >= 0) targetIndex = found;
    }

    const scrollToReel = () => {
      const el = reelItemRefs.current[targetIndex];
      if (el) {
        didInitialJumpRef.current = true;
        setActiveReelIndex(targetIndex);

        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          el.scrollIntoView({ block: 'start', behavior: 'auto' });
        });
      } else {
        // Retry after a short delay if element not found
        setTimeout(scrollToReel, 100);
      }
    };

    scrollToReel();
  }, [reels, initialReelId]);

  // Setup intersection observer for all videos
  useEffect(() => {
    if (!reels.length) return;

    // Clean up old observer
    observerRef.current?.disconnect();

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        let bestIndex = -1;
        let bestRatio = 0;

        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          const index = videoRefs.current.findIndex((ref) => ref === video);
          if (index < 0) return;

          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestIndex = index;
          }
        });

        if (bestIndex >= 0 && bestRatio >= 0.6) {
          setActiveReelIndex((prev) => (prev === bestIndex ? prev : bestIndex));
        }
      },
      {
        threshold: [0.25, 0.5, 0.6, 0.75, 0.9],
      }
    );

    // Observe all videos
    videoRefs.current.forEach((video) => {
      if (video) observerRef.current?.observe(video);
    });

    return () => observerRef.current?.disconnect();
  }, [reels]);

  // Play/pause based on active index
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;

      if (i === activeReelIndex) {
        video.currentTime = video.currentTime || 0;
        video.play()
          .then(()
