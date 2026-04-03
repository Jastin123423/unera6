import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { StoryViewer, type StoryType, type User, type StoryViewer as StoryViewerType } from './Story';

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
  const uid = Number((story as any).user?.id ?? story.user_id ?? 0);
  const name = pickBestName(
    (story as any).user?.name,
    (story as any).author_name,
    (story as any).author_username,
    'User'
  );

  const username = pickBestName(
    (story as any).user?.username,
    (story as any).author_username,
    name.toLowerCase().replace(/\s+/g, '_')
  );

  const profile_image_url =
    pickBestImage(
      (story as any).user?.profile_image_url,
      (story as any).author_image
    ) || getDefaultProfilePicture(name, uid);

  return {
    id: uid,
    username,
    name,
    email: '',
    profile_image_url,
    cover_image_url: '',
    followers: Array.isArray((story as any).user?.followers) ? (story as any).user.followers : [],
    following: Array.isArray((story as any).user?.following) ? (story as any).user.following : [],
    is_verified: !!(story as any).user?.is_verified,
    role: (story as any).user?.role || 'user',
    is_online: !!(story as any).user?.is_online,
    location: (story as any).user?.location || '',
    bio: (story as any).user?.bio || '',
    created_at: (story as any).user?.created_at || null,
  };
};

type StoryGroup = {
  user_id: number;
  user: User;
  stories: StoryType[];
  latest_created_at: string;
};

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

  const initialUserIndex = useMemo(() => {
    const idx = storyGroups.findIndex((g) => Number(g.user_id) === Number(initialStory.user_id));
    return idx >= 0 ? idx : 0;
  }, [storyGroups, initialStory.user_id]);

  const initialStoryIndex = useMemo(() => {
    const group = storyGroups[initialUserIndex];
    if (!group) return 0;
    const idx = group.stories.findIndex((s) => Number(s.id) === Number(initialStory.id));
    return idx >= 0 ? idx : 0;
  }, [storyGroups, initialUserIndex, initialStory.id]);

  const [userIndex, setUserIndex] = useState(initialUserIndex);
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const navLockRef = useRef(0);

  useEffect(() => {
    setUserIndex(initialUserIndex);
    setStoryIndex(initialStoryIndex);
  }, [initialUserIndex, initialStoryIndex]);

  const activeGroup = storyGroups[userIndex] || null;

  // ✅ IMPORTANT fallback prevents blank screen
  const activeStory =
    activeGroup?.stories?.[storyIndex] ||
    storyGroups.find((g) => Number(g.user_id) === Number(initialStory.user_id))?.stories?.find(
      (s) => Number(s.id) === Number(initialStory.id)
    ) ||
    initialStory;

  const activeUser = activeGroup?.user || buildStoryUser(activeStory);

  const canNavigate = () => {
    const now = Date.now();
    if (now - navLockRef.current < 450) return false;
    navLockRef.current = now;
    return true;
  };

  const goNextStory = useCallback(() => {
    if (!canNavigate()) return;

    const currentGroup = storyGroups[userIndex];
    if (!currentGroup) return;

    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex((prev) => prev + 1);
      return;
    }

    if (userIndex < storyGroups.length - 1) {
      setUserIndex((prev) => prev + 1);
      setStoryIndex(0);
      return;
    }

    onClose();
  }, [storyGroups, userIndex, storyIndex, onClose]);

  const goPrevStory = useCallback(() => {
    if (!canNavigate()) return;

    const currentGroup = storyGroups[userIndex];
    if (!currentGroup) return;

    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      return;
    }

    if (userIndex > 0) {
      const prevUserIndex = userIndex - 1;
      const prevGroup = storyGroups[prevUserIndex];
      setUserIndex(prevUserIndex);
      setStoryIndex(Math.max(0, (prevGroup?.stories?.length || 1) - 1));
      return;
    }

    onClose();
  }, [storyGroups, userIndex, storyIndex, onClose]);

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

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const THRESHOLD = 45;

    if (absX < THRESHOLD && absY < THRESHOLD) return;

    if (absY > absX) {
      if (dy < 0) goNextUser();
      else goPrevUser();
      return;
    }

    if (dx < 0) goNextStory();
    else goPrevStory();
  };

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

  const isFollowing =
    activeUser.id && checkIsFollowing ? checkIsFollowing(Number(activeUser.id)) : false;

  return (
    <div
      className="fixed inset-0 z-[260] bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {storyGroups.length > 1 && (
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
      )}

      <StoryViewer
        story={activeStory}
        user={activeUser}
        currentUser={currentUser}
        onClose={onClose}
        onNext={goNextStory}
        onPrev={goPrevStory}
        onReply={onReply}
        onLike={onLike}
        onReaction={onReaction}
        onFollow={onFollow}
        isFollowing={isFollowing}
        allStories={activeGroup?.stories || [activeStory]}
        onFetchViewers={onFetchViewers}
        viewersCount={activeStory.views_count || 0}
        onProfileClick={onProfileClick}
        muted={muted}
        onToggleMute={onToggleMute}
        onDeleteStory={onDeleteStory}
        deleteLoading={deleteLoading}
      />
    </div>
  );
};

export default StoryFeeds;
