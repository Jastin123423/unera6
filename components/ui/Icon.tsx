import React from 'react';

type IconName = 
  | 'home' | 'profile' | 'reels' | 'marketplace' | 'groups' | 'ads'
  | 'music' | 'events' | 'settings' | 'help' | 'logout' | 'login'
  | 'register' | 'notifications' | 'trending' | 'chart' | 'plus'
  | 'edit' | 'delete' | 'pause' | 'play' | 'resume' | 'analytics';

interface IconProps {
  name: IconName;
  className?: string;
}

const iconMap: Record<IconName, string> = {
  home: '🏠',
  profile: '👤',
  reels: '🎬',
  marketplace: '🛒',
  groups: '👥',
  ads: '📊',
  music: '🎵',
  events: '📅',
  settings: '⚙️',
  help: '❓',
  logout: '🚪',
  login: '🔑',
  register: '📝',
  notifications: '🔔',
  trending: '📈',
  chart: '📊',
  plus: '➕',
  edit: '✏️',
  delete: '🗑️',
  pause: '⏸️',
  play: '▶️',
  resume: '▶️',
  analytics: '📉',
};

export const Icon: React.FC<IconProps> = ({ name, className = '' }) => {
  return <span className={`inline-block ${className}`}>{iconMap[name]}</span>;
};
