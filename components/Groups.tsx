
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
      <div className="bg-[#242526] w-full max-w-[500px] rounded-xl border border-[#3E4042] shadow-2xl flex flex-col animate-slide-up">
        <div className="p-4 border-b border-[#3E4042] flex justify-between items-center">
          <h3 className="text-xl font-bold text-[#E4E6EB]">Group Settings</h3>
          <div
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] flex items-center justify-center cursor-pointer transition-colors"
          >
            <i className="fas fa-times text-[#B0B3B8]"></i>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Group Name</label>
            <input
              type="text"
              className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Description</label>
            <textarea
              className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none h-24 resize-none"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-[#3A3B3C] rounded-lg border border-[#3E4042]">
            <div>
              <div className="text-[#E4E6EB] font-bold">Member Posting</div>
              <div className="text-[#B0B3B8] text-xs">Allow members to post in the group</div>
            </div>
            <div
              className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${
                postingAllowed ? 'bg-[#1877F2]' : 'bg-gray-600'
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
            className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white py-2.5 rounded-lg font-bold transition-colors"
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
      profile_image: `https://ui-avatars.com/api/?name=${encodeURIComponent(newGroupName)}&background=random`,
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

  // FEED VIEW
  if (view === 'feed' || !activeGroup) {
    const myGroups = currentUser
      ? safeGroups.filter(g => (g.members ?? []).includes(currentUser.id) || g.admin_id === currentUser.id)
      : [];

    let suggestedGroups = currentUser
      ? safeGroups.filter(g => !(g.members ?? []).includes(currentUser.id) && g.admin_id !== currentUser.id)
      : safeGroups;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      suggestedGroups = suggestedGroups.filter(g => (g.name || '').toLowerCase().includes(q));
    }

    return (
      <div className="w-full max-w-[1000px] mx-auto p-4 font-sans pb-20">
        <div className="flex flex-col gap-4 mb-6 bg-[#242526] p-4 rounded-xl border border-[#3E4042]">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-[#E4E6EB]">Groups</h2>
              <p className="text-[#B0B3B8] text-sm">Discover and join communities.</p>
            </div>

            {currentUser && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#263951] text-[#2D88FF] hover:bg-[#2A3F5A] px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
              >
                <i className="fas fa-plus-circle"></i> <span>Create New Group</span>
              </button>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 pl-10 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
              placeholder="Search Groups..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B3B8]"></i>
          </div>
        </div>

        {myGroups.length > 0 && !searchQuery && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-[#E4E6EB] mb-3">Your Groups</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myGroups.map(group => (
                <div
                  key={group.id}
                  className="bg-[#242526] rounded-xl overflow-hidden border border-[#3E4042] cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => handleGroupClick(group)}
                >
                  <div className="h-24 relative">
                    <img src={group.cover_image} className="w-full h-full object-cover opacity-80" alt="" />
                  </div>
                  <div className="px-4 pb-4 -mt-8 relative">
                    <div className="flex justify-between items-end">
                      <img
                        src={group.profile_image}
                        className="w-16 h-16 rounded-xl border-4 border-[#242526] object-cover bg-[#242526]"
                        alt=""
                      />
                    </div>
                    <h4 className="font-bold text-lg text-[#E4E6EB] mt-2 leading-tight">{group.name}</h4>
                    <p className="text-[#B0B3B8] text-xs mt-1">
                      {(group.members ?? []).length} members • {(group.posts ?? []).length} posts
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xl font-bold text-[#E4E6EB] mb-3">{searchQuery ? 'Search Results' : 'All Groups'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestedGroups.map(group => (
              <div key={group.id} className="bg-[#242526] rounded-xl overflow-hidden border border-[#3E4042] flex flex-col">
                <div className="h-32 relative cursor-pointer" onClick={() => handleGroupClick(group)}>
                  <img src={group.cover_image} className="w-full h-full object-cover" alt="" />
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white font-bold uppercase">
                    {group.type}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <h4
                    className="font-bold text-lg text-[#E4E6EB] mb-1 cursor-pointer hover:underline"
                    onClick={() => handleGroupClick(group)}
                  >
                    {group.name}
                  </h4>
                  <p className="text-[#B0B3B8] text-sm mb-4 line-clamp-2">{group.description}</p>

                  <div className="mt-auto">
                    <div className="flex items-center gap-2 mb-3 text-xs text-[#B0B3B8]">
                      <span>{(group.members ?? []).length} members</span>
                    </div>

                    <button
                      onClick={() => (currentUser ? onJoinGroup(group.id) : alert('Login first'))}
                      className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white py-2 rounded-lg font-semibold transition-colors"
                    >
                      Join Group
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#242526] w-full max-w-[500px] rounded-xl border border-[#3E4042] shadow-2xl overflow-hidden animate-slide-up">
              <div className="p-4 border-b border-[#3E4042] flex justify-between items-center">
                <h3 className="text-xl font-bold text-[#E4E6EB]">Create Group</h3>
                <div
                  onClick={() => setShowCreateModal(false)}
                  className="w-8 h-8 rounded-full bg-[#3A3B3C] flex items-center justify-center cursor-pointer hover:bg-[#4E4F50]"
                >
                  <i className="fas fa-times text-[#B0B3B8]"></i>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Name</label>
                  <input
                    type="text"
                    className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2 text-[#E4E6EB] outline-none"
                    placeholder="Name your group"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Description</label>
                  <textarea
                    className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2 text-[#E4E6EB] outline-none h-24"
                    placeholder="What is this group about?"
                    value={newGroupDesc}
                    onChange={e => setNewGroupDesc(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[#B0B3B8] text-sm font-bold mb-1">Privacy</label>
                  <select
                    className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2 text-[#E4E6EB] outline-none"
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
                  className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50"
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
    <div className="w-full bg-[#18191A] min-h-screen pb-10">
      <div className="bg-[#242526] border-b border-[#3E4042] shadow-sm mb-4 animate-fade-in">
        <div className="max-w-[1100px] mx-auto">
          <div className="h-[200px] md:h-[350px] relative group bg-[#3A3B3C] md:rounded-b-xl overflow-hidden">
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
                <div className="w-[100px] h-[100px] md:w-[140px] md:h-[140px] rounded-xl border-4 border-[#242526] overflow-hidden bg-[#242526] shadow-xl">
                  <img src={activeGroup.profile_image} className="w-full h-full object-cover" alt="" />
                </div>
                {canManage && (
                  <div
                    className="absolute bottom-2 right-2 bg-[#3A3B3C] p-2 rounded-full cursor-pointer hover:bg-[#4E4F50] shadow-md transition-colors"
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
                <h1 className="text-2xl md:text-4xl font-bold text-[#E4E6EB] leading-tight mb-1">{activeGroup.name}</h1>
                <div className="flex items-center gap-2 text-[#B0B3B8] text-sm font-semibold">
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
                      className="bg-[#1877F2] text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#166FE5] flex-1 md:flex-none transition-all"
                    >
                      <i className="fas fa-plus"></i> Invite
                    </button>

                    <button className="bg-[#3A3B3C] text-[#E4E6EB] px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#4E4F50] flex-1 md:flex-none transition-all">
                      <i className="fas fa-check"></i> Joined
                    </button>

                    {canManage && (
                      <button
                        onClick={() => setShowSettingsModal(true)}
                        className="bg-[#3A3B3C] text-[#E4E6EB] px-3 py-2 rounded-lg font-bold hover:bg-[#4E4F50] transition-all"
                      >
                        <i className="fas fa-cog"></i>
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => (currentUser ? onJoinGroup(activeGroup.id) : alert('Login first'))}
                    className="bg-[#1877F2] text-white px-8 py-2 rounded-lg font-bold text-base hover:bg-[#166FE5] w-full md:w-auto transition-all shadow-lg"
                  >
                    Join Group
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-[#3E4042] mt-4"></div>

            <div className="flex items-center gap-1 pt-1 overflow-x-auto scrollbar-hide">
              {(['Discussion', 'Events', 'Members', 'About'] as const).map(tab => (
                <div
                  key={tab}
                  onClick={() => setGroupTab(tab)}
                  className={`px-5 py-3 cursor-pointer font-bold text-base border-b-[3px] transition-all whitespace-nowrap ${
                    groupTab === tab
                      ? 'text-[#1877F2] border-[#1877F2]'
                      : 'text-[#B0B3B8] border-transparent hover:bg-[#3A3B3C] rounded-t-lg'
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
                className="bg-[#242526] rounded-xl p-3 mb-4 border border-[#3E4042] shadow-sm flex gap-3 items-center cursor-pointer mx-2 md:mx-0 transition-colors hover:bg-[#3A3B3C]"
                onClick={() => setShowGroupPostModal(true)}
              >
                <img src={currentUser?.profile_image_url} className="w-10 h-10 rounded-full bg-[#3A3B3C] object-cover" alt="" />
                <div className="flex-1 bg-[#3A3B3C] transition-colors rounded-full px-4 py-2.5">
                  <span className="text-[#B0B3B8] text-[17px]">Post something in {activeGroup.name}...</span>
                </div>
                <div className="text-[#45BD62] hover:bg-[#3A3B3C] p-2 rounded-full transition-colors">
                  <i className="fas fa-images text-xl"></i>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {activeGroup.type === 'private' && !isMember ? (
                <div className="bg-[#242526] rounded-xl p-12 text-center border border-[#3E4042] mx-4 md:mx-0 shadow-sm">
                  <div className="w-16 h-16 bg-[#3A3B3C] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#3E4042]">
                    <i className="fas fa-lock text-[#B0B3B8] text-2xl"></i>
                  </div>
                  <h3 className="text-[#E4E6EB] font-bold text-xl mb-2">This Group is Private</h3>
                  <p className="text-[#B0B3B8] mb-8 max-w-xs mx-auto">Only members of this community can see the discussions and members.</p>
                  <button
                    onClick={() => (currentUser ? onJoinGroup(activeGroup.id) : alert('Login first'))}
                    className="bg-[#1877F2] text-white px-10 py-2.5 rounded-lg font-black shadow-lg hover:bg-[#166FE5] transition-all active:scale-95"
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
                        profile_image_url: 'https://ui-avatars.com/api/?name=User&background=random',
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
                <div className="bg-[#242526] rounded-xl p-16 text-center border border-[#3E4042] mx-4 md:mx-0 shadow-sm">
                  <div className="w-16 h-16 bg-[#3A3B3C] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#3E4042]">
                    <i className="fas fa-comments text-[#B0B3B8] text-2xl"></i>
                  </div>
                  <h3 className="text-[#E4E6EB] font-bold text-lg mb-1">No posts yet</h3>
                  <p className="text-[#B0B3B8] text-sm">Be the first to start a conversation in this group!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {groupTab === 'About' && (
          <div className="bg-[#242526] rounded-xl p-8 border border-[#3E4042] mx-4 md:mx-0 shadow-sm animate-fade-in">
            <h3 className="text-xl font-bold text-[#E4E6EB] mb-4">About this group</h3>
            <p className="text-[#E4E6EB] text-base mb-8 leading-relaxed">{activeGroup.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-4 text-[#E4E6EB]">
                <div className="w-12 h-12 bg-[#3A3B3C] rounded-xl flex items-center justify-center">
                  <i className={`fas ${activeGroup.type === 'public' ? 'fa-globe-americas' : 'fa-lock'} text-xl text-[#B0B3B8]`}></i>
                </div>
                <div>
                  <div className="font-bold">{activeGroup.type === 'public' ? 'Public' : 'Private'}</div>
                  <div className="text-xs text-[#B0B3B8]">Anyone can see who&apos;s in the group and what they post.</div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[#E4E6EB]">
                <div className="w-12 h-12 bg-[#3A3B3C] rounded-xl flex items-center justify-center">
                  <i className="fas fa-history text-xl text-[#B0B3B8]"></i>
                </div>
                <div>
                  <div className="font-bold">History</div>
                  <div className="text-xs text-[#B0B3B8]">
                    Created on {createdDate ? createdDate.toLocaleDateString() : 'Recently'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {groupTab === 'Members' && (
          <div className="bg-[#242526] rounded-xl border border-[#3E4042] mx-4 md:mx-0 overflow-hidden shadow-sm animate-fade-in">
            <div className="p-5 border-b border-[#3E4042] bg-[#1C1D1E]">
              <h3 className="text-[#E4E6EB] font-bold text-lg">Members · {(activeGroup.members ?? []).length}</h3>
            </div>

            <div className="p-2 space-y-1">
              {(activeGroup.members ?? []).map(memberId => {
                const member = users.find(u => u.id === memberId);
                if (!member) return null;

                return (
                  <div key={memberId} className="flex items-center justify-between p-3 hover:bg-[#3A3B3C] rounded-lg transition-colors">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onProfileClick(memberId)}>
                      <img
                        src={member.profile_image_url}
                        className="w-12 h-12 rounded-xl object-cover border border-[#3E4042]"
                        alt=""
                      />
                      <div className="flex flex-col">
                        <div className="font-bold text-[#E4E6EB] text-base group-hover:text-[#1877F2] transition-colors">
                          {member.name}
                        </div>
                        {memberId === activeGroup.admin_id && (
                          <div className="text-[10px] text-[#1877F2] font-black bg-[#1877F2]/10 px-2 py-0.5 rounded-full w-fit uppercase tracking-tighter border border-[#1877F2]/20">
                            Group Admin
                          </div>
                        )}
                      </div>
                    </div>

                    {isAdmin && memberId !== currentUser?.id && (
                      <button
                        onClick={() => onRemoveMember(activeGroup.id, memberId)}
                        className="text-[#B0B3B8] hover:text-white px-4 py-1.5 bg-[#3A3B3C] hover:bg-red-500/20 rounded font-bold text-sm transition-all border border-transparent hover:border-red-500/30"
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
        <div className="fixed inset-0 z-[150] bg-[#18191A] flex flex-col animate-slide-up font-sans">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#3E4042] bg-[#242526]">
            <div className="flex items-center gap-3">
              <i
                className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
                onClick={() => setShowGroupPostModal(false)}
              ></i>
              <h3 className="text-[#E4E6EB] text-[18px] font-bold">Post to Group</h3>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="p-6 flex items-center gap-4">
              <img
                src={currentUser?.profile_image_url}
                className="w-14 h-14 rounded-full border-2 border-[#1877F2] object-cover"
                alt=""
              />
              <div>
                <div className="font-black text-[#E4E6EB] text-lg">{currentUser?.name}</div>
                <div className="text-[#B0B3B8] text-xs font-bold uppercase tracking-widest">{activeGroup.name}</div>
              </div>
            </div>

            <div className="p-6 min-h-[200px] flex-1">
              <textarea
                className="w-full bg-transparent outline-none text-[#E4E6EB] placeholder-[#B0B3B8] resize-none text-[28px] font-medium leading-tight"
                placeholder="Share something with the community..."
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
                rows={5}
              />
            </div>

            <div className="border-t border-[#3E4042] bg-[#1C1D1E] p-2">
              <div
                className="flex items-center gap-4 p-4 hover:bg-[#3A3B3C] rounded-2xl cursor-pointer transition-all border border-transparent hover:border-[#3E4042]"
                onClick={() => postFileInputRef.current?.click()}
              >
                <div className="w-10 h-10 bg-[#45BD62]/10 rounded-full flex items-center justify-center text-[#45BD62]">
                  <i className="fas fa-images text-xl"></i>
                </div>
                <span className="text-[#E4E6EB] font-black text-lg">Add Photo/Video</span>
              </div>

              <div
                className="flex items-center gap-4 p-4 hover:bg-[#3A3B3C] rounded-2xl cursor-pointer transition-all border border-transparent hover:border-[#3E4042]"
                onClick={() => {
                  setShowGroupPostModal(false);
                  setShowEventModal(true);
                }}
              >
                <div className="w-10 h-10 bg-[#F7B928]/10 rounded-full flex items-center justify-center text-[#F7B928]">
                  <i className="fas fa-calendar-plus text-xl"></i>
                </div>
                <span className="text-[#E4E6EB] font-black text-lg">Host Group Event</span>
              </div>
            </div>

            <div className="p-6 bg-[#242526]">
              <button
                onClick={handlePostSubmit}
                disabled={!postContent.trim() && !postFile}
                className="w-full bg-[#1877F2] text-white font-black text-xl py-4 rounded-2xl hover:bg-[#166FE5] disabled:opacity-50 transition-all shadow-2xl active:scale-95"
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
