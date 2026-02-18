import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Event } from '../types';

interface AllEventsProps {
    currentUser: User | null;
    onEventClick?: (eventId: number) => void;
    onInterested?: (eventId: number) => void;
}

export const AllEvents: React.FC<AllEventsProps> = ({ 
    currentUser, 
    onEventClick,
    onInterested 
}) => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [processingEvents, setProcessingEvents] = useState<Set<number>>(new Set());

    // Fetch events with proper abort handling
    const fetchEvents = useCallback(async (pageNum: number, refresh = false) => {
        // Cancel previous request if any
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new abort controller
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            if (refresh) {
                setRefreshing(true);
            } else if (pageNum === 1) {
                setLoading(true);
            }
            
            setError(null);

            const url = `/api/events?page=${pageNum}&limit=10`;
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...(currentUser?.id ? { 'X-User-Id': String(currentUser.id) } : {})
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch events: ${response.status}`);
            }

            const data = await response.json();
            
            // Handle different response formats
            let newEvents: Event[] = [];
            if (Array.isArray(data)) {
                newEvents = data;
            } else if (data.events && Array.isArray(data.events)) {
                newEvents = data.events;
            } else if (data.data && Array.isArray(data.data)) {
                newEvents = data.data;
            }

            // Update state based on refresh or load more
            setEvents(prev => {
                if (refresh || pageNum === 1) {
                    return newEvents;
                }
                // Avoid duplicates
                const existingIds = new Set(prev.map(e => e.id));
                const uniqueNew = newEvents.filter(e => !existingIds.has(e.id));
                return [...prev, ...uniqueNew];
            });

            // Check if there are more events to load
            setHasMore(newEvents.length === 10);
            
        } catch (err: any) {
            if (err.name === 'AbortError') {
                // Ignore abort errors
                return;
            }
            console.error('Error fetching events:', err);
            setError(err.message || 'Failed to load events');
        } finally {
            if (refresh) {
                setRefreshing(false);
            } else if (pageNum === 1) {
                setLoading(false);
            }
        }
    }, [currentUser?.id]);

    // Initial fetch
    useEffect(() => {
        fetchEvents(1);

        // Cleanup on unmount
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchEvents]);

    // Handle load more
    const handleLoadMore = useCallback(() => {
        if (!loading && !refreshing && hasMore) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchEvents(nextPage);
        }
    }, [loading, refreshing, hasMore, page, fetchEvents]);

    // Handle refresh
    const handleRefresh = useCallback(() => {
        setPage(1);
        fetchEvents(1, true);
    }, [fetchEvents]);

    // Handle interested button click with debounce
    const handleInterestedClick = useCallback(async (eventId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        
        if (!currentUser) {
            alert('Please login to show interest');
            return;
        }

        // Prevent double-clicking
        if (processingEvents.has(eventId)) {
            return;
        }

        setProcessingEvents(prev => new Set(prev).add(eventId));

        try {
            // Optimistic update
            setEvents(prev => prev.map(event => {
                if (event.id === eventId) {
                    const isInterested = event.interestedIds?.includes(currentUser.id);
                    return {
                        ...event,
                        interestedIds: isInterested 
                            ? (event.interestedIds?.filter(id => id !== currentUser.id) || [])
                            : [...(event.interestedIds || []), currentUser.id]
                    };
                }
                return event;
            }));

            // Make API call
            const response = await fetch('/api/events/interested', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    event_id: eventId,
                    user_id: currentUser.id
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update interest');
            }

            // Call parent handler if provided
            if (onInterested) {
                onInterested(eventId);
            }

        } catch (err: any) {
            console.error('Error updating interest:', err);
            
            // Revert optimistic update on error
            setEvents(prev => prev.map(event => {
                if (event.id === eventId) {
                    const wasInterested = event.interestedIds?.includes(currentUser.id);
                    return {
                        ...event,
                        interestedIds: wasInterested
                            ? (event.interestedIds?.filter(id => id !== currentUser.id) || [])
                            : [...(event.interestedIds || []), currentUser.id]
                    };
                }
                return event;
            }));

            alert(err.message || 'Failed to update interest');
        } finally {
            setProcessingEvents(prev => {
                const next = new Set(prev);
                next.delete(eventId);
                return next;
            });
        }
    }, [currentUser, onInterested, processingEvents]);

    // Format date safely
    const formatEventDate = useCallback((dateStr: string) => {
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return 'Date TBD';
            
            return date.toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return 'Date TBD';
        }
    }, []);

    if (loading && events.length === 0) {
        return (
            <div className="w-full max-w-[1200px] mx-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="bg-[#242526] rounded-2xl overflow-hidden animate-pulse">
                            <div className="h-48 bg-[#3A3B3C]"></div>
                            <div className="p-6">
                                <div className="h-6 bg-[#3A3B3C] rounded mb-3 w-3/4"></div>
                                <div className="h-4 bg-[#3A3B3C] rounded mb-2 w-1/2"></div>
                                <div className="h-4 bg-[#3A3B3C] rounded mb-4 w-2/3"></div>
                                <div className="h-10 bg-[#3A3B3C] rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error && events.length === 0) {
        return (
            <div className="w-full max-w-[1200px] mx-auto p-8 text-center">
                <div className="bg-[#242526] rounded-3xl p-12 border border-[#3E4042]">
                    <i className="fas fa-exclamation-circle text-[#F02849] text-5xl mb-4"></i>
                    <h3 className="text-2xl font-bold text-[#E4E6EB] mb-2">Failed to Load Events</h3>
                    <p className="text-[#B0B3B8] mb-6">{error}</p>
                    <button 
                        onClick={handleRefresh}
                        className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-8 py-3 rounded-xl font-bold transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1200px] mx-auto p-4 font-sans pb-20 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-[#E4E6EB]">All Events</h1>
                    <p className="text-[#B0B3B8] text-lg mt-1">Discover events from around the world</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="bg-[#3A3B3C] hover:bg-[#4E4F50] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                    <i className={`fas fa-sync-alt ${refreshing ? 'animate-spin' : ''}`}></i>
                    <span>Refresh</span>
                </button>
            </div>

            {/* Events Grid */}
            {events.length === 0 ? (
                <div className="bg-[#242526] rounded-3xl p-16 text-center border border-[#3E4042]">
                    <div className="w-24 h-24 bg-[#3A3B3C] rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="fas fa-calendar-times text-5xl text-[#B0B3B8]"></i>
                    </div>
                    <h3 className="text-2xl font-bold text-[#E4E6EB] mb-2">No Events Found</h3>
                    <p className="text-[#B0B3B8] max-w-md mx-auto">
                        There are no events available at the moment. Check back later or create your own event.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.map(event => {
                        const isInterested = currentUser && event.interestedIds?.includes(currentUser.id);
                        const isProcessing = processingEvents.has(event.id);

                        return (
                            <div 
                                key={event.id}
                                onClick={() => onEventClick?.(event.id)}
                                className="bg-[#242526] rounded-2xl overflow-hidden border border-[#3E4042] hover:border-[#1877F2]/50 transition-all cursor-pointer group"
                            >
                                {/* Event Image */}
                                <div className="h-48 relative overflow-hidden">
                                    <img 
                                        src={event.image || 'https://via.placeholder.com/400x200?text=Event'} 
                                        alt={event.title}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x200?text=Event';
                                        }}
                                    />
                                    
                                    {/* Date Badge */}
                                    <div className="absolute top-4 left-4 bg-white/95 text-black rounded-xl px-3 py-2 text-center shadow-lg">
                                        <div className="text-xs font-bold uppercase text-[#1877F2]">
                                            {new Date(event.date).toLocaleString('default', { month: 'short' })}
                                        </div>
                                        <div className="text-xl font-black leading-tight">
                                            {new Date(event.date).getDate()}
                                        </div>
                                    </div>

                                    {/* Attendees Count Badge */}
                                    <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2">
                                        <i className="fas fa-users text-[#45BD62]"></i>
                                        <span>{event.attendees?.length || 0} going</span>
                                    </div>
                                </div>

                                {/* Event Details */}
                                <div className="p-6">
                                    <h3 className="text-xl font-bold text-[#E4E6EB] mb-2 line-clamp-2 group-hover:text-[#1877F2] transition-colors">
                                        {event.title}
                                    </h3>

                                    <div className="space-y-2 mb-4">
                                        {/* Date/Time */}
                                        <div className="flex items-center gap-2 text-[#B0B3B8] text-sm">
                                            <i className="fas fa-clock text-[#1877F2] w-5"></i>
                                            <span>{formatEventDate(event.date)}</span>
                                        </div>

                                        {/* Location */}
                                        <div className="flex items-center gap-2 text-[#B0B3B8] text-sm">
                                            <i className="fas fa-map-marker-alt text-[#F02849] w-5"></i>
                                            <span className="truncate">{event.location || 'Location TBD'}</span>
                                        </div>

                                        {/* Description */}
                                        {event.description && (
                                            <p className="text-[#B0B3B8] text-sm line-clamp-2 mt-2">
                                                {event.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Interested Button */}
                                    <button
                                        onClick={(e) => handleInterestedClick(event.id, e)}
                                        disabled={!currentUser || isProcessing}
                                        className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                                            isInterested
                                                ? 'bg-[#45BD62] text-white hover:bg-[#3da855]'
                                                : 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {isProcessing ? (
                                            <i className="fas fa-spinner fa-spin"></i>
                                        ) : (
                                            <>
                                                <i className={`fas ${isInterested ? 'fa-check' : 'fa-star'}`}></i>
                                                <span>{isInterested ? 'Interested' : 'Interested'}</span>
                                            </>
                                        )}
                                    </button>

                                    {/* Interested count */}
                                    {event.interestedIds && event.interestedIds.length > 0 && (
                                        <div className="mt-3 text-xs text-[#B0B3B8] text-center">
                                            {event.interestedIds.length} {event.interestedIds.length === 1 ? 'person is' : 'people are'} interested
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Load More */}
            {hasMore && events.length > 0 && (
                <div className="mt-8 text-center">
                    <button
                        onClick={handleLoadMore}
                        disabled={loading || refreshing}
                        className="bg-[#3A3B3C] hover:bg-[#4E4F50] text-white px-8 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i>
                                <span>Loading...</span>
                            </>
                        ) : (
                            <>
                                <i className="fas fa-chevron-down"></i>
                                <span>Load More Events</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Scroll to top button (appears after scrolling) */}
            {events.length > 0 && (
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="fixed bottom-24 right-8 bg-[#1877F2] text-white w-12 h-12 rounded-full shadow-lg hover:bg-[#166FE5] transition-colors flex items-center justify-center"
                    aria-label="Scroll to top"
                >
                    <i className="fas fa-arrow-up"></i>
                </button>
            )}
        </div>
    );
};

export default AllEvents;
