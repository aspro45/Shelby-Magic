import React, { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useAppStore } from '@/store';
import { Navigation } from '@/components/Navigation';
import { getAccountBalance } from '@/utils/aptos';
import type { NFTCollection } from '@/types';

export const getServerSideProps = async () => ({ props: {} });

// ─── Aptos Indexer GraphQL ────────────────────────────────────────────────────
const INDEXER_URL = 'https://api.testnet.aptoslabs.com/v1/graphql';

/**
 * Fetches ALL collections created on Aptos testnet via the standard 0x4 token contract.
 * Uses the Aptos indexer GraphQL API — no mock data, fully live.
 */
async function fetchOnChainCollections(): Promise<any[]> {
  const query = `
    query ExploreCollections {
      current_collections_v2(
        where: {
          creator_address: { _is_null: false }
          collection_name: { _neq: "" }
        }
        order_by: { created_at_timestamp: desc }
        limit: 100
      ) {
        collection_id
        collection_name
        description
        uri
        creator_address
        max_supply
        current_supply
        created_at_timestamp
      }
    }
  `;

  try {
    const res = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    return json?.data?.current_collections_v2 ?? [];
  } catch (err) {
    console.error('Indexer fetch error:', err);
    return [];
  }
}

/**
 * Merge on-chain indexer data with the local Zustand store.
 * The local store holds richer metadata: imageUrl (Shelby URL), mintPrice, royaltyBps, txHash.
 * On-chain is the source of truth for: name, creator, supply, minted count.
 */
function mergeCollections(onChain: any[], local: NFTCollection[]): any[] {
  // Build lookup maps for O(1) matching
  const localByCreatorAndName = new Map(
    local.map((c) => [`${c.creator?.toLowerCase()}::${c.name.toLowerCase()}`, c])
  );
  const localByName = new Map(local.map((c) => [c.name.toLowerCase(), c]));

  return onChain.map((oc) => {
    const key = `${oc.creator_address?.toLowerCase()}::${oc.collection_name?.toLowerCase()}`;
    const localMatch =
      localByCreatorAndName.get(key) ||
      localByName.get(oc.collection_name?.toLowerCase());

    const supply = Number(oc.max_supply) || 1;
    const minted = Number(oc.current_supply) || 0;

    return {
      id: oc.collection_id,
      name: oc.collection_name,
      description: oc.description || '',
      creator: oc.creator_address,
      supply,
      minted,
      createdAt: oc.created_at_timestamp
        ? new Date(oc.created_at_timestamp).getTime()
        : 0,
      // Prefer local store values for these — on-chain URI may be metadata JSON
      imageUrl: localMatch?.imageUrl || '',
      mintPrice: localMatch?.mintPrice ?? 0,
      royaltyBps: localMatch?.royaltyBps ?? 0,
      txHash: localMatch?.txHash,
      isLocal: !!localMatch,
      onChainUri: oc.uri,
    };
  });
}

const CATEGORIES = ['All', 'Free', 'Paid', '1/1', 'Edition'];

