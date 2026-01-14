import React, { useState, useRef, useMemo } from 'react';
import { User, Post as PostType, ReactionType, Reel, AudioTrack } from '../types';
import { CreatePost, Post, CreatePostModal } from './Feed';

/**
 * Defensive helpers to prevent blank-screen crashes
 * when backend returns raw D1 rows (missing arrays like reactions/comments).
 */
const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeString = (v: any, fallback = '') => (typeof v === 'string' ? v : fallback);

interface EditProfileModalProps {
  user: User;
  onClose: () => void;
  onSave: (updatedData: Partial<User>) => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, onClose, onSave }) => {
  const [bio, setBio] = useState(safeString((user as any).bio, ''));
  const [work, setWork] = useState(safeString((user as any).work, ''));
  const [education, setEducation] = useState(safeString((user as any).education, ''));
  const [location, setLocation] = useState(safeString((user as any).location, ''));
  const [website, setWebsite] = useState(safeString((user as any).website, ''));

  const handleSave = () => {
    onSave({ bio, work, education, location, website });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-[#242526] w-full max-w-[600px] rounded-xl border border-[#3E4042] shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-[#3E4042] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#E4E6EB]">Edit Profile</h2>
          <div
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#3A3B3C] hover:bg-[#4E4F50] flex items-center justify-center cursor-pointer"
          >
            <i className="fas fa-times text-[#B0B3B8]"></i>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <div>
            <label className="text-[#E4E6EB] font-bold text-sm block mb-1">Bio</label>
            <textarea
              className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-3 text-[#E4E6EB] outline-none focus:border-[#1877F2] text-center"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe yourself..."
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-[#E4E6EB] font-bold text-lg">Details</h3>

            <div>
              <div className="flex items-center gap-2 mb-1 text-[#B0B3B8]">
                <i className="fas fa-briefcase w-5 text-center"></i>
                <span className="text-sm">Work</span>
              </div>
              <input
                type="text"
                className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
                value={work}
                onChange={(e) => setWork(e.target.value)}
                placeholder="Add a workplace"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1 text-[#B0B3B8]">
                <i className="fas fa-graduation-cap w-5 text-center"></i>
                <span className="text-sm">Education</span>
              </div>
              <input
                type="text"
                className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                placeholder="Add a high school or university"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1 text-[#B0B3B8]">
                <i className="fas fa-map-marker-alt w-5 text-center"></i>
                <span className="text-sm">Location</span>
              </div>
              <input
                type="text"
                className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add current city"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1 text-[#B0B3B8]">
                <i className="fas fa-link w-5 text-center"></i>
                <span className="text-sm">Website</span>
              </div>
              <input
                type="text"
                className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-2.5 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Add website link"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#3E4042] bg-[#242526] rounded-b-xl">
          <button
            onClick={handleSave}
            className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white py-2.5 rounded-lg font-bold shadow-md transition-colors"
          >
            Save Details
          </button>
        </div>
      </div>
    </div>
  );
};

interface UserProfileProps {
  user: User;
  currentUser: User | null;
  users: User[];
  posts: PostType[];
  reels?: Reel[];
  onProfileClick: (id: number) => void;

  // FB-logic actions (caller blocks guests)
  onFollow: (id: number) => void;
  onReact: (postId: number, type: ReactionType) => void;
  onComment: (postId: number, text: string) => void;
  onShare: (postId: number) => void;
  onMessage: (id: number) => void;

  onCreatePost: (text: string, file: File | null, type: any, visibility: any) => void;
  onUpdateProfileImage: (file: File) => void;
  onUpdateCoverImage: (file: File) => void;
  onUpdateUserDetails: (data: Partial<User>) => void;
  onDeletePost: (postId: number) => void;
  onEditPost: (postId: number, content: string) => void;

  getCommentAuthor: (id: number) => User | undefined;
  onViewImage: (url: string) => void;
  onCreateEventClick?: () => void;
  onOpenComments: (postId: number) => void;
  onVideoClick: (post: PostType) => void;
  onPlayAudioTrack: (track: AudioTrack) => void;

  onHashtagClick?: (tag: string) => void;
  onVerifyUser?: (id: number) => void;
  onRestrictUser?: (id: number) => void;
  onDeleteUser?: (id: number) => void;
  onMakeModerator?: (id: number) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  currentUser,
  users,
  posts,
  reels = [],
  onProfileClick,
  onFollow,
  onReact,
  onComment,
  onShare,
  onMessage,
  onCreatePost,
  onUpdateProfileImage,
  onUpdateCoverImage,
  onUpdateUserDetails,
  onDeletePost,
  onEditPost,
  getCommentAuthor,
  onViewImage,
  onCreateEventClick,
  onOpenComments,
  onVideoClick,
  onPlayAudioTrack,
  onHashtagClick,
  onVerifyUser,
  onRestrictUser,
  onDeleteUser,
  onMakeModerator,
}) => {
  const [activeTab, setActiveTab] = useState<'Posts' | 'About' | 'Followers' | 'Photos'>('Posts');
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Defensive: followers/following arrays may be missing with guest / raw user objects
  const userFollowers = useMemo(() => safeArray<number>((user as any).followers), [user]);
  const currentFollowing = useMemo(() => safeArray<number>((currentUser as any)?.following), [currentUser]);

  const isCurrentUser = Boolean(currentUser && user?.id === currentUser.id);
  const isFollowing = Boolean(currentUser && currentFollowing.includes(user.id));
  const followerCount = userFollowers.length;

  const isAdmin = (currentUser as any)?.role === 'admin';

  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Defensive: posts from API may miss reactions/comments/shares/views -> guard everywhere
  const userPosts = useMemo(
    () => safeArray<PostType>(posts).filter((post: any) => Number(post?.user_id) === Number(user?.id)),
    [posts, user?.id]
  );

  const userReels = useMemo(
    () => safeArray<Reel>(reels).filter((reel: any) => Number(reel?.user_id) === Number(user?.id)),
    [reels, user?.id]
  );

  const totalViews = useMemo(
    () => userPosts.reduce((acc, curr: any) => acc + safeNumber(curr?.views, 0), 0),
    [userPosts]
  );

  const totalLikes = useMemo(() => {
    const postLikes = userPosts.reduce((acc, curr: any) => acc + safeArray(curr?.reactions).length, 0);
    const reelLikes = userReels.reduce((acc, curr: any) => acc + safeArray(curr?.reactions).length, 0);
    return postLikes + reelLikes;
  }, [userPosts, userReels]);

  const totalShares = useMemo(() => {
    const postShares = userPosts.reduce((acc, curr: any) => acc + safeNumber(curr?.shares, 0), 0);
    const reelShares = userReels.reduce((acc, curr: any) => acc + safeNumber((curr as any)?.shares, 0), 0);
    return postShares + reelShares;
  }, [userPosts, userReels]);

  const totalComments = useMemo(() => {
    const postComments = userPosts.reduce((acc, curr: any) => acc + safeArray(curr?.comments).length, 0);
    const reelComments = userReels.reduce((acc, curr: any) => acc + safeArray((curr as any)?.comments).length, 0);
    return postComments + reelComments;
  }, [userPosts, userReels]);

  const totalEngagement = totalLikes + totalComments + totalShares;

  const safeProfileImage = safeString((user as any)?.profile_image_url, '');
  const safeCoverImage = safeString((user as any)?.cover_image_url, '');
  const safeBio = safeString((user as any)?.bio, '');

  const renderContent = () => {
    switch (activeTab) {
      case 'About':
        return (
          <div className="bg-[#242526] p-6 text-[#E4E6EB] rounded-xl border border-[#3E4042] mx-4 md:mx-0">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">About</h2>
              {isCurrentUser && (
                <button
                  onClick={() => setShowEditProfile(true)}
                  className="text-[#1877F2] font-semibold hover:underline"
                >
                  Edit
                </button>
              )}
            </div>

            <p className="text-[#B0B3B8] text-lg italic mb-6">
              "{safeString((user as any).bio, 'No bio available')}"
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <h3 className="text-xl font-bold">Work & Education</h3>
                <div className="flex items-center gap-3">
                  <i className="fas fa-briefcase text-[#B0B3B8] w-6 text-center"></i>
                  <span>
                    {(user as any).work ? `Works at ${(user as any).work}` : 'No workplace to show'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <i className="fas fa-graduation-cap text-[#B0B3B8] w-6 text-center"></i>
                  <span>
                    {(user as any).education
                      ? `Studied at ${(user as any).education}`
                      : 'No schools to show'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h3 className="text-xl font-bold">Contact & Basic Info</h3>
                <div className="flex items-center gap-3">
                  <i className="fas fa-map-marker-alt text-[#B0B3B8] w-6 text-center"></i>
                  <span>{(user as any).location || 'No location to show'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <i className="fas fa-link text-[#B0B3B8] w-6 text-center"></i>
                  <span>
                    {(user as any).website ? (
                      <a
                        href={(user as any).website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#1877F2] hover:underline"
                      >
                        {(user as any).website}
                      </a>
                    ) : (
                      'No website'
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <i className="fas fa-birthday-cake text-[#B0B3B8] w-6 text-center"></i>
                  <span>{(user as any).birth_date || 'No birth date'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <i className="fas fa-venus-mars text-[#B0B3B8] w-6 text-center"></i>
                  <span>{(user as any).gender || 'Not specified'}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'Followers':
        return (
          <div className="bg-[#242526] p-4 rounded-xl border border-[#3E4042] mx-4 md:mx-0">
            <h2 className="text-xl font-bold text-[#E4E6EB] mb-4">Followers</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {users
                .filter((u) => userFollowers.includes(u.id))
                .map((follower) => (
                  <div
                    key={follower.id}
                    className="flex items-start gap-3 p-3 border border-[#3E4042] rounded-lg hover:bg-[#3A3B3C] cursor-pointer"
                    onClick={() => onProfileClick(follower.id)}
                  >
                    <img
                      src={safeString((follower as any).profile_image_url, '')}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div>
                      <h4 className="font-semibold text-[#E4E6EB]">{(follower as any).name}</h4>
                      <span className="text-[#B0B3B8] text-sm">{(follower as any).location}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        );

      case 'Photos':
        return (
          <div className="bg-[#242526] p-4 rounded-xl border border-[#3E4042] mx-4 md:mx-0">
            <h2 className="text-xl font-bold text-[#E4E6EB] mb-4">Photos</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1">
              {userPosts
                .filter((p: any) => (p as any)?.type === 'image' && (p as any)?.media_url)
                .map((p: any) => (
                  <div
                    key={p.id}
                    className="aspect-square cursor-pointer overflow-hidden relative group"
                    onClick={() => p.media_url && onViewImage(p.media_url)}
                  >
                    <img
                      src={p.media_url}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                ))}
            </div>
          </div>
        );

      case 'Posts':
      default:
        return (
          <div className="max-w-[1095px] mx-auto w-full flex flex-col md:flex-row gap-4 px-0 md:px-4 mt-4">
            <div className="w-full md:w-[380px] flex-shrink-0 flex flex-col gap-4 px-4 md:px-0">
              {isAdmin && !isCurrentUser && (
                <div className="bg-[#242526] rounded-xl p-4 shadow-sm border border-red-900/50">
                  <h2 className="text-xl font-bold text-red-500 mb-4">Admin Controls</h2>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => onVerifyUser?.(user.id)}
                      className="w-full bg-[#263951] text-[#2D88FF] py-2 rounded font-semibold hover:bg-[#2A3F5A]"
                    >
                      {(user as any).is_verified ? 'Remove Verification' : 'Verify User'}
                    </button>
                    <button
                      onClick={() => onRestrictUser?.(user.id)}
                      className="w-full bg-yellow-900/80 text-yellow-300 py-2 rounded font-semibold hover:bg-yellow-800"
                    >
                      Suspend User (24h)
                    </button>
                    <button
                      onClick={() => onDeleteUser?.(user.id)}
                      className="w-full bg-red-900/80 text-white py-2 rounded font-semibold hover:bg-red-800 mt-2"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-[#242526] rounded-xl p-4 shadow-sm border border-[#3E4042]">
                <h2 className="text-xl font-bold text-[#E4E6EB] mb-4">Intro</h2>
                <div className="flex flex-col gap-3 text-[#E4E6EB]">
                  <div className="text-center mb-2">
                    <p className="text-[15px]">{safeBio || 'No bio available'}</p>
                  </div>
                  <div className="h-[1px] bg-[#3E4042] w-full my-1"></div>

                  {(user as any).work && (
                    <div className="flex items-center gap-3">
                      <i className="fas fa-briefcase text-[#B0B3B8] w-5 text-center"></i>
                      <span>{(user as any).work}</span>
                    </div>
                  )}
                  {(user as any).location && (
                    <div className="flex items-center gap-3">
                      <i className="fas fa-map-marker-alt text-[#B0B3B8] w-5 text-center"></i>
                      <span>{(user as any).location}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <i className="fas fa-rss text-[#B0B3B8] w-5 text-center"></i>
                    <span>{followerCount} Followers</span>
                  </div>

                  {isCurrentUser && (
                    <button
                      className="w-full bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] font-semibold py-2 rounded-md transition-colors text-[15px] mt-2"
                      onClick={() => setShowEditProfile(true)}
                    >
                      Edit Details
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {isCurrentUser && (
                <div className="bg-[#242526] rounded-xl p-4 mb-4 border border-[#3E4042] shadow-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#3A3B3C] p-3 rounded-lg border border-[#3E4042]">
                      <div className="text-[#B0B3B8] text-xs font-medium mb-1">Total Views</div>
                      <div className="text-[#E4E6EB] font-bold text-xl">
                        {safeNumber(totalViews).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-[#3A3B3C] p-3 rounded-lg border border-[#3E4042]">
                      <div className="text-[#B0B3B8] text-xs font-medium mb-1">Engagement</div>
                      <div className="text-[#E4E6EB] font-bold text-xl">
                        {safeNumber(totalEngagement).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isCurrentUser && currentUser && (
                <>
                  <CreatePost
                    currentUser={currentUser}
                    onProfileClick={onProfileClick}
                    onClick={() => setShowCreatePostModal(true)}
                  />
                  {showCreatePostModal && (
                    <CreatePostModal
                      currentUser={currentUser}
                      onClose={() => setShowCreatePostModal(false)}
                      onCreatePost={onCreatePost}
                      users={users}
                    />
                  )}
                </>
              )}

              {userPosts.map((post: any) => (
                <Post
                  key={post.id}
                  post={post}
                  author={user}
                  currentUser={currentUser}
                  onProfileClick={onProfileClick}
                  onReact={onReact}
                  onShare={onShare}
                  onDelete={onDeletePost}
                  onEdit={onEditPost}
                  onViewImage={onViewImage}
                  onOpenComments={onOpenComments}
                  onVideoClick={onVideoClick}
                  onPlayAudioTrack={onPlayAudioTrack}
                />
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full bg-[#18191A] min-h-screen">
      <input
        type="file"
        ref={profileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpdateProfileImage(file);
        }}
      />
      <input
        type="file"
        ref={coverInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpdateCoverImage(file);
        }}
      />

      <div className="bg-[#242526] shadow-sm">
        <div className="max-w-[1095px] mx-auto w-full relative">
          <div className="h-[200px] md:h-[350px] w-full bg-gray-700 relative overflow-hidden md:rounded-b-xl">
            {safeCoverImage ? (
              <img
                src={safeCoverImage}
                alt="Cover"
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => onViewImage(safeCoverImage)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">No Cover</div>
            )}

            {isCurrentUser && (
              <div
                className="absolute bottom-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-md cursor-pointer hover:bg-white/20 font-semibold text-white text-[15px] flex items-center gap-2"
                onClick={() => coverInputRef.current?.click()}
              >
                <i className="fas fa-camera"></i> Edit cover photo
              </div>
            )}
          </div>

          <div className="px-4 pb-0">
            <div className="flex flex-col md:flex-row items-center md:items-end -mt-[84px] md:-mt-[30px] relative z-10 mb-4">
              <div className="w-[168px] h-[168px] rounded-full border-[6px] border-[#242526] bg-[#242526] overflow-hidden cursor-pointer relative group">
                {safeProfileImage ? (
                  <img
                    src={safeProfileImage}
                    alt={safeString((user as any).name, 'User')}
                    className="w-full h-full object-cover"
                    onClick={() => onViewImage(safeProfileImage)}
                  />
                ) : (
                  <div className="w-full h-full bg-[#3A3B3C] flex items-center justify-center text-[#B0B3B8]">
                    No Photo
                  </div>
                )}

                {isCurrentUser && (
                  <div
                    className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center"
                    onClick={() => profileInputRef.current?.click()}
                  >
                    <i className="fas fa-camera text-white text-3xl"></i>
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col items-center md:items-start mt-4 md:mt-0 md:ml-6 text-center md:text-left md:mb-4">
                <h1 className="text-[32px] font-bold text-[#E4E6EB] flex items-center gap-2">
                  {safeString((user as any).name, 'User')}
                  {(user as any).is_verified && (
                    <i className="fas fa-check-circle text-[#1877F2] text-[20px]"></i>
                  )}
                </h1>
                <span className="text-[#B0B3B8] font-semibold text-[17px] mt-1">
                  {followerCount} Followers
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 mt-4 md:mt-0 md:mb-6">
                {isCurrentUser ? (
                  <>
                    <button
                      className="bg-[#1877F2] text-white px-4 py-2 rounded-md font-semibold flex items-center gap-2 hover:bg-[#166FE5]"
                      onClick={() => {
                        // optional: connect later
                        setShowCreatePostModal(true);
                      }}
                    >
                      <i className="fas fa-plus"></i>
                      <span>Add to story</span>
                    </button>
                    <button
                      className="bg-[#3A3B3C] text-[#E4E6EB] px-4 py-2 rounded-md font-semibold flex items-center gap-2 hover:bg-[#4E4F50]"
                      onClick={() => setShowEditProfile(true)}
                    >
                      <i className="fas fa-pen"></i>
                      <span>Edit profile</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => onFollow(user.id)}
                      className={`${
                        isFollowing ? 'bg-[#3A3B3C] text-[#E4E6EB]' : 'bg-[#1877F2] text-white'
                      } px-6 py-2 rounded-md font-semibold transition-colors`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                    <button
                      onClick={() => onMessage(user.id)}
                      className="bg-[#3A3B3C] text-[#E4E6EB] px-6 py-2 rounded-md font-semibold hover:bg-[#4E4F50]"
                    >
                      Message
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="h-[1px] bg-[#3E4042] w-full mt-4"></div>

            <div className="flex items-center gap-1 pt-1 overflow-x-auto">
              {(['Posts', 'About', 'Followers', 'Photos'] as const).map((tab) => (
                <div
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 cursor-pointer whitespace-nowrap text-[15px] font-semibold border-b-[3px] transition-colors ${
                    activeTab === tab
                      ? 'text-[#1877F2] border-[#1877F2]'
                      : 'text-[#B0B3B8] border-transparent hover:bg-[#3A3B3C] rounded-t-md'
                  }`}
                >
                  {tab}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {renderContent()}

      {showEditProfile && isCurrentUser && (
        <EditProfileModal user={user} onClose={() => setShowEditProfile(false)} onSave={onUpdateUserDetails} />
      )}
    </div>
  );
};
