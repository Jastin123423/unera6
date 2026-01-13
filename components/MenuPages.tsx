
import React, { useState, useEffect, useMemo } from 'react';
import { User, Event, Group, Product, Post as PostType, AudioTrack } from '../types';
import { MARKETPLACE_COUNTRIES } from '../constants';
import { Post } from './Feed';

// --- SUGGESTED PROFILES PAGE ---
interface SuggestedProfilesPageProps {
    currentUser: User;
    users: User[];
    groups?: Group[];
    products?: Product[];
    events?: Event[];
    onFollow: (id: number) => void;
    onProfileClick: (id: number) => void;
    onJoinGroup?: (groupId: string) => void;
    onJoinEvent?: (eventId: number) => void;
    onViewProduct?: (product: Product) => void;
}

export const SuggestedProfilesPage: React.FC<SuggestedProfilesPageProps> = ({ 
    currentUser, users, groups = [], products = [], events = [], 
    onFollow, onProfileClick, onJoinGroup, onJoinEvent, onViewProduct 
}) => {
    const [hiddenUserIds, setHiddenUserIds] = useState<number[]>([]);

    const availableUsers = users.filter(u => {
        if (u.id === currentUser.id) return false; 
        if (currentUser.following.includes(u.id)) return false; 
        if (u.id === 0) return false; 
        if (hiddenUserIds.includes(u.id)) return false;
        return true;
    }).map(u => {
        let score = 0;
        let reason = "Suggested for you";
        if(u.location === currentUser.location) score += 5;
        return { user: u, score, reason };
    }).sort((a, b) => b.score - a.score);

    const handleFollow = (id: number) => {
        onFollow(id);
        setHiddenUserIds(prev => [...prev, id]);
    };

    return (
        <div className="w-full max-w-[700px] mx-auto p-4 font-sans pb-20">
            <h2 className="text-2xl font-bold text-[#E4E6EB] mb-4">Discover People</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 animate-fade-in">
                {availableUsers.slice(0, 10).map(({ user, reason }) => (
                    <div key={user.id} className="bg-[#242526] rounded-xl border border-[#3E4042] overflow-hidden flex flex-col shadow-sm">
                        <div className="h-24 bg-gradient-to-r from-blue-900 to-slate-900 relative">
                             {user.cover_image_url && <img src={user.cover_image_url} className="w-full h-full object-cover opacity-60" alt="" />}
                             <div className="absolute -bottom-8 left-4">
                                 <img src={user.profile_image_url} className="w-16 h-16 rounded-full border-4 border-[#242526] object-cover bg-[#242526]" alt="" />
                             </div>
                        </div>
                        <div className="pt-10 px-4 pb-4 flex-1 flex flex-col">
                            <div onClick={() => onProfileClick(user.id)} className="cursor-pointer">
                                <h3 className="text-[#E4E6EB] font-bold text-lg hover:underline flex items-center gap-1">{user.name}</h3>
                            </div>
                            <p className="text-[#B0B3B8] text-sm mb-4 line-clamp-2">{reason}</p>
                            <div className="mt-auto">
                                <button onClick={() => handleFollow(user.id)} className="w-full bg-[#1877F2] text-white py-2 rounded-lg font-semibold hover:bg-[#166FE5] transition-colors">Follow</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- BIRTHDAYS PAGE COMPONENT ---
interface BirthdaysPageProps { 
    currentUser: User; 
    users: User[]; 
    onMessage: (id: number) => void;
    onProfileClick: (id: number) => void;
}

export const BirthdaysPage: React.FC<BirthdaysPageProps> = ({ currentUser, users, onMessage, onProfileClick }) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    const isBirthdayToday = (dateStr?: string) => {
        if (!dateStr) return false;
        const bDate = new Date(dateStr);
        return bDate.getMonth() === currentMonth && bDate.getDate() === currentDay;
    };

    const isUpcomingBirthday = (dateStr?: string) => {
        if (!dateStr) return false;
        const bDate = new Date(dateStr);
        const thisYearBday = new Date(today.getFullYear(), bDate.getMonth(), bDate.getDate());
        if (thisYearBday < today && !(bDate.getMonth() === currentMonth && bDate.getDate() === currentDay)) {
            thisYearBday.setFullYear(today.getFullYear() + 1);
        }
        const diffTime = thisYearBday.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 && diffDays <= 30;
    };

    const birthdayPeople = users.filter(u => u.id !== currentUser.id && isBirthdayToday(u.birth_date));
    const upcomingPeople = users.filter(u => u.id !== currentUser.id && isUpcomingBirthday(u.birth_date))
        .sort((a, b) => {
            const aDate = new Date(a.birth_date!);
            const bDate = new Date(b.birth_date!);
            return aDate.getMonth() - bDate.getMonth() || aDate.getDate() - bDate.getDate();
        });

    return (
        <div className="w-full max-w-[800px] mx-auto p-4 md:p-6 font-sans pb-20 animate-fade-in">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-gradient-to-tr from-[#FF0080] to-[#7928CA] rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3">
                    <i className="fas fa-birthday-cake text-white text-2xl"></i>
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white leading-tight">Birthdays</h1>
                    <p className="text-[#B0B3B8]">Celebrate special moments with your community.</p>
                </div>
            </div>

            <div className="mb-10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                    Today's Stars <span className="text-xs bg-[#F3425F] px-2 py-0.5 rounded-full animate-pulse uppercase tracking-wider">Live</span>
                </h2>
                {birthdayPeople.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {birthdayPeople.map(person => (
                            <div key={person.id} className="relative group overflow-hidden rounded-3xl bg-gradient-to-br from-[#242526] to-[#18191A] border border-[#3E4042] hover:border-[#1877F2]/50 transition-all duration-300 shadow-xl p-6 flex flex-col items-center text-center">
                                <div className="absolute top-0 right-0 p-4 z-10">
                                    <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-xl animate-bounce">🎁</div>
                                </div>
                                <div className="relative mb-4">
                                    <div className="absolute -inset-1 bg-gradient-to-tr from-[#1877F2] via-[#F3425F] to-[#FAB400] rounded-full animate-[spin_3s_linear_infinite] opacity-75 blur-sm"></div>
                                    <img src={person.profile_image_url} className="w-24 h-24 rounded-full object-cover border-4 border-[#242526] relative z-10 cursor-pointer" onClick={() => onProfileClick(person.id)} alt="" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">{person.name}</h3>
                                <p className="text-[#B0B3B8] text-sm mb-6 flex items-center gap-1"><i className="fas fa-map-marker-alt text-[10px]"></i> {person.location || 'World Citizen'}</p>
                                <div className="flex gap-2 w-full mt-auto">
                                    <button onClick={() => onMessage(person.id)} className="flex-1 bg-[#1877F2] hover:bg-[#166FE5] text-white py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg">Wish Him/Her</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-[#242526] rounded-3xl p-10 text-center border border-[#3E4042] shadow-inner">
                        <i className="fas fa-calendar-day text-[#B0B3B8] text-4xl mb-4 opacity-50"></i>
                        <h3 className="text-white font-bold text-lg">No Birthdays Today</h3>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- EVENT CARD (Moved to top level to prevent hook errors) ---
const EventCard: React.FC<{ event: Event, currentUser: User, onJoinEvent: (id: number) => void, size?: 'large' | 'normal' }> = ({ event, currentUser, onJoinEvent, size = 'normal' }) => {
    // @google/genai-api-fix: Correct property `date` to `event_date`.
    const evDate = new Date(event.event_date);
    const day = evDate.getDate();
    const month = evDate.toLocaleString('default', { month: 'short' }).toUpperCase();
    const isInterested = event.interested_ids?.includes(currentUser.id);
    const isAttending = event.attendees.includes(currentUser.id);

    return (
        <div className={`bg-[#242526] rounded-2xl overflow-hidden border border-[#3E4042] hover:border-[#1877F2]/50 transition-all group flex flex-col ${size === 'large' ? 'md:flex-row h-auto md:h-[280px]' : 'h-full shadow-sm'}`}>
            <div className={`relative overflow-hidden bg-[#18191A] ${size === 'large' ? 'w-full md:w-[45%]' : 'aspect-video w-full'}`}>
                <img src={event.cover_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={event.title} />
                <div className="absolute top-4 left-4 bg-white rounded-xl flex flex-col items-center justify-center w-14 h-14 shadow-lg">
                    <span className="text-red-500 font-black text-xs leading-none mt-1">{month}</span>
                    <span className="text-[#1C1E21] font-black text-xl leading-none mb-1">{day}</span>
                </div>
            </div>
            <div className={`p-5 flex flex-col flex-1 ${size === 'large' ? 'md:w-[55%]' : ''}`}>
                <div className="flex-1">
                    <h3 className={`font-black text-[#E4E6EB] mb-2 line-clamp-2 ${size === 'large' ? 'text-2xl' : 'text-lg'}`}>{event.title}</h3>
                    <div className="flex items-center gap-2 text-[#B0B3B8] text-sm mb-1 font-semibold">
                        <i className="fas fa-clock text-[#1877F2] text-xs"></i>
                        <span>{new Date(event.event_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#B0B3B8] text-sm mb-4">
                        <i className="fas fa-location-dot text-red-500 text-xs"></i>
                        <span className="truncate">{event.location}</span>
                    </div>
                    {size === 'large' && (
                        <p className="text-[#B0B3B8] text-sm line-clamp-3 mb-6 leading-relaxed">
                            {event.description}
                        </p>
                    )}
                </div>
                
                <div className="flex items-center justify-between mt-auto">
                    <div className="flex -space-x-2 overflow-hidden">
                        {event.attendees.slice(0, 3).map(id => (
                            <div key={id} className="w-7 h-7 rounded-full border-2 border-[#242526] bg-[#3A3B3C] overflow-hidden">
                                <img src={`https://ui-avatars.com/api/?name=User&background=random`} alt="" />
                            </div>
                        ))}
                        {event.attendees.length > 3 && (
                            <div className="w-7 h-7 rounded-full border-2 border-[#242526] bg-[#3A3B3C] flex items-center justify-center text-[10px] font-bold text-white">
                                +{event.attendees.length - 3}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => onJoinEvent(event.id)}
                            className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-all ${
                                isInterested || isAttending 
                                ? 'bg-[#2D88FF] text-white shadow-lg' 
                                : 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                            }`}
                        >
                            {isAttending ? 'Attending' : 'Interested'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- EVENTS PAGE ---
interface EventsPageProps { 
    events: Event[]; 
    currentUser: User; 
    onJoinEvent: (eventId: number) => void; 
    onCreateEventClick: () => void;
    onProfileClick: (id: number) => void;
}

export const EventsPage: React.FC<EventsPageProps> = ({ events, currentUser, onJoinEvent, onCreateEventClick, onProfileClick }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const categorizedEvents = useMemo(() => {
        const todayEvs: Event[] = [];
        const upcomingEvs: Event[] = [];

        events.forEach(ev => {
            // @google/genai-api-fix: Correct property `date` to `event_date`.
            const evDate = new Date(ev.event_date);
            evDate.setHours(0, 0, 0, 0);
            if (evDate.getTime() === today.getTime()) {
                todayEvs.push(ev);
            } else if (evDate.getTime() > today.getTime()) {
                upcomingEvs.push(ev);
            }
        });

        return {
            // @google/genai-api-fix: Correct property `date` to `event_date`.
            today: todayEvs.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()),
            upcoming: upcomingEvs.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
        };
    }, [events]);

    return (
        <div className="w-full max-w-[1000px] mx-auto p-4 md:p-6 font-sans pb-24 animate-fade-in">
            {/* Professional Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10 bg-gradient-to-br from-[#242526] to-[#1C1E21] p-8 rounded-[2rem] border border-[#3E4042] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#1877F2]/5 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                <div className="relative z-10 text-center md:text-left">
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight">Events</h1>
                    <p className="text-[#B0B3B8] text-lg max-w-md">Connect, celebrate, and discover amazing moments happening right now.</p>
                </div>
                <button 
                    onClick={onCreateEventClick}
                    className="relative z-10 bg-[#1877F2] hover:bg-[#166FE5] text-white px-8 py-4 rounded-2xl font-black text-lg transition-all shadow-[0_10px_25px_rgba(24,119,242,0.3)] hover:scale-[1.03] active:scale-95 flex items-center gap-3"
                >
                    <i className="fas fa-plus-circle text-xl"></i>
                    Host New Event
                </button>
            </div>

            {/* SECTION: TODAY */}
            {categorizedEvents.today.length > 0 && (
                <div className="mb-14">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-[#45BD62] animate-pulse"></span>
                            Happening Today
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        {categorizedEvents.today.map(ev => (
                            <EventCard key={ev.id} event={ev} currentUser={currentUser} onJoinEvent={onJoinEvent} size="large" />
                        ))}
                    </div>
                </div>
            )}

            {/* SECTION: UPCOMING */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <i className="fas fa-calendar-alt text-[#1877F2]"></i>
                        Upcoming Events
                    </h2>
                    <div className="flex gap-2">
                        <button className="bg-[#242526] text-[#E4E6EB] px-4 py-2 rounded-xl text-sm font-bold border border-[#3E4042]">All Categories</button>
                    </div>
                </div>
                
                {categorizedEvents.upcoming.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {categorizedEvents.upcoming.map(ev => (
                            <EventCard key={ev.id} event={ev} currentUser={currentUser} onJoinEvent={onJoinEvent} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-[#242526] rounded-[2rem] p-16 text-center border border-[#3E4042] shadow-inner">
                        <div className="w-20 h-20 bg-[#3A3B3C] rounded-full flex items-center justify-center mx-auto mb-6">
                            <i className="fas fa-calendar-day text-[#B0B3B8] text-3xl opacity-30"></i>
                        </div>
                        <h3 className="text-white font-black text-2xl mb-2">No upcoming events yet</h3>
                        <p className="text-[#B0B3B8] text-lg max-w-sm mx-auto">Be the first to host an event and bring your community together!</p>
                        <button onClick={onCreateEventClick} className="mt-8 text-[#1877F2] font-black hover:underline">Start Hosting Now &rarr;</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- MEMORIES PAGE ---
interface MemoriesPageProps {
    currentUser: User;
    posts: PostType[];
    users: User[];
    onProfileClick: (id: number) => void;
    onReact: (postId: number, type: any) => void;
    onShare: (postId: number) => void;
    onViewImage: (url: string) => void;
    onOpenComments: (postId: number) => void;
    onVideoClick: (post: PostType) => void;
    onPlayAudioTrack?: (track: AudioTrack) => void;
    onHashtagClick?: (tag: string) => void;
}

export const MemoriesPage: React.FC<MemoriesPageProps> = ({ 
    currentUser, posts, users, onProfileClick, onReact, onShare, onViewImage, onOpenComments, onVideoClick, onPlayAudioTrack, onHashtagClick
}) => {
    // @google/genai-api-fix: Correct property `timestamp` to `created_at`.
    const memories = posts.filter(p => p.user_id === currentUser.id && p.created_at !== 'Just now');

    return (
        <div className="w-full max-w-[800px] mx-auto pb-24 font-sans animate-fade-in px-4">
            <div className="relative h-64 md:h-80 w-full overflow-hidden mb-12 rounded-b-[40px] shadow-2xl border-x border-b border-[#3E4042]">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1877F2] via-[#6366F1] to-[#D946EF] animate-pulse"></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black/30 backdrop-blur-sm">
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-[2rem] flex items-center justify-center mb-5 border border-white/30 shadow-2xl transform rotate-6 hover:rotate-0 transition-transform duration-500">
                        <i className="fas fa-history text-white text-4xl"></i>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-2xl tracking-tight mb-2">
                        {currentUser.firstName || currentUser.name}, do you remember these posts?
                    </h1>
                    <p className="text-white/90 text-lg md:text-xl font-medium max-w-lg">
                        Take a journey back through your best moments on UNERA.
                    </p>
                </div>
            </div>
            
            <div className="space-y-16">
                {memories.length > 0 ? memories.map((post, index) => (
                    <div key={post.id} className="relative">
                        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#1877F2] to-transparent hidden lg:block opacity-30"></div>
                        <div className="absolute -left-[22px] top-6 w-4 h-4 rounded-full bg-[#1877F2] border-4 border-[#18191A] hidden lg:block z-10 shadow-[0_0_10px_#1877F2]"></div>

                        <div className="bg-[#242526] rounded-[32px] border border-[#3E4042] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_60px_rgba(24,119,242,0.15)] transition-all duration-500 group">
                            <div className="bg-[#2A2B2D] p-6 flex items-center justify-between border-b border-[#3E4042]">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-tr from-[#1877F2] to-[#6366F1] rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                        <i className="fas fa-clock-rotate-left text-white text-xl"></i>
                                    </div>
                                    <div>
                                        <span className="text-[#1877F2] font-black text-xs uppercase tracking-widest block mb-0.5">UNERA Memory</span>
                                        {/* @google/genai-api-fix: Correct property `timestamp` to `created_at`. */}
                                        <h3 className="text-white font-bold text-xl">On this day, {post.created_at} ago...</h3>
                                    </div>
                                </div>
                                <div className="bg-[#3A3B3C] px-4 py-1.5 rounded-full border border-[#4E4F50]">
                                    <span className="text-[#E4E6EB] font-bold text-xs uppercase tracking-tighter">Vault Item #{memories.length - index}</span>
                                </div>
                            </div>

                            <div className="p-2 pt-6">
                                <div className="px-6 mb-6">
                                    <h4 className="text-[#B0B3B8] font-bold text-sm uppercase tracking-widest mb-2 opacity-60">Your Moment:</h4>
                                    <div className="text-white text-2xl font-medium leading-relaxed italic border-l-4 border-[#1877F2] pl-4 py-2 bg-white/5 rounded-r-xl">
                                        "{post.content || 'A visual memory shared'}"
                                    </div>
                                </div>
                                
                                <Post 
                                    post={post}
                                    author={currentUser}
                                    currentUser={currentUser}
                                    users={users}
                                    onProfileClick={onProfileClick}
                                    onReact={onReact}
                                    onShare={onShare}
                                    onViewImage={onViewImage}
                                    onOpenComments={onOpenComments}
                                    onVideoClick={() => onVideoClick(post)}
                                    onPlayAudioTrack={onPlayAudioTrack}
                                    onHashtagClick={onHashtagClick}
                                />
                            </div>

                            <div className="p-8 bg-gradient-to-br from-[#1C1D1E] to-[#242526] border-t border-[#3E4042]">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                                    <div className="flex-1 text-center md:text-left">
                                        <p className="text-2xl font-black text-[#E4E6EB] mb-2 drop-shadow-sm">
                                            How was this moment?
                                        </p>
                                        <p className="text-[#B0B3B8] text-lg font-medium leading-relaxed">
                                            It's been a while since you shared this. Why not relive it by sharing with your current friends?
                                        </p>
                                    </div>
                                    <div className="flex gap-4 w-full md:w-auto">
                                        <button 
                                            onClick={() => onShare(post.id)}
                                            className="flex-1 md:flex-none bg-[#1877F2] hover:bg-[#166FE5] text-white px-10 py-4 rounded-[20px] font-black text-lg transition-all shadow-[0_10px_20px_rgba(24,119,242,0.3)] active:scale-95 flex items-center justify-center gap-3"
                                        >
                                            <i className="fas fa-share-nodes"></i> Share Again
                                        </button>
                                        <button className="w-16 h-16 bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] rounded-[20px] flex items-center justify-center transition-all shadow-xl active:scale-95">
                                            <i className="fas fa-ellipsis-h text-xl"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="bg-[#242526] rounded-[40px] p-20 text-center border border-[#3E4042] shadow-2xl animate-fade-in relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1877F2]/5 to-transparent opacity-30"></div>
                        <div className="relative z-10">
                            <div className="w-24 h-24 bg-[#3A3B3C] rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-[#4E4F50]">
                                <i className="fas fa-box-open text-[#B0B3B8] text-4xl"></i>
                            </div>
                            <h3 className="text-white font-black text-3xl mb-4">Your vault is quiet today</h3>
                            <p className="text-[#B0B3B8] text-xl max-w-sm mx-auto leading-relaxed">
                                We couldn't find any older posts from this specific date. Keep sharing today to create beautiful memories for next year!
                            </p>
                            <button className="mt-10 bg-gradient-to-r from-[#1877F2] to-[#6366F1] text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 transition-transform active:scale-95">
                                Create a New Post
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-24 py-12 text-center border-t border-[#3E4042]/40">
                <div className="flex items-center justify-center gap-6 text-[#B0B3B8] opacity-50">
                    <div className="h-px w-16 bg-[#3E4042]"></div>
                    <span className="text-xs font-black uppercase tracking-[0.4em]">UNERA MEMORIES VAULT</span>
                    <div className="h-px w-16 bg-[#3E4042]"></div>
                </div>
            </div>
        </div>
    );
};

// --- SETTINGS PAGE ---
interface SettingsPageProps {
    currentUser: User | null;
    onUpdateUser: (data: Partial<User>) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ currentUser, onUpdateUser }) => {
    const [activeSection, setActiveSection] = useState<'main' | 'details' | 'security'>('main');
    const [name, setName] = useState(currentUser?.name || '');
    const [bio, setBio] = useState(currentUser?.bio || '');
    const [location, setLocation] = useState(currentUser?.location || '');
    const [work, setWork] = useState(currentUser?.work || '');

    if (!currentUser) return <div className="p-8 text-center text-[#B0B3B8]">Please login to access settings.</div>;

    const handleSaveDetails = () => {
        onUpdateUser({ name, bio, location, work });
        alert("Details updated successfully!");
        setActiveSection('main');
    };

    if (activeSection === 'details') {
        return (
            <div className="w-full max-w-[600px] mx-auto p-4 text-[#E4E6EB] animate-fade-in">
                <button onClick={() => setActiveSection('main')} className="mb-4 text-[#B0B3B8] hover:text-white flex items-center gap-2"><i className="fas fa-arrow-left"></i> Back</button>
                <h2 className="text-2xl font-bold mb-6">Personal Details</h2>
                <div className="space-y-4">
                    <div><label className="block text-sm text-[#B0B3B8] mb-1">Full Name</label><input type="text" className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-3 outline-none" value={name} onChange={e => setName(e.target.value)} /></div>
                    <div><label className="block text-sm text-[#B0B3B8] mb-1">Bio</label><textarea className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-3 outline-none" value={bio} onChange={e => setBio(e.target.value)} /></div>
                    <div><label className="block text-sm text-[#B0B3B8] mb-1">Location</label><input type="text" className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-3 outline-none" value={location} onChange={e => setLocation(e.target.value)} /></div>
                    <div><label className="block text-sm text-[#B0B3B8] mb-1">Work</label><input type="text" className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-3 outline-none" value={work} onChange={e => setWork(e.target.value)} /></div>
                    <button onClick={handleSaveDetails} className="w-full bg-[#1877F2] py-3 rounded-lg font-bold mt-4">Save Changes</button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[700px] mx-auto p-4 font-sans text-[#E4E6EB] animate-fade-in pb-20">
            <h1 className="text-2xl font-bold mb-6">Settings & Privacy</h1>
            <div className="flex flex-col gap-6">
                <div className="bg-[#242526] rounded-xl overflow-hidden border border-[#3E4042] shadow-sm">
                    <div className="p-4 border-b border-[#3E4042] bg-[#2A2B2D]">
                        <h2 className="text-lg font-bold flex items-center gap-2"><i className="fas fa-user-shield text-[#1877F2]"></i> Accounts Center</h2>
                    </div>
                    <div className="p-4 flex items-center justify-between hover:bg-[#3A3B3C] cursor-pointer transition-colors" onClick={() => setActiveSection('details')}>
                        <div className="flex items-center gap-3"><i className="fas fa-user-circle text-[#B0B3B8] w-6 text-center text-lg"></i>
                            <div>
                                <h3 className="font-bold">Personal details</h3>
                                <p className="text-xs text-[#B0B3B8]">Update your name, bio, and other information</p>
                            </div>
                        </div>
                        <i className="fas fa-chevron-right text-xs text-[#B0B3B8]"></i>
                    </div>
                    <div className="p-4 flex items-center justify-between hover:bg-[#3A3B3C] cursor-pointer transition-colors">
                        <div className="flex items-center gap-3"><i className="fas fa-lock text-[#B0B3B8] w-6 text-center text-lg"></i>
                            <div>
                                <h3 className="font-bold">Password and security</h3>
                                <p className="text-xs text-[#B0B3B8]">Change your password, set up two-factor auth</p>
                            </div>
                        </div>
                        <i className="fas fa-chevron-right text-xs text-[#B0B3B8]"></i>
                    </div>
                </div>
            </div>
        </div>
    );
};
