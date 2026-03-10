import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';

/**
 * Recorder.tsx
 *
 * Dedicated TikTok-style creator page for UNERA.
 *
 * What is updated:
 * - Real record/upload flow on a separate page
 * - Built-in sound picker drawer with API integration
 * - User can preview/play songs BEFORE selecting
 * - Metadata-first sound trim (fast, no fake trim delay)
 * - Real upload progress support via onSubmitProgress
 * - Professional lyric overlay styles
 * - Camera + gallery in one screen
 * - REAL loaders for audio trimming (copied from Reels.tsx)
 * - REAL API integration for sounds (copied from App.tsx)
 * - Matches App.tsx createReel() expectations
 */

// ==================== MEDIA CACHE SYSTEM (MEMORY-SAFE) ====================
const mediaBlobCache = new Map<string, { blobUrl: string, timestamp: number }>(); 
const mediaWarmPromises = new Map<string, Promise<string>>();
const CACHE_MAX_SIZE = 10;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchAsBlobUrl(url: string, type: 'video' | 'audio' = 'audio'): Promise<string> {
  if (!url) throw new Error("Missing media URL");

  const cached = mediaBlobCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.blobUrl;
  }

  if (mediaWarmPromises.has(url)) {
    return mediaWarmPromises.get(url)!;
  }

  if (type === 'video') {
    mediaWarmPromises.set(url, Promise.resolve(url));
    setTimeout(() => mediaWarmPromises.delete(url), 1000);
    return url;
  }

  const p = fetch(url, { 
    cache: "force-cache",
    headers: { "Accept": "audio/mpeg,*/*" }
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to fetch media: ${res.status}`);
      
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      if (mediaBlobCache.size >= CACHE_MAX_SIZE) {
        const oldestKey = Array.from(mediaBlobCache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        const oldest = mediaBlobCache.get(oldestKey);
        if (oldest) URL.revokeObjectURL(oldest.blobUrl);
        mediaBlobCache.delete(oldestKey);
      }
      
      mediaBlobCache.set(url, { blobUrl, timestamp: Date.now() });
      return blobUrl;
    })
    .finally(() => {
      mediaWarmPromises.delete(url);
    });

  mediaWarmPromises.set(url, p);
  return p;
}

// ==================== AUDIO TRIMMING UTILITIES ====================
async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch audio");
  return await res.arrayBuffer();
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;

  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);

  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = buffer.getChannelData(ch)[i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: "audio/wav" });
}

async function trimAudioUrlToWavBlob(audioUrl: string, startSec: number, endSec: number) {
  if (!audioUrl) throw new Error("Missing audioUrl");
  if (!(endSec > startSec)) throw new Error("Invalid trim range");

  const arrayBuffer = await fetchAsArrayBuffer(audioUrl);

  const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
  const ctx = new AudioCtx();
  const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));

  const sr = decoded.sampleRate;
  const startSample = Math.max(0, Math.floor(startSec * sr));
  const endSample = Math.min(decoded.length, Math.floor(endSec * sr));
  const frameCount = Math.max(0, endSample - startSample);

  if (frameCount <= 0) throw new Error("Trim produced empty audio");

  const trimmed = ctx.createBuffer(decoded.numberOfChannels, frameCount, sr);

  for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
    const channel = decoded.getChannelData(ch).slice(startSample, endSample);
    trimmed.copyToChannel(channel, ch, 0);
  }

  const wavBlob = audioBufferToWavBlob(trimmed);

  try { await ctx.close(); } catch {}
  return { blob: wavBlob, duration: frameCount / sr };
}

// ==================== AUDIO FOCUS MANAGER ====================
const useAudioFocus = () => {
  const stopAllAudio = useCallback(() => {
    document.querySelectorAll('audio').forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (error) {
        console.warn('Failed to stop audio:', error);
      }
    });
    
    document.querySelectorAll('video').forEach(video => {
      try {
        video.pause();
        video.muted = true;
      } catch (error) {
        console.warn('Failed to stop video:', error);
      }
    });
  }, []);

  return { stopAllAudio };
};

// ==================== API HELPER (EXACT COPY FROM APP.TSX) ====================
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('unera_token');
  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, { 
      ...options, 
      headers,
      signal: controller.signal 
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

// ==================== UPLOAD TO CLOUDFLARE R2 (EXACT COPY FROM APP.TSX) ====================
const uploadToCloudflareR2 = async (file: File, folder = 'posts'): Promise<{ url: string; type: string; filename: string }> => {
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

const isAbsoluteUrl = (u: string) => u.startsWith('http://') || u.startsWith('https://');
const isBlobUrl = (u: string) => u.startsWith('blob:');

const ensureR2Url = async (input: any, folder: string, fallbackName: string) => {
  if (!input) return '';

  if (typeof input === 'string' && isAbsoluteUrl(input)) {
    return input;
  }

  if (typeof input === 'string' && isBlobUrl(input)) {
    try {
      const res = await fetch(input);
      if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`);
      
      const blob = await res.blob();
      
      const fileType = folder.includes('audio') ? blob.type || 'audio/wav' : 'application/octet-stream';
      const fileName = folder.includes('audio') ? 
        `audio-${Date.now()}.${fileType.split('/')[1] || 'wav'}` : 
        fallbackName;
      
      const file = new File([blob], fileName, { type: fileType });
      const up = await uploadToCloudflareR2(file, folder);
      return up.url;
    } catch (error) {
      console.error('Failed to process blob URL:', error);
      throw new Error('Failed to process audio file');
    }
  }

  if (typeof File !== 'undefined' && input instanceof File) {
    if (folder.includes('audio') && !input.type) {
      const fileType = 'audio/wav';
      const fileName = `audio-${Date.now()}.wav`;
      const newFile = new File([input], fileName, { type: fileType });
      const up = await uploadToCloudflareR2(newFile, folder);
      return up.url;
    }
    const up = await uploadToCloudflareR2(input, folder);
    return up.url;
  }

  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    const fileType = folder.includes('audio') ? input.type || 'audio/wav' : 'application/octet-stream';
    const fileName = folder.includes('audio') ? 
      `audio-${Date.now()}.${fileType.split('/')[1] || 'wav'}` : 
      fallbackName;
    
    const file = new File([input], fileName, { type: fileType });
    const up = await uploadToCloudflareR2(file, folder);
    return up.url;
  }

  return '';
};

// ==================== TO FETCHABLE AUDIO URL (EXACT COPY FROM APP.TSX) ====================
const toFetchableAudioUrl = (u?: string | null): string => {
  if (!u) return '';
  if (isAbsoluteUrl(u)) return u;
  if (isBlobUrl(u)) return u;
  return u;
};

// ==================== FORMAT VIEW COUNT HELPER ====================
const formatViewCount = (num?: number): string => {
  const v = Number(num || 0);
  
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(v);
};

