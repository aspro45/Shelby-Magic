import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '@/store';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import {
  getAccountBalance,
  getAccountTransactionCount,
  getAccountTransactions,
  getLedgerInfo,
  getTxUrl,
  getAccountUrl,
  getOwnedTokens,
  getCreatorCollections,
} from '@/utils/aptos';
import { Navigation } from '@/components/Navigation';

export const getServerSideProps = async () => ({ props: {} });

// ─── Constants ────────────────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60_000; // 5 minutes (was 60s — reduces API hammering)
const NFT_CACHE_TTL = 10 * 60_000; // NFTs cached longer (heavy query)

// ─── Collection Card ──────────────────────────────────────────────────────────
interface CollectionCardProps {
  col: any;
  isLocal: boolean;
  removeCollection: (id: string) => void;
  getTxUrl: (hash: string) => string;
}

const CollectionCard = React.memo(function CollectionCard({
  col, isLocal, removeCollection, getTxUrl,
}: CollectionCardProps) {
  const name        = isLocal ? col.name            : col.collection_name;
  const description = isLocal ? col.description     : col.description;
  const imageUrl    = isLocal ? col.imageUrl         : col.uri || '';
  const minted      = isLocal ? col.minted           : 0;
  const supply      = isLocal ? col.supply           : col.max_supply || 1;
  const mintPrice   = isLocal ? col.mintPrice        : 0;
  const txHash      = isLocal ? col.txHash           : null;

  return (
    <div className="relative group bg-slate-900/50 border border-slate-600/50 rounded-xl p-4 hover:border-purple-500/30 transition">
      {isLocal && (
        <button
          onClick={() => removeCollection(col.id)}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-red-900/60 hover:bg-red-600 border border-red-500/30 text-white rounded-md text-sm opacity-0 group-hover:opacity-100 transition-all z-20"
          title="Remove"
        >×</button>
      )}
      {imageUrl && (
        <img
          src={imageUrl} alt={name}
          className="w-full h-32 object-cover rounded-lg mb-3 bg-slate-800"
          loading="lazy"
          decoding="async"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="font-bold text-white mb-1 flex items-center justify-between">
        <span className="truncate">{name}</span>
        {!isLocal && <span className="text-[10px] px-2 bg-green-900/40 text-green-400 rounded-full whitespace-nowrap ml-2 border border-green-500/30">Synced</span>}
      </div>
      <div className="text-xs text-slate-400 mb-3 line-clamp-2">{description || 'No description'}</div>
      <div className="flex justify-between text-xs text-slate-500 mb-3">
        <span>{minted}/{supply} minted</span>
        {mintPrice > 0 && <span className="text-purple-400 font-medium">{mintPrice} APT</span>}
      </div>
      <div className="flex gap-2">
        {txHash && (
          <a href={getTxUrl(txHash)} target="_blank" rel="noopener noreferrer"
            className="flex-1 py-1.5 text-center text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg transition">
            View Tx ↗
          </a>
        )}
        <a href={`/mint/${encodeURIComponent(name)}`}
          className="flex-1 py-1.5 text-center text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition">
          Mint Page →
        </a>
      </div>
    </div>
  );
});

// ─── NFT Card — separated + lazy so it doesn't block main render ──────────────
const NFTCard = React.memo(function NFTCard({ nft, idx }: { nft: any; idx: number }) {
  const data = nft.current_token_data || nft;
  const uri  = data.token_uri || '';
  const name = data.token_name || `Artwork #${idx + 1}`;
  const col  = data.current_collection?.collection_name || 'Shelby Magic';

  return (
    <div className="group relative bg-slate-950/40 border border-slate-700/50 rounded-xl overflow-hidden hover:border-purple-500/50 transition duration-300 shadow-xl">
      <div className="aspect-square overflow-hidden bg-slate-900">
        {uri ? (
          <img
            src={uri} alt={name}
            className="w-full h-full object-cover group-hover:scale-110 transition duration-500 ease-out"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const t = e.target as HTMLImageElement;
              t.onerror = null;
              t.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-slate-600">🖼️</div>
        )}
      </div>
      <div className="p-3 absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-900/90 to-transparent pt-12">
        <div className="text-white font-bold text-sm truncate">{name}</div>
        <div className="text-purple-400 text-xs truncate mt-0.5">{col}</div>
      </div>
      <a
        href={`https://explorer.aptoslabs.com/token/${data.token_data_id}?network=testnet`}
        target="_blank" rel="noopener noreferrer"
        className="absolute inset-0 bg-purple-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center"
      >
        <span className="px-4 py-2 bg-slate-950/80 text-white text-xs font-semibold rounded-lg border border-purple-500/50 shadow-2xl scale-95 group-hover:scale-100 transition">
          View on Explorer ↗
        </span>
      </a>
    </div>
  );
});

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { walletAddress, collections, removeCollection, setDashboardCache } = useAppStore();
  const { account } = useWallet();
  const effectiveAddress = walletAddress || (account?.address ? String(account.address) : null);

  // Split state into CRITICAL (shown immediately) vs HEAVY (loaded after)
  const [criticalData, setCriticalData] = useState({
    balance: '0',
    txCount: 0,
    recentTxs: [] as any[],
    networkStats: { blockHeight: 0, version: '0' },
  });
  const [heavyData, setHeavyData] = useState({
    ownedNFTs: [] as any[],
    onChainCollections: [] as any[],
  });

  // Separate loading states — critical blocks UI, heavy shows skeleton in its section
  const [loadingCritical, setLoadingCritical] = useState(true);
  const [loadingHeavy, setLoadingHeavy] = useState(true);
  const [nftCacheTime, setNftCacheTime] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const setCacheRef = useRef(setDashboardCache);
  setCacheRef.current = setDashboardCache;

  // ── PHASE 1: fetch lightweight data first (balance, tx count, recent txs, ledger)
  const fetchCritical = useCallback(async () => {
    if (!effectiveAddress) { setLoadingCritical(false); return; }

    // Check cache
    const cached = useAppStore.getState().dashboardCache;
    if (cached && Date.now() - (cached.timestamp ?? 0) < CACHE_TTL) {
      setCriticalData({
        balance: cached.balance,
        txCount: cached.txCount,
        recentTxs: cached.recentTxs,
        networkStats: cached.networkStats ?? { blockHeight: 0, version: '0' },
      });
      setLoadingCritical(false);
      return;
    }

    try {
      // These 4 are fast — run together
      const [bal, count, txs, ledger] = await Promise.all([
        getAccountBalance(effectiveAddress),
        getAccountTransactionCount(effectiveAddress),
        getAccountTransactions(effectiveAddress, 5),
        getLedgerInfo(),
      ]);

      const balance = (Number(bal) / 1e8).toFixed(4);
      const networkStats = { blockHeight: Number(ledger.block_height), version: ledger.ledger_version };

      setCriticalData({ balance, txCount: count, recentTxs: txs, networkStats });
      // Cache partial data too
      const prev = useAppStore.getState().dashboardCache;
      setCacheRef.current({
        balance, txCount: count, recentTxs: txs, networkStats,
        ownedNFTs: prev?.ownedNFTs ?? [],
        onChainCollections: prev?.onChainCollections ?? [],
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Critical fetch error:', err);
    } finally {
      setLoadingCritical(false);
    }
  }, [effectiveAddress]);

  // ── PHASE 2: fetch heavy data AFTER critical renders (NFTs, on-chain collections)
  const fetchHeavy = useCallback(async () => {
    if (!effectiveAddress) { setLoadingHeavy(false); return; }

    // NFTs cached longer since they change rarely
    const cached = useAppStore.getState().dashboardCache;
    if (cached && Date.now() - (cached.timestamp ?? 0) < NFT_CACHE_TTL && cached.ownedNFTs?.length >= 0) {
      setHeavyData({
        ownedNFTs: cached.ownedNFTs,
        onChainCollections: cached.onChainCollections,
      });
      setLoadingHeavy(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      // These are heavy — run in parallel but separately from critical
      const [nfts, chainCols] = await Promise.all([
        getOwnedTokens(effectiveAddress),
        getCreatorCollections(effectiveAddress),
      ]);

      if (abortRef.current?.signal.aborted) return;

      const onChainCollections = (chainCols ?? []).filter(
        (c: any) => String(c.uri).toLowerCase().includes('shelby')
      );

      setHeavyData({ ownedNFTs: nfts, onChainCollections });
      setNftCacheTime(Date.now());

      // Merge into full cache
      const prev = useAppStore.getState().dashboardCache;
      if (prev) {
        setCacheRef.current({ ...prev, ownedNFTs: nfts, onChainCollections, timestamp: prev.timestamp });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Heavy fetch error:', err);
    } finally {
      setLoadingHeavy(false);
    }
  }, [effectiveAddress]);

  useEffect(() => {
    setLoadingCritical(true);
    // Phase 1 immediately
    fetchCritical().then(() => {
      // Phase 2 starts after phase 1 — doesn't compete for CPU/network at the same time
      setLoadingHeavy(true);
      fetchHeavy();
    });

    // Only auto-refresh critical data — NFTs don't need polling
    const interval = setInterval(fetchCritical, CACHE_TTL);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchCritical, fetchHeavy]);

  if (!effectiveAddress) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navigation />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <div className="text-5xl mb-4">🔑</div>
            <h1 className="text-2xl font-bold text-white mb-3">Connect Your Wallet</h1>
            <p className="text-slate-400 mb-6">Connect your Aptos wallet to view your dashboard</p>
            <a href="/" className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition font-semibold">
              Back to Home
            </a>
          </div>
        </div>
      </main>
    );
  }

  const statsCards = useMemo(() => [
    { label: 'APT Balance',        value: criticalData.balance,                             unit: 'APT',           color: 'from-purple-900/30', border: 'border-purple-500/30', text: 'text-purple-300' },
    { label: 'Total Transactions', value: criticalData.txCount.toLocaleString(),            unit: 'on-chain',      color: 'from-blue-900/30',   border: 'border-blue-500/30',   text: 'text-blue-300'   },
    { label: 'NFT Collections',    value: collections.length.toString(),                    unit: 'created',       color: 'from-pink-900/30',   border: 'border-pink-500/30',   text: 'text-pink-300'   },
    { label: 'Block Height',       value: criticalData.networkStats.blockHeight.toLocaleString(), unit: 'Aptos Testnet', color: 'from-green-900/30',  border: 'border-green-500/30',  text: 'text-green-300'  },
  ], [criticalData.balance, criticalData.txCount, criticalData.networkStats.blockHeight, collections.length]);

  const combinedCollections = useMemo(() => {
    const localIds = new Set(collections.map((c) => c.name));
    return [
      ...collections,
      ...heavyData.onChainCollections.filter((oc: any) => !localIds.has(oc.collection_name)),
    ];
  }, [collections, heavyData.onChainCollections]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation balance={criticalData.balance} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400 mt-1 font-mono text-sm">
              <a href={getAccountUrl(effectiveAddress)} target="_blank" rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 transition">
                {effectiveAddress.slice(0, 16)}…{effectiveAddress.slice(-8)} ↗
              </a>
            </p>
          </div>
          <div className="flex gap-3">
            <a href="/create"
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-xl text-sm font-semibold transition">
              + Create Collection
            </a>
            <button
              onClick={() => {
                setLoadingCritical(true);
                setLoadingHeavy(true);
                fetchCritical().then(fetchHeavy);
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-sm transition"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards — show immediately with critical data */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsCards.map((card) => (
            <div key={card.label}
              className={`bg-gradient-to-br ${card.color} to-slate-900/50 border ${card.border} rounded-xl p-5 backdrop-blur-sm`}>
              <div className="text-slate-400 text-xs mb-1">{card.label}</div>
              <div className={`text-2xl font-bold ${card.text} ${loadingCritical ? 'animate-pulse' : ''}`}>
                {loadingCritical ? '—' : card.value}
              </div>
              <div className="text-slate-500 text-xs mt-1">{card.unit}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Recent Transactions */}
          <div className="lg:col-span-2 bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Recent Transactions</h2>
            {loadingCritical ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-700/40 rounded-lg animate-pulse" />)}
              </div>
            ) : criticalData.recentTxs.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-slate-500 text-sm">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {criticalData.recentTxs.map((tx: any, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tx.success ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                      {tx.success ? '✓' : '✗'} {tx.type?.replace('_transaction', '') || 'tx'}
                    </span>
                    <a href={getTxUrl(tx.hash || '')} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-purple-400 hover:text-purple-300 font-mono transition">
                      {tx.hash?.slice(0, 10)}… ↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <a href="/create"
                className="flex items-center justify-between w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-xl text-sm font-medium transition">
                <span>🎨 Create Collection</span><span>→</span>
              </a>
              <a href={getAccountUrl(effectiveAddress)} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition">
                <span>🔍 Aptos Explorer</span><span>↗</span>
              </a>
              <a href="https://aptos.dev/network/faucet" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between w-full px-4 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition">
                <span>🚰 Testnet Faucet</span><span>↗</span>
              </a>
              <a href="https://discord.gg/shelbyprotocol" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between w-full px-4 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition">
                <span>💜 Shelby Discord</span><span>↗</span>
              </a>
            </div>
          </div>
        </div>

        {/* Collections — appears once heavy data is ready */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">
              Your NFT Collections ({combinedCollections.length})
            </h2>
            {combinedCollections.length > 0 && (
              <a href="/create" className="text-xs text-purple-400 hover:text-purple-300 transition">+ New</a>
            )}
          </div>

          {combinedCollections.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">🖼️</div>
              <p className="text-slate-400 mb-4">No collections yet</p>
              <a href="/create"
                className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-semibold transition">
                Create Your First Collection
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {combinedCollections.map((col: any) => {
                const isLocal = !!col.id;
                return (
                  <CollectionCard
                    key={isLocal ? col.id : col.collection_id}
                    col={col} isLocal={isLocal}
                    removeCollection={removeCollection}
                    getTxUrl={getTxUrl}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Portfolio — heavy section, loads after critical */}
        <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/20 border border-slate-700/50 rounded-xl p-8 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-6 border-b border-slate-700/50 pb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-3xl">🖼️</span> My NFT Portfolio
              <span className="text-sm font-medium px-3 py-1 bg-purple-600/20 text-purple-300 rounded-full border border-purple-500/30">
                {loadingHeavy ? '…' : `${heavyData.ownedNFTs.length} Assets`}
              </span>
            </h2>
            {!loadingHeavy && nftCacheTime > 0 && (
              <span className="text-xs text-slate-600">
                Cached {Math.round((Date.now() - nftCacheTime) / 1000)}s ago
              </span>
            )}
          </div>

          {loadingHeavy ? (
            // Lightweight skeleton — no heavy DOM
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="aspect-square bg-slate-800/50 rounded-xl animate-pulse border border-slate-700/50" />
              ))}
            </div>
          ) : heavyData.ownedNFTs.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-slate-700/30 border-dashed">
              <div className="text-5xl mb-4 opacity-50">📭</div>
              <h3 className="text-lg font-semibold text-white mb-2">Your portfolio is empty</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
                You don&apos;t own any NFTs on the Aptos testnet yet. Mint your first 1/1 Masterpiece!
              </p>
              <a href="/create"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-purple-100 transition shadow-lg shadow-white/10">
                Go Mint an Artwork
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {heavyData.ownedNFTs.map((nft, idx) => (
                <NFTCard key={idx} nft={nft} idx={idx} />
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
