// AllEvents.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { User } from "../types";
import { useNavigate } from "react-router-dom";

// ========== UNERA COLOR SYSTEM ==========
const UNERA = {
  colors: {
    primary: "#1877F2",
    secondary: "#45BD62",
    accent: "#F7B928",
    danger: "#F02849",
    bg: {
      primary: "#18191A",
      secondary: "#242526",
      tertiary: "#3A3B3C",
    },
    text: {
      primary: "#E4E6EB",
      secondary: "#B0B3B8",
      tertiary: "#8A8D91",
    },
    border: "#3E4042",
  },
};

// ========== API HELPERS (copied from Feed.tsx) ==========
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

// ========== RSVP HELPER (same as Feed.tsx) ==========
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

  const payloadStatus = {
    event_id: eventId,
    user_id: userId,
    status: newStatus,
  };

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

// ========== AVATAR HELPER (copied from Feed.tsx) ==========
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

// ========== RELATIVE TIME FORMATTER ==========
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

    // "YYYY-MM-DDTHH:mm:ss" without timezone -> force UTC
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
  id: number;
  title: string;
  description: string;
  cover_image: string;
  location: string;
  start_time: string;
  end_time?: string;
  created_at: string;
  attendees_count: number;
  interested_count: number;
  user_rsvp_status?: "" | "going" | "interested";
  creator_id: number;
  creator_name?: string;
  creator_image?: string;
  creator?: {
    id: number;
    name: string;
    username?: string;
    profile_image_url?: string;
  };
}

interface AllEventsProps {
  currentUser: User | null;
  users?: User[];
  onProfileClick: (id: number) => void;
  onEventClick: (eventId: number) => void;
  onCreateEventClick?: () => void;
}

