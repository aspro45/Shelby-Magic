import React, { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { getAccountBalance, getLedgerInfo, getTxUrl } from '@/utils/aptos';
import { Navigation } from '@/components/Navigation';

export const getServerSideProps = async () => ({ props: {} });

export default function Home() {
  const { walletAddress, setWalletAddress, collections } = useAppStore();
  const { connected, account } = useWallet();
  const [balance, setBalance] = useState<string>('0');
  const [networkStats, setNetworkStats] = useState<{
    blockHeight: number;
    version: string;
    epoch: string;
  } | null>(null);

  // Sync wallet address to store
  useEffect(() => {
    if (account?.address) {
      setWalletAddress(String(account.address));
    } else if (!connected) {
      setWalletAddress(null);
    }
  }, [account?.address, connected, setWalletAddress]);

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    const addr = walletAddress || (account?.address ? String(account.address) : null);
    if (!addr) return;
    const bal = await getAccountBalance(addr);
    setBalance((Number(bal) / 1e8).toFixed(4));
  }, [walletAddress, account?.address]);

  // Fetch live network stats
  const fetchNetworkStats = useCallback(async () => {
    try {
      const info = await getLedgerInfo();
      setNetworkStats({
        blockHeight: Number(info.block_height),
        version: info.ledger_version,
        epoch: info.epoch,
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const runUpdates = () => {
      if (document.visibilityState === 'visible') {
        fetchBalance();
        fetchNetworkStats();
      }
    };

    runUpdates();
    const interval = setInterval(runUpdates, 60000);
    
    // Add visibility change listener to update immediately when tab becomes active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runUpdates();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchBalance, fetchNetworkStats]);

  const features = [
    {
      icon: '🗄️',
      title: 'Shelby Protocol Storage',
      description: 'Store NFT assets on Shelby — high-performance decentralized storage built on Aptos with dedicated fiber bandwidth.',
    },
    {
      icon: '⚡',
      title: 'Block-STM Parallel Execution',
      description: 'Aptos processes your mint transactions in parallel using Block-STM, giving you sub-second finality at massive scale.',
    },
    {
      icon: '🎨',
      title: 'Multi-Phase Minting',
      description: 'Set up whitelist and public mint phases with custom pricing, per-wallet limits, and time-gated access.',
    },
    {
      icon: '💚',
      title: 'Sponsored Transactions',
      description: 'Offer gas-free minting to your community using Aptos sponsored transaction primitives.',
    },
    {
      icon: '🔄',
      title: 'Orderless Transactions',
      description: 'Submit multiple transactions simultaneously without sequence number coordination — ideal for high-throughput mints.',
    },
    {
      icon: '👑',
      title: 'On-Chain Royalties',
      description: 'Configure creator royalties via the Aptos Digital Asset standard — enforced at the protocol level.',
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation balance={balance} />

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <div className="text-center">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full border border-purple-500/30">
            <span className="text-purple-300 text-sm font-semibold">🚀 NFT Launchpad on Aptos Testnet</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent mb-6 leading-tight">
            Shelby Magic<br/>NFT Studio
          </h1>
          <p className="text-lg md:text-xl text-slate-400 mb-2 max-w-2xl mx-auto">
            1/1 Masterpieces secured by Shelby Protocol
          </p>
          <p className="text-sm text-slate-500 mb-10 max-w-xl mx-auto">
            Fast, secure, and scalable NFT creation powered by Aptos Block-STM parallel execution
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/explore"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-lg font-bold rounded-xl hover:shadow-2xl hover:shadow-purple-500/40 transition-all"
            >
              🌐 Explore Collections
            </a>
            <a
              href="/create"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 text-white text-lg font-semibold rounded-xl transition"
            >
              🎨 Create Collection
            </a>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 text-white text-lg font-semibold rounded-xl transition"
            >
              📊 Dashboard
            </a>
          </div>

          {/* Connected wallet info */}
          {(connected || walletAddress) && (
            <div className="mt-10 inline-block p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/40 rounded-xl text-sm">
              <div className="flex items-center gap-2 text-green-300 font-semibold mb-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Wallet Connected
              </div>
              <div className="text-slate-300 font-mono text-xs">
                {walletAddress || (account?.address ? String(account.address) : '')}
              </div>
              <div className="text-slate-400 text-xs mt-1">{balance} APT · Aptos Testnet</div>
            </div>
          )}
        </div>

        {/* Live Network Stats */}
        {networkStats && (
          <div className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              { label: 'Block Height', value: networkStats.blockHeight.toLocaleString() },
              { label: 'Ledger Version', value: Number(networkStats.version).toLocaleString() },
              { label: 'Epoch', value: networkStats.epoch },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl">
                <div className="text-xl font-bold text-white font-mono">{stat.value}</div>
                <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Your Collections */}
        {collections.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-bold text-white mb-4 text-center">Your Collections</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {collections.slice(0, 3).map((col) => (
                <div key={col.id} className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
                  <div className="font-semibold text-white mb-1">{col.name}</div>
                  <div className="text-xs text-slate-400 mb-2">{col.description}</div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{col.minted}/{col.supply} minted</span>
                    <span>{(col.royaltyBps / 100).toFixed(1)}% royalty</span>
                  </div>
                  {col.txHash && (
                    <a
                      href={getTxUrl(col.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block text-xs text-purple-400 hover:text-purple-300 transition truncate"
                    >
                      Tx: {col.txHash.slice(0, 20)}…
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-20">
          {features.map((feature, i) => (
            <div
              key={i}
              className="p-6 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/50 hover:border-purple-500/30 rounded-xl transition group"
            >
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-purple-300 transition">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>Built on <a href="https://aptos.dev" className="text-purple-400 hover:text-purple-300" target="_blank">Aptos</a> · Storage by <a href="https://docs.shelby.xyz" className="text-purple-400 hover:text-purple-300" target="_blank">Shelby Protocol</a></p>
        </div>
      </footer>
    </main>
  );
}
