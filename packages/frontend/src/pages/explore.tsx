import React, { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useAppStore } from '@/store';
import { Navigation } from '@/components/Navigation';
import { getAccountBalance } from '@/utils/aptos';

export const getServerSideProps = async () => ({ props: {} });

// ─── Featured / Demo Collections ─────────────────────────────────────────────
const FEATURED_COLLECTIONS = [
  {
    id: 'featured-1',
    name: 'Neon Horizons',
    description: 'Cyberpunk cityscapes frozen in time — each piece a window into a world where neon never sleeps.',
    imageUrl: 'https://picsum.photos/seed/neon1/400/400',
    supply: 100,
    minted: 67,
    mintPrice: 0.5,
    royaltyBps: 500,
    creator: '0xd3ad...beef',
    category: 'Art',
    featured: true,
  },
  {
    id: 'featured-2',
    name: 'Aptos Apes',
    description: 'A collection of 50 unique apes living on the Aptos blockchain. Each one hand-crafted with rare traits.',
    imageUrl: 'https://picsum.photos/seed/apes2/400/400',
    supply: 50,
    minted: 50,
    mintPrice: 1.0,
    royaltyBps: 750,
    creator: '0xc0ff...ee42',
    category: 'PFP',
    featured: true,
  },
  {
    id: 'featured-3',
    name: 'Shelby Gems',
    description: 'Precious on-chain gems powered by Shelby Protocol storage. Pure 1/1 masterpieces.',
    imageUrl: 'https://picsum.photos/seed/gems3/400/400',
    supply: 1,
    minted: 0,
    mintPrice: 0,
    royaltyBps: 1000,
    creator: '0xa1b2...c3d4',
    category: '1/1',
    featured: true,
  },
  {
    id: 'featured-4',
    name: 'Digital Fauna',
    description: 'Endangered species reimagined as digital art. 10% of mint proceeds go to wildlife conservation.',
    imageUrl: 'https://picsum.photos/seed/fauna4/400/400',
    supply: 200,
    minted: 43,
    mintPrice: 0.2,
    royaltyBps: 300,
    creator: '0xf00d...1234',
    category: 'Charity',
    featured: false,
  },
  {
    id: 'featured-5',
    name: 'Void Walkers',
    description: 'Abstract entities from the void between blockchains. Generative art minted on demand.',
    imageUrl: 'https://picsum.photos/seed/void5/400/400',
    supply: 999,
    minted: 120,
    mintPrice: 0.1,
    royaltyBps: 250,
    creator: '0x1337...abcd',
    category: 'Generative',
    featured: false,
  },
  {
    id: 'featured-6',
    name: 'Pixel Punks APT',
    description: 'Classic pixel art meets Aptos DeFi. 24x24 punks with on-chain rarity scores.',
    imageUrl: 'https://picsum.photos/seed/punks6/400/400',
    supply: 10000,
    minted: 4231,
    mintPrice: 0.05,
    royaltyBps: 200,
    creator: '0xdead...c0de',
    category: 'Pixel',
    featured: false,
  },
];

const CATEGORIES = ['All', 'Art', 'PFP', '1/1', 'Generative', 'Pixel', 'Charity'];

