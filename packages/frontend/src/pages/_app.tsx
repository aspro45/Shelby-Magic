import React, { useEffect, useState, Component } from 'react';
import type { AppProps } from 'next/app';
import { AptosWalletAdapterProvider, Network as WalletNetwork } from '@aptos-labs/wallet-adapter-react';
import { Network } from '@aptos-labs/ts-sdk';
import Head from 'next/head';
import { useAppStore } from '@/store';
import '@/styles/globals.css';

// ---------------------------------------------------------------------------
// Error boundary — catches render-time errors.
// ---------------------------------------------------------------------------
interface ErrorBoundaryState { hasError: boolean; error: Error | null }

class AppErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Suppress extension-injection errors completely; don't enter error state
    if (error?.stack?.includes('chrome-extension://') || error?.stack?.includes('chunk-inject')) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Only log errors that are actually from our code
    if (
      !error?.stack?.includes('chrome-extension://') &&
      !error?.stack?.includes('chunk-inject')
    ) {
      console.error('App error:', error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-slate-400 text-sm mb-6">{this.state.error?.message}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
function App({ Component, pageProps }: AppProps) {
  const { notification, clearNotification, walletAddress, setWalletAddress } = useAppStore();
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(clearNotification, 5000);
    return () => clearTimeout(timer);
  }, [notification, clearNotification]);

  // Cleanly suppress problematic wallet extension errors that trigger the Next.js dev overlay
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleGlobalError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const error = 'error' in event ? event.error : (event as PromiseRejectionEvent).reason;
      const msg = error?.message || String(error || '');
      const stack = error?.stack || '';
      
      const isExtensionError = 
        msg.includes('chrome-extension://') || 
        msg.includes('chunk-inject') || 
        msg.includes('defineProperty') || 
        msg.includes('descriptor') ||
        msg.includes('accessors') ||
        msg.includes('Nightly') ||
        msg.includes('Backpack') ||
        stack.includes('chrome-extension://') ||
        (msg.includes('ethereum') && (msg.includes('getter') || msg.includes('defineProperty') || msg.includes('descriptor')));

      if (isExtensionError) {
        // Prevent the error from bubbling up and triggering the Next.js portal
        event.stopImmediatePropagation();
        event.preventDefault();
        return true;
      }
    };

    window.addEventListener('error', handleGlobalError, true);
    window.addEventListener('unhandledrejection', handleGlobalError, true);
    
    return () => {
      window.removeEventListener('error', handleGlobalError, true);
      window.removeEventListener('unhandledrejection', handleGlobalError, true);
    };
  }, []);

  const handleWalletError = (error: any) => {
    const msg: string = error?.message || '';
    console.error('Wallet adapter error:', error);
    setConnectionError(msg || 'Wallet connection failed');
    setTimeout(() => setConnectionError(null), 8000);
  };

  return (
    <AppErrorBoundary>
      <Head>
        <title>Shelby Magic - NFT Studio on Aptos</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/favicon.png" />
      </Head>
      <AptosWalletAdapterProvider
        autoConnect={true}
        dappConfig={{ network: Network.TESTNET as any }}
        onError={handleWalletError}
      >
        <Component {...pageProps} />

        {/* Toast notification */}
        {notification && (
          <div
            className={`fixed bottom-4 right-4 px-6 py-3 rounded-xl text-white font-semibold z-50 animate-fade-in shadow-2xl max-w-sm ${
              notification.type === 'success'
                ? 'bg-gradient-to-r from-green-600 to-emerald-600'
                : notification.type === 'error'
                ? 'bg-gradient-to-r from-red-600 to-rose-600'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600'
            }`}
          >
            {notification.message}
          </div>
        )}

        {/* Wallet connection error */}
        {connectionError && (
          <div className="fixed bottom-20 right-4 px-5 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl shadow-xl z-50 max-w-xs text-sm">
            <div className="font-semibold">Connection Issue</div>
            <div className="text-xs mt-1 opacity-90">{connectionError}</div>
          </div>
        )}
      </AptosWalletAdapterProvider>
    </AppErrorBoundary>
  );
}

export default App;
