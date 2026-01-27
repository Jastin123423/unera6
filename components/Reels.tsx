import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Reel, ReactionType, ReelComment } from '../types';

// Reuse your existing apiFetch helper from App.tsx
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers: HeadersInit = {
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    let data: any = null;

    try {
      if (contentType.includes('application/json')) data = await res.json();
      else {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      }
    } catch (e: any) {
      data = { error: e?.message || 'Failed to parse response' };
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
  }
};

// Upload helper matching App.tsx pattern
const uploadToCloudflareR2 = async (file: File, folder = 'reels'): Promise<{ url: string; type: string; filename: string }> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    formData.append('type', file.type);
    formData.append('folder', folder);
    formData.append('timestamp', Date.now().toString());

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }

    const result = await response.json();
    if (!result.url) throw new Error('No URL returned from upload');

    return { url: result.url, type: file.type, filename: file.name };
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};

// Normalize reel data to match your pattern
const normalizeReel = (r: any): Reel => {
  return {
    ...r,
    id: Number(r?.id ?? r?.reel_id ?? 0),
    user_id: Number(r?.user_id ?? r?.userId ?? 0),
    video_url: r?.video_url ?? r?.videoUrl ?? '',
    caption: r?.caption ?? '',
    song_name: r?.song_name ?? r?.songName ?? '',
    audio_url: r?.audio_url ?? r?.audioUrl,
    audio_start: Number(r?.audio_start ?? r?.audioStart ?? 0),
    audio_end: Number(r?.audio_end ?? r?.audioEnd ?? 0),
    reactions: Array.isArray(r?.reactions) ? r.reactions : [],
    comments: Array.isArray(r?.comments) ? r.comments : [],
    shares: Number(r?.shares ?? 0),
    views: Number(r?.views ?? 0),
    created_at: r?.created_at ?? r?.createdAt ?? new Date().toISOString(),
    // Add fields that might be needed for compatibility
    my_reaction: r?.my_reaction ?? r?.myReaction ?? null,
    reactions_count: Number(r?.reactions_count ?? r?.reactionsCount ?? 0),
  };
};

