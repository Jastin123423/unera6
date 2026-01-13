
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Login, Register, ForgotPassword } from './components/Auth';
import { Header, Sidebar, RightSidebar } from './components/Layout';
import { CreatePost, Post, CommentsSheet, CreatePostModal, SuggestedProductsWidget } from './components/Feed';
import { StoryReel, StoryViewer, CreateStoryModal } from './components/Story';
import { UserProfile } from './components/UserProfile';
import { MarketplacePage } from './components/Marketplace';
import { ReelsFeed, CreateReelModal } from './components/Reels';
import { ChatWindow } from './components/Chat';
import { ImageViewer, Spinner } from './components/Common';
import { EventsPage, BirthdaysPage, MemoriesPage, SettingsPage } from './components/MenuPages';
import { HelpSupportPage } from './components/HelpSupport';
import { CreateEventModal } from './components/Events';
import { BrandsPage } from './components/Brands';
import MusicSystem, { GlobalAudioPlayer } from './components/MusicSystem'; 
import { GroupsPage } from './components/Groups';
import { ToolsPage } from './components/Tools';
import { PrivacyPolicyPage } from './components/PrivacyPolicy';
import { TermsOfServicePage } from './components/TermsOfService';
import { useLanguage } from './contexts/LanguageContext';
import { User, Post as PostType, Story, Reel, Notification, Message, Event, Product, AudioTrack, Brand, Song, Episode, ReactionType } from './types';
import { INITIAL_USERS } from './constants';
import { rankFeed } from './utils/ranking'; 

/**
 * Standard API Fetch Utility - Enhanced for robustness
 */
const apiFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('unera_token');
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });
    
    let data;
    const contentType = response.headers.get("content-type");
    
    // Safety check: only parse as JSON if the server explicitly says it's JSON
    if (contentType && contentType.includes("application/json")) {
        try {
            data = await response.json();
        } catch (e) {
            console.error("JSON Parse Error:", e);
            data = { error: "Malformed server response" };
        }
    } else {
        // Fallback for plain text error messages (like 404 Not Found)
        const text = await response.text();
        data = { error: text || `Server responded with status ${response.status}` };
    }

    if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}`);
    }
    return data;
};

export default function App() {
    const { t } = useLanguage();
    
    // Core Data State (Fetched from API)
    const [users, setUsers] = useState<User[]>(INITIAL_USERS);
    const [posts, setPosts] = useState<PostType[]>([]);
    const [stories, setStories] = useState<Story[]>([]);
    const [reels, setReels] = useState<Reel[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    
    // UI State
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState('home'); 
    const [view, setView] = useState('home'); 
    const [isLoading, setIsLoading] = useState(true);
    const [loginError, setLoginError] = useState('');
    
    // Navigation State
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [activeReelId, setActiveReelId] = useState<number | null>(null);
    const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
    const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [activeStory, setActiveStory] = useState<Story | null>(null);
    const [activeProduct, setActiveProduct] = useState<Product | null>(null);
    const [showCreatePostModal, setShowCreatePostModal] = useState(false);
    const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);
    const [showCreateReelModal, setShowCreateReelModal] = useState(false);
    const [showCreateEventModal, setShowCreateEventModal] = useState(false);

    // Audio Player State
    const [currentAudioTrack, setCurrentAudioTrack] = useState<AudioTrack | null>(null);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);

    const rankedPosts = useMemo(() => rankFeed(posts, currentUser, users), [posts, currentUser, users]);

    /**
     * Initial Data Fetch
     */
    const fetchData = useCallback(async () => {
        try {
            const [postsData, storiesData, reelsData, productsData, usersData, groupsData, brandsData, eventsData] = await Promise.all([
                apiFetch('/api/posts').catch(() => []),
                apiFetch('/api/stories').catch(() => []),
                apiFetch('/api/reels').catch(() => []),
                apiFetch('/api/products').catch(() => []),
                apiFetch('/api/users').catch(() => INITIAL_USERS),
                apiFetch('/api/groups').catch(() => []),
                apiFetch('/api/brands').catch(() => []),
                apiFetch('/api/events').catch(() => []) 
            ]);

            setPosts(postsData);
            setStories(storiesData);
            setReels(reelsData);
            setProducts(productsData);
            setUsers(usersData);
            setGroups(groupsData);
            setBrands(brandsData);
            setEvents(eventsData);
        } catch (error) {
            console.error("Critical Data Fetch Error:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('unera_token');
            if (token) {
                try {
                    const userData = await apiFetch('/api/users/me');
                    setCurrentUser(userData);
                } catch (e) {
                    localStorage.removeItem('unera_token');
                    setCurrentUser(null);
                }
            }
            await fetchData();
        };
        initAuth();
    }, [fetchData]);

    /**
     * Handlers
     */
    const handleLogin = async (email: string, pass: string) => {
        try {
            const data = await apiFetch('/api/users/login', {
                method: 'POST',
                body: JSON.stringify({ email, password: pass })
            });
            localStorage.setItem('unera_token', data.token);
            setCurrentUser(data.user);
            setLoginError('');
            setView('home');
        } catch (error: any) {
            setLoginError(error.message);
        }
    };

    const handleRegister = async (newUser: any) => {
        try {
            const data = await apiFetch('/api/users/signup', {
                method: 'POST',
                body: JSON.stringify({ 
                    username: newUser.name, 
                    email: newUser.email, 
                    password: newUser.password 
                })
            });
            localStorage.setItem('unera_token', data.token);
            setCurrentUser(data.user);
            setView('home');
        } catch (error: any) {
            alert(`Registration failed: ${error.message}`);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('unera_token');
        setCurrentUser(null);
        setView('login');
    };

    const handleCreatePost = async (text: string, file: File | null) => {
        if (!currentUser) return;
        try {
            const newPost = await apiFetch('/api/posts', {
                method: 'POST',
                body: JSON.stringify({ content: text, media_url: file ? "https://example.com/mock-upload.jpg" : undefined })
            });
            setPosts([newPost, ...posts]);
            setShowCreatePostModal(false);
        } catch (e) {
            alert("Failed to publish post.");
        }
    };

    const handleLikePost = async (postId: number) => {
        if (!currentUser) return setView('login');
        try {
            await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' });
            setPosts(prev => prev.map(p => p.id === postId ? {
                ...p,
                reactions: p.reactions.some(r => r.user_id === currentUser.id)
                    ? p.reactions.filter(r => r.user_id !== currentUser.id)
                    : [...p.reactions, { user_id: currentUser.id, type: 'like' as ReactionType }]
            } : p));
        } catch (e) {}
    };

    const handleCreateEvent = async (eventData: Partial<Event>) => {
        if (!currentUser) return;
        try {
            const newEvent = await apiFetch('/api/events', {
                method: 'POST',
                body: JSON.stringify(eventData)
            });
            setEvents([newEvent, ...events]);
            setShowCreateEventModal(false);
        } catch (e) {
            alert("Failed to create event.");
        }
    };

    const handleJoinEvent = async (eventId: number) => {
        if (!currentUser) return setView('login');
        try {
            // Mock joining logic until specific join endpoint is polished
            setEvents(prev => prev.map(ev => ev.id === eventId ? {
                ...ev,
                attendees: ev.attendees.includes(currentUser.id) 
                    ? ev.attendees.filter(id => id !== currentUser.id) 
                    : [...ev.attendees, currentUser.id]
            } : ev));
        } catch (e) {}
    };

    const handleUpdateUser = async (data: Partial<User>) => {
        if (!currentUser) return;
        try {
            // In a real app, this would be a PATCH to /api/users/me
            setCurrentUser({ ...currentUser, ...data });
        } catch (e) {}
    };

    const handleNavigate = (target: string) => {
        if (['profile', 'settings', 'memories'].includes(target) && !currentUser) return setView('login');
        setView(target);
        if (['home', 'reels', 'marketplace', 'groups'].includes(target)) setActiveTab(target);
        if (target === 'create_event') setShowCreateEventModal(true);
        window.scrollTo(0, 0);
    };

    if (isLoading) return <div className="h-screen flex items-center justify-center bg-[#18191A]"><Spinner /></div>;

    return (
        <div className="bg-[#18191A] min-h-screen flex flex-col font-sans">
            <Header 
                onHomeClick={() => handleNavigate('home')} 
                onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} 
                onReelsClick={() => handleNavigate('reels')} 
                onMarketplaceClick={() => handleNavigate('marketplace')} 
                onGroupsClick={() => handleNavigate('groups')} 
                currentUser={currentUser} 
                notifications={notifications} 
                users={users} 
                onLogout={handleLogout} 
                onLoginClick={() => setView('login')} 
                onMarkNotificationsRead={() => {}} 
                activeTab={activeTab} 
                onNavigate={handleNavigate} 
            />
            
            <div className="flex justify-center w-full max-w-[1920px] mx-auto relative flex-1">
                {currentUser && (
                    <div className="sticky top-14 h-[calc(100vh-56px)] z-20 hidden lg:block">
                        <Sidebar 
                            currentUser={currentUser} 
                            onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} 
                            onReelsClick={() => handleNavigate('reels')} 
                            onMarketplaceClick={() => handleNavigate('marketplace')} 
                            onGroupsClick={() => handleNavigate('groups')} 
                        />
                    </div>
                )}
                
                <div className="w-full lg:w-[740px] xl:w-[700px] min-h-screen">
                    {view === 'home' && (
                        <div className="w-full pt-4 md:px-8 pb-10">
                            <StoryReel 
                                stories={stories} 
                                onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} 
                                onCreateStory={() => setShowCreateStoryModal(true)} 
                                onViewStory={(s) => setActiveStory(s)} 
                                currentUser={currentUser} 
                                onRequestLogin={() => setView('login')} 
                            />
                            {currentUser && <CreatePost currentUser={currentUser} onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} onClick={() => setShowCreatePostModal(true)} />}
                            {currentUser && <SuggestedProductsWidget products={products} currentUser={currentUser} onViewProduct={setActiveProduct} onSeeAll={() => handleNavigate('marketplace')} />}
                            {rankedPosts.map(post => (
                                <Post 
                                    key={post.id} 
                                    post={post} 
                                    author={users.find(u => u.id === post.user_id) || INITIAL_USERS[0]} 
                                    currentUser={currentUser} 
                                    onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} 
                                    onReact={handleLikePost} 
                                    onShare={() => {}} 
                                    onViewImage={setFullScreenImage} 
                                    onOpenComments={setActiveCommentsPostId} 
                                    onVideoClick={(p) => { setActiveReelId(p.id); setView('reels'); }} 
                                    onPlayAudioTrack={setCurrentAudioTrack} 
                                />
                            ))}
                        </div>
                    )}

                    {view === 'reels' && <ReelsFeed reels={reels} users={users} currentUser={currentUser} onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} onCreateReelClick={() => setShowCreateReelModal(true)} onReact={() => {}} onComment={() => {}} onShare={() => {}} onFollow={() => {}} getCommentAuthor={(id) => users.find(u => u.id === id)} initialReelId={activeReelId} />}
                    {view === 'marketplace' && <MarketplacePage currentUser={currentUser} products={products} onNavigateHome={() => handleNavigate('home')} onCreateProduct={() => {}} onViewProduct={setActiveProduct} />}
                    {view === 'groups' && <GroupsPage currentUser={currentUser} groups={groups} users={users} onCreateGroup={() => {}} onJoinGroup={() => {}} onLeaveGroup={() => {}} onDeleteGroup={() => {}} onUpdateGroupImage={() => {}} onPostToGroup={() => {}} onCreateGroupEvent={() => {}} onInviteToGroup={() => {}} onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} onLikePost={() => {}} onOpenComments={() => {}} onSharePost={() => {}} onDeleteGroupPost={() => {}} onRemoveMember={() => {}} onUpdateGroupSettings={() => {}} />}
                    {view === 'brands' && <BrandsPage currentUser={currentUser} brands={brands} posts={posts} users={users} onCreateBrand={() => {}} onFollowBrand={() => {}} onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} onPostAsBrand={() => {}} onReact={() => {}} onShare={() => {}} onOpenComments={() => {}} onDeleteBrand={() => {}} />}
                    {view === 'music' && <MusicSystem currentUser={currentUser} onPlayTrack={setCurrentAudioTrack} onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} likedTracks={[]} onToggleLike={() => {}} playHistory={[]} />}
                    {view === 'tools' && <ToolsPage />}
                    {view === 'events' && <EventsPage events={events} currentUser={currentUser!} onJoinEvent={handleJoinEvent} onCreateEventClick={() => setShowCreateEventModal(true)} onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} />}
                    {view === 'birthdays' && <BirthdaysPage currentUser={currentUser!} users={users} onMessage={(id) => setActiveChatUser(users.find(u => u.id === id) || null)} onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} />}
                    {view === 'memories' && <MemoriesPage currentUser={currentUser!} posts={posts} users={users} onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} onReact={handleLikePost} onShare={() => {}} onViewImage={setFullScreenImage} onOpenComments={setActiveCommentsPostId} onVideoClick={() => {}} onPlayAudioTrack={setCurrentAudioTrack} />}
                    {view === 'settings' && <SettingsPage currentUser={currentUser} onUpdateUser={handleUpdateUser} />}
                    {view === 'privacy' && <PrivacyPolicyPage onNavigateHome={() => setView('home')} />}
                    {view === 'terms' && <TermsOfServicePage onNavigateHome={() => setView('home')} />}
                    {view === 'help' && <HelpSupportPage onNavigateHome={() => setView('home')} />}
                    
                    {view === 'profile' && selectedUserId && <UserProfile user={users.find(u => u.id === selectedUserId)!} currentUser={currentUser} users={users} posts={posts} onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} onFollow={() => {}} onReact={handleLikePost} onComment={() => {}} onShare={() => {}} onMessage={(id) => setActiveChatUser(users.find(u => u.id === id) || null)} onCreatePost={handleCreatePost} onUpdateProfileImage={() => {}} onUpdateCoverImage={() => {}} onUpdateUserDetails={handleUpdateUser} onDeletePost={() => {}} onEditPost={() => {}} getCommentAuthor={(id) => users.find(u => u.id === id)} onViewImage={setFullScreenImage} onOpenComments={setActiveCommentsPostId} onVideoClick={() => {}} onPlayAudioTrack={setCurrentAudioTrack} />}
                    {view === 'login' && <Login onLogin={handleLogin} onNavigateToRegister={() => setView('register')} onNavigateToForgotPassword={() => setView('forgot_password')} onClose={() => setView('home')} error={loginError} />}
                    {view === 'register' && <Register onRegister={handleRegister} onBackToLogin={() => setView('login')} />}
                </div>

                {currentUser && <div className="sticky top-14 h-[calc(100vh-56px)] z-20 hidden xl:block pl-4"><RightSidebar contacts={users.filter(u => u.id !== currentUser.id)} onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} /></div>}
            </div>

            {/* Global Modals */}
            {showCreateEventModal && currentUser && <CreateEventModal currentUser={currentUser} onClose={() => setShowCreateEventModal(false)} onCreate={handleCreateEvent} />}
            {showCreatePostModal && currentUser && <CreatePostModal currentUser={currentUser} users={users} onClose={() => setShowCreatePostModal(false)} onCreatePost={handleCreatePost} />}
            {activeCommentsPostId && currentUser && <CommentsSheet post={posts.find(p => p.id === activeCommentsPostId)!} currentUser={currentUser} users={users} onClose={() => setActiveCommentsPostId(null)} onComment={() => {}} onLikeComment={() => {}} getCommentAuthor={(id) => users.find(u => u.id === id)} onProfileClick={(id) => { setSelectedUserId(id); setView('profile'); }} />}
            {currentAudioTrack && <GlobalAudioPlayer currentTrack={currentAudioTrack} isPlaying={isAudioPlaying} onTogglePlay={() => setIsAudioPlaying(!isAudioPlaying)} onNext={() => {}} onPrevious={() => {}} onClose={() => setCurrentAudioTrack(null)} onDownload={() => {}} onLike={() => {}} isLiked={false} />}
            {fullScreenImage && <ImageViewer imageUrl={fullScreenImage} onClose={() => setFullScreenImage(null)} />}
        </div>
    );
}
