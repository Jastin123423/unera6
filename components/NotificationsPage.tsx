import React from "react";
import { Notification, User } from "../types";

interface Props {
  notifications: Notification[];
  users: User[];
  onBack: () => void;
  onProfileClick: (id: number) => void;
}

export const NotificationsPage: React.FC<Props> = ({
  notifications,
  users,
  onBack,
  onProfileClick
}) => {

  const getUser = (id:number)=>users.find(u=>u.id===id);

  return (
    <div className="fixed inset-0 z-[300] bg-[#18191A] overflow-y-auto">

      {/* Header */}
      <div className="sticky top-0 bg-[#242526] h-14 flex items-center px-4 border-b border-[#3E4042]">

        <button
          onClick={onBack}
          className="mr-4 text-[#E4E6EB]"
        >
          <i className="fas fa-arrow-left text-xl"></i>
        </button>

        <h2 className="text-[#E4E6EB] font-bold text-[22px]">
          Notifications
        </h2>

      </div>


      {/* Notifications list */}
      <div className="p-2 space-y-2">

        {notifications.map((n)=>{

          const actor = getUser(n.actor_id);

          return (
            <div
              key={n.id}
              className={`flex gap-3 p-3 rounded-lg cursor-pointer hover:bg-[#3A3B3C] ${
                !n.is_read ? "bg-[#263951]" : ""
              }`}
            >

              {/* Avatar */}
              <div className="relative">

                <img
                  src={actor?.profile_image_url}
                  className="w-12 h-12 rounded-full object-cover"
                />

                {/* notification icon */}
                <div className="absolute bottom-0 right-0 w-6 h-6 bg-[#1877F2] rounded-full flex items-center justify-center border-2 border-[#18191A]">
                  <i className="fas fa-thumbs-up text-white text-[10px]"></i>
                </div>

              </div>


              {/* Text */}
              <div className="flex flex-col flex-1">

                <span className="text-[#E4E6EB] text-[15px]">

                  <b
                    className="cursor-pointer"
                    onClick={()=>onProfileClick(actor?.id || 0)}
                  >
                    {actor?.name}
                  </b>

                  {actor?.is_verified && (
                    <i className="fas fa-check-circle text-[#1877F2] ml-1 text-[12px]"></i>
                  )}

                  {" "}liked your post

                </span>

                <span className="text-[#B0B3B8] text-[13px] mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </span>

              </div>


              {/* menu */}
              <i className="fas fa-ellipsis-h text-[#B0B3B8]"></i>

            </div>
          )

        })}

      </div>

    </div>
  );
};
