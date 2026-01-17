// Feed.tsx - UPDATED WITH INTEGRATED SHARE FLOWS
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  Post as PostType,
  ReactionType,
  Product,
  LinkPreview,
  AudioTrack,
  Group,
  Brand,
} from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { LOCATIONS_DATA, MARKETPLACE_COUNTRIES } from '../constants';

/**
 * =========================
 * API HELPERS
 * =========================
 */
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData) headers['Content-Type'] = (headers['Content-Type'] as string) || 'application/json';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, { 
      ...options, 
      headers,
      signal: controller.signal 
    });

    const contentType = res.headers.get('content-type') || '';
    let data: any = null;

    try {
      if (contentType.includes('application/json')) data = await res.json();
      else {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      }
    } catch (e: any) {
      data = { error: e?.message || 'Failed to parse response' };
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
  }
};

// Helper functions
const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeString = (v: any, fallback = '') => (typeof v === 'string' ? v : fallback);
const safeUserId = (u: any) => safeNumber(u?.id ?? u?.user_id ?? u?.userId, 0);
const safePostId = (p: any) => safeNumber(p?.id ?? p?.post_id ?? p?.postId, 0);

/**
 * =========================
 * 🟦 FLOW 1: SHARE TO UNERA FEED COMPONENT
 * =========================
 */
