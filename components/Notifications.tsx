
import React from 'react';
import { Notification, User } from '../types';

interface NotificationDropdownProps {
    notifications: Notification[];
    users: User[];
    onNotificationClick: (n: Notification) => void;
    onMarkAllRead: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ notifications, users, onNotificationClick, onMarkAllRead }) => {
    const getIcon = (type: string) => {
        switch (type) {
            case 'like': return <div className="w-7 h-7 bg-[#1877F2] rounded-full flex items-center justify-center border-2 border-[#242526]"><i className="fas fa-thumbs-up text-white text-xs"></i></div>;
            case 'comment': return <div className="w-7 h-7 bg-[#45BD62] rounded-full flex items-center justify-center border-2 border-[#242526]"><i className="fas fa-comment-alt text-white text-xs"></i></div>;
            case 'follow': return <div className="w-7 h-7 bg-[#1877F2] rounded-full flex items-center justify-center border-2 border-[#242526]"><i className="fas fa-user-plus text-white text-xs"></i></div>;
            case 'birthday': return <div className="w-7 h-7 bg-[#FAB400] rounded-full flex items-center justify-center border-2 border-[#242526]"><i className="fas fa-birthday-cake text-white text-xs"></i></div>;
            case 'share': return <div className="w-7 h-7 bg-[#1877F2] rounded-full flex items-center justify-center border-2 border-[#242526]"><i className="fas fa-share text-white text-xs"></i></div>;
            default: return null;
        }
    };
    const getTimeAgo = (timestamp: string) => {
        const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
        if (seconds < 60) return "Just now";
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        return `${Math.floor(seconds / 86400)}d`;
    };
    return (
        <div className="absolute top-12 right-0 w-[360px] bg-[#242526] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-[#3E4042] z-50 max-h-[90vh] flex flex-col">
            <div className="p-4 flex justify-between items-center"><h3 className="text-[20px] font-bold text-[#E4E6EB]">Notifications</h3></div>
            <div className="px-4 pb-2"><div className="flex gap-2"><span className="bg-[#263951] text-[#2D88FF] px-3 py-1.5 rounded-full text-[15px] font-semibold cursor-pointer">All</span><span className="hover:bg-[#3A3B3C] px-3 py-1.5 rounded-full text-[15px] font-semibold cursor-pointer text-[#E4E6EB]" onClick={onMarkAllRead}>Mark all read</span></div></div>
            <div className="flex-1 overflow-y-auto p-2">
                {notifications.length === 0 ? <div className="p-4 text-center text-[#B0B3B8]">No notifications</div> : notifications.map(notif => {
                    const sender = users.find(u => u.id === notif.sender_id);
                    if (!sender) return null;
                    return (
                        <div key={notif.id} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer ${notif.is_read ? 'hover:bg-[#3A3B3C]' : 'bg-[#263951] hover:bg-[#2A3F5A]'}`} onClick={() => onNotificationClick(notif)}>
                            <div className="relative"><img src={sender.profile_image_url} alt="" className="w-14 h-14 rounded-full object-cover" /><div className="absolute -bottom-1 -right-1">{getIcon(notif.type)}</div></div>
                            <div className="flex-1 flex flex-col justify-center"><p className="text-[15px] leading-snug text-[#E4E6EB]"><span className="font-bold">{sender.name}</span> {notif.content}</p><span className={`text-[13px] font-semibold ${notif.is_read ? 'text-[#B0B3B8]' : 'text-[#2D88FF]'}`}>{getTimeAgo(notif.created_at)}</span></div>
                            {!notif.is_read && <div className="w-3 h-3 bg-[#2D88FF] rounded-full self-center"></div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
