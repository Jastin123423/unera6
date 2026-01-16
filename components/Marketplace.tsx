// Marketplace.tsx
import React, { useState, useEffect, useRef } from 'react';
import { User, Product } from '../types';
import { MARKETPLACE_CATEGORIES, MARKETPLACE_COUNTRIES } from '../constants';

// --- Cloudflare R2 Upload Helper ---
const uploadToCloudflareR2 = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    formData.append('type', file.type);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.url) {
      throw new Error('No URL returned from upload');
    }
    
    return result.url;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};

// --- OSM LOCATION SEARCH COMPONENT (Duplicated for standalone use in Marketplace) ---
const LocationSearch: React.FC<{ value: string, onSelect: (val: string) => void }> = ({ value, onSelect }) => {
    const [query, setQuery] = useState(value);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchTimeout = useRef<any>(null);

    const handleSearch = async (q: string) => {
        if (q.length < 3) { setResults([]); return; }
        setLoading(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=5`);
            const data = await res.json();
            setResults(data);
        } catch (err) {
            console.error("Location search failed", err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        setShowResults(true);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => handleSearch(val), 500);
    };

    return (
        <div className="relative w-full">
            <div className="relative">
                <input 
                    className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-3 text-[#E4E6EB] outline-none focus:border-[#1877F2] text-sm pl-10" 
                    placeholder="Search city, street or region..." 
                    value={query} 
                    onChange={handleChange}
                    onFocus={() => setShowResults(true)}
                />
                <i className="fas fa-map-marker-alt absolute left-4 top-1/2 -translate-y-1/2 text-[#B0B3B8]"></i>
                {loading && <i className="fas fa-spinner fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-[#1877F2]"></i>}
            </div>
            {showResults && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-[60] mt-2 bg-[#242526] border border-[#3E4042] rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                    {results.map((res, i) => (
                        <div 
                            key={i} 
                            className="p-3 hover:bg-[#3A3B3C] cursor-pointer text-white text-sm border-b border-[#3E4042] last:border-0 transition-colors"
                            onClick={() => {
                                onSelect(res.display_name);
                                setQuery(res.display_name);
                                setShowResults(false);
                            }}
                        >
                            <i className="fas fa-location-dot mr-2 text-[#B0B3B8]"></i>
                            {res.display_name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- PRODUCT DETAIL MODAL ---
interface ProductDetailModalProps {
    product: Product;
    currentUser: User | null;
    onClose: () => void;
    onMessage: (sellerId: number) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, currentUser, onClose, onMessage }) => {
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    
    const countryData = MARKETPLACE_COUNTRIES.find(c => product.address.toLowerCase().includes(c.name.toLowerCase()));
    const symbol = countryData ? countryData.symbol : '$';
    const hasDiscount = !!product.discount_price;

    return (
        <div className="fixed inset-0 z-[150] bg-black/90 flex items-center justify-center p-0 md:p-4 animate-fade-in font-sans">
            <div className="bg-[#242526] w-full max-w-[1100px] md:rounded-2xl overflow-hidden flex flex-col md:flex-row h-full md:h-[90vh] relative shadow-2xl border border-[#3E4042]">
                <button onClick={onClose} className="absolute top-4 right-4 z-30 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-md">
                    <i className="fas fa-times text-xl"></i>
                </button>

                {/* Left: Image Gallery */}
                <div className="w-full md:w-[60%] bg-[#18191A] flex flex-col relative border-r border-[#3E4042]">
                    <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                        <img src={product.images[activeImageIndex]} alt={product.title} className="max-w-full max-h-full object-contain transition-all duration-300" />
                        
                        {product.images.length > 1 && (
                            <>
                                <button 
                                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/40 rounded-full text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                                    onClick={() => setActiveImageIndex(prev => prev === 0 ? product.images.length - 1 : prev - 1)}
                                >
                                    <i className="fas fa-chevron-left text-xl"></i>
                                </button>
                                <button 
                                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/40 rounded-full text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                                    onClick={() => setActiveImageIndex(prev => prev === product.images.length - 1 ? 0 : prev + 1)}
                                >
                                    <i className="fas fa-chevron-right text-xl"></i>
                                </button>
                            </>
                        )}
                    </div>
                    {/* Thumbnails */}
                    <div className="h-24 bg-[#242526]/50 backdrop-blur-sm flex items-center gap-3 px-4 overflow-x-auto border-t border-[#3E4042] scrollbar-hide">
                        {product.images.map((img, idx) => (
                            <div 
                                key={idx} 
                                className={`h-16 min-w-[64px] rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${activeImageIndex === idx ? 'border-[#1877F2] scale-105 shadow-lg' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                onClick={() => setActiveImageIndex(idx)}
                            >
                                <img src={img} className="h-full w-full object-cover" alt="thumb" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Details */}
                <div className="w-full md:w-[40%] flex flex-col h-full bg-[#242526] relative">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div>
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <img src={product.seller_avatar} alt="Seller" className="w-12 h-12 rounded-full object-cover border-2 border-[#1877F2] flex-shrink-0" />
                                    <div className="overflow-hidden">
                                        <h4 className="text-[#E4E6EB] font-bold text-lg leading-tight truncate">{product.seller_name}</h4>
                                        <p className="text-[#B0B3B8] text-xs truncate">Seller • Active in Marketplace</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <a 
                                        href={`tel:${product.phone_number}`}
                                        className="w-10 h-10 rounded-full bg-[#3A3B3C] hover:bg-[#45BD62] text-[#45BD62] hover:text-white flex items-center justify-center transition-all shadow-md no-underline"
                                        title="Call Seller"
                                    >
                                        <i className="fas fa-phone-alt text-lg"></i>
                                    </a>
                                    <button 
                                        onClick={() => onMessage(product.seller_id)} 
                                        className="w-10 h-10 rounded-full bg-[#3A3B3C] hover:bg-[#1877F2] text-[#1877F2] hover:text-white flex items-center justify-center transition-all shadow-md"
                                        title="Message Seller"
                                    >
                                        <i className="fab fa-facebook-messenger text-lg"></i>
                                    </button>
                                </div>
                            </div>
                            <h1 className="text-2xl font-bold text-[#E4E6EB] leading-snug mb-2">{product.title}</h1>
                            <div className="flex items-baseline gap-3">
                                <span className="text-[#F02849] font-bold text-3xl">{symbol}{hasDiscount ? product.discount_price?.toFixed(2) : product.main_price.toFixed(2)}</span>
                                {hasDiscount && <span className="text-[#B0B3B8] text-lg line-through">{symbol}{product.main_price.toFixed(2)}</span>}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3 p-4 bg-[#3A3B3C]/50 rounded-2xl border border-[#3E4042]">
                                <i className="fas fa-location-dot text-[#1877F2] mt-1"></i>
                                <div>
                                    <p className="text-[#E4E6EB] font-bold text-sm">Location</p>
                                    <p className="text-[#B0B3B8] text-sm leading-relaxed">{product.address}</p>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[#E4E6EB] font-bold text-lg mb-2">Description</h3>
                                <p className="text-[#B0B3B8] text-[15px] leading-relaxed whitespace-pre-wrap bg-[#18191A] p-4 rounded-xl border border-[#3E4042]">
                                    {product.description}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#18191A] p-4 rounded-xl border border-[#3E4042] text-center">
                                <span className="block text-[#B0B3B8] text-[10px] uppercase font-bold tracking-wider mb-1">Category</span>
                                <span className="block text-[#E4E6EB] font-bold">{MARKETPLACE_CATEGORIES.find(c => c.id === product.category)?.name}</span>
                            </div>
                            <div className="bg-[#18191A] p-4 rounded-xl border border-[#3E4042] text-center">
                                <span className="block text-[#B0B3B8] text-[10px] uppercase font-bold tracking-wider mb-1">Status</span>
                                <span className="block text-[#45BD62] font-bold uppercase text-xs">{product.quantity > 0 ? 'In Stock' : 'Out of Stock'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface MarketplacePageProps {
    currentUser: User | null;
    products: Product[];
    onNavigateHome: () => void;
    onCreateProduct: (productData: Partial<Product>) => void;
    onViewProduct: (product: Product) => void;
}

export const MarketplacePage: React.FC<MarketplacePageProps> = ({ currentUser, products, onNavigateHome, onCreateProduct, onViewProduct }) => {
    const [selectedCountry, setSelectedCountry] = useState<string>('all');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showSellModal, setShowSellModal] = useState(false);
    
    // Form State
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [desc, setDesc] = useState('');
    const [address, setAddress] = useState('');
    const [mainPrice, setMainPrice] = useState('');
    const [discountPrice, setDiscountPrice] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [phone, setPhone] = useState('');
    const [images, setImages] = useState<{id: number, data: string, file: File}[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-detect user country for filtering if logged in
    useEffect(() => {
        if (currentUser && selectedCountry === 'all') {
            const userCountry = MARKETPLACE_COUNTRIES.find(c => currentUser.nationality?.toLowerCase().includes(c.name.toLowerCase()));
            if (userCountry) setSelectedCountry(userCountry.code);
        }
        if (currentUser) {
            setPhone(currentUser.phone || '');
        }
    }, [currentUser]);

    const handleSellClick = () => {
        if (!currentUser) {
            alert("Please log in to sell products.");
            return;
        }
        setShowSellModal(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            if (images.length + e.target.files.length > 10) {
                alert("Maximum 10 images allowed for a professional listing");
                return;
            }
            Array.from(e.target.files).forEach((file: File) => {
                // Create preview URL for display
                const previewUrl = URL.createObjectURL(file);
                setImages(prev => [...prev, { 
                    id: Date.now() + Math.random(), 
                    data: previewUrl,
                    file: file
                }]);
            });
        }
    };

    const removeImage = (id: number) => {
        setImages(prev => {
            const imageToRemove = prev.find(img => img.id === id);
            if (imageToRemove) {
                URL.revokeObjectURL(imageToRemove.data); // Clean up preview URL
            }
            return prev.filter(img => img.id !== id);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !category || !desc || !address || !mainPrice || !phone || images.length === 0) {
            alert("Please fill all required fields and upload at least one image.");
            return;
        }

        try {
            setIsUploading(true);

            // Upload all images to Cloudflare R2
            const uploadPromises = images.map(img => uploadToCloudflareR2(img.file));
            const uploadedUrls = await Promise.all(uploadPromises);

            // Logic to extract country code from address if possible
            const detectedCountry = MARKETPLACE_COUNTRIES.find(c => address.toLowerCase().includes(c.name.toLowerCase()))?.code || 'US';

            const newProduct: Partial<Product> = {
                title,
                category,
                description: desc,
                country: detectedCountry,
                address,
                main_price: parseFloat(mainPrice),
                discount_price: discountPrice ? parseFloat(discountPrice) : null,
                quantity: parseInt(quantity),
                phone_number: phone,
                images: uploadedUrls, // Store Cloudflare R2 URLs instead of base64
                status: 'active',
                views: 0,
                ratings: [], 
                comments: [],
                created_at: new Date().toISOString()
            };

            onCreateProduct(newProduct);
            setShowSellModal(false);
            
            // Reset form
            setTitle(''); 
            setCategory(''); 
            setDesc(''); 
            setMainPrice(''); 
            setDiscountPrice(''); 
            setImages([]); 
            setAddress('');
        } catch (error: any) {
            console.error('Failed to upload product:', error);
            alert(`Failed to upload product: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    // FILTERING LOGIC: prioritizes location match if specified
    const filteredProducts = products.filter(p => {
        if (selectedCountry !== 'all' && p.country !== selectedCountry) return false;
        if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
        if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const activeCountry = MARKETPLACE_COUNTRIES.find(c => c.code === selectedCountry) || MARKETPLACE_COUNTRIES[0];

    return (
        <div className="min-h-screen bg-[#18191A] font-sans pb-20">
            {/* Header */}
            <div className="bg-[#242526] sticky top-0 z-50 px-4 py-3 flex items-center justify-between shadow-md border-b border-[#3E4042]">
                <div className="flex items-center gap-3 cursor-pointer group" onClick={onNavigateHome}>
                    <div className="w-10 h-10 rounded-full bg-[#3A3B3C] flex items-center justify-center group-hover:bg-[#4E4F50] transition-colors">
                        <i className="fas fa-arrow-left text-[#E4E6EB]"></i>
                    </div>
                    <h1 className="text-xl font-bold text-[#E4E6EB]">Marketplace</h1>
                </div>
                <div className="flex items-center gap-3">
                     <div className="bg-[#3A3B3C] px-3 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-[#4E4F50] transition-colors" onClick={() => setSelectedCountry('all')}>
                        <span className="text-lg">{activeCountry.flag}</span>
                        <span className="text-sm font-bold text-[#E4E6EB]">{activeCountry.code === 'all' ? 'Worldwide' : activeCountry.name}</span>
                        <i className="fas fa-chevron-down text-[#B0B3B8] text-[10px]"></i>
                    </div>
                    <button onClick={handleSellClick} className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-5 py-2 rounded-full font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center gap-2">
                        <i className="fas fa-plus"></i> Sell
                    </button>
                </div>
            </div>

            {/* Sticky Search & Discovery */}
            <div className="sticky top-[64px] z-40 bg-[#18191A]/80 backdrop-blur-xl pt-3 pb-3 border-b border-[#3E4042]/50 px-4 space-y-4">
                <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row gap-3">
                    <div className="flex-1 bg-[#242526] rounded-xl flex items-center px-4 py-3 border border-[#3E4042] focus-within:border-[#1877F2] transition-colors">
                        <i className="fas fa-search text-[#B0B3B8] mr-3"></i>
                        <input 
                            type="text" 
                            placeholder="What are you looking for?" 
                            className="bg-transparent text-[#E4E6EB] outline-none flex-1 text-[15px] placeholder-[#B0B3B8]"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {MARKETPLACE_CATEGORIES.map(cat => (
                            <button 
                                key={cat.id} 
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-5 py-2 rounded-xl font-bold whitespace-nowrap text-sm transition-all border ${
                                    selectedCategory === cat.id 
                                    ? 'bg-[#1877F2] text-white border-[#1877F2] shadow-lg shadow-blue-500/20' 
                                    : 'bg-[#242526] text-[#B0B3B8] border-[#3E4042] hover:bg-[#3A3B3C]'
                                }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-4 mt-6">
                {/* Dynamic Location Banner */}
                {currentUser && (
                    <div className="mb-6 p-4 bg-[#263951] rounded-2xl border border-[#2D88FF]/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-[#1877F2]/20 flex items-center justify-center text-[#1877F2]">
                                <i className="fas fa-location-dot text-xl"></i>
                            </div>
                            <div>
                                <h3 className="text-[#E4E6EB] font-bold">Local Findings</h3>
                                <p className="text-[#B0B3B8] text-sm">Showing products available near <span className="text-[#1877F2] font-semibold">{currentUser.nationality || 'you'}</span></p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedCountry('all')} className="text-[#1877F2] font-bold text-sm hover:underline">Change</button>
                    </div>
                )}

                {/* Products Grid */}
                {filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredProducts.map(product => {
                            const pCountry = MARKETPLACE_COUNTRIES.find(c => product.address.toLowerCase().includes(c.name.toLowerCase()));
                            const symbol = pCountry ? pCountry.symbol : '$';
                            return (
                                <div key={product.id} className="bg-[#242526] rounded-2xl overflow-hidden cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all border border-[#3E4042] flex flex-col group" onClick={() => onViewProduct(product)}>
                                    <div className="relative aspect-square overflow-hidden bg-[#18191A]">
                                        <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-white uppercase flex items-center gap-1">
                                            <i className="fas fa-location-dot text-[#1877F2]"></i>
                                            <span className="truncate max-w-[80px]">{product.address.split(',')[0]}</span>
                                        </div>
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col">
                                        <h3 className="text-[#E4E6EB] font-bold text-sm line-clamp-2 mb-2 min-h-[40px]">{product.title}</h3>
                                        <div className="mt-auto">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[#F02849] font-black text-lg">{symbol}{product.main_price.toFixed(0)}</span>
                                                <div className="w-8 h-8 rounded-lg bg-[#3A3B3C] group-hover:bg-[#1877F2] flex items-center justify-center text-[#B0B3B8] group-hover:text-white transition-colors">
                                                    <i className="fas fa-chevron-right text-xs"></i>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-24 h-24 bg-[#242526] rounded-full flex items-center justify-center mb-6 border border-[#3E4042]">
                             <i className="fas fa-store-slash text-4xl text-[#3E4042]"></i>
                        </div>
                        <h3 className="text-[#E4E6EB] font-bold text-xl mb-2">No items found in this area</h3>
                        <p className="text-[#B0B3B8] max-w-xs mb-8">Try adjusting your filters or expanding your location to see more results.</p>
                        <button onClick={() => {setSelectedCountry('all'); setSelectedCategory('all'); setSearchQuery('');}} className="px-8 py-3 bg-[#3A3B3C] text-[#E4E6EB] rounded-xl font-bold hover:bg-[#4E4F50] transition-colors">
                            Clear all filters
                        </button>
                    </div>
                )}
            </div>

            {/* Sell Modal */}
            {showSellModal && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                    <div className="bg-[#242526] w-full max-w-[700px] rounded-3xl border border-[#3E4042] flex flex-col max-h-[90vh] shadow-2xl animate-slide-up">
                        <div className="p-6 border-b border-[#3E4042] flex justify-between items-center bg-[#1C1D1E] rounded-t-3xl">
                            <div>
                                <h2 className="text-2xl font-bold text-[#E4E6EB]">Create Listing</h2>
                                <p className="text-[#B0B3B8] text-sm">Sell to your local community</p>
                            </div>
                            <button onClick={() => setShowSellModal(false)} className="w-10 h-10 rounded-full bg-[#3A3B3C] hover:bg-red-500/20 hover:text-red-500 flex items-center justify-center transition-all">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            {/* Images Section */}
                            <div>
                                <label className="block text-[#E4E6EB] font-bold mb-3 flex items-center gap-2">
                                    <i className="fas fa-images text-[#1877F2]"></i> Product Photos (Max 10)
                                </label>
                                <div 
                                    onClick={() => fileInputRef.current?.click()} 
                                    className={`border-2 border-dashed border-[#3E4042] bg-[#18191A] hover:bg-[#242526] hover:border-[#1877F2] rounded-2xl p-10 text-center cursor-pointer transition-all group`}
                                >
                                    <i className="fas fa-cloud-upload-alt text-5xl text-[#3E4042] group-hover:text-[#1877F2] mb-4 transition-colors"></i>
                                    <p className="text-[#E4E6EB] font-bold">Click to upload high-quality images</p>
                                    <p className="text-[#B0B3B8] text-xs mt-1">Upload at least one clear photo of your item</p>
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleFileChange} />
                                
                                {images.length > 0 && (
                                    <div className="grid grid-cols-5 gap-3 mt-6">
                                        {images.map(img => (
                                            <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border border-[#3E4042] group shadow-sm">
                                                <img src={img.data} alt="" className="w-full h-full object-cover" />
                                                <button 
                                                    type="button"
                                                    onClick={() => removeImage(img.id)} 
                                                    className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <label className="block text-[#E4E6EB] font-bold flex items-center gap-2">
                                    <i className="fas fa-tag text-[#1877F2]"></i> Basic Information
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input 
                                        type="text" 
                                        className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-xl p-4 text-[#E4E6EB] outline-none focus:border-[#1877F2] transition-colors" 
                                        placeholder="Product Name *" 
                                        value={title} 
                                        onChange={e => setTitle(e.target.value)} 
                                        required 
                                    />
                                    <select 
                                        className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-xl p-4 text-[#E4E6EB] outline-none focus:border-[#1877F2] transition-colors" 
                                        value={category} 
                                        onChange={e => setCategory(e.target.value)}
                                        required
                                    >
                                        <option value="">Select Category *</option>
                                        {MARKETPLACE_CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-[#E4E6EB] font-bold flex items-center gap-2">
                                    <i className="fas fa-location-dot text-[#1877F2]"></i> Location & Contact
                                </label>
                                <LocationSearch value={address} onSelect={setAddress} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input 
                                        type="tel" 
                                        className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-xl p-4 text-[#E4E6EB] outline-none focus:border-[#1877F2]" 
                                        placeholder="WhatsApp / Phone Number *" 
                                        value={phone} 
                                        onChange={e => setPhone(e.target.value)} 
                                        required 
                                    />
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B0B3B8] font-bold">$</span>
                                            <input 
                                                type="number" 
                                                className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-xl p-4 pl-8 text-[#E4E6EB] outline-none focus:border-[#1877F2]" 
                                                placeholder="Main Price *" 
                                                value={mainPrice} 
                                                onChange={e => setMainPrice(e.target.value)} 
                                                required 
                                            />
                                        </div>
                                        <input 
                                            type="number" 
                                            className="w-24 bg-[#3A3B3C] border border-[#3E4042] rounded-xl p-4 text-[#E4E6EB] outline-none focus:border-[#1877F2]" 
                                            placeholder="Qty" 
                                            value={quantity} 
                                            onChange={e => setQuantity(e.target.value)} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-[#E4E6EB] font-bold flex items-center gap-2">
                                    <i className="fas fa-align-left text-[#1877F2]"></i> Professional Description
                                </label>
                                <textarea 
                                    className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-2xl p-5 text-[#E4E6EB] outline-none focus:border-[#1877F2] h-48 resize-none transition-colors" 
                                    placeholder="Provide detailed information about your product, condition, features, and why people should buy it... *" 
                                    value={desc} 
                                    onChange={e => setDesc(e.target.value)}
                                    required
                                ></textarea>
                            </div>

                            <button 
                                type="submit" 
                                disabled={isUploading}
                                className={`w-full bg-[#1877F2] hover:bg-[#166FE5] text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-3 ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isUploading ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-check-circle"></i> Publish Professional Listing
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
