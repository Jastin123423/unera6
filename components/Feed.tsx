// ==================== ADDITIONAL EXPORTS ====================

// Export the main components that might be needed elsewhere
export default Feed;

// Export types and interfaces
export type { FeedProps, PeopleSuggestion, GroupSuggestion, ReelFeedData, FeedEventItem };

// Export helper functions that might be useful
export {
  formatRelativeTime,
  reactionEmoji,
  fmtCount,
  formatReactionText,
  formatViewCount,
  getPostTextPreview,
  toDateSafe,
  safeJsonArray,
  getMarketplaceProductId,
  getPostMediaList,
  getOrientation,
  classifyOrientations,
};

// Export constants
export { BACKGROUNDS, FEELINGS, QUICK_EMOJIS };

// Re-export from PostMenu if needed
export { PostMenu };

// Export any additional utility functions
export const getPostType = (post: any): string => {
  if (post?.type === 'sponsored' || post?.ad_type) return 'sponsored';
  if (post?.type === 'reel' || post?.item_type === 'reel') return 'reel';
  if (post?.type === 'event' || post?.item_type === 'event') return 'event';
  if (post?.type === 'product' || post?.marketplace) return 'product';
  if (post?.group_id || post?.group) return 'group_post';
  return 'post';
};

export const isVideoPost = (post: any): boolean => {
  const mediaInfo = getMediaTypeInfo(post);
  return mediaInfo.isVideo || (post?.media_type === 'video');
};

export const isImagePost = (post: any): boolean => {
  const mediaInfo = getMediaTypeInfo(post);
  return mediaInfo.isImage || (post?.media_type === 'image');
};

export const isAudioPost = (post: any): boolean => {
  const mediaInfo = getMediaTypeInfo(post);
  return mediaInfo.isAudio || (post?.media_type === 'audio');
};

// CSS injection for animations and scrollbar hiding
const injectGlobalStyles = () => {
  if (typeof document === 'undefined') return;
  
  const styleId = 'feed-global-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes slide-up {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      
      .animate-slide-up {
        animation: slide-up 0.3s ease-out;
      }
      
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #3A3B3C;
        border-radius: 10px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #B0B3B8;
        border-radius: 10px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #E4E6EB;
      }
      
      .line-clamp-1 {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      
      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      
      .line-clamp-3 {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  }
};

// Initialize global styles
if (typeof window !== 'undefined') {
  injectGlobalStyles();
}

// Export version info
export const FEED_VERSION = '2.0.0';
export const LAST_UPDATED = '2024-03-25';
