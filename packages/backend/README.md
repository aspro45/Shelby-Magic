# Backend Server

Node.js/Express API server for NFT minting platform.

## Features

- Shelby Protocol integration for file upload
- NFT metadata creation
- Aptos contract interaction (optional)
- CORS enabled for frontend communication

## Setup

```bash
npm install
```

## Environment Variables

Create `.env`:

```env
NODE_ENV=development
PORT=3001
SHELBY_API_KEY=your_key
SHELBY_API_URL=https://api.shelby.xyz
APP_URL=http://localhost:3000
```

## Running

```bash
npm run dev      # Development
npm run build    # Build
npm start        # Production
```

## API Endpoints

### Shelby Storage

- `POST /api/shelby/upload` - Upload single file
- `POST /api/shelby/batch-upload` - Upload multiple files

### NFT Metadata

- `POST /api/nft/create-collection` - Create collection metadata
- `POST /api/nft/create-metadata` - Create NFT metadata
