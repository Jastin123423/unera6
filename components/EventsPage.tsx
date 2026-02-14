import React, { useState, useMemo, useEffect } from 'react';
import { User, Event } from '../types';

// --- LINKIFY HELPER ---
const linkify = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
        if (part.match(urlRegex)) {
            return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-[#1877F2] hover:underline" onClick={e => e.stopPropagation()}>{part}</a>;
        }
        return part;
    });
};

// --- SHUFFLE HELPER FOR "ROTATING" FEEL ---
const shuffleArray = (array: any[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// --- DATE/TIME FORMATTING (MATCHING APP.TSX NORMALIZATION) ---
const toDateOnly = (d: any): string => {
    if (!d) return new Date().toISOString().split('T')[0];
    const dt = new Date(d);
    return Number.isFinite(dt.getTime()) 
        ? dt.toISOString().split('T')[0] // YYYY-MM-DD
        : new Date().toISOString().split('T')[0];
};

const toTimeHM = (raw: any): string => {
    if (!raw) return "19:00";
    const dt = new Date(raw);
    if (Number.isFinite(dt.getTime())) {
        return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    }
    // If it's already a time string like "19:00"
    if (typeof raw === 'string' && /^\d{1,2}:\d{2}$/.test(raw)) {
        const [hours, minutes] = raw.split(':');
        return `${String(parseInt(hours)).padStart(2, '0')}:${String(parseInt(minutes)).padStart(2, '0')}`;
    }
    return "19:00";
};

// --- NORMALIZATION HELPERS (CRITICAL FOR API COMPATIBILITY) ---
const safeArr = (v: any): number[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(Number).filter(Number.isFinite);

  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const safeDate = (d: any): Date => {
  const dt = new Date(d);
  return Number.isFinite(dt.getTime()) ? dt : new Date();
};

const normalizeEvent = (e: any) => {
  const rawDate = e?.event_date ?? e?.date ?? e?.created_at ?? "";
  const rawTime = e?.time ?? e?.event_time ?? rawDate;

  // Generate a fallback ID if API returns 0 or null
  const rawId = Number(e?.id ?? 0);
  const eventId = rawId || Math.floor(Math.random() * 1e12);

  return {
    ...e,
    id: eventId,
    date: toDateOnly(rawDate), // YYYY-MM-DD format matching App.tsx
    time: toTimeHM(rawTime), // HH:MM format matching App.tsx
    image: e?.cover_url ?? e?.image ?? e?.cover_image ?? "/default-event.jpg", // Added default image

    attendees: safeArr(e?.attendees ?? e?.attendee_ids),
    interestedIds: safeArr(e?.interestedIds ?? e?.interested_ids),

    organizerId: Number(e?.organizerId ?? e?.creator_id ?? e?.user_id ?? 0),

    location: e?.location ?? "",
    title: e?.title ?? "Untitled event",
    description: e?.description ?? "",
    visibility: e?.visibility ?? "worldwide",
  };
};

// --- PROPS INTERFACE ---
interface EventsPageProps { 
  events: Event[]; 
  currentUser: User | null; 
  onJoinEvent: (eventId: number) => Promise<void>; 
  onInterestedEvent: (eventId: number) => Promise<void>;
  onCreateEventClick: () => void;

  // These come from App.tsx and are used in the component
  onProfileClick?: (userId: number) => void;
  onFollow?: (userId: number) => Promise<void> | void;
  checkIsFollowing?: (userId: number) => boolean;
  followLoading?: Record<number, boolean>;
}

// --- COMPACT EVENT CARD COMPONENT ---
const CompactEventCard: React.FC<{ 
  event: any, 
  currentUser: User | null, 
  onClick: () => void,
  onJoin: (e: React.MouseEvent) => void,
  onInterested: (e: React.MouseEvent) => void,
  onProfileClick?: (userId: number) => void,
  isWide?: boolean
}> = ({ event, currentUser, onClick, onJoin, onInterested, onProfileClick, isWide }) => {
  const attendees = Array.isArray(event.attendees) ? event.attendees : [];
  const interestedIds = Array.isArray(event.interestedIds) ? event.interestedIds : [];
  
  const date = safeDate(event.date || event.event_date || event.created_at || Date.now());
  const isAttending = !!currentUser && attendees.includes(currentUser.id);
  const isInterested = !!currentUser && interestedIds.includes(currentUser.id);

  const handleOrganizerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onProfileClick && event.organizerId) {
      onProfileClick(event.organizerId);
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`bg-[#242526] rounded-xl overflow-hidden border border-[#3E4042] flex flex-col hover:bg-[#3A3B3C] transition-all cursor-pointer shadow-md group ${isWide ? 'w-[260px] shrink-0' : 'w-full'}`}
    >
      <div className="h-32 relative overflow-hidden">
        {/* Fixed image src with fallback */}
        <img 
          src={event.image || ''} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
          alt={event.title}
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/default-event.jpg';
          }}
        />
        <div className="absolute top-2 left-2 bg-white/95 text-black rounded-lg px-2 py-1 text-center shadow-lg min-w-[36px]">
          <div className="text-[8px] font-black uppercase text-[#1877F2] leading-none">{date.toLocaleString('default', { month: 'short' })}</div>
          <div className="text-[14px] font-black leading-tight">{date.getDate()}</div>
        </div>
        {event.visibility === 'targeted' && (
          <div className="absolute top-2 right-2 bg-[#45BD62] text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase tracking-tighter">
            Local
          </div>
        )}
      </div>
      
      <div className="p-3 flex flex-col flex-1">
        <h3 className="text-[14px] font-bold text-[#E4E6EB] line-clamp-1 mb-1 leading-tight group-hover:text-[#1877F2] transition-colors">{event.title}</h3>
        
        {/* Organizer info */}
        {event.organizerId && onProfileClick && (
          <button 
            onClick={handleOrganizerClick}
            className="text-left mb-1 group/organizer"
          >
            <span className="text-[10px] text-[#B0B3B8] font-medium hover:text-[#1877F2] transition-colors">
              By {event.organizer_name || 'Organizer'}
            </span>
          </button>
        )}
        
        <p className="text-[11px] text-[#B0B3B8] font-medium truncate mb-1">
          {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {event.time}
        </p>
        <div className="flex items-center gap-1 text-[10px] font-bold text-[#B0B3B8] mb-3">
          <i className="fas fa-users text-[#45BD62] text-[9px]"></i>
          <span>{attendees.length} going • {interestedIds.length} interested</span>
        </div>

        <div className="mt-auto flex gap-1.5">
          <button 
            onClick={onInterested}
            disabled={!!isAttending}
            className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition-all flex items-center justify-center gap-1 border ${
              isInterested 
              ? 'bg-[#FAB400]/20 text-[#FAB400] border-[#FAB400]/30' 
              : isAttending 
                ? 'opacity-30 cursor-not-allowed' 
                : 'bg-[#3A3B3C] text-[#E4E6EB] border-transparent hover:bg-[#4E4F50]'
            }`}
          >
            <i className={`${isInterested ? 'fas' : 'far'} fa-star text-[9px]`}></i>
            <span>Interested</span>
          </button>
          <button 
            onClick={onJoin}
            className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition-all flex items-center justify-center gap-1 shadow-md ${
              isAttending 
              ? 'bg-[#45BD62] text-white' 
              : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
            }`}
          >
            <i className={`fas ${isAttending ? 'fa-check' : 'fa-plus'} text-[9px]`}></i>
            <span>{isAttending ? 'Going' : 'Going'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- EVENT DETAILS MODAL COMPONENT ---
const EventDetailsModal: React.FC<{ 
  event: any, 
  currentUser: User | null, 
  onClose: () => void, 
  onJoin: () => void, 
  onInterested: () => void,
  onProfileClick?: (userId: number) => void 
}> = ({ event, currentUser, onClose, onJoin, onInterested, onProfileClick }) => {
  const attendees = Array.isArray(event.attendees) ? event.attendees : [];
  const interestedIds = Array.isArray(event.interestedIds) ? event.interestedIds : [];
  
  const date = safeDate(event.date || event.event_date || event.created_at || Date.now());
  const isAttending = !!currentUser && attendees.includes(currentUser.id);
  const isInterested = !!currentUser && interestedIds.includes(currentUser.id);

  const handleOrganizerClick = () => {
    if (onProfileClick && event.organizerId) {
      onProfileClick(event.organizerId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black/90 flex items-center justify-center p-0 sm:p-4 animate-fade-in backdrop-blur-md" onClick={onClose}>
      <div className="bg-[#242526] w-full max-w-[700px] h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-[#3E4042]" onClick={e => e.stopPropagation()}>
        <div className="relative h-[250px] sm:h-[350px] shrink-0">
          {/* Fixed image src with fallback */}
          <img 
            src={event.image || ''} 
            className="w-full h-full object-cover" 
            alt={event.title}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/default-event.jpg';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#242526] via-transparent to-transparent"></div>
          <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-all border border-white/10">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
            <div>
              <p className="text-[#F3425F] font-black uppercase text-sm tracking-widest mb-1">
                {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              <h2 className="text-3xl font-black text-white leading-tight">{event.title}</h2>
              
              {/* Organizer info */}
              {event.organizerId && onProfileClick && (
                <button 
                  onClick={handleOrganizerClick}
                  className="mt-2 text-left group"
                >
                  <span className="text-sm text-[#B0B3B8] hover:text-[#1877F2] transition-colors">
                    Hosted by <span className="font-bold">{event.organizer_name || 'Organizer'}</span>
                  </span>
                </button>
              )}
              
              <div className="flex items-center gap-2 text-[#B0B3B8] font-bold mt-2">
                <i className="fas fa-location-dot text-[#1877F2]"></i>
                <span>{event.location}</span>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={onInterested}
                disabled={!!isAttending}
                className={`flex-1 sm:px-6 py-2.5 rounded-xl font-black text-[15px] transition-all flex items-center justify-center gap-2 ${
                  isInterested 
                  ? 'bg-[#FAB400]/20 text-[#FAB400] border border-[#FAB400]/30' 
                  : isAttending ? 'opacity-30 cursor-not-allowed' : 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                }`}
              >
                <i className={`${isInterested ? 'fas' : 'far'} fa-star`}></i>
                <span>Interested</span>
              </button>
              <button 
                onClick={onJoin}
                className={`flex-1 sm:px-8 py-2.5 rounded-xl font-black text-[15px] transition-all flex items-center justify-center gap-2 shadow-lg ${
                  isAttending 
                  ? 'bg-[#45BD62] text-white' 
                  : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                }`}
              >
                <i className={`fas ${isAttending ? 'fa-check' : 'fa-plus'}`}></i>
                <span>{isAttending ? 'Going' : 'Going'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div>
                <h3 className="text-white font-black uppercase text-xs tracking-widest mb-3 pb-2 border-b border-[#3E4042] w-fit pr-8">Description</h3>
                <p className="text-[#E4E6EB] text-[16px] leading-relaxed whitespace-pre-wrap">
                  {event.description ? linkify(event.description) : 'No description provided for this event.'}
                </p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-[#18191A] p-4 rounded-xl border border-[#3E4042]">
                <h4 className="text-xs font-black text-[#B0B3B8] uppercase tracking-widest mb-4">Event Details</h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#3A3B3C] flex items-center justify-center"><i className="fas fa-clock text-[#1877F2]"></i></div>
                    <div>
                      <p className="text-white text-sm font-bold">{event.time}</p>
                      <p className="text-[10px] text-[#B0B3B8] font-bold">Standard Time</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#3A3B3C] flex items-center justify-center"><i className="fas fa-users text-[#45BD62]"></i></div>
                    <div>
                      <p className="text-white text-sm font-bold">{attendees.length} Attendees</p>
                      <p className="text-[10px] text-[#B0B3B8] font-bold">{interestedIds.length} interested</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#3A3B3C] flex items-center justify-center"><i className="fas fa-globe text-[#A033FF]"></i></div>
                    <div>
                      <p className="text-white text-sm font-bold capitalize">{event.visibility || 'Worldwide'}</p>
                      <p className="text-[10px] text-[#B0B3B8] font-bold">Visibility Scope</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN EVENTS PAGE COMPONENT ---
export const EventsPage: React.FC<EventsPageProps> = ({ 
  events, 
  currentUser, 
  onJoinEvent, 
  onInterestedEvent, 
  onCreateEventClick,
  onProfileClick,
  onFollow,
  checkIsFollowing,
  followLoading
}) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [shuffledEvents, setShuffledEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  const categories = ['All', 'Discover', 'Hosting', 'Upcoming'];

  // Normalize events from API
  const safeEvents = useMemo(() => {
    const list = Array.isArray(events) ? events : [];
    return list.map(normalizeEvent);
  }, [events]);

  // Filter logic with FIXED targeted events filtering
  const filteredEvents = useMemo(() => {
    let visible = safeEvents.filter(event => {
      if (!event.visibility || event.visibility === 'worldwide') return true;
      if (event.visibility === 'targeted') {
        if (!currentUser) return false;
        
        const userLoc = String(currentUser.location || "").toLowerCase();
        const eventLoc = String(event.location || "").toLowerCase();
        const userRegion = userLoc.split(',').pop()?.trim() || userLoc;
        const eventRegion = eventLoc.split(',').pop()?.trim() || eventLoc;

        // CRITICAL FIX: Prevent empty regions from matching
        if (!userRegion || !eventRegion || userRegion === "" || eventRegion === "") {
          return false;
        }

        return (
          userLoc.includes(eventRegion) ||
          eventLoc.includes(userRegion) ||
          userRegion === eventRegion
        );
      }
      return true;
    });

    if (selectedCategory === 'Hosting' && currentUser) {
      return visible.filter(e => e.organizerId === currentUser.id);
    }
    if (selectedCategory === 'Upcoming' && currentUser) {
      return visible.filter(e => 
        e.attendees.includes(currentUser.id) || 
        e.interestedIds.includes(currentUser.id)
      );
    }
    return visible;
  }, [safeEvents, selectedCategory, currentUser]);

  // Shuffle only on category change to create the "rotating" feel
  useEffect(() => {
    setShuffledEvents(shuffleArray(filteredEvents));
  }, [filteredEvents]);

  // Split events into chunks for alternating layout
  const alternatingChunks = useMemo(() => {
    const chunks = [];
    let i = 0;
    let isGrid = true;
    
    while (i < shuffledEvents.length) {
      const count = isGrid ? 4 : 4;
      chunks.push({
        type: isGrid ? 'grid' : 'slider',
        items: shuffledEvents.slice(i, i + count)
      });
      i += count;
      isGrid = !isGrid;
    }
    return chunks;
  }, [shuffledEvents]);

  // API call wrappers with error handling
  const handleJoin = async (eventId: number) => {
    if (!currentUser) return;
    setActionLoading(true);
    setError('');
    try {
      await onJoinEvent(eventId);
    } catch (e: any) {
      setError(e?.message || "Failed to join event");
      console.error("Join event error:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleInterested = async (eventId: number) => {
    if (!currentUser) return;
    setActionLoading(true);
    setError('');
    try {
      await onInterestedEvent(eventId);
    } catch (e: any) {
      setError(e?.message || "Failed to mark interest");
      console.error("Mark interested error:", e);
    } finally {
      setActionLoading(false);
    }
  };

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="w-full max-w-[1000px] mx-auto p-4 font-sans pb-24 animate-fade-in">
      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm font-bold animate-fade-in">
          <div className="flex items-center gap-2">
            <i className="fas fa-exclamation-triangle"></i>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Minimal Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-[#242526] p-6 rounded-2xl border border-[#3E4042] shadow-xl">
        <div>
          <h1 className="text-3xl font-black text-[#E4E6EB]">Events</h1>
          <p className="text-[#B0B3B8] text-sm font-bold uppercase tracking-widest mt-1">Happening in your community</p>
        </div>
        {currentUser && (
          <button 
            onClick={onCreateEventClick}
            className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-8 py-3 rounded-2xl font-black flex items-center gap-3 transition-all shadow-lg active:scale-95"
          >
            <i className="fas fa-calendar-plus text-xl"></i>
            <span>Create Event</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-10 overflow-x-auto scrollbar-hide">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest border transition-all ${
              selectedCategory === cat 
              ? 'bg-[#1877F2] border-[#1877F2] text-white shadow-lg' 
              : 'bg-[#242526] border-[#3E4042] text-[#B0B3B8] hover:bg-[#3A3B3C]'
            }`}
            disabled={actionLoading}
          >
            {cat}
          </button>
        ))}
      </div>

      {actionLoading && shuffledEvents.length === 0 ? (
        <div className="p-20 text-center text-[#B0B3B8] bg-[#242526] rounded-3xl border border-[#3E4042] shadow-inner">
          <div className="w-24 h-24 bg-[#3A3B3C] rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-spinner fa-spin text-5xl text-[#1877F2]"></i>
          </div>
          <h3 className="text-xl font-black text-[#E4E6EB] mb-2">Loading events...</h3>
          <p className="max-w-xs mx-auto font-medium">Please wait while we fetch the latest events.</p>
        </div>
      ) : shuffledEvents.length > 0 ? (
        <div className="space-y-16">
          {alternatingChunks.map((chunk, idx) => (
            <div key={idx} className="animate-fade-in">
              {chunk.type === 'slider' ? (
                <div className="relative">
                  <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide">
                    {chunk.items.map((event: any) => (
                      <CompactEventCard 
                        key={event.id}
                        event={event}
                        currentUser={currentUser}
                        isWide={true}
                        onClick={() => setSelectedEvent(event)}
                        onJoin={(e) => { e.stopPropagation(); handleJoin(event.id); }}
                        onInterested={(e) => { e.stopPropagation(); handleInterested(event.id); }}
                        onProfileClick={onProfileClick}
                      />
                    ))}
                  </div>
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#242526] rounded-full flex items-center justify-center shadow-lg border border-[#3E4042] hidden md:flex opacity-50"><i className="fas fa-chevron-left text-[10px]"></i></div>
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#242526] rounded-full flex items-center justify-center shadow-lg border border-[#3E4042] hidden md:flex opacity-50"><i className="fas fa-chevron-right text-[10px]"></i></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {chunk.items.map((event: any) => (
                    <CompactEventCard 
                      key={event.id}
                      event={event}
                      currentUser={currentUser}
                      onClick={() => setSelectedEvent(event)}
                      onJoin={(e) => { e.stopPropagation(); handleJoin(event.id); }}
                      onInterested={(e) => { e.stopPropagation(); handleInterested(event.id); }}
                      onProfileClick={onProfileClick}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-20 text-center text-[#B0B3B8] bg-[#242526] rounded-3xl border border-[#3E4042] shadow-inner">
          <div className="w-24 h-24 bg-[#3A3B3C] rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-calendar-xmark text-5xl opacity-20"></i>
          </div>
          <h3 className="text-xl font-black text-[#E4E6EB] mb-2">No events found</h3>
          <p className="max-w-xs mx-auto font-medium">Try changing your filters or check back later for new gatherings.</p>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailsModal 
          event={selectedEvent}
          currentUser={currentUser}
          onClose={() => setSelectedEvent(null)}
          onJoin={() => handleJoin(selectedEvent.id)}
          onInterested={() => handleInterested(selectedEvent.id)}
          onProfileClick={onProfileClick}
        />
      )}
    </div>
  );
};

// Export both named and default for compatibility with App.tsx
export default EventsPage;
