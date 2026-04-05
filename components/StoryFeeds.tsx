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

const StoryFeeds: React.FC<StoryFeedsProps> = ({
  initialStory,
  stories,
  currentUser,
  onClose,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'black',
        color: 'white',
        overflow: 'auto',
      }}
    >
      <div style={{ padding: '16px' }}>
        <button
          onClick={onClose}
          style={{
            padding: '10px 16px',
            background: 'white',
            color: 'black',
            border: 'none',
            borderRadius: '8px',
            marginBottom: '16px',
            fontWeight: 'bold',
          }}
        >
          Back
        </button>

        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '12px' }}>
          StoryFeeds Working
        </h1>

        <div>initialStory id: {String((initialStory as any)?.id || 'none')}</div>
        <div>initialStory type: {String((initialStory as any)?.type || 'none')}</div>
        <div>stories length: {String(stories.length)}</div>
        <div>currentUser: {currentUser ? currentUser.name : 'null'}</div>

        <pre style={{ whiteSpace: 'pre-wrap', marginTop: '16px', fontSize: '12px' }}>
          {JSON.stringify(initialStory, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default StoryFeeds;
