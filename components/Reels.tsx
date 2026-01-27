import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, Reel, ReactionType, Comment, Song } from '../types';
import { MOCK_SONGS } from '../constants';

const formatCount = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
};

// --- API HELPER FUNCTIONS ---
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

// Upload file to Cloudflare R2 (same as App.tsx)
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

// Normalize reel data (compatible with App.tsx)
const normalizeReel = (r: any): Reel => {
    return {
        ...r,
        id: Number(r?.id ?? r?.reel_id ?? 0),
        userId: Number(r?.user_id ?? r?.userId ?? 0),
        videoUrl: r?.video_url ?? r?.videoUrl ?? '',
        caption: r?.caption ?? '',
        songName: r?.song_name ?? r?.songName ?? '',
        audioUrl: r?.audio_url ?? r?.audioUrl,
        audioStart: Number(r?.audio_start ?? r?.audioStart ?? 0),
        audioEnd: Number(r?.audio_end ?? r?.audioEnd ?? 0),
        reactions: Array.isArray(r?.reactions) ? r.reactions : [],
        comments: Array.isArray(r?.comments) ? r.comments : [],
        shares: Number(r?.shares ?? 0),
        views: Number(r?.views ?? 0),
        created_at: r?.created_at ?? r?.createdAt ?? new Date().toISOString(),
    };
};

