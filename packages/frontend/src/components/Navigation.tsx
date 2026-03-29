import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useAppStore } from '@/store';

interface NavigationProps {
  balance?: string;
}

export function Navigation({ balance = '0' }: NavigationProps) {
  const router = useRouter();
  const { connected, account, connect, disconnect, wallets } = useWallet();
  const { walletAddress, collections } = useAppStore();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const displayAddress = walletAddress || (account?.address ? String(account.address) : null);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/explore', label: '🌐 Explore' },
    { href: '/marketplace', label: '🏪 Market' },
    { href: '/create', label: 'Create' },
    { href: '/dashboard', label: 'Dashboard' },
  ];

  const handleConnect = async (walletName: string) => {
    try {
      setIsConnecting(true);
      await (connect as any)(walletName);
      setShowWalletModal(false);
    } catch (err) {
      console.error('Wallet connect error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  return (
    <>
      <nav className="border-b border-slate-700/50 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-between items-center">
            {/* Logo + Nav Links */}
            <div className="flex items-center gap-6">
              <Link href="/" className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent hover:opacity-80 transition">
                Shelby Magic
              </Link>
              <div className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      router.pathname === link.href
                        ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Network badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-green-900/20 border border-green-600/30 rounded-full">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs font-medium">Testnet</span>
              </div>

              {/* Balance */}
              {(connected || displayAddress) && (
                <div className="hidden sm:block px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg">
                  <div className="text-xs text-slate-500">Balance</div>
                  <div className="text-sm text-white font-semibold">{balance} APT</div>
                </div>
              )}

              {/* Collections count */}
              {collections.length > 0 && (
                <Link href="/dashboard" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-purple-900/20 border border-purple-500/30 rounded-lg hover:bg-purple-900/30 transition">
                  <span className="text-purple-300 text-xs font-medium">{collections.length} collection{collections.length !== 1 ? 's' : ''}</span>
                </Link>
              )}

              {/* Wallet button */}
              {connected && displayAddress ? (
                <div className="flex items-center gap-2">
                  <div className="hidden lg:block px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg">
                    <a
                      href={`https://explorer.aptoslabs.com/account/${displayAddress}?network=testnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-400 font-mono hover:text-purple-300 transition"
                    >
                      {displayAddress.slice(0, 6)}…{displayAddress.slice(-4)}
                    </a>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 text-sm border border-slate-600 text-slate-400 hover:border-red-500/50 hover:text-red-400 rounded-lg transition"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowWalletModal(true)}
                  disabled={isConnecting}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-semibold rounded-lg transition shadow-lg shadow-purple-500/20 disabled:opacity-50"
                >
                  {isConnecting ? 'Connecting…' : 'Connect Wallet'}
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Wallet Selector Modal */}
      {showWalletModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowWalletModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-white">Connect Wallet</h2>
              <button
                onClick={() => setShowWalletModal(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>

            {wallets && wallets.length > 0 ? (
              <div className="space-y-2">
                {wallets.map((wallet: any) => (
                  <button
                    key={wallet.name}
                    onClick={() => handleConnect(wallet.name)}
                    disabled={isConnecting}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-purple-500/50 rounded-xl transition group disabled:opacity-50"
                  >
                    {wallet.icon && (
                      <img src={wallet.icon} alt={wallet.name} className="w-8 h-8 rounded-lg" />
                    )}
                    <div className="text-left flex-1">
                      <div className="text-white font-medium group-hover:text-purple-300 transition">{wallet.name}</div>
                      <div className="text-xs text-slate-500">
                        {wallet.readyState === 'Installed' ? '✓ Installed' : 'Not installed'}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="text-4xl mb-3">🔑</div>
                <p className="text-slate-400 text-sm mb-4">No Aptos wallets detected.</p>
                <div className="space-y-2">
                  <a
                    href="https://petra.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition"
                  >
                    Install Petra Wallet
                  </a>
                  <a
                    href="https://martianwallet.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition"
                  >
                    Install Martian Wallet
                  </a>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500 text-center mt-4">
              Make sure your wallet is set to <span className="text-purple-400">Aptos Testnet</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default Navigation;
