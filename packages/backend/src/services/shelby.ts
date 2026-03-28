// Shelby Protocol Service
// Server-side integration for uploading to Shelby with API key

import axios from 'axios';

const SHELBY_API_URL = process.env.SHELBY_API_URL || 'https://api.shelby.xyz';
const SHELBY_API_KEY = process.env.SHELBY_API_KEY;

if (!SHELBY_API_KEY) {
  console.warn('⚠️  SHELBY_API_KEY not set. Shelby uploads will fail.');
}

export interface ShelbyUploadRequest {
  file: Buffer;
  fileName: string;
  mimeType: string;
  namespace?: string;
}

export interface ShelbyUploadResponse {
  id: string;
  url: string;
  size: number;
  hash: string;
}

/**
 * Upload file to Shelby Protocol
 */
export async function uploadToShelby(request: ShelbyUploadRequest): Promise<ShelbyUploadResponse> {
  const { file, fileName, mimeType, namespace = 'nfts' } = request;

  const formData = new FormData();
  const blob = new Blob([file], { type: mimeType });
  formData.append('file', blob, fileName);
  formData.append('namespace', namespace);

  try {
    const response = await axios.post(`${SHELBY_API_URL}/api/v1/blobs/upload`, formData, {
      headers: {
        Authorization: `Bearer ${SHELBY_API_KEY}`,
        'Content-Type': 'multipart/form-data',
      },
    });

    return {
      id: response.data.id,
      url: response.data.url,
      size: response.data.size,
      hash: response.data.hash,
    };
  } catch (error) {
    console.error('Shelby upload error:', error);
    throw new Error(`Failed to upload to Shelby: ${error}`);
  }
}

/**
 * Batch upload files to Shelby
 */
export async function batchUploadToShelby(
  files: ShelbyUploadRequest[]
): Promise<ShelbyUploadResponse[]> {
  const uploads = files.map(file => uploadToShelby(file));
  return Promise.all(uploads);
}

/**
 * Fetch blob from Shelby
 */
export async function fetchBlobFromShelby(blobId: string): Promise<Buffer> {
  try {
    const response = await axios.get(`${SHELBY_API_URL}/api/v1/blobs/${blobId}`, {
      headers: {
        Authorization: `Bearer ${SHELBY_API_KEY}`,
      },
      responseType: 'arraybuffer',
    });

    return Buffer.from(response.data);
  } catch (error) {
    console.error('Shelby fetch error:', error);
    throw new Error(`Failed to fetch from Shelby: ${error}`);
  }
}

/**
 * Delete blob from Shelby
 */
export async function deleteBlobFromShelby(blobId: string): Promise<void> {
  try {
    await axios.delete(`${SHELBY_API_URL}/api/v1/blobs/${blobId}`, {
      headers: {
        Authorization: `Bearer ${SHELBY_API_KEY}`,
      },
    });
  } catch (error) {
    console.error('Shelby delete error:', error);
    throw new Error(`Failed to delete from Shelby: ${error}`);
  }
}
