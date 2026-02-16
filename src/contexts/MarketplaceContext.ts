// src/contexts/MarketplaceContext.ts
import React from "react";

// Keep this type very loose so it won't break your current code.
// You can tighten types later once everything works.
export type MarketplaceContextValue = {
  // Open product detail modal/page by product id
  openProductById?: (productId: number) => void;

  // Optional helper to fetch a product object by id (if you want)
  getProductById?: (productId: number) => any | null;

  // Optional: store currently opened product id (if you want)
  activeProductId?: number | null;

  // Allow adding more fields later without TypeScript errors
  [key: string]: any;
};

// IMPORTANT: default value is {} to avoid crashes if Provider isn't mounted yet
export const MarketplaceContext = React.createContext<MarketplaceContextValue>({});
