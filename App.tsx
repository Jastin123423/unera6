import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Comment } from '../types';
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

// Large Watermarked Image Component specifically for Product Detail View
const LargeWatermarkedImage: React.FC<{
  src: string;
  alt?: string;
  containerClass?: string;
  productId?: string;
}> = ({ src, alt = '', containerClass = '', productId = '' }) => {
  const logoUrl = 'https://media.barakasonko.store/download__82_-removebg-preview.png';
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div
      className={`relative overflow-hidden ${containerClass}`}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        pointerEvents: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Main Product Image */}
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-contain transition-opacity duration-300 bg-gray-50"
        draggable="false"
        loading="eager"
        style={{
          pointerEvents: 'auto',
          opacity: isLoaded ? 1 : 0.8,
        }}
        onLoad={() => setIsLoaded(true)}
        onError={(e) => {
          console.error('Failed to load image:', src);
          (e.target as HTMLImageElement).style.opacity = '1';
        }}
      />

      {/* Loading skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
      )}

      {/* SINGLE LARGE HIGH-CONTRAST WATERMARK */}
      {isLoaded && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Large Center Watermark with HIGH CONTRAST */}
          <div className="relative w-40 h-40 opacity-80">
            <img
              src={logoUrl}
              alt="Watermark"
              className="w-full h-full object-contain"
              draggable="false"
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

          {/* Copyright Text with higher contrast */}
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

