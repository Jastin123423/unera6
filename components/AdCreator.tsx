import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUpload,
  faImage,
  faVideo,
  faMapMarkerAlt,
  faCalendar,
  faLink,
  faFont,
  faMousePointer,
  faCheckCircle,
  faTimes,
  faDollarSign,
  faSpinner,
  faPlayCircle,
  faFileImage,
  faClock
} from '@fortawesome/free-solid-svg-icons';
import { AdType, CTAButton, Post } from '../types';
import AdPreview from './AdPreview';

interface AdCreatorProps {
  onSuccess: () => void;
  currentUser: any; // Add currentUser prop
  onCreateCampaign: (postId: number, campaignData: {
    name: string;
    link: string;
    cta: CTAButton;
    location: string;
    budget: number;
    days: number;
  }) => Promise<boolean>;
}

const CTA_OPTIONS: CTAButton[] = ['Learn More', 'Sign Up', 'Subscribe', 'Shop Now', 'Contact Us', 'Call Now', 'Email Us', 'WhatsApp', 'Download', 'Get Quote', 'Book Now'];

export default function AdCreator({ onSuccess, currentUser, onCreateCampaign }: AdCreatorProps) {
  const [step, setStep] = useState(1);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'image' as AdType,
    mediaUrl: '',
    description: '',
    link: '',
    cta: 'Learn More' as CTAButton,
    location: '',
    budget: 5,
    days: 7,
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ Fetch user's posts on component mount - like UserProfile.tsx
  useEffect(() => {
    const fetchUserPosts = async () => {
      if (!currentUser) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Using the same endpoint as UserProfile.tsx
        const response = await fetch(`/api/posts/by-user?userId=${currentUser.id}&viewerId=${currentUser.id}&limit=50`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch posts');
        }
        
        const data = await response.json();
        
        // Handle different response formats (like in App.tsx)
        const postsList = Array.isArray(data) ? data : 
                         data?.posts || data?.results || data?.data || [];
        
        // Sort by date (newest first)
        const sortedPosts = postsList.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        setUserPosts(sortedPosts);
      } catch (err) {
        console.error('Error fetching posts:', err);
        setError('Failed to load your posts');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserPosts();
  }, [currentUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(3);
  };

  const handleFinalSubmit = async () => {
    if (!selectedPost) return;
    
    setIsSubmitting(true);
    const success = await onCreateCampaign(
      selectedPost.id,
      {
        name: formData.name,
        link: formData.link,
        cta: formData.cta,
        location: formData.location,
        budget: formData.budget,
        days: formData.days
      }
    );
    setIsSubmitting(false);
    
    if (success) {
      setStep(4);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    }
  };

  const selectPost = (post: Post) => {
    setSelectedPost(post);
    setFormData({
      ...formData,
      name: post.content?.substring(0, 30) || 'New Campaign',
      type: post.type === 'video' ? 'video' : 'image',
      mediaUrl: post.media_url || '',
      description: post.content || '',
    });
    setStep(2);
  };

  // Format date nicely
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="max-w-7xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Create New Campaign</h2>
          <p className="text-zinc-400 mt-1 text-sm md:text-base">Boost your posts and reach more people.</p>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s}
              className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-bold transition-colors ${
                step === s ? 'bg-blue-600 text-white' : step > s ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {step > s ? <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4 md:w-5 md:h-5" /> : s}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h3 className="text-lg font-bold text-white">Select a post to boost</h3>
            
            {loading ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <FontAwesomeIcon icon={faSpinner} className="w-10 h-10 text-blue-500 animate-spin" />
                  <p className="text-zinc-400">Loading your posts...</p>
                </div>
              </div>
            ) : error ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon icon={faTimes} className="w-8 h-8 text-red-500" />
                  </div>
                  <p className="text-zinc-400">{error}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : userPosts.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon icon={faImage} className="w-8 h-8 text-zinc-600" />
                  </div>
                  <p className="text-zinc-400">No posts yet</p>
                  <p className="text-zinc-600 text-sm mt-1">Create a post first to boost it</p>
                  <button 
                    onClick={() => window.location.href = '/'}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create Post
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {userPosts.map((post) => {
                  // Determine media type for icon
                  const isVideo = post.type === 'video' || post.media_type?.startsWith('video/');
                  const hasMedia = post.media_url || (post.media_urls && post.media_urls.length > 0);
                  const mediaUrl = post.media_url || (post.media_urls && post.media_urls[0]);
                  
                  return (
                    <button
                      key={post.id}
                      onClick={() => selectPost(post)}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-blue-600/50 hover:shadow-lg hover:shadow-blue-900/20 transition-all group text-left relative"
                    >
                      {/* Media Thumbnail */}
                      <div className="aspect-video bg-zinc-800 relative overflow-hidden">
                        {hasMedia ? (
                          <>
                            {isVideo ? (
                              <div className="relative w-full h-full">
                                <video 
                                  src={mediaUrl} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  muted
                                  loop
                                />
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                  <FontAwesomeIcon icon={faPlayCircle} className="w-10 h-10 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                                </div>
                              </div>
                            ) : (
                              <img 
                                src={mediaUrl} 
                                alt="" 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                onError={(e) => {
                                  // Fallback if image fails to load
                                  e.currentTarget.src = 'https://via.placeholder.com/400x225?text=No+Image';
                                }}
                              />
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900">
                            <FontAwesomeIcon icon={faFileImage} className="w-12 h-12 text-zinc-600" />
                          </div>
                        )}
                        
                        {/* Media type badge */}
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg text-xs text-white">
                          {isVideo ? (
                            <><FontAwesomeIcon icon={faVideo} className="mr-1" /> Video</>
                          ) : (
                            <><FontAwesomeIcon icon={faImage} className="mr-1" /> Photo</>
                          )}
                        </div>
                      </div>
                      
                      {/* Post Info */}
                      <div className="p-3">
                        <p className="text-white font-medium text-sm line-clamp-2 mb-2 min-h-[40px]">
                          {post.content || 'Untitled post'}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1 text-zinc-500">
                            <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
                            <span>{formatDate(post.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-zinc-500">
                            <FontAwesomeIcon icon={faHeart} className="w-3 h-3" />
                            <span>{post.reactions?.length || 0}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Selected overlay (when hovering) */}
                      <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-all pointer-events-none rounded-xl"></div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 2 && selectedPost && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <FontAwesomeIcon icon={faFont} className="w-4 h-4" /> Campaign Name
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="Summer Sale 2024"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm md:text-base"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <FontAwesomeIcon icon={faLink} className="w-4 h-4" /> Destination Link
                  </label>
                  <input 
                    type="url"
                    required
                    placeholder="https://yourwebsite.com"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm md:text-base"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <FontAwesomeIcon icon={faMousePointer} className="w-4 h-4" /> Call to Action
                  </label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all appearance-none text-sm md:text-base"
                    value={formData.cta}
                    onChange={(e) => setFormData({ ...formData, cta: e.target.value as CTAButton })}
                  >
                    {CTA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <FontAwesomeIcon icon={faMapMarkerAlt} className="w-4 h-4" /> Target Location
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. United States, London, Global"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm md:text-base"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                      <FontAwesomeIcon icon={faDollarSign} className="w-4 h-4" /> Daily Budget ($)
                    </label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range"
                        min="1"
                        max="100"
                        className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: parseInt(e.target.value) })}
                      />
                      <span className="bg-zinc-900 px-3 md:px-4 py-2 rounded-lg border border-zinc-800 text-white font-bold w-20 text-center">
                        ${formData.budget}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                      <FontAwesomeIcon icon={faCalendar} className="w-4 h-4" /> Duration (Days)
                    </label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range"
                        min="1"
                        max="30"
                        className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        value={formData.days}
                        onChange={(e) => setFormData({ ...formData, days: parseInt(e.target.value) })}
                      />
                      <span className="bg-zinc-900 px-3 md:px-4 py-2 rounded-lg border border-zinc-800 text-white font-bold w-16 text-center">
                        {formData.days}d
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-600/10 border border-blue-600/20 rounded-xl p-4">
                  <p className="text-sm text-blue-400 font-medium mb-1">Total Campaign Cost</p>
                  <p className="text-2xl font-bold text-white">${formData.budget * formData.days}</p>
                  <p className="text-xs text-zinc-500 mt-1">${formData.budget}/day for {formData.days} days</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-300 mb-3 block">Preview</label>
                <AdPreview data={formData} />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 bg-zinc-800 text-white font-bold py-3 md:py-4 rounded-xl hover:bg-zinc-700 transition-all"
              >
                Back to Posts
              </button>
              <button 
                type="submit"
                className="flex-[2] bg-blue-600 text-white font-bold py-3 md:py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
              >
                Review Campaign
              </button>
            </div>
          </form>
        )}

        {step === 3 && selectedPost && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-2xl mx-auto">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-white">Review Your Campaign</h3>
              <p className="text-zinc-400">Review your ad settings before launching.</p>
            </div>
            
            <div className="flex justify-center">
              <AdPreview data={formData} isFullView />
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500 uppercase text-[10px] font-bold tracking-wider">Campaign Name</p>
                  <p className="text-white font-medium">{formData.name}</p>
                </div>
                <div>
                  <p className="text-zinc-500 uppercase text-[10px] font-bold tracking-wider">Budget & Duration</p>
                  <p className="text-white font-medium">${formData.budget}/day • {formData.days} days</p>
                </div>
                <div>
                  <p className="text-zinc-500 uppercase text-[10px] font-bold tracking-wider">Target Location</p>
                  <p className="text-white font-medium">{formData.location}</p>
                </div>
                <div>
                  <p className="text-zinc-500 uppercase text-[10px] font-bold tracking-wider">Call to Action</p>
                  <p className="text-white font-medium">{formData.cta}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-zinc-800">
                <p className="text-zinc-500 uppercase text-[10px] font-bold tracking-wider mb-1">Total Cost</p>
                <p className="text-2xl font-bold text-white">${formData.budget * formData.days}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setStep(2)}
                className="flex-1 bg-zinc-800 text-white font-bold py-4 rounded-xl hover:bg-zinc-700 transition-all"
                disabled={isSubmitting}
              >
                Edit Details
              </button>
              <button 
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="flex-[2] bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="w-5 h-5 animate-spin" />
                    <span>Launching...</span>
                  </>
                ) : (
                  'Launch Campaign'
                )}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col items-center justify-center text-center space-y-6 py-12 md:py-20 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-900/40">
              <FontAwesomeIcon icon={faCheckCircle} className="w-10 h-10 md:w-12 md:h-12 text-white" />
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-bold text-white">Campaign Launched!</h3>
              <p className="text-zinc-400 mt-2 max-w-sm text-sm md:text-base">Your ad is now live and reaching people. Redirecting to dashboard...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
