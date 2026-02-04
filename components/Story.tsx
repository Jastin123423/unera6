// components/Story.tsx - SIMPLIFIED VERSION
import React from 'react';
import { Story, User } from '../types';

export const StoryReel: React.FC<{ 
  stories: Story[], 
  onProfileClick: (id: number) => void,
  onCreateStory?: () => void,
  onViewStory: (story: Story) => void,
  currentUser: User | null,
  onRequestLogin: () => void 
}> = ({ stories, onProfileClick, onCreateStory, onViewStory, currentUser, onRequestLogin }) => {
  
  if (!stories || stories.length === 0) {
    return (
      <div className="w-full flex gap-2.5 mb-6 overflow-x-auto pb-2">
        {/* Create Story button */}
        <div 
          className="min-w-[110px] sm:min-w-[140px] h-[210px] sm:h-[250px] bg-[#242526] rounded-2xl shadow-md overflow-hidden cursor-pointer relative group flex-shrink-0 border border-[#3E4042]"
          onClick={() => currentUser ? (onCreateStory && onCreateStory()) : onRequestLogin()}
        >
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 bg-[#1877F2] rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-plus text-white text-lg"></i>
              </div>
              <span className="text-xs font-bold text-[#E4E6EB]">Create Story</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex gap-2.5 mb-6 overflow-x-auto pb-2 scrollbar-hide">
      {/* Create Story button */}
      <div 
        className="min-w-[110px] sm:min-w-[140px] h-[210px] sm:h-[250px] bg-[#242526] rounded-2xl shadow-md overflow-hidden cursor-pointer relative group flex-shrink-0 border border-[#3E4042]"
        onClick={() => currentUser ? (onCreateStory && onCreateStory()) : onRequestLogin()}
      >
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 bg-[#1877F2] rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="fas fa-plus text-white text-lg"></i>
            </div>
            <span className="text-xs font-bold text-[#E4E6EB]">Create Story</span>
          </div>
        </div>
      </div>

      {/* Simple story items */}
      {stories.slice(0, 5).map((story) => (
        <div 
          key={story.id}
          className="min-w-[110px] sm:min-w-[140px] h-[210px] sm:h-[250px] relative rounded-2xl overflow-hidden cursor-pointer flex-shrink-0 group shadow-lg border border-white/10"
          onClick={() => onViewStory(story)}
        >
          {story.media_url ? (
            <img 
              src={story.media_url} 
              alt="Story" 
              className="absolute w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
            />
          ) : (
            <div className="absolute w-full h-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">Story</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
          <p className="absolute bottom-3 left-3 right-3 text-white font-bold text-xs drop-shadow-md truncate">
            {story.author_name || 'User'}
          </p>
        </div>
      ))}
    </div>
  );
};

// Simple CreateStoryModal
export const CreateStoryModal: React.FC<{
  currentUser: User;
  onClose: () => void;
  onCreate: (story: Partial<Story>) => void;
}> = ({ currentUser, onClose, onCreate }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
      <div className="bg-[#242526] rounded-2xl p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold text-lg">Create Story</h3>
          <button onClick={onClose} className="text-[#B0B3B8] hover:text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="text-center py-8">
          <p className="text-white mb-4">Story functionality coming soon!</p>
          <button
            onClick={onClose}
            className="bg-[#1877F2] text-white px-6 py-2 rounded-full font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Simple StoryViewerModal
export const StoryViewerModal: React.FC<{
  story: Story;
  onClose: () => void;
  onProfileClick: (id: number) => void;
}> = ({ story, onClose, onProfileClick }) => {
  return (
    <div className="fixed inset-0 z-[250] bg-black flex items-center justify-center">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-2xl z-10"
      >
        <i className="fas fa-times"></i>
      </button>
      
      <div className="relative max-w-md w-full">
        {story.media_url ? (
          <img 
            src={story.media_url} 
            alt="Story" 
            className="w-full h-auto rounded-2xl"
          />
        ) : (
          <div className="bg-gradient-to-br from-purple-600 to-blue-500 rounded-2xl p-8 text-center">
            <p className="text-white text-xl">{story.text_content || 'Story'}</p>
          </div>
        )}
        
        <div className="mt-4 text-center">
          <button
            onClick={() => onProfileClick(story.user_id)}
            className="text-white bg-[#1877F2] px-4 py-2 rounded-full"
          >
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
};
