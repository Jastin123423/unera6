import React from 'react';
import type { Story, User } from '../types';

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

const StoryFeeds: React.FC<StoryFeedsProps> = ({ initialStory, stories, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'white',
        color: 'black',
        padding: '24px',
        overflow: 'auto',
      }}
    >
      <button
        onClick={onClose}
        style={{
          padding: '10px 16px',
          background: 'black',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
      >
        Back
      </button>

      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '16px' }}>
        STORYFEEDS FILE IS LOADED
      </h1>

      <div>stories length: {stories.length}</div>
      <div>initialStory id: {String((initialStory as any)?.id || 'none')}</div>
      <div>initialStory user_id: {String((initialStory as any)?.user_id || 'none')}</div>

      <pre style={{ whiteSpace: 'pre-wrap', marginTop: '16px', fontSize: '12px' }}>
        {JSON.stringify(initialStory, null, 2)}
      </pre>
    </div>
  );
};

export default StoryFeeds;
