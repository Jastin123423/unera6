
import React, { useState, useRef, useEffect } from 'react';
import { User, Reel, ReactionType, Song } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { ReactionButton } from './Feed';
import { MOCK_SONGS } from '../constants';

// --- CREATE REEL COMPONENT (TIKTOK STYLE) ---
interface CreateReelModalProps {
    currentUser: User;
    songs: Song[];
    onClose: () => void;
    onSubmit: (file: File, caption: string, song?: Song | { name: string, url: string }) => void;
}

export const CreateReelModal: React.FC<CreateReelModalProps> = ({ currentUser, songs, onClose, onSubmit }) => {
    const [step, setStep] = useState<'upload' | 'preview' | 'publish'>('upload');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoURL, setVideoURL] = useState<string>('');
    const [caption, setCaption] = useState('');
    const [selectedSong, setSelectedSong] = useState<Song | { name: string, url: string } | null>(null);
    const [showMusicPicker, setShowMusicPicker] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(new Audio());

    useEffect(() => {
        if (selectedSong) {
            audioRef.current.src = (selectedSong as Song).audio_url || (selectedSong as {url: string}).url;
            audioRef.current.loop = true;
            if (videoRef.current) {
                videoRef.current.volume = 0.5;
            }
            audioRef.current.play().catch(e => console.error("Audio play failed", e));
        } else {
            audioRef.current.pause();
            audioRef.current.src = '';
            if (videoRef.current) {
                videoRef.current.volume = 1.0;
            }
        }
        return () => {
            audioRef.current.pause();
        };
    }, [selectedSong]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setVideoFile(file);
            setVideoURL(URL.createObjectURL(file));
            setStep('preview');
        }
    };

    const handlePost = () => {
        if (videoFile) {
            onSubmit(videoFile, caption, selectedSong || undefined);
            onClose();
        }
    };
    
    const handleClose = () => {
        if (videoFile && !window.confirm("Discard this reel?")) return;
        onClose();
    };

    if (step === 'upload') {
        return (
            <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center font-sans animate-fade-in p-4">
                <button onClick={onClose} className="absolute top-4 right-4 text-white text-3xl"><i className="fas fa-times"></i></button>
                <div 
                    className="w-full max-w-sm aspect-[9/16] border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-900 transition-colors relative overflow-hidden"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <i className="fas fa-cloud-upload-alt text-6xl mb-4 text-[#FE2C55]"></i>
                    <h3 className="text-xl font-bold mb-2 text-white">Select video to upload</h3>
                    <p className="text-gray-400 text-sm">Tap to choose a file from your gallery</p>
                    <div className="mt-6 bg-[#FE2C55] px-8 py-2 rounded-sm font-bold text-white">Select File</div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileChange} />
                </div>
            </div>
        );
    }
    
    if (step === 'publish') {
        return (
             <div className="fixed inset-0 z-[200] bg-[#121212] flex flex-col font-sans animate-fade-in text-white">
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <button onClick={() => setStep('preview')}><i className="fas fa-arrow-left text-xl"></i></button>
                    <h2 className="font-bold text-lg">Post</h2>
                    <div className="w-6"></div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                    <div className="flex gap-4">
                        <video src={videoURL} className="w-24 h-36 rounded-lg bg-black object-cover" loop muted />
                        <textarea 
                            className="flex-1 bg-transparent text-white outline-none placeholder-gray-400 resize-none"
                            placeholder="Describe your video..."
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                        />
                    </div>
                    <div className="mt-auto flex gap-2">
                        <button className="flex-1 bg-[#2F2F2F] hover:bg-[#3F3F3F] text-white py-3 rounded-md font-bold text-sm" onClick={handleClose}>Discard</button>
                        <button className="flex-1 bg-[#FE2C55] hover:bg-[#E02045] text-white py-3 rounded-md font-bold text-sm" onClick={handlePost}>Post</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center font-sans animate-fade-in">
            <video ref={videoRef} src={videoURL} className="w-full h-full object-contain" loop autoPlay muted={!!selectedSong} />
            <div className="absolute inset-0 bg-black/10"></div>
            
            <button onClick={handleClose} className="absolute top-6 left-4 text-white text-2xl z-20"><i className="fas fa-arrow-left"></i></button>
            <button onClick={() => setShowMusicPicker(true)} className="absolute top-6 right-4 text-white z-20 bg-black/50 px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 backdrop-blur-sm"><i className="fas fa-music"></i> {selectedSong ? 'Change Sound' : 'Add Sound'}</button>

            <div className="absolute bottom-6 w-full px-4 z-20 flex justify-end">
                <button onClick={() => setStep('publish')} className="bg-[#FE2C55] text-white font-bold px-12 py-3 rounded-md">Next</button>
            </div>

            {showMusicPicker && <MusicPicker songs={songs} onClose={() => setShowMusicPicker(false)} onSelect={(song) => { setSelectedSong(song); setShowMusicPicker(false); }} videoDuration={videoRef.current?.duration || 15} />}
        </div>
    );
};

