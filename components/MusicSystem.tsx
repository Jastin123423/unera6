
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Song, Episode, User, AudioTrack } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

// --- API Client ---
const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const token = localStorage.getItem('unera_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(endpoint, {
            ...options,
            headers,
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        
        if (Array.isArray(data)) {
            return { data, success: true };
        }
        
        return { data: data.data || data, success: true };
    } catch (error: any) {
        console.error('API Error:', error);
        return { 
            data: [], 
            success: false, 
            error: error.message 
        };
    }
};

// --- GLOBAL AUDIO PLAYER ---
interface GlobalAudioPlayerProps {
    currentTrack: AudioTrack | null;
    isPlaying: boolean;
    onTogglePlay: () => void;
    onNext: () => void;
    onPrevious: () => void;
    onClose: () => void;
    onDownload: (id: string) => void;
    onLike: (id: string) => void;
    onArtistClick?: (uploaderId: number) => void;
    isLiked: boolean;
    uploaderProfile?: User | null; 
}

export const GlobalAudioPlayer: React.FC<GlobalAudioPlayerProps> = ({ 
    currentTrack, isPlaying, onTogglePlay, onNext, onPrevious, 
    onClose, onDownload, onLike, onArtistClick, isLiked, uploaderProfile 
}) => {
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [expanded, setExpanded] = useState(false); 
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastUrlRef = useRef<string | null>(null);
    const playPromiseRef = useRef<Promise<void> | null>(null);
    
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.preload = 'metadata';
        }
        
        const audio = audioRef.current;

        const setAudioData = () => {
            if (!isNaN(audio.duration)) {
                setDuration(audio.duration);
            }
        };

        const setAudioTime = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleEnded = () => {
            onNext();
        };

        audio.addEventListener('loadeddata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('ended', handleEnded);

        const managePlayback = async () => {
            if (currentTrack && currentTrack.url) {
                if (lastUrlRef.current !== currentTrack.url) {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.src = currentTrack.url;
                    lastUrlRef.current = currentTrack.url;
                }
                
                if (isPlaying) {
                    try {
                        playPromiseRef.current = audio.play();
                        await playPromiseRef.current;
                    } catch (error: any) {
                        if (error.name !== 'AbortError' && error.name !== 'NotSupportedError') {
                            console.error("Playback failed", error);
                        }
                    }
                } else {
                    if (!audio.paused) {
                        audio.pause();
                    }
                }
            } else {
                audio.pause();
                if (lastUrlRef.current) {
                    audio.removeAttribute('src');
                    lastUrlRef.current = null;
                }
            }
        };

        managePlayback();

        return () => {
            audio.removeEventListener('loadeddata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [currentTrack, isPlaying, onNext]);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    if (!currentTrack) return null;

    return (
        <div className={`fixed bottom-0 left-0 right-0 bg-[#0A0A0A] border-t border-[#222] transition-all duration-500 z-[160] shadow-2xl ${expanded ? 'h-full border-none' : 'h-20 mb-0'}`}>
            {expanded && (
                <div className="flex flex-col h-full w-full relative overflow-hidden bg-gradient-to-b from-gray-900 to-black animate-slide-up">
                    <div className="absolute inset-0 z-0 opacity-40 blur-3xl scale-150 pointer-events-none" style={{ backgroundImage: `url(${currentTrack.cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                    <div className="relative z-10 flex justify-between items-center p-6 pt-10 text-white">
                        <div onClick={() => setExpanded(false)} className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"><i className="fas fa-chevron-down text-2xl"></i></div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Now Playing</span>
                            <span className="text-sm font-bold">{currentTrack.type === 'podcast' ? 'Podcast' : 'Music'}</span>
                        </div>
                        <div onClick={onClose} className="w-10 h-10 rounded-full hover:bg-red-500/20 flex items-center justify-center cursor-pointer transition-colors text-gray-400 hover:text-red-500"><i className="fas fa-times text-xl"></i></div>
                    </div>
                    <div className="relative z-10 flex-1 flex items-center justify-center p-8">
                        <div className={`w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] rounded-full border-[8px] border-[#1A1A1A] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative flex items-center justify-center ${isPlaying ? 'animate-[spin_15s_linear_infinite]' : ''}`} style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}>
                            <img src={currentTrack.cover} className="w-full h-full object-cover" alt="" /><div className="absolute w-8 h-8 bg-[#0A0A0A] rounded-full border-2 border-[#333]"></div>
                        </div>
                    </div>
                    <div className="relative z-10 p-6 sm:p-8 pb-12 bg-gradient-to-t from-black via-black/90 to-transparent">
                        <div className="flex justify-between items-end mb-6">
                            <div className="flex-1 pr-4">
                                <h2 className="text-2xl font-bold text-white mb-2 line-clamp-1">{currentTrack.title}</h2>
                                <div className="flex items-center gap-2 cursor-pointer hover:bg-white/10 p-2 -ml-2 rounded-lg transition-colors w-fit" onClick={() => currentTrack.uploader_id && onArtistClick && onArtistClick(currentTrack.uploader_id)}>
                                    <img src={uploaderProfile?.profile_image_url || currentTrack.cover} className="w-8 h-8 rounded-full border border-white/20 object-cover" alt="" />
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1"><span className="text-white text-[16px] font-bold">{uploaderProfile?.name || currentTrack.artist}</span>{currentTrack.is_verified && <i className="fas fa-check-circle text-xs text-[#1877F2]"></i>}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4"><i className="fas fa-download text-white text-2xl cursor-pointer hover:text-[#1877F2]" onClick={() => onDownload(String(currentTrack.id))}></i><i className={`${isLiked ? 'fas text-[#F3425F]' : 'far text-white'} fa-heart text-2xl cursor-pointer hover:scale-110 transition-transform`} onClick={() => onLike(String(currentTrack.id))}></i></div>
                        </div>
                        <div className="mb-6 group">
                            <input type="range" min={0} max={duration || 100} value={currentTime} onChange={handleSeek} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#1877F2]" />
                            <div className="flex justify-between text-[11px] text-gray-400 font-medium mt-2"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
                        </div>
                        <div className="flex justify-between items-center mb-10 px-4">
                            <div className="w-10"></div><i className="fas fa-step-backward text-white text-3xl cursor-pointer hover:text-[#1877F2]" onClick={onPrevious}></i>
                            <div className="w-16 h-16 bg-[#1877F2] rounded-full flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(24,119,242,0.4)] hover:scale-110 transition-all" onClick={onTogglePlay}><i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play ml-1'} text-white text-2xl`}></i></div>
                            <i className="fas fa-step-forward text-white text-3xl cursor-pointer hover:text-[#1877F2]" onClick={onNext}></i><div className="w-10"></div>
                        </div>
                    </div>
                </div>
            )}
            {!expanded && (
                <div className="flex items-center justify-between px-4 h-full bg-[#141414] border-t border-[#333] relative">
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gray-800"><div className="h-full bg-[#1877F2]" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}></div></div>
                    <div className="flex items-center flex-1 overflow-hidden" onClick={() => setExpanded(true)}>
                        <div className="w-12 h-12 relative group cursor-pointer mr-3"><img src={currentTrack.cover} alt="Cover" className={`w-full h-full object-cover rounded-lg border border-[#333] ${isPlaying ? 'animate-pulse' : ''}`} /></div>
                        <div className="flex-1 cursor-pointer overflow-hidden"><h4 className="text-white font-bold text-[16px] truncate">{currentTrack.title}</h4><p className="text-gray-400 text-[14px] truncate flex items-center gap-1">{currentTrack.artist}{currentTrack.is_verified && <i className="fas fa-check-circle text-[10px] text-[#1877F2]"></i>}</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <i className="fas fa-step-backward text-gray-400 cursor-pointer hover:text-white text-lg" onClick={onPrevious}></i>
                        <div className="w-10 h-10 bg-[#1877F2] rounded-full flex items-center justify-center text-white cursor-pointer hover:scale-105 transition-transform" onClick={onTogglePlay}><i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play ml-0.5'} text-sm`}></i></div>
                        <i className="fas fa-step-forward text-gray-400 cursor-pointer hover:text-white text-lg" onClick={onNext}></i>
                        <div className="cursor-pointer text-gray-400 hover:text-red-500 ml-2" onClick={onClose}><i className="fas fa-times text-lg"></i></div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- AUDIO UPLOAD MODAL ---
export const AudioUploadModal: React.FC<{ currentUser: User; onClose: () => void; onUpload: (items: any[], type: 'music' | 'podcast', meta?: any) => void; }> = ({ currentUser, onClose, onUpload }) => {
    const [mode, setMode] = useState<'single' | 'album' | 'podcast'>('single');
    const [artist, setArtist] = useState(currentUser.name || '');
    const [genre, setGenre] = useState('');
    const [coverPreview, setCoverPreview] = useState('');
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [albumTitle, setAlbumTitle] = useState('');
    const [albumTracks, setAlbumTracks] = useState<{title: string, file: File}[]>([]);
    
    const defaultCover = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const handleMainSubmit = () => {
        const cover = coverPreview || defaultCover;
        if (mode === 'single') {
            if (!title || !audioFile) return alert("Title and audio file required");
            onUpload([{ title, artist, genre, cover, album: 'Single', duration: '3:45', audioUrl: URL.createObjectURL(audioFile) }], 'music');
        } else if (mode === 'album') {
            if (!albumTitle || albumTracks.length === 0) return alert("Album title and at least 1 track required");
            const processedTracks = albumTracks.map(t => ({ title: t.title, artist, genre, album: albumTitle, cover, duration: '3:30', audioUrl: URL.createObjectURL(t.file) }));
            onUpload(processedTracks, 'music', { albumTitle, isAlbum: true });
        } else if (mode === 'podcast') {
            if (!title || !desc || !audioFile) return alert("Title, description and audio required");
            onUpload([{ title, description: desc, host: artist, cover, duration: '45:00', audioUrl: URL.createObjectURL(audioFile) }], 'podcast');
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4">
             <div className="bg-[#1E1E1E] rounded-2xl w-full max-w-3xl border border-[#3E4042] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-[#3E4042] bg-[#252525]">
                    <div className="flex justify-between items-center mb-6">
                        <div><h2 className="text-[#FFF] text-2xl font-bold">Creator Studio</h2><p className="text-[#888] text-sm">Upload to UNERA Music</p></div>
                        <i className="fas fa-times text-[#888] cursor-pointer text-xl hover:text-white" onClick={onClose}></i>
                    </div>
                    <div className="flex p-1 bg-[#111] rounded-lg">
                        {['single', 'album', 'podcast'].map(m => (
                            <button key={m} onClick={() => setMode(m as any)} className={`flex-1 py-2.5 rounded-md font-bold capitalize text-sm transition-all ${mode === m ? 'bg-[#1877F2] text-white' : 'text-[#888]'}`}>{m}</button>
                        ))}
                    </div>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div><label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Main Name</label><input className="w-full bg-[#151515] border border-[#3E4042] p-3 rounded-lg text-white outline-none focus:border-[#1877F2]" value={artist} onChange={e => setArtist(e.target.value)} /></div>
                            <div><label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Genre</label><input className="w-full bg-[#151515] border border-[#3E4042] p-3 rounded-lg text-white outline-none" placeholder="Pop, Tech, News..." value={genre} onChange={e => setGenre(e.target.value)} /></div>
                        </div>
                        <div className="space-y-4">
                            <div><label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Artwork</label><div onClick={() => coverInputRef.current?.click()} className="w-full bg-[#151515] border border-[#3E4042] rounded-lg h-[120px] flex flex-col items-center justify-center cursor-pointer overflow-hidden">{coverPreview ? <img src={coverPreview} className="w-full h-full object-cover" /> : <><i className="fas fa-image text-2xl text-[#666] mb-2"></i><span className="text-[#666] text-xs">Upload Image</span></>}<input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={(e) => { if(e.target.files?.[0]) setCoverPreview(URL.createObjectURL(e.target.files[0])); }} /></div></div>
                        </div>
                    </div>
                    <div className="border-t border-[#3E4042] pt-6">
                        {mode === 'single' && (<div><label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Song Name</label><input className="w-full bg-[#151515] border border-[#3E4042] p-3 rounded-lg text-white outline-none focus:border-[#1877F2] text-lg font-bold" placeholder="Enter song title..." value={title} onChange={e => setTitle(e.target.value)} /></div>)}
                        {mode === 'podcast' && (<div><label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Episode Title</label><input className="w-full bg-[#151515] border border-[#3E4042] p-3 rounded-lg text-white outline-none focus:border-[#1877F2] text-lg font-bold" placeholder="e.g. The Future of AI" value={title} onChange={e => setTitle(e.target.value)} /><textarea className="w-full bg-[#151515] border border-[#3E4042] p-3 rounded-lg text-white outline-none h-40 mt-4" placeholder="Episode description..." value={desc} onChange={e => setDesc(e.target.value)} /></div>)}
                    </div>
                </div>
                <div className="p-5 border-t border-[#3E4042] bg-[#252525] flex justify-end"><button onClick={handleMainSubmit} className="bg-[#1877F2] hover:bg-[#166FE5] text-white py-3 px-8 rounded-xl font-bold">Publish</button></div>
             </div>
        </div>
    );
};

// --- MUSIC SYSTEM MAIN VIEW ---
interface MusicSystemProps {
    currentUser: User | null;
    onPlayTrack: (track: any) => void;
    onProfileClick: (userId: number) => void;
    onDeleteSong?: (songId: string) => void;
    onDeleteEpisode?: (episodeId: string) => void;
    likedTracks: string[];
    onToggleLike: (trackId: string, isLiked: boolean) => void;
    onUploadToFeed?: (song: Song) => void;
    onAddSong?: (song: Song) => void;
    onAddEpisode?: (episode: Episode) => void;
    playHistory: Array<{trackId: string, timestamp: number, duration: number}>;
}

const MusicSystem: React.FC<MusicSystemProps> = ({
    currentUser,
    onPlayTrack,
    onProfileClick,
    onDeleteSong,
    onDeleteEpisode,
    likedTracks,
    onToggleLike,
    onUploadToFeed,
    onAddSong,
    onAddEpisode,
    playHistory
}) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'songs' | 'podcasts' | 'history'>('songs');
    const [songs, setSongs] = useState<Song[]>([]);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [commentText, setCommentText] = useState('');
    const [activeComments, setActiveComments] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Fetch songs from direct endpoint /api/songs
    const fetchSongs = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiFetch('/api/songs');
            if (response.success && Array.isArray(response.data)) {
                const transformedSongs = response.data.map((song: any) => ({
                    id: song.id.toString(),
                    title: song.title,
                    artist: song.artist_name || song.artist || 'Unknown Artist',
                    cover: song.cover_image_url || song.cover || 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
                    audioUrl: song.audio_url,
                    duration: song.duration_seconds || song.duration || 0,
                    uploaderId: song.uploader_id,
                    type: 'music' as const,
                    plays: song.plays || 0,
                    likes: song.likes || 0,
                    shares: song.shares || 0,
                    comments: song.comments || 0,
                    description: song.description,
                    uploadDate: song.created_at || new Date().toISOString(),
                    stats: song.stats || { plays: 0, likes: 0, shares: 0, comments: 0, downloads: 0, reelsUse: 0 }
                }));
                setSongs(transformedSongs);
                setError(null);
            } else {
                setError('Failed to fetch songs');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch podcasts from direct endpoint /api/podcasts
    const fetchPodcasts = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiFetch('/api/podcasts');
            if (response.success && Array.isArray(response.data)) {
                const transformedEpisodes = response.data.map((episode: any) => ({
                    id: episode.id.toString(),
                    title: episode.title,
                    host: episode.host || 'Unknown Host',
                    thumbnail: episode.thumbnail || episode.cover_image_url || 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
                    audioUrl: episode.audio_url,
                    duration: episode.duration_seconds || episode.duration || 0,
                    uploaderId: episode.uploader_id,
                    type: 'podcast' as const,
                    plays: episode.plays || 0,
                    likes: episode.likes || 0,
                    shares: episode.shares || 0,
                    comments: episode.comments || 0,
                    description: episode.description,
                    uploadDate: episode.created_at || new Date().toISOString(),
                    stats: episode.stats || { plays: 0, likes: 0, shares: 0, comments: 0, downloads: 0, reelsUse: 0 }
                }));
                setEpisodes(transformedEpisodes);
                setError(null);
            } else {
                setError('Failed to fetch podcasts');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleLike = async (trackId: string, isMusic: boolean) => {
        if (!currentUser) return alert('Please login to like tracks');
        const isCurrentlyLiked = likedTracks.includes(trackId);
        const endpoint = isMusic ? `/api/songs?action=like&id=${trackId}` : `/api/podcasts?action=like&id=${trackId}`;
        try {
            const response = await apiFetch(endpoint, { method: 'POST' });
            if (response.success) {
                onToggleLike(trackId, !isCurrentlyLiked);
                if (isMusic) {
                    setSongs(prev => prev.map(s => s.id === trackId ? { ...s, likes: isCurrentlyLiked ? Math.max(0, s.likes - 1) : s.likes + 1 } : s));
                } else {
                    setEpisodes(prev => prev.map(e => e.id === trackId ? { ...e, likes: isCurrentlyLiked ? Math.max(0, e.likes - 1) : e.likes + 1 } : e));
                }
            }
        } catch (err) {
            alert('Failed to update like status');
        }
    };

    const handleCommentSubmit = async (trackId: string, isMusic: boolean) => {
        if (!currentUser) return alert('Please login to comment');
        if (!commentText.trim()) return;
        const endpoint = isMusic ? `/api/songs?action=comment&id=${trackId}` : `/api/podcasts?action=comment&id=${trackId}`;
        try {
            const response = await apiFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify({ text: commentText.trim() })
            });
            if (response.success) {
                if (isMusic) {
                    setSongs(prev => prev.map(s => s.id === trackId ? { ...s, comments: s.comments + 1 } : s));
                } else {
                    setEpisodes(prev => prev.map(e => e.id === trackId ? { ...e, comments: e.comments + 1 } : e));
                }
                setCommentText('');
                setActiveComments(null);
                alert('Comment posted!');
            }
        } catch (err) {
            alert('Failed to post comment');
        }
    };

    const handlePlay = async (track: Song | Episode) => {
        const t = track as any;
        onPlayTrack({
            id: t.id,
            url: t.audioUrl || t.audio_url,
            title: t.title,
            artist: t.type === 'music' ? t.artist : t.host,
            cover: t.type === 'music' ? t.cover : t.thumbnail,
            type: t.type
        });
        try {
            const endpoint = t.type === 'music' ? `/api/songs?action=play&id=${t.id}` : `/api/podcasts?action=play&id=${t.id}`;
            await apiFetch(endpoint, { method: 'POST', body: JSON.stringify({ user_id: currentUser?.id }) });
        } catch (err) {}
    };

    const handleUpload = async (file: File, isMusic: boolean) => {
        if (!currentUser) return;
        setUploading(true);
        try {
            const endpoint = isMusic ? '/api/songs' : '/api/podcasts';
            
            // Send standard JSON metadata for entry creation
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                  'Authorization': `Bearer ${localStorage.getItem('unera_token')}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uploader_id: currentUser.id,
                    creator_id: currentUser.id,
                    title: file.name.split('.')[0],
                    artist_name: currentUser.name || currentUser.username,
                    host: currentUser.name || currentUser.username,
                    audio_url: "https://example.com/mock-upload-path.mp3" // Entry only
                })
            });

            if (response.ok) {
                const result = await response.json();
                alert('Uploaded successfully!');
                if (isMusic) { fetchSongs(); if (onAddSong) onAddSong(result as any); }
                else { fetchPodcasts(); if (onAddEpisode) onAddEpisode(result as any); }
            }
        } catch (err) {
            alert('Upload failed.');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (trackId: string, isMusic: boolean) => {
        if (!currentUser || !window.confirm('Delete this track?')) return;
        try {
            const endpoint = isMusic ? `/api/songs?action=delete&id=${trackId}` : `/api/podcasts?action=delete&id=${trackId}`;
            const response = await apiFetch(endpoint, { method: 'DELETE' });
            if (response.success) {
                if (isMusic) { setSongs(prev => prev.filter(s => s.id !== trackId)); if (onDeleteSong) onDeleteSong(trackId); }
                else { setEpisodes(prev => prev.filter(e => e.id !== trackId)); if (onDeleteEpisode) onDeleteEpisode(trackId); }
            }
        } catch (err) {
            alert('Failed to delete');
        }
    };

    useEffect(() => {
        if (activeTab === 'songs') fetchSongs();
        else if (activeTab === 'podcasts') fetchPodcasts();
    }, [activeTab, refreshTrigger, fetchSongs, fetchPodcasts]);

    const renderTrackCard = (track: Song | Episode, isMusic: boolean) => {
        const t = track as any;
        const trackIdStr = String(t.id);
        const isLiked = likedTracks.includes(trackIdStr);
        const coverUrl = isMusic ? t.cover : t.thumbnail;
        const artistName = isMusic ? t.artist : t.host;

        return (
            <div key={t.id} className="bg-[#242526] rounded-lg p-4 mb-4 border border-[#3E4042] hover:bg-[#3A3B3C] transition-colors">
                <div className="flex items-center space-x-4">
                    <div className="relative w-16 h-16 flex-shrink-0">
                        <img src={coverUrl} alt={t.title} className="w-full h-full rounded-md object-cover border border-[#3E4042]" />
                        <button onClick={() => handlePlay(track)} className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md hover:bg-black/60 text-white"><i className="fas fa-play"></i></button>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold truncate">{t.title}</h3>
                        <p className="text-[#B0B3B8] text-sm truncate">{artistName}</p>
                        <div className="flex items-center gap-4 mt-2 text-[12px] text-[#B0B3B8] font-semibold">
                            <span>{t.plays || 0} plays</span>
                            <span>{t.likes || 0} likes</span>
                            <span>{t.comments || 0} comments</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => handleLike(trackIdStr, isMusic)} className={`p-2 rounded-full hover:bg-white/10 transition-colors ${isLiked ? 'text-[#F3425F]' : 'text-[#B0B3B8]'}`}><i className={`${isLiked ? 'fas' : 'far'} fa-heart`}></i></button>
                        <button onClick={() => setActiveComments(activeComments === trackIdStr ? null : trackIdStr)} className="p-2 rounded-full hover:bg-white/10 text-[#B0B3B8]"><i className="far fa-comment"></i></button>
                        <button onClick={() => { navigator.clipboard.writeText(window.location.origin + '/' + (isMusic ? 'song/' : 'podcast/') + t.id); alert('Link copied!'); }} className="p-2 rounded-full hover:bg-white/10 text-[#B0B3B8]"><i className="fas fa-share-alt"></i></button>
                        {currentUser && (currentUser.id === t.uploaderId || currentUser.role === 'admin') && (<button onClick={() => handleDelete(trackIdStr, isMusic)} className="p-2 rounded-full hover:bg-red-500/10 text-red-500"><i className="far fa-trash-alt"></i></button>)}
                    </div>
                </div>
                {activeComments === trackIdStr && (
                    <div className="mt-4 pt-4 border-t border-[#3E4042] flex gap-2">
                        <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..." className="flex-1 bg-[#3A3B3C] text-white px-4 py-2 rounded-full text-sm outline-none focus:ring-1 focus:ring-[#1877F2]" />
                        <button onClick={() => handleCommentSubmit(trackIdStr, isMusic)} disabled={!commentText.trim()} className="bg-[#1877F2] text-white px-4 py-2 rounded-full text-sm font-bold disabled:opacity-50">Post</button>
                    </div>
                )}
            </div>
        );
    };

    const renderHistory = () => {
        if (!currentUser) return <div className="text-center py-20 text-[#B0B3B8]"><p>Please login to see your play history</p></div>;
        const historyTracks = playHistory.map(entry => {
            const song = songs.find(s => String(s.id) === entry.trackId);
            const episode = episodes.find(e => String(e.id) === entry.trackId);
            return song || episode;
        }).filter((t): t is Song | Episode => t !== undefined);
        return (
            <div>
                {historyTracks.length > 0 ? historyTracks.map(t => {
                    const isMusic = (t as any).type === 'music';
                    return renderTrackCard(t, isMusic);
                }) : (
                    <div className="text-center py-20 text-[#B0B3B8]"><i className="fas fa-history text-4xl mb-4 opacity-20"></i><p>No play history yet</p></div>
                )}
            </div>
        );
    };

    const renderContent = () => {
        if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div></div>;
        if (error) return <div className="text-center py-20 text-red-500"><p>{error}</p><button onClick={() => setRefreshTrigger(p => p + 1)} className="mt-4 text-[#1877F2] font-bold">Retry</button></div>;
        switch (activeTab) {
            case 'songs': return songs.length > 0 ? songs.map(s => renderTrackCard(s, true)) : <div className="text-center py-20 text-[#B0B3B8]"><i className="fas fa-music text-4xl mb-4 opacity-20"></i><p>No songs available</p></div>;
            case 'podcasts': return episodes.length > 0 ? episodes.map(e => renderTrackCard(e, false)) : <div className="text-center py-20 text-[#B0B3B8]"><i className="fas fa-podcast text-4xl mb-4 opacity-20"></i><p>No podcasts available</p></div>;
            case 'history': return renderHistory();
            default: return null;
        }
    };

    return (
        <div className="bg-[#18191A] min-h-screen font-sans pb-24">
            <div className="max-w-4xl mx-auto px-4">
                <div className="sticky top-14 bg-[#18191A]/95 backdrop-blur-md z-30 pt-6 pb-4">
                    <h1 className="text-3xl font-bold text-white mb-6">Music & Podcasts</h1>
                    <div className="relative mb-6">
                        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#B0B3B8]"></i>
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search songs, podcasts..." className="w-full bg-[#3A3B3C] text-white pl-12 pr-4 py-3 rounded-full focus:ring-1 focus:ring-[#1877F2] outline-none" />
                    </div>
                    <div className="flex border-b border-[#3E4042]">
                        <button onClick={() => setActiveTab('songs')} className={`flex-1 py-4 text-center font-bold text-sm transition-all ${activeTab === 'songs' ? 'text-[#1877F2] border-b-2 border-[#1877F2]' : 'text-[#B0B3B8] hover:text-white'}`}>SONGS</button>
                        <button onClick={() => setActiveTab('podcasts')} className={`flex-1 py-4 text-center font-bold text-sm transition-all ${activeTab === 'podcasts' ? 'text-[#1877F2] border-b-2 border-[#1877F2]' : 'text-[#B0B3B8] hover:text-white'}`}>PODCASTS</button>
                        <button onClick={() => setActiveTab('history')} className={`flex-1 py-4 text-center font-bold text-sm transition-all ${activeTab === 'history' ? 'text-[#1877F2] border-b-2 border-[#1877F2]' : 'text-[#B0B3B8] hover:text-white'}`}>HISTORY</button>
                    </div>
                </div>
                <div className="mt-4">{renderContent()}</div>
                {currentUser && (currentUser.role === 'admin' || currentUser.role === 'uploader' || currentUser.is_musician) && (
                    <div className="fixed bottom-6 right-6 z-40">
                        <label className="cursor-pointer">
                            <input type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, f.type.startsWith('audio/')); }} disabled={uploading} />
                            <div className="w-14 h-14 bg-[#1877F2] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
                                {uploading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className="fas fa-cloud-upload-alt text-xl"></i>}
                            </div>
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MusicSystem;
