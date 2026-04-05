import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Story, User } from '../types';

interface StoryFeedsProps {
  stories: Story[];
  initialStory: Story;
  currentUser: User | null;
  onClose: () => void;
  onProfileClick: (userId: number) => void;
  onReply: (storyId: number, text: string) => Promise<void>;
  onLike: (storyId: number) => Promise<void>;
  onReaction: (storyId: number, reaction: string) => Promise<void>;
  onFollow: (userId: number) => Promise<void>;
  checkIsFollowing: (userId: number) => boolean;
  followLoading: Record<number, boolean>;
  onFetchViewers: (storyId: number) => Promise<any[]>;
  muted: boolean;
  onToggleMute: () => void;
  onDeleteStory?: (storyId: number) => Promise<void>;
  deleteLoading?: boolean;
}

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
  followLoading,
  onFetchViewers,
  muted,
  onToggleMute,
  onDeleteStory,
  deleteLoading,
}) => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(() => {
    const index = stories.findIndex(s => s.id === initialStory.id);
    return index >= 0 ? index : 0;
  });
  const [progress, setProgress] = useState(0);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressInterval = useRef<NodeJS.Timeout>();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const currentStory = stories[currentStoryIndex];
  const isMyStory = currentUser && currentStory?.user_id === currentUser.id;
  const hasNext = currentStoryIndex < stories.length - 1;
  const hasPrev = currentStoryIndex > 0;

  useEffect(() => {
    if (currentStory && currentStory.type === 'video' && videoRef.current) {
      videoRef.current.play().catch(e => console.log('Auto-play failed:', e));
    }
    startProgress();
    markStoryAsViewed();
    return () => clearProgress();
  }, [currentStoryIndex]);

  const startProgress = () => {
    clearProgress();
    progressInterval.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearProgress();
          goToNext();
          return 0;
        }
        return prev + 1;
      });
    }, 30);
  };

  const clearProgress = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = undefined;
    }
  };

  const markStoryAsViewed = async () => {
    // API call to mark story as viewed would go here
    // This is handled by the parent component via onViewStory
  };

  const goToNext = () => {
    if (hasNext) {
      setCurrentStoryIndex(prev => prev + 1);
      setProgress(0);
      setShowReplyInput(false);
      setReplyText('');
      setShowReactionPicker(false);
      setShowMenu(false);
    } else {
      onClose();
    }
  };

  const goToPrev = () => {
    if (hasPrev) {
      setCurrentStoryIndex(prev => prev - 1);
      setProgress(0);
      setShowReplyInput(false);
      setReplyText('');
      setShowReactionPicker(false);
      setShowMenu(false);
    }
  };

  const handlePause = () => {
    clearProgress();
    if (currentStory?.type === 'video' && videoRef.current) {
      videoRef.current.pause();
    }
  };

  const handleResume = () => {
    startProgress();
    if (currentStory?.type === 'video' && videoRef.current) {
      videoRef.current.play().catch(e => console.log('Play failed:', e));
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    handlePause();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) {
      handleResume();
      return;
    }

    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        goToPrev();
      } else {
        goToNext();
      }
    } else if (Math.abs(deltaY) > 50) {
      // Vertical swipe - close
      onClose();
    }

    touchStartX.current = null;
    touchStartY.current = null;
    handleResume();
  };

  const handleReaction = async (reaction: string) => {
    await onReaction(currentStory.id, reaction);
    setShowReactionPicker(false);
  };

  const handleLike = async () => {
    await onLike(currentStory.id);
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    await onReply(currentStory.id, replyText);
    setReplyText('');
    setShowReplyInput(false);
  };

  const handleViewers = async () => {
    const viewersList = await onFetchViewers(currentStory.id);
    setViewers(viewersList);
    setShowViewers(true);
  };

  const handleDeleteStory = async () => {
    if (onDeleteStory) {
      await onDeleteStory(currentStory.id);
      if (stories.length === 1) {
        onClose();
      } else {
        goToNext();
      }
    }
    setShowDeleteConfirm(false);
    setShowMenu(false);
  };

  const formatViewCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return String(count);
  };

  if (!currentStory) return null;

  return (
    <div
      className="fixed inset-0 bg-black z-[200] flex items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handlePause}
      onMouseUp={handleResume}
    >
      <div className="relative w-full h-full max-w-md mx-auto bg-black">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2">
          {stories.map((story, idx) => (
            <div
              key={story.id}
              className="flex-1 h-1 bg-[#3E4042] rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-30"
                style={{
                  width: idx < currentStoryIndex
                    ? '100%'
                    : idx === currentStoryIndex
                    ? `${progress}%`
                    : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => onProfileClick(currentStory.user_id)}
              className="flex items-center gap-2"
            >
              <div className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center text-white font-bold overflow-hidden">
                {currentStory.user?.profile_image_url ? (
                  <img
                    src={currentStory.user.profile_image_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  currentStory.user?.name?.charAt(0) || 
                  currentStory.author_name?.charAt(0) || 
                  'U'
                )}
              </div>
              <div>
                <div className="text-white font-semibold text-sm">
                  {currentStory.user?.name || currentStory.author_name}
                </div>
                <div className="text-[#B0B3B8] text-xs">
                  {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </button>

            {currentUser && currentUser.id !== currentStory.user_id && !checkIsFollowing(currentStory.user_id) && (
              <button
                onClick={() => onFollow(currentStory.user_id)}
                disabled={followLoading[currentStory.user_id]}
                className="px-3 py-1 bg-[#1877F2] text-white text-xs rounded-full font-semibold hover:bg-[#166FE5] disabled:opacity-50"
              >
                {followLoading[currentStory.user_id] ? '...' : 'Follow'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMute}
              className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
            >
              <i className={`fas fa-volume-${muted ? 'mute' : 'up'} text-sm`} />
            </button>

            {isMyStory && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
                >
                  <i className="fas fa-ellipsis-h text-sm" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-[#242526] rounded-lg shadow-lg overflow-hidden min-w-[150px] z-20">
                    <button
                      onClick={handleViewers}
                      className="w-full text-left px-4 py-2 text-[#B0B3B8] hover:bg-[#3A3B3C] text-sm"
                    >
                      <i className="fas fa-eye mr-2" /> Viewers
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full text-left px-4 py-2 text-red-400 hover:bg-[#3A3B3C] text-sm"
                    >
                      <i className="fas fa-trash mr-2" /> Delete Story
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
            >
              <i className="fas fa-times text-sm" />
            </button>
          </div>
        </div>

        {/* Story Content */}
        {currentStory.type === 'text' && (
          <div
            className="w-full h-full flex items-center justify-center p-8"
            style={{ backgroundColor: currentStory.background_style || '#1877F2' }}
          >
            <p className="text-white text-2xl text-center font-medium leading-relaxed">
              {currentStory.text_content}
            </p>
          </div>
        )}

        {currentStory.type === 'image' && currentStory.media_url && (
          <img
            src={currentStory.media_url}
            alt="Story"
            className="w-full h-full object-contain"
          />
        )}

        {currentStory.type === 'video' && currentStory.media_url && (
          <video
            ref={videoRef}
            src={currentStory.media_url}
            className="w-full h-full object-contain"
            loop={false}
            muted={muted}
            playsInline
          />
        )}

        {currentStory.music_url && (
          <audio
            src={currentStory.music_url}
            autoPlay={!muted}
            loop
            muted={muted}
            className="hidden"
          />
        )}

        {/* Interaction Buttons */}
        <div className="absolute bottom-20 left-0 right-0 flex justify-center gap-6 z-10">
          <div className="relative">
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <i className="fas fa-heart text-2xl" />
            </button>
            {showReactionPicker && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#242526] rounded-full p-2 flex gap-2 shadow-lg">
                {['❤️', '😮', '😂', '😢', '😡', '👍'].map((reaction, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleReaction(reaction)}
                    className="w-10 h-10 rounded-full hover:scale-125 transition-transform text-2xl"
                  >
                    {reaction}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowReplyInput(!showReplyInput)}
            className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            <i className="fas fa-reply text-2xl" />
          </button>

          {isMyStory && currentStory.views_count > 0 && (
            <button
              onClick={handleViewers}
              className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <div className="relative">
                <i className="fas fa-eye text-2xl" />
                {currentStory.views_count > 0 && (
                  <span className="absolute -top-1 -right-2 text-xs bg-[#1877F2] rounded-full px-1 min-w-[18px]">
                    {formatViewCount(currentStory.views_count)}
                  </span>
                )}
              </div>
            </button>
          )}
        </div>

        {/* Reply Input */}
        {showReplyInput && (
          <div className="absolute bottom-32 left-4 right-4 z-10 flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Send a reply..."
              className="flex-1 bg-[#3A3B3C] text-white rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
              onKeyPress={(e) => e.key === 'Enter' && handleSendReply()}
              autoFocus
            />
            <button
              onClick={handleSendReply}
              className="px-4 py-2 bg-[#1877F2] text-white rounded-full font-semibold hover:bg-[#166FE5]"
            >
              Send
            </button>
          </div>
        )}

        {/* Viewers Modal */}
        {showViewers && (
          <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4">
            <div className="bg-[#242526] rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-[#3E4042]">
                <h3 className="text-white font-semibold">
                  Story Viewers ({viewers.length})
                </h3>
                <button
                  onClick={() => setShowViewers(false)}
                  className="text-[#B0B3B8] hover:text-white"
                >
                  <i className="fas fa-times" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(80vh-60px)] p-2">
                {viewers.map((viewer, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-2 hover:bg-[#3A3B3C] rounded-lg"
                  >
                    <button
                      onClick={() => {
                        onProfileClick(viewer.user_id);
                        setShowViewers(false);
                      }}
                      className="flex items-center gap-3 flex-1"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center text-white font-bold overflow-hidden">
                        {viewer.user?.profile_image_url ? (
                          <img
                            src={viewer.user.profile_image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          viewer.user?.name?.charAt(0) || 'U'
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-white text-sm font-semibold">
                          {viewer.user?.name || 'User'}
                        </div>
                        <div className="text-[#B0B3B8] text-xs">
                          @{viewer.user?.username || 'user'}
                        </div>
                      </div>
                    </button>
                    {viewer.reaction && (
                      <span className="text-xl">{viewer.reaction}</span>
                    )}
                  </div>
                ))}
                {viewers.length === 0 && (
                  <div className="text-center text-[#B0B3B8] py-8">
                    No viewers yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4">
            <div className="bg-[#242526] rounded-xl max-w-sm w-full p-6">
              <h3 className="text-white text-lg font-semibold mb-2">
                Delete Story?
              </h3>
              <p className="text-[#B0B3B8] text-sm mb-6">
                This story will be permanently deleted and cannot be recovered.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 bg-[#3A3B3C] text-white rounded-lg font-semibold hover:bg-[#4E4F50]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteStory}
                  disabled={deleteLoading}
                  className="flex-1 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryFeeds;
