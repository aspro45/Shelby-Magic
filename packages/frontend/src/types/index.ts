// Types for NFT Collection and Metadata
export interface NFTCollection {
  id: string;
  name: string;
  description: string;
  symbol: string;
  creator: string;
  imageUrl: string; // Shelby blob URL
  contractAddress?: string;
  collectionAddress?: string; // On-chain collection object address
  txHash?: string; // Creation transaction hash
  supply: number;
  minted: number;
  royaltyBps: number;
  mintPrice: number; // In APT (0 = free mint)
  createdAt: number;
  updatedAt: number;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string; // Shelby blob URL
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
  price: number; // in APT
  isActive: boolean;
  whitelistOnly?: boolean;
}

export interface ShelbyBlob {
  blobId: string;
  blobName: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
  txHash?: string;
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'encoding' | 'registering' | 'uploading' | 'success' | 'error';
  error?: string;
}

export interface User {
  address: string;
  totalMinted: number;
  ownedCollections: string[];
  lastMintTime?: number;
}
