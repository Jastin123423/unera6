import React, { useEffect } from 'react';

export const Spinner = () => (
    <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1877F2]"></div>
    </div>
);

interface ImageViewerProps {
    imageUrl: string;
    onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="absolute top-4 right-4 w-10 h-10 bg-[#3A3B3C] hover:bg-[#4E4F50] rounded-full flex items-center justify-center cursor-pointer transition-colors z-50" onClick={onClose}>
                <i className="fas fa-times text-[#E4E6EB] text-xl"></i>
            </div>
            <img src={imageUrl} alt="Full screen" className="max-w-full max-h-screen object-contain shadow-2xl cursor-default" onClick={(e) => e.stopPropagation()} />
        </div>
    );
};