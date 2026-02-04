import React, { useMemo, useState } from 'react';
import { User, Event } from '../types';

interface EventsPageProps {
  currentUser: User;
  events: Event[];
  loading: boolean;
  error: string;

  onRefresh: () => void;
  onCreateEvent: (payload: Partial<Event>) => Promise<boolean>;
  onAttend: (eventId: number) => Promise<boolean>;
  onInterested: (eventId: number) => Promise<boolean>;
}

const CreateEventModal: React.FC<{
  currentUser: User;
  onClose: () => void;
  onCreate: (payload: Partial<Event>) => Promise<boolean>;
}> = ({ onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(''); // yyyy-mm-dd
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [image, setImage] = useState(''); // URL (R2 or normal)
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'worldwide' | 'targeted'>('worldwide');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!title.trim()) return setErr('Title is required');
    if (!date.trim()) return setErr('Date is required');

    setIsSubmitting(true);
    try {
      const ok = await onCreate({
        title: title.trim(),
        date,
        time,
        location,
        image,
        description,
        visibility,
      });
      if (ok) onClose();
    } catch (e: any) {
      setErr(e?.message || 'Failed to create event');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/60 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-[560px] bg-[#242526] border border-[#3E4042] rounded-t-2xl sm:rounded-2xl p-4 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold text-lg">Create Event</h2>
          <button onClick={onClose} className="text-[#B0B3B8] hover:text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {err ? (
          <div className="bg-red-500/15 border border-red-500/40 text-red-200 rounded-xl p-3 text-sm mb-3">
            {err}
          </div>
        ) : null}

        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-xl px-3 py-2 text-white outline-none focus:border-[#1877F2]"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-xl px-3 py-2 text-white outline-none focus:border-[#1877F2]"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-xl px-3 py-2 text-white outline-none focus:border-[#1877F2]"
            />
          </div>

          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-xl px-3 py-2 text-white outline-none focus:border-[#1877F2]"
          />

          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="Image URL (optional)"
            className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-xl px-3 py-2 text-white outline-none focus:border-[#1877F2]"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={4}
            className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-xl px-3 py-2 text-white outline-none focus:border-[#1877F2]"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setVisibility('worldwide')}
              className={`flex-1 px-3 py-2 rounded-xl font-bold ${
                visibility === 'worldwide'
                  ? 'bg-[#1877F2] text-white'
                  : 'bg-[#3A3B3C] text-white hover:bg-[#4E4F50]'
              }`}
            >
              Worldwide
            </button>
            <button
              onClick={() => setVisibility('targeted')}
              className={`flex-1 px-3 py-2 rounded-xl font-bold ${
                visibility === 'targeted'
                  ? 'bg-[#1877F2] text-white'
                  : 'bg-[#3A3B3C] text-white hover:bg-[#4E4F50]'
              }`}
            >
              Targeted
            </button>
          </div>

          <button
            onClick={submit}
            disabled={isSubmitting}
            className="w-full bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-60 text-white py-2.5 rounded-xl font-bold"
          >
            {isSubmitting ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const EventsPage: React.FC<EventsPageProps> = ({
  currentUser,
  events,
  loading,
  error,
  onRefresh,
  onCreateEvent,
  onAttend,
  onInterested,
}) => {
  const [showCreate, setShowCreate] = useState(false);

  const safeEvents = Array.isArray(events) ? events : [];

  const upcoming = useMemo(() => {
    return safeEvents.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [safeEvents]);

  return (
    <div className="w-full max-w-[900px] mx-auto p-4 pb-24 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">Events</h1>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="px-3 py-2 rounded-lg bg-[#3A3B3C] hover:bg-[#4E4F50] text-white font-semibold"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-2 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold"
          >
            Create
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-[#242526] border border-red-500/40 text-red-200 rounded-xl p-4 mb-4">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-[#B0B3B8] py-10 text-center">Loading events...</div>
      ) : upcoming.length === 0 ? (
        <div className="bg-[#242526] border border-[#3E4042] rounded-2xl p-10 text-center text-[#B0B3B8]">
          No events yet.
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.map((ev) => {
            const me = Number(currentUser?.id);
            const isAttending = (ev.attendees || []).includes(me);
            const isInterested = (ev.interestedIds || []).includes(me);

            return (
              <div
                key={ev.id}
                className="bg-[#242526] border border-[#3E4042] rounded-2xl overflow-hidden"
              >
                {ev.image ? (
                  <div className="h-44 bg-black">
                    <img src={ev.image} className="w-full h-full object-cover" alt="" />
                  </div>
                ) : null}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-white font-bold text-lg truncate">{ev.title}</h2>
                      <div className="text-[#B0B3B8] text-sm mt-1">
                        <span className="mr-2">
                          <i className="fas fa-calendar mr-2" />
                          {ev.date || '—'} {ev.time ? `• ${ev.time}` : ''}
                        </span>
                        {ev.location ? (
                          <span className="block mt-1">
                            <i className="fas fa-map-marker-alt mr-2" />
                            {ev.location}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-end text-xs text-[#B0B3B8]">
                      <span>{(ev.attendees || []).length} going</span>
                      <span>{(ev.interestedIds || []).length} interested</span>
                    </div>
                  </div>

                  {ev.description ? (
                    <p className="text-[#E4E6EB] text-sm mt-3 whitespace-pre-wrap">
                      {ev.description}
                    </p>
                  ) : null}

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => onAttend(ev.id)}
                      className={`flex-1 px-3 py-2 rounded-xl font-bold transition-colors ${
                        isAttending
                          ? 'bg-[#1877F2] text-white'
                          : 'bg-[#3A3B3C] hover:bg-[#4E4F50] text-white'
                      }`}
                    >
                      {isAttending ? 'Going' : 'Attend'}
                    </button>

                    <button
                      onClick={() => onInterested(ev.id)}
                      className={`flex-1 px-3 py-2 rounded-xl font-bold transition-colors ${
                        isInterested
                          ? 'bg-[#F7B928] text-black'
                          : 'bg-[#3A3B3C] hover:bg-[#4E4F50] text-white'
                      }`}
                    >
                      Interested
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate ? (
        <CreateEventModal
          currentUser={currentUser}
          onClose={() => setShowCreate(false)}
          onCreate={onCreateEvent}
        />
      ) : null}
    </div>
  );
};
