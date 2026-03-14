import React, { useEffect } from "react";
import { User } from "../../types";

interface SponsoredPostCardProps {
  ad: any; // The ad object from the feed
  currentUser?: User | null;
  onProfileClick?: (id: number) => void;
  onAnalyticsClick?: (adId: number) => void;
  onClick?: () => void;
  onHideAd?: (adId: number) => void;
  onReportAd?: (adId: number) => void;
}

export const SponsoredPostCard: React.FC<SponsoredPostCardProps> = ({
  ad,
  currentUser,
  onProfileClick,
  onAnalyticsClick,
  onClick,
  onHideAd,
  onReportAd,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const isOwner = currentUser?.id === ad.user_id || currentUser?.id === ad.advertiser_id;

  // Handle clicks outside menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Record impression
  useEffect(() => {
    fetch("/api/ads/impression", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": String(currentUser?.id || 0),
      },
      body: JSON.stringify({
        ad_id: ad.id,
      }),
    });
  }, [ad.id, currentUser?.id]);

  const handleClick = () => {
    fetch("/api/ads/click", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": String(currentUser?.id || 0),
      },
      body: JSON.stringify({
        ad_id: ad.id,
      }),
    });

    if (ad.cta_url) {
      window.open(ad.cta_url, '_blank', 'noopener,noreferrer');
    }
    
    onClick?.();
  };

  const handleCTAClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleClick();
  };

  // Get CTA button text based on type
  const getCTAText = () => {
    if (ad.cta_text) return ad.cta_text;
    
    switch(ad.cta_type) {
      case 'phone': return 'Call Now';
      case 'email': return 'Email Us';
      case 'link': return 'Learn More';
      default: return 'Learn More';
    }
  };

  // Get media URL (either from media_url or first item in media_urls)
  const mediaUrl = ad.media_url || (ad.media_urls && ad.media_urls[0]) || null;

  return (
    <div className="bg-[#242526] rounded-xl shadow-sm mb-4 overflow-hidden border border-[#3E4042]">
      {/* HEADER */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center">
          <img
            src={ad.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(ad.name || 'Sponsored')}&background=1877F2&color=fff`}
            className="w-10 h-10 rounded-full mr-3 object-cover"
            alt={ad.name}
            onError={(e) => {
              const target = e.currentTarget;
              target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(ad.name || 'Sponsored')}&background=1877F2&color=fff`;
            }}
          />

          <div>
            <div
              className="font-semibold text-[#E4E6EB] cursor-pointer hover:underline"
              onClick={() => onProfileClick?.(ad.user_id || ad.advertiser_id)}
            >
              {ad.name || 'Sponsored'}
              {ad.is_verified && (
                <i className="fas fa-check-circle text-[#1877F2] text-[13px] ml-1"></i>
              )}
            </div>

            <div className="flex items-center text-xs text-[#B0B3B8]">
              <span className="flex items-center gap-1">
                <i className="fas fa-ad text-[#F7B928] text-[10px]"></i>
                Sponsored
              </span>
              {ad.reason && (
                <>
                  <span className="mx-1">·</span>
                  <span className="text-[#B0B3B8]">{ad.reason}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Menu button */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 rounded-full hover:bg-[#3A3B3C] flex items-center justify-center transition-colors"
          >
            <i className="fas fa-ellipsis-h text-[#B0B3B8]"></i>
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-10 w-56 bg-[#242526] rounded-xl shadow-2xl border border-[#3E4042] z-50 py-2">
              <button
                onClick={() => {
                  setShowMenu(false);
                  onHideAd?.(ad.id);
                }}
                className="w-full px-4 py-2 hover:bg-[#3A3B3C] text-left text-[#E4E6EB] text-sm flex items-center gap-2"
              >
                <i className="fas fa-eye-slash text-[#B0B3B8] w-5"></i>
                Hide ad
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onReportAd?.(ad.id);
                }}
                className="w-full px-4 py-2 hover:bg-[#3A3B3C] text-left text-[#E4E6EB] text-sm flex items-center gap-2"
              >
                <i className="fas fa-flag text-[#B0B3B8] w-5"></i>
                Report ad
              </button>
              <div className="border-t border-[#3E4042] my-2"></div>
              <div className="px-4 py-2 text-[#B0B3B8] text-xs">
                Ad ID: {ad.id}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* HEADLINE */}
      {ad.headline && (
        <div className="px-3 pb-1">
          <h3 className="text-[#E4E6EB] font-bold text-[18px]">
            {ad.headline}
          </h3>
        </div>
      )}

      {/* DESCRIPTION / CONTENT */}
      {(ad.description || ad.content) && (
        <div className="px-3 pb-3 text-[#B0B3B8] text-[15px]">
          {ad.description || ad.content}
        </div>
      )}

      {/* MEDIA */}
      {mediaUrl && (
        <div 
          onClick={handleClick}
          className="cursor-pointer"
        >
          <img
            src={mediaUrl}
            alt={ad.headline || 'Sponsored ad'}
            className="w-full max-h-[400px] object-cover"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* CTA BUTTON - Show if there's a URL or if it's phone/email type */}
      {(ad.cta_url || ad.cta_type === 'phone' || ad.cta_type === 'email') && (
        <div className="px-3 py-2">
          <button
            onClick={handleCTAClick}
            className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {getCTAText()}
          </button>
        </div>
      )}

      {/* ACTIONS */}
      <div className="flex justify-between text-sm px-4 py-3 border-t border-[#3E4042] text-[#B0B3B8]">
        <button className="hover:text-[#E4E6EB] flex items-center gap-1">
          <i className="far fa-thumbs-up"></i>
          <span>Like</span>
        </button>

        <button className="hover:text-[#E4E6EB] flex items-center gap-1">
          <i className="far fa-comment"></i>
          <span>Comment</span>
        </button>

        <button className="hover:text-[#E4E6EB] flex items-center gap-1">
          <i className="far fa-share-square"></i>
          <span>Share</span>
        </button>

        {/* Advertiser analytics */}
        {isOwner && (
          <button
            onClick={() => onAnalyticsClick?.(ad.id)}
            className="text-green-500 font-semibold hover:text-green-400 flex items-center gap-1"
          >
            <i className="fas fa-chart-bar"></i>
            <span>Analytics</span>
          </button>
        )}
      </div>

      {/* Campaign info */}
      {ad.campaign_name && (
        <div className="px-4 pb-2 text-[#B0B3B8] text-xs border-t border-[#3E4042] pt-2">
          <i className="fas fa-bullhorn mr-1"></i>
          Campaign: {ad.campaign_name}
          {ad.target_location && (
            <>
              <span className="mx-1">·</span>
              <i className="fas fa-map-marker-alt mr-1"></i>
              {ad.target_location}
            </>
          )}
        </div>
      )}
    </div>
  );
};
