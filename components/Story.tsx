
import React, { useState, useEffect, useRef } from 'react';
import { Story, User, Song } from '../types';
import { INITIAL_USERS } from '../constants';

interface StoryViewerProps {
    story: Story;
    user: User;
    currentUser: User | null;
    onClose: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    onReply?: (text: string) => void;
    onLike?: () => void;
    onFollow?: (id: number) => void;
    isFollowing?: boolean;
    allStories?: Story[];
}

export const StoryViewer: React.FC<StoryViewerProps> = ({ 
    story, user, currentUser, onClose, onNext, onPrev, onReply, onLike, onFollow, isFollowing, allStories = [] 
}) => {
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [showHeartAnim, setShowHeartAnim] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const userStories = allStories.filter(s => s.user_id === story.user_id);
    const currentIndex = userStories.findIndex(s => s.id === story.id);
    
    const currentStoryState = allStories.find(s => s.id === story.id) || story;
    const hasLiked = currentUser && currentStoryState.reactions?.some(r => r.user_id === currentUser.id);

    useEffect(() => {
        let duration = 5000; 
        setProgress(0);

        const timer = setInterval(() => {
            if (!isPaused) {
                setProgress((prev) => {
                    if (prev >= 100) {
                        clearInterval(timer);
                        if (onNext) onNext();
                        return 100;
                    }
                    const increment = 100 / (duration / 50); 
                    return Math.min(100, prev + increment);
                });
            }
        }, 50); 

        return () => clearInterval(timer);
    }, [story.id, onNext, isPaused]);

    useEffect(() => {
        if (story.music_url) {
            audioRef.current = new Audio(story.music_url);
            audioRef.current.volume = 0.5;
            audioRef.current.play().catch(() => {});
        }
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, [story.id]);

    const handleSendReply = () => {
        if (replyText.trim() && onReply) {
            onReply(replyText);
            setReplyText('');
            setIsPaused(false);
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1877F2] text-white px-6 py-2 rounded-full font-bold shadow-lg animate-fade-in z-[300]';
            toast.innerText = 'Reply sent!';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }
    };

    const handleLike = () => {
        if (onLike) {
            onLike();
            if (!hasLiked) {
                setShowHeartAnim(true);
                setTimeout(() => setShowHeartAnim(false), 800);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[250] bg-black flex items-center justify-center animate-fade-in">
            <div className="absolute inset-0 opacity-30 bg-cover bg-center blur-3xl" style={{ backgroundImage: story.media_url ? `url(${story.media_url})` : undefined, background: !story.media_url ? story.background_style : undefined }}></div>
            
            <div className="absolute top-4 right-4 z-[300] cursor-pointer w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors" onClick={(e) => { e.stopPropagation(); onClose(); }}>
                <i className="fas fa-times text-[#E4E6EB] text-2xl"></i>
            </div>

            <div className="relative w-full max-w-[420px] h-full sm:h-[92vh] bg-black sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                <div className="absolute top-0 left-0 right-0 p-3 z-30 flex gap-1.5">
                    {userStories.map((_, i) => (
                        <div key={i} className="h-1 bg-white/20 flex-1 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-white transition-all duration-75 ease-linear" 
                                style={{ width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%' }} 
                            />
                        </div>
                    ))}
                </div>

                <div className="absolute top-4 left-0 right-0 p-4 z-30 flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3">
                        <img src={user.profile_image_url} alt={user.name} className="w-12 h-12 rounded-full border-2 border-[#1877F2] object-cover shadow-lg" />
                        <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                                <span className="text-white font-bold text-[17px] drop-shadow-md">{user.name}</span>
                                {!isFollowing && currentUser?.id !== user.id && onFollow && (
                                    <button onClick={(e) => { e.stopPropagation(); onFollow(user.id); }} className="bg-[#1877F2] text-white text-[14px] font-black px-6 py-2 rounded-full hover:bg-[#166FE5] shadow-lg transition-all active:scale-95 border-none">Follow</button>
                                )}
                            </div>
                            <span className="text-white/70 text-[12px] drop-shadow-md">Just now</span>
                        </div>
                    </div>
                </div>

                {story.music_title && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 flex items-center gap-2 animate-bounce">
                        <i className="fas fa-music text-xs text-white"></i>
                        <span className="text-white text-xs font-bold whitespace-nowrap">{story.music_title}</span>
                    </div>
                )}

                <div className="absolute inset-y-0 left-0 w-1/4 z-10" onClick={onPrev}></div>
                <div className="absolute inset-y-0 right-0 w-1/4 z-10" onClick={onNext}></div>
                
                <div className="flex-1 flex items-center justify-center bg-[#111] relative" onDoubleClick={handleLike}>
                    {story.type === 'text' ? (
                        <div className="w-full h-full flex items-center justify-center p-10 text-center" style={{ background: story.background_style }}>
                            <span className="text-white font-bold text-4xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] whitespace-pre-wrap">{story.text_content}</span>
                        </div>
                    ) : (
                        <img src={story.media_url} alt="Story" className="w-full h-full object-cover" />
                    )}
                    {showHeartAnim && (
                        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                            <i className="fas fa-heart text-white text-9xl drop-shadow-lg animate-pop-heart"></i>
                        </div>
                    )}
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 p-4 z-20 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent pt-12">
                    <div className="flex-1 flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-5 py-3.5 focus-within:bg-white/20 transition-all shadow-xl">
                        <input ref={inputRef} type="text" placeholder="Send a message..." className="bg-transparent text-white placeholder-white/60 outline-none w-full text-[16px]" value={replyText} onChange={(e) => setReplyText(e.target.value)} onFocus={() => setIsPaused(true)} onBlur={() => { if(!replyText) setIsPaused(false); }} onKeyDown={(e) => e.key === 'Enter' && handleSendReply()} />
                        {replyText.trim() && (
                            <button onClick={handleSendReply} className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center shadow-lg transition-transform active:scale-90"><i className="fas fa-location-arrow text-white text-sm -rotate-45 ml-[-2px] mt-[-1px]"></i></button>
                        )}
                    </div>
                    <div onClick={handleLike} className="w-12 h-12 flex items-center justify-center cursor-pointer active:scale-125 transition-transform">
                        <i className={`fas fa-heart ${hasLiked ? 'text-[#F3425F]' : 'text-white/80'} text-3xl drop-shadow-lg`}></i>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const StoryReel: React.FC<{ stories: Story[], onProfileClick: (id: number) => void, onCreateStory?: () => void, onViewStory: (story: Story) => void, currentUser: User | null, onRequestLogin: () => void }> = ({ stories, onProfileClick, onCreateStory, onViewStory, currentUser, onRequestLogin }) => {
    const uniqueUserStories: Story[] = Array.from(new Map<number, Story>(stories.map(s => [s.user_id, s])).values());

    return (
        <div className="w-full flex gap-2.5 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            <div className="min-w-[110px] sm:min-w-[140px] h-[210px] sm:h-[250px] bg-[#242526] rounded-2xl shadow-md overflow-hidden cursor-pointer relative group flex-shrink-0 border border-[#3E4042]" onClick={() => currentUser ? (onCreateStory && onCreateStory()) : onRequestLogin()}>
                <img src={currentUser?.profile_image_url || INITIAL_USERS[0].profile_image_url} alt="Create" className="h-[75%] w-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80" />
                <div className="absolute bottom-0 w-full h-[25%] bg-[#242526] flex flex-col items-center justify-end pb-3">
                    <div className="absolute -top-5 w-10 h-10 bg-[#1877F2] rounded-full flex items-center justify-center border-4 border-[#242526] text-white shadow-lg">
                        <i className="fas fa-plus text-lg"></i>
                    </div>
                    <span className="text-xs font-bold text-[#E4E6EB] mt-4">Create Story</span>
                </div>
            </div>

            {uniqueUserStories.map((story) => {
                const author = story.user || INITIAL_USERS.find(u => u.id === story.user_id);
                return (
                    <div key={story.id} className="min-w-[110px] sm:min-w-[140px] h-[210px] sm:h-[250px] relative rounded-2xl overflow-hidden cursor-pointer flex-shrink-0 group shadow-lg border border-white/10" onClick={() => onViewStory(story)}>
                        {story.type === 'text' ? (
                            <div className="absolute w-full h-full flex items-center justify-center p-3 text-center" style={{ background: story.background_style }}>
                                <span className="text-white font-bold text-[10px] line-clamp-4 leading-tight">{story.text_content}</span>
                            </div>
                        ) : (
                            <img src={story.media_url} alt="Story" className="absolute w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        )}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                        <div className="absolute top-3 left-3 w-9 h-9 rounded-full border-4 border-[#1877F2] overflow-hidden z-10 shadow-md" onClick={(e) => { e.stopPropagation(); onProfileClick(story.user_id); }}>
                            <img src={author?.profile_image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <p className="absolute bottom-3 left-3 text-white font-bold text-xs drop-shadow-md truncate w-[85%]">{author?.name}</p>
                    </div>
                );
            })}
        </div>
    );
};

const STORY_COLORS = [
    'linear-gradient(45deg, #1877F2, #0055FF)',
    'linear-gradient(45deg, #F3425F, #E41E3F)',
    'linear-gradient(45deg, #45BD62, #31A24C)',
    'linear-gradient(45deg, #F7B928, #E3A300)',
    'linear-gradient(45deg, #A033FF, #7B1FA2)',
    'linear-gradient(45deg, #FF7E5F, #FEB47B)',
    'linear-gradient(45deg, #00C6FF, #0072FF)',
    'linear-gradient(45deg, #2193b0, #6dd5ed)',
    'linear-gradient(45deg, #ee9ca7, #ffdde1)',
    'linear-gradient(45deg, #42275a, #734b6d)',
    'linear-gradient(45deg, #BDC3C7, #2C3E50)',
    'linear-gradient(45deg, #000000, #434343)',
];

export const CreateStoryModal: React.FC<{ currentUser: User, songs: Song[], onClose: () => void, onCreate: (story: Partial<Story>) => void }> = ({ currentUser, songs, onClose, onCreate }) => {
    const [mode, setMode] = useState<'text' | 'image'>('image');
    const [text, setText] = useState('');
    const [background, setBackground] = useState(STORY_COLORS[0]);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [selectedMusic, setSelectedMusic] = useState<{url: string, title: string, artist: string, cover?: string} | null>(null);
    const [showMusicPicker, setShowMusicPicker] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    const handleCreate = () => {
        onCreate({
            user_id: currentUser.id,
            type: mode,
            text_content: mode === 'text' ? text : undefined,
            background_style: mode === 'text' ? background : undefined,
            media_url: mode === 'image' && imagePreview ? imagePreview : undefined,
            music_url: selectedMusic?.url,
            music_title: selectedMusic ? `${selectedMusic.title} - ${selectedMusic.artist}` : undefined,
            created_at: new Date().toISOString(),
            user: currentUser
        });
        onClose();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setImagePreview(URL.createObjectURL(e.target.files[0]));
        }
    };

    const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setSelectedMusic({
                url: URL.createObjectURL(file),
                title: file.name.split('.')[0],
                artist: 'Local Upload'
            });
            setShowMusicPicker(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col font-sans animate-fade-in text-white overflow-hidden">
            <div className="flex justify-between items-center p-4 bg-black/60 backdrop-blur-lg absolute top-0 w-full z-40 border-b border-white/5">
                <button onClick={onClose} className="text-white font-bold text-sm bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition-all">Discard</button>
                <h3 className="font-black text-[18px]">Create Story</h3>
                <button onClick={handleCreate} disabled={(mode === 'text' && !text.trim()) || (mode === 'image' && !imagePreview)} className="bg-[#1877F2] text-white px-6 py-2 rounded-full font-black text-sm disabled:opacity-50 disabled:bg-gray-600 transition-all">Share</button>
            </div>

            <div className="flex-1 flex items-center justify-center relative overflow-hidden mt-16 mb-24" style={{ background: mode === 'text' ? background : '#000' }}>
                {mode === 'text' ? (
                    <textarea 
                        autoFocus
                        placeholder="Start typing..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="bg-transparent text-white text-4xl font-bold text-center w-full max-w-lg outline-none resize-none placeholder-white/40 px-10 h-[40vh] flex items-center justify-center"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#000]" onClick={() => !imagePreview && fileInputRef.current?.click()}>
                        {imagePreview ? (
                            <div className="relative w-full h-full">
                                <img src={imagePreview} className="w-full h-full object-contain" alt="" />
                                <button onClick={(e) => { e.stopPropagation(); setImagePreview(null); }} className="absolute top-4 left-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white"><i className="fas fa-trash-alt"></i></button>
                            </div>
                        ) : (
                            <div className="text-center cursor-pointer group">
                                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white/20 transition-all">
                                    <i className="fas fa-image text-3xl text-white"></i>
                                </div>
                                <p className="font-black text-xl text-white">Select a Photo</p>
                                <p className="text-white/60 text-sm mt-2">Add a professional look to your story</p>
                            </div>
                        )}
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                    </div>
                )}

                {selectedMusic && (
                    <div className="absolute top-20 z-30 bg-white/10 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/20 flex items-center gap-3 shadow-2xl animate-pulse">
                        <div className="w-10 h-10 bg-[#1877F2] rounded-lg flex items-center justify-center">
                            <i className="fas fa-music text-white"></i>
                        </div>
                        <div>
                            <p className="text-xs font-black text-white leading-tight">{selectedMusic.title}</p>
                            <p className="text-[10px] text-white/70">{selectedMusic.artist}</p>
                        </div>
                        <i className="fas fa-times-circle text-white/50 cursor-pointer hover:text-white" onClick={() => setSelectedMusic(null)}></i>
                    </div>
                )}
            </div>

            <div className="absolute bottom-0 w-full bg-black/80 backdrop-blur-2xl border-t border-white/10 z-40 p-4 pb-8 flex flex-col gap-4">
                {mode === 'text' && (
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide px-2 py-1">
                        {STORY_COLORS.map((col, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => setBackground(col)}
                                className={`w-10 h-10 rounded-full flex-shrink-0 cursor-pointer border-2 transition-transform hover:scale-110 ${background === col ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-transparent'}`}
                                style={{ background: col }}
                            />
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between px-2">
                    <div className="flex gap-2 bg-white/5 p-1 rounded-2xl border border-white/10">
                        <button onClick={() => setMode('text')} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${mode === 'text' ? 'bg-[#1877F2] text-white shadow-lg' : 'text-white/60'}`}>
                            <i className="fas fa-font"></i> Text
                        </button>
                        <button onClick={() => setMode('image')} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${mode === 'image' ? 'bg-[#1877F2] text-white shadow-lg' : 'text-white/60'}`}>
                            <i className="fas fa-camera"></i> Photo
                        </button>
                    </div>

                    <button 
                        onClick={() => setShowMusicPicker(true)} 
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${selectedMusic ? 'bg-[#45BD62] text-white shadow-[0_0_15px_rgba(69,189,98,0.4)]' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                    >
                        <i className="fas fa-music text-lg"></i>
                    </button>
                </div>
            </div>

            {showMusicPicker && (
                <div className="fixed inset-0 z-[250] bg-[#18191A] animate-slide-up flex flex-col font-sans">
                    <div className="p-4 border-b border-[#3E4042] flex justify-between items-center bg-[#242526]">
                        <button onClick={() => setShowMusicPicker(false)} className="text-[#B0B3B8] font-bold"><i className="fas fa-chevron-down mr-2"></i>Close</button>
                        <h3 className="font-bold text-white">Add Music</h3>
                        <div className="w-10"></div>
                    </div>
                    <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
                        <div 
                            onClick={() => audioInputRef.current?.click()}
                            className="p-4 bg-[#263951] rounded-xl flex items-center gap-4 cursor-pointer hover:bg-[#2A3F5A] transition-all border border-[#2D88FF]/20"
                        >
                            <div className="w-12 h-12 bg-[#1877F2] rounded-full flex items-center justify-center shadow-lg"><i className="fas fa-cloud-upload-alt text-white"></i></div>
                            <div>
                                <p className="text-white font-bold">Upload Music</p>
                                <p className="text-[#B0B3B8] text-xs">Choose a file from your device</p>
                            </div>
                        </div>
                        <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />
                        <div className="h-px bg-[#3E4042] my-2"></div>
                        <p className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest px-1">UNERA Music Trends</p>
                        <div className="flex flex-col gap-2">
                            {songs.map(song => (
                                <div 
                                    key={song.id} 
                                    onClick={() => {
                                        setSelectedMusic({ url: song.audio_url, title: song.title, artist: song.artist_name, cover: song.cover_image_url });
                                        setShowMusicPicker(false);
                                    }}
                                    className="p-3 bg-[#242526] hover:bg-[#3A3B3C] rounded-xl flex items-center gap-4 cursor-pointer transition-all border border-transparent hover:border-[#1877F2]/30"
                                >
                                    <img src={song.cover_image_url} className="w-14 h-14 rounded-lg object-cover shadow-md" alt="" />
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-white font-bold truncate">{song.title}</p>
                                        <p className="text-[#B0B3B8] text-sm truncate">{song.artist_name}</p>
                                    </div>
                                    <i className="fas fa-play-circle text-2xl text-[#1877F2]"></i>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
