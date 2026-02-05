// Story.tsx - FULLY UPDATED WITH FOLLOW FUNCTIONALITY & FIXED BLINKING ISSUE
import React, { useState, useEffect, useRef } from 'react';
import { Story as StoryType, User, Song } from '../types';

// ✅ 1) Add time formatter helper
const formatStoryTime = (created_at?: string) => {
  if (!created_at) return "Just now";
  const t = new Date(created_at).getTime();
  if (!Number.isFinite(t)) return "Just now";

  const diff = Date.now() - t;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}hrs`;
  return `${Math.floor(diff / 86_400_000)}days`;
};

// ✅ A1) Add helpers for stable name handling
const isPlaceholderName = (v: any) => {
  const s = String(v ?? "").trim().toLowerCase();
  return !s || s === "user" || s === "unknown" || s === "un";
};

const pickBestName = (...vals: any[]) => {
  for (const v of vals) {
    if (!isPlaceholderName(v)) return String(v);
  }
  return "User";
};

// ✅ A) Add new helper functions
const safeText = (v: any) => String(v ?? "").trim();

const pickBestImage = (...vals: any[]) => {
  for (const v of vals) {
    const s = safeText(v);
    if (s && s !== "null" && s !== "undefined") return s;
  }
  return "";
};

const getDefaultProfilePicture = (name: string, userId: number): string => {
  const colors = ['1877F2', '45BD62', 'F3425F', 'F7B928', '9360F7'];
  const color = colors[Math.abs(userId) % colors.length];
  const initials = safeText(name).slice(0, 1).toUpperCase() || "U";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color}&color=fff&size=128&font-size=0.5&bold=true&rounded=true`;
};

// ✅ CRITICAL: SAFE USER MERGE HELPER TO PREVENT BLINKING
const mergeUserSafe = (prev: User | undefined, patch: Partial<User> | undefined): User => {
  if (!prev && !patch) {
    return {
      id: 0,
      username: 'user',
      name: 'User',
      email: '',
      profile_image_url: getDefaultProfilePicture('User', 0),
      cover_image_url: '',
      followers: [],
      following: [],
      is_verified: false,
      role: 'user',
      is_online: false,
      location: '',
      bio: '',
      created_at: null,
    };
  }
  
  if (!prev && patch) {
    return {
      id: patch.id || 0,
      username: patch.username || 'user',
      name: patch.name || 'User',
      email: patch.email || '',
      profile_image_url: patch.profile_image_url || getDefaultProfilePicture(patch.name || 'User', patch.id || 0),
      cover_image_url: patch.cover_image_url || '',
      followers: Array.isArray(patch.followers) ? patch.followers : [],
      following: Array.isArray(patch.following) ? patch.following : [],
      is_verified: patch.is_verified || false,
      role: patch.role || 'user',
      is_online: patch.is_online || false,
      location: patch.location || '',
      bio: patch.bio || '',
      created_at: patch.created_at || null,
    };
  }
  
  if (prev && !patch) return prev;
  
  // Both exist, merge safely
  return {
    ...prev!,
    ...patch,
    id: patch?.id ?? prev!.id,
    username: patch?.username ?? prev!.username,
    name: patch?.name ?? prev!.name,
    // ✅ PRESERVE ARRAYS - This is the key fix for blinking followers
    followers: Array.isArray(patch?.followers) ? patch.followers : prev!.followers,
    following: Array.isArray(patch?.following) ? patch.following : prev!.following,
    // ✅ Preserve profile image if new one is empty/placeholder
    profile_image_url: patch?.profile_image_url && 
                      safeText(patch.profile_image_url) && 
                      !patch.profile_image_url.includes('ui-avatars.com/api/?name=User') &&
                      !patch.profile_image_url.includes('ui-avatars.com/api/?name=UN')
                      ? patch.profile_image_url 
                      : prev!.profile_image_url,
  } as User;
};

// ✅ 5) Update StoryViewer props with follow functionality
interface StoryViewerProps {
    story: StoryType;
    user: User;
    currentUser: User | null;
    onClose: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    onReply?: (storyId: number, text: string) => void;
    onLike?: (storyId: number) => void;
    onFollow?: (userId: number) => void; // ✅ ADDED: Follow callback
    isFollowing?: boolean; // ✅ ADDED: Follow status
    allStories?: StoryType[];
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

