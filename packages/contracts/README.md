# Smart Contracts (Move on Aptos)

Aptos Move smart contracts for NFT collection creation and minting.

## Structure

- `sources/nft_collection.move` - Main NFT collection contract
- `sources/royalty.move` - Royalty management
- `Move.toml` - Move package manifest

## Building

```bash
aptos move compile --package-dir .
```

## Testing

```bash
aptos move test --package-dir .
```

## Publishing

```bash
aptos move publish --package-dir . --named-addresses nft_collection=0xYOUR_ADDRESS
```

## Key Functions

- `create_collection()` - Create new NFT collection
- `mint_nft()` - Mint NFT from collection
- `transfer_nft()` - Transfer NFT ownership
- `burn_nft()` - Burn NFT (optional)
