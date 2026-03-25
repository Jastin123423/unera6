/**
 * =========================
 * ✅ MAIN POST COMPONENT
 * =========================
 */
export const Post = memo(
  ({
    post,
    author,
    currentUser,
    users = [],
    onProfileClick,
    onReact,
    onShare,
    onDelete,
    onEdit,
    onViewImage,
    onOpenComments,
    onVideoClick,
    onPlayAudioTrack,
    onHashtagClick,
    onViewProductFromPost,
    onOpenGroup,
    onOpenAudio,
    onRSVP,
    groups = [],
    brands = [],
    chats = [],
    isFollowing = false,
    onFollow,
    followLoading = false,
    onEventClick,
    onOpenReactions,
    onReport,
    onHide,
    pushButton,
  }: {
    post: PostType;
    author: User | any;
    currentUser: User | null;
    users?: User[];
    onProfileClick: (id: number) => void;
    onReact: (post: PostType, type: ReactionType) => void;
    onShare: (id: number, newShareCount: number) => void;
    onDelete?: (id: number) => void;
    onEdit?: (id: number, content: string) => void;
    onViewImage: (url: string) => void;
    onOpenComments: (post: PostType) => void;
    onVideoClick: (p: PostType) => void;
    onPlayAudioTrack?: (t: AudioTrack) => void;
    onHashtagClick?: (tag: string) => void;
    onViewProductFromPost?: (productId: number) => void;
    onOpenGroup?: (groupId: number) => void;
    onOpenAudio?: (item: any) => void;
    onRSVP?: (eventId: number, status: 'going' | 'interested' | 'not_going') => Promise<void>;
    groups?: Group[];
    brands?: Brand[];
    chats?: any[];
    isFollowing?: boolean;
    onFollow?: (id: number) => void;
    followLoading?: boolean;
    onEventClick?: (eventId: number) => void;
    onOpenReactions?: (postId: number) => void;
    onReport?: (postId: number, reason?: string) => void;
    onHide?: (postId: number) => void;
    pushButton?: React.ReactNode;
  }) => {
    const { onViewProduct, getProductData } = useContext(MarketplaceContext);
    const p: any = post as any;
    const a: any = author as any;
    const meta: any = p?.meta || {};

    const isMarketplace =
      p?.type === 'marketplace' ||
      p?.post_type === 'product' ||
      p?.type === 'product' ||
      p?.kind === 'product' ||
      meta?.type === 'product' ||
      meta?.kind === 'product' ||
      !!p?.product_id ||
      !!p?.meta?.marketplace?.id;

    const isEventPost =
      p?.item_type === 'event' ||
      String(p?.feed_key || '').startsWith('event:') ||
      p?.source === 'event' ||
      p?.type === 'event' ||
      p?.post_type === 'event' ||
      meta?.type === 'event' ||
      meta?.kind === 'event' ||
      !!p?.event_id ||
      !!meta?.event;

    if (isEventPost) {
      const event = normalizeEventFromFeed(p);
      return (
        <EventPost
          event={event}
          author={a}
          currentUser={currentUser}
          users={users}
          onProfileClick={onProfileClick}
          onRSVP={onRSVP}
          onFollow={onFollow}
          isFollowing={isFollowing}
          followLoading={followLoading}
          onReact={(id, type) => onReact(post, type)}
          onShare={onShare}
          onOpenComments={(id) => onOpenComments(post)}
          groups={groups}
          brands={brands}
          chats={chats}
          onEventClick={onEventClick}
        />
      );
    }

    const productId = isMarketplace ? getMarketplaceProductId(p) : null;
    const productData = productId ? getProductData?.(productId) : null;

    const mpImages = isMarketplace ? getMarketplaceImages(p, productData) : [];
    const { price, currency, loc } = isMarketplace
      ? getMarketplacePriceLine(productData)
      : { price: null, currency: 'TZS', loc: 'Marketplace' };

    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [showReactionsSheet, setShowReactionsSheet] = useState(false);
    const [showShareSheet, setShowShareSheet] = useState(false);

    const isMusic = meta?.kind === 'music' || meta?.type === 'music';
    const isPodcast = meta?.kind === 'podcast' || meta?.type === 'podcast';
    const song = meta?.song;
    const podcast = meta?.podcast;

    const isGroupPost = !!(p?.group_id || p?.group);
    const groupId = Number(
      p?.group_id || p?.groupId || meta?.group_id || meta?.groupId || 0
    );
    const groupName =
      p?.group_name || p?.groupName || meta?.group_name || meta?.groupName || '';
    const group = p?.group || groups?.find((g) => g.id === groupId);

    const myReaction = p.myReaction ?? p.my_reaction ?? null;
    const likesCount = Number(
      p.likesCount ?? p.reactionsCount ?? p.reactions_count ?? 0
    );
    const reactionsArr: any[] = Array.isArray(p.reactions)
      ? p.reactions
      : Array.isArray(p.reactions_preview)
      ? p.reactions_preview
      : [];

    const reactorNameFromApi = String(p.reactor_name ?? p.reactorName ?? '').trim();

    const finalMyReaction: ReactionType | undefined =
      myReaction ||
      (currentUser && reactionsArr.length
        ? (reactionsArr.find(
            (r: any) => Number(r.user_id) === safeUserId(currentUser)
          )?.type as ReactionType)
        : undefined);

    const finalReactionCount = likesCount > 0 ? likesCount : reactionsArr.length;

    const [commentCount, setCommentCount] = useState(() => {
      if (typeof p.comments_count === 'number') return p.comments_count;
      if (Array.isArray(p.comments)) return p.comments.length;
      return 0;
    });

    const [shareCount, setShareCount] = useState(() =>
      safeNumber(p.shares ?? p.shares_count, 0)
    );

    const createdAtLabel = formatRelativeTime(p.created_at);
    const postId = safePostId(p);

    const mediaInfo = getMediaTypeInfo(p);
    const mediaList = useMemo(() => getPostMediaList(p), [p]);
    const imageMedia = mediaList.filter((m) => m.kind === 'image');
    const videoMedia = mediaList.filter((m) => m.kind === 'video');

    const formatCount = (count: number): string => {
      if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
      if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
      return count.toString();
    };

    const emojiList = useMemo(() => {
      if (reactionsArr.length > 0) {
        const em = topReactionEmojis(reactionsArr, 2);
        return em.length ? em : ['👍'];
      }
      return finalReactionCount > 0 ? ['👍'] : [];
    }, [reactionsArr, finalReactionCount]);

    const reactorName = useMemo(() => {
      if (!finalReactionCount) return '';
      if (reactionsArr.length) {
        const name = pickStableReactorName(postId, reactionsArr, users);
        return String(name || '').trim();
      }
      return reactorNameFromApi;
    }, [postId, finalReactionCount, reactionsArr, users, reactorNameFromApi]);

    const reactionText = useMemo(() => {
      if (!finalReactionCount || !reactorName) return '';
      return formatReactionText(finalReactionCount, reactorName);
    }, [finalReactionCount, reactorName]);

    useEffect(() => {
      const newCommentCount =
        typeof p.comments_count === 'number'
          ? p.comments_count
          : Array.isArray(p.comments)
          ? p.comments.length
          : 0;
      if (newCommentCount !== commentCount) {
        setCommentCount(newCommentCount);
      }

      const newShareCount = safeNumber(p.shares ?? p.shares_count, 0);
      if (newShareCount !== shareCount) {
        setShareCount(newShareCount);
      }
    }, [p.comments_count, p.comments, p.shares, p.shares_count]);

    const handleShareComplete = (destination: string, data?: any) => {
      const nextShares = safeNumber(data?.shares ?? data?.share_count, NaN);
      if (data?.success && Number.isFinite(nextShares)) {
        setShareCount(nextShares);
        onShare(postId, nextShares);
      }
      setShowShareSheet(false);
    };

    const handleFollowClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (onFollow && a.id) onFollow(safeUserId(a));
    };

    const getReactionEndpoint = (item: any) => {
      if (item.source === 'group_post' || item.item_type === 'group_post')
        return `/api/groups/${item.group_id}/posts/${item.id}/react`;
      else if (item.source === 'product' || item.item_type === 'product')
        return `/api/products/${item.product_id || item.id}/react`;
      else if (item.source === 'reel' || item.item_type === 'reel')
        return `/api/reels/${item.reel_id || item.id}/react`;
      else if (item.source === 'song' || item.item_type === 'song')
        return `/api/songs/${item.song_id2 || item.id}/react`;
      else if (item.source === 'podcast' || item.item_type === 'podcast')
        return `/api/podcasts/${item.podcast_id || item.id}/react`;
      else return `/api/posts/${item.id}/react`;
    };

    const handleReactClick = async (type: ReactionType) => {
      if (!currentUser) {
        alert('Please login to react.');
        return;
      }
      const endpoint = getReactionEndpoint(p);
      try {
        await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({ user_id: currentUser.id, type: type }),
        });
        onReact(post, type);
      } catch (error) {
        console.error('Failed to react:', error);
      }
    };

    const openGallery = (urls: string[], index: number) => {
      setGalleryUrls(urls);
      setGalleryIndex(index);
      setGalleryOpen(true);
    };

    const handleOpenComments = (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (currentUser) {
        onOpenComments(post);
      } else {
        alert('Please login to comment');
      }
    };

    return (
      <>
        <div className="w-full relative">
          <div className="bg-[#242526] w-full overflow-hidden">
            {isGroupPost ? (
              <GroupPostHeader
                post={p}
                group={group}
                author={a}
                onOpenGroup={(id) => onOpenGroup?.(id)}
                onOpenProfile={(id) => onProfileClick(id)}
              />
            ) : (
              <div className="p-3 md:p-4 flex items-center justify-between">
                <div
                  className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                  onClick={() => onProfileClick(safeUserId(a))}
                >
                  <img
                    src={avatarFrom(a)}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-[#3E4042]"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <h4 className="font-bold text-[#E4E6EB] text-[20px] cursor-pointer hover:underline truncate">
                        {a.name || a.username || 'User'}
                      </h4>
                      {a.is_verified && (
                        <i className="fas fa-check-circle text-[#1877F2] text-[15px]"></i>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[#B0B3B8] text-[15px]">
                      <span>{createdAtLabel}</span>
                      <span>•</span>
                      <i className="fas fa-globe-americas text-[14px]"></i>
                      {p.location && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[160px]">
                            {String(p.location).split(',')[0]}
                          </span>
                        </>
                      )}
                      {p.feeling && (
                        <>
                          <span>•</span>
                          <span>feeling {p.feeling}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {onFollow && currentUser && safeUserId(a) !== safeUserId(currentUser) && (
                  <button
                    onClick={handleFollowClick}
                    disabled={followLoading}
                    className={`px-3 py-1.5 text-[15px] font-bold rounded-lg transition-all duration-200 ml-2 ${
                      isFollowing
                        ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                        : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                    } ${followLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {followLoading ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : isFollowing ? (
                      'Following'
                    ) : (
                      'Follow'
                    )}
                  </button>
                )}

                <PostMenu
                  item={{
                    id: postId,
                    user_id: safeUserId(a),
                    type: isMarketplace
                      ? 'product'
                      : isGroupPost
                      ? 'group_post'
                      : 'post',
                    content: p.content,
                    caption: p.caption,
                    group_id: groupId,
                  }}
                  currentUser={currentUser}
                  onShare={(item) => setShowShareSheet(true)}
                />
              </div>
            )}

            {isMarketplace && (
              <div className="px-4 pb-2 flex items-center gap-2 text-[#E4E6EB]">
                <span className="text-[#1877F2] font-bold text-[15px] bg-[#1877F2]/10 px-2 py-1 rounded-full">
                  Marketplace
                </span>
                {loc && (
                  <div className="flex items-center gap-1 text-[#B0B3B8]">
                    <i className="fas fa-map-marker-alt text-[14px] text-[#F02849]"></i>
                    <span className="text-[15px]">{loc}</span>
                  </div>
                )}
              </div>
            )}

            {p.content && !isMarketplace && (
              <div className="px-3 md:px-4 pb-2">
                <ExpandableRichText
                  text={String(p.content)}
                  users={users}
                  onProfileClick={onProfileClick}
                  onHashtagClick={onHashtagClick}
                  maxWords={14}
                  fontSizePx={23}
                />
              </div>
            )}

            {(isMusic || isPodcast) && (
              <div className="mx-3 md:mx-4 mb-3 bg-[#18191A] border border-[#3E4042] rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <img
                    src={
                      (isMusic ? song?.cover_image_url : podcast?.cover_image_url) ||
                      ''
                    }
                    className="w-14 h-14 rounded-xl object-cover bg-[#242526]"
                    alt=""
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="text-white font-bold text-[17px] truncate">
                      {(isMusic ? song?.title : podcast?.title) || 'Untitled'}
                    </div>
                    <div className="text-[#B0B3B8] text-[14px] truncate">
                      {isMusic ? song?.artist_name : podcast?.description}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAudio?.(isMusic ? song : podcast);
                    }}
                    className="bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold px-4 py-2 rounded-xl text-[15px]"
                  >
                    Play
                  </button>
                </div>
              </div>
            )}

            {p.link_preview && !mediaInfo.mediaUrl && !isMarketplace && (
              <div
                className="mx-3 md:mx-4 mb-2 bg-[#242526] border border-[#3E4042] overflow-hidden cursor-pointer hover:bg-[#3A3B3C] transition-colors rounded-lg"
                onClick={() =>
                  window.open(p.link_preview.url, '_blank', 'noopener noreferrer')
                }
              >
                {p.link_preview.image && (
                  <div className="w-full h-48 bg-[#3A3B3C] overflow-hidden">
                    <img
                      src={p.link_preview.image}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="p-4 bg-[#3A3B3C]">
                  <div className="text-[#B0B3B8] text-[13px] uppercase font-bold mb-1">
                    {p.link_preview.domain}
                  </div>
                  <div className="text-[#E4E6EB] font-bold text-[19px] mb-1 line-clamp-2">
                    {p.link_preview.title}
                  </div>
                  <div className="text-[#B0B3B8] text-[16px] line-clamp-3">
                    {p.link_preview.description}
                  </div>
                </div>
              </div>
            )}

            {p.background && !mediaInfo.mediaUrl && !isMarketplace && (
              <div
                className="h-[300px] flex items-center justify-center p-8 text-center text-white font-bold text-2xl"
                style={{ background: p.background, backgroundSize: 'cover' }}
              >
                {p.content}
              </div>
            )}

            {isMarketplace ? (
              <>
                {mpImages.length > 0 && (
                  <div className="w-full">
                    <div className="w-full bg-black">
                      <MediaGrid
                        media={mpImages.map((url) => ({ url }))}
                        onOpen={(url, index) => {
                          openGallery(mpImages, index);
                        }}
                      />
                    </div>
                  </div>
                )}

                {price && (
                  <div className="px-4 py-2 flex items-center justify-between border-t border-[#3E4042] mt-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[#E4E6EB] text-[19px] font-bold">
                        {currency}
                      </span>
                      <span className="text-[#E4E6EB] text-[22px] font-bold">
                        {price}
                      </span>
                    </div>

                    <button
                      className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-1.5 rounded-full font-bold text-[15px] transition-colors shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (productId) onViewProduct?.(productId);
                      }}
                    >
                      View product
                    </button>
                  </div>
                )}

                <div className="px-3 md:px-4 py-2.5 flex items-center justify-between text-[#B0B3B8] text-[16px] border-t border-[#3E4042]">
                  <div className="flex items-center gap-2">
                    {finalReactionCount > 0 && (
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenReactions) {
                            onOpenReactions(postId);
                          } else {
                            setShowReactionsSheet(true);
                          }
                        }}
                      >
                        <div className="flex -space-x-2">
                          {emojiList.slice(0, 2).map((e, i) => (
                            <span
                              key={i}
                              className="w-[24px] h-[24px] rounded-full bg-[#3A3B3C] border border-[#242526] flex items-center justify-center text-[16px]"
                              style={{ zIndex: 10 - i }}
                            >
                              {e}
                            </span>
                          ))}
                        </div>

                        {reactionText && (
                          <span className="text-[17px] text-[#E4E6EB] font-bold">
                            {reactionText}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <span
                      className="hover:underline cursor-pointer text-[16px]"
                      onClick={() => handleOpenComments()}
                    >
                      {formatCount(commentCount)} Discussions
                    </span>
                    {shareCount > 0 && (
                      <span className="hover:underline text-[16px]">
                        {formatCount(shareCount)} Shares
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-2 py-1 border-t border-white/10 flex items-center justify-between">
                  <ReactionButton
                    currentUserReactions={finalMyReaction}
                    reactionCount={finalReactionCount}
                    onReact={handleReactClick}
                    isGuest={!currentUser}
                  />
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenComments(e);
                    }}
                  >
                    <DiscussSignalIcon size={28} color="#1877F2" />
                    <span className="text-[19px] font-bold text-[#B0B3B8] group-hover:text-[#E4E6EB]">
                      Discuss
                    </span>
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
                    onClick={() => {
                      if (!currentUser) {
                        alert('Please login to share posts.');
                        return;
                      }
                      setShowShareSheet(true);
                    }}
                  >
                    <i className="fas fa-share text-[22px]"></i>
                    <span className="text-[19px] font-bold">Share</span>
                  </button>
                  {pushButton && <div className="ml-2">{pushButton}</div>}
                </div>
              </>
            ) : (
              <>
                {!p.background && imageMedia.length > 0 && (
                  <MediaGrid
                    media={imageMedia.map((m) => ({ url: m.url }))}
                    onOpen={(url, index) => {
                      const urls = imageMedia.map((m) => m.url);
                      openGallery(urls, index);
                    }}
                  />
                )}

                {!p.background && videoMedia.length > 0 && (
                  <div
                    className="cursor-pointer relative h-[500px] bg-black"
                    onClick={() => onVideoClick(post)}
                  >
                    <video
                      src={videoMedia[0].url}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      playsInline
                      muted
                      onError={(e) => {
                        console.error('Failed to load video:', videoMedia[0].url);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <i className="fas fa-play text-white text-4xl opacity-50"></i>
                    </div>
                  </div>
                )}

                {!p.background && mediaInfo.mediaUrl && mediaInfo.isAudio && onPlayAudioTrack && (
                  <div className="my-3">
                    {(() => {
                      const cover =
                        (p as any).song_cover_image_url ||
                        imageMedia?.[0]?.url ||
                        a.profile_image_url;

                      const titleText = p.content || 'Audio';
                      const artistText =
                        (p as any).song_artist_name || a.name || 'Unknown';

                      return (
                        <div className="rounded-lg overflow-hidden border border-[#3E4042] bg-[#3A3B3C]">
                          {cover ? (
                            <div className="relative">
                              <img
                                src={cover}
                                alt="Cover"
                                className="w-full h-[260px] md:h-[320px] object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  const img = e.currentTarget as HTMLImageElement;
                                  if (
                                    a.profile_image_url &&
                                    img.src !== a.profile_image_url
                                  ) {
                                    img.src = a.profile_image_url;
                                  }
                                }}
                              />

                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                              <div className="absolute left-3 right-3 bottom-3">
                                <div className="p-3 rounded-lg bg-[#2F3031]/90 border border-[#3E4042] backdrop-blur-sm">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#2F3031] flex-shrink-0">
                                      <img
                                        src={cover}
                                        alt="Mini cover"
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="text-[#E4E6EB] font-bold text-[17px]">
                                        Audio Track
                                      </div>
                                      <div className="text-[#B0B3B8] text-[15px] truncate">
                                        {titleText}
                                      </div>
                                      <div className="text-[#B0B3B8] text-[14px] truncate">
                                        {artistText}
                                      </div>
                                    </div>

                                    <button
                                      onClick={() =>
                                        onPlayAudioTrack!({
                                          id: postId,
                                          title: titleText,
                                          artist: artistText,
                                          url: mediaInfo.mediaUrl,
                                          duration: 0,
                                          coverImage: cover || a.profile_image_url,
                                        })
                                      }
                                      className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-2 rounded-lg font-bold text-[15px] transition-colors flex-shrink-0"
                                    >
                                      <i className="fas fa-play mr-1"></i> Play
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-[#3A3B3C]">
                              <div className="flex items-center gap-3">
                                <i className="fas fa-music text-[#1877F2] text-2xl"></i>
                                <div className="flex-1">
                                  <div className="text-[#E4E6EB] font-bold text-[17px]">
                                    Audio Track
                                  </div>
                                  <div className="text-[#B0B3B8] text-[15px]">
                                    {p.content || 'Listen to audio'}
                                  </div>
                                </div>
                                <button
                                  onClick={() =>
                                    onPlayAudioTrack!({
                                      id: postId,
                                      title: titleText,
                                      artist: artistText,
                                      url: mediaInfo.mediaUrl,
                                      duration: 0,
                                      coverImage: a.profile_image_url,
                                    })
                                  }
                                  className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-2 rounded-lg font-bold text-[15px] transition-colors"
                                >
                                  <i className="fas fa-play mr-1"></i> Play
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="px-3 md:px-4 py-2.5 flex items-center justify-between text-[#B0B3B8] text-[16px] border-t border-[#3E4042]">
                  <div className="flex items-center gap-2">
                    {finalReactionCount > 0 && (
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenReactions) {
                            onOpenReactions(postId);
                          } else {
                            setShowReactionsSheet(true);
                          }
                        }}
                      >
                        <div className="flex -space-x-2">
                          {emojiList.slice(0, 2).map((e, i) => (
                            <span
                              key={i}
                              className="w-[24px] h-[24px] rounded-full bg-[#3A3B3C] border border-[#242526] flex items-center justify-center text-[16px]"
                              style={{ zIndex: 10 - i }}
                            >
                              {e}
                            </span>
                          ))}
                        </div>

                        {reactionText && (
                          <span className="text-[17px] text-[#E4E6EB] font-bold">
                            {reactionText}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <span
                      className="hover:underline cursor-pointer text-[16px]"
                      onClick={() => handleOpenComments()}
                    >
                      {formatCount(commentCount)} Discussions
                    </span>
                    {shareCount > 0 && (
                      <span className="hover:underline text-[16px]">
                        {formatCount(shareCount)} Shares
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-2 py-1 border-t border-white/10 flex items-center justify-between">
                  <ReactionButton
                    currentUserReactions={finalMyReaction}
                    reactionCount={finalReactionCount}
                    onReact={handleReactClick}
                    isGuest={!currentUser}
                  />
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenComments(e);
                    }}
                  >
                    <DiscussSignalIcon size={28} color="#1877F2" />
                    <span className="text-[19px] font-bold text-[#B0B3B8] group-hover:text-[#E4E6EB]">
                      Discuss
                    </span>
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
                    onClick={() => {
                      if (!currentUser) {
                        alert('Please login to share posts.');
                        return;
                      }
                      setShowShareSheet(true);
                    }}
                  >
                    <i className="fas fa-share text-[22px]"></i>
                    <span className="text-[19px] font-bold">Share</span>
                  </button>
                  {pushButton && <div className="ml-2">{pushButton}</div>}
                </div>
              </>
            )}
          </div>

          <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
        </div>

        <ShareBottomSheet
          isOpen={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          post={{
            ...p,
            source: isMarketplace ? 'product' : isGroupPost ? 'group_post' : 'post',
            item_type: isMarketplace ? 'product' : isGroupPost ? 'group_post' : 'post',
            product_id: productId,
            group_id: groupId,
          }}
          currentUser={currentUser}
          users={users}
          groups={groups}
          brands={brands}
          chats={chats}
          onShareComplete={handleShareComplete}
        />

        <ReactionsSheet
          isOpen={showReactionsSheet}
          onClose={() => setShowReactionsSheet(false)}
          postId={postId}
          onProfileClick={onProfileClick}
          onOpenComments={() => onOpenComments(post)}
        />

        <GalleryViewer
          isOpen={galleryOpen}
          urls={galleryUrls}
          startIndex={galleryIndex}
          onClose={() => setGalleryOpen(false)}
          postId={postId}
          currentUser={currentUser}
          reactionCount={finalReactionCount}
          commentCount={commentCount}
          shareCount={shareCount}
          myReaction={finalMyReaction}
          onReact={(type) => onReact(post, type)}
          onOpenComments={() => handleOpenComments()}
          onShare={() => setShowShareSheet(true)}
          onOpenReactions={() => {
            if (onOpenReactions) {
              onOpenReactions(postId);
            } else {
              setShowReactionsSheet(true);
            }
          }}
        />
      </>
    );
  },
  postPropsEqual
);

/**
 * =========================
 * ✅ CREATE POST CARD
 * =========================
 */
export const CreatePost: React.FC<{
  currentUser: User;
  onProfileClick: (id: number) => void;
  onClick: () => void;
  onPhotoClick: () => void;
  onVideoClick: () => void;
  onCreateEventClick: () => void;
}> = ({ currentUser, onProfileClick, onClick, onPhotoClick, onVideoClick, onCreateEventClick }) => (
  <div className="w-full">
    <div className="bg-[#242526] w-full p-3 md:p-4">
      <div className="flex gap-2 mb-3">
        <img
          src={avatarFrom(currentUser)}
          alt=""
          className="w-10 h-10 rounded-full object-cover cursor-pointer border border-[#3E4042]"
          onClick={() => onProfileClick(safeUserId(currentUser))}
        />
        <div
          className="flex-1 bg-[#3A3B3C] rounded-full px-4 py-2 hover:bg-[#4E4F50] cursor-pointer flex items-center transition-colors"
          onClick={onClick}
        >
          <span className="text-[#B0B3B8] text-[19px] truncate">
            What's on your mind,{' '}
            {String((currentUser as any).name || '').split(' ')[0] || 'there'}?
          </span>
        </div>
      </div>

      <div className="border-t border-[#3E4042] pt-2 flex justify-between">
        <div
          className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors"
          onClick={onClick}
        >
          <i className="fas fa-video text-[#F3425F] text-[24px]"></i>
          <span className="text-[#B0B3B8] font-bold text-[17px] hidden sm:block">
            Live Video
          </span>
        </div>

        <div
          className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors"
          onClick={onPhotoClick}
        >
          <i className="fas fa-image text-[#45BD62] text-[24px]"></i>
          <span className="text-[#B0B3B8] font-bold text-[17px] hidden sm:block">
            Photo
          </span>
        </div>

        <div
          className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors"
          onClick={onVideoClick}
        >
          <i className="fas fa-camera text-[#F3425F] text-[24px]"></i>
          <span className="text-[#B0B3B8] font-bold text-[17px] hidden sm:block">
            Video
          </span>
        </div>

        <div
          className="flex items-center justify-center flex-1 gap-2 p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer transition-colors"
          onClick={onCreateEventClick}
        >
          <i className="fas fa-calendar-alt text-[#F7B928] text-[24px]"></i>
          <span className="text-[#B0B3B8] font-bold text-[17px] hidden sm:block">
            Create Event
          </span>
        </div>
      </div>
    </div>

    <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
  </div>
);

/**
 * =========================
 * ✅ CREATE POST MODAL
 * =========================
 */
export const CreatePostModal = memo(
  ({
    currentUser,
    users,
    onClose,
    onCreatePost,
    onCreateEventClick,
    onOpenRecorder,
  }: {
    currentUser: User;
    users: User[];
    onClose: () => void;
    onCreatePost: (
      text: string,
      files: File[],
      meta?: {
        type?: 'text' | 'image' | 'video';
        visibility?: string;
        location?: string;
        feeling?: string;
        taggedUsers?: number[];
        background?: string;
        linkPreview?: LinkPreview | null;
      }
    ) => void;
    onCreateEventClick?: () => void;
    onOpenRecorder?: () => void;
  }) => {
    const [view, setView] = useState<'main' | 'tag' | 'feeling' | 'location'>('main');
    const [text, setText] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [type, setType] = useState<'text' | 'image' | 'video'>('text');
    const [visibility] = useState<'Public' | 'Friends'>('Public');
    const [activeBackground, setActiveBackground] = useState('');
    const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
    const [isFetchingPreview, setIsFetchingPreview] = useState(false);
    const [taggedUsers, setTaggedUsers] = useState<number[]>([]);
    const [feeling, setFeeling] = useState('');
    const [location, setLocation] = useState('');
    const [locQuery, setLocQuery] = useState('');
    const [locResults, setLocResults] = useState<any[]>([]);
    const [locLoading, setLocLoading] = useState(false);
    const searchTimeout = useRef<any>(null);
    const previewTimeout = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (previewTimeout.current) {
        clearTimeout(previewTimeout.current);
      }

      if (files.length > 0 || activeBackground) {
        setLinkPreview(null);
        return;
      }

      previewTimeout.current = setTimeout(async () => {
        setIsFetchingPreview(true);
        try {
          const preview = await getLinkPreview(text);
          setLinkPreview(preview);
        } catch (error) {
          console.debug('Failed to fetch link preview');
          setLinkPreview(null);
        } finally {
          setIsFetchingPreview(false);
        }
      }, 800);

      return () => {
        if (previewTimeout.current) {
          clearTimeout(previewTimeout.current);
        }
      };
    }, [text, files, activeBackground]);

    useEffect(() => {
      return () => {
        previews.forEach((p) => URL.revokeObjectURL(p));
      };
    }, [previews]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(e.target.files || []);
      if (list.length === 0) return;

      const images = list.filter((f) => f.type.startsWith('image/'));
      const videos = list.filter((f) => f.type.startsWith('video/'));

      if (videos.length > 0) {
        const v = videos[0];
        setFiles([v]);
        setPreviews([URL.createObjectURL(v)]);
        setType('video');
      } else {
        setFiles(images.slice(0, 9));
        setPreviews(images.slice(0, 9).map((f) => URL.createObjectURL(f)));
        setType('image');
      }

      setActiveBackground('');
      setLinkPreview(null);
      setView('main');

      if (e.target) {
        e.target.value = '';
      }
    };

    const handleLocationSearch = async (q: string) => {
      if (q.trim().length < 3) {
        setLocResults([]);
        return;
      }
      setLocLoading(true);
      try {
        const data = await apiFetch(`/api/locations/search?q=${encodeURIComponent(q)}`);
        setLocResults(Array.isArray(data) ? data : []);
      } catch {
        setLocResults([]);
      } finally {
        setLocLoading(false);
      }
    };

    const onLocQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocQuery(val);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => handleLocationSearch(val), 450);
    };

    const canPost = !!text.trim() || files.length > 0 || !!activeBackground;

    const submit = () => {
      if (!canPost) return;
      onCreatePost(text, files, {
        type: files.length ? type : 'text',
        visibility,
        location: location || undefined,
        feeling: feeling || undefined,
        taggedUsers: taggedUsers.length ? taggedUsers : undefined,
        background: activeBackground || undefined,
        linkPreview: linkPreview || null,
      });
      onClose();
    };

    const OptionsItem = ({
      icon,
      color,
      label,
      onClick,
    }: {
      icon: string;
      color: string;
      label: string;
      onClick?: () => void;
    }) => (
      <div
        className="flex items-center gap-3 p-3 hover:bg-[#3A3B3C] active:bg-[#3A3B3C] cursor-pointer transition-colors"
        onClick={onClick}
      >
        <i className={`${icon} text-[26px] w-8 text-center`} style={{ color }}></i>
        <span className="text-[#E4E6EB] text-[19px] font-bold">{label}</span>
      </div>
    );

    if (view === 'tag') {
      return (
        <div className="fixed inset-0 z-[200] bg-[#18191A] flex flex-col animate-slide-up font-sans">
          <div className="flex items-center p-4 border-b border-[#3E4042] gap-4">
            <i
              className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
              onClick={() => setView('main')}
            ></i>
            <h3 className="text-[#E4E6EB] text-[21px] font-bold">Tag People</h3>
            <button
              onClick={() => setView('main')}
              className="ml-auto text-[#1877F2] font-bold text-[17px]"
            >
              Done
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {users
              .filter((u: any) => safeUserId(u) !== safeUserId(currentUser))
              .map((u: any) => (
                <div
                  key={safeUserId(u)}
                  className="flex items-center justify-between p-2 hover:bg-[#3A3B3C] rounded-lg cursor-pointer"
                  onClick={() =>
                    setTaggedUsers((prev) =>
                      prev.includes(safeUserId(u))
                        ? prev.filter((uid) => uid !== safeUserId(u))
                        : [...prev, safeUserId(u)]
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={avatarFrom(u)}
                      className="w-10 h-10 rounded-full object-cover"
                      alt=""
                    />
                    <span className="text-[#E4E6EB] font-bold text-[17px]">
                      {u.name || u.username || 'User'}
                    </span>
                  </div>
                  {taggedUsers.includes(safeUserId(u)) && (
                    <i className="fas fa-check-circle text-[#1877F2] text-xl"></i>
                  )}
                </div>
              ))}
          </div>
        </div>
      );
    }

    if (view === 'feeling') {
      return (
        <div className="fixed inset-0 z-[200] bg-[#18191A] flex flex-col animate-slide-up font-sans">
          <div className="flex items-center p-4 border-b border-[#3E4042] gap-4">
            <i
              className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
              onClick={() => setView('main')}
            ></i>
            <h3 className="text-[#E4E6EB] text-[21px] font-bold">How are you feeling?</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-2">
            {FEELINGS.map((f) => (
              <div
                key={f}
                className="p-3 bg-[#242526] rounded-lg text-center cursor-pointer hover:bg-[#3A3B3C] text-[#E4E6EB] text-[17px]"
                onClick={() => {
                  setFeeling(f);
                  setView('main');
                }}
              >
                {f}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (view === 'location') {
      return (
        <div className="fixed inset-0 z-[200] bg-[#18191A] flex flex-col animate-slide-up font-sans">
          <div className="flex items-center p-4 border-b border-[#3E4042] gap-4">
            <i
              className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
              onClick={() => setView('main')}
            ></i>
            <h3 className="text-[#E4E6EB] text-[21px] font-bold">Search Location</h3>
          </div>

          <div className="p-4 flex-1 flex flex-col overflow-hidden">
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Where are you?"
                className="w-full bg-[#3A3B3C] rounded-xl p-4 pl-12 text-[#E4E6EB] outline-none focus:ring-2 focus:ring-[#1877F2] transition-all text-[17px]"
                autoFocus
                value={locQuery}
                onChange={onLocQueryChange}
              />
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#B0B3B8]"></i>
              {locLoading && (
                <i className="fas fa-spinner fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-[#1877F2]"></i>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {locResults.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {locResults.map((loc, i) => {
                    const display =
                      loc.display_name ||
                      loc.name ||
                      loc.label ||
                      `${loc.city || ''}${loc.country ? `, ${loc.country}` : ''}`.trim();

                    const title = (display || '').split(',')[0] || 'Location';

                    return (
                      <div
                        key={i}
                        className="flex items-center gap-4 p-4 hover:bg-[#3A3B3C] rounded-xl cursor-pointer border border-[#3E4042]/30 transition-colors group"
                        onClick={() => {
                          setLocation(display);
                          setView('main');
                        }}
                      >
                        <div className="w-12 h-12 bg-[#3A3B3C] rounded-xl flex items-center justify-center group-hover:bg-[#1877F2] transition-colors">
                          <i className="fas fa-location-dot text-[#E4E6EB]"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[#E4E6EB] font-bold block truncate text-[17px]">
                            {title}
                          </span>
                          <span className="text-[#B0B3B8] text-[14px] block truncate">
                            {display}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : locQuery.length >= 3 && !locLoading ? (
                <div className="text-center py-10">
                  <i className="fas fa-map-marked-alt text-4xl text-[#3A3B3C] mb-4"></i>
                  <p className="text-[#B0B3B8] text-[17px]">No matching locations found.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-[14px] font-bold text-[#B0B3B8] uppercase tracking-widest mb-2 px-1">
                    Nearby Suggestions
                  </p>
                  {LOCATIONS_DATA.slice(0, 6).map((loc) => (
                    <div
                      key={loc.name}
                      className="flex items-center gap-4 p-3 hover:bg-[#3A3B3C] rounded-xl cursor-pointer transition-colors"
                      onClick={() => {
                        setLocation(loc.name);
                        setView('main');
                      }}
                    >
                      <div className="w-10 h-10 bg-[#3A3B3C] rounded-full flex items-center justify-center text-xl">
                        {loc.flag}
                      </div>
                      <span className="text-[#E4E6EB] font-bold text-[17px]">{loc.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-[200] bg-[#18191A] flex flex-col animate-slide-up font-sans">
        <div className="flex items-center justify-between p-4 border-b border-[#3E4042]">
          <div className="flex items-center gap-4">
            <i
              className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
              onClick={onClose}
            ></i>
            <h3 className="text-[#E4E6EB] text-[22px] font-bold">Create Post</h3>
          </div>
          <button
            onClick={submit}
            disabled={!canPost}
            className="text-[#E4E6EB] font-bold text-[19px] disabled:text-[#B0B3B8]"
          >
            POST
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={avatarFrom(currentUser)}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <div className="flex items-center gap-1 flex-wrap">
                  <h4 className="font-bold text-[#E4E6EB] text-[19px]">
                    {(currentUser as any).name || (currentUser as any).username || 'User'}
                  </h4>
                  {feeling && (
                    <span className="text-[#E4E6EB] text-[17px]"> is feeling {feeling}</span>
                  )}
                  {location && (
                    <span className="text-[#E4E6EB] text-[17px]">
                      {' '}
                      in {location.split(',')[0]}
                    </span>
                  )}
                  {taggedUsers.length > 0 && (
                    <span className="text-[#E4E6EB] text-[17px]">
                      {' '}
                      with {taggedUsers.length} others
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <div className="bg-[#3A3B3C] rounded-md px-2 py-1 inline-flex items-center gap-1 text-[15px] font-bold text-[#E4E6EB] border border-[#3E4042]">
                    <i className="fas fa-globe-americas text-[14px]"></i>
                    <span>{visibility}</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`relative min-h-[150px] mb-4 transition-all ${
                activeBackground
                  ? 'flex items-center justify-center p-8 rounded-lg text-center min-h-[300px]'
                  : ''
              }`}
              style={{ background: activeBackground, backgroundSize: 'cover' }}
            >
              <textarea
                className={`w-full bg-transparent outline-none text-[#E4E6EB] placeholder-[#B0B3B8] resize-none ${
                  activeBackground
                    ? 'text-center font-bold text-3xl drop-shadow-md placeholder-white/70'
                    : 'text-[26px]'
                }`}
                placeholder="What's on your mind?"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={activeBackground ? 4 : 5}
              />
            </div>

            {isFetchingPreview && (
              <div className="mb-4 p-4 bg-[#242526] border border-[#3E4042] rounded-lg flex items-center justify-center">
                <i className="fas fa-spinner fa-spin text-[#1877F2] mr-2"></i>
                <span className="text-[#B0B3B8] text-[17px]">Loading link preview...</span>
              </div>
            )}

            {linkPreview && files.length === 0 && !activeBackground && (
              <div
                className="mb-4 bg-[#242526] border border-[#3E4042] rounded-lg overflow-hidden cursor-pointer hover:bg-[#3A3B3C] transition-colors"
                onClick={() =>
                  window.open(linkPreview.url, '_blank', 'noopener noreferrer')
                }
              >
                {linkPreview.image && (
                  <img
                    src={linkPreview.image}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-3 bg-[#3A3B3C]">
                  <div className="text-[#B0B3B8] text-[13px] uppercase font-bold mb-1">
                    {linkPreview.domain}
                  </div>
                  <div className="text-[#E4E6EB] font-bold text-[19px] mb-1 line-clamp-1">
                    {linkPreview.title}
                  </div>
                  <div className="text-[#B0B3B8] text-[16px] line-clamp-2">
                    {linkPreview.description}
                  </div>
                </div>
              </div>
            )}

            {previews.length > 0 && (
              <div className="relative rounded-lg overflow-hidden border border-[#3E4042] mb-4">
                <div
                  onClick={() => {
                    setFiles([]);
                    setPreviews([]);
                    setType('text');
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center cursor-pointer hover:bg-black/80 z-10"
                >
                  <i className="fas fa-times text-white"></i>
                </div>

                {type === 'video' ? (
                  <video
                    src={previews[0]}
                    controls
                    className="w-full h-auto max-h-[400px] bg-black"
                  />
                ) : (
                  <div
                    className={`grid ${
                      previews.length === 1 ? 'grid-cols-1' : 'grid-cols-3'
                    } gap-1 bg-black`}
                  >
                    {previews.slice(0, 9).map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        className={`${
                          previews.length === 1
                            ? 'w-full h-auto max-h-[400px] object-contain'
                            : 'w-full h-28 object-cover'
                        }`}
                        alt=""
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {previews.length === 0 && (
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                <div
                  className={`w-8 h-8 rounded-lg cursor-pointer border-2 bg-[#3A3B3C] flex items-center justify-center flex-shrink-0 ${
                    !activeBackground ? 'border-white' : 'border-[#3E4042]'
                  }`}
                  onClick={() => setActiveBackground('')}
                >
                  <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
                    <i className="fas fa-font text-black text-xs"></i>
                  </div>
                </div>

                {BACKGROUNDS.filter((b) => b.id !== 'none').map((bg) => (
                  <div
                    key={bg.id}
                    className={`w-8 h-8 rounded-lg cursor-pointer border-2 flex-shrink-0 ${
                      activeBackground === bg.value ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ background: bg.value, backgroundSize: 'cover' }}
                    onClick={() => setActiveBackground(bg.value)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#3E4042]">
            <OptionsItem
              icon="fas fa-image"
              color="#45BD62"
              label="Photo"
              onClick={() => fileInputRef.current?.click()}
            />

            <OptionsItem
              icon="fas fa-camera"
              color="#F3425F"
              label="Video"
              onClick={() => {
                onClose();
                if (onOpenRecorder) onOpenRecorder();
              }}
            />

            <OptionsItem
              icon="fas fa-user-tag"
              color="#1877F2"
              label="Tag people"
              onClick={() => setView('tag')}
            />
            <OptionsItem
              icon="far fa-smile"
              color="#F7B928"
              label="Feeling/activity"
              onClick={() => setView('feeling')}
            />
            <OptionsItem
              icon="fas fa-map-marker-alt"
              color="#F02849"
              label="Check in"
              onClick={() => setView('location')}
            />
            <div
              className="flex items-center gap-3 p-3 hover:bg-[#3A3B3C] active:bg-[#3A3B3C] cursor-pointer transition-colors border-t border-[#3E4042]/50 mt-2"
              onClick={() => {
                onClose();
                if (onCreateEventClick) onCreateEventClick();
              }}
            >
              <i
                className="fas fa-calendar-alt text-[26px] w-8 text-center"
                style={{ color: '#F7B928' }}
              ></i>
              <span className="text-[#E4E6EB] text-[19px] font-bold">Create Event</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#3E4042]">
          <button
            onClick={submit}
            disabled={!canPost}
            className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold py-3 rounded-lg transition-colors disabled:bg-[#3A3B3C] text-[19px] shadow-sm"
          >
            POST
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
        />
      </div>
    );
  },
  (prev, next) => {
    return prev.currentUser?.id === next.currentUser?.id;
  }
);

// ==================== COMMENTS CACHE ====================
const commentsCache = new Map<number, { data: any[]; timestamp: number; postId: number }>();

/**
 * =========================
 * ✅ COMMENTS SHEET
 * =========================
 */
export const CommentsSheet = memo(
  ({
    post,
    currentUser,
    users,
    onClose,
    onComment,
    onCommentAdded,
    onLikeComment,
    getCommentAuthor,
    onProfileClick,
    onHashtagClick,
    onFollow,
    checkIsFollowing,
    onViewProductFromPost,
    onOpenAudio,
  }: {
    post: PostType;
    currentUser: User;
    users: User[];
    onClose: () => void;
    onComment?: (postId: number, text: string) => void;
    onCommentAdded?: () => void;
    onLikeComment?: (commentId: number) => void;
    getCommentAuthor?: (id: number) => User | undefined;
    onProfileClick: (id: number) => void;
    onHashtagClick?: (tag: string) => void;
    onFollow?: (id: number) => void;
    checkIsFollowing?: (id: number) => boolean;
    onViewProductFromPost?: (productId: number) => void;
    onOpenAudio?: (item: any) => void;
  }) => {
    const { onViewProduct, getProductData } = useContext(MarketplaceContext);

    const p: any = post as any;
    const postId = safePostId(p);

    // Detect if this is a group post
    const isGroupPost = !!(p as any)?.group_id || !!(p as any)?.group;
    const groupId = (p as any)?.group_id || (p as any)?.group?.id;

    const discussionsTopRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [text, setText] = useState('');
    const [comments, setComments] = useState<any[]>([]);
    const [replyTo, setReplyTo] = useState<any | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});

    // Helper function to get the correct comment endpoint based on post type
    const getCommentEndpoint = () => {
      const p = post as any;
      const viewerId = safeUserId(currentUser);

      if (p.source === 'event' || p.item_type === 'event') {
        const eventId = p.event_id || p.id;
        return `/api/events/${eventId}/comments?viewerId=${viewerId}`;
      } else if (p.source === 'group_post' || p.item_type === 'group_post') {
        const groupId = p.group_id;
        const postId = p.id;
        return `/api/groups/${groupId}/posts/${postId}/comments?viewerId=${viewerId}`;
      } else if (p.source === 'product' || p.item_type === 'product') {
        const productId = p.product_id || p.id;
        return `/api/products/${productId}/reviews?viewerId=${viewerId}`;
      } else if (p.source === 'reel' || p.item_type === 'reel') {
        const reelId = p.reel_id || p.id;
        return `/api/reels/${reelId}/comments?viewerId=${viewerId}`;
      } else if (p.source === 'song' || p.item_type === 'song') {
        const songId = p.song_id2 || p.id;
        return `/api/songs/${songId}/comments?viewerId=${viewerId}`;
      } else if (p.source === 'podcast' || p.item_type === 'podcast') {
        const podcastId = p.podcast_id || p.id;
        return `/api/podcasts/${podcastId}/comments?viewerId=${viewerId}`;
      } else {
        return `/api/posts/${p.id}/comments?viewerId=${viewerId}`;
      }
    };

    // Helper function for adding new comments
    const getAddCommentEndpoint = () => {
      const p = post as any;

      if (p.source === 'event' || p.item_type === 'event') {
        const eventId = p.event_id || p.id;
        return `/api/events/${eventId}/comment`;
      } else if (p.source === 'group_post' || p.item_type === 'group_post') {
        const groupId = p.group_id;
        const postId = p.id;
        return `/api/groups/${groupId}/posts/${postId}/comment`;
      } else if (p.source === 'product' || p.item_type === 'product') {
        const productId = p.product_id || p.id;
        return `/api/products/${productId}/review`;
      } else if (p.source === 'reel' || p.item_type === 'reel') {
        const reelId = p.reel_id || p.id;
        return `/api/reels/${reelId}/comment`;
      } else if (p.source === 'song' || p.item_type === 'song') {
        const songId = p.song_id2 || p.id;
        return `/api/songs/${songId}/comment`;
      } else if (p.source === 'podcast' || p.item_type === 'podcast') {
        const podcastId = p.podcast_id || p.id;
        return `/api/podcasts/${podcastId}/comment`;
      } else {
        return `/api/posts/${p.id}/comment`;
      }
    };

    // Helper function for replies
    const getReplyEndpoint = (commentId: number) => {
      const p = post as any;

      if (p.source === 'event' || p.item_type === 'event') {
        return `/api/event-comments/${commentId}/reply`;
      } else if (p.source === 'group_post' || p.item_type === 'group_post') {
        return `/api/group-post-comments/${commentId}/reply`;
      } else if (p.source === 'product' || p.item_type === 'product') {
        return `/api/product-reviews/${commentId}/reply`;
      } else if (p.source === 'reel' || p.item_type === 'reel') {
        return `/api/reel-comments/${commentId}/reply`;
      } else if (p.source === 'song' || p.item_type === 'song') {
        return `/api/song-comments/${commentId}/reply`;
      } else if (p.source === 'podcast' || p.item_type === 'podcast') {
        return `/api/podcast-comments/${commentId}/reply`;
      } else {
        return `/api/comments/${commentId}/reply`;
      }
    };

    // Helper function for likes
    const getLikeEndpoint = (commentId: number) => {
      const p = post as any;

      if (p.source === 'event' || p.item_type === 'event') {
        return `/api/event-comments/${commentId}/like`;
      } else if (p.source === 'group_post' || p.item_type === 'group_post') {
        return `/api/group-post-comments/${commentId}/like`;
      } else if (p.source === 'product' || p.item_type === 'product') {
        return `/api/product-reviews/${commentId}/like`;
      } else if (p.source === 'reel' || p.item_type === 'reel') {
        return `/api/reel-comments/${commentId}/like`;
      } else if (p.source === 'song' || p.item_type === 'song') {
        return `/api/song-comments/${commentId}/like`;
      } else if (p.source === 'podcast' || p.item_type === 'podcast') {
        return `/api/podcast-comments/${commentId}/like`;
      } else {
        return `/api/comments/${commentId}/like`;
      }
    };

    useEffect(() => {
      const t = setTimeout(() => {
        discussionsTopRef.current?.scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });
      }, 0);

      return () => clearTimeout(t);
    }, [postId]);

    const meta: any = p?.meta || {};

    const isMarketplace =
      p?.type === 'marketplace' ||
      p?.post_type === 'product' ||
      p?.type === 'product' ||
      p?.kind === 'product' ||
      meta?.type === 'product' ||
      meta?.kind === 'product' ||
      !!p?.product_id ||
      !!p?.meta?.marketplace?.id;

    const productId = isMarketplace ? getMarketplaceProductId(p) : null;
    const productData = productId ? getProductData?.(productId) : null;

    const mpImages = isMarketplace ? getMarketplaceImages(p, productData) : [];
    const { price, currency, loc } = isMarketplace
      ? getMarketplacePriceLine(productData)
      : { price: null, currency: 'TZS', loc: 'Marketplace' };

    const isMusic = meta?.kind === 'music' || meta?.type === 'music';
    const isPodcast = meta?.kind === 'podcast' || meta?.type === 'podcast';
    const song = meta?.song;
    const podcast = meta?.podcast;

    const mediaInfo = getMediaTypeInfo(p);
    const mediaList = useMemo(() => getPostMediaList(p), [p]);
    const imageMedia = mediaList.filter((m) => m.kind === 'image');
    const videoMedia = mediaList.filter((m) => m.kind === 'video');

    const textPreview = getPostTextPreview(p, 140);

    const resolveAuthor = (c: any) => {
      const uid = Number(
        c?.user_id ?? c?.userId ?? c?.author_id ?? c?.authorId ?? 0
      );

      const u =
        (Number.isFinite(uid) ? users.find((x: any) => Number(x?.id) === uid) : null) ||
        (getCommentAuthor ? getCommentAuthor(uid) : null) ||
        null;

      const name =
        String(c?.author_name ?? c?.authorName ?? '').trim() ||
        String(u?.name ?? '').trim() ||
        String(u?.username ?? '').trim() ||
        'User';

      const image = avatarFrom({
        profile_image_url: c?.author_image ?? c?.authorImage ?? u?.profile_image_url,
        name,
        username: u?.username ?? c?.author_username ?? c?.username,
      });

      return { uid, name, image };
    };

    const getReplyLabel = (comment: any) => {
      const a = resolveAuthor(comment);
      const uid = a.uid;

      const user = users.find((x: any) => Number(x?.id) === uid);
      const username = String(
        comment?.author_username ?? user?.username ?? comment?.username ?? ''
      ).trim();

      const display = username ? `@${username}` : a.name;
      return { ...a, username, display };
    };

    const formatCount = (count: number): string => {
      if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
      if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
      return count.toString();
    };

    const handleLikeComment = async (comment: any) => {
      if (!currentUser) return;

      const optimisticLiked = !comment.liked_by_me;
      const optimisticCount = comment.liked_by_me
        ? Math.max(0, (comment.likes_count || 0) - 1)
        : (comment.likes_count || 0) + 1;

      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id
            ? { ...c, liked_by_me: optimisticLiked, likes_count: optimisticCount }
            : c
        )
      );

      if (onLikeComment) {
        onLikeComment(comment.id);
      }

      try {
        const endpoint = getLikeEndpoint(comment.id);
        await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({ user_id: safeUserId(currentUser) }),
        });
      } catch (error) {
        console.error('Failed to like comment:', error);
        setComments((prev) =>
          prev.map((c) =>
            c.id === comment.id
              ? { ...c, liked_by_me: !optimisticLiked, likes_count: comment.likes_count || 0 }
              : c
          )
        );
      }
    };

    const handleFollowClick = (e: React.MouseEvent, userId: number) => {
      e.stopPropagation();
      e.preventDefault();
      if (onFollow && userId && userId !== safeUserId(currentUser)) {
        onFollow(userId);
      }
    };

    const fetchCommentsSilently = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        const endpoint = getCommentEndpoint();
        const data = await apiFetch(endpoint);
        const arr = Array.isArray(data) ? data : data?.comments || [];

        if (arr.length > 0) {
          setComments(arr);
          commentsCache.set(postId, {
            data: arr,
            timestamp: Date.now(),
            postId,
          });
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return;
        }
        console.debug('Silent comment fetch failed:', error);
      }
    };

    useEffect(() => {
      const initializeComments = async () => {
        const cached = commentsCache.get(postId);
        if (cached) {
          setComments(cached.data);
        }

        const postComments = Array.isArray(p.comments) ? p.comments : [];
        if (postComments.length > 0 && (!cached || postComments.length > cached.data.length)) {
          setComments(postComments);
          commentsCache.set(postId, {
            data: postComments,
            timestamp: Date.now(),
            postId,
          });
        }

        fetchCommentsSilently();
      };

      initializeComments();

      return () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, [postId, p.comments]);

    const idKey = (v: any) => String(v ?? '').trim();

    const buildThreads = (list: any[]) => {
      const roots = list.filter((c) => !c.parent_comment_id);

      const repliesByParent = new Map<string, any[]>();

      list.forEach((c) => {
        const pid = idKey(c.parent_comment_id);
        if (!pid) return;

        if (!repliesByParent.has(pid)) repliesByParent.set(pid, []);
        repliesByParent.get(pid)!.push(c);
      });

      repliesByParent.forEach((arr) => {
        arr.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      });

      return roots.map((root) => ({
        root,
        replies: repliesByParent.get(idKey(root.id)) || [],
      }));
    };

    const toggleThread = (rootId: any, open: boolean) => {
      const key = String(rootId);
      setExpandedThreads((prev) => ({ ...prev, [key]: open }));
    };

    const threads = useMemo(() => buildThreads(comments), [comments]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const t = text.trim();
      if (!t) return;

      const replyDisplay = replyTo?._reply_author?.display;
      const prefix = replyDisplay ? `${replyDisplay} ` : '';
      const finalText = replyTo && !t.startsWith(prefix) ? prefix + t : t;

      const optimisticComment = {
        id: `tmp-${Date.now()}`,
        post_id: postId,
        user_id: safeUserId(currentUser),
        text: finalText,
        parent_comment_id: replyTo?.id || null,
        created_at: new Date().toISOString(),
        replies_count: 0,
        likes_count: 0,
        liked_by_me: false,
      };

      setText('');
      setReplyTo(null);
      setShowEmojiPicker(false);

      setComments((prev) => {
        const next = [...prev, optimisticComment];
        const allComments = commentsCache.get(postId)?.data || [];
        commentsCache.set(postId, {
          data: [...allComments, optimisticComment],
          timestamp: Date.now(),
          postId,
        });
        return next;
      });

      if (onComment) {
        onComment(postId, finalText);
      }

      try {
        let endpoint = '';

        if (replyTo) {
          endpoint = getReplyEndpoint(replyTo.id);
        } else {
          endpoint = getAddCommentEndpoint();
        }

        await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            text: finalText,
            user_id: safeUserId(currentUser),
            parent_comment_id: replyTo?.id || null,
          }),
        });

        if (onCommentAdded) {
          console.log('🔄 Calling onCommentAdded to refresh post:', postId);
          onCommentAdded();
        }

        fetchCommentsSilently();
      } catch (err: any) {
        console.error('Failed to post comment:', err);
      }
    };

    const addEmoji = (emoji: string) => {
      setText((prev) => prev + emoji);
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    };

    useEffect(() => {
      const handleFocus = () => {
        const cached = commentsCache.get(postId);
        if (cached && Date.now() - cached.timestamp > 30000) {
          fetchCommentsSilently();
        }
      };

      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    }, [postId]);

    const postAuthor = p.author || {
      name: p.name,
      username: p.username,
      profile_image_url: p.profile_image_url,
      id: p.user_id || p.author_id,
    };

    const renderOneComment = (comment: any, isReply: boolean = false) => {
      const a = resolveAuthor(comment);
      const isCurrentUserComment = a.uid === safeUserId(currentUser);
      const isFollowing = checkIsFollowing ? checkIsFollowing(a.uid) : false;

      return (
        <div className={`flex gap-3 ${isReply ? 'mt-3' : ''}`}>
          <img
            src={a.image}
            className="w-9 h-9 rounded-full object-cover cursor-pointer flex-shrink-0"
            alt=""
            onClick={() => a.uid && onProfileClick(a.uid)}
          />

          <div className="flex-1 min-w-0">
            <div className="mb-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[#E4E6EB] font-bold text-[18px] cursor-pointer hover:underline"
                    onClick={() => a.uid && onProfileClick(a.uid)}
                  >
                    {a.name}
                  </span>
                  <span className="text-[#B0B3B8] text-[14px]">
                    •{' '}
                    {formatRelativeTime(
                      comment.created_at || comment.createdAt || comment.timestamp
                    )}
                  </span>
                </div>

                {onFollow && currentUser && a.uid && !isCurrentUserComment && (
                  <button
                    onClick={(e) => handleFollowClick(e, a.uid)}
                    className={`px-2 py-0.5 text-[14px] font-bold rounded-lg transition-all duration-200 ml-2 ${
                      isFollowing
                        ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                        : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            </div>

            <div className="text-[#E4E6EB] text-[19px] font-bold whitespace-pre-wrap break-words mb-2">
              <RichText
                text={String(comment.text || '')}
                users={users}
                onProfileClick={onProfileClick}
                onHashtagClick={onHashtagClick}
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => handleLikeComment(comment)}
                className={`text-[15px] ${
                  comment.liked_by_me
                    ? 'text-[#1877F2] font-bold'
                    : 'text-[#B0B3B8] hover:text-[#E4E6EB]'
                }`}
              >
                {comment.liked_by_me ? 'Liked' : 'Like'}
              </button>
              <button
                onClick={() => {
                  const target = getReplyLabel(comment);
                  setReplyTo({
                    ...comment,
                    _reply_author: target,
                  });
                  inputRef.current?.focus();
                  setShowEmojiPicker(false);
                }}
                className="text-[15px] text-[#B0B3B8] hover:text-[#E4E6EB]"
              >
                Reply
              </button>
              {comment.likes_count > 0 && (
                <span className="text-[15px] text-[#B0B3B8]">
                  {formatCount(comment.likes_count)} like
                  {comment.likes_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="fixed inset-0 z-[500] bg-[#18191A] flex flex-col">
        <div className="p-4 border-b border-[#3E4042] flex items-center justify-between bg-[#242526] sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-10 h-10 rounded-full hover:bg-[#3A3B3C] flex items-center justify-center transition-colors"
              onClick={onClose}
              aria-label="Back"
            >
              <i className="fas fa-arrow-left text-[#E4E6EB] text-xl"></i>
            </button>
            <div className="text-[#E4E6EB] font-bold text-[22px]">Post</div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-[#B0B3B8] text-[16px]">
              {formatCount(comments.length)} discussions
            </div>
            <button
              type="button"
              className="text-[#1877F2] font-bold text-[17px] hover:underline"
              onClick={onClose}
            >
              See less
            </button>
          </div>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scroll-smooth">
          <div className="p-4 border-b border-[#3E4042]">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={avatarFrom(postAuthor)}
                className="w-12 h-12 rounded-full object-cover border border-[#3E4042] cursor-pointer"
                alt=""
                onClick={() => postAuthor?.id && onProfileClick(postAuthor.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      className="text-[#E4E6EB] font-bold text-[20px] truncate cursor-pointer hover:underline"
                      onClick={() => postAuthor?.id && onProfileClick(postAuthor.id)}
                    >
                      {postAuthor?.name || postAuthor?.username || 'User'}
                    </div>
                    <div className="text-[#B0B3B8] text-[15px] flex items-center gap-2">
                      <span>{formatRelativeTime(p.created_at)}</span>
                      <span>•</span>
                      <i className="fas fa-globe-americas text-[14px]"></i>
                    </div>
                  </div>

                  {onFollow && currentUser && postAuthor?.id && safeUserId(postAuthor) !== safeUserId(currentUser) && (
                    <button
                      onClick={(e) => handleFollowClick(e, safeUserId(postAuthor))}
                      className={`px-3 py-1 text-[15px] font-bold rounded-lg transition-all duration-200 ${
                        checkIsFollowing && checkIsFollowing(safeUserId(postAuthor))
                          ? 'bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50]'
                          : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                      }`}
                    >
                      {checkIsFollowing && checkIsFollowing(safeUserId(postAuthor))
                        ? 'Following'
                        : 'Follow'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {!p.background && textPreview && (
              <div className="mb-4">
                <ExpandableRichText
                  text={String(p.content)}
                  users={users}
                  onProfileClick={onProfileClick}
                  onHashtagClick={onHashtagClick}
                  fontSizePx={23}
                  forceExpanded={true}
                />
              </div>
            )}

            {p.background && textPreview && (
              <div
                className="mb-4 -mx-4 h-[320px] flex items-center justify-center p-8 text-center text-white font-bold text-2xl"
                style={{ background: p.background, backgroundSize: 'cover' }}
              >
                {textPreview}
              </div>
            )}

            {isMarketplace && mpImages.length > 0 && (
              <div className="mb-4 -mx-4">
                <div className="w-full bg-black">
                  <MediaGrid
                    media={mpImages.map((url) => ({ url }))}
                    onOpen={(url, index) => {
                      console.log('Open marketplace image:', url, index);
                    }}
                  />
                </div>
              </div>
            )}

            {isMarketplace && price && (
              <div className="mb-4 px-4 py-2 flex items-center justify-between bg-[#242526] border border-[#3E4042] rounded-lg">
                <div className="flex items-center gap-1">
                  <span className="text-[#E4E6EB] text-[19px] font-bold">{currency}</span>
                  <span className="text-[#E4E6EB] text-[22px] font-bold">{price}</span>
                </div>

                <button
                  className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-1.5 rounded-full font-bold text-[15px] transition-colors shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (productId && onViewProductFromPost) onViewProductFromPost(productId);
                    else if (productId) onViewProduct?.(productId);
                  }}
                >
                  View product
                </button>
              </div>
            )}

            {(isMusic || isPodcast) && (
              <div className="mb-4 bg-[#18191A] border border-[#3E4042] rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <img
                    src={
                      (isMusic ? song?.cover_image_url : podcast?.cover_image_url) ||
                      ''
                    }
                    className="w-14 h-14 rounded-xl object-cover bg-[#242526]"
                    alt=""
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="text-white font-bold text-[17px] truncate">
                      {(isMusic ? song?.title : podcast?.title) || 'Untitled'}
                    </div>
                    <div className="text-[#B0B3B8] text-[14px] truncate">
                      {isMusic ? song?.artist_name : podcast?.description}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAudio?.(isMusic ? song : podcast);
                    }}
                    className="bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold px-4 py-2 rounded-xl text-[15px]"
                  >
                    Play
                  </button>
                </div>
              </div>
            )}

            {p.link_preview && !mediaInfo.mediaUrl && !isMarketplace && (
              <div
                className="mb-4 bg-[#242526] border border-[#3E4042] overflow-hidden cursor-pointer hover:bg-[#3A3B3C] transition-colors rounded-lg"
                onClick={() =>
                  window.open(p.link_preview.url, '_blank', 'noopener noreferrer')
                }
              >
                {p.link_preview.image && (
                  <div className="w-full h-48 bg-[#3A3B3C] overflow-hidden">
                    <img
                      src={p.link_preview.image}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="p-4 bg-[#3A3B3C]">
                  <div className="text-[#B0B3B8] text-[13px] uppercase font-bold mb-1">
                    {p.link_preview.domain}
                  </div>
                  <div className="text-[#E4E6EB] font-bold text-[19px] mb-1 line-clamp-2">
                    {p.link_preview.title}
                  </div>
                  <div className="text-[#B0B3B8] text-[16px] line-clamp-3">
                    {p.link_preview.description}
                  </div>
                </div>
              </div>
            )}

            {!isMarketplace && imageMedia.length > 0 && (
              <div className="mb-4 -mx-4">
                {imageMedia.length > 1 ? (
                  <MediaGrid
                    media={imageMedia.map((m) => ({ url: m.url }))}
                    onOpen={(url, index) => {
                      console.log('Open image:', url, index);
                    }}
                  />
                ) : (
                  <div className="w-full bg-black">
                    <img
                      src={imageMedia[0].url}
                      alt=""
                      className="w-full h-auto max-h-[70vh] object-contain"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>
            )}

            {!isMarketplace && videoMedia.length > 0 && (
              <div className="mb-4 -mx-4 w-full bg-black">
                <video
                  src={videoMedia[0].url}
                  controls
                  playsInline
                  className="w-full h-auto max-h-[70vh] object-contain bg-black"
                />
              </div>
            )}

            {!isMarketplace && mediaInfo.mediaUrl && mediaInfo.isAudio && (
              <div className="mb-4 p-4 bg-[#242526] border border-[#3E4042] rounded-xl">
                <div className="text-[#E4E6EB] font-bold text-[17px] mb-3">Audio Track</div>
                <audio controls className="w-full">
                  <source src={mediaInfo.mediaUrl} />
                </audio>
              </div>
            )}

            <div className="flex items-center justify-between text-[#B0B3B8] text-[16px] pt-3 border-t border-[#3E4042]">
              <div className="flex items-center gap-2">
                {!!p.reactions_count && (
                  <span>{formatCount(Number(p.reactions_count))} reactions</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span>{formatCount(comments.length)} discussions</span>
                {!!p.shares && <span>{formatCount(Number(p.shares))} shares</span>}
              </div>
            </div>
          </div>

          <div className="p-4">
            <div ref={discussionsTopRef} />

            {replyTo && (
              <div className="mb-4 p-3 bg-[#3A3B3C] rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[#B0B3B8] text-[15px]">Replying to</span>
                  <span className="text-[#1877F2] font-bold text-[15px]">
                    {replyTo?._reply_author?.display || replyTo?._reply_author?.name || 'User'}
                  </span>
                </div>
                <button
                  onClick={() => setReplyTo(null)}
                  className="text-[#B0B3B8] hover:text-[#E4E6EB] text-lg"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}

            {showEmojiPicker && (
              <div className="mb-4 p-3 border border-[#3E4042] rounded-lg">
                <div className="flex gap-2 flex-wrap max-h-[120px] overflow-y-auto">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => addEmoji(emoji)}
                      className="text-2xl hover:scale-125 transition-transform p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {comments.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-[#B0B3B8] text-[19px] mb-2">No discussions yet</div>
                <p className="text-[#B0B3B8] text-[15px]">Be the first to start a discussion!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {threads.map(({ root, replies }) => {
                  const rootId = String(root.id);
                  const isExpanded = !!expandedThreads[rootId];
                  const MAX_PREVIEW = 1;
                  const hiddenCount = Math.max(0, replies.length - MAX_PREVIEW);
                  const visibleReplies = isExpanded ? replies : replies.slice(-MAX_PREVIEW);

                  return (
                    <div key={rootId} className="space-y-2">
                      {renderOneComment(root, false)}

                      {!isExpanded && hiddenCount > 0 && (
                        <button
                          type="button"
                          className="ml-12 text-[#1877F2] font-bold text-[16px] hover:underline"
                          onClick={() => toggleThread(rootId, true)}
                        >
                          View previous {hiddenCount} repl
                          {hiddenCount === 1 ? 'y' : 'ies'}
                        </button>
                      )}

                      {visibleReplies.map((reply) => (
                        <div key={String(reply.id)} className="ml-12 relative">
                          <div className="absolute -left-6 top-0 bottom-0 w-[2px] bg-[#3E4042] rounded-full" />
                          {renderOneComment(reply, true)}
                        </div>
                      ))}

                      {isExpanded && replies.length > MAX_PREVIEW && (
                        <button
                          type="button"
                          className="ml-12 text-[#B0B3B8] text-[15px] hover:text-[#E4E6EB]"
                          onClick={() => toggleThread(rootId, false)}
                        >
                          Hide replies
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[#3E4042] bg-[#242526] sticky bottom-0">
          <form className="flex gap-3 items-center" onSubmit={handleSubmit}>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-[#B0B3B8] hover:text-[#E4E6EB] text-2xl p-1 transition-colors"
            >
              😀
            </button>
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                className="w-full bg-[#3A3B3C] text-white rounded-full px-5 py-3 outline-none focus:ring-2 focus:ring-[#1877F2] transition-all text-[17px]"
                placeholder={
                  replyTo
                    ? `Reply to ${replyTo?._reply_author?.display || replyTo?._reply_author?.name || 'user'}...`
                    : 'Write a comment...'
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="text-[#1877F2] font-bold text-[17px] disabled:text-[#B0B3B8] disabled:cursor-not-allowed px-4 py-2 min-w-[60px] transition-colors"
              disabled={!text.trim()}
            >
              Post
            </button>
          </form>
        </div>
      </div>
    );
  },
  (prev, next) => prev.post?.id === next.post?.id && prev.currentUser?.id === next.currentUser?.id
);

/**
 * =========================
 * ✅ SUGGESTED PRODUCTS WIDGET
 * =========================
 */
export const SuggestedProductsWidget = memo(
  ({
    products,
    currentUser,
    onViewProduct,
    onSeeAll,
  }: {
    products: Product[];
    currentUser: User;
    onViewProduct: (product: Product) => void;
    onSeeAll: () => void;
  }) => {
    const suggested = (products || [])
      .filter((p: any) => p.seller_id !== safeUserId(currentUser))
      .slice(0, 4);

    if (suggested.length === 0) return null;

    return (
      <div className="w-full">
        <div className="bg-[#242526] w-full p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[#E4E6EB] font-bold text-[21px]">Marketplace for you</h3>
            <button
              onClick={onSeeAll}
              className="text-[#1877F2] font-bold text-[17px] hover:bg-[#3A3B3C] px-2 py-1 rounded transition-colors"
            >
              See all
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {suggested.map((product: any) => {
              const countryData = MARKETPLACE_COUNTRIES.find((c) =>
                String(product.address || '').toLowerCase().includes(c.name.toLowerCase())
              );
              const symbol = countryData ? countryData.symbol : '$';

              return (
                <div
                  key={String(product.id)}
                  className="cursor-pointer group"
                  onClick={() => onViewProduct(product)}
                >
                  <div className="aspect-square rounded-lg overflow-hidden relative mb-1.5 shadow-sm border border-[#3E4042]">
                    <img
                      src={product.images?.[0]}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[13px] font-bold text-white">
                      {symbol}
                      {product.main_price}
                    </div>
                  </div>
                  <h4 className="text-[#E4E6EB] text-[15px] font-bold truncate px-0.5 leading-tight">
                    {product.title}
                  </h4>
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-[10px] bg-[#18191A] border-t border-white/10" />
      </div>
    );
  },
  (prev, next) => {
    return prev.products === next.products && prev.currentUser?.id === next.currentUser?.id;
  }
);

// ==================== EXPORTED HELPERS ====================
export {
  getMediaTypeInfo,
  getMarketplaceImages,
  getMarketplacePriceLine,
  normalizeEventFromFeed,
  topReactionEmojis,
  safeArray,
  safeNumber,
  safeString,
  safePostId,
  safeUserId,
  avatarFrom,
  formatReelCount,
  getReelAuthorName,
};

/**
 * =========================
 * ✅ FEED PROPS INTERFACE
 * =========================
 */
interface FeedProps {
  feedItems: any[];
  currentUser: User | null;
  users: User[];
  onProfileClick: (id: number) => void;
  onReact: (post: PostType, type: ReactionType) => void;
  onShare: (id: number, newShareCount: number) => void;
  onOpenComments: (post: PostType) => void;
  onViewImage: (url: string) => void;
  onVideoClick: (post: PostType) => void;
  onPlayAudioTrack?: (track: AudioTrack) => void;
  onHashtagClick?: (tag: string) => void;
  onFollow?: (id: number) => void;
  followLoading?: { [key: number]: boolean };
  checkIsFollowing?: (id: number) => boolean;
  groups?: Group[];
  brands?: Brand[];
  chats?: any[];
  onViewProductFromPost?: (productId: number) => void;
  onRSVPEvent?: (eventId: number, status: 'going' | 'interested' | 'not_going') => Promise<void>;
  getPostAuthor?: (post: PostType) => User;
  
  // Push More button props
  onPushMore?: (postId: number) => void;
  pushedPosts?: Record<number, boolean>;
  
  // Reel props
  onOpenReel?: (reelId: number | string) => void;
  onOpenReelMenu?: (reel: any) => void;
  
  // People You May Know props
  peopleYouMayKnow?: any[];
  peopleYouMayKnowInsertIndex1?: number;
  peopleYouMayKnowInsertIndex2?: number;
  onFollowFromPymk?: (id: number) => void;
  pymkLoading?: boolean;
  
  // Groups You May Join props
  groupsYouMayJoin?: any[];
  groupsYouMayJoinInsertIndex?: number;
  onJoinGroupSuggestion?: (groupId: number) => void;
  gymjLoading?: boolean;
  onOpenGroup?: (groupId: number) => void;
  
  // Login
  onLoginClick?: () => void;
}

/**
 * =========================
 * ✅ MAIN FEED COMPONENT
 * =========================
 */
export const Feed = memo(({
  feedItems,
  currentUser,
  users,
  onProfileClick,
  onReact,
  onShare,
  onOpenComments,
  onViewImage,
  onVideoClick,
  onPlayAudioTrack,
  onHashtagClick,
  onFollow,
  followLoading = {},
  checkIsFollowing,
  groups = [],
  brands = [],
  chats = [],
  onViewProductFromPost,
  onRSVPEvent,
  getPostAuthor,
  onPushMore,
  pushedPosts = {},
  onOpenReel,
  onOpenReelMenu,
  peopleYouMayKnow = [],
  peopleYouMayKnowInsertIndex1 = -1,
  peopleYouMayKnowInsertIndex2 = -1,
  onFollowFromPymk,
  pymkLoading = false,
  groupsYouMayJoin = [],
  groupsYouMayJoinInsertIndex = -1,
  onJoinGroupSuggestion,
  gymjLoading = false,
  onOpenGroup,
  onLoginClick,
}: FeedProps) => {
  
  const getStableItemKey = (item: any, prefix: string) => {
    return `${prefix}-${item.id}-${item.feed_key || ''}`;
  };

  return (
    <div className="space-y-2">
      {feedItems.map((item, idx) => {
        // Check if it's a sponsored post
        if (item.type === 'sponsored' || item.ad_type || item.is_sponsored) {
          // Determine if campaign is still active
          const isActive = item.campaign_status === 'active' || 
                         (item.end_date && new Date(item.end_date) > new Date());
          
          return (
            <SponsoredPostCard
              key={`sponsored-${item.id}`}
              ad={item}
              currentUser={currentUser}
              onProfileClick={onProfileClick}
              onReact={(id, type) => onReact(item, type)}
              onShare={onShare}
              onOpenComments={(post) => onOpenComments(post)}
              isActive={isActive}
            />
          );
        }

        // Handle reel cards
        if (item.type === 'reel') {
          return (
            <ReelFeedCard
              key={`reel-${item.id}`}
              reel={item.reel || item}
              onOpen={(reelId) => onOpenReel?.(reelId)}
              onOpenMenu={(reel) => onOpenReelMenu?.(reel)}
              onProfileClick={(userId) => onProfileClick(Number(userId))}
            />
          );
        }

        // Handle regular posts
        const postAuthorId = Number((item as any).user_id);
        const isFollowing = checkIsFollowing?.(postAuthorId) || false;
        
        // Check if current user is the post owner OR admin
        const isPostOwner = currentUser && Number(currentUser.id) === postAuthorId;
        const isAdminUser = currentUser && currentUser.role === 'admin';
        const showPushButton = (isPostOwner || isAdminUser) && onPushMore;

        // Track PYMK and Groups inserts
        const showFirstPymk = peopleYouMayKnow && 
          peopleYouMayKnow.length > 0 &&
          peopleYouMayKnowInsertIndex1 >= 0 &&
          idx === peopleYouMayKnowInsertIndex1;

        const showSecondPymk = peopleYouMayKnow && 
          peopleYouMayKnow.length > 0 &&
          peopleYouMayKnowInsertIndex2 >= 0 &&
          idx === peopleYouMayKnowInsertIndex2;

        const showGroupsYouMayJoin = groupsYouMayJoin && 
          groupsYouMayJoin.length > 0 &&
          groupsYouMayJoinInsertIndex >= 0 &&
          idx === groupsYouMayJoinInsertIndex;

        return (
          <React.Fragment key={getStableItemKey(item, 'post')}>
            <Post
              post={item as PostType}
              author={getPostAuthor?.(item as PostType) || item.author || item}
              currentUser={currentUser}
              users={users}
              onProfileClick={onProfileClick}
              onReact={onReact}
              onShare={onShare}
              onViewImage={onViewImage}
              onOpenComments={onOpenComments}
              onVideoClick={onVideoClick}
              onPlayAudioTrack={onPlayAudioTrack}
              groups={groups}
              brands={brands}
              chats={chats}
              onHashtagClick={onHashtagClick}
              isFollowing={isFollowing}
              onFollow={() => onFollow?.(postAuthorId)}
              followLoading={followLoading?.[postAuthorId] || false}
              onViewProductFromPost={onViewProductFromPost}
              onRSVP={onRSVPEvent}
              pushButton={showPushButton ? (
                <button
                  onClick={() => onPushMore?.(item.id)}
                  disabled={pushedPosts?.[item.id]}
                  className={`px-3 py-1 rounded-md text-sm font-semibold ml-2 ${
                    pushedPosts?.[item.id]
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                >
                  {pushedPosts?.[item.id] ? 'Pushed' : 'Push More'}
                </button>
              ) : undefined}
            />

            {/* People You May Know Grid - FIRST APPEARANCE */}
            {showFirstPymk && (
              <PeopleYouMayKnowGrid
                users={peopleYouMayKnow}
                onFollow={(id: number) => onFollowFromPymk?.(id)}
                currentUser={currentUser}
                isLoading={pymkLoading}
                onLoginClick={onLoginClick}
                onProfileClick={onProfileClick}
                title="People You May Know"
                maxDisplay={8}
              />
            )}

            {/* People You May Know Grid - SECOND APPEARANCE */}
            {showSecondPymk && (
              <PeopleYouMayKnowGrid
                users={peopleYouMayKnow}
                onFollow={(id: number) => onFollowFromPymk?.(id)}
                currentUser={currentUser}
                isLoading={pymkLoading}
                onLoginClick={onLoginClick}
                onProfileClick={onProfileClick}
                title="More People You May Know"
                maxDisplay={8}
              />
            )}

            {/* Groups You May Join Card */}
            {showGroupsYouMayJoin && (
              <GroupsYouMayJoinCard
                groups={groupsYouMayJoin}
                currentUser={currentUser}
                isLoading={gymjLoading}
                onJoin={(groupId: number) => onJoinGroupSuggestion?.(groupId)}
                onLoginClick={onLoginClick}
                onOpenGroup={(groupId: number) => onOpenGroup?.(groupId)}
                onProfileClick={onProfileClick}
                title="Groups You May Join"
                maxDisplay={8}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}, (prev, next) => {
  // Custom comparison for memo
  return prev.feedItems === next.feedItems && 
         prev.currentUser?.id === next.currentUser?.id;
});

// ==================== ADDITIONAL EXPORTS ====================

// Export the main components that might be needed elsewhere
export default Feed;

// Export types and interfaces
export type { FeedProps, PeopleSuggestion, GroupSuggestion, ReelFeedData, FeedEventItem };

// Export helper functions that might be useful
export {
  formatRelativeTime,
  reactionEmoji,
  fmtCount,
  formatReactionText,
  formatViewCount,
  getPostTextPreview,
  toDateSafe,
  safeJsonArray,
  getMarketplaceProductId,
  getPostMediaList,
  getOrientation,
  classifyOrientations,
};

// Export constants
export { BACKGROUNDS, FEELINGS, QUICK_EMOJIS };

// Re-export from PostMenu if needed
export { PostMenu };

// Export any additional utility functions
export const getPostType = (post: any): string => {
  if (post?.type === 'sponsored' || post?.ad_type) return 'sponsored';
  if (post?.type === 'reel' || post?.item_type === 'reel') return 'reel';
  if (post?.type === 'event' || post?.item_type === 'event') return 'event';
  if (post?.type === 'product' || post?.marketplace) return 'product';
  if (post?.group_id || post?.group) return 'group_post';
  return 'post';
};

export const isVideoPost = (post: any): boolean => {
  const mediaInfo = getMediaTypeInfo(post);
  return mediaInfo.isVideo || (post?.media_type === 'video');
};

export const isImagePost = (post: any): boolean => {
  const mediaInfo = getMediaTypeInfo(post);
  return mediaInfo.isImage || (post?.media_type === 'image');
};

export const isAudioPost = (post: any): boolean => {
  const mediaInfo = getMediaTypeInfo(post);
  return mediaInfo.isAudio || (post?.media_type === 'audio');
};

// CSS injection for animations and scrollbar hiding
const injectGlobalStyles = () => {
  if (typeof document === 'undefined') return;
  
  const styleId = 'feed-global-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes slide-up {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      
      .animate-slide-up {
        animation: slide-up 0.3s ease-out;
      }
      
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #3A3B3C;
        border-radius: 10px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #B0B3B8;
        border-radius: 10px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #E4E6EB;
      }
      
      .line-clamp-1 {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      
      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      
      .line-clamp-3 {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  }
};

// Initialize global styles
if (typeof window !== 'undefined') {
  injectGlobalStyles();
}

// Export version info
export const FEED_VERSION = '2.0.0';
export const LAST_UPDATED = '2024-03-25';