// Reel creation API function
const createReelApi = async (reelData: {
  video: File;
  caption: string;
  songName?: string;
  audioFile?: File;
  audioStart?: number;
  audioEnd?: number;
  visibility?: 'public' | 'friends' | 'private';
  location?: string;
}, currentUserId: number): Promise<Reel> => {
  try {
    // Upload video
    const videoUpload = await uploadToCloudflareR2(reelData.video, 'reels');
    
    let audioUrl: string | undefined;
    let audioName = reelData.songName || 'Original Sound';
    
    // Upload audio if provided
    if (reelData.audioFile) {
      const audioUpload = await uploadToCloudflareR2(reelData.audioFile, 'reel-audio');
      audioUrl = audioUpload.url;
      audioName = audioUpload.filename.split('.')[0];
    }
    
    // Create reel record
    const payload = {
      user_id: currentUserId,
      video_url: videoUpload.url,
      caption: reelData.caption,
      song_name: audioName,
      audio_url: audioUrl,
      audio_start: reelData.audioStart || 0,
      audio_end: reelData.audioEnd || 0,
      visibility: reelData.visibility || 'public',
      location: reelData.location,
    };
    
    const data = await apiFetch('/api/reels', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    
    return normalizeReel(data.reel || data);
  } catch (error) {
    console.error('Failed to create reel:', error);
    throw error;
  }
};

// React to reel API function
const reactToReelApi = async (reelId: number, type: ReactionType, userId: number) => {
  const data = await apiFetch(`/api/reels/${reelId}/react`, {
    method: 'POST',
    body: JSON.stringify({ type, user_id: userId }),
  });
  return data;
};

// Comment on reel API function
const commentOnReelApi = async (reelId: number, text: string, userId: number) => {
  const data = await apiFetch(`/api/reels/${reelId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text, user_id: userId }),
  });
  return data.comment || data;
};

// Share reel API function
const shareReelApi = async (reelId: number, userId: number, destination?: string) => {
  const data = await apiFetch(`/api/reels/${reelId}/share`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, destination }),
  });
  return data;
};

// Optimistic reaction helper matching App.tsx pattern
const applyOptimisticReaction = (r: any, reelId: number, type: ReactionType, meId: number) => {
  if (Number(r?.id) !== Number(reelId)) return r;

  const prevMy = r?.my_reaction ?? r?.myReaction ?? null;
  const nextMy = prevMy === type ? null : type;

  const prevArr = Array.isArray(r?.reactions) ? r.reactions : [];
  const withoutMe = prevArr.filter((reaction: any) => Number(reaction?.user_id) !== Number(meId));
  const nextArr = nextMy ? [...withoutMe, { user_id: meId, type: nextMy }] : withoutMe;

  const prevCount = Number(r?.reactions_count ?? r?.reactionsCount ?? prevArr.length);
  const nextCount = prevMy ? (nextMy ? prevCount : Math.max(0, prevCount - 1)) : (nextMy ? prevCount + 1 : prevCount);

  return {
    ...r,
    reactions: nextArr,
    my_reaction: nextMy,
    myReaction: nextMy,
    reactions_count: nextCount,
    reactionsCount: nextCount,
  };
};

// CREATE REEL MODAL WITH API INTEGRATION
interface CreateReelModalProps {
  currentUser: User;
  onClose: () => void;
  onSubmit: (reelData: {
    video: File;
    caption: string;
    songName?: string;
    audioFile?: File;
    audioStart?: number;
    audioEnd?: number;
    visibility?: 'public' | 'friends' | 'private';
    location?: string;
  }) => Promise<void>;
  initialSound?: { name: string; url?: string; start?: number; end?: number } | null;
}

export const CreateReelModal: React.FC<CreateReelModalProps> = ({
  currentUser,
  onClose,
  onSubmit,
  initialSound
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'publish'>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoURL, setVideoURL] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [selectedSong, setSelectedSong] = useState<{ name: string; url: string } | null>(
    initialSound?.url ? { name: initialSound.name, url: initialSound.url } : null
  );
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [audioStart, setAudioStart] = useState(initialSound?.start || 0);
  const [audioEnd, setAudioEnd] = useState(initialSound?.end || 0);
  const [isTrimmerOpen, setIsTrimmerOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile(file);
      setVideoURL(URL.createObjectURL(file));
      setStep('preview');
    }
  };

  const handlePost = async () => {
    if (!videoFile) return;
    
    setIsUploading(true);
    try {
      await onSubmit({
        video: videoFile,
        caption,
        songName: selectedSong?.name,
        audioFile: selectedSong?.url ? await fetch(selectedSong.url).then(r => r.blob()).then(b => new File([b], 'audio.mp3')) : undefined,
        audioStart,
        audioEnd,
        visibility: 'public'
      });
      onClose();
    } catch (error) {
      console.error('Failed to post reel:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setSelectedSong({ url, name: file.name.split('.')[0] });
      setShowMusicPicker(false);
      setIsTrimmerOpen(true);
    }
  };

  if (step === 'upload') {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center font-sans animate-fade-in p-4">
        <button onClick={onClose} className="absolute top-4 right-4 text-white text-3xl">
          <i className="fas fa-times"></i>
        </button>
        <div 
          className="w-full max-w-sm aspect-[9/16] border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-900 transition-colors relative overflow-hidden"
          onClick={() => fileInputRef.current?.click()}
        >
          <i className="fas fa-cloud-upload-alt text-6xl mb-4 text-[#FE2C55]"></i>
          <h3 className="text-xl font-bold mb-2 text-white">Select video for reel</h3>
          <p className="text-gray-400 text-sm">Upload a vertical video (9:16)</p>
          <div className="mt-6 bg-[#FE2C55] px-8 py-2 rounded-sm font-bold text-white">Select Video</div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="video/*" 
            onChange={handleFileChange} 
          />
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col font-sans animate-fade-in">
      <div className="relative flex-1 bg-black flex items-center justify-center">
        <video 
          ref={videoRef} 
          src={videoURL} 
          className="w-full h-full object-contain" 
          loop 
          autoPlay 
          muted={!!selectedSong}
        />
        
        {/* Header Controls */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
          <button onClick={onClose} className="text-white text-2xl">
            <i className="fas fa-arrow-left"></i>
          </button>
          <button 
            onClick={handlePost} 
            disabled={isUploading}
            className="bg-[#FE2C55] text-white font-bold px-6 py-2 rounded-md disabled:opacity-50"
          >
            {isUploading ? 'Posting...' : 'Post Reel'}
          </button>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-6 w-full px-4 z-20 flex flex-col gap-4">
          {/* Sound Selection */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowMusicPicker(true)}
              className="flex items-center gap-2 bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-full"
            >
              <i className="fas fa-music"></i>
              <span className="text-sm">{selectedSong?.name || 'Add Sound'}</span>
            </button>
            
            {selectedSong && (
              <button 
                onClick={() => setIsTrimmerOpen(true)}
                className="bg-black/50 backdrop-blur-md text-white p-2 rounded-full"
              >
                <i className="fas fa-scissors"></i>
              </button>
            )}
          </div>

          {/* Caption Input */}
          <div className="relative">
            <textarea
              className="w-full bg-black/50 backdrop-blur-md text-white rounded-lg p-4 pr-12 resize-none outline-none border border-gray-700"
              placeholder="Write a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
            />
            <div className="absolute right-3 bottom-3 text-gray-400 text-sm">
              {caption.length}/150
            </div>
          </div>
        </div>
      </div>

      {/* Music Picker Modal */}
      {showMusicPicker && (
        <div className="fixed inset-0 z-[300] bg-black/95 flex flex-col">
          <div className="p-4 border-b border-gray-700 flex justify-between items-center">
            <h3 className="text-white text-lg font-bold">Choose Sound</h3>
            <button onClick={() => setShowMusicPicker(false)} className="text-white">
              <i className="fas fa-times"></i>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {/* Original Sound Option */}
            <div 
              className="p-4 bg-gray-800 rounded-lg mb-3 cursor-pointer hover:bg-gray-700"
              onClick={() => {
                setSelectedSong(null);
                setShowMusicPicker(false);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                  <i className="fas fa-volume-up text-white"></i>
                </div>
                <div>
                  <p className="text-white font-medium">Original Sound</p>
                  <p className="text-gray-400 text-sm">Use video audio</p>
                </div>
              </div>
            </div>

            {/* Upload Audio Option */}
            <div className="mb-6">
              <label className="block p-4 bg-[#FE2C55]/20 border border-[#FE2C55] rounded-lg cursor-pointer hover:bg-[#FE2C55]/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#FE2C55] rounded-full flex items-center justify-center">
                    <i className="fas fa-upload text-white"></i>
                  </div>
                  <div>
                    <p className="text-white font-medium">Upload Audio</p>
                    <p className="text-gray-300 text-sm">Upload your own audio file</p>
                  </div>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="audio/*" 
                  onChange={handleAudioUpload}
                />
              </label>
            </div>

            {/* Music Library - You can fetch from your backend */}
            <div className="space-y-3">
              <h4 className="text-white font-medium mb-2">Trending Sounds</h4>
              {/* Map through sounds from your API */}
            </div>
          </div>
        </div>
      )}

      {/* Audio Trimmer Modal */}
      {isTrimmerOpen && selectedSong && (
        <AudioTrimmer
          url={selectedSong.url}
          onClose={() => setIsTrimmerOpen(false)}
          onConfirm={(start, end) => {
            setAudioStart(start);
            setAudioEnd(end);
            setIsTrimmerOpen(false);
          }}
          initialStart={audioStart}
          initialEnd={audioEnd}
        />
      )}
    </div>
  );
};

// Audio Trimmer Component
const AudioTrimmer: React.FC<{
  url: string;
  onClose: () => void;
  onConfirm: (start: number, end: number) => void;
  initialStart: number;
  initialEnd: number;
}> = ({ url, onClose, onConfirm, initialStart, initialEnd }) => {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleLoadedMetadata = () => {
        setDuration(audio.duration);
        if (end === 0 || end > audio.duration) {
          setEnd(Math.min(audio.duration, start + 15));
        }
      };
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      return () => audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }
  }, [url, end, start]);

  const handleConfirm = () => {
    onConfirm(start, end);
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black/95 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-gray-900 rounded-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-white text-xl font-bold">Trim Audio</h3>
          <button onClick={onClose} className="text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-white text-sm mb-2">
            <span>Start: {start.toFixed(1)}s</span>
            <span>End: {end.toFixed(1)}s</span>
            <span>Duration: {(end - start).toFixed(1)}s</span>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-white text-sm block mb-1">Start Time (seconds)</label>
              <input
                type="range"
                min="0"
                max={duration}
                step="0.1"
                value={start}
                onChange={(e) => setStart(Math.min(parseFloat(e.target.value), end - 0.5))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="text-white text-sm block mb-1">End Time (seconds)</label>
              <input
                type="range"
                min="0"
                max={duration}
                step="0.1"
                value={end}
                onChange={(e) => setEnd(Math.max(parseFloat(e.target.value), start + 0.5))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              audioRef.current?.pause();
              onClose();
            }}
            className="flex-1 bg-gray-700 text-white py-3 rounded-lg hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-[#FE2C55] text-white py-3 rounded-lg hover:bg-[#e62b4f]"
          >
            Apply
          </button>
        </div>

        <audio ref={audioRef} src={url} className="hidden" />
      </div>
    </div>
  );
};

// REELS FEED COMPONENT WITH API INTEGRATION
interface ReelsFeedProps {
  reels: Reel[];
  users: User[];
  currentUser: User | null;
  onProfileClick: (id: number) => void;
  onCreateReelClick: () => void;
  onReact: (reelId: number, type?: ReactionType) => void;
  onComment: (reelId: number, text: string) => void;
  onShare: (reelId: number, type: 'feed' | 'copy') => void;
  onFollow: (userId: number) => void;
  getCommentAuthor: (id: number) => User | undefined;
  initialReelId?: number | null;
  checkIsFollowing: (userId: number) => boolean;
  followLoading: { [key: number]: boolean };
  onPlayAudioTrack?: (track: any) => void;
}

export const ReelsFeed: React.FC<ReelsFeedProps> = ({
  reels = [],
  users = [],
  currentUser,
  onProfileClick,
  onCreateReelClick,
  onReact,
  onComment,
  onShare,
  onFollow,
  getCommentAuthor,
  initialReelId,
  checkIsFollowing,
  followLoading,
  onPlayAudioTrack
}) => {
  const [activeReelId, setActiveReelId] = useState<number | null>(initialReelId || null);
  const [isMuted, setIsMuted] = useState(true);
  const [activeCommentReelId, setActiveCommentReelId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [playingReelId, setPlayingReelId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});

  // Auto-play visible reels
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = Number(entry.target.getAttribute('data-reel-id'));
          if (entry.isIntersecting && entry.intersectionRatio > 0.7) {
            setActiveReelId(id);
            setPlayingReelId(id);
          }
        });
      },
      { threshold: 0.7 }
    );

    document.querySelectorAll('.reel-container').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Handle video play/pause
  useEffect(() => {
    Object.keys(videoRefs.current).forEach((key) => {
      const id = Number(key);
      const video = videoRefs.current[id];
      const audio = audioRefs.current[id];
      const reel = reels.find((r) => r.id === id);

      if (video) {
        if (id === playingReelId) {
          if (video.paused) video.play().catch(() => {});
          
          // Sync audio if exists
          if (audio && reel?.audio_url) {
            video.muted = true;
            const start = reel.audio_start || 0;
            const end = reel.audio_end || 1000000;

            const handleAudioSync = () => {
              const expectedAudioTime = video.currentTime + start;
              if (audio.currentTime >= end || expectedAudioTime >= end) {
                audio.currentTime = start;
                video.currentTime = 0;
                return;
              }
              const drift = Math.abs(audio.currentTime - expectedAudioTime);
              if (drift > 0.5) {
                audio.currentTime = expectedAudioTime;
              }
            };

            audio.addEventListener('timeupdate', handleAudioSync);
            if (audio.paused) audio.play().catch(() => {});
          } else {
            video.muted = false;
          }
        } else {
          video.pause();
          if (audio) audio.pause();
        }
      }
    });
  }, [playingReelId, reels]);

  const handleCommentSubmit = (e: React.FormEvent, reelId: number) => {
    e.preventDefault();
    if (commentText.trim()) {
      onComment(reelId, commentText);
      setCommentText('');
      setActiveCommentReelId(null);
    }
  };

  const handleReelClick = (reelId: number) => {
    setPlayingReelId(playingReelId === reelId ? null : reelId);
  };

  const formatCount = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="w-full h-[calc(100vh-56px)] flex justify-center bg-black overflow-hidden relative font-sans">
      {/* Create Reel Button */}
      {currentUser && (
        <button
          onClick={onCreateReelClick}
          className="fixed bottom-8 right-8 z-50 bg-[#FE2C55] text-white p-4 rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
        >
          <i className="fas fa-plus text-xl"></i>
        </button>
      )}

      {/* Reels Container */}
      <div ref={containerRef} className="w-full max-w-[450px] h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
        {reels.map((reel) => {
          const author = users.find((u) => u.id === reel.user_id) || {
            id: 0,
            name: 'Unknown',
            profile_image_url: '',
            username: 'unknown'
          };
          
          const reactions = Array.isArray(reel.reactions) ? reel.reactions : [];
          const comments = Array.isArray(reel.comments) ? reel.comments : [];
          const myReaction = currentUser
            ? reactions.find((r: any) => r.user_id === currentUser.id)?.type
            : undefined;

          const isFollowing = checkIsFollowing(author.id);
          const isPlaying = playingReelId === reel.id;

          return (
            <div
              key={reel.id}
              data-reel-id={reel.id}
              className="reel-container w-full h-full snap-start relative bg-black flex items-center justify-center overflow-hidden"
            >
              {/* Video */}
              <video
                ref={(el) => {
                  if (el) videoRefs.current[reel.id] = el;
                }}
                src={reel.video_url}
                className="w-full h-full object-cover"
                loop
                playsInline
                onClick={() => handleReelClick(reel.id)}
                muted={isMuted}
              />

              {/* Audio track if exists */}
              {reel.audio_url && (
                <audio
                  ref={(el) => {
                    if (el) audioRefs.current[reel.id] = el;
                  }}
                  src={reel.audio_url}
                  loop={false}
                  className="hidden"
                />
              )}

              {/* Play/Pause Overlay */}
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
                    <i className="fas fa-play text-white text-3xl ml-1"></i>
                  </div>
                </div>
              )}

              {/* Right Side Actions */}
              <div className="absolute bottom-32 right-4 flex flex-col items-center gap-6 z-20">
                {/* Profile */}
                <div className="flex flex-col items-center gap-1">
                  <img
                    src={author.profile_image_url}
                    className="w-12 h-12 rounded-full border-2 border-white object-cover cursor-pointer"
                    alt=""
                    onClick={() => onProfileClick(author.id)}
                  />
                  {currentUser?.id !== author.id && !isFollowing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFollow(author.id);
                      }}
                      disabled={followLoading[author.id]}
                      className="w-6 h-6 bg-[#FE2C55] rounded-full flex items-center justify-center text-white text-xs"
                    >
                      <i className="fas fa-plus"></i>
                    </button>
                  )}
                </div>

                {/* Like */}
                <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => onReact(reel.id, 'love')}>
                  <i className={`${myReaction === 'love' ? 'fas text-red-500' : 'far'} fa-heart text-2xl text-white`}></i>
                  <span className="text-white text-xs">{formatCount(reactions.length)}</span>
                </div>

                {/* Comment */}
                <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setActiveCommentReelId(reel.id)}>
                  <i className="fas fa-comment-dots text-2xl text-white"></i>
                  <span className="text-white text-xs">{formatCount(comments.length)}</span>
                </div>

                {/* Share */}
                <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => onShare(reel.id, 'feed')}>
                  <i className="fas fa-share text-2xl text-white"></i>
                  <span className="text-white text-xs">{formatCount(reel.shares)}</span>
                </div>

                {/* Sound */}
                {reel.song_name && (
                  <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => onPlayAudioTrack?.({
                    id: reel.id,
                    title: reel.song_name,
                    url: reel.audio_url,
                    type: 'music',
                    cover: author.profile_image_url
                  })}>
                    <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center animate-spin-slow">
                      <i className="fas fa-music text-white"></i>
                    </div>
                    <span className="text-white text-xs text-center max-w-[80px] truncate">{reel.song_name}</span>
                  </div>
                )}
              </div>

              {/* Bottom Info */}
              <div className="absolute bottom-0 left-0 w-full p-4 z-20 pb-8 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => onProfileClick(author.id)}>
                  <img src={author.profile_image_url} className="w-10 h-10 rounded-full border border-white object-cover" alt="" />
                  <div>
                    <span className="text-white font-bold block">{author.name}</span>
                    {!isFollowing && currentUser?.id !== author.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onFollow(author.id);
                        }}
                        disabled={followLoading[author.id]}
                        className="text-[#FE2C55] text-sm font-medium hover:underline"
                      >
                        {followLoading[author.id] ? 'Following...' : 'Follow'}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-white text-sm line-clamp-2">{reel.caption}</p>
              </div>

              {/* Comments Modal */}
              {activeCommentReelId === reel.id && (
                <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setActiveCommentReelId(null)}>
                  <div className="bg-[#242526] rounded-t-2xl h-[60%] w-full flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="p-4 border-b border-[#3E4042] flex justify-between items-center">
                      <h3 className="font-bold text-[#E4E6EB]">Comments ({comments.length})</h3>
                      <i className="fas fa-times text-[#B0B3B8] cursor-pointer" onClick={() => setActiveCommentReelId(null)}></i>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      {comments.length === 0 ? (
                        <p className="text-[#B0B3B8] text-center mt-10">No comments yet.</p>
                      ) : (
                        comments.map((comment: any, i) => {
                          const commentAuthor = getCommentAuthor(comment.user_id);
                          return (
                            <div key={i} className="flex gap-3 mb-4">
                              <img
                                src={commentAuthor?.profile_image_url}
                                className="w-10 h-10 rounded-full object-cover"
                                alt=""
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white">{commentAuthor?.name}</span>
                                  <span className="text-gray-400 text-sm">
                                    {new Date(comment.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-white mt-1">{comment.text}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {currentUser && (
                      <div className="p-4 border-t border-[#3E4042] flex gap-2">
                        <input
                          type="text"
                          className="flex-1 bg-[#3A3B3C] rounded-full px-4 py-2 text-white outline-none"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Add comment..."
                          onKeyPress={(e) => e.key === 'Enter' && handleCommentSubmit(e, reel.id)}
                        />
                        <button
                          onClick={(e) => handleCommentSubmit(e, reel.id)}
                          className="text-[#FE2C55] font-bold px-4"
                          disabled={!commentText.trim()}
                        >
                          Post
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