// Share Panel Component - REDESIGNED to be more compact and professional
const SharePanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  productTitle: string;
  productLink: string;
  shareImageUrl: string;
}> = ({ isOpen, onClose, productTitle, productLink, shareImageUrl }) => {
  const [copied, setCopied] = useState(false);
  const [isMobile] = useState(() => {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  });

  // Generate share text
  const shareText = `Check out "${productTitle}" on BARAKA SONKO ELECTRONICS APP! 🛒\n${productLink}\n\n#barakasonko #electronics #tanzania`;

  const handleShare = (platform: 'whatsapp' | 'facebook' | 'instagram' | 'tiktok') => {
    switch (platform) {
      case 'whatsapp':
        window.open(
          `https://wa.me/?text=${encodeURIComponent(shareText)}`,
          '_blank',
          'width=600,height=600'
        );
        break;
      case 'facebook':
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productLink)}&quote=${encodeURIComponent(`Check out "${productTitle}" on BARAKA SONKO!`)}`,
          '_blank',
          'width=600,height=400'
        );
        break;
      case 'instagram':
        if (isMobile) {
          navigator.clipboard.writeText(productLink);
          setCopied(true);
        } else {
          navigator.clipboard.writeText(productLink);
          setCopied(true);
        }
        break;
      case 'tiktok':
        if (isMobile) {
          navigator.clipboard.writeText(productLink);
          setCopied(true);
        } else {
          navigator.clipboard.writeText(productLink);
          setCopied(true);
        }
        break;
    }
    
    setTimeout(() => {
      if (platform === 'whatsapp' || platform === 'facebook') {
        onClose();
      }
    }, 500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(productLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-sm rounded-t-2xl md:rounded-2xl shadow-xl animate-slideUp max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel Header - COMPACT */}
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
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Share Options - COMPACT */}
        <div className="p-4">
          <div className="grid grid-cols-4 gap-3 mb-4">
            {/* WhatsApp */}
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

            {/* Facebook */}
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

            {/* Instagram */}
            <button
              onClick={() => handleShare('instagram')}
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 hover:from-purple-500/20 hover:via-pink-500/20 hover:to-orange-500/20 transition-all duration-200 active:scale-95"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-800">Instagram</span>
              <span className="text-[10px] text-gray-500 mt-0.5">Post</span>
            </button>

            {/* TikTok */}
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

          {/* Link Copy Section - SIMPLIFIED */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-700 mb-2">Copy link hapa:</p>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-100 rounded-lg p-2 border border-gray-300">
                <p className="text-xs text-gray-700 truncate font-mono">{productLink}</p>
              </div>
              <button
                onClick={handleCopyLink}
                className={`px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200 ${
                  copied 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-800 text-white hover:bg-gray-900'
                }`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Bonyeza link hapo juu, kisha nakili
            </p>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Kushare kutasaidia wengine kupata bidhaa nzuri kutoka BARAKA SONKO!
          </p>
        </div>

        {/* Close Button */}
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
  // Views
  viewCount = 0,
  onRecordView,
}) => {
  const [activeImage, setActiveImage] = useState(0);
  const [showSharePanel, setShowSharePanel] = useState(false);
  
  // ✅ FIX: Add ref to track if view has been recorded for current product
  const hasRecordedViewRef = useRef<string | null>(null);

  const gallery = product.images && product.images.length > 0 ? product.images : [product.image];
  const descImages =
    product.descriptionImages && product.descriptionImages.length > 0 ? product.descriptionImages : [];

  const PHONE_NUMBER = '+255656738253';

  // Best image to share (first available)
  const shareImageUrl = useMemo(() => {
    const first =
      (Array.isArray(product.images) && product.images.find((x: any) => !!x)) ||
      (product as any)?.image ||
      '';
    return String(first || '').trim();
  }, [product]);

  // Build a shareable product link
  const productLink = useMemo(() => {
    try {
      const origin = window.location.origin;
      return `${origin}/product/${encodeURIComponent(String(product.id))}`;
    } catch {
      return 'https://barakasonko.store';
    }
  }, [product.id]);

  const WHATSAPP_TEXT = useMemo(() => {
    const title = String(product.title || 'Bidhaa').trim();
    const price = Number(product.price || 0);
    const priceStr = Number.isFinite(price) ? price.toLocaleString() : '0';

    const lines = [
      `Hi habari, ningependa kuagiza au kujua zaidi hii: ${title}`,
      `Bei: TSh ${priceStr}`,
      shareImageUrl ? `Picha: ${shareImageUrl}` : '',
      `Link: ${productLink}`,
    ].filter(Boolean);

    return lines.join('\n');
  }, [product.title, product.price, shareImageUrl, productLink]);

  const WHATSAPP_URL = useMemo(() => {
    const digits = PHONE_NUMBER.replace('+', '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(WHATSAPP_TEXT)}`;
  }, [PHONE_NUMBER, WHATSAPP_TEXT]);

  // ✅ FIX: Record view only once per product page open
  useEffect(() => {
    const pid = String(product.id);

    // Record only once per product open
    if (hasRecordedViewRef.current === pid) return;
    hasRecordedViewRef.current = pid;

    onRecordView?.();
  }, [product.id]); // ✅ IMPORTANT: do NOT depend on onRecordView

  useEffect(() => {
    // Reset scroll when product changes
    const contentArea = document.getElementById('product-detail-scroll-area');
    if (contentArea) contentArea.scrollTo(0, 0);
  }, [product.id]);

  const handleWhatsApp = () => {
    onWhatsAppClick?.();
    window.open(WHATSAPP_URL, '_blank');
  };

  const handleCall = () => {
    onCallClick?.();
    window.location.href = `tel:${PHONE_NUMBER}`;
  };

  const handleShare = () => {
    setShowSharePanel(true);
  };

  // Calculate original price if not provided
  const originalPriceValue =
    (product as any).originalPrice ||
    ((product as any).discount ? Math.round(Number(product.price || 0) * (1 + Number((product as any).discount) / 100)) : null);

  // Related products logic: products in same category, excluding current
  const relatedProducts = useMemo(() => {
    return allProducts
      .filter((p) => String(p.id) !== String(product.id) && (p as any).category === (product as any).category)
      .slice(0, 6);
  }, [allProducts, product.id, (product as any).category]);

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col animate-fadeIn overflow-hidden">
      {/* Top Header - Fixed at Top */}
      <div className="flex-shrink-0 bg-white/95 backdrop-blur-md flex items-center justify-between px-4 py-3 border-b border-gray-100 shadow-sm">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-800 active:scale-90 transition-transform">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="text-sm font-black text-gray-800 truncate px-4">BARAKA SONKO</div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleShare}
            className="p-2 text-gray-800 hover:text-blue-600 transition-colors"
            aria-label="Share"
          >
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

      {/* Scrollable Content Area */}
      <div id="product-detail-scroll-area" className="flex-grow overflow-y-auto no-scrollbar bg-white">
        {/* Hero Image Slider with HIGH-CONTRAST Watermark */}
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
                  productId={String(product.id)}
                />
              </div>
            ))}
          </div>
          <div className="absolute bottom-4 right-4 bg-black/50 text-white text-[10px] px-2.5 py-1 rounded-full font-bold backdrop-blur-sm">
            {activeImage + 1} / {gallery.length}
          </div>
        </div>

        {/* Main Info */}
        <div className="p-4">
          {/* Price Tag & Views - MODIFIED: Actual price appears first and is bold */}
          <div className="flex flex-col mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* Actual Price - NOW FIRST AND BOLD */}
                {originalPriceValue && (
                  <span className="text-2xl font-black text-gray-600 mr-2">
                    TSh {Number(originalPriceValue).toLocaleString()}
                  </span>
                )}
                
                {/* Selling Price - NOW SECOND */}
                <span className="text-3xl font-bold" style={{ color: COLORS.primary }}>
                  TSh {Number(product.price || 0).toLocaleString()}
                </span>
                
                {(product as any).discount ? (
                  <span className="bg-red-50 text-red-600 text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-tighter">
                    -{(product as any).discount}% OFF
                  </span>
                ) : null}
              </div>

              {/* Blinking Eye View Counter */}
              <div className="flex items-center space-x-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                <div className="animate-blink text-sm">👁️</div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight">{viewCount} views</span>
              </div>
            </div>

            {/* Label for clarity - OPTIONAL: You can remove this if not needed */}
            {originalPriceValue && (
              <span className="text-xs text-gray-500 mt-1">
                Actual Price (was) • Selling Price (now)
              </span>
            )}
          </div>

          <h1 className="text-lg font-bold text-gray-800 leading-tight mb-2">{product.title}</h1>

          {/* Social Interaction Row - IMPROVED with larger buttons */}
          <div className="flex items-center justify-between py-4 mb-6 border-y border-gray-100">
            {/* BARAKA SONKO Share Button - also larger */}
            <button
              onClick={handleShare}
              className="flex items-center space-x-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 active:scale-95 shadow-lg"
              style={{ 
                backgroundColor: COLORS.primary,
                boxShadow: `0 6px 16px ${COLORS.primary}40`
              }}
              aria-label="Share on social media"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
              </svg>
              <span>Share</span>
            </button>
          </div>

          {/* Video Player */}
          {(product as any).videoUrl ? (
            <div className="mb-8 py-6 border-y border-gray-50">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Product Experience</h3>
              <div className="rounded-2xl overflow-hidden bg-black aspect-video shadow-2xl relative">
                <video
                  src={String((product as any).videoUrl)}
                  className="w-full h-full"
                  controls
                  playsInline
                  preload="metadata"
                  controlsList="nodownload"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          ) : null}

          {/* Description Text */}
          <div className="py-2">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">About This Product</h3>
            <div className="text-sm text-gray-600 leading-relaxed font-medium">
              <p>
                Welcome to BARAKA SONKO. Our {product.title} is selected for its superior quality and durability. Perfect
                for professional or home use.
              </p>
            </div>
          </div>

          {/* Gallery Details Images */}
          {descImages.length > 0 ? (
            <div className="mt-8 space-y-3">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Gallery Details</h3>
              {descImages.map((img, idx) => (
                <div
                  key={idx}
                  className="w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50"
                >
                  <LargeWatermarkedImage
                    src={img}
                    alt={`Product detail ${idx + 1}`}
                    containerClass="w-full h-auto"
                    productId={`${product.id}-desc-${idx}`}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {/* Related Products Grid */}
          {relatedProducts.length > 0 ? (
            <div className="mt-12 mb-10">
              <div className="mb-4 flex items-center justify-between px-1">
                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Products You May Like</h3>
                <button className="text-xs font-black text-orange-600">View All</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {relatedProducts.map((relatedProduct) => (
                  <div
                    key={relatedProduct.id}
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
                      <span className="text-sm font-black text-orange-600">
                        TSh {Number((relatedProduct as any).price || 0).toLocaleString()}
                      </span>
                      {Number((relatedProduct as any).discount || 0) > 0 ? (
                        <span className="text-[10px] font-bold bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">
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

      {/* FIXED BOTTOM ACTION BAR */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 p-3 pb-6 flex items-center justify-between space-x-3 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        {/* Call Button */}
        <button
          onClick={handleCall}
          className="flex-1 flex flex-col items-center justify-center py-2 rounded-xl border-2 active:scale-95 transition-all"
          style={{ borderColor: COLORS.primary, color: COLORS.primary }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.28-2.28a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest mt-0.5">Call</span>
        </button>

        {/* ✅ FIXED: Changed "Place Order" to "WEKA ODA" in Swahili */}
        <button
          onClick={handleWhatsApp}
          className="flex-[2] flex items-center justify-center space-x-2 text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg"
          style={{ backgroundColor: COLORS.primary, boxShadow: `0 8px 20px -4px ${COLORS.primary}60` }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.438 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
          </svg>
          <span>WEKA ODA</span>
        </button>
      </div>

      {/* Share Panel */}
      <SharePanel
        isOpen={showSharePanel}
        onClose={() => setShowSharePanel(false)}
        productTitle={product.title}
        productLink={productLink}
        shareImageUrl={shareImageUrl}
      />
    </div>
  );
};

export default ProductDetailView;
