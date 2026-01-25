import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { Song, Episode, AudioTrack, User } from '../types';

/* =========================================================
   CONSTANTS & DEFAULTS
========================================================= */
const DEFAULT_MUSIC_COVER = 'https://media.unera.social/task_01kftb3024ed7bm84gy6j485fh_1769336848_img_0.webp';
const DEFAULT_PODCAST_COVER = 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';

/* =========================================================
   API CLIENT (safe JSON parsing + auth + errors)
========================================================= */

type ApiResult<T> = { success: true; data: T } | { success: false; error: string; data?: any };

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('unera_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const safeParseJson = async (res: Response) => {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  // fallback: try text for debugging
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
};

async function apiJson<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    });

    const payload = await safeParseJson(res);

    if (!res.ok) {
      return { success: false, error: (payload?.error || payload?.message || `API Error: ${res.status}`) as string, data: payload };
    }

    // many APIs return { data: [...] } or direct array/object
    const data = (payload?.data ?? payload) as T;
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
  }
}

async function apiForm<T>(endpoint: string, form: FormData, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(endpoint, {
      method: options.method || 'POST',
      ...options,
      body: form,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    });

    const payload = await safeParseJson(res);

    if (!res.ok) {
      return { success: false, error: (payload?.error || payload?.message || `API Error: ${res.status}`) as string, data: payload };
    }

    const data = (payload?.data ?? payload) as T;
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
  }
}

/* =========================================================
   MAPPERS (backend -> UI types) - FIXED: reads plays_count/likes_count
========================================================= */

// ✅ FIXED: Reads plays_count and likes_count from backend
function mapSongFromApi(s: any): Song {
  const plays = Number(s.plays_count ?? s.plays ?? s.stats?.plays ?? 0);
  const likes = Number(s.likes_count ?? s.likes ?? s.stats?.likes ?? 0);
  
  // ✅ FIX: Use default cover if none provided or invalid
  let cover = s.cover_image_url || s.cover || DEFAULT_MUSIC_COVER;
  
  // Check if cover is a valid URL, otherwise use default
  if (!cover || cover.trim() === '' || 
      cover.includes('ui-avatars.com') || 
      !cover.startsWith('http')) {
    cover = DEFAULT_MUSIC_COVER;
  }

  return {
    id: String(s.id),
    title: s.title || 'Untitled',
    artist: s.artist_name || s.artist || 'Unknown Artist',
    cover: cover,
    audioUrl: s.audio_url || s.audioUrl || '',
    duration: s.duration || s.duration_seconds || '3:00',
    uploaderId: Number(s.uploader_id ?? s.uploaderId ?? 0) || 0,
    uploadDate: s.created_at || s.uploadDate || new Date().toISOString(),
    genre: s.genre || '',
    album: s.album_name || s.album || 'Single',
    isVerified: Boolean(s.is_verified || s.isVerified),
    stats: {
      plays,
      likes,
      shares: Number(s.shares_count ?? s.shares ?? s.stats?.shares ?? 0),
      downloads: Number(s.downloads_count ?? s.downloads ?? s.stats?.downloads ?? 0),
      reelsUse: Number(s.reels_use_count ?? s.reelsUse ?? s.stats?.reelsUse ?? 0),
    },
  } as any;
}

// ✅ FIXED: Reads plays_count and likes_count from backend for episodes too
function mapEpisodeFromApi(e: any): Episode {
  const plays = Number(e.plays_count ?? e.plays ?? e.stats?.plays ?? 0);
  const likes = Number(e.likes_count ?? e.likes ?? e.stats?.likes ?? 0);
  
  // ✅ FIX: Use default cover if none provided or invalid
  let thumbnail = e.cover_url || e.cover_image_url || e.thumbnail || DEFAULT_PODCAST_COVER;
  
  // Check if thumbnail is a valid URL, otherwise use default
  if (!thumbnail || thumbnail.trim() === '' || 
      thumbnail.includes('ui-avatars.com') || 
      !thumbnail.startsWith('http')) {
    thumbnail = DEFAULT_PODCAST_COVER;
  }

  return {
    id: String(e.id),
    title: e.title || 'Untitled',
    description: e.description || '',
    host: e.host || e.artist_name || 'Unknown Host',
    thumbnail: thumbnail,
    audioUrl: e.audio_url || e.audioUrl || '',
    duration: e.duration || e.duration_seconds || '45:00',
    uploaderId: Number(e.creator_id ?? e.uploader_id ?? e.uploaderId ?? 0) || 0,
    uploadDate: e.created_at || e.uploadDate || new Date().toISOString(),
    season: e.season || '',
    episode: e.episode || '',
    guests: e.guests || '',
    stats: {
      plays,
      likes,
      shares: Number(e.shares_count ?? e.shares ?? e.stats?.shares ?? 0),
      downloads: Number(e.downloads_count ?? e.downloads ?? e.stats?.downloads ?? 0),
      reelsUse: Number(e.reels_use_count ?? e.reelsUse ?? e.stats?.reelsUse ?? 0),
    },
  } as any;
}

/* =========================================================
   MODERN GLOBAL AUDIO PLAYER (Boomplay Style)
========================================================= */

interface GlobalAudioPlayerProps {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  onDownload: (id: string) => void;
  onLike: (id: string, type: 'music' | 'podcast') => void;
  onArtistClick?: (uploaderId: number) => void;
  isLiked: boolean;
  uploaderProfile?: User | null;
  ownerUser?: User | null;
  totalPlays?: number;
  totalPlaysLoading?: boolean;
  onStarted?: (track: AudioTrack) => void;
}

