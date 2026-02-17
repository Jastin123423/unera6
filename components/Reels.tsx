import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { User, Reel, ReactionType, Comment, Song } from '../types';

// ==================== TYPES & INTERFACES ====================

type ReelSound = {
  songName: string;
  audioUrl: string;
  audioStart?: number;
  audioEnd?: number;
  songId?: string | number;
  soundKey?: string;
  originalUrl?: string;
};

interface Sound {
  id: string | number;
  name: string;
  url: string;
  start?: number;
  end?: number;
  creator?: User;
  creationCount?: number;
  duration?: number;
  isOriginal?: boolean;
  playCount?: number;
  viewCount?: number;
  coverImage?: string;
  soundKey?: string;
  originalUrl?: string;
}

interface SoundUsage {
  [soundId: string]: {
    reels: Reel[];
    count: number;
    sound: Sound;
    totalViews: number;
  };
}

// ==================== AUDIO EXTRACTION UTILITIES ====================

/**
 * Extracts audio from a video file and returns as WAV blob
 */
async function extractAudioFromVideo(videoFile: File): Promise<{ blob: Blob; duration: number }> {
  return new Promise((resolve, reject) => {
    // Create video element to load the file
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    
    const videoUrl = URL.createObjectURL(videoFile);
    video.src = videoUrl;
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      
      // Create audio context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      
      // Create media element source
      const source = audioContext.createMediaElementSource(video);
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect to destination
      source.connect(destination);
      
      // Create recorder
      const mediaRecorder = new MediaRecorder(destination.stream);
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // Convert recorded audio to WAV format
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        
        // Convert to proper audio format
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const decodedAudio = await audioContext.decodeAudioData(arrayBuffer);
          
          // Convert to WAV
          const wavBlob = audioBufferToWavBlob(decodedAudio);
          
          // Clean up
          URL.revokeObjectURL(videoUrl);
          source.disconnect();
          await audioContext.close();
          
          resolve({
            blob: wavBlob,
            duration: decodedAudio.duration
          });
        } catch (error) {
          reject(error);
        }
      };
      
      // Start recording
      video.currentTime = 0;
      video.play();
      mediaRecorder.start();
      
      // Record until video ends
      video.onended = () => {
        mediaRecorder.stop();
      };
      
      // Handle errors
      video.onerror = (error) => {
        reject(error);
        URL.revokeObjectURL(videoUrl);
      };
    };
    
    video.onerror = (error) => {
      reject(error);
      URL.revokeObjectURL(videoUrl);
    };
  });
}

/**
 * Converts AudioBuffer to WAV Blob
 */
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

  // RIFF header
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // fmt chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits

  // data chunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave + PCM16
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

/**
 * Creates a silent/empty audio file
 */
function createSilentAudio(duration: number): Blob {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass();
  
  // Create empty buffer
  const sampleRate = audioContext.sampleRate;
  const frameCount = Math.floor(duration * sampleRate);
  const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
  
  // Fill with silence (zeros)
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = 0;
  }
  
  const wavBlob = audioBufferToWavBlob(buffer);
  audioContext.close();
  
  return wavBlob;
}

// ==================== ORIGINAL AUDIO FOCUS MANAGER ====================
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