// ========== FILTER CHIP COMPONENT ==========
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
      ${
        active
          ? "bg-[#1877F2] text-white shadow-lg shadow-[#1877F2]/20"
          : "bg-[#3A3B3C] text-[#B0B3B8] hover:bg-[#4E4F50] hover:text-[#E4E6EB]"
      }
    `}
  >
    {icon && <i className={`fas fa-${icon} text-sm`}></i>}
    {label}
  </button>
);

// ========== STATS CARD COMPONENT ==========
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

// ========== EVENT CARD COMPONENT ==========
const EventCard: React.FC<{
  event: EventFromAPI;
  currentUser: User | null;
  onEventClick: (id: number) => void;
  onProfileClick: (id: number) => void;
  onRSVPUpdate?: (
    eventId: number,
    newStatus: "" | "going" | "interested",
    newAttendees: number,
    newInterested: number
  ) => void;
}> = ({ event, currentUser, onEventClick, onProfileClick, onRSVPUpdate }) => {
  const [rsvpStatus, setRsvpStatus] = useState(event.user_rsvp_status || "");
  const [attendeesCount, setAttendeesCount] = useState(event.attendees_count || 0);
  const [interestedCount, setInterestedCount] = useState(event.interested_count || 0);
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Keep local state in sync when parent updates event list
  useEffect(() => {
    setRsvpStatus(event.user_rsvp_status || "");
  }, [event.user_rsvp_status]);

  useEffect(() => {
    setAttendeesCount(event.attendees_count || 0);
  }, [event.attendees_count]);

  useEffect(() => {
    setInterestedCount(event.interested_count || 0);
  }, [event.interested_count]);

  const dateObj = event.start_time ? new Date(event.start_time) : null;
  const endDateObj = event.end_time ? new Date(event.end_time) : null;

  const nowLocal = new Date();
  const isPast = !!dateObj && dateObj < nowLocal;

  const isToday =
    !!dateObj && dateObj.toDateString() === nowLocal.toDateString();

  // ✅ FIX: do NOT mutate dateObj (was causing "fast rotation"/changing)
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

    return dateObj.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatEventTime = () => {
    if (!dateObj) return "";
    return dateObj.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleRSVPClick = async (status: "going" | "interested") => {
    if (!currentUser) {
      alert("Please login to RSVP");
      return;
    }
    if (!event.id) return;

    setLoading(true);

    const previousStatus = rsvpStatus;
    const newStatus = previousStatus === status ? "" : status;

    // rollback snapshot
    const prevAttending = attendeesCount;
    const prevInterested = interestedCount;

    // optimistic status
    setRsvpStatus(newStatus);

    // optimistic counts
    if (status === "going") {
      if (previousStatus === "going") {
        setAttendeesCount(Math.max(0, prevAttending - 1));
      } else if (previousStatus === "interested") {
        setAttendeesCount(prevAttending + 1);
        setInterestedCount(Math.max(0, prevInterested - 1));
      } else {
        setAttendeesCount(prevAttending + 1);
      }
    } else {
      if (previousStatus === "interested") {
        setInterestedCount(Math.max(0, prevInterested - 1));
      } else if (previousStatus === "going") {
        setInterestedCount(prevInterested + 1);
        setAttendeesCount(Math.max(0, prevAttending - 1));
      } else {
        setInterestedCount(prevInterested + 1);
      }
    }

    // Compute the *intended* new counts after optimistic changes
    // (because state updates are async, we compute deterministically)
    let nextAtt = prevAttending;
    let nextInt = prevInterested;

    if (status === "going") {
      if (previousStatus === "going") nextAtt = Math.max(0, prevAttending - 1);
      else if (previousStatus === "interested") {
        nextAtt = prevAttending + 1;
        nextInt = Math.max(0, prevInterested - 1);
      } else nextAtt = prevAttending + 1;
    } else {
      if (previousStatus === "interested") nextInt = Math.max(0, prevInterested - 1);
      else if (previousStatus === "going") {
        nextInt = prevInterested + 1;
        nextAtt = Math.max(0, prevAttending - 1);
      } else nextInt = prevInterested + 1;
    }

    try {
      await rsvpEventDirect({
        eventId: event.id,
        userId: currentUser.id,
        newStatus: (newStatus || "not_going") as RSVPStatus,
        prevStatus: previousStatus as any,
      });

      if (onRSVPUpdate) {
        onRSVPUpdate(event.id, newStatus, nextAtt, nextInt);
      }
    } catch (error) {
      setRsvpStatus(previousStatus);
      setAttendeesCount(prevAttending);
      setInterestedCount(prevInterested);
      console.error("RSVP failed:", error);
      alert("Failed to RSVP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const creator = event.creator || {
    id: event.creator_id,
    name: event.creator_name || "Event Organizer",
    profile_image_url: event.creator_image,
  };

  return (
    <div
      className="bg-[#242526] rounded-xl overflow-hidden border border-[#3E4042] hover:border-[#1877F2] transition-all duration-300 cursor-pointer group"
      onClick={() => onEventClick(event.id)}
    >
      {/* Cover Image */}
      <div className="relative h-48 overflow-hidden">
        {event.cover_image && !imageError ? (
          <img
            src={event.cover_image}
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
          <div className="text-white text-[24px] font-black leading-tight">{dateObj?.getDate()}</div>
        </div>

        {/* Status Badge */}
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
        {/* Creator row */}
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

        {/* Actions */}
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
              ${
                rsvpStatus === "going"
                  ? "bg-[#45BD62] text-white hover:bg-[#3da855]"
                  : "bg-[#1877F2] text-white hover:bg-[#166FE5] hover:shadow-lg hover:shadow-[#1877F2]/20"
              }
            `}
          >
            {loading && rsvpStatus === "going" ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : rsvpStatus === "going" ? (
              "✓ Going"
            ) : (
              "Going"
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
              ${
                rsvpStatus === "interested"
                  ? "bg-[#F7B928] text-black hover:bg-[#e5aa24]"
                  : "bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]"
              }
            `}
          >
            {loading && rsvpStatus === "interested" ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : rsvpStatus === "interested" ? (
              "✓ Interested"
            ) : (
              "Interested"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ========== MAIN ALL EVENTS PAGE ==========
export const AllEvents: React.FC<AllEventsProps> = ({
  currentUser,
  users = [],
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
  const [debouncedQ, setDebouncedQ] = useState(""); // ✅ debounce search

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [stats, setStats] = useState({
    total: 0,
    upcoming: 0,
    today: 0,
    thisWeek: 0,
  });

  // ✅ Sentinel for infinite scroll (more stable than "last item ref")
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ✅ prevent multi-fire + stale responses
  const loadingRef = useRef(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // ✅ Debounce searchQuery
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const buildParams = useCallback(
    (usePage: number) => {
      const params = new URLSearchParams({
        page: String(usePage),
        limit: "12",
        filter,
        sort,
      });
      if (debouncedQ) params.set("q", debouncedQ);
      return params;
    },
    [filter, sort, debouncedQ]
  );

  /**
   * ✅ Fetch events from /api/events
   * - ignores stale responses (reqIdRef)
   * - uses reset mode correctly
   */
  const fetchEvents = useCallback(
    async (reset = false, nextPage?: number) => {
      const reqId = ++reqIdRef.current;

      const pageToLoad = typeof nextPage === "number" ? nextPage : reset ? 1 : page;

      // if already loading and not reset, don't pile requests
      if (loadingRef.current && !reset) return;

      setLoading(true);
      setError(null);

      try {
        const params = buildParams(pageToLoad);

        const response = await fetch(`/api/events?${params.toString()}`, {
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
          },
        });

        const data = await safeJson(response);

        if (reqId !== reqIdRef.current) return; // stale response, ignore

        if (!response.ok) {
          throw new Error(data?.error || data?.message || "Failed to fetch events");
        }

        const newEvents: EventFromAPI[] = (data?.events || data?.data || data || []) as any;

        setEvents((prev) => (reset ? newEvents : [...prev, ...newEvents]));
        setHasMore(Array.isArray(newEvents) && newEvents.length === 12);

        // Stats: use backend if provided, else compute from currently fetched page
        if (data?.stats) {
          setStats(data.stats);
        } else {
          const now = new Date();
          const todayStr = now.toDateString();
          const weekFromNow = new Date(now.getTime());
          weekFromNow.setDate(weekFromNow.getDate() + 7);

          const upcomingCount = (newEvents || []).filter((e: any) => new Date(e.start_time) > now).length;
          const todayCount = (newEvents || []).filter((e: any) => new Date(e.start_time).toDateString() === todayStr).length;
          const thisWeekCount = (newEvents || []).filter((e: any) => {
            const d = new Date(e.start_time);
            return d > now && d < weekFromNow;
          }).length;

          setStats({
            total: data?.total || (reset ? newEvents.length : events.length + newEvents.length),
            upcoming: upcomingCount,
            today: todayCount,
            thisWeek: thisWeekCount,
          });
        }

        // keep page state in sync when reset
        if (reset) setPage(1);
      } catch (err: any) {
        if (reqId !== reqIdRef.current) return;
        setError(err?.message || "Failed to fetch events");
        console.error("Error fetching events:", err);
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    },
    [page, buildParams, events.length]
  );

  // Handle RSVP update from card
  const handleRSVPUpdate = useCallback(
    (
      eventId: number,
      newStatus: "" | "going" | "interested",
      newAttendees: number,
      newInterested: number
    ) => {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
                ...e,
                user_rsvp_status: newStatus,
                attendees_count: newAttendees,
                interested_count: newInterested,
              }
            : e
        )
      );
    },
    []
  );

  // ✅ Initial / filter / sort / search load (reset)
  useEffect(() => {
    setEvents([]);
    setHasMore(true);
    setPage(1);
    fetchEvents(true, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sort, debouncedQ]);

  // ✅ Infinite scroll observer (sentinel)
  useEffect(() => {
    if (!hasMore) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && hasMore && !loadingRef.current) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.1 }
    );

    const el = sentinelRef.current;
    if (el) obs.observe(el);

    return () => obs.disconnect();
  }, [hasMore]);

  // ✅ Load more when page increases
  useEffect(() => {
    if (page > 1) {
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

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <StatsCard icon="calendar" label="Total Events" value={stats.total} color="#1877F2" />
            <StatsCard icon="arrow-right" label="Upcoming" value={stats.upcoming} color="#45BD62" />
            <StatsCard icon="sun" label="Today" value={stats.today} color="#F7B928" />
            <StatsCard icon="calendar-week" label="This Week" value={stats.thisWeek} color="#F02849" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search and Filters */}
        <div className="bg-[#242526] rounded-xl p-4 border border-[#3E4042] mb-6">
          {/* Search Bar */}
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

          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {filterOptions.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                icon={option.icon}
                active={filter === option.value}
                onClick={() => setFilter(option.value)}
              />
            ))}
          </div>

          {/* Sort and View Toggle */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#3E4042]">
            <div className="flex items-center gap-2">
              <span className="text-[#B0B3B8] text-sm">Sort by:</span>
              <div className="flex gap-1">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSort(option.value)}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors
                      ${
                        sort === option.value
                          ? "bg-[#1877F2] text-white"
                          : "text-[#B0B3B8] hover:bg-[#3A3B3C] hover:text-[#E4E6EB]"
                      }
                    `}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  viewMode === "grid"
                    ? "bg-[#1877F2] text-white"
                    : "text-[#B0B3B8] hover:bg-[#3A3B3C]"
                }`}
              >
                <i className="fas fa-th"></i>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  viewMode === "list"
                    ? "bg-[#1877F2] text-white"
                    : "text-[#B0B3B8] hover:bg-[#3A3B3C]"
                }`}
              >
                <i className="fas fa-list"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Events Grid/List */}
        {error ? (
          <div className="bg-[#242526] rounded-xl p-8 text-center border border-[#3E4042]">
            <i className="fas fa-exclamation-triangle text-[#F02849] text-4xl mb-3"></i>
            <p className="text-[#E4E6EB] font-bold mb-2">Failed to load events</p>
            <p className="text-[#B0B3B8] text-sm mb-4">{error}</p>
            <button
              onClick={() => fetchEvents(true, 1)}
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
                <div key={event.id}>
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

            {/* Sentinel (for infinite scroll) */}
            <div ref={sentinelRef} className="h-1" />

            {/* Loading Indicator */}
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

            {/* End of List */}
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

      {/* Floating Action Button for Mobile */}
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

// Export additional components if needed
export { EventCard, FilterChip, StatsCard };