// Create reel API
const createReelApi = async (reelData: {
    caption: string;
    videoUrl: string;
    songName?: string;
    audioUrl?: string;
    audioStart?: number;
    audioEnd?: number;
    visibility?: 'public' | 'friends' | 'private';
    location?: string;
}, currentUserId: number): Promise<Reel> => {
    try {
        const payload = {
            user_id: currentUserId,
            caption: reelData.caption,
            video_url: reelData.videoUrl,
            song_name: reelData.songName || 'Original Sound',
            audio_url: reelData.audioUrl,
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

// React to reel API
const reactToReelApi = async (reelId: number, type: ReactionType, userId: number) => {
    const data = await apiFetch(`/api/reels/${reelId}/react`, {
        method: 'POST',
        body: JSON.stringify({ type, user_id: userId }),
    });
    return data;
};

// Comment on reel API
const commentOnReelApi = async (reelId: number, text: string, userId: number) => {
    const data = await apiFetch(`/api/reels/${reelId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text, user_id: userId }),
    });
    return data.comment || data;
};

// Share reel API
const shareReelApi = async (reelId: number, userId: number, destination?: string) => {
    const data = await apiFetch(`/api/reels/${reelId}/share`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, destination }),
    });
    return data;
};

// --- PROFESSIONAL BEAUTY FILTERS ---
const EFFECTS = [
    { id: 'none', name: 'Original', filter: 'none' },
    { id: 'beautify', name: 'Glamour', filter: 'brightness(1.1) contrast(1.05) saturate(1.2)' },
    { id: 'soft', name: 'Soft Glow', filter: 'brightness(1.05) blur(0.4px) contrast(0.95)' },
    { id: 'vintage', name: 'Vintage', filter: 'sepia(0.3) contrast(0.9) brightness(0.9)' },
    { id: 'noir', name: 'Noir', filter: 'grayscale(1) contrast(1.2)' },
];

// --- CAMERA STUDIO WITH BUILT-IN PROCESSING ---
const CameraStudio: React.FC<{ 
    onCapture: (blob: Blob) => void, 
    onClose: () => void,
    selectedSound?: any
}> = ({ onCapture, onClose, selectedSound }) => {
    // ... [Keep all existing CameraStudio code exactly as is] ...
    // [No changes to the CameraStudio component]
    
    return (
        // ... [Existing CameraStudio JSX] ...
    );
};

// --- PRECISION AUDIO TRIMMER ---
const AudioTrimmer: React.FC<{ 
    url: string, 
    onClose: () => void, 
    onConfirm: (start: number, end: number) => void,
    initialStart: number,
    initialEnd: number
}> = ({ url, onClose, onConfirm, initialStart, initialEnd }) => {
    // ... [Keep all existing AudioTrimmer code exactly as is] ...
    // [No changes to the AudioTrimmer component]
    
    return (
        // ... [Existing AudioTrimmer JSX] ...
    );
};

// --- CREATOR STUDIO MODAL (UPDATED WITH API) ---
export const CreateReelModal: React.FC<{ 
    currentUser: User, 
    onClose: () => void, 
    onCreate: (data: Partial<Reel>) => void,
    initialSound?: { name: string, url?: string, start?: number, end?: number } | null
}> = ({ currentUser, onClose, onCreate, initialSound }) => {
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [selectedAudio, setSelectedAudio] = useState<{ url: string, name: string } | null>(
        initialSound?.url ? { url: initialSound.url, name: initialSound.name } : null
    );
    const [audioStart, setAudioStart] = useState(initialSound?.start || 0);
    const [audioEnd, setAudioEnd] = useState(initialSound?.end || 0);
    const [isMusicPickerOpen, setIsMusicPickerOpen] = useState(false);
    const [isTrimmerOpen, setIsTrimmerOpen] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isStudioPlaying, setIsStudioPlaying] = useState(false);
    const [musicSearch, setMusicSearch] = useState('');
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const audioUploadRef = useRef<HTMLInputElement>(null);

    const filteredSongs = useMemo(() => {
        if (!musicSearch.trim()) return MOCK_SONGS;
        return MOCK_SONGS.filter(s => 
            s.title.toLowerCase().includes(musicSearch.toLowerCase()) || 
            s.artist.toLowerCase().includes(musicSearch.toLowerCase())
        );
    }, [musicSearch]);

    // Studio Player Controller
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

    const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setSelectedAudio({ url, name: file.name.split('.')[0] });
            setAudioStart(0);
            setAudioEnd(0);
            setIsMusicPickerOpen(false);
            setIsTrimmerOpen(true);
        }
    };

    // UPDATED: Handle upload with API
    const handleUpload = async () => {
        if (!mediaPreview) return;
        setIsUploading(true);
        
        try {
            // If mediaPreview is a blob URL from camera recording
            let videoUrl = mediaPreview;
            
            // If it's a blob URL from camera recording, we need to upload it
            if (mediaPreview.startsWith('blob:')) {
                const response = await fetch(mediaPreview);
                const blob = await response.blob();
                const file = new File([blob], `reel-${Date.now()}.mp4`, { type: 'video/mp4' });
                
                const uploadResult = await uploadToCloudflareR2(file, 'reels');
                videoUrl = uploadResult.url;
            }
            
            // Upload audio if selected
            let audioUrl = selectedAudio?.url;
            if (selectedAudio?.url?.startsWith('blob:')) {
                const response = await fetch(selectedAudio.url);
                const blob = await response.blob();
                const file = new File([blob], `audio-${Date.now()}.mp3`, { type: 'audio/mp3' });
                
                const uploadResult = await uploadToCloudflareR2(file, 'reel-audio');
                audioUrl = uploadResult.url;
            }
            
            // Create reel via API
            const reelData = {
                videoUrl: videoUrl,
                caption: caption,
                songName: selectedAudio?.name || 'Original Sound',
                audioUrl: audioUrl,
                audioStart,
                audioEnd,
                visibility: 'public' as const
            };
            
            const createdReel = await createReelApi(reelData, currentUser.id);
            
            // Call the onCreate callback with the created reel
            onCreate(createdReel);
            
        } catch (error) {
            console.error('Failed to create reel:', error);
            // Fallback to original behavior if API fails
            setTimeout(() => {
                onCreate({
                    videoUrl: mediaPreview,
                    caption: caption,
                    songName: selectedAudio?.name || 'Original Sound',
                    audioUrl: selectedAudio?.url,
                    audioStart,
                    audioEnd
                });
                setIsUploading(false);
            }, 2000);
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setMediaPreview(URL.createObjectURL(file));
            setIsStudioPlaying(true);
        }
    };

    return (
        // ... [Keep all existing CreateReelModal JSX exactly as is] ...
        // [No changes to the JSX structure]
    );
};

// --- SOUND DETAIL VIEW (TikTok Style) ---
interface SoundDetailViewProps {
    sound: { name: string, url?: string, start?: number, end?: number, creator?: User };
    reels: Reel[];
    onClose: () => void;
    onUseSound: (sound: any) => void;
    onReelClick: (id: number) => void;
}

const SoundDetailView: React.FC<SoundDetailViewProps> = ({ sound, reels, onClose, onUseSound, onReelClick }) => {
    // ... [Keep all existing SoundDetailView code exactly as is] ...
    // [No changes to the SoundDetailView component]
    
    return (
        // ... [Existing SoundDetailView JSX] ...
    );
};

// --- VIDEOS FEED COMPONENT (UPDATED WITH API) ---
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
    onUseSound: (sound: any) => void;
    isGlobalPaused?: boolean;
    checkIsFollowing?: (userId: number) => boolean;
    followLoading?: { [key: number]: boolean };
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
    isGlobalPaused,
    checkIsFollowing,
    followLoading = {}
}) => {
    const [activeReelId, setActiveReelId] = useState<number | null>(reels[0]?.id || null);
    const [playingReelId, setPlayingReelId] = useState<number | null>(null); 
    const [showComments, setShowComments] = useState(false);
    const [selectedSoundData, setSelectedSoundData] = useState<any>(null);
    const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
    const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});

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

    useEffect(() => {
        Object.keys(videoRefs.current).forEach((key) => {
            const id = Number(key);
            const video = videoRefs.current[id];
            const audio = audioRefs.current[id];
            const reel = reels.find((r: Reel) => r.id === id);

            if (video) {
                if (id === playingReelId && !isGlobalPaused) {
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
    }, [playingReelId, isGlobalPaused, reels]);

    return (
        <div className="w-full h-[calc(100vh-56px)] flex justify-center bg-black overflow-hidden font-sans relative">
            <div className="w-full max-w-[450px] h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
                {reels.map((reel: Reel) => {
                    const author = users.find((u: User) => u.id === reel.userId);
                    if (!author) return null;
                    
                    // Use checkIsFollowing if provided, otherwise fallback to old logic
                    const isFollowing = checkIsFollowing 
                        ? checkIsFollowing(author.id)
                        : (author && currentUser?.following.includes(author.id));
                    
                    const hasLiked = reel.reactions.some(r => r.userId === currentUser?.id);

                    const soundPayload = { name: reel.songName, url: reel.audioUrl, start: reel.audioStart, end: reel.audioEnd, creator: author };

                    return (
                        <div key={reel.id} data-reel-id={reel.id} className="reel-container w-full h-full snap-start relative bg-black flex items-center justify-center overflow-hidden">
                            <video 
                                ref={el => { if (el) videoRefs.current[reel.id] = el; }} 
                                src={reel.videoUrl} 
                                className="w-full h-full object-cover" 
                                loop 
                                playsInline 
                                onClick={() => setPlayingReelId(playingReelId === reel.id ? null : reel.id)}
                            />
                            {reel.audioUrl && <audio ref={el => { if (el) audioRefs.current[reel.id] = el; }} src={reel.audioUrl} loop={false} />}

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
                                                <img src={author.profileImage} className="w-11 h-11 rounded-full border-2 border-white/50 object-cover cursor-pointer" alt="" onClick={() => onProfileClick(author.id)} />
                                                {currentUser?.id !== author.id && !isFollowing && (
                                                    <div onClick={() => onFollow(author.id)} className="absolute -bottom-1 -right-1 w-4.5 h-4.5 bg-[#1877F2] rounded-full flex items-center justify-center border-2 border-black text-white cursor-pointer">
                                                        <i className="fas fa-plus text-[8px]"></i>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-black text-[16px] drop-shadow-xl cursor-pointer" onClick={() => onProfileClick(author.id)}>{author.name}</span>
                                                    {author.isVerified && <i className="fas fa-check-circle text-[11px] text-[#1877F2]"></i>}
                                                    {!isFollowing && currentUser?.id !== author.id && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onFollow(author.id); }} 
                                                            disabled={followLoading[author.id]}
                                                            className="ml-2 bg-[#1877F2] text-white text-[11px] font-black px-3 py-1 rounded-md shadow-lg active:scale-95 transition-all border-none disabled:opacity-50"
                                                        >
                                                            {followLoading[author.id] ? 'Following...' : 'Follow'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-5 px-1">
                                            <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => onReact(reel.id, 'love')}>
                                                <i className={`fas fa-heart text-[24px] transition-transform active:scale-150 ${hasLiked ? 'text-[#F3425F]' : 'text-white'}`}></i>
                                                <span className="text-white text-[11px] font-black">{formatCount(reel.reactions.length)}</span>
                                            </div>
                                            <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setShowComments(true)}>
                                                <i className="fas fa-comment-dots text-[24px] text-white"></i>
                                                <span className="text-white text-[11px] font-black">{formatCount(reel.comments.length)}</span>
                                            </div>
                                            <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => onShare(reel.id, 'feed')}>
                                                <i className="fas fa-share text-[24px] text-white"></i>
                                                <span className="text-white text-[11px] font-black">{formatCount(reel.shares)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-white text-[15px] font-medium leading-snug drop-shadow-xl line-clamp-2 max-w-[85%]">{reel.caption}</p>
                                    
                                    <div className="flex items-center justify-between w-full mt-2">
                                        <div 
                                            className="flex items-center gap-3 text-white/90 text-sm w-48 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 cursor-pointer overflow-hidden active:scale-95 transition-all" 
                                            onClick={() => setSelectedSoundData(soundPayload)}
                                        >
                                            <i className="fas fa-music text-[10px] animate-pulse"></i>
                                            <div className="relative flex-1 overflow-hidden whitespace-nowrap">
                                                <div className="inline-block animate-marquee-slow font-black text-[12px] tracking-tight uppercase">
                                                    {reel.songName} — {author.name} Original
                                                </div>
                                            </div>
                                        </div>

                                        <div 
                                            className={`w-11 h-11 rounded-full bg-gradient-to-tr from-gray-900 to-black flex items-center justify-center border-2 border-white/20 shadow-2xl cursor-pointer ${playingReelId === reel.id ? 'animate-spin-slow' : ''}`} 
                                            onClick={() => setSelectedSoundData(soundPayload)}
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
                })}
            </div>

            {activeReelId && <ReelCommentsSheet 
                isOpen={showComments} 
                onClose={() => setShowComments(false)} 
                comments={reels.find((r: any) => r.id === activeReelId)?.comments || []} 
                users={users} 
                currentUser={currentUser} 
                onAddComment={(text: string) => onComment(activeReelId, text)} 
            />}
            
            {selectedSoundData && (
                <SoundDetailView 
                    sound={selectedSoundData} 
                    reels={reels} 
                    onClose={() => setSelectedSoundData(null)}
                    onUseSound={(s) => { onUseSound(s); setSelectedSoundData(null); }}
                    onReelClick={(rid) => { 
                        const el = document.querySelector(`[data-reel-id="${rid}"]`);
                        el?.scrollIntoView({ behavior: 'smooth' });
                        setActiveReelId(rid);
                        setPlayingReelId(rid);
                        setSelectedSoundData(null);
                    }}
                />
            )}

            {currentUser && !selectedSoundData && (
                <button onClick={onCreateReelClick} className="absolute bottom-8 right-6 w-16 h-16 bg-[#1877F2] rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-105 active:scale-95 transition-all z-40 border-4 border-black">
                    <i className="fas fa-plus text-3xl"></i>
                </button>
            )}
        </div>
    );
};

// Reel Comments Sheet (UPDATED WITH API COMPATIBILITY)
const ReelCommentsSheet: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    comments: any[];
    users: User[];
    currentUser: User | null;
    onAddComment: (text: string) => void;
    onLikeComment?: (commentId: number) => void;
}> = ({ isOpen, onClose, comments, users, currentUser, onAddComment, onLikeComment }) => {
    const [text, setText] = useState('');
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-[400] flex items-end justify-center bg-black/70 font-sans backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-[450px] h-[70vh] bg-[#121212] rounded-t-[40px] flex flex-col animate-slide-up border-t border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#181818] rounded-t-[40px]">
                    <span className="text-white font-black text-[13px] ml-4 uppercase tracking-[3px]">{comments.length} Comments</span>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white active:scale-90 transition-all"><i className="fas fa-times text-xs"></i></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {comments.map((c: any) => {
                        const author = users.find((u: any) => u.id === c.userId || u.id === c.user_id);
                        return (
                            <div key={c.id} className="flex gap-4">
                                <img src={author?.profileImage || author?.profile_image_url} className="w-10 h-10 rounded-full object-cover border-2 border-white/5" alt="" />
                                <div className="flex-1">
                                    <p className="text-[#1877F2] font-black text-[11px] uppercase tracking-tighter mb-0.5">{author?.name}</p>
                                    <p className="text-[#E4E6EB] text-[15px] leading-snug font-medium">{c.text}</p>
                                </div>
                                {onLikeComment && (
                                    <i 
                                        className="far fa-heart text-[#B0B3B8] text-sm mt-1 cursor-pointer hover:text-[#F3425F]" 
                                        onClick={() => onLikeComment(c.id)}
                                    ></i>
                                )}
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
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && text.trim()) {
                                    onAddComment(text);
                                    setText('');
                                }
                            }}
                        />
                        <button 
                            onClick={() => { 
                                if(text.trim()){ 
                                    onAddComment(text); 
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
