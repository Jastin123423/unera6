import React, { useState, useRef, useEffect } from 'react';
import { User, Event } from '../types';

// --- Cloudflare R2 Upload Helper ---
const uploadToCloudflareR2 = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('filename', file.name);
  formData.append('type', file.type);

  const response = await fetch('/api/upload', { method: 'POST', body: formData });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed: ${response.status}`);
  }

  const result = await response.json().catch(() => ({}));
  if (!result.url) throw new Error('No URL returned from upload');

  return result.url;
};

// --- OSM LOCATION SEARCH COMPONENT ---
const LocationSearch: React.FC<{ value: string; onSelect: (val: string) => void }> = ({
  value,
  onSelect,
}) => {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<any>(null);

  useEffect(() => setQuery(value || ''), [value]);

  const handleSearch = async (q: string) => {
    const qq = (q || '').trim();
    if (qq.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          qq
        )}&addressdetails=1&limit=5`
      );
      const data = await res.json().catch(() => []);
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Location search failed', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setShowResults(true);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => handleSearch(val), 500);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2] text-sm pl-10"
          placeholder="Search city or country..."
          value={query}
          onChange={handleChange}
          onFocus={() => setShowResults(true)}
        />
        <i className="fas fa-map-marker-alt absolute left-4 top-1/2 -translate-y-1/2 text-[#B0B3B8]"></i>
        {loading && (
          <i className="fas fa-spinner fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-[#1877F2]"></i>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-[60] mt-2 bg-[#242526] border border-[#3E4042] rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
          {results.map((res, i) => (
            <div
              key={i}
              className="p-3 hover:bg-[#3A3B3C] cursor-pointer text-white text-sm border-b border-[#3E4042] last:border-0 transition-colors"
              onClick={() => {
                const label = String(res?.display_name || '').trim();
                if (!label) return;
                onSelect(label);
                setQuery(label);
                setShowResults(false);
              }}
            >
              <i className="fas fa-location-dot mr-2 text-[#B0B3B8]"></i>
              {res.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface CreateEventModalProps {
  currentUser: User;
  onClose: () => void;
  onCreate: (event: Partial<Event>) => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  currentUser,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setImageFile(f);
    const previewUrl = URL.createObjectURL(f);
    setImage(previewUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !date || !time || !location.trim()) {
      alert('Please fill all required fields');
      return;
    }

    try {
      setIsUploading(true);

      let coverUrl =
        'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1500&q=80';

      if (imageFile) {
        coverUrl = await uploadToCloudflareR2(imageFile);
      }

      const eventISO = new Date(`${date}T${time}`).toISOString();

      onCreate({
        title: title.trim(),
        description: desc.trim(),
        event_date: eventISO,
        location: location.trim(),
        cover_url: coverUrl,
        creator_id: currentUser.id,
        attendees: [currentUser.id],
        interested_ids: [],
      });

      onClose();
    } catch (error: any) {
      console.error('Failed to create event:', error);
      alert(`Failed to create event: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (image && image.startsWith('blob:')) URL.revokeObjectURL(image);
    };
  }, [image]);

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 animate-fade-in font-sans backdrop-blur-sm">
      <div className="bg-[#242526] w-full max-w-[500px] rounded-xl border border-[#3E4042] shadow-2xl flex flex-col max-h-[90vh] animate-slide-up">
        <div className="p-4 border-b border-[#3E4042] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#E4E6EB]">Create Event</h2>
          <div
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] flex items-center justify-center cursor-pointer transition-colors"
          >
            <i className="fas fa-times text-[#B0B3B8]"></i>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4">
          {/* Image Upload */}
          <div
            className="w-full h-40 bg-[#3A3B3C] rounded-lg flex flex-col items-center justify-center cursor-pointer border border-dashed border-[#B0B3B8] hover:bg-[#4E4F50] transition-colors overflow-hidden relative group"
            onClick={() => fileInputRef.current?.click()}
          >
            {image ? (
              <div className="relative w-full h-full">
                <img
                  src={image}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  alt="Event Cover"
                />
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (image.startsWith('blob:')) URL.revokeObjectURL(image);
                    setImage(null);
                    setImageFile(null);
                  }}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ) : (
              <>
                <i className="fas fa-camera text-2xl text-[#E4E6EB] mb-2 group-hover:scale-110 transition-transform"></i>
                <span className="text-[#E4E6EB] text-sm font-semibold">Add Cover Photo</span>
              </>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          <div>
            <label className="block text-[#E4E6EB] font-semibold mb-1 text-sm">Event Name</label>
            <input
              type="text"
              className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you hosting?"
            />
          </div>

          <div>
            <label className="block text-[#E4E6EB] font-semibold mb-1 text-sm">Date & Time</label>
            <div className="flex gap-2">
              <input
                type="date"
                className="flex-1 bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <input
                type="time"
                className="flex-1 bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-[#E4E6EB] font-semibold mb-1 text-sm">
              Location (Global Search)
            </label>
            <LocationSearch value={location} onSelect={setLocation} />
          </div>

          <div>
            <label className="block text-[#E4E6EB] font-semibold mb-1 text-sm">Description</label>
            <textarea
              className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2] h-24 resize-none"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Tell people more about the event..."
            />
          </div>

          <button
            type="submit"
            disabled={isUploading}
            className={`w-full bg-[#1877F2] hover:bg-[#166FE5] text-white py-3 rounded-lg font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${
              isUploading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isUploading ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Creating...
              </>
            ) : (
              <>
                <i className="fas fa-calendar-plus"></i> Create Event
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
