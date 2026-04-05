import React from 'react';

const StoryFeeds = (props: any) => {
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
      <button
        onClick={props.onClose}
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

      <h1 style={{ fontSize: '30px', fontWeight: 'bold' }}>
        STORYFEEDS IMPORT WORKING
      </h1>

      <div style={{ marginTop: '12px' }}>
        initialStory id: {String(props?.initialStory?.id || 'none')}
      </div>
      <div>
        stories length: {String(props?.stories?.length || 0)}
      </div>
    </div>
  );
};

export default StoryFeeds;
