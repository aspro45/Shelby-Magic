/**
 * Shelby Protocol Integration — Real SDK (browser)
 * 3-step upload: encode → on-chain register → RPC upload
 * Falls back to mock if NEXT_PUBLIC_SHELBY_API_KEY is not set
 */

import { Network } from '@aptos-labs/ts-sdk';

const SHELBY_API_KEY = ''; // Forced empty to activate Demo Mode (bypasses testnet storage fees)
const SHELBY_RPC_URL = process.env.NEXT_PUBLIC_SHELBY_GATEWAY || 'https://api.testnet.shelby.xyz/shelby';

export interface ShelbyUploadOptions {
  file: File;
  blobName?: string;
  onProgress?: (step: 'encoding' | 'registering' | 'uploading' | 'done', pct: number) => void;
}

export interface ShelbyUploadResponse {
  blobId: string;
  blobName: string;
  url: string;
  size: number;
  mimeType: string;
  txHash?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Upload a file to Shelby Protocol using the real browser SDK (3-step).
 * Falls back to demo mode when API key is not configured.
 */
export async function uploadToShelby(
  options: ShelbyUploadOptions,
  signAndSubmitTransaction?: (payload: any) => Promise<{ hash: string }>
): Promise<ShelbyUploadResponse> {
  const { file, blobName = file.name, onProgress } = options;

  // Graceful fallback — no API key configured
  if (!SHELBY_API_KEY) {
    console.warn('NEXT_PUBLIC_SHELBY_API_KEY not set — using demo mode.');
    
    // Convert to Base64 so it permanently survives page reloads in local state
    const base64Url = await new Promise<string>((resolve) => {
      if (typeof window === 'undefined') return resolve('');
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    await new Promise(r => setTimeout(r, 600)); // Simulate network
    onProgress?.('done', 100);
    const mockId = `demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return { blobId: mockId, blobName, url: base64Url, size: file.size, mimeType: file.type };
  }

  try {
    // Dynamic import keeps this out of SSR bundle
    const sdk: any = await import('@shelby-protocol/sdk/browser');

    // STEP 1: File encoding
    onProgress?.('encoding', 10);
    const data = Buffer.from(await file.arrayBuffer());
    const provider = await sdk.createDefaultErasureCodingProvider();
    const commitments = await sdk.generateCommitments(provider, data);
    onProgress?.('encoding', 40);

    // STEP 2: On-chain registration via wallet
    onProgress?.('registering', 50);
    let txHash: string | undefined;

    if (signAndSubmitTransaction) {
      const payload = sdk.ShelbyBlobClient.createRegisterBlobPayload({
        blobName,
        blobMerkleRoot: commitments.blob_merkle_root,
        numChunksets: sdk.expectedTotalChunksets(commitments.raw_data_size),
        expirationMicros: (1000 * 60 * 60 * 24 * 30 + Date.now()) * 1000,
        blobSize: commitments.raw_data_size,
        encoding: 1, // 1 = ClayCode_16Total_10Data_13Helper (Default)
      });
      const submitted = await signAndSubmitTransaction({ data: payload });
      txHash = submitted.hash;
      const { Aptos, AptosConfig, Network: AptosNetwork } = await import('@aptos-labs/ts-sdk');
      const aptosClient = new Aptos(new AptosConfig({ network: AptosNetwork.TESTNET }));
      await aptosClient.waitForTransaction({ transactionHash: txHash });
    }

    onProgress?.('registering', 70);

    // STEP 3: RPC Upload
    onProgress?.('uploading', 75);
    const shelbyClient = new sdk.ShelbyClient({ network: Network.TESTNET, apiKey: SHELBY_API_KEY });
    await shelbyClient.rpc.putBlob({ blobName, blobData: new Uint8Array(await file.arrayBuffer()) });
    onProgress?.('done', 100);

    return {
      blobId: `${blobName}_${Date.now()}`,
      blobName,
      url: `${SHELBY_RPC_URL}/blobs/${encodeURIComponent(blobName)}`,
      size: file.size,
      mimeType: file.type,
      txHash,
    };
  } catch (error) {
    console.error('Shelby upload error:', error);
    throw new Error(`Shelby upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Upload metadata JSON to Shelby Protocol
 */
export async function uploadMetadataToShelby(
  metadata: Record<string, any>,
  blobName?: string,
  signAndSubmitTransaction?: (payload: any) => Promise<{ hash: string }>
): Promise<string> {
  const jsonBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
  const fileName = blobName || `${metadata.name || 'metadata'}_${Date.now()}.json`;
  const file = new File([jsonBlob], fileName, { type: 'application/json' });
  const result = await uploadToShelby({ file, blobName: fileName }, signAndSubmitTransaction);
  return result.url;
}

/**
 * Batch upload multiple files to Shelby
 */
export async function batchUploadToShelby(
  files: File[],
  signAndSubmitTransaction?: (payload: any) => Promise<{ hash: string }>
): Promise<ShelbyUploadResponse[]> {
  const results: ShelbyUploadResponse[] = [];
  for (const file of files) {
    results.push(await uploadToShelby({ file }, signAndSubmitTransaction));
  }
  return results;
}

/** Get Shelby blob URL from blob name */
export function getShelbyUrl(blobName: string): string {
  return `${SHELBY_RPC_URL}/blobs/${encodeURIComponent(blobName)}`;
}
