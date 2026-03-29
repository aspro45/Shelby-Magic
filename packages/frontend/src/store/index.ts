// Global app store using Zustand with persistence
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ─── SSR-safe storage helper ─────────────────────────────────────────────────
const safeStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

import type { NFTCollection, User, UploadProgress } from '@/types';

// ─── Marketplace Types ────────────────────────────────────────────────────────
export interface MarketListing {
  id: string;
  tokenId: string;
  tokenName: string;
  collectionName: string;
  imageUrl: string;
  seller: string;
  priceApt: number;
  description?: string;
  createdAt: number;
  status: 'active' | 'sold' | 'cancelled';
  txHash?: string;
}

export interface MarketOffer {
  id: string;
  listingId: string;
  tokenId: string;
  collectionName: string;
  tokenName: string;
  buyer: string;
  priceApt: number;
  message?: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
}

interface DashboardCache {
  balance: string;
  txCount: number;
  recentTxs: any[];
  networkStats: { blockHeight: number; version: string } | null;
  ownedNFTs: any[];
  onChainCollections: any[];
  timestamp: number;
}

interface AppState {
  // Wallet
  walletAddress: string | null;
  isConnecting: boolean;

  // User data
  user: User | null;

  // Collections
  collections: NFTCollection[];
  selectedCollection: NFTCollection | null;

  // Dashboard cache
  dashboardCache: DashboardCache | null;
  lastDashboardFetch: number;

  // Marketplace
  listings: MarketListing[];
  offers: MarketOffer[];

  // UI state
  isLoading: boolean;
  uploadProgress: Record<string, UploadProgress>;
  notification: {
    type: 'success' | 'error' | 'info';
    message: string;
  } | null;

  // Actions — wallet
  setWalletAddress: (address: string | null) => void;
  setIsConnecting: (value: boolean) => void;
  setUser: (user: User | null) => void;

  // Actions — collections
  setCollections: (collections: NFTCollection[]) => void;
  setSelectedCollection: (collection: NFTCollection | null) => void;
  addCollection: (collection: NFTCollection) => void;
  updateCollection: (id: string, updates: Partial<NFTCollection>) => void;
  removeCollection: (collectionId: string) => void;

  // Actions — marketplace listings
  addListing: (listing: MarketListing) => void;
  updateListing: (id: string, updates: Partial<MarketListing>) => void;
  removeListing: (id: string) => void;

  // Actions — marketplace offers
  addOffer: (offer: MarketOffer) => void;
  updateOffer: (id: string, updates: Partial<MarketOffer>) => void;

  // Actions — UI
  setIsLoading: (value: boolean) => void;
  setUploadProgress: (fileName: string, progress: UploadProgress) => void;
  clearUploadProgress: (fileName: string) => void;
  setNotification: (notification: AppState['notification']) => void;
  clearNotification: () => void;
  setDashboardCache: (cache: DashboardCache) => void;
  isDashboardCacheValid: () => boolean;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      walletAddress: null,
      isConnecting: false,
      user: null,
      collections: [],
      selectedCollection: null,
      dashboardCache: null,
      lastDashboardFetch: 0,
      listings: [],
      offers: [],
      isLoading: false,
      uploadProgress: {},
      notification: null,

      setWalletAddress: (address) => set({ walletAddress: address }),
      setIsConnecting: (value) => set({ isConnecting: value }),
      setUser: (user) => set({ user }),
      setCollections: (collections) => set({ collections }),
      setSelectedCollection: (collection) => set({ selectedCollection: collection }),

      addCollection: (collection) =>
        set((state) => ({ collections: [...state.collections, collection] })),
      updateCollection: (id, updates) =>
        set((state) => ({
          collections: state.collections.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
      removeCollection: (collectionId) =>
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== collectionId),
        })),

      addListing: (listing) =>
        set((state) => ({ listings: [listing, ...state.listings] })),
      updateListing: (id, updates) =>
        set((state) => ({
          listings: state.listings.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        })),
      removeListing: (id) =>
        set((state) => ({ listings: state.listings.filter((l) => l.id !== id) })),

      addOffer: (offer) =>
        set((state) => ({ offers: [offer, ...state.offers] })),
      updateOffer: (id, updates) =>
        set((state) => ({
          offers: state.offers.map((o) => (o.id === id ? { ...o, ...updates } : o)),
        })),

      setIsLoading: (value) => set({ isLoading: value }),
      setUploadProgress: (fileName, progress) =>
        set((state) => ({
          uploadProgress: { ...state.uploadProgress, [fileName]: progress },
        })),
      clearUploadProgress: (fileName) =>
        set((state) => {
          const next = { ...state.uploadProgress };
          delete next[fileName];
          return { uploadProgress: next };
        }),
      setNotification: (notification) => set({ notification }),
      clearNotification: () => set({ notification: null }),
      setDashboardCache: (cache) =>
        set({ dashboardCache: cache, lastDashboardFetch: Date.now() }),
      isDashboardCacheValid: () => {
        const state = get();
        const CACHE_TTL = 60000;
        return !!(state.dashboardCache && Date.now() - state.lastDashboardFetch < CACHE_TTL);
      },
    }),
    {
      name: 'nfts2me-store',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        collections: state.collections,
        listings: state.listings,
        offers: state.offers,
      }),
    }
  )
);
