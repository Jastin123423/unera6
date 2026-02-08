// Events.tsx (TEST VERSION) — Minimal CreateEventModal to debug blank screens
import React, { useEffect, useMemo, useState } from 'react';
import { User, Event } from '../types';

interface CreateEventModalProps {
  currentUser: User;
  onClose: () => void;
  onCreate: (event: Partial<Event>) => Promise<void>;
}

const todayISO = () => new Date().toISOString().split('T')[0];

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  currentUser,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('12:00');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<'worldwide' | 'targeted'>('worldwide');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');

  // Prevent body scroll while modal open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const canSubmit = useMemo(() => {
    return !!title.trim() && !!date && !!time && !!location.trim() && !saving;
  }, [title, date, time, location, saving]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) return setError('Event name is required');
    if (!date) return setError('Date is required');
    if (!time) return setError('Time is required');
    if (!location.trim()) return setError('Location is required');

    setSaving(true);
    try {
      // Minimal payload: matches your backend mapping style
      const payload: Partial<Event> = {
        title: title.trim(),
        description: desc.trim(),
        event_date: new Date(`${date}T${time}:00`).toISOString(),
        event_time: time,
        location: location.trim(),
        visibility, // keep your current enum
        cover_url:
          'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1500&q=80',
        // App.tsx should attach organizerId, organizer_name, etc.
      };

      await onCreate(payload);
      onClose();
    } catch (err: any) {
      console.error('CreateEventModal test submit failed:', err);
      setError(err?.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-[520px] bg-[#242526] border border-[#3E4042] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#3E4042] flex items-center justify-between">
          <div>
            <h2 className="text-[#E4E6EB] text-lg font-bold">Create Event (Test)</h2>
            <p className="text-[#B0B3B8] text-xs mt-1">
              Signed in as: {currentUser?.name || 'User'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] grid place-items-center"
          >
            <i className="fas fa-times text-[#B0B3B8]"></i>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={submit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/15 text-red-200 text-sm">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              {error}
            </div>
          )}

          <div>
            <label className="block text-[#E4E6EB] text-sm font-semibold mb-1">
              Event name *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
              placeholder="e.g. Tech Meetup Dar"
            />
          </div>

          <div>
            <label className="block text-[#E4E6EB] text-sm font-semibold mb-1">
              Date & time *
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={saving}
                className="flex-1 bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={saving}
                className="flex-1 bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#E4E6EB] text-sm font-semibold mb-1">
              Location *
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={saving}
              className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
              placeholder="e.g. Dar es Salaam, Tanzania"
            />
            <p className="text-[#B0B3B8] text-xs mt-1">
              (Test version uses a normal input — no OSM search)
            </p>
          </div>

          <div>
            <label className="block text-[#E4E6EB] text-sm font-semibold mb-1">
              Visibility
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === 'worldwide'}
                  onChange={() => setVisibility('worldwide')}
                  disabled={saving}
                  className="accent-[#1877F2]"
                />
                <span className="text-[#E4E6EB] text-sm">Worldwide</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === 'targeted'}
                  onChange={() => setVisibility('targeted')}
                  disabled={saving}
                  className="accent-[#1877F2]"
                />
                <span className="text-[#E4E6EB] text-sm">Local only</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[#E4E6EB] text-sm font-semibold mb-1">
              Description
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              disabled={saving}
              className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2] h-24 resize-none"
              placeholder="(Optional) Details about the event..."
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
              canSubmit
                ? 'bg-[#1877F2] hover:bg-[#166FE5] text-white active:scale-[0.99]'
                : 'bg-[#3A3B3C] text-[#B0B3B8] cursor-not-allowed'
            }`}
          >
            {saving ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Creating...
              </>
            ) : (
              <>
                <i className="fas fa-calendar-plus"></i>
                Create Event
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] font-medium"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};