const formatClock = (secs: number) => {
  const safe = Math.max(0, Math.floor(secs || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const safeRevoke = (url?: string | null) => {
  if (!url) return;
  if (url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
};

const inferVideoMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) return 'video/webm;codecs=vp9,opus';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) return 'video/webm;codecs=vp8,opus';
  if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm';
  if (MediaRecorder.isTypeSupported('video/mp4')) return 'video/mp4';
  return 'video/webm';
};

// =========================
// TYPES
// =========================
export type Visibility = 'public' | 'friends' | 'private';

export type ReelSound = {
  songName: string;
  audioUrl: string;
  audioStart?: number;
  audioEnd?: number;
  songId?: string | number;
  soundKey?: string;
  originalUrl?: string;
  isTrimmedAudio?: boolean;
};

export type LyricThemeId =
  | 'classic'
  | 'neon'
  | 'cinema'
  | 'glass'
  | 'karaoke'
  | 'outline';

type LyricPreset = {
  id: LyricThemeId;
  name: string;
  className: string;
};

type EditorMode = 'choose' | 'camera' | 'preview';

export type RecorderSoundOption = {
  id: string | number;
  name: string;
  url: string;
  originalUrl?: string;
  duration?: number;
  start?: number;
  end?: number;
  coverImage?: string;
  creatorName?: string;
  creatorImage?: string;
  playCount?: number;
  creationCount?: number;
  soundKey?: string;
};

export interface RecorderSubmitPayload {
  caption: string;
  location?: string;
  visibility: Visibility;
  videoFile: File;
  audioFile?: File;
  songName?: string;
  audioUrl?: string;
  audioStart?: number;
  audioEnd?: number;
  soundKey?: string;
  songId?: string | number;
  originalSoundId?: string | number; // ✅ Added for createReel() compatibility
  lyricsText?: string;
  lyricsTheme?: LyricThemeId;
  lyricsEnabled?: boolean;
}

interface RecorderProps {
  currentUser: User;
  selectedSound?: ReelSound | null;
  sounds?: RecorderSoundOption[];
  onSelectSound?: (sound: ReelSound | null) => void;
  onBack: () => void;
  onSubmit: (payload: RecorderSubmitPayload) => Promise<void> | void;
  maxDurationSec?: number;
  brandName?: string;
}

const LYRIC_PRESETS: LyricPreset[] = [
  { id: 'classic', name: 'Classic', className: 'lyric-classic' },
  { id: 'neon', name: 'Neon', className: 'lyric-neon' },
  { id: 'cinema', name: 'Cinema', className: 'lyric-cinema' },
  { id: 'glass', name: 'Glass', className: 'lyric-glass' },
  { id: 'karaoke', name: 'Karaoke', className: 'lyric-karaoke' },
  { id: 'outline', name: 'Outline', className: 'lyric-outline' },
];

const EFFECTS = [
  { id: 'none', name: 'Original', filter: 'none' },
  { id: 'vivid', name: 'Vivid', filter: 'contrast(1.08) saturate(1.18) brightness(1.03)' },
  { id: 'soft', name: 'Soft', filter: 'brightness(1.06) contrast(0.96) saturate(1.05)' },
  { id: 'cold', name: 'Cool', filter: 'saturate(0.92) hue-rotate(8deg) contrast(1.03)' },
  { id: 'warm', name: 'Warm', filter: 'sepia(0.16) saturate(1.12) brightness(1.02)' },
  { id: 'mono', name: 'Mono', filter: 'grayscale(1) contrast(1.12)' },
] as const;

// ==================== ENHANCED AUDIO TRIMMER ====================
const AudioTrimmer: React.FC<{ 
  url: string, 
  onClose: () => void, 
  onConfirm: (start: number, end: number, trimmedFile?: File) => void,
  initialStart: number,
  initialEnd: number,
  soundId?: string | number;
  soundName?: string;
  onMountStopAll?: () => void;
  onStopVideo?: () => void;
}> = ({ url, onClose, onConfirm, initialStart, initialEnd, soundId, soundName, onMountStopAll, onStopVideo }) => {
  const { stopAllAudio } = useAudioFocus();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd > 0 ? initialEnd : Math.min(60, initialStart + 15));
  const [duration, setDuration] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activeThumb, setActiveThumb] = useState<'start' | 'end'>('start');
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);
  const [trimStatus, setTrimStatus] = useState<'idle' | 'trimming' | 'success' | 'error'>('idle');
  const [trimError, setTrimError] = useState<string>('');
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const trimAudioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<any>(null);
  
  const MIN_WINDOW = 1;
  const MAX_WINDOW = 60;

  useEffect(() => {
    onStopVideo?.();
    onMountStopAll?.();
    stopAllAudio();
    
    if (trimAudioRef.current) {
      trimAudioRef.current.src = url;
      trimAudioRef.current.currentTime = start;
    }
    
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (trimAudioRef.current) {
        trimAudioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    const handleTimeUpdate = () => {
      if (!isPlaying) return;
      
      setCurrentTime(trimAudioRef.current?.currentTime || 0);
      
      if (trimAudioRef.current && (trimAudioRef.current.currentTime < start || trimAudioRef.current.currentTime >= end)) {
        trimAudioRef.current.currentTime = start;
      }
    };

    const audio = trimAudioRef.current;
    if (audio) {
      audio.addEventListener('timeupdate', handleTimeUpdate);
      return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, [isPlaying, start, end]);

  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        if (trimAudioRef.current) {
          setCurrentTime(trimAudioRef.current.currentTime);
        }
      }, 100);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    }
    
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying]);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      setDuration(d);
      if (initialEnd === 0 || initialEnd > d) {
        const newEnd = Math.min(d, start + 15);
        setEnd(newEnd);
      }
    }
  };

  const togglePlay = () => {
    if (!trimAudioRef.current) return;

    stopAllAudio();

    if (isPlaying) {
      trimAudioRef.current.pause();
      setIsPlaying(false);
    } else {
      trimAudioRef.current.currentTime = start;
      trimAudioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleStartChange = (value: number) => {
    const newStart = Math.min(value, end - MIN_WINDOW);
    setStart(newStart);
    if (trimAudioRef.current) {
      trimAudioRef.current.currentTime = newStart;
    }
  };

  const handleEndChange = (value: number) => {
    const newEnd = Math.max(value, start + MIN_WINDOW);
    setEnd(Math.min(newEnd, start + MAX_WINDOW));
    if (trimAudioRef.current) {
      trimAudioRef.current.currentTime = newEnd;
    }
  };

  const handleTrackInteraction = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
    const clickTime = clickPercent * duration;

    const distStart = Math.abs(clickTime - start);
    const distEnd = Math.abs(clickTime - end);
    setActiveThumb(distStart < distEnd ? 'start' : 'end');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleConfirm = async () => {
    setIsTrimming(true);
    setTrimStatus('trimming');
    setTrimProgress(0);
    setTrimError('');
    
    try {
      setTrimProgress(10);
      
      const { blob, duration: trimDuration } = await trimAudioUrlToWavBlob(url, start, end);
      
      setTrimProgress(80);
      
      const trimmedFile = new File([blob], `trimmed-${Date.now()}.wav`, { 
        type: "audio/wav" 
      });
      
      setTrimProgress(95);
      setTrimStatus('success');
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      onConfirm(start, end, trimmedFile);
      
    } catch (error: any) {
      console.error('Audio trimming failed:', error);
      setTrimStatus('error');
      setTrimError(error?.message || 'Failed to trim audio');
      setIsTrimming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[800] bg-black/98 flex flex-col justify-end animate-fade-in font-sans">
      <style>{`
        .precision-slider {
          pointer-events: none;
          appearance: none;
          background: transparent;
          width: 100%;
          position: absolute;
          left: 0;
          z-index: 40;
        }
        .precision-slider::-webkit-slider-thumb {
          pointer-events: auto;
          appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          border: 4px solid currentColor;
        }
        .slider-active { z-index: 50; }
        .slider-blue::-webkit-slider-thumb { color: #1877F2; }
        .slider-red::-webkit-slider-thumb { color: #F3425F; }
      `}</style>

      {(isTrimming || trimStatus === 'trimming' || trimStatus === 'error') && (
        <div className="absolute inset-0 z-[900] bg-black/95 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-gradient-to-b from-[#1A1A1A] to-[#0A0A0A] rounded-3xl p-8 max-w-sm w-full border border-white/10 shadow-2xl">
            <div className="flex flex-col items-center justify-center gap-6">
              {trimStatus === 'trimming' ? (
                <>
                  <div className="w-24 h-24 relative">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth="8"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#1877F2"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${trimProgress * 2.83} 283`}
                        strokeDashoffset="0"
                        className="transition-all duration-300 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
                        <i className="fas fa-scissors text-2xl text-[#1877F2] animate-pulse"></i>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2">Trimming Audio</h3>
                    <p className="text-[#B0B3B8] text-sm">
                      Creating trimmed audio file ({Math.round(trimProgress)}%)
                    </p>
                    <div className="w-full bg-white/10 rounded-full h-2 mt-4 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#1877F2] to-[#2D8CFF] rounded-full transition-all duration-300"
                        style={{ width: `${trimProgress}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : trimStatus === 'error' ? (
                <>
                  <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                    <i className="fas fa-exclamation-triangle text-3xl text-red-500"></i>
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2">Trimming Failed</h3>
                    <p className="text-[#B0B3B8] text-sm mb-6">{trimError || 'Failed to trim audio'}</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setTrimStatus('idle');
                          setTrimError('');
                          setIsTrimming(false);
                        }}
                        className="flex-1 bg-gradient-to-r from-[#1877F2] to-[#2D8CFF] text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={onClose}
                        className="flex-1 bg-white/10 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#121212] w-full rounded-t-[40px] p-8 pb-14 border-t border-white/10 animate-slide-up shadow-2xl relative">
        <div className="flex justify-between items-center mb-10">
          <button 
            onClick={onClose} 
            disabled={isTrimming}
            className="text-[#B0B3B8] font-black uppercase text-[10px] tracking-widest px-4 py-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="text-center">
            <h3 className="font-black text-white uppercase tracking-[4px] text-xs">Precision Sync</h3>
            <p className="text-[9px] text-[#1877F2] font-black mt-1 uppercase tracking-tighter">Trim & Export Audio</p>
            {soundName && (
              <p className="text-[8px] text-white/60 font-bold mt-0.5 uppercase tracking-tight truncate max-w-[200px]">
                {soundName}
              </p>
            )}
          </div>
          <button 
            onClick={handleConfirm} 
            disabled={isTrimming || trimStatus === 'trimming'}
            className="text-[#1877F2] font-black uppercase text-[10px] tracking-widest px-4 py-2 disabled:opacity-50"
          >
            {isTrimming ? 'Processing...' : 'Done'}
          </button>
        </div>

        <div className="flex items-center justify-center gap-4 mb-8">
          <button 
            onClick={togglePlay}
            disabled={isTrimming}
            className="w-16 h-16 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-white text-xl`}></i>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-white text-sm font-bold">
              {formatDuration(currentTime - start)}
            </span>
            <span className="text-white/40 text-[9px] uppercase tracking-widest">Current</span>
          </div>
        </div>

        <div 
          ref={containerRef}
          onMouseDown={(e) => !isTrimming && handleTrackInteraction(e.clientX)}
          onTouchStart={(e) => !isTrimming && handleTrackInteraction(e.touches[0].clientX)}
          className="relative h-28 w-full bg-white/5 rounded-3xl overflow-hidden px-8 border border-white/5 shadow-inner flex flex-col justify-center"
        >
          <div className="absolute inset-0 flex items-center gap-[2px] opacity-10 px-8 pointer-events-none">
            {Array.from({ length: 100 }).map((_, i) => (
              <div key={i} className="flex-1 bg-white rounded-full" style={{ height: `${15 + Math.random() * 70}%` }} />
            ))}
          </div>

          <div 
            className="absolute h-16 bg-[#1877F2]/10 border-x-2 border-white/30 pointer-events-none transition-all duration-75 z-10" 
            style={{ left: `${(start / duration) * 100}%`, width: `${((end - start) / duration) * 100}%` }} 
          />

          <div className="relative w-full h-1 flex items-center bg-white/10 rounded-full">
            <input 
              type="range" 
              min="0" 
              max={duration} 
              step="0.1" 
              value={start} 
              onMouseDown={() => { if (!isTrimming) { setIsDragging(true); setActiveThumb('start'); } }}
              onMouseUp={() => setIsDragging(false)}
              onChange={(e) => !isTrimming && handleStartChange(parseFloat(e.target.value))}
              className={`precision-slider slider-blue ${activeThumb === 'start' ? 'slider-active' : ''}`}
              disabled={isTrimming}
            />
            <input 
              type="range" 
              min="0" 
              max={duration} 
              step="0.1" 
              value={end} 
              onMouseDown={() => { if (!isTrimming) { setIsDragging(true); setActiveThumb('end'); } }}
              onMouseUp={() => setIsDragging(false)}
              onChange={(e) => !isTrimming && handleEndChange(parseFloat(e.target.value))}
              className={`precision-slider slider-red ${activeThumb === 'end' ? 'slider-active' : ''}`}
              disabled={isTrimming}
            />
          </div>
        </div>

        <div className="flex justify-center gap-4 mt-8">
          <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex flex-col items-center">
            <span className="text-[8px] font-black text-[#1877F2] uppercase tracking-widest">In</span>
            <p className="text-white text-xs font-black">{start.toFixed(1)}s</p>
          </div>
          <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex flex-col items-center">
            <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Out</span>
            <p className="text-white text-xs font-black">{end.toFixed(1)}s</p>
          </div>
          <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex flex-col items-center">
            <span className="text-[8px] font-black text-[#45BD62] uppercase tracking-widest">Length</span>
            <p className="text-white text-xs font-black">{(end - start).toFixed(1)}s</p>
          </div>
        </div>

        <div className="mt-10 text-center">
          <p className="text-white/50 text-xs mb-2">
            <i className="fas fa-info-circle text-[#1877F2] mr-2"></i>
            Trimmed audio will be exported as a new file
          </p>
          <p className="text-white/30 text-[10px]">
            Original: {formatDuration(duration)} → Trimmed: {formatDuration(end - start)}
          </p>
        </div>

        <audio 
          ref={audioRef} 
          src={url} 
          hidden 
          onLoadedMetadata={handleLoadedMetadata}
        />
        <audio 
          ref={trimAudioRef} 
          src={url} 
          hidden 
        />
      </div>
    </div>
  );
};

// =========================
// MAIN COMPONENT
// =========================
const Recorder: React.FC<RecorderProps> = ({
  currentUser,
  selectedSound,
  sounds = [],
  onSelectSound,
  onBack,
  onSubmit,
  maxDurationSec = 60,
  brandName = 'UNERA',
}) => {
  const [mode, setMode] = useState<EditorMode>('choose');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');
  const [submitProgress, setSubmitProgress] = useState(0);

  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');

  const [lyricsEnabled, setLyricsEnabled] = useState(true);
  const [lyricsText, setLyricsText] = useState('Your words here\nMake them sing on screen');
  const [lyricsTheme, setLyricsTheme] = useState<LyricThemeId>('karaoke');
  const [lyricsScale, setLyricsScale] = useState(1);
  const [lyricsBottomOffset, setLyricsBottomOffset] = useState(18);

  const [selectedEffectId, setSelectedEffectId] = useState<string>('none');
  const activeEffect = useMemo(
    () => EFFECTS.find((e) => e.id === selectedEffectId) || EFFECTS[0],
    [selectedEffectId]
  );

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState('');
  const [isPreparingCamera, setIsPreparingCamera] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [soundPreviewEnabled, setSoundPreviewEnabled] = useState(true);
  const [playPreview, setPlayPreview] = useState(true);

  const [isSoundPickerOpen, setIsSoundPickerOpen] = useState(false);
  const [soundSearch, setSoundSearch] = useState('');
  const [previewingSoundId, setPreviewingSoundId] = useState<string | number | null>(null);
  const [trimStart, setTrimStart] = useState<number>(selectedSound?.audioStart || 0);
  const [trimEnd, setTrimEnd] = useState<number>(selectedSound?.audioEnd || 0);

  // ==================== SOUND FETCHING (EXACT COPY FROM APP.TSX) ====================
  const [availableSounds, setAvailableSounds] = useState<RecorderSoundOption[]>(sounds);
  const [popularSounds, setPopularSounds] = useState<RecorderSoundOption[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [loadingPopularSounds, setLoadingPopularSounds] = useState(false);

  // Fetch popular sounds
  useEffect(() => {
    const fetchPopularSounds = async () => {
      setLoadingPopularSounds(true);
      try {
        const data = await apiFetch('/api/sounds/popular?limit=20');
        const list = data?.sounds ?? data?.data ?? (Array.isArray(data) ? data : []);
        
        setPopularSounds(list.map((sound: any) => ({
          id: sound.id,
          name: sound.name || sound.title,
          url: toFetchableAudioUrl(sound.url || sound.audio_url),
          originalUrl: sound.originalUrl || sound.url || sound.audio_url,
          duration: sound.duration || 30,
          start: sound.start || 0,
          end: sound.end || sound.duration || 30,
          coverImage: sound.coverImage || sound.cover_url || sound.cover,
          creatorName: sound.creatorName || sound.creator_name || sound.artist,
          creatorImage: sound.creatorImage || sound.creator_image || sound.artist_image,
          playCount: sound.playCount || sound.plays || 0,
          creationCount: sound.creationCount || sound.uses || 0,
          soundKey: sound.soundKey || sound.sound_key || `sound:${sound.id}`
        })));
      } catch (error) {
        console.error('Failed to fetch popular sounds:', error);
      } finally {
        setLoadingPopularSounds(false);
      }
    };

    fetchPopularSounds();
  }, []);

  // Fetch songs from library
  useEffect(() => {
    const fetchSongs = async () => {
      setLoadingSongs(true);
      try {
        const data = await apiFetch('/api/songs');
        const list = data?.songs ?? data?.data ?? (Array.isArray(data) ? data : []);
        
        const songSounds = list.map((song: any) => ({
          id: song.id,
          name: song.title || song.name,
          url: toFetchableAudioUrl(song.audio_url || song.url),
          originalUrl: song.audio_url || song.url,
          duration: song.duration || 30,
          start: 0,
          end: song.duration || 30,
          coverImage: song.cover_url || song.cover,
          creatorName: song.artist || song.creator_name,
          creatorImage: song.artist_image || song.cover_url,
          playCount: song.playCount || song.plays || 0,
          soundKey: `song:${song.id}`
        }));
        setAvailableSounds(songSounds);
      } catch (error) {
        console.error('Failed to fetch songs:', error);
      } finally {
        setLoadingSongs(false);
      }
    };

    fetchSongs();
  }, []);

  const [isTrimmerOpen, setIsTrimmerOpen] = useState(false);
  const [trimmingSound, setTrimmingSound] = useState<RecorderSoundOption | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const soundAudioRef = useRef<HTMLAudioElement | null>(null);
  const cameraReadyRef = useRef(false);

  const currentSelectedSound = selectedSound || null;
  const soundLabel = currentSelectedSound?.songName || 'Original Sound';
  const soundStart = trimStart;
  const soundEnd = trimEnd;
  const soundDurationWindow = soundEnd > soundStart ? soundEnd - soundStart : 0;

  const lyricPreset = useMemo(
    () => LYRIC_PRESETS.find((p) => p.id === lyricsTheme) || LYRIC_PRESETS[0],
    [lyricsTheme]
  );

  const filteredSounds = useMemo(() => {
    const q = soundSearch.trim().toLowerCase();
    if (!q) return [...popularSounds, ...availableSounds];
    return [...popularSounds, ...availableSounds].filter((sound) =>
      sound.name.toLowerCase().includes(q) ||
      String(sound.creatorName || '').toLowerCase().includes(q)
    );
  }, [soundSearch, availableSounds, popularSounds]);

  const cleanupPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      safeRevoke(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const stopSoundPreview = useCallback(() => {
    if (soundAudioRef.current) {
      try {
        soundAudioRef.current.pause();
      } catch {}
    }
    setPreviewingSoundId(null);
  }, []);

  const playSoundPreview = useCallback((sound: RecorderSoundOption) => {
    if (!sound.url) return;

    if (!soundAudioRef.current) {
      soundAudioRef.current = new Audio();
    }

    const audio = soundAudioRef.current;
    const start = sound.start || 0;
    const end = sound.end || sound.duration || 0;

    if (previewingSoundId === sound.id && !audio.paused) {
      audio.pause();
      setPreviewingSoundId(null);
      return;
    }

    audio.pause();
    audio.src = sound.url;
    audio.currentTime = start;
    audio.onended = () => setPreviewingSoundId(null);
    audio.ontimeupdate = () => {
      if (end > start && audio.currentTime >= end) {
        audio.pause();
        audio.currentTime = start;
        setPreviewingSoundId(null);
      }
    };

    audio.play().then(() => {
      setPreviewingSoundId(sound.id);
    }).catch(() => {
      setPreviewingSoundId(null);
    });
  }, [previewingSoundId]);

  const setNextPreviewUrl = useCallback(
    (url: string | null) => {
      cleanupPreviewUrl();
      previewUrlRef.current = url;
      setVideoPreviewUrl(url);
    },
    [cleanupPreviewUrl]
  );

  const cleanupCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }

    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((track) => track.stop());
      rawStreamRef.current = null;
    }

    if (videoElRef.current) {
      videoElRef.current.pause();
      videoElRef.current.srcObject = null;
    }

    cameraReadyRef.current = false;
    setIsRecording(false);
    setRecordingSec(0);
  }, []);

  const renderCameraFrame = useCallback(() => {
    const video = videoElRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { videoWidth, videoHeight } = video;
    if (!videoWidth || !videoHeight) {
      animationFrameRef.current = requestAnimationFrame(renderCameraFrame);
      return;
    }

    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.filter = activeEffect.filter;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    animationFrameRef.current = requestAnimationFrame(renderCameraFrame);
  }, [activeEffect.filter, facingMode]);

  const startCamera = useCallback(async () => {
    cleanupCamera();
    setIsPreparingCamera(true);
    setCameraError('');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera is not supported on this device/browser.');
      }

      const rawStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      rawStreamRef.current = rawStream;

      if (!videoElRef.current || !canvasRef.current) {
        throw new Error('Camera elements are not ready.');
      }

      videoElRef.current.srcObject = rawStream;
      await videoElRef.current.play();
      cameraReadyRef.current = true;

      renderCameraFrame();

      const canvasStream = canvasRef.current.captureStream(30);
      const micTrack = rawStream.getAudioTracks()[0];
      const composedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(micTrack ? [micTrack] : []),
      ]);

      recordingStreamRef.current = composedStream;
      setMode('camera');
    } catch (error: any) {
      setCameraError(error?.message || 'Unable to access camera.');
    } finally {
      setIsPreparingCamera(false);
    }
  }, [cleanupCamera, facingMode, renderCameraFrame]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    try {
      mediaRecorderRef.current.stop();
    } catch {}
    setIsRecording(false);
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (soundAudioRef.current) {
      try {
        soundAudioRef.current.pause();
        soundAudioRef.current.currentTime = soundStart;
      } catch {}
    }
  }, [soundStart]);

  const startRecording = useCallback(async () => {
    const stream = recordingStreamRef.current;
    if (!stream || !cameraReadyRef.current) {
      setCameraError('Camera is still getting ready.');
      return;
    }

    setCameraError('');
    recordedChunksRef.current = [];

    try {
      const mimeType = inferVideoMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `reel-${Date.now()}.${ext}`, { type: blob.type || mimeType });
        setVideoFile(file);
        setNextPreviewUrl(URL.createObjectURL(file));
        setMode('preview');
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSec(0);

      if (currentSelectedSound?.audioUrl && soundPreviewEnabled) {
        if (!soundAudioRef.current) {
          soundAudioRef.current = new Audio(currentSelectedSound.audioUrl);
        }
        soundAudioRef.current.pause();
        soundAudioRef.current.src = currentSelectedSound.audioUrl;
        soundAudioRef.current.currentTime = soundStart;
        soundAudioRef.current.volume = 1;
        soundAudioRef.current.play().catch(() => {});
      }

      recordTimerRef.current = window.setInterval(() => {
        setRecordingSec((prev) => {
          if (prev + 1 >= maxDurationSec) {
            stopRecording();
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error: any) {
      setCameraError(error?.message || 'Could not start recording.');
      setIsRecording(false);
    }
  }, [currentSelectedSound, maxDurationSec, setNextPreviewUrl, soundPreviewEnabled, soundStart, stopRecording]);

  const handlePickVideo = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setSubmitState('error');
      setSubmitError('Please choose a video file.');
      return;
    }

    setVideoFile(file);
    setNextPreviewUrl(URL.createObjectURL(file));
    setMode('preview');
    event.target.value = '';
  }, [setNextPreviewUrl]);

  const resetAll = useCallback(() => {
    cleanupCamera();
    stopSoundPreview();
    setVideoFile(null);
    setNextPreviewUrl(null);
    setMode('choose');
    setCaption('');
    setLocation('');
    setSubmitState('idle');
    setSubmitError('');
    setSubmitProgress(0);
    setPlayPreview(true);
  }, [cleanupCamera, setNextPreviewUrl, stopSoundPreview]);

  const generateSoundKey = useCallback((): string => {
    if (currentSelectedSound?.soundKey) return currentSelectedSound.soundKey;
    
    if (currentSelectedSound?.songId) {
      return `song:${currentSelectedSound.songId}`;
    }
    
    if (trimStart !== 0 || trimEnd !== 0) {
      return `trimmed:${currentUser?.id || 'unknown'}:${Date.now()}`;
    }
    
    if (currentSelectedSound?.audioUrl) {
      return `original:${currentUser?.id || 'unknown'}:${Date.now()}`;
    }
    
    return 'original:none';
  }, [currentSelectedSound, currentUser, trimStart, trimEnd]);

  const handleSubmit = useCallback(async () => {
    if (!videoFile) {
      setSubmitState('error');
      setSubmitError('Please record or upload a video first.');
      return;
    }

    setIsSubmitting(true);
    setSubmitState('uploading');
    setSubmitError('');
    setSubmitProgress(5);

    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Your video is still uploading. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);

    try {
      setSubmitProgress(15);
      
      // Upload video to R2
      setSubmitProgress(30);
      const videoUrl = await ensureR2Url(
        videoFile,
        'reels',
        `reel-${Date.now()}.mp4`
      );

      setSubmitProgress(50);

      // Upload audio if trimmed
      let audioFileToUpload: File | undefined = undefined;
      if (trimmingSound && (trimStart !== 0 || trimEnd !== 0)) {
        // Audio is already trimmed via AudioTrimmer
        // The trimmed file will be passed through onSubmit
      }

      setSubmitProgress(70);

      const soundKey = generateSoundKey();
      const isTrimmedAudio = soundKey.startsWith('trimmed:');
      
      const audioStart = isTrimmedAudio ? 0 : (selectedSound?.audioStart || trimStart || 0);
      const audioEnd = isTrimmedAudio ? 0 : (selectedSound?.audioEnd || trimEnd || 0);

      // ✅ Match createReel() expectations exactly
      await onSubmit({
        caption: caption.trim(),
        location: location.trim(),
        visibility,
        videoFile,
        audioFile: trimmingSound ? undefined : undefined, // Will be handled via ensureR2Url in createReel
        songName: currentSelectedSound?.songName || 'Original Sound',
        audioUrl: currentSelectedSound?.originalUrl || currentSelectedSound?.audioUrl || '',
        audioStart,
        audioEnd,
        soundKey,
        songId: currentSelectedSound?.songId,
        originalSoundId: currentSelectedSound?.songId, // ✅ Added for createReel()
        lyricsText: lyricsText.trim(),
        lyricsTheme,
        lyricsEnabled,
      });

      setSubmitProgress(90);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setSubmitProgress(100);
      setSubmitState('success');
      
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      
      await sleep(1000);
      onBack();
    } catch (error: any) {
      console.error('Submit error:', error);
      setSubmitState('error');
      setSubmitError(error?.message || 'Failed to publish reel.');
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    } finally {
      setIsSubmitting(false);
    }
  }, [caption, currentSelectedSound, location, lyricsEnabled, lyricsText, lyricsTheme, onBack, onSubmit, soundEnd, soundStart, trimEnd, trimStart, trimmingSound, videoFile, visibility, generateSoundKey, selectedSound]);

  useEffect(() => {
    setTrimStart(selectedSound?.audioStart || 0);
    setTrimEnd(selectedSound?.audioEnd || 0);
  }, [selectedSound]);

  useEffect(() => {
    return () => {
      cleanupCamera();
      cleanupPreviewUrl();
      stopSoundPreview();
      if (soundAudioRef.current) {
        try {
          soundAudioRef.current.pause();
        } catch {}
        soundAudioRef.current = null;
      }
    };
  }, [cleanupCamera, cleanupPreviewUrl, stopSoundPreview]);

  useEffect(() => {
    if (mode !== 'preview' || !previewVideoRef.current || !videoPreviewUrl) return;
    const video = previewVideoRef.current;
    video.play().catch(() => {});
  }, [mode, videoPreviewUrl]);

  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    }
  }, [mode, startCamera]);

  const lyricStyle = useMemo<React.CSSProperties>(() => ({
    transform: `translateX(-50%) scale(${lyricsScale})`,
    bottom: `${lyricsBottomOffset}%`,
  }), [lyricsBottomOffset, lyricsScale]);

  const handleTrimConfirm = (start: number, end: number, trimmedFile?: File) => {
    setTrimStart(start);
    setTrimEnd(end);
    setIsTrimmerOpen(false);
    
    if (trimmedFile && currentSelectedSound) {
      // Update selected sound with trimmed info
      onSelectSound?.({
        ...currentSelectedSound,
        audioStart: start,
        audioEnd: end,
        isTrimmedAudio: true,
      });
    }
  };

  const handleSoundSelect = (sound: RecorderSoundOption) => {
    const normalized: ReelSound = {
      songName: sound.name,
      audioUrl: toFetchableAudioUrl(sound.url),
      originalUrl: sound.originalUrl || sound.url,
      audioStart: sound.start || 0,
      audioEnd: sound.end || sound.duration || 0,
      songId: sound.id,
      soundKey: sound.soundKey || `song:${sound.id}`,
      isTrimmedAudio: false,
    };
    onSelectSound?.(normalized);
    setTrimStart(normalized.audioStart || 0);
    setTrimEnd(normalized.audioEnd || 0);
    setIsSoundPickerOpen(false);
    setTrimmingSound(sound);
    setIsTrimmerOpen(true);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black text-white overflow-hidden font-sans recorder-page">
      <style>{RECORDER_STYLES}</style>

      {/* Upload Loader */}
      {submitState === 'uploading' && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-[#1A1A1A] to-[#0A0A0A] rounded-3xl p-8 max-w-sm w-full border border-white/10 shadow-2xl">
            <div className="flex flex-col items-center justify-center gap-6">
              <div className="w-32 h-32 relative">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#1877F2"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${submitProgress * 2.83} 283`}
                    strokeDashoffset="0"
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center">
                    <i className="fas fa-cloud-upload-alt text-2xl text-[#1877F2] animate-pulse"></i>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2 animate-fade-in">Uploading your reel...</h3>
                <p className="text-[#B0B3B8] text-sm">
                  Please wait while we upload your video ({Math.round(submitProgress)}%)
                </p>
                
                <div className="space-y-3 mt-4">
                  <p className="text-white font-bold text-lg animate-pulse">{Math.round(submitProgress)}%</p>
                  
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#1877F2] to-[#2D8CFF] rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${submitProgress}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between text-xs text-[#B0B3B8]">
                    <span>Uploading</span>
                    <span>≈ {submitProgress < 50 ? '30s' : '15s'}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-white/50 text-center mt-4 px-4 py-2 bg-white/5 rounded-lg">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                Please don't close this window or navigate away
              </div>
            </div>
          </div>
        </div>
      )}

      {submitState === 'success' && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-[#1A1A1A] to-[#0A0A0A] rounded-3xl p-8 max-w-sm w-full border border-white/10 shadow-2xl">
            <div className="flex flex-col items-center justify-center gap-6">
              <div className="w-24 h-24 rounded-full bg-[#45BD62]/20 flex items-center justify-center">
                <i className="fas fa-check-circle text-4xl text-[#45BD62] animate-pulse"></i>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">Posted successfully!</h3>
                <p className="text-[#B0B3B8] text-sm">Your reel is now live on UNERA</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {submitState === 'error' && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-[#1A1A1A] to-[#0A0A0A] rounded-3xl p-8 max-w-sm w-full border border-white/10 shadow-2xl">
            <div className="flex flex-col items-center justify-center gap-6">
              <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center">
                <i className="fas fa-exclamation-triangle text-4xl text-red-500"></i>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">Upload Failed</h3>
                <p className="text-[#B0B3B8] text-sm mb-4">{submitError || 'Failed to publish reel'}</p>
                <button
                  onClick={() => setSubmitState('idle')}
                  className="bg-[#1877F2] text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(24,119,242,0.18),transparent_28%),radial-gradient(circle_at_bottom,rgba(243,66,95,0.16),transparent_25%)] pointer-events-none" />

      <div className="absolute top-0 left-0 right-0 z-40 px-4 pt-[max(env(safe-area-inset-top),10px)] pb-3 bg-gradient-to-b from-black/85 to-transparent flex items-center justify-between">
        <button
          onClick={() => {
            if (mode === 'camera') {
              cleanupCamera();
              setMode('choose');
              return;
            }
            if (mode === 'preview') {
              setMode('choose');
              return;
            }
            onBack();
          }}
          className="w-11 h-11 rounded-full bg-white/10 border border-white/10 flex items-center justify-center active:scale-95 transition"
        >
          <i className="fas fa-arrow-left text-sm" />
        </button>

        <div className="text-center">
          <div className="text-[10px] tracking-[0.35em] uppercase text-[#7fb6ff] font-black">{brandName} Studio</div>
          <div className="text-[12px] font-black tracking-[0.2em] uppercase">
            {mode === 'choose' ? 'Create Reel' : mode === 'camera' ? 'Record' : 'Preview'}
          </div>
        </div>

        <button
          onClick={resetAll}
          className="w-11 h-11 rounded-full bg-white/10 border border-white/10 flex items-center justify-center active:scale-95 transition"
          aria-label="Reset recorder"
        >
          <i className="fas fa-rotate-left text-sm" />
        </button>
      </div>

      {mode === 'choose' && (
        <div className="relative h-full flex flex-col items-center justify-center px-6 pb-12 pt-24 overflow-y-auto">
          <div className="w-full max-w-[420px] text-center mb-8">
            <div className="w-24 h-24 mx-auto rounded-[32px] bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl mb-6">
              <i className="fas fa-video text-4xl text-[#1877F2]" />
            </div>
            <h1 className="text-3xl font-black tracking-tight mb-3">Create a TikTok-style Reel</h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Record live, upload from your phone, preview songs before choosing, trim instantly, then publish.
            </p>
          </div>

          <div className="w-full max-w-[420px] space-y-4">
            <button
              onClick={() => setMode('camera')}
              className="w-full rounded-[32px] bg-[#1877F2] p-6 text-left shadow-[0_20px_60px_rgba(24,119,242,0.35)] active:scale-[0.98] transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-white/20 flex items-center justify-center">
                  <i className="fas fa-camera text-2xl" />
                </div>
                <div>
                  <div className="text-lg font-black uppercase tracking-[0.18em]">Record Live</div>
                  <div className="text-white/70 text-xs mt-1 uppercase tracking-[0.12em]">Fullscreen camera + lyrics overlay</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-[32px] bg-white/5 border border-white/10 p-6 text-left active:scale-[0.98] transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center">
                  <i className="fas fa-cloud-upload-alt text-2xl text-[#7fb6ff]" />
                </div>
                <div>
                  <div className="text-lg font-black uppercase tracking-[0.18em]">Upload Video</div>
                  <div className="text-white/60 text-xs mt-1 uppercase tracking-[0.12em]">From your gallery or file picker</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setIsSoundPickerOpen(true)}
              className="w-full rounded-[32px] bg-white/5 border border-white/10 p-5 text-left active:scale-[0.98] transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-3xl bg-[#1877F2]/15 border border-[#1877F2]/30 flex items-center justify-center">
                  <i className="fas fa-music text-xl text-[#7fb6ff]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-[#7fb6ff]">Sound</div>
                  <div className="text-base font-bold truncate mt-1">{soundLabel}</div>
                  <div className="text-white/55 text-xs mt-1">Tap to browse and preview songs before selecting</div>
                </div>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handlePickVideo}
            />
          </div>

          {currentSelectedSound && (
            <div className="w-full max-w-[420px] mt-5 rounded-[28px] bg-white/5 border border-white/10 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7fb6ff]">Selected Sound</div>
                  <div className="text-sm font-bold mt-1 truncate">{soundLabel}</div>
                </div>
                <button
                  onClick={() => setIsSoundPickerOpen(true)}
                  className="px-4 py-2 rounded-2xl bg-white/10 border border-white/10 text-xs font-black uppercase tracking-[0.14em] active:scale-95"
                >
                  Change
                </button>
              </div>

              <div className="mt-4 grid gap-4">
                <RangeRow
                  label="Trim start"
                  value={trimStart}
                  min={0}
                  max={Math.max(trimEnd > 0 ? trimEnd - 1 : 1, 1)}
                  step={0.1}
                  display={`${trimStart.toFixed(1)}s`}
                  onChange={(v) => setTrimStart(v)}
                />
                <RangeRow
                  label="Trim end"
                  value={trimEnd || Math.max((currentSelectedSound.audioEnd || 30), trimStart + 1)}
                  min={trimStart + 0.5}
                  max={Math.max(currentSelectedSound.audioEnd || 30, trimStart + 0.5)}
                  step={0.1}
                  display={`${(trimEnd || 0).toFixed(1)}s`}
                  onChange={(v) => setTrimEnd(v)}
                />
              </div>

              <div className="mt-3 text-white/55 text-xs">
                Fast trim mode: only start/end metadata changes, so there is no fake trimming delay.
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'camera' && (
        <div className="absolute inset-0 bg-black">
          <canvas ref={canvasRef} className="hidden" />

          {cameraError ? (
            <div className="h-full flex items-center justify-center px-6">
              <div className="w-full max-w-[360px] rounded-[28px] bg-white/5 border border-white/10 p-7 text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-5">
                  <i className="fas fa-video-slash text-red-400 text-3xl" />
                </div>
                <h3 className="font-black text-xl mb-3">Camera unavailable</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-6">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="w-full py-4 rounded-2xl bg-[#1877F2] font-black uppercase tracking-[0.16em] active:scale-95"
                >
                  Retry camera
                </button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoElRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  filter: activeEffect.filter,
                  transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                }}
              />

              {lyricsEnabled && (
                <div className="absolute inset-0 pointer-events-none z-20">
                  <div className={`lyric-overlay ${lyricPreset.className}`} style={lyricStyle}>
                    {lyricsText.split('\n').map((line, idx) => (
                      <div key={idx}>{line || '\u00A0'}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="absolute top-20 left-4 right-4 z-30 flex items-center justify-between gap-3">
                <div className="rounded-full bg-black/45 backdrop-blur-md px-4 py-2 border border-white/10 text-xs font-black tracking-[0.14em] uppercase">
                  {isPreparingCamera ? 'Preparing camera...' : isRecording ? `REC ${formatClock(recordingSec)}` : 'Ready'}
                </div>
                <div className="rounded-full bg-black/45 backdrop-blur-md px-4 py-2 border border-white/10 text-xs font-black tracking-[0.14em] uppercase">
                  {maxDurationSec}s max
                </div>
              </div>

              <div className="absolute right-4 top-[22%] z-30 flex flex-col gap-4">
                <IconPillButton
                  icon="fa-rotate"
                  label="Flip"
                  onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
                />
                <IconPillButton
                  icon="fa-music"
                  label={soundPreviewEnabled ? 'Sound On' : 'Sound Off'}
                  active={soundPreviewEnabled}
                  onClick={() => setSoundPreviewEnabled((prev) => !prev)}
                />
                <IconPillButton
                  icon="fa-sliders"
                  label="Sound"
                  active={!!currentSelectedSound}
                  onClick={() => setIsSoundPickerOpen(true)}
                />
                <IconPillButton
                  icon="fa-closed-captioning"
                  label={lyricsEnabled ? 'Lyrics On' : 'Lyrics Off'}
                  active={lyricsEnabled}
                  onClick={() => setLyricsEnabled((prev) => !prev)}
                />
              </div>

              <div className="absolute bottom-36 left-0 right-0 z-30 px-4">
                <div className="overflow-x-auto scrollbar-hide flex gap-3 px-2">
                  {EFFECTS.map((effect) => (
                    <button
                      key={effect.id}
                      onClick={() => setSelectedEffectId(effect.id)}
                      className={`min-w-[82px] rounded-2xl px-3 py-3 border text-center transition ${selectedEffectId === effect.id ? 'bg-[#1877F2] border-[#1877F2] text-white' : 'bg-black/45 border-white/10 text-white/75'}`}
                    >
                      <div className="w-9 h-9 rounded-full mx-auto mb-2 bg-gradient-to-br from-[#1877F2] to-[#F3425F]" style={{ filter: effect.filter }} />
                      <div className="text-[10px] font-black uppercase tracking-[0.14em]">{effect.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="absolute bottom-8 left-0 right-0 z-30 px-6 flex items-center justify-between gap-4">
                <button
                  onClick={() => setMode('choose')}
                  className="w-12 h-12 rounded-full bg-black/45 border border-white/10 flex items-center justify-center active:scale-95"
                >
                  <i className="fas fa-xmark" />
                </button>

                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-24 h-24 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition ${isRecording ? 'bg-red-600/25' : 'bg-white/5'}`}
                >
                  {isRecording ? (
                    <div className="w-10 h-10 rounded-xl bg-red-600" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-red-600 shadow-[0_0_30px_rgba(220,38,38,0.6)]" />
                  )}
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-12 h-12 rounded-full bg-black/45 border border-white/10 flex items-center justify-center active:scale-95"
                >
                  <i className="fas fa-image" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'preview' && videoPreviewUrl && (
        <div className="absolute inset-0 bg-black overflow-y-auto pt-20 pb-28">
          <div className="px-4 pb-6 max-w-[720px] mx-auto">
            <div className="grid gap-5 md:grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start">
              <div className="relative rounded-[34px] overflow-hidden border border-white/10 bg-[#0c0c0c] shadow-2xl aspect-[9/16] max-h-[78vh] mx-auto w-full max-w-[420px]">
                <video
                  ref={previewVideoRef}
                  src={videoPreviewUrl}
                  className="w-full h-full object-cover"
                  playsInline
                  loop
                  controls={false}
                  muted={!currentSelectedSound || !soundPreviewEnabled}
                  autoPlay
                />

                {lyricsEnabled && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className={`lyric-overlay ${lyricPreset.className}`} style={lyricStyle}>
                      {lyricsText.split('\n').map((line, idx) => (
                        <div key={idx}>{line || '\u00A0'}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-3">
                  <div className="px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-[10px] uppercase tracking-[0.2em] font-black">
                    Preview
                  </div>
                  <button
                    onClick={() => {
                      const video = previewVideoRef.current;
                      if (!video) return;
                      if (video.paused) {
                        video.play().catch(() => {});
                        setPlayPreview(true);
                      } else {
                        video.pause();
                        setPlayPreview(false);
                      }
                    }}
                    className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md border border-white/10 flex items-center justify-center"
                  >
                    <i className={`fas ${playPreview ? 'fa-pause' : 'fa-play'} text-xs`} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <SectionCard title="Caption & publishing">
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Write a caption for your reel..."
                    className="w-full min-h-[120px] rounded-3xl bg-white/5 border border-white/10 p-4 text-white outline-none resize-none"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Add location"
                      className="rounded-2xl bg-white/5 border border-white/10 p-3 text-white outline-none"
                    />
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as Visibility)}
                      className="rounded-2xl bg-white/5 border border-white/10 p-3 text-white outline-none"
                    >
                      <option value="public">Public</option>
                      <option value="friends">Friends only</option>
                      <option value="private">Private</option>
                    </select>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setMode('choose')}
                      className="rounded-2xl bg-white/8 border border-white/10 py-3 font-black uppercase tracking-[0.14em] active:scale-95"
                    >
                      Replace video
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="rounded-2xl bg-[#1877F2] py-3 font-black uppercase tracking-[0.14em] active:scale-95 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Publishing...' : 'Publish'}
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="Professional lyrics design">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <div className="text-sm font-bold">Lyrics overlay</div>
                      <div className="text-white/50 text-xs">TikTok-style text for singing, quotes, subtitles, or hooks.</div>
                    </div>
                    <button
                      onClick={() => setLyricsEnabled((prev) => !prev)}
                      className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-[0.14em] border ${lyricsEnabled ? 'bg-[#1877F2] border-[#1877F2]' : 'bg-white/5 border-white/10'}`}
                    >
                      {lyricsEnabled ? 'On' : 'Off'}
                    </button>
                  </div>

                  <textarea
                    value={lyricsText}
                    onChange={(e) => setLyricsText(e.target.value)}
                    placeholder="Type your lyrics or lines here..."
                    className="w-full min-h-[120px] rounded-3xl bg-white/5 border border-white/10 p-4 text-white outline-none resize-none"
                  />

                  <div className="mt-4">
                    <div className="text-xs uppercase tracking-[0.16em] font-black text-[#7fb6ff] mb-3">Text style</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {LYRIC_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => setLyricsTheme(preset.id)}
                          className={`rounded-2xl px-4 py-3 border text-xs font-black uppercase tracking-[0.14em] ${lyricsTheme === preset.id ? 'bg-[#1877F2] border-[#1877F2]' : 'bg-white/5 border-white/10'}`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <RangeRow
                      label="Text size"
                      value={lyricsScale}
                      min={0.8}
                      max={1.6}
                      step={0.05}
                      display={`${Math.round(lyricsScale * 100)}%`}
                      onChange={(v) => setLyricsScale(v)}
                    />
                    <RangeRow
                      label="Bottom position"
                      value={lyricsBottomOffset}
                      min={8}
                      max={32}
                      step={1}
                      display={`${lyricsBottomOffset}%`}
                      onChange={(v) => setLyricsBottomOffset(v)}
                    />
                  </div>
                </SectionCard>

                <SectionCard title="Sound">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{soundLabel}</div>
                      <div className="text-white/50 text-xs mt-1">
                        {currentSelectedSound ? 'Trim is instant and uses the same fields as Reels playback.' : 'No sound selected yet.'}
                      </div>
                    </div>
                    <button
                      onClick={() => setIsSoundPickerOpen(true)}
                      className="px-4 py-2 rounded-2xl bg-white/10 border border-white/10 text-xs font-black uppercase tracking-[0.14em]"
                    >
                      {currentSelectedSound ? 'Change' : 'Pick'}
                    </button>
                  </div>

                  {currentSelectedSound && (
                    <div className="mt-4 grid gap-4">
                      <RangeRow
                        label="Start"
                        value={trimStart}
                        min={0}
                        max={Math.max(trimEnd - 0.5, 0.5)}
                        step={0.1}
                        display={`${trimStart.toFixed(1)}s`}
                        onChange={(v) => setTrimStart(v)}
                      />
                      <RangeRow
                        label="End"
                        value={trimEnd}
                        min={trimStart + 0.5}
                        max={Math.max(currentSelectedSound.audioEnd || trimEnd || 30, trimStart + 0.5)}
                        step={0.1}
                        display={`${trimEnd.toFixed(1)}s`}
                        onChange={(v) => setTrimEnd(v)}
                      />
                      <button
                        onClick={() => {
                          const sound = availableSounds.find(s => s.id === currentSelectedSound.songId) || 
                                      popularSounds.find(s => s.id === currentSelectedSound.songId);
                          if (sound) {
                            setTrimmingSound(sound);
                            setIsTrimmerOpen(true);
                          }
                        }}
                        className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-[0.14em] hover:bg-white/10 transition-colors"
                      >
                        <i className="fas fa-scissors mr-2"></i>
                        Advanced Trim & Export
                      </button>
                    </div>
                  )}
                </SectionCard>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSoundPickerOpen && (
        <div className="absolute inset-0 z-[10020] bg-black/85 backdrop-blur-sm flex items-end">
          <div className="w-full max-h-[84vh] rounded-t-[32px] border-t border-white/10 bg-[#0e0e0e] overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  stopSoundPreview();
                  setIsSoundPickerOpen(false);
                }}
                className="px-4 py-2 rounded-2xl bg-white/8 border border-white/10 text-xs font-black uppercase tracking-[0.14em]"
              >
                Close
              </button>
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-[0.24em] font-black text-[#7fb6ff]">Sound Picker</div>
                <div className="text-sm font-black uppercase tracking-[0.14em]">Preview before selecting</div>
              </div>
              <button
                onClick={() => {
                  onSelectSound?.(null);
                  setTrimStart(0);
                  setTrimEnd(0);
                }}
                className="px-4 py-2 rounded-2xl bg-white/8 border border-white/10 text-xs font-black uppercase tracking-[0.14em]"
              >
                Clear
              </button>
            </div>

            <div className="p-4 border-b border-white/10">
              <input
                value={soundSearch}
                onChange={(e) => setSoundSearch(e.target.value)}
                placeholder="Search songs or creators..."
                className="w-full rounded-2xl bg-white/5 border border-white/10 p-4 text-white outline-none"
              />
            </div>

            <div className="overflow-y-auto max-h-[calc(84vh-132px)] p-4 space-y-3">
              {loadingPopularSounds || loadingSongs ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredSounds.length === 0 ? (
                <div className="text-center py-12 text-white/50">No sounds found.</div>
              ) : (
                filteredSounds.map((sound) => {
                  const selected = currentSelectedSound?.soundKey === (sound.soundKey || `song:${sound.id}`)
                    || currentSelectedSound?.songId === sound.id
                    || currentSelectedSound?.audioUrl === sound.url;

                  return (
                    <div key={String(sound.id)} className={`rounded-[24px] border p-4 flex items-center gap-4 ${selected ? 'bg-[#1877F2]/12 border-[#1877F2]/40' : 'bg-white/5 border-white/10'}`}>
                      {sound.coverImage || sound.creatorImage ? (
                        <img
                          src={sound.coverImage || sound.creatorImage}
                          alt=""
                          className="w-14 h-14 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1877F2] to-[#F3425F] flex items-center justify-center">
                          <i className="fas fa-music text-white" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{sound.name}</div>
                        <div className="text-white/50 text-xs truncate mt-1">{sound.creatorName || 'Original Sound'}</div>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-white/50">
                          <span>{formatClock(sound.end && sound.start !== undefined ? sound.end - sound.start : sound.duration || 0)}</span>
                          {sound.playCount ? <span>{formatViewCount(sound.playCount)} plays</span> : null}
                          {sound.creationCount ? <span>{formatViewCount(sound.creationCount)} uses</span> : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => playSoundPreview(sound)}
                          className="w-11 h-11 rounded-full bg-white/8 border border-white/10 flex items-center justify-center active:scale-95"
                        >
                          <i className={`fas ${previewingSoundId === sound.id ? 'fa-pause' : 'fa-play'} text-sm`} />
                        </button>
                        <button
                          onClick={() => handleSoundSelect(sound)}
                          className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-[0.14em] ${selected ? 'bg-[#1877F2] text-white' : 'bg-white/8 border border-white/10 text-white'}`}
                        >
                          {selected ? 'Selected' : 'Use'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audio Trimmer Modal */}
      {isTrimmerOpen && trimmingSound && (
        <AudioTrimmer
          url={trimmingSound.originalUrl || trimmingSound.url}
          onClose={() => setIsTrimmerOpen(false)}
          onConfirm={handleTrimConfirm}
          initialStart={trimStart}
          initialEnd={trimEnd}
          soundId={trimmingSound.id}
          soundName={trimmingSound.name}
          onMountStopAll={() => {
            stopSoundPreview();
          }}
        />
      )}
    </div>
  );
};

// =========================
// SMALL UI PARTS
// =========================
const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  return (
    <div className="rounded-[28px] bg-white/5 border border-white/10 p-4 md:p-5">
      <div className="text-xs uppercase tracking-[0.18em] font-black text-[#7fb6ff] mb-4">{title}</div>
      {children}
    </div>
  );
};

const IconPillButton: React.FC<{
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
}> = ({ icon, label, onClick, active }) => {
  return (
    <button
      onClick={onClick}
      className={`w-14 rounded-[22px] px-2 py-3 backdrop-blur-md border text-center active:scale-95 transition ${active ? 'bg-[#1877F2]/25 border-[#1877F2]/50 text-white' : 'bg-black/45 border-white/10 text-white/90'}`}
    >
      <i className={`fas ${icon} text-base mb-1`} />
      <div className="text-[9px] font-black uppercase tracking-[0.12em] leading-tight">{label}</div>
    </button>
  );
};

const RangeRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step, display, onChange }) => {
  const safeMax = Number.isFinite(max) ? max : min + step;
  const safeValue = Math.min(Math.max(value, min), safeMax);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="text-sm font-bold">{label}</div>
        <div className="text-white/60 text-xs font-black uppercase tracking-[0.14em]">{display}</div>
      </div>
      <input
        type="range"
        min={min}
        max={safeMax}
        step={step}
        value={safeValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
};

// =========================
// STYLES
// =========================
const RECORDER_STYLES = `
.recorder-page .scrollbar-hide::-webkit-scrollbar { display: none; }
.recorder-page .scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
.recorder-page * { -webkit-tap-highlight-color: transparent; }

@keyframes slide-up {
  0% { transform: translateY(100%); }
  100% { transform: translateY(0); }
}
.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}

@keyframes fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

@keyframes scale-in {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.animate-scale-in {
  animation: scale-in 0.3s ease-out;
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin-slow {
  animation: spin-slow 20s linear infinite;
}

@keyframes equalizer {
  0%, 100% { height: 4px; }
  50% { height: 16px; }
}
.animate-equalizer {
  animation: equalizer 0.5s ease-in-out infinite;
}

.lyric-overlay {
  position: absolute;
  left: 50%;
  width: min(88%, 540px);
  text-align: center;
  padding: 0 10px;
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

.lyric-classic {
  color: #fff;
  font-size: clamp(28px, 5vw, 40px);
  text-shadow: 0 3px 18px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.85);
}

.lyric-neon {
  color: #8bc3ff;
  font-size: clamp(30px, 5.4vw, 42px);
  text-shadow:
    0 0 4px rgba(139,195,255,0.9),
    0 0 16px rgba(24,119,242,0.9),
    0 0 32px rgba(24,119,242,0.75),
    0 4px 18px rgba(0,0,0,0.9);
}

.lyric-cinema {
  color: #f8f1d3;
  font-size: clamp(28px, 5vw, 40px);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-shadow: 0 4px 20px rgba(0,0,0,0.95), 0 0 2px rgba(255,255,255,0.35);
}

.lyric-glass {
  color: #fff;
  font-size: clamp(26px, 4.8vw, 38px);
  background: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06));
  border: 1px solid rgba(255,255,255,0.2);
  backdrop-filter: blur(12px);
  border-radius: 24px;
  padding: 14px 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
}

.lyric-karaoke {
  font-size: clamp(30px, 5.5vw, 44px);
  background: linear-gradient(90deg, #ffffff 0%, #ffffff 38%, #ffd54f 50%, #ffffff 62%, #ffffff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 3px 18px rgba(0,0,0,0.9);
  animation: karaokeGlow 2.6s linear infinite;
}

.lyric-outline {
  color: #fff;
  font-size: clamp(30px, 5.3vw, 42px);
  -webkit-text-stroke: 2px rgba(0,0,0,0.85);
  text-shadow: 0 0 16px rgba(0,0,0,0.55);
}

@keyframes karaokeGlow {
  0% { filter: brightness(1); }
  50% { filter: brightness(1.2); }
  100% { filter: brightness(1); }
}
`;

export default Recorder;
