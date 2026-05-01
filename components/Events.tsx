// Events.tsx - Add native detection and image picker support

import React, { useState, useRef, useEffect } from 'react';
import { User, Event } from '../types';

/* =========================================================
   NATIVE APP DETECTION
========================================================= */

const isUneraNativeApp = (): boolean => {
  return Boolean(
    (window as any).UneraNative || 
    (window as any).UNERA_IS_NATIVE_APP
  );
};

const openNativeImagePicker = (): boolean => {
  if ((window as any).UneraNative?.postMessage) {
    (window as any).UneraNative.postMessage(
      JSON.stringify({ action: 'pick_image' })
    );
    return true;
  }
  return false;
};

/* =========================================================
   EVENT COVER COMPRESSION HELPERS
========================================================= */

// ... keep all your existing compression helpers ...
const canvasToBlob = (...)
const loadImageElement = (...)
const calcContainSize = (...)
const compressEventCoverImage = async (file: File): Promise<File> => {
  // ... existing code ...
};

/* =========================================================
   UPLOAD HELPER WITH COMPRESSION (UPDATED with native support)
========================================================= */

const uploadToCloudflareR2 = async (
  file: File,
  folder = 'events'
): Promise<{ url: string; type: string; filename: string }> => {
  try {
    let uploadFile = file;

    if (file.type.startsWith('image/')) {
      uploadFile = await compressEventCoverImage(file);
    }

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('filename', uploadFile.name);
    formData.append('type', uploadFile.type);
    formData.append('folder', folder);
    formData.append('timestamp', Date.now().toString());

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }

    const result = await response.json();
    if (!result.url) throw new Error('No URL returned from upload');

    return {
      url: result.url,
      type: uploadFile.type,
      filename: uploadFile.name,
    };
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};

