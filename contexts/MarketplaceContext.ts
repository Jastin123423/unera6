// contexts/MarketplaceContext.ts
import React from "react";

export type MarketplaceContextValue = {
  openProductById?: (productId: number) => void;
  getProductById?: (productId: number) => any | null;
  activeProductId?: number | null;

  // allow future extensions safely
  [key: string]: any;
};

export const MarketplaceContext = React.createContext<MarketplaceContextValue>({});
