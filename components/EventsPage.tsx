
return (
  <div className="min-h-screen bg-[#18191A] text-[#E4E6EB]">
    <div className="p-2 bg-red-600 text-white font-bold">
      EVENTS PAGE RENDERED (inside full UI)
    </div>

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { User, Event as EventType } from '../types';



// -------------------- SAFE HELPERS --------------------
const safeString = (v: any) => (typeof v === 'string' ? v : v == null ? '' : String(v));

const safeNumber = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const safeArray = <T,>(v: any): T[] => {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return [];
    // Try JSON array
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {
      // If it's a comma-separated string, you can optionally split:
      // return s.split(',').map(x => x.trim()).filter(Boolean) as any;
    }
  }
  return [];
};

const normalizeEvent = (e: any): EventType => {
  // normalize key fields to prevent crashes
  const attendees = safeArray<number>(e?.attendees);
  const interestedIds = safeArray<number>(e?.interestedIds);

  return {
    ...e,
    id: safeNumber(e?.id),
    title: safeString(e?.title),
    description: safeString(e?.description),
    date: safeString(e?.date || e?.event_date),
    time: safeString(e?.time || e?.event_time),
    location: safeString(e?.location),
    image: safeString(e?.image || e?.cover_url),
    visibility: safeString(e?.visibility || 'public') as any,

    organizerId: safeNumber(e?.organizerId ?? e?.organizer_id),
    organizer_name: safeString(e?.organizer_name ?? e?.organizerName ?? e?.organizer),
    organizer_avatar: safeString(e?.organizer_avatar ?? e?.organizerAvatar ?? e?.organizer_profile_image),

    attendees,
    interestedIds,
  } as EventType;
};

// ========== EVENT CARD COMPONENT ==========
interface EventCardProps {
  event: EventType;
  currentUser: User | null;
  onJoinEvent: (eventId: number) => Promise<any>;
  onInterestedEvent: (eventId: number) => Promise<any>;
  onProfileClick: (id: number) => void;
  onFollow: (userId: number) => Promise<void>;
  checkIsFollowing: (userId: number) => boolean;
}

