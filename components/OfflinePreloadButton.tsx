// components/OfflinePreloadButton.tsx
import React, { useEffect, useState } from 'react';
import { hasOfflineSound, preloadSoundForOffline } from '../utils/offlineMedia';

type SoundLike = {
  id: string | number;
  name: string;
  url: string;
  originalUrl?: string;
  duration?: number;
  creatorName?: string;
  coverImage?: string;
  soundKey?: string;
};

export const OfflinePreloadButton: React.FC<{ sound: SoundLike }> = ({ sound }) => {
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    hasOfflineSound(sound.id)
      .then((ok) => {
        if (mounted) setIsSaved(ok);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [sound.id]);

  const handlePreload = async () => {
    setIsLoading(true);
    try {
      await preloadSoundForOffline(sound);
      setIsSaved(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handlePreload}
      disabled={isLoading || isSaved}
      className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-[0.14em] ${
        isSaved
          ? 'bg-green-500/20 border border-green-500/40 text-green-400'
          : 'bg-white/8 border border-white/10 text-white'
      }`}
    >
      {isLoading ? 'Saving...' : isSaved ? 'Saved offline' : 'Preload offline'}
    </button>
  );
};