export const ShareToFeedModal: React.FC<{
  post: any;
  currentUser: User;
  users: User[];
  groups?: Group[];
  onClose: () => void;
  onShareComplete: (success: boolean, data?: any) => void;
}> = ({ post, currentUser, users, groups = [], onClose, onShareComplete }) => {
  const [text, setText] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'only_me'>('public');
  const [location, setLocation] = useState('');
  const [feeling, setFeeling] = useState('');
  const [taggedUsers, setTaggedUsers] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState<any[]>([]);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [showTagUsers, setShowTagUsers] = useState(false);
  const [showFeelingPicker, setShowFeelingPicker] = useState(false);

  const FEELINGS = ['Happy', 'Blessed', 'Loved', 'Sad', 'Excited', 'Thankful', 'Crazy', 'Tired', 'Cool', 'Relaxed'];

  const handleLocationSearch = async (query: string) => {
    if (query.length < 2) {
      setLocResults([]);
      return;
    }
    try {
      const data = await apiFetch(`/api/locations/search?q=${encodeURIComponent(query)}`);
      setLocResults(Array.isArray(data) ? data.slice(0, 5) : []);
    } catch {
      setLocResults([]);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const payload = {
        original_post_id: post.id,
        user_id: currentUser.id,
        text: text.trim(),
        privacy,
        location: location || undefined,
        feeling: feeling || undefined,
        tagged_users: taggedUsers.length > 0 ? taggedUsers : undefined,
        shared_at: new Date().toISOString(),
      };

      const response = await apiFetch('/api/posts/share/feed', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onShareComplete(true, response);
      onClose();
    } catch (error: any) {
      console.error('Failed to share to feed:', error);
      onShareComplete(false, { error: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canPost = !isSubmitting;

  if (showLocationSearch) {
    return (
      <div className="fixed inset-0 z-[500] bg-[#18191A] flex flex-col animate-slide-up">
        <div className="flex items-center p-4 border-b border-[#3E4042] gap-4">
          <i
            className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
            onClick={() => setShowLocationSearch(false)}
          ></i>
          <h3 className="text-[#E4E6EB] text-lg font-bold">Add Location</h3>
        </div>

        <div className="p-4 flex-1">
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search locations..."
              className="w-full bg-[#3A3B3C] rounded-xl p-4 text-[#E4E6EB] outline-none"
              value={locQuery}
              onChange={(e) => {
                setLocQuery(e.target.value);
                handleLocationSearch(e.target.value);
              }}
              autoFocus
            />
            <i className="fas fa-search absolute right-4 top-1/2 -translate-y-1/2 text-[#B0B3B8]"></i>
          </div>

          <div className="space-y-2">
            {locResults.map((loc, i) => (
              <div
                key={i}
                className="p-3 bg-[#3A3B3C] rounded-lg cursor-pointer hover:bg-[#4E4F50]"
                onClick={() => {
                  setLocation(loc.name || loc.display_name);
                  setShowLocationSearch(false);
                }}
              >
                <div className="text-[#E4E6EB] font-medium">{loc.name || loc.display_name}</div>
                {loc.address && (
                  <div className="text-[#B0B3B8] text-sm">{loc.address}</div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="text-[#B0B3B8] text-sm mb-2">Recent locations</div>
            {LOCATIONS_DATA.slice(0, 3).map((loc) => (
              <div
                key={loc.name}
                className="p-3 bg-[#3A3B3C] rounded-lg cursor-pointer hover:bg-[#4E4F50] mb-2"
                onClick={() => {
                  setLocation(loc.name);
                  setShowLocationSearch(false);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="text-xl">{loc.flag}</div>
                  <div className="text-[#E4E6EB]">{loc.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (showTagUsers) {
    return (
      <div className="fixed inset-0 z-[500] bg-[#18191A] flex flex-col animate-slide-up">
        <div className="flex items-center p-4 border-b border-[#3E4042] gap-4">
          <i
            className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
            onClick={() => setShowTagUsers(false)}
          ></i>
          <h3 className="text-[#E4E6EB] text-lg font-bold">Tag People</h3>
          <button
            className="ml-auto text-[#1877F2] font-bold"
            onClick={() => setShowTagUsers(false)}
          >
            Done
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {users
            .filter((u: any) => safeUserId(u) !== safeUserId(currentUser))
            .map((u: any) => (
              <div
                key={safeUserId(u)}
                className="flex items-center justify-between p-3 hover:bg-[#3A3B3C] rounded-lg cursor-pointer mb-2"
                onClick={() => {
                  setTaggedUsers(prev =>
                    prev.includes(safeUserId(u))
                      ? prev.filter(id => id !== safeUserId(u))
                      : [...prev, safeUserId(u)]
                  );
                }}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={u.profile_image_url || 'https://ui-avatars.com/api/?name=User'}
                    className="w-10 h-10 rounded-full object-cover"
                    alt=""
                  />
                  <div>
                    <div className="text-[#E4E6EB] font-medium">{u.name || u.username}</div>
                    <div className="text-[#B0B3B8] text-sm">{taggedUsers.includes(safeUserId(u)) ? 'Tagged' : ''}</div>
                  </div>
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

  if (showFeelingPicker) {
    return (
      <div className="fixed inset-0 z-[500] bg-[#18191A] flex flex-col animate-slide-up">
        <div className="flex items-center p-4 border-b border-[#3E4042] gap-4">
          <i
            className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
            onClick={() => setShowFeelingPicker(false)}
          ></i>
          <h3 className="text-[#E4E6EB] text-lg font-bold">How are you feeling?</h3>
        </div>

        <div className="p-4 grid grid-cols-2 gap-3">
          {FEELINGS.map((f) => (
            <div
              key={f}
              className="p-4 bg-[#3A3B3C] rounded-xl text-center cursor-pointer hover:bg-[#4E4F50]"
              onClick={() => {
                setFeeling(f);
                setShowFeelingPicker(false);
              }}
            >
              <div className="text-[#E4E6EB] font-medium">{f}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[500] bg-[#18191A] flex flex-col animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#3E4042]">
        <div className="flex items-center gap-4">
          <i
            className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
            onClick={onClose}
          ></i>
          <h3 className="text-[#E4E6EB] text-[20px] font-medium">Share to UNERA Feed</h3>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canPost}
          className="text-[#1877F2] font-bold text-[17px] disabled:text-[#B0B3B8]"
        >
          {isSubmitting ? 'Sharing...' : 'POST'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* User Info */}
        <div className="p-4 border-b border-[#3E4042]">
          <div className="flex items-center gap-3">
            <img
              src={currentUser.profile_image_url || 'https://ui-avatars.com/api/?name=User'}
              alt=""
              className="w-12 h-12 rounded-full object-cover"
            />
            <div className="flex-1">
              <div className="text-[#E4E6EB] font-bold">{currentUser.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <select
                  className="bg-[#3A3B3C] text-[#E4E6EB] text-sm px-3 py-1 rounded-lg border border-[#3E4042]"
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value as any)}
                >
                  <option value="public">🌍 Public</option>
                  <option value="friends">👥 Friends</option>
                  <option value="only_me">🔒 Only me</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Text Input */}
        <div className="p-4 border-b border-[#3E4042]">
          <textarea
            className="w-full bg-transparent text-[#E4E6EB] placeholder-[#B0B3B8] text-[20px] outline-none resize-none min-h-[100px]"
            placeholder="Write something..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={5000}
          />
          <div className="text-right text-[#B0B3B8] text-sm mt-2">
            {text.length}/5000
          </div>
        </div>

        {/* Action Rows */}
        <div className="space-y-1 px-2">
          <button
            onClick={() => setShowLocationSearch(true)}
            className="w-full flex items-center gap-3 p-3 hover:bg-[#3A3B3C] rounded-lg"
          >
            <i className="fas fa-map-marker-alt text-[#F02849] text-xl w-8 text-center"></i>
            <span className="text-[#E4E6EB]">{location || 'Add Location'}</span>
            {location && (
              <span className="ml-auto text-[#B0B3B8] text-sm">{location.split(',')[0]}</span>
            )}
          </button>

          <button
            onClick={() => setShowFeelingPicker(true)}
            className="w-full flex items-center gap-3 p-3 hover:bg-[#3A3B3C] rounded-lg"
          >
            <i className="far fa-smile text-[#F7B928] text-xl w-8 text-center"></i>
            <span className="text-[#E4E6EB]">{feeling ? `Feeling ${feeling}` : 'Feeling/Activity'}</span>
          </button>

          <button
            onClick={() => setShowTagUsers(true)}
            className="w-full flex items-center gap-3 p-3 hover:bg-[#3A3B3C] rounded-lg"
          >
            <i className="fas fa-user-tag text-[#1877F2] text-xl w-8 text-center"></i>
            <span className="text-[#E4E6EB]">
              {taggedUsers.length > 0 ? `Tagged ${taggedUsers.length} people` : 'Tag People'}
            </span>
          </button>
        </div>

        {/* Original Post Preview */}
        <div className="p-4 border-t border-[#3E4042] mt-4">
          <div className="text-[#B0B3B8] text-sm mb-2">Sharing this post:</div>
          <div className="bg-[#3A3B3C] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <img
                src={post.author?.profile_image_url || 'https://ui-avatars.com/api/?name=User'}
                alt=""
                className="w-8 h-8 rounded-full"
              />
              <div>
                <div className="text-[#E4E6EB] text-sm font-medium">
                  {post.author?.name || 'Original Author'}
                </div>
                <div className="text-[#B0B3B8] text-xs">
                  {formatRelativeTime(post.created_at)}
                </div>
              </div>
            </div>
            {post.content && (
              <div className="text-[#E4E6EB] text-sm mb-2 line-clamp-3">
                {post.content}
              </div>
            )}
            {post.media_url && (
              <div className="w-20 h-20 rounded-lg overflow-hidden">
                <img
                  src={post.media_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * =========================
 * 🟩 FLOW 2: SHARE TO GROUPS/BRANDS COMPONENT
 * =========================
 */
export const ShareToGroupsBrandsModal: React.FC<{
  post: any;
  currentUser: User;
  groups: Group[];
  brands: Brand[];
  onClose: () => void;
  onShareComplete: (success: boolean, data?: any) => void;
}> = ({ post, currentUser, groups = [], brands = [], onClose, onShareComplete }) => {
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [targetType, setTargetType] = useState<'groups' | 'brands'>('groups');
  const [text, setText] = useState('');
  const [perTargetText, setPerTargetText] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'select' | 'compose'>('select');

  const availableTargets = targetType === 'groups' ? groups : brands;

  const handleSelectTarget = (targetId: number) => {
    setSelectedTargets(prev => {
      if (prev.includes(targetId)) {
        return prev.filter(id => id !== targetId);
      }
      if (prev.length >= 10) {
        alert('You can only share to up to 10 targets at once');
        return prev;
      }
      return [...prev, targetId];
    });
  };

  const handleCompose = () => {
    if (selectedTargets.length === 0) {
      alert('Please select at least one target');
      return;
    }
    setStep('compose');
  };

  const handleSubmit = async () => {
    if (isSubmitting || selectedTargets.length === 0) return;
    
    setIsSubmitting(true);
    try {
      const payload = {
        original_post_id: post.id,
        user_id: currentUser.id,
        target_type: targetType,
        target_ids: selectedTargets,
        shared_text: text.trim(),
        per_target_text: Object.keys(perTargetText).length > 0 ? perTargetText : undefined,
        shared_at: new Date().toISOString(),
      };

      const response = await apiFetch('/api/posts/share/targets', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onShareComplete(true, response);
      onClose();
    } catch (error: any) {
      console.error('Failed to share:', error);
      onShareComplete(false, { error: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'compose') {
    return (
      <div className="fixed inset-0 z-[500] bg-[#18191A] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-[#3E4042]">
          <div className="flex items-center gap-4">
            <i
              className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
              onClick={() => setStep('select')}
            ></i>
            <h3 className="text-[#E4E6EB] text-[20px] font-medium">
              Share to {selectedTargets.length} {targetType}
            </h3>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="text-[#1877F2] font-bold text-[17px] disabled:text-[#B0B3B8]"
          >
            {isSubmitting ? 'Sharing...' : 'POST'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* General Message */}
          <div className="mb-6">
            <label className="block text-[#B0B3B8] text-sm mb-2">
              Message for all {targetType} (optional)
            </label>
            <textarea
              className="w-full bg-[#3A3B3C] text-[#E4E6EB] rounded-xl p-3 outline-none min-h-[100px]"
              placeholder={`Write something to share with these ${targetType}...`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
            />
          </div>

          {/* Selected Targets */}
          <div className="space-y-3">
            <div className="text-[#B0B3B8] text-sm">
              Selected {targetType} ({selectedTargets.length}/10)
            </div>
            {selectedTargets.map((targetId) => {
              const target = availableTargets.find(t => t.id === targetId);
              if (!target) return null;
              
              return (
                <div key={targetId} className="bg-[#3A3B3C] rounded-xl p-3">
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={target.image || target.avatar || 'https://ui-avatars.com/api/?name=Group'}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="text-[#E4E6EB] font-medium">
                        {target.name || target.title}
                      </div>
                      <div className="text-[#B0B3B8] text-xs">
                        {target.members_count || target.followers_count} members
                      </div>
                    </div>
                  </div>
                  
                  <label className="block text-[#B0B3B8] text-xs mb-1">
                    Custom message for this {targetType.slice(0, -1)} (optional)
                  </label>
                  <textarea
                    className="w-full bg-[#242526] text-[#E4E6EB] text-sm rounded-lg p-2 outline-none min-h-[60px]"
                    placeholder={`Write specific message for ${target.name}...`}
                    value={perTargetText[targetId] || ''}
                    onChange={(e) => setPerTargetText(prev => ({
                      ...prev,
                      [targetId]: e.target.value
                    }))}
                    maxLength={1000}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[500] bg-[#18191A] flex flex-col animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#3E4042]">
        <div className="flex items-center gap-4">
          <i
            className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
            onClick={onClose}
          ></i>
          <h3 className="text-[#E4E6EB] text-[20px] font-medium">
            Add {targetType === 'groups' ? 'Groups' : 'Brands'}
          </h3>
        </div>
        <button
          onClick={handleCompose}
          disabled={selectedTargets.length === 0}
          className="text-[#1877F2] font-bold text-[17px] disabled:text-[#B0B3B8]"
        >
          Next ({selectedTargets.length})
        </button>
      </div>

      {/* Toggle */}
      <div className="flex border-b border-[#3E4042]">
        <button
          className={`flex-1 py-3 text-center font-medium ${targetType === 'groups' ? 'text-[#1877F2] border-b-2 border-[#1877F2]' : 'text-[#B0B3B8]'}`}
          onClick={() => setTargetType('groups')}
        >
          Groups
        </button>
        <button
          className={`flex-1 py-3 text-center font-medium ${targetType === 'brands' ? 'text-[#1877F2] border-b-2 border-[#1877F2]' : 'text-[#B0B3B8]'}`}
          onClick={() => setTargetType('brands')}
        >
          Brands
        </button>
      </div>

      {/* Helper Text */}
      <div className="p-4 bg-[#3A3B3C] border-b border-[#3E4042]">
        <div className="text-[#E4E6EB] text-sm">
          Share with up to 10 {targetType} you're in
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-[#3E4042]">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B3B8]"></i>
          <input
            type="text"
            placeholder={`Search ${targetType}...`}
            className="w-full bg-[#3A3B3C] text-[#E4E6EB] pl-10 pr-4 py-2 rounded-lg outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {availableTargets.length === 0 ? (
          <div className="text-center py-10">
            <i className="fas fa-users text-4xl text-[#3A3B3C] mb-3"></i>
            <div className="text-[#E4E6EB] font-medium">No {targetType} available</div>
            <div className="text-[#B0B3B8] text-sm mt-1">
              Join some {targetType} to share posts with them
            </div>
          </div>
        ) : (
          availableTargets.map((target) => (
            <div
              key={target.id}
              className="flex items-center justify-between p-3 hover:bg-[#3A3B3C] rounded-lg cursor-pointer mb-2"
              onClick={() => handleSelectTarget(target.id)}
            >
              <div className="flex items-center gap-3">
                <img
                  src={target.image || target.avatar || 'https://ui-avatars.com/api/?name=Group'}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="text-[#E4E6EB] font-medium">
                    {target.name || target.title}
                  </div>
                  <div className="text-[#B0B3B8] text-sm">
                    {target.members_count || target.followers_count} members
                  </div>
                </div>
              </div>
              
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedTargets.includes(target.id) ? 'bg-[#1877F2] border-[#1877F2]' : 'border-[#B0B3B8]'}`}>
                {selectedTargets.includes(target.id) && (
                  <i className="fas fa-check text-white text-xs"></i>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/**
 * =========================
 * 🟨 FLOW 3: SHARE TO MESSAGES (DMs) COMPONENT
 * =========================
 */
export const ShareToMessagesModal: React.FC<{
  post: any;
  currentUser: User;
  users: User[];
  chats?: any[];
  onClose: () => void;
  onShareComplete: (success: boolean, data?: any) => void;
}> = ({ post, currentUser, users = [], chats = [], onClose, onShareComplete }) => {
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<number[]>([]);

  const filteredUsers = users.filter(user => {
    if (user.id === currentUser.id) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        user.name.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query)
      );
    }
    return true;
  }).slice(0, 20);

  const handleSendToUser = async (userId: number) => {
    if (isSending || sentTo.includes(userId)) return;
    
    setIsSending(true);
    try {
      const payload = {
        original_post_id: post.id,
        sender_id: currentUser.id,
        recipient_id: userId,
        message: message.trim(),
        shared_at: new Date().toISOString(),
      };

      const response = await apiFetch('/api/messages/share', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSentTo(prev => [...prev, userId]);
      setSelectedUsers(prev => prev.filter(id => id !== userId));
      
      // Update chat list
      const chatIndex = chats.findIndex(chat => 
        chat.participants.some((p: any) => p.id === userId)
      );
      
      if (chatIndex !== -1) {
        // Move chat to top
        const updatedChats = [...chats];
        const chat = updatedChats.splice(chatIndex, 1)[0];
        chat.last_message = message || 'Shared a post';
        chat.last_message_time = new Date().toISOString();
        updatedChats.unshift(chat);
      }
      
    } catch (error: any) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendToAllSelected = async () => {
    if (isSending || selectedUsers.length === 0) return;
    
    setIsSending(true);
    const successes: number[] = [];
    
    for (const userId of selectedUsers) {
      try {
        const payload = {
          original_post_id: post.id,
          sender_id: currentUser.id,
          recipient_id: userId,
          message: message.trim(),
          shared_at: new Date().toISOString(),
        };

        await apiFetch('/api/messages/share', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        
        successes.push(userId);
      } catch (error) {
        console.error(`Failed to send to user ${userId}:`, error);
      }
    }
    
    setSentTo(prev => [...prev, ...successes]);
    setSelectedUsers([]);
    setIsSending(false);
    
    if (successes.length > 0) {
      onShareComplete(true, { sentTo: successes });
      setTimeout(() => onClose(), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-[#18191A] flex flex-col animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#3E4042]">
        <div className="flex items-center gap-4">
          <i
            className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer"
            onClick={onClose}
          ></i>
          <h3 className="text-[#E4E6EB] text-[20px] font-medium">Share</h3>
        </div>
        <button
          onClick={handleSendToAllSelected}
          disabled={isSending || selectedUsers.length === 0}
          className="text-[#1877F2] font-bold text-[17px] disabled:text-[#B0B3B8]"
        >
          {isSending ? 'Sending...' : `Send (${selectedUsers.length})`}
        </button>
      </div>

      {/* Preview Card */}
      <div className="p-4 border-b border-[#3E4042]">
        <div className="bg-[#3A3B3C] rounded-xl p-3">
          <div className="flex gap-3">
            {post.media_url && (
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={post.media_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[#E4E6EB] text-sm font-medium mb-1 line-clamp-2">
                {post.content || 'Shared post'}
              </div>
              <div className="text-[#B0B3B8] text-xs">
                From: {post.author?.name || 'Unknown'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message Input */}
      <div className="p-4 border-b border-[#3E4042]">
        <textarea
          className="w-full bg-[#3A3B3C] text-[#E4E6EB] rounded-xl p-3 outline-none min-h-[80px] resize-none"
          placeholder="Write a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
        />
      </div>

      {/* Search */}
      <div className="p-4 border-b border-[#3E4042]">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B3B8]"></i>
          <input
            type="text"
            placeholder="Search recent chats, friends..."
            className="w-full bg-[#3A3B3C] text-[#E4E6EB] pl-10 pr-4 py-2 rounded-lg outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Recent Chats */}
      {chats.length > 0 && !searchQuery && (
        <div className="p-4 border-b border-[#3E4042]">
          <div className="text-[#B0B3B8] text-sm mb-3">Recent chats</div>
          <div className="space-y-2">
            {chats.slice(0, 5).map((chat) => {
              const otherUser = chat.participants?.find((p: any) => p.id !== currentUser.id);
              if (!otherUser) return null;
              
              const isSent = sentTo.includes(otherUser.id);
              const isSelected = selectedUsers.includes(otherUser.id);
              
              return (
                <div key={chat.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={otherUser.profile_image_url || 'https://ui-avatars.com/api/?name=User'}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <div className="text-[#E4E6EB] font-medium">
                        {otherUser.name}
                      </div>
                      <div className="text-[#B0B3B8] text-xs">
                        {chat.last_message || 'No messages yet'}
                      </div>
                    </div>
                  </div>
                  
                  {isSent ? (
                    <div className="text-[#45BD62] text-sm font-medium">
                      <i className="fas fa-check mr-1"></i> Sent
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (isSelected) {
                          setSelectedUsers(prev => prev.filter(id => id !== otherUser.id));
                        } else {
                          setSelectedUsers(prev => [...prev, otherUser.id]);
                        }
                      }}
                      className={`px-4 py-1.5 rounded-lg font-medium ${isSelected ? 'bg-[#1877F2] text-white' : 'bg-[#3A3B3C] text-[#E4E6EB]'}`}
                    >
                      {isSelected ? 'Selected' : 'Send'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Users List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-[#B0B3B8] text-sm mb-3">
          {searchQuery ? 'Search results' : 'All friends'}
        </div>
        
        {filteredUsers.length === 0 ? (
          <div className="text-center py-10">
            <i className="fas fa-user-friends text-4xl text-[#3A3B3C] mb-3"></i>
            <div className="text-[#E4E6EB] font-medium">No users found</div>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isSent = sentTo.includes(user.id);
            const isSelected = selectedUsers.includes(user.id);
            
            return (
              <div key={user.id} className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <img
                    src={user.profile_image_url || 'https://ui-avatars.com/api/?name=User'}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <div className="text-[#E4E6EB] font-medium">
                      {user.name}
                      {user.is_online && (
                        <span className="ml-2 w-2 h-2 bg-[#45BD62] rounded-full inline-block"></span>
                      )}
                    </div>
                    <div className="text-[#B0B3B8] text-xs">
                      @{user.username}
                    </div>
                  </div>
                </div>
                
                {isSent ? (
                  <div className="text-[#45BD62] text-sm font-medium">
                    <i className="fas fa-check mr-1"></i> Sent
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (isSelected) {
                        setSelectedUsers(prev => prev.filter(id => id !== user.id));
                      } else {
                        setSelectedUsers(prev => [...prev, user.id]);
                      }
                    }}
                    className={`px-4 py-1.5 rounded-lg font-medium ${isSelected ? 'bg-[#1877F2] text-white' : 'bg-[#3A3B3C] text-[#E4E6EB]'}`}
                  >
                    {isSelected ? 'Selected' : 'Send'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/**
 * =========================
 * MAIN SHARE BOTTOM SHEET
 * =========================
 */
export const ShareBottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  post: any;
  currentUser: User | null;
  users?: User[];
  groups?: Group[];
  brands?: Brand[];
  chats?: any[];
  onShareComplete?: (destination: string, data?: any) => void;
}> = ({ isOpen, onClose, post, currentUser, users = [], groups = [], brands = [], chats = [], onShareComplete }) => {
  const [activeFlow, setActiveFlow] = useState<'sheet' | 'feed' | 'groups' | 'messages'>('sheet');
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveFlow('sheet');
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const closeSheet = () => {
    setIsAnimating(true);
    setTimeout(() => {
      onClose();
      setActiveFlow('sheet');
      setIsAnimating(false);
    }, 200);
  };

  if (!isOpen) return null;

  // Handle different flows
  if (activeFlow === 'feed' && currentUser) {
    return (
      <ShareToFeedModal
        post={post}
        currentUser={currentUser}
        users={users}
        groups={groups}
        onClose={() => {
          setActiveFlow('sheet');
        }}
        onShareComplete={(success, data) => {
          if (success && onShareComplete) {
            onShareComplete('feed', data);
          }
          if (!success) {
            setActiveFlow('sheet');
          }
        }}
      />
    );
  }

  if (activeFlow === 'groups' && currentUser) {
    return (
      <ShareToGroupsBrandsModal
        post={post}
        currentUser={currentUser}
        groups={groups}
        brands={brands}
        onClose={() => {
          setActiveFlow('sheet');
        }}
        onShareComplete={(success, data) => {
          if (success && onShareComplete) {
            onShareComplete('groups', data);
          }
          if (!success) {
            setActiveFlow('sheet');
          }
        }}
      />
    );
  }

  if (activeFlow === 'messages' && currentUser) {
    return (
      <ShareToMessagesModal
        post={post}
        currentUser={currentUser}
        users={users}
        chats={chats}
        onClose={() => {
          setActiveFlow('sheet');
        }}
        onShareComplete={(success, data) => {
          if (success && onShareComplete) {
            onShareComplete('messages', data);
          }
          if (!success) {
            setActiveFlow('sheet');
          }
        }}
      />
    );
  }

  // Main share sheet
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-[300] transition-opacity duration-300 ${
          isAnimating ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={closeSheet}
      />

      {/* Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[301] bg-[#242526] rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col transition-transform duration-300 ease-out ${
          isAnimating ? 'translate-y-full' : 'translate-y-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 bg-[#3E4042] rounded-full"></div>
          </div>

          {/* Post Preview */}
          {post && (
            <div className="flex items-start gap-3 mb-4 p-3 bg-[#3A3B3C] rounded-xl">
              {post.media_url && (
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                  <img 
                    src={post.media_url} 
                    alt="Post" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[#E4E6EB] font-semibold text-sm">
                    {post.author?.name || 'Original Author'}
                  </span>
                  <span className="text-[#B0B3B8] text-xs">•</span>
                  <span className="text-[#B0B3B8] text-xs">
                    {formatRelativeTime(post.created_at)}
                  </span>
                </div>
                <p className="text-[#B0B3B8] text-sm line-clamp-2">
                  {post.content?.substring(0, 100) || 'Shared post'}
                  {post.content?.length > 100 ? '...' : ''}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Share Options */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-1">
            {/* 🟦 FLOW 1: Share to UNERA Feed */}
            <button
              onClick={() => {
                if (!currentUser) {
                  alert('Please login to share to feed');
                  return;
                }
                setActiveFlow('feed');
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#3A3B3C] active:bg-[#4E4F50] transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#1877F215] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <i className="fas fa-newspaper text-[#1877F2] text-lg"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#E4E6EB] font-medium text-[15px]">
                  Share to UNERA Feed
                </div>
                <div className="text-[#B0B3B8] text-xs mt-0.5">
                  Share to your profile feed
                </div>
              </div>
              <i className="fas fa-chevron-right text-[#B0B3B8] text-sm"></i>
            </button>

            {/* 🟩 FLOW 2: Share to Groups & Brands */}
            <button
              onClick={() => {
                if (!currentUser) {
                  alert('Please login to share to groups/brands');
                  return;
                }
                setActiveFlow('groups');
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#3A3B3C] active:bg-[#4E4F50] transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#45BD6215] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <i className="fas fa-users text-[#45BD62] text-lg"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#E4E6EB] font-medium text-[15px]">
                  Share to Groups & Brands
                </div>
                <div className="text-[#B0B3B8] text-xs mt-0.5">
                  Share with up to 10 groups/brands
                </div>
              </div>
              <i className="fas fa-chevron-right text-[#B0B3B8] text-sm"></i>
            </button>

            {/* 🟨 FLOW 3: Share to Messages */}
            <button
              onClick={() => {
                if (!currentUser) {
                  alert('Please login to send messages');
                  return;
                }
                setActiveFlow('messages');
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#3A3B3C] active:bg-[#4E4F50] transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#1877F215] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <i className="fas fa-comment-alt text-[#1877F2] text-lg"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#E4E6EB] font-medium text-[15px]">
                  Send as a Message
                </div>
                <div className="text-[#B0B3B8] text-xs mt-0.5">
                  Share via direct message
                </div>
              </div>
              <i className="fas fa-chevron-right text-[#B0B3B8] text-sm"></i>
            </button>

            {/* Other Options */}
            <button
              onClick={() => {
                if (!currentUser) {
                  alert('Please login to use this feature');
                  return;
                }
                // Open WhatsApp or other external apps
                const text = `Check out this post on UNERA: ${window.location.origin}/post/${post.id}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#3A3B3C] active:bg-[#4E4F50] transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#25D36615] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <i className="fab fa-whatsapp text-[#25D366] text-lg"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#E4E6EB] font-medium text-[15px]">
                  Send via WhatsApp
                </div>
                <div className="text-[#B0B3B8] text-xs mt-0.5">
                  Share to WhatsApp
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                const url = `${window.location.origin}/post/${post.id}`;
                navigator.clipboard.writeText(url);
                alert('Link copied to clipboard!');
                closeSheet();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#3A3B3C] active:bg-[#4E4F50] transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#1877F215] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <i className="fas fa-link text-[#1877F2] text-lg"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#E4E6EB] font-medium text-[15px]">
                  Copy Post Link
                </div>
                <div className="text-[#B0B3B8] text-xs mt-0.5">
                  Copy link to clipboard
                </div>
              </div>
            </button>
          </div>

          {/* Recent Contacts */}
          {currentUser && users.length > 0 && (
            <div className="mt-6">
              <div className="text-[#B0B3B8] text-xs font-semibold uppercase tracking-wider mb-3 px-1">
                Share with recent contacts
              </div>
              <div className="flex gap-3">
                {users
                  .filter(u => u.id !== currentUser.id)
                  .slice(0, 3)
                  .map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setActiveFlow('messages');
                        // Pre-select this user
                      }}
                      className="flex flex-col items-center gap-2"
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#1877F2] p-0.5">
                        <img
                          src={user.profile_image_url || 'https://ui-avatars.com/api/?name=User'}
                          alt={user.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <span className="text-[#E4E6EB] text-xs font-medium max-w-[60px] truncate">
                        {user.name.split(' ')[0]}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pt-3 border-t border-[#3E4042]">
          <button
            onClick={closeSheet}
            className="w-full py-3 bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] font-semibold rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};

/**
 * =========================
 * UPDATED POST COMPONENT WITH SHARE INTEGRATION
 * =========================
 */
export const Post: React.FC<{
  post: PostType;
  author: User | any;
  currentUser: User | null;
  users?: User[];
  onProfileClick: (id: number) => void;
  onReact: (id: number, type: ReactionType) => void;
  onShare: (id: number) => void;
  onDelete?: (id: number) => void;
  onViewImage: (url: string) => void;
  onOpenComments: (id: number) => void;
  onVideoClick: (p: PostType) => void;
  onPlayAudioTrack?: (t: AudioTrack) => void;
  onHashtagClick?: (tag: string) => void;
  groups?: Group[];
  brands?: Brand[];
  chats?: any[];
}> = ({
  post,
  author,
  currentUser,
  users = [],
  onProfileClick,
  onReact,
  onShare,
  onDelete,
  onViewImage,
  onOpenComments,
  onVideoClick,
  onPlayAudioTrack,
  onHashtagClick,
  groups = [],
  brands = [],
  chats = [],
}) => {
  const p: any = post as any;
  const a: any = author as any;

  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareDestination, setShareDestination] = useState<string | null>(null);

  // ... rest of the existing Post component code remains the same ...

  const handleShareClick = (postId: number) => {
    if (!currentUser) {
      alert('Please login to share posts.');
      return;
    }
    setShowShareSheet(true);
  };

  const handleShareComplete = (destination: string, data?: any) => {
    if (data?.success) {
      // Notify parent component about the share
      onShare(p.id);
      // Show success message
      console.log(`Successfully shared to ${destination}`, data);
    }
    setShowShareSheet(false);
  };

  return (
    <>
      {/* Existing Post component JSX */}
      {/* ... */}

      {/* Share button in action bar */}
      <button
        className="flex-1 flex items-center justify-center gap-2 h-10 rounded hover:bg-[#3A3B3C] transition-colors group text-[#B0B3B8]"
        onClick={() => handleShareClick(p.id)}
      >
        <i className="fas fa-share text-[20px]"></i>
        <span className="text-[17px] font-medium">Share</span>
      </button>

      {/* Share Bottom Sheet */}
      <ShareBottomSheet
        isOpen={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        post={p}
        currentUser={currentUser}
        users={users}
        groups={groups}
        brands={brands}
        chats={chats}
        onShareComplete={handleShareComplete}
      />
    </>
  );
};

// ... rest of the existing Feed.tsx code (CreatePost, CreatePostModal, CommentsSheet, etc.)
