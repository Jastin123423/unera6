// Add this function near your other API functions in App.tsx
const createReelApi = async (payload: any) => {
  const res = await fetch('/api/reels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || 'Failed to create reel');
  }
  return data;
};

// Then update your createReel function to use it:
const createReel = useCallback(async (reelData: Partial<Reel>) => {
  if (!requireAuth('Creating reels')) return;
  if (!currentUser) return;

  setIsFeedRefreshing(true);
  
  try {
    // ✅ IMPORTANT: Backend expects snake_case, Reels.tsx sends camelCase
    const payload = {
      user_id: currentUser.id,
      video_url: reelData.videoUrl,  // ✅ Already HTTPS URL from Reels.tsx fix
      caption: reelData.caption || '',
      song_name: reelData.songName || 'Original Sound',
      audio_url: reelData.audioUrl,
      audio_start: reelData.audioStart || 0,
      audio_end: reelData.audioEnd || 0,
      visibility: 'public',
    };
    
    // ✅ POST to backend
    const data = await createReelApi(payload);
    
    // ✅ Normalize and add to reels list
    const newReel = normalizeReel(data.reel || data);
    
    // ✅ Optimistically add to reels list
    setReels(prev => [newReel, ...safeArray(prev)]);
    
    // ✅ Show success message
    setLoginError('Reel posted successfully!');
    
  } catch (error: any) {
    console.error('Failed to create reel:', error);
    setLoginError(error?.message || 'Failed to create reel');
  } finally {
    setIsFeedRefreshing(false);
    setShowCreateReelModal(false);
  }
}, [currentUser, requireAuth]);
