import { Router, Request, Response } from 'express';
import { uploadToShelby, batchUploadToShelby } from '../services/shelby';

const router = Router();

/**
 * POST /api/shelby/upload
 * Upload a single file to Shelby
 */
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { fileBase64, fileName, mimeType, namespace } = req.body;

    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const fileBuffer = Buffer.from(fileBase64, 'base64');

    const result = await uploadToShelby({
      file: fileBuffer,
      fileName,
      mimeType: mimeType || 'application/octet-stream',
      namespace,
    });

    res.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * POST /api/shelby/batch-upload
 * Batch upload multiple files to Shelby
 */
router.post('/batch-upload', async (req: Request, res: Response) => {
  try {
    const { files, namespace } = req.body;

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const shelbyFiles = files.map((file: any) => ({
      file: Buffer.from(file.fileBase64, 'base64'),
      fileName: file.fileName,
      mimeType: file.mimeType || 'application/octet-stream',
      namespace,
    }));

    const results = await batchUploadToShelby(shelbyFiles);

    res.json({ files: results });
  } catch (error) {
    console.error('Batch upload error:', error);
    res.status(500).json({ error: 'Batch upload failed' });
  }
});

export default router;
