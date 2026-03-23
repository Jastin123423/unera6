// ==================== ADDITIONAL VIEWS (Continued from Part 1) ====================

            {/* ==================== BRANDS VIEW ==================== */}
            {view === 'brands' && (
              <BrandsPage
                currentUser={currentUser}
                brands={brands}
                posts={posts}
                users={users}
                onCreateBrand={() => requireAuth('Creating brands')}
                onFollowBrand={(id: number) => followUser(id)}
                onProfileClick={(id) => openProfile(id)}
                onPostAsBrand={() => requireAuth('Posting')}
                onReact={() => requireAuth('Reacting')}
                onShare={(post: any) => handleOpenShareSheet(post)}
                onOpenComments={(id: any) => {
                  if (!requireAuth('Commenting')) return;
                  const pid = Number(id);
                  setActiveCommentsPostId(pid);
                  const source = view === 'profile' ? profilePosts : posts;
                  const found = source.find((p: any) => Number(p.id) === pid) || null;
                  setCommentPostSnapshot(found);
                }}
                onDeleteBrand={() => requireAuth('Deleting brands')}
                onPlayAudioTrack={onPlayTrack}
                checkIsFollowing={checkIsFollowing}
                followLoading={followLoading}
              />
            )}

            {/* ==================== MUSIC VIEW ==================== */}
            {view === 'music' && (
              <MusicSystem
                currentUser={currentUser}
                onPlayTrack={onPlayTrack}
                onProfileClick={(id) => openProfile(id)}
                likedTracks={likedTracks}
                onToggleLike={handleMusicSystemLikeSync}
                playHistory={playHistory}
                onFollow={followUser}
                checkIsFollowing={checkIsFollowing}
                users={users}
                currentTrack={currentAudioTrack}
                isPlaying={isAudioPlaying}
                myTotalPlays={currentUser?.id ? myTotalPlays : 0}
                playsLoading={playsLoading}
              />
            )}

            {/* ==================== TOOLS VIEW ==================== */}
            {view === 'tools' && <ToolsPage />}

            {/* ==================== PROFILES VIEW ==================== */}
            {view === 'profiles' && (
              <SuggestedProfilesPage
                currentUser={currentUser as any}
                users={users}
                onFollow={(id: number) => followUser(id)}
                onProfileClick={(id) => openProfile(id)}
                checkIsFollowing={checkIsFollowing}
                followLoading={followLoading}
              />
            )}

            {/* ==================== EVENTS VIEW ==================== */}
            {view === 'events' && (
              <AllEvents
                currentUser={currentUser ?? null}
                users={users}
                onProfileClick={(id) => openProfile(id)}
                onEventClick={(eventId) => {
                  setActiveEventId(eventId);
                }}
                onCreateEventClick={() => {
                  if (!requireAuth('Creating events')) return;
                  setShowCreateEventModal(true);
                }}
              />
            )}

            {/* ==================== BIRTHDAYS VIEW ==================== */}
            {view === 'birthdays' && (
              <BirthdaysPage
                currentUser={currentUser as any}
                users={users}
                onMessage={(id) => {
                  if (!requireAuth('Messaging')) return;
                  setActiveChatUser(users.find((u) => u.id === id) || null);
                  setIsChatOpen(true);
                }}
                onProfileClick={(id) => openProfile(id)}
                onFollow={followUser}
                checkIsFollowing={checkIsFollowing}
              />
            )}

            {/* ==================== MEMORIES VIEW ==================== */}
            {view === 'memories' && currentUser && (
              <MemoriesPage
                currentUser={currentUser}
                posts={allKnownPosts}
                users={users}
                onProfileClick={(id: number) => openProfile(id)}
                onReact={(postId: number, type: ReactionType) => onReactPost(postId, type)}
                onShare={(post: any) => handleOpenShareSheet(post)}
                onViewImage={setFullScreenImage}
                onOpenComments={(postId: number) => onOpenComments(postId)}
                onVideoClick={handleVideoClick}
                onPlayAudioTrack={onPlayTrack}
                onHashtagClick={(tag) => { setActiveHashtag(tag); navigateTo('home'); }}
                onFollow={followUser}
                checkIsFollowing={checkIsFollowing}
                followLoading={followLoading}
                groups={groups}
                brands={brands}
                chats={chats}
              />
            )}

            {/* ==================== SETTINGS VIEW ==================== */}
            {view === 'settings' && currentUser && (
              <SettingsPage currentUser={currentUser} onUpdateUser={() => requireAuth('Updating settings')} />
            )}

            {/* ==================== PRIVACY POLICY VIEW ==================== */}
            {view === 'privacy' && <PrivacyPolicyPage onNavigateHome={() => setView('home')} />}
            
            {/* ==================== TERMS OF SERVICE VIEW ==================== */}
            {view === 'terms' && <TermsOfServicePage onNavigateHome={() => setView('home')} />}
            
            {/* ==================== HELP SUPPORT VIEW ==================== */}
            {view === 'help' && <HelpSupportPage onNavigateHome={() => setView('home')} />}

            {/* ==================== NOTIFICATIONS VIEW ==================== */}
            {view === 'notifications' && (
              <NotificationsPage
                notifications={notifications}
                users={users}
                onBack={() => navigateTo('home')}
                onProfileClick={(id) => openProfile(id)}
              />
            )}

            {/* ==================== ADS VIEW ==================== */}
            {view === 'ads' && currentUser && (
              <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
                <div className="flex gap-2 mb-6 border-b border-[#3E4042] pb-2 overflow-x-auto">
                  <button
                    onClick={() => setActiveAdTab('dashboard')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                      activeAdTab === 'dashboard'
                        ? 'bg-[#1877F2] text-white'
                        : 'text-[#B0B3B8] hover:bg-[#3A3B3C]'
                    }`}
                  >
                    <FontAwesomeIcon icon={faChartLine} className="w-4 h-4" />
                    Dashboard
                  </button>
                  <button
                    onClick={() => setActiveAdTab('create')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                      activeAdTab === 'create'
                        ? 'bg-[#1877F2] text-white'
                        : 'text-[#B0B3B8] hover:bg-[#3A3B3C]'
                    }`}
                  >
                    <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                    Create Campaign
                  </button>
                  <button
                    onClick={() => setActiveAdTab('ads')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                      activeAdTab === 'ads'
                        ? 'bg-[#1877F2] text-white'
                        : 'text-[#B0B3B8] hover:bg-[#3A3B3C]'
                    }`}
                  >
                    <FontAwesomeIcon icon={faBullhorn} className="w-4 h-4" />
                    My Campaigns
                  </button>
                  <button
                    onClick={() => setActiveAdTab('analytics')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                      activeAdTab === 'analytics'
                        ? 'bg-[#1877F2] text-white'
                        : 'text-[#B0B3B8] hover:bg-[#3A3B3C]'
                    }`}
                  >
                    <FontAwesomeIcon icon={faChartBar} className="w-4 h-4" />
                    Analytics
                  </button>
                </div>

                {activeAdTab === 'dashboard' && (
                  <Dashboard campaigns={adCampaigns} loading={adsLoading} />
                )}
                
                {activeAdTab === 'create' && (
                  <AdCreator 
                    onSuccess={() => {
                      setActiveAdTab('ads');
                      fetchMyAds();
                      if (selectedPostForAd) {
                        setPushedPosts(prev => ({
                          ...prev,
                          [selectedPostForAd.id]: true
                        }));
                      }
                      setSelectedPostForAd(null);
                    }}
                    onBack={() => {
                      setActiveAdTab('dashboard');
                      setSelectedPostForAd(null);
                    }}
                    userPosts={posts.filter(p => Number(p.user_id) === Number(currentUser?.id))}
                    onCreateCampaign={createAdCampaign}
                    currentUser={currentUser}
                    initialPost={selectedPostForAd}
                  />
                )}
                
                {activeAdTab === 'ads' && (
                  <AdsManager 
                    campaigns={adCampaigns} 
                    onUpdate={fetchMyAds}
                    onPause={pauseCampaign}
                    onResume={resumeCampaign}
                    onDelete={deleteCampaign}
                    loading={adsLoading}
                  />
                )}
                
                {activeAdTab === 'analytics' && (
                  <Dashboard campaigns={adCampaigns} loading={adsLoading} />
                )}
              </div>
            )}
          </div>

          {/* ==================== RIGHT SIDEBAR ==================== */}
          {currentUser && (
            <div className="sticky top-14 h-[calc(100vh-56px)] z-20 hidden xl:block pl-4">
              <RightSidebar
                contacts={users.filter((u) => u.id !== currentUser.id)}
                onProfileClick={(id) => openProfile(id)}
                onFollow={followUser}
                checkIsFollowing={checkIsFollowing}
                followLoading={followLoading}
              />
            </div>
          )}
        </div>

        {/* ==================== BACK BUTTON FOR MOBILE ==================== */}
        {view !== 'home' && (
          <button
            onClick={goBack}
            className="fixed bottom-6 left-6 z-50 w-14 h-14 bg-[#1877F2] rounded-full shadow-lg flex items-center justify-center hover:bg-[#166FE5] transition-colors md:hidden"
            aria-label="Go back"
          >
            <i className="fas fa-arrow-left text-white text-2xl"></i>
          </button>
        )}

        {/* ==================== MODALS & SHEETS ==================== */}
        
        {/* Create Post Modal */}
        {showCreatePostModal && currentUser && (
          <CreatePostModal
            currentUser={currentUser}
            users={users}
            onClose={() => setShowCreatePostModal(false)}
            onCreatePost={createPost}
            onCreateEventClick={() => {
              setShowCreatePostModal(false);
              setShowCreateEventModal(true);
            }}
            onOpenRecorder={() => {
              setShowCreatePostModal(false);
              setShowRecorder(true);
            }}
          />
        )}

        {/* Create Event Modal */}
        {showCreateEventModal && currentUser && (
          <CreateEventModal
            currentUser={currentUser}
            onClose={() => setShowCreateEventModal(false)}
            onCreate={async (eventData) => {
              try {
                await createEvent(eventData);
                setShowCreateEventModal(false);
                showToast('Event created!', 'success');
              } catch (error) {
                showToast('Failed to create event', 'error');
              }
            }}
          />
        )}

        {/* Recorder Modal */}
        {showRecorder && currentUser && (
          <Recorder
            currentUser={currentUser}
            selectedSound={null}
            sounds={songs.map((song: any) => ({
              id: song.id,
              name: song.title || song.name || 'Song',
              url: song.audio_fetch_url || song.audio_url || song.url || '',
              originalUrl: song.audio_fetch_url || song.audio_url || song.url || '',
              duration: song.duration || 30,
              start: 0,
              end: song.duration || 30,
              coverImage: song.cover_url || song.cover || '',
              creatorName: song.artist || '',
              creatorImage: song.artist_image || song.cover_url || '',
              playCount: song.playCount || song.plays || 0,
              creationCount: song.creationCount || song.uses || 0,
              soundKey: `song:${song.id}`,
            }))}
            onSelectSound={() => {}}
            onBack={() => setShowRecorder(false)}
            onSubmit={createReel}
          />
        )}

        {/* Comments Sheet */}
        {activePostForComments && currentUser && (
          <CommentsSheet
            post={activePostForComments}
            currentUser={currentUser}
            users={users}
            onClose={() => {
              setActiveCommentsPostId(null);
              setCommentPostSnapshot(null);
            }}
            onComment={async (postId, text) => {
              if (!currentUser) return;
              try {
                await apiFetch(`/api/posts/${postId}/comment`, {
                  method: 'POST',
                  body: JSON.stringify({ user_id: currentUser.id, text }),
                });
                setPosts(prev => prev.map(p => 
                  Number(p.id) === Number(postId) 
                    ? { ...p, comments_count: (p.comments_count || 0) + 1 }
                    : p
                ));
                showToast('Comment posted!', 'success');
              } catch (error) {
                showToast('Failed to post comment', 'error');
              }
            }}
            onLikeComment={async (commentId) => {
              if (!currentUser) return;
              try {
                await apiFetch(`/api/comments/${commentId}/like`, {
                  method: 'POST',
                  body: JSON.stringify({ user_id: currentUser.id }),
                });
              } catch (error) {
                console.error('Failed to like comment:', error);
              }
            }}
            getCommentAuthor={(id) => users.find(u => u.id === id)}
            onProfileClick={openProfile}
            onHashtagClick={(tag) => {
              setActiveHashtag(tag);
              navigateTo('home');
              setActiveCommentsPostId(null);
            }}
            onFollow={followUser}
            checkIsFollowing={checkIsFollowing}
            onViewProductFromPost={openProductFromPost}
            onOpenAudio={onPlayTrack}
          />
        )}

        {/* Share Bottom Sheet */}
        {activeSharePost && (
          <ShareBottomSheet
            isOpen={showShareSheet}
            onClose={() => {
              setShowShareSheet(false);
              setActiveSharePost(null);
            }}
            post={activeSharePost}
            currentUser={currentUser}
            users={users}
            groups={groups}
            brands={brands}
            chats={chats}
            onShareComplete={handleShareComplete}
          />
        )}

        {/* Story Viewer Modal */}
        {activeStoryId && activeStory && (
          <StoryViewerModal
            story={activeStory}
            onClose={closeStoryViewer}
            onProfileClick={(id) => {
              closeStoryViewer();
              openProfile(id);
            }}
            currentUser={currentUser}
            onFollow={followUser}
            checkIsFollowing={checkIsFollowing}
            followLoading={followLoading}
            allStories={orderedStories}
            onFetchViewers={fetchStoryViewers}
            onFetchAnalytics={fetchStoryAnalytics}
            onReply={replyToStory}
            onLike={likeStory}
            onReaction={reactToStory}
            onNext={handleStoryNext}
            onPrev={handleStoryPrev}
            muted={storyMuted}
            onToggleMute={() => setStoryMuted(!storyMuted)}
          />
        )}

        {/* Create Story Modal */}
        {showCreateStoryModal && currentUser && (
          <CreateStoryModal
            currentUser={currentUser}
            songs={songs}
            onClose={() => setShowCreateStoryModal(false)}
            onCreate={createStory}
          />
        )}

        {/* Image Viewer */}
        {fullScreenImage && (
          <ImageViewer
            imageUrl={fullScreenImage}
            onClose={() => setFullScreenImage(null)}
          />
        )}

        {/* Global Audio Player */}
        {currentAudioTrack && (
          <GlobalAudioPlayer
            currentTrack={currentAudioTrack}
            isPlaying={isAudioPlaying}
            onTogglePlay={onTogglePlay}
            onNext={onNext}
            onPrevious={onPrevious}
            onClose={onClosePlayer}
            onDownload={(id) => {
              console.log('Download track:', id);
            }}
            onLike={(id, type) => {
              const k = `${type}:${String(id)}`;
              const nextLiked = !likedTracks.includes(k);
              handleMusicSystemLikeSync(k, nextLiked);
            }}
            onArtistClick={(uploaderId) => uploaderId && openProfile(uploaderId)}
            isLiked={isPlayerLiked}
            ownerUser={resolveTrackOwner(currentAudioTrack)}
            totalPlays={trackPlays[`${currentAudioTrack.type}:${String(currentAudioTrack.id)}`] || 0}
            totalPlaysLoading={playsLoading}
            onStarted={onStarted}
          />
        )}

        {/* Chat Window */}
        {isChatOpen && activeChatUser && currentUser && (
          <ChatWindow
            currentUser={currentUser}
            recipient={activeChatUser}
            onClose={handleCloseChat}
            onSendMessage={handleSendMessage}
          />
        )}

        {/* Chats List */}
        {isChatsListOpen && currentUser && (
          <ChatsList
            currentUser={currentUser}
            onOpenChat={handleOpenChat}
            onOpenRequests={() => {
              console.log('Open message requests');
            }}
            onNewChat={() => {
              console.log('Create new chat');
            }}
          />
        )}

        {/* Incoming Call Screen */}
        {incomingCall && currentUser && (
          <CallScreen
            open={true}
            mode={incomingCall.call_type === "video" ? "video" : "voice"}
            phase="incoming"
            peerName={incomingCall.caller_name || "User"}
            peerAvatar={incomingCall.caller_avatar || null}
            micOn={true}
            camOn={true}
            speakerOn={true}
            onAccept={() => {
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
              }
              openProfile(incomingCall.caller_id);
              setIncomingCall(null);
            }}
            onDecline={() => {
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
              }
              apiFetch("/api/calls/signal", {
                method: "POST",
                body: JSON.stringify({
                  call_id: incomingCall.id,
                  to_user_id: incomingCall.caller_id,
                  type: "decline",
                }),
              }).catch(err => console.error('Failed to decline call:', err));
              setIncomingCall(null);
            }}
            onHangup={() => {
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
              }
              setIncomingCall(null);
            }}
            onToggleMic={() => {}}
            onToggleCam={() => {}}
            onToggleSpeaker={() => {}}
          />
        )}

        {/* Product Detail Modal */}
        {activeProduct && (
          <ProductDetailModal
            product={activeProduct}
            currentUser={currentUser}
            onClose={() => setActiveProduct(null)}
            onMessage={(id) => {
              const recipient = users.find(u => u.id === id);
              if (recipient) handleOpenChat(recipient);
            }}
          />
        )}

        {/* Event Detail Modal */}
        {activeEventId && (
          <div
            className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4"
            onClick={() => setActiveEventId(null)}
          >
            <div
              className="bg-[#242526] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative h-64">
                <img
                  src={events.find(e => e.id === activeEventId)?.cover_url || DEFAULT_EVENT_COVER}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setActiveEventId(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80"
                >
                  <i className="fas fa-times text-white"></i>
                </button>
              </div>
              <div className="p-6">
                <h2 className="text-2xl font-black text-white mb-2">
                  {events.find(e => e.id === activeEventId)?.title}
                </h2>
                <p className="text-[#B0B3B8] mb-4">
                  {events.find(e => e.id === activeEventId)?.description}
                </p>
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-[#B0B3B8]">
                    <i className="fas fa-calendar-alt w-5 text-[#1877F2]"></i>
                    <span>
                      {new Date(events.find(e => e.id === activeEventId)?.event_date || '').toLocaleDateString()}
                    </span>
                  </div>
                  {events.find(e => e.id === activeEventId)?.location && (
                    <div className="flex items-center gap-3 text-[#B0B3B8]">
                      <i className="fas fa-map-marker-alt w-5 text-[#F02849]"></i>
                      <span>{events.find(e => e.id === activeEventId)?.location}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => onRSVPEvent(activeEventId, 'going')}
                    className="flex-1 py-3 bg-[#1877F2] text-white rounded-lg font-bold hover:bg-[#166FE5] transition-colors"
                  >
                    Going
                  </button>
                  <button
                    onClick={() => onRSVPEvent(activeEventId, 'interested')}
                    className="flex-1 py-3 bg-[#3A3B3C] text-white rounded-lg font-bold hover:bg-[#4E4F50] transition-colors"
                  >
                    Interested
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ad Analytics Modal */}
        {showAdAnalytics && adAnalyticsId && (
          <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4">
            <div className="bg-[#242526] rounded-xl max-w-2xl w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Ad Analytics</h2>
                <button
                  onClick={() => setShowAdAnalytics(false)}
                  className="text-[#B0B3B8] hover:text-white"
                >
                  <i className="fas fa-times" />
                </button>
              </div>
              <p className="text-[#B0B3B8]">Analytics for ad #{adAnalyticsId}</p>
            </div>
          </div>
        )}
      </div>
    </MarketplaceContext.Provider>
  );
}

// ==================== EXPORT ====================
export default App;