export const GlobalAudioPlayer: React.FC<GlobalAudioPlayerProps> = ({
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrevious,
  onClose,
  onDownload,
  onLike,
  onArtistClick,
  isLiked,
  uploaderProfile,
  ownerUser,
  totalPlays = 0,
  totalPlaysLoading = false,
  onStarted,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastUrlRef = useRef<string | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const startedKeyRef = useRef<string>("");
  const [volume, setVolume] = useState(1);
  const [isRepeating, setIsRepeating] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  // ✅ ADDED: Reset started key when track changes
  useEffect(() => {
    startedKeyRef.current = "";
  }, [currentTrack?.id, currentTrack?.type]);

  // ✅ ADDED: Fire onStarted ONLY when audio truly starts playing
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !currentTrack || !onStarted) return;

    const onPlaying = () => {
      const k = `${currentTrack.type}:${currentTrack.id}`;
      if (startedKeyRef.current === k) return;
      startedKeyRef.current = k;
      
      onStarted(currentTrack);
    };

    el.addEventListener("playing", onPlaying);
    return () => el.removeEventListener("playing", onPlaying);
  }, [currentTrack, onStarted]);

  // Handle audio playback based on props
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'metadata';
      audioRef.current.volume = volume;
    }

    const audio = audioRef.current;

    const setAudioData = () => {
      if (!isNaN(audio.duration)) setDuration(audio.duration);
    };
    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      if (isRepeating) {
        audio.currentTime = 0;
        audio.play();
      } else {
        onNext();
      }
    };
    const handleError = (e: Event) => console.warn('Audio playback warning:', e);

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // Manage playback based on currentTrack and isPlaying
    const managePlayback = async () => {
      if (!currentTrack?.url) {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        lastUrlRef.current = null;
        return;
      }

      // If track changed, reset and load new audio
      if (lastUrlRef.current !== currentTrack.url) {
        audio.pause();
        audio.currentTime = 0;
        audio.src = currentTrack.url;
        lastUrlRef.current = currentTrack.url;
        audio.load();
        
        // Auto-play when new track is loaded
        if (isPlaying) {
          try {
            if (playPromiseRef.current) {
              playPromiseRef.current.catch(() => {});
            }
            playPromiseRef.current = audio.play();
            await playPromiseRef.current;
          } catch (err: any) {
            console.warn('Auto-play prevented:', err?.name);
          }
        }
      } else {
        // Same track, just manage play/pause state
        if (isPlaying && audio.paused) {
          try {
            if (playPromiseRef.current) {
              playPromiseRef.current.catch(() => {});
            }
            playPromiseRef.current = audio.play();
            await playPromiseRef.current;
          } catch (err: any) {
            console.warn('Play failed:', err);
          }
        } else if (!isPlaying && !audio.paused) {
          audio.pause();
        }
      }
    };

    managePlayback();

    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [currentTrack, isPlaying, onNext, isRepeating]);

  // Update volume when changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
    if (isPlaying) onTogglePlay();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
      lastUrlRef.current = null;
    }
    onClose();
  };

  if (!currentTrack) return null;

  // ✅ FIXED: Use ownerUser if provided, otherwise fallback to uploaderProfile or track artist
  const displayUser = ownerUser || uploaderProfile;
  
  // ✅ FIXED: Get profile picture from user object
  const profilePicture = displayUser 
    ? (displayUser as any).profileImage || (displayUser as any).profile_image_url 
    : null;
  
  // ✅ FIXED: Get display name from user object
  const displayName = displayUser 
    ? displayUser.name || displayUser.username 
    : currentTrack.artist;

  // ✅ FIXED: For podcasts, always show "Host" if type is podcast
  const userRole = currentTrack.type === 'podcast' ? 'Host' : 'Artist';

  // ✅ FIXED: Get track cover or use default
  const trackCover = currentTrack.cover && 
                    currentTrack.cover.trim() !== '' && 
                    currentTrack.cover.startsWith('http')
                    ? currentTrack.cover
                    : DEFAULT_MUSIC_COVER;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#0A0A0A] to-[#1A1A1A] transition-all duration-500 z-[160] shadow-2xl border-t border-[#333] ${
        expanded ? 'h-full' : 'h-24'
      }`}
    >
      {expanded ? (
        {/* EXPANDED VIEW - MODERN BOOMPLAY STYLE */}
        <div className="flex flex-col h-full w-full relative overflow-hidden bg-gradient-to-b from-gray-900 to-black">
          {/* Background Gradient */}
          <div
            className="absolute inset-0 z-0 opacity-40 blur-3xl scale-150 pointer-events-none"
            style={{
              backgroundImage: `url(${trackCover})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          ></div>

          {/* Header */}
          <div className="relative z-10 flex justify-between items-center p-6 pt-8 text-white">
            <button
              onClick={() => setExpanded(false)}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
            >
              <i className="fas fa-chevron-down text-xl"></i>
            </button>

            <div className="flex flex-col items-center">
              <span className="text-xs font-medium text-gray-400">Now Playing</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold text-white">{currentTrack.title}</span>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onLike(String(currentTrack.id), currentTrack.type);
              }}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
            >
              <i className={`${isLiked ? 'fas text-[#F3425F]' : 'far'} fa-heart text-xl`}></i>
            </button>
          </div>

          {/* Rotating Album Art - BOOMPLAY STYLE */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
            <div className="relative mb-12">
              {/* Outer Ring with Gradient */}
              <div className="absolute inset-0 rounded-full animate-spin-slow" style={{
                background: 'conic-gradient(from 0deg, #1877F2, #F3425F, #45BD62, #F7B928, #1877F2)',
                filter: 'blur(8px)',
                opacity: 0.3,
              }}></div>
              
              {/* Album Art Container */}
              <div
                className={`relative w-[280px] h-[280px] rounded-full border-[12px] border-[#1A1A1A]/80 shadow-[0_0_80px_rgba(0,0,0,0.7)] overflow-hidden flex items-center justify-center ${
                  isPlaying ? 'animate-spin-slow' : ''
                }`}
                style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
              >
                {/* Album Art */}
                <img 
                  src={trackCover} 
                  className="w-full h-full object-cover" 
                  alt="Album Art" 
                />
                
                {/* Center Circle */}
                <div className="absolute w-12 h-12 bg-[#0A0A0A] rounded-full border-4 border-[#333] flex items-center justify-center">
                  <div className="w-4 h-4 bg-[#333] rounded-full"></div>
                </div>
              </div>
              
              {/* Play/Pause Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <button
                  onClick={onTogglePlay}
                  className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                >
                  <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-white text-3xl ml-1`}></i>
                </button>
              </div>
            </div>

            {/* Track Info */}
            <div className="text-center px-8 max-w-xl">
              <h2 className="text-2xl font-bold text-white mb-2">{currentTrack.title}</h2>
              
              {/* Artist Info with Profile Picture */}
              <div
                className="flex items-center justify-center gap-3 cursor-pointer group"
                onClick={() => currentTrack.uploaderId && onArtistClick && onArtistClick(currentTrack.uploaderId)}
              >
                {profilePicture ? (
                  <img 
                    src={profilePicture} 
                    className="w-10 h-10 rounded-full border-2 border-white/30 object-cover group-hover:scale-110 transition-transform" 
                    alt="Profile" 
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#1877F2] to-[#F3425F] flex items-center justify-center text-white font-bold">
                    {displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">{displayName}</span>
                    {displayUser?.isVerified && (
                      <i className="fas fa-check-circle text-[#1877F2] text-sm"></i>
                    )}
                  </div>
                  <span className="text-[#B0B3B8] text-sm">{userRole}</span>
                </div>
              </div>

              {/* Total Plays */}
              {totalPlays > 0 && (
                <div className="mt-4">
                  <div className="inline-flex items-center gap-2 bg-[#1877F2]/20 px-4 py-2 rounded-full">
                    <i className="fas fa-headphones text-sm text-[#1877F2]"></i>
                    <span className="text-sm font-medium text-[#B0B3B8]">
                      {totalPlaysLoading ? '...' : `${totalPlays.toLocaleString()} plays`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar & Controls */}
          <div className="relative z-10 p-6 pb-10 bg-gradient-to-t from-black via-black/95 to-transparent">
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between text-sm text-[#B0B3B8] mb-2">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-gray-700/50 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#1877F2]"
              />
            </div>

            {/* Player Controls */}
            <div className="flex items-center justify-between px-4 mb-8">
              <button
                onClick={() => setIsShuffling(!isShuffling)}
                className={`text-xl ${isShuffling ? 'text-[#1877F2]' : 'text-[#B0B3B8] hover:text-white'}`}
              >
                <i className="fas fa-random"></i>
              </button>

              <button onClick={onPrevious} className="text-2xl text-white hover:text-[#1877F2]">
                <i className="fas fa-step-backward"></i>
              </button>

              <button
                onClick={onTogglePlay}
                className="w-16 h-16 bg-gradient-to-r from-[#1877F2] to-[#2D8CFF] rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(24,119,242,0.5)] hover:scale-105 transition-transform"
              >
                <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play ml-1'} text-white text-2xl`}></i>
              </button>

              <button onClick={onNext} className="text-2xl text-white hover:text-[#1877F2]">
                <i className="fas fa-step-forward"></i>
              </button>

              <button
                onClick={() => setIsRepeating(!isRepeating)}
                className={`text-xl ${isRepeating ? 'text-[#1877F2]' : 'text-[#B0B3B8] hover:text-white'}`}
              >
                <i className="fas fa-redo"></i>
              </button>
            </div>

            {/* Volume & Additional Controls */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleStop}
                className="flex items-center gap-2 text-[#B0B3B8] hover:text-white"
              >
                <i className="fas fa-stop"></i>
                <span className="text-sm">Stop</span>
              </button>

              <div className="flex items-center gap-3">
                <i className="fas fa-volume-down text-[#B0B3B8]"></i>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-32 h-1 bg-gray-700/50 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
                <i className="fas fa-volume-up text-[#B0B3B8]"></i>
              </div>

              <button
                onClick={() => onDownload(String(currentTrack.id))}
                className="flex items-center gap-2 text-[#B0B3B8] hover:text-white"
              >
                <i className="fas fa-download"></i>
                <span className="text-sm">Download</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        {/* MINI PLAYER - MODERN DESIGN */}
        <div className="flex items-center justify-between h-full px-6 bg-gradient-to-r from-[#0A0A0A] to-[#1A1A1A]">
          {/* Left: Track Info & Album Art */}
          <div 
            className="flex items-center gap-4 flex-1 cursor-pointer overflow-hidden"
            onClick={() => setExpanded(true)}
          >
            {/* Rotating Mini Album Art */}
            <div className="relative">
              <div className={`w-14 h-14 rounded-full overflow-hidden border-2 border-[#333] ${isPlaying ? 'animate-spin-slow' : ''}`}>
                <img 
                  src={trackCover} 
                  alt="Album Art" 
                  className="w-full h-full object-cover"
                />
              </div>
              {isPlaying && (
                <div className="absolute -inset-2 border-2 border-[#1877F2]/30 rounded-full animate-ping"></div>
              )}
            </div>

            {/* Track Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-semibold text-sm truncate">{currentTrack.title}</h4>
              <div className="flex items-center gap-2 mt-1">
                {profilePicture ? (
                  <img 
                    src={profilePicture} 
                    className="w-4 h-4 rounded-full object-cover border border-white/20"
                    alt="Profile"
                  />
                ) : null}
                <span className="text-gray-400 text-xs truncate flex items-center gap-1">
                  {displayName}
                  {displayUser?.isVerified && (
                    <i className="fas fa-check-circle text-[8px] text-[#1877F2]"></i>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Progress Bar (Mini) */}
          <div className="flex-1 max-w-md mx-4 hidden md:block">
            <div className="relative">
              <div className="h-1 bg-gray-700/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#1877F2] to-[#2D8CFF] rounded-full"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLike(String(currentTrack.id), currentTrack.type);
              }}
              className="text-lg hover:scale-110 transition-transform"
            >
              <i className={`${isLiked ? 'fas text-[#F3425F]' : 'far'} fa-heart`}></i>
            </button>

            <button onClick={onPrevious} className="text-lg text-gray-400 hover:text-white">
              <i className="fas fa-step-backward"></i>
            </button>

            <button
              onClick={onTogglePlay}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isPlaying 
                  ? 'bg-gradient-to-r from-[#F3425F] to-[#FF6B9D]' 
                  : 'bg-gradient-to-r from-[#1877F2] to-[#2D8CFF]'
              }`}
            >
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play ml-0.5'} text-white`}></i>
            </button>

            <button onClick={onNext} className="text-lg text-gray-400 hover:text-white">
              <i className="fas fa-step-forward"></i>
            </button>

            <button
              onClick={handleClose}
              className="text-lg text-gray-400 hover:text-red-500 ml-2"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {/* Add CSS for custom animations */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
      `}</style>
    </div>
  );
};

/* =========================================================
   UPLOAD MODAL (fixed with R2 upload + metadata POST)
========================================================= */

interface AudioUploadModalProps {
  currentUser: User;
  onClose: () => void;
  onUploaded: () => void; // refresh after success
}

const AudioUploadModal: React.FC<AudioUploadModalProps> = ({ currentUser, onClose, onUploaded }) => {
  const [mode, setMode] = useState<'single' | 'album' | 'podcast'>('single');
  const [artist, setArtist] = useState((currentUser as any).name || (currentUser as any).username || '');
  const [genre, setGenre] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const [albumTitle, setAlbumTitle] = useState('');
  const [albumTracks, setAlbumTracks] = useState<{ title: string; file: File; cover?: string; artist?: string }[]>([]);
  const [season, setSeason] = useState('');
  const [episodeNum, setEpisodeNum] = useState('');
  const [guests, setGuests] = useState('');

  const [tempTrackTitle, setTempTrackTitle] = useState('');
  const [tempTrackArtist, setTempTrackArtist] = useState(artist);
  const [tempTrackFile, setTempTrackFile] = useState<File | null>(null);
  const [tempTrackCover, setTempTrackCover] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const trackInputRef = useRef<HTMLInputElement>(null);

  const defaultCover = DEFAULT_MUSIC_COVER;

  const handleAddTrack = () => {
    if (!tempTrackTitle || !tempTrackFile) {
      alert('Track title and audio file are required.');
      return;
    }
    setAlbumTracks((prev) => [...prev, { title: tempTrackTitle, artist: tempTrackArtist, file: tempTrackFile, cover: tempTrackCover }]);
    setTempTrackTitle('');
    setTempTrackFile(null);
    setTempTrackCover('');
  };

  // Upload file to R2 using /api/upload (expects field name "file")
  const uploadToR2 = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);

    const up = await apiForm<{ success: boolean; url: string; key: string }>(
      "/api/upload",
      fd
    );

    if (!up.success) throw new Error(up.error || "Upload failed");
    if (!(up.data as any)?.url) throw new Error("Upload failed: missing url");
    return (up.data as any).url as string;
  };

  const uploadSingle = async (type: "music" | "podcast") => {
    if (!title.trim()) return alert("Title required");
    if (!audioFile) return alert("Audio file required");

    setSubmitting(true);
    try {
      // 1) Upload audio to R2
      const audioUrl = await uploadToR2(audioFile);

      // 2) Upload cover to R2 (optional)
      const coverUrl = coverFile ? await uploadToR2(coverFile) : null;

      if (type === "music") {
        // ✅ FIXED: Use default cover if none uploaded
        const finalCoverUrl = coverUrl || DEFAULT_MUSIC_COVER;
        
        // 3) Save metadata to DB (JSON) -> /api/songs
        const payload = {
          uploader_id: Number((currentUser as any).id),
          title: title.trim(),
          artist_name: (artist || "").trim(),
          album_name: "Single",
          cover_image_url: finalCoverUrl,
          audio_url: audioUrl,
          duration_seconds: null,
          genre: (genre || "").trim() || null,
        };

        const res = await apiJson<any>("/api/songs", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!res.success) {
          console.error("songs create failed:", res);
          alert(res.error || "Failed to publish song");
          return;
        }
      } else {
        // PODCAST: your podcasts.ts expects JSON:
        // { creator_id, title, description, audio_url, cover_url }
        if (!desc.trim()) return alert("Description required for podcast");

        // ✅ FIXED: Use default cover if none uploaded
        const finalCoverUrl = coverUrl || DEFAULT_PODCAST_COVER;
        
        const payload = {
          creator_id: Number((currentUser as any).id),
          title: title.trim(),
          description: desc.trim(),
          audio_url: audioUrl,
          cover_url: finalCoverUrl,
        };

        const res = await apiJson<any>("/api/podcasts", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!res.success) {
          console.error("podcast create failed:", res);
          alert(res.error || "Failed to publish podcast");
          return;
        }
      }

      alert('Published successfully!');
      onUploaded();
      onClose();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadAlbum = async () => {
    if (!albumTitle.trim()) return alert("Album title required");
    if (albumTracks.length === 0) return alert("Add at least 1 track");

    setSubmitting(true);
    try {
      // Optional: one shared cover for all tracks
      const sharedCoverUrl = coverFile ? await uploadToR2(coverFile) : null;

      for (const t of albumTracks) {
        // 1) upload each track audio
        const audioUrl = await uploadToR2(t.file);

        // 2) if track has a cover URL (external), use it; else shared coverUrl; else default
        const coverUrl = t.cover?.trim() ? t.cover.trim() : (sharedCoverUrl || DEFAULT_MUSIC_COVER);

        // 3) create song in DB
        const payload = {
          uploader_id: Number((currentUser as any).id),
          title: (t.title || "").trim(),
          artist_name: (t.artist || artist || "").trim(),
          album_name: albumTitle.trim(),
          cover_image_url: coverUrl,
          audio_url: audioUrl,
          duration_seconds: null,
          genre: (genre || "").trim() || null,
        };

        const res = await apiJson<any>("/api/songs", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!res.success) {
          console.error("album track create failed:", t.title, res);
          alert(`Failed uploading "${t.title}": ${res.error}`);
          return;
        }
      }

      alert('Album published successfully!');
      onUploaded();
      onClose();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Album upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (mode === 'single') await uploadSingle('music');
    if (mode === 'podcast') await uploadSingle('podcast');
    if (mode === 'album') await uploadAlbum();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4">
      <div className="bg-[#1E1E1E] rounded-2xl w-full max-w-3xl border border-[#333] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-[#333] bg-[#252525]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-[#FFF] text-2xl font-bold">Professional Upload</h2>
              <p className="text-[#888] text-sm">Distribute your content to UNERA Music</p>
            </div>
            <i className="fas fa-times text-[#888] cursor-pointer text-xl hover:text-white transition-colors" onClick={onClose}></i>
          </div>

          <div className="flex p-1 bg-[#111] rounded-lg">
            {['single', 'album', 'podcast'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m as any)}
                className={`flex-1 py-2.5 rounded-md font-bold capitalize text-sm transition-all ${
                  mode === m ? 'bg-[#1877F2] text-white shadow-lg' : 'text-[#888] hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">
                  {mode === 'podcast' ? 'Host / Creator Name' : 'Main Artist Name'}
                </label>
                <input
                  className="w-full bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#1877F2]"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Genre / Category</label>
                <input
                  className="w-full bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#1877F2]"
                  placeholder="Pop, Tech, News..."
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">{mode === 'album' ? 'Album Artwork' : 'Artwork'}</label>
                <div
                  onClick={() => coverInputRef.current?.click()}
                  className="w-full bg-[#151515] border border-[#333] rounded-lg h-[120px] flex flex-col items-center justify-center cursor-pointer hover:border-[#1877F2] group relative overflow-hidden"
                >
                  {coverPreview ? (
                    <img src={coverPreview} className="w-full h-full object-cover" alt="Cover Preview" />
                  ) : (
                    <>
                      <i className="fas fa-image text-2xl text-[#666] group-hover:text-white mb-2"></i>
                      <span className="text-[#666] text-xs group-hover:text-white">Upload Image (Optional)</span>
                      <span className="text-[#666] text-xs group-hover:text-white mt-1">Default will be used if none</span>
                    </>
                  )}

                  <input
                    type="file"
                    ref={coverInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setCoverFile(f);
                        setCoverPreview(URL.createObjectURL(f));
                      }
                    }}
                  />
                </div>
              </div>

              {(mode === 'single' || mode === 'podcast') && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#333] bg-[#151515] rounded-lg h-[86px] flex items-center justify-center cursor-pointer hover:border-[#1877F2] group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="audio/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setAudioFile(f);
                    }}
                  />
                  {audioFile ? (
                    <div className="text-[#1877F2] font-semibold flex items-center gap-2">
                      <i className="fas fa-check-circle"></i> {audioFile.name}
                    </div>
                  ) : (
                    <div className="text-[#666] group-hover:text-white flex items-center gap-2">
                      <i className="fas fa-cloud-upload-alt"></i> Upload High Quality Audio
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#333] pt-6">
            {mode === 'single' && (
              <div>
                <label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Song Name</label>
                <input
                  className="w-full bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#1877F2] text-lg font-bold"
                  placeholder="Enter song title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            )}

            {mode === 'podcast' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Episode Title</label>
                  <input
                    className="w-full bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#1877F2] text-lg font-bold"
                    placeholder="e.g. The Future of AI"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <input className="bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none" placeholder="Season (e.g. 1)" value={season} onChange={(e) => setSeason(e.target.value)} />
                  <input className="bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none" placeholder="Episode # (e.g. 5)" value={episodeNum} onChange={(e) => setEpisodeNum(e.target.value)} />
                  <input className="bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none" placeholder="Guest Names" value={guests} onChange={(e) => setGuests(e.target.value)} />
                </div>

                <div>
                  <label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Description / Show Notes</label>
                  <textarea
                    className="w-full bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#1877F2] h-60 resize-none"
                    placeholder="Write a professional description about this episode..."
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                  />
                </div>
              </div>
            )}

            {mode === 'album' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Album Name</label>
                  <input
                    className="w-full bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#1877F2] text-lg font-bold"
                    placeholder="Enter album title..."
                    value={albumTitle}
                    onChange={(e) => setAlbumTitle(e.target.value)}
                  />
                </div>

                <div className="bg-[#111] p-4 rounded-xl border border-[#333]">
                  <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                    <i className="fas fa-list-ol text-[#1877F2]"></i> Add Tracks to Album
                  </h4>

                  <div className="space-y-2 mb-4">
                    {albumTracks.map((t, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded border border-[#333]">
                        <div className="flex items-center gap-3">
                          <span className="text-[#666] font-mono">{idx + 1}</span>
                          <img src={t.cover || coverPreview || DEFAULT_MUSIC_COVER} className="w-8 h-8 rounded object-cover" alt="" />
                          <div>
                            <span className="text-white font-semibold block">{t.title}</span>
                            <span className="text-[#666] text-xs">{t.artist}</span>
                          </div>
                        </div>
                        <i className="fas fa-trash text-red-500 cursor-pointer" onClick={() => setAlbumTracks(albumTracks.filter((_, i) => i !== idx))}></i>
                      </div>
                    ))}
                    {albumTracks.length === 0 && <div className="text-[#666] text-sm text-center py-2">No tracks added yet.</div>}
                  </div>

                  <div className="flex flex-col gap-2 p-3 bg-[#1A1A1A] rounded border border-[#333] border-dashed">
                    <div className="grid grid-cols-2 gap-2">
                      <input className="bg-[#151515] border border-[#333] p-2 rounded text-white text-sm" placeholder="Song Name" value={tempTrackTitle} onChange={(e) => setTempTrackTitle(e.target.value)} />
                      <input className="bg-[#151515] border border-[#333] p-2 rounded text-white text-sm" placeholder="Artist Name" value={tempTrackArtist} onChange={(e) => setTempTrackArtist(e.target.value)} />
                    </div>

                    <input className="w-full bg-[#151515] border border-[#333] p-2 rounded text-white text-sm" placeholder="Specific Artwork URL (Optional)" value={tempTrackCover} onChange={(e) => setTempTrackCover(e.target.value)} />

                    <div className="flex items-center gap-2 mt-2">
                      <div
                        onClick={() => trackInputRef.current?.click()}
                        className="flex-1 bg-[#222] hover:bg-[#333] p-2 rounded text-center cursor-pointer text-sm text-[#888] hover:text-white transition-colors border border-[#444]"
                      >
                        {tempTrackFile ? (
                          <span className="text-[#1877F2] font-bold">
                            <i className="fas fa-file-audio"></i> {tempTrackFile.name}
                          </span>
                        ) : (
                          'Select Audio File'
                        )}
                      </div>

                      <button onClick={handleAddTrack} className="bg-[#1877F2] text-white px-6 py-2 rounded text-sm font-bold hover:bg-[#166FE5]">
                        Add Track
                      </button>
                    </div>

                    <input
                      type="file"
                      ref={trackInputRef}
                      className="hidden"
                      accept="audio/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setTempTrackFile(f);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-[#333] bg-[#252525] flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-60 text-white py-3 px-8 rounded-xl font-bold transition-all shadow-lg text-lg flex items-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Publishing...
              </>
            ) : (
              <>
                <i className="fas fa-cloud-upload-alt"></i> Publish Content
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   API HELPER FUNCTIONS FOR PLAYS AND LIKES
========================================================= */

// ✅ FIXED: Smart play recording with fallback
async function recordSongPlay(songId: string, userId: any) {
  // Try new endpoint first: /api/songs/:id/play
  try {
    const a = await apiJson<any>(`/api/songs/${encodeURIComponent(songId)}/play`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId ?? null }),
    });
    if (a.success) return a.data;
  } catch (error) {
    console.warn('New play endpoint failed, trying fallback...');
  }

  // Fallback to older endpoint: /api/song-plays
  try {
    const b = await apiJson<any>(`/api/song-plays`, {
      method: "POST",
      body: JSON.stringify({ song_id: songId, user_id: userId ?? null }),
    });
    return b.success ? b.data : null;
  } catch (error) {
    console.error('All play endpoints failed:', error);
    return null;
  }
}

// ✅ FIXED: Smart podcast play recording with fallback
async function recordEpisodePlay(episodeId: string, userId: any) {
  // Try new endpoint first: /api/podcasts/:id/play
  try {
    const a = await apiJson<any>(`/api/podcasts/${encodeURIComponent(episodeId)}/play`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId ?? null }),
    });
    if (a.success) return a.data;
  } catch (error) {
    console.warn('New podcast play endpoint failed, trying fallback...');
  }

  // Fallback to older endpoint: /api/podcast-episode-plays
  try {
    const b = await apiJson<any>(`/api/podcast-episode-plays`, {
      method: "POST",
      body: JSON.stringify({ episode_id: episodeId, user_id: userId ?? null }),
    });
    return b.success ? b.data : null;
  } catch (error) {
    console.error('All podcast play endpoints failed:', error);
    return null;
  }
}

// ✅ FIXED: Smart song like with fallback
async function toggleSongLike(songId: string, userId: any, method: 'POST' | 'DELETE' = 'POST') {
  // Try new endpoint first: /api/songs/:id/like
  try {
    const a = await apiJson<any>(`/api/songs/${encodeURIComponent(songId)}/like`, {
      method: method,
      body: JSON.stringify({ user_id: userId }),
    });
    if (a.success) return a.data;
  } catch (error) {
    console.warn('New like endpoint failed, trying fallback...');
  }

  // Fallback to older endpoint: /api/song-likes
  try {
    const endpoint = method === 'DELETE' 
      ? `/api/song-likes?song_id=${encodeURIComponent(songId)}&user_id=${encodeURIComponent(userId)}`
      : '/api/song-likes';
    
    const b = await apiJson<any>(endpoint, {
      method: method,
      body: method === 'DELETE' ? undefined : JSON.stringify({ song_id: songId, user_id: userId }),
    });
    return b.success ? b.data : null;
  } catch (error) {
    console.error('All like endpoints failed:', error);
    return null;
  }
}

// ✅ FIXED: Smart episode like with fallback
async function toggleEpisodeLike(episodeId: string, userId: any, method: 'POST' | 'DELETE' = 'POST') {
  // Try new endpoint first: /api/podcasts/:id/like
  try {
    const a = await apiJson<any>(`/api/podcasts/${encodeURIComponent(episodeId)}/like`, {
      method: method,
      body: JSON.stringify({ user_id: userId }),
    });
    if (a.success) return a.data;
  } catch (error) {
    console.warn('New podcast like endpoint failed, trying fallback...');
  }

  // Fallback to older endpoint: /api/podcast-episode-likes
  try {
    const endpoint = method === 'DELETE'
      ? `/api/podcast-episode-likes?episode_id=${encodeURIComponent(episodeId)}&user_id=${encodeURIComponent(userId)}`
      : '/api/podcast-episode-likes';
    
    const b = await apiJson<any>(endpoint, {
      method: method,
      body: method === 'DELETE' ? undefined : JSON.stringify({ episode_id: episodeId, user_id: userId }),
    });
    return b.success ? b.data : null;
  } catch (error) {
    console.error('All podcast like endpoints failed:', error);
    return null;
  }
}

/* =========================================================
   MAIN MUSIC SYSTEM (PROFESSIONALLY FIXED WITH ALL REQUIREMENTS)
========================================================= */

interface MusicSystemProps {
  currentUser: User | null;
  onPlayTrack: (track: AudioTrack) => void;
  onProfileClick?: (id: number) => void;
  likedTracks: string[];
  onToggleLike: (key: string, liked: boolean) => void;
  playHistory: AudioTrack[];
  onFollow: (userId: number) => Promise<void>;
  checkIsFollowing: (userId: number) => boolean;
  users?: User[];
  currentTrack?: AudioTrack | null;
  isPlaying?: boolean;
  myTotalPlays?: number;
  playsLoading?: boolean;
}

const MusicSystem: React.FC<MusicSystemProps> = ({ 
  currentUser, 
  onPlayTrack, 
  onProfileClick, 
  likedTracks: initialLikedTracks, 
  onToggleLike,
  playHistory,
  onFollow,
  checkIsFollowing,
  users = [],
  currentTrack,
  isPlaying,
  myTotalPlays = 0,
  playsLoading = false
}) => {
  const [view, setView] = useState<'music' | 'podcasts' | 'dashboard' | 'artist'>('music');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null);

  const [songs, setSongs] = useState<Song[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ FIX 1: Keep likedTracks synced with App.tsx changes
  const [likedTracks, setLikedTracks] = useState<string[]>(initialLikedTracks);
  const [downloads, setDownloads] = useState<string[]>([]);

  const [showUploadModal, setShowUploadModal] = useState(false);

  const isAdmin = (currentUser as any)?.role === 'admin';

  // ✅ FIX 1: Sync likedTracks when parent updates
  useEffect(() => {
    setLikedTracks(initialLikedTracks || []);
  }, [initialLikedTracks]);

  // ✅ FIXED: Fetch my likes from backend when user exists
  const fetchMyLikes = useCallback(async () => {
    if (!currentUser) return;

    const userId = String((currentUser as any).id);

    try {
      const [songLikesRes, episodeLikesRes] = await Promise.all([
        apiJson<any[]>(`/api/song-likes?userId=${encodeURIComponent(userId)}`),
        apiJson<any[]>(`/api/podcast-episode-likes?userId=${encodeURIComponent(userId)}`),
      ]);

      const songIds = songLikesRes.success ? (songLikesRes.data || []).map((x: any) => String(x.song_id ?? x.id)) : [];
      const epIds   = episodeLikesRes.success ? (episodeLikesRes.data || []).map((x: any) => String(x.episode_id ?? x.id)) : [];

      // ✅ store as "type:id" so ids don't collide between songs and episodes
      const newLikedTracks = [
        ...songIds.map((id: string) => `music:${id}`),
        ...epIds.map((id: string) => `podcast:${id}`),
      ];
      
      // ✅ FIX 2: Update local state only, App will sync via props
      setLikedTracks(newLikedTracks);
      
      // ✅ FIX 2: Minimize parent sync - only sync if there's a significant difference
      const currentKeys = new Set(newLikedTracks);
      const prevKeys = new Set(initialLikedTracks);
      
      // Only sync if there are actual differences
      if (newLikedTracks.length !== initialLikedTracks.length || 
          !newLikedTracks.every(k => initialLikedTracks.includes(k))) {
        // Sync each track once
        newLikedTracks.forEach(key => {
          onToggleLike(key, true);
        });
      }
    } catch (error) {
      console.error('Failed to fetch likes:', error);
    }
  }, [currentUser, onToggleLike, initialLikedTracks]);

  // ✅ FIXED: Load likes when user changes
  useEffect(() => {
    fetchMyLikes();
  }, [fetchMyLikes]);

  // ✅ FIXED: Check if a track is liked with typed IDs
  const isTrackLiked = useCallback((id: string | number, type: 'music' | 'podcast'): boolean => {
    return likedTracks.includes(`${type}:${String(id)}`);
  }, [likedTracks]);

  // ✅ FIXED: UPDATED toggleLike with immediate heart color change
  const toggleLike = useCallback(async (id: string | number, type: 'music' | 'podcast') => {
    if (!currentUser) {
      return;
    }

    const trackId = String(id);
    const key = `${type}:${trackId}`;
    const isLiked = likedTracks.includes(key);
    const userId = String((currentUser as any).id);

    // ✅ 1. IMMEDIATE UI UPDATE: Change heart color instantly
    setLikedTracks(prev => {
      if (isLiked) {
        return prev.filter(x => x !== key);
      } else {
        return [...prev, key];
      }
    });
    
    // ✅ 2. Call parent handler (App.tsx) with updated state
    onToggleLike(key, !isLiked);

    // ✅ 3. Now sync counts from backend response
    try {
      const res = type === "music"
        ? await toggleSongLike(trackId, userId, isLiked ? 'DELETE' : 'POST')
        : await toggleEpisodeLike(trackId, userId, isLiked ? 'DELETE' : 'POST');

      if (res) {
        // ✅ Get the updated count from backend response
        const likesCount = Number(res.likes_count ?? res.likes ?? res.count ?? 0);
        
        if (type === "music") {
          setSongs(prev => prev.map(song =>
            String(song.id) === trackId
              ? { 
                  ...song, 
                  stats: { 
                    ...(song.stats || {}), 
                    likes: Math.max(likesCount, (song.stats as any)?.likes || 0)
                  } 
                }
              : song
          ));
        } else {
          setEpisodes(prev => prev.map(ep =>
            String(ep.id) === trackId
              ? { 
                  ...ep, 
                  stats: { 
                    ...(ep.stats || {}), 
                    likes: Math.max(likesCount, (ep.stats as any)?.likes || 0)
                  } 
                }
              : ep
          ));
        }
      }
    } catch (error) {
      console.error('Failed to sync like count from backend:', error);
      // If backend fails, revert optimistic like toggle
      setLikedTracks(prev => isLiked ? [...prev, key] : prev.filter(x => x !== key));
      // Also revert parent sync
      onToggleLike(key, isLiked);
    }
  }, [currentUser, likedTracks, onToggleLike]);

  // Structured data (same behavior)
  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'UNERA Music',
      url: 'https://unera.social/music',
      description: 'Stream and upload music on UNERA Social Platform',
      publisher: {
        '@type': 'Organization',
        name: 'UNERA',
        logo: 'https://unera.social/logo.png',
      },
    }),
    []
  );

  const fetchSongs = useCallback(async () => {
    setLoadingSongs(true);
    setError(null);
    const res = await apiJson<any[]>('/api/songs', { method: 'GET' });
    if (!res.success) {
      setError(res.error);
      setLoadingSongs(false);
      return;
    }
    const arr = Array.isArray(res.data) ? res.data : (res.data as any)?.results || [];
    setSongs(arr.map(mapSongFromApi));
    setLoadingSongs(false);
  }, []);

  const fetchPodcasts = useCallback(async () => {
    setLoadingEpisodes(true);
    setError(null);
    const res = await apiJson<any[]>('/api/podcasts', { method: 'GET' });
    if (!res.success) {
      setError(res.error);
      setLoadingEpisodes(false);
      return;
    }
    const arr = Array.isArray(res.data) ? res.data : (res.data as any)?.results || [];
    setEpisodes(arr.map(mapEpisodeFromApi));
    setLoadingEpisodes(false);
  }, []);

  useEffect(() => {
    // load both so dashboard/artist works immediately
    fetchSongs();
    fetchPodcasts();
  }, [fetchSongs, fetchPodcasts]);

  // ✅ FIXED: Record play count when track is played with smart fallback
  const handlePlayTrackFromSong = useCallback((song: Song) => {
    // ✅ Get uploader profile from users list
    const uploaderProfile = users.find((u) => u.id === song.uploaderId);
    
    // ✅ Use the user's actual name from profile, not just song.artist
    const artistName = uploaderProfile?.name || uploaderProfile?.username || song.artist;
    
    const audioTrack: AudioTrack = {
      id: String(song.id),
      title: song.title,
      artist: artistName, // ✅ Use actual profile name
      duration:
        typeof song.duration === 'string'
          ? (() => {
              const parts = song.duration.split(':');
              const mm = Number(parts[0] || 0);
              const ss = Number(parts[1] || 0);
              return mm * 60 + ss || 180;
            })()
          : (song.duration as any) || 180,
      url: song.audioUrl || '',
      uploaderId: song.uploaderId || 1,
      cover: song.cover || DEFAULT_MUSIC_COVER, // ✅ Use default if no cover
      type: 'music',
      isVerified: Boolean((uploaderProfile as any)?.isVerified),
      likesCount: Number((song.stats as any)?.likes || 0),
    } as any;

    // ✅ Immediately play the track
    onPlayTrack(audioTrack);
  }, [users, onPlayTrack]);

  // ✅ FIXED: Record play count for podcasts with smart fallback
  const handlePlayTrackFromEpisode = useCallback((episode: Episode) => {
    // ✅ Get uploader profile from users list
    const uploaderProfile = users.find((u) => u.id === episode.uploaderId);
    
    // ✅ Use the user's actual name from profile, not just episode.host
    const hostName = uploaderProfile?.name || uploaderProfile?.username || episode.host || 'Unknown Host';
    
    const audioTrack: AudioTrack = {
      id: String(episode.id),
      title: episode.title,
      artist: hostName, // ✅ Use actual profile name
      duration:
        typeof episode.duration === 'string'
          ? (() => {
              const parts = episode.duration.split(':');
              const mm = Number(parts[0] || 0);
              const ss = Number(parts[1] || 0);
              return mm * 60 + ss || 1800;
            })()
          : (episode.duration as any) || 1800,
      url: episode.audioUrl || '',
      uploaderId: episode.uploaderId || 1,
      cover: (episode as any).thumbnail || DEFAULT_PODCAST_COVER, // ✅ Use default if no thumbnail
      type: 'podcast',
      isVerified: Boolean((uploaderProfile as any)?.isVerified),
      likesCount: Number((episode.stats as any)?.likes || 0),
    } as any;

    // ✅ Immediately play the track
    onPlayTrack(audioTrack);
  }, [users, onPlayTrack]);

  const handleArtistClick = (uploaderId: number) => {
    if (onProfileClick) onProfileClick(uploaderId);
    else {
      setSelectedArtistId(uploaderId);
      setView('artist');
    }
  };

  // Delete: your list does not show delete endpoints,
  // so this uses a common REST fallback:
  // DELETE /api/songs?id=123   and   DELETE /api/podcasts?id=123
  // If your backend uses a different pattern, tell me and I'll match it.
  const deleteSong = async (id: string) => {
    if (!currentUser || !isAdmin) return;
    if (!confirm('Delete this song?')) return;

    const res = await apiJson<any>(`/api/songs?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.success) {
      alert(res.error || 'Failed to delete');
      return;
    }
    setSongs((prev) => prev.filter((s) => String(s.id) !== id));
  };

  const deleteEpisode = async (id: string) => {
    if (!currentUser || !isAdmin) return;
    if (!confirm('Delete this episode?')) return;

    const res = await apiJson<any>(`/api/podcasts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.success) {
      alert(res.error || 'Failed to delete');
      return;
    }
    setEpisodes((prev) => prev.filter((e) => String(e.id) !== id));
  };

  const handleDownload = (id: string) => {
    if (!currentUser) {
      return;
    }
    if (!downloads.includes(id)) {
      setDownloads((prev) => [...prev, id]);
    }
  };

  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  }, [songs, searchQuery]);

  const filteredEpisodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return episodes;
    return episodes.filter((e) => e.title.toLowerCase().includes(q) || (e.host || '').toLowerCase().includes(q));
  }, [episodes, searchQuery]);

  const trendingSongs = useMemo(() => {
    return [...songs].sort((a, b) => ((b.stats as any)?.plays || 0) - ((a.stats as any)?.plays || 0)).slice(0, 5);
  }, [songs]);

  const recentSongs = useMemo(() => {
    return [...songs]
      .sort((a, b) => new Date(b.uploadDate || 0).getTime() - new Date(a.uploadDate || 0).getTime())
      .slice(0, 5);
  }, [songs]);

  // ✅ FIXED: Dashboard stats calculations
  const dashboardStats = useMemo(() => {
    const totalPlays =
      songs.reduce((sum, s) => sum + (Number((s.stats as any)?.plays) || 0), 0) +
      episodes.reduce((sum, e) => sum + (Number((e.stats as any)?.plays) || 0), 0);

    const totalLikesReceived =
      songs.reduce((sum, s) => sum + (Number((s.stats as any)?.likes) || 0), 0) +
      episodes.reduce((sum, e) => sum + (Number((e.stats as any)?.likes) || 0), 0);

    const totalTracks = songs.length + episodes.length;

    const myId = Number((currentUser as any)?.id || 0);

    const userSongs = songs.filter((s) => Number(s.uploaderId) === myId);
    const userEpisodes = episodes.filter((e) => Number(e.uploaderId) === myId);

    const userPlays =
      userSongs.reduce((sum, s) => sum + (Number((s.stats as any)?.plays) || 0), 0) +
      userEpisodes.reduce((sum, e) => sum + (Number((e.stats as any)?.plays) || 0), 0);

    const userLikesReceived =
      userSongs.reduce((sum, s) => sum + (Number((s.stats as any)?.likes) || 0), 0) +
      userEpisodes.reduce((sum, e) => sum + (Number((e.stats as any)?.likes) || 0), 0);

    return {
      totalPlays,
      totalTracks,
      totalLikesReceived,
      userSongs: userSongs.length,
      userEpisodes: userEpisodes.length,
      userUploads: userSongs.length + userEpisodes.length,
      userPlays,
      userLikesReceived,
      myLikesCount: likedTracks.length,
      myTotalPlays: myTotalPlays || 0,
    };
  }, [songs, episodes, currentUser, likedTracks, myTotalPlays]);

  const selectedArtistUser: User | null = useMemo(() => {
    if (!selectedArtistId) return null;

    // if profile exists in users, use it
    const found = users.find((u) => u.id === selectedArtistId);
    if (found) return found;

    // fallback to artist name from songs
    const artistName = songs.find((s) => s.uploaderId === selectedArtistId)?.artist || 'Artist';

    return {
      id: selectedArtistId,
      name: artistName,
      profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(artistName)}&background=random`,
      coverImage:
        'https://images.unsplash.com/photo-1514525253440-b393452e8d26?ixlib=rb-1.2.1&auto=format&fit=crop&w=1500&q=80',
      followers: [],
      following: [],
      isOnline: false,
      isVerified: false,
      role: 'user',
    } as any;
  }, [selectedArtistId, users, songs]);

  // SEO schema
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'MusicGroup',
      name: 'UNERA Music',
      description: 'Stream and upload music on UNERA Social Platform',
      url: typeof window !== 'undefined' ? window.location.href : 'https://unera.social/music',
      track: songs.slice(0, 10).map((song) => ({
        '@type': 'MusicRecording',
        name: song.title,
        byArtist: { '@type': 'MusicGroup', name: song.artist },
        duration: typeof song.duration === 'string' ? song.duration : 'PT3M',
        url: song.audioUrl,
      })),
    };

    const existing = document.querySelector('script[type="application/ld+json"][data-unera-music="1"]');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-unera-music', '1');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [songs]);

  const showLoading = (view === 'music' && loadingSongs) || (view === 'podcasts' && loadingEpisodes);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      {/* Navigation Tabs */}
      <div className="sticky top-14 bg-[#0A0A0A]/95 backdrop-blur-md z-30 px-4 py-4 border-b border-[#222] flex gap-6 overflow-x-auto scrollbar-hide">
        <button onClick={() => setView('music')} className={`cursor-pointer font-bold text-sm whitespace-nowrap ${view === 'music' ? 'text-[#1877F2]' : 'text-gray-400 hover:text-white'}`}>
          MUSIC
        </button>
        <button onClick={() => setView('podcasts')} className={`cursor-pointer font-bold text-sm whitespace-nowrap ${view === 'podcasts' ? 'text-[#1877F2]' : 'text-gray-400 hover:text-white'}`}>
          PODCASTS
        </button>

        {currentUser && (
          <button onClick={() => setView('dashboard')} className={`cursor-pointer font-bold text-sm whitespace-nowrap ${view === 'dashboard' ? 'text-[#1877F2]' : 'text-gray-400 hover:text-white'}`}>
            DASHBOARD
          </button>
        )}

        {selectedArtistId && (
          <button onClick={() => setView('artist')} className={`cursor-pointer font-bold text-sm whitespace-nowrap ${view === 'artist' ? 'text-[#1877F2]' : 'text-gray-400 hover:text-white'}`}>
            ARTIST
          </button>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">🎵 UNERA Music</h1>
              <p className="text-[#B0B3B8] text-lg">Stream and discover trending music</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search music or podcasts..."
                  className="bg-[#242526] text-white px-4 py-3 pl-10 rounded-xl w-full md:w-64 border border-[#3E4042] focus:border-[#1877F2] focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <i className="fas fa-search absolute left-3 top-3.5 text-[#B0B3B8]"></i>
              </div>

              <button
                onClick={() => {
                  // manual refresh
                  fetchSongs();
                  fetchPodcasts();
                }}
                className="bg-[#242526] border border-[#3E4042] px-4 py-3 rounded-xl hover:border-[#1877F2] transition-colors"
                title="Refresh"
              >
                <i className="fas fa-rotate-right text-[#B0B3B8]"></i>
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <i className="fas fa-triangle-exclamation"></i>
                  <span className="text-sm font-semibold">{error}</span>
                </div>
                <button onClick={() => { fetchSongs(); fetchPodcasts(); }} className="text-sm font-bold text-[#1877F2] hover:underline">
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>

        {showLoading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* MUSIC VIEW */}
        {view === 'music' && !showLoading && (
          <div className="space-y-8">
            {/* Now Playing Stats */}
            {currentUser && currentTrack && (
              <div className="bg-[#242526] p-4 rounded-xl border border-[#333]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full overflow-hidden ${isPlaying ? 'animate-spin-slow' : ''}`}>
                      <img src={currentTrack.cover} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div>
                      <p className="text-[#B0B3B8] text-xs">Now Playing</p>
                      <p className="text-lg font-bold text-white truncate max-w-xs">{currentTrack.title}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[#B0B3B8] text-sm">{currentTrack.artist}</span>
                        {currentTrack.isVerified && <i className="fas fa-check-circle text-[10px] text-[#1877F2]"></i>}
                      </div>
                    </div>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPlaying ? 'bg-[#1877F2]' : 'bg-[#3E4042]'}`}>
                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play ml-0.5'} text-white`}></i>
                  </div>
                </div>
              </div>
            )}

            {/* Trending */}
            <div className="bg-[#242526] rounded-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">🔥 Trending Now</h2>
                  <p className="text-[#B0B3B8] text-sm mt-1">Most streamed music this week</p>
                </div>
                <button className="text-[#1877F2] hover:text-[#166FE5] font-semibold">View Chart</button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {trendingSongs.length > 0 ? (
                  trendingSongs.map((song) => {
                    const isLiked = isTrackLiked(String(song.id), 'music');
                    const uploaderProfile = users.find((u) => u.id === song.uploaderId);
                    const profilePicture = uploaderProfile 
                      ? (uploaderProfile as any).profileImage || (uploaderProfile as any).profile_image_url 
                      : null;
                    
                    // ✅ Use actual profile name
                    const artistName = uploaderProfile?.name || uploaderProfile?.username || song.artist;
                    
                    return (
                      <div
                        key={song.id}
                        className="bg-[#3A3B3C] rounded-xl overflow-hidden hover:bg-[#4E4F50] transition-colors cursor-pointer group"
                        onClick={() => handlePlayTrackFromSong(song)}
                      >
                        <div className="relative aspect-square overflow-hidden">
                          <img 
                            src={song.cover || DEFAULT_MUSIC_COVER} 
                            alt={song.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          />
                          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">🔥 {(song.stats as any)?.plays || 0}</div>
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                              <i className="fas fa-play text-black text-xl ml-1"></i>
                            </div>
                          </div>
                        </div>

                        <div className="p-3">
                          <h3 className="font-bold text-white truncate text-sm">{song.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {profilePicture ? (
                              <img 
                                src={profilePicture} 
                                className="w-4 h-4 rounded-full object-cover border border-white/20"
                                alt="Profile"
                              />
                            ) : null}
                            <p 
                              className="text-[#B0B3B8] text-xs truncate flex items-center gap-1 cursor-pointer hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (song.uploaderId) handleArtistClick(song.uploaderId);
                              }}
                            >
                              {artistName}
                              {uploaderProfile?.isVerified && <i className="fas fa-check-circle text-[#1877F2] text-xs"></i>}
                            </p>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-[#B0B3B8] text-xs">{(song as any).duration || '3:00'}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLike(String(song.id), 'music');
                              }}
                              className="text-sm hover:scale-110 transition-transform flex items-center gap-1"
                              title="Like"
                            >
                              <i className={`${isLiked ? 'fas text-[#F3425F]' : 'far'} fa-heart`}></i>
                              <span className="text-xs ml-1 text-[#B0B3B8]">{(song.stats as any)?.likes || 0}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-5 text-center py-8">
                    <i className="fas fa-fire text-4xl text-[#B0B3B8] mb-4"></i>
                    <p className="text-[#B0B3B8]">No trending music yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* New Releases */}
            <div className="bg-[#242526] rounded-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">✨ New Releases</h2>
                  <p className="text-[#B0B3B8] text-sm mt-1">Recently uploaded music</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {recentSongs.length > 0 ? (
                  recentSongs.map((song) => {
                    const isLiked = isTrackLiked(String(song.id), 'music');
                    const uploaderProfile = users.find((u) => u.id === song.uploaderId);
                    const profilePicture = uploaderProfile 
                      ? (uploaderProfile as any).profileImage || (uploaderProfile as any).profile_image_url 
                      : null;
                    
                    // ✅ Use actual profile name
                    const artistName = uploaderProfile?.name || uploaderProfile?.username || song.artist;
                    
                    return (
                      <div
                        key={song.id}
                        className="bg-[#3A3B3C] rounded-xl overflow-hidden hover:bg-[#4E4F50] transition-colors cursor-pointer group"
                        onClick={() => handlePlayTrackFromSong(song)}
                      >
                        <div className="relative aspect-square overflow-hidden">
                          <img 
                            src={song.cover || DEFAULT_MUSIC_COVER} 
                            alt={song.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          />
                          <div className="absolute top-2 left-2 bg-[#1877F2] text-white text-xs font-bold px-2 py-1 rounded">NEW</div>
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                              <i className="fas fa-play text-black text-xl ml-1"></i>
                            </div>
                          </div>
                        </div>

                        <div className="p-3">
                          <h3 className="font-bold text-white truncate text-sm">{song.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {profilePicture ? (
                              <img 
                                src={profilePicture} 
                                className="w-4 h-4 rounded-full object-cover border border-white/20"
                                alt="Profile"
                              />
                            ) : null}
                            <p 
                              className="text-[#B0B3B8] text-xs truncate flex items-center gap-1 cursor-pointer hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (song.uploaderId) handleArtistClick(song.uploaderId);
                              }}
                            >
                              {artistName}
                              {uploaderProfile?.isVerified && <i className="fas fa-check-circle text-[#1877F2] text-xs"></i>}
                            </p>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-[#B0B3B8] text-xs">{(song as any).duration || '3:00'}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLike(String(song.id), 'music');
                              }}
                              className="text-sm hover:scale-110 transition-transform flex items-center gap-1"
                              title="Like"
                            >
                              <i className={`${isLiked ? 'fas text-[#F3425F]' : 'far'} fa-heart`}></i>
                              <span className="text-xs ml-1 text-[#B0B3B8]">{(song.stats as any)?.likes || 0}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-5 text-center py-8">
                    <i className="fas fa-music text-4xl text-[#B0B3B8] mb-4"></i>
                    <p className="text-[#B0B3B8]">No new releases yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* All Music */}
            <div className="bg-[#242526] rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">All Music ({filteredSongs.length})</h2>

              <div className="space-y-2">
                {filteredSongs.length > 0 ? (
                  filteredSongs.map((song, index) => {
                    const isCurrentTrack = currentTrack && 
                      currentTrack.type === 'music' && 
                      String(currentTrack.id) === String(song.id);
                    const isLiked = isTrackLiked(String(song.id), 'music');
                    const uploaderProfile = users.find((u) => u.id === song.uploaderId);
                    const profilePicture = uploaderProfile 
                      ? (uploaderProfile as any).profileImage || (uploaderProfile as any).profile_image_url 
                      : null;
                    
                    // ✅ Use actual profile name
                    const artistName = uploaderProfile?.name || uploaderProfile?.username || song.artist;
                    
                    return (
                      <div
                        key={song.id}
                        className={`flex items-center gap-4 p-4 hover:bg-[#3A3B3C] rounded-xl cursor-pointer transition-colors group ${
                          isCurrentTrack ? 'bg-[#1877F2]/10 border-l-4 border-[#1877F2]' : ''
                        }`}
                        onClick={() => handlePlayTrackFromSong(song)}
                      >
                        <div className="text-[#B0B3B8] font-bold w-6 text-center">
                          {isCurrentTrack && isPlaying ? (
                            <div className="flex items-center gap-1">
                              <div className="w-1 h-3 bg-[#1877F2] animate-bounce"></div>
                              <div className="w-1 h-3 bg-[#1877F2] animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-1 h-3 bg-[#1877F2] animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                          ) : (
                            index + 1
                          )}
                        </div>

                        <img 
                          src={song.cover || DEFAULT_MUSIC_COVER} 
                          alt={song.title} 
                          className="w-12 h-12 rounded-lg object-cover" 
                        />

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white truncate">{song.title}</h3>

                          <div
                            className="flex items-center gap-2 text-[#B0B3B8] text-sm cursor-pointer hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (song.uploaderId) handleArtistClick(song.uploaderId);
                            }}
                          >
                            {profilePicture ? (
                              <img 
                                src={profilePicture} 
                                className="w-4 h-4 rounded-full object-cover border border-white/20"
                                alt="Profile"
                              />
                            ) : null}
                            <span>{artistName}</span>
                            {uploaderProfile?.isVerified && <i className="fas fa-check-circle text-[#1877F2] text-xs"></i>}
                            {(song.stats as any)?.plays > 1000 && (
                              <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded ml-2">🔥 {(song.stats as any).plays} plays</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="text-[#B0B3B8] text-sm">{(song as any).duration || '3:00'}</span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLike(String(song.id), 'music');
                            }}
                            className="text-lg hover:scale-110 transition-transform flex items-center gap-1"
                            title="Like"
                          >
                            <i className={`${isLiked ? 'fas text-[#F3425F]' : 'far'} fa-heart`}></i>
                            <span className="text-xs text-[#B0B3B8]">{(song.stats as any)?.likes || 0}</span>
                          </button>

                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSong(String(song.id));
                              }}
                              className="text-red-500 hover:text-red-400"
                              title="Delete"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <i className="fas fa-music text-5xl text-[#B0B3B8] mb-4"></i>
                    <p className="text-[#B0B3B8] text-lg">No songs found</p>
                    {searchQuery && <p className="text-[#B0B3B8] text-sm mt-2">Try a different search term</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PODCAST VIEW - ✅ FIXED: Show podcast owner profile */}
        {view === 'podcasts' && !showLoading && (
          <div className="space-y-8">
            <div className="bg-[#242526] rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Podcasts & Episodes ({filteredEpisodes.length})</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEpisodes.length > 0 ? (
                  filteredEpisodes.map((episode) => {
                    const isCurrentTrack = currentTrack && 
                      currentTrack.type === 'podcast' && 
                      String(currentTrack.id) === String(episode.id);
                    const isLiked = isTrackLiked(String(episode.id), 'podcast');
                    const uploaderProfile = users.find((u) => u.id === episode.uploaderId);
                    const profilePicture = uploaderProfile 
                      ? (uploaderProfile as any).profileImage || (uploaderProfile as any).profile_image_url 
                      : null;
                    
                    // ✅ Use actual profile name for host
                    const hostName = uploaderProfile?.name || uploaderProfile?.username || episode.host || 'Host';
                    
                    return (
                      <div
                        key={episode.id}
                        className={`bg-[#3A3B3C] rounded-xl overflow-hidden hover:bg-[#4E4F50] transition-colors cursor-pointer group ${
                          isCurrentTrack ? 'border-2 border-[#1877F2]' : ''
                        }`}
                        onClick={() => handlePlayTrackFromEpisode(episode)}
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="relative w-16 h-16 flex-shrink-0">
                              <img 
                                src={episode.thumbnail || DEFAULT_PODCAST_COVER} 
                                alt={episode.title} 
                                className="w-full h-full object-cover rounded-lg" 
                              />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <i className="fas fa-play text-white"></i>
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-white line-clamp-2">{episode.title}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                {profilePicture ? (
                                  <img 
                                    src={profilePicture} 
                                    className="w-4 h-4 rounded-full object-cover border border-white/20"
                                    alt="Profile"
                                  />
                                ) : null}
                                <p 
                                  className="text-[#B0B3B8] text-sm flex items-center gap-1 cursor-pointer hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (episode.uploaderId) handleArtistClick(episode.uploaderId);
                                  }}
                                >
                                  {hostName} {/* ✅ Now shows actual user name */}
                                  {uploaderProfile?.isVerified && <i className="fas fa-check-circle text-[#1877F2] text-xs"></i>}
                                  <span className="text-xs text-gray-500 ml-1">(Host)</span>
                                </p>
                              </div>

                              <div className="flex items-center justify-between mt-3">
                                <span className="text-[#B0B3B8] text-xs">{(episode as any).duration || '45:00'}</span>

                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLike(String(episode.id), 'podcast');
                                    }}
                                    className="text-lg hover:scale-110 transition-transform flex items-center gap-1"
                                    title="Like"
                                  >
                                    <i className={`${isLiked ? 'fas text-[#F3425F]' : 'far'} fa-heart`}></i>
                                    <span className="text-xs text-[#B0B3B8]">{(episode.stats as any)?.likes || 0}</span>
                                  </button>

                                  {isAdmin && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteEpisode(String(episode.id));
                                      }}
                                      className="text-red-500 hover:text-red-400"
                                      title="Delete"
                                    >
                                      <i className="fas fa-trash"></i>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {(episode as any).description && <p className="text-[#B0B3B8] text-sm mt-3 line-clamp-2">{(episode as any).description}</p>}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-3 text-center py-12">
                    <i className="fas fa-podcast text-5xl text-[#B0B3B8] mb-4"></i>
                    <p className="text-[#B0B3B8] text-lg">No podcasts found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {view === 'dashboard' && currentUser && !showLoading && (
          <div className="space-y-8">
            <div className="bg-[#242526] rounded-2xl p-6">
              <div className="flex flex-col items-center justify-center mb-10 mt-4 text-center">
                <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-white to-gray-400 text-transparent bg-clip-text">Creator Studio</h2>
                <p className="text-[#888] mb-6 max-w-2xl">Upload your music, podcasts, and albums. Monitor your performance.</p>

                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-gradient-to-r from-[#1877F2] to-[#0062E3] px-10 py-4 rounded-full font-bold flex items-center gap-3 hover:scale-105 transition-transform shadow-[0_4px_20px_rgba(24,119,242,0.5)] text-lg"
                >
                  <i className="fas fa-cloud-upload-alt text-2xl"></i> Upload New Content
                </button>
              </div>

              {/* Dashboard stats cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-[#333]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#B0B3B8] text-sm">Likes on Your Content</p>
                      <p className="text-2xl font-bold text-white">{dashboardStats.userLikesReceived.toLocaleString()}</p>
                    </div>
                    <i className="fas fa-heart text-[#F3425F] text-xl"></i>
                  </div>
                  <p className="text-[#888] text-xs mt-2">Likes your content received</p>
                </div>

                <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-[#333]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#B0B3B8] text-sm">Your Uploads</p>
                      <p className="text-2xl font-bold text-white">{dashboardStats.userUploads}</p>
                    </div>
                    <i className="fas fa-upload text-[#45BD62] text-xl"></i>
                  </div>
                  <p className="text-[#888] text-xs mt-2">{dashboardStats.userSongs} songs + {dashboardStats.userEpisodes} podcasts</p>
                </div>

                <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-[#333]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#B0B3B8] text-sm">My Total Plays</p>
                      <p className="text-2xl font-bold text-white">{myTotalPlays.toLocaleString()}</p>
                    </div>
                    <i className="fas fa-play-circle text-[#F7B928] text-xl"></i>
                  </div>
                  <p className="text-[#888] text-xs mt-2">Plays you've made across UNERA</p>
                </div>
              </div>

              {/* Catalog */}
              <div className="bg-[#1E1E1E] rounded-2xl border border-[#333] overflow-hidden">
                <div className="p-6 border-b border-[#333]">
                  <h3 className="text-xl font-bold text-white">Your Catalog</h3>
                  <p className="text-[#888] text-sm">Manage your uploaded content</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#252525] text-[#888] text-xs uppercase font-bold">
                      <tr>
                        <th className="p-4">Content</th>
                        <th className="p-4">Type</th>
                        <th className="p-4 text-right">Plays</th>
                        <th className="p-4 text-right">Likes</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#333]">
                      {[...songs.filter((s) => s.uploaderId === (currentUser as any).id), ...episodes.filter((e) => e.uploaderId === (currentUser as any).id)].map((item: any) => (
                        <tr key={item.id} className="hover:bg-[#2A2A2A]">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img src={item.cover || item.thumbnail || DEFAULT_MUSIC_COVER} className="w-10 h-10 rounded object-cover" alt="" />
                              <div>
                                <div className="font-bold text-white text-sm">{item.title}</div>
                                <div className="text-xs text-[#888]">{item.artist || item.host}</div>
                              </div>
                            </div>
                          </td>

                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs ${item.host ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {item.host ? 'Podcast' : 'Music'}
                            </span>
                          </td>

                          <td className="p-4 text-right font-bold text-sm">{(item.stats as any)?.plays || 0}</td>
                          
                          <td className="p-4 text-right font-bold text-sm">{(item.stats as any)?.likes || 0}</td>

                          <td className="p-4 text-right">
                            <button
                              onClick={() => (item.host ? deleteEpisode(String(item.id)) : deleteSong(String(item.id)))}
                              className="text-red-500 hover:text-red-400 p-2"
                              title="Delete"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </td>
                        </tr>
                      ))}

                      {songs.filter((s) => s.uploaderId === (currentUser as any).id).length === 0 && episodes.filter((e) => e.uploaderId === (currentUser as any).id).length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-[#666]">
                            <div className="mb-3">
                              <i className="fas fa-music text-4xl opacity-50"></i>
                            </div>
                            <p className="text-lg">No uploads yet.</p>
                            <p className="text-sm">Start by clicking "Upload New Content" above.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="mt-8 bg-[#1E1E1E] rounded-2xl border border-[#333] p-6">
                <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {playHistory.slice(0, 5).map((track, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 hover:bg-[#2A2A2A] rounded-lg">
                      <img src={track.cover || DEFAULT_MUSIC_COVER} className="w-10 h-10 rounded object-cover" alt="" />
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">{track.title}</div>
                        <div className="text-xs text-[#888]">{track.artist}</div>
                      </div>
                      <div className="text-xs text-[#888]">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                  {playHistory.length === 0 && (
                    <div className="text-center py-4 text-[#666]">
                      <i className="fas fa-history text-2xl mb-2"></i>
                      <p>No recent plays</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ARTIST VIEW */}
        {view === 'artist' && selectedArtistUser && !showLoading && (
          <div className="space-y-8">
            <div className="bg-[#242526] rounded-2xl overflow-hidden">
              <div className="h-48 relative">
                <img src={(selectedArtistUser as any).coverImage || (selectedArtistUser as any).profileImage} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] to-transparent"></div>

                <div className="absolute bottom-4 left-4 flex items-end gap-4">
                  <img src={(selectedArtistUser as any).profileImage} className="w-20 h-20 rounded-full border-4 border-[#0A0A0A] shadow-xl object-cover" alt="" />
                  <div className="mb-2">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                      {selectedArtistUser.name}
                      {(selectedArtistUser as any).isVerified && <i className="fas fa-check-circle text-[#1877F2] text-sm"></i>}
                    </h1>
                    <p className="text-[#CCC] text-sm">{((selectedArtistUser as any).followers?.length || 0)} Followers</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-white mb-4">Popular Releases</h2>
                  <div className="space-y-2">
                    {songs
                      .filter((s) => s.uploaderId === selectedArtistUser.id)
                      .slice(0, 5)
                      .map((song, i) => {
                        const isLiked = isTrackLiked(String(song.id), 'music');
                        return (
                          <div
                            key={song.id}
                            className="flex items-center gap-4 p-3 hover:bg-[#3A3B3C] rounded-xl cursor-pointer transition-colors group"
                            onClick={() => handlePlayTrackFromSong(song)}
                          >
                            <div className="text-[#B0B3B8] font-bold w-4 text-center group-hover:hidden">{i + 1}</div>
                            <div className="hidden group-hover:block w-4 text-center text-white">
                              <i className="fas fa-play"></i>
                            </div>

                            <img src={song.cover || DEFAULT_MUSIC_COVER} className="w-10 h-10 rounded object-cover" alt="" />

                            <div className="flex-1">
                              <div className="font-bold text-white text-sm">{song.title}</div>
                              <div className="text-xs text-[#888]">{(song.stats as any)?.plays || 0} plays</div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-sm text-[#B0B3B8]">{(song as any).duration || '3:00'}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLike(String(song.id), 'music');
                                }}
                                className="text-lg hover:scale-110 transition-transform"
                                title="Like"
                              >
                                <i className={`${isLiked ? 'fas text-[#F3425F]' : 'far'} fa-heart`}></i>
                              </button>
                            </div>
                          </div>
                        );
                      })}

                    {songs.filter((s) => s.uploaderId === selectedArtistUser.id).length === 0 && <p className="text-[#666] text-center py-4">No tracks available from this artist.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && currentUser && (
        <AudioUploadModal
          currentUser={currentUser}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => {
            fetchSongs();
            fetchPodcasts();
          }}
        />
      )}
    </div>
  );
};

export default MusicSystem;
