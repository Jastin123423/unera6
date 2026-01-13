
import React, { useState } from 'react';
import { STICKER_PACKS, EMOJI_LIST } from '../constants';

interface StickerPickerProps {
    onSelect: (url: string) => void;
}

export const StickerPicker: React.FC<StickerPickerProps> = ({ onSelect }) => {
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<string>('All');
    
    // Filter stickers based on search or category
    const categories = Object.keys(STICKER_PACKS);
    
    // If searching, search across all packs roughly by checking logic or just fallback to All for now
    // Since mock data doesn't have "tags", we simulate search by filtering categories or just showing 'All'
    // For this implementation, search filters tabs
    
    const filteredCategories = categories.filter(c => c.toLowerCase().includes(search.toLowerCase()));
    
    const currentPack = STICKER_PACKS[activeTab as keyof typeof STICKER_PACKS] || STICKER_PACKS['All'];

    return (
        <div className="bg-[#242526] h-[250px] flex flex-col border-t border-[#3E4042]">
            {/* Search */}
            <div className="p-2 border-b border-[#3E4042]">
                <div className="bg-[#3A3B3C] rounded-full flex items-center px-3 py-1.5">
                    <i className="fas fa-search text-[#B0B3B8] text-sm mr-2"></i>
                    <input 
                        type="text" 
                        placeholder="Search stickers" 
                        className="bg-transparent text-[#E4E6EB] text-sm outline-none w-full"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2">
                {search ? (
                    <div className="grid grid-cols-4 gap-2">
                        {/* If searching, just show a flat list from 'All' to simulate results */}
                        {STICKER_PACKS['All'].map((url, i) => (
                            <img 
                                key={i} 
                                src={url} 
                                alt="sticker" 
                                className="w-full h-auto cursor-pointer hover:scale-110 transition-transform"
                                onClick={() => onSelect(url)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-2">
                        {currentPack.map((url, i) => (
                            <img 
                                key={i} 
                                src={url} 
                                alt="sticker" 
                                className="w-full h-auto cursor-pointer hover:scale-110 transition-transform"
                                onClick={() => onSelect(url)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex bg-[#242526] overflow-x-auto border-t border-[#3E4042] scrollbar-hide">
                {categories.map(cat => (
                    <div 
                        key={cat}
                        className={`px-3 py-2 text-sm cursor-pointer whitespace-nowrap ${activeTab === cat ? 'text-[#1877F2] font-bold bg-[#3A3B3C]' : 'text-[#B0B3B8] hover:bg-[#3A3B3C]'}`}
                        onClick={() => { setActiveTab(cat); setSearch(''); }}
                    >
                        {cat}
                    </div>
                ))}
            </div>
        </div>
    );
};

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
    return (
        <div className="bg-[#242526] h-[250px] overflow-y-auto p-2 border-t border-[#3E4042]">
            <div className="text-[#B0B3B8] text-xs font-bold mb-2 uppercase">Smileys & People</div>
            <div className="grid grid-cols-8 gap-1">
                {EMOJI_LIST.map((emoji, i) => (
                    <div 
                        key={i} 
                        className="text-2xl cursor-pointer hover:bg-[#3A3B3C] rounded p-1 flex items-center justify-center transition-colors"
                        onClick={() => onSelect(emoji)}
                    >
                        {emoji}
                    </div>
                ))}
            </div>
        </div>
    );
};