// ─── Collection Card ──────────────────────────────────────────────────────────
function ExploreCard({ col, userCollections }: { col: any; userCollections: any[] }) {
  const isSoldOut = col.minted >= col.supply;
  const isOneOfOne = col.supply === 1;
  const progress = Math.min(100, Math.round((col.minted / col.supply) * 100));

  // Check if this is a user-created collection (has matching name in store)
  const localCol = userCollections.find((c) => c.name === col.name);
  const mintHref = localCol
    ? `/mint/${encodeURIComponent(col.name)}`
    : `/mint/${encodeURIComponent(col.name)}`;

  return (
    <div className="group relative bg-slate-900/60 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-900/20 transition-all duration-300">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-slate-800">
        <img
          src={col.imageUrl}
          alt={col.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).onerror = null;
            (e.target as HTMLImageElement).src =
              'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUyOTNiIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iNjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn5aePC90ZXh0Pjwvc3ZnPg==';
          }}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {col.featured && (
            <span className="px-2 py-0.5 bg-yellow-500/90 text-yellow-900 text-[10px] font-bold rounded-full">
              ⭐ Featured
            </span>
          )}
          {isOneOfOne && (
            <span className="px-2 py-0.5 bg-purple-600/90 text-white text-[10px] font-bold rounded-full">
              💎 1/1
            </span>
          )}
          {isSoldOut && (
            <span className="px-2 py-0.5 bg-red-600/90 text-white text-[10px] font-bold rounded-full">
              Sold Out
            </span>
          )}
        </div>

        {/* Category */}
        <div className="absolute top-3 right-3">
          <span className="px-2 py-0.5 bg-slate-900/80 backdrop-blur-sm text-slate-300 text-[10px] font-medium rounded-full border border-slate-600/50">
            {col.category}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-bold text-white text-base truncate pr-2">{col.name}</h3>
          <span className="text-xs text-purple-300 font-semibold whitespace-nowrap">
            {col.mintPrice === 0 ? 'Free' : `${col.mintPrice} APT`}
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">{col.description}</p>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
            <span>{col.minted} minted</span>
            <span>{col.supply} supply</span>
          </div>
          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isSoldOut ? 'bg-red-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Creator + royalty */}
        <div className="flex justify-between text-[11px] text-slate-600 mb-4">
          <span className="font-mono">{col.creator}</span>
          <span>{col.royaltyBps / 100}% royalty</span>
        </div>

        {/* CTA */}
        <a
          href={mintHref}
          className={`block w-full py-2.5 text-center text-sm font-bold rounded-xl transition-all ${
            isSoldOut
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed pointer-events-none'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/30'
          }`}
        >
          {isSoldOut ? '🚫 Sold Out' : isOneOfOne ? '💎 Mint 1/1' : `🎨 Mint Now`}
        </a>
      </div>
    </div>
  );
}

