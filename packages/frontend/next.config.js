/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prevent Next.js SSR bundler from importing Node-only packages (e.g. `got` in @aptos-labs/aptos-client)
  serverExternalPackages: [
    '@aptos-labs/aptos-client',
    '@aptos-labs/ts-sdk',
    '@aptos-labs/wallet-adapter-react',
    'got',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.shelby.xyz' },
      { protocol: 'https', hostname: 'api.testnet.shelby.xyz' },
      { protocol: 'https', hostname: '**.ipfs.io' },
      { protocol: 'https', hostname: 'explorer.aptoslabs.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  env: {
    NEXT_PUBLIC_APTOS_NETWORK: process.env.NEXT_PUBLIC_APTOS_NETWORK || 'testnet',
    NEXT_PUBLIC_SHELBY_GATEWAY: process.env.NEXT_PUBLIC_SHELBY_GATEWAY || 'https://api.testnet.shelby.xyz/shelby',
  },
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
