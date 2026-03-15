import React, { useMemo, useState, useEffect } from 'react';
import { CATEGORIES, COLORS } from '../constants';
import { Category, Product } from '../types';
import ProductGrid from './ProductGrid';
import AdBanner from './AdBanner';

// Cache for categories to avoid multiple fetches
let categoriesCache: Category[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache

interface CategoriesViewProps {
  onCategorySelect: (category: Category) => void;
  onShowAllProducts?: () => void;
  suggestedProducts?: Product[];
  onProductClick?: (product: Product) => void;
}

const CategoriesView: React.FC<CategoriesViewProps> = ({ 
  onCategorySelect, 
  onShowAllProducts,
  suggestedProducts = [], 
  onProductClick 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  // Fetch categories only once with caching
  useEffect(() => {
    const fetchCategories = async () => {
      // Check if cache is still valid
      const now = Date.now();
      if (categoriesCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
        console.log('Using cached categories:', categoriesCache);
        setCategories(categoriesCache);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Fetching categories from API...');
        const response = await fetch('https://barakasonko.store/api/categories');
        
        console.log('API Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch categories: ${response.status}`);
        }
        
        const jsonResponse = await response.json();
        console.log('API Response data:', jsonResponse);
        
        // ✅ CORRECT: Extract the categories from the data property
        if (jsonResponse.success && Array.isArray(jsonResponse.data)) {
          const fetchedCategories = jsonResponse.data;
          console.log('Fetched categories:', fetchedCategories);
          
          // Update cache
          categoriesCache = fetchedCategories;
          cacheTimestamp = now;
          setCategories(fetchedCategories);
          setUsingFallback(false);
        } else {
          // If API returns unexpected structure, use local categories
          console.log('API returned unexpected structure, using local categories');
          setCategories(CATEGORIES);
          setUsingFallback(true);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
        setError(err instanceof Error ? err.message : 'Failed to load categories');
        
        // Fallback to local categories
        console.log('Using local categories as fallback');
        setCategories(CATEGORIES);
        setUsingFallback(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []); // Empty dependency array ensures this runs only once

  // Filter categories based on search term - only if search has text
  const filteredCategories = useMemo(() => {
    // If search is empty or just whitespace, show all categories
    if (!searchTerm.trim()) {
      return categories;
    }
    
    // Otherwise filter based on search term
    const term = searchTerm.toLowerCase().trim();
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(term) ||
      cat.id.toLowerCase().includes(term)
    );
  }, [searchTerm, categories]);

  // Select 15 suggested products randomly or sequentially
  const displayProducts = useMemo(() => {
    return suggestedProducts.slice(0, 15);
  }, [suggestedProducts]);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white min-h-screen pb-10 animate-fadeIn">
        <div className="px-6 pt-8 pb-4 flex flex-col">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">All Categories</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Explore Baraka Sonko Collection</p>
        </div>

        {/* Skeleton Search */}
        <div className="px-4 mb-6">
          <div className="h-14 bg-gray-200 rounded-2xl animate-pulse" />
        </div>

        {/* Skeleton Grid */}
        <div className="px-4 grid grid-cols-3 gap-4 mb-6">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="aspect-square p-4 rounded-3xl bg-gray-100 animate-pulse">
              <div className="w-full h-full flex flex-col items-center justify-center">
                <div className="w-8 h-8 bg-gray-200 rounded-full mb-2" />
                <div className="w-12 h-3 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && !usingFallback) {
    return (
      <div className="bg-white min-h-screen pb-10 animate-fadeIn">
        <div className="px-6 pt-8 pb-4 flex flex-col">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">All Categories</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Explore Baraka Sonko Collection</p>
        </div>

        <div className="px-4 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Failed to load categories</h3>
          <p className="text-sm font-medium text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-orange-500 text-white font-bold rounded-2xl text-sm shadow-sm active:scale-95 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-10 animate-fadeIn">
      {/* Header with Search */}
      <div className="px-6 pt-8 pb-4 flex flex-col">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">All Categories</h2>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Explore Baraka Sonko Collection</p>
        {usingFallback && (
          <p className="text-xs text-orange-500 mt-1">Using local categories (API unavailable)</p>
        )}
      </div>

      {/* Professional Categories Search */}
      <div className="px-4 mb-6">
        <div className="relative">
          {/* Search Icon */}
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg 
              className="w-5 h-5 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2.5} 
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
              />
            </svg>
          </div>
          
          {/* Search Input */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search categories (e.g., Mobiles, TV, Spika)"
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-base font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-orange-400 focus:bg-white transition-all"
            autoComplete="off"
          />
          
          {/* Clear Button - only shows when there's text */}
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center"
              aria-label="Clear search"
            >
              <svg 
                className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2.5} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            </button>
          )}
        </div>

        {/* Search Results Count - Only show when searching */}
        {searchTerm.trim() && categories.length > 0 && (
          <div className="mt-2 px-1">
            <p className="text-sm font-medium text-gray-500">
              Found {filteredCategories.length} {filteredCategories.length === 1 ? 'category' : 'categories'}
            </p>
          </div>
        )}
      </div>

      {/* Categories Grid */}
      {filteredCategories.length > 0 ? (
        <div className="px-4 grid grid-cols-3 gap-4 mb-6">
          {filteredCategories.map((cat) => (
            <div 
              key={cat.id} 
              onClick={() => onCategorySelect(cat)}
              className="flex flex-col items-center justify-center aspect-square p-4 rounded-3xl bg-gray-50 border border-gray-100 active:scale-95 transition-all group cursor-pointer shadow-sm hover:shadow-md"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                {cat.icon || '📁'}
              </div>
              <span className="text-[11px] font-black text-gray-800 text-center leading-tight tracking-tighter">
                {cat.name}
              </span>
            </div>
          ))}
        </div>
      ) : (
        // Only show "No results" when there's an active search with no matches
        searchTerm.trim() ? (
          <div className="px-4 mb-6 py-12 flex flex-col items-center justify-center text-center bg-gray-50 rounded-3xl mx-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg 
                className="w-8 h-8 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No categories found</h3>
            <p className="text-sm font-medium text-gray-500 mb-4">
              We couldn't find any categories matching "{searchTerm}"
            </p>
            <button
              onClick={() => setSearchTerm('')}
              className="px-6 py-3 bg-orange-500 text-white font-bold rounded-2xl text-sm shadow-sm active:scale-95 transition-all"
            >
              Clear Search
            </button>
          </div>
        ) : null
      )}

      {/* Promotional Banner */}
      <AdBanner 
        src="https://media.barakasonko.store/White%20Blue%20Professional%20Website%20Developer%20LinkedIn%20Banner.gif"
        onClick={onShowAllProducts} 
        containerClass="h-[110px]"
      />

      {/* Suggested Products Section */}
      {displayProducts.length > 0 && onProductClick && (
        <div className="mt-8">
           <ProductGrid 
              title="Suggested for You" 
              products={displayProducts} 
              onProductClick={onProductClick} 
           />
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-12 px-6 py-8 bg-gray-50 border-t border-gray-100 flex flex-col items-center text-center">
        <div className="w-12 h-1 bg-orange-200 rounded-full mb-4" />
        <p className="text-sm font-bold text-gray-600 leading-relaxed">
          Can't find what you're looking for?<br/>
          Check our <span className="text-orange-600">New Arrivals</span> daily!
        </p>
      </div>
    </div>
  );
};

export default CategoriesView;
