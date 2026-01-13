
import React, { useState, useEffect, useMemo } from 'react';
import { User, Event, Group, Product, Post as PostType, AudioTrack } from '../types';
import { MARKETPLACE_COUNTRIES } from '../constants';
import { Post } from './Feed';

// --- SUGGESTED PROFILES PAGE ---
interface SuggestedProfilesPageProps {
    currentUser: User;
    users: User[];
    onFollow: (id: number) => void;
    onProfileClick: (id: number) => void;
}

export const SuggestedProfilesPage: React.FC<SuggestedProfilesPageProps> = ({ 
    currentUser, users, onFollow, onProfileClick 
}) => {
    const [hiddenUserIds, setHiddenUserIds] = useState<number[]>([]);

    const availableUsers = useMemo(() => {
        if (!users || !Array.isArray(users)) return [];
        return users.filter(u => {
            if (!currentUser) return true;
            if (u.id === currentUser.id) return false; 
            if (currentUser.following?.includes(u.id)) return false; 
            if (hiddenUserIds.includes(u.id)) return false;
            return true;
        }).map(u => {
            let score = 0;
            let reason = "Suggested for you";
            if(currentUser && u.location === currentUser.location) score += 5;
            return { user: u, score, reason };
        }).sort((a, b) => b.score - a.score);
    }, [users, currentUser, hiddenUserIds]);

    const handleFollow = (id: number) => {
        onFollow(id);
        setHiddenUserIds(prev => [...prev, id]);
    };

    return (
        <div className="w-full max-w-[700px] mx-auto p-4 font-sans pb-20 animate-fade-in">
            <h2 className="text-2xl font-bold text-[#E4E6EB] mb-6">Discover People</h2>
            {availableUsers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {availableUsers.slice(0, 12).map(({ user, reason }) => (
                        <div key={user.id} className="bg-[#242526] rounded-xl border border-[#3E4042] overflow-hidden flex flex-col shadow-sm">
                            <div className="h-20 bg-gradient-to-r from-blue-900 to-slate-900 relative">
                                 {user.cover_image_url && <img src={user.cover_image_url} className="w-full h-full object-cover opacity-40" alt="" />}
                                 <div className="absolute -bottom-6 left-4">
                                     <img src={user.profile_image_url} className="w-16 h-16 rounded-full border-4 border-[#242526] object-cover bg-[#242526]" alt="" />
                                 </div>
                            </div>
                            <div className="pt-8 px-4 pb-4 flex-1 flex flex-col">
                                <div onClick={() => onProfileClick(user.id)} className="cursor-pointer">
                                    <h3 className="text-[#E4E6EB] font-bold text-lg hover:underline truncate">{user.name || user.username}</h3>
                                </div>
                                <p className="text-[#B0B3B8] text-xs mb-4 line-clamp-1">{user.location || reason}</p>
                                <div className="mt-auto">
                                    <button onClick={() => handleFollow(user.id)} className="w-full bg-[#1877F2] text-white py-2 rounded-lg font-semibold hover:bg-[#166FE5] transition-colors">Follow</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 text-[#B0B3B8]">
                    <p>No new suggestions at the moment.</p>
                </div>
            )}
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

    const birthdayPeople = users.filter(u => u.id !== currentUser?.id && isBirthdayToday(u.birth_date));

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
                                <div className="relative mb-4">
                                    <div className="absolute -inset-1 bg-gradient-to-tr from-[#1877F2] via-[#F3425F] to-[#FAB400] rounded-full animate-[spin_3s_linear_infinite] opacity-75 blur-sm"></div>
                                    <img src={person.profile_image_url} className="w-24 h-24 rounded-full object-cover border-4 border-[#242526] relative z-10 cursor-pointer" onClick={() => onProfileClick(person.id)} alt="" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">{person.name}</h3>
                                <p className="text-[#B0B3B8] text-sm mb-6 flex items-center gap-1"><i className="fas fa-map-marker-alt text-[10px]"></i> {person.location || 'World Citizen'}</p>
                                <button onClick={() => onMessage(person.id)} className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg">Wish Him/Her</button>
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

// ... Rest of component stays same
export const EventsPage = ({ events, currentUser, onJoinEvent, onCreateEventClick, onProfileClick }: any) => { /* ... existing ... */ };
export const MemoriesPage = ({ currentUser, posts, users, onProfileClick, onReact, onShare, onViewImage, onOpenComments, onVideoClick, onPlayAudioTrack, onHashtagClick }: any) => { /* ... existing ... */ };
export const SettingsPage = ({ currentUser, onUpdateUser }: any) => { /* ... existing ... */ };
