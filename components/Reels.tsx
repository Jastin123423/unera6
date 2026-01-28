import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, Reel, ReactionType, Comment, Song } from '../types';

// ==================== TYPES & INTERFACES ====================
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
}

interface SoundUsage {
  [soundId: string]: {
    reels: Reel[];
    count: number;
    sound: Sound;
  };
}

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

// ==================== PROFESSIONAL BEAUTY FILTERS ====================
const EFFECTS = [
  { id: 'none', name: 'Original', filter: 'none' },
  { id: 'beautify', name: 'Glamour', filter: 'brightness(1.1) contrast(1.05) saturate(1.2)' },
  { id: 'soft', name: 'Soft Glow', filter: 'brightness(1.05) blur(0.4px) contrast(0.95)' },
  { id: 'vintage', name: 'Vintage', filter: 'sepia(0.3) contrast(0.9) brightness(0.9)' },
  { id: 'noir', name: 'Noir', filter: 'grayscale(1) contrast(1.2)' },
];

// ==================== ENHANCED CAMERA STUDIO WITH SOUND SYNC ====================
const CameraStudio: React.FC<{ 
  onCapture: (blob: Blob) => void, 
  onClose: () => void,
  selectedSound?: Sound;
  onSoundSync?: (audioUrl: string, startTime: number) => void;
}> = ({ onCapture, onClose, selectedSound, onSoundSync }) => {
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
      const startTime = selectedSound.start || 0;
      soundRef.current.currentTime = startTime;
      soundRef.current.play().catch(() => {});
      setIsSoundPlaying(true);
      setSoundSyncOffset(0);
      
      // Update sound time display
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
        
        // Start selected sound if available
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

  return (
    <div className="fixed inset-0 z-[600] bg-black flex flex-col font-sans overflow-hidden animate-fade-in">
      {/* Sound indicator */}
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

// ==================== ENHANCED AUDIO TRIMMER ====================
const AudioTrimmer: React.FC<{ 
  url: string, 
  onClose: () => void, 
  onConfirm: (start: number, end: number) => void,
  initialStart: number,
  initialEnd: number,
  soundId?: string | number;
  soundName?: string;
}> = ({ url, onClose, onConfirm, initialStart, initialEnd, soundId, soundName }) => {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd > 0 ? initialEnd : Math.min(60, initialStart + 15));
  const [duration, setDuration] = useState(1); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeThumb, setActiveThumb] = useState<'start' | 'end'>('start');
  const containerRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<any>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const checkBounds = () => {
      if (audio.currentTime >= end || audio.currentTime < start) {
        audio.currentTime = start;
        if (isPlaying) {
          audio.play().catch(() => {});
        }
      }
    };

    audio.addEventListener('timeupdate', checkBounds);
    
    if (!isDragging && isPlaying) {
      audio.currentTime = start;
      audio.play().catch(() => {});
    } else if (isDragging) {
      audio.currentTime = activeThumb === 'start' ? start : end;
    }

    return () => audio.removeEventListener('timeupdate', checkBounds);
  }, [start, end, isDragging, activeThumb, isPlaying]);

  useEffect(() => {
    if (isPlaying && audioRef.current) {
      playIntervalRef.current = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
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
        setEnd(Math.min(d, start + 15));
      }
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

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.currentTime = start;
        audioRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
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

      <div className="bg-[#121212] w-full rounded-t-[40px] p-8 pb-14 border-t border-white/10 animate-slide-up shadow-2xl">
        <div className="flex justify-between items-center mb-10">
          <button onClick={onClose} className="text-[#B0B3B8] font-black uppercase text-[10px] tracking-widest px-4 py-2">Cancel</button>
          <div className="text-center">
            <h3 className="font-black text-white uppercase tracking-[4px] text-xs">Precision Sync</h3>
            <p className="text-[9px] text-[#1877F2] font-black mt-1 uppercase tracking-tighter">Adjust Audio Window</p>
            {soundName && (
              <p className="text-[8px] text-white/60 font-bold mt-0.5 uppercase tracking-tight truncate max-w-[200px]">
                {soundName}
              </p>
            )}
          </div>
          <button onClick={() => onConfirm(start, end)} className="text-[#1877F2] font-black uppercase text-[10px] tracking-widest px-4 py-2">Done</button>
        </div>

        <div className="flex items-center justify-center gap-4 mb-8">
          <button 
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-white text-xl`}></i>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-white text-sm font-bold">
              {Math.floor(currentTime)}s
            </span>
            <span className="text-white/40 text-[9px] uppercase tracking-widest">Current</span>
          </div>
        </div>

        <div 
          ref={containerRef}
          onMouseDown={(e) => handleTrackInteraction(e.clientX)}
          onTouchStart={(e) => handleTrackInteraction(e.touches[0].clientX)}
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
              type="range" min="0" max={duration} step="0.1" value={start} 
              onMouseDown={() => { setIsDragging(true); setActiveThumb('start'); }}
              onMouseUp={() => setIsDragging(false)}
              onChange={(e) => setStart(Math.min(parseFloat(e.target.value), end - 0.5))}
              className={`precision-slider slider-blue ${activeThumb === 'start' ? 'slider-active' : ''}`}
            />
            <input 
              type="range" min="0" max={duration} step="0.1" value={end} 
              onMouseDown={() => { setIsDragging(true); setActiveThumb('end'); }}
              onMouseUp={() => setIsDragging(false)}
              onChange={(e) => setEnd(Math.max(parseFloat(e.target.value), start + 0.5))}
              className={`precision-slider slider-red ${activeThumb === 'end' ? 'slider-active' : ''}`}
            />
          </div>
        </div>

        <div className="flex justify-center gap-4 mt-8">
          <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex flex-col items-center">
            <span className="text-[8px] font-black text-[#1877F2] uppercase tracking-widest">In</span>
            <p className="text-white text-xs font-black">{(start).toFixed(1)}s</p>
          </div>
          <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex flex-col items-center">
            <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Out</span>
            <p className="text-white text-xs font-black">{(end).toFixed(1)}s</p>
          </div>
          <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex flex-col items-center">
            <span className="text-[8px] font-black text-[#45BD62] uppercase tracking-widest">Length</span>
            <p className="text-white text-xs font-black">{(end - start).toFixed(1)}s</p>
          </div>
        </div>

        <audio ref={audioRef} src={url} hidden onLoadedMetadata={handleLoadedMetadata} />
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
}> = ({ sound, onSelect, onPreview, isSelected }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  
  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPreview(sound);
    setIsPlaying(true);
    setTimeout(() => setIsPlaying(false), 3000);
  };

  return (
    <div 
      onClick={() => onSelect(sound)} 
      className={`bg-white/5 p-5 rounded-[24px] flex items-center gap-5 active:scale-95 transition-all border-2 ${isSelected ? 'border-[#1877F2] bg-[#1877F2]/10' : 'border-transparent hover:border-white/10'} group`}
    >
      <div className="relative w-16 h-16 shrink-0">
        {sound.creator?.profile_image_url ? (
          <img src={sound.creator.profile_image_url} className="w-full h-full rounded-2xl object-cover shadow-2xl" alt="" />
        ) : (
          <div className="w-full h-full rounded-2xl bg-gradient-to-br from-[#1877F2] to-[#F3425F] flex items-center justify-center shadow-2xl">
            <i className="fas fa-music text-white text-2xl"></i>
          </div>
        )}
        <button 
          onClick={handlePreview}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
        >
          <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-white text-xl`}></i>
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-lg truncate text-white">{sound.name}</p>
        <p className="text-white/40 text-[11px] font-bold truncate tracking-widest uppercase mt-0.5">
          {sound.creator?.name || 'Original Sound'}
        </p>
        {sound.creationCount !== undefined && sound.creationCount > 0 && (
          <p className="text-[#45BD62] text-[10px] font-bold uppercase tracking-widest mt-1">
            {sound.creationCount.toLocaleString()} uses
          </p>
        )}
      </div>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-inner ${isSelected ? 'bg-[#1877F2] text-white border-[#1877F2]' : 'bg-white/5 text-[#1877F2] border-white/5'}`}>
        <i className={`fas ${isSelected ? 'fa-check' : 'fa-plus'}`}></i>
      </div>
    </div>
  );
};

// ==================== ENHANCED CREATE REEL MODAL ====================
export const CreateReelModal: React.FC<{ 
  currentUser: User, 
  onClose: () => void, 
  onCreate: (data: Partial<Reel> & { 
    videoFile?: File | Blob; 
    audioFile?: File | Blob;
    originalSoundId?: string | number;
  }) => Promise<void> | void,
  initialSound?: Sound | null,
  songs: Song[];
  soundUsages?: SoundUsage;
}> = ({ currentUser, onClose, onCreate, initialSound, songs, soundUsages }) => {
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<Sound | null>(initialSound);
  const [audioStart, setAudioStart] = useState(initialSound?.start || 0);
  const [audioEnd, setAudioEnd] = useState(initialSound?.end || 0);
  const [isMusicPickerOpen, setIsMusicPickerOpen] = useState(false);
  const [isTrimmerOpen, setIsTrimmerOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isStudioPlaying, setIsStudioPlaying] = useState(false);
  const [musicSearch, setMusicSearch] = useState('');
  const [selectedSoundId, setSelectedSoundId] = useState<string | number | null>(initialSound?.id || null);
  const [previewSound, setPreviewSound] = useState<Sound | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'processing' | 'success' | 'error'>('uploading');
  const [uploadError, setUploadError] = useState<string>('');
  
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | Blob | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  
  const [availableSongs, setAvailableSongs] = useState<Song[]>(songs || []);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const audioUploadRef = useRef<HTMLInputElement>(null);

  const availableSounds = useMemo(() => {
    const sounds: Sound[] = availableSongs.map(song => ({
      id: song.id,
      name: song.title,
      url: song.audioUrl,
      creator: { 
        id: song.artistId,
        name: song.artist,
        profile_image_url: song.cover 
      },
      creationCount: soundUsages?.[song.id]?.count || 0,
      duration: song.duration
    }));

    if (soundUsages) {
      Object.values(soundUsages).forEach(usage => {
        if (!sounds.find(s => s.id === usage.sound.id)) {
          sounds.push(usage.sound);
        }
      });
    }

    return sounds.sort((a, b) => (b.creationCount || 0) - (a.creationCount || 0));
  }, [availableSongs, soundUsages]);

  const filteredSounds = useMemo(() => {
    if (!musicSearch.trim()) return availableSounds;
    return availableSounds.filter(s => 
      s.name.toLowerCase().includes(musicSearch.toLowerCase()) || 
      s.creator?.name?.toLowerCase().includes(musicSearch.toLowerCase())
    );
  }, [musicSearch, availableSounds]);

  useEffect(() => {
    if (mediaPreview && selectedAudio && audioRef.current && videoRef.current) {
      const audio = audioRef.current;
      const video = videoRef.current;

      if (isStudioPlaying) {
        const sync = () => {
          const expectedAudioTime = video.currentTime + audioStart;
          if (Math.abs(audio.currentTime - expectedAudioTime) > 0.5) {
            audio.currentTime = expectedAudioTime;
          }
          if (audioEnd > 0 && audio.currentTime >= audioEnd) {
            video.currentTime = 0;
            audio.currentTime = audioStart;
          }
        };

        video.addEventListener('timeupdate', sync);
        if (video.paused) video.play().catch(() => {});
        if (audio.paused) audio.play().catch(() => {});
        return () => video.removeEventListener('timeupdate', sync);
      } else {
        video.pause();
        audio.pause();
      }
    }
  }, [mediaPreview, selectedAudio, audioStart, audioEnd, isStudioPlaying]);

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
    }
  }, [previewSound, isPreviewPlaying]);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setSelectedAudioFile(file);
      const url = URL.createObjectURL(file);
      const newSound: Sound = {
        id: `upload-${Date.now()}`,
        name: file.name.split('.')[0],
        url,
        isOriginal: true,
        creator: currentUser
      };
      setSelectedAudio(newSound);
      setSelectedSoundId(newSound.id);
      setAudioStart(0);
      setAudioEnd(0);
      setIsMusicPickerOpen(false);
      setIsTrimmerOpen(true);
    }
  };

  const handleUpload = async () => {
    if (!selectedVideoFile) return;
    
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
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);
      
      await Promise.resolve(onCreate({
        caption: caption.trim(),
        songName: selectedAudio?.name || 'Original Sound',
        audioUrl: selectedAudio?.url,
        audioStart,
        audioEnd,
        videoFile: selectedVideoFile,
        audioFile: selectedAudioFile || undefined,
        originalSoundId: selectedSoundId || undefined,
      }));
      
      clearInterval(progressInterval);
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
    setSelectedVideoFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setIsStudioPlaying(true);
  };

  const handleSoundSelect = (sound: Sound) => {
    setSelectedAudio(sound);
    setSelectedSoundId(sound.id);
    setAudioStart(sound.start || 0);
    setAudioEnd(sound.end || sound.duration || 60);
    setIsMusicPickerOpen(false);
    setIsTrimmerOpen(true);
  };

  const handleSoundPreview = (sound: Sound) => {
    setPreviewSound(sound);
    setIsPreviewPlaying(true);
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
      
      <div className="fixed inset-0 z-[500] bg-black flex flex-col font-sans animate-fade-in text-white overflow-hidden">
        {isCameraOpen && (
          <CameraStudio 
            selectedSound={selectedAudio || undefined}
            onCapture={(blob) => { 
              setSelectedVideoFile(blob);
              setMediaPreview(URL.createObjectURL(blob));
              setIsCameraOpen(false); 
              setIsStudioPlaying(true);
            }} 
            onClose={() => setIsCameraOpen(false)} 
          />
        )}
        
        <div className="absolute inset-0 z-0 bg-[#050505] flex items-center justify-center">
          {mediaPreview ? (
            <div className="relative w-full h-full" onClick={() => setIsStudioPlaying(!isStudioPlaying)}>
              <video ref={videoRef} src={mediaPreview} className="w-full h-full object-cover opacity-80" loop muted={!!selectedAudio} playsInline />
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
                Sound: {selectedAudio.name}
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
            <button onClick={() => setIsMusicPickerOpen(true)} className="flex flex-col items-center gap-2">
              <div className={`w-14 h-14 rounded-3xl flex items-center justify-center backdrop-blur-2xl transition-all border-2 ${selectedAudio ? 'bg-[#1877F2] border-blue-400 shadow-[0_0_20px_rgba(24,119,242,0.4)]' : 'bg-black/40 border-white/10'}`}>
                <i className="fas fa-music text-xl"></i>
              </div>
              <span className="text-[10px] font-black uppercase text-white/70 tracking-widest">Sound</span>
            </button>
            {selectedAudio && (
              <button onClick={() => setIsTrimmerOpen(true)} className="flex flex-col items-center gap-2 animate-fade-in">
                <div className="w-14 h-14 rounded-3xl bg-black/40 border-2 border-white/10 flex items-center justify-center backdrop-blur-2xl">
                  <i className="fas fa-scissors text-xl"></i>
                </div>
                <span className="text-[10px] font-black uppercase text-white/70 tracking-widest">Trim</span>
              </button>
            )}
            <button onClick={() => {
              setMediaPreview(null);
              setSelectedVideoFile(null);
              setSelectedAudio(null);
              setSelectedAudioFile(null);
              setSelectedSoundId(null);
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

            <input type="file" id="video-input-mobile" className="hidden" accept="video/*" onChange={handleFileSelect} />
            <label htmlFor="video-input-mobile" className="w-full max-w-[340px] bg-white/5 border border-white/10 rounded-[32px] py-8 flex items-center justify-center gap-5 cursor-pointer active:scale-95 transition-all hover:bg-white/10 group">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-[#1877F2]/20 transition-colors">
                <i className="fas fa-cloud-upload-alt text-2xl text-[#B0B3B8] group-hover:text-[#1877F2]"></i>
              </div>
              <p className="font-black uppercase text-sm tracking-[3px] text-[#E4E6EB]">Upload from phone</p>
            </label>
          </div>
        )}

        {mediaPreview && (
          <div className="mt-auto relative z-20 p-8 bg-gradient-to-t from-black via-black/80 to-transparent pb-16">
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
            onClose={() => setIsTrimmerOpen(false)} 
            onConfirm={(s, e) => { setAudioStart(s); setAudioEnd(e); setIsTrimmerOpen(false); setIsStudioPlaying(true); }} 
            initialStart={audioStart} 
            initialEnd={audioEnd}
            soundId={selectedSoundId || undefined}
            soundName={selectedAudio.name}
          />
        )}

        {isMusicPickerOpen && (
          <div className="fixed inset-0 z-[700] bg-[#0A0A0A] flex flex-col animate-slide-up">
            <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-[#121212] shrink-0">
              <button onClick={() => setIsMusicPickerOpen(false)} className="text-[#B0B3B8] font-black uppercase text-[11px] tracking-widest px-4 py-2 rounded-xl hover:bg-white/5 transition-all">Cancel</button>
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
                <input type="file" ref={audioUploadRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />
              </div>

              <div className="h-[1px] bg-white/5 my-6"></div>

              {availableSounds.length > 0 && (
                <>
                  <div className="mb-6">
                    <h4 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                      <i className="fas fa-fire text-[#F3425F]"></i>
                      Trending Sounds
                    </h4>
                    <div className="space-y-4">
                      {availableSounds.slice(0, 5).map(sound => (
                        <SoundItem 
                          key={sound.id} 
                          sound={sound} 
                          onSelect={handleSoundSelect}
                          onPreview={handleSoundPreview}
                          isSelected={selectedSoundId === sound.id}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="h-[1px] bg-white/5 my-6"></div>

                  <div>
                    <h4 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                      <i className="fas fa-music text-[#1877F2]"></i>
                      All Sounds ({filteredSounds.length})
                    </h4>
                    <div className="space-y-4">
                      {filteredSounds.length > 0 ? (
                        filteredSounds.map(sound => (
                          <SoundItem 
                            key={sound.id} 
                            sound={sound} 
                            onSelect={handleSoundSelect}
                            onPreview={handleSoundPreview}
                            isSelected={selectedSoundId === sound.id}
                          />
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <i className="fas fa-music text-4xl text-[#B0B3B8] mb-4"></i>
                          <p className="text-white/60">No sounds found</p>
                          {musicSearch && <p className="text-white/40 text-sm mt-2">Try a different search term</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ==================== ENHANCED SOUND DETAIL VIEW ====================
interface SoundDetailViewProps {
  sound: Sound;
  reels: Reel[];
  onClose: () => void;
  onUseSound: (sound: Sound) => void;
  onReelClick: (id: number) => void;
  soundUsages?: SoundUsage;
}

const SoundDetailView: React.FC<SoundDetailViewProps> = ({ 
  sound, 
  reels, 
  onClose, 
  onUseSound, 
  onReelClick,
  soundUsages 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<any>(null);
  
  const matchingCreations = useMemo(() => {
    return reels.filter(r => 
      r.songName === sound.name || 
      r.audioUrl === sound.url ||
      r.originalSoundId === sound.id
    );
  }, [reels, sound]);

  const creationCount = soundUsages?.[sound.id?.toString()]?.count || matchingCreations.length;
  const creationCountStr = formatCount(creationCount);

  useEffect(() => {
    if (audioRef.current && isPlaying) {
      timerRef.current = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying]);

  const playSoundPreview = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.src = sound.url;
        audioRef.current.currentTime = sound.start || 0;
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
        
        // Auto stop after duration or 10 seconds
        const duration = (sound.end || sound.duration || 30) - (sound.start || 0);
        setTimeout(() => {
          setIsPlaying(false);
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = sound.start || 0;
          }
        }, Math.min(duration * 1000, 10000));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black flex flex-col animate-fade-in font-sans pb-20 overflow-hidden">
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 bg-black/90 backdrop-blur-xl shrink-0">
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-90 transition-transform">
          <i className="fas fa-chevron-left text-sm"></i>
        </button>
        <h3 className="font-black text-white text-[12px] uppercase tracking-[4px]">Sound Details</h3>
        <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
          <i className="fas fa-share-alt text-sm"></i>
        </button>
      </div>
      
      <div className="p-8 flex flex-col md:flex-row items-center gap-10 bg-gradient-to-b from-white/10 to-transparent shrink-0">
        <div className="relative group">
          <div 
            onClick={playSoundPreview}
            className={`w-36 h-36 rounded-full bg-gradient-to-tr from-gray-950 via-gray-900 to-black shadow-[0_0_50px_rgba(0,0,0,0.9)] border-4 border-white/20 flex items-center justify-center ${isPlaying ? 'animate-spin-slow' : ''} cursor-pointer hover:scale-105 transition-transform`}
          >
            <div className="w-12 h-12 rounded-full bg-[#1877F2]/20 border border-white/10 flex items-center justify-center">
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-[#1877F2] text-2xl ml-1`}></i>
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
            <span className="text-white text-[10px] font-bold">
              {formatDuration(currentTime)} / {formatDuration(sound.duration || 30)}
            </span>
          </div>
        </div>

        <div className="flex-1 text-center md:text-left">
          <h2 className="text-3xl font-black text-white mb-2 leading-tight tracking-tighter">
            {sound.name}
          </h2>
          <div className="flex items-center gap-2 mb-1">
            {sound.creator?.profile_image_url && (
              <img src={sound.creator.profile_image_url} className="w-6 h-6 rounded-full object-cover" alt="" />
            )}
            <p className="text-[#1877F2] font-black text-sm uppercase tracking-widest">
              BY {sound.creator?.name || 'Original Sound'}
            </p>
          </div>
          <p className="text-[#B0B3B8] font-bold text-xs uppercase tracking-[4px] mb-8">
            {creationCountStr} VIRAL CREATIONS
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => onUseSound(sound)} 
              className="bg-[#1877F2] text-white px-12 py-4 rounded-2xl font-black text-base shadow-2xl shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-3 flex-1"
            >
              <i className="fas fa-clapperboard text-sm"></i> Use this sound
            </button>
            
            <button 
              onClick={playSoundPreview}
              className={`px-8 py-4 rounded-2xl font-black text-base border transition-all flex items-center justify-center gap-3 ${isPlaying ? 'bg-[#45BD62]/20 text-[#45BD62] border-[#45BD62]' : 'bg-white/10 text-white border-white/20'}`}
            >
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-sm`}></i>
              {isPlaying ? 'Playing...' : 'Preview'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 border-t border-white/5">
        <h4 className="text-white font-black text-sm uppercase tracking-widest mb-4">Sound Statistics</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">Total Uses</p>
            <p className="text-white text-2xl font-black mt-2">{creationCountStr}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">Popularity</p>
            <p className="text-white text-2xl font-black mt-2">
              {creationCount > 1000 ? '🔥 Viral' : creationCount > 100 ? '📈 Rising' : '💎 New'}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">Duration</p>
            <p className="text-white text-2xl font-black mt-2">{formatDuration(sound.duration || 30)}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">Sound Type</p>
            <p className="text-white text-2xl font-black mt-2">
              {sound.isOriginal ? 'Original' : 'Shared'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-0.5 mt-4">
        <div className="px-8 mb-4">
          <h4 className="text-white font-black text-sm uppercase tracking-widest">Latest Creations</h4>
          <p className="text-white/40 text-xs mt-1">Videos using this sound</p>
        </div>
        {matchingCreations.length > 0 ? (
          <div className="grid grid-cols-3 gap-0.5">
            {matchingCreations.map((r: Reel) => (
              <ReelThumbnail 
                key={r.id} 
                reel={r} 
                onClick={() => onReelClick(r.id)} 
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <i className="fas fa-music text-4xl text-[#B0B3B8] mb-4"></i>
            <p className="text-white/60">Be the first to use this sound!</p>
            <button 
              onClick={() => onUseSound(sound)} 
              className="mt-4 bg-[#1877F2] text-white px-6 py-3 rounded-xl font-bold"
            >
              Create First Reel
            </button>
          </div>
        )}
      </div>
      <audio ref={audioRef} hidden />
    </div>
  );
};

// ==================== REEL THUMBNAIL COMPONENT ====================
const ReelThumbnail: React.FC<{
  reel: Reel;
  onClick: () => void;
}> = ({ reel, onClick }) => {
  const formatCount = (num: number): string => {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div 
      onClick={onClick} 
      className="aspect-[9/16] bg-white/5 relative cursor-pointer group overflow-hidden"
    >
      <video 
        src={reel.videoUrl} 
        className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
        muted 
        playsInline 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-white text-[10px] font-black bg-black/40 px-2 py-1 rounded-lg backdrop-blur-md">
        <i className="fas fa-play text-[8px]"></i> 
        {formatCount(reel.shares * 20 + reel.reactions.length * 5)} 
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center">
          <i className="fas fa-play text-white text-xs"></i>
        </div>
      </div>
    </div>
  );
};

// ==================== ENHANCED REELS FEED ====================
interface ReelsFeedProps {
  reels: Reel[];
  users: User[];
  currentUser: User | null;
  onProfileClick: (id: number) => void;
  onCreateReelClick: () => void;
  onReact: (reelId: number, type?: ReactionType) => void;
  onComment: (reelId: number, text: string) => void;
  onShare: (reelId: number, type: 'feed' | 'copy') => void;
  onFollow: (targetUserId: number) => void;
  onUseSound: (sound: Sound) => void;
  checkIsFollowing: (targetUserId: number) => boolean;
  followLoading: { [key: number]: boolean };
  initialReelId?: number | null;
  soundUsages?: SoundUsage;
}

export const ReelsFeed: React.FC<ReelsFeedProps> = ({ 
  reels, 
  users, 
  currentUser, 
  onProfileClick, 
  onCreateReelClick, 
  onReact, 
  onComment, 
  onShare, 
  onFollow, 
  onUseSound, 
  checkIsFollowing,
  followLoading = {},
  initialReelId,
  soundUsages = {}
}) => {
  console.log('REELS DEBUG:', {
    count: reels?.length,
    firstReel: reels?.[0],
    hasVideoUrl: reels?.[0]?.videoUrl,
    hasUserId: reels?.[0]?.userId,
    initialReelId
  });

  const [activeReelId, setActiveReelId] = useState<number | null>(
    initialReelId || (reels[0]?.id || null)
  );
  const [playingReelId, setPlayingReelId] = useState<number | null>(null); 
  const [showComments, setShowComments] = useState(false);
  const [selectedSoundData, setSelectedSoundData] = useState<Sound | null>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});

  const formatCount = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  useEffect(() => {
    if (!initialReelId || reels.length === 0) return;
    
    const timer = setTimeout(() => {
      const el = document.getElementById(`reel-${initialReelId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveReelId(initialReelId);
        setPlayingReelId(initialReelId);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [initialReelId, reels.length]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = Number(entry.target.getAttribute('data-reel-id'));
          setActiveReelId(id);
        }
      });
    }, { threshold: 0.65 });
    
    document.querySelectorAll('.reel-container').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reels]);

  const reelsBySound = useMemo(() => {
    const groups: Record<string, Reel[]> = {};
    
    reels.forEach(reel => {
      const soundKey = reel.audioUrl || reel.songName || 'original';
      if (!groups[soundKey]) {
        groups[soundKey] = [];
      }
      groups[soundKey].push(reel);
    });
    
    return groups;
  }, [reels]);

  useEffect(() => {
    Object.keys(videoRefs.current).forEach((key) => {
      const id = Number(key);
      const video = videoRefs.current[id];
      const audio = audioRefs.current[id];
      const reel = reels.find((r: Reel) => r.id === id);

      if (video) {
        if (id === playingReelId) {
          if (video.paused) video.play().catch(() => {});
          
          if (audio && reel) { 
            video.muted = true; 
            const start = reel.audioStart || 0;
            const end = reel.audioEnd || 1000000;
            
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
            return () => audio.removeEventListener('timeupdate', handleAudioSync);
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

  const extractSoundFromReel = (reel: Reel): Sound => {
    const author = users.find((u: User) => Number(u.id) === Number(reel.userId));
    const usageCount = reel.audioUrl ? reelsBySound[reel.audioUrl]?.length || 0 : 0;
    
    return {
      id: reel.originalSoundId || reel.audioUrl || reel.songName,
      name: reel.songName,
      url: reel.audioUrl || '',
      start: reel.audioStart,
      end: reel.audioEnd,
      creator: author,
      creationCount: usageCount,
      isOriginal: !reel.originalSoundId
    };
  };

  const handleSoundClick = (reel: Reel) => {
    const sound = extractSoundFromReel(reel);
    setSelectedSoundData(sound);
  };

  const handleUseSound = (sound: Sound) => {
    onUseSound(sound);
    setSelectedSoundData(null);
  };

  return (
    <div className="w-full h-[calc(100vh-56px)] flex justify-center bg-black overflow-hidden font-sans relative">
      <div className="w-full max-w-[450px] h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
        {reels.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white p-8">
            <div className="w-24 h-24 rounded-full bg-[#1877F2]/10 flex items-center justify-center mb-6">
              <i className="fas fa-video text-3xl text-[#1877F2]"></i>
            </div>
            <h3 className="text-xl font-black mb-2">No Reels Yet</h3>
            <p className="text-[#B0B3B8] text-sm mb-8 text-center">
              Be the first to create a viral moment!
            </p>
            {currentUser && (
              <button 
                onClick={onCreateReelClick}
                className="bg-[#1877F2] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2"
              >
                <i className="fas fa-plus"></i>
                Create Your First Reel
              </button>
            )}
          </div>
        ) : (
          reels.map((reel: Reel) => {
            const author = users.find((u: User) => Number(u.id) === Number(reel.userId));
            if (!author) return null;
            
            const isFollowing = checkIsFollowing(Number(author.id));
            const isLoadingFollow = !!followLoading[Number(author.id)];
            
            const hasLiked = reel.reactions.some(r => 
              Number(r.userId ?? r.user_id) === Number(currentUser?.id)
            );

            const sound = extractSoundFromReel(reel);

            return (
              <div 
                key={reel.id} 
                id={`reel-${reel.id}`}
                data-reel-id={reel.id} 
                className="reel-container w-full h-full snap-start relative bg-black flex items-center justify-center overflow-hidden"
              >
                <video 
                  ref={el => { if (el) videoRefs.current[reel.id] = el; }} 
                  src={reel.videoUrl} 
                  className="w-full h-full object-cover" 
                  loop 
                  playsInline 
                  onClick={() => setPlayingReelId(playingReelId === reel.id ? null : reel.id)}
                />
                {reel.audioUrl && (
                  <audio 
                    ref={el => { if (el) audioRefs.current[reel.id] = el; }} 
                    src={reel.audioUrl} 
                    loop={false} 
                  />
                )}

                {playingReelId !== reel.id && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-20 h-20 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
                      <i className="fas fa-play text-white text-3xl ml-1"></i>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 w-full p-4 z-20 pb-12 bg-gradient-to-t from-black/95 via-transparent to-transparent">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img 
                            src={author.profile_image_url || author.profileImage} 
                            className="w-11 h-11 rounded-full border-2 border-white/50 object-cover cursor-pointer" 
                            alt="" 
                            onClick={() => onProfileClick(author.id)} 
                          />
                          {currentUser?.id !== author.id && !isFollowing && (
                            <div 
                              onClick={() => onFollow(author.id)} 
                              className="absolute -bottom-1 -right-1 w-4.5 h-4.5 bg-[#1877F2] rounded-full flex items-center justify-center border-2 border-black text-white cursor-pointer hover:scale-110 transition-transform"
                            >
                              <i className="fas fa-plus text-[8px]"></i>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span 
                              className="text-white font-black text-[16px] drop-shadow-xl cursor-pointer hover:underline" 
                              onClick={() => onProfileClick(author.id)}
                            >
                              {author.name}
                            </span>
                            {author.is_verified && (
                              <i className="fas fa-check-circle text-[11px] text-[#1877F2]"></i>
                            )}
                            {!isFollowing && currentUser?.id !== author.id && (
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  onFollow(author.id); 
                                }} 
                                disabled={isLoadingFollow}
                                className="ml-2 bg-[#1877F2] text-white text-[11px] font-black px-3 py-1 rounded-md shadow-lg active:scale-95 transition-all border-none disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isLoadingFollow ? 'Following...' : 'Follow'}
                              </button>
                            )}
                          </div>
                          {sound.creationCount && sound.creationCount > 0 && (
                            <span className="text-[#45BD62] text-[10px] font-bold uppercase tracking-wider mt-0.5">
                              {sound.creationCount.toLocaleString()} uses
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-5 px-1">
                        <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => onReact(reel.id, 'love')}>
                          <i className={`fas fa-heart text-[24px] transition-transform active:scale-150 ${hasLiked ? 'text-[#F3425F]' : 'text-white'}`}></i>
                          <span className="text-white text-[11px] font-black">
                            {formatCount(reel.reactions.length)}
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setShowComments(true)}>
                          <i className="fas fa-comment-dots text-[24px] text-white"></i>
                          <span className="text-white text-[11px] font-black">
                            {formatCount(reel.comments.length)}
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => onShare(reel.id, 'feed')}>
                          <i className="fas fa-share text-[24px] text-white"></i>
                          <span className="text-white text-[11px] font-black">
                            {formatCount(reel.shares)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-white text-[15px] font-medium leading-snug drop-shadow-xl line-clamp-2 max-w-[85%]">
                      {reel.caption}
                    </p>
                    
                    <div className="flex items-center justify-between w-full mt-2">
                      <div 
                        className="flex items-center gap-3 text-white/90 text-sm w-48 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 cursor-pointer overflow-hidden active:scale-95 transition-all group" 
                        onClick={() => handleSoundClick(reel)}
                      >
                        <i className="fas fa-music text-[10px] animate-pulse text-[#1877F2]"></i>
                        <div className="relative flex-1 overflow-hidden whitespace-nowrap">
                          <div className="inline-block animate-marquee-slow font-black text-[12px] tracking-tight uppercase">
                            {reel.songName} — {author.name} Original
                            {sound.creationCount && sound.creationCount > 0 && (
                              <span className="text-[#45BD62] ml-2">• {sound.creationCount} uses</span>
                            )}
                          </div>
                        </div>
                        <i className="fas fa-external-link-alt text-[8px] text-white/40 group-hover:text-[#1877F2] transition-colors"></i>
                      </div>

                      <div 
                        className={`w-11 h-11 rounded-full bg-gradient-to-tr from-gray-900 to-black flex items-center justify-center border-2 border-white/20 shadow-2xl cursor-pointer ${playingReelId === reel.id ? 'animate-spin-slow' : ''} hover:scale-110 transition-transform`} 
                        onClick={() => handleSoundClick(reel)}
                      >
                        <div className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center bg-gray-800">
                          <i className="fas fa-compact-disc text-[10px] text-white/80"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {activeReelId && (
        <ReelCommentsSheet 
          isOpen={showComments} 
          onClose={() => setShowComments(false)} 
          comments={reels.find((r: any) => r.id === activeReelId)?.comments || []} 
          users={users} 
          currentUser={currentUser} 
          onAddComment={(text: string) => onComment(activeReelId, text)} 
        />
      )}
      
      {selectedSoundData && (
        <SoundDetailView 
          sound={selectedSoundData} 
          reels={reelsBySound[selectedSoundData.url || selectedSoundData.name] || []} 
          onClose={() => setSelectedSoundData(null)}
          onUseSound={handleUseSound}
          onReelClick={(rid) => { 
            const el = document.getElementById(`reel-${rid}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
              setActiveReelId(rid);
              setPlayingReelId(rid);
            }
            setSelectedSoundData(null);
          }}
          soundUsages={soundUsages}
        />
      )}

      {currentUser && !selectedSoundData && (
        <button 
          onClick={onCreateReelClick} 
          className="absolute bottom-8 right-6 w-16 h-16 bg-[#1877F2] rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-105 active:scale-95 transition-all z-40 border-4 border-black"
        >
          <i className="fas fa-plus text-3xl"></i>
        </button>
      )}
    </div>
  );
};

// ==================== COMMENTS SHEET ====================
const ReelCommentsSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  comments: any[];
  users: User[];
  currentUser: User | null;
  onAddComment: (text: string) => void;
}> = ({ isOpen, onClose, comments, users, currentUser, onAddComment }) => {
  const [text, setText] = useState('');
  
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[400] flex items-end justify-center bg-black/70 font-sans backdrop-blur-sm" 
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[450px] h-[70vh] bg-[#121212] rounded-t-[40px] flex flex-col animate-slide-up border-t border-white/10 shadow-2xl" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#181818] rounded-t-[40px]">
          <span className="text-white font-black text-[13px] ml-4 uppercase tracking-[3px]">
            {comments.length} Comments
          </span>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white active:scale-90 transition-all"
          >
            <i className="fas fa-times text-xs"></i>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {comments.map((c: any) => {
            const author = users.find((u: any) => u.id === c.userId || u.id === c.user_id);
            return (
              <div key={c.id} className="flex gap-4">
                <img 
                  src={author?.profile_image_url || author?.profileImage} 
                  className="w-10 h-10 rounded-full object-cover border-2 border-white/5" 
                  alt="" 
                />
                <div className="flex-1">
                  <p className="text-[#1877F2] font-black text-[11px] uppercase tracking-tighter mb-0.5">
                    {author?.name || 'User'}
                  </p>
                  <p className="text-[#E4E6EB] text-[15px] leading-snug font-medium">
                    {c.text}
                  </p>
                </div>
                <i className="far fa-heart text-[#B0B3B8] text-sm mt-1"></i>
              </div>
            );
          })}
        </div>
        
        <div className="p-6 pb-10 border-t border-white/5 bg-[#0A0A0A]">
          <div className="flex gap-3">
            <input 
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-[#1877F2] focus:bg-white/10 transition-all" 
              placeholder="Add a professional comment..." 
              value={text} 
              onChange={e => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
                  e.preventDefault();
                  onAddComment(text.trim());
                  setText('');
                }
              }}
            />
            <button 
              onClick={() => { 
                const trimmedText = text.trim();
                if (trimmedText) { 
                  onAddComment(trimmedText); 
                  setText(''); 
                }
              }} 
              className="bg-[#1877F2] text-white px-6 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-all disabled:opacity-50"
              disabled={!text.trim()}
            >
              <i className="fas fa-paper-plane text-xs"></i>
            </button>
          </div>
        </div>
      </div>
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
  ReelsFeed,
  CameraStudio,
  AudioTrimmer,
  SoundDetailView,
  UploadLoader
};