const MusicPicker: React.FC<{songs: Song[], onClose: () => void, onSelect: (song: Song | {name: string, url: string}) => void, videoDuration: number}> = ({songs, onClose, onSelect, videoDuration}) => {
    const [search, setSearch] = useState('');
    const [showTrimmer, setShowTrimmer] = useState<Song | {name: string, url: string} | null>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            const song = {
                name: file.name.replace(/\.[^/.]+$/, ""),
                url: URL.createObjectURL(file)
            };
            setShowTrimmer(song);
        }
    };
    
    return (
        <div className="absolute inset-0 bg-[#121212] z-30 flex flex-col animate-slide-up">
            <div className="p-4 flex items-center justify-between border-b border-gray-800">
                <div className="w-6"></div>
                <h3 className="font-bold text-lg text-white">Sounds</h3>
                <button onClick={onClose} className="text-white text-xl"><i className="fas fa-times"></i></button>
            </div>
            
            <div className="p-4">
                 <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Search sounds" 
                        className="w-full bg-[#2F2F2F] text-white rounded-lg p-3 pl-10 outline-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                </div>
            </div>

            <div 
                onClick={() => audioInputRef.current?.click()}
                className="p-4 mx-4 bg-[#263951] rounded-xl flex items-center gap-4 cursor-pointer hover:bg-[#2A3F5A] transition-all border border-[#2D88FF]/20"
            >
                <div className="w-12 h-12 bg-[#1877F2] rounded-full flex items-center justify-center shadow-lg"><i className="fas fa-cloud-upload-alt text-white"></i></div>
                <div>
                    <p className="text-white font-bold">Upload From Phone</p>
                    <p className="text-[#B0B3B8] text-xs">Use your own audio file</p>
                </div>
            </div>
            <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />

            <div className="flex-1 overflow-y-auto mt-4">
                {songs.filter(s => s.title.toLowerCase().includes(search.toLowerCase())).map(song => (
                    <div key={song.id} className="flex items-center gap-4 p-3 hover:bg-[#2F2F2F]">
                        <img src={song.cover_image_url} className="w-12 h-12 rounded-lg object-cover" alt={song.title} />
                        <div className="flex-1">
                            <p className="text-white font-semibold truncate">{song.title}</p>
                            <p className="text-gray-400 text-sm">{song.artist_name}</p>
                        </div>
                        <button onClick={() => setShowTrimmer(song)} className="bg-[#FE2C55] text-white text-xs font-bold px-6 py-2 rounded-sm">Use</button>
                    </div>
                ))}
            </div>
            
            {showTrimmer && <MusicTrimmer song={showTrimmer} videoDuration={videoDuration} onDone={(s) => { onSelect(s); setShowTrimmer(null); }} onBack={() => setShowTrimmer(null)} />}
        </div>
    );
};

