// Constants used across the application

export const APTOS_NETWORKS = {
  MAINNET: 'mainnet',
  TESTNET: 'testnet',
  DEVNET: 'devnet',
} as const;

export const SHELBY_CONFIG = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  SUPPORTED_FORMATS: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/json'],
  BATCH_UPLOAD_LIMIT: 10,
} as const;

export const MINT_DEFAULTS = {
  MIN_SUPPLY: 1,
  MAX_SUPPLY: 1000000,
  DEFAULT_ROYALTY_BPS: 500, // 5%
  MAX_ROYALTY_BPS: 10000, // 100%
} as const;

export const UI_CONSTANTS = {
  NOTIFICATION_TIMEOUT: 5000,
  DEBOUNCE_DELAY: 300,
  LOADING_TIMEOUT: 30000,
} as const;

export const API_ENDPOINTS = {
  SHELBY_UPLOAD: '/api/shelby/upload',
  SHELBY_BATCH_UPLOAD: '/api/shelby/batch-upload',
  NFT_CREATE_COLLECTION: '/api/nft/create-collection',
  NFT_CREATE_METADATA: '/api/nft/create-metadata',
} as const;
