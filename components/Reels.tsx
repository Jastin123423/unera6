
import React, { useState, useRef, useEffect } from 'react';
import { User, Reel, ReactionType, Song } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { ReactionButton } from './Feed';
import { MOCK_SONGS } from '../constants';

// --- CREATE REEL COMPONENT ---
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
            if (videoRef.current) videoRef.current.volume = 0.5;
            audioRef.current.play().catch(e => console.error("Audio play failed", e));
        } else {
            audioRef.current.pause();
            audioRef.current.src = '';
            if (videoRef.current) videoRef.current.volume = 1.0;
        }
        return () => audioRef.current.pause();
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
    
    return (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center font-sans animate-fade-in">
            <video ref={videoRef} src={videoURL} className="w-full h-full object-contain" loop autoPlay muted={!!selectedSong} />
            <button onClick={onClose} className="absolute top-6 left-4 text-white text-2xl z-20"><i className="fas fa-arrow-left"></i></button>
            <div className="absolute bottom-6 w-full px-4 z-20 flex justify-end">
                <button onClick={handlePost} className="bg-[#FE2C55] text-white font-bold px-12 py-3 rounded-md">Post Reel</button>
            </div>
        </div>
    );
};

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

export const ReelsFeed: React.FC<ReelsFeedProps> = ({ reels = [], users = [], currentUser, onProfileClick, onCreateReelClick, onLoadMore, onReact, onComment, onShare, onFollow, getCommentAuthor, initialReelId }) => {
    const [activeReelId, setActiveReelId] = useState<number | null>(initialReelId || null);
    const [isMuted, setIsMuted] = useState(false);
    const [activeCommentReelId, setActiveCommentReelId] = useState<number | null>(null);
    const [commentText, setCommentText] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
    const { t } = useLanguage();

    useEffect(() => {
        if (reels.length > 0 && !activeReelId) setActiveReelId(reels[0].id);
    }, [reels, activeReelId]);

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
                <button onClick={onCreateReelClick} className="fixed bottom-8 right-8 z-50 bg-[#FE2C55] text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"><i className="fas fa-plus"></i> {t('create_reel')}</button>
            )}
            <div ref={containerRef} className="w-full max-w-[450px] h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide scroll-smooth">
                {reels.map((reel, index) => {
                    const author = users.find(u => u.id === reel.user_id) || { id: 0, name: 'Unknown', profile_image_url: '' };
                    // Safe access to reactions and comments arrays
                    const reactions = Array.isArray(reel.reactions) ? reel.reactions : [];
                    const comments = Array.isArray(reel.comments) ? reel.comments : [];
                    const myReaction = currentUser ? reactions.find(r => r.user_id === currentUser.id)?.type : undefined;

                    return (
                        <div key={`${reel.id}-${index}`} className="w-full h-full snap-start relative bg-black flex items-center justify-center sm:my-4 sm:rounded-lg overflow-hidden shadow-2xl">
                            <video 
                                ref={el => { if (el) videoRefs.current[reel.id] = el; }} 
                                src={reel.video_url} 
                                className="w-full h-full object-cover" 
                                loop 
                                autoPlay={activeReelId === reel.id}
                                muted={isMuted} 
                                playsInline 
                                onClick={(e) => { e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause(); }}
                            />
                            
                            <div className="absolute bottom-20 right-4 flex flex-col items-center gap-6 z-20">
                                <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => onReact(reel.id, 'love')}>
                                    <i className={`${myReaction === 'love' ? 'fas text-red-500' : 'far'} fa-heart text-2xl text-white`}></i>
                                    <span className="text-white text-xs">{reactions.length}</span>
                                </div>
                                <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setActiveCommentReelId(reel.id)}>
                                    <i className="fas fa-comment-dots text-2xl text-white"></i>
                                    <span className="text-white text-xs">{comments.length}</span>
                                </div>
                            </div>

                            <div className="absolute bottom-0 left-0 w-full p-4 z-20 pb-8 bg-gradient-to-t from-black/80 to-transparent">
                                <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => onProfileClick(author.id)}>
                                    <img src={author.profile_image_url} className="w-10 h-10 rounded-full border border-white object-cover" alt="" />
                                    <span className="text-white font-bold">{author.name}</span>
                                </div>
                                <p className="text-white text-sm line-clamp-2">{reel.caption}</p>
                            </div>

                            {activeCommentReelId === reel.id && (
                                <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setActiveCommentReelId(null)}>
                                    <div className="bg-[#242526] rounded-t-2xl h-[60%] w-full flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                                        <div className="p-3 border-b border-[#3E4042] flex justify-between items-center"><h3 className="font-bold text-[#E4E6EB]">Comments</h3><i className="fas fa-times text-[#B0B3B8] cursor-pointer" onClick={() => setActiveCommentReelId(null)}></i></div>
                                        <div className="flex-1 overflow-y-auto p-4">
                                            {comments.length === 0 ? <p className="text-[#B0B3B8] text-center mt-10">No comments yet.</p> : comments.map((c, i) => <div key={i} className="text-white mb-2">{c.text}</div>)}
                                        </div>
                                        <div className="p-3 border-t border-[#3E4042] flex gap-2">
                                            <input type="text" className="flex-1 bg-[#3A3B3C] rounded-full px-4 py-2 text-white outline-none" value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add comment..." />
                                            <button onClick={(e) => handleCommentSubmit(e, reel.id)} className="text-[#1877F2] font-bold">Post</button>
                                        </div>
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
