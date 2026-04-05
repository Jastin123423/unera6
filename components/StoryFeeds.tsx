import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, Story } from '../types';

// ==================== HELPER FUNCTIONS ====================
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

const getDefaultProfilePicture = (name: string, userId: number): string => {
  const colors = ['1877F2', '45BD62', 'F3425F', 'F7B928', '9360F7'];
  const color = colors[Math.abs(userId) % colors.length];
  const initials = safeText(name).slice(0, 1).toUpperCase() || 'U';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    initials
  )}&background=${color}&color=fff&size=128&font-size=0.5&bold=true&rounded=true`;
};

const buildStoryUser = (story: any): User => {
  const id = Number(story.user?.id || story.user_id || story.userId || 0);
  const name = safeText(story.user?.name || story.author_name || story.user_name || story.userName || 'User');
  const username = safeText(
    story.user?.username || story.author_username || story.username || name.toLowerCase().replace(/\s+/g, '_') || 'user'
  );
  const profile = safeText(
    story.user?.profile_image_url ||
      story.author_image ||
      story.user_profile_image ||
      story.userProfileImage ||
      ''
  );

  return {
    id,
    name,
    username,
    email: story.user?.email || '',
    profile_image_url: profile || getDefaultProfilePicture(name, id),
    cover_image_url: story.user?.cover_image_url || '',
    followers: Array.isArray(story.user?.followers) ? story.user.followers : [],
    following: Array.isArray(story.user?.following) ? story.user.following : [],
    is_verified: !!(story.user?.is_verified || story.user_is_verified),
    role: story.user?.role || 'user',
    is_online: !!story.user?.is_online,
    location: story.user?.location || '',
    bio: story.user?.bio || '',
    created_at: story.user?.created_at || null,
  } as User;
};

const groupStoriesByUser = (stories: Story[]) => {
  const map = new Map<number, { user_id: number; user: User; stories: Story[]; latest_created_at: string }>();

  for (const story of stories || []) {
    const uid = Number((story as any).user_id || (story as any).userId || 0);
    if (!uid) continue;

    if (!map.has(uid)) {
      map.set(uid, {
        user_id: uid,
        user: buildStoryUser(story),
        stories: [],
        latest_created_at: (story as any).created_at || (story as any).createdAt || '',
      });
    }

    const group = map.get(uid)!;
    group.stories.push(story);

    const storyTime = parseServerTime((story as any).created_at || (story as any).createdAt);
    const latestTime = parseServerTime(group.latest_created_at);

    if (storyTime > latestTime) {
      group.latest_created_at = (story as any).created_at || (story as any).createdAt || '';
      group.user = buildStoryUser(story);
    }
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      stories: [...group.stories].sort(
        (a: any, b: any) =>
          parseServerTime(b.created_at || b.createdAt) - parseServerTime(a.created_at || a.createdAt)
      ),
    }))
    .sort((a, b) => parseServerTime(b.latest_created_at) - parseServerTime(a.latest_created_at));
};

// ==================== MAIN STORY FEEDS COMPONENT ====================
interface StoryFeedsProps {
  initialStory: Story;
  stories: Story[];
  currentUser: User | null;
  onClose: () => void;
  onReply?: (storyId: number, text: string) => void;
  onLike?: (storyId: number) => void;
  onReaction?: (storyId: number, emoji: string) => void;
  onFollow?: (userId: number) => void;
  checkIsFollowing?: (userId: number) => boolean;
  followLoading?: { [key: number]: boolean };
  onFetchViewers?: (storyId: number) => Promise<any[]>;
  onProfileClick: (userId: number) => void;
  onDeleteStory?: (storyId: number) => void;
  deleteLoading?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
}

export const StoryFeeds: React.FC<StoryFeedsProps> = ({
  initialStory,
  stories,
  currentUser,
  onClose,
  onReply,
  onLike,
  onReaction,
  onFollow,
  checkIsFollowing,
  onFetchViewers,
  onProfileClick,
  onDeleteStory,
  deleteLoading = false,
  muted = false,
  onToggleMute = () => {},
}) => {
  const storyGroups = useMemo(() => groupStoriesByUser(stories || []), [stories]);

  const [userIndex, setUserIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const verticalTouchRef = useRef<{ x: number; y: number } | null>(null);
  const verticalNavLockRef = useRef(0);

  useEffect(() => {
    if (!storyGroups.length || !initialStory) return;

    let foundUserIndex = storyGroups.findIndex(
      (g) => Number(g.user_id) === Number((initialStory as any).user_id || (initialStory as any).userId)
    );
    if (foundUserIndex < 0) foundUserIndex = 0;

    const targetGroup = storyGroups[foundUserIndex];
    let foundStoryIndex = targetGroup?.stories?.findIndex(
      (s: any) => Number(s.id) === Number((initialStory as any).id)
    );
    if (foundStoryIndex < 0) foundStoryIndex = 0;

    setUserIndex(foundUserIndex);
    setStoryIndex(foundStoryIndex);
  }, [storyGroups, initialStory]);

  const activeGroup = storyGroups[userIndex] || null;
  const activeStory = activeGroup?.stories?.[storyIndex] ||
    storyGroups.find((g) => Number(g.user_id) === Number((initialStory as any).user_id || (initialStory as any).userId))
      ?.stories?.find((s: any) => Number(s.id) === Number((initialStory as any).id)) ||
    initialStory;

  const activeUser = activeGroup?.user || buildStoryUser(activeStory);
  const safeAllStories = activeGroup?.stories?.length ? activeGroup.stories : [activeStory];

  const canVerticalNavigate = () => {
    const now = Date.now();
    if (now - verticalNavLockRef.current < 450) return false;
    verticalNavLockRef.current = now;
    return true;
  };

  const goToNextStory = useCallback(() => {
    const group = storyGroups[userIndex];
    if (!group) {
      onClose();
      return;
    }

    const isLastStory = storyIndex >= group.stories.length - 1;
    if (!isLastStory) {
      setStoryIndex((prev) => prev + 1);
      return;
    }

    const isLastUser = userIndex >= storyGroups.length - 1;
    if (isLastUser) {
      onClose();
      return;
    }

    setUserIndex((prev) => prev + 1);
    setStoryIndex(0);
  }, [storyGroups, userIndex, storyIndex, onClose]);

  const goToPrevStory = useCallback(() => {
    const group = storyGroups[userIndex];
    if (!group) {
      onClose();
      return;
    }

    const isFirstStory = storyIndex <= 0;
    if (!isFirstStory) {
      setStoryIndex((prev) => prev - 1);
      return;
    }

    const isFirstUser = userIndex <= 0;
    if (isFirstUser) {
      onClose();
      return;
    }

    const prevUserIndex = userIndex - 1;
    const prevGroup = storyGroups[prevUserIndex];
    const lastStoryIndex = Math.max(0, (prevGroup?.stories?.length || 1) - 1);

    setUserIndex(prevUserIndex);
    setStoryIndex(lastStoryIndex);
  }, [storyGroups, userIndex, storyIndex, onClose]);

  const goToNextUser = useCallback(() => {
    if (!canVerticalNavigate()) return;
    if (userIndex >= storyGroups.length - 1) return;
    setUserIndex((prev) => prev + 1);
    setStoryIndex(0);
  }, [userIndex, storyGroups.length]);

  const goToPrevUser = useCallback(() => {
    if (!canVerticalNavigate()) return;
    if (userIndex <= 0) return;
    setUserIndex((prev) => prev - 1);
    setStoryIndex(0);
  }, [userIndex]);

  const handleVerticalTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    verticalTouchRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleVerticalTouchEnd = (e: React.TouchEvent) => {
    if (!verticalTouchRef.current) return;
    
    const t = e.changedTouches[0];
    const dx = t.clientX - verticalTouchRef.current.x;
    const dy = t.clientY - verticalTouchRef.current.y;
    verticalTouchRef.current = null;
    
    if (Math.abs(dy) < 50 || Math.abs(dy) <= Math.abs(dx)) return;
    
    if (dy < 0) goToNextUser();
    else goToPrevUser();
  };

  if (!activeStory) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading story...</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-[#1877F2] rounded-full text-white text-sm font-bold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // ✅ TEMPORARY TEST SCREEN - Bypass StoryViewer completely
  return (
    <div className="fixed inset-0 z-[99999] bg-white text-black p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">StoryFeeds Test Screen</h1>
        <button onClick={onClose} className="px-4 py-2 rounded bg-black text-white">
          Back
        </button>
      </div>
      
      <div className="space-y-2 text-sm">
        <div><b>stories length:</b> {String(stories?.length || 0)}</div>
        <div><b>groups length:</b> {String(storyGroups?.length || 0)}</div>
        <div><b>userIndex:</b> {String(userIndex)}</div>
        <div><b>storyIndex:</b> {String(storyIndex)}</div>
        <div><b>initialStory id:</b> {String((initialStory as any)?.id || 'none')}</div>
        <div><b>initialStory user_id:</b> {String((initialStory as any)?.user_id || 'none')}</div>
        <div><b>activeGroup user_id:</b> {String(activeGroup?.user_id || 'none')}</div>
        <div><b>activeStory id:</b> {String((activeStory as any)?.id || 'none')}</div>
        <div><b>activeStory type:</b> {String((activeStory as any)?.type || 'none')}</div>
        <div><b>activeStory full:</b> {String((activeStory as any)?.full || 'none')}</div>
        <div><b>activeStory feed:</b> {String((activeStory as any)?.feed || 'none')}</div>
        <div><b>activeStory thumb:</b> {String((activeStory as any)?.thumb || 'none')}</div>
        <div><b>activeStory media_url:</b> {String((activeStory as any)?.media_url || 'none')}</div>
        <div><b>activeUser id:</b> {String((activeUser as any)?.id || 'none')}</div>
        <div><b>activeUser name:</b> {String((activeUser as any)?.name || 'none')}</div>
      </div>
      
      <div className="mt-6 p-3 border border-black">
        <div className="font-bold mb-2">Raw activeStory</div>
        <pre className="text-xs whitespace-pre-wrap break-words">
          {JSON.stringify(activeStory, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default StoryFeeds;
