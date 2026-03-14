import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEllipsisH,
  faGlobe,
  faCheckCircle,
  faPhone,
  faEnvelope,
  faExternalLinkAlt,
  faUserCircle
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
  advertiserName?: string;
  advertiserAvatar?: string;
  isVerified?: boolean;
  isFullView?: boolean;
}

export default function AdPreview({ 
  data, 
  advertiserName = "Sponsored", 
  advertiserAvatar, 
  isVerified = false,
  isFullView 
}: AdPreviewProps) {
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
      {/* Sponsored Label */}
      <div className="px-3 pt-3 pb-1">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Sponsored
        </span>
      </div>

      {/* Header - Avatar and Name */}
      <div className="px-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-600 flex-shrink-0">
            {advertiserAvatar ? (
              <img 
                src={advertiserAvatar} 
                alt={advertiserName} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(advertiserName)}&background=1877F2&color=fff&bold=true`;
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                {advertiserName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          {/* Name and Verified Badge */}
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-zinc-900">
              {advertiserName}
            </span>
            {isVerified && (
              <FontAwesomeIcon 
                icon={faCheckCircle} 
                className="w-4 h-4 text-blue-500" 
              />
            )}
          </div>
        </div>
        
        {/* Three dots menu */}
        <button className="p-1.5 hover:bg-zinc-100 rounded-full transition-colors">
          <FontAwesomeIcon icon={faEllipsisH} className="w-4 h-4 text-zinc-600" />
        </button>
      </div>

      {/* Advertisement Media */}
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

      {/* Ad Description */}
      {data.description && (
        <div className="px-3 py-3">
          <p className="text-sm leading-relaxed text-zinc-800">
            {data.description}
          </p>
        </div>
      )}

      {/* Link/Contact Info and CTA Button */}
      <div className="px-3 pb-3">
        {/* Website/Contact display */}
        <div className="flex items-center gap-2 mb-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
          <FontAwesomeIcon icon={getContactIcon()} className="w-3 h-3" />
          <span className="truncate font-medium">{getContactDisplay()}</span>
        </div>
        
        {/* CTA Button */}
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
          {data.cta}
        </button>
      </div>
    </div>
  );
}
