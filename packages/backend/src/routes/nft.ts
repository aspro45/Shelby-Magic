import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POST /api/nft/create-collection
 * Create NFT collection metadata
 */
router.post('/create-collection', async (req: Request, res: Response) => {
  try {
    const { name, description, imageUrl, symbol, supply, royaltyBps } = req.body;

    const metadata = {
      name,
      description,
      image: imageUrl,
      properties: {
        symbol,
        supply,
        royaltyBps,
        creator: req.body.creator,
        createdAt: new Date().toISOString(),
      },
      external_url: process.env.APP_URL || 'https://nfts2me-aptos.example.com',
    };

    res.json(metadata);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create collection metadata' });
  }
});

/**
 * POST /api/nft/create-metadata
 * Create NFT metadata for individual NFT
 */
router.post('/create-metadata', async (req: Request, res: Response) => {
  try {
    const { name, description, imageUrl, attributes } = req.body;

    const metadata = {
      name,
      description,
      image: imageUrl,
      attributes: attributes || [],
      properties: {
        creator: req.body.creator,
        createdAt: new Date().toISOString(),
      },
    };

    res.json(metadata);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create NFT metadata' });
  }
});

export default router;
