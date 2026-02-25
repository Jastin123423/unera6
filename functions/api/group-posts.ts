import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product } from '../types';
import { COLORS } from '../constants';

interface ProductDetailViewProps {
  product: Product;
  allProducts: Product[];
  onBack: () => void;
  onProductClick: (product: Product) => void;
  WatermarkedImage: React.ComponentType<any>;
  VideoPlayer?: React.ComponentType<any>;
  Banner?: React.ComponentType<any>;
  onWhatsAppClick?: () => void;
  onCallClick?: () => void;
  // Views
  viewCount?: number;
  onRecordView?: () => void;
}

/** -----------------------------
 * ✅ UTIL: Safe string url
 * ------------------------------*/
const toUrl = (v: any) => String(v || '').trim();

/** -----------------------------
 * ✅ UTIL: Warm image cache
 * ------------------------------*/
const preloadImages = (urls: string[]) => {
  const unique = Array.from(new Set(urls.map(toUrl).filter(Boolean)));
  unique.forEach((src) => {
    const img = new Image();
    // Helps browsers prioritize decode
    (img as any).decoding = 'async';
    img.src = src;
  });
};

/** -----------------------------
 * ✅ UTIL: Warm video preload (best-effort)
 * ------------------------------*/
const usePreloadVideo = (videoUrl: string) => {
  useEffect(() => {
    const src = toUrl(videoUrl);
    if (!src) return;

    // Best-effort: ask browser to preload the video resource
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = src;
    // Some CDNs require crossOrigin; safe to omit unless you need it
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, [videoUrl]);
};

/** -----------------------------
 * ✅ Large Watermarked Image (instant cache check + priority)
 * ------------------------------*/
const LargeWatermarkedImage: React.FC<{
  src: string;
  alt?: string;
  containerClass?: string;
  productId?: string;
  // performance hints:
  priority?: boolean; // if true: eager + high priority
}> = ({ src, alt = '', containerClass = '', productId = '', priority = false }) => {
  const logoUrl = 'https://media.barakasonko.store/download__82_-removebg-preview.png';
  const [isLoaded, setIsLoaded] = useState(false);

  // ✅ If image is already cached, show instantly (no skeleton flash)
  useEffect(() => {
    const s = toUrl(src);
    if (!s) return;

    let cancelled = false;
    const test = new Image();
    test.src = s;

    if (test.complete) {
      setIsLoaded(true);
      return;
    }

    test.onload = () => {
      if (!cancelled) setIsLoaded(true);
    };
    test.onerror = () => {
      if (!cancelled) setIsLoaded(true); // avoid stuck skeleton
    };

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div
      className={`relative overflow-hidden ${containerClass}`}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        pointerEvents: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
      data-product-id={productId}
    >
      {/* Main Product Image */}
      <img
        src={toUrl(src)}
        alt={alt}
        className="w-full h-full object-contain transition-opacity duration-200 bg-gray-50"
        draggable="false"
        loading={priority ? 'eager' : 'lazy'}
        // @ts-ignore (supported in modern browsers)
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        style={{
          pointerEvents: 'auto',
          opacity: isLoaded ? 1 : 0.92,
          transform: 'translateZ(0)', // helps paint smooth on mobile
        }}
        onLoad={() => setIsLoaded(true)}
        onError={(e) => {
          console.error('Failed to load image:', src);
          (e.target as HTMLImageElement).style.opacity = '1';
          setIsLoaded(true);
        }}
      />

      {/* Loading skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
      )}

      {/* SINGLE LARGE HIGH-CONTRAST WATERMARK */}
      {isLoaded && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-40 h-40 opacity-80">
            <img
              src={logoUrl}
              alt="Watermark"
              className="w-full h-full object-contain"
              draggable="false"
              loading="eager"
              // @ts-ignore
              fetchPriority="low"
              decoding="async"
              style={{
                filter: `
                  drop-shadow(0 0 15px rgba(0,0,0,0.8)) 
                  drop-shadow(0 0 25px rgba(0,0,0,0.6))
                  brightness(1.2) 
                  contrast(1.5)
                `,
                WebkitFilter: `
                  drop-shadow(0 0 15px rgba(0,0,0,0.8)) 
                  drop-shadow(0 0 25px rgba(0,0,0,0.6))
                  brightness(1.2) 
                  contrast(1.5)
                `,
              }}
            />
          </div>

          <div
            className="absolute bottom-6 left-6 px-4 py-2 rounded-lg"
            style={{
              background: 'rgba(0,0,0,0.85)',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
              opacity: 0.95,
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              border: '2px solid rgba(255,255,255,0.3)',
            }}
          >
            ©barakasonko
          </div>
        </div>
      )}
    </div>
  );
};

/** -----------------------------
 * ✅ Video (instant poster + preloading)
 * ------------------------------*/
const ProductVideo: React.FC<{
  src: string;
  poster?: string;
}> = ({ src, poster }) => {
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Try to kickstart loading fast
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // If it’s already buffered enough, mark ready
    const onCanPlay = () => setReady(true);
    const onLoadedData = () => setReady(true);

    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('loadeddata', onLoadedData);

    // Best effort: start fetching immediately
    try {
      v.load();
    } catch {}

    return () => {
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('loadeddata', onLoadedData);
    };
  }, [src]);

  const url = toUrl(src);
  if (!url) return null;

  return (
    <div className="rounded-2xl overflow-hidden bg-black aspect-video shadow-2xl relative">
      {/* Poster is visible instantly even if network is slow */}
      {!ready && poster ? (
        <img
          src={toUrl(poster)}
          alt="Video poster"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          // @ts-ignore
          fetchPriority="high"
          decoding="async"
        />
      ) : null}

      {/* Soft loader overlay (only if slow) */}
      {!ready && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center">
          <div className="px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-bold">
            Loading video…
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        src={url}
        className="w-full h-full relative z-[1]"
        controls
        playsInline
        preload="auto"
        controlsList="nodownload"
        poster={toUrl(poster)}
        onCanPlay={() => setReady(true)}
        onLoadedData={() => setReady(true)}
        onError={() => setReady(true)} // avoid stuck overlay
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

// Share Panel (unchanged from your file)
const SharePanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  productTitle: string;
  productLink: string;
  shareImageUrl: string;
}> = ({ isOpen, onClose, productTitle, productLink, shareImageUrl }) => {
  const [copied, setCopied] = useState(false);
  const [isMobile] = useState(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));

  const shareText = `Check out "${productTitle}" on BARAKA SONKO ELECTRONICS APP! 🛒\n${productLink}\n\n#barakasonko #electronics #tanzania`;

  const handleShare = (platform: 'whatsapp' | 'facebook' | 'instagram' | 'tiktok') => {
    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'width=600,height=600');
        break;
      case 'facebook':
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productLink)}&quote=${encodeURIComponent(
            `Check out "${productTitle}" on BARAKA SONKO!`
          )}`,
          '_blank',
          'width=600,height=400'
        );
        break;
      case 'instagram':
      case 'tiktok':
        navigator.clipboard.writeText(productLink);
        setCopied(true);
        break;
    }

    setTimeout(() => {
      if (platform === 'whatsapp' || platform === 'facebook') onClose();
    }, 500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(productLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full max-w-sm rounded-t-2xl md:rounded-2xl shadow-xl animate-slideUp max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.primary }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">Share Bidhaa</h3>
              <p className="text-xs text-gray-500">Share bidhaa hii na marafiki zako</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-4 gap-3 mb-4">
            <button
              onClick={() => handleShare('whatsapp')}
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-all duration-200 active:scale-95"
            >
              <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.272-.099-.47-.149-.669.149-.198.297-.767.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-800">WhatsApp</span>
              <span className="text-[10px] text-gray-500 mt-0.5">Share</span>
            </button>

            <button
              onClick={() => handleShare('facebook')}
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#1877F2]/10 hover:bg-[#1877F2]/20 transition-all duration-200 active:scale-95"
            >
              <div className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-800">Facebook</span>
              <span className="text-[10px] text-gray-500 mt-0.5">Share</span>
            </button>

            <button
              onClick={() => handleShare('instagram')}
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 hover:from-purple-500/20 hover:via-pink-500/20 hover:to-orange-500/20 transition-all duration-200 active:scale-95"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-800">Instagram</span>
              <span className="text-[10px] text-gray-500 mt-0.5">Post</span>
            </button>

            <button
              onClick={() => handleShare('tiktok')}
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-gray-900/10 hover:bg-gray-900/20 transition-all duration-200 active:scale-95"
            >
              <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-800">TikTok</span>
              <span className="text-[10px] text-gray-500 mt-0.5">Share</span>
            </button>
          </div>

          <div className="mb-4">
            <p className="text-xs font-medium text-gray-700 mb-2">Copy link hapa:</p>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-100 rounded-lg p-2 border border-gray-300">
                <p className="text-xs text-gray-700 truncate font-mono">{productLink}</p>
              </div>
              <button
                onClick={handleCopyLink}
                className={`px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200 ${
                  copied ? 'bg-green-600 text-white' : 'bg-gray-800 text-white hover:bg-gray-900'
                }`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Bonyeza link hapo juu, kisha nakili</p>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Kushare kutasaidia wengine kupata bidhaa nzuri kutoka BARAKA SONKO!
          </p>
        </div>

        <div className="p-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-all duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  allProducts,
  onBack,
  onProductClick,
  WatermarkedImage,
  onWhatsAppClick,
  onCallClick,
  viewCount = 0,
  onRecordView,
}) => {
  const [activeImage, setActiveImage] = useState(0);
  const [showSharePanel, setShowSharePanel] = useState(false);

  const hasRecordedViewRef = useRef<string | null>(null);

  const gallery = useMemo(() => {
    const imgs = Array.isArray((product as any).images) ? (product as any).images : [];
    const main = toUrl((product as any).image);
    const merged = [...imgs.map(toUrl).filter(Boolean)];
    if (main && !merged.includes(main)) merged.unshift(main);
    return merged.length ? merged : (main ? [main] : []);
  }, [product]);

  const descImages = useMemo(() => {
    const di = Array.isArray((product as any).descriptionImages) ? (product as any).descriptionImages : [];
    return di.map(toUrl).filter(Boolean);
  }, [product]);

  const PHONE_NUMBER = '+255656738253';

  const shareImageUrl = useMemo(() => {
    const first = gallery.find((x) => !!toUrl(x)) || toUrl((product as any)?.image);
    return toUrl(first);
  }, [gallery, product]);

  const productLink = useMemo(() => {
    try {
      const origin = window.location.origin;
      return `${origin}/product/${encodeURIComponent(String((product as any).id))}`;
    } catch {
      return 'https://barakasonko.store';
    }
  }, [(product as any).id]);

  const WHATSAPP_TEXT = useMemo(() => {
    const title = toUrl((product as any).title) || 'Bidhaa';
    const price = Number((product as any).price || 0);
    const priceStr = Number.isFinite(price) ? price.toLocaleString() : '0';

    const lines = [
      `Hi habari, ningependa kuagiza au kujua zaidi hii: ${title}`,
      `Bei: TSh ${priceStr}`,
      shareImageUrl ? `Picha: ${shareImageUrl}` : '',
      `Link: ${productLink}`,
    ].filter(Boolean);

    return lines.join('\n');
  }, [product, shareImageUrl, productLink]);

  const WHATSAPP_URL = useMemo(() => {
    const digits = PHONE_NUMBER.replace('+', '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(WHATSAPP_TEXT)}`;
  }, [WHATSAPP_TEXT]);

  // ✅ Record view only once per product
  useEffect(() => {
    const pid = String((product as any).id);
    if (hasRecordedViewRef.current === pid) return;
    hasRecordedViewRef.current = pid;
    onRecordView?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(product as any).id]);

  // ✅ Reset scroll when product changes
  useEffect(() => {
    const contentArea = document.getElementById('product-detail-scroll-area');
    if (contentArea) contentArea.scrollTo(0, 0);
  }, [(product as any).id]);

  // ✅ PRELOAD ALL images as soon as product opens (fast perceived load)
  useEffect(() => {
    // Prioritize first images: gallery + first 2 desc + first 6 related thumbs
    const priority = gallery.slice(0, 3);
    const later = gallery.slice(3);
    const descTop = descImages.slice(0, 2);

    preloadImages([...priority, ...descTop]);

    // Preload the rest shortly after (avoid blocking initial render)
    const t = window.setTimeout(() => {
      preloadImages([...later, ...descImages.slice(2)]);
    }, 150);

    return () => window.clearTimeout(t);
  }, [gallery, descImages]);

  // ✅ Preload video best-effort
  usePreloadVideo(toUrl((product as any).videoUrl));

  const handleWhatsApp = () => {
    onWhatsAppClick?.();
    window.open(WHATSAPP_URL, '_blank');
  };

  const handleCall = () => {
    onCallClick?.();
    window.location.href = `tel:${PHONE_NUMBER}`;
  };

  const handleShare = () => setShowSharePanel(true);

  const originalPriceValue =
    (product as any).originalPrice ||
    ((product as any).discount
      ? Math.round(Number((product as any).price || 0) * (1 + Number((product as any).discount) / 100))
      : null);

  const relatedProducts = useMemo(() => {
    return (allProducts || [])
      .filter(
        (p) => String((p as any).id) !== String((product as any).id) && (p as any).category === (product as any).category
      )
      .slice(0, 6);
  }, [allProducts, (product as any).id, (product as any).category]);

  // Warm related thumbs too
  useEffect(() => {
    const thumbs = relatedProducts.map((p) => toUrl((p as any).image)).filter(Boolean);
    if (thumbs.length) {
      const t = window.setTimeout(() => preloadImages(thumbs), 250);
      return () => window.clearTimeout(t);
    }
  }, [relatedProducts]);

  const safeSellingPrice = Number((product as any).price || 0);
  const sellingPriceStr = Number.isFinite(safeSellingPrice) ? safeSellingPrice.toLocaleString() : '0';
  const safeOriginal = Number(originalPriceValue || 0);
  const originalPriceStr = Number.isFinite(safeOriginal) ? safeOriginal.toLocaleString() : '0';

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col animate-fadeIn overflow-hidden">
      {/* Top Header */}
      <div className="flex-shrink-0 bg-white/95 backdrop-blur-md flex items-center justify-between px-4 py-3 border-b border-gray-100 shadow-sm">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-800 active:scale-90 transition-transform">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="text-sm font-black text-gray-800 truncate px-4">BARAKA SONKO</div>
        <div className="flex items-center space-x-2">
          <button onClick={handleShare} className="p-2 text-gray-800 hover:text-blue-600 transition-colors" aria-label="Share">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
          <button className="p-2 text-gray-800" aria-label="Cart (placeholder)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div id="product-detail-scroll-area" className="flex-grow overflow-y-auto no-scrollbar bg-white">
        {/* Hero Image Slider */}
        <div className="relative w-full aspect-square bg-[#f9f9f9] border-b border-gray-50">
          <div
            className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar h-full"
            onScroll={(e) => {
              const width = e.currentTarget.offsetWidth;
              const index = Math.round(e.currentTarget.scrollLeft / width);
              setActiveImage(index);
            }}
          >
            {gallery.map((img, idx) => (
              <div key={idx} className="min-w-full h-full snap-center">
                <LargeWatermarkedImage
                  src={img}
                  alt={`Product image ${idx + 1}`}
                  containerClass="w-full h-full"
                  productId={String((product as any).id)}
                  priority={idx === 0 || idx === activeImage}
                />
              </div>
            ))}
          </div>

          <div className="absolute bottom-4 right-4 bg-black/50 text-white text-[10px] px-2.5 py-1 rounded-full font-bold backdrop-blur-sm">
            {activeImage + 1} / {Math.max(gallery.length, 1)}
          </div>
        </div>

        <div className="p-4">
          {/* Price + Views */}
          <div className="mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-2 min-w-0 flex-nowrap">
                {originalPriceValue ? (
                  <span className="text-[12px] text-gray-400 line-through whitespace-nowrap">TSh {originalPriceStr}</span>
                ) : null}

                <span className="text-xl md:text-2xl font-black whitespace-nowrap" style={{ color: COLORS.primary }}>
                  TSh {sellingPriceStr}
                </span>

                {(product as any).discount ? (
                  <span className="bg-red-50 text-red-600 text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-tighter whitespace-nowrap">
                    -{Number((product as any).discount)}% OFF
                  </span>
                ) : null}
              </div>

              <div className="flex items-center space-x-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 flex-shrink-0">
                <div className="animate-blink text-sm">👁️</div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight whitespace-nowrap">
                  {viewCount} views
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-lg font-bold text-gray-800 leading-tight mb-2">{(product as any).title}</h1>

          {/* Share Row */}
          <div className="flex items-center justify-between py-4 mb-6 border-y border-gray-100">
            <button
              onClick={handleShare}
              className="flex items-center space-x-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 active:scale-95 shadow-lg"
              style={{ backgroundColor: COLORS.primary, boxShadow: `0 6px 16px ${COLORS.primary}40` }}
              aria-label="Share on social media"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
              </svg>
              <span>Share</span>
            </button>
          </div>

          {/* Video */}
          {toUrl((product as any).videoUrl) ? (
            <div className="mb-8 py-6 border-y border-gray-50">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Product Experience</h3>
              <ProductVideo src={toUrl((product as any).videoUrl)} poster={shareImageUrl} />
            </div>
          ) : null}

          {/* Description */}
          <div className="py-2">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">About This Product</h3>
            <div className="text-sm text-gray-600 leading-relaxed font-medium">
              <p>
                Welcome to BARAKA SONKO. Our {(product as any).title} is selected for its superior quality and durability.
                Perfect for professional or home use.
              </p>
            </div>
          </div>

          {/* Details images */}
          {descImages.length > 0 ? (
            <div className="mt-8 space-y-3">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Gallery Details</h3>
              {descImages.map((img: any, idx: number) => (
                <div key={idx} className="w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50">
                  <LargeWatermarkedImage
                    src={img}
                    alt={`Product detail ${idx + 1}`}
                    containerClass="w-full h-auto"
                    productId={`${(product as any).id}-desc-${idx}`}
                    priority={idx < 2}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {/* Related Products */}
          {relatedProducts.length > 0 ? (
            <div className="mt-12 mb-10">
              <div className="mb-4 flex items-center justify-between px-1">
                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Products You May Like</h3>
                <button className="text-xs font-black text-orange-600">View All</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {relatedProducts.map((relatedProduct) => (
                  <div
                    key={(relatedProduct as any).id}
                    className="bg-white rounded-xl border border-gray-100 p-2.5 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98] cursor-pointer"
                    onClick={() => onProductClick(relatedProduct)}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden mb-2 bg-gray-50 relative">
                      <WatermarkedImage
                        src={(relatedProduct as any).image}
                        alt={(relatedProduct as any).title}
                        containerClass="w-full h-full"
                        productId={(relatedProduct as any).id}
                        isProduct={true}
                      />
                    </div>

                    <h4 className="text-xs font-bold text-gray-800 mb-1 line-clamp-2">{(relatedProduct as any).title}</h4>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-orange-600 whitespace-nowrap">
                        TSh {Number((relatedProduct as any).price || 0).toLocaleString()}
                      </span>
                      {Number((relatedProduct as any).discount || 0) > 0 ? (
                        <span className="text-[10px] font-bold bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          -{Number((relatedProduct as any).discount)}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 p-3 pb-6 flex items-center justify-between space-x-3 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        <button
          onClick={handleCall}
          className="flex-1 flex flex-col items-center justify-center py-2 rounded-xl border-2 active:scale-95 transition-all"
          style={{ borderColor: COLORS.primary, color: COLORS.primary }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.28-2.28a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest mt-0.5">Call</span>
        </button>

        <button
          onClick={handleWhatsApp}
          className="flex-[2] flex items-center justify-center space-x-2 text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg"
          style={{ backgroundColor: COLORS.primary, boxShadow: `0 8px 20px -4px ${COLORS.primary}60` }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654z" />
          </svg>
          <span>WEKA ODA</span>
        </button>
      </div>

      <SharePanel
        isOpen={showSharePanel}
        onClose={() => setShowSharePanel(false)}
        productTitle={(product as any).title}
        productLink={productLink}
        shareImageUrl={shareImageUrl}
      />
    </div>
  );
};

export default ProductDetailView;
