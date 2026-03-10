
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';

// Import shared utilities and types from Reels
import { 
  trimAudioUrlToWavBlob,
  fetchAsBlobUrl,
  useAudioFocus,
  Sound,
  ReelSound,
  formatViewCount
} from './Reels'; // Make sure to export these from Reels.tsx

/**
 * Recorder.tsx
 *
 * TikTok-style reel creator page for UNERA.
 *
 * Features:
 * - Dedicated create screen for record or upload
 * - Fullscreen mobile-first UI
 * - Camera preview with front/back switch
 * - Record timer + max duration
 * - Upload from gallery
 * - Sound overlay support
 * - Karaoke / lyric overlay styles
 * - Simple editor / preview mode
 * - Caption, location, visibility
 * - Clean object URL cleanup
 * - Safer recording lifecycle
 * - SHARED PIPELINE with Reels.tsx
 */

// =========================
// TYPES (aligned with Reels.tsx)
// =========================
type Visibility = 'public' | 'friends' | 'private';

// Use the same ReelSound type from Reels
// This ensures consistency across the app
export type { ReelSound };

type LyricThemeId =
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

type EditorMode = 'choose' | 'camera' | 'preview' | 'trim';

export interface RecorderSubmitPayload {
  caption: string;
  location?: string;
  visibility: Visibility;
  videoFile: File;
  audioFile?: File;           // For uploaded/trimmed audio files
  songName?: string;
  audioUrl?: string;           // For server-stored audio (metadata trim)
  audioStart?: number;         // Trim start in seconds
  audioEnd?: number;           // Trim end in seconds
  soundKey?: string;           // Unique identifier for the sound
  songId?: string | number;
  lyricsText?: string;
  lyricsTheme?: LyricThemeId;
  lyricsEnabled?: boolean;
}

interface RecorderProps {
  currentUser: User;
  selectedSound?: ReelSound | null;
  onBack: () => void;
  onSubmit: (payload: RecorderSubmitPayload) => Promise<void> | void;
  onPickSound?: () => void;
  maxDurationSec?: number;
  brandName?: string;
  // New prop for fetching sounds (shared with Reels)
  fetchAvailableSounds?: () => Promise<Sound[]>;
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

// =========================
// HELPERS
// =========================
const formatClock = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
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
// AUDIO TRIMMER MODAL (shared with Reels.tsx but customized for recorder)
// =========================
const AudioTrimmerModal: React.FC<{ 
  url: string, 
  onClose: () => void, 
  onConfirm: (start: number, end: number, trimmedFile?: File) => void,
  initialStart: number,
  initialEnd: number,
  soundName?: string;
  onStopVideo?: () => void;
}> = ({ url, onClose, onConfirm, initialStart, initialEnd, soundName, onStopVideo }) => {
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
      for (let i = 0; i <= 90; i += 10) {
        setTrimProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Use the shared trim function from Reels.tsx
      const { blob, duration: trimDuration } = await trimAudioUrlToWavBlob(url, start, end);
      
      setTrimProgress(95);
      
      const trimmedFile = new File([blob], `trimmed-${Date.now()}.wav`, { 
        type: "audio/wav" 
      });
      
      setTrimProgress(100);
      setTrimStatus('success');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
  onBack,
  onSubmit,
  onPickSound,
  maxDurationSec = 60,
  brandName = 'UNERA',
  fetchAvailableSounds,
}) => {
  const [mode, setMode] = useState<EditorMode>('choose');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');

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

  // Trim state
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimStart, setTrimStart] = useState(selectedSound?.audioStart || 0);
  const [trimEnd, setTrimEnd] = useState(selectedSound?.audioEnd || 0);
  const [trimmedAudioFile, setTrimmedAudioFile] = useState<File | null>(null);
  const [isTrimmedAudio, setIsTrimmedAudio] = useState(false);

  const [playPreview, setPlayPreview] = useState(true);

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

