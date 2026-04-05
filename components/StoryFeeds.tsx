import React from 'react';

const StoryFeeds = (props: any) => {
  alert('StoryFeeds imported component rendered');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'black',
        color: 'white',
        padding: '24px',
      }}
    >
      <button onClick={props.onClose}>Back</button>
      <h1>STORYFEEDS IMPORT WORKING</h1>
      <div>initialStory id: {String(props?.initialStory?.id || 'none')}</div>
    </div>
  );
};

export default StoryFeeds;
