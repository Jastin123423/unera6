/* =========================================================
   UPLOAD MODAL
========================================================= */

interface AudioUploadModalProps {
  currentUser: User;
  onClose: () => void;
  onUploaded: () => void;
}

const AudioUploadModal: React.FC<AudioUploadModalProps> = ({ currentUser, onClose, onUploaded }) => {
  const [mode, setMode] = useState<'single' | 'album' | 'podcast'>('single');
  const [artist, setArtist] = useState((currentUser as any).name || (currentUser as any).username || '');
  const [genre, setGenre] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const [albumTitle, setAlbumTitle] = useState('');
  const [albumTracks, setAlbumTracks] = useState<{ title: string; file: File; cover?: string; artist?: string }[]>([]);
  const [season, setSeason] = useState('');
  const [episodeNum, setEpisodeNum] = useState('');
  const [guests, setGuests] = useState('');

  const [tempTrackTitle, setTempTrackTitle] = useState('');
  const [tempTrackArtist, setTempTrackArtist] = useState(artist);
  const [tempTrackFile, setTempTrackFile] = useState<File | null>(null);
  const [tempTrackCover, setTempTrackCover] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const trackInputRef = useRef<HTMLInputElement>(null);

  const defaultCover = DEFAULT_MUSIC_COVER;

  const handleAddTrack = () => {
    if (!tempTrackTitle || !tempTrackFile) {
      alert('Track title and audio file are required.');
      return;
    }
    setAlbumTracks((prev) => [...prev, { title: tempTrackTitle, artist: tempTrackArtist, file: tempTrackFile, cover: tempTrackCover }]);
    setTempTrackTitle('');
    setTempTrackFile(null);
    setTempTrackCover('');
  };

  const uploadToR2 = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);

    const up = await apiForm<{ success: boolean; url: string; key: string }>(
      "/api/upload",
      fd
    );

    if (!up.success) throw new Error(up.error || "Upload failed");
    if (!(up.data as any)?.url) throw new Error("Upload failed: missing url");
    return (up.data as any).url as string;
  };

  const uploadSingle = async (type: "music" | "podcast") => {
    if (!title.trim()) return alert("Title required");
    if (!audioFile) return alert("Audio file required");

    setSubmitting(true);
    try {
      const audioUrl = await uploadToR2(audioFile);
      const coverUrl = coverFile ? await uploadToR2(coverFile) : null;

      if (type === "music") {
        const finalCoverUrl = coverUrl || DEFAULT_MUSIC_COVER;
        
        const payload = {
          uploader_id: Number((currentUser as any).id),
          title: title.trim(),
          artist_name: (artist || "").trim(),
          album_name: "Single",
          cover_image_url: finalCoverUrl,
          audio_url: audioUrl,
          duration_seconds: null,
          genre: (genre || "").trim() || null,
        };

        const res = await apiJson<any>("/api/songs", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!res.success) {
          console.error("songs create failed:", res);
          alert(res.error || "Failed to publish song");
          return;
        }
      } else {
        if (!desc.trim()) return alert("Description required for podcast");

        const finalCoverUrl = coverUrl || DEFAULT_PODCAST_COVER;
        
        const payload = {
          creator_id: Number((currentUser as any).id),
          title: title.trim(),
          description: desc.trim(),
          audio_url: audioUrl,
          cover_url: finalCoverUrl,
        };

        const res = await apiJson<any>("/api/podcasts", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!res.success) {
          console.error("podcast create failed:", res);
          alert(res.error || "Failed to publish podcast");
          return;
        }
      }

      alert('Published successfully!');
      onUploaded();
      onClose();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadAlbum = async () => {
    if (!albumTitle.trim()) return alert("Album title required");
    if (albumTracks.length === 0) return alert("Add at least 1 track");

    setSubmitting(true);
    try {
      const sharedCoverUrl = coverFile ? await uploadToR2(coverFile) : null;

      for (const t of albumTracks) {
        const audioUrl = await uploadToR2(t.file);
        const coverUrl = t.cover?.trim() ? t.cover.trim() : (sharedCoverUrl || DEFAULT_MUSIC_COVER);

        const payload = {
          uploader_id: Number((currentUser as any).id),
          title: (t.title || "").trim(),
          artist_name: (t.artist || artist || "").trim(),
          album_name: albumTitle.trim(),
          cover_image_url: coverUrl,
          audio_url: audioUrl,
          duration_seconds: null,
          genre: (genre || "").trim() || null,
        };

        const res = await apiJson<any>("/api/songs", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!res.success) {
          console.error("album track create failed:", t.title, res);
          alert(`Failed uploading "${t.title}": ${res.error}`);
          return;
        }
      }

      alert('Album published successfully!');
      onUploaded();
      onClose();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Album upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (mode === 'single') await uploadSingle('music');
    if (mode === 'podcast') await uploadSingle('podcast');
    if (mode === 'album') await uploadAlbum();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4">
      <div className="bg-[#1E1E1E] rounded-2xl w-full max-w-3xl border border-[#333] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-[#333] bg-[#252525]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-[#FFF] text-2xl font-bold">Professional Upload</h2>
              <p className="text-[#888] text-sm">Distribute your content to UNERA Music</p>
            </div>
            <i className="fas fa-times text-[#888] cursor-pointer text-xl hover:text-white transition-colors" onClick={onClose}></i>
          </div>

          <div className="flex p-1 bg-[#111] rounded-lg">
            {['single', 'album', 'podcast'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m as any)}
                className={`flex-1 py-2.5 rounded-md font-bold capitalize text-sm transition-all ${
                  mode === m ? 'bg-[#1877F2] text-white shadow-lg' : 'text-[#888] hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">
                  {mode === 'podcast' ? 'Host / Creator Name' : 'Main Artist Name'}
                </label>
                <input
                  className="w-full bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#1877F2]"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Genre / Category</label>
                <input
                  className="w-full bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#1877F2]"
                  placeholder="Pop, Tech, News..."
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">{mode === 'album' ? 'Album Artwork' : 'Artwork'}</label>
                <div
                  onClick={() => coverInputRef.current?.click()}
                  className="w-full bg-[#151515] border border-[#333] rounded-lg h-[120px] flex flex-col items-center justify-center cursor-pointer hover:border-[#1877F2] group relative overflow-hidden"
                >
                  {coverPreview ? (
                    <img src={coverPreview} className="w-full h-full object-cover" alt="Cover Preview" />
                  ) : (
                    <>
                      <i className="fas fa-image text-2xl text-[#666] group-hover:text-white mb-2"></i>
                      <span className="text-[#666] text-xs group-hover:text-white">Upload Image (Optional)</span>
                      <span className="text-[#666] text-xs group-hover:text-white mt-1">Default will be used if none</span>
                    </>
                  )}

                  <input
                    type="file"
                    ref={coverInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setCoverFile(f);
                        setCoverPreview(URL.createObjectURL(f));
                      }
                    }}
                  />
                </div>
              </div>

              {(mode === 'single' || mode === 'podcast') && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#333] bg-[#151515] rounded-lg h-[86px] flex items-center justify-center cursor-pointer hover:border-[#1877F2] group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="audio/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setAudioFile(f);
                    }}
                  />
                  {audioFile ? (
                    <div className="text-[#1877F2] font-semibold flex items-center gap-2">
                      <i className="fas fa-check-circle"></i> {audioFile.name}
                    </div>
                  ) : (
                    <div className="text-[#666] group-hover:text-white flex items-center gap-2">
                      <i className="fas fa-cloud-upload-alt"></i> Upload High Quality Audio
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#333] pt-6">
            {mode === 'single' && (
              <div>
                <label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Song Name</label>
                <input
                  className="w-full bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#1877F2] text-lg font-bold"
                  placeholder="Enter song title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            )}

            {mode === 'podcast' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Episode Title</label>
                  <input
                    className="w-full bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#1877F2] text-lg font-bold"
                    placeholder="e.g. The Future of AI"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <input className="bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none" placeholder="Season (e.g. 1)" value={season} onChange={(e) => setSeason(e.target.value)} />
                  <input className="bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none" placeholder="Episode # (e.g. 5)" value={episodeNum} onChange={(e) => setEpisodeNum(e.target.value)} />
                  <input className="bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none" placeholder="Guest Names" value={guests} onChange={(e) => setGuests(e.target.value)} />
                </div>

                <div>
                  <label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Description / Show Notes</label>
                  <textarea
                    className="w-full bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#1877F2] h-60 resize-none"
                    placeholder="Write a professional description about this episode..."
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                  />
                </div>
              </div>
            )}

            {mode === 'album' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[#888] text-xs font-bold mb-1.5 uppercase">Album Name</label>
                  <input
                    className="w-full bg-[#151515] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#1877F2] text-lg font-bold"
                    placeholder="Enter album title..."
                    value={albumTitle}
                    onChange={(e) => setAlbumTitle(e.target.value)}
                  />
                </div>

                <div className="bg-[#111] p-4 rounded-xl border border-[#333]">
                  <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                    <i className="fas fa-list-ol text-[#1877F2]"></i> Add Tracks to Album
                  </h4>

                  <div className="space-y-2 mb-4">
                    {albumTracks.map((t, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded border border-[#333]">
                        <div className="flex items-center gap-3">
                          <span className="text-[#666] font-mono">{idx + 1}</span>
                          <img src={t.cover || coverPreview || DEFAULT_MUSIC_COVER} className="w-8 h-8 rounded object-cover" alt="" />
                          <div>
                            <span className="text-white font-semibold block">{t.title}</span>
                            <span className="text-[#666] text-xs">{t.artist}</span>
                          </div>
                        </div>
                        <i className="fas fa-trash text-red-500 cursor-pointer" onClick={() => setAlbumTracks(albumTracks.filter((_, i) => i !== idx))}></i>
                      </div>
                    ))}
                    {albumTracks.length === 0 && <div className="text-[#666] text-sm text-center py-2">No tracks added yet.</div>}
                  </div>

                  <div className="flex flex-col gap-2 p-3 bg-[#1A1A1A] rounded border border-[#333] border-dashed">
                    <div className="grid grid-cols-2 gap-2">
                      <input className="bg-[#151515] border border-[#333] p-2 rounded text-white text-sm" placeholder="Song Name" value={tempTrackTitle} onChange={(e) => setTempTrackTitle(e.target.value)} />
                      <input className="bg-[#151515] border border-[#333] p-2 rounded text-white text-sm" placeholder="Artist Name" value={tempTrackArtist} onChange={(e) => setTempTrackArtist(e.target.value)} />
                    </div>

                    <input className="w-full bg-[#151515] border border-[#333] p-2 rounded text-white text-sm" placeholder="Specific Artwork URL (Optional)" value={tempTrackCover} onChange={(e) => setTempTrackCover(e.target.value)} />

                    <div className="flex items-center gap-2 mt-2">
                      <div
                        onClick={() => trackInputRef.current?.click()}
                        className="flex-1 bg-[#222] hover:bg-[#333] p-2 rounded text-center cursor-pointer text-sm text-[#888] hover:text-white transition-colors border border-[#444]"
                      >
                        {tempTrackFile ? (
                          <span className="text-[#1877F2] font-bold">
                            <i className="fas fa-file-audio"></i> {tempTrackFile.name}
                          </span>
                        ) : (
                          'Select Audio File'
                        )}
                      </div>

                      <button onClick={handleAddTrack} className="bg-[#1877F2] text-white px-6 py-2 rounded text-sm font-bold hover:bg-[#166FE5]">
                        Add Track
                      </button>
                    </div>

                    <input
                      type="file"
                      ref={trackInputRef}
                      className="hidden"
                      accept="audio/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setTempTrackFile(f);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-[#333] bg-[#252525] flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-60 text-white py-3 px-8 rounded-xl font-bold transition-all shadow-lg text-lg flex items-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Publishing...
              </>
            ) : (
              <>
                <i className="fas fa-cloud-upload-alt"></i> Publish Content
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   API HELPER FUNCTIONS FOR PLAYS AND LIKES
========================================================= */

async function recordSongPlay(songId: string, userId: any) {
  try {
    const a = await apiJson<any>(`/api/songs/${encodeURIComponent(songId)}/play`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId ?? null }),
    });
    if (a.success) return a.data;
  } catch (error) {
    console.warn('New play endpoint failed, trying fallback...');
  }

  try {
    const b = await apiJson<any>(`/api/song-plays`, {
      method: "POST",
      body: JSON.stringify({ song_id: songId, user_id: userId ?? null }),
    });
    return b.success ? b.data : null;
  } catch (error) {
    console.error('All play endpoints failed:', error);
    return null;
  }
}

async function recordEpisodePlay(episodeId: string, userId: any) {
  try {
    const a = await apiJson<any>(`/api/podcasts/${encodeURIComponent(episodeId)}/play`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId ?? null }),
    });
    if (a.success) return a.data;
  } catch (error) {
    console.warn('New podcast play endpoint failed, trying fallback...');
  }

  try {
    const b = await apiJson<any>(`/api/podcast-episode-plays`, {
      method: "POST",
      body: JSON.stringify({ episode_id: episodeId, user_id: userId ?? null }),
    });
    return b.success ? b.data : null;
  } catch (error) {
    console.error('All podcast play endpoints failed:', error);
    return null;
  }
}

async function toggleSongLike(songId: string, userId: any, method: 'POST' | 'DELETE' = 'POST') {
  try {
    const a = await apiJson<any>(`/api/songs/${encodeURIComponent(songId)}/like`, {
      method: method,
      body: JSON.stringify({ user_id: userId }),
    });
    if (a.success) return a.data;
  } catch (error) {
    console.warn('New like endpoint failed, trying fallback...');
  }

  try {
    const endpoint = method === 'DELETE' 
      ? `/api/song-likes?song_id=${encodeURIComponent(songId)}&user_id=${encodeURIComponent(userId)}`
      : '/api/song-likes';
    
    const b = await apiJson<any>(endpoint, {
      method: method,
      body: method === 'DELETE' ? undefined : JSON.stringify({ song_id: songId, user_id: userId }),
    });
    return b.success ? b.data : null;
  } catch (error) {
    console.error('All like endpoints failed:', error);
    return null;
  }
}

async function toggleEpisodeLike(episodeId: string, userId: any, method: 'POST' | 'DELETE' = 'POST') {
  try {
    const a = await apiJson<any>(`/api/podcasts/${encodeURIComponent(episodeId)}/like`, {
      method: method,
      body: JSON.stringify({ user_id: userId }),
    });
    if (a.success) return a.data;
  } catch (error) {
    console.warn('New podcast like endpoint failed, trying fallback...');
  }

  try {
    const endpoint = method === 'DELETE'
      ? `/api/podcast-episode-likes?episode_id=${encodeURIComponent(episodeId)}&user_id=${encodeURIComponent(userId)}`
      : '/api/podcast-episode-likes';
    
    const b = await apiJson<any>(endpoint, {
      method: method,
      body: method === 'DELETE' ? undefined : JSON.stringify({ episode_id: episodeId, user_id: userId }),
    });
    return b.success ? b.data : null;
  } catch (error) {
    console.error('All podcast like endpoints failed:', error);
    return null;
  }
}

async function reactToItem(itemId: string, type: 'music' | 'podcast', userId: number, reactionType: string) {
  const endpoint = type === 'music'
    ? `/api/songs/${itemId}/react`
    : `/api/podcasts/${itemId}/react`;
  
  return apiJson<any>(endpoint, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, type: reactionType }),
  });
}

/* =========================================================
   MAIN MUSIC SYSTEM (MODERN FEED LAYOUT)
========================================================= */

interface MusicSystemProps {
  currentUser: User | null;
  onPlayTrack: (track: AudioTrack) => void;
  onProfileClick?: (id: number) => void;
  likedTracks: string[];
  onToggleLike: (key: string, liked: boolean) => void;
  playHistory: AudioTrack[];
  onFollow: (userId: number) => Promise<void>;
  checkIsFollowing: (userId: number) => boolean;
  users?: User[];
  currentTrack?: AudioTrack | null;
  isPlaying?: boolean;
  myTotalPlays?: number;
  playsLoading?: boolean;
}

const MusicSystem: React.FC<MusicSystemProps> = ({ 
  currentUser, 
  onPlayTrack, 
  onProfileClick, 
  likedTracks: initialLikedTracks, 
  onToggleLike,
  playHistory,
  onFollow,
  checkIsFollowing,
  users = [],
  currentTrack,
  isPlaying,
  myTotalPlays = 0,
  playsLoading = false
}) => {
  const [view, setView] = useState<'music' | 'podcasts' | 'dashboard' | 'artist'>('music');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);

  const [songs, setSongs] = useState<Song[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [likedTracks, setLikedTracks] = useState<string[]>(initialLikedTracks);
  const [downloads, setDownloads] = useState<string[]>([]);

  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // State for track reactions/comments/shares
  const [trackReactions, setTrackReactions] = useState<Record<string, { count: number; myReaction?: ReactionType }>>({});
  const [trackComments, setTrackComments] = useState<Record<string, number>>({});
  const [trackShares, setTrackShares] = useState<Record<string, number>>({});

  const isAdmin = (currentUser as any)?.role === 'admin';

  useEffect(() => {
    setLikedTracks(initialLikedTracks || []);
  }, [initialLikedTracks]);

  const fetchMyLikes = useCallback(async () => {
    if (!currentUser) return;

    const userId = String((currentUser as any).id);

    try {
      const [songLikesRes, episodeLikesRes] = await Promise.all([
        apiJson<any[]>(`/api/song-likes?userId=${encodeURIComponent(userId)}`),
        apiJson<any[]>(`/api/podcast-episode-likes?userId=${encodeURIComponent(userId)}`),
      ]);

      const songIds = songLikesRes.success ? (songLikesRes.data || []).map((x: any) => String(x.song_id ?? x.id)) : [];
      const epIds   = episodeLikesRes.success ? (episodeLikesRes.data || []).map((x: any) => String(x.episode_id ?? x.id)) : [];

      const newLikedTracks = [
        ...songIds.map((id: string) => `music:${id}`),
        ...epIds.map((id: string) => `podcast:${id}`),
      ];
      
      setLikedTracks(newLikedTracks);
      
      if (newLikedTracks.length !== initialLikedTracks.length || 
          !newLikedTracks.every(k => initialLikedTracks.includes(k))) {
        newLikedTracks.forEach(key => {
          onToggleLike(key, true);
        });
      }
    } catch (error) {
      console.error('Failed to fetch likes:', error);
    }
  }, [currentUser, onToggleLike, initialLikedTracks]);

  useEffect(() => {
    fetchMyLikes();
  }, [fetchMyLikes]);

  const isTrackLiked = useCallback((id: string | number, type: 'music' | 'podcast'): boolean => {
    return likedTracks.includes(`${type}:${String(id)}`);
  }, [likedTracks]);

  const toggleLike = useCallback(async (id: string | number, type: 'music' | 'podcast') => {
    if (!currentUser) return;

    const trackId = String(id);
    const key = `${type}:${trackId}`;
    const isLiked = likedTracks.includes(key);
    const userId = String((currentUser as any).id);

    setLikedTracks(prev => {
      if (isLiked) {
        return prev.filter(x => x !== key);
      } else {
        return [...prev, key];
      }
    });
    
    onToggleLike(key, !isLiked);

    try {
      const res = type === "music"
        ? await toggleSongLike(trackId, userId, isLiked ? 'DELETE' : 'POST')
        : await toggleEpisodeLike(trackId, userId, isLiked ? 'DELETE' : 'POST');

      if (res) {
        const likesCount = Number(res.likes_count ?? res.likes ?? res.count ?? 0);
        
        if (type === "music") {
          setSongs(prev => prev.map(song =>
            String(song.id) === trackId
              ? { 
                  ...song, 
                  stats: { 
                    ...(song.stats || {}), 
                    likes: Math.max(likesCount, (song.stats as any)?.likes || 0)
                  } 
                }
              : song
          ));
        } else {
          setEpisodes(prev => prev.map(ep =>
            String(ep.id) === trackId
              ? { 
                  ...ep, 
                  stats: { 
                    ...(ep.stats || {}), 
                    likes: Math.max(likesCount, (ep.stats as any)?.likes || 0)
                  } 
                }
              : ep
          ));
        }
      }
    } catch (error) {
      console.error('Failed to sync like count from backend:', error);
      setLikedTracks(prev => isLiked ? [...prev, key] : prev.filter(x => x !== key));
      onToggleLike(key, isLiked);
    }
  }, [currentUser, likedTracks, onToggleLike]);

  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'UNERA Music',
      url: 'https://unera.social/music',
      description: 'Stream and upload music on UNERA Social Platform',
      publisher: {
        '@type': 'Organization',
        name: 'UNERA',
        logo: 'https://unera.social/logo.png',
      },
    }),
    []
  );

  const fetchSongs = useCallback(async () => {
    setLoadingSongs(true);
    setError(null);
    const res = await apiJson<any[]>('/api/songs', { method: 'GET' });
    if (!res.success) {
      setError(res.error);
      setLoadingSongs(false);
      return;
    }
    const arr = Array.isArray(res.data) ? res.data : (res.data as any)?.results || [];
    setSongs(arr.map(mapSongFromApi));
    setLoadingSongs(false);
  }, []);

  const fetchPodcasts = useCallback(async () => {
    setLoadingEpisodes(true);
    setError(null);
    const res = await apiJson<any[]>('/api/podcasts', { method: 'GET' });
    if (!res.success) {
      setError(res.error);
      setLoadingEpisodes(false);
      return;
    }
    const arr = Array.isArray(res.data) ? res.data : (res.data as any)?.results || [];
    setEpisodes(arr.map(mapEpisodeFromApi));
    setLoadingEpisodes(false);
  }, []);

  useEffect(() => {
    fetchSongs();
    fetchPodcasts();
  }, [fetchSongs, fetchPodcasts]);

  const handlePlayTrackFromSong = useCallback((song: Song) => {
    const uploaderProfile = users.find((u) => u.id === song.uploaderId);
    const artistName = uploaderProfile?.name || uploaderProfile?.username || song.artist;
    
    const audioTrack: AudioTrack = {
      id: String(song.id),
      title: song.title,
      artist: artistName,
      duration:
        typeof song.duration === 'string'
          ? (() => {
              const parts = song.duration.split(':');
              const mm = Number(parts[0] || 0);
              const ss = Number(parts[1] || 0);
              return mm * 60 + ss || 180;
            })()
          : (song.duration as any) || 180,
      url: song.audioUrl || '',
      uploaderId: song.uploaderId || 1,
      cover: song.cover || DEFAULT_MUSIC_COVER,
      type: 'music',
      isVerified: Boolean((uploaderProfile as any)?.isVerified),
      likesCount: Number((song.stats as any)?.likes || 0),
    } as any;

    onPlayTrack(audioTrack);
  }, [users, onPlayTrack]);

  const handlePlayTrackFromEpisode = useCallback((episode: Episode) => {
    const uploaderProfile = users.find((u) => u.id === episode.uploaderId);
    const hostName = uploaderProfile?.name || uploaderProfile?.username || episode.host || 'Unknown Host';
    
    const audioTrack: AudioTrack = {
      id: String(episode.id),
      title: episode.title,
      artist: hostName,
      duration:
        typeof episode.duration === 'string'
          ? (() => {
              const parts = episode.duration.split(':');
              const mm = Number(parts[0] || 0);
              const ss = Number(parts[1] || 0);
              return mm * 60 + ss || 1800;
            })()
          : (episode.duration as any) || 1800,
      url: episode.audioUrl || '',
      uploaderId: episode.uploaderId || 1,
      cover: (episode as any).thumbnail || DEFAULT_PODCAST_COVER,
      type: 'podcast',
      isVerified: Boolean((uploaderProfile as any)?.isVerified),
      likesCount: Number((episode.stats as any)?.likes || 0),
    } as any;

    onPlayTrack(audioTrack);
  }, [users, onPlayTrack]);

  // Handle React (like with emojis) for tracks
  const handleReactToTrack = useCallback(async (track: AudioTrack, reactionType: ReactionType) => {
    if (!currentUser) {
      alert('Please login to react');
      return;
    }

    const trackId = track.id;
    const itemType = track.type;
    const userId = (currentUser as any).id;

    // Optimistic update
    setTrackReactions(prev => {
      const current = prev[trackId] || { count: 0, myReaction: undefined };
      const isSameReaction = current.myReaction === reactionType;
      const newCount = isSameReaction 
        ? Math.max(0, current.count - 1)
        : current.myReaction 
          ? current.count // If changing reaction, count stays same (remove old, add new)
          : current.count + 1;
      const newMyReaction = isSameReaction ? undefined : reactionType;
      
      return {
        ...prev,
        [trackId]: { count: newCount, myReaction: newMyReaction }
      };
    });

    try {
      const result = await reactToItem(trackId, itemType, userId, reactionType);
      
      if (result.success) {
        setTrackReactions(prev => ({
          ...prev,
          [trackId]: {
            count: result.reactions_count || 0,
            myReaction: result.my_reaction || undefined
          }
        }));
      }
    } catch (error) {
      console.error('Failed to react:', error);
      // Revert optimistic update on error
      setTrackReactions(prev => {
        const current = prev[trackId];
        if (!current) return prev;
        return {
          ...prev,
          [trackId]: {
            count: current.count,
            myReaction: current.myReaction === reactionType ? undefined : current.myReaction
          }
        };
      });
      alert('Failed to react. Please try again.');
    }
  }, [currentUser]);

  // Handle comment count update
  const handleCommentAdded = useCallback((trackId: string) => {
    setTrackComments(prev => ({
      ...prev,
      [trackId]: (prev[trackId] || 0) + 1
    }));
  }, []);

  // Handle share count update
  const handleShareComplete = useCallback((trackId: string, data?: any) => {
    const newCount = data?.shares_count || (trackShares[trackId] || 0) + 1;
    setTrackShares(prev => ({
      ...prev,
      [trackId]: newCount
    }));
  }, [trackShares]);

  const handleArtistClick = (uploaderId: number) => {
    if (onProfileClick) onProfileClick(uploaderId);
    else {
      setSelectedArtistId(uploaderId);
      setView('artist');
    }
  };

  const deleteSong = async (id: string) => {
    if (!currentUser || !isAdmin) return;
    if (!confirm('Delete this song?')) return;

    const res = await apiJson<any>(`/api/songs?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.success) {
      alert(res.error || 'Failed to delete');
      return;
    }
    setSongs((prev) => prev.filter((s) => String(s.id) !== id));
  };

  const deleteEpisode = async (id: string) => {
    if (!currentUser || !isAdmin) return;
    if (!confirm('Delete this episode?')) return;

    const res = await apiJson<any>(`/api/podcasts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.success) {
      alert(res.error || 'Failed to delete');
      return;
    }
    setEpisodes((prev) => prev.filter((e) => String(e.id) !== id));
  };

  const handleDownload = (id: string) => {
    if (!currentUser) return;
    if (!downloads.includes(id)) {
      setDownloads((prev) => [...prev, id]);
    }
  };

  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  }, [songs, searchQuery]);

  const filteredEpisodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return episodes;
    return episodes.filter((e) => e.title.toLowerCase().includes(q) || (e.host || '').toLowerCase().includes(q));
  }, [episodes, searchQuery]);

  const trendingSongs = useMemo(() => {
    return [...songs].sort((a, b) => ((b.stats as any)?.plays || 0) - ((a.stats as any)?.plays || 0)).slice(0, 5);
  }, [songs]);

  const recentSongs = useMemo(() => {
    return [...songs]
      .sort((a, b) => new Date(b.uploadDate || 0).getTime() - new Date(a.uploadDate || 0).getTime())
      .slice(0, 5);
  }, [songs]);

  const featuredSongs = useMemo(() => {
    return [...songs]
      .sort((a, b) => ((b.stats as any)?.plays || 0) - ((a.stats as any)?.plays || 0))
      .slice(0, 5);
  }, [songs]);

  const handpickedSongs = useMemo(() => {
    return [...songs]
      .sort((a, b) => ((b.stats as any)?.likes || 0) - ((a.stats as any)?.likes || 0))
      .slice(0, 10);
  }, [songs]);

  const bestPickSongs = useMemo(() => {
    return [...songs]
      .sort((a, b) => {
        const aScore = (((a.stats as any)?.plays || 0) * 0.7) + (((a.stats as any)?.likes || 0) * 1.5);
        const bScore = (((b.stats as any)?.plays || 0) * 0.7) + (((b.stats as any)?.likes || 0) * 1.5);
        return bScore - aScore;
      })
      .slice(0, 10);
  }, [songs]);

  const freshVibeSongs = useMemo(() => {
    return [...songs]
      .sort((a, b) => new Date(b.uploadDate || 0).getTime() - new Date(a.uploadDate || 0).getTime())
      .slice(0, 10);
  }, [songs]);

  const heroSong = featuredSongs[heroIndex] || recentSongs[0] || songs[0] || null;

  useEffect(() => {
    if (featuredSongs.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % featuredSongs.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [featuredSongs.length]);

  const dashboardStats = useMemo(() => {
    const totalPlays =
      songs.reduce((sum, s) => sum + (Number((s.stats as any)?.plays) || 0), 0) +
      episodes.reduce((sum, e) => sum + (Number((e.stats as any)?.plays) || 0), 0);

    const totalLikesReceived =
      songs.reduce((sum, s) => sum + (Number((s.stats as any)?.likes) || 0), 0) +
      episodes.reduce((sum, e) => sum + (Number((e.stats as any)?.likes) || 0), 0);

    const totalTracks = songs.length + episodes.length;

    const myId = Number((currentUser as any)?.id || 0);

    const userSongs = songs.filter((s) => Number(s.uploaderId) === myId);
    const userEpisodes = episodes.filter((e) => Number(e.uploaderId) === myId);

    const userPlays =
      userSongs.reduce((sum, s) => sum + (Number((s.stats as any)?.plays) || 0), 0) +
      userEpisodes.reduce((sum, e) => sum + (Number((e.stats as any)?.plays) || 0), 0);

    const userLikesReceived =
      userSongs.reduce((sum, s) => sum + (Number((s.stats as any)?.likes) || 0), 0) +
      userEpisodes.reduce((sum, e) => sum + (Number((e.stats as any)?.likes) || 0), 0);

    return {
      totalPlays,
      totalTracks,
      totalLikesReceived,
      userSongs: userSongs.length,
      userEpisodes: userEpisodes.length,
      userUploads: userSongs.length + userEpisodes.length,
      userPlays,
      userLikesReceived,
      myLikesCount: likedTracks.length,
      myTotalPlays: myTotalPlays || 0,
    };
  }, [songs, episodes, currentUser, likedTracks, myTotalPlays]);

  const selectedArtistUser: User | null = useMemo(() => {
    if (!selectedArtistId) return null;

    const found = users.find((u) => u.id === selectedArtistId);
    if (found) return found;

    const artistName = songs.find((s) => s.uploaderId === selectedArtistId)?.artist || 'Artist';

    return {
      id: selectedArtistId,
      name: artistName,
      profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(artistName)}&background=random`,
      coverImage:
        'https://images.unsplash.com/photo-1514525253440-b393452e8d26?ixlib=rb-1.2.1&auto=format&fit=crop&w=1500&q=80',
      followers: [],
      following: [],
      isOnline: false,
      isVerified: false,
      role: 'user',
    } as any;
  }, [selectedArtistId, users, songs]);

  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'MusicGroup',
      name: 'UNERA Music',
      description: 'Stream and upload music on UNERA Social Platform',
      url: typeof window !== 'undefined' ? window.location.href : 'https://unera.social/music',
      track: songs.slice(0, 10).map((song) => ({
        '@type': 'MusicRecording',
        name: song.title,
        byArtist: { '@type': 'MusicGroup', name: song.artist },
        duration: typeof song.duration === 'string' ? song.duration : 'PT3M',
        url: song.audioUrl,
      })),
    };

    const existing = document.querySelector('script[type="application/ld+json"][data-unera-music="1"]');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-unera-music', '1');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [songs]);

  const showLoading = (view === 'music' && loadingSongs) || (view === 'podcasts' && loadingEpisodes);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      {/* Navigation Tabs */}
      <div className="sticky top-14 bg-[#0A0A0A]/95 backdrop-blur-md z-30 px-4 py-4 border-b border-[#222] flex gap-6 overflow-x-auto scrollbar-hide">
        <button onClick={() => setView('music')} className={`cursor-pointer font-bold text-sm whitespace-nowrap ${view === 'music' ? 'text-[#07E8F8]' : 'text-gray-400 hover:text-white'}`}>
          MUSIC
        </button>
        <button onClick={() => setView('podcasts')} className={`cursor-pointer font-bold text-sm whitespace-nowrap ${view === 'podcasts' ? 'text-[#07E8F8]' : 'text-gray-400 hover:text-white'}`}>
          PODCASTS
        </button>

        {currentUser && (
          <button onClick={() => setView('dashboard')} className={`cursor-pointer font-bold text-sm whitespace-nowrap ${view === 'dashboard' ? 'text-[#07E8F8]' : 'text-gray-400 hover:text-white'}`}>
            DASHBOARD
          </button>
        )}

        {selectedArtistId && (
          <button onClick={() => setView('artist')} className={`cursor-pointer font-bold text-sm whitespace-nowrap ${view === 'artist' ? 'text-[#07E8F8]' : 'text-gray-400 hover:text-white'}`}>
            ARTIST
          </button>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl mb-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <i className="fas fa-triangle-exclamation"></i>
                <span className="text-sm font-semibold">{error}</span>
              </div>
              <button onClick={() => { fetchSongs(); fetchPodcasts(); }} className="text-sm font-bold text-[#07E8F8] hover:underline">
                Retry
              </button>
            </div>
          </div>
        )}

        {showLoading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-[#07E8F8] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* MODERN MUSIC FEED LAYOUT - Boomplay Style */}
        {view === 'music' && !showLoading && (
          <div className="space-y-8">
            {/* Mobile Entertainment Header */}
            <div className="rounded-[28px] bg-gradient-to-b from-[#0B0B0F] to-[#121217] border border-white/5 p-4 sm:p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                    UNERA Music
                  </h1>
                  <p className="text-[#A8AFBC] mt-1 text-sm sm:text-base">
                    Discover trending sounds, creators and fresh vibes
                  </p>
                </div>
                {currentUser && (
                  <button onClick={() => setView('dashboard')} className="shrink-0 px-4 py-2 rounded-full bg-[#07E8F8] text-black font-bold text-sm hover:opacity-90">
                    Studio
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search songs, artists..."
                  className="w-full bg-[#1A1D24] text-white px-4 py-3 pl-11 rounded-2xl border border-[#2B313D] focus:border-[#07E8F8] focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#8D96A8]"></i>
              </div>

              {/* Hero Banner */}
              {heroSong && (
                <div className="mb-5">
                  <FeaturedBannerCard
                    song={heroSong}
                    artistName={
                      users.find((u) => u.id === heroSong.uploaderId)?.name ||
                      users.find((u) => u.id === heroSong.uploaderId)?.username ||
                      heroSong.artist
                    }
                    onPlay={() => handlePlayTrackFromSong(heroSong)}
                  />
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                <QuickActionCircle icon="fas fa-chart-bar" label="Charts" onClick={() => setSearchQuery('')} />
                <QuickActionCircle icon="fas fa-user-music" label="Artists" onClick={() => setView('artist')} />
                <QuickActionCircle icon="fas fa-list-music" label="Playlists" />
                <QuickActionCircle icon="fas fa-podcast" label="Podcasts" onClick={() => setView('podcasts')} />
                <QuickActionCircle icon="fas fa-compact-disc" label="Genres" />
              </div>

              {/* Genre Chips */}
              <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
                {['Bongo Fleva', 'Amapiano', 'Afrobeats', 'Hip Hop', 'RnB', 'Gospel'].map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setSearchQuery(genre)}
                    className="px-4 py-1.5 rounded-full bg-[#1A1D24] text-[#B8BCC7] text-sm hover:bg-[#07E8F8] hover:text-black transition-colors whitespace-nowrap"
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            {/* Mini now playing strip */}
            {currentUser && currentTrack && (
              <div className="rounded-2xl bg-[#111318] border border-white/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-12 h-12 rounded-full overflow-hidden border border-white/10 ${isPlaying ? 'animate-spin-slow' : ''}`}>
                      <img src={currentTrack.cover || DEFAULT_MUSIC_COVER} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#8D96A8] text-xs">Now Playing</p>
                      <p className="text-white font-bold truncate">{currentTrack.title}</p>
                      <p className="text-[#B8BCC7] text-sm truncate">{currentTrack.artist}</p>
                    </div>
                  </div>
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center ${isPlaying ? 'bg-[#07E8F8] text-black' : 'bg-[#2A2F39] text-white'}`}>
                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play ml-0.5'}`}></i>
                  </div>
                </div>
              </div>
            )}

            {/* Horizontal feed sections like Boomplay */}
            {!searchQuery ? (
              <>
                <HorizontalMusicRow
                  title="Ngoma Za Moto"
                  subtitle="Most streamed right now"
                  songs={featuredSongs}
                  users={users}
                  isTrackLiked={isTrackLiked}
                  onPlaySong={handlePlayTrackFromSong}
                  onLikeSong={(id) => toggleLike(id, 'music')}
                  onArtistClick={handleArtistClick}
                  badgeBuilder={(song, index) => ({
                    text: index === 0 ? 'HOT' : `#${index + 1}`,
                    className: index === 0 ? 'bg-[#FF7A00] text-white' : 'bg-black/65 text-white'
                  })}
                />
                <HorizontalMusicRow
                  title="Handpicked User Gems"
                  subtitle="Loved by listeners"
                  songs={handpickedSongs}
                  users={users}
                  isTrackLiked={isTrackLiked}
                  onPlaySong={handlePlayTrackFromSong}
                  onLikeSong={(id) => toggleLike(id, 'music')}
                  onArtistClick={handleArtistClick}
                  badgeBuilder={() => ({
                    text: 'GEM',
                    className: 'bg-[#8B5CF6] text-white'
                  })}
                />
                <HorizontalMusicRow
                  title="Best Picks"
                  subtitle="Strong plays and likes"
                  songs={bestPickSongs}
                  users={users}
                  isTrackLiked={isTrackLiked}
                  onPlaySong={handlePlayTrackFromSong}
                  onLikeSong={(id) => toggleLike(id, 'music')}
                  onArtistClick={handleArtistClick}
                  badgeBuilder={() => ({
                    text: 'TOP',
                    className: 'bg-[#07E8F8] text-black'
                  })}
                />
                <HorizontalMusicRow
                  title="Fresh Vibes Only"
                  subtitle="New uploads from creators"
                  songs={freshVibeSongs}
                  users={users}
                  isTrackLiked={isTrackLiked}
                  onPlaySong={handlePlayTrackFromSong}
                  onLikeSong={(id) => toggleLike(id, 'music')}
                  onArtistClick={handleArtistClick}
                  badgeBuilder={() => ({
                    text: 'NEW',
                    className: 'bg-[#1877F2] text-white'
                  })}
                />
              </>
            ) : (
              <div className="rounded-2xl bg-[#111318] border border-white/5 p-4">
                <SectionTitle title={`Search Results (${filteredSongs.length})`} subtitle="Matched songs" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredSongs.length > 0 ? (
                    filteredSongs.map((song) => {
                      const uploaderProfile = users.find((u) => u.id === song.uploaderId);
                      const artistName = uploaderProfile?.name || uploaderProfile?.username || song.artist;
                      const artistAvatar = (uploaderProfile as any)?.profileImage || (uploaderProfile as any)?.profile_image_url || null;
                      return (
                        <MusicFeedCard
                          key={song.id}
                          song={song}
                          isLiked={isTrackLiked(String(song.id), 'music')}
                          artistName={artistName}
                          artistAvatar={artistAvatar}
                          verified={Boolean((uploaderProfile as any)?.isVerified || (uploaderProfile as any)?.is_verified)}
                          badge="PLAY"
                          badgeColor="bg-black/60 text-white"
                          onPlay={() => handlePlayTrackFromSong(song)}
                          onLike={() => toggleLike(String(song.id), 'music')}
                          onArtistClick={() => song.uploaderId && handleArtistClick(song.uploaderId)}
                        />
                      );
                    })
                  ) : (
                    <div className="col-span-full text-center py-10">
                      <i className="fas fa-magnifying-glass text-4xl text-[#677083] mb-3"></i>
                      <p className="text-[#B8BCC7] text-lg">No songs found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Optional compact all music list */}
            {!searchQuery && filteredSongs.length > 0 && (
              <div className="rounded-2xl bg-[#111318] border border-white/5 p-4">
                <SectionTitle title="All Music" subtitle={`${filteredSongs.length} tracks available`} />
                <div className="space-y-2">
                  {filteredSongs.slice(0, 10).map((song, index) => {
                    const uploaderProfile = users.find((u) => u.id === song.uploaderId);
                    const artistName = uploaderProfile?.name || uploaderProfile?.username || song.artist;
                    const isCurrentTrack = currentTrack && currentTrack.type === 'music' && String(currentTrack.id) === String(song.id);
                    return (
                      <div
                        key={song.id}
                        onClick={() => handlePlayTrackFromSong(song)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                          isCurrentTrack ? 'bg-[#07E8F8]/10 border border-[#07E8F8]/30' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="w-6 text-center text-[#9CA3AF] font-bold text-sm">
                          {index + 1}
                        </div>
                        <img src={song.cover || DEFAULT_MUSIC_COVER} alt={song.title} className="w-12 h-12 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold truncate">{song.title}</p>
                          <p className="text-[#9CA3AF] text-sm truncate">{artistName}</p>
                        </div>
                        <div className="text-[#9CA3AF] text-xs hidden sm:block">
                          {formatCompactNumber((song.stats as any)?.plays)} plays
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(String(song.id), 'music');
                          }}
                          className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
                        >
                          <i className={`${isTrackLiked(String(song.id), 'music') ? 'fas text-[#FF4D8D]' : 'far text-white'} fa-heart`}></i>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PODCAST VIEW */}
        {view === 'podcasts' && !showLoading && (
          <div className="space-y-8">
            <div className="bg-[#242526] rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Podcasts & Episodes ({filteredEpisodes.length})</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEpisodes.length > 0 ? (
                  filteredEpisodes.map((episode) => {
                    const isCurrentTrack = currentTrack && 
                      currentTrack.type === 'podcast' && 
                      String(currentTrack.id) === String(episode.id);
                    const isLiked = isTrackLiked(String(episode.id), 'podcast');
                    const uploaderProfile = users.find((u) => u.id === episode.uploaderId);
                    const profilePicture = uploaderProfile 
                      ? (uploaderProfile as any).profileImage || (uploaderProfile as any).profile_image_url 
                      : null;
                    
                    const hostName = uploaderProfile?.name || uploaderProfile?.username || episode.host || 'Host';
                    
                    return (
                      <div
                        key={episode.id}
                        className={`bg-[#3A3B3C] rounded-xl overflow-hidden hover:bg-[#4E4F50] transition-colors cursor-pointer group ${
                          isCurrentTrack ? 'border-2 border-[#07E8F8]' : ''
                        }`}
                        onClick={() => handlePlayTrackFromEpisode(episode)}
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="relative w-16 h-16 flex-shrink-0">
                              <img 
                                src={episode.thumbnail || DEFAULT_PODCAST_COVER} 
                                alt={episode.title} 
                                className="w-full h-full object-cover rounded-lg" 
                              />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <i className="fas fa-play text-white"></i>
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-white line-clamp-2">{episode.title}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                {profilePicture ? (
                                  <img 
                                    src={profilePicture} 
                                    className="w-4 h-4 rounded-full object-cover border border-white/20"
                                    alt="Profile"
                                  />
                                ) : null}
                                <p 
                                  className="text-[#B0B3B8] text-sm flex items-center gap-1 cursor-pointer hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (episode.uploaderId) handleArtistClick(episode.uploaderId);
                                  }}
                                >
                                  {hostName}
                                  {uploaderProfile?.isVerified && <i className="fas fa-check-circle text-[#07E8F8] text-xs"></i>}
                                  <span className="text-xs text-gray-500 ml-1">(Host)</span>
                                </p>
                              </div>

                              <div className="flex items-center justify-between mt-3">
                                <span className="text-[#B0B3B8] text-xs">{(episode as any).duration || '45:00'}</span>

                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLike(String(episode.id), 'podcast');
                                    }}
                                    className="text-lg hover:scale-110 transition-transform flex items-center gap-1"
                                    title="Like"
                                  >
                                    <i className={`${isLiked ? 'fas text-[#FF4D8D]' : 'far'} fa-heart`}></i>
                                    <span className="text-xs text-[#B0B3B8]">{(episode.stats as any)?.likes || 0}</span>
                                  </button>

                                  {isAdmin && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteEpisode(String(episode.id));
                                      }}
                                      className="text-red-500 hover:text-red-400"
                                      title="Delete"
                                    >
                                      <i className="fas fa-trash"></i>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {(episode as any).description && <p className="text-[#B0B3B8] text-sm mt-3 line-clamp-2">{(episode as any).description}</p>}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-3 text-center py-12">
                    <i className="fas fa-podcast text-5xl text-[#B0B3B8] mb-4"></i>
                    <p className="text-[#B0B3B8] text-lg">No podcasts found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DASHBOARD VIEW */}
        {view === 'dashboard' && currentUser && !showLoading && (
          <div className="space-y-8">
            <div className="bg-[#242526] rounded-2xl p-6">
              <div className="flex flex-col items-center justify-center mb-10 mt-4 text-center">
                <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-white to-gray-400 text-transparent bg-clip-text">Creator Studio</h2>
                <p className="text-[#888] mb-6 max-w-2xl">Upload your music, podcasts, and albums. Monitor your performance.</p>

                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-gradient-to-r from-[#1877F2] to-[#0062E3] px-10 py-4 rounded-full font-bold flex items-center gap-3 hover:scale-105 transition-transform shadow-[0_4px_20px_rgba(24,119,242,0.5)] text-lg"
                >
                  <i className="fas fa-cloud-upload-alt text-2xl"></i> Upload New Content
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-[#333]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#B0B3B8] text-sm">Likes on Your Content</p>
                      <p className="text-2xl font-bold text-white">{dashboardStats.userLikesReceived.toLocaleString()}</p>
                    </div>
                    <i className="fas fa-heart text-[#FF4D8D] text-xl"></i>
                  </div>
                  <p className="text-[#888] text-xs mt-2">Likes your content received</p>
                </div>

                <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-[#333]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#B0B3B8] text-sm">Your Uploads</p>
                      <p className="text-2xl font-bold text-white">{dashboardStats.userUploads}</p>
                    </div>
                    <i className="fas fa-upload text-[#45BD62] text-xl"></i>
                  </div>
                  <p className="text-[#888] text-xs mt-2">{dashboardStats.userSongs} songs + {dashboardStats.userEpisodes} podcasts</p>
                </div>

                <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-[#333]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#B0B3B8] text-sm">My Total Plays</p>
                      <p className="text-2xl font-bold text-white">{myTotalPlays.toLocaleString()}</p>
                    </div>
                    <i className="fas fa-play-circle text-[#07E8F8] text-xl"></i>
                  </div>
                  <p className="text-[#888] text-xs mt-2">Plays you've made across UNERA</p>
                </div>
              </div>

              <div className="bg-[#1E1E1E] rounded-2xl border border-[#333] overflow-hidden">
                <div className="p-6 border-b border-[#333]">
                  <h3 className="text-xl font-bold text-white">Your Catalog</h3>
                  <p className="text-[#888] text-sm">Manage your uploaded content</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#252525] text-[#888] text-xs uppercase font-bold">
                      <tr>
                        <th className="p-4">Content</th>
                        <th className="p-4">Type</th>
                        <th className="p-4 text-right">Plays</th>
                        <th className="p-4 text-right">Likes</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#333]">
                      {[...songs.filter((s) => s.uploaderId === (currentUser as any).id), ...episodes.filter((e) => e.uploaderId === (currentUser as any).id)].map((item: any) => (
                        <tr key={item.id} className="hover:bg-[#2A2A2A]">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img src={item.cover || item.thumbnail || DEFAULT_MUSIC_COVER} className="w-10 h-10 rounded object-cover" alt="" />
                              <div>
                                <div className="font-bold text-white text-sm">{item.title}</div>
                                <div className="text-xs text-[#888]">{item.artist || item.host}</div>
                              </div>
                            </div>
                           </td>

                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs ${item.host ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {item.host ? 'Podcast' : 'Music'}
                            </span>
                          </td>

                          <td className="p-4 text-right font-bold text-sm">{(item.stats as any)?.plays || 0}</td>
                          
                          <td className="p-4 text-right font-bold text-sm">{(item.stats as any)?.likes || 0}</td>

                          <td className="p-4 text-right">
                            <button
                              onClick={() => (item.host ? deleteEpisode(String(item.id)) : deleteSong(String(item.id)))}
                              className="text-red-500 hover:text-red-400 p-2"
                              title="Delete"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </td>
                        </tr>
                      ))}

                      {songs.filter((s) => s.uploaderId === (currentUser as any).id).length === 0 && episodes.filter((e) => e.uploaderId === (currentUser as any).id).length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-[#666]">
                            <div className="mb-3">
                              <i className="fas fa-music text-4xl opacity-50"></i>
                            </div>
                            <p className="text-lg">No uploads yet.</p>
                            <p className="text-sm">Start by clicking "Upload New Content" above.</p>
                           </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-8 bg-[#1E1E1E] rounded-2xl border border-[#333] p-6">
                <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {playHistory.slice(0, 5).map((track, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 hover:bg-[#2A2A2A] rounded-lg">
                      <img src={track.cover || DEFAULT_MUSIC_COVER} className="w-10 h-10 rounded object-cover" alt="" />
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">{track.title}</div>
                        <div className="text-xs text-[#888]">{track.artist}</div>
                      </div>
                      <div className="text-xs text-[#888]">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                  {playHistory.length === 0 && (
                    <div className="text-center py-4 text-[#666]">
                      <i className="fas fa-history text-2xl mb-2"></i>
                      <p>No recent plays</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ARTIST VIEW */}
        {view === 'artist' && selectedArtistUser && !showLoading && (
          <div className="space-y-8">
            <div className="bg-[#242526] rounded-2xl overflow-hidden">
              <div className="h-48 relative">
                <img src={(selectedArtistUser as any).coverImage || (selectedArtistUser as any).profileImage} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] to-transparent"></div>

                <div className="absolute bottom-4 left-4 flex items-end gap-4">
                  <img src={(selectedArtistUser as any).profileImage} className="w-20 h-20 rounded-full border-4 border-[#0A0A0A] shadow-xl object-cover" alt="" />
                  <div className="mb-2">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                      {selectedArtistUser.name}
                      {(selectedArtistUser as any).isVerified && <i className="fas fa-check-circle text-[#07E8F8] text-sm"></i>}
                    </h1>
                    <p className="text-[#CCC] text-sm">{((selectedArtistUser as any).followers?.length || 0)} Followers</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-white mb-4">Popular Releases</h2>
                  <div className="space-y-2">
                    {songs
                      .filter((s) => s.uploaderId === selectedArtistUser.id)
                      .slice(0, 5)
                      .map((song, i) => {
                        const isLiked = isTrackLiked(String(song.id), 'music');
                        return (
                          <div
                            key={song.id}
                            className="flex items-center gap-4 p-3 hover:bg-[#3A3B3C] rounded-xl cursor-pointer transition-colors group"
                            onClick={() => handlePlayTrackFromSong(song)}
                          >
                            <div className="text-[#B0B3B8] font-bold w-4 text-center group-hover:hidden">{i + 1}</div>
                            <div className="hidden group-hover:block w-4 text-center text-white">
                              <i className="fas fa-play"></i>
                            </div>

                            <img src={song.cover || DEFAULT_MUSIC_COVER} className="w-10 h-10 rounded object-cover" alt="" />

                            <div className="flex-1">
                              <div className="font-bold text-white text-sm">{song.title}</div>
                              <div className="text-xs text-[#888]">{(song.stats as any)?.plays || 0} plays</div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-sm text-[#B0B3B8]">{(song as any).duration || '3:00'}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLike(String(song.id), 'music');
                                }}
                                className="text-lg hover:scale-110 transition-transform"
                                title="Like"
                              >
                                <i className={`${isLiked ? 'fas text-[#FF4D8D]' : 'far'} fa-heart`}></i>
                              </button>
                            </div>
                          </div>
                        );
                      })}

                    {songs.filter((s) => s.uploaderId === selectedArtistUser.id).length === 0 && <p className="text-[#666] text-center py-4">No tracks available from this artist.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && currentUser && (
        <AudioUploadModal
          currentUser={currentUser}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => {
            fetchSongs();
            fetchPodcasts();
          }}
        />
      )}
    </div>
  );
};

export default MusicSystem;