// ─── Collection Card ──────────────────────────────────────────────────────────
function ExploreCard({ col }: { col: any }) {
  const isSoldOut = col.minted >= col.supply;
  const isOneOfOne = col.supply === 1;
  const progress = col.supply > 0 ? Math.min(100, Math.round((col.minted / col.supply) * 100)) : 0;
  const shortAddr = col.creator
    ? `${col.creator.slice(0, 6)}…${col.creator.slice(-4)}`
    : 'Unknown';

  return (
    <div className="group relative bg-slate-900/60 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-900/20 transition-all duration-300">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-slate-800">
        {col.imageUrl ? (
          <img
            src={col.imageUrl}
            alt={col.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={(e) => {
              const t = e.target as HTMLImageElement;
              t.onerror = null;
              t.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl opacity-20">🖼️</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap max-w-[calc(100%-4rem)]">
          {isOneOfOne && (
            <span className="px-2 py-0.5 bg-purple-600/90 backdrop-blur-sm text-white text-[10px] font-bold rounded-full">
              💎 1/1
            </span>
          )}
          {isSoldOut && (
            <span className="px-2 py-0.5 bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-bold rounded-full">
              Sold Out
            </span>
          )}
          {col.isLocal && (
            <span className="px-2 py-0.5 bg-green-600/90 backdrop-blur-sm text-white text-[10px] font-bold rounded-full">
              ✓ Yours
            </span>
          )}
        </div>

        {/* Price badge */}
        <div className="absolute top-3 right-3">
          <span className="px-2 py-0.5 bg-slate-900/80 backdrop-blur-sm text-xs font-semibold rounded-full border border-slate-600/50 text-purple-300">
            {col.mintPrice === 0 ? 'Free' : `${col.mintPrice} APT`}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-bold text-white text-base truncate mb-1">{col.name}</h3>

        {col.description && (
          <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">
            {col.description}
          </p>
        )}

        {/* Progress */}
        <div className="mb-3">
          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
            <span>{col.minted} minted</span>
            <span>{isOneOfOne ? '1 of 1' : `${col.supply} supply`}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isSoldOut ? 'bg-red-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Creator */}
        <div className="flex justify-between text-[11px] text-slate-600 mb-4">
          <a
            href={`https://explorer.aptoslabs.com/account/${col.creator}?network=testnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono hover:text-purple-400 transition truncate"
          >
            {shortAddr}
          </a>
          {col.royaltyBps > 0 && (
            <span>{(col.royaltyBps / 100).toFixed(1)}% royalty</span>
          )}
        </div>

        {/* CTA */}
        <a
          href={`/mint/${encodeURIComponent(col.name)}`}
          className={`block w-full py-2.5 text-center text-sm font-bold rounded-xl transition-all ${
            isSoldOut
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed pointer-events-none'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/30'
          }`}
        >
          {isSoldOut ? '🚫 Sold Out' : isOneOfOne ? '💎 Mint 1/1' : '🎨 Mint Now'}
        </a>
      </div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl overflow-hidden animate-pulse">
      <div className="aspect-square bg-slate-800" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-slate-700 rounded w-3/4" />
        <div className="h-3 bg-slate-800 rounded w-full" />
        <div className="h-3 bg-slate-800 rounded w-2/3" />
        <div className="h-1.5 bg-slate-700 rounded-full" />
        <div className="h-9 bg-slate-700 rounded-xl mt-4" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ExplorePage() {
  const { account } = useWallet();
  const { collections } = useAppStore();
  const [balance, setBalance] = useState('0');

  const [allCollections, setAllCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(0);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'trending' | 'price_asc' | 'price_desc'>('newest');
  const [showMine, setShowMine] = useState(false);

  const currentAddress = account?.address ? String(account.address) : null;

  useEffect(() => {
    if (!currentAddress) return;
    getAccountBalance(currentAddress).then((bal) =>
      setBalance((Number(bal) / 1e8).toFixed(4))
    );
  }, [currentAddress]);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const onChain = await fetchOnChainCollections();
      const merged = mergeCollections(onChain, collections);
      setAllCollections(merged);
      setLastRefresh(Date.now());
    } catch (err: any) {
      setError('Failed to load collections from Aptos indexer. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [collections]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Filter + sort
  const filtered = React.useMemo(() => {
    let list = allCollections;

    if (showMine && currentAddress) {
      list = list.filter(
        (c) => c.creator?.toLowerCase() === currentAddress.toLowerCase()
      );
    }

    if (category !== 'All') {
      list = list.filter((c) => {
        if (category === 'Free') return c.mintPrice === 0;
        if (category === 'Paid') return c.mintPrice > 0;
        if (category === '1/1') return c.supply === 1;
        if (category === 'Edition') return c.supply > 1;
        return true;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.creator?.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case 'newest':
        return [...list].sort((a, b) => b.createdAt - a.createdAt);
      case 'trending':
        return [...list].sort((a, b) => b.minted / b.supply - a.minted / a.supply);
      case 'price_asc':
        return [...list].sort((a, b) => a.mintPrice - b.mintPrice);
      case 'price_desc':
        return [...list].sort((a, b) => b.mintPrice - a.mintPrice);
      default:
        return list;
    }
  }, [allCollections, showMine, category, search, sortBy, currentAddress]);

  const activeCount = allCollections.filter((c) => c.minted < c.supply).length;
  const totalVolume = allCollections
    .reduce((sum, c) => sum + c.minted * (c.mintPrice || 0), 0)
    .toFixed(2);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation balance={balance} />

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
        <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full border border-purple-500/30">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <span className="text-purple-300 text-xs font-semibold">Live from Aptos Testnet Indexer</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent mb-4">
          Explore & Mint
        </h1>
        <p className="text-slate-400 text-base mb-8 max-w-xl mx-auto">
          Every collection here was deployed on-chain by real launchpad users. No mock data — 100% live from the Aptos blockchain.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
          {[
            { label: 'Collections', value: loading ? '…' : allCollections.length },
            { label: 'Active Mints', value: loading ? '…' : activeCount },
            { label: 'Est. Volume', value: loading ? '…' : `${totalVolume} APT` },
          ].map((s) => (
            <div key={s.label} className="text-center p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl">
              <div className="text-xl font-bold text-white">{s.value}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
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
                placeholder="Search by name, description, or wallet address…"
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
              <option value="newest">🆕 Newest First</option>
              <option value="trending">🔥 Trending</option>
              <option value="price_asc">💸 Price: Low → High</option>
              <option value="price_desc">💰 Price: High → Low</option>
            </select>

            {/* Refresh */}
            <button
              onClick={fetchCollections}
              disabled={loading}
              className="px-4 py-2.5 bg-slate-800 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white rounded-xl text-sm transition disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? '⏳ Loading…' : '↻ Refresh'}
            </button>
          </div>

          {/* Category pills */}
          <div className="flex gap-2 mt-3 flex-wrap items-center">
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

            {currentAddress && (
              <button
                onClick={() => setShowMine(!showMine)}
                className={`ml-auto px-3 py-1 rounded-full text-xs font-medium transition border ${
                  showMine
                    ? 'bg-green-700 text-white border-green-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
                }`}
              >
                {showMine ? '✅ My Collections' : '👤 My Collections'}
              </button>
            )}
          </div>

          {lastRefresh > 0 && !loading && (
            <p className="text-[11px] text-slate-600 mt-2">
              Synced from Aptos indexer · {new Date(lastRefresh).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/40 rounded-xl text-red-300 text-sm flex items-center gap-3">
            <span>⚠️</span>
            <span>{error}</span>
            <button onClick={fetchCollections} className="ml-auto underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">{allCollections.length === 0 ? '📭' : '🔍'}</div>
            <h3 className="text-xl font-bold text-white mb-2">
              {allCollections.length === 0
                ? 'No collections on-chain yet'
                : 'No collections match your filters'}
            </h3>
            <p className="text-slate-400 mb-6 text-sm max-w-sm mx-auto">
              {allCollections.length === 0
                ? 'Deploy the first collection and it will appear here automatically.'
                : 'Try adjusting your search or clearing filters.'}
            </p>
            <div className="flex gap-3 justify-center">
              {(search || category !== 'All' || showMine) && (
                <button
                  onClick={() => { setSearch(''); setCategory('All'); setShowMine(false); }}
                  className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-semibold transition"
                >
                  Clear Filters
                </button>
              )}
              <a
                href="/create"
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-semibold transition"
              >
                🎨 Create Collection
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <p className="text-slate-400 text-sm">
                Showing <span className="text-white font-semibold">{filtered.length}</span>{' '}
                of <span className="text-white font-semibold">{allCollections.length}</span> on-chain collections
              </p>
              <a
                href="/create"
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-semibold rounded-xl transition"
              >
                + Deploy Yours
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((col) => (
                <ExploreCard key={col.id || col.name} col={col} />
              ))}
            </div>
          </>
        )}

        {/* CTA Banner */}
        {!loading && (
          <div className="mt-16 rounded-2xl bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-purple-900/40 border border-purple-500/30 p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Launch your own collection</h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Create and deploy a collection — it shows up here live on the Aptos blockchain instantly.
            </p>
            <a
              href="/create"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl transition hover:shadow-xl hover:shadow-purple-500/30"
            >
              🎨 Create Collection
            </a>
          </div>
        )}
      </div>

      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>
            Built on{' '}
            <a href="https://aptos.dev" className="text-purple-400 hover:text-purple-300" target="_blank">Aptos</a>{' '}
            · Storage by{' '}
            <a href="https://docs.shelby.xyz" className="text-purple-400 hover:text-purple-300" target="_blank">Shelby Protocol</a>
          </p>
        </div>
      </footer>
    </main>
  );
}
