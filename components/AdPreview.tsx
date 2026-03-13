import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEllipsisH,
  faHeart,
  faComment,
  faPaperPlane,
  faBookmark,
  faGlobe,
  faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import { AdType, CTAButton } from '../types';

interface AdPreviewProps {
  data: {
    name?: string;
    type: AdType;
    mediaUrl: string;
    description: string;
    cta: CTAButton;
    link?: string;
  };
  isFullView?: boolean;
}

export default function AdPreview({ data, isFullView }: AdPreviewProps) {
  const hostname = data.link ? new URL(data.link).hostname.replace('www.', '') : 'yourwebsite.com';

  return (
    <div className={`mx-auto bg-white rounded-xl overflow-hidden shadow-2xl text-black font-sans transition-all duration-500 ${isFullView ? 'w-full max-w-[400px]' : 'w-[320px] md:w-[360px]'}`}>
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
            Ad
          </div>
          <div>
            <div className="flex items-center gap-1">
              <p className="text-sm font-bold leading-tight hover:underline cursor-pointer">Sponsored • {data.name || 'Your Brand'}</p>
              <div className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                <FontAwesomeIcon icon={faCheckCircle} className="w-2 h-2 text-white" />
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
              <span>Sponsored</span>
              <span>•</span>
              <FontAwesomeIcon icon={faGlobe} className="w-2.5 h-2.5" />
            </div>
          </div>
        </div>
        <button className="p-1 hover:bg-zinc-100 rounded-full transition-colors">
          <FontAwesomeIcon icon={faEllipsisH} className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Media */}
      <div className="aspect-square bg-zinc-100 relative overflow-hidden group">
        {data.mediaUrl ? (
          data.type === 'image' ? (
            <img 
              src={data.mediaUrl} 
              alt="Preview" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
            />
          ) : (
            <video 
              src={data.mediaUrl} 
              className="w-full h-full object-cover" 
              autoPlay 
              muted 
              loop 
              playsInline 
            />
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-300 gap-2 bg-gradient-to-br from-blue-50 to-indigo-50">
            <div className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-blue-600">Ad</span>
            </div>
            <p className="text-xs font-medium text-zinc-400">Your ad preview</p>
          </div>
        )}
      </div>

      {/* CTA Bar */}
      <div className="bg-zinc-50 px-4 py-3 flex items-center justify-between border-b border-zinc-100 group cursor-pointer hover:bg-zinc-100 transition-colors">
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold truncate">{hostname}</p>
          <p className="text-sm font-bold truncate text-zinc-900">{data.name || 'Campaign Name'}</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm">
          {data.cta}
        </button>
      </div>

      {/* Description */}
      <div className="p-3">
        <p className="text-sm leading-relaxed text-zinc-800">
          {data.description || 'Your ad description will appear here. Make it catchy to grab attention!'}
        </p>
      </div>

      {/* Interactions (static for preview) */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <button className="hover:scale-110 transition-transform">
              <FontAwesomeIcon icon={faHeart} className="w-5 h-5 text-zinc-600" />
            </button>
            <button className="hover:scale-110 transition-transform">
              <FontAwesomeIcon icon={faComment} className="w-5 h-5 text-zinc-600" />
            </button>
            <button className="hover:scale-110 transition-transform">
              <FontAwesomeIcon icon={faPaperPlane} className="w-5 h-5 text-zinc-600" />
            </button>
          </div>
          <button className="hover:scale-110 transition-transform">
            <FontAwesomeIcon icon={faBookmark} className="w-5 h-5 text-zinc-600" />
          </button>
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <span className="font-bold text-zinc-700">1.2k likes</span>
          <span>•</span>
          <span>42 comments</span>
        </div>
      </div>
    </div>
  );
}