/* =========================================================
   UPDATE CreateEventModal with native image picker
========================================================= */

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  currentUser,
  onClose,
  onCreate,
  groupId,
  groupName,
}) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<'worldwide' | 'targeted'>('worldwide');
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverTouched, setCoverTouched] = useState(false);
  
  // ✅ Native upload state
  const [isNativePickerActive, setIsNativePickerActive] = useState(false);
  const [nativeImageUrl, setNativeImageUrl] = useState<string>('');
  const [nativeImageMeta, setNativeImageMeta] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const userFallbackLocation = getUserLocationFallback(currentUser);

  // ✅ Listen for native image upload
  useEffect(() => {
    const handleNativeUpload = (event: any) => {
      const media = event.detail;
      if (!media || media.type !== 'image') return;
      
      const imageUrl = media.full || media.feed || media.url;
      if (!imageUrl) return;
      
      setIsNativePickerActive(false);
      setNativeImageUrl(imageUrl);
      setNativeImageMeta({
        thumb: media.thumb || imageUrl,
        feed: media.feed || imageUrl,
        full: media.full || imageUrl,
        type: 'image',
      });
      
      // Set preview image
      if (image && image.startsWith('blob:')) {
        URL.revokeObjectURL(image);
      }
      setImage(imageUrl);
      setCoverTouched(true);
    };

    window.addEventListener('uneraNativeUpload', handleNativeUpload);
    return () => {
      window.removeEventListener('uneraNativeUpload', handleNativeUpload);
    };
  }, [image]);

  // ✅ Updated handlePickImage with native support
  const handlePickImage = () => {
    if (isUneraNativeApp()) {
      setIsNativePickerActive(true);
      const opened = openNativeImagePicker();
      if (opened) return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.type.startsWith('image/')) {
      setError('Only image files are allowed');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (f.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError(null);
    setCoverTouched(true);
    setImageFile(f);
    setNativeImageUrl('');
    setNativeImageMeta(null);

    if (image && image.startsWith('blob:')) {
      URL.revokeObjectURL(image);
    }

    const previewUrl = URL.createObjectURL(f);
    setImage(previewUrl);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearImage = () => {
    if (image && image.startsWith('blob:')) {
      URL.revokeObjectURL(image);
    }
    setImage(null);
    setImageFile(null);
    setNativeImageUrl('');
    setNativeImageMeta(null);
    setCoverTouched(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resolveEventLocation = () => {
    const typed = String(location || '').trim();
    if (typed) return typed;
    if (userFallbackLocation) return userFallbackLocation;
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Event name is required');
      return;
    }

    if (!date) {
      setError('Date is required');
      return;
    }

    if (!time) {
      setError('Time is required');
      return;
    }

    const finalLocation = resolveEventLocation();
    if (!finalLocation) {
      setError('Location is required');
      return;
    }

    try {
      setIsUploading(true);

      let coverUrl = 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1500&q=80';

      // ✅ Handle native uploaded image
      if (nativeImageUrl && nativeImageMeta) {
        console.log('📱 Using native uploaded image:', nativeImageUrl);
        coverUrl = nativeImageUrl;
      } 
      // Handle web uploaded image
      else if (imageFile) {
        try {
          const uploadResult = await uploadToCloudflareR2(imageFile, 'events');
          coverUrl = uploadResult.url;
        } catch (uploadError: any) {
          console.error('Image upload failed:', uploadError);
          setError('Cover upload failed. Event will be created with default cover.');
          setTimeout(() => setError(null), 3000);
        }
      }

      const eventData = {
        title: title.trim(),
        description: desc.trim(),
        event_date: date,
        event_time: time,
        location: finalLocation,
        visibility,
        cover_url: coverUrl,
        ...(groupId ? { group_id: groupId } : {}),
      };

      console.log('Creating event with data:', eventData);
      if (groupId) {
        console.log(`Creating event for group: ${groupName} (ID: ${groupId})`);
      }

      await onCreate(eventData as any);

      if (image && image.startsWith('blob:')) {
        URL.revokeObjectURL(image);
      }

      onClose();
    } catch (error: any) {
      console.error('Failed to create event:', error);
      setError(error?.message || 'Failed to create event. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (image && image.startsWith('blob:')) {
        URL.revokeObjectURL(image);
      }
    };
  }, [image]);

  const pageTitle = groupId ? `Create Event in ${groupName || 'Group'}` : 'Create event';

  return (
    <div className="fixed inset-0 z-[150] bg-[#18191A] flex flex-col font-sans">
      {/* Header */}
      <div className="h-14 px-3 flex items-center justify-between border-b border-[#3E4042] bg-[#242526] sticky top-0 z-20">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full hover:bg-[#3A3B3C] flex items-center justify-center transition-colors"
        >
          <i className="fas fa-arrow-left text-[#E4E6EB] text-xl"></i>
        </button>

        <div className="text-[#E4E6EB] font-bold text-[20px] truncate px-3">
          {pageTitle}
        </div>

        <button
          type="submit"
          form="create-event-form"
          disabled={isUploading}
          className={`text-[17px] font-semibold ${
            isUploading ? 'text-[#5A5B5E]' : 'text-[#1877F2]'
          }`}
        >
          {isUploading ? 'Creating...' : 'Create'}
        </button>
      </div>

      {/* Native picker loading indicator */}
      {isNativePickerActive && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center">
          <div className="bg-[#242526] rounded-2xl p-6 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-white">Opening gallery...</p>
          </div>
        </div>
      )}

      <form
        id="create-event-form"
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto bg-[#18191A]"
      >
        <div className="px-4 py-4 space-y-6">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-200 text-sm">
              <div className="flex items-center gap-2">
                <i className="fas fa-exclamation-triangle"></i>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Cover photo - Updated click handler */}
          <section>
            <div className="text-[#E4E6EB] font-semibold text-[17px] mb-3">Cover photo</div>

            <div
              onClick={handlePickImage}  // ✅ Updated to use native picker
              className="w-full h-52 rounded-2xl overflow-hidden border border-[#3E4042] bg-[#3A3B3C] cursor-pointer group relative"
            >
              {image ? (
                <>
                  <img
                    src={image}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    alt="Event Cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 bg-black/60 text-white text-sm font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm">
                    Change cover
                  </div>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      clearImage();
                    }}
                    className="absolute top-3 right-3 bg-black/60 hover:bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-14 h-14 rounded-full bg-[#242526] flex items-center justify-center mb-3 group-hover:bg-[#4E4F50] transition-colors">
                    <i className="fas fa-images text-[#E4E6EB] text-xl"></i>
                  </div>
                  <div className="text-[#E4E6EB] font-semibold text-base">Add cover photo</div>
                  <div className="text-[#B0B3B8] text-sm mt-1">
                    Optional, max 5MB
                  </div>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>

            <div className="mt-2 text-sm text-[#B0B3B8]">
              {imageFile || nativeImageUrl ? '1 cover selected' : 'No cover selected'}
            </div>
          </section>

          {/* ... rest of your existing form sections (Event Type, Title, Date/Time, Location, Visibility, Description, Organizer, Create Button) ... */}
          {/* Keep all other sections exactly as they are */}
        </div>
      </form>
    </div>
  );
};
