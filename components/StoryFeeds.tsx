// StoryFeeds.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  StoryViewer,
  StoryType,
  User,
  StoryViewer as StoryViewerType,
} from './Story';

// -------------------- HELPERS --------------------
const safeText = (v: any): string => String(v ?? '').trim();

const parseServerTime = (value?: string): number => {
  const s = String(value ?? '').trim();
  if (!s) return Date.now();

  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : Date.now();
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    const iso = s.replace(' ', 'T') + 'Z';
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : Date.now();
  }

  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Date.now();
};

const pickBestName = (...vals: any[]): string => {
  for (const v of vals) {
    const s = safeText(v);
    if (s && s.toLowerCase() !== 'user' && s.toLowerCase() !== 'unknown') return s;
  }
  return 'User';
};

const pickBestImage = (...vals: any[]): string => {
  for (const v of vals) {
    const s = safeText(v);
    if (s && s !== 'null' && s !== 'undefined') return s;
  }
  return '';
};

const getDefaultProfilePicture = (name: string, userId: number): string => {
  const colors = ['1877F2', '45BD62', 'F3425F', 'F7B928', '9360F7'];
  const color = colors[Math.abs(userId) % colors.length];
  const initials = safeText(name).slice(0, 1).toUpperCase() || 'U';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    initials
  )}&background=${color}&color=fff&size=128&font-size=0.5&bold=true&rounded=true`;
};

const buildStoryUser = (story: StoryType): User => {
  const uid = Number(story.user?.id ?? story.user_id ?? 0);
  const name = pickBestName(
    story.user?.name,
    (story as any).author_name,
    (story as any).username,
    'User'
  );

  const username = pickBestName(
    story.user?.username,
    (story as any).author_name,
    name.toLowerCase().replace(/\s+/g, '_')
  );

  const profile_image_url =
    pickBestImage(
      story.user?.profile_image_url,
      (story as any).author_image
    ) || getDefaultProfilePicture(name, uid);

  return {
    id: uid,
    username,
    name,
    email: story.user?.email || '',
    profile_image_url,
    cover_image_url: story.user?.cover_image_url || '',
    followers: Array.isArray(story.user?.followers) ? story.user!.followers : [],
    following: Array.isArray(story.user?.following) ? story.user!.following : [],
    is_verified: !!story.user?.is_verified,
    role: story.user?.role || 'user',
    is_online: !!story.user?.is_online,
    location: story.user?.location || '',
    bio: story.user?.bio || '',
    created_at: story.user?.created_at || null,
  };
};

// -------------------- TYPES --------------------
export interface StoryGroup {
  user_id: number;
  user: User;
  stories: StoryType[];
  latest_created_at: string;
}

interface StoryFeedsProps {
  stories: StoryType[];
  initialStory: StoryType;
  currentUser: User | null;
  onClose: () => void;
  onProfileClick: (id: number) => void;

  onReply?: (storyId: number, text: string) => void;
  onLike?: (storyId: number) => void;
  onReaction?: (storyId: number, reaction: string) => void;

  onFollow?: (userId: number) => void;
  checkIsFollowing?: (userId: number) => boolean;
  followLoading?: { [key: number]: boolean };

  onFetchViewers?: (storyId: number) => Promise<StoryViewerType[]>;
  muted?: boolean;
  onToggleMute?: () => void;

  onDeleteStory?: (storyId: number) => Promise<void> | void;
  deleteLoading?: boolean;
}

// -------------------- GROUPING --------------------
const groupStoriesByUser = (stories: StoryType[]): StoryGroup[] => {
  const map = new Map<number, StoryGroup>();

  for (const story of stories || []) {
    const uid = Number(story.user_id);
    if (!uid) continue;

    const user = buildStoryUser(story);

    if (!map.has(uid)) {
      map.set(uid, {
        user_id: uid,
        user,
        stories: [],
        latest_created_at: story.created_at,
      });
    }

    const group = map.get(uid)!;
    group.stories.push(story);

    if (parseServerTime(story.created_at) > parseServerTime(group.latest_created_at)) {
      group.latest_created_at = story.created_at;
    }
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      stories: [...group.stories].sort(
        (a, b) => parseServerTime(b.created_at) - parseServerTime(a.created_at)
      ),
    }))
    .sort(
      (a, b) => parseServerTime(b.latest_created_at) - parseServerTime(a.latest_created_at)
    );
};

// -------------------- COMPONENT --------------------
const StoryFeeds: React.FC<StoryFeedsProps> = ({
  stories,
  initialStory,
  currentUser,
  onClose,
  onProfileClick,
  onReply,
  onLike,
  onReaction,
  onFollow,
  checkIsFollowing,
  onFetchViewers,
  muted = true,
  onToggleMute,
  onDeleteStory,
  deleteLoading = false,
}) => {
  const storyGroups = useMemo(() => groupStoriesByUser(stories), [stories]);

  const [userIndex, setUserIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const navLockRef = useRef(0);

  const activeGroup = storyGroups[userIndex];
  const activeStory = activeGroup?.stories?.[storyIndex] || null;

  // -------------------- INITIAL POSITION --------------------
  useEffect(() => {
    if (!storyGroups.length || !initialStory) return;

    const foundUserIndex = storyGroups.findIndex(
      (g) => Number(g.user_id) === Number(initialStory.user_id)
    );

    const uIndex = foundUserIndex >= 0 ? foundUserIndex : 0;
    setUserIndex(uIndex);

    const foundStoryIndex = storyGroups[uIndex]?.stories?.findIndex(
      (s) => Number(s.id) === Number(initialStory.id)
    );

    setStoryIndex(foundStoryIndex >= 0 ? foundStoryIndex : 0);
  }, [storyGroups, initialStory]);

  // -------------------- NAV LOCK --------------------
  const canNavigate = () => {
    const now = Date.now();
    if (now - navLockRef.current < 450) return false;
    navLockRef.current = now;
    return true;
  };

  // -------------------- HORIZONTAL: SAME USER --------------------
  const goNextStory = useCallback(() => {
    if (!activeGroup || !canNavigate()) return;

    if (storyIndex < activeGroup.stories.length - 1) {
      setStoryIndex((prev) => prev + 1);
      return;
    }

    if (userIndex < storyGroups.length - 1) {
      setUserIndex((prev) => prev + 1);
      setStoryIndex(0);
      return;
    }

    onClose();
  }, [activeGroup, storyIndex, userIndex, storyGroups.length, onClose]);

  const goPrevStory = useCallback(() => {
    if (!activeGroup || !canNavigate()) return;

    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      return;
    }

    if (userIndex > 0) {
      const prevUserIndex = userIndex - 1;
      const prevGroup = storyGroups[prevUserIndex];
      setUserIndex(prevUserIndex);
      setStoryIndex(Math.max(0, prevGroup.stories.length - 1));
      return;
    }

    onClose();
  }, [activeGroup, storyIndex, userIndex, storyGroups, onClose]);

  // -------------------- VERTICAL: OTHER USER --------------------
  const goNextUser = useCallback(() => {
    if (!canNavigate()) return;
    if (userIndex < storyGroups.length - 1) {
      setUserIndex((prev) => prev + 1);
      setStoryIndex(0);
    }
  }, [userIndex, storyGroups.length]);

  const goPrevUser = useCallback(() => {
    if (!canNavigate()) return;
    if (userIndex > 0) {
      setUserIndex((prev) => prev - 1);
      setStoryIndex(0);
    }
  }, [userIndex]);

  // -------------------- TOUCH --------------------
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const THRESHOLD = 45;

    touchStartRef.current = null;

    if (absX < THRESHOLD && absY < THRESHOLD) return;

    // vertical swipe -> switch user
    if (absY > absX) {
      if (dy < 0) goNextUser();
      else goPrevUser();
      return;
    }

    // horizontal swipe -> same user next/prev story
    if (dx < 0) goNextStory();
    else goPrevStory();
  };

  // -------------------- KEYBOARD --------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          goPrevUser();
          break;
        case 'ArrowDown':
          e.preventDefault();
          goNextUser();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goPrevStory();
          break;
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          goNextStory();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrevUser, goNextUser, goPrevStory, goNextStory, onClose]);

  if (!activeStory || !activeGroup) return null;

  const isFollowing =
    activeGroup.user.id && checkIsFollowing
      ? checkIsFollowing(Number(activeGroup.user.id))
      : false;

  return (
    <div
      className="fixed inset-0 z-[260] bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* vertical user indicator */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[400] flex flex-col gap-2">
        {storyGroups.map((group, idx) => (
          <button
            key={group.user_id}
            onClick={() => {
              setUserIndex(idx);
              setStoryIndex(0);
            }}
            className={`w-2.5 rounded-full transition-all ${
              idx === userIndex ? 'h-8 bg-white' : 'h-2.5 bg-white/35'
            }`}
            aria-label={`Open ${group.user.name} stories`}
          />
        ))}
      </div>

      <StoryViewer
        story={activeStory}
        user={activeGroup.user}
        currentUser={currentUser}
        onClose={onClose}
        onNext={goNextStory}
        onPrev={goPrevStory}
        onReply={onReply}
        onLike={onLike}
        onReaction={onReaction}
        onFollow={onFollow}
        isFollowing={isFollowing}
        allStories={activeGroup.stories}
        onFetchViewers={onFetchViewers}
        viewersCount={activeStory.views_count || 0}
        onProfileClick={onProfileClick}
        muted={muted}
        onToggleMute={onToggleMute}
        onDeleteStory={onDeleteStory}
        deleteLoading={deleteLoading}
      />

      {/* small hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[400] px-3 py-1.5 rounded-full bg-black/35 text-white/70 text-[11px] font-bold backdrop-blur-md">
        Swipe up/down for users • left/right for stories
      </div>
    </div>
  );
};

export default StoryFeeds;
