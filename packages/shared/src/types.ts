// Shared types used across frontend and backend

export interface NFTCollection {
  id: string;
  name: string;
  description: string;
  symbol: string;
  creator: string;
  imageUrl: string;
  contractAddress?: string;
  supply: number;
  minted: number;
  royaltyBps: number;
  createdAt: number;
  updatedAt: number;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties?: Record<string, any>;
}

export interface MintPhase {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  maxPerWallet: number;
  price: number;
  isActive: boolean;
  whitelistOnly?: boolean;
}

export interface ShelbyBlob {
  blobId: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
  namespace?: string;
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export interface User {
  address: string;
  totalMinted: number;
  ownedCollections: string[];
  lastMintTime?: number;
}

export interface ShelbyUploadResponse {
  id: string;
  url: string;
  size: number;
  hash: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}