// ==================== ENHANCED CREATE REEL MODAL WITH AUDIO EXTRACTION ====================
export const CreateReelModal: React.FC<{ 
  currentUser: User, 
  onClose: () => void, 
  onCreate: (data: Partial<Reel> & { 
    videoFile: File;
    audioFile?: File | Blob;
    originalSoundId?: string | number;
    soundKey?: string;
    songId?: string | number;
    visibility?: string;
    location?: string;
  }) => Promise<void> | void,
  initialSound?: Sound | null,
  songs: Song[];
  selectedSound?: ReelSound | null;
  onPickSound?: (sound: ReelSound | null) => void;
  toBlobUrl?: (url: string) => Promise<string>;
}> = ({ currentUser, onClose, onCreate, initialSound, songs, selectedSound, onPickSound, toBlobUrl }) => {
  const { stopAllAudio } = useAudioFocus();
  
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<Sound | null>(initialSound || null);
  const [audioStart, setAudioStart] = useState(initialSound?.start || selectedSound?.audioStart || 0);
  const [audioEnd, setAudioEnd] = useState(initialSound?.end || selectedSound?.audioEnd || 0);
  const [isMusicPickerOpen, setIsMusicPickerOpen] = useState(false);
  const [isTrimmerOpen, setIsTrimmerOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isStudioPlaying, setIsStudioPlaying] = useState(false);
  const [musicSearch, setMusicSearch] = useState('');
  const [selectedSoundId, setSelectedSoundId] = useState<string | number | null>(initialSound?.id || selectedSound?.songId || null);
  const [previewSound, setPreviewSound] = useState<Sound | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [availableSongs, setAvailableSongs] = useState<Song[]>(songs || []);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [popularSounds, setPopularSounds] = useState<Sound[]>([]);
  const [loadingPopularSounds, setLoadingPopularSounds] = useState(false);
  
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'processing' | 'success' | 'error'>('uploading');
  const [uploadError, setUploadError] = useState<string>('');
  
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [trimmedAudioFile, setTrimmedAudioFile] = useState<File | null>(null);
  const [isTrimmedAudio, setIsTrimmedAudio] = useState(false);
  
  // New state for audio extraction
  const [isExtractingAudio, setIsExtractingAudio] = useState(false);
  const [extractedAudio, setExtractedAudio] = useState<File | null>(null);
  const [extractedAudioDuration, setExtractedAudioDuration] = useState(0);
  const [extractedAudioProgress, setExtractedAudioProgress] = useState(0);
  
  const [visibility, setVisibility] = useState<string>('public');
  const [location, setLocation] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const audioUploadRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ==================== NEW: Audio Extraction Handler ====================
  const handleExtractAudio = async () => {
    if (!selectedVideoFile) return;
    
    setIsExtractingAudio(true);
    setExtractedAudioProgress(0);
    
    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setExtractedAudioProgress(prev => Math.min(prev + 5, 90));
      }, 200);
      
      // Extract audio from video
      const { blob, duration } = await extractAudioFromVideo(selectedVideoFile);
      
      clearInterval(progressInterval);
      setExtractedAudioProgress(100);
      
      // Create audio file
      const audioFile = new File([blob], `extracted-audio-${Date.now()}.wav`, {
        type: 'audio/wav'
      });
      
      setExtractedAudio(audioFile);
      setExtractedAudioDuration(duration);
      
      // Create audio URL for preview
      const audioUrl = URL.createObjectURL(blob);
      
      // Create sound object
      const extractedSound: Sound = {
        id: `extracted-${Date.now()}`,
        name: `Audio from video`,
        url: audioUrl,
        originalUrl: audioUrl,
        start: 0,
        end: duration,
        creator: currentUser,
        isOriginal: true,
        soundKey: `extracted:${Date.now()}`,
        duration: duration
      };
      
      // Auto-select the extracted audio
      setSelectedAudio(extractedSound);
      setSelectedSoundId(extractedSound.id);
      setSelectedAudioFile(audioFile);
      setAudioStart(0);
      setAudioEnd(duration);
      
      // Auto-open trimmer for fine-tuning
      setIsTrimmerOpen(true);
      
      setIsExtractingAudio(false);
      
    } catch (error) {
      console.error('Failed to extract audio:', error);
      setIsExtractingAudio(false);
      setExtractedAudioProgress(0);
      
      // Show error to user (you might want to add a toast/notification system)
      alert('Failed to extract audio from video. Please try again.');
    }
  };
  
  // ==================== NEW: Create silent audio option ====================
  const handleCreateSilentAudio = () => {
    if (!selectedVideoFile) return;
    
    // Get video duration from preview or estimate
    const videoElement = videoRef.current;
    const duration = videoElement?.duration || 60; // Default to 60s if can't get
    
    // Create silent audio
    const silentBlob = createSilentAudio(duration);
    const silentFile = new File([silentBlob], `silent-audio-${Date.now()}.wav`, {
      type: 'audio/wav'
    });
    
    const silentUrl = URL.createObjectURL(silentBlob);
    
    const silentSound: Sound = {
      id: `silent-${Date.now()}`,
      name: `Silent Audio`,
      url: silentUrl,
      originalUrl: silentUrl,
      start: 0,
      end: duration,
      creator: currentUser,
      isOriginal: true,
      soundKey: `silent:${Date.now()}`,
      duration: duration
    };
    
    setSelectedAudio(silentSound);
    setSelectedSoundId(silentSound.id);
    setSelectedAudioFile(silentFile);
    setAudioStart(0);
    setAudioEnd(duration);
  };

  // ==================== REST OF THE ORIGINAL CODE ====================
  // (Keeping all original functionality intact)
  
  useEffect(() => {
    if (selectedSound) {
      const sound: Sound = {
        id: selectedSound.songId || `selected-${Date.now()}`,
        name: selectedSound.songName,
        url: selectedSound.audioUrl,
        start: selectedSound.audioStart,
        end: selectedSound.audioEnd,
        creator: currentUser,
        isOriginal: true,
        soundKey: selectedSound.soundKey || generateSoundKey(selectedSound),
        originalUrl: selectedSound.originalUrl
      };
      setSelectedAudio(sound);
      setSelectedSoundId(sound.id);
      setAudioStart(selectedSound.audioStart || 0);
      setAudioEnd(selectedSound.audioEnd || 0);
      
      if (!mediaPreview) {
        setIsStudioPlaying(true);
      }
    }
  }, [selectedSound, currentUser]);

  const generateSoundKey = useCallback((sound: Sound | ReelSound | null): string => {
    if (!sound) return 'original:none';
    
    if ('songId' in sound && sound.songId) {
      return `song:${sound.songId}`;
    }
    
    if ('soundKey' in sound && sound.soundKey) {
      return sound.soundKey;
    }
    
    if (selectedSoundId) {
      return `original:${selectedSoundId}`;
    }
    
    return 'original:none';
  }, [selectedSoundId]);

  useEffect(() => {
    if (mediaPreview && selectedAudio && audioRef.current && videoRef.current) {
      const audio = audioRef.current;
      const video = videoRef.current;

      if (isStudioPlaying && !isTrimmerOpen) {
        const syncAudio = () => {
          if (!audio || !video) return;
          
          const expectedAudioTime = video.currentTime + audioStart;
          
          if (audioEnd > 0 && expectedAudioTime >= audioEnd) {
            video.currentTime = 0;
            audio.currentTime = audioStart;
            return;
          }
          
          if (Math.abs(audio.currentTime - expectedAudioTime) > 0.5) {
            audio.currentTime = expectedAudioTime;
          }
        };

        video.addEventListener('timeupdate', syncAudio);
        if (video.paused) video.play().catch(() => {});
        if (audio.paused) audio.play().catch(() => {});

        return () => {
          video.removeEventListener('timeupdate', syncAudio);
        };
      } else {
        video.pause();
        audio.pause();
      }
    }
  }, [mediaPreview, selectedAudio, audioStart, audioEnd, isStudioPlaying, isTrimmerOpen]);

  useEffect(() => {
    if (previewSound && previewAudioRef.current && isPreviewPlaying) {
      const audio = previewAudioRef.current;
      audio.src = previewSound.url;
      audio.currentTime = previewSound.start || 0;
      audio.play().catch(() => {});
      
      const stopAfterDuration = () => {
        setTimeout(() => {
          setIsPreviewPlaying(false);
        }, Math.min(10000, (previewSound.duration || 30) * 1000));
      };
      
      stopAfterDuration();
      
      return () => {
        audio.pause();
      };
    }
  }, [previewSound, isPreviewPlaying]);

  const handleSoundPreview = (sound: Sound) => {
    stopAllAudio();
    
    if (previewSound?.id === sound.id && isPreviewPlaying) {
      setIsPreviewPlaying(false);
      setPreviewSound(null);
    } else {
      setPreviewSound(sound);
      setIsPreviewPlaying(true);
    }
  };

  const handleSoundSelect = (sound: Sound) => {
    stopAllAudio();
    setSelectedAudio(sound);
    setSelectedSoundId(sound.id);
    setAudioStart(sound.start || 0);
    setAudioEnd(sound.end || sound.duration || 60);
    setIsMusicPickerOpen(false);
    
    if (onPickSound) {
      onPickSound({
        songName: sound.name,
        audioUrl: sound.url,
        originalUrl: sound.originalUrl || sound.url,
        audioStart: sound.start || 0,
        audioEnd: sound.end || sound.duration || 60,
        songId: sound.id,
        soundKey: sound.soundKey || generateSoundKey(sound)
      });
    }
    
    setIsStudioPlaying(true);
    setIsTrimmerOpen(true);
  };

  const handleUpload = async () => {
    if (!selectedVideoFile) {
      setUploadStatus('error');
      setUploadError('Please select a video file');
      return;
    }
    
    if (!selectedVideoFile.type.startsWith('video/')) {
      setUploadStatus('error');
      setUploadError('Please select a valid video file');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('uploading');
    setUploadError('');
    
    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Your video is still uploading. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);
    
    try {
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const soundKey = generateSoundKey(selectedAudio);
      
      await Promise.resolve(onCreate({
        caption: caption.trim(),
        songName: selectedAudio?.name || 'Original Sound',
        audioUrl: selectedAudio?.originalUrl || selectedAudio?.url,
        audioStart: trimmedAudioFile ? 0 : audioStart,
        audioEnd: trimmedAudioFile ? 0 : audioEnd,
        videoFile: selectedVideoFile,
        // Use extracted audio if available, otherwise use selected audio
        audioFile: extractedAudio || trimmedAudioFile || selectedAudioFile || undefined,
        originalSoundId: selectedSoundId || undefined,
        soundKey,
        songId: selectedSoundId || undefined,
        visibility,
        location,
      }));
      
      setUploadProgress(100);
      setUploadStatus('processing');
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setUploadStatus('success');
      
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (error: any) {
      console.error('Failed to create reel:', error);
      setUploadStatus('error');
      setUploadError(error?.message || 'Upload failed. Please try again.');
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('video/')) {
      setUploadStatus('error');
      setUploadError('Please select a valid video file (MP4, MOV, etc.)');
      return;
    }
    
    setSelectedVideoFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setIsStudioPlaying(true);
  };

  const handleTrimConfirm = (start: number, end: number, trimmedFile?: File) => {
    setAudioStart(start);
    setAudioEnd(end);
    
    if (trimmedFile) {
      setTrimmedAudioFile(trimmedFile);
      setIsTrimmedAudio(true);
      
      const trimmedAudioUrl = URL.createObjectURL(trimmedFile);
      if (selectedAudio) {
        setSelectedAudio({
          ...selectedAudio,
          url: trimmedAudioUrl,
          start: 0,
          end: end - start
        });
      }
    }
    
    setIsTrimmerOpen(false);
    setIsStudioPlaying(true);
  };

  const handleStopVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsStudioPlaying(false);
  };

  return (
    <>
      {(isUploading || uploadStatus === 'success' || uploadStatus === 'error') && (
        <UploadLoader 
          uploadProgress={uploadProgress}
          uploadStatus={uploadStatus}
          errorMessage={uploadError}
        />
      )}
      
      {isExtractingAudio && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-gradient-to-b from-[#1A1A1A] to-[#0A0A0A] rounded-3xl p-8 max-w-sm w-full border border-white/10 shadow-2xl">
            <div className="flex flex-col items-center justify-center gap-6">
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
                    strokeDasharray={`${extractedAudioProgress * 2.83} 283`}
                    strokeDashoffset="0"
                    className="transition-all duration-300 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
                    <i className="fas fa-music text-2xl text-[#1877F2] animate-pulse"></i>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">Extracting Audio</h3>
                <p className="text-[#B0B3B8] text-sm">
                  Converting video to audio ({Math.round(extractedAudioProgress)}%)
                </p>
                <div className="w-full bg-white/10 rounded-full h-2 mt-4 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#1877F2] to-[#2D8CFF] rounded-full transition-all duration-300"
                    style={{ width: `${extractedAudioProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="fixed inset-0 z-[500] bg-black flex flex-col font-sans animate-fade-in text-white overflow-hidden">
        {isCameraOpen && (
          <CameraStudio 
            selectedSound={selectedAudio || undefined}
            onCapture={(blob) => { 
              const file = new File([blob], `reel-${Date.now()}.mp4`, { type: blob.type || 'video/mp4' });
              setSelectedVideoFile(file);
              setMediaPreview(URL.createObjectURL(blob));
              setIsCameraOpen(false); 
              setIsStudioPlaying(true);
            }} 
            onClose={() => setIsCameraOpen(false)} 
          />
        )}
        
        <div className="absolute inset-0 z-0 bg-[#050505] flex items-center justify-center">
          {mediaPreview ? (
            <div className="relative w-full h-full" onClick={() => !isTrimmerOpen && setIsStudioPlaying(!isStudioPlaying)}>
              <video 
                ref={videoRef} 
                src={mediaPreview} 
                className="w-full h-full object-cover opacity-80" 
                loop 
                muted={!!selectedAudio} 
                playsInline 
              />
              {!isStudioPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 shadow-2xl">
                    <i className="fas fa-play text-white text-3xl ml-1"></i>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-12 max-w-[320px] animate-fade-in">
              <div className="w-24 h-24 bg-white/5 rounded-[40px] flex items-center justify-center mb-8 border border-white/10 mx-auto shadow-2xl">
                <i className="fas fa-clapperboard text-4xl text-[#1877F2] animate-pulse"></i>
              </div>
              <h2 className="text-3xl font-black mb-3 tracking-tighter uppercase leading-none">Studio</h2>
              <p className="text-white/50 text-[14px] font-medium leading-relaxed">Choose your production style to share with the community.</p>
            </div>
          )}
          {selectedAudio && <audio ref={audioRef} src={selectedAudio.url} hidden />}
          {previewSound && <audio ref={previewAudioRef} hidden />}
        </div>

        <div className="relative z-20 h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/90 to-transparent pt-2">
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center border border-white/10 active:scale-90 transition-transform">
            <i className="fas fa-times text-lg"></i>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-[5px] text-[#1877F2]">UNERA PRO</span>
            {selectedAudio && (
              <span className="text-[8px] text-white/60 font-bold uppercase tracking-tight truncate max-w-[150px]">
                {extractedAudio ? 'Extracted: ' : isTrimmedAudio ? 'Trimmed: ' : 'Sound: '}{selectedAudio.name}
              </span>
            )}
          </div>
          <button 
            onClick={handleUpload} 
            disabled={!selectedVideoFile || isUploading} 
            className="bg-[#1877F2] text-white px-7 py-2.5 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Uploading...
              </span>
            ) : 'Publish'}
          </button>
        </div>

        {mediaPreview && (
          <div className="absolute right-6 top-[25%] z-20 flex flex-col gap-6">
            {/* ==================== NEW: Audio Extraction Button ==================== */}
            <button 
              onClick={handleExtractAudio}
              disabled={isExtractingAudio}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg border-2 border-purple-400/50 group-hover:scale-105 transition-all">
                <i className="fas fa-file-audio text-xl"></i>
              </div>
              <span className="text-[10px] font-black uppercase text-white/70 tracking-widest">Extract Audio</span>
            </button>
            
            {/* ==================== NEW: Silent Audio Button ==================== */}
            <button 
              onClick={handleCreateSilentAudio}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center shadow-lg border-2 border-gray-500/50 group-hover:scale-105 transition-all">
                <i className="fas fa-volume-mute text-xl"></i>
              </div>
              <span className="text-[10px] font-black uppercase text-white/70 tracking-widest">Silent Audio</span>
            </button>
            
            <button onClick={() => {
              stopAllAudio();
              setIsMusicPickerOpen(true);
            }} className="flex flex-col items-center gap-2">
              <div className={`w-14 h-14 rounded-3xl flex items-center justify-center backdrop-blur-2xl transition-all border-2 ${selectedAudio ? 'bg-[#1877F2] border-blue-400 shadow-[0_0_20px_rgba(24,119,242,0.4)]' : 'bg-black/40 border-white/10'}`}>
                <i className="fas fa-music text-xl"></i>
              </div>
              <span className="text-[10px] font-black uppercase text-white/70 tracking-widest">Sound</span>
            </button>
            
            {selectedAudio && (
              <button onClick={() => {
                stopAllAudio();
                handleStopVideo();
                setIsTrimmerOpen(true);
              }} className="flex flex-col items-center gap-2 animate-fade-in">
                <div className="w-14 h-14 rounded-3xl bg-black/40 border-2 border-white/10 flex items-center justify-center backdrop-blur-2xl">
                  <i className="fas fa-scissors text-xl"></i>
                </div>
                <span className="text-[10px] font-black uppercase text-white/70 tracking-widest">Trim</span>
              </button>
            )}
            
            <button onClick={() => {
              stopAllAudio();
              setMediaPreview(null);
              setSelectedVideoFile(null);
              setSelectedAudio(null);
              setSelectedAudioFile(null);
              setTrimmedAudioFile(null);
              setIsTrimmedAudio(false);
              setExtractedAudio(null); // Clear extracted audio
              setSelectedSoundId(null);
              if (onPickSound) onPickSound(null);
            }} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-3xl bg-red-600/20 border-2 border-red-600/30 text-red-500 flex items-center justify-center backdrop-blur-2xl">
                <i className="fas fa-trash-alt text-xl"></i>
              </div>
              <span className="text-[10px] font-black uppercase text-red-500/70 tracking-widest">Discard</span>
            </button>
          </div>
        )}

        {!mediaPreview && (
          <div className="flex-1 flex flex-col items-center justify-center px-10 gap-8 z-10 animate-fade-in">
            <button 
              onClick={() => setIsCameraOpen(true)}
              className="w-full max-w-[340px] bg-[#1877F2] rounded-[40px] p-10 flex flex-col items-center justify-center cursor-pointer shadow-[0_20px_60px_rgba(24,119,242,0.4)] active:scale-95 transition-all group overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
              <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center mb-6 shadow-2xl group-hover:scale-110 transition-transform">
                <i className="fas fa-video text-white text-4xl"></i>
              </div>
              <p className="font-black uppercase text-lg tracking-[5px] text-white">Record Live</p>
              <p className="text-white/60 text-[11px] font-bold mt-2 uppercase tracking-[2px]">Filters + Enhanced Audio</p>
            </button>

            <div className="flex items-center gap-6 w-full max-w-[340px]">
              <div className="h-[1px] bg-white/10 flex-1"></div>
              <span className="text-[11px] font-black text-white/20 uppercase tracking-widest">OR</span>
              <div className="h-[1px] bg-white/10 flex-1"></div>
            </div>

            <input 
              type="file" 
              id="video-input-mobile" 
              ref={videoInputRef}
              className="hidden" 
              accept="video/*" 
              onChange={handleFileSelect} 
            />
            <label 
              htmlFor="video-input-mobile" 
              className="w-full max-w-[340px] bg-white/5 border border-white/10 rounded-[32px] py-8 flex items-center justify-center gap-5 cursor-pointer active:scale-95 transition-all hover:bg-white/10 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-[#1877F2]/20 transition-colors">
                <i className="fas fa-cloud-upload-alt text-2xl text-[#B0B3B8] group-hover:text-[#1877F2]"></i>
              </div>
              <p className="font-black uppercase text-sm tracking-[3px] text-[#E4E6EB]">Upload from phone</p>
            </label>
          </div>
        )}

        {mediaPreview && (
          <div className="mt-auto relative z-20 p-8 bg-gradient-to-t from-black via-black/80 to-transparent pb-16">
            <div className="mb-6 flex gap-4">
              <select 
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 text-white outline-none text-sm"
              >
                <option value="public">🌍 Public</option>
                <option value="friends">👥 Friends Only</option>
                <option value="private">🔒 Private</option>
              </select>
              
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="📍 Add location"
                className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 text-white outline-none placeholder-white/30 text-sm"
              />
            </div>
            
            <textarea 
              className="w-full bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 text-[18px] outline-none h-40 resize-none font-medium leading-relaxed shadow-inner text-white placeholder-white/20"
              placeholder="Add a caption to your viral moment..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
            />
          </div>
        )}

        {isTrimmerOpen && selectedAudio && (
          <AudioTrimmer 
            url={selectedAudio.url} 
            onClose={() => {
              setIsTrimmerOpen(false);
              setIsStudioPlaying(true);
            }} 
            onConfirm={handleTrimConfirm} 
            initialStart={audioStart} 
            initialEnd={audioEnd}
            soundId={selectedSoundId || undefined}
            soundName={selectedAudio.name}
            onMountStopAll={stopAllAudio}
            onStopVideo={handleStopVideo}
          />
        )}

        {isMusicPickerOpen && (
          <MusicPicker
            songs={availableSongs}
            popularSounds={popularSounds}
            loadingSongs={loadingSongs}
            loadingPopularSounds={loadingPopularSounds}
            musicSearch={musicSearch}
            setMusicSearch={setMusicSearch}
            onSoundSelect={handleSoundSelect}
            onSoundPreview={handleSoundPreview}
            previewSound={previewSound}
            isPreviewPlaying={isPreviewPlaying}
            selectedSoundId={selectedSoundId}
            audioUploadRef={audioUploadRef}
            onAudioUpload={(file) => {
              const url = URL.createObjectURL(file);
              const newSound: Sound = {
                id: `upload-${Date.now()}`,
                name: file.name.split('.')[0],
                url,
                duration: 0,
                isOriginal: true,
                creator: currentUser,
                soundKey: `original:upload-${Date.now()}`,
                originalUrl: url
              };
              setSelectedAudio(newSound);
              setSelectedSoundId(newSound.id);
              setAudioStart(0);
              setAudioEnd(60);
              setIsMusicPickerOpen(false);
              setIsTrimmerOpen(true);
              handleStopVideo();
            }}
            onClose={() => setIsMusicPickerOpen(false)}
          />
        )}
      </div>
    </>
  );
};

// ==================== ORIGINAL AUDIO TRIMMER ====================
async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch audio");
  return await res.arrayBuffer();
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
      for (let i = 0; i <= 90; i += 10) {
        setTrimProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
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

// ==================== MUSIC PICKER COMPONENT ====================
interface MusicPickerProps {
  songs: Song[];
  popularSounds: Sound[];
  loadingSongs: boolean;
  loadingPopularSounds: boolean;
  musicSearch: string;
  setMusicSearch: (search: string) => void;
  onSoundSelect: (sound: Sound) => void;
  onSoundPreview: (sound: Sound) => void;
  previewSound: Sound | null;
  isPreviewPlaying: boolean;
  selectedSoundId: string | number | null;
  audioUploadRef: React.RefObject<HTMLInputElement>;
  onAudioUpload: (file: File) => void;
  onClose: () => void;
}

const MusicPicker: React.FC<MusicPickerProps> = ({
  songs,
  popularSounds,
  loadingSongs,
  loadingPopularSounds,
  musicSearch,
  setMusicSearch,
  onSoundSelect,
  onSoundPreview,
  previewSound,
  isPreviewPlaying,
  selectedSoundId,
  audioUploadRef,
  onAudioUpload,
  onClose
}) => {
  const availableSounds = useMemo(() => {
    const sounds: Sound[] = [];
    
    songs.forEach(song => {
      sounds.push({
        id: `song:${song.id}`,
        name: song.title,
        url: song.audio_url,
        originalUrl: song.audio_url,
        creator: { 
          id: song.artistId,
          name: song.artist,
          profile_image_url: song.cover_url
        },
        creationCount: 0,
        duration: song.duration,
        playCount: song.playCount || 0,
        coverImage: song.cover_url,
        isOriginal: false,
        soundKey: `song:${song.id}`
      });
    });

    if (popularSounds.length > 0) {
      popularSounds.forEach(sound => {
        if (!sounds.find(s => s.id === sound.id)) {
          sounds.push({
            ...sound,
            creationCount: 0
          });
        }
      });
    }

    return sounds.sort((a, b) => (b.creationCount || 0) - (a.creationCount || 0));
  }, [songs, popularSounds]);

  const filteredSounds = useMemo(() => {
    if (!musicSearch.trim()) return availableSounds;
    return availableSounds.filter(s => 
      s.name.toLowerCase().includes(musicSearch.toLowerCase()) || 
      s.creator?.name?.toLowerCase().includes(musicSearch.toLowerCase())
    );
  }, [musicSearch, availableSounds]);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      onAudioUpload(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[700] bg-[#0A0A0A] flex flex-col animate-slide-up">
      <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-[#121212] shrink-0">
        <button onClick={onClose} className="text-[#B0B3B8] font-black uppercase text-[11px] tracking-widest px-4 py-2 rounded-xl hover:bg-white/5 transition-all">Cancel</button>
        <h3 className="font-black text-white uppercase tracking-[6px] text-[12px]">UNERA Sounds</h3>
        <div className="w-20"></div>
      </div>
      
      <div className="p-6 bg-[#121212] shrink-0">
        <div className="relative">
          <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-white/20"></i>
          <input 
            type="text"
            className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 pl-12 text-white outline-none focus:ring-2 focus:ring-[#1877F2]/50 font-medium transition-all"
            placeholder="Search UNERA Sounds..."
            value={musicSearch}
            onChange={(e) => setMusicSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div 
          onClick={() => audioUploadRef.current?.click()}
          className="bg-gradient-to-br from-[#1877F2]/30 to-[#1877F2]/10 border border-[#1877F2]/40 p-8 rounded-[32px] flex items-center gap-6 cursor-pointer hover:from-[#1877F2]/40 transition-all active:scale-95 shadow-2xl"
        >
          <div className="w-16 h-16 bg-[#1877F2] rounded-2xl flex items-center justify-center shadow-2xl">
            <i className="fas fa-plus text-white text-3xl"></i>
          </div>
          <div>
            <p className="font-black text-white text-xl">Upload Custom Sound</p>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">From your device storage</p>
          </div>
          <input 
            type="file" 
            ref={audioUploadRef} 
            className="hidden" 
            accept="audio/*" 
            onChange={handleAudioUpload} 
          />
        </div>

        <div className="h-[1px] bg-white/5 my-6"></div>

        {loadingPopularSounds ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h4 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                <i className="fas fa-fire text-[#F3425F]"></i>
                Trending Sounds
              </h4>
              <div className="space-y-4">
                {popularSounds.slice(0, 5).map(sound => (
                  <SoundItem 
                    key={sound.id} 
                    sound={sound} 
                    onSelect={onSoundSelect}
                    onPreview={onSoundPreview}
                    isSelected={selectedSoundId === sound.id}
                    isPreviewing={previewSound?.id === sound.id && isPreviewPlaying}
                  />
                ))}
              </div>
            </div>

            <div className="h-[1px] bg-white/5 my-6"></div>

            <div>
              <h4 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                <i className="fas fa-music text-[#1877F2]"></i>
                UNERA Music ({loadingSongs ? 'Loading...' : filteredSounds.length})
              </h4>
              {loadingSongs ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredSounds.length > 0 ? (
                <div className="space-y-4">
                  {filteredSounds.map(sound => (
                    <SoundItem 
                      key={sound.id} 
                      sound={sound} 
                      onSelect={onSoundSelect}
                      onPreview={onSoundPreview}
                      isSelected={selectedSoundId === sound.id}
                      isPreviewing={previewSound?.id === sound.id && isPreviewPlaying}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <i className="fas fa-music text-4xl text-[#B0B3B8] mb-4"></i>
                  <p className="text-white/60">No sounds found</p>
                  {musicSearch && <p className="text-white/40 text-sm mt-2">Try a different search term</p>}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ==================== SOUND ITEM COMPONENT ====================
const SoundItem: React.FC<{
  sound: Sound;
  onSelect: (sound: Sound) => void;
  onPreview: (sound: Sound) => void;
  isSelected: boolean;
  isPreviewing?: boolean;
}> = ({ sound, onSelect, onPreview, isSelected, isPreviewing }) => {
  const [isHovering, setIsHovering] = useState(false);
  
  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPreview(sound);
  };

  return (
    <div 
      onClick={() => onSelect(sound)} 
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`bg-white/5 p-5 rounded-[24px] flex items-center gap-5 active:scale-95 transition-all border-2 ${isSelected ? 'border-[#1877F2] bg-[#1877F2]/10' : 'border-transparent hover:border-white/10'} group`}
    >
      <div className="relative w-16 h-16 shrink-0">
        {sound.coverImage || sound.creator?.profile_image_url ? (
          <img 
            src={sound.coverImage || sound.creator?.profile_image_url} 
            className="w-full h-full rounded-2xl object-cover shadow-2xl" 
            alt="" 
          />
        ) : (
          <div className="w-full h-full rounded-2xl bg-gradient-to-br from-[#1877F2] to-[#F3425F] flex items-center justify-center shadow-2xl">
            <i className="fas fa-music text-white text-2xl"></i>
          </div>
        )}
        {(isHovering || isPreviewing) && (
          <button 
            onClick={handlePreview}
            className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl transition-opacity"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <i className={`fas ${isPreviewing ? 'fa-pause' : 'fa-play'} text-white text-lg ml-1`}></i>
            </div>
          </button>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-lg truncate text-white">{sound.name}</p>
        <p className="text-white/40 text-[11px] font-bold truncate tracking-widest uppercase mt-0.5">
          {sound.creator?.name || 'Original Sound'}
        </p>
        <div className="flex items-center gap-3 mt-1">
          {sound.creationCount !== undefined && sound.creationCount > 0 && (
            <span className="text-[#45BD62] text-[10px] font-bold uppercase tracking-widest">
              {sound.creationCount.toLocaleString()} uses
            </span>
          )}
          {sound.playCount !== undefined && sound.playCount > 0 && (
            <span className="text-white/60 text-[10px] font-medium">
              {sound.playCount.toLocaleString()} plays
            </span>
          )}
        </div>
      </div>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-inner ${isSelected ? 'bg-[#1877F2] text-white border-[#1877F2]' : 'bg-white/5 text-[#1877F2] border-white/5'}`}>
        <i className={`fas ${isSelected ? 'fa-check' : 'fa-plus'}`}></i>
      </div>
    </div>
  );
};

// ==================== UPLOAD LOADER ====================
const UploadLoader: React.FC<{ 
  uploadProgress: number; 
  uploadStatus: 'uploading' | 'processing' | 'success' | 'error';
  errorMessage?: string;
}> = ({ uploadProgress, uploadStatus, errorMessage }) => {
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    if (uploadStatus === 'success') {
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
    if (uploadStatus === 'error') {
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadStatus]);
  
  if (!visible) return null;
  
  const getStatusText = () => {
    switch(uploadStatus) {
      case 'uploading': return 'Uploading your reel...';
      case 'processing': return 'Processing video...';
      case 'success': return 'Posted successfully!';
      case 'error': return 'Upload failed';
      default: return 'Uploading...';
    }
  };
  
  const getIcon = () => {
    switch(uploadStatus) {
      case 'uploading': return 'fas fa-cloud-upload-alt animate-pulse';
      case 'processing': return 'fas fa-cog fa-spin';
      case 'success': return 'fas fa-check-circle';
      case 'error': return 'fas fa-exclamation-circle';
      default: return 'fas fa-cloud-upload-alt';
    }
  };
  
  const getColor = () => {
    switch(uploadStatus) {
      case 'uploading': return '#1877F2';
      case 'processing': return '#F7B928';
      case 'success': return '#45BD62';
      case 'error': return '#F3425F';
      default: return '#1877F2';
    }
  };

  const getProgressColor = () => {
    switch(uploadStatus) {
      case 'uploading': return 'from-[#1877F2] to-[#2D8CFF]';
      case 'processing': return 'from-[#F7B928] to-[#FFD166]';
      case 'success': return 'from-[#45BD62] to-[#6BE685]';
      case 'error': return 'from-[#F3425F] to-[#FF6B9D]';
      default: return 'from-[#1877F2] to-[#2D8CFF]';
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-[#1A1A1A] to-[#0A0A0A] rounded-3xl p-8 max-w-sm w-full border border-white/10 shadow-2xl animate-scale-in">
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
                stroke={getColor()}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${uploadStatus === 'success' ? 283 : (uploadProgress * 2.83)} 283`}
                strokeDashoffset="0"
                className="transition-all duration-500 ease-out"
              />
            </svg>
            
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-20 h-20 rounded-full bg-black/50 flex items-center justify-center ${
                uploadStatus === 'success' ? 'animate-pulse' : ''
              }`} style={{
                boxShadow: `0 0 30px ${getColor()}40`
              }}>
                <i className={`${getIcon()} text-2xl`} style={{ color: getColor() }}></i>
              </div>
            </div>
            
            {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
              <div className="absolute inset-[-8px] rounded-full border-2 border-dashed animate-spin-slow" 
                   style={{ borderColor: `${getColor()}40` }}></div>
            )}
          </div>
          
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-2 animate-fade-in">{getStatusText()}</h3>
            <p className="text-[#B0B3B8] text-sm">
              {uploadStatus === 'uploading' && 'Please wait while we upload your video...'}
              {uploadStatus === 'processing' && 'Applying effects and optimizing quality...'}
              {uploadStatus === 'success' && 'Your reel is now live on UNERA!'}
              {uploadStatus === 'error' && errorMessage || 'Please try again'}
            </p>
            
            {uploadStatus === 'uploading' && (
              <div className="space-y-3 mt-4">
                <p className="text-white font-bold text-lg animate-pulse">{Math.round(uploadProgress)}%</p>
                
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${getProgressColor()} rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-xs text-[#B0B3B8]">
                  <span>Uploading</span>
                  <span>≈ {uploadProgress < 50 ? '30s' : '15s'}</span>
                </div>
              </div>
            )}
            
            {uploadStatus === 'error' && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-gradient-to-r from-[#1877F2] to-[#2D8CFF] text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity active:scale-95"
                >
                  <i className="fas fa-redo mr-2"></i> Try Again
                </button>
              </div>
            )}
            
            {uploadStatus === 'success' && (
              <div className="mt-6 flex items-center justify-center gap-2 text-[#45BD62] animate-bounce">
                <i className="fas fa-check-circle text-xl"></i>
                <span className="font-bold">Ready to view!</span>
              </div>
            )}
          </div>
          
          {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
            <div className="text-xs text-white/50 text-center mt-4 px-4 py-2 bg-white/5 rounded-lg">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              Please don't close this window or navigate away
            </div>
          )}
        </div>
      </div>
      
      <style>{`
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
      `}</style>
    </div>
  );
};

// ==================== ENHANCED CAMERA STUDIO ====================
const CameraStudio: React.FC<{ 
  onCapture: (blob: Blob) => void, 
  onClose: () => void,
  selectedSound?: Sound;
  onSoundSync?: (audioUrl: string, startTime: number) => void;
}> = ({ onCapture, onClose, selectedSound, onSoundSync }) => {
  const { stopAllAudio } = useAudioFocus();
  
  const [isRecording, setIsRecording] = useState(false);
  const [activeEffect, setActiveEffect] = useState(EFFECTS[0]);
  const [amplifierLevel, setAmplifierLevel] = useState(2.0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [soundSyncOffset, setSoundSyncOffset] = useState(0);
  const [soundStartTime, setSoundStartTime] = useState<number>(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const soundRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const soundTimerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopAllAudio();
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
      if (soundTimerRef.current) clearInterval(soundTimerRef.current);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [facingMode]);

  useEffect(() => {
    if (selectedSound?.url && soundRef.current) {
      soundRef.current.src = selectedSound.url;
      soundRef.current.currentTime = selectedSound.start || 0;
      setSoundStartTime(selectedSound.start || 0);
      
      if (isRecording && !isSoundPlaying) {
        playSound();
      }
    }
    
    return () => {
      if (soundRef.current) {
        soundRef.current.pause();
        setIsSoundPlaying(false);
      }
    };
  }, [selectedSound, isRecording]);

  const playSound = () => {
    if (soundRef.current && selectedSound?.url) {
      stopAllAudio();
      const startTime = selectedSound.start || 0;
      soundRef.current.currentTime = startTime;
      soundRef.current.play().catch(() => {});
      setIsSoundPlaying(true);
      setSoundSyncOffset(0);
      
      if (soundTimerRef.current) clearInterval(soundTimerRef.current);
      soundTimerRef.current = setInterval(() => {
        if (soundRef.current) {
          setSoundSyncOffset(soundRef.current.currentTime - startTime);
        }
      }, 100);
    }
  };

  const stopSound = () => {
    if (soundRef.current) {
      soundRef.current.pause();
      setIsSoundPlaying(false);
      if (soundTimerRef.current) clearInterval(soundTimerRef.current);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support video recording.");
      }

      const rawStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: false
        } 
      });
      
      streamRef.current = rawStream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      const source = audioContextRef.current.createMediaStreamSource(rawStream);
      const gainNode = audioContextRef.current.createGain();
      const destination = audioContextRef.current.createMediaStreamDestination();
      
      gainNode.gain.value = amplifierLevel;
      source.connect(gainNode);
      gainNode.connect(destination);

      if (videoRef.current) {
        videoRef.current.srcObject = rawStream;
        videoRef.current.onloadedmetadata = () => {
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            processVideo();
          }
        };
      }

      const canvasStream = (canvasRef.current as any).captureStream(30);
      
      const finalStream = new MediaStream([
        canvasStream.getVideoTracks()[0],
        destination.stream.getAudioTracks()[0]
      ]);
      
      processedStreamRef.current = finalStream;

    } catch (err: any) {
      console.error("Camera access failed", err);
      let msg = "Camera access denied.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('Permission')) {
        msg = "Please allow Camera and Microphone access in your browser settings to record live videos.";
      }
      setCameraError(msg);
    }
  };

  const processVideo = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && videoRef.current && canvasRef.current) {
      ctx.filter = activeEffect.filter;
      if (facingMode === 'user') {
        ctx.save();
        ctx.translate(canvasRef.current.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      if (facingMode === 'user') {
        ctx.restore();
      }
      requestRef.current = requestAnimationFrame(processVideo);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    stopSound();
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      stopSound();
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      const stream = processedStreamRef.current;
      
      if (!stream || !(stream instanceof MediaStream) || !stream.active) {
        alert("Preparing camera... Please try again in a second.");
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : MediaRecorder.isTypeSupported('video/webm') 
          ? 'video/webm' 
          : 'video/mp4';

      try {
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          onCapture(blob);
        };

        recorder.start(100); 
        setIsRecording(true);
        setRecordingTime(0);
        
        if (selectedSound?.url) {
          playSound();
        }
        
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      } catch (err) {
        console.error("Recording start failed", err);
        alert("Recording error. Try refreshing or using a different browser.");
      }
    }
  };

  const EFFECTS = [
    { id: 'none', name: 'Original', filter: 'none' },
    { id: 'beautify', name: 'Glamour', filter: 'brightness(1.1) contrast(1.05) saturate(1.2)' },
    { id: 'soft', name: 'Soft Glow', filter: 'brightness(1.05) blur(0.4px) contrast(0.95)' },
    { id: 'vintage', name: 'Vintage', filter: 'sepia(0.3) contrast(0.9) brightness(0.9)' },
    { id: 'noir', name: 'Noir', filter: 'grayscale(1) contrast(1.2)' },
  ];

  return (
    <div className="fixed inset-0 z-[600] bg-black flex flex-col font-sans overflow-hidden animate-fade-in">
      {selectedSound && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-30 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
          <div className="flex items-center gap-2">
            <i className="fas fa-music text-[#1877F2] text-sm"></i>
            <span className="text-white text-xs font-bold truncate max-w-[200px]">
              Using: {selectedSound.name}
            </span>
            {isRecording && isSoundPlaying && (
              <div className="flex items-center gap-1 ml-2">
                {[1, 2, 3].map((i) => (
                  <div 
                    key={i}
                    className="w-1 h-4 bg-[#1877F2] rounded-full animate-equalizer"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            )}
          </div>
          {isRecording && isSoundPlaying && (
            <div className="text-[#1877F2] text-[9px] font-bold mt-1 text-center">
              {soundSyncOffset.toFixed(1)}s
            </div>
          )}
        </div>
      )}
      
      <div className="relative flex-1 bg-[#050505] flex items-center justify-center">
        <canvas ref={canvasRef} className="hidden" />
        
        {cameraError ? (
          <div className="p-8 text-center max-w-sm">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-video-slash text-red-500 text-3xl"></i>
            </div>
            <h3 className="text-white font-black text-xl mb-3 uppercase tracking-tight">Camera Restricted</h3>
            <p className="text-white/60 text-sm mb-10 leading-relaxed">{cameraError}</p>
            <div className="flex flex-col gap-3">
              <button onClick={startCamera} className="bg-[#1877F2] text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all">
                Try Again
              </button>
              <button onClick={onClose} className="bg-white/5 text-white px-8 py-4 rounded-2xl font-black text-sm active:scale-95 transition-all border border-white/10">
                Go Back
              </button>
            </div>
          </div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-full object-cover transition-all duration-300"
            style={{ filter: activeEffect.filter, transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />
        )}
        
        {!cameraError && (
          <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
            <div className="p-6 flex justify-between items-start pointer-events-auto">
              <button onClick={onClose} className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 active:scale-90 transition-transform">
                <i className="fas fa-times text-lg"></i>
              </button>
              {isRecording && (
                <div className="bg-red-600/80 backdrop-blur-md px-4 py-1.5 rounded-full flex items-center gap-2 border border-white/20 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-white"></div>
                  <span className="text-white text-sm font-black tracking-widest">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
                </div>
              )}
              <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 active:scale-90 transition-transform">
                <i className="fas fa-sync-alt text-lg"></i>
              </button>
            </div>

            <div className="mt-auto mb-36 ml-auto p-4 flex flex-col gap-6 pointer-events-auto">
              <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setAmplifierLevel(prev => prev >= 4.0 ? 1.0 : prev + 1.0)}>
                <div className={`w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-md flex items-center justify-center border transition-all ${amplifierLevel > 1.0 ? 'text-[#1877F2] border-[#1877F2] shadow-[0_0_15px_rgba(24,119,242,0.3)]' : 'text-white border-white/10'}`}>
                  <i className="fas fa-microphone-alt text-lg"></i>
                </div>
                <span className="text-[9px] font-black text-white uppercase tracking-widest">{amplifierLevel === 1.0 ? 'Voice' : `${Math.round(amplifierLevel * 100)}%`}</span>
              </div>
              
              {selectedSound && (
                <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => {
                  if (isSoundPlaying) {
                    stopSound();
                  } else {
                    playSound();
                  }
                }}>
                  <div className={`w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-md flex items-center justify-center border transition-all ${isSoundPlaying ? 'text-[#45BD62] border-[#45BD62] shadow-[0_0_15px_rgba(69,189,98,0.3)]' : 'text-white border-white/10'}`}>
                    <i className={`fas ${isSoundPlaying ? 'fa-pause' : 'fa-play'} text-lg`}></i>
                  </div>
                  <span className="text-[9px] font-black text-white uppercase tracking-widest">Sound</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {!cameraError && (
          <>
            <div className="absolute bottom-32 left-0 right-0 z-20 flex gap-4 overflow-x-auto px-6 scrollbar-hide py-2 pointer-events-auto">
              {EFFECTS.map(effect => (
                <button 
                  key={effect.id}
                  onClick={() => setActiveEffect(effect)}
                  className={`flex-shrink-0 flex flex-col items-center gap-2 transition-all ${activeEffect.id === effect.id ? 'scale-110' : 'opacity-40 scale-90'}`}
                >
                  <div className="w-14 h-14 rounded-full border-2 border-white overflow-hidden bg-gray-900 shadow-2xl">
                    <div className="w-full h-full" style={{ background: 'linear-gradient(45deg, #1877F2, #F3425F)', filter: effect.filter }}></div>
                  </div>
                  <span className="text-[10px] font-black text-white uppercase tracking-tighter whitespace-nowrap">{effect.name}</span>
                </button>
              ))}
            </div>

            <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-12 px-8 z-30 pointer-events-auto">
              <button className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center text-white border border-white/10 active:scale-90 transition-transform">
                <i className="fas fa-bolt text-sm"></i>
              </button>
              
              <div 
                onClick={toggleRecording}
                className="w-24 h-24 rounded-full border-4 border-white flex items-center justify-center cursor-pointer active:scale-95 transition-all bg-white/5 backdrop-blur-sm relative"
              >
                {isRecording ? (
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-14 h-14 bg-red-600 rounded-xl animate-pulse opacity-40"></div>
                    <div className="w-10 h-10 rounded-xl bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.8)] border border-white/20"></div>
                  </div>
                ) : (
                  <div className="w-18 h-18 rounded-full bg-red-600 shadow-[0_0_25px_rgba(220,38,38,0.5)] border-2 border-white/30"></div>
                )}
              </div>

              <button className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center text-white border border-white/10 active:scale-90 transition-transform">
                <i className="fas fa-magic text-sm"></i>
              </button>
            </div>
          </>
        )}
      </div>
      <audio ref={soundRef} hidden />
    </div>
  );
};

// ==================== STYLES ====================
const styles = `
@keyframes equalizer {
  0%, 100% { height: 4px; }
  50% { height: 16px; }
}
.animate-equalizer {
  animation: equalizer 0.5s ease-in-out infinite;
}

@keyframes marquee-slow {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
.animate-marquee-slow {
  animation: marquee-slow 15s linear infinite;
  padding-left: 100%;
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

@keyframes slide-up {
  0% { transform: translateY(100%); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
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
`;

// Add styles to document
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

export default {
  CreateReelModal,
  AudioTrimmer,
  CameraStudio,
  UploadLoader,
  useAudioFocus
};