const EventCard: React.FC<EventCardProps> = ({
  event,
  currentUser,
  onJoinEvent,
  onInterestedEvent,
  onProfileClick,
  onFollow,
  checkIsFollowing
}) => {
  const [loading, setLoading] = useState<'join' | 'interested' | null>(null);
  const [attendeesCount, setAttendeesCount] = useState(safeArray<number>(event.attendees).length);
  const [interestedCount, setInterestedCount] = useState(safeArray<number>(event.interestedIds).length);
  const [isJoined, setIsJoined] = useState(false);
  const [isInterested, setIsInterested] = useState(false);

  // Keep local UI in sync when events/currentUser updates
  useEffect(() => {
    const attendees = safeArray<number>(event.attendees);
    const interested = safeArray<number>(event.interestedIds);
    setAttendeesCount(attendees.length);
    setInterestedCount(interested.length);

    const uid = currentUser?.id;
    setIsJoined(uid ? attendees.includes(uid) : false);
    setIsInterested(uid ? interested.includes(uid) : false);
  }, [event, currentUser]);

  const isMyEvent = useMemo(() => {
    return !!(currentUser && safeNumber(event.organizerId) === safeNumber(currentUser.id));
  }, [currentUser, event.organizerId]);

  const formatDate = useCallback((dateString: string) => {
    const ds = safeString(dateString);
    if (!ds) return '';
    try {
      const date = new Date(ds);
      if (Number.isNaN(date.getTime())) return ds;
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return ds;
    }
  }, []);

  const formatTime = useCallback((timeString: string) => {
    const ts = safeString(timeString);
    if (!ts) return '';
    try {
      const [hours, minutes] = ts.split(':');
      const hour = parseInt(hours, 10);
      if (!Number.isFinite(hour)) return ts;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes || '00'} ${ampm}`;
    } catch {
      return ts;
    }
  }, []);

  const handleJoin = async () => {
    if (!currentUser) return;
    setLoading('join');
    try {
      await onJoinEvent(event.id);
      // optimistic UI
      if (!isJoined) {
        setIsJoined(true);
        setIsInterested(false);
        setAttendeesCount(prev => prev + 1);
        if (isInterested) setInterestedCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to join event:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleInterested = async () => {
    if (!currentUser) return;
    setLoading('interested');
    try {
      await onInterestedEvent(event.id);
      if (!isInterested) {
        setIsInterested(true);
        setIsJoined(false);
        setInterestedCount(prev => prev + 1);
        if (isJoined) setAttendeesCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark as interested:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleLeave = async () => {
    if (!currentUser) return;
    setLoading('join');
    try {
      await onJoinEvent(event.id); // toggle or leave endpoint
      if (isJoined) {
        setIsJoined(false);
        setAttendeesCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to leave event:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleRemoveInterest = async () => {
    if (!currentUser) return;
    setLoading('interested');
    try {
      await onInterestedEvent(event.id); // toggle or remove endpoint
      if (isInterested) {
        setIsInterested(false);
        setInterestedCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to remove interest:', error);
    } finally {
      setLoading(null);
    }
  };

  const organizerName = safeString((event as any).organizer_name);
  const organizerAvatar = safeString((event as any).organizer_avatar);

  return (
    <div className="bg-[#242526] border border-[#3E4042] rounded-xl overflow-hidden mb-4">
      {/* Event Image */}
      <div className="relative h-48 md:h-56">
        <img
          src={safeString(event.image) || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1500&q=80'}
          alt={safeString(event.title) || 'Event'}
          className="w-full h-full object-cover"
        />
        {event.visibility === 'invite_only' && (
          <div className="absolute top-3 right-3 bg-[#00000080] backdrop-blur-sm px-3 py-1 rounded-full">
            <span className="text-white text-xs font-medium flex items-center gap-1">
              <i className="fas fa-lock text-xs"></i>
              Invite Only
            </span>
          </div>
        )}
      </div>

      {/* Event Content */}
      <div className="p-4">
        {/* Event Date & Time */}
        <div className="flex items-center gap-2 text-[#B0B3B8] text-sm mb-3">
          <div className="flex items-center gap-1">
            <i className="fas fa-calendar text-[#E4E6EB]"></i>
            <span>{formatDate(safeString(event.date))}</span>
          </div>
          <span className="text-[#3E4042]">•</span>
          <div className="flex items-center gap-1">
            <i className="fas fa-clock text-[#E4E6EB]"></i>
            <span>{formatTime(safeString(event.time))}</span>
          </div>
          <span className="text-[#3E4042]">•</span>
          <div className="flex items-center gap-1">
            <i className="fas fa-map-marker-alt text-[#E4E6EB]"></i>
            <span>{safeString(event.location) || 'Online'}</span>
          </div>
        </div>

        {/* Event Title & Description */}
        <h3 className="text-[#E4E6EB] font-semibold text-lg mb-2 line-clamp-1">
          {safeString(event.title)}
        </h3>
        <p className="text-[#B0B3B8] text-sm mb-4 line-clamp-2">
          {safeString(event.description)}
        </p>

        {/* Organizer Info */}
        <div className="flex items-center justify-between mb-4">
          <div
            className="flex items-center gap-2 cursor-pointer hover:bg-[#3A3B3C] p-2 rounded-lg transition-colors"
            onClick={() => onProfileClick(safeNumber(event.organizerId))}
          >
            <img
              src={
                organizerAvatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(organizerName || 'Organizer')}&background=1877F2&color=fff&size=32&bold=true`
              }
              alt={organizerName || 'Organizer'}
              className="w-8 h-8 rounded-full object-cover"
            />
            <div>
              <p className="text-[#E4E6EB] text-sm font-medium">{organizerName || 'Organizer'}</p>
              <p className="text-[#B0B3B8] text-xs">Organizer</p>
            </div>
          </div>

          {currentUser && !isMyEvent && (
            <button
              onClick={() => onFollow(safeNumber(event.organizerId))}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                checkIsFollowing(safeNumber(event.organizerId))
                  ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                  : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
              }`}
            >
              {checkIsFollowing(safeNumber(event.organizerId)) ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-[#B0B3B8] text-sm mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <i className="fas fa-users"></i>
              <span>{attendeesCount} going</span>
            </div>
            <div className="flex items-center gap-1">
              <i className="far fa-thumbs-up"></i>
              <span>{interestedCount} interested</span>
            </div>
          </div>
          {event.visibility === 'public' && (
            <div className="flex items-center gap-1 text-[#45BD62]">
              <i className="fas fa-globe"></i>
              <span>Public</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {currentUser && !isMyEvent && (
          <div className="flex gap-2">
            {isJoined ? (
              <button
                onClick={handleLeave}
                disabled={loading === 'join'}
                className="flex-1 bg-[#3A3B3C] text-[#E4E6EB] py-2.5 rounded-lg font-medium hover:bg-[#4E4F50] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading === 'join' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#E4E6EB] border-t-transparent rounded-full animate-spin"></div>
                    Leaving...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i>
                    Going
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleJoin}
                disabled={loading === 'join'}
                className="flex-1 bg-[#1877F2] text-white py-2.5 rounded-lg font-medium hover:bg-[#166FE5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading === 'join' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Joining...
                  </>
                ) : (
                  'Join Event'
                )}
              </button>
            )}

            {isInterested ? (
              <button
                onClick={handleRemoveInterest}
                disabled={loading === 'interested'}
                className="flex-1 bg-[#3A3B3C] text-[#E4E6EB] py-2.5 rounded-lg font-medium hover:bg-[#4E4F50] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading === 'interested' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#E4E6EB] border-t-transparent rounded-full animate-spin"></div>
                    Removing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-thumbs-up"></i>
                    Interested
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleInterested}
                disabled={loading === 'interested'}
                className="flex-1 bg-[#3A3B3C] text-[#E4E6EB] py-2.5 rounded-lg font-medium hover:bg-[#4E4F50] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading === 'interested' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#E4E6EB] border-t-transparent rounded-full animate-spin"></div>
                    Marking...
                  </>
                ) : (
                  'Interested'
                )}
              </button>
            )}
          </div>
        )}

        {isMyEvent && (
          <div className="flex gap-2">
            <button className="flex-1 bg-[#3A3B3C] text-[#E4E6EB] py-2.5 rounded-lg font-medium hover:bg-[#4E4F50] transition-colors flex items-center justify-center gap-2">
              <i className="fas fa-edit"></i>
              Edit Event
            </button>
            <button className="flex-1 bg-[#3A3B3C] text-[#E4E6EB] py-2.5 rounded-lg font-medium hover:bg-[#4E4F50] transition-colors flex items-center justify-center gap-2">
              <i className="fas fa-chart-bar"></i>
              View Analytics
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ========== EVENTS PAGE ==========
interface EventsPageProps {
  events: EventType[];
  currentUser: User | null;
  onJoinEvent: (eventId: number) => Promise<any>;
  onInterestedEvent: (eventId: number) => Promise<any>;
  onCreateEventClick: () => void;
  onProfileClick: (id: number) => void;
  onFollow: (userId: number) => Promise<void>;
  checkIsFollowing: (userId: number) => boolean;
}

export const EventsPage: React.FC<EventsPageProps> = ({
  events,
  currentUser,
  onJoinEvent,
  onInterestedEvent,
  onCreateEventClick,
  onProfileClick,
  onFollow,
  checkIsFollowing
}) => {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past' | 'joined'>('all');
  const [search, setSearch] = useState('');

  const normalizedEvents = useMemo(() => {
    const arr = Array.isArray(events) ? events : [];
    return arr.map(normalizeEvent).filter(e => e.id); // remove invalid
  }, [events]);

  const filteredEvents = useMemo(() => {
    let filtered = [...normalizedEvents];

    // Apply date filter
    const now = new Date();
    switch (filter) {
      case 'upcoming':
        filtered = filtered.filter(event => {
          const d = new Date(safeString(event.date));
          return !Number.isNaN(d.getTime()) ? d >= now : true;
        });
        break;
      case 'past':
        filtered = filtered.filter(event => {
          const d = new Date(safeString(event.date));
          return !Number.isNaN(d.getTime()) ? d < now : false;
        });
        break;
      case 'joined':
        if (currentUser) {
          filtered = filtered.filter(event => safeArray<number>(event.attendees).includes(currentUser.id));
        } else {
          filtered = [];
        }
        break;
    }

    // Apply search filter
    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(event => {
        const title = safeString(event.title).toLowerCase();
        const desc = safeString(event.description).toLowerCase();
        const loc = safeString(event.location).toLowerCase();
        const org = safeString((event as any).organizer_name).toLowerCase();
        return title.includes(query) || desc.includes(query) || loc.includes(query) || org.includes(query);
      });
    }

    // Sort by date (upcoming first)
    return filtered.sort((a, b) => {
      const dateA = new Date(safeString(a.date)).getTime();
      const dateB = new Date(safeString(b.date)).getTime();
      const nowMs = Date.now();

      const aValid = Number.isFinite(dateA);
      const bValid = Number.isFinite(dateB);

      // invalid dates go last
      if (!aValid && bValid) return 1;
      if (aValid && !bValid) return -1;
      if (!aValid && !bValid) return 0;

      const aIsUpcoming = dateA >= nowMs;
      const bIsUpcoming = dateB >= nowMs;

      if (aIsUpcoming && !bIsUpcoming) return -1;
      if (!aIsUpcoming && bIsUpcoming) return 1;

      return aIsUpcoming ? dateA - dateB : dateB - dateA;
    });
  }, [normalizedEvents, filter, search, currentUser]);

  const getEventStats = useMemo(() => {
    const now = new Date();
    const upcoming = normalizedEvents.filter(e => {
      const d = new Date(safeString(e.date));
      return !Number.isNaN(d.getTime()) && d >= now;
    }).length;

    const past = normalizedEvents.filter(e => {
      const d = new Date(safeString(e.date));
      return !Number.isNaN(d.getTime()) && d < now;
    }).length;

    const joined = currentUser
      ? normalizedEvents.filter(e => safeArray<number>(e.attendees).includes(currentUser.id)).length
      : 0;

    return { upcoming, past, joined, total: normalizedEvents.length };
  }, [normalizedEvents, currentUser]);

  return (
    <div className="min-h-screen bg-[#18191A] text-[#E4E6EB]">
      {/* Header */}
      <div className="sticky top-14 z-10 bg-[#242526] border-b border-[#3E4042]">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Events</h1>
              <p className="text-[#B0B3B8] text-sm mt-1">
                Discover and join events in your community
              </p>
            </div>

            {currentUser && (
              <button
                onClick={onCreateEventClick}
                className="bg-[#1877F2] text-white px-4 py-2.5 rounded-lg font-medium hover:bg-[#166FE5] transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <i className="fas fa-plus"></i>
                Create Event
              </button>
            )}
          </div>

          {/* Search */}
          <div className="mt-4">
            <div className="relative">
              <i className="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-[#B0B3B8]"></i>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events by name, location, or organizer..."
                className="w-full bg-[#3A3B3C] border border-[#4E4F50] rounded-lg pl-12 pr-4 py-3 text-[#E4E6EB] placeholder-[#B0B3B8] focus:outline-none focus:border-[#1877F2]"
              />
            </div>
          </div>

          {/* Stats & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
            {/* Stats */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#3A3B3C] rounded-lg">
                <span className="text-[#1877F2] font-medium">{getEventStats.total}</span>
                <span className="text-[#B0B3B8] text-sm">Total</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#3A3B3C] rounded-lg">
                <span className="text-[#45BD62] font-medium">{getEventStats.upcoming}</span>
                <span className="text-[#B0B3B8] text-sm">Upcoming</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#3A3B3C] rounded-lg">
                <span className="text-[#F3425F] font-medium">{getEventStats.past}</span>
                <span className="text-[#B0B3B8] text-sm">Past</span>
              </div>
              {currentUser && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#3A3B3C] rounded-lg">
                  <span className="text-[#F7B928] font-medium">{getEventStats.joined}</span>
                  <span className="text-[#B0B3B8] text-sm">Joined</span>
                </div>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All Events', icon: 'fas fa-globe' },
                { key: 'upcoming', label: 'Upcoming', icon: 'fas fa-calendar-alt' },
                { key: 'past', label: 'Past Events', icon: 'fas fa-history' },
                ...(currentUser ? [{ key: 'joined', label: 'My Events', icon: 'fas fa-user-check' }] : [])
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as any)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    filter === key
                      ? 'bg-[#1877F2] text-white'
                      : 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                  }`}
                >
                  <i className={icon}></i>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                currentUser={currentUser}
                onJoinEvent={onJoinEvent}
                onInterestedEvent={onInterestedEvent}
                onProfileClick={onProfileClick}
                onFollow={onFollow}
                checkIsFollowing={checkIsFollowing}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 bg-[#3A3B3C] rounded-full flex items-center justify-center">
              <i className="fas fa-calendar-times text-4xl text-[#B0B3B8]"></i>
            </div>
            <h3 className="text-xl font-medium text-[#E4E6EB] mb-2">
              {search ? 'No events found' : 'No events available'}
            </h3>
            <p className="text-[#B0B3B8] mb-6 max-w-md mx-auto">
              {search
                ? 'Try searching with different keywords or clear your search'
                : currentUser
                ? 'Be the first to create an event!'
                : 'Sign in to see and join events'}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="px-4 py-2 bg-[#3A3B3C] text-[#E4E6EB] rounded-lg hover:bg-[#4E4F50] transition-colors"
              >
                Clear Search
              </button>
            )}
            {!currentUser && (
              <button
                onClick={() => onProfileClick(0)}
                className="px-4 py-2 bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors"
              >
                Sign In to View Events
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty State for No Events */}
      {normalizedEvents.length === 0 && currentUser && (
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="bg-[#242526] border border-[#3E4042] rounded-xl p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-[#3A3B3C] rounded-full flex items-center justify-center">
              <i className="fas fa-calendar-plus text-3xl text-[#1877F2]"></i>
            </div>
            <h3 className="text-xl font-medium text-[#E4E6EB] mb-2">No events yet</h3>
            <p className="text-[#B0B3B8] mb-6">
              Start planning your first event and invite your friends!
            </p>
            <button
              onClick={onCreateEventClick}
              className="bg-[#1877F2] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#166FE5] transition-colors inline-flex items-center gap-2"
            >
              <i className="fas fa-plus"></i>
              Create Your First Event
            </button>
          </div>
        </div>
      )}
    </div>
  );
      ...
  </div>  
};

export default EventsPage;
