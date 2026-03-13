
import React, { useState } from 'react';
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
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { AdType, CTAButton, Post } from '../types';
import AdPreview from './AdPreview';

interface AdCreatorProps {
  onSuccess: () => void;
  userPosts?: Post[]; // Pass user's posts to select from
  onCreateCampaign: (postId: number, budget: number, days: number) => Promise<boolean>;
}

const CTA_OPTIONS: CTAButton[] = ['Learn More', 'Subscribe', 'See More', 'Watch More', 'Shop Now', 'Sign Up', 'Contact Us'];

export default function AdCreator({ onSuccess, userPosts = [], onCreateCampaign }: AdCreatorProps) {
  const [step, setStep] = useState(1);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(3);
  };

  const handleFinalSubmit = async () => {
    if (!selectedPost) return;
    
    setIsSubmitting(true);
    const success = await onCreateCampaign(selectedPost.id, formData.budget, formData.days);
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

  return (
    <div className="max-w-5xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
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
            
            {userPosts.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-zinc-800 rounded-full flex items-center justify-center">
                  <FontAwesomeIcon icon={faImage} className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="text-zinc-400">No posts yet</p>
                <p className="text-zinc-600 text-sm mt-1">Create a post first to boost it</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userPosts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => selectPost(post)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all group text-left"
                  >
                    <div className="aspect-video bg-zinc-800 relative">
                      {post.media_url ? (
                        <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600/20 to-emerald-600/20">
                          <span className="text-zinc-600">No media</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-white font-medium mb-1 line-clamp-1">{post.content || 'Untitled post'}</p>
                      <p className="text-xs text-zinc-500">
                        {new Date(post.created_at).toLocaleDateString()} • {post.reactions?.length || 0} reactions
                      </p>
                    </div>
                  </button>
                ))}
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
                      <FontAwesomeIcon icon={faDollarSign} className="w-4 h-4" /> Budget ($)
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
                      <span className="bg-zinc-900 px-3 md:px-4 py-2 rounded-lg border border-zinc-800 text-white font-bold w-16 text-center">
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
                        {formData.days}
                      </span>
                    </div>
                  </div>
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
                Back
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
                  <p className="text-white font-medium">${formData.budget} • {formData.days} days</p>
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
