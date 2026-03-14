import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEllipsisH,
  faHeart,
  faComment,
  faShare,
  faGlobe,
  faCheckCircle,
  faPhone,
  faEnvelope,
  faExternalLinkAlt
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
    phone?: string;
    email?: string;
  };
  isFullView?: boolean;
}

export default function AdPreview({ data, isFullView }: AdPreviewProps) {
  // Extract hostname from link
  const getHostname = (url?: string) => {
    if (!url) return 'example.com';
    try {
      const hostname = new URL(url).hostname.replace('www.', '');
      return hostname;
    } catch {
      return 'example.com';
    }
  };

  // Get contact info display
  const getContactDisplay = () => {
    if (data.link) return getHostname(data.link);
    if (data.phone) return data.phone;
    if (data.email) return data.email;
    return 'example.com';
  };

  // Get contact icon
  const getContactIcon = () => {
    if (data.link) return faExternalLinkAlt;
    if (data.phone) return faPhone;
    if (data.email) return faEnvelope;
    return faGlobe;
  };

  return (
    <div className={`mx-auto bg-white rounded-lg overflow-hidden shadow-xl text-black font-sans transition-all duration-500 border border-zinc-200 ${
      isFullView ? 'w-full max-w-[500px]' : 'w-[320px] md:w-[380px]'
    }`}>
      {/* Header - Facebook style */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Brand/Page Icon */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            {data.name?.charAt(0) || 'A'}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold hover:underline cursor-pointer">
                {data.name || 'Sponsored'}
              </span>
              <FontAwesomeIcon icon={faCheckCircle} className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="flex items-center gap-1 text-[11px] text-zinc-500">
              <span>Sponsored</span>
              <span>·</span>
              <FontAwesomeIcon icon={faGlobe} className="w-2.5 h-2.5" />
            </div>
          </div>
        </div>
        <button className="p-1.5 hover:bg-zinc-100 rounded-full transition-colors">
          <FontAwesomeIcon icon={faEllipsisH} className="w-4 h-4 text-zinc-600" />
        </button>
      </div>

      {/* Description - Facebook style */}
      {data.description && (
        <div className="px-3 pb-2">
          <p className="text-sm leading-relaxed text-zinc-800">
            {data.description}
          </p>
        </div>
      )}

      {/* Media - Full width like Facebook */}
      <div className="w-full bg-zinc-100 relative">
        {data.mediaUrl ? (
          data.type === 'image' ? (
            <img 
              src={data.mediaUrl} 
              alt="Ad preview" 
              className="w-full aspect-square object-cover"
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/500x500?text=Ad+Image';
              }}
            />
          ) : (
            <video 
              src={data.mediaUrl} 
              className="w-full aspect-square object-cover" 
              controls={false}
              muted 
              loop 
              playsInline
            />
          )
        ) : (
          <div className="w-full aspect-square bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
            <span className="text-zinc-400 text-sm">Ad Preview</span>
          </div>
        )}
      </div>

      {/* Link Preview - Facebook style */}
      <div className="p-3 bg-zinc-50 border-t border-zinc-200">
        <div className="flex items-center gap-2 text-xs text-blue-600 mb-1">
          <FontAwesomeIcon icon={getContactIcon()} className="w-3 h-3" />
          <span className="truncate">{getContactDisplay()}</span>
        </div>
        <p className="text-[13px] font-semibold text-zinc-900 mb-1">
          {data.cta}
        </p>
        <p className="text-xs text-zinc-600">
          {data.link && 'Click to learn more'}
          {data.phone && 'Click to call now'}
          {data.email && 'Click to send email'}
        </p>
      </div>

      {/* CTA Button - Facebook style */}
      <div className="px-3 pb-3">
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
          {data.cta}
        </button>
      </div>

      {/* Reactions - Static for preview */}
      <div className="px-3 pb-3 flex items-center gap-2 text-xs text-zinc-500 border-t border-zinc-200 pt-3">
        <FontAwesomeIcon icon={faHeart} className="w-4 h-4 text-red-500" />
        <span>24</span>
        <span className="mx-1">·</span>
        <FontAwesomeIcon icon={faComment} className="w-4 h-4 text-zinc-500" />
        <span>3</span>
        <span className="mx-1">·</span>
        <FontAwesomeIcon icon={faShare} className="w-4 h-4 text-zinc-500" />
        <span>1</span>
      </div>
    </div>
  );
}