// ─── Hero Stats ───────────────────────────────────────────────────────────────
function HeroStats({ total, active, volume }: { total: number; active: number; volume: string }) {
  return (
    <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
      {[
        { label: 'Collections', value: total },
        { label: 'Active Mints', value: active },
        { label: 'Volume', value: volume },
      ].map((s) => (
        <div key={s.label} className="text-center p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl">
          <div className="text-xl font-bold text-white">{s.value}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ExplorePage() {
  const { account } = useWallet();
  const { collections } = useAppStore();
  const [balance, setBalance] = useState('0');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'trending' | 'newest' | 'price_asc' | 'price_desc'>('trending');
  const [showUserOnly, setShowUserOnly] = useState(false);

  const currentAddress = account?.address ? String(account.address) : null;

  useEffect(() => {
    if (!currentAddress) return;
    getAccountBalance(currentAddress).then((bal) =>
      setBalance((Number(bal) / 1e8).toFixed(4))
    );
  }, [currentAddress]);

  // Merge user collections into the explore feed
  const allCollections = React.useMemo(() => {
    const userCols = collections.map((c) => ({
      ...c,
      category: c.supply === 1 ? '1/1' : 'Art',
      featured: false,
      creator: c.creator || currentAddress || '0xYou',
    }));

    // Deduplicate by name (prefer user version if same name)
    const userNames = new Set(userCols.map((c) => c.name));
    const filtered = FEATURED_COLLECTIONS.filter((f) => !userNames.has(f.name));

    return [...userCols, ...filtered];
  }, [collections, currentAddress]);

  const filtered = React.useMemo(() => {
    let list = showUserOnly
      ? allCollections.filter((c) => collections.some((uc) => uc.name === c.name))
      : allCollections;

    if (category !== 'All') {
      list = list.filter((c) => (c as any).category === category);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        list = [...list].sort((a, b) => ((b as any).createdAt || 0) - ((a as any).createdAt || 0));
        break;
      case 'price_asc':
        list = [...list].sort((a, b) => a.mintPrice - b.mintPrice);
        break;
      case 'price_desc':
        list = [...list].sort((a, b) => b.mintPrice - a.mintPrice);
        break;
      default: // trending — featured first, then by mint ratio
        list = [...list].sort((a, b) => {
          if ((a as any).featured && !(b as any).featured) return -1;
          if (!(a as any).featured && (b as any).featured) return 1;
          return b.minted / b.supply - a.minted / a.supply;
        });
    }

    return list;
  }, [allCollections, category, search, sortBy, showUserOnly, collections]);

  const activeCount = allCollections.filter((c) => c.minted < c.supply).length;
  const totalVolume = allCollections
    .reduce((sum, c) => sum + c.minted * c.mintPrice, 0)
    .toFixed(1);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation balance={balance} />

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
        <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full border border-purple-500/30">
          <span className="text-purple-300 text-xs font-semibold">🌐 Community NFT Marketplace</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent mb-4">
          Explore & Mint
        </h1>
        <p className="text-slate-400 text-base mb-8 max-w-xl mx-auto">
          Discover NFT collections created by the community on Aptos Testnet. Browse, explore, and mint your favorites.
        </p>
        <HeroStats total={allCollections.length} active={activeCount} volume={`${totalVolume} APT`} />
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Search collections..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-600 hover:border-slate-500 focus:border-purple-500 focus:outline-none rounded-xl text-white text-sm placeholder-slate-500 transition"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2.5 bg-slate-800 border border-slate-600 hover:border-slate-500 focus:border-purple-500 focus:outline-none rounded-xl text-white text-sm transition cursor-pointer"
            >
              <option value="trending">🔥 Trending</option>
              <option value="newest">🆕 Newest</option>
              <option value="price_asc">💸 Price: Low → High</option>
              <option value="price_desc">💰 Price: High → Low</option>
            </select>

            {/* My collections toggle */}
            {collections.length > 0 && (
              <button
                onClick={() => setShowUserOnly(!showUserOnly)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                  showUserOnly
                    ? 'bg-purple-600 text-white border border-purple-500'
                    : 'bg-slate-800 border border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                {showUserOnly ? '✅ My Collections' : '👤 My Collections'}
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  category === cat
                    ? 'bg-purple-600 text-white border border-purple-500'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-white mb-2">No collections found</h3>
            <p className="text-slate-400 mb-6">Try adjusting your search or filters.</p>
            <button
              onClick={() => { setSearch(''); setCategory('All'); setShowUserOnly(false); }}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <p className="text-slate-400 text-sm">
                Showing <span className="text-white font-semibold">{filtered.length}</span> collections
              </p>
              <a
                href="/create"
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-semibold rounded-xl transition"
              >
                + Add Your Collection
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((col) => (
                <ExploreCard key={(col as any).id || col.name} col={col} userCollections={collections} />
              ))}
            </div>
          </>
        )}

        {/* CTA footer banner */}
        <div className="mt-16 rounded-2xl bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-purple-900/40 border border-purple-500/30 p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Have your own NFT collection?</h2>
          <p className="text-slate-400 mb-6">
            Launch your collection on Aptos in minutes — no code required. Powered by Shelby Protocol storage.
          </p>
          <a
            href="/create"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl transition hover:shadow-xl hover:shadow-purple-500/30"
          >
            🎨 Create Collection
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>
            Built on{' '}
            <a href="https://aptos.dev" className="text-purple-400 hover:text-purple-300" target="_blank">
              Aptos
            </a>{' '}
            · Storage by{' '}
            <a href="https://docs.shelby.xyz" className="text-purple-400 hover:text-purple-300" target="_blank">
              Shelby Protocol
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
