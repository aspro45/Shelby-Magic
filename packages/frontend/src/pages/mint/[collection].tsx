import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useAppStore } from '@/store';
import { Navigation } from '@/components/Navigation';
import { getAccountBalance, buildMintNFTPayload, waitForTransaction, getTxUrl } from '@/utils/aptos';

export const getServerSideProps = async () => ({ props: {} });
import { uploadMetadataToShelby } from '@/utils/shelby';

export default function MintPage() {
  const router = useRouter();
  const { collection: collectionParam } = router.query;
  const collectionName = decodeURIComponent(String(collectionParam || ''));

  const { collections, setNotification, updateCollection } = useAppStore();
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const currentAddress = account?.address ? String(account.address) : null;

  const collection = collections.find((c) => c.name === collectionName);

  const [balance, setBalance] = useState('0');
  const [isMinting, setIsMinting] = useState(false);
  const [mintStep, setMintStep] = useState<'idle' | 'uploading' | 'minting' | 'done'>('idle');
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!currentAddress) return;
    getAccountBalance(currentAddress).then((bal) =>
      setBalance((Number(bal) / 1e8).toFixed(4))
    );
  }, [currentAddress]);

  const minted  = collection?.minted  ?? 0;
  const supply  = collection?.supply  ?? 1;
  const isSoldOut = minted >= supply;
  const isOneOfOne = supply === 1;
  const nextTokenNumber = minted + 1; // Next NFT number user will get

  const handleMint = async () => {
    if (!currentAddress || !signAndSubmitTransaction || !collection) return;
    if (isSoldOut) return;

    setIsMinting(true);
    setMintTxHash(null);

    try {
      setMintStep('uploading');

      // Each token gets its own metadata with unique name + number
      const tokenName = isOneOfOne
        ? collection.name                           // 1/1 = same name
        : `${collection.name} #${nextTokenNumber}`; // Edition = "Name #N"

      const metadataUrl = await uploadMetadataToShelby(
        {
          name: tokenName,
          description: collection.description,
          image: collection.imageUrl,    // same image for all tokens in this collection
          attributes: [
            { trait_type: 'Collection', value: collection.name },
            ...(!isOneOfOne ? [{ trait_type: 'Edition', value: `${nextTokenNumber} of ${supply}` }] : []),
          ],
        },
        `tokens/${collection.name}/${nextTokenNumber}_metadata_${Date.now()}.json`,
        signAndSubmitTransaction as any
      );

      setMintStep('minting');

      const payload = buildMintNFTPayload({
        collectionName: collection.name,
        tokenName,
        description: collection.description,
        uri: metadataUrl.length > 200 ? 'https://shelby.xyz/demo' : metadataUrl,
        recipient: currentAddress,
      });

      const txResult = await signAndSubmitTransaction({ data: payload });
      const txHash = (txResult as any).hash || '';

      if (txHash) {
        await waitForTransaction(txHash);
        setMintTxHash(txHash);
        updateCollection(collection.id, { minted: minted + 1 });
      }

      setMintStep('done');
      setNotification({
        type: 'success',
        message: isOneOfOne
          ? `Masterpiece "${collection.name}" minted! ✅`
          : `"${tokenName}" minted! ✅`,
      });
    } catch (err: any) {
      console.error('Mint error:', err);
      const errorMessage = err?.message || String(err);

      if (
        errorMessage.includes('TokenData already exists') ||
        errorMessage.includes('0x60002') ||
        errorMessage.includes('0x60005')
      ) {
        updateCollection(collection.id, { minted: Math.max(minted, 1) });
        setMintStep('done');
        setNotification({ type: 'success', message: `Already in your wallet! ✅` });
      } else {
        setNotification({ type: 'error', message: errorMessage || 'Failed to mint' });
        setMintStep('idle');
      }
    } finally {
      setIsMinting(false);
    }
  };

  if (!collection) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navigation balance={balance} />
        <div className="flex items-center justify-center h-[80vh] text-center">
          <div>
            <div className="text-5xl mb-4">🔍</div>
            <h1 className="text-2xl font-bold text-white mb-2">Collection Not Found</h1>
            <p className="text-slate-400 mb-2">&ldquo;{collectionName}&rdquo; is not in your local collections.</p>
            <p className="text-slate-500 text-sm mb-6">
              This may be a community collection. Create your own or explore available collections.
            </p>
            <div className="flex gap-3 justify-center">
              <a href="/explore" className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold transition">
                🌐 Explore Collections
              </a>
              <a href="/dashboard" className="px-6 py-3 bg-slate-800 border border-slate-600 text-white rounded-xl font-semibold transition">
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const mintStepLabel: Record<typeof mintStep, string> = {
    idle:      '💎 Mint Masterpiece',
    uploading: '🚀 Uploading metadata…',
    minting:   '🔗 Minting on Aptos…',
    done:      '✅ Minted!',
  };

  const progress = supply > 0 ? Math.min(100, Math.round((minted / supply) * 100)) : 0;

  const mintButtonLabel = isSoldOut
    ? isOneOfOne ? '🚫 Sold Out (1/1 Minted)' : `🚫 Sold Out (${supply}/${supply} Minted)`
    : !connected ? '🔑 Connect Wallet to Mint'
    : isMinting  ? 'Minting in Progress...'
    : isOneOfOne ? '💎 Mint 1/1 Artwork'
    : `💎 Mint #${nextTokenNumber} of ${supply}`;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation balance={balance} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* ── Left: Collection Info ── */}
          <div>
            <div className="relative">
              <img
                src={collection.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUwNzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJpbnRlciwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIEV4cGlyZWQ8L3RleHQ+PC9zdmc+'}
                alt={collection.name}
                className="w-full aspect-square object-cover rounded-2xl mb-5 border border-slate-700 bg-slate-900"
                onError={(e) => {
                  (e.target as HTMLImageElement).onerror = null;
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUyOTNiIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJpbnRlciwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIEV4cGlyZWQ8L3RleHQ+PC9zdmc+';
                }}
              />
              {/* Supply badge on image */}
              <div className="absolute top-3 left-3">
                {isOneOfOne
                  ? <span className="px-2.5 py-1 bg-purple-600/80 backdrop-blur-sm text-white text-xs font-bold rounded-full border border-purple-400/50">💎 1 of 1</span>
                  : <span className="px-2.5 py-1 bg-slate-900/80 backdrop-blur-sm text-white text-xs font-bold rounded-full border border-slate-600/50">{minted}/{supply} minted</span>
                }
              </div>
            </div>

            <h1 className="text-3xl font-bold text-white mb-2">{collection.name}</h1>
            <p className="text-slate-400 text-sm mb-5">{collection.description}</p>

            {/* Progress bar */}
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Progress</span>
                <span className="text-white font-semibold">{minted} / {supply}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{progress}% minted</span>
                <span>{collection.royaltyBps / 100}% royalty</span>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-800/50 rounded-xl p-3 text-center border border-slate-700/50">
                <div className="text-lg font-bold text-white">{supply - minted}</div>
                <div className="text-xs text-slate-500 mt-0.5">Remaining</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3 text-center border border-slate-700/50">
                <div className="text-lg font-bold text-purple-300">{collection.mintPrice > 0 ? `${collection.mintPrice}` : 'Free'}</div>
                <div className="text-xs text-slate-500 mt-0.5">{collection.mintPrice > 0 ? 'APT' : 'Mint'}</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3 text-center border border-slate-700/50">
                <div className="text-lg font-bold text-pink-300">{collection.royaltyBps / 100}%</div>
                <div className="text-xs text-slate-500 mt-0.5">Royalty</div>
              </div>
            </div>

            {collection.txHash && (
              <a href={getTxUrl(collection.txHash)} target="_blank" rel="noopener noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 transition">
                Collection Tx ↗
              </a>
            )}
          </div>

          {/* ── Right: Mint Form ── */}
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6 h-fit">
            <h2 className="text-xl font-bold text-white mb-1">
              {isOneOfOne ? 'Acquire 1/1 Artwork' : `Mint Your Edition`}
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              {isOneOfOne
                ? 'One unique token — minted directly to your wallet.'
                : `You will receive: ${collection.name} #${nextTokenNumber}`}
            </p>

            {/* Success */}
            {mintTxHash && (
              <div className="mb-5 p-4 bg-green-900/30 border border-green-500/40 rounded-xl">
                <p className="text-green-300 text-sm font-medium mb-1">✅ Minted Successfully!</p>
                <a href={getTxUrl(mintTxHash)} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-green-400 hover:text-green-300 underline break-all">
                  View on Aptos Explorer →
                </a>
              </div>
            )}

            {/* Not connected */}
            {!connected && (
              <div className="mb-5 p-4 bg-blue-900/30 border border-blue-500/40 rounded-xl text-sm text-blue-300">
                Connect your wallet to mint.
              </div>
            )}

            {/* Sold out */}
            {isSoldOut && (
              <div className="mb-5 p-4 bg-slate-800/60 border border-slate-600/50 rounded-xl">
                <p className="font-semibold text-white mb-1">
                  {isOneOfOne ? '🏆 This 1/1 has been claimed' : '🚫 Collection Sold Out'}
                </p>
                <p className="text-slate-400 text-sm">
                  {isOneOfOne
                    ? 'This unique artwork already lives in its owner\'s wallet.'
                    : `All ${supply} editions have been minted.`}
                </p>
              </div>
            )}

            <div className="space-y-4">
              {/* Token preview card */}
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                {!isSoldOut && (
                  <div className="flex items-center gap-3">
                    {collection.imageUrl && (
                      <img src={collection.imageUrl} alt={collection.name}
                        className="w-12 h-12 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div>
                      <div className="text-sm text-slate-400 mb-0.5">You will receive</div>
                      <div className="text-base font-bold text-white">
                        {isOneOfOne ? collection.name : `${collection.name} #${nextTokenNumber}`}
                      </div>
                      {!isOneOfOne && (
                        <div className="text-xs text-purple-400">Edition {nextTokenNumber} of {supply}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Spinning step indicator */}
              {isMinting && (
                <div className="flex items-center gap-3 text-purple-300 text-sm p-4 bg-purple-900/20 border border-purple-500/30 rounded-xl">
                  <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  {mintStepLabel[mintStep]}
                </div>
              )}

              <button
                onClick={handleMint}
                disabled={!connected || isMinting || isSoldOut}
                className="w-full py-4 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl transition hover:shadow-xl hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mintButtonLabel}
              </button>

              {!isSoldOut && collection.mintPrice > 0 && (
                <p className="text-center text-xs text-slate-500">
                  Price: {collection.mintPrice} APT · Balance: {balance} APT
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
