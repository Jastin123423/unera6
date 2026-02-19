// AllEvents.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { User } from "../types";
import { useNavigate } from "react-router-dom";

// ========== API HELPERS ==========
const authHeaders = () => {
  const token = localStorage.getItem("unera_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

const postJSON = async (url: string, body: any) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  const data = await safeJson(res);
  if (!res.ok || (data && data.success === false)) {
    throw new Error(data?.error || data?.message || `Request failed: ${url}`);
  }
  return data;
};

// ========== RSVP HELPER ==========
type RSVPStatus = "going" | "interested" | "not_going";

const rsvpEventDirect = async (args: {
  eventId: number;
  userId: number;
  newStatus: RSVPStatus;
  prevStatus?: "" | "going" | "interested";
}) => {
  const { eventId, userId, newStatus, prevStatus = "" } = args;

  const endpoint =
    newStatus === "going"
      ? "/api/attend"
      : newStatus === "interested"
        ? "/api/interested"
        : prevStatus === "interested"
          ? "/api/interested"
          : "/api/attend";

  const payloadStatus = { event_id: eventId, user_id: userId, status: newStatus };

  try {
    return await postJSON(endpoint, payloadStatus);
  } catch (e1: any) {
    const payloadAction = {
      event_id: eventId,
      user_id: userId,
      action: newStatus === "not_going" ? "remove" : "add",
    };
    try {
      return await postJSON(endpoint, payloadAction);
    } catch (e2: any) {
      throw new Error(e2?.message || e1?.message || "RSVP failed");
    }
  }
};

// ========== AVATAR HELPER ==========
const avatarFrom = (u: any) => {
  const img = String(
    u?.profile_image_url ??
      u?.profileImage ??
      u?.avatar ??
      u?.author_image ??
      u?.authorImage ??
      u?.image ??
      u?.picture ??
      ""
  ).trim();

  if (img && img !== "null" && img !== "undefined") return img;

  const label =
    String(u?.name ?? "").trim() ||
    String(u?.username ?? "").trim() ||
    String(u?.author_name ?? "").trim() ||
    String(u?.author_username ?? "").trim() ||
    "User";

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    label
  )}&background=1877F2&color=fff&bold=true`;
};

// ========== DATE HELPERS ==========
const toDateSafe = (input: any): Date | null => {
  if (!input) return null;
  if (input instanceof Date && Number.isFinite(input.getTime())) return input;

  if (typeof input === "number") {
    const ms = input < 1e12 ? input * 1000 : input;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  if (typeof input === "string") {
    const s = input.trim();

    // "YYYY-MM-DD HH:mm:ss" -> force UTC
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
      const iso = s.replace(" ", "T") + "Z";
      const d = new Date(iso);
      return Number.isFinite(d.getTime()) ? d : null;
    }

    // "YYYY-MM-DD" -> treat as local midnight
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s + "T00:00:00");
      return Number.isFinite(d.getTime()) ? d : null;
    }

    // "YYYY-MM-DDTHH:mm:ss" without tz -> force UTC
    if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) {
      const d = new Date(s + "Z");
      return Number.isFinite(d.getTime()) ? d : null;
    }

    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  return null;
};

const formatRelativeTime = (dateInput: any): string => {
  const d = toDateSafe(dateInput);
  if (!d) return "Just now";

  const now = Date.now();
  let diffMs = now - d.getTime();
  if (diffMs < 0) diffMs = 0;

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "Just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? "1 min" : `${min} mins`;

  const hrs = Math.floor(min / 60);
  if (hrs < 24) return hrs === 1 ? "1 hr" : `${hrs} hrs`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return days === 1 ? "1 day" : `${days} days`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return weeks === 1 ? "1 week" : `${weeks} weeks`;

  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "1 month" : `${months} months`;

  const years = Math.floor(days / 365);
  return years === 1 ? "1 year" : `${years} years`;
};

// ========== TYPES ==========
type EventFilter = "all" | "upcoming" | "past" | "today" | "this-week" | "this-month";
type EventSort = "date" | "popular" | "trending";

interface EventFromAPI {
  event_key: string; // "event:ID"
  id: number;
  creator_id: number;
  title: string;
  description?: string;
  event_date: string; // <-- your column
  location?: string;
  cover_url?: string; // <-- your column
  visibility: "worldwide" | "targeted";
  group_id?: number | null;
  created_at: string;

  attendees_count: number;
  interested_count: number;
  user_rsvp_status?: "" | "going" | "interested";

  creator?: {
    id: number;
    name: string;
    username?: string;
    profile_image_url?: string | null;
  };
}

interface AllEventsProps {
  currentUser: User | null;
  users?: User[];
  onProfileClick: (id: number) => void;
  onEventClick: (eventId: number) => void;
  onCreateEventClick?: () => void;
}

// ========== FILTER CHIP ==========
const FilterChip: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: string;
}> = ({ label, active, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`
      px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200
      flex items-center gap-2 whitespace-nowrap
      ${active
        ? "bg-[#1877F2] text-white shadow-lg shadow-[#1877F2]/20"
        : "bg-[#3A3B3C] text-[#B0B3B8] hover:bg-[#4E4F50] hover:text-[#E4E6EB]"
      }
    `}
  >
    {icon && <i className={`fas fa-${icon} text-sm`}></i>}
    {label}
  </button>
);

// ========== STATS CARD ==========
const StatsCard: React.FC<{
  icon: string;
  label: string;
  value: number;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div className="bg-[#242526] rounded-xl p-4 border border-[#3E4042] hover:border-[#1877F2]/30 transition-all duration-300 group">
    <div className="flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-xl bg-opacity-10 flex items-center justify-center group-hover:scale-110 transition-transform"
        style={{ backgroundColor: color + "20" }}
      >
        <i className={`fas fa-${icon} text-2xl`} style={{ color }}></i>
      </div>
      <div>
        <div className="text-[#B0B3B8] text-sm">{label}</div>
        <div className="text-[#E4E6EB] text-2xl font-black">{value.toLocaleString()}</div>
      </div>
    </div>
  </div>
);

// ========== EVENT CARD ==========
const EventCard: React.FC<{
  event: EventFromAPI;
  currentUser: User | null;
  onEventClick: (id: number) => void;
  onProfileClick: (id: number) => void;
  onRSVPUpdate?: (eventId: number, newStatus: "" | "going" | "interested", newAtt: number, newInt: number) => void;
}> = ({ event, currentUser, onEventClick, onProfileClick, onRSVPUpdate }) => {
  const [rsvpStatus, setRsvpStatus] = useState<"" | "going" | "interested">(event.user_rsvp_status || "");
  const [attendeesCount, setAttendeesCount] = useState(event.attendees_count || 0);
  const [interestedCount, setInterestedCount] = useState(event.interested_count || 0);
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => setRsvpStatus(event.user_rsvp_status || ""), [event.user_rsvp_status]);
  useEffect(() => setAttendeesCount(event.attendees_count || 0), [event.attendees_count]);
  useEffect(() => setInterestedCount(event.interested_count || 0), [event.interested_count]);

  const dateObj = toDateSafe(event.event_date);
  const nowLocal = new Date();

  const isPast = !!dateObj && dateObj < nowLocal;
  const isToday = !!dateObj && dateObj.toDateString() === nowLocal.toDateString();

  // ✅ IMPORTANT: do not mutate dateObj
  const isTomorrow = (() => {
    if (!dateObj) return false;
    const t = new Date(dateObj.getTime());
    t.setDate(t.getDate() + 1);
    return t.toDateString() === nowLocal.toDateString();
  })();

  const formatEventDate = () => {
    if (!dateObj) return "Date TBD";
    if (isToday) return "Today";
    if (isTomorrow) return "Tomorrow";
    return dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatEventTime = () => {
    if (!dateObj) return "";
    return dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const creator = event.creator || {
    id: event.creator_id,
    name: "Event Organizer",
    username: "",
    profile_image_url: null,
  };

  const handleRSVPClick = async (status: "going" | "interested") => {
    if (!currentUser) {
      alert("Please login to RSVP");
      return;
    }

    setLoading(true);

    const prevStatus = rsvpStatus;
    const nextStatus: "" | "going" | "interested" = prevStatus === status ? "" : status;

    const prevAtt = attendeesCount;
    const prevInt = interestedCount;

    // compute deterministic next counts (so we can notify parent correctly)
    let nextAtt = prevAtt;
    let nextInt = prevInt;

    if (status === "going") {
      if (prevStatus === "going") nextAtt = Math.max(0, prevAtt - 1);
      else if (prevStatus === "interested") {
        nextAtt = prevAtt + 1;
        nextInt = Math.max(0, prevInt - 1);
      } else nextAtt = prevAtt + 1;
    } else {
      if (prevStatus === "interested") nextInt = Math.max(0, prevInt - 1);
      else if (prevStatus === "going") {
        nextInt = prevInt + 1;
        nextAtt = Math.max(0, prevAtt - 1);
      } else nextInt = prevInt + 1;
    }

    // optimistic UI
    setRsvpStatus(nextStatus);
    setAttendeesCount(nextAtt);
    setInterestedCount(nextInt);

    try {
      await rsvpEventDirect({
        eventId: event.id,
        userId: currentUser.id,
        newStatus: (nextStatus || "not_going") as RSVPStatus,
        prevStatus: prevStatus as any,
      });

      onRSVPUpdate?.(event.id, nextStatus, nextAtt, nextInt);
    } catch (err) {
      // rollback
      setRsvpStatus(prevStatus);
      setAttendeesCount(prevAtt);
      setInterestedCount(prevInt);
      console.error("RSVP failed:", err);
      alert("Failed to RSVP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="bg-[#242526] rounded-xl overflow-hidden border border-[#3E4042] hover:border-[#1877F2] transition-all duration-300 cursor-pointer group"
      onClick={() => onEventClick(event.id)}
    >
      {/* Cover */}
      <div className="relative h-48 overflow-hidden">
        {event.cover_url && !imageError ? (
          <img
            src={event.cover_url}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1877F2] to-[#45BD62] flex items-center justify-center">
            <i className="fas fa-calendar text-white/30 text-6xl"></i>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Date Badge */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
          <div className="text-[#F7B928] text-[11px] font-black uppercase">
            {dateObj?.toLocaleDateString("en-US", { month: "short" })}
          </div>
          <div className="text-white text-[24px] font-black leading-tight">
            {dateObj?.getDate()}
          </div>
        </div>

        {/* Status */}
        {isPast ? (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 border border-white/20">
            <span className="text-[#B0B3B8] text-xs font-semibold">Past Event</span>
          </div>
        ) : (
          <div className="absolute top-3 right-3 bg-[#45BD62]/90 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-white text-xs font-semibold">Upcoming</span>
          </div>
        )}

        {/* Going count */}
        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1">
          <div className="flex items-center gap-2">
            <i className="fas fa-users text-[#45BD62] text-xs"></i>
            <span className="text-white text-xs font-semibold">{attendeesCount} going</span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-4">
        {/* Creator */}
        <div
          className="flex items-center gap-2 mb-3 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            if (creator.id) onProfileClick(creator.id);
          }}
        >
          <img
            src={avatarFrom(creator)}
            alt=""
            className="w-6 h-6 rounded-full object-cover border border-[#3E4042]"
          />
          <span className="text-[#B0B3B8] text-xs hover:underline">
            {creator.name || "Event Organizer"}
          </span>
          <span className="text-[#3E4042] text-xs">•</span>
          <span className="text-[#B0B3B8] text-xs">{formatRelativeTime(event.created_at)}</span>
        </div>

        <h3 className="text-[#E4E6EB] font-black text-[18px] mb-2 line-clamp-2 group-hover:text-[#1877F2] transition-colors">
          {event.title}
        </h3>

        {event.description && (
          <p className="text-[#B0B3B8] text-sm mb-3 line-clamp-2">{event.description}</p>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-[#B0B3B8] text-xs">
            <i className={`fas fa-calendar-alt w-4 ${isPast ? "text-[#B0B3B8]" : "text-[#1877F2]"}`}></i>
            <span>
              {formatEventDate()}
              {formatEventTime() && ` at ${formatEventTime()}`}
            </span>
          </div>

          {event.location && (
            <div className="flex items-center gap-2 text-[#B0B3B8] text-xs">
              <i className="fas fa-map-marker-alt w-4 text-[#F02849]"></i>
              <span className="line-clamp-1">{event.location}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-[#B0B3B8] text-xs">
            <i className="fas fa-user-friends w-4 text-[#45BD62]"></i>
            <span>
              {attendeesCount} attending • {interestedCount} interested
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            disabled={loading || isPast}
            onClick={(e) => {
              e.stopPropagation();
              handleRSVPClick("going");
            }}
            className={`
              flex-1 py-2.5 rounded-lg font-bold text-sm transition-all duration-200
              ${isPast ? "opacity-50 cursor-not-allowed" : ""}
              ${rsvpStatus === "going"
                ? "bg-[#45BD62] text-white hover:bg-[#3da855]"
                : "bg-[#1877F2] text-white hover:bg-[#166FE5] hover:shadow-lg hover:shadow-[#1877F2]/20"
              }
            `}
          >
            {loading && rsvpStatus === "going" ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              rsvpStatus === "going" ? "✓ Going" : "Going"
            )}
          </button>

          <button
            disabled={loading || isPast}
            onClick={(e) => {
              e.stopPropagation();
              handleRSVPClick("interested");
            }}
            className={`
              flex-1 py-2.5 rounded-lg font-bold text-sm transition-all duration-200
              ${isPast ? "opacity-50 cursor-not-allowed" : ""}
              ${rsvpStatus === "interested"
                ? "bg-[#F7B928] text-black hover:bg-[#e5aa24]"
                : "bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]"
              }
            `}
          >
            {loading && rsvpStatus === "interested" ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              rsvpStatus === "interested" ? "✓ Interested" : "Interested"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ========== MAIN PAGE ==========
export const AllEvents: React.FC<AllEventsProps> = ({
  currentUser,
  onProfileClick,
  onEventClick,
  onCreateEventClick,
}) => {
  const navigate = useNavigate();

  const [events, setEvents] = useState<EventFromAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<EventFilter>("upcoming");
  const [sort, setSort] = useState<EventSort>("date");

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [stats, setStats] = useState({ total: 0, upcoming: 0, today: 0, thisWeek: 0 });

  // infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ✅ FIX 1: Add lock refs to prevent observer spam
  const fetchingMoreRef = useRef(false);
  const loadingRef = useRef(false);
  const reqIdRef = useRef(0);
  
  // ✅ FIX 4: Add didInitRef to prevent multiple initial fetches when user state stabilizes
  const didInitRef = useRef(false);
  
  // ✅ FIX 5: Track previous user ID to detect actual changes
  const prevUserIdRef = useRef<number | undefined>(undefined);

  // Keep loadingRef in sync with loading state
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchEvents = useCallback(
    async (reset = false, nextPage?: number) => {
      const reqId = ++reqIdRef.current;

      const pageToLoad = typeof nextPage === "number" ? nextPage : reset ? 1 : page;
      
      // ✅ FIX 1: Lock check to prevent multiple simultaneous fetches
      if (!reset) {
        if (fetchingMoreRef.current) {
          console.log("Already fetching more, skipping...");
          return; // already loading next page
        }
        fetchingMoreRef.current = true;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(pageToLoad),
          limit: "12",
          filter,
          sort,
        });

        if (debouncedQ) params.set("q", debouncedQ);
        if (currentUser?.id) params.set("user_id", String(currentUser.id));

        console.log(`Fetching page ${pageToLoad}, reset: ${reset}`);

        const res = await fetch(`/api/events_feeds?${params.toString()}`, {
          headers: { ...authHeaders(), "Content-Type": "application/json" },
        });

        // ✅ FIX 4: Handle 401 properly - stop infinite scroll
        if (res.status === 401) {
          setHasMore(false);
          throw new Error("Session expired. Please login again.");
        }

        const data = await safeJson(res);
        if (reqId !== reqIdRef.current) return;

        if (!res.ok || data?.success === false) {
          throw new Error(data?.error || data?.message || "Failed to fetch events");
        }

        const newEvents: EventFromAPI[] = (data?.events || []) as any;

        setEvents((prev) => {
          if (reset) return newEvents;
          // ✅ Prevent duplicate events by using a Set based on ID
          const existingIds = new Set(prev.map(e => e.id));
          const uniqueNewEvents = newEvents.filter(e => !existingIds.has(e.id));
          return [...prev, ...uniqueNewEvents];
        });
        
        // ✅ FIX 3: Better hasMore detection
        setHasMore(!!data?.has_more || newEvents.length === 12);

        if (data?.stats) setStats(data.stats);

        if (reset) setPage(1);
      } catch (e: any) {
        if (reqId !== reqIdRef.current) return;
        setError(e?.message || "Failed to load events");
        console.error("Fetch error:", e);
      } finally {
        if (reqId === reqIdRef.current) {
          setLoading(false);
          // ✅ FIX 1: Release lock when done
          if (!reset) {
            // Small delay to prevent immediate retrigger
            setTimeout(() => {
              fetchingMoreRef.current = false;
            }, 100);
          }
        }
      }
    },
    [page, filter, sort, debouncedQ, currentUser?.id]
  );

  const handleRSVPUpdate = useCallback(
    (eventId: number, newStatus: "" | "going" | "interested", newAtt: number, newInt: number) => {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, user_rsvp_status: newStatus, attendees_count: newAtt, interested_count: newInt }
            : e
        )
      );
    },
    []
  );

  // ✅ FIX 2: Initial fetch only once when user state stabilizes
  useEffect(() => {
    // Wait until user status is known (either logged in and has id, or definitely not logged in)
    if (currentUser && !currentUser.id) return;
    
    // Check if user ID actually changed to prevent unnecessary resets
    const currentUserId = currentUser?.id;
    if (prevUserIdRef.current === currentUserId && didInitRef.current) {
      return; // User ID hasn't changed, no need to re-fetch
    }
    
    // Update the ref with current user ID
    prevUserIdRef.current = currentUserId;
    
    // If we've already initialized and user ID is the same, don't fetch again
    if (didInitRef.current && prevUserIdRef.current === currentUserId) {
      return;
    }

    console.log("Initializing fetch with user:", currentUserId);
    didInitRef.current = true;
    setEvents([]);
    setHasMore(true);
    setPage(1);
    fetchEvents(true, 1);
  }, [currentUser?.id]); // Only depend on user ID, not the whole user object

  // ✅ FIX 3: Reset on filter/sort/search changes with proper cleanup
  useEffect(() => {
    // Skip if we haven't initialized yet
    if (!didInitRef.current) return;
    
    console.log("Filter/sort/search changed, resetting...");
    setEvents([]);
    setHasMore(true);
    setPage(1);
    fetchEvents(true, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sort, debouncedQ]); // Remove currentUser?.id from here

  // ✅ FIX 1 & 2: Fixed observer with proper guards and rootMargin
  useEffect(() => {
    if (!hasMore) return;

    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;

        // ✅ Hard guards to prevent spam
        if (loadingRef.current) {
          console.log("Observer: loading in progress");
          return;
        }
        if (fetchingMoreRef.current) {
          console.log("Observer: already fetching more");
          return;
        }
        if (!hasMore) {
          console.log("Observer: no more pages");
          return;
        }

        console.log("Observer triggered, loading next page");
        setPage((p) => p + 1);
      },
      {
        threshold: 0.1,
        // ✅ Large rootMargin to trigger before reaching bottom and reduce jitter
        rootMargin: "400px 0px 400px 0px",
      }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore]); // Only recreate when hasMore changes

  // load more pages
  useEffect(() => {
    if (page > 1) {
      console.log(`Loading page ${page}`);
      fetchEvents(false, page);
    }
  }, [page, fetchEvents]);

  const filterOptions: { value: EventFilter; label: string; icon: string }[] = [
    { value: "all", label: "All Events", icon: "calendar" },
    { value: "upcoming", label: "Upcoming", icon: "arrow-right" },
    { value: "today", label: "Today", icon: "sun" },
    { value: "this-week", label: "This Week", icon: "calendar-week" },
    { value: "this-month", label: "This Month", icon: "calendar-alt" },
    { value: "past", label: "Past Events", icon: "history" },
  ];

  const sortOptions: { value: EventSort; label: string }[] = [
    { value: "date", label: "Date" },
    { value: "popular", label: "Most Popular" },
    { value: "trending", label: "Trending" },
  ];

  return (
    <div className="min-h-screen bg-[#18191A] font-sans">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#242526] border-b border-[#3E4042] backdrop-blur-lg bg-opacity-90">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-full hover:bg-[#3A3B3C] flex items-center justify-center transition-colors"
              >
                <i className="fas fa-arrow-left text-[#E4E6EB] text-xl"></i>
              </button>
              <h1 className="text-[#E4E6EB] text-[28px] font-black">Events</h1>
            </div>

            {currentUser && (
              <button
                onClick={onCreateEventClick}
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-[#1877F2]/20"
              >
                <i className="fas fa-plus"></i>
                <span>Create Event</span>
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <StatsCard icon="calendar" label="Total Events" value={stats.total} color="#1877F2" />
            <StatsCard icon="arrow-right" label="Upcoming" value={stats.upcoming} color="#45BD62" />
            <StatsCard icon="sun" label="Today" value={stats.today} color="#F7B928" />
            <StatsCard icon="calendar-week" label="This Week" value={stats.thisWeek} color="#F02849" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search + filters */}
        <div className="bg-[#242526] rounded-xl p-4 border border-[#3E4042] mb-6">
          <div className="relative mb-4">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#B0B3B8] text-sm"></i>
            <input
              type="text"
              placeholder="Search events by title, location, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#3A3B3C] text-[#E4E6EB] placeholder-[#B0B3B8] rounded-xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#1877F2] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#B0B3B8] hover:text-[#E4E6EB]"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {filterOptions.map((o) => (
              <FilterChip
                key={o.value}
                label={o.label}
                icon={o.icon}
                active={filter === o.value}
                onClick={() => setFilter(o.value)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#3E4042]">
            <div className="flex items-center gap-2">
              <span className="text-[#B0B3B8] text-sm">Sort by:</span>
              <div className="flex gap-1">
                {sortOptions.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setSort(o.value)}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors
                      ${sort === o.value
                        ? "bg-[#1877F2] text-white"
                        : "text-[#B0B3B8] hover:bg-[#3A3B3C] hover:text-[#E4E6EB]"
                      }
                    `}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  viewMode === "grid" ? "bg-[#1877F2] text-white" : "text-[#B0B3B8] hover:bg-[#3A3B3C]"
                }`}
              >
                <i className="fas fa-th"></i>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  viewMode === "list" ? "bg-[#1877F2] text-white" : "text-[#B0B3B8] hover:bg-[#3A3B3C]"
                }`}
              >
                <i className="fas fa-list"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        {error ? (
          <div className="bg-[#242526] rounded-xl p-8 text-center border border-[#3E4042]">
            <i className="fas fa-exclamation-triangle text-[#F02849] text-4xl mb-3"></i>
            <p className="text-[#E4E6EB] font-bold mb-2">Failed to load events</p>
            <p className="text-[#B0B3B8] text-sm mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchEvents(true, 1);
              }}
              className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : events.length === 0 && !loading ? (
          <div className="bg-[#242526] rounded-xl p-12 text-center border border-[#3E4042]">
            <div className="w-20 h-20 bg-[#3A3B3C] rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-calendar text-[#1877F2] text-3xl"></i>
            </div>
            <h3 className="text-[#E4E6EB] text-xl font-black mb-2">No events found</h3>
            <p className="text-[#B0B3B8] mb-6">
              {searchQuery ? `No events matching "${searchQuery}"` : "There are no events to display at the moment."}
            </p>
            {currentUser && (
              <button
                onClick={onCreateEventClick}
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors"
              >
                Create Your First Event
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  : "space-y-4"
              }
            >
              {events.map((event) => (
                <div key={event.event_key || `event:${event.id}`}>
                  <EventCard
                    event={event}
                    currentUser={currentUser}
                    onEventClick={onEventClick}
                    onProfileClick={onProfileClick}
                    onRSVPUpdate={handleRSVPUpdate}
                  />
                </div>
              ))}
            </div>

            {/* Sentinel */}
            <div ref={sentinelRef} className="h-1" />

            {/* Loading */}
            {loading && (
              <div className="flex justify-center py-8">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-[#3A3B3C] border-t-[#1877F2] animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-[#1877F2] rounded-full animate-ping"></div>
                  </div>
                </div>
              </div>
            )}

            {/* End */}
            {!hasMore && events.length > 0 && (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-2 bg-[#242526] px-4 py-2 rounded-full border border-[#3E4042]">
                  <i className="fas fa-check-circle text-[#45BD62]"></i>
                  <span className="text-[#B0B3B8] text-sm">You've seen all events</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      {currentUser && (
        <button
          onClick={onCreateEventClick}
          className="fixed bottom-6 right-6 md:hidden w-14 h-14 bg-[#1877F2] rounded-full shadow-lg shadow-[#1877F2]/30 flex items-center justify-center hover:bg-[#166FE5] transition-all hover:scale-110 z-50"
        >
          <i className="fas fa-plus text-white text-xl"></i>
        </button>
      )}
    </div>
  );
};

export { EventCard, FilterChip, StatsCard };