  const soundLabel = selectedSound?.songName || 'Original Sound';
  const soundStart = selectedSound?.audioStart || 0;
  const soundEnd = selectedSound?.audioEnd || 0;
  const soundDurationWindow = soundEnd > soundStart ? soundEnd - soundStart : 0;

  const lyricPreset = useMemo(
    () => LYRIC_PRESETS.find((p) => p.id === lyricsTheme) || LYRIC_PRESETS[0],
    [lyricsTheme]
  );

  const cleanupPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      safeRevoke(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

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

      if (selectedSound?.audioUrl && soundPreviewEnabled) {
        if (!soundAudioRef.current) {
          soundAudioRef.current = new Audio(selectedSound.audioUrl);
        }
        soundAudioRef.current.src = selectedSound.audioUrl;
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
  }, [maxDurationSec, selectedSound, setNextPreviewUrl, soundPreviewEnabled, soundStart, stopRecording]);

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
    setVideoFile(null);
    setNextPreviewUrl(null);
    setMode('choose');
    setCaption('');
    setLocation('');
    setSubmitState('idle');
    setSubmitError('');
    setPlayPreview(true);
    setTrimmedAudioFile(null);
    setIsTrimmedAudio(false);
  }, [cleanupCamera, setNextPreviewUrl]);

  // Handle trim confirmation
  const handleTrimConfirm = useCallback((start: number, end: number, trimmedFile?: File) => {
    setTrimStart(start);
    setTrimEnd(end);
    
    if (trimmedFile) {
      setTrimmedAudioFile(trimmedFile);
      setIsTrimmedAudio(true);
    }
    
    setIsTrimming(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!videoFile) {
      setSubmitState('error');
      setSubmitError('Please record or upload a video first.');
      return;
    }

    setIsSubmitting(true);
    setSubmitState('uploading');
    setSubmitError('');

    try {
      // Determine trim mode:
      // - For server-stored audio: send metadata trim (audioStart/audioEnd)
      // - For uploaded/trimmed audio: send the actual file
      const isMetadataTrim = !isTrimmedAudio && selectedSound?.audioUrl && !trimmedAudioFile;

      await Promise.resolve(onSubmit({
        caption: caption.trim(),
        location: location.trim(),
        visibility,
        videoFile,
        // Audio metadata (always send for server-side reference)
        songName: selectedSound?.songName,
        audioUrl: selectedSound?.originalUrl || selectedSound?.audioUrl,
        audioStart: isMetadataTrim ? trimStart : 0,
        audioEnd: isMetadataTrim ? trimEnd : 0,
        soundKey: selectedSound?.soundKey,
        songId: selectedSound?.songId,
        // Audio file (only for uploaded/trimmed audio)
        audioFile: trimmedAudioFile || undefined,
        // Lyrics
        lyricsText: lyricsText.trim(),
        lyricsTheme,
        lyricsEnabled,
      }));

      setSubmitState('success');
      await sleep(800);
      onBack();
    } catch (error: any) {
      setSubmitState('error');
      setSubmitError(error?.message || 'Failed to publish reel.');
    } finally {
      setIsSubmitting(false);
    }
  }, [caption, location, visibility, videoFile, selectedSound, trimStart, trimEnd, trimmedAudioFile, isTrimmedAudio, lyricsText, lyricsTheme, lyricsEnabled, onBack, onSubmit]);

  useEffect(() => {
    return () => {
      cleanupCamera();
      cleanupPreviewUrl();
      if (soundAudioRef.current) {
        try {
          soundAudioRef.current.pause();
        } catch {}
        soundAudioRef.current = null;
      }
    };
  }, [cleanupCamera, cleanupPreviewUrl]);

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

  // Update trim values when selectedSound changes
  useEffect(() => {
    if (selectedSound) {
      setTrimStart(selectedSound.audioStart || 0);
      setTrimEnd(selectedSound.audioEnd || 0);
    }
  }, [selectedSound]);

  const lyricStyle = useMemo<React.CSSProperties>(() => ({
    transform: `scale(${lyricsScale})`,
    bottom: `${lyricsBottomOffset}%`,
  }), [lyricsBottomOffset, lyricsScale]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black text-white overflow-hidden font-sans recorder-page">
      <style>{RECORDER_STYLES}</style>

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
            if (mode === 'trim') {
              setMode('preview');
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
            {mode === 'choose' ? 'Create Reel' : 
             mode === 'camera' ? 'Record' : 
             mode === 'trim' ? 'Trim Sound' : 'Preview'}
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
        <div className="relative h-full flex flex-col items-center justify-center px-6 pb-12 pt-24">
          <div className="w-full max-w-[420px] text-center mb-8">
            <div className="w-24 h-24 mx-auto rounded-[32px] bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl mb-6">
              <i className="fas fa-video text-4xl text-[#1877F2]" />
            </div>
            <h1 className="text-3xl font-black tracking-tight mb-3">Create a TikTok-style Reel</h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Record live, upload from your phone, add professional lyrics, then publish in one clean flow.
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

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handlePickVideo}
            />
          </div>

          <div className="w-full max-w-[420px] mt-8 rounded-[28px] bg-white/5 border border-white/10 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7fb6ff]">Selected Sound</div>
                <div className="text-sm font-bold mt-1 truncate">{soundLabel}</div>
              </div>
              <button
                onClick={onPickSound}
                className="px-4 py-2 rounded-2xl bg-white/10 border border-white/10 text-xs font-black uppercase tracking-[0.14em] active:scale-95"
              >
                {selectedSound ? 'Change' : 'Pick sound'}
              </button>
            </div>
            {selectedSound && soundDurationWindow > 0 && (
              <div className="mt-3 text-white/50 text-xs">
                Sound window: {formatClock(Math.floor(soundDurationWindow))}
              </div>
            )}
          </div>
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
                  muted={!selectedSound || !soundPreviewEnabled}
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

                  {submitState === 'error' && (
                    <div className="mt-3 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">
                      {submitError}
                    </div>
                  )}
                  {submitState === 'success' && (
                    <div className="mt-3 rounded-2xl bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-300">
                      Reel published successfully.
                    </div>
                  )}
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
                        {selectedSound ? 'Sound is attached to this reel flow.' : 'No sound selected yet.'}
                      </div>
                      {isTrimmedAudio && (
                        <div className="mt-2 text-[#45BD62] text-xs font-bold">
                          <i className="fas fa-check-circle mr-1"></i>
                          Trimmed audio ready
                        </div>
                      )}
                      {selectedSound && !isTrimmedAudio && (
                        <div className="mt-2 text-[#1877F2] text-xs font-bold">
                          <i className="fas fa-scissors mr-1"></i>
                          Metadata trim ({trimStart.toFixed(1)}s - {trimEnd.toFixed(1)}s)
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {selectedSound && (
                        <button
                          onClick={() => setIsTrimming(true)}
                          className="px-4 py-2 rounded-2xl bg-[#1877F2]/20 border border-[#1877F2]/30 text-xs font-black uppercase tracking-[0.14em]"
                        >
                          <i className="fas fa-scissors mr-1"></i>
                          Trim
                        </button>
                      )}
                      <button
                        onClick={onPickSound}
                        className="px-4 py-2 rounded-2xl bg-white/10 border border-white/10 text-xs font-black uppercase tracking-[0.14em]"
                      >
                        {selectedSound ? 'Change' : 'Pick'}
                      </button>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio Trimmer Modal */}
      {mode === 'trim' && selectedSound?.audioUrl && (
        <AudioTrimmerModal
          url={selectedSound.originalUrl || selectedSound.audioUrl}
          onClose={() => setMode('preview')}
          onConfirm={handleTrimConfirm}
          initialStart={trimStart}
          initialEnd={trimEnd}
          soundName={selectedSound.songName}
          onStopVideo={() => {
            if (previewVideoRef.current) {
              previewVideoRef.current.pause();
            }
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
  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="text-sm font-bold">{label}</div>
        <div className="text-white/60 text-xs font-black uppercase tracking-[0.14em]">{display}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
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

.lyric-overlay {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
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
