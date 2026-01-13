
import React, { useState, useRef, useEffect } from 'react';
import { User, Post as PostType, ReactionType, Comment, Product, LinkPreview, Group, Brand, AudioTrack } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { LOCATIONS_DATA, REACTION_ICONS, REACTION_COLORS, GIF_CATEGORIES, MARKETPLACE_COUNTRIES, MARKETPLACE_CATEGORIES } from '../constants';
import { StickerPicker, EmojiPicker } from './Pickers';

/**
 * Standard API Fetch Helper
 */
const apiFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('unera_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) throw new Error("API Error");
    return res.json();
};

const RichText = ({ text, users, onProfileClick, onHashtagClick }: { text: string, users?: User[], onProfileClick: (id: number) => void, onHashtagClick?: (tag: string) => void }) => {
    if (!text) return null;
    const parts = text.split(/(#[a-zA-Z0-9_]+|@\w+(?:\s\w+)?)/g);
    return (
        <span className="leading-relaxed text-[#E4E6EB] whitespace-pre-wrap break-words">
            {parts.map((part, index) => {
                if (part.startsWith('@')) {
                    const name = part.substring(1);
                    const user = users?.find(u => u.username.toLowerCase() === name.toLowerCase() || u.name?.toLowerCase() === name.toLowerCase());
                    if (user) {
                        return (
                            <span key={index} className="text-[#1877F2] font-semibold cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onProfileClick(user.id); }}>
                                {part}
                            </span>
                        );
                    }
                    return <span key={index} className="text-[#1877F2] font-semibold">{part}</span>;
                }
                if (part.startsWith('#')) {
                    return (
                        <span key={index} className="text-[#1877F2] cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onHashtagClick && onHashtagClick(part); }}>
                            {part}
                        </span>
                    );
                }
                return <span key={index}>{part}</span>;
            })}
        </span>
    );
};

export const ReactionButton: React.FC<{ currentUserReactions: ReactionType | undefined; reactionCount: number; onReact: (type: ReactionType) => void; isGuest?: boolean; }> = ({ currentUserReactions, reactionCount, onReact, isGuest }) => {
    const [showDock, setShowDock] = useState(false);
    const timerRef = useRef<any>(null);
    const handleMouseEnter = () => { if(isGuest) return; timerRef.current = setTimeout(() => setShowDock(true), 500); };
    const handleMouseLeave = () => { if (timerRef.current) clearTimeout(timerRef.current); setTimeout(() => setShowDock(false), 300); };
    const handleClick = () => { if (isGuest) return alert("Please login to react."); onReact('like'); };
    const reactionConfig = [{ type: 'like', icon: '👍', color: '#1877F2' }, { type: 'love', icon: '❤️', color: '#F3425F' }, { type: 'haha', icon: '😆', color: '#F7B928' }, { type: 'wow', icon: '😮', color: '#F7B928' }, { type: 'sad', icon: '😢', color: '#F7B928' }, { type: 'angry', icon: '😡', color: '#E41E3F' }] as const;
    const activeReaction = currentUserReactions ? reactionConfig.find(r => r.type === currentUserReactions) : null;
    return (
        <div className="flex-1 relative group" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            {showDock && (
                <div className="absolute -top-12 left-0 bg-[#242526] rounded-full shadow-xl p-1.5 flex gap-2 animate-fade-in border border-[#3E4042] z-50">
                    {reactionConfig.map(r => (
                        <div key={r.type} className="text-2xl hover:scale-125 transition-transform cursor-pointer hover:-translate-y-2 duration-200" onClick={(e) => { e.stopPropagation(); onReact(r.type); setShowDock(false); }}>{r.icon}</div>
                    ))}
                </div>
            )}
            <button onClick={handleClick} className="w-full flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors active:scale-95">{activeReaction ? (<><span className="text-[20px]">{activeReaction.icon}</span><span className="text-[17px] font-medium" style={{ color: activeReaction.color }}>{activeReaction.type}</span></>) : (<><i className="far fa-thumbs-up text-[20px] text-[#B0B3B8]"></i><span className="text-[17px] font-medium text-[#B0B3B8]">Like</span></>)}</button>
        </div>
    );
};

export const Post: React.FC<{ post: PostType; author: User | Brand; currentUser: User | null; users?: User[]; onProfileClick: (id: number) => void; onReact: (id: number, type: ReactionType) => void; onShare: (id: number) => void; onDelete?: (id: number) => void; onViewImage: (url: string) => void; onOpenComments: (id: number) => void; onVideoClick: (p: PostType) => void; onPlayAudioTrack?: (t: AudioTrack) => void; }> = ({ post, author, currentUser, users, onProfileClick, onReact, onShare, onDelete, onViewImage, onOpenComments, onVideoClick, onPlayAudioTrack }) => {
    const myReaction = currentUser ? post.reactions?.find(r => r.user_id === currentUser.id)?.type : undefined;
    return (
        <div className="bg-[#242526] rounded-xl shadow-sm mb-4 animate-fade-in border border-[#3E4042] overflow-hidden">
            <div className="p-3 md:p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => onProfileClick(author.id)}>
                    <img src={author.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover cursor-pointer border border-[#3E4042]" />
                    <div className="min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                            <h4 className="font-bold text-[#E4E6EB] text-[18.5px] cursor-pointer hover:underline truncate">{author.name}</h4>
                            {'is_verified' in author && author.is_verified && <i className="fas fa-check-circle text-[#1877F2] text-[13px]"></i>}
                        </div>
                        <div className="flex items-center gap-1.5 text-[#B0B3B8] text-[13px]">
                            <span>{new Date(post.created_at).toLocaleDateString() || 'Recently'}</span>
                            <span>•</span>
                            <i className="fas fa-globe-americas text-[12px]"></i>
                        </div>
                    </div>
                </div>
            </div>
            {post.content && <div className="px-3 md:px-4 pb-2 text-[#E4E6EB] text-[17px]"><RichText text={post.content} users={users} onProfileClick={onProfileClick} /></div>}
            {post.media_url && post.type === 'image' && <div className="cursor-pointer bg-black" onClick={() => onViewImage(post.media_url!)}><img src={post.media_url} alt="" className="w-full h-auto max-h-[600px] object-contain" /></div>}
            {post.media_url && post.type === 'video' && <div className="cursor-pointer relative h-[500px]" onClick={() => onVideoClick(post)}><video src={post.media_url} className="w-full h-full object-cover" /><div className="absolute inset-0 flex items-center justify-center"><i className="fas fa-play text-white text-4xl opacity-50"></i></div></div>}
            <div className="px-3 md:px-4 py-2.5 flex items-center justify-between text-[#B0B3B8] text-[14px] border-t border-[#3E4042]">
                <div className="flex items-center gap-1.5">{post.reactions.length > 0 && <span className="hover:underline">{post.reactions.length} Reactions</span>}</div>
                <div className="flex gap-4"><span className="hover:underline cursor-pointer" onClick={() => onOpenComments(post.id)}>{post.comments.length} Comments</span></div>
            </div>
            <div className="px-2 py-1 border-t border-[#3E4042] flex items-center justify-between">
                <ReactionButton currentUserReactions={myReaction} reactionCount={post.reactions.length} onReact={(type) => onReact(post.id, type)} isGuest={!currentUser} />
                <button className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]" onClick={() => onOpenComments(post.id)}><i className="far fa-comment-alt text-[20px]"></i><span className="text-[17px] font-medium">Comment</span></button>
                <button className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]" onClick={() => onShare(post.id)}><i className="fas fa-share text-[20px]"></i><span className="text-[17px] font-medium">Share</span></button>
            </div>
        </div>
    );
};

export const CreatePost: React.FC<{ currentUser: User; onProfileClick: (id: number) => void; onClick: () => void; }> = ({ currentUser, onProfileClick, onClick }) => (
    <div className="bg-[#242526] rounded-xl p-3 md:p-4 mb-4 shadow-sm border border-[#3E4042]">
        <div className="flex gap-2 mb-3">
            <img src={currentUser.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover cursor-pointer border border-[#3E4042]" onClick={() => onProfileClick(currentUser.id)} />
            <div className="flex-1 bg-[#3A3B3C] rounded-full px-4 py-2 hover:bg-[#4E4F50] cursor-pointer flex items-center" onClick={onClick}><span className="text-[#B0B3B8] text-[17px]">What's on your mind, {currentUser.name?.split(' ')[0]}?</span></div>
        </div>
    </div>
);

export const CreatePostModal: React.FC<{ currentUser: User; users: User[]; onClose: () => void; onCreatePost: (t: string, f: File | null) => void; }> = ({ currentUser, users, onClose, onCreatePost }) => {
    const [text, setText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    return (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#242526] w-full max-w-[500px] rounded-xl border border-[#3E4042] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-[#3E4042] flex justify-between items-center"><h3 className="text-xl font-bold text-white">Create Post</h3><i className="fas fa-times text-[#B0B3B8] cursor-pointer" onClick={onClose}></i></div>
                <div className="p-4 flex-1 overflow-y-auto"><textarea className="w-full bg-transparent outline-none text-white text-lg placeholder-[#B0B3B8] resize-none h-40" placeholder={`What's on your mind, ${currentUser.name}?`} value={text} onChange={e => setText(e.target.value)} /><input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="text-[#B0B3B8] text-sm mt-4" /></div>
                <div className="p-4 border-t border-[#3E4042]"><button onClick={() => onCreatePost(text, file)} disabled={!text.trim() && !file} className="w-full bg-[#1877F2] text-white font-bold py-2 rounded-lg disabled:opacity-50">Post</button></div>
            </div>
        </div>
    );
};

export const CommentsSheet: React.FC<{ post: PostType; currentUser: User; users: User[]; onClose: () => void; onComment: (id: number, text: string) => void; onLikeComment: (id: number) => void; getCommentAuthor: (id: number) => User | undefined; onProfileClick: (id: number) => void; }> = ({ post, currentUser, users, onClose, getCommentAuthor, onProfileClick }) => {
    const [text, setText] = useState('');
    const [comments, setComments] = useState<any[]>([]);

    useEffect(() => {
        apiFetch(`/api/posts/${post.id}/comments`).then(setComments);
    }, [post.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;
        try {
            const data = await apiFetch(`/api/posts/${post.id}/comment`, {
                method: 'POST',
                body: JSON.stringify({ text })
            });
            setComments([...comments, { ...data.comment, author_name: currentUser.name, author_image: currentUser.profile_image_url }]);
            setText('');
        } catch (e) { alert("Failed to comment"); }
    };

    return (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end md:items-center md:justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
            <div className="bg-[#242526] w-full md:w-[600px] md:h-[80vh] z-20 animate-slide-up flex flex-col h-[70vh] shadow-2xl overflow-hidden border border-[#3E4042]">
                <div className="p-3 border-b border-[#3E4042] flex justify-between bg-[#242526]"><h3 className="font-bold text-[#E4E6EB]">Comments</h3><i className="fas fa-times text-[#B0B3B8] cursor-pointer" onClick={onClose}></i></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {comments.map(c => (
                        <div key={c.id} className="flex gap-2">
                            <img src={c.author_image || 'https://ui-avatars.com/api/?name=User'} className="w-8 h-8 rounded-full object-cover" alt="" />
                            <div className="bg-[#3A3B3C] px-4 py-2 rounded-2xl flex-1">
                                <p className="font-bold text-white text-sm">{c.author_name || 'Anonymous'}</p>
                                <p className="text-white text-[15px]">{c.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <form className="p-3 border-t border-[#3E4042] flex gap-2" onSubmit={handleSubmit}>
                    <input type="text" className="bg-[#3A3B3C] text-white flex-1 rounded-full px-4 py-2 outline-none" placeholder="Write a comment..." value={text} onChange={e => setText(e.target.value)} />
                    <button type="submit" className="text-[#1877F2] font-bold">Post</button>
                </form>
            </div>
        </div>
    );
};

// @google/genai-api-fix: Defined SuggestedProductsWidget which was being exported without a definition.
export const SuggestedProductsWidget: React.FC<{ 
    products: Product[]; 
    currentUser: User; 
    onViewProduct: (product: Product) => void; 
    onSeeAll: () => void; 
}> = ({ products, currentUser, onViewProduct, onSeeAll }) => {
    const suggested = products.filter(p => p.seller_id !== currentUser.id).slice(0, 4);

    if (suggested.length === 0) return null;

    return (
        <div className="bg-[#242526] rounded-xl p-4 mb-4 border border-[#3E4042] shadow-sm">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-[#E4E6EB] font-bold text-lg">Marketplace for you</h3>
                <button onClick={onSeeAll} className="text-[#1877F2] font-semibold text-[15px] hover:bg-[#3A3B3C] px-2 py-1 rounded transition-colors">See all</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {suggested.map(product => {
                    const countryData = MARKETPLACE_COUNTRIES.find(c => product.address.toLowerCase().includes(c.name.toLowerCase()));
                    const symbol = countryData ? countryData.symbol : '$';
                    return (
                        <div key={product.id} className="cursor-pointer group" onClick={() => onViewProduct(product)}>
                            <div className="aspect-square rounded-lg overflow-hidden relative mb-1.5 shadow-sm border border-[#3E4042]">
                                <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-black text-white">
                                    {symbol}{product.main_price}
                                </div>
                            </div>
                            <h4 className="text-[#E4E6EB] text-sm font-semibold truncate px-0.5 leading-tight">{product.title}</h4>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
