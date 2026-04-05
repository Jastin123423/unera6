import React from 'react';

export default function StoryFeeds(props: any) {
  console.log('STORYFEEDS COMPONENT RENDERED', props);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000000,
        background: 'black',
        color: 'white',
        padding: '24px',
      }}
    >
      <button onClick={props.onClose}>Back</button>
      <div style={{ marginTop: '16px', fontSize: '28px', fontWeight: 'bold' }}>
        STORYFEEDS IMPORT WORKING
      </div>
      <div style={{ marginTop: '12px' }}>
        initialStory id: {String(props?.initialStory?.id || 'none')}
      </div>
    </div>
  );
}
