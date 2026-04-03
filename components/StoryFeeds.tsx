import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Story } from '../types';

// ==================== HELPER FUNCTIONS ====================
const buildStoryUser = (story: any): User => {
  return {
    id: story.user_id || story.userId || 0,
    name: story.user_name || story.userName || 'User',
    username: story.username || 'user',
    profile_image_url: story.user_profile_image || story.userProfileImage || '',
    profileImage: story.user_profile_image || story.userProfileImage || '',
    is_verified: story.user_is_verified || false,
  };
};

// ==================== STORY VIEWER COMPONENT ====================
interface StoryViewerProps {
  story: Story;
  user: User;
  currentUser: User | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onReply: (storyId: number, text: string) => void;
  onLike: (storyId: number) => void;
  onReaction: (storyId: number, emoji: string) => void;
  onFollow: (userId: number) => void;
  isFollowing: (userId: number) => boolean;
  allStories: Story[];
  onFetchViewers: (storyId: number) => Promise<any[]>;
  viewersCount: number;
  onProfileClick: (userId: number) => void;
  muted: boolean;
  onToggleMute: () => void;
  onDeleteStory?: (storyId: number) => void;
  deleteLoading?: boolean;
}

const StoryViewer: React.FC<StoryViewerProps> = ({
  story,
  user,
  currentUser,
  onClose,
  onNext,
  onPrev,
  onReply,
  onLike,
  onReaction,
  onFollow,
  isFollowing,
  allStories,
  onFetchViewers,
  viewersCount,
  onProfileClick,
  muted,
  onToggleMute,
  onDeleteStory,
  deleteLoading = false,
}) => {
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [liked, setLiked] = useState(false);
  const [userReaction, setUserReaction] = useState<string | null>(null);
  
  const progressIntervalRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<any>(null);

  const isOwner = currentUser?.id === user.id;

  // Reset progress when story changes
  useEffect(() => {
    setProgress(0);
    setPaused(false);
    setLiked(false);
    setUserReaction(null);
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    startProgress();
    
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [story.id]);

  const startProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressIntervalRef.current);
          onNext();
          return 100;
        }
        return prev + 1;
      });
    }, 30);
  };

  const handlePause = () => {
    if (paused) {
      startProgress();
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
    setPaused(!paused);
  };

  const handleLike = () => {
    setLiked(!liked);
    onLike(story.id);
  };

  const handleReaction = (emoji: string) => {
    setUserReaction(emoji);
    onReaction(story.id, emoji);
    setShowReactions(false);
    
    // Auto-hide reaction after 2 seconds
    timerRef.current = setTimeout(() => {
      setUserReaction(null);
    }, 2000);
  };

  const handleReply = () => {
    if (replyText.trim()) {
      onReply(story.id, replyText);
      setReplyText('');
      setShowReplyInput(false);
    }
  };

  const loadViewers = async () => {
    if (!showViewers) {
      const data = await onFetchViewers(story.id);
      setViewers(data);
    }
    setShowViewers(!showViewers);
  };

  const handleDelete = () => {
    if (onDeleteStory && window.confirm('Delete this story?')) {
      onDeleteStory(story.id);
      onClose();
    }
  };

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-white text-2xl">
              <i className="fas fa-times"></i>
            </button>
            
            <div className="flex items-center gap-2">
              <img
                src={user.profile_image_url || user.profileImage}
                className="w-10 h-10 rounded-full object-cover border-2 border-white"
                alt=""
              />
              <div>
                <div className="flex items-center gap-2">
                  <span 
                    className="text-white font-bold text-sm cursor-pointer hover:underline"
                    onClick={() => onProfileClick(user.id)}
                  >
                    {user.name}
                  </span>
                  {user.is_verified && (
                    <i className="fas fa-check-circle text-[#1877F2] text-xs"></i>
                  )}
                </div>
                <span className="text-white/60 text-xs">
                  {new Date(story.created_at || story.createdAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isOwner && onDeleteStory && (
              <button
                onClick={() => setShowMenu(true)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <i className="fas fa-ellipsis-h text-white text-sm"></i>
              </button>
            )}
            
            <button
              onClick={onToggleMute}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
            >
              <i className={`fas ${muted ? 'fa-volume-mute' : 'fa-volume-up'} text-white text-sm`}></i>
            </button>
          </div>
        </div>
        
        {/* Progress bars */}
        <div className="flex gap-1 mt-4">
          {allStories.map((s, idx) => {
            const isCurrent = s.id === story.id;
            const isPast = allStories.findIndex(st => st.id === story.id) > idx;
            const progressValue = isCurrent ? progress : isPast ? 100 : 0;
            
            return (
              <div
                key={s.id}
                className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white rounded-full transition-all duration-100"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Content */}
      <div 
        className="flex-1 flex items-center justify-center relative"
        onClick={handlePause}
      >
        {story.media_type === 'video' ? (
          <video
            ref={videoRef}
            src={story.media_url || story.mediaUrl}
            className="max-w-full max-h-full object-contain"
            autoPlay
            muted={muted}
            playsInline
            loop={false}
          />
        ) : (
          <img
            src={story.media_url || story.mediaUrl}
            className="max-w-full max-h-full object-contain"
            alt=""
          />
        )}
        
        {/* Pause overlay */}
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <i className="fas fa-play text-white text-2xl ml-1"></i>
            </div>
          </div>
        )}
        
        {/* Reaction popup */}
        {userReaction && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-bounce">
            <span className="text-6xl drop-shadow-2xl">{userReaction}</span>
          </div>
        )}
        
        {/* Navigation arrows */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
        >
          <i className="fas fa-chevron-left text-white text-xl"></i>
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
        >
          <i className="fas fa-chevron-right text-white text-xl"></i>
        </button>
      </div>
      
      {/* Footer Actions */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/60 to-transparent">
        {story.caption && (
          <p className="text-white text-sm mb-3 max-w-[70%]">{story.caption}</p>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Reaction button */}
            <div className="relative">
              <button
                onClick={() => setShowReactions(!showReactions)}
                className="flex flex-col items-center gap-1"
              >
                {userReaction ? (
                  <span className="text-3xl">{userReaction}</span>
                ) : (
                  <i className="far fa-smile text-white text-2xl"></i>
                )}
                <span className="text-white/70 text-xs">React</span>
              </button>
              
              {showReactions && (
                <div className="absolute bottom-full left-0 mb-2 bg-[#242526] rounded-2xl p-3 border border-white/10 shadow-2xl">
                  <div className="flex gap-2">
                    {['❤️', '😂', '😮', '😢', '😡', '👍', '🔥', '🎉'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        className="text-2xl hover:scale-125 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Like button */}
            <button onClick={handleLike} className="flex flex-col items-center gap-1">
              <i className={`${liked ? 'fas' : 'far'} fa-heart text-2xl ${liked ? 'text-red-500' : 'text-white'}`}></i>
              <span className="text-white/70 text-xs">Like</span>
            </button>
            
            {/* Reply button */}
            <button 
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="flex flex-col items-center gap-1"
            >
              <i className="far fa-comment text-white text-2xl"></i>
              <span className="text-white/70 text-xs">Reply</span>
            </button>
            
            {/* Viewers button */}
            {viewersCount > 0 && (
              <button onClick={loadViewers} className="flex flex-col items-center gap-1">
                <i className="far fa-eye text-white text-2xl"></i>
                <span className="text-white/70 text-xs">{viewersCount}</span>
              </button>
            )}
            
            {/* Follow button */}
            {!isOwner && !isFollowing(user.id) && (
              <button
                onClick={() => onFollow(user.id)}
                className="px-4 py-1.5 bg-[#1877F2] rounded-full text-white text-xs font-bold"
              >
                Follow
              </button>
            )}
          </div>
        </div>
        
        {/* Reply input */}
        {showReplyInput && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Send a reply..."
              className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-white text-sm outline-none focus:border-[#1877F2]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleReply();
              }}
            />
            <button
              onClick={handleReply}
              disabled={!replyText.trim()}
              className="px-4 py-2 bg-[#1877F2] rounded-full text-white text-sm font-bold disabled:opacity-50"
            >
              Send
            </button>
          </div>
        )}
      </div>
      
      {/* Viewers modal */}
      {showViewers && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/80 flex items-end justify-center"
          onClick={() => setShowViewers(false)}
        >
          <div 
            className="w-full max-w-[450px] bg-[#121212] rounded-t-3xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#121212] p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Views</h3>
                <button onClick={() => setShowViewers(false)} className="text-white">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <p className="text-white/60 text-sm mt-1">{viewersCount} people viewed this story</p>
            </div>
            
            <div className="p-4 space-y-3">
              {viewers.map(viewer => (
                <div key={viewer.id} className="flex items-center gap-3">
                  <img
                    src={viewer.profile_image_url || viewer.profileImage}
                    className="w-10 h-10 rounded-full object-cover"
                    alt=""
                  />
                  <div className="flex-1">
                    <p className="text-white font-medium">{viewer.name}</p>
                    <p className="text-white/40 text-xs">@{viewer.username}</p>
                  </div>
                  <button
                    onClick={() => onProfileClick(viewer.id)}
                    className="text-[#1877F2] text-sm font-bold"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Menu modal for story owner */}
      {showMenu && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm"
          onClick={() => setShowMenu(false)}
        >
          <div 
            className="absolute bottom-0 left-0 right-0 max-w-[450px] mx-auto bg-[#121212] rounded-t-3xl p-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5"></div>
            
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400"
            >
              <div className="w-11 h-11 rounded-full bg-red-500/15 flex items-center justify-center">
                <i className="fas fa-trash-alt"></i>
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Delete Story</p>
                <p className="text-red-300/60 text-xs">This cannot be undone</p>
              </div>
            </button>
            
            <button
              onClick={() => setShowMenu(false)}
              className="w-full mt-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/80 font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== MAIN STORY FEEDS COMPONENT ====================
interface StoryFeedsProps {
  initialStory: Story;
  storyGroups: any[];
  currentUser: User | null;
  onClose: () => void;
  onReply: (storyId: number, text: string) => void;
  onLike: (storyId: number) => void;
  onReaction: (storyId: number, emoji: string) => void;
  onFollow: (userId: number) => void;
  checkIsFollowing: (userId: number) => boolean;
  onFetchViewers: (storyId: number) => Promise<any[]>;
  onProfileClick: (userId: number) => void;
  onDeleteStory?: (storyId: number) => void;
  deleteLoading?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
}

export const StoryFeeds: React.FC<StoryFeedsProps> = ({
  initialStory,
  storyGroups,
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
  // ==================== STATE ====================
  const [userIndex, setUserIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);

  // ==================== CRITICAL FIX A: Never return null - use fallbacks ====================
  // Find the correct group and story with proper fallbacks
  const findActiveGroupAndStory = useCallback(() => {
    if (!storyGroups.length && !initialStory) {
      return { activeGroup: null, activeStory: null, activeUser: null };
    }
    
    // Try to find the group containing the initial story
    let foundGroup = storyGroups.find(
      (g) => Number(g.user_id) === Number(initialStory.user_id)
    );
    
    // If not found, try to find by userId
    if (!foundGroup) {
      foundGroup = storyGroups.find(
        (g) => Number(g.user_id) === Number(initialStory.userId)
      );
    }
    
    // If still not found, use first group or create a fallback group
    if (!foundGroup && storyGroups.length > 0) {
      foundGroup = storyGroups[0];
    }
    
    // Find the specific story
    let foundStory = foundGroup?.stories?.find(
      (s: any) => Number(s.id) === Number(initialStory.id)
    );
    
    // If story not found in group, use the initial story as fallback
    if (!foundStory) {
      foundStory = initialStory;
    }
    
    // If no group found, create a fallback group from the story
    if (!foundGroup && foundStory) {
      foundGroup = {
        user_id: foundStory.user_id || foundStory.userId,
        user: buildStoryUser(foundStory),
        stories: [foundStory],
      };
    }
    
    // Build user from the found group or story
    const activeUser = foundGroup?.user || buildStoryUser(foundStory || initialStory);
    
    return {
      activeGroup: foundGroup,
      activeStory: foundStory,
      activeUser,
    };
  }, [storyGroups, initialStory]);

  const { activeGroup, activeStory, activeUser } = findActiveGroupAndStory();

  // ==================== CRITICAL FIX B: Reset indexes when selected story changes ====================
  useEffect(() => {
    if (!storyGroups.length || !initialStory) return;
    
    // Find user index
    let foundUserIndex = storyGroups.findIndex(
      (g) => Number(g.user_id) === Number(initialStory.user_id)
    );
    
    // If not found by user_id, try userId
    if (foundUserIndex === -1) {
      foundUserIndex = storyGroups.findIndex(
        (g) => Number(g.user_id) === Number(initialStory.userId)
      );
    }
    
    // Use found index or default to 0
    const nextUserIndex = foundUserIndex >= 0 ? foundUserIndex : 0;
    setUserIndex(nextUserIndex);
    
    // Find story index within that group
    const targetGroup = storyGroups[nextUserIndex];
    let foundStoryIndex = -1;
    
    if (targetGroup?.stories) {
      foundStoryIndex = targetGroup.stories.findIndex(
        (s: any) => Number(s.id) === Number(initialStory.id)
      );
    }
    
    // Use found index or default to 0
    setStoryIndex(foundStoryIndex >= 0 ? foundStoryIndex : 0);
  }, [storyGroups, initialStory]);

  // ==================== Navigation handlers ====================
  const goToNextStory = useCallback(() => {
    if (!activeGroup) return;
    
    const currentGroupStories = activeGroup.stories || [];
    const isLastStory = storyIndex >= currentGroupStories.length - 1;
    
    if (isLastStory) {
      // Move to next user's first story
      const isLastUser = userIndex >= storyGroups.length - 1;
      
      if (isLastUser) {
        onClose(); // Close viewer if at the end
        return;
      }
      
      const nextUserIndex = userIndex + 1;
      const nextGroup = storyGroups[nextUserIndex];
      
      if (nextGroup?.stories?.length) {
        setUserIndex(nextUserIndex);
        setStoryIndex(0);
      } else {
        onClose();
      }
    } else {
      // Next story in same group
      setStoryIndex(prev => prev + 1);
    }
  }, [activeGroup, storyIndex, userIndex, storyGroups, onClose]);
  
  const goToPrevStory = useCallback(() => {
    if (!activeGroup) return;
    
    const isFirstStory = storyIndex <= 0;
    
    if (isFirstStory) {
      // Move to previous user's last story
      const isFirstUser = userIndex <= 0;
      
      if (isFirstUser) {
        onClose(); // Close viewer if at the beginning
        return;
      }
      
      const prevUserIndex = userIndex - 1;
      const prevGroup = storyGroups[prevUserIndex];
      const prevStories = prevGroup?.stories || [];
      const lastStoryIndex = prevStories.length - 1;
      
      if (lastStoryIndex >= 0) {
        setUserIndex(prevUserIndex);
        setStoryIndex(lastStoryIndex);
      } else {
        onClose();
      }
    } else {
      // Previous story in same group
      setStoryIndex(prev => prev - 1);
    }
  }, [activeGroup, storyIndex, userIndex, storyGroups, onClose]);

  // ==================== Get current story and user ====================
  const getCurrentStory = useCallback(() => {
    if (activeGroup?.stories?.length && activeGroup.stories[storyIndex]) {
      return activeGroup.stories[storyIndex];
    }
    return activeStory || initialStory;
  }, [activeGroup, storyIndex, activeStory, initialStory]);
  
  const getCurrentUser = useCallback(() => {
    if (activeGroup?.user) {
      return activeGroup.user;
    }
    return activeUser || buildStoryUser(activeStory || initialStory);
  }, [activeGroup, activeUser, activeStory, initialStory]);

  const currentStory = getCurrentStory();
  const currentUserObj = getCurrentUser();

  // ==================== CRITICAL FIX C: Give StoryViewer a safe stories array ====================
  const safeAllStories = activeGroup?.stories?.length 
    ? activeGroup.stories 
    : (currentStory ? [currentStory] : []);

  // ==================== DEBUG LOGS (remove in production) ====================
  console.log('StoryFeeds Debug:', {
    hasInitialStory: !!initialStory,
    storyGroupsLength: storyGroups.length,
    userIndex,
    storyIndex,
    hasActiveGroup: !!activeGroup,
    hasActiveStory: !!activeStory,
    hasActiveUser: !!activeUser,
    currentStoryId: currentStory?.id,
    safeAllStoriesLength: safeAllStories.length,
  });

  // ==================== CRITICAL FIX: Never return null, always render something ====================
  // Instead of returning null, render a loading/error state or fallback
  if (!currentStory) {
    console.error('StoryFeeds: No current story available');
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

  return (
    <StoryViewer
      story={currentStory}
      user={currentUserObj}
      currentUser={currentUser}
      onClose={onClose}
      onNext={goToNextStory}
      onPrev={goToPrevStory}
      onReply={onReply}
      onLike={onLike}
      onReaction={onReaction}
      onFollow={onFollow}
      isFollowing={checkIsFollowing}
      allStories={safeAllStories}
      onFetchViewers={onFetchViewers}
      viewersCount={currentStory.views_count || currentStory.views || 0}
      onProfileClick={onProfileClick}
      muted={muted}
      onToggleMute={onToggleMute}
      onDeleteStory={onDeleteStory}
      deleteLoading={deleteLoading}
    />
  );
};

export default StoryFeeds;
