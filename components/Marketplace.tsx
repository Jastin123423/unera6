// Marketplace.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, Product } from '../types';
import { MARKETPLACE_CATEGORIES, MARKETPLACE_COUNTRIES } from '../constants';

// ==================== MARKETPLACE IMAGE BUNDLE HELPERS ====================

type ProductImageVariant = {
  thumb: string;
  feed: string;
  full: string; // for products, full = feed
  type: 'image';
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas export failed'));
    }, type, quality);
  });

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });

const calcContainSize = (w: number, h: number, max: number) => {
  if (!w || !h) return { width: max, height: max };
  if (Math.max(w, h) <= max) return { width: w, height: h };
  const scale = max / Math.max(w, h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
};

const buildMarketplaceImageBundle = async (file: File) => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const thumbSize = calcContainSize(img.naturalWidth, img.naturalHeight, 320);
    const feedSize = calcContainSize(img.naturalWidth, img.naturalHeight, 1080);

    const drawToCanvas = (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      ctx.drawImage(img, 0, 0, width, height);
      return canvas;
    };

    const thumbCanvas = drawToCanvas(thumbSize.width, thumbSize.height);
    const feedCanvas = drawToCanvas(feedSize.width, feedSize.height);

    const thumbBlob = await canvasToBlob(thumbCanvas, 'image/webp', 0.72);
    const feedBlob = await canvasToBlob(feedCanvas, 'image/webp', 0.82);

    const ts = Date.now();
    const thumb = new File([thumbBlob], `${ts}-thumbnail.webp`, { type: 'image/webp' });
    const feed = new File([feedBlob], `${ts}-feed.webp`, { type: 'image/webp' });

    return { thumb, feed };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const uploadMarketplaceImageBundle = async (file: File): Promise<ProductImageVariant> => {
  const bundle = await buildMarketplaceImageBundle(file);
  const formData = new FormData();
  formData.append('thumbnail', bundle.thumb);
  formData.append('feed', bundle.feed);
  formData.append('original', bundle.feed); // product full should be feed

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed: ${response.status}`);
  }

  const result = await response.json();
  const thumb = result?.uploaded?.thumbnail?.url || result?.media_urls?.thumb || '';
  const feed = result?.uploaded?.feed?.url || result?.media_urls?.feed || result?.url || '';

  if (!feed) {
    throw new Error('Marketplace upload failed: missing feed URL');
  }

  return {
    thumb: thumb || feed,
    feed,
    full: feed,
    type: 'image',
  };
};

// ==================== MARKETPLACE IMAGE WARM CACHE ====================

const warmedMarketplaceImages = new Set<string>();
const marketplaceWarmPromises = new Map<string, Promise<void>>();

const warmMarketplaceImage = (src?: string): Promise<void> => {
  const url = String(src || '').trim();
  if (!url) return Promise.resolve();
  if (warmedMarketplaceImages.has(url)) return Promise.resolve();
  if (marketplaceWarmPromises.has(url)) return marketplaceWarmPromises.get(url)!;

  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      warmedMarketplaceImages.add(url);
      marketplaceWarmPromises.delete(url);
      resolve();
    };
    img.onerror = () => {
      marketplaceWarmPromises.delete(url);
      resolve();
    };
    img.src = url;
  });

  marketplaceWarmPromises.set(url, promise);
  return promise;
};

// ==================== HELPER FUNCTIONS ====================

const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeString = (v: any) => String(v || '').trim();

const seededRand01 = (seed: number) => {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return ((x >>> 0) % 1_000_000) / 1_000_000;
};

const hashString = (input: string) => {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return h;
};

// Safe image variants parser
const safeImageVariants = (value: any): ProductImageVariant[] => {
  if (Array.isArray(value)) {
    return value
      .map((v) => ({
        thumb: String(v?.thumb || '').trim(),
        feed: String(v?.feed || v?.full || '').trim(),
        full: String(v?.feed || v?.full || '').trim(),
        type: 'image' as const,
      }))
      .filter((v) => v.feed);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((v: any) => ({
          thumb: String(v?.thumb || '').trim(),
          feed: String(v?.feed || v?.full || '').trim(),
          full: String(v?.feed || v?.full || '').trim(),
          type: 'image' as const,
        }))
        .filter((v: any) => v.feed);
    } catch {}
  }
  return [];
};

// Legacy safe images helper
const safeImages = (imgs: any): string[] => {
  if (Array.isArray(imgs)) return imgs.filter(Boolean);
  if (typeof imgs === 'string') {
    try {
      const p = JSON.parse(imgs);
      return Array.isArray(p) ? p.filter(Boolean) : [];
    } catch {}
  }
  return [];
};

// ==================== COUNTRY / CURRENCY HELPERS ====================

type CountryMeta = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  flag?: string;
};

const getCountryMetaByCode = (countryCode: string): CountryMeta => {
  return (
    MARKETPLACE_COUNTRIES.find((c: any) => String(c.code).toUpperCase() === String(countryCode).toUpperCase()) ||
    MARKETPLACE_COUNTRIES.find((c: any) => c.code === 'US') ||
    MARKETPLACE_COUNTRIES[0]
  );
};

const normCountry = (v: any): string => {
  const str = String(v || '').trim();
  if (!str) return '';
  for (const country of MARKETPLACE_COUNTRIES as any[]) {
    if (country.id === 'all') continue;

    if (str.toUpperCase() === String(country.code).toUpperCase()) {
      return String(country.code).toUpperCase();
    }

    if (str.toLowerCase().includes(String(country.name).toLowerCase())) {
      return String(country.code).toUpperCase();
    }
  }

  return str.toUpperCase();
};

const detectCountryFromText = (text: string): string | null => {
  const raw = String(text || '').trim().toLowerCase();
  if (!raw) return null;

  for (const country of MARKETPLACE_COUNTRIES as any[]) {
    if (country.id === 'all') continue;
    const name = String(country.name || '').toLowerCase();
    const code = String(country.code || '').toLowerCase();
    if (!name && !code) continue;

    if (raw.includes(name) || raw.includes(code)) {
      return String(country.code).toUpperCase();
    }
  }

  return null;
};

const detectCountryFromUser = (user: User | null): string => {
  if (!user) return 'all';

  const nationality = safeString((user as any).nationality);
  const location = safeString((user as any).location);

  const fromNationality = detectCountryFromText(nationality);
  if (fromNationality) return fromNationality;

  const fromLocation = detectCountryFromText(location);
  if (fromLocation) return fromLocation;

  return 'all';
};

const getCurrencyLabelForCountry = (countryCode: string): string => {
  const c = getCountryMetaByCode(countryCode);
  const code = String(c.code || '').toUpperCase();

  if (code === 'TZS' || code === 'TZ') return 'TSh';
  if (code === 'KES' || code === 'KE') return 'KSh';
  if (code === 'UGX' || code === 'UG') return 'USh';
  if (code === 'RWF' || code === 'RW') return 'RWF';
  if (code === 'BIF' || code === 'BI') return 'BIF';
  if (code === 'USD' || code === 'US') return '$';
  if (code === 'EUR' || code === 'EU') return '€';
  if (code === 'GBP' || code === 'GB') return '£';

  return c.symbol || '$';
};

const getCurrencyDecimals = (countryCode: string): number => {
  const code = String(countryCode || '').toUpperCase();

  if (['TZ', 'TZS', 'KE', 'KES', 'UG', 'UGX', 'RW', 'RWF', 'BI', 'BIF'].includes(code)) {
    return 0;
  }
  return 2;
};

const formatPriceValue = (value: any, countryCode: string): string => {
  const n = safeNumber(value, 0);
  const decimals = getCurrencyDecimals(countryCode);

  try {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  } catch {
    return decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString();
  }
};

const formatPriceWithCurrency = (value: any, countryCode: string): string => {
  return `${getCurrencyLabelForCountry(countryCode)} ${formatPriceValue(value, countryCode)}`;
};

const sanitizePriceInput = (raw: string, countryCode: string): string => {
  const decimals = getCurrencyDecimals(countryCode);
  let cleaned = String(raw || '').replace(/[^\d.]/g, '');

  if (decimals === 0) {
    cleaned = cleaned.replace(/\./g, '');
    return cleaned;
  }

  const firstDot = cleaned.indexOf('.');
  if (firstDot >= 0) {
    const intPart = cleaned.slice(0, firstDot).replace(/\./g, '');
    const fracPart = cleaned
      .slice(firstDot + 1)
      .replace(/\./g, '')
      .slice(0, 2);
    return fracPart ? `${intPart}.${fracPart}` : `${intPart}.`;
  }

  return cleaned;
};

const formatPriceInputForDisplay = (raw: string, countryCode: string): string => {
  const value = String(raw || '');
  if (!value) return '';

  const decimals = getCurrencyDecimals(countryCode);

  if (decimals === 0) {
    const digitsOnly = value.replace(/\D/g, '');
    if (!digitsOnly) return '';
    return Number(digitsOnly).toLocaleString();
  }

  const parts = value.split('.');
  const intPart = parts[0].replace(/\D/g, '');
  const fracPart = parts[1]?.replace(/\D/g, '') || '';
  const formattedInt = intPart ? Number(intPart).toLocaleString() : '0';

  if (value.endsWith('.') && parts.length === 2) return `${formattedInt}.`;
  if (parts.length > 1) return `${formattedInt}.${fracPart}`;
  return formattedInt;
};

const parseStoredPrice = (raw: string, countryCode: string): number => {
  const cleaned = sanitizePriceInput(raw, countryCode);
  if (!cleaned) return 0;

  const decimals = getCurrencyDecimals(countryCode);
  if (decimals === 0) return safeNumber(cleaned.replace(/\D/g, ''), 0);

  return safeNumber(cleaned, 0);
};

const resolveListingCountry = ({
  manualCountry,
  selectedAddress,
  typedAddress,
  currentUser,
}: {
  manualCountry?: string;
  selectedAddress?: string;
  typedAddress?: string;
  currentUser: User | null;
}): string => {
  const fromManual = normCountry(manualCountry);
  if (fromManual && fromManual !== 'ALL') return fromManual;

  const fromSelected = detectCountryFromText(selectedAddress || '');
  if (fromSelected) return fromSelected;

  const fromTyped = detectCountryFromText(typedAddress || '');
  if (fromTyped) return fromTyped;

  const fromUser = detectCountryFromUser(currentUser);
  if (fromUser && fromUser !== 'all') return fromUser;

  return 'US';
};

// ==================== MARKETPLACE RANKING ====================

type RankedProduct = Product & {
  __score?: number;
};

const getProductCountryCode = (product: any): string => {
  const fromCountry = normCountry(product?.country);
  if (fromCountry) return fromCountry;

  const fromAddress = detectCountryFromText(product?.address || '');
  if (fromAddress) return fromAddress;

  return '';
};

const getProductSellerId = (product: any): number | string => {
  return product?.seller_id ?? product?.user_id ?? product?.owner_id ?? product?.id ?? 0;
};

const getProductAgeHours = (product: any): number => {
  const ts = new Date(product?.created_at || 0).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return 999999;
  return Math.max(0, (Date.now() - ts) / (1000 * 60 * 60));
};

const isFreshProduct = (product: any) => getProductAgeHours(product) <= 24 * 7;

const scoreMarketplaceProduct = (
  product: any,
  viewerCountry: string,
  localCountry: string,
  seed: number
): number => {
  const ageHours = getProductAgeHours(product);
  const ageDays = ageHours / 24;
  const productCountry = getProductCountryCode(product);

  let freshness = 0;
  if (ageDays <= 2) freshness = 70;
  else if (ageDays <= 7) freshness = 55;
  else if (ageDays <= 14) freshness = 30;
  else if (ageDays <= 30) freshness = 18;
  else if (ageDays <= 90) freshness = 8;
  else freshness = 2;

  let locality = 0;
  if (localCountry && productCountry === localCountry) locality = 34;
  else if (viewerCountry && productCountry === viewerCountry) locality = 28;
  else if (productCountry) locality = 8;

  const variants = safeImageVariants(product?.image_variants);
  const legacyImages = safeImages(product?.images);
  const imagesCount = Math.max(variants.length, legacyImages.length);

  let quality = 0;
  if (imagesCount >= 1) quality += 12;
  if (imagesCount >= 3) quality += 5;
  if (safeString(product?.title).length >= 6) quality += 8;
  if (safeString(product?.description).length >= 20) quality += 10;
  if (safeString(product?.address).length >= 5) quality += 8;
  if (safeNumber(product?.main_price, 0) > 0) quality += 8;
  if (safeNumber(product?.quantity, 0) > 0) quality += 4;

  const engagement =
    Math.min(12, safeNumber(product?.views, 0) * 0.05) +
    Math.min(8, safeNumber(product?.shares, 0) * 0.6);

  const sellerKey = String(getProductSellerId(product));
  const randomJitter = seededRand01(seed + hashString(`${product?.id}:${sellerKey}`)) * 6;

  return freshness + locality + quality + engagement + randomJitter;
};

const interleaveMarketplacePools = (
  localFresh: any[],
  localOlder: any[],
  worldFresh: any[],
  worldOlder: any[]
) => {
  const result: any[] = [];
  const recentSellerUses = new Map<string, number>();

  const takeFromPool = (pool: any[]) => {
    if (!pool.length) return null;

    let bestIndex = 0;
    let bestPenalty = Number.POSITIVE_INFINITY;

    for (let i = 0; i < pool.length; i++) {
      const sellerKey = String(getProductSellerId(pool[i]));
      const penalty = recentSellerUses.get(sellerKey) || 0;
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestIndex = i;
      }
      if (penalty === 0) break;
    }

    const [picked] = pool.splice(bestIndex, 1);
    const sellerKey = String(getProductSellerId(picked));
    recentSellerUses.set(sellerKey, (recentSellerUses.get(sellerKey) || 0) + 1);

    if (result.length > 10) {
      const recent = result.slice(-8);
      const counts = new Map<string, number>();
      recent.forEach((item: any) => {
        const key = String(getProductSellerId(item));
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      recentSellerUses.clear();
      counts.forEach((v, k) => recentSellerUses.set(k, v));
    }

    return picked;
  };

  const pattern = [
    'localFresh',
    'localFresh',
    'localOlder',
    'localFresh',
    'worldFresh',
    'localFresh',
    'localOlder',
    'localFresh',
    'worldOlder',
    'localFresh',
  ] as const;

  while (localFresh.length || localOlder.length || worldFresh.length || worldOlder.length) {
    let pushedInCycle = false;

    for (const slot of pattern) {
      let picked: any = null;

      if (slot === 'localFresh') picked = takeFromPool(localFresh);
      if (slot === 'localOlder') picked = takeFromPool(localOlder);
      if (slot === 'worldFresh') picked = takeFromPool(worldFresh);
      if (slot === 'worldOlder') picked = takeFromPool(worldOlder);

      if (!picked) {
        picked =
          takeFromPool(localFresh) ||
          takeFromPool(localOlder) ||
          takeFromPool(worldFresh) ||
          takeFromPool(worldOlder);
      }

      if (picked) {
        result.push(picked);
        pushedInCycle = true;
      }

      if (!(localFresh.length || localOlder.length || worldFresh.length || worldOlder.length)) {
        break;
      }
    }

    if (!pushedInCycle) break;
  }

  return result;
};

const rankMarketplaceProducts = (
  items: Product[],
  currentUser: User | null,
  selectedCountry: string
): Product[] => {
  const viewerCountry = detectCountryFromUser(currentUser);
  const localCountry = selectedCountry !== 'all' ? normCountry(selectedCountry) : viewerCountry;

  const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 24));

  const scored = safeArray<Product>(items)
    .map((product: any) => ({
      ...product,
      __score: scoreMarketplaceProduct(product, viewerCountry, localCountry, daySeed),
    }))
    .sort((a: RankedProduct, b: RankedProduct) => safeNumber(b.__score, 0) - safeNumber(a.__score, 0));

  const localFresh: any[] = [];
  const localOlder: any[] = [];
  const worldFresh: any[] = [];
  const worldOlder: any[] = [];

  scored.forEach((product: any) => {
    const pCountry = getProductCountryCode(product);
    const isLocal =
      localCountry && localCountry !== 'ALL' && pCountry && pCountry.toUpperCase() === localCountry.toUpperCase();
    const fresh = isFreshProduct(product);

    if (isLocal && fresh) localFresh.push(product);
    else if (isLocal && !fresh) localOlder.push(product);
    else if (!isLocal && fresh) worldFresh.push(product);
    else worldOlder.push(product);
  });

  return interleaveMarketplacePools(localFresh, localOlder, worldFresh, worldOlder);
};

// ==================== OSM LOCATION SEARCH COMPONENT ====================

interface LocationSearchProps {
  value: string;
  onChangeText: (val: string) => void;
  onSelect: (val: string) => void;
  onCountryDetected?: (countryCode: string) => void;
  userFallbackCountry?: string;
}

const LocationSearch: React.FC<LocationSearchProps> = ({
  value,
  onChangeText,
  onSelect,
  onCountryDetected,
  userFallbackCountry = 'all',
}) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const searchTimeout = useRef<any>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const handleSearch = async (q: string) => {
    const trimmed = String(q || '').trim();
    if (trimmed.length < 3) {
      setResults([]);
      setSearchFailed(false);
      return;
    }

    setLoading(true);
    setSearchFailed(false);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&addressdetails=1&limit=5`
      );

      if (!res.ok) {
        throw new Error(`Location search failed: ${res.status}`);
      }

      const data = await res.json().catch(() => []);
      setResults(Array.isArray(data) ? data : []);

      const typedDetected = detectCountryFromText(trimmed);
      if (typedDetected && onCountryDetected) {
        onCountryDetected(typedDetected);
      }
    } catch (err) {
      console.error('Location search failed', err);
      setResults([]);
      setSearchFailed(true);

      const typedDetected = detectCountryFromText(trimmed);
      if (typedDetected && onCountryDetected) {
        onCountryDetected(typedDetected);
      } else if (userFallbackCountry && userFallbackCountry !== 'all' && onCountryDetected) {
        onCountryDetected(userFallbackCountry);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChangeText(val);
    setShowResults(true);

    const typedDetected = detectCountryFromText(val);
    if (typedDetected && onCountryDetected) {
      onCountryDetected(typedDetected);
    } else if (userFallbackCountry && userFallbackCountry !== 'all' && onCountryDetected) {
      onCountryDetected(userFallbackCountry);
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => handleSearch(val), 450);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-lg p-3 text-[#E4E6EB] outline-none focus:border-[#1877F2] text-sm pl-10 pr-10"
          placeholder="Search city, street or region... or type manually"
          value={query}
          onChange={handleChange}
          onFocus={() => setShowResults(true)}
          onBlur={() => {
            setTimeout(() => setShowResults(false), 180);
          }}
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const locationName = String(res?.display_name || '').trim();
                onSelect(locationName);
                setQuery(locationName);
                setShowResults(false);

                const detectedCountryCode = detectCountryFromText(locationName);
                if (detectedCountryCode && onCountryDetected) {
                  onCountryDetected(detectedCountryCode);
                } else if (userFallbackCountry && userFallbackCountry !== 'all' && onCountryDetected) {
                  onCountryDetected(userFallbackCountry);
                }
              }}
            >
              <i className="fas fa-location-dot mr-2 text-[#B0B3B8]"></i>
              {res.display_name}
            </div>
          ))}
        </div>
      )}

      {showResults && !loading && results.length === 0 && query.trim().length >= 3 && (
        <div className="absolute top-full left-0 right-0 z-[60] mt-2 bg-[#242526] border border-[#3E4042] rounded-xl shadow-2xl overflow-hidden">
          <div className="p-3 text-sm text-[#B0B3B8]">
            <i className={`fas ${searchFailed ? 'fa-triangle-exclamation text-[#F7B928]' : 'fa-keyboard'} mr-2`}></i>
            {searchFailed
              ? 'Search failed. Your typed location will still be used.'
              : 'No suggestion found. Your typed location will still be used.'}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== PRODUCT DETAIL MODAL ====================

interface ProductDetailModalProps {
  product: Product;
  currentUser: User | null;
  onClose: () => void;
  onMessage: (sellerId: number) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  currentUser,
  onClose,
  onMessage,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [mainSrc, setMainSrc] = useState('');

  const productImages = useMemo(() => {
    const productVariants = safeImageVariants((product as any).image_variants);
    const legacyImages = safeImages((product as any).images);

    if (productVariants.length > 0) {
      return productVariants.map((x) => ({
        thumb: x.thumb,
        feed: x.feed,
        full: x.full || x.feed,
      }));
    }
    return legacyImages.map((url) => ({
      thumb: url,
      feed: url,
      full: url,
    }));
  }, [product]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [product.id]);

  useEffect(() => {
    const current = productImages[activeImageIndex];
    const nextSrc = current?.feed || current?.full || current?.thumb || '';
    setMainSrc(nextSrc || '');
  }, [activeImageIndex, productImages]);

  useEffect(() => {
    if (!productImages.length) return;
    productImages.forEach((img) => {
      void warmMarketplaceImage(img.feed || img.full || img.thumb);
      void warmMarketplaceImage(img.thumb || img.feed || img.full);
    });
  }, [productImages]);

  const goPrev = useCallback(() => {
    setActiveImageIndex((prev) => (prev === 0 ? productImages.length - 1 : prev - 1));
  }, [productImages.length]);

  const goNext = useCallback(() => {
    setActiveImageIndex((prev) => (prev === productImages.length - 1 ? 0 : prev + 1));
  }, [productImages.length]);

  const productCountryCode = getProductCountryCode(product as any) || detectCountryFromText((product as any)?.address || '') || 'US';
  const countryData = getCountryMetaByCode(productCountryCode);
  const hasDiscount = !!(product as any).discount_price;
  const displayPrice = hasDiscount ? (product as any).discount_price : (product as any).main_price;

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 flex items-center justify-center p-0 md:p-4 animate-fade-in font-sans">
      <div className="bg-[#242526] w-full max-w-[1100px] md:rounded-2xl overflow-hidden flex flex-col md:flex-row h-full md:h-[90vh] relative shadow-2xl border border-[#3E4042]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-md"
        >
          <i className="fas fa-times text-xl"></i>
        </button>

        <div className="w-full md:w-[60%] bg-[#18191A] flex flex-col relative border-r border-[#3E4042]">
          <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black/20">
            {productImages.length > 0 ? (
              <img
                src={mainSrc || productImages[activeImageIndex]?.thumb || ''}
                alt={(product as any).title}
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full bg-[#242526]">
                <i className="fas fa-image text-5xl text-[#3E4042]"></i>
              </div>
            )}

            {productImages.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/40 rounded-full text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                  onClick={goPrev}
                >
                  <i className="fas fa-chevron-left text-xl"></i>
                </button>
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/40 rounded-full text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                  onClick={goNext}
                >
                  <i className="fas fa-chevron-right text-xl"></i>
                </button>
              </>
            )}
          </div>

          {productImages.length > 1 && (
            <div className="h-24 bg-[#242526]/50 backdrop-blur-sm flex items-center gap-3 px-4 overflow-x-auto border-t border-[#3E4042] scrollbar-hide">
              {productImages.map((img, idx) => (
                <button
                  type="button"
                  key={idx}
                  className={`h-16 min-w-[64px] rounded-lg overflow-hidden cursor-pointer border-2 transition-all flex-shrink-0 ${
                    activeImageIndex === idx ? 'border-[#1877F2] scale-105 shadow-lg' : 'border-transparent opacity-50 hover:opacity-100'
                  }`}
                  onClick={() => setActiveImageIndex(idx)}
                >
                  <img
                    src={img.thumb || img.feed || img.full}
                    className="h-full w-full object-cover"
                    alt={`Thumbnail ${idx + 1}`}
                    draggable={false}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-full md:w-[40%] flex flex-col h-full bg-[#242526] relative">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 overflow-hidden">
                  <img
                    src={(product as any).seller_avatar}
                    alt="Seller"
                    className="w-12 h-12 rounded-full object-cover border-2 border-[#1877F2] flex-shrink-0"
                  />
                  <div className="overflow-hidden">
                    <h4 className="text-[#E4E6EB] font-bold text-lg leading-tight truncate">
                      {(product as any).seller_name}
                    </h4>
                    <p className="text-[#B0B3B8] text-xs truncate">Seller • Active in Marketplace</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={`tel:${(product as any).phone_number}`}
                    className="w-10 h-10 rounded-full bg-[#3A3B3C] hover:bg-[#45BD62] text-[#45BD62] hover:text-white flex items-center justify-center transition-all shadow-md no-underline"
                    title="Call Seller"
                  >
                    <i className="fas fa-phone-alt text-lg"></i>
                  </a>
                  <button
                    onClick={() => onMessage((product as any).seller_id)}
                    className="w-10 h-10 rounded-full bg-[#3A3B3C] hover:bg-[#1877F2] text-[#1877F2] hover:text-white flex items-center justify-center transition-all shadow-md"
                    title="Message Seller"
                  >
                    <i className="fab fa-facebook-messenger text-lg"></i>
                  </button>
                </div>
              </div>

              <h1 className="text-2xl font-bold text-[#E4E6EB] leading-snug mb-2">
                {(product as any).title}
              </h1>

              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-[#F02849] font-bold text-3xl">
                  {formatPriceWithCurrency(displayPrice, productCountryCode)}
                </span>
                {hasDiscount && (
                  <span className="text-[#B0B3B8] text-lg line-through">
                    {formatPriceWithCurrency((product as any).main_price, productCountryCode)}
                  </span>
                )}
                <span className="text-[#B0B3B8] text-sm ml-auto flex items-center gap-1">
                  <i className="fas fa-flag"></i> {countryData.name}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-[#3A3B3C]/50 rounded-2xl border border-[#3E4042]">
                <i className="fas fa-location-dot text-[#1877F2] mt-1"></i>
                <div>
                  <p className="text-[#E4E6EB] font-bold text-sm">Location</p>
                  <p className="text-[#B0B3B8] text-sm leading-relaxed">{(product as any).address}</p>
                </div>
              </div>

              <div>
                <h3 className="text-[#E4E6EB] font-bold text-lg mb-2">Description</h3>
                <p className="text-[#B0B3B8] text-[15px] leading-relaxed whitespace-pre-wrap bg-[#18191A] p-4 rounded-xl border border-[#3E4042]">
                  {(product as any).description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#18191A] p-4 rounded-xl border border-[#3E4042] text-center">
                <span className="block text-[#B0B3B8] text-[10px] uppercase font-bold tracking-wider mb-1">
                  Category
                </span>
                <span className="block text-[#E4E6EB] font-bold">
                  {(MARKETPLACE_CATEGORIES as any[]).find((c) => c.id === (product as any).category)?.name}
                </span>
              </div>
              <div className="bg-[#18191A] p-4 rounded-xl border border-[#3E4042] text-center">
                <span className="block text-[#B0B3B8] text-[10px] uppercase font-bold tracking-wider mb-1">
                  Status
                </span>
                <span className="block text-[#45BD62] font-bold uppercase text-xs">
                  {safeNumber((product as any).quantity, 0) > 0 ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== PAGE ====================

interface MarketplacePageProps {
  currentUser: User | null;
  products: Product[];
  onNavigateHome: () => void;
  onCreateProduct: (productData: Partial<Product>) => void;
  onViewProduct: (product: Product) => void;
}

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  currentUser,
  products,
  onNavigateHome,
  onCreateProduct,
  onViewProduct,
}) => {
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSellModal, setShowSellModal] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [desc, setDesc] = useState('');
  const [address, setAddress] = useState('');
  const [mainPriceRaw, setMainPriceRaw] = useState('');
  const [discountPriceRaw, setDiscountPriceRaw] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [phone, setPhone] = useState('');
  const [images, setImages] = useState<{ id: number; data: string; file: File }[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Country / currency state
  const [userCountry, setUserCountry] = useState<string>('all');
  const [detectedCountry, setDetectedCountry] = useState<string>('all');
  const [manualCountry, setManualCountry] = useState<string>('all');
  const [currencyLabel, setCurrencyLabel] = useState<string>('$');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) {
      const detected = detectCountryFromUser(currentUser);
      setUserCountry(detected);
      const baseCountry = detected && detected !== 'all' ? detected : 'US';
      setCurrencyLabel(getCurrencyLabelForCountry(baseCountry));

      if ((currentUser as any).phone) {
        setPhone((currentUser as any).phone);
      }
    } else {
      setUserCountry('all');
      setCurrencyLabel('$');
    }
  }, [currentUser]);

  const effectiveListingCountry = useMemo(() => {
    return resolveListingCountry({
      manualCountry,
      selectedAddress: address,
      typedAddress: address,
      currentUser,
    });
  }, [manualCountry, address, currentUser]);

  useEffect(() => {
    const countryCode =
      manualCountry !== 'all'
        ? manualCountry
        : detectedCountry !== 'all'
        ? detectedCountry
        : userCountry !== 'all'
        ? userCountry
        : 'US';

    setCurrencyLabel(getCurrencyLabelForCountry(countryCode));
  }, [manualCountry, detectedCountry, userCountry]);

  const handleSellClick = () => {
    if (!currentUser) {
      alert('Please log in to sell products.');
      return;
    }
    setShowSellModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (images.length + e.target.files.length > 10) {
        alert('Maximum 10 images allowed for a professional listing');
        return;
      }

      Array.from(e.target.files).forEach((file: File) => {
        const previewUrl = URL.createObjectURL(file);
        setImages((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            data: previewUrl,
            file,
          },
        ]);
      });
    }
  };

  const removeImage = (id: number) => {
    setImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.data);
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedMainPrice = parseStoredPrice(mainPriceRaw, effectiveListingCountry);
    const parsedDiscountPrice = discountPriceRaw
      ? parseStoredPrice(discountPriceRaw, effectiveListingCountry)
      : 0;

    if (!title || !category || !desc || !address || !parsedMainPrice || !phone || images.length === 0) {
      alert('Please fill all required fields and upload at least one image.');
      return;
    }

    try {
      setIsUploading(true);

      const uploadedVariants = await Promise.all(images.map((img) => uploadMarketplaceImageBundle(img.file)));
      const uploadedUrls = uploadedVariants.map((x) => x.feed).filter(Boolean);

      const countryFromResolved = resolveListingCountry({
        manualCountry,
        selectedAddress: address,
        typedAddress: address,
        currentUser,
      });

      const newProduct: Partial<Product> = {
        title,
        category,
        description: desc,
        country: countryFromResolved,
        address,
        main_price: parsedMainPrice,
        discount_price: parsedDiscountPrice > 0 ? parsedDiscountPrice : null,
        quantity: parseInt(quantity || '1', 10) || 1,
        phone_number: phone,
        images: uploadedUrls,
        image_variants: uploadedVariants,
        status: 'active',
        views: 0,
        ratings: [],
        comments: [],
        created_at: new Date().toISOString(),
      };

      onCreateProduct(newProduct);
      setShowSellModal(false);

      setTitle('');
      setCategory('');
      setDesc('');
      setAddress('');
      setMainPriceRaw('');
      setDiscountPriceRaw('');
      setQuantity('1');
      setImages([]);
      setDetectedCountry('all');
      setManualCountry('all');
    } catch (error: any) {
      console.error('Failed to upload product:', error);
      alert(`Failed to upload product: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const base = safeArray<any>(products).filter((p: any) => {
      const pCountry = getProductCountryCode(p);
      const sel = normCountry(selectedCountry);

      if (selectedCountry !== 'all') {
        if (pCountry !== sel) return false;
      }

      if (selectedCategory !== 'all' && String(p.category) !== String(selectedCategory)) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inTitle = safeString(p.title).toLowerCase().includes(q);
        const inDesc = safeString(p.description).toLowerCase().includes(q);
        const inAddress = safeString(p.address).toLowerCase().includes(q);
        if (!inTitle && !inDesc && !inAddress) return false;
      }

      return true;
    });

    return rankMarketplaceProducts(base, currentUser, selectedCountry);
  }, [products, selectedCountry, selectedCategory, searchQuery, currentUser]);

  useEffect(() => {
    const items = filteredProducts.slice(0, 24);
    items.forEach((product: any) => {
      const variants = safeImageVariants(product?.image_variants);
      const legacy = safeImages(product?.images);
      const cover = variants[0]?.feed || variants[0]?.thumb || legacy[0] || '';
      if (cover) {
        void warmMarketplaceImage(cover);
      }
      variants.forEach((v) => {
        void warmMarketplaceImage(v.thumb);
        void warmMarketplaceImage(v.feed);
        void warmMarketplaceImage(v.full);
      });
    });
  }, [filteredProducts]);

  const activeCountry =
    (MARKETPLACE_COUNTRIES as any[]).find((c) => c.code === selectedCountry) || MARKETPLACE_COUNTRIES[0];

  return (
    <div className="min-h-screen bg-[#18191A] font-sans pb-20">
      <div className="bg-[#242526] sticky top-0 z-50 px-4 py-3 flex items-center justify-between shadow-md border-b border-[#3E4042]">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={onNavigateHome}>
          <div className="w-10 h-10 rounded-full bg-[#3A3B3C] flex items-center justify-center group-hover:bg-[#4E4F50] transition-colors">
            <i className="fas fa-arrow-left text-[#E4E6EB]"></i>
          </div>
          <h1 className="text-xl font-bold text-[#E4E6EB]">Marketplace</h1>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="bg-[#3A3B3C] px-3 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-[#4E4F50] transition-colors"
            onClick={() => {
              const countryList = ['all', ...(MARKETPLACE_COUNTRIES as any[]).filter((c) => c.id !== 'all').map((c) => c.code)];
              const currentIndex = countryList.indexOf(selectedCountry);
              const nextIndex = (currentIndex + 1) % countryList.length;
              setSelectedCountry(countryList[nextIndex]);
            }}
          >
            <span className="text-lg">{(activeCountry as any).flag}</span>
            <span className="text-sm font-bold text-[#E4E6EB]">
              {(activeCountry as any).code === 'all'
                ? 'Worldwide'
                : `${(activeCountry as any).name} (${getCurrencyLabelForCountry((activeCountry as any).code)})`}
            </span>
            <i className="fas fa-chevron-down text-[#B0B3B8] text-[10px]"></i>
          </div>

          <button
            onClick={handleSellClick}
            className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-5 py-2 rounded-full font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center gap-2"
          >
            <i className="fas fa-plus"></i> Sell
          </button>
        </div>
      </div>

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
            {(MARKETPLACE_CATEGORIES as any[]).map((cat) => (
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
        {currentUser && userCountry !== 'all' && selectedCountry === 'all' && (
          <div className="mb-6 p-4 bg-[#263951] rounded-2xl border border-[#2D88FF]/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#1877F2]/20 flex items-center justify-center text-[#1877F2]">
                <i className="fas fa-globe-africa text-xl"></i>
              </div>
              <div>
                <h3 className="text-[#E4E6EB] font-bold">Local Marketplace Available</h3>
                <p className="text-[#B0B3B8] text-sm">
                  We detected you're in{' '}
                  <span className="text-[#1877F2] font-semibold">
                    {(MARKETPLACE_COUNTRIES as any[]).find((c) => c.code === userCountry)?.name || 'your region'}
                  </span>
                  . Switch to see local products first.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedCountry(userCountry)}
              className="bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
            >
              Show Local ({getCurrencyLabelForCountry(userCountry)})
            </button>
          </div>
        )}

        {filteredProducts.length > 0 ? (
          <>
            <div className="mb-4 text-sm text-[#B0B3B8] flex flex-wrap gap-3">
              <span>
                Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}{' '}
                {selectedCountry !== 'all' ? `in ${(activeCountry as any).name}` : 'with local-first ranking'}
              </span>
              <span className="text-[#8AB4F8]">Fresh products in 7 days are prioritized</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map((product: any) => {
                const productVariants = safeImageVariants(product.image_variants);
                const legacyImages = safeImages(product.images);
                const cover =
                  productVariants[0]?.feed ||
                  productVariants[0]?.thumb ||
                  legacyImages[0] ||
                  'https://via.placeholder.com/600x600?text=No+Image';

                const productCountryCode = getProductCountryCode(product) || 'US';
                const pCountry = getCountryMetaByCode(productCountryCode);
                const flag = pCountry.flag;
                const hasDiscount = !!product.discount_price;
                const displayPrice = hasDiscount ? product.discount_price : product.main_price;

                return (
                  <div
                    key={product.id}
                    className="bg-[#242526] rounded-2xl overflow-hidden cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all border border-[#3E4042] flex flex-col group"
                    onClick={() => onViewProduct(product)}
                  >
                    <div className="relative aspect-square overflow-hidden bg-[#18191A]">
                      <img
                        src={cover}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                        decoding="async"
                      />

                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-white uppercase flex items-center gap-1">
                        <span>{flag}</span>
                        <span className="truncate max-w-[90px]">
                          {product.address ? String(product.address).split(',')[0] : 'No Location'}
                        </span>
                      </div>

                      {isFreshProduct(product) && (
                        <div className="absolute top-3 right-3 bg-[#1877F2]/90 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-white uppercase">
                          New
                        </div>
                      )}
                    </div>

                    <div className="p-3 flex-1 flex flex-col">
                      <h3 className="text-[#E4E6EB] font-bold text-sm line-clamp-2 mb-2 min-h-[40px]">
                        {product.title}
                      </h3>

                      <div className="mt-auto">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[#F02849] font-black text-base block truncate">
                              {formatPriceWithCurrency(displayPrice, productCountryCode)}
                            </span>
                            {hasDiscount && (
                              <span className="text-[#B0B3B8] text-xs line-through">
                                {formatPriceWithCurrency(product.main_price, productCountryCode)}
                              </span>
                            )}
                          </div>

                          <div className="w-8 h-8 rounded-lg bg-[#3A3B3C] group-hover:bg-[#1877F2] flex items-center justify-center text-[#B0B3B8] group-hover:text-white transition-colors flex-shrink-0">
                            <i className="fas fa-chevron-right text-xs"></i>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-[#242526] rounded-full flex items-center justify-center mb-6 border border-[#3E4042]">
              <i className="fas fa-store-slash text-4xl text-[#3E4042]"></i>
            </div>

            <h3 className="text-[#E4E6EB] font-bold text-xl mb-2">
              {selectedCountry !== 'all' ? `No items found in ${(activeCountry as any).name}` : 'No items found'}
            </h3>

            <p className="text-[#B0B3B8] max-w-xs mb-8">
              {selectedCountry !== 'all'
                ? 'Try switching to worldwide view or adjusting your search.'
                : 'Try adjusting your search or create a listing.'}
            </p>

            <button
              onClick={() => {
                setSelectedCountry('all');
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="px-8 py-3 bg-[#3A3B3C] text-[#E4E6EB] rounded-xl font-bold hover:bg-[#4E4F50] transition-colors mb-4"
            >
              Clear all filters
            </button>

            {selectedCountry !== 'all' && (
              <button
                onClick={() => setSelectedCountry('all')}
                className="px-8 py-3 bg-[#1877F2] text-white rounded-xl font-bold hover:bg-[#166FE5] transition-colors"
              >
                View Worldwide
              </button>
            )}
          </div>
        )}
      </div>

      {showSellModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-[#242526] w-full max-w-[760px] rounded-3xl border border-[#3E4042] flex flex-col max-h-[90vh] shadow-2xl animate-slide-up">
            <div className="p-6 border-b border-[#3E4042] flex justify-between items-center bg-[#1C1D1E] rounded-t-3xl">
              <div>
                <h2 className="text-2xl font-bold text-[#E4E6EB]">Create Listing</h2>
                <p className="text-[#B0B3B8] text-sm">
                  Sell to your local community with proper currency formatting
                </p>
              </div>
              <button
                onClick={() => setShowSellModal(false)}
                className="w-10 h-10 rounded-full bg-[#3A3B3C] hover:bg-red-500/20 hover:text-red-500 flex items-center justify-center transition-all"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              <div>
                <label className="block text-[#E4E6EB] font-bold mb-3 flex items-center gap-2">
                  <i className="fas fa-images text-[#1877F2]"></i> Product Photos (Max 10)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#3E4042] bg-[#18191A] hover:bg-[#242526] hover:border-[#1877F2] rounded-2xl p-10 text-center cursor-pointer transition-all group"
                >
                  <i className="fas fa-cloud-upload-alt text-5xl text-[#3E4042] group-hover:text-[#1877F2] mb-4 transition-colors"></i>
                  <p className="text-[#E4E6EB] font-bold">Click to upload high-quality images</p>
                  <p className="text-[#B0B3B8] text-xs mt-1">Upload at least one clear photo of your item</p>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                />

                {images.length > 0 && (
                  <div className="grid grid-cols-5 gap-3 mt-6">
                    {images.map((img) => (
                      <div
                        key={img.id}
                        className="relative aspect-square rounded-xl overflow-hidden border border-[#3E4042] group shadow-sm"
                      >
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
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />

                  <select
                    className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-xl p-4 text-[#E4E6EB] outline-none focus:border-[#1877F2] transition-colors"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    <option value="">Select Category *</option>
                    {(MARKETPLACE_CATEGORIES as any[]).filter((c) => c.id !== 'all').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-[#E4E6EB] font-bold flex items-center gap-2">
                  <i className="fas fa-location-dot text-[#1877F2]"></i> Location & Contact
                </label>

                <div className="mb-2 flex items-center gap-2 text-sm text-[#B0B3B8]">
                  <i className="fas fa-info-circle text-[#1877F2]"></i>
                  <span>Location search is optional. Manual typing is always accepted.</span>
                </div>

                <LocationSearch
                  value={address}
                  onChangeText={setAddress}
                  onSelect={setAddress}
                  userFallbackCountry={userCountry}
                  onCountryDetected={(countryCode) => {
                    setDetectedCountry(countryCode || 'all');
                  }}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select
                    className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-xl p-4 text-[#E4E6EB] outline-none focus:border-[#1877F2] transition-colors"
                    value={manualCountry}
                    onChange={(e) => setManualCountry(e.target.value)}
                  >
                    <option value="all">Auto detect country</option>
                    {(MARKETPLACE_COUNTRIES as any[])
                      .filter((c) => c.id !== 'all')
                      .map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                  </select>

                  <input
                    type="tel"
                    className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-xl p-4 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
                    placeholder="WhatsApp / Phone Number *"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-[#E4E6EB] font-bold flex items-center gap-2">
                  <i className="fas fa-money-bill-wave text-[#1877F2]"></i> Price
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex rounded-xl overflow-hidden border border-[#3E4042] focus-within:border-[#1877F2] bg-[#3A3B3C]">
                      <div className="min-w-[72px] px-4 flex items-center justify-center bg-[#2A2B2C] text-[#E4E6EB] font-bold border-r border-[#3E4042]">
                        {currencyLabel}
                      </div>
                      <input
                        type="text"
                        inputMode={getCurrencyDecimals(effectiveListingCountry) === 0 ? 'numeric' : 'decimal'}
                        className="flex-1 bg-transparent p-4 text-[#E4E6EB] outline-none"
                        placeholder="Main Price *"
                        value={formatPriceInputForDisplay(mainPriceRaw, effectiveListingCountry)}
                        onChange={(e) => {
                          const raw = sanitizePriceInput(e.target.value, effectiveListingCountry);
                          setMainPriceRaw(raw);
                        }}
                        required
                      />
                    </div>
                    <p className="text-xs text-[#B0B3B8] mt-2">
                      Example: {currencyLabel} {formatPriceValue(10000, effectiveListingCountry)}
                    </p>
                  </div>

                  <div>
                    <div className="flex rounded-xl overflow-hidden border border-[#3E4042] focus-within:border-[#1877F2] bg-[#3A3B3C]">
                      <div className="min-w-[72px] px-4 flex items-center justify-center bg-[#2A2B2C] text-[#E4E6EB] font-bold border-r border-[#3E4042]">
                        {currencyLabel}
                      </div>
                      <input
                        type="text"
                        inputMode={getCurrencyDecimals(effectiveListingCountry) === 0 ? 'numeric' : 'decimal'}
                        className="flex-1 bg-transparent p-4 text-[#E4E6EB] outline-none"
                        placeholder="Discount Price"
                        value={formatPriceInputForDisplay(discountPriceRaw, effectiveListingCountry)}
                        onChange={(e) => {
                          const raw = sanitizePriceInput(e.target.value, effectiveListingCountry);
                          setDiscountPriceRaw(raw);
                        }}
                      />
                    </div>
                    <p className="text-xs text-[#B0B3B8] mt-2">Optional discounted price</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="number"
                    className="w-full bg-[#3A3B3C] border border-[#3E4042] rounded-xl p-4 text-[#E4E6EB] outline-none focus:border-[#1877F2]"
                    placeholder="Quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min={1}
                  />

                  <div className="bg-[#1C1D1E] p-4 rounded-xl border border-[#3E4042] text-sm text-[#B0B3B8]">
                    <div className="flex items-center gap-2 mb-2">
                      <i className="fas fa-circle-info text-[#1877F2]"></i>
                      <span className="text-[#E4E6EB] font-bold">Currency source</span>
                    </div>
                    <p>
                      Current listing currency:{' '}
                      <span className="text-[#E4E6EB] font-semibold">
                        {getCurrencyLabelForCountry(effectiveListingCountry)}
                      </span>{' '}
                      ({getCountryMetaByCode(effectiveListingCountry).name})
                    </p>
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
                  onChange={(e) => setDesc(e.target.value)}
                  required
                ></textarea>
              </div>

              <div className="bg-[#1C1D1E] p-4 rounded-xl border border-[#3E4042]">
                <div className="flex items-center gap-3 mb-2">
                  <i className="fas fa-map-marked-alt text-[#45BD62]"></i>
                  <span className="text-[#E4E6EB] font-bold">Location Resolution</span>
                </div>
                <p className="text-[#B0B3B8] text-sm leading-relaxed">
                  The listing accepts your typed location even if search suggestions fail. Country and currency are resolved
                  from manual selection, typed text, or your profile location.
                </p>
                <p className="text-[#B0B3B8] text-sm mt-2">
                  Current resolved market:{' '}
                  <span className="text-[#1877F2] font-semibold">
                    {getCountryMetaByCode(effectiveListingCountry).name}
                  </span>{' '}
                  with currency{' '}
                  <span className="font-bold">{getCurrencyLabelForCountry(effectiveListingCountry)}</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className={`w-full bg-[#1877F2] hover:bg-[#166FE5] text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-3 ${
                  isUploading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
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
