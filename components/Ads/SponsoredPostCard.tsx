import React, { useEffect } from "react";
import { User } from "../../types";

interface SponsoredPostCardProps {
  ad: any;
  post: any;
  author: User;
  currentUser?: User | null;

  onProfileClick?: (id: number) => void;
  onAnalyticsClick?: (adId: number) => void;
  onClick?: () => void;
}

export const SponsoredPostCard: React.FC<SponsoredPostCardProps> = ({
  ad,
  post,
  author,
  currentUser,
  onProfileClick,
  onAnalyticsClick,
  onClick,
}) => {

  const isOwner = currentUser?.id === ad.advertiser_id;

  // record impression
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
  }, []);

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

    onClick?.();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm mb-4 overflow-hidden">

      {/* HEADER */}
      <div className="flex items-center p-3">
        <img
          src={author.avatar || "/avatar.png"}
          className="w-10 h-10 rounded-full mr-3"
        />

        <div>
          <div
            className="font-semibold cursor-pointer"
            onClick={() => onProfileClick?.(author.id)}
          >
            {author.name}
          </div>

          <div className="text-xs text-gray-500">
            Sponsored
          </div>
        </div>
      </div>

      {/* POST TEXT */}
      {post.text && (
        <div className="px-3 pb-2 text-[16px]">
          {post.text}
        </div>
      )}

      {/* MEDIA */}
      {post.media_url && (
        <div onClick={handleClick}>
          <img
            src={post.media_url}
            className="w-full object-cover cursor-pointer"
          />
        </div>
      )}

      {/* ACTIONS */}
      <div className="flex justify-between text-sm px-4 py-3 border-t">

        <button className="hover:text-blue-600">
          Like
        </button>

        <button className="hover:text-blue-600">
          Comment
        </button>

        <button className="hover:text-blue-600">
          Share
        </button>

        {/* Advertiser analytics */}
        {isOwner && (
          <button
            onClick={() => onAnalyticsClick?.(ad.id)}
            className="text-green-600 font-semibold"
          >
            Analytics
          </button>
        )}

        {!isOwner && (
          <button
            onClick={handleClick}
            className="text-blue-600 font-semibold"
          >
            Learn More
          </button>
        )}

      </div>
    </div>
  );
};