const MusicTrimmer: React.FC<{song: Song | {name: string, url: string}, videoDuration: number, onDone: (s: Song | {name: string, url: string}) => void, onBack: () => void}> = ({song, videoDuration, onDone, onBack}) => {
    const audioRef = useRef<HTMLAudioElement>(new Audio((song as Song).audio_url || (song as {url:string}).url));
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        const setAudioDuration = () => setDuration(audio.duration);
        audio.addEventListener('loadedmetadata', setAudioDuration);
        audio.play();
        return () => {
            audio.removeEventListener('loadedmetadata', setAudioDuration);
            audio.pause();
        }
    }, [song]);
    
    const [startTime, setStartTime] = useState(0);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        setStartTime(time);
        audioRef.current.currentTime = time;
        if (audioRef.current.paused) audioRef.current.play();
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    return (
        <div className="absolute inset-0 bg-[#121212] z-40 flex flex-col justify-end animate-slide-up">
            <div className="p-4 flex items-center justify-between">
                <button onClick={onBack} className="text-white text-xl"><i className="fas fa-arrow-left"></i></button>
                <h3 className="font-bold text-lg text-white">Trim Sound</h3>
                <button onClick={() => onDone({ ...song, trimStart: startTime, trimEnd: startTime + videoDuration } as any)} className="bg-[#FE2C55] text-white px-4 py-1.5 rounded-md font-bold text-sm">Done</button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-white">
                <i className="fas fa-music text-5xl mb-4"></i>
                <p className="font-bold text-lg">{(song as Song).title || (song as {name: string}).name}</p>
                <p className="text-sm text-gray-400">{(song as Song).artist_name || "Custom Audio"}</p>
                <p className="text-xs text-gray-500 mt-2">{formatTime(videoDuration)}s clip</p>
            </div>
            <div className="p-4 bg-black/50 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <span className="text-white font-mono text-xs">{formatTime(startTime)}</span>
                    <input 
                        type="range"
                        min="0"
                        max={duration ? duration - videoDuration : 0}
                        value={startTime}
                        onChange={handleSeek}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#FE2C55]"
                    />
                    <span className="text-white font-mono text-xs">{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    )
}

interface ReelsFeedProps {
    reels: Reel[];
    users: User[];
    currentUser: User | null;
    onProfileClick: (id: number) => void;
    onCreateReelClick: () => void;
    onLoadMore?: () => void;
    onReact: (reelId: number, type?: ReactionType) => void;
    onComment: (reelId: number, text: string) => void;
    onShare: (reelId: number, type: 'feed' | 'copy') => void;
    onFollow: (userId: number) => void;
    getCommentAuthor: (id: number) => User | undefined;
    initialReelId?: number | null;
}

