import React, { useState, useRef, useMemo, useEffect } from 'react';
import { User, Group, Event, Post as PostType, ReactionType, AudioTrack } from '../types';
import { Post } from './Feed';
import { CreateEventModal } from './Events';

interface GroupSettingsModalProps {
  group: Group;
  onClose: () => void;
  onUpdate: (settings: Partial<Group>) => void;
  isAdmin: boolean;
  onDeleteGroup: () => void;
}

const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  group,
  onClose,
  onUpdate,
  isAdmin,
  onDeleteGroup,
}) => {
  const [name, setName] = useState(group.name);
  const [desc, setDesc] = useState(group.description);
  const [postingAllowed, setPostingAllowed] = useState(group.member_posting_allowed ?? true);

  const handleSave = () => {
    onUpdate({ name, description: desc, member_posting_allowed: postingAllowed });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-[#0A0A0B] w-full max-w-[500px] rounded-xl border border-[#2A2A2D] shadow-2xl flex flex-col animate-slide-up">
        <div className="p-4 border-b border-[#2A2A2D] flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Group Settings</h3>
          <div
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1A1A1D] hover:bg-[#2A2A2D] flex items-center justify-center cursor-pointer transition-colors"
          >
            <i className="fas fa-times text-gray-400"></i>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-gray-400 text-sm font-bold mb-1">Group Name</label>
            <input
              type="text"
              className="w-full bg-[#1A1A1D] border border-[#2A2A2D] rounded-lg p-2.5 text-white outline-none"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm font-bold mb-1">Description</label>
            <textarea
              className="w-full bg-[#1A1A1D] border border-[#2A2A2D] rounded-lg p-2.5 text-white outline-none h-24 resize-none"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-[#1A1A1D] rounded-lg border border-[#2A2A2D]">
            <div>
              <div className="text-white font-bold">Member Posting</div>
              <div className="text-gray-400 text-xs">Allow members to post in the group</div>
            </div>
            <div
              className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${
                postingAllowed ? 'bg-[#0066FF]' : 'bg-gray-600'
              }`}
              onClick={() => setPostingAllowed(!postingAllowed)}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  postingAllowed ? 'left-7' : 'left-1'
                }`}
              ></div>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-[#0066FF] hover:bg-[#005CE6] text-white py-2.5 rounded-lg font-bold transition-colors"
          >
            Save Changes
          </button>

          {isAdmin && (
            <div className="border-t border-red-500/20 pt-4 mt-4">
              <button
                onClick={onDeleteGroup}
                className="w-full bg-red-500/10 text-red-500 font-bold py-2.5 rounded-lg transition-all hover:bg-red-500 hover:text-white border border-red-500/20"
              >
                Delete Community
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface GroupsPageProps {
  currentUser: User | null;
  groups: Group[];
  users: User[];

  onCreateGroup: (group: Partial<Group>) => void;
  onJoinGroup: (groupId: number) => void;
  onLeaveGroup: (groupId: number) => void;
  onDeleteGroup: (groupId: number) => void;

  onUpdateGroupImage: (groupId: number, type: 'cover' | 'profile', file: File) => void;
  onPostToGroup: (
    groupId: number,
    content: string,
    file: File | null,
    type: 'image' | 'video' | 'doc' | 'text',
    background?: string
  ) => void;
  onCreateGroupEvent: (groupId: number, event: Partial<Event>) => void;
  onInviteToGroup: (groupId: number, userIds: number[]) => void;

  onProfileClick: (id: number) => void;
  onLikePost: (groupId: number, postId: number, type: ReactionType) => void;
  onOpenComments: (groupId: number, postId: number) => void;
  onSharePost: (groupId: number, postId: number) => void;
  onDeleteGroupPost: (groupId: number, postId: number) => void;
  onRemoveMember: (groupId: number, memberId: number) => void;
  onUpdateGroupSettings: (groupId: number, settings: Partial<Group>) => void;

  initialGroupId?: string | null;
  onPlayAudioTrack?: (track: AudioTrack) => void;
}

/**
 * SAFETY: normalize any incoming group from API so UI never crashes.
 * Your backend /api/groups might return only DB fields (no members/posts/events).
 */
function normalizeGroup(raw: any): Group {
  const members = Array.isArray(raw?.members) ? raw.members : [];
  const posts = Array.isArray(raw?.posts) ? raw.posts : [];
  const events = Array.isArray(raw?.events) ? raw.events : [];

  return {
    ...raw,
    id: Number(raw?.id ?? 0),
    admin_id: Number(raw?.admin_id ?? 0),
    name: String(raw?.name ?? ''),
    description: String(raw?.description ?? ''),
    type: (raw?.type === 'private' ? 'private' : 'public') as any,
    cover_image: String(raw?.cover_image ?? ''),
    profile_image: String(raw?.profile_image ?? ''),
    created_at: raw?.created_at ?? new Date().toISOString(),
    member_posting_allowed: raw?.member_posting_allowed ?? true,
    members,
    posts,
    events,
  } as Group;
}

export const GroupsPage: React.FC<GroupsPageProps> = ({
  currentUser,
  groups,
  users,
  onCreateGroup,
  onJoinGroup,
  onLeaveGroup,
  onDeleteGroup,
  onUpdateGroupImage,
  onPostToGroup,
  onCreateGroupEvent,
  onInviteToGroup,
  onProfileClick,
  onLikePost,
  onOpenComments,
  onSharePost,
  onDeleteGroupPost,
  onRemoveMember,
  onUpdateGroupSettings,
  initialGroupId,
  onPlayAudioTrack,
}) => {
  const [view, setView] = useState<'feed' | 'detail'>('feed');
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [groupTab, setGroupTab] = useState<'Discussion' | 'Events' | 'Members' | 'About'>('Discussion');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGroupPostModal, setShowGroupPostModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);

  // Facebook-like tabs for groups feed
  const [fbTab, setFbTab] = useState<'Your groups' | 'Posts' | 'Discover' | 'Invites'>('Your groups');
  const [sortOpen, setSortOpen] = useState(false);
  const [sortMode, setSortMode] = useState<'Most visited' | 'Recently active' | 'Alphabetical'>('Most visited');

  const groupCoverInputRef = useRef<HTMLInputElement>(null);
  const groupProfileInputRef = useRef<HTMLInputElement>(null);
  const postFileInputRef = useRef<HTMLInputElement>(null);

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupType, setNewGroupType] = useState<'public' | 'private'>('public');

  const [postContent, setPostContent] = useState('');
  const [postFile, setPostFile] = useState<File | null>(null);

  // ✅ normalize ALL groups so missing arrays never crash UI
  const safeGroups = useMemo(() => (groups || []).map(normalizeGroup), [groups]);

  useEffect(() => {
    if (!initialGroupId) return;
    const gid = parseInt(initialGroupId, 10);
    if (Number.isNaN(gid)) return;

    const group = safeGroups.find(g => g.id === gid);
    if (group) {
      setActiveGroupId(group.id);
      setView('detail');
      setGroupTab('Discussion');
    }
  }, [initialGroupId, safeGroups]);

  const activeGroup = useMemo(
    () => safeGroups.find(g => g.id === activeGroupId) || null,
    [safeGroups, activeGroupId]
  );

  useEffect(() => {
    if (!showGroupPostModal) {
      setPostContent('');
      setPostFile(null);
    }
  }, [showGroupPostModal]);

  const handleGroupClick = (group: Group) => {
    setActiveGroupId(group.id);
    setView('detail');
    setGroupTab('Discussion');
    window.scrollTo(0, 0);
  };

  const handleCreateSubmit = () => {
    if (!newGroupName.trim()) return;

    onCreateGroup({
      name: newGroupName,
      description: newGroupDesc,
      type: newGroupType,
      profile_image: `https://ui-avatars.com/api/?name=${encodeURIComponent(newGroupName)}&background=0066FF&color=fff`,
      cover_image:
        'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1500&q=80',
    });

    setShowCreateModal(false);
    setNewGroupName('');
    setNewGroupDesc('');
  };

  const handlePostSubmit = () => {
    if (!activeGroup) return;
    if (!postContent.trim() && !postFile) return;

    let type: 'text' | 'image' | 'video' | 'doc' = 'text';
    if (postFile) type = postFile.type.startsWith('image') ? 'image' : 'video';

    onPostToGroup(activeGroup.id, postContent, postFile, type);
    setShowGroupPostModal(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'profile') => {
    if (e.target.files && e.target.files[0] && activeGroup) {
      onUpdateGroupImage(activeGroup.id, type, e.target.files[0]);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  // Helper functions for Facebook-style feed
  const computeVisits = (g: Group) => {
    return Number((g as any)?.visits ?? ((g.posts?.length ?? 0) * 5 + (g.members?.length ?? 0)));
  };

  const computeLastActive = (g: Group) => {
    const fromField = Number((g as any)?.lastActiveAt ?? 0);
    if (fromField) return fromField;

    const newest = (g.posts ?? [])
      .map((p: any) => new Date(p?.created_at ?? 0).getTime())
      .filter((t: number) => Number.isFinite(t))
      .sort((a: number, b: number) => b - a)[0];

    return newest || 0;
  };

  const formatNewPostsText = (g: Group) => {
    const count = Number((g as any)?.newPostsCount ?? 0);
    if (count > 25) return '25+ new posts';
    if (count > 0) return `${count} new posts`;

    const updated = String((g as any)?.updatedAt ?? '').trim();
    return updated ? updated : 'Updated recently';
  };

  const hasNewPosts = (g: Group) => Number((g as any)?.newPostsCount ?? 0) > 0;

  // FEED VIEW (Facebook-style with UNERA colors)
  if (view === 'feed' || !activeGroup) {
    return (
      <div className="w-full bg-white min-h-screen font-sans pb-24">
        {/* Top header like Facebook with UNERA blue */}
        <div className="sticky top-0 z-[50] bg-white border-b border-gray-200">
          <div className="max-w-[900px] mx-auto px-4">
            <div className="h-14 flex items-center justify-between">
              <button
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 active:scale-95 transition"
                onClick={() => {
                  window.history.back();
                }}
                aria-label="Back"
              >
                <i className="fas fa-arrow-left text-[18px] text-black"></i>
              </button>

              <div className="text-[20px] font-extrabold text-black">Groups</div>

              <div className="flex items-center gap-2">
                <button
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 active:scale-95 transition"
                  onClick={() => currentUser ? setShowCreateModal(true) : alert('Login first')}
                  aria-label="Create"
                >
                  <i className="fas fa-plus text-[18px] text-black"></i>
                </button>

                <button
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 active:scale-95 transition"
                  onClick={() => {
                    const el = document.getElementById('groupsSearchInput');
                    (el as HTMLInputElement | null)?.focus();
                  }}
                  aria-label="Search"
                >
                  <i className="fas fa-search text-[18px] text-black"></i>
                </button>
              </div>
            </div>

            {/* Tabs row with UNERA blue */}
            <div className="flex gap-2 overflow-x-auto pb-3 pt-1 scrollbar-hide">
              {(['Your groups', 'Posts', 'Discover', 'Invites'] as const).map(tab => {
                const active = fbTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setFbTab(tab)}
                    className={
                      active
                        ? 'px-4 py-2 rounded-full bg-[#0066FF] text-white font-extrabold whitespace-nowrap'
                        : 'px-2 py-2 text-black/80 font-bold whitespace-nowrap hover:text-[#0066FF] transition-colors'
                    }
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Search input */}
            <div className="pb-3">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  id="groupsSearchInput"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search Groups"
                  className="w-full bg-gray-100 rounded-full pl-9 pr-4 py-2.5 outline-none text-[15px] text-black placeholder-gray-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-[900px] mx-auto">
          {(() => {
            // Data filtering
            const myGroups = currentUser
              ? safeGroups.filter(g => (g.members ?? []).includes(currentUser.id) || g.admin_id === currentUser.id)
              : [];

            let list = myGroups.length ? myGroups : safeGroups;

            // Search filter
            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase();
              list = list.filter(g => (g.name || '').toLowerCase().includes(q));
            }

            // Tab filtering
            if (fbTab === 'Discover') {
              list = currentUser
                ? safeGroups.filter(g => !(g.members ?? []).includes(currentUser.id) && g.admin_id !== currentUser.id)
                : safeGroups;
              if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                list = list.filter(g => (g.name || '').toLowerCase().includes(q));
              }
            }
            if (fbTab === 'Invites') {
              list = [];
            }

            // Sorting
            const sorted = [...list].sort((a, b) => {
              if (sortMode === 'Alphabetical') return (a.name || '').localeCompare(b.name || '');
              if (sortMode === 'Recently active') return computeLastActive(b) - computeLastActive(a);
              return computeVisits(b) - computeVisits(a);
            });

            const showMostVisitedHeader = fbTab === 'Your groups';

            return (
              <div className="px-4">
                {/* Most visited + Sort row */}
                {showMostVisitedHeader && (
                  <div className="flex items-center justify-between pt-2 pb-2">
                    <div className="text-[20px] font-extrabold text-black">Most visited</div>

                    <button
                      onClick={() => setSortOpen(true)}
                      className="text-[#0066FF] font-bold text-[18px] active:opacity-70 hover:text-[#005CE6] transition-colors"
                    >
                      Sort
                    </button>
                  </div>
                )}

                {/* Create a group row (Facebook style) */}
                {fbTab === 'Your groups' && currentUser && !searchQuery.trim() && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="w-full flex items-center gap-3 py-3 active:opacity-80 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#0066FF]/10 flex items-center justify-center">
                      <i className="fas fa-plus text-[#0066FF] text-[18px]"></i>
                    </div>
                    <div className="text-[18px] font-bold text-black">Create a group</div>
                  </button>
                )}

                {fbTab === 'Your groups' && <div className="border-b border-gray-200" />}

                {/* List */}
                {sorted.length > 0 ? (
                  <div>
                    {sorted.map(g => (
                      <button
                        key={g.id}
                        onClick={() => handleGroupClick(g)}
                        className="w-full flex items-center gap-3 py-3 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        {/* avatar */}
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center shrink-0">
                          {g.profile_image ? (
                            <img src={g.profile_image} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <span className="text-black font-extrabold">
                              {(g.name || 'G').slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* text */}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="text-[18px] font-extrabold text-black truncate">
                            {g.name}
                          </div>

                          <div className="flex items-center gap-2 mt-0.5">
                            {/* blue dot */}
                            <span
                              className={`w-2 h-2 rounded-full ${hasNewPosts(g) ? 'bg-[#0066FF]' : 'bg-transparent'}`}
                            />
                            <div className="text-[15px] text-gray-600 truncate">
                              {formatNewPostsText(g)}
                            </div>
                          </div>
                        </div>

                        {/* pin icon on right */}
                        <div className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100">
                          <i className="far fa-thumbtack text-gray-500 text-[18px]"></i>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center text-gray-600">
                    <div className="text-[18px] font-bold text-black mb-2">Nothing to show</div>
                    <div className="text-[15px]">
                      {fbTab === 'Invites' ? 'No group invites right now.' : 'Try searching for a group.'}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Sort Bottom Sheet with UNERA colors */}
        {sortOpen && (
          <div className="fixed inset-0 z-[200] bg-black/40 flex items-end animate-fade-in" onClick={() => setSortOpen(false)}>
            <div
              className="w-full bg-white rounded-t-2xl p-4 animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

              <div className="text-[18px] font-extrabold text-black mb-3">Sort</div>

              {(['Most visited', 'Recently active', 'Alphabetical'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => {
                    setSortMode(opt);
                    setSortOpen(false);
                  }}
                  className="w-full flex items-center justify-between py-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="text-[16px] font-bold text-black">{opt}</div>
                  {sortMode === opt ? (
                    <i className="fas fa-check text-[#0066FF]" />
                  ) : (
                    <span />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Create Group modal with UNERA colors */}
        {showCreateModal && (
          <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#0A0A0B] w-full max-w-[500px] rounded-xl border border-[#2A2A2D] shadow-2xl overflow-hidden animate-slide-up">
              <div className="p-4 border-b border-[#2A2A2D] flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Create Group</h3>
                <div
                  onClick={() => setShowCreateModal(false)}
                  className="w-8 h-8 rounded-full bg-[#1A1A1D] flex items-center justify-center cursor-pointer hover:bg-[#2A2A2D] transition-colors"
                >
                  <i className="fas fa-times text-gray-400"></i>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm font-bold mb-1">Name</label>
                  <input
                    type="text"
                    className="w-full bg-[#1A1A1D] border border-[#2A2A2D] rounded-lg p-2 text-white outline-none"
                    placeholder="Name your group"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-bold mb-1">Description</label>
                  <textarea
                    className="w-full bg-[#1A1A1D] border border-[#2A2A2D] rounded-lg p-2 text-white outline-none h-24"
                    placeholder="What is this group about?"
                    value={newGroupDesc}
                    onChange={e => setNewGroupDesc(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-bold mb-1">Privacy</label>
                  <select
                    className="w-full bg-[#1A1A1D] border border-[#2A2A2D] rounded-lg p-2 text-white outline-none"
                    value={newGroupType}
                    onChange={e => setNewGroupType(e.target.value as any)}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                <button
                  onClick={handleCreateSubmit}
                  disabled={!newGroupName.trim()}
                  className="w-full bg-[#0066FF] hover:bg-[#005CE6] text-white py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // DETAIL VIEW (safe: activeGroup always normalized)
  const isMember = currentUser
    ? (activeGroup.members ?? []).includes(currentUser.id) || activeGroup.admin_id === currentUser.id
    : false;

  const isGroupAdmin = currentUser && activeGroup.admin_id === currentUser.id;
  const canManage = Boolean(isGroupAdmin || isAdmin);
  const canPost = canManage || (activeGroup.member_posting_allowed ?? true);

  const mergedPosts = useMemo(() => {
    const groupPosts = (activeGroup.posts ?? []).map((gp: any) => ({
      ...gp,
      type: gp.media_url && String(gp.media_url).includes('.mp4') ? 'video' : gp.media_url ? 'image' : 'text',
      visibility: 'Public',
      reactions: gp.reactions || [],
      comments: gp.comments || [],
      shares: gp.shares || 0,
      created_at: 'Recently',
      groupId: activeGroup.id,
      groupName: activeGroup.name,
      createdAt: gp.created_at ? new Date(gp.created_at).getTime() : 0,
    }));

    const eventPosts = (activeGroup.events ?? []).map((ev: any) => ({
      id: Number(ev.id ?? 0) + 5000,
      user_id: Number(ev.creator_id ?? 0),
      type: 'event',
      event: ev,
      created_at: 'Upcoming',
      groupId: activeGroup.id,
      groupName: activeGroup.name,
      reactions: [],
      comments: [],
      shares: 0,
      createdAt: ev.event_date ? new Date(ev.event_date).getTime() : 0,
      visibility: 'Public',
    }));

    return [...groupPosts, ...eventPosts].sort((a: any, b: any) => (b.createdAt as number) - (a.createdAt as number));
  }, [activeGroup]);

  const createdDate =
    activeGroup.created_at && !Number.isNaN(new Date(activeGroup.created_at as any).getTime())
      ? new Date(activeGroup.created_at as any)
      : null;

  return (
    <div className="w-full bg-[#0A0A0B] min-h-screen pb-10">
      <div className="bg-[#0A0A0B] border-b border-[#2A2A2D] shadow-sm mb-4 animate-fade-in">
        <div className="max-w-[1100px] mx-auto">
          <div className="h-[200px] md:h-[350px] relative group bg-[#1A1A1D] md:rounded-b-xl overflow-hidden">
            <img src={activeGroup.cover_image} className="w-full h-full object-cover" alt="Cover" />
            {canManage && (
              <div
                className="absolute bottom-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg cursor-pointer hover:bg-white/20 font-bold text-white text-sm flex items-center gap-2 transition-all"
                onClick={() => groupCoverInputRef.current?.click()}
              >
                <i className="fas fa-camera"></i> Edit Cover
              </div>
            )}
            <input
              type="file"
              ref={groupCoverInputRef}
              className="hidden"
              accept="image/*"
              onChange={e => handleImageChange(e, 'cover')}
            />
          </div>

          <div className="px-4 pb-0">
            <div className="flex flex-col md:flex-row items-start md:items-end -mt-[40px] md:-mt-[30px] relative z-10 gap-4 mb-4">
              <div className="relative">
                <div className="w-[100px] h-[100px] md:w-[140px] md:h-[140px] rounded-xl border-4 border-[#0A0A0B] overflow-hidden bg-[#0A0A0B] shadow-xl">
                  <img src={activeGroup.profile_image} className="w-full h-full object-cover" alt="" />
                </div>
                {canManage && (
                  <div
                    className="absolute bottom-2 right-2 bg-[#1A1A1D] p-2 rounded-full cursor-pointer hover:bg-[#2A2A2D] shadow-md transition-colors"
                    onClick={() => groupProfileInputRef.current?.click()}
                  >
                    <i className="fas fa-camera text-white text-xs"></i>
                  </div>
                )}
                <input
                  type="file"
                  ref={groupProfileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={e => handleImageChange(e, 'profile')}
                />
              </div>

              <div className="flex-1 mt-2">
                <h1 className="text-2xl md:text-4xl font-bold text-white leading-tight mb-1">{activeGroup.name}</h1>
                <div className="flex items-center gap-2 text-gray-400 text-sm font-semibold">
                  <i className={`fas ${activeGroup.type === 'public' ? 'fa-globe-americas' : 'fa-lock'} text-xs`}></i>
                  <span className="capitalize">{activeGroup.type} group</span>
                  <span>•</span>
                  <span>{(activeGroup.members ?? []).length} members</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4 md:mt-0 w-full md:w-auto">
                {isMember ? (
                  <>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="bg-[#0066FF] text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#005CE6] flex-1 md:flex-none transition-all"
                    >
                      <i className="fas fa-plus"></i> Invite
                    </button>

                    <button className="bg-[#1A1A1D] text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#2A2A2D] flex-1 md:flex-none transition-all">
                      <i className="fas fa-check"></i> Joined
                    </button>

                    {canManage && (
                      <button
                        onClick={() => setShowSettingsModal(true)}
                        className="bg-[#1A1A1D] text-white px-3 py-2 rounded-lg font-bold hover:bg-[#2A2A2D] transition-all"
                      >
                        <i className="fas fa-cog"></i>
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => (currentUser ? onJoinGroup(activeGroup.id) : alert('Login first'))}
                    className="bg-[#0066FF] text-white px-8 py-2 rounded-lg font-bold text-base hover:bg-[#005CE6] w-full md:w-auto transition-all shadow-lg"
                  >
                    Join Group
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-[#2A2A2D] mt-4"></div>

            <div className="flex items-center gap-1 pt-1 overflow-x-auto scrollbar-hide">
              {(['Discussion', 'Events', 'Members', 'About'] as const).map(tab => (
                <div
                  key={tab}
                  onClick={() => setGroupTab(tab)}
                  className={`px-5 py-3 cursor-pointer font-bold text-base border-b-[3px] transition-all whitespace-nowrap ${
                    groupTab === tab
                      ? 'text-[#0066FF] border-[#0066FF]'
                      : 'text-gray-400 border-transparent hover:bg-[#1A1A1D] rounded-t-lg'
                  }`}
                >
                  {tab}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[700px] mx-auto px-0 md:px-4">
        {groupTab === 'Discussion' && (
          <div className="animate-fade-in">
            {isMember && canPost && (
              <div
                className="bg-[#0A0A0B] rounded-xl p-3 mb-4 border border-[#2A2A2D] shadow-sm flex gap-3 items-center cursor-pointer mx-2 md:mx-0 transition-colors hover:bg-[#1A1A1D]"
                onClick={() => setShowGroupPostModal(true)}
              >
                <img src={currentUser?.profile_image_url} className="w-10 h-10 rounded-full bg-[#1A1A1D] object-cover" alt="" />
                <div className="flex-1 bg-[#1A1A1D] transition-colors rounded-full px-4 py-2.5">
                  <span className="text-gray-400 text-[17px]">Post something in {activeGroup.name}...</span>
                </div>
                <div className="text-[#45BD62] hover:bg-[#1A1A1D] p-2 rounded-full transition-colors">
                  <i className="fas fa-images text-xl"></i>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {activeGroup.type === 'private' && !isMember ? (
                <div className="bg-[#0A0A0B] rounded-xl p-12 text-center border border-[#2A2A2D] mx-4 md:mx-0 shadow-sm">
                  <div className="w-16 h-16 bg-[#1A1A1D] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#2A2A2D]">
                    <i className="fas fa-lock text-gray-400 text-2xl"></i>
                  </div>
                  <h3 className="text-white font-bold text-xl mb-2">This Group is Private</h3>
                  <p className="text-gray-400 mb-8 max-w-xs mx-auto">Only members of this community can see the discussions and members.</p>
                  <button
                    onClick={() => (currentUser ? onJoinGroup(activeGroup.id) : alert('Login first'))}
                    className="bg-[#0066FF] text-white px-10 py-2.5 rounded-lg font-black shadow-lg hover:bg-[#005CE6] transition-all active:scale-95"
                  >
                    Join Group
                  </button>
                </div>
              ) : mergedPosts.length > 0 ? (
                mergedPosts.map((post: any) => (
                  <Post
                    key={post.id}
                    post={post as PostType}
                    author={
                      users.find(u => u.id === (post as any).user_id) ||
                      ({
                        id: 0,
                        username: 'guest',
                        name: 'Guest User',
                        profile_image_url: 'https://ui-avatars.com/api/?name=User&background=0066FF&color=fff',
                        followers: [],
                        following: [],
                        email: '',
                      } as User)
                    }
                    currentUser={currentUser}
                    users={users}
                    onProfileClick={onProfileClick}
                    onReact={(pid, type) => onLikePost(activeGroup.id, pid, type)}
                    onShare={pid => onSharePost(activeGroup.id, pid)}
                    onDelete={pid => onDeleteGroupPost(activeGroup.id, pid)}
                    onViewImage={() => {}}
                    onOpenComments={pid => onOpenComments(activeGroup.id, pid)}
                    onVideoClick={() => {}}
                    onPlayAudioTrack={onPlayAudioTrack}
                  />
                ))
              ) : (
                <div className="bg-[#0A0A0B] rounded-xl p-16 text-center border border-[#2A2A2D] mx-4 md:mx-0 shadow-sm">
                  <div className="w-16 h-16 bg-[#1A1A1D] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#2A2A2D]">
                    <i className="fas fa-comments text-gray-400 text-2xl"></i>
                  </div>
                  <h3 className="text-white font-bold text-lg mb-1">No posts yet</h3>
                  <p className="text-gray-400 text-sm">Be the first to start a conversation in this group!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {groupTab === 'About' && (
          <div className="bg-[#0A0A0B] rounded-xl p-8 border border-[#2A2A2D] mx-4 md:mx-0 shadow-sm animate-fade-in">
            <h3 className="text-xl font-bold text-white mb-4">About this group</h3>
            <p className="text-white text-base mb-8 leading-relaxed">{activeGroup.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-4 text-white">
                <div className="w-12 h-12 bg-[#1A1A1D] rounded-xl flex items-center justify-center">
                  <i className={`fas ${activeGroup.type === 'public' ? 'fa-globe-americas' : 'fa-lock'} text-xl text-gray-400`}></i>
                </div>
                <div>
                  <div className="font-bold">{activeGroup.type === 'public' ? 'Public' : 'Private'}</div>
                  <div className="text-xs text-gray-400">Anyone can see who&apos;s in the group and what they post.</div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-white">
                <div className="w-12 h-12 bg-[#1A1A1D] rounded-xl flex items-center justify-center">
                  <i className="fas fa-history text-xl text-gray-400"></i>
                </div>
                <div>
                  <div className="font-bold">History</div>
                  <div className="text-xs text-gray-400">
                    Created on {createdDate ? createdDate.toLocaleDateString() : 'Recently'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {groupTab === 'Members' && (
          <div className="bg-[#0A0A0B] rounded-xl border border-[#2A2A2D] mx-4 md:mx-0 overflow-hidden shadow-sm animate-fade-in">
            <div className="p-5 border-b border-[#2A2A2D] bg-[#0A0A0B]">
              <h3 className="text-white font-bold text-lg">Members · {(activeGroup.members ?? []).length}</h3>
            </div>

            <div className="p-2 space-y-1">
              {(activeGroup.members ?? []).map(memberId => {
                const member = users.find(u => u.id === memberId);
                if (!member) return null;

                return (
                  <div key={memberId} className="flex items-center justify-between p-3 hover:bg-[#1A1A1D] rounded-lg transition-colors">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onProfileClick(memberId)}>
                      <img
                        src={member.profile_image_url}
                        className="w-12 h-12 rounded-xl object-cover border border-[#2A2A2D]"
                        alt=""
                      />
                      <div className="flex flex-col">
                        <div className="font-bold text-white text-base group-hover:text-[#0066FF] transition-colors">
                          {member.name}
                        </div>
                        {memberId === activeGroup.admin_id && (
                          <div className="text-[10px] text-[#0066FF] font-black bg-[#0066FF]/10 px-2 py-0.5 rounded-full w-fit uppercase tracking-tighter border border-[#0066FF]/20">
                            Group Admin
                          </div>
                        )}
                      </div>
                    </div>

                    {isAdmin && memberId !== currentUser?.id && (
                      <button
                        onClick={() => onRemoveMember(activeGroup.id, memberId)}
                        className="text-gray-400 hover:text-white px-4 py-1.5 bg-[#1A1A1D] hover:bg-red-500/20 rounded font-bold text-sm transition-all border border-transparent hover:border-red-500/30"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showGroupPostModal && (
        <div className="fixed inset-0 z-[150] bg-[#0A0A0B] flex flex-col animate-slide-up font-sans">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2D] bg-[#0A0A0B]">
            <div className="flex items-center gap-3">
              <i
                className="fas fa-arrow-left text-white text-xl cursor-pointer"
                onClick={() => setShowGroupPostModal(false)}
              ></i>
              <h3 className="text-white text-[18px] font-bold">Post to Group</h3>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="p-6 flex items-center gap-4">
              <img
                src={currentUser?.profile_image_url}
                className="w-14 h-14 rounded-full border-2 border-[#0066FF] object-cover"
                alt=""
              />
              <div>
                <div className="font-black text-white text-lg">{currentUser?.name}</div>
                <div className="text-gray-400 text-xs font-bold uppercase tracking-widest">{activeGroup.name}</div>
              </div>
            </div>

            <div className="p-6 min-h-[200px] flex-1">
              <textarea
                className="w-full bg-transparent outline-none text-white placeholder-gray-400 resize-none text-[28px] font-medium leading-tight"
                placeholder="Share something with the community..."
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
                rows={5}
              />
            </div>

            <div className="border-t border-[#2A2A2D] bg-[#0A0A0B] p-2">
              <div
                className="flex items-center gap-4 p-4 hover:bg-[#1A1A1D] rounded-2xl cursor-pointer transition-all border border-transparent hover:border-[#2A2A2D]"
                onClick={() => postFileInputRef.current?.click()}
              >
                <div className="w-10 h-10 bg-[#45BD62]/10 rounded-full flex items-center justify-center text-[#45BD62]">
                  <i className="fas fa-images text-xl"></i>
                </div>
                <span className="text-white font-black text-lg">Add Photo/Video</span>
              </div>

              <div
                className="flex items-center gap-4 p-4 hover:bg-[#1A1A1D] rounded-2xl cursor-pointer transition-all border border-transparent hover:border-[#2A2A2D]"
                onClick={() => {
                  setShowGroupPostModal(false);
                  setShowEventModal(true);
                }}
              >
                <div className="w-10 h-10 bg-[#F7B928]/10 rounded-full flex items-center justify-center text-[#F7B928]">
                  <i className="fas fa-calendar-plus text-xl"></i>
                </div>
                <span className="text-white font-black text-lg">Host Group Event</span>
              </div>
            </div>

            <div className="p-6 bg-[#0A0A0B]">
              <button
                onClick={handlePostSubmit}
                disabled={!postContent.trim() && !postFile}
                className="w-full bg-[#0066FF] text-white font-black text-xl py-4 rounded-2xl hover:bg-[#005CE6] disabled:opacity-50 transition-all shadow-2xl active:scale-95 disabled:cursor-not-allowed"
              >
                POST TO FEED
              </button>
            </div>
          </div>

          <input
            type="file"
            ref={postFileInputRef}
            className="hidden"
            accept="image/*,video/*"
            onChange={e => {
              if (e.target.files && e.target.files[0]) setPostFile(e.target.files[0]);
            }}
          />
        </div>
      )}

      {showSettingsModal && activeGroup && (
        <GroupSettingsModal
          group={activeGroup}
          onClose={() => setShowSettingsModal(false)}
          onUpdate={settings => onUpdateGroupSettings(activeGroup.id, settings)}
          isAdmin={Boolean(isAdmin)}
          onDeleteGroup={() => {
            onDeleteGroup(activeGroup.id);
            setShowSettingsModal(false);
            setView('feed');
          }}
        />
      )}

      {showEventModal && currentUser && (
        <CreateEventModal
          currentUser={currentUser}
          onClose={() => setShowEventModal(false)}
          onCreate={event => activeGroup && onCreateGroupEvent(activeGroup.id, event)}
        />
      )}
    </div>
  );
};
