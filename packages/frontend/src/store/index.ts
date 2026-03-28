// Global app store using Zustand with persistence
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { NFTCollection, User, UploadProgress } from '@/types';

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

  // Dashboard cache (60s TTL)
  dashboardCache: DashboardCache | null;
  lastDashboardFetch: number;

  // UI state
  isLoading: boolean;
  uploadProgress: Record<string, UploadProgress>;
  notification: {
    type: 'success' | 'error' | 'info';
    message: string;
  } | null;

  // Actions
  setWalletAddress: (address: string | null) => void;
  setIsConnecting: (value: boolean) => void;
  setUser: (user: User | null) => void;
  setCollections: (collections: NFTCollection[]) => void;
  setSelectedCollection: (collection: NFTCollection | null) => void;
  setIsLoading: (value: boolean) => void;
  setUploadProgress: (fileName: string, progress: UploadProgress) => void;
  clearUploadProgress: (fileName: string) => void;
  setNotification: (notification: AppState['notification']) => void;
  clearNotification: () => void;
  addCollection: (collection: NFTCollection) => void;
  updateCollection: (id: string, updates: Partial<NFTCollection>) => void;
  removeCollection: (collectionId: string) => void;
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
      isLoading: false,
      uploadProgress: {},
      notification: null,

      setWalletAddress: (address) => set({ walletAddress: address }),
      setIsConnecting: (value) => set({ isConnecting: value }),
      setUser: (user) => set({ user }),
      setCollections: (collections) => set({ collections }),
      setSelectedCollection: (collection) => set({ selectedCollection: collection }),
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
      addCollection: (collection) =>
        set((state) => ({
          collections: [...state.collections, collection],
        })),
      updateCollection: (id, updates) =>
        set((state) => ({
          collections: state.collections.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
      removeCollection: (collectionId) =>
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== collectionId),
        })),
      setDashboardCache: (cache) =>
        set({
          dashboardCache: cache,
          lastDashboardFetch: Date.now(),
        }),
      isDashboardCacheValid: () => {
        const state = get();
        const now = Date.now();
        const CACHE_TTL = 60000; // 60 seconds
        return !!(
          state.dashboardCache &&
          now - state.lastDashboardFetch < CACHE_TTL
        );
      },
    }),
    {
      name: 'nfts2me-store',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? window.localStorage
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      ),
      // Only persist collections and wallet address across refreshes
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        collections: state.collections,
      }),
    }
  )
);