export const ReelsFeed: React.FC<ReelsFeedProps> = ({ reels, users, currentUser, onProfileClick, onCreateReelClick, onLoadMore, onReact, onComment, onShare, onFollow, getCommentAuthor, initialReelId }) => {
    const [activeReelId, setActiveReelId] = useState<number | null>(initialReelId || null);
    const [isMuted, setIsMuted] = useState(false);
    const [showHeartAnimation, setShowHeartAnimation] = useState<Record<number, boolean>>({});
    const [activeCommentReelId, setActiveCommentReelId] = useState<number | null>(null);
    const [activeShareReelId, setActiveShareReelId] = useState<number | null>(null);
    const [commentText, setCommentText] = useState('');
    const [videoProgress, setVideoProgress] = useState<Record<number, number>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
    const observer = useRef<IntersectionObserver | null>(null);
    const { t } = useLanguage();

    useEffect(() => {
        if (initialReelId && containerRef.current) {
            const index = reels.findIndex(r => r.id === initialReelId);
            if (index !== -1) {
                setTimeout(() => {
                    const el = containerRef.current?.children[index] as HTMLElement;
                    if (el) {
                        el.scrollIntoView({ behavior: 'auto' });
                        setActiveReelId(initialReelId);
                    }
                }, 100);
            }
        } else if (reels.length > 0 && !activeReelId) {
             setActiveReelId(reels[0].id);
        }
    }, [initialReelId, reels]);

    useEffect(() => {
        const options = { root: containerRef.current, rootMargin: '0px', threshold: 0.6 };
        const handleIntersection = (entries: IntersectionObserverEntry[]) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const reelId = Number(entry.target.getAttribute('data-reel-id'));
                    setActiveReelId(reelId);
                    const index = Number(entry.target.getAttribute('data-index'));
                    if (onLoadMore && index >= reels.length - 2) onLoadMore();
                }
            });
        };
        observer.current = new IntersectionObserver(handleIntersection, options);
        document.querySelectorAll('.reel-container').forEach((el) => observer.current?.observe(el));
        return () => observer.current?.disconnect();
    }, [reels, onLoadMore]);

    useEffect(() => {
        Object.keys(videoRefs.current).forEach((key) => {
            const id = Number(key);
            const video = videoRefs.current[id];
            if (video) {
                const shouldPlay = id === activeReelId && activeCommentReelId === null && activeShareReelId === null;
                if (shouldPlay) {
                    if (video.paused) { video.play().catch((e) => {}); }
                } else {
                    if (!video.paused) { video.pause(); }
                }
            }
        });
    }, [activeReelId, activeCommentReelId, activeShareReelId]);

    const handleDoubleTap = (reelId: number) => {
        if(!currentUser) {
            alert("Please login to like reels.");
            return;
        }
        onReact(reelId, 'love');
        setShowHeartAnimation(prev => ({ ...prev, [reelId]: true }));
        setTimeout(() => setShowHeartAnimation(prev => ({ ...prev, [reelId]: false })), 800);
    };

    const toggleMute = (e: React.MouseEvent) => { e.stopPropagation(); setIsMuted(!isMuted); };
    const handleTimeUpdate = (id: number) => { const video = videoRefs.current[id]; if (video) setVideoProgress(prev => ({ ...prev, [id]: (video.currentTime / video.duration) * 100 })); };
    
    const handleCommentSubmit = (e: React.FormEvent, reelId: number) => {
        e.preventDefault();
        if (commentText.trim()) {
            onComment(reelId, commentText);
            setCommentText('');
        }
    };

    return (
        <div className="w-full h-[calc(100vh-56px)] flex justify-center bg-[#18191A] overflow-hidden relative font-sans">
            {currentUser && (
                <button onClick={onCreateReelClick} className="fixed bottom-8 right-8 z-50 bg-gradient-to-r from-[#FF0050] to-[#00F2EA] text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"><i className="fas fa-plus"></i> {t('create_reel')}</button>
            )}
            <div ref={containerRef} className="w-full max-w-[450px] h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide scroll-smooth">
                {reels.map((reel, index) => {
                    const author = users.find(u => u.id === reel.user_id);
                    const myReaction = currentUser ? reel.reactions.find(r => r.user_id === currentUser.id)?.type : undefined;
                    const isFollowing = author && currentUser ? currentUser.following.includes(author.id) : false;
                    const isSelf = currentUser && author?.id === currentUser.id;

                    if (!author) return null;
                    return (
                        <div key={`${reel.id}-${index}`} data-reel-id={reel.id} data-index={index} className="reel-container w-full h-full snap-start relative bg-black flex items-center justify-center sm:my-4 sm:rounded-lg overflow-hidden shadow-2xl sm:border border-gray-800" onDoubleClick={() => handleDoubleTap(reel.id)}>
                            <video ref={el => { if (el) videoRefs.current[reel.id] = el; else delete videoRefs.current[reel.id]; }} src={reel.video_url} className="w-full h-full object-cover" loop muted={isMuted} playsInline onTimeUpdate={() => handleTimeUpdate(reel.id)} onClick={(e) => { const v = e.currentTarget; if (v.paused) v.play().catch(() => {}); else v.pause(); }} crossOrigin="anonymous"/>
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-600 z-30"><div className="h-full bg-red-500 transition-all duration-100 ease-linear" style={{ width: `${videoProgress[reel.id] || 0}%` }}></div></div>
                            {showHeartAnimation[reel.id] && <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"><i className="fas fa-heart text-white text-9xl drop-shadow-lg animate-pop-heart"></i></div>}
                            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none"></div>
                            <div className="absolute top-4 right-4 z-40 bg-black/40 backdrop-blur-md p-2 rounded-full cursor-pointer hover:bg-black/60 transition-colors" onClick={toggleMute}><i className={`fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'} text-white text-lg w-5 text-center`}></i></div>
                            <div className="absolute bottom-20 right-4 flex flex-col items-center gap-6 z-20">
                                <div className="flex flex-col items-center gap-1 cursor-pointer group">
                                    <div 
                                        className="w-12 h-12 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm group-hover:bg-black/60 text-white transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!currentUser) return alert("Please login to like reels.");
                                            onReact(reel.id, 'love');
                                        }}
                                    >
                                        <i className={`${myReaction === 'love' ? 'fas text-red-500' : 'far'} fa-heart text-2xl transition-all`}></i>
                                    </div>
                                    <span className="text-white text-sm font-medium">{reel.reactions.length}</span>
                                </div>
                                <div className="flex flex-col items-center gap-1 cursor-pointer group"><div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm group-hover:bg-black/60 text-white" onClick={(e) => { e.stopPropagation(); currentUser ? setActiveCommentReelId(reel.id) : alert("Please login to comment"); }}><i className="fas fa-comment-dots text-2xl"></i></div><span className="text-white text-sm font-medium">{reel.comments.length}</span></div>
                                <div className="flex flex-col items-center gap-1 cursor-pointer group"><div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm group-hover:bg-black/60 text-white" onClick={(e) => { e.stopPropagation(); currentUser ? setActiveShareReelId(reel.id) : alert("Please login to share"); }}><i className="fas fa-share text-2xl"></i></div><span className="text-white text-sm font-medium">{reel.shares}</span></div>
                                <div className="cursor-pointer mt-4 relative" onClick={(e) => { e.stopPropagation(); onProfileClick(author.id); }}>
                                    <img src={author.profile_image_url} className="w-12 h-12 rounded-lg border-2 border-white object-cover" alt={author.name} />
                                    {!isFollowing && !isSelf && currentUser && <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-white" onClick={(e) => { e.stopPropagation(); onFollow(author.id); }}><i className="fas fa-plus text-white text-[10px]"></i></div>}
                                </div>
                            </div>
                            <div className="absolute bottom-0 left-0 w-full p-4 z-20 pb-8 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none">
                                <div className="flex items-center gap-3 mb-3 pointer-events-auto cursor-pointer" onClick={() => onProfileClick(author.id)}>
                                    <img src={author.profile_image_url} className="w-10 h-10 rounded-full border border-white object-cover" alt="" />
                                    <span className="text-white font-bold text-[16px] drop-shadow-md">{author.name}</span>
                                    {author.is_verified && <i className="fas fa-check-circle text-[#1877F2] text-[14px] drop-shadow-md"></i>}
                                    {!isSelf && currentUser && <button onClick={(e) => { e.stopPropagation(); onFollow(author.id); }} className={`border text-xs font-semibold px-3 py-1 rounded-md backdrop-blur-sm transition-colors ${isFollowing ? 'bg-white/20 border-white/20 text-white' : 'bg-transparent border-white/60 text-white hover:bg-white/20'}`}>{isFollowing ? 'Following' : 'Follow'}</button>}
                                </div>
                                <div className="mb-3 pointer-events-auto"><p className="text-white text-[15px] line-clamp-2 drop-shadow-sm">{reel.caption}</p>{reel.effect_name && <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-gray-800/60 rounded-md text-xs text-white/90 backdrop-blur-sm"><i className="fas fa-magic text-yellow-400 text-xs"></i> {reel.effect_name}</div>}</div>
                                <div className="flex items-center gap-2 text-white/90 text-sm bg-white/10 px-3 py-1 rounded-full w-fit backdrop-blur-sm pointer-events-auto"><i className="fas fa-music text-xs"></i><div className="overflow-hidden max-w-[200px]"><div className="whitespace-nowrap">{reel.song_name}</div></div></div>
                            </div>
                            
                            {activeCommentReelId === reel.id && currentUser && (
                                <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setActiveCommentReelId(null)}>
                                    <div className="bg-[#242526] rounded-t-2xl h-[60%] w-full flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                                        <div className="p-3 border-b border-[#3E4042] flex justify-between items-center"><h3 className="font-bold text-center flex-1 text-[#E4E6EB]">Comments ({reel.comments.length})</h3><div onClick={() => setActiveCommentReelId(null)} className="p-2 cursor-pointer hover:bg-[#3A3B3C] rounded-full"><i className="fas fa-times text-[#B0B3B8]"></i></div></div>
                                        <div className="flex-1 overflow-y-auto p-4">
                                            {reel.comments.length === 0 ? (<div className="flex flex-col items-center justify-center h-full text-[#B0B3B8]"><i className="far fa-comments text-4xl mb-2"></i><p>No comments yet. Be the first!</p></div>) : (<div className="flex flex-col gap-4">{reel.comments.map(comment => { const commentAuthor = getCommentAuthor(comment.user_id); if (!commentAuthor) return null; return (<div key={comment.id} className="flex gap-2"><img src={commentAuthor.profile_image_url} alt="" className="w-8 h-8 rounded-full object-cover" /><div className="flex flex-col"><div className="bg-[#3A3B3C] px-3 py-2 rounded-2xl"><span className="font-semibold text-[13px] text-[#E4E6EB]">{commentAuthor.name}</span><p className="text-[14px] text-[#E4E6EB]">{comment.text}</p></div><span className="text-[11px] text-[#B0B3B8] ml-2 mt-0.5">{comment.created_at}</span></div></div>); })}</div>)}
                                        </div>
                                        <div className="p-3 border-t border-[#3E4042] flex gap-2 items-center">
                                            <img src={currentUser.profile_image_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                                            <form onSubmit={(e) => handleCommentSubmit(e, reel.id)} className="flex-1 flex gap-2"><input type="text" className="flex-1 bg-[#3A3B3C] rounded-full px-4 py-2 outline-none text-sm text-[#E4E6EB]" placeholder="Add a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} /><button type="submit" className="text-[#1877F2] font-semibold text-sm px-2 disabled:opacity-50" disabled={!commentText.trim()}>Post</button></form>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeShareReelId === reel.id && currentUser && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in" onClick={() => setActiveShareReelId(null)}>
                                    <div className="bg-[#242526] rounded-xl w-[90%] max-w-[320px] overflow-hidden" onClick={e => e.stopPropagation()}>
                                        <div className="p-4 border-b border-[#3E4042] text-center font-bold text-[#E4E6EB]">Share to</div>
                                        <div className="p-2">
                                            <div className="p-3 hover:bg-[#3A3B3C] rounded-lg cursor-pointer flex items-center gap-3" onClick={() => { onShare(reel.id, 'feed'); setActiveShareReelId(null); }}><div className="w-10 h-10 bg-[#2D88FF] rounded-full flex items-center justify-center"><i className="fas fa-rss text-white"></i></div><span className="text-[#E4E6EB] font-medium">Share to Feed</span></div>
                                            <div className="p-3 hover:bg-[#3A3B3C] rounded-lg cursor-pointer flex items-center gap-3" onClick={() => { onShare(reel.id, 'copy'); setActiveShareReelId(null); }}><div className="w-10 h-10 bg-[#3A3B3C] border border-[#3E4042] rounded-full flex items-center justify-center"><i className="fas fa-link text-[#E4E6EB]"></i></div><span className="text-[#E4E6EB] font-medium">Copy Link</span></div>
                                        </div>
                                        <div className="p-3 border-t border-[#3E4042] text-center text-[#E4E6EB] cursor-pointer hover:bg-[#3A3B3C]" onClick={() => setActiveShareReelId(null)}>Cancel</div>
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
