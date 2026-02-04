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

// --- MEMORIES PAGE ---
export const MemoriesPage = ({
  currentUser,
  posts,
  users,
  onProfileClick,
  onReact,
  onShare,
  onViewImage,
  onOpenComments,
  onVideoClick,
  onPlayAudioTrack,
  onHashtagClick,
}: any) => {
  // ---- Defensive helpers (avoid blank screen) ----
  const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
  const safeNumber = (v: any, fallback = 0) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const safeString = (v: any, fallback = "") => (typeof v === "string" ? v : fallback);

  const allPosts = safeArray<PostType>(posts);
  const allUsers = safeArray<User>(users);

  // ---- Find author safely (important for feed Post component) ----
  const authorOf = (p: any) =>
    allUsers.find((u: any) => Number(u?.id) === Number(p?.user_id)) || currentUser;

  // ---- Date utilities ----
  const parseDate = (d: any): Date | null => {
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  };

  const formatMonthDay = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "long", day: "numeric" });

  // ---- Helper to compare dates by year-month-day (ignore time) ----
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // ---- Pick a "memory date" (default = today) ----
  const today = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [onlyMine, setOnlyMine] = useState<boolean>(true);

  const selectedLabel = useMemo(() => {
    const d = new Date();
    d.setMonth(selectedMonth);
    d.setDate(selectedDay);
    return formatMonthDay(d);
  }, [selectedMonth, selectedDay]);

  // ---- Compute target date = selected date - 7 days ----
  const targetDate = useMemo(() => {
    const d = new Date();
    d.setFullYear(today.getFullYear()); // keep current year by default
    d.setMonth(selectedMonth);
    d.setDate(selectedDay);
    
    // ✅ subtract 7 days
    d.setDate(d.getDate() - 7);
    return d;
  }, [today, selectedMonth, selectedDay]);

  // ---- Build memories: posts from last week (same weekday/day offset) ----
  const lastWeekPosts = useMemo(() => {
    const targetKey = ymd(targetDate);

    return allPosts
      .filter((p: any) => {
        const created = parseDate(p?.created_at || p?.createdAt);
        if (!created) return false;

        // ✅ exact day last week
        if (ymd(created) !== targetKey) return false;

        // Only my posts (optional)
        if (onlyMine && Number(p?.user_id) !== Number(currentUser?.id)) return false;

        return true;
      })
      .map((p: any) => ({
        ...p,
        id: safeNumber(p?.id ?? p?.post_id ?? p?.postId),
        user_id: safeNumber(p?.user_id),
        created_at: p?.created_at ?? p?.createdAt ?? new Date().toISOString(),
      }))
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
  }, [allPosts, currentUser?.id, onlyMine, targetDate]);

  // ---- UI ----
  return (
    <div className="w-full max-w-[900px] mx-auto p-4 md:p-6 font-sans pb-20 animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 bg-gradient-to-tr from-[#1877F2] to-[#00C6FF] rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3">
          <i className="fas fa-history text-white text-2xl"></i>
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-white leading-tight">Memories</h1>
          <p className="text-[#B0B3B8]">
            Relive posts from last week — <span className="text-white font-semibold">{selectedLabel}</span>
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-[#242526] rounded-2xl border border-[#3E4042] p-4 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-[#B0B3B8] text-sm font-semibold">Pick a date:</span>

            {/* Month */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-[#3A3B3C] border border-[#3E4042] rounded-lg px-3 py-2 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
            >
              {Array.from({ length: 12 }).map((_, m) => (
                <option key={m} value={m}>
                  {new Date(2000, m, 1).toLocaleDateString(undefined, { month: "long" })}
                </option>
              ))}
            </select>

            {/* Day */}
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(Number(e.target.value))}
              className="bg-[#3A3B3C] border border-[#3E4042] rounded-lg px-3 py-2 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
            >
              {Array.from({ length: 31 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setSelectedMonth(today.getMonth());
                setSelectedDay(today.getDate());
              }}
              className="px-3 py-2 rounded-lg bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] font-semibold transition-colors active:scale-95"
            >
              Today
            </button>
          </div>

          <div className="md:ml-auto flex items-center gap-2">
            <button
              onClick={() => setOnlyMine(true)}
              className={`px-3 py-2 rounded-lg font-semibold transition-colors active:scale-95 ${
                onlyMine
                  ? "bg-[#1877F2] text-white"
                  : "bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB]"
              }`}
            >
              My memories
            </button>
            <button
              onClick={() => setOnlyMine(false)}
              className={`px-3 py-2 rounded-lg font-semibold transition-colors active:scale-95 ${
                !onlyMine
                  ? "bg-[#1877F2] text-white"
                  : "bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB]"
              }`}
            >
              All memories
            </button>
          </div>
        </div>

        <div className="mt-3 text-[#B0B3B8] text-sm">
          Found <span className="text-white font-bold">{lastWeekPosts.length}</span> memory(ies) from last week on{" "}
          <span className="text-white font-semibold">
            {targetDate.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          </span>
          .
        </div>
      </div>

      {/* Last week memories */}
      {lastWeekPosts.length === 0 ? (
        <div className="bg-[#242526] rounded-3xl p-10 text-center border border-[#3E4042] shadow-inner">
          <i className="fas fa-clock text-[#B0B3B8] text-4xl mb-4 opacity-50"></i>
          <h3 className="text-white font-bold text-lg mb-1">No Memories From Last Week</h3>
          <p className="text-[#B0B3B8]">
            You don't have posts on{" "}
            <span className="text-white font-semibold">
              {targetDate.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
            </span>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {lastWeekPosts.map((post: any) => (
            <Post
              key={post.id}
              post={post}
              author={authorOf(post)}
              currentUser={currentUser}
              onProfileClick={onProfileClick}
              onReact={onReact}
              onShare={onShare}
              onViewImage={onViewImage}
              onOpenComments={onOpenComments}
              onVideoClick={onVideoClick}
              onPlayAudioTrack={onPlayAudioTrack}
              onHashtagClick={onHashtagClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// --- EVENTS PAGE ---
export const EventsPage = () => {
  return <div className="p-6 text-white">EventsPage not implemented yet.</div>;
};

// --- SETTINGS PAGE ---
export const SettingsPage = () => {
  return <div className="p-6 text-white">SettingsPage not implemented yet.</div>;
};