    // ✅ A2) Add refs for stable story list and navigation
    const frozenUserStoriesRef = useRef<StoryType[]>([]);
    const didAdvanceRef = useRef(false);

    // ✅ A5) Freeze author identity for the whole viewing session (prevents flicker)
    const frozenAuthorRef = useRef<{ name: string; image: string; id: number }>({
      name: "User",
      image: "",
      id: Number(story.user_id) || 0,
    });

    useEffect(() => {
      const bestName = pickBestName(
        (story as any)?.user?.name,
        (story as any)?.author_name,
        (story as any)?.author_username,
        (user as any)?.name,
      );

      const bestImage = pickBestImage(
        (story as any)?.user?.profile_image_url,
        (story as any)?.author_image,
        (user as any)?.profile_image_url,
      );

      const id = Number((story as any)?.user?.id ?? story.user_id ?? (user as any)?.id ?? 0);

      frozenAuthorRef.current = {
        id,
        name: bestName,
        image: bestImage || getDefaultProfilePicture(bestName, id),
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [story.id]);

    // ✅ A2) Freeze the user's stories when viewer opens
    useEffect(() => {
        // Freeze the user's stories when viewer opens or story changes
        const list = allStories
            .filter((s) => Number(s.user_id) === Number(story.user_id))
            // Facebook-like: oldest -> newest within a user's deck
            .slice()
            .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

        frozenUserStoriesRef.current = list;
        didAdvanceRef.current = false;
        setProgress(0);
        // IMPORTANT: do NOT depend on allStories (it changes while viewing)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [story.id, story.user_id]);

    const userStories = frozenUserStoriesRef.current;
    const currentIndex = userStories.findIndex((s) => Number(s.id) === Number(story.id));
    
    // ✅ 3) Use liked_by_me with proper ID comparison
    const currentStoryState = allStories.find(s => Number(s.id) === Number(story.id)) || story;
    const hasLiked = Boolean(currentUser && (currentStoryState as any)?.liked_by_me);

    // ✅ A3) Replace progress timer with stable navigation
    useEffect(() => {
        let duration = 5000;
        setProgress(0);
        didAdvanceRef.current = false;

        const timer = setInterval(() => {
            if (isPaused) return;

            setProgress((prev) => {
                if (prev >= 100) return 100;

                const increment = 100 / (duration / 50);
                const next = Math.min(100, prev + increment);

                if (next >= 100 && !didAdvanceRef.current) {
                    didAdvanceRef.current = true;
                    clearInterval(timer);
                    onNext?.();
                }

                return next;
            });
        }, 50);

        return () => clearInterval(timer);
    }, [story.id, isPaused, onNext]);

    useEffect(() => {
        if (story.music_url && !story.music_url.startsWith('blob:')) {
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

    // ✅ 6) Update handleSendReply to pass story.id
    const handleSendReply = () => {
        if (replyText.trim() && onReply) {
            onReply(story.id, replyText.trim());
            setReplyText('');
            setIsPaused(false);
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1877F2] text-white px-6 py-2 rounded-full font-bold shadow-lg animate-fade-in z-[300]';
            toast.innerText = 'Reply sent!';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }
    };

    // ✅ 6) Update handleLike to pass story.id
    const handleLike = () => {
        if (onLike) {
            onLike(story.id);
            if (!hasLiked) {
                setShowHeartAnim(true);
                setTimeout(() => setShowHeartAnim(false), 800);
            }
        }
    };

    const frozenAuthor = frozenAuthorRef.current;

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
                        <img src={frozenAuthor.image} alt={frozenAuthor.name} className="w-12 h-12 rounded-full border-2 border-[#1877F2] object-cover shadow-lg" />
                        <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                                <span className="text-white font-bold text-[17px] drop-shadow-md">{frozenAuthor.name}</span>
                                {/* ✅ ADDED: Follow button with proper logic */}
                                {currentUser && 
                                 frozenAuthor.id > 0 && 
                                 frozenAuthor.id !== currentUser.id && 
                                 onFollow && (
                                    <button
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            onFollow(frozenAuthor.id); 
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                                            isFollowing 
                                                ? 'bg-[#3A3B3C] text-white' 
                                                : 'bg-[#1877F2] text-white'
                                        } hover:opacity-90 transition-all active:scale-95 border-none`}
                                    >
                                        {isFollowing ? 'Following' : 'Follow'}
                                    </button>
                                )}
                            </div>
                            {/* ✅ 4) Show correct time using created_at */}
                            <span className="text-white/70 text-[12px] drop-shadow-md">
                                {formatStoryTime((story as any).created_at)}
                            </span>
                        </div>
                    </div>
                </div>

                {story.music_title && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 flex items-center gap-2 animate-bounce">
                        <i className="fas fa-music text-xs text-white"></i>
                        <span className="text-white text-xs font-bold whitespace-nowrap">{story.music_title}</span>
                    </div>
                )}

                {/* ✅ A4) Fix tap zones with safe click handlers */}
                <div
                    className="absolute inset-y-0 left-0 w-1/4 z-10"
                    onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                />
                <div
                    className="absolute inset-y-0 right-0 w-1/4 z-10"
                    onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                />
                
                <div className="flex-1 flex items-center justify-center bg-[#111] relative" onDoubleClick={handleLike}>
                    {story.type === 'text' ? (
                        <div className="w-full h-full flex items-center justify-center p-10 text-center" style={{ background: story.background_style }}>
                            <span className="text-white font-bold text-4xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] whitespace-pre-wrap">{story.text_content}</span>
                        </div>
                    ) : story.media_url && !story.media_url.startsWith('blob:') ? (
                        <img src={story.media_url} alt="Story" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500">
                            <span className="text-white font-bold text-2xl">Story Content</span>
                        </div>
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

// ✅ UPDATED: StoryReelProps with follow functionality
interface StoryReelProps {
    stories: StoryType[];
    onProfileClick: (id: number) => void;
    onCreateStory?: () => void;
    onViewStory: (story: StoryType) => void;
    currentUser: User | null;
    onRequestLogin: () => void;
    // ✅ ADDED: Follow system props
    onFollow?: (userId: number) => void;
    checkIsFollowing?: (userId: number) => boolean;
    followLoading?: { [key: number]: boolean };
}

export const StoryReel: React.FC<StoryReelProps> = ({ 
    stories, 
    onProfileClick, 
    onCreateStory, 
    onViewStory, 
    currentUser, 
    onRequestLogin,
    // ✅ ADDED: Follow props
    onFollow,
    checkIsFollowing,
    followLoading
}) => {
    // ✅ C) Sort by real date, not string compare
    const toTime = (d: any) => {
        const t = new Date(String(d ?? "")).getTime();
        return Number.isFinite(t) ? t : 0;
    };

    const sortedStories = [...stories].sort((a, b) => toTime(b.created_at) - toTime(a.created_at));
    
    const uniqueUserStories: StoryType[] = Array.from(
        new Map<number, StoryType>(sortedStories.map(s => [s.user_id, s])).values()
    );

    return (
        <div className="w-full flex gap-2.5 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            <div className="min-w-[110px] sm:min-w-[140px] h-[210px] sm:h-[250px] bg-[#242526] rounded-2xl shadow-md overflow-hidden cursor-pointer relative group flex-shrink-0 border border-[#3E4042]" onClick={() => currentUser ? (onCreateStory && onCreateStory()) : onRequestLogin()}>
                <img src={currentUser?.profile_image_url || getDefaultProfilePicture(currentUser?.name || 'User', currentUser?.id || 0)} alt="Create" className="h-[75%] w-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80" />
                <div className="absolute bottom-0 w-full h-[25%] bg-[#242526] flex flex-col items-center justify-end pb-3">
                    <div className="absolute -top-5 w-10 h-10 bg-[#1877F2] rounded-full flex items-center justify-center border-4 border-[#242526] text-white shadow-lg">
                        <i className="fas fa-plus text-lg"></i>
                    </div>
                    <span className="text-xs font-bold text-[#E4E6EB] mt-4">Create Story</span>
                </div>
            </div>

            {uniqueUserStories.map((story) => {
                // ✅ A5) Fix name flicker with pickBestName helper
                const bestName = pickBestName(
                    story.user?.name,
                    (story as any).author_name,
                    (story as any).author_username,
                    (story as any).username
                );

                const bestUsername = pickBestName(
                    story.user?.username,
                    (story as any).author_username,
                    (story as any).username,
                    bestName.toLowerCase().replace(/\s+/g, "_")
                );

                // ✅ B) Fix authorImage fallback to include story.user.profile_image_url
                const authorImage = pickBestImage(
                    story.user?.profile_image_url,
                    (story as any).author_image
                ) || getDefaultProfilePicture(bestName, story.user_id);
                
                // ✅ USE mergeUserSafe to create stable user object
                const storyUser = story.user || {
                    id: story.user_id,
                    name: bestName,
                    username: bestUsername,
                    profile_image_url: authorImage,
                };
                
                const author = mergeUserSafe(storyUser, story.user || {});
                
                // ✅ Get follow status if currentUser is logged in
                const isMe = !!currentUser && Number(currentUser.id) === Number(author.id);
                const isFollowing = author.id && checkIsFollowing ? checkIsFollowing(Number(author.id)) : false;
                const isLoading = author.id && followLoading ? followLoading[Number(author.id)] : false;
                
                return (
                    <div key={story.id} className="min-w-[110px] sm:min-w-[140px] h-[210px] sm:h-[250px] relative rounded-2xl overflow-hidden cursor-pointer flex-shrink-0 group shadow-lg border border-white/10" onClick={() => onViewStory(story)}>
                        {story.type === 'text' ? (
                            <div className="absolute w-full h-full flex items-center justify-center p-3 text-center" style={{ background: story.background_style }}>
                                <span className="text-white font-bold text-[10px] line-clamp-4 leading-tight">{story.text_content}</span>
                            </div>
                        ) : story.media_url && !story.media_url.startsWith('blob:') ? (
                            <img src={story.media_url} alt="Story" className="absolute w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        ) : (
                            <div className="absolute w-full h-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">Story</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                        <div className="absolute top-3 left-3 w-9 h-9 rounded-full border-4 border-[#1877F2] overflow-hidden z-10 shadow-md" onClick={(e) => { e.stopPropagation(); onProfileClick(story.user_id); }}>
                            <img src={author.profile_image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                        {/* ✅ ADDED: Follow button in story reel */}
                        {currentUser && !isMe && author.id > 0 && onFollow && (
                            <div 
                                className="absolute top-3 right-3 z-20" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    onFollow(Number(author.id));
                                }}
                            >
                                <button
                                    disabled={isLoading}
                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs border ${
                                        isFollowing 
                                            ? 'bg-[#3A3B3C] border-[#4E4F50]' 
                                            : 'bg-[#1877F2] border-[#1877F2]'
                                    } ${isLoading ? 'opacity-60' : 'hover:opacity-90'}`}
                                >
                                    {isLoading ? (
                                        <i className="fas fa-spinner fa-spin"></i>
                                    ) : isFollowing ? (
                                        <i className="fas fa-check"></i>
                                    ) : (
                                        <i className="fas fa-plus"></i>
                                    )}
                                </button>
                            </div>
                        )}
                        <p className="absolute bottom-3 left-3 text-white font-bold text-xs drop-shadow-md truncate w-[85%]">{author.name}</p>
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

// ✅ Update CreateStoryModal props to accept files
interface CreateStoryModalProps {
    currentUser: User;
    songs: Song[];
    onClose: () => void;
    onCreate: (story: Partial<StoryType> & { media_file?: File; audio_file?: File }) => void;
}

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({ currentUser, songs, onClose, onCreate }) => {
    const [mode, setMode] = useState<'text' | 'image'>('image');
    const [text, setText] = useState('');
    const [background, setBackground] = useState(STORY_COLORS[0]);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [selectedMusic, setSelectedMusic] = useState<{url: string, title: string, artist: string, cover?: string} | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [showMusicPicker, setShowMusicPicker] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    const handleCreate = () => {
        onCreate({
            user_id: currentUser.id,
            type: mode,
            text_content: mode === 'text' ? text : undefined,
            background_style: mode === 'text' ? background : undefined,
            media_file: mode === 'image' ? imageFile : undefined,
            media_url: imageFile ? undefined : (mode === 'image' && imagePreview ? imagePreview : undefined),
            music_url: selectedMusic?.url,
            music_title: selectedMusic ? `${selectedMusic.title} - ${selectedMusic.artist}` : undefined,
            audio_file: audioFile || undefined,
            created_at: new Date().toISOString(),
            user: currentUser
        });
        onClose();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAudioFile(file);
            setSelectedMusic({
                url: URL.createObjectURL(file),
                title: file.name.split('.')[0],
                artist: 'Local Upload'
            });
            setShowMusicPicker(false);
        }
    };

    // Cleanup blob URLs when component unmounts
    useEffect(() => {
        return () => {
            if (imagePreview && imagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(imagePreview);
            }
            if (selectedMusic?.url && selectedMusic.url.startsWith('blob:')) {
                URL.revokeObjectURL(selectedMusic.url);
            }
        };
    }, [imagePreview, selectedMusic?.url]);

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
                                <button onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if (imagePreview.startsWith('blob:')) {
                                        URL.revokeObjectURL(imagePreview);
                                    }
                                    setImagePreview(null);
                                    setImageFile(null);
                                }} className="absolute top-4 left-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white"><i className="fas fa-trash-alt"></i></button>
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
                        <i className="fas fa-times-circle text-white/50 cursor-pointer hover:text-white" onClick={() => {
                            if (selectedMusic.url.startsWith('blob:')) {
                                URL.revokeObjectURL(selectedMusic.url);
                            }
                            setSelectedMusic(null);
                            setAudioFile(null);
                        }}></i>
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
                                        setAudioFile(null);
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

// ✅ UPDATED: StoryViewerModal component with follow functionality
export const StoryViewerModal: React.FC<{
    story: StoryType;
    onClose: () => void;
    onProfileClick: (id: number) => void;
    // ✅ ADDED: Follow system props
    currentUser?: User | null;
    onFollow?: (userId: number) => void;
    checkIsFollowing?: (userId: number) => boolean;
    followLoading?: { [key: number]: boolean };
}> = ({ 
    story, 
    onClose, 
    onProfileClick,
    // ✅ ADDED: Follow props
    currentUser,
    onFollow,
    checkIsFollowing,
    followLoading
}) => {
    // Create a user object from story data using mergeUserSafe
    const user: User = mergeUserSafe(story.user, {
        id: story.user_id,
        name: pickBestName(
            (story as any)?.user?.name,
            (story as any)?.author_name,
            (story as any)?.author_username,
            "User"
        ),
        username: pickBestName(
            (story as any)?.user?.username,
            (story as any)?.author_username,
            "user"
        ),
        email: "",
        profile_image_url: pickBestImage(
            (story as any)?.user?.profile_image_url,
            (story as any)?.author_image
        ) || getDefaultProfilePicture("User", story.user_id),
        cover_image_url: "",
        followers: Array.isArray(story.user?.followers) ? story.user.followers : [],
        following: Array.isArray(story.user?.following) ? story.user.following : [],
        is_verified: false,
        role: 'user',
        is_online: false,
        location: '',
        bio: '',
        created_at: null,
    });

    // Get all stories from the same user for navigation
    const [allStories, setAllStories] = useState<StoryType[]>([]);
    
    useEffect(() => {
        // This would normally fetch stories from API
        // For now, we'll just use the current story
        setAllStories([story]);
    }, [story]);

    const handleNext = () => {
        // Simple navigation - in a real app, you'd navigate through user's stories
        onClose();
    };

    const handlePrev = () => {
        // Simple navigation - in a real app, you'd navigate through user's stories
        onClose();
    };

    const handleReply = (storyId: number, text: string) => {
        console.log(`Reply to story ${storyId}: ${text}`);
        // In a real app, you would call an API to save the reply
    };

    const handleLike = (storyId: number) => {
        console.log(`Like story ${storyId}`);
        // In a real app, you would call an API to like the story
    };

    // ✅ Get follow status if currentUser is logged in
    const isFollowing = user.id && checkIsFollowing ? checkIsFollowing(Number(user.id)) : false;
    
    return (
        <StoryViewer
            story={story}
            user={user}
            currentUser={currentUser || null}
            onClose={onClose}
            onNext={handleNext}
            onPrev={handlePrev}
            onReply={handleReply}
            onLike={handleLike}
            onFollow={onFollow}
            isFollowing={isFollowing}
            allStories={allStories}
        />
    );
};
